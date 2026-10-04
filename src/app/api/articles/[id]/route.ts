import { NextResponse, type NextRequest } from 'next/server';
import { fail, HttpError, readJson, requireAddress } from '@/lib/auth';
import { LIMITS } from '@/lib/content';
import { getArticle, removeArticle, setArticlePrice } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Free: everything except the paid text. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const a = await getArticle((await params).id);
    if (!a) throw new HttpError(404, 'Not found.');
    const { body: _b, chapters: _c, ...pub } = a;
    return NextResponse.json({ article: pub });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const address = await requireAddress(req);
    const price = Math.round(Number((await readJson(req)).priceUsdc) * 1_000_000);
    if (!Number.isFinite(price) || price < LIMITS.minPriceMicro || price > LIMITS.maxPriceMicro) throw new HttpError(400, 'Price must be between 0.001 and 5 USDC.');
    if (!(await setArticlePrice((await params).id, address, price))) throw new HttpError(404, 'Not found.');
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const address = await requireAddress(req);
    if (!(await removeArticle((await params).id, address))) throw new HttpError(404, 'Not found.');
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
