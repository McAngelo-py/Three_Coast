const crypto = require('node:crypto');
const {
  createAccountSessionToken,
  createPasswordHash,
  getAccountSecret,
  setAccountCookie
} = require('../../lib/account-auth');
const { databaseError, ensureDatabase, getDatabase } = require('../../lib/database');
const { isSameOrigin, methodNotAllowed, readJsonBody, sendJson } = require('../../lib/admin-auth');

function normalizePhone(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const phone = value.replace(/[\s().-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : null;
}

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

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const phone = normalizePhone(body.phone);
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!firstName || firstName.length > 60 || !lastName || lastName.length > 60 ||
      !phone || typeof body.password !== 'string' ||
      body.password.length < 8 || body.password.length > 128 ||
      address.length < 5 || address.length > 300) {
    return sendJson(res, 400, {
      error: 'Enter your first and last name, a valid phone number, a password of at least 8 characters, and an address.'
    });
  }

  try {
    const sql = getDatabase();
    await ensureDatabase(sql);
    const { salt, hash } = await createPasswordHash(body.password);
    const id = crypto.randomUUID();
    const [account] = await sql`
      INSERT INTO accounts (id, first_name, last_name, phone, password_salt, password_hash, address)
      VALUES (${id}, ${firstName}, ${lastName}, ${phone}, ${salt}, ${hash}, ${address})
      ON CONFLICT (phone) DO NOTHING
      RETURNING id, first_name, last_name, phone, address
    `;
    if (!account) {
      return sendJson(res, 409, { error: 'An account with this phone number already exists. Sign in instead.' });
    }
    setAccountCookie(res, createAccountSessionToken(account.id));
    return sendJson(res, 201, { account });
  } catch (error) {
    return databaseError(res, error, 'creating a customer account');
  }
};
