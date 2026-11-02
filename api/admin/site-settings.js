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
  recordActivity,
  SITE_SETTING_DEFAULTS
} = require('../../lib/database');

function validSettings(settings) {
  return settings && typeof settings === 'object' && !Array.isArray(settings) &&
    Object.entries(settings).every(([key, value]) =>
      Object.hasOwn(SITE_SETTING_DEFAULTS, key) &&
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= (key.endsWith('_body') || key === 'hero_description' ? 1000 : 120)
    );
}

module.exports = async function handler(req, res) {
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
};
