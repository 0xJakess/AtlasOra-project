import React, { useEffect } from 'react';
import { useConnect, useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSafeRedirectPath } from 'library/helpers/navigation';
import { config } from 'context/WalletProvider';
import styled from 'styled-components';

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

const StyledConnectButton = styled.button`
	width: 100%;
	height: 48px;
	border-radius: 8px;
	font-weight: 600;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	border: none;
	color: white;
	transition: all 0.3s ease;
	cursor: pointer;
	margin-bottom: 16px;
	
	&:hover {
		background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
		transform: translateY(-1px);
	}
`;

function getChainName(chainId) {
	const chain = config.chains.find((c) => c.id === chainId);
	return chain ? chain.name : '';
}

const WalletConnectButton = ({ label = "Connect Wallet" }) => {
	const { connect, connectors, isPending } = useConnect();
	const { isConnected, address } = useAccount();
	const { disconnect } = useDisconnect();
	const chainId = useChainId();
	const { switchChain, isPending: isSwitchPending } = useSwitchChain();
	const location = useLocation();
	const navigate = useNavigate();

	// Force switch to Base Sepolia if connected to wrong network
	useEffect(() => {
		if (isConnected && chainId && chainId !== baseSepolia.id) {
			switchChain({ chainId: baseSepolia.id });
		}
	}, [isConnected, chainId, switchChain]);

	// Handle redirect after successful connection (only when address is set and on Base Sepolia)
	useEffect(() => {
		if (isConnected && address && chainId === baseSepolia.id) {
			const redirectPath = location.state?.from || '/';
			const safeRedirectPath = getSafeRedirectPath(redirectPath, '/');
			navigate(safeRedirectPath, { replace: true });
		}
	}, [isConnected, address, chainId, location.state?.from, navigate]);

	if (isConnected && address) {
		// Show switching message if not on Base Sepolia
		if (chainId !== baseSepolia.id) {
			return (
				<StyledConnectButton disabled>
					{isSwitchPending ? 'Switching to Base Sepolia...' : 'Please switch to Base Sepolia'}
				</StyledConnectButton>
			);
		}

		return (
			<StyledConnectButton onClick={() => disconnect()}>
				{address.slice(0, 6)}...{address.slice(-4)}
				<span style={{ marginLeft: 8, fontSize: 13, color: '#e0e0e0' }}>
					(Base Sepolia)
				</span>
			</StyledConnectButton>
		);
	}

	return (
		<StyledConnectButton 
			onClick={() => connect({ connector: connectors[0] })}
			disabled={isPending}
		>
			{isPending ? 'Connecting...' : label}
		</StyledConnectButton>
	);
};

export default WalletConnectButton; 