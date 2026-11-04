const crypto = require('node:crypto');

const ACCOUNT_COOKIE = 'three_coast_account';
const ACCOUNT_SESSION_SECONDS = 30 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 310000;

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PASSWORD_ITERATIONS, 32, 'sha256', (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key.toString('hex'));
    });
  });
}

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: await hashPassword(password, salt) };
}

async function passwordMatches(password, salt, expectedHash) {
  const actual = Buffer.from(await hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

function getAccountSecret() {
  const secret = process.env.ACCOUNT_SESSION_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    const error = new Error('ACCOUNT_SESSION_SECRET must be set to at least 32 characters.');
    error.statusCode = 503;
    throw error;
  }
  return secret;
}

function createAccountSessionToken(accountId) {
  const expiresAt = Math.floor(Date.now() / 1000) + ACCOUNT_SESSION_SECONDS;
  const value = `${accountId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', getAccountSecret()).update(value).digest('hex');
  return `${value}.${signature}`;
}

function getAccountIdFromSession(req) {
  let secret;
  try {
    secret = getAccountSecret();
  } catch {
    return null;
  }

  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCOUNT_COOKIE}=`));
  if (!cookie) {
    return null;
  }

  const token = cookie.slice(ACCOUNT_COOKIE.length + 1);
  const [accountId, expiresAtText, signature, extra] = token.split('.');
  const expiresAt = Number(expiresAtText);
  if (!accountId || !signature || extra !== undefined ||
      !/^[0-9a-f-]{36}$/i.test(accountId) ||
      !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const expected = crypto.createHmac('sha256', secret)
    .update(`${accountId}.${expiresAtText}`).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
    ? accountId
    : null;
}

function setAccountCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attributes = [
    `${ACCOUNT_COOKIE}=${token}`,
    'Path=/api',
    `Max-Age=${ACCOUNT_SESSION_SECONDS}`,
    'HttpOnly',
    'SameSite=Strict'
  ];
  if (secure) {
    attributes.push('Secure');
  }
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearAccountCookie(res) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attributes = [
    `${ACCOUNT_COOKIE}=`,
    'Path=/api',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict'
  ];
  if (secure) {
    attributes.push('Secure');
  }
  res.setHeader('Set-Cookie', attributes.join('; '));
}

module.exports = {
  clearAccountCookie,
  createAccountSessionToken,
  createPasswordHash,
  getAccountIdFromSession,
  getAccountSecret,
  passwordMatches,
  setAccountCookie
};
