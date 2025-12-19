import React, { useState, useEffect } from 'react';
import { useContracts } from 'context/ContractProvider';
import { useAccount } from 'wagmi';
import {
	validateBookingDates,
	calculateTotalPrice,
	formatPrice,
	dateToTimestamp,
	formatContractError,
} from 'library/helpers/contractHelpers';
import styled from 'styled-components';

const BookingFormContainer = styled.div`
	background: white;
	border-radius: 12px;
	padding: 24px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	margin-bottom: 20px;
`;

const FormTitle = styled.h3`
	margin: 0 0 20px 0;
	color: #2c2c2c;
	font-size: 18px;
	font-weight: 600;
`;

const FormGroup = styled.div`
	margin-bottom: 20px;
`;

const Label = styled.label`
	display: block;
	margin-bottom: 8px;
	color: #2c2c2c;
	font-weight: 500;
	font-size: 14px;
`;

const Input = styled.input`
	width: 100%;
	padding: 12px;
	border: 1px solid #e0e0e0;
	border-radius: 6px;
	font-size: 14px;
	transition: border-color 0.3s ease;
	
	&:focus {
		outline: none;
		border-color: #667eea;
	}
	
	&:disabled {
		background-color: #f5f5f5;
		cursor: not-allowed;
	}
`;

const DateInput = styled(Input)`
	&::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}
`;

const PriceDisplay = styled.div`
	background: #f8f9fa;
	border: 1px solid #e9ecef;
	border-radius: 6px;
	padding: 16px;
	margin: 16px 0;
`;

const PriceRow = styled.div`
	display: flex;
	justify-content: space-between;
	margin-bottom: 8px;
	
	&:last-child {
		margin-bottom: 0;
		border-top: 1px solid #e9ecef;
		padding-top: 8px;
		font-weight: 600;
		font-size: 16px;
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

const Button = styled.button`
	width: 100%;
	padding: 14px;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	border: none;
	border-radius: 6px;
	font-size: 16px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	
	&:hover:not(:disabled) {
		background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
		transform: translateY(-1px);
	}
	
	&:disabled {
		background: #cccccc;
		cursor: not-allowed;
		transform: none;
	}
`;

const LoadingSpinner = styled.div`
	display: inline-block;
	width: 16px;
	height: 16px;
	border: 2px solid #ffffff;
	border-radius: 50%;
	border-top-color: transparent;
	animation: spin 1s ease-in-out infinite;
	margin-right: 8px;
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
`;

const BookingForm = ({ property, onBookingCreated }) => {
	const { address, isConnected } = useAccount();
	const {
		createBooking,
		hasBookingConflict,
		isWritePending,
		writeError,
		transactionReceipt,
	} = useContracts();

	const [formData, setFormData] = useState({
		checkInDate: '',
		checkOutDate: '',
	});
	
	const [validation, setValidation] = useState({
		isValid: false,
		error: '',
	});
	
	const [bookingConflict, setBookingConflict] = useState(false);
	const [totalPrice, setTotalPrice] = useState(0);
	const [isCheckingConflict, setIsCheckingConflict] = useState(false);
	const [successMessage, setSuccessMessage] = useState('');

	// Reset form when property changes
	useEffect(() => {
		setFormData({ checkInDate: '', checkOutDate: '' });
		setValidation({ isValid: false, error: '' });
		setBookingConflict(false);
		setTotalPrice(0);
		setSuccessMessage('');
	}, [property]);

	// Validate dates and check for conflicts
	useEffect(() => {
		if (!formData.checkInDate || !formData.checkOutDate || !property) {
			setValidation({ isValid: false, error: '' });
			setBookingConflict(false);
			setTotalPrice(0);
			return;
		}

		const checkInTimestamp = dateToTimestamp(new Date(formData.checkInDate));
		const checkOutTimestamp = dateToTimestamp(new Date(formData.checkOutDate));

		// Validate dates
		const dateValidation = validateBookingDates(checkInTimestamp, checkOutTimestamp);
		if (!dateValidation.isValid) {
			setValidation({ isValid: false, error: dateValidation.error });
			setBookingConflict(false);
			setTotalPrice(0);
			return;
		}

		// Calculate total price
		const price = calculateTotalPrice(property.pricePerNight, checkInTimestamp, checkOutTimestamp);
		setTotalPrice(price);

		// Check for booking conflicts
		const checkConflict = async () => {
			setIsCheckingConflict(true);
			try {
				const hasConflict = await hasBookingConflict(property.propertyId, checkInTimestamp, checkOutTimestamp);
				setBookingConflict(hasConflict);
				setValidation({
					isValid: !hasConflict,
					error: hasConflict ? 'These dates conflict with an existing booking' : '',
				});
			} catch (error) {
				console.error('Error checking booking conflict:', error);
				setValidation({ isValid: false, error: 'Error checking availability' });
			} finally {
				setIsCheckingConflict(false);
			}
		};

		checkConflict();
	}, [formData.checkInDate, formData.checkOutDate, property, hasBookingConflict]);

	// Handle form submission
	const handleSubmit = async (e) => {
		e.preventDefault();
		
		if (!isConnected) {
			setValidation({ isValid: false, error: 'Please connect your wallet first' });
			return;
		}

		if (!validation.isValid) {
			return;
		}

		const checkInTimestamp = dateToTimestamp(new Date(formData.checkInDate));
		const checkOutTimestamp = dateToTimestamp(new Date(formData.checkOutDate));

		try {
			const result = await createBooking(
				property.propertyId,
				checkInTimestamp,
				checkOutTimestamp,
				totalPrice
			);

			if (result) {
				setSuccessMessage('Booking created successfully! Transaction hash: ' + result);
				setFormData({ checkInDate: '', checkOutDate: '' });
				setValidation({ isValid: false, error: '' });
				setTotalPrice(0);
				
				// Call callback if provided
				if (onBookingCreated) {
					onBookingCreated(result);
				}
			}
		} catch (error) {
			console.error('Error creating booking:', error);
			setValidation({
				isValid: false,
				error: formatContractError(error),
			});
		}
	};

	// Handle input changes
	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData(prev => ({
			...prev,
			[name]: value,
		}));
		setSuccessMessage('');
	};

	// Calculate platform fee (3%)
	const platformFee = totalPrice ? (totalPrice * BigInt(30)) / BigInt(1000) : BigInt(0);
	const hostAmount = totalPrice ? totalPrice - platformFee : BigInt(0);

	if (!property) {
		return (
			<BookingFormContainer>
				<FormTitle>Booking Form</FormTitle>
				<p>Please select a property to book.</p>
			</BookingFormContainer>
		);
	}

	return (
		<BookingFormContainer>
			<FormTitle>Book This Property</FormTitle>
			
			<form onSubmit={handleSubmit}>
				<FormGroup>
					<Label htmlFor="checkInDate">Check-in Date</Label>
					<DateInput
						type="date"
						id="checkInDate"
						name="checkInDate"
						value={formData.checkInDate}
						onChange={handleInputChange}
						min={new Date().toISOString().split('T')[0]}
						required
					/>
				</FormGroup>

				<FormGroup>
					<Label htmlFor="checkOutDate">Check-out Date</Label>
					<DateInput
						type="date"
						id="checkOutDate"
						name="checkOutDate"
						value={formData.checkOutDate}
						onChange={handleInputChange}
						min={formData.checkInDate || new Date().toISOString().split('T')[0]}
						required
					/>
				</FormGroup>

				{totalPrice > 0 && (
					<PriceDisplay>
						<PriceRow>
							<span>Price per night:</span>
							<span>{formatPrice(property.pricePerNight)}</span>
						</PriceRow>
						<PriceRow>
							<span>Number of nights:</span>
							<span>
								{formData.checkInDate && formData.checkOutDate
									? Math.ceil((new Date(formData.checkOutDate) - new Date(formData.checkInDate)) / (1000 * 60 * 60 * 24))
									: 0}
							</span>
						</PriceRow>
						<PriceRow>
							<span>Platform fee (3%):</span>
							<span>{formatPrice(platformFee)}</span>
						</PriceRow>
						<PriceRow>
							<span>Total:</span>
							<span>{formatPrice(totalPrice)}</span>
						</PriceRow>
					</PriceDisplay>
				)}

				{validation.error && (
					<ErrorMessage>{validation.error}</ErrorMessage>
				)}

				{successMessage && (
					<SuccessMessage>{successMessage}</SuccessMessage>
				)}

				{writeError && (
					<ErrorMessage>{formatContractError(writeError)}</ErrorMessage>
				)}

				<Button
					type="submit"
					disabled={
						!isConnected ||
						!validation.isValid ||
						isWritePending ||
						isCheckingConflict ||
						bookingConflict
					}
				>
					{isWritePending && <LoadingSpinner />}
					{isWritePending
						? 'Creating Booking...'
						: !isConnected
						? 'Connect Wallet to Book'
						: bookingConflict
						? 'Dates Not Available'
						: 'Book Now'}
				</Button>
			</form>

			{transactionReceipt && (
				<SuccessMessage style={{ marginTop: '16px' }}>
					Transaction confirmed! Block: {transactionReceipt.blockNumber}
				</SuccessMessage>
			)}
		</BookingFormContainer>
	);
};

export default BookingForm; 