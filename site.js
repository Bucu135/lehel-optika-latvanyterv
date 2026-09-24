/* Lehel Optika · látványterv — nyelv, élő nyitvatartás, foglaló, fókusz-teszt, motion */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  /* ---------- Üzletek + nyitvatartás (0 = vasárnap) ---------- */
  const STORES = {
    kaufland: { name: 'Kaufland', hours: [[9, 17], [9, 20], [9, 20], [9, 20], [9, 20], [9, 20], [9, 20]] },
    bethlen:  { name: 'Bethlen G. 13', hours: [null, [9, 17], [9, 17], [9, 17], [9, 17], [9, 17], null] }
  };

  /* ---------- Dinamikus szövegek ---------- */
  const T = {
    hu: {
      openUntil: h => `Most nyitva · ${h}:00-ig`,
      opensToday: h => `Zárva · ma ${h}:00-kor nyit`,
      opensTomorrow: h => `Zárva · holnap ${h}:00-kor nyit`,
      opensOn: (d, h) => `Zárva · ${d} ${h}:00-kor nyit`,
      today: 'Ma', tomorrow: 'Holnap',
      pickTime: 'Válasszon időpontot.',
      noSlots: 'Erre a napra már nincs szabad időpont.',
      reasons: { exam: 'látásvizsgálat', consult: 'ingyenes konzultáció', frames: 'keretválasztás', lens: 'kontaktlencse' },
      storeLong: { kaufland: 'Kaufland (Bethlen G. 79)', bethlen: 'Bethlen G. 13' },
      sum: (s, d, t, r) => `${s} · ${d}, ${t} · ${r}`,
      sms: (n, d, t, r, s, rem) => `Kedves ${n}! Időpontja: ${d}, ${t} – ${r}, Lehel Optika ${s}.${rem ? ' 24 órával előtte emlékeztetőt küldünk.' : ''} Lemondás: válaszoljon NEM.`,
      diopter: 'D', loc: 'hu-HU'
    },
    ro: {
      openUntil: h => `Deschis acum · până la ${h}:00`,
      opensToday: h => `Închis · deschide azi la ${h}:00`,
      opensTomorrow: h => `Închis · deschide mâine la ${h}:00`,
      opensOn: (d, h) => `Închis · deschide ${d} la ${h}:00`,
      today: 'Azi', tomorrow: 'Mâine',
      pickTime: 'Alegeți o oră.',
      noSlots: 'Pentru această zi nu mai sunt ore libere.',
      reasons: { exam: 'examinarea vederii', consult: 'consultanță gratuită', frames: 'alegerea ramei', lens: 'lentile de contact' },
      storeLong: { kaufland: 'Kaufland (Bethlen G. 79)', bethlen: 'Bethlen G. 13' },
      sum: (s, d, t, r) => `${s} · ${d}, ${t} · ${r}`,
      sms: (n, d, t, r, s, rem) => `Dragă ${n}! Programarea dvs.: ${d}, ${t} – ${r}, Lehel Optika ${s}.${rem ? ' Vă trimitem un memento cu 24 de ore înainte.' : ''} Anulare: răspundeți NU.`,
      diopter: 'D', loc: 'ro-RO'
    }
  };
  let lang = 'hu';
  const t = () => T[lang];

  /* ---------- Nyelv ---------- */
  const HU = {};
  $$('[data-i18n]').forEach(el => { HU[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l === 'ro' ? 'ro' : 'hu';
    const dict = lang === 'ro' ? (window.LOCALE_RO || {}) : HU;
    $$('[data-i18n]').forEach(el => { const v = dict[el.dataset.i18n]; if (v != null) el.innerHTML = v; });
    document.documentElement.lang = lang;
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('.chart').setAttribute('aria-label', lang === 'ro' ? 'Vedeți clar. Arătați bine.' : 'Lásson élesen. Nézzen ki jól.');
    store.set('lo-lang', lang);
    renderStatus(); renderDays(); renderSummary(); updateLens();
  }
  $$('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ---------- Idő: mindig udvarhelyi (Europe/Bucharest) ---------- */
  function localNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  const dayName = (d, style = 'long') => new Intl.DateTimeFormat(t().loc, { weekday: style }).format(d);

  function statusOf(key) {
    const now = localNow(), s = STORES[key], dow = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
    const today = s.hours[dow];
    if (today && h >= today[0] && h < today[1]) return { open: true, text: t().openUntil(today[1]) };
    if (today && h < today[0]) return { open: false, text: t().opensToday(today[0]) };
    for (let i = 1; i <= 7; i++) {
      const hh = s.hours[(dow + i) % 7];
      if (hh) {
        if (i === 1) return { open: false, text: t().opensTomorrow(hh[0]) };
        const d = new Date(now); d.setDate(d.getDate() + i);
        return { open: false, text: t().opensOn(dayName(d), hh[0]) };
      }
    }
    return { open: false, text: '' };
  }
  function renderStatus() {
    const dow = localNow().getDay();
    $$('[data-store]').forEach(el => {
      const key = el.dataset.store; if (!STORES[key]) return;
      const st = statusOf(key);
      const target = el.classList.contains('store') ? $('.store-live', el) : el;
      target.classList.toggle('open', st.open); target.classList.toggle('closed', !st.open);
      $('.st-text', el).textContent = st.text;
      // a mai sor kiemelése a nyitvatartás-táblában
      const rows = $$('.hours dt', el);
      if (rows.length) {
        const idx = key === 'kaufland' ? (dow === 0 ? 1 : 0) : (dow === 0 || dow === 6 ? 1 : 0);
        rows.forEach((r, i) => { r.classList.toggle('today', i === idx); r.nextElementSibling.classList.toggle('today', i === idx); });
      }
    });
  }
  setInterval(renderStatus, 60 * 1000);

  /* ---------- Foglaló ---------- */
  const form = $('#bkForm');
  const B = { step: 1, day: null, time: null };
  const val = n => { const e = form.elements[n]; return e && (e.value ?? ''); };
  const pad = n => String(n).padStart(2, '0');

  function goStep(n) {
    B.step = n;
    $$('.bk-pane', form).forEach(p => p.classList.toggle('on', +p.dataset.pane === n));
    $$('.bk-steps li').forEach((li, i) => li.classList.toggle('on', i < Math.min(n, 3)));
    if (n === 2) renderDays();
    if (n === 3) renderSummary();
  }
  form.addEventListener('click', e => {
    if (e.target.closest('[data-next]')) goStep(B.step + 1);
    if (e.target.closest('[data-prev]')) goStep(B.step - 1);
  });
  form.addEventListener('change', e => {
    if (e.target.name === 'store') { B.day = null; B.time = null; }
  });

  function openDays(key, count = 10) {
    const s = STORES[key], out = [], now = localNow();
    for (let i = 0; out.length < count && i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const hh = s.hours[d.getDay()];
      if (!hh) continue;
      const slots = [];
      for (let m = hh[0] * 60; m <= (hh[1] - 1) * 60; m += 30) {
        const at = new Date(d); at.setMinutes(m);
        if (at - now > 60 * 60 * 1000) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
      }
      if (slots.length) out.push({ date: d, slots, rel: i });
    }
    return out;
  }
  function dayLabel(o) { return o.rel === 0 ? t().today : o.rel === 1 ? t().tomorrow : dayName(o.date, 'short'); }

  function renderDays() {
    const wrap = $('#bkDays'); if (!wrap) return;
    const days = openDays(val('store'));
    if (!B.day || !days.find(d => +d.date === +B.day)) { B.day = days[0] && days[0].date; B.time = null; }
    wrap.innerHTML = days.map(o => `<button type="button" class="day${+o.date === +B.day ? ' sel' : ''}" data-d="${+o.date}"><small>${dayLabel(o)}</small><b>${o.date.getDate()}</b><small>${new Intl.DateTimeFormat(t().loc, { month: 'short' }).format(o.date)}</small></button>`).join('');
    const cur = days.find(d => +d.date === +B.day);
    $('#bkSlots').innerHTML = cur
      ? cur.slots.map(s => `<button type="button" class="slot${s === B.time ? ' sel' : ''}" data-t="${s}">${s}</button>`).join('')
      : `<p>${t().noSlots}</p>`;
    $('#bkNext2').disabled = !B.time;
  }
  $('#bkDays').addEventListener('click', e => {
    const b = e.target.closest('.day'); if (!b) return;
    B.day = new Date(+b.dataset.d); B.time = null; renderDays();
  });
  $('#bkSlots').addEventListener('click', e => {
    const b = e.target.closest('.slot'); if (!b) return;
    B.time = b.dataset.t; renderDays();
  });

  function dateText() {
    if (!B.day) return '';
    return new Intl.DateTimeFormat(t().loc, { weekday: 'long', month: 'long', day: 'numeric' }).format(B.day);
  }
  function renderSummary() {
    const el = $('#bkSum'); if (!el || !B.time) return;
    el.textContent = t().sum(t().storeLong[val('store')], dateText(), B.time, t().reasons[val('reason')]);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.elements.name, phone = form.elements.phone;
    const okName = name.value.trim().length > 1;
    const okPhone = phone.value.replace(/\D/g, '').length >= 9;
    name.classList.toggle('err', !okName); phone.classList.toggle('err', !okPhone);
    if (!okName) return name.focus();
    if (!okPhone) return phone.focus();
    const first = name.value.trim().split(/\s+/).pop();
    $('#smsText').textContent = t().sms(first, dateText(), B.time, t().reasons[val('reason')], t().storeLong[val('store')], form.elements.remind.checked);
    goStep(4);
  });
  $('#bkReset').addEventListener('click', () => { form.reset(); B.day = B.time = null; $('#smsText').textContent = ''; goStep(1); });

  /* ---------- Fókusz-teszt ---------- */
  const range = $('#ftRange');
  function updateLens() {
    if (!range) return;
    const v = +range.value / 100;
    $('#ftChart').style.setProperty('--b', `${((1 - v) * 7).toFixed(2)}px`);
    const d = -3 * (1 - v);
    $('#ftVal').textContent = `${d === 0 ? '0.00' : '−' + Math.abs(d).toFixed(2)} ${t().diopter}`;
    $('#ftOk').classList.toggle('on', v >= .94);
  }
  range && range.addEventListener('input', updateLens);

  /* ---------- Fejléc, menü, aktív link ---------- */
  const nav = $('.nav'), mbar = $('.mbar');
  const burger = $('.burger'), drawer = $('.drawer');
  function toggleDrawer(open) {
    burger.setAttribute('aria-expanded', String(open));
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => toggleDrawer(burger.getAttribute('aria-expanded') !== 'true'));
  $$('.drawer a').forEach(a => a.addEventListener('click', () => toggleDrawer(false)));

  const heroImg = $('.hero-photo img');
  const bookSec = $('#foglalas');
  let ticking = false;
  function onScroll() {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 30);
    // a lebegő sáv eltűnik, amíg a foglaló látszik
    const r = bookSec.getBoundingClientRect();
    mbar.classList.toggle('hide', y < 200 || (r.top < innerHeight && r.bottom > 0));
    if (!reduced && heroImg && y < innerHeight * 1.2) heroImg.style.transform = `translate3d(0, ${(-y * 0.12).toFixed(1)}px, 0)`;
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  const links = $$('.nav-links a');
  const secIO = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => { const s = $(a.getAttribute('href')); s && secIO.observe(s); });

  /* ---------- Reveal: két irányba ---------- */
  const rvIO = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('shown', en.isIntersecting)),
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.rv').forEach(el => rvIO.observe(el));

  /* ---------- Számláló ---------- */
  const cIO = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting || reduced) return;
    const el = en.target, to = +el.dataset.count, from = to > 100 ? to - 25 : 0, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach(el => cIO.observe(el));

  /* ---------- Indulás ---------- */
  setLang(store.get('lo-lang') || 'hu');
  goStep(1);
  onScroll();
  const ready = () => document.body.classList.add('is-ready');
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(ready, 120));
  setTimeout(ready, 1500);
})();
