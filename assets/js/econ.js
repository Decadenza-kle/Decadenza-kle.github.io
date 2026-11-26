// Economic indicator windows on the About page.
// Public data, fetched by the visitor's browser: Eurostat and the ECB (no keys).
(() => {
  const wins = document.querySelectorAll('[data-econ]');
  if (!wins.length) return;

  const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/';
  const SERIES = {
    gdp: {
      url: EUROSTAT + 'namq_10_gdp?geo=BE&unit=CLV_PCH_SM&s_adj=SCA&na_item=B1GQ&lastTimePeriod=12',
      parse: 'eurostat', form: 'bar', dp: 1, step: 'q/q'
    },
    rate: {
      url: 'https://data-api.ecb.europa.eu/service/data/IRS/M.BE.L.L40.CI.0000.EUR.N.Z?lastNObservations=24&format=jsondata',
      parse: 'ecb', form: 'line', dp: 2, step: 'm/m'
    },
    emp: {
      url: EUROSTAT + 'lfsi_emp_q?geo=BE&indic_em=EMP_LFS&unit=PC_POP&age=Y20-64&sex=T&s_adj=SA&lastTimePeriod=12',
      parse: 'eurostat', form: 'line', dp: 1, step: 'q/q'
    }
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const period = id => {
    let m = /^(\d{4})-Q(\d)$/.exec(id);
    if (m) return `Q${m[2]} ${m[1]}`;
    m = /^(\d{4})-(\d{2})$/.exec(id);
    if (m) return `${MONTHS[+m[2] - 1]} ${m[1]}`;
    return id;
  };

  const parsers = {
    eurostat(j) {
      const idx = j.dimension.time.category.index;
      return Object.keys(idx)
        .sort((a, b) => idx[a] - idx[b])
        .map(t => ({ t, v: j.value[idx[t]] }))
        .filter(p => typeof p.v === 'number');
    },
    ecb(j) {
      const obs = Object.values(j.dataSets[0].series)[0].observations;
      const times = j.structure.dimensions.observation[0].values;
      return Object.keys(obs)
        .map(Number)
        .sort((a, b) => a - b)
        .map(i => ({ t: times[i].id, v: obs[i][0] }))
        .filter(p => typeof p.v === 'number');
    }
  };

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const div = (cls, parent) => {
    const e = document.createElement('div');
    e.className = cls;
    parent.appendChild(e);
    return e;
  };

  // Plot in a 0-100 box stretched to the window; strokes stay 1px.
  function plot(box, pts, cfg) {
    box.textContent = '';
    const vals = pts.map(p => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (cfg.form === 'bar') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const span = hi - lo || 1;
    lo -= span * 0.12; hi += span * 0.12;
    if (cfg.form === 'bar' && Math.min(...vals) >= 0) lo = 0;
    const n = pts.length;
    const Y = v => 100 - ((v - lo) / (hi - lo)) * 100;
    const X = cfg.form === 'bar' ? i => ((i + 0.5) / n) * 100 : i => (i / (n - 1)) * 100;

    // Thin marks only: a hairline (or stems from zero) and a dot per observation.
    const svg = svgEl('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (cfg.form === 'bar') {
      const y0 = Y(0);
      pts.forEach((p, i) => {
        svg.appendChild(svgEl('line', {
          x1: X(i), x2: X(i), y1: y0, y2: Y(p.v),
          class: 'econ__stem', 'vector-effect': 'non-scaling-stroke'
        }));
      });
    } else {
      svg.appendChild(svgEl('polyline', {
        points: pts.map((p, i) => `${X(i)},${Y(p.v)}`).join(' '),
        class: 'econ__line', 'vector-effect': 'non-scaling-stroke'
      }));
    }
    box.appendChild(svg);

    // Dotted baseline: zero for growth, the series low for levels.
    const bottom = cfg.form === 'bar' ? Math.min(0, ...vals) : Math.min(...vals);
    const base = div('econ__base', box);
    base.style.top = `${Y(cfg.form === 'bar' ? 0 : bottom)}%`;

    const dots = pts.map((p, i) => {
      const d = div(i === n - 1 ? 'econ__pt is-last' : 'econ__pt', box);
      d.style.left = `${X(i)}%`;
      d.style.top = `${Y(p.v)}%`;
      return d;
    });

    // Range labels at the high and low values.
    for (const v of [Math.max(...vals), bottom]) {
      const lbl = div('econ__y mono', box);
      lbl.textContent = v.toFixed(cfg.dp);
      lbl.style.top = `${Y(v)}%`;
    }

    // Hover: dashed guide and a readout in the accent, like the star map.
    const guide = div('econ__guide', box);
    const tip = div('econ__tip mono', box);
    let on = null;
    box.addEventListener('pointermove', e => {
      const b = box.getBoundingClientRect();
      const fx = Math.min(Math.max((e.clientX - b.left) / b.width, 0), 1);
      const i = cfg.form === 'bar' ? Math.min(n - 1, Math.floor(fx * n)) : Math.round(fx * (n - 1));
      const x = X(i);
      guide.style.left = tip.style.left = `${x}%`;
      tip.textContent = `${period(pts[i].t)} · ${pts[i].v.toFixed(cfg.dp)}%`;
      tip.classList.toggle('is-left', x > 55);
      if (on) on.classList.remove('is-on');
      on = dots[i];
      on.classList.add('is-on');
      box.classList.add('is-hover');
    });
    box.addEventListener('pointerleave', () => {
      box.classList.remove('is-hover');
      if (on) on.classList.remove('is-on');
    });
  }

  async function load(win) {
    const cfg = SERIES[win.dataset.econ];
    const out = k => win.querySelector(`[data-econ-out="${k}"]`);
    try {
      const res = await fetch(cfg.url);
      if (!res.ok) throw new Error(res.status);
      const pts = parsers[cfg.parse](await res.json());
      if (pts.length < 2) throw new Error('no data');
      const last = pts[pts.length - 1], prev = pts[pts.length - 2];
      const d = last.v - prev.v;
      out('value').textContent = `${last.v.toFixed(cfg.dp)}%`;
      out('delta').textContent = `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(cfg.dp)} pt vs ${period(prev.t).split(' ')[0]}`;
      out('from').textContent = period(pts[0].t);
      out('to').textContent = period(last.t);
      plot(out('plot'), pts, cfg);
      win.setAttribute('aria-label', `${win.getAttribute('aria-label')}. Latest ${period(last.t)}: ${last.v.toFixed(cfg.dp)}%.`);
    } catch (e) {
      out('plot').textContent = 'Data unavailable';
      out('plot').classList.add('is-empty');
    }
  }

  wins.forEach(load);
})();
