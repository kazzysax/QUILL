import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDb();
  await db.query('select 1');
  return NextResponse.json({ ok: true, db: db.kind });
}
