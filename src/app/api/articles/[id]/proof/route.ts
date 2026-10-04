import { NextResponse, type NextRequest } from 'next/server';
import { fail, HttpError } from '@/lib/auth';
import { getArticle } from '@/lib/store';
import { verifyWalletSignature } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

/** Free: the signed authorship statement. After buying the text, anyone can recompute the hash and check it. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = await getArticle((await params).id);
    if (!a) throw new HttpError(404, 'Not found.');
    return NextResponse.json({
      id: a.id,
      author: a.writer.address,
      contentHash: a.contentHash,
      message: a.signedMessage,
      signature: a.signature,
      signatureValid: await verifyWalletSignature(a.writer.address, a.signedMessage, a.signature),
      howToVerify: [
        'Check that `signature` (base64) is a valid ed25519 signature of `message` (UTF-8) by the `author` wallet.',
        'After buying the text, recompute SHA-256 over JSON.stringify([kind, title, summary, body, videoUrl ?? "", chapters ?? ""]) and compare it to contentHash.',
      ],
    });
  } catch (e) { return fail(e); }
}
