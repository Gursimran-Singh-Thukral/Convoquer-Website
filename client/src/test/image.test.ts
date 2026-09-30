import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageToDataUrl } from '@/lib/image';

/**
 * jsdom doesn't render real pixels, so these mock the browser APIs
 * (Image load, canvas 2d context, toDataURL) to exercise the actual bug
 * this file fixes: a single compression pass isn't verified, so a browser
 * that doesn't shrink the output as expected (some mobile browsers fall
 * back to a much larger lossless encode) silently ships an oversized
 * payload. What matters here is that the helper checks the real output
 * size and keeps retrying smaller/lower-quality until it's actually under
 * the target, rather than trusting the first attempt.
 */
function dataUrlOfSize(bytes: number): string {
  // 4 base64 chars encode 3 bytes, so this string's base64 length maps to
  // approximately `bytes` decoded bytes.
  const base64Length = Math.ceil(bytes / 3) * 4;
  return 'data:image/jpeg;base64,' + 'A'.repeat(base64Length);
}

describe('compressImageToDataUrl', () => {
  let toDataURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 4000;
        naturalHeight = 3000;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    // Each call returns a progressively smaller encoded size, mimicking a
    // browser whose first pass is much larger than desktop would produce.
    const sizesPerCall = [2_000_000, 1_200_000, 700_000, 300_000];
    let call = 0;
    toDataURLMock = vi.fn(() =>
      dataUrlOfSize(sizesPerCall[Math.min(call++, sizesPerCall.length - 1)]),
    );

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'canvas') return document.createElement(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toDataURL: toDataURLMock,
      } as unknown as HTMLCanvasElement;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries with smaller dimensions/quality until the real output size is under the target', async () => {
    const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
    const result = await compressImageToDataUrl(file, { maxBytes: 900_000 });

    // Took more than one attempt (first two passes were still too big) and
    // returned the first pass that actually measured under the target.
    expect(toDataURLMock).toHaveBeenCalledTimes(3);
    expect(result).toBe(dataUrlOfSize(700_000));
  });

  it('respects a tighter target for pages sending multiple images per request', async () => {
    const file = new File([new Uint8Array(10)], 'id.jpg', { type: 'image/jpeg' });
    const result = await compressImageToDataUrl(file, { maxBytes: 350_000 });

    expect(toDataURLMock).toHaveBeenCalledTimes(4);
    expect(result).toBe(dataUrlOfSize(300_000));
  });

  it('rejects when the source file cannot be decoded as an image', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const file = new File([new Uint8Array(10)], 'broken.heic', { type: 'image/heic' });

    await expect(compressImageToDataUrl(file)).rejects.toThrow();
  });
});
