/**
 * milestones.test.ts — detection boundaries, once-only firing, re-earn
 * after relapse, and the pure seen-merge.
 *
 * TZ is pinned by the `npm test` script (cross-env TZ=America/New_York).
 */
import {
  MILESTONES,
  detectNewMilestones,
  markMilestonesSeenPure,
  nextMilestone,
} from '../services/milestones';

describe('MILESTONES', () => {
  it('is the spec day-count list', () => {
    expect(MILESTONES).toEqual([1, 3, 7, 14, 30, 60, 90, 180, 365]);
  });
});

describe('detectNewMilestones', () => {
  it('returns nothing before day 1', () => {
    expect(detectNewMilestones(0, [])).toEqual([]);
  });

  it('fires the 1-day milestone on day 1', () => {
    expect(detectNewMilestones(1, [])).toEqual([1]);
  });

  it('does NOT fire the 7-day milestone on day 6 (boundary)', () => {
    expect(detectNewMilestones(6, [])).toEqual([1, 3]);
  });

  it('fires the 7-day milestone on day 7 (boundary)', () => {
    expect(detectNewMilestones(7, [])).toEqual([1, 3, 7]);
  });

  it('each milestone fires exactly once', () => {
    expect(detectNewMilestones(7, [1, 3, 7])).toEqual([]);
    expect(detectNewMilestones(30, [1, 3, 7])).toEqual([14, 30]);
  });

  it('catches up on all missed milestones at once (long streak, fresh state)', () => {
    expect(detectNewMilestones(100, [])).toEqual([1, 3, 7, 14, 30, 60, 90]);
  });

  it('floors fractional days', () => {
    expect(detectNewMilestones(6.9, [])).toEqual([1, 3]);
    expect(detectNewMilestones(7.0, [])).toContain(7);
  });

  it('supports re-earning after relapse (pruned seen list)', () => {
    // relapse.ts prunes milestonesSeen to ≤ the new 0-day streak → []
    expect(detectNewMilestones(3, [])).toEqual([1, 3]);
  });
});

describe('nextMilestone', () => {
  it('returns the next upcoming milestone', () => {
    expect(nextMilestone(0)).toBe(1);
    expect(nextMilestone(7)).toBe(14);
    expect(nextMilestone(29)).toBe(30);
  });

  it('returns null past 365', () => {
    expect(nextMilestone(365)).toBeNull();
    expect(nextMilestone(400)).toBeNull();
  });
});

describe('markMilestonesSeenPure', () => {
  it('merges, dedupes, and sorts', () => {
    expect(markMilestonesSeenPure([7, 1], [3, 7])).toEqual([1, 3, 7]);
  });

  it('handles empty inputs', () => {
    expect(markMilestonesSeenPure([], [])).toEqual([]);
    expect(markMilestonesSeenPure([1], [])).toEqual([1]);
  });
});
