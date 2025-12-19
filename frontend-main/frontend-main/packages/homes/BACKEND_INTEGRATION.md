## Backend Integration (Homes)

### What it does
- **Gasless listing**: User signs an EIP‑712 payload in the browser; the backend relays a meta‑transaction to list a property on‑chain.
- **Booking UI**: User selects a property from Strapi, picks dates, and either pays via wallet (direct on‑chain) or scans a QR to pay manually. The UI reads bookings from Strapi, not directly from the blockchain.
- **Reconciliation**: Backend event listener syncs blockchain events (properties, bookings) into Strapi; a manual reconcile endpoint also exists.

### Key components
- **Frontend (homes)**
  - `containers/BackendIntegration/BackendIntegration.jsx`: Tabs for Overview, List Property, Book Property, and Reconcile.
  - `components/Booking/PropertySelector.jsx`: Reads properties and bookings from Strapi for the booking UI.
  - `context/ContractProvider.jsx`: Provides `createBooking` (direct wallet booking flow used by the UI button).
  - `context/AuthProvider.jsx`: Supplies Strapi user JWT if logged in; otherwise the app can use a static Strapi API token for reads.
- **Backend**
  - `atlas/backend/src/server.js`: Express server exposing typed‑data and execution endpoints, chain read endpoints, and reconciliation.
  - `atlas/backend/src/services/event-listener.js`: Watches chain events and creates/updates Strapi entries.
- **Strapi CMS**
  - `admin/src/api/property/*`: Property content type (`properties`).
  - `admin/src/api/proeprty-booking/*`: Booking content type (`proeprty-bookings`).
  - `admin/src/extensions/users-permissions/content-types/user/schema.json`: Adds `walletAddress` to user, used to label owners/guests.

## Flows

### List Property (gasless via backend)
- Frontend flow (in `BackendIntegration.jsx → BackendListPropertyForm`):
  1. POST `POST {VITE_BACKEND_BASE_URL}/api/properties/list/typed-data` with `{ userAddress, propertyData }` to get EIP‑712 typed data.
  2. User signs the typed data in wallet.
  3. POST `POST {VITE_BACKEND_BASE_URL}/api/properties/list` with `{ userAddress, signature, propertyData, meta: { deadline } }`.
  4. Backend relays the meta‑tx to `MetaTransactionForwarder` → `PropertyMarketplace`. Returns `{ propertyId, transactionHash }`.
  5. Event listener ingests events and writes a published `property` entry in Strapi.

- Backend details (`atlas/backend/src/server.js`):
  - `POST /api/properties/list/typed-data`
  - `POST /api/properties/list`
  - Uses `RELAYER_PRIVATE_KEY` to sign/relay.

### Book Property (current UI)
- Property list comes from Strapi in the booking tab (not from the chain directly).
- User selects dates; the UI:
  - Prepares a QR (EIP‑681) and shows a "Pay with MetaMask" button.
  - "Pay with MetaMask" calls `createBooking` (direct wallet call, not typed‑data yet).
- Bookings shown under the selected property come from Strapi (`proeprty-bookings`), filtered by the selected Strapi property id.
- Total amount is computed client‑side from Strapi fields:
  - If `PaidBy` is `ETH` and `TotalPaid` is set (micro‑ETH), convert to wei.
  - Else compute `(PriceperNight × NumberOfNights) + AtlasFee + CleaningFee` (micro‑ETH → wei).
  - Fallback to on‑chain `pricePerNight × nights` if needed.

Notes:
- The backend also exposes booking typed‑data endpoints (`/api/bookings/create/typed-data`, `/api/bookings/create`) but the UI currently uses a direct wallet call for the payment action.

### Reconcile (chain → Strapi)
- Button triggers `POST {VITE_BACKEND_BASE_URL}/api/reconcile`.
- Event listener ensures all on‑chain properties exist in Strapi; optionally ensures bookings for a given user.
- The "Reconcile" tab compares chain data (from backend) vs Strapi lists (admin API reads).

## Frontend behavior (homes)

### Properties (reads)
- Source: Strapi `GET {VITE_APP_API_URL}properties?populate=*`.
- If `VITE_APP_API_TOKEN` or a logged‑in Strapi JWT is present, the app adds `publicationState=preview` to read drafts.
- Response shapes supported:
  - Strapi v4 style: `{ data: [{ id, attributes: { Title, PricePerNight, ... } }] }`
  - Flattened style: `{ data: [{ id, Title, PricePerNight, ... }] }`
- The component derives `propertyId` from the end of `Title` (e.g., "Property from Blockchain PROP3" → `PROP3`).

### Bookings (reads)
- Source: Strapi `GET {VITE_APP_API_URL}proeprty-bookings?
	publicationState=preview&pagination[pageSize]=100&populate[users_permissions_user]=true&populate[property]=true&filters[property][id][$eq]={strapiId}`
- Status mapping (Strapi → UI):
  - `Upcoming|Active` → Active (0)
  - `Complete` → Completed (3)
  - `Cancelled` → Cancelled (5)
- Amount calculation (client): micro‑ETH (in Strapi) → wei → formatted ETH.

### Environment variables (homes)
- `VITE_BACKEND_BASE_URL` (default: `http://localhost:3000`)
- `VITE_APP_API_URL` (e.g., `http://localhost:1337/api/`)
- `VITE_APP_ADMIN_URL` (e.g., `http://localhost:1337`)
- `VITE_APP_API_TOKEN` (optional; required to read drafts with `publicationState=preview`)

## Backend

### Endpoints (`atlas/backend/src/server.js`)
- Health & chain reads
  - `GET /health`
  - `GET /api/properties` (reads on‑chain `PropertyMarketplace`, enriches with Strapi user name if available)
  - `GET /api/bookings/user/:address` (on‑chain bookings; not used in the booking tab UI)
- Typed‑data and execution
  - `POST /api/properties/list/typed-data`
  - `POST /api/properties/list`
  - `POST /api/bookings/create/typed-data`
  - `POST /api/bookings/create`
- Event listener utilities
  - `GET /api/events/status`
  - `GET /api/events/idempotency`
  - `POST /api/events/reset-idempotency`
- Reconcile
  - `POST /api/reconcile`

### Environment variables (backend)
- `VICTION_TESTNET_RPC` (RPC endpoint)
- `RELAYER_PRIVATE_KEY` (0x‑prefixed private key; required for meta‑tx execution)
- `STRAPI_BASE_URL` (e.g., `http://localhost:1337`)
- `STRAPI_API_TOKEN` (token with write permissions)
- `CHAIN_ID` (optional; defaults to `89`)

## Strapi

### Content types
- `property` (`properties`): primary listing entity.
- `proeprty-booking` (`proeprty-bookings`): one‑to‑one to `property`, stores dates, guests, price in micro‑ETH, fees, status, and `users_permissions_user`.
- `users` (users‑permissions): has `walletAddress` field used by the backend for user lookups.

### Permissions
- For public reads without a token, publish entries or grant public read (for testing). Otherwise, provide `VITE_APP_API_TOKEN` and the app will add `publicationState=preview` to read drafts.

## Quick tests

### Strapi:
```bash
curl -H "Authorization: Bearer <STRAPI_API_TOKEN>" \
	"http://localhost:1337/api/properties?populate=*"

curl -H "Authorization: Bearer <STRAPI_API_TOKEN>" \
	"http://localhost:1337/api/proeprty-bookings?populate=*&filters[property][id][$eq]=<STRAPI_PROPERTY_ID>"
```

### Backend:
```bash
# Health
curl "http://localhost:3000/health"

# Chain properties (backend view)
curl "http://localhost:3000/api/properties"

# Reconcile chain → Strapi
curl -X POST "http://localhost:3000/api/reconcile" \
	-H "Content-Type: application/json" \
	-d '{"userAddress":"0xYourAddress"}'
```

## Troubleshooting
- **Empty property list in UI**
  - Ensure `VITE_APP_API_URL` includes `/api/` and a trailing slash.
  - Set `VITE_APP_API_TOKEN` (or publish Strapi entries) to avoid draft filtering issues.
  - Wallet must be connected to fetch in the booking tab.
- **Titles or fields appear missing**
  - We support both flattened and `attributes` JSON shapes and use `populate=*`.
- **Amounts show as 0**
  - Confirm `PaidBy` is `ETH` and `TotalPaid`/`PriceperNight`/fees are set. The UI converts micro‑ETH → wei; otherwise it falls back to on‑chain `pricePerNight × nights`.
- **Meta‑tx execution fails**
  - Check `RELAYER_PRIVATE_KEY` format (0x + 64 hex) and `VICTION_TESTNET_RPC`.

## Extending
- Wire the booking typed‑data flow to mirror gasless listing (`/api/bookings/create/typed-data` + `/api/bookings/create`).
- Store the blockchain bookingId in Strapi to simplify joins.
- Enhance reconciliation to attach media/metadata pulled from IPFS `propertyURI`. 