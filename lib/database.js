const { neon } = require('@neondatabase/serverless');

let initialization;

const PRODUCT_CATEGORIES = Object.freeze([
  't-shirts',
  'hoodies',
  'pants',
  'shorts',
  'headwear'
]);

const SITE_SETTING_DEFAULTS = Object.freeze({
  hero_title: 'Three Coast',
  hero_description: 'Heavyweight streetwear built for the block, the boardwalk and the bayou. Season 01 is live.',
  shop_title: 'Season 01',
  first_drop_title: 'First Drop 2K26',
  first_drop_subtitle: 'Available Now!!',
  about_title: 'One crew. Three shorelines.',
  about_body: 'Three Coast started with a simple idea: the best street style doesn’t belong to one city. We cut every piece in small runs, pull the color from where it’s from, and never restock a drop. If you missed it, you missed it.',
  signup_title: 'Don’t miss Drop 02',
  signup_body: 'Get the date and early access a day before everyone else.'
});

function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error('DATABASE_URL is not configured.');
    error.statusCode = 503;
    throw error;
  }

  return neon(connectionString);
}

function ensureDatabase(sql) {
  if (!initialization) {
    initialization = (async function () {
      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL CHECK (category IN ('t-shirts', 'hoodies', 'pants', 'shorts', 'headwear')),
          description TEXT NOT NULL DEFAULT '',
          price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
          stock INTEGER CHECK (stock >= 0),
          image_url TEXT,
          is_seeded BOOLEAN NOT NULL DEFAULT FALSE,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'products'
              AND column_name = 'category'
          ) THEN
            ALTER TABLE products
              ADD COLUMN category TEXT NOT NULL DEFAULT 't-shirts'
              CHECK (category IN ('t-shirts', 'hoodies', 'pants', 'shorts', 'headwear'));

            UPDATE products
            SET category = CASE id
              WHEN 'seed-subway-hoodie' THEN 'hoodies'
              WHEN 'seed-bayou-cap' THEN 'headwear'
              WHEN 'seed-pier-cargo' THEN 'pants'
              WHEN 'seed-humidity-hoodie' THEN 'hoodies'
              ELSE 't-shirts'
            END
            WHERE id IN (
              'seed-tide-line',
              'seed-subway-hoodie',
              'seed-bayou-cap',
              'seed-late-train',
              'seed-pier-cargo',
              'seed-humidity-hoodie'
            );
          END IF;

          ALTER TABLE products DROP COLUMN IF EXISTS coast;
        END;
        $$
      `;

      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

      await sql`
        CREATE TABLE IF NOT EXISTS news_posts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          image_url TEXT,
          status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'`;
      await sql`ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

      await sql`
        CREATE TABLE IF NOT EXISTS site_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS admin_activity (
          id BIGSERIAL PRIMARY KEY,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          summary TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id UUID PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          phone TEXT NOT NULL UNIQUE,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          address TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS cart_items (
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (account_id, product_id)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          shipping_address TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
          total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS order_items (
          id BIGSERIAL PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
          quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99)
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS orders_account_created_idx
        ON orders (account_id, created_at DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS order_items_order_id_idx
        ON order_items (order_id)
      `;

      await sql`
        WITH currency_marker AS (
          INSERT INTO app_metadata (key, value)
          VALUES ('product_prices_currency', 'PHP')
          ON CONFLICT (key) DO NOTHING
          RETURNING key
        )
        UPDATE products
        SET price = ROUND(price * 57.00, 2)
        WHERE EXISTS (SELECT 1 FROM currency_marker)
      `;

      const [seedMarker] = await sql`
        SELECT key FROM app_metadata WHERE key = 'default_products_seeded'
      `;
      if (!seedMarker) {
        await sql`
          INSERT INTO products (id, name, category, description, price, stock, is_seeded)
          SELECT seed.id, seed.name, seed.category, seed.description, seed.price, seed.stock, TRUE
          FROM (VALUES
            ('seed-tide-line', 'Tide Line Tee', 't-shirts', 'Boxy fit', 2736::numeric, NULL::integer),
            ('seed-subway-hoodie', 'Subway Hoodie', 'hoodies', '480gsm', 5415::numeric, NULL::integer),
            ('seed-bayou-cap', 'Bayou Cap', 'headwear', 'Washed twill', 2166::numeric, NULL::integer),
            ('seed-late-train', 'Late Train Tee', 't-shirts', 'Oversized', 2736::numeric, NULL::integer),
            ('seed-pier-cargo', 'Pier Cargo Pant', 'pants', 'Wide leg', 6270::numeric, NULL::integer),
            ('seed-humidity-hoodie', 'Humidity Hoodie', 'hoodies', 'Cropped', 5415::numeric, NULL::integer)
          ) AS seed(id, name, category, description, price, stock)
          WHERE NOT EXISTS (SELECT 1 FROM products)
          ON CONFLICT (id) DO NOTHING
        `;
        await sql`
          INSERT INTO app_metadata (key, value)
          VALUES ('default_products_seeded', 'true')
          ON CONFLICT (key) DO NOTHING
        `;
      }

      for (const [key, value] of Object.entries(SITE_SETTING_DEFAULTS)) {
        await sql`
          INSERT INTO site_settings (key, value)
          VALUES (${key}, ${value})
          ON CONFLICT (key) DO NOTHING
        `;
      }
    })().catch(function (error) {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function recordActivity(sql, action, entityType, entityId, summary) {
  try {
    await sql`
      INSERT INTO admin_activity (action, entity_type, entity_id, summary)
      VALUES (${action}, ${entityType}, ${entityId || null}, ${summary})
    `;
  } catch (error) {
    console.error('Could not record admin activity:', error);
  }
}

function databaseError(res, error, operation) {
  if (error.statusCode === 503) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: error.message });
    return;
  }

  console.error(`Database error while ${operation}:`, error);
  res.setHeader('Cache-Control', 'no-store');
  res.status(500).json({ error: 'The database request failed. Please try again.' });
}

function isCloudinaryImageUrl(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (typeof value !== 'string' || value.length > 2048) {
    return false;
  }

  try {
    const url = new URL(value);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_CLOUD_NAME.trim();
    return url.protocol === 'https:' &&
      url.hostname === 'res.cloudinary.com' &&
      typeof cloudName === 'string' &&
      url.pathname.startsWith(`/${cloudName}/image/upload/`);
  } catch {
    return false;
  }
}

module.exports = {
  databaseError,
  ensureDatabase,
  getDatabase,
  isCloudinaryImageUrl,
  recordActivity,
  PRODUCT_CATEGORIES,
  SITE_SETTING_DEFAULTS
};
