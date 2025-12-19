const axios = require('axios');

/**
 * IPFSService - Service for pinning and retrieving content from IPFS via Pinata
 */
class IPFSService {
	constructor(config = {}) {
		this.jwt = config.jwt || process.env.PINATA_JWT;
		this.apiKey = config.apiKey || process.env.PINATA_API_KEY;
		this.apiSecret = config.apiSecret || process.env.PINATA_API_SECRET;
		this.gateway = config.gateway || process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
		this.pinataApiUrl = 'https://api.pinata.cloud';
	}

	/**
	 * Get authorization headers for Pinata API
	 * @returns {Object} Headers object
	 */
	getHeaders() {
		if (this.jwt) {
			return { Authorization: `Bearer ${this.jwt}` };
		}
		if (this.apiKey && this.apiSecret) {
			return {
				pinata_api_key: this.apiKey,
				pinata_secret_api_key: this.apiSecret,
			};
		}
		throw new Error('IPFS pinning not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET.');
	}

	/**
	 * Check if IPFS service is available
	 * @returns {boolean}
	 */
	isAvailable() {
		return !!(this.jwt || (this.apiKey && this.apiSecret));
	}

	/**
	 * Pin JSON data to IPFS
	 * @param {Object} data - The JSON data to pin
	 * @param {string} name - Name for the pinned content
	 * @returns {Object} { success, cid, uri }
	 */
	async pinJSON(data, name = 'atlas-metadata') {
		if (!this.isAvailable()) {
			throw new Error('IPFS service not configured');
		}

		const url = `${this.pinataApiUrl}/pinning/pinJSONToIPFS`;
		const body = {
			pinataOptions: { cidVersion: 1 },
			pinataMetadata: { name },
			pinataContent: data,
		};

		const response = await axios.post(url, body, {
			headers: this.getHeaders(),
			timeout: 30000,
		});

		const cid = response?.data?.IpfsHash;
		if (!cid) {
			throw new Error('Pinata did not return a CID');
		}

		return {
			success: true,
			cid,
			uri: `ipfs://${cid}`,
			gatewayUrl: `${this.gateway}/ipfs/${cid}`,
		};
	}

	/**
	 * Pin booking metadata to IPFS
	 * @param {Object} bookingData - Booking details
	 * @returns {Object} { success, cid, uri }
	 */
	async pinBookingMetadata(bookingData) {
		const metadata = {
			version: '1.0',
			type: 'atlas-booking',
			created: new Date().toISOString(),
			booking: {
				propertyId: bookingData.propertyId,
				checkInDate: bookingData.checkInDate,
				checkOutDate: bookingData.checkOutDate,
				numberOfNights: bookingData.numberOfNights,
				guests: bookingData.guests,
				rooms: bookingData.rooms || 1,
			},
			guest: {
				walletAddress: bookingData.guestWalletAddress,
				cmsUserId: bookingData.cmsUserId,
			},
			pricing: {
				pricePerNight: bookingData.pricePerNight,
				subtotal: bookingData.subtotal,
				platformFee: bookingData.platformFee,
				cleaningFee: bookingData.cleaningFee || 0,
				total: bookingData.totalAmount,
				currency: bookingData.currency || 'GBP',
			},
			payment: {
				method: 'credit_card',
				provider: 'revolut',
				reference: bookingData.paymentReference,
				status: 'completed',
				paidAt: bookingData.paidAt || new Date().toISOString(),
			},
			property: {
				cmsPropertyId: bookingData.cmsPropertyId,
				title: bookingData.propertyTitle,
				hostWallet: bookingData.hostWalletAddress,
			},
		};

		const name = `booking-${bookingData.paymentReference || Date.now()}`;
		return this.pinJSON(metadata, name);
	}

	/**
	 * Fetch content from IPFS
	 * @param {string} cid - The IPFS CID
	 * @returns {Object} The JSON content
	 */
	async fetchFromIPFS(cid) {
		// Remove ipfs:// prefix if present
		const cleanCid = cid.replace('ipfs://', '');
		const url = `${this.gateway}/ipfs/${cleanCid}`;

		const response = await axios.get(url, { timeout: 30000 });
		return response.data;
	}

	/**
	 * Unpin content from IPFS
	 * @param {string} cid - The IPFS CID to unpin
	 * @returns {Object} { success }
	 */
	async unpin(cid) {
		if (!this.isAvailable()) {
			throw new Error('IPFS service not configured');
		}

		const cleanCid = cid.replace('ipfs://', '');
		const url = `${this.pinataApiUrl}/pinning/unpin/${cleanCid}`;

		await axios.delete(url, {
			headers: this.getHeaders(),
			timeout: 30000,
		});

		return { success: true };
	}
}

module.exports = IPFSService;
