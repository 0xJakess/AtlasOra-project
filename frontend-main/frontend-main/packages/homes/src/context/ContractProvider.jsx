import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';

// Define Base Sepolia chain (Primary)
const baseSepolia = {
	id: 84532,
	name: 'Base Sepolia',
	nativeCurrency: {
		decimals: 18,
		name: 'Ethereum',
		symbol: 'ETH',
	},
	rpcUrls: {
		default: { http: ['https://sepolia.base.org'] },
		public: { http: ['https://sepolia.base.org'] },
	},
	blockExplorers: {
		default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
	},
	testnet: true,
};

// Import contract ABIs
import BookingManagerABI from '../abis/BookingManager.sol/BookingManager.json';
import PropertyMarketplaceABI from '../abis/PropertyMarketplace.sol/PropertyMarketplace.json';
import PropertyTokenABI from '../abis/PropertyToken.sol/PropertyToken.json';

// Contract addresses defaults (env) - Base Sepolia
const DEFAULT_ADDRESSES = {
	baseSepolia: {
		bookingManager: import.meta.env.VITE_BOOKING_MANAGER_ADDRESS || '0xD29898532bD0dEDE57129B2e29728e2BB27C5f9e',
		propertyMarketplace: import.meta.env.VITE_PROPERTY_MARKETPLACE_ADDRESS || '0x4a98B0c7AD421008d8bFd60Eb8b02698c1fFf23b',
		forwarder: import.meta.env.VITE_FORWARDER_ADDRESS || '0xC2625a5ddBEe6023634bCaD0615aecFA5552D9e7',
	},
};

// Create context
const ContractContext = createContext();

export const useContracts = () => {
	const context = useContext(ContractContext);
	if (!context) {
		throw new Error('useContracts must be used within a ContractProvider');
	}
	return context;
};

// Contract Provider Component
export const ContractProvider = ({ children }) => {
	const { address, isConnected } = useAccount();
	const publicClient = usePublicClient();
	const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3000';
	const [addr, setAddr] = useState(DEFAULT_ADDRESSES);

	// Fetch addresses from backend /health to ensure frontend matches backend deployments
	useEffect(() => {
		(async () => {
			try {
				const res = await fetch(`${backendBaseUrl}/health`);
				if (!res.ok) return; // keep defaults
				const json = await res.json();
				const c = json?.contracts || {};
				if (c.PropertyMarketplace && c.BookingManager) {
					setAddr({
						baseSepolia: {
							bookingManager: c.BookingManager,
							propertyMarketplace: c.PropertyMarketplace,
							forwarder: c.MetaTransactionForwarder || DEFAULT_ADDRESSES.baseSepolia.forwarder,
						},
					});
				}
			} catch (_) {
				// ignore; fallback to defaults
			}
		})();
	}, [backendBaseUrl]);

	// Contract configurations
	const contracts = useMemo(() => ({
		bookingManager: {
			address: addr.baseSepolia.bookingManager,
			abi: BookingManagerABI.abi,
		},
		propertyMarketplace: {
			address: addr.baseSepolia.propertyMarketplace,
			abi: PropertyMarketplaceABI.abi,
		},
	}), [addr]);

	// Booking Manager Functions
	const {
		data: bookingManagerData,
		isLoading: bookingManagerLoading,
		error: bookingManagerError,
		refetch: refetchBookingManager,
	} = useReadContract({
		...contracts.bookingManager,
		functionName: 'CHECK_IN_WINDOW',
		query: {
			enabled: isConnected,
		},
	});

	// Property Marketplace Functions
	const {
		data: propertyMarketplaceData,
		isLoading: propertyMarketplaceLoading,
		error: propertyMarketplaceError,
		refetch: refetchPropertyMarketplace,
	} = useReadContract({
		...contracts.propertyMarketplace,
		functionName: 'getActivePropertyIds',
		query: {
			enabled: isConnected,
		},
	});

	// Write contract hooks
	const { writeContract, writeContractAsync, isPending: isWritePending, error: writeError } = useWriteContract();

	// Transaction receipt hooks
	const { data: transactionReceipt, isLoading: isTransactionLoading } = useWaitForTransactionReceipt();

	// Booking Manager Write Functions
	const createBooking = async (propertyId, checkInDate, checkOutDate, value) => {
		try {
			console.debug('[createBooking] start', {
				contract: contracts.bookingManager.address,
				propertyId,
				checkInDate,
				checkOutDate,
				value: typeof value === 'bigint' ? value.toString() : value,
			});
			// Optional: simulate to catch clear revert reasons before sending
			try {
				await publicClient.simulateContract({
					...contracts.bookingManager,
					functionName: 'createBooking',
					args: [propertyId, checkInDate, checkOutDate],
					value,
					account: address,
				});
				console.debug('[createBooking] simulation ok');
			} catch (simErr) {
				console.error('[createBooking] simulation failed', simErr);
				throw simErr;
			}
			const hash = await writeContractAsync({
				...contracts.bookingManager,
				functionName: 'createBooking',
				args: [propertyId, checkInDate, checkOutDate],
				value: value,
			});
			console.debug('[createBooking] tx sent hash', hash);
			return hash;
		} catch (error) {
			console.error('Error creating booking:', error);
			const short = error?.shortMessage || error?.message || 'Transaction failed';
			throw new Error(short);
		}
	};

	const checkIn = async (bookingId) => {
		try {
			const result = await writeContract({
				...contracts.bookingManager,
				functionName: 'checkIn',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error checking in:', error);
			throw error;
		}
	};

	const cancelBooking = async (bookingId) => {
		try {
			const result = await writeContract({
				...contracts.bookingManager,
				functionName: 'cancelBooking',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error cancelling booking:', error);
			throw error;
		}
	};

	const triggerCheckInWindow = async (bookingId) => {
		try {
			const result = await writeContract({
				...contracts.bookingManager,
				functionName: 'triggerCheckInWindow',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error triggering check-in window:', error);
			throw error;
		}
	};

	const processMissedCheckIn = async (bookingId) => {
		try {
			const result = await writeContract({
				...contracts.bookingManager,
				functionName: 'processMissedCheckIn',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error processing missed check-in:', error);
			throw error;
		}
	};

	const hostResolveDispute = async (bookingId) => {
		try {
			const result = await writeContract({
				...contracts.bookingManager,
				functionName: 'hostResolveDispute',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error resolving dispute as host:', error);
			throw error;
		}
	};

	const guestResolveDispute = async (bookingId) => {
		try {
			const result = await writeContract({
				...contracts.bookingManager,
				functionName: 'guestResolveDispute',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error resolving dispute as guest:', error);
			throw error;
		}
	};

	const escalateDispute = async (bookingId) => {
		try {
			const result = await writeContract({
				...contracts.bookingManager,
				functionName: 'escalateDispute',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error escalating dispute:', error);
			throw error;
		}
	};

	// Property Marketplace Write Functions
	// Note: listProperty removed - properties are now created via CMS and synced to blockchain

	const updateProperty = async (propertyId, pricePerNight, isActive) => {
		try {
			const result = await writeContract({
				...contracts.propertyMarketplace,
				functionName: 'updateProperty',
				args: [propertyId, pricePerNight, isActive],
			});
			return result;
		} catch (error) {
			console.error('Error updating property:', error);
			throw error;
		}
	};

	const removeProperty = async (propertyId) => {
		try {
			const result = await writeContract({
				...contracts.propertyMarketplace,
				functionName: 'removeProperty',
				args: [propertyId],
			});
			return result;
		} catch (error) {
			console.error('Error removing property:', error);
			throw error;
		}
	};

	// Read Functions
	const getBooking = async (bookingId) => {
		try {
			const result = await publicClient.readContract({
				...contracts.bookingManager,
				functionName: 'bookings',
				args: [bookingId],
			});
			return result;
		} catch (error) {
			console.error('Error getting booking:', error);
			throw error;
		}
	};

	const getGuestBookings = async (guestAddress) => {
		try {
			const result = await publicClient.readContract({
				...contracts.bookingManager,
				functionName: 'getGuestBookings',
				args: [guestAddress || address],
			});
			return result;
		} catch (error) {
			console.error('Error getting guest bookings:', error);
			throw error;
		}
	};

	const getPropertyBookings = async (propertyId) => {
		try {
			const result = await publicClient.readContract({
				...contracts.bookingManager,
				functionName: 'getPropertyBookings',
				args: [propertyId],
			});
			return result;
		} catch (error) {
			console.error('Error getting property bookings:', error);
			throw error;
		}
	};

	const getProperty = async (propertyId) => {
		try {
			const result = await publicClient.readContract({
				...contracts.propertyMarketplace,
				functionName: 'properties',
				args: [propertyId],
			});
			return result;
		} catch (error) {
			console.error('Error getting property:', error);
			throw error;
		}
	};

	const hasBookingConflict = async (propertyId, checkInDate, checkOutDate) => {
		try {
			const result = await publicClient.readContract({
				...contracts.bookingManager,
				functionName: 'hasBookingConflict',
				args: [propertyId, checkInDate, checkOutDate],
			});
			return result;
		} catch (error) {
			console.error('Error checking booking conflict:', error);
			throw error;
		}
	};

	const getActivePropertyIds = async () => {
		try {
			const result = await publicClient.readContract({
				...contracts.propertyMarketplace,
				functionName: 'getActivePropertyIds',
			});
			return result;
		} catch (error) {
			console.error('Error getting active property IDs:', error);
			throw error;
		}
	};

	// Debug/consistency helpers
	const getBookingManagerMarketplaceAddress = async () => {
		try {
			const result = await publicClient.readContract({
				...contracts.bookingManager,
				functionName: 'propertyMarketplace',
			});
			return result;
		} catch (error) {
			console.error('Error reading booking manager marketplace address:', error);
			throw error;
		}
	};

	const getPropertyFromMarketplace = async (marketplaceAddress, propertyId) => {
		try {
			const result = await publicClient.readContract({
				address: marketplaceAddress,
				abi: PropertyMarketplaceABI.abi,
				functionName: 'properties',
				args: [propertyId],
			});
			return result;
		} catch (error) {
			console.error('Error reading property from specified marketplace:', error);
			throw error;
		}
	};

	const value = {
		// Contract configurations
		contracts,
		contractAddresses: addr,
		publicClient,

		// State
		isConnected,
		address,
		isWritePending,
		isTransactionLoading,
		writeError,
		transactionReceipt,

		// Booking Manager Functions
		createBooking,
		checkIn,
		cancelBooking,
		triggerCheckInWindow,
		processMissedCheckIn,
		hostResolveDispute,
		guestResolveDispute,
		escalateDispute,

		// Property Marketplace Functions
		updateProperty,
		removeProperty,

		// Read Functions
		getBooking,
		getGuestBookings,
		getPropertyBookings,
		getProperty,
		hasBookingConflict,
		getActivePropertyIds,
		getBookingManagerMarketplaceAddress,
		getPropertyFromMarketplace,

		// Data and loading states
		bookingManagerData,
		bookingManagerLoading,
		bookingManagerError,
		propertyMarketplaceData,
		propertyMarketplaceLoading,
		propertyMarketplaceError,

		// Refetch functions
		refetchBookingManager,
		refetchPropertyMarketplace,
	};

	return (
		<ContractContext.Provider value={value}>
			{children}
		</ContractContext.Provider>
	);
}; 