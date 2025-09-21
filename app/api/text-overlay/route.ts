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
    const mainTitle = formData.get('main_title') as string;
    const subtitle = formData.get('subtitle') as string;
    const callToAction = formData.get('call_to_action') as string;
    const backgroundStyle = formData.get('background_style') as string;
    const mainTitlePosition = formData.get('main_title_position') as string || 'top';
    const subtitlePosition = formData.get('subtitle_position') as string || 'center';
    const callToActionPosition = formData.get('call_to_action_position') as string || 'bottom';
    const logoPosition = formData.get('logo_position') as string || 'top-left';
    const typography = formData.get('typography') as string || 'modern-sans';
    const logoFile = formData.get('logo_file') as File | null;
    const baseImageFile = formData.get('base_image') as File | null;

    if (!prompt || !imageSize) {
      return NextResponse.json({
        error: 'Missing required fields: prompt, image_size'
      }, { status: 400 });
    }

    console.log('📝 Starting Text Overlay generation with:', {
      prompt: prompt.substring(0, 100) + '...',
      imageSize,
      mainTitle: mainTitle || '(empty)',
      subtitle: subtitle || '(empty)',
      callToAction: callToAction || '(empty)',
      backgroundStyle,
      hasLogo: !!logoFile,
      hasBaseImage: !!baseImageFile
    });

    // Parse image size
    const [width, height] = imageSize.split('x').map(Number);
    if (!width || !height || width < 512 || height < 512 || width > 4096 || height > 4096) {
      return NextResponse.json({
        error: 'Invalid image_size. Must be WxH format, each dimension 512-4096'
      }, { status: 400 });
    }

    // Prepare image URLs for Seedream
    const imageUrls: string[] = [];

    // Upload base image or generate canvas
    if (baseImageFile) {
      console.log('📤 Uploading user base image...');
      const baseImageUrl = await fal.storage.upload(baseImageFile);
      imageUrls.push(baseImageUrl);
      console.log('✅ Base image uploaded:', baseImageUrl.substring(0, 50) + '...');
    } else {
      // Generate a simple canvas
      console.log('📤 Generating simple canvas...');
      const simpleCanvas = await generateSimpleCanvas(width, height, backgroundStyle);
      const canvasUrl = await fal.storage.upload(simpleCanvas);
      imageUrls.push(canvasUrl);
      console.log('✅ Generated canvas uploaded:', canvasUrl.substring(0, 50) + '...');
    }

    // Upload logo separately if provided
    if (logoFile) {
      console.log('🏷️ Uploading logo...');
      const logoUrl = await fal.storage.upload(logoFile);
      imageUrls.push(logoUrl);
      console.log('✅ Logo uploaded:', logoUrl.substring(0, 50) + '...');
    }

    // Build enhanced prompt for text overlay
    let enhancedPrompt = buildTextOverlayPrompt(
      mainTitle,
      subtitle,
      callToAction,
      backgroundStyle,
      !!logoFile,
      !!baseImageFile,
      mainTitlePosition,
      subtitlePosition,
      callToActionPosition,
      logoPosition,
      typography
    );

    console.log('🔄 Calling Seedream API for text overlay...');
    const result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
      input: {
        prompt: enhancedPrompt,
        image_size: {
          width,
          height
        },
        image_urls: imageUrls,
        num_images: 1,
        max_images: 1,
        enable_safety_checker: true,
        seed: Math.floor(Math.random() * 1000000)
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      }
    });

    console.log('✅ Text Overlay generated successfully');

    return NextResponse.json({
      success: true,
      data: result.data,
      requestId: result.requestId,
      model: 'seedream-text-overlay'
    });

  } catch (error) {
    console.error('❌ Text Overlay API Error:', error);
    return NextResponse.json({
      error: 'Text overlay generation failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

/**
 * Generates a simple canvas with optional logo that Seedream can process
 */
async function generateCanvasWithLogo(
  width: number,
  height: number,
  backgroundStyle: string,
  logoFile: File | null
): Promise<File> {
  if (!logoFile) {
    // Create a simple 1x1 pixel PNG if no logo
    const singlePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hc52GQAAAABJRU5ErkJggg==';
    const response = await fetch(singlePixelPng);
    const blob = await response.blob();
    return new File([blob], 'simple-canvas.png', { type: 'image/png' });
  }

  // For now, if logo is provided, we'll pass the logo as the base
  // In a more advanced implementation, we'd composite it with a background
  return logoFile;
}

/**
 * Integrates logo with base image using simple positioning
 */
async function integrateLogoWithImage(
  baseImage: File,
  logoFile: File,
  width: number,
  height: number
): Promise<File> {
  // For server-side, we'll use a simple approach
  // In production, you'd use a proper image processing library like Sharp or node-canvas

  // For now, we'll return the base image and mention the logo in the prompt
  // The AI will understand to integrate both elements
  console.log('🔄 Logo integration: Using base image with logo mention in prompt');
  return baseImage;
}

/**
 * Builds an enhanced prompt specifically for text overlay generation
 */
function buildTextOverlayPrompt(
  mainTitle: string,
  subtitle: string,
  callToAction: string,
  backgroundStyle: string,
  hasLogo: boolean,
  hasBaseImage: boolean = false,
  mainTitlePosition: string = 'top',
  subtitlePosition: string = 'center',
  callToActionPosition: string = 'bottom',
  logoPosition: string = 'top-left',
  typography: string = 'modern-sans'
): string {
  let prompt = "";

  if (hasBaseImage) {
    prompt = "Add professional text overlay to the existing image. Maintain the original image while adding modern typography and text elements. ";
  } else {
    prompt = "Create a professional social media design with modern typography and clean layout. ";
  }

  // Background style (only if no base image)
  if (!hasBaseImage) {
    if (backgroundStyle === 'gradient') {
      prompt += "Beautiful gradient background with subtle colors. ";
    } else if (backgroundStyle === 'solid') {
      prompt += "Clean solid color background, modern and minimal. ";
    } else {
      prompt += "Minimal white or light background, very clean and professional. ";
    }
  }

  // Text content with positioning
  if (mainTitle) {
    const positionText = mainTitlePosition === 'top' ? 'at the top area' :
                         mainTitlePosition === 'center' ? 'in the center area' : 'at the bottom area';
    prompt += `Bold, eye-catching main headline with "${mainTitle}" positioned ${positionText}. Large, readable typography. `;
  }

  if (subtitle) {
    const positionText = subtitlePosition === 'top' ? 'at the top area' :
                         subtitlePosition === 'center' ? 'in the center area' : 'at the bottom area';
    prompt += `Supporting subtitle text "${subtitle}" positioned ${positionText}. Medium size, complementary font. `;
  }

  if (callToAction) {
    const positionText = callToActionPosition === 'top' ? 'at the top area' :
                         callToActionPosition === 'center' ? 'in the center area' : 'at the bottom area';
    prompt += `Call-to-action button or text "${callToAction}" positioned ${positionText}. Prominent, actionable design. `;
  }

  // Typography specification
  let typographyPrompt = "";
  switch (typography) {
    case 'helvetica':
      typographyPrompt = "Use Helvetica or similar classic sans-serif fonts. Clean, professional, timeless typography. ";
      break;
    case 'playfair':
      typographyPrompt = "Use elegant serif fonts like Playfair Display. Sophisticated, editorial-style typography with high contrast. ";
      break;
    case 'modern-sans':
    default:
      typographyPrompt = "Use modern sans-serif fonts. Clean, contemporary typography with good readability. ";
      break;
  }
  prompt += typographyPrompt;

  // Design requirements
  prompt += "High contrast text for readability. ";
  prompt += "Professional layout with proper spacing and hierarchy. ";
  prompt += "Social media ready design, optimized for engagement. ";

  if (hasLogo) {
    const logoPositionText = logoPosition === 'top-left' ? 'in the top-left corner' :
                            logoPosition === 'top-right' ? 'in the top-right corner' :
                            logoPosition === 'bottom-left' ? 'in the bottom-left corner' : 'in the bottom-right corner';

    if (hasBaseImage) {
      prompt += `Integrate the existing logo seamlessly with the image. Position the logo ${logoPositionText} for brand visibility. `;
    } else {
      prompt += `Include the logo prominently in the design. Position the logo ${logoPositionText}. Make it part of the overall composition. `;
    }
  }

  // Quality modifiers
  prompt += "Clean, minimal, professional design. High-quality graphics. Modern aesthetic. ";
  prompt += "Perfect for social media marketing and brand promotion.";

  console.log('📝 Generated text overlay prompt:', prompt.substring(0, 200) + '...');

  return prompt;
}

/**
 * Generates a simple canvas background for text overlay
 */
async function generateSimpleCanvas(width: number, height: number, backgroundStyle: string): Promise<File> {
  // Create a simple 1x1 pixel PNG that Seedream can work with
  // We'll use a data URL approach for server-side compatibility

  let color: string;
  switch (backgroundStyle) {
    case 'gradient':
      color = 'f0f9ff'; // Light blue
      break;
    case 'solid':
      color = 'f8fafc'; // Light gray
      break;
    case 'minimal':
    default:
      color = 'ffffff'; // White
      break;
  }

  // Create a minimal 1x1 PNG data URL
  // This is a base64 encoded 1x1 white pixel PNG
  const singlePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hc52GQAAAABJRU5ErkJggg==';

  try {
    const response = await fetch(singlePixelPng);
    const blob = await response.blob();
    return new File([blob], 'simple-canvas.png', { type: 'image/png' });
  } catch (error) {
    console.error('Error creating simple canvas:', error);
    throw new Error('Failed to create simple canvas');
  }
}