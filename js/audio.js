/**
 * audio.js — Sintetizador Chiptune procedural
 * Cosmic Starlight Shmup
 *
 * Genera todos los efectos de sonido y música mediante Web Audio API
 * sin archivos externos. Usa osciladores, filtros, envelopes ADSR y
 * effectos de modulación para sonidos retro de arcade.
 */

'use strict';

const AudioEngine = (() => {

  let _ctx = null;      // AudioContext
  let _masterGain = null;
  let _musicGain = null;
  let _sfxGain = null;
  let _enabled = true;

  // ── Inicialización ────────────────────────────────────────────────
  function init() {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _masterGain = _ctx.createGain();
      _masterGain.gain.value = 0.6;
      _masterGain.connect(_ctx.destination);

      _musicGain = _ctx.createGain();
      _musicGain.gain.value = 0.35;
      _musicGain.connect(_masterGain);

      _sfxGain = _ctx.createGain();
      _sfxGain.gain.value = 0.65;
      _sfxGain.connect(_masterGain);
    } catch (e) {
      console.warn('[AudioEngine] Web Audio API no disponible:', e);
      _enabled = false;
    }
  }

  function resume() {
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
  }

  function toggle() {
    _enabled = !_enabled;
    if (_masterGain) _masterGain.gain.value = _enabled ? 0.6 : 0;
    return _enabled;
  }

  function isEnabled() { return _enabled; }

  // ── Utilidades de síntesis ────────────────────────────────────────

  /**
   * Crea un oscilador simple con envelope ADSR
   * @param {string} type - 'square'|'sawtooth'|'triangle'|'sine'
   * @param {number} freq - Frecuencia base
   * @param {number} duration - Duración total en segundos
   * @param {number} peakGain - Volumen pico (0-1)
   * @param {AudioNode} destination - Nodo destino
   */
  function _playOsc(type, freq, duration, peakGain = 0.5, destination = null) {
    if (!_ctx || !_enabled) return;
    const dest = destination || _sfxGain;
    const now = _ctx.currentTime;

    const osc  = _ctx.createOscillator();
    const gain = _ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /**
   * Sweep de frecuencia (para efectos de laser y explosion)
   */
  function _playSweep(type, freqStart, freqEnd, duration, peakGain = 0.5, destination = null) {
    if (!_ctx || !_enabled) return;
    const dest = destination || _sfxGain;
    const now = _ctx.currentTime;

    const osc  = _ctx.createOscillator();
    const gain = _ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);

    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /**
   * Ruido blanco para explosiones
   */
  function _playNoise(duration, peakGain = 0.3, destination = null) {
    if (!_ctx || !_enabled) return;
    const dest = destination || _sfxGain;
    const now = _ctx.currentTime;

    const bufferSize = Math.ceil(_ctx.sampleRate * duration);
    const buffer = _ctx.createBuffer(1, bufferSize, _ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = _ctx.createBufferSource();
    source.buffer = buffer;

    const gain = _ctx.createGain();
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = _ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    source.start(now);
    source.stop(now + duration);
  }

  // ── Efectos de Sonido (SFX) ───────────────────────────────────────

  /** Disparo básico del jugador */
  function shoot() {
    _playSweep('square', 880, 440, 0.08, 0.25);
  }

  /** Disparo nivel 2 (doble) */
  function shootDouble() {
    _playSweep('square', 1100, 550, 0.07, 0.2);
    setTimeout(() => _playSweep('square', 1000, 500, 0.07, 0.2), 20);
  }

  /** Disparo nivel 3 (spread) */
  function shootSpread() {
    _playSweep('sawtooth', 1320, 660, 0.06, 0.18);
    setTimeout(() => _playSweep('square', 880, 440, 0.06, 0.18), 15);
  }

  /** Laser continuo */
  function laserBeam() {
    _playSweep('sawtooth', 600, 800, 0.15, 0.3);
  }

  /** Misil autodirigido */
  function missile() {
    _playSweep('square', 300, 600, 0.12, 0.35);
    _playSweep('triangle', 200, 100, 0.2, 0.2);
  }

  /** Bomba / explosión masiva */
  function bomb() {
    _playNoise(0.8, 0.5);
    _playSweep('square', 80, 20, 1.0, 0.7);
    _playSweep('sawtooth', 200, 50, 0.7, 0.4);
  }

  /** Explosión de enemigo menor */
  function enemyExplosion() {
    _playNoise(0.2, 0.35);
    _playSweep('square', 300, 60, 0.25, 0.35);
  }

  /** Explosión grande (boss o enemigo grande) */
  function bigExplosion() {
    _playNoise(0.5, 0.55);
    _playSweep('square', 150, 30, 0.6, 0.6);
    _playSweep('sawtooth', 250, 80, 0.4, 0.3);
    setTimeout(() => _playNoise(0.3, 0.3), 100);
  }

  /** Recoger powerup */
  function powerup() {
    const freqs = [523, 659, 784, 1047];
    freqs.forEach((f, i) => {
      setTimeout(() => _playOsc('square', f, 0.12, 0.3), i * 50);
    });
  }

  /** Jugador golpeado */
  function playerHit() {
    _playNoise(0.3, 0.4);
    _playSweep('square', 440, 110, 0.35, 0.5);
    _playSweep('triangle', 330, 82, 0.4, 0.35);
  }

  /** Vida perdida / respawn */
  function lifeDown() {
    const freqs = [440, 330, 220, 110];
    freqs.forEach((f, i) => {
      setTimeout(() => _playOsc('square', f, 0.15, 0.35), i * 80);
    });
  }

  /** Game Over */
  function gameOver() {
    const freqs = [330, 277, 233, 196, 165];
    freqs.forEach((f, i) => {
      setTimeout(() => _playOsc('sawtooth', f, 0.3, 0.4), i * 120);
    });
    setTimeout(() => _playNoise(0.5, 0.3), 600);
  }

  /** Alerta de Jefe */
  function bossWarning() {
    for (let r = 0; r < 4; r++) {
      setTimeout(() => {
        _playSweep('sawtooth', 110, 220, 0.2, 0.5);
        _playSweep('square',   220, 440, 0.2, 0.3);
      }, r * 250);
    }
  }

  /** Stage Clear */
  function stageClear() {
    const melody = [523, 659, 784, 1047, 1319, 1047, 784, 659, 523];
    melody.forEach((f, i) => {
      setTimeout(() => _playOsc('square', f, 0.15, 0.3), i * 80);
    });
  }

  /** All Clear / Victoria */
  function allClear() {
    const melody = [523, 659, 784, 1047, 1319, 1047, 1319, 1568];
    melody.forEach((f, i) => {
      setTimeout(() => {
        _playOsc('square',   f,    0.25, 0.3);
        _playOsc('triangle', f/2,  0.25, 0.15);
      }, i * 100);
    });
    setTimeout(() => _playNoise(0.2, 0.15), 900);
  }

  /** Grazing (rozar bala sin morir) */
  function graze() {
    _playOsc('triangle', 1200, 0.05, 0.2);
  }

  // ── Música de fondo (loops chiptune procedurales) ─────────────────

  let _musicInterval = null;
  let _musicTick = 0;
  let _bossMode = false;

  const MELODY_NORMAL = [
    262, 294, 330, 349, 392, 440, 392, 349,
    330, 294, 262, 247, 294, 330, 349, 330
  ];

  const MELODY_BOSS = [
    220, 196, 175, 165, 175, 196, 220, 247,
    220, 247, 277, 233, 220, 196, 175, 196
  ];

  const BASS_NORMAL = [65, 65, 98, 98, 87, 87, 110, 110];
  const BASS_BOSS   = [55, 55, 73, 73, 65, 65, 73, 73];

  function startMusic(bossMode = false) {
    stopMusic();
    _bossMode = bossMode;
    _musicTick = 0;

    const bpm     = bossMode ? 180 : 140;
    const beatMs  = Math.round(60000 / bpm / 2);

    _musicInterval = setInterval(() => {
      if (!_enabled || !_ctx) return;
      const melody = _bossMode ? MELODY_BOSS   : MELODY_NORMAL;
      const bass   = _bossMode ? BASS_BOSS     : BASS_NORMAL;
      const tick   = _musicTick;

      // Melodía
      const mFreq = melody[tick % melody.length];
      _playOsc('square', mFreq, 0.12, 0.15, _musicGain);

      // Bajo (cada 2 pulsos)
      if (tick % 2 === 0) {
        const bFreq = bass[Math.floor(tick / 2) % bass.length];
        _playOsc('triangle', bFreq, 0.22, 0.2, _musicGain);
      }

      // Bombo (cada 4 pulsos)
      if (tick % 4 === 0) {
        _playSweep('sine', 120, 40, 0.15, 0.25, _musicGain);
      }

      // Hi-hat
      if (tick % 2 === 1) {
        const hh = _ctx.createOscillator();
        const hg = _ctx.createGain();
        hh.type = 'square';
        hh.frequency.value = 8000;
        hg.gain.setValueAtTime(0.05, _ctx.currentTime);
        hg.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + 0.03);
        hh.connect(hg);
        hg.connect(_musicGain);
        hh.start(_ctx.currentTime);
        hh.stop(_ctx.currentTime + 0.05);
      }

      _musicTick++;
    }, beatMs);
  }

  function stopMusic() {
    if (_musicInterval) {
      clearInterval(_musicInterval);
      _musicInterval = null;
    }
  }

  function setBossMode(boss) {
    if (_bossMode !== boss) {
      startMusic(boss);
    }
  }

  // ── API pública ───────────────────────────────────────────────────
  return {
    init,
    resume,
    toggle,
    isEnabled,
    // SFX
    shoot,
    shootDouble,
    shootSpread,
    laserBeam,
    missile,
    bomb,
    enemyExplosion,
    bigExplosion,
    powerup,
    playerHit,
    lifeDown,
    gameOver,
    bossWarning,
    stageClear,
    allClear,
    graze,
    // Música
    startMusic,
    stopMusic,
    setBossMode,
  };

})();
