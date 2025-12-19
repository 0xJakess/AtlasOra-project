// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PropertyMarketplace.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BookingManager
 * @dev Manages bookings, check-ins, and dispute resolution for properties
 * @notice Uses EURC stablecoin for payments (6 decimals)
 */
contract BookingManager is Ownable, ERC2771Context {
	using SafeERC20 for IERC20;

	// Reference to the property marketplace
	PropertyMarketplace public propertyMarketplace;

	// EURC token for payments
	IERC20 public eurcToken;

	// Treasury address for platform fees
	address public treasury;

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
		address host;             // Host address for payouts
		uint256 checkInDate;
		uint256 checkOutDate;
		uint256 totalAmount;      // EURC amount (6 decimals)
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
		string bookingURI;        // IPFS URI for booking metadata
		string paymentReference;  // External payment reference (e.g., Revolut order ID)
		bool paidOffChain;        // True if payment handled externally (fiat), false if paid via EURC
	}
	
	// Mappings
	mapping(uint256 => Booking) public bookings;
	mapping(string => uint256[]) public propertyBookings; // propertyId => bookingIds
	mapping(address => uint256[]) public guestBookings; // guest => bookingIds
	
	// Events
	event BookingCreated(uint256 bookingId, string propertyId, address guest, uint256 checkInDate, uint256 amount);
	event BookingCreatedPaid(
		uint256 indexed bookingId,
		string propertyId,
		address indexed guest,
		uint256 checkInDate,
		uint256 checkOutDate,
		uint256 totalAmount,
		string paymentReference,
		string bookingURI
	);
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
	 * @dev Constructor sets the property marketplace, forwarder, EURC token, and treasury
	 * @param _propertyMarketplaceAddress Address of the PropertyMarketplace contract
	 * @param _trustedForwarder Address of the meta-transaction forwarder
	 * @param _eurcToken Address of the EURC token contract
	 * @param _treasury Address to receive platform fees
	 */
	constructor(
		address _propertyMarketplaceAddress,
		address _trustedForwarder,
		address _eurcToken,
		address _treasury
	)
		Ownable(_msgSender())
		ERC2771Context(_trustedForwarder)
	{
		propertyMarketplace = PropertyMarketplace(_propertyMarketplaceAddress);
		eurcToken = IERC20(_eurcToken);
		treasury = _treasury;
	}

	/**
	 * @dev Update treasury address (owner only)
	 */
	function setTreasury(address _treasury) external onlyOwner {
		require(_treasury != address(0), "Invalid treasury address");
		treasury = _treasury;
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
	 * @dev Create a new booking for a property with EURC payment
	 * @notice Guest must approve EURC transfer before calling this function
	 * @param _propertyId ID of the property to book
	 * @param _checkInDate Unix timestamp for check-in date
	 * @param _checkOutDate Unix timestamp for check-out date
	 * @param _totalAmount Total EURC amount to pay (6 decimals)
	 * @param _bookingURI IPFS URI for booking metadata
	 */
	function createBooking(
		string memory _propertyId,
		uint256 _checkInDate,
		uint256 _checkOutDate,
		uint256 _totalAmount,
		string memory _bookingURI
	) external returns (uint256) {
		// Verify property exists and is active
		(, , address host, , bool isActive, ) = propertyMarketplace.properties(_propertyId);

		require(isActive, "Property not active");
		require(host != address(0), "Property does not exist");

		address guest = _msgSender();
		require(host != guest, "Cannot book own property");

		// Verify dates
		require(_checkInDate > block.timestamp, "Check-in must be in the future");
		require(_checkOutDate > _checkInDate, "Check-out must be after check-in");

		// Check for booking conflicts
		require(!hasBookingConflict(_propertyId, _checkInDate, _checkOutDate), "Booking dates conflict with existing booking");

		// Calculate number of nights
		uint256 numNights = (_checkOutDate - _checkInDate) / 1 days;
		require(numNights > 0, "Booking must be at least 1 night");

		// Transfer EURC from guest to contract (escrow)
		eurcToken.safeTransferFrom(guest, address(this), _totalAmount);

		// Calculate platform fee (3%)
		uint256 platformFee = (_totalAmount * propertyMarketplace.platformFeePercentage()) / 1000;
		uint256 hostAmount = _totalAmount - platformFee;

		// Create booking
		_bookingIdCounter++;
		uint256 bookingId = _bookingIdCounter;

		bookings[bookingId] = Booking({
			bookingId: bookingId,
			propertyId: _propertyId,
			guest: guest,
			host: host,
			checkInDate: _checkInDate,
			checkOutDate: _checkOutDate,
			totalAmount: _totalAmount,
			platformFee: platformFee,
			hostAmount: hostAmount,
			status: BookingStatus.Active,
			checkInWindowStart: 0,
			checkInDeadline: 0,
			disputeDeadline: 0,
			isCheckInComplete: false,
			isResolvedByHost: false,
			isResolvedByGuest: false,
			disputeReason: "",
			bookingURI: _bookingURI,
			paymentReference: "",
			paidOffChain: false
		});

		// Add booking to property and guest mappings
		propertyBookings[_propertyId].push(bookingId);
		guestBookings[guest].push(bookingId);

		// Emit event
		emit BookingCreated(bookingId, _propertyId, guest, _checkInDate, _totalAmount);

		return bookingId;
	}

	/**
	 * @dev Create a booking record for off-chain payment (fiat via Revolut)
	 * @notice Only callable via meta-transaction with user's custodial wallet signature
	 * @notice No EURC transfer - payment handled externally
	 * @param _propertyId ID of the property to book
	 * @param _checkInDate Unix timestamp for check-in date
	 * @param _checkOutDate Unix timestamp for check-out date
	 * @param _totalAmount Total amount paid externally (stored for record)
	 * @param _paymentReference External payment reference (e.g., Revolut order ID)
	 * @param _bookingURI IPFS URI containing booking metadata
	 */
	function createBookingPaid(
		string memory _propertyId,
		uint256 _checkInDate,
		uint256 _checkOutDate,
		uint256 _totalAmount,
		string memory _paymentReference,
		string memory _bookingURI
	) external returns (uint256) {
		// Verify property exists and is active
		(, , address host, , bool isActive, ) = propertyMarketplace.properties(_propertyId);

		require(isActive, "Property not active");
		require(host != address(0), "Property does not exist");

		// Verify dates
		require(_checkInDate > block.timestamp, "Check-in must be in the future");
		require(_checkOutDate > _checkInDate, "Check-out must be after check-in");

		// Check for booking conflicts
		require(!hasBookingConflict(_propertyId, _checkInDate, _checkOutDate), "Booking dates conflict with existing booking");

		// Calculate number of nights (for validation)
		uint256 numNights = (_checkOutDate - _checkInDate) / 1 days;
		require(numNights > 0, "Booking must be at least 1 night");

		// Calculate fees (for record keeping, actual payment handled off-chain)
		uint256 platformFee = (_totalAmount * propertyMarketplace.platformFeePercentage()) / 1000;
		uint256 hostAmount = _totalAmount - platformFee;

		// Create booking
		_bookingIdCounter++;
		uint256 bookingId = _bookingIdCounter;

		address guest = _msgSender();
		bookings[bookingId] = Booking({
			bookingId: bookingId,
			propertyId: _propertyId,
			guest: guest,
			host: host,
			checkInDate: _checkInDate,
			checkOutDate: _checkOutDate,
			totalAmount: _totalAmount,
			platformFee: platformFee,
			hostAmount: hostAmount,
			status: BookingStatus.Active,
			checkInWindowStart: 0,
			checkInDeadline: 0,
			disputeDeadline: 0,
			isCheckInComplete: false,
			isResolvedByHost: false,
			isResolvedByGuest: false,
			disputeReason: "",
			bookingURI: _bookingURI,
			paymentReference: _paymentReference,
			paidOffChain: true
		});

		// Add booking to property and guest mappings
		propertyBookings[_propertyId].push(bookingId);
		guestBookings[guest].push(bookingId);

		// Emit event
		emit BookingCreatedPaid(
			bookingId,
			_propertyId,
			guest,
			_checkInDate,
			_checkOutDate,
			_totalAmount,
			_paymentReference,
			_bookingURI
		);

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

		require(booking.host == _msgSender(), "Not the property owner");
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
	 * @dev Admin resolves escalated dispute with percentage split (owner only)
	 * @param _bookingId ID of the booking
	 * @param _guestPercentage Percentage (0-100) of hostAmount to refund to guest
	 *        0 = host gets all, 100 = guest gets full refund, 50 = split evenly
	 */
	function adminResolveDispute(uint256 _bookingId, uint256 _guestPercentage) external onlyOwner {
		Booking storage booking = bookings[_bookingId];
		require(booking.status == BookingStatus.EscalatedToAdmin, "Not escalated to admin");
		require(_guestPercentage <= 100, "Invalid percentage");

		// For off-chain payments, just update status (refunds handled externally)
		if (booking.paidOffChain) {
			booking.status = _guestPercentage == 100
				? BookingStatus.Refunded
				: BookingStatus.Completed;
			emit BookingCompleted(_bookingId);
			return;
		}

		// Calculate split of the hostAmount
		uint256 guestRefund = (booking.hostAmount * _guestPercentage) / 100;
		uint256 hostPayout = booking.hostAmount - guestRefund;

		// Execute EURC transfers
		if (guestRefund > 0) {
			eurcToken.safeTransfer(booking.guest, guestRefund);
		}
		if (hostPayout > 0) {
			eurcToken.safeTransfer(booking.host, hostPayout);
		}

		// Platform always gets the fee
		eurcToken.safeTransfer(treasury, booking.platformFee);

		// Update status based on outcome
		booking.status = _guestPercentage == 100
			? BookingStatus.Refunded
			: BookingStatus.Completed;

		emit BookingCompleted(_bookingId);
		if (guestRefund > 0) {
			emit BookingRefunded(_bookingId, guestRefund);
		}
	}
	
	/**
	 * @dev Complete a booking and pay the host in EURC
	 * @param _bookingId ID of the booking
	 */
	function _completeBooking(uint256 _bookingId) internal {
		Booking storage booking = bookings[_bookingId];

		// Update booking status
		booking.status = BookingStatus.Completed;

		// Skip EURC transfer for off-chain paid bookings (fiat via Revolut)
		if (booking.paidOffChain) {
			emit BookingCompleted(_bookingId);
			return;
		}

		// Transfer platform fee to treasury
		eurcToken.safeTransfer(treasury, booking.platformFee);

		// Transfer host amount to host
		eurcToken.safeTransfer(booking.host, booking.hostAmount);

		emit BookingCompleted(_bookingId);
	}
	
	/**
	 * @dev Refund a booking to the guest in EURC
	 * @param _bookingId ID of the booking
	 */
	function _refundBooking(uint256 _bookingId) internal {
		Booking storage booking = bookings[_bookingId];

		// Update booking status
		booking.status = BookingStatus.Refunded;

		// Skip EURC transfer for off-chain paid bookings (handled externally)
		if (booking.paidOffChain) {
			emit BookingRefunded(_bookingId, booking.hostAmount);
			return;
		}

		// Refund guest the host amount (platform fee is non-refundable)
		eurcToken.safeTransfer(booking.guest, booking.hostAmount);

		// Platform keeps the fee
		eurcToken.safeTransfer(treasury, booking.platformFee);

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

		// Skip EURC transfer for off-chain paid bookings
		if (booking.paidOffChain) {
			emit BookingCancelled(_bookingId);
			return;
		}

		// Refund guest (minus platform fee)
		eurcToken.safeTransfer(booking.guest, booking.hostAmount);

		// Platform keeps the fee
		eurcToken.safeTransfer(treasury, booking.platformFee);

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