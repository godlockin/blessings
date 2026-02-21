# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Chinese New Year Blessing Photo Generator** (新年祝福生成器) - an AI-powered application that transforms user photos into traditional Chinese New Year-themed blessing images. Users upload a photo, and the system uses a multi-agent AI pipeline to analyze features, generate detailed prompts, and create a professionally styled blessing photo.

## Common Commands

```bash
# Development (with Cloudflare Functions support)
npm run start:dev    # Starts dev server on http://localhost:8788

# Development without Functions
npm run dev          # Starts Vite dev server only

# Building and Quality
npm run build        # TypeScript compile + Vite build to dist/
npm run check        # TypeScript type checking only
npm run lint         # ESLint code linting
npm run preview      # Preview production build

# Deployment
npx wrangler pages deploy dist --project-name blessings-img
```

## Architecture

### High-Level Structure

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│ Cloudflare Pages │────▶│ Google Gemini  │
│    (src/)       │     │   Functions      │     │      API        │
└─────────────────┘     │   (functions/)   │     └─────────────────┘
                        └──────────────────┘             ▲
                                │                       │
                                └───────────────────────┘
                                        │
                                        ▼
                                ┌─────────────────┐
                                │  Alibaba OSS    │
                                │   (Storage)     │
                                └─────────────────┘
```

### Multi-Agent AI Pipeline (Core Innovation)

The application uses a sophisticated multi-agent workflow (`src/lib/multi-agent/`) with the following stages:

1. **ImageAuditor** - Validates content safety and suitability
2. **ImageAnalyzer** - Extracts gender, age, ethnicity, facial features
3. **MultiExpertOrchestrator** - Coordinates 6 AI experts:
   - Portrait Photographer (lighting, composition)
   - Story Director (narrative, theme)
   - Senior Makeup Artist (skin, cosmetics)
   - Senior Costume Designer (clothing, traditional attire)
   - Senior Retoucher (post-processing)
   - Beauty Expert (age/gender-specific beautification)
4. **PromptGenerator** - Creates detailed prompts for image generation
5. **ImageGenerator** - Generates images via Gemini
6. **ImageReviewer** - Quality assessment and validation

### Key Directories

- `src/` - React TypeScript frontend
  - `components/` - Reusable UI components (ErrorBoundary, ErrorMessages)
  - `hooks/` - Custom React hooks (useTheme)
  - `lib/` - Core business logic and AI services
    - `multi-agent/` - Multi-agent orchestration system
    - `Beautifier.ts` - Age/gender-specific beautification strategies (830 lines)
    - `GeminiClient.ts` - Google Gemini API client
    - `ImageAnalyzer.ts` - Feature extraction
    - `ImageAuditor.ts` - Content moderation
    - `ImageReviewer.ts` - Quality assessment
    - `OSSService.ts` - Alibaba Cloud OSS integration
    - `PromptGenerator.ts` - Prompt generation logic
    - `GenerationWorkflow.ts` - Main workflow orchestration
  - `pages/` - Page components (Home, InvitePage, MainPage)
  - `store/` - Zustand state management (useAuthStore)
  - `types/` - TypeScript type definitions

- `functions/` - Cloudflare Pages Functions (serverless backend)
  - `api/process-image.ts` - Main image processing pipeline with SSE streaming
  - `api/verify-invite.ts` - Authentication endpoint

- `docs/` - API documentation

## Environment Setup

1. Copy `.dev.vars.example` to `.dev.vars` and configure:
   ```
   GEMINI_API_KEY=         # Google Gemini API key
   INVITE_CODE=            # Access control code
   OSS_REGION=             # e.g., oss-cn-hangzhou
   OSS_ACCESS_KEY_ID=      # Alibaba OSS credentials
   OSS_ACCESS_KEY_SECRET=
   OSS_BUCKET=
   OSS_ENDPOINT=           # Optional
   OSS_PREFIX=             # Optional path prefix
   ```

2. Production secrets must be set in Cloudflare Dashboard (Settings > Variables)

## Key Technical Details

### Server-Sent Events (SSE) Streaming
The `/api/process-image` endpoint uses SSE for real-time progress feedback to the frontend. The streaming happens at `functions/api/process-image.ts` with progressive image chunking.

### Beautification System
The `Beautifier.ts` module implements age/gender/ethnicity-specific strategies:
- **6 age groups**: child, teenager, young_adult, adult, middle_aged, elderly
- **Asian female optimization** with specialized prompts for V-line face slimming, skin perfection, and youth enhancement
- **Realism-first approach**: Prompts explicitly require "iPhone 16 Pro Max" realistic rendering with preserved skin texture and pores

### Frontend Configuration
- **State management**: Zustand for auth and theme
- **Routing**: React Router with protected routes (`/app` requires auth)
- **Styling**: TailwindCSS with complete dark mode (color palette in `src/pages/MainPage.tsx`)
- **Build**: Vite with source maps hidden in production

### TypeScript Configuration
- Strict mode enabled
- No implicit any, strict null checks
- Path aliases configured via `tsconfig.json` and `vite-tsconfig-paths`

### Testing
- Vitest with jsdom environment
- React Testing Library for component tests
- V8 coverage provider
- Test setup file: `src/test/setup.ts`

### Cloudflare Functions Compatibility
- Requires `nodejs_compat` flag (configured in `wrangler.toml`)
- CPU limit: 50000ms
- Development: `WRANGLER_HOME=.wrangler_home wrangler pages dev --compatibility-flags nodejs_compat`

## Important Architecture Decisions

1. **Fail-Open Design**: Image audit failures proceed with warnings rather than blocking, prioritizing user experience
2. **Realism Over Perfection**: "iPhone photo style" authenticity is explicitly prioritized over over-processed results
3. **No Frontend API Keys**: All secrets are server-side only via Cloudflare environment variables
4. **Multi-Agent Consensus**: Experts collaborate and reach consensus before final prompt generation
5. **Cultural Context**: Authentic Chinese New Year elements (red theme, lanterns, "作揖" traditional greeting pose)

## When Working on This Codebase

### Adding New AI Experts
- Add role to `ExpertRole` type in `src/lib/multi-agent/types.ts`
- Add expert prompt to `EXPERT_PROMPTS` in `src/lib/multi-agent/expertPrompts.ts`
- Add to `activeExperts` array in `MultiExpertOrchestrator` constructor

### Modifying Beautification
- Primary logic is in `Beautifier.ts`
- Age-specific strategies in `ASIAN_FEMALE_STRATEGIES` constant
- Ethnicity/gender detection functions at the top of the file

### Debugging Image Generation Issues
- Check `GenerationWorkflow.ts` for the main orchestration
- Review individual agent outputs in Cloudflare Functions logs
- Verify prompt templates in `expertPrompts.ts`

### Frontend State Changes
- Use Zustand stores in `src/store/`
- Main app component is `src/App.tsx` with React Router configuration
