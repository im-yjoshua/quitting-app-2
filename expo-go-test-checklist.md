# Sovereign v2 — Expo Go iPhone test checklist

~10 minutes. Scan the QR from `npx expo start` with Expo Go on your iPhone 12.
Report back in one message per screen: what feels cheap, broken, or slow.
Everything below is stuff I could NOT verify from the sandbox — you're the
only eyes on it.

## 1. First boot (30s)
- [ ] App opens to onboarding with no red error box, no white flash
- [ ] Pick a quit date/time in the past → confirm the Home ticker shows
      THAT date, not "now" (this was the QA-caught bug — regression check)

## 2. Home — the Orb (1 min)
- [ ] Orb breathes (slow pulse) and brightens as your streak grows
- [ ] Liquid Glass on the floating chrome actually looks like glass on
      your screen — or does it look like a flat gray blur? (I can't see this)
- [ ] Urge FAB opens urge-surf; the pledge card is readable

## 3. Urge surf (1 min)
- [ ] The surf animation runs smooth, not janky, on the real phone
- [ ] Haptics fire at the right moments — or do they feel random/annoying?

## 4. Relapse ritual (1 min)
- [ ] Tone reads compassionate, not scolding
- [ ] Completing it returns you to Home cleanly, streak resets correctly

## 5. Stats / Journal / You (2 min)
- [ ] Charts render monochrome and legible (no clipped labels)
- [ ] Journal entry saves and survives an app restart
- [ ] You screen: everything tappable actually responds

## 6. Paywall (1 min)
- [ ] The 3 tiers read clearly; reskinned design doesn't break layout

## 7. Accessibility pass (2 min) — Settings > Accessibility
- [ ] Largest text size: Orb caption and all labels still readable,
      nothing clipped or overlapping
- [ ] VoiceOver on: swipe through Home → can you reach the Orb, ticker,
      pledge card, and FAB in a sane order?

## How to report
Paste back: screen name + one line ("Home: glass looks flat gray on my
screen", "Urge surf: haptics feel great"). Screenshots help for anything
visual. I'll fix from your notes — no need to debug anything yourself.
