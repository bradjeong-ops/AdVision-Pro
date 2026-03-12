
export interface GenerationRecord {
  id: string;
  originalImage: string;
  generatedImage: string;
  prompt: string;
  timestamp: number;
  ratio?: number;
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
  overall: string;
  lighting: string;
  background: string;
  mood: string;
}
