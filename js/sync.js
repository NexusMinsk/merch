/** Общая база для телефона руководителя и телефонов мерчей. Ключ модели на сервере, не здесь. */

function sharedSlice(db) {
  return {
    people: db.people || [],
    owners: db.owners || {},
    deliveries: db.deliveries || {},
    chat: db.chat || [],
    maxStops: db.settings?.maxStops,
    lowStock: db.settings?.lowStock,
    days: db.days || {},
    signals: db.signals || {},
    overrides: db.overrides || {},
  };
}

function mergeDays(local, remote) {
  const out = {};
  const dates = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const date of dates) {
    const left = local?.[date];
    const right = remote?.[date];
    if (!left) {
      out[date] = right;
      continue;
    }
    if (!right) {
      out[date] = left;
      continue;
    }
    const byId = new Map();
    for (const stop of right.stops || []) byId.set(stop.storeId, stop);
    for (const stop of left.stops || []) {
      const other = byId.get(stop.storeId);
      if (!other || (stop.visit && !other.visit) || ((stop.finishedAt || "") >= (other.finishedAt || "") && stop.visit)) {
        byId.set(stop.storeId, stop);
      }
    }
    const order = (left.stops || []).map((stop) => stop.storeId);
    for (const stop of right.stops || []) {
      if (!order.includes(stop.storeId)) order.push(stop.storeId);
    }
    out[date] = {
      ...right,
      ...left,
      status: left.status === "done" || right.status === "done" ? "done" : (left.status || right.status),
      stops: order.map((id) => byId.get(id)).filter(Boolean),
    };
  }
  return out;
}

function mergeSignals(local, remote) {
  const out = {};
  const ids = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const id of ids) {
    const left = local?.[id];
    const right = remote?.[id];
    if (!left) out[id] = right;
    else if (!right) out[id] = left;
    else out[id] = (left.lastVisitDate || "") >= (right.lastVisitDate || "") ? left : right;
  }
  return out;
}

export function applyShared(db, payload) {
  if (!payload || typeof payload !== "object") return db;
  const remoteRev = Number(payload.rev) || 0;
  const remote = payload.shared || {};
  if (remoteRev > (db.sharedRev || 0)) {
    db.people = remote.people || [];
    db.owners = remote.owners || {};
    db.deliveries = remote.deliveries || {};
    db.chat = remote.chat || db.chat || [];
    if (remote.maxStops) db.settings.maxStops = remote.maxStops;
    if (typeof remote.lowStock === "number") db.settings.lowStock = remote.lowStock;
    db.sharedRev = remoteRev;
  }
  db.days = mergeDays(db.days, remote.days);
  db.signals = mergeSignals(db.signals, remote.signals);
  db.overrides = { ...(remote.overrides || {}), ...(db.overrides || {}) };
  return db;
}

export async function pullShared(db) {
  const base = db.settings?.apiBase;
  if (!base) return db;
  const response = await fetch(`${base}/api/state`);
  if (!response.ok) throw new Error("Сервер не отдал базу");
  const payload = await response.json();
  return applyShared(db, payload);
}

export async function pushShared(db) {
  const base = db.settings?.apiBase;
  if (!base) return db;
  const response = await fetch(`${base}/api/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rev: db.sharedRev || 0, shared: sharedSlice(db) }),
  });
  if (response.status === 409) {
    const payload = await response.json();
    applyShared(db, payload);
    const retry = await fetch(`${base}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rev: db.sharedRev || 0, shared: sharedSlice(db) }),
    });
    if (!retry.ok) throw new Error("База на сервере разошлась");
    const saved = await retry.json();
    db.sharedRev = saved.rev || db.sharedRev;
    return db;
  }
  if (!response.ok) throw new Error("Сервер не принял базу");
  const saved = await response.json();
  db.sharedRev = saved.rev || db.sharedRev;
  return db;
}
