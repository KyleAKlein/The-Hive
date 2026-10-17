import jsQR from 'jsqr';
import { restoreWalletPrivateKey } from './hive-wallet';

export function walletKeyFromPixels(data: Uint8ClampedArray, width: number, height: number) {
  const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  if (!code) return null;
  // Never treat arbitrary QR contents, public keys, or payment invoices as login keys.
  restoreWalletPrivateKey(code.data);
  return code.data;
}

export async function walletKeyFromImage(blob: Blob) {
  if (blob.size > 25 * 1024 * 1024) throw new Error('Choose a screenshot smaller than 25 MB.');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not read this image. Choose a PNG or JPEG screenshot.'));
      image.src = url;
    });
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Image reading is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    try {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const key = walletKeyFromPixels(pixels.data, pixels.width, pixels.height);
      if (!key) throw new Error('No QR code found. Choose a clear screenshot of your private-key QR.');
      return key;
    } finally {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
