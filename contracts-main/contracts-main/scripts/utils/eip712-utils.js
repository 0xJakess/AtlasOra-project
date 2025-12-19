// EIP-712 Utilities for Meta-Transactions
const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Generate EIP-712 signature for meta-transaction
 * @param {string} from - The address that will sign the transaction
 * @param {string} to - The target contract address
 * @param {string} value - The amount of ETH to send (in wei)
 * @param {string} data - The function call data (hex string)
 * @param {number} nonce - The current nonce for the from address
 * @param {number} deadline - The deadline timestamp
 * @param {string} domainSeparator - The domain separator from the forwarder contract
 * @param {string} typeHash - The type hash for MetaTransaction
 * @param {ethers.Signer} signer - The signer to use
 * @returns {string} - The signature
 */
async function generateMetaTransactionSignature(
    from,
    to,
    value,
    data,
    nonce,
    deadline,
    forwarderAddress,
    chainId,
    typeHash,
    signer
) {
    console.log("[EIP712] Nonce:", nonce);
    console.log("[EIP712] From:", from);
    console.log("[EIP712] To:", to);
    console.log("[EIP712] Value:", value);
    console.log("[EIP712] Data:", data);
    console.log("[EIP712] Deadline:", deadline);
    console.log("[EIP712] TypeHash:", typeHash);

    // Use signTypedData for proper EIP-712 signature
    const domain = {
        name: "PropertyRental",
        version: "1",
        chainId: chainId,
        verifyingContract: forwarderAddress
    };
    
    const types = {
        MetaTransaction: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" }
        ]
    };
    
    const message = {
        from: from,
        to: to,
        value: value,
        data: data,
        nonce: nonce,
        deadline: deadline
    };
    
    const signature = await signer.signTypedData(domain, types, message);
    return signature;
}

/**
 * Create a meta-transaction for booking a property
 * @param {string} propertyId - The property ID to book
 * @param {number} checkInDate - Check-in date timestamp
 * @param {number} checkOutDate - Check-out date timestamp
 * @param {string} bookingManagerAddress - The BookingManager contract address
 * @param {string} forwarderAddress - The MetaTransactionForwarder address
 * @param {ethers.Signer} userSigner - The user's signer
 * @param {number} deadline - Transaction deadline
 * @returns {Object} - Meta-transaction data
 */
async function createBookingMetaTransaction(
    propertyId,
    checkInDate,
    checkOutDate,
    bookingManagerAddress,
    forwarderAddress,
    userSigner,
    deadline
) {
    const userAddress = await userSigner.getAddress();
    
    // Get the BookingManager contract
    const BookingManager = await hre.ethers.getContractFactory("BookingManager");
    const bookingManager = BookingManager.attach(bookingManagerAddress);
    
    // Get the MetaTransactionForwarder contract
    const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
    const forwarder = MetaTransactionForwarder.attach(forwarderAddress);
    
    // Get current nonce
    const nonce = await forwarder.getNonce(userAddress);
    
    // Get domain separator and type hash
    const domainSeparator = await forwarder.getDomainSeparator();
    const typeHash = await forwarder.getMetaTransactionTypeHash();
    
    // Get property price to calculate total amount
    const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
    const propertyMarketplaceAddress = await bookingManager.propertyMarketplace();
    const propertyMarketplace = PropertyMarketplace.attach(propertyMarketplaceAddress);
    
    const property = await propertyMarketplace.properties(propertyId);
    const pricePerNight = property[3]; // pricePerNight is at index 3
    
    // Calculate number of nights and total amount
    const numNights = Math.floor((checkOutDate - checkInDate) / (24 * 60 * 60));
    const totalAmount = pricePerNight * BigInt(numNights);
    
    // Encode the createBooking function call
    const data = bookingManager.interface.encodeFunctionData("createBooking", [
        propertyId,
        checkInDate,
        checkOutDate
    ]);
    
    // Generate signature
    const signature = await generateMetaTransactionSignature(
        userAddress,
        bookingManagerAddress,
        totalAmount,
        data,
        nonce,
        deadline,
        forwarderAddress,
        hre.network.config.chainId,
        typeHash,
        userSigner
    );
    
    return {
        from: userAddress,
        to: bookingManagerAddress,
        value: totalAmount,
        data: data,
        nonce: nonce,
        deadline: deadline,
        signature: signature,
        totalAmount: totalAmount,
        numNights: numNights
    };
}

/**
 * Create a meta-transaction for listing a property
 * @param {string} propertyURI - IPFS URI for property details
 * @param {string} pricePerNight - Price per night in wei
 * @param {string} tokenName - Name for the property token
 * @param {string} tokenSymbol - Symbol for the property token
 * @param {string} propertyMarketplaceAddress - The PropertyMarketplace contract address
 * @param {string} forwarderAddress - The MetaTransactionForwarder address
 * @param {ethers.Signer} userSigner - The user's signer
 * @param {number} deadline - Transaction deadline
 * @returns {Object} - Meta-transaction data
 */
async function createListPropertyMetaTransaction(
    propertyURI,
    pricePerNight,
    tokenName,
    tokenSymbol,
    propertyMarketplaceAddress,
    forwarderAddress,
    userSigner,
    deadline
) {
    const userAddress = await userSigner.getAddress();
    
    // Get the PropertyMarketplace contract
    const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
    const propertyMarketplace = PropertyMarketplace.attach(propertyMarketplaceAddress);
    
    // Get the MetaTransactionForwarder contract
    const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
    const forwarder = MetaTransactionForwarder.attach(forwarderAddress);
    
    // Get current nonce
    const nonce = await forwarder.getNonce(userAddress);
    
    // Get domain separator and type hash
    const domainSeparator = await forwarder.getDomainSeparator();
    const typeHash = await forwarder.getMetaTransactionTypeHash();
    
    // Encode the listProperty function call
    const data = propertyMarketplace.interface.encodeFunctionData("listProperty", [
        propertyURI,
        pricePerNight,
        tokenName,
        tokenSymbol
    ]);
    
    // Generate signature
    const signature = await generateMetaTransactionSignature(
        userAddress,
        propertyMarketplaceAddress,
        0, // No value needed for listing
        data,
        nonce,
        deadline,
        forwarderAddress,
        hre.network.config.chainId,
        typeHash,
        userSigner
    );
    
    return {
        from: userAddress,
        to: propertyMarketplaceAddress,
        value: 0,
        data: data,
        nonce: nonce,
        deadline: deadline,
        signature: signature
    };
}

/**
 * Execute a meta-transaction using the forwarder
 * @param {Object} metaTx - The meta-transaction object
 * @param {string} forwarderAddress - The MetaTransactionForwarder address
 * @param {ethers.Signer} relayerSigner - The relayer's signer (pays for gas)
 * @returns {Object} - Transaction result
 */
async function executeMetaTransaction(metaTx, forwarderAddress, relayerSigner) {
    const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
    const forwarder = MetaTransactionForwarder.attach(forwarderAddress);
    
    // Use manual gas settings to avoid estimation issues
    const gasLimit = 3000000; // 3M gas limit
    // Use appropriate gas price based on network
    const gasPrice = hre.network.name === "victionTestnet" 
        ? hre.ethers.parseUnits("0.25", "gwei")
        : hre.ethers.parseUnits("1", "gwei");
    
    const tx = await forwarder.connect(relayerSigner).executeMetaTransaction(
        metaTx.from,
        metaTx.to,
        metaTx.value,
        metaTx.data,
        metaTx.deadline,
        metaTx.signature,
        { 
            value: metaTx.value,
            gasLimit: gasLimit,
            gasPrice: gasPrice
        }
    );
    
    const receipt = await tx.wait();
    return {
        transactionHash: tx.hash,
        receipt: receipt,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice
    };
}

// Helper to get the correct domain separator for EIP-712
function getDomainSeparator(forwarderAddress, chainId) {
	return ethers.keccak256(
		ethers.AbiCoder.defaultAbiCoder().encode(
			[
				"bytes32",
				"bytes32",
				"bytes32",
				"uint256",
				"address"
			],
			[
				ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
				ethers.keccak256(ethers.toUtf8Bytes("PropertyRental")),
				ethers.keccak256(ethers.toUtf8Bytes("1")),
				chainId,
				forwarderAddress
			]
		)
	);
}

module.exports = {
    generateMetaTransactionSignature,
    createBookingMetaTransaction,
    createListPropertyMetaTransaction,
    executeMetaTransaction
}; 