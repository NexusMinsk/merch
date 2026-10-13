/** Фото магазина и схема прохода. Лежат в IndexedDB, не в списке маршрута. */

const SKETCH_W = 960;
const SKETCH_H = 720;

const TOOLS = {
  path: { mode: "stroke", color: "#1c1915", width: 16 },
  beer: { mode: "stroke", color: "#c47a12", width: 28 },
  warehouse: { mode: "stroke", color: "#1e4f86", width: 28 },
  "beer-label": { mode: "label", color: "#8a4e00", text: "пиво" },
  "warehouse-label": { mode: "label", color: "#1e4f86", text: "склад" },
  eraser: { mode: "erase", width: 52 },
};

const fieldToken = { photo: new Map(), sketch: new Map() };
const chains = new Map();
const fresh = new Map();
let opening = null;

function remember(storeId, fields) {
  const prev = fresh.get(storeId) || {};
  fresh.set(storeId, { ...prev, ...fields });
}

function overlay(row) {
  const extra = fresh.get(row.id);
  if (!extra) return row;
  return {
    ...row,
    photo: Object.prototype.hasOwnProperty.call(extra, "photo") ? extra.photo : row.photo || null,
    sketch: Object.prototype.hasOwnProperty.call(extra, "sketch") ? extra.sketch : row.sketch || null,
  };
}

function issue(kind, id) {
  const map = fieldToken[kind];
  const next = (map.get(id) || 0) + 1;
  map.set(id, next);
  return next;
}

function same(kind, id, token) {
  return fieldToken[kind].get(id) === token;
}

function enqueue(storeId, job) {
  const prev = chains.get(storeId) || Promise.resolve();
  const next = prev.then(job, job);
  chains.set(storeId, next.then(() => {}, () => {}));
  return next;
}

function openDb() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open("merch-guides", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("guides")) db.createObjectStore("guides", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("abort"));
  });
}

export async function allGuides() {
  const db = await openDb();
  const tx = db.transaction("guides", "readonly");
  const rows = await requestToPromise(tx.objectStore("guides").getAll());
  const byId = new Map((rows || []).map((row) => [row.id, row]));
  for (const id of fresh.keys()) {
    if (!byId.has(id)) byId.set(id, { id, photo: null, sketch: null });
  }
  return [...byId.values()].map((row) => overlay(row)).filter((row) => row.photo || row.sketch);
}

export async function getGuide(storeId) {
  const db = await openDb();
  const tx = db.transaction("guides", "readonly");
  return (await requestToPromise(tx.objectStore("guides").get(storeId))) || null;
}

async function writeFields(storeId, fields, kind, token) {
  return enqueue(storeId, async () => {
    if (!same(kind, storeId, token)) return;
    const prev = (await getGuide(storeId)) || { id: storeId };
    if (!same(kind, storeId, token)) return;
    const next = {
      id: storeId,
      photo: prev.photo || null,
      sketch: prev.sketch || null,
      updatedAt: new Date().toISOString(),
    };
    if ("photo" in fields) next.photo = fields.photo;
    if ("sketch" in fields) next.sketch = fields.sketch;
    const db = await openDb();
    const tx = db.transaction("guides", "readwrite");
    const store = tx.objectStore("guides");
    if (!next.photo && !next.sketch) store.delete(storeId);
    else store.put(next);
    await txDone(tx);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function shrinkPhoto(file) {
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await fileToImage(file);
  }
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) throw new Error("image");
  const scale = Math.min(1, 1400 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  if (!blob) throw new Error("image");
  return blob;
}

export async function savePhoto(storeId, file) {
  if (!file || !String(file.type || "").startsWith("image/")) return "bad-type";
  if (file.size > 25 * 1024 * 1024) return "too-big";
  const token = issue("photo", storeId);
  try {
    const blob = await shrinkPhoto(file);
    if (!same("photo", storeId, token)) return "ok";
    remember(storeId, { photo: blob });
    await writeFields(storeId, { photo: blob }, "photo", token);
    return "ok";
  } catch {
    return "bad-type";
  }
}

export function clearPhoto(storeId) {
  remember(storeId, { photo: null });
  const token = issue("photo", storeId);
  return writeFields(storeId, { photo: null }, "photo", token);
}

export function clearSketch(storeId) {
  remember(storeId, { sketch: null });
  const token = issue("sketch", storeId);
  return writeFields(storeId, { sketch: null }, "sketch", token);
}

export async function clearAllGuides() {
  fresh.clear();
  const db = await openDb();
  const tx = db.transaction("guides", "readwrite");
  tx.objectStore("guides").clear();
  await txDone(tx);
}

export async function exportGuidesPayload() {
  const guides = {};
  for (const row of await allGuides()) {
    if (!row?.photo && !row?.sketch) continue;
    guides[row.id] = {
      photo: row.photo ? await blobToDataUrl(row.photo) : null,
      sketch: row.sketch ? await blobToDataUrl(row.sketch) : null,
    };
  }
  return guides;
}

export async function replaceGuides(map) {
  fresh.clear();
  const records = [];
  for (const [id, item] of Object.entries(map || {})) {
    if (!item || typeof item !== "object") continue;
    const photo = typeof item.photo === "string" ? await dataUrlToBlob(item.photo) : null;
    const sketch = typeof item.sketch === "string" ? await dataUrlToBlob(item.sketch) : null;
    if (!photo && !sketch) continue;
    records.push({ id, photo, sketch, updatedAt: new Date().toISOString() });
  }
  const db = await openDb();
  const tx = db.transaction("guides", "readwrite");
  const store = tx.objectStore("guides");
  store.clear();
  for (const record of records) store.put(record);
  await txDone(tx);
}

function isBlank(ctx) {
  const { data } = ctx.getImageData(0, 0, SKETCH_W, SKETCH_H);
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 8) return false;
  }
  return true;
}

export function attachSketch(canvas, blob, { storeId, getTool, isCurrent }) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { undo() {} };
  canvas.width = SKETCH_W;
  canvas.height = SKETCH_H;
  const history = [];
  let drawing = false;
  let moved = false;
  let last = null;
  let active = TOOLS.path;
  let pointerId = null;
  let ready = false;
  let op = 0;

  function tool() {
    return TOOLS[getTool()] || TOOLS.path;
  }

  function snapshot() {
    try {
      history.push(canvas.toDataURL("image/png"));
      if (history.length > 12) history.shift();
    } catch {
      // отмена штриха без снимка просто не сработает
    }
  }

  function persist() {
    if (!isCurrent()) return;
    const token = issue("sketch", storeId);
    if (isBlank(ctx)) {
      remember(storeId, { sketch: null });
      writeFields(storeId, { sketch: null }, "sketch", token);
      return;
    }
    remember(storeId, { sketch: canvas.toDataURL("image/png") });
    canvas.toBlob((next) => {
      if (!next || !isCurrent() || !same("sketch", storeId, token)) return;
      remember(storeId, { sketch: next });
      writeFields(storeId, { sketch: next }, "sketch", token);
    }, "image/png");
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function drawDot(x, y, spec) {
    ctx.save();
    ctx.globalCompositeOperation = spec.mode === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = spec.mode === "erase" ? "#000" : spec.color;
    ctx.beginPath();
    ctx.arc(x, y, (spec.width || 28) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLine(a, b, spec) {
    ctx.save();
    ctx.globalCompositeOperation = spec.mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = spec.mode === "erase" ? "#000" : spec.color;
    ctx.lineWidth = spec.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(x, y, spec) {
    ctx.save();
    ctx.font = "700 64px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(255, 253, 248, 0.95)";
    ctx.strokeText(spec.text, x, y);
    ctx.fillStyle = spec.color;
    ctx.fillText(spec.text, x, y);
    ctx.restore();
  }

  function onDown(event) {
    if (!ready || (event.button != null && event.button !== 0)) return;
    event.preventDefault();
    op += 1;
    active = tool();
    const p = point(event);
    snapshot();
    if (active.mode === "label") {
      drawLabel(p.x, p.y, active);
      persist();
      return;
    }
    drawing = true;
    moved = false;
    last = p;
    pointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onMove(event) {
    if (!drawing || event.pointerId !== pointerId) return;
    event.preventDefault();
    const p = point(event);
    drawLine(last, p, active);
    last = p;
    moved = true;
  }

  function onUp(event) {
    if (!drawing || (event && event.pointerId !== pointerId)) return;
    drawing = false;
    pointerId = null;
    if (!moved && last) drawDot(last.x, last.y, active);
    persist();
  }

  function bind() {
    canvas.addEventListener("pointerdown", onDown, { passive: false });
    canvas.addEventListener("pointermove", onMove, { passive: false });
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.classList.add("ready");
    ready = true;
  }

  const source = blob || null;
  if (source) {
    const pending = typeof source === "string" ? loadImage(source) : blobToImage(source);
    pending.then((img) => {
      if (!isCurrent()) return;
      ctx.clearRect(0, 0, SKETCH_W, SKETCH_H);
      ctx.drawImage(img, 0, 0, SKETCH_W, SKETCH_H);
      bind();
    }).catch(() => {
      if (isCurrent()) bind();
    });
  } else if (isCurrent()) {
    bind();
  }

  return {
    undo() {
      if (!ready || history.length === 0) return;
      const url = history[history.length - 1];
      const mark = ++op;
      loadImage(url).then((img) => {
        if (mark !== op || !isCurrent()) return;
        history.pop();
        ctx.clearRect(0, 0, SKETCH_W, SKETCH_H);
        ctx.drawImage(img, 0, 0, SKETCH_W, SKETCH_H);
        persist();
      }).catch(() => {});
    },
  };
}
