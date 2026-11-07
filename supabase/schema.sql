-- =============================================================
-- Open History — schema para Supabase (Postgres) + políticas RLS
-- Espelha as tabelas usadas pelo backend SQLite (server/db.js).
-- Execute no SQL Editor do Supabase, ou via supabase db push.
-- =============================================================

create table if not exists users (
  id bigint primary key generated always as identity,
  email text unique not null,
  name text not null default '',
  password_hash text not null default '',
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  status text not null default 'active' check (status in ('active','blocked')),
  provider text not null default 'email',
  reset_token text,
  reset_expires bigint,
  invite_token text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  last_ip text,
  last_device text
);

create table if not exists sessions (
  id bigint primary key generated always as identity,
  user_id bigint not null references users(id) on delete cascade,
  jti text unique not null,
  device text default '',
  ip text default '',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  revoked boolean not null default false
);

create table if not exists facts (
  id bigint primary key generated always as identity,
  title text not null,
  short_desc text not null default '',
  full_text text not null default '',
  source_name text default '',
  source_url text default '',
  category text default 'Geral',
  period text default '',
  image_url text default '',
  status text not null default 'published' check (status in ('published','draft')),
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists curiosities (
  id bigint primary key generated always as identity,
  title text not null,
  text text not null default '',
  source_name text default '',
  source_url text default '',
  status text not null default 'published' check (status in ('published','pending','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sources (
  id bigint primary key generated always as identity,
  name text not null,
  url text default '',
  type text not null default 'enciclopedia' check (type in ('enciclopedia','acervo','livro','artigo','outro')),
  description text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value text not null
);

create table if not exists suggestions (
  id bigint primary key generated always as identity,
  type text not null default 'sugestao' check (type in ('sugestao','correcao','curiosidade')),
  content text not null,
  contact text default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','answered')),
  response text default '',
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigint primary key generated always as identity,
  actor_id bigint,
  actor_email text default '',
  action text not null,
  entity text default '',
  entity_id text,
  old_value text,
  new_value text,
  ip text default '',
  created_at timestamptz not null default now()
);

create table if not exists support_buttons (
  id bigint primary key generated always as identity,
  label text not null,
  type text not null default 'custom' check (type in ('pix','kofi','buymeacoffee','patreon','paypal','github','custom')),
  url text default '',
  pix_key text default '',
  pix_name text default '',
  pix_city text default '',
  amount text default '',
  active boolean not null default true,
  sort int not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists support_messages (
  id bigint primary key generated always as identity,
  name text default 'Anonimo',
  message text not null,
  visible boolean not null default false,
  response text default '',
  created_at timestamptz not null default now()
);

create table if not exists support_clicks (
  id bigint primary key generated always as identity,
  button_id bigint,
  button_label text default '',
  created_at timestamptz not null default now()
);

create table if not exists searches (
  id bigint primary key generated always as identity,
  term text not null,
  results bigint default 0,
  created_at timestamptz not null default now()
);

create table if not exists accesses (
  id bigint primary key generated always as identity,
  path text default '/',
  ip text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_facts_status_facts on facts(status);
create index if not exists idx_audit_created_audit on audit_logs(created_at);
create index if not exists idx_searches_term_s on searches(term);
create index if not exists idx_accesses_created_a on accesses(created_at);
create index if not exists idx_clicks_created_c on support_clicks(created_at);

-- =============================================================
-- RLS
-- O backend (service_role) bypassa RLS. As políticas abaixo valem
-- para acesso direto via anon key e documento oficial de segurança.
-- =============================================================

alter table facts enable row level security;
alter table curiosities enable row level security;
alter table sources enable row level security;
alter table app_settings enable row level security;
alter table support_buttons enable row level security;
alter table support_messages enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table audit_logs enable row level security;
alter table suggestions enable row level security;
alter table support_clicks enable row level security;
alter table searches enable row level security;
alter table accesses enable row level security;

-- conteúdo público
create policy "fatos publicados visiveis" on facts
  for select using (status = 'published');
create policy "curiosidades publicadas visiveis" on curiosities
  for select using (status = 'published');
create policy "fontes ativas visiveis" on sources
  for select using (active = true);
create policy "settings visiveis" on app_settings
  for select using (true);
create policy "botoes de apoio visiveis" on support_buttons
  for select using (active = true);
create policy "mensagens publicas de apoio" on support_messages
  for select using (visible = true);

-- escrita anônima permitida apenas no necessário
create policy "qualquer um sugere" on suggestions
  for insert with check (status = 'pending');
create policy "qualquer um envia mensagem de apoio" on support_messages
  for insert with check (visible = false);
create policy "qualquer um registra clique" on support_clicks
  for insert with check (true);

-- dados sensíveis: somente via backend (service_role)
