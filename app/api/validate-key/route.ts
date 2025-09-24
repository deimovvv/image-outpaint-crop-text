import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({
        valid: false,
        error: 'API key is required'
      }, { status: 400 });
    }

    // Use default key if specified
    if (apiKey === 'default') {
      return NextResponse.json({
        valid: true,
        message: 'Using default API key'
      });
    }

    console.log('🔑 Validating API key:', apiKey.substring(0, 20) + '...');

    // Test the API key with a simple request (we'll make a fake call to check credentials)
    const testClient = fal.config({
      credentials: apiKey
    });

    // Try to make a simple request to validate the key
    // We'll use a lightweight endpoint just to test authentication
    try {
      // This is just to test if the key is valid format and works
      // We don't actually need the result, just want to see if it authenticates
      const response = await fetch('https://fal.run/fal-ai/fast-svd/image-to-video', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Minimal test payload just to check auth
          input: {
            image_url: 'test'
          }
        })
      });

      // If we get a 401 or 403, the key is invalid
      if (response.status === 401 || response.status === 403) {
        console.log('❌ API key validation failed: Unauthorized');
        return NextResponse.json({
          valid: false,
          error: 'Invalid API key'
        });
      }

      // Any other error (like 400 bad request) means the key is valid but request was malformed
      // This is what we expect since we're sending a test request
      console.log('✅ API key validation successful');
      return NextResponse.json({
        valid: true,
        message: 'API key is valid'
      });

    } catch (error) {
      console.error('Error during API key validation:', error);

      // If it's a network error or similar, we'll assume the key format is correct
      if (apiKey.includes(':') && apiKey.length > 40) {
        console.log('✅ API key format appears valid');
        return NextResponse.json({
          valid: true,
          message: 'API key format is valid'
        });
      }

      return NextResponse.json({
        valid: false,
        error: 'Invalid API key format'
      });
    }

  } catch (error) {
    console.error('❌ Key validation error:', error);
    return NextResponse.json({
      valid: false,
      error: 'Failed to validate API key'
    }, { status: 500 });
  }
}