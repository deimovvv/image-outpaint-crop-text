# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application called **AI IMAGE STUDIO** for comprehensive AI-powered image processing featuring multiple functionalities: Smart Crop (intelligent cropping with AI Reframe), Outpaint (AI expansion/reframing), Background Removal, and Text Overlay (coming soon). Built with App Router architecture, TypeScript, and @fal-ai/client integration supporting multiple AI models. Features Monks branding with custom color palette and elegant loader.

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
- **AI Services**: Multi-model AI support (Seedream, FLUX Fill, Luma Photon, Bria Background Removal, FAL Image Reframe)
- **Branding**: Monks color palette with mauve (#DFBBFE) and neutral (#EAE8E4) colors
- **UI/UX**: Elegant loader, documentation dropdown, minimalist icons

## Key Dependencies

- `@fal-ai/client` - FAL AI client for image generation and processing
- `sharp` - High-performance server-side image processing
- `next` - Next.js framework
- `react` - React 19.1.0
- `tailwindcss` - Styling framework (optional)

## Core Components

### Smart Crop Component
- **Location**: `app/components/SmartCrop.tsx`
- **Purpose**: Dual-mode intelligent cropping system with AI Reframe capability
- **API**: `app/api/smart-crop/route.ts` using Sharp and FAL AI
- **Two Modes**:
  - **Traditional Smart Crop**: Server-side Sharp processing with person/object detection
  - **AI Reframe**: FAL AI `fal-ai/image-editing/reframe` for intelligent aspect ratio adjustment
- **Traditional Features**:
  - Protect Faces mode with 95%+ person detection accuracy
  - Consistent batch cropping with focal point memory
  - Dual focal points (person + secondary object)
  - Multi-ethnic skin tone support (YCbCr + RGB analysis)
- **AI Reframe Features**:
  - Uses outpainting when expansion needed
  - Automatically handles both cropping and expanding
  - Preserves subject position and composition
  - No manual controls needed (simplified interface)
- **UI**: Toggle between modes with clear visual feedback, Monks branding integration

### Outpaint Component
- **Location**: `app/components/Outpaint.tsx`
- **Purpose**: AI-powered image expansion and reframing with quad model support
- **API**: `app/api/outpaint/route.ts` (unified endpoint for all models)
- **Models** (Qwen Edit+ removed):
  - **Seedream**: Creative expansion with artistic interpretation
  - **FLUX Fill**: Best for preserving faces/objects but inconsistent outpainting
  - **Luma Photon**: Most consistent outpainting, no prompts/gravity needed
- **Features**: Model switching, gravity positioning (hidden for Luma Photon), auto-prompts, subtle upload icons
- **Model-Specific UI**: Gravity controls automatically hidden when Luma Photon selected

### Background Removal Component
- **Location**: `app/components/BackgroundRemoval.tsx`
- **Purpose**: AI-powered background removal with transparency
- **API**: `app/api/background-removal/route.ts` using Bria AI
- **Features**: Batch processing, high-quality edge preservation, transparent PNG output, subtle upload icons

### Coming Soon Component
- **Location**: `app/components/ComingSoon.tsx`
- **Purpose**: Placeholder for Text Overlay functionality
- **Status**: Development in progress

### Documentation Component (Replaces Settings)
- **Location**: Integrated in `app/page.tsx` header
- **Purpose**: Comprehensive usage guide for all tools
- **Features**: Dropdown with detailed explanations, model comparisons, best practices
- **Access**: "DOCS" button in top-right corner with Monks branding

### Loader Component
- **Location**: `app/components/Loader.tsx`
- **Purpose**: Elegant loading screen on app startup
- **Features**: 2-second animated loader with Monks colors, spinning rings, pulsing center, bouncing dots
- **Styling**: Matches Monks brand palette (#DFBBFE, #EAE8E4, #0A0A0A)

### Results Grid Component
- **Location**: `app/components/ResultsGrid.tsx`
- **Purpose**: Display, preview and download processed images
- **Features**: Modal view (85vh max), batch download, responsive grid, "No results yet" message in English
- **Icons**: Subtle camera icon (📷) instead of bold flash camera

### Canvas Utilities
- **Location**: `src/lib/seedream-canvas.ts`
- **Purpose**: Canvas manipulation for AI models
- **Key Functions**:
  - `buildSeedreamCanvas()` - Creative expansion with context hints
  - `buildFluxBaseImage()` + `generateFluxMask()` - Precise mask-based processing
  - `protectiveRecomposition()` - Original image preservation

### Main Layout
- **Location**: `app/page.tsx`
- **Features**: Multi-tab interface (Smart Crop, Outpaint, Background Removal, Text Overlay), unified results display, documentation dropdown
- **Branding**: Monks color scheme with mauve accent for Smart Crop, elegant loader on startup
- **Header**: "AI IMAGE STUDIO" title with "DOCS" button, no pink gradient background

## File Structure

```
app/
├── api/
│   ├── outpaint/
│   │   └── route.ts         # Unified API (3 models: Seedream, FLUX Fill, Luma Photon)
│   ├── background-removal/
│   │   └── route.ts         # Background removal API (Bria AI)
│   ├── smart-crop/
│   │   └── route.ts         # Smart cropping with Sharp + AI Reframe with FAL
│   ├── validate-key/
│   │   └── route.ts         # API key validation (disabled)
│   └── export-psd/
│       └── route.ts         # PSD export functionality (disabled)
├── components/
│   ├── SmartCrop.tsx        # Dual-mode cropping UI (Traditional + AI Reframe)
│   ├── Outpaint.tsx         # AI expansion/reframing UI (3 models)
│   ├── BackgroundRemoval.tsx # Background removal UI
│   ├── ComingSoon.tsx       # Text overlay placeholder
│   ├── Loader.tsx           # Elegant startup loader
│   ├── Settings.tsx         # API configuration (disabled)
│   └── ResultsGrid.tsx      # Results display and download
├── page.tsx                 # Main multi-tab interface with Monks branding
└── globals.css              # Global styles

src/lib/
├── seedream-canvas.ts       # Canvas utilities for AI models
├── auto-prompts.ts          # Automatic prompt generation
├── mask.ts                  # Mask generation utilities
├── psd-export.ts           # PSD export functionality (disabled)
├── subject-mask.ts         # Subject detection and masking
├── api-config.ts           # API configuration utilities (disabled)
└── use-api-client.ts       # API client hook (disabled)
```

## Workflows

### Smart Crop Workflow (Dual Mode)

**Traditional Smart Crop Mode:**
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

**AI Reframe Mode:**
1. User toggles AI Reframe (traditional controls disabled)
2. User uploads image(s) and selects target aspect ratio
3. Server sends to FAL AI `fal-ai/image-editing/reframe` endpoint
4. AI intelligently:
   - **Crops** when target ratio can be achieved by cropping
   - **Uses outpainting** when expansion is needed for target ratio
   - **Preserves subject** position and composition automatically
5. Results are naturally expanded/cropped with AI intelligence
6. Toggle back to traditional mode re-enables all Smart Crop controls

### Outpaint Workflow
1. User uploads image(s) and selects AI model (Seedream/FLUX Fill/Luma Photon)
2. **Model Selection UI**: Gravity controls automatically hidden when Luma Photon selected
3. Client generates appropriate input based on selected model:
   - **Seedream**: Creative canvas with context hints
   - **FLUX Fill**: Clean base image + precise black/white mask
   - **Luma Photon**: Original image only (no canvas/gravity needed)
4. Files sent to `/api/outpaint` with model parameter
5. API routes to appropriate AI service:
   - **Seedream**: `fal-ai/bytedance/seedream/v4/edit`
   - **FLUX Fill**: `fal-ai/flux-pro/v1/fill`
   - **Luma Photon**: `fal-ai/luma-photon/reframe`
6. Optional protective recomposition for Seedream results
7. Results displayed with download options

### Background Removal Workflow
1. User uploads image(s)
2. Images sent to `/api/background-removal`
3. Server uploads images to FAL storage
4. API calls `fal-ai/bria/background/remove`
5. High-quality background removal with edge preservation
6. Transparent PNG results returned and displayed

## AI Model Comparison

| Feature | Seedream | FLUX Fill | Luma Photon | FAL Reframe | Bria BG Removal |
|---------|----------|-----------|-------------|-------------|-----------------|
| **Input** | Canvas with hints | Base + Mask | Original image | Original image | Original image |
| **Control** | Prompt-based | Mask-based | Aspect ratio only | Aspect ratio only | Automatic |
| **Creativity** | High artistic | Controlled precise | Medium consistent | Smart adaptive | N/A |
| **Preservation** | ~70% (post-process) | Best for faces/objects | 100% (most consistent) | 100% (intelligent) | Subject only |
| **Consistency** | Variable | Inconsistent outpainting | Most reliable | Very reliable | High |
| **Use Case** | Creative expansion | Face/object preservation | Reliable outpainting | Smart crop/expand | Background removal |
| **Best For** | Artistic results | People/portraits | General outpainting | Aspect ratio changes | Transparent PNGs |
| **UI Controls** | Full gravity/prompts | Full gravity/prompts | No gravity needed | No controls needed | None |

## Development Notes

- **App Router**: Uses modern App Router (not Pages Router)
- **File Handling**: Large files supported via Node.js runtime
- **TypeScript**: Strict mode enabled with path mapping `@/*`
- **Turbopack**: Enabled for faster builds and development
- **Progress Tracking**: Real-time progress bars for batch operations
- **Responsive Design**: Modal images sized to 85vh/85vw max
- **Error Handling**: Comprehensive logging and user feedback
- **Monks Branding**: Custom color palette (#DFBBFE mauve, #EAE8E4 neutral, #0A0A0A dark)
- **Minimalist UI**: Clean, professional interface with subtle icons (⬆ upload, 📷 camera)
- **Documentation**: Comprehensive usage guide accessible via "DOCS" button (replaces Settings)
- **Loader**: Elegant 2-second startup animation with Monks colors
- **PSD Export**: Functionality disabled (removed from Smart Crop interface)

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

**Monks Branding Palette:**
- **Primary**: Mauve (#DFBBFE) - Main accent color
- **Secondary**: Light Purple (#C8A2FE) - Gradients and highlights
- **Neutral**: Light Gray (#EAE8E4) - Main text color
- **Dark**: Black (#0A0A0A) - Main background
- **Smart Crop**: Mauve (#DFBBFE) - Updated from green

**Model-Specific Colors:**
- **Seedream**: Orange (#FF6B35)
- **FLUX Fill**: Green (#4CAF50)
- **Luma Photon**: Purple (#9C27B0)
- **Background Removal**: Purple (#8B5CF6)
- **Text Overlay**: Gray (Coming Soon)

## Features Status

- ✅ **Smart Crop**: Fully implemented (Traditional + AI Reframe modes)
- ✅ **Outpaint**: 3 models fully implemented (Seedream, FLUX Fill, Luma Photon)
- ✅ **Background Removal**: Fully implemented with Bria AI
- ✅ **Documentation**: Comprehensive guide with model comparisons
- ✅ **Monks Branding**: Complete UI overhaul with custom color palette
- ✅ **Loader**: Elegant startup animation
- ⏳ **Text Overlay**: Coming soon
- ❌ **PSD Export**: Removed from Smart Crop (functionality disabled)
- ❌ **Qwen Edit+**: Removed from Outpaint options

## Recent Major Updates

### AI Reframe Integration (Smart Crop)
- **New Mode**: Added AI Reframe as alternative to traditional Smart Crop
- **Toggle System**: Users can switch between Traditional Smart Crop and AI Reframe
- **Smart Logic**: AI Reframe uses outpainting when expansion needed, cropping when possible
- **UI Changes**: Traditional controls disabled when AI Reframe active, clear toggle feedback
- **API**: Uses `fal-ai/image-editing/reframe` endpoint

### Monks Branding Implementation
- **Color Overhaul**: Replaced all green accents (#00ff88) with Monks mauve (#DFBBFE)
- **Typography**: System sans-serif fonts with proper weights (500-700)
- **Header**: Clean title without gradient background
- **Consistent Palette**: Applied throughout all components and states

### UI/UX Improvements
- **Elegant Loader**: 2-second animated startup with spinning rings and bouncing dots
- **Subtle Icons**: Refined upload (⬆) and camera (📷) icons
- **Documentation**: Replaced Settings with comprehensive "DOCS" dropdown
- **Model-Specific UI**: Gravity controls auto-hide for Luma Photon
- **English Interface**: "No results yet" message updated

### Functionality Cleanup
- **PSD Export**: Completely removed from Smart Crop interface
- **Qwen Edit+**: Removed from Outpaint model options
- **Model Count**: Outpaint reduced from 4 to 3 models (cleaner, more focused)
- **Error Resolution**: Fixed all state management issues related to removed features