
export type Language = 'en' | 'ko';

export interface AtmosphereParams {
  color: { selections: string[]; weight: number; referenceImage?: string | null };
  lighting: { selections: string[]; weight: number; referenceImage?: string | null };
  texture: { selections: string[]; weight: number; referenceImage?: string | null };
  grading: { selections: string[]; weight: number; referenceImage?: string | null };
  globalReferenceImage?: string | null;
  globalIntensity?: number;
}

export interface GenerationRecord {
  id: string;
  originalImage: string;
  generatedImage: string;
  prompt: string;
  timestamp: number;
  ratio?: number;
  productionGuide?: ProductionGuide;
  atmosphereParams?: AtmosphereParams;
}

export enum AppStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  ERROR = 'ERROR'
}

export interface CategoryData {
  mains: {
    front: string | null;
    side: string | null;
    back: string | null;
  };
  face: string | null;
  details: string[];
  isAnalyzing: boolean;
}

export interface ProductionGuide {
  coreProduction: string;
  cameraComposition: string;
  setBackground: string;
  lightingMood: string;
  textureTechnical: string;
  subjects?: { id: string; description: string }[];
}
