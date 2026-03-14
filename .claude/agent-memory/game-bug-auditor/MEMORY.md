# Game Bug Auditor — Persistent Memory

## Project
Cardcade — React 19 + TypeScript + Vite + Firebase + MUI v7
Game file: `src/components/GameScreen.tsx`

## Architecture Notes
- Game loop lives in a `useEffect([phase, deathCount])`. Every death increments `deathCount` to re-trigger the effect, which re-starts the loop cleanly.
- All mutable game state lives in refs (playerRef, ballsRef, scanZoneRef, etc.); React state is used only for UI display (displayHealth, scanCount, etc.).
- `phaseRef` mirrors `phase` state for synchronous reads inside the rAF loop.
- `dwellRequired()` and `spawnInterval()` are closures over `level` defined inside the loop effect — correct scoping.
- Canvas is sized via `ResizeObserver` + HiDPI `setTransform(dpr,…)`. `cW()`/`cH()` divide by dpr to get logical pixels.
- D-pad uses `touchAction: 'none'` on the button elements and pointer events; no `preventDefault()` on canvas touch.

## Known Fragile Areas
- `resizeCanvas` uses `canvas.offsetWidth/Height`; if the flex container hasn't settled yet (offsetHeight=0) the canvas height defaults to `window.innerHeight - 64`. Guard is in place (`rawH || (window.innerHeight - 64)`).
- `setScanCount(0)` inside `useEffect([phase, deathCount])` is fine — called synchronously at loop start, no closure staleness issue.
- `scanZoneRef.current = null` in the success block happens before the timeout check (`if (scanZoneRef.current && sz.age >= SCAN_ZONE_LIFE)`) in the same frame — correctly prevents double-fire.
- `floatTextsRef.current.filter(…)` inside the draw loop mutates the ref array while iterating — this is safe (Array.prototype.filter creates a new array and assigns it back).

## Confirmed Bugs (from 2026-03-08 scan-zone audit)
See `scan-zone-audit.md` for full details.

### Critical
- NONE

### Significant
1. **Scan zone / D-pad overlap on mobile** — scan zone top = `gY - 28 = canvasH - 92`. D-pad bottom edge = canvas bottom - 14px. Buttons are 60–72px tall so they extend from `canvasH - 14` up to `canvasH - 86px`. Scan zone top at `canvasH - 92` barely clears the tallest button (72px) by only ~6 logical px, but the "SCAN HERE" label and side-rail extensions reach 18-20px *above* `szY`, overlapping the D-pad visual area. On short screens (<600px) or large-radius DPR the overlap is worse.
2. **`scanFlashRef.current--` is frame-rate-dependent** — decremented by 1 each rAF call (not scaled by `dt`). At 120 Hz the flash lasts half as long (~83ms) vs 60 Hz (~167ms). Not game-breaking but inconsistent.
3. **`gameTimeRef.current` accumulates across deaths** — reset to 0 in the loop effect (line 217), but `lastScanTimeRef.current` is also reset (line 218), so the combo window is measured relative to the new session's zero. No bug but worth watching if sessions get long and dt drifts.

### Minor
1. `DBG = true` left on (line 21) — verbose console spam in production.
2. `onOpenLocation` prop is declared in `GameScreenProps` (line 17) but never destructured or used.
3. Scan zone width: `Math.max(64, Math.round(90 - level * 2.8))`. At level 9+ the expression goes ≤ 64, correctly clamped. At level 10 it's 62 → clamped to 64. Fine.
4. `isCombo` check uses `lastScanTimeRef.current > 0` as a sentinel for "first scan" — correct since `gameTimeRef` starts at 0 and `lastScanTimeRef` is reset to 0. No bug.

## Pre-existing Issues (not from scan-zone PR)
- `AddCardForm.tsx` has two TS errors re: BarcodeType key vs value mismatch. Unrelated to game.
- `GameScreenProps` declares `onOpenLocation` but it is never passed from `CardList.tsx` (need to confirm).

## ctx.save/restore Audit (scan-zone block)
Scan-zone draw block save/restore pairs, in order:
1. `save` (492) / `restore` (509) — zone body + top beam + rails. OK.
2. `save` (512) / `restore` (517) — sweep beam. OK.
3. `save` (519) / `restore` (528) — barcode stripes. OK.
4. `save` (530) / `restore` (537) — "SCAN HERE" label. OK.
5. `save` (543) / `restore` (547) — progress bar. OK (outside flickOn block, always runs if dwellPct > 0).
All pairs are balanced with no mismatch.
