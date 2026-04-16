// api/auth.js — Authentication endpoint
// Simple user auth with bcrypt and in-memory storage

const crypto = require('crypto');

// Simple in-memory user database (in production, use a real database)
// Format: { email: { password: hash, id: uuid } }
const USERS = {};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'etsy_salt_2024').digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const hash = hashPassword(password);

    if (mode === 'signup') {
      if (USERS[email]) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      const userId = crypto.randomUUID();
      USERS[email] = { password: hash, id: userId };
      return res.status(200).json({
        user: { email, id: userId, createdAt: new Date().toISOString() }
      });
    }

    if (mode === 'login') {
      const user = USERS[email];
      if (!user || user.password !== hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      return res.status(200).json({
        user: { email, id: user.id }
      });
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (err) {
    console.error('[v0] Auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
