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
  recordActivity
} = require('../../lib/database');
const { IMAGE_SLOTS } = require('../../lib/cloudinary');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }
  if (!hasValidSession(req)) {
    return sendJson(res, 401, { error: 'Please sign in again.' });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }
  const image = IMAGE_SLOTS[body.slot];
  if (!image) {
    return sendJson(res, 400, { error: 'Choose a valid site image.' });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    await recordActivity(sql, 'updated', 'image', body.slot, `Replaced ${image.label.toLowerCase()}.`);
    return sendJson(res, 200, { recorded: true });
  } catch (error) {
    return databaseError(res, error, 'recording a site image update');
  }
};
