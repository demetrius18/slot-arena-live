(function () {
  const cfg = window.SLOT_ARENA_CONFIG || {};
  const client = window.supabase?.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const ID_KEY = "slot-arena-cloud-tournament-id";
  let tournamentId = localStorage.getItem(ID_KEY);
  let channel;
  let session;
  let pendingState;
  let saveTimer;
  let lastSaved = "";
  let lastWrite = 0;
  let readOnly = false;
  let handlers = {};

  const status = (kind, text) => handlers.onStatus?.({ kind, text });
  const authChanged = () => handlers.onAuth?.(session?.user || null);

  async function findTournament() {
    if (tournamentId) {
      const { data } = await client.from("tournaments").select("*").eq("id", tournamentId).maybeSingle();
      if (data) return data;
      tournamentId = null;
      localStorage.removeItem(ID_KEY);
    }
    const { data, error } = await client
      .from("tournaments")
      .select("*")
      .in("status", ["draft", "live"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  function subscribe(id) {
    if (channel) client.removeChannel(channel);
    channel = client
      .channel(`slot-arena-${id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "tournaments",
        filter: `id=eq.${id}`
      }, payload => {
        const remote = payload.new;
        const serialized = JSON.stringify(remote.state);
        if (serialized === lastSaved) return;
        lastSaved = serialized;
        handlers.onState?.(remote.state, remote);
        status("online", "Sincronizzato in tempo reale");
      })
      .subscribe(state => {
        if (state === "SUBSCRIBED") status("online", "Database online");
      });
  }

  async function init(nextHandlers) {
    handlers = nextHandlers || {};
    if (!client) {
      status("error", "Configurazione database mancante");
      return;
    }
    try {
      const { data } = await client.auth.getSession();
      session = data.session;
      authChanged();
      client.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession;
        authChanged();
      });
      const tournament = await findTournament();
      if (tournament) {
        tournamentId = tournament.id;
        readOnly = tournament.status === "completed";
        localStorage.setItem(ID_KEY, tournamentId);
        lastSaved = JSON.stringify(tournament.state);
        handlers.onState?.(tournament.state, tournament);
        subscribe(tournamentId);
        status(readOnly ? "ready" : "online", `${readOnly ? "Archivio" : "Online"} · ${tournament.name}`);
      } else {
        status(session ? "ready" : "offline", session ? "Crea il primo torneo" : "Nessun torneo online");
      }
    } catch (error) {
      console.error(error);
      status("error", "Esegui database-setup.sql su Supabase");
    }
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    authChanged();
    status("online", "Accesso amministratore effettuato");
    return data.user;
  }

  async function signOut() {
    await client.auth.signOut();
    session = null;
    authChanged();
    status("offline", "Modalità monitor · sola lettura");
  }

  async function createTournament(name, state) {
    if (!session?.user) throw new Error("Effettua prima l’accesso amministratore");
    const { data, error } = await client
      .from("tournaments")
      .insert({ name: name || "Slot Arena Live", state, status: "live" })
      .select()
      .single();
    if (error) throw error;
    tournamentId = data.id;
    readOnly = false;
    localStorage.setItem(ID_KEY, tournamentId);
    lastSaved = JSON.stringify(state);
    subscribe(tournamentId);
    status("online", `Online · ${data.name}`);
    return data;
  }

  async function archiveTournament() {
    if (!session?.user || !tournamentId) throw new Error("Nessun torneo amministrabile");
    if (readOnly) throw new Error("Questo torneo è già archiviato");
    clearTimeout(saveTimer);
    await flush();
    const { error } = await client
      .from("tournaments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tournamentId);
    if (error) throw error;
    readOnly = true;
    status("ready", "Archiviato · sola lettura");
  }

  async function listTournaments() {
    const { data, error } = await client
      .from("tournaments")
      .select("id,name,status,created_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return data || [];
  }

  async function openTournament(id) {
    const { data, error } = await client.from("tournaments").select("*").eq("id", id).single();
    if (error) throw error;
    tournamentId = data.id;
    readOnly = data.status === "completed";
    localStorage.setItem(ID_KEY, tournamentId);
    lastSaved = JSON.stringify(data.state);
    handlers.onState?.(data.state, data);
    subscribe(tournamentId);
    status(readOnly ? "ready" : "online", `${readOnly ? "Archivio" : "Online"} · ${data.name}`);
    return data;
  }

  async function flush() {
    if (!session?.user || !tournamentId || !pendingState || readOnly) return;
    const snapshot = pendingState;
    pendingState = null;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSaved) return;
    const { error } = await client
      .from("tournaments")
      .update({ state: snapshot, status: "live" })
      .eq("id", tournamentId);
    if (error) {
      console.error(error);
      status("error", "Salvato solo sul dispositivo");
      pendingState = snapshot;
      return;
    }
    lastWrite = Date.now();
    lastSaved = serialized;
    status("online", "Salvato nel cloud");
  }

  function scheduleSave(state) {
    if (!session?.user || !tournamentId || readOnly) return;
    pendingState = JSON.parse(JSON.stringify(state));
    clearTimeout(saveTimer);
    const wait = Math.max(700, 5000 - (Date.now() - lastWrite));
    saveTimer = setTimeout(flush, wait);
  }

  window.SlotArenaCloud = {
    init,
    signIn,
    signOut,
    createTournament,
    archiveTournament,
    listTournaments,
    openTournament,
    scheduleSave,
    flush,
    isAdmin: () => Boolean(session?.user),
    currentId: () => tournamentId,
    isReadOnly: () => readOnly
  };
})();
