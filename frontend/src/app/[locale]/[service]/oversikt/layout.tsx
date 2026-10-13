import { CookieConsentSection } from '@components/cookie-consent-section/cookie-consent-section.component';
import { OverviewLayoutSwitcher } from '@components/mobile/overview-layout-switcher.component';
import EmptyLayout from '@layouts/empty-layout/empty-layout.component';

export default function OversiktLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmptyLayout>
      <OverviewLayoutSwitcher>{children}</OverviewLayoutSwitcher>
      <CookieConsentSection />
    </EmptyLayout>
  );
}
