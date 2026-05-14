-- À exécuter dans Supabase Dashboard → SQL Editor
alter table reservations add column if not exists payment_method text;
