/* =============================================================================
 * matching.js — Client-side matching-engine (geen AI-API, geen server)
 * -----------------------------------------------------------------------------
 * Alle analyse gebeurt lokaal in de browser. Deze module:
 *   1. Extraheert trefwoorden uit de vacaturetekst (tokenizen, stopwoorden
 *      verwijderen, lichte stemming, synoniemen normaliseren).
 *   2. Probeert functietitel en bedrijfsnaam uit de tekst te halen.
 *   3. Haalt losse "eisen" (bullets / eis-achtige zinnen) uit de vacature.
 *   4. Berekent per pakket-item een relevantiescore t.o.v. de vacature.
 *   5. Koppelt vacature-eisen aan het best passende pakket-item (match-kaarten).
 *
 * De engine kent geen vakinhoud; hij werkt puur op woordoverlap + gewichten.
 * Aanpassen? Zie SYNONYMS en STOPWORDS hieronder — die zijn bewust simpel
 * gehouden zodat je ze makkelijk kunt uitbreiden.
 * ========================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
   * 1. Woordenlijsten — vrij uit te breiden
   * ------------------------------------------------------------------------ */

  // Nederlandse (en enkele Engelse) stopwoorden: worden genegeerd bij matching.
  const STOPWORDS = new Set([
    'de','het','een','en','of','maar','want','dus','als','dan','die','dat','deze',
    'dit','er','hier','daar','wij','we','jij','je','jou','jouw','u','uw','ik','mij',
    'mijn','hij','zij','ze','het','hun','ons','onze','met','van','voor','naar','bij',
    'aan','op','in','uit','over','onder','tussen','door','om','te',' te','tot','na',
    'per','tijdens','binnen','buiten','zonder','tegen','vanuit','richting','ook','al',
    'nog','wel','niet','geen','meer','veel','zeer','erg','heel','zo','zoals','onze',
    'onder','waar','wat','wie','hoe','wanneer','waarom','welke','welk','is','ben',
    'bent','zijn','was','waren','word','wordt','worden','werd','werden','heb','hebt',
    'heeft','hebben','had','hadden','kan','kun','kunt','kunnen','kon','konden','zal',
    'zult','zullen','zou','zouden','moet','moeten','moest','mag','mogen','wil','wilt',
    'willen','wilde','doe','doet','doen','deed','gaat','gaan','ging','komt','komen',
    'kwam','maakt','maken','maakte',' per','o.a','ofwel','etc','enz','bijv','ca',
    'the','and','or','of','to','in','on','for','with','a','an','you','your','we','our',
    'is','are','be','as','at','by','this','that','it','from','will','can','job','role',
    'we','ll','re','ve','zoeken','zoek','gezocht','wij','jij','functie','vacature',
    'werkzaamheden','profiel','aanbod','bieden','bied','vraag','vragen','ervaring',
    'kennis','goede','goed','sterke','sterk','graag','minimaal','minimaal','minstens',
    'ongeveer','circa','fulltime','parttime','uur','week','jaar','jaren','maand','dag',
    'nieuwe','nieuw','onze','binnen','samen','team','collega','collegas','collega\'s'
  ]);

  // Synoniemen / normalisatie: alle varianten worden op één "canonieke" term
  // afgebeeld, zodat "js", "javascript" en "java script" allemaal matchen.
  // Sleutel = canonieke term, waarde = lijst varianten die erop worden afgebeeld.
  const SYNONYMS = {
    'social media': ['social', 'socials', 'socialmedia', 'social-media'],
    'seo': ['zoekmachineoptimalisatie', 'zoekmachine optimalisatie', 'searchengineoptimization'],
    'sea': ['search advertising', 'google ads', 'googleads', 'adwords', 'sem'],
    'contentmarketing': ['content marketing', 'content'],
    'copywriting': ['copywriter', 'tekstschrijven', 'teksten schrijven', 'tekstschrijver'],
    'e-mailmarketing': ['emailmarketing', 'email marketing', 'e-mail marketing', 'mailings'],
    'projectmanagement': ['project management', 'projectleiding', 'projectmanager', 'projectleider'],
    'data-analyse': ['data analyse', 'dataanalyse', 'data-analist', 'data analist', 'analytics'],
    'google analytics': ['ga4', 'analytics'],
    'stakeholdermanagement': ['stakeholder management', 'stakeholders'],
    'campagnemanagement': ['campagne', 'campagnes', 'campaign', 'campaign'],
    'webredactie': ['webteksten', 'online teksten', 'webcontent'],
    'cms': ['wordpress', 'drupal', 'contentmanagementsysteem', 'content management systeem'],
    'ux': ['user experience', 'gebruikerservaring', 'ui'],
    'e-commerce': ['ecommerce', 'webshop', 'online retail'],
    'communicatie': ['comms', 'communication'],
    'engels': ['english'],
    'nederlands': ['dutch'],
    'javascript': ['js', 'java script'],
    'front-end': ['frontend', 'front end'],
    'back-end': ['backend', 'back end']
  };

  // Bouw een snelle "variant -> canoniek" opzoektabel.
  const SYNONYM_LOOKUP = {};
  for (const [canon, variants] of Object.entries(SYNONYMS)) {
    SYNONYM_LOOKUP[canon] = canon;
    for (const v of variants) SYNONYM_LOOKUP[v] = canon;
  }

  /* ---------------------------------------------------------------------------
   * 2. Tekstverwerking
   * ------------------------------------------------------------------------ */

  // Heel lichte Nederlandse stemmer: strip een paar veelvoorkomende uitgangen.
  // Bewust conservatief om vreemde stammen te voorkomen.
  function stem(word) {
    if (word.length <= 4) return word;
    const suffixes = ['heden', 'ingen', 'heid', 'ing', 'en', 'er', 'en', 'es', 's', 'e'];
    for (const suf of suffixes) {
      if (word.length - suf.length >= 4 && word.endsWith(suf)) {
        return word.slice(0, -suf.length);
      }
    }
    return word;
  }

  // Normaliseer een losse term: lowercase, accenten weg, synoniem toepassen.
  function normalizeTerm(term) {
    let t = term.toLowerCase().trim();
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // accenten verwijderen
    if (SYNONYM_LOOKUP[t]) return SYNONYM_LOOKUP[t];
    return t;
  }

  // Zet een stuk tekst om in een lijst genormaliseerde tokens (incl. stemming).
  // Eerst worden bekende meerwoords-synoniemen als geheel herkend.
  function tokenize(text) {
    if (!text) return [];
    let clean = ' ' + text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s+.#/-]/g, ' ') + ' ';

    // Herken meerwoords-synoniemen (bv. "content marketing") als één token.
    const phraseHits = [];
    for (const [variant, canon] of Object.entries(SYNONYM_LOOKUP)) {
      if (variant.includes(' ')) {
        const re = new RegExp('\\s' + variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s', 'g');
        if (re.test(clean)) {
          phraseHits.push(canon);
          clean = clean.replace(re, ' ');
        }
      }
    }

    const rawTokens = clean.split(/\s+/).filter(Boolean);
    const tokens = [];
    for (const raw of rawTokens) {
      const norm = normalizeTerm(raw);
      if (!norm || norm.length < 2) continue;
      if (STOPWORDS.has(norm)) continue;
      // Behoud zowel het genormaliseerde woord als de gestemde vorm.
      const stemmed = SYNONYM_LOOKUP[norm] ? norm : stem(norm);
      if (STOPWORDS.has(stemmed)) continue;
      tokens.push(stemmed);
    }
    return tokens.concat(phraseHits.map(stem));
  }

  // Tel-vector {term: frequentie} uit een lijst tokens.
  function termFrequencies(tokens) {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return tf;
  }

  /* ---------------------------------------------------------------------------
   * 3. Vacature-analyse
   * ------------------------------------------------------------------------ */

  // Probeer een functietitel te herkennen. Heuristiek: expliciete labels,
  // anders de eerste betekenisvolle regel.
  function extractJobTitle(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const labelRe = /^(functietitel|functie|vacature|titel|role|position|job title)\s*[:\-]\s*(.+)$/i;
    for (const line of lines.slice(0, 15)) {
      const m = line.match(labelRe);
      if (m && m[2].length > 1) return m[2].trim().replace(/[.;,]$/, '');
    }
    // Anders: eerste korte, "kop-achtige" regel (niet te lang, geen zin-einde).
    for (const line of lines.slice(0, 6)) {
      if (line.length >= 3 && line.length <= 70 && !/[.!?]$/.test(line) &&
          !/^(over|wij|we|als|jij|je|het|de|een)\b/i.test(line)) {
        return line.replace(/\s*\(.*?\)\s*$/, '').trim();
      }
    }
    return lines[0] ? lines[0].slice(0, 70) : '';
  }

  // Probeer een bedrijfsnaam te herkennen via labels of "bij/bei <Naam>".
  function extractCompany(text) {
    const patterns = [
      /(?:bedrijf|organisatie|werkgever|company|employer)\s*[:\-]\s*([A-ZÀ-Ý][\w&.\- ]{1,50})/,
      /\b(?:bij|voor|at)\s+([A-ZÀ-Ý][\w&.]+(?:\s[A-ZÀ-Ý][\w&.]+){0,3}(?:\s?(?:B\.?V\.?|N\.?V\.?|Group|Groep|GmbH|Inc\.?|Ltd\.?))?)/
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) {
        const name = m[1].trim().replace(/[.,;]$/, '');
        if (name.length >= 2 && name.length <= 50) return name;
      }
    }
    return '';
  }

  // Haal eis-achtige zinnen uit de tekst: bullets en zinnen met eis-signalen.
  function extractRequirements(text) {
    const rawLines = text.split(/\r?\n/).map(l => l.trim());
    const reqs = [];
    const seen = new Set();
    const bulletRe = /^\s*(?:[-•*·▪●○◦‣]|\d+[.)])\s+(.*)$/;
    const signalRe = /\b(ervaring|kennis|vaardig|bekend|aantoonbaar|affiniteit|beheersing|minimaal|minstens|opleiding|diploma|hbo|wo|mbo|jaar ervaring|je hebt|je bent|gezocht|vereist|pre|competenties|verantwoordelijk)\b/i;

    for (let line of rawLines) {
      let candidate = null;
      const bm = line.match(bulletRe);
      if (bm && bm[1].length > 2) {
        candidate = bm[1];
      } else if (signalRe.test(line) && line.length > 8 && line.length < 200) {
        candidate = line;
      }
      if (candidate) {
        candidate = candidate.replace(/\s+/g, ' ').trim().replace(/[;]$/, '');
        const key = candidate.toLowerCase();
        if (!seen.has(key) && candidate.length >= 4) {
          seen.add(key);
          reqs.push(candidate);
        }
      }
    }
    // Als er nauwelijks bullets/signalen zijn: val terug op losse zinnen.
    if (reqs.length < 3) {
      const sentences = text.replace(/\n/g, ' ').split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        const t = s.trim();
        if (t.length > 20 && t.length < 180 && signalRe.test(t)) {
          const key = t.toLowerCase();
          if (!seen.has(key)) { seen.add(key); reqs.push(t.replace(/\s+/g, ' ')); }
        }
      }
    }
    return reqs.slice(0, 12);
  }

  /* ---------------------------------------------------------------------------
   * 4. Scoring
   * ------------------------------------------------------------------------ */

  // Bouw de doorzoekbare gewogen tekst van één pakket-item.
  // Tags/skills tellen zwaarder dan vrije tekst.
  function itemSearchText(item, type) {
    const parts = { tags: [], strong: [], body: [] };
    const push = (bucket, val) => {
      if (!val) return;
      if (Array.isArray(val)) bucket.push(val.join(' '));
      else bucket.push(String(val));
    };
    push(parts.tags, item.tags);
    push(parts.tags, item.vaardigheden);

    if (type === 'werkervaring') {
      push(parts.strong, item.functie);
      push(parts.body, item.branche);
      push(parts.body, item.verantwoordelijkheden);
      push(parts.body, item.resultaat);
    } else if (type === 'projecten') {
      push(parts.strong, item.titel);
      push(parts.body, item.beschrijving);
      push(parts.body, item.resultaat);
    } else if (type === 'vaardigheden') {
      push(parts.strong, item.naam);
      push(parts.body, item.niveau);
    } else if (type === 'referenties') {
      push(parts.strong, item.functie);
      push(parts.body, item.citaat);
      push(parts.body, item.bedrijf);
      push(parts.body, item.relatie);
    }
    return parts;
  }

  // Gewogen term-vector voor een item: tags 3x, titel/functie 2x, body 1x.
  function itemVector(item, type) {
    const parts = itemSearchText(item, type);
    const vec = new Map();
    const add = (text, weight) => {
      for (const tok of tokenize(text)) {
        vec.set(tok, (vec.get(tok) || 0) + weight);
      }
    };
    add(parts.tags.join(' '), 3);
    add(parts.strong.join(' '), 2);
    add(parts.body.join(' '), 1);
    return vec;
  }

  // Ruwe score van een item t.o.v. de vacature-term-frequenties.
  // Som over gedeelde termen van (itemgewicht * vacaturefrequentie).
  function rawScore(itemVec, vacancyTf, matchedOut) {
    let score = 0;
    for (const [term, weight] of itemVec) {
      const vf = vacancyTf.get(term);
      if (vf) {
        score += weight * (1 + Math.log(1 + vf));
        if (matchedOut) matchedOut.add(term);
      }
    }
    return score;
  }

  /* ---------------------------------------------------------------------------
   * 5. Publieke API: analyseVacature(pakket, vacatureTekst)
   * ------------------------------------------------------------------------ */

  function analyseVacature(pakket, vacatureTekst) {
    const vacancyTokens = tokenize(vacatureTekst);
    const vacancyTf = termFrequencies(vacancyTokens);

    const sections = ['werkervaring', 'projecten', 'vaardigheden', 'referenties'];
    const scored = {};
    let globalMax = 0;

    // Score elk item per sectie.
    for (const type of sections) {
      const items = Array.isArray(pakket[type]) ? pakket[type] : [];
      scored[type] = items.map(item => {
        const vec = itemVector(item, type);
        const matched = new Set();
        const score = rawScore(vec, vacancyTf, matched);
        globalMax = Math.max(globalMax, score);
        return { item, score, matchedTerms: [...matched] };
      });
    }

    // Normaliseer naar 0–100 t.o.v. de hoogste score in het hele pakket,
    // zodat percentages onderling vergelijkbaar zijn. Sorteer aflopend.
    const denom = globalMax > 0 ? globalMax : 1;
    for (const type of sections) {
      for (const s of scored[type]) {
        s.percentage = Math.round(Math.min(100, (s.score / denom) * 100));
      }
      scored[type].sort((a, b) => b.score - a.score);
    }

    // Koppel vacature-eisen aan best passend werkervaring/project-item.
    const requirements = extractRequirements(vacatureTekst).map(req => {
      const reqTf = termFrequencies(tokenize(req));
      let best = null;
      for (const type of ['werkervaring', 'projecten', 'vaardigheden']) {
        for (const s of scored[type]) {
          const vec = itemVector(s.item, type);
          const matched = new Set();
          // Scoor eis tegen item met dezelfde logica, maar tegen de EIS-tokens.
          let sc = 0;
          for (const [term, weight] of vec) {
            const vf = reqTf.get(term);
            if (vf) { sc += weight; matched.add(term); }
          }
          if (sc > 0 && (!best || sc > best.score)) {
            best = { type, item: s.item, score: sc, matchedTerms: [...matched] };
          }
        }
      }
      return { eis: req, match: best };
    });

    // Overall matchscore = gemiddelde van top-items, gewogen.
    const topWork = scored.werkervaring.slice(0, 2);
    const topProj = scored.projecten.slice(0, 2);
    const topSkill = scored.vaardigheden.slice(0, 4);
    const pool = [...topWork, ...topProj, ...topSkill].filter(s => s.percentage > 0);
    const overall = pool.length
      ? Math.round(pool.reduce((a, s) => a + s.percentage, 0) / pool.length)
      : 0;

    return {
      jobTitle: extractJobTitle(vacatureTekst),
      company: extractCompany(vacatureTekst),
      keywords: [...vacancyTf.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([term, freq]) => ({ term, freq })),
      requirements,
      scored,
      overall
    };
  }

  // Exporteer de engine + enkele helpers (handig voor testen/uitbreiden).
  global.MatchingEngine = {
    analyseVacature,
    tokenize,
    STOPWORDS,
    SYNONYMS
  };

})(typeof window !== 'undefined' ? window : this);
