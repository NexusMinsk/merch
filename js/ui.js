import {
  CHAINS,
  STORES,
  addDays,
  explainStop,
  longDate,
  orderLabel,
  planDay,
  plural,
  prettyDate,
  reasonChips,
  shelfLabel,
  storeById,
  storeLine,
  straightKm,
  todayISO,
  yandexEmbedUrl,
  yandexPointUrl,
  yandexRouteUrls,
  yandexSearchUrl,
} from "./model.js";
import { formatKm } from "./track.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function tallyText(stops) {
  const defect = stops.filter((stop) => stop.reasons.includes("defect")).length;
  const delivery = stops.filter((stop) => stop.reasons.includes("delivery")).length;
  const parts = [`${stops.length} ${plural(stops.length, "точка", "точки", "точек")}`];
  if (defect) parts.push(`брак: ${defect}`);
  if (delivery) parts.push(`поставки: ${delivery}`);
  return parts.join(" · ");
}

function chipsHtml(stop) {
  return `<div class="chips">${reasonChips(stop).map((chip) => `<span class="chip ${chip.tone}">${esc(chip.label)}</span>`).join("")}</div>`;
}

function stopCard(stop, index, date, { current = false, locked = false } = {}) {
  const store = storeById(stop.storeId);
  if (!store) return "";
  const cls = ["stop", stop.status, current ? "current" : ""].filter(Boolean).join(" ");
  const canMove = stop.status === "pending";
  const move = canMove
    ? `<div class="row-actions">
        <button class="mini" type="button" data-action="move" data-date="${date}" data-id="${store.id}" data-dir="-1" aria-label="Выше">↑</button>
        <button class="mini" type="button" data-action="move" data-date="${date}" data-id="${store.id}" data-dir="1" aria-label="Ниже">↓</button>
      </div>`
    : "";
  const remove = !locked && stop.status === "pending"
    ? `<button class="mini" type="button" data-action="drop" data-date="${date}" data-id="${store.id}" aria-label="Убрать из маршрута">×</button>`
    : "";
  const statusLine = stop.status === "done"
    ? `<div class="meta">Готово · полка: ${esc(shelfLabel(stop.visit?.shelf))} · склад: ${stop.visit?.warehouseQty ?? "—"} · брак: ${stop.visit?.defectQty ?? 0}</div>`
    : stop.status === "skipped"
      ? `<div class="meta">Пропуск</div>`
      : stop.arrivedAt
        ? `<div class="meta">Отметки не закончены</div>`
        : chipsHtml(stop);
  return `<article class="${cls}">
    <div class="num">${index + 1}</div>
    <button class="text-btn" type="button" data-action="open-stop" data-date="${date}" data-id="${store.id}" style="text-align:left">
      <div class="brand" data-chain="${esc(store.chain)}">${esc(store.chain)}</div>
      <div class="addr">${esc(storeLine(store))}</div>
      ${statusLine}
    </button>
    <div>
      ${move}
      <div class="row-actions" style="margin-top:6px">
        <a class="go" href="${yandexPointUrl(store)}" target="_blank" rel="noopener">Ехать</a>
        ${remove}
      </div>
    </div>
  </article>`;
}

function linksHtml(stops) {
  const links = yandexRouteUrls(stops.filter((stop) => stop.status !== "skipped"));
  if (links.length === 0) return "";
  return links.map((link, index) => `<a class="btn ${index === 0 ? "secondary" : "ghost"} wide" href="${link.href}" target="_blank" rel="noopener">${esc(link.label)}</a>`).join("");
}

function schemeBlock(stops) {
  const active = stops.filter((stop) => stop.status !== "skipped");
  if (active.length === 0) return "";
  const url = yandexEmbedUrl(active);
  const extra = active.length > 10 ? " На карте первые 10 точек." : "";
  return `<div class="scheme"><div class="map-slot" data-src="${esc(url)}"></div><p class="km">По прямой примерно ${straightKm(active)} км.${extra} Линия на карте — дорога между точками.</p></div>`;
}

function planIntro(plan) {
  if (plan.mode === "first") {
    return "Пока нет отметок. Собрал ближний круг. Дальше в маршрут пойдут новые магазины, а не одни и те же.";
  }
  if (plan.overflow) {
    return "Обязательных точек больше лимита. Брак и вчерашнюю поставку оставил все.";
  }
  return "Обязательно брак и выкладка вчерашней поставки. 9-й км и Партизанский 106 — через день: если вчера уже были, сегодня их нет. Остальные места — остатки и магазины, где давно не были.";
}

function mileageBits(day, { live = false } = {}) {
  if (!live && !day?.track) return { stat: "", note: "", denied: false };
  const track = day?.track;
  const denied = Boolean(track?.denied);
  const empty = !(track?.meters > 0);
  const stat = denied && empty
    ? `<span class="stat" data-mileage>Пробег не пишется</span>`
    : `<span class="stat" data-mileage>Пробег ${formatKm(track?.meters || 0)}</span>`;
  const note = live && !denied
    ? `<p class="fine">Пробег пишется по GPS, пока день открыт. Если свернуть приложение, часть дороги может не попасть в километраж.</p>`
    : "";
  return { stat, note, denied };
}

function todayView(state, db, today) {
  const day = db.days[today];
  const plan = day || planDay(today, db);
  const stops = plan.stops || [];
  const done = stops.filter((stop) => stop.status === "done").length;
  const current = stops.find((stop) => stop.status === "pending");
  const currentStore = current ? storeById(current.storeId) : null;
  const hint = !db.settings.hintSeen
    ? `<section class="hint-card">
        <h2>Как устроен день</h2>
        <ol>
          <li>С утра отметьте магазины, куда сегодня привезут. Завтра они станут обязательными.</li>
          <li>На точке отметьте полку, склад, брак и заказ. Дату поставки больше вписывать не нужно.</li>
          <li>В карточке точки один раз сохраните фото магазина и схему: где пиво и где склад.</li>
          <li>Вечером откройте «Завтра»: там выкладка и магазины, где ещё не были.</li>
        </ol>
        <button class="btn ghost wide" style="margin-top:12px" type="button" data-action="dismiss-hint">Понятно</button>
      </section>`
    : "";

  if (!day) {
    return `${hint}
      <section class="hero">
        <p class="eyebrow">${esc(longDate(today))}</p>
        <h1>План на сегодня</h1>
        <div class="stats"><span class="stat">${esc(tallyText(stops))}</span></div>
        <p class="lede">${esc(planIntro(plan))}</p>
      </section>
      ${deliveryCard(db, today)}
      <div class="stack">
        <button class="btn primary wide" type="button" data-action="start-day" ${stops.length === 0 ? "disabled" : ""}>Начать работу</button>
        ${linksHtml(stops)}
      </div>
      ${schemeBlock(stops)}
      <h2 class="section-title">Порядок</h2>
      ${stops.map((stop, index) => stopCard(stop, index, today, { locked: false })).join("") || `<p class="lede">Маршрут пустой. Добавьте точку или уберите исключение.</p>`}
      <button class="btn ghost wide" style="margin-top:10px" type="button" data-action="open-picker" data-date="${today}">Добавить точку</button>`;
  }

  if (day.status === "done") {
    const skipped = stops.filter((stop) => stop.status === "skipped").length;
    const mileage = mileageBits(day);
    return `<section class="hero">
        <p class="eyebrow">${esc(longDate(today))}</p>
        <h1>День закрыт</h1>
        <div class="stats">
          <span class="stat">${done} готово</span>
          ${skipped ? `<span class="stat">${skipped} пропуск</span>` : ""}
          ${mileage.stat}
        </div>
      </section>
      ${deliveryCard(db, today)}
      ${schemeBlock(stops)}
      <h2 class="section-title">Как прошло</h2>
      ${stops.map((stop, index) => stopCard(stop, index, today, { locked: true })).join("")}
      <div class="stack">
        <button class="btn ghost wide" type="button" data-action="reopen-day">Открыть день снова</button>
        <button class="btn ghost wide" type="button" data-action="ask-cancel-day">Выключить день</button>
        ${linksHtml(stops)}
      </div>`;
  }

  const progress = stops.length ? Math.round((done / stops.length) * 100) : 0;
  const why = current ? explainStop(current, db.signals[current.storeId], today) : "Все точки закрыты.";
  const currentBlock = currentStore
    ? `<section class="card now">
        <p class="eyebrow">Сейчас · ${stops.indexOf(current) + 1} из ${stops.length}</p>
        <div class="brand" data-chain="${esc(currentStore.chain)}">${esc(currentStore.chain)}</div>
        <h2>${esc(storeLine(currentStore))}</h2>
        <p class="why">${esc(why)}</p>
        <div class="chips">${reasonChips(current).map((chip) => `<span class="chip ${chip.tone}">${esc(chip.label)}</span>`).join("")}</div>
        <div class="stack">
          <button class="btn primary wide" type="button" data-action="arrive" data-date="${today}" data-id="${current.storeId}">${current.arrivedAt ? "Продолжить отметки" : "Я на точке"}</button>
          <a class="btn secondary wide" href="${yandexPointUrl(currentStore)}" target="_blank" rel="noopener">Ехать в Яндекс Картах</a>
        </div>
      </section>`
    : `<section class="card now"><h2>Точки закончились</h2><p class="why">Можно закрыть день.</p></section>`;

  const fresh = stops.every((stop) => stop.status === "pending" && !stop.arrivedAt);
  const mileage = mileageBits(day, { live: true });
  return `<section class="hero">
      <p class="eyebrow">${esc(longDate(today))}</p>
      <h1>В работе</h1>
      <div class="stats"><span class="stat">${done} из ${stops.length}</span>${mileage.stat}</div>
      <div class="progress"><span style="width:${progress}%"></span></div>
      ${mileage.note}
    </section>
    ${mileage.denied ? `<button class="btn ghost wide" style="margin-top:10px" type="button" data-action="enable-mileage">Разрешить геолокацию для пробега</button>` : ""}
    ${deliveryCard(db, today)}
    ${currentBlock}
    ${currentStore ? guidePeekCard(currentStore.id, "Карточка") : ""}
    ${schemeBlock(stops)}
    <h2 class="section-title">Весь день</h2>
    ${stops.map((stop, index) => stopCard(stop, index, today, { current: stop === current, locked: true })).join("")}
    <button class="btn ghost wide" style="margin-top:10px" type="button" data-action="open-picker" data-date="${today}">Добавить точку</button>
    <div class="stack">
      ${linksHtml(stops)}
      ${fresh ? `<button class="btn ghost wide" type="button" data-action="ask-rebuild">Пересобрать маршрут</button>` : ""}
      <button class="btn ghost wide" type="button" data-action="ask-finish">Завершить день</button>
      <button class="btn ghost wide" type="button" data-action="ask-cancel-day">Выключить день</button>
    </div>`;
}

function tomorrowView(db, today) {
  const date = addDays(today, 1);
  const plan = planDay(date, db);
  return `<section class="hero">
      <p class="eyebrow">Черновик · ${esc(longDate(date))}</p>
      <h1>Маршрут на завтра</h1>
      <div class="stats"><span class="stat">${esc(tallyText(plan.stops))}</span></div>
      <p class="lede">Сюда попадают магазины из утреннего списка поставки за сегодня. Остальные места — по остаткам и по тем, где ещё не были.</p>
    </section>
    <div class="stack">${linksHtml(plan.stops)}</div>
    ${schemeBlock(plan.stops)}
    <p class="lede">${esc(planIntro(plan))}</p>
    <h2 class="section-title">Порядок</h2>
    ${plan.stops.map((stop, index) => stopCard(stop, index, date, { locked: false })).join("") || `<p class="lede">На завтра точек нет.</p>`}
    <button class="btn ghost wide" style="margin-top:10px" type="button" data-action="open-picker" data-date="${date}">Добавить точку</button>`;
}

function visitView(state, db) {
  const store = storeById(state.storeId);
  const day = db.days[state.date];
  const stop = day?.stops?.find((item) => item.storeId === state.storeId);
  if (!store || !stop) return `<p class="lede">Точка не найдена.</p><button class="btn ghost" type="button" data-action="go" data-view="today">На сегодня</button>`;
  const draft = state.draft;
  const signal = db.signals[store.id];
  const stockout = draft.shelf === "empty" && draft.warehouseQty === 0;
  const previous = signal?.lastVisitDate && signal.lastVisitDate !== state.date
    ? `<p class="meta">Прошлый визит ${esc(prettyDate(signal.lastVisitDate))}: полка — ${esc(shelfLabel(signal.shelf))}, склад — ${signal.warehouseQty ?? "не смотрели"}, брак — ${signal.defectQty ?? 0}. ${esc(orderLabel(signal.orderStatus))}.</p>`
    : signal?.lastVisitDate
      ? ""
      : `<p class="meta">На этой точке ещё не были.</p>`;
  const warehouseValue = draft.warehouseQty == null ? "" : String(draft.warehouseQty);
  return `<button class="back-btn" type="button" data-action="go" data-view="today">← Ко дню</button>
    <p class="eyebrow" style="margin-top:10px">${esc(explainStop(stop, db.signals[store.id], state.date))}</p>
    <h1>${esc(store.chain)}</h1>
    <p class="lede">${esc(storeLine(store))}</p>
    ${previous}
    ${store.hint ? `<p class="hint">${esc(store.hint)}</p>` : ""}
    ${guidePeekCard(store.id, "Изменить", true)}
    <div class="field">
      <div class="label">Полка</div>
      <div class="choice">
        ${[["ok", "Норма"], ["low", "Мало"], ["empty", "Раскупили"]].map(([value, label]) => `<button type="button" data-action="shelf" data-value="${value}" aria-pressed="${draft.shelf === value}">${label}</button>`).join("")}
      </div>
    </div>
    <div class="field">
      <label for="warehouse">Пиво на складе, шт</label>
      <div class="stepper">
        <button class="mini" type="button" data-action="step" data-field="warehouseQty" data-dir="-1" aria-label="Меньше">−</button>
        <input id="warehouse" inputmode="numeric" placeholder="не смотрел" value="${esc(warehouseValue)}" data-field="warehouseQty">
        <button class="mini" type="button" data-action="step" data-field="warehouseQty" data-dir="1" aria-label="Больше">+</button>
      </div>
      <button class="text-btn" type="button" data-action="warehouse-clear" style="margin-top:6px;font-weight:700">Не смотрел склад</button>
    </div>
    <div class="field">
      <label for="defect">Брак сегодня, шт</label>
      <div class="stepper">
        <button class="mini" type="button" data-action="step" data-field="defectQty" data-dir="-1" aria-label="Меньше">−</button>
        <input id="defect" inputmode="numeric" value="${esc(draft.defectQty)}" data-field="defectQty">
        <button class="mini" type="button" data-action="step" data-field="defectQty" data-dir="1" aria-label="Больше">+</button>
      </div>
    </div>
    <div class="field">
      <label for="defectDate">Когда будет много брака</label>
      <input id="defectDate" type="date" value="${esc(draft.defectDate)}" data-field="defectDate">
      <p class="hint">${draft.defectDate ? `${esc(prettyDate(draft.defectDate))} точка встанет первой в маршруте.` : "В этот день точка встанет первой."}</p>
      ${draft.defectDate ? `<button class="text-btn" type="button" data-action="clear-date" data-field="defectDate">Убрать дату брака</button>` : ""}
    </div>
    ${stockout ? `<div class="banner alert"><strong>Нет товара ни на полке, ни на складе.</strong>Отметьте, сделали ли заказ у товароведа.</div>` : ""}
    <div class="field">
      <div class="label">Заказ у товароведа</div>
      <div class="choice">
        ${[["done", "Сделал"], ["not_done", "Не сделал"], ["not_needed", "Не нужен"]].map(([value, label]) => `<button type="button" data-action="order" data-value="${value}" aria-pressed="${draft.orderStatus === value}">${label}</button>`).join("")}
      </div>
    </div>
    <label class="check"><input type="checkbox" data-field="putOnShelf" ${draft.putOnShelf ? "checked" : ""}> Выставил товар на полку</label>
    <div class="field">
      <label for="note">Заметка</label>
      <textarea id="note" data-field="note" placeholder="Что важно не забыть">${esc(draft.note)}</textarea>
    </div>
    ${state.formError ? `<p class="error">${esc(state.formError)}</p>` : ""}
    <div class="dock">
      <button class="btn primary wide" type="button" data-action="save-visit">Точка готова</button>
      ${stop.status !== "done" ? `<button class="btn ghost wide" type="button" data-action="skip-stop">Пропустить точку</button>` : ""}
      ${stop.arrivedAt && stop.status === "pending" ? `<button class="btn ghost wide" type="button" data-action="cancel-arrival">Я ещё не на точке</button>` : ""}
    </div>`;
}

function storesView(state, db) {
  const query = (state.query || "").trim().toLowerCase();
  const stores = STORES.filter((store) => {
    if (state.chain !== "all" && store.chain !== state.chain) return false;
    if (!query) return true;
    return `${store.chain} ${store.address} ${store.place}`.toLowerCase().includes(query);
  });
  const filters = ["all", ...CHAINS].map((chain) => {
    const label = chain === "all" ? "Все" : chain;
    return `<button type="button" data-action="chain" data-value="${esc(chain)}" aria-pressed="${state.chain === chain}">${esc(label)}</button>`;
  }).join("");
  return `<h1>Точки</h1>
    <p class="lede">22 адреса. В карточке — фото магазина и схема, как пройти к пиву и на склад. Дату большого брака тоже можно поставить здесь.</p>
    <input type="search" data-search placeholder="Найти адрес" value="${esc(state.query || "")}">
    <div class="filters">${filters}</div>
    ${stores.map((store) => storeButton(store, db.signals[store.id])).join("")}`;
}

function storeBackLabel(state) {
  if (state.returnView === "visit") return "← К отметкам";
  if (state.returnView === "today" || state.returnView === "day") return "← Ко дню";
  if (state.returnView === "tomorrow") return "← К завтра";
  if (state.returnView === "history") return "← Журнал";
  return "← Все точки";
}

function guidePeekCard(storeId, actionLabel = "Карточка", schemeFirst = false) {
  return `<section class="card guide-peek">
    <div class="split"><strong>Где пиво и склад</strong>
      <button class="text-btn" type="button" data-action="open-store" data-id="${storeId}" style="font-weight:800">${esc(actionLabel)}</button>
    </div>
    <div data-guide-slot="${storeId}" data-scheme-first="${schemeFirst ? "1" : ""}"><p class="hint">Фото и схема ещё не добавлены. Откройте карточку и отметьте, где пиво и где склад.</p></div>
  </section>`;
}

export function guidePeekHtml(photoUrl, sketchUrl, schemeFirst = false) {
  const photo = photoUrl ? `<img class="guide-photo" alt="Фото магазина" src="${esc(photoUrl)}">` : "";
  const sketch = sketchUrl ? `<div class="sketch-board view"><img alt="Схема прохода к пиву и складу" src="${esc(sketchUrl)}"></div>` : "";
  const missing = sketchUrl ? "" : `<p class="hint">Схема прохода ещё не нарисована.</p>`;
  const parts = schemeFirst ? [sketch, missing, photo] : [photo, sketch, missing];
  return parts.join("");
}

function penTools(pen) {
  const tools = [
    ["path", "Проход"],
    ["beer", "Пиво"],
    ["warehouse", "Склад"],
    ["beer-label", "Надпись «пиво»"],
    ["warehouse-label", "Надпись «склад»"],
    ["eraser", "Ластик"],
  ];
  return `<div class="pen-tools">${tools.map(([value, label]) => `<button type="button" data-action="pen" data-pen="${value}" aria-pressed="${pen === value}">${label}</button>`).join("")}</div>`;
}

function storeButton(store, signal) {
  const info = signal || {};
  const bits = [];
  if (!info.lastVisitDate) bits.push("ещё не были");
  else bits.push(prettyDate(info.lastVisitDate));
  if (info.shelf) bits.push(`полка: ${shelfLabel(info.shelf).toLowerCase()}`);
  if (typeof info.warehouseQty === "number") bits.push(`склад ${info.warehouseQty}`);
  if (info.defectDate) bits.push(`брак ${prettyDate(info.defectDate, { weekday: false })}`);
  return `<button class="store-card" type="button" data-action="open-store" data-id="${store.id}">
    <span class="store-thumb" data-thumb="${store.id}"></span>
    <span class="store-card-text">
      <div class="brand" data-chain="${esc(store.chain)}">${esc(store.chain)}</div>
      <div>${esc(storeLine(store))}</div>
      <div class="meta">${esc(bits.join(" · "))}<span data-guide-flag="${store.id}"></span></div>
    </span>
  </button>`;
}

function storeView(state, db) {
  const store = storeById(state.storeId);
  if (!store) return `<p>Точка не найдена.</p>`;
  const signal = db.signals[store.id] || {};
  const visits = visitHistory(db, store.id);
  return `<button class="back-btn" type="button" data-action="close-store">${esc(storeBackLabel(state))}</button>
    <h1 style="margin-top:8px">${esc(store.chain)}</h1>
    <p class="lede">${esc(storeLine(store))}</p>
    ${store.hint ? `<p class="hint">${esc(store.hint)}</p>` : ""}
    <section class="card">
      <h2 class="guide-title">Фото магазина</h2>
      <div class="photo-frame" data-photo-frame="${store.id}">
        <p class="empty-photo">Снимите вход или фасад, чтобы узнавать магазин с улицы.</p>
      </div>
      <div class="stack">
        <label class="btn secondary wide">Сфотографировать<input class="sr-only" type="file" accept="image/*" capture="environment" data-photo-input data-id="${store.id}"></label>
        <label class="btn ghost wide">Из галереи<input class="sr-only" type="file" accept="image/*" data-photo-input data-id="${store.id}"></label>
        <button class="btn ghost wide" type="button" data-action="ask-clear-photo" data-id="${store.id}" data-clear-photo hidden>Убрать фото</button>
      </div>
    </section>
    <section class="card">
      <h2 class="guide-title">Проход к пиву и складу</h2>
      <p class="hint">Нарисуйте путь от входа. Жёлтым — до стеллажа с пивом, синим — до склада. Надпись ставится одним касанием.</p>
      <div class="sketch-board">
        <canvas data-sketch-canvas data-sketch="${store.id}" aria-label="Схема прохода к пиву и складу"></canvas>
      </div>
      ${penTools(state.pen)}
      <div class="pair">
        <button class="btn ghost" type="button" data-action="sketch-undo">Отменить штрих</button>
        <button class="btn ghost" type="button" data-action="ask-sketch-clear">Очистить</button>
      </div>
    </section>
    <div class="field">
      <label for="plan-defect">Много брака в этот день</label>
      <input id="plan-defect" type="date" value="${esc(signal.defectDate || "")}" data-plan="defectDate" data-id="${store.id}">
      <p class="hint">${signal.defectDate ? `${esc(prettyDate(signal.defectDate))} эта точка будет первой.` : "В этот день точка будет первой."}</p>
    </div>
    <div class="stack">
      <a class="btn secondary wide" href="${yandexPointUrl(store)}" target="_blank" rel="noopener">Ехать в Яндекс Картах</a>
      <a class="btn ghost wide" href="${yandexSearchUrl(store)}" target="_blank" rel="noopener">Открыть по названию</a>
    </div>
    <h2 class="section-title">Визиты</h2>
    ${visits.length ? visits.map((item) => `<article class="card"><strong>${esc(prettyDate(item.date))}</strong><p class="meta">Полка: ${esc(shelfLabel(item.visit.shelf))} · склад: ${item.visit.warehouseQty ?? "—"} · брак: ${item.visit.defectQty ?? 0} · ${esc(orderLabel(item.visit.orderStatus))}${item.visit.putOnShelf ? " · выставил" : ""}</p>${item.visit.note ? `<p class="meta">${esc(item.visit.note)}</p>` : ""}</article>`).join("") : `<p class="lede">Визитов пока нет.</p>`}`;
}

function visitHistory(db, storeId) {
  const rows = [];
  for (const [date, day] of Object.entries(db.days)) {
    for (const stop of day.stops || []) {
      if (stop.storeId === storeId && stop.visit) rows.push({ date, visit: stop.visit });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

function historyView(db) {
  const dates = Object.keys(db.days).sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return `<h1>Журнал</h1><p class="lede">Когда закроете первый день, он появится здесь.</p>`;
  return `<h1>Журнал</h1>
    ${dates.map((date) => {
      const day = db.days[date];
      const done = day.stops.filter((stop) => stop.status === "done").length;
      const defects = day.stops.reduce((sum, stop) => sum + (Number(stop.visit?.defectQty) || 0), 0);
      return `<button class="day-row" type="button" data-action="open-day" data-date="${date}">
        <div class="split"><strong>${esc(prettyDate(date))}</strong><span>${day.status === "done" ? "закрыт" : "в работе"}</span></div>
        <div class="meta">${done} из ${day.stops.length} · брак ${defects} шт${day.track?.meters > 0 ? ` · пробег ${formatKm(day.track.meters)}` : ""}</div>
      </button>`;
    }).join("")}`;
}

function dayView(state, db) {
  const day = db.days[state.date];
  if (!day) return `<p>День не найден.</p>`;
  return `<button class="back-btn" type="button" data-action="go" data-view="history">← Журнал</button>
    <h1 style="margin-top:8px">${esc(prettyDate(state.date))}</h1>
    <p class="lede">${day.status === "done" ? "День закрыт." : "День ещё открыт."}${day.track?.meters > 0 ? ` Пробег ${formatKm(day.track.meters)}.` : ""}</p>
    ${schemeBlock(day.stops)}
    ${day.stops.map((stop, index) => stopCard(stop, index, state.date, { locked: true })).join("")}
    <button class="btn ghost wide" type="button" data-action="ask-reset-day" data-date="${state.date}" style="margin-top:16px">Сбросить этот день</button>`;
}

function settingsView(db) {
  const options = [`<option value="">Центр Минска</option>`]
    .concat(STORES.map((store) => `<option value="${store.id}" ${db.settings.startStoreId === store.id ? "selected" : ""}>${esc(store.chain)} · ${esc(storeLine(store))}</option>`))
    .join("");
  return `<h1>Настройки</h1>
    <p class="lede">Уже начатый день не перестраивается. Новые цифры попадут в следующий маршрут.</p>
    <div class="field">
      <div class="label">Точек в обычный день: ${db.settings.maxStops}</div>
      <div class="stepper">
        <button class="mini" type="button" data-action="setting-step" data-field="maxStops" data-dir="-1">−</button>
        <input readonly value="${db.settings.maxStops}">
        <button class="mini" type="button" data-action="setting-step" data-field="maxStops" data-dir="1">+</button>
      </div>
      <p class="hint">Брак, поставка и точки «через день» остаются в маршруте даже сверх лимита.</p>
    </div>
    <div class="field">
      <div class="label">Мало на складе, если меньше: ${db.settings.lowStock} шт</div>
      <div class="stepper">
        <button class="mini" type="button" data-action="setting-step" data-field="lowStock" data-dir="-1">−</button>
        <input readonly value="${db.settings.lowStock}">
        <button class="mini" type="button" data-action="setting-step" data-field="lowStock" data-dir="1">+</button>
      </div>
    </div>
    <div class="field">
      <label for="start">Откуда выезжаю</label>
      <select id="start" data-setting="startStoreId">${options}</select>
      <p class="hint">От этой точки считается порядок. В Яндексе старт всё равно ваше текущее место.</p>
    </div>
    <h2 class="section-title">Как строится маршрут</h2>
    <ol class="rules">
      <li>Дата большого брака — точка идёт первой.</li>
      <li>9-й км и Партизанский 106 ездим через день. Если вчера там уже были, сегодня их нет. Брак и поставка всё равно ставят точку в маршрут.</li>
      <li>Утренний список поставки — на следующий день эти магазины обязательные, товар нужно выставить.</li>
      <li>Пустая полка и ноль на складе поднимают точку. Малый остаток занимает только часть дня.</li>
      <li>Остальные места — магазины, где ещё не были или давно не заезжали.</li>
      <li>Внутри группы порядок собран так, чтобы меньше петлять по городу.</li>
    </ol>
    <h2 class="section-title">Сброс по дням</h2>
    <p class="lede">День возвращается к пустому: маршрут, отметки на точках и список поставки за эту дату исчезают. Остальные дни остаются. Число точек, порог склада и старт не меняются.</p>
    ${resetList(db)}
    <h2 class="section-title">Проверка</h2>
    <p class="lede">Выключить день — проверка без следа. Маршрут снова станет планом, отметки после «Начать работу» снимутся. Утренний список поставки при этом останется.</p>
    <button class="btn ghost wide" type="button" data-action="ask-cancel-day" ${db.days[todayISO()] ? "" : "disabled"}>Выключить сегодняшний день</button>
    ${db.days[todayISO()] ? "" : `<p class="hint">Сейчас рабочий день не включён.</p>`}
    <h2 class="section-title">Память телефона</h2>
    <p class="lede">Отметки, фото магазинов и схемы прохода хранятся в этом браузере. Склад и CRM сюда не подключены. Перед чисткой скачайте копию — в неё попадут и схемы.</p>
    <div class="stack">
      <button class="btn secondary wide" type="button" data-action="export">Скачать копию</button>
      <label class="btn ghost wide">Восстановить из файла<input class="sr-only" type="file" accept="application/json" data-import></label>
      <button class="btn ghost wide" type="button" data-action="ask-reset">Стереть всё на этом телефоне</button>
    </div>`;
}

function deliveryCard(db, today) {
  const ids = db.deliveries?.[today] || [];
  const names = ids.map((id) => storeById(id)).filter(Boolean);
  const list = names.length
    ? `<div class="chips">${names.map((store) => `<span class="chip warn">${esc(store.chain)} · ${esc(store.address)}</span>`).join("")}</div>`
    : `<p class="hint">Пока пусто. Отмеченные магазины попадут в маршрут завтра — выставить товар.</p>`;
  return `<section class="card">
    <div class="split"><strong>Поставка сегодня</strong><span class="meta">${ids.length}</span></div>
    ${list}
    <button class="btn secondary wide" type="button" data-action="open-deliveries" style="margin-top:10px">Отметить магазины</button>
  </section>`;
}

function deliveryView(db) {
  const today = todayISO();
  const selected = new Set(db.deliveries?.[today] || []);
  return `<button class="back-btn" type="button" data-action="close-deliveries">← Ко дню</button>
    <h1 style="margin-top:8px">Поставка сегодня</h1>
    <p class="lede">Нажмите магазин, чтобы отметить. Завтра эти точки будут обязательными: приехать и выставить товар. Сейчас в списке: ${selected.size}.</p>
    ${STORES.map((store) => {
      const on = selected.has(store.id);
      return `<button class="store-row" type="button" data-action="toggle-delivery" data-id="${store.id}" aria-pressed="${on}">
        <div class="split"><div class="brand" data-chain="${esc(store.chain)}">${esc(store.chain)}</div><strong>${on ? "В списке" : ""}</strong></div>
        <div>${esc(storeLine(store))}</div>
      </button>`;
    }).join("")}
    <div class="dock"><button class="btn primary wide" type="button" data-action="close-deliveries">Готово · ${selected.size}</button></div>`;
}

function resetDates(db) {
  const dates = new Set([
    ...Object.keys(db.days || {}),
    ...Object.entries(db.deliveries || {}).filter(([, ids]) => Array.isArray(ids) && ids.length).map(([date]) => date),
  ]);
  return [...dates].sort((a, b) => b.localeCompare(a));
}

function resetList(db) {
  const dates = resetDates(db);
  if (dates.length === 0) return `<p class="hint">Пока нет дней, которые можно сбросить.</p>`;
  return `${dates.map((date) => {
    const day = db.days[date];
    const deliveries = (db.deliveries?.[date] || []).length;
    const bits = [];
    if (day) bits.push(day.status === "done" ? "день закрыт" : "день в работе");
    else bits.push("маршрут не начинали");
    if (deliveries) bits.push(`поставка: ${deliveries}`);
    const done = day ? day.stops.filter((stop) => stop.status === "done").length : 0;
    if (day) bits.push(`отметки: ${done}`);
    return `<div class="store-row">
      <div class="split"><strong>${esc(prettyDate(date))}</strong>
        <button class="text-btn" type="button" data-action="ask-reset-day" data-date="${date}">Сбросить</button>
      </div>
      <div class="meta">${esc(bits.join(" · "))}</div>
    </div>`;
  }).join("")}
    <button class="btn ghost wide" type="button" data-action="ask-reset-days" style="margin-top:12px">Сбросить все дни</button>`;
}

function overlayHtml(state, db) {
  const sheets = pickerHtml(state, db) + confirmHtml(state);
  if (!sheets) return "";
  return `<div class="backdrop" data-action="close-overlay"></div>${sheets}`;
}

function pickerHtml(state, db) {
  if (!state.pickerDate) return "";
  const plan = db.days[state.pickerDate] || planDay(state.pickerDate, db);
  const taken = new Set((plan.stops || []).filter((stop) => stop.status !== "skipped").map((stop) => stop.storeId));
  const stores = STORES.filter((store) => !taken.has(store.id));
  return `<section class="sheet">
    <h2>Добавить точку</h2>
    <div class="picker-list">
      ${stores.map((store) => `<button class="store-row" type="button" data-action="pin" data-date="${state.pickerDate}" data-id="${store.id}"><div class="brand" data-chain="${esc(store.chain)}">${esc(store.chain)}</div><div>${esc(storeLine(store))}</div></button>`).join("")}
    </div>
    <button class="btn ghost wide" style="margin-top:8px" type="button" data-action="close-picker">Закрыть</button>
  </section>`;
}

function confirmHtml(state) {
  if (!state.confirm) return "";
  return `<section class="sheet">
    <h2>${esc(state.confirm.title)}</h2>
    <p class="lede">${esc(state.confirm.text)}</p>
    <div class="dock">
      <button class="btn primary wide" type="button" data-action="${esc(state.confirm.action)}">${esc(state.confirm.confirm)}</button>
      <button class="btn ghost wide" type="button" data-action="close-confirm">Оставить как есть</button>
    </div>
  </section>`;
}

function sideHtml(state, db, today) {
  const date = state.view === "tomorrow" ? addDays(today, 1) : state.date || today;
  const day = db.days[date];
  const plan = day || planDay(date, db);
  if (["today", "tomorrow", "visit", "day"].includes(state.view) && plan.stops?.length) {
    return `<h2>Карта</h2>${schemeBlock(plan.stops)}<ol class="rules"><li>Красный номер — брак, ехать первым.</li><li>Жёлтый — поставка или мало товара.</li><li>Зелёный — обычный контроль.</li></ol>`;
  }
  return `<h2>Правила</h2><ol class="rules"><li>Брак в указанный день — первая точка.</li><li>Список поставки с утра — выкладка на следующий день.</li><li>9-й км и Партизанский 106 — через день.</li><li>Дальше остатки и магазины, где давно не были.</li><li>Ссылка Яндекса начинается от вашего места.</li></ol>`;
}

export function render(state, db) {
  const today = todayISO();
  const main = {
    today: () => todayView(state, db, today),
    tomorrow: () => tomorrowView(db, today),
    visit: () => visitView(state, db),
    deliveries: () => deliveryView(db),
    stores: () => storesView(state, db),
    store: () => storeView(state, db),
    history: () => historyView(db),
    day: () => dayView(state, db),
    settings: () => settingsView(db),
  }[state.view] || (() => todayView(state, db, today));

  const keptMap = document.querySelector("iframe.route-map");
  if (keptMap) keptMap.remove();
  document.getElementById("main").innerHTML = main();
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.innerHTML = overlayHtml(state, db);
  document.getElementById("side").innerHTML = sideHtml(state, db, today);
  mountRouteMap(keptMap);
  document.getElementById("rail").innerHTML = rail(state);
  document.getElementById("tabbar").innerHTML = tabs(state);
  document.body.dataset.view = state.view;
}

function mountRouteMap(kept) {
  const slots = [...document.querySelectorAll(".map-slot")];
  if (slots.length === 0) return;
  const visible = slots.find((slot) => slot.getClientRects().length > 0) || slots[0];
  const url = visible.dataset.src;
  if (!url) return;
  const frame = kept || document.createElement("iframe");
  frame.className = "route-map";
  frame.title = "Карта маршрута";
  frame.loading = "eager";
  if (frame.dataset.src !== url) {
    frame.dataset.src = url;
    frame.src = url;
  }
  visible.replaceChildren(frame);
}

function navCurrent(state) {
  return state.view === "deliveries" ? "today" : state.view;
}

function tabs(state) {
  const items = [["today", "Сегодня"], ["tomorrow", "Завтра"], ["stores", "Точки"], ["history", "Журнал"]];
  const current = navCurrent(state);
  return items.map(([view, label]) => `<button type="button" data-action="go" data-view="${view}" ${current === view ? 'aria-current="page"' : ""}>${label}</button>`).join("");
}

function rail(state) {
  const items = [["today", "Сегодня"], ["tomorrow", "Завтра"], ["stores", "Точки"], ["history", "Журнал"], ["settings", "Настройки"]];
  const current = navCurrent(state);
  return `<p class="logo">merch</p>${items.map(([view, label]) => `<button type="button" data-action="go" data-view="${view}" ${current === view ? 'aria-current="page"' : ""}>${label}</button>`).join("")}`;
}
