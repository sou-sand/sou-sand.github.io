/* MSN Money Survival Simulator — browser edition.
   Vanilla JS, no dependencies. Same balance and progression as the Windows 8.1 app. */
(function () {
  'use strict';

  var SAVE_KEY = 'msnMoneySimWeb_v1';

  var UPGRADES = [
    { id: 'headline', name: 'Clickbait Headline', desc: '+1 damage per click', base: 15, mul: 1.15, click: 1, dps: 0, mult: 1 },
    { id: 'ads', name: 'Sponsored Ad', desc: '+0.6 cash per second', base: 60, mul: 1.16, click: 0, dps: 0.6, mult: 1 },
    { id: 'analytics', name: 'Analytics Dashboard', desc: '+3 damage per click', base: 180, mul: 1.17, click: 3, dps: 0, mult: 1 },
    { id: 'bots', name: 'Automated Bots', desc: '+4 cash per second', base: 420, mul: 1.18, click: 0, dps: 4, mult: 1 },
    { id: 'insider', name: 'Insider Tip', desc: '+8 damage per click', base: 950, mul: 1.19, click: 8, dps: 0, mult: 1 },
    { id: 'algorithm', name: 'Trading Algorithm', desc: '+16 cash per second', base: 2400, mul: 1.2, click: 0, dps: 16, mult: 1 },
    { id: 'meme', name: 'Viral Meme', desc: '+24 damage per click', base: 6000, mul: 1.21, click: 24, dps: 0, mult: 1 },
    { id: 'takeover', name: 'Hostile Takeover', desc: '+55 cash per second', base: 15000, mul: 1.22, click: 0, dps: 55, mult: 1 },
    { id: 'keyboard', name: 'Golden Keyboard', desc: 'x1.3 to ALL damage and income', base: 45000, mul: 1.55, click: 0, dps: 0, mult: 1.3 },
    { id: 'hedge', name: 'Quantum Hedge Fund', desc: '+240 cash per second', base: 120000, mul: 1.23, click: 0, dps: 240, mult: 1 }
  ];

  var ACHIEVEMENTS = [
    { id: 'firstclick', title: 'First Blood', desc: 'Click the target once', glyph: '⌖', test: function (s) { return s.clicks >= 1; } },
    { id: 'pocket', title: 'Pocket Change', desc: 'Earn $100 in total', glyph: '$', test: function (s) { return s.earned >= 100; } },
    { id: 'buyer', title: 'Ad Buyer', desc: 'Buy your first upgrade', glyph: '+', test: function (s) { return levelCount() > 0; } },
    { id: 'slayer', title: 'Boss Slayer', desc: 'Defeat MSN Money once', glyph: '×', test: function (s) { return s.kills >= 1; } },
    { id: 'machine', title: 'Click Machine', desc: 'Click 100 times', glyph: '≡', test: function (s) { return s.clicks >= 100; } },
    { id: 'passive', title: 'Passive Income', desc: 'Reach 10 cash/second', glyph: '↗', test: function () { return dps() >= 10; } },
    { id: 'streak', title: 'On a Roll', desc: 'Reach a x2 combo', glyph: '★', test: function (s) { return s.combo >= 25; } },
    { id: 'million', title: 'Paper Millionaire', desc: 'Earn $10,000 in total', glyph: '$', test: function (s) { return s.earned >= 10000; } },
    { id: 'serial', title: 'Serial Terminator', desc: 'Defeat 10 bosses', glyph: '×', test: function (s) { return s.kills >= 10; } },
    { id: 'tycoon', title: 'Tycoon', desc: 'Buy 50 upgrades in one run', glyph: '◆', test: function () { return levelCount() >= 50; } },
    { id: 'ascended', title: 'Timeline Rewritten', desc: 'Ascend at least once', glyph: '∞', test: function (s) { return s.asc >= 1; } }
  ];

  var BOSS_NAMES = [
    'MSN Money — Ad Edition', 'MSN Money — Premium', 'MSN Money — Auto-Renew',
    'MSN Money — Pop-Up Swarm', 'MSN Money — Clickbait Prime', 'MSN Money — The Final Tab'
  ];

  function freshState() {
    return {
      cash: 0, earned: 0, clicks: 0, kills: 0, level: 1, hp: 90,
      combo: 0, lastClick: 0, asc: 0, sound: true, reduceMotion: false,
      unlocked: [], levels: {}, status: 'Click the target to terminate MSN Money.',
      offline: '', saved: Date.now()
    };
  }
  var state = freshState();
  var history = [];
  var cardRefs = [];
  var trophyRefs = [];
  var audioCtx = null;
  var toastTimer = null;
  var lastUIUpdate = 0;
  var chartTimer = 0;

  var el = {};
  function $(id) { return document.getElementById(id); }

  /* ---------------- Math ---------------- */
  function format(n) {
    if (!isFinite(n)) n = 0;
    if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Qa';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    if (n >= 10) return n.toFixed(0);
    if (n >= 1) return n.toFixed(1);
    return n.toFixed(2);
  }
  function levelOf(u) { return state.levels[u.id] || 0; }
  function levelCount() { return UPGRADES.reduce(function (sum, u) { return sum + levelOf(u); }, 0); }
  function prestige() { return Math.pow(1.3, state.asc); }
  function clickPower() {
    var flat = 1 + UPGRADES.reduce(function (s, u) { return s + u.click * levelOf(u); }, 0);
    var mult = UPGRADES.reduce(function (s, u) { return s * (u.mult > 1 ? Math.pow(u.mult, levelOf(u)) : 1); }, 1);
    return flat * mult * prestige();
  }
  function dps() {
    var flat = UPGRADES.reduce(function (s, u) { return s + u.dps * levelOf(u); }, 0);
    var mult = UPGRADES.reduce(function (s, u) { return s * (u.mult > 1 ? Math.pow(u.mult, levelOf(u)) : 1); }, 1);
    return flat * mult * prestige();
  }
  function bossMaxHp() { return Math.floor(90 * Math.pow(1.62, state.level - 1)); }
  function costOf(u) { return Math.floor(u.base * Math.pow(u.mul, levelOf(u))); }
  function comboMult() { return 1 + Math.min(state.combo, 50) * 0.04; }

  /* ---------------- Persistence ---------------- */
  function save() {
    try {
      state.saved = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) { /* private mode: keep playing */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var loaded = JSON.parse(raw);
      var fresh = freshState();
      Object.keys(fresh).forEach(function (key) {
        if (loaded[key] !== undefined && loaded[key] !== null) fresh[key] = loaded[key];
      });
      state = fresh;
      state.level = Math.max(1, state.level);
      state.hp = Math.min(bossMaxHp(), Math.max(0, state.hp));
      if (state.hp <= 0) state.hp = bossMaxHp();
      state.combo = 0;
      var away = (Date.now() - (state.saved || Date.now())) / 1000;
      if (away > 60 && dps() > 0) {
        var earned = dps() * Math.min(away, 8 * 3600) * 0.5;
        state.cash += earned;
        state.earned += earned;
        state.offline = 'Offline income: ' + format(earned);
        state.status = 'Welcome back. Your bots earned ' + format(earned) + ' while you were away.';
      }
    } catch (e) { state = freshState(); }
  }

  /* ---------------- Game actions ---------------- */
  function earn(amount) { state.cash += amount; state.earned += amount; }
  function damageBoss(amount) {
    state.hp -= amount;
    if (state.hp <= 0) killBoss();
  }
  function killBoss() {
    var reward = 25 * Math.pow(1.75, state.level - 1) * prestige();
    earn(reward);
    state.kills++;
    state.level++;
    state.hp = bossMaxHp();
    state.offline = '';
    state.status = 'TARGET ELIMINATED — +' + format(reward) + ' collected. A new tab has appeared.';
    el.killReward.textContent = '+' + format(reward) + ' collected';
    el.killBanner.classList.remove('show');
    void el.killBanner.offsetWidth;
    el.killBanner.classList.add('show');
    playSound('kill');
    confetti();
    checkAchievements();
    save();
  }
  function click() {
    var now = Date.now();
    state.combo = (now - state.lastClick <= 1250) ? Math.min(state.combo + 1, 50) : 1;
    state.lastClick = now;
    var damage = clickPower() * comboMult();
    earn(damage);
    damageBoss(damage);
    state.clicks++;
    checkAchievements();
    floatNumber(damage, state.combo >= 5);
    playSound(state.combo >= 10 ? 'combo' : 'click');
    updateUI();
  }
  function buy(u) {
    var cost = costOf(u);
    if (state.cash < cost) return;
    state.cash -= cost;
    state.levels[u.id] = levelOf(u) + 1;
    state.status = 'Purchased ' + u.name + '. Resistance is increasingly futile.';
    playSound('buy');
    checkAchievements();
    updateUI();
    save();
  }
  function checkAchievements() {
    ACHIEVEMENTS.forEach(function (a) {
      if (state.unlocked.indexOf(a.id) !== -1 || !a.test(state)) return;
      state.unlocked.push(a.id);
      state.status = 'ACHIEVEMENT UNLOCKED — ' + a.title;
      playSound('unlock');
      showToast(state.status);
      save();
    });
  }
  function ascend() {
    if (state.kills < 5) return;
    state.asc++;
    state.cash = 0;
    state.kills = 0;
    state.level = 1;
    state.hp = bossMaxHp();
    state.combo = 0;
    state.levels = {};
    state.offline = '';
    state.status = 'Timeline rewritten. All future damage x' + prestige().toFixed(2) + '.';
    checkAchievements();
    updateUI();
    save();
  }
  function reset() {
    state = freshState();
    history = [];
    save();
    updateUI();
    buildTrophies();
    showToast('Fresh start. The cycle begins again.');
  }
  function tick(dt) {
    var income = dps() * dt;
    if (income > 0) { earn(income); damageBoss(income); }
    if (state.combo > 0 && Date.now() - state.lastClick > 1250) state.combo = 0;
  }

  /* ---------------- Feedback / FX ---------------- */
  function playSound(name) {
    if (!state.sound) return;
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var tones = {
        click: [[900, 0, 0.05, 0.16]], combo: [[1320, 0, 0.07, 0.14]],
        buy: [[520, 0, 0.06, 0.16], [980, 0.06, 0.07, 0.14]],
        kill: [[700, 0, 0.12, 0.18], [440, 0.12, 0.12, 0.16], [120, 0.24, 0.18, 0.16]],
        unlock: [[620, 0, 0.08, 0.13], [820, 0.08, 0.08, 0.13], [1100, 0.16, 0.12, 0.13]]
      };
      (tones[name] || tones.click).forEach(function (t) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t[0], audioCtx.currentTime + t[1]);
        if (name === 'kill') osc.frequency.exponentialRampToValueAtTime(Math.max(40, t[0] * 0.35), audioCtx.currentTime + t[1] + t[2]);
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + t[1]);
        gain.gain.exponentialRampToValueAtTime(t[3], audioCtx.currentTime + t[1] + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t[1] + t[2]);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + t[1]);
        osc.stop(audioCtx.currentTime + t[1] + t[2] + 0.02);
      });
    } catch (e) { /* audio is optional */ }
  }
  function floatNumber(amount, critical) {
    if (state.reduceMotion) return;
    var node = document.createElement('div');
    node.className = 'float-num' + (critical ? ' crit' : '');
    node.textContent = '-' + format(amount);
    node.style.left = (50 + (Math.random() * 30 - 15)) + '%';
    node.style.top = (42 + (Math.random() * 20 - 10)) + '%';
    el.fxLayer.appendChild(node);
    node.addEventListener('animationend', function () { node.remove(); });
  }
  function confetti() {
    if (state.reduceMotion) return;
    var colors = ['#00bcd4', '#ffb300', '#7dffd4', '#ff5252'];
    for (var i = 0; i < 14; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti';
      piece.style.background = colors[i % colors.length];
      piece.style.left = '50%';
      piece.style.top = '50%';
      piece.style.setProperty('--dx', Math.round(Math.random() * 440 - 220) + 'px');
      piece.style.setProperty('--dy', Math.round(Math.random() * 260 - 200) + 'px');
      el.fxLayer.appendChild(piece);
      piece.addEventListener('animationend', function () { this.remove(); });
    }
  }
  function showToast(message) {
    if (!message) return;
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 3200);
  }

  /* ---------------- DOM building ---------------- */
  function buildCards() {
    el.upgradeGrid.innerHTML = '';
    cardRefs = [];
    UPGRADES.forEach(function (u, index) {
      var card = document.createElement('div');
      card.className = 'upgrade-card';
      card.style.animationDelay = (index * 25) + 'ms';
      card.innerHTML =
        '<div><div class="card-top"><span class="badge"></span></div>' +
        '<div class="card-name"></div><div class="card-desc"></div>' +
        '<div class="card-effect"></div></div>' +
        '<div class="card-bottom"><span class="cost"></span><button class="buy">BUY</button></div>';
      card.querySelector('.card-name').textContent = u.name;
      card.querySelector('.card-desc').textContent = u.desc;
      card.querySelector('.card-effect').textContent = u.mult > 1
        ? 'x' + u.mult + ' all output / level'
        : (u.click > 0 ? '+' + u.click + ' / click' : '+' + u.dps + ' / sec');
      var badge = card.querySelector('.badge');
      var cost = card.querySelector('.cost');
      var button = card.querySelector('.buy');
      button.addEventListener('click', function () { buy(u); });
      el.upgradeGrid.appendChild(card);
      cardRefs.push({ card: card, badge: badge, cost: cost, button: button, def: u });
    });
  }
  function buildTrophies() {
    el.trophyGrid.innerHTML = '';
    trophyRefs = [];
    ACHIEVEMENTS.forEach(function (a, index) {
      var card = document.createElement('div');
      card.className = 'trophy-card';
      card.style.animationDelay = (index * 25) + 'ms';
      card.innerHTML =
        '<div class="trophy-glyph"></div><div class="trophy-info">' +
        '<div class="trophy-title"></div><div class="trophy-desc"></div>' +
        '<div class="trophy-status"></div></div>';
      card.querySelector('.trophy-glyph').textContent = a.glyph;
      card.querySelector('.trophy-title').textContent = a.title;
      card.querySelector('.trophy-desc').textContent = a.desc;
      el.trophyGrid.appendChild(card);
      trophyRefs.push({ card: card, status: card.querySelector('.trophy-status'), def: a });
    });
  }
  function drawChart() {
    var canvas = el.chart;
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var w = rect.width, h = rect.height;
    ctx.strokeStyle = '#26343e';
    ctx.lineWidth = 1;
    for (var i = 1; i <= 3; i++) {
      var y = h * i / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    if (history.length < 2) return;
    var min = Math.min.apply(null, history), max = Math.max.apply(null, history);
    var span = Math.max(1, max - min);
    var pts = history.map(function (value, index) {
      return [8 + index / (history.length - 1) * (w - 16), h - 14 - (value - min) / span * (h - 28)];
    });
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
    var last = pts[pts.length - 1];
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.arc(last[0], last[1], 4, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------------- UI sync ---------------- */
  function updateUI() {
    var maxHp = bossMaxHp();
    el.hudCash.textContent = '$' + format(state.cash);
    el.hudClick.textContent = format(clickPower());
    el.hudDps.textContent = format(dps());
    el.hudKills.textContent = state.kills;
    el.hudMult.textContent = 'x' + prestige().toFixed(2);
    el.statClick.textContent = format(clickPower());
    el.statDps.textContent = format(dps());
    el.statTier.textContent = state.level;
    el.bossName.textContent = BOSS_NAMES[(state.level - 1) % BOSS_NAMES.length];
    el.bossHpText.textContent = format(state.hp) + ' / ' + format(maxHp);
    el.bossHpBar.style.width = Math.max(0, Math.min(100, state.hp / maxHp * 100)) + '%';
    el.statusLine.textContent = state.status;
    el.comboBar.style.width = Math.min(100, state.combo / 50 * 100) + '%';
    el.comboText.textContent = state.combo < 2 ? '' : 'x' + comboMult().toFixed(2) + ' COMBO';
    el.offlineText.textContent = state.offline || '';

    el.shopCash.textContent = '$' + format(state.cash);
    cardRefs.forEach(function (ref) {
      var level = levelOf(ref.def);
      var cost = costOf(ref.def);
      ref.badge.textContent = level === 0 ? 'NEW' : 'Lv ' + level;
      ref.cost.textContent = '$' + format(cost);
      ref.button.disabled = state.cash < cost;
    });

    el.statEarned.textContent = '$' + format(state.earned);
    el.statClicks.textContent = format(state.clicks);
    el.statUpgrades.textContent = levelCount();
    el.statAsc.textContent = state.asc;
    el.trophyCount.textContent = state.unlocked.length + ' / ' + ACHIEVEMENTS.length;
    trophyRefs.forEach(function (ref) {
      var unlocked = state.unlocked.indexOf(ref.def.id) !== -1;
      ref.card.classList.toggle('unlocked', unlocked);
      ref.status.textContent = unlocked ? 'UNLOCKED' : 'LOCKED';
    });

    el.settingsMult.textContent = 'x' + prestige().toFixed(2);
    el.settingsKills.textContent = state.kills;
    el.ascendBtn.disabled = state.kills < 5;
    el.soundToggle.checked = state.sound;
    el.motionToggle.checked = state.reduceMotion;
    document.body.classList.toggle('reduce-motion', state.reduceMotion);
  }

  function switchView(name) {
    document.querySelectorAll('.view').forEach(function (view) {
      view.classList.toggle('active', view.id === 'view-' + name);
    });
    document.querySelectorAll('.appbar-btn').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-view') === name);
    });
    if (name === 'stats') drawChart();
  }

  function confirmDialog(title, text, onOk) {
    el.confirmTitle.textContent = title;
    el.confirmText.textContent = text;
    el.confirm.classList.remove('hidden');
    el.confirmOk.onclick = function () { el.confirm.classList.add('hidden'); onOk(); };
    el.confirmCancel.onclick = function () { el.confirm.classList.add('hidden'); };
  }

  /* ---------------- Boot ---------------- */
  function init() {
    ['hud-cash', 'hud-click', 'hud-dps', 'hud-kills', 'hud-mult',
      'boss-name', 'boss-hp-text', 'boss-hp-bar', 'status-line', 'combo-bar', 'combo-text',
      'offline-text', 'stat-click', 'stat-dps', 'stat-tier', 'target', 'fx-layer',
      'kill-banner', 'kill-reward', 'upgrade-grid', 'shop-cash', 'stat-earned',
      'stat-clicks', 'stat-upgrades', 'stat-asc', 'chart', 'trophy-grid', 'trophy-count',
      'settings-mult', 'settings-kills', 'ascend-btn', 'reset-btn', 'sound-toggle',
      'motion-toggle', 'toast', 'confirm', 'confirm-title', 'confirm-text',
      'confirm-ok', 'confirm-cancel'].forEach(function (id) {
        el[id.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })] = $(id);
      });

    load();
    history = [state.cash];
    buildCards();
    buildTrophies();
    updateUI();

    el.target.addEventListener('click', click);
    document.querySelectorAll('.appbar-btn').forEach(function (button) {
      button.addEventListener('click', function () { switchView(button.getAttribute('data-view')); });
    });
    el.soundToggle.addEventListener('change', function () { state.sound = el.soundToggle.checked; save(); });
    el.motionToggle.addEventListener('change', function () { state.reduceMotion = el.motionToggle.checked; save(); updateUI(); });
    el.ascendBtn.addEventListener('click', function () {
      confirmDialog('Reboot the timeline?', 'Cash, upgrades and targets reset. Every reboot adds a permanent x1.3 multiplier. Trophies and lifetime stats stay.', ascend);
    });
    el.resetBtn.addEventListener('click', function () {
      confirmDialog('Reset everything?', 'This deletes all cash, upgrades, targets, trophies and reboots. This cannot be undone.', reset);
    });
    document.addEventListener('keydown', function (e) {
      var keys = ['arena', 'upgrades', 'stats', 'trophies', 'settings'];
      if (/^[1-5]$/.test(e.key)) switchView(keys[parseInt(e.key, 10) - 1]);
    });
    window.addEventListener('resize', drawChart);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
    window.addEventListener('beforeunload', save);

    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tick(dt);
      if (now - lastUIUpdate > 80) { updateUI(); lastUIUpdate = now; }
      if (now - chartTimer > 1000) {
        chartTimer = now;
        history.push(state.cash);
        if (history.length > 60) history.shift();
        if ($('view-stats').classList.contains('active')) drawChart();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    setInterval(save, 10000);
    showToast(state.status);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
