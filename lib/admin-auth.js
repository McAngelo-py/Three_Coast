const crypto = require('node:crypto');

const SESSION_COOKIE = 'three_coast_admin';
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function methodNotAllowed(res, allowedMethod) {
  res.setHeader('Allow', allowedMethod);
  sendJson(res, 405, { error: 'Method not allowed.' });
}

function readJsonBody(req) {
  let body;
  if (req.body && typeof req.body === 'object') {
    body = req.body;
  } else if (typeof req.body === 'string') {
    body = JSON.parse(req.body);
  } else {
    body = {};
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('Request body must be a JSON object.');
  }
  return body;
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  if (typeof origin !== 'string' || typeof host !== 'string') {
    return false;
  }

  const forwardedProtocol = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProtocol === 'string'
    ? forwardedProtocol.split(',')[0].trim()
    : (req.socket && req.socket.encrypted ? 'https' : 'http');

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

function passwordMatches(password) {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (typeof configuredPassword !== 'string' || configuredPassword.length < 12) {
    return false;
  }

  const submittedHash = crypto.createHash('sha256').update(password).digest();
  const configuredHash = crypto.createHash('sha256').update(configuredPassword).digest();
  return crypto.timingSafeEqual(submittedHash, configuredHash);
}

function createSessionToken() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be set to at least 32 characters.');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const value = String(expiresAt);
  const signature = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${signature}`;
}

function hasValidSession(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    return false;
  }

  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  if (!cookie) {
    return false;
  }

  const token = cookie.slice(SESSION_COOKIE.length + 1);
  const [expiresAtText, signature, extra] = token.split('.');
  const expiresAt = Number(expiresAtText);
  if (!signature || extra !== undefined || !Number.isInteger(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(expiresAtText).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function setSessionCookie(res, token, req) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attributes = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/api/admin',
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    'HttpOnly',
    'SameSite=Strict'
  ];

  if (secure) {
    attributes.push('Secure');
  }

  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res, req) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attributes = [
    `${SESSION_COOKIE}=`,
    'Path=/api/admin',
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
  clearSessionCookie,
  createSessionToken,
  hasValidSession,
  isSameOrigin,
  methodNotAllowed,
  passwordMatches,
  readJsonBody,
  sendJson,
  setSessionCookie
};
