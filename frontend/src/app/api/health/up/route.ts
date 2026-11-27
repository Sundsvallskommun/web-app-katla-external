import axios from 'axios';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { createHealthConfig, isHealthRequestAuthorized } from '../../../../config/health-config';

export const GET = async () => {
  let healthConfig: ReturnType<typeof createHealthConfig>;

  try {
    healthConfig = createHealthConfig(process.env);
  } catch {
    return NextResponse.json({ status: 'MISCONFIGURED' }, { status: 500 });
  }

  const headersList = await headers();

  if (!isHealthRequestAuthorized(headersList.get('authorization'), healthConfig)) {
    return new NextResponse('NOT_AUTHORIZED', { status: 401 });
  }

  try {
    const health = await axios
      .get<unknown>(healthConfig.backendHealthUrl, { timeout: healthConfig.requestTimeoutMs })
      .then((response) => response.data);

    return NextResponse.json(health, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'UNAVAILABLE' }, { status: 503 });
  }
};
