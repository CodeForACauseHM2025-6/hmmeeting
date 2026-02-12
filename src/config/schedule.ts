export const PERIODS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type PeriodValue = (typeof PERIODS)[number];

export const DAYS = Array.from({ length: 10 }, (_, index) => index + 1);

export type WeekValue = 1 | 2;

export const SCHOOL_TIMEZONE = "America/New_York";

export const PERIOD_TIME_RANGES: Record<
  PeriodValue,
  {
    start: { hour: number; minute: number };
    end: { hour: number; minute: number };
    label: string;
  }
> = {
  A: { start: { hour: 8, minute: 25 }, end: { hour: 9, minute: 10 }, label: "8:25 AM - 9:10 AM" },
  B: { start: { hour: 9, minute: 15 }, end: { hour: 10, minute: 0 }, label: "9:15 AM - 10:00 AM" },
  C: { start: { hour: 10, minute: 20 }, end: { hour: 11, minute: 5 }, label: "10:20 AM - 11:05 AM" },
  D: { start: { hour: 11, minute: 10 }, end: { hour: 11, minute: 55 }, label: "11:10 AM - 11:55 AM" },
  E: { start: { hour: 12, minute: 0 }, end: { hour: 12, minute: 45 }, label: "12:00 PM - 12:45 PM" },
  F: { start: { hour: 12, minute: 50 }, end: { hour: 13, minute: 35 }, label: "12:50 PM - 1:35 PM" },
  G: { start: { hour: 13, minute: 40 }, end: { hour: 14, minute: 25 }, label: "1:40 PM - 2:25 PM" },
  H: { start: { hour: 14, minute: 30 }, end: { hour: 15, minute: 15 }, label: "2:30 PM - 3:15 PM" },
};

const DAY_OFFSETS = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ScheduleSettings = {
  currentWeek: WeekValue;
  weekSetAt: Date | string;
};

type DateParts = { year: number; month: number; day: number };

function getZonedDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");
  return { year, month, day };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const zonedDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return date.getTime() - zonedDate.getTime();
}

function makeZonedDate(
  parts: DateParts & { hour: number; minute: number },
  timeZone: string
) {
  const utcDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  );
  const offset = getTimeZoneOffsetMs(utcDate, timeZone);
  return new Date(utcDate.getTime() + offset);
}

function addDaysToParts(parts: DateParts, days: number): DateParts {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + days);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function toUtcDayNumber(parts: DateParts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY);
}

function getCurrentWeekMondayParts(now: Date, timeZone: string) {
  const todayParts = getZonedDateParts(now, timeZone);
  const dayOfWeek = new Date(
    Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day)
  ).getUTCDay();
  if (dayOfWeek === 0) {
    return addDaysToParts(todayParts, 1);
  }
  return addDaysToParts(todayParts, 1 - dayOfWeek);
}

function countSundaysSince(from: Date, to: Date, timeZone: string) {
  const startParts = getZonedDateParts(from, timeZone);
  const endParts = getZonedDateParts(to, timeZone);
  const startKey = toUtcDayNumber(startParts);
  const endKey = toUtcDayNumber(endParts);
  if (endKey < startKey) {
    return 0;
  }

  const startDayOfWeek = new Date(
    Date.UTC(startParts.year, startParts.month - 1, startParts.day)
  ).getUTCDay();
  let daysUntilSunday = (7 - startDayOfWeek) % 7;
  if (daysUntilSunday === 0) {
    daysUntilSunday = 7;
  }

  const firstSundayParts = addDaysToParts(startParts, daysUntilSunday);
  const firstSundayKey = toUtcDayNumber(firstSundayParts);
  if (firstSundayKey > endKey) {
    return 0;
  }

  return 1 + Math.floor((endKey - firstSundayKey) / 7);
}

export function getEffectiveWeek(settings: ScheduleSettings, now = new Date()): WeekValue {
  const setAt = settings.weekSetAt instanceof Date ? settings.weekSetAt : new Date(settings.weekSetAt);
  const sundaysSinceSet = countSundaysSince(setAt, now, SCHOOL_TIMEZONE);
  if (sundaysSinceSet % 2 === 0) {
    return settings.currentWeek;
  }
  return settings.currentWeek === 1 ? 2 : 1;
}

export function buildDayDateMap(
  settings: ScheduleSettings,
  now = new Date(),
  options?: { preferFuture?: boolean }
) {
  const effectiveWeek = getEffectiveWeek(settings, now);
  const preferFuture = options?.preferFuture ?? true;
  const todayParts = getZonedDateParts(now, SCHOOL_TIMEZONE);
  const todayKey = toUtcDayNumber(todayParts);
  const currentWeekMondayParts = getCurrentWeekMondayParts(now, SCHOOL_TIMEZONE);
  const cycleStartParts =
    effectiveWeek === 1 ? currentWeekMondayParts : addDaysToParts(currentWeekMondayParts, -7);

  const dayDates: Record<number, Date> = {};
  DAYS.forEach((dayNumber) => {
    const offset = DAY_OFFSETS[dayNumber - 1] ?? dayNumber - 1;
    let dateParts = addDaysToParts(cycleStartParts, offset);
    if (preferFuture && toUtcDayNumber(dateParts) < todayKey) {
      dateParts = addDaysToParts(dateParts, 14);
    }
    dayDates[dayNumber] = makeZonedDate(
      { ...dateParts, hour: 0, minute: 0 },
      SCHOOL_TIMEZONE
    );
  });

  return {
    effectiveWeek,
    cycleStartMonday: makeZonedDate(
      { ...cycleStartParts, hour: 0, minute: 0 },
      SCHOOL_TIMEZONE
    ),
    dayDates,
  };
}

export function formatScheduleDate(date: Date, locale?: string) {
  return new Intl.DateTimeFormat(locale ?? "en-US", {
    month: "short",
    day: "numeric",
    timeZone: SCHOOL_TIMEZONE,
  }).format(date);
}

export function formatPeriodTimeRange(period: PeriodValue) {
  return PERIOD_TIME_RANGES[period].label;
}

export function getMeetingDateTime(dayDate: Date, period: PeriodValue) {
  const dateParts = getZonedDateParts(dayDate, SCHOOL_TIMEZONE);
  const times = PERIOD_TIME_RANGES[period];
  const start = makeZonedDate(
    { ...dateParts, hour: times.start.hour, minute: times.start.minute },
    SCHOOL_TIMEZONE
  );
  const end = makeZonedDate(
    { ...dateParts, hour: times.end.hour, minute: times.end.minute },
    SCHOOL_TIMEZONE
  );
  return { start, end };
}

export function formatMeetingDateTime(dayDate: Date, period: PeriodValue, locale?: string) {
  const { start, end } = getMeetingDateTime(dayDate, period);
  return {
    dateLabel: formatScheduleDate(start, locale),
    timeLabel: formatPeriodTimeRange(period),
    start,
    end,
  };
}
