/* Food log stored on the phone (localStorage). Nothing is sent anywhere.
 * If the browser blocks storage, the log still works until the page is closed (flag: Log.persistent). */
(function (root) {
  const KEY = 'noodleLog.v1', TKEY = 'noodleTargets.v1';
  const DEFAULT_TARGETS = { kcal: 2000, sodium: 2000 };   // 2,000 mg sodium/day is the common WHO / HPB guideline
  let persistent = true;
  let memEntries = null, memTargets = null;

  function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }
    catch (e) { persistent = false; return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { persistent = false; return false; }
  }

  function entries() {
    if (memEntries) return memEntries;
    const v = read(KEY);
    memEntries = Array.isArray(v) ? v.filter((e) => e && typeof e.ts === 'string') : [];
    return memEntries;
  }
  function save() { write(KEY, entries()); }

  function targets() {
    if (memTargets) return memTargets;
    const v = read(TKEY) || {};
    memTargets = {
      kcal: Number(v.kcal) > 0 ? Number(v.kcal) : DEFAULT_TARGETS.kcal,
      sodium: Number(v.sodium) > 0 ? Number(v.sodium) : DEFAULT_TARGETS.sodium
    };
    return memTargets;
  }
  function setTargets(t) {
    memTargets = {
      kcal: Number(t.kcal) > 0 ? Math.round(Number(t.kcal)) : DEFAULT_TARGETS.kcal,
      sodium: Number(t.sodium) > 0 ? Math.round(Number(t.sodium)) : DEFAULT_TARGETS.sodium
    };
    write(TKEY, memTargets);
    return memTargets;
  }

  const pad = (n) => String(n).padStart(2, '0');
  function dayKey(date) { const d = date instanceof Date ? date : new Date(date); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function add(e) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      dish: e.dish, portion: e.portion, meal: e.meal,
      kcal: Math.max(0, Math.round(Number(e.kcal) || 0)),
      sodium: Math.max(0, Math.round(Number(e.sodium) || 0))
    };
    entries().push(entry); save();
    return entry;
  }
  function remove(id) {
    memEntries = entries().filter((e) => e.id !== id); save();
  }
  function forDay(key) {
    return entries().filter((e) => dayKey(e.ts) === key).sort((a, b) => a.ts.localeCompare(b.ts));
  }
  function totals(key) {
    return forDay(key).reduce((t, e) => ({ kcal: t.kcal + e.kcal, sodium: t.sodium + e.sodium }), { kcal: 0, sodium: 0 });
  }

  function toCSV(label) {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [['date', 'time', 'meal', 'dish', 'portion', 'kcal', 'sodium_mg'].join(',')];
    entries().slice().sort((a, b) => a.ts.localeCompare(b.ts)).forEach((e) => {
      const d = new Date(e.ts);
      rows.push([dayKey(d), pad(d.getHours()) + ':' + pad(d.getMinutes()), q(e.meal), q(label(e.dish)), q(e.portion), e.kcal, e.sodium].join(','));
    });
    return rows.join('\n');
  }

  root.Log = {
    DEFAULT_TARGETS, entries, add, remove, forDay, totals, targets, setTargets, dayKey, toCSV,
    get persistent() { return persistent; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
