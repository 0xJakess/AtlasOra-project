import React, { useEffect } from 'react';
import { useConnect, useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
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

const WalletStatusButton = styled.button`
	height: 40px;
	border-radius: 20px;
	font-size: 14px;
	font-weight: 500;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	border: none;
	color: white;
	padding: 0 16px;
	cursor: pointer;
	
	&:hover {
		background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
	}
`;

function getChainName(chainId) {
	const chain = config.chains.find((c) => c.id === chainId);
	return chain ? chain.name : '';
}

const WalletStatus = () => {
	const { connect, connectors, isPending } = useConnect();
	const { isConnected, address } = useAccount();
	const { disconnect } = useDisconnect();
	const chainId = useChainId();
	const { switchChain, isPending: isSwitchPending } = useSwitchChain();

	// Force switch to Base Sepolia if connected to wrong network
	useEffect(() => {
		if (isConnected && chainId && chainId !== baseSepolia.id) {
			switchChain({ chainId: baseSepolia.id });
		}
	}, [isConnected, chainId, switchChain]);

	if (!isConnected) {
		return (
			<WalletStatusButton
				onClick={() => connect({ connector: connectors[0] })}
				disabled={isPending}
			>
				{isPending ? 'Connecting...' : 'Connect Wallet'}
			</WalletStatusButton>
		);
	}

	// Show switching message if not on Base Sepolia
	if (chainId !== baseSepolia.id) {
		return (
			<WalletStatusButton disabled>
				{isSwitchPending ? 'Switching...' : 'Wrong Network'}
			</WalletStatusButton>
		);
	}

	return (
		<WalletStatusButton onClick={() => disconnect()}>
			{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Wallet'}
			<span style={{ marginLeft: 8, fontSize: 13, color: '#e0e0e0' }}>
				(Base Sepolia)
			</span>
		</WalletStatusButton>
	);
};

export default WalletStatus; 