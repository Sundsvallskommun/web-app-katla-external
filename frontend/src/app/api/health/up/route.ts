import axios from 'axios';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

const requireAuth = process.env.HEALTH_AUTH === 'true';
const authUsername = process.env.HEALTH_USERNAME;
const authPassword = process.env.HEALTH_PASSWORD;
const apiUrl = (process.env.API_URL_INTERNAL ?? '') || process.env.NEXT_PUBLIC_API_URL;

export const GET = async () => {
  const headersList = await headers();
  const authorization = headersList.get('authorization');
  const userAuth64 = Buffer.from(`${authUsername}:${authPassword}`).toString('base64');

  if (requireAuth && authorization !== `Basic ${userAuth64}`) {
    return new NextResponse('NOT_AUTHORIZED', { status: 401 });
  }

  try {
    // TLS certificate validation stays enabled. Internal CAs should be supplied through NODE_EXTRA_CA_CERTS.
    const health = await axios.get<unknown>(`${apiUrl}/health/up`).then((response) => response.data);

    return new NextResponse(JSON.stringify(health), { status: 200 });
  } catch {
    return new NextResponse(
      JSON.stringify({
        error: 'Upstream health check failed',
        status: 'ERROR!',
      }),
      { status: 500 }
    );
  }
};
