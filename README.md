# 新年祝福生成器 (Blessings Img)

一个基于 AI 的中国新年祝福照片生成器。用户上传一张照片，系统会自动识别人物特征，并生成一张带有中国新年氛围（如红色背景、灯笼、作揖手势等）的完美祝福照。

## ✨ 功能特点

- **全流程 AI 处理**：
  1. **图片审核**：确保上传内容合法且包含人物。
  2. **特征分析**：提取人物性别、年龄、特征等信息。
  3. **Prompt 生成**：根据特征自动生成用于绘图的提示词。
  4. **图片生成**：使用 Gemini 模型生成高质量的新年祝福图。
  5. **结果审核**：确保生成结果质量。
- **流式响应 (SSE)**：实时反馈处理进度，支持分段传输高清大图，体验流畅。
- **邀请码机制**：简单的访问控制。
- **阿里云 OSS 集成**：生成的图片自动上传至对象存储，快速分发。

## 🛠️ 技术栈

- **前端**：React, TypeScript, TailwindCSS, Vite
- **后端**：Cloudflare Pages Functions (Serverless)
- **AI 模型**：Google Gemini Pro & Gemini Pro Vision
- **存储**：Aliyun OSS

## 🚀 快速开始

### 前置要求

- Node.js (v18+)
- Google Gemini API Key
- 阿里云 OSS Bucket

### 安装

1. 克隆项目并安装依赖：
   ```bash
   git clone <repository-url>
   cd blessings_img
   npm install
   ```

2. 配置环境变量：
   复制示例文件并填入你的配置：
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   编辑 `.dev.vars` 文件，填入 API Key 和 OSS 配置。

### 本地开发

启动带有 Cloudflare Functions 支持的本地开发服务器：

```bash
npm run start:dev
```

访问 `http://localhost:8788` 即可看到应用。

### 部署

本项目配置为部署到 Cloudflare Pages。

1. 构建项目：
   ```bash
   npm run build
   ```

2. 部署 (需要安装 Wrangler CLI)：
   ```bash
   npx wrangler pages deploy dist --project-name blessings-img
   ```

3. 在 Cloudflare Dashboard 中设置环境变量（生产环境配置）。

## 📁 项目结构

```
├── functions/       # Cloudflare Pages Functions (后端逻辑)
│   └── api/
│       └── process-image.ts  # 核心处理流程 (SSE)
├── src/            # React 前端代码
│   ├── pages/
│   │   └── MainPage.tsx      # 主页面 (包含 SSE 接收与状态机解析)
│   └── store/      # 状态管理
├── public/         # 静态资源
└── wrangler.toml   # Cloudflare 配置文件
```

## 📝 环境变量说明

| 变量名 | 说明 |
|--------|------|
| `GEMINI_API_KEY` | Google Gemini API 密钥 |
| `INVITE_CODE` | 访问系统的邀请码 |
| `OSS_REGION` | OSS 区域 (如 oss-cn-hangzhou) |
| `OSS_ACCESS_KEY_ID` | 阿里云 Access Key ID |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 Access Key Secret |
| `OSS_BUCKET` | OSS Bucket 名称 |
| `OSS_ENDPOINT` | (可选) 自定义 Endpoint |
| `OSS_PREFIX` | (可选) 文件存储路径前缀 |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT
