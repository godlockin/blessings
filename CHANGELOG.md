# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial P0 fixes implementation
- SSE state machine for robust event parsing
- Image compression before upload
- Responsive progress bar using Tailwind classes

### Changed
- Improved error handling with user-friendly messages
- Enhanced dark mode support with complete color palette

### Fixed
- SSE multi-line data concatenation bug
- Responsive progress bar display issues
- Image upload size optimization

---

## [1.0.0] - 2025-02-05

### Added
- Initial release of Blessings Img (新年祝福生成器)
- AI-powered image processing pipeline
- Server-Sent Events (SSE) streaming support
- Invite code authentication system
- Aliyun OSS integration for image storage
- Complete Chinese New Year themed UI

### Features
- Full AI processing pipeline:
  - Image content audit
  - Feature analysis
  - Prompt generation
  - Image generation
  - Quality review
- Real-time progress feedback via SSE
- Responsive design with TailwindCSS
- Dark mode support

### Technical Stack
- Frontend: React 18 + TypeScript + Vite
- Backend: Cloudflare Pages Functions
- AI: Google Gemini Pro & Pro Vision
- Storage: Aliyun OSS
- Styling: TailwindCSS

---

## [0.9.0-beta] - 2025-01-18

### Added
- Initial prototype with basic image upload
- Gemini API integration proof-of-concept
- Project scaffolding and configuration

### Known Issues
- SSE parsing needs robustness improvements
- Missing image compression
- Incomplete dark mode implementation
- No error boundary protection

---

## Versioning Strategy

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backward-compatible manner
- **PATCH** version when you make backward-compatible bug fixes

---

## Release Types

- **Release**: Stable production-ready version
- **Beta**: Feature-complete, may contain bugs
- **Alpha**: Early development stage

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0.0 | 2025-02-05 | Release |
| 0.9.0-beta | 2025-01-18 | Beta |
| 0.1.0 | 2025-01-10 | Alpha |
