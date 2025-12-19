import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from local .env
dotenv.config();

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const REVOLUT_API_KEY = process.env.REVOLUT_API_KEY;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Explicitly handle preflight for this route (some environments require it)
app.options('/payments/revolut/checkout', cors());

// Revolut hosted checkout
app.post('/payments/revolut/checkout', async (req, res) => {
  try {
    const { amount, currency, description, successUrl, cancelUrl, metadata } = req.body || {};
    console.log('[payments-server] POST /payments/revolut/checkout', {
      amount,
      currency,
      hasSuccessUrl: !!successUrl,
      hasCancelUrl: !!cancelUrl,
      metadata,
    });

    // Mock mode for testing without valid API keys
    if (process.env.MOCK_PAYMENTS === 'true') {
      console.log('[payments-server] MOCK_PAYMENTS is enabled. Skipping Revolut API call.');
      console.log('[payments-server] Mocking success redirect to:', successUrl);
      // Simulate a short delay to feel like a real request
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.json({ redirectUrl: successUrl });
    }

    if (!REVOLUT_API_KEY) {
      console.error('[payments-server] REVOLUT_API_KEY is missing');
      return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
    }

    if (!amount || !currency || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Call Revolut Sandbox API
    // Docs: https://developer.revolut.com/docs/merchant/create-order
    console.log('[payments-server] Using API Key:', REVOLUT_API_KEY ? `${REVOLUT_API_KEY.substring(0, 10)}...` : 'MISSING');

    const revolutRes = await fetch(process.env.REVOLUT_API_URL || 'https://sandbox-merchant.revolut.com/api/1.0/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${REVOLUT_API_KEY}`,
        'Revolut-Api-Version': '2024-09-01' // Try adding API version if needed, or just standard headers
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100), // Revolut expects amount in cents/lowest unit
        currency,
        description,
        capture_mode: 'AUTOMATIC',
        redirect_url: successUrl, // Revolut uses redirect_url for success
        cancel_url: cancelUrl,
        metadata,
      }),
    });

    if (!revolutRes.ok) {
      const errorData = await revolutRes.json().catch(() => ({}));
      console.error('[payments-server] Revolut API error:', revolutRes.status, errorData);
      return res.status(revolutRes.status).json({ error: 'Failed to create Revolut order', details: errorData });
    }

    const order = await revolutRes.json();
    console.log('[payments-server] Revolut order created:', order.id);

    // Return the hosted checkout URL
    const redirectUrl = order.checkout_url;
    if (!redirectUrl) {
      console.error('[payments-server] No checkout_url in Revolut response', order);
      return res.status(500).json({ error: 'Invalid response from payment provider' });
    }

    res.json({ redirectUrl });
  } catch (e) {
    console.error('checkout error', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[payments-server] listening on :${PORT}`);
});
