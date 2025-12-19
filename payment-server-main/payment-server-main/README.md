# Payments Server

A simple Express server to handle payment processing integrations for the AtlasOra frontend.

## Features

- **Revolut Hosted Checkout**: Creates orders via the Revolut Merchant API and redirects users to the hosted payment page.

## Setup

1.  Ensure you have the centralized environment file at `frontend/.env.local`.
2.  Add your Revolut Sandbox API key:
    ```env
    REVOLUT_API_KEY=sk_sandbox_...
    ```

## API Endpoints

### `POST /payments/revolut/checkout`

Creates a Revolut order and returns the redirect URL.

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "USD",
  "description": "Booking for Property X",
  "successUrl": "http://localhost:3000/payment?status=success",
  "cancelUrl": "http://localhost:3000/payment?status=cancelled",
  "metadata": {
    "propertyId": "123",
    ...
  }
}
```

**Response:**
```json
{
  "redirectUrl": "https://sandbox-merchant.revolut.com/checkout/..."
}
```

## Development

Run the server locally:

```bash
pnpm --filter payments-server dev
```
