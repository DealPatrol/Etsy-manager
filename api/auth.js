// api/auth.js — Production User Authentication
// Handles signup, login, and session management with security best practices

import crypto from 'crypto';

// In-memory storage (upgrade to database in production: Supabase, PlanetScale, etc)
const USERS = {};
const SESSIONS = {}; // Session tokens
const RATE_LIMITS = {}; // Track failed login attempts

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function hashPassword(password, salt = 'etsy_salt_2024') {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  // Minimum 6 characters, at least 1 letter and 1 number
  return password.length >= 6 && /[a-z]/i.test(password) && /\d/.test(password);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const emailLower = email.toLowerCase();

    // Check rate limiting
    const now = Date.now();
    if (RATE_LIMITS[emailLower]) {
      const { attempts, lockedUntil } = RATE_LIMITS[emailLower];
      if (now < lockedUntil) {
        return res.status(429).json({ error: 'Too many attempts. Try again later.' });
      }
      if (now - lockedUntil > 0) {
        delete RATE_LIMITS[emailLower]; // Clear old lockout
      }
    }

    if (mode === 'signup') {
      if (!validatePassword(password)) {
        return res.status(400).json({ 
          error: 'Password must be 6+ characters with letters and numbers' 
        });
      }

      if (USERS[emailLower]) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const userId = crypto.randomUUID();
      const hash = hashPassword(password);
      const userData = {
        id: userId,
        email: emailLower,
        password: hash,
        createdAt: new Date().toISOString(),
        etsyConnected: false,
        etsyToken: null
      };

      USERS[emailLower] = userData;

      // Create session
      const token = generateSessionToken();
      SESSIONS[token] = {
        userId,
        email: emailLower,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };

      console.log('[v0] New user signup:', { email: emailLower, userId });

      return res.status(201).json({
        user: {
          id: userId,
          email: emailLower,
          createdAt: userData.createdAt,
          etsyConnected: false
        },
        session: token
      });
    }

    if (mode === 'login') {
      const user = USERS[emailLower];
      const hash = hashPassword(password);

      if (!user || user.password !== hash) {
        // Track failed attempts
        if (!RATE_LIMITS[emailLower]) {
          RATE_LIMITS[emailLower] = { attempts: 1, lockedUntil: 0 };
        } else {
          RATE_LIMITS[emailLower].attempts += 1;
        }

        if (RATE_LIMITS[emailLower].attempts >= MAX_LOGIN_ATTEMPTS) {
          RATE_LIMITS[emailLower].lockedUntil = Date.now() + LOCKOUT_DURATION;
        }

        console.warn('[v0] Failed login attempt:', { email: emailLower });
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Clear rate limit on successful login
      delete RATE_LIMITS[emailLower];

      // Create session
      const token = generateSessionToken();
      SESSIONS[token] = {
        userId: user.id,
        email: emailLower,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };

      console.log('[v0] User login:', { email: emailLower, userId: user.id });

      return res.status(200).json({
        user: {
          id: user.id,
          email: emailLower,
          etsyConnected: user.etsyConnected || false
        },
        session: token
      });
    }

    if (mode === 'validate-session') {
      const { sessionToken } = req.body;
      if (!sessionToken || !SESSIONS[sessionToken]) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const session = SESSIONS[sessionToken];
      if (session.expiresAt < Date.now()) {
        delete SESSIONS[sessionToken];
        return res.status(401).json({ error: 'Session expired' });
      }

      const user = USERS[session.email];
      return res.status(200).json({
        valid: true,
        user: {
          id: user.id,
          email: session.email,
          etsyConnected: user.etsyConnected
        }
      });
    }

    if (mode === 'logout') {
      const { sessionToken } = req.body;
      if (sessionToken) delete SESSIONS[sessionToken];
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (err) {
    console.error('[v0] Auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
