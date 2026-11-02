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
};
