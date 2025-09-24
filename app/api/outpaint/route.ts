import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const runtime = 'nodejs';

// Configure FAL with API key
fal.config({
  credentials: process.env.FAL_KEY!
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const prompt = formData.get('prompt') as string;
    const imageSize = formData.get('image_size') as string;
    const canvasImage = formData.get('canvas_image') as File;
    const originalImage = formData.get('original_image') as File;
    const seed = formData.get('seed') as string;
    const aiModel = formData.get('ai_model') as string || 'seedream';

    // Validation depends on the AI model
    if (aiModel === 'luma-photon') {
      if (!originalImage || !imageSize) {
        return NextResponse.json({
          error: 'Missing required fields for Luma Photon: original_image, image_size'
        }, { status: 400 });
      }
    } else {
      if (!prompt || !imageSize || !canvasImage) {
        return NextResponse.json({
          error: 'Missing required fields: prompt, image_size, canvas_image'
        }, { status: 400 });
      }
    }

    console.log(`🤖 Starting ${aiModel} outpainting with:`, {
      prompt: prompt ? prompt.substring(0, 100) + '...' : 'No prompt (Luma Photon)',
      imageSize,
      aiModel,
      hasOriginalImage: !!originalImage,
      hasCanvasImage: !!canvasImage
    });

    // Parse image size (e.g., "1080x1350" -> {width: 1080, height: 1350})
    if (!imageSize || typeof imageSize !== 'string') {
      return NextResponse.json({
        error: 'Missing or invalid image_size parameter'
      }, { status: 400 });
    }

    const [width, height] = imageSize.split('x').map(Number);

    // For Luma Photon, we only need valid dimensions (no strict limits)
    if (aiModel === 'luma-photon') {
      if (!width || !height || width < 1 || height < 1) {
        return NextResponse.json({
          error: 'Invalid image_size for Luma Photon. Must be WxH format with positive dimensions'
        }, { status: 400 });
      }
    } else {
      // For other models, apply the strict validation
      if (!width || !height || width < 512 || height < 512 || width > 4096 || height > 4096) {
        return NextResponse.json({
          error: 'Invalid image_size. Must be WxH format, each dimension 512-4096'
        }, { status: 400 });
      }
    }

    // Route to appropriate AI model
    if (aiModel === 'flux-fill') {
      return await processWithFluxFill(formData, prompt, width, height, canvasImage, originalImage, seed);
    } else if (aiModel === 'luma-photon') {
      return await processWithLumaPhoton(formData, prompt, width, height, canvasImage, originalImage, seed);
    } else {
      return await processWithSeedream(formData, prompt, width, height, canvasImage, originalImage, seed);
    }

  } catch (error) {
    console.error('❌ Outpaint API Error:', error);
    return NextResponse.json({
      error: 'Outpainting failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

async function processWithSeedream(
  formData: FormData,
  prompt: string,
  width: number,
  height: number,
  canvasImage: File,
  originalImage: File,
  seed: string
) {
  console.log('🌱 Processing with Seedream...');

  // Upload images to FAL storage
  const canvasUrl = await fal.storage.upload(canvasImage);
  console.log('📤 Canvas uploaded to:', canvasUrl);

  // Prepare image URLs array
  const imageUrls = [canvasUrl];

  // If original image provided, upload and add as reference
  if (originalImage) {
    const originalUrl = await fal.storage.upload(originalImage);
    imageUrls.push(originalUrl);
    console.log('📤 Original uploaded to:', originalUrl);
  }

  // Call Seedream API
  console.log('🔄 Calling Seedream API...');
  const result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
    input: {
      prompt,
      image_size: {
        width,
        height
      },
      image_urls: imageUrls,
      num_images: 1,
      max_images: 1,
      enable_safety_checker: true,
      ...(seed && { seed: parseInt(seed) })
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs?.map((log) => log.message).forEach(console.log);
      }
    }
  });

  console.log('✅ Seedream completed successfully');

  return NextResponse.json({
    success: true,
    data: result.data,
    requestId: result.requestId,
    model: 'seedream'
  });
}

async function processWithFluxFill(
  formData: FormData,
  prompt: string,
  width: number,
  height: number,
  canvasImage: File,
  originalImage: File,
  seed: string
) {
  console.log('🎯 Processing with FLUX Fill...');
  console.log('🔧 FLUX Fill parameters:', {
    prompt: prompt ? prompt.substring(0, 50) + '...' : 'No prompt',
    dimensions: `${width}x${height}`,
    baseImageSize: canvasImage.size,
    seed
  });

  // For FLUX Fill, we expect the client to send both base image and mask
  const maskImage = formData.get('mask_image') as File;

  if (!maskImage) {
    console.error('❌ Missing mask_image for FLUX Fill');
    return NextResponse.json({
      error: 'FLUX Fill requires mask_image. Please ensure the client sends both canvas_image and mask_image.',
      details: 'The client must generate and send both the base image and mask with identical dimensions.'
    }, { status: 400 });
  }

  console.log('📋 File sizes:', {
    baseImage: `${Math.round(canvasImage.size / 1024)}KB`,
    maskImage: `${Math.round(maskImage.size / 1024)}KB`
  });

  try {
    // Upload base image and mask to FAL storage
    console.log('📤 Uploading base image...');
    const imageUrl = await fal.storage.upload(canvasImage);

    console.log('📤 Uploading mask image...');
    const maskUrl = await fal.storage.upload(maskImage);

    console.log('✅ Upload completed:', {
      imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'No imageUrl',
      maskUrl: maskUrl ? maskUrl.substring(0, 50) + '...' : 'No maskUrl'
    });

    // Call FLUX Fill API with detailed logging
    console.log('🔄 Calling FLUX Fill API with parameters:', {
      model: 'fal-ai/flux-pro/v1/fill',
      prompt,
      dimensions: `${width}x${height}`,
      hasSeed: !!seed
    });

    const result = await fal.subscribe("fal-ai/flux-pro/v1/fill", {
      input: {
        prompt,
        image_url: imageUrl,
        mask_url: maskUrl,
        num_images: 1,
        enable_safety_checker: true,
        ...(seed && { seed: parseInt(seed) })
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`🔄 FLUX Status: ${update.status}`);
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(msg =>
            console.log(`📝 FLUX Log: ${msg}`)
          );
        }
      }
    });

    console.log('✅ FLUX Fill completed successfully:', {
      requestId: result.requestId,
      hasImages: !!result.data?.images?.length,
      imageCount: result.data?.images?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      requestId: result.requestId,
      model: 'flux-fill'
    });

  } catch (error) {
    console.error('❌ FLUX Fill error:', error);

    // Enhanced error reporting
    const errorMessage = error instanceof Error ? error.message : 'Unknown FLUX Fill error';

    return NextResponse.json({
      error: 'FLUX Fill processing failed: ' + errorMessage,
      details: error instanceof Error ? error.stack : 'No additional details',
      model: 'flux-fill'
    }, { status: 500 });
  }
}

async function processWithLumaPhoton(
  formData: FormData,
  prompt: string,
  width: number,
  height: number,
  canvasImage: File,
  originalImage: File,
  seed: string
) {
  console.log('📸 Processing with Luma Photon Reframe...');

  // Get gravity setting from formData
  const gravity = formData.get('gravity') as string || 'center';

  // Upload the original image to FAL storage
  const imageUrl = await fal.storage.upload(originalImage);
  console.log('📤 Image uploaded to:', imageUrl);

  // Get original image dimensions
  const originalWidth = parseInt(formData.get('original_width') as string);
  const originalHeight = parseInt(formData.get('original_height') as string);

  if (!originalWidth || !originalHeight) {
    console.warn('⚠️ Missing original image dimensions, using provided dimensions');
  }

  const imgWidth = originalWidth || width;
  const imgHeight = originalHeight || height;

  // Calculate anchor coordinates based on gravity setting
  let x_start: number, x_end: number, y_start: number, y_end: number;

  const targetRatio = width / height;
  const currentRatio = imgWidth / imgHeight;

  if (targetRatio > currentRatio) {
    // Need to expand horizontally (wider aspect ratio)
    const newWidth = imgHeight * targetRatio;
    const expansionWidth = newWidth - imgWidth;

    switch (gravity) {
      case 'left':
        // Anchor to left edge, expand right
        x_start = 0;
        x_end = imgWidth;
        break;
      case 'right':
        // Anchor to right edge, expand left
        x_start = expansionWidth;
        x_end = expansionWidth + imgWidth;
        break;
      case 'center':
      default:
        // Anchor to center, expand both sides
        x_start = expansionWidth / 2;
        x_end = x_start + imgWidth;
        break;
    }

    // Keep full height
    y_start = 0;
    y_end = imgHeight;

  } else if (targetRatio < currentRatio) {
    // Need to expand vertically (taller aspect ratio)
    const newHeight = imgWidth / targetRatio;
    const expansionHeight = newHeight - imgHeight;

    switch (gravity) {
      case 'top':
        // Anchor to top edge, expand bottom
        y_start = 0;
        y_end = imgHeight;
        break;
      case 'bottom':
        // Anchor to bottom edge, expand top
        y_start = expansionHeight;
        y_end = expansionHeight + imgHeight;
        break;
      case 'center':
      default:
        // Anchor to center, expand both sides
        y_start = expansionHeight / 2;
        y_end = y_start + imgHeight;
        break;
    }

    // Keep full width
    x_start = 0;
    x_end = imgWidth;

  } else {
    // Same aspect ratio - no expansion needed
    x_start = 0;
    x_end = imgWidth;
    y_start = 0;
    y_end = imgHeight;
  }

  // Determine aspect ratio from dimensions
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const aspectWidth = width / divisor;
  const aspectHeight = height / divisor;
  const aspectRatio = `${aspectWidth}:${aspectHeight}`;

  // Map common ratios to Luma Photon supported ratios
  const supportedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"];
  let finalAspectRatio = aspectRatio;

  if (!supportedRatios.includes(aspectRatio)) {
    // Find closest supported ratio
    const targetRatio = width / height;
    const ratioMap = {
      "1:1": 1,
      "4:3": 4/3,
      "3:4": 3/4,
      "16:9": 16/9,
      "9:16": 9/16,
      "21:9": 21/9,
      "9:21": 9/21
    };

    let closestRatio = "1:1";
    let minDiff = Math.abs(targetRatio - 1);

    for (const [ratio, value] of Object.entries(ratioMap)) {
      const diff = Math.abs(targetRatio - value);
      if (diff < minDiff) {
        minDiff = diff;
        closestRatio = ratio;
      }
    }

    finalAspectRatio = closestRatio;
    console.log(`📐 Mapped ${aspectRatio} to closest supported ratio: ${finalAspectRatio}`);
  }

  console.log('🔧 Luma Photon parameters:', {
    gravity,
    aspectRatio: finalAspectRatio,
    originalDimensions: `${imgWidth}x${imgHeight}`,
    targetDimensions: `${width}x${height}`,
    anchorCoords: `x:${x_start}-${x_end}, y:${y_start}-${y_end}`,
    imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'No image URL',
    seed
  });

  try {
    // Call Luma Photon Reframe API with anchor coordinates
    console.log('🔄 Calling Luma Photon Reframe API...');
    const result = await fal.subscribe("fal-ai/luma-photon/reframe", {
      input: {
        image_url: imageUrl,
        aspect_ratio: finalAspectRatio,
        x_start: Math.round(x_start),
        x_end: Math.round(x_end),
        y_start: Math.round(y_start),
        y_end: Math.round(y_end),
        ...(seed && { seed: parseInt(seed) })
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`🔄 Luma Status: ${update.status}`);
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(msg =>
            console.log(`📝 Luma Log: ${msg}`)
          );
        }
      }
    });

    console.log('✅ Luma Photon Reframe completed successfully:', {
      requestId: result.requestId,
      hasImages: !!result.data?.images?.length,
      imageCount: result.data?.images?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      requestId: result.requestId,
      model: 'luma-photon'
    });

  } catch (error) {
    console.error('❌ Luma Photon error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown Luma Photon error';

    return NextResponse.json({
      error: 'Luma Photon processing failed: ' + errorMessage,
      details: error instanceof Error ? error.stack : 'No additional details',
      model: 'luma-photon'
    }, { status: 500 });
  }
}

