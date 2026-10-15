'use client';

import { ErrandLifecycle } from '@interfaces/errand-form';
import { ErrandQuery, getErrandsCount } from '@services/errand-service/errand-service';
import { CircleCheckBig, ClipboardPen, SquarePen } from 'lucide-react';
import { createElement, ReactElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'src/config/appconfig';
import { useErrandCountStore } from 'src/stores/errand-count-store';
import { useFilterStore } from 'src/stores/filter-store';
import { useSortStore } from 'src/stores/sort-store';

export interface StatusButton {
  label: string;
  statuses: string[];
  lifecycle?: ErrandLifecycle;
  icon: ReactElement;
  errandsCount: number;
}

export function useStatusButtons() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { activeStatus, setActiveStatus, setStatuses, setLifecycle } = useFilterStore();
  const {
    newErrandCount,
    draftErrandCount,
    closedErrandCount,
    setNewErrandCount,
    setDraftErrandCount,
    setClosedErrandCount,
  } = useErrandCountStore();
  const { reset } = useSortStore();
  const draftEnabled = appConfig.features.draftEnabled;

  useEffect(() => {
    if (!activeStatus) {
      setActiveStatus(t('filtering:errands.open'));
    }
  }, [t, activeStatus, setActiveStatus]);

  const allStatusButtons: StatusButton[] = [
    {
      label: t('filtering:errands.open'),
      statuses: ['NEW'],
      icon: createElement(ClipboardPen),
      errandsCount: newErrandCount,
    },
    {
      label: t('filtering:errands.draft'),
      statuses: [],
      lifecycle: 'DRAFT',
      icon: createElement(SquarePen),
      errandsCount: draftErrandCount,
    },
    {
      label: t('filtering:errands.closed'),
      statuses: ['SOLVED'],
      icon: createElement(CircleCheckBig),
      errandsCount: closedErrandCount,
    },
  ];

  const statusButtons =
    draftEnabled ? allStatusButtons : allStatusButtons.filter((button) => button.lifecycle !== 'DRAFT');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    const requests: { query: ErrandQuery; apply: (count: number) => void }[] = [
      { query: { statuses: ['NEW'] }, apply: setNewErrandCount },
      { query: { statuses: ['SOLVED'] }, apply: setClosedErrandCount },
    ];
    if (draftEnabled) {
      requests.push({ query: { lifecycle: 'DRAFT' }, apply: setDraftErrandCount });
    }

    void Promise.allSettled(requests.map(({ query }) => getErrandsCount(query)))
      .then((results) => {
        if (!active) return;
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') requests[index]?.apply(result.value.count);
        });
        setError(results.some((result) => result.status === 'rejected') ? t('api_errors.counts') : null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [draftEnabled, setClosedErrandCount, setDraftErrandCount, setNewErrandCount, t]);

  const onSelectStatus = (button: StatusButton) => {
    setActiveStatus(button.label);
    setStatuses(button.statuses);
    setLifecycle(button.lifecycle);
    reset();
  };

  return { statusButtons, activeStatus, onSelectStatus, isLoading, error };
}
