/*
 * Background: a living technical sheet, drawn on a canvas.
 * Performance: static and slow layers are pre-rendered to offscreen canvases
 * (grid once per resize, contours ~8 fps, data column on change, node links
 * re-paired every ~0.3 s). Each frame only composites those images with a
 * parallax offset and draws the few moving marks on top.
 */
(() => {
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const INK = '22,21,20';
  const ACC = '224,40,79';
  const FONT = '"JetBrains Mono", ui-monospace, monospace';
  const ink = a => `rgba(${INK},${a})`;
  const acc = a => `rgba(${ACC},${a})`;
  const PAD = 60; // room for parallax around offscreen layers

  let W = 0, H = 0, DPR = 1;
  let t = 0;
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, px: 0, py: 0, on: false };

  let seedState = 1;
  const rnd = () => (seedState = (seedState * 16807) % 2147483647) / 2147483647;

  const layer = () => {
    const c = document.createElement('canvas');
    return { c, x: c.getContext('2d') };
  };
  const gridL = layer();
  const contourL = layer();
  const streamL = layer();

  let nodes = [];
  let links = [];
  let index = [];
  let stream = [];
  const targets = [
    { node: null, start: -10, life: 5.2 },
    { node: null, start: -10, life: 6.4 }
  ];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  const LABELS = ['SURFACE', 'SIGNAL', 'ARCHIVE', 'FIELD', 'NOISE'];

  const hex = () =>
    Math.floor(rnd() * 0xffffff).toString(16).padStart(6, '0').toUpperCase() +
    ' ' + (rnd() * 99.99).toFixed(2).padStart(5, '0');

  function sizeLayer(l, w, h) {
    l.c.width = Math.round(w * DPR);
    l.c.height = Math.round(h * DPR);
    l.x.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function seed() {
    seedState = 20261126;
    const count = Math.min(Math.round((W * H) / 80000) + 8, 34);
    nodes = Array.from({ length: count }, () => ({
      x: rnd() * W, y: rnd() * H,
      vx: (rnd() - 0.5) * 0.1, vy: (rnd() - 0.5) * 0.1,
      id: 100 + Math.floor(rnd() * 899),
      conf: 0.6 + rnd() * 0.39,
      labelled: rnd() < 0.25
    }));
    const n = W < 760 ? 0 : 5;
    index = Array.from({ length: n }, (_, i) => ({
      numeral: ROMAN[i], label: LABELS[i],
      y: H * (0.38 + (i * 0.48) / Math.max(n - 1, 1)),
      node: nodes[Math.floor(rnd() * nodes.length)]
    }));
    stream = Array.from({ length: 30 }, hex);
    pairLinks();
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sizeLayer(gridL, W + PAD * 2, H + PAD * 2);
    sizeLayer(contourL, W + PAD * 2, H + PAD * 2);
    sizeLayer(streamL, 160, Math.ceil(H * 0.42));
    seed();
    paintGrid();
    paintContours();
    paintStream();
  }

  const off = d => [(0.5 - mouse.x) * 70 * d, (0.5 - mouse.y) * 50 * d];

  function text(c, str, x, y, color, size = 10, align = 'left') {
    c.font = `${size}px ${FONT}`;
    c.fillStyle = color;
    c.textAlign = align;
    c.fillText(str, x, y);
  }

  // --- Offscreen layers ---------------------------------------------------
  function paintGrid() {
    const c = gridL.x, w = W + PAD * 2, h = H + PAD * 2, step = 40;
    c.clearRect(0, 0, w, h);
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x < w; x += step) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); }
    for (let y = 0; y < h; y += step) { c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); }
    c.strokeStyle = ink(0.05);
    c.stroke();
    c.beginPath();
    for (let x = 0; x < w; x += step * 2) {
      for (let y = 0; y < h; y += step * 2) {
        c.moveTo(x - 4, y + 0.5); c.lineTo(x + 4, y + 0.5);
        c.moveTo(x + 0.5, y - 4); c.lineTo(x + 0.5, y + 4);
      }
    }
    c.strokeStyle = ink(0.18);
    c.stroke();
  }

  function ring(c, cx, cy, r, k, phase) {
    c.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const d = Math.sin(a * 3 + phase * 0.2 + k * 0.7) * 7 +
        Math.sin(a * 5 - phase * 0.13 + k) * 4 +
        Math.sin(a * 2 + k * 1.3) * 10;
      const x = cx + Math.cos(a) * (r + d) * 1.25;
      const y = cy + Math.sin(a) * (r + d);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }

  function paintContours() {
    const c = contourL.x;
    c.clearRect(0, 0, W + PAD * 2, H + PAD * 2);
    c.lineWidth = 1;
    const fields = [
      { x: W * 0.74 + PAD, y: H * 0.36 + PAD, n: 10, r: 40 },
      { x: W * 0.18 + PAD, y: H * 0.78 + PAD, n: 6, r: 30 }
    ];
    for (const f of fields) {
      for (let k = 0; k < f.n; k++) {
        c.strokeStyle = ink(k % 4 === 0 ? 0.12 : 0.06);
        ring(c, f.x, f.y, f.r + k * 26, k, t);
      }
    }
    c.strokeStyle = acc(0.35);
    c.setLineDash([2, 5]);
    ring(c, fields[0].x, fields[0].y, fields[0].r + 4 * 26, 4, t);
    c.setLineDash([]);
  }

  function paintStream() {
    const c = streamL.x, h = H * 0.42;
    c.clearRect(0, 0, 160, h);
    const rows = Math.min(stream.length, Math.floor(h / 13));
    c.font = `9px ${FONT}`;
    c.textAlign = 'left';
    for (let i = 0; i < rows; i++) {
      c.fillStyle = ink(0.06 + (i / rows) * 0.22);
      c.fillText(stream[stream.length - rows + i], 0, 10 + i * 13);
    }
  }

  function pairLinks() {
    links = [];
    const max2 = 150 * 150;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        if (dx * dx + dy * dy < max2) links.push(i, j);
      }
    }
  }

  // --- Per-frame marks ----------------------------------------------------
  function drawDial() {
    const [ox, oy] = off(0.22);
    const R = Math.min(W, H) * 0.09 + 30;
    const cx = Math.min(W * 0.13, 190) + ox, cy = H * 0.3 + oy;
    const rot = t * 0.08;
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink(0.18);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 72; i += 1) {
      const a = rot + (i / 72) * Math.PI * 2, l = i % 6 === 0 ? 10 : 4;
      ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l));
    }
    ctx.strokeStyle = ink(0.32);
    ctx.stroke();
    const sweep = -rot * 2.3;
    ctx.strokeStyle = acc(0.8);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R + 6, sweep, sweep + 0.5); ctx.stroke();
    ctx.lineWidth = 1;
    const az = (((sweep * 180) / Math.PI) % 360 + 360) % 360;
    text(ctx, `AZ ${az.toFixed(1).padStart(5, '0')}°`, cx - R, cy + R + 22, ink(0.5));
  }

  function drawNodes(ox, oy) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < links.length; k += 2) {
      const a = nodes[links[k]], b = nodes[links[k + 1]];
      ctx.moveTo(a.x + ox, a.y + oy);
      ctx.lineTo(b.x + ox, b.y + oy);
    }
    ctx.strokeStyle = ink(0.08);
    ctx.stroke();
    ctx.fillStyle = ink(0.6);
    for (const n of nodes) ctx.fillRect(n.x + ox - 1.5, n.y + oy - 1.5, 3, 3);
    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = ink(0.32);
    ctx.textAlign = 'left';
    for (const n of nodes) if (n.labelled) ctx.fillText(`N.${n.id}`, n.x + ox + 6, n.y + oy - 5);
  }

  function drawIndex(ox, oy) {
    if (!index.length) return;
    const [ix, iy] = off(0.08);
    const x = W - 64 + ix;
    ctx.lineWidth = 1;
    for (const e of index) {
      const y = e.y + iy, n = e.node;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = ink(0.16);
      ctx.beginPath(); ctx.moveTo(x - 120, y); ctx.lineTo(x - 14, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = ink(0.22);
      ctx.beginPath(); ctx.moveTo(x - 120, y); ctx.lineTo(n.x + ox, n.y + oy); ctx.stroke();
      ctx.strokeStyle = ink(0.5);
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
      text(ctx, e.numeral, x, y + 3.5, ink(0.8), 9, 'center');
      text(ctx, e.label, x - 122, y - 7, ink(0.38), 9);
    }
  }

  function drawTargets(ox, oy) {
    for (let k = 0; k < targets.length; k++) {
      const tg = targets[k];
      const age = t - tg.start;
      if (!tg.node || age > tg.life) {
        tg.node = nodes[Math.floor(Math.random() * nodes.length)];
        tg.start = t + k * 1.7;
        tg.code = Math.floor(Math.random() * 9000 + 1000);
        continue;
      }
      if (age < 0) continue;
      const n = tg.node, x = n.x + ox, y = n.y + oy;
      const lockT = Math.min(age / 0.7, 1);
      const s = 70 - (1 - Math.pow(1 - lockT, 3)) * 48;
      const fade = age > tg.life - 0.6 ? (tg.life - age) / 0.6 : 1;
      const locked = lockT >= 1, c = 7;
      ctx.strokeStyle = locked ? acc(0.95 * fade) : ink(0.6 * fade);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const px = x + sx * s, py = y + sy * s;
        ctx.moveTo(px, py - sy * c); ctx.lineTo(px, py); ctx.lineTo(px - sx * c, py);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      if (!locked) continue;
      const lx = x + s + 26, ly = y - s - 18;
      ctx.strokeStyle = acc(0.55 * fade);
      ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(lx - 4, ly + 4); ctx.lineTo(lx + 150, ly + 4); ctx.stroke();
      const hdg = Math.round(((Math.atan2(n.vy, n.vx) * 180) / Math.PI + 360) % 360);
      const lines = [
        `TRK-${tg.code} ▸ LOCK`,
        `OBJ N.${n.id}  CONF ${n.conf.toFixed(2)}`,
        `VEL ${Math.hypot(n.vx, n.vy).toFixed(3)}  HDG ${String(hdg).padStart(3, '0')}°`
      ];
      let budget = Math.floor((age - 0.7) * 38);
      lines.forEach((ln, i) => {
        const show = Math.max(0, Math.min(ln.length, budget));
        budget -= ln.length;
        if (show) text(ctx, ln.slice(0, show), lx, ly - 24 + i * 12, i === 0 ? acc(fade) : ink(0.65 * fade), i === 0 ? 10 : 9);
      });
    }
  }

  function drawScan() {
    const y = ((t * 26) % (H + 160)) - 80;
    ctx.fillStyle = ink(0.025);
    ctx.fillRect(0, y - 36, W, 36);
    ctx.strokeStyle = ink(0.16);
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    text(ctx, `SCAN ${String(Math.max(0, Math.round(y))).padStart(4, '0')}`, 46, y - 6, ink(0.4), 9);
  }

  function drawCursor(ox, oy) {
    if (!mouse.on) return;
    const x = mouse.px, y = mouse.py;
    ctx.strokeStyle = ink(0.08);
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5);
    ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H);
    ctx.stroke();
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 14;
    ctx.strokeStyle = ink(0.5);
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    let best = null, bd = 240 * 240;
    for (const n of nodes) {
      const dx = n.x + ox - x, dy = n.y + oy - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = n; }
    }
    if (best) {
      const nx = best.x + ox, ny = best.y + oy;
      ctx.strokeStyle = acc(0.75);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.strokeRect(nx - 5, ny - 5, 10, 10);
      text(ctx, `N.${best.id} · ${Math.round(Math.sqrt(bd))}PX`, nx + 10, ny + 14, acc(0.95), 9);
    }
    text(ctx, `X ${String(Math.round(x)).padStart(4, '0')}  Y ${String(Math.round(y)).padStart(4, '0')}`, x + 22, y - 18, ink(0.6), 9);
  }

  // --- Loop ---------------------------------------------------------------
  let lastContour = 0, lastStream = 0, lastPair = 0;
  function update(dt) {
    if (!reduce) {
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -40) n.x = W + 40; else if (n.x > W + 40) n.x = -40;
        if (n.y < -40) n.y = H + 40; else if (n.y > H + 40) n.y = -40;
      }
      if (t - lastContour > 0.12) { paintContours(); lastContour = t; }
      if (t - lastStream > 0.35) { stream.shift(); stream.push(hex()); paintStream(); lastStream = t; }
      if (t - lastPair > 0.3) { pairLinks(); lastPair = t; }
    }
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const [gx, gy] = off(0.12);
    const step = 80;
    ctx.drawImage(gridL.c, (gx % step) - step, (gy % step) - step, W + PAD * 2, H + PAD * 2);
    const [cx, cy] = off(0.3);
    ctx.drawImage(contourL.c, cx - PAD, cy - PAD, W + PAD * 2, H + PAD * 2);
    if (W >= 760) {
      const [sx, sy] = off(0.05);
      ctx.drawImage(streamL.c, 46 + sx, H * 0.5 + sy, 160, H * 0.42);
    }
    drawDial();
    const [ox, oy] = off(0.6);
    drawNodes(ox, oy);
    drawIndex(ox, oy);
    drawScan();
    drawTargets(ox, oy);
    drawCursor(ox, oy);
  }

  // Home: pause while the credits panel fully covers the pinned hero.
  let visible = true;
  let last = performance.now();
  const cover = document.querySelector('.is-home .credits');
  if (cover) {
    window.addEventListener('scroll', () => {
      const was = visible;
      visible = cover.getBoundingClientRect().top > 0;
      if (visible && !was && !reduce) { last = performance.now(); requestAnimationFrame(frame); }
    }, { passive: true });
  }

  function frame(now) {
    if (!visible) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); if (reduce) draw(); }, 120);
  });
  window.addEventListener('pointermove', e => {
    mouse.tx = e.clientX / W; mouse.ty = e.clientY / H;
    mouse.px = e.clientX; mouse.py = e.clientY;
    mouse.on = e.pointerType === 'mouse';
    if (reduce) draw();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { mouse.on = false; });

  const start = () => { resize(); reduce ? draw() : requestAnimationFrame(frame); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
})();
