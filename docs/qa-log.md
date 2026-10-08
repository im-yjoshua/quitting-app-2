# Sovereign v2 — QA Log

Per-phase QA: after each phase ships, the diff is reviewed line by line,
issues are opened on GitHub, fixed, and closed via the fix commit
(`Fixes #n` / `Closes #n` — the deploy token can create issues but not
comment on them, so resolutions are recorded here and linked from commits).

## Phase A — editable pledge-time picker (`452c9c1`)

**QA date:** 2026-10-09. **Reviewer:** Jarvis (autopilot).

**Files reviewed:** `services/pledgeTime.ts`, `components/TimePickerSheet.tsx`,
`state/AppStateContext.tsx`, `src/app/(tabs)/you.tsx`,
`__tests__/pledgeTime.test.ts`.

**Checks:**
- Drum re-seed on sheet reopen — SAFE. `Sheet` unmounts children on close;
  the re-seed `useEffect` batches with the mount render, so
  `initialScrollIndex` lands on the correct row. No desync.
- Scroll-end double-fire (`onScrollEndDrag` + `onMomentumScrollEnd`) —
  correctly deduped via post-rerender value comparison. Single haptic per flick.
- Tap-to-select index math (2-row padding offset) — correct.
- Permission-denied path — time still persists; honest "Notifications off"
  alert preserved.
- No new native dependencies — Expo Go compatibility intact.
- 24h drums with 12h live preview — unambiguous, no locale trap.

**Verification:** `tsc` clean · `npm test` 158/158 green (12 suites) ·
`expo lint` clean on all 5 touched files · `expo start` boots, entry
bundle HTTP 200.

**Verdict:** no defects found. Nothing to fix.

## Phase B — real icon + splash artwork (`501119f`)

**QA date:** 2026-10-09. **Reviewer:** Jarvis (autopilot).

**What shipped:** generated brand assets (luminous violet orb on pure black)
installed as `icon.png` (1024x1024), `splash-icon.png`, `favicon.png`
(48x48), Android adaptive foreground / solid-black background /
white-silhouette monochrome; `app.json` canvas colors `#07090E` → `#000000`
(7 occurrences: root, ios, android, adaptiveIcon, splash plugin ×2,
notification color).

**Checks:**
- Icon + splash visually approved (orb matches the redesign's Orb-as-hero
  language; monochrome silhouette alpha verified: 25.3% orb, rest
  transparent — renders correctly as a themed icon).
- `app.json` valid JSON; all referenced asset paths exist on disk.
- `npx expo start`: boots with no asset warnings; entry bundle HTTP 200.
- `npm test`: green.
- Old Expo placeholder files (`react-logo.png`, `expo-logo.png`, …) remain
  on disk but are unreferenced by code or config — left alone (harmless).

**Verdict:** no defects found. Nothing to fix.

## Phase D — QA hardening pass

**QA date:** 2026-10-09. **Reviewer:** Jarvis (autopilot).

**Findings (all fixed + verified):**
1. expo-doctor 20/21 — 9 SDK-57 packages out of date (expo-asset,
   expo-constants, expo-linking, expo-notifications, expo-router + 4).
   Fixed: `npx expo install --fix`. Now 21/21.
2. Last lint error — `setReady(true)` directly in an effect
   (`src/app/_layout.tsx`, vestigial Day-1 gate; state hydration lives in
   AppStateProvider now). Fixed: removed the `ready` gate; splash hides on
   mount, RevenueCat bridge warms in background. First-render timing
   preserved as closely as possible (was: one deferred commit).
3. Unused dep — `@expo/ui`, zero references anywhere. Removed.
   (expo-linking/device/image/web-browser/system-ui kept: Expo platform
   surface, doctor-validated; removing router-adjacent deps risks breakage.)
4. TODO/placeholder scan — all hits legitimate (input hints, skeletons,
   dev-key guard). No dead TODOs.

**Verification:** doctor 21/21 · lint clean · tsc clean · 158/158 tests
green · expo start boots, entry HTTP 200, no errors.

**Verdict:** all findings closed. Nothing outstanding.
