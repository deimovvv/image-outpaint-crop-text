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

    if (!prompt || !imageSize || !canvasImage) {
      return NextResponse.json({
        error: 'Missing required fields: prompt, image_size, canvas_image'
      }, { status: 400 });
    }

    console.log(`🤖 Starting ${aiModel} outpainting with:`, {
      prompt: prompt.substring(0, 100) + '...',
      imageSize,
      aiModel,
      hasBothImages: !!(canvasImage && originalImage)
    });

    // Parse image size (e.g., "1080x1350" -> {width: 1080, height: 1350})
    const [width, height] = imageSize.split('x').map(Number);
    if (!width || !height || width < 512 || height < 512 || width > 4096 || height > 4096) {
      return NextResponse.json({
        error: 'Invalid image_size. Must be WxH format, each dimension 512-4096'
      }, { status: 400 });
    }

    // Route to appropriate AI model
    if (aiModel === 'flux-fill') {
      return await processWithFluxFill(formData, prompt, width, height, canvasImage, originalImage, seed);
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
    prompt: prompt.substring(0, 50) + '...',
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
      imageUrl: imageUrl.substring(0, 50) + '...',
      maskUrl: maskUrl.substring(0, 50) + '...'
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