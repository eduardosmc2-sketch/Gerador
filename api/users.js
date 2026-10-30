const { HttpError, json, supabase, session, sameOrigin, bodyOf, publicUser, handle } = require('../lib/auth');
module.exports = handle(async (req, res) => {
  const { user: actor } = await session(req, true);
  if (req.method === 'GET') {
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const result = await supabase(`admin/users?page=${page}&per_page=50`);
    if (!result.ok) throw new HttpError(503, 'Não foi possível carregar os usuários.');
    return json(res, 200, { users: (result.data.users || []).map(publicUser), page, hasMore: (result.data.users || []).length === 50 });
  }
  if (!['POST', 'PATCH'].includes(req.method)) throw new HttpError(405, 'Método não permitido.');
  sameOrigin(req);
  const body = bodyOf(req);
  if (req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const password = body.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 100 || typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'Informe nome, e-mail e uma senha de 12 a 128 caracteres.');
    // Permissões recebidas do navegador são ignoradas: novas contas são usuárias.
    const result = await supabase('admin/users', { method: 'POST', body: { email, password, email_confirm: true, user_metadata: { name }, app_metadata: { role: 'user', disabled: false } } });
    if (!result.ok) throw new HttpError(400, 'Não foi possível cadastrar. Confira se o e-mail já está em uso ou escolha outra senha.');
    return json(res, 201, { user: publicUser(result.data) });
  }
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof body.disabled !== 'boolean') throw new HttpError(400, 'Usuário inválido.');
  if (id === actor.id) throw new HttpError(400, 'Você não pode desativar o próprio acesso.');
  const previous = await supabase('admin/users/' + id);
  if (!previous.ok) throw new HttpError(404, 'Usuário não encontrado.');
  if (publicUser(previous.data).role === 'admin') throw new HttpError(400, 'O acesso de administradores deve ser gerenciado pelo responsável do projeto.');
  const result = await supabase('admin/users/' + id, { method: 'PUT', body: { app_metadata: { ...previous.data.app_metadata, disabled: body.disabled }, ban_duration: body.disabled ? '876000h' : 'none' } });
  if (!result.ok) throw new HttpError(503, 'Não foi possível atualizar o acesso.');
  return json(res, 200, { user: publicUser(result.data) });
});
