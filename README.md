# Cosmic Starlight Shmup 🚀

> **Bullet Hell Arcade 2D** — Shoot 'em Up espacial con patrones Danmaku, jefes de múltiples fases y síntesis chiptune procedural.

## 🎮 Cómo jugar

Abre `index.html` directamente en el navegador (Chrome/Firefox recomendado). No requiere servidor ni instalación.

## 🕹️ Controles

| Tecla | Acción |
|-------|--------|
| `↑ ↓ ← →` / `W A S D` | Mover la nave |
| `Z` / `Espacio` | Disparar (mantener pulsado) |
| `Shift ⇧` | **Focus Mode** — velocidad reducida, hitbox visible |
| `X` | **Bomba** — onda de choque que limpia pantalla |
| `ESC` | Pausa |

## 🌟 Mecánicas principales

### Focus Mode (Shift)
Al mantener `Shift`, la nave reduce su velocidad a la mitad y aparece un punto blanco con crosshair que muestra la **hitbox real de 3px**. Permite esquivar con precisión en patrones densos.

### Sistema de Disparo
- **LV 1** — Disparo central simple
- **LV 2** — Doble disparo lateral
- **LV 3** — Triple disparo + diagonales traseras

### Powerups
| Ícono | Tipo | Efecto |
|-------|------|--------|
| ★ | POWER UP | Sube nivel de disparo (máx. 3) |
| ⚡ | LASER | Láser continuo durante 6 segundos |
| 🚀 | MISSILE | Misiles autodirigidos durante 7 segundos |
| 🛡 | SHIELD | Absorbe 3 golpes |
| 💣 | BOMB | +1 bomba (máx. 3) |
| ❤ | LIFE | +1 vida (máx. 5) |

### Sistema de Bombas
Cada bomba genera una onda de choque que:
- Elimina todas las balas enemigas
- Daña al 6% del HP del jefe
- Otorga 2 segundos de invulnerabilidad
- Produce un flash de pantalla

### Graze (Rozar)
Pasar muy cerca de las balas enemigas sin recibir impacto otorga **+10 puntos** por bala rozada y se cuenta en el marcador de GRAZE.

## 👾 Enemigos

| Tipo | Descripción | Patrón de disparo |
|------|-------------|-------------------|
| **INTERCEPTOR** | Vuelo recto, oscila levemente | Abanico de 3 balas |
| **BOMBER** | Zigzag horizontal | Anillo de 10 balas |
| **KAMIKAZE** | Se lanza directo al jugador | No dispara (colisión) |
| **FORMATION_V** | Vuelo en V coordinado | 2 balas dirigidas |
| **TURRET** | Estacionario, gira | Espiral de 4 brazos |

## 💀 Jefes (3 sectores)

### Sector 1 — NEMESIS MK-I
- **Fase 1**: Abanico de 7 balas + abanico trasero
- **Fase 2** (HP < 45%): Espiral de 5 brazos

### Sector 2 — VOID DREADNOUGHT
- **Fase 1**: Lluvia de proyectiles desde arriba
- **Fase 2** (HP < 60%): Ráfagas dirigidas + abanico
- **Fase 3** (HP < 25%): Anillo de 20 balas + dirigidas

### Sector 3 — GUARDIAN PRIME Ω (Jefe Final)
- **Fase 1**: Anillo + balas dirigidas
- **Fase 2** (HP < 70%): Patrón Butterfly (8 vías cruzadas)
- **Fase 3** (HP < 40%): Anillo rotante + espiral de 6 brazos
- **Fase 4** (HP < 15%): TODOS los patrones simultáneos

## 🏗️ Arquitectura técnica

```
cosmic-starlight-shmup/
├── index.html       # Marco arcade, canvas 480×640, HUD
├── css/
│   └── style.css    # Sistema HSL neon, efectos glow, scanlines
├── js/
│   ├── audio.js     # Sintetizador chiptune Web Audio API
│   ├── bullets.js   # Pool 3000 proyectiles + 6 patrones Danmaku
│   ├── powerups.js  # 6 tipos de mejoras con animación floating
│   ├── player.js    # Nave, Focus Mode, bombas, vidas, shield
│   ├── enemies.js   # 5 tipos + 3 jefes multi-fase
│   └── app.js       # Game loop, estados, colisiones, HUD, scores
└── README.md
```

**Motor**: HTML5 Canvas 2D + Vanilla ES6+ (sin dependencias)  
**Optimización**: Object Pool Pattern (3000 proyectiles pre-instanciados, sin GC spikes)  
**Audio**: Web Audio API procedural (sin archivos de sonido externos)

## 🎯 Sistema de puntuación

| Enemigo | Puntos |
|---------|--------|
| Kamikaze | 80 |
| Interceptor | 100 |
| Formation V | 120 |
| Bomber | 200 |
| Turret | 300 |
| Boss 1 | 5.000 |
| Boss 2 | 10.000 |
| Boss 3 | 20.000 |
| Bonus por sector | 50.000 × n° sector |
| Graze | 10 por bala |

Los 10 mejores puntajes se guardan en `localStorage`.

## 🖥️ Compatibilidad

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ⚠️ Safari (Web Audio puede requerir interacción inicial)
