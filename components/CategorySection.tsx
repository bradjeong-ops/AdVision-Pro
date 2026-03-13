
import React, { memo, useRef, useState } from 'react';
import { PlusIcon, TrashIcon, SparklesIcon, ArrowPathIcon, UserIcon } from './Icons';

type CategoryKey = 'id1' | 'id2' | 'other';
type ViewKey = 'front' | 'side' | 'back' | 'face';

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

interface CategorySectionProps {
  title: string;
  category: CategoryKey;
  categorizedProducts: Record<CategoryKey, CategoryData>;
  setCategorizedProducts: React.Dispatch<React.SetStateAction<Record<CategoryKey, CategoryData>>>;
  frontInputRef: React.RefObject<HTMLInputElement | null>;
  sideInputRef: React.RefObject<HTMLInputElement | null>;
  backInputRef: React.RefObject<HTMLInputElement | null>;
  faceInputRef: React.RefObject<HTMLInputElement | null>;
  detailInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, options?: { category?: CategoryKey, type?: 'main' | 'detail' | 'bulk', view?: ViewKey }) => void;
  handleDropUpload: (e: React.DragEvent<HTMLDivElement>, options?: any) => void;
  onClear: (category: CategoryKey) => void;
}

const CategorySection = memo(({ 
  title, 
  category, 
  categorizedProducts, 
  setCategorizedProducts, 
  frontInputRef,
  sideInputRef,
  backInputRef,
  faceInputRef,
  detailInputRef, 
  handleFileUpload,
  handleDropUpload,
  onClear
}: CategorySectionProps) => {
  const data = categorizedProducts[category];
  const subTitle = category === 'other' ? "PRODUCT ASSETS" : "PRIMARY SUBJECT";
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [showFaceDetail, setShowFaceDetail] = useState(data.mains.face !== null);

  const renderSlot = (view: ViewKey, ref: React.RefObject<HTMLInputElement | null>, label: string) => {
    const imageUrl = data.mains[view];
    const isAnalyzing = data.isAnalyzing && !imageUrl;

    return (
      <div 
        className={`relative flex-1 rounded-[24px] overflow-hidden transition-all duration-300 group border-2 cursor-pointer ${imageUrl ? 'bg-[#0f141e]' : 'bg-[#161d2b] h-56'} border-slate-800/50 hover:border-indigo-500/50`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => handleDropUpload(e, { category, type: 'main', view })}
        onClick={() => ref.current?.click()}
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500" />
            <button 
              onClick={(e) => { e.stopPropagation(); setCategorizedProducts(p => ({ ...p, [category]: { ...p[category], mains: { ...p[category].mains, [view]: null } } })); }} 
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/40 backdrop-blur-lg rounded-full text-white/70 hover:text-white hover:bg-red-600/80 transition-all border border-white/10 opacity-0 group-hover:opacity-100 z-10"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-[#4b5563]/80 backdrop-blur-md rounded-[6px] text-[9px] font-black text-white uppercase tracking-wider">{label}</div>
          </>
        ) : isAnalyzing ? (
          <div className="flex flex-col items-center justify-center h-full w-full gap-3 opacity-50">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest animate-pulse">Analyzing...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full w-full opacity-30 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col items-center justify-center gap-2">
              <PlusIcon className="w-6 h-6 text-slate-400" />
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
            </div>
          </div>
        )}
        <input type="file" ref={ref} onChange={(e) => handleFileUpload(e, { category, type: 'main', view })} accept="image/*" className="hidden" />
      </div>
    );
  };

  return (
    <div className="p-5 rounded-[32px] bg-[#1a2235]/40 border border-white/5 transition-all mb-6 shadow-xl relative overflow-hidden">
      {data.isAnalyzing && (
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/30 overflow-hidden">
          <div className="h-full bg-indigo-500 animate-[loading_2s_infinite]" style={{ width: '30%' }} />
        </div>
      )}

      <div className="flex justify-between items-center mb-5 px-1">
        <div className="flex items-center gap-3">
          <h3 className="text-[14px] font-black uppercase tracking-wider text-white/90">{title}</h3>
          <span className="text-[10px] text-indigo-400/60 font-black uppercase tracking-widest">{subTitle}</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            disabled={data.isAnalyzing}
            onClick={() => bulkInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-[9px] font-black text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-widest"
          >
            <SparklesIcon className="w-3.5 h-3.5" /> AUTO
          </button>
          <button 
            onClick={() => onClear(category)}
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            <TrashIcon className="w-3.5 h-3.5" /> RESET
          </button>
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        {category === 'other' ? (
          <div 
            className="grid grid-cols-4 sm:grid-cols-5 gap-3 bg-[#0b0f1a] rounded-[24px] p-5 border-2 border-transparent hover:border-indigo-500/30 transition-all"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => handleDropUpload(e, { category, type: 'main' })}
          >
            {data.items.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-[14px] overflow-hidden border border-white/5 bg-black group/item shadow-inner transition-all hover:scale-105">
                <img src={img} className="w-full h-full object-cover animate-in fade-in" />
                <button 
                  onClick={(e) => { e.stopPropagation(); setCategorizedProducts(p => ({ ...p, [category]: { ...p[category], items: p[category].items.filter((_, i) => i !== idx) } })); }} 
                  className="absolute inset-0 bg-red-600/60 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-all text-white"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div 
              className="aspect-square bg-[#161d2b] border border-dashed border-slate-700/50 rounded-[14px] flex items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-all group active:scale-95" 
              onClick={(e) => {
                e.stopPropagation();
                detailInputRef.current?.click();
              }}
            >
              <PlusIcon className="w-6 h-6 text-slate-600 group-hover:text-indigo-500/60" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              {renderSlot('front', frontInputRef, 'FRONT')}
              {renderSlot('side', sideInputRef, 'SIDE')}
              {renderSlot('back', backInputRef, 'BACK')}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <button 
                  onClick={() => setShowFaceDetail(!showFaceDetail)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[9px] font-black uppercase tracking-widest ${showFaceDetail ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  {showFaceDetail ? 'FACE DETAIL ACTIVE' : 'ADD FACE DETAIL'}
                </button>
                {showFaceDetail && !data.mains.face && (
                  <span className="text-[8px] text-slate-600 font-bold animate-pulse">← UPLOAD FACE DETAIL FOR BETTER RESULTS</span>
                )}
              </div>
              
              {showFaceDetail && (
                <div className="flex gap-3 animate-in slide-in-from-top-2 duration-300">
                  {renderSlot('face', faceInputRef, 'FACE DETAIL')}
                </div>
              )}
            </div>

            <div 
              className={`bg-[#0b0f1a] rounded-[24px] p-5 mt-2 transition-all duration-300 border-2 border-transparent hover:border-indigo-500/30`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => handleDropUpload(e, { category, type: 'detail' })}
            >
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 px-1">ITEMS</p>
              <div className="flex flex-wrap gap-3">
                {data.details.map((img, idx) => (
                  <div key={idx} className="relative w-[60px] h-[60px] rounded-[14px] overflow-hidden border border-white/5 bg-black group/item shadow-inner transition-all hover:scale-105">
                    <img src={img} className="w-full h-full object-cover animate-in fade-in" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCategorizedProducts(p => ({ ...p, [category]: { ...p[category], details: p[category].details.filter((_, i) => i !== idx) } })); }} 
                      className="absolute inset-0 bg-red-600/60 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-all text-white"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div 
                  className="w-[60px] h-[60px] bg-[#161d2b] border border-dashed border-slate-700/50 rounded-[14px] flex items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-all group active:scale-95" 
                  onClick={(e) => {
                    e.stopPropagation();
                    detailInputRef.current?.click();
                  }}
                >
                  <PlusIcon className="w-6 h-6 text-slate-600 group-hover:text-indigo-500/60" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <input type="file" multiple ref={detailInputRef} onChange={(e) => handleFileUpload(e, { category, type: 'detail' })} accept="image/*" className="hidden" />
      <input type="file" multiple ref={bulkInputRef} onChange={(e) => handleFileUpload(e, { category, type: 'bulk' })} accept="image/*" className="hidden" />
    </div>
  );
});

export default CategorySection;
