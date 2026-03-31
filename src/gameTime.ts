import type { Season } from "./types.ts";

/** One in-game day = 24 engine ticks (十二時辰 × 上/下). */
export const TICKS_PER_CALENDAR_DAY = 24;

/** Thirty in-game days between monthly economy / AI macro cadence. */
export const TICKS_PER_MONTH = 30 * TICKS_PER_CALENDAR_DAY;

/** Three hundred sixty in-game days per yearly catastrophe cadence. */
export const TICKS_PER_YEAR = 360 * TICKS_PER_CALENDAR_DAY;

/** @deprecated Use TICKS_PER_CALENDAR_DAY — kept for any external references. */
export const SHICHEN_PER_DAY = TICKS_PER_CALENDAR_DAY;

/** 子時起，每個「半時辰」對應一個 tick（兩 tick 為一個地支時辰） */
export const EARTHLY_BRANCH_HOURS = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

export type ShichenHalf = "upper" | "lower";

/** Per tick: 1.5× legacy daily march (12 ticks × 1/24), over 24 ticks per day → 3× faster vs prior half-daily pace. */
export const MARCH_FRACTION_PER_TICK = 1.5 / TICKS_PER_CALENDAR_DAY;

export function tickCalendar(tick: number): {
  day: number;
  branchName: (typeof EARTHLY_BRANCH_HOURS)[number];
  half: ShichenHalf;
} {
  const t = Math.max(0, tick - 1);
  const day = Math.floor(t / TICKS_PER_CALENDAR_DAY) + 1;
  const slot = t % TICKS_PER_CALENDAR_DAY;
  const branchName = EARTHLY_BRANCH_HOURS[Math.floor(slot / 2)]!;
  const half: ShichenHalf = slot % 2 === 0 ? "upper" : "lower";
  return { day, branchName, half };
}

/** Season cycles over 360 in-game days. */
export function seasonFromGameTick(tick: number): Season {
  const dayZero = Math.floor(Math.max(0, tick - 1) / TICKS_PER_CALENDAR_DAY);
  const idx = dayZero % 360;
  if (idx < 90) return "SPRING";
  if (idx < 180) return "SUMMER";
  if (idx < 270) return "AUTUMN";
  return "WINTER";
}
