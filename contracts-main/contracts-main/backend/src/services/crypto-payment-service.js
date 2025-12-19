const { ethers } = require('ethers');

/**
 * CryptoPaymentService - Handles EURC payment flow via custodial wallets
 *
 * Flow:
 * 1. User initiates EURC payment -> get their custodial wallet address
 * 2. User sends EURC to their custodial wallet (via QR scan or manual transfer from ANY wallet)
 * 3. Service monitors for incoming EURC
 * 4. Once confirmed, trigger meta-transaction to create on-chain booking with escrow
 */
class CryptoPaymentService {
	constructor(config = {}) {
		this.provider = config.provider;

		// EURC token contract
		this.eurcToken = config.eurcToken || null;
		this.eurcTokenAddress = config.eurcTokenAddress || process.env.EURC_TOKEN_ADDRESS;

		// Pending payments storage (in production, use Redis or database)
		this.pendingPayments = new Map();

		// Track payments currently being processed to prevent duplicate processing
		this.processingPayments = new Set();

		// Payment ID counter (in production, use database sequence)
		this.paymentIdCounter = Math.floor(Math.random() * 1000000);

		// Polling interval for payment monitoring (ms)
		this.pollInterval = config.pollInterval || 5000;

		// Payment confirmation threshold (blocks)
		this.confirmationBlocks = config.confirmationBlocks || 1;

		// Payment expiry time (ms) - 30 minutes default
		this.paymentExpiry = config.paymentExpiry || 30 * 60 * 1000;

		// Callback when EURC payment is confirmed
		this.onEURCPaymentConfirmed = config.onEURCPaymentConfirmed || null;

		// Monitoring state
		this.isMonitoring = false;
		this.monitorInterval = null;
	}

	/**
	 * Set the EURC token contract
	 */
	setEURCToken(eurcToken) {
		this.eurcToken = eurcToken;
		console.log('💶 CryptoPaymentService: EURC token configured');
	}

	/**
	 * Initialize an EURC payment session using user's custodial wallet
	 * User sends EURC to their custodial wallet, then we trigger meta-tx to create booking
	 * @returns {Object} Payment session with custodial wallet address and QR data
	 */
	async initializeEURCPayment(params) {
		const {
			userId,
			propertyId,
			checkInDate,
			checkOutDate,
			totalAmountEURC, // Amount in EURC base units (6 decimals)
			custodialWalletAddress, // User's custodial wallet address
			metadata = {},
		} = params;

		if (!this.eurcToken && !this.eurcTokenAddress) {
			throw new Error('EURC token not configured');
		}

		if (!custodialWalletAddress) {
			throw new Error('Custodial wallet address required for EURC payment');
		}

		// Cancel any existing pending payments for the same user+property (user changed dates)
		for (const [existingId, existingPayment] of this.pendingPayments) {
			if (
				existingPayment.userId === userId &&
				existingPayment.propertyId === propertyId &&
				['pending'].includes(existingPayment.status)
			) {
				console.log(`🔄 Cancelling old payment #${existingId} - user started new payment for same property`);
				existingPayment.status = 'cancelled';
			}
		}

		// Generate unique payment ID
		const paymentId = ++this.paymentIdCounter;

		// Calculate expected amount with tolerance (allow 0.1% slippage)
		const expectedAmount = BigInt(totalAmountEURC);
		const minAmount = expectedAmount - (expectedAmount / 1000n);

		// Create pending payment record
		const pendingPayment = {
			paymentId,
			userId,
			propertyId,
			checkInDate,
			checkOutDate,
			paymentAddress: custodialWalletAddress,
			expectedAmountBase: expectedAmount.toString(),
			minAmountBase: minAmount.toString(),
			metadata,
			status: 'pending',
			paymentType: 'eurc',
			createdAt: Date.now(),
			expiresAt: Date.now() + this.paymentExpiry,
			transactionHash: null,
			blockNumber: null,
			receivedAmountBase: null,
		};

		// Store pending payment
		this.pendingPayments.set(paymentId, pendingPayment);

		// Generate QR code data for ERC-20 transfer to custodial wallet
		// Format: ethereum:{tokenAddress}/transfer?address={recipient}&uint256={amount}
		const chainId = (await this.provider.getNetwork()).chainId;
		const tokenAddress = this.eurcTokenAddress || await this.eurcToken.getAddress();
		const qrData = `ethereum:${tokenAddress}/transfer?address=${custodialWalletAddress}&uint256=${expectedAmount.toString()}`;

		// Human readable amount (6 decimals for EURC)
		const formattedAmount = ethers.formatUnits(expectedAmount, 6);

		console.log(`💶 EURC payment initialized: #${paymentId}`);
		console.log(`   Custodial wallet: ${custodialWalletAddress}`);
		console.log(`   Amount: ${formattedAmount} EURC`);

		// Start monitoring if not already running
		this.startMonitoring();

		return {
			paymentId,
			paymentAddress: custodialWalletAddress,
			expectedAmountBase: expectedAmount.toString(),
			expectedAmountEURC: formattedAmount,
			tokenAddress,
			qrData,
			expiresAt: pendingPayment.expiresAt,
			chainId: Number(chainId),
			paymentType: 'eurc',
		};
	}

	/**
	 * Get payment status
	 */
	getPaymentStatus(paymentId) {
		const payment = this.pendingPayments.get(paymentId);
		if (!payment) {
			return null;
		}

		return {
			paymentId: payment.paymentId,
			status: payment.status,
			paymentAddress: payment.paymentAddress,
			expectedAmountBase: payment.expectedAmountBase,
			expectedAmountEURC: payment.expectedAmountBase ? ethers.formatUnits(payment.expectedAmountBase, 6) : null,
			receivedAmountBase: payment.receivedAmountBase,
			receivedAmountEURC: payment.receivedAmountBase ? ethers.formatUnits(payment.receivedAmountBase, 6) : null,
			transactionHash: payment.transactionHash,
			bookingId: payment.bookingId,
			bookingTxHash: payment.bookingTxHash,
			expiresAt: payment.expiresAt,
			isExpired: Date.now() > payment.expiresAt && payment.status === 'pending',
		};
	}

	/**
	 * Start monitoring for incoming payments
	 */
	startMonitoring() {
		if (this.isMonitoring) {
			return;
		}

		this.isMonitoring = true;
		console.log('👀 Started monitoring for crypto payments');

		this.monitorInterval = setInterval(() => {
			this.checkPendingPayments();
		}, this.pollInterval);
	}

	/**
	 * Stop monitoring
	 */
	stopMonitoring() {
		if (this.monitorInterval) {
			clearInterval(this.monitorInterval);
			this.monitorInterval = null;
		}
		this.isMonitoring = false;
		console.log('⏹️ Stopped monitoring for crypto payments');
	}

	/**
	 * Check all pending payments for incoming transactions
	 */
	async checkPendingPayments() {
		const now = Date.now();

		for (const [paymentId, payment] of this.pendingPayments) {
			// Skip if already being processed (prevent duplicate processing)
			if (this.processingPayments.has(paymentId)) {
				continue;
			}

			// Process confirming payments (waiting for block confirmations)
			if (payment.status === 'confirming') {
				try {
					await this.processConfirmedPayment(paymentId);
				} catch (error) {
					console.error(`Error processing confirming payment #${paymentId}:`, error.message);
				}
				continue;
			}

			// Skip non-pending payments
			if (payment.status !== 'pending') {
				continue;
			}

			// Check for expiry
			if (now > payment.expiresAt) {
				payment.status = 'expired';
				console.log(`⏰ Payment #${paymentId} expired`);
				continue;
			}

			try {
				await this.checkEURCPayment(paymentId, payment);
			} catch (error) {
				console.error(`Error checking payment #${paymentId}:`, error.message);
			}
		}

		// Clean up old completed/expired payments (keep for 1 hour)
		const cleanupThreshold = now - 60 * 60 * 1000;
		for (const [paymentId, payment] of this.pendingPayments) {
			if (
				(payment.status === 'completed' || payment.status === 'expired') &&
				payment.createdAt < cleanupThreshold
			) {
				this.pendingPayments.delete(paymentId);
			}
		}
	}

	/**
	 * Check for EURC payment in custodial wallet
	 * When sufficient balance is detected, trigger the booking via meta-transaction
	 */
	async checkEURCPayment(paymentId, payment) {
		if (!this.eurcToken) {
			console.warn(`⚠️ Cannot check EURC payment #${paymentId}: EURC token not configured`);
			return;
		}

		// Skip if already being processed
		if (this.processingPayments.has(paymentId)) {
			return;
		}

		const balance = await this.eurcToken.balanceOf(payment.paymentAddress);
		const minAmount = BigInt(payment.minAmountBase);

		if (balance >= minAmount) {
			console.log(`💶 EURC received in custodial wallet for #${paymentId}: ${ethers.formatUnits(balance, 6)} EURC`);

			// Update payment status
			payment.status = 'confirming';
			payment.receivedAmountBase = balance.toString();
			payment.blockNumber = await this.provider.getBlockNumber();

			// Process with await to ensure sequential processing
			await this.processConfirmedPayment(paymentId);
		}
	}

	/**
	 * Process a confirmed payment
	 */
	async processConfirmedPayment(paymentId) {
		const payment = this.pendingPayments.get(paymentId);
		if (!payment) {
			return;
		}

		// Check if already being processed (prevent duplicate processing)
		if (this.processingPayments.has(paymentId)) {
			return;
		}

		try {
			// Wait for confirmations
			if (payment.blockNumber) {
				const currentBlock = await this.provider.getBlockNumber();
				const confirmations = currentBlock - payment.blockNumber;

				if (confirmations < this.confirmationBlocks) {
					console.log(`⏳ Payment #${paymentId} waiting for confirmations (${confirmations}/${this.confirmationBlocks})`);
					// Will be processed on next poll
					return;
				}
			}

			// Mark as being processed BEFORE any async work
			this.processingPayments.add(paymentId);

			console.log(`✅ Payment #${paymentId} confirmed, processing...`);
			payment.status = 'processing';

			if (this.onEURCPaymentConfirmed) {
				const result = await this.onEURCPaymentConfirmed(payment);

				if (result.success) {
					payment.status = 'completed';
					payment.bookingId = result.bookingId;
					payment.bookingTxHash = result.transactionHash;
					console.log(`🎉 Payment #${paymentId} completed, booking ID: ${result.bookingId}`);
				} else {
					payment.status = 'failed';
					payment.error = result.error;
					console.error(`❌ Payment #${paymentId} processing failed:`, result.error);
				}
			}
		} catch (error) {
			payment.status = 'failed';
			payment.error = error.message;
			console.error(`❌ Error processing payment #${paymentId}:`, error);
		} finally {
			// Always remove from processing set when done
			this.processingPayments.delete(paymentId);
		}
	}

	/**
	 * Cancel a pending payment
	 */
	cancelPayment(paymentId) {
		const payment = this.pendingPayments.get(paymentId);
		if (!payment) {
			return { success: false, error: 'Payment not found' };
		}

		if (payment.status !== 'pending') {
			return { success: false, error: `Cannot cancel payment in ${payment.status} status` };
		}

		payment.status = 'cancelled';
		return { success: true };
	}

	/**
	 * Get all pending payments (for admin/debug)
	 */
	getAllPendingPayments() {
		const payments = [];
		for (const [paymentId, payment] of this.pendingPayments) {
			payments.push({
				paymentId,
				status: payment.status,
				userId: payment.userId,
				propertyId: payment.propertyId,
				paymentAddress: payment.paymentAddress,
				expectedAmountEURC: payment.expectedAmountBase ? ethers.formatUnits(payment.expectedAmountBase, 6) : null,
				receivedAmountEURC: payment.receivedAmountBase ? ethers.formatUnits(payment.receivedAmountBase, 6) : null,
				createdAt: payment.createdAt,
				expiresAt: payment.expiresAt,
			});
		}
		return payments;
	}

	/**
	 * Check if service is ready
	 */
	isReady() {
		return !!this.provider && !!this.eurcToken;
	}
}

module.exports = CryptoPaymentService;
