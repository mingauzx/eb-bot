# EB do Alpha • Central de Boas-vindas

Dashboard administrativo escuro e responsivo, API Node.js preparada para Vercel e bot Discord.js em processo contínuo separado. PostgreSQL compartilhado salva a configuração por servidor. Não usa imagens geradas: você define o link direto HTTPS de um GIF/banner, exibido sem texto sobreposto.

## Funcionalidades

- Ativar/desativar a recepção automática e selecionar canal.
- Personalizar título, descrição, cor e GIF/banner.
- Adicionar de zero a cinco botões de link, com nome, emoji opcional e estado ativo/inativo.
- Prévia ao vivo, aviso de alterações não salvas e mensagem de teste.
- Variáveis: `{username}`, `{member}`, `{server}`, `{count}`.
- Login Discord OAuth2 e sessão individual de oito horas em cookie HttpOnly; cargos conferidos no backend a cada requisição; verificação de origem e limite persistente de testes.
- Token do Discord usado exclusivamente no backend/bot.

## Arquitetura

| Componente | Execução | Função |
| --- | --- | --- |
| public/ | Vercel, arquivos estáticos | Interface e prévia |
| api/index.js | Vercel Function Node.js | Login, configuração, canais e teste pela API REST Discord |
| bot/index.js | Host contínuo Node.js 24 | Gateway Discord e evento guildMemberAdd |
| PostgreSQL | Serviço externo | Configuração e limites de requisições |

O teste envia a **configuração salva**, mesmo com o sistema desativado. Não depende do processo Gateway estar online. Nenhuma mensagem é enviada ao iniciar o projeto. O bot atende somente ao servidor em DISCORD_GUILD_ID e consulta o banco em cada entrada, sem reiniciar para aplicar alterações. O mesmo token pode ser usado no backend REST e no processo Gateway, mas rode **apenas uma instância do bot**, para evitar mensagens duplicadas.

## 1. Preparar o Discord

1. Crie uma aplicação em https://discord.com/developers/applications e adicione o bot.
2. Em **Bot → Privileged Gateway Intents**, ative **Server Members Intent**. Não precisa de Message Content Intent.
3. Copie o token diretamente para as variáveis do host. Nunca envie tokens pelo chat, commit ou formulário do painel.
4. Em OAuth2 → URL Generator, selecione o escopo **bot** e permissões **View Channels**, **Send Messages**, **Embed Links**. Convide ao servidor do EB do Alpha. Não precisa conceder Administrador.
5. Ative o modo desenvolvedor no Discord e copie o ID do servidor para DISCORD_GUILD_ID.
6. Confirme que as permissões do canal permitem ao bot visualizar e enviar embeds. A lista do painel mostra canais de texto/anúncios do servidor; sobrescritas de permissões podem impedir o envio. O botão de teste permite conferir isso.
7. Emojis personalizados devem estar disponíveis ao bot; se vierem de outro servidor, pode ser necessária a permissão **Use External Emojis**.

## 2. Banco e ambiente local

Requer Node.js 24 e PostgreSQL externo (ex.: Neon ou Supabase). Em produção use conexão TLS verificada, preferencialmente a URL com pool de conexões do provedor. Não desative a validação do certificado.

```sh
npm install
cp .env.example .env
# Preencha .env localmente
npm run db:init
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env` no lugar de cp. Abra http://localhost:3000. Em outro terminal, execute `npm start` para iniciar o bot.

| Variável | Dashboard | Bot | Descrição |
| --- | --- | --- | --- |
| DATABASE_URL | Sim | Sim | Mesmo PostgreSQL para ambos; mantenha parâmetros TLS do provedor |
| DISCORD_TOKEN | Sim | Sim | Token do bot; somente servidor |
| DISCORD_GUILD_ID | Sim | Sim | ID do servidor alvo |
| APP_ORIGIN | Sim | Não | Origem exata do dashboard, sem caminho (ex.: https://eb-bot.vercel.app) |
| DISCORD_CLIENT_ID | Sim | Não | Application ID da aplicação Discord do bot |
| DISCORD_CLIENT_SECRET | Sim | Não | Client Secret em OAuth2; não é o token do bot |
| SESSION_SECRET | Sim | Não | Segredo aleatório de pelo menos 32 caracteres |
| PORT | Local | Não | Porta local, padrão 3000 |

Gere SESSION_SECRET localmente com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Este segredo assina cookies; não é uma senha para o usuário. Trocar SESSION_SECRET invalida todas as sessões. ADMIN_PASSWORD não é mais usada e pode ser removida da Vercel. As sessões antigas de senha são rejeitadas.

### Login Discord e cargos autorizados

No [Discord Developer Portal](https://discord.com/developers/applications), abra a aplicação do bot:

1. Em **General Information**, copie **Application ID** para DISCORD_CLIENT_ID.
2. Em **OAuth2**, copie **Client Secret** para DISCORD_CLIENT_SECRET. Nunca publique nem envie esse segredo pelo chat.
3. Em **OAuth2 → Redirects**, adicione exatamente **https://eb-bot.vercel.app/api/auth/callback**. Se usar outro domínio, use o mesmo domínio de APP_ORIGIN seguido de /api/auth/callback.
4. Salve no Discord, configure as variáveis na Vercel para Production e faça Redeploy.
5. No painel, clique em **Entrar com Discord** e autorize sua conta. O único escopo solicitado é identify; email e lista de servidores não são coletados.

Para desenvolvimento local, adicione também http://localhost:3000/api/auth/callback aos Redirects e use APP_ORIGIN=http://localhost:3000.

O backend usa o token do bot para consultar o membro no servidor de DISCORD_GUILD_ID, tanto no callback quanto em cada leitura/salvamento/teste. Não há acesso implícito por permissão Administrator, posição hierárquica ou propriedade do servidor: é obrigatório possuir pelo menos um dos cargos abaixo.

| Cargo | ID |
| --- | --- |
| ADM | 1545550460763770993 |
| ADM Geral | 1545550460763770996 |
| Patrono | 1562882324104876062 |
| Criador | 1545550460763770997 |

A lista está em lib/oauth.js. Quem não está no servidor ou não tem um desses cargos recebe acesso negado. Falhas na API Discord bloqueiam o acesso. A remoção de cargo bloqueia a próxima requisição, sem esperar a sessão expirar. O estado OAuth é assinado, vinculado ao navegador por cookie HttpOnly SameSite=Lax e expira em dez minutos. O token OAuth é usado no servidor para identificar a conta e sua revogação é solicitada em seguida; não é armazenado nem enviado ao navegador.

A migração é idempotente e cria welcome_settings e request_limits. Rode uma vez antes de usar cada banco. Não ocorre automaticamente em cada requisição e não acontece durante o build da Vercel. Se usar Preview Deployments, utilize banco/servidor de teste separados ou não configure segredos nas previews.

## 3. Importar na Vercel

1. **Add New → Project → Import Git Repository → mingauzx/eb-bot**.
2. **Root Directory:** raiz do repositório. **Framework Preset:** Other.
3. **Install Command:** npm install. **Build Command:** npm run build. **Output Directory:** public. O vercel.json já contém essas definições e encaminha /api/* para a função Node.js.
4. Adicione as variáveis do dashboard da tabela acima. Use Node.js **24.x**.
5. Defina APP_ORIGIN com a URL final do projeto (por exemplo https://eb-bot.vercel.app). Depois de conhecer a URL real, ajuste a variável e faça Redeploy. Caso use domínio próprio, atualize APP_ORIGIN e faça outro deploy.
6. Execute `npm run db:init` localmente com a DATABASE_URL do banco escolhido antes de acessar o painel.
7. Abra a URL HTTPS, entre com Discord usando uma conta com um cargo autorizado, escolha canal e personalize a mensagem. Salve, envie teste e depois ative o sistema.

O frontend **não** precisa de variáveis públicas e nenhum segredo deve receber prefixo NEXT_PUBLIC_ ou VITE_. A Vercel publica apenas public/ e as rotas da API; arquivos de bot e .env não são disponibilizados como assets. **Não inicie o bot no build nem em uma Vercel Function:** a conexão Gateway exige processo contínuo.

## 4. Bot em hospedagem contínua

Em um host que suporte workers Node.js ou contêineres sempre ativos:

- Conecte este repositório e mantenha a raiz.
- Build/install: `npm install --omit=dev`.
- Start: `npm start`.
- Defina DATABASE_URL, DISCORD_TOKEN e DISCORD_GUILD_ID com os mesmos valores do dashboard.
- Configure uma única réplica e reinício automático em falha.
- O processo não expõe HTTP: configure como **worker**, sem domínio ou healthcheck HTTP. Não use serviços que suspendem o processo por inatividade.
- Verifique nos logs “EB do Alpha conectado como …”.
- Para VPS, use o Dockerfile e política restart unless-stopped, ou um gerenciador de processos.

Exemplo Docker, com .env local preenchido e banco já migrado:

```sh
docker build -t eb-alpha-welcome .
docker run -d --name eb-alpha-welcome --restart unless-stopped --env-file .env eb-alpha-welcome
docker logs -f eb-alpha-welcome
```

O Dockerfile inicia apenas o bot. Para o painel, use a Vercel. Se o bot está em outro host, não precisa expor uma API pública entre os dois: ambos acessam o mesmo PostgreSQL.

## Verificação e operação

```sh
npm test
npm run check
```

Os testes cobrem validação, variáveis, imagens, limite e estado de botões, menções, sessões e fluxo HTTP de login/salvamento/teste, usando banco e Discord simulados. O teste real exige credenciais: salve o canal, envie um teste e faça uma conta de teste entrar no servidor, confirmando a recepção e os botões. Desative a recepção e repita a entrada para verificar que não envia. Não há envio de mensagens nem acesso ao banco durante os testes unitários.

Se o login falhar: confira APP_ORIGIN exato, Client ID, Client Secret, SESSION_SECRET, Redirects no Discord e a presença do bot no servidor. O login Discord não depende do banco; carregar/salvar configurações exige banco e migração. Se uma entrada não gerar mensagem: confira processo do bot, intent Server Members, sistema ativado, canal, banco compartilhado e permissões. Se a imagem não carregar, use uma URL HTTPS pública e direta para o arquivo, sem autenticação. A prévia é aproximada, com texto seguro sem executar HTML; o Discord renderiza Markdown na mensagem final.

Testes de mensagem têm limite persistente por servidor (3/minuto). Pode remover registros antigos periodicamente com `DELETE FROM request_limits WHERE expires_at < NOW() - INTERVAL '1 day';`.

## Referências

- Vercel Node.js: https://vercel.com/docs/functions/runtimes/node-js
- Discord Gateway Intents: https://discordjs.guide/legacy/popular-topics/intents
- Discord.js: https://discord.js.org/docs/packages/discord.js/14.27.0
