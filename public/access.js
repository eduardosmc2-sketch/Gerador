'use strict';
const el = id => document.getElementById(id);
async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.error || 'Não foi possível concluir. Tente novamente.'); err.status = res.status; throw err; }
  return data;
}
function message(id, text, ok = false) { el(id).textContent = text; el(id).classList.toggle('ok', ok); }
async function submit(form, messageId, task) {
  const button = form.querySelector('button[type=submit]'); button.disabled = true; message(messageId, '');
  try { await task(); } catch (err) { message(messageId, err.message); } finally { button.disabled = false; }
}
if (el('loginform')) {
  request('/api/auth?action=me').then(() => location.replace('/api/app')).catch(() => {});
  el('loginform').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, 'message', async () => {
    await request('/api/auth?action=login', { method: 'POST', body: JSON.stringify({ email: el('email').value, password: el('password').value }) });
    el('password').value = ''; location.replace('/api/app');
  }); });
}
if (el('account')) {
  let page = 1;
  async function loadUsers() {
    message('listMessage', 'Carregando…');
    try {
      const data = await request('/api/users?page=' + page);
      el('users').replaceChildren();
      for (const user of data.users) {
        const tr = document.createElement('tr');
        const name = document.createElement('td'); name.append(document.createTextNode(user.name || 'Sem nome'), document.createElement('br'));
        const email = document.createElement('small'); email.textContent = user.email; name.append(email); tr.append(name);
        const role = document.createElement('td'); role.textContent = user.role === 'admin' ? 'Administrador' : 'Usuário'; tr.append(role);
        const status = document.createElement('td'); const badge = document.createElement('span'); badge.className = 'badge' + (user.disabled ? ' inactive' : ''); badge.textContent = user.disabled ? 'Desativado' : 'Ativo'; status.append(badge); tr.append(status);
        const action = document.createElement('td');
        if (user.role !== 'admin') {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = user.disabled ? 'Reativar' : 'Desativar';
          button.onclick = async () => {
            if (!confirm(`${user.disabled ? 'Reativar' : 'Desativar'} o acesso de ${user.email}?`)) return;
            button.disabled = true;
            try { await request('/api/users', { method: 'PATCH', body: JSON.stringify({ id: user.id, disabled: !user.disabled }) }); await loadUsers(); }
            catch (err) { message('listMessage', err.message); button.disabled = false; }
          }; action.append(button);
        } else { action.textContent = '—'; }
        tr.append(action); el('users').append(tr);
      }
      el('page').textContent = 'Página ' + page; el('prev').disabled = page <= 1; el('next').disabled = !data.hasMore; message('listMessage', data.users.length ? '' : 'Nenhum usuário nesta página.');
    } catch (err) { message('listMessage', err.message); if (err.status === 401) location.replace('/'); }
  }
  request('/api/auth?action=me').then(data => {
    el('identity').textContent = data.user.email; el('account').hidden = false;
    if (data.user.role === 'admin') { el('adminarea').hidden = false; loadUsers(); }
  }).catch(err => { if (err.status === 401) location.replace('/'); else message('fatal', err.message); });
  el('reload').onclick = loadUsers;
  el('prev').onclick = () => { if (page > 1) { page--; loadUsers(); } };
  el('next').onclick = () => { page++; loadUsers(); };
  el('createform').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, 'createMessage', async () => {
    await request('/api/users', { method: 'POST', body: JSON.stringify({ name: el('name').value, email: el('newemail').value, password: el('newpassword').value }) });
    el('createform').reset(); message('createMessage', 'Usuário criado. Ele já pode entrar com o e-mail e a senha informados.', true); page = 1; await loadUsers();
  }); });
  el('passwordform').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, 'passwordMessage', async () => {
    if (el('changepassword').value !== el('confirmpassword').value) throw new Error('A confirmação da senha não coincide.');
    await request('/api/auth?action=password', { method: 'POST', body: JSON.stringify({ currentPassword: el('currentpassword').value, password: el('changepassword').value }) });
    el('passwordform').reset(); location.replace('/');
  }); });
}
document.querySelectorAll('#logout').forEach(button => { button.onclick = async () => {
  button.disabled = true;
  try { await request('/api/auth?action=logout', { method: 'POST', body: '{}' }); location.replace('/'); }
  catch (err) { alert(err.message); button.disabled = false; }
}; });
if (el('ebo-account')) {
  request('/api/auth?action=me').then(data => {
    el('ebo-account').textContent = data.user.role === 'admin' ? 'Minha conta e usuários' : 'Minha conta';
  }).catch(err => { if (err.status === 401) location.replace('/'); });
}
