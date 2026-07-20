/* =============================================================================
 * app.js — Interactieve multi-page portfolio (client-side, hash-routing)
 * -----------------------------------------------------------------------------
 * Eén vacature-invoer stemt de HELE site af: elke pagina (Experience, Projects,
 * Skills, References) herrangschikt en markeert de meest relevante items, met
 * matchscores. De vacature-state blijft bewaard tussen pagina's (localStorage).
 * Leunt op MatchingEngine (matching.js). Geen server, geen API-calls.
 * ========================================================================== */

(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const STORE = { vacancy: 'cc_vacancy_text', lang: 'cc_lang', onlyRel: 'cc_only_relevant' };

  const state = {
    pakket: null,
    vacancyText: localStorage.getItem(STORE.vacancy) || '',
    result: null,
    lang: localStorage.getItem(STORE.lang) || 'en',
    onlyRelevant: localStorage.getItem(STORE.onlyRel) === '1',
    _rotTimers: [],
    _bmTimer: null
  };

  /* ---- Interface-teksten (labels; content komt uit pakket.json) ---------- */
  const I18N = {
    en: {
      navHome:'Home', navExp:'Experience', navProj:'Projects', navSkills:'Skills',
      navRefs:'References', navMatch:'Vacancy match',
      footerMeta:'Client-side portfolio · your vacancy text never leaves the browser.',
      heroCtaPortfolio:'View portfolio', heroCtaMatch:'Match with a vacancy',
      available:'Available from September 2026', getInTouch:'Get in touch',
      statExp:'Roles', statProj:'Projects', statSkills:'Skills & tools', statLang:'Languages',
      focus:'Focus areas', selectedWork:'Selected work', viewProjects:'View all projects',
      tailoredTo:'Tailored to', matchWord:'match', change:'Change', clear:'Clear',
      setVacancy:'Set a vacancy to tailor this portfolio.', enterVacancy:'Enter vacancy',
      seeMatch:'See full match analysis',
      expTitle:'Experience', projTitle:'Projects', skillsTitle:'Skills & tools', refsTitle:'References',
      onlyRelevant:'Only relevant', showAll:'Show all', sortedByRelevance:'Sorted by relevance to your vacancy',
      matchTitle:'Match your vacancy', matchIntro:'Paste a job description (or upload a .txt/.pdf). The whole portfolio adapts instantly — nothing is sent to a server.',
      placeholder:'Paste the job description here…', upload:'Upload .txt or .pdf', clearInput:'Clear', trySample:'Try a sample',
      overall:'Overall match', reqTitle:'Requirements ↔ Carlijn\'s experience', keywords:'Detected keywords',
      relevantExperience:'Best match', noMatchForReq:'No direct match found.', downloadPdf:'Download summary as PDF',
      emptyMatch:'Enter a vacancy above to generate a tailored match analysis.',
      privacy:'🔒 Your vacancy text stays in your browser.',
      noResults:'No items match this vacancy yet — showing the full overview.',
      references:'References', relation:'Relation', backHome:'Back to home', readLetter:'Read recommendation letter',
      viewProject:'View project', backToExp:'← Back to experience', backToProjects:'← Back to projects', projectVisuals:'Visuals from the project', noVisuals:'Add page images to assets/broadcast/ to fill this gallery.', result:'Result',
      loadError:'Could not load pakket.json. Run the site via a local web server (see README).'
    },
    nl: {
      navHome:'Home', navExp:'Ervaring', navProj:'Projecten', navSkills:'Vaardigheden',
      navRefs:'Referenties', navMatch:'Vacature-match',
      footerMeta:'Client-side portfolio · je vacaturetekst verlaat je browser niet.',
      heroCtaPortfolio:'Bekijk portfolio', heroCtaMatch:'Match met een vacature',
      available:'Beschikbaar vanaf september 2026', getInTouch:'Neem contact op',
      statExp:'Functies', statProj:'Projecten', statSkills:'Skills & tools', statLang:'Talen',
      focus:'Focusgebieden', selectedWork:'Uitgelicht werk', viewProjects:'Bekijk alle projecten',
      tailoredTo:'Afgestemd op', matchWord:'match', change:'Wijzig', clear:'Wis',
      setVacancy:'Stel een vacature in om dit portfolio op maat te maken.', enterVacancy:'Vacature invoeren',
      seeMatch:'Bekijk volledige match-analyse',
      expTitle:'Ervaring', projTitle:'Projecten', skillsTitle:'Vaardigheden & tools', refsTitle:'Referenties',
      onlyRelevant:'Alleen relevant', showAll:'Toon alles', sortedByRelevance:'Gesorteerd op relevantie voor je vacature',
      matchTitle:'Match je vacature', matchIntro:'Plak een vacaturetekst (of upload een .txt/.pdf). Het hele portfolio past zich direct aan — er wordt niets naar een server gestuurd.',
      placeholder:'Plak hier de vacaturetekst…', upload:'Upload .txt of .pdf', clearInput:'Wissen', trySample:'Voorbeeld proberen',
      overall:'Totale match', reqTitle:'Eisen ↔ Carlijns ervaring', keywords:'Herkende trefwoorden',
      relevantExperience:'Beste match', noMatchForReq:'Geen directe match gevonden.', downloadPdf:'Download samenvatting als PDF',
      emptyMatch:'Voer hierboven een vacature in voor een match-analyse op maat.',
      privacy:'🔒 Je vacaturetekst blijft in je browser.',
      noResults:'Nog geen items matchen deze vacature — het volledige overzicht wordt getoond.',
      references:'Referenties', relation:'Relatie', backHome:'Terug naar home', readLetter:'Lees aanbevelingsbrief',
      viewProject:'Bekijk project', backToExp:'← Terug naar ervaring', backToProjects:'← Terug naar projecten', projectVisuals:'Visuals uit het project', noVisuals:'Zet pagina-afbeeldingen in assets/broadcast/ om deze galerij te vullen.', result:'Resultaat',
      loadError:'Kon pakket.json niet laden. Draai de site via een lokale webserver (zie README).'
    }
  };
  const t = k => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;

  /* ---- Voorbeeldvacature (voor de "Try a sample"-knop) ------------------- */
  const SAMPLE_VACANCY = `Social Media & Content Marketeer (Amsterdam)

Voor een groeiend e-commercemerk zoeken wij een creatieve social media marketeer.

Wat vraag wij:
- Aantoonbare ervaring met social media en contentmarketing (Instagram, TikTok)
- Ervaring met influencer marketing en het laten groeien van een community
- Kennis van Google Analytics en e-mailmarketing (Mailchimp of Klaviyo)
- Je maakt zelf content en videocampagnes
- Ervaring met branding en marketingstrategie is een pre
- Uitstekende communicatie in Nederlands en Engels

Wat bieden wij: een creatieve rol in e-commerce met veel eigen verantwoordelijkheid.`;

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
    computeResult();
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

  function bindHeader() {
    // Mobiele nav
    const toggle = $('#nav-toggle'), nav = $('#site-nav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('[data-nav]').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
    }));
    // Taal
    $$('.lang-btn').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  }

  function setLang(lang) {
    state.lang = lang; localStorage.setItem(STORE.lang, lang);
    document.documentElement.lang = lang;
    applyLangLabels(); router();
  }

  function applyLangLabels() {
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
    document.documentElement.lang = state.lang;
  }

  /* ---- Vacature-state ---------------------------------------------------- */
  function computeResult() {
    const text = (state.vacancyText || '').trim();
    state.result = (text && state.pakket)
      ? window.MatchingEngine.analyseVacature(state.pakket, text) : null;
  }
  function setVacancy(text) {
    state.vacancyText = text || '';
    localStorage.setItem(STORE.vacancy, state.vacancyText);
    computeResult();
  }
  function clearVacancy() {
    state.vacancyText = ''; localStorage.removeItem(STORE.vacancy);
    state.result = null;
  }

  // Items van een sectie: gesorteerd + met percentage als er een vacature is,
  // anders de originele volgorde met percentage = null.
  function getSection(type) {
    if (state.result) return state.result.scored[type];
    const items = Array.isArray(state.pakket[type]) ? state.pakket[type] : [];
    return items.map(item => ({ item, percentage: null, matchedTerms: [] }));
  }

  /* ======================================================================
   * Router
   * ==================================================================== */
  const ROUTES = {
    '/':                 renderHome,
    '/experience':       renderExperience,
    '/projects':         renderProjects,
    '/skills':           renderSkills,
    '/references':       renderReferences,
    '/match':            renderMatch
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
    const view = pid ? () => renderProjectDetail(pid) : (ROUTES[route] || renderHome);
    const app = $('#app');
    clearRotators();
    app.classList.remove('fade-in'); void app.offsetWidth; // retrigger animatie
    app.innerHTML = view();
    app.classList.add('fade-in');
    // Actieve nav
    $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    renderTailorBar(route);
    bindViewEvents(route);
    bindRotators();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    bindReveal();
  }

  /* ---- Scroll-reveal (gestaggerd in beeld faden) ------------------------ */
  let _revealObs = null;
  function bindReveal() {
    if (_revealObs) _revealObs.disconnect();
    const els = $$('.card, .stat, .gallery-item, .block, .home-match, .match-head, .page-head, .chips, .home-focus, .detail-block, .detail-cover, .detail-result, .detail-gallery-wrap');
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

  /* ---- Status-balk ------------------------------------------------------- */
  function renderTailorBar(route) {
    const bar = $('#tailor-bar');
    if (route === '/match') { bar.hidden = true; return; }
    bar.hidden = false;
    if (state.result) {
      const jt = state.result.jobTitle ? escapeHtml(state.result.jobTitle) : '—';
      bar.className = 'tailor-bar active no-print';
      bar.innerHTML = `<div class="wrap tailor-inner">
        <span class="tailor-text">✓ ${t('tailoredTo')}: <strong>${jt}</strong>
          <span class="tailor-score">${state.result.overall}% ${t('matchWord')}</span></span>
        <span class="tailor-actions">
          <a href="#/match">${t('change')}</a>
          <button type="button" id="tailor-clear">${t('clear')}</button>
        </span></div>`;
      $('#tailor-clear').addEventListener('click', () => { clearVacancy(); router(); });
    } else {
      bar.className = 'tailor-bar no-print';
      bar.innerHTML = `<div class="wrap tailor-inner">
        <span class="tailor-text">💡 ${t('setVacancy')}</span>
        <span class="tailor-actions"><a href="#/match" class="tailor-cta">${t('enterVacancy')} →</a></span>
      </div>`;
    }
  }

  /* ======================================================================
   * Views
   * ==================================================================== */
  function renderHome() {
    const p = state.pakket.profiel || {};
    const counts = {
      exp: (state.pakket.werkervaring||[]).length,
      proj: (state.pakket.projecten||[]).length,
      skills: (state.pakket.vaardigheden||[]).length,
      lang: 3
    };
    const topSkills = getSection('vaardigheden').slice(0, 6)
      .map(s => `<a class="chip ${heat(s.percentage)}" href="#/skills">${escapeHtml(s.item.naam)}</a>`).join('');

    let matchSummary = '';
    if (state.result) {
      const r = state.result;
      const top = r.scored.werkervaring[0] || r.scored.projecten[0];
      matchSummary = `<div class="home-match card-elevated">
        ${scoreDial(r.overall, t('overall'))}
        <div class="home-match-text">
          <p class="home-match-line">${t('tailoredTo')} <strong>${escapeHtml(r.jobTitle||'—')}</strong></p>
          ${top ? `<p class="home-match-sub">${t('relevantExperience')}: <strong>${escapeHtml(itemLabel(top.item))}</strong></p>` : ''}
          <a class="btn btn-primary" href="#/match">${t('seeMatch')} →</a>
        </div>
      </div>`;
    }

    return `<section class="hero">
      <div class="wrap hero-inner">
        <div class="hero-toprow">
          <span class="hero-label">Portfolio</span>
          <span class="hero-label">${escapeHtml((p.titel||'').split(/[·|]/)[0].trim())}</span>
        </div>
        <h1 class="hero-name">${escapeHtml(p.naam||'')}</h1>
        <div class="hero-photo-wrap">
          <img class="hero-photo" src="assets/carlijn.jpg" alt="Carlijn Corporaal" loading="eager" />
          <span class="hero-avail">${t('available')}</span>
        </div>
        <p class="hero-pitch">${escapeHtml(p.pitch||'')}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="#/match">${t('heroCtaMatch')}</a>
          <a class="btn btn-ghost" href="#/projects">${t('heroCtaPortfolio')}</a>
        </div>
        <div class="hero-contact">
          ${p.email ? `<a href="mailto:${escapeAttr(p.email)}">${escapeHtml(p.email)}</a>` : ''}
          ${p.linkedin ? `<span class="sep">/</span><a href="${escapeAttr(p.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
          ${p.locatie ? `<span class="sep">/</span><span>${escapeHtml(p.locatie)}</span>` : ''}
        </div>
      </div>
    </section>

    ${marqueeStrip()}

    <section class="wrap home-body">
      ${matchSummary}
      <div class="stats-row">
        ${stat(counts.exp, t('statExp'), '#/experience')}
        ${stat(counts.proj, t('statProj'), '#/projects')}
        ${stat(counts.skills, t('statSkills'), '#/skills')}
        ${stat('45k+', 'Instagram')}
      </div>
      <div class="home-focus">
        <h3>${t('focus')}</h3>
        <div class="chips">${topSkills}</div>
      </div>
      ${galleryBlock()}
    </section>`;
  }

  // Doorlopende marquee-strip (puur decoratief, CSS-animatie).
  function marqueeStrip() {
    const words = state.lang === 'nl'
      ? ['Marketing','Branding','Social media','Content','Strategie','Campagnes','Storytelling','Influencer','Creatie','Communicatie']
      : ['Marketing','Branding','Social media','Content','Strategy','Campaigns','Storytelling','Influencer','Creative','Communication'];
    const seq = words.map(w => `<span>${escapeHtml(w)}</span><span class="mq-dot">✳</span>`).join('');
    return `<div class="marquee no-print" aria-hidden="true"><div class="marquee-track">${seq}${seq}</div></div>`;
  }

  function galleryBlock() {
    const g = Array.isArray(state.pakket.galerij) ? state.pakket.galerij : [];
    if (!g.length) return '';
    return `<div class="home-gallery">
      <div class="gallery-head">
        <h3>${t('selectedWork')}</h3>
        <a href="#/projects" class="gallery-link">${t('viewProjects')} →</a>
      </div>
      <div class="gallery-grid">
        ${g.map(topic => `<div class="gallery-item">
          ${renderRotator(topic.afbeeldingen, 'gallery-rot', topic.titel||'')}
          <span class="gallery-cap">${escapeHtml(topic.titel||'')}${topic.afbeeldingen && topic.afbeeldingen.length>1 ? ` <em>· ${topic.afbeeldingen.length}</em>`:''}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function renderExperience() {
    const items = filterRel(getSection('werkervaring'));
    return pageShell(t('expTitle'), relControls(), `
      <div class="timeline">
        ${items.map(expCard).join('') || emptyNote()}
      </div>`);
  }

  function expCard(s) {
    const it = s.item;
    const imgs = itemImages(it);
    return `<article class="tl-item card ${imgs.length?'has-cover':''}">
      <div class="tl-dot"></div>
      ${renderRotator(imgs, 'card-cover cover-wide', (it.functie||'')+' — '+(it.bedrijf||''))}
      ${badgeAndBar(s)}
      <h3>${escapeHtml(it.functie||'')}</h3>
      <p class="card-meta">${escapeHtml([it.bedrijf, it.branche, it.periode].filter(Boolean).join(' · '))}</p>
      ${it.impressie ? `<p class="card-impressie">${escapeHtml(it.impressie)}</p>` : ''}
      ${it.resultaat ? `<p class="card-result">✔ ${escapeHtml(it.resultaat)}</p>` : ''}
      ${Array.isArray(it.verantwoordelijkheden) ? `<ul class="card-list">${it.verantwoordelijkheden.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>` : ''}
      ${tagRow(it.tags, s.matchedTerms)}
      ${it.detailpagina ? `<a class="card-project-link" href="${escapeAttr(it.detailpagina)}">${t('viewProject')} →</a>` : ''}
    </article>`;
  }

  function renderProjects() {
    const items = filterRel(getSection('projecten'));
    return pageShell(t('projTitle'), relControls(), `
      <div class="cards-grid">
        ${items.map(projCard).join('') || emptyNote()}
      </div>`);
  }

  function projCard(s) {
    const it = s.item;
    const imgs = itemImages(it);
    const kicker = it.detail && it.detail.kicker ? it.detail.kicker : '';
    const cover = imgs.length
      ? renderRotator(imgs, 'card-cover', it.titel||'')
      : `<a class="card-cover card-cover-poster" href="${escapeAttr(it.detailpagina||'#/projects')}">
          <span class="poster-kicker">${escapeHtml(kicker || 'Project')}</span>
          <span class="poster-title">${escapeHtml(it.titel||'')}</span></a>`;
    return `<article class="card project-card has-cover">
      ${cover}
      ${badgeAndBar(s)}
      ${kicker ? `<span class="card-kicker">${escapeHtml(kicker)}</span>` : ''}
      <h3>${escapeHtml(it.titel||'')}</h3>
      ${it.impressie ? `<p class="card-impressie">${escapeHtml(it.impressie)}</p>`
        : (it.beschrijving ? `<p class="card-body">${escapeHtml(it.beschrijving)}</p>` : '')}
      ${it.resultaat ? `<p class="card-result">✔ ${escapeHtml(it.resultaat)}</p>` : ''}
      ${tagRow((it.tags||[]).concat(it.vaardigheden||[]), s.matchedTerms)}
      ${it.detailpagina ? `<a class="card-project-link" href="${escapeAttr(it.detailpagina)}">${t('viewProject')} →</a>` : ''}
    </article>`;
  }

  function renderSkills() {
    const items = filterRel(getSection('vaardigheden'));
    return pageShell(t('skillsTitle'), relControls(), `
      <div class="cards-grid skills-grid">
        ${items.map(skillCard).join('') || emptyNote()}
      </div>`);
  }

  function skillCard(s) {
    const it = s.item;
    return `<article class="card skill-card ${heat(s.percentage)}">
      ${badgeAndBar(s)}
      <h3>${escapeHtml(it.naam||'')}</h3>
      ${it.niveau ? `<p class="card-meta">${escapeHtml(it.niveau)}</p>` : ''}
      ${tagRow(it.tags, s.matchedTerms)}
    </article>`;
  }

  function renderReferences() {
    const items = getSection('referenties'); // referenties niet filteren, altijd tonen
    // Referenties met een bijlage (aanbevelingsbrief) naast elkaar bovenaan,
    // referenties zonder bijlage eronder.
    const ordered = [
      ...items.filter(s => s.item && s.item.brief),
      ...items.filter(s => !(s.item && s.item.brief)),
    ];
    return pageShell(t('refsTitle'), '', `
      <div class="cards-grid refs-grid">
        ${ordered.map(refCard).join('')}
      </div>`);
  }

  function refCard(s) {
    const it = s.item;
    const citaat = (it.citaat||'').trim();
    return `<article class="card ref-card${it.brief ? '' : ' ref-card--full'}">
      ${badgeAndBar(s)}
      ${citaat ? `<blockquote>“${escapeHtml(citaat)}”</blockquote>` : ''}
      <p class="ref-name"><strong>${escapeHtml(it.naam||'')}</strong></p>
      <p class="card-meta">${escapeHtml([it.functie, it.bedrijf].filter(Boolean).join(' · '))}</p>
      ${it.relatie ? `<p class="ref-relation">${escapeHtml(it.relatie)}</p>` : ''}
      ${it.brief ? `<a class="ref-letter" href="${escapeAttr(it.brief)}" target="_blank" rel="noopener">${t('readLetter')} ↗</a>` : ''}
    </article>`;
  }

  /* ---- Projectdetail (generiek — zelfde rijke format voor élk project) --- */
  function findProject(id) {
    return (state.pakket.projecten || []).find(w => w.id === id)
      || (state.pakket.werkervaring || []).find(w => w.id === id) || null;
  }

  // Terugval-inhoudsblokken als een project (nog) geen detail.blokken heeft.
  function synthBlocks(p) {
    const b = [];
    if (p.beschrijving) b.push({ h: 'About', p: p.beschrijving });
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
    const lead = it.impressie || it.beschrijving || '';
    const tags = (it.tags || []).slice(0, 10).map(x => `<span class="tag">${escapeHtml(x)}</span>`).join('');
    const blocks = (Array.isArray(d.blokken) && d.blokken.length ? d.blokken : synthBlocks(it))
      .map(b => `<div class="detail-block"><h2>${escapeHtml(b.h)}</h2>${
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

    return `<div class="wrap project-detail">
      <a class="detail-back" href="#/projects">${t('backToProjects')}</a>
      <header class="detail-head">
        <span class="detail-kicker">${kicker}</span>
        <h1>${titleHtml}</h1>
        <p class="detail-lead">${escapeHtml(lead)}</p>
        <div class="tag-row">${tags}</div>
      </header>
      ${cover}
      <div class="detail-columns">
        <section class="detail-body">${blocks}</section>
        ${result}
      </div>
      ${gallery}
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

  function renderMatch() {
    const r = state.result;
    let output = '';
    if (r) {
      output = `<div class="match-output">
        <section class="match-head card-elevated">
          ${scoreDial(r.overall, t('overall'))}
          <div class="match-head-text">
            <p class="match-head-line">${t('tailoredTo')} <strong>${escapeHtml(r.jobTitle||'—')}</strong>${r.company?` · <strong>${escapeHtml(r.company)}</strong>`:''}</p>
            <button type="button" class="btn btn-primary" id="pdf-btn">${t('downloadPdf')}</button>
          </div>
        </section>
        ${r.requirements.length ? `<section class="block"><h3>${t('reqTitle')}</h3>
          <div class="match-cards">${r.requirements.map(reqCard).join('')}</div></section>` : ''}
        ${r.keywords.length ? `<section class="block"><h3>${t('keywords')}</h3>
          <div class="chips">${r.keywords.slice(0,18).map(k=>`<span class="chip">${escapeHtml(k.term)}</span>`).join('')}</div></section>` : ''}
        <section class="block quicklinks">
          <a class="btn btn-ghost" href="#/experience">${t('navExp')} →</a>
          <a class="btn btn-ghost" href="#/projects">${t('navProj')} →</a>
          <a class="btn btn-ghost" href="#/skills">${t('navSkills')} →</a>
        </section>
      </div>`;
    } else {
      output = `<div class="empty-state">${escapeHtml(t('emptyMatch'))}</div>`;
    }

    return `<div class="wrap match-page">
      <div class="page-head"><h1>${t('matchTitle')}</h1></div>
      <p class="page-intro">${escapeHtml(t('matchIntro'))}</p>
      <div class="match-input card">
        <textarea id="vacancy-input" rows="9" spellcheck="false" placeholder="${escapeAttr(t('placeholder'))}">${escapeHtml(state.vacancyText)}</textarea>
        <div class="match-input-actions">
          <label class="file-upload btn btn-ghost">${t('upload')}
            <input type="file" id="file-input" accept=".txt,.pdf,text/plain,application/pdf" hidden />
          </label>
          <button type="button" class="btn btn-ghost" id="sample-btn">${t('trySample')}</button>
          <button type="button" class="btn btn-ghost" id="clear-input-btn">${t('clearInput')}</button>
          <span class="privacy-note">${t('privacy')}</span>
        </div>
      </div>
      ${output}
    </div>`;
  }

  function reqCard(req) {
    const m = req.match;
    return `<div class="match-card ${m?'has-match':'no-match'}">
      <div class="req-text">${escapeHtml(req.eis)}</div>
      <div class="req-arrow" aria-hidden="true">↳</div>
      ${m ? `<div class="req-match"><span class="req-match-label">${t('relevantExperience')}</span>
        <strong>${escapeHtml(itemLabel(m.item))}</strong></div>`
          : `<div class="req-match muted">${escapeHtml(t('noMatchForReq'))}</div>`}
    </div>`;
  }

  /* ======================================================================
   * View-events
   * ==================================================================== */
  function bindViewEvents(route) {
    if (route.indexOf('/project/') === 0) { bindProjectGallery(); }
    if (route === '/match') {
      const input = $('#vacancy-input');
      if (input) {
        input.addEventListener('input', debounce(() => { setVacancy(input.value); rerenderMatchOutput(); }, 250));
        $('#file-input').addEventListener('change', onFileChosen);
        $('#clear-input-btn').addEventListener('click', () => { input.value=''; setVacancy(''); rerenderMatchOutput(); input.focus(); });
        $('#sample-btn').addEventListener('click', () => { input.value = SAMPLE_VACANCY; setVacancy(SAMPLE_VACANCY); rerenderMatchOutput(); });
        const pdf = $('#pdf-btn'); if (pdf) pdf.addEventListener('click', () => window.print());
      }
    }
    // relevantie-toggle (Experience/Projects/Skills)
    const relToggle = $('#rel-toggle');
    if (relToggle) relToggle.addEventListener('click', () => {
      state.onlyRelevant = !state.onlyRelevant;
      localStorage.setItem(STORE.onlyRel, state.onlyRelevant ? '1':'0');
      router();
    });
  }

  // Alleen het match-resultaat opnieuw renderen + status-balk bijwerken (geen full route reset,
  // zodat de textarea-focus en cursorpositie behouden blijven).
  function rerenderMatchOutput() {
    const page = $('.match-page'); if (!page) { router(); return; }
    // vervang alles ná .match-input
    const old = page.querySelector('.match-output') || page.querySelector('.empty-state');
    const wrap = document.createElement('div');
    const r = state.result;
    if (r) {
      wrap.innerHTML = renderMatchOutputHtml(r);
    } else {
      wrap.innerHTML = `<div class="empty-state">${escapeHtml(t('emptyMatch'))}</div>`;
    }
    if (old) old.replaceWith(wrap.firstElementChild); else page.appendChild(wrap.firstElementChild);
    const pdf = $('#pdf-btn'); if (pdf) pdf.addEventListener('click', () => window.print());
    renderTailorBar('/match');
  }
  function renderMatchOutputHtml(r) {
    return `<div class="match-output">
      <section class="match-head card-elevated">
        ${scoreDial(r.overall, t('overall'))}
        <div class="match-head-text">
          <p class="match-head-line">${t('tailoredTo')} <strong>${escapeHtml(r.jobTitle||'—')}</strong>${r.company?` · <strong>${escapeHtml(r.company)}</strong>`:''}</p>
          <button type="button" class="btn btn-primary" id="pdf-btn">${t('downloadPdf')}</button>
        </div>
      </section>
      ${r.requirements.length ? `<section class="block"><h3>${t('reqTitle')}</h3>
        <div class="match-cards">${r.requirements.map(reqCard).join('')}</div></section>` : ''}
      ${r.keywords.length ? `<section class="block"><h3>${t('keywords')}</h3>
        <div class="chips">${r.keywords.slice(0,18).map(k=>`<span class="chip">${escapeHtml(k.term)}</span>`).join('')}</div></section>` : ''}
      <section class="block quicklinks">
        <a class="btn btn-ghost" href="#/experience">${t('navExp')} →</a>
        <a class="btn btn-ghost" href="#/projects">${t('navProj')} →</a>
        <a class="btn btn-ghost" href="#/skills">${t('navSkills')} →</a>
      </section>
    </div>`;
  }

  async function onFileChosen(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try {
      let text = '';
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') text = await extractPdfText(file);
      else text = await file.text();
      const input = $('#vacancy-input'); input.value = text.trim();
      setVacancy(input.value); rerenderMatchOutput();
    } catch (err) { alert('Kon bestand niet lezen: ' + err.message); }
    finally { e.target.value = ''; }
  }
  async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error('pdf.js niet geladen (offline? zie README).');
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let out = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const c = await page.getTextContent();
      out += c.items.map(i => i.str).join(' ') + '\n';
    }
    return out;
  }

  /* ======================================================================
   * Gedeelde componenten
   * ==================================================================== */
  function pageShell(title, controls, body) {
    const note = state.result ? `<p class="page-intro">${t('sortedByRelevance')}</p>` : '';
    return `<div class="wrap page">
      <div class="page-head"><h1>${escapeHtml(title)}</h1>${controls}</div>
      ${note}
      ${body}
    </div>`;
  }

  function relControls() {
    if (!state.result) return '';
    return `<button type="button" id="rel-toggle" class="toggle-btn ${state.onlyRelevant?'on':''}">
      ${state.onlyRelevant ? t('showAll') : t('onlyRelevant')}</button>`;
  }

  function filterRel(list) {
    if (state.result && state.onlyRelevant) {
      const f = list.filter(s => s.percentage > 0);
      return f.length ? f : list;
    }
    return list;
  }

  function badgeAndBar(s) {
    if (s.percentage == null) return '';
    return `<span class="score-badge ${heat(s.percentage)}">${s.percentage}%</span>
      <span class="match-bar"><span class="match-bar-fill ${heat(s.percentage)}" style="width:${s.percentage}%"></span></span>`;
  }

  function scoreDial(pct, label) {
    const deg = Math.round((pct/100)*360);
    return `<div class="score-dial ${heat(pct)}" style="--deg:${deg}deg">
      <div class="score-dial-inner"><span class="score-dial-num">${pct}%</span><span class="score-dial-label">${escapeHtml(label)}</span></div>
    </div>`;
  }

  function tagRow(tags, matched) {
    if (!Array.isArray(tags) || !tags.length) return '';
    const set = new Set(matched||[]);
    const hit = tag => window.MatchingEngine.tokenize(tag).some(tk => set.has(tk));
    const sorted = tags.slice().sort((a,b)=>(hit(b)?1:0)-(hit(a)?1:0));
    // dubbele (na normalisatie vergelijkbare) labels niet twee keer tonen
    const seen = new Set(); const uniq = [];
    for (const tag of sorted) { const key = tag.toLowerCase(); if (!seen.has(key)) { seen.add(key); uniq.push(tag); } }
    return `<div class="tag-row">${uniq.slice(0,8).map(tag =>
      `<span class="tag ${hit(tag)?'tag-hit':''}">${escapeHtml(tag)}</span>`).join('')}</div>`;
  }

  function stat(num, label, href) {
    const inner = `<span class="stat-num">${escapeHtml(String(num))}</span><span class="stat-label">${escapeHtml(label)}</span>`;
    return href
      ? `<a class="stat stat-link" href="${href}">${inner}<span class="stat-arrow" aria-hidden="true">→</span></a>`
      : `<div class="stat">${inner}</div>`;
  }
  function emptyNote() { return `<p class="empty-note">${escapeHtml(t('noResults'))}</p>`; }

  function itemLabel(item) {
    return item.functie ? `${item.functie}${item.bedrijf?' — '+item.bedrijf:''}`
      : (item.titel || item.naam || '');
  }

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
  function heat(pct) { return pct==null?'none':pct>=60?'high':pct>=30?'mid':pct>0?'low':'none'; }

  /* ---- Utils ------------------------------------------------------------- */
  function debounce(fn, ms){ let h; return (...a)=>{clearTimeout(h);h=setTimeout(()=>fn(...a),ms);}; }
  function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function escapeAttr(s){ return escapeHtml(s); }

  document.addEventListener('DOMContentLoaded', init);
})();
