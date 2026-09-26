/**
 * useMilestoneCelebration — fires the celebration sheet exactly once per
 * milestone (spec §1, §2.6).
 *
 * Detection runs on: screen focus, app foreground, and a 30s rollover tick
 * (catches midnight while the app sits open). Newly reached, unseen
 * milestones queue up; the sheet shows them one at a time. Dismissing
 * marks the milestone seen in persisted state, so it never fires twice.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';

import { useAppState } from '../state/AppStateContext';
import {
  detectNewMilestones,
  nextMilestone,
} from '../services/milestones';
import { cleanDaysFloor } from '../services/savings';
import { scheduleMilestoneEve } from '../services/notifications';

const ROLLOVER_CHECK_MS = 30_000;

export function useMilestoneCelebration() {
  const { state, markMilestonesSeen } = useAppState();
  const [queue, setQueue] = useState<number[]>([]);
  const [sharing, setSharing] = useState(false);
  const celebratingRef = useRef(false);
  const sessionSeenRef = useRef<Set<number>>(new Set());

  const check = useCallback(() => {
    const quit = state?.quit;
    if (!quit || celebratingRef.current) return;
    const days = cleanDaysFloor(quit.startDate, Date.now());
    const fresh = detectNewMilestones(days, [
      ...(state?.milestonesSeen ?? []),
      ...sessionSeenRef.current,
    ]).filter((m) => !sessionSeenRef.current.has(m));
    if (fresh.length > 0) {
      celebratingRef.current = true;
      setQueue(fresh);
    }
    // Keep the milestone-eve notification aimed at the next milestone.
    const upcoming = nextMilestone(days);
    if (upcoming !== null && state?.settings.milestoneAlerts) {
      void scheduleMilestoneEve(
        upcoming,
        Date.parse(quit.startDate),
        Date.now()
      );
    }
  }, [state]);

  // Screen focus.
  useFocusEffect(
    useCallback(() => {
      check();
    }, [check])
  );

  // App foreground.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  // Midnight rollover while foregrounded.
  useEffect(() => {
    const id = setInterval(check, ROLLOVER_CHECK_MS);
    return () => clearInterval(id);
  }, [check]);

  const current = queue.length > 0 ? queue[0] : null;

  const dismiss = useCallback(async () => {
    const m = queue[0];
    if (m !== undefined) {
      sessionSeenRef.current.add(m);
      await markMilestonesSeen([m]);
      setQueue((q) => q.slice(1));
    }
    setSharing(false);
    if (queue.length <= 1) {
      celebratingRef.current = false;
    }
  }, [queue, markMilestonesSeen]);

  const share = useCallback(() => {
    setSharing(true);
  }, []);

  const closeShare = useCallback(() => {
    setSharing(false);
  }, []);

  return {
    /** Milestone day-count currently being celebrated, or null. */
    celebration: current,
    dismissCelebration: dismiss,
    /** Whether the share sheet is open for the current celebration. */
    shareOpen: sharing,
    openShare: share,
    closeShare,
  };
}
