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
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({
        error: 'Missing required field: image'
      }, { status: 400 });
    }

    console.log('🖼️ Starting background removal with:', {
      fileName: imageFile.name,
      fileSize: `${Math.round(imageFile.size / 1024)}KB`,
      fileType: imageFile.type
    });

    // Upload image to FAL storage
    console.log('📤 Uploading image to FAL storage...');
    const imageUrl = await fal.storage.upload(imageFile);
    console.log('✅ Image uploaded:', imageUrl ? imageUrl.substring(0, 50) + '...' : 'No URL');

    // Call Bria Background Removal API
    console.log('🔄 Calling Bria Background Removal API...');
    const result = await fal.subscribe("fal-ai/bria/background/remove", {
      input: {
        image_url: imageUrl,
        sync_mode: true // Wait for image to be generated and uploaded
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`🔄 Background Removal Status: ${update.status}`);
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(msg =>
            console.log(`📝 Background Removal Log: ${msg}`)
          );
        }
      }
    });

    console.log('✅ Background removal completed successfully:', {
      requestId: result.requestId,
      hasImage: !!result.data?.image?.url,
      imageSize: 0
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      requestId: result.requestId,
      model: 'bria-background-removal'
    });

  } catch (error) {
    console.error('❌ Background Removal API Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown background removal error';

    return NextResponse.json({
      error: 'Background removal failed: ' + errorMessage,
      details: error instanceof Error ? error.stack : 'No additional details',
      model: 'bria-background-removal'
    }, { status: 500 });
  }
}