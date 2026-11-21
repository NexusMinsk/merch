/** Помощник БИВЕР. Светлана — человек и руководитель. Этот модуль только чат и действия в программе. */

import { findStores, planDay, scopeStores, storeById, storeLine, todayISO } from "./model.js";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_stores",
      description: "Список магазинов, за кем закреплены, и последняя отметка.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_people",
      description: "Люди: руководитель и мерчендайзеры.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "add_person",
      description: "Добавить человека. role=lead только для руководителя, role=merch для мерчендайзера.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string", enum: ["lead", "merch"] },
        },
        required: ["name", "role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_store",
      description: "Закрепить магазин за мерчендайзером. store — адрес или сеть и адрес, person — имя.",
      parameters: {
        type: "object",
        properties: {
          store: { type: "string" },
          person: { type: "string" },
        },
        required: ["store", "person"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_deliveries",
      description: "Записать поставку на дату. Эти магазины станут обязательными на следующий день у того, за кем закреплены. mode=replace если продиктован полный утренний список, mode=add если дополнение.",
      parameters: {
        type: "object",
        properties: {
          stores: { type: "array", items: { type: "string" } },
          date: { type: "string", description: "ГГГГ-ММ-ДД, по умолчанию сегодня" },
          mode: { type: "string", enum: ["add", "replace"] },
        },
        required: ["stores"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_max_stops",
      description: "Сколько точек в обычный день у мерча, от 4 до 12.",
      parameters: {
        type: "object",
        properties: { count: { type: "number" } },
        required: ["count"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan",
      description: "Показать, какой маршрут получится у человека на дату.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string" },
          date: { type: "string" },
        },
      },
    },
  },
];

function norm(value) {
  return String(value || "").trim().toLowerCase().replaceAll("ё", "е");
}

function people(db) {
  return Array.isArray(db.people) ? db.people : [];
}

function findPeople(db, query) {
  const q = norm(query);
  if (!q) return [];
  return people(db).filter((person) => {
    const name = norm(person.name);
    return name.includes(q) || q.includes(name);
  });
}

function personName(db, id) {
  return people(db).find((person) => person.id === id)?.name || "";
}

function slug(name) {
  const base = norm(name).replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 24);
  return base || "person";
}

function oneStore(query) {
  const found = findStores(query);
  if (found.length === 1) return { store: found[0] };
  if (found.length === 0) return { error: `Магазин не найден: ${query}` };
  return { error: `Несколько магазинов под «${query}»: ${found.map((store) => storeLine(store)).join(", ")}` };
}

function onePerson(db, query) {
  const found = findPeople(db, query);
  if (found.length === 1) return { person: found[0] };
  if (found.length === 0) return { error: `Человек не найден: ${query}` };
  return { error: `Несколько людей под «${query}»: ${found.map((person) => person.name).join(", ")}` };
}

export function applyTool(db, name, args, today) {
  const input = args && typeof args === "object" ? args : {};
  if (name === "list_stores") {
    const lines = scopeStores(db).map((store) => {
      const owner = personName(db, db.owners?.[store.id]);
      const signal = db.signals?.[store.id];
      const visit = signal?.lastVisitDate ? `визит ${signal.lastVisitDate}` : "визитов нет";
      return `${store.chain}, ${storeLine(store)} — ${owner || "не закреплён"}, ${visit}`;
    });
    return lines.join("\n");
  }
  if (name === "list_people") {
    if (!people(db).length) return "Людей пока нет.";
    return people(db).map((person) => `${person.name} — ${person.role === "lead" ? "руководитель" : "мерч"}`).join("\n");
  }
  if (name === "add_person") {
    const personNameRaw = String(input.name || "").trim();
    if (!personNameRaw) return "Нужно имя.";
    const role = input.role === "lead" ? "lead" : "merch";
    const existing = people(db).find((person) => norm(person.name) === norm(personNameRaw));
    if (existing) return `${existing.name} уже есть, роль: ${existing.role === "lead" ? "руководитель" : "мерч"}.`;
    let id = slug(personNameRaw);
    const taken = new Set(people(db).map((person) => person.id));
    while (taken.has(id)) id = `${id}-${taken.size + 1}`;
    db.people = people(db).concat([{ id, name: personNameRaw, role }]);
    return `Добавлен ${personNameRaw}, ${role === "lead" ? "руководитель" : "мерч"}.`;
  }
  if (name === "assign_store") {
    const storeHit = oneStore(input.store);
    if (storeHit.error) return storeHit.error;
    const personHit = onePerson(db, input.person);
    if (personHit.error) return personHit.error;
    if (!db.owners || typeof db.owners !== "object") db.owners = {};
    db.owners[storeHit.store.id] = personHit.person.id;
    return `${storeHit.store.chain}, ${storeLine(storeHit.store)} закреплён за ${personHit.person.name}.`;
  }
  if (name === "set_deliveries") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : today;
    const mode = input.mode === "replace" ? "replace" : "add";
    const ids = mode === "replace" ? [] : (Array.isArray(db.deliveries?.[date]) ? db.deliveries[date].slice() : []);
    const notes = [];
    for (const query of input.stores || []) {
      const hit = oneStore(query);
      if (hit.error) {
        notes.push(hit.error);
        continue;
      }
      if (!ids.includes(hit.store.id)) ids.push(hit.store.id);
      const owner = personName(db, db.owners?.[hit.store.id]);
      notes.push(`${hit.store.chain}, ${storeLine(hit.store)} — ${owner || "не закреплён, в чей-то маршрут само не встанет"}`);
    }
    if (!db.deliveries || typeof db.deliveries !== "object") db.deliveries = {};
    db.deliveries[date] = ids;
    return `Поставка ${date}, в маршрут на следующий день.\n${notes.join("\n")}`;
  }
  if (name === "set_max_stops") {
    const count = Math.min(12, Math.max(4, Math.round(Number(input.count) || 8)));
    db.settings.maxStops = count;
    return `В обычный день теперь ${count} точек. Брак, поставка и «через день» остаются даже сверх этого.`;
  }
  if (name === "plan") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : today;
    const copy = {
      ...db,
      settings: { ...db.settings },
    };
    if (input.person) {
      const hit = onePerson(db, input.person);
      if (hit.error) return hit.error;
      copy.settings = { ...db.settings, personId: hit.person.id };
    }
    const plan = planDay(date, copy);
    if (!plan.stops.length) return `На ${date} маршрут пустой.`;
    return plan.stops.map((stop, index) => {
      const known = storeById(stop.storeId);
      const label = known ? `${known.chain}, ${storeLine(known)}` : stop.storeId;
      return `${index + 1}. ${label} (${stop.reasons.join(", ")})`;
    }).join("\n");
  }
  return `Неизвестное действие: ${name}`;
}

function snapshot(db, today) {
  const team = people(db).map((person) => `${person.name} (${person.role === "lead" ? "руководитель" : "мерч"})`).join(", ") || "людей нет";
  const deliveries = (db.deliveries?.[today] || []).join(", ") || "пусто";
  return `Сегодня ${today}. Точек в обычный день: ${db.settings?.maxStops || 8}. Люди: ${team}. Поставка сегодня (идёт в маршрут завтра): ${deliveries}.`;
}

const SYSTEM = `Ты помощник мерчендайзинга пивоварни БИВЕР. БИВЕР варит живое непастеризованное пиво, компания с 1993 года, точки в Минске и рядом.
Светлана, если она есть в списке людей с ролью руководителя, — живой человек, начальник мерчендайзеров. Ты не Светлана и не мерч. Ты отдельный помощник: с тобой говорит и руководитель, и мерчендайзеры.
Говори по-русски, коротко, по делу. Не выдумывай продажи, остатки и визиты: бери их только из инструментов.
Утренний список поставки записывай на сегодня через set_deliveries с mode=replace, если продиктован весь список. В маршрут эти магазины попадут на следующий день, каждому мерчу — только его точки.
Если магазин не закреплён, так и скажи. Не назначай человека наугад.
Не обещай оформление заявок по продажам: этого в программе ещё нет.`;

async function complete(messages, auth) {
  const base = String(auth.apiBase || "").replace(/\/$/, "");
  const url = base ? `${base}/api/chat` : "https://openrouter.ai/api/v1/chat/completions";
  const headers = { "Content-Type": "application/json" };
  if (!base) {
    headers.Authorization = `Bearer ${auth.apiKey}`;
    headers["HTTP-Referer"] = "https://github.com/NexusMinsk/merch";
    headers["X-Title"] = "merch";
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      temperature: 0.3,
      messages,
      tools: TOOLS,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error || "Помощник не ответил";
    throw new Error(typeof message === "string" ? message : "Помощник не ответил");
  }
  return data.choices?.[0]?.message;
}

export async function askBeaver(db, auth) {
  if (!auth.apiBase && !auth.apiKey) {
    throw new Error("Нет связи с помощником. На телефоне руководителя укажите адрес сервера или ключ. Ключ в общую базу не кладётся.");
  }
  const today = auth.today || todayISO();
  const history = (db.chat || []).slice(-12).map((message) => ({ role: message.role, content: message.content }));
  const messages = [
    { role: "system", content: `${SYSTEM}\n\n${snapshot(db, today)}` },
    ...history,
  ];
  for (let step = 0; step < 4; step += 1) {
    const message = await complete(messages, auth);
    if (!message) throw new Error("Пустой ответ");
    const calls = message.tool_calls || [];
    if (!calls.length) return String(message.content || "").trim() || "Готово.";
    messages.push(message);
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      const content = applyTool(db, call.function?.name, args, today);
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  return "Сделал несколько шагов и остановился. Спросите ещё раз, если нужно продолжение.";
}
