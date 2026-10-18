/**
 * bullets.js — Motor de Proyectiles Bullet Hell
 * Cosmic Starlight Shmup
 *
 * Object Pool de 3000 proyectiles + 6 generadores de patrones Danmaku.
 * Optimizado para evitar GC spikes: reutiliza objetos del pool.
 *
 * PATRONES DANMAKU:
 *  1. FAN      — Abanico angular
 *  2. SPIRAL   — Espiral trigonométrica rotante
 *  3. RING     — Anillo expansivo 360°
 *  4. AIMED    — Proyectiles dirigidos al jugador
 *  5. RAIN     — Lluvia aleatoria con velocidad variable
 *  6. BUTTERFLY— Patrón 8 vías cruzadas
 */

'use strict';

const BulletSystem = (() => {

  // ── Pool de proyectiles ──────────────────────────────────────────
  const POOL_SIZE = 3000;

  const pool = [];
  let   _activeCount = 0;

  /** Estructura de un proyectil */
  function _makeBullet() {
    return {
      active: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      r: 4,          // radio de colisión
      color: '#ff0080',
      glowColor: 'rgba(255,0,128,0.6)',
      shape: 'circle', // 'circle' | 'diamond' | 'laser'
      owner: 'enemy', // 'player' | 'enemy'
      damage: 1,
      life: 0,       // vida útil (ticks). 0 = infinito hasta salir de pantalla
    };
  }

  // Pre-inicializar el pool
  for (let i = 0; i < POOL_SIZE; i++) pool.push(_makeBullet());

  /** Obtiene un proyectil del pool o null si está lleno */
  function _acquire() {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (!pool[i].active) {
        pool[i].active = true;
        _activeCount++;
        return pool[i];
      }
    }
    return null; // pool lleno
  }

  /** Desactiva y devuelve un proyectil al pool */
  function _release(b) {
    b.active = false;
    _activeCount--;
  }

  // ── API interna: disparar un proyectil ──────────────────────────
  function _fire({ x, y, vx, vy, r = 4, color, glowColor, shape = 'circle', owner = 'enemy', damage = 1, life = 0 }) {
    const b = _acquire();
    if (!b) return null;
    b.x  = x;  b.y  = y;
    b.vx = vx; b.vy = vy;
    b.r  = r;
    b.color = color;
    b.glowColor = glowColor || color + '99';
    b.shape = shape;
    b.owner = owner;
    b.damage = damage;
    b.life = life;
    return b;
  }

  // ── Actualizar todos los proyectiles ─────────────────────────────
  function update(canvasW, canvasH) {
    const margin = 40;
    for (let i = 0; i < POOL_SIZE; i++) {
      const b = pool[i];
      if (!b.active) continue;

      b.x += b.vx;
      b.y += b.vy;

      if (b.life > 0) {
        b.life--;
        if (b.life <= 0) { _release(b); continue; }
      }

      // Eliminar si sale del canvas
      if (b.x < -margin || b.x > canvasW + margin ||
          b.y < -margin || b.y > canvasH + margin) {
        _release(b);
      }
    }
  }

  // ── Renderizar todos los proyectiles ─────────────────────────────
  function render(ctx) {
    ctx.save();
    for (let i = 0; i < POOL_SIZE; i++) {
      const b = pool[i];
      if (!b.active) continue;
      _drawBullet(ctx, b);
    }
    ctx.restore();
  }

  function _drawBullet(ctx, b) {
    ctx.shadowBlur  = 10;
    ctx.shadowColor = b.glowColor;

    if (b.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      // Núcleo blanco
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();

    } else if (b.shape === 'diamond') {
      const s = b.r * 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x,     b.y - s);
      ctx.lineTo(b.x + s, b.y);
      ctx.lineTo(b.x,     b.y + s);
      ctx.lineTo(b.x - s, b.y);
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.fill();

    } else if (b.shape === 'laser') {
      // Proyectil rectangular (laser rápido)
      const angle = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.r * 3, -b.r * 0.5, b.r * 6, b.r);
      ctx.restore();
    }

    ctx.shadowBlur = 0;
  }

  // ── Limpiar todos los proyectiles ────────────────────────────────
  function clearAll() {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (pool[i].active) _release(pool[i]);
    }
    _activeCount = 0;
  }

  function clearEnemy() {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (pool[i].active && pool[i].owner === 'enemy') _release(pool[i]);
    }
  }

  // ── Generadores de patrones Danmaku ──────────────────────────────

  /**
   * PATRÓN 1 — FAN (Abanico angular)
   * Dispara `count` balas en arco centrado en `angle` con spread `spread`
   */
  function fireFan({ x, y, baseAngle = Math.PI / 2, count = 5, spread = Math.PI / 4,
                     speed = 3, r = 5, color = '#ff3399', owner = 'enemy', damage = 1 }) {
    if (count === 1) {
      const vx = Math.cos(baseAngle) * speed;
      const vy = Math.sin(baseAngle) * speed;
      _fire({ x, y, vx, vy, r, color, owner, damage });
      return;
    }
    const step = spread / (count - 1);
    const startAngle = baseAngle - spread / 2;
    for (let i = 0; i < count; i++) {
      const a = startAngle + step * i;
      _fire({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              r, color, owner, damage });
    }
  }

  /**
   * PATRÓN 2 — SPIRAL (Espiral trigonométrica)
   * Usa un ángulo acumulado para crear la espiral. Llamar repetidamente.
   * Devuelve el nuevo ángulo para el próximo fotograma.
   */
  function fireSpiral({ x, y, angle, armCount = 3, speed = 3.5,
                        r = 4, color = '#cc00ff', owner = 'enemy', damage = 1 }) {
    const step = (Math.PI * 2) / armCount;
    for (let arm = 0; arm < armCount; arm++) {
      const a = angle + step * arm;
      _fire({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              r, color, shape: 'diamond', owner, damage });
    }
    return angle + 0.06; // delta de rotación
  }

  /**
   * PATRÓN 3 — RING (Anillo expansivo 360°)
   */
  function fireRing({ x, y, count = 16, speed = 3, r = 4,
                      color = '#ff6600', owner = 'enemy', damage = 1, angleOffset = 0 }) {
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const a = step * i + angleOffset;
      _fire({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              r, color, owner, damage });
    }
  }

  /**
   * PATRÓN 4 — AIMED (Dirigido al jugador)
   * Dispara `count` balas apuntando a (px, py) con pequeñas variaciones
   */
  function fireAimed({ x, y, px, py, count = 3, spread = 0.15, speed = 4,
                       r = 5, color = '#ff0044', owner = 'enemy', damage = 1 }) {
    const baseAngle = Math.atan2(py - y, px - x);
    for (let i = 0; i < count; i++) {
      const spread2 = (Math.random() - 0.5) * spread;
      const a = baseAngle + spread2;
      _fire({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
              r, color, shape: 'diamond', owner, damage });
    }
  }

  /**
   * PATRÓN 5 — RAIN (Lluvia aleatoria con velocidad variable)
   */
  function fireRain({ x, y, canvasW = 480, count = 8, speedMin = 2, speedMax = 5,
                      r = 4, color = '#ff99cc', owner = 'enemy', damage = 1 }) {
    for (let i = 0; i < count; i++) {
      const spawnX = x === null ? Math.random() * canvasW : x;
      const speed  = speedMin + Math.random() * (speedMax - speedMin);
      const angle  = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
      _fire({ x: spawnX, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
              r, color, owner, damage });
    }
  }

  /**
   * PATRÓN 6 — BUTTERFLY (8 vías cruzadas)
   * Dispara en 8 direcciones con variación sinusoidal del ángulo
   */
  function fireButterfly({ x, y, angle, speed = 3, r = 4,
                           color = '#ff33cc', owner = 'enemy', damage = 1 }) {
    const directions = 8;
    const step = (Math.PI * 2) / directions;
    for (let i = 0; i < directions; i++) {
      const a = step * i + angle;
      // Velocidad modulada sinusoidalmente
      const sp = speed * (0.8 + 0.4 * Math.sin(angle * 2 + i));
      _fire({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              r, color, shape: 'diamond', owner, damage });
    }
    return angle + 0.1;
  }

  // ── Disparos del JUGADOR ─────────────────────────────────────────

  /**
   * Disparo del jugador según nivel de poder
   * powerLevel: 1 | 2 | 3
   * weapon: 'spread' | 'laser' | 'missile'
   */
  function firePlayer({ x, y, powerLevel = 1, weapon = 'spread', focusMode = false }) {
    const color   = '#00ffee';
    const glow    = 'rgba(0,255,238,0.7)';
    const speed   = focusMode ? 14 : 12;
    const dmg     = powerLevel;

    if (weapon === 'laser') {
      // Láser: proyectil de disparo rápido, forma laser, varias líneas
      for (let lane = -1; lane <= 1; lane++) {
        _fire({ x: x + lane * 10, y: y - 10, vx: 0, vy: -speed - 2,
                r: 5, color: '#00ffaa', glowColor: 'rgba(0,255,170,0.8)',
                shape: 'laser', owner: 'player', damage: dmg + 1 });
      }
      return;
    }

    if (weapon === 'missile') {
      // Misiles: se curvan hacia arriba
      const mColor = '#ffcc00';
      _fire({ x, y, vx: -1.5, vy: -speed * 0.8, r: 5, color: mColor,
              glowColor: 'rgba(255,200,0,0.7)', owner: 'player', damage: dmg + 1 });
      _fire({ x, y, vx:  1.5, vy: -speed * 0.8, r: 5, color: mColor,
              glowColor: 'rgba(255,200,0,0.7)', owner: 'player', damage: dmg + 1 });
      return;
    }

    // Spread (disparo estándar)
    if (powerLevel === 1) {
      _fire({ x, y: y - 10, vx: 0, vy: -speed,
              r: 4, color, glowColor: glow, shape: 'circle', owner: 'player', damage: dmg });

    } else if (powerLevel === 2) {
      _fire({ x: x - 8, y: y - 8, vx: -0.5, vy: -speed,
              r: 4, color, glowColor: glow, owner: 'player', damage: dmg });
      _fire({ x: x + 8, y: y - 8, vx:  0.5, vy: -speed,
              r: 4, color, glowColor: glow, owner: 'player', damage: dmg });

    } else { // nivel 3
      _fire({ x: x - 14, y: y - 5, vx: -1,  vy: -speed,
              r: 4, color, glowColor: glow, owner: 'player', damage: dmg });
      _fire({ x, y: y - 12, vx: 0, vy: -speed,
              r: 5, color: '#80ffee', glowColor: glow, owner: 'player', damage: dmg });
      _fire({ x: x + 14, y: y - 5, vx:  1,  vy: -speed,
              r: 4, color, glowColor: glow, owner: 'player', damage: dmg });
      // Disparo diagonal trasero
      if (!focusMode) {
        _fire({ x: x - 6, y: y + 4, vx: -2, vy: -speed * 0.6,
                r: 3, color: '#40ccdd', glowColor: glow, owner: 'player', damage: 1 });
        _fire({ x: x + 6, y: y + 4, vx:  2, vy: -speed * 0.6,
                r: 3, color: '#40ccdd', glowColor: glow, owner: 'player', damage: 1 });
      }
    }
  }

  // ── Getters ──────────────────────────────────────────────────────
  function getPool()        { return pool; }
  function getActiveCount() { return _activeCount; }

  // ── API pública ───────────────────────────────────────────────────
  return {
    update,
    render,
    clearAll,
    clearEnemy,
    getPool,
    getActiveCount,
    // Patrones Danmaku
    fireFan,
    fireSpiral,
    fireRing,
    fireAimed,
    fireRain,
    fireButterfly,
    // Jugador
    firePlayer,
  };

})();
