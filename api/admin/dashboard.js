const {
  hasValidSession,
  isSameOrigin,
  methodNotAllowed,
  readJsonBody,
  sendJson
} = require('../../lib/admin-auth');
const {
  databaseError,
  ensureDatabase,
  getDatabase,
  recordActivity
} = require('../../lib/database');
const { IMAGE_SLOTS } = require('../../lib/cloudinary');

const LOW_STOCK_THRESHOLD = 3;

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return methodNotAllowed(res, 'GET, POST');
  }
  if (req.method === 'POST' && !isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }
  if (!hasValidSession(req)) {
    return sendJson(res, 401, { error: 'Please sign in again.' });
  }

  let body;
  if (req.method === 'POST') {
    try {
      body = readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
    }

    if (!IMAGE_SLOTS[body.slot]) {
      return sendJson(res, 400, { error: 'Choose a valid site image.' });
    }
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    if (req.method === 'POST') {
      const image = IMAGE_SLOTS[body.slot];
      await recordActivity(
        sql,
        'updated',
        'image',
        body.slot,
        `Replaced ${image.label.toLowerCase()}.`
      );
      return sendJson(res, 200, { recorded: true });
    }

    const [counts] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_active)::int AS active_products,
        COUNT(*) FILTER (WHERE NOT is_active)::int AS hidden_products,
        COUNT(*) FILTER (WHERE is_active AND stock = 0)::int AS sold_out_products,
        COUNT(*) FILTER (
          WHERE is_active AND stock > 0 AND stock <= ${LOW_STOCK_THRESHOLD}
        )::int AS low_stock_products
      FROM products
    `;
    const [postCounts] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'published')::int AS published_posts,
        COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_posts
      FROM news_posts
    `;
    const lowStock = await sql`
      SELECT id, name, coast, stock, is_seeded
      FROM products
      WHERE is_active = TRUE AND stock > 0 AND stock <= ${LOW_STOCK_THRESHOLD}
      ORDER BY stock ASC, name ASC
      LIMIT 10
    `;
    const activity = await sql`
      SELECT id, action, entity_type, entity_id, summary, created_at
      FROM admin_activity
      ORDER BY created_at DESC
      LIMIT 10
    `;

    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 200, {
      activity,
      lowStock,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      metrics: { ...counts, ...postCounts }
    });
  } catch (error) {
    return databaseError(res, error, 'loading the admin dashboard');
  }
};
