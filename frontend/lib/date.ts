// 'uz-UZ' lokali Intl.DateTimeFormat'da ishonchsiz: oy/hafta kuni nomlari
// (month: 'short'/'long', weekday: 'long') noto'g'ri natija beradi ("15 avgust"
// o'rniga "15 M08"), hattoki raqamli kun/oy tartibi ham kutilganidek emas
// ({day,month}: '2-digit' "15.08" emas, "08-15" qaytaradi — oy oldin keladi).
// Shu sababli HECH QAYERDA toLocaleDateString/toLocaleString'ning oy/kun
// formatlashiga tayanmaymiz — barcha qismlarni Date obyektidan qo'lda o'qib,
// natijani o'zimiz yig'amiz. Shunda muhitdan qat'i nazar bir xil ko'rinadi.

const MONTH_NAMES = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];
const WEEKDAY_NAMES = [
  'yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// "15.08"
export function formatShortDate(d: string | Date): string {
  const date = new Date(d);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

// "15.08.2026"
export function formatDate(d: string | Date): string {
  const date = new Date(d);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

// "14:30"
export function formatTime(d: string | Date): string {
  const date = new Date(d);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// "15.08 14:30"
export function formatDateTime(d: string | Date): string {
  return `${formatShortDate(d)} ${formatTime(d)}`;
}

// "15-avgust, 2026"
export function formatLongDate(d: string | Date): string {
  const date = new Date(d);
  return `${date.getDate()}-${MONTH_NAMES[date.getMonth()]}, ${date.getFullYear()}`;
}

// "Shanba, 15-avgust"
export function formatWeekdayDate(d: string | Date): string {
  const date = new Date(d);
  const weekday = WEEKDAY_NAMES[date.getDay()];
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.getDate()}-${MONTH_NAMES[date.getMonth()]}`;
}
