export const MAX_SCENES = 120;
export function durationBudget(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1800) throw new Error('编稿时长需要在 0～1800 秒之间');
  const scenes = Math.min(MAX_SCENES, Math.max(2, Math.round(seconds / 12)));
  // Leave room for sentence padding and scene holds. Actual audio remains authoritative.
  const characters = Math.max(20, Math.round(Math.max(1, seconds - scenes * 1.2) * 3));
  return {seconds, scenes, characters, experimental: seconds > 240};
}
