const { neon } = require('@neondatabase/serverless');

let initialization;

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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS news_posts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          image_url TEXT,
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
    })().catch(function (error) {
      initialization = null;
      throw error;
    });
  }
  return initialization;
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
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
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
  isCloudinaryImageUrl
};
