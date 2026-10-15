'use client';

import CountdownTimer from '@components/countdown/countdown-timer.component';
import { Button, Dialog } from '@sk-web-gui/react';
import { AlarmClock } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// TEST MODE: Set to true to show dialog immediately with 1 hour countdown
const TEST_MODE = false;

const INACTIVITY_WARNING_TIMEOUT = process.env.NEXT_PUBLIC_INACTIVITY_WARNING_TIMEOUT;
const INACTIVITY_COUNTDOWN_TIMEOUT = process.env.NEXT_PUBLIC_INACTIVITY_COUNTDOWN_TIMEOUT;

// Feature is only enabled if both environment variables are set
const INACTIVITY_ENABLED = !!(INACTIVITY_WARNING_TIMEOUT && INACTIVITY_COUNTDOWN_TIMEOUT) || TEST_MODE;

// (x ?? '') || '0' keeps || semantics: an empty string also falls back to '0'.
const INACTIVITY_WARNING_TIME = TEST_MODE ? 0 : parseInt((INACTIVITY_WARNING_TIMEOUT ?? '') || '0', 10);
const WARNING_COUNTDOWN_TIME = TEST_MODE ? 3600000 : parseInt((INACTIVITY_COUNTDOWN_TIMEOUT ?? '') || '0', 10);

export const InactivityMonitor: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  // The hook must always run; it must not sit behind an early return.
  const { t } = useTranslation('session');

  const [showWarning, setShowWarning] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = INACTIVITY_ENABLED && !pathname?.includes('login') && !pathname?.includes('logout');

  const handleLogout = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setShowWarning(false);
    router.push('/logout');
  }, [router]);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    countdownTimerRef.current = setTimeout(() => {
      handleLogout();
    }, WARNING_COUNTDOWN_TIME);
  }, [handleLogout]);

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (!isActive) return;

    inactivityTimerRef.current = setTimeout(() => {
      startCountdown();
    }, INACTIVITY_WARNING_TIME);
  }, [isActive, startCountdown]);

  const handleStayLoggedIn = useCallback(() => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setShowWarning(false);
    startInactivityTimer();
  }, [startInactivityTimer]);

  useEffect(() => {
    if (!isActive) return;

    const handleActivity = () => {
      if (!showWarning) {
        startInactivityTimer();
      }
    };

    const events: (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    startInactivityTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [isActive, showWarning, startInactivityTimer]);

  if (!INACTIVITY_ENABLED) {
    return null;
  }

  return (
    <Dialog show={showWarning} onClose={handleStayLoggedIn}>
      <Dialog.Content className="max-w-[36rem] min-h-[24rem] bg-background-content rounded-[2rem] flex flex-col justify-between items-center">
        <div className="flex items-center justify-center">
          <AlarmClock size={32} className="text-vattjom-surface-primary" />
        </div>

        <div className="flex flex-col items-center gap-[1.6rem]">
          <h3 className="text-center text-dark-primary">{t('warning_title')}</h3>

          <div className="text-center">
            <span className="text-dark-secondary text-md font-normal">{t('warning_message')} </span>
            <span className="text-dark-secondary text-md font-bold">
              <CountdownTimer timeout={WARNING_COUNTDOWN_TIME} />
            </span>
            <span className="text-dark-secondary text-md font-normal">. {t('warning_message_suffix')}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-[1rem] sm:gap-[1.2rem] w-full sm:w-auto">
          <Button variant="secondary" size="md" onClick={handleLogout}>
            {t('logout_button')}
          </Button>
          <Button variant="primary" size="md" onClick={handleStayLoggedIn}>
            {t('stay_button')}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
