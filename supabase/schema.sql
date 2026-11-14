-- Veil Health Supabase Schema
-- RLS enabled on all tables with ZERO public policies
-- All reads and writes must go through server-side Next.js API routes using the Supabase Service Role Key.

create table if not exists blobs (
  record_id bigint primary key,
  ciphertext text not null,
  iv text not null,
  content_hash text not null,
  created_at timestamptz default now()
);

create table if not exists key_wraps (
  record_id bigint not null,
  grantee text not null,            -- lowercase 0x Ethereum address
  ephemeral_pub text not null,      -- JSON-stringified JWK or hex
  iv text not null,                 -- base64 IV for key wrap
  wrapped_key text not null,        -- base64 wrapped AES-GCM key
  created_at timestamptz default now(),
  primary key (record_id, grantee)
);

-- Enable Row Level Security (RLS)
alter table blobs enable row level security;
alter table key_wraps enable row level security;

-- ZERO public policies are defined:
-- By default with RLS enabled and no policies, public access (anon key) is completely denied.
-- Only the privileged service_role key used in Next.js API routes can access these tables.

