import assert from 'node:assert';
import authService from './Auth.js';

// Setup mock global localStorage and sessionStorage for node test environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
};
global.sessionStorage = {
  clear: () => {},
};

// Generate test JWT
function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

// Case 1: No token
localStorage.clear();
assert.strictEqual(authService.getAccessToken(), null);
assert.strictEqual(authService.isLoggedIn(), false);

// Case 2: Expired token
const pastExp = Math.floor(Date.now() / 1000) - 3600;
const expiredToken = makeJwt({ exp: pastExp, username: 'testuser' });
authService.setAccessToken(expiredToken);
assert.strictEqual(authService.isTokenExpired(expiredToken), true);
assert.strictEqual(authService.isLoggedIn(), false);

// Case 3: Valid unexpired token
const futureExp = Math.floor(Date.now() / 1000) + 3600;
const validToken = makeJwt({ exp: futureExp, username: 'testuser' });
authService.setAccessToken(validToken);
assert.strictEqual(authService.isTokenExpired(validToken), false);
assert.strictEqual(authService.isLoggedIn(), true);
assert.strictEqual(authService.getAccessToken(), validToken);

// Case 4: Token fallback from "auth" JSON blob in localStorage
localStorage.removeItem('accessToken');
assert.strictEqual(mockStorage.get('accessToken'), undefined);
localStorage.setItem('auth', JSON.stringify({ accessToken: validToken, userData: { role: 'admin' } }));
assert.strictEqual(authService.getAccessToken(), validToken);
assert.strictEqual(authService.isLoggedIn(), true);
assert.strictEqual(authService.getRole(), 'admin');
assert.strictEqual(authService.isAdmin(), true);

// Case 5: clearAuthData clears both accessToken, role, and auth blob
authService.clearAuthData();
assert.strictEqual(authService.getAccessToken(), null);
assert.strictEqual(authService.isLoggedIn(), false);
assert.strictEqual(mockStorage.get('auth'), undefined);

console.log('AuthService unit self-check passed');
