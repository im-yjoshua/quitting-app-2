/**
 * intensityDeltaCopy — kind copy for the urge-surf end screen.
 *
 * Pure presentation helper: given optional start/end 1–5 intensity
 * ratings, produces one honest line (or null when either rating is
 * missing). Kind, factual copy — the phase-gate language audit greps a
 * banned-word list over the final strings.
 */
import { intensityDeltaCopy } from '../components/ui/logic';

describe('intensityDeltaCopy', () => {
  test('returns null when either rating is missing', () => {
    expect(intensityDeltaCopy(null, 3)).toBeNull();
    expect(intensityDeltaCopy(4, null)).toBeNull();
    expect(intensityDeltaCopy(null, null)).toBeNull();
  });

  test('frames a drop kindly', () => {
    expect(intensityDeltaCopy(4, 2)).toBe('From 4 to 2. The wave passed.');
  });

  test('frames a drop of a single point', () => {
    expect(intensityDeltaCopy(2, 1)).toBe('From 2 to 1. The wave passed.');
  });

  test('frames a steady rating kindly', () => {
    expect(intensityDeltaCopy(3, 3)).toBe('Steady at 3. You stayed with it.');
  });

  test('frames a rise kindly — bigger waves still count', () => {
    expect(intensityDeltaCopy(2, 4)).toBe(
      'From 2 to 4 \u2014 some waves run bigger. You\u2019re still here.'
    );
  });
});
