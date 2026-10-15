import { Label, MetadataResponse } from '@/data-contracts/support-management-alkt-sprint/data-contracts';
import { HttpException } from '@/exceptions/HttpException';
import { withoutInternalOnly } from '@/utils/internal-labels';

/**
 * SupportManagement's label structure holds several trees side by side, each under its own root.
 * The BFF hands the frontend the children of the categorization root as the whole tree, so the
 * categorization UI never has to know about the root, nor about the trees that are not its
 * business — free tags, and the deprecated legacy roots.
 *
 * The root itself is deliberately not part of what the frontend sees or of what ends up in
 * `errand.labels`: an errand label is self-identifying and keeps the full `resourcePath` it was
 * given upstream, so the stored value is unaffected by where the offered tree starts.
 *
 * Internal-only labels are pruned from the offered tree; see `internal-labels.ts`.
 */
/**
 * Every tree in the label structure hangs off a node with this classification, so it marks "a root"
 * and nothing more. Several are expected: the errand categorization, free tags (`TAGROOT`), and in
 * time perhaps places or authorities. Which tree a root defines is carried by its resource path.
 */
export const ROOT_CLASSIFICATION = 'ROOT';

/** The root of the tree the citizen categorizes an errand with. */
export const CATEGORIZATION_ROOT_RESOURCE_PATH = 'CATEGORYROOT';

/** How deep below the root the frontend can render: CATEGORY, TYPE and SUBTYPE. */
const MAX_DEPTH_BELOW_ROOT = 3;

const findRoots = (labels: Label[] | undefined): Label[] =>
  (labels ?? []).flatMap(label => [
    ...(label.classification === ROOT_CLASSIFICATION && label.resourcePath === CATEGORIZATION_ROOT_RESOURCE_PATH ? [label] : []),
    ...findRoots(label.labels),
  ]);

const depthOf = (labels: Label[] | undefined): number => {
  const children = labels ?? [];
  return children.length === 0 ? 0 : 1 + Math.max(...children.map(label => depthOf(label.labels)));
};

/**
 * The categorization tree as the frontend should see it: the children of the categorization root.
 *
 * Fails rather than degrades. An empty tree would reach the citizen as a blank required Kategori
 * field with no explanation, and falling back to the unfiltered tree would offer categories that
 * are not Katla's to offer.
 */
export const selectCategorizationSubtree = (labelStructure: Label[] | undefined): Label[] => {
  const [root, ...extraRoots] = findRoots(labelStructure);

  if (!root || extraRoots.length > 0) {
    throw new HttpException(
      502,
      `Invalid response when reading metadata: expected exactly one label classified ${ROOT_CLASSIFICATION} with resourcePath ${CATEGORIZATION_ROOT_RESOURCE_PATH}, found ${root ? 1 + extraRoots.length : 0}`,
    );
  }

  const subtree = withoutInternalOnly(root.labels);
  const depth = depthOf(subtree);
  if (depth > MAX_DEPTH_BELOW_ROOT) {
    // The categorization UI walks a fixed three levels, so a deeper tree would lose its lowest
    // labels without anything saying so.
    throw new HttpException(
      502,
      `Invalid response when reading metadata: categorization tree is ${depth} levels deep, at most ${MAX_DEPTH_BELOW_ROOT} can be rendered`,
    );
  }

  return subtree;
};

/** Replaces only the label structure; every other metadata section is passed through untouched. */
export const withCategorizationSubtree = (metadata: MetadataResponse): MetadataResponse => ({
  ...metadata,
  labels: { ...metadata.labels, labelStructure: selectCategorizationSubtree(metadata.labels?.labelStructure) },
});
