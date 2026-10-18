/**
 * player.js — Nave del Jugador: Starlight Alpha
 * Cosmic Starlight Shmup
 *
 * Gestiona:
 * - Movimiento y colisiones con límites del canvas
 * - Hitbox de precisión de 3px (visible en Focus Mode)
 * - Sistema de vidas (max 5), bombas (max 3), invulnerabilidad temporal
 * - Sistema de poder de disparo (niveles 1-3)
 * - Armas especiales: láser continuo, misiles
 * - Escudo de 3 golpes
 * - Efecto de partículas trail
 */

'use strict';

const Player = (() => {

  // ── Estado del jugador ────────────────────────────────────────────
  const state = {
    x: 240, y: 540,
    w: 30, h: 36,         // tamaño visual
    hitR: 3,              // radio hitbox de colisión
    speed: 4.5,
    focusSpeed: 2.2,

    lives:    3,
    maxLives: 5,
    bombs:    3,
    maxBombs: 3,
    score:    0,

    powerLevel: 1,        // 1|2|3
    weapon:     'spread', // 'spread'|'laser'|'missile'
    weaponTimer: 0,       // ticks restantes del arma especial

    shield:     0,        // golpes que absorbe el escudo (max 3)
    shieldMax:  3,

    isFocus:       false,
    isInvincible:  false,
    invTimer:      0,
    invDuration:   150,   // ~2.5 s a 60fps

    // Disparo
    shootCooldown:   0,
    shootRate:       8,   // disparar cada N ticks
    laserCooldown:   0,
    laserRate:       3,
    missileCooldown: 0,
    missileRate:     20,

    isBombing: false,
    bombTimer: 0,

    // Trail de partículas
    trail: [],

    // Estadísticas
    grazeCount:      0,
    enemiesKilled:   0,
    bossesKilled:    0,
  };

  // ── Inicializar / resetear ─────────────────────────────────────────
  function reset() {
    state.x          = 240;
    state.y          = 540;
    state.lives      = 3;
    state.bombs      = 3;
    state.score      = 0;
    state.powerLevel = 1;
    state.weapon     = 'spread';
    state.weaponTimer= 0;
    state.shield     = 0;
    state.isInvincible = false;
    state.invTimer   = 0;
    state.isBombing  = false;
    state.bombTimer  = 0;
    state.isFocus    = false;
    state.shootCooldown  = 0;
    state.laserCooldown  = 0;
    state.missileCooldown= 0;
    state.grazeCount     = 0;
    state.enemiesKilled  = 0;
    state.bossesKilled   = 0;
    state.trail.length   = 0;
  }

  // ── Mover según input ─────────────────────────────────────────────
  function move(keys, canvasW, canvasH) {
    const spd = state.isFocus ? state.focusSpeed : state.speed;
    const hw  = state.w / 2;
    const hh  = state.h / 2;

    if (keys['ArrowLeft']  || keys['a'] || keys['A']) state.x -= spd;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) state.x += spd;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) state.y -= spd;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) state.y += spd;

    // Clamp dentro del canvas
    state.x = Math.max(hw, Math.min(canvasW - hw, state.x));
    state.y = Math.max(hh, Math.min(canvasH - hh, state.y));
  }

  // ── Actualizar cooldowns y efectos ─────────────────────────────────
  function update(keys) {
    state.isFocus = !!(keys['Shift'] || keys['shift']);

    // Timers
    if (state.shootCooldown   > 0) state.shootCooldown--;
    if (state.laserCooldown   > 0) state.laserCooldown--;
    if (state.missileCooldown > 0) state.missileCooldown--;
    if (state.weaponTimer     > 0) {
      state.weaponTimer--;
      if (state.weaponTimer === 0) state.weapon = 'spread';
    }
    if (state.invTimer > 0) {
      state.invTimer--;
      if (state.invTimer === 0) state.isInvincible = false;
    }
    if (state.bombTimer > 0) {
      state.bombTimer--;
      if (state.bombTimer === 0) state.isBombing = false;
    }

    // Trail
    state.trail.push({ x: state.x, y: state.y + state.h / 2, life: 18 });
    for (let i = state.trail.length - 1; i >= 0; i--) {
      state.trail[i].life--;
      if (state.trail[i].life <= 0) state.trail.splice(i, 1);
    }
  }

  // ── Disparar ──────────────────────────────────────────────────────
  /**
   * Intenta disparar; devuelve el tipo de disparo que se realizó o null.
   * La lógica de instanciar balas está en app.js para centralizar.
   */
  function tryShoot(shooting) {
    if (!shooting) return null;

    if (state.weapon === 'laser') {
      if (state.laserCooldown > 0) return null;
      state.laserCooldown = state.laserRate;
      return 'laser';
    }
    if (state.weapon === 'missile') {
      if (state.missileCooldown > 0) return null;
      state.missileCooldown = state.missileRate;
      return 'missile';
    }

    // Spread normal
    if (state.shootCooldown > 0) return null;
    state.shootCooldown = state.isFocus
      ? Math.max(4, state.shootRate - 2)
      : state.shootRate;
    return 'spread';
  }

  // ── Usar bomba ─────────────────────────────────────────────────────
  function tryBomb() {
    if (state.bombs <= 0 || state.isBombing) return false;
    state.bombs--;
    state.isBombing  = true;
    state.bombTimer  = 90;   // duración efecto bomba
    state.isInvincible = true;
    state.invTimer   = 120;
    return true;
  }

  // ── Recibir daño ───────────────────────────────────────────────────
  /**
   * Procesa impacto de bala enemiga sobre la hitbox del jugador.
   * @returns {string} 'shield'|'hit'|'invincible'|'dead'
   */
  function takeDamage() {
    if (state.isInvincible || state.isBombing) return 'invincible';
    if (state.shield > 0) {
      state.shield--;
      state.isInvincible = true;
      state.invTimer     = 60;
      return 'shield';
    }
    state.lives--;
    state.isInvincible = true;
    state.invTimer     = state.invDuration;

    // Perder poder y arma al morir
    state.powerLevel = Math.max(1, state.powerLevel - 1);
    state.weapon     = 'spread';
    state.weaponTimer= 0;

    if (state.lives <= 0) return 'dead';
    return 'hit';
  }

  // ── Recoger powerup ────────────────────────────────────────────────
  function applyPowerup(type) {
    switch (type) {
      case 'POWER':
        state.powerLevel = Math.min(3, state.powerLevel + 1);
        break;
      case 'LASER':
        state.weapon     = 'laser';
        state.weaponTimer= 360; // 6 s a 60fps
        break;
      case 'MISSILE':
        state.weapon     = 'missile';
        state.weaponTimer= 420; // 7 s
        break;
      case 'SHIELD':
        state.shield = Math.min(state.shieldMax, state.shield + state.shieldMax);
        break;
      case 'BOMB':
        state.bombs = Math.min(state.maxBombs, state.bombs + 1);
        break;
      case 'LIFE':
        state.lives = Math.min(state.maxLives, state.lives + 1);
        break;
    }
  }

  // ── Renderizar nave ────────────────────────────────────────────────
  function render(ctx) {
    _drawTrail(ctx);
    _drawShield(ctx);
    _drawShip(ctx);
    if (state.isFocus) _drawHitbox(ctx);
    if (state.isBombing) _drawBombEffect(ctx);
  }

  function _drawTrail(ctx) {
    ctx.save();
    for (const t of state.trail) {
      const alpha = t.life / 18;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = state.isFocus ? '#80ffee' : '#00aaff';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 4 * alpha, 8 * alpha, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function _drawShield(ctx) {
    if (state.shield <= 0) return;
    ctx.save();
    const alpha = 0.25 + 0.15 * Math.sin(Date.now() * 0.01);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#00ff88';
    ctx.shadowBlur  = 18;
    ctx.shadowColor = '#00ff88';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(state.x, state.y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function _drawShip(ctx) {
    // Parpadeo de invulnerabilidad
    if (state.isInvincible && !state.isBombing && Math.floor(state.invTimer / 4) % 2 === 0) return;

    ctx.save();
    ctx.translate(state.x, state.y);

    const hw = state.w / 2;
    const hh = state.h / 2;

    // Resplandor base
    ctx.shadowBlur  = 20;
    ctx.shadowColor = state.isFocus ? '#80ffee' : '#00aaff';

    // Cuerpo de la nave (forma de nave espacial)
    // Fuselaje central
    ctx.fillStyle = state.isFocus ? '#c0ffee' : '#60ccff';
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(hw * 0.4, -hh * 0.1);
    ctx.lineTo(hw * 0.5, hh * 0.6);
    ctx.lineTo(0, hh * 0.3);
    ctx.lineTo(-hw * 0.5, hh * 0.6);
    ctx.lineTo(-hw * 0.4, -hh * 0.1);
    ctx.closePath();
    ctx.fill();

    // Alas
    ctx.fillStyle = '#0088cc';
    // Ala derecha
    ctx.beginPath();
    ctx.moveTo(hw * 0.3, hh * 0.1);
    ctx.lineTo(hw, hh * 0.7);
    ctx.lineTo(hw * 0.5, hh * 0.9);
    ctx.lineTo(hw * 0.4, hh * 0.4);
    ctx.closePath();
    ctx.fill();
    // Ala izquierda
    ctx.beginPath();
    ctx.moveTo(-hw * 0.3, hh * 0.1);
    ctx.lineTo(-hw, hh * 0.7);
    ctx.lineTo(-hw * 0.5, hh * 0.9);
    ctx.lineTo(-hw * 0.4, hh * 0.4);
    ctx.closePath();
    ctx.fill();

    // Cabina (cúpula)
    ctx.fillStyle = state.isFocus ? '#eeffff' : '#aaddff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -hh * 0.2, hw * 0.18, hh * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Motor: llama de empuje
    const flameLen = 18 + Math.random() * 8;
    const grad = ctx.createLinearGradient(0, hh * 0.3, 0, hh * 0.3 + flameLen);
    grad.addColorStop(0, '#00ffee');
    grad.addColorStop(0.5, '#0066ff');
    grad.addColorStop(1, 'rgba(0,0,255,0)');
    ctx.fillStyle = grad;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00ffee';
    ctx.beginPath();
    ctx.ellipse(0, hh * 0.3 + flameLen / 2, 5, flameLen / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function _drawHitbox(ctx) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#ffffff';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(state.x, state.y, state.hitR, 0, Math.PI * 2);
    ctx.stroke();
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(state.x - 6, state.y);
    ctx.lineTo(state.x + 6, state.y);
    ctx.moveTo(state.x, state.y - 6);
    ctx.lineTo(state.x, state.y + 6);
    ctx.stroke();
    ctx.restore();
  }

  function _drawBombEffect(ctx) {
    const progress = 1 - state.bombTimer / 90;
    const radius   = progress * 280;
    const alpha    = 1 - progress;

    ctx.save();
    ctx.globalAlpha = alpha * 0.4;
    const grad = ctx.createRadialGradient(state.x, state.y, 0, state.x, state.y, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#00ffee');
    grad.addColorStop(1, 'rgba(0,100,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(state.x, state.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Getters ───────────────────────────────────────────────────────
  function getState()    { return state; }
  function getX()        { return state.x; }
  function getY()        { return state.y; }
  function getHitR()     { return state.hitR; }
  function getLives()    { return state.lives; }
  function getBombs()    { return state.bombs; }
  function getScore()    { return state.score; }
  function addScore(pts) { state.score += pts; }
  function getPower()    { return state.powerLevel; }
  function getWeapon()   { return state.weapon; }
  function getShield()   { return state.shield; }
  function isFocus()     { return state.isFocus; }
  function isBombing()   { return state.isBombing; }
  function isInvincible(){ return state.isInvincible; }

  // ── API pública ───────────────────────────────────────────────────
  return {
    reset,
    move,
    update,
    tryShoot,
    tryBomb,
    takeDamage,
    applyPowerup,
    render,
    getState,
    getX, getY, getHitR,
    getLives, getBombs, getScore, addScore,
    getPower, getWeapon, getShield,
    isFocus, isBombing, isInvincible,
  };

})();
