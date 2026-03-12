
import React, { useRef, useState } from 'react';
import { 
  CloudArrowUpIcon, 
  TrashIcon, 
  SparklesIcon, 
  ArrowDownTrayIcon, 
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  HistoryIcon
} from './Icons';
import { AppStatus, GenerationRecord } from '../types';
import { AllowedAspectRatio, ImageQuality } from '../services/gemini';
import HistoryPanel from './HistoryPanel';

const MOOD_OPTIONS = [
  {
    category: 'Editorial Master',
    subs: [
      { id: 'golden_hour_edit', name: 'Golden Hour', description: '따뜻한 측광 연출. 피부 모공과 실크 질감을 보존하면서 낮은 각도의 태양광을 투사합니다.' },
      { id: 'studio_high_gloss', name: 'High-Gloss', description: '잡지 커버 스타일. 피부의 광택과 액세서리의 Specular를 강조하며 섬유 디테일을 유지합니다.' },
      { id: 'misty_editorial', name: 'Misty', description: '몽환적인 안개 효과. 디테일 뭉개짐 없이 공기 중에만 부드런 하이라이트를 추가합니다.' },
      { id: 'hard_shadow_mono', name: 'Hard Shadow', description: '시크한 고대비 흑백. 날카로운 그림자와 함께 옷감의 거친 질감을 극대화합니다.' },
      { id: 'street_flash', name: 'Street Flash', description: '거친 직사광 플래시. Y2K 감성의 강렬한 하이라이트와 리얼한 필름 그레인을 적용합니다.' }
    ]
  },
  {
    category: 'Dawn & Night',
    subs: [
      { id: 'blue_hour', name: 'Blue Hour', description: '깊은 새벽의 푸른 조명. 프리미엄 제품의 차가운 질감을 선명하게 살립니다.' }, 
      { id: 'midnight', name: 'Midnight', description: '강렬한 대비의 밤 분위기. 현대적인 금속 및 가죽 질감에 최적입니다.' }, 
      { id: 'foggy', name: 'Foggy', description: '신비로운 안개 새벽. 몽환적이면서도 피사체의 윤곽선은 뚜렷하게 유지합니다.' }
    ]
  },
  {
    category: 'Morning & Fresh',
    subs: [
      { id: 'natural_light', name: 'Natural', description: '화사한 아침 햇살. 피부의 투명도와 면 원단의 부드러운 질감을 강조합니다.' }, 
      { id: 'clean_bright', name: 'Clean', description: '정돈된 스튜디오 조명. 제품의 로고와 텍스트를 가장 선명하게 표현합니다.' }, 
      { id: 'sun_kissed', name: 'Sun-kissed', description: '포근한 햇살 분위기. 아늑하고 부드러운 원단 텍스처를 자연스럽게 살립니다.' }
    ]
  },
  {
    category: 'Sunset & Evening',
    subs: [
      { id: 'golden_hour', name: 'Golden Hour', description: '석양의 황금빛 감성. 서정적인 화보 무드와 함께 옷감의 따뜻한 광택을 연출합니다.' }, 
      { id: 'warm_glow', name: 'Warm Glow', description: '은은한 저녁 전구 빛. 가죽이나 목재 등 따뜻한 소재의 깊이감을 더합니다.' }
    ]
  }
];

const DETAIL_EFFECT_OPTIONS = [
  {
    category: 'Film Style',
    subs: [
      { id: 'kodak_fuji', name: 'Kodak', description: '클래식한 필름 질감. 아날로그적인 입자감과 함께 풍부한 중간 톤을 재현합니다.' }, 
      { id: 'bw_noir', name: 'B&W', description: '흑백 영화 룩. 형태의 구조미와 옷감의 명암 대비를 극대화합니다.' }, 
      { id: 'sepia', name: 'Sepia', description: '빈티지한 세피아 톤. 고전적인 우아함과 세월의 질감을 입힙니다.' }
    ]
  },
  {
    category: 'Softness',
    subs: [
      { id: 'dreamy', name: 'Dreamy', description: '환상적인 하이라이트 번짐. 뷰티 화보 특유의 부드럽고 빛나는 피부를 연출합니다.' }, 
      { id: 'mist_bloom', name: 'Bloom', description: '화사한 빛의 확산. 색감의 채도를 높이고 밝은 영역의 디테일을 부드럽게 감쌉니다.' }
    ]
  },
  {
    category: 'Cinematic',
    subs: [
      { id: 'pastel', name: 'Pastel', description: '세련된 파스텔 색조. 트렌디한 패션 브랜드의 밝고 감각적인 색감을 표현합니다.' }, 
      { id: 'cinematic', name: 'Cinema', description: '영화적인 깊이감. 드라마틱한 색채 변화와 고밀도 픽셀 디테일을 완성합니다.' }, 
      { id: 'moody', name: 'Moody', description: '무겁고 진지한 색감. 럭셔리 브랜드의 중후하고 깊은 명암비를 부여합니다.' }
    ]
  }
];

interface IntensityTabProps {
  inputImage: string | null;
  setInputImage: (img: string | null) => void;
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
  processAdjustment: (mood: string, detail: string) => void;
  processWhiteBalance: () => void;
  downloadImage: (url: string, filename: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, options?: any) => void;
  handleDropUpload: (e: React.DragEvent<HTMLDivElement>, options?: any) => void;
  onSelectHistory: (idx: number) => void;
  onOpenFullscreen: (url: string, original?: string) => void;
  onTransferToInput: (url: string) => void;
}

const IntensityTab: React.FC<IntensityTabProps> = ({
  inputImage, setInputImage, outputImage, status, history, setHistory,
  selectedRatio, setSelectedRatio, selectedQuality, setSelectedQuality,
  selectedCount, setSelectedCount,
  processAdjustment, processWhiteBalance, downloadImage, handleFileUpload, handleDropUpload,
  onSelectHistory, onOpenFullscreen, onTransferToInput
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isComparing, setIsComparing] = useState(false);

  const [selectedMainMood, setSelectedMainMood] = useState<string | null>(MOOD_OPTIONS[0].category);
  const [selectedSubMood, setSelectedSubMood] = useState<any>(null);
  const [selectedMainDetail, setSelectedMainDetail] = useState<string | null>(DETAIL_EFFECT_OPTIONS[0].category);
  const [selectedSubDetail, setSelectedSubDetail] = useState<any>(null);

  const handleExecute = () => {
    if (!inputImage) return;
    const moodString = selectedSubMood ? `${selectedMainMood} - ${selectedSubMood.name}` : "Default";
    const detailString = selectedSubDetail ? `${selectedMainDetail} - ${selectedSubDetail.name}` : "Default";
    processAdjustment(moodString, detailString);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-in fade-in duration-500">
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
              <><img src={inputImage} className="w-full h-full object-contain" /><button onClick={(e) => { e.stopPropagation(); setInputImage(null); }} className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full text-white/50 hover:text-white hover:bg-red-600 transition-all flex items-center justify-center border border-white/10"><TrashIcon className="w-5 h-5" /></button></>
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
            onClick={() => outputImage && !isComparing && onOpenFullscreen(outputImage, inputImage || undefined)}
          >
            {outputImage ? (
              <>
                <img src={isComparing ? inputImage! : outputImage} className="w-full h-full object-contain" />
                <div className="absolute top-4 right-4 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onOpenFullscreen(outputImage, inputImage || undefined)} className="w-10 h-10 bg-black/60 rounded-full text-white hover:bg-blue-600 flex items-center justify-center border border-white/10" title="Maximize">
                    <ArrowsPointingOutIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => downloadImage(outputImage, 'AdvisionPro_Mastered_Image.png')} className="w-10 h-10 bg-black/60 rounded-full text-white hover:bg-indigo-600 flex items-center justify-center border border-white/10" title="Download">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </button>
                  <button onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border border-white/10 ${isComparing ? 'bg-white text-black' : 'bg-black/60 text-white'}`} title="Compare">
                    <ArrowPathIcon className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : <div className="flex flex-col items-center gap-4 opacity-10"><SparklesIcon className="w-16 h-16" /><span className="text-xs font-black uppercase tracking-widest">Awaiting Creation</span></div>}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar bg-slate-900/20 rounded-t-[40px] p-6 border-t border-white/5">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-4 h-4 text-indigo-400" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Professional Aesthetic Mastering Protocol</h2>
          </div>
          <div className="flex gap-2">
            <button 
              disabled={status === AppStatus.GENERATING || !inputImage}
              onClick={processWhiteBalance}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all border ${status === AppStatus.GENERATING ? 'bg-slate-900 border-white/5 text-slate-700' : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 shadow-lg'}`}
            >
              AUTO WHITE BALANCE
            </button>
            <div className="flex bg-black/60 p-1 rounded-xl border border-white/10">
              {["9:16", "3:4", "16:9"].map(r => (
                <button key={r} onClick={() => setSelectedRatio(r as AllowedAspectRatio)} className={`px-5 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedRatio === r ? "bg-indigo-600 text-white shadow-xl" : "text-slate-700 hover:text-slate-500"}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 shrink-0">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 border-l-2 border-indigo-500 pl-3">
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">환경 및 조명 (ATMOSPHERE)</span>
              <p className="text-[8px] text-slate-500 font-bold uppercase">물리적 질감을 보존하며 광학적 분위기를 투사합니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOOD_OPTIONS.map(m => (
                <button key={m.category} onClick={() => { setSelectedMainMood(m.category); setSelectedSubMood(null); }} className={`py-3.5 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest ${selectedMainMood === m.category ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-[#0a0d14] border-white/5 text-slate-700 hover:border-white/10'}`}>{m.category}</button>
              ))}
            </div>
            {selectedMainMood && (
              <div className="flex flex-wrap gap-2 animate-in slide-in-from-left-2 duration-300">
                {MOOD_OPTIONS.find(m => m.category === selectedMainMood)?.subs.map(sub => (
                  <button key={sub.id} onClick={() => setSelectedSubMood(sub)} className={`px-4 py-2 rounded-lg border text-[9px] font-black transition-all ${selectedSubMood?.id === sub.id ? 'bg-white text-black border-white shadow-xl' : 'bg-slate-800/40 border-white/5 text-slate-500 hover:text-white'}`}>{sub.name}</button>
                ))}
              </div>
            )}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 min-h-[60px]">
               <p className="text-[10px] text-slate-400 leading-relaxed font-medium italic">
                {selectedSubMood ? selectedSubMood.description : "상단 카테고리를 선택하여 조명 설정을 시작하세요."}
               </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 border-l-2 border-violet-500 pl-3">
              <span className="text-[10px] font-black uppercase text-violet-400 tracking-widest">질감 및 그레이딩 (TEXTURE)</span>
              <p className="text-[8px] text-slate-500 font-bold uppercase">피부 디테일의 실재감을 극대화하고 톤을 정돈합니다.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DETAIL_EFFECT_OPTIONS.map(g => (
                <button key={g.category} onClick={() => { setSelectedMainDetail(g.category); setSelectedSubDetail(null); }} className={`py-3.5 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest ${selectedMainDetail === g.category ? 'bg-violet-600 border-violet-500 text-white shadow-xl' : 'bg-[#0a0d14] border-white/5 text-slate-700 hover:border-white/10'}`}>{g.category}</button>
              ))}
            </div>
            {selectedMainDetail && (
              <div className="flex flex-wrap gap-2 animate-in slide-in-from-right-2 duration-300">
                {DETAIL_EFFECT_OPTIONS.find(g => g.category === selectedMainDetail)?.subs.map(sub => (
                  <button key={sub.id} onClick={() => setSelectedSubDetail(sub)} className={`px-4 py-2 rounded-lg border text-[9px] font-black transition-all ${selectedSubDetail?.id === sub.id ? 'bg-white text-black border-white shadow-xl' : 'bg-slate-800/40 border-white/5 text-slate-500 hover:text-white'}`}>{sub.name}</button>
                ))}
              </div>
            )}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 min-h-[60px]">
               <p className="text-[10px] text-slate-400 leading-relaxed font-medium italic">
                {selectedSubDetail ? selectedSubDetail.description : "그레이딩 옵션을 선택하여 질감을 완성하세요."}
               </p>
            </div>
          </div>
        </div>

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

            <div className="flex-1">
              <button 
                disabled={status === AppStatus.GENERATING || !inputImage || (!selectedSubMood && !selectedSubDetail)} 
                onClick={handleExecute} 
                className={`w-full py-5 rounded-3xl font-black text-[14px] uppercase tracking-[0.4em] transition-all shadow-2xl ${status === AppStatus.GENERATING ? 'bg-slate-900 text-slate-700' : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.01] active:scale-95'}`}
              >
                {status === AppStatus.GENERATING ? '생성 중...' : 'GENERATE'}
              </button>
            </div>
        </div>

        <div className="mt-8 border-t border-white/5 pt-6">
          <div className="flex items-center gap-2 mb-6">
            <HistoryIcon className="w-4 h-4 text-indigo-400" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">HISTORY</h3>
          </div>
          <HistoryPanel 
            data={history} 
            onRemove={(id) => setHistory(p => p.filter(x => x.id !== id))} 
            onSelect={onSelectHistory} 
            downloadImage={downloadImage}
            showTransfer
            onTransfer={onTransferToInput}
          />
        </div>
      </div>
    </div>
  );
};

export default IntensityTab;
