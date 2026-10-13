import initLocalization from '@app/i18n';
import { CreatedErrand } from '@components/errand-pages/created-errand.component';

interface GrundinformationProps {
  params: Promise<{ locale: string; errandnumber: string }>;
}

/** The layout derives titles from the URL segments, which reads badly for errand pages. */
export const generateMetadata = async ({ params }: GrundinformationProps) => {
  const { locale, errandnumber } = await params;
  const { t } = await initLocalization(locale, ['errand-information']);

  return { title: `${process.env.NEXT_PUBLIC_APP_NAME} - ${t('errand-information:errand')}${errandnumber}` };
};

export default function Grundinformation() {
  return <CreatedErrand />;
}
