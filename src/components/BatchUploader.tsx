import { useState, useCallback, useMemo } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { compressImage, isValidImageFile } from '@/lib/imageCompression';
import { createBatchItem, formatFileSize } from '@/types/batch';
import { cn } from '@/lib/utils';
import type { BatchItem } from '@/types/batch';

interface BatchUploaderProps {
  onFilesSelected: (files: BatchItem[]) => void;
  maxFiles?: number;
  maxTotalSize?: number;
}

export function BatchUploader({
  onFilesSelected,
  maxFiles = 10,
  maxTotalSize = 50 * 1024 * 1024,
}: BatchUploaderProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSize = useMemo(
    () => items.reduce((acc, item) => acc + (item.file?.size || 0), 0),
    [items]
  );

  const handleFiles = useCallback(async (fileList: FileList) => {
    setError(null);
    const validFiles: File[] = [];

    for (const file of Array.from(fileList)) {
      if (!isValidImageFile(file)) {
        setError(`不支持的文件格式: ${file.name}`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`文件过大: ${file.name} (最大 10MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (items.length + validFiles.length > maxFiles) {
      setError(`最多只能选择 ${maxFiles} 个文件`);
      return;
    }

    if (totalSize + validFiles.reduce((acc, f) => acc + f.size, 0) > maxTotalSize) {
      setError(`总文件大小超过限制 (${formatFileSize(maxTotalSize)})`);
      return;
    }

    try {
      const newItems: BatchItem[] = [];
      for (const file of validFiles) {
        const compressed = await compressImage(file, { maxSize: 1920, quality: 0.8 });
        newItems.push(createBatchItem(file, compressed.dataUrl));
      }
      const updatedItems = [...items, ...newItems];
      setItems(updatedItems);
      onFilesSelected(updatedItems);
    } catch {
      setError('文件处理失败');
    }
  }, [items, maxFiles, maxTotalSize, totalSize, onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeItem = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    onFilesSelected(updatedItems);
  }, [items, onFilesSelected]);

  const clearAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setItems([]);
    onFilesSelected([]);
  }, [onFilesSelected]);

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all',
          isDragging
            ? 'border-china-red bg-red-50 dark:bg-red-900/10'
            : 'border-gray-300 dark:border-dark-border hover:border-china-red/50',
          items.length === 0 && 'py-12'
        )}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={items.length >= maxFiles}
        />

        <Upload className={cn(
          "w-12 h-12 mx-auto mb-3",
          isDragging ? "text-china-red" : "text-gray-400"
        )} />
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {isDragging ? '释放以上传文件' : '点击或拖拽上传多张图片'}
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          支持 JPG、PNG、WebP，单个最大 10MB
        </p>

        {items.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            已选择 {items.length}/{maxFiles} 个文件，{formatFileSize(totalSize)}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              待处理文件
            </span>
            <button
              onClick={clearAll}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700"
            >
              清空全部
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative group bg-gray-50 dark:bg-dark-bgTertiary rounded-lg p-2"
              >
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="w-full aspect-square object-cover rounded"
                />
                <button
                  onClick={(e) => removeItem(item.id, e)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                  {item.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchUploader;
