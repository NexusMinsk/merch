/** Фото визита: полка, склад, брак. Лежат в IndexedDB этого телефона. */

const KINDS = ["shelf", "warehouse", "defect"];
const urls = new Map();
let opening = null;

function keyOf(date, storeId, kind) {
  return `${date}|${storeId}|${kind}`;
}

function openDb() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open("merch-shots", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("shots")) db.createObjectStore("shots", { keyPath: "id" });
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

async function shrink(file) {
  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      source = await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
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

export async function saveShot(date, storeId, kind, file) {
  if (!KINDS.includes(kind)) return "bad-type";
  if (!file || !String(file.type || "").startsWith("image/")) return "bad-type";
  if (file.size > 25 * 1024 * 1024) return "too-big";
  try {
    const blob = await shrink(file);
    const id = keyOf(date, storeId, kind);
    const db = await openDb();
    const tx = db.transaction("shots", "readwrite");
    tx.objectStore("shots").put({ id, blob, updatedAt: new Date().toISOString() });
    await txDone(tx);
    const prev = urls.get(id);
    if (prev) URL.revokeObjectURL(prev);
    urls.set(id, URL.createObjectURL(blob));
    return "ok";
  } catch {
    return "bad-type";
  }
}

export async function shotUrl(date, storeId, kind) {
  const id = keyOf(date, storeId, kind);
  if (urls.has(id)) return urls.get(id);
  const db = await openDb();
  const tx = db.transaction("shots", "readonly");
  const row = await requestToPromise(tx.objectStore("shots").get(id));
  if (!row?.blob) return "";
  const url = URL.createObjectURL(row.blob);
  urls.set(id, url);
  return url;
}

export async function shotFlags(date, storeId) {
  const flags = { shelf: false, warehouse: false, defect: false };
  await Promise.all(KINDS.map(async (kind) => {
    flags[kind] = Boolean(await shotUrl(date, storeId, kind));
  }));
  return flags;
}
