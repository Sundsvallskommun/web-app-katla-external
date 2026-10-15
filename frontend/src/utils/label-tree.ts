import { ErrandLabelDTO, LabelDTO } from '@data-contracts/backend/data-contracts';

// CATEGORY holds TYPEs, a TYPE may hold SUBTYPEs. A TYPE without SUBTYPEs is a valid leaf, so a
// classified errand carries two or three labels.

export const CLASSIFICATIONS = {
  CATEGORY: 'CATEGORY',
  TYPE: 'TYPE',
  SUBTYPE: 'SUBTYPE',
} as const;

export type Classification = (typeof CLASSIFICATIONS)[keyof typeof CLASSIFICATIONS];

export type SelectedLabels = Partial<Record<Classification, ErrandLabelDTO>>;

/** A level only counts when the one above it does; a TYPE without a CATEGORY is a broken path. */
export const getSelectedLabels = (errandLabels: ErrandLabelDTO[] | undefined): SelectedLabels => {
  const byClassification = (classification: Classification) =>
    (errandLabels ?? []).find((label) => label.classification === classification);

  const category = byClassification(CLASSIFICATIONS.CATEGORY);
  if (!category) return {};

  const type = byClassification(CLASSIFICATIONS.TYPE);
  if (!type) return { CATEGORY: category };

  const subtype = byClassification(CLASSIFICATIONS.SUBTYPE);
  return subtype ? { CATEGORY: category, TYPE: type, SUBTYPE: subtype } : { CATEGORY: category, TYPE: type };
};

const isLabelDeprecated = (label?: LabelDTO): boolean => label?.deprecated === true;

/**
 * `keepIds` names the labels already on the errand. They survive deprecation so a resumed draft
 * still shows its own classification; they can be deselected but not chosen again.
 */
export const getSelectableLabels = (
  labels: LabelDTO[] | undefined,
  keepIds: (string | undefined)[] = []
): LabelDTO[] => {
  const idsToKeep = new Set(keepIds.filter((id): id is string => !!id));
  return (labels ?? []).filter((label) => !isLabelDeprecated(label) || (!!label.id && idsToKeep.has(label.id)));
};

/** Selectable types for a category, with their selectable subtypes inlined. */
export const getSelectableTypesForCategory = (
  category: LabelDTO | undefined,
  keepIds: (string | undefined)[] = []
): LabelDTO[] => {
  const idsToKeep = new Set(keepIds.filter((id): id is string => !!id));
  const isKept = (label: LabelDTO) => !!label.id && idsToKeep.has(label.id);
  const categoryDeprecated = isLabelDeprecated(category);
  const selectableTypes =
    categoryDeprecated ? (category?.labels ?? []).filter(isKept) : getSelectableLabels(category?.labels, keepIds);

  return (
    selectableTypes
      .map((type) => ({
        type,
        selectableSubTypes:
          categoryDeprecated || isLabelDeprecated(type) ?
            (type.labels ?? []).filter(isKept)
          : getSelectableLabels(type.labels, keepIds),
      }))
      // A branch with no selectable leaf left is dropped rather than offered as a leaf itself.
      .filter(
        ({ selectableSubTypes, type }) =>
          (type.labels?.length ?? 0) === 0 || selectableSubTypes.length > 0 || isKept(type)
      )
      .map(({ selectableSubTypes, type }) => ({ ...type, labels: selectableSubTypes }))
  );
};

export const byDisplayName = (a: LabelDTO, b: LabelDTO): number =>
  (a.displayName ?? '').localeCompare(b.displayName ?? '', 'sv');

/** `ErrandLabelDTO` has no child list, so narrowing to it is what keeps the subtree off the errand. */
const toErrandLabel = (label: LabelDTO): ErrandLabelDTO => ({
  id: label.id,
  classification: label.classification,
  displayName: label.displayName,
  resourcePath: label.resourcePath,
  resourceName: label.resourceName,
});

export const toErrandLabels = (category: LabelDTO, type?: LabelDTO, subtype?: LabelDTO): ErrandLabelDTO[] =>
  [category, type, subtype].filter((label): label is LabelDTO => label !== undefined).map(toErrandLabel);
