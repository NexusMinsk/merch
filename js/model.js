/** merch — точки и сборка маршрута.
 *  День брака идёт первым.
 *  Поставка попадает в маршрут на следующий день: нужно выставить товар.
 *  Дальше — пустые полки, ноль на складе, малый остаток, потом контроль.
 *  Внутри группы точки стоят так, чтобы меньше петлять по Минску.
 */

export const MINSK_CENTER = { lat: 53.9023, lon: 27.5619 };

export const STORES = [
  { id: "gippo-nekrasova", chain: "Гиппо", address: "Некрасова 3А", place: "", maps: "Гиппо, ул. Некрасова 3А, Минск", hint: "На картах это ул. Некрасова, 3А.", lat: 53.93012, lon: 27.595881 },
  { id: "santa-makayonka", chain: "Санта", address: "Макаёнка 11", place: "", maps: "Санта, ул. Макаёнка 11, Минск", lat: 53.921417, lon: 27.628248 },
  { id: "santa-kalinovskogo", chain: "Санта", address: "Калиновского 55", place: "", maps: "Санта, ул. Калиновского 55, Минск", lat: 53.947314, lon: 27.629512 },
  { id: "santa-slavinskogo", chain: "Санта", address: "Славинского 45", place: "", maps: "Санта, ул. Славинского 45, Минск", lat: 53.938773, lon: 27.64203 },
  { id: "santa-tolbukhina", chain: "Санта", address: "Толбухина 4", place: "", maps: "Санта, ул. Толбухина 4, Минск", lat: 53.92698, lon: 27.613994 },
  { id: "green-pobediteley", chain: "Грин", address: "Победителей 84", place: "", maps: "Грин, пр-т Победителей 84, Минск", lat: 53.937874, lon: 27.485292 },
  { id: "gippo-partizansky", chain: "Гиппо", address: "Партизанский 79", place: "", maps: "Гиппо, пр-т Партизанский 79, Минск", lat: 53.876342, lon: 27.625826 },
  { id: "gippo-pobediteley", chain: "Гиппо", address: "Победителей 9", place: "", maps: "Гиппо, пр-т Победителей 9, Минск", lat: 53.908456, lon: 27.548499 },
  { id: "almi-partizansky", chain: "Алми", address: "Партизанский 19А", place: "", maps: "Алми, пр-т Партизанский 19А, Минск", lat: 53.884111, lon: 27.59295 },
  { id: "santa-partizansky-106", chain: "Санта", address: "Партизанский 106", place: "", maps: "Санта, пр-т Партизанский 106, Минск", lat: 53.868047, lon: 27.649835 },
  { id: "santa-partizansky-48", chain: "Санта", address: "Партизанский 48", place: "", maps: "Санта, пр-т Партизанский 48, Минск", lat: 53.874845, lon: 27.624732 },
  { id: "gippo-gorodetskaya", chain: "Гиппо", address: "Городецкая 30", place: "", maps: "Гиппо, ул. Городецкая 30, Минск", lat: 53.947689, lon: 27.678211 },
  { id: "santa-russiyanova", chain: "Санта", address: "Руссиянова 36", place: "", maps: "Санта, ул. Руссиянова 36, Минск", lat: 53.93588, lon: 27.688734 },
  { id: "santa-nezavisimosti", chain: "Санта", address: "Независимости 179", place: "", maps: "Санта, пр-т Независимости 179, Минск", lat: 53.946287, lon: 27.68853 },
  { id: "evroopt-nikiforova", chain: "Евроопт", address: "Никифорова 51", place: "", maps: "Евроопт, ул. Никифорова 51, Минск", lat: 53.942433, lon: 27.698273 },
  { id: "evroopt-lozhinskaya", chain: "Евроопт", address: "Ложинская 22", place: "", maps: "Евроопт, ул. Ложинская 22, Минск", lat: 53.951786, lon: 27.681514 },
  { id: "santa-valeryanovo", chain: "Санта", address: "Логойская 5А", place: "Валерьяново", maps: "Санта, д. Валерьяново, ул. Логойская 5А", lat: 53.969426, lon: 27.648114 },
  { id: "evroopt-borovlyany", chain: "Евроопт", address: "40 лет Победы 43", place: "Боровляны", maps: "Евроопт, д. Боровляны, ул. 40 лет Победы 43", hint: "Боровлянский с/с, 43 — это ул. 40 лет Победы, 43.", lat: 53.988666, lon: 27.676057 },
  { id: "km9", chain: "Санта", address: "9-й км", place: "Московское шоссе", maps: "Санта, Московское шоссе, 9-й километр, 4А", hint: "На картах это Санта на 9-м километре, дом 4А.", lat: 53.964035, lon: 27.741099 },
  { id: "kolodishchi", chain: "Санта", address: "Энтузиастов 2", place: "Колодищи", maps: "Санта, аг. Колодищи, ул. Энтузиастов 2", hint: "На картах это Санта, ул. Энтузиастов, 2.", lat: 53.918779, lon: 27.752712 },
  { id: "santa-ilimskaya", chain: "Санта", address: "Илимская 27", place: "", maps: "Санта, ул. Илимская 27, Минск", lat: 53.891492, lon: 27.683512 },
  { id: "santa-nesterova", chain: "Санта", address: "Нестерова 58", place: "", maps: "Санта, ул. Нестерова 58, Минск", lat: 53.883868, lon: 27.685071 },
];

export const CHAINS = ["Гиппо", "Санта", "Грин", "Алми", "Евроопт"];

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function storeById(id) {
  return STORES.find((store) => store.id === id) || null;
}

export function storeLine(store) {
  return store.place ? `${store.address} · ${store.place}` : store.address;
}

export function todayISO(now = new Date()) {
  return isoFromDate(now);
}

export function isoFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return isoFromDate(date);
}

export function daysBetween(fromISO, toISO) {
  const ms = parseISO(toISO) - parseISO(fromISO);
  return Math.round(ms / 86400000);
}

export function prettyDate(iso, { weekday = true } = {}) {
  const date = parseISO(iso);
  const body = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  if (!weekday) return body;
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${body}`;
}

export function longDate(iso) {
  const date = parseISO(iso);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export const REASONS = {
  defect: { label: "Много брака", tone: "alert" },
  delivery: { label: "Выставить поставку", tone: "delivery" },
  stockout: { label: "Нет товара", tone: "alert" },
  emptyShelf: { label: "Полка пустая", tone: "warn" },
  lowStock: { label: "Мало на складе", tone: "warn" },
  orderCheck: { label: "Проверить заказ", tone: "info" },
  control: { label: "Контроль", tone: "calm" },
  pin: { label: "Добавили сами", tone: "info" },
};

const REASON_ORDER = ["defect", "delivery", "stockout", "emptyShelf", "lowStock", "orderCheck", "pin", "control"];

export function primaryReason(reasons) {
  return REASON_ORDER.find((key) => reasons.includes(key)) || "control";
}

export function dueDelivery(storeId, date, deliveries, signal) {
  const book = deliveries || {};
  const dates = Object.keys(book)
    .filter((day) => Array.isArray(book[day]) && book[day].includes(storeId) && addDays(day, 1) <= date)
    .sort();
  if (dates.length === 0) return null;
  const latest = dates[dates.length - 1];
  const lastVisit = signal?.lastVisitDate || null;
  if (lastVisit && lastVisit > latest) return null;
  return latest;
}

export function assessStore(store, signal, date, settings) {
  const info = signal || {};
  const reasons = [];
  let score = 0;
  const lastVisit = info.lastVisitDate || null;
  const daysSince = lastVisit ? daysBetween(lastVisit, date) : null;

  if (info.defectDate && info.defectDate <= date && (!lastVisit || lastVisit < info.defectDate)) {
    reasons.push("defect");
    score += 10000;
    if (info.defectDate < date) score += 500;
  }

  const deliveryOn = dueDelivery(store.id, date, settings.deliveries, info);
  if (deliveryOn) {
    reasons.push("delivery");
    score += 8000;
    if (addDays(deliveryOn, 1) < date) score += 400;
  }

  const shelf = info.shelf || null;
  const warehouse = info.warehouseQty;
  const hasWarehouse = typeof warehouse === "number";

  if (shelf === "empty" && hasWarehouse && warehouse === 0) {
    reasons.push("stockout");
    score += 5000;
    if (info.orderStatus === "not_done") score += 700;
  } else if (shelf === "empty") {
    reasons.push("emptyShelf");
    score += 3400;
  } else if (shelf === "low") {
    score += 500;
  }

  if (hasWarehouse && warehouse <= settings.lowStock && !reasons.includes("stockout")) {
    reasons.push("lowStock");
    score += 700 + (settings.lowStock - warehouse) * 35;
  }

  if (info.orderStatus === "done" && (shelf === "empty" || shelf === "low")) {
    reasons.push("orderCheck");
    score += 1800;
  }

  const controlDays = daysSince == null ? 9 : Math.min(daysSince, 14);
  score += controlDays * 70;
  if (reasons.length === 0) reasons.push("control");

  return {
    store,
    storeId: store.id,
    lat: store.lat,
    lon: store.lon,
    reasons,
    primary: primaryReason(reasons),
    score,
    daysSince,
    tier: REASON_ORDER.indexOf(primaryReason(reasons)),
    deliveryOn: deliveryOn || null,
  };
}

function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nearestNeighbor(points, start) {
  const left = points.slice();
  const route = [];
  let cursor = start;
  while (left.length) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < left.length; i += 1) {
      const distance = haversine(cursor, left[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    cursor = left.splice(best, 1)[0];
    route.push(cursor);
  }
  return route;
}

function twoOpt(route, start) {
  const path = route.slice();
  let guard = 0;
  let improved = true;
  while (improved && guard < 80) {
    improved = false;
    guard += 1;
    for (let i = 0; i < path.length - 1; i += 1) {
      for (let k = i + 1; k < path.length; k += 1) {
        const prev = i === 0 ? start : path[i - 1];
        const next = k + 1 < path.length ? path[k + 1] : null;
        const before = haversine(prev, path[i]) + (next ? haversine(path[k], next) : 0);
        const after = haversine(prev, path[k]) + (next ? haversine(path[i], next) : 0);
        if (after + 0.0001 < before) {
          const reversed = path.slice(i, k + 1).reverse();
          path.splice(i, reversed.length, ...reversed);
          improved = true;
          i = path.length;
          break;
        }
      }
    }
  }
  return path;
}

export function startPoint(settings) {
  if (settings.startStoreId) {
    const store = storeById(settings.startStoreId);
    if (store) return store;
  }
  return MINSK_CENTER;
}

function arrange(chosen, start) {
  const defects = chosen.filter((item) => item.reasons.includes("defect"));
  const rest = chosen.filter((item) => !item.reasons.includes("defect"));
  const defectPath = defects.length ? twoOpt(nearestNeighbor(defects, start), start) : [];
  const anchor = defectPath.length ? defectPath[defectPath.length - 1].store : start;
  const restPath = rest.length ? twoOpt(nearestNeighbor(rest, anchor), anchor) : [];
  return [...defectPath, ...restPath];
}

function applyManualOrder(stops, orderIds, start) {
  if (!orderIds || orderIds.length === 0) return arrange(stops, start);
  const rank = new Map(orderIds.map((id, index) => [id, index]));
  const key = (item) => {
    if (item.reasons.includes("defect") && !rank.has(item.storeId)) return -1000;
    if (rank.has(item.storeId)) return rank.get(item.storeId);
    if (item.tier <= 1) return 500;
    return 1000;
  };
  return stops.slice().sort((a, b) => key(a) - key(b) || a.tier - b.tier);
}

export function explainStop(stop, signal, date) {
  const info = signal || {};
  if (stop.reasons.includes("defect")) {
    if (info.defectDate === date) return "На сегодня отмечено много брака — эта точка первая.";
    if (info.defectDate) return `Много брака было ${prettyDate(info.defectDate, { weekday: false })}, визита после этой даты ещё не было.`;
    return "На этот день отмечен большой брак — точка идёт первой.";
  }
  if (stop.reasons.includes("delivery")) {
    const when = stop.deliveryOn ? prettyDate(stop.deliveryOn, { weekday: false }) : "вчера";
    return `Поставка ${when}. Сегодня нужно приехать и выставить товар.`;
  }
  if (stop.reasons.includes("stockout")) {
    return info.orderStatus === "not_done"
      ? "На полке пусто, на складе ноль, заказ товароведу не сделан."
      : "На полке пусто и на складе ничего не осталось.";
  }
  if (stop.reasons.includes("emptyShelf")) return "В прошлый раз полку раскупили.";
  if (stop.reasons.includes("lowStock")) {
    return typeof info.warehouseQty === "number"
      ? `На складе было ${info.warehouseQty} шт.`
      : "На складе мало.";
  }
  if (stop.reasons.includes("orderCheck")) return "Заказ товароведу сделан — проверить, доехал ли товар.";
  if (stop.reasons.includes("pin")) return "Точку добавили в маршрут вручную.";
  if (stop.daysSince == null) return "Здесь ещё не были. Обычный контроль полки.";
  if (stop.daysSince === 0) return "Уже были сегодня. Точка в маршруте, потому что её добавили вручную.";
  return `Контроль: последний визит ${stop.daysSince} ${plural(stop.daysSince, "день", "дня", "дней")} назад.`;
}

export function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last > 1 && last < 5) return few;
  return many;
}

function cooledDown(item) {
  return item.daysSince == null || item.daysSince >= 2;
}

function rotationRank(item) {
  if (item.daysSince == null) return 100;
  let rank = item.daysSince;
  if (item.reasons.includes("emptyShelf")) rank += 3;
  if (item.reasons.includes("lowStock")) rank += 2;
  if (item.reasons.includes("orderCheck")) rank += 2;
  return rank;
}

function pickRotation(pool, count, start) {
  if (count <= 0 || pool.length === 0) return [];
  const ranked = pool.slice().sort((a, b) => rotationRank(b) - rotationRank(a) || a.store.address.localeCompare(b.store.address, "ru"));
  const best = rotationRank(ranked[0]);
  const group = ranked.filter((item) => rotationRank(item) === best);
  const source = group.length >= count ? group : ranked;
  if (source.length <= count) return source.slice(0, count);
  return twoOpt(nearestNeighbor(source, start).slice(0, count), start);
}

export function planDay(date, db) {
  const settings = { ...db.settings, deliveries: db.deliveries || {} };
  const override = db.overrides[date] || { pin: [], drop: [], order: [] };
  const dropped = new Set(override.drop || []);
  const pinned = new Set(override.pin || []);
  const start = startPoint(settings);
  const assessed = STORES.map((store) => assessStore(store, db.signals[store.id], date, settings))
    .filter((item) => !dropped.has(item.storeId));

  const informed = Object.values(db.signals).some((signal) => signal && (
    signal.lastVisitDate || signal.defectDate || signal.shelf || signal.orderStatus || typeof signal.warehouseQty === "number"
  ));
  const due = assessed.some((item) => item.reasons.includes("delivery") || item.reasons.includes("defect"));
  let chosen;
  let mode = "priority";

  if (!informed && pinned.size === 0 && !due) {
    mode = "first";
    const path = nearestNeighbor(assessed, start);
    chosen = twoOpt(path.slice(0, settings.maxStops), start);
  } else {
    for (const item of assessed) {
      if (pinned.has(item.storeId) && !item.reasons.includes("defect") && !item.reasons.includes("delivery")) {
        item.reasons = item.reasons.filter((reason) => reason !== "control");
        item.reasons.push("pin");
        item.primary = primaryReason(item.reasons);
      }
    }
    const must = assessed.filter((item) => item.reasons.includes("defect") || item.reasons.includes("delivery") || pinned.has(item.storeId));
    const mustIds = new Set(must.map((item) => item.storeId));
    const problemPool = assessed
      .filter((item) => !mustIds.has(item.storeId) && (
        item.reasons.includes("stockout") ||
        (cooledDown(item) && (item.reasons.includes("emptyShelf") || item.reasons.includes("lowStock") || item.reasons.includes("orderCheck")))
      ))
      .sort((a, b) => b.score - a.score);
    const free = Math.max(0, settings.maxStops - must.length);
    const problemCap = Math.min(problemPool.length, Math.floor(free / 2));
    chosen = must.concat(problemPool.slice(0, problemCap));
    const picked = new Set(chosen.map((item) => item.storeId));
    const rotation = assessed.filter((item) => !picked.has(item.storeId) && cooledDown(item));
    chosen = chosen.concat(pickRotation(rotation, Math.max(0, settings.maxStops - chosen.length), start));
    chosen = applyManualOrder(chosen, override.order, start);
  }

  const mustCount = chosen.filter((item) => item.reasons.includes("defect") || item.reasons.includes("delivery")).length;

  return {
    date,
    mode,
    locked: false,
    overflow: mustCount > settings.maxStops,
    stops: chosen.map((item) => ({
      storeId: item.storeId,
      reasons: item.reasons,
      primary: item.primary,
      score: item.score,
      daysSince: item.daysSince,
      deliveryOn: item.deliveryOn || null,
      status: "pending",
      arrivedAt: null,
      finishedAt: null,
      visit: null,
    })),
  };
}

export function straightKm(stops) {
  const stores = stops.map((stop) => storeById(stop.storeId)).filter(Boolean);
  let total = 0;
  for (let i = 1; i < stores.length; i += 1) total += haversine(stores[i - 1], stores[i]);
  return Math.round(total);
}

export function yandexRouteUrls(stops) {
  const stores = stops.map((stop) => storeById(stop.storeId)).filter(Boolean);
  if (stores.length === 0) return [];
  const chunkSize = 9;
  const links = [];
  for (let index = 0; index < stores.length; index += chunkSize) {
    const chunk = stores.slice(index, index + chunkSize);
    const points = chunk.map((store) => `${store.lat.toFixed(6)},${store.lon.toFixed(6)}`);
    links.push({
      label: stores.length > chunkSize ? `Часть ${links.length + 1} в Яндекс Картах` : "Открыть маршрут в Яндекс Картах",
      href: `https://yandex.ru/maps/?rtext=~${points.join("~")}&rtt=auto`,
    });
  }
  return links;
}

export function yandexEmbedUrl(stops) {
  const stores = stops.map((stop) => storeById(stop.storeId)).filter(Boolean).slice(0, 10);
  if (stores.length === 0) return "";
  const rtext = stores.map((store) => `${store.lat.toFixed(6)},${store.lon.toFixed(6)}`).join("~");
  const lat = stores.reduce((sum, store) => sum + store.lat, 0) / stores.length;
  const lon = stores.reduce((sum, store) => sum + store.lon, 0) / stores.length;
  return `https://yandex.ru/map-widget/v1/?rtext=${rtext}&rtt=auto&ll=${lon.toFixed(6)},${lat.toFixed(6)}&z=11`;
}

export function yandexPointUrl(store) {
  return `https://yandex.ru/maps/?rtext=~${store.lat.toFixed(6)},${store.lon.toFixed(6)}&rtt=auto`;
}

export function yandexSearchUrl(store) {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(store.maps)}`;
}

export function reasonChips(stop) {
  const chips = [];
  const primary = stop.primary || primaryReason(stop.reasons);
  chips.push(primary);
  const second = REASON_ORDER.find((key) => key !== primary && stop.reasons.includes(key) && key !== "control");
  if (second) chips.push(second);
  return chips.map((key) => {
    const meta = REASONS[key];
    let label = meta.label;
    if (key === "control" && stop.daysSince == null) label = "Ещё не были";
    else if (key === "control" && typeof stop.daysSince === "number") {
      label = stop.daysSince === 0 ? "Контроль" : `Контроль · ${stop.daysSince} дн.`;
    }
    return { key, label, tone: meta.tone };
  });
}

export function shelfLabel(value) {
  if (value === "ok") return "Норма";
  if (value === "low") return "Мало";
  if (value === "empty") return "Раскупили";
  return "Не отмечено";
}

export function orderLabel(value) {
  if (value === "done") return "Заказ сделан";
  if (value === "not_done") return "Заказ не сделан";
  if (value === "not_needed") return "Заказ не нужен";
  return "Заказ не отмечен";
}
