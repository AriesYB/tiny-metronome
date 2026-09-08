/* ============================================================
 * Tiny Metronome — UI wiring
 * ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /* ---------- i18n ---------- */

  const I18N = {
    zh: {
      title: '节拍器',
      tap: '点击测速',
      sig: '拍号',
      subdiv: '节奏型',
      sound: '音色',
      volume: '音量',
      timer: '定时停止',
      remaining: '剩余时间',
      hint: '空格 播放/停止 · ↑ ↓ 调节速度（Shift ±5）· T 测速 · 点击圆点切换重音',
      playAria: '播放 / 停止',
      decAria: '速度 -1',
      incAria: '速度 +1',
      bpmSliderAria: 'BPM 滑块',
      beatsAria: '每小节节拍，点击切换重音',
      numUpAria: '每小节拍数 +1',
      numDownAria: '每小节拍数 -1',
      denUpAria: '音符单位 上一个',
      denDownAria: '音符单位 下一个',
      soundNames: { wood: '响板', beep: '电子音', drum: '底鼓', hat: '踩镲' },
      timerOff: '关闭',
      minUnit: '分',
    },
    en: {
      title: 'Metronome',
      tap: 'Tap tempo',
      sig: 'Time',
      subdiv: 'Pattern',
      sound: 'Sound',
      volume: 'Volume',
      timer: 'Timer',
      remaining: 'Remaining',
      hint: 'Space play/stop · ↑ ↓ tempo (Shift ±5) · T tap · click a dot to toggle accent',
      playAria: 'Play / stop',
      decAria: 'tempo -1',
      incAria: 'tempo +1',
      bpmSliderAria: 'BPM slider',
      beatsAria: 'Beats per measure — click to toggle accent',
      numUpAria: 'beats per measure +1',
      numDownAria: 'beats per measure -1',
      denUpAria: 'note value up',
      denDownAria: 'note value down',
      soundNames: { wood: 'Wood', beep: 'Beep', drum: 'Kick', hat: 'Hat' },
      timerOff: 'Off',
      minUnit: 'min',
    },
  };

  /* ---------- tempo terms ---------- */

  const TEMPO_TERMS = [
    [20, 40, 'Grave', '庄板'],
    [40, 60, 'Largo', '广板'],
    [60, 66, 'Larghetto', '小广板'],
    [66, 76, 'Adagio', '柔板'],
    [76, 108, 'Andante', '行板'],
    [108, 120, 'Moderato', '中板'],
    [120, 156, 'Allegro', '快板'],
    [156, 172, 'Vivace', '活板'],
    [172, 200, 'Presto', '急板'],
    [200, 300, 'Prestissimo', '最急板'],
  ];

  /* ---------- rhythm patterns ----------
   * off: click positions within one beat (fraction of the beat, ascending)
   * notes: notation spec for the chip icon — { d: dotted, s: sixteenth }
   * ------------------------------------ */

  const PATTERNS = [
    { id: 'q',   off: [0],                            notes: [{},],                                              triplet: false },
    { id: 'e',   off: [0, 0.5],                       notes: [{}, {}],                                           triplet: false },
    { id: 't',   off: [0, 1 / 3, 2 / 3],              notes: [{}, {}, {}],                                       triplet: true  },
    { id: 's',   off: [0, 0.25, 0.5, 0.75],           notes: [{ s: true }, { s: true }, { s: true }, { s: true }], triplet: false },
    { id: 'dA',  off: [0, 0.75],                      notes: [{ d: true }, { s: true }],                         triplet: false },
    { id: 'dB',  off: [0, 0.25],                      notes: [{ s: true }, { d: true }],                         triplet: false },
    { id: 'a2s', off: [0, 0.5, 0.75],                 notes: [{}, { s: true }, { s: true }],                     triplet: false },
    { id: 's2a', off: [0, 0.25, 0.5],                 notes: [{ s: true }, { s: true }, {}],                     triplet: false },
    { id: 'syn', off: [0, 0.25, 0.75],                notes: [{ s: true }, {}, { s: true }],                     triplet: false },
  ];
  const PATTERN_LABELS = {
    zh: {
      q:   { 2: '二分', 4: '四分', 8: '八分', 16: '十六分' },
      e:   { 2: '四分', 4: '八分', 8: '十六分', 16: '三十二分' },
      t:   '三连音',
      s:   { 2: '八分', 4: '十六分', 8: '三十二分', 16: '六十四分' },
      dA:  '附点',
      dB:  '反附点',
      a2s: { 2: '前四后八', 4: '前八后十六', 8: '前十六后三十二', 16: '前三十二后六十四' },
      s2a: { 2: '前八后四', 4: '前十六后八', 8: '前三十二后十六', 16: '前六十四后三十二' },
      syn: '切分',
    },
    en: {
      q:   { 2: 'Half', 4: 'Quarter', 8: '8th', 16: '16th' },
      e:   { 2: 'Quarter', 4: 'Eighth', 8: '16ths', 16: '32nds' },
      t:   'Triplet',
      s:   { 2: '8ths', 4: '16ths', 8: '32nds', 16: '64ths' },
      dA:  'Dotted',
      dB:  'Reverse',
      a2s: { 2: '4th+8ths', 4: '8th+16ths', 8: '16ths+32nds', 16: '32nds+64ths' },
      s2a: { 2: '8ths+4th', 4: '16ths+8th', 8: '32nds+16ths', 16: '64ths+32nds' },
      syn: 'Syncopa',
    },
  };
  // level-specific labels shift with the denominator; the rest are fixed
  function patternLabel(id) {
    const l = PATTERN_LABELS[lang][id] || id;
    return typeof l === 'string' ? l : (l[state.den] || l[4]);
  }
  // legacy settings used evenly-spaced subdivisions 1|2|3|4
  const SUBDIV_MIGRATE = { 1: 'q', 2: 'e', 3: 't', 4: 's' };

  /** Small beamed-note notation icon, rendered in currentColor.
   *  `den` (time-signature denominator) sets the beat note value, so the
   *  icon notates the pattern at the current unit: at 8/x the "eighth"
   *  pattern is drawn as two sixteenths, and so on. */
  function notationSvg(p, den = 4) {
    const L = { 2: -1, 4: 0, 8: 1, 16: 2 }[den] ?? 0; // beat note: -1 half … 2 sixteenth
    const notes = p.notes;
    const n = notes.length;
    const lv = notes.map((nt) => (n === 1 ? L : L + 1 + (nt.s ? 1 : 0)));
    const maxLv = Math.max(...lv);
    const sp = 10.5, x0 = 7, stemTop = 6;
    const headY = 20 + Math.max(0, maxLv - 2) * 4; // extra room under 3–4 beams
    const stemX = (i) => x0 + i * sp + 2.9;
    const width = 14 + (n - 1) * sp + (notes[n - 1].d ? 5 : 0);
    let out = '';
    notes.forEach((nt, i) => {
      const cx = x0 + i * sp;
      out += lv[i] < 0 // half note: hollow head
        ? `<ellipse class="hollow" cx="${cx}" cy="${headY}" rx="3.4" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.4" transform="rotate(-18 ${cx} ${headY})"/>`
        : `<ellipse cx="${cx}" cy="${headY}" rx="3.4" ry="2.5" transform="rotate(-18 ${cx} ${headY})"/>`;
      out += `<rect x="${cx + 2.5}" y="${stemTop}" width="1.3" height="${headY - stemTop - 1.5}"/>`;
      if (nt.d) out += `<circle cx="${cx + 6.3}" cy="${headY - 0.5}" r="1.35"/>`;
    });
    // beam row k links adjacent notes whose level is ≥ k
    const beamed = notes.map(() => false);
    for (let k = 1; k <= maxLv; k++) {
      for (let i = 0; i < n - 1; i++) {
        if (lv[i] >= k && lv[i + 1] >= k) {
          out += `<rect x="${stemX(i) - 0.2}" y="${stemTop + (k - 1) * 4}" width="${stemX(i + 1) - stemX(i) + 1.7}" height="${k === 1 ? 2.4 : 2.2}"/>`;
          beamed[i] = beamed[i + 1] = true;
        }
      }
    }
    // flags on short notes that end up un-beamed (e.g. ♪ ♩ ♪ at 2/x)
    notes.forEach((nt, i) => {
      for (let f = 0; f < (beamed[i] ? 0 : lv[i]); f++) {
        const y = stemTop + f * 3.6;
        out += `<path d="M ${stemX(i) + 1.4} ${y} c 2.4 1.4 3.3 3 2.8 5.8 c -0.9 -1.3 -1.7 -1.5 -2.8 -1.7 z"/>`;
      }
    });
    if (p.triplet) {
      out += `<text x="${(stemX(0) + stemX(n - 1)) / 2}" y="5" font-size="7" font-weight="700" text-anchor="middle">3</text>`;
    }
    return `<svg class="nota" viewBox="0 0 ${width} ${headY + 5}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out}</svg>`;
  }

  function patternById(id) {
    return PATTERNS.find((p) => p.id === id) || PATTERNS[0];
  }

  const TIMERS = [0, 1, 2, 5, 10, 15, 30];
  const DENS = [2, 4, 8, 16];
  const STORE_KEY = 'tiny-metronome.v1';
  const LEGACY_STORE_KEYS = ['maelzel.v1', 'open-metronome.v1'];

  /* ---------- state ---------- */

  const defaults = {
    lang: 'zh',
    theme: null,
    bpm: 120,
    num: 4,
    den: 4,
    pattern: 'q',
    sound: 'wood',
    volume: 80,
    timerMin: 0,
    accents: [true, false, false, false],
  };
  let state = load();

  const engine = new Metronome();
  let lang = state.lang || 'zh';
  let timerEndsAt = 0;
  let taps = [];

  /* ---------- persistence ---------- */

  function load() {
    try {
      const stored = localStorage.getItem(STORE_KEY)
        || LEGACY_STORE_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
      if (!stored) return { ...defaults };
      const raw = JSON.parse(stored);
      const s = { ...defaults, ...raw };
      s.bpm = clampInt(s.bpm, 20, 300, 120);
      s.num = clampInt(s.num, 1, 16, 4);
      if (!DENS.includes(s.den)) s.den = 4;
      if (!('pattern' in raw)) {
        s.pattern = SUBDIV_MIGRATE[raw.subdiv] || defaults.pattern; // migrate v1 evenly-spaced setting
      } else if (!PATTERNS.some((p) => p.id === s.pattern)) {
        s.pattern = defaults.pattern;
      }
      if (!Metronome.SOUNDS.includes(s.sound)) s.sound = 'wood';
      s.volume = clampInt(s.volume, 0, 100, 80);
      if (!TIMERS.includes(s.timerMin)) s.timerMin = 0;
      if (!Array.isArray(s.accents)) s.accents = defaults.accents;
      return s;
    } catch (e) {
      return { ...defaults };
    }
  }

  const saveTimer = debounce(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        ...state, accents: engine.accents,
      }));
    } catch (e) { /* private mode etc. */ }
  }, 250);

  function debounce(fn, ms) {
    let id;
    return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
  }

  function clampInt(v, lo, hi, fallback) {
    v = parseInt(v, 10);
    if (Number.isNaN(v)) return fallback;
    return Math.min(hi, Math.max(lo, v));
  }

  /* ---------- dom refs ---------- */

  const el = {
    langToggle: $('#langToggle'),
    themeToggle: $('#themeToggle'),
    themeIcon: $('#themeIcon'),
    dots: $('#dots'),
    bpmInput: $('#bpmInput'),
    bpmSlider: $('#bpmSlider'),
    bpmDown: $('#bpmDown'),
    bpmUp: $('#bpmUp'),
    tempoTerm: $('#tempoTerm'),
    playBtn: $('#playBtn'),
    tapBtn: $('#tapBtn'),
    sigNum: $('#sigNum'),
    sigDen: $('#sigDen'),
    numUp: $('#numUp'),
    numDown: $('#numDown'),
    denUp: $('#denUp'),
    denDown: $('#denDown'),
    subdivChips: $('#subdivChips'),
    soundChips: $('#soundChips'),
    timerChips: $('#timerChips'),
    volumeSlider: $('#volumeSlider'),
    volIcon: $('#volIcon'),
    timerReadoutRow: $('#timerReadoutRow'),
    timerLeft: $('#timerLeft'),
  };

  /* ---------- i18n apply ---------- */

  function t(key) { return I18N[lang][key]; }

  function applyI18n() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((n) => {
      n.setAttribute('aria-label', t(n.dataset.i18nAria));
    });
    el.langToggle.textContent = lang === 'zh' ? 'EN' : '中文';
    el.tapBtn.innerHTML = lang === 'zh' ? '点击测速' : 'Tap tempo';
    rebuildChips();
    renderDots();
    updateTempoTerm();
  }

  /* ---------- chips ---------- */

  function makeChip(label, active, onClick, extraHtml) {
    const b = document.createElement('button');
    b.className = 'chip' + (active ? ' active' : '');
    b.type = 'button';
    b.innerHTML = (extraHtml || '') + label;
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
    b.addEventListener('click', onClick);
    return b;
  }

  function rebuildChips() {
    // rhythm patterns (notation icon + label, 5 per row)
    el.subdivChips.innerHTML = '';
    PATTERNS.forEach((p) => {
      const chip = makeChip(
        patternLabel(p.id),
        state.pattern === p.id,
        () => setPatternId(p.id),
      );
      chip.classList.add('pattern-chip');
      chip.insertAdjacentHTML('afterbegin', notationSvg(p, state.den));
      el.subdivChips.appendChild(chip);
    });

    // sounds
    el.soundChips.innerHTML = '';
    Metronome.SOUNDS.forEach((s) => {
      el.soundChips.appendChild(makeChip(
        t('soundNames')[s], engine.sound === s, () => setSound(s),
      ));
    });

    // timer
    el.timerChips.innerHTML = '';
    TIMERS.forEach((m) => {
      el.timerChips.appendChild(makeChip(
        m === 0 ? t('timerOff') : `${m} ${t('minUnit')}`,
        state.timerMin === m,
        () => setTimer(m),
      ));
    });
  }

  /* ---------- beat dots ---------- */

  function renderDots() {
    el.dots.innerHTML = '';
    const n = engine.beatsPerMeasure;
    for (let i = 0; i < n; i++) {
      const beat = document.createElement('button');
      beat.type = 'button';
      beat.className = 'beat' + (engine.accents[i] ? ' accent' : '');
      beat.setAttribute('aria-label', `${i + 1}${lang === 'zh' ? '拍' : ''} ${engine.accents[i] ? '♪' : ''}`.trim());

      const dot = document.createElement('span');
      dot.className = 'beat-dot';
      beat.appendChild(dot);

      const subs = document.createElement('span');
      subs.className = 'subdots';
      for (let s = 1; s < engine.pattern.length; s++) {
        const sd = document.createElement('span');
        sd.className = 'subdot';
        sd.style.left = `${(engine.pattern[s] * 100).toFixed(1)}%`;
        subs.appendChild(sd);
      }
      beat.appendChild(subs);

      beat.addEventListener('click', () => {
        engine.accents[i] = !engine.accents[i];
        beat.classList.toggle('accent', engine.accents[i]);
        saveTimer();
      });
      el.dots.appendChild(beat);
    }
  }

  function pulseBeat(i) {
    const b = el.dots.children[i];
    if (!b) return;
    b.classList.remove('hit');
    void b.offsetWidth; // restart animation
    b.classList.add('hit');
  }

  function pulseSub(beatIdx, subIdx) {
    const b = el.dots.children[beatIdx];
    if (!b) return;
    const sd = b.querySelectorAll('.subdot')[subIdx - 1];
    if (!sd) return;
    sd.classList.add('hit');
    setTimeout(() => sd.classList.remove('hit'), 90);
  }

  /* ---------- bpm ---------- */

  function setBpm(v, opts = {}) {
    engine.setBpm(v);
    state.bpm = engine.bpm;
    if (document.activeElement !== el.bpmInput || opts.forceInput) {
      el.bpmInput.value = engine.bpm;
    }
    el.bpmSlider.value = engine.bpm;
    updateTempoTerm();
    saveTimer();
  }

  function updateTempoTerm() {
    const bpm = engine.bpm;
    const row = TEMPO_TERMS.find(([lo, hi]) => bpm >= lo && bpm <= hi);
    el.tempoTerm.textContent = row ? `${row[2]} · ${row[3]}` : '';
  }

  /* ---------- hold-to-repeat buttons ---------- */

  function bindHoldRepeat(btn, fn) {
    let iv = null;
    let delay = 200;
    let pointerHandled = false; // mouse/touch: pointerdown fires first, skip the trailing click
    const start = (e) => {
      e.preventDefault();
      pointerHandled = true;
      fn();
      const step = () => {
        fn();
        delay = Math.max(40, delay * 0.9);
        iv = setTimeout(step, delay);
      };
      iv = setTimeout(step, delay);
    };
    const stop = () => {
      if (iv) { clearTimeout(iv); iv = null; }
      delay = 200;
      setTimeout(() => { pointerHandled = false; }, 300); // in case the pointer gesture ends without a click
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('click', () => {
      if (pointerHandled) { pointerHandled = false; return; }
      fn(); // keyboard activation (Enter/Space) only fires click
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, stop));
  }

  /* ---------- transport ---------- */

  function setPlaying(on) {
    if (on) {
      engine.start();
      if (state.timerMin > 0) {
        timerEndsAt = Date.now() + state.timerMin * 60000;
        el.timerReadoutRow.hidden = false;
      }
    } else {
      engine.stop();
      timerEndsAt = 0;
      el.timerReadoutRow.hidden = true;
    }
    el.playBtn.classList.toggle('playing', on);
    el.playBtn.setAttribute('aria-label', t('playAria'));
  }

  const togglePlay = () => setPlaying(!engine.running);

  /* ---------- tap tempo ---------- */

  function onTap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now);
    if (taps.length > 8) taps.shift();

    el.tapBtn.classList.add('tapped');
    setTimeout(() => el.tapBtn.classList.remove('tapped'), 90);

    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
      const avg = sum / (taps.length - 1);
      setBpm(60000 / avg, { forceInput: true });
    }
    const label = t('tap');
    el.tapBtn.innerHTML = `${label} <span class="tap-count">×${taps.length}</span>`;
  }

  /* ---------- setters ---------- */

  function setNum(n) {
    engine.setBeats(n);
    state.num = engine.beatsPerMeasure;
    state.accents = engine.accents;
    el.sigNum.textContent = engine.beatsPerMeasure;
    renderDots();
    saveTimer();
  }

  function setDen(d) {
    const i = DENS.indexOf(d);
    if (i === -1) return;
    state.den = d;
    el.sigDen.textContent = d;
    rebuildChips(); // notation icons + labels shift with the beat unit
    saveTimer();
  }

  function cycleDen(dir) {
    const i = DENS.indexOf(state.den);
    setDen(DENS[(i + dir + DENS.length) % DENS.length]);
  }

  function setPatternId(id) {
    state.pattern = patternById(id).id;
    engine.setPattern(patternById(id).off);
    rebuildChips();
    renderDots();
    saveTimer();
  }

  function setSound(s) {
    engine.sound = s;
    state.sound = s;
    rebuildChips();
    saveTimer();
  }

  function setVolume(v) {
    const val = clampInt(v, 0, 100, 80);
    engine.volume = val / 100;
    state.volume = val;
    el.volumeSlider.value = val;
    el.volIcon.textContent = val === 0 ? '🔇' : val < 50 ? '🔉' : '🔊';
    saveTimer();
  }

  function setTimer(m) {
    state.timerMin = m;
    rebuildChips();
    if (engine.running) {
      if (m > 0) {
        timerEndsAt = Date.now() + m * 60000;
        el.timerReadoutRow.hidden = false;
      } else {
        timerEndsAt = 0;
        el.timerReadoutRow.hidden = true;
      }
    }
    saveTimer();
  }

  /* ---------- theme & lang ---------- */

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    el.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    saveTimer();
  }

  /* ---------- render loop ---------- */

  function fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function loop() {
    requestAnimationFrame(loop);

    if (engine.running && engine.context) {
      const events = engine.collectDue();
      for (const ev of events) {
        if (ev.isMain) pulseBeat(ev.beat);
        else pulseSub(ev.beat, ev.sub);
      }

      if (timerEndsAt) {
        const left = (timerEndsAt - Date.now()) / 1000;
        el.timerLeft.textContent = fmt(left);
        if (left <= 0) setPlaying(false);
      }
    }
  }

  /* ---------- keyboard ---------- */

  function onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      setBpm(engine.bpm + (e.shiftKey ? 5 : 1), { forceInput: true });
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setBpm(engine.bpm - (e.shiftKey ? 5 : 1), { forceInput: true });
    } else if (e.key === 't' || e.key === 'T') {
      onTap();
    }
  }

  /* ---------- boot ---------- */

  function boot() {
    // engine initial state from persisted settings
    engine.bpm = state.bpm;
    engine.setBeats(state.num);
    engine.accents = state.accents.slice(0, state.num);
    engine.setPattern(patternById(state.pattern).off);
    engine.sound = state.sound;
    engine.volume = state.volume / 100;

    lang = I18N[state.lang] ? state.lang : 'zh';
    const theme = state.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme);

    applyI18n();

    // tempo controls
    el.bpmInput.value = engine.bpm;
    el.bpmSlider.value = engine.bpm;
    updateTempoTerm();

    bindHoldRepeat(el.bpmDown, () => setBpm(engine.bpm - 1, { forceInput: true }));
    bindHoldRepeat(el.bpmUp, () => setBpm(engine.bpm + 1, { forceInput: true }));

    el.bpmSlider.addEventListener('input', () => setBpm(+el.bpmSlider.value, { forceInput: true }));
    el.bpmInput.addEventListener('focus', () => el.bpmInput.select());
    el.bpmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') el.bpmInput.blur();
    });
    el.bpmInput.addEventListener('blur', () => {
      const v = parseInt(el.bpmInput.value.replace(/\D/g, ''), 10);
      setBpm(Number.isNaN(v) ? engine.bpm : v, { forceInput: true });
    });

    // transport
    el.playBtn.addEventListener('click', togglePlay);
    el.tapBtn.addEventListener('click', onTap);

    // time signature
    el.sigNum.textContent = engine.beatsPerMeasure;
    el.sigDen.textContent = state.den;
    bindHoldRepeat(el.numUp, () => setNum(engine.beatsPerMeasure + 1));
    bindHoldRepeat(el.numDown, () => setNum(engine.beatsPerMeasure - 1));
    el.denUp.addEventListener('click', () => cycleDen(1));
    el.denDown.addEventListener('click', () => cycleDen(-1));

    // volume
    el.volumeSlider.value = state.volume;
    setVolume(state.volume);

    // top actions
    el.langToggle.addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      state.lang = lang;
      applyI18n();
      saveTimer();
    });
    el.themeToggle.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    // keyboard + misc
    document.addEventListener('keydown', onKey);

    // iOS/Chrome autoplay policy: unlock audio on first gesture
    document.addEventListener('pointerdown', () => {
      if (engine.context && engine.context.state === 'suspended') engine.context.resume();
    }, { passive: true });

    // keep time in background tabs
    document.addEventListener('visibilitychange', () => {
      engine.setBackgroundMode(document.hidden);
    });

    requestAnimationFrame(loop);
  }

  boot();
})();
