import React, { useState, useContext, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { ethers } from 'ethers';
import { Modal } from 'antd';
import { useAccount } from 'wagmi';
import WalletStatus from 'components/WalletConnect/WalletStatus';
import PropertySelector from 'components/Booking/PropertySelector';
import { AuthContext } from 'context/AuthProvider';
import { useContracts } from 'context/ContractProvider';

const DemoContainer = styled.div`
	max-width: 1200px;
	margin: 0 auto;
	padding: 20px;
`;

const Header = styled.div`
	text-align: center;
	margin-bottom: 40px;
`;

const Title = styled.h1`
	color: #2c2c2c;
	font-size: 32px;
	font-weight: 700;
	margin-bottom: 16px;
`;

const Subtitle = styled.p`
	color: #666;
	font-size: 18px;
	margin-bottom: 24px;
`;

const WalletSection = styled.div`
	display: flex;
	justify-content: center;
	margin-bottom: 40px;
`;

const TabContainer = styled.div`
	margin-bottom: 30px;
`;

const TabList = styled.div`
	display: flex;
	border-bottom: 2px solid #e0e0e0;
	margin-bottom: 30px;
`;

const Tab = styled.button`
	padding: 12px 24px;
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	color: ${props => (props.active ? '#667eea' : '#666')};
	font-size: 16px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	
	&:hover {
		color: #667eea;
	}
	
	${props => props.active && `
		border-bottom-color: #667eea;
		color: #667eec;
	`}
`;

const TabContent = styled.div`
	display: ${props => (props.active ? 'block' : 'none')};
`;

const DemoSection = styled.div`
	background: #f8f9fa;
	border-radius: 12px;
	padding: 24px;
	margin-bottom: 30px;
`;

const SectionTitle = styled.h2`
	color: #2c2c2c;
	font-size: 24px;
	font-weight: 600;
	margin-bottom: 16px;
`;

const SectionDescription = styled.p`
	color: #666;
	font-size: 16px;
	margin-bottom: 20px;
	line-height: 1.6;
`;

const ContractInfo = styled.div`
	background: white;
	border-radius: 8px;
	padding: 20px;
	margin-bottom: 20px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const InfoTitle = styled.h4`
	color: #2c2c2c;
	font-size: 16px;
	font-weight: 600;
	margin-bottom: 8px;
`;

const InfoText = styled.p`
	color: #666;
	font-size: 14px;
	margin-bottom: 4px;
	font-family: 'Courier New', monospace;
	word-break: break-all;
`;

const BackendIntegration = () => {
	const { isConnected, address } = useAccount();
	const { loggedIn, token, user } = useContext(AuthContext);
	const { createBooking, contractAddresses, publicClient } = useContracts();
	const [activeTab, setActiveTab] = useState('overview');
	const [selectedProperty, setSelectedProperty] = useState(null);
	const backendBaseUrl = useMemo(() => (import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3000'), []);
	const adminBaseUrl = useMemo(() => (import.meta.env.VITE_APP_API_URL || 'http://localhost:1337/api/'), []);
	const adminToken = useMemo(() => import.meta.env.VITE_APP_API_TOKEN || token || '', [token]);
	const [cmsUsersByAddress, setCmsUsersByAddress] = useState({});

	// Helpers: get typed-data, sign, execute
	const signAndExecute = async (typedDataEndpoint, executeEndpoint, payload) => {
		if (!window.ethereum) throw new Error('MetaMask not found');
		const provider = new ethers.BrowserProvider(window.ethereum);
		const signer = await provider.getSigner();
		const userAddress = await signer.getAddress();

		// 1) Request typed-data from backend
		const tdRes = await fetch(`${backendBaseUrl}${typedDataEndpoint}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(loggedIn && token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({ userAddress, ...payload }),
		});
		if (!tdRes.ok) {
			const err = await tdRes.json().catch(() => ({}));
			throw new Error(err?.error || 'Failed to build typed data');
		}
		const { typedData } = await tdRes.json();

		// 2) Sign typed-data
		const signature = await signer.signTypedData(typedData.domain, typedData.types, typedData.message);

		// 3) Execute via backend (include the signed deadline to avoid mismatch)
		const execRes = await fetch(`${backendBaseUrl}${executeEndpoint}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(loggedIn && token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({ userAddress, signature, ...payload, meta: { deadline: typedData.message.deadline } }),
		});
		const result = await execRes.json().catch(() => ({}));
		if (!execRes.ok || result?.success === false) throw new Error(result?.error || 'Execution failed');
		return result;
	};

	// Load minimal CMS mapping of walletAddress->username if available
	const loadCmsUsers = async () => {
		try {
			// This assumes you add a walletAddress field to users; if not present, this will be a no-op
			const base = adminBaseUrl.endsWith('/') ? adminBaseUrl : `${adminBaseUrl}/`;
			const res = await fetch(`${base}users?pagination[pageSize]=100`, {
				headers: {
					...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
				},
			});
			if (!res.ok) return;
			const users = await res.json();
			const map = {};
			(users || []).forEach((u) => {
				if (u.walletAddress) {
					map[u.walletAddress.toLowerCase()] = u.username || u.email || u.id;
				}
			});
			setCmsUsersByAddress(map);
		} catch (_) {}
	};

	useEffect(() => {
		loadCmsUsers();
	}, [adminBaseUrl, adminToken]);

	// Inline: Backend-driven List Property form
	const BackendListPropertyForm = () => {
		const [form, setForm] = useState({ propertyURI: '', pricePerNight: '', tokenName: '', tokenSymbol: '' });
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState('');
		const [success, setSuccess] = useState('');

		const onSubmit = async (e) => {
			e.preventDefault();
			setError('');
			setSuccess('');
			if (!isConnected) {
				setError('Please connect your wallet first');
				return;
			}
			if (!form.propertyURI || !form.pricePerNight || !form.tokenName || !form.tokenSymbol) {
				setError('Please fill all fields');
				return;
			}
			try {
				setLoading(true);
				const propertyData = {
					uri: form.propertyURI,
					pricePerNight: form.pricePerNight,
					tokenName: form.tokenName,
					tokenSymbol: form.tokenSymbol,
				};
				const res = await signAndExecute('/api/properties/list/typed-data', '/api/properties/list', { propertyData });
				setSuccess(`Listed! Property ID: ${res.propertyId}. Tx: ${res.transactionHash}`);
				setForm({ propertyURI: '', pricePerNight: '', tokenName: '', tokenSymbol: '' });
			} catch (err) {
				setError(err.message || 'Failed to list property');
			} finally {
				setLoading(false);
			}
		};

		return (
			<form onSubmit={onSubmit} style={{ background: 'white', padding: 16, borderRadius: 8 }}>
				<div style={{ marginBottom: 12 }}>
					<label>Property Metadata URI</label>
					<input
						type="url"
						value={form.propertyURI}
						onChange={(e) => setForm({ ...form, propertyURI: e.target.value })}
						placeholder="ipfs://... or https://ipfs.io/ipfs/..."
						style={{ width: '100%', padding: 10, border: '1px solid #e0e0e0', borderRadius: 6 }}
						required
					/>
				</div>
				<div style={{ marginBottom: 12 }}>
					<label>Price per Night (ETH)</label>
					<input
						type="number"
						step="0.001"
						min="0.001"
						value={form.pricePerNight}
						onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
						placeholder="0.05"
						style={{ width: '100%', padding: 10, border: '1px solid #e0e0e0', borderRadius: 6 }}
						required
					/>
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					<div>
						<label>Token Name</label>
						<input
							type="text"
							value={form.tokenName}
							onChange={(e) => setForm({ ...form, tokenName: e.target.value })}
							placeholder="My Property Token"
							style={{ width: '100%', padding: 10, border: '1px solid #e0e0e0', borderRadius: 6 }}
							required
						/>
					</div>
					<div>
						<label>Token Symbol</label>
						<input
							type="text"
							value={form.tokenSymbol}
							onChange={(e) => setForm({ ...form, tokenSymbol: e.target.value })}
							placeholder="PROP"
							maxLength={10}
							style={{ width: '100%', padding: 10, border: '1px solid #e0e0e0', borderRadius: 6 }}
							required
						/>
					</div>
				</div>
				{error && <div style={{ color: '#dc3545', marginTop: 8 }}>{error}</div>}
				{success && <div style={{ color: '#28a745', marginTop: 8 }}>{success}</div>}
				<button type="submit" disabled={loading || !isConnected} style={{ marginTop: 12, padding: '12px 16px', borderRadius: 6, border: 'none', color: 'white', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
					{loading ? 'Listing...' : isConnected ? 'List via Backend' : 'Connect Wallet'}
				</button>
			</form>
		);
	};

	// Inline: Backend-driven Booking form
	const BackendBookingForm = ({ property }) => {
		const [form, setForm] = useState({ checkInDate: '', checkOutDate: '' });
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState('');
		const [success, setSuccess] = useState('');
		const [showPayment, setShowPayment] = useState(false);
		const [paymentData, setPaymentData] = useState(null);

		const onSubmit = async (e) => {
			e.preventDefault();
			setError('');
			setSuccess('');
			if (!isConnected) {
				setError('Please connect your wallet first');
				return;
			}
			if (!property || !property.propertyId || !form.checkInDate || !form.checkOutDate) {
				setError('Please select a property and dates');
				return;
			}
			try {
				setLoading(true);
				const toUtcDay = (d) => Math.floor(new Date(`${d}T00:00:00Z`).getTime() / 1000);
				const checkInTs = toUtcDay(form.checkInDate);
				const checkOutTs = toUtcDay(form.checkOutDate);
				if (checkOutTs <= checkInTs) {
					throw new Error('Check-out must be after check-in');
				}
				const numNights = Math.floor((checkOutTs - checkInTs) / (24 * 60 * 60));
				if (numNights <= 0) {
					throw new Error('Booking must be at least 1 night');
				}
				// pricePerNight from backend is a string in wei
				const pricePerNightWei = BigInt(property.pricePerNight);
				const totalAmountWei = pricePerNightWei * BigInt(numNights);
				const bookingManagerAddress = contractAddresses?.victionTestnet?.bookingManager || '';
				const qrData = `ethereum:${bookingManagerAddress}@89?value=${totalAmountWei.toString()}`;
				setPaymentData({
					address: bookingManagerAddress,
					totalAmountWei: totalAmountWei.toString(),
					checkInTs,
					checkOutTs,
					qrData,
				});
				setShowPayment(true);
			} catch (err) {
				setError(err.message || 'Failed to create booking');
			} finally {
				setLoading(false);
			}
		};

		return (
			<form onSubmit={onSubmit} style={{ background: 'white', padding: 16, borderRadius: 8 }}>
				<div style={{ marginBottom: 12 }}>Selected Property: <strong>{property?.propertyId || 'None'}</strong></div>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					<div>
						<label>Check-in</label>
						<input type="date" value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} style={{ width: '100%', padding: 10, border: '1px solid #e0e0e0', borderRadius: 6 }} required />
					</div>
					<div>
						<label>Check-out</label>
						<input type="date" value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} style={{ width: '100%', padding: 10, border: '1px solid #e0e0e0', borderRadius: 6 }} required />
					</div>
				</div>
				{error && <div style={{ color: '#dc3545', marginTop: 8 }}>{error}</div>}
				{success && <div style={{ color: '#28a745', marginTop: 8 }}>{success}</div>}
				<button type="submit" disabled={loading || !isConnected || !property} style={{ marginTop: 12, padding: '12px 16px', borderRadius: 6, border: 'none', color: 'white', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
					{loading ? 'Preparing...' : isConnected ? 'Book' : 'Connect Wallet'}
				</button>

				<Modal
					open={showPayment}
					onCancel={() => setShowPayment(false)}
					footer={null}
					title="Choose a payment method"
				>
					{paymentData && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
							<div>
								<div style={{ marginBottom: 8, fontWeight: 600 }}>Scan to Pay (QR)</div>
								<img
									alt="QR"
									width={180}
									height={180}
									src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paymentData.qrData)}`}
								/>
							</div>
							<div style={{ fontFamily: 'monospace', wordBreak: 'break-all', background: '#f7fafc', padding: 8, borderRadius: 6 }}>
								{paymentData.address}
							</div>
							<div style={{ display: 'flex', gap: 8 }}>
								<button
									type="button"
									onClick={() => navigator.clipboard.writeText(paymentData.address)}
									style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc' }}
								>
									Copy Address
								</button>
								<button
									type="button"
									onClick={async () => {
										try {
											setLoading(true);
											const txHash = await createBooking(
												property.propertyId,
												paymentData.checkInTs,
												paymentData.checkOutTs,
												BigInt(paymentData.totalAmountWei)
											);
											// Wait for receipt and show confirmation modal
											try {
												const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
												setSuccess(`Booked! Tx: ${txHash}`);
												setForm({ checkInDate: '', checkOutDate: '' });
												setShowPayment(false);
												const explorer = 'https://testnet.vicscan.xyz/tx/' + txHash;
												Modal.success({ title: 'Booking Confirmed', content: `Success. Tx: ${txHash}\n${explorer}` });
											} catch (waitErr) {
												Modal.info({ title: 'Transaction Submitted', content: `Tx submitted. Awaiting confirmation. Hash: ${txHash}` });
											}
										} catch (err) {
											setError(err.message || 'Failed to create booking');
										} finally {
											setLoading(false);
										}
									}}
									style={{ padding: '8px 12px', borderRadius: 6, border: 'none', color: 'white', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
								>
									Pay with MetaMask
								</button>
							</div>
						</div>
					)}
				</Modal>
			</form>
		);
	};

	// Reconcile view
	const ReconcileSection = () => {
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState('');
		const [data, setData] = useState({ backendProps: [], adminProps: [], adminBookings: [] });

		const fetchJSON = async (url, headers = {}) => {
			const res = await fetch(url, { headers });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return res.json();
		};

		const load = async () => {
			try {
				setLoading(true);
				setError('');
				const normalizedAdminBase = adminBaseUrl.endsWith('/') ? adminBaseUrl : `${adminBaseUrl}/`;
				const previewParam = adminToken ? 'publicationState=preview&' : '';
				const [backendProps, adminPropsRes, adminBookingsRes] = await Promise.all([
					fetchJSON(`${backendBaseUrl}/api/properties`),
					fetchJSON(`${normalizedAdminBase}properties?${previewParam}pagination[pageSize]=50&populate=*`, {
						...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
					}),
					fetchJSON(`${normalizedAdminBase}proeprty-bookings?pagination[pageSize]=50&populate=property`, {
						...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
					}),
				]);
				setData({
					backendProps: Array.isArray(backendProps) ? backendProps : [],
					adminProps: Array.isArray(adminPropsRes?.data) ? adminPropsRes.data : [],
					adminBookings: Array.isArray(adminBookingsRes?.data) ? adminBookingsRes.data : [],
				});
			} catch (err) {
				setError(err.message || 'Failed to load reconciliation data');
			} finally {
				setLoading(false);
			}
		};

		const reconcile = async () => {
			try {
				setLoading(true);
				setError('');
				await fetch(`${backendBaseUrl}/api/reconcile`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userAddress: address }),
				});
				await load();
			} catch (err) {
				setError(err.message || 'Reconciliation failed');
			} finally {
				setLoading(false);
			}
		};

		return (
			<div style={{ background: 'white', padding: 16, borderRadius: 8 }}>
				<div style={{ marginBottom: 12 }}>
					<button onClick={load} disabled={loading} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #e9ecef', background: '#f8f9fa', marginRight: 8 }}>
						{loading ? 'Loading...' : 'Load Data'}
					</button>
					<button onClick={reconcile} disabled={loading} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #e9ecef', background: '#f0fff4' }}>
						{loading ? 'Reconciling...' : 'Reconcile Chain → Strapi'}
					</button>
				</div>
				{error && <div style={{ color: '#dc3545', marginBottom: 8 }}>{error}</div>}
				{!loading && (data.backendProps.length > 0 || data.adminProps.length > 0) && (
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
						<div>
							<h4>Chain Properties (Backend)</h4>
							<ul>
								{data.backendProps.map((p) => {
									const addrRaw = p.ownerResolved || p.owner || '';
									const ownerKey = addrRaw.toLowerCase();
									const ownerLabel = p.ownerName || cmsUsersByAddress[ownerKey] || (addrRaw ? `${addrRaw.slice(0, 6)}...${addrRaw.slice(-4)}` : 'Unknown');
									return (
										<li key={p.propertyId} style={{ marginBottom: 6 }}>
											{p.propertyId} - {ownerLabel}
										</li>
									);
								})}
							</ul>
						</div>
						<div>
							<h4>Admin Properties (Strapi)</h4>
							<ul>
								{data.adminProps.map((p) => (
									<li key={p.id} style={{ marginBottom: 6 }}>
										#{p.id} - {p.attributes?.Title || p.Title || '(no title)'}
									</li>
								))}
							</ul>
						</div>
					</div>
				)}
				{!loading && data.adminBookings.length > 0 && (
					<div style={{ marginTop: 16 }}>
						<h4>Admin Bookings (Strapi)</h4>
						<ul>
							{data.adminBookings.map((b) => (
								<li key={b.id} style={{ marginBottom: 6 }}>
									#{b.id} - Status: {b.BookingStatus}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		);
	};

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'list', label: 'List Property (Backend)' },
		{ id: 'booking', label: 'Book Property (Backend)' },
		{ id: 'reconcile', label: 'Reconcile (Admin vs Chain)' },
	];

	return (
		<DemoContainer>
			<Header>
				<Title>Backend Integration</Title>
				<Subtitle>Sign with MetaMask → Backend posts to IPFS + Blockchain → Admin stays in sync.</Subtitle>
				<WalletSection>
					<WalletStatus />
				</WalletSection>
			</Header>

			<TabContainer>
				<TabList>
					{tabs.map(tab => (
						<Tab key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
							{tab.label}
						</Tab>
					))}
				</TabList>

				<TabContent active={activeTab === 'overview'}>
					<DemoSection>
						<SectionTitle>How it works</SectionTitle>
						<ContractInfo>
							<InfoTitle>Flow</InfoTitle>
							<InfoText>1) Connect wallet and sign EIP-712 payload</InfoText>
							<InfoText>2) Backend verifies, uploads metadata to IPFS, executes meta-tx</InfoText>
							<InfoText>3) Event listener syncs blockchain data to Strapi</InfoText>
						</ContractInfo>
					</DemoSection>
				</TabContent>

				<TabContent active={activeTab === 'list'}>
					<DemoSection>
						<SectionTitle>List Property (via Backend)</SectionTitle>
						<SectionDescription>
							Backend prepares typed data, you sign, backend relays to chain. Admin syncs automatically.
						</SectionDescription>
						{!isConnected ? (
							<div style={{ textAlign: 'center', padding: '40px' }}>
								<p>Please connect your wallet to list a property.</p>
							</div>
						) : (
							<BackendListPropertyForm />
						)}
					</DemoSection>
				</TabContent>

				<TabContent active={activeTab === 'booking'}>
					<DemoSection>
						<SectionTitle>Book Property (via Backend)</SectionTitle>
						<SectionDescription>
							Select a property, choose dates, sign booking meta-tx; backend relays and admin syncs.
						</SectionDescription>
						{!isConnected && (
							<div style={{ textAlign: 'center', padding: '20px', color: '#555' }}>
								<p>You can browse properties below. Connect your wallet to book.</p>
							</div>
						)}
						<PropertySelector
							onPropertySelected={setSelectedProperty}
							cmsUsersByAddress={cmsUsersByAddress}
							useStrapi={true}
							adminBaseUrl={adminBaseUrl}
							adminToken={adminToken}
						/>
						{selectedProperty && isConnected && <BackendBookingForm property={selectedProperty} />}
					</DemoSection>
				</TabContent>

				<TabContent active={activeTab === 'reconcile'}>
					<DemoSection>
						<SectionTitle>Reconcile Records</SectionTitle>
						<SectionDescription>
							Use admin API for reads. Compare properties and bookings from chain vs Strapi.
						</SectionDescription>
						<ReconcileSection />
					</DemoSection>
				</TabContent>
			</TabContainer>
		</DemoContainer>
	);
};

export default BackendIntegration; 