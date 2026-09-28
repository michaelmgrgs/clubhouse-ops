export type Club = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  seconds: number;
  reportStatus: "DRAFT" | "SUBMITTED" | null;
  openIssues: number;
};

export type Visit = {
  id: string;
  clubhouseId: string;
  checkInAt: string;
  verifiedSeconds: number;
  lastPingInside: boolean;
  lastPingAt: string;
};

export type Today = {
  user: { name: string };
  day: string;
  settings: { minMinutes: number; pingIntervalSec: number; maxAccuracyM: number };
  clubhouses: Club[];
  activeVisit: Visit | null;
};

export type Answer = { status: "OK" | "ISSUE" | "NA" | null; note: string | null; photos: string[] };

export type StaffRow = {
  id: string;
  name: string;
  role: string;
  certificateExpiry: string | null;
  check: {
    status: "PRESENT" | "LATE" | "ABSENT" | "OFF" | null;
    uniformOk: boolean | null;
    onPost: boolean | null;
    noPhone: boolean | null;
    note: string | null;
    photos: string[];
  } | null;
};

export type ReportData = {
  report: { id: string; day: string; status: "DRAFT" | "SUBMITTED"; summary: string | null; submittedAt: string | null };
  answers: Record<string, Answer>;
  staff: StaffRow[];
  onSiteSeconds: number;
  minSeconds: number;
};
