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

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return methodNotAllowed(res, 'GET, POST, DELETE');
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
        SELECT id, title, body, image_url, created_at
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
          !isCloudinaryImageUrl(body.imageUrl)) {
        return sendJson(res, 400, { error: 'Enter a title, post text, and a valid Cloudinary image URL if adding an image.' });
      }

      const id = crypto.randomUUID();
      const [post] = await sql`
        INSERT INTO news_posts (id, title, body, image_url)
        VALUES (${id}, ${body.title.trim()}, ${body.body.trim()}, ${body.imageUrl || null})
        RETURNING id, title, body, image_url, created_at
      `;
      return sendJson(res, 201, { post });
    }

    if (typeof body.id !== 'string' || body.id.length > 64) {
      return sendJson(res, 400, { error: 'A valid post ID is required.' });
    }

    const [deleted] = await sql`
      DELETE FROM news_posts
      WHERE id = ${body.id}
      RETURNING id
    `;
    if (!deleted) {
      return sendJson(res, 404, { error: 'Post not found.' });
    }
    return sendJson(res, 200, { deleted: true });
  } catch (error) {
    return databaseError(res, error, 'managing news posts');
  }
};
