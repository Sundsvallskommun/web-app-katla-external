import { NextResponse } from 'next/server';

export const GET = () => {
  return new NextResponse(JSON.stringify({ status: 'OK' }), { status: 200 });
};
