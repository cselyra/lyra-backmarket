-- À exécuter dans l'éditeur SQL de Supabase (Dashboard → SQL Editor)

-- Table stock_items
create table if not exists stock_items (
  id              text primary key,
  type            text not null check (type in ('pc', 'screen')),
  model           text not null,
  serial_number   text not null,
  price           numeric(10,2) not null,

  -- Champs PC uniquement
  processor       text,
  ram             text,
  storage         text,
  exterior_condition text,
  battery_health  numeric(4,2),
  warranty_end    date,

  -- Champs écran uniquement
  size            numeric(5,1),

  comment         text,
  created_at      timestamptz default now()
);

-- Table reservations
create table if not exists reservations (
  id              text primary key,
  item_id         text not null references stock_items(id),
  item_type       text not null check (item_type in ('pc', 'screen')),
  serial_number   text not null,
  model           text not null,
  price           numeric(10,2) not null,
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  status          text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
  lyra_order_id   text,
  payment_url     text,
  created_at      timestamptz default now(),
  paid_at         timestamptz
);

-- Index utiles
create index if not exists idx_reservations_item_id on reservations(item_id);
create index if not exists idx_reservations_status  on reservations(status);
create index if not exists idx_reservations_email   on reservations(email);

-- Row Level Security : le backend utilise la clé service_role (bypass RLS)
-- Ces policies protègent contre les accès directs depuis le frontend avec la clé anon
alter table stock_items  enable row level security;
alter table reservations enable row level security;

-- Lecture du stock autorisée publiquement (clé anon)
create policy "stock_items: lecture publique"
  on stock_items for select using (true);

-- Toutes les écritures passent par le backend (service_role uniquement)
-- Aucune policy INSERT/UPDATE/DELETE sur les tables = bloqué pour la clé anon
