# OSS Service Configuration

## Environment Variables

```bash
# Alibaba Cloud OSS Configuration
export OSS_REGION="oss-cn-hangzhou"
export OSS_ACCESS_KEY_ID="your-access-key-id"
export OSS_ACCESS_KEY_SECRET="your-access-key-secret"
export OSS_BUCKET="your-bucket-name"
export OSS_PATH_PREFIX="blessings-generated"
export OSS_EXPIRES_IN="31536000"
```

## Usage Example

```typescript
import { OSSService, createOSSServiceFromEnv } from './OSSService';

const ossService = createOSSServiceFromEnv();

if (ossService) {
  const result = await ossService.uploadBase64(base64Image, 'blessing-123.png');
  console.log('Uploaded:', result.url);
}
```

## Multi-Agent Workflow with OSS

```typescript
import { MultiAgentWorkflow } from './multi-agent/workflow';
import { OSSService } from './OSSService';

const ossService = new OSSService({
  config: {
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET
  },
  pathPrefix: 'blessings-generated',
  expiresIn: 31536000
});

const workflow = new MultiAgentWorkflow(
  client,
  imageAnalyzer,
  { maxIterations: 3, passingScore: 8.0 },
  { ossService, saveToOSS: true, imageFilename: 'new-year-blessing.png' }
);

const result = await workflow.process(imageBase64, generateImageFn);

console.log(workflow.generateReport(result));
console.log('OSS URL:', result.ossResult?.url);
```

## Result Structure

```typescript
{
  success: true,
  imageUrl: "data:image/png;base64,...",
  ossResult: {
    url: "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/...",
    name: "timestamp-filename.png",
    size: 1234567,
    uploadedAt: 2026-02-07T10:00:00.000Z
  },
  prompt: "...",
  qualityScores: { ... },
  finalDecision: "approved",
  // ... more fields
}
```
