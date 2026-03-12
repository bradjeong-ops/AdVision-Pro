
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  SparklesIcon, 
  ArrowPathIcon, 
  CheckBadgeIcon, 
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  UserIcon,
  KeyIcon
} from './components/Icons';
import { AppStatus, GenerationRecord } from './types';
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
  isAnalyzing: boolean;
}

const BASE_SYNTHESIS_PROMPT = 'Professional Studio Master Asset: Identity Library의 각 MODEL을 정체성 훼손 없이 완벽히 합성하십시오. Hasselblad 중형 카메라 촬영급의 초고해상도 디테일(Sharp texture, Natural skin pores, No artifacts)을 구현하십시오. 특히 양쪽 눈의 시선 방향과 동공의 대칭성을 수학적으로 정밀하게 맞추어 부자연스러운 시선을 원천 차단하십시오. 모든 의상과 신발 라이브러리를 실제 상업 광고 수준의 무결성으로 렌더링하십시오.';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('synthesis');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [fullscreenData, setFullscreenData] = useState<{
    images: {url: string, original?: string}[],
    currentIndex: number
  } | null>(null);
  
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  
  const [blendInputImage, setBlendInputImage] = useState<string | null>(null);
  const [blendOutputImage, setBlendOutputImage] = useState<string | null>(null);
  const [synthesisHistory, setSynthesisHistory] = useState<GenerationRecord[]>([]);
  
  const [intensityInputImage, setIntensityInputImage] = useState<string | null>(null);
  const [intensityOutputImage, setIntensityOutputImage] = useState<string | null>(null);
  const [atmosphereHistory, setAtmosphereHistory] = useState<GenerationRecord[]>([]);

  const [selectedMood, setSelectedMood] = useState('DAWN');
  const [selectedGrading, setSelectedGrading] = useState('FILM');

  const [selectedQuality, setSelectedQuality] = useState<ImageQuality>("2K");
  const [selectedCount, setSelectedCount] = useState<number>(1);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [categorizedProducts, setCategorizedProducts] = useState<Record<CategoryKey, CategoryData>>({
    id1: { mains: { front: null, side: null, back: null, face: null }, details: [], isAnalyzing: false },
    id2: { mains: { front: null, side: null, back: null, face: null }, details: [], isAnalyzing: false },
    other: { mains: { front: null, side: null, back: null, face: null }, details: [], isAnalyzing: false }
  });

  const [overallPrompt, setOverallPrompt] = useState(BASE_SYNTHESIS_PROMPT);
  const [lightingPrompt, setLightingPrompt] = useState('');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [moodPrompt, setMoodPrompt] = useState('');
  const [selectedRatio, setSelectedRatio] = useState<AllowedAspectRatio>("9:16");
  const [isFullscreenComparing, setIsFullscreenComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [guestPin, setGuestPin] = useState<string | null>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

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
            if (options.type === 'main' && options.view) newData.mains = { ...newData.mains, [options.view]: result };
            else if (options.type === 'detail') newData.details = [...newData.details, result];
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
              setOverallPrompt(`${BASE_SYNTHESIS_PROMPT}\n\n[OVERALL ANALYSIS]\n${analysis.overall}`);
              setLightingPrompt(analysis.lighting);
              setBackgroundPrompt(analysis.background);
              setMoodPrompt(analysis.mood);
            } catch (err) { console.error(err); } finally { setIsAnalyzing(false); }
          } else { setIntensityInputImage(result); setIntensityOutputImage(null); }
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
    try {
      await getAIStudio().openSelectKey();
      setHasApiKey(true);
      setError(null);
    } catch (e) {
      console.error("AI Studio key selection failed, showing manual input modal", e);
      setShowGuestModal(true);
    }
  };

  const handleClearCategory = useCallback((category: CategoryKey) => {
    setCategorizedProducts(prev => ({
      ...prev,
      [category]: { mains: { front: null, side: null, back: null, face: null }, details: [], isAnalyzing: false }
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
      [OVERALL_GUIDE]: ${overallPrompt}
      [LIGHTING_GUIDE]: ${lightingPrompt}
      [BACKGROUND_GUIDE]: ${backgroundPrompt}
      [MOOD_GUIDE]: ${moodPrompt}
    `.trim();

    if (!combinedPrompt) return;
    if (!hasApiKey) { await handleOpenKeyDialog(); return; }
    setStatus(AppStatus.GENERATING);
    setError(null);
    try {
      const categoriesPayload: CategorizedProduct[] = (Object.entries(categorizedProducts) as [string, CategoryData][]).map(([key, val]) => ({
        category: key, mains: val.mains, details: val.details
      }));
      const results = await generateProductEdit(blendInputImage, categoriesPayload, combinedPrompt, selectedRatio, selectedQuality, selectedCount);
      if (results.length > 0) {
        setBlendOutputImage(results[0]);
        const newRecords: GenerationRecord[] = await Promise.all(results.map(async (url, idx) => {
          const { ratio } = await getImageDimensions(url);
          return { id: `${Date.now()}-${idx}`, originalImage: blendInputImage || '', generatedImage: url, prompt: `${combinedPrompt}`, timestamp: Date.now(), ratio };
        }));
        setSynthesisHistory(prev => [...newRecords, ...prev].slice(0, 20));
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

  const processAdjustment = async (customMood?: string, customDetail?: string) => {
    if (!intensityInputImage) return;
    if (!hasApiKey) { await handleOpenKeyDialog(); return; }
    setStatus(AppStatus.GENERATING);
    setError(null);
    try {
      const results = await adjustAtmosphere(intensityInputImage, customMood || selectedMood, customDetail || selectedGrading, selectedRatio, selectedQuality, selectedCount);
      if (results.length > 0) {
        setIntensityOutputImage(results[0]);
        const newRecords: GenerationRecord[] = await Promise.all(results.map(async (url, idx) => {
          const { ratio } = await getImageDimensions(url);
          return { id: `${Date.now()}-${idx}`, originalImage: intensityInputImage, generatedImage: url, prompt: `Mastering: ${customMood}`, timestamp: Date.now(), ratio };
        }));
        setAtmosphereHistory(prev => [...newRecords, ...prev].slice(0, 20));
        setStatus(AppStatus.IDLE);
      } else throw new Error("이미지 없음");
    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      setError(err.message || "Adjustment failed.");
    }
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
        setAtmosphereHistory(prev => [newRecord, ...prev].slice(0, 20));
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

      {showGuestModal && <GuestLoginModal onLogin={handleGuestLogin} onClose={guestPin && hasApiKey ? () => setShowGuestModal(false) : undefined} requireApiKey={!hasApiKey} initialPin={guestPin || ''} />}

      {fullscreenData && (
        <div 
          className="fixed inset-0 z-[150] bg-black/98 flex items-center justify-center backdrop-blur-3xl overflow-hidden" 
          onClick={() => { setFullscreenData(null); setIsFullscreenComparing(false); setZoom(1); setPan({ x: 0, y: 0 }); }}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer group flex items-center justify-start pl-8" onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}>
             <div className="p-4 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all border border-white/10 backdrop-blur-md"><ChevronLeftIcon className="w-10 h-10 text-white" /></div>
          </div>
          <div className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer group flex items-center justify-end pr-8" onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}>
             <div className="p-4 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all border border-white/10 backdrop-blur-md"><ChevronRightIcon className="w-10 h-10 text-white" /></div>
          </div>
          <div 
            className={`relative w-full h-full flex items-center justify-center p-8 select-none transition-transform duration-200 ${zoom > 1 ? 'cursor-move' : ''}`} 
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
          >
            <img 
              src={isFullscreenComparing ? fullscreenData.images[fullscreenData.currentIndex].original || fullscreenData.images[fullscreenData.currentIndex].url : fullscreenData.images[fullscreenData.currentIndex].url} 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl transition-transform duration-200 ease-out" 
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                pointerEvents: zoom > 1 ? 'none' : 'auto'
              }}
            />
            <div className="absolute top-8 right-8 flex items-center gap-4 z-20">
               {fullscreenData.images[fullscreenData.currentIndex].original && (
                 <button 
                   onMouseDown={(e) => { e.stopPropagation(); setIsFullscreenComparing(true); }} 
                   onMouseUp={(e) => { e.stopPropagation(); setIsFullscreenComparing(false); }} 
                   onMouseLeave={(e) => { e.stopPropagation(); setIsFullscreenComparing(false); }}
                   className={`p-3 rounded-full transition-all shadow-2xl border border-white/10 ${isFullscreenComparing ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-indigo-600'}`}
                   onClick={(e) => e.stopPropagation()}
                   title="Hold to Compare"
                 >
                   <ArrowPathIcon className="w-6 h-6" />
                 </button>
               )}
               <button onClick={() => { setFullscreenData(null); setIsFullscreenComparing(false); setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-3 bg-white/10 rounded-full text-white hover:bg-red-600 transition-all shadow-2xl border border-white/10"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            {zoom > 1 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest pointer-events-none">
                Zoom: {Math.round(zoom * 100)}% | Drag to Pan
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
            <div className="text-[10px] font-black text-slate-400 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setShowGuestModal(true)} title="Click to change Guest ID">
              <UserIcon className="w-4 h-4 text-indigo-400" /> GUEST: {guestPin}
            </div>
          )}
          {!guestPin && (
            <div className="text-[10px] font-black text-slate-400 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setShowGuestModal(true)} title="Click to login as Guest">
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
            overallPrompt={overallPrompt} setOverallPrompt={setOverallPrompt}
            lightingPrompt={lightingPrompt} setLightingPrompt={setLightingPrompt}
            backgroundPrompt={backgroundPrompt} setBackgroundPrompt={setBackgroundPrompt}
            moodPrompt={moodPrompt} setMoodPrompt={setMoodPrompt}
            selectedRatio={selectedRatio} setSelectedRatio={setSelectedRatio} selectedQuality={selectedQuality} setSelectedQuality={setSelectedQuality} selectedCount={selectedCount} setSelectedCount={setSelectedCount} processEditing={processEditing} downloadImage={downloadImage} onSelectHistory={(idx) => setFullscreenData({ images: synthesisHistory.map(h => ({ url: h.generatedImage, original: h.originalImage })), currentIndex: idx })} onTransferToIntensity={useAsIntensityRef} handleFileUpload={handleFileUpload} handleDropUpload={handleDropUpload} onClearCategory={handleClearCategory} onOpenFullscreen={(url, original) => setFullscreenData({ images: [{ url, original }], currentIndex: 0 })}
          />
        ) : (
          <IntensityTab
            inputImage={intensityInputImage} setInputImage={setIntensityInputImage} outputImage={intensityOutputImage} status={status} history={atmosphereHistory} setHistory={setAtmosphereHistory} selectedRatio={selectedRatio} setSelectedRatio={setSelectedRatio} selectedQuality={selectedQuality} setSelectedQuality={setSelectedQuality} selectedCount={selectedCount} setSelectedCount={setSelectedCount} processAdjustment={processAdjustment} processWhiteBalance={processWhiteBalance} downloadImage={downloadImage} handleFileUpload={handleFileUpload} handleDropUpload={handleDropUpload} onSelectHistory={(idx) => setFullscreenData({ images: atmosphereHistory.map(h => ({ url: h.generatedImage, original: h.originalImage })), currentIndex: idx })} onOpenFullscreen={(url, original) => setFullscreenData({ images: [{ url, original }], currentIndex: 0 })} onTransferToInput={(url) => setIntensityInputImage(url)}
          />
        )}
      </main>
      <footer className="py-2 border-t border-white/5 text-center opacity-10 shrink-0"><p className="text-[8px] font-black uppercase tracking-[1em]">SYSTEM STABLE</p></footer>
    </div>
  );
};

export default App;
