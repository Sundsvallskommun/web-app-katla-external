import { ErrandDTO } from '@data-contracts/backend/data-contracts';
import { getSelectedLabels } from '@utils/label-tree';

/** Most specific label, same text as the detail view; classification code for errands without labels. */
export const getTypeDisplayName = (errand: ErrandDTO) => {
  const selected = getSelectedLabels(errand.labels);
  return (selected.SUBTYPE ?? selected.TYPE)?.displayName ?? errand.classification?.type ?? '—';
};
