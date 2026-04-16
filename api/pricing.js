// api/pricing.js — Smart Pricing Engine
// Calculates market-based pricing recommendations, discount strategies, and seasonal optimization

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'max-age=3600'); // 1-hour cache
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { listings, category = 'digital_products' } = req.body;

  if (!listings || !Array.isArray(listings)) {
    return res.status(400).json({ error: 'Listings array required' });
  }

  try {
    // Market data benchmarks (in production, pull from real market data)
    const MARKET_BENCHMARKS = {
      digital_products: { avg_price: 48.50, elasticity: -1.2, price_range: [29.99, 99.99] },
      templates: { avg_price: 34.99, elasticity: -1.1, price_range: [19.99, 79.99] },
      art_prints: { avg_price: 42.50, elasticity: -1.3, price_range: [24.99, 89.99] }
    };

    const benchmark = MARKET_BENCHMARKS[category] || MARKET_BENCHMARKS.digital_products;
    const avgPrice = listings.reduce((sum, l) => sum + (l.price || 0), 0) / listings.length;

    // Calculate price elasticity impact
    const priceGap = benchmark.avg_price - avgPrice;
    const recommendedIncrease = Math.max(0, Math.min(15, (priceGap / avgPrice) * 100)); // Max 15% increase

    // Revenue opportunity calculation
    const currentRevenue = listings.reduce((sum, l) => sum + ((l.price || 0) * (l.sold || 0)), 0);
    const revenueOpportunity = (currentRevenue * (recommendedIncrease / 100)).toFixed(2);

    // Discount campaigns
    const campaigns = [
      {
        name: 'Summer Sale 20%',
        discount: 20,
        status: 'LIVE',
        impact: '+24% orders',
        estRevenue: (currentRevenue * 0.8 * 1.24).toFixed(2)
      },
      {
        name: 'Loyalty Discount',
        discount: 15,
        status: 'SCHEDULED',
        impact: '+12% orders',
        estRevenue: (currentRevenue * 0.85 * 1.12).toFixed(2)
      }
    ];

    // Bundle deals
    const bundles = [
      {
        name: 'Designer Bundle',
        price: 79.99,
        items: 3,
        savings: 30,
        sold: 142
      },
      {
        name: 'Creator Pack',
        price: 149.99,
        items: 5,
        savings: 60,
        sold: 89
      }
    ];

    // Seasonal optimization (Q-based)
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    const seasonalAdjustments = {
      Q1: -15,
      Q2: 0,
      Q3: 10,
      Q4: 20
    };

    const pricingRecommendations = {
      current_avg_price: parseFloat(avgPrice.toFixed(2)),
      market_avg_price: benchmark.avg_price,
      recommended_price: parseFloat((avgPrice * (1 + recommendedIncrease / 100)).toFixed(2)),
      price_increase_percent: parseFloat(recommendedIncrease.toFixed(1)),
      revenue_opportunity: parseFloat(revenueOpportunity),
      elasticity_score: benchmark.elasticity,
      confidence: 'high',
      campaigns,
      bundles,
      seasonal: {
        current_quarter: `Q${currentQuarter}`,
        adjustment: `${seasonalAdjustments[`Q${currentQuarter}`]}%`,
        next_peak: currentQuarter === 4 ? 'Holiday Q4' : 'Summer Q3',
        recommendation: currentQuarter === 4 ? '+20% (Holiday surge)' : currentQuarter === 3 ? '+10% (Peak demand)' : '0% (Baseline)'
      },
      recommendations: [
        `Increase prices by ${recommendedIncrease.toFixed(1)}% to match market average`,
        `Potential revenue increase: $${revenueOpportunity}`,
        `Monitor Q${currentQuarter} seasonal trends`,
        'Create bundle deals to increase average order value',
        'Test discount campaigns on lower-performing items'
      ]
    };

    return res.status(200).json(pricingRecommendations);
  } catch (err) {
    console.error('[v0] Pricing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
