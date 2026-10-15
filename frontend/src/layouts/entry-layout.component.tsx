import { LanguageSwitchButton } from '@components/misc/language-switch-button.component';
import { cx, Logo } from '@sk-web-gui/react';

import EmptyLayout from './empty-layout/empty-layout.component';

export const EntryLayout: React.FC<{
  children: React.ReactNode;
  className?: string;
  logoClasses?: string;
}> = ({ children, className, logoClasses }) => {
  return (
    <EmptyLayout>
      <div className="relative">
        {/* Login comes before everything else, and it is where a user who does not read Swedish
            first meets the app. Without the language control here they would have to log in in a
            language they do not understand before they could change it. */}
        <div className="absolute top-0 right-0 z-10 p-16 pt-[calc(1.6rem+env(safe-area-inset-top))] lg:p-24">
          <LanguageSwitchButton />
        </div>
        <div className="absolute w-full bg-vattjom-background-200">
          <div className="h-[26.4rem] max-w-[100rem] mx-auto relative overflow-hidden">
            <div className="hidden lg:block -mt-[4rem] -ml-34 absolute w-[36rem]">
              <Logo variant="symbol" className="text-vattjom-surface-accent" />
            </div>
          </div>
        </div>
        <div
          className={cx('relative flex flex-col items-center justify-center px-20 py-40 lg:py-80 lg:px-40', className)}
        >
          <Logo
            variant="logo"
            className={cx(`text-black w-[16.4rem] h-[5.6rem] lg:h-[7.2rem] mb-32 lg:mb-48`, logoClasses)}
          />
          {children}
        </div>
      </div>
    </EmptyLayout>
  );
};
