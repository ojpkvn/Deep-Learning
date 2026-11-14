(function () {
  const $ = (id) => document.getElementById(id);
  const D = Nutrition.DISHES, P = Nutrition.PORTIONS;
  const MAX_SIDE = 2048;        // larger photos are shrunk first (the notebook's largest training photo was 2048 px)
  const LOW_CONFIDENCE = 0.6;
  let model = null, busy = false;

  // current suggestion
  let sel = { dish: null, portion: 'regular', topP: 0 };
  let viewDay = Log.dayKey(new Date());

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('en-US');

  /* ---------- status + model ---------- */
  function setStatus(text, kind) {
    $('statusText').textContent = text;
    $('status').className = 'status' + (kind ? ' ' + kind : '');
  }
  async function initBackend() {
    try { await tf.setBackend('webgl'); await tf.ready(); }
    catch (e) { await tf.setBackend('cpu'); await tf.ready(); }
  }
  async function offlineReady() {
    try { return !!(await caches.match('model.json')); } catch (e) { return false; }
  }
  async function resetAppData() {
    setStatus('Resetting saved app files…');
    try {
      if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach((r) => r.unregister());
      if (window.caches) (await caches.keys()).forEach((k) => caches.delete(k));
    } catch (e) { console.warn(e); }
    location.reload();
  }
  async function start() {
    setStatus('Loading model…');
    let lastErr = null;
    // Try the fast graphics engine first; if loading or the first run fails (it can on some iPhones when the
    // app is opened from the Home Screen), try again on the plain CPU engine.
    for (const backend of ['webgl', 'cpu']) {
      try {
        try { await tf.setBackend(backend); await tf.ready(); }
        catch (e) { if (backend === 'cpu') throw e; continue; }
        model = await Classifier.loadModel('model.json');
        $('btnCamera').disabled = false; $('btnLibrary').disabled = false;
        setStatus((await offlineReady()) ? 'Ready · works offline' : 'Ready · saving for offline use…', 'ready');
        if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(async () => {
          setTimeout(async () => { if (await offlineReady()) setStatus('Ready · works offline', 'ready'); }, 4000);
        });
        return;
      } catch (e) { console.error(backend, e); lastErr = e; }
    }
    let raw = String((lastErr && lastErr.message) || lastErr || 'unknown error');
    // Check each model file's size on the website against the correct size and name the bad one.
    if (!/404/.test(raw)) {
      const EXPECTED = { 'group1-shard1of4.bin': 4194304, 'group1-shard2of4.bin': 4194304, 'group1-shard3of4.bin': 4194304, 'group1-shard4of4.bin': 3420296 };
      const bad = [];
      for (const f of Object.keys(EXPECTED)) {
        try {
          const r = await fetch(f + '?check=' + Date.now(), { cache: 'reload' });
          const n = r.ok ? (await r.arrayBuffer()).byteLength : 'HTTP ' + r.status;
          if (n !== EXPECTED[f]) bad.push(f + ' is ' + n + ' bytes (should be ' + EXPECTED[f] + ')');
        } catch (e) { bad.push(f + ' could not be fetched'); }
      }
      if (bad.length) raw = 'bad file on the website: ' + bad.join('; ') + '. Re-upload it';
      else raw = raw + ' (files on the site look correct, so try Reset)';
    }
    const why = /404/.test(raw)
      ? 'model.json or a .bin file is missing from the website'
      : raw.slice(0, 400);
    setStatus('Could not load the model (' + why + '). Tap here to reset and reload.', 'error');
    $('status').style.cursor = 'pointer';
    $('status').addEventListener('click', resetAppData, { once: true });
  }

  /* ---------- photo -> prediction ---------- */
  async function fileToPixels(file) {
    const url = URL.createObjectURL(file);
    const img = new Image(); img.src = url; await img.decode();
    $('preview').src = url; $('preview').style.display = 'block'; $('empty').style.display = 'none';
    const w = img.naturalWidth, h = img.naturalHeight, big = Math.max(w, h);
    if (big > MAX_SIDE) {
      const s = MAX_SIDE / big, c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, c.width, c.height);
      return tf.browser.fromPixels(c);
    }
    return tf.browser.fromPixels(img);
  }

  function renderResult(results) {
    const top = results[0];
    $('topName').textContent = D[top.name].label;
    $('topPct').textContent = (top.p * 100).toFixed(0) + '%';
    $('hint').textContent = top.p < LOW_CONFIDENCE
      ? 'Not very sure. Check the dish below, or try a closer, well-lit, top-down photo.' : '';
    $('bars').innerHTML = results.map((r) =>
      `<div class="row"><span>${D[r.name].label}</span><div class="track"><div class="fill" data-w="${(r.p * 100).toFixed(1)}"></div></div><span class="val">${(r.p * 100).toFixed(0)}%</span></div>`
    ).join('');
    $('result').style.display = 'block';
    requestAnimationFrame(() => document.querySelectorAll('#bars .fill').forEach((el) => { el.style.width = el.dataset.w + '%'; }));
  }

  async function classify(file) {
    if (!file || busy || !model) return;
    busy = true; $('btnCamera').disabled = true; $('btnLibrary').disabled = true;
    const prev = $('statusText').textContent; setStatus('Analysing…');
    let pixels;
    try {
      pixels = await fileToPixels(file);
      let results = await Classifier.predict(model, pixels);
      const bad = results.some((r) => !isFinite(r.p)) || Math.abs(results.reduce((a, r) => a + r.p, 0) - 1) > 0.05;
      if (bad && tf.getBackend() !== 'cpu') {
        await tf.setBackend('cpu'); await tf.ready();
        results = await Classifier.predict(model, pixels);
      }
      renderResult(results);
      suggest(results);
    } catch (e) {
      console.error(e);
      $('result').style.display = 'none'; $('entry').style.display = 'none'; $('hint').textContent = '';
      alert('Sorry, that photo could not be read. Try a JPG or PNG.');
    } finally {
      if (pixels) pixels.dispose();
      busy = false; $('btnCamera').disabled = false; $('btnLibrary').disabled = false; setStatus(prev, 'ready');
    }
  }

  /* ---------- suggested log entry ---------- */
  function suggest(results) {
    sel = { dish: results[0].name, portion: 'regular', topP: results[0].p };
    // dish chips in model-ranked order, so the likeliest alternatives come first
    $('dishChips').innerHTML = results.map((r) =>
      `<button class="chip" data-dish="${r.name}" aria-pressed="false">${D[r.name].label}</button>`).join('');
    $('portionChips').innerHTML = P.map((p) =>
      `<button class="chip" data-portion="${p.id}" aria-pressed="false">${p.label}</button>`).join('');
    $('fMeal').value = Nutrition.mealForHour(new Date().getHours());
    $('entry').style.display = 'block';
    applyEstimate();
  }

  function applyEstimate() {
    document.querySelectorAll('#dishChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dish === sel.dish)));
    document.querySelectorAll('#portionChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.portion === sel.portion)));
    const est = Nutrition.estimate(sel.dish, sel.portion);
    $('fKcal').value = est.kcal; $('fSodium').value = est.sodium;
    const d = D[sel.dish];
    $('entryNote').textContent = 'Regular portion = ' + d.serving + '. ' + d.note + ' You can edit the numbers above.';
    updateShare();
  }

  function updateShare() {
    const t = Log.targets(), s = Number($('fSodium').value) || 0, k = Number($('fKcal').value) || 0;
    const sPct = Math.round((s / t.sodium) * 100), kPct = Math.round((k / t.kcal) * 100);
    const el = $('share');
    el.textContent = `This is ${sPct}% of your daily sodium target and ${kPct}% of your calorie target.`;
    el.className = 'share' + (sPct >= 100 ? ' over' : '');
  }

  $('dishChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dish]'); if (!b) return; sel.dish = b.dataset.dish; applyEstimate();
  });
  $('portionChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-portion]'); if (!b) return; sel.portion = b.dataset.portion; applyEstimate();
  });
  ['fKcal', 'fSodium'].forEach((id) => $(id).addEventListener('input', updateShare));

  $('addBtn').addEventListener('click', () => {
    if (!sel.dish) return;
    Log.add({ dish: sel.dish, portion: sel.portion, meal: $('fMeal').value, kcal: $('fKcal').value, sodium: $('fSodium').value });
    viewDay = Log.dayKey(new Date());
    showTab('log');
    // reset the scan screen so the same photo is not logged twice by accident
    $('entry').style.display = 'none'; $('result').style.display = 'none'; $('preview').style.display = 'none';
    $('empty').style.display = 'block'; $('hint').textContent = ''; sel.dish = null;
  });

  /* ---------- log tab ---------- */
  function meter(label, value, target, unit) {
    const pct = target > 0 ? (value / target) * 100 : 0;
    return `<div class="meter"><div class="head"><b>${label}</b><span>${fmt(value)} / ${fmt(target)} ${unit} · ${Math.round(pct)}%</span></div>` +
      `<div class="track"><div class="fill${pct >= 100 ? ' over' : ''}" style="width:${Math.min(100, pct).toFixed(1)}%"></div></div></div>`;
  }

  function dayTitle(key) {
    const today = Log.dayKey(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (key === today) return 'Today';
    if (key === Log.dayKey(y)) return 'Yesterday';
    const [yy, mm, dd] = key.split('-').map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function renderLog() {
    const t = Log.targets(), tot = Log.totals(viewDay), list = Log.forDay(viewDay);
    $('dayLabel').textContent = dayTitle(viewDay);
    $('nextDay').disabled = viewDay >= Log.dayKey(new Date());
    $('meters').innerHTML = meter('Calories', tot.kcal, t.kcal, 'kcal') + meter('Sodium', tot.sodium, t.sodium, 'mg');
    $('items').innerHTML = list.length ? list.map((e) => {
      const time = new Date(e.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const p = (P.find((x) => x.id === e.portion) || {}).label || e.portion;
      return `<div class="item"><span class="t">${esc((D[e.dish] || { label: e.dish }).label)} · ${esc(p)}</span>` +
        `<button class="del" data-id="${esc(e.id)}" aria-label="Delete entry">✕</button>` +
        `<span class="m">${esc(e.meal)} · ${esc(time)} · ${fmt(e.kcal)} kcal · ${fmt(e.sodium)} mg sodium</span></div>`;
    }).join('') : '<div class="empty">Nothing logged for this day.</div>';
    $('tKcal').value = t.kcal; $('tSodium').value = t.sodium;
    $('storageWarn').hidden = Log.persistent;
    updateBadge();
  }

  function updateBadge() {
    const n = Log.forDay(Log.dayKey(new Date())).length;
    $('badge').textContent = n; $('badge').hidden = n === 0;
  }

  $('items').addEventListener('click', (e) => {
    const b = e.target.closest('.del'); if (!b) return;
    if (confirm('Delete this entry?')) { Log.remove(b.dataset.id); renderLog(); }
  });
  function shiftDay(delta) {
    const [y, m, d] = viewDay.split('-').map(Number), dt = new Date(y, m - 1, d + delta);
    const k = Log.dayKey(dt); if (k > Log.dayKey(new Date())) return; viewDay = k; renderLog();
  }
  $('prevDay').addEventListener('click', () => shiftDay(-1));
  $('nextDay').addEventListener('click', () => shiftDay(1));

  ['tKcal', 'tSodium'].forEach((id) => $(id).addEventListener('change', () => {
    Log.setTargets({ kcal: $('tKcal').value, sodium: $('tSodium').value }); renderLog(); updateShare();
  }));

  $('exportBtn').addEventListener('click', async () => {
    if (!Log.entries().length) { alert('Nothing to export yet.'); return; }
    const csv = Log.toCSV((k) => (D[k] || { label: k }).label);
    const file = new File([csv], 'noodle-log.csv', { type: 'text/csv' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Noodle log' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = 'noodle-log.csv';
    document.body.appendChild(a); a.click(); a.remove();
  });

  /* ---------- tabs + wiring ---------- */
  function showTab(name) {
    const log = name === 'log';
    $('viewScan').hidden = log; $('viewLog').hidden = !log;
    $('tabScan').setAttribute('aria-selected', String(!log)); $('tabLog').setAttribute('aria-selected', String(log));
    if (log) renderLog();
    window.scrollTo(0, 0);
  }
  $('tabScan').addEventListener('click', () => showTab('scan'));
  $('tabLog').addEventListener('click', () => { viewDay = Log.dayKey(new Date()); showTab('log'); });

  $('btnCamera').addEventListener('click', () => $('inCamera').click());
  $('btnLibrary').addEventListener('click', () => $('inLibrary').click());
  ['inCamera', 'inLibrary'].forEach((id) => $(id).addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; classify(f);
  }));

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e));
  updateBadge();
  start();
})();
