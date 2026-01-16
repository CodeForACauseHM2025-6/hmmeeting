import { PeriodValue } from "./schedule";

export type DevUser = {
  email: string;
  fullName: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  schedule: { day: number; period: PeriodValue }[];
};

export const DEV_USERS: DevUser[] = [
  {
    email: "dev.student1@horacemann.org",
    fullName: "Dev Student One",
    role: "STUDENT",
    schedule: [
      { day: 1, period: "A" },
      { day: 1, period: "C" },
      { day: 2, period: "E" },
      { day: 3, period: "B" },
    ],
  },
  {
    email: "dev.teacher1@horacemann.org",
    fullName: "Dev Teacher One",
    role: "TEACHER",
    schedule: [
      { day: 1, period: "A" },
      { day: 1, period: "B" },
      { day: 2, period: "D" },
      { day: 4, period: "F" },
    ],
  },
  {
    email: "dev.admin@horacemann.org",
    fullName: "Dev Admin",
    role: "ADMIN",
    schedule: [
      { day: 5, period: "C" },
      { day: 6, period: "E" },
    ],
  },
];
