/**
 * The forms this app hosts. A form's key is its route prefix and the value the backend maps to a
 * SupportManagement namespace (SERVICE_NAMESPACES); adding one here needs the backend entry and
 * texts in start.json and paths.json.
 */
export const SERVICE_KEYS = ['alkoholtillstand'] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

/** Request header carrying the key, so the backend knows which namespace a call concerns. */
export const SERVICE_KEY_HEADER = 'x-service-key';

export const isServiceKey = (value: string | undefined): value is ServiceKey =>
  value !== undefined && (SERVICE_KEYS as readonly string[]).includes(value);

export const servicePath = (key: ServiceKey): string => `/${key}`;

export const errandPath = (key: ServiceKey, errandNumber: string | undefined): string =>
  `/${key}/arende/${errandNumber}/grundinformation`;

/** The form a page belongs to, from its path without base path and locale. */
export const serviceKeyFromPath = (path: string): ServiceKey | undefined => {
  const [first] = path.replace(/^\/+/, '').split('/');

  return isServiceKey(first) ? first : undefined;
};
