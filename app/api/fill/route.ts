import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Verificar que la API key esté configurada
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    // Configurar las credenciales de FAL
    fal.config({
      credentials: process.env.FAL_KEY
    });

    // Obtener datos del formulario
    const form = await req.formData();
    const prompt = String(form.get("prompt") || "");
    const guidance_scale = Number(form.get("guidance") || 3.5);
    const image = form.get("image");
    const mask = form.get("mask");

    if (!(image instanceof File) || !(mask instanceof File)) {
      return NextResponse.json(
        { error: "Both image and mask files are required" },
        { status: 400 }
      );
    }

    // Validar archivos antes de subir
    console.log("Image file:", image.name, image.size, "bytes");
    console.log("Mask file:", mask.name, mask.size, "bytes");

    // Subir archivos al storage de FAL
    console.log("Uploading files to FAL storage...");
    const imageUrl = await fal.storage.upload(image);
    const maskUrl = await fal.storage.upload(mask);

    console.log("Image URL:", imageUrl);
    console.log("Mask URL:", maskUrl);

    // Llamar a la API de FAL siguiendo la documentación oficial
    const result = await fal.subscribe("fal-ai/flux-pro/v1/fill", {
      input: {
        prompt,
        image_url: imageUrl,
        mask_url: maskUrl,
        guidance_scale,
        num_images: 1,
        output_format: "jpeg",
        safety_tolerance: "2"
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      },
    });

    console.log("FAL Result:", result);

    return NextResponse.json({
      data: result.data,
      requestId: result.requestId
    });

  } catch (e: unknown) {
    console.error("FAL API Error:", e);

    // Intentar extraer más detalles del error
    if (e && typeof e === 'object' && 'body' in e) {
      console.error("Error body:", e.body);
    }

    if (e instanceof Error) {
      console.error("Error message:", e.message);
      console.error("Error stack:", e.stack);

      // Manejar errores específicos de autenticación
      if (e.message.includes("Unauthorized") || e.message.includes("401")) {
        return NextResponse.json(
          { error: "FAL API key is invalid. Please check your FAL_KEY environment variable." },
          { status: 401 }
        );
      }

      // Error 500 del servidor de FAL
      if (e.message.includes("Internal Server Error") || e.message.includes("500")) {
        return NextResponse.json(
          {
            error: "FAL server error. This might be due to image format, size, or temporary server issues.",
            details: e.message,
            suggestion: "Try with a different image or check if image and mask have the same dimensions."
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: e.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Unknown error occurred" },
      { status: 500 }
    );
  }
}