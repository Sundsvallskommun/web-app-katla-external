import { useEffect } from 'react';

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

/**
 * Calls `onInactive` once the user has been idle for `timeout` ms. Any activity restarts the
 * timer. While `enabled` is false nothing is tracked; turning it back on starts a fresh timer.
 */
export const useInactivityTrigger = ({
  onInactive,
  timeout,
  enabled = true,
}: {
  onInactive: () => void;
  timeout: number;
  enabled?: boolean;
}) => {
  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(onInactive, timeout);
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });
    resetTimer();

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [onInactive, timeout, enabled]);
};
