import { assessStore, planDay, primaryReason, storeById, todayISO } from "./model.js";
import { ensureTrack, formatKm, stopWatch, watchDay } from "./track.js";
import { emptyDb, loadDb, normalize, overrideFor, saveDb } from "./db.js";
import { guidePeekHtml, render } from "./ui.js";
import {
  allGuides,
  attachSketch,
  clearAllGuides,
  clearPhoto,
  clearSketch,
  exportGuidesPayload,
  replaceGuides,
  savePhoto,
} from "./guides.js";

let db = loadDb();
const state = {
  view: "today",
  storeId: null,
  date: null,
  chain: "all",
  query: "",
  draft: null,
  formError: "",
  pickerDate: null,
  deliveryOpen: false,
  confirm: null,
  confirmId: null,
  confirmDate: null,
  pen: "path",
  returnView: null,
};

let guideGen = 0;
let sketchCtrl = null;
const liveUrls = new Set();

let lastView = "";

function draw() {
  render(state, db);
  mountGuides().catch(() => {});
  syncMileage();
  if (state.view !== lastView) {
    window.scrollTo(0, 0);
    lastView = state.view;
  }
}

let mileageTimer = 0;

function paintMileage(meters) {
  const text = `Пробег ${formatKm(meters)}`;
  document.querySelectorAll("[data-mileage]").forEach((node) => {
    node.textContent = text;
  });
}

function persistSoon() {
  clearTimeout(mileageTimer);
  mileageTimer = setTimeout(() => persist(), 2500);
}

function syncMileage() {
  const today = todayISO();
  const day = db.days[today];
  if (!day || day.status !== "active") {
    stopWatch();
    return;
  }
  watchDay(day, today, {
    onChange: (track) => {
      paintMileage(track.meters);
      persistSoon();
    },
    onDenied: () => {
      persist();
      toast("Геолокация запрещена. Разрешите её в настройках браузера, чтобы писать пробег.");
      draw();
    },
  });
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function persist() {
  db = saveDb(db);
}

function parseQty(raw, allowNull) {
  const text = String(raw ?? "").trim();
  if (!text) return allowNull ? null : 0;
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return allowNull ? null : 0;
  return Math.min(9999, Math.round(value));
}

function readDraftFromDom() {
  if (state.view !== "visit" || !state.draft) return;
  const warehouse = document.getElementById("warehouse");
  const defect = document.getElementById("defect");
  const note = document.getElementById("note");
  const put = document.querySelector('[data-field="putOnShelf"]');
  if (warehouse) state.draft.warehouseQty = parseQty(warehouse.value, true);
  if (defect) state.draft.defectQty = parseQty(defect.value, false);
  if (note) state.draft.note = note.value;
  if (put) state.draft.putOnShelf = put.checked;
}

function makeDraft(stop) {
  if (stop.draft) return { ...stop.draft };
  if (stop.visit) {
    return {
      shelf: stop.visit.shelf || null,
      warehouseQty: stop.visit.warehouseQty ?? null,
      defectQty: stop.visit.defectQty || 0,
      defectDate: stop.visit.defectDate || "",
      orderStatus: stop.visit.orderStatus || null,
      putOnShelf: Boolean(stop.visit.putOnShelf),
      note: stop.visit.note || "",
    };
  }
  const signal = db.signals[stop.storeId] || {};
  return {
    shelf: null,
    warehouseQty: null,
    defectQty: 0,
    defectDate: signal.defectDate || "",
    orderStatus: null,
    putOnShelf: false,
    note: "",
  };
}

function openVisit(date, storeId, markArrival) {
  const day = db.days[date];
  const stop = day?.stops?.find((item) => item.storeId === storeId);
  if (!day || !stop) {
    if (state.view !== "store") state.returnView = state.view;
    state.view = "store";
    state.storeId = storeId;
    state.pickerDate = null;
    state.deliveryOpen = false;
    state.confirm = null;
    return;
  }
  if (markArrival && stop.status === "pending") {
    stop.arrivedAt = stop.arrivedAt || new Date().toISOString();
    persist();
  }
  state.view = "visit";
  state.date = date;
  state.storeId = storeId;
  state.formError = "";
  state.draft = makeDraft(stop);
  state.pickerDate = null;
  state.deliveryOpen = false;
  state.confirm = null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function signalFromVisit(date, visit) {
  return {
    shelf: visit.shelf,
    warehouseQty: visit.warehouseQty,
    defectQty: visit.defectQty,
    defectDate: visit.defectDate || null,
    orderStatus: visit.orderStatus,
    putOnShelf: Boolean(visit.putOnShelf),
    note: visit.note || "",
    updatedAt: new Date().toISOString(),
    lastVisitDate: date,
  };
}

function writeSignal(storeId, date, visit) {
  const prev = db.signals[storeId];
  if (prev?.lastVisitDate && prev.lastVisitDate > date) return;
  db.signals[storeId] = signalFromVisit(date, visit);
}

function saveVisit() {
  readDraftFromDom();
  const draft = state.draft;
  const day = db.days[state.date];
  const stop = day?.stops?.find((item) => item.storeId === state.storeId);
  if (!draft || !stop) return;
  if (!draft.shelf) {
    state.formError = "Отметьте, что на полке: норма, мало или раскупили.";
    return;
  }
  const stockout = draft.shelf === "empty" && draft.warehouseQty === 0;
  if (stockout && !draft.orderStatus) {
    state.formError = "Товара нет ни на полке, ни на складе. Отметьте, сделали ли заказ у товароведа.";
    return;
  }
  const visit = {
    shelf: draft.shelf,
    warehouseQty: draft.warehouseQty,
    defectQty: draft.defectQty || 0,
    defectDate: draft.defectDate || null,
    orderStatus: draft.orderStatus,
    putOnShelf: Boolean(draft.putOnShelf),
    note: (draft.note || "").trim(),
  };
  stop.visit = visit;
  stop.status = "done";
  stop.finishedAt = new Date().toISOString();
  stop.arrivedAt = stop.arrivedAt || stop.finishedAt;
  delete stop.draft;
  writeSignal(state.storeId, state.date, visit);
  persist();
  state.view = "today";
  state.draft = null;
  state.formError = "";
  toast("Точка сохранена");
}

function moveStop(date, id, dir) {
  const day = db.days[date];
  if (day) {
    const index = day.stops.findIndex((stop) => stop.storeId === id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= day.stops.length) return;
    if (day.stops[index].status !== "pending" || day.stops[next].status !== "pending") return;
    const [item] = day.stops.splice(index, 1);
    day.stops.splice(next, 0, item);
    persist();
    return;
  }
  const ids = planDay(date, db).stops.map((stop) => stop.storeId);
  const index = ids.indexOf(id);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= ids.length) return;
  const current = ids[index];
  ids[index] = ids[next];
  ids[next] = current;
  overrideFor(db, date).order = ids;
  persist();
}

function dropStop(date, id, force) {
  if (db.days[date]) return;
  const stop = planDay(date, db).stops.find((item) => item.storeId === id);
  if (!force && stop && (stop.reasons.includes("defect") || stop.reasons.includes("delivery"))) {
    state.confirm = {
      title: "Убрать обязательную точку?",
      text: stop.reasons.includes("defect")
        ? "На этот день отмечен большой брак. Без неё маршрут поедет мимо."
        : "После поставки сюда нужно приехать и выставить товар.",
      confirm: "Всё равно убрать",
      action: "confirm-drop",
    };
    state.confirmDate = date;
    state.confirmId = id;
    return;
  }
  const override = overrideFor(db, date);
  if (!override.drop.includes(id)) override.drop.push(id);
  override.pin = override.pin.filter((item) => item !== id);
  override.order = override.order.filter((item) => item !== id);
  state.confirm = null;
  persist();
}

function pinStop(date, id) {
  const day = db.days[date];
  if (day) {
    const existing = day.stops.find((stop) => stop.storeId === id);
    if (existing) {
      existing.status = "pending";
      existing.finishedAt = null;
    } else {
      const store = storeById(id);
      const assessed = assessStore(store, db.signals[id], date, db.settings);
      if (!assessed.reasons.includes("defect") && !assessed.reasons.includes("delivery")) {
        assessed.reasons = assessed.reasons.filter((reason) => reason !== "control");
        if (!assessed.reasons.includes("pin")) assessed.reasons.push("pin");
        assessed.primary = primaryReason(assessed.reasons);
      }
      day.stops.push({
        storeId: id,
        reasons: assessed.reasons,
        primary: assessed.primary,
        score: assessed.score,
        daysSince: assessed.daysSince,
        status: "pending",
        arrivedAt: null,
        finishedAt: null,
        visit: null,
      });
    }
  } else {
    const override = overrideFor(db, date);
    override.drop = override.drop.filter((item) => item !== id);
    if (!override.pin.includes(id)) override.pin.push(id);
  }
  state.pickerDate = null;
  persist();
  toast("Точка в маршруте");
}

function startDay() {
  const today = todayISO();
  if (db.days[today]) return;
  const plan = planDay(today, db);
  if (plan.stops.length === 0) return;
  db.days[today] = {
    status: "active",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    mode: plan.mode,
    snapshot: {
      signals: clone(db.signals),
      overrides: clone(db.overrides),
    },
    stops: plan.stops.map((stop) => ({ ...stop, reasons: stop.reasons.slice() })),
    track: { meters: 0, last: null, denied: false },
  };
  persist();
  toast("День начат");
}

function latestVisitBefore(storeId, date) {
  let found = null;
  for (const [dayDate, day] of Object.entries(db.days)) {
    if (dayDate >= date) continue;
    for (const stop of day.stops || []) {
      if (stop.storeId === storeId && stop.visit && (!found || dayDate > found.date)) {
        found = { date: dayDate, visit: stop.visit };
      }
    }
  }
  return found;
}

function cancelDay() {
  stopWatch();
  clearTimeout(mileageTimer);
  const today = todayISO();
  const day = db.days[today];
  if (!day) return;
  if (day.snapshot?.signals) {
    db.signals = clone(day.snapshot.signals);
    db.overrides = clone(day.snapshot.overrides || {});
  } else {
    const touched = (day.stops || []).filter((stop) => stop.visit).map((stop) => stop.storeId);
    for (const storeId of touched) {
      const older = latestVisitBefore(storeId, today);
      if (older) db.signals[storeId] = signalFromVisit(older.date, older.visit);
      else if (db.signals[storeId]?.lastVisitDate === today) delete db.signals[storeId];
    }
  }
  delete db.days[today];
  state.view = "today";
  state.draft = null;
  state.formError = "";
  state.confirm = null;
  state.pickerDate = null;
  persist();
  toast("День выключен");
}

function finishDay() {
  const today = todayISO();
  const day = db.days[today];
  if (!day) return;
  stopWatch();
  clearTimeout(mileageTimer);
  for (const stop of day.stops) {
    if (stop.status === "pending") stop.status = "skipped";
  }
  day.status = "done";
  day.finishedAt = new Date().toISOString();
  if (day.track) day.track.last = null;
  state.confirm = null;
  persist();
  toast("День закрыт");
}

async function exportCopy() {
  let guides = {};
  try {
    guides = await exportGuidesPayload();
  } catch {
    guides = {};
  }
  const blob = new Blob([JSON.stringify({ ...db, guides }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `merch-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Копия скачана");
}

async function importCopy(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== "object" || !parsed.settings || !parsed.days) {
      toast("В файле нет данных merch");
      return;
    }
    db = normalize(parsed);
    if (parsed.guides && typeof parsed.guides === "object") {
      try {
        await replaceGuides(parsed.guides);
      } catch {
        persist();
        state.view = "today";
        toast("Отметки восстановлены, схемы не загрузились");
        return;
      }
    }
    persist();
    state.view = "today";
    toast("Данные восстановлены");
  } catch {
    toast("Файл не прочитался");
  }
}

function stashDraft() {
  if (state.view !== "visit" || !state.draft || !state.date) return;
  const stop = db.days[state.date]?.stops?.find((item) => item.storeId === state.storeId);
  if (!stop) return;
  stop.draft = { ...state.draft };
  persist();
}

function toggleDelivery(id) {
  if (!id) return;
  const today = todayISO();
  if (!db.deliveries || typeof db.deliveries !== "object") db.deliveries = {};
  const list = Array.isArray(db.deliveries[today]) ? db.deliveries[today].slice() : [];
  const on = list.includes(id);
  db.deliveries[today] = on ? list.filter((item) => item !== id) : list.concat(id);
  persist();
  toast(on ? "Убрано из поставки" : "В списке поставки");
}

function rebuildSignals() {
  db.signals = {};
  const dates = Object.keys(db.days || {}).sort();
  for (const date of dates) {
    for (const stop of db.days[date].stops || []) {
      if (!stop.visit || stop.status === "skipped") continue;
      writeSignal(stop.storeId, date, stop.visit);
    }
  }
}

function resetDay(date) {
  if (!date) return;
  if (date === todayISO()) {
    stopWatch();
    clearTimeout(mileageTimer);
  }
  const day = db.days[date];
  const wiped = new Set((day?.stops || []).filter((stop) => stop.visit).map((stop) => stop.storeId));
  const keepDefect = {};
  for (const [storeId, signal] of Object.entries(day?.snapshot?.signals || {})) {
    if (signal?.defectDate) keepDefect[storeId] = signal.defectDate;
  }
  for (const [storeId, signal] of Object.entries(db.signals || {})) {
    if (signal?.defectDate && !wiped.has(storeId)) keepDefect[storeId] = signal.defectDate;
  }
  delete db.days[date];
  if (db.deliveries) delete db.deliveries[date];
  if (db.overrides) delete db.overrides[date];
  rebuildSignals();
  for (const [storeId, defectDate] of Object.entries(keepDefect)) {
    if (!db.signals[storeId]) db.signals[storeId] = { defectDate, updatedAt: new Date().toISOString() };
    else if (!db.signals[storeId].defectDate) db.signals[storeId].defectDate = defectDate;
  }
  if ((state.view === "day" || state.view === "visit") && state.date === date) {
    state.view = "settings";
    state.date = null;
    state.draft = null;
  }
  state.confirm = null;
  state.confirmDate = null;
  state.pickerDate = null;
  persist();
  toast("День сброшен");
}

function resetAllDays() {
  stopWatch();
  clearTimeout(mileageTimer);
  db.days = {};
  db.deliveries = {};
  db.overrides = {};
  db.signals = {};
  state.view = "today";
  state.date = null;
  state.draft = null;
  state.formError = "";
  state.confirm = null;
  state.confirmDate = null;
  state.pickerDate = null;
  persist();
  toast("Дни сброшены");
}

function rememberDraft() {
  readDraftFromDom();
  stashDraft();
}

function releaseUrls() {
  for (const url of liveUrls) URL.revokeObjectURL(url);
  liveUrls.clear();
}

function mediaUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const url = URL.createObjectURL(value);
  liveUrls.add(url);
  return url;
}

function guideFlag(guide) {
  if (!guide?.photo && !guide?.sketch) return " · нет схемы";
  if (guide.photo && guide.sketch) return " · фото и схема";
  if (guide.sketch) return " · схема есть";
  return " · есть фото, нет схемы";
}

async function mountGuides() {
  const gen = ++guideGen;
  const isCurrent = () => gen === guideGen;
  releaseUrls();
  sketchCtrl = null;
  let rows = [];
  try {
    rows = await allGuides();
  } catch {
    rows = [];
  }
  if (!isCurrent()) return;
  const byId = new Map(rows.map((row) => [row.id, row]));

  document.querySelectorAll("[data-guide-slot]").forEach((slot) => {
    const guide = byId.get(slot.dataset.guideSlot);
    if (!guide?.photo && !guide?.sketch) return;
    slot.innerHTML = guidePeekHtml(mediaUrl(guide.photo), mediaUrl(guide.sketch), slot.dataset.schemeFirst === "1");
  });

  document.querySelectorAll("[data-thumb]").forEach((el) => {
    const guide = byId.get(el.dataset.thumb);
    const blob = guide?.photo || guide?.sketch;
    if (!blob) return;
    const img = document.createElement("img");
    img.alt = "";
    if (!guide.photo) img.className = "contain";
    img.src = mediaUrl(blob);
    el.replaceChildren(img);
  });

  document.querySelectorAll("[data-guide-flag]").forEach((el) => {
    el.textContent = guideFlag(byId.get(el.dataset.guideFlag));
  });

  const frame = document.querySelector("[data-photo-frame]");
  if (frame) {
    const guide = byId.get(frame.dataset.photoFrame);
    const button = document.querySelector("[data-clear-photo]");
    if (guide?.photo) {
      const img = document.createElement("img");
      img.className = "guide-photo";
      img.alt = "Фото магазина";
      img.src = mediaUrl(guide.photo);
      frame.replaceChildren(img);
      button?.removeAttribute("hidden");
    } else {
      button?.setAttribute("hidden", "");
    }
  }

  const canvas = document.querySelector("[data-sketch-canvas]");
  if (!canvas) return;
  const id = canvas.dataset.sketch;
  sketchCtrl = attachSketch(canvas, byId.get(id)?.sketch || null, {
    storeId: id,
    getTool: () => state.pen || "path",
    isCurrent,
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  rememberDraft();
  const action = button.dataset.action;
  const date = button.dataset.date;
  const id = button.dataset.id;

  if (action === "go") {
    state.view = button.dataset.view;
    state.formError = "";
    state.pickerDate = null;
    state.deliveryOpen = false;
    state.confirm = null;
    state.draft = null;
  } else if (action === "dismiss-hint") {
    db.settings.hintSeen = true;
    persist();
  } else if (action === "start-day") {
    startDay();
  } else if (action === "arrive") {
    openVisit(date || todayISO(), id, true);
  } else if (action === "open-stop") {
    openVisit(date, id, false);
  } else if (action === "open-store") {
    if (state.view !== "store") state.returnView = state.view;
    state.view = "store";
    state.storeId = id;
  } else if (action === "open-day") {
    state.view = "day";
    state.date = date;
  } else if (action === "move") {
    moveStop(date, id, Number(button.dataset.dir));
  } else if (action === "drop") {
    dropStop(date, id, false);
  } else if (action === "confirm-drop") {
    dropStop(state.confirmDate, state.confirmId, true);
  } else if (action === "open-picker") {
    state.pickerDate = date;
    state.deliveryOpen = false;
    state.confirm = null;
  } else if (action === "open-deliveries") {
    state.view = "deliveries";
    state.deliveryOpen = false;
    state.pickerDate = null;
    state.confirm = null;
    state.draft = null;
    state.formError = "";
  } else if (action === "close-deliveries") {
    state.view = "today";
    state.deliveryOpen = false;
  } else if (action === "toggle-delivery") {
    toggleDelivery(id);
  } else if (action === "close-picker" || action === "close-confirm" || action === "close-overlay") {
    state.pickerDate = null;
    state.confirm = null;
  } else if (action === "pin") {
    pinStop(date, id);
  } else if (action === "shelf") {
    state.draft.shelf = button.dataset.value;
    state.formError = "";
  } else if (action === "order") {
    state.draft.orderStatus = button.dataset.value;
    state.formError = "";
  } else if (action === "step") {
    const field = button.dataset.field;
    const dir = Number(button.dataset.dir);
    if (field === "warehouseQty") {
      if (state.draft.warehouseQty == null) state.draft.warehouseQty = dir > 0 ? 0 : null;
      else state.draft.warehouseQty = Math.max(0, state.draft.warehouseQty + dir);
    } else {
      state.draft.defectQty = Math.max(0, (state.draft.defectQty || 0) + dir);
    }
  } else if (action === "warehouse-clear") {
    state.draft.warehouseQty = null;
  } else if (action === "clear-date") {
    state.draft[button.dataset.field] = "";
  } else if (action === "save-visit") {
    saveVisit();
  } else if (action === "skip-stop") {
    const day = db.days[state.date];
    const stop = day?.stops?.find((item) => item.storeId === state.storeId);
    if (stop && stop.status !== "done") {
      stop.status = "skipped";
      stop.finishedAt = new Date().toISOString();
      delete stop.draft;
      persist();
    }
    state.view = "today";
    state.draft = null;
  } else if (action === "cancel-arrival") {
    const day = db.days[state.date];
    const stop = day?.stops?.find((item) => item.storeId === state.storeId);
    if (stop && stop.status === "pending") stop.arrivedAt = null;
    persist();
    state.view = "today";
    state.draft = null;
  } else if (action === "ask-cancel-day") {
    const day = db.days[todayISO()];
    if (!day) return;
    state.confirm = {
      title: "Выключить день?",
      text: day.snapshot
        ? "Вернётесь к моменту до «Начать работу». Отметки на точках за этот день исчезнут, дата брака станет такой, как была до старта. Утренний список поставки останется."
        : "День снимется, сегодняшние отметки на точках уберу. Этот запуск был без снимка, поэтому даты, переписанные уже внутри визита, могут не вернуться.",
      confirm: "Выключить без последствий",
      action: "cancel-day",
    };
  } else if (action === "cancel-day") {
    cancelDay();
  } else if (action === "ask-finish") {
    const track = db.days[todayISO()]?.track;
    const mileageLine = track?.denied && !(track.meters > 0)
      ? "Пробег не записан: не было доступа к геолокации."
      : `Пробег за день: ${formatKm(track?.meters || 0)}.`;
    state.confirm = {
      title: "Завершить день?",
      text: `Оставшиеся точки станут пропуском. Полка и склад по ним не изменятся. ${mileageLine}`,
      confirm: "Завершить день",
      action: "finish-day",
    };
  } else if (action === "enable-mileage") {
    const day = db.days[todayISO()];
    if (day && day.status === "active") ensureTrack(day).denied = false;
  } else if (action === "finish-day") {
    finishDay();
  } else if (action === "ask-rebuild") {
    state.confirm = {
      title: "Пересобрать маршрут?",
      text: "День ещё без отметок, можно собрать список заново по текущим данным.",
      confirm: "Пересобрать",
      action: "rebuild-day",
    };
  } else if (action === "rebuild-day") {
    stopWatch();
    clearTimeout(mileageTimer);
    delete db.days[todayISO()];
    state.confirm = null;
    persist();
  } else if (action === "reopen-day") {
    const day = db.days[todayISO()];
    if (day) {
      day.status = "active";
      day.finishedAt = null;
      for (const stop of day.stops) {
        if (stop.status === "skipped" && !stop.visit) stop.status = "pending";
      }
      persist();
    }
  } else if (action === "setting-step") {
    const field = button.dataset.field;
    const dir = Number(button.dataset.dir);
    if (field === "maxStops") db.settings.maxStops = Math.min(12, Math.max(4, db.settings.maxStops + dir));
    if (field === "lowStock") db.settings.lowStock = Math.min(200, Math.max(0, db.settings.lowStock + dir));
    persist();
  } else if (action === "export") {
    exportCopy();
  } else if (action === "ask-reset-day") {
    if (!date) return;
    state.confirmDate = date;
    state.pickerDate = null;
    state.confirm = {
      title: "Сбросить этот день?",
      text: "Маршрут, отметки на точках и утренний список поставки за эту дату исчезнут. Остальные дни останутся, полка и склад пересчитаются по ним.",
      confirm: "Сбросить день",
      action: "reset-day",
    };
  } else if (action === "reset-day") {
    resetDay(state.confirmDate);
  } else if (action === "ask-reset-days") {
    state.pickerDate = null;
    state.confirm = {
      title: "Сбросить все дни?",
      text: "Все маршруты, отметки и списки поставки исчезнут. Число точек в день, порог склада и точка старта останутся.",
      confirm: "Сбросить все дни",
      action: "reset-days",
    };
  } else if (action === "reset-days") {
    resetAllDays();
  } else if (action === "ask-reset") {
    state.confirm = {
      title: "Стереть все отметки?",
      text: "Маршруты, визиты, фото магазинов и схемы прохода на этом телефоне исчезнут. Сначала скачайте копию, если они нужны.",
      confirm: "Стереть",
      action: "reset-all",
    };
  } else if (action === "reset-all") {
    stopWatch();
    clearTimeout(mileageTimer);
    clearAllGuides().finally(() => {
      db = emptyDb();
      persist();
      state.confirm = null;
      state.view = "today";
      toast("Данные стёрты");
      draw();
    });
    return;
  } else if (action === "close-store") {
    const back = state.returnView || "stores";
    state.returnView = null;
    if (back === "visit" && state.date && state.storeId && db.days[state.date]) {
      openVisit(state.date, state.storeId, false);
    } else {
      state.view = back === "visit" ? "stores" : back;
    }
  } else if (action === "pen") {
    state.pen = button.dataset.pen || "path";
    document.querySelectorAll("[data-action='pen']").forEach((el) => {
      el.setAttribute("aria-pressed", el.dataset.pen === state.pen ? "true" : "false");
    });
    return;
  } else if (action === "sketch-undo") {
    sketchCtrl?.undo();
    return;
  } else if (action === "ask-sketch-clear") {
    state.confirm = {
      title: "Стереть схему?",
      text: "Рисунок прохода к пиву и складу исчезнет с карточки этой точки.",
      confirm: "Стереть схему",
      action: "sketch-clear",
    };
  } else if (action === "sketch-clear") {
    const sketchId = state.storeId;
    state.confirm = null;
    clearSketch(sketchId).then(() => {
      toast("Схема стёрта");
      draw();
    }).catch(() => {
      toast("Схема не стёрлась");
      draw();
    });
    return;
  } else if (action === "ask-clear-photo") {
    state.confirmId = id;
    state.confirm = {
      title: "Убрать фото?",
      text: "Снимок магазина исчезнет с карточки этой точки.",
      confirm: "Убрать фото",
      action: "clear-photo",
    };
  } else if (action === "clear-photo") {
    const photoId = state.confirmId;
    state.confirm = null;
    clearPhoto(photoId).then(() => {
      toast("Фото убрано");
      draw();
    }).catch(() => {
      toast("Фото не убралось");
      draw();
    });
    return;
  } else if (action === "chain") {
    state.chain = button.dataset.value;
  }
  if (state.view === "visit") stashDraft();
  draw();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-photo-input]")) {
    const file = target.files?.[0];
    const id = target.dataset.id;
    target.value = "";
    if (!file || !id) return;
    savePhoto(id, file).then((result) => {
      if (result === "ok") toast("Фото сохранено");
      else if (result === "too-big") toast("Фото слишком большое");
      else toast("Это фото не открылось");
      draw();
    });
    return;
  }
  if (target.matches("[data-field='defectDate']")) {
    state.draft[target.dataset.field] = target.value;
    state.formError = "";
    stashDraft();
    draw();
    return;
  }
  if (target.matches("#warehouse, #defect")) {
    if (target.id === "warehouse") state.draft.warehouseQty = parseQty(target.value, true);
    else state.draft.defectQty = parseQty(target.value, false);
    stashDraft();
    draw();
    return;
  }
  if (target.matches("[data-field='putOnShelf']")) {
    state.draft.putOnShelf = target.checked;
    stashDraft();
    return;
  }
  if (target.matches("[data-plan]")) {
    const prev = db.signals[target.dataset.id] || {};
    db.signals[target.dataset.id] = {
      ...prev,
      [target.dataset.plan]: target.value || null,
      updatedAt: new Date().toISOString(),
    };
    persist();
    toast("Дата сохранена");
    draw();
    return;
  }
  if (target.matches("[data-setting='startStoreId']")) {
    db.settings.startStoreId = target.value || null;
    persist();
    draw();
    return;
  }
  if (target.matches("[data-import]") && target.files?.[0]) {
    importCopy(target.files[0]).then(draw);
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-search]")) {
    state.query = target.value;
    const pos = target.selectionStart;
    draw();
    const next = document.querySelector("[data-search]");
    if (next) {
      next.focus();
      next.setSelectionRange(pos, pos);
    }
    return;
  }
  if (target.matches("#note")) state.draft.note = target.value;
  if (target.matches("#warehouse")) state.draft.warehouseQty = parseQty(target.value, true);
  if (target.matches("#defect")) state.draft.defectQty = parseQty(target.value, false);
  if (target.matches("#note, #warehouse, #defect")) stashDraft();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    clearTimeout(mileageTimer);
    persist();
  }
});

draw();
