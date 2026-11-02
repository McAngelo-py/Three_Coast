const { databaseError, ensureDatabase, getDatabase } = require('../lib/database');
const { methodNotAllowed, sendJson } = require('../lib/admin-auth');

module.exports = async function handler(req, res) {
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
};
