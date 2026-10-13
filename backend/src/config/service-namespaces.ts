import { SERVICE_NAMESPACES } from '@/config';

/**
 * Route prefix → SupportManagement namespace, from SERVICE_NAMESPACES ("alkoholtillstand=AOT,tobak=TOBAK").
 * The frontend names a form by its route prefix (the service key); the namespace never leaves the backend.
 */
export const parseServiceNamespaces = (value: string | undefined): ReadonlyMap<string, string> => {
  const entries = (value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry !== '')
    .map((entry): [string, string] => {
      const [key = '', namespace = '', ...rest] = entry.split('=').map(part => part.trim());
      if (key === '' || namespace === '' || rest.length > 0) {
        throw new Error(`Invalid SERVICE_NAMESPACES entry "${entry}", expected key=NAMESPACE`);
      }
      return [key, namespace];
    });

  return new Map(entries);
};

export const serviceNamespaces = parseServiceNamespaces(SERVICE_NAMESPACES);
