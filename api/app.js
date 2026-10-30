const fs = require('node:fs');
const path = require('node:path');
const { session, headers } = require('../lib/auth');
module.exports = async (req, res) => {
  headers(res);
  if (req.method !== 'GET') return res.status(405).end();
  try { await session(req); }
  catch (error) {
    if (error.status === 401) return res.redirect(302, '/');
    return res.status(error.status || 503).send('Não foi possível validar o acesso. Volte à tela de entrada e tente novamente.');
  }
  const html = fs.readFileSync(path.join(process.cwd(), 'private', 'generator.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
