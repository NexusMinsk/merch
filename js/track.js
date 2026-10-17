/** Пробег рабочего дня по GPS. Точки не копим — только километраж и последняя позиция. */

const MIN_MOVE_M = 25;
const MAX_ACCURACY_M = 80;
const MAX_SPEED_MPS = 42;

let watchId = null;
let active = null;

export function formatKm(meters) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  const text = km < 100 ? km.toFixed(1).replace(".", ",") : String(Math.round(km));
  return `${text} км`;
}

export function ensureTrack(day) {
  if (!day.track || typeof day.track !== "object") {
    day.track = { meters: 0, last: null, denied: false };
  }
  if (!Number.isFinite(day.track.meters) || day.track.meters < 0) day.track.meters = 0;
  day.track.denied = Boolean(day.track.denied);
  return day.track;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function recordFix(track, pos) {
  const point = {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: Number(pos.coords.accuracy) || 0,
    at: Number.isFinite(pos.timestamp) ? pos.timestamp : Date.now(),
  };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return false;
  if (point.accuracy > MAX_ACCURACY_M) return false;
  const last = track.last;
  if (!last) {
    track.last = point;
    return true;
  }
  const meters = distanceMeters(last, point);
  const elapsed = point.at - last.at;
  if (elapsed > 20 * 60 * 1000) {
    track.last = point;
    return true;
  }
  const seconds = Math.max(1, elapsed / 1000);
  const floor = Math.max(MIN_MOVE_M, point.accuracy * 1.2);
  if (meters < floor) return false;
  if (meters / seconds > MAX_SPEED_MPS) return false;
  track.meters = Math.round(track.meters + meters);
  track.last = point;
  return true;
}

function onPosition(pos) {
  if (!active) return;
  if (!recordFix(active.track, pos)) return;
  active.onChange?.(active.track);
}

function onError(error) {
  if (!active || error?.code !== 1) return;
  const { track, onDenied } = active;
  track.denied = true;
  stopWatch();
  onDenied?.();
}

export function stopWatch() {
  if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  active = null;
}

export function watchDay(day, date, hooks = {}, { force = false } = {}) {
  const track = ensureTrack(day);
  if (track.denied && !force) {
    if (active?.date === date) stopWatch();
    return;
  }
  if (active?.date === date && watchId != null && !force) {
    active.day = day;
    active.track = track;
    active.onChange = hooks.onChange;
    active.onDenied = hooks.onDenied;
    return;
  }
  stopWatch();
  if (!navigator.geolocation) {
    track.denied = true;
    hooks.onDenied?.();
    return;
  }
  if (force) track.denied = false;
  active = { day, date, track, onChange: hooks.onChange, onDenied: hooks.onDenied };
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 4000,
    timeout: 20000,
  });
}
