# API 文档

## 概述

本项目使用 Cloudflare Pages Functions 提供后端 API 服务。所有 API 均通过 `/api/*` 路径访问。

## 认证

除 `/api/verify-invite` 外，所有 API 端点都需要有效的邀请码。邀请码通过请求体中的 `inviteCode` 字段传递。

## 端点列表

### 1. 验证邀请码

**端点**: `POST /api/verify-invite`

**请求体**:
```json
{
  "inviteCode": "string"
}
```

**响应**:
```json
{
  "valid": true
}
```

**错误响应**:
```json
{
  "valid": false,
  "message": "Invalid invite code"
}
```

**状态码**:
- `200`: 成功
- `400`: 请求格式错误
- `500`: 服务器错误

---

### 2. 图片处理

**端点**: `POST /api/process-image`

**描述**: 上传图片并生成新年祝福照片。使用 Server-Sent Events (SSE) 进行流式响应。

**请求头**:
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

**请求体**:
```json
{
  "image": "base64_encoded_image",
  "inviteCode": "string"
}
```

**SSE 事件流**:

#### step 事件
```json
{
  "event": "step",
  "data": {
    "id": "audit" | "analysis" | "prompt" | "generation" | "review",
    "status": "pending" | "processing" | "completed" | "failed"
  }
}
```

#### image_chunk 事件
```json
{
  "event": "image_chunk",
  "data": {
    "chunk": "base64_encoded_chunk"
  }
}
```

#### complete 事件
```json
{
  "event": "complete",
  "data": {
    "status": "done"
  }
}
```

#### error 事件
```json
{
  "event": "error",
  "data": {
    "message": "error message"
  }
}
```

**处理步骤**:
1. `audit` - 图片内容审核
2. `analysis` - 人物特征分析
3. `prompt` - 生成 AI 提示词
4. `generation` - 生成新年祝福图
5. `review` - 生成结果质量审核

**响应头**:
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-store, must-revalidate
Connection: keep-alive
```

**错误代码**:

| 错误信息 | 描述 | 处理建议 |
|----------|------|----------|
| `Missing required parameters` | 缺少必要参数 | 检查请求体是否包含 `image` 和 `inviteCode` |
| `Invalid invite code` | 邀请码无效 | 验证邀请码是否正确 |
| `Invalid image data format` | 图片格式错误 | 确保图片是有效的 base64 编码 |
| `Image size exceeds limit` | 图片过大 | 图片大小限制为 10MB |
| `Image audit failed: ...` | 内容审核未通过 | 更换符合要求的图片 |
| `AI service configuration error` | AI 服务配置错误 | 联系管理员检查 API 配置 |
| `Processing timeout` | 处理超时 | 稍后重试 |

---

## 环境变量

| 变量名 | 描述 | 必填 |
|--------|------|------|
| `GEMINI_API_KEY` | Google Gemini API 密钥 | 是 |
| `INVITE_CODE` | 访问系统的邀请码 | 是 |
| `OSS_REGION` | 阿里云 OSS 区域 | 是 |
| `OSS_ACCESS_KEY_ID` | 阿里云 Access Key ID | 是 |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 Access Key Secret | 是 |
| `OSS_BUCKET` | OSS Bucket 名称 | 是 |
| `OSS_ENDPOINT` | OSS Endpoint (可选) | 否 |
| `OSS_PREFIX` | 文件存储路径前缀 (可选) | 否 |
| `ENVIRONMENT` | 环境标识 | 否 |

---

## 速率限制

- CPU 时间限制: 50000ms (50秒)
- 请求超时: 300秒 (5分钟)

---

## 错误处理

所有 API 端点遵循以下错误格式:

```json
{
  "valid": false,
  "message": "友好的错误描述"
}
```

建议在客户端实现以下错误处理策略:
1. 网络错误: 显示"网络连接异常，请检查网络后重试"
2. 认证错误: 引导用户重新输入邀请码
3. 处理错误: 显示错误消息并提供重试选项
4. 超时错误: 提示用户稍后重试
