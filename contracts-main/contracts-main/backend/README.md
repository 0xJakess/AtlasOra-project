# Property Rental Backend Server

A complete Express.js backend server for the Property Rental System with meta-transactions support.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Viction Testnet RPC access
- Relayer private key (for paying gas fees)

### Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the backend directory:
   ```bash
   # Required
   VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
   RELAYER_PRIVATE_KEY=your_relayer_private_key_here
   
   # Optional
   PORT=3000
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

## 📡 API Endpoints

### Health Check
```http
GET /health
```
Returns server status and contract addresses.

**Response:**
```json
{
  "status": "healthy",
  "network": "viction-testnet",
  "contracts": {
    "PropertyMarketplace": "0xC26151CCB9f88273149FDD2E22d562D1FA3aBF49",
    "BookingManager": "0xBB70120EC9FBf6eef0BC15126b6D5A3B31f7B38B",
    "MetaTransactionForwarder": "0xD98147BC05362630e2cDAcC57ABB962951Eec293"
  }
}
```

### Get User Nonce
```http
GET /api/nonce/:address
```
Get the current nonce for a user address (required for meta-transactions).

**Response:**
```json
{
  "nonce": "0"
}
```

### List Property (Gasless)
```http
POST /api/properties/list
```
List a new property using meta-transactions (user doesn't pay gas).

**Request Body:**
```json
{
  "userAddress": "0x1234567890123456789012345678901234567890",
  "signature": "0x...",
  "propertyData": {
    "uri": "ipfs://QmPropertyDetails",
    "pricePerNight": "0.15",
    "tokenName": "Beach House Token",
    "tokenSymbol": "BHT"
  }
}
```

**Response:**
```json
{
  "success": true,
  "propertyId": "PROP1",
  "transactionHash": "0x..."
}
```

### Book Property (Gasless)
```http
POST /api/bookings/create
```
Book a property using meta-transactions (user doesn't pay gas).

**Request Body:**
```json
{
  "userAddress": "0x1234567890123456789012345678901234567890",
  "signature": "0x...",
  "bookingData": {
    "propertyId": "PROP1",
    "checkInDate": 1703123456,
    "checkOutDate": 1703209856
  }
}
```

**Response:**
```json
{
  "success": true,
  "bookingId": "1",
  "transactionHash": "0x..."
}
```

### Get All Properties
```http
GET /api/properties
```
Get all properties from the blockchain.

**Response:**
```json
[
  {
    "propertyId": "PROP1",
    "tokenAddress": "0x...",
    "owner": "0x...",
    "pricePerNight": "150000000000000000",
    "isActive": true,
    "propertyURI": "ipfs://QmPropertyDetails"
  }
]
```

### Get User Bookings
```http
GET /api/bookings/user/:address
```
Get all bookings for a specific user.

**Response:**
```json
[
  {
    "bookingId": "1",
    "propertyId": "PROP1",
    "guest": "0x...",
    "checkInDate": "1703123456",
    "checkOutDate": "1703209856",
    "totalAmount": "450000000000000000",
    "status": "0"
  }
]
```

## 🧪 Testing

### Run Endpoint Tests
```bash
node test-endpoints.js
```

This will test all API endpoints and provide a summary of results.

### Manual Testing with curl

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Get Nonce:**
```bash
curl http://localhost:3000/api/nonce/0x1234567890123456789012345678901234567890
```

**Get Properties:**
```bash
curl http://localhost:3000/api/properties
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VICTION_TESTNET_RPC` | Viction Testnet RPC URL | Yes | - |
| `RELAYER_PRIVATE_KEY` | Private key for relayer account | Yes | - |
| `PORT` | Server port | No | 3000 |

### Contract Addresses

The backend automatically loads contract addresses from the deployment file:
- `../deployment-all-viction-testnet.json`

Current deployed addresses:
- **PropertyMarketplace**: `0xC26151CCB9f88273149FDD2E22d562D1FA3aBF49`
- **BookingManager**: `0xBB70120EC9FBf6eef0BC15126b6D5A3B31f7B38B`
- **MetaTransactionForwarder**: `0xD98147BC05362630e2cDAcC57ABB962951Eec293`

## 🔒 Security Features

- **Meta-transactions**: Users don't need ETH for gas fees
- **EIP-712 Signatures**: Secure, typed signature verification
- **Nonce Management**: Prevents replay attacks
- **Input Validation**: Comprehensive parameter validation
- **Error Handling**: Graceful error responses

## 📊 Logging

The server provides detailed console logging for:
- API requests and responses
- Blockchain transactions
- Error conditions
- Meta-transaction execution

## 🚨 Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `500`: Internal Server Error

Error responses include descriptive messages:
```json
{
  "error": "Missing required fields"
}
```

## 🔄 Meta-Transaction Flow

1. **Frontend** creates EIP-712 signature for user action
2. **Backend** receives signature and user data
3. **Backend** creates meta-transaction with user's signature
4. **Backend** executes transaction on blockchain (pays gas)
5. **Backend** returns transaction result to frontend

## 📈 Monitoring

Monitor the backend with:
- Health check endpoint
- Console logs
- Transaction success/failure rates
- Gas usage tracking

## 🚀 Production Deployment

For production deployment:

1. **Set up environment variables**
2. **Use a process manager** (PM2, Docker, etc.)
3. **Set up monitoring** and logging
4. **Configure CORS** for your frontend domain
5. **Use HTTPS** in production
6. **Monitor relayer balance** and gas costs

## 🔗 Related Files

- `../scripts/utils/eip712-utils.js` - Meta-transaction utilities
- `../scripts/events/event-listener.js` - Blockchain event monitoring
- `../contracts/` - Smart contract source code
- `../deployment-all-viction-testnet.json` - Deployment information

## 🤝 Support

For issues or questions:
1. Check the console logs for error details
2. Verify environment variables are set correctly
3. Ensure contracts are deployed and accessible
4. Test with the provided test script 