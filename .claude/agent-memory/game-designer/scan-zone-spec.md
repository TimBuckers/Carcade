# Scan Zone Win Condition — Full Design Spec

## Status: Approved design, not yet implemented

---

## Concept Summary
A glowing scan beam appears periodically on the ground. The player (loyalty card) must
position themselves under it and hold still for a dwell period. Completing the dwell
triggers a "SCANNED!" celebration and awards a point. The game continues endlessly.

---

## Visual Design

### The Zone Itself
- A rectangular region on the ground: 90px wide × 28px tall (sits ON the ground line,
  extending upward from gndY - 28 to gndY)
- Filled with a semi-transparent laser-red/amber gradient:
  rgba(255, 60, 0, 0.18) → rgba(255, 200, 0, 0.08)
- Top edge: a solid bright line, 2px, color #ff3c00 with shadowBlur=18 (#ff3c00aa)
  — this is the "beam" the card passes through
- Two vertical side lines extend from ground to about 16px above the zone top,
  like scanner guide rails
- Oscillating glow: shadowBlur pulses between 10 and 28 on a ~1.2s sine cycle
- Small "SCAN HERE" label in 10px monospace above the zone, opacity 0.6

### Progress Indicator (while player is inside)
- A horizontal fill bar running along the TOP edge of the zone (same width as zone)
- Starts empty, fills left→right as dwell progresses
- Color: starts #ff3c00, transitions to #00ff88 as it fills
- Bar height: 4px, sits just above the zone top edge
- When bar is 100%: flash the entire zone white for 3 frames, then trigger scan success

### Timeout Indicator
- When zone has been active > 4s without a scan, the zone border starts flickering
  (alpha oscillates rapidly at 8Hz) to signal urgency
- At 7s (zone timeout), zone fades out over 0.3s and disappears

---

## Timing & Dimensions

### Zone Dimensions (scale with level)
| Level range | Zone width | Dwell time |
|-------------|-----------|------------|
| 0–2         | 90px      | 1.4s       |
| 3–5         | 80px      | 1.2s       |
| 6–9         | 72px      | 1.0s       |
| 10+         | 64px      | 0.9s       |

Formula shortcuts:
- zoneW = max(64, 90 - level * 2.8)
- dwellRequired = max(0.9, 1.4 - level * 0.05)  [in seconds]

### Spawn Cadence
- After game start: first zone spawns after a 5s grace period (let player settle)
- After each scan success: next zone spawns after 4–6s delay (random)
- After each zone timeout: next zone spawns after 3–5s delay (random)
- Only ONE zone can exist at a time

### Zone Position
- X position: random, constrained to [W*0.2, W*0.75 - zoneW]
  — avoids far left edge (player spawn) and far right edge (enemy entry)
- Y position: always sits on ground (y = gndY - zoneH, where zoneH = 28)

### Zone Lifetime
- 7.0 seconds before auto-timeout regardless of player interaction
- Dwell timer resets if player exits the zone mid-scan (no banking progress)
- If player re-enters within the same zone lifetime, dwell restarts from 0

---

## Success Event ("SCANNED!")

Sequence on completing dwell:
1. Frame 0: Zone flashes solid white (fillStyle = '#ffffffcc')
2. Frame 0: Scan count increments (React state: setScanCount)
3. Frame 0: Player gets +5 HP, capped at 100 (small reward for risk taken)
4. Frame 1–6: White flash fades out
5. Frame 1–18 (~0.3s): Large "SCANNED!" text appears centered on screen
   - Font: bold 36px, color #00ff88, shadowBlur=24 (#00ff88)
   - Floats upward and fades (translateY -30px, opacity 0→1→0 over 0.5s)
6. Frame 0: Zone removed from state
7. Spawn timer set: next zone spawns after 4000 + rand(2000) ms

### Score on Success
- +100 base scan score
- +10 per HP above 50 at time of scan (rewards healthy play)
- Combo multiplier: if player scanned within 12s of the previous scan, x1.5
  (encourages aggressive play, not camping)

---

## Failure / Timeout Event

When zone times out (7s elapsed, no scan):
1. Zone flashes red 3 times (alpha 0.8 → 0.2 over 3 flashes, 80ms each)
2. Zone fades out over 300ms
3. "-MISSED" text appears briefly at zone position, opacity fade over 0.6s
   - Font: bold 14px, color #ff4444, floats up 20px
4. No HP penalty (harsh enough that it was a wasted opportunity)
5. Spawn timer set: next zone spawns after 3000 + rand(2000) ms

---

## Level Scaling Effects on Scan Zones

### Ball Density During Scan Window
When a scan zone is active, increase spawn pressure:
- `spawnInterval` temporarily reduced by 20% while zone is active
  (i.e., multiply current interval by 0.8)
- This makes reaching the zone genuinely risky — the player must dodge more to get there
- Effect ends immediately when zone disappears (success or timeout)

### Visual Intensity by Level
- Level 0–2: zone glows warm amber (#ffaa00), friendly and inviting
- Level 3–5: zone glows red-orange (#ff6600), more urgent
- Level 6+: zone glows hot red (#ff2200) with stronger pulse, feels dangerous

---

## Scoring System (Full)

### Display
- Add "SCANS: N" to the AppBar alongside HP display
- Show current score as a number (optional secondary display)

### Score Components
| Event              | Points                                  |
|--------------------|-----------------------------------------|
| Scan success       | 100 base                                |
| HP bonus at scan   | +10 per HP above 50 (max +500)          |
| Combo (< 12s gap)  | x1.5 multiplier on scan score           |
| Survival time      | +1 per 2 seconds survived (minor)       |
| Death              | Score preserved but combo resets        |

### Combo System
- Track `lastScanTimestamp`
- If current scan happens within 12 real seconds of last scan: combo x1.5
- Combo does NOT stack beyond x1.5 (keep it simple)
- Death resets combo

---

## State to Add to GameScreen

### Refs (inside game loop)
```
scanZoneRef: { x, y, w, h, spawnTime, dwellProgress, active, flashFrames } | null
scanSpawnTimerRef: number  // counts up in seconds
scanDwellTimerRef: number  // counts up while player inside zone
lastScanTimeRef: number    // for combo detection
scanFlashRef: number       // countdown frames for success flash
missedFlashRef: { x, y, alpha, dy } | null  // floating "-MISSED" text
scannedTextRef: { alpha, dy } | null        // floating "SCANNED!" text
```

### React State (displayed in UI)
```
const [scanCount, setScanCount] = useState(0);
const [score, setScore] = useState(0);
```

---

## Draw Order Integration

Insert scan zone drawing AFTER ground glow, BEFORE circles (so circles visually
pass over the zone, reinforcing that they're dangerous near it):

1. bg gradient
2. grid
3. ground glow + line
4. **SCAN ZONE** (new)
5. circles
6. power-ups
7. player
8. **SCAN ZONE OVERLAYS** (flash text, progress bar — drawn after player so text is on top)

---

## Mobile D-pad Considerations

- The scan zone MUST never spawn in the bottom 25% of canvas height where D-pad overlays sit
  — zone is always on the ground which is at GROUND_OFF=64px from bottom, so it naturally
  clears the D-pad area (D-pad is at bottom:14, buttons are 60–72px tall, so they sit
  from ~bottom 86px up; ground is at bottom 64px — this is a minor overlap to watch)
- Recommendation: increase GROUND_OFF from 64 to 80 on touch devices, or position
  the D-pad higher (bottom: 90px) when a scan zone is active
- The zone is wide enough (64–90px) that a player using only left/right on D-pad can
  reliably navigate to it — do not make it narrower than 64px

---

## Implementation Checklist (for developer)

- [ ] Add ScanZone interface and refs
- [ ] Add scanCount, score useState
- [ ] Add scanZone spawn logic in game loop (after ball spawn block)
- [ ] Add dwell detection: AABB test player vs zone each frame
- [ ] Add success trigger: dwellProgress >= dwellRequired
- [ ] Add timeout trigger: zone.age >= 7.0
- [ ] Add zone draw: rect + top beam line + progress bar + label
- [ ] Add flash/float text draw for SCANNED! and -MISSED
- [ ] Add HP restore on success (p.health = min(100, p.health + 5))
- [ ] Add score calculation on success
- [ ] Update AppBar to show scan count
- [ ] Tune spawnInterval * 0.8 while zone active
- [ ] Test: verify zone never overlaps D-pad on 375px wide mobile viewport
