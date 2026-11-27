import { NextResponse } from 'next/server';

export const GET = () => {
  return NextResponse.json({ status: 'OK' }, { status: 200 });
};
