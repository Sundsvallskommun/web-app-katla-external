'use client';

// Side effect: registers dayjs plugins and locale data at the top of the tree, before any view
// formats a date. LocalizationProvider sets the language itself.
import '@utils/dayjs-locale';

import { useUserStore } from '@services/user-service/user-service';
import { GuiProvider } from '@sk-web-gui/react';
import { useLocalStorage } from '@utils/use-localstorage.hook';
import { ReactNode, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

interface ClientApplicationProps {
  children: ReactNode;
}

const AppLayout = ({ children }: ClientApplicationProps) => {
  const colorScheme = useLocalStorage(useShallow((state) => state.colorScheme));
  const getMe = useUserStore((state) => state.getMe);

  useEffect(() => {
    void getMe();
  }, [getMe]);

  return (
    <GuiProvider colorScheme={colorScheme}>
      {children}
      {/* <InactivityMonitor /> */}
    </GuiProvider>
  );
};

export default AppLayout;
