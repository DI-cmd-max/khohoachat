import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Download, 
  ArrowUpRight, 
  Upload, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  AlertCircle,
  FileCheck,
  Plus,
  Loader2
} from 'lucide-react';
import { ReagentMaterial, LabCategory, User } from '../types';

// Helper for image compression
function compressImage(base64Str: string, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
}

interface DocsViewerTabProps {
  reagents: ReagentMaterial[];
  onEditReagent: (updated: ReagentMaterial) => Promise<void>;
  currentUser: User;
}

export default function DocsViewerTab({ reagents, onEditReagent, currentUser }: DocsViewerTabProps) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LabCategory | 'Tất cả'>('Tất cả');
  const [selectedReagentId, setSelectedReagentId] = useState<string | null>(null);
  
  // Image zoom state
  const [zoomScale, setZoomScale] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active reagent object
  const activeReagent = reagents.find(r => r.id === selectedReagentId);

  // PDF blob URL generation
  const [activePdfBlobUrl, setActivePdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeReagent && activeReagent.attachmentUrl) {
      const dataUrl = activeReagent.attachmentUrl;
      if (dataUrl.startsWith('data:')) {
        try {
          const arr = dataUrl.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          const url = URL.createObjectURL(blob);
          setActivePdfBlobUrl(url);
          return () => {
            URL.revokeObjectURL(url);
          };
        } catch (e) {
          console.error('Error generating PDF blob URL:', e);
          setActivePdfBlobUrl(dataUrl);
        }
      } else {
        setActivePdfBlobUrl(dataUrl);
      }
    } else {
      setActivePdfBlobUrl(null);
    }
  }, [selectedReagentId, activeReagent?.attachmentUrl]);

  // Handle uploading/dragging file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeReagent) return;
    await processAndSaveFile(file);
  };

  const processAndSaveFile = async (file: File) => {
    if (!activeReagent) return;
    
    const type = file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'other';

    if (type === 'pdf') {
      const maxPdfSize = 650 * 1024; // 650 KB limit to prevent Firestore exceeding document limits
      if (file.size > maxPdfSize) {
        alert(`Tài liệu PDF quá lớn (${(file.size / 1024 / 1024).toFixed(2)} MB).\nVui lòng chọn file PDF có dung lượng nhỏ hơn 650 KB để đảm bảo lưu trữ ổn định trên hệ thống.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      let base64Data = reader.result as string;
      if (type === 'image') {
        try {
          base64Data = await compressImage(base64Data, 1000, 1000, 0.7);
        } catch (err) {
          console.error('Image compression error:', err);
        }
      }

      try {
        await onEditReagent({
          ...activeReagent,
          attachmentUrl: base64Data,
          attachmentName: file.name,
          attachmentType: type
        });
      } catch (error) {
        console.error('Error saving document:', error);
        alert('Gặp lỗi khi lưu tài liệu lên cơ sở dữ liệu.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDocument = async () => {
    if (!activeReagent) return;
    if (confirm(`Bạn có thực sự muốn xóa tài liệu HDSD của hóa chất "${activeReagent.name}"?`)) {
      try {
        setIsUploading(true);
        const updatedReagent = { ...activeReagent };
        delete updatedReagent.attachmentUrl;
        delete updatedReagent.attachmentName;
        delete updatedReagent.attachmentType;
        
        await onEditReagent(updatedReagent);
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Gặp lỗi khi xóa tài liệu.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Filter lists
  const filteredReagents = reagents.filter(reagent => {
    const matchesSearch = reagent.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          reagent.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          reagent.lotNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Tất cả' || reagent.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Reagents that already have manuals
  const reagentsWithDocs = filteredReagents.filter(r => !!r.attachmentUrl);
  // Reagents that don't have manuals yet
  const reagentsWithoutDocs = filteredReagents.filter(r => !r.attachmentUrl);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row min-h-[500px] md:h-[calc(100vh-230px)] overflow-x-hidden" id="docs-viewer-container">
      {/* Sidebar List */}
      <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col md:h-full max-h-[50vh] md:max-h-none bg-slate-50 shrink-0">
        <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-800">Tài liệu & HDSD</h2>
          </div>
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, ID, mã lô..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
            />
          </div>

          {/* Categories select buttons */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {(['Tất cả', 'Sinh hóa', 'Huyết học', 'Miễn dịch'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Reagents list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Active documents section */}
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Đã có tài liệu ({reagentsWithDocs.length})
            </div>
            {reagentsWithDocs.length === 0 ? (
              <div className="text-center p-4 text-xs text-slate-400 italic bg-white rounded-xl border border-slate-100">
                Chưa có tài liệu nào
              </div>
            ) : (
              <div className="space-y-1">
                {reagentsWithDocs.map(reagent => {
                  const isActive = reagent.id === selectedReagentId;
                  return (
                    <button
                      key={reagent.id}
                      onClick={() => {
                        setSelectedReagentId(reagent.id);
                        setZoomScale(1);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-2.5 border cursor-pointer ${
                        isActive
                          ? 'bg-teal-50 border-teal-200 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 border-slate-100'
                      }`}
                    >
                      {reagent.attachmentType === 'pdf' ? (
                        <FileText className={`h-5 w-5 shrink-0 ${isActive ? 'text-teal-600' : 'text-rose-500'}`} />
                      ) : (
                        <ImageIcon className={`h-5 w-5 shrink-0 ${isActive ? 'text-teal-600' : 'text-indigo-500'}`} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold break-words whitespace-normal ${isActive ? 'text-teal-900' : 'text-slate-700'}`}>
                          {reagent.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded-sm font-medium break-all">{reagent.id}</span>
                          <span className="break-words whitespace-normal">Lô: {reagent.lotNumber}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Need documents section */}
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Chưa có tài liệu ({reagentsWithoutDocs.length})</span>
            </div>
            {reagentsWithoutDocs.length > 0 && (
              <div className="space-y-1">
                {reagentsWithoutDocs.map(reagent => {
                  const isActive = reagent.id === selectedReagentId;
                  return (
                    <button
                      key={reagent.id}
                      onClick={() => {
                        setSelectedReagentId(reagent.id);
                        setZoomScale(1);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2 border cursor-pointer ${
                        isActive
                          ? 'bg-teal-50 border-teal-200'
                          : 'bg-white hover:bg-slate-100 border-dashed border-slate-200'
                      }`}
                    >
                      <Plus className="h-4 w-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-600 break-words whitespace-normal">
                          {reagent.name}
                        </div>
                        <div className="text-[9px] text-slate-400 break-words whitespace-normal mt-0.5">
                          {reagent.id} • {reagent.category}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col md:h-full bg-slate-50 relative">
        {activeReagent ? (
          <div className="flex-1 flex flex-col md:h-full overflow-hidden bg-white">
            {/* Header / Actions bar */}
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    activeReagent.category === 'Sinh hóa' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    activeReagent.category === 'Huyết học' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                    'bg-purple-50 text-purple-700 border border-purple-100'
                  }`}>
                    {activeReagent.category}
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {activeReagent.id}</span>
                </div>
                <h1 className="text-sm font-black text-slate-900 mt-1">{activeReagent.name}</h1>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Lô sản xuất: <span className="font-semibold text-slate-600">{activeReagent.lotNumber}</span> • Hãng: <span className="font-semibold text-slate-600">{activeReagent.manufacturer}</span>
                </p>
              </div>

              {/* Operations */}
              <div className="flex items-center gap-2">
                {activeReagent.attachmentUrl && (
                  <>
                    {activeReagent.attachmentType === 'pdf' && activePdfBlobUrl && (
                      <a
                        href={activePdfBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-teal-100 shadow-2xs"
                        title="Mở tài liệu trong cửa sổ trình duyệt mới"
                      >
                        <ArrowUpRight className="h-4 w-4" /> Mở cửa sổ mới
                      </a>
                    )}
                    
                    <a
                      href={activePdfBlobUrl || activeReagent.attachmentUrl}
                      download={activeReagent.attachmentName || `hdsd-${activeReagent.id}`}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-slate-200 shadow-2xs"
                      title="Tải tài liệu về máy"
                    >
                      <Download className="h-4 w-4" /> Tải về
                    </a>

                    {(currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.role === 'KTV_Truong' || currentUser.username === 'admin') && (
                      <button
                        disabled={isUploading}
                        onClick={handleDeleteDocument}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-100 cursor-pointer"
                        title="Xóa tài liệu"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Document display section */}
            <div className="flex-1 min-h-0 bg-slate-100 flex flex-col relative overflow-hidden">
              {isUploading ? (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 text-teal-600 animate-spin mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-700">Đang xử lý tài liệu...</p>
                    <p className="text-[10px] text-slate-400 mt-1">Vui lòng không tắt trình duyệt</p>
                  </div>
                </div>
              ) : null}

              {activeReagent.attachmentUrl ? (
                activeReagent.attachmentType === 'pdf' ? (
                  <div className="flex-1 flex flex-col h-full">
                    {/* Embedded PDF iframe */}
                    <div className="flex-1 min-h-[400px] md:min-h-0 bg-slate-700 w-full h-96 md:h-full">
                      {activePdfBlobUrl ? (
                        <iframe
                          src={activePdfBlobUrl}
                          title={activeReagent.attachmentName || 'Tài liệu kỹ thuật'}
                          className="w-full h-full border-none"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-300">
                          <Loader2 className="h-6 w-6 animate-spin text-teal-500 mr-2" />
                          <span className="text-xs font-medium">Đang chuẩn bị xem file PDF...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Image viewing with controls
                  <div className="flex-1 flex flex-col h-full relative bg-slate-900 select-none overflow-hidden">
                    {/* Zoom controls */}
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1.5 rounded-xl border border-white/15">
                      <button
                        onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                        className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
                        title="Thu nhỏ"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </button>
                      <span className="text-[10px] text-white font-mono px-1 font-bold">
                        {Math.round(zoomScale * 100)}%
                      </span>
                      <button
                        onClick={() => setZoomScale(prev => Math.min(3, prev + 0.25))}
                        className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
                        title="Phóng to"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setZoomScale(1)}
                        className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
                        title="Khôi phục"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Draggable/scrolling Image wrapper */}
                    <div className="flex-1 overflow-auto flex items-center justify-center p-6">
                      <img
                        src={activeReagent.attachmentUrl}
                        alt={activeReagent.attachmentName || 'Tài liệu quy trình'}
                        className="max-w-none origin-center transition-transform duration-200 shadow-xl rounded-lg"
                        style={{ transform: `scale(${zoomScale})` }}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )
              ) : (
                // Upload prompt area for this reagent
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
                    <Upload className="h-10 w-10 text-teal-600 mx-auto mb-4 stroke-[1.5]" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Chưa có tài liệu đính kèm</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">
                      Hãy đính kèm tài liệu Hướng dẫn sử dụng (HDSD), Quy trình thao tác (SOP), hay Quy trình kỹ thuật cho hóa chất <strong>{activeReagent.name}</strong>.
                    </p>

                    <div className="space-y-4">
                      {/* File select drop area */}
                      <label className="block border-2 border-dashed border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 transition-all rounded-xl p-4 cursor-pointer text-center relative">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="application/pdf,image/*"
                          className="hidden"
                        />
                        <FileCheck className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                        <span className="block text-xs font-semibold text-teal-600">Chọn file từ thiết bị</span>
                        <span className="block text-[10px] text-slate-400 mt-1">Hỗ trợ PDF (dưới 650KB) hoặc Hình ảnh</span>
                      </label>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Lưu ý: Để tránh vượt quá dung lượng lưu trữ tối đa của cơ sở dữ liệu Cloud, vui lòng chọn file có kích thước nhỏ gọn. File PDF nên nén lại trước khi tải lên.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // General welcome screen / No reagent selected
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <div className="max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-xs">
              <div className="h-16 w-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-teal-100">
                <BookOpen className="h-8 w-8 text-teal-600" />
              </div>
              
              <h2 className="text-base font-black text-slate-900 mb-2">Tra cứu Quy trình kỹ thuật & HDSD</h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Chào mừng bạn đến với thư viện tra cứu trực tiếp tài liệu kỹ thuật của Khoa Xét nghiệm. Bạn có thể xem các sơ đồ quy trình, tài liệu SOP, file HDSD của từng danh mục hóa chất, vật tư y tế.
              </p>

              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="h-5 w-5 rounded-full bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-700">Chọn hóa chất cần tra cứu</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">Sử dụng bộ tìm kiếm hoặc nhấp vào danh mục y tế ở thanh bên trái.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="h-5 w-5 rounded-full bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-700">Đọc tài liệu trực tuyến</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">Xem file PDF hoặc phóng to hình ảnh sơ đồ trực tiếp trong ứng dụng.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="h-5 w-5 rounded-full bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-700">Bổ sung tài liệu thiếu</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">Nếu hóa chất chưa có tài liệu, bạn có thể dễ dàng tải lên một bản mới.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
