import React, { useState, useEffect } from 'react';
import { useContracts } from 'context/ContractProvider';
import { useAccount } from 'wagmi';
import {
	parseBookingData,
	parsePropertyData,
	getBookingStatusLabel,
	getBookingStatusColor,
	formatDate,
	formatDateTime,
	formatPrice,
	isInCheckInWindow,
	isCheckInWindowExpired,
	isDisputeWindowExpired,
	getTimeRemaining,
	getUserRole,
	formatContractError,
} from 'library/helpers/contractHelpers';
import styled from 'styled-components';

const BookingManagementContainer = styled.div`
	max-width: 1200px;
	margin: 0 auto;
	padding: 20px;
`;

const PageTitle = styled.h1`
	color: #2c2c2c;
	font-size: 28px;
	font-weight: 700;
	margin-bottom: 30px;
	text-align: center;
`;

const BookingCard = styled.div`
	background: white;
	border-radius: 12px;
	padding: 24px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	margin-bottom: 20px;
	border-left: 4px solid ${props => props.statusColor};
`;

const BookingHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: 20px;
`;

const BookingInfo = styled.div`
	flex: 1;
`;

const BookingId = styled.h3`
	margin: 0 0 8px 0;
	color: #2c2c2c;
	font-size: 18px;
	font-weight: 600;
`;

const PropertyId = styled.p`
	margin: 0 0 8px 0;
	color: #666;
	font-size: 14px;
`;

const StatusBadge = styled.span`
	background: ${props => props.color};
	color: white;
	padding: 6px 12px;
	border-radius: 20px;
	font-size: 12px;
	font-weight: 600;
	text-transform: uppercase;
`;

const BookingDetails = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 20px;
	margin-bottom: 20px;
`;

const DetailItem = styled.div`
	display: flex;
	flex-direction: column;
`;

const DetailLabel = styled.span`
	color: #666;
	font-size: 12px;
	font-weight: 500;
	text-transform: uppercase;
	margin-bottom: 4px;
`;

const DetailValue = styled.span`
	color: #2c2c2c;
	font-size: 14px;
	font-weight: 500;
`;

const ActionButtons = styled.div`
	display: flex;
	gap: 12px;
	flex-wrap: wrap;
`;

const Button = styled.button`
	padding: 10px 16px;
	border: none;
	border-radius: 6px;
	font-size: 14px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	
	&:hover:not(:disabled) {
		transform: translateY(-1px);
	}
	
	&:disabled {
		background: #cccccc;
		cursor: not-allowed;
		transform: none;
	}
`;

const PrimaryButton = styled(Button)`
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	
	&:hover:not(:disabled) {
		background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
	}
`;

const SecondaryButton = styled(Button)`
	background: #f8f9fa;
	color: #2c2c2c;
	border: 1px solid #e9ecef;
	
	&:hover:not(:disabled) {
		background: #e9ecef;
	}
`;

const DangerButton = styled(Button)`
	background: #dc3545;
	color: white;
	
	&:hover:not(:disabled) {
		background: #c82333;
	}
`;

const LoadingSpinner = styled.div`
	display: inline-block;
	width: 14px;
	height: 14px;
	border: 2px solid #ffffff;
	border-radius: 50%;
	border-top-color: transparent;
	animation: spin 1s ease-in-out infinite;
	margin-right: 6px;
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
`;

const ErrorMessage = styled.div`
	color: #dc3545;
	font-size: 14px;
	margin-top: 8px;
`;

const SuccessMessage = styled.div`
	color: #28a745;
	font-size: 14px;
	margin-top: 8px;
`;

const TimeRemaining = styled.div`
	background: #fff3cd;
	border: 1px solid #ffeaa7;
	border-radius: 6px;
	padding: 12px;
	margin: 16px 0;
	color: #856404;
	font-size: 14px;
	font-weight: 500;
`;

const EmptyState = styled.div`
	text-align: center;
	padding: 60px 20px;
	color: #666;
`;

const EmptyStateTitle = styled.h3`
	margin: 0 0 12px 0;
	color: #2c2c2c;
	font-size: 20px;
	font-weight: 600;
`;

const EmptyStateText = styled.p`
	margin: 0;
	font-size: 16px;
`;

const BookingManagement = () => {
	const { address, isConnected } = useAccount();
	const {
		getGuestBookings,
		getBooking,
		getProperty,
		checkIn,
		cancelBooking,
		triggerCheckInWindow,
		processMissedCheckIn,
		hostResolveDispute,
		guestResolveDispute,
		escalateDispute,
		isWritePending,
		writeError,
	} = useContracts();

	const [bookings, setBookings] = useState([]);
	const [properties, setProperties] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [timeRemaining, setTimeRemaining] = useState({});

	// Load user's bookings
	useEffect(() => {
		if (!isConnected || !address) {
			setBookings([]);
			setLoading(false);
			return;
		}

		const loadBookings = async () => {
			try {
				setLoading(true);
				setError('');

				// Get booking IDs
				const bookingIds = await getGuestBookings(address);
				
				if (!bookingIds || bookingIds.length === 0) {
					setBookings([]);
					setLoading(false);
					return;
				}

				// Get booking details
				const bookingPromises = bookingIds.map(async (bookingId) => {
					try {
						const bookingData = await getBooking(bookingId);
						console.log(`Raw booking data for ${bookingId}:`, bookingData);
						const parsedBooking = parseBookingData(bookingData);
						console.log(`Parsed booking for ${bookingId}:`, parsedBooking);
						return parsedBooking;
					} catch (error) {
						console.error(`Error loading booking ${bookingId}:`, error);
						return null;
					}
				});

				const bookingResults = await Promise.all(bookingPromises);
				const validBookings = bookingResults.filter(booking => booking !== null);

				// Get property details for each booking
				const propertyPromises = validBookings.map(async (booking) => {
					try {
						const propertyData = await getProperty(booking.propertyId);
						console.log(`Raw property data for ${booking.propertyId}:`, propertyData);
						const parsedProperty = parsePropertyData(propertyData);
						console.log(`Parsed property for ${booking.propertyId}:`, parsedProperty);
						return { propertyId: booking.propertyId, data: parsedProperty };
					} catch (error) {
						console.error(`Error loading property ${booking.propertyId}:`, error);
						return { propertyId: booking.propertyId, data: null };
					}
				});

				const propertyResults = await Promise.all(propertyPromises);
				const propertyMap = {};
				propertyResults.forEach(({ propertyId, data }) => {
					propertyMap[propertyId] = data;
				});

				setBookings(validBookings);
				setProperties(propertyMap);
			} catch (error) {
				console.error('Error loading bookings:', error);
				setError('Failed to load bookings');
			} finally {
				setLoading(false);
			}
		};

		loadBookings();
	}, [isConnected, address, getGuestBookings, getBooking, getProperty]);

	// Update time remaining for active bookings
	useEffect(() => {
		const interval = setInterval(() => {
			const newTimeRemaining = {};
			bookings.forEach(booking => {
				if (booking.status === 1 && booking.checkInDeadline) { // CheckInReady
					newTimeRemaining[booking.bookingId] = getTimeRemaining(booking.checkInDeadline);
				} else if (booking.status === 4 && booking.disputeDeadline) { // Disputed
					newTimeRemaining[booking.bookingId] = getTimeRemaining(booking.disputeDeadline);
				}
			});
			setTimeRemaining(newTimeRemaining);
		}, 1000);

		return () => clearInterval(interval);
	}, [bookings]);

	// Handle booking actions
	const handleAction = async (action, bookingId) => {
		try {
			setError('');
			setSuccessMessage('');

			let result;
			switch (action) {
				case 'checkIn':
					result = await checkIn(bookingId);
					break;
				case 'cancel':
					result = await cancelBooking(bookingId);
					break;
				case 'triggerCheckIn':
					result = await triggerCheckInWindow(bookingId);
					break;
				case 'processMissedCheckIn':
					result = await processMissedCheckIn(bookingId);
					break;
				case 'hostResolve':
					result = await hostResolveDispute(bookingId);
					break;
				case 'guestResolve':
					result = await guestResolveDispute(bookingId);
					break;
				case 'escalate':
					result = await escalateDispute(bookingId);
					break;
				default:
					throw new Error('Unknown action');
			}

			if (result) {
				setSuccessMessage(`Action completed successfully! Transaction: ${result}`);
				// Reload bookings after action
				setTimeout(() => {
					window.location.reload();
				}, 2000);
			}
		} catch (error) {
			console.error(`Error performing ${action}:`, error);
			setError(formatContractError(error));
		}
	};

	// Get available actions for a booking
	const getAvailableActions = (booking, property) => {
		const actions = [];
		const userRole = getUserRole(booking, property, address);

		if (userRole === 'guest') {
			// Guest actions
			if (booking.status === 0) { // Active
				actions.push({
					label: 'Cancel Booking',
					action: 'cancel',
					button: DangerButton,
					disabled: false,
				});
			}

			if (booking.status === 1) { // CheckInReady
				if (isInCheckInWindow(booking)) {
					actions.push({
						label: 'Check In',
						action: 'checkIn',
						button: PrimaryButton,
						disabled: isWritePending,
					});
				}
			}

			if (booking.status === 4) { // Disputed
				if (!isDisputeWindowExpired(booking)) {
					actions.push({
						label: 'Resolve Dispute',
						action: 'guestResolve',
						button: SecondaryButton,
						disabled: isWritePending,
					});
				} else {
					actions.push({
						label: 'Escalate to Admin',
						action: 'escalate',
						button: SecondaryButton,
						disabled: isWritePending,
					});
				}
			}
		}

		if (userRole === 'host') {
			// Host actions
			if (booking.status === 0) { // Active
				actions.push({
					label: 'Trigger Check-in Window',
					action: 'triggerCheckIn',
					button: SecondaryButton,
					disabled: isWritePending,
				});
			}

			if (booking.status === 1 && isCheckInWindowExpired(booking)) { // CheckInReady expired
				actions.push({
					label: 'Process Missed Check-in',
					action: 'processMissedCheckIn',
					button: SecondaryButton,
					disabled: isWritePending,
				});
			}

			if (booking.status === 4) { // Disputed
				if (!isDisputeWindowExpired(booking)) {
					actions.push({
						label: 'Resolve Dispute',
						action: 'hostResolve',
						button: SecondaryButton,
						disabled: isWritePending,
					});
				}
			}
		}

		return actions;
	};

	if (!isConnected) {
		return (
			<BookingManagementContainer>
				<EmptyState>
					<EmptyStateTitle>Connect Your Wallet</EmptyStateTitle>
					<EmptyStateText>Please connect your wallet to view your bookings.</EmptyStateText>
				</EmptyState>
			</BookingManagementContainer>
		);
	}

	if (loading) {
		return (
			<BookingManagementContainer>
				<EmptyState>
					<EmptyStateTitle>Loading...</EmptyStateTitle>
					<EmptyStateText>Please wait while we load your bookings.</EmptyStateText>
				</EmptyState>
			</BookingManagementContainer>
		);
	}

	return (
		<BookingManagementContainer>
			<PageTitle>My Bookings</PageTitle>

			{error && <ErrorMessage>{error}</ErrorMessage>}
			{successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}
			{writeError && <ErrorMessage>{formatContractError(writeError)}</ErrorMessage>}

			{bookings.length === 0 ? (
				<EmptyState>
					<EmptyStateTitle>No Bookings Found</EmptyStateTitle>
					<EmptyStateText>You haven't made any bookings yet.</EmptyStateText>
				</EmptyState>
			) : (
				bookings.map((booking) => {
					const property = properties[booking.propertyId];
					const actions = getAvailableActions(booking, property);
					const statusColor = getBookingStatusColor(booking.status);
					const timeRemainingData = timeRemaining[booking.bookingId];

					return (
						<BookingCard key={booking.bookingId} statusColor={statusColor}>
							<BookingHeader>
								<BookingInfo>
									<BookingId>Booking #{booking.bookingId}</BookingId>
									<PropertyId>Property: {booking.propertyId}</PropertyId>
									{property && property.owner && (
										<PropertyId>Owner: {property.owner.slice(0, 6)}...{property.owner.slice(-4)}</PropertyId>
									)}
								</BookingInfo>
								<StatusBadge color={statusColor}>
									{getBookingStatusLabel(booking.status)}
								</StatusBadge>
							</BookingHeader>

							<BookingDetails>
								<DetailItem>
									<DetailLabel>Check-in Date</DetailLabel>
									<DetailValue>{booking.checkInDate ? formatDate(booking.checkInDate) : 'Invalid Date'}</DetailValue>
								</DetailItem>
								<DetailItem>
									<DetailLabel>Check-out Date</DetailLabel>
									<DetailValue>{booking.checkOutDate ? formatDate(booking.checkOutDate) : 'Invalid Date'}</DetailValue>
								</DetailItem>
								<DetailItem>
									<DetailLabel>Total Amount</DetailLabel>
									<DetailValue>{booking.totalAmount ? formatPrice(booking.totalAmount) : 'Invalid Amount'}</DetailValue>
								</DetailItem>
								<DetailItem>
									<DetailLabel>Guest</DetailLabel>
									<DetailValue>{booking.guest ? `${booking.guest.slice(0, 6)}...${booking.guest.slice(-4)}` : 'Unknown'}</DetailValue>
								</DetailItem>
								{property && property.pricePerNight && (
									<DetailItem>
										<DetailLabel>Price per Night</DetailLabel>
										<DetailValue>{formatPrice(property.pricePerNight)}</DetailValue>
									</DetailItem>
								)}
								{booking.checkInDeadline > 0 && (
									<DetailItem>
										<DetailLabel>Check-in Deadline</DetailLabel>
										<DetailValue>{formatDateTime(booking.checkInDeadline)}</DetailValue>
									</DetailItem>
								)}
								{booking.disputeDeadline > 0 && (
									<DetailItem>
										<DetailLabel>Dispute Deadline</DetailLabel>
										<DetailValue>{formatDateTime(booking.disputeDeadline)}</DetailValue>
									</DetailItem>
								)}
							</BookingDetails>

							{timeRemainingData && !timeRemainingData.expired && (
								<TimeRemaining>
									⏰ Time remaining: {timeRemainingData.formatted}
								</TimeRemaining>
							)}

							{actions.length > 0 && (
								<ActionButtons>
									{actions.map((action, index) => {
										const ButtonComponent = action.button;
										return (
											<ButtonComponent
												key={index}
												onClick={() => handleAction(action.action, booking.bookingId)}
												disabled={action.disabled}
											>
												{action.disabled && <LoadingSpinner />}
												{action.label}
											</ButtonComponent>
										);
									})}
								</ActionButtons>
							)}
						</BookingCard>
					);
				})
			)}
		</BookingManagementContainer>
	);
};

export default BookingManagement; 