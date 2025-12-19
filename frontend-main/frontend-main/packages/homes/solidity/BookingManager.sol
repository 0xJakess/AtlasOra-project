// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PropertyMarketplace.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title BookingManager
 * @dev Manages bookings, check-ins, and dispute resolution for properties
 */
contract BookingManager is Ownable, ERC2771Context {
	// Reference to the property marketplace
	PropertyMarketplace public propertyMarketplace;
	
	// Booking ID counter
	uint256 private _bookingIdCounter;
	
	// Time constants
	uint256 public constant CHECK_IN_WINDOW = 24 hours;
	uint256 public constant DISPUTE_RESOLUTION_WINDOW = 24 hours;
	
	// Booking status enum
	enum BookingStatus {
		Active,          // Booking is confirmed but not yet at check-in date
		CheckInReady,    // Check-in date reached, waiting for guest to check in
		CheckedIn,       // Guest has checked in
		Completed,       // Booking completed successfully
		Disputed,        // Dispute raised, in resolution phase
		Cancelled,       // Booking was cancelled
		Refunded,        // Booking was refunded
		EscalatedToAdmin // Dispute escalated to admin for resolution
	}
	
	// Booking struct
	struct Booking {
		uint256 bookingId;
		string propertyId;
		address guest;
		uint256 checkInDate;
		uint256 checkOutDate;
		uint256 totalAmount;
		uint256 platformFee;
		uint256 hostAmount;
		BookingStatus status;
		uint256 checkInWindowStart;
		uint256 checkInDeadline;
		uint256 disputeDeadline;
		bool isCheckInComplete;
		bool isResolvedByHost;
		bool isResolvedByGuest;
		string disputeReason;
	}
	
	// Mappings
	mapping(uint256 => Booking) public bookings;
	mapping(string => uint256[]) public propertyBookings; // propertyId => bookingIds
	mapping(address => uint256[]) public guestBookings; // guest => bookingIds
	
	// Events
	event BookingCreated(uint256 bookingId, string propertyId, address guest, uint256 checkInDate, uint256 amount);
	event CheckInWindowOpened(uint256 bookingId, uint256 deadline);
	event CheckedIn(uint256 bookingId, address guest);
	event CheckInMissed(uint256 bookingId);
	event DisputeRaised(uint256 bookingId, string reason);
	event DisputeResolved(uint256 bookingId, bool byHost, bool byGuest);
	event DisputeEscalated(uint256 bookingId);
	event BookingCompleted(uint256 bookingId);
	event BookingCancelled(uint256 bookingId);
	event BookingRefunded(uint256 bookingId, uint256 amount);
	
	/**
	 * @dev Constructor sets the property marketplace contract address and trusted forwarder
	 */
	constructor(address _propertyMarketplaceAddress, address _trustedForwarder)
		Ownable(_msgSender())
		ERC2771Context(_trustedForwarder)
	{
		propertyMarketplace = PropertyMarketplace(_propertyMarketplaceAddress);
	}
	
	/**
	 * @dev Check if there are any booking conflicts for a property during a given date range
	 * @param _propertyId ID of the property to check
	 * @param _checkInDate Proposed check-in date
	 * @param _checkOutDate Proposed check-out date
	 * @return hasConflict Whether there is a booking conflict
	 */
	function hasBookingConflict(
		string memory _propertyId, 
		uint256 _checkInDate, 
		uint256 _checkOutDate
	) public view returns (bool hasConflict) {
		// Get all bookings for this property
		uint256[] memory propertyBookingIds = propertyBookings[_propertyId];
		
		// Check each booking for date overlap
		for (uint256 i = 0; i < propertyBookingIds.length; i++) {
			Booking storage existingBooking = bookings[propertyBookingIds[i]];
			
			// Skip cancelled and refunded bookings
			if (existingBooking.status == BookingStatus.Cancelled || 
				existingBooking.status == BookingStatus.Refunded) {
				continue;
			}
			
			// Check for date overlap
			// New booking starts before existing booking ends AND
			// New booking ends after existing booking starts
			if (_checkInDate < existingBooking.checkOutDate && 
				_checkOutDate > existingBooking.checkInDate) {
				return true;
			}
		}
		
		return false;
	}
	
	/**
	 * @dev Create a new booking for a property
	 * @param _propertyId ID of the property to book
	 * @param _checkInDate Unix timestamp for check-in date
	 * @param _checkOutDate Unix timestamp for check-out date
	 */
	function createBooking(
		string memory _propertyId,
		uint256 _checkInDate,
		uint256 _checkOutDate
	) external payable returns (uint256) {
		// Verify property exists and is active
		(string memory propId, address tokenAddr, address owner, uint256 pricePerNight, bool isActive, string memory propURI) = propertyMarketplace.properties(_propertyId);
		
		require(isActive, "Property not active");
		require(owner != address(0), "Property does not exist");
		
		// Verify dates
		require(_checkInDate > block.timestamp, "Check-in must be in the future");
		require(_checkOutDate > _checkInDate, "Check-out must be after check-in");
		
		// Check for booking conflicts
		require(!hasBookingConflict(_propertyId, _checkInDate, _checkOutDate), "Booking dates conflict with existing booking");
		
		// Calculate number of nights
		uint256 numNights = (_checkOutDate - _checkInDate) / 1 days;
		require(numNights > 0, "Booking must be at least 1 night");
		
		// Calculate total amount
		uint256 totalAmount = pricePerNight * numNights;
		require(msg.value >= totalAmount, "Insufficient payment");
		
		// Calculate platform fee (3%)
		uint256 platformFee = (totalAmount * propertyMarketplace.platformFeePercentage()) / 1000;
		uint256 hostAmount = totalAmount - platformFee;
		
		// Create booking
		_bookingIdCounter++;
		uint256 bookingId = _bookingIdCounter;
		
		address sender = _msgSender();
		bookings[bookingId] = Booking({
			bookingId: bookingId,
			propertyId: _propertyId,
			guest: sender,
			checkInDate: _checkInDate,
			checkOutDate: _checkOutDate,
			totalAmount: totalAmount,
			platformFee: platformFee,
			hostAmount: hostAmount,
			status: BookingStatus.Active,
			checkInWindowStart: 0,
			checkInDeadline: 0,
			disputeDeadline: 0,
			isCheckInComplete: false,
			isResolvedByHost: false,
			isResolvedByGuest: false,
			disputeReason: ""
		});
		
		// Add booking to property and guest mappings
		propertyBookings[_propertyId].push(bookingId);
		guestBookings[sender].push(bookingId);
		
		// Send platform fee to fee recipient
		address payable feeRecipient = propertyMarketplace.feeRecipient();
		(bool feeSuccess, ) = feeRecipient.call{value: platformFee}("");
		require(feeSuccess, "Fee transfer failed");
		
		// Refund excess payment
		if (msg.value > totalAmount) {
			(bool refundSuccess, ) = sender.call{value: msg.value - totalAmount}("");
			require(refundSuccess, "Refund transfer failed");
		}
		
		// Emit event
		emit BookingCreated(bookingId, _propertyId, sender, _checkInDate, totalAmount);
		
		return bookingId;
	}
	
	/**
	 * @dev Trigger check-in window start (can be called by anyone)
	 * @param _bookingId ID of the booking
	 */
	function triggerCheckInWindow(uint256 _bookingId) external {
		Booking storage booking = bookings[_bookingId];
		require(booking.bookingId == _bookingId, "Booking does not exist");
		require(booking.status == BookingStatus.Active, "Booking not active");
		require(block.timestamp >= booking.checkInDate, "Check-in date not reached");
		require(booking.checkInWindowStart == 0, "Check-in window already triggered");
		
		// Set check-in window details
		booking.checkInWindowStart = block.timestamp;
		booking.checkInDeadline = block.timestamp + CHECK_IN_WINDOW;
		booking.status = BookingStatus.CheckInReady;
		
		// Emit event
		emit CheckInWindowOpened(_bookingId, booking.checkInDeadline);
	}
	
	/**
	 * @dev Guest checks in
	 * @param _bookingId ID of the booking
	 */
	function checkIn(uint256 _bookingId) external {
		Booking storage booking = bookings[_bookingId];
		require(booking.guest == _msgSender(), "Not the guest");
		require(booking.status == BookingStatus.CheckInReady, "Not ready for check-in");
		require(block.timestamp <= booking.checkInDeadline, "Check-in window expired");
		
		// Update booking status
		booking.status = BookingStatus.CheckedIn;
		booking.isCheckInComplete = true;
		
		// Emit event
		emit CheckedIn(_bookingId, _msgSender());
	}
	
	/**
	 * @dev Process missed check-in (can be called by anyone after check-in deadline)
	 * @param _bookingId ID of the booking
	 */
	function processMissedCheckIn(uint256 _bookingId) external {
		Booking storage booking = bookings[_bookingId];
		require(booking.status == BookingStatus.CheckInReady, "Not in check-in window");
		require(block.timestamp > booking.checkInDeadline, "Check-in window not expired");
		
		// Update booking status to disputed
		booking.status = BookingStatus.Disputed;
		booking.disputeDeadline = block.timestamp + DISPUTE_RESOLUTION_WINDOW;
		booking.disputeReason = "Missed check-in";
		
		// Emit events
		emit CheckInMissed(_bookingId);
		emit DisputeRaised(_bookingId, "Missed check-in");
	}
	
	/**
	 * @dev Host resolves dispute
	 * @param _bookingId ID of the booking
	 */
	function hostResolveDispute(uint256 _bookingId) external {
		Booking storage booking = bookings[_bookingId];
		
		// Get property info to verify owner
		(string memory propId, address tokenAddr, address owner, uint256 pricePerNight, bool isActive, string memory propURI) = propertyMarketplace.properties(booking.propertyId);
		
		require(owner == _msgSender(), "Not the property owner");
		require(booking.status == BookingStatus.Disputed, "Not in dispute");
		require(block.timestamp <= booking.disputeDeadline, "Dispute window expired");
		
		booking.isResolvedByHost = true;
		
		// Check if both parties have resolved
		if (booking.isResolvedByGuest) {
			_completeBooking(_bookingId);
		}
		
		emit DisputeResolved(_bookingId, true, booking.isResolvedByGuest);
	}
	
	/**
	 * @dev Guest resolves dispute
	 * @param _bookingId ID of the booking
	 */
	function guestResolveDispute(uint256 _bookingId) external {
		Booking storage booking = bookings[_bookingId];
		require(booking.guest == _msgSender(), "Not the guest");
		require(booking.status == BookingStatus.Disputed, "Not in dispute");
		require(block.timestamp <= booking.disputeDeadline, "Dispute window expired");
		
		booking.isResolvedByGuest = true;
		
		// Check if both parties have resolved
		if (booking.isResolvedByHost) {
			_completeBooking(_bookingId);
		}
		
		emit DisputeResolved(_bookingId, booking.isResolvedByHost, true);
	}
	
	/**
	 * @dev Escalate dispute to admin (can be called by anyone after dispute deadline)
	 * @param _bookingId ID of the booking
	 */
	function escalateDispute(uint256 _bookingId) external {
		Booking storage booking = bookings[_bookingId];
		require(booking.status == BookingStatus.Disputed, "Not in dispute");
		require(block.timestamp > booking.disputeDeadline, "Dispute resolution window not expired");
		require(!(booking.isResolvedByHost && booking.isResolvedByGuest), "Dispute already resolved");
		
		booking.status = BookingStatus.EscalatedToAdmin;
		
		emit DisputeEscalated(_bookingId);
	}
	
	/**
	 * @dev Admin resolves escalated dispute (owner only)
	 * @param _bookingId ID of the booking
	 * @param _refundToGuest Whether to refund the guest
	 */
	function adminResolveDispute(uint256 _bookingId, bool _refundToGuest) external onlyOwner {
		Booking storage booking = bookings[_bookingId];
		require(booking.status == BookingStatus.EscalatedToAdmin, "Not escalated to admin");
		
		if (_refundToGuest) {
			// Refund the guest
			_refundBooking(_bookingId);
		} else {
			// Complete booking, pay the host
			_completeBooking(_bookingId);
		}
	}
	
	/**
	 * @dev Complete a booking and pay the host
	 * @param _bookingId ID of the booking
	 */
	function _completeBooking(uint256 _bookingId) internal {
		Booking storage booking = bookings[_bookingId];
		
		// Get property info for host payment
		(string memory propId, address tokenAddr, address owner, uint256 pricePerNight, bool isActive, string memory propURI) = propertyMarketplace.properties(booking.propertyId);
		
		// Update booking status
		booking.status = BookingStatus.Completed;
		
		// Pay the host
		(bool hostPaySuccess, ) = payable(owner).call{value: booking.hostAmount}("");
		require(hostPaySuccess, "Host payment failed");
		
		emit BookingCompleted(_bookingId);
	}
	
	/**
	 * @dev Refund a booking to the guest
	 * @param _bookingId ID of the booking
	 */
	function _refundBooking(uint256 _bookingId) internal {
		Booking storage booking = bookings[_bookingId];
		
		// Update booking status
		booking.status = BookingStatus.Refunded;
		
		// Refund the guest
		(bool guestRefundSuccess, ) = payable(booking.guest).call{value: booking.hostAmount}("");
		require(guestRefundSuccess, "Guest refund failed");
		
		emit BookingRefunded(_bookingId, booking.hostAmount);
	}
	
	/**
	 * @dev Cancel a booking before check-in date (guest only)
	 * @param _bookingId ID of the booking
	 */
	function cancelBooking(uint256 _bookingId) external {
		Booking storage booking = bookings[_bookingId];
		require(booking.guest == _msgSender(), "Not the guest");
		require(booking.status == BookingStatus.Active, "Cannot cancel booking");
		require(block.timestamp < booking.checkInDate, "Past check-in date");
		
		// Update booking status
		booking.status = BookingStatus.Cancelled;
		
		// Refund the guest (minus platform fee which is non-refundable)
		(bool guestRefundSuccess, ) = payable(booking.guest).call{value: booking.hostAmount}("");
		require(guestRefundSuccess, "Guest refund failed");
		
		emit BookingCancelled(_bookingId);
		emit BookingRefunded(_bookingId, booking.hostAmount);
	}
	
	/**
	 * @dev Get a guest's bookings
	 * @param _guest Address of the guest
	 * @return Array of booking IDs
	 */
	function getGuestBookings(address _guest) external view returns (uint256[] memory) {
		return guestBookings[_guest];
	}
	
	/**
	 * @dev Get a property's bookings
	 * @param _propertyId ID of the property
	 * @return Array of booking IDs
	 */
	function getPropertyBookings(string memory _propertyId) external view returns (uint256[] memory) {
		return propertyBookings[_propertyId];
	}

	// Ensure the correct sender is used by both Ownable and ERC2771Context
	function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
		return ERC2771Context._msgSender();
	}

	function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
		return ERC2771Context._msgData();
	}

	function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
		return ERC2771Context._contextSuffixLength();
	}
} 