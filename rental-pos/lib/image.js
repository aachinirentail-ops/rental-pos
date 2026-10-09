// Shrinks a phone photo (often 4-10 MB) to a ~300 KB JPEG before it is uploaded.
// If anything goes wrong the original file is used, so uploading never breaks because of this.
export async function compressImage(file, maxSize = 1600, quality = 0.85) {
  try {
    if (!file || !String(file.type).startsWith('image/')) return file;
    const bmp = await createImageBitmap(file); // also applies the phone's rotation
    const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    if (blob.size >= file.size && file.size <= 8 * 1024 * 1024) return file; // already small enough
    return new File([blob], 'id.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
