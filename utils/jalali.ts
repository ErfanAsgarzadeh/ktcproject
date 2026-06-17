/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jalali (Persian/Hijri Shamsi) calendar conversion utilities.
 * Pure JavaScript implementation — no external dependencies.
 *
 * Conversion core based on the well-known jalaali algorithm
 * (Behrang Noruzi Niya / Roozbeh Pournader), public domain.
 *
 * Convention:
 *   - The BACKEND always stores/receives Gregorian dates ("YYYY-MM-DD").
 *   - The UI displays Jalali and accepts Jalali input.
 *   - Use `gregorianToJalaliString` for display.
 *   - Use `jalaliToGregorian` / `gregorianToJalali` for picker logic.
 */

function div(a: number, b: number): number {
  return Math.floor(a / b);
}
function mod(a: number, b: number): number {
  return a - Math.floor(a / b) * b;
}

interface JalCal {
  leap: number;
  gy: number;
  march: number;
}

function jalCal(jy: number): JalCal {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm: number;
  let jump = 0;
  let leap: number;
  let leapG: number;
  let march: number;
  let n: number;
  let i: number;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('Invalid Jalali year ' + jy);
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd: number;
  let jm: number;
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

// ─────────────────────────────────────────────
// Public conversion API
// ─────────────────────────────────────────────

export interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

/** Gregorian (y, m, d) → Jalali (jy, jm, jd). Month is 1-based. */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliParts {
  return d2j(g2d(gy, gm, gd));
}

/** Jalali (jy, jm, jd) → Gregorian (gy, gm, gd). Month is 1-based. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

/** Number of days in a given Jalali month. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: 29 or 30 (leap)
  return jalCal(jy).leap === 0 ? 30 : 29;
}

// ─────────────────────────────────────────────
// Persian month / weekday names
// ─────────────────────────────────────────────

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const JALALI_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه',
];
// Note: JS getDay() returns 0=Sunday..6=Saturday — index aligns above.

// ─────────────────────────────────────────────
// Parsing helpers (handle "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS" / ISO)
// ─────────────────────────────────────────────

function parseDateParts(dateStr: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  if (!dateStr) return null;
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;

  let hh = 0;
  let mm = 0;
  const timePart = dateStr.includes('T')
    ? dateStr.split('T')[1]
    : dateStr.includes(' ')
      ? dateStr.split(' ')[1]
      : null;
  if (timePart) {
    const tp = timePart.split(':').map(Number);
    hh = tp[0] || 0;
    mm = tp[1] || 0;
  }
  return { y, m, d, hh, mm };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// ─────────────────────────────────────────────
// Display formatters (Latin digits, clean for mono UI)
// ─────────────────────────────────────────────

/** "2026-06-17" → "1405/03/27" */
export function gregorianToJalaliString(dateStr?: string | null): string {
  const p = parseDateParts(dateStr || '');
  if (!p) return '—';
  const { jy, jm, jd } = gregorianToJalali(p.y, p.m, p.d);
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

/** "2026-06-17 11:46:00" → "1405/03/27 11:46" */
export function gregorianToJalaliDateTime(dateStr?: string | null): string {
  const p = parseDateParts(dateStr || '');
  if (!p) return '—';
  const { jy, jm, jd } = gregorianToJalali(p.y, p.m, p.d);
  return `${jy}/${pad2(jm)}/${pad2(jd)} ${pad2(p.hh)}:${pad2(p.mm)}`;
}

/** "2026-06-17" → "۲۷ خرداد ۱۴۰۵" style with Persian month name */
export function gregorianToJalaliLong(dateStr?: string | null): string {
  const p = parseDateParts(dateStr || '');
  if (!p) return '—';
  const { jy, jm, jd } = gregorianToJalali(p.y, p.m, p.d);
  return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
}

/** Time-only "11:46" from a datetime string */
export function timeOnly(dateStr?: string | null): string {
  const p = parseDateParts(dateStr || '');
  if (!p) return '';
  return `${pad2(p.hh)}:${pad2(p.mm)}`;
}

// ─────────────────────────────────────────────
// Picker conversions (ISO <-> Jalali parts)
// ─────────────────────────────────────────────

/** Gregorian ISO "YYYY-MM-DD" → Jalali parts (for picker state). */
export function isoToJalaliParts(iso?: string | null): JalaliParts | null {
  const p = parseDateParts(iso || '');
  if (!p) return null;
  return gregorianToJalali(p.y, p.m, p.d);
}

/** Jalali parts → Gregorian ISO "YYYY-MM-DD" (to send to backend). */
export function jalaliPartsToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

/** Today as Jalali parts. */
export function todayJalali(): JalaliParts {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** JS Date object → Jalali parts. */
export function jalaliFromDate(date: Date): JalaliParts {
  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
