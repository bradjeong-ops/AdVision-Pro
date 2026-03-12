
import React, { memo } from 'react';
import { GenerationRecord } from '../types';
import { ArrowDownTrayIcon, SparklesIcon, TrashIcon } from './Icons';

interface HistoryPanelProps {
  data: GenerationRecord[];
  onRemove: (id: string) => void;
  onSelect: (index: number) => void;
  onTransfer?: (imageUrl: string) => void;
  downloadImage: (dataUrl: string, filename: string) => void;
  showTransfer?: boolean;
}

const HistoryPanel = memo(({ 
  data, 
  onRemove, 
  onSelect, 
  onTransfer,
  downloadImage,
  showTransfer
}: HistoryPanelProps) => (
  <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-6 items-start px-2 -mx-2 max-w-full">
    {data.length === 0 ? (
      <div className="w-full flex items-center justify-center py-12 opacity-10 text-[10px] font-black uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">History Empty</div>
    ) : (
      data.map((item, index) => (
        <div key={item.id} className="group shrink-0 w-72 bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden p-2 relative transition-all hover:bg-slate-900/80 cursor-pointer shadow-2xl hover:border-white/10" onClick={() => onSelect(index)}>
          <div className="rounded-xl overflow-hidden bg-black relative shadow-inner transition-all group-hover:scale-[0.98]" style={{ aspectRatio: item.ratio || (9/16) }}>
            <img src={item.generatedImage} className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div className="absolute top-3 right-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); downloadImage(item.generatedImage, `adv-${item.id}.png`); }} className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-indigo-600 transition-all shadow-2xl" title="Download"><ArrowDownTrayIcon className="w-5 h-5" /></button>
                {showTransfer && onTransfer && (
                  <button onClick={(e) => { e.stopPropagation(); onTransfer(item.generatedImage); }} className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-emerald-600 transition-all shadow-2xl" title="Process Further"><SparklesIcon className="w-5 h-5" /></button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-red-600 transition-all shadow-2xl" title="Delete"><TrashIcon className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
          <div className="mt-2.5 px-1 flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-tight text-slate-300 group-hover:text-white transition-colors truncate block">{item.prompt}</span>
            <span className="text-[7px] font-bold text-slate-600 uppercase tracking-wider block">{new Date(item.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      ))
    )}
  </div>
));

export default HistoryPanel;
