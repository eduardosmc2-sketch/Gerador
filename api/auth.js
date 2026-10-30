const { HttpError, json, supabase, cookie, session, sameOrigin, bodyOf, publicUser, handle } = require('../lib/auth');
module.exports = handle(async (req, res) => {
  const action = req.query.action;
  if (req.method === 'GET' && action === 'me') {
    const { user } = await session(req);
    return json(res, 200, { user: publicUser(user) });
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
  sameOrigin(req);
  if (action === 'login') {
    const body = bodyOf(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = body.password;
    if (!email || typeof password !== 'string' || password.length > 256) throw new HttpError(400, 'Informe e-mail e senha.');
    const result = await supabase('token?grant_type=password', { method: 'POST', body: { email, password } });
    if (!result.ok || !result.data.access_token || result.data.user?.app_metadata?.disabled === true) {
      if (result.status === 429) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
      throw new HttpError(401, 'E-mail ou senha inválidos, ou acesso desativado.');
    }
    cookie(res, result.data.access_token, Math.min(Number(result.data.expires_in) || 3600, 3600));
    return json(res, 200, { user: publicUser(result.data.user) });
  }
  if (action === 'logout') {
    const auth = await session(req).catch(() => null);
    cookie(res);
    if (auth) await supabase('logout?scope=local', { method: 'POST', token: auth.token }).catch(() => {});
    return json(res, 200, { ok: true });
  }
  if (action === 'password') {
    const { user } = await session(req);
    const { currentPassword, password } = bodyOf(req);
    if (typeof currentPassword !== 'string' || typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'Use uma nova senha de 12 a 128 caracteres.');
    const verified = await supabase('token?grant_type=password', { method: 'POST', body: { email: user.email, password: currentPassword } });
    if (!verified.ok) throw new HttpError(401, 'Senha atual incorreta.');
    const updated = await supabase('user', { method: 'PUT', token: verified.data.access_token, body: { password } });
    if (!updated.ok) throw new HttpError(400, 'Não foi possível alterar a senha. Escolha outra senha.');
    cookie(res);
    await supabase('logout?scope=global', { method: 'POST', token: verified.data.access_token });
    return json(res, 200, { ok: true });
  }
  throw new HttpError(404, 'Ação não encontrada.');
});
