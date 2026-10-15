'use client';

import { OrganizationDTO } from '@data-contracts/backend/data-contracts';
import { getMyOrganizations } from '@services/organization-service/organization-service';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type OrganizationsLoadState = 'error' | 'loading' | 'ready';

interface UseMyOrganizationsResult {
  organizations: OrganizationDTO[];
  organizationsError: string | null;
  organizationsLoadState: OrganizationsLoadState;
}

/** The organisations the citizen may file an errand for. */
export function useMyOrganizations(): UseMyOrganizationsResult {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState<OrganizationDTO[]>([]);
  const [organizationsLoadState, setOrganizationsLoadState] = useState<OrganizationsLoadState>('loading');

  useEffect(() => {
    let active = true;

    void getMyOrganizations()
      .then((res) => {
        if (!active) return;
        setOrganizations(res);
        setOrganizationsLoadState('ready');
      })
      .catch(() => {
        if (active) setOrganizationsLoadState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    organizations,
    organizationsError: organizationsLoadState === 'error' ? t('api_errors.organizations') : null,
    organizationsLoadState,
  };
}
