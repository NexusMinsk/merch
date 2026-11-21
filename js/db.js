const KEY = "merch.v1";

export function emptyDb() {
  return {
    version: 1,
    settings: {
      maxStops: 8,
      lowStock: 12,
      startStoreId: null,
      hintSeen: false,
      personId: null,
      apiBase: "",
      llmKey: "",
    },
    people: [],
    owners: {},
    chat: [],
    sharedRev: 0,
    signals: {},
    overrides: {},
    deliveries: {},
    days: {},
  };
}

function memory() {
  if (!globalThis.__merchMemory) globalThis.__merchMemory = emptyDb();
  return globalThis.__merchMemory;
}

export function loadDb() {
  try {
    if (!localStorage.getItem(KEY)) {
      const legacy = localStorage.getItem("obhod.v2") || localStorage.getItem("obhod.v1");
      if (legacy) localStorage.setItem(KEY, legacy);
    }
    localStorage.removeItem("obhod.v1");
    localStorage.removeItem("obhod.v2");
  } catch {
    // старые проверочные данные больше не читаем
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch {
    return normalize(memory());
  }
}

export function saveDb(db) {
  const next = normalize(db);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    globalThis.__merchMemory = next;
  }
  return next;
}

export function normalize(input) {
  const base = emptyDb();
  const db = input && typeof input === "object" ? input : {};
  base.settings = {
    ...base.settings,
    ...(db.settings || {}),
  };
  base.settings.maxStops = clamp(Number(base.settings.maxStops) || 8, 4, 12);
  base.settings.lowStock = clamp(Number(base.settings.lowStock) || 12, 0, 500);
  base.settings.startStoreId = base.settings.startStoreId || null;
  base.settings.hintSeen = Boolean(base.settings.hintSeen);
  base.settings.personId = base.settings.personId || null;
  base.settings.apiBase = String(base.settings.apiBase || "").trim().replace(/\/$/, "");
  base.settings.llmKey = String(base.settings.llmKey || "");
  base.people = Array.isArray(db.people)
    ? db.people.filter((person) => person && person.id && person.name).map((person) => ({
      id: String(person.id),
      name: String(person.name).slice(0, 40),
      role: person.role === "lead" ? "lead" : "merch",
    }))
    : [];
  base.owners = {};
  if (db.owners && typeof db.owners === "object") {
    for (const [storeId, personId] of Object.entries(db.owners)) {
      if (storeId && personId) base.owners[String(storeId)] = String(personId);
    }
  }
  base.chat = Array.isArray(db.chat)
    ? db.chat.filter((message) => message && (message.role === "user" || message.role === "assistant") && message.content).slice(-30).map((message) => ({
      role: message.role,
      content: String(message.content).slice(0, 4000),
      at: message.at || "",
    }))
    : [];
  base.sharedRev = Number(db.sharedRev) || 0;
  base.signals = db.signals && typeof db.signals === "object" ? db.signals : {};
  base.overrides = db.overrides && typeof db.overrides === "object" ? db.overrides : {};
  base.deliveries = {};
  const rawDeliveries = db.deliveries && typeof db.deliveries === "object" ? db.deliveries : {};
  for (const [date, ids] of Object.entries(rawDeliveries)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(ids)) continue;
    base.deliveries[date] = [...new Set(ids.map(String))];
  }
  base.days = db.days && typeof db.days === "object" ? db.days : {};
  base.version = 1;
  return base;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function overrideFor(db, date) {
  if (!db.overrides[date]) db.overrides[date] = { pin: [], drop: [], order: [] };
  const item = db.overrides[date];
  item.pin = Array.isArray(item.pin) ? item.pin : [];
  item.drop = Array.isArray(item.drop) ? item.drop : [];
  item.order = Array.isArray(item.order) ? item.order : [];
  return item;
}

export function exportPayload(db) {
  return JSON.stringify(db, null, 2);
}
