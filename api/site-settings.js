const {
  databaseError,
  ensureDatabase,
  getDatabase,
  SITE_SETTING_DEFAULTS
} = require('../lib/database');
const { methodNotAllowed, sendJson } = require('../lib/admin-auth');

module.exports = async function handler(req, res) {
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
};
