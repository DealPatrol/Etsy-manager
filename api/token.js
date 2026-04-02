// api/token.js — Vercel serverless function
// Exchanges OAuth code for access token, or refreshes an existing token (keeps shared secret server-side)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { grant_type, code, code_verifier, redirect_uri, refresh_token } = req.body;

  try {
    let params;
    if (grant_type === 'refresh_token') {
      if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
      params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.ETSY_API_KEY,
        refresh_token,
      });
    } else {
      // Default: authorization_code exchange
      params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.ETSY_API_KEY,
        redirect_uri,
        code,
        code_verifier,
      });
    }

    const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await response.json();
    if (!response.ok) return res.status(400).json(data);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
