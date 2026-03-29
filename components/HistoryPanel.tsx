
import React, { memo } from 'react';
import { GenerationRecord } from '../types';
import { ArrowDownTrayIcon, SparklesIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface HistoryPanelProps {
  data: GenerationRecord[];
  onRemove: (id: string) => void;
  onSelect: (index: number) => void;
  onTransfer?: (imageUrl: string) => void;
  downloadImage: (dataUrl: string, filename: string) => void;
  showTransfer?: boolean;
  columns?: string;
}

const HistoryPanel = memo(({ 
  data, 
  onRemove, 
  onSelect, 
  onTransfer,
  downloadImage,
  showTransfer,
  columns
}: HistoryPanelProps) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 12;
  const totalPages = Math.ceil(data.length / itemsPerPage);

  // Reset to page 1 if data changes significantly (e.g. cleared)
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [data.length, totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

  if (data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12 opacity-10 text-[10px] font-black uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">History Empty</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`grid ${columns || 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'} gap-4 pb-2 items-start px-2 -mx-2 max-w-full`}>
        {paginatedData.map((item, index) => {
          const globalIndex = startIndex + index;
          return (
            <div key={item.id} className={`group bg-slate-900/40 border border-white/5 ${columns ? 'rounded-xl p-1.5' : 'rounded-2xl p-2'} relative transition-all hover:bg-slate-900/80 cursor-pointer shadow-2xl hover:border-white/10`} onClick={() => onSelect(globalIndex)}>
              <div className={`${columns ? 'rounded-lg' : 'rounded-xl'} overflow-hidden bg-black relative shadow-inner transition-all group-hover:scale-[0.98]`} style={{ aspectRatio: item.ratio || (9/16) }}>
                <img src={item.generatedImage} className="w-full h-full object-contain" />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className={`absolute ${columns ? 'top-2 right-2' : 'top-3 right-3'} flex flex-col gap-2`} onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); downloadImage(item.generatedImage, `AdvisionPro_Generated_Image_${data.length - globalIndex}.png`); }} className={`${columns ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-indigo-600 transition-all shadow-2xl`} title="Download"><ArrowDownTrayIcon className={columns ? 'w-4 h-4' : 'w-5 h-5'} /></button>
                    {showTransfer && onTransfer && (
                      <button onClick={(e) => { e.stopPropagation(); onTransfer(item.generatedImage); }} className={`${columns ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-emerald-600 transition-all shadow-2xl`} title="Process Further"><SparklesIcon className={columns ? 'w-4 h-4' : 'w-5 h-5'} /></button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} className={`${columns ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-red-600 transition-all shadow-2xl`} title="Delete"><TrashIcon className={columns ? 'w-4 h-4' : 'w-5 h-5'} /></button>
                  </div>
                </div>
              </div>
              <div className={`${columns ? 'mt-1.5' : 'mt-2.5'} px-1 flex flex-col gap-0.5`}>
                <span className={`${columns ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-tight text-slate-300 group-hover:text-white transition-colors truncate block`}>{item.prompt}</span>
                <span className="text-[7px] font-bold text-slate-600 uppercase tracking-wider block">{new Date(item.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all border ${currentPage === page ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10'}`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Page {currentPage} of {totalPages}</span>
        </div>
      )}
    </div>
  );
});

export default HistoryPanel;
