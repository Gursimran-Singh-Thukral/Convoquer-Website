/**
 * Downscales and re-encodes an image file to a compressed JPEG data URL,
 * verifying the actual output size rather than trusting one compression
 * pass. Phone camera photos routinely come in at 3000px+ and several MB —
 * sent as-is (base64 inflates that further), that trips the reverse
 * proxy's request-size limit (413) well before our own server's body-parser
 * limit. Some mobile browsers also don't honor the JPEG quality parameter
 * the way desktop browsers do (a few fall back to a much larger lossless
 * encode), so a single "downscale once and hope" pass isn't reliable across
 * devices — this measures the real result and retries smaller/lower-quality
 * until it's actually under the target, instead of silently shipping
 * whatever the first attempt produced.
 */
export async function compressImageToDataUrl(
  file: File,
  {
    maxDimension = 1280,
    quality = 0.72,
    maxBytes = 900_000,
  }: { maxDimension?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  const img = await loadImage(file);
  let dimension = maxDimension;
  let q = quality;

  for (let attempt = 0; attempt < 6; attempt++) {
    const dataUrl = drawToJpeg(img, dimension, q);
    if (dataUrlSizeBytes(dataUrl) <= maxBytes) return dataUrl;
    dimension = Math.round(dimension * 0.75);
    q = Math.max(0.35, q - 0.12);
  }
  // Last attempt at the smallest settings, returned regardless of size —
  // by this point it's as small as this helper can reasonably make it.
  return drawToJpeg(img, dimension, q);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image file.'));
    };
    img.src = objectUrl;
  });
}

function drawToJpeg(img: HTMLImageElement, maxDimension: number, quality: number): string {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Actual encoded byte size of a base64 data URL, not the string length. */
function dataUrlSizeBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
