// Small interactions: live clocks, weather readout, scroll reveals, lightbox.
(() => {
  const pad = n => String(n).padStart(2, '0');

  const clocks = () => document.querySelectorAll('[data-clock]');
  const localFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const tick = () => {
    const d = new Date();
    const s = `UTC ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    clocks().forEach(el => { el.textContent = s; });
    document.querySelectorAll('[data-clock-utc]').forEach(el => { el.textContent = s.slice(4); });
    document.querySelectorAll('[data-local]').forEach(el => { el.textContent = localFmt.format(d); });
  };

  // Live weather (Open-Meteo, no key). Refreshes every 15 minutes.
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=50.67&longitude=4.61' +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m' +
    '&wind_speed_unit=kmh&timezone=auto';
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const weather = async () => {
    const slots = document.querySelectorAll('[data-weather]');
    if (!slots.length) return;
    try {
      const res = await fetch(WEATHER_URL);
      if (!res.ok) throw new Error(res.status);
      const c = (await res.json()).current;
      const values = {
        temp: `${c.temperature_2m.toFixed(1)}°C`,
        feels: `${c.apparent_temperature.toFixed(1)}°C`,
        humidity: `${Math.round(c.relative_humidity_2m)}%`,
        wind: `${Math.round(c.wind_speed_10m)} km/h ${COMPASS[Math.round(c.wind_direction_10m / 45) % 8]}`
      };
      slots.forEach(el => { el.textContent = values[el.dataset.weather] ?? '--'; });
    } catch (e) {
      slots.forEach(el => { el.textContent = '--'; });
    }
  };

  const reveal = () => {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach((el, i) => {
      el.style.setProperty('--d', `${(i % 6) * 70}ms`);
      io.observe(el);
    });
  };

  // Full-view lightbox for images inside posts: shows the whole picture.
  const lightbox = () => {
    const imgs = document.querySelectorAll('.post-cover img, .prose img');
    if (!imgs.length) return;
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    box.innerHTML = '<img alt=""><button class="lightbox__close mono" type="button">Close ✕</button>';
    document.body.appendChild(box);
    const big = box.querySelector('img');
    const close = () => { box.classList.remove('is-open'); document.body.style.overflow = ''; };
    imgs.forEach(img => {
      img.classList.add('zoomable');
      img.tabIndex = 0;
      const open = () => {
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        box.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        box.querySelector('button').focus();
      };
      img.addEventListener('click', open);
      img.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });
    box.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  };

  document.addEventListener('DOMContentLoaded', () => {
    tick();
    setInterval(tick, 1000);
    weather();
    setInterval(weather, 15 * 60 * 1000);
    reveal();
    lightbox();
  });
})();
