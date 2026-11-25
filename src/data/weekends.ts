// Country → weekend days (0 = Sunday … 6 = Saturday). Picking a university sets
// the student's weekend from its country; they can still change it on the first
// day ("Weekend: Fri–Sat", tap to change). The engine itself never assumes one.
//
// TODO(review): checked against public sources in Nov 2026, but weekends change
// (UAE moved to Sat–Sun in 2022) and universities don't always follow the
// government week. Entries marked "check" are the least certain.

/** Most of the world, incl. the US and Europe. */
export const DEFAULT_WEEKEND = [6, 0]

const FRI_SAT = [5, 6]

export const WEEKENDS: Record<string, number[]> = {
  // Fri–Sat: most Arab countries
  JO: FRI_SAT,
  SA: FRI_SAT,
  EG: FRI_SAT,
  IQ: FRI_SAT,
  KW: FRI_SAT,
  QA: FRI_SAT,
  BH: FRI_SAT,
  OM: FRI_SAT,
  DZ: FRI_SAT,
  LY: FRI_SAT,
  SD: FRI_SAT,
  SY: FRI_SAT,
  YE: FRI_SAT,
  PS: FRI_SAT,
  IL: FRI_SAT,
  BD: FRI_SAT,
  MV: FRI_SAT,
  // Sat–Sun exceptions in the region (same as the default, listed so nobody "fixes" them)
  AE: [6, 0], // since Jan 2022 (Friday is a half day)
  MA: [6, 0],
  TN: [6, 0],
  LB: [6, 0],
  MR: [6, 0], // since 2019, check
  TR: [6, 0],
  PK: [6, 0],
  // Unusual weekends
  IR: [5], // Friday only (Thursday often half), check: a Sat move has been discussed
  AF: [5, 6], // check: Thu–Fri before 2021
  NP: [6, 0], // Sat–Sun since 6 Apr 2026 (cabinet decision, fuel crisis; was Saturday only), check it lasts
  BN: [5, 0], // Friday + Sunday
  IN: [0], // Sunday only; many universities also close Saturday
  // MY: varies by state (Kelantan, Terengganu, Kedah: Fri–Sat); default Sat–Sun, check
}

export function weekendFor(country: string | undefined): number[] {
  return [...((country && WEEKENDS[country.toUpperCase()]) || DEFAULT_WEEKEND)]
}

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Monday-first, so Sat + Sun reads "Sat–Sun" and Fri + Sat "Fri–Sat". */
const mondayFirst = (d: number) => (d + 6) % 7

/** [5, 6] → "Fri–Sat"; [5] → "Fri"; [5, 0] → "Fri, Sun"; [] → "None". */
export function weekendLabel(days: number[]): string {
  const ds = [...new Set(days)].sort((a, b) => mondayFirst(a) - mondayFirst(b))
  if (ds.length === 0) return 'None'
  const runs = ds.every((d, i) => i === 0 || mondayFirst(d) === mondayFirst(ds[i - 1]) + 1)
  return runs && ds.length > 1 ? `${SHORT[ds[0]]}–${SHORT[ds.at(-1)!]}` : ds.map((d) => SHORT[d]).join(', ')
}
