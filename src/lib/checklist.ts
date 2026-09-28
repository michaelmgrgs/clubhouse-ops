// Daily inspection checklist, derived from the contract KPIs for each role.
// Shared by the manager app and the server. Answers store a snapshot of the
// label, so editing wording here won't rewrite past reports. Renaming a `key`
// starts a fresh item.

export type PhotoRule = "required" | "optional";

export type ChecklistItem = {
  key: string;
  label: string;
  hint?: string;
  photo?: PhotoRule;
};

export type ChecklistSection = {
  key: string;
  title: string;
  items: ChecklistItem[];
};

export const CHECKLIST: ChecklistSection[] = [
  {
    key: "reception",
    title: "Reception",
    items: [
      { key: "rec_presence", label: "Receptionist present at the desk", hint: "Continuous coverage 8 AM – 10 PM" },
      { key: "rec_appearance", label: "Uniform & dress code compliant" },
      { key: "rec_clean", label: "Reception clean and organized", photo: "required" },
      { key: "rec_log", label: "Visitor / member log up to date and accurate", photo: "optional" },
      { key: "rec_access", label: "Access control enforced, no unauthorized entry" },
      { key: "rec_calls", label: "Calls answered, bookings & inquiries handled" },
      { key: "rec_phone", label: "No personal mobile use on duty" },
    ],
  },
  {
    key: "gym",
    title: "Gym",
    items: [
      { key: "gym_hours", label: "Gym open per approved hours (8 AM – 10 PM)" },
      { key: "gym_supervision", label: "Trainer on the floor supervising & guiding residents" },
      { key: "gym_inspection", label: "Daily equipment inspection done", photo: "required" },
      { key: "gym_defects", label: "All equipment working (defects reported)", hint: "Log any defect under Maintenance" },
      { key: "gym_clean", label: "Equipment & gym area clean", photo: "required" },
      { key: "gym_hse", label: "Health, safety & hygiene standards met" },
      { key: "gym_phone", label: "No personal mobile use on duty" },
    ],
  },
  {
    key: "pool",
    title: "Pool",
    items: [
      { key: "pool_lifeguard", label: "Certified lifeguard at the pool", hint: "Pool hours 8 AM – 6 PM. Use N/A outside pool hours.", photo: "required" },
      { key: "pool_unattended", label: "No unattended pool periods observed" },
      { key: "pool_rescue", label: "Rescue & safety equipment inspected, good condition", photo: "required" },
      { key: "pool_rules", label: "Pool rules enforced, no overcrowding or unsafe behaviour" },
      { key: "pool_clean", label: "Pool, deck & water clean", photo: "optional" },
      { key: "pool_phone", label: "No personal mobile use on duty" },
    ],
  },
  {
    key: "facility",
    title: "Facility & Hygiene",
    items: [
      { key: "fac_common", label: "Common areas clean", photo: "required" },
      { key: "fac_washrooms", label: "Washrooms / changing rooms clean & stocked", photo: "optional" },
      { key: "fac_snags", label: "No new civil / MEP snags", hint: "Log any snag under Maintenance (48h SLA)" },
      { key: "fac_furniture", label: "Furniture & fittings in good condition" },
      { key: "fac_safety", label: "Fire exits clear, first-aid kit stocked" },
    ],
  },
  {
    key: "manager",
    title: "Manager Duties",
    items: [
      { key: "mgr_briefing", label: "Staff briefing done" },
      { key: "mgr_complaints", label: "All complaints received today logged & escalated" },
      { key: "mgr_followup", label: "Open maintenance issues followed up" },
    ],
  },
];

export const ALL_ITEMS = CHECKLIST.flatMap((s) => s.items.map((i) => ({ ...i, section: s.key })));

export function findItem(key: string) {
  return ALL_ITEMS.find((i) => i.key === key);
}

export const STAFF_ROLE_LABEL: Record<string, string> = {
  RECEPTIONIST: "Receptionist",
  LIFEGUARD: "Lifeguard",
  GYM_TRAINER: "Gym Trainer",
  OTHER: "Other",
};

export const INCIDENT_TYPES = ["COMPLAINT", "SAFETY", "MEDICAL", "SECURITY", "STAFF", "OTHER"] as const;
export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const ISSUE_CATEGORIES = ["CIVIL", "MEP", "FURNITURE", "EQUIPMENT"] as const;
/** Contract SLA for closing civil / MEP issues. */
export const SLA_HOURS = 48;

export const ESCALATION_TARGETS = ["Community Management", "Operations", "HSE", "Security"] as const;

export function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}
