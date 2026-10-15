import { ErrandLabel, Label } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';

/** Set in Draken on labels that staff use but citizens must neither see nor file errands under. */
export const INTERNAL_ONLY_ATTRIBUTE = 'internalOnly';

export const isInternalOnly = (label: Label): boolean =>
  (label.attributes ?? []).some(attribute => attribute.key === INTERNAL_ONLY_ATTRIBUTE && attribute.value === 'true');

/**
 * Drops internal-only labels together with their subtrees. A parent whose children were all dropped
 * goes too, since it would otherwise be offered with nothing to choose below it.
 */
export const withoutInternalOnly = (labels: Label[] | undefined): Label[] =>
  (labels ?? []).flatMap(label => {
    if (isInternalOnly(label)) return [];
    if (!label.labels?.length) return [label];

    const children = withoutInternalOnly(label.labels);
    return children.length > 0 ? [{ ...label, labels: children }] : [];
  });

const flatten = (labels: Label[] | undefined): Label[] => (labels ?? []).flatMap(label => [label, ...flatten(label.labels)]);

/**
 * Every label on the errand must be one the citizen was offered. The message is the same for an
 * internal label and an unknown one, so the answer does not reveal which internal labels exist.
 */
export const assertLabelsOffered = (errandLabels: ErrandLabel[] | undefined, offered: Label[]): void => {
  const offeredById = new Map(flatten(offered).map(label => [label.id, label]));

  const allOffered = (errandLabels ?? []).every(errandLabel => {
    const match = errandLabel.id ? offeredById.get(errandLabel.id) : undefined;
    return match !== undefined && (errandLabel.resourcePath === undefined || errandLabel.resourcePath === match.resourcePath);
  });

  if (!allOffered) throw new HttpException(400, 'Label is not available');
};

const idsOf = (labels: ErrandLabel[] | undefined): string =>
  (labels ?? [])
    .map(label => label.id ?? '')
    .sort()
    .join(',');

/** Unchanged labels need no check: a draft filed before its type was made internal can still be saved. */
export const labelsChanged = (submitted: ErrandLabel[] | undefined, stored: ErrandLabel[] | undefined): boolean => idsOf(submitted) !== idsOf(stored);
