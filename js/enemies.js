/**
 * enemies.js — Enemigos y Jefes
 * Cosmic Starlight Shmup
 *
 * 5 tipos de enemigos menores:
 *  - INTERCEPTOR  : Vuelo recto hacia abajo, dispara abanico
 *  - BOMBER       : Vuelo en zigzag, dispara anillos
 *  - KAMIKAZE     : Se lanza hacia el jugador
 *  - FORMATION_V  : Vuelan en V, disparo coordinado
 *  - TURRET       : Estacionario, gira y dispara espirales
 *
 * 3 Jefes con múltiples fases:
 *  - BOSS_1 (Sector Alpha)  : 2 fases — abanico + espiral
 *  - BOSS_2 (Sector Beta)   : 3 fases — lluvia + dirigidos + anillo
 *  - BOSS_3 (Guardian Final): 4 fases — todos los patrones + mini-boss
 */

'use strict';

const EnemySystem = (() => {

  // ── Pool de enemigos activos ──────────────────────────────────────
  const _enemies = [];

  // ── Colores y estilos por tipo ────────────────────────────────────
  const ENEMY_DEFS = {
    INTERCEPTOR: { color: '#cc3399', glow: '#993366', hp: 2,  pts: 100, r: 14, w: 28, h: 28 },
    BOMBER:      { color: '#ff6600', glow: '#993300', hp: 4,  pts: 200, r: 18, w: 34, h: 30 },
    KAMIKAZE:    { color: '#ff0033', glow: '#880022', hp: 1,  pts: 80,  r: 10, w: 20, h: 20 },
    FORMATION_V: { color: '#9933ff', glow: '#661199', hp: 2,  pts: 120, r: 13, w: 26, h: 24 },
    TURRET:      { color: '#ff9900', glow: '#996600', hp: 6,  pts: 300, r: 20, w: 38, h: 34 },
  };

  // ── Crear un enemigo ───────────────────────────────────────────────
  function spawn({ type, x, y, vx = 0, vy = 1.5, formationRole = 0 }) {
    const def = ENEMY_DEFS[type];
    if (!def) { console.warn('Tipo de enemigo desconocido:', type); return null; }
    const e = {
      type, x, y, vx, vy,
      hp: def.hp, maxHp: def.hp,
      pts: def.pts,
      r: def.r, w: def.w, h: def.h,
      color: def.color, glow: def.glow,
      shootTimer: Math.floor(Math.random() * 60),
      shootRate:  _getShootRate(type),
      spiralAngle: 0,
      butterflyAngle: 0,
      zigTimer: 0,
      formationRole,
      alive: true,
      flashTimer: 0,
      age: 0,
    };
    _enemies.push(e);
    return e;
  }

  function _getShootRate(type) {
    return { INTERCEPTOR: 80, BOMBER: 100, KAMIKAZE: 999, FORMATION_V: 90, TURRET: 50 }[type] || 80;
  }

  /** Limpia todos los enemigos */
  function clearAll() { _enemies.length = 0; }

  // ── Actualizar enemigos ────────────────────────────────────────────
  function update(playerX, playerY, canvasW, canvasH) {
    for (let i = _enemies.length - 1; i >= 0; i--) {
      const e = _enemies[i];
      if (!e.alive) { _enemies.splice(i, 1); continue; }

      e.age++;
      if (e.flashTimer > 0) e.flashTimer--;

      // Movimiento según tipo
      switch (e.type) {
        case 'INTERCEPTOR':
          e.x += e.vx;
          e.y += e.vy;
          e.vx += Math.sin(e.age * 0.04) * 0.03; // suave oscilación
          break;
        case 'BOMBER':
          e.x += e.vx;
          e.y += e.vy;
          e.zigTimer++;
          if (e.zigTimer > 40) { e.vx = -e.vx; e.zigTimer = 0; }
          break;
        case 'KAMIKAZE': {
          const dx = playerX - e.x;
          const dy = playerY - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const spd  = 5.5;
          e.vx += (dx / dist * spd - e.vx) * 0.06;
          e.vy += (dy / dist * spd - e.vy) * 0.06;
          e.x  += e.vx;
          e.y  += e.vy;
          break;
        }
        case 'FORMATION_V':
          e.x += e.vx;
          e.y += e.vy;
          e.vy = Math.max(0.5, e.vy - 0.003); // deceleran a mitad de pantalla
          break;
        case 'TURRET':
          // Se mueve poco, oscila horizontalmente
          e.x += Math.sin(e.age * 0.02) * 0.8;
          e.y += e.vy * 0.4;
          if (e.y > 120) e.vy = 0;
          break;
      }

      // Eliminar si salen del canvas
      if (e.x < -60 || e.x > canvasW + 60 || e.y > canvasH + 60) {
        _enemies.splice(i, 1);
      }
    }
  }

  /**
   * Actualiza timers de disparo y devuelve lista de disparos a generar.
   * @returns {Array} Lista de objetos { enemy, pattern, args }
   */
  function getShots(playerX, playerY) {
    const shots = [];
    for (const e of _enemies) {
      if (!e.alive) continue;
      e.shootTimer++;
      if (e.shootTimer < e.shootRate) continue;
      e.shootTimer = 0;

      switch (e.type) {
        case 'INTERCEPTOR':
          shots.push({ enemy: e, pattern: 'fan', args: {
            x: e.x, y: e.y + e.h / 2,
            count: 3, spread: 0.4, speed: 3,
            color: '#ff3399',
          }});
          break;
        case 'BOMBER':
          shots.push({ enemy: e, pattern: 'ring', args: {
            x: e.x, y: e.y + e.h / 2,
            count: 10, speed: 2.5,
            color: '#ff6600',
          }});
          break;
        case 'FORMATION_V':
          shots.push({ enemy: e, pattern: 'aimed', args: {
            x: e.x, y: e.y + e.h / 2,
            px: playerX, py: playerY,
            count: 2, spread: 0.1, speed: 3.5,
            color: '#cc66ff',
          }});
          break;
        case 'TURRET':
          e.spiralAngle = shots.push({ enemy: e, pattern: 'spiral', args: {
            x: e.x, y: e.y + e.h / 2,
            angle: e.spiralAngle,
            armCount: 4, speed: 3,
            color: '#ffaa00',
          }}) && e.spiralAngle + 0.1;
          break;
      }
    }
    return shots;
  }

  // ── Renderizar enemigos ────────────────────────────────────────────
  function render(ctx) {
    for (const e of _enemies) {
      if (!e.alive) continue;
      _drawEnemy(ctx, e);
    }
  }

  function _drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);

    const flash = e.flashTimer > 0;
    ctx.shadowBlur  = flash ? 25 : 12;
    ctx.shadowColor = flash ? '#ffffff' : e.glow;

    if (flash) ctx.globalAlpha = 0.75 + Math.random() * 0.25;

    switch (e.type) {
      case 'INTERCEPTOR': _drawInterceptor(ctx, e); break;
      case 'BOMBER':      _drawBomber(ctx, e);      break;
      case 'KAMIKAZE':    _drawKamikaze(ctx, e);    break;
      case 'FORMATION_V': _drawFormationV(ctx, e);  break;
      case 'TURRET':      _drawTurret(ctx, e);      break;
    }

    // Barra de HP
    if (e.maxHp > 1) _drawHP(ctx, e);

    ctx.restore();
  }

  function _drawInterceptor(ctx, e) {
    const hw = e.w / 2, hh = e.h / 2;
    ctx.fillStyle = e.color;
    // Cuerpo
    ctx.beginPath();
    ctx.moveTo(0, hh);
    ctx.lineTo(hw * 0.5, -hh * 0.5);
    ctx.lineTo(0, -hh * 0.1);
    ctx.lineTo(-hw * 0.5, -hh * 0.5);
    ctx.closePath();
    ctx.fill();
    // Alas
    ctx.fillStyle = '#661133';
    ctx.beginPath();
    ctx.moveTo(hw * 0.3, 0);
    ctx.lineTo(hw, hh * 0.6);
    ctx.lineTo(hw * 0.4, hh * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-hw * 0.3, 0);
    ctx.lineTo(-hw, hh * 0.6);
    ctx.lineTo(-hw * 0.4, hh * 0.5);
    ctx.closePath();
    ctx.fill();
    // Motor
    ctx.fillStyle = '#ffaacc';
    ctx.beginPath();
    ctx.ellipse(0, -hh * 0.15, hw * 0.12, hh * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function _drawBomber(ctx, e) {
    const hw = e.w / 2, hh = e.h / 2;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, hh * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#883300';
    ctx.beginPath();
    ctx.ellipse(0, hh * 0.2, hw * 0.9, hh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cañones
    ctx.fillStyle = '#ff9944';
    ctx.fillRect(-hw * 0.8, -hh * 0.3, 8, 14);
    ctx.fillRect( hw * 0.6, -hh * 0.3, 8, 14);
    ctx.fillStyle = '#ffeecc';
    ctx.beginPath();
    ctx.ellipse(0, 0, hw * 0.25, hh * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function _drawKamikaze(ctx, e) {
    const angle = Math.atan2(e.vy, e.vx) + Math.PI / 2;
    ctx.rotate(angle);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, -e.r);
    ctx.lineTo(e.r * 0.8, e.r * 0.8);
    ctx.lineTo(-e.r * 0.8, e.r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  function _drawFormationV(ctx, e) {
    const hw = e.w / 2, hh = e.h / 2;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, hh * 0.8);
    ctx.lineTo(hw, -hh * 0.3);
    ctx.lineTo(0, -hh * 0.1);
    ctx.lineTo(-hw, -hh * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cc99ff';
    ctx.beginPath();
    ctx.arc(0, hh * 0.2, hw * 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Orbes de armas
    ctx.fillStyle = '#9933ff';
    ctx.beginPath();
    ctx.arc(-hw * 0.6, 0, 5, 0, Math.PI * 2);
    ctx.arc( hw * 0.6, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function _drawTurret(ctx, e) {
    const hw = e.w / 2;
    // Base
    ctx.fillStyle = '#664400';
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, hw * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cuerpo
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0, 0, hw * 0.65, 0, Math.PI * 2);
    ctx.fill();
    // Cañón giratorio
    const angle = e.age * 0.025;
    ctx.strokeStyle = '#ffcc66';
    ctx.lineWidth   = 5;
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * hw, Math.sin(angle) * hw);
    ctx.stroke();
    // Centro
    ctx.fillStyle = '#ffeecc';
    ctx.beginPath();
    ctx.arc(0, 0, hw * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function _drawHP(ctx, e) {
    const pct = e.hp / e.maxHp;
    const bw  = e.w * 1.1;
    const bh  = 4;
    const bx  = -bw / 2;
    const by  = -e.h / 2 - 8;

    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffaa00' : '#ff3333';
    ctx.fillRect(bx, by, bw * pct, bh);
  }

  // ── Detectar colisión proyectil-enemigo ────────────────────────────
  /**
   * Revisa colisiones entre proyectiles del jugador y enemigos.
   * @param {Array} bullets - Pool de proyectiles
   * @param {Function} onKill - callback(enemy, x, y)
   * @returns {number} Puntos totales ganados en este frame
   */
  function checkBulletCollisions(bullets, onKill) {
    let pts = 0;
    for (const e of _enemies) {
      if (!e.alive) continue;
      for (const b of bullets) {
        if (!b.active || b.owner !== 'player') continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
          // Impacto
          b.active = false;
          e.hp -= b.damage;
          e.flashTimer = 6;
          if (e.hp <= 0) {
            e.alive = false;
            pts += e.pts;
            if (onKill) onKill(e, e.x, e.y);
          }
        }
      }
    }
    return pts;
  }

  /**
   * Revisa si el jugador (hitbox circular) toca algún enemigo o sus balas.
   * @returns {boolean} true si hubo colisión física con cuerpo de enemigo
   */
  function checkPlayerCollision(px, py, pr) {
    for (const e of _enemies) {
      if (!e.alive) continue;
      const dx = px - e.x;
      const dy = py - e.y;
      if (dx * dx + dy * dy < (pr + e.r) * (pr + e.r)) return true;
    }
    return false;
  }

  // Getters
  function getEnemies() { return _enemies; }
  function count()      { return _enemies.length; }

  // ── JEFES ─────────────────────────────────────────────────────────
  /**
   * Objeto boss independiente (solo uno activo a la vez).
   * Gestionado por app.js externamente para mayor control.
   */
  const BOSS_DEFS = {
    BOSS_1: {
      name: 'NEMESIS MK-I',
      hp: 400,
      phases: [
        { hpPct: 1.0,  label: 'PHASE 1 — ALPHA ARRAY',    color: '#ff0088', shootRate: 70  },
        { hpPct: 0.45, label: 'PHASE 2 — SPIRAL STORM',   color: '#ff44cc', shootRate: 45  },
      ],
      width: 80, height: 70,
      pts: 5000,
    },
    BOSS_2: {
      name: 'VOID DREADNOUGHT',
      hp: 700,
      phases: [
        { hpPct: 1.0,  label: 'PHASE 1 — RAIN OF TERROR', color: '#ff6600', shootRate: 60 },
        { hpPct: 0.60, label: 'PHASE 2 — AIMED BARRAGE',  color: '#ff9900', shootRate: 40 },
        { hpPct: 0.25, label: 'PHASE 3 — RING OF FIRE',   color: '#ffcc00', shootRate: 30 },
      ],
      width: 100, height: 90,
      pts: 10000,
    },
    BOSS_3: {
      name: 'GUARDIAN PRIME Ω',
      hp: 1200,
      phases: [
        { hpPct: 1.0,  label: 'PHASE 1 — OMNIDIRECTIONAL', color: '#cc00ff', shootRate: 55 },
        { hpPct: 0.70, label: 'PHASE 2 — BUTTERFLY CHAOS', color: '#aa33ff', shootRate: 40 },
        { hpPct: 0.40, label: 'PHASE 3 — ABSOLUTE DOMAIN', color: '#8800cc', shootRate: 28 },
        { hpPct: 0.15, label: 'PHASE 4 — SINGULARITY',     color: '#ff00ff', shootRate: 18 },
      ],
      width: 130, height: 120,
      pts: 20000,
    },
  };

  let _boss = null;

  function spawnBoss(bossKey, canvasW) {
    const def = BOSS_DEFS[bossKey];
    if (!def) return null;
    _boss = {
      key:        bossKey,
      name:       def.name,
      x:          canvasW / 2,
      y:          -def.height,
      targetY:    100,
      vx:         0,
      vy:         2,
      hp:         def.hp,
      maxHp:      def.hp,
      phases:     def.phases,
      phaseIdx:   0,
      w:          def.width,
      h:          def.height,
      pts:        def.pts,
      shootTimer: 0,
      spiralAngle:    0,
      butterflyAngle: 0,
      rainTimer:  0,
      moveAngle:  0,
      alive:      true,
      flashTimer: 0,
      age:        0,
      entering:   true,
    };
    return _boss;
  }

  function updateBoss(playerX, playerY, canvasW) {
    if (!_boss || !_boss.alive) return;
    const b = _boss;
    b.age++;
    if (b.flashTimer > 0) b.flashTimer--;

    // Entrada: bajar hasta targetY
    if (b.entering) {
      b.y += b.vy;
      if (b.y >= b.targetY) { b.y = b.targetY; b.entering = false; }
      return;
    }

    // Movimiento del jefe: oscilación sinusoidal
    b.moveAngle += 0.012;
    b.x = canvasW / 2 + Math.sin(b.moveAngle) * (canvasW * 0.35);
    b.x = Math.max(b.w / 2, Math.min(canvasW - b.w / 2, b.x));

    // Fases según HP
    const pct = b.hp / b.maxHp;
    let newPhase = 0;
    for (let i = b.phases.length - 1; i >= 0; i--) {
      if (pct <= b.phases[i].hpPct) { newPhase = i; break; }
    }
    b.phaseIdx = newPhase;
  }

  /**
   * Obtiene disparos del jefe para este frame.
   * @returns {Array} lista de { pattern, args }
   */
  function getBossShots(playerX, playerY) {
    if (!_boss || !_boss.alive || _boss.entering) return [];
    const b = _boss;
    b.shootTimer++;
    const phase = b.phases[b.phaseIdx];
    if (b.shootTimer < phase.shootRate) return [];
    b.shootTimer = 0;

    const shots = [];
    const x = b.x, y = b.y + b.h / 2;
    const c = phase.color;

    switch (b.key) {
      case 'BOSS_1':
        if (b.phaseIdx === 0) {
          shots.push({ pattern: 'fan', args: { x, y, count: 7, spread: Math.PI / 2, speed: 3, color: c }});
          shots.push({ pattern: 'fan', args: { x, y, baseAngle: Math.PI, count: 3, spread: 0.3, speed: 2.5, color: c }});
        } else {
          b.spiralAngle = _nextAngle(b.spiralAngle);
          shots.push({ pattern: 'spiral', args: { x, y, angle: b.spiralAngle, armCount: 5, speed: 3.5, color: c }});
        }
        break;

      case 'BOSS_2':
        if (b.phaseIdx === 0) {
          shots.push({ pattern: 'rain', args: { x: null, y: -10, canvasW: 480, count: 12, speedMin: 2.5, speedMax: 5, color: c }});
        } else if (b.phaseIdx === 1) {
          shots.push({ pattern: 'aimed', args: { x, y, px: playerX, py: playerY, count: 4, spread: 0.2, speed: 4.5, color: c }});
          shots.push({ pattern: 'fan', args: { x, y, count: 3, spread: 0.5, speed: 3, color: c }});
        } else {
          shots.push({ pattern: 'ring', args: { x, y, count: 20, speed: 3.5, color: c }});
          shots.push({ pattern: 'aimed', args: { x, y, px: playerX, py: playerY, count: 2, spread: 0.05, speed: 5, color: c }});
        }
        break;

      case 'BOSS_3':
        if (b.phaseIdx === 0) {
          shots.push({ pattern: 'ring',   args: { x, y, count: 12, speed: 3, color: c }});
          shots.push({ pattern: 'aimed',  args: { x, y, px: playerX, py: playerY, count: 3, spread: 0.15, speed: 4, color: c }});
        } else if (b.phaseIdx === 1) {
          b.butterflyAngle = _nextBAngle(b.butterflyAngle);
          shots.push({ pattern: 'butterfly', args: { x, y, angle: b.butterflyAngle, speed: 3.5, color: c }});
        } else if (b.phaseIdx === 2) {
          shots.push({ pattern: 'ring',    args: { x, y, count: 24, speed: 4, color: c, angleOffset: b.spiralAngle }});
          b.spiralAngle += 0.05;
          shots.push({ pattern: 'spiral',  args: { x, y, angle: b.spiralAngle, armCount: 6, speed: 3.5, color: c }});
        } else { // fase 4 — todas a la vez
          b.spiralAngle = _nextAngle(b.spiralAngle);
          b.butterflyAngle = _nextBAngle(b.butterflyAngle);
          shots.push({ pattern: 'spiral',    args: { x, y, angle: b.spiralAngle, armCount: 8, speed: 4, color: c }});
          shots.push({ pattern: 'butterfly', args: { x, y, angle: b.butterflyAngle, speed: 3.5, color: c }});
          shots.push({ pattern: 'aimed',     args: { x, y, px: playerX, py: playerY, count: 3, spread: 0.1, speed: 5, color: '#ff00ff' }});
        }
        break;
    }
    return shots;
  }

  function _nextAngle(a) { return a + 0.08; }
  function _nextBAngle(a) { return a + 0.12; }

  function renderBoss(ctx) {
    if (!_boss || !_boss.alive) return;
    const b = _boss;
    ctx.save();
    ctx.translate(b.x, b.y);

    const flash = b.flashTimer > 0;
    ctx.shadowBlur  = flash ? 35 : 20;
    ctx.shadowColor = flash ? '#ffffff' : b.phases[b.phaseIdx].color;
    if (flash) ctx.globalAlpha = 0.8 + Math.random() * 0.2;

    _drawBossShape(ctx, b);

    ctx.restore();
  }

  function _drawBossShape(ctx, b) {
    const hw = b.w / 2, hh = b.h / 2;
    const phase = b.phases[b.phaseIdx];
    const c     = phase.color;

    switch (b.key) {
      case 'BOSS_1': {
        // Nave mediana con alas múltiples
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, hh);
        ctx.lineTo(hw * 0.6, 0);
        ctx.lineTo(hw, -hh * 0.4);
        ctx.lineTo(hw * 0.5, -hh);
        ctx.lineTo(0, -hh * 0.6);
        ctx.lineTo(-hw * 0.5, -hh);
        ctx.lineTo(-hw, -hh * 0.4);
        ctx.lineTo(-hw * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#660033';
        ctx.beginPath();
        ctx.ellipse(0, -hh * 0.1, hw * 0.2, hh * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Cañones laterales
        ctx.fillStyle = c;
        [-hw * 0.7, hw * 0.7 - 8].forEach(bx => {
          ctx.fillRect(bx, -hh * 0.2, 8, hh * 0.7);
        });
        break;
      }
      case 'BOSS_2': {
        // Dreadnought oscuro masivo
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, 0, hw, hh * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#441100';
        ctx.beginPath();
        ctx.ellipse(0, hh * 0.15, hw * 0.7, hh * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        // Brazos articulados
        const armAngle = b.age * 0.03;
        for (let arm = 0; arm < 3; arm++) {
          const a = armAngle + (Math.PI * 2 / 3) * arm;
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = c;
          ctx.fillRect(hw * 0.5, -5, hw * 0.6, 10);
          ctx.fillStyle = '#ffcc00';
          ctx.beginPath();
          ctx.arc(hw * 1.1, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = c;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, hw * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'BOSS_3': {
        // Guardian Final: masivo, simétrico, alienígena
        const pulse = 1 + 0.04 * Math.sin(b.age * 0.08);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = c;
        // Cuerpo principal octagonal
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
          const r = i % 2 === 0 ? hw : hw * 0.75;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else         ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();

        // Núcleo central
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur  = 25;
        ctx.shadowColor = c;
        ctx.beginPath();
        ctx.arc(0, 0, hw * 0.22, 0, Math.PI * 2);
        ctx.fill();

        // Anillos de energía
        for (let ring = 0; ring < 3; ring++) {
          const ringR = hw * (0.35 + ring * 0.2);
          const alpha = 0.15 + 0.1 * Math.sin(b.age * 0.06 + ring * Math.PI / 3);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = c;
          ctx.lineWidth   = 2;
          ctx.beginPath();
          ctx.arc(0, 0, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Cañones esqueléticos
        for (let i = 0; i < 4; i++) {
          const a = b.age * 0.015 + (i / 4) * Math.PI * 2;
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = '#880088';
          ctx.fillRect(hw * 0.5, -4, hw * 0.55, 8);
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(hw * 1.05, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
    }

    // Barra de HP del boss (sobre el sprite)
    const pct = b.hp / b.maxHp;
    const bw  = b.w * 1.5;
    ctx.fillStyle = '#222';
    ctx.fillRect(-bw / 2, -b.h / 2 - 16, bw, 6);
    ctx.fillStyle = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffaa00' : '#ff3333';
    ctx.fillRect(-bw / 2, -b.h / 2 - 16, bw * pct, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-bw / 2, -b.h / 2 - 16, bw, 6);
  }

  /**
   * Revisa si balas del jugador impactan al boss.
   * @param {Array} bullets - Pool de proyectiles
   * @param {Function} onHit  - callback(pts) al recibir daño
   * @returns {boolean} true si el boss murió
   */
  function checkBossBulletCollisions(bullets, onHit) {
    if (!_boss || !_boss.alive || _boss.entering) return false;
    const b  = _boss;
    const hw = b.w / 2, hh = b.h / 2;
    for (const blt of bullets) {
      if (!blt.active || blt.owner !== 'player') continue;
      if (blt.x >= b.x - hw && blt.x <= b.x + hw &&
          blt.y >= b.y - hh && blt.y <= b.y + hh) {
        blt.active = false;
        b.hp -= blt.damage;
        b.flashTimer = 5;
        if (b.hp <= 0) {
          b.alive = false;
          if (onHit) onHit(b.pts);
          return true;
        }
        if (onHit) onHit(10); // puntos de daño
      }
    }
    return false;
  }

  /**
   * Detecta colisión física entre jugador y boss.
   */
  function checkBossPlayerCollision(px, py, pr) {
    if (!_boss || !_boss.alive || _boss.entering) return false;
    const b  = _boss;
    const hw = b.w / 2, hh = b.h / 2;
    return px >= b.x - hw && px <= b.x + hw &&
           py >= b.y - hh && py <= b.y + hh;
  }

  function getBoss()    { return _boss; }
  function clearBoss()  { _boss = null; }
  function getBossDefs(){ return BOSS_DEFS; }

  // ── API pública ───────────────────────────────────────────────────
  return {
    spawn,
    clearAll,
    update,
    getShots,
    render,
    checkBulletCollisions,
    checkPlayerCollision,
    getEnemies,
    count,
    // Boss
    spawnBoss,
    updateBoss,
    getBossShots,
    renderBoss,
    checkBossBulletCollisions,
    checkBossPlayerCollision,
    getBoss,
    clearBoss,
    getBossDefs,
  };

})();
