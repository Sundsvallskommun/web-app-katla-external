const CENTURY = 100;
const TWELVE_DIGITS = /^(\d{4})(\d{2})(\d{2})\d{4}$/;
const TEN_DIGITS = /^(\d{2})(\d{2})(\d{2})\d{4}$/;
// A coordination number is a person number with 60 added to the day.
const COORDINATION_NUMBER_DAY_OFFSET = 60;

/** The date itself, or undefined when the digits do not name a real day. */
const toBirthDate = (year: number, month: number, day: number): Date | undefined => {
  const birthDay = day > COORDINATION_NUMBER_DAY_OFFSET ? day - COORDINATION_NUMBER_DAY_OFFSET : day;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, birthDay);
  date.setUTCHours(0, 0, 0, 0);

  const rolledOver = date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== birthDay;
  return rolledOver ? undefined : date;
};

const isBorn = (date: Date | undefined): date is Date => date !== undefined && date.getTime() <= Date.now();

/**
 * Luhn over the ten-digit form. A coordination number is checked exactly as written, with the +60
 * still in the day, so the offset needs no special handling here.
 */
const hasValidCheckDigit = (tenDigits: string): boolean => {
  let sum = 0;

  for (const [position, digit] of (tenDigits.match(/\d/g) ?? []).entries()) {
    const weighted = Number(digit) * (position % 2 === 0 ? 2 : 1);
    sum += weighted > 9 ? weighted - 9 : weighted;
  }

  return sum % 10 === 0;
};

/**
 * Normalises a person number to the twelve digits every upstream API expects, or undefined when
 * the input is not one. The IdP may send it ten-digit, hyphenated, or with the '+' separator that
 * Skatteverket uses once a person has turned 100 — the only thing that tells a ten-digit 05 in
 * 2005 from one in 1905.
 *
 * A ten-digit number is expanded to the most recent century that does not put the birth date in
 * the future. Coordination numbers (day + 60) are accepted; a bad check digit, a date that does
 * not exist, or one that has not happened yet, is rejected rather than reinterpreted.
 */
export const sanitizePersonNumber = (input: string | undefined | null): string | undefined => {
  if (!input) return undefined;

  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');

  const twelveDigit = TWELVE_DIGITS.exec(digits);
  if (twelveDigit) {
    const [, year, month, day] = twelveDigit;
    if (!hasValidCheckDigit(digits.slice(2))) return undefined;
    return isBorn(toBirthDate(Number(year), Number(month), Number(day))) ? digits : undefined;
  }

  const tenDigit = TEN_DIGITS.exec(digits);
  if (!tenDigit) return undefined;
  if (!hasValidCheckDigit(digits)) return undefined;

  const [, yearSuffix, month, day] = tenDigit;
  const currentCentury = Math.floor(new Date().getUTCFullYear() / CENTURY) * CENTURY;

  let year = currentCentury + Number(yearSuffix);
  if (!isBorn(toBirthDate(year, Number(month), Number(day)))) year -= CENTURY;
  if (raw.includes('+')) year -= CENTURY;

  const birthDate = toBirthDate(year, Number(month), Number(day));
  if (!isBorn(birthDate)) return undefined;

  return `${year}${digits.slice(2)}`;
};
