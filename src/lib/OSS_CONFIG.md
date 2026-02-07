# OSS Service Configuration

## Environment Variables

```bash
# Alibaba Cloud OSS Configuration
export OSS_REGION="oss-cn-hangzhou"
export OSS_ACCESS_KEY_ID="your-access-key-id"
export OSS_ACCESS_KEY_SECRET="your-access-key-secret"
export OSS_BUCKET="your-bucket-name"
export OSS_PREFIX="content-space/blessings"
export OSS_EXPIRES_IN="31536000"
```

## 保存路径说明

| 变量 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `OSS_PREFIX` | 保存路径前缀 | `content-space/blessings` | `content-space/blessings` |
| 完整路径 | `{OSS_PREFIX}/{timestamp}-{filename}` | - | `content-space/blessings/1738900000000-blessing.png` |

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
