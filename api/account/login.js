const {
  createAccountSessionToken,
  getAccountSecret,
  passwordMatches,
  setAccountCookie
} = require('../../lib/account-auth');
const { databaseError, ensureDatabase, getDatabase } = require('../../lib/database');
const { isSameOrigin, methodNotAllowed, readJsonBody, sendJson } = require('../../lib/admin-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  let body;
  try {
    body = readJsonBody(req);
    getAccountSecret();
  } catch (error) {
    if (error.statusCode === 503) {
      return sendJson(res, 503, { error: error.message });
    }
    return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
  }

  const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s().-]/g, '') : '';
  if (!/^\+?[0-9]{7,15}$/.test(phone) ||
      typeof body.password !== 'string' || body.password.length > 128) {
    return sendJson(res, 401, { error: 'Incorrect phone number or password.' });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const [account] = await sql`
      SELECT id, first_name, last_name, phone, address, password_salt, password_hash
      FROM accounts
      WHERE phone = ${phone}
    `;
    if (!account || !await passwordMatches(body.password, account.password_salt, account.password_hash)) {
      return sendJson(res, 401, { error: 'Incorrect phone number or password.' });
    }
    setAccountCookie(res, createAccountSessionToken(account.id));
    return sendJson(res, 200, {
      account: {
        id: account.id,
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
        address: account.address
      }
    });
  } catch (error) {
    return databaseError(res, error, 'signing in to a customer account');
  }
};
