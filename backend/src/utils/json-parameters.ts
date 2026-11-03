import { JsonParameter } from '@/data-contracts/support-management-alkt-sprint/data-contracts';

/** Draken edits the schema-named entry; the copy under this suffix is written by Katla alone. */
const ORIGINAL_KEY_SUFFIX = '_original';

const isOriginalKey = (key: string): boolean => key.endsWith(ORIGINAL_KEY_SUFFIX);

/** Client-sent copies are discarded and rebuilt, so the copy always mirrors what was filed. */
export const withOriginalCopies = (jsonParameters: JsonParameter[] | undefined): JsonParameter[] | undefined => {
  if (!jsonParameters) return undefined;

  const filed = jsonParameters.filter(parameter => !isOriginalKey(parameter.key));
  const copies = filed.map(parameter => ({ key: `${parameter.key}${ORIGINAL_KEY_SUFFIX}`, value: parameter.value, schemaId: parameter.schemaId }));

  return [...filed, ...copies];
};

/** The citizen UI never sees the copy. */
export const withoutOriginalCopies = (jsonParameters: JsonParameter[] | undefined): JsonParameter[] | undefined =>
  jsonParameters?.filter(parameter => !isOriginalKey(parameter.key));
