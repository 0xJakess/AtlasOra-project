import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { useContracts } from 'context/ContractProvider';
import BookingForm from 'components/Booking/BookingForm';
import PropertySelector from 'components/Booking/PropertySelector';
import BookingManagement from 'components/Booking/BookingManagement';
import WalletStatus from 'components/WalletConnect/WalletStatus';
import styled from 'styled-components';

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
	color: ${props => props.active ? '#667eea' : '#666'};
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
	display: ${props => props.active ? 'block' : 'none'};
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

const FeatureGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 20px;
	margin-bottom: 30px;
`;

const FeatureCard = styled.div`
	background: white;
	border-radius: 8px;
	padding: 20px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const FeatureTitle = styled.h3`
	color: #2c2c2c;
	font-size: 18px;
	font-weight: 600;
	margin-bottom: 12px;
`;

const FeatureDescription = styled.p`
	color: #666;
	font-size: 14px;
	line-height: 1.5;
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

const SmartContractDemo = () => {
	const { isConnected } = useAccount();
	const { contractAddresses } = useContracts();
	const [activeTab, setActiveTab] = useState('overview');
	const [selectedProperty, setSelectedProperty] = useState(null);

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'booking', label: 'Book Property' },
		{ id: 'management', label: 'My Bookings' },
	];

	return (
		<DemoContainer>
			<Header>
				<Title>Blockchain Integration Demo</Title>
				<WalletSection>
					<WalletStatus />
				</WalletSection>
			</Header>

			<TabContainer>
				<TabList>
					{tabs.map(tab => (
						<Tab
							key={tab.id}
							active={activeTab === tab.id}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.label}
						</Tab>
					))}
				</TabList>

				{/* Overview Tab */}
				<TabContent active={activeTab === 'overview'}>


					<DemoSection>
						<SectionTitle>Contract Information</SectionTitle>
						<ContractInfo>
							<InfoTitle>Deployed Contracts (Viction Testnet)</InfoTitle>
							<InfoText>
								<strong>Booking Manager:</strong> {contractAddresses.victionTestnet.bookingManager}
							</InfoText>
							<InfoText>
								<strong>Property Marketplace:</strong> {contractAddresses.victionTestnet.propertyMarketplace}
							</InfoText>
						</ContractInfo>
						
						<ContractInfo>
							<InfoTitle>Network Requirements</InfoTitle>
							<InfoText>• Network: Viction Testnet</InfoText>
							<InfoText>• Chain ID: 89</InfoText>
							<InfoText>• RPC URL: https://rpc-testnet.viction.xyz</InfoText>
							<InfoText>• Block Explorer: https://testnet.vicscan.xyz</InfoText>
						</ContractInfo>
					</DemoSection>
				</TabContent>

				{/* Booking Tab */}
				<TabContent active={activeTab === 'booking'}>
					<DemoSection>
						<SectionTitle>Book a Property</SectionTitle>
						<SectionDescription>
							Select an available property and book a stay.
						</SectionDescription>
						
						{!isConnected ? (
							<div style={{ textAlign: 'center', padding: '40px' }}>
								<p>Please connect your wallet to book a property.</p>
							</div>
						) : (
							<>
								<PropertySelector 
									onPropertySelected={(property) => {
										setSelectedProperty(property);
									}}
								/>
								
								{selectedProperty && (
									<BookingForm 
										property={selectedProperty}
										onBookingCreated={(txHash) => {
											console.log('Booking created:', txHash);
											setActiveTab('management');
										}}
									/>
								)}
							</>
						)}
					</DemoSection>
				</TabContent>

				{/* Management Tab */}
				<TabContent active={activeTab === 'management'}>
					<DemoSection>
						<SectionTitle>Manage Your Bookings</SectionTitle>
						<SectionDescription>
							View and manage all your bookings. Perform actions like check-in, cancel bookings, or resolve disputes based on your role and booking status.
						</SectionDescription>
						
						{!isConnected ? (
							<div style={{ textAlign: 'center', padding: '40px' }}>
								<p>Please connect your wallet to view your bookings.</p>
							</div>
						) : (
							<BookingManagement />
						)}
					</DemoSection>
				</TabContent>
			</TabContainer>
		</DemoContainer>
	);
};

export default SmartContractDemo; 