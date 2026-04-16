// api/token.js — Etsy OAuth Token Exchange & Refresh
// Handles OAuth code-for-token exchange and token refresh with secure secret management

const TOKEN_CACHE = {}; // Cache for refresh tokens (upgrade to Redis in production)

async function fetchEtsyToken(params) {
  const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `HTTP ${response.status}`);
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.ETSY_API_KEYSTRING;
  const clientSecret = process.env.ETSY_SHARED_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[v0] Missing Etsy environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { mode, code, code_verifier, redirect_uri, refresh_token, userId } = req.body;

  try {
    // Mode 1: Exchange authorization code for access token
    if (mode === 'exchange' || !mode) {
      if (!code || !code_verifier) {
        return res.status(400).json({ error: 'Code and code_verifier required' });
      }

      console.log('[v0] Exchanging auth code for token...');

      const tokenData = await fetchEtsyToken({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri || process.env.ETSY_REDIRECT_URI,
        code,
        code_verifier,
      });

      // Cache refresh token for future use
      if (tokenData.refresh_token && userId) {
        TOKEN_CACHE[userId] = {
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
        };
      }

      console.log('[v0] Token exchange successful');

      return res.status(200).json({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type || 'bearer',
      });
    }

    // Mode 2: Refresh expired access token
    if (mode === 'refresh') {
      if (!refresh_token && !userId) {
        return res.status(400).json({ error: 'Refresh token or userId required' });
      }

      let rt = refresh_token;
      
      // Try to get from cache if userId provided
      if (!rt && userId && TOKEN_CACHE[userId]) {
        rt = TOKEN_CACHE[userId].refresh_token;
      }

      if (!rt) {
        return res.status(401).json({ error: 'No refresh token available' });
      }

      console.log('[v0] Refreshing access token...');

      const newTokenData = await fetchEtsyToken({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: rt,
      });

      // Update cache
      if (userId) {
        TOKEN_CACHE[userId] = {
          refresh_token: newTokenData.refresh_token || rt,
          expires_at: Date.now() + (newTokenData.expires_in * 1000),
        };
      }

      console.log('[v0] Token refresh successful');

      return res.status(200).json({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || rt,
        expires_in: newTokenData.expires_in,
        token_type: newTokenData.token_type || 'bearer',
      });
    }

    // Mode 3: Revoke/logout
    if (mode === 'revoke') {
      if (userId && TOKEN_CACHE[userId]) {
        delete TOKEN_CACHE[userId];
      }
      console.log('[v0] Token revoked');
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (err) {
    console.error('[v0] Token handler error:', err.message);
    return res.status(401).json({ 
      error: 'OAuth failed',
      details: err.message 
    });
  }
}
