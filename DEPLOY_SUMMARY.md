# 部署完成总结 (Deployment Summary)

## 🌐 访问地址 (Access URLs)

- **前端 (Frontend)**: [https://blessings-frontend.pages.dev](https://blessings-frontend.pages.dev)
- **后端 (Backend API)**: `https://blessings-backend.stevenchenregister-700.workers.dev`

## ⚙️ 新增功能 (Key Features)

### 1. 邀请码验证 (Invite Code)

为了防止滥用，后端已添加邀请码验证。

- **配置方式**:
  在 Cloudflare Dashboard -> Workers & Pages -> `blessings-backend` -> Settings -> Variables and Secrets 中添加变量 `INVITE_CODE`。
  *(如果不设置，则不需要邀请码即可使用)*

### 2. 前端手动配置后端地址 (Dynamic Backend URL)

前端不再依赖硬编码的代理或 `_redirects`，而是可以在页面上动态配置。

- **使用方法**:
  1. 点击页面右上角的 **设置按钮 (⚙️)**。
  2. 在输入框中填入后端 API 地址 (例如 `https://blessings-backend.stevenchenregister-700.workers.dev/api`)。
  3. 点击 **保存**。
  配置会保存在浏览器的 `localStorage` 中。

## 🚀 部署状态 (Deployment Status)

- ✅ **Backend**: 已部署到 Cloudflare Workers (支持 OSS 和 Gemini AI)
- ✅ **Frontend**: 已部署到 Cloudflare Pages (支持手动配置 API 地址)
- ✅ **Code**: 所有代码已推送到 GitHub `master` 分支

## 🛠️ 后续维护 (Maintenance)

如果需要更新代码：

1. **后端**: 修改代码后运行 `npm run deploy` (在 `backend` 目录)
2. **前端**: 修改代码后运行 `npm run build` 然后 `npx wrangler pages deploy dist` (在 `frontend` 目录)
