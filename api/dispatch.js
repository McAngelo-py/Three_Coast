const crypto = require('node:crypto');
const {
  clearAccountCookie,
  createAccountSessionToken,
  createPasswordHash,
  getAccountIdFromSession,
  getAccountSecret,
  passwordMatches,
  setAccountCookie
} = require('../lib/account-auth');
const {
  clearSessionCookie,
  createSessionToken,
  hasValidSession,
  isSameOrigin,
  methodNotAllowed,
  passwordMatches: adminPasswordMatches,
  readJsonBody,
  sendJson,
  setSessionCookie
} = require('../lib/admin-auth');
const {
  databaseError,
  ensureDatabase,
  getDatabase,
  isCloudinaryImageUrl,
  recordActivity,
  PRODUCT_CATEGORIES,
  SITE_SETTING_DEFAULTS
} = require('../lib/database');
const {
  IMAGE_SLOTS,
  createUploadSignature,
  getCloudinaryConfig,
  getCloudinaryCloudName,
  getImageUrl
} = require('../lib/cloudinary');

function normalizePhone(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const phone = value.replace(/[\s().-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : null;
}

function validProduct(body) {
  return typeof body.name === 'string' &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 80 &&
    PRODUCT_CATEGORIES.includes(body.category) &&
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

function validSettings(settings) {
  return settings && typeof settings === 'object' && !Array.isArray(settings) &&
    Object.entries(settings).every(([key, value]) =>
      Object.hasOwn(SITE_SETTING_DEFAULTS, key) &&
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= (key.endsWith('_body') || key === 'hero_description' ? 1000 : 120)
    );
}

async function adminLoginHandler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (typeof configuredPassword !== 'string' || configuredPassword.length < 12 ||
      typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
    return sendJson(res, 503, { error: 'Admin authentication is not configured correctly.' });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  if (typeof body.password !== 'string' || body.password.length > 1024 ||
      !adminPasswordMatches(body.password)) {
    return sendJson(res, 401, { error: 'Incorrect password.' });
  }

  setSessionCookie(res, createSessionToken(), req);
  return sendJson(res, 200, { authenticated: true });
}

function adminSessionHandler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  if (!hasValidSession(req)) {
    return sendJson(res, 401, { authenticated: false });
  }

  return sendJson(res, 200, { authenticated: true });
}

function adminLogoutHandler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  clearSessionCookie(res, req);
  return sendJson(res, 200, { authenticated: false });
}

async function adminProductsHandler(req, res) {
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
        SELECT id, name, category, description, price::float8 AS price, stock,
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
        return sendJson(res, 400, { error: 'Enter a name, category, description, valid price, stock count, and valid Cloudinary image URL.' });
      }

      const id = crypto.randomUUID();
      const [product] = await sql`
        INSERT INTO products (id, name, category, description, price, stock, image_url, is_active)
        VALUES (
          ${id},
          ${body.name.trim()},
          ${body.category},
          ${body.description.trim()},
          ${body.price},
          ${body.stock},
          ${body.imageUrl || null},
          ${body.isActive !== false}
        )
        RETURNING id, name, category, description, price::float8 AS price, stock,
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
            category = ${body.category},
            description = ${body.description.trim()},
            price = ${body.price},
            stock = ${body.stock},
            image_url = ${body.imageUrl || null},
            is_active = ${body.isActive !== false},
            updated_at = NOW()
        WHERE id = ${body.id}
        RETURNING id, name, category, description, price::float8 AS price, stock,
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

    const [deleted] = await sql`
      DELETE FROM products
      WHERE id = ${body.id}
      RETURNING id, name
    `;
    if (!deleted) {
      return sendJson(res, 404, { error: 'Product not found.' });
    }
    await recordActivity(
      sql,
      'deleted',
      'product',
      deleted.id,
      `Deleted product “${deleted.name}”.`
    );
    return sendJson(res, 200, { deleted: true });
  } catch (error) {
    return databaseError(res, error, 'managing products');
  }
}

async function adminPostsHandler(req, res) {
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
      const posts = await sql`
        SELECT id, title, body, image_url, status, created_at, updated_at
        FROM news_posts
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return sendJson(res, 200, { posts });
    }

    let body;
    try {
      body = readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
    }

    if (req.method === 'POST') {
      if (typeof body.title !== 'string' ||
          body.title.trim().length === 0 ||
          body.title.trim().length > 100 ||
          typeof body.body !== 'string' ||
          body.body.trim().length === 0 ||
          body.body.trim().length > 3000 ||
          (body.status !== undefined && !['draft', 'published'].includes(body.status)) ||
          !isCloudinaryImageUrl(body.imageUrl)) {
        return sendJson(res, 400, { error: 'Enter a title, post text, valid publication status, and a valid Cloudinary image URL if adding an image.' });
      }

      const id = crypto.randomUUID();
      const [post] = await sql`
        INSERT INTO news_posts (id, title, body, image_url, status)
        VALUES (
          ${id},
          ${body.title.trim()},
          ${body.body.trim()},
          ${body.imageUrl || null},
          ${body.status || 'published'}
        )
        RETURNING id, title, body, image_url, status, created_at, updated_at
      `;
      await recordActivity(
        sql,
        'created',
        'post',
        id,
        `${post.status === 'published' ? 'Published' : 'Saved draft'} “${post.title}”.`
      );
      return sendJson(res, 201, { post });
    }

    if (typeof body.id !== 'string' || body.id.length > 64) {
      return sendJson(res, 400, { error: 'A valid post ID is required.' });
    }

    if (req.method === 'PATCH') {
      if (typeof body.title !== 'string' ||
          body.title.trim().length === 0 ||
          body.title.trim().length > 100 ||
          typeof body.body !== 'string' ||
          body.body.trim().length === 0 ||
          body.body.trim().length > 3000 ||
          !['draft', 'published'].includes(body.status) ||
          !isCloudinaryImageUrl(body.imageUrl)) {
        return sendJson(res, 400, { error: 'Enter a title, post text, valid publication status, and a valid Cloudinary image URL if adding an image.' });
      }

      const [post] = await sql`
        UPDATE news_posts
        SET title = ${body.title.trim()},
            body = ${body.body.trim()},
            image_url = ${body.imageUrl || null},
            status = ${body.status},
            updated_at = NOW()
        WHERE id = ${body.id}
        RETURNING id, title, body, image_url, status, created_at, updated_at
      `;
      if (!post) {
        return sendJson(res, 404, { error: 'Post not found.' });
      }
      await recordActivity(
        sql,
        'updated',
        'post',
        post.id,
        `${post.status === 'published' ? 'Updated' : 'Saved draft'} “${post.title}”.`
      );
      return sendJson(res, 200, { post });
    }

    const [deleted] = await sql`
      DELETE FROM news_posts
      WHERE id = ${body.id}
      RETURNING id, title
    `;
    if (!deleted) {
      return sendJson(res, 404, { error: 'Post not found.' });
    }
    await recordActivity(sql, 'deleted', 'post', deleted.id, `Deleted “${deleted.title}”.`);
    return sendJson(res, 200, { deleted: true });
  } catch (error) {
    return databaseError(res, error, 'managing news posts');
  }
}

async function adminDashboardHandler(req, res) {
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
          WHERE is_active AND stock > 0 AND stock <= 3
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
      SELECT id, name, category, stock, is_seeded
      FROM products
      WHERE is_active = TRUE AND stock > 0 AND stock <= 3
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
      lowStockThreshold: 3,
      metrics: { ...counts, ...postCounts }
    });
  } catch (error) {
    return databaseError(res, error, 'loading the admin dashboard');
  }
}

async function adminSiteSettingsHandler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    return methodNotAllowed(res, 'GET, PATCH');
  }
  if (!hasValidSession(req)) {
    return sendJson(res, 401, { error: 'Please sign in again.' });
  }
  if (req.method === 'PATCH' && !isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT key, value, updated_at
        FROM site_settings
        ORDER BY key
      `;
      return sendJson(res, 200, {
        settings: Object.fromEntries(rows.map((row) => [row.key, row.value]))
      });
    }

    let body;
    try {
      body = readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
    }
    if (!validSettings(body.settings) ||
        Object.keys(body.settings).length !== Object.keys(SITE_SETTING_DEFAULTS).length) {
      return sendJson(res, 400, { error: 'Provide a non-empty value for each supported site setting.' });
    }

    const settingsJson = JSON.stringify(
      Object.fromEntries(
        Object.entries(body.settings).map(([key, value]) => [key, value.trim()])
      )
    );
    await sql`
      INSERT INTO site_settings (key, value, updated_at)
      SELECT key, value, NOW()
      FROM jsonb_each_text(${settingsJson}::jsonb) AS settings(key, value)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    await recordActivity(sql, 'updated', 'settings', null, 'Updated site content settings.');
    return sendJson(res, 200, { settings: body.settings });
  } catch (error) {
    return databaseError(res, error, 'saving site settings');
  }
}

function adminUploadHandler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  if (!hasValidSession(req)) {
    return sendJson(res, 401, { error: 'Please sign in again.' });
  }

  let config;
  try {
    config = getCloudinaryConfig();
  } catch (error) {
    if (error.statusCode === 503) {
      return sendJson(res, 503, { error: error.message });
    }
    throw error;
  }

  if (!config) {
    return sendJson(res, 503, { error: 'Cloudinary is not configured.' });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  const slot = IMAGE_SLOTS[body.slot];
  const contentType = body.slot === 'product' || body.slot === 'post'
    ? body.slot
    : null;
  if (!slot && !contentType) {
    return sendJson(res, 400, { error: 'Choose a valid site image.' });
  }

  const publicId = slot
    ? slot.publicId
    : `three-coast/${contentType}s/${crypto.randomUUID()}`;
  const parameters = {
    allowed_formats: 'jpg,png,webp,avif',
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000))
  };

  if (slot) {
    parameters.invalidate = 'true';
    parameters.overwrite = 'true';
  }

  return sendJson(res, 200, {
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    parameters,
    publicId,
    signature: createUploadSignature(parameters, config.apiSecret)
  });
}

async function accountLoginHandler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  let body;
  try {
    body = readJsonBody(req);
    getAccountSecret();
  } catch (error) {
    if (error.statusCode === 503) {
      return sendJson(res, 503, { error: error.message });
    }
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s().-]/g, '') : '';
  if (!/^\+?[0-9]{7,15}$/.test(phone) ||
      typeof body.password !== 'string' || body.password.length > 128) {
    return sendJson(res, 401, { error: 'Incorrect phone number or password.' });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const [account] = await sql`
      SELECT id, first_name, last_name, phone, address, password_salt, password_hash
      FROM accounts
      WHERE phone = ${phone}
    `;
    if (!account || !await passwordMatches(body.password, account.password_salt, account.password_hash)) {
      return sendJson(res, 401, { error: 'Incorrect phone number or password.' });
    }
    setAccountCookie(res, createAccountSessionToken(account.id));
    return sendJson(res, 200, {
      account: {
        id: account.id,
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
        address: account.address
      }
    });
  } catch (error) {
    return databaseError(res, error, 'signing in to a customer account');
  }
}

async function accountRegisterHandler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  let body;
  try {
    body = readJsonBody(req);
    getAccountSecret();
  } catch (error) {
    if (error.statusCode === 503) {
      return sendJson(res, 503, { error: error.message });
    }
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const phone = normalizePhone(body.phone);
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!firstName || firstName.length > 60 || !lastName || lastName.length > 60 ||
      !phone || typeof body.password !== 'string' ||
      body.password.length < 8 || body.password.length > 128 ||
      address.length < 5 || address.length > 300) {
    return sendJson(res, 400, {
      error: 'Enter your first and last name, a valid phone number, a password of at least 8 characters, and an address.'
    });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const { salt, hash } = await createPasswordHash(body.password);
    const id = crypto.randomUUID();
    const [account] = await sql`
      INSERT INTO accounts (id, first_name, last_name, phone, password_salt, password_hash, address)
      VALUES (${id}, ${firstName}, ${lastName}, ${phone}, ${salt}, ${hash}, ${address})
      ON CONFLICT (phone) DO NOTHING
      RETURNING id, first_name, last_name, phone, address
    `;
    if (!account) {
      return sendJson(res, 409, { error: 'An account with this phone number already exists. Sign in instead.' });
    }
    setAccountCookie(res, createAccountSessionToken(account.id));
    return sendJson(res, 201, { account });
  } catch (error) {
    return databaseError(res, error, 'creating a customer account');
  }
}

async function accountSessionHandler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  const accountId = getAccountIdFromSession(req);
  if (!accountId) {
    return sendJson(res, 401, { authenticated: false });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const [account] = await sql`
      SELECT id, first_name, last_name, phone, address
      FROM accounts
      WHERE id = ${accountId}
    `;
    if (!account) {
      return sendJson(res, 401, { authenticated: false });
    }
    return sendJson(res, 200, { authenticated: true, account });
  } catch (error) {
    return databaseError(res, error, 'loading a customer account');
  }
}

function accountLogoutHandler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }
  clearAccountCookie(res);
  return sendJson(res, 200, { authenticated: false });
}

async function cartHandler(req, res) {
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
}

async function productsHandler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const products = await sql`
      SELECT id, name, category, description, price::float8 AS price, stock,
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
}

async function postsHandler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const posts = await sql`
      SELECT id, title, body, image_url, status, created_at, updated_at
      FROM news_posts
      WHERE status = 'published'
      ORDER BY created_at DESC
      LIMIT 30
    `;

    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 200, { posts });
  } catch (error) {
    return databaseError(res, error, 'loading news posts');
  }
}

async function siteSettingsHandler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const rows = await sql`SELECT key, value FROM site_settings`;
    const settings = { ...SITE_SETTING_DEFAULTS };
    rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 200, { settings });
  } catch (error) {
    return databaseError(res, error, 'loading site settings');
  }
}

async function imagesHandler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  let cloudName;
  try {
    cloudName = getCloudinaryCloudName();
  } catch (error) {
    if (error.statusCode === 503) {
      return sendJson(res, 503, { error: error.message });
    }
    throw error;
  }

  if (!cloudName) {
    return sendJson(res, 200, { cloudName: null, images: {} });
  }

  let availability;
  try {
    availability = await Promise.all(
      Object.entries(IMAGE_SLOTS).map(async ([key, slot]) => {
        const response = await fetch(getImageUrl(cloudName, slot.publicId), {
          method: 'HEAD'
        });
        if (response.status === 404) {
          return [key, false];
        }
        if (!response.ok) {
          throw new Error(`Cloudinary image check failed with status ${response.status}.`);
        }
        return [key, true];
      })
    );
  } catch (error) {
    console.error('Could not check Cloudinary site images:', error);
    return sendJson(res, 502, { error: 'Cloudinary images could not be checked. Please try again.' });
  }

  const images = Object.fromEntries(
    availability
      .filter(([, exists]) => exists)
      .map(([key]) => [
        key,
        {
          label: IMAGE_SLOTS[key].label,
          url: getImageUrl(cloudName, IMAGE_SLOTS[key].publicId)
        }
      ])
  );

  return sendJson(res, 200, { cloudName, images });
}

module.exports = async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const queryRoute = (req.query && req.query.route) || requestUrl.searchParams.get('route');
  const route = Array.isArray(queryRoute)
    ? queryRoute
    : typeof queryRoute === 'string'
      ? queryRoute.split('/')
      : requestUrl.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const routeKey = route.filter(Boolean).join('/');

  switch (routeKey) {
    case 'account/login':
      return accountLoginHandler(req, res);
    case 'account/register':
      return accountRegisterHandler(req, res);
    case 'account/session':
      return accountSessionHandler(req, res);
    case 'account/logout':
      return accountLogoutHandler(req, res);
    case 'cart':
      return cartHandler(req, res);
    case 'images':
      return imagesHandler(req, res);
    case 'products':
      return productsHandler(req, res);
    case 'posts':
      return postsHandler(req, res);
    case 'site-settings':
      return siteSettingsHandler(req, res);
    case 'admin/login':
      return adminLoginHandler(req, res);
    case 'admin/session':
      return adminSessionHandler(req, res);
    case 'admin/logout':
      return adminLogoutHandler(req, res);
    case 'admin/products':
      return adminProductsHandler(req, res);
    case 'admin/posts':
      return adminPostsHandler(req, res);
    case 'admin/dashboard':
      return adminDashboardHandler(req, res);
    case 'admin/site-settings':
      return adminSiteSettingsHandler(req, res);
    case 'admin/sign-upload':
      return adminUploadHandler(req, res);
    default:
      return sendJson(res, 404, { error: 'Route not found.' });
  }
};
