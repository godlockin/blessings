# Deployment & Configuration Guide

## Prerequisites

1.  **Cloudflare Account**: You have an account ID `700ed004abf3810985c88d2c1bfa8733`.
2.  **Aliyun OSS**: You need a Bucket, Access Key ID, and Access Key Secret.
3.  **Google Gemini API**: You need an API Key.

## 1. Initial Setup (Local)

1.  **Login to Cloudflare**:
    ```bash
    npx wrangler login
    ```
    This will open your browser to authenticate.

2.  **Create D1 Database**:
    ```bash
    npx wrangler d1 create blessings-db
    ```
    **IMPORTANT**: Copy the `database_id` from the output and update `backend/wrangler.toml` (replace the `xxxxxxxx...` placeholder).

3.  **Initialize Database Schema**:
    ```bash
    cd backend
    npx wrangler d1 execute blessings-db --remote --file=./schema.sql
    ```

## 2. Configure Secrets (Production)

You need to securely store your API keys in Cloudflare Workers. Run the following commands in the `backend` directory:

```bash
cd backend

# Gemini API Key
npx wrangler secret put GEMINI_API_KEY
# (Enter your key when prompted)

# Aliyun OSS Config
npx wrangler secret put OSS_ACCESS_KEY_ID
npx wrangler secret put OSS_ACCESS_KEY_SECRET
npx wrangler secret put OSS_BUCKET
npx wrangler secret put OSS_REGION
npx wrangler secret put OSS_ENDPOINT
```

## 3. Deploy Backend

```bash
cd backend
npm run deploy
```
This will deploy your Worker to Cloudflare. Note the URL (e.g., `https://blessings-backend.<your-subdomain>.workers.dev`).

## 4. Deploy Frontend

We recommend using **Cloudflare Pages**.

1.  **Create a Project**:
    ```bash
    npx wrangler pages project create blessings-frontend --production-branch main
    ```

2.  **Build & Deploy**:
    ```bash
    cd frontend
    npm install
    npm run build
    npx wrangler pages deploy dist --project-name blessings-frontend
    ```

3.  **Connect Frontend to Backend**:
    *   Since the Frontend is a static site, it needs to know the Backend URL.
    *   In `frontend/src/App.tsx`, the fetch calls use relative paths (`/api/...`).
    *   **Option A (Recommended for Pages)**: Configure a `_redirects` file in `frontend/public/` to proxy `/api` to your Worker.
        *   Create `frontend/public/_redirects`:
            ```
            /api/*  https://blessings-backend.<your-subdomain>.workers.dev/api/:splat  200
            ```
    *   **Option B**: Update `frontend` code to use the full URL of the backend (requires enabling CORS on backend, which is already done).

## 5. Automated Deployment (GitHub Actions)

A `.github/workflows/deploy.yml` file has been created. To enable it:

1.  Push this repository to GitHub.
2.  Go to **Settings > Secrets and variables > Actions** in your GitHub repository.
3.  Add the following Repository Secrets:
    *   `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token (Template: Edit Cloudflare Workers).
    *   `CLOUDFLARE_ACCOUNT_ID`: `700ed004abf3810985c88d2c1bfa8733`

Now, every push to `main` will automatically deploy both Frontend and Backend.

## 6. Verification

1.  Open your Cloudflare Pages URL.
2.  Upload an image.
3.  Check the "Network" tab in DevTools to ensure `/api/upload` requests are successful.
