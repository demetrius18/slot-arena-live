-- Corregge i tornei che erano stati archiviati ma riportati erroneamente a "live".
-- Non elimina e non modifica partecipanti, crediti o classifiche.

update public.tournaments
set status = 'completed'
where completed_at is not null
  and status <> 'completed';

notify pgrst, 'reload schema';

select id, name, status, created_at, completed_at
from public.tournaments
order by created_at desc;
