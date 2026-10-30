const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../api/auth');
const users = require('../api/users');
const app = require('../api/app');
const { sameOrigin } = require('../lib/auth');
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-secret-test';
process.env.ADMIN_EMAIL = 'admin@example.com';
const admin = { id: '11111111-1111-1111-1111-111111111111', email: 'admin@example.com', app_metadata: {}, user_metadata: {} };
const ordinary = { id: '22222222-2222-2222-2222-222222222222', email: 'user@example.com', app_metadata: { role: 'user' }, user_metadata: {} };
const originalFetch = global.fetch;
let calls;
beforeEach(() => { calls = []; });
afterEach(() => { global.fetch = originalFetch; });
function mock(responses) { global.fetch = async (url, options) => { calls.push({ url, options }); const value = responses.shift(); assert.ok(value, 'unexpected fetch'); return { ok: value.status < 400, status: value.status, json: async () => value.data }; }; }
function req(method = 'GET', body, loggedIn = true, query = {}) { return { method, body, query, headers: { host: 'ebo.example.com', origin: 'https://ebo.example.com', 'content-type': 'application/json', ...(loggedIn ? { cookie: '__Host-ebo_session=test-access' } : {}) } }; }
function res() { return { headers: {}, code: 200, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(data) { this.data = data; }, send(data) { this.data = data; }, end() {}, redirect(code, path) { this.code = code; this.location = path; } }; }
test('unauthenticated generator redirects without sending source', async () => { const r = res(); await app(req('GET', null, false), r); assert.equal(r.code, 302); assert.equal(r.location, '/'); assert.equal(r.data, undefined); });
test('unauthenticated users API returns 401', async () => { const r = res(); await users(req('GET', null, false), r); assert.equal(r.code, 401); assert.equal(calls.length, 0); });
test('ordinary user cannot create users even by direct API call', async () => { mock([{ status: 200, data: ordinary }]); const r = res(); await users(req('POST', { email: 'attacker@example.com', role: 'admin' }), r); assert.equal(r.code, 403); assert.equal(calls.length, 1); });
test('administrator creates only normal users; ignores supplied admin role', async () => { mock([{ status: 200, data: admin }, { status: 200, data: ordinary }]); const r = res(); await users(req('POST', { name: 'Pessoa', email: 'USER@example.com', password: 'long-enough-password', role: 'admin', app_metadata: { role: 'admin' } }), r); assert.equal(r.code, 201); const sent = JSON.parse(calls[1].options.body); assert.deepEqual(sent.app_metadata, { role: 'user', disabled: false }); assert.equal(sent.email, 'user@example.com'); assert.ok(!JSON.stringify(r.data).includes('server-secret-test')); });
test('cross-origin POST is rejected before creating users', async () => { mock([{ status: 200, data: admin }]); const request = req('POST', {}); request.headers.origin = 'https://evil.example'; const r = res(); await users(request, r); assert.equal(r.code, 403); assert.equal(calls.length, 1); });
test('missing Origin is rejected', () => { assert.throws(() => sameOrigin({ headers: { host: 'ebo.example.com' } }), { status: 403 }); });
test('disabled user with valid token is rejected', async () => { mock([{ status: 200, data: { ...ordinary, app_metadata: { disabled: true } } }]); const r = res(); await auth(req('GET', null, true, { action: 'me' }), r); assert.equal(r.code, 401); });
test('login emits HttpOnly Secure SameSite cookie and never returns token', async () => { mock([{ status: 200, data: { access_token: 'opaque-token', expires_in: 3600, user: ordinary } }]); const r = res(); await auth(req('POST', { email: 'user@example.com', password: 'password' }, false, { action: 'login' }), r); assert.equal(r.code, 200); assert.match(r.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/); assert.ok(!JSON.stringify(r.data).includes('opaque-token')); });
test('admin cannot deactivate own account', async () => { mock([{ status: 200, data: admin }]); const r = res(); await users(req('PATCH', { id: admin.id, disabled: true }), r); assert.equal(r.code, 400); assert.equal(calls.length, 1); });
test('deactivation persists disabled metadata and bans authentication', async () => { mock([{ status: 200, data: admin }, { status: 200, data: ordinary }, { status: 200, data: { ...ordinary, app_metadata: { disabled: true } } }]); const r = res(); await users(req('PATCH', { id: ordinary.id, disabled: true }), r); assert.equal(r.code, 200); const sent = JSON.parse(calls[2].options.body); assert.equal(sent.app_metadata.disabled, true); assert.equal(sent.ban_duration, '876000h'); });
test('generator served only after successful session validation', async () => { mock([{ status: 200, data: ordinary }]); const r = res(); await app(req(), r); assert.equal(r.code, 200); assert.match(r.data, /Gerador de Exportação EBO/); assert.match(r.data, /v1\.9/); assert.equal(r.headers['Cache-Control'], 'no-store'); });
test('short initial password rejected without admin mutation', async () => { mock([{ status: 200, data: admin }]); const r = res(); await users(req('POST', { name: 'Pessoa', email: 'user@example.com', password: '123' }), r); assert.equal(r.code, 400); assert.equal(calls.length, 1); });
test('password change requires correct current password', async () => { mock([{ status: 200, data: ordinary }, { status: 400, data: {} }]); const r = res(); await auth(req('POST', { currentPassword: 'wrong', password: 'long-enough-password' }, true, { action: 'password' }), r); assert.equal(r.code, 401); assert.equal(calls.length, 2); });
