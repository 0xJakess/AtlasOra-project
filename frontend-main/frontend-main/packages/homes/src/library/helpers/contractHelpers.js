// Booking status enum from smart contract
export const BookingStatus = {
	Active: 0,
	CheckInReady: 1,
	CheckedIn: 2,
	Completed: 3,
	Disputed: 4,
	Cancelled: 5,
	Refunded: 6,
	EscalatedToAdmin: 7,
};

// Booking status labels
export const BookingStatusLabels = {
	[BookingStatus.Active]: 'Active',
	[BookingStatus.CheckInReady]: 'Ready for Check-in',
	[BookingStatus.CheckedIn]: 'Checked In',
	[BookingStatus.Completed]: 'Completed',
	[BookingStatus.Disputed]: 'Disputed',
	[BookingStatus.Cancelled]: 'Cancelled',
	[BookingStatus.Refunded]: 'Refunded',
	[BookingStatus.EscalatedToAdmin]: 'Escalated to Admin',
};

// Booking status colors for UI
export const BookingStatusColors = {
	[BookingStatus.Active]: '#4CAF50',
	[BookingStatus.CheckInReady]: '#FF9800',
	[BookingStatus.CheckedIn]: '#2196F3',
	[BookingStatus.Completed]: '#4CAF50',
	[BookingStatus.Disputed]: '#F44336',
	[BookingStatus.Cancelled]: '#9E9E9E',
	[BookingStatus.Refunded]: '#FF5722',
	[BookingStatus.EscalatedToAdmin]: '#9C27B0',
};

// Convert Unix timestamp to Date object
export const timestampToDate = (timestamp) => {
	return new Date(Number(timestamp) * 1000);
};

// Convert Date object to Unix timestamp
export const dateToTimestamp = (date) => {
	return Math.floor(date.getTime() / 1000);
};

// Format date for display
export const formatDate = (date) => {
	if (typeof date === 'number') {
		date = timestampToDate(date);
	} else if (typeof date === 'string') {
		// If it's a numeric string, treat as unix seconds
		const maybeNum = Number(date);
		if (!Number.isNaN(maybeNum)) {
			date = timestampToDate(maybeNum);
		} else {
			// Try parse as ISO/date string
			date = new Date(date);
		}
	}
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

// Format date and time for display
export const formatDateTime = (date) => {
	if (typeof date === 'number') {
		date = timestampToDate(date);
	} else if (typeof date === 'string') {
		const maybeNum = Number(date);
		if (!Number.isNaN(maybeNum)) {
			date = timestampToDate(maybeNum);
		} else {
			date = new Date(date);
		}
	}
	return date.toLocaleString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

// Calculate number of nights between two dates
export const calculateNights = (checkInDate, checkOutDate) => {
	const checkIn = typeof checkInDate === 'number' ? timestampToDate(checkInDate) : checkInDate;
	const checkOut = typeof checkOutDate === 'number' ? timestampToDate(checkOutDate) : checkOutDate;
	const diffTime = checkOut.getTime() - checkIn.getTime();
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Convert Wei to Ether
export const weiToEther = (wei) => {
	return Number(wei) / Math.pow(10, 18);
};

// Convert Ether to Wei
export const etherToWei = (ether) => {
	return BigInt(Math.floor(ether * Math.pow(10, 18)));
};

// Format price in ETH
export const formatPrice = (priceInWei) => {
	const priceInEth = weiToEther(priceInWei);
	return `${priceInEth.toFixed(4)} ETH`;
};

// Calculate total booking price
export const calculateTotalPrice = (pricePerNight, checkInDate, checkOutDate) => {
	const nights = calculateNights(checkInDate, checkOutDate);
	return BigInt(pricePerNight) * BigInt(nights);
};

// Check if a booking is in check-in window
export const isInCheckInWindow = (booking) => {
	if (!booking || booking.status !== BookingStatus.CheckInReady) {
		return false;
	}
	
	const now = Math.floor(Date.now() / 1000);
	return now >= booking.checkInWindowStart && now <= booking.checkInDeadline;
};

// Check if check-in window has expired
export const isCheckInWindowExpired = (booking) => {
	if (!booking || booking.status !== BookingStatus.CheckInReady) {
		return false;
	}
	
	const now = Math.floor(Date.now() / 1000);
	return now > booking.checkInDeadline;
};

// Check if dispute resolution window has expired
export const isDisputeWindowExpired = (booking) => {
	if (!booking || booking.status !== BookingStatus.Disputed) {
		return false;
	}
	
	const now = Math.floor(Date.now() / 1000);
	return now > booking.disputeDeadline;
};

// Get booking status label
export const getBookingStatusLabel = (status) => {
	return BookingStatusLabels[status] || 'Unknown';
};

// Get booking status color
export const getBookingStatusColor = (status) => {
	return BookingStatusColors[status] || '#9E9E9E';
};

// Validate booking dates
export const validateBookingDates = (checkInDate, checkOutDate) => {
	const now = Math.floor(Date.now() / 1000);
	
	if (checkInDate <= now) {
		return { isValid: false, error: 'Check-in date must be in the future' };
	}
	
	if (checkOutDate <= checkInDate) {
		return { isValid: false, error: 'Check-out date must be after check-in date' };
	}
	
	const nights = calculateNights(checkInDate, checkOutDate);
	if (nights < 1) {
		return { isValid: false, error: 'Booking must be at least 1 night' };
	}
	
	return { isValid: true };
};

// Parse booking data from contract
export const parseBookingData = (bookingData) => {
	if (!bookingData) return null;
	
	// Handle case where data might be returned as an array/tuple from the contract
	if (Array.isArray(bookingData)) {
		return {
			bookingId: Number(bookingData[0]),
			propertyId: bookingData[1],
			guest: bookingData[2],
			checkInDate: Number(bookingData[3]),
			checkOutDate: Number(bookingData[4]),
			totalAmount: bookingData[5],
			platformFee: bookingData[6],
			hostAmount: bookingData[7],
			status: Number(bookingData[8]),
			checkInWindowStart: Number(bookingData[9]),
			checkInDeadline: Number(bookingData[10]),
			disputeDeadline: Number(bookingData[11]),
			isCheckInComplete: bookingData[12],
			isResolvedByHost: bookingData[13],
			isResolvedByGuest: bookingData[14],
			disputeReason: bookingData[15],
		};
	}
	
	// Handle case where data is returned as an object
	return {
		bookingId: Number(bookingData.bookingId),
		propertyId: bookingData.propertyId,
		guest: bookingData.guest,
		checkInDate: Number(bookingData.checkInDate),
		checkOutDate: Number(bookingData.checkOutDate),
		totalAmount: bookingData.totalAmount,
		platformFee: bookingData.platformFee,
		hostAmount: bookingData.hostAmount,
		status: Number(bookingData.status),
		checkInWindowStart: Number(bookingData.checkInWindowStart),
		checkInDeadline: Number(bookingData.checkInDeadline),
		disputeDeadline: Number(bookingData.disputeDeadline),
		isCheckInComplete: bookingData.isCheckInComplete,
		isResolvedByHost: bookingData.isResolvedByHost,
		isResolvedByGuest: bookingData.isResolvedByGuest,
		disputeReason: bookingData.disputeReason,
	};
};

// Parse property data from contract
export const parsePropertyData = (propertyData) => {
	if (!propertyData) return null;
	
	// Handle case where data might be returned as an array/tuple from the contract
	if (Array.isArray(propertyData)) {
		return {
			propertyId: propertyData[0],
			propertyTokenAddress: propertyData[1],
			owner: propertyData[2],
			pricePerNight: propertyData[3],
			isActive: propertyData[4],
			propertyURI: propertyData[5],
		};
	}
	
	// Handle case where data is returned as an object
	return {
		propertyId: propertyData.propertyId,
		propertyTokenAddress: propertyData.propertyTokenAddress,
		owner: propertyData.owner,
		pricePerNight: propertyData.pricePerNight,
		isActive: propertyData.isActive,
		propertyURI: propertyData.propertyURI,
	};
};

// Generate unique property ID
export const generatePropertyId = () => {
	return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Validate property data
export const validatePropertyData = (propertyData) => {
	const errors = [];
	
	if (!propertyData.propertyURI || propertyData.propertyURI.trim() === '') {
		errors.push('Property URI is required');
	}
	
	if (!propertyData.pricePerNight || Number(propertyData.pricePerNight) <= 0) {
		errors.push('Price per night must be greater than 0');
	}
	
	if (!propertyData.tokenName || propertyData.tokenName.trim() === '') {
		errors.push('Token name is required');
	}
	
	if (!propertyData.tokenSymbol || propertyData.tokenSymbol.trim() === '') {
		errors.push('Token symbol is required');
	}
	
	return {
		isValid: errors.length === 0,
		errors,
	};
};

// Get time remaining until deadline
export const getTimeRemaining = (deadline) => {
	const now = Math.floor(Date.now() / 1000);
	const remaining = deadline - now;
	
	if (remaining <= 0) {
		return { expired: true, timeRemaining: 0 };
	}
	
	const hours = Math.floor(remaining / 3600);
	const minutes = Math.floor((remaining % 3600) / 60);
	const seconds = remaining % 60;
	
	return {
		expired: false,
		timeRemaining: remaining,
		hours,
		minutes,
		seconds,
		formatted: `${hours}h ${minutes}m ${seconds}s`,
	};
};

// Check if user is the property owner
export const isPropertyOwner = (property, userAddress) => {
	return property && property.owner && property.owner.toLowerCase() === userAddress?.toLowerCase();
};

// Check if user is the booking guest
export const isBookingGuest = (booking, userAddress) => {
	return booking && booking.guest && booking.guest.toLowerCase() === userAddress?.toLowerCase();
};

// Get user role for a booking
export const getUserRole = (booking, property, userAddress) => {
	if (!userAddress) return 'none';
	
	if (isBookingGuest(booking, userAddress)) {
		return 'guest';
	}
	
	if (isPropertyOwner(property, userAddress)) {
		return 'host';
	}
	
	return 'none';
};

// Format error message from contract
export const formatContractError = (error) => {
	if (!error) return 'Unknown error occurred';
	
	// Handle common contract errors
	const errorMessage = error.message || error.toString();
	
	if (errorMessage.includes('insufficient funds')) {
		return 'Insufficient funds for transaction';
	}
	
	if (errorMessage.includes('user rejected')) {
		return 'Transaction was rejected by user';
	}
	
	if (errorMessage.includes('execution reverted')) {
		// Extract custom error message if available
		const match = errorMessage.match(/execution reverted: (.+)/);
		if (match) {
			return match[1];
		}
		return 'Transaction failed - check your input and try again';
	}
	
	return errorMessage;
}; 