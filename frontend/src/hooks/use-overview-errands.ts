import { ErrandDTO } from '@data-contracts/backend/data-contracts';
import { getErrands } from '@services/errand-service/errand-service';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoadMetadata } from 'src/hooks/use-load-metadata';
import { useFilterStore } from 'src/stores/filter-store';
import { useSortStore } from 'src/stores/sort-store';

interface UseOverviewErrandsOptions {
  mode?: 'desktop' | 'mobile';
}

interface RequestTracker {
  generation: number;
  pending: number;
}

export function useOverviewErrands({ mode = 'desktop' }: UseOverviewErrandsOptions = {}) {
  const { t } = useTranslation();
  const { sortColumn, sortOrder, page, size } = useSortStore();
  const { statuses, lifecycle } = useFilterStore();
  const { metadataError } = useLoadMetadata();

  const [rows, setRows] = useState<ErrandDTO[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errandsError, setErrandsError] = useState<string | null>(null);

  const mobilePageRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const requestTrackerRef = useRef<RequestTracker>({ generation: 0, pending: 0 });
  // Mirror of mobilePageRef for reading during render (react-hooks/refs).
  const [mobilePage, setMobilePage] = useState(0);

  const beginRequest = useCallback((generation: number): boolean => {
    if (requestGenerationRef.current !== generation) return false;

    if (requestTrackerRef.current.generation !== generation) {
      requestTrackerRef.current = { generation, pending: 0 };
    }
    requestTrackerRef.current.pending += 1;
    setIsLoading(true);
    return true;
  }, []);

  const finishRequest = useCallback((generation: number): void => {
    if (requestGenerationRef.current !== generation || requestTrackerRef.current.generation !== generation) return;

    requestTrackerRef.current.pending = Math.max(0, requestTrackerRef.current.pending - 1);
    if (requestTrackerRef.current.pending === 0) setIsLoading(false);
  }, []);

  // Desktop uses the page from the store; mobile always starts at 0.
  const effectivePage = mode === 'mobile' ? 0 : page;

  // The main fetch, triggered by store changes (sorting, filtering, paging). Mobile always
  // fetches from page 0 and resets the accumulated rows.
  useEffect(() => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    requestTrackerRef.current = { generation, pending: 0 };
    mobilePageRef.current = 0;
    setMobilePage(0);
    // Rows and totals belong to this exact query identity. Clear them for both desktop and
    // mobile before requesting a new page/filter/sort/size, so a failed replacement can never
    // be shown as the new query's result.
    setRows([]);
    setTotalPages(1);
    setTotalElements(0);
    setErrandsError(null);
    beginRequest(generation);
    let active = true;
    void getErrands({ sortColumn, sortOrder, page: effectivePage, size, statuses, lifecycle })
      .then((data) => {
        if (!active || requestGenerationRef.current !== generation) return;
        setRows(data.content ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotalElements(data.totalElements ?? 0);
        setErrandsError(null);
      })
      .catch(() => {
        if (active && requestGenerationRef.current === generation) setErrandsError(t('api_errors.errands'));
      })
      .finally(() => {
        if (active) finishRequest(generation);
      });

    return () => {
      active = false;
      if (requestGenerationRef.current === generation) {
        const invalidatedGeneration = generation + 1;
        requestGenerationRef.current = invalidatedGeneration;
        requestTrackerRef.current = { generation: invalidatedGeneration, pending: 0 };
      }
    };
  }, [beginRequest, finishRequest, sortColumn, sortOrder, effectivePage, size, statuses, lifecycle, t]);

  const hasMore = mode === 'mobile' ? mobilePage + 1 < totalPages : page + 1 < totalPages;

  const loadMore = useCallback(() => {
    if (mode !== 'mobile') return;

    const generation = requestGenerationRef.current;
    if (requestTrackerRef.current.generation !== generation || requestTrackerRef.current.pending > 0) return;

    const previousPage = mobilePageRef.current;
    const nextPage = previousPage + 1;
    if (nextPage >= totalPages) return;
    if (!beginRequest(generation)) return;

    mobilePageRef.current = nextPage;
    setMobilePage(nextPage);
    void getErrands({ sortColumn, sortOrder, page: nextPage, size, statuses, lifecycle })
      .then((data) => {
        if (requestGenerationRef.current !== generation) return;
        setRows((prev) => [...prev, ...(data.content ?? [])]);
        setTotalPages(data.totalPages ?? 1);
        setTotalElements(data.totalElements ?? 0);
        setErrandsError(null);
      })
      .catch(() => {
        if (requestGenerationRef.current !== generation) return;
        // Roll the page cursor back so the user can retry the same page.
        mobilePageRef.current = previousPage;
        setMobilePage(previousPage);
        setErrandsError(t('api_errors.errands'));
      })
      .finally(() => {
        finishRequest(generation);
      });
  }, [beginRequest, finishRequest, mode, totalPages, sortColumn, sortOrder, size, statuses, lifecycle, t]);

  return { rows, isLoading, totalPages, totalElements, hasMore, loadMore, page, errandsError, metadataError };
}
