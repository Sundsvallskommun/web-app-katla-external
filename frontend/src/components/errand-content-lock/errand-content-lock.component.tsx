'use client';

import { ErrandContentLockContext, useErrandLocked } from '@contexts/errand-content-lock-context';
import { cx } from '@sk-web-gui/react';
import { ReactNode } from 'react';

interface ErrandContentLockProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const ErrandContentLock: React.FC<ErrandContentLockProps> = ({ children, className, disabled = false }) => {
  const lockedByErrand = useErrandLocked();
  const isLocked = disabled || lockedByErrand;

  return (
    <ErrandContentLockContext.Provider value={isLocked}>
      <fieldset
        aria-disabled={isLocked}
        className={cx('min-w-0 border-0 p-0 m-0', isLocked && 'pointer-events-none opacity-80', className)}
        disabled={isLocked}
      >
        {children}
      </fieldset>
    </ErrandContentLockContext.Provider>
  );
};
