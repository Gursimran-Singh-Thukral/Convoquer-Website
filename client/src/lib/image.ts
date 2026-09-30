/**
 * Downscales and re-encodes an image file to a compressed JPEG data URL.
 * Phone camera photos routinely come in at 3000px+ and several MB — sent
 * as-is (base64 inflates that further), that trips the reverse proxy's
 * request-size limit (413) well before it reaches our own 10MB body-parser
 * limit. Capping the longest edge and re-encoding at moderate JPEG quality
 * keeps the payload small regardless of the source photo's size.
 */
export function compressImageToDataUrl(
  file: File,
  { maxDimension = 1280, quality = 0.72 }: { maxDimension?: number; quality?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image file.'));
    };
    img.src = objectUrl;
  });
}
