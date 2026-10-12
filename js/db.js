const KEY = "obhod.v2";

export function emptyDb() {
  return {
    version: 1,
    settings: {
      maxStops: 8,
      lowStock: 12,
      startStoreId: null,
      hintSeen: false,
    },
    signals: {},
    overrides: {},
    deliveries: {},
    days: {},
  };
}

function memory() {
  if (!globalThis.__obhodMemory) globalThis.__obhodMemory = emptyDb();
  return globalThis.__obhodMemory;
}

export function loadDb() {
  try {
    localStorage.removeItem("obhod.v1");
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
    globalThis.__obhodMemory = next;
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
