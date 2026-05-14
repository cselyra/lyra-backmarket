-- Seed de test — 4 réservations payées
-- À exécuter dans Supabase Dashboard → SQL Editor

-- Articles de test (préfixe TEST_ pour les retrouver facilement)
insert into stock_items (id, type, model, serial_number, price, processor, ram, storage, exterior_condition, battery_health, warranty_end)
values
  ('TEST-PC-001', 'pc', 'Lenovo ThinkPad X1 Carbon', 'SN-X1C-001', 349.00, 'Intel Core i5 — 8e génération', '16 Go', '256 Go SSD', 'Très bon état', 0.87, '2025-12-31'),
  ('TEST-PC-002', 'pc', 'Dell Latitude 5420', 'SN-LAT-002', 279.00, 'Intel Core i7 — 10e génération', '8 Go', '512 Go SSD', 'Bon état', 0.72, null),
  ('TEST-PC-003', 'pc', 'HP EliteBook 840 G7', 'SN-HP-003', 299.00, 'Intel Core i5 — 10e génération', '16 Go', '256 Go SSD', 'Bon état', 0.91, '2026-06-30'),
  ('TEST-SCR-001', 'screen', 'Dell UltraSharp U2422H', 'SN-SCR-001', 149.00, null, null, null, null, null, null)
on conflict (id) do nothing;

-- Réservations payées
insert into reservations (id, item_id, item_type, serial_number, model, price, first_name, last_name, email, status, created_at, paid_at)
values
  ('TEST-RES-001', 'TEST-PC-001', 'pc', 'SN-X1C-001', 'Lenovo ThinkPad X1 Carbon', 349.00, 'Sophie', 'Martin', 'sophie.martin@email.fr', 'paid', now() - interval '2 days', now() - interval '1 day 20 hours'),
  ('TEST-RES-002', 'TEST-PC-002', 'pc', 'SN-LAT-002', 'Dell Latitude 5420', 279.00, 'Thomas', 'Bernard', 'thomas.bernard@email.fr', 'paid', now() - interval '1 day', now() - interval '23 hours'),
  ('TEST-RES-003', 'TEST-PC-003', 'pc', 'SN-HP-003', 'HP EliteBook 840 G7', 299.00, 'Julie', 'Dupont', 'julie.dupont@email.fr', 'paid', now() - interval '12 hours', now() - interval '10 hours'),
  ('TEST-RES-004', 'TEST-SCR-001', 'screen', 'SN-SCR-001', 'Dell UltraSharp U2422H', 149.00, 'Marc', 'Leroy', 'marc.leroy@email.fr', 'paid', now() - interval '6 hours', now() - interval '4 hours')
on conflict (id) do nothing;
