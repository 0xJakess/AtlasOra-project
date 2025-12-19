const axios = require('axios');
require('dotenv').config();

class IdempotencyTest {
	constructor() {
		this.strapiConfig = {
			baseURL: process.env.STRAPI_BASE_URL || 'http://localhost:1337',
			apiToken: process.env.STRAPI_API_TOKEN,
			timeout: 10000
		};
	}

	async testPropertyIdempotency() {
		console.log('\n🧪 Testing Property Idempotency...');
		
		const testProperty = {
			Title: 'Idempotency Test Property - ' + Date.now(),
			FormattedAddress: '123 Idempotency St, Test City',
			PricePerNight: 150.00,
			Rooms: 2,
			Bathrooms: 1,
			Size: '1200 sq ft',
			PurchasePrice: 0,
			Latitude: 40.7128,
			Longitude: -74.0060,
			Featured: false,
			CurrentlyRented: false,
			Stars: 5,
			MaxGuests: 4,
			CleaningFee: 50,
			AtlasFees: 0.5,
			Description: 'Test property for idempotency testing',
			Location: 'Test City, Test Country',
			PhoneNumber: '123-456-7890'
		};

		try {
			// First creation
			console.log('📝 Creating property for the first time...');
			const response1 = await axios.post(
				`${this.strapiConfig.baseURL}/api/properties`,
				{ data: testProperty },
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			const propertyId = response1.data.data.id;
			console.log(`✅ Property created successfully: ${propertyId}`);

			// Second creation attempt (should be prevented by idempotency)
			console.log('📝 Attempting to create the same property again...');
			const response2 = await axios.post(
				`${this.strapiConfig.baseURL}/api/properties`,
				{ data: testProperty },
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			console.log(`✅ Second creation result: ${response2.data.data.id}`);
			
			// Check if they're the same
			if (response1.data.data.id === response2.data.data.id) {
				console.log('✅ Idempotency working: Same property ID returned');
			} else {
				console.log('❌ Idempotency failed: Different property IDs returned');
			}

			// Cleanup
			await axios.delete(
				`${this.strapiConfig.baseURL}/api/properties/${propertyId}`,
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			console.log('🧹 Test property cleaned up');

		} catch (error) {
			if (error.response?.data?.error?.message?.includes('unique')) {
				console.log('✅ Idempotency working: Duplicate creation prevented by unique constraint');
			} else {
				console.error('❌ Error during property idempotency test:', error.response?.data || error.message);
			}
		}
	}

	async testBookingIdempotency() {
		console.log('\n🧪 Testing Booking Idempotency...');
		
		// First create a property for the booking
		const testProperty = {
			Title: 'Booking Idempotency Test Property - ' + Date.now(),
			FormattedAddress: '456 Booking St, Test City',
			PricePerNight: 200.00,
			Rooms: 3,
			Bathrooms: 2,
			Size: '1500 sq ft',
			PurchasePrice: 0,
			Latitude: 40.7128,
			Longitude: -74.0060,
			Featured: false,
			CurrentlyRented: false,
			Stars: 5,
			MaxGuests: 6,
			CleaningFee: 75,
			AtlasFees: 0.5,
			Description: 'Test property for booking idempotency testing',
			Location: 'Test City, Test Country',
			PhoneNumber: '123-456-7890'
		};

		try {
			// Create property
			const propertyResponse = await axios.post(
				`${this.strapiConfig.baseURL}/api/properties`,
				{ data: testProperty },
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			const propertyId = propertyResponse.data.data.id;
			console.log(`✅ Test property created: ${propertyId}`);

			const testBooking = {
				property: propertyId,
				StartDate: '2024-01-15',
				EndDate: '2024-01-20',
				Guests: 4,
				Rooms: 2,
				PriceperNight: 200,
				NumberOfNights: 5,
				AtlasFee: 10,
				CleaningFee: 75,
				TotalPaid: 1085,
				PaidBy: 'ETH',
				BookingStatus: 'Upcoming'
			};

			// First booking creation
			console.log('📝 Creating booking for the first time...');
			const response1 = await axios.post(
				`${this.strapiConfig.baseURL}/api/proeprty-bookings`,
				{ data: testBooking },
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			const bookingId = response1.data.data.id;
			console.log(`✅ Booking created successfully: ${bookingId}`);

			// Second booking creation attempt (should be prevented by oneToOne relationship)
			console.log('📝 Attempting to create another booking for the same property...');
			try {
				const response2 = await axios.post(
					`${this.strapiConfig.baseURL}/api/proeprty-bookings`,
					{ data: testBooking },
					{
						headers: {
							'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
							'Content-Type': 'application/json'
						},
						timeout: this.strapiConfig.timeout
					}
				);
				
				console.log(`✅ Second booking created: ${response2.data.data.id}`);
				
			} catch (error) {
				if (error.response?.data?.error?.message?.includes('unique')) {
					console.log('✅ Idempotency working: Second booking prevented by unique constraint');
				} else {
					console.log('⚠️  Second booking creation failed:', error.response?.data?.error?.message || error.message);
				}
			}

			// Cleanup
			await axios.delete(
				`${this.strapiConfig.baseURL}/api/proeprty-bookings/${bookingId}`,
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			await axios.delete(
				`${this.strapiConfig.baseURL}/api/properties/${propertyId}`,
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			console.log('🧹 Test booking and property cleaned up');

		} catch (error) {
			console.error('❌ Error during booking idempotency test:', error.response?.data || error.message);
		}
	}

	async runAllTests() {
		console.log('🚀 Starting Idempotency Tests...\n');
		
		await this.testPropertyIdempotency();
		await this.testBookingIdempotency();
		
		console.log('\n🎉 Idempotency tests completed!');
	}
}

// Run tests
const test = new IdempotencyTest();
test.runAllTests().catch(console.error); 