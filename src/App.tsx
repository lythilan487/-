import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';
import { Upload, Download, RefreshCw, Type, Palette, Trash2, Italic, Underline, Strikethrough, Undo2, Redo2, SlidersHorizontal, ChevronRight, Mic, MicOff, X, RotateCw } from 'lucide-react';
import { cn } from './lib/utils';

function useUndo<T>(initialPresent: T) {
  const [state, setState] = useState({
    past: [] as T[],
    present: initialPresent,
    future: [] as T[]
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      return { past: newPast, present: previous, future: [present, ...future] };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;
      const next = future[0];
      const newFuture = future.slice(1);
      return { past: [...past, present], present: next, future: newFuture };
    });
  }, []);

  const set = useCallback((newPresent: T | ((current: T) => T)) => {
    setState(currentState => {
      const { past, present } = currentState;
      const resolvedPresent = typeof newPresent === 'function' ? (newPresent as Function)(present) : newPresent;
      if (present === resolvedPresent) return currentState;
      return { past: [...past, present], present: resolvedPresent, future: [] };
    });
  }, []);

  return [state.present, set, undo, redo, canUndo, canRedo] as const;
}

const initialStyle = {
  color: '#FFFFFF',
  fontSize: 48,
  fontWeight: 'bold',
  textShadow: '0 4px 8px rgba(0,0,0,0.8)',
  textAlign: 'center',
  fontFamily: "'Noto Sans SC', sans-serif",
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  opacity: 1,
};

const initialImageStyle = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  aspectRatio: 'original',
  rotate: 0,
};

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'font' | 'style' | 'image'>('font');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  
  const [appState, setAppState, undo, redo, canUndo, canRedo] = useUndo({
    text: '',
    textStyle: initialStyle,
    imageStyle: initialImageStyle
  });

  const text = appState.text;
  const textStyle = appState.textStyle;
  const imageStyle = appState.imageStyle;

  const setText = useCallback((newText: string | ((prev: string) => string)) => {
    setAppState(s => ({ ...s, text: typeof newText === 'function' ? newText(s.text) : newText }));
  }, [setAppState]);

  const setTextStyle = useCallback((newStyle: typeof initialStyle | ((prev: typeof initialStyle) => typeof initialStyle)) => {
    setAppState(s => ({ ...s, textStyle: typeof newStyle === 'function' ? newStyle(s.textStyle) : newStyle }));
  }, [setAppState]);

  const setImageStyle = useCallback((newStyle: typeof initialImageStyle | ((prev: typeof initialImageStyle) => typeof initialImageStyle)) => {
    setAppState(s => ({ ...s, imageStyle: typeof newStyle === 'function' ? newStyle(s.imageStyle) : newStyle }));
  }, [setAppState]);
  
  const exportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setText((prev) => {
          const newText = prev + transcript;
          return newText.slice(0, 50);
        });
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [setText]);

  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const isRotated = imageStyle.rotate % 180 !== 0;
      canvas.width = isRotated ? img.height : img.width;
      canvas.height = isRotated ? img.width : img.height;

      ctx.filter = `brightness(${imageStyle.brightness}%) contrast(${imageStyle.contrast}%) saturate(${imageStyle.saturation}%)`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((imageStyle.rotate * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    };
    img.src = imageUrl;
  }, [imageUrl, imageStyle.brightness, imageStyle.contrast, imageStyle.saturation, imageStyle.rotate]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("您的浏览器不支持语音输入功能，请尝试使用 Chrome 或 Safari。");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const processFile = async (file: File) => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setImageFile(file);
      setImageUrl(dataUrl); // Use base64 Data URL to prevent html-to-image CORS/tainted canvas issues
    } catch (error) {
      console.error("Error reading file:", error);
      alert("读取图片失败，请重试");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const handleDownload = useCallback(async () => {
    if (exportRef.current === null) return;
    
    setIsSaving(true);
    try {
      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedImage(dataUrl);
    } catch (err) {
      console.error('Failed to export image', err);
      alert('生成图片失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [exportRef]);

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = `xiaohongshu-${Date.now()}.png`;
    link.href = generatedImage;
    link.click();
  };

  const handleClear = () => {
    setImageFile(null);
    setImageUrl(null);
    setText('');
  };

  const currentStep = !imageUrl ? 1 : (!text ? 2 : 3);

  return (
    <div className="min-h-screen bg-neutral-900 flex justify-center font-sans sm:p-4">
      <div className="w-full max-w-[430px] bg-neutral-50 flex flex-col h-screen h-[100dvh] sm:h-[calc(100vh-2rem)] sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden sm:border-[8px] border-neutral-800">
        <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between shrink-0 z-10">
          <h1 className="text-lg font-bold text-neutral-800 flex items-center gap-1.5">
            <Type className="w-5 h-5 text-red-500" />
            画里有话
          </h1>
          <div className="flex items-center gap-2">
            {imageUrl && (
              <>
                <button
                  onClick={handleClear}
                  className="text-neutral-500 hover:text-red-500 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                  aria-label="清空"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isSaving}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-70"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isSaving ? '保存中' : '保存'}
                </button>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Steps Indicator */}
          <div className="bg-neutral-50/80 backdrop-blur border-b border-neutral-200 px-4 py-2.5 flex items-center justify-center gap-2 sm:gap-4 text-xs shrink-0 z-10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className={cn("flex items-center gap-1.5 whitespace-nowrap transition-colors", currentStep === 1 ? "text-red-500 font-medium" : "text-neutral-700")}>
              <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px]", currentStep === 1 ? "bg-red-500 text-white" : "bg-neutral-700 text-white")}>1</span>
              上传图片
            </div>
            <ChevronRight className="w-3 h-3 text-neutral-300 shrink-0" />
            <div className={cn("flex items-center gap-1.5 whitespace-nowrap transition-colors", currentStep === 2 ? "text-red-500 font-medium" : (currentStep > 2 ? "text-neutral-700" : "text-neutral-400"))}>
              <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px]", currentStep === 2 ? "bg-red-500 text-white" : (currentStep > 2 ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-500"))}>2</span>
              确定文案
            </div>
            <ChevronRight className="w-3 h-3 text-neutral-300 shrink-0" />
            <div className={cn("flex items-center gap-1.5 whitespace-nowrap transition-colors", currentStep === 3 ? "text-red-500 font-medium" : "text-neutral-400")}>
              <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px]", currentStep === 3 ? "bg-red-500 text-white" : "bg-neutral-200 text-neutral-500")}>3</span>
              调整格式
            </div>
            <ChevronRight className="w-3 h-3 text-neutral-300 shrink-0" />
            <div className={cn("flex items-center gap-1.5 whitespace-nowrap transition-colors", currentStep === 3 ? "text-red-500 font-medium" : "text-neutral-400")}>
              <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[10px]", currentStep === 3 ? "bg-red-500 text-white" : "bg-neutral-200 text-neutral-500")}>4</span>
              保存图片
            </div>
          </div>

        {/* Top: Canvas */}
        <div className="flex-1 bg-neutral-100 flex items-center justify-center p-4 overflow-hidden relative">
          {!imageUrl ? (
            <label 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="w-full aspect-[3/4] border-2 border-dashed border-neutral-300 rounded-2xl flex flex-col items-center justify-center bg-white hover:bg-neutral-50 transition-colors cursor-pointer shadow-sm"
            >
              <Upload className="w-10 h-10 text-neutral-400 mb-3" />
              <span className="text-neutral-600 font-medium text-base">点击上传图片</span>
              <span className="text-neutral-400 text-xs mt-1">支持 JPG, PNG</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          ) : (
            <div 
              ref={exportRef}
              className="relative shadow-lg bg-white overflow-hidden flex items-center justify-center"
              style={{ 
                width: imageStyle.aspectRatio === 'original' ? 'fit-content' : '100%', 
                height: imageStyle.aspectRatio === 'original' ? 'fit-content' : '100%', 
                maxWidth: '100%', 
                maxHeight: '100%',
                aspectRatio: imageStyle.aspectRatio === 'original' ? 'auto' : imageStyle.aspectRatio.replace(':', '/'),
              }}
            >
              <canvas 
                ref={canvasRef}
                className="block pointer-events-none"
                style={{
                  width: imageStyle.aspectRatio === 'original' ? 'auto' : '100%',
                  height: imageStyle.aspectRatio === 'original' ? 'auto' : '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: imageStyle.aspectRatio === 'original' ? 'contain' : 'cover',
                }}
              />
              {text && (
                <motion.div
                  drag
                  dragMomentum={false}
                  initial={{ x: '-50%', y: '-50%' }}
                  whileDrag={{ 
                    scale: 1.05, 
                    rotate: -1.5,
                    backgroundColor: "rgba(0, 0, 0, 0.15)"
                  }}
                  className="absolute top-1/2 left-1/2 cursor-move active:cursor-grabbing whitespace-pre-wrap px-4 py-2 hover:bg-black/5 transition-colors rounded"
                  style={{
                    color: textStyle.color,
                    fontSize: `${textStyle.fontSize}px`,
                    fontWeight: textStyle.fontWeight,
                    textShadow: textStyle.textShadow,
                    textAlign: textStyle.textAlign as any,
                    fontFamily: textStyle.fontFamily,
                    fontStyle: textStyle.isItalic ? 'italic' : 'normal',
                    textDecoration: [
                      textStyle.isUnderline ? 'underline' : '',
                      textStyle.isStrikethrough ? 'line-through' : ''
                    ].filter(Boolean).join(' ') || 'none',
                    opacity: textStyle.opacity,
                    lineHeight: 1.4,
                    width: 'max-content',
                    maxWidth: '90%',
                  }}
                >
                  {text}
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Bottom: Controls */}
        {imageUrl && (
          <div className="w-full h-[45dvh] bg-white border-t border-neutral-200 flex flex-col overflow-y-auto shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.05)] z-10 pb-8">
            <div className="p-5 space-y-6">
              
              {/* Text Input & Quick Icons */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      文案内容
                      <div className="flex items-center gap-1 ml-2 border-l border-neutral-200 pl-2">
                        <button 
                          onClick={undo} 
                          disabled={!canUndo} 
                          className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 transition-colors rounded hover:bg-neutral-100"
                          title="撤销 (Undo)"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={redo} 
                          disabled={!canRedo} 
                          className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 transition-colors rounded hover:bg-neutral-100"
                          title="重做 (Redo)"
                        >
                          <Redo2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </label>
                    <button 
                      onClick={toggleListening}
                      className={cn(
                        "text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-full",
                        isListening 
                          ? "bg-red-100 text-red-600 animate-pulse" 
                          : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
                      )}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          停止录音
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          语音输入
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full h-20 p-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm shadow-sm"
                    placeholder="输入或生成文案..."
                    maxLength={50}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5 max-w-[80%]">
                      {['✨', '🔥', '💖', '🎀', '🌿', '📸', '📍', '💡'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setText(t => t.length < 50 ? t + emoji : t)}
                          className="w-7 h-7 flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 rounded-full text-sm transition-colors active:scale-95 border border-neutral-200"
                          title="点击插入"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="text-right text-xs text-neutral-400 shrink-0">
                      {text.length} / 50
                    </div>
                  </div>
                </div>
              </div>

              {/* Style Controls Tabs */}
              <div className="space-y-4">
                <div className="flex border-b border-neutral-200">
                  <button 
                    onClick={() => setActiveTab('font')} 
                    className={cn(
                      "flex-1 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5", 
                      activeTab === 'font' ? "border-red-500 text-red-500" : "border-transparent text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Type className="w-4 h-4" />
                    字体排版
                  </button>
                  <button 
                    onClick={() => setActiveTab('style')} 
                    className={cn(
                      "flex-1 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5", 
                      activeTab === 'style' ? "border-red-500 text-red-500" : "border-transparent text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Palette className="w-4 h-4" />
                    颜色外观
                  </button>
                  <button 
                    onClick={() => setActiveTab('image')} 
                    className={cn(
                      "flex-1 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5", 
                      activeTab === 'image' ? "border-red-500 text-red-500" : "border-transparent text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    图片调整
                  </button>
                </div>

                {/* Tab Content: Font */}
                {activeTab === 'font' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Font Family */}
                    <div className="space-y-3">
                      <span className="text-xs text-neutral-500">字体</span>
                      <select 
                        value={textStyle.fontFamily}
                        onChange={(e) => setTextStyle(s => ({ ...s, fontFamily: e.target.value }))}
                        className="w-full p-2.5 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none shadow-sm bg-white"
                      >
                        <option value="'Noto Sans SC', sans-serif">黑体 (默认)</option>
                        <option value="'Ma Shan Zheng', cursive">手写风</option>
                        <option value="'ZCOOL KuaiLe', sans-serif">可爱风</option>
                        <option value="'Noto Serif SC', serif">文艺宋体</option>
                      </select>
                    </div>

                    {/* Font Size */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-500">字号</span>
                        <span className="text-xs text-neutral-500 font-medium">{textStyle.fontSize}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="12" 
                        max="120" 
                        value={textStyle.fontSize}
                        onChange={(e) => setTextStyle(s => ({ ...s, fontSize: Number(e.target.value) }))}
                        className="w-full accent-red-500"
                      />
                    </div>

                    {/* Font Weight */}
                    <div className="space-y-3">
                      <span className="text-xs text-neutral-500">粗细</span>
                      <div className="flex bg-neutral-100 rounded-lg p-1">
                        {['normal', 'bold', '900'].map(w => (
                          <button
                            key={w}
                            onClick={() => setTextStyle(s => ({ ...s, fontWeight: w }))}
                            className={cn(
                              "flex-1 py-1.5 text-xs rounded-md transition-all",
                              textStyle.fontWeight === w ? "bg-white shadow-sm font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                            )}
                          >
                            {w === 'normal' ? '常规' : w === 'bold' ? '加粗' : '特粗'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text Formatting & Align */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <span className="text-xs text-neutral-500">格式</span>
                        <div className="flex bg-neutral-100 rounded-lg p-1 gap-1">
                          <button
                            onClick={() => setTextStyle(s => ({ ...s, isItalic: !s.isItalic }))}
                            className={cn(
                              "flex-1 py-1.5 flex justify-center items-center rounded-md transition-all",
                              textStyle.isItalic ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                            )}
                            title="斜体"
                          >
                            <Italic className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setTextStyle(s => ({ ...s, isUnderline: !s.isUnderline }))}
                            className={cn(
                              "flex-1 py-1.5 flex justify-center items-center rounded-md transition-all",
                              textStyle.isUnderline ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                            )}
                            title="下划线"
                          >
                            <Underline className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setTextStyle(s => ({ ...s, isStrikethrough: !s.isStrikethrough }))}
                            className={cn(
                              "flex-1 py-1.5 flex justify-center items-center rounded-md transition-all",
                              textStyle.isStrikethrough ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                            )}
                            title="删除线"
                          >
                            <Strikethrough className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <span className="text-xs text-neutral-500">对齐</span>
                        <div className="flex bg-neutral-100 rounded-lg p-1">
                          {['left', 'center', 'right'].map(a => (
                            <button
                              key={a}
                              onClick={() => setTextStyle(s => ({ ...s, textAlign: a }))}
                              className={cn(
                                "flex-1 py-1.5 text-xs rounded-md transition-all",
                                textStyle.textAlign === a ? "bg-white shadow-sm font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                              )}
                            >
                              {a === 'left' ? '左' : a === 'center' ? '中' : '右'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content: Style */}
                {activeTab === 'style' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Color */}
                    <div className="space-y-3">
                      <span className="text-xs text-neutral-500">颜色</span>
                      <div className="flex gap-3 flex-wrap">
                        {['#FFFFFF', '#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'].map(c => (
                          <button
                            key={c}
                            onClick={() => setTextStyle(s => ({ ...s, color: c }))}
                            className={cn(
                              "w-8 h-8 rounded-full border border-neutral-200 shadow-sm transition-transform active:scale-95",
                              textStyle.color === c && "ring-2 ring-offset-2 ring-red-500"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Opacity */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-500">透明度</span>
                        <span className="text-xs text-neutral-500 font-medium">{Math.round(textStyle.opacity * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1" 
                        step="0.05"
                        value={textStyle.opacity}
                        onChange={(e) => setTextStyle(s => ({ ...s, opacity: Number(e.target.value) }))}
                        className="w-full accent-red-500"
                      />
                    </div>

                    {/* Text Shadow */}
                    <div className="space-y-3">
                      <span className="text-xs text-neutral-500">文字描边/阴影</span>
                      <select 
                        value={textStyle.textShadow}
                        onChange={(e) => setTextStyle(s => ({ ...s, textShadow: e.target.value }))}
                        className="w-full p-2.5 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none shadow-sm bg-white"
                      >
                        <option value="none">无</option>
                        <option value="0 2px 4px rgba(0,0,0,0.5)">轻微阴影</option>
                        <option value="0 4px 8px rgba(0,0,0,0.8)">重度阴影</option>
                        <option value="-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000">黑色细描边</option>
                        <option value="-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000">黑色粗描边</option>
                        <option value="-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff">白色细描边</option>
                        <option value="-2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff">白色粗描边</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Tab Content: Image */}
                {activeTab === 'image' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Aspect Ratio */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">图片比例</span>
                        <button
                          onClick={() => setImageStyle(s => ({ ...s, rotate: (s.rotate + 90) % 360 }))}
                          className="flex items-center gap-1.5 px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded transition-colors text-xs font-medium"
                        >
                          <RotateCw className="w-3 h-3" />
                          旋转 90°
                        </button>
                      </div>
                      <div className="flex bg-neutral-100 rounded-lg p-1 flex-wrap gap-1">
                        {['original', '1:1', '3:4', '4:3', '9:16', '16:9'].map(ratio => (
                          <button
                            key={ratio}
                            onClick={() => setImageStyle(s => ({ ...s, aspectRatio: ratio }))}
                            className={cn(
                              "flex-1 min-w-[45px] py-1.5 text-xs rounded-md transition-all",
                              imageStyle.aspectRatio === ratio ? "bg-white shadow-sm font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                            )}
                          >
                            {ratio === 'original' ? '原图' : ratio}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Brightness */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-500">亮度</span>
                        <span className="text-xs text-neutral-500 font-medium">{imageStyle.brightness}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="200" 
                        value={imageStyle.brightness}
                        onChange={(e) => setImageStyle(s => ({ ...s, brightness: Number(e.target.value) }))}
                        className="w-full accent-red-500"
                      />
                    </div>

                    {/* Contrast */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-500">对比度</span>
                        <span className="text-xs text-neutral-500 font-medium">{imageStyle.contrast}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="200" 
                        value={imageStyle.contrast}
                        onChange={(e) => setImageStyle(s => ({ ...s, contrast: Number(e.target.value) }))}
                        className="w-full accent-red-500"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs text-neutral-500">饱和度</span>
                        <span className="text-xs text-neutral-500 font-medium">{imageStyle.saturation}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="200" 
                        value={imageStyle.saturation}
                        onChange={(e) => setImageStyle(s => ({ ...s, saturation: Number(e.target.value) }))}
                        className="w-full accent-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Save Image Modal */}
      {generatedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
          <button
            onClick={() => setGeneratedImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="text-center mb-6">
            <h3 className="text-white text-lg font-medium mb-2">生成成功 🎉</h3>
            <p className="text-white/70 text-sm bg-white/10 px-4 py-2 rounded-full inline-block">
              👇 请长按下方图片保存到手机相册
            </p>
          </div>

          <img 
            src={generatedImage} 
            alt="Generated" 
            className="max-w-full max-h-[60vh] rounded-lg shadow-2xl object-contain"
          />

          <div className="mt-8 flex gap-4">
            <button
              onClick={downloadImage}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              电脑端下载
            </button>
            <button
              onClick={() => setGeneratedImage(null)}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
