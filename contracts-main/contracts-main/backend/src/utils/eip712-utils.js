// EIP-712 Utilities for Meta-Transactions
const { ethers } = require("ethers");

async function getForwarderNonceSafe(forwarder, userAddress) {
	try {
		const fwdAddr = await forwarder.getAddress();
		console.log(`[EIP712] getNonce via ABI for ${fwdAddr}, user ${userAddress}`);
		const nonce = await forwarder.getNonce(userAddress);
		return nonce;
	} catch (err) {
		console.warn(`[EIP712] getNonce ABI call failed: ${err?.message || err}`);
		try {
			console.log(`[EIP712] Trying direct mapping getter nonces(address)`);
			const mappingNonce = await forwarder.nonces(userAddress);
			return mappingNonce;
		} catch (err2) {
			console.warn(`[EIP712] nonces(address) call failed: ${err2?.message || err2}`);
			// Fallback 2: raw provider call
			const iface = new ethers.Interface([
				"function getNonce(address) view returns (uint256)",
			]);
			const to = await forwarder.getAddress();
			const data = iface.encodeFunctionData("getNonce", [userAddress]);
			console.log(`[EIP712] Raw call to ${to} getNonce(address)`);
			const raw = await forwarder.runner.provider.call({ to, data });
			if (!raw || raw === "0x") {
				console.warn(
					`[EIP712] getNonce raw call returned empty for ${to}. Treating as 0. This may indicate RPC or address issue.`
				);
				return 0n;
			}
			const [decoded] = iface.decodeFunctionResult("getNonce", raw);
			return decoded;
		}
	}
}

/**
 * Build meta-transaction payload for booking a property (no signing)
 * @param {string} userAddress - Address of the user initiating the meta-tx
 * @param {Object} bookingData - { propertyId, checkInDate, checkOutDate }
 * @param {ethers.Contract} bookingManager - BookingManager contract instance (connected to provider)
 * @param {ethers.Contract} forwarder - MetaTransactionForwarder contract instance (connected to provider)
 * @param {number} chainId - Chain ID for EIP-712 domain
 * @param {number} deadline - Deadline timestamp (unix seconds)
 * @returns {Promise<Object>} metaTx fields ready to be signed and executed
 */
async function buildBookingMetaTx(
	userAddress,
	bookingData,
	bookingManager,
	forwarder,
	chainId,
    deadline
) {
	const { propertyId, checkInDate, checkOutDate } = bookingData;
    
	// Get current nonce from forwarder for user
	const nonce = await getForwarderNonceSafe(forwarder, userAddress);
    
	// Determine total amount based on price per night and nights
    const propertyMarketplaceAddress = await bookingManager.propertyMarketplace();
	// We only need the interface to encode; avoid extra RPC calls for token data
	const bookingDataEncoded = bookingManager.interface.encodeFunctionData("createBooking", [
		propertyId,
		checkInDate,
		checkOutDate,
	]);

	// Fetch pricePerNight to compute value to send
	// Use a minimal interface to avoid importing full ABI here
	const propertyMarketplaceInterface = new ethers.Interface([
		"function properties(string) view returns (string propertyId, address tokenAddress, address owner, uint256 pricePerNight, bool isActive, string propertyURI)"
	]);
	const propertyMarketplace = new ethers.Contract(
		propertyMarketplaceAddress,
		propertyMarketplaceInterface,
		bookingManager.runner // same provider/signer context
	);
    const property = await propertyMarketplace.properties(propertyId);
	const pricePerNight = property[3];
    const numNights = Math.floor((checkOutDate - checkInDate) / (24 * 60 * 60));
    const totalAmount = pricePerNight * BigInt(numNights);
    
    return {
        from: userAddress,
		to: await bookingManager.getAddress(),
        value: totalAmount,
		data: bookingDataEncoded,
        nonce: nonce,
        deadline: deadline,
		chainId: chainId,
    };
}

/**
 * Build meta-transaction payload for listing a property (no signing)
 * @param {string} userAddress - Address of the user initiating the meta-tx
 * @param {Object} propertyData - { uri, pricePerNight, tokenName, tokenSymbol }
 * @param {ethers.Contract} propertyMarketplace - PropertyMarketplace contract instance (connected to provider)
 * @param {ethers.Contract} forwarder - MetaTransactionForwarder contract instance (connected to provider)
 * @param {number} chainId - Chain ID for EIP-712 domain
 * @param {number} deadline - Deadline timestamp (unix seconds)
 * @returns {Promise<Object>} metaTx fields ready to be signed and executed
 */
async function buildListPropertyMetaTx(
	userAddress,
	propertyData,
	propertyMarketplace,
	forwarder,
	chainId,
    deadline
) {
	const { uri, pricePerNight, tokenName, tokenSymbol } = propertyData;
    
	// Get current nonce from forwarder for user
	const nonce = await getForwarderNonceSafe(forwarder, userAddress);
    
	// Encode listProperty call
    const data = propertyMarketplace.interface.encodeFunctionData("listProperty", [
		uri,
        pricePerNight,
        tokenName,
		tokenSymbol,
    ]);
    
    return {
        from: userAddress,
		to: await propertyMarketplace.getAddress(),
        value: 0,
        data: data,
        nonce: nonce,
        deadline: deadline,
		chainId: chainId,
    };
}

/**
 * Execute a meta-transaction using the forwarder
 * @param {Object} metaTx - { from, to, value, data, nonce, deadline, signature }
 * @param {ethers.Contract} forwarder - MetaTransactionForwarder contract instance (connected)
 * @param {ethers.Signer} relayerSigner - Signer paying gas
 * @returns {Promise<Object>} result { transactionHash, receipt, gasUsed, effectiveGasPrice }
 */
async function executeMetaTransaction(metaTx, forwarder, relayerSigner) {
    // Use manual gas settings to avoid estimation issues
	const gasLimit = 3_000_000; // 3M

	// Try to set a sane gas price if provider supports it; otherwise rely on provider defaults
	let overrides = { gasLimit, value: metaTx.value };
	try {
		const feeData = await forwarder.runner.provider.getFeeData();
		if (feeData.gasPrice) {
			overrides.gasPrice = feeData.gasPrice;
		}
	} catch (_) {
		// ignore fee estimation failures
	}
    
    const tx = await forwarder.connect(relayerSigner).executeMetaTransaction(
        metaTx.from,
        metaTx.to,
        metaTx.value,
        metaTx.data,
        metaTx.deadline,
        metaTx.signature,
		overrides
    );
    
    const receipt = await tx.wait();
    return {
        transactionHash: tx.hash,
        receipt: receipt,
        gasUsed: receipt.gasUsed,
		effectiveGasPrice: receipt.effectiveGasPrice,
    };
}

/**
 * Simulate a meta-transaction to capture precise revert reasons before sending
 * @param {Object} metaTx - { from, to, value, data, nonce, deadline, signature }
 * @param {ethers.Contract} forwarder - MetaTransactionForwarder contract instance
 * @param {ethers.JsonRpcProvider} provider - Provider to use for the call
 */
async function simulateMetaTransaction(metaTx, forwarder, provider) {
	try {
		const forwarderAddress = await forwarder.getAddress();
		const iface = forwarder.interface;
		const callData = iface.encodeFunctionData('executeMetaTransaction', [
			metaTx.from,
			metaTx.to,
			metaTx.value,
			metaTx.data,
			metaTx.deadline,
			metaTx.signature || '0x',
		]);
		await provider.call({ to: forwarderAddress, data: callData, value: metaTx.value });
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err?.shortMessage || err?.message || String(err) };
	}
}

module.exports = {
	getForwarderNonceSafe,
	buildBookingMetaTx,
	buildListPropertyMetaTx,
	executeMetaTransaction,
	simulateMetaTransaction,
}; 