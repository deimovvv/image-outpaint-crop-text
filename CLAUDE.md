# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application for AI-powered image processing featuring dual functionality: Smart Crop (intelligent cropping) and Outpaint (AI expansion). Built with App Router architecture, TypeScript, and @fal-ai/client integration supporting multiple AI models.

## Environment Setup

- **FAL API Key**: Required in `.env.local` as `FAL_KEY=your_api_key`
- **Vercel Deployment**: Add `FAL_KEY` in Project → Settings → Environment Variables

## Common Commands

- **Development**: `npm run dev` - Starts development server with Turbopack
- **Build**: `npm run build` - Builds the application with Turbopack
- **Production**: `npm start` - Starts production server
- **Lint**: `npm run lint` - Runs ESLint

## Architecture

- **Framework**: Next.js 15.5.3 with App Router
- **Runtime**: Node.js runtime (not Edge) for API routes to handle large files
- **File Upload**: Uses multipart/form-data to avoid JSON base64 bloat
- **Image Processing**: Client-side canvas manipulation and server-side Sharp processing
- **AI Services**: Dual AI model support (Seedream + FLUX Fill)

## Key Dependencies

- `@fal-ai/client` - FAL AI client for image generation
- `sharp` - High-performance server-side image processing
- `next` - Next.js framework
- `react` - React 19.1.0
- `tailwindcss` - Styling framework (optional)

## Core Components

### Smart Crop Component
- **Location**: `app/components/SmartCrop.tsx`
- **Purpose**: Intelligent cropping with person/subject detection
- **API**: `app/api/smart-crop/route.ts` using Sharp for server-side processing
- **Algorithm**: Multi-layered focal point detection (skin tones, contrast, edges, color variance)
- **Features**: Batch processing, progress tracking, multiple aspect ratios

### Outpaint Component
- **Location**: `app/components/Outpaint.tsx`
- **Purpose**: AI-powered image expansion with dual model support
- **API**: `app/api/outpaint/route.ts` (unified endpoint for both models)
- **Models**: Seedream (creative) + FLUX Fill (precise mask-based)
- **Features**: Model switching, gravity positioning, auto-prompts, protective recomposition

### Results Grid Component
- **Location**: `app/components/ResultsGrid.tsx`
- **Purpose**: Display, preview and download processed images
- **Features**: Modal view (85vh max), batch download, responsive grid

### Canvas Utilities
- **Location**: `src/lib/seedream-canvas.ts`
- **Purpose**: Canvas manipulation for both models
- **Key Functions**:
  - `buildSeedreamCanvas()` - Creative expansion with context hints
  - `buildFluxBaseImage()` + `generateFluxMask()` - Precise mask-based processing
  - `protectiveRecomposition()` - Original image preservation

### Main Layout
- **Location**: `app/page.tsx`
- **Features**: Tabbed interface (Smart Crop / Outpaint), unified results display

## File Structure

```
app/
├── api/
│   ├── outpaint/
│   │   └── route.ts     # Unified API (Seedream + FLUX Fill)
│   └── smart-crop/
│       └── route.ts     # Smart cropping with Sharp
├── components/
│   ├── SmartCrop.tsx    # Intelligent cropping UI
│   ├── Outpaint.tsx     # AI expansion UI
│   └── ResultsGrid.tsx  # Results display and download
├── page.tsx             # Main tabbed interface
└── globals.css          # Global styles

src/lib/
├── seedream-canvas.ts   # Canvas utilities for AI models
├── auto-prompts.ts      # Automatic prompt generation
└── mask.ts              # Mask generation utilities
```

## Workflows

### Smart Crop Workflow
1. User uploads image(s) and selects target ratio
2. Server-side Sharp processing analyzes image for focal points
3. Multi-algorithm detection: skin tones, contrast, edges, color variance
4. Intelligent cropping preserves detected subjects/people
5. Batch processing with real-time progress tracking
6. Results displayed in responsive grid with modal view

### Outpaint Workflow
1. User uploads image(s) and selects AI model (Seedream/FLUX Fill)
2. Client generates appropriate canvas based on selected model:
   - **Seedream**: Creative canvas with context hints
   - **FLUX Fill**: Clean base image + precise black/white mask
3. Files sent to `/api/outpaint` with model parameter
4. API routes to appropriate AI service:
   - **Seedream**: `fal-ai/bytedance/seedream/v4/edit`
   - **FLUX Fill**: `fal-ai/flux-pro/v1/fill`
5. Optional protective recomposition for Seedream results
6. Results displayed with download options

## AI Model Comparison

| Feature | Seedream | FLUX Fill |
|---------|----------|-----------|
| **Input** | Canvas with hints | Base + Mask |
| **Control** | Prompt-based | Mask-based |
| **Creativity** | High | Controlled |
| **Preservation** | ~70% (post-process) | 100% (native) |
| **Use Case** | Natural blending | Precise outpainting |

## Development Notes

- **App Router**: Uses modern App Router (not Pages Router)
- **File Handling**: Large files supported via Node.js runtime
- **TypeScript**: Strict mode enabled with path mapping `@/*`
- **Turbopack**: Enabled for faster builds and development
- **Progress Tracking**: Real-time progress bars for batch operations
- **Responsive Design**: Modal images sized to 85vh/85vw max
- **Error Handling**: Comprehensive logging and user feedback

## Smart Crop Algorithm

The intelligent cropping uses a multi-layered approach:
1. **Skin Tone Detection**: RGB, HSV, YCbCr color space analysis
2. **Contrast Analysis**: Local contrast measurement for subject detection
3. **Edge Density**: Sobel edge detection for important features
4. **Color Variance**: Statistical analysis of color distribution
5. **Scoring System**: Weighted combination (skin×10 + contrast×5 + edges×3 + variance×2)

## Quality Tips

### Smart Crop
- Works best with clear subjects/people in images
- Handles various skin tones and lighting conditions
- Batch processing optimized for multiple similar images

### Outpaint
- **Seedream**: Use creative prompts, enable protective recomposition for people
- **FLUX Fill**: Precise mask control, perfect for architectural/product images
- **Prompts**: "extend background to {direction}, maintain exact colors and textures"
- **Feathering**: 4px blur on mask edges for natural transitions