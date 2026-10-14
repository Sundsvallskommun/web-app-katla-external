import { notFound } from 'next/navigation';
import { ReactNode } from 'react';
import { isServiceKey } from 'src/constants/services';

interface ServiceLayoutProps {
  children: ReactNode;
  params: Promise<{ service: string }>;
}

/** Only registered forms exist; any other first segment is a 404. */
export default async function ServiceLayout({ children, params }: ServiceLayoutProps) {
  const { service } = await params;
  if (!isServiceKey(service)) notFound();

  return children;
}
