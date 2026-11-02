/* Stek: the page. Fishing logic lives in engine.js, fishing knowledge in data.js. */
(function () {
  'use strict';
  const D = window.StekData, E = window.StekEngine;
  const HOUR = E.HOUR, DAY = E.DAY;
  const LAT = D.CENTER.lat, LON = D.CENTER.lon, TZ = 'Europe%2FAmsterdam';
  const API = 'https://api.open-meteo.com/v1/forecast';
  const CUR = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m';
  const HRLY = 'temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,uv_index,shortwave_radiation';
  const URLS = {
    forecast: `${API}?latitude=${LAT}&longitude=${LON}&current=${CUR}&hourly=${HRLY}&daily=sunrise,sunset&past_days=3&forecast_days=4&timezone=${TZ}`,
    history: `${API}?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_mean&past_days=60&forecast_days=4&timezone=${TZ}`,
    marine: `https://marine-api.open-meteo.com/v1/marine?latitude=53.45&longitude=6.9&current=sea_surface_temperature&timezone=${TZ}`
  };
  const LINKS = { visplanner: 'https://visplanner.nl', waterinfo: 'https://waterinfo.rws.nl', sportvisunie: 'https://www.sportvisunie.nl/nl' };

  const state = {
    tab: 'today', weather: null, error: null, loading: false, t: null,
    settings: { permit: 'full', theme: 'auto', origin: null }, measure: null,
    records: [], userSpots: [], checked: {}, spotSpecies: null, backupAt: 0, installDismissed: false,
    photoUrls: new Map(), lastHour: null
  };
  let deferredInstall = null, map = null, mapLayer = null;

  /* ---------- Small helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const weekday = (t) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short' });
  const dayLabel = (t) => {
    const k = E.dateKey(t), now = Date.now();
    if (k === E.dateKey(now)) return 'Today';
    if (k === E.dateKey(now + DAY)) return 'Tomorrow';
    if (k === E.dateKey(now - DAY)) return 'Yesterday';
    return new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const round = (x, d = 0) => { if (x === null || x === undefined || isNaN(x)) return '-'; const m = 10 ** d; return (Math.round(x * m) / m).toFixed(d); };
  const signed = (x, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + round(Math.abs(x), d);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const toLocalInput = (t) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const weight = (g) => (g >= 1000 ? round(g / 1000, 2) + ' kg' : Math.round(g) + ' g');
  const windowText = (w) => {
    const same = E.dateKey(w.from) === E.dateKey(w.to);
    return `${dayLabel(w.from)} ${clock(w.from)} to ${same ? '' : dayLabel(w.to) + ' '}${clock(w.to)}`;
  };
  const allSpots = () => state.userSpots.concat(D.SPOTS);
  const spotById = (id) => allSpots().find((s) => s.id === id);
  const origin = () => state.settings.origin || D.CENTER;
  const routeUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=bicycling`;
  const NEEDLE = () => (state.t === null ? Date.now() : state.t);

  /* ---------- Device storage ---------- */
  const store = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('stek', 1);
      r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('records', { keyPath: 'id' }); db.createObjectStore('photos'); db.createObjectStore('kv'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (name, mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction(name, mode), s = t.objectStore(name), q = fn(s);
        t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    };
    return {
      all: (n) => tx(n, 'readonly', (s) => s.getAll()),
      get: (n, k) => tx(n, 'readonly', (s) => s.get(k)),
      put: (n, v, k) => tx(n, 'readwrite', (s) => (k === undefined ? s.put(v) : s.put(v, k))),
      del: (n, k) => tx(n, 'readwrite', (s) => s.delete(k))
    };
  })();
  const saveKV = (k, v) => store.put('kv', v, k).catch(() => {});

  async function loadAll() {
    try {
      state.records = await store.all('records');
      const [settings, measure, spots, checked, cached, backupAt, dismissed] = await Promise.all(['settings', 'measure', 'userSpots', 'checked', 'weather', 'backupAt', 'installDismissed'].map((k) => store.get('kv', k)));
      if (settings) Object.assign(state.settings, settings);
      state.measure = measure || null; state.userSpots = spots || []; state.checked = checked || {};
      state.backupAt = backupAt || 0; state.installDismissed = !!dismissed;
      if (cached && cached.hourly) state.weather = cached;
    } catch (e) { state.storageError = true; }
    applyTheme();
  }
  function applyTheme() {
    const r = document.documentElement;
    if (state.settings.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', state.settings.theme);
  }

  /* ---------- Weather ---------- */
  async function getJSON(url) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('Weather service answered ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  async function refresh(manual) {
    if (state.loading) return;
    state.loading = true; state.error = null; paintStatus();
    $('[data-act="refresh"]').classList.add('spin');
    try {
      const [fc, hist, marine] = await Promise.allSettled([getJSON(URLS.forecast), getJSON(URLS.history), getJSON(URLS.marine)]);
      if (fc.status !== 'fulfilled') throw fc.reason;
      const prev = state.weather;
      const w = E.parseWeather(fc.value, hist.status === 'fulfilled' ? hist.value : null, marine.status === 'fulfilled' ? marine.value : null);
      if (hist.status !== 'fulfilled' && prev) { w.dailyTimes = prev.dailyTimes; w.dailyMeans = prev.dailyMeans; }
      state.weather = w;
      saveKV('weather', w);
      if (manual) toast('Weather updated');
    } catch (e) {
      state.error = navigator.onLine === false ? 'You are offline' : 'Could not reach the weather service';
      if (manual) toast(state.error, state.weather ? 'Showing the last saved weather.' : 'Check your connection and try again.');
    }
    state.loading = false;
    $('[data-act="refresh"]').classList.remove('spin');
    render();
  }
  function paintStatus() {
    const el = $('#status'), w = state.weather;
    if (state.loading && !w) { el.textContent = 'Loading the weather'; return; }
    if (!w) { el.textContent = state.error || ''; return; }
    const age = Date.now() - w.fetchedAt;
    const stamp = (age < DAY ? '' : weekday(w.fetchedAt) + ' ') + clock(w.fetchedAt);
    el.textContent = state.error ? `${state.error}, saved ${stamp}` : `Live weather, updated ${stamp}`;
  }
  const cond = (t, type) => E.conditionsAt(state.weather, t, { type: type || 'shipcanal', measure: state.measure });

  /* ---------- Reading the conditions ---------- */
  function trips() { return E.groupTrips(state.records); }
  function scored(t) {
    const c = cond(t), tr = trips();
    const rows = D.SPECIES.map((sp) => {
      const p = E.personalAdjust(sp.id, condForLearn(c), tr);
      return E.scoreSpecies(sp, c, state.settings, p);
    }).sort((a, b) => b.score - a.score);
    return { c, rows, best: rows.find((r) => r.recommended) || null };
  }
  function condForLearn(c) { return { water: c.water, pressClass: c.pressClass, daypart: c.daypart, windClass: c.windClass, wind: c.wind }; }
  function snapshot(c) {
    return { water: c.water, air: c.air, press: c.press, d3: c.d3, pressClass: c.pressClass, wind: c.wind, windClass: c.windClass, gust: c.gust, dir: c.dir, code: c.code, cloud: c.cloud, precip: c.precip, daypart: c.daypart, night: c.night, sunrise: c.sunrise, sunset: c.sunset, moon: c.moon.name };
  }
  function spotsFor(sp, c) {
    return E.rankSpots(sp, c, allSpots(), { origin: origin(), settings: state.settings, checked: state.checked, spotLift: E.spotLifter(sp.id, trips()) });
  }
  function alertsFor(c) {
    const a = [];
    if (c.thunder) a.push(['bad', 'Thunderstorm', 'A carbon rod is a lightning conductor. Put it down and get away from the water.']);
    if (c.gust >= 75 || c.wind >= 60) a.push(['bad', 'Dangerous wind', `Gusts up to ${round(c.gust)} km/h. Stay away from the water and trees.`]);
    if (c.ice) a.push(['bad', 'Ice is possible', 'Never walk on the ice, and bites will be very rare.']);
    if (E.baitClosed(c.t)) a.push(['warn', 'Closed season for lures and fish baits', 'Until the last Saturday of May: no lures, dead fish, pieces of fish or slaughter products. Pike, zander and perch must go straight back.']);
    if (c.night && state.settings.permit !== 'full') a.push(['warn', 'Night period', state.settings.permit === 'kleine' ? 'The Kleine VISpas does not allow night fishing.' : 'You need NachtVIS permission for this time, on waters that allow it.']);
    else if (c.night) a.push(['info', 'Night period', 'Check that this water allows night fishing with your NachtVIS permission.']);
    if ((c.gust >= 50 && c.gust < 75)) a.push(['warn', 'Strong gusts', `Gusts up to ${round(c.gust)} km/h. Look for shelter and stay clear of trees.`]);
    return a;
  }
  const alertHTML = (a) => a.map(([tone, title, text]) => `<div class="alert ${tone}"><span class="sym" aria-hidden="true">${tone === 'info' ? 'i' : '!'}</span><div><strong>${esc(title)}</strong>${esc(text)}</div></div>`).join('');

  /* ---------- Pictures ---------- */
  function floatMeter(score) {
    const depth = -24 + score * .5; /* the better the score, the deeper the float pulls */
    const rings = score >= 62 ? 3 : score >= 45 ? 2 : 1;
    let ringSvg = '';
    for (let i = 0; i < rings; i++) ringSvg += `<ellipse cx="56" cy="78" rx="${16 + i * 13}" ry="${3 + i * 1.6}" fill="none" stroke="var(--bodyf)" stroke-opacity="${.75 - i * .2}" stroke-width="1.5"/>`;
    return `<svg viewBox="0 0 112 128" role="img" aria-label="Bite meter: ${score} out of 100"><rect width="112" height="78" fill="var(--surface2)"/>
      <g transform="translate(0 ${depth})"><g class="float-group"><rect x="52" y="10" width="8" height="30" rx="3.5" fill="var(--float)"/><rect x="52" y="36" width="8" height="5" fill="var(--bodyf)"/><ellipse cx="56" cy="62" rx="13" ry="23" fill="var(--bodyf)" stroke="var(--ink)" stroke-opacity=".35"/><rect x="55" y="84" width="2" height="26" fill="var(--bodyf)"/></g></g>
      <rect y="78" width="112" height="50" fill="var(--water)" fill-opacity=".93"/>${ringSvg}</svg>`;
  }
  const FISH = {
    long: '<path d="M4 20c10-8 28-10 46-8 14 1 22 5 28 8l14-7-3 7 3 7-14-7c-6 3-14 7-28 8-18 2-36 0-46-8Z"/>',
    std: '<path d="M8 20c8-10 24-14 38-12 12 2 20 7 26 12l14-9-4 9 4 9-14-9c-6 5-14 10-26 12-14 2-30-2-38-12Z"/>',
    deep: '<path d="M10 20C16 6 32 2 46 4c12 2 20 9 26 16l14-10-5 10 5 10-14-10c-6 7-14 14-26 16-14 2-30-2-36-16Z"/>',
    eel: '<path d="M4 20c8-7 15-7 22-3 8 4 14 6 22 2 8-5 16-6 24-3 6 2 12 3 16 4-5 3-11 3-17 2-8-2-15-1-21 3-8 5-16 3-24-1-7-4-14-3-22 2Z"/>'
  };
  const fishSvg = (shape) => `<svg viewBox="0 0 92 40" fill="currentColor" aria-hidden="true">${FISH[shape] || FISH.std}</svg>`;

  function hourStrip(sp, opts) {
    opts = opts || {};
    const H = state.weather.hourly, from = Date.now() - HOUR / 2, to = from + 48 * HOUR, tr = trips();
    let html = '', selHour = state.t === null ? null : Math.round(state.t / HOUR);
    const nowHour = Math.round(Date.now() / HOUR);
    for (let i = 0; i < H.time.length; i++) {
      const t = H.time[i];
      if (t < from || t > to) continue;
      const c = cond(t), r = E.scoreSpecies(sp, c, state.settings, E.personalAdjust(sp.id, condForLearn(c), tr));
      const d = new Date(t), blocked = !r.legal.ok;
      const tick = d.getHours() === 0 ? `<span class="tick day">${esc(weekday(t))}</span>` : d.getHours() % 6 === 0 ? `<span class="tick">${String(d.getHours()).padStart(2, '0')}</span>` : '';
      const sel = selHour === Math.round(t / HOUR) || (selHour === null && nowHour === Math.round(t / HOUR));
      const hgt = Math.max(5, r.score * .86);
      html += `<button class="hr ${c.daypart === 'night' ? 'nightband' : ''} ${blocked ? 'blocked' : ''} ${sel ? 'sel' : ''}" data-act="pick-hour" data-t="${t}" aria-label="${esc(weekday(t))} ${clock(t)}: ${blocked ? 'not allowed' : r.band.label + ', ' + r.score}"><span class="bar ${blocked ? '' : 'bg-' + r.band.tone}" style="height:${hgt}px"></span>${tick}</button>`;
    }
    return `<div class="strip" id="${opts.id || 'strip'}"><div class="strip-inner">${html}</div></div>
      <div class="legend"><span><i class="bg-good"></i>Good</span><span><i class="bg-warn"></i>Fair</span><span><i class="bg-bad"></i>Slow</span><span><i class="hatch"></i>Not allowed</span><span><i class="nightkey"></i>Dark</span></div>`;
  }
  function pressureSpark(w, t) {
    const H = w.hourly, pts = [];
    for (let i = 0; i < H.time.length; i++) if (H.time[i] >= t - 24 * HOUR && H.time[i] <= t + 12 * HOUR && H.press[i] !== null) pts.push([H.time[i], H.press[i]]);
    if (pts.length < 2) return '';
    const min = Math.min(...pts.map((p) => p[1])), max = Math.max(...pts.map((p) => p[1])), pad = Math.max(1, (max - min) * .15);
    const x = (v) => 2 + (v - pts[0][0]) / (pts[pts.length - 1][0] - pts[0][0]) * 196;
    const y = (v) => 32 - (v - (min - pad)) / (max - min + pad * 2) * 30;
    const line = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
    const closest = pts.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a));
    return `<svg class="spark" viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden="true"><path d="${line}" fill="none" stroke="var(--water)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x(closest[0])}" cy="${y(closest[1])}" r="3" fill="var(--float)"/></svg>`;
  }

  /* ---------- Today ---------- */
  function renderToday() {
    const w = state.weather;
    if (!w) return `<div class="skeleton"><h2>${state.error ? esc(state.error) : 'Checking the water'}</h2><p class="muted">${state.error ? 'Stek needs a connection the first time it opens.' : 'Getting live weather for Groningen.'}</p>${state.error ? '<button class="btn primary" data-act="refresh">Try again</button>' : ''}</div>`;
    const t = NEEDLE(), { c, rows, best } = scored(t), isNow = state.t === null;
    const head = isNow ? `Today ${clock(Date.now())}` : `${dayLabel(t)} ${clock(t)}`;
    const alerts = alertsFor(c);
    let hero;
    if (!best) {
      hero = `<section class="hero"><div class="eyebrow num"><span>${esc(head)}</span></div><h1>Nothing recommended right now</h1><p>Your permit or the rules block every target fish at this time. Pick another hour below.</p></section>`;
    } else {
      const sp = best.sp, reasons = E.headlineReasons(best, c), top = spotsFor(sp, c)[0], how = E.howTo(sp, c);
      const win = E.bestWindow(w, sp.id, Date.now(), 36, { settings: state.settings, measure: state.measure }).best;
      const adj = best.personal && best.personal.points ? `<span class="pill info">Your log ${signed(best.personal.points, 0)}</span>` : '';
      const wording = { excellent: 'Excellent fishing', good: 'Good fishing', fair: 'Fair fishing', slow: 'Slow fishing', poor: 'Poor fishing' }[best.band.key];
      const others = rows.filter((r) => r.recommended && r !== best).slice(0, 3).map((r) => `<button class="chip" data-act="species" data-id="${r.sp.id}">${esc(r.sp.name)} ${r.score}</button>`).join('');
      hero = `<section class="hero">
        <div class="eyebrow num"><span>${esc(head)}</span>${isNow ? '' : '<button class="btn link" data-act="now" style="min-height:0;padding:0">Back to now</button>'}</div>
        <h1>${wording} for ${esc(sp.name.toLowerCase())}</h1>
        <div class="meter">${floatMeter(best.score)}<div class="meter-copy"><div class="meter-score">${best.score}<small> /100</small></div><div class="meter-label"><span class="dot bg-${best.band.tone}"></span>${best.band.label} right ${isNow ? 'now' : 'then'} ${adj}</div></div></div>
        <ul class="why">${reasons.pos.map((r) => `<li><span class="mark tone-good" aria-label="Helps">+</span><span>${esc(r.text)}</span></li>`).join('')}${reasons.neg.map((r) => `<li><span class="mark tone-bad" aria-label="Hurts">−</span><span>${esc(r.text)}</span></li>`).join('')}</ul>
        ${win ? `<p class="num"><strong>Best in the next 36 hours:</strong> ${esc(windowText(win))} (${win.score})</p>` : ''}
        ${others ? `<div><div class="label">Also on</div><div class="chips" style="margin-top:5px">${others}</div></div>` : ''}
      </section>
      ${alerts.length ? `<div style="display:grid;gap:8px">${alertHTML(alerts)}</div>` : ''}
      ${top ? `<section class="block go"><div class="label">Go here</div><button class="btn link" data-act="spot" data-id="${esc(top.spot.id)}" style="justify-content:flex-start;padding:0;min-height:0;text-decoration:none"><h3 style="text-align:left">${esc(top.spot.name)}</h3></button>
        <div class="go-meta num"><span class="pill">${top.minutes} min by bike</span>${statusPill(top.spot)}</div>
        <p>${esc(top.spot.tips || '')}</p><p>${esc(E.windAdvice(c))}</p>
        <div class="btnrow"><a class="btn primary" href="${routeUrl(top.spot)}" target="_blank" rel="noopener">Bike route</a><button class="btn" data-act="tab" data-id="spots" data-species="${sp.id}">More spots</button></div></section>` : ''}
      <section class="block"><div class="label">How to fish it</div><div class="howgrid"><div><span class="label">Where</span><span>${esc(how.where)}</span></div><div><span class="label">Rig</span><span>${esc(how.rig)}</span></div><div><span class="label">Bait</span><span>${esc(how.bait)}</span></div><div><span class="label">Tip</span><span>${esc(how.tip)}</span></div></div>
        <button class="btn" data-act="species" data-id="${sp.id}">Full ${esc(sp.name.toLowerCase())} guide and rules</button></section>`;
    }
    const stripSp = best ? best.sp : rows[0].sp;
    return `${installBanner()}${hero}
      <section class="block"><div class="sectionhead"><h2>Next 48 hours</h2><span class="aside">${esc(stripSp.name)}</span></div>${hourStrip(stripSp)}<p class="small muted">Tap an hour to see that moment.</p></section>
      <section style="display:grid;gap:8px"><div class="sectionhead"><h2>Conditions</h2><span class="aside num">${esc(E.weatherText(c.code))}</span></div>${conditionsGrid(c, w)}</section>
      <section style="display:grid;gap:8px"><div class="sectionhead"><h2>Every fish</h2><span class="aside">Tap for the guide</span></div>${speciesRows(rows)}</section>
      ${learningBlock()}
      <p class="foot">Scores are estimates built from general fishing knowledge and your log. Weather by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>. Always check the rules in the <a href="${LINKS.visplanner}" target="_blank" rel="noopener">VISplanner</a>.</p>`;
  }
  function statusPill(s) {
    if (s.own) return '<span class="pill info">Your spot</span>';
    if (state.checked[s.id]) return '<span class="pill good">You checked it</span>';
    if (s.status === 'listed') return '<span class="pill info">On 2026 Kleine Lijst</span>';
    return '<span class="pill warn">Check VISplanner</span>';
  }
  function conditionsGrid(c, w) {
    const bft = E.beaufort(c.wind), rainNext = (() => {
      let max = 0; const H = w.hourly;
      for (let i = c.idx; i < Math.min(H.time.length, c.idx + 3); i++) max = Math.max(max, H.pprob[i] || 0);
      return max;
    })();
    const k = (x) => (x >= 1000 ? round(x / 1000, 0) + ' km' : round(x, 0) + ' m');
    const riseSet = `${clock(c.sunrise)} / ${clock(c.sunset)}`;
    const measured = state.measure && c.t >= state.measure.ts && c.t - state.measure.ts < 7 * DAY;
    return `<div class="cond">
      <div class="cell"><span class="label">Air</span><span class="val">${round(c.air, 1)}<small> °C</small></span><span class="sub">Feels like ${round(c.feels, 0)} °C</span></div>
      <button class="cell tap" data-act="measure"><span class="label">Water</span><span class="val">${round(c.water, 1)}<small> °C</small></span><span class="sub">Canal, ${signed(c.waterTrend)} in 3 days</span><span class="tag">${measured ? 'Corrected with your reading' : 'Estimate, tap to correct'}</span></button>
      <div class="cell wide"><span class="label">Air pressure</span><span class="val">${round(c.press, 0)}<small> hPa</small></span><span class="sub">${esc(E.PRESS_TEXT[c.pressClass])}: ${signed(c.d3)} in 3 h, ${signed(c.d24)} in 24 h</span>${pressureSpark(w, c.t)}</div>
      <div class="cell"><span class="label">Wind</span><span class="val">${round(c.wind, 0)}<small> km/h ${esc(E.compass(c.dir))}</small></span><span class="sub">${bft} Bft, gusts ${round(c.gust, 0)}</span></div>
      <div class="cell"><span class="label">Surface drift</span><span class="val">To ${esc(E.compass(c.dir + 180))}</span><span class="sub">Wind-driven estimate</span></div>
      <div class="cell"><span class="label">Rain</span><span class="val">${round(c.precip, 1)}<small> mm</small></span><span class="sub">${round(rainNext, 0)}% chance in 3 h</span></div>
      <div class="cell"><span class="label">Cloud</span><span class="val">${round(c.cloud, 0)}<small> %</small></span><span class="sub">${esc(E.weatherText(c.code))}</span></div>
      <div class="cell"><span class="label">Sunrise / sunset</span><span class="val num" style="font-size:24px">${riseSet}</span><span class="sub">${esc({ dawn: 'Dawn window', dusk: 'Dusk window', day: 'Daytime', night: 'Dark' }[c.daypart])}</span></div>
      <div class="cell"><span class="label">Moon</span><span class="val" style="font-size:24px">${round(c.moon.illum * 100, 0)}<small> %</small></span><span class="sub">${esc(c.moon.name)}</span></div>
      <div class="cell"><span class="label">Humidity</span><span class="val">${round(c.rh, 0)}<small> %</small></span><span class="sub">Dew point ${round(c.dew, 0)} °C</span></div>
      <div class="cell"><span class="label">Visibility</span><span class="val" style="font-size:24px">${k(c.vis)}</span><span class="sub">UV index ${round(c.uv, 0)}</span></div>
      ${w.sst !== null && w.sst !== undefined ? `<div class="cell"><span class="label">Sea at the coast</span><span class="val">${round(w.sst, 1)}<small> °C</small></span><span class="sub">Reference only</span></div>` : ''}
      <a class="cell tap ${w.sst !== null && w.sst !== undefined ? '' : 'wide'}" href="${LINKS.waterinfo}" target="_blank" rel="noopener"><span class="label">Level and current</span><span class="val" style="font-size:24px">Waterinfo</span><span class="sub">No live feed yet. Open the official site.</span></a>
    </div>`;
  }
  function speciesRows(rows) {
    const line = (r) => {
      const blocked = !r.legal.ok || !r.sp.recommend;
      const sub = r.sp.rules.protect && !r.legal.notes.length ? 'Protected: release straight away' : blocked ? (r.legal.notes[0] || 'Not recommended as a target') : `${r.band.label} · ${r.sp.nl}`;
      return `<button class="row ${blocked ? 'off' : ''}" data-act="species" data-id="${r.sp.id}"><span class="score ${blocked ? '' : 'tone-' + r.band.tone}">${blocked ? '—' : r.score}</span><span><span class="title">${esc(r.sp.name)}</span><span class="sub">${esc(sub)}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
    };
    return `<div class="rows">${rows.filter((r) => r.recommended).map(line).join('')}${rows.filter((r) => !r.recommended).map(line).join('')}</div>`;
  }
  function learningBlock() {
    const n = trips().length;
    if (n >= E.LEARN_FULL) return `<section class="block"><div class="label">Your log</div><p>Your ${n} trips are fully included. Scores can move up to 15 points based on what has worked for you.</p></section>`;
    const need = n < E.LEARN_MIN ? `${E.LEARN_MIN - n} more ${E.LEARN_MIN - n === 1 ? 'trip' : 'trips'} until your log starts adjusting the scores.` : `Your log is adjusting the scores. Its influence keeps growing until ${E.LEARN_FULL} trips.`;
    return `<section class="block"><div class="label">Learning from you</div><p>${esc(need)} Trips with no catch count too.</p><div class="factor-bar" role="img" aria-label="${n} of ${E.LEARN_FULL} trips"><span style="width:${Math.min(100, n / E.LEARN_FULL * 100)}%"></span></div><p class="small muted num">${n} of ${E.LEARN_FULL} trips</p></section>`;
  }
  function installBanner() {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (standalone || state.installDismissed || !deferredInstall) return '';
    return `<div class="alert info"><span class="sym" aria-hidden="true">i</span><div><strong>Add Stek to your home screen</strong><div class="btnrow" style="margin-top:8px"><button class="btn primary" data-act="install">Install</button><button class="btn" data-act="dismiss-install">Not now</button></div></div></div>`;
  }

  /* ---------- Spots ---------- */
  function renderSpots() {
    if (!state.weather) return renderToday();
    const t = NEEDLE(), { c, rows, best } = scored(t);
    const sel = state.spotSpecies || (best ? best.sp.id : 'pike'), sp = E.speciesById(sel), ranked = spotsFor(sp, c);
    const chips = rows.filter((r) => r.sp.recommend).map((r) => `<button class="chip" data-act="spot-species" data-id="${r.sp.id}" aria-pressed="${r.sp.id === sel}">${esc(r.sp.name)}</button>`).join('');
    const list = ranked.map((r, i) => `<button class="row" data-act="spot" data-id="${esc(r.spot.id)}"><span class="score ${i < 3 ? 'tone-good' : 'muted'}">${i + 1}</span><span><span class="title">${esc(r.spot.name)}</span><span class="sub num">${r.minutes} min by bike · ${esc((D.WATER_TYPES[r.spot.type] || {}).label || '')}${r.why.length ? ' · ' + esc(r.why[0]) : ''}</span><span style="display:block;margin-top:4px">${statusPill(r.spot)}</span></span><span class="chev" aria-hidden="true">›</span></button>`).join('');
    const from = state.settings.origin ? 'your location' : 'the city centre';
    setTimeout(() => drawMap(ranked), 0);
    return `<section style="display:grid;gap:8px"><h1 style="font-size:38px;font-weight:700">Where to fish</h1><p>Ranked for <strong>${esc(sp.name.toLowerCase())}</strong> in today's conditions, from ${from}.</p><div class="chips">${chips}</div></section>
      <div id="map" role="application" aria-label="Map of fishing spots"></div>
      <p>${esc(E.windAdvice(c))}</p>
      <div class="rows">${list}</div>
      <div class="btnrow"><button class="btn" data-act="add-spot">Add your own spot</button><a class="btn" href="${LINKS.visplanner}" target="_blank" rel="noopener">Open VISplanner</a></div>
      <p class="small muted">Spots are starting points close to each water, so walk the bank to find access. Check every water in the VISplanner, and do not fish from bridges, in lock chambers or within 50 m of a fish passage.</p>`;
  }
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (loadLeaflet.p) return loadLeaflet.p;
    return (loadLeaflet.p = new Promise((res, rej) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'vendor/leaflet.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    }));
  }
  async function drawMap(ranked) {
    const el = $('#map'); if (!el) return;
    try { await loadLeaflet(); } catch (e) { el.innerHTML = '<p style="padding:16px">The map could not load. The list below still works.</p>'; return; }
    if (!$('#map')) return;
    if (map) { map.remove(); map = null; }
    map = L.map(el, { zoomControl: true, attributionControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([LAT, LON], 11, { animate: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
    ranked.forEach((r, i) => {
      const color = r.spot.own ? '#7a4fb5' : r.spot.status === 'listed' ? '#2f6f73' : '#9a6400';
      const icon = i < 3
        ? L.divIcon({ className: '', html: `<div class="rank-pin" style="background:#d9471a">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] })
        : L.divIcon({ className: '', html: `<div class="rank-pin" style="background:${color};width:16px;height:16px"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
      L.marker([r.spot.lat, r.spot.lon], { icon, title: r.spot.name, keyboard: true, alt: r.spot.name }).on('click', () => openSpot(r.spot.id)).addTo(mapLayer);
    });
    if (ranked.length) { const b = L.latLngBounds(ranked.slice(0, 8).map((r) => [r.spot.lat, r.spot.lon])); map.fitBounds(b.pad(.12), { animate: false, maxZoom: 14 }); }
  }

  /* ---------- Log ---------- */
  function photoURL(id) {
    if (state.photoUrls.has(id)) return Promise.resolve(state.photoUrls.get(id));
    return store.get('photos', id).then((b) => { if (!b) return null; const u = URL.createObjectURL(b); state.photoUrls.set(id, u); return u; });
  }
  function hydratePhotos(root) {
    (root || document).querySelectorAll('img[data-photo]').forEach((img) => {
      photoURL(img.dataset.photo).then((u) => { if (u) img.src = u; else img.hidden = true; }).catch(() => { img.hidden = true; });
    });
  }
  function renderLog() {
    const rec = [...state.records].sort((a, b) => b.ts - a.ts), st = E.computeStats(rec);
    const biggest = st.catches.reduce((b, r) => (r.weightG && (!b || r.weightG > b.weightG) ? r : b), null);
    const long = st.catches.reduce((b, r) => (r.lengthCm && (!b || r.lengthCm > b.lengthCm) ? r : b), null);
    const backupOld = rec.length && Date.now() - state.backupAt > 14 * DAY;
    let list = '', lastDay = null, group = '';
    const flush = () => { if (group) { list += `<div class="rows">${group}</div>`; group = ''; } };
    rec.forEach((r) => {
      const k = E.dateKey(r.ts);
      if (k !== lastDay) { flush(); list += `<div class="label datehead">${esc(dayLabel(r.ts))}</div>`; lastDay = k; }
      const sp = E.speciesById(r.speciesId), spot = spotById(r.spotId), name = r.type === 'blank' ? 'No catch' : sp ? sp.name : 'Other fish';
      const bits = r.type === 'blank' ? [r.durationMin ? r.durationMin + ' min' : null, r.targetId && E.speciesById(r.targetId) ? 'Target: ' + E.speciesById(r.targetId).name : null] : [r.lengthCm ? r.lengthCm + ' cm' : null, r.weightG ? weight(r.weightG) : null, r.bait];
      const pic = r.hasPhoto ? `<img class="thumb" data-photo="${esc(r.id)}" alt="">` : `<span class="thumb">${r.type === 'blank' ? '—' : fishSvg(sp ? sp.shape : 'std').replace('<svg', '<svg width="50"')}</span>`;
      group += `<button class="entry" data-act="record" data-id="${esc(r.id)}">${pic}<span><span class="title">${esc(name)}</span><span class="sub num">${clock(r.ts)} · ${esc(spot ? spot.name : r.spotName || 'Unknown spot')}</span><span class="sub num">${esc(bits.filter(Boolean).join(' · '))}</span></span></button>`;
    });
    flush();
    setTimeout(() => hydratePhotos($('#view')), 0);
    return `<section style="display:grid;gap:10px"><h1 style="font-size:38px;font-weight:700">Catch log</h1>
      <div class="bigactions"><button class="btn primary" data-act="add-catch">Log a catch</button><button class="btn" data-act="add-blank">No catch today</button></div></section>
      ${backupOld ? `<div class="alert warn"><span class="sym" aria-hidden="true">!</span><div><strong>Time for a backup</strong>Your log lives only on this phone.<div class="btnrow" style="margin-top:8px"><button class="btn" data-act="export">Save backup file</button></div></div></div>` : ''}
      ${rec.length ? `<div class="stats num"><div class="stat"><b>${st.catches.length}</b><span>${st.catches.length === 1 ? 'catch' : 'catches'}</span></div><div class="stat"><b>${st.speciesCount}</b><span>species</span></div><div class="stat"><b>${st.trips.length}</b><span>${st.trips.length === 1 ? 'trip' : 'trips'}</span></div><div class="stat"><b>${long ? long.lengthCm : '-'}</b><span>longest, cm</span></div><div class="stat"><b>${biggest ? round(biggest.weightG / 1000, 1) : '-'}</b><span>heaviest, kg</span></div><div class="stat"><b>${st.streak}</b><span>week streak</span></div></div>${list}`
        : `<div class="block empty">${fishSvg('long').replace('<svg', '<svg width="120"')}<h2>Your log starts here</h2><p>Log your first fish, or a trip with no catch. Stek saves the weather with every entry, and your scores get more personal over time.</p></div>`}`;
  }

  /* ---------- Trophies ---------- */
  function renderTrophies() {
    const p = E.computeProgress(state.records), earned = new Set(p.earned.map((a) => a.id));
    const dex = D.SPECIES.map((sp) => {
      const pb = p.stats.pbs[sp.id];
      return `<button class="dexitem ${pb ? '' : 'locked'}" data-act="species" data-id="${sp.id}">${fishSvg(sp.shape)}<b>${pb ? esc(sp.name) : '???'}</b><span class="num">${pb ? (pb.lengthCm ? pb.lengthCm + ' cm' : pb.count + ' caught') + (pb.weightG ? ' · ' + weight(pb.weightG) : '') : esc(sp.nl === 'Paling' || sp.nl === 'Meerval' ? 'Protected' : 'Not caught')}</span></button>`;
    }).join('');
    const ach = [...E.ACHIEVEMENTS].sort((a, b) => (earned.has(b.id) ? 1 : 0) - (earned.has(a.id) ? 1 : 0)).map((a) => `<div class="ach ${earned.has(a.id) ? 'done' : ''}"><span class="badge" aria-hidden="true">${earned.has(a.id) ? '★' : ''}</span><span><span class="name">${esc(a.name)}</span><span class="desc">${esc(a.text)}</span></span><span class="pts">${a.xp} XP</span></div>`).join('');
    return `<section class="levelcard"><span class="label" style="color:inherit;opacity:.8">Level ${p.level}</span><div class="lv">${esc(p.title)}</div>
        <div class="xpbar" role="img" aria-label="${p.into} of ${p.span} XP to next level"><span style="width:${p.nextAt ? Math.min(100, p.into / p.span * 100) : 100}%"></span></div>
        <div class="sub num">${p.xp} XP${p.nextAt ? ` · ${p.nextAt - p.xp} XP to ${esc(p.nextTitle)}` : ' · Top level reached'}</div></section>
      <div class="stats num"><div class="stat"><b>${p.stats.speciesCount}/${D.SPECIES.length}</b><span>species</span></div><div class="stat"><b>${p.earned.length}/${E.ACHIEVEMENTS.length}</b><span>badges</span></div><div class="stat"><b>${p.stats.streak}</b><span>week streak</span></div></div>
      <section style="display:grid;gap:8px"><h2>Species collection</h2><div class="dex">${dex}</div></section>
      <section style="display:grid;gap:8px"><h2>Badges</h2><div class="rows">${ach}</div></section>
      <p class="small muted">How XP works: 40 for a catch, 25 for a trip with no catch, 100 extra for a new species, 60 for a personal best. Every entry helps your scores.</p>`;
  }

  /* ---------- Sheets ---------- */
  function openSheet(title, body, after) {
    const el = $('#sheet');
    el.innerHTML = `<div class="sheet-head"><button class="iconbtn" data-act="close" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button><h2>${esc(title)}</h2></div><div class="sheet-body">${body}</div>`;
    el.hidden = false; el.scrollTop = 0; document.body.style.overflow = 'hidden';
    if (after) after(el);
  }
  function closeSheet() { const el = $('#sheet'); el.hidden = true; el.innerHTML = ''; document.body.style.overflow = ''; }

  function openSpecies(id) {
    const sp = E.speciesById(id);
    if (!state.weather) return;
    const t = NEEDLE(), c = cond(t), tr = trips(), p = E.personalAdjust(sp.id, condForLearn(c), tr), r = E.scoreSpecies(sp, c, state.settings, p);
    const how = E.howTo(sp, c), f = E.explainFactors(r, c), spots = spotsFor(sp, c).slice(0, 3), rules = sp.rules || {}, closed = E.closedStatus(sp, t);
    const pb = E.computeStats(state.records).pbs[sp.id];
    const win = E.bestWindow(state.weather, sp.id, Date.now(), 36, { settings: state.settings, measure: state.measure }).best;
    const ruleLines = [];
    if (closed.closed) ruleLines.push(closed.text + '. Release immediately.');
    if (rules.protect) ruleLines.push(rules.protect);
    if (rules.release && !rules.protect) ruleLines.push('Must always be released, unharmed, in the same water. A photo first is allowed.');
    if (rules.releaseAdvised) ruleLines.push('A vulnerable species. Stek advises releasing it.');
    if (rules.min) ruleLines.push(`Minimum size: ${rules.min} cm.`);
    if (rules.take) ruleLines.push(rules.take);
    if (rules.closed === 'pike') ruleLines.push('Closed 1 March until the last Saturday of May.');
    if (rules.closed === 'zander') ruleLines.push('Closed 1 April until the last Saturday of May.');
    if (rules.closed === 'ide') ruleLines.push('Closed 1 April until 31 May.');
    if (state.settings.permit === 'kleine') ruleLines.push('With the Kleine VISpas, all fish go back and only the listed baits are allowed.');
    else ruleLines.push(D.LEGAL.takeTotal);
    openSheet(`${sp.name}`, `<p class="muted">${esc(sp.nl)} · ${esc(sp.group)}</p>
      <div class="meter">${floatMeter(r.score)}<div class="meter-copy"><div class="meter-score">${r.legal.ok && sp.recommend ? r.score : '—'}<small> /100</small></div><div class="meter-label"><span class="dot bg-${r.band.tone}"></span>${r.legal.ok && sp.recommend ? r.band.label : esc(r.legal.notes[0] || 'Not recommended')}</div></div></div>
      ${win && sp.recommend ? `<p class="num"><strong>Best next:</strong> ${esc(windowText(win))} (${win.score})</p>` : ''}
      ${pb ? `<p class="num"><strong>Your best:</strong> ${pb.lengthCm ? pb.lengthCm + ' cm' : ''}${pb.lengthCm && pb.weightG ? ', ' : ''}${pb.weightG ? weight(pb.weightG) : ''} from ${pb.count} logged</p>` : ''}
      <section class="block"><h3>Rules</h3><ul style="margin:0;padding-left:20px;display:grid;gap:4px">${ruleLines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><a class="btn" href="${LINKS.visplanner}" target="_blank" rel="noopener">Check this water in VISplanner</a></section>
      ${sp.recommend ? `<section class="block"><h3>How to fish it now</h3><div class="howgrid"><div><span class="label">Where</span><span>${esc(how.where)}</span></div><div><span class="label">Rig</span><span>${esc(how.rig)}</span></div><div><span class="label">Bait</span><span>${esc(how.bait)}</span></div><div><span class="label">Tip</span><span>${esc(how.tip)}</span></div></div></section>
      <section class="block"><h3>Best spots now</h3><div style="display:grid;gap:8px">${spots.map((s) => `<button class="btn" data-act="spot" data-id="${esc(s.spot.id)}" style="justify-content:space-between;text-align:left"><span>${esc(s.spot.name)}</span><span class="muted num" style="font-weight:400;white-space:nowrap">${s.minutes} min</span></button>`).join('')}</div></section>` : ''}
      <section class="block"><h3>Next 48 hours</h3>${hourStrip(sp, { id: 'strip2' })}</section>
      <section class="block"><h3>Why this score</h3><div style="display:grid;gap:11px">${f.map((x) => `<div class="factor"><div class="factor-top"><span>${esc(x.label)}</span><span class="num muted">${Math.round(x.value * 100)}</span></div><div class="factor-bar"><span style="width:${Math.round(x.value * 100)}%"></span></div><span class="small muted">${esc(x.text)}</span></div>`).join('')}
        ${p.points ? `<div class="alert info"><span class="sym" aria-hidden="true">i</span><div><strong>Your log: ${signed(p.points, 0)} points</strong>Based on ${p.trips} logged trips, looking at ${esc(p.parts.map((x) => x.label).join(', '))}.</div></div>` : ''}</div></section>
      <button class="btn primary" data-act="add-catch" data-species="${sp.id}">Log a ${esc(sp.name.toLowerCase())}</button>`);
  }
  function openSpot(id) {
    const s = spotById(id); if (!s) return;
    const km = E.distanceKm(origin(), s), c = state.weather ? cond(NEEDLE(), s.type) : null;
    const rec = state.records.filter((r) => r.spotId === id), catches = rec.filter((r) => r.type === 'catch');
    const best = c ? D.SPECIES.filter((sp) => sp.recommend).map((sp) => ({ sp, v: (sp.habitat[s.type] || .5) * E.scoreSpecies(sp, c, state.settings).score, ok: E.legalCheck(sp, c, state.settings).ok })).filter((x) => x.ok).sort((a, b) => b.v - a.v).slice(0, 4) : [];
    const st = s.own ? 'Saved on this phone only. Check that fishing is allowed here.' : s.status === 'listed' ? 'This water is named in the Kleine Lijst van VISwateren 2026. Check the exact bank and local rules in the VISplanner.' : 'Stek could not confirm this water from public VISpas lists. Check it in the VISplanner before fishing.';
    openSheet(s.name, `<div class="go-meta num"><span class="pill">${E.bikeMinutes(km)} min by bike</span><span class="pill">${round(km, 1)} km straight line</span>${statusPill(s)}</div>
      <p>${esc(s.tips || 'Your own spot.')}</p>
      ${c ? `<dl class="kv num"><dt>Water type</dt><dd>${esc((D.WATER_TYPES[s.type] || {}).label || '')}</dd><dt>Water here (estimate)</dt><dd>${round(c.water, 1)} °C</dd><dt>Wind</dt><dd>${esc(E.windAdvice(c))}</dd></dl>` : ''}
      ${best.length ? `<section class="block"><h3>Best fish here now</h3><div class="chips">${best.map((b) => `<button class="chip" data-act="species" data-id="${b.sp.id}">${esc(b.sp.name)}</button>`).join('')}</div></section>` : ''}
      <section class="block"><h3>Your record here</h3><p>${rec.length ? `${catches.length} ${catches.length === 1 ? 'catch' : 'catches'} on ${new Set(rec.map((r) => E.dateKey(r.ts))).size} ${new Set(rec.map((r) => E.dateKey(r.ts))).size === 1 ? 'day' : 'days'}.` : 'Nothing logged here yet.'}</p></section>
      <section class="block"><h3>Permission</h3><p>${esc(st)}</p>${s.own ? '' : `<button class="btn" data-act="toggle-check" data-id="${esc(s.id)}">${state.checked[s.id] ? 'Remove my VISplanner check' : 'I checked this in the VISplanner'}</button><a class="btn" href="${LINKS.visplanner}" target="_blank" rel="noopener">Open VISplanner</a>`}</section>
      <div class="btnrow"><a class="btn primary" href="${routeUrl(s)}" target="_blank" rel="noopener">Bike route</a><button class="btn" data-act="add-catch" data-spot="${esc(s.id)}">Log a catch here</button></div>
      ${s.own ? `<button class="btn danger" data-act="del-spot" data-id="${esc(s.id)}">Delete this spot</button>` : ''}`);
  }

  /* Forms */
  function spotOptions(sel, point) {
    const p = point || origin();
    const rows = allSpots().map((s) => ({ s, km: E.distanceKm(p, s) })).sort((a, b) => a.km - b.km);
    return rows.map(({ s, km }) => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)} (${round(km, 1)} km)</option>`).join('');
  }
  function speciesOptions(sel) {
    const groups = ['Predator', 'Whitefish', 'Bottom fish', 'Protected'];
    return groups.map((g) => `<optgroup label="${g}">${D.SPECIES.filter((s) => s.group === g).map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)} (${esc(s.nl)})</option>`).join('')}</optgroup>`).join('') + `<option value="other" ${sel === 'other' ? 'selected' : ''}>Other fish</option>`;
  }
  let formDraft = {};
  function openCatchForm(opts) {
    opts = opts || {};
    const r = opts.record || {}, editing = !!opts.record;
    const def = opts.species || r.speciesId || state.spotSpecies || (state.weather && scored(Date.now()).best ? scored(Date.now()).best.sp.id : 'pike');
    const lastBaits = [...new Set(state.records.map((x) => x.bait).filter(Boolean))].slice(-20);
    const baits = ['Soft shad', 'Spinnerbait', 'Jerkbait', 'Spinner', 'Dropshot', 'Dead bait', 'Worm', 'Maggots', 'Sweetcorn', 'Bread', 'Boilie', ...lastBaits];
    formDraft = { photoBlob: null, released: r.released !== undefined ? r.released : true, removePhoto: false, lat: r.lat, lon: r.lon };
    openSheet(editing ? 'Edit catch' : 'Log a catch', `<form id="catch-form" novalidate style="display:grid;gap:14px">
      <label class="photo" id="photo-label">${r.hasPhoto ? `<img id="photo-preview" data-photo="${esc(r.id)}" alt="Catch photo">` : '<span id="photo-empty">Tap to take or choose a photo</span><img id="photo-preview" alt="Catch photo" hidden>'}<input type="file" id="photo-input" accept="image/*"></label>
      <div class="field"><label for="f-species">Fish</label><select id="f-species">${speciesOptions(def)}</select></div>
      <div class="two"><div class="field"><label for="f-length">Length (cm)</label><input id="f-length" type="number" inputmode="decimal" min="1" max="250" step="0.5" value="${r.lengthCm || ''}"></div><div class="field"><label for="f-weight">Weight (kg)</label><input id="f-weight" type="number" inputmode="decimal" min="0" max="80" step="0.01" value="${r.weightG ? r.weightG / 1000 : ''}"></div></div>
      <div class="advice" id="f-advice" aria-live="polite"></div>
      <div class="field"><label for="f-spot">Spot</label><select id="f-spot">${spotOptions(opts.spot || r.spotId)}</select><button type="button" class="btn" data-act="gps-spot">Use my location</button><span class="small muted" id="gps-note"></span></div>
      <div class="field"><label for="f-time">When</label><input id="f-time" type="datetime-local" value="${toLocalInput(r.ts || Date.now())}"></div>
      <div class="field"><label for="f-bait">Bait or lure</label><input id="f-bait" list="baits" autocomplete="off" value="${esc(r.bait || '')}"><datalist id="baits">${[...new Set(baits)].map((b) => `<option value="${esc(b)}"></option>`).join('')}</datalist></div>
      <div class="field"><span class="fieldlabel">What happened to the fish</span><div class="seg"><button type="button" data-act="released" data-v="1" aria-pressed="${formDraft.released}">Released</button><button type="button" data-act="released" data-v="0" aria-pressed="${!formDraft.released}">Kept</button></div></div>
      <div class="field"><label for="f-note">Note</label><textarea id="f-note">${esc(r.note || '')}</textarea></div>
      <p class="err" id="f-err" hidden></p>
      <button class="btn primary" type="submit">${editing ? 'Save changes' : 'Save catch'}</button>
      ${editing ? `<button class="btn danger" type="button" data-act="ask-delete" data-id="${esc(r.id)}">Delete this catch</button>` : ''}
      <input type="hidden" id="f-id" value="${esc(r.id || '')}"></form>`, (el) => {
      hydratePhotos(el);
      const paint = () => {
        const sp = E.speciesById($('#f-species').value), ts = new Date($('#f-time').value).getTime() || Date.now(), len = parseFloat($('#f-length').value);
        const adv = sp ? E.catchAdvice(sp, len, ts) : [];
        $('#f-advice').innerHTML = adv.map((a) => `<div class="alert ${a.tone}"><span class="sym" aria-hidden="true">${a.tone === 'info' ? 'i' : '!'}</span><div>${esc(a.text)}</div></div>`).join('');
      };
      ['f-species', 'f-length', 'f-time'].forEach((id) => $('#' + id).addEventListener('input', paint));
      paint();
      $('#photo-input').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0]; if (!file) return;
        try {
          const blob = await shrinkImage(file);
          formDraft.photoBlob = blob;
          const img = $('#photo-preview'); img.src = URL.createObjectURL(blob); img.hidden = false;
          const empty = $('#photo-empty'); if (empty) empty.hidden = true;
        } catch (err) { toast('That photo could not be read', 'Try a different picture.'); }
      });
      $('#catch-form').addEventListener('submit', (e) => { e.preventDefault(); saveCatch(r); });
    });
  }
  async function shrinkImage(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('photo'))), 'image/jpeg', .84));
  }
  function buildContext(ts, spot, speciesId) {
    const w = state.weather;
    if (!w || ts < w.hourly.time[0] || ts > w.hourly.time[w.hourly.time.length - 1]) return { cond: null, forecast: null };
    const c = E.conditionsAt(w, ts, { type: spot ? spot.type : 'shipcanal', measure: state.measure });
    const rows = D.SPECIES.map((sp) => E.scoreSpecies(sp, c, state.settings));
    const top = rows.filter((r) => r.recommended).sort((a, b) => b.score - a.score)[0];
    const mine = rows.find((r) => r.sp.id === speciesId);
    return { cond: snapshot(c), forecast: top ? { bestId: top.sp.id, bestScore: top.score, speciesScore: mine ? mine.score : null } : null };
  }
  async function saveCatch(old) {
    const ts = new Date($('#f-time').value).getTime();
    const len = parseFloat($('#f-length').value), kg = parseFloat($('#f-weight').value), err = $('#f-err');
    const fail = (m) => { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center' }); };
    if (!ts) return fail('Enter a date and time.');
    if (ts > Date.now() + 10 * 60 * 1000) return fail('That time is in the future. Check the date.');
    if (len && (len < 1 || len > 250)) return fail('Length should be between 1 and 250 cm.');
    if (kg && (kg <= 0 || kg > 80)) return fail('Weight should be between 0 and 80 kg.');
    const before = E.computeProgress(state.records);
    const spotId = $('#f-spot').value, spot = spotById(spotId), speciesId = $('#f-species').value;
    const ctx = old.id && old.ts === ts && old.spotId === spotId && old.speciesId === speciesId ? { cond: old.cond || null, forecast: old.forecast || null } : buildContext(ts, spot, speciesId);
    const rec = { id: old.id || uid(), type: 'catch', ts, speciesId, lengthCm: len || null, weightG: kg ? Math.round(kg * 1000) : null,
      spotId, spotName: spot ? spot.name : null, bait: $('#f-bait').value.trim() || null, released: formDraft.released,
      note: $('#f-note').value.trim() || null, hasPhoto: !!(old.hasPhoto || formDraft.photoBlob), cond: ctx.cond, forecast: ctx.forecast,
      lat: formDraft.lat !== undefined ? formDraft.lat : null, lon: formDraft.lon !== undefined ? formDraft.lon : null };
    try {
      if (formDraft.photoBlob) { await store.put('photos', formDraft.photoBlob, rec.id); const u = state.photoUrls.get(rec.id); if (u) URL.revokeObjectURL(u); state.photoUrls.delete(rec.id); }
      await store.put('records', rec);
    } catch (e) { return fail('This phone could not save the catch. Storage may be full.'); }
    state.records = state.records.filter((r) => r.id !== rec.id).concat(rec);
    requestPersist();
    closeSheet(); state.tab = 'log'; render();
    announce(before, rec, !!old.id);
  }
  function announce(before, rec, edited) {
    const after = E.computeProgress(state.records), lines = [];
    const a = after.annotated[rec.id] || {};
    const newBadges = after.earned.filter((x) => !before.earned.some((b) => b.id === x.id));
    if (a.newSpecies) lines.push('New species for your collection');
    if (a.pb) lines.push('New personal best');
    newBadges.forEach((b) => lines.push('Badge: ' + b.name));
    if (after.level > before.level) lines.push(`Level ${after.level}: ${after.title}`);
    const gain = after.xp - before.xp;
    toast(edited ? 'Saved' : (rec.type === 'blank' ? 'Trip logged' : 'Catch saved') + (gain > 0 ? ` +${gain} XP` : ''), lines.join(' · '));
  }
  function openBlankForm() {
    const best = state.weather ? scored(Date.now()).best : null;
    openSheet('No catch today', `<p>Blank trips teach Stek which conditions do not work for you, so they count for your score and earn XP.</p>
      <form id="blank-form" style="display:grid;gap:14px">
      <div class="field"><label for="b-spot">Spot</label><select id="b-spot">${spotOptions()}</select></div>
      <div class="field"><label for="b-target">Fishing for</label><select id="b-target">${speciesOptions(best ? best.sp.id : 'pike')}</select></div>
      <div class="two"><div class="field"><label for="b-dur">Minutes fished</label><input id="b-dur" type="number" inputmode="numeric" min="5" max="1440" step="5" value="60"></div><div class="field"><label for="b-time">When</label><input id="b-time" type="datetime-local" value="${toLocalInput(Date.now())}"></div></div>
      <div class="field"><label for="b-note">Note</label><textarea id="b-note"></textarea></div>
      <button class="btn primary" type="submit">Save trip</button></form>`, () => {
      $('#blank-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ts = new Date($('#b-time').value).getTime() || Date.now(), spotId = $('#b-spot').value, spot = spotById(spotId), target = $('#b-target').value;
        const ctx = buildContext(ts, spot, target), before = E.computeProgress(state.records);
        const rec = { id: uid(), type: 'blank', ts, targetId: target, spotId, spotName: spot ? spot.name : null, durationMin: parseInt($('#b-dur').value, 10) || null, note: $('#b-note').value.trim() || null, cond: ctx.cond, forecast: ctx.forecast };
        await store.put('records', rec).catch(() => toast('This phone could not save the trip'));
        state.records = state.records.concat(rec);
        closeSheet(); state.tab = 'log'; render(); announce(before, rec);
      });
    });
  }
  function openRecord(id) {
    const r = state.records.find((x) => x.id === id); if (!r) return;
    const sp = E.speciesById(r.speciesId), spot = spotById(r.spotId), c = r.cond;
    const condRows = c ? `<dt>Water (est.)</dt><dd>${round(c.water, 1)} °C</dd><dt>Air</dt><dd>${round(c.air, 1)} °C</dd><dt>Pressure</dt><dd>${round(c.press, 0)} hPa, ${esc((E.PRESS_TEXT[c.pressClass] || '').toLowerCase())}</dd><dt>Wind</dt><dd>${round(c.wind, 0)} km/h ${esc(E.compass(c.dir))}</dd><dt>Weather</dt><dd>${esc(E.weatherText(c.code))}</dd><dt>Moon</dt><dd>${esc(c.moon || '')}</dd>` : '';
    const title = r.type === 'blank' ? 'No catch' : sp ? sp.name : 'Other fish';
    openSheet(title, `${r.hasPhoto ? `<img class="catchphoto" data-photo="${esc(r.id)}" alt="Photo of your ${esc(title.toLowerCase())}">` : ''}
      <dl class="kv num"><dt>When</dt><dd>${esc(dayLabel(r.ts))}, ${clock(r.ts)}</dd><dt>Spot</dt><dd>${esc(spot ? spot.name : r.spotName || 'Unknown')}</dd>
      ${r.lengthCm ? `<dt>Length</dt><dd>${r.lengthCm} cm</dd>` : ''}${r.weightG ? `<dt>Weight</dt><dd>${weight(r.weightG)}</dd>` : ''}${r.bait ? `<dt>Bait or lure</dt><dd>${esc(r.bait)}</dd>` : ''}
      ${r.type === 'catch' ? `<dt>Fish</dt><dd>${r.released ? 'Released' : 'Kept'}</dd>` : ''}${r.durationMin ? `<dt>Fished for</dt><dd>${r.durationMin} min</dd>` : ''}${r.forecast && r.forecast.speciesScore !== null ? `<dt>Score then</dt><dd>${r.forecast.speciesScore}</dd>` : ''}${condRows}</dl>
      ${c ? '' : '<p class="small muted">No weather saved, because this entry is outside the saved forecast period.</p>'}
      ${r.note ? `<section class="block"><div class="label">Note</div><p>${esc(r.note)}</p></section>` : ''}
      <div class="btnrow">${r.type === 'catch' ? `<button class="btn" data-act="edit-record" data-id="${esc(r.id)}">Edit</button>` : ''}<button class="btn danger" data-act="ask-delete" data-id="${esc(r.id)}">Delete</button></div>`, (el) => hydratePhotos(el));
  }
  function askDelete(id) {
    openSheet('Delete this entry?', `<p>This removes it from your log, your scores and your XP. It cannot be undone unless you have a backup.</p><div class="btnrow"><button class="btn danger" data-act="confirm-delete" data-id="${esc(id)}">Delete</button><button class="btn" data-act="close">Keep it</button></div>`);
  }
  async function deleteRecord(id) {
    await store.del('records', id).catch(() => {}); await store.del('photos', id).catch(() => {});
    state.records = state.records.filter((r) => r.id !== id);
    closeSheet(); render(); toast('Entry deleted');
  }
  function openMeasure() {
    const c = state.weather ? cond(Date.now()) : null;
    openSheet('Water temperature', `<p>Stek estimates water temperature from the last 60 days of air temperature. Different waters can differ by a few degrees.</p>
      ${c ? `<p class="num"><strong>Current estimate:</strong> ${round(c.water, 1)} °C</p>` : ''}
      ${state.measure ? `<div class="alert info"><span class="sym" aria-hidden="true">i</span><div><strong>Your last reading: ${round(state.measure.temp, 1)} °C</strong>${esc(dayLabel(state.measure.ts))}, ${clock(state.measure.ts)}. Its effect fades over about a week.</div></div>` : ''}
      <form id="m-form" style="display:grid;gap:12px"><div class="field"><label for="m-temp">Thermometer reading (°C)</label><input id="m-temp" type="number" inputmode="decimal" min="0" max="35" step="0.1" required></div><button class="btn primary" type="submit">Use this reading</button></form>
      ${state.measure ? '<button class="btn" data-act="clear-measure">Remove my reading</button>' : ''}`, () => {
      $('#m-form').addEventListener('submit', (e) => {
        e.preventDefault(); const v = parseFloat($('#m-temp').value); if (isNaN(v) || v < 0 || v > 35) return;
        state.measure = { ts: Date.now(), temp: v }; saveKV('measure', state.measure); closeSheet(); render(); toast('Water reading saved');
      });
    });
  }
  function openAddSpot() {
    formDraft = {};
    openSheet('Add your own spot', `<p>It stays on this phone unless you export a backup. Check that fishing is allowed there.</p>
      <form id="s-form" style="display:grid;gap:14px"><div class="field"><label for="s-name">Name</label><input id="s-name" required maxlength="60" autocomplete="off"></div>
      <div class="field"><label for="s-type">Type of water</label><select id="s-type">${Object.entries(D.WATER_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
      <button type="button" class="btn" data-act="gps-new">Use my location</button><span class="small muted" id="gps-note"></span>
      <div class="two"><div class="field"><label for="s-lat">Latitude</label><input id="s-lat" type="number" inputmode="decimal" step="0.00001" required></div><div class="field"><label for="s-lon">Longitude</label><input id="s-lon" type="number" inputmode="decimal" step="0.00001" required></div></div>
      <p class="err" id="s-err" hidden></p><button class="btn primary" type="submit">Save spot</button></form>`, () => {
      $('#s-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const lat = parseFloat($('#s-lat').value), lon = parseFloat($('#s-lon').value), name = $('#s-name').value.trim(), err = $('#s-err');
        if (!name) { err.textContent = 'Give the spot a name.'; err.hidden = false; return; }
        if (!(lat >= 50 && lat <= 54.5 && lon >= 3 && lon <= 8)) { err.textContent = 'Those coordinates are not in the Netherlands.'; err.hidden = false; return; }
        state.userSpots.push({ id: 'own-' + uid(), name, type: $('#s-type').value, lat, lon, own: true, status: 'own' });
        saveKV('userSpots', state.userSpots); closeSheet(); render(); toast('Spot saved');
      });
    });
  }
  function openSettings() {
    const seg = (name, val, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-act="${name}" data-v="${v}" aria-pressed="${val === v}">${l}</button>`).join('')}</div>`;
    const canInstall = !!deferredInstall;
    openSheet('Settings', `<section class="block"><h3>Your permit</h3>${seg('permit', state.settings.permit, [['full', 'VISpas + NachtVIS'], ['vispas', 'VISpas'], ['kleine', 'Kleine VISpas']])}
      <p class="small muted">Kleine VISpas: one rod, single hook, listed baits only, daytime only, all fish go back, and only waters on the Kleine Lijst.</p></section>
      <section class="block"><h3>Distances from</h3><p class="small">${state.settings.origin ? 'Your saved location.' : 'Groningen centre.'}</p><div class="btnrow"><button class="btn" data-act="set-origin">Use my location</button>${state.settings.origin ? '<button class="btn" data-act="clear-origin">Use city centre</button>' : ''}</div><span class="small muted" id="gps-note"></span></section>
      <section class="block"><h3>Appearance</h3>${seg('theme', state.settings.theme, [['auto', 'Phone setting'], ['light', 'Light'], ['dark', 'Dark']])}</section>
      <section class="block"><h3>Backup</h3><p>Your catches and photos live only on this phone. Save a backup file now and then, and keep a copy somewhere safe.</p><div class="btnrow"><button class="btn" data-act="export">Save backup file</button><label class="btn" for="import-file">Restore backup</label></div><input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="small muted num">${state.backupAt ? 'Last backup: ' + esc(dayLabel(state.backupAt)) : 'No backup yet.'} ${state.records.length} entries.</p></section>
      ${canInstall ? '<button class="btn primary" data-act="install">Add to home screen</button>' : ''}
      <section class="block"><h3>About the data</h3><ul style="margin:0;padding-left:20px;display:grid;gap:6px" class="small">
        <li>Live weather comes from <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0).</li>
        <li>Water temperature is an estimate, not a measurement.</li>
        <li>Current and water level are not measured in the app. Open <a href="${LINKS.waterinfo}" target="_blank" rel="noopener">Waterinfo</a> for official readings.</li>
        <li>Bite scores are informed estimates from general fishing knowledge, plus your own log.</li>
        <li>Rules come from the ${esc(D.LEGAL.source)}. Rules can differ per water, so the <a href="${LINKS.visplanner}" target="_blank" rel="noopener">VISplanner</a> and your permit always win.</li>
        <li>Map data from OpenStreetMap.</li></ul></section>`, (el) => {
      const f = $('#import-file', el); if (f) f.addEventListener('change', (e) => { const x = e.target.files[0]; if (x) importBackup(x); });
    });
  }
  /* Backup */
  const blobToData = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  async function exportBackup() {
    toast('Preparing your backup');
    const photos = {};
    for (const r of state.records) if (r.hasPhoto) { const b = await store.get('photos', r.id).catch(() => null); if (b) photos[r.id] = await blobToData(b); }
    const data = { app: 'stek', version: 1, exportedAt: Date.now(), records: state.records, photos, userSpots: state.userSpots, checked: state.checked, settings: state.settings, measure: state.measure };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `stek-backup-${E.dateKey(Date.now())}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    state.backupAt = Date.now(); saveKV('backupAt', state.backupAt);
    toast('Backup saved', 'Check your downloads folder.'); render();
  }
  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'stek' || !Array.isArray(data.records)) throw new Error('format');
      let added = 0;
      for (const r of data.records) {
        if (!r || !r.id || !r.ts || !['catch', 'blank'].includes(r.type)) continue;
        if (!state.records.some((x) => x.id === r.id)) { added++; state.records.push(r); }
        await store.put('records', r);
        const ph = data.photos && data.photos[r.id];
        if (typeof ph === 'string' && ph.startsWith('data:image/')) { const b = await (await fetch(ph)).blob(); await store.put('photos', b, r.id); state.photoUrls.delete(r.id); }
      }
      if (Array.isArray(data.userSpots)) { for (const s of data.userSpots) if (s && s.id && !state.userSpots.some((x) => x.id === s.id)) state.userSpots.push(s); saveKV('userSpots', state.userSpots); }
      if (data.checked && typeof data.checked === 'object') { Object.assign(state.checked, data.checked); saveKV('checked', state.checked); }
      closeSheet(); render(); toast('Backup restored', `${added} new ${added === 1 ? 'entry' : 'entries'} added.`);
    } catch (e) { toast('That file could not be restored', 'Choose a Stek backup file.'); }
  }
  function requestPersist() { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); }
  function locate() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('none'));
      navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }), rej, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(title, sub) {
    const el = $('#toast');
    el.innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : '');
    el.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, sub ? 5000 : 2600);
  }

  /* ---------- Main render ---------- */
  function render() {
    const view = $('#view');
    const stripScroll = $('#strip') ? $('#strip').scrollLeft : null;
    if (map) { map.remove(); map = null; }
    view.innerHTML = ({ today: renderToday, spots: renderSpots, log: renderLog, trophies: renderTrophies }[state.tab] || renderToday)();
    document.querySelectorAll('.tabs button').forEach((b) => { if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (stripScroll !== null && $('#strip')) $('#strip').scrollLeft = stripScroll;
    paintStatus();
    state.lastHour = Math.floor(Date.now() / (5 * 60 * 1000));
  }
  function setTab(tab) {
    state.tab = tab;
    try { history.replaceState(null, '', '#' + tab); } catch (e) { /* not available */ }
    render(); window.scrollTo(0, 0);
  }

  /* ---------- Taps ---------- */
  document.addEventListener('click', async (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { setTab(tabBtn.dataset.tab); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    switch (act) {
      case 'refresh': refresh(true); break;
      case 'settings': openSettings(); break;
      case 'close': closeSheet(); break;
      case 'now': state.t = null; render(); break;
      case 'pick-hour': {
        const t = +b.dataset.t, inSheet = !!b.closest('#sheet');
        state.t = Math.abs(t - Date.now()) < 45 * 60 * 1000 ? null : t;
        if (inSheet) closeSheet();
        render(); if (state.tab === 'today') window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      }
      case 'species': closeSheet(); openSpecies(id); break;
      case 'spot': closeSheet(); openSpot(id); break;
      case 'tab': closeSheet(); if (b.dataset.species) state.spotSpecies = b.dataset.species; setTab(id); break;
      case 'spot-species': state.spotSpecies = id; render(); break;
      case 'add-catch': closeSheet(); openCatchForm({ species: b.dataset.species, spot: b.dataset.spot }); break;
      case 'add-blank': openBlankForm(); break;
      case 'add-spot': openAddSpot(); break;
      case 'record': openRecord(id); break;
      case 'edit-record': { const r = state.records.find((x) => x.id === id); closeSheet(); openCatchForm({ record: r }); break; }
      case 'ask-delete': closeSheet(); askDelete(id); break;
      case 'confirm-delete': deleteRecord(id); break;
      case 'measure': openMeasure(); break;
      case 'clear-measure': state.measure = null; store.del('kv', 'measure').catch(() => {}); closeSheet(); render(); toast('Reading removed'); break;
      case 'released': formDraft.released = b.dataset.v === '1'; b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); break;
      case 'permit': state.settings.permit = b.dataset.v; saveKV('settings', state.settings); closeSheet(); render(); openSettings(); break;
      case 'theme': state.settings.theme = b.dataset.v; applyTheme(); saveKV('settings', state.settings); closeSheet(); render(); openSettings(); break;
      case 'toggle-check': if (state.checked[id]) delete state.checked[id]; else state.checked[id] = true; saveKV('checked', state.checked); closeSheet(); render(); openSpot(id); break;
      case 'del-spot': state.userSpots = state.userSpots.filter((s) => s.id !== id); saveKV('userSpots', state.userSpots); closeSheet(); render(); toast('Spot deleted'); break;
      case 'export': exportBackup(); break;
      case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; closeSheet(); render(); } break;
      case 'dismiss-install': state.installDismissed = true; saveKV('installDismissed', true); render(); break;
      case 'gps-spot': case 'gps-new': case 'set-origin': {
        const note = $('#gps-note'); if (note) note.textContent = 'Finding your location';
        try {
          const p = await locate();
          if (act === 'gps-spot') {
            formDraft.lat = p.lat; formDraft.lon = p.lon;
            const near = E.nearestSpot(p, allSpots());
            $('#f-spot').innerHTML = spotOptions(near ? near.spot.id : undefined, p);
            if (note) note.textContent = near ? `Nearest spot selected, ${round(near.km, 1)} km away. Location saved with this catch.` : 'Location saved with this catch.';
          } else if (act === 'gps-new') {
            $('#s-lat').value = p.lat.toFixed(5); $('#s-lon').value = p.lon.toFixed(5); if (note) note.textContent = 'Location filled in.';
          } else {
            state.settings.origin = { lat: p.lat, lon: p.lon, name: 'My location' }; saveKV('settings', state.settings); closeSheet(); render(); openSettings(); toast('Distances now start from your location');
          }
        } catch (err) { if (note) note.textContent = 'Could not get your location. Allow location for Stek in your browser settings.'; else toast('Could not get your location'); }
        break;
      }
      case 'clear-origin': state.settings.origin = null; saveKV('settings', state.settings); closeSheet(); render(); openSettings(); break;
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (state.tab === 'today' && $('#sheet').hidden) render(); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Stek is on your home screen'); });

  /* ---------- Keep it current ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!state.weather || Date.now() - state.weather.fetchedAt > 10 * 60 * 1000)) refresh();
  });
  window.addEventListener('online', () => refresh());
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (state.weather && Date.now() - state.weather.fetchedAt > 15 * 60 * 1000) { refresh(); return; }
    /* Move the clock without disturbing an open map or form. */
    const stamp = Math.floor(Date.now() / (5 * 60 * 1000));
    if (state.tab === 'today' && $('#sheet').hidden) { if (stamp !== state.lastHour) render(); else { const eb = $('.hero .eyebrow span'); if (eb && state.t === null) eb.textContent = 'Today ' + clock(Date.now()); } }
    paintStatus();
  }, 30000);

  /* ---------- Start ---------- */
  (async function start() {
    const hash = location.hash.replace('#', '');
    if (['today', 'spots', 'log', 'trophies'].includes(hash)) state.tab = hash;
    await loadAll();
    render();
    if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
    refresh();
  })();
})();
