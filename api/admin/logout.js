const {
  clearSessionCookie,
  isSameOrigin,
  methodNotAllowed,
  sendJson
} = require('../../lib/admin-auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  clearSessionCookie(res, req);
  return sendJson(res, 200, { authenticated: false });
};
