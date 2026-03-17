
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  SparklesIcon, 
  ArrowPathIcon, 
  CheckBadgeIcon, 
  XMarkIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  UserIcon,
  KeyIcon,
  ClipboardIcon,
  HistoryIcon,
  PhotoIcon,
  Square2StackIcon,
  XCircleIcon
} from './components/Icons';
import { AppStatus, GenerationRecord, ProductionGuide } from './types';
import { 
  generateProductEdit, 
  adjustAtmosphere, 
  correctWhiteBalance,
  analyzeReferenceImage,
  classifyModelView,
  CategorizedProduct, 
  AllowedAspectRatio, 
  ImageQuality,
  ModelViewType
} from './services/gemini';
import BlendTab from './components/BlendTab';
import IntensityTab from './components/IntensityTab';
import GuestLoginModal from './components/GuestLoginModal';
import { get, set } from 'idb-keyval';

const getAIStudio = () => (window as any).aistudio;

type CategoryKey = 'id1' | 'id2' | 'other';
type TabKey = 'synthesis' | 'atmosphere';

interface CategoryData {
  mains: {
    front: string | null;
    side: string | null;
    back: string | null;
    face: string | null;
  };
  details: string[];
  items: string[];
  isAnalyzing: boolean;
}

const BASE_SYNTHESIS_PROMPT = 'Professional Studio Master Asset: Execute flawless synthesis of each MODEL from the Identity Library with absolute identity preservation. Achieve ultra-high-resolution details equivalent to Hasselblad medium-format captures (Sharp texture, Natural skin pores, Zero artifacts). Maintain mathematical precision in eye-gaze direction and pupil symmetry to eliminate any unnatural gaze. Render all garment and footwear libraries with 100% commercial-grade integrity.';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('synthesis');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [fullscreenData, setFullscreenData] = useState<{
    images: {url: string, original?: string, initial?: string, ratio?: number, productionGuide?: ProductionGuide}[],
    currentIndex: number
  } | null>(null);
  const [expandedGuideIndices, setExpandedGuideIndices] = useState<number[]>([]);
  
  useEffect(() => {
    setExpandedGuideIndices([]);
  }, [fullscreenData?.currentIndex]);

  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  
  const [blendInputImage, setBlendInputImage] = useState<string | null>(null);
  const [blendOutputImage, setBlendOutputImage] = useState<string | null>(null);
  const [synthesisHistory, setSynthesisHistory] = useState<GenerationRecord[]>([]);
  
  const [intensityInputImage, setIntensityInputImage] = useState<string | null>(null);
  const [intensityInitialImage, setIntensityInitialImage] = useState<string | null>(null);
  const [intensityOutputImage, setIntensityOutputImage] = useState<string | null>(null);
  const [atmosphereHistory, setAtmosphereHistory] = useState<GenerationRecord[]>([]);

  const [intensityParams, setIntensityParams] = useState({
    color: { selections: [] as string[], weight: 50 },
    lighting: { selections: [] as string[], weight: 50 },
    texture: { selections: [] as string[], weight: 50 },
    grading: { selections: [] as string[], weight: 50 }
  });

  const [selectedQuality, setSelectedQuality] = useState<ImageQuality>("2K");
  const [selectedCount, setSelectedCount] = useState<number>(1);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [categorizedProducts, setCategorizedProducts] = useState<Record<CategoryKey, CategoryData>>({
    id1: { mains: { front: null, side: null, back: null, face: null }, details: [], items: [], isAnalyzing: false },
    id2: { mains: { front: null, side: null, back: null, face: null }, details: [], items: [], isAnalyzing: false },
    other: { mains: { front: null, side: null, back: null, face: null }, details: [], items: [], isAnalyzing: false }
  });

  const [coreProductionPrompt, setCoreProductionPrompt] = useState(BASE_SYNTHESIS_PROMPT);
  const [cameraCompositionPrompt, setCameraCompositionPrompt] = useState('');
  const [setBackgroundPrompt, setSetBackgroundPrompt] = useState('');
  const [lightingMoodPrompt, setLightingMoodPrompt] = useState('');
  const [textureTechnicalPrompt, setTextureTechnicalPrompt] = useState('');
  const [selectedRatio, setSelectedRatio] = useState<AllowedAspectRatio>("9:16");
  const [isFullscreenComparing, setIsFullscreenComparing] = useState(false);
  const [fullscreenCompareMode, setFullscreenCompareMode] = useState<'previous' | 'original' | 'difference'>('previous');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  }, []);

  const [guestPin, setGuestPin] = useState<string | null>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [modalMode, setModalMode] = useState<'pin' | 'key' | 'both'>('both');

  useEffect(() => {
    const savedPin = localStorage.getItem('guestPin');
    if (savedPin) {
      setGuestPin(savedPin);
    } else {
      setShowGuestModal(true);
    }
  }, []);

  useEffect(() => {
    if (!isCheckingKey && !hasApiKey) {
      setModalMode('both');
      setShowGuestModal(true);
    }
  }, [isCheckingKey, hasApiKey]);

  useEffect(() => {
    if (guestPin) {
      const loadHistory = async () => {
        try {
          const savedSynthesis = await get(`synthesisHistory_${guestPin}`);
          const savedAtmosphere = await get(`atmosphereHistory_${guestPin}`);
          setSynthesisHistory(savedSynthesis || []);
          setAtmosphereHistory(savedAtmosphere || []);
        } catch (err) {
          console.error("Failed to load history from IndexedDB", err);
          setSynthesisHistory([]);
          setAtmosphereHistory([]);
        } finally {
          setIsHistoryLoaded(true);
        }
      };
      loadHistory();
    }
  }, [guestPin]);

  useEffect(() => {
    if (guestPin && isHistoryLoaded) {
      set(`synthesisHistory_${guestPin}`, synthesisHistory).catch(console.error);
    }
  }, [synthesisHistory, guestPin, isHistoryLoaded]);

  useEffect(() => {
    if (guestPin && isHistoryLoaded) {
      set(`atmosphereHistory_${guestPin}`, atmosphereHistory).catch(console.error);
    }
  }, [atmosphereHistory, guestPin, isHistoryLoaded]);

  const handleGuestLogin = (pin: string) => {
    if (pin !== guestPin) {
      setIsHistoryLoaded(false);
      setSynthesisHistory([]);
      setAtmosphereHistory([]);
    }
    localStorage.setItem('guestPin', pin);
    setGuestPin(pin);
    setShowGuestModal(false);
    
    const customKey = localStorage.getItem('custom_gemini_api_key');
    if (customKey) {
      setHasApiKey(true);
    }
  };

  const getImageDimensions = (url: string): Promise<{ratio: number}> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ratio: img.width / img.height });
      img.onerror = () => resolve({ ratio: 1 });
      img.src = url;
    });
  };

  const processFiles = async (files: File[], options?: any) => {
    if (!files || files.length === 0) return;

    if (options?.type === 'bulk' && options?.category) {
      const category = options.category as CategoryKey;
      setCategorizedProducts(prev => ({ ...prev, [category]: { ...prev[category], isAnalyzing: true } }));
      try {
        for (const file of files) {
          if (!file.type.startsWith('image/')) continue;
          const result = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          if (category === 'other') {
            // Product 섹션은 분류 없이 즉시 추가
            setCategorizedProducts(prev => ({
              ...prev,
              [category]: { ...prev[category], items: [...prev[category].items, result] }
            }));
          } else {
            // Model 섹션은 기존대로 분류 로직 수행
            const viewType = await classifyModelView(result);
            setCategorizedProducts(prev => {
              const newData = { ...prev[category] };
              if (viewType === 'item') newData.details = [...newData.details, result];
              else if (viewType && ['front', 'side', 'back'].includes(viewType)) {
                const targetView = viewType as 'front' | 'side' | 'back';
                if (!newData.mains[targetView]) newData.mains = { ...newData.mains, [targetView]: result };
                else {
                  const searchOrder: ('front' | 'side' | 'back')[] = ['front', 'side', 'back'];
                  const emptySlot = searchOrder.find(v => !newData.mains[v]);
                  if (emptySlot) newData.mains[emptySlot] = result;
                }
              } else newData.details = [...newData.details, result];
              return { ...prev, [category]: newData };
            });
          }
        }
      } catch (err) {
        console.error("Bulk upload error:", err);
      } finally {
        setCategorizedProducts(prev => ({ ...prev, [category]: { ...prev[category], isAnalyzing: false } }));
      }
      return;
    }

    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        if (options?.category && options?.type) {
          setCategorizedProducts(prev => {
            const newData = { ...prev[options.category!] };
            if (options.category === 'other') {
              // For Product section, everything goes to items
              newData.items = [...newData.items, result];
            } else {
              if (options.type === 'main' && options.view) newData.mains = { ...newData.mains, [options.view]: result };
              else if (options.type === 'detail') newData.details = [...newData.details, result];
            }
            return { ...prev, [options.category!]: newData };
          });
        } else {
          const { ratio } = await getImageDimensions(result);
          if (ratio < 0.65) setSelectedRatio("9:16");
          else if (ratio < 0.85) setSelectedRatio("3:4");
          else if (ratio < 1.1) setSelectedRatio("1:1");
          else setSelectedRatio("16:9");
          if (activeTab === 'synthesis') {
            setBlendInputImage(result); setBlendOutputImage(null); setIsAnalyzing(true);
            try {
              const analysis = await analyzeReferenceImage(result);
              setCoreProductionPrompt(`${BASE_SYNTHESIS_PROMPT}\n\n[CORE PRODUCTION]\n${analysis.coreProduction}`);
              setCameraCompositionPrompt(analysis.cameraComposition);
              setSetBackgroundPrompt(analysis.setBackground);
              setLightingMoodPrompt(analysis.lightingMood);
              setTextureTechnicalPrompt(analysis.textureTechnical);
            } catch (err: any) { 
              console.error(err); 
              showToast(err.message || '이미지 분석 중 오류가 발생했습니다.', 'error');
            } finally { setIsAnalyzing(false); }
          } else { 
            setIntensityInputImage(result); 
            setIntensityOutputImage(null); 
            if (!intensityInitialImage) setIntensityInitialImage(result);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    const checkKey = async () => {
      try {
        const selected = await getAIStudio().hasSelectedApiKey();
        const customKey = localStorage.getItem('custom_gemini_api_key');
        setHasApiKey(selected || !!customKey);
      } catch (e) {
        const customKey = localStorage.getItem('custom_gemini_api_key');
        setHasApiKey(!!customKey);
      } finally {
        setIsCheckingKey(false);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    const customKey = localStorage.getItem('custom_gemini_api_key');
    if (customKey) {
      setModalMode('key');
      setShowGuestModal(true);
      return;
    }

    try {
      await getAIStudio().openSelectKey();
      setHasApiKey(true);
      setError(null);
    } catch (e) {
      console.error("AI Studio key selection failed, showing manual input modal", e);
      setModalMode('key');
      setShowGuestModal(true);
    }
  };

  const handleClearCategory = useCallback((category: CategoryKey) => {
    setCategorizedProducts(prev => ({
      ...prev,
      [category]: { mains: { front: null, side: null, back: null, face: null }, details: [], items: [], isAnalyzing: false }
    }));
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, options?: any) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files), options);
    }
    e.target.value = '';
  }, [activeTab, categorizedProducts]);

  const handleDropUpload = useCallback((e: React.DragEvent<HTMLDivElement>, options?: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files), options);
    }
  }, [activeTab, categorizedProducts]);

  const downloadImage = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }, []);

  const useAsIntensityRef = useCallback((imageUrl?: string) => {
    const target = imageUrl || blendOutputImage;
    if (target) { setIntensityInputImage(target); setIntensityOutputImage(null); setActiveTab('atmosphere'); }
  }, [blendOutputImage]);

  const processEditing = async () => {
    const combinedPrompt = `
      [CORE_PRODUCTION]: ${coreProductionPrompt}
      [CAMERA_COMPOSITION]: ${cameraCompositionPrompt}
      [SET_BACKGROUND]: ${setBackgroundPrompt}
      [LIGHTING_MOOD]: ${lightingMoodPrompt}
      [TEXTURE_TECHNICAL]: ${textureTechnicalPrompt}
    `.trim();

    if (!combinedPrompt) return;
    if (!hasApiKey) { await handleOpenKeyDialog(); return; }
    setStatus(AppStatus.GENERATING);
    setError(null);
    try {
      const categoriesPayload: CategorizedProduct[] = (Object.entries(categorizedProducts) as [string, CategoryData][]).map(([key, val]) => ({
        category: key, mains: val.mains, details: val.details, items: val.items
      }));
      const results = await generateProductEdit(blendInputImage, categoriesPayload, combinedPrompt, selectedRatio, selectedQuality, selectedCount);
      if (results.length > 0) {
        setBlendOutputImage(results[0]);
        const newRecords: GenerationRecord[] = await Promise.all(results.map(async (url, idx) => {
          const { ratio } = await getImageDimensions(url);
          return { 
            id: `${Date.now()}-${idx}`, 
            originalImage: blendInputImage || '', 
            generatedImage: url, 
            prompt: `${combinedPrompt}`, 
            timestamp: Date.now(), 
            ratio,
            productionGuide: {
              coreProduction: coreProductionPrompt,
              cameraComposition: cameraCompositionPrompt,
              setBackground: setBackgroundPrompt,
              lightingMood: lightingMoodPrompt,
              textureTechnical: textureTechnicalPrompt
            }
          };
        }));
        setSynthesisHistory(prev => [...newRecords, ...prev].slice(0, 100));
        setStatus(AppStatus.IDLE);
      } else {
        throw new Error("결과물이 생성되지 않았습니다.");
      }
    } catch (err: any) {
      console.error("API Error Detail:", err);
      setStatus(AppStatus.ERROR);
      const rawMsg = err.message || "Unknown API Error";
      let displayMsg = rawMsg;
      if (rawMsg.includes("403")) displayMsg = "403 Forbidden: 유료 결제 계정이 아니거나 API 접근 권한이 없습니다.";
      if (rawMsg.includes("429")) displayMsg = "429 Too Many Requests: 할당량을 초과했습니다. 잠시 후 시도하세요.";
      if (rawMsg.includes("entity was not found")) {
        displayMsg = "API 키가 올바른 프로젝트에 속해 있지 않습니다. 키를 다시 선택하세요.";
        setHasApiKey(false);
      }
      setError(displayMsg);
    }
  };

  const processAdjustment = async (useInitial: boolean = false) => {
    const targetImage = useInitial ? (intensityInitialImage || intensityInputImage) : intensityInputImage;
    if (!targetImage) return;
    if (!hasApiKey) { await handleOpenKeyDialog(); return; }
    setStatus(AppStatus.GENERATING);
    setError(null);
    try {
      const results = await adjustAtmosphere(targetImage, intensityParams, selectedRatio, selectedQuality, selectedCount);
      if (results.length > 0) {
        setIntensityOutputImage(results[0]);
        const newRecords: GenerationRecord[] = await Promise.all(results.map(async (url, idx) => {
          const { ratio } = await getImageDimensions(url);
          const prompt = `Mastering: [Color:${intensityParams.color.selections.join(', ') || 'None'}(${intensityParams.color.weight}%)] [Light:${intensityParams.lighting.selections.join(', ') || 'None'}(${intensityParams.lighting.weight}%)] [Text:${intensityParams.texture.selections.join(', ') || 'None'}(${intensityParams.texture.weight}%)] [Grading:${intensityParams.grading.selections.join(', ') || 'None'}(${intensityParams.grading.weight}%)]`;
          return { id: `${Date.now()}-${idx}`, originalImage: targetImage, generatedImage: url, prompt, timestamp: Date.now(), ratio };
        }));
        setAtmosphereHistory(prev => [...newRecords, ...prev].slice(0, 100));
        setStatus(AppStatus.IDLE);
      } else throw new Error("이미지 없음");
    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      setError(err.message || "Adjustment failed.");
    }
  };

  const resetIntensityParams = () => {
    setIntensityParams({
      color: { selections: [], weight: 50 },
      lighting: { selections: [], weight: 50 },
      texture: { selections: [], weight: 50 },
      grading: { selections: [], weight: 50 }
    });
  };

  const processWhiteBalance = async () => {
    if (!intensityInputImage) return;
    if (!hasApiKey) { await handleOpenKeyDialog(); return; }
    setStatus(AppStatus.GENERATING);
    setError(null);
    try {
      const result = await correctWhiteBalance(intensityInputImage, selectedRatio, selectedQuality);
      if (result) {
        setIntensityOutputImage(result);
        const { ratio } = await getImageDimensions(result);
        const newRecord: GenerationRecord = { 
          id: `${Date.now()}-wb`, 
          originalImage: intensityInputImage, 
          generatedImage: result, 
          prompt: "Auto White Balance Correction", 
          timestamp: Date.now(), 
          ratio 
        };
        setAtmosphereHistory(prev => [newRecord, ...prev].slice(0, 100));
        setStatus(AppStatus.IDLE);
      } else throw new Error("화이트 밸런스 보정 실패");
    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      setError(err.message || "White balance correction failed.");
    }
  };

  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFullscreenData(prev => {
      if (!prev) return null;
      const newIndex = direction === 'next' ? (prev.currentIndex + 1) % prev.images.length : (prev.currentIndex - 1 + prev.images.length) % prev.images.length;
      return { ...prev, currentIndex: newIndex };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fullscreenData) return;
      if (e.key === 'ArrowLeft') navigateImage('prev');
      if (e.key === 'ArrowRight') navigateImage('next');
      if (e.key === 'Escape') {
        setFullscreenData(null);
        setIsFullscreenComparing(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenData, navigateImage]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!fullscreenData) return;
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom(prev => Math.min(Math.max(1, prev + delta), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="h-screen bg-[#05070a] text-slate-300 font-['Inter'] flex flex-col overflow-hidden">
      {error && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg px-4">
          <div className="bg-red-500/10 backdrop-blur-3xl border border-red-500/50 p-5 rounded-2xl flex items-center gap-4 shadow-2xl animate-in slide-in-from-top duration-300">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-red-200 text-[10px] font-black uppercase tracking-widest mb-1">Critical API Error</p>
              <p className="text-red-100 text-[12px] font-medium leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><XMarkIcon className="w-5 h-5 text-red-500" /></button>
          </div>
        </div>
      )}

      {showGuestModal && (
        <GuestLoginModal 
          onLogin={(pin) => {
            handleGuestLogin(pin);
          }} 
          onClose={() => {
            setShowGuestModal(false);
          }} 
          mode={modalMode} 
          initialPin={guestPin || ''} 
        />
      )}

      {fullscreenData && (
        <div 
          className="fixed inset-0 z-[150] bg-black/98 flex backdrop-blur-3xl overflow-hidden" 
          onClick={() => { setFullscreenData(null); setIsFullscreenComparing(false); setZoom(1); setPan({ x: 0, y: 0 }); }}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Left Side: Image Area */}
          <div 
            className={`flex-1 relative flex items-center justify-center p-8 select-none transition-transform duration-200 ${zoom > 1 ? 'cursor-move' : ''}`} 
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
          >
            {/* Navigation Arrows (Relative to Image Area) */}
            <div className="absolute inset-y-0 left-0 w-24 z-10 cursor-pointer group flex items-center justify-start pl-8" onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}>
               <div className="p-4 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all border border-white/10 backdrop-blur-md"><ChevronLeftIcon className="w-10 h-10 text-white" /></div>
            </div>
            <div className="absolute inset-y-0 right-0 w-24 z-10 cursor-pointer group flex items-center justify-end pr-8" onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}>
               <div className="p-4 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all border border-white/10 backdrop-blur-md"><ChevronRightIcon className="w-10 h-10 text-white" /></div>
            </div>

            <div className="relative" style={{ 
              height: '90vh',
              aspectRatio: fullscreenData.images[fullscreenData.currentIndex].ratio || 1,
              maxHeight: '90vh',
              maxWidth: '100%'
            }}>
              {/* Image Comparison Icons (Top Right of Image) */}
              {fullscreenData.images[fullscreenData.currentIndex].original && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-40" onClick={(e) => e.stopPropagation()}>
                  {[
                    { mode: 'previous' as const, icon: HistoryIcon, label: 'Prev' },
                    { mode: 'original' as const, icon: PhotoIcon, label: 'Orig' },
                    { mode: 'difference' as const, icon: Square2StackIcon, label: 'Diff' },
                  ].map((item) => (
                    <div key={item.mode} className="flex flex-col items-center gap-1 group/btn">
                      <button
                        onMouseDown={(e) => { e.stopPropagation(); setFullscreenCompareMode(item.mode); setIsFullscreenComparing(true); }}
                        onMouseUp={(e) => { e.stopPropagation(); setIsFullscreenComparing(false); }}
                        onMouseLeave={(e) => { e.stopPropagation(); setIsFullscreenComparing(false); }}
                        onTouchStart={(e) => { e.stopPropagation(); setFullscreenCompareMode(item.mode); setIsFullscreenComparing(true); }}
                        onTouchEnd={(e) => { e.stopPropagation(); setIsFullscreenComparing(false); }}
                        className={`p-2.5 rounded-xl backdrop-blur-md border transition-all duration-300 ${
                          isFullscreenComparing && fullscreenCompareMode === item.mode
                            ? 'bg-indigo-600 border-indigo-400 text-white scale-110 shadow-lg shadow-indigo-500/40'
                            : 'bg-black/40 border-white/10 text-white/60 hover:bg-black/60 hover:text-white hover:border-white/20'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                      </button>
                      <span className="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover/btn:text-white/80 transition-colors pointer-events-none">
                        {item.label}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex flex-col items-center">
                    <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
                    <span className="text-[6px] font-black uppercase tracking-[0.2em] text-white/20 [writing-mode:vertical-lr] mt-2">Hold to compare</span>
                  </div>
                </div>
              )}

              {fullscreenCompareMode === 'difference' && isFullscreenComparing ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img 
                    src={fullscreenData.images[fullscreenData.currentIndex].initial || fullscreenData.images[fullscreenData.currentIndex].original || fullscreenData.images[fullscreenData.currentIndex].url} 
                    className="w-full h-full object-contain rounded-xl shadow-2xl" 
                    style={{ 
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      pointerEvents: zoom > 1 ? 'none' : 'auto'
                    }}
                  />
                  <img 
                    src={fullscreenData.images[fullscreenData.currentIndex].url} 
                    className="absolute inset-0 m-auto w-full h-full object-contain mix-blend-difference" 
                    style={{ 
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      filter: 'invert(1) grayscale(1) contrast(2)',
                      pointerEvents: 'none'
                    }}
                  />
                </div>
              ) : (
                <img 
                  src={isFullscreenComparing 
                    ? (fullscreenCompareMode === 'original' 
                        ? (fullscreenData.images[fullscreenData.currentIndex].initial || fullscreenData.images[fullscreenData.currentIndex].original || fullscreenData.images[fullscreenData.currentIndex].url)
                        : (fullscreenData.images[fullscreenData.currentIndex].original || fullscreenData.images[fullscreenData.currentIndex].url))
                    : fullscreenData.images[fullscreenData.currentIndex].url} 
                  className="w-full h-full object-contain rounded-xl shadow-2xl transition-transform duration-200 ease-out" 
                  style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    pointerEvents: zoom > 1 ? 'none' : 'auto'
                  }}
                />
              )}
              {zoom > 1 && (
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest pointer-events-none z-30 whitespace-nowrap">
                  Zoom: {Math.round(zoom * 100)}% | Drag to Pan
                </div>
              )}
            </div>
          </div>

          {/* Right Side Panel: Controls & Production Guide */}
          <div className="relative h-full w-80 bg-black/40 backdrop-blur-md border-l border-white/5 flex flex-col p-8 gap-8 z-20" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Mastering Panel</h3>
                  <button onClick={() => { setFullscreenData(null); setIsFullscreenComparing(false); setZoom(1); setPan({ x: 0, y: 0 }); setExpandedGuideIndices([]); }} className="p-2 hover:bg-red-600/20 hover:text-red-500 rounded-lg transition-all text-slate-400"><XMarkIcon className="w-5 h-5" /></button>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => downloadImage(fullscreenData.images[fullscreenData.currentIndex].url, 'AdVisionPro_Export.png')}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 group shadow-xl"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Download</span>
                    </button>
                    <button 
                      onClick={() => {
                        const url = fullscreenData.images[fullscreenData.currentIndex].url;
                        if (activeTab === 'atmosphere') {
                          setIntensityInputImage(url);
                        } else {
                          setBlendInputImage(url);
                        }
                        setFullscreenData(null);
                        showToast('Image set as base');
                      }}
                      className="flex-1 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30 transition-all flex items-center justify-center gap-2 group shadow-xl"
                    >
                      <ArrowPathIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Set Base</span>
                    </button>
                  </div>
                </div>

                {/* Comparison Controls */}
                {fullscreenData.images[fullscreenData.currentIndex].original && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3 bg-indigo-500/50 rounded-full" />
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Comparison Controls</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { mode: 'previous' as const, icon: HistoryIcon, label: 'Prev' },
                        { mode: 'original' as const, icon: PhotoIcon, label: 'Orig' },
                        { mode: 'difference' as const, icon: Square2StackIcon, label: 'Diff' },
                      ].map((item) => (
                        <button
                          key={item.mode}
                          onMouseDown={(e) => { e.stopPropagation(); setFullscreenCompareMode(item.mode); setIsFullscreenComparing(true); }}
                          onMouseUp={(e) => { e.stopPropagation(); setIsFullscreenComparing(false); }}
                          onMouseLeave={(e) => { e.stopPropagation(); setIsFullscreenComparing(false); }}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                            isFullscreenComparing && fullscreenCompareMode === item.mode
                              ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-600 italic text-center">Hold button to compare with result</p>
                  </div>
                )}

                {/* Production Guide Display */}
                {fullscreenData.images[fullscreenData.currentIndex].productionGuide && (
                  <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                          <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Production Guide</span>
                      </div>
                      <button 
                        onClick={() => {
                          const guide = fullscreenData.images[fullscreenData.currentIndex].productionGuide;
                          if (guide) {
                            if (guide.coreProduction) setCoreProductionPrompt(guide.coreProduction);
                            if (guide.cameraComposition) setCameraCompositionPrompt(guide.cameraComposition);
                            if (guide.setBackground) setSetBackgroundPrompt(guide.setBackground);
                            if (guide.lightingMood) setLightingMoodPrompt(guide.lightingMood);
                            if (guide.textureTechnical) setTextureTechnicalPrompt(guide.textureTechnical);
                            const text = `Core Production: ${guide.coreProduction || ''}\nCamera & Composition: ${guide.cameraComposition || ''}\nSet & Background: ${guide.setBackground || ''}\nLighting & Mood: ${guide.lightingMood || ''}\nTexture & Technical: ${guide.textureTechnical || ''}`;
                            navigator.clipboard.writeText(text);
                            showToast('All guides applied and copied');
                          }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                      >
                        <ArrowPathIcon className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase tracking-tighter">Apply All</span>
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
                      {[
                        { label: 'Core Production', text: fullscreenData.images[fullscreenData.currentIndex].productionGuide?.coreProduction, setter: setCoreProductionPrompt },
                        { label: 'Camera & Composition', text: fullscreenData.images[fullscreenData.currentIndex].productionGuide?.cameraComposition, setter: setCameraCompositionPrompt },
                        { label: 'Set & Background', text: fullscreenData.images[fullscreenData.currentIndex].productionGuide?.setBackground, setter: setSetBackgroundPrompt },
                        { label: 'Lighting & Mood', text: fullscreenData.images[fullscreenData.currentIndex].productionGuide?.lightingMood, setter: setLightingMoodPrompt },
                        { label: 'Texture & Technical', text: fullscreenData.images[fullscreenData.currentIndex].productionGuide?.textureTechnical, setter: setTextureTechnicalPrompt },
                      ].map((guide, i) => guide.text && (
                        <div key={i} className="flex flex-col gap-2 group/item">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-3 bg-indigo-500/50 rounded-full" />
                              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-500">{guide.label}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  if (guide.text) {
                                    navigator.clipboard.writeText(guide.text);
                                    showToast(`${guide.label} copied`);
                                  }
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                              >
                                <ClipboardIcon className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (guide.text) {
                                    guide.setter(guide.text);
                                    showToast(`${guide.label} applied`);
                                  }
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                              >
                                <ArrowPathIcon className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p 
                            onClick={() => {
                              setExpandedGuideIndices(prev => 
                                prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i]
                              );
                            }}
                            className={`text-[10px] text-slate-300 leading-relaxed transition-all cursor-pointer hover:text-white bg-white/5 p-3 rounded-xl border border-white/5 ${expandedGuideIndices.includes(i) ? '' : 'line-clamp-3'}`}
                          >
                            {guide.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

      <nav className="z-50 glass-card border-b border-white/5 px-6 py-2.5 flex items-center shrink-0">
        <div className="flex-1 flex items-center gap-3">
          <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-500/20"><SparklesIcon className="w-4 h-4 text-white" /></div>
          <div><h1 className="text-base font-black tracking-tight text-white uppercase">AdVision Pro</h1><p className="text-[8px] uppercase tracking-[0.3em] text-slate-600 font-bold">V3.0 Mastering</p></div>
        </div>
        <div className="flex-none flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
          {['synthesis', 'atmosphere'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as TabKey)} className={`px-8 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-600 hover:text-slate-400'}`}>{tab === 'synthesis' ? 'Blend' : 'Intensity'}</button>
          ))}
        </div>
        <div className="flex-1 flex justify-end gap-4">
          {guestPin && (
            <div className="text-[10px] font-black text-slate-400 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => { setModalMode('pin'); setShowGuestModal(true); }} title="Click to change Guest ID">
              <UserIcon className="w-4 h-4 text-indigo-400" /> GUEST: {guestPin}
            </div>
          )}
          {!guestPin && (
            <div className="text-[10px] font-black text-slate-400 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => { setModalMode('pin'); setShowGuestModal(true); }} title="Click to login as Guest">
              <UserIcon className="w-4 h-4 text-slate-500" /> LOGIN GUEST
            </div>
          )}
          <div 
            className={`text-[10px] font-black flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${hasApiKey ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20' : 'text-slate-400 bg-white/5 border-white/10 hover:bg-white/10'}`}
            onClick={handleOpenKeyDialog}
            title={hasApiKey ? "Change API Key" : "Connect API Key for Pro Models"}
          >
            {hasApiKey ? (
              <><CheckBadgeIcon className="w-4 h-4" /> PRO MODEL ACTIVE</>
            ) : (
              <><KeyIcon className="w-4 h-4" /> CONNECT API KEY</>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {activeTab === 'synthesis' ? (
          <BlendTab
            inputImage={blendInputImage} setInputImage={setBlendInputImage} outputImage={blendOutputImage} status={status} isAnalyzing={isAnalyzing} history={synthesisHistory} setHistory={setSynthesisHistory} categorizedProducts={categorizedProducts} setCategorizedProducts={setCategorizedProducts} 
            coreProductionPrompt={coreProductionPrompt} setCoreProductionPrompt={setCoreProductionPrompt}
            cameraCompositionPrompt={cameraCompositionPrompt} setCameraCompositionPrompt={setCameraCompositionPrompt}
            setBackgroundPrompt={setBackgroundPrompt} setSetBackgroundPrompt={setSetBackgroundPrompt}
            lightingMoodPrompt={lightingMoodPrompt} setLightingMoodPrompt={setLightingMoodPrompt}
            textureTechnicalPrompt={textureTechnicalPrompt} setTextureTechnicalPrompt={setTextureTechnicalPrompt}
            selectedRatio={selectedRatio} setSelectedRatio={setSelectedRatio} selectedQuality={selectedQuality} setSelectedQuality={setSelectedQuality} selectedCount={selectedCount} setSelectedCount={setSelectedCount} processEditing={processEditing} downloadImage={downloadImage} onSelectHistory={(idx) => setFullscreenData({ images: synthesisHistory.map(h => ({ url: h.generatedImage, original: h.originalImage, ratio: h.ratio, productionGuide: h.productionGuide })), currentIndex: idx })} onTransferToIntensity={useAsIntensityRef} handleFileUpload={handleFileUpload} handleDropUpload={handleDropUpload} onClearCategory={handleClearCategory} onOpenFullscreen={async (url, original, initial, productionGuide) => { const {ratio} = await getImageDimensions(url); setFullscreenData({ images: [{ url, original, initial, ratio, productionGuide }], currentIndex: 0 }); }}
          />
        ) : (
          <IntensityTab
            inputImage={intensityInputImage} setInputImage={setIntensityInputImage} 
            initialImage={intensityInitialImage} setInitialImage={setIntensityInitialImage}
            outputImage={intensityOutputImage} status={status} history={atmosphereHistory} setHistory={setAtmosphereHistory} selectedRatio={selectedRatio} setSelectedRatio={setSelectedRatio} selectedQuality={selectedQuality} setSelectedQuality={setSelectedQuality} selectedCount={selectedCount} setSelectedCount={setSelectedCount} 
            params={intensityParams} setParams={setIntensityParams}
            processAdjustment={processAdjustment} processWhiteBalance={processWhiteBalance} resetIntensityParams={resetIntensityParams} downloadImage={downloadImage} handleFileUpload={handleFileUpload} handleDropUpload={handleDropUpload} onSelectHistory={(idx) => setFullscreenData({ images: atmosphereHistory.map(h => ({ url: h.generatedImage, original: h.originalImage, ratio: h.ratio, initial: intensityInitialImage || undefined })), currentIndex: idx })} onOpenFullscreen={async (url, original, initial) => { const {ratio} = await getImageDimensions(url); setFullscreenData({ images: [{ url, original, initial, ratio }], currentIndex: 0 }); }} onTransferToInput={(url) => { setIntensityInputImage(url); if (!intensityInitialImage) setIntensityInitialImage(url); }}
          />
        )}
      </main>
      <footer className="py-2 border-t border-white/5 text-center opacity-10 shrink-0"><p className="text-[8px] font-black uppercase tracking-[1em]">SYSTEM STABLE</p></footer>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-3 ${
            toast.type === 'success' 
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
              : toast.type === 'error'
              ? 'bg-red-500/20 border-red-500/30 text-red-400'
              : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
          }`}>
            {toast.type === 'success' ? <CheckBadgeIcon className="w-5 h-5" /> : toast.type === 'error' ? <XCircleIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
