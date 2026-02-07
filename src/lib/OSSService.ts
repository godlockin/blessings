export interface OSSConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  uploadedAt: Date;
}

export interface OSSServiceConfig {
  config: OSSConfig;
  pathPrefix?: string;
  expiresIn?: number;
}

export class OSSService {
  private config: OSSConfig;
  private pathPrefix: string;
  private expiresIn: number;
  private client: any;

  constructor(config: OSSServiceConfig) {
    this.config = config.config;
    this.pathPrefix = config.pathPrefix || 'generated-images';
    this.expiresIn = config.expiresIn || 365 * 24 * 60 * 60;
    
    // Lazy initialization
    this.client = null;
  }

  private async initClient(): Promise<any> {
    if (this.client) return this.client;
    
    const OSS = (await import('ali-oss')).default;
    this.client = new OSS({
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      bucket: this.config.bucket
    });
    
    return this.client;
  }

  async uploadImage(
    imageData: Buffer | ArrayBuffer,
    fileName: string,
    mimeType: string = 'image/png'
  ): Promise<UploadResult> {
    const client = await this.initClient();
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;
    const fullPath = `${this.pathPrefix}/${uniqueFileName}`;

    try {
      await client.put(fullPath, Buffer.from(imageData), {
        headers: {
          'Content-Type': mimeType,
          'x-oss-storage-class': 'Standard',
          'x-oss-object-acl': 'public-read'
        }
      });

      const url = await this.getSignedUrl(fullPath);

      return {
        url,
        name: uniqueFileName,
        size: imageData.byteLength,
        uploadedAt: new Date()
      };
    } catch (error) {
      console.error('[OSS] Upload failed:', error);
      throw new Error(`Failed to upload image: ${error}`);
    }
  }

  async uploadBase64(
    base64Data: string,
    fileName: string
  ): Promise<UploadResult> {
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = this.detectMimeType(base64Data);
    return this.uploadImage(buffer, fileName, mimeType);
  }

  async uploadFromUrl(
    imageUrl: string,
    fileName: string
  ): Promise<UploadResult> {
    try {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      return this.uploadImage(Buffer.from(arrayBuffer), fileName, response.headers.get('content-type') || 'image/png');
    } catch (error) {
      console.error('[OSS] Failed to download and upload:', error);
      throw new Error(`Failed to upload from URL: ${error}`);
    }
  }

  async getSignedUrl(objectKey: string): Promise<string> {
    const client = await this.initClient();
    try {
      const url = await client.signatureUrl(objectKey, {
        expires: this.expiresIn
      });
      return url;
    } catch (error) {
      console.error('[OSS] Failed to get signed URL:', error);
      return `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${objectKey}`;
    }
  }

  async getPublicUrl(objectKey: string): Promise<string> {
    return `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${objectKey}`;
  }

  async deleteImage(objectKey: string): Promise<boolean> {
    const client = await this.initClient();
    try {
      await client.delete(objectKey);
      return true;
    } catch (error) {
      console.error('[OSS] Delete failed:', error);
      return false;
    }
  }

  async listImages(prefix?: string, maxKeys: number = 100): Promise<string[]> {
    const client = await this.initClient();
    try {
      const result = await client.list({
        prefix: prefix || this.pathPrefix,
        'max-keys': maxKeys
      });
      return result.objects?.map((obj: any) => obj.name) || [];
    } catch (error) {
      console.error('[OSS] List failed:', error);
      return [];
    }
  }

  private detectMimeType(base64Data: string): string {
    const signatures: Record<string, string> = {
      '/9j/': 'image/jpeg',
      'iVBORw0KGgo': 'image/png',
      'R0lGODlh': 'image/gif',
      'UklGR': 'image/webp'
    };

    for (const [signature, mimeType] of Object.entries(signatures)) {
      if (base64Data.startsWith(signature)) {
        return mimeType;
      }
    }
    return 'image/png';
  }

  async batchUpload(
    images: Array<{ data: Buffer; filename: string }>
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (const image of images) {
      try {
        const result = await this.uploadImage(image.data, image.filename);
        results.push(result);
      } catch (error) {
        console.error(`[OSS] Batch upload failed for ${image.filename}:`, error);
        results.push({
          url: '',
          name: image.filename,
          size: 0,
          uploadedAt: new Date()
        });
      }
    }
    
    return results;
  }
}

export function createOSSServiceFromEnv(): OSSService | null {
  const config: OSSConfig = {
    region: process.env.OSS_REGION || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || ''
  };

  if (!config.region || !config.accessKeyId || !config.accessKeySecret || !config.bucket) {
    console.warn('[OSS] Missing OSS configuration in environment variables');
    return null;
  }

  return new OSSService({
    config,
    pathPrefix: process.env.OSS_PREFIX || 'blessings-generated',
    expiresIn: parseInt(process.env.OSS_EXPIRES_IN || '31536000', 10)
  });
}
