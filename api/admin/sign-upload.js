const crypto = require('node:crypto');
const {
  hasValidSession,
  isSameOrigin,
  methodNotAllowed,
  readJsonBody,
  sendJson
} = require('../../lib/admin-auth');
const {
  IMAGE_SLOTS,
  createUploadSignature,
  getCloudinaryConfig
} = require('../../lib/cloudinary');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  if (!hasValidSession(req)) {
    return sendJson(res, 401, { error: 'Please sign in again.' });
  }

  const config = getCloudinaryConfig();
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
};
