/**
 * powerups.js — Sistema de Powerups
 * Cosmic Starlight Shmup
 *
 * 6 tipos de mejoras que caen de enemigos destruidos:
 *  ★ POWER  — Sube nivel de disparo (max 3)
 *  ⚡ LASER  — Activa láser continuo 5s
 *  🚀 MISSILE— Misiles autodirigidos 6s
 *  🛡 SHIELD — Escudo de 3 golpes
 *  💣 BOMB   — +1 bomba (max 3)
 *  ❤ LIFE   — +1 vida (max 5)
 */

'use strict';

const PowerupSystem = (() => {

  // ── Tipos de powerup ──────────────────────────────────────────────
  const TYPES = {
    POWER:   { label: '★',  color: '#00ffee', glow: 'rgba(0,255,238,0.7)', w: 20, h: 20 },
    LASER:   { label: '⚡', color: '#ffff00', glow: 'rgba(255,255,0,0.7)',  w: 20, h: 20 },
    MISSILE: { label: '🚀', color: '#ff8800', glow: 'rgba(255,136,0,0.7)', w: 20, h: 20 },
    SHIELD:  { label: '🛡', color: '#00ff88', glow: 'rgba(0,255,136,0.7)', w: 20, h: 20 },
    BOMB:    { label: '💣', color: '#ff4400', glow: 'rgba(255,68,0,0.7)',   w: 20, h: 20 },
    LIFE:    { label: '❤',  color: '#ff69b4', glow: 'rgba(255,105,180,0.8)',w: 20, h: 20 },
  };

  const TYPE_KEYS   = Object.keys(TYPES);
  const DROP_WEIGHTS = [30, 15, 15, 15, 15, 10]; // POWER más común, LIFE más raro

  // ── Pool de powerups activos ─────────────────────────────────────
  const _items = [];

  function _randomType() {
    const total = DROP_WEIGHTS.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < TYPE_KEYS.length; i++) {
      roll -= DROP_WEIGHTS[i];
      if (roll <= 0) return TYPE_KEYS[i];
    }
    return TYPE_KEYS[0];
  }

  /**
   * Hace caer un powerup en la posición indicada.
   * @param {number} x
   * @param {number} y
   * @param {string|null} forceType - Forzar tipo (null = aleatorio)
   * @param {number} dropChance - Probabilidad 0-1 de que caiga (default 0.25)
   */
  function drop(x, y, forceType = null, dropChance = 0.25) {
    if (Math.random() > dropChance && !forceType) return;
    const type = forceType || _randomType();
    _items.push({
      x, y,
      vy:   1.2 + Math.random() * 0.6,
      vx:   (Math.random() - 0.5) * 0.8,
      type,
      age:  0,
      life: 360, // desaparece en ~6 segundos
      collected: false,
    });
  }

  /** Limpiar todos los powerups */
  function clearAll() { _items.length = 0; }

  /** Actualizar posiciones y vida */
  function update() {
    for (let i = _items.length - 1; i >= 0; i--) {
      const p = _items[i];
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      p.life--;
      if (p.life <= 0 || p.collected) {
        _items.splice(i, 1);
      }
    }
  }

  /** Renderizar todos los powerups */
  function render(ctx) {
    const now = performance.now();
    ctx.save();
    for (const p of _items) {
      const def = TYPES[p.type];
      // Parpadeo cuando está por desaparecer
      if (p.life < 90 && Math.floor(p.age / 8) % 2 === 0) continue;

      const floatY = Math.sin(now * 0.004 + p.x) * 4;

      // Glow de fondo
      ctx.shadowBlur  = 14;
      ctx.shadowColor = def.glow;

      // Cápsula de fondo
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      _roundRect(ctx, p.x - 14, p.y - 14 + floatY, 28, 28, 6);
      ctx.fill();

      // Borde brillante
      ctx.strokeStyle = def.color;
      ctx.lineWidth   = 1.5;
      _roundRect(ctx, p.x - 14, p.y - 14 + floatY, 28, 28, 6);
      ctx.stroke();

      // Emoji / símbolo
      ctx.shadowBlur = 0;
      ctx.font       = '14px "Segoe UI Emoji", sans-serif';
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle  = def.color;
      ctx.fillText(def.label, p.x, p.y + floatY);
    }
    ctx.restore();
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * Detecta colisión entre un rect de jugador y los powerups.
   * Devuelve el tipo del powerup recogido o null.
   * @param {number} px - Centro X del jugador
   * @param {number} py - Centro Y del jugador
   * @param {number} pr - Radio de colección (más grande que hitbox)
   */
  function checkCollect(px, py, pr = 20) {
    for (const p of _items) {
      if (p.collected) continue;
      const dx = px - p.x;
      const dy = py - p.y;
      if (dx * dx + dy * dy < pr * pr) {
        p.collected = true;
        return p.type;
      }
    }
    return null;
  }

  // ── Getters ───────────────────────────────────────────────────────
  function getItems() { return _items; }

  // ── API pública ───────────────────────────────────────────────────
  return {
    drop,
    clearAll,
    update,
    render,
    checkCollect,
    getItems,
    TYPES,
  };

})();
