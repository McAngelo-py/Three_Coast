const { hasValidSession, methodNotAllowed, sendJson } = require('../../lib/admin-auth');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  if (!hasValidSession(req)) {
    return sendJson(res, 401, { authenticated: false });
  }

  return sendJson(res, 200, { authenticated: true });
};
