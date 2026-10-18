/**
 * app.js — Game Loop Principal y Orquestador
 * Cosmic Starlight Shmup
 *
 * Gestiona:
 * - Estados del juego: MENU | PLAYING | PAUSED | STAGE_CLEAR | BOSS_WARNING | GAME_OVER | VICTORY
 * - Input del teclado y botones
 * - Fondo parallax multicapa (estrellas, nebulosas)
 * - Colisiones: balas-enemigos, balas-jugador, jugador-enemigos, jugador-powerups
 * - Oleadas de enemigos por sector (3 sectores + jefe cada uno)
 * - Tabla de récords en localStorage
 * - Sistema de partículas de explosión
 * - HUD reactivo (dirty flag)
 * - Textos flotantes de puntuación
 */

'use strict';

(() => {

  // ── Canvas y contexto ─────────────────────────────────────────────
  const canvas    = document.getElementById('canvas-main');
  const ctx       = canvas.getContext('2d');
  const CW        = canvas.width;
  const CH        = canvas.height;

  const menuCanvas = document.getElementById('canvas-menu');
  const mCtx       = menuCanvas.getContext('2d');

  // ── Estado global del juego ───────────────────────────────────────
  const STATES = { MENU:'menu', PLAYING:'playing', PAUSED:'paused',
                   BOSS_WARNING:'boss_warning', STAGE_CLEAR:'stage_clear',
                   GAME_OVER:'game_over', VICTORY:'victory' };

  let gameState     = STATES.MENU;
  let sector        = 1;       // 1, 2, 3
  let wave          = 0;       // oleada dentro del sector
  let waveTimer     = 0;
  let totalEnemyKills = 0;
  let totalBossKills  = 0;
  let grazeTotal      = 0;

  // ── Input ─────────────────────────────────────────────────────────
  const keys = {};
  let   shootHeld   = false;
  let   bombPressed = false;

  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === 'Shift') e.preventDefault();
    if (gameState === STATES.PLAYING) {
      if (e.key === ' ' || e.key === 'z' || e.key === 'Z') { shootHeld = true; e.preventDefault(); }
      if (e.key === 'x' || e.key === 'X') { bombPressed = true; }
      if (e.key === 'Escape') togglePause();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.key] = false;
    if (e.key === ' ' || e.key === 'z' || e.key === 'Z') shootHeld = false;
  });

  // ── Partículas de explosión ───────────────────────────────────────
  const particles = [];

  function spawnExplosion(x, y, color = '#ff8800', count = 18, big = false) {
    const n = big ? count * 2 : count;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (big ? 3 : 1.5) + Math.random() * (big ? 6 : 4);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 25 + Math.random() * 30,
        maxLife: 55,
        r: (big ? 3 : 1.5) + Math.random() * (big ? 4 : 2.5),
        color,
        alpha: 1,
      });
    }
    // Onda de choque
    if (big) {
      particles.push({ shockwave: true, x, y, r: 5, maxR: 80, life: 20, maxLife: 20, color });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.shockwave) {
        p.r = p.maxR * (1 - p.life / p.maxLife);
        continue;
      }
      p.x  += p.vx;
      p.y  += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.alpha = p.life / p.maxLife;
      p.r *= 0.97;
    }
  }

  function renderParticles() {
    ctx.save();
    for (const p of particles) {
      if (p.shockwave) {
        const alpha = p.life / p.maxLife * 0.5;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // ── Textos flotantes ──────────────────────────────────────────────
  const floatTexts = [];

  function addFloatText(x, y, text, color = '#ffff88') {
    floatTexts.push({ x, y, text, color, life: 50, vy: -1.2 });
  }

  function updateFloatTexts() {
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const t = floatTexts[i];
      t.y    += t.vy;
      t.life--;
      if (t.life <= 0) floatTexts.splice(i, 1);
    }
  }

  function renderFloatTexts() {
    ctx.save();
    ctx.font = 'bold 11px "Orbitron", monospace';
    ctx.textAlign = 'center';
    for (const t of floatTexts) {
      ctx.globalAlpha = t.life / 50;
      ctx.fillStyle   = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur  = 8;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // ── Fondo Parallax ────────────────────────────────────────────────
  const STAR_LAYERS = [
    { stars: [], speed: 0.3, r: 0.5, alpha: 0.4 },
    { stars: [], speed: 0.8, r: 1.0, alpha: 0.65 },
    { stars: [], speed: 1.8, r: 1.6, alpha: 0.9  },
  ];

  // Nebulosas de fondo
  const NEBULAE = [];

  function initBackground() {
    STAR_LAYERS.forEach(layer => {
      layer.stars = [];
      for (let i = 0; i < 120; i++) {
        layer.stars.push({ x: Math.random() * CW, y: Math.random() * CH });
      }
    });
    NEBULAE.length = 0;
    for (let i = 0; i < 5; i++) {
      NEBULAE.push({
        x: Math.random() * CW,
        y: Math.random() * CH,
        r: 60 + Math.random() * 120,
        hue: Math.floor(Math.random() * 360),
        alpha: 0.04 + Math.random() * 0.06,
      });
    }
  }

  function updateBackground() {
    STAR_LAYERS.forEach(layer => {
      layer.stars.forEach(s => {
        s.y += layer.speed;
        if (s.y > CH + 2) { s.y = -2; s.x = Math.random() * CW; }
      });
    });
    NEBULAE.forEach(n => {
      n.y += 0.1;
      if (n.y > CH + n.r) { n.y = -n.r; n.x = Math.random() * CW; }
    });
  }

  function renderBackground() {
    // Fondo negro espacial
    ctx.fillStyle = '#010208';
    ctx.fillRect(0, 0, CW, CH);

    // Nebulosas
    for (const n of NEBULAE) {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grad.addColorStop(0, `hsla(${n.hue},80%,60%,${n.alpha})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    // Estrellas por capa
    for (const layer of STAR_LAYERS) {
      ctx.fillStyle = `rgba(255,255,255,${layer.alpha})`;
      for (const s of layer.stars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, layer.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Sistema de Oleadas (Wave Spawner) ─────────────────────────────
  /**
   * Define las oleadas de cada sector.
   * sector 1: INTERCEPTORS + FORMATION_V → BOSS_1
   * sector 2: BOMBERS + TURRETS          → BOSS_2
   * sector 3: Todos los tipos + mixto    → BOSS_3
   */
  const SECTOR_WAVES = {
    1: [
      { type: 'enemies', pattern: 'line_h',  etype: 'INTERCEPTOR', count: 5,  delay: 0 },
      { type: 'enemies', pattern: 'v_shape', etype: 'FORMATION_V', count: 7,  delay: 0 },
      { type: 'enemies', pattern: 'line_h',  etype: 'INTERCEPTOR', count: 8,  delay: 0 },
      { type: 'enemies', pattern: 'scatter', etype: 'KAMIKAZE',    count: 10, delay: 0 },
      { type: 'enemies', pattern: 'line_h',  etype: 'INTERCEPTOR', count: 6,  delay: 0 },
      { type: 'enemies', pattern: 'v_shape', etype: 'FORMATION_V', count: 9,  delay: 0 },
      { type: 'boss', bossKey: 'BOSS_1' },
    ],
    2: [
      { type: 'enemies', pattern: 'line_h',  etype: 'BOMBER',      count: 4,  delay: 0 },
      { type: 'enemies', pattern: 'scatter', etype: 'KAMIKAZE',    count: 12, delay: 0 },
      { type: 'enemies', pattern: 'column',  etype: 'TURRET',      count: 2,  delay: 0 },
      { type: 'enemies', pattern: 'line_h',  etype: 'BOMBER',      count: 5,  delay: 0 },
      { type: 'enemies', pattern: 'mixed',   etype: null,          count: 8,  delay: 0 },
      { type: 'enemies', pattern: 'column',  etype: 'TURRET',      count: 3,  delay: 0 },
      { type: 'enemies', pattern: 'scatter', etype: 'KAMIKAZE',    count: 15, delay: 0 },
      { type: 'boss', bossKey: 'BOSS_2' },
    ],
    3: [
      { type: 'enemies', pattern: 'mixed',   etype: null,          count: 10, delay: 0 },
      { type: 'enemies', pattern: 'v_shape', etype: 'FORMATION_V', count: 9,  delay: 0 },
      { type: 'enemies', pattern: 'line_h',  etype: 'BOMBER',      count: 6,  delay: 0 },
      { type: 'enemies', pattern: 'scatter', etype: 'KAMIKAZE',    count: 18, delay: 0 },
      { type: 'enemies', pattern: 'column',  etype: 'TURRET',      count: 4,  delay: 0 },
      { type: 'enemies', pattern: 'mixed',   etype: null,          count: 15, delay: 0 },
      { type: 'enemies', pattern: 'mixed',   etype: null,          count: 12, delay: 0 },
      { type: 'enemies', pattern: 'scatter', etype: 'KAMIKAZE',    count: 20, delay: 0 },
      { type: 'boss', bossKey: 'BOSS_3' },
    ],
  };

  let _wavePending = false;
  let _waveDelay   = 0;
  let _bossWarningTimer = 0;
  let _stageClearTimer  = 0;

  function spawnWave(waveData) {
    const { pattern, etype, count } = waveData;
    const MIXED_TYPES = ['INTERCEPTOR','BOMBER','KAMIKAZE','FORMATION_V'];

    for (let i = 0; i < count; i++) {
      const type = etype || MIXED_TYPES[Math.floor(Math.random() * MIXED_TYPES.length)];
      let x, y, vx, vy;

      if (pattern === 'line_h') {
        x  = (CW / (count + 1)) * (i + 1);
        y  = -30 - Math.random() * 20;
        vx = 0;
        vy = 1.2 + Math.random() * 0.6;
      } else if (pattern === 'v_shape') {
        const side = i < count / 2 ? -1 : 1;
        const idx  = i < count / 2 ? i : i - Math.floor(count / 2);
        x  = CW / 2 + side * (40 + idx * 35);
        y  = -40 - idx * 15;
        vx = 0;
        vy = 1.5;
      } else if (pattern === 'column') {
        x  = 80 + Math.random() * (CW - 160);
        y  = -50 - i * 80;
        vx = (Math.random() - 0.5) * 0.5;
        vy = 0.7;
      } else { // scatter / mixed
        x  = 20 + Math.random() * (CW - 40);
        y  = -20 - Math.random() * 80;
        vx = (Math.random() - 0.5) * 1.5;
        vy = 1.0 + Math.random() * 1.5;
      }
      EnemySystem.spawn({ type, x, y, vx, vy, formationRole: i });
    }
  }

  function advanceWave() {
    if (_wavePending) return;
    const waves = SECTOR_WAVES[sector];
    if (!waves) return;

    if (wave >= waves.length) return; // sector completo

    const waveData = waves[wave];
    wave++;

    if (waveData.type === 'boss') {
      // Mostrar boss warning antes de spawnear
      _bossWarningTimer = 180;
      gameState = STATES.BOSS_WARNING;
      AudioEngine.bossWarning();
      document.getElementById('boss-warning').classList.remove('hidden');

      setTimeout(() => {
        document.getElementById('boss-warning').classList.add('hidden');
        EnemySystem.spawnBoss(waveData.bossKey, CW);
        AudioEngine.setBossMode(true);
        showBossHP(true);
        gameState = STATES.PLAYING;
        updateMarquee(`⚠ BOSS — ${EnemySystem.getBoss().name} ⚠`);
      }, 3000);

    } else {
      spawnWave(waveData);
      _wavePending = false;
    }
  }

  // ── HUD DOM (dirty flag) ──────────────────────────────────────────
  let _hudDirty = true;

  const hudScore    = document.getElementById('hud-score');
  const hudHiscore  = document.getElementById('hud-hiscore');
  const hudStage    = document.getElementById('hud-stage');
  const hudLives    = document.getElementById('hud-lives');
  const hudBombs    = document.getElementById('hud-bombs');
  const hudPowerFill= document.getElementById('hud-power-fill');
  const hudPowerLbl = document.getElementById('hud-power-label');
  const hudWeapon   = document.getElementById('hud-weapon');
  const hudGraze    = document.getElementById('hud-graze');
  const hudShieldFill = document.getElementById('hud-shield-fill');
  const hudBossHpFill  = document.getElementById('hud-boss-hp-fill');
  const hudBossPhase   = document.getElementById('hud-boss-phase');
  const bossPanelEl    = document.getElementById('boss-hp-panel');
  const fpsCounter     = document.getElementById('fps-counter');

  function showBossHP(show) {
    bossPanelEl.style.display = show ? 'flex' : 'none';
  }

  function updateHUD(hiScore) {
    const ps = Player.getState();
    const boss = EnemySystem.getBoss();

    hudScore.textContent   = ps.score.toLocaleString();
    hudHiscore.textContent = hiScore.toLocaleString();
    hudStage.textContent   = `${sector}-${wave}`;

    // Vidas
    hudLives.innerHTML = '';
    for (let i = 0; i < ps.maxLives; i++) {
      const span = document.createElement('span');
      span.className = 'life-icon' + (i >= ps.lives ? ' used' : '');
      span.textContent = '★';
      hudLives.appendChild(span);
    }

    // Bombas
    hudBombs.innerHTML = '';
    for (let i = 0; i < ps.maxBombs; i++) {
      const span = document.createElement('span');
      span.className = 'bomb-icon' + (i >= ps.bombs ? ' used' : '');
      span.textContent = '💣';
      hudBombs.appendChild(span);
    }

    // Barra de poder
    const powerPct = (ps.powerLevel / 3) * 100;
    hudPowerFill.style.width = powerPct + '%';
    hudPowerLbl.textContent  = `LV ${ps.powerLevel}`;

    // Arma
    const weaponLabels = { spread: 'SPREAD', laser: 'LASER', missile: 'MISSILE' };
    hudWeapon.textContent = weaponLabels[ps.weapon] || 'SPREAD';

    // Graze
    hudGraze.textContent = ps.grazeCount;

    // Escudo
    const shieldPct = ps.shieldMax > 0 ? (ps.shield / ps.shieldMax) * 100 : 0;
    hudShieldFill.style.width = shieldPct + '%';

    // Boss HP
    if (boss && boss.alive) {
      const bHpPct = (boss.hp / boss.maxHp) * 100;
      hudBossHpFill.style.width = bHpPct + '%';
      hudBossPhase.textContent  = boss.phases[boss.phaseIdx].label.split('—')[0].trim();
    }
  }

  // ── Récords (localStorage) ────────────────────────────────────────
  const LS_KEY = 'cosmic-starlight-scores';

  function loadScores() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || [];
    } catch { return []; }
  }

  function saveScore(score, stageStr) {
    const scores = loadScores();
    scores.push({ score, stage: stageStr, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    scores.splice(10); // top 10
    localStorage.setItem(LS_KEY, JSON.stringify(scores));
    return scores[0].score === score && scores.indexOf(scores.find(s => s.score === score)) === 0;
  }

  function getHiScore() {
    const scores = loadScores();
    return scores.length > 0 ? scores[0].score : 0;
  }

  function renderScoresTable() {
    const tbody  = document.getElementById('scores-tbody');
    const scores = loadScores();
    tbody.innerHTML = '';
    if (scores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.5">NO SCORES YET</td></tr>';
      return;
    }
    scores.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>#${i+1}</td><td>PILOT</td><td>${s.score.toLocaleString()}</td><td>${s.stage}</td>`;
      tbody.appendChild(tr);
    });
  }

  // Actualizar menú high score
  function updateMenuHiScore() {
    const el = document.getElementById('menu-highscore');
    if (el) el.textContent = getHiScore().toLocaleString().padStart(6, '0');
  }

  // ── Marquesina ────────────────────────────────────────────────────
  function updateMarquee(text) {
    document.getElementById('game-marquee-text').textContent = text;
  }

  // ── Animación del menú (canvas de fondo animado) ──────────────────
  const menuStars = Array.from({length: 150}, () => ({
    x: Math.random() * 480, y: Math.random() * 640,
    r: 0.3 + Math.random() * 1.5,
    speed: 0.3 + Math.random() * 1.2,
    alpha: 0.3 + Math.random() * 0.7,
  }));

  function animateMenuBackground() {
    mCtx.fillStyle = '#010208';
    mCtx.fillRect(0, 0, 480, 640);
    for (const s of menuStars) {
      s.y += s.speed;
      if (s.y > 642) { s.y = 0; s.x = Math.random() * 480; }
      mCtx.globalAlpha = s.alpha;
      mCtx.fillStyle = '#ffffff';
      mCtx.beginPath();
      mCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      mCtx.fill();
    }
    mCtx.globalAlpha = 1;
  }

  // ── Cambio de pantalla ─────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
  }

  // ── Iniciar partida ────────────────────────────────────────────────
  function startGame() {
    AudioEngine.resume();
    Player.reset();
    BulletSystem.clearAll();
    EnemySystem.clearAll();
    EnemySystem.clearBoss();
    PowerupSystem.clearAll();
    particles.length   = 0;
    floatTexts.length  = 0;
    sector = 1;
    wave   = 0;
    totalEnemyKills = 0;
    totalBossKills  = 0;
    grazeTotal      = 0;
    _wavePending    = false;
    _waveDelay      = 0;
    initBackground();
    showBossHP(false);
    showScreen('game');
    gameState = STATES.PLAYING;
    updateMarquee('✦ COSMIC STARLIGHT ✦ SECTOR 1 — ALPHA FRONTIER ✦');
    AudioEngine.startMusic(false);
    // Primera oleada
    setTimeout(() => advanceWave(), 1500);
  }

  // ── Pausa ─────────────────────────────────────────────────────────
  function togglePause() {
    if (gameState === STATES.PLAYING) {
      gameState = STATES.PAUSED;
      AudioEngine.stopMusic();
      document.getElementById('pause-overlay').classList.remove('hidden');
    } else if (gameState === STATES.PAUSED) {
      gameState = STATES.PLAYING;
      AudioEngine.startMusic(EnemySystem.getBoss() !== null);
      document.getElementById('pause-overlay').classList.add('hidden');
    }
  }

  // ── Game Over ─────────────────────────────────────────────────────
  function triggerGameOver() {
    gameState = STATES.GAME_OVER;
    AudioEngine.stopMusic();
    AudioEngine.gameOver();
    BulletSystem.clearAll();

    const ps      = Player.getState();
    const score   = ps.score;
    const stageStr= `${sector}-${wave}`;
    const isNew   = saveScore(score, stageStr);
    const hiScore = getHiScore();

    document.getElementById('go-final-score').textContent = score.toLocaleString();
    document.getElementById('go-hiscore').textContent     = hiScore.toLocaleString();
    document.getElementById('go-stage').textContent       = stageStr;
    document.getElementById('go-enemies').textContent     = totalEnemyKills;
    document.getElementById('go-bosses').textContent      = totalBossKills;
    document.getElementById('go-graze').textContent       = grazeTotal;
    const newRecEl = document.getElementById('go-new-record');
    newRecEl.classList.toggle('hidden', !isNew);

    showScreen('gameover');
  }

  // ── Victoria ──────────────────────────────────────────────────────
  function triggerVictory() {
    gameState = STATES.VICTORY;
    AudioEngine.stopMusic();
    AudioEngine.allClear();
    BulletSystem.clearAll();

    const ps    = Player.getState();
    const score = ps.score;
    const isNew = saveScore(score, '3-CLEAR');
    const hiScore = getHiScore();

    document.getElementById('vic-final-score').textContent = score.toLocaleString();
    document.getElementById('vic-enemies').textContent     = totalEnemyKills;
    document.getElementById('vic-bosses').textContent      = totalBossKills;
    const newRecEl = document.getElementById('vic-new-record');
    newRecEl.classList.toggle('hidden', !isNew);
    document.getElementById('hud-hiscore').textContent     = hiScore.toLocaleString();

    showScreen('victory');
  }

  // ── Stage Clear / Siguiente sector ───────────────────────────────
  function triggerStageClear() {
    gameState = STATES.STAGE_CLEAR;
    AudioEngine.setBossMode(false);
    AudioEngine.stageClear();
    EnemySystem.clearBoss();
    EnemySystem.clearAll();
    BulletSystem.clearAll();
    PowerupSystem.clearAll();
    particles.length  = 0;
    floatTexts.length = 0;
    showBossHP(false);

    const bonus = sector * 50000;
    Player.addScore(bonus);
    addFloatText(CW / 2, CH / 2, `SECTOR CLEAR! +${bonus.toLocaleString()}`, '#ffdd00');

    // Mostrar overlay stage clear brevemente
    const el = document.getElementById('stage-clear-overlay');
    document.getElementById('stage-clear-score').textContent = `BONUS: +${bonus.toLocaleString()}`;
    el.classList.remove('hidden');

    setTimeout(() => {
      el.classList.add('hidden');
      sector++;
      wave = 0;
      _wavePending = false;

      if (sector > 3) {
        triggerVictory();
      } else {
        gameState = STATES.PLAYING;
        const marqueeTexts = {
          2: '✦ SECTOR 2 — VOID NEBULA ✦',
          3: '✦ SECTOR 3 — GUARDIAN GATE ✦',
        };
        updateMarquee(marqueeTexts[sector] || `✦ SECTOR ${sector} ✦`);
        AudioEngine.startMusic(false);
        setTimeout(() => advanceWave(), 1500);
      }
    }, 3000);
  }

  // ── Colisiones principales ────────────────────────────────────────
  function processCollisions() {
    const px = Player.getX();
    const py = Player.getY();
    const pr = Player.getHitR();
    const ps = Player.getState();
    const bPool = BulletSystem.getPool();

    // 1. Balas jugador vs enemigos menores
    const pts = EnemySystem.checkBulletCollisions(bPool, (enemy, ex, ey) => {
      spawnExplosion(ex, ey, enemy.color, 14, false);
      AudioEngine.enemyExplosion();
      PowerupSystem.drop(ex, ey, null, 0.3);
      addFloatText(ex, ey - 10, `+${enemy.pts}`, '#ffff88');
      totalEnemyKills++;
      Player.getState().enemiesKilled++;
    });
    if (pts > 0) Player.addScore(pts);

    // 2. Balas jugador vs boss
    const boss = EnemySystem.getBoss();
    if (boss && boss.alive && !boss.entering) {
      const bossKilled = EnemySystem.checkBossBulletCollisions(bPool, (bPts) => {
        if (bPts > 100) { // Boss muerto
          spawnExplosion(boss.x, boss.y, boss.phases[boss.phaseIdx].color, 30, true);
          setTimeout(() => spawnExplosion(boss.x - 20, boss.y + 20, '#ff8800', 20, true), 150);
          setTimeout(() => spawnExplosion(boss.x + 30, boss.y - 10, '#ffcc00', 20, true), 300);
          AudioEngine.bigExplosion();
          totalBossKills++;
          Player.getState().bossesKilled++;
          Player.addScore(bPts);
          addFloatText(boss.x, boss.y - 30, `+${bPts.toLocaleString()}`, '#ffcc00');
          // Avanzar de sector
          setTimeout(triggerStageClear, 1200);
        } else {
          Player.addScore(bPts);
        }
      });
    }

    // 3. Balas enemigas vs jugador (hitbox de precisión)
    if (!Player.isInvincible()) {
      for (const b of bPool) {
        if (!b.active || b.owner !== 'enemy') continue;
        const dx = px - b.x;
        const dy = py - b.y;
        if (dx * dx + dy * dy < (pr + b.r * 0.3) * (pr + b.r * 0.3)) {
          // Golpe real
          const result = Player.takeDamage();
          if (result !== 'invincible') {
            b.active = false;
            if (result === 'dead') {
              spawnExplosion(px, py, '#00aaff', 25, true);
              AudioEngine.playerHit();
              AudioEngine.lifeDown();
              setTimeout(triggerGameOver, 800);
              gameState = STATES.GAME_OVER;
            } else if (result === 'hit') {
              spawnExplosion(px, py, '#0066ff', 12, false);
              AudioEngine.playerHit();
              BulletSystem.clearEnemy();
            } else if (result === 'shield') {
              AudioEngine.playerHit();
              BulletSystem.clearEnemy();
            }
            _hudDirty = true;
          }
          break;
        }

        // Graze: bala pasa muy cerca pero no golpea
        if (!ps.isInvincible) {
          const grazeR = pr + 8;
          if (dx * dx + dy * dy < grazeR * grazeR) {
            ps.grazeCount++;
            grazeTotal++;
            Player.addScore(10);
            AudioEngine.graze();
          }
        }
      }
    }

    // 4. Cuerpo de enemigo vs jugador
    if (!Player.isInvincible()) {
      const hit = EnemySystem.checkPlayerCollision(px, py, pr + 6) ||
                  EnemySystem.checkBossPlayerCollision(px, py, pr + 6);
      if (hit) {
        const result = Player.takeDamage();
        if (result === 'dead') {
          spawnExplosion(px, py, '#00aaff', 25, true);
          AudioEngine.playerHit();
          setTimeout(triggerGameOver, 800);
          gameState = STATES.GAME_OVER;
        } else if (result !== 'invincible') {
          AudioEngine.playerHit();
          BulletSystem.clearEnemy();
        }
        _hudDirty = true;
      }
    }

    // 5. Powerups vs jugador
    const collected = PowerupSystem.checkCollect(px, py, 22);
    if (collected) {
      Player.applyPowerup(collected);
      AudioEngine.powerup();
      addFloatText(px, py - 20, collected, '#00ffee');
      _hudDirty = true;
    }
  }

  // ── Oleada inteligente (avance automático) ─────────────────────────
  let _waveAdvanceTimer = 0;

  function checkWaveAdvance() {
    if (gameState !== STATES.PLAYING) return;
    if (EnemySystem.count() > 0 || EnemySystem.getBoss()) return;

    _waveAdvanceTimer++;
    if (_waveAdvanceTimer < 120) return; // espera 2 segundos antes de nueva oleada
    _waveAdvanceTimer = 0;

    const waves = SECTOR_WAVES[sector];
    if (!waves || wave >= waves.length) return;
    advanceWave();
  }

  // ── Disparo del jugador ────────────────────────────────────────────
  function handlePlayerShoot() {
    const shotType = Player.tryShoot(shootHeld);
    if (!shotType) return;
    const ps = Player.getState();
    BulletSystem.firePlayer({
      x: ps.x, y: ps.y,
      powerLevel: ps.powerLevel,
      weapon:     shotType === 'spread' ? ps.weapon : shotType,
      focusMode:  ps.isFocus,
    });
    // SFX según arma
    if (shotType === 'laser') AudioEngine.laserBeam();
    else if (shotType === 'missile') AudioEngine.missile();
    else if (ps.powerLevel === 1) AudioEngine.shoot();
    else if (ps.powerLevel === 2) AudioEngine.shootDouble();
    else AudioEngine.shootSpread();
  }

  // ── Disparos enemigos ────────────────────────────────────────────
  function handleEnemyShots() {
    const px = Player.getX(), py = Player.getY();
    const shots = EnemySystem.getShots(px, py);
    for (const s of shots) {
      dispatchPattern(s.pattern, s.args);
      // Actualizar ángulo acumulado del enemigo (espiral/turret)
      if (s.pattern === 'spiral' && s.enemy) {
        s.enemy.spiralAngle = s.args.angle + 0.1;
      }
    }

    const bossShots = EnemySystem.getBossShots(px, py);
    for (const bs of bossShots) {
      dispatchPattern(bs.pattern, bs.args);
    }
  }

  function dispatchPattern(pattern, args) {
    switch (pattern) {
      case 'fan':       BulletSystem.fireFan(args);       break;
      case 'spiral':    BulletSystem.fireSpiral(args);    break;
      case 'ring':      BulletSystem.fireRing(args);      break;
      case 'aimed':     BulletSystem.fireAimed(args);     break;
      case 'rain':      BulletSystem.fireRain(args);      break;
      case 'butterfly': BulletSystem.fireButterfly(args); break;
    }
  }

  // ── Bomba del jugador ─────────────────────────────────────────────
  function handleBomb() {
    if (!bombPressed) return;
    bombPressed = false;
    if (Player.tryBomb()) {
      AudioEngine.bomb();
      BulletSystem.clearEnemy();
      spawnExplosion(Player.getX(), Player.getY(), '#00ffee', 40, true);
      // Daño a todos los enemigos (1 golpe)
      for (const e of EnemySystem.getEnemies()) {
        e.hp -= 2;
        if (e.hp <= 0) {
          e.alive = false;
          PowerupSystem.drop(e.x, e.y, null, 0.5);
          totalEnemyKills++;
          spawnExplosion(e.x, e.y, e.color, 10, false);
        }
      }
      // Daño al boss
      const boss = EnemySystem.getBoss();
      if (boss && boss.alive) {
        boss.hp = Math.max(0, boss.hp - Math.floor(boss.maxHp * 0.06));
      }
      _hudDirty = true;
    }
  }

  // ── FPS counter ───────────────────────────────────────────────────
  let _fpsFrames = 0;
  let _fpsTime   = performance.now();
  let _fpsValue  = 60;

  function updateFPS() {
    _fpsFrames++;
    const now = performance.now();
    if (now - _fpsTime >= 1000) {
      _fpsValue  = _fpsFrames;
      _fpsFrames = 0;
      _fpsTime   = now;
      fpsCounter.textContent = _fpsValue + ' FPS';
    }
  }

  // ── Game Loop principal ───────────────────────────────────────────
  let hiScore = getHiScore();

  function gameLoop() {
    requestAnimationFrame(gameLoop);
    updateFPS();

    // Siempre animar menú de fondo si está en esa pantalla
    if (gameState === STATES.MENU) {
      animateMenuBackground();
      return;
    }

    if (gameState === STATES.PAUSED || gameState === STATES.STAGE_CLEAR ||
        gameState === STATES.BOSS_WARNING) {
      // Renderizar estático
      renderBackground();
      BulletSystem.render(ctx);
      EnemySystem.render(ctx);
      EnemySystem.renderBoss(ctx);
      Player.render(ctx);
      PowerupSystem.render(ctx);
      renderParticles();
      renderFloatTexts();
      return;
    }

    if (gameState !== STATES.PLAYING) return;

    // ── LÓGICA ─────────────────────────────────────────────
    Player.move(keys, CW, CH);
    Player.update(keys);
    handlePlayerShoot();
    handleBomb();

    EnemySystem.update(Player.getX(), Player.getY(), CW, CH);
    EnemySystem.updateBoss(Player.getX(), Player.getY(), CW);
    BulletSystem.update(CW, CH);
    PowerupSystem.update();
    updateParticles();
    updateFloatTexts();
    updateBackground();
    processCollisions();
    checkWaveAdvance();

    // ── HUD ─────────────────────────────────────────────────
    hiScore = Math.max(hiScore, Player.getScore());
    updateHUD(hiScore);
    document.getElementById('hud-hiscore').textContent = hiScore.toLocaleString();

    // ── RENDERIZADO ──────────────────────────────────────────
    renderBackground();
    BulletSystem.render(ctx);
    EnemySystem.render(ctx);
    EnemySystem.renderBoss(ctx);
    PowerupSystem.render(ctx);
    Player.render(ctx);
    renderParticles();
    renderFloatTexts();

    // Flash de pantalla por bomba
    if (Player.isBombing()) {
      const ps = Player.getState();
      const alpha = (ps.bombTimer / 90) * 0.35;
      ctx.fillStyle = `rgba(180,255,255,${alpha})`;
      ctx.fillRect(0, 0, CW, CH);
    }
  }

  // ── Botones UI ────────────────────────────────────────────────────
  function initButtons() {
    // MENU
    document.getElementById('btn-start').addEventListener('click', () => {
      AudioEngine.init();
      startGame();
    });

    document.getElementById('btn-scores').addEventListener('click', () => {
      renderScoresTable();
      showScreen('scores');
    });

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      const on = AudioEngine.toggle();
      document.getElementById('btn-sound-toggle').textContent = on ? '🔊 SOUND ON' : '🔇 SOUND OFF';
    });

    // SCORES
    document.getElementById('btn-scores-back').addEventListener('click', () => {
      showScreen('menu');
    });

    // PAUSE overlay
    document.getElementById('btn-resume').addEventListener('click', togglePause);
    document.getElementById('btn-menu-from-pause').addEventListener('click', () => {
      gameState = STATES.MENU;
      AudioEngine.stopMusic();
      document.getElementById('pause-overlay').classList.add('hidden');
      showScreen('menu');
      updateMenuHiScore();
    });

    // GAME OVER
    document.getElementById('btn-retry').addEventListener('click', () => startGame());
    document.getElementById('btn-menu-from-go').addEventListener('click', () => {
      showScreen('menu');
      updateMenuHiScore();
    });

    // VICTORY
    document.getElementById('btn-play-again').addEventListener('click', () => startGame());
    document.getElementById('btn-menu-from-vic').addEventListener('click', () => {
      showScreen('menu');
      updateMenuHiScore();
    });
  }

  // ── Inicialización ────────────────────────────────────────────────
  function init() {
    initButtons();
    initBackground();
    updateMenuHiScore();
    showScreen('menu');
    gameState = STATES.MENU;
    AudioEngine.init();
    requestAnimationFrame(gameLoop);
  }

  // Arrancar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
