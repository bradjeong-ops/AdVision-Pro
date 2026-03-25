
import { GoogleGenAI } from "@google/genai";
import { Language, ProductionGuide } from '../types';

export interface CategorizedProduct {
  category: string;
  mains: {
    front: string | null;
    side: string | null;
    back: string | null;
    face?: string | null;
  };
  details: string[];
  items: string[];
}

export type AllowedAspectRatio = "9:16" | "16:9" | "3:4" | "1:1";
export type ImageQuality = "1K" | "2K" | "4K";
export type ModelViewType = 'front' | 'side' | 'back' | 'item';

const V30_MASTER_PROTOCOL = `
[CRITICAL INSTRUCTIONS FOR SUBJECT REPLACEMENT - V3.8 MASTER]
1. COMPOSITION & FRAMING FIDELITY (STRICT):
   - The [Base Image] is your ABSOLUTE template for framing. You MUST maintain the EXACT cropping, camera distance, and scale of the subjects.
   - If a subject is partially cropped in the [Base Image], they MUST be partially cropped in the same way in the generated image.
   - DO NOT zoom out or change the perspective. The spatial relationship between the camera and the subjects must be a 1:1 match.
2. IDENTITY OVERWRITE (STRICT): 
   - The face in the [Base Image] is ONLY a guide for expression and angle. You MUST COMPLETELY OVERWRITE it with the facial features, bone structure, skin tone, and unique identity of the [Subject Reference] or [Face Detail Reference].
   - DO NOT use the face from the [Base Image]. The generated subject MUST be the person from your uploaded model library.
3. GARMENT REPLACEMENT (STRICT):
   - Replace 100% of the clothing. Use the exact style, color, fabric, and branding from the [Subject Reference] and [Garment Detail Reference].
   - NO INHERITANCE: Do not carry over any clothing items, colors, or patterns from the [Base Image].
4. EXPRESSION & POSE TRANSFER:
   - TRANSFER EMOTION: Copy the EXACT facial expression (smile, laughter, intensity, mouth shape) from the [Base Image] and apply it to the NEW identity.
   - POSE FIDELITY: Maintain the EXACT body pose, limb positions, and head angle from the [Base Image].
5. SEAMLESS INTEGRATION:
   - Perform high-precision regional rendering for the face and hands to ensure the new identity is sharp and artifact-free.
   - Integrate the new subject perfectly into the [Base Image]'s lighting (highlights, shadows, rim light).
6. PHOTOREALISM: Render with ultra-high photorealistic quality (8K equivalent), matching high-end professional advertising photography.
`;

const getBase64Data = (url: string) => url.split(',')[1];

const generateSafeSeed = () => Math.floor(Math.random() * 2147483647);

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const errorMessage = e.message || String(e);
      const isRetryable = 
        errorMessage.includes('503') || 
        errorMessage.includes('UNAVAILABLE') || 
        errorMessage.includes('429') || 
        errorMessage.includes('Deadline') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('expired');
      
      if (!isRetryable) throw e;
      
      const delay = initialDelay * Math.pow(2, i);
      console.warn(`Gemini API call failed (attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`, errorMessage);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const parseJSON = (str: string) => {
  let cleaned = str.trim();
  
  // Find the first '{'
  const startIdx = cleaned.indexOf('{');
  if (startIdx === -1) {
    throw new Error("No JSON object found in response");
  }

  // Try to find the largest valid JSON object starting from the first '{'
  // We search backwards from the last '}' to handle potential trailing characters or extra braces
  for (let i = cleaned.lastIndexOf('}'); i > startIdx; i = cleaned.lastIndexOf('}', i - 1)) {
    const candidate = cleaned.substring(startIdx, i + 1);
    
    // Pre-process candidate to handle common issues like comments and trailing commas
    let processed = candidate.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    processed = processed.replace(/,\s*([}\]])/g, '$1');
    
    try {
      return JSON.parse(processed);
    } catch (e) {
      // Not a valid JSON object yet, keep looking backwards
    }
  }
  
  // Fallback: if no balanced object found, try parsing the whole thing after basic cleanup
  try {
    let finalAttempt = cleaned.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    finalAttempt = finalAttempt.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(finalAttempt);
  } catch (e) {
    console.error("JSON Parse Error on string:", cleaned);
    throw e;
  }
};

const getApiKey = () => {
  const customKey = localStorage.getItem('custom_gemini_api_key');
  if (customKey) return customKey;
  // Use GEMINI_API_KEY for free tier models, API_KEY for user-selected paid models
  return process.env.GEMINI_API_KEY || process.env.API_KEY;
};

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    // Try a very simple content generation to verify the key
    await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: 'ok' }] }],
    }));
    return true;
  } catch (e) {
    console.error("API Key Validation Error:", e);
    return false;
  }
};

export const classifyModelView = async (base64Image: string, mimeType: string = 'image/png'): Promise<ModelViewType | null> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `Classify this fashion image: front, side, back, or item. Output only one word.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: getBase64Data(base64Image), mimeType } },
          { text: prompt }
        ]
      }
    }));
    const result = response.text?.trim().toLowerCase();
    if (['front', 'side', 'back', 'item'].includes(result || '')) return result as ModelViewType;
    return null;
  } catch (e) {
    return null;
  }
};

export interface SubjectMap {
  id: string;
  description: string;
  assignedModelId: string | null; // 'id1', 'id2', 'id3', 'id4'
}

export const analyzeReferenceImage = async (base64Image: string, mimeType: string = 'image/png', lang: Language = 'en'): Promise<ProductionGuide> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다. 상단 'Key' 버튼을 통해 API 키를 먼저 설정해주세요.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const languageInstruction = lang === 'ko' 
    ? "모든 분석 결과는 한국어로 작성하세요. 전문적인 사진 용어는 유지하되 설명은 친절하게 한국어로 제공하십시오." 
    : "Provide the analysis in English.";

  const prompt = `Analyze this reference image with the eye of a high-end fashion curator and professional commercial photographer. 
  Your goal is to capture the precise aesthetic and technical essence of the image with extreme detail.

  ${languageInstruction} Follow this exact structured format for each field in a JSON response.

  JSON Keys and required content:
  - "coreProduction": Describe the Theme, Style, Overall Concept, and Subject Focus. IMPORTANT: You MUST include detailed descriptions of the subjects' actions, poses, and physical interactions.
  - "cameraComposition": Describe the Camera Angle, Focal Length, Aperture, Exposure & ISO, Perspective, Framing & Composition.
  - "setBackground": Describe the Set Design, Floor Materials, Props, Backdrop, and Compositional Elements. CRITICAL: Do NOT mention or describe the subjects' clothing, outfits, or garments in this section. Focus strictly on the environment and props.
  - "lightingMood": Describe the Lighting Direction, Highlights, Shadows, Mood, Atmosphere, and Color Palette.
  - "textureTechnical": Describe the Material Texture, Surface Details, Fabric/Skin Pores, Film Grain, Chromatic Aberration, and Technical Quality.
  - "subjects": An array of objects representing the people/subjects in the image. Each object should have "id" (e.g., "subject_1") and "description" (e.g., "왼쪽의 빨간 자켓을 입은 사람").

  CRITICAL INSTRUCTIONS:
  - SUBJECT DETECTION: Identify all distinct people in the image. For each person, provide a clear, concise description of their position and key identifying feature. IMPORTANT: The "description" for subjects MUST ALWAYS be in Korean, even if other fields are in English.
  - PRODUCT ABSTRACTION: If the image features a product rather than a person, refer to it generically as ${lang === 'ko' ? '"메인 제품"' : '"the main product"'}.
  - NO HALLUCINATION: Analyze ONLY what is visible.

  Ensure the output is a valid JSON object with keys: "coreProduction", "cameraComposition", "setBackground", "lightingMood", "textureTechnical", "subjects".`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        responseMimeType: 'application/json'
      },
      contents: {
        parts: [
          { inlineData: { data: getBase64Data(base64Image), mimeType } },
          { text: prompt }
        ]
      }
    }));
    const result = parseJSON(response.text || "{}");
    
    // Resilient subject mapping
    const rawSubjects = result.subjects;
    let subjects = [];
    if (Array.isArray(rawSubjects)) {
      subjects = rawSubjects.map((s: any) => ({ ...s, assignedModelId: null }));
    } else if (typeof rawSubjects === 'string' && rawSubjects.trim()) {
      // Fallback if model returns a single string instead of an array
      subjects = [{ id: 'subject_1', description: rawSubjects, assignedModelId: null }];
    }

    return {
      coreProduction: result.coreProduction || "Analysis failed",
      cameraComposition: result.cameraComposition || "Analysis failed",
      setBackground: result.setBackground || "Analysis failed",
      lightingMood: result.lightingMood || "Analysis failed",
      textureTechnical: result.textureTechnical || "Analysis failed",
      subjects
    };
  } catch (e: any) {
    console.error("Analysis Error:", e);
    throw new Error(`이미지 분석 실패: ${e.message || "알 수 없는 오류"}`);
  }
};

export const translateProductionGuide = async (guide: ProductionGuide, targetLang: Language): Promise<ProductionGuide> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const instruction = targetLang === 'ko'
    ? "Translate the following JSON values to Korean. Keep professional photography terms intact but provide friendly Korean explanations. IMPORTANT: The 'subjects' descriptions must remain in Korean."
    : "Translate the following JSON values to English. Ensure highly descriptive, professional photography terminology. IMPORTANT: The 'subjects' descriptions MUST REMAIN IN KOREAN and should not be translated to English.";

  const prompt = `${instruction}
  
  JSON to translate:
  ${JSON.stringify(guide, null, 2)}
  
  Ensure the output is a valid JSON object with the exact same keys: "coreProduction", "cameraComposition", "setBackground", "lightingMood", "textureTechnical", "subjects".`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        responseMimeType: 'application/json'
      },
      contents: [{ parts: [{ text: prompt }] }]
    }));
    const result = parseJSON(response.text || "{}");
    return {
      coreProduction: result.coreProduction || guide.coreProduction,
      cameraComposition: result.cameraComposition || guide.cameraComposition,
      setBackground: result.setBackground || guide.setBackground,
      lightingMood: result.lightingMood || guide.lightingMood,
      textureTechnical: result.textureTechnical || guide.textureTechnical,
      subjects: result.subjects || guide.subjects
    };
  } catch (e: any) {
    console.error("Translation Error:", e);
    return guide; // Fallback to original if translation fails
  }
};

export const generateProductEdit = async (
  base64Original: string | null,
  categories: CategorizedProduct[],
  instruction: string,
  aspectRatio: AllowedAspectRatio = "9:16",
  quality: ImageQuality = "2K",
  count: number = 1,
  mimeType: string = 'image/png',
  isProGroup: boolean = false,
  subjectMapping?: SubjectMap[]
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const singleTask = async (index: number) => {
    const parts: any[] = [];
    
    if (base64Original) {
      parts.push({ text: "[Base Image]: This is the foundational image. You MUST preserve the EXACT layout, composition, background, and overall structure of this image. If there is a person, preserve their pose and skeleton. If there is a main product, preserve its placement and scale." });
      parts.push({ inlineData: { data: getBase64Data(base64Original), mimeType } });
      parts.push({ text: "Now, using the [Base Image] as your strict template, replace the subjects using the following references and mapping:" });
    } else {
      parts.push({ text: "Generate a photorealistic image of the EXACT subject (person or product) shown in the [Subject Reference] images." });
    }

    // Add mapping instructions if available
    if (subjectMapping && subjectMapping.length > 0) {
      const mappingText = subjectMapping
        .filter(m => m.assignedModelId)
        .map(m => `- Map [Subject Reference: ${m.assignedModelId?.toUpperCase()}] to the person described as "${m.description}" in the [Base Image].`)
        .join('\n');
      if (mappingText) {
        parts.push({ text: `[SUBJECT MAPPING INSTRUCTIONS]:\n${mappingText}\nEnsure each assigned model is projected onto the correct person in the base image.` });
      }
    }

    categories.forEach((cat) => {
      const catUpper = cat.category.toUpperCase();
      
      // Handle items (Product/Prop section)
      if (cat.items && cat.items.length > 0) {
        cat.items.forEach((item, idx) => {
          const label = cat.category === 'other' ? 'Product/Prop' : 'Reference';
          parts.push({ text: `[${label} Reference: ${catUpper} ${idx}]: Use this image to accurately represent the product's appearance, details, and branding. If this is a standalone product, do NOT imagine a person holding it unless explicitly requested.` });
          parts.push({ inlineData: { data: getBase64Data(item), mimeType } });
        });
      }

      // Handle mains (Model section)
      ['front', 'side', 'back', 'face'].forEach(view => {
        const data = cat.mains[view as keyof typeof cat.mains];
        if (data) {
          const partName = view === 'face' ? `[Face Detail Reference: ${catUpper}]` : `[Subject Reference: ${catUpper} ${view.toUpperCase()}]`;
          const description = view === 'face' ? `Use this image to perfectly match the person's face and identity.` : `Use this image to match the person's body, identity, and clothing.`;
          parts.push({ text: `${partName}: ${description}` });
          parts.push({ inlineData: { data: getBase64Data(data), mimeType } });
        }
      });

      // Handle details (Garment details)
      cat.details.forEach((detail, idx) => {
        parts.push({ text: `[Garment Detail Reference: ${catUpper} ${idx}]: Use this to match clothing details.` });
        parts.push({ inlineData: { data: getBase64Data(detail), mimeType } });
      });
    });

    const proGroupProtocol = isProGroup ? `
[PRO GROUP MODE ACTIVE]:
- This is a multi-subject group shot (3-4 people).
- Perform high-resolution regional refinement for every individual subject.
- Ensure facial features for all people are sharp, distinct, and maintain their specific identities.
- Render every garment texture with macro-level detail.
- Maintain perfect spatial relationships and interaction realism between all subjects.
- Use internal multi-pass processing to ensure no subject is blurred or low-quality.
` : "";

    parts.push({
      text: `TASK: PRODUCE FLAWLESS ADVERTISING ASSET.
      
      DIRECTION:
      ${instruction}
      
      ${proGroupProtocol}
      ${V30_MASTER_PROTOCOL}`
    });

    const effectiveQuality = isProGroup ? "4K" : quality;

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: effectiveQuality as any
        },
        seed: generateSafeSeed()
      }
    }));

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    if (response.candidates?.[0]?.finishReason) {
      throw new Error(`생성 중단됨 (이유: ${response.candidates[0].finishReason})`);
    }
    
    return null;
  };

  const results = await Promise.all(Array.from({ length: count }).map((_, i) => singleTask(i)));
  return results.filter(r => r !== null) as string[];
};

const ATMOSPHERE_MASTER_PROTOCOL = `
[ATMOSPHERE_ADJUSTMENT_STRICT_STAY]:
1. ZERO_COMPOSITION_CHANGE: REFERENCE_IMAGE의 모든 픽셀 위치와 구도를 고정하십시오. 배경의 산, 건물, 실내 장식 등 모든 요소를 그대로 유지해야 합니다.
2. OPTICAL_OVERLAY_ONLY: 새로운 배경을 생성하지 마십시오. 오직 기존 이미지 위에 조명(Lighting), 색온도(Color Temperature), 채도(Saturation), 노출(Exposure)의 변화만을 적용하십시오.
3. OBJECT_INTEGRITY: 피사체와 배경 사물의 형태를 변형하거나 지우지 마십시오.
4. PROFESSIONAL_GRADING: 하이엔드 광고 사진의 컬러 그레이딩(Color Grading) 기법을 사용하여 분위기를 전환하십시오.
`;

const weightToAdjective = (weight: number, positive: string) => {
  if (weight >= 90) return `Extremely ${positive}, dramatic cinematic masterpiece level`;
  if (weight >= 70) return `Strong ${positive}, professional high-end impact`;
  if (weight >= 40) return `Balanced ${positive}, standard professional quality`;
  if (weight >= 20) return `Subtle ${positive}, natural hint of effect`;
  return `Very subtle ${positive}, maintaining original base`;
};

export const adjustAtmosphere = async (
  base64Image: string,
  params: {
    color: { selections: string[]; weight: number };
    lighting: { selections: string[]; weight: number };
    texture: { selections: string[]; weight: number };
    grading: { selections: string[]; weight: number };
  },
  aspectRatio: AllowedAspectRatio = "9:16",
  quality: ImageQuality = "2K",
  count: number = 1,
  mimeType: string = 'image/png'
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const colorDesc = params.color.selections.length > 0 ? weightToAdjective(params.color.weight, params.color.selections.join(', ')) : 'None';
  const lightingDesc = params.lighting.selections.length > 0 ? weightToAdjective(params.lighting.weight, params.lighting.selections.join(', ')) : 'None';
  const textureDesc = params.texture.selections.length > 0 ? weightToAdjective(params.texture.weight, params.texture.selections.join(', ')) : 'None';
  const gradingDesc = params.grading.selections.length > 0 ? weightToAdjective(params.grading.weight, params.grading.selections.join(', ')) : 'None';

  const singleTask = async (index: number) => {
    const parts: any[] = [
      { text: "REFERENCE_IMAGE: The source image to be color-graded." },
      { inlineData: { data: getBase64Data(base64Image), mimeType } },
      { 
        text: `TASK: PERFORM PROFESSIONAL MULTI-STEP COLOR GRADING AND LIGHTING ADJUSTMENT.
        
        [STEP 1: COLOR & TONE]: ${colorDesc}
        [STEP 2: ENVIRONMENT & LIGHTING]: ${lightingDesc}
        [STEP 3: TEXTURE & SURFACE]: ${textureDesc}
        [STEP 4: CINEMATIC GRADING]: ${gradingDesc}
        
        INSTRUCTION:
        Apply the specified adjustments to the REFERENCE_IMAGE sequentially while maintaining the original structure.
        ${ATMOSPHERE_MASTER_PROTOCOL}` 
      }
    ];
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: { 
        imageConfig: { aspectRatio: aspectRatio, imageSize: quality as any }, 
        seed: generateSafeSeed()
      }
    }));
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  };
  const results = await Promise.all(Array.from({ length: count }).map((_, i) => singleTask(i)));
  return results.filter(r => r !== null) as string[];
};

export const correctWhiteBalance = async (
  base64Image: string,
  aspectRatio: AllowedAspectRatio = "9:16",
  quality: ImageQuality = "2K",
  mimeType: string = 'image/png'
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const parts: any[] = [
    { text: "REFERENCE_IMAGE: The image that needs white balance correction." },
    { inlineData: { data: getBase64Data(base64Image), mimeType } },
    { 
      text: `TASK: PERFORM PROFESSIONAL HIGH-PRECISION WHITE BALANCE CORRECTION.
      
      INSTRUCTION:
      1. COLOR_CAST_VS_OBJECT_COLOR: REFERENCE_IMAGE에서 '환경광에 의한 색조(Environmental Color Cast)'와 '사물 고유의 색상(Intrinsic Object Color)'을 명확히 구분하십시오. 예를 들어, 연한 푸른색 셔츠는 그 고유의 색상을 유지해야 하며, 이를 흰색 셔츠에 푸른 조명이 비친 것으로 오해하여 흰색으로 강제 보정하지 마십시오.
      2. NEUTRALIZATION: 오직 조명에 의해 왜곡된 전체적인 톤만을 중화하십시오. 이미지 내의 진짜 무채색 영역(눈동자의 흰자위, 배경의 중립 회색 등)을 화이트 밸런스의 기준으로 삼으십시오.
      3. HUMAN_SKIN_VIBRANCY: 인물의 피부톤을 보정할 때 단순히 중립화하는 것에 그치지 말고, 생기 있고 건강한 혈색(Vibrant & Lively Skin Tone)이 돌도록 하십시오. 칙칙하거나 창백한 느낌을 제거하고, 화사하면서도 자연스러운 생동감을 부여하십시오.
      4. TEXTURE_PRESERVATION: 피부의 디테일과 의상의 질감을 완벽하게 보존하십시오.
      5. ZERO_COMPOSITION_CHANGE: 피사체의 형태, 배경의 구도, 사물의 위치는 100% 동일하게 유지하십시오.` 
    }
  ];

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: { 
        imageConfig: { aspectRatio: aspectRatio, imageSize: quality as any }, 
        seed: generateSafeSeed()
      }
    }));
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (e) {
    console.error("White Balance Correction Error:", e);
    return null;
  }
};
