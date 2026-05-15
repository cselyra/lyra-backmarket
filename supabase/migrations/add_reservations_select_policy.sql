-- Permet au frontend (clé anon) de lire item_id et status pour afficher la disponibilité
create policy "reservations: lecture publique"
  on reservations for select using (true);
