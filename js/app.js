/* =============================================================================
 * app.js — Portfolio Carlijn Corporaal (client-side, hash-routing)
 * -----------------------------------------------------------------------------
 * Alle inhoud komt uit data/pakket.json. Geen server, geen API-calls,
 * geen tracking. Pagina's: home (kleurindex), case, al het werk, about me,
 * aanbevelingsbrief, experience, skills, references.
 * ========================================================================== */

(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const STORE = { lang: 'cc_lang' };

  const state = {
    pakket: null,
    lang: localStorage.getItem(STORE.lang) || 'en',
    _rotTimers: [],
    _bmTimer: null
  };

  /* ---- Interface-teksten (labels; content komt uit pakket.json) ---------- */
  const I18N = {
    en: {
      navHome:'Home', navAbout:'ABOUT ME', navAllWork:'ALL WORK', navExp:'EXPERIENCE',
      navSkills:'SKILLS', navRefs:'REFERENCES',
      navLetter1:'LETTER OF RECOMMENDATION (1)', navLetter2:'LETTER OF RECOMMENDATION (2)',
      callMe:'CALL ME', emailMe:'EMAIL ME', connectMe:'CONNECT ME',
      getInTouch:"Let's. get. in. touch.", buildTogether:'Let’s. build. something. together.',
      available:'Available from September 2026',
      expTitle:'Experience', projTitle:'Projects', skillsTitle:'Skills & tools', refsTitle:'References',
      selectedWork:'Selected work', moreWork:'More work',
      roleWord:'ROLE', viewProjectIdx:'View Project',
      letterKicker:'Letter of Recommendation', readLetter:'Read recommendation letter',
      readPdf:'Read the original (PDF)', backToRefs:'← All references',
      backToProjects:'← Back to projects', projectVisuals:'Visuals from the project',
      noVisuals:'Add page images to assets/broadcast/ to fill this gallery.', result:'Result',
      relation:'Relation', emptyList:'Nothing here yet.',
      footerMeta:'Static portfolio · no tracking, no cookies.',
      loadError:'Could not load pakket.json. Run the site via a local web server (see README).'
    },
    nl: {
      navHome:'Home', navAbout:'OVER MIJ', navAllWork:'AL HET WERK', navExp:'ERVARING',
      navSkills:'VAARDIGHEDEN', navRefs:'REFERENTIES',
      navLetter1:'AANBEVELINGSBRIEF (1)', navLetter2:'AANBEVELINGSBRIEF (2)',
      callMe:'BEL ME', emailMe:'MAIL ME', connectMe:'CONNECT MET ME',
      getInTouch:"Let's. get. in. touch.", buildTogether:'Let’s. build. something. together.',
      available:'Beschikbaar vanaf september 2026',
      expTitle:'Ervaring', projTitle:'Projecten', skillsTitle:'Vaardigheden & tools', refsTitle:'Referenties',
      selectedWork:'Uitgelicht werk', moreWork:'Meer werk',
      roleWord:'ROL', viewProjectIdx:'Bekijk project',
      letterKicker:'Aanbevelingsbrief', readLetter:'Lees de aanbevelingsbrief',
      readPdf:'Lees het origineel (PDF)', backToRefs:'← Alle referenties',
      backToProjects:'← Terug naar projecten', projectVisuals:'Visuals uit het project',
      noVisuals:'Zet pagina-afbeeldingen in assets/broadcast/ om deze galerij te vullen.', result:'Resultaat',
      relation:'Relatie', emptyList:'Hier staat nog niets.',
      footerMeta:'Statisch portfolio · geen tracking, geen cookies.',
      loadError:'Kon pakket.json niet laden. Draai de site via een lokale webserver (zie README).'
    }
  };
  const t = k => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;

  /* ======================================================================
   * Opstarten
   * ==================================================================== */
  async function init() {
    $('#year').textContent = new Date().getFullYear();
    bindHeader();
    applyLangLabels();
    try {
      const res = await fetch('data/pakket.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.pakket = await res.json();
    } catch (err) {
      $('#app').innerHTML = `<div class="wrap"><div class="notice error">${escapeHtml(t('loadError'))}<br><small>${escapeHtml(String(err))}</small></div></div>`;
      console.error(err); return;
    }
    renderFooterLinks();
    bindLightbox();
    window.addEventListener('hashchange', router);
    if (!location.hash) location.hash = '#/';
    router();
  }

  /* ---- Lightbox (klik op afbeelding → vergroten) ------------------------- */
  function bindLightbox() {
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-lightbox]');
      if (!trigger) return;
      e.preventDefault();
      openLightbox(trigger.getAttribute('data-lightbox'), trigger.getAttribute('data-caption') || '');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
  }
  function openLightbox(src, caption) {
    let lb = $('#lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'lightbox'; lb.className = 'lightbox no-print';
      lb.innerHTML = `<button class="lb-close" aria-label="Close">×</button>
        <figure class="lb-figure"><img alt="" /><figcaption></figcaption></figure>`;
      document.body.appendChild(lb);
      lb.addEventListener('click', ev => { if (ev.target === lb || ev.target.classList.contains('lb-close')) closeLightbox(); });
    }
    lb.querySelector('img').src = src;
    lb.querySelector('figcaption').textContent = caption;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    const lb = $('#lightbox'); if (lb) lb.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ---- Header / taal ----------------------------------------------------- */
  function bindHeader() {
    const toggle = $('#nav-toggle'), nav = $('#site-nav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('[data-nav]').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
    }));
    $$('.lang-btn').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  }

  function setLang(lang) {
    state.lang = lang; localStorage.setItem(STORE.lang, lang);
    document.documentElement.lang = lang;
    applyLangLabels(); renderFooterLinks(); router();
  }

  function applyLangLabels() {
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
    document.documentElement.lang = state.lang;
  }

  /* ---- Footer: contactknoppen (CALL / EMAIL / CONNECT) ------------------ */
  function renderFooterLinks() {
    const box = $('#footer-links');
    if (!box || !state.pakket) return;
    box.innerHTML = contactButtons();
  }

  function contactButtons() {
    const p = (state.pakket && state.pakket.profiel) || {};
    const mail = p.email
      ? 'mailto:' + p.email + (p.emailSubject ? '?subject=' + encodeURIComponent(p.emailSubject) : '')
      : '';
    return [
      p.telefoonLink ? `<a class="wix-btn" href="tel:${escapeAttr(p.telefoonLink)}">${t('callMe')}</a>` : '',
      mail ? `<a class="wix-btn" href="${escapeAttr(mail)}">${t('emailMe')}</a>` : '',
      p.linkedin ? `<a class="wix-btn" href="${escapeAttr(p.linkedin)}" target="_blank" rel="noopener">${t('connectMe')}</a>` : ''
    ].join('');
  }

  // Items van een sectie in de volgorde zoals ze in pakket.json staan.
  function getSection(type) {
    return Array.isArray(state.pakket[type]) ? state.pakket[type] : [];
  }

  /* ======================================================================
   * Router
   * ==================================================================== */
  const ROUTES = {
    '/':           renderHome,
    '/projects':   renderProjects,
    '/about':      renderAbout,
    '/experience': renderExperience,
    '/skills':     renderSkills,
    '/references': renderReferences
  };

  // Detailpagina-id uit een route halen (bv. "/project/pr-broadcast" → "pr-broadcast").
  // "broadcast" blijft als legacy-alias werken.
  function projectRouteId(route) {
    const m = route.match(/^\/project\/(.+)$/);
    if (!m) return null;
    return m[1] === 'broadcast' ? 'pr-broadcast' : m[1];
  }

  function router() {
    const route = (location.hash.replace(/^#/, '') || '/').split('?')[0];
    const pid = projectRouteId(route);
    const lid = (route.match(/^\/letter\/(.+)$/) || [])[1] || null;
    // Onbekende route (bv. een oude #/match-link) → netjes terug naar home.
    if (!pid && !lid && !ROUTES[route] && route !== '/') { location.hash = '#/'; return; }
    const view = pid ? () => renderProjectDetail(pid)
      : lid ? () => renderLetter(lid)
      : (ROUTES[route] || renderHome);
    const app = $('#app');
    clearRotators();
    app.classList.remove('fade-in'); void app.offsetWidth; // retrigger animatie
    app.innerHTML = view();
    app.classList.add('fade-in');
    // Actieve nav
    $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    bindViewEvents(route);
    bindRotators();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    bindReveal();
  }

  /* ---- Scroll-reveal (gestaggerd in beeld faden) ------------------------ */
  let _revealObs = null;
  function bindReveal() {
    if (_revealObs) _revealObs.disconnect();
    const els = $$('.card, .gallery-item, .page-head, .detail-block, .detail-cover, .detail-result, .detail-gallery-wrap, .work-band, .about-body, .letter-body');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    _revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); _revealObs.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = ((i % 6) * 55) + 'ms';
      _revealObs.observe(el);
    });
  }

  /* ---- Roterende afbeeldingen ------------------------------------------- */
  function clearRotators() { (state._rotTimers||[]).forEach(clearInterval); state._rotTimers = []; clearInterval(state._bmTimer); }
  function bindRotators() {
    $$('.rotator.multi').forEach((rot, idx) => {
      const imgs = $$('.rot-img', rot), dots = $$('.rot-dots i', rot);
      let cur = 0;
      const timer = setInterval(() => {
        imgs[cur].classList.remove('active'); if (dots[cur]) dots[cur].classList.remove('on');
        cur = (cur + 1) % imgs.length;
        imgs[cur].classList.add('active'); if (dots[cur]) dots[cur].classList.add('on');
      }, 3400 + (idx % 5) * 450); // gestaggerd zodat topics niet gelijk flippen
      state._rotTimers.push(timer);
    });
    // Klik op een rotator → lightbox met de huidige afbeelding
    $$('.rotator').forEach(rot => rot.addEventListener('click', () => {
      const active = rot.querySelector('.rot-img.active') || rot.querySelector('.rot-img');
      if (active) openLightbox(active.getAttribute('src'), rot.getAttribute('data-caption') || '');
    }));
  }

  /* ======================================================================
   * Views
   * ==================================================================== */
  function renderHome() {
    const p = state.pakket.profiel || {};
    const naam = p.naamDisplay || (p.naam || '').toUpperCase();
    const projecten = getSection('projecten');
    const featured = projecten.filter(it => it.uitgelicht);
    const rest = projecten.filter(it => !it.uitgelicht);

    return `<section class="hero-wix">
      <h1 class="hero-huge">${escapeHtml(naam)}</h1>
      <div class="hero-row">
        <p class="hero-role">${escapeHtml(p.titel || '')}</p>
        <p class="hero-tagline">${escapeHtml(p.tagline || '')}</p>
      </div>
    </section>

    <div class="work-index">
      ${featured.map((it, i) => workBand(it, i)).join('')}
    </div>

    ${rest.length ? `<section class="more-work">
      <h2>${t('moreWork')}</h2>
      <div class="more-work-list">
        ${rest.map(it => `<a class="more-work-item" href="${escapeAttr(it.detailpagina || '#/projects')}">
          <span class="mw-title">${escapeHtml(it.titel || '')}</span>
          <span class="mw-meta">${escapeHtml([it.rol, it.periode].filter(Boolean).join(' · '))}</span>
          <span class="mw-arrow" aria-hidden="true">→</span></a>`).join('')}
      </div>
    </section>` : ''}`;
  }

  /* ---- Eén projectband op de index (kleurblok) -------------------------- */
  function workBand(it, i) {
    const href = escapeAttr(it.detailpagina || '#/projects');
    const nr = typeof i === 'number' ? '(' + (i + 1) + ')' : (it.nummer || '');
    const imgs = itemImages(it);
    const cover = imgs.length
      ? `<img class="panel-img" src="${escapeAttr(imgs[0])}" alt="${escapeAttr(it.titel || '')}" loading="lazy" />`
      : '';
    return `<section class="work-band band-${escapeAttr(it.kleur || 'yellow')}">
      <div class="band-row">
        <span class="band-num">${escapeHtml(nr)}</span>
        <a class="band-title" href="${href}">${escapeHtml(it.titel || '')}</a>
        <a class="band-link" href="${href}">${t('viewProjectIdx')}</a>
        <span class="band-emoji" aria-hidden="true">(${escapeHtml(it.emoji || '')})</span>
      </div>
      <a class="band-panel panel-${escapeAttr(it.paneel || 'magenta')}" href="${href}"
         aria-label="${escapeAttr(it.titel || '')}">
        <span class="panel-frame">
          ${cover}
          <span class="panel-title title-${escapeAttr(it.titelKleur || 'blue')}">${escapeHtml((it.titel || '').replace(/\s*\(.*\)$/, ''))}</span>
        </span>
        <span class="band-meta">
          ${it.rol ? `<span>${t('roleWord')}: ${escapeHtml(it.rol)}</span>` : ''}
          ${it.type ? `<span>${escapeHtml(it.typeLabel || 'TYPE')}: ${escapeHtml(it.type)}</span>` : ''}
        </span>
      </a>
    </section>`;
  }

  /* ---- Over mij --------------------------------------------------------- */
  function renderAbout() {
    const a = state.pakket.about || {};
    const paras = (a.alinea || []).map(x => `<p>${escapeHtml(x)}</p>`).join('');
    return `<article class="about-page">
      <section class="about-hero">
        <h1 class="about-title">${escapeHtml(a.titel || '')}</h1>
        <p class="about-lead">${escapeHtml(a.lead || '')}</p>
      </section>
      <section class="about-body band-green">
        <div class="about-grid">
          <div class="about-text">
            <h2 class="about-kop">${escapeHtml(a.kop || '')}</h2>
            ${paras}
          </div>
          ${a.foto ? `<img class="about-photo" src="${escapeAttr(a.foto)}" alt="Carlijn Corporaal" loading="lazy" />` : ''}
        </div>
      </section>
    </article>`;
  }

  /* ---- Aanbevelingsbrief (eigen pagina per brief) ----------------------- */
  function renderLetter(id) {
    const list = getSection('referenties');
    const it = list.find(r => r.id === id);
    if (!it) { location.hash = '#/references'; return ''; }
    const idx = list.filter(r => r.brieftekst).indexOf(it);
    const kleur = idx === 1 ? 'skyblue' : 'green';
    const paras = (it.brieftekst || []).map(x => `<p>${escapeHtml(x)}</p>`).join('');
    return `<article class="letter-page">
      <a class="back-link" href="#/references">${t('backToRefs')}</a>
      <header class="letter-head">
        <span class="letter-kicker">${t('letterKicker')} ${escapeHtml(it.nummer || '')}</span>
        <h1>${escapeHtml(it.naam || '')}</h1>
        <p class="letter-role">${escapeHtml([it.functie, it.bedrijf].filter(Boolean).join(' · '))}</p>
      </header>
      <section class="letter-body band-${kleur}">
        ${paras || `<p>${escapeHtml(t('emptyList'))}</p>`}
        ${Array.isArray(it.ondertekening) ? `<p class="letter-sign">${it.ondertekening.map(escapeHtml).join('<br>')}</p>` : ''}
      </section>
      ${it.brief ? `<div class="letter-actions"><a class="wix-btn" href="${escapeAttr(it.brief)}" target="_blank" rel="noopener">${t('readPdf')}</a></div>` : ''}
    </article>`;
  }

  /* ---- Al het werk ------------------------------------------------------ */
  function renderProjects() {
    const items = getSection('projecten');
    return pageShell(t('projTitle'),
      `<div class="work-index">${items.map((it, i) => workBand(it, i)).join('')}</div>
       ${items.length ? '' : emptyNote()}
       ${galleryBlock()}`);
  }

  function galleryBlock() {
    const g = Array.isArray(state.pakket.galerij) ? state.pakket.galerij : [];
    if (!g.length) return '';
    return `<div class="home-gallery">
      <div class="gallery-head">
        <h3>${t('selectedWork')}</h3>
      </div>
      <div class="gallery-grid">
        ${g.map(topic => `<div class="gallery-item">
          ${renderRotator(topic.afbeeldingen, 'gallery-rot', topic.titel||'')}
          <span class="gallery-cap">${escapeHtml(topic.titel||'')}${topic.afbeeldingen && topic.afbeeldingen.length>1 ? ` <em>· ${topic.afbeeldingen.length}</em>`:''}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  /* ---- Ervaring --------------------------------------------------------- */
  function renderExperience() {
    const items = getSection('werkervaring');
    return pageShell(t('expTitle'), `
      <div class="timeline">
        ${items.map(expCard).join('') || emptyNote()}
      </div>`);
  }

  function expCard(it) {
    const imgs = itemImages(it);
    return `<article class="tl-item card ${imgs.length?'has-cover':''}">
      ${renderRotator(imgs, 'card-cover cover-wide', (it.functie||'')+' — '+(it.bedrijf||''))}
      <h3>${escapeHtml(it.functie||'')}</h3>
      <p class="card-meta">${escapeHtml([it.bedrijf, it.branche, it.periode].filter(Boolean).join(' · '))}</p>
      ${it.impressie ? `<p class="card-impressie">${escapeHtml(it.impressie)}</p>` : ''}
      ${it.resultaat ? `<p class="card-result">✔ ${escapeHtml(it.resultaat)}</p>` : ''}
      ${Array.isArray(it.verantwoordelijkheden) ? `<ul class="card-list">${it.verantwoordelijkheden.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>` : ''}
      ${tagRow(it.tags)}
      ${it.detailpagina ? `<a class="card-project-link" href="${escapeAttr(it.detailpagina)}">${t('viewProjectIdx')} →</a>` : ''}
    </article>`;
  }

  /* ---- Vaardigheden ----------------------------------------------------- */
  function renderSkills() {
    const items = getSection('vaardigheden');
    return pageShell(t('skillsTitle'), `
      <div class="cards-grid skills-grid">
        ${items.map(skillCard).join('') || emptyNote()}
      </div>`);
  }

  function skillCard(it) {
    return `<article class="card skill-card">
      <h3>${escapeHtml(it.naam||'')}</h3>
      ${it.niveau ? `<p class="card-meta">${escapeHtml(it.niveau)}</p>` : ''}
      ${tagRow(it.tags)}
    </article>`;
  }

  /* ---- Referenties ------------------------------------------------------ */
  function renderReferences() {
    const items = getSection('referenties');
    // Referenties met een brief bovenaan, de rest eronder.
    const ordered = [
      ...items.filter(it => it.brieftekst || it.brief),
      ...items.filter(it => !(it.brieftekst || it.brief)),
    ];
    return pageShell(t('refsTitle'), `
      <div class="cards-grid refs-grid">
        ${ordered.map(refCard).join('') || emptyNote()}
      </div>`);
  }

  function refCard(it) {
    const citaat = (it.citaat || '').trim();
    return `<article class="card ref-card${it.brieftekst ? '' : ' ref-card--full'}">
      ${it.nummer ? `<span class="ref-num">${escapeHtml(it.nummer)}</span>` : ''}
      ${citaat ? `<blockquote>“${escapeHtml(citaat)}”</blockquote>` : ''}
      <p class="ref-name"><strong>${escapeHtml(it.naam || '')}</strong></p>
      <p class="card-meta">${escapeHtml([it.functie, it.bedrijf].filter(Boolean).join(' · '))}</p>
      ${it.relatie ? `<p class="ref-relation">${escapeHtml(it.relatie)}</p>` : ''}
      ${it.brieftekst ? `<a class="ref-letter" href="#/letter/${escapeAttr(it.id)}">${t('readLetter')} →</a>` : ''}
      ${it.brief && !it.brieftekst ? `<a class="ref-letter" href="${escapeAttr(it.brief)}" target="_blank" rel="noopener">${t('readPdf')} ↗</a>` : ''}
    </article>`;
  }

  /* ---- Projectdetail (zelfde rijke format voor élk project) ------------- */
  function findProject(id) {
    return getSection('projecten').find(w => w.id === id)
      || getSection('werkervaring').find(w => w.id === id) || null;
  }

  // Terugval-inhoudsblokken als een project (nog) geen detail.blokken heeft.
  function synthBlocks(p) {
    const b = [];
    if (p.beschrijving) b.push({ p: p.beschrijving });
    if (Array.isArray(p.verantwoordelijkheden) && p.verantwoordelijkheden.length)
      b.push({ h: 'Responsibilities', list: p.verantwoordelijkheden });
    return b;
  }

  function renderProjectDetail(id) {
    const it = findProject(id);
    if (!it) { location.hash = '#/projects'; return ''; }
    const d = it.detail || {};
    const kicker = escapeHtml([d.kicker, it.periode].filter(Boolean).join(' · '));
    const titleHtml = d.titelHtml || escapeHtml(it.titel || '');
    const tags = (it.tags || []).slice(0, 10).map(x => `<span class="tag">${escapeHtml(x)}</span>`).join('');
    const blocks = (Array.isArray(d.blokken) && d.blokken.length ? d.blokken : synthBlocks(it))
      .map(b => `<div class="detail-block${b.h ? '' : ' detail-block--plain'}">${
        b.h ? `<h2>${escapeHtml(b.h)}</h2>` : ''}${
        Array.isArray(b.list)
          ? `<ul class="detail-list">${b.list.map(li => `<li>${escapeHtml(li)}</li>`).join('')}</ul>`
          : `<p>${escapeHtml(b.p || '')}</p>`}</div>`).join('');
    const imgs = itemImages(it);
    const cover = imgs.length
      ? `<div class="detail-cover">${renderRotator(imgs, 'detail-cover-rot', it.titel || '')}</div>` : '';
    const result = (it.resultaat || '').trim()
      ? `<aside class="detail-result"><span class="detail-result-label">${t('result')}</span><p>${escapeHtml(it.resultaat)}</p></aside>` : '';

    // Galerij: een map om af te tasten (Broadcast), anders de eigen projectbeelden.
    let gallery = '';
    if (d.galerijMap) {
      gallery = `<section class="detail-gallery-wrap" data-gallery-map="${escapeAttr(d.galerijMap)}">
        <h2>${t('projectVisuals')}</h2>
        <div id="bm-gallery" class="bm-carousel" hidden>
          <div class="bm-viewport"><div class="bm-track" id="bm-track"></div></div>
          <button type="button" class="bm-arrow bm-prev" aria-label="Vorige">‹</button>
          <button type="button" class="bm-arrow bm-next" aria-label="Volgende">›</button>
          <div class="bm-dots" id="bm-dots"></div>
        </div>
        <p id="bm-gallery-empty" class="empty-note" hidden>${escapeHtml(t('noVisuals'))}</p>
      </section>`;
    } else if (imgs.length > 1) {
      gallery = `<section class="detail-gallery-wrap">
        <h2>${t('projectVisuals')}</h2>
        <div id="bm-gallery" class="bm-carousel">
          <div class="bm-viewport"><div class="bm-track" id="bm-track">
            ${imgs.map((src, i) => `<button type="button" class="bm-slide" data-src="${escapeAttr(src)}" data-caption="${escapeAttr(it.titel || '')} — ${String(i + 1).padStart(2, '0')}">
              <img src="${escapeAttr(src)}" loading="${i < 2 ? 'eager' : 'lazy'}" alt="${escapeAttr(it.titel || '')} ${i + 1}"></button>`).join('')}
          </div></div>
          <button type="button" class="bm-arrow bm-prev" aria-label="Vorige">‹</button>
          <button type="button" class="bm-arrow bm-next" aria-label="Volgende">›</button>
          <div class="bm-dots" id="bm-dots">
            ${imgs.map((_, i) => `<button type="button" class="bm-dot${i === 0 ? ' on' : ''}" data-i="${i}" aria-label="Ga naar beeld ${i + 1}"></button>`).join('')}
          </div>
        </div>
      </section>`;
    }

    const meta = [
      it.rol ? `<span>${t('roleWord')}: ${escapeHtml(it.rol)}</span>` : '',
      it.type ? `<span>${escapeHtml(it.typeLabel || 'TYPE')}: ${escapeHtml(it.type)}</span>` : '',
      it.periode ? `<span>${escapeHtml(it.periode)}</span>` : ''
    ].join('');

    return `<div class="project-detail band-${escapeAttr(it.kleur || 'yellow')}">
      <div class="detail-top">
        <a class="back-link" href="#/projects">${t('backToProjects')}</a>
        <header class="detail-head">
          <h1>${titleHtml}</h1>
          <div class="detail-meta">${meta || `<span>${kicker}</span>`}</div>
        </header>
      </div>
      <div class="detail-sheet">
        <section class="detail-body">${blocks}</section>
        ${result}
        ${cover}
        ${gallery}
        <div class="tag-row">${tags}</div>
      </div>
    </div>`;
  }

  // Vult de aftast-galerij (Broadcast) met wat er in de opgegeven map staat
  // (bv. assets/broadcast/broadcast-01.jpg … -12.jpg). Ontbrekende bestanden worden
  // stil overgeslagen, zodat je zoveel of weinig beelden kunt toevoegen als je wilt.
  function bindProbeGallery(prefix) {
    const root = $('#bm-gallery'); if (!root) return;
    const track = $('#bm-track'), dotsWrap = $('#bm-dots'), empty = $('#bm-gallery-empty');
    const MAX = 12;
    const probes = [];
    for (let i = 1; i <= MAX; i++) {
      const n = String(i).padStart(2, '0');
      const src = `${prefix}${n}.jpg`;
      probes.push(new Promise(res => { const im = new Image(); im.onload = () => res(src); im.onerror = () => res(null); im.src = src; }));
    }
    Promise.all(probes).then(list => {
      const found = list.filter(Boolean);
      if (!found.length) { root.hidden = true; if (empty) empty.hidden = false; return; }
      root.hidden = false;
      track.innerHTML = found.map((src, i) =>
        `<button type="button" class="bm-slide" data-src="${src}" data-caption="Broadcast Magazine — ${String(i + 1).padStart(2, '0')}">
          <img src="${src}" loading="${i < 2 ? 'eager' : 'lazy'}" alt="Broadcast Magazine visual ${i + 1}"></button>`).join('');
      dotsWrap.innerHTML = found.map((_, i) => `<button type="button" class="bm-dot${i === 0 ? ' on' : ''}" data-i="${i}" aria-label="Ga naar beeld ${i + 1}"></button>`).join('');
      initCarousel(found.length);
    });
  }

  // Detailgalerij initialiseren: aftasten (map) of direct (vooraf gevulde track).
  function bindProjectGallery() {
    const wrap = $('.detail-gallery-wrap');
    const root = $('#bm-gallery');
    if (!wrap || !root) return;
    const map = wrap.getAttribute('data-gallery-map');
    if (map) { bindProbeGallery(map); return; }
    const count = $$('.bm-slide', root).length;
    if (count) initCarousel(count);
  }

  // Automatische carrousel met handmatige bediening (pijlen, dots, toetsenbord, swipe).
  function initCarousel(count) {
    const root = $('#bm-gallery'), track = $('#bm-track');
    const dots = $$('.bm-dot', root), slides = $$('.bm-slide', root);
    let idx = 0, suppressClick = false;

    function go(i) {
      idx = (i % count + count) % count;
      track.style.transform = `translateX(${-idx * 100}%)`;
      dots.forEach((d, k) => d.classList.toggle('on', k === idx));
    }
    const next = () => go(idx + 1), prev = () => go(idx - 1);
    function restart() { clearInterval(state._bmTimer); state._bmTimer = setInterval(next, 4500); }

    $('.bm-next', root).addEventListener('click', () => { next(); restart(); });
    $('.bm-prev', root).addEventListener('click', () => { prev(); restart(); });
    dots.forEach(d => d.addEventListener('click', () => { go(+d.dataset.i); restart(); }));

    // Klik op een beeld → lightbox (maar niet direct na een swipe)
    slides.forEach(sl => sl.addEventListener('click', () => {
      if (suppressClick) return;
      openLightbox(sl.dataset.src, sl.dataset.caption || '');
    }));

    // Pauzeer bij hover, hervat erna
    root.addEventListener('mouseenter', () => clearInterval(state._bmTimer));
    root.addEventListener('mouseleave', restart);

    // Toetsenbord
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { next(); restart(); }
      else if (e.key === 'ArrowLeft') { prev(); restart(); }
    });

    // Touch-swipe
    let x0 = null;
    track.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { suppressClick = true; setTimeout(() => suppressClick = false, 350); dx < 0 ? next() : prev(); restart(); }
      x0 = null;
    }, { passive: true });

    go(0); restart();
  }

  /* ======================================================================
   * View-events
   * ==================================================================== */
  function bindViewEvents(route) {
    if (route.indexOf('/project/') === 0) { bindProjectGallery(); }
  }

  /* ======================================================================
   * Gedeelde componenten
   * ==================================================================== */
  function pageShell(title, body) {
    return `<div class="wrap page">
      <div class="page-head"><h1>${escapeHtml(title)}</h1></div>
      ${body}
    </div>`;
  }

  function tagRow(tags) {
    if (!Array.isArray(tags) || !tags.length) return '';
    // dubbele (na normalisatie vergelijkbare) labels niet twee keer tonen
    const seen = new Set(); const uniq = [];
    for (const tag of tags) { const key = tag.toLowerCase(); if (!seen.has(key)) { seen.add(key); uniq.push(tag); } }
    return `<div class="tag-row">${uniq.slice(0,8).map(tag =>
      `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`;
  }

  function emptyNote() { return `<p class="empty-note">${escapeHtml(t('emptyList'))}</p>`; }

  // Beelden van een item (array of enkel legacy-veld).
  function itemImages(it) {
    if (Array.isArray(it.afbeeldingen)) return it.afbeeldingen;
    if (it.afbeelding) return [it.afbeelding];
    return [];
  }

  // Roterende afbeelding (auto-crossfade per topic). Klik → lightbox.
  function renderRotator(images, extraClass, caption) {
    if (!images || !images.length) return '';
    const multi = images.length > 1;
    return `<button type="button" class="rotator ${extraClass||''} ${multi?'multi':''}" data-caption="${escapeAttr(caption||'')}">
      ${images.map((src,i)=>`<img class="rot-img ${i===0?'active':''}" src="${escapeAttr(src)}" alt="${escapeAttr(caption||'')}" loading="lazy" />`).join('')}
      ${multi?`<span class="rot-dots">${images.map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('')}</span>`:''}
    </button>`;
  }

  /* ---- Utils ------------------------------------------------------------- */
  function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function escapeAttr(s){ return escapeHtml(s); }

  document.addEventListener('DOMContentLoaded', init);
})();
