const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

class BackendTester {
    constructor() {
        this.testResults = [];
    }

    async testHealth() {
        console.log('🏥 Testing health endpoint...');
        try {
            const response = await axios.get(`${BASE_URL}/health`);
            console.log('✅ Health check passed:', response.data);
            return true;
        } catch (error) {
            console.log('❌ Health check failed:', error.message);
            return false;
        }
    }

    async testGetNonce() {
        console.log('\n🔢 Testing nonce endpoint...');
        try {
            const testAddress = '0x1234567890123456789012345678901234567890';
            const response = await axios.get(`${BASE_URL}/api/nonce/${testAddress}`);
            console.log('✅ Nonce retrieved:', response.data);
            return true;
        } catch (error) {
            console.log('❌ Nonce retrieval failed:', error.message);
            return false;
        }
    }

    async testGetProperties() {
        console.log('\n🏠 Testing get properties endpoint...');
        try {
            const response = await axios.get(`${BASE_URL}/api/properties`);
            console.log('✅ Properties retrieved:', response.data);
            return true;
        } catch (error) {
            console.log('❌ Properties retrieval failed:', error.message);
            return false;
        }
    }

    async testGetUserBookings() {
        console.log('\n📅 Testing get user bookings endpoint...');
        try {
            const testAddress = '0x1234567890123456789012345678901234567890';
            const response = await axios.get(`${BASE_URL}/api/bookings/user/${testAddress}`);
            console.log('✅ User bookings retrieved:', response.data);
            return true;
        } catch (error) {
            console.log('❌ User bookings retrieval failed:', error.message);
            return false;
        }
    }

    async testListProperty() {
        console.log('\n📝 Testing list property endpoint...');
        try {
            const testData = {
                userAddress: '0x1234567890123456789012345678901234567890',
                signature: '0x' + '1'.repeat(130), // Mock signature
                propertyData: {
                    uri: 'ipfs://QmTestProperty1',
                    pricePerNight: '0.15',
                    tokenName: 'Test Property Token',
                    tokenSymbol: 'TPT'
                }
            };

            const response = await axios.post(`${BASE_URL}/api/properties/list`, testData);
            console.log('✅ Property listing response:', response.data);
            return true;
        } catch (error) {
            console.log('❌ Property listing failed:', error.response?.data || error.message);
            return false;
        }
    }

    async testBookProperty() {
        console.log('\n📅 Testing book property endpoint...');
        try {
            const testData = {
                userAddress: '0x1234567890123456789012345678901234567890',
                signature: '0x' + '1'.repeat(130), // Mock signature
                bookingData: {
                    propertyId: 'PROP1',
                    checkInDate: Math.floor(Date.now() / 1000) + 86400 * 7, // 1 week from now
                    checkOutDate: Math.floor(Date.now() / 1000) + 86400 * 10 // 10 days from now
                }
            };

            const response = await axios.post(`${BASE_URL}/api/bookings/create`, testData);
            console.log('✅ Property booking response:', response.data);
            return true;
        } catch (error) {
            console.log('❌ Property booking failed:', error.response?.data || error.message);
            return false;
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Backend Endpoint Tests');
        console.log('==================================');
        console.log(`📍 Testing against: ${BASE_URL}`);
        console.log('');

        const tests = [
            { name: 'Health Check', test: () => this.testHealth() },
            { name: 'Get Nonce', test: () => this.testGetNonce() },
            { name: 'Get Properties', test: () => this.testGetProperties() },
            { name: 'Get User Bookings', test: () => this.testGetUserBookings() },
            { name: 'List Property', test: () => this.testListProperty() },
            { name: 'Book Property', test: () => this.testBookProperty() }
        ];

        let passed = 0;
        let failed = 0;

        for (const test of tests) {
            const result = await test.test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        }

        console.log('\n📊 Test Results Summary');
        console.log('======================');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

        if (failed === 0) {
            console.log('\n🎉 All tests passed! Backend is ready for production.');
        } else {
            console.log('\n⚠️  Some tests failed. Check the backend logs for details.');
        }

        return { passed, failed };
    }
}

// Main execution
async function main() {
    const tester = new BackendTester();
    await tester.runAllTests();
}

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = BackendTester; 