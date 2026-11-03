'use client';

import { StakeholderDTO } from '@data-contracts/backend/data-contracts';
import { getMyStakeholder } from '@services/citizen/citizen-service';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type SelfLoadState = 'error' | 'loading' | 'ready';

interface UseLoadMyStakeholderResult {
  self: StakeholderDTO | undefined;
  selfError: string | null;
  selfLoadState: SelfLoadState;
}

/** The logged in citizen as a stakeholder, resolved once from the session. */
export function useLoadMyStakeholder(): UseLoadMyStakeholderResult {
  const { t } = useTranslation();
  const [self, setSelf] = useState<StakeholderDTO>();
  const [selfLoadState, setSelfLoadState] = useState<SelfLoadState>('loading');

  useEffect(() => {
    let active = true;

    void getMyStakeholder()
      .then((res) => {
        if (!active) return;
        setSelf(res.data);
        setSelfLoadState('ready');
      })
      .catch(() => {
        if (active) setSelfLoadState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  return { self, selfError: selfLoadState === 'error' ? t('api_errors.citizen') : null, selfLoadState };
}
