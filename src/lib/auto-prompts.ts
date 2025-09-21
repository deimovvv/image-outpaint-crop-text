import { Gravity } from "./mask";

/**
 * Genera prompts automáticos optimizados según la dirección de expansión
 */
export function generateAutoPrompt(gravity: Gravity, targetRatio: number, originalRatio: number): string {
  const basePrompt = "extend background seamlessly, maintain exact colors and textures, natural continuation of environment, no new objects, no people, no text, no logos";

  // Si no hay expansión, usar prompt genérico
  if (Math.abs(targetRatio - originalRatio) < 0.01) {
    return "enhance image quality, maintain all details, improve clarity";
  }

  // Determinar dirección de expansión
  const isExpandingHorizontal = targetRatio > originalRatio;
  const isExpandingVertical = targetRatio < originalRatio;

  if (isExpandingHorizontal) {
    // Expandiendo horizontalmente
    switch (gravity) {
      case "left":
        return `extend background to the right, ${basePrompt}, continue existing patterns rightward`;
      case "right":
        return `extend background to the left, ${basePrompt}, continue existing patterns leftward`;
      case "center":
        return `extend background horizontally on both sides, ${basePrompt}, symmetric expansion`;
      case "top":
      case "bottom":
        return `extend background horizontally, ${basePrompt}, maintain vertical composition`;
      default:
        return `extend background horizontally, ${basePrompt}`;
    }
  } else if (isExpandingVertical) {
    // Expandiendo verticalmente
    switch (gravity) {
      case "top":
        return `extend background downward, ${basePrompt}, continue existing patterns below`;
      case "bottom":
        return `extend background upward, ${basePrompt}, continue existing patterns above`;
      case "center":
        return `extend background vertically on top and bottom, ${basePrompt}, symmetric expansion`;
      case "left":
      case "right":
        return `extend background vertically, ${basePrompt}, maintain horizontal composition`;
      default:
        return `extend background vertically, ${basePrompt}`;
    }
  }

  return basePrompt;
}

/**
 * Prompts predefinidos para casos específicos
 */
export const PRESET_PROMPTS = {
  natural: "extend the existing background naturally, maintain exact colors and textures, seamless continuation of current environment, no new objects, no people, no text, no logos",

  creative: "creatively expand the background while maintaining the original style, harmonious extension of the scene, artistic continuation, no new subjects or text",

  minimal: "extend background minimally, keep original focus, subtle expansion, maintain composition balance",

  architectural: "extend architectural elements and structures naturally, maintain perspective and lighting, continue building lines and patterns, no new buildings or structures",

  landscape: "extend natural landscape elements, continue terrain and vegetation patterns, maintain horizon line and lighting, seamless environmental expansion",

  portrait: "extend background behind subject, maintain portrait lighting and depth, blur background elements naturally, no new people or objects",

  product: "extend clean background around product, maintain studio lighting, neutral background expansion, keep product as main focus"
};

/**
 * Obtiene prompts sugeridos basados en el contexto
 */
export function getSuggestedPrompts(gravity: Gravity, targetRatio: number, originalRatio: number) {
  const autoPrompt = generateAutoPrompt(gravity, targetRatio, originalRatio);

  return {
    auto: autoPrompt,
    presets: PRESET_PROMPTS
  };
}