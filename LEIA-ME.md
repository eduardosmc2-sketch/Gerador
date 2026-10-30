# Gerador EBO v1.9 — acesso online

Esta versão acrescenta login por e-mail e senha e administração de usuários à geração EBO 6/7 da v1.8. Os XMLs continuam sendo montados no navegador. O HTML do gerador é entregue por uma função autenticada; apenas a tela de entrada e seus recursos visuais são públicos.

## 1. Criar o serviço de contas

1. Acesse https://supabase.com/dashboard e crie um projeto.
2. Em Authentication, nas configurações de usuários/sign up, **desative o cadastro de novos usuários pelo público** (Allow new users to sign up). As contas serão criadas pela administração.
3. Em Authentication → Users → Add user → Create new user, crie seu primeiro usuário com seu e-mail e uma senha forte. Marque a confirmação automática do e-mail. Guarde a senha; não é necessário enviar para o ChatGPT.
4. Nas configurações do projeto, copie a Project URL e a chave secreta de servidor `service_role` (em API Keys, seção Legacy, caso haja mais de um tipo). Não use a chave `anon` neste campo.

## 2. Atualizar o repositório

Extraia este pacote e copie seu conteúdo para a pasta do repositório Gerador, preservando as subpastas api, lib, private e public. Inclua também .gitignore.

Remova o antigo index.html da raiz do repositório e o antigo LEIA-ME.txt. O novo index.html fica em public/. Não coloque generator.html dentro de public/.

No terminal aberto na pasta do repositório:

```bash
git add .
git commit -m "Adicionar login e gestao de usuarios"
git push
```

O pacote substitui o antigo vercel.json. A configuração de aplicação continua Other. O diretório de saída passa a public e não há etapa de compilação. Se houver configurações antigas sobrescrevendo isso no painel, ajuste-as.

## 3. Configurar a Vercel

No projeto existente, abra Settings → Environment Variables e adicione:

| Nome | Valor |
| --- | --- |
| SUPABASE_URL | Project URL do Supabase, por exemplo https://xxxxx.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | Chave service_role, somente no ambiente do servidor |
| ADMIN_EMAIL | Exatamente o e-mail do primeiro usuário criado no Supabase |

Habilite para Production. Se quiser testar Preview, configure também nesse ambiente. Salve e faça um novo deploy/redeploy. A chave secreta não deve estar no GitHub, em arquivos HTML ou em mensagens do chat. O .env.example contém apenas exemplos, sem segredos.

## 4. Usar

1. Abra o endereço HTTPS do projeto e entre com seu e-mail e senha.
2. No cabeçalho, clique em Minha conta e usuários.
3. Informe nome, e-mail e senha inicial de pelo menos 12 caracteres para criar uma conta.
4. Entregue a senha inicial à pessoa por um canal adequado. Não há envio automático de e-mail nesta versão.
5. A pessoa entra pelo mesmo endereço e pode trocar a senha em Minha conta.
6. Use Desativar/Reativar para controlar os demais acessos. Usuários comuns não podem cadastrar contas.

A sessão dura até uma hora; depois é necessário entrar novamente. A interface de contas lista 50 usuários por página. Para recuperar uma senha esquecida, use a administração do Supabase. O primeiro administrador é identificado pelo ADMIN_EMAIL configurado no servidor; novas contas sempre são usuários comuns.

O HTML offline v1.8 é um arquivo separado e continua sem login. Não publique a cópia offline no mesmo site protegido, pois ela permitiria abrir o gerador sem autenticação. Como em qualquer aplicativo que executa código no navegador, uma pessoa autorizada pode salvar o conteúdo que recebeu; o login controla o acesso ao site.

## Validação desta entrega

Os testes automatizados verificam bloqueio sem sessão, permissões de administrador, rejeição de solicitações de outra origem, criação de contas sem escalada de privilégios, desativação, cookie de sessão e troca de senha. Usam respostas simuladas do serviço de contas.

A conexão real com Supabase e a publicação na sua Vercel precisam ser configuradas e verificadas após as etapas acima. A geração EBO usa a base v1.8, cuja importação você confirmou no EBO 6 e 7; esta entrega não foi importada novamente no EBO.
