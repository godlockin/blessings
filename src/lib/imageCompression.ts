export interface CompressedImageResult {
  dataUrl: string;
  base64: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

export const compressImage = async (
  file: File,
  options: {
    maxSize?: number;
    quality?: number;
  } = {}
): Promise<CompressedImageResult> => {
  const { maxSize = 1920, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1];

      resolve({
        dataUrl,
        base64,
        width,
        height,
        originalSize: file.size,
        compressedSize: Math.round((base64.length * 3) / 4),
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

export const isValidImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
};
