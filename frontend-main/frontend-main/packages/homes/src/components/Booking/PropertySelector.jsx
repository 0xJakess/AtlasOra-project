import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { parsePropertyData, parseBookingData, formatPrice, formatDate, getBookingStatusLabel, getBookingStatusColor, etherToWei } from 'library/helpers/contractHelpers';
import styled from 'styled-components';
import { ethers } from 'ethers';

const PropertySelectorContainer = styled.div`
	background: white;
	border-radius: 12px;
	padding: 24px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	margin-bottom: 20px;
`;

const Title = styled.h3`
	margin: 0 0 20px 0;
	color: #2c2c2c;
	font-size: 18px;
	font-weight: 600;
`;

const PropertyGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 20px;
	margin-bottom: 20px;
`;

const PropertyCard = styled.div`
	border: 2px solid ${props => props.selected ? '#667eea' : '#e0e0e0'};
	border-radius: 8px;
	padding: 16px;
	cursor: pointer;
	transition: all 0.3s ease;
	background: ${props => props.selected ? '#f8f9ff' : 'white'};
	
	&:hover {
		border-color: #667eea;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
	}
`;

const PropertyId = styled.div`
	font-weight: 600;
	font-size: 16px;
	color: #2c2c2c;
	margin-bottom: 8px;
`;

const PropertyDetails = styled.div`
	font-size: 14px;
	color: #666;
	margin-bottom: 8px;
`;

const PropertyPrice = styled.div`
	font-size: 18px;
	font-weight: 600;
	color: #667eea;
	margin-bottom: 8px;
`;

const PropertyStatus = styled.div`
	font-size: 12px;
	padding: 4px 8px;
	border-radius: 4px;
	background: ${props => props.active ? '#d4edda' : '#f8d7da'};
	color: ${props => props.active ? '#155724' : '#721c24'};
	display: inline-block;
`;

const LoadingMessage = styled.div`
	text-align: center;
	padding: 40px;
	color: #666;
	font-size: 16px;
`;

const ErrorMessage = styled.div`
	color: #dc3545;
	font-size: 14px;
	margin-top: 8px;
	text-align: center;
	padding: 20px;
`;

const NoPropertiesMessage = styled.div`
	text-align: center;
	padding: 40px;
	color: #666;
	font-size: 16px;
`;

const BookingSection = styled.div`
	margin-top: 20px;
	padding: 16px;
	background: #f8f9fa;
	border-radius: 8px;
	border: 1px solid #e9ecef;
`;

const BookingTitle = styled.h4`
	margin: 0 0 16px 0;
	color: #2c2c2c;
	font-size: 16px;
	font-weight: 600;
`;

const BookingList = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

const BookingCard = styled.div`
	background: white;
	border: 1px solid #e9ecef;
	border-radius: 6px;
	padding: 12px;
`;

const BookingHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
`;

const BookingId = styled.span`
	font-weight: 600;
	font-size: 14px;
	color: #2c2c2c;
`;

const BookingStatus = styled.span`
	font-size: 12px;
	padding: 4px 8px;
	border-radius: 4px;
	color: white;
	font-weight: 500;
`;

const BookingDetails = styled.div`
	font-size: 13px;
	color: #666;
	line-height: 1.4;
`;

const NoBookingsMessage = styled.div`
	text-align: center;
	padding: 20px;
	color: #666;
	font-size: 14px;
	font-style: italic;
`;

const PropertySelector = ({ onPropertySelected, cmsUsersByAddress = {}, useStrapi = false, adminBaseUrl = '', adminToken = '' }) => {
	const { address, isConnected } = useAccount();
	const backendBaseUrl = (import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3000');
	
	const [properties, setProperties] = useState([]);
	const [selectedProperty, setSelectedProperty] = useState(null);
	const [propertyBookings, setPropertyBookings] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadingBookings, setLoadingBookings] = useState(false);
	const [error, setError] = useState('');
	const [debug, setDebug] = useState(false);
	const [rawStrapi, setRawStrapi] = useState([]);
 

	// Fetch all properties when component mounts
	useEffect(() => {
		const fetchProperties = async () => {
			if (!isConnected) {
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				setError('');

				let list = [];
				if (useStrapi && adminBaseUrl) {
					// Load from Strapi (published + drafts)
					const apiBase = adminBaseUrl.endsWith('/') ? adminBaseUrl : `${adminBaseUrl}/`;
					const previewParam = adminToken ? 'publicationState=preview&' : '';
					const url = `${apiBase}properties?${previewParam}pagination[pageSize]=100&populate=*`;
					const res = await fetch(url, { headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {} });
					if (!res.ok) {
						const errBody = await res.text().catch(() => '');
						throw new Error(`Strapi properties request failed: ${res.status} ${res.statusText} ${errBody}`);
					}
					const json = await res.json();
					const data = Array.isArray(json?.data) ? json.data : [];
					setRawStrapi(data);
					list = data.map((item) => {
						const node = item.attributes || item;
						const title = node.Title || '';
						const propId = node.BlockchainPropertyId || node.blockchainPropertyId || title.split(' ').slice(-1)[0] || title;
						const rawPrice = node.PricePerNight ?? 0;
						const priceStr = typeof rawPrice === 'number' ? String(rawPrice) : (rawPrice || '0');
						let priceWei = 0n;
						try { priceWei = ethers.parseEther(priceStr); } catch (_) { priceWei = 0n; }
						const ownerName = (node?.users_permissions_user?.data?.attributes?.username)
							|| (node?.users_permissions_user?.username)
							|| '';
						return {
							propertyId: propId,
							propertyTokenAddress: '',
							owner: '',
							ownerName,
							pricePerNight: priceWei.toString(),
							isActive: node.CurrentlyRented === undefined ? true : !node.CurrentlyRented,
							propertyURI: '',
							strapiId: item.id,
							strapiDocumentId: node.documentId || item.documentId || null,
						};
					});
				} else {
					// Load from backend (chain)
					const res = await fetch(`${backendBaseUrl}/api/properties`);
					if (!res.ok) throw new Error('Failed to load properties');
					const chainList = await res.json();
					list = (Array.isArray(chainList) ? chainList : []).filter(p => p && p.propertyId);
				}

				setProperties(list);
				console.log('[PropertySelector] Loaded properties:', list);
				
			} catch (error) {
				console.error('Error fetching properties:', error);
				setError('Failed to load properties. Please try again.');
			} finally {
				setLoading(false);
			}
		};

		fetchProperties();
	}, [isConnected, backendBaseUrl, useStrapi, adminBaseUrl, adminToken]);
 
	// Fetch bookings for a property (now via Strapi CMS)
	const fetchPropertyBookings = async (property) => {
		if (!property) return;
		try {
			setLoadingBookings(true);
			const base = adminBaseUrl && adminBaseUrl.endsWith('/') ? adminBaseUrl : `${adminBaseUrl || ''}/`;
			if (!useStrapi || !base) {
				setPropertyBookings([]);
				return;
			}
			const previewParam = adminToken ? 'publicationState=preview&' : '';
			// Prefer filtering by numeric id; fall back to documentId if available
			const filter = property.strapiId
				? `filters[property][id][$eq]=${encodeURIComponent(property.strapiId)}`
				: (property.strapiDocumentId ? `filters[property][documentId][$eq]=${encodeURIComponent(property.strapiDocumentId)}` : '');
			const url = `${base}proeprty-bookings?${previewParam}pagination[pageSize]=100&populate[users_permissions_user]=true&populate[property]=true${filter ? `&${filter}` : ''}`;
			const res = await fetch(url, { headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {} });
			if (!res.ok) {
				setPropertyBookings([]);
				return;
			}
			const json = await res.json();
			const data = Array.isArray(json?.data) ? json.data : [];
			const mapStatus = (s) => {
				switch ((s || '').toLowerCase()) {
					case 'upcoming':
					case 'active':
						return 0; // Active
					case 'complete':
						return 3; // Completed
					case 'cancelled':
						return 5; // Cancelled
					default:
						return 0;
				}
			};
			const bookings = data.map((item) => {
				const node = item.attributes || item;
				const userNode = node?.users_permissions_user?.data?.attributes || node?.users_permissions_user || {};
				const start = node.StartDate ? new Date(node.StartDate) : null;
				const end = node.EndDate ? new Date(node.EndDate) : null;
				const nightsCalc = (start && end) ? Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24))) : Number(node.NumberOfNights || 0);
				const toNum = (v) => {
					const n = Number(v);
					return Number.isFinite(n) ? n : 0;
				};
				const totalPaidMicro = toNum(node.TotalPaid);
				const priceMicro = toNum(node.PriceperNight);
				const atlasMicro = toNum(node.AtlasFee);
				const cleaningMicro = toNum(node.CleaningFee);
				let totalWei = 0n;
				if ((node.PaidBy || '').toUpperCase() === 'ETH') {
					if (totalPaidMicro > 0) {
						totalWei = BigInt(Math.round(totalPaidMicro)) * 1000000000000n; // micro-ETH → wei
					} else if (priceMicro > 0 || atlasMicro > 0 || cleaningMicro > 0) {
						const nights = nightsCalc || toNum(node.NumberOfNights) || 1;
						const micro = Math.round(priceMicro * nights + atlasMicro + cleaningMicro);
						totalWei = BigInt(micro) * 1000000000000n;
					}
				}
				// Fallback: derive from property wei price if nothing else available
				if (totalWei === 0n && property?.pricePerNight) {
					const nights = Math.max(1, nightsCalc || 1);
					try { totalWei = BigInt(property.pricePerNight) * BigInt(nights); } catch (_) {}
				}
				return {
					bookingId: item.id || node.documentId || 'N/A',
					propertyId: property.propertyId,
					guest: userNode.walletAddress || '',
					checkInDate: node.StartDate || '',
					checkOutDate: node.EndDate || '',
					totalAmount: totalWei.toString(),
					status: mapStatus(node.BookingStatus),
				};
			});
			setPropertyBookings(bookings);
		} catch (error) {
			console.error('Error fetching property bookings (Strapi):', error);
			setPropertyBookings([]);
		} finally {
			setLoadingBookings(false);
		}
	};

	// Handle property selection
	const handlePropertySelect = (property) => {
		setSelectedProperty(property);
		setPropertyBookings([]); // Clear previous bookings
		
		// Fetch bookings for the selected property
		if (property) {
			fetchPropertyBookings(property);
		}
		
		if (onPropertySelected) {
			onPropertySelected(property);
		}
	};

	if (!isConnected) {
		return (
			<PropertySelectorContainer>
				<Title>Available Properties</Title>
				<NoPropertiesMessage>
					Please connect your wallet to view available properties.
				</NoPropertiesMessage>
			</PropertySelectorContainer>
		);
	}

	if (loading) {
		return (
			<PropertySelectorContainer>
				<Title>Available Properties</Title>
				<LoadingMessage>Loading properties...</LoadingMessage>
			</PropertySelectorContainer>
		);
	}

	if (error) {
		return (
			<PropertySelectorContainer>
				<Title>Available Properties</Title>
				<ErrorMessage>
					{error}
				</ErrorMessage>
			</PropertySelectorContainer>
		);
	}

	if (properties.length === 0) {
		return (
			<PropertySelectorContainer>
				<Title>Available Properties</Title>
				<NoPropertiesMessage>
					No properties are currently available for booking.
					<br />
					Property owners can list their properties using the "List Property" tab.
				</NoPropertiesMessage>
			</PropertySelectorContainer>
		);
	}

	return (
		<PropertySelectorContainer>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
				<Title style={{ margin: 0 }}>Available Properties ({properties.length})</Title>
				<button type="button" onClick={() => setDebug(d => !d)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: debug ? '#e6fffa' : '#f8fafc', fontSize: 12 }}>
					{debug ? 'Hide Debug' : 'Show Debug'}
				</button>
			</div>
			
			<PropertyGrid>
				{properties.map((property) => (
					<PropertyCard
						key={property.propertyId}
						selected={selectedProperty?.propertyId === property.propertyId}
						onClick={() => handlePropertySelect(property)}
					>
						<PropertyId>{property.propertyId}</PropertyId>
						<PropertyDetails>
							<strong>Owner:</strong> {property.ownerName || (() => {
								const ownerAddr = property.owner || '';
								const name = ownerAddr ? cmsUsersByAddress[ownerAddr.toLowerCase()] : '';
								return name || (ownerAddr ? `${ownerAddr.slice(0, 6)}...${ownerAddr.slice(-4)}` : 'Unknown');
							})()}
						</PropertyDetails>
						<PropertyDetails>
							<strong>Token:</strong> {property.propertyTokenAddress ? `${property.propertyTokenAddress.slice(0, 6)}...${property.propertyTokenAddress.slice(-4)}` : '—'}
						</PropertyDetails>
						<PropertyPrice>
							{formatPrice(property.pricePerNight)} per night
						</PropertyPrice>
						<PropertyStatus active={property.isActive}>
							{property.isActive ? 'Available' : 'Not Available'}
						</PropertyStatus>
						{debug && useStrapi && (
							<div style={{ marginTop: 8, background: '#f7fafc', padding: 8, borderRadius: 6 }}>
								<div style={{ fontSize: 12 }}>
									<strong>Debug:</strong> PricePerNight(raw) = {String((rawStrapi.find(x => (((x.attributes?.Title) || x.Title || '')).includes(property.propertyId))?.attributes?.PricePerNight ?? rawStrapi.find(x => (((x.attributes?.Title) || x.Title || '')).includes(property.propertyId))?.PricePerNight ?? 'N/A'))}, ownerName = {property.ownerName || 'N/A'}
								</div>
							</div>
						)}
					</PropertyCard>
				))}
			</PropertyGrid>

			{debug && useStrapi && (
				<div style={{ marginTop: 12, background: '#f9fafb', padding: 12, borderRadius: 6 }}>
					<pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(rawStrapi.map(i => ({ id: i.id, Title: i.attributes?.Title || i.Title, PricePerNight: i.attributes?.PricePerNight || i.PricePerNight, user: i.attributes?.users_permissions_user?.data?.attributes?.username || i.users_permissions_user?.username })), null, 2)}</pre>
				</div>
			)}

			{selectedProperty && (
				<div style={{ marginTop: '20px', padding: '16px', background: '#f8f9ff', borderRadius: '8px' }}>
					<strong>Selected Property:</strong> {selectedProperty.propertyId}
					<br />
					<strong>Price:</strong> {formatPrice(selectedProperty.pricePerNight)} per night
					
					<BookingSection>
						<BookingTitle>
							Property Bookings ({propertyBookings.length})
							{loadingBookings && <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>(Loading...)</span>}
						</BookingTitle>
						
						{loadingBookings ? (
							<NoBookingsMessage>Loading bookings...</NoBookingsMessage>
						) : propertyBookings.length > 0 ? (
							<BookingList>
								{propertyBookings.map((booking) => (
									<BookingCard key={booking.bookingId}>
										<BookingHeader>
											<BookingId>Booking #{booking.bookingId}</BookingId>
											<BookingStatus 
												style={{ backgroundColor: getBookingStatusColor(booking.status) }}
											>
												{getBookingStatusLabel(booking.status)}
											</BookingStatus>
										</BookingHeader>
										<BookingDetails>
											<strong>Guest:</strong> {(() => {
												const guestAddr = booking.guest || '';
												const name = cmsUsersByAddress[guestAddr.toLowerCase()];
												return name || (guestAddr ? `${guestAddr.slice(0, 6)}...${guestAddr.slice(-4)}` : 'Unknown');
											})()}
											<br />
											<strong>Check-in:</strong> {formatDate(booking.checkInDate)}
											<br />
											<strong>Check-out:</strong> {formatDate(booking.checkOutDate)}
											<br />
											<strong>Total Amount:</strong> {formatPrice(booking.totalAmount)}
										</BookingDetails>
									</BookingCard>
								))}
							</BookingList>
						) : (
							<NoBookingsMessage>No bookings found for this property.</NoBookingsMessage>
						)}
					</BookingSection>
				</div>
			)}
		</PropertySelectorContainer>
	);
};

export default PropertySelector; 