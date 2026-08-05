/* ===== Tipe Data ===== */
export interface Note {
  time: number;
  lane: number;
  hit: boolean;
  missed: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; life: number;
  rot: number; vr: number;
}

interface Popup {
  x: number; y: number; text: string; color: string; life: number;
}

export interface LevelData {
  id: number;
  name: string;
  bpm: number;
  duration: number;
  difficulty: string;
  density: number;
  color: string;
}

export interface HitStats {
  perfect: number;
  good: number;
  miss: number;
}

export interface GameResult {
  score: number;
  maxCombo: number;
  hits: HitStats;
  accuracy: number;
}

export interface GameCallbacks {
  onGameOver: (result: GameResult, isGameOver: boolean) => void;
  onUpdateHUD: (score: number, combo: number, acc: number, lives: number) => void;
}

/* ===== Data Level ===== */
export const LEVELS: LevelData[] = [
  { id: 1,  name: 'Denyut Pertama',  bpm: 80,  duration: 30, difficulty: 'Mudah',   density: 0.45, color: 'merah' },
  { id: 2,  name: 'Langkah Cerah',   bpm: 90,  duration: 32, difficulty: 'Mudah',   density: 0.50, color: 'emas' },
  { id: 3,  name: 'Irama Hijau',     bpm: 100, duration: 34, difficulty: 'Mudah',   density: 0.55, color: 'hijau' },
  { id: 4,  name: 'Jalan Langit',     bpm: 110, duration: 36, difficulty: 'Sedang',  density: 0.62, color: 'neon' },
  { id: 5,  name: 'Nada Merah',      bpm: 118, duration: 38, difficulty: 'Sedang',  density: 0.68, color: 'merah' },
  { id: 6,  name: 'Detak Emas',      bpm: 125, duration: 40, difficulty: 'Sedang',  density: 0.72, color: 'emas' },
  { id: 7,  name: 'Lari Hutan',      bpm: 135, duration: 42, difficulty: 'Sulit',   density: 0.78, color: 'hijau' },
  { id: 8,  name: 'Arus Samudra',    bpm: 145, duration: 45, difficulty: 'Sulit',   density: 0.82, color: 'neon' },
  { id: 9,  name: 'Tarian Jari',     bpm: 155, duration: 50, difficulty: 'Sulit',   density: 0.88, color: 'merah' },
  { id: 10, name: 'Badai Neons',     bpm: 162, duration: 52, difficulty: 'Ekstrem', density: 0.90, color: 'emas' },
  { id: 11, name: 'Denyut Listrik',  bpm: 168, duration: 54, difficulty: 'Ekstrem', density: 0.92, color: 'hijau' },
  { id: 12, name: 'Kaca Pecah',     bpm: 175, duration: 56, difficulty: 'Ekstrem', density: 0.94, color: 'neon' },
  { id: 13, name: 'Lubang Hitam',   bpm: 182, duration: 58, difficulty: 'Brutal',  density: 0.95, color: 'merah' },
  { id: 14, name: 'Singularitas',   bpm: 190, duration: 60, difficulty: 'Brutal',  density: 0.97, color: 'emas' },
  { id: 15, name: 'Nirwana Jari',   bpm: 200, duration: 65, difficulty: 'Master',  density: 0.99, color: 'merah' },
];

/* ===== Konstanta ===== */
export const LANE_COLORS = ['#FF3366', '#FFBE0B', '#AAFF00', '#0FFFCF'];
export const LANE_KEYS = ['d', 'f', 'j', 'k'];
export const CANVAS_W = 480;
const CANVAS_H = 680;
const FALL_TIME = 1700;
const PERFECT_WIN = 75;
const GOOD_WIN = 150;

/* ===== Sistem Audio ===== */
let audioCtx: AudioContext | null = null;

export function ensureAudio(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(opts: { freq?: number; type?: OscillatorType; dur?: number; gain?: number; slideTo?: number; attack?: number }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const { freq = 440, type = 'sine', dur = 0.15, gain = 0.2, slideTo, attack = 0.005 } = opts;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playNoiseBurst(dur = 0.05, gain = 0.08, hp = 4000) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = 'highpass';
  flt.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(flt);
  flt.connect(g);
  g.connect(ctx.destination);
  src.start();
}

/* ===== Mesin Game ===== */
export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private level: LevelData;
  private cb: GameCallbacks;
  private audioOn: boolean;
  private motionOff: boolean;

  private notes: Note[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private laneFlash = [0, 0, 0, 0];

  score = 0;
  combo = 0;
  maxCombo = 0;
  lives = 3;
  hits: HitStats = { perfect: 0, good: 0, miss: 0 };

  private elapsed = 0;
  private startTime = 0;
  private totalPauseMs = 0;
  private pauseStart = 0;
  paused = false;
  running = false;
  countingDown = true;
  private lastBeatIdx = -1;
  private beatPulse = 0;
  private endTime: number;
  private countdownMs = 2200;
  private shake = 0;
  private lastFrame = 0;
  private rafId = 0;

  constructor(
    canvas: HTMLCanvasElement,
    level: LevelData,
    callbacks: GameCallbacks,
    audioEnabled: boolean,
    motionReduced: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.level = level;
    this.cb = callbacks;
    this.audioOn = audioEnabled;
    this.motionOff = motionReduced;
    this.endTime = (level.duration + 2) * 1000;
    this.generate();
  }

  /* -- Polyfill roundRect -- */
  private rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* -- Generasi nada -- */
  private generate() {
    const beatMs = 60000 / this.level.bpm;
    const subMs = beatMs / 2;
    const total = Math.floor((this.level.duration * 1000) / subMs);
    let lastLane = -1;
    for (let i = 0; i < total; i++) {
      const time = i * subMs + 1800;
      if (Math.random() < this.level.density) {
        let lane: number;
        do {
          lane = Math.floor(Math.random() * 4);
        } while (lane === lastLane && Math.random() < 0.55);
        this.notes.push({ time, lane, hit: false, missed: false });
        lastLane = lane;
        if (this.level.difficulty !== 'Mudah' && Math.random() < 0.12) {
          let l2: number;
          do {
            l2 = Math.floor(Math.random() * 4);
          } while (l2 === lane);
          this.notes.push({ time, lane: l2, hit: false, missed: false });
        }
      }
    }
  }

  /* -- Siklus hidup -- */
  start() {
    ensureAudio();
    this.running = true;
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  pause() {
    if (this.paused || !this.running) return;
    this.paused = true;
    this.pauseStart = performance.now();
  }

  resume() {
    if (!this.paused) return;
    this.totalPauseMs += performance.now() - this.pauseStart;
    this.paused = false;
  }

  setAudioEnabled(v: boolean) { this.audioOn = v; }
  setMotionReduced(v: boolean) { this.motionOff = v; }

  /* -- Input pemain -- */
  handleKey(lane: number) {
    if (!this.running || this.paused || this.countingDown) return;
    this.laneFlash[lane] = 1;
    let nearest: Note | null = null;
    let dist = Infinity;
    for (const n of this.notes) {
      if (n.lane !== lane || n.hit || n.missed) continue;
      const d = Math.abs(n.time - this.elapsed);
      if (d < dist) { dist = d; nearest = n; }
    }
    
    // Cek apakah ada nada yang valid untuk ditekan
    if (nearest && dist < GOOD_WIN) {
      nearest.hit = true;
      this.registerHit(lane, dist < PERFECT_WIN);
    } else {
      // Hukuman: Tombol ditekan tapi tidak ada nada (Spam / Tekan kosong)
      this.registerMiss(lane);
    }
  }

  /* -- Hit / Miss -- */
  private registerHit(lane: number, perfect: boolean) {
    const base = perfect ? 100 : 50;
    const bonus = Math.floor(this.combo / 10) * 15;
    this.score += base + bonus;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (perfect) this.hits.perfect++;
    else this.hits.good++;
    this.spawnParticles(lane, perfect ? 16 : 10, perfect);
    this.popups.push({
      x: lane * (CANVAS_W / 4) + CANVAS_W / 8,
      y: CANVAS_H - 130,
      text: perfect ? 'SEMPURNA' : 'BAGUS',
      color: perfect ? '#AAFF00' : '#FFBE0B',
      life: 55,
    });
    this.playHitSound(lane, perfect);
    if (navigator.vibrate) navigator.vibrate(perfect ? 28 : 14);
  }

  private registerMiss(lane: number) {
    this.combo = 0;
    this.lives--;
    this.hits.miss++;
    this.shake = 8;
    this.popups.push({
      x: lane * (CANVAS_W / 4) + CANVAS_W / 8,
      y: CANVAS_H - 130,
      text: 'MELESET',
      color: '#FF3366',
      life: 50,
    });
    this.playMissSound();
    if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    if (this.lives <= 0) this.finish(true);
  }

  private spawnParticles(lane: number, count: number, perfect: boolean) {
    if (this.motionOff) count = Math.min(4, count);
    const cx = lane * (CANVAS_W / 4) + CANVAS_W / 8;
    const cy = CANVAS_H - 95;
    const base = LANE_COLORS[lane];
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const sp = 3 + Math.random() * 5;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2,
        size: 5 + Math.random() * 7,
        color: Math.random() < 0.35 ? '#FFFFFF' : (perfect && Math.random() < 0.3 ? '#FFBE0B' : base),
        life: 28 + Math.random() * 22,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
      });
    }
  }

  /* -- Selesai -- */
  private finish(gameOver: boolean) {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    const total = this.hits.perfect + this.hits.good + this.hits.miss;
    const acc = total === 0 ? 0 : Math.round(((this.hits.perfect + this.hits.good * 0.5) / total) * 100);
    this.cb.onGameOver(
      { score: this.score, maxCombo: this.maxCombo, hits: { ...this.hits }, accuracy: acc },
      gameOver,
    );
  }

  /* -- Suara -- */
  private playKick(accent: boolean) {
    if (!this.audioOn) return;
    playTone({ freq: accent ? 140 : 100, type: 'sine', dur: 0.16, gain: accent ? 0.42 : 0.28, slideTo: 42, attack: 0.002 });
  }
  private playHat() {
    if (!this.audioOn) return;
    playNoiseBurst(0.04, 0.05, 6000);
  }
  private playHitSound(lane: number, perfect: boolean) {
    if (!this.audioOn) return;
    const f = [330, 440, 550, 660];
    playTone({ freq: f[lane], type: 'triangle', dur: 0.13, gain: 0.22, slideTo: f[lane] * 1.4, attack: 0.001 });
    if (perfect) playTone({ freq: f[lane] * 2, type: 'sine', dur: 0.18, gain: 0.12, attack: 0.001 });
  }
  private playMissSound() {
    if (!this.audioOn) return;
    playTone({ freq: 170, type: 'sawtooth', dur: 0.18, gain: 0.14, slideTo: 80, attack: 0.002 });
  }

  /* ===== Loop utama ===== */
  private loop(now: number) {
    if (!this.running) return;
    const dt = now - this.lastFrame;
    this.lastFrame = now;

    if (!this.paused) {
      if (this.countingDown) {
        this.countdownMs -= dt;
        if (this.countdownMs <= 0) {
          this.countingDown = false;
          this.startTime = now;
        }
      } else {
        this.elapsed = now - this.startTime - this.totalPauseMs;

        /* Detak musik */
        const beatMs = 60000 / this.level.bpm;
        const beatIdx = Math.floor(this.elapsed / beatMs);
        if (beatIdx !== this.lastBeatIdx && beatIdx >= 0) {
          this.lastBeatIdx = beatIdx;
          if (!this.motionOff) this.beatPulse = 1;
          this.playKick(beatIdx % 4 === 0);
          if (beatIdx % 2 === 1) this.playHat();
        }
        if (!this.motionOff) this.beatPulse *= 0.9;

        /* Cek nada yang terlewat */
        for (const n of this.notes) {
          if (!n.hit && !n.missed && this.elapsed - n.time > GOOD_WIN) {
            n.missed = true;
            this.registerMiss(n.lane);
          }
        }

        /* Kondisi akhir */
        if (this.elapsed >= this.endTime) { this.finish(false); return; }

        /* Update efek (dihentikan jika kurangi gerakan aktif) */
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          if (!this.motionOff) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.vx *= 0.98;
            p.rot += p.vr;
          }
          p.life--;
          if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.popups.length - 1; i >= 0; i--) {
          const p = this.popups[i];
          if (!this.motionOff) p.y -= 1.1;
          p.life--;
          if (p.life <= 0) this.popups.splice(i, 1);
        }
        for (let i = 0; i < 4; i++) this.laneFlash[i] *= 0.85;
        this.shake *= 0.82;

        /* Update HUD */
        const total = this.hits.perfect + this.hits.good + this.hits.miss;
        const acc = total === 0 ? 100 : Math.round(((this.hits.perfect + this.hits.good * 0.5) / total) * 100);
        this.cb.onUpdateHUD(this.score, this.combo, acc, this.lives);
      }
    }

    this.render();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  /* ===== Render canvas ===== */
  private render() {
    const c = this.ctx;
    c.save();

    /* Goyangan saat meleset */
    if (this.shake > 0.3 && !this.motionOff) {
      c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    /* Latar belakang berdenyut */
    const p = this.beatPulse;
    const grad = c.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, `rgb(${13 + p * 25},${13 + p * 18},${18 + p * 30})`);
    grad.addColorStop(1, `rgb(${8 + p * 12},${8 + p * 10},${12 + p * 18})`);
    c.fillStyle = grad;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    /* Grid halus */
    c.strokeStyle = 'rgba(245,230,200,0.03)';
    c.lineWidth = 1;
    for (let y = 0; y < CANVAS_H; y += 40) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(CANVAS_W, y); c.stroke();
    }

    const laneW = CANVAS_W / 4;
    const hitY = CANVAS_H - 100;

    /* Jalur */
    for (let i = 0; i < 4; i++) {
      const x = i * laneW;
      c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)';
      c.fillRect(x, 0, laneW, CANVAS_H);

      /* Cahaya jalur saat ditekan */
      if (this.laneFlash[i] > 0.05) {
        const lg = c.createLinearGradient(0, hitY - 180, 0, hitY + 50);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(1, LANE_COLORS[i]);
        c.globalAlpha = this.laneFlash[i] * 0.4;
        c.fillStyle = lg;
        c.fillRect(x, hitY - 180, laneW, 230);
        c.globalAlpha = 1;
      }

      /* Garis pemisah jalur */
      if (i > 0) {
        c.strokeStyle = 'rgba(245,230,200,0.06)';
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, CANVAS_H); c.stroke();
      }
    }

    /* Zona tekan */
    for (let i = 0; i < 4; i++) {
      const x = i * laneW + 12;
      const w = laneW - 24;
      c.fillStyle = LANE_COLORS[i];
      c.globalAlpha = 0.12 + this.laneFlash[i] * 0.4;
      this.rr(c, x, hitY - 26, w, 56, 14);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = LANE_COLORS[i];
      c.lineWidth = 3 + this.laneFlash[i] * 2;
      this.rr(c, x, hitY - 26, w, 56, 14);
      c.stroke();
    }

    /* Garis tekan bercahaya */
    c.shadowColor = 'rgba(245,230,200,0.4)';
    c.shadowBlur = 8;
    c.fillStyle = 'rgba(245,230,200,0.85)';
    c.fillRect(0, hitY - 2, CANVAS_W, 4);
    c.shadowBlur = 0;

    /* Nada jatuh */
    for (const n of this.notes) {
      if (n.hit) continue;
      const dt = n.time - this.elapsed;
      if (dt > FALL_TIME) continue;
      if (n.missed && dt < -GOOD_WIN - 200) continue;
      const progress = 1 - dt / FALL_TIME;
      const y = progress * hitY;
      if (y < -40) continue;
      const x = n.lane * laneW + 14;
      const nw = laneW - 28;
      const nh = 34;

      /* Cahaya neon di belakang nada */
      if (!n.missed) { c.shadowColor = LANE_COLORS[n.lane]; c.shadowBlur = 14; }

      /* Bayangan */
      c.fillStyle = 'rgba(0,0,0,0.35)';
      this.rr(c, x + 3, y + 4, nw, nh, 12);
      c.fill();
      c.shadowBlur = 0;

      /* Badan nada */
      c.fillStyle = n.missed ? '#2a2a3a' : LANE_COLORS[n.lane];
      this.rr(c, x, y, nw, nh, 12);
      c.fill();

      /* Strip highlight */
      c.fillStyle = 'rgba(255,255,255,0.3)';
      this.rr(c, x + 5, y + 5, nw - 10, 7, 4);
      c.fill();

      /* Garis tepi */
      c.strokeStyle = 'rgba(0,0,0,0.4)';
      c.lineWidth = 2.5;
      this.rr(c, x, y, nw, nh, 12);
      c.stroke();

      /* Titik cahaya */
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.beginPath();
      c.arc(x + nw - 12, y + nh / 2, 3, 0, Math.PI * 2);
      c.fill();
    }

    /* Partikel */
    for (const pt of this.particles) {
      c.save();
      c.translate(pt.x, pt.y);
      c.rotate(pt.rot);
      c.globalAlpha = Math.min(1, pt.life / 30);
      c.fillStyle = pt.color;
      c.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.lineWidth = 1.5;
      c.strokeRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
      c.restore();
    }
    c.globalAlpha = 1;

    /* Teks popup */
    for (const pp of this.popups) {
      c.save();
      c.globalAlpha = Math.min(1, pp.life / 30);
      c.font = 'bold 26px Fredoka, sans-serif';
      c.textAlign = 'center';
      c.lineWidth = 5;
      c.strokeStyle = '#0D0D12';
      c.strokeText(pp.text, pp.x, pp.y);
      c.fillStyle = pp.color;
      c.fillText(pp.text, pp.x, pp.y);
      c.restore();
    }
    c.globalAlpha = 1;

    /* Tampilan kombo */
    if (this.combo >= 4) {
      c.save();
      c.translate(CANVAS_W / 2, 70);
      if (!this.motionOff) {
        const sc = 1 + Math.min(0.3, this.combo * 0.01);
        c.scale(sc, sc);
      }
      c.font = 'bold 36px Fredoka, sans-serif';
      c.textAlign = 'center';
      c.lineWidth = 6;
      c.strokeStyle = '#0D0D12';
      const g2 = c.createLinearGradient(0, -20, 0, 20);
      g2.addColorStop(0, '#FFBE0B');
      g2.addColorStop(1, '#FF3366');
      c.strokeText(this.combo + ' KOMBO', 0, 0);
      c.fillStyle = g2;
      c.fillText(this.combo + ' KOMBO', 0, 0);
      c.restore();
    }

    /* Label tombol jalur */
    c.font = 'bold 18px Fredoka, sans-serif';
    c.textAlign = 'center';
    for (let i = 0; i < 4; i++) {
      c.fillStyle = 'rgba(245,230,200,0.5)';
      c.fillText(['D', 'F', 'J', 'K'][i], i * laneW + laneW / 2, CANVAS_H - 18);
    }

    /* Bar kemajuan */
    const prog = Math.min(1, Math.max(0, this.elapsed / this.endTime));
    c.fillStyle = 'rgba(245,230,200,0.1)';
    c.fillRect(16, 16, CANVAS_W - 32, 8);
    c.fillStyle = '#AAFF00';
    this.rr(c, 16, 16, Math.max(0, (CANVAS_W - 32) * prog), 8, 4);
    c.fill();

    /* Hitung mundur */
    if (this.countingDown) {
      c.fillStyle = 'rgba(13,13,18,0.65)';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const num = Math.ceil(this.countdownMs / 700);
      const label = num > 0 ? String(num) : 'MULAI!';
      c.save();
      c.translate(CANVAS_W / 2, CANVAS_H / 2);
      
      if (!this.motionOff) {
        const phase = (this.countdownMs % 700) / 700;
        c.scale(1 + (1 - phase) * 0.5, 1 + (1 - phase) * 0.5);
        c.globalAlpha = phase * 0.9 + 0.1;
      } else {
        c.globalAlpha = 1;
      }
      
      c.font = 'bold 120px Fredoka, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.strokeStyle = '#0D0D12';
      c.strokeText(label, 0, 0);
      c.fillStyle = label === 'MULAI!' ? '#AAFF00' : '#FFBE0B';
      c.fillText(label, 0, 0);
      c.restore();
      c.globalAlpha = 1;
      c.textBaseline = 'alphabetic';
      c.font = 'bold 18px Fredoka, sans-serif';
      c.fillStyle = 'rgba(245,230,200,0.8)';
      c.textAlign = 'center';
      c.fillText('Bersiaplah', CANVAS_W / 2, CANVAS_H / 2 + 90);
    }

    /* Overlay jeda */
    if (this.paused) {
      c.fillStyle = 'rgba(13,13,18,0.75)';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.fillStyle = '#F5E6C8';
      c.font = 'bold 56px Fredoka, sans-serif';
      c.textAlign = 'center';
      c.fillText('DIJEDA', CANVAS_W / 2, CANVAS_H / 2);
      c.font = '600 18px "Plus Jakarta Sans", sans-serif';
      c.fillStyle = 'rgba(245,230,200,0.6)';
      c.fillText('Tekan Spasi atau tap jeda untuk lanjut', CANVAS_W / 2, CANVAS_H / 2 + 36);
    }

    c.restore();
  }
}