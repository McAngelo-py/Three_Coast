const { getAccountIdFromSession } = require('../lib/account-auth');
const { databaseError, ensureDatabase, getDatabase } = require('../lib/database');
const { isSameOrigin, methodNotAllowed, readJsonBody, sendJson } = require('../lib/admin-auth');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return methodNotAllowed(res, 'GET, POST, DELETE');
  }
  if (req.method !== 'GET' && !isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  const accountId = getAccountIdFromSession(req);
  if (!accountId) {
    return sendJson(res, 401, { error: 'Sign in to use your cart.' });
  }

  let body = {};
  if (req.method !== 'GET') {
    try {
      body = readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
    }
  }

  if (req.method !== 'GET' &&
      (typeof body.productId !== 'string' || body.productId.length > 64)) {
    return sendJson(res, 400, { error: 'A valid product ID is required.' });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);

    if (req.method === 'GET') {
      const items = await sql`
        SELECT p.id AS product_id, p.name, p.price::float8 AS price,
               p.image_url, p.stock, ci.quantity
        FROM cart_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.account_id = ${accountId} AND p.is_active = TRUE
        ORDER BY ci.updated_at DESC
      `;
      return sendJson(res, 200, { items });
    }

    if (req.method === 'DELETE') {
      await sql`
        DELETE FROM cart_items
        WHERE account_id = ${accountId} AND product_id = ${body.productId}
      `;
      return sendJson(res, 200, { removed: true });
    }

    const [product] = await sql`
      SELECT id, stock
      FROM products
      WHERE id = ${body.productId} AND is_active = TRUE
    `;
    if (!product) {
      return sendJson(res, 404, { error: 'This product is no longer available.' });
    }
    if (product.stock === 0) {
      return sendJson(res, 409, { error: 'This product is sold out.' });
    }

    const [item] = await sql`
      INSERT INTO cart_items (account_id, product_id, quantity)
      VALUES (${accountId}, ${body.productId}, 1)
      ON CONFLICT (account_id, product_id)
      DO UPDATE SET quantity = LEAST(cart_items.quantity + 1, 99), updated_at = NOW()
      RETURNING product_id, quantity
    `;
    return sendJson(res, 200, { item });
  } catch (error) {
    return databaseError(res, error, 'updating a customer cart');
  }
};
