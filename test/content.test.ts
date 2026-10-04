import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorshipMessage, contentHash, makePreview, parseTags, usdc, validateArticle, ValidationError } from '../src/lib/content';
import { parseChapters } from '../src/lib/publish';

const base = { kind: 'article', title: 'A decent title', summary: 'A summary that is long enough to pass.', body: 'x'.repeat(300), tags: 'ab, cd', priceUsdc: 0.02 };

test('valid article passes and prices convert to micro-USDC', () => {
  const a = validateArticle(base);
  assert.equal(a.priceMicro, 20000);
  assert.deepEqual(a.tags, ['ab', 'cd']);
});
test('rejects short body, bad price, and video without https link', () => {
  assert.throws(() => validateArticle({ ...base, body: 'short' }), ValidationError);
  assert.throws(() => validateArticle({ ...base, priceUsdc: 50 }), ValidationError);
  assert.throws(() => validateArticle({ ...base, priceUsdc: 0 }), ValidationError);
  assert.throws(() => validateArticle({ ...base, kind: 'video', videoUrl: 'http://x.com/v' }), ValidationError);
  assert.throws(() => validateArticle({ ...base, kind: 'video', videoUrl: 'javascript:alert(1)' }), ValidationError);
});
test('hash changes when any signed field changes', () => {
  const a = validateArticle(base);
  const h = contentHash(a);
  assert.equal(h, contentHash({ ...a }));
  assert.notEqual(h, contentHash({ ...a, body: a.body + '.' }));
  assert.notEqual(h, contentHash({ ...a, title: 'Another title' }));
});
test('signed message contains the hash and author', () => {
  const m = authorshipMessage({ author: 'ADDR', title: 'T', hash: 'HASH', signedAt: '2026-01-01T00:00:00Z' });
  assert.match(m, /HASH/); assert.match(m, /ADDR/);
});
test('preview never exposes more than about 45% of the text', () => {
  const body = 'Word. '.repeat(500);
  assert.ok(makePreview(body).length <= 600);
  assert.ok(makePreview('Short sentence here. '.repeat(20)).length < 'Short sentence here. '.repeat(20).length * 0.5);
});
test('tags are cleaned and limited', () => {
  assert.throws(() => parseTags('aa,bb,cc,dd,ee,ff'), ValidationError);
  assert.throws(() => parseTags('a'), ValidationError);
  assert.deepEqual(parseTags(' Xx , xx, my tag '), ['xx', 'my-tag']);
});
test('usdc formats', () => { assert.equal(usdc(20000), '0.02'); });
test('chapter parser', () => {
  assert.deepEqual(parseChapters('00:00 Intro\n02:15 Wallet setup\nnot a chapter'), [{ t: '00:00', title: 'Intro' }, { t: '02:15', title: 'Wallet setup' }]);
});
