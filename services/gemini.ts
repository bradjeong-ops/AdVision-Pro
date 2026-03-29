
import { GoogleGenAI } from "@google/genai";
import { Language, ProductionGuide, AtmosphereParams } from '../types';

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
[CRITICAL INSTRUCTIONS FOR SUBJECT REPLACEMENT - V3.2 MASTER]
1. IDENTITY ISOLATION & FIDELITY (STRICT): 
   - [IDENTITY ISOLATION]: Each subject in the [Base Image] is a "High-Priority Identity Zone". Isolate each zone and apply the mapped identity from the [Subject Reference] and [Face Detail Reference] with 100% fidelity.
   - [IDENTITY FIDELITY]: You MUST match the facial angle, gaze direction, and micro-expression of the [Face Detail Reference] while ensuring it fits the perspective of the [Base Image].
   - [NO IDENTITY LEAKAGE]: Subject A must look EXACTLY like Model A, and Subject B must look EXACTLY like Model B.
   - [IDENTITY OVERWRITE]: COMPLETELY OVERWRITE the face in the [Base Image]. DO NOT leave any resemblance to the original face.
2. SPATIAL LOCKING & PERSPECTIVE (STRICT):
   - [SPATIAL LOCKING]: You MUST keep each subject in their EXACT coordinate position from the [Base Image]. Do NOT move, shift, or swap the positions of subjects. Subject 1 must stay where Subject 1 was, Subject 2 where Subject 2 was.
   - [PERSPECTIVE MATCHING]: The subjects' scale and orientation must match the 3D perspective of the environment in the [Base Image].
3. GROUND INTEGRATION & CONTACT SHADOWS:
   - [CONTACT SHADOWS]: When rendering shoes/feet, you MUST create physically accurate contact shadows where the shoe meets the ground. These shadows should be dark and sharp at the point of contact and soften as they move away.
   - [GROUND BLENDING]: Ensure the shoes do not look "pasted on". Match the lighting, texture, and reflections of the ground onto the lower part of the shoes.
4. PROFESSIONAL POSING REFINEMENT:
   - [CONTRAPPOSTO]: Refine weight distribution to follow a professional 'Contrapposto' stance.
   - [LIMB TENSION]: Add subtle muscle tension to limbs to convey a professional model presence.
5. COMPOSITION & FRAMING FIDELITY:
   - The [Base Image] is your ABSOLUTE template for framing. Maintain EXACT cropping, camera distance, and scale.
6. GARMENT REPLACEMENT (STRICT):
   - Replace 100% of the clothing. Use exact style, color, fabric, and branding from references.
7. ANATOMICAL INTEGRITY:
   - [HAND & BODY PROPORTIONS]: Maintain original anatomical proportions of hands and body parts from the [Base Image]. DO NOT enlarge hands.
8. DYNAMIC MOTION & PHYSICS (HIGH-FIDELITY): 
   - [AERODYNAMIC DRAG]: If moving, garments MUST react to air resistance. Fabric should stretch, flutter, and billow in the opposite direction of travel with realistic inertia.
   - [SHUTTER SPEED MATCHING]: Match the motion blur of the [Base Image] exactly.
9. PHOTOREALISM: Render with ultra-high photorealistic quality (8K equivalent).
`;

const getBase64Data = (url: string) => url.split(',')[1];

/**
 * Downscales a base64 image to a maximum dimension while preserving aspect ratio.
 */
export const downscaleImage = async (url: string, maxDimension: number = 2048, format: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<string> => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(url);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const { width, height } = img;
        
        let newWidth = width;
        let newHeight = height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            newWidth = maxDimension;
            newHeight = (height / width) * maxDimension;
          } else {
            newHeight = maxDimension;
            newWidth = (width / height) * maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(newWidth);
        canvas.height = Math.floor(newHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(url);
          return;
        }

        if (format === 'image/png') {
          ctx.imageSmoothingEnabled = false;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined));
      } catch (e) {
        console.warn("Downscale failed, using original:", e);
        resolve(url);
      }
    };
    img.onerror = () => {
      console.warn("Image load failed for downscale:", url.substring(0, 50) + "...");
      resolve(url);
    };
    img.src = url;
  });
};

const generateSafeSeed = () => Math.floor(Math.random() * 2147483647);

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1500, signal?: AbortSignal): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    if (signal?.aborted) throw new Error('Aborted');
    try {
      return await fn();
    } catch (e: any) {
      if (signal?.aborted) throw new Error('Aborted');
      lastError = e;
      const errorMessage = e.message || String(e);
      const isRetryable = 
        errorMessage.includes('503') || 
        errorMessage.includes('UNAVAILABLE') || 
        errorMessage.includes('429') || 
        errorMessage.includes('Deadline') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('overloaded');
      
      if (!isRetryable) throw e;
      
      const delay = initialDelay * Math.pow(2, i);
      console.warn(`Gemini API call failed (attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`, errorMessage);
      
      // Wait for delay or until signal is aborted
      if (signal) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Aborted'));
          }, { once: true });
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
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

export const translatePrompt = async (text: string, targetLang: 'en' | 'ko' = 'en'): Promise<string> => {
  if (!text.trim()) return text;
  const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
  if (targetLang === 'en' && !hasKorean) return text;
  
  const apiKey = getApiKey();
  if (!apiKey) return text;
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = targetLang === 'en' 
    ? `Translate the following text to English: "${text}"`
    : `Translate the following text to Korean: "${text}"`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a strict translation engine. Output ONLY the direct translation. No explanations, no conversational text, no markdown formatting, no options."
      }
    }));
    return response.text?.trim() || text;
  } catch (e) {
    return text;
  }
};

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
  - "subjects": A standard JSON array of objects. Each object MUST have "id" and "description" keys. 
    Example of correct "subjects" format: [{"id": "subject_1", "description": "..."}, {"id": "subject_2", "description": "..."}]
    DO NOT use keys for the array elements like "subject_1": {}.

  CRITICAL INSTRUCTIONS:
  - SUBJECT DETECTION: Identify all distinct people in the image. For each person, provide a clear, concise description of their position and key identifying feature. IMPORTANT: The "description" for subjects MUST ALWAYS be in Korean, even if other fields are in English.
  - PRODUCT ABSTRACTION: If the image features a product rather than a person, refer to it generically as ${lang === 'ko' ? '"메인 제품"' : '"the main product"'}.
  - NO HALLUCINATION: Analyze ONLY what is visible.

  Ensure the output is a valid JSON object with keys: "coreProduction", "cameraComposition", "setBackground", "lightingMood", "textureTechnical", "subjects".`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            coreProduction: { type: "STRING" as any },
            cameraComposition: { type: "STRING" as any },
            setBackground: { type: "STRING" as any },
            lightingMood: { type: "STRING" as any },
            textureTechnical: { type: "STRING" as any },
            subjects: {
              type: "ARRAY" as any,
              items: {
                type: "OBJECT" as any,
                properties: {
                  id: { type: "STRING" as any },
                  description: { type: "STRING" as any }
                },
                required: ["id", "description"]
              }
            }
          },
          required: ["coreProduction", "cameraComposition", "setBackground", "lightingMood", "textureTechnical", "subjects"]
        }
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

export const getClosestAspectRatio = (ratio: number): AllowedAspectRatio => {
  const ratios: { label: AllowedAspectRatio; value: number }[] = [
    { label: "9:16", value: 9 / 16 },
    { label: "16:9", value: 16 / 9 },
    { label: "3:4", value: 3 / 4 },
    { label: "1:1", value: 1 / 1 },
  ];
  
  return ratios.reduce((prev, curr) => 
    Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
  ).label;
};

const REFINEMENT_PROTOCOL = `
[HIGH-END COMMERCIAL RETOUCHING PROTOCOL - V12]
1. ROLE: You are a world-class high-end commercial retoucher for luxury fashion brands.
2. LIGHTING & SHADOW MATCHING:
   - Analyze the light source direction, color temperature, and shadow density of the [Anatomy & Scale Reference].
   - Apply perfect Global Illumination (GI) and Ambient Occlusion (AO) to the new object.
   - [CONTACT SHADOWS]: Create physically accurate contact shadows where the object meets the ground or body. These shadows should be dark and sharp at the point of contact.
3. GROUND INTEGRATION: Ensure the object does not look "pasted on". Match the lighting, texture, and reflections of the ground onto the lower part of the object.
4. DEPTH OF FIELD (DOF): Match the focal blur (bokeh) of the original image.
5. TEXTURE & NOISE: Match the film grain or digital noise profile of the original plate.
6. SEAMLESS INTEGRATION: The transition between original pixels and new content must be 100% invisible.
7. EDGE CONTINUITY: Continue hair strands, clothing patterns, or background lines perfectly into the edit zone.
8. GLOBAL COHERENCE: Match the color grading and contrast perfectly.
9. ABSOLUTE OPACITY: The entire output image must be 100% OPAQUE.
10. NO HALLUCINATIONS: Do not add random artifacts or unrelated objects.
11. BACKGROUND RECONSTRUCTION: Perfectly reconstruct the background behind the new object.
12. DYNAMIC MOTION & PHYSICS (HIGH-FIDELITY): 
    - [AERODYNAMIC DRAG]: Respect physics. Clothing should flow/flutter naturally in the direction of movement with realistic aerodynamic drag and inertia.
    - [SHUTTER SPEED MATCHING]: Match the original image's shutter speed perfectly. If the subjects in the original image are sharp, the new object MUST be 100% sharp and in-focus with NO motion blur.
13. [HAND-OBJECT CONTACT]: If the object is being held, ensure the hand's fingers wrap around the object realistically. There must be NO gaps or "floating" objects. The grip must look firm and physically grounded.
14. [GARMENT STRUCTURE & DRAPING]: When changing garment types (e.g., collar to hood):
    - [VOLUME & PERSPECTIVE]: Reconstruct the 3D volume of the new garment. A hood must sit realistically on the shoulders and wrap around the neck with proper thickness.
    - [SHOULDER LINE INTEGRITY]: Ensure the garment follows the subject's skeletal pose. The fabric must drape naturally over the shoulders without looking flat or "pasted" over the background.
    - [CONTACT SHADOWS]: Add subtle shadows between the garment (like a hood) and the body/background to create a sense of depth and separation.
`;

export const refineImageWithMask = async (
  base64Image: string,
  base64Mask: string,
  refinementPrompt: string,
  aspectRatio: AllowedAspectRatio = "1:1",
  referenceImages: string[] = [],
  imageSize: ImageQuality = "1K",
  isFast: boolean = false,
  mimeType: string = 'image/png',
  signal?: AbortSignal
): Promise<string> => {
  console.log("refineImageWithMask: Starting process...");
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key가 설정되지 않았습니다.");
  const ai = new GoogleGenAI({ apiKey });

  // 1. 프롬프트 번역
  const translatedPrompt = await translatePrompt(refinementPrompt, 'en');
  console.log("refineImageWithMask: Translated Prompt:", translatedPrompt);

  if (signal?.aborted) throw new Error('Aborted');

  // 2. 강제 인페인팅을 위한 "구멍 뚫기(Hole Punching)" 로직
  const createPunchedImage = async (base: string, mask: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const bImg = new Image();
      const mImg = new Image();
      bImg.crossOrigin = 'anonymous';
      mImg.crossOrigin = 'anonymous';

      let loaded = 0;
      const onload = () => {
        loaded++;
        if (loaded === 2) {
          const canvas = document.createElement('canvas');
          canvas.width = bImg.width;
          canvas.height = bImg.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas error');

          // 1. 원본 이미지 그리기
          ctx.drawImage(bImg, 0, 0, canvas.width, canvas.height);

          // 2. 마스크를 이용해 수정 영역을 "강렬한 색상(Magenta)"으로 덮어쓰기
          // AI가 "여기는 확실히 비어있거나 수정해야 할 곳이다"라고 인식하게 함
          const mCanvas = document.createElement('canvas');
          mCanvas.width = canvas.width;
          mCanvas.height = canvas.height;
          const mCtx = mCanvas.getContext('2d');
          if (!mCtx) return reject('Canvas error');
          
          mCtx.drawImage(mImg, 0, 0, canvas.width, canvas.height);
          
          // 🔥 프로페셔널 패치: 블러 대신 날카로운 확장(Sharp Dilation) 사용
          // 경계선에서 원본 픽셀이 새어나오는 것을 방지하기 위해 마스크를 8px 정도 확장합니다.
          // AI가 주변 배경을 더 잘 이해할 수 있도록 확장 범위를 5px -> 8px로 최적화합니다.
          const dilatedCanvas = document.createElement('canvas');
          dilatedCanvas.width = canvas.width;
          dilatedCanvas.height = canvas.height;
          const dCtx = dilatedCanvas.getContext('2d');
          if (!dCtx) return reject('Canvas error');
          
          for (let y = -8; y <= 8; y++) {
            for (let x = -8; x <= 8; x++) {
              dCtx.drawImage(mCanvas, x, y);
            }
          }
          
          // 마스크 영역을 밝은 마젠타(#FF00FF)로 채움
          ctx.globalCompositeOperation = 'source-over';
          
          // 마스크 영역만 추출해서 마젠타로 칠함
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tCtx = tempCanvas.getContext('2d');
          if (!tCtx) return reject('Canvas error');
          
          tCtx.fillStyle = '#FF00FF';
          tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tCtx.globalCompositeOperation = 'destination-in';
          tCtx.drawImage(dilatedCanvas, 0, 0);
          
          // 메인 캔버스에 덮어쓰기
          ctx.drawImage(tempCanvas, 0, 0);

          console.log(`Hole Punching (Optimized Magenta Fill) completed.`);
          resolve(canvas.toDataURL('image/png'));
        }
      };
      
      bImg.onload = onload;
      mImg.onload = onload;
      bImg.onerror = () => reject('Base image load failed');
      mImg.onerror = () => reject('Mask image load failed');
      
      const targetDim = 3072; // Maximize input resolution for Gemini (up to 3072px)
      downscaleImage(base, targetDim, 'image/png').then(res => { bImg.src = res; });
      downscaleImage(mask, targetDim, 'image/png').then(res => { mImg.src = res; });
    });
  };

  // 구멍이 마젠타로 채워진 이미지 생성
  console.log("refineImageWithMask: Creating punched image...");
  const punchedBase64 = await createPunchedImage(base64Image, base64Mask);
  console.log("refineImageWithMask: Punched image created.");

  // 3. 매우 강력한 인페인팅 전용 프롬프트
  const isBigRequested = /big|large|huge|거대한|큰|빅/i.test(translatedPrompt);
  
  const prompt = `
    ${REFINEMENT_PROTOCOL}
    [CRITICAL IMAGE EDITING TASK - REFINE MODE V10]

    You are provided with three images:
    1. [Anatomy & Scale Reference]: The original image. Use this ONLY to understand the correct scale of hands, body parts, and the environment.
    2. [Edit Zone Guide]: The image with a BRIGHT MAGENTA (#FF00FF) area. This is where you must work.
    3. [Mask Guide]: A black and white mask of the edit zone.

    Instruction for the new content: "${translatedPrompt}"
    
    STRICT RULES FOR ANATOMICAL INTEGRITY:
    1. [HAND SCALE LOCK]: Look at the [Anatomy & Scale Reference]. You MUST maintain the EXACT size and skeletal structure of the hand. DO NOT ENLARGE THE HAND. The hand in your output must match the original hand's scale 1:1. Match the finger length and palm width perfectly.
    2. [TOTAL VOID - NO GHOSTING]: The MAGENTA area in [Edit Zone Guide] is a TOTAL VOID. You MUST IGNORE ALL PIXELS from the [Anatomy & Scale Reference] that fall within this magenta area. DO NOT let any part of the old object's silhouette or shadow appear. Erase it completely and replace it with 100% NEW, CLEAN pixels.
    3. [SENSIBLE OBJECT SIZING]: Render the "${translatedPrompt}" at its REAL-WORLD NATURAL SIZE. 
       - Do not artificially scale the object to fill the entire magenta area if doing so would make it look unnaturally large or small compared to the human hands and environment in the [Anatomy & Scale Reference].
       - ${isBigRequested ? "A 'large' size was requested, so make it a bit bigger than average, but it must still fit naturally in a human hand without distorting the hand." : "If the requested object is smaller than the magenta area, fill the remaining magenta space with the logical background (sky, trees, etc.) from the [Anatomy & Scale Reference]."}
    4. [PIXEL-PERFECT BLENDING]: The transition between your new content and the original pixels must be invisible. Ensure the final image is sharp and high-resolution (4K quality). Meticulously reconstruct the background (hair, sky, wall) to be clean and artifact-free.
    5. [SHARP FOCUS ENFORCEMENT]: Do NOT apply any artificial blur or "dreamy" effects. The new object must match the exact sharpness and grain (noise) of the original image's focal plane.
    6. [EDGE CONTINUITY CHECK]: If the mask cuts through hair, skin, or clothing, you MUST reconstruct those elements so they flow naturally from the original parts into the edit zone. No sharp breaks or smudges.
    7. [OBJECT EXTENSION]: If the requested object ("${translatedPrompt}") is naturally longer or larger than the magenta area (e.g., a long golf club replacing a shorter tennis racket), you ARE PERMITTED to extend the object slightly into the immediate surrounding background to maintain realistic physical proportions, provided the extension blends 100% seamlessly with the environment.
    8. [STRICT OBJECT ENFORCEMENT]: You MUST generate ONLY the requested object ("${translatedPrompt}"). Do NOT generate unrelated items (e.g., food, toys, or other household objects) even if the shape seems similar. If a "golf club" is requested, it must have a thin metallic shaft and a specific club head.
    9. [MATERIAL FIDELITY]: Ensure the material of the new object is realistic. A golf club should look like carbon fiber or polished metal, not organic or plastic.
    10. [CONTEXTUAL OBJECT RECOGNITION]: Carefully identify the requested object ("${translatedPrompt}"). Do not be misled by the shape of the original object or the mask. For example, if the original object was a racket and the new one is a golf club, ensure the result is a clear, distinct golf club with all its characteristic features (grip, shaft, head), not a hybrid or a different object entirely.
    
    Output ONLY the finalized, full image.
  `;

  // 투명도를 보존해야 하므로 반드시 mimeType을 'image/png'로 전송합니다.
  const parts: any[] = [
    { text: prompt },
    { text: "[Anatomy & Scale Reference]: Use this to keep hand and body proportions 1:1 with the original." },
    { inlineData: { data: getBase64Data(base64Image), mimeType: 'image/png' } },
    { text: "[Edit Zone Guide]: The magenta area is the only place you should add new content or background." },
    { inlineData: { data: getBase64Data(punchedBase64), mimeType: 'image/png' } },
    { text: "[Mask Guide]: Black and white representation of the edit zone." },
    { inlineData: { data: getBase64Data(base64Mask), mimeType: 'image/png' } }
  ];

  // 마스크 가이드는 가끔 AI를 혼란스럽게 하므로 제거하고 투명도에만 집중하게 합니다.
  
  // ⚠️ 원본 이미지를 참조용으로 추가하지 않습니다. (AI가 원본을 그대로 복구하는 것을 방지)
  
  if (referenceImages.length > 0) {
    const downscaledRefs = await Promise.all(referenceImages.map(ref => downscaleImage(ref, 800)));
    downscaledRefs.forEach((ref, idx) => {
      parts.push({ text: `[Reference Image ${idx + 1}]: Use this for style/content matching.` });
      parts.push({ inlineData: { data: getBase64Data(ref), mimeType: 'image/jpeg' } });
    });
  }

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: {
        temperature: 1.0, // 창의성 최대화
        imageConfig: {
          aspectRatio: aspectRatio,
          // Fast mode prioritizes speed over resolution (1K), normal mode uses 2K or 4K
          imageSize: isFast ? "1K" : ((imageSize === "4K") ? "4K" : "2K")
        }
      }
    }), 3, 3000, signal);

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    }
    throw new Error("이미지 생성에 실패했습니다.");
  } catch (e: any) {
    console.error("Refinement Error:", e);
    throw new Error(`이미지 수정 실패: ${e.message || "알 수 없는 오류"}`);
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
  
  IMPORTANT: Ensure the 'subjects' field remains a standard JSON array of objects: [{"id": "...", "description": "..."}, ...]. 
  DO NOT use keys for the array elements like "subject_1": {}.
  
  Ensure the output is a valid JSON object with the exact same keys: "coreProduction", "cameraComposition", "setBackground", "lightingMood", "textureTechnical", "subjects".`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            coreProduction: { type: "STRING" as any },
            cameraComposition: { type: "STRING" as any },
            setBackground: { type: "STRING" as any },
            lightingMood: { type: "STRING" as any },
            textureTechnical: { type: "STRING" as any },
            subjects: {
              type: "ARRAY" as any,
              items: {
                type: "OBJECT" as any,
                properties: {
                  id: { type: "STRING" as any },
                  description: { type: "STRING" as any }
                },
                required: ["id", "description"]
              }
            }
          },
          required: ["coreProduction", "cameraComposition", "setBackground", "lightingMood", "textureTechnical", "subjects"]
        }
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
    let mappingInstruction = "";
    if (subjectMapping && subjectMapping.length > 0) {
      const mappingText = subjectMapping
        .filter(m => m.assignedModelId)
        .map(m => `- Map the identity and clothing from [Subject Reference: ${m.assignedModelId?.toUpperCase()}] and [Face Detail Reference: ${m.assignedModelId?.toUpperCase()}] to the person described as "${m.description}" in the [Base Image].`)
        .join('\n');
      if (mappingText) {
        mappingInstruction = `[SUBJECT MAPPING INSTRUCTIONS]:\n${mappingText}\nCRITICAL: You MUST replace the identity of the assigned person COMPLETELY. Do not leave any resemblance to the original person in the [Base Image].\n[MULTI-SUBJECT IDENTITY VERIFICATION]: Before rendering, verify that all 4 subjects have their unique identities assigned correctly. No subject should look like another subject.`;
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
- This is a complex multi-subject group shot (up to 4 people).
- [INDIVIDUAL REFINEMENT]: Perform a dedicated high-resolution refinement pass for EACH of the 4 subjects.
- [IDENTITY LOCK]: Lock the identity of each subject to their specific mapped reference. Ensure no cross-contamination of facial features between subjects.
- [EXPRESSION SYNC]: Ensure all 4 subjects maintain the emotional energy and expressions from the [Base Image] while wearing the new identities.
- [DETAIL PARITY]: Every subject, regardless of their position in the frame (foreground or background), must have macro-level detail in skin, eyes, and clothing.
- [SPATIAL REALISM]: Maintain perfect depth of field and interaction realism between all 4 subjects.
` : "";

    parts.push({
      text: `TASK: PRODUCE FLAWLESS ADVERTISING ASSET.
      
      DIRECTION:
      ${instruction}
      
      ${mappingInstruction}
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

    if (response.candidates) {
      for (const candidate of response.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    }
    
    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason && firstCandidate.finishReason !== 'STOP') {
      throw new Error(`생성 중단됨 (이유: ${firstCandidate.finishReason})`);
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
  params: AtmosphereParams,
  aspectRatio: AllowedAspectRatio = "9:16",
  quality: ImageQuality = "2K",
  count: number = 1,
  mimeType: string = 'image/png'
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const colorDesc = (params.color?.selections?.length ?? 0) > 0 ? weightToAdjective(params.color?.weight ?? 50, params.color?.selections?.join(', ') ?? '') : 'None';
  const lightingDesc = (params.lighting?.selections?.length ?? 0) > 0 ? weightToAdjective(params.lighting?.weight ?? 50, params.lighting?.selections?.join(', ') ?? '') : 'None';
  const textureDesc = (params.texture?.selections?.length ?? 0) > 0 ? weightToAdjective(params.texture?.weight ?? 50, params.texture?.selections?.join(', ') ?? '') : 'None';
  const gradingDesc = (params.grading?.selections?.length ?? 0) > 0 ? weightToAdjective(params.grading?.weight ?? 50, params.grading?.selections?.join(', ') ?? '') : 'None';

  const singleTask = async (index: number) => {
    const parts: any[] = [
      { text: "REFERENCE_IMAGE: The source image to be color-graded." },
      { inlineData: { data: getBase64Data(base64Image), mimeType } },
    ];

    if (params.globalReferenceImage) {
      parts.push({ text: "GLOBAL_AESTHETIC_REFERENCE: Match the overall color, lighting, texture, and mood of this image exactly." });
      parts.push({ inlineData: { data: getBase64Data(params.globalReferenceImage), mimeType } });
    } else {
      if (params.color.referenceImage) {
        parts.push({ text: "COLOR_REFERENCE: Match the color palette and tone of this image." });
        parts.push({ inlineData: { data: getBase64Data(params.color.referenceImage), mimeType } });
      }
      if (params.lighting.referenceImage) {
        parts.push({ text: "LIGHTING_REFERENCE: Match the lighting direction, intensity, and mood of this image." });
        parts.push({ inlineData: { data: getBase64Data(params.lighting.referenceImage), mimeType } });
      }
      if (params.texture.referenceImage) {
        parts.push({ text: "TEXTURE_REFERENCE: Match the surface details and material quality of this image." });
        parts.push({ inlineData: { data: getBase64Data(params.texture.referenceImage), mimeType } });
      }
      if (params.grading.referenceImage) {
        parts.push({ text: "GRADING_REFERENCE: Match the final cinematic look and color grading of this image." });
        parts.push({ inlineData: { data: getBase64Data(params.grading.referenceImage), mimeType } });
      }
    }

    const instruction = params.globalReferenceImage 
      ? "Apply the aesthetic from GLOBAL_AESTHETIC_REFERENCE to the REFERENCE_IMAGE while maintaining its original structure."
      : `Apply the following adjustments to the REFERENCE_IMAGE sequentially while maintaining the original structure:
        [STEP 1: COLOR & TONE]: ${params.color.referenceImage ? "Match COLOR_REFERENCE" : colorDesc}
        [STEP 2: ENVIRONMENT & LIGHTING]: ${params.lighting.referenceImage ? "Match LIGHTING_REFERENCE" : lightingDesc}
        [STEP 3: TEXTURE & SURFACE]: ${params.texture.referenceImage ? "Match TEXTURE_REFERENCE" : textureDesc}
        [STEP 4: CINEMATIC GRADING]: ${params.grading.referenceImage ? "Match GRADING_REFERENCE" : gradingDesc}`;

    parts.push({ 
      text: `TASK: PERFORM PROFESSIONAL MULTI-STEP COLOR GRADING AND LIGHTING ADJUSTMENT.
      
      INSTRUCTION:
      ${instruction}
      ${ATMOSPHERE_MASTER_PROTOCOL}` 
    });

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
