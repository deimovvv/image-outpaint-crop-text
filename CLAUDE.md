# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application called **AI IMAGE STUDIO** for comprehensive AI-powered image processing featuring multiple functionalities: Smart Crop (intelligent cropping), Outpaint (AI expansion/reframing), Background Removal, and Text Overlay (coming soon). Built with App Router architecture, TypeScript, and @fal-ai/client integration supporting multiple AI models.

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
- **AI Services**: Multi-model AI support (Seedream, FLUX Fill, Luma Photon, Qwen Edit+, Bria Background Removal)

## Key Dependencies

- `@fal-ai/client` - FAL AI client for image generation and processing
- `sharp` - High-performance server-side image processing
- `next` - Next.js framework
- `react` - React 19.1.0
- `tailwindcss` - Styling framework (optional)

## Core Components

### Smart Crop Component
- **Location**: `app/components/SmartCrop.tsx`
- **Purpose**: Intelligent cropping with specialized person/object detection
- **API**: `app/api/smart-crop/route.ts` using Sharp for server-side processing
- **Dual Algorithms**:
  - **Person Detection**: 5-algorithm skin detection + facial feature analysis
  - **Object Detection**: Contrast/edge-based subject detection
- **Features**:
  - Protect Faces mode with 95%+ person detection accuracy
  - Consistent batch cropping with focal point memory
  - Dual focal points (person + secondary object)
  - Multi-ethnic skin tone support (YCbCr + RGB analysis)
  - Real-time progress tracking and intelligent logging

### Outpaint Component
- **Location**: `app/components/Outpaint.tsx`
- **Purpose**: AI-powered image expansion and reframing with quad model support
- **API**: `app/api/outpaint/route.ts` (unified endpoint for all models)
- **Models**:
  - Seedream (creative expansion)
  - FLUX Fill (precise mask-based outpainting)
  - Luma Photon (intelligent reframing)
  - Qwen Edit+ (advanced multi-image editing)
- **Features**: Model switching, gravity positioning, auto-prompts, protective recomposition

### Background Removal Component
- **Location**: `app/components/BackgroundRemoval.tsx`
- **Purpose**: AI-powered background removal with transparency
- **API**: `app/api/background-removal/route.ts` using Bria AI
- **Features**: Batch processing, high-quality edge preservation, transparent PNG output

### Coming Soon Component
- **Location**: `app/components/ComingSoon.tsx`
- **Purpose**: Placeholder for Text Overlay functionality
- **Status**: Development in progress

### Settings Component (Hidden)
- **Location**: `app/components/Settings.tsx`
- **Purpose**: API key configuration (temporarily disabled)
- **Features**: Custom API key management, validation, localStorage persistence

### Results Grid Component
- **Location**: `app/components/ResultsGrid.tsx`
- **Purpose**: Display, preview and download processed images
- **Features**: Modal view (85vh max), batch download, responsive grid

### Canvas Utilities
- **Location**: `src/lib/seedream-canvas.ts`
- **Purpose**: Canvas manipulation for AI models
- **Key Functions**:
  - `buildSeedreamCanvas()` - Creative expansion with context hints
  - `buildFluxBaseImage()` + `generateFluxMask()` - Precise mask-based processing
  - `protectiveRecomposition()` - Original image preservation

### Main Layout
- **Location**: `app/page.tsx`
- **Features**: Multi-tab interface (Smart Crop, Outpaint, Background Removal, Text Overlay), unified results display, settings dropdown (hidden)

## File Structure

```
app/
├── api/
│   ├── outpaint/
│   │   └── route.ts         # Unified API (4 models: Seedream, FLUX Fill, Luma Photon, Qwen Edit+)
│   ├── background-removal/
│   │   └── route.ts         # Background removal API (Bria AI)
│   ├── smart-crop/
│   │   └── route.ts         # Smart cropping with Sharp
│   ├── validate-key/
│   │   └── route.ts         # API key validation (disabled)
│   └── export-psd/
│       └── route.ts         # PSD export functionality
├── components/
│   ├── SmartCrop.tsx        # Intelligent cropping UI
│   ├── Outpaint.tsx         # AI expansion/reframing UI (4 models)
│   ├── BackgroundRemoval.tsx # Background removal UI
│   ├── ComingSoon.tsx       # Text overlay placeholder
│   ├── Settings.tsx         # API configuration (hidden)
│   └── ResultsGrid.tsx      # Results display and download
├── page.tsx                 # Main multi-tab interface
└── globals.css              # Global styles

src/lib/
├── seedream-canvas.ts       # Canvas utilities for AI models
├── auto-prompts.ts          # Automatic prompt generation
├── mask.ts                  # Mask generation utilities
├── psd-export.ts           # PSD export functionality
├── subject-mask.ts         # Subject detection and masking
├── api-config.ts           # API configuration utilities (disabled)
└── use-api-client.ts       # API client hook (disabled)
```

## Workflows

### Smart Crop Workflow

**Person Detection Mode (Protect Faces ON):**
1. User uploads image(s) and selects target ratio + enables Protect Faces
2. Server runs specialized person detection algorithm:
   - 5-algorithm skin tone detection across all ethnicities
   - Facial feature analysis (color consistency, brightness, channel ratios)
   - Person-optimized scoring with 40× skin weight + 15× face features
   - Positional bonuses for rule of thirds and upper regions
3. **High confidence (score >8.0)**: Centers crop on detected person
4. **Medium confidence**: Uses composition-based intelligent fallback
5. **Low confidence**: Falls back to standard object detection
6. Batch processing maintains consistent focal point across all images

**Object Detection Mode (Protect Faces OFF):**
1. User uploads image(s) and selects target ratio
2. Server runs general subject detection:
   - Multi-algorithm analysis: contrast, edge density, color variance
   - Composition rules: rule of thirds, visual weight, symmetry
   - Object optimization: high contrast/edge prioritization
3. Intelligent cropping preserves detected subjects/products
4. Results optimized for e-commerce, logos, architecture, graphics

**Advanced Features:**
- **Consistent Crop**: Same focal point across batch (memory-based)
- **Dual Focal Points**: Detects person + secondary object, includes both
- **Real-time logging**: Clear detection feedback with confidence scores
- **Progress tracking**: Batch processing with individual image status

### Outpaint Workflow
1. User uploads image(s) and selects AI model (Seedream/FLUX Fill/Luma Photon/Qwen Edit+)
2. Client generates appropriate input based on selected model:
   - **Seedream**: Creative canvas with context hints
   - **FLUX Fill**: Clean base image + precise black/white mask
   - **Luma Photon**: Original image only (no canvas needed)
   - **Qwen Edit+**: Original image + canvas for context
3. Files sent to `/api/outpaint` with model parameter
4. API routes to appropriate AI service:
   - **Seedream**: `fal-ai/bytedance/seedream/v4/edit`
   - **FLUX Fill**: `fal-ai/flux-pro/v1/fill`
   - **Luma Photon**: `fal-ai/luma-photon/reframe`
   - **Qwen Edit+**: `fal-ai/qwen-image-edit-plus`
5. Optional protective recomposition for Seedream results
6. Results displayed with download options

### Background Removal Workflow
1. User uploads image(s)
2. Images sent to `/api/background-removal`
3. Server uploads images to FAL storage
4. API calls `fal-ai/bria/background/remove`
5. High-quality background removal with edge preservation
6. Transparent PNG results returned and displayed

## AI Model Comparison

| Feature | Seedream | FLUX Fill | Luma Photon | Qwen Edit+ | Bria BG Removal |
|---------|----------|-----------|-------------|------------|-----------------|
| **Input** | Canvas with hints | Base + Mask | Original image | Multi-image | Original image |
| **Control** | Prompt-based | Mask-based | Aspect ratio | Prompt + Multi-image | Automatic |
| **Creativity** | High | Controlled | Medium | High | N/A |
| **Preservation** | ~70% (post-process) | 100% (native) | 100% (reframe) | Variable | Subject only |
| **Use Case** | Natural blending | Precise outpainting | Smart reframing | Advanced editing | Background removal |
| **Output** | Expanded image | Outpainted image | Reframed image | Edited image | Transparent PNG |

## Development Notes

- **App Router**: Uses modern App Router (not Pages Router)
- **File Handling**: Large files supported via Node.js runtime
- **TypeScript**: Strict mode enabled with path mapping `@/*`
- **Turbopack**: Enabled for faster builds and development
- **Progress Tracking**: Real-time progress bars for batch operations
- **Responsive Design**: Modal images sized to 85vh/85vw max
- **Error Handling**: Comprehensive logging and user feedback
- **Minimalist UI**: Clean, professional interface without distracting icons
- **Settings**: API configuration temporarily hidden (can be enabled by changing `false` to `true` in header)

## Smart Crop Algorithm

The intelligent cropping system now features **dual-mode detection** optimized for different scenarios:

### **Protect Faces Mode (Person Detection)**
When "Protect Faces" is enabled, uses specialized person detection algorithm:

1. **Advanced Skin Detection**: 5 different algorithms for all skin tones:
   - RGB ranges for general skin tones
   - Specialized detection for light skin (RGB >180,150,120)
   - Medium skin tone detection (RGB 120-180, 70-140, 50-100)
   - Dark skin tone detection (RGB 70-120, 40-90, 25-70)
   - YCbCr color space (highly reliable across all ethnicities)

2. **Facial Feature Analysis**:
   - Color consistency scoring (faces have uniform skin tones)
   - Brightness validation (faces are typically well-lit 80-200 range)
   - Channel relationship verification (red > green >= blue for skin)

3. **Person-Optimized Scoring**:
   - **High skin confidence (>4%)**: Score ×40 + facial features ×15
   - **Medium skin confidence (2-4%)**: Score ×25 + facial features ×10
   - **Low skin confidence (<2%)**: Minimal scoring, fallback mode
   - **Positional bonuses**: Rule of thirds + upper region preference

4. **Multi-Level Fallback**:
   - Primary: Person-focused algorithm (score threshold >8.0)
   - Secondary: Composition-based intelligent detection
   - Tertiary: Standard grid-based focal point detection

### **Standard Mode (Object/Product Detection)**
When "Protect Faces" is disabled, uses general subject detection:

1. **Multi-Algorithm Analysis**: Contrast, edge density, color variance
2. **Composition Rules**: Rule of thirds, visual weight, symmetry
3. **Object Optimization**: High contrast and edge density prioritization

### **Advanced Features**

- **Consistent Crop**: Maintains same focal point across batch processing
- **Dual Focal Points**: Detects person + secondary object, includes both when possible
- **Intelligent Logging**: Clear detection feedback with confidence scores
- **Batch Processing**: Memory-efficient processing with progress tracking

## Quality Tips

### Smart Crop
**Person Detection (Protect Faces ON):**
- **Highly effective** for portraits, selfies, group photos
- **Multi-ethnic support**: Optimized for all skin tones and lighting conditions
- **Face-first priority**: Focuses on faces/heads, then torsos as fallback
- **Batch consistency**: Same person detection across multiple images
- **Dual detection**: Can include both person + background object when space allows

**Object Detection (Protect Faces OFF):**
- **Product photography**: Excellent for e-commerce, logos, artwork
- **High-contrast subjects**: Focuses on visually prominent elements
- **Architecture/scenes**: Uses composition rules and visual weight
- **Text/graphics**: Detects high-contrast textual elements

**Best Practices:**
- Use **Protect Faces ON** for any images with people
- Use **Consistent Crop ON** for batch processing similar images
- Use **Dual Focal Points ON** for complex scenes (person + product)
- **Sensitivity 3-7**: Lower for subtle detection, higher for aggressive cropping

### Outpaint Models
- **Seedream**: Use creative prompts, enable protective recomposition for people
- **FLUX Fill**: Precise mask control, perfect for architectural/product images
- **Luma Photon**: Automatic intelligent reframing, no prompt needed
- **Qwen Edit+**: Advanced editing with multiple image context, creative prompts
- **Prompts**: "extend background to {direction}, maintain exact colors and textures"
- **Feathering**: 4px blur on mask edges for natural transitions

### Background Removal
- Works best with clear subject-background separation
- High-quality edge preservation for hair, fur, and fine details
- Outputs transparent PNG for easy compositing
- Batch processing for multiple images

## Color Scheme

- **Seedream**: Orange (#FF6B35)
- **FLUX Fill**: Green (#4CAF50)
- **Luma Photon**: Purple (#9C27B0)
- **Qwen Edit+**: Pink (#E91E63)
- **Background Removal**: Purple (#8B5CF6)
- **Text Overlay**: Gray (Coming Soon)

## Features Status

- ✅ **Smart Crop**: Fully implemented
- ✅ **Outpaint**: 4 models fully implemented
- ✅ **Background Removal**: Fully implemented
- ⏳ **Text Overlay**: Coming soon
- 🔒 **Settings**: Implemented but hidden (API key configuration)