/* Run with: node test/engine.test.js */
const assert = require('assert');
const D = require('../data.js');
const E = require('../engine.js');

const HOUR = 36e5, DAY = 864e5;
function makeWeather(now, o = {}) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 2);
  const time = [], n = 24 * 6;
  for (let i = 0; i < n; i++) time.push(start.getTime() + i * HOUR);
  const f = (v) => time.map((t, i) => (typeof v === 'function' ? v(t, i) : v));
  const sun = {};
  for (let i = 0; i < 6; i++) { const d = new Date(start.getTime() + i * DAY); const k = E.dateKey(d); const b = new Date(d); b.setHours(7, 30, 0, 0); const s = new Date(d); s.setHours(17, 0, 0, 0); sun[k] = { rise: b.getTime(), set: s.getTime() }; }
  const days = [], means = [];
  for (let i = -60; i <= 3; i++) { const d = new Date(now); d.setDate(d.getDate() + i); days.push(E.dateKey(d)); means.push(o.mean === undefined ? 12 : o.mean); }
  return { fetchedAt: now, hourly: { time, temp: f(o.air ?? 12), feels: f(o.air ?? 11), dew: f(8), rh: f(80), precip: f(o.precip ?? 0), pprob: f(10), code: f(o.code ?? 3), cloud: f(o.cloud ?? 80), press: f(o.press ?? 1015), wind: f(o.wind ?? 14), gust: f(o.gust ?? 25), dir: f(o.dir ?? 270), vis: f(20000), uv: f(1), rad: f(100) }, sun, dailyTimes: days, dailyMeans: means, current: null, sst: null };
}
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }

test('last Saturday of May', () => {
  assert.strictEqual(E.lastSaturdayOfMay(2026).getDate(), 30);
  assert.strictEqual(E.lastSaturdayOfMay(2027).getDate(), 29);
  assert.strictEqual(E.lastSaturdayOfMay(2025).getDate(), 31);
});
test('closed seasons match the Veldgids dates', () => {
  const s = (id) => E.speciesById(id);
  assert.strictEqual(E.closedStatus(s('pike'), at(2026, 2, 28)).closed, false);
  assert.strictEqual(E.closedStatus(s('pike'), at(2026, 3, 1)).closed, true);
  assert.strictEqual(E.closedStatus(s('pike'), at(2026, 5, 30)).closed, true);
  assert.strictEqual(E.closedStatus(s('pike'), at(2026, 5, 31)).closed, false);
  assert.strictEqual(E.closedStatus(s('zander'), at(2026, 3, 31)).closed, false);
  assert.strictEqual(E.closedStatus(s('zander'), at(2026, 4, 1)).closed, true);
  assert.strictEqual(E.closedStatus(s('perch'), at(2026, 5, 1)).closed, true);
  assert.strictEqual(E.closedStatus(s('ide'), at(2026, 5, 31)).closed, true);
  assert.strictEqual(E.closedStatus(s('ide'), at(2026, 6, 1)).closed, false);
  assert.strictEqual(E.closedStatus(s('catfish'), at(2026, 8, 1)).closed, true);
  assert.strictEqual(E.closedStatus(s('roach'), at(2026, 4, 15)).closed, false);
  assert.strictEqual(E.baitClosed(at(2026, 4, 1)), true);
  assert.strictEqual(E.baitClosed(at(2026, 5, 31)), false);
});
test('night period: 2 h after sunset to 1 h before sunrise', () => {
  const rise = at(2026, 11, 2, 7), set = at(2026, 11, 2, 17), next = at(2026, 11, 3, 7);
  assert.strictEqual(E.isNightPeriod(at(2026, 11, 2, 18), rise, set, next), false);
  assert.strictEqual(E.isNightPeriod(at(2026, 11, 2, 20), rise, set, next), true);
  assert.strictEqual(E.isNightPeriod(at(2026, 11, 2, 5), rise, set, next), true);
  assert.strictEqual(E.isNightPeriod(at(2026, 11, 2, 6, 30), rise, set, next), false);
});
test('water temperature follows the air slowly', () => {
  const times = [], means = [];
  for (let i = 0; i < 40; i++) { const d = new Date(2026, 9, i + 1); times.push(E.dateKey(d)); means.push(i < 20 ? 18 : 6); }
  const fast = E.waterSeries(times, means, .2), slow = E.waterSeries(times, means, .07), last = times[times.length - 1], mid = times[24];
  assert.ok(fast[mid] < slow[mid]);
  assert.ok(fast[last] > 6 && fast[last] < 7);
  assert.ok(slow[last] > 8);
});
test('water temperature ignores missing days at the start', () => {
  const s = E.waterSeries(['a', 'b', 'c'], [null, 10, 12], .1);
  assert.strictEqual(s.a, undefined);
  assert.strictEqual(s.b, 10);
});
test('a thermometer reading corrects the estimate and fades', () => {
  const now = at(2026, 11, 2);
  const w = makeWeather(now);
  const base = E.waterAt(w, now, 'shipcanal');
  const fixed = E.waterAt(w, now, 'shipcanal', { ts: now, temp: base + 3 });
  const later = E.waterAt(w, now + 3 * DAY, 'shipcanal', { ts: now, temp: base + 3 });
  assert.ok(Math.abs(fixed - (base + 3)) < .01);
  assert.ok(later - base < 3 && later - base > 0.5);
});
test('pressure classes', () => {
  assert.strictEqual(E.pressClass(-5), 'crash');
  assert.strictEqual(E.pressClass(-1.5), 'falling');
  assert.strictEqual(E.pressClass(.2), 'steady');
  assert.strictEqual(E.pressClass(2), 'rising');
  assert.strictEqual(E.pressClass(4), 'jump');
});
test('Beaufort and compass', () => {
  assert.strictEqual(E.beaufort(14), 3);
  assert.strictEqual(E.beaufort(40), 6);
  assert.strictEqual(E.compass(11), 'N');
  assert.strictEqual(E.compass(225), 'SW');
});
test('moon phase near a known full moon', () => {
  const m = E.moon(Date.UTC(2026, 9, 26, 4, 12));
  assert.ok(m.illum > .97, 'illum ' + m.illum);
});

const score = (id, t, o, settings) => { const w = makeWeather(t, o); return E.scoreSpecies(E.speciesById(id), E.conditionsAt(w, t), settings); };
test('autumn pike at dusk beats midsummer-style carp in cold water', () => {
  const pike = score('pike', at(2026, 11, 2, 16), { mean: 11 });
  const carp = score('carp', at(2026, 11, 2, 16), { mean: 11 });
  const tench = score('tench', at(2026, 11, 2, 16), { mean: 11 });
  assert.ok(pike.score >= 62, 'pike ' + pike.score);
  assert.ok(carp.score < pike.score);
  assert.ok(tench.score < 45, 'tench ' + tench.score);
});
test('summer tench at dawn scores well', () => {
  const r = score('tench', at(2026, 6, 20, 7), { mean: 18, wind: 3, cloud: 60 });
  assert.ok(r.score >= 65, 'tench ' + r.score);
});
test('zander scores better at dusk than bright midday', () => {
  const dusk = score('zander', at(2026, 10, 10, 17), { mean: 13, cloud: 20 });
  const noon = score('zander', at(2026, 10, 10, 12), { mean: 13, cloud: 5 });
  assert.ok(dusk.score > noon.score + 10, `${dusk.score} vs ${noon.score}`);
});
test('scores use the whole range', () => {
  const low = score('tench', at(2026, 1, 15, 12), { mean: 2, air: 1, wind: 45, cloud: 5 }).score;
  const high = score('pike', at(2026, 10, 15, 8), { mean: 12, wind: 14, cloud: 80 }).score;
  assert.ok(low < 15, 'low ' + low);
  assert.ok(high >= 72, 'high ' + high);
});
test('scores change smoothly from hour to hour', () => {
  const day = at(2026, 11, 2, 0), w = makeWeather(day, { mean: 11 });
  let prev = null;
  for (let h = 6; h < 22; h++) {
    const v = E.scoreSpecies(E.speciesById('zander'), E.conditionsAt(w, at(2026, 11, 2, h))).score;
    if (prev !== null) assert.ok(Math.abs(v - prev) <= 12, `hour ${h}: ${prev} to ${v}`);
    prev = v;
  }
});
test('Excellent needs most things going right', () => {
  const steady = score('zander', at(2026, 11, 2, 17), { mean: 11 }).score;
  assert.ok(steady >= 62 && steady < 80, 'steady dusk ' + steady);
  const midday = score('zander', at(2026, 11, 2, 12), { mean: 11, cloud: 10 }).score;
  assert.ok(midday < 62, 'midday ' + midday);
});
test('thunder, gale and ice cap the score', () => {
  assert.ok(score('pike', at(2026, 10, 15, 8), { mean: 12, code: 95 }).score <= 15);
  assert.ok(score('pike', at(2026, 10, 15, 8), { mean: 12, wind: 70 }).score <= 20);
  assert.ok(score('pike', at(2026, 1, 15, 8), { mean: -2, air: -4 }).score <= 12);
});
test('closed species and blocked methods are never recommended', () => {
  assert.strictEqual(score('pike', at(2026, 4, 10, 8), { mean: 10 }).recommended, false);
  assert.strictEqual(score('catfish', at(2026, 7, 10, 22), { mean: 22 }).recommended, false);
  assert.strictEqual(score('eel', at(2026, 7, 10, 23), { mean: 22 }).recommended, false);
  assert.strictEqual(score('pike', at(2026, 10, 10, 8), { mean: 12 }, { permit: 'kleine' }).recommended, false);
  assert.strictEqual(score('roach', at(2026, 10, 10, 23), { mean: 12 }, { permit: 'kleine' }).recommended, false);
  assert.strictEqual(score('roach', at(2026, 10, 10, 23), { mean: 12 }, { permit: 'vispas' }).recommended, false);
  assert.strictEqual(score('roach', at(2026, 10, 10, 23), { mean: 12 }, { permit: 'full' }).recommended, true);
});
test('lure advice is swapped during the closed bait period', () => {
  const t = at(2026, 4, 20, 9), c = E.conditionsAt(makeWeather(t, { mean: 10 }), t);
  assert.match(E.howTo(E.speciesById('perch'), c).rig, /not allowed/);
});
test('all spots are within 20 km and have a valid type', () => {
  for (const s of D.SPOTS) {
    assert.ok(D.WATER_TYPES[s.type], s.id);
    const km = E.distanceKm(D.CENTER, s);
    assert.ok(km <= 20.5, s.id + ' ' + km);
  }
  assert.strictEqual(new Set(D.SPOTS.map((s) => s.id)).size, D.SPOTS.length);
});
test('Kleine VISpas only shows listed waters', () => {
  const t = at(2026, 10, 10, 9), c = E.conditionsAt(makeWeather(t), t);
  const rows = E.rankSpots(E.speciesById('roach'), c, D.SPOTS, { settings: { permit: 'kleine' } });
  assert.ok(rows.length > 10);
  assert.ok(rows.every((r) => r.spot.status === 'listed'));
});
test('hard wind moves the choice to sheltered water', () => {
  const t = at(2026, 10, 10, 9), sp = E.speciesById('pike');
  const calm = E.rankSpots(sp, E.conditionsAt(makeWeather(t, { wind: 12 }), t), D.SPOTS, {});
  const gale = E.rankSpots(sp, E.conditionsAt(makeWeather(t, { wind: 48 }), t), D.SPOTS, {});
  const lakeRank = (rows) => rows.findIndex((r) => r.spot.id === 'paterswoldsemeer');
  assert.ok(lakeRank(gale) > lakeRank(calm));
  assert.ok(['harbour', 'diep'].includes(gale[0].spot.type), gale[0].spot.id);
});
test('wind advice names the bank the wind blows into', () => {
  assert.match(E.windAdvice({ wind: 15, dir: 270 }), /from the W pushes .* towards the E/);
});

function trip(day, spotId, speciesId, cond) {
  return { id: spotId + day + speciesId, type: speciesId ? 'catch' : 'blank', ts: at(2026, 9, day, 9), spotId, speciesId, cond };
}
test('trips group by day and spot', () => {
  const g = E.groupTrips([trip(1, 'a', 'pike', {}), trip(1, 'a', 'perch', {}), trip(1, 'b', null, {}), trip(2, 'a', 'pike', {})]);
  assert.strictEqual(g.length, 3);
  assert.strictEqual(g.find((t) => t.key.endsWith('|a') && t.caught.size === 2).catches, 2);
});
test('no personal adjustment until there are enough trips', () => {
  const trips = E.groupTrips([trip(1, 'a', 'pike', { water: 12, pressClass: 'steady', daypart: 'dawn', windClass: 'breeze' })]);
  assert.strictEqual(E.personalAdjust('pike', { water: 12, pressClass: 'steady', daypart: 'dawn', wind: 12 }, trips).points, 0);
});
test('your log raises matching conditions and lowers bad ones', () => {
  const good = { water: 12, pressClass: 'falling', daypart: 'dawn', windClass: 'breeze' };
  const bad = { water: 12, pressClass: 'jump', daypart: 'day', windClass: 'calm' };
  const recs = [];
  for (let d = 1; d <= 15; d++) recs.push(trip(d, 'a', 'pike', good));
  for (let d = 16; d <= 30; d++) recs.push(trip(d, 'a', null, bad));
  const trips = E.groupTrips(recs);
  const up = E.personalAdjust('pike', { water: 12, pressClass: 'falling', daypart: 'dawn', wind: 12 }, trips);
  const down = E.personalAdjust('pike', { water: 12, pressClass: 'jump', daypart: 'day', wind: 3 }, trips);
  assert.ok(up.points > 3, 'up ' + up.points);
  assert.ok(down.points < -3, 'down ' + down.points);
  assert.ok(Math.abs(up.points) <= 15 && Math.abs(down.points) <= 15);
});
test('weekly streak', () => {
  const now = at(2026, 11, 2);
  const recs = [0, 7, 14].map((d, i) => ({ id: 'r' + i, type: 'blank', ts: now - d * DAY }));
  assert.strictEqual(E.weekStreak(recs, now), 3);
  assert.strictEqual(E.bestStreak(recs), 3);
  assert.strictEqual(E.weekStreak(recs, now + 21 * DAY), 0);
});
test('XP, new species, personal bests and achievements', () => {
  const recs = [
    { id: 'a', type: 'catch', ts: at(2026, 10, 1), speciesId: 'pike', lengthCm: 60, spotId: 's1' },
    { id: 'b', type: 'catch', ts: at(2026, 10, 1, 13), speciesId: 'pike', lengthCm: 85, spotId: 's1', hasPhoto: true },
    { id: 'c', type: 'catch', ts: at(2026, 10, 1, 14), speciesId: 'zander', lengthCm: 50, spotId: 's1' },
    { id: 'd', type: 'catch', ts: at(2026, 10, 1, 15), speciesId: 'perch', lengthCm: 25, spotId: 's1' },
    { id: 'e', type: 'blank', ts: at(2026, 10, 2), spotId: 's2' }
  ];
  const p = E.computeProgress(recs);
  const ids = p.earned.map((a) => a.id);
  ['first', 'three', 'slam', 'pike80'].forEach((id) => assert.ok(ids.includes(id), id));
  assert.ok(!ids.includes('metre'));
  assert.strictEqual(p.annotated.a.newSpecies, true);
  assert.strictEqual(p.annotated.b.pb, true);
  assert.strictEqual(p.annotated.e.xp, 25);
  assert.ok(p.xp > 500);
  assert.ok(p.level >= 3);
});
test('catch form warnings', () => {
  const summer = at(2026, 8, 1);
  assert.ok(E.catchAdvice(E.speciesById('pike'), 40, summer).some((a) => /45 cm/.test(a.text)));
  assert.ok(E.catchAdvice(E.speciesById('pike'), 60, summer).some((a) => /at most 1/.test(a.text)));
  assert.ok(E.catchAdvice(E.speciesById('eel'), 60, summer).some((a) => /straight back/.test(a.text)));
  assert.ok(E.catchAdvice(E.speciesById('pike'), 60, at(2026, 4, 1)).some((a) => /closed/i.test(a.text)));
});
test('best window finds legal hours only', () => {
  const t = at(2026, 10, 10, 12), w = makeWeather(t, { mean: 13 });
  const r = E.bestWindow(w, 'zander', t, 36, { settings: { permit: 'vispas' } });
  assert.ok(r.best);
  assert.ok(r.rows.find((x) => x.t === r.best.peak).ok);
  assert.ok(r.best.to > r.best.from);
});
test('parses the real response shape', () => {
  const fc = { current: { time: '2026-11-02T14:45', temperature_2m: 13.3, pressure_msl: 1030.8, wind_speed_10m: 13.7, wind_direction_10m: 11, weather_code: 3 },
    hourly: { time: ['2026-11-02T14:00', '2026-11-02T15:00'], temperature_2m: [13, 13.2], apparent_temperature: [11, 11], dew_point_2m: [8, 8], relative_humidity_2m: [70, 70], precipitation: [0, 0], precipitation_probability: [0, 0], weather_code: [3, 3], cloud_cover: [90, 90], pressure_msl: [1030, 1030.5], wind_speed_10m: [13, 13], wind_gusts_10m: [20, 20], wind_direction_10m: [10, 12], visibility: [20000, 20000], uv_index: [0, 0], shortwave_radiation: [50, 40] },
    daily: { time: ['2026-11-02'], sunrise: ['2026-11-02T07:33'], sunset: ['2026-11-02T17:00'], temperature_2m_mean: [11.3] } };
  const hist = { daily: { time: ['2026-11-01', '2026-11-02'], temperature_2m_mean: [null, 11.3] } };
  const w = E.parseWeather(fc, hist, { current: { sea_surface_temperature: 12.4 } }, 1);
  assert.strictEqual(w.current.press, 1030.8);
  assert.strictEqual(w.sst, 12.4);
  const c = E.conditionsAt(w, w.current.t);
  assert.strictEqual(c.air, 13.3);
  assert.strictEqual(c.isNow, true);
  assert.strictEqual(c.daypart, 'day');
});
test('sunrise and sunset match the weather service for Groningen', () => {
  const sun = E.sunTimes(at(2026, 11, 2), D.CENTER.lat, D.CENTER.lon);
  const near = (ms, h, m) => { const d = new Date(ms); return Math.abs(d.getHours() * 60 + d.getMinutes() - (h * 60 + m)); };
  const tzShift = -new Date(at(2026, 11, 2)).getTimezoneOffset() - 60;
  assert.ok(near(sun.rise - tzShift * 6e4, 7, 33) <= 3, 'rise ' + new Date(sun.rise));
  assert.ok(near(sun.set - tzShift * 6e4, 17, 0) <= 3, 'set ' + new Date(sun.set));
});
test('backup source converts into the same weather shape', () => {
  const mk = (h, o) => ({ timestamp: new Date(2026, 10, 2, h).toISOString(), temperature: 12, dew_point: 8, relative_humidity: null, precipitation: 0.1, precipitation_probability: 15, cloud_cover: 84, pressure_msl: 1030.8, wind_speed: 16.7, wind_gust_speed: 29.6, wind_direction: 358, visibility: 70900, solar: 0.136, condition: 'dry', ...o });
  const fc = { weather: [mk(13), mk(14, { pressure_msl: null }), mk(15, { condition: 'thunderstorm' })] };
  const hist = { weather: [{ timestamp: new Date(2026, 10, 1, 12).toISOString(), temperature: 10 }] };
  const b = E.fromBrightSky(fc, hist, D.CENTER.lat, D.CENTER.lon);
  assert.deepStrictEqual(b.history.daily.time.length, 2);
  const w = E.parseWeather(b.forecast, b.history, null);
  assert.strictEqual(w.hourly.press[1], 1030.8);
  assert.ok(w.hourly.rh[0] > 60 && w.hourly.rh[0] < 90);
  assert.strictEqual(w.hourly.code[2], 95);
  assert.strictEqual(w.hourly.code[0], 3);
  assert.strictEqual(w.current, null);
  const c = E.conditionsAt(w, new Date(2026, 10, 2, 13).getTime());
  assert.strictEqual(c.air, 12);
  assert.ok(c.feels <= 12);
  assert.ok(c.water > 10);
});
console.log(`\n${passed} tests passed`);
