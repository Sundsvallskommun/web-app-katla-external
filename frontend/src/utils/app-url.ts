export const appURL = (path?: string): string => {
  // (path ?? '') || … keeps || semantics: an empty string falls back to the base path.
  return `${window.location.origin}${(path ?? '') || process.env.NEXT_PUBLIC_BASE_PATH}`;
};
