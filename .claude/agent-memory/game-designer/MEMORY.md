# Game Designer Agent Memory — Cardcade

## Key File
- `src/components/GameScreen.tsx` — entire game in one file (~657 lines)

## Confirmed Game Constants (as of initial read)
- Player: 72×38px card rect, GRAVITY=0.52, JUMP_VEL=-13.5, DBL_JUMP_VEL=-19.5, PSPEED=5.5
- Ground: GROUND_OFF=64px from canvas bottom
- Spawn interval: `max(48, 108 - level * 8)` frames — bottoms out at level ~7.5
- Ball speed: `-(2.4 + level*0.35 + rand*2.2)` velX
- Power-up: double-jump capsule, spawns every 310 frames, floats L→R, AABB hit = consumed
- Phases: intro(2.6s) → ready(1.4s) → playing → dead(2.2s) → playing
- HP: 100, damage = ball.value (1/2/5/10), no regen
- Canvas: HiDPI aware, ResizeObserver, logical coords via cW()/cH()/gndY()
- D-pad: hidden on hover:hover (desktop), shown on touch devices

## Difficulty Scaling (confirmed)
- Spawn interval floor hits at level ~7-8; main scaling pressure is ball speed
- No hard cap on simultaneous balls — they accumulate if player survives long
- Ball velY at spawn: ground balls get -(6+rand*5.5) bounce; air balls get rand±2.5

## Score System (as of initial read)
- NO score system implemented yet — death count tracked only
- `card.level` is the only persistent progression signal
- `displayDoubleJumps` shown in AppBar; HP shown in AppBar

## Scan Zone Design — Approved Spec (session: initial design)
See `scan-zone-spec.md` for full spec.
- Dwell time: 1.4s base, scales to 0.9s at level 10+
- Zone width: 90px base, scales down to 64px at level 10+
- Spawn cadence: every 8–14s (random), zone active for 7s before timeout
- On success: flash + scan count increment + brief HP restore (5 HP, capped 100)
- Score: scan count primary, time-alive secondary, combo for consecutive scans
- Level effect: narrower zone, shorter dwell window, higher ball density during scan

## Architecture Notes
- All game state in refs (playerRef, ballsRef, powerUpsRef) — never useState inside loop
- Phase changes via setPhase + phaseRef.current (dual write pattern)
- Canvas draw order: bg → grid → ground → balls → powerups → player → overlays
- `loop()` exits early if phaseRef.current !== 'playing' — clean RAF cancel
- Restart: deathCount increments → useEffect [phase, deathCount] re-runs loop
