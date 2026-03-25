import { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { toPng } from 'html-to-image';
import { Upload, Download, RefreshCw, Type, Palette, Trash2 } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [textStyle, setTextStyle] = useState({
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
    textShadow: '0 4px 8px rgba(0,0,0,0.8)',
    textAlign: 'center',
    fontFamily: "'Noto Sans SC', sans-serif",
  });
  
  const exportRef = useRef<HTMLDivElement>(null);

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
      generateCopy(dataUrl.split(',')[1], file.type);
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

  const generateCopy = async (base64Data: string, mimeType: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64Data, mimeType }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.text) {
        setText(data.text);
      }
    } catch (error) {
      console.error("Failed to generate copy:", error);
      alert("生成文案失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (exportRef.current === null) return;
    
    setIsSaving(true);
    try {
      // html-to-image can sometimes fail on the first pass with custom fonts,
      // but using base64 images usually solves the main issue.
      const dataUrl = await toPng(exportRef.current, { 
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: false
      });
      const link = document.createElement('a');
      link.download = `xiaohongshu-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert('保存图片失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [exportRef]);

  const handleClear = () => {
    setImageFile(null);
    setImageUrl(null);
    setText('');
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex justify-center font-sans sm:p-4">
      <div className="w-full max-w-[430px] bg-neutral-50 flex flex-col h-[100dvh] sm:h-[calc(100vh-2rem)] sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden sm:border-[8px] border-neutral-800">
        <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between shrink-0 z-10">
          <h1 className="text-lg font-bold text-neutral-800 flex items-center gap-1.5">
            <Type className="w-5 h-5 text-red-500" />
            图文神器
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
              style={{ width: 'fit-content', height: 'fit-content', maxWidth: '100%', maxHeight: '100%' }}
            >
              <img 
                src={imageUrl} 
                alt="Uploaded" 
                className="max-w-full max-h-[80vh] object-contain block pointer-events-none"
                draggable={false}
              />
              {text && (
                <motion.div
                  drag
                  dragMomentum={false}
                  initial={{ x: '-50%', y: '-50%' }}
                  className="absolute top-1/2 left-1/2 cursor-move whitespace-pre-wrap px-4 py-2 hover:outline hover:outline-2 hover:outline-red-500/50 hover:bg-black/5 transition-colors rounded"
                  style={{
                    color: textStyle.color,
                    fontSize: `${textStyle.fontSize}px`,
                    fontWeight: textStyle.fontWeight,
                    textShadow: textStyle.textShadow,
                    textAlign: textStyle.textAlign as any,
                    fontFamily: textStyle.fontFamily,
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
              
              {/* Text Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-neutral-700">文案内容</label>
                  <button 
                    onClick={() => {
                      if (imageFile && imageUrl) {
                        generateCopy(imageUrl.split(',')[1], imageFile.type);
                      }
                    }}
                    disabled={isGenerating}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={cn("w-3 h-3", isGenerating && "animate-spin")} />
                    AI 重新生成
                  </button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full h-20 p-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm shadow-sm"
                  placeholder="输入或生成文案..."
                  maxLength={50}
                />
                <div className="text-right text-xs text-neutral-400">
                  {text.length} / 30
                </div>
              </div>

              {/* Style Controls */}
              <div className="space-y-6">
                <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2 border-b border-neutral-100 pb-2">
                  <Palette className="w-4 h-4" />
                  样式设置
                </label>
                
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

                {/* Text Align */}
                <div className="space-y-3">
                  <span className="text-xs text-neutral-500">对齐方式</span>
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
                        {a === 'left' ? '居左' : a === 'center' ? '居中' : '居右'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
