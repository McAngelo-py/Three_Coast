const { neon } = require('@neondatabase/serverless');

let initialization;

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
          coast TEXT NOT NULL CHECK (coast IN ('pac', 'atl', 'gulf')),
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
        INSERT INTO products (id, name, coast, description, price, stock, is_seeded)
        VALUES
          ('seed-tide-line', 'Tide Line Tee', 'pac', 'Boxy fit', 48, NULL, TRUE),
          ('seed-subway-hoodie', 'Subway Hoodie', 'atl', '480gsm', 95, NULL, TRUE),
          ('seed-bayou-cap', 'Bayou Cap', 'gulf', 'Washed twill', 38, NULL, TRUE),
          ('seed-late-train', 'Late Train Tee', 'atl', 'Oversized', 48, NULL, TRUE),
          ('seed-pier-cargo', 'Pier Cargo Pant', 'pac', 'Wide leg', 110, NULL, TRUE),
          ('seed-humidity-hoodie', 'Humidity Hoodie', 'gulf', 'Cropped', 95, NULL, TRUE)
        ON CONFLICT (id) DO NOTHING
      `;

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
  SITE_SETTING_DEFAULTS
};
