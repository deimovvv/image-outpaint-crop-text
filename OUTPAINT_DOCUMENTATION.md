# Documentación del Sistema de Outpainting

## Resumen General

El sistema de outpainting permite expandir imágenes utilizando modelos de IA para crear contenido adicional de forma natural y coherente. La aplicación soporta **3 modelos principales**: **Seedream**, **FLUX Fill**, y **Luma Photon**, cada uno con características y casos de uso específicos.

## Arquitectura del Sistema

### Componentes Principales

1. **Interfaz de Usuario** (`app/components/Outpaint.tsx`)
2. **API Unificada** (`app/api/outpaint/route.ts`)
3. **Utilidades de Canvas** (`src/lib/seedream-canvas.ts`)
4. **Generación de Prompts** (`src/lib/auto-prompts.ts`)

## Modelos de IA Disponibles

### 1. Seedream (Modelo por Defecto)
- **Color de Identificación**: Naranja (#FF6B35)
- **Especialidad**: Expansión creativa y natural
- **Fortalezas**: Mezcla orgánica, contexto inteligente
- **Modelo API**: `fal-ai/bytedance/seedream/v4/edit`

### 2. FLUX Fill
- **Color de Identificación**: Verde (#4CAF50)
- **Especialidad**: Outpainting preciso basado en máscaras
- **Fortalezas**: Control exacto, preservación perfecta del contenido original
- **Modelo API**: `fal-ai/flux-pro/v1/fill`

### 3. Luma Photon
- **Color de Identificación**: Morado (#9C27B0)
- **Especialidad**: Reencuadre inteligente con control de aspecto
- **Fortalezas**: Recomposición automática, no requiere prompts
- **Modelo API**: `fal-ai/luma-photon/reframe`

## Funcionamiento de la Interfaz

### Controles Principales

1. **Selección de Archivo**: Soporte para múltiples imágenes (batch processing)
2. **Navegación de Imágenes**: Grid de miniaturas para alternar entre imágenes
3. **Configuración de Ratio**: Ratios preestablecidos (1:1, 4:5, 3:4, 9:16, 16:9)
4. **Gravity**: Posicionamiento de la imagen original (left, center, right, top, bottom)
5. **Selección de Modelo**: Botones con códigos de color para cada modelo IA
6. **Sistema de Prompts**: Automático/manual (no disponible para Luma Photon)

### Vista Previa
- **Preview en Tiempo Real**: Se actualiza automáticamente al cambiar configuraciones
- **Indicadores Visuales**: Áreas de expansión marcadas con líneas verdes punteadas
- **Información de Progreso**: Barra de progreso durante procesamiento batch

## Input de Cada Modelo

### Seedream
```typescript
Input Required:
- canvas_image: Canvas expandido con la imagen original posicionada según gravity
- original_image: Imagen original como referencia (opcional)
- prompt: Descripción textual del resultado deseado
- image_size: Dimensiones finales (formato "1024x1280")
- seed: Semilla para reproducibilidad

Canvas Generation:
- Fondo neutro (#f8f8f8)
- Imagen original escalada y posicionada según gravity
- Hints sutiles de color en bordes para contexto (30% de opacidad)
- Sin pre-sembrado pesado para permitir creatividad del modelo
```

### FLUX Fill
```typescript
Input Required:
- canvas_image: Imagen base con fondo neutro y original posicionada
- mask_image: Máscara binaria (negro=preservar, blanco=expandir)
- original_image: Imagen original
- prompt: Descripción del resultado deseado
- image_size: Dimensiones finales
- seed: Semilla para reproducibilidad

Canvas Generation:
- Fondo gris claro uniforme (#C0C0C0)
- Imagen original con anti-aliasing de alta calidad
- Máscara correspondiente con feathering de 4px para transiciones suaves
- Dimensiones exactas entre imagen base y máscara (CRÍTICO)
```

### Luma Photon
```typescript
Input Required:
- original_image: Solo la imagen original
- gravity: Posición de anclaje
- original_width/original_height: Dimensiones originales
- image_size: Dimensiones objetivo
- aspect_ratio: Ratio mapeado a formatos soportados
- x_start, x_end, y_start, y_end: Coordenadas de anclaje calculadas
- seed: Semilla para reproducibilidad

NO requiere:
- Canvas expandido
- Máscaras
- Prompts (reencuadre automático)
```

## Flujo de Procesamiento

### 1. Preparación de Input
```typescript
// Para cada imagen seleccionada:
if (aiModel === "luma-photon") {
  // Solo enviar imagen original + parámetros de anclaje
  form.append("original_image", file);
  form.append("gravity", gravity);
  form.append("original_width", String(img.naturalWidth));
  form.append("original_height", String(img.naturalHeight));
} else if (aiModel === "flux-fill") {
  // Generar imagen base + máscara
  const fluxResult = buildFluxBaseImage(img, ratio, gravity);
  form.append("canvas_image", await dataUrlToBlob(fluxResult.baseImageDataUrl));
  form.append("mask_image", await dataUrlToBlob(fluxResult.maskDataUrl));
  form.append("prompt", currentPrompt);
} else { // seedream
  // Generar canvas con contexto
  const seedreamResult = buildSeedreamCanvas(img, ratio, gravity);
  form.append("canvas_image", await dataUrlToBlob(seedreamResult.canvasDataUrl));
  form.append("prompt", currentPrompt);
}
```

### 2. Envío a API
```typescript
const res = await fetch("/api/outpaint", {
  method: "POST",
  body: form
});
```

### 3. Procesamiento en Servidor
```typescript
// Routing basado en modelo
if (aiModel === 'flux-fill') {
  return await processWithFluxFill(formData, prompt, width, height, canvasImage, originalImage, seed);
} else if (aiModel === 'luma-photon') {
  return await processWithLumaPhoton(formData, prompt, width, height, canvasImage, originalImage, seed);
} else { // seedream
  return await processWithSeedream(formData, prompt, width, height, canvasImage, originalImage, seed);
}
```

### 4. Post-procesamiento
```typescript
// Solo para Seedream con estrategia protectora
if (aiModel === "seedream" && maskStrategy === "ai_subject") {
  const protectedResult = protectiveRecomposition(
    seedreamImg,
    img,
    originalImageInfo,
    16 // feather size
  );
}
```

## Detalles Técnicos por Modelo

### Seedream
**Fortalezas:**
- Creatividad natural en la expansión
- Manejo inteligente de contexto ambiental
- Prompts flexibles y descriptivos

**Limitaciones:**
- Puede alterar ligeramente la imagen original
- Requiere recomposición protectora para preservación exacta
- Límites de dimensión: 512x512 mínimo, 1800x1800 máximo

**Configuración Óptima:**
```typescript
const result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
  input: {
    prompt: "Expand the background naturally. Continue the existing environment seamlessly.",
    image_size: { width, height },
    image_urls: [canvasUrl, originalUrl], // Canvas + referencia
    num_images: 1,
    enable_safety_checker: true,
    seed: parseInt(seed)
  }
});
```

### FLUX Fill
**Fortalezas:**
- Preservación perfecta del contenido original (100%)
- Control preciso mediante máscaras
- Calidad consistente en bordes

**Limitaciones:**
- Menos creatividad natural
- Requiere generación precisa de máscaras
- Procesamiento más técnico

**Configuración Óptima:**
```typescript
const result = await fal.subscribe("fal-ai/flux-pro/v1/fill", {
  input: {
    prompt: "extend background naturally, maintain exact colors and textures",
    image_url: baseImageUrl,
    mask_url: maskUrl,
    num_images: 1,
    enable_safety_checker: true,
    seed: parseInt(seed)
  }
});
```

### Luma Photon
**Fortalezas:**
- Reencuadre completamente automático
- Preservación total del contenido original
- No requiere prompts ni configuración compleja

**Limitaciones:**
- Limitado a ratios predefinidos
- Menos control creativo
- No puede expandir más allá de ciertos límites

**Configuración Óptima:**
```typescript
const result = await fal.subscribe("fal-ai/luma-photon/reframe", {
  input: {
    image_url: originalImageUrl,
    aspect_ratio: "16:9", // Mapeado automáticamente
    x_start: Math.round(x_start),
    x_end: Math.round(x_end),
    y_start: Math.round(y_start),
    y_end: Math.round(y_end),
    seed: parseInt(seed)
  }
});
```

## Sistema de Prompts

### Prompts Automáticos
```typescript
// Generación basada en gravity y dirección de expansión
const direction = getExpandDirection(gravity, targetRatio, origRatio);
const autoPrompt = `Expand the background ${direction} naturally. Continue the existing environment seamlessly. Keep the same lighting, colors and perspective.`;
```

### Prompts Preestablecidos
- **Natural**: Expansión orgánica del ambiente
- **Architectural**: Para edificios y estructuras
- **Landscape**: Para paisajes y exteriores

### Prompts Personalizados
Los usuarios pueden escribir prompts específicos desactivando el modo automático.

## Configuraciones Avanzadas

### Gravity (Posicionamiento)
- **Center**: Expansión simétrica en todas las direcciones
- **Left**: Imagen anclada a la izquierda, expansión hacia la derecha
- **Right**: Imagen anclada a la derecha, expansión hacia la izquierda
- **Top**: Imagen anclada arriba, expansión hacia abajo
- **Bottom**: Imagen anclada abajo, expansión hacia arriba

### Dimensiones y Límites
```typescript
// Validación de dimensiones
if (aiModel === 'luma-photon') {
  // Sin límites estrictos, solo dimensiones positivas
  if (!width || !height || width < 1 || height < 1) {
    return error;
  }
} else {
  // Seedream y FLUX: límites estrictos
  if (width < 512 || height < 512 || width > 4096 || height > 4096) {
    return error;
  }
}
```

### Batch Processing
- Procesamiento secuencial de múltiples imágenes
- Barra de progreso en tiempo real
- Manejo de errores individual por imagen
- Resultados consolidados en grid de resultados

## Casos de Uso Recomendados

### Seedream
- **Fotografías de personas**: Expansión natural de fondos
- **Paisajes**: Continuación de ambientes naturales
- **Arte conceptual**: Creatividad y interpretación artística

### FLUX Fill
- **Fotografía de productos**: Preservación exacta del producto
- **Arquitectura**: Expansión precisa de edificios
- **Documentos**: Cuando la preservación exacta es crítica

### Luma Photon
- **Reencuadre rápido**: Cambios de ratio sin pérdida de calidad
- **Contenido para redes sociales**: Adaptación automática a formatos
- **Procesamiento masivo**: Cuando no se requieren prompts personalizados

## Optimizaciones y Mejores Prácticas

### Performance
- Canvas con dimensiones múltiplos de 8 para mejor procesamiento IA
- Calidad de imagen máxima (1.0) para resultados óptimos
- Gestión de memoria con cleanup de URLs temporales

### Calidad de Resultados
- **Feathering suave** (4px) en máscaras para transiciones naturales
- **Anti-aliasing** de alta calidad en todos los canvas
- **Colores de contexto** extraídos de bordes originales

### Gestión de Errores
- Validación exhaustiva de inputs por modelo
- Logging detallado para debugging
- Fallbacks y manejo de casos edge
- Feedback claro al usuario sobre errores específicos

## Monitoreo y Logging

El sistema incluye logging comprehensivo:

```typescript
console.log(`🤖 Starting ${aiModel} outpainting with:`, {
  prompt: prompt ? prompt.substring(0, 100) + '...' : 'No prompt',
  imageSize,
  aiModel,
  hasOriginalImage: !!originalImage,
  hasCanvasImage: !!canvasImage
});
```

Esto permite tracking completo del flujo de procesamiento y debugging eficiente de issues.