/* Stek fish silhouettes. Each fish is drawn from its own body outline and fin layout.
   The head points left. Drawing area: 120 x 64, with the middle of the body at y = 32. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StekFish = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const X0 = 6, X1 = 96, CY = 32;

  /* top / bot: [position along the body 0..1, height from the centre line]. */
  const FISH = {
    pike: {
      top: [[0, .8], [.05, 1.6], [.13, 2.8], [.2, 4.6], [.3, 6.2], [.5, 7.4], [.72, 7.2], [.9, 5], [1, 3.6]],
      bot: [[0, 1], [.05, 2], [.13, 3.2], [.22, 5.4], [.5, 8.2], [.72, 7.4], [.9, 4.8], [1, 3.6]],
      fins: [{ at: 'top', from: .68, to: .9, h: 8.5, style: 'round', sweep: 3 }, { at: 'bot', from: .7, to: .9, h: 8, style: 'round', sweep: 3 }, { at: 'bot', from: .48, to: .57, h: 5, style: 'round', sweep: 3 }],
      tail: { type: 'fork', spread: 11, depth: 6, len: 19 }, eye: [.115, -1.7, 1.35], pect: [.24, 3.2, 8], mouth: [.17, 1.1]
    },
    zander: {
      top: [[0, .9], [.07, 2.6], [.16, 5.6], [.3, 9], [.45, 9.8], [.7, 7.8], [.88, 5], [1, 3.4]],
      bot: [[0, 1.2], [.08, 3.2], [.2, 6.6], [.42, 9], [.7, 7.2], [.88, 4.8], [1, 3.4]],
      fins: [{ at: 'top', from: .27, to: .5, h: 10.5, style: 'spiky', spikes: 6, sweep: 2 }, { at: 'top', from: .53, to: .8, h: 8.5, style: 'round', sweep: 3 }, { at: 'bot', from: .68, to: .84, h: 7.5, style: 'round', sweep: 3 }, { at: 'bot', from: .34, to: .43, h: 5.5, style: 'round', sweep: 3 }],
      tail: { type: 'fork', spread: 12, depth: 7, len: 18 }, eye: [.12, -2.4, 1.7], pect: [.24, 2.6, 8], mouth: [.11, 1.1]
    },
    perch: {
      top: [[0, 1], [.07, 3.2], [.15, 7.6], [.25, 12.4], [.36, 14], [.55, 11.8], [.78, 7], [1, 3.4]],
      bot: [[0, 1.4], [.08, 4], [.22, 9], [.42, 11], [.65, 8.8], [.85, 5.2], [1, 3.4]],
      fins: [{ at: 'top', from: .25, to: .53, h: 11, style: 'spiky', spikes: 7, sweep: 2 }, { at: 'top', from: .56, to: .79, h: 8.5, style: 'round', sweep: 3 }, { at: 'bot', from: .66, to: .82, h: 8, style: 'round', sweep: 3 }, { at: 'bot', from: .3, to: .41, h: 6.5, style: 'round', sweep: 3 }],
      tail: { type: 'fork', spread: 12, depth: 5, len: 17 }, eye: [.13, -2.6, 2.1], pect: [.26, 2.8, 9], mouth: [.09, 1.4],
      bars: [.34, .44, .54, .64, .74]
    },
    asp: {
      top: [[0, 1.8], [.06, 3], [.14, 5.2], [.28, 8.4], [.46, 10], [.7, 7.6], [.88, 4.6], [1, 2.8]],
      bot: [[0, 2.2], [.07, 4], [.18, 7], [.4, 10.8], [.66, 8.8], [.86, 4.8], [1, 2.8]],
      fins: [{ at: 'top', from: .46, to: .6, h: 11, style: 'tall', sweep: 5 }, { at: 'bot', from: .66, to: .86, h: 8.5, style: 'tall', sweep: 4 }, { at: 'bot', from: .42, to: .51, h: 6, style: 'tall', sweep: 3 }],
      tail: { type: 'fork', spread: 14, depth: 10, len: 20 }, eye: [.1, -1.7, 1.6], pect: [.21, 3.4, 9], mouth: [.14, .6]
    },
    carp: {
      top: [[0, 1.6], [.07, 4], [.17, 9], [.3, 13.6], [.44, 15], [.66, 11.8], [.88, 6.2], [1, 4.2]],
      bot: [[0, 2.2], [.08, 5.2], [.2, 9.4], [.42, 12.2], [.68, 9.2], [.88, 5.6], [1, 4.2]],
      fins: [{ at: 'top', from: .4, to: .8, h: 7.5, style: 'tall', sweep: 3 }, { at: 'bot', from: .73, to: .86, h: 7.5, style: 'tall', sweep: 3 }, { at: 'bot', from: .42, to: .52, h: 6.5, style: 'round', sweep: 3 }],
      tail: { type: 'fork', spread: 13, depth: 4, len: 18 }, eye: [.13, -2.8, 1.7], pect: [.24, 4, 9], mouth: [.06, 1.5],
      barbels: [[6, 5, 6]]
    },
    crucian: {
      top: [[0, 1.6], [.07, 5], [.18, 12], [.32, 17.2], [.48, 18], [.7, 13], [.9, 6.4], [1, 4.4]],
      bot: [[0, 2.2], [.08, 6], [.22, 12.4], [.42, 15], [.68, 11.6], [.9, 5.8], [1, 4.4]],
      fins: [{ at: 'top', from: .4, to: .8, h: 6.5, style: 'round', sweep: 2 }, { at: 'bot', from: .72, to: .85, h: 6.5, style: 'round', sweep: 2 }, { at: 'bot', from: .42, to: .52, h: 6, style: 'round', sweep: 2 }],
      tail: { type: 'fork', spread: 11, depth: 1.5, len: 15 }, eye: [.14, -3.4, 2], pect: [.25, 5, 8], mouth: [.06, 1.6], scale: .92
    },
    tench: {
      top: [[0, 1.6], [.08, 4], [.2, 7.6], [.36, 10], [.56, 10], [.78, 8], [.92, 6.4], [1, 5.8]],
      bot: [[0, 2], [.09, 5], [.24, 8.4], [.46, 10.2], [.72, 8.2], [.92, 6.4], [1, 5.8]],
      fins: [{ at: 'top', from: .47, to: .64, h: 8, style: 'round', sweep: 1 }, { at: 'bot', from: .7, to: .84, h: 7, style: 'round', sweep: 1 }, { at: 'bot', from: .42, to: .53, h: 7, style: 'round', sweep: 1 }],
      tail: { type: 'square', spread: 11, depth: 0, len: 15 }, eye: [.12, -2.2, 1.2], pect: [.24, 3.8, 8], mouth: [.06, 1.2],
      barbels: [[3.5, 3, 3]]
    },
    bream: {
      top: [[0, 1], [.05, 2.6], [.13, 6], [.24, 13], [.38, 18.6], [.48, 19.4], [.7, 13], [.88, 5.6], [1, 2.8]],
      bot: [[0, 1.6], [.06, 3.4], [.14, 6.4], [.3, 14], [.5, 18.4], [.72, 13], [.9, 5.4], [1, 2.8]],
      fins: [{ at: 'top', from: .47, to: .61, h: 9, style: 'tall', sweep: 4 }, { at: 'bot', from: .54, to: .93, h: 7.5, style: 'tall', sweep: 3 }, { at: 'bot', from: .33, to: .42, h: 7, style: 'tall', sweep: 3 }],
      tail: { type: 'fork', spread: 14, depth: 8, len: 19 }, eye: [.1, -1.4, 1.6], pect: [.18, 4.4, 9], mouth: [.04, 1.4]
    },
    roach: {
      top: [[0, 1.2], [.07, 3.6], [.17, 7.6], [.32, 11.4], [.46, 12.2], [.7, 8.8], [.88, 5], [1, 3.2]],
      bot: [[0, 1.6], [.08, 4.2], [.2, 8], [.42, 11.8], [.68, 8.8], [.88, 4.8], [1, 3.2]],
      fins: [{ at: 'top', from: .45, to: .6, h: 9.5, style: 'tall', sweep: 4 }, { at: 'bot', from: .68, to: .82, h: 8, style: 'tall', sweep: 3 }, { at: 'bot', from: .44, to: .53, h: 6.5, style: 'tall', sweep: 3 }],
      tail: { type: 'fork', spread: 12.5, depth: 7, len: 18 }, eye: [.12, -2, 2.3], pect: [.22, 3.6, 8.5], mouth: [.05, 1.2]
    },
    rudd: {
      top: [[0, 2.2], [.07, 3.4], [.18, 6.4], [.34, 9], [.5, 10], [.7, 8], [.88, 4.8], [1, 3.2]],
      bot: [[0, .6], [.07, 4.4], [.2, 9.6], [.42, 14.6], [.62, 12], [.82, 6.6], [1, 3.2]],
      fins: [{ at: 'top', from: .54, to: .68, h: 9.5, style: 'tall', sweep: 4 }, { at: 'bot', from: .66, to: .82, h: 8, style: 'tall', sweep: 3 }, { at: 'bot', from: .42, to: .51, h: 7, style: 'tall', sweep: 3 }],
      tail: { type: 'fork', spread: 12.5, depth: 6, len: 18 }, eye: [.12, -1.6, 2.1], pect: [.22, 4.2, 8.5], mouth: [.06, 1.5, true]
    },
    ide: {
      top: [[0, 1.8], [.08, 4.6], [.2, 8.4], [.34, 10.8], [.5, 11], [.72, 8.4], [.9, 5], [1, 3.6]],
      bot: [[0, 2.2], [.09, 5.4], [.22, 9], [.42, 11.2], [.7, 8.4], [.9, 5], [1, 3.6]],
      fins: [{ at: 'top', from: .49, to: .63, h: 8.5, style: 'tall', sweep: 3 }, { at: 'bot', from: .69, to: .84, h: 7.5, style: 'tall', sweep: 2 }, { at: 'bot', from: .44, to: .53, h: 6, style: 'tall', sweep: 2 }],
      tail: { type: 'fork', spread: 11, depth: 3.5, len: 16 }, eye: [.12, -2.4, 1.5], pect: [.23, 3.8, 8], mouth: [.06, 1.8]
    },
    bleak: {
      top: [[0, 2], [.07, 2.8], [.2, 4.6], [.4, 6], [.62, 5.8], [.84, 3.8], [1, 2.2]],
      bot: [[0, .8], [.07, 3], [.2, 6.4], [.42, 8.6], [.66, 7], [.84, 3.8], [1, 2.2]],
      fins: [{ at: 'top', from: .55, to: .66, h: 7, style: 'tall', sweep: 3 }, { at: 'bot', from: .62, to: .87, h: 6.5, style: 'tall', sweep: 3 }, { at: 'bot', from: .44, to: .52, h: 4.5, style: 'tall', sweep: 2 }],
      tail: { type: 'fork', spread: 11, depth: 8, len: 17 }, eye: [.1, -.7, 2], pect: [.2, 2.8, 7], mouth: [.05, 1.2, true]
    },
    catfish: {
      top: [[0, 3], [.05, 5], [.14, 7.8], [.28, 10], [.42, 9.6], [.68, 6.2], [.88, 3.6], [1, 2.2]],
      bot: [[0, 3], [.05, 5.4], [.14, 8.6], [.3, 10.4], [.5, 8.4], [.7, 5.8], [.88, 3.6], [1, 2.2]],
      fins: [{ at: 'top', from: .29, to: .36, h: 6, style: 'round', sweep: 1 }, { at: 'bot', from: .45, to: 1, h: 5.2, style: 'ribbon' }, { at: 'bot', from: .34, to: .42, h: 5, style: 'round', sweep: 2 }],
      tail: { type: 'round', spread: 6, depth: 0, len: 9 }, eye: [.07, -3, 1], pect: [.17, 4.4, 8], mouth: [.08, 1.6],
      barbels: [[20, 8, 14], [11, 11, 8]]
    }
  };

  /* Smooth curve through the outline points. */
  function curve(points) {
    const n = points.length, m = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      m[i] = (b[1] - a[1]) / (b[0] - a[0]);
    }
    return (x) => {
      if (x <= points[0][0]) return points[0][1];
      for (let i = 0; i < n - 1; i++) {
        const p = points[i], q = points[i + 1];
        if (x <= q[0]) {
          const h = q[0] - p[0], t = (x - p[0]) / h, t2 = t * t, t3 = t2 * t;
          return (2 * t3 - 3 * t2 + 1) * p[1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * q[1] + (t3 - t2) * h * m[i + 1];
        }
      }
      return points[n - 1][1];
    };
  }
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  const toPath = (pts) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';

  function build(id) {
    const d = FISH[id] || FISH.roach;
    const top = curve(d.top), bot = curve(d.bot);
    const end = X1 + (d.extend || 0), span = end - X0;
    const px = (u) => X0 + u * span;
    const mid = (u) => CY + (d.wave ? Math.sin(u * Math.PI * 2.1 + .35) * d.wave * (.35 + .65 * u) : 0);
    const upper = (u) => mid(u) - top(u), lower = (u) => mid(u) + bot(u);

    const body = [];
    for (let i = 0; i <= 56; i++) { const u = i / 56; body.push([px(u), upper(u)]); }
    for (let i = 56; i >= 0; i--) { const u = i / 56; body.push([px(u), lower(u)]); }

    const fins = (d.fins || []).map((fin) => {
      const dir = fin.at === 'top' ? -1 : 1, edge = fin.at === 'top' ? upper : lower, inset = fin.at === 'top' ? 1.4 : -1.4;
      const base = (u) => [px(u), edge(u) + inset];
      const out = [], n = 26, sweep = fin.sweep || 0;
      if (fin.style === 'spiky') {
        const s = fin.spikes || 6;
        for (let i = 0; i <= s; i++) {
          const u = fin.from + (fin.to - fin.from) * (i / s);
          const envelope = Math.sin(Math.min(1, (i + .6) / (s + .2)) * Math.PI * .92 + .12);
          out.push([px(u) + sweep, edge(u) + dir * fin.h * envelope]);
          if (i < s) { const v = u + (fin.to - fin.from) / s * .5; out.push([px(v) + sweep * .4, edge(v) + dir * fin.h * envelope * .52]); }
        }
      } else {
        for (let i = 0; i <= n; i++) {
          const k = i / n, u = fin.from + (fin.to - fin.from) * k;
          let h;
          if (fin.style === 'tall') h = k < .22 ? k / .22 : 1 - .62 * ((k - .22) / .78);
          else if (fin.style === 'ribbon') h = Math.min(1, k * 6) * (k > .9 ? (1 - k) * 10 * .7 + .3 : 1);
          else h = Math.sin(k * Math.PI) ** .7;
          out.push([px(u) + sweep * h, edge(u) + dir * fin.h * h]);
        }
      }
      const pts = [base(fin.from)].concat(out, [base(fin.to)]);
      return toPath(pts);
    });

    let tail = '';
    if (d.tail) {
      const t = d.tail, y = mid(1), s = t.spread, x = end - 1.5, tip = x + t.len, p = Math.max(1.5, top(1) - .4), q = Math.max(1.5, bot(1) - .4), pts = [[x, y - p]];
      const add = (fn) => { for (let i = 1; i <= 12; i++) pts.push(fn(i / 12)); };
      if (t.type === 'round') {
        add((k) => { const a = -Math.PI / 2 + k * Math.PI; return [x + Math.cos(a) * t.len, y + Math.sin(a) * (s + q * (1 - Math.abs(Math.sin(a))))]; });
        pts.push([x, y + q]);
      } else {
        add((k) => [x + (tip - x) * k, y - p - (s - p) * k ** 1.25]);
        const notch = tip - t.depth;
        add((k) => [tip + (notch - tip) * k, y - s + s * k + (t.type === 'square' ? 0 : -(Math.sin(k * Math.PI) * .6))]);
        add((k) => [notch + (tip - notch) * k, y + s * k]);
        add((k) => [tip + (x - tip) * k, y + s + (q - s) * k ** .8]);
      }
      tail = toPath(pts);
    }

    /* Side fin, sitting on the body. */
    let pect = '';
    if (d.pect) {
      const [u, off, len] = d.pect, x = px(u), y = mid(u) + off;
      pect = `M${f1(x)} ${f1(y - 1.5)}Q${f1(x + len * .55)} ${f1(y - 1.1)} ${f1(x + len)} ${f1(y + len * .42)}Q${f1(x + len * .35)} ${f1(y + len * .46)} ${f1(x)} ${f1(y + 1.6)}Z`;
    }
    const barbels = (d.barbels || []).map(([len, drop, reach]) => {
      const x = px(.025), y = lower(.025);
      return `M${f1(x)} ${f1(y - .5)}Q${f1(x + reach * .2)} ${f1(y + drop * .9)} ${f1(x + reach)} ${f1(y + drop)}`;
    });
    const bars = (d.bars || []).map((u) => {
      const y1 = upper(u) + 1.3, y2 = mid(u) + bot(u) * .35, x = px(u);
      return `M${f1(x - 1.2)} ${f1(y1)}L${f1(x + 1.2)} ${f1(y1)}L${f1(x + .5)} ${f1(y2)}L${f1(x - .5)} ${f1(y2)}Z`;
    });

    let mouth = '';
    if (d.mouth) {
      const [u, drop, up] = d.mouth, x = px(u), y0 = up ? upper(.015) + .4 : mid(.012) + .4;
      mouth = up ? `M${f1(px(.012))} ${f1(y0)}Q${f1(x * .6 + px(.012) * .4)} ${f1(y0 + drop * 1.2)} ${f1(x + 1)} ${f1(y0 + drop * 2)}` : `M${f1(px(.012))} ${f1(y0)}Q${f1((px(.012) + x) / 2)} ${f1(y0 + drop * .3)} ${f1(x)} ${f1(y0 + drop)}`;
    }
    const gillU = d.eye[0] + (d.wave ? .05 : .085), gx = px(gillU);
    const gill = `M${f1(gx - .8)} ${f1(upper(gillU) + (bot(gillU) + top(gillU)) * .2)}Q${f1(gx + 2.2)} ${f1(mid(gillU))} ${f1(gx - .8)} ${f1(lower(gillU) - (bot(gillU) + top(gillU)) * .2)}`;

    return { body: toPath(body), fins, tail, pect, barbels, bars, mouth, gill, eye: { x: px(d.eye[0]), y: mid(d.eye[0]) + d.eye[1], r: d.eye[2] }, scale: d.scale || 1 };
  }

  const cache = {};
  /* body, fin, eye: colours. line: colour of the fine detail on the body. */
  function svg(id, opts) {
    const o = Object.assign({ body: 'currentColor', fin: 'currentColor', eye: 'var(--surface)', line: 'var(--surface)', attrs: '', detail: true }, opts || {});
    const b = cache[id] || (cache[id] = build(id));
    const s = b.scale, wrap = s === 1 ? '' : ` transform="translate(${f1(60 * (1 - s))} ${f1(32 * (1 - s))}) scale(${s})"`;
    const finPaths = b.fins.map((p) => `<path d="${p}"/>`).join('');
    const details = o.detail ? `${b.bars.map((p) => `<path d="${p}" fill="${o.line}" opacity=".32"/>`).join('')}<path d="${b.gill}" fill="none" stroke="${o.line}" stroke-opacity=".38" stroke-width=".8"/>${b.mouth ? `<path d="${b.mouth}" fill="none" stroke="${o.line}" stroke-opacity=".6" stroke-width=".8" stroke-linecap="round"/>` : ''}` : '';
    return `<svg viewBox="0 0 120 64" ${o.attrs} aria-hidden="true"><g${wrap}><g fill="${o.fin}">${b.tail ? `<path d="${b.tail}"/>` : ''}${finPaths}</g>${b.barbels.map((p) => `<path d="${p}" fill="none" stroke="${o.fin}" stroke-width="1.1" stroke-linecap="round"/>`).join('')}<path d="${b.body}" fill="${o.body}"/>${details}${b.pect ? `<path d="${b.pect}" fill="${o.fin}"/>` : ''}<circle cx="${f1(b.eye.x)}" cy="${f1(b.eye.y)}" r="${b.eye.r}" fill="${o.eye}"/></g></svg>`;
  }
  return { svg, ids: Object.keys(FISH) };
});
