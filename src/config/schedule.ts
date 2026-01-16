export const PERIODS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type PeriodValue = (typeof PERIODS)[number];

export const DAYS = Array.from({ length: 10 }, (_, index) => index + 1);
