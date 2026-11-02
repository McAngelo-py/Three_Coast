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
  isCloudinaryImageUrl,
  recordActivity
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
    (body.isActive === undefined || typeof body.isActive === 'boolean') &&
    isCloudinaryImageUrl(body.imageUrl);
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return methodNotAllowed(res, 'GET, POST, PATCH');
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
               image_url, is_seeded, is_active, created_at, updated_at
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
        INSERT INTO products (id, name, coast, description, price, stock, image_url, is_active)
        VALUES (
          ${id},
          ${body.name.trim()},
          ${body.coast},
          ${body.description.trim()},
          ${body.price},
          ${body.stock},
          ${body.imageUrl || null},
          ${body.isActive !== false}
        )
        RETURNING id, name, coast, description, price::float8 AS price, stock,
                  image_url, is_seeded, is_active, created_at, updated_at
      `;
      await recordActivity(sql, 'created', 'product', id, `Added product “${product.name}”.`);
      return sendJson(res, 201, { product });
    }

    if (typeof body.id !== 'string' || body.id.length > 64) {
      return sendJson(res, 400, { error: 'A valid product ID is required.' });
    }

    if (req.method === 'PATCH') {
      if (!validProduct(body)) {
        return sendJson(res, 400, { error: 'Enter valid product details, a whole-number stock count, and a valid Cloudinary image URL.' });
      }

      const [product] = await sql`
        UPDATE products
        SET name = ${body.name.trim()},
            coast = ${body.coast},
            description = ${body.description.trim()},
            price = ${body.price},
            stock = ${body.stock},
            image_url = ${body.imageUrl || null},
            is_active = ${body.isActive !== false},
            updated_at = NOW()
        WHERE id = ${body.id}
        RETURNING id, name, coast, description, price::float8 AS price, stock,
                  image_url, is_seeded, is_active, created_at, updated_at
      `;
      if (!product) {
        return sendJson(res, 404, { error: 'Product not found.' });
      }
      await recordActivity(
        sql,
        'updated',
        'product',
        product.id,
        `${product.is_active ? 'Updated' : 'Hid'} product “${product.name}”.`
      );
      return sendJson(res, 200, { product });
    }

    return sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    return databaseError(res, error, 'managing products');
  }
};
