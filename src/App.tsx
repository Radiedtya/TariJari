import { useState, useRef, useEffect, useCallback } from 'react';
import {
  GameEngine, LEVELS, LANE_KEYS, CANVAS_W,
  ensureAudio, type GameResult,
} from './lib/game';

/* ===== Pemetaan warna level ke kelas Tailwind ===== */
const COLOR_BG: Record<string, string> = {
  merah: 'bg-merah',
  emas: 'bg-emas',
  hijau: 'bg-hijau',
  neon: 'bg-neon',
};
const COLOR_TX: Record<string, string> = {
  merah: 'text-white',
  emas: 'text-dark',
  hijau: 'text-dark',
  neon: 'text-dark',
};
const LANE_BTN_BG = ['bg-merah text-white', 'bg-emas text-dark', 'bg-hijau text-dark', 'bg-neon text-dark'];

/* ===== Komponen ikon SVG ===== */
function IconBack() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function IconSound() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 5a10 10 0 010 14M15.5 8.5a5 5 0 010 7" />
    </svg>
  );
}
function IconMotion() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" strokeLinecap="round">
      <path d="M10 4v16M18 4v16" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm0 2a3 3 0 013 3v3H9V6a3 3 0 013-3z" />
    </svg>
  );
}
function IconStar({ filled, color: _color }: { filled: boolean; color: string }) {
  return (
    <svg width="20" height="20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: filled ? 1 : 0.35 }}>
      <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" strokeLinejoin="round" />
    </svg>
  );
}
function IconBigStar({ filled, color: _color }: { filled: boolean; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="54" height="54" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
    </svg>
  );
}

/* ===== Komponen utama ===== */
export default function App() {
  /* -- State -- */
  const [screen, setScreen] = useState<'start' | 'levels' | 'game' | 'results'>('start');
  const [currentLevelId, setCurrentLevelId] = useState<number>(1);
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1]);
  const [highScores, setHighScores] = useState<Record<number, number>>({});
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [motionReduced, setMotionReduced] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [hud, setHud] = useState({ score: 0, combo: 0, acc: 100, lives: 3 });
  const [result, setResult] = useState<GameResult | null>(null);
  const [resultGameOver, setResultGameOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* -- Toast -- */
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current ?? undefined);
    toastTimer.current = setTimeout(() => setToastShow(false), 1800);
  }, []);

  /* -- Navigasi layar -- */
  const goStart = useCallback(() => setScreen('start'), []);
  const goLevels = useCallback(() => setScreen('levels'), []);

  /* -- Mulai level -- */
  const startLevel = useCallback((id: number) => {
    ensureAudio();
    const level = LEVELS.find((l) => l.id === id);
    if (!level || !canvasRef.current) return;
    setCurrentLevelId(id);
    setResult(null);
    setHud({ score: 0, combo: 0, acc: 100, lives: 3 });
    setScreen('game');

    if (gameRef.current) gameRef.current.stop();

    gameRef.current = new GameEngine(canvasRef.current, level, {
      onGameOver: (r, isGameOver) => {
        setResult(r);
        setResultGameOver(isGameOver);
        if (!isGameOver) {
          setHighScores((prev) => {
            const next = { ...prev };
            if (!next[id] || r.score > next[id]) next[id] = r.score;
            return next;
          });
          const nextId = id + 1;
          if (nextId <= LEVELS.length) {
            setUnlockedLevels((prev) => {
              if (prev.includes(nextId)) return prev;
              setTimeout(() => showToast('Level berikutnya terbuka!'), 600);
              return [...prev, nextId];
            });
          }
        }
        setScreen('results');
      },
      onUpdateHUD: (score, combo, acc, lives) => {
        setHud({ score, combo, acc, lives });
      },
    }, audioEnabled, motionReduced);

    gameRef.current.start();
  }, [audioEnabled, motionReduced, showToast]);

  /* -- Kontrol game -- */
  const quitGame = useCallback(() => {
    if (gameRef.current) gameRef.current.stop();
    gameRef.current = null;
    goLevels();
    showToast('Level keluar');
  }, [goLevels, showToast]);

  const togglePause = useCallback(() => {
    if (!gameRef.current || !gameRef.current.running) return;
    if (gameRef.current.paused) {
      gameRef.current.resume();
      showToast('Dilanjutkan');
    } else {
      gameRef.current.pause();
      showToast('Dijeda');
    }
  }, [showToast]);

  const replayLevel = useCallback(() => {
    startLevel(currentLevelId);
  }, [startLevel, currentLevelId]);

  const nextLevel = useCallback(() => {
    const n = currentLevelId + 1;
    if (n <= LEVELS.length) startLevel(n);
    else { showToast('Semua level selesai — master!'); goLevels(); }
  }, [currentLevelId, startLevel, goLevels, showToast]);

  /* -- Sinkronisasi opsi ke engine aktif & CSS -- */
  useEffect(() => {
    if (gameRef.current) gameRef.current.setAudioEnabled(audioEnabled);
  }, [audioEnabled]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.setMotionReduced(motionReduced);
    document.body.classList.toggle('reduced-motion', motionReduced);
  }, [motionReduced]);

  /* -- Event keyboard -- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (screen === 'game' && gameRef.current) {
        const lane = LANE_KEYS.indexOf(e.key.toLowerCase());
        if (lane >= 0) { e.preventDefault(); gameRef.current.handleKey(lane); return; }
        if (e.key === ' ') { e.preventDefault(); togglePause(); return; }
        if (e.key === 'Escape') { quitGame(); return; }
      }
      if (screen === 'start' && e.key === 'Enter') goLevels();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [screen, togglePause, quitGame, goLevels]);

  /* -- Klik pada canvas -- */
  const handleCanvasPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (!g || !g.running || g.paused || g.countingDown) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const lane = Math.max(0, Math.min(3, Math.floor(x / (CANVAS_W / 4))));
    g.handleKey(lane);
  }, []);

  /* -- Sentuh tombol jalur -- */
  const handleLaneBtn = useCallback((lane: number) => {
    const g = gameRef.current;
    if (!g || !g.running) return;
    g.handleKey(lane);
  }, []);

  /* -- Kalkulasi hasil -- */
  const resultTitle = resultGameOver
    ? 'Nyawa habis'
    : (result?.accuracy ?? 0) >= 92
      ? 'Sempurna!'
      : (result?.accuracy ?? 0) >= 75
        ? 'Level Selesai!'
        : 'Tuntas!';

  const resultTitleColor = resultGameOver
    ? 'text-merah'
    : (result?.accuracy ?? 0) >= 92
      ? 'text-hijau'
      : 'text-cream';

  const resultSubtitle = resultGameOver
    ? 'Permainan berakhir lebih cepat — coba lagi.'
    : (result?.accuracy ?? 0) >= 92
      ? 'Pengaturan waktu luar biasa. Main lagi?'
      : (result?.accuracy ?? 0) >= 75
        ? 'Permainan solid. Coba lagi untuk skor lebih tinggi.'
        : 'Usaha bagus — latihan membuat sempurna.';

  let stars = 0;
  if (result && !resultGameOver) {
    if (result.score > 1200) stars = 1;
    if (result.score > 3500) stars = 2;
    if (result.score > 6500 && result.accuracy > 85) stars = 3;
  }

  const hearts = '♥'.repeat(Math.max(0, hud.lives)) + '♡'.repeat(Math.max(0, 3 - hud.lives));

  return (
    <>
      {/* ===== Dekorasi mengambang ===== */}
      <div className="float-shape" style={{ top: '8%', left: '3%', width: 78, height: 78, background: 'rgba(255,51,102,0.25)', borderRadius: '24%', animation: 'float1 9s ease-in-out infinite' }} />
      <div className="float-shape" style={{ top: '18%', right: '5%', width: 60, height: 60, background: 'rgba(15,255,207,0.15)', borderRadius: '50%', animation: 'float2 10s ease-in-out infinite' }} />
      <div className="float-shape" style={{ bottom: '32%', left: '2%', width: 70, height: 70, background: 'rgba(255,190,11,0.18)', borderRadius: '18%', animation: 'float1 11s ease-in-out infinite' }} />
      <div className="float-shape" style={{ bottom: '12%', right: '3%', width: 54, height: 54, background: 'rgba(170,255,0,0.15)', borderRadius: '30% 70% 70% 30%', animation: 'float2 8s ease-in-out infinite' }} />

      {/* ===== Header ===== */}
      <header className="relative z-10 max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-merah border-[3.5px] border-cream rounded-2xl shadow-[4px_4px_0_rgba(245,230,200,0.25)] flex items-center justify-center pulse-live">
            <div className="flex gap-1 items-end h-5">
              <span className="block w-1 bg-white rounded-full" style={{ height: '40%' }} />
              <span className="block w-1 bg-white rounded-full" style={{ height: '90%' }} />
              <span className="block w-1 bg-white rounded-full" style={{ height: '60%' }} />
              <span className="block w-1 bg-white rounded-full" style={{ height: '100%' }} />
            </div>
          </div>
          <div>
            <div className="font-display font-bold text-2xl leading-none">TariJari</div>
            <div className="text-[11px] font-semibold tracking-wide opacity-50 mt-1">Game ritme saku</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`chunky-btn icon ${!audioEnabled ? 'opacity-40' : ''}`}
            aria-label="Toggle suara"
            title="Suara"
            onClick={() => setAudioEnabled((v) => !v)}
          >
            <IconSound />
          </button>
          <button
            className={`chunky-btn icon ${motionReduced ? 'opacity-40' : ''}`}
            aria-label="Toggle kurangi gerakan"
            title="Kurangi gerakan"
            onClick={() => setMotionReduced((v) => !v)}
          >
            <IconMotion />
          </button>
        </div>
      </header>

      {/* ===== Hero ===== */}
      {screen === 'start' && (
        <section className="relative z-10 max-w-5xl mx-auto px-5 pt-4 pb-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emas border-[3px] border-cream rounded-full font-display font-semibold text-sm shadow-[3px_3px_0_rgba(245,230,200,0.25)] text-dark mb-6">
            <span className="w-2 h-2 rounded-full bg-merah" />
            Ritme kasual · sesi 60 detik <u className=''>v1.2</u>
          </span>
          <div className="eq mx-auto mb-5">
            <span style={{ background: '#FF3366', animationDelay: '-.2s' }} />
            <span style={{ background: '#FFBE0B', animationDelay: '-.5s' }} />
            <span style={{ background: '#AAFF00', animationDelay: '-.8s' }} />
            <span style={{ background: '#0FFFCF', animationDelay: '-.3s' }} />
            <span style={{ background: '#FF3366', animationDelay: '-.6s' }} />
            <span style={{ background: '#FFBE0B', animationDelay: '-.1s' }} />
            <span style={{ background: '#AAFF00', animationDelay: '-.9s' }} />
          </div>
          <h1 className="font-display font-bold text-6xl md:text-8xl leading-[.95] mb-4">
            Tari<span className="text-merah">Jari</span>
          </h1>
          <p className="font-display text-2xl md:text-3xl font-medium mb-3">fokus, cepat, dan menyenangkan.</p>
          <p className="text-base md:text-lg opacity-60 max-w-xl mx-auto leading-relaxed">
            Tekan nada yang jatuh di empat jalur. Tumpuk kombo, buka level baru, dan kejar permainan sempurna — tanpa tutorial, tanpa hambatan, hanya ritme.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <button className="chunky-btn primary text-lg" onClick={goLevels}>Mulai</button>
            <button className="chunky-btn cemas text-lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Cara Bermain</button>
          </div>
        </section>
      )}

      {/* ===== Area permainan ===== */}
      <section className="relative z-10 max-w-5xl mx-auto px-5 pb-14">
        <div className="chunky-card p-5 md:p-7 relative">

          {/* HUD desktop */}
          {screen === 'game' && (
            <div className="hidden md:grid grid-cols-4 gap-3 mb-5">
              <div className="hud-pill bg-dark text-cream">
                <div className="label">Skor</div>
                <div className="value">{hud.score}</div>
              </div>
              <div className="hud-pill bg-emas text-dark">
                <div className="label">Kombo</div>
                <div className="value">{hud.combo}×</div>
              </div>
              <div className="hud-pill bg-neon text-dark">
                <div className="label">Akurasi</div>
                <div className="value">{hud.acc}%</div>
              </div>
              <div className="hud-pill bg-merah text-white">
                <div className="label">Nyawa</div>
                <div className="value">{hearts}</div>
              </div>
            </div>
          )}

          <div className="relative min-h-150 flex items-center justify-center">

            {/* ===== Layar Mulai ===== */}
            <div className={`screen ${screen === 'start' ? 'active' : ''} flex-col items-center text-center py-6 w-full`}>
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-hijau border-[3px] border-cream rounded-full text-xs font-bold uppercase tracking-wide shadow-[2px_2px_0_rgba(245,230,200,0.25)] text-dark mb-4">
                Siap kapan saja
              </span>
              <h2 className="font-display font-bold text-4xl md:text-5xl mb-3">Pilih temponya</h2>
              <p className="opacity-60 max-w-md mb-6">Empat jalur. Empat tombol. Saat nada mencapai garis, tekan tombolnya. Tekan tepat untuk menjaga kombo hidup.</p>

              <div className="flex gap-3 mb-2">
                <div className="key-cap bg-merah text-white">D</div>
                <div className="key-cap bg-emas text-dark">F</div>
                <div className="key-cap bg-hijau text-dark">J</div>
                <div className="key-cap bg-neon text-dark">K</div>
              </div>
              <p className="text-xs opacity-50 mb-6">atau tap jalurnya di layar sentuh</p>

              <div className="flex flex-wrap gap-3 justify-center">
                <button className="chunky-btn primary text-lg" onClick={goLevels}>Main Sekarang</button>
                <button className="chunky-btn" onClick={() => startLevel(1)}>Mulai Cepat · Level 1</button>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-8 w-full max-w-md text-center">
                <div className="bg-hijau border-[3px] border-cream rounded-xl p-2 shadow-[3px_3px_0_rgba(245,230,200,0.25)] text-dark">
                  <div className="text-[10px] font-bold uppercase opacity-70">Sempurna</div>
                  <div className="font-display font-bold text-xl">+100</div>
                </div>
                <div className="bg-emas border-[3px] border-cream rounded-xl p-2 shadow-[3px_3px_0_rgba(245,230,200,0.25)] text-dark">
                  <div className="text-[10px] font-bold uppercase opacity-70">Bagus</div>
                  <div className="font-display font-bold text-xl">+50</div>
                </div>
                <div className="bg-merah text-white border-[3px] border-cream rounded-xl p-2 shadow-[3px_3px_0_rgba(245,230,200,0.25)]">
                  <div className="text-[10px] font-bold uppercase opacity-70">Meleset</div>
                  <div className="font-display font-bold text-xl">−1♥</div>
                </div>
              </div>
            </div>

            {/* ===== Layar Pilih Level ===== */}
            <div className={`screen ${screen === 'levels' ? 'active' : ''} flex-col w-full`}>
              <div className="flex items-center justify-between mb-5">
                <button className="chunky-btn icon" onClick={goStart} aria-label="Kembali"><IconBack /></button>
                <h2 className="font-display font-bold text-3xl">Pilih level</h2>
                <div className="w-12" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {LEVELS.map((level) => {
                  const unlocked = unlockedLevels.includes(level.id);
                  const hs = highScores[level.id] || 0;
                  const s = hs > 5000 ? 3 : hs > 2000 ? 2 : hs > 0 ? 1 : 0;
                  return (
                    <button
                      key={level.id}
                      className={`level-card ${unlocked ? '' : 'locked'} ${COLOR_BG[level.color] || ''} ${COLOR_TX[level.color] || ''}`}
                      disabled={!unlocked}
                      onClick={() => {
                        if (unlocked) startLevel(level.id);
                        else showToast('Terkunci — selesaikan level sebelumnya dulu');
                      }}
                    >
                      <div className="pattern" />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <div className="font-display font-bold text-3xl leading-none">#{level.id}</div>
                          {unlocked ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ background: 'rgba(0,0,0,0.15)' }}>
                              {level.difficulty}
                            </span>
                          ) : (
                            <IconLock />
                          )}
                        </div>
                        <div className="font-display font-bold text-xl mb-1">{level.name}</div>
                        <div className="text-xs font-semibold opacity-80 mb-3">{level.bpm} BPM · {level.duration}s</div>
                        {unlocked ? (
                          <div className="flex gap-1 items-center">
                            {[1, 2, 3].map((i) => (
                              <IconStar key={i} filled={i <= s} color={level.color} />
                            ))}
                            {hs > 0 && <span className="text-xs font-bold ml-2 opacity-80">{hs}</span>}
                          </div>
                        ) : (
                          <div className="text-xs font-bold opacity-60">Selesaikan level sebelumnya</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ===== Layar Permainan ===== */}
            <div className={`screen ${screen === 'game' ? 'active' : ''} flex-col items-center w-full`}>
              <div className="w-full max-w-120">
                {/* HUD mobile */}
                <div className="md:hidden grid grid-cols-4 gap-2 mb-3">
                  <div className="hud-pill bg-dark text-cream text-center" style={{ minWidth: 0, padding: '6px 4px' }}>
                    <div className="label" style={{ fontSize: 9 }}>Skor</div>
                    <div className="value" style={{ fontSize: 16 }}>{hud.score}</div>
                  </div>
                  <div className="hud-pill bg-emas text-dark text-center" style={{ minWidth: 0, padding: '6px 4px' }}>
                    <div className="label" style={{ fontSize: 9 }}>Kombo</div>
                    <div className="value" style={{ fontSize: 16 }}>{hud.combo}×</div>
                  </div>
                  <div className="hud-pill bg-neon text-dark text-center" style={{ minWidth: 0, padding: '6px 4px' }}>
                    <div className="label" style={{ fontSize: 9 }}>Akurasi</div>
                    <div className="value" style={{ fontSize: 16 }}>{hud.acc}%</div>
                  </div>
                  <div className="hud-pill bg-merah text-white text-center" style={{ minWidth: 0, padding: '6px 4px' }}>
                    <div className="label" style={{ fontSize: 9 }}>Nyawa</div>
                    <div className="value" style={{ fontSize: 16 }}>{hearts}</div>
                  </div>
                </div>

                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="game-canvas"
                    width={480}
                    height={680}
                    onPointerDown={handleCanvasPointer}
                  />
                </div>

                {/* Tombol sentuh jalur */}
                <div className="lane-touch grid-cols-4 gap-2 mt-3">
                  {[0, 1, 2, 3].map((i) => (
                    <button
                      key={i}
                      className={`chunky-btn ${LANE_BTN_BG[i]}`}
                      style={{ padding: '18px 0' }}
                      onPointerDown={(e) => { e.preventDefault(); handleLaneBtn(i); }}
                    >
                      {['D', 'F', 'J', 'K'][i]}
                    </button>
                  ))}
                </div>

                <div className="hidden md:flex items-center justify-between mt-4">
                  <button className="chunky-btn icon" onClick={quitGame} aria-label="Keluar" title="Keluar (Esc)">
                    <IconClose />
                  </button>
                  <div className="text-sm font-semibold opacity-60">
                    Tekan <span className="font-mono font-bold">D F J K</span> · <span className="font-mono font-bold">Spasi</span> untuk jeda
                  </div>
                  <button className="chunky-btn icon" onClick={togglePause} aria-label="Jeda" title="Jeda (Spasi)">
                    <IconPause />
                  </button>
                </div>
              </div>
            </div>

            {/* ===== Layar Hasil ===== */}
            <div className={`screen ${screen === 'results' ? 'active' : ''} flex-col items-center text-center w-full py-4`}>
              <div className={`font-display font-bold text-4xl md:text-5xl mb-2 ${resultTitleColor}`}>{resultTitle}</div>
              <div className="opacity-60 mb-5">{resultSubtitle}</div>

              <div className="flex justify-center gap-2 mb-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`result-star ${i <= stars ? 'lit' : ''}`} style={{ color: i <= stars ? '#FFBE0B' : '#3a3a4a' }}>
                    <IconBigStar filled={i <= stars} color="" />
                  </div>
                ))}
              </div>

              <div className="bg-dark text-cream border-[3.5px] border-cream rounded-2xl px-6 py-3 mb-5 shadow-[5px_5px_0_rgba(255,51,102,0.6)]">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Skor Akhir</div>
                <div className="font-display text-5xl font-bold leading-none">{result?.score ?? 0}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
                <div className="bg-hijau border-[3px] border-cream rounded-xl p-3 shadow-[3px_3px_0_rgba(245,230,200,0.25)] text-dark">
                  <div className="text-[10px] font-bold uppercase opacity-70">Sempurna</div>
                  <div className="font-display text-2xl font-bold">{result?.hits.perfect ?? 0}</div>
                </div>
                <div className="bg-emas border-[3px] border-cream rounded-xl p-3 shadow-[3px_3px_0_rgba(245,230,200,0.25)] text-dark">
                  <div className="text-[10px] font-bold uppercase opacity-70">Bagus</div>
                  <div className="font-display text-2xl font-bold">{result?.hits.good ?? 0}</div>
                </div>
                <div className="bg-merah text-white border-[3px] border-cream rounded-xl p-3 shadow-[3px_3px_0_rgba(245,230,200,0.25)]">
                  <div className="text-[10px] font-bold uppercase opacity-70">Meleset</div>
                  <div className="font-display text-2xl font-bold">{result?.hits.miss ?? 0}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-6 text-sm">
                <div className="bg-surface border-[3px] border-cream rounded-xl p-2 shadow-[2px_2px_0_rgba(245,230,200,0.2)]">
                  <span className="opacity-50">Max kombo</span>
                  <span className="font-display font-bold text-lg ml-1">{result?.maxCombo ?? 0}×</span>
                </div>
                <div className="bg-surface border-[3px] border-cream rounded-xl p-2 shadow-[2px_2px_0_rgba(245,230,200,0.2)]">
                  <span className="opacity-50">Akurasi</span>
                  <span className="font-display font-bold text-lg ml-1">{result?.accuracy ?? 0}%</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                <button className="chunky-btn" onClick={replayLevel}>Main Lagi</button>
                {!resultGameOver && currentLevelId < LEVELS.length && (
                  <button className="chunky-btn primary" onClick={nextLevel}>Level Berikutnya</button>
                )}
                <button className="chunky-btn cemas" onClick={goLevels}>Pilih Level</button>
              </div>
            </div>

          </div>
        </div>

        <p className="text-center text-xs opacity-40 mt-4">
          Tips: gunakan <span className="font-mono font-bold">D F J K</span> di keyboard, atau tap jalurnya di layar sentuh.
        </p>
      </section>

      {/* ===== Cara Bermain ===== */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-5 pb-16">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-hijau border-[3px] border-cream rounded-full font-display font-semibold text-sm shadow-[3px_3px_0_rgba(245,230,200,0.25)] text-dark mb-4">
            Cara bermain
          </span>
          <h2 className="font-display font-bold text-4xl md:text-5xl">Tiga aturan. Itu saja.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          <div className="chunky-card p-6">
            <div className="w-14 h-14 bg-merah border-[3px] border-cream rounded-2xl flex items-center justify-center mb-4 shadow-[3px_3px_0_rgba(245,230,200,0.25)]">
              <span className="font-display font-bold text-2xl text-white">1</span>
            </div>
            <h3 className="font-display font-bold text-2xl mb-2">Perhatikan jalurnya</h3>
            <p className="opacity-60 leading-relaxed">Nada jatuh di empat jalur berwarna. Setiap jalur terhubung ke tombol — D, F, J, atau K — atau cukup tap jalurnya langsung.</p>
          </div>
          <div className="chunky-card p-6">
            <div className="w-14 h-14 bg-emas border-[3px] border-cream rounded-2xl flex items-center justify-center mb-4 shadow-[3px_3px_0_rgba(245,230,200,0.25)]">
              <span className="font-display font-bold text-2xl text-dark">2</span>
            </div>
            <h3 className="font-display font-bold text-2xl mb-2">Tekan garisnya</h3>
            <p className="opacity-60 leading-relaxed">Saat nada mencapai garis terang di bawah, tekan tombolnya. Semakin tepat waktu, semakin banyak poin yang kamu dapatkan.</p>
          </div>
          <div className="chunky-card p-6">
            <div className="w-14 h-14 bg-hijau border-[3px] border-cream rounded-2xl flex items-center justify-center mb-4 shadow-[3px_3px_0_rgba(245,230,200,0.25)]">
              <span className="font-display font-bold text-2xl text-dark">3</span>
            </div>
            <h3 className="font-display font-bold text-2xl mb-2">Jaga kombonya</h3>
            <p className="opacity-60 leading-relaxed">Setiap tekanan menaikkan kombo. Melewatkan tiga nada mengakhiri level — tapi kamu selalu bisa mencoba lagi.</p>
          </div>
        </div>

        <div className="chunky-card p-7">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
            <div>
              <div className="font-display font-bold text-5xl text-merah">4</div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-50 mt-1">Jalur</div>
            </div>
            <div>
              <div className="font-display font-bold text-5xl text-emas">15</div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-50 mt-1">Level</div>
            </div>
            <div>
              <div className="font-display font-bold text-5xl text-hijau">∞</div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-50 mt-1">Batas kombo</div>
            </div>
            <div>
              <div className="font-display font-bold text-5xl text-neon">60s</div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-50 mt-1">Per sesi</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 max-w-6xl mx-auto px-5 py-10">
        <div className="chunky-card p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left">
              <a
                href="https://xoryn.nlfts.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-display font-bold text-2xl text-cream hover:text-neon transition-colors duration-200"
              >
                Radiedtya
              </a>
              
              <p className="text-sm font-semibold opacity-50 max-w-xs">
                &copy; 2026 TariJari | All rights reserved.
              </p>
            </div>

            {/* Medsos */}
            <div className="flex items-center gap-3">
              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/in/radiedtya-pratama-100009393"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-11 h-11 flex items-center justify-center rounded-xl border-[3px] border-cream bg-surface shadow-[3px_3px_0_rgba(245,230,200,0.2)] text-cream hover:bg-neon hover:text-dark hover:shadow-[3px_3px_0_rgba(15,255,207,0.4)] transition-all duration-150"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/Radiedtya"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="w-11 h-11 flex items-center justify-center rounded-xl border-[3px] border-cream bg-surface shadow-[3px_3px_0_rgba(245,230,200,0.2)] text-cream hover:bg-neon hover:text-dark hover:shadow-[3px_3px_0_rgba(15,255,207,0.4)] transition-all duration-150"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://instagram.com/rdiettyaa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-11 h-11 flex items-center justify-center rounded-xl border-[3px] border-cream bg-surface shadow-[3px_3px_0_rgba(245,230,200,0.2)] text-cream hover:bg-neon hover:text-dark hover:shadow-[3px_3px_0_rgba(15,255,207,0.4)] transition-all duration-150"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z"/>
                </svg>
              </a>

              {/* X */}
              <a
                href="https://x.com/rdityaprtmaa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="w-11 h-11 flex items-center justify-center rounded-xl border-[3px] border-cream bg-surface shadow-[3px_3px_0_rgba(245,230,200,0.2)] text-cream hover:bg-neon hover:text-dark hover:shadow-[3px_3px_0_rgba(15,255,207,0.4)] transition-all duration-150"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== Toast ===== */}
      <div className={`toast-el ${toastShow ? 'show' : ''}`}>{toastMsg}</div>
    </>
  );
}