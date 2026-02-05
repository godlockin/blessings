import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { BatchItem, BatchResultSummary } from '@/types/batch';

export const createBatchZip = async (
  items: BatchItem[],
  summary: BatchResultSummary
): Promise<Blob> => {
  const zip = new JSZip();

  const manifest: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    totalItems: summary.total,
    successCount: summary.success,
    failedCount: summary.failed,
    items: [],
  };

  for (const item of items) {
    if (item.status === 'completed' && item.result) {
      const base64Data = item.result.split(',')[1];
      const fileName = `blessing_${item.id.slice(0, 8)}.png`;
      zip.file(fileName, base64Data, { base64: true });

      (manifest.items as Record<string, unknown>[]).push({
        fileName,
        originalName: item.file.name,
        status: 'success',
      });
    } else {
      (manifest.items as Record<string, unknown>[]).push({
        originalName: item.file.name,
        status: 'failed',
        error: item.error,
      });
    }
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

export const downloadBatchZip = async (
  items: BatchItem[],
  summary: BatchResultSummary
): Promise<void> => {
  const zipBlob = await createBatchZip(items, summary);
  const fileName = `blessings_batch_${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(zipBlob, fileName);
};

export const downloadSingleImage = async (base64Data: string, fileName: string): Promise<void> => {
  const blob = dataURLtoBlob(base64Data);
  saveAs(blob, fileName);
};

export const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};
