const {
  createSessionToken,
  isSameOrigin,
  methodNotAllowed,
  passwordMatches,
  readJsonBody,
  sendJson,
  setSessionCookie
} = require('../../lib/admin-auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (typeof configuredPassword !== 'string' || configuredPassword.length < 12 ||
      typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
    return sendJson(res, 503, { error: 'Admin authentication is not configured correctly.' });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  if (typeof body.password !== 'string' || body.password.length > 1024 ||
      !passwordMatches(body.password)) {
    return sendJson(res, 401, { error: 'Incorrect password.' });
  }

  setSessionCookie(res, createSessionToken(), req);
  return sendJson(res, 200, { authenticated: true });
};
