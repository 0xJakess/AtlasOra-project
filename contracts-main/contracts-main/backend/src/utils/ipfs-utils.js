const axios = require('axios');

class IPFSUtils {
	constructor() {
		this.gateways = [
			'https://ipfs.io/ipfs/',
			'https://gateway.pinata.cloud/ipfs/',
			'https://cloudflare-ipfs.com/ipfs/',
			'https://dweb.link/ipfs/'
		];
	}

	/**
	 * Parse IPFS URI and extract CID
	 */
	parseIPFSUri(uri) {
		if (!uri) return null;
		
		// Handle different IPFS URI formats
		if (uri.startsWith('ipfs://')) {
			return uri.replace('ipfs://', '').replace(/^\//, '').trim();
		}
		
		if (uri.startsWith('https://ipfs.io/ipfs/')) {
			return uri.replace('https://ipfs.io/ipfs/', '').replace(/^\//, '').trim();
		}
		
		// Bare CID (v0 or v1)
		const trimmed = uri.trim().replace(/^\//, '');
		if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed)) return trimmed; // CIDv0
		if (/^[bB][a-zA-Z2-7]{58}$/.test(trimmed)) return trimmed; // CIDv1 (base32)
		
		return null;
	}

	/**
	 * Fetch data from IPFS using multiple gateways
	 */
	async fetchFromIPFS(cid) {
		if (!cid) {
			throw new Error('Invalid CID provided');
		}

		for (const gateway of this.gateways) {
			try {
				const url = `${gateway}${cid}`;
				console.log(`🔍 Trying IPFS gateway: ${url}`);
				
				const response = await axios.get(url, {
					timeout: 5000,
					headers: {
						'Accept': 'application/json'
					}
				});
				
				if (response.data) {
					console.log(`✅ Successfully fetched from IPFS: ${gateway}`);
					return response.data;
				}
			} catch (error) {
				console.log(`❌ Failed to fetch from ${gateway}: ${error.message}`);
				continue;
			}
		}
		
		throw new Error('Failed to fetch data from all IPFS gateways');
	}

	/**
	 * Parse property details from IPFS URI
	 */
	async parsePropertyURI(propertyURI) {
		try {
			const cid = this.parseIPFSUri(propertyURI);
			
			if (!cid) {
				console.log('⚠️  Invalid IPFS URI, using default values');
				return this.getDefaultPropertyDetails();
			}
			
			const propertyData = await this.fetchFromIPFS(cid);
			
			// Transform IPFS data to match Strapi schema
			return {
				title: propertyData.title || propertyData.name || 'Property from Blockchain',
				address: propertyData.address || propertyData.location || 'Address not available',
				description: propertyData.description || 'Property description not available',
				rooms: propertyData.rooms || propertyData.bedrooms || 2,
				bathrooms: propertyData.bathrooms || 1,
				size: propertyData.size || propertyData.squareFeet || '1000 sq ft',
				latitude: propertyData.latitude || propertyData.lat || 0,
				longitude: propertyData.longitude || propertyData.lng || 0,
				location: propertyData.location || propertyData.city || 'Location not available',
				phoneNumber: propertyData.phoneNumber || propertyData.contact || 'Not provided',
				maxGuests: propertyData.maxGuests || propertyData.capacity || 4,
				cleaningFee: propertyData.cleaningFee || 50,
				rating: propertyData.rating || 5,
				images: propertyData.images || [],
				amenities: propertyData.amenities || []
			};
			
		} catch (error) {
			console.error('❌ Error parsing property URI:', error.message);
			return this.getDefaultPropertyDetails();
		}
	}

	/**
	 * Get default property details when IPFS data is unavailable
	 */
	getDefaultPropertyDetails() {
		return {
			title: 'Property from Blockchain',
			address: 'Address from IPFS',
			description: 'Property description from IPFS metadata',
			rooms: 2,
			bathrooms: 1,
			size: '1000 sq ft',
			latitude: 0,
			longitude: 0,
			location: 'Location from IPFS',
			phoneNumber: 'Not provided',
			maxGuests: 4,
			cleaningFee: 50,
			rating: 5,
			images: [],
			amenities: []
		};
	}

	/**
	 * Create a sample IPFS metadata structure
	 */
	createSamplePropertyMetadata(propertyData) {
		return {
			title: propertyData.title || 'Sample Property',
			name: propertyData.title || 'Sample Property',
			description: propertyData.description || 'A beautiful property available for rent',
			address: propertyData.address || '123 Main St, City, Country',
			location: propertyData.location || 'City, Country',
			latitude: propertyData.latitude || 40.7128,
			longitude: propertyData.longitude || -74.0060,
			lat: propertyData.latitude || 40.7128,
			lng: propertyData.longitude || -74.0060,
			rooms: propertyData.rooms || 2,
			bedrooms: propertyData.rooms || 2,
			bathrooms: propertyData.bathrooms || 1,
			size: propertyData.size || '1000 sq ft',
			squareFeet: propertyData.size || '1000 sq ft',
			maxGuests: propertyData.maxGuests || 4,
			capacity: propertyData.maxGuests || 4,
			cleaningFee: propertyData.cleaningFee || 50,
			rating: propertyData.rating || 5,
			phoneNumber: propertyData.phoneNumber || 'Not provided',
			contact: propertyData.phoneNumber || 'Not provided',
			images: propertyData.images || [],
			amenities: propertyData.amenities || [
				'WiFi',
				'Kitchen',
				'Parking',
				'Air Conditioning'
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
	}
}

module.exports = IPFSUtils; 