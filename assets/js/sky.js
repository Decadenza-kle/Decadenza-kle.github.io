/*
 * Live sky map: the bright stars above the horizon for a fixed observer,
 * at the moment the page is viewed. Zenith at the centre, horizon at the
 * rim, north up and east to the left (as seen looking up).
 * Star positions are J2000 (precession ignored: well under half a degree).
 */
(() => {
  const el = document.querySelector('[data-sky]');
  if (!el) return;
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const LAT = parseFloat(el.dataset.lat);
  const LON = parseFloat(el.dataset.lon);
  const out = key => el.querySelector(`[data-sky-out="${key}"]`);

  const INK = '242,239,233';
  const ACC = '240,64,100';
  const FONT = '"JetBrains Mono", ui-monospace, monospace';
  const ink = a => `rgba(${INK},${a})`;
  const acc = a => `rgba(${ACC},${a})`;
  const D = Math.PI / 180;

  // [name, right ascension (hours), declination (deg), magnitude]
  const STARS = [
    ['Sirius', 6.7525, -16.716, -1.46], ['Canopus', 6.3992, -52.696, -0.74],
    ['Arcturus', 14.2610, 19.182, -0.05], ['Rigil Kentaurus', 14.6600, -60.835, -0.27],
    ['Vega', 18.6156, 38.784, 0.03], ['Capella', 5.2782, 45.998, 0.08],
    ['Rigel', 5.2423, -8.202, 0.13], ['Procyon', 7.6550, 5.225, 0.34],
    ['Achernar', 1.6286, -57.237, 0.46], ['Betelgeuse', 5.9195, 7.407, 0.50],
    ['Hadar', 14.0637, -60.373, 0.61], ['Altair', 19.8464, 8.868, 0.76],
    ['Acrux', 12.4433, -63.099, 0.77], ['Aldebaran', 4.5987, 16.509, 0.85],
    ['Spica', 13.4199, -11.161, 0.97], ['Antares', 16.4901, -26.432, 1.09],
    ['Pollux', 7.7553, 28.026, 1.14], ['Fomalhaut', 22.9608, -29.622, 1.16],
    ['Deneb', 20.6905, 45.280, 1.25], ['Mimosa', 12.7954, -59.689, 1.25],
    ['Regulus', 10.1395, 11.967, 1.35], ['Adhara', 6.9771, -28.972, 1.50],
    ['Castor', 7.5767, 31.888, 1.58], ['Shaula', 17.5601, -37.104, 1.62],
    ['Gacrux', 12.5194, -57.113, 1.63], ['Bellatrix', 5.4189, 6.350, 1.64],
    ['Elnath', 5.4382, 28.608, 1.65], ['Alnilam', 5.6036, -1.202, 1.69],
    ['Alnair', 22.1372, -46.961, 1.74], ['Alnitak', 5.6793, -1.943, 1.77],
    ['Alioth', 12.9005, 55.960, 1.77], ['Dubhe', 11.0621, 61.751, 1.79],
    ['Mirfak', 3.4054, 49.861, 1.79], ['Wezen', 7.1399, -26.393, 1.83],
    ['Kaus Australis', 18.4029, -34.385, 1.85], ['Alkaid', 13.7923, 49.313, 1.86],
    ['Menkalinan', 5.9921, 44.948, 1.90], ['Alhena', 6.6285, 16.399, 1.93],
    ['Polaris', 2.5303, 89.264, 1.98], ['Mirzam', 6.3783, -17.956, 1.98],
    ['Alphard', 9.4598, -8.659, 1.98], ['Hamal', 2.1196, 23.462, 2.00],
    ['Algieba', 10.3329, 19.842, 2.01], ['Diphda', 0.7265, -17.987, 2.04],
    ['Nunki', 18.9211, -26.297, 2.05], ['Mirach', 1.1622, 35.621, 2.05],
    ['Alpheratz', 0.1398, 29.090, 2.06], ['Saiph', 5.7959, -9.670, 2.07],
    ['Kochab', 14.8451, 74.156, 2.08], ['Rasalhague', 17.5822, 12.560, 2.07],
    ['Almach', 2.0650, 42.330, 2.10], ['Algol', 3.1361, 40.956, 2.12],
    ['Denebola', 11.8177, 14.572, 2.14], ['Mizar', 13.3988, 54.925, 2.23],
    ['Mintaka', 5.5334, -0.299, 2.23], ['Sadr', 20.3705, 40.257, 2.23],
    ['Alphecca', 15.5781, 26.715, 2.23], ['Schedar', 0.6751, 56.537, 2.24],
    ['Eltanin', 17.9434, 51.489, 2.24], ['Caph', 0.1529, 59.150, 2.28],
    ['Dschubba', 16.0056, -22.622, 2.29], ['Merak', 11.0307, 56.382, 2.37],
    ['Izar', 14.7498, 27.074, 2.37], ['Enif', 21.7364, 9.875, 2.39],
    ['Scheat', 23.0629, 28.083, 2.42], ['Sabik', 17.1730, -15.725, 2.43],
    ['Phecda', 11.8972, 53.695, 2.44], ['Alderamin', 21.3096, 62.586, 2.45],
    ['Navi', 0.9451, 60.717, 2.47], ['Aljanah', 20.7702, 33.970, 2.48],
    ['Markab', 23.0793, 15.205, 2.49], ['Menkar', 3.0380, 4.090, 2.53],
    ['Zosma', 11.2351, 20.524, 2.56], ['Gienah', 12.2634, -17.542, 2.59],
    ['Ascella', 19.0435, -29.880, 2.60], ['Zubeneschamali', 15.2834, -9.383, 2.61],
    ['Mahasim', 5.9954, 37.213, 2.62], ['Unukalhai', 15.7378, 6.426, 2.63],
    ['Kraz', 12.5732, -23.397, 2.65], ['Muphrid', 13.9114, 18.398, 2.68],
    ['Ruchbah', 1.4303, 60.235, 2.68], ['Hassaleh', 4.9499, 33.166, 2.69],
    ['Tarazed', 19.7710, 10.613, 2.72], ['Zubenelgenubi', 14.8480, -16.042, 2.75],
    ['Cebalrai', 17.7245, 4.567, 2.76], ['Kornephoros', 16.5036, 21.490, 2.78],
    ['Rastaban', 17.5072, 52.301, 2.79], ['Kaus Borealis', 18.4662, -25.422, 2.81],
    ['Zeta Herculis', 16.6881, 31.603, 2.81], ['Algenib', 0.2206, 15.184, 2.83],
    ['Vindemiatrix', 13.0363, 10.959, 2.83], ['Alcyone', 3.7914, 24.105, 2.87],
    ['Fawaris', 19.7496, 45.131, 2.87], ['Deneb Algedi', 21.7840, -16.127, 2.87],
    ['Cor Caroli', 12.9338, 38.318, 2.89], ['Epsilon Persei', 3.9642, 40.010, 2.89],
    ['Gomeisa', 7.4525, 8.289, 2.89], ['Sadalsuud', 21.5260, -5.571, 2.90],
    ['Gamma Persei', 3.0799, 53.506, 2.93], ['Sadalmelik', 22.0964, -0.320, 2.95],
    ['Algorab', 12.4977, -16.515, 2.95], ['Alnasl', 18.0968, -30.424, 2.98],
    ['Pherkad', 15.3455, 71.834, 3.00], ['Zeta Tauri', 5.6274, 21.143, 3.00],
    ['Delta Persei', 3.7154, 47.788, 3.01], ['Albireo', 19.5120, 27.960, 3.08],
    ['Pi Herculis', 17.2509, 36.809, 3.16], ['Sulafat', 18.9824, 32.690, 3.25],
    ['Megrez', 12.2571, 57.033, 3.31], ['Segin', 1.9066, 63.670, 3.37],
    ['Rasalgethi', 17.2441, 14.390, 3.48], ['Eta Herculis', 16.7149, 38.922, 3.48],
    ['Sheliak', 18.8347, 33.363, 3.52], ['Thuban', 14.0731, 64.376, 3.65],
    ['Epsilon Herculis', 17.0048, 30.926, 3.92]
  ];

  // Constellation outlines as pairs of star names.
  const LINES = [
    ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'],
    ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'],
    ['Kochab', 'Pherkad'],
    ['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin'],
    ['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Fawaris', 'Sadr'], ['Sadr', 'Aljanah'],
    ['Vega', 'Sheliak'], ['Sheliak', 'Sulafat'], ['Sulafat', 'Vega'],
    ['Altair', 'Tarazed'],
    ['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'],
    ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel'],
    ['Castor', 'Pollux'], ['Pollux', 'Alhena'],
    ['Aldebaran', 'Elnath'], ['Aldebaran', 'Zeta Tauri'],
    ['Capella', 'Menkalinan'], ['Menkalinan', 'Mahasim'], ['Mahasim', 'Elnath'],
    ['Elnath', 'Hassaleh'], ['Hassaleh', 'Capella'],
    ['Regulus', 'Algieba'], ['Algieba', 'Zosma'], ['Zosma', 'Denebola'],
    ['Arcturus', 'Izar'], ['Arcturus', 'Muphrid'],
    ['Markab', 'Scheat'], ['Scheat', 'Alpheratz'], ['Alpheratz', 'Algenib'], ['Algenib', 'Markab'],
    ['Alpheratz', 'Mirach'], ['Mirach', 'Almach'],
    ['Gamma Persei', 'Mirfak'], ['Mirfak', 'Delta Persei'], ['Delta Persei', 'Epsilon Persei'], ['Mirfak', 'Algol'],
    ['Antares', 'Dschubba'], ['Antares', 'Shaula'],
    ['Zeta Herculis', 'Eta Herculis'], ['Eta Herculis', 'Pi Herculis'], ['Pi Herculis', 'Epsilon Herculis'],
    ['Epsilon Herculis', 'Zeta Herculis'], ['Kornephoros', 'Zeta Herculis'],
    ['Eltanin', 'Rastaban'],
    ['Sirius', 'Mirzam'], ['Sirius', 'Adhara'], ['Adhara', 'Wezen'],
    ['Gienah', 'Algorab'], ['Algorab', 'Kraz'], ['Kraz', 'Gienah'],
    ['Kaus Australis', 'Ascella'], ['Ascella', 'Nunki'], ['Nunki', 'Kaus Borealis'],
    ['Kaus Borealis', 'Kaus Australis'], ['Kaus Australis', 'Alnasl'], ['Alnasl', 'Kaus Borealis']
  ];

  const byName = new Map(STARS.map(s => [s[0], s]));
  const LABELLED = new Set(['Sirius', 'Arcturus', 'Vega', 'Capella', 'Rigel', 'Procyon', 'Betelgeuse',
    'Altair', 'Aldebaran', 'Spica', 'Antares', 'Pollux', 'Deneb', 'Regulus', 'Polaris', 'Fomalhaut', 'Castor']);

  // --- Astronomy --------------------------------------------------------
  const julian = ms => ms / 86400000 + 2440587.5;
  const norm = deg => ((deg % 360) + 360) % 360;

  function lstDeg(jd) {
    const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545);
    return norm(gmst + LON);
  }

  // Equatorial (deg) -> horizontal {alt, az} in degrees, az from north through east.
  function toHorizontal(raDeg, decDeg, lst) {
    const ha = (lst - raDeg) * D, dec = decDeg * D, lat = LAT * D;
    const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    const alt = Math.asin(sinAlt);
    const az = Math.atan2(-Math.sin(ha) * Math.cos(dec),
      Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha));
    return { alt: alt / D, az: norm(az / D) };
  }

  function eclToEq(lambda, beta, eps) {
    const l = lambda * D, b = beta * D, e = eps * D;
    const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    return { ra: norm(ra / D), dec: dec / D };
  }

  function sunMoon(jd) {
    const n = jd - 2451545;
    const eps = 23.439 - 0.0000004 * n;
    const g = norm(357.528 + 0.9856003 * n) * D;
    const sunLon = norm(280.460 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
    const L = norm(218.316 + 13.176396 * n);
    const M = norm(134.963 + 13.064993 * n) * D;
    const F = norm(93.272 + 13.229350 * n) * D;
    const moonLon = norm(L + 6.289 * Math.sin(M));
    const moonLat = 5.128 * Math.sin(F);
    const elong = Math.acos(Math.cos(moonLat * D) * Math.cos((moonLon - sunLon) * D));
    return {
      sun: eclToEq(sunLon, 0, eps),
      moon: eclToEq(moonLon, moonLat, eps),
      moonLit: (1 - Math.cos(elong)) / 2,
      waxing: norm(moonLon - sunLon) < 180
    };
  }

  // --- Drawing ------------------------------------------------------------
  let size = 0, R = 0, cx = 0, cy = 0;
  let plotted = [];
  let hover = null;
  let state = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas.clientWidth;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = size / 2 - 30;
    cx = cy = size / 2;
  }

  // Azimuthal equidistant projection; east on the left when looking up.
  const project = (alt, az) => {
    const r = ((90 - alt) / 90) * R;
    return [cx - r * Math.sin(az * D), cy - r * Math.cos(az * D)];
  };

  function text(str, x, y, color, size = 9, align = 'left') {
    ctx.font = `${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  }

  function compute() {
    const now = Date.now();
    const jd = julian(now);
    const lst = lstDeg(jd);
    const sm = sunMoon(jd);
    const sun = toHorizontal(sm.sun.ra, sm.sun.dec, lst);
    const moon = toHorizontal(sm.moon.ra, sm.moon.dec, lst);
    const stars = STARS.map(([name, ra, dec, mag]) => ({ name, mag, ...toHorizontal(ra * 15, dec, lst) }));
    state = { lst, sun, moon, moonLit: sm.moonLit, waxing: sm.waxing, stars };
  }

  function draw() {
    if (!state || R <= 0) return;
    const { sun, moon, stars } = state;
    ctx.clearRect(0, 0, size, size);

    // Sky brightness: 1 at night, fades out through twilight into day.
    const night = Math.min(1, Math.max(0, (-sun.alt - 0) / 12));
    const starAlpha = 0.4 + 0.6 * night;

    // Graticule: horizon, altitude rings, azimuth ticks, cardinal points.
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink(0.55);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = ink(0.22);
    for (const a of [30, 60]) {
      ctx.beginPath(); ctx.arc(cx, cy, ((90 - a) / 90) * R, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
    ctx.strokeStyle = ink(0.4); ctx.stroke();
    ctx.beginPath();
    for (let az = 0; az < 360; az += 5) {
      const l = az % 30 === 0 ? 8 : az % 10 === 0 ? 5 : 2.5;
      const [x1, y1] = project(0, az);
      const [x2, y2] = project(0 - (l / R) * 90, az);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.strokeStyle = ink(0.5); ctx.stroke();
    for (const [lbl, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const [x, y] = project(-12, az);
      text(lbl, x, y + 4, ink(0.85), 11, 'center');
    }
    for (const a of [30, 60]) {
      const [x, y] = project(a, 135);
      text(`${a}°`, x + 3, y - 3, ink(0.35), 8);
    }

    // Constellation outlines (only segments with both ends up).
    const up = new Map(stars.filter(s => s.alt > 0).map(s => [s.name, s]));
    ctx.beginPath();
    for (const [a, b] of LINES) {
      const s1 = up.get(a), s2 = up.get(b);
      if (!s1 || !s2) continue;
      const [x1, y1] = project(s1.alt, s1.az), [x2, y2] = project(s2.alt, s2.az);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.strokeStyle = ink(0.22 * starAlpha + 0.05);
    ctx.stroke();

    // Stars.
    plotted = [];
    for (const s of up.values()) {
      const [x, y] = project(s.alt, s.az);
      const r = Math.max(0.8, Math.min(4.6, 3.6 - 0.62 * s.mag));
      ctx.fillStyle = ink(starAlpha);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      plotted.push({ ...s, x, y, r });
      if (LABELLED.has(s.name)) text(s.name.toUpperCase(), x + r + 4, y + 3, ink(0.55 * starAlpha + 0.1), 8);
    }

    // Sun and Moon, when above the horizon.
    if (sun.alt > -0.8) {
      const [x, y] = project(Math.max(sun.alt, 0), sun.az);
      ctx.strokeStyle = acc(0.9);
      ctx.fillStyle = acc(0.9);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      text('SUN', x + 11, y + 3, acc(1), 8);
    }
    if (state.moon.alt > -0.5) {
      const [x, y] = project(Math.max(moon.alt, 0), moon.az);
      const k = state.moonLit;
      ctx.strokeStyle = acc(0.9);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      // Lit part: a simple phase shape (terminator as an ellipse).
      ctx.fillStyle = acc(0.85);
      ctx.beginPath();
      const dir = state.waxing ? 1 : -1;
      ctx.arc(x, y, 6, -Math.PI / 2, Math.PI / 2, dir < 0);
      ctx.ellipse(x, y, Math.abs(1 - 2 * k) * 6, 6, 0, Math.PI / 2, -Math.PI / 2, (k > 0.5) === (dir < 0));
      ctx.fill();
      text(`MOON ${Math.round(k * 100)}%`, x + 10, y + 3, acc(1), 8);
    }

    // Hovered star: reticle and readout.
    if (hover) {
      const { x, y, r } = hover;
      const s = r + 6;
      ctx.strokeStyle = acc(0.95);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(x + sx * s, y + sy * s - sy * 4);
        ctx.lineTo(x + sx * s, y + sy * s);
        ctx.lineTo(x + sx * s - sx * 4, y + sy * s);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      const label = `${hover.name.toUpperCase()} · ALT ${hover.alt.toFixed(0)}° · AZ ${hover.az.toFixed(0)}° · MAG ${hover.mag.toFixed(1)}`;
      const left = x > cx;
      text(label, left ? x - s - 6 : x + s + 6, y - s - 4, acc(1), 9, left ? 'right' : 'left');
    }

    // Readouts.
    const h = Math.floor(state.lst / 15), m = Math.floor(((state.lst / 15) - h) * 60);
    const phase = sun.alt > 0 ? 'Daylight' : sun.alt > -6 ? 'Civil twilight' : sun.alt > -12 ? 'Nautical twilight' : sun.alt > -18 ? 'Astronomical twilight' : 'Night';
    const set = (k, v) => { const o = out(k); if (o) o.textContent = v; };
    set('phase', phase);
    set('count', String(up.size));
    set('lst', `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    set('sun', `${sun.alt >= 0 ? '+' : ''}${sun.alt.toFixed(0)}°`);
    set('moon', `${Math.round(state.moonLit * 100)}% · ${state.moon.alt >= 0 ? 'up' : 'set'}`);
  }

  canvas.addEventListener('pointermove', e => {
    const b = canvas.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null, bd = 16 * 16;
    for (const p of plotted) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    if (best !== hover) { hover = best; draw(); }
  });
  canvas.addEventListener('pointerleave', () => { hover = null; draw(); });

  // Redraw whenever the map's own size changes (also covers late layout).
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
  } else {
    window.addEventListener('resize', () => { resize(); draw(); });
  }

  const start = () => { resize(); compute(); draw(); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
  setInterval(() => { compute(); draw(); }, 30000);
})();
