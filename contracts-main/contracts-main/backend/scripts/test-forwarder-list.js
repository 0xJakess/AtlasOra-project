#!/usr/bin/env node

const axios = require('axios');
const { ethers } = require('ethers');

(async () => {
	try {
		const BACKEND = process.env.BACKEND_URL || 'http://localhost:3000';
		const TEST_USER_PK = process.env.TEST_USER_PK;
		if (!TEST_USER_PK || !/^0x[0-9a-fA-F]{64}$/.test(TEST_USER_PK)) {
			console.error('Missing TEST_USER_PK (0x-prefixed) in env');
			process.exit(1);
		}
		const wallet = new ethers.Wallet(TEST_USER_PK);
		const userAddress = await wallet.getAddress();

		// 1) Get typed-data for listing
		const propertyData = {
			uri: 'ipfs://QmTestProperty1',
			pricePerNight: '0.15',
			tokenName: 'Test Property Token',
			tokenSymbol: 'TPT',
		};
		const tdRes = await axios.post(`${BACKEND}/api/properties/list/typed-data`, {
			userAddress,
			propertyData,
		});
		const { metaTx, typedData } = tdRes.data;

		// 2) Sign typed-data
		const domain = typedData.domain; // { name, version, chainId, verifyingContract }
		const types = typedData.types; // MetaTransaction schema
		const message = {
			from: metaTx.from,
			to: metaTx.to,
			value: BigInt(metaTx.value),
			data: metaTx.data,
			nonce: BigInt(metaTx.nonce),
			deadline: BigInt(metaTx.deadline),
		};
		const signature = await wallet.signTypedData(domain, types, message);
		console.log('Signed meta-tx for listing. From:', userAddress);

		// 3) Execute via backend
		const execRes = await axios.post(`${BACKEND}/api/properties/list`, {
			userAddress,
			signature,
			propertyData,
		});
		console.log('Execution response:', execRes.data);
		process.exit(0);
	} catch (err) {
		console.error('Test failed:', err.response?.data || err.message);
		process.exit(1);
	}
})(); 