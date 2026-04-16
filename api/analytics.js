// api/analytics.js — Analytics aggregation endpoint
// Fetches Etsy shop data and calculates KPIs for premium analytics dashboard

import crypto from 'crypto';

const SHOP_CACHE = {}; // Simple cache - use Redis in production

async function fetchEtsyAPI(endpoint, accessToken) {
  try {
    const response = await fetch(`https://openapi.etsy.com/v3${endpoint}`, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': process.env.ETSY_API_KEYSTRING
      }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  } catch (err) {
    console.error('[v0] Etsy API error:', err);
    throw err;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'max-age=300'); // 5-min cache
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, accessToken } = req.body;

  if (!userId || !accessToken) {
    return res.status(400).json({ error: 'Missing userId or accessToken' });
  }

  try {
    // Check cache first
    const cacheKey = `${userId}_analytics`;
    if (SHOP_CACHE[cacheKey] && Date.now() - SHOP_CACHE[cacheKey].timestamp < 300000) {
      return res.status(200).json(SHOP_CACHE[cacheKey].data);
    }

    // Fetch shop info
    const shopData = await fetchEtsyAPI('/application/shops', accessToken);
    const shopId = shopData.data?.[0]?.shop_id;

    if (!shopId) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Fetch listings
    const listingsData = await fetchEtsyAPI(`/shops/${shopId}/listings/active`, accessToken);
    const listings = listingsData.data || [];

    // Fetch orders for revenue calculation
    const ordersData = await fetchEtsyAPI(`/shops/${shopId}/receipts`, accessToken);
    const orders = ordersData.data || [];

    // Calculate KPIs
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = listings.length > 0 ? (totalOrders / (listings.length * 30)) * 100 : 0;

    // Top performers
    const topListings = listings
      .sort((a, b) => (b.quantity_sold || 0) - (a.quantity_sold || 0))
      .slice(0, 5)
      .map(l => ({
        id: l.listing_id,
        title: l.title,
        price: l.price,
        sold: l.quantity_sold || 0,
        reviews: l.review_count || 0,
        rating: l.review_average || 0
      }));

    const analytics = {
      timestamp: Date.now(),
      shop: {
        id: shopId,
        name: shopData.data?.[0]?.shop_name,
        currency: shopData.data?.[0]?.currency_code,
        listings: listings.length
      },
      revenue: {
        total: parseFloat(totalRevenue.toFixed(2)),
        monthly: parseFloat((totalRevenue / 30).toFixed(2)),
        average_order: parseFloat(avgOrderValue.toFixed(2))
      },
      orders: {
        total: totalOrders,
        monthly: Math.ceil(totalOrders / 30),
        avg_value: parseFloat(avgOrderValue.toFixed(2))
      },
      conversion: {
        rate: parseFloat(conversionRate.toFixed(2)),
        visitors_estimated: Math.ceil(totalOrders / (conversionRate / 100))
      },
      inventory: {
        active_listings: listings.length,
        sold_last_30: totalOrders,
        avg_price: parseFloat((listings.reduce((s, l) => s + (l.price || 0), 0) / listings.length).toFixed(2))
      },
      top_performers: topListings,
      cache_key: cacheKey
    };

    // Cache the result
    SHOP_CACHE[cacheKey] = { data: analytics, timestamp: Date.now() };

    return res.status(200).json(analytics);
  } catch (err) {
    console.error('[v0] Analytics error:', err);
    return res.status(500).json({ error: err.message });
  }
}
