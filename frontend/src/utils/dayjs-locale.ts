import 'dayjs/locale/sv';
import 'dayjs/locale/en';

import dayjs from 'dayjs';
import updateLocale from 'dayjs/plugin/updateLocale';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(updateLocale);

// Capitalised month names are house style; the dayjs Swedish locale writes them lowercase.
// English month names are already capitalised and need no equivalent fix.
dayjs.updateLocale('sv', {
  months: [
    'Januari',
    'Februari',
    'Mars',
    'April',
    'Maj',
    'Juni',
    'Juli',
    'Augusti',
    'September',
    'Oktober',
    'November',
    'December',
  ],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
});

/**
 * Keeps the global dayjs locale in step with the interface language. The design system's date
 * fields format through dayjs, so without this they would keep showing Swedish month and weekday
 * names in an English interface.
 */
export const setDayjsLocale = (locale: string): void => {
  dayjs.locale(locale);
};
