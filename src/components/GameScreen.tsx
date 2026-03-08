import { useEffect, useRef, useState, useCallback } from 'react';
import { AppBar, Toolbar, IconButton, Typography, Box } from '@mui/material';
import { ArrowBack, IosShare } from '@mui/icons-material';
import { type CardContent } from '../types';

interface CardColors {
  primary: string;
  secondary: string;
  text: string;
}

interface GameScreenProps {
  card: CardContent;
  cardColors: CardColors;
  onClose: () => void;
  onShortcut: () => void;
  onOpenLocation: () => void;
}

// ─── Debug logging ─────────────────────────────────────────────────────────────
const DBG = true; // flip to false to silence
const dbg = (...args: unknown[]) => { if (DBG) console.log('[Game]', ...args); };

// ─── Game constants ────────────────────────────────────────────────────────────
const PW = 72;          // player width  (card-shaped rectangle)
const PH = 38;          // player height
const GRAVITY        = 0.52;
const JUMP_VEL       = -13.5;
const DBL_JUMP_VEL   = -19.5;   // stronger boost for double jump
const PSPEED         = 5.5;
const GROUND_OFF     = 64;  // px from canvas bottom
const PU_W = 42;             // power-up rect width
const PU_H = 28;             // power-up rect height
const PU_SPAWN_INT   = 310;  // frames between power-up spawns

const CIRCLE_DEFS = [
  { value: 1,  r: 16, color: '#2ecc71', glowColor: '#27ae6099' },
  { value: 2,  r: 21, color: '#f1c40f', glowColor: '#f39c1299' },
  { value: 5,  r: 27, color: '#e67e22', glowColor: '#d35400aa' },
  { value: 10, r: 34, color: '#e74c3c', glowColor: '#c0392bbb' },
] as const;

// lower values are weighted to appear more frequently
const VALUE_POOL = [1, 1, 1, 2, 2, 2, 5, 5, 10];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface GamePlayer {
  x: number; y: number;
  velX: number; velY: number;
  onGround: boolean;
  health: number;
  hitFlash: number;
  jumpPressed: boolean;
  doubleJumps: number;
}

interface PowerUp {
  id: number;
  x: number; y: number;
  velX: number;
  bob: number; // oscillation phase
}

interface GameBall {
  id: number; x: number; y: number;
  r: number; velX: number; velY: number;
  value: number; color: string; glowColor: string;
  angle: number;
}

type Phase = 'intro' | 'ready' | 'playing' | 'dead';

// ─── Component ─────────────────────────────────────────────────────────────────
function GameScreen({ card, cardColors, onClose, onShortcut }: GameScreenProps) {
  const level = card.level ?? 0;

  const [phase, setPhase]                     = useState<Phase>('intro');
  const [displayHealth, setDisplayHealth]     = useState(100);
  const [displayDoubleJumps, setDisplayDoubleJumps] = useState(0);
  const [deathCount, setDeathCount]           = useState(0);

  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const phaseRef        = useRef<Phase>('intro');
  const playerRef       = useRef<GamePlayer>({ x: 0, y: 0, velX: 0, velY: 0, onGround: false, health: 100, hitFlash: 0, jumpPressed: false, doubleJumps: 0 });
  const ballsRef        = useRef<GameBall[]>([]);
  const powerUpsRef     = useRef<PowerUp[]>([]);
  const powerUpIdRef    = useRef(0);
  const powerUpTimerRef = useRef(0);
  const keysRef         = useRef<Set<string>>(new Set());
  const rafRef          = useRef<number>(0);
  const spawnTimerRef   = useRef(0);
  const ballIdRef       = useRef(0);
  const prevHealthRef   = useRef(100);

  // ── Intro → ready → playing ──────────────────────────────────────────────────
  useEffect(() => {
    dbg('Mount — starting intro sequence');
    const t1 = setTimeout(() => {
      dbg('Phase → ready');
      setPhase('ready'); phaseRef.current = 'ready';
      const t2 = setTimeout(() => {
        dbg('Phase → playing (first start)');
        setPhase('playing'); phaseRef.current = 'playing';
      }, 1400);
      return () => clearTimeout(t2);
    }, 2600);
    return () => clearTimeout(t1);
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','Space','ArrowDown'].includes(e.code)) e.preventDefault();
      keysRef.current.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ── Canvas HiDPI resize ──────────────────────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rawW = canvas.offsetWidth;
    const rawH = canvas.offsetHeight;
    const width  = rawW || window.innerWidth;
    const height = rawH || (window.innerHeight - 64);
    const prevW = canvas.width, prevH = canvas.height;
    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const computedGndY = height - GROUND_OFF;
    dbg(
      `resizeCanvas: offset=${rawW}x${rawH} fallback=${!rawW||!rawH}`,
      `canvas=${canvas.width}x${canvas.height} (was ${prevW}x${prevH})`,
      `dpr=${dpr} logical=${width}x${height} gndY=${computedGndY}`,
    );
    if (computedGndY <= 0) {
      console.warn('[Game] ⚠ gndY is non-positive! Balls will instantly hit player.', { width, height, GROUND_OFF, computedGndY });
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const obs = new ResizeObserver(resizeCanvas);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [resizeCanvas]);

  // ── Game loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    // Ensure canvas dimensions are correct before starting — guards against the
    // case where resizeCanvas ran while offsetHeight was 0 (flexbox not settled).
    resizeCanvas();

    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    dbg(`Game loop effect fired — phase=${phase} deathCount=${deathCount}`);
    const dpr    = () => window.devicePixelRatio || 1;
    const cW     = () => canvas.width  / dpr();
    const cH     = () => canvas.height / dpr();
    const gndY   = () => cH() - GROUND_OFF;

    // ── reset helpers ──────────────────────────────────────────────────────────
    const resetPlayer = () => {
      const p = playerRef.current;
      p.x = 90; p.y = gndY() - PH;
      p.velX = 0; p.velY = 0; p.onGround = true;
      p.health = 100; p.hitFlash = 0; p.jumpPressed = false;
      p.doubleJumps = 0;
      prevHealthRef.current = 100;
      setDisplayHealth(100);
      setDisplayDoubleJumps(0);
    };

    resetPlayer();
    ballsRef.current      = [];
    powerUpsRef.current   = [];
    spawnTimerRef.current = 0;
    powerUpTimerRef.current = 0;

    const spawnInterval = () => Math.max(48, 108 - level * 8);

    const startGndY = gndY();
    const startCW   = cW();
    const startCH   = cH();
    dbg(`Loop start — canvas logical ${startCW.toFixed(1)}x${startCH.toFixed(1)} gndY=${startGndY.toFixed(1)} spawnInterval=${spawnInterval()}f level=${level}`);
    if (startGndY <= 40) {
      console.warn('[Game] ⚠ gndY suspiciously low at loop start! Expect instant death.', { startGndY, startCH, canvasH: canvas.height });
    }

    const spawnBall = () => {
      const poolValue = VALUE_POOL[Math.floor(Math.random() * VALUE_POOL.length)];
      const def = CIRCLE_DEFS.find(d => d.value === poolValue)!;
      if (!def) { console.error('[Game] spawnBall: no def for poolValue', poolValue); return; }
      const gY   = gndY();
      const velX = -(2.4 + level * 0.35 + Math.random() * 2.2);
      const airSpawn = Math.random() > 0.45;
      const maxAirH  = Math.min(cH() * 0.55, gY - def.r * 2 - 10); // never above the canvas
      const startY   = airSpawn ? gY - def.r - Math.random() * maxAirH : gY - def.r;
      const velY     = airSpawn ? (Math.random() - 0.5) * 5 : -(6 + Math.random() * 5.5);
      ballsRef.current.push({
        id: ballIdRef.current++,
        x: cW() + def.r + 20, y: startY,
        r: def.r, velX, velY,
        value: def.value, color: def.color, glowColor: def.glowColor,
        angle: 0,
      });
    };

    const hitTest = (p: GamePlayer, b: GameBall) => {
      const cx = Math.max(p.x, Math.min(b.x, p.x + PW));
      const cy = Math.max(p.y, Math.min(b.y, p.y + PH));
      const dx = b.x - cx, dy = b.y - cy;
      return dx * dx + dy * dy < b.r * b.r;
    };

    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y,     x + w, y + r,     r);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x,     y + h, x,     y + h - r, r);
      ctx.lineTo(x, y + r); ctx.arcTo(x,     y,     x + r,   y,         r);
      ctx.closePath();
    };

    let lastTs = 0;
    let frameCount = 0;

    const loop = (ts: number) => {
      if (phaseRef.current !== 'playing') {
        dbg(`Loop exit at frame ${frameCount} — phaseRef=${phaseRef.current}`);
        return;
      }

      const dt = Math.min((ts - lastTs) / 16.667, 3);
      frameCount++;
      if (frameCount % 60 === 0) {
        dbg(`Frame ${frameCount} — dt=${dt.toFixed(2)} health=${playerRef.current.health.toFixed(1)} balls=${ballsRef.current.length} gndY=${gndY().toFixed(1)} cH=${cH().toFixed(1)}`);
      }
      lastTs = ts;

      const gY = gndY();
      const W  = cW();
      const p  = playerRef.current;
      const keys = keysRef.current;

      // ── input ──────────────────────────────────────────────────────────────
      p.velX = 0;
      if (keys.has('ArrowLeft'))  p.velX = -PSPEED;
      if (keys.has('ArrowRight')) p.velX =  PSPEED;
      const wantsJump = keys.has('ArrowUp') || keys.has('Space');
      if (wantsJump && !p.jumpPressed) {
        if (p.onGround) {
          p.velY = JUMP_VEL; p.onGround = false;
        } else if (p.doubleJumps > 0) {
          p.velY = DBL_JUMP_VEL;
          p.doubleJumps--;
          setDisplayDoubleJumps(p.doubleJumps);
        }
      }
      p.jumpPressed = wantsJump;

      // ── physics ────────────────────────────────────────────────────────────
      p.velY += GRAVITY * dt;
      p.x    += p.velX  * dt;
      p.y    += p.velY  * dt;
      if (p.y + PH >= gY) { p.y = gY - PH; p.velY = 0; p.onGround = true; } else p.onGround = false;
      p.x = Math.max(0, Math.min(W - PW, p.x));
      if (p.hitFlash > 0) p.hitFlash -= dt;

      // ── spawn balls ────────────────────────────────────────────────────────
      spawnTimerRef.current += dt;
      if (spawnTimerRef.current >= spawnInterval()) { spawnTimerRef.current = 0; spawnBall(); }

      // ── spawn power-ups ────────────────────────────────────────────────────
      powerUpTimerRef.current += dt;
      if (powerUpTimerRef.current >= PU_SPAWN_INT) {
        powerUpTimerRef.current = 0;
        // 80 % near ground (walkable), 20 % anywhere
        const nearGround = Math.random() < 0.8;
        const puY = nearGround
          ? gY - PU_H - Math.random() * 28          // just above floor
          : 30 + Math.random() * Math.max(0, gY - PU_H - 60); // full range
        powerUpsRef.current.push({
          id: powerUpIdRef.current++,
          x: W + PU_W + 10,
          y: puY,
          velX: -(2.2 + level * 0.2 + Math.random() * 1.2),
          bob: Math.random() * Math.PI * 2,
        });
      }

      // ── update balls ───────────────────────────────────────────────────────
      ballsRef.current = ballsRef.current.filter(b => {
        b.velY += GRAVITY * dt * 0.85;
        b.x    += b.velX * dt;
        b.y    += b.velY * dt;
        b.angle += (b.velX / b.r) * dt;

        // floor bounce
        if (b.y + b.r >= gY) {
          b.y    = gY - b.r;
          b.velY = -Math.abs(b.velY) * 0.62;
          if (Math.abs(b.velY) < 1.2) b.velY = 0;
        }
        // ceiling bounce
        if (b.y - b.r <= 0) {
          b.y    = b.r;
          b.velY = Math.abs(b.velY) * 0.75;
        }

        if (hitTest(p, b)) {
          p.health -= b.value;
          p.hitFlash = 14;
          const clamped = Math.max(0, Math.round(p.health));
          if (clamped !== prevHealthRef.current) {
            prevHealthRef.current = clamped;
            setDisplayHealth(clamped);
          }
          if (p.health <= 0) {
            dbg(`DEATH at frame ${frameCount} — ball value=${b.value} gndY=${gndY().toFixed(1)} cH=${cH().toFixed(1)} balls=${ballsRef.current.length}`);
            phaseRef.current = 'dead';
            setDeathCount(c => c + 1);
            setPhase('dead');
          }
          return false;
        }
        return b.x + b.r > -60;
      });

      // ── update power-ups ───────────────────────────────────────────────────
      powerUpsRef.current = powerUpsRef.current.filter(pu => {
        pu.x += pu.velX * dt;
        pu.bob += 0.06 * dt;

        // AABB hit test with player
        const hit = p.x < pu.x + PU_W && p.x + PW > pu.x &&
                    p.y < pu.y + PU_H && p.y + PH > pu.y;
        if (hit) {
          p.doubleJumps++;
          setDisplayDoubleJumps(p.doubleJumps);
          return false; // consume
        }
        return pu.x + PU_W > -40;
      });

      // ─────────────────────────────── DRAW ────────────────────────────────
      const H = cH();
      ctx.clearRect(0, 0, W, H);

      // background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#07011499'); bg.addColorStop(1, '#15043099');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.033)'; ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 60) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // ground glow + line
      const gg = ctx.createLinearGradient(0, gY - 14, 0, gY + 10);
      gg.addColorStop(0, cardColors.secondary + '55'); gg.addColorStop(1, 'transparent');
      ctx.fillStyle = gg; ctx.fillRect(0, gY - 14, W, 24);
      ctx.strokeStyle = cardColors.secondary + 'bb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(W, gY); ctx.stroke();

      // ── draw circles ────────────────────────────────────────────────────────
      for (const b of ballsRef.current) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.shadowColor = b.glowColor; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color + 'cc'; ctx.fill();
        ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.stroke();
        // shine
        ctx.shadowBlur = 0;
        const sh = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.35, 0, 0, 0, b.r);
        sh.addColorStop(0, 'rgba(255,255,255,0.32)'); sh.addColorStop(1, 'transparent');
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // value text (always upright)
        ctx.save();
        ctx.shadowColor = b.color; ctx.shadowBlur = 8;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(b.r * 0.74)}px system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(b.value), b.x, b.y);
        ctx.restore();
      }

      // ── draw power-ups ───────────────────────────────────────────────────────
      for (const pu of powerUpsRef.current) {
        const bobOffset = Math.sin(pu.bob) * 5;
        const rx = pu.x, ry = pu.y + bobOffset;
        ctx.save();
        // glow
        ctx.shadowColor = '#00e5ffcc'; ctx.shadowBlur = 18;
        // body fill
        ctx.fillStyle = '#003344cc';
        rr(rx, ry, PU_W, PU_H, 6); ctx.fill();
        // border
        ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2.5;
        rr(rx, ry, PU_W, PU_H, 6); ctx.stroke();
        // arrow ↑
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00e5ff';
        ctx.font = `bold ${Math.round(PU_H * 0.72)}px system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('↑', rx + PU_W / 2, ry + PU_H / 2);
        ctx.restore();
      }

      // ── draw player ──────────────────────────────────────────────────────────
      const px = p.x, py = p.y;
      const flash  = p.hitFlash > 0;
      const hPct   = Math.max(0, p.health) / 100;
      const hue    = Math.round(hPct * 120); // 120=green → 0=red

      ctx.save();
      ctx.shadowColor = flash ? '#ff4444cc' : cardColors.secondary + '88';
      ctx.shadowBlur  = flash ? 28 : 14;

      // body
      ctx.fillStyle = flash ? '#ff222288' : `hsla(${hue},70%,44%,0.88)`;
      rr(px, py, PW, PH, 7); ctx.fill();

      // border
      ctx.strokeStyle = flash ? '#ff4444' : cardColors.secondary;
      ctx.lineWidth   = flash ? 3 : 2;
      rr(px, py, PW, PH, 7); ctx.stroke();

      // accent stripe (loyalty card left bar)
      ctx.shadowBlur = 0;
      ctx.fillStyle  = flash ? '#ff4444' : cardColors.secondary;
      rr(px, py, 7, PH, 5); ctx.fill();

      // health text
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(PH * 0.46)}px system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.fillText(String(Math.max(0, Math.round(p.health))), px + PW / 2 + 3, py + PH / 2);

      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(ts => { lastTs = ts; rafRef.current = requestAnimationFrame(loop); });
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deathCount]);

  // ── Dead → restart ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'dead') return;
    dbg('Dead effect — scheduling restart in 2200ms');
    const t = setTimeout(() => {
      dbg('Phase → playing (restart)');
      phaseRef.current = 'playing';
      setPhase('playing');
    }, 2200);
    return () => clearTimeout(t);
  }, [phase, deathCount]);

  // ── Touch controls ───────────────────────────────────────────────────────────
  const touchLeft  = useCallback((down: boolean) => { if (down) keysRef.current.add('ArrowLeft');  else keysRef.current.delete('ArrowLeft');  }, []);
  const touchRight = useCallback((down: boolean) => { if (down) keysRef.current.add('ArrowRight'); else keysRef.current.delete('ArrowRight'); }, []);
  const touchJump  = useCallback((down: boolean) => { if (down) keysRef.current.add('ArrowUp');    else keysRef.current.delete('ArrowUp');    }, []);

  const dpadBtn = {
    width: 60, height: 60, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.11)',
    border: `2px solid ${cardColors.secondary}66`,
    color: '#fff', fontSize: '1.35rem',
    userSelect: 'none' as const, touchAction: 'none' as const, cursor: 'pointer',
    WebkitUserSelect: 'none' as const,
  };

  const playing = phase === 'playing' || phase === 'dead';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1300, display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #070114 0%, #150430 35%, #200943 65%, #070114 100%)',
      overflow: 'hidden',
      animation: 'gameScreenIn 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards',
      '@keyframes gameScreenIn': {
        '0%':   { transform: 'scale(0.06) rotate(-5deg)', opacity: 0, borderRadius: '50%' },
        '70%':  { transform: 'scale(1.0) rotate(0.8deg)',  opacity: 1, borderRadius: '14px' },
        '100%': { transform: 'scale(1) rotate(0)',         opacity: 1, borderRadius: '0' },
      },
    }}>
      {/* AppBar */}
      <AppBar position="static" elevation={0} sx={{
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${cardColors.secondary}33`,
      }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="back"><ArrowBack /></IconButton>
          <Typography variant="h6" sx={{ ml: 1, fontWeight: 'bold', flexGrow: 1 }}>
            {card.store_name}
            <Typography component="span" sx={{ ml: 1.5, fontWeight: 'normal', opacity: 0.55, fontSize: '0.78em' }}>
              — Level {level}
            </Typography>
          </Typography>
          {playing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 2 }}>
              {displayDoubleJumps > 0 && (
                <Typography variant="body2" sx={{
                  fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem',
                  color: '#00e5ff',
                  textShadow: '0 0 10px #00e5ff',
                }}>
                  {Array.from({ length: displayDoubleJumps }, (_, i) => '↑').join('')}
                </Typography>
              )}
              <Typography variant="body2" sx={{
                fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem',
                color: displayHealth > 50 ? '#2ecc71' : displayHealth > 25 ? '#f1c40f' : '#e74c3c',
              }}>
                HP {displayHealth}
              </Typography>
            </Box>
          )}
          <IconButton color="inherit" onClick={onShortcut} aria-label="add shortcut">
            <IosShare sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>

        {/* ── INTRO / READY overlay ────────────────────────────────────────── */}
        {(phase === 'intro' || phase === 'ready') && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3, p: 4,
            animation: phase === 'ready' ? 'fadeOut 0.45s 0.95s ease forwards' : undefined,
            '@keyframes fadeOut': { to: { opacity: 0, transform: 'scale(1.06)' } },
          }}>
            {/* ambient glow */}
            <Box sx={{
              position: 'absolute', width: 500, height: 500, borderRadius: '50%',
              background: `radial-gradient(circle, ${cardColors.secondary}2a 0%, transparent 68%)`,
              top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none',
            }} />
            {/* level badge */}
            <Box sx={{
              width: 164, height: 164, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: `4px solid ${cardColors.secondary}`,
              boxShadow: `0 0 36px ${cardColors.secondary}77, 0 0 80px ${cardColors.secondary}22`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              animation: 'badgePop 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both, badgeGlow 2.6s 0.8s ease-in-out infinite',
              '@keyframes badgePop': { '0%': { transform: 'scale(0) rotate(-200deg)', opacity: 0 }, '100%': { transform: 'scale(1) rotate(0)', opacity: 1 } },
              '@keyframes badgeGlow': {
                '0%,100%': { boxShadow: `0 0 28px ${cardColors.secondary}55, 0 0 56px ${cardColors.secondary}18` },
                '50%':     { boxShadow: `0 0 56px ${cardColors.secondary}bb, 0 0 110px ${cardColors.secondary}44` },
              },
              zIndex: 1,
            }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.2em', textTransform: 'uppercase', mb: 0.25 }}>Level</Typography>
              <Typography variant="h2" sx={{ color: '#fff', fontWeight: 'bold', lineHeight: 1, textShadow: `0 0 24px ${cardColors.secondary}` }}>{level}</Typography>
            </Box>
            <Typography variant="h4" sx={{
              color: '#fff', fontWeight: 'bold', textAlign: 'center',
              textShadow: '0 2px 14px rgba(0,0,0,0.6)', zIndex: 1,
              animation: 'fadeUp 0.4s 0.5s ease both',
              '@keyframes fadeUp': { '0%': { transform: 'translateY(18px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
            }}>{card.store_name}</Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.38)', textAlign: 'center', animation: 'fadeUp 0.4s 0.65s ease both', zIndex: 1 }}>
              Your adventure begins here…
            </Typography>
            {phase === 'ready' && (
              <Typography variant="h5" sx={{
                color: cardColors.secondary, fontWeight: 'bold', letterSpacing: '0.15em', mt: 1, zIndex: 1,
                textShadow: `0 0 20px ${cardColors.secondary}`,
                animation: 'blink 0.55s ease-in-out infinite alternate',
                '@keyframes blink': { to: { opacity: 0.35, transform: 'scale(1.05)' } },
              }}>GET READY!</Typography>
            )}
          </Box>
        )}

        {/* ── GAME OVER overlay ────────────────────────────────────────────── */}
        {phase === 'dead' && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            background: 'rgba(0,0,0,0.72)',
            animation: 'fadeIn 0.2s ease',
            '@keyframes fadeIn': { from: { opacity: 0 } },
          }}>
            <Typography variant="h3" sx={{
              color: '#e74c3c', fontWeight: 'bold', letterSpacing: '0.1em',
              textShadow: '0 0 32px #e74c3c',
              animation: 'shake 0.4s ease',
              '@keyframes shake': {
                '0%,100%': { transform: 'translateX(0)' },
                '20%': { transform: 'translateX(-8px) rotate(-2deg)' },
                '40%': { transform: 'translateX(8px) rotate(2deg)' },
                '60%': { transform: 'translateX(-5px)' },
                '80%': { transform: 'translateX(5px)' },
              },
            }}>GAME OVER</Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)' }}>Restarting…</Typography>
          </Box>
        )}

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            display: 'block',
            opacity: phase === 'intro' ? 0 : 1,
            transition: 'opacity 0.5s',
          }}
        />

        {/* ── Touch D-pad ─────────────────────────────────────────────────── */}
        {playing && (
          <Box sx={{
            position: 'absolute', bottom: 14, left: 0, right: 0,
            display: 'flex', justifyContent: 'space-between', px: 3,
            pointerEvents: 'none',
            '@media (hover: hover)': { display: 'none' }, // hide on desktop
          }}>
            <Box sx={{ display: 'flex', gap: 1.5, pointerEvents: 'auto' }}>
              <Box sx={dpadBtn} onPointerDown={() => touchLeft(true)}  onPointerUp={() => touchLeft(false)}  onPointerLeave={() => touchLeft(false)}>◀</Box>
              <Box sx={dpadBtn} onPointerDown={() => touchRight(true)} onPointerUp={() => touchRight(false)} onPointerLeave={() => touchRight(false)}>▶</Box>
            </Box>
            <Box sx={{ pointerEvents: 'auto' }}>
              <Box sx={{ ...dpadBtn, width: 72, height: 72, fontSize: '1.6rem' }} onPointerDown={() => touchJump(true)} onPointerUp={() => touchJump(false)} onPointerLeave={() => touchJump(false)}>▲</Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default GameScreen;
