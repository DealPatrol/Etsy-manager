// api/token.js — Vercel serverless function
// Exchanges OAuth code for access token (keeps shared secret server-side)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, code_verifier, redirect_uri } = req.body;
  const clientId = process.env.ETSY_API_KEYSTRING;
  const clientSecret = process.env.ETSY_SHARED_SECRET;

  console.log('[v0] Token request:', { code: code?.substring(0,10), clientId: clientId?.substring(0,5) });

  if (!clientId || !clientSecret) {
    console.error('[v0] Missing env vars:', { hasId: !!clientId, hasSecret: !!clientSecret });
    return res.status(500).json({ error: 'Missing ETSY credentials' });
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri || process.env.ETSY_REDIRECT_URI,
      code,
      code_verifier: code_verifier || '',
    }).toString();

    console.log('[v0] Calling Etsy token endpoint...');
    const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await response.json();
    console.log('[v0] Etsy response:', { status: response.status, hasToken: !!data.access_token });
    
    if (!response.ok) {
      console.error('[v0] Etsy error:', data);
      return res.status(response.status).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('[v0] Token handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
