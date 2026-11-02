/* Stek engine: all the fishing logic, with no page code, so it can be tested on its own. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.StekEngine = factory(root.StekData);
})(typeof self !== 'undefined' ? self : this, function (D) {
  const HOUR = 36e5, DAY = 864e5;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const dateKey = (d) => {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  };
  const speciesById = (id) => D.SPECIES.find((s) => s.id === id);

  /* ---------- Rules ---------- */
  function lastSaturdayOfMay(year) {
    const d = new Date(year, 4, 31, 12);
    d.setDate(31 - ((d.getDay() + 1) % 7));
    return d;
  }
  function inRange(date, m1, d1, endDate) {
    const start = new Date(date.getFullYear(), m1 - 1, d1).getTime();
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).getTime();
    return date.getTime() >= start && date.getTime() <= end;
  }
  function baitClosed(date) {
    const d = new Date(date);
    return inRange(d, 4, 1, lastSaturdayOfMay(d.getFullYear()));
  }
  function closedStatus(sp, date) {
    const d = new Date(date), y = d.getFullYear(), rule = sp.rules && sp.rules.closed;
    if (!rule) return { closed: false };
    const lastSat = lastSaturdayOfMay(y);
    const fmt = (x) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    if (rule === 'allyear') return { closed: true, text: 'Closed all year' };
    if (rule === 'pike' && inRange(d, 3, 1, lastSat)) return { closed: true, text: 'Closed until ' + fmt(lastSat) };
    if (rule === 'zander' && inRange(d, 4, 1, lastSat)) return { closed: true, text: 'Closed until ' + fmt(lastSat) };
    if (rule === 'ide' && inRange(d, 4, 1, new Date(y, 4, 31))) return { closed: true, text: 'Closed until 31 May' };
    return { closed: false };
  }
  function isNightPeriod(t, sunrise, sunset, nextSunrise) {
    /* Two hours after sunset until one hour before sunrise. */
    return t < sunrise - HOUR || (t > sunset + 2 * HOUR && (!nextSunrise || t < nextSunrise - HOUR));
  }
  function legalCheck(sp, cond, settings) {
    const permit = (settings && settings.permit) || 'full';
    const notes = [], closed = closedStatus(sp, cond.t);
    let legal = true, method = true;
    if (closed.closed) { legal = false; notes.push(closed.text); }
    if (permit === 'kleine' && !sp.kleine) { method = false; notes.push('Not possible with the Kleine VISpas baits'); }
    if (cond.night && permit === 'kleine') { method = false; notes.push('No night fishing with the Kleine VISpas'); }
    if (cond.night && permit === 'vispas') { method = false; notes.push('Needs NachtVIS permission'); }
    return { legal, method, notes, ok: legal && method };
  }

  /* ---------- Small weather helpers ---------- */
  function beaufort(kmh) {
    const steps = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
    for (let i = 0; i < steps.length; i++) if (kmh < steps[i]) return i;
    return 12;
  }
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = (deg) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  function weatherText(code) {
    if (code === 0) return 'Clear';
    if (code === 1) return 'Mostly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code === 45 || code === 48) return 'Fog';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code >= 85 && code <= 86) return 'Snow showers';
    if (code >= 95) return 'Thunderstorm';
    return 'Unknown';
  }
  function moon(date) {
    const synodic = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
    const age = (((new Date(date).getTime() - ref) / DAY) % synodic + synodic) % synodic;
    const phase = age / synodic;
    const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    return { age, phase, illum, name: names[Math.round(phase * 8) % 8] };
  }

  /* ---------- Backup weather source (Bright Sky / DWD) ---------- */
  function sunTimes(ms, lat, lon) {
    /* NOAA sunrise equation, good to about a minute at this latitude. */
    const d = new Date(ms), rad = Math.PI / 180;
    const noonUTC = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    const n = Math.round(noonUTC / DAY + 2440587.5 - 2451545.0 + 0.0008 - .5);
    const J = n - lon / 360;
    const M = (357.5291 + 0.98560028 * J) % 360;
    const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
    const L = (M + C + 180 + 102.9372) % 360;
    const transit = 2451545.0 + J + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
    const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
    const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec))) / rad;
    const toMs = (jd) => (jd - 2440587.5) * DAY;
    return { rise: toMs(transit - w / 360), set: toMs(transit + w / 360) };
  }
  function feelsLike(t, v) {
    if (t === null || v === null || t === undefined || v === undefined) return t;
    if (t <= 10 && v > 4.8) { const p = Math.pow(v, .16); return 13.12 + .6215 * t - 11.37 * p + .3965 * t * p; }
    return t;
  }
  function humidityFrom(t, dew) {
    if (t === null || dew === null || t === undefined || dew === undefined) return null;
    const m = (x) => Math.exp((17.625 * x) / (243.04 + x));
    return clamp(100 * m(dew) / m(t), 0, 100);
  }
  function conditionCode(row) {
    const c = row.cloud_cover === null || row.cloud_cover === undefined ? 50 : row.cloud_cover;
    switch (row.condition) {
      case 'thunderstorm': return 95;
      case 'rain': return 61;
      case 'sleet': return 66;
      case 'snow': return 71;
      case 'hail': return 77;
      case 'fog': return 45;
      default: return c < 10 ? 0 : c < 35 ? 1 : c < 75 ? 2 : 3;
    }
  }
  function fromBrightSky(forecastJson, historyJson, lat, lon) {
    const rows = [...forecastJson.weather].filter((r) => r.timestamp).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const hourly = { time: [], temperature_2m: [], apparent_temperature: [], dew_point_2m: [], relative_humidity_2m: [], precipitation: [], precipitation_probability: [], weather_code: [], cloud_cover: [], pressure_msl: [], wind_speed_10m: [], wind_gusts_10m: [], wind_direction_10m: [], visibility: [], uv_index: [], shortwave_radiation: [] };
    const days = new Set();
    rows.forEach((r) => {
      const ms = new Date(r.timestamp).getTime();
      hourly.time.push(ms);
      hourly.temperature_2m.push(r.temperature);
      hourly.apparent_temperature.push(feelsLike(r.temperature, r.wind_speed));
      hourly.dew_point_2m.push(r.dew_point);
      hourly.relative_humidity_2m.push(r.relative_humidity !== null && r.relative_humidity !== undefined ? r.relative_humidity : humidityFrom(r.temperature, r.dew_point));
      hourly.precipitation.push(r.precipitation || 0);
      hourly.precipitation_probability.push(r.precipitation_probability || 0);
      hourly.weather_code.push(conditionCode(r));
      hourly.cloud_cover.push(r.cloud_cover);
      hourly.pressure_msl.push(r.pressure_msl);
      hourly.wind_speed_10m.push(r.wind_speed);
      hourly.wind_gusts_10m.push(r.wind_gust_speed);
      hourly.wind_direction_10m.push(r.wind_direction);
      hourly.visibility.push(r.visibility);
      hourly.uv_index.push(null);
      hourly.shortwave_radiation.push(r.solar === null || r.solar === undefined ? 0 : r.solar * 1000);
      days.add(dateKey(ms));
    });
    const daily = { time: [], sunrise: [], sunset: [] };
    [...days].sort().forEach((k) => {
      const [y, m, d] = k.split('-').map(Number), sun = sunTimes(new Date(y, m - 1, d, 12).getTime(), lat, lon);
      daily.time.push(k); daily.sunrise.push(sun.rise); daily.sunset.push(sun.set);
    });
    const sums = {};
    [].concat(historyJson && historyJson.weather ? historyJson.weather : [], rows).forEach((r) => {
      if (r.temperature === null || r.temperature === undefined) return;
      const k = dateKey(new Date(r.timestamp).getTime()), e = sums[k] = sums[k] || { n: 0, sum: 0 };
      e.n++; e.sum += r.temperature;
    });
    const hist = Object.keys(sums).sort();
    return {
      forecast: { hourly, daily },
      history: { daily: { time: hist, temperature_2m_mean: hist.map((k) => sums[k].sum / sums[k].n) } }
    };
  }

  /* ---------- Parse the weather service's response ---------- */
  function filled(arr) {
    /* Carry the last known value over any gaps, so one missing hour cannot break a trend. */
    if (!arr) return arr;
    const out = arr.slice();
    let last = out.find((v) => v !== null && v !== undefined);
    if (last === undefined) return out;
    for (let i = 0; i < out.length; i++) { if (out[i] === null || out[i] === undefined) out[i] = last; else last = out[i]; }
    return out;
  }
  function parseWeather(forecast, history, marine, now) {
    const h = forecast.hourly, time = h.time.map((s) => new Date(s).getTime());
    const hist = (history && history.daily) || {};
    const fd = forecast.daily;
    const sun = {};
    fd.time.forEach((k, i) => { sun[k] = { rise: new Date(fd.sunrise[i]).getTime(), set: new Date(fd.sunset[i]).getTime() }; });
    const c = forecast.current || {};
    return {
      fetchedAt: now || Date.now(),
      hourly: {
        time, temp: filled(h.temperature_2m), feels: filled(h.apparent_temperature), dew: filled(h.dew_point_2m), rh: filled(h.relative_humidity_2m),
        precip: h.precipitation, pprob: h.precipitation_probability, code: filled(h.weather_code), cloud: filled(h.cloud_cover),
        press: filled(h.pressure_msl), wind: filled(h.wind_speed_10m), gust: filled(h.wind_gusts_10m), dir: filled(h.wind_direction_10m),
        vis: filled(h.visibility), uv: h.uv_index, rad: h.shortwave_radiation
      },
      sun,
      dailyTimes: hist.time || fd.time,
      dailyMeans: hist.temperature_2m_mean || fd.temperature_2m_mean || [],
      current: c.time ? {
        t: new Date(c.time).getTime(), temp: c.temperature_2m, feels: c.apparent_temperature, rh: c.relative_humidity_2m,
        precip: c.precipitation, code: c.weather_code, cloud: c.cloud_cover, press: c.pressure_msl,
        wind: c.wind_speed_10m, gust: c.wind_gusts_10m, dir: c.wind_direction_10m
      } : null,
      sst: marine && marine.current ? marine.current.sea_surface_temperature : null
    };
  }

  /* ---------- Water temperature estimate ---------- */
  function waterSeries(times, means, k) {
    const out = {};
    let w = null;
    for (let i = 0; i < times.length; i++) {
      const a = means[i];
      if (a === null || a === undefined) { if (w !== null) out[times[i]] = w; continue; }
      if (w === null) w = a; else w = w + k * (a - w);
      w = Math.max(0.3, w);
      out[times[i]] = w;
    }
    return out;
  }
  function waterAt(weather, t, type, measure) {
    const k = (D.WATER_TYPES[type] || D.WATER_TYPES.shipcanal).k;
    const series = waterSeries(weather.dailyTimes, weather.dailyMeans, k);
    const read = (ms) => {
      const d = new Date(ms), key = dateKey(d);
      const prev = series[dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))];
      const cur = series[key];
      if (cur === undefined) return prev === undefined ? null : prev;
      if (prev === undefined) return cur;
      const frac = (d.getHours() + d.getMinutes() / 60) / 24;
      return prev + (cur - prev) * frac;
    };
    let v = read(t);
    if (v === null) return null;
    if (measure && typeof measure.temp === 'number' && t >= measure.ts) {
      const base = read(measure.ts);
      if (base !== null) v = v + (measure.temp - base) * Math.exp(-(t - measure.ts) / (5 * DAY));
    }
    return Math.max(0.3, v);
  }

  function pressClass(d3) {
    if (d3 <= -4) return 'crash';
    if (d3 <= -1) return 'falling';
    if (d3 < 1) return 'steady';
    if (d3 < 3) return 'rising';
    return 'jump';
  }
  const PRESS_TEXT = { crash: 'Falling fast', falling: 'Falling', steady: 'Steady', rising: 'Rising', jump: 'Rising fast' };
  const windClass = (w) => (w < 8 ? 'calm' : w <= 22 ? 'breeze' : w <= 35 ? 'fresh' : 'hard');
  const tempBand = (w) => Math.floor(w / 4) * 4;

  /* ---------- Conditions at one moment ---------- */
  function conditionsAt(weather, t, opts) {
    opts = opts || {};
    const H = weather.hourly;
    let idx = 0, best = Infinity;
    for (let i = 0; i < H.time.length; i++) {
      const d = Math.abs(H.time[i] - t);
      if (d < best) { best = d; idx = i; }
    }
    const at = (arr, i) => (arr && i >= 0 && i < arr.length ? arr[i] : null);
    const hoursAgo = (n) => Math.max(0, idx - n);
    const key = dateKey(t);
    const sun = weather.sun[key] || Object.values(weather.sun)[0];
    const tomorrow = weather.sun[dateKey(new Date(t + DAY))];
    const c = {
      t, idx,
      air: at(H.temp, idx), feels: at(H.feels, idx), dew: at(H.dew, idx), rh: at(H.rh, idx),
      precip: at(H.precip, idx), pprob: at(H.pprob, idx), code: at(H.code, idx), cloud: at(H.cloud, idx),
      press: at(H.press, idx), wind: at(H.wind, idx), gust: at(H.gust, idx), dir: at(H.dir, idx),
      vis: at(H.vis, idx), uv: at(H.uv, idx), rad: at(H.rad, idx)
    };
    const cur = weather.current;
    c.isNow = cur && Math.abs(t - cur.t) < 45 * 60 * 1000;
    if (c.isNow) ['air', 'feels', 'rh', 'precip', 'code', 'cloud', 'press', 'wind', 'gust', 'dir'].forEach((f) => {
      const src = f === 'air' ? 'temp' : f;
      if (cur[src] !== undefined && cur[src] !== null) c[f] = cur[src];
    });
    c.d3 = c.press - at(H.press, hoursAgo(3));
    c.d24 = c.press - at(H.press, hoursAgo(24));
    c.pressClass = pressClass(c.d3);
    c.windClass = windClass(c.wind);
    c.sunrise = sun.rise; c.sunset = sun.set;
    const toRise = t - sun.rise, toSet = t - sun.set;
    if (toRise >= -HOUR && toRise <= 2 * HOUR) c.daypart = 'dawn';
    else if (toSet >= -2 * HOUR && toSet <= HOUR) c.daypart = 'dusk';
    else if (t > sun.rise && t < sun.set) c.daypart = 'day';
    else c.daypart = 'night';
    c.night = isNightPeriod(t, sun.rise, sun.set, tomorrow && tomorrow.rise);
    c.water = waterAt(weather, t, opts.type || 'shipcanal', opts.measure);
    const w3 = waterAt(weather, t - 3 * DAY, opts.type || 'shipcanal', opts.measure);
    c.waterTrend = c.water !== null && w3 !== null ? c.water - w3 : 0;
    c.tempBand = c.water === null ? null : tempBand(c.water);
    c.moon = moon(t);
    c.thunder = c.code >= 95;
    c.ice = c.water !== null && c.water < 1.5 && c.air < 1;
    return c;
  }

  /* ---------- Bite score ---------- */
  function trapezoid(x, a, b, c, d) {
    if (x <= a || x >= d) return 0;
    if (x < b) return (x - a) / (b - a);
    if (x <= c) return 1;
    return (d - x) / (d - c);
  }
  const WEIGHTS = { temp: .3, light: .2, pressure: .15, season: .12, wind: .1, trend: .08, rain: .05 };

  function factorValues(sp, c) {
    const out = {};
    const w = c.water === null ? 10 : c.water;
    out.temp = .06 + .94 * trapezoid(w, sp.temp[0], sp.temp[1], sp.temp[2], sp.temp[3]);
    /* Light fades in and out around sunrise and sunset, so scores do not jump between hours. */
    let dayLight = sp.light.day + (c.cloud / 100) * sp.cloud;
    if (w < 8 && sp.light.night < .5) dayLight += .15; /* the warmest hours are worth fishing in cold water */
    if (w > 20) dayLight -= .1;
    dayLight = clamp(dayLight);
    const rise = c.sunrise, set = c.sunset, t = c.t;
    const dawn = trapezoid(t, rise - 1.5 * HOUR, rise - .5 * HOUR, rise + HOUR, rise + 2.5 * HOUR);
    const dusk = trapezoid(t, set - 3 * HOUR, set - HOUR, set + .5 * HOUR, set + 1.5 * HOUR);
    const rest = clamp(1 - dawn - dusk);
    const base0 = t > rise && t < set ? dayLight : sp.light.night;
    out.light = clamp(dawn * sp.light.dawn + dusk * sp.light.dusk + rest * base0);
    const base = { crash: .4, falling: .85, steady: .6, rising: .45, jump: .3 }[c.pressClass];
    let press = .6 + (base - .6) * sp.press;
    if (c.press > 1025 && c.cloud < 25) press -= .1 * sp.press;
    if (c.d24 > 8) press -= .1 * sp.press;
    out.pressure = clamp(press);
    out.season = sp.months[new Date(c.t).getMonth()];
    const v = c.wind;
    out.wind = v < 8 ? sp.calm + (1 - sp.calm) * (v / 8) : v <= 22 ? 1 : v <= 35 ? 1 - .55 * (v - 22) / 13 : v <= 50 ? .45 - .35 * (v - 35) / 15 : .05;
    let trend = .6;
    if (w < 12) trend += c.waterTrend * .15;
    else if (w > 22) trend -= c.waterTrend * .1;
    else trend += c.waterTrend * .05;
    if (c.waterTrend < -2) trend = Math.min(trend, .3);
    out.trend = clamp(trend, .15, 1);
    const p = c.precip || 0;
    out.rain = c.thunder ? 0 : p < .1 ? .7 : p <= 1.5 ? sp.rain : p <= 4 ? .5 : .25;
    return out;
  }

  function scoreSpecies(sp, c, settings, personal) {
    const f = factorValues(sp, c);
    let raw = 0;
    for (const k in WEIGHTS) raw += WEIGHTS[k] * f[k];
    raw *= .6 + .4 * Math.min(1, f.temp / .5); /* wrong water temperature limits everything else */
    raw *= .72 + .28 * Math.min(1, f.light / .8); /* so does the wrong time of day */
    let score = clamp((raw - .35) / .75) * 100; /* average conditions land around the middle; Excellent needs most things going right */
    const adj = personal ? personal.points : 0;
    score += adj;
    if (c.thunder) score = Math.min(score, 15);
    if (c.wind > 60 || c.gust > 85) score = Math.min(score, 20);
    if (c.ice) score = Math.min(score, 12);
    score = Math.round(clamp(score, 0, 100));
    const legal = legalCheck(sp, c, settings);
    return { sp, score, band: scoreBand(score), factors: f, legal, personal: personal || null, recommended: sp.recommend && legal.ok };
  }
  function scoreBand(score) {
    if (score >= 80) return { key: 'excellent', label: 'Excellent', tone: 'good' };
    if (score >= 62) return { key: 'good', label: 'Good', tone: 'good' };
    if (score >= 45) return { key: 'fair', label: 'Fair', tone: 'warn' };
    if (score >= 25) return { key: 'slow', label: 'Slow', tone: 'bad' };
    return { key: 'poor', label: 'Poor', tone: 'bad' };
  }

  const fmt1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  function explainFactors(result, c) {
    const { sp, factors: f } = result, name = sp.name.toLowerCase(), w = c.water === null ? null : Math.round(c.water);
    const items = [
      { key: 'temp', label: 'Water temperature', value: f.temp,
        text: w === null ? 'No water temperature estimate.'
          : f.temp >= .85 ? `Water around ${w} °C is in the active range for ${name}.`
          : (c.water < sp.temp[1]) ? `Water around ${w} °C is on the cold side for ${name}, so expect slower fish.`
          : `Water around ${w} °C is on the warm side for ${name}.` },
      { key: 'light', label: 'Time of day and light', value: f.light,
        text: { dawn: 'Dawn light usually gets fish feeding.', dusk: 'The low light around sunset is a prime feeding time.', night: f.light >= .6 ? 'This fish feeds well after dark.' : 'This fish feeds little after dark.', day: f.light >= .6 ? 'Daytime light suits this fish.' : 'Bright daytime is usually not its best time.' }[c.daypart] },
      { key: 'pressure', label: 'Air pressure', value: f.pressure,
        text: { crash: `Pressure is dropping fast (${fmt1(c.d3)} hPa in 3 h), often a sign of an unsettled front.`, falling: `Pressure is falling slowly (${fmt1(c.d3)} hPa in 3 h), which often triggers feeding.`, steady: 'Steady pressure gives predictable, ordinary fishing.', rising: `Pressure is rising (+${fmt1(c.d3)} hPa in 3 h), so fish may be more cautious.`, jump: `Pressure is rising fast (+${fmt1(c.d3)} hPa in 3 h), so fish may go off the bite.` }[c.pressClass] },
      { key: 'season', label: 'Time of year', value: f.season,
        text: f.season >= .8 ? 'This is a strong time of year for this fish.' : f.season >= .5 ? 'An average time of year.' : 'Not a strong time of year.' },
      { key: 'wind', label: 'Wind', value: f.wind,
        text: c.wind < 8 ? 'Very little wind, so the water may be calm and clear.' : c.wind <= 22 ? 'A light breeze ripples the surface and makes fish less wary.' : c.wind <= 35 ? 'Strong enough to make casting and bite detection harder.' : 'Hard wind, so look for shelter.' },
      { key: 'trend', label: 'Water temperature trend', value: f.trend,
        text: c.waterTrend < -2 ? 'The water has cooled quickly over the last few days.' : c.waterTrend > 1 ? 'The water has been warming over the last few days.' : c.waterTrend < -.5 ? 'The water has been cooling slowly.' : 'Water temperature has been stable.' },
      { key: 'rain', label: 'Rain', value: f.rain,
        text: c.thunder ? 'Thunderstorm: put your rods down and leave the bank.' : (c.precip || 0) < .1 ? 'Dry right now.' : (c.precip <= 1.5 ? 'Light rain.' : 'Heavy rain.') }
    ];
    return items;
  }
  function headlineReasons(result, c) {
    const items = explainFactors(result, c).map((i) => ({ ...i, impact: (i.value - .6) * WEIGHTS[i.key] }));
    const pos = items.filter((i) => i.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 2);
    const neg = items.filter((i) => i.impact < -.01).sort((a, b) => a.impact - b.impact).slice(0, 1);
    return { pos, neg };
  }

  function howBand(water) {
    return water === null ? 'mid' : water < 8 ? 'cold' : water <= 18 ? 'mid' : 'warm';
  }
  function howTo(sp, c) {
    const h = { ...sp.how[howBand(c.water)] };
    if (baitClosed(c.t) && sp.group === 'Predator') {
      h.rig = 'Lures, dead fish and pieces of fish are not allowed from 1 April to the last Saturday of May.';
      h.bait = 'Natural baits only. Do not fish in a way that targets zander.';
    }
    return h;
  }

  /* ---------- Water choice ---------- */
  const toRad = (x) => x * Math.PI / 180;
  function distanceKm(a, b) {
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(s));
  }
  const bikeMinutes = (km) => Math.round(km * 1.3 / 16 * 60);
  function nearestSpot(point, spots) {
    let best = null, bd = Infinity;
    for (const s of spots) { const d = distanceKm(point, s); if (d < bd) { bd = d; best = s; } }
    return best ? { spot: best, km: bd } : null;
  }
  function windAdvice(c) {
    if (c.wind < 8) return 'Almost no wind, so there is no favoured bank. Fish structure and shade.';
    const to = compass(c.dir + 180), from = compass(c.dir);
    if (c.wind > 35) return `Hard ${from} wind. Pick a sheltered harbour or a bank with the wind at your back.`;
    return `Wind from the ${from} pushes surface food towards the ${to} side. Try the side it blows into first.`;
  }
  function rankSpots(sp, c, spots, ctx) {
    ctx = ctx || {};
    const origin = ctx.origin || D.CENTER, permit = (ctx.settings && ctx.settings.permit) || 'full';
    const rows = [];
    for (const s of spots) {
      const km = distanceKm(origin, s), centreKm = distanceKm(D.CENTER, s);
      if (centreKm > 20.5 && !s.own) continue;
      if (permit === 'kleine' && s.status !== 'listed' && !s.own) continue;
      const type = D.WATER_TYPES[s.type] || D.WATER_TYPES.shipcanal;
      let val = 62 * (sp.habitat[s.type] === undefined ? .5 : sp.habitat[s.type]);
      const why = [];
      if (c.water !== null && c.water < 8) { val += 14 * type.cold; if (type.cold >= .8) why.push('Deep or sheltered water holds fish in the cold'); }
      if (c.water !== null && c.water > 20 && (s.type === 'shallowlake' || s.type === 'polder')) { val -= 8; why.push('Shallow water can run low on oxygen in the heat'); }
      if (c.wind > 22) {
        val -= type.exposure * Math.min(25, (c.wind - 22) * 1.1);
        if (type.exposure <= .4) why.push('Sheltered from the wind'); else if (type.exposure >= .8) why.push('Exposed to the wind');
      }
      val -= Math.min(18, km * .9);
      if (ctx.checked && ctx.checked[s.id]) val += 3;
      if (s.status === 'check' && !(ctx.checked && ctx.checked[s.id])) val -= 6;
      let personal = 0;
      if (ctx.spotLift) { personal = ctx.spotLift(s.id); val += personal; if (personal >= 3) why.push('Has worked well for you'); }
      if (!why.length && (sp.habitat[s.type] || 0) >= .8) why.push('Good water type for ' + sp.name.toLowerCase());
      rows.push({ spot: s, km, minutes: bikeMinutes(km), value: val, why, personal });
    }
    return rows.sort((a, b) => b.value - a.value);
  }

  /* ---------- Learning from your log ---------- */
  function groupTrips(records) {
    const map = new Map();
    for (const r of records) {
      const key = dateKey(r.ts) + '|' + (r.spotId || r.spotName || 'unknown');
      if (!map.has(key)) map.set(key, { key, ts: r.ts, spotId: r.spotId || null, cond: r.cond || null, caught: new Set(), catches: 0, blank: false });
      const t = map.get(key);
      if (!t.cond && r.cond) t.cond = r.cond;
      if (r.type === 'catch') { t.caught.add(r.speciesId); t.catches++; }
      if (r.type === 'blank') t.blank = true;
    }
    return [...map.values()];
  }
  const condBuckets = (c) => ({
    tempBand: c.water === null || c.water === undefined ? null : tempBand(c.water),
    press: c.pressClass || null,
    daypart: c.daypart || null,
    wind: c.windClass || (typeof c.wind === 'number' ? windClass(c.wind) : null)
  });
  const LEARN_MIN = 5, LEARN_FULL = 25;
  function personalAdjust(speciesId, cond, trips, spotId) {
    const N = trips.length;
    const S0 = trips.filter((t) => t.caught.has(speciesId)).length;
    if (N < LEARN_MIN || S0 < 1) return { points: 0, trips: N, used: 0, parts: [] };
    const p = (S0 + 1) / (N + 2), k = 6, want = condBuckets(cond), parts = [];
    let lift = 0, used = 0;
    const consider = (label, pick, value) => {
      if (value === null || value === undefined) return;
      const same = trips.filter((t) => pick(t) === value);
      if (same.length < 2) return;
      const s = same.filter((t) => t.caught.has(speciesId)).length;
      const r = (s + k * p) / (same.length + k), l = Math.log(r / p);
      lift += l; used += same.length;
      parts.push({ label, n: same.length, s, lift: l });
    };
    const bucket = (t) => (t.cond ? condBuckets(t.cond) : {});
    consider('water temperature', (t) => bucket(t).tempBand, want.tempBand);
    consider('pressure trend', (t) => bucket(t).press, want.press);
    consider('time of day', (t) => bucket(t).daypart, want.daypart);
    consider('wind', (t) => bucket(t).wind, want.wind);
    if (spotId) consider('this spot', (t) => t.spotId, spotId);
    const confidence = Math.min(1, N / LEARN_FULL);
    const points = Math.round(clamp(lift * 14, -15, 15) * confidence);
    return { points, trips: N, used, parts };
  }
  function spotLifter(speciesId, trips) {
    return (spotId) => {
      const N = trips.length, S0 = trips.filter((t) => t.caught.has(speciesId)).length;
      if (N < LEARN_MIN || S0 < 1) return 0;
      const same = trips.filter((t) => t.spotId === spotId);
      if (!same.length) return 0;
      const p = (S0 + 1) / (N + 2), s = same.filter((t) => t.caught.has(speciesId)).length;
      return clamp(Math.log(((s + 4 * p) / (same.length + 4)) / p) * 12, -10, 12);
    };
  }

  /* ---------- Whole-forecast helpers ---------- */
  function bestWindow(weather, spId, fromT, hours, opts) {
    const sp = speciesById(spId), H = weather.hourly, rows = [];
    for (let i = 0; i < H.time.length; i++) {
      if (H.time[i] < fromT - HOUR / 2 || H.time[i] > fromT + hours * HOUR) continue;
      const c = conditionsAt(weather, H.time[i], opts);
      rows.push({ t: H.time[i], score: scoreSpecies(sp, c, opts && opts.settings).score, ok: legalCheck(sp, c, opts && opts.settings).ok });
    }
    const usable = rows.filter((r) => r.ok);
    if (!usable.length) return { rows, best: null };
    const top = usable.reduce((a, b) => (b.score > a.score ? b : a));
    const threshold = Math.max(top.score - 4, 25), at = rows.indexOf(top);
    let start = top, end = top;
    /* A short, useful window around the peak, at most 5 hours long. */
    for (let i = at + 1; i < rows.length && rows[i].ok && rows[i].score >= threshold && rows[i].t - start.t < 4 * HOUR; i++) end = rows[i];
    for (let i = at - 1; i >= 0 && rows[i].ok && rows[i].score >= threshold && end.t - rows[i].t < 4 * HOUR; i--) start = rows[i];
    return { rows, best: { from: start.t, to: end.t + HOUR, score: top.score, peak: top.t } };
  }

  /* ---------- Gamification ---------- */
  function isoWeek(ts) {
    const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const n = 1 + Math.round(((d - week1) / DAY - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return d.getFullYear() * 100 + n;
  }
  function weekStreak(records, now) {
    const weeks = new Set(records.map((r) => isoWeek(r.ts)));
    let streak = 0, t = now || Date.now();
    if (!weeks.has(isoWeek(t))) t -= 7 * DAY;
    while (weeks.has(isoWeek(t))) { streak++; t -= 7 * DAY; }
    return streak;
  }
  function bestStreak(records) {
    const days = [...new Set(records.map((r) => isoWeek(r.ts)))];
    if (!days.length) return 0;
    const stamps = [...new Set(records.map((r) => { const d = new Date(r.ts); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }))].sort((a, b) => a - b);
    let best = 1, run = 1;
    for (let i = 1; i < stamps.length; i++) { const gap = Math.round((stamps[i] - stamps[i - 1]) / (7 * DAY)); run = gap === 1 ? run + 1 : 1; best = Math.max(best, run); }
    return best;
  }
  function computeStats(records) {
    const catches = records.filter((r) => r.type === 'catch');
    const blanks = records.filter((r) => r.type === 'blank');
    const bySpecies = {}, pbs = {};
    for (const r of catches) {
      bySpecies[r.speciesId] = (bySpecies[r.speciesId] || 0) + 1;
      const pb = pbs[r.speciesId] = pbs[r.speciesId] || { lengthCm: 0, weightG: 0, count: 0 };
      pb.count++;
      if (r.lengthCm > pb.lengthCm) { pb.lengthCm = r.lengthCm; pb.lengthId = r.id; }
      if (r.weightG > pb.weightG) { pb.weightG = r.weightG; pb.weightId = r.id; }
    }
    const trips = groupTrips(records);
    const spots = new Set(records.map((r) => r.spotId).filter(Boolean));
    const dayMap = {};
    catches.forEach((r) => { const k = dateKey(r.ts); (dayMap[k] = dayMap[k] || new Set()).add(r.speciesId); });
    const maxDay = Object.values(dayMap).reduce((m, s) => Math.max(m, s.size), 0);
    const slam = Object.values(dayMap).some((s) => s.has('pike') && s.has('zander') && s.has('perch'));
    return {
      catches, blanks, bySpecies, pbs, trips, spots,
      speciesCount: Object.keys(bySpecies).filter((id) => id !== 'other').length,
      photos: catches.filter((r) => r.hasPhoto).length,
      released: catches.filter((r) => r.released).length,
      maxDay, slam,
      streak: weekStreak(records), longestStreak: bestStreak(records)
    };
  }
  const pbLen = (st, id) => (st.pbs[id] ? st.pbs[id].lengthCm : 0);
  const pbWeight = (st, id) => (st.pbs[id] ? st.pbs[id].weightG : 0);
  const anyCatch = (st, fn) => st.catches.some(fn);
  const ACHIEVEMENTS = [
    { id: 'first', name: 'First Bite', text: 'Log your first catch.', xp: 50, test: (s) => s.catches.length >= 1 },
    { id: 'ten', name: 'Into Double Figures', text: 'Log 10 catches.', xp: 100, test: (s) => s.catches.length >= 10 },
    { id: 'fifty', name: 'Half a Hundred', text: 'Log 50 catches.', xp: 250, test: (s) => s.catches.length >= 50 },
    { id: 'hundred', name: 'The Hundred Club', text: 'Log 100 catches.', xp: 500, test: (s) => s.catches.length >= 100 },
    { id: 'three', name: 'Getting Around', text: 'Catch 3 different species.', xp: 75, test: (s) => s.speciesCount >= 3 },
    { id: 'six', name: 'Canal Collector', text: 'Catch 6 different species.', xp: 200, test: (s) => s.speciesCount >= 6 },
    { id: 'ten-sp', name: 'Full Keepnet of Names', text: 'Catch 10 different species.', xp: 400, test: (s) => s.speciesCount >= 10 },
    { id: 'slam', name: 'Predator Slam', text: 'Catch pike, zander and perch on one day.', xp: 300, test: (s) => s.slam },
    { id: 'mixed', name: 'Mixed Bag', text: 'Catch 4 species on one day.', xp: 200, test: (s) => s.maxDay >= 4 },
    { id: 'pike80', name: 'Pike Over 80', text: 'Catch a pike of 80 cm or more.', xp: 200, test: (s) => pbLen(s, 'pike') >= 80 },
    { id: 'metre', name: 'Metre Pike', text: 'Catch a pike of 100 cm or more.', xp: 500, test: (s) => pbLen(s, 'pike') >= 100 },
    { id: 'zander60', name: 'Zander Over 60', text: 'Catch a zander of 60 cm or more.', xp: 200, test: (s) => pbLen(s, 'zander') >= 60 },
    { id: 'zander80', name: 'Big Glass Eyes', text: 'Catch a zander of 80 cm or more.', xp: 500, test: (s) => pbLen(s, 'zander') >= 80 },
    { id: 'perch40', name: 'Forty Stripes', text: 'Catch a perch of 40 cm or more.', xp: 300, test: (s) => pbLen(s, 'perch') >= 40 },
    { id: 'bream50', name: 'Dustbin Lid', text: 'Catch a bream of 50 cm or more.', xp: 200, test: (s) => pbLen(s, 'bream') >= 50 },
    { id: 'carp10', name: 'Double-Figure Carp', text: 'Catch a carp of 10 kg or more.', xp: 400, test: (s) => pbWeight(s, 'carp') >= 10000 },
    { id: 'early', name: 'Before the Bakery', text: 'Catch a fish within an hour of sunrise.', xp: 75, test: (s) => anyCatch(s, (r) => r.cond && r.cond.sunrise && Math.abs(r.ts - r.cond.sunrise) <= HOUR) },
    { id: 'dusk', name: 'Last Cast', text: 'Catch a fish within an hour of sunset.', xp: 75, test: (s) => anyCatch(s, (r) => r.cond && r.cond.sunset && Math.abs(r.ts - r.cond.sunset) <= HOUR) },
    { id: 'night', name: 'Night Shift', text: 'Catch a fish in the night period.', xp: 100, test: (s) => anyCatch(s, (r) => r.cond && r.cond.night) },
    { id: 'cold', name: 'Numb Fingers', text: 'Catch a fish in water under 6 °C.', xp: 150, test: (s) => anyCatch(s, (r) => r.cond && typeof r.cond.water === 'number' && r.cond.water < 6) },
    { id: 'wind', name: 'Blown Sideways', text: 'Catch a fish in 6 Bft of wind or more.', xp: 150, test: (s) => anyCatch(s, (r) => r.cond && r.cond.wind >= 39) },
    { id: 'rain', name: 'Soaked', text: 'Catch a fish in the rain.', xp: 50, test: (s) => anyCatch(s, (r) => r.cond && r.cond.precip >= .3) },
    { id: 'against', name: 'Against the Odds', text: 'Catch a fish while its score is under 30.', xp: 150, test: (s) => anyCatch(s, (r) => r.forecast && r.forecast.speciesScore < 30) },
    { id: 'called', name: 'Called It', text: 'Catch the top pick 5 times.', xp: 200, test: (s) => s.catches.filter((r) => r.forecast && r.forecast.bestId === r.speciesId).length >= 5 },
    { id: 'spots5', name: 'Bike Miles', text: 'Fish 5 different spots.', xp: 100, test: (s) => s.spots.size >= 5 },
    { id: 'spots12', name: 'Knows Every Bank', text: 'Fish 12 different spots.', xp: 300, test: (s) => s.spots.size >= 12 },
    { id: 'streak4', name: 'Regular', text: 'Log a trip 4 weeks in a row.', xp: 150, test: (s) => s.longestStreak >= 4 },
    { id: 'streak12', name: 'Season Pass', text: 'Log a trip 12 weeks in a row.', xp: 500, test: (s) => s.longestStreak >= 12 },
    { id: 'blank3', name: 'Honest Angler', text: 'Log 3 trips with no catch.', xp: 75, test: (s) => s.blanks.length >= 3 },
    { id: 'blank10', name: 'Scientist', text: 'Log 10 trips with no catch.', xp: 200, test: (s) => s.blanks.length >= 10 },
    { id: 'release', name: 'Back You Go', text: 'Release 10 fish.', xp: 100, test: (s) => s.released >= 10 },
    { id: 'photo', name: 'Proof', text: 'Add photos to 10 catches.', xp: 100, test: (s) => s.photos >= 10 },
    { id: 'learner', name: 'App Trained', text: 'Log 25 trips so your scores use your full history.', xp: 300, test: (s) => s.trips.length >= 25 }
  ];
  function recordXP(r, ctx) {
    if (r.type === 'blank') return 25;
    let xp = 40;
    if (ctx && ctx.newSpecies) xp += 100;
    if (ctx && ctx.pb) xp += 60;
    if (r.hasPhoto) xp += 10;
    if (r.lengthCm) xp += 5;
    if (r.weightG) xp += 5;
    if (r.forecast && r.forecast.bestId === r.speciesId) xp += 15;
    return xp;
  }
  function computeProgress(records) {
    const sorted = [...records].sort((a, b) => a.ts - b.ts);
    let xp = 0;
    const seen = new Set(), bestLen = {}, bestW = {};
    const annotated = {};
    for (const r of sorted) {
      const ctx = {};
      if (r.type === 'catch') {
        if (r.speciesId !== 'other' && !seen.has(r.speciesId)) { ctx.newSpecies = true; seen.add(r.speciesId); }
        if ((r.lengthCm && r.lengthCm > (bestLen[r.speciesId] || 0) && bestLen[r.speciesId]) || (r.weightG && r.weightG > (bestW[r.speciesId] || 0) && bestW[r.speciesId])) ctx.pb = true;
        if (r.lengthCm) bestLen[r.speciesId] = Math.max(bestLen[r.speciesId] || 0, r.lengthCm);
        if (r.weightG) bestW[r.speciesId] = Math.max(bestW[r.speciesId] || 0, r.weightG);
      }
      const gain = recordXP(r, ctx);
      xp += gain;
      annotated[r.id] = { xp: gain, ...ctx };
    }
    const stats = computeStats(sorted);
    const earned = ACHIEVEMENTS.filter((a) => a.test(stats));
    xp += earned.reduce((n, a) => n + a.xp, 0);
    let level = 0;
    D.LEVELS.forEach((l, i) => { if (xp >= l[0]) level = i; });
    const cur = D.LEVELS[level], next = D.LEVELS[level + 1] || null;
    return {
      xp, stats, earned, annotated, level: level + 1, title: cur[1],
      nextAt: next ? next[0] : null, nextTitle: next ? next[1] : null,
      into: xp - cur[0], span: next ? next[0] - cur[0] : 1
    };
  }

  /* What the current entry means legally, shown while filling in the catch form. */
  function catchAdvice(sp, lengthCm, ts) {
    const out = [], c = closedStatus(sp, ts), r = sp.rules || {};
    if (c.closed) out.push({ tone: 'bad', text: `${sp.name}: ${c.text.toLowerCase()}. Release it straight away.` });
    if (r.protect) out.push({ tone: 'bad', text: r.protect });
    else if (r.release) out.push({ tone: 'warn', text: `${sp.name} must be released.` });
    if (r.min && lengthCm && lengthCm < r.min) out.push({ tone: 'bad', text: `Under the ${r.min} cm minimum. Release it straight away.` });
    if (r.take && !(c.closed) && (!r.min || !lengthCm || lengthCm >= r.min)) out.push({ tone: 'info', text: r.take });
    return out;
  }

  return {
    HOUR, DAY, clamp, dateKey, speciesById, lastSaturdayOfMay, baitClosed, closedStatus, isNightPeriod, legalCheck,
    beaufort, compass, weatherText, moon, sunTimes, fromBrightSky, parseWeather, waterSeries, waterAt, pressClass, PRESS_TEXT, windClass, tempBand,
    conditionsAt, factorValues, scoreSpecies, scoreBand, explainFactors, headlineReasons, howTo, howBand,
    distanceKm, bikeMinutes, nearestSpot, windAdvice, rankSpots, groupTrips, personalAdjust, spotLifter, LEARN_MIN, LEARN_FULL,
    bestWindow, isoWeek, weekStreak, bestStreak, computeStats, ACHIEVEMENTS, recordXP, computeProgress, catchAdvice
  };
});
