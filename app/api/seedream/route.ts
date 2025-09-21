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

    if (!prompt || !imageSize || !canvasImage) {
      return NextResponse.json({
        error: 'Missing required fields: prompt, image_size, canvas_image'
      }, { status: 400 });
    }

    console.log('🌱 Starting Seedream expansion with:', {
      prompt: prompt.substring(0, 100) + '...',
      imageSize,
      hasBothImages: !!(canvasImage && originalImage)
    });

    // Parse image size (e.g., "1080x1350" -> {width: 1080, height: 1350})
    const [width, height] = imageSize.split('x').map(Number);
    if (!width || !height || width < 512 || height < 512 || width > 4096 || height > 4096) {
      return NextResponse.json({
        error: 'Invalid image_size. Must be WxH format, each dimension 512-4096'
      }, { status: 400 });
    }

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
      requestId: result.requestId
    });

  } catch (error) {
    console.error('❌ Seedream API Error:', error);
    return NextResponse.json({
      error: 'Seedream processing failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}