'use client';

import { getMetadata } from '@services/errand-service/errand-service';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from 'src/stores/metadata-store';

type MetadataLoadState = 'error' | 'loading' | 'ready';

interface UseLoadMetadataResult {
  metadataError: string | null;
  metadataLoadState: MetadataLoadState;
}

/**
 * Fyller metadatastoren.
 *
 * Metadata carries role names and categories. Every surface that needs it must fetch it itself:
 * the store is not persisted, so what is not fetched does not exist. The status describes this
 * hook instance's own request, so data already in the store does not mark a new fetch ready
 * early.
 */
export function useLoadMetadata(): UseLoadMetadataResult {
  const { t } = useTranslation();
  const setMetadata = useMetadataStore((state) => state.setMetadata);
  const [metadataLoadState, setMetadataLoadState] = useState<MetadataLoadState>('loading');

  useEffect(() => {
    let active = true;
    setMetadataLoadState('loading');

    void getMetadata()
      .then((res) => {
        if (!active) return;
        setMetadata(res);
        setMetadataLoadState('ready');
      })
      .catch(() => {
        if (active) setMetadataLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [setMetadata, t]);

  return {
    metadataError: metadataLoadState === 'error' ? t('api_errors.metadata') : null,
    metadataLoadState,
  };
}
