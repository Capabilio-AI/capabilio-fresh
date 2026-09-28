const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;

/**
 * Browser-only (canvas/createImageBitmap) — resizes to a max dimension and
 * re-encodes as JPEG so a student's phone-camera photo (often several MB)
 * uploads as a small file without ever showing them a size-limit error.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image compression failed"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}
