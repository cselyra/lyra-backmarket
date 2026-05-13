-- À exécuter dans Supabase → SQL Editor
-- Prérequis : aller dans Database → Extensions → activer "pg_cron"

-- Libère les réservations non payées après 7 jours (cohérent avec l'expiration du lien Lyra)
select cron.schedule(
  'expire-reservations',
  '0 * * * *',
  $$
    update reservations
    set status = 'cancelled'
    where status = 'reserved'
      and created_at < now() - interval '7 days';
  $$
);

-- Pour vérifier que le job est bien enregistré :
-- select * from cron.job;

-- Pour modifier l'intervalle (ex: 24h au lieu de 7j) :
-- select cron.unschedule('expire-reservations');
-- puis relancer le select cron.schedule ci-dessus avec interval '24 hours'
