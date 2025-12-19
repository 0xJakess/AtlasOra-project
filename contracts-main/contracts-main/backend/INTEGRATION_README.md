# 🔗 Blockchain to Strapi CMS Integration

This backend service bridges the gap between your blockchain smart contracts and the Strapi CMS, automatically syncing blockchain events to your CMS database.

## 🎯 Overview

The integration consists of:

1. **Event Listener** - Monitors blockchain events in real-time
2. **IPFS Parser** - Fetches property metadata from IPFS
3. **Strapi Sync** - Creates/updates records in your Strapi CMS
4. **API Endpoints** - Provides blockchain functionality to your frontend

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Blockchain    │    │   Backend       │    │   Strapi CMS    │
│   Contracts     │───▶│   Service       │───▶│   Database      │
│                 │    │                 │    │                 │
│ • PropertyListed│    │ • Event Listener│    │ • Properties    │
│ • BookingCreated│    │ • IPFS Parser   │    │ • Bookings      │
│ • CheckedIn     │    │ • Strapi Sync   │    │ • Users         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd atlas/backend
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```bash
# Viction Testnet RPC URL
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz

# Relayer private key (for paying gas fees)
RELAYER_PRIVATE_KEY=your_relayer_private_key_here

# Server port (optional, defaults to 3000)
PORT=3000

# Strapi CMS Configuration
STRAPI_BASE_URL=http://localhost:1337
STRAPI_API_TOKEN=your_strapi_api_token_here
```

### 3. Get Strapi API Token

1. Log into your Strapi admin panel
2. Go to Settings → API Tokens
3. Create a new API token with full access
4. Copy the token to your `.env` file

### 4. Start the Service

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📡 Event Monitoring

The service automatically monitors these blockchain events:

### Property Events
- `PropertyListed` - Creates new property in Strapi
- `PropertyUpdated` - Updates property details
- `PropertyRemoved` - Marks property as inactive

### Booking Events
- `BookingCreated` - Creates new booking in Strapi
- `CheckedIn` - Updates booking status to "Active"
- `BookingCompleted` - Updates booking status to "Complete"
- `BookingCancelled` - Updates booking status to "Cancelled"

## 🔧 API Endpoints

### Health & Status
- `GET /health` - Backend health check
- `GET /api/events/status` - Event listener status

### Blockchain Operations
- `GET /api/nonce/:address` - Get user's nonce for meta-transactions
- `POST /api/properties/list` - List a property (gasless)
- `POST /api/bookings/create` - Create a booking (gasless)
- `GET /api/properties` - Get all properties from blockchain
- `GET /api/bookings/user/:address` - Get user's bookings

### Event Processing
- `POST /api/events/process` - Manually process events from specific blocks

## 🧪 Testing

Run the integration tests to verify everything is working:

```bash
npm test
```

This will test:
- ✅ Backend connectivity
- ✅ Strapi API access
- ✅ Event listener status
- ✅ Manual event processing
- ✅ Property creation in Strapi
- ✅ Booking creation in Strapi

## 📊 Data Flow

### Property Listing Flow

1. **Frontend** → User lists property with meta-transaction
2. **Backend** → Executes transaction on blockchain
3. **Blockchain** → Emits `PropertyListed` event
4. **Event Listener** → Detects event and fetches property data
5. **IPFS Parser** → Fetches property metadata from IPFS
6. **Strapi Sync** → Creates property record in CMS
7. **Frontend** → Property appears in Strapi admin

### Booking Flow

1. **Frontend** → User books property with meta-transaction
2. **Backend** → Executes transaction on blockchain
3. **Blockchain** → Emits `BookingCreated` event
4. **Event Listener** → Detects event and fetches booking data
5. **Strapi Sync** → Creates booking record in CMS
6. **Frontend** → Booking appears in Strapi admin

## 🔍 IPFS Integration

The service automatically fetches property metadata from IPFS URIs:

### Supported IPFS Gateways
- `https://ipfs.io/ipfs/`
- `https://gateway.pinata.cloud/ipfs/`
- `https://cloudflare-ipfs.com/ipfs/`
- `https://dweb.link/ipfs/`

### Property Metadata Structure

```json
{
  "title": "Beautiful Beach House",
  "description": "Stunning oceanfront property with amazing views",
  "address": "123 Beach Road, Malibu, CA",
  "location": "Malibu, California",
  "latitude": 34.0259,
  "longitude": -118.7798,
  "rooms": 3,
  "bathrooms": 2,
  "size": "2000 sq ft",
  "maxGuests": 6,
  "cleaningFee": 150,
  "rating": 5,
  "images": ["ipfs://QmImage1", "ipfs://QmImage2"],
  "amenities": ["WiFi", "Kitchen", "Pool", "Parking"]
}
```

## 🛠️ Customization

### Adding New Event Types

1. Add event handler in `event-listener.js`:

```javascript
async handleNewEvent(args) {
    const [param1, param2] = args;
    console.log(`🆕 New Event: ${param1}, ${param2}`);
    
    // Add your custom logic here
    await this.createCustomRecordInStrapi({
        param1,
        param2
    });
}
```

2. Register the handler in `setupEventListeners()`:

```javascript
this.contracts.yourContract.on('NewEvent', (...args) => {
    this.handleNewEvent(args);
});
```

### Custom Strapi Field Mapping

Modify the data transformation in the event handlers:

```javascript
// In createPropertyInStrapi()
const strapiData = {
    Title: propertyData.title,
    FormattedAddress: propertyData.address,
    // Add your custom field mappings here
    CustomField: propertyData.customValue
};
```

## 🔒 Security Considerations

### API Token Security
- Store Strapi API tokens securely
- Use environment variables
- Rotate tokens regularly
- Use least-privilege access

### Blockchain Security
- Never commit private keys to version control
- Use separate relayer accounts for different environments
- Monitor gas costs and transaction success rates

### Network Security
- Use HTTPS in production
- Implement rate limiting
- Add authentication for sensitive endpoints
- Monitor for suspicious activity

## 📈 Monitoring & Logging

### Key Metrics to Monitor
- Event processing success rate
- Strapi API response times
- IPFS gateway availability
- Gas costs for meta-transactions
- Database sync status

### Log Levels
- `INFO` - Normal operations
- `WARN` - Non-critical issues
- `ERROR` - Critical failures
- `DEBUG` - Detailed debugging info

## 🚨 Troubleshooting

### Common Issues

#### Event Listener Not Starting
```bash
# Check if contracts are deployed
curl http://localhost:3000/health

# Check event listener status
curl http://localhost:3000/api/events/status
```

#### Strapi Connection Failed
```bash
# Verify Strapi is running
curl http://localhost:1337/api/properties

# Check API token
echo $STRAPI_API_TOKEN
```

#### IPFS Data Not Loading
```bash
# Test IPFS gateway
curl https://ipfs.io/ipfs/QmYourCID

# Check IPFS URI format
echo "ipfs://QmYourCID"
```

### Debug Mode

Enable debug logging by setting the log level:

```bash
DEBUG=* npm run dev
```

## 🔄 Deployment

### Production Setup

1. **Environment Variables**
```bash
NODE_ENV=production
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
RELAYER_PRIVATE_KEY=your_production_private_key
STRAPI_BASE_URL=https://your-strapi-domain.com
STRAPI_API_TOKEN=your_production_api_token
PORT=3000
```

2. **Process Management**
```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name "blockchain-backend"

# Using Docker
docker build -t blockchain-backend .
docker run -d --name blockchain-backend blockchain-backend
```

3. **Reverse Proxy**
```nginx
# Nginx configuration
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📞 Support

If you encounter issues:

1. **Check the logs** - All errors are logged with details
2. **Run tests** - Use `npm test` to verify connectivity
3. **Verify configuration** - Ensure all environment variables are set
4. **Check network status** - Verify blockchain and Strapi connectivity

## 🎉 Success!

Your blockchain events are now automatically syncing to your Strapi CMS! 

- ✅ Properties listed on blockchain appear in Strapi
- ✅ Bookings created on blockchain sync to CMS
- ✅ All data is real-time and consistent
- ✅ Gasless transactions for better UX
- ✅ IPFS metadata integration
- ✅ Comprehensive error handling and logging

The integration provides a seamless bridge between your decentralized blockchain system and your centralized CMS, giving you the best of both worlds! 🚀 