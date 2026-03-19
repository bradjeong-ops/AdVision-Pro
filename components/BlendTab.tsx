
import React, { useRef } from 'react';
import { 
  CloudArrowUpIcon, 
  TrashIcon, 
  SparklesIcon, 
  ArrowDownTrayIcon, 
  ArrowPathIcon, 
  CameraIcon, 
  HistoryIcon,
  ArrowsPointingOutIcon,
  CheckBadgeIcon
} from './Icons';
import CategorySection from './CategorySection';
import HistoryPanel from './HistoryPanel';
import { AppStatus, GenerationRecord } from '../types';
import { AllowedAspectRatio, ImageQuality } from '../services/gemini';

interface BlendTabProps {
  language: 'en' | 'ko';
  onLanguageToggle: (lang: 'en' | 'ko') => void;
  inputImage: string | null;
  setInputImage: (img: string | null) => void;
  outputImage: string | null;
  status: AppStatus;
  isAnalyzing: boolean;
  history: GenerationRecord[];
  setHistory: React.Dispatch<React.SetStateAction<GenerationRecord[]>>;
  categorizedProducts: any;
  setCategorizedProducts: any;
  coreProductionPrompt: string;
  setCoreProductionPrompt: (p: string) => void;
  cameraCompositionPrompt: string;
  setCameraCompositionPrompt: (p: string) => void;
  setBackgroundPrompt: string;
  setSetBackgroundPrompt: (p: string) => void;
  lightingMoodPrompt: string;
  setLightingMoodPrompt: (p: string) => void;
  textureTechnicalPrompt: string;
  setTextureTechnicalPrompt: (p: string) => void;
  selectedRatio: AllowedAspectRatio;
  setSelectedRatio: (r: AllowedAspectRatio) => void;
  selectedQuality: ImageQuality;
  setSelectedQuality: (q: ImageQuality) => void;
  selectedCount: number;
  setSelectedCount: (c: number) => void;
  processEditing: () => void;
  downloadImage: (url: string, filename: string) => void;
  onSelectHistory: (idx: number) => void;
  onTransferToIntensity: (url: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, options?: any) => void;
  handleDropUpload: (e: React.DragEvent<HTMLDivElement>, options?: any) => void;
  onClearCategory: (cat: any) => void;
  onOpenFullscreen: (url: string, original?: string, initial?: string, productionGuide?: any) => void;
}

const BlendTab: React.FC<BlendTabProps> = ({
  language, onLanguageToggle,
  inputImage, setInputImage, outputImage, status, isAnalyzing, history, setHistory,
  categorizedProducts, setCategorizedProducts, 
  coreProductionPrompt, setCoreProductionPrompt,
  cameraCompositionPrompt, setCameraCompositionPrompt,
  setBackgroundPrompt, setSetBackgroundPrompt,
  lightingMoodPrompt, setLightingMoodPrompt,
  textureTechnicalPrompt, setTextureTechnicalPrompt,
  selectedRatio, setSelectedRatio, selectedQuality, setSelectedQuality,
  selectedCount, setSelectedCount, processEditing, downloadImage,
  onSelectHistory, onTransferToIntensity, handleFileUpload, handleDropUpload, onClearCategory,
  onOpenFullscreen
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isComparing, setIsComparing] = React.useState(false);

  const id1Refs = { front: useRef<HTMLInputElement>(null), side: useRef<HTMLInputElement>(null), back: useRef<HTMLInputElement>(null), face: useRef<HTMLInputElement>(null), detail: useRef<HTMLInputElement>(null) };
  const id2Refs = { front: useRef<HTMLInputElement>(null), side: useRef<HTMLInputElement>(null), back: useRef<HTMLInputElement>(null), face: useRef<HTMLInputElement>(null), detail: useRef<HTMLInputElement>(null) };
  const otherRefs = { front: useRef<HTMLInputElement>(null), side: useRef<HTMLInputElement>(null), back: useRef<HTMLInputElement>(null), face: useRef<HTMLInputElement>(null), detail: useRef<HTMLInputElement>(null) };

  return (
    <div className="flex-1 grid grid-cols-12 gap-5 overflow-hidden">
      <div className="col-span-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Reference Image</label>
            <div 
              className={`relative flex items-center justify-center bg-black/40 rounded-3xl border-2 border-dashed overflow-hidden group h-[520px] transition-all duration-300 cursor-pointer border-white/5 hover:border-indigo-500/50`} 
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => handleDropUpload(e, { type: 'reference' })}
              onClick={() => fileInputRef.current?.click()}
            >
              {inputImage ? (
                <><img src={inputImage} className="w-full h-full object-contain" /><button onClick={(e) => { e.stopPropagation(); setInputImage(null); }} className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full text-white/50 hover:text-white hover:bg-red-600 transition-all flex items-center justify-center border border-white/10"><TrashIcon className="w-5 h-5" /></button></>
              ) : (
                <div className="flex items-center justify-center h-full w-full opacity-20 group-hover:opacity-100 transition-opacity">
                  <div className="flex flex-col items-center gap-4">
                    <CloudArrowUpIcon className="w-16 h-16" />
                    <span className="text-xs font-black uppercase tracking-widest">Upload Reference Scene</span>
                  </div>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, { type: 'reference' })} className="hidden" />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">CREATION</label>
            <div 
              className={`relative flex items-center justify-center bg-black/60 rounded-3xl border-2 border-white/5 overflow-hidden h-[520px] shadow-2xl group ${outputImage ? 'cursor-zoom-in' : ''}`}
              onClick={() => outputImage && !isComparing && onOpenFullscreen(outputImage, inputImage || undefined, undefined, {
                coreProduction: coreProductionPrompt,
                cameraComposition: cameraCompositionPrompt,
                setBackground: setBackgroundPrompt,
                lightingMood: lightingMoodPrompt,
                textureTechnical: textureTechnicalPrompt
              })}
            >
              {outputImage ? (
                <>
                  <img src={isComparing ? inputImage! : outputImage} className="w-full h-full object-contain" />
                  <div className="absolute top-4 right-4 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onOpenFullscreen(outputImage, inputImage || undefined, undefined, {
                      coreProduction: coreProductionPrompt,
                      cameraComposition: cameraCompositionPrompt,
                      setBackground: setBackgroundPrompt,
                      lightingMood: lightingMoodPrompt,
                      textureTechnical: textureTechnicalPrompt
                    })} className="w-10 h-10 bg-black/60 rounded-full text-white hover:bg-blue-600 flex items-center justify-center border border-white/10" title="Maximize & Compare">
                      <ArrowsPointingOutIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onTransferToIntensity(outputImage)} className="w-10 h-10 bg-black/60 rounded-full text-emerald-400 hover:text-white hover:bg-emerald-600 flex items-center justify-center border border-white/10" title="Transfer to Intensity">
                      <SparklesIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => downloadImage(outputImage, 'AdvisionPro_Generated_Image.png')} className="w-10 h-10 bg-black/60 rounded-full text-white hover:bg-indigo-600 flex items-center justify-center border border-white/10" title="Download">
                      <ArrowDownTrayIcon className="w-5 h-5" />
                    </button>
                    <button onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border border-white/10 ${isComparing ? 'bg-white text-black' : 'bg-black/60 text-white'}`} title="Compare">
                      <ArrowPathIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-indigo-600/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-xl">
                      <CheckBadgeIcon className="w-4 h-4 text-white" />
                      <span className="text-[9px] font-black text-white uppercase tracking-widest">Pose Sync Lock: 1:1 ACTIVE</span>
                    </div>
                  </div>
                </>
              ) : <div className="flex flex-col items-center gap-4 opacity-10"><SparklesIcon className="w-16 h-16" /><span className="text-xs font-black uppercase tracking-widest">Awaiting Pose-Synced Synthesis</span></div>}
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-3xl flex flex-col gap-5 border border-white/5 shadow-2xl">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">PRODUCTION GUIDE</h3>
                {isAnalyzing && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full animate-pulse">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">AI Scene Analyzing...</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 mr-2">
                  <button onClick={() => onLanguageToggle('en')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${language === 'en' ? "bg-indigo-600 text-white shadow-xl" : "text-slate-600 hover:text-slate-400"}`}>EN</button>
                  <button onClick={() => onLanguageToggle('ko')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${language === 'ko' ? "bg-indigo-600 text-white shadow-xl" : "text-slate-600 hover:text-slate-400"}`}>KO</button>
                </div>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                  {["9:16", "3:4", "16:9"].map(r => (
                    <button key={r} onClick={() => setSelectedRatio(r as AllowedAspectRatio)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedRatio === r ? "bg-indigo-600 text-white shadow-xl" : "text-slate-600 hover:text-slate-400"}`}>{r}</button>
                  ))}
                </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 col-span-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Core Production (Overall)</label>
              <textarea 
                value={coreProductionPrompt} 
                onChange={(e) => setCoreProductionPrompt(e.target.value)} 
                disabled={isAnalyzing}
                placeholder="Enter core production guide (theme, style)..."
                className={`w-full h-20 bg-black/60 border border-white/5 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 ring-indigo-500/20 outline-none transition-all resize-none custom-scrollbar ${isAnalyzing ? 'opacity-50 cursor-wait' : ''}`} 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Camera & Composition</label>
              <textarea 
                value={cameraCompositionPrompt} 
                onChange={(e) => setCameraCompositionPrompt(e.target.value)} 
                disabled={isAnalyzing}
                placeholder="Enter camera settings and composition..."
                className={`w-full h-24 bg-black/60 border border-white/5 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 ring-indigo-500/20 outline-none transition-all resize-none custom-scrollbar ${isAnalyzing ? 'opacity-50 cursor-wait' : ''}`} 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Lighting & Mood</label>
              <textarea 
                value={lightingMoodPrompt} 
                onChange={(e) => setLightingMoodPrompt(e.target.value)} 
                disabled={isAnalyzing}
                placeholder="Enter lighting and atmosphere guide..."
                className={`w-full h-24 bg-black/60 border border-white/5 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 ring-indigo-500/20 outline-none transition-all resize-none custom-scrollbar ${isAnalyzing ? 'opacity-50 cursor-wait' : ''}`} 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Set & Background</label>
              <textarea 
                value={setBackgroundPrompt} 
                onChange={(e) => setSetBackgroundPrompt(e.target.value)} 
                disabled={isAnalyzing}
                placeholder="Enter set design and background details..."
                className={`w-full h-24 bg-black/60 border border-white/5 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 ring-indigo-500/20 outline-none transition-all resize-none custom-scrollbar ${isAnalyzing ? 'opacity-50 cursor-wait' : ''}`} 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Texture & Technical</label>
              <textarea 
                value={textureTechnicalPrompt} 
                onChange={(e) => setTextureTechnicalPrompt(e.target.value)} 
                disabled={isAnalyzing}
                placeholder="Enter texture and technical details..."
                className={`w-full h-24 bg-black/60 border border-white/5 rounded-2xl p-4 text-xs font-mono text-indigo-300 focus:ring-2 ring-indigo-500/20 outline-none transition-all resize-none custom-scrollbar ${isAnalyzing ? 'opacity-50 cursor-wait' : ''}`} 
              />
            </div>
           </div>

           <div className="flex flex-wrap gap-6 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Render Quality</label>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                  {["1K", "2K", "4K"].map(q => (
                    <button key={q} onClick={() => setSelectedQuality(q as ImageQuality)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedQuality === q ? "bg-indigo-600 text-white shadow-xl" : "text-slate-600 hover:text-slate-400"}`}>{q}</button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Batch Count</label>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                  {[1, 2, 3, 4].map(c => (
                    <button key={c} onClick={() => setSelectedCount(c)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedCount === c ? "bg-indigo-600 text-white shadow-xl" : "text-slate-600 hover:text-slate-400"}`}>{c}</button>
                  ))}
                </div>
              </div>

              <div className="flex-1">
                <button 
                  disabled={status === AppStatus.GENERATING || isAnalyzing} 
                  onClick={processEditing} 
                  className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.4em] text-base transition-all shadow-[0_0_40px_rgba(79,70,229,0.3)] flex items-center justify-center gap-3 group ${
                    status === AppStatus.GENERATING || isAnalyzing 
                      ? 'bg-slate-900 text-slate-700 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white hover:scale-[1.02] active:scale-95 hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] border border-white/20'
                  }`}
                >
                  {status === AppStatus.GENERATING ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>생성 중...</span>
                    </>
                  ) : isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
                      <span>분석 중...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5 group-hover:animate-pulse" />
                      <span>GENERATE</span>
                    </>
                  )}
                </button>
              </div>
           </div>

           <div className="flex items-center gap-2 px-2 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Structural Fidelity & Multi-Batch Rendering: READY
           </div>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-white/5 mt-4">
          <div className="flex items-center gap-2 mb-6"><HistoryIcon className="w-4 h-4 text-indigo-400" /><h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">HISTORY</h3></div>
          <HistoryPanel data={history} onRemove={(id) => setHistory(p => p.filter(x => x.id !== id))} onSelect={onSelectHistory} downloadImage={downloadImage} showTransfer onTransfer={onTransferToIntensity} />
        </div>
      </div>

      <div className="col-span-4 h-full overflow-hidden flex flex-col">
        <div className="bg-[#0f141e] rounded-[40px] border border-white/5 shadow-2xl flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-8 py-6 border-b border-white/5 shrink-0">
            <CameraIcon className="w-5 h-5 text-indigo-400" />
            <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-300">Model&Item</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <CategorySection title="MODEL #1" category="id1" categorizedProducts={categorizedProducts} setCategorizedProducts={setCategorizedProducts} frontInputRef={id1Refs.front} sideInputRef={id1Refs.side} backInputRef={id1Refs.back} faceInputRef={id1Refs.face} detailInputRef={id1Refs.detail} handleFileUpload={handleFileUpload} handleDropUpload={handleDropUpload} onClear={onClearCategory} />
            <CategorySection title="MODEL #2" category="id2" categorizedProducts={categorizedProducts} setCategorizedProducts={setCategorizedProducts} frontInputRef={id2Refs.front} sideInputRef={id2Refs.side} backInputRef={id2Refs.back} faceInputRef={id2Refs.face} detailInputRef={id2Refs.detail} handleFileUpload={handleFileUpload} handleDropUpload={handleDropUpload} onClear={onClearCategory} />
            <CategorySection title="PROPS" category="other" categorizedProducts={categorizedProducts} setCategorizedProducts={setCategorizedProducts} frontInputRef={otherRefs.front} sideInputRef={otherRefs.side} backInputRef={otherRefs.back} faceInputRef={otherRefs.face} detailInputRef={otherRefs.detail} handleFileUpload={handleFileUpload} handleDropUpload={handleDropUpload} onClear={onClearCategory} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlendTab;
