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
  onLevelComplete: (newLevel: number) => void;
}

// ─── Debug logging ─────────────────────────────────────────────────────────────
const DBG = true; // flip to false to silence
const dbg = (...args: unknown[]) => { if (DBG) console.log('[Game]', ...args); };

// ─── Game constants ────────────────────────────────────────────────────────────
const PW = 72;          // player width  (card-shaped rectangle)
const PH = 38;          // player height
const GRAVITY        = 0.35;
const JUMP_VEL       = -13.5;
const DBL_JUMP_VEL   = -19.5;   // stronger boost for double jump
const PSPEED         = 5.5;
const GROUND_OFF     = 64;  // px from canvas bottom
const PU_W = 42;             // power-up rect width
const PU_H = 28;             // power-up rect height
const PU_SPAWN_INT   = 310;  // frames between power-up spawns
const BURST_BALL_INT = 10;   // dt-units between burst balls at level start
const BURST_GAP      = 150;  // dt-units of quiet after the burst before normal spawning
const CART_W         = 52;   // shopping cart width
const CART_H         = 30;   // shopping cart body height
const CART_WHEEL_R   = 7;    // wheel radius
const STAMP_W        = 32;   // stamp collectible width
const STAMP_H        = 32;   // stamp collectible height
const STAMP_SPAWN_INT  = 420; // dt-units between stamp spawns (level 5+)
const RECEIPT_W        = 88;  // floating receipt (cloud platform) width
const RECEIPT_H        = 18;  // receipt height
const RECEIPT_SPAWN_INT = 650; // dt-units between receipt spawns (level 10+)

// ─── Scan zone constants ───────────────────────────────────────────────────────
const SCAN_ZONE_H      = 28;   // height of scan zone above ground line
const SCAN_FIRST_DELAY = 300;  // dt-units before first zone (~5s at 60fps)
const SCAN_ZONE_LIFE   = 420;  // dt-units a zone stays active (~7s)
const SCANS_TO_COMPLETE_LEVEL = 5;

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

interface ShoppingCart {
  id: number;
  x: number;
  velX: number;
}

interface Stamp {
  id: number;
  x: number; y: number;
  velX: number;
  bob: number;
}

interface Receipt {
  id: number;
  x: number; y: number;
  velX: number;
  bob: number;
}

interface ScanZone {
  x: number; w: number;
  age: number;   // dt-units since spawn
  dwell: number; // dt-units player has been inside
}

interface FloatText {
  x: number; y: number;
  text: string; color: string;
  age: number; maxAge: number;
}

type Phase = 'intro' | 'ready' | 'playing' | 'dead' | 'levelcomplete';

// ─── Component ─────────────────────────────────────────────────────────────────
function GameScreen({ card, cardColors, onClose, onShortcut, onLevelComplete }: GameScreenProps) {
  const [phase, setPhase]                           = useState<Phase>('intro');
  const [displayHealth, setDisplayHealth]           = useState(100);
  const [displayDoubleJumps, setDisplayDoubleJumps] = useState(0);
  const [deathCount, setDeathCount]                 = useState(0);
  const [scanCount, setScanCount]                   = useState(0);
  const [levelCount, setLevelCount]                 = useState(0);
  const [currentLevel, setCurrentLevel]             = useState(card.level ?? 0);

  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const phaseRef           = useRef<Phase>('intro');
  const playerRef          = useRef<GamePlayer>({ x: 0, y: 0, velX: 0, velY: 0, onGround: false, health: 100, hitFlash: 0, jumpPressed: false, doubleJumps: 0 });
  const ballsRef           = useRef<GameBall[]>([]);
  const powerUpsRef        = useRef<PowerUp[]>([]);
  const powerUpIdRef       = useRef(0);
  const powerUpTimerRef    = useRef(0);
  const keysRef            = useRef<Set<string>>(new Set());
  const rafRef             = useRef<number>(0);
  const spawnTimerRef      = useRef(0);
  const burstCountRef      = useRef(0);  // balls left in level-intro burst
  const burstTimerRef      = useRef(0);  // dt accumulator between burst balls
  const ballIdRef          = useRef(0);
  const cartsRef           = useRef<ShoppingCart[]>([]);
  const cartTimerRef       = useRef(0);
  const cartIdRef          = useRef(0);
  const stampsRef          = useRef<Stamp[]>([]);
  const stampTimerRef      = useRef(0);
  const stampIdRef         = useRef(0);
  const receiptsRef        = useRef<Receipt[]>([]);
  const receiptTimerRef    = useRef(0);
  const receiptIdRef       = useRef(0);
  // null = not mounted; otherwise { receiptId, offsetX }
  const mountRef           = useRef<{ receiptId: number; offsetX: number } | null>(null);
  const prevHealthRef      = useRef(100);
  const currentLevelRef    = useRef(card.level ?? 0);
  const isDeathRestartRef  = useRef(false);
  const deathHPRef         = useRef(100);
  const scanCountRef       = useRef(0);
  // ── Scan zone refs ────────────────────────────────────────────────────────────
  const scanZoneRef        = useRef<ScanZone | null>(null);
  const scanSpawnTimerRef  = useRef(0);
  const scanSpawnDelayRef  = useRef(SCAN_FIRST_DELAY);
  const scanFlashRef       = useRef(0);   // success flash countdown (frames)
  const floatTextsRef      = useRef<FloatText[]>([]);
  const gameTimeRef        = useRef(0);

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
    const lv = currentLevelRef.current;
    dbg(`Game loop effect fired — phase=${phase} deathCount=${deathCount} level=${lv}`);
    const dpr    = () => window.devicePixelRatio || 1;
    const cW     = () => canvas.width  / dpr();
    const cH     = () => canvas.height / dpr();
    const gndY   = () => cH() - GROUND_OFF;

    // ── reset helpers ──────────────────────────────────────────────────────────
    const isDeathRestart = isDeathRestartRef.current;
    isDeathRestartRef.current = false;

    const resetPlayer = () => {
      const p = playerRef.current;
      p.x = 90; p.y = gndY() - PH;
      p.velX = 0; p.velY = 0; p.onGround = true;
      p.hitFlash = 0; p.jumpPressed = false;
      p.doubleJumps = 0;
      if (isDeathRestart) {
        const hp = Math.max(10, deathHPRef.current - 20);
        p.health = hp;
        prevHealthRef.current = hp;
        setDisplayHealth(hp);
      } else {
        p.health = 100;
        prevHealthRef.current = 100;
        setDisplayHealth(100);
      }
      setDisplayDoubleJumps(0);
    };

    resetPlayer();
    ballsRef.current        = [];
    powerUpsRef.current     = [];
    spawnTimerRef.current   = 0;
    powerUpTimerRef.current = 0;
    gameTimeRef.current     = 0;
    burstCountRef.current   = lv;          // spawn lv balls as the level-intro burst
    burstTimerRef.current   = BURST_BALL_INT; // fire first burst ball immediately
    cartsRef.current        = [];
    cartTimerRef.current    = 0;
    stampsRef.current       = [];
    stampTimerRef.current   = 0;
    receiptsRef.current     = [];
    receiptTimerRef.current = 0;
    mountRef.current        = null;

    if (!isDeathRestart) {
      // Full reset for a new level (or first start)
      scanCountRef.current      = 0;
      setScanCount(0);
      scanZoneRef.current       = null;
      scanSpawnTimerRef.current = 0;
      scanSpawnDelayRef.current = SCAN_FIRST_DELAY;
      scanFlashRef.current      = 0;
      floatTextsRef.current     = [];
    }

    const spawnInterval = () => Math.max(42, 110 - lv * 8);
    // Dwell time required to complete a scan (dt-units): 1.4s → 0.9s with level
    const dwellRequired = () => Math.max(54, 84 - lv * 3);

    const startGndY = gndY();
    const startCW   = cW();
    const startCH   = cH();
    dbg(`Loop start — canvas logical ${startCW.toFixed(1)}x${startCH.toFixed(1)} gndY=${startGndY.toFixed(1)} spawnInterval=${spawnInterval()}f level=${lv}`);
    if (startGndY <= 40) {
      console.warn('[Game] ⚠ gndY suspiciously low at loop start! Expect instant death.', { startGndY, startCH, canvasH: canvas.height });
    }

    const spawnBall = () => {
      const poolValue = VALUE_POOL[Math.floor(Math.random() * VALUE_POOL.length)];
      const def = CIRCLE_DEFS.find(d => d.value === poolValue)!;
      if (!def) { console.error('[Game] spawnBall: no def for poolValue', poolValue); return; }
      const gY   = gndY();
      const velX = -(2.4 + lv * 0.35 + Math.random() * 2.2);
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

    const spawnScanZone = () => {
      const W = cW();
      const zoneW = Math.max(64, Math.round(90 - lv * 2.8));
      const minX = W * 0.2;
      const maxX = W * 0.75 - zoneW;
      const x = minX + Math.random() * Math.max(0, maxX - minX);
      scanZoneRef.current = { x, w: zoneW, age: 0, dwell: 0 };
      dbg(`Scan zone spawned x=${x.toFixed(0)} w=${zoneW}`);
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

      gameTimeRef.current += dt;
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

      // ── level-intro burst: spawn lv balls quickly, then gap ───────────────
      if (burstCountRef.current > 0) {
        burstTimerRef.current += dt;
        if (burstTimerRef.current >= BURST_BALL_INT) {
          burstTimerRef.current = 0;
          spawnBall();
          burstCountRef.current--;
          if (burstCountRef.current === 0) {
            spawnTimerRef.current = -BURST_GAP; // delay normal spawning after burst
          }
        }
      } else {
        // ── normal spawn (20% more frequent when scan zone is active) ─────────
        spawnTimerRef.current += dt;
        const effectiveInterval = scanZoneRef.current ? spawnInterval() * 0.8 : spawnInterval();
        if (spawnTimerRef.current >= effectiveInterval) { spawnTimerRef.current = 0; spawnBall(); }
      }

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
          velX: -(2.2 + lv * 0.2 + Math.random() * 1.2),
          bob: Math.random() * Math.PI * 2,
        });
      }

      // ── scan zone: spawn ───────────────────────────────────────────────────
      scanSpawnTimerRef.current += dt;
      if (!scanZoneRef.current && scanSpawnTimerRef.current >= scanSpawnDelayRef.current) {
        scanSpawnTimerRef.current = 0;
        spawnScanZone();
      }

      // ── scan zone: update ──────────────────────────────────────────────────
      const sz = scanZoneRef.current;
      if (sz) {
        sz.age += dt;
        // Player overlaps zone only when on ground and horizontally inside
        const inZone = p.onGround && p.x + PW > sz.x && p.x < sz.x + sz.w;
        if (inZone) {
          sz.dwell += dt;
          if (sz.dwell >= dwellRequired()) {
            // ── SCAN SUCCESS ──────────────────────────────────────────────────
            p.health = Math.min(100, p.health + 10);
            const clampedH = Math.round(p.health);
            if (clampedH !== prevHealthRef.current) {
              prevHealthRef.current = clampedH;
              setDisplayHealth(clampedH);
            }
            scanFlashRef.current = 10;
            floatTextsRef.current.push({
              x: sz.x + sz.w / 2, y: gY - SCAN_ZONE_H - 14,
              text: '+10 HP', color: '#00ff88',
              age: 0, maxAge: 55,
            });
            scanCountRef.current += 1;
            setScanCount(scanCountRef.current);
            scanZoneRef.current = null;
            scanSpawnDelayRef.current = 240 + Math.random() * 120; // 4–6s
            scanSpawnTimerRef.current = 0;
            if (scanCountRef.current >= SCANS_TO_COMPLETE_LEVEL) {
              phaseRef.current = 'levelcomplete';
              setPhase('levelcomplete');
              dbg('LEVEL COMPLETE!');
            } else {
              dbg(`SCANNED! ${scanCountRef.current}/${SCANS_TO_COMPLETE_LEVEL}`);
            }
          }
        } else {
          sz.dwell = 0; // full reset on exit — commit or abort
        }
        // Zone lifetime timeout (~7s)
        if (scanZoneRef.current && sz.age >= SCAN_ZONE_LIFE) {
          floatTextsRef.current.push({
            x: sz.x + sz.w / 2, y: gY - SCAN_ZONE_H - 14,
            text: '-MISSED', color: '#ff4444',
            age: 0, maxAge: 35,
          });
          scanZoneRef.current = null;
          scanSpawnDelayRef.current = 180 + Math.random() * 120; // 3–5s
          scanSpawnTimerRef.current = 0;
          dbg('Scan zone timed out');
        }
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

        if (hitTest(p, b) && !mountRef.current) {
          const hpBefore = p.health;
          p.health -= b.value;
          p.hitFlash = 14;
          const clamped = Math.max(0, Math.round(p.health));
          if (clamped !== prevHealthRef.current) {
            prevHealthRef.current = clamped;
            setDisplayHealth(clamped);
          }
          if (p.health <= 0) {
            deathHPRef.current = hpBefore;
            isDeathRestartRef.current = true;
            dbg(`DEATH at frame ${frameCount} — ball value=${b.value} gndY=${gY.toFixed(1)} cH=${cH().toFixed(1)} balls=${ballsRef.current.length}`);
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

      // ── spawn shopping carts (level 3+) ────────────────────────────────────
      if (lv >= 3) {
        cartTimerRef.current += dt;
        const cartInterval = Math.max(180, 900 - (lv - 3) * 120);
        if (cartTimerRef.current >= cartInterval) {
          cartTimerRef.current = 0;
          cartsRef.current.push({
            id: cartIdRef.current++,
            x: W + CART_W + 10,
            velX: -(0.5 + Math.random() * 0.35),
          });
        }
      }

      // ── update shopping carts ──────────────────────────────────────────────
      cartsRef.current = cartsRef.current.filter(cart => {
        cart.x += cart.velX * dt;
        const cartTop    = gY - CART_WHEEL_R * 2 - CART_H;
        const cartBottom = gY;
        const hit = !mountRef.current &&
                    p.x < cart.x + CART_W && p.x + PW > cart.x &&
                    p.y < cartBottom       && p.y + PH  > cartTop;
        if (hit) {
          const hpBefore = p.health;
          p.health -= 50;
          p.hitFlash = 20;
          floatTextsRef.current.push({
            x: cart.x + CART_W / 2, y: cartTop - 10,
            text: '-50 HP', color: '#ff8800',
            age: 0, maxAge: 60,
          });
          const clamped = Math.max(0, Math.round(p.health));
          if (clamped !== prevHealthRef.current) {
            prevHealthRef.current = clamped;
            setDisplayHealth(clamped);
          }
          if (p.health <= 0) {
            deathHPRef.current = hpBefore;
            isDeathRestartRef.current = true;
            phaseRef.current = 'dead';
            setDeathCount(c => c + 1);
            setPhase('dead');
          }
          return false;
        }
        return cart.x + CART_W > -60;
      });

      // ── spawn stamps (level 5+) ────────────────────────────────────────────
      if (lv >= 5) {
        stampTimerRef.current += dt;
        if (stampTimerRef.current >= STAMP_SPAWN_INT) {
          stampTimerRef.current = 0;
          const stampY = gY - STAMP_H - 10 - Math.random() * Math.max(0, gY * 0.55);
          stampsRef.current.push({
            id: stampIdRef.current++,
            x: W + STAMP_W + 10,
            y: stampY,
            velX: -(2.0 + lv * 0.15 + Math.random() * 1.0),
            bob: Math.random() * Math.PI * 2,
          });
        }
      }

      // ── update stamps ──────────────────────────────────────────────────────
      stampsRef.current = stampsRef.current.filter(st => {
        st.x   += st.velX * dt;
        st.bob += 0.07 * dt;
        const hit = p.x < st.x + STAMP_W && p.x + PW > st.x &&
                    p.y < st.y + STAMP_H  && p.y + PH > st.y;
        if (hit) {
          p.health = Math.min(100, p.health + 10);
          const clamped = Math.round(p.health);
          if (clamped !== prevHealthRef.current) {
            prevHealthRef.current = clamped;
            setDisplayHealth(clamped);
          }
          floatTextsRef.current.push({
            x: st.x + STAMP_W / 2, y: st.y - 8,
            text: '+10 HP', color: '#ff44aa',
            age: 0, maxAge: 55,
          });
          return false;
        }
        return st.x + STAMP_W > -40;
      });

      // ── receipt platform: mounting / dismounting ───────────────────────────
      if (mountRef.current) {
        const mounted = receiptsRef.current.find(r => r.id === mountRef.current!.receiptId);
        if (!mounted) {
          // receipt went off screen — dismount
          mountRef.current = null;
        } else {
          // jump UP off the receipt
          if (wantsJump && !p.jumpPressed) {
            mountRef.current = null;
            p.velY = JUMP_VEL;
          // drop DOWN off the receipt (to aim for scanner on the ground)
          } else if (keys.has('ArrowDown')) {
            mountRef.current = null;
            p.velY = 4; // small downward nudge so gravity takes over
          } else {
            // ride the receipt
            p.x    = mounted.x + mountRef.current.offsetX;
            p.y    = mounted.y - PH;
            p.velX = mounted.velX;
            p.velY = 0;
            p.onGround = false;
          }
        }
      }

      // ── spawn receipts (level 10+) ─────────────────────────────────────────
      if (lv >= 10) {
        receiptTimerRef.current += dt;
        if (receiptTimerRef.current >= RECEIPT_SPAWN_INT) {
          receiptTimerRef.current = 0;
          const minY = 40;
          const maxY = Math.max(minY + RECEIPT_H, gY * 0.55 - RECEIPT_H);
          receiptsRef.current.push({
            id: receiptIdRef.current++,
            x: W + RECEIPT_W + 10,
            y: minY + Math.random() * (maxY - minY),
            velX: -(1.1 + Math.random() * 0.5),
            bob: Math.random() * Math.PI * 2,
          });
        }
      }

      // ── update receipts ────────────────────────────────────────────────────
      receiptsRef.current = receiptsRef.current.filter(rc => {
        rc.x   += rc.velX * dt;
        rc.bob += 0.04 * dt;
        const rcY = rc.y + Math.sin(rc.bob) * 4;

        // mount: player overlaps receipt and not already mounted
        if (!mountRef.current) {
          const overlaps = p.x + PW > rc.x && p.x < rc.x + RECEIPT_W &&
                           p.y + PH > rcY   && p.y < rcY + RECEIPT_H;
          if (overlaps) {
            mountRef.current = { receiptId: rc.id, offsetX: p.x - rc.x };
          }
        }

        const alive = rc.x + RECEIPT_W > -60;
        if (!alive && mountRef.current?.receiptId === rc.id) mountRef.current = null;
        return alive;
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

      // ── draw scan zone (below circles so enemies cross over it) ──────────────
      const szDraw = scanZoneRef.current;
      if (szDraw) {
        const szX = szDraw.x;
        const szY = gY - SCAN_ZONE_H;
        const dwellPct = Math.min(1, szDraw.dwell / dwellRequired());
        const pulse = (Math.sin(gameTimeRef.current * 0.18) + 1) * 0.5;
        const beamColor = lv >= 6 ? '#ff2200' : lv >= 3 ? '#ff6600' : '#ffaa00';
        const urgency = szDraw.age > 240; // flicker after ~4s
        const flickOn = !urgency || Math.sin(szDraw.age * 0.8) > 0;
        if (flickOn) {
          ctx.save();
          const zg = ctx.createLinearGradient(szX, szY, szX, gY);
          zg.addColorStop(0, beamColor + '44');
          zg.addColorStop(1, beamColor + '0a');
          ctx.fillStyle = zg;
          ctx.fillRect(szX, szY, szDraw.w, SCAN_ZONE_H);
          // Top beam line — pulsing glow
          ctx.shadowColor = beamColor;
          ctx.shadowBlur = 14 + 12 * pulse;
          ctx.strokeStyle = beamColor;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(szX, szY); ctx.lineTo(szX + szDraw.w, szY); ctx.stroke();
          // Side rails extending upward
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.moveTo(szX, szY - 18); ctx.lineTo(szX, szY); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(szX + szDraw.w, szY - 18); ctx.lineTo(szX + szDraw.w, szY); ctx.stroke();
          ctx.restore();
          // Animated scan beam sweeping left-to-right
          const sweepX = szX + szDraw.w * ((szDraw.age * 0.033) % 1);
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.3 * pulse;
          ctx.strokeStyle = beamColor; ctx.lineWidth = 1.5;
          ctx.shadowColor = beamColor; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(sweepX, szY); ctx.lineTo(sweepX, gY); ctx.stroke();
          ctx.restore();
          // Barcode stripe decoration
          ctx.save();
          ctx.globalAlpha = 0.16;
          ctx.strokeStyle = beamColor; ctx.lineWidth = 1;
          const barsCount = Math.floor(szDraw.w / 5);
          for (let bi = 0; bi < barsCount; bi++) {
            if (bi % 3 === 0) continue;
            const bx = szX + bi * 5;
            ctx.beginPath(); ctx.moveTo(bx, szY + 4); ctx.lineTo(bx, gY - 4); ctx.stroke();
          }
          ctx.restore();
          // "SCAN HERE" label
          ctx.save();
          ctx.globalAlpha = 0.6 + 0.25 * pulse;
          ctx.fillStyle = beamColor;
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.shadowColor = beamColor; ctx.shadowBlur = 6;
          ctx.fillText('SCAN HERE', szX + szDraw.w / 2, szY - 20);
          ctx.restore();
        }
        // Progress bar — always visible
        if (dwellPct > 0) {
          const barHue = Math.round(dwellPct * 120); // red(0) → green(120)
          const barColor = `hsl(${barHue},100%,55%)`;
          ctx.save();
          ctx.fillStyle = barColor;
          ctx.shadowColor = barColor; ctx.shadowBlur = 10;
          ctx.fillRect(szX, szY, szDraw.w * dwellPct, 4);
          ctx.restore();
        }
      }

      // ── scan success flash ────────────────────────────────────────────────────
      if (scanFlashRef.current > 0) {
        const alpha = (scanFlashRef.current / 10) * 0.5;
        ctx.fillStyle = `rgba(0,255,136,${alpha})`;
        ctx.fillRect(0, 0, W, H);
        scanFlashRef.current--;
      }

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

      // ── draw receipts ────────────────────────────────────────────────────────
      for (const rc of receiptsRef.current) {
        const rx = rc.x;
        const ry = rc.y + Math.sin(rc.bob) * 4;
        const isMountedHere = mountRef.current?.receiptId === rc.id;
        ctx.save();
        ctx.shadowColor = isMountedHere ? '#ffe066dd' : '#ffffffaa';
        ctx.shadowBlur  = isMountedHere ? 28 : 14;
        // cloud puffs behind
        ctx.fillStyle = isMountedHere ? '#fff8e0dd' : '#e8f0ffcc';
        for (const [px2, py2, pr] of [
          [rx + 12, ry + 4, 12] as const,
          [rx + 28, ry,     15] as const,
          [rx + 48, ry + 2, 13] as const,
          [rx + 65, ry + 5, 11] as const,
        ]) {
          ctx.beginPath(); ctx.arc(px2, py2, pr, 0, Math.PI * 2); ctx.fill();
        }
        // main receipt body
        ctx.fillStyle = isMountedHere ? '#fffbe8ee' : '#f0f4ffee';
        rr(rx, ry + 4, RECEIPT_W, RECEIPT_H, 4); ctx.fill();
        ctx.strokeStyle = isMountedHere ? '#ffe066' : '#aac4ff';
        ctx.lineWidth = 1.5; ctx.shadowBlur = 0;
        rr(rx, ry + 4, RECEIPT_W, RECEIPT_H, 4); ctx.stroke();
        // receipt lines (printed text look)
        ctx.strokeStyle = isMountedHere ? '#c8a800' : '#7aa0cc';
        ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
        for (const ly2 of [ry + 8, ry + 12, ry + 16]) {
          ctx.beginPath();
          ctx.moveTo(rx + 8,             ly2);
          ctx.lineTo(rx + RECEIPT_W - 8, ly2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── draw stamps ──────────────────────────────────────────────────────────
      for (const st of stampsRef.current) {
        const sx = st.x;
        const sy = st.y + Math.sin(st.bob) * 5;
        ctx.save();
        ctx.shadowColor = '#ff44aacc'; ctx.shadowBlur = 16;
        // outer perforated border
        ctx.strokeStyle = '#ff44aa'; ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(sx, sy, STAMP_W, STAMP_H);
        ctx.setLineDash([]);
        // inner fill
        ctx.fillStyle = '#2a002088';
        ctx.fillRect(sx + 4, sy + 4, STAMP_W - 8, STAMP_H - 8);
        ctx.strokeStyle = '#ff44aa'; ctx.lineWidth = 1.5;
        ctx.strokeRect(sx + 4, sy + 4, STAMP_W - 8, STAMP_H - 8);
        // "+10" text
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ff44aa';
        ctx.font = 'bold 11px system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+10', sx + STAMP_W / 2, sy + STAMP_H / 2 - 3);
        // small heart icon below
        ctx.font = '9px system-ui,sans-serif';
        ctx.fillStyle = '#ff88cc';
        ctx.fillText('HP', sx + STAMP_W / 2, sy + STAMP_H / 2 + 8);
        ctx.restore();
      }

      // ── draw shopping carts ───────────────────────────────────────────────────
      for (const cart of cartsRef.current) {
        const cx  = cart.x;
        const cy  = gY - CART_WHEEL_R * 2 - CART_H;
        const wr  = CART_WHEEL_R;
        ctx.save();
        ctx.shadowColor = '#ff8800bb'; ctx.shadowBlur = 14;
        // basket body (trapezoid — wider at bottom)
        ctx.beginPath();
        ctx.moveTo(cx + 6,          cy);
        ctx.lineTo(cx + CART_W - 4, cy);
        ctx.lineTo(cx + CART_W,     cy + CART_H);
        ctx.lineTo(cx,              cy + CART_H);
        ctx.closePath();
        ctx.fillStyle = '#2a1000cc'; ctx.fill();
        ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2.5; ctx.stroke();
        // basket grid lines
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ff880055'; ctx.lineWidth = 1;
        const mid = cy + CART_H / 2;
        ctx.beginPath(); ctx.moveTo(cx, mid); ctx.lineTo(cx + CART_W, mid); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + CART_W / 3, cy); ctx.lineTo(cx + CART_W / 3 - 2, cy + CART_H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + CART_W * 2 / 3, cy); ctx.lineTo(cx + CART_W * 2 / 3 - 4, cy + CART_H); ctx.stroke();
        // handle (top-right diagonal bar)
        ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ff8800bb'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(cx + CART_W - 4, cy);
        ctx.lineTo(cx + CART_W + 10, cy - 18);
        ctx.stroke();
        // wheels
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#555'; ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2;
        for (const wx of [cx + wr + 3, cx + CART_W - wr - 3]) {
          ctx.beginPath(); ctx.arc(wx, gY - wr, wr, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          // hub dot
          ctx.fillStyle = '#ff8800';
          ctx.beginPath(); ctx.arc(wx, gY - wr, 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#555';
        }
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

      // ── shield aura when riding a receipt ─────────────────────────────────────
      if (mountRef.current) {
        const pulse = (Math.sin(gameTimeRef.current * 0.22) + 1) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.2 * pulse;
        ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 26 + 10 * pulse;
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 2.5;
        // elliptical shield around player
        ctx.beginPath();
        ctx.ellipse(px + PW / 2, py + PH / 2, PW / 2 + 10, PH / 2 + 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        // second inner ring
        ctx.globalAlpha = 0.25 + 0.15 * pulse;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();
      }

      // ── draw floating texts (on top of everything) ────────────────────────────
      floatTextsRef.current = floatTextsRef.current.filter(ft => {
        ft.age += dt;
        const t = ft.age / ft.maxAge;
        const yPos = ft.y - t * 38;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color; ctx.shadowBlur = 16;
        ctx.font = 'bold 18px system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ft.text, ft.x, yPos);
        ctx.restore();
        return ft.age < ft.maxAge;
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(ts => { lastTs = ts; rafRef.current = requestAnimationFrame(loop); });
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deathCount, levelCount]);

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

  // ── Level complete → next level ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'levelcomplete') return;
    const newLevel = currentLevelRef.current + 1;
    currentLevelRef.current = newLevel;
    setCurrentLevel(newLevel);
    onLevelComplete(newLevel);
    dbg(`Level complete — advancing to level ${newLevel}`);
    const t = setTimeout(() => {
      phaseRef.current = 'playing';
      setPhase('playing');
      setLevelCount(c => c + 1);
    }, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Touch controls ───────────────────────────────────────────────────────────
  const touchLeft  = useCallback((down: boolean) => { if (down) keysRef.current.add('ArrowLeft');  else keysRef.current.delete('ArrowLeft');  }, []);
  const touchRight = useCallback((down: boolean) => { if (down) keysRef.current.add('ArrowRight'); else keysRef.current.delete('ArrowRight'); }, []);
  const touchJump  = useCallback((down: boolean) => { if (down) keysRef.current.add('ArrowUp');    else keysRef.current.delete('ArrowUp');    }, []);

  // ── Swipe gestures ───────────────────────────────────────────────────────────
  const swipeTouchRef = useRef<{ id: number; startX: number; startY: number; jumped: boolean } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const SWIPE_X    = 22;  // px horizontal threshold
    const SWIPE_JUMP = 45;  // px upward threshold for jump

    const onStart = (e: TouchEvent) => {
      if (swipeTouchRef.current) return;
      const t = e.changedTouches[0];
      swipeTouchRef.current = { id: t.identifier, startX: t.clientX, startY: t.clientY, jumped: false };
    };

    const onMove = (e: TouchEvent) => {
      const st = swipeTouchRef.current;
      if (!st) return;
      const touch = Array.from(e.changedTouches).find(t => t.identifier === st.id);
      if (!touch) return;
      const dx = touch.clientX - st.startX;
      const dy = touch.clientY - st.startY;
      if (dx > SWIPE_X) {
        keysRef.current.add('ArrowRight'); keysRef.current.delete('ArrowLeft');
      } else if (dx < -SWIPE_X) {
        keysRef.current.add('ArrowLeft');  keysRef.current.delete('ArrowRight');
      } else {
        keysRef.current.delete('ArrowLeft'); keysRef.current.delete('ArrowRight');
      }
      if (!st.jumped && dy < -SWIPE_JUMP) {
        st.jumped = true;
        keysRef.current.add('ArrowUp');
        setTimeout(() => keysRef.current.delete('ArrowUp'), 120);
      }
    };

    const onEnd = (e: TouchEvent) => {
      const st = swipeTouchRef.current;
      if (!st) return;
      if (!Array.from(e.changedTouches).find(t => t.identifier === st.id)) return;
      swipeTouchRef.current = null;
      keysRef.current.delete('ArrowLeft');
      keysRef.current.delete('ArrowRight');
    };

    canvas.addEventListener('touchstart',  onStart, { passive: true });
    canvas.addEventListener('touchmove',   onMove,  { passive: true });
    canvas.addEventListener('touchend',    onEnd,   { passive: true });
    canvas.addEventListener('touchcancel', onEnd,   { passive: true });
    return () => {
      canvas.removeEventListener('touchstart',  onStart);
      canvas.removeEventListener('touchmove',   onMove);
      canvas.removeEventListener('touchend',    onEnd);
      canvas.removeEventListener('touchcancel', onEnd);
    };
  }, []);

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
              — Level {currentLevel}
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
                  {Array.from({ length: displayDoubleJumps }, () => '↑').join('')}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                {Array.from({ length: SCANS_TO_COMPLETE_LEVEL }, (_, i) => (
                  <Box key={i} sx={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: i < scanCount ? '#00ff88' : 'transparent',
                    border: `2px solid ${i < scanCount ? '#00ff88' : 'rgba(255,255,255,0.3)'}`,
                    boxShadow: i < scanCount ? '0 0 6px #00ff88' : 'none',
                    transition: 'all 0.2s ease',
                  }} />
                ))}
              </Box>
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
              <Typography variant="h2" sx={{ color: '#fff', fontWeight: 'bold', lineHeight: 1, textShadow: `0 0 24px ${cardColors.secondary}` }}>{currentLevel}</Typography>
            </Box>
            <Typography variant="h4" sx={{
              color: '#fff', fontWeight: 'bold', textAlign: 'center',
              textShadow: '0 2px 14px rgba(0,0,0,0.6)', zIndex: 1,
              animation: 'fadeUp 0.4s 0.5s ease both',
              '@keyframes fadeUp': { '0%': { transform: 'translateY(18px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
            }}>{card.store_name}</Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.38)', textAlign: 'center', animation: 'fadeUp 0.4s 0.65s ease both', zIndex: 1 }}>
              Dodge the balls · reach the scan zone · get scanned!
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

        {/* ── LEVEL COMPLETE overlay ───────────────────────────────────────── */}
        {phase === 'levelcomplete' && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2.5,
            background: 'rgba(0,0,0,0.84)',
            animation: 'lcFadeIn 0.25s ease',
            '@keyframes lcFadeIn': { from: { opacity: 0 } },
          }}>
            <Typography variant="h3" sx={{
              color: cardColors.secondary, fontWeight: 'bold', letterSpacing: '0.06em', textAlign: 'center',
              textShadow: `0 0 40px ${cardColors.secondary}, 0 0 80px ${cardColors.secondary}55`,
              animation: 'lcPop 0.55s 0.1s cubic-bezier(0.34,1.56,0.64,1) both',
              '@keyframes lcPop': {
                '0%':   { transform: 'scale(0.4)', opacity: 0 },
                '100%': { transform: 'scale(1)',   opacity: 1 },
              },
            }}>LEVEL COMPLETE</Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.55)' }}>
              Level {currentLevel - 1} → {currentLevel}
            </Typography>
            <Box sx={{ display: 'flex', gap: '8px', my: 0.5 }}>
              {Array.from({ length: SCANS_TO_COMPLETE_LEVEL }, (_, i) => (
                <Box key={i} sx={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#00ff88',
                  border: '2px solid #00ff88',
                  boxShadow: '0 0 14px #00ff88, 0 0 28px #00ff8855',
                  animation: `pipPop 0.35s ${i * 90}ms cubic-bezier(0.34,1.56,0.64,1) both`,
                  '@keyframes pipPop': {
                    '0%':   { transform: 'scale(0)', opacity: 0 },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  },
                }} />
              ))}
            </Box>
            <Typography variant="body1" sx={{
              color: 'rgba(255,255,255,0.4)', mt: 1,
              animation: 'lcBlink 0.7s 1.2s ease-in-out infinite alternate',
              '@keyframes lcBlink': { to: { opacity: 0.15 } },
            }}>Next level starting…</Typography>
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
            position: 'absolute', bottom: 64, left: 0, right: 0,
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
