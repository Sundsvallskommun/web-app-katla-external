import dayjs from 'dayjs';
import type { TFunction } from 'i18next';

/**
 * Formats a timestamp relative to today. `t` is required: with an optional Swedish fallback, a
 * forgotten wire-up would put Swedish words in an English interface with neither a test nor the
 * type checker noticing.
 */
export function prettyTime(time: string, t: TFunction) {
  if (!time) {
    return '';
  }
  const d = dayjs(time);
  const clock = d.format('HH:mm');
  // check if today
  if (d.isSame(dayjs(), 'day')) {
    return t('common:time.today', { time: clock });
  } else if (d.isSame(dayjs().subtract(1, 'day'), 'day')) {
    return t('common:time.yesterday', { time: clock });
  } else {
    return d.format('YYYY-MM-DD HH:mm');
  }
}
