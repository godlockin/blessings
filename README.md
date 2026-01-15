# Blessings Generator

A Chinese New Year blessing photo generator powered by Cloudflare Workers, Aliyun OSS, and Gemini AI.

## Setup

### Backend

1.  Navigate to `backend`:
    ```bash
    cd backend
    npm install
    ```
2.  Configure `wrangler.toml` or `.dev.vars` with your secrets:
    *   `GEMINI_API_KEY`: Google Gemini API Key
    *   `OSS_ACCESS_KEY_ID`: Aliyun OSS Access Key ID
    *   `OSS_ACCESS_KEY_SECRET`: Aliyun OSS Access Key Secret
    *   `OSS_BUCKET`: Aliyun OSS Bucket Name
    *   `OSS_REGION`: Aliyun OSS Region (e.g., oss-cn-hangzhou)
    *   `OSS_ENDPOINT`: Aliyun OSS Endpoint (e.g., oss-cn-hangzhou.aliyuncs.com)

3.  Create D1 Database:
    ```bash
    npx wrangler d1 create blessings-db
    ```
    Update `wrangler.toml` with the `database_id`.

4.  Apply Schema:
    ```bash
    npx wrangler d1 execute blessings-db --local --file=./schema.sql
    ```

5.  Run Development Server:
    ```bash
    npm run dev
    ```

### Frontend

1.  Navigate to `frontend`:
    ```bash
    cd frontend
    npm install
    ```

2.  Run Development Server:
    ```bash
    npm run dev
    ```
    The frontend will proxy `/api` requests to `http://localhost:8787` (default Wrangler port).

## Architecture

*   **Frontend**: React + Vite (TypeScript)
*   **Backend**: Hono on Cloudflare Workers
*   **Database**: Cloudflare D1 (SQLite)
*   **Storage**: Aliyun OSS (accessed via `aws4fetch` S3-compatible client)
*   **AI**: Google Gemini 3 Pro (via `@google/generative-ai`)

## Project Structure

*   `frontend/`: React application.
*   `backend/`: Cloudflare Worker application.
    *   `src/index.ts`: API Endpoints.
    *   `src/prompts/`: Expert System Prompts (Visual Analysis, Creative Director, etc.).
    *   `src/services/`: AI and OSS integration services.
    *   `schema.sql`: Database schema.
