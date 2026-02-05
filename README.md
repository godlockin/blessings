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
│       ├── process-image.ts  # 核心处理流程 (SSE)
│       └── verify-invite.ts   # 邀请码验证
├── src/            # React 前端代码
│   ├── components/  # 可复用组件
│   │   ├── ErrorBoundary.tsx    # 错误边界
│   │   └── ErrorMessages.ts     # 错误消息映射
│   ├── hooks/       # 自定义 Hooks
│   │   └── useTheme.ts          # 主题切换
│   ├── pages/       # 页面组件
│   │   ├── Home.tsx
│   │   ├── InvitePage.tsx       # 邀请码页面
│   │   └── MainPage.tsx         # 主页面
│   ├── store/       # 状态管理
│   │   └── useAuthStore.ts      # 认证状态
│   ├── lib/         # 工具函数
│   │   └── utils.ts
│   └── types/       # 类型定义
│       └── index.ts
├── docs/            # 文档
│   └── API.md       # API 文档
├── public/          # 静态资源
├── wrangler.toml    # Cloudflare 配置文件
├── tailwind.config.js  # Tailwind 配置
└── vite.config.ts   # Vite 配置
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

## 🔧 故障排查

### 1. 本地开发服务器无法启动

**症状**：`npm run start:dev` 报错或无法访问

**解决方案**：
- 确保已正确配置 `.dev.vars` 文件
- 检查 Cloudflare Wrangler 是否安装：`npx wrangler --version`
- 尝试重启开发服务器：`Ctrl+C` 后重新运行 `npm run start:dev`
- 检查端口 8788 是否被占用

### 2. API 请求返回 500 错误

**症状**：前端显示"服务器连接失败"

**解决方案**：
- 检查 `.dev.vars` 中的 `GEMINI_API_KEY` 是否有效
- 确认 Google Gemini API 已启用
- 查看本地服务器日志获取详细错误信息
- 验证网络连接是否正常

### 3. 图片上传失败

**症状**：上传图片后提示错误或无响应

**解决方案**：
- 检查文件大小是否超过 10MB
- 确认文件格式为 JPG、PNG 或 WebP
- 清除浏览器缓存后重试
- 检查网络连接稳定性

### 4. 邀请码验证失败

**症状**：输入正确邀请码后仍提示无效

**解决方案**：
- 确认邀请码大小写无误
- 检查 `.dev.vars` 中的 `INVITE_CODE` 配置
- 尝试重新启动开发服务器
- 清除 localStorage（浏览器开发者工具 → Application → Local Storage）

### 5. AI 图片生成超时

**症状**：处理进度长时间停留在某一步

**解决方案**：
- 等待 5 分钟（默认超时时间）
- 尝试使用更小的图片
- 检查 Google Gemini API 配额是否充足
- 查看服务器日志确认是否有 API 限流

### 6. 深色模式不生效

**症状**：切换主题后页面无变化

**解决方案**：
- 清除浏览器缓存
- 检查浏览器是否支持 `prefers-color-scheme`
- 确认 Tailwind 配置文件正确
- 手动切换主题后刷新页面

### 7. 图片下载失败

**症状**：点击下载按钮无响应

**解决方案**：
- 尝试右键"图片另存为"
- 检查浏览器是否阻止了自动下载
- 确认生成的图片数据完整
- 尝试使用其他浏览器

### 8. SSE 连接断开

**症状**：处理过程中断，提示"Stream reader not available"

**解决方案**：
- 检查网络连接稳定性
- 确认服务器正常运行
- 尝试刷新页面后重新处理
- 查看浏览器控制台错误日志

### 9. 性能问题

**症状**：页面加载慢或卡顿

**解决方案**：
- 使用浏览器开发者工具检查网络请求
- 确认图片尺寸是否过大
- 清除浏览器缓存
- 检查是否有其他浏览器扩展干扰

### 10. 部署到 Cloudflare Pages 后不工作

**症状**：生产环境 API 返回错误

**解决方案**：
- 确认已在 Cloudflare Dashboard 中设置所有环境变量
- 检查 Functions 兼容性标志是否正确配置
- 查看 Cloudflare Pages 部署日志
- 确认 `wrangler.toml` 配置正确

## 📊 监控与日志

### 本地开发日志

- 前端日志：浏览器控制台 (F12)
- 后端日志：终端输出

### 生产环境日志

- Cloudflare Pages Functions 日志可在 Dashboard 查看
- 建议配置错误追踪工具（如 Sentry）

## 🧪 测试

```bash
# 运行类型检查
npm run check

# 运行 lint
npm run lint

# 运行构建
npm run build
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT
