const { databaseError, ensureDatabase, getDatabase } = require('../lib/database');
const { methodNotAllowed, sendJson } = require('../lib/admin-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const products = await sql`
      SELECT id, name, coast, description, price::float8 AS price, stock,
             image_url, is_seeded, is_active
      FROM products
      WHERE is_active = TRUE
      ORDER BY is_seeded DESC, created_at ASC
    `;

    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 200, { products });
  } catch (error) {
    return databaseError(res, error, 'loading storefront products');
  }
};
