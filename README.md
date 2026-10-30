# Slot Arena Live 2.0 — Database

Questa versione conserva il salvataggio locale e aggiunge:

- database Supabase;
- accesso amministratore;
- aggiornamento live tra regia e monitor;
- creazione e archivio dei tornei;
- storico consultabile.

## Attivazione iniziale

1. Apri il progetto Supabase.
2. Vai in **SQL Editor**, crea una nuova query e incolla tutto il contenuto di `database-setup.sql`.
3. Premi **Run**.
4. Vai in **Authentication → Users → Add user**.
5. Crea l'email e la password dell'amministratore.
6. Carica su GitHub tutti i file e la cartella `audio`.

Non caricare mai nel progetto una chiave `service_role`, una secret key o la password del database.

## Utilizzo

1. Apri il pannello amministratore.
2. Accedi nella sezione **Database torneo**.
3. Inserisci un nome e premi **Nuovo torneo**.
4. Da quel momento ogni modifica viene salvata localmente e nel cloud.
5. Sul monitor apri lo stesso indirizzo GitHub Pages: la classifica viene caricata e aggiornata in tempo reale.

Il pulsante **Archivia attuale** conserva il risultato finale. Il pulsante **Storico tornei** permette di riaprire gli eventi salvati.

I tornei archiviati vengono aperti in **sola lettura**, così il salvataggio automatico non può alterare lo storico.

## Correzione per versioni precedenti

Se un torneo già archiviato appare ancora come `LIVE`, eseguire una volta
`database-fix-archive.sql` nel SQL Editor di Supabase. Lo script corregge lo
stato senza eliminare partecipanti, crediti o classifiche.

## Privacy

Usare nomi di gara, iniziali o codici. Non inserire numeri di conto, documenti, depositi, recapiti o altri dati personali non necessari.
