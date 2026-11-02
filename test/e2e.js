/* Browser run-through at phone size with a stand-in weather service. Run: node test/e2e.js */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const day = (d) => iso(d).slice(0, 10);
function forecast() {
  const now = new Date(), s = new Date(now); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - 3);
  const H = { time: [], temperature_2m: [], apparent_temperature: [], dew_point_2m: [], relative_humidity_2m: [], precipitation: [], precipitation_probability: [], weather_code: [], cloud_cover: [], pressure_msl: [], wind_speed_10m: [], wind_gusts_10m: [], wind_direction_10m: [], visibility: [], uv_index: [], shortwave_radiation: [] };
  for (let i = 0; i < 24 * 7; i++) { const t = new Date(s.getTime() + i * 36e5), hr = t.getHours(); H.time.push(iso(t)); const air = 10 + 3.5 * Math.sin((hr - 8) / 24 * 6.28); H.temperature_2m.push(+air.toFixed(1)); H.apparent_temperature.push(+(air - 2).toFixed(1)); H.dew_point_2m.push(7.5); H.relative_humidity_2m.push(78); H.precipitation.push(i % 37 < 3 ? 0.6 : 0); H.precipitation_probability.push(i % 37 < 4 ? 55 : 10); H.weather_code.push(i % 37 < 3 ? 61 : 3); H.cloud_cover.push(85); H.pressure_msl.push(+(1022 + 8 * Math.sin(i / 30)).toFixed(1)); H.wind_speed_10m.push(+(14 + 5 * Math.sin(i / 11)).toFixed(1)); H.wind_gusts_10m.push(+(26 + 8 * Math.sin(i / 11)).toFixed(1)); H.wind_direction_10m.push(250); H.visibility.push(24000); H.uv_index.push(hr > 9 && hr < 15 ? 1 : 0); H.shortwave_radiation.push(hr > 8 && hr < 16 ? 90 : 0); }
  const dt = [], sr = [], ss = [];
  for (let i = 0; i < 7; i++) { const d = new Date(s.getTime() + i * 864e5); dt.push(day(d)); const a = new Date(d); a.setHours(7, 33); const b = new Date(d); b.setHours(17, 0); sr.push(iso(a)); ss.push(iso(b)); }
  const m = new Date(now); m.setMinutes(Math.floor(m.getMinutes() / 15) * 15, 0, 0);
  return { hourly: H, daily: { time: dt, sunrise: sr, sunset: ss }, current: { time: iso(m), temperature_2m: 13.3, apparent_temperature: 11.2, relative_humidity_2m: 72, precipitation: 0, weather_code: 3, cloud_cover: 90, pressure_msl: 1030.8, wind_speed_10m: 13.7, wind_gusts_10m: 24, wind_direction_10m: 11 } };
}
function history() { const t = [], v = []; for (let i = -60; i <= 3; i++) { const d = new Date(); d.setDate(d.getDate() + i); t.push(day(d)); v.push(i < -57 ? null : +(14 - i * -0.04 + 2 * Math.sin(i / 5)).toFixed(1)); } return { daily: { time: t, temperature_2m_mean: v } }; }
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const assert = (ok, msg) => { if (!ok) throw new Error('FAILED: ' + msg); console.log('ok  ' + msg); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light', acceptDownloads: true });
  let blockWeather = false, weatherHits = 0;
  let openMeteoDown = false;
  await ctx.route(/open-meteo\.com/, (route) => {
    weatherHits++;
    if (blockWeather) return route.abort();
    const u = route.request().url();
    if (openMeteoDown && !u.includes('marine')) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":true,"reason":"The service is overloaded"}' });
    const body = u.includes('marine') ? { current: { sea_surface_temperature: 12.4 } } : u.includes('temperature_2m_mean') ? history() : forecast();
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  await ctx.route(/brightsky\.dev/, (route) => {
    if (blockWeather) return route.abort();
    const f = forecast().hourly;
    const weather = f.time.map((t, i) => ({ timestamp: new Date(t).toISOString(), temperature: f.temperature_2m[i], dew_point: 7.5, relative_humidity: null, precipitation: 0, precipitation_probability: 10, cloud_cover: 80, pressure_msl: f.pressure_msl[i], wind_speed: 15, wind_gust_speed: 26, wind_direction: 250, visibility: 20000, solar: 0.05, condition: 'dry' }));
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ weather }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|tile.openstreetmap|net::|status of 503/.test(m.text())) errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png'), fullPage: true });
  const noOverflow = async (label) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert(o <= 0, 'no sideways scroll: ' + label + ' (' + o + ')'); };

  await page.goto(url);
  await page.waitForSelector('.hero h1');
  await page.waitForTimeout(300);
  const h1 = await page.textContent('.hero h1');
  assert(/^(Good|Medium|Bad) fishing for/.test(h1), 'headline: ' + h1);
  assert(await page.locator('.hero h1 span[class^="tone-"]').count() === 1, 'headline word has the score colour');
  assert((await page.textContent('.eyebrow')).includes('Today'), 'shows today and the time');
  for (const lbl of ['Air', 'Water', 'Air pressure', 'Wind', 'Surface drift', 'Rain', 'Cloud', 'Moon', 'Humidity', 'Visibility', 'Level and current']) assert(await page.locator(`.cell .label:text-is("${lbl}")`).count() === 1, 'condition shown: ' + lbl);
  assert((await page.locator('.cell:has(.label:text-is("Air pressure")) .val').textContent()).includes('1031'), 'live pressure is used');
  assert(!(await page.textContent('#view')).includes('Every fish'), 'Every fish section is gone');
  assert(await page.locator('.hr').count() >= 47, '48-hour strip');
  await noOverflow('today');
  await shot('01-today');

  // The fish picker switches the whole screen
  assert(await page.locator('.go').count() === 0, 'Go here block is gone');
  assert(await page.locator('.hero h1 .fishname').count() === 1, 'fish name is highlighted');
  assert(await page.locator('.pickgrid .chip').count() === 13, 'picker offers all 13 fish');
  await page.locator('.pickgrid .chip:text-is("Carp")').click();
  await page.waitForTimeout(100);
  assert(/for carp/.test(await page.textContent('.hero h1')), 'picking carp switches the headline: ' + (await page.textContent('.hero h1')));
  assert((await page.textContent('.sectionhead .aside')) === 'Carp', 'the 48-hour chart follows the fish');
  assert((await page.locator('.pickgrid .chip[aria-pressed="true"]').textContent()) === 'Carp', 'picked fish is marked');
  assert(/carp guide/.test(await page.textContent('#view')), 'how-to follows the fish');
  assert((await page.locator('.meter > svg').getAttribute('aria-label')).startsWith('Carp'), 'score picture shows the fish');
  assert(await page.textContent('#view').then((t) => !t.includes('Also on')), 'Also on is gone');
  assert(await page.evaluate(() => { const c = document.querySelector('.pickgrid'), h = [...document.querySelectorAll('.block')].find((b) => b.textContent.includes('How to:')); return !!(h.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'how to fish it comes before the picker');
  const toneOf = (name) => page.locator(`.pickgrid .chip:text-is("${name}")`).evaluate((c) => c.className);
  assert(/pick-off/.test(await toneOf('Wels catfish')), 'protected fish is grey');
  assert(await page.evaluate(() => { const col = (n) => getComputedStyle([...document.querySelectorAll('.pickgrid .chip')].find((c) => c.textContent === n)).color; return col('Wels catfish') !== col('Zander'); }), 'names have different colours');
  assert(new Set(await page.locator('.pickgrid .chip').evaluateAll((a) => a.map((c) => c.className.match(/pick-\w+/)[0]))).size >= 2, 'picker colours vary with the score');
  const carpHow = await page.locator('.howgrid').first().textContent();
  assert(/Canals/.test(carpHow) && /Lakes/.test(carpHow) && /Small water/.test(carpHow), 'how-to gives tips per type of water');
  await shot('10-focus-carp');
  await page.locator('.pickgrid .chip:text-is("Wels catfish")').click();
  await page.waitForTimeout(100);
  assert(/is closed/.test(await page.textContent('.hero h1')), 'catfish shows as closed: ' + (await page.textContent('.hero h1')));
  await noOverflow('focus catfish');
  await page.click('[data-act="focus-clear"]');
  await page.waitForTimeout(100);
  assert(h1 === await page.textContent('.hero h1'), 'back to the top pick');

  // Choose an hour in the strip
  await page.locator('.hr').nth(20).click();
  await page.waitForTimeout(100);
  assert(await page.locator('.backpill[data-act="now"]').count() === 1, 'Back to now is a button');
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(100);
  assert(await page.locator('.viewbar').evaluate((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.top < 80; }), 'way back stays on screen while scrolling');
  await shot('11-viewbar');
  await page.click('[data-act="now"]');

  // Species guide
  await page.locator('#view [data-act="species"]').first().click();
  await page.waitForSelector('#sheet .factor');
  assert(await page.locator('#sheet .factor').count() === 7, 'species guide explains 7 factors');
  await noOverflow('species');
  assert((await page.textContent('#sheet')).includes('official VISplanner app') && await page.locator('#sheet a:has-text("VISplanner")').count() === 0, 'rules show text, no VISplanner button');
  await page.locator('#sheet').evaluate((n) => { n.style.position = 'static'; n.style.overflow = 'visible'; });
  await shot('02-species');
  await page.locator('#sheet').evaluate((n) => { n.style.position = ''; n.style.overflow = ''; });
  await page.click('#sheet [data-act="close"]');

  // No spots or locations anywhere
  assert(await page.locator('[data-tab="spots"]').count() === 0 && await page.locator('.tabs button').count() === 3, 'Spots tab is gone');

  // Log
  await page.click('[data-tab="log"]');
  await noOverflow('log empty');
  await shot('04-log-empty');
  await page.click('[data-act="add-catch"]');
  await page.waitForSelector('#catch-form');
  await page.selectOption('#f-species', 'pike');
  await page.fill('#f-length', '40');
  await page.waitForTimeout(50);
  assert((await page.textContent('#f-advice')).includes('45 cm'), 'warns about undersized pike');
  await page.fill('#f-length', '82');
  await page.fill('#f-weight', '5.2');
  await page.waitForTimeout(50);
  assert(!(await page.textContent('#f-advice')).includes('Under'), 'warning clears for a legal size');
  const png = fs.readFileSync(path.join(root, 'icons/icon-512.png'));
  await page.setInputFiles('#photo-input', { name: 'pike.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#photo-preview:not([hidden])');
  assert(await page.locator('#f-spot').count() === 0 && !(await page.textContent('#catch-form')).includes('Use my location'), 'no spot or location when logging');
  await page.fill('#f-bait', 'Soft shad');
  assert(await page.locator('#f-bait').getAttribute('list') === null, 'bait is free text');
  assert(!(await page.textContent('#catch-form')).includes('What happened'), 'kept or released is gone');
  assert(!(await page.textContent('#f-advice')).includes('Keep at most'), 'no keep limits while logging');
  await page.locator('#sheet').evaluate((n) => { n.style.position = 'static'; n.style.overflow = 'visible'; });
  await shot('05-catch-form');
  await page.locator('#sheet').evaluate((n) => { n.style.position = ''; n.style.overflow = ''; });
  // Impossible entries are stopped with a reason
  await page.fill('#f-length', '400');
  await page.click('#catch-form button[type=submit]');
  await page.waitForFunction(() => !document.querySelector('#f-err').hidden);
  assert((await page.textContent('#f-err')).includes('not realistic'), 'impossible length is refused: ' + (await page.textContent('#f-err')));
  await page.fill('#f-length', '30');
  await page.click('#catch-form button[type=submit]');
  await page.waitForTimeout(100);
  assert((await page.textContent('#f-err')).includes('do not fit'), 'length and weight must fit together');
  await page.fill('#f-length', '82');
  await page.click('#catch-form button[type=submit]');
  await page.waitForSelector('.entry');
  assert((await page.textContent('#toast')).includes('XP'), 'toast: ' + (await page.textContent('#toast')));
  await page.waitForTimeout(200);
  assert(await page.locator('.entry img.thumb').evaluate((i) => i.naturalWidth > 0), 'photo appears in the log');
  await noOverflow('log');
  await shot('06-log');

  // Weather saved with the catch
  await page.click('.entry');
  await page.waitForSelector('#sheet .kv');
  assert(!(await page.textContent('#sheet')).includes('Spot'), 'no spot on the entry');
  const det = await page.textContent('#sheet .kv');
  assert(/Pressure/.test(det) && /Water/.test(det), 'weather saved with the catch');
  await page.click('#sheet [data-act="close"]');

  // Blank trip
  await page.click('[data-act="add-blank"]');
  assert(await page.locator('#b-spot').count() === 0, 'no spot on a blank trip');
  await page.click('#blank-form button[type=submit]');
  await page.waitForTimeout(200);
  assert(await page.locator('.entry').count() === 2, 'trip with no catch saved');

  // Trophies
  await page.click('[data-tab="trophies"]');
  const tr = await page.textContent('#view');
  assert(tr.includes('First Bite') && tr.includes('Pike Over 80'), 'badges awarded');
  assert(await page.locator('.ach.done').count() >= 2, 'badges marked as earned');
  await noOverflow('trophies');
  await shot('07-trophies');

  // Survives reload
  await page.reload();
  await page.waitForSelector('.hero h1, .levelcard');
  await page.click('[data-tab="log"]');
  assert(await page.locator('.entry').count() === 2, 'log survives a reload');

  // Backup and restore
  await page.click('[data-act="settings"]');
  const settingsText = await page.textContent('#sheet');
  assert(settingsText.includes('Privacy') && settingsText.includes('Disclaimer') && settingsText.includes('does not use your location') && !settingsText.includes('Distances from'), 'privacy note and disclaimer are in settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sheet [data-act="export"]')]);
  const bpath = path.join(out, 'backup.json'); await dl.saveAs(bpath);
  const backup = JSON.parse(fs.readFileSync(bpath));
  assert(backup.records.length === 2 && Object.keys(backup.photos).length === 1, 'backup holds entries and photo');
  await shot('08-settings');
  // Delete, then restore
  await page.click('#sheet [data-act="close"]');
  await page.locator('.entry').first().click();
  await page.waitForSelector('#sheet [data-act="ask-delete"]');
  await page.click('#sheet [data-act="ask-delete"]');
  await page.click('#sheet [data-act="confirm-delete"]');
  await page.waitForTimeout(200);
  const left = await page.locator('.entry').count();
  assert(left === 1, 'entry deleted');
  await page.click('[data-act="settings"]');
  await page.setInputFiles('#import-file', bpath);
  await page.waitForTimeout(500);
  assert(await page.locator('.entry').count() === 2, 'backup restored');

  // Permit changes advice
  await page.click('[data-tab="today"]');
  await page.click('[data-act="settings"]');
  await page.click('#sheet [data-act="permit"][data-v="kleine"]');
  await page.click('#sheet [data-act="close"]');
  await page.waitForTimeout(100);
  const klein = await page.textContent('#view');
  assert(!/(Good|Medium|Bad) fishing for (pike|zander)/.test(klein), 'Kleine VISpas does not recommend pike or zander');
  await page.click('[data-act="settings"]');
  await page.click('#sheet [data-act="permit"][data-v="full"]');
  await page.click('#sheet [data-act="close"]');

  // Dark mode
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(150);
  await shot('09-today-dark');
  await page.emulateMedia({ colorScheme: 'light' });

  // Main weather service down: switch to the backup
  openMeteoDown = true;
  await page.click('[data-act="refresh"]');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Backup weather'), null, { timeout: 12000 });
  assert(await page.locator('.hero h1').count() === 1, 'backup weather runs the whole app');
  assert((await page.textContent('.foot')).includes('Deutscher Wetterdienst'), 'backup source is credited');
  openMeteoDown = false;
  await page.click('[data-act="refresh"]');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Live weather'), null, { timeout: 12000 });
  assert(true, 'returns to the main weather service');

  // Weather offline: saved copy
  await page.waitForTimeout(800);
  blockWeather = true;
  await page.click('[data-act="refresh"]');
  await page.waitForTimeout(400);
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('saved'), null, { timeout: 12000 });
  assert(true, 'offline weather message: ' + (await page.textContent('#status')));
  assert(await page.locator('.hero h1').count() === 1, 'keeps showing saved weather');

  // Full offline
  const swReady = await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true));
  assert(swReady, 'offline worker installed');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.hero h1');
  assert(true, 'app opens with no connection');
  await ctx.setOffline(false);

  assert(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close(); server.close();
  console.log('\nAll browser checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
