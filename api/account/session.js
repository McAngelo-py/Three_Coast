const { getAccountIdFromSession } = require('../../lib/account-auth');
const { databaseError, ensureDatabase, getDatabase } = require('../../lib/database');
const { methodNotAllowed, sendJson } = require('../../lib/admin-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  const accountId = getAccountIdFromSession(req);
  if (!accountId) {
    return sendJson(res, 401, { authenticated: false });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const [account] = await sql`
      SELECT id, first_name, last_name, phone, address
      FROM accounts
      WHERE id = ${accountId}
    `;
    if (!account) {
      return sendJson(res, 401, { authenticated: false });
    }
    return sendJson(res, 200, { authenticated: true, account });
  } catch (error) {
    return databaseError(res, error, 'loading a customer account');
  }
};
