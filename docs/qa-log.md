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
