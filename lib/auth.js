const COOKIE = '__Host-ebo_session';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function headers(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
}
function json(res, status, data) { headers(res); return res.status(status).json(data); }
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.ADMIN_EMAIL) throw new HttpError(503, 'Configure o acesso do projeto na Vercel.');
  if (!/^https:\/\/[a-z0-9.-]+\/?$/i.test(url)) throw new HttpError(503, 'Configuração de autenticação inválida.');
  return { url: url.replace(/\/$/, ''), key };
}
async function supabase(path, { method = 'GET', body, token } = {}) {
  const { url, key } = config();
  const response = await fetch(url + '/auth/v1/' + path, {
    method, headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(12000)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}
function tokenOf(req) {
  const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  return value ? value.slice(COOKIE.length + 1) : '';
}
function cookie(res, token = '', seconds = 0) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`);
}
function isAdmin(user) {
  return user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase() || user.app_metadata?.role === 'admin';
}
async function session(req, admin = false) {
  const token = tokenOf(req);
  if (!token || token.length > 10000) throw new HttpError(401, 'Entre com seu e-mail e senha.');
  const result = await supabase('user', { token });
  if (!result.ok || !result.data.id || result.data.app_metadata?.disabled === true || (result.data.banned_until && new Date(result.data.banned_until) > new Date())) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
  const user = result.data;
  if (admin && !isAdmin(user)) throw new HttpError(403, 'Acesso exclusivo para administradores.');
  return { user, token, admin: isAdmin(user) };
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host || origin !== 'https://' + host) throw new HttpError(403, 'Origem da solicitação inválida.');
}
function bodyOf(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Envie dados em JSON.');
  if (Number(req.headers['content-length'] || 0) > 8192) throw new HttpError(413, 'Solicitação muito grande.');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new HttpError(400, 'Dados inválidos.'); } }
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 8192) throw new HttpError(400, 'Dados inválidos.');
  return body;
}
function publicUser(user) { return { id: user.id, email: user.email || '', name: user.user_metadata?.name || '', role: isAdmin(user) ? 'admin' : 'user', disabled: user.app_metadata?.disabled === true, createdAt: user.created_at }; }
function handle(handler) { return async (req, res) => { headers(res); try { await handler(req, res); } catch (error) { json(res, error.status || 503, { error: error.status ? error.message : 'Não foi possível acessar o serviço. Tente novamente.' }); } }; }
module.exports = { HttpError, headers, json, supabase, cookie, session, sameOrigin, bodyOf, publicUser, handle, isAdmin };
