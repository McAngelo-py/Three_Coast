const crypto = require('node:crypto');
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
  isCloudinaryImageUrl
} = require('../../lib/database');

function validProduct(body) {
  return typeof body.name === 'string' &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 80 &&
    ['pac', 'atl', 'gulf'].includes(body.coast) &&
    typeof body.description === 'string' &&
    body.description.trim().length <= 240 &&
    Number.isFinite(body.price) &&
    body.price >= 0 &&
    body.price <= 100000 &&
    Number.isInteger(body.stock) &&
    body.stock >= 0 &&
    body.stock <= 1000000 &&
    isCloudinaryImageUrl(body.imageUrl);
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return methodNotAllowed(res, 'GET, POST, PATCH, DELETE');
  }

  if (req.method !== 'GET' && !isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  if (!hasValidSession(req)) {
    return sendJson(res, 401, { error: 'Please sign in again.' });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);

    if (req.method === 'GET') {
      const products = await sql`
        SELECT id, name, coast, description, price::float8 AS price, stock,
               image_url, is_seeded
        FROM products
        ORDER BY is_seeded DESC, created_at ASC
      `;
      return sendJson(res, 200, { products });
    }

    let body;
    try {
      body = readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
    }

    if (req.method === 'POST') {
      if (!validProduct(body)) {
        return sendJson(res, 400, { error: 'Enter a name, coast, description, valid price, stock count, and valid Cloudinary image URL.' });
      }

      const id = crypto.randomUUID();
      const [product] = await sql`
        INSERT INTO products (id, name, coast, description, price, stock, image_url)
        VALUES (
          ${id},
          ${body.name.trim()},
          ${body.coast},
          ${body.description.trim()},
          ${body.price},
          ${body.stock},
          ${body.imageUrl || null}
        )
        RETURNING id, name, coast, description, price::float8 AS price, stock,
                  image_url, is_seeded
      `;
      return sendJson(res, 201, { product });
    }

    if (typeof body.id !== 'string' || body.id.length > 64) {
      return sendJson(res, 400, { error: 'A valid product ID is required.' });
    }

    if (req.method === 'PATCH') {
      if (!Number.isInteger(body.stock) || body.stock < 0 || body.stock > 1000000) {
        return sendJson(res, 400, { error: 'Stock must be a whole number between 0 and 1,000,000.' });
      }

      const [product] = await sql`
        UPDATE products
        SET stock = ${body.stock}
        WHERE id = ${body.id}
        RETURNING id, name, coast, description, price::float8 AS price, stock,
                  image_url, is_seeded
      `;
      if (!product) {
        return sendJson(res, 404, { error: 'Product not found.' });
      }
      return sendJson(res, 200, { product });
    }

    const [deleted] = await sql`
      DELETE FROM products
      WHERE id = ${body.id} AND is_seeded = FALSE
      RETURNING id
    `;
    if (!deleted) {
      return sendJson(res, 404, { error: 'Product not found or cannot be removed.' });
    }
    return sendJson(res, 200, { deleted: true });
  } catch (error) {
    return databaseError(res, error, 'managing products');
  }
};
