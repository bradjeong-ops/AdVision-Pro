import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Paintbrush, RotateCcw, Check, Loader2, MousePointer2, Maximize2 } from 'lucide-react';
import { downscaleImage } from '../services/gemini';

interface MaskEditorProps {
  imageUrl: string;
  onSave: (maskBase64: string, prompt: string, referenceImages: string[], isFast: boolean, alphaMaskBase64?: string) => void;
  onClose: () => void;
  isProcessing: boolean;
  onCancel?: () => void;
}

export const MaskEditor: React.FC<MaskEditorProps> = ({ imageUrl, onSave, onClose, isProcessing, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [mode, setMode] = useState<'select' | 'draw' | 'erase'>('select');
  const [prompt, setPrompt] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isFastMode, setIsFastMode] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHasDrawn(false);
    setPrompt('');
  }, [imageUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true);
        if (document.activeElement === document.body || document.activeElement?.tagName === 'DIV') {
          e.preventDefault();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const loadingMessages = [
    "AI가 마스킹된 영역을 정교하게 분석 중입니다...",
    "이미지의 질감과 조명을 맞추고 있습니다...",
    "세밀한 디테일을 생성하고 있습니다. 조금만 기다려주세요...",
    "최종 결과물을 렌더링하는 중입니다...",
    "거의 다 되었습니다! 잠시만 더 기다려주세요..."
  ];

  useEffect(() => {
    let progressInterval: any;
    let messageInterval: any;

    if (isProcessing) {
      setProgress(0);
      setLoadingMessageIndex(0);

      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 99) return 99;
          let increment = 0;
          if (prev < 40) increment = 1.5;
          else if (prev < 70) increment = 0.8;
          else if (prev < 90) increment = 0.3;
          else increment = 0.1;
          
          return Math.min(99, prev + increment);
        });
      }, 150);

      messageInterval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 3000);

    } else {
      setProgress(0);
      setLoadingMessageIndex(0);
      if (progressInterval) clearInterval(progressInterval);
      if (messageInterval) clearInterval(messageInterval);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
      if (messageInterval) clearInterval(messageInterval);
    };
  }, [isProcessing]);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const delta = e.deltaY;
    const zoomStep = 0.1;
    let newZoom = zoom - (delta > 0 ? zoomStep : -zoomStep);
    newZoom = Math.max(0.5, Math.min(newZoom, 10));
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpacePressed || mode === 'select') {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }
    if (mode === 'draw' || mode === 'erase') {
      startDrawing(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    const clientX = e.clientX;
    const clientY = e.clientY;
    document.documentElement.style.setProperty('--cursor-x', `${clientX}px`);
    document.documentElement.style.setProperty('--cursor-y', `${clientY}px`);

    if (isPanning) {
      const dx = (clientX - lastPanPoint.x);
      const dy = (clientY - lastPanPoint.y);
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: clientX, y: clientY });
      return;
    }
    draw(e);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPanning(false);
    stopDrawing();
  };

  const updateContext = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    ctx.lineWidth = brushSize * scaleX;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = mode === 'draw' ? 'source-over' : 'destination-out';
    ctx.strokeStyle = 'rgba(129, 140, 248, 1)';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    if (!img.complete || img.naturalWidth === 0) return;

    const container = canvas.closest('.canvas-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const padding = 80;
      const maxWidth = containerRect.width - padding;
      const maxHeight = containerRect.height - padding;
      
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const containerRatio = maxWidth / maxHeight;
      
      let fittedWidth, fittedHeight;
      if (imgRatio > containerRatio) {
        fittedWidth = maxWidth;
        fittedHeight = maxWidth / imgRatio;
      } else {
        fittedHeight = maxHeight;
        fittedWidth = maxHeight * imgRatio;
      }

      if (fittedWidth > 0 && fittedHeight > 0) {
        setCanvasSize({ width: Math.floor(fittedWidth), height: Math.floor(fittedHeight) });
        
        // 캔버스 내부 해상도를 시각적 화면 비율에 완벽히 동기화 (3배수 고화질 유지)
        const targetInternalWidth = Math.round(fittedWidth * 3);
        const targetInternalHeight = Math.round(fittedHeight * 3);

        if (canvas.width !== targetInternalWidth || canvas.height !== targetInternalHeight) {
          canvas.width = targetInternalWidth;
          canvas.height = targetInternalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            updateContext(ctx, canvas);
            contextRef.current = ctx;
          }
        } else {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            updateContext(ctx, canvas);
            contextRef.current = ctx;
          }
        }
      }
    }
  };

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      initCanvas();
    }
    const resizeObserver = new ResizeObserver(() => {
      initCanvas();
    });
    if (img) {
      resizeObserver.observe(img);
    }
    window.addEventListener('resize', initCanvas);
    return () => {
      window.removeEventListener('resize', initCanvas);
      resizeObserver.disconnect();
    };
  }, [imageUrl]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.globalCompositeOperation = mode === 'draw' ? 'source-over' : 'destination-out';
    }
  }, [mode]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if ('stopPropagation' in e) e.stopPropagation();
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    const { clientX, clientY } = 'touches' in e ? e.touches[0] : e;
    document.documentElement.style.setProperty('--cursor-x', `${clientX}px`);
    document.documentElement.style.setProperty('--cursor-y', `${clientY}px`);

    updateContext(ctx, canvas);
    const { offsetX, offsetY } = getCoordinates(e);
    lastPointRef.current = { x: offsetX, y: offsetY };
    
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if ('stopPropagation' in e) e.stopPropagation();
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    
    const { clientX, clientY } = 'touches' in e ? e.touches[0] : e;
    document.documentElement.style.setProperty('--cursor-x', `${clientX}px`);
    document.documentElement.style.setProperty('--cursor-y', `${clientY}px`);

    if (!isDrawing || !canvas || !ctx || !lastPointRef.current) return;

    updateContext(ctx, canvas);
    const { offsetX, offsetY } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    
    lastPointRef.current = { x: offsetX, y: offsetY };
  };

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();
    lastPointRef.current = null;
    setIsDrawing(false);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };

    const rect = canvas.getBoundingClientRect();
    const { clientX, clientY } = 'touches' in e ? (e.touches[0] || e.changedTouches[0]) : e;

    // 🔥 좌표 이탈 완벽 방지 (마우스가 화면을 뚫고 나가도 캔버스 안으로 잡아둠)
    const relativeX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relativeY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return {
      offsetX: relativeX * canvas.width,
      offsetY: relativeY * canvas.height
    };
  };

  useEffect(() => {
    if (contextRef.current && canvasRef.current) {
      updateContext(contextRef.current, canvasRef.current);
    }
  }, [brushSize, zoom, canvasSize, mode]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !prompt.trim()) return;

    try {
      const alphaCanvas = document.createElement('canvas');
      alphaCanvas.width = canvas.width; alphaCanvas.height = canvas.height;
      const alphaCtx = alphaCanvas.getContext('2d');
      if (alphaCtx) { 
        alphaCtx.drawImage(canvas, 0, 0); 
        alphaCtx.drawImage(canvas, 0, 0); 
        alphaCtx.drawImage(canvas, 0, 0); 
      }
      const alphaMaskBase64 = alphaCanvas.toDataURL('image/png');

      const maxMaskDim = 1024;
      const scale = Math.min(1, maxMaskDim / Math.max(canvas.width, canvas.height));
      
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = Math.floor(canvas.width * scale);
      maskCanvas.height = Math.floor(canvas.height * scale);
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error('마스크 에러');

      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = maskCanvas.width;
      tempCanvas.height = maskCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0, maskCanvas.width, maskCanvas.height);
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        maskCtx.drawImage(tempCanvas, 0, 0);
      }

      onSave(maskCanvas.toDataURL('image/png'), prompt, referenceImages, isFastMode, alphaMaskBase64);
    } catch (err) {
      console.error("Mask generation error:", err);
      alert("마스크 생성 오류");
    }
  };

  const handleRefFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          if (ev.target?.result) {
            const base64 = ev.target.result as string;
            try {
              const optimizedBase64 = await downscaleImage(base64, 800);
              setReferenceImages(prev => [...prev, optimizedBase64]);
            } catch (err) {
              setReferenceImages(prev => [...prev, base64]);
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeRefImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Paintbrush className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Refinement Editor</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Paint the area you want to modify</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-[300] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6">
          <div className="relative flex items-center justify-center">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/10" />
              <circle
                cx="64"
                cy="64"
                r="60"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={377}
                style={{ 
                  strokeDashoffset: 377 - (377 * progress) / 100,
                  transition: 'stroke-dashoffset 0.3s ease-out'
                }}
                className="text-indigo-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="text-center space-y-3 max-w-md px-6">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Refining Image...</h3>
            <p className="text-sm text-slate-300 font-medium h-10 flex items-center justify-center">
              {loadingMessages[loadingMessageIndex]}
            </p>
          </div>

          {onCancel && (
            <button 
              onClick={onCancel}
              className="mt-4 px-8 py-3 bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-white/10 hover:border-red-500/30 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group"
            >
              <X className="w-3 h-3 transition-transform group-hover:rotate-90" />
              Cancel Refinement
            </button>
          )}
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-20 border-r border-white/10 flex flex-col items-center py-8 gap-6">
          <button 
            onClick={() => setMode('select')}
            className={`p-3 rounded-xl transition-all ${mode === 'select' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-slate-500 hover:bg-white/5'}`}
            title="Select / Pan"
          >
            <MousePointer2 className="w-6 h-6" />
          </button>
          
          <div className="h-px w-8 bg-white/10 my-2" />
          
          <button 
            onClick={() => setMode('draw')}
            className={`p-3 rounded-xl transition-all ${mode === 'draw' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-slate-500 hover:bg-white/5'}`}
            title="Brush"
          >
            <Paintbrush className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setMode('erase')}
            className={`p-3 rounded-xl transition-all ${mode === 'erase' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-slate-500 hover:bg-white/5'}`}
            title="Eraser"
          >
            <Eraser className="w-6 h-6" />
          </button>
          
          <div className="h-px w-8 bg-white/10 my-2" />
          
          <button 
            onClick={handleResetView}
            className="p-3 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white transition-all"
            title="Reset View"
          >
            <Maximize2 className="w-6 h-6" />
          </button>
          <button 
            onClick={handleClear}
            className="p-3 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white transition-all"
            title="Clear Mask"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>

        {/* Canvas Container */}
        <div 
          className="flex-1 relative flex items-center justify-center p-12 bg-black/40 overflow-hidden canvas-container"
          onMouseEnter={() => setIsCursorVisible(true)}
          onMouseLeave={() => setIsCursorVisible(false)}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: (isSpacePressed || mode === 'select') ? (isPanning ? 'grabbing' : 'grab') : 'auto' }}
        >
          <div 
            className={`relative shadow-2xl shadow-black/50 rounded-lg overflow-hidden select-none bg-black/20 ${canvasSize.width > 0 ? 'opacity-100' : 'opacity-0'}`}
            onDragStart={(e) => e.preventDefault()}
            style={{ 
              width: canvasSize.width || 0, 
              height: canvasSize.height || 0,
              maxWidth: '100%',
              maxHeight: '100%',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center',
              willChange: 'transform'
            }}
          >
            <img 
              ref={imgRef}
              src={imageUrl} 
              onLoad={initCanvas}
              className="w-full h-full object-contain pointer-events-none" 
              alt="To refine" 
              referrerPolicy="no-referrer"
            />
            {/* 🔥 캔버스 옥상 이탈 방지용 핵심 코드: w-full h-full 추가 */}
            <canvas
              ref={canvasRef}
              onDragStart={(e) => e.preventDefault()}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={() => stopDrawing()}
              className="absolute inset-0 w-full h-full touch-none select-none"
              style={{ 
                cursor: (isSpacePressed || mode === 'select') ? 'inherit' : 'none',
                imageRendering: 'auto',
                opacity: 0.5
              }}
            />
          </div>

          {!isProcessing && !isSpacePressed && (
            <div 
              className="pointer-events-none fixed z-[210] border-2 border-indigo-400 shadow-[0_0_15px_rgba(0,0,0,0.6)] rounded-full bg-indigo-500/30 backdrop-blur-[1px] flex items-center justify-center"
              style={{
                width: `${brushSize}px`,
                height: `${brushSize}px`,
                left: `var(--cursor-x, -100px)`,
                top: `var(--cursor-y, -100px)`,
                transform: 'translate(-50%, -50%)',
                display: (isCursorVisible && (mode === 'draw' || mode === 'erase')) ? 'flex' : 'none'
              }}
            >
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-sm" />
            </div>
          )}
        </div>

        {/* Right Panel: Prompt & Action */}
        <div className="w-80 border-l border-white/10 p-6 flex flex-col gap-6 bg-black/20">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Brush Size</label>
              <span className="text-[10px] font-mono text-indigo-400">{brushSize}px</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="200" 
              value={brushSize} 
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Refinement Instruction</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Remove racket and show grass..."
              className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fast Mode</label>
                <p className="text-[8px] text-slate-600 uppercase tracking-wider leading-tight">Speed over resolution (1K)</p>
              </div>
              <button 
                onClick={() => setIsFastMode(!isFastMode)}
                className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${isFastMode ? 'bg-indigo-600' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isFastMode ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reference Images (Optional)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 bg-white/5 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/10 hover:border-indigo-500/50 transition-all group"
            >
              <div className="p-2 bg-white/5 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                <Paintbrush className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" />
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Click to Drop References</span>
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={handleRefFileUpload}
              />
            </div>

            {referenceImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {referenceImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group/img">
                    <img src={img} className="w-full h-full object-cover" alt="Ref" referrerPolicy="no-referrer" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeRefImage(idx); }}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-md opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="w-2 h-2 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={handleSave}
            disabled={!hasDrawn || !prompt.trim() || isProcessing}
            className={`mt-auto w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-[11px] ${
              !hasDrawn || !prompt.trim() || isProcessing
                ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply Refinement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
