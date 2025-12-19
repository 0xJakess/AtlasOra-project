const axios = require('axios');
require('dotenv').config();

class BasicIntegrationTester {
	constructor() {
		this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
		this.strapiUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
		this.strapiToken = process.env.STRAPI_API_TOKEN;
	}

	/**
	 * Test backend health (without blockchain dependency)
	 */
	async testBackendHealth() {
		console.log('🔍 Testing backend health...');
		
		try {
			const response = await axios.get(`${this.backendUrl}/health`);
			console.log('✅ Backend is healthy:', response.data);
			return true;
		} catch (error) {
			console.error('❌ Backend health check failed:', error.message);
			return false;
		}
	}

	/**
	 * Test Strapi connectivity
	 */
	async testStrapiConnectivity() {
		console.log('🔍 Testing Strapi connectivity...');
		
		if (!this.strapiToken) {
			console.error('❌ STRAPI_API_TOKEN not configured');
			return false;
		}
		
		try {
			const response = await axios.get(`${this.strapiUrl}/api/properties`, {
				headers: {
					'Authorization': `Bearer ${this.strapiToken}`
				}
			});
			console.log('✅ Strapi is accessible');
			console.log(`📊 Found ${response.data.data?.length || 0} properties in Strapi`);
			return true;
		} catch (error) {
			console.error('❌ Strapi connectivity failed:', error.response?.data || error.message);
			return false;
		}
	}

	/**
	 * Test property creation in Strapi (without blockchain data)
	 */
	async testPropertyCreation() {
		console.log('🔍 Testing property creation in Strapi...');
		
		if (!this.strapiToken) {
			console.error('❌ STRAPI_API_TOKEN not configured');
			return false;
		}
		
		try {
			const testProperty = {
				data: {
					Title: 'Test Property from Integration - ' + Date.now(), // Make it unique
					FormattedAddress: '123 Test St, Test City',
					PricePerNight: 100.50,
					Rooms: 2,
					Bathrooms: 1,
					Size: '1000 sq ft',
					PurchasePrice: 0,
					Latitude: 40.7128,
					Longitude: -74.0060,
					Featured: false,
					CurrentlyRented: false,
					Stars: 5,
					MaxGuests: 4,
					CleaningFee: 50,
					AtlasFees: 0.5,
					Description: 'Test property created during integration testing',
					Location: 'Test City, Test Country',
					PhoneNumber: '123-456-7890'
				}
			};
			
			const response = await axios.post(`${this.strapiUrl}/api/properties`, testProperty, {
				headers: {
					'Authorization': `Bearer ${this.strapiToken}`,
					'Content-Type': 'application/json'
				}
			});
			
			console.log('✅ Test property created in Strapi:', response.data.data.id);
			
			// Clean up - delete the test property
			await axios.delete(`${this.strapiUrl}/api/properties/${response.data.data.id}`, {
				headers: {
					'Authorization': `Bearer ${this.strapiToken}`
				}
			});
			
			console.log('✅ Test property cleaned up');
			return true;
			
		} catch (error) {
			console.error('❌ Property creation test failed:', error.response?.data || error.message);
			return false;
		}
	}

	/**
	 * Test booking creation in Strapi (without blockchain data)
	 */
	async testBookingCreation() {
		console.log('🔍 Testing booking creation in Strapi...');
		
		if (!this.strapiToken) {
			console.error('❌ STRAPI_API_TOKEN not configured');
			return false;
		}
		
		try {
			// First, create a test property to link the booking to
			const testProperty = {
				data: {
					Title: 'Test Property for Booking - ' + Date.now(), // Make it unique
					FormattedAddress: '456 Test Ave, Test City',
					PricePerNight: 150.00,
					Rooms: 1,
					Bathrooms: 1,
					Size: '800 sq ft',
					PurchasePrice: 0,
					Latitude: 40.7589,
					Longitude: -73.9851,
					Featured: false,
					CurrentlyRented: false,
					Stars: 4,
					MaxGuests: 2,
					CleaningFee: 30,
					AtlasFees: 0.5,
					Description: 'Test property for booking integration',
					Location: 'Test City, Test Country',
					PhoneNumber: '987-654-3210'
				}
			};
			
			const propertyResponse = await axios.post(`${this.strapiUrl}/api/properties`, testProperty, {
				headers: {
					'Authorization': `Bearer ${this.strapiToken}`,
					'Content-Type': 'application/json'
				}
			});
			
			const propertyId = propertyResponse.data.data.id;
			
			// Create test booking
			const testBooking = {
				data: {
					property: propertyId,
					StartDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
					EndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
					Guests: 2,
					Rooms: 1,
					PriceperNight: 150.00,
					NumberOfNights: 3,
					AtlasFee: 15.00,
					CleaningFee: 30,
					TotalPaid: 495.00,
					PaidBy: 'ETH',
					BookingStatus: 'Upcoming'
				}
			};
			
			const bookingResponse = await axios.post(`${this.strapiUrl}/api/proeprty-bookings`, testBooking, {
				headers: {
					'Authorization': `Bearer ${this.strapiToken}`,
					'Content-Type': 'application/json'
				}
			});
			
			console.log('✅ Test booking created in Strapi:', bookingResponse.data.data.id);
			
			// Clean up - delete both test property and booking
			await axios.delete(`${this.strapiUrl}/api/proeprty-bookings/${bookingResponse.data.data.id}`, {
				headers: {
					'Authorization': `Bearer ${this.strapiToken}`
				}
			});
			
			await axios.delete(`${this.strapiUrl}/api/properties/${propertyId}`, {
				headers: {
					'Authorization': `Bearer ${this.strapiToken}`
				}
			});
			
			console.log('✅ Test booking and property cleaned up');
			return true;
			
		} catch (error) {
			console.error('❌ Booking creation test failed:', error.response?.data || error.message);
			return false;
		}
	}

	/**
	 * Test environment configuration
	 */
	async testEnvironmentConfig() {
		console.log('🔍 Testing environment configuration...');
		
		const requiredVars = [
			'STRAPI_BASE_URL',
			'STRAPI_API_TOKEN',
			'VICTION_TESTNET_RPC',
			'RELAYER_PRIVATE_KEY'
		];
		
		const missing = [];
		
		for (const varName of requiredVars) {
			if (!process.env[varName]) {
				missing.push(varName);
			}
		}
		
		if (missing.length > 0) {
			console.error('❌ Missing environment variables:', missing.join(', '));
			return false;
		}
		
		console.log('✅ All required environment variables are set');
		return true;
	}

	/**
	 * Run all basic tests
	 */
	async runAllTests() {
		console.log('🚀 Starting basic integration tests...\n');
		
		const tests = [
			{ name: 'Environment Configuration', test: () => this.testEnvironmentConfig() },
			{ name: 'Backend Health', test: () => this.testBackendHealth() },
			{ name: 'Strapi Connectivity', test: () => this.testStrapiConnectivity() },
			{ name: 'Property Creation', test: () => this.testPropertyCreation() },
			{ name: 'Booking Creation', test: () => this.testBookingCreation() }
		];
		
		const results = [];
		
		for (const test of tests) {
			console.log(`\n📋 Running: ${test.name}`);
			try {
				const result = await test.test();
				results.push({ name: test.name, passed: result });
			} catch (error) {
				console.error(`❌ Test failed with error:`, error.message);
				results.push({ name: test.name, passed: false, error: error.message });
			}
		}
		
		// Summary
		console.log('\n📊 Test Results Summary:');
		console.log('========================');
		
		const passed = results.filter(r => r.passed).length;
		const total = results.length;
		
		results.forEach(result => {
			const status = result.passed ? '✅ PASS' : '❌ FAIL';
			console.log(`${status} ${result.name}`);
			if (result.error) {
				console.log(`   Error: ${result.error}`);
			}
		});
		
		console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
		
		if (passed === total) {
			console.log('🎉 All basic tests passed! Core integration is working.');
			console.log('\n📝 Note: Blockchain connectivity tests were skipped due to RPC timeout.');
			console.log('   This is normal if the Viction testnet is experiencing issues.');
		} else {
			console.log('⚠️  Some tests failed. Please check the configuration and try again.');
		}
		
		return passed === total;
	}
}

// Run tests if called directly
if (require.main === module) {
	const tester = new BasicIntegrationTester();
	tester.runAllTests().catch(error => {
		console.error('❌ Test runner failed:', error);
		process.exit(1);
	});
}

module.exports = BasicIntegrationTester; 