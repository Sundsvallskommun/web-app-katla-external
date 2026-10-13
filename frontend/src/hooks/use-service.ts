'use client';

import { useParams } from 'next/navigation';
import { isServiceKey, ServiceKey } from 'src/constants/services';

/** The form the current page belongs to. Only valid under app/[locale]/[service], whose layout rejects unknown keys. */
export function useService(): ServiceKey {
  const { service } = useParams<{ service?: string }>();
  if (!isServiceKey(service)) throw new Error('useService is only available under a service route');

  return service;
}
