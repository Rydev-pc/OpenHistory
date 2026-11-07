# Open History

Guia de história minimalista: fatos históricos, buscas na Wikipédia em português, curiosidades "Você sabia?" e a seção **Apoie este Criador** — com um painel de administrador completo (usuários, conteúdo, fontes, métricas em tempo real, auditoria).

- **App do usuário** (`app/`): React + Vite. Feed, Fato do dia, "Surpreenda-me", busca, curiosidades, apoio com QR Code Pix dinâmico.
- **Painel admin** (`admin/`): React + Vite + Recharts. Login com papéis (admin/editor/viewer), dashboard em tempo real (SSE), CRUDs, gestão do apoio, configurações editáveis e logs de auditoria.
- **API** (`server/`): Node + Express + SQLite nativo (`node:sqlite`), JWT próprio (HMAC), rate limiting, sanitização de HTML, QR Code Pix (EMV BR Code).
- **Supabase** (`supabase/schema.sql`): schema Postgres equivalente com políticas RLS, para quem preferir hospedar no Supabase.

## Requisitos

- Node.js 20+ (testado no Node 26; sem dependências nativas — o SQLite é builtin)

## Instalação e execução

```bash
cd ~/OpenHistory
npm run install:all      # instala dependências de server, app e admin

# 1) banco + dados iniciais (cria o usuário administrador)
cd server && npm run seed && cd ..

# 2) subir a API (porta 3001)
npm run server

# 3) app do usuário (porta 5173)  — terminal separado
npm run app

# 4) painel admin (porta 5174)    — terminal separado
npm run admin
```

Acesse:

| Onde | URL |
|---|---|
| App | http://localhost:5173 |
| Painel | http://localhost:5174 |
| API | http://localhost:3001/api/health |

### Modo produção (porta única)

```bash
npm run build:app
npm run build:admin
npm run server            # serve o app em / e o painel em /admin
```

## Acesso inicial ao painel

- E-mail: `admin@openhistory.app`
- Senha: `admin123` — **troque após o primeiro login** (Usuários → Redefinir senha, ou edite o próprio usuário).

## Variáveis de ambiente (opcionais)

| Variável | Efeito |
|---|---|
| `PORT` | porta da API (padrão `3001`) |
| `JWT_SECRET` | segredo dos tokens (sem ela, um segredo é gerado em `server/data/.secret`) |
| `EUROPEANA_KEY` | habilita a busca de imagens/documentos na Europeana (`/api/europeana`) |

## Funcionalidades por papel

| Papel | Permissões |
|---|---|
| `viewer` | ver dashboard, fatos, curiosidades, fontes, apoio, feedback |
| `editor` | + criar/editar fatos, curiosidades, fontes, apoio, configurações, responder feedback |
| `admin` | + gestão de usuários, sessões ativas, auditoria, exclusões |

## Como funciona o "Apoie este Criador"

1. O admin edita criador, botões e meta em **Apoie o Criador** no painel.
2. O app mostra os botões ativos. No **Pix**, o QR Code é gerado dinamicamente (payload EMV/BR Code) a partir da chave cadastrada — clique em `Pix` para exibir.
3. Cliques e mensagens de apoio são registrados e aparecem nas métricas do dashboard em tempo real.
4. Mensagens de apoiadores passam pela moderação antes de aparecerem na lista pública.

## Estrutura

```
OpenHistory/
├── app/                 # React (usuário): Início, Buscar, Curiosidades, Apoiar
├── admin/               # React (painel): dashboard, CRUDs, logs
├── server/              # Express + SQLite: auth, API pública, API admin, SSE, Pix
│   ├── db.js            # schema + criação do banco
│   ├── seed.js          # dados iniciais
│   ├── lib/             # auth (JWT/scrypt), pix, sanitize, sse, ratelimit
│   └── routes/          # auth.js, public.js, admin.js
└── supabase/schema.sql  # schema Postgres + RLS para o Supabase
```

## Segurança

- Senhas com hash `scrypt`; tokens JWT HMAC-SHA256 com expiração de 12h; sessões revogáveis individualmente pelo admin.
- Rate limiting em login, heartbeat, feedback e mensagens de apoio.
- HTML sanitizado (allowlist de tags/atributos) em todo conteúdo enviado por usuários; senhas nunca trafegam de volta para o cliente.
- Logs de auditoria com valores antigos/novos, autor, IP e data; login e tentativas falhas registrados.

## Integração com Wikipédia (e Europeana)

- Busca: `GET /api/wikipedia?q=termo` — a API consulta a Wikipédia em português e devolve título, resumo e link "Ler mais na Wikipédia".
- Curiosidades: além da curadoria local, o servidor busca itens do template "Você sabia?" da Wikipédia (cache de 1h).
- Europeana: defina `EUROPEANA_KEY` para habilitar mídia histórica em `GET /api/europeana?q=termo`.
