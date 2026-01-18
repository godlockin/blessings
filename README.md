# Blessings Img - Chinese New Year Blessing Generator

A web application that generates Chinese New Year blessing photos from user-uploaded photos using AI.

## Features

- **Invite Code System**: Secure access control.
- **Photo Upload**: User-friendly upload interface.
- **AI Processing**:
  - Image Audit (Safety Check)
  - Image Analysis (Feature Extraction)
  - Prompt Generation (Creative Writing)
  - Image Generation (AI Art)
- **Result Display**: Side-by-side comparison and download.

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, Vite
- **Backend**: Cloudflare Pages Functions
- **AI**: Google Gemini API
- **Storage**: Aliyun OSS (Configured but disabled for local dev due to compatibility)

## Getting Started

### Prerequisites

- Node.js installed.
- Google Gemini API Key.

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   The project uses `.dev.vars` for local development. Keys are already configured.

### Running Locally

To start the development server with Cloudflare Functions support:

```bash
npm run start:dev
```

Open [http://localhost:8788](http://localhost:8788) in your browser.

**Invite Code**: `Aid1234!`

## Deployment

Deploy to Cloudflare Pages:

```bash
npm run build
npx wrangler pages deploy dist
```

Ensure environment variables are set in the Cloudflare Dashboard.
