
import React, { useRef, useState } from 'react';
import { 
  CloudArrowUpIcon, 
  TrashIcon, 
  SparklesIcon, 
  ArrowDownTrayIcon, 
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  HistoryIcon,
  ChevronRightIcon
} from './Icons';
import { AppStatus, GenerationRecord } from '../types';
import { AllowedAspectRatio, ImageQuality } from '../services/gemini';
import HistoryPanel from './HistoryPanel';

const WORKFLOW_STEPS = [
  { id: 'color', name: 'Correction', icon: '🎨', label: 'Step 1: 색감 및 보정' },
  { id: 'lighting', name: 'Lighting', icon: '💡', label: 'Step 2: 환경 및 조명' },
  { id: 'texture', name: 'Texturing', icon: '🔍', label: 'Step 3: 질감 및 디테일' },
  { id: 'grading', name: 'Mastering', icon: '🎬', label: 'Step 4: 최종 그레이딩' },
];

const INTENSITY_OPTIONS: Record<string, any[]> = {
  color: [
    { 
      group: 'Essentials', 
      items: [{ id: 'None', name: 'None', description: 'No color adjustment' }] 
    },
    { 
      group: 'Cinematic', 
      items: [{ id: 'Teal & Orange', name: 'Teal & Orange', description: '시네마틱한 대비의 보색 대비' }] 
    },
    { 
      group: 'Temperature', 
      items: [
        { id: 'Warm Tone', name: 'Warm Tone', description: '따뜻하고 포근한 색감' },
        { id: 'Cool Tone', name: 'Cool Tone', description: '차갑고 세련된 도시적 색감' }
      ] 
    },
    { 
      group: 'Saturation', 
      items: [
        { id: 'Vivid', name: 'Vivid', description: '생동감 넘치는 고채도 보정' },
        { id: 'Muted', name: 'Muted', description: '차분하고 절제된 저채도 보정' }
      ] 
    }
  ],
  lighting: [
    { 
      group: 'Essentials', 
      items: [{ id: 'None', name: 'None', description: 'No lighting adjustment' }] 
    },
    { 
      group: 'Atmospheric', 
      items: [
        { id: 'Backlit', name: 'Backlit', description: '피사체 뒤에서 비치는 역광 효과' },
        { id: 'Golden Hour', name: 'Golden Hour', description: '석양의 황금빛 조명' }
      ] 
    },
    { 
      group: 'Quality', 
      items: [
        { id: 'Diffused', name: 'Diffused', description: '부드럽게 퍼지는 산란광' },
        { id: 'Soft Shadows', name: 'Soft Shadows', description: '부드러운 그림자 처리' }
      ] 
    },
    { 
      group: 'Intensity', 
      items: [{ id: 'High Contrast', name: 'High Contrast', description: '강렬한 명암 대비' }] 
    }
  ],
  texture: [
    { 
      group: 'Essentials', 
      items: [{ id: 'None', name: 'None', description: 'No texture adjustment' }] 
    },
    { 
      group: 'Surface', 
      items: [
        { id: 'Glossy', name: 'Glossy', description: '금속 및 유리의 매끄러운 광택' },
        { id: 'Soft Touch', name: 'Soft Touch', description: '패브릭의 부드러운 질감' }
      ] 
    },
    { 
      group: 'Definition', 
      items: [
        { id: 'Sharp Detail', name: 'Sharp Detail', description: '선명한 디테일 강화' },
        { id: 'Hasselblad Look', name: 'Hasselblad Look', description: '중형 카메라 특유의 고해상도 질감' }
      ] 
    }
  ],
  grading: [
    { 
      group: 'Essentials', 
      items: [
        { id: 'None', name: 'None', description: 'No grading adjustment' },
        { id: 'Neutral Clean', name: 'Neutral Clean', description: '색 왜곡 없는 깨끗하고 선명한 상업용 룩' },
      ]
    },
    { 
      group: 'Film Looks', 
      items: [
        { id: 'Kodak Style', name: 'Kodak Style', description: '클래식 코닥 필름의 따뜻한 에뮬레이션' },
        { id: 'Fuji Style', name: 'Fuji Style', description: '청량하고 깨끗한 후지 필름 에뮬레이션' },
        { id: 'Ektachrome', name: 'Ektachrome', description: '선명한 블루와 높은 대비의 슬라이드 필름 룩' },
      ]
    },
    { 
      group: 'Modern Moods', 
      items: [
        { id: 'Cold Steel', name: 'Cold Steel', description: '차갑고 날카로운 금속성 블루 톤' },
        { id: 'Nordic Minimal', name: 'Nordic Minimal', description: '채도가 낮고 정갈한 북유럽 감성' },
        { id: 'Cyberpunk', name: 'Cyberpunk', description: '네온 컬러의 미래지향적 무드' },
      ]
    },
    { 
      group: 'Special Effects', 
      items: [
        { id: 'Noir', name: 'Noir', description: '깊이 있는 흑백 시네마틱 룩' },
        { id: 'Film Grain', name: 'Film Grain', description: '아날로그 잡지 느낌의 거친 입자' },
        { id: 'Vignette', name: 'Vignette', description: '주변부 광량 저하 효과' },
      ]
    }
  ]
};

interface IntensityTabProps {
  inputImage: string | null;
  setInputImage: (img: string | null) => void;
  initialImage: string | null;
  setInitialImage: (img: string | null) => void;
  outputImage: string | null;
  status: AppStatus;
  history: GenerationRecord[];
  setHistory: React.Dispatch<React.SetStateAction<GenerationRecord[]>>;
  selectedRatio: AllowedAspectRatio;
  setSelectedRatio: (r: AllowedAspectRatio) => void;
  selectedQuality: ImageQuality;
  setSelectedQuality: (q: ImageQuality) => void;
  selectedCount: number;
  setSelectedCount: (c: number) => void;
  params: {
    color: { selections: string[]; weight: number };
    lighting: { selections: string[]; weight: number };
    texture: { selections: string[]; weight: number };
    grading: { selections: string[]; weight: number };
  };
  setParams: React.Dispatch<React.SetStateAction<any>>;
  processAdjustment: (useInitial?: boolean) => void;
  processWhiteBalance: () => void;
  resetIntensityParams: () => void;
  downloadImage: (url: string, filename: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, options?: any) => void;
  handleDropUpload: (e: React.DragEvent<HTMLDivElement>, options?: any) => void;
  onSelectHistory: (idx: number) => void;
  onOpenFullscreen: (url: string, original?: string) => void;
  onTransferToInput: (url: string) => void;
}

const IntensityTab: React.FC<IntensityTabProps> = ({
  inputImage, setInputImage, initialImage, setInitialImage, outputImage, status, history, setHistory,
  selectedRatio, setSelectedRatio, selectedQuality, setSelectedQuality,
  selectedCount, setSelectedCount,
  params, setParams,
  processAdjustment, processWhiteBalance, resetIntensityParams, downloadImage, handleFileUpload, handleDropUpload,
  onSelectHistory, onOpenFullscreen, onTransferToInput
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeStep, setActiveStep] = useState<keyof typeof INTENSITY_OPTIONS>('color');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const updateParam = (key: keyof typeof params, value: any) => {
    setParams((prev: any) => {
      const current = prev[key];
      if (value.name) {
        if (value.name === 'None') {
          return { ...prev, [key]: { ...current, selections: [] } };
        }
        const exists = current.selections.includes(value.name);
        const newSelections = exists 
          ? current.selections.filter((s: string) => s !== value.name)
          : [...current.selections, value.name];
        return { ...prev, [key]: { ...current, selections: newSelections } };
      }
      return { ...prev, [key]: { ...current, ...value } };
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-in fade-in duration-500">
      {/* Top Section: Images */}
      <div className="flex gap-4 shrink-0 px-2 h-[42%] min-h-[380px]">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Reference Image</label>
          <div 
            className={`relative flex items-center justify-center bg-black/40 rounded-3xl border-2 border-dashed overflow-hidden h-full group transition-all duration-300 cursor-pointer border-white/5 hover:border-indigo-500/50`} 
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => handleDropUpload(e, { type: 'intensity' })}
            onClick={() => fileInputRef.current?.click()}
          >
            {inputImage ? (
              <>
                <img src={inputImage} className="w-full h-full object-contain" />
                <button onClick={(e) => { e.stopPropagation(); setInputImage(null); setInitialImage(null); }} className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full text-white/50 hover:text-white hover:bg-red-600 transition-all flex items-center justify-center border border-white/10">
                  <TrashIcon className="w-5 h-5" />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full w-full opacity-20 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-col items-center gap-4">
                  <CloudArrowUpIcon className="w-16 h-16" />
                  <span className="text-xs font-black uppercase tracking-widest">UPLOAD MASTERING TARGET</span>
                </div>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, { type: 'intensity' })} className="hidden" />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">CREATION</label>
          <div 
            className={`relative flex items-center justify-center bg-black/60 rounded-3xl border-2 border-white/5 overflow-hidden h-full shadow-2xl group ${outputImage ? 'cursor-zoom-in' : ''}`}
            onClick={() => outputImage && onOpenFullscreen(outputImage, inputImage || undefined, initialImage || undefined)}
          >
            {outputImage ? (
              <>
                <div className="relative w-full h-full bg-black">
                  <img src={outputImage} className="w-full h-full object-contain" />
                </div>
                <div className="absolute top-4 right-4 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onOpenFullscreen(outputImage, inputImage || undefined, initialImage || undefined)} className="w-10 h-10 bg-black/60 rounded-full text-white hover:bg-blue-600 flex items-center justify-center border border-white/10" title="Maximize & Compare">
                    <ArrowsPointingOutIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => downloadImage(outputImage, 'AdvisionPro_Mastered_Image.png')} className="w-10 h-10 bg-black/60 rounded-full text-white hover:bg-indigo-600 flex items-center justify-center border border-white/10" title="Download">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                  <div className="bg-black/80 px-6 py-3 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-3">
                    <ArrowPathIcon className="w-4 h-4 text-indigo-400 animate-spin-slow" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Click to Compare (A/B)</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 opacity-10">
                <SparklesIcon className="w-16 h-16" />
                <span className="text-xs font-black uppercase tracking-widest">Awaiting Creation</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Controls & History */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar bg-slate-900/20 rounded-t-[40px] p-6 border-t border-white/5">
        
        {/* Workflow Guide */}
        <div className="flex items-center justify-between mb-4 bg-black/40 p-4 rounded-2xl border border-white/5">
          {WORKFLOW_STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div 
                onClick={() => setActiveStep(step.id as any)}
                className={`flex flex-col items-center gap-2 cursor-pointer transition-all ${activeStep === step.id ? 'scale-110' : 'opacity-40 hover:opacity-70'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border ${activeStep === step.id ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/10'}`}>
                  {step.icon}
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${activeStep === step.id ? 'text-white' : 'text-slate-500'}`}>{step.name}</span>
                  <span className={`text-[7px] font-bold uppercase tracking-tighter truncate max-w-[60px] ${params[step.id as keyof typeof params].selections.length > 0 ? 'text-indigo-400' : 'text-slate-700'}`}>
                    {params[step.id as keyof typeof params].selections.length > 0 
                      ? (params[step.id as keyof typeof params].selections.length > 1 
                          ? `${params[step.id as keyof typeof params].selections[0]} +${params[step.id as keyof typeof params].selections.length - 1}`
                          : params[step.id as keyof typeof params].selections[0])
                      : 'None'}
                  </span>
                </div>
              </div>
              {idx < WORKFLOW_STEPS.length - 1 && <div className="flex-1 h-px bg-white/5 mx-4" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step Header */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-4 h-4 text-indigo-400" />
            <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">
              {WORKFLOW_STEPS.find(s => s.id === activeStep)?.label}
            </h2>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={resetIntensityParams}
              className="px-4 py-1.5 rounded-lg text-[10px] font-black transition-all border bg-white/5 border-white/10 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-500 shadow-lg"
            >
              RESET ALL
            </button>
            {activeStep === 'color' && (
              <button 
                disabled={status === AppStatus.GENERATING || !inputImage}
                onClick={processWhiteBalance}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all border ${status === AppStatus.GENERATING ? 'bg-slate-900 border-white/5 text-slate-700' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 shadow-lg'}`}
              >
                AUTO WHITE BALANCE
              </button>
            )}
            <div className="flex bg-black/60 p-1 rounded-xl border border-white/10">
              {["9:16", "3:4", "16:9"].map(r => (
                <button key={r} onClick={() => setSelectedRatio(r as AllowedAspectRatio)} className={`px-5 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedRatio === r ? "bg-indigo-600 text-white shadow-xl" : "text-slate-700 hover:text-slate-500"}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Options Grid */}
        <div className="flex flex-col gap-8 shrink-0">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              {INTENSITY_OPTIONS[activeStep].map((group) => {
                const isExpanded = expandedGroups[group.group] || false;
                return (
                  <div key={group.group} className="flex flex-col bg-black/20 rounded-2xl border border-white/5 overflow-hidden transition-all">
                    <button 
                      onClick={() => toggleGroup(group.group)}
                      className="flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-3 rounded-full transition-all ${isExpanded ? 'bg-indigo-500 h-4' : 'bg-slate-700'}`} />
                        <h3 className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isExpanded ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>
                          {group.group}
                        </h3>
                      </div>
                      <ChevronRightIcon className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-indigo-400' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-4 pt-0 animate-in slide-in-from-top-2 duration-300">
                        {group.items.map((opt: any) => (
                          <button 
                            key={opt.id} 
                            onClick={() => updateParam(activeStep, { name: opt.id })} 
                            className={`flex flex-col items-start p-4 rounded-xl border transition-all text-left group ${params[activeStep].selections.includes(opt.id) || (opt.id === 'None' && params[activeStep].selections.length === 0) ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-black/40 border-white/5 text-slate-400 hover:border-white/10'}`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest mb-1">{opt.name}</span>
                            <span className={`text-[8px] font-medium leading-tight ${params[activeStep].selections.includes(opt.id) || (opt.id === 'None' && params[activeStep].selections.length === 0) ? 'text-indigo-100' : 'text-slate-600 group-hover:text-slate-500'}`}>{opt.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Intensity & Summary */}
          <div className="flex flex-col md:flex-row gap-6 bg-black/40 p-6 rounded-3xl border border-white/5">
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Effect Intensity</label>
                <span className="text-[12px] font-black text-white">{params[activeStep].weight}%</span>
              </div>
              <input 
                type="range" min="0" max="100" 
                value={params[activeStep].weight}
                onChange={(e) => updateParam(activeStep, { weight: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                <span>Subtle</span><span>Balanced</span><span>Dramatic</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Step Summary</label>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 h-full flex items-center">
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  {params[activeStep].selections.length === 0 ? "옵션을 선택하여 보정을 시작하세요." : `${params[activeStep].selections.join(', ')} 효과를 ${params[activeStep].weight}% 강도로 적용합니다.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quality & Batch & Generate */}
        <div className="flex flex-wrap gap-6 items-end mt-4">
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
          <div className="flex-1 flex gap-4">
            <button 
              disabled={status === AppStatus.GENERATING || !inputImage} 
              onClick={() => processAdjustment(true)} 
              className={`flex-1 py-5 rounded-3xl font-black text-[12px] uppercase tracking-[0.2em] transition-all border ${status === AppStatus.GENERATING ? 'bg-slate-900 border-white/5 text-slate-700' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10 hover:border-indigo-500 shadow-lg'}`}
            >
              Apply All Steps (HQ)
            </button>
            <button 
              disabled={status === AppStatus.GENERATING || !inputImage} 
              onClick={() => processAdjustment(false)} 
              className={`flex-[2] py-5 rounded-3xl font-black text-[14px] uppercase tracking-[0.4em] transition-all shadow-2xl ${status === AppStatus.GENERATING ? 'bg-slate-900 text-slate-700' : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.01] active:scale-95'}`}
            >
              {status === AppStatus.GENERATING ? '생성 중...' : 'GENERATE MASTERPIECE'}
            </button>
          </div>
        </div>

        {/* History Section */}
        <div className="mt-8 border-t border-white/5 pt-6">
          <div className="flex items-center gap-2 mb-6">
            <HistoryIcon className="w-4 h-4 text-indigo-400" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">ITERATION HISTORY</h3>
          </div>
          <HistoryPanel 
            data={history} 
            onRemove={(id) => setHistory(p => p.filter(x => x.id !== id))} 
            onSelect={onSelectHistory} 
            downloadImage={downloadImage}
            showTransfer
            onTransfer={onTransferToInput}
            columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          />
        </div>
      </div>
    </div>
  );
};

export default IntensityTab;
