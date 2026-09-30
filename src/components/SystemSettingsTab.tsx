import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Upload, 
  Trash2, 
  Save, 
  CheckCircle, 
  FileText, 
  AlertCircle 
} from 'lucide-react';
import { SystemSettings, User } from '../types';

interface SystemSettingsTabProps {
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => Promise<void>;
  currentUser: User;
}

export default function SystemSettingsTab({
  settings,
  onSaveSettings,
  currentUser
}: SystemSettingsTabProps) {
  const [logoBase64, setLogoBase64] = useState<string>(settings.hospitalLogo || '');
  const [header1, setHeader1] = useState(settings.headerRow1 || '');
  const [header2, setHeader2] = useState(settings.headerRow2 || '');
  const [header3, setHeader3] = useState(settings.headerRow3 || '');
  const [header4, setHeader4] = useState(settings.headerRow4 || '');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state with props when they load
  useEffect(() => {
    if (settings) {
      setLogoBase64(settings.hospitalLogo || '');
      setHeader1(settings.headerRow1 || '');
      setHeader2(settings.headerRow2 || '');
      setHeader3(settings.headerRow3 || '');
      setHeader4(settings.headerRow4 || '');
    }
  }, [settings]);

  // Handle image logo upload & conversion to base64
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to images and reasonable size (e.g., 1MB to prevent Firestore size limit issues)
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Vui lòng chọn tệp tin hình ảnh hợp lệ (PNG, JPG, SVG).');
      return;
    }

    if (file.size > 1024 * 1024) {
      setErrorMsg('Kích thước ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 1MB để đảm bảo hiệu năng lưu trữ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoBase64(reader.result);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Lỗi khi đọc file logo.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoBase64('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      const updatedSettings: SystemSettings = {
        hospitalLogo: logoBase64,
        headerRow1: header1.trim() || 'QT-QLCL-05-BM03',
        headerRow2: header2.trim() || 'Phiên bản: 1.2 (2429-QĐ/BYT)',
        headerRow3: header3.trim() || 'Ngày hiệu lực:',
        headerRow4: header4.trim() || '15/07/2026'
      };

      await onSaveSettings(updatedSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu cấu hình.');
    } finally {
      setIsSaving(false);
    }
  };

  // Check permission: Admin, Pho_Khoa, KTV_Truong
  const canEdit = currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.role === 'KTV_Truong' || currentUser.username === 'admin';

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="system-settings-tab">
      
      {/* Tab Header Card */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-2xs">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Cài đặt Hệ thống & Thương hiệu</h1>
              <p className="text-xs text-slate-500 mt-1">Cấu hình logo bệnh viện, tên phòng khoa và số hiệu tài liệu tiêu chuẩn cho các báo cáo PDF và bản in.</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Hospital Logo Upload */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Upload className="h-4 w-4 text-slate-500" />
              Logo Bệnh viện (Hospital Logo)
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Tải lên hình ảnh Logo bệnh viện của bạn. Ảnh logo này sẽ được tự động đính kèm ở góc trên bên trái của mọi phiếu xuất báo cáo PDF và giao diện in ấn. Khuyên dùng ảnh nền trong suốt dạng PNG, kích thước tối đa 1MB.
            </p>

            {/* Logo Preview Container */}
            <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px] bg-slate-50 relative group">
              {logoBase64 ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 max-h-[120px] max-w-[120px] flex items-center justify-center">
                    <img 
                      src={logoBase64} 
                      alt="Hospital Logo Preview" 
                      className="max-h-24 max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={!canEdit}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa Logo hiện tại
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600 mb-1">Chưa có Logo</p>
                  <p className="text-[10px] text-slate-400">Click nút bên dưới để chọn ảnh</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            {canEdit ? (
              <label className="block">
                <span className="sr-only">Chọn tệp tin logo</span>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="block w-full text-xs text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-xl file:border-0
                    file:text-xs file:font-semibold
                    file:bg-slate-100 file:text-slate-700
                    hover:file:bg-slate-200
                    file:cursor-pointer"
                />
              </label>
            ) : (
              <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Bạn không có quyền sửa cấu hình logo (Chỉ dành cho Ban lãnh đạo).
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Standard Document Header Config */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              Cấu hình Số hiệu văn bản (Header PDF)
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Thiết lập mã văn bản tiêu chuẩn hiển thị ở góc trên bên phải của các biểu mẫu báo cáo PDF, bảo đảm sự tuân thủ nghiêm ngặt theo tiêu chuẩn phòng xét nghiệm (ISO 15189 / Chuẩn 2429).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Hàng 1: Số hiệu văn bản / Mã tài liệu
                </label>
                <input
                  type="text"
                  value={header1}
                  onChange={(e) => setHeader1(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Ví dụ: BM.XN.05-BM03 hoặc QT-QLCL-05-BM03"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Hàng 2: Phiên bản tài liệu
                </label>
                <input
                  type="text"
                  value={header2}
                  onChange={(e) => setHeader2(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Ví dụ: Phiên bản: 1.2 (2429-QĐ/BYT)"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Hàng 3: Ngày hiệu lực (Tiêu đề)
                </label>
                <input
                  type="text"
                  value={header3}
                  onChange={(e) => setHeader3(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Ví dụ: Ngày hiệu lực:"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Hàng 4: Ngày hiệu lực (Giá trị ngày)
                </label>
                <input
                  type="text"
                  value={header4}
                  onChange={(e) => setHeader4(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Ví dụ: 15/07/2026"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {errorMsg && (
              <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorMsg}
              </div>
            )}

            {saveSuccess && (
              <div className="text-xs text-teal-700 bg-teal-50 p-2.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-teal-600" />
                Lưu cài đặt hệ thống thành công!
              </div>
            )}

            {canEdit && (
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Đang lưu cài đặt...' : 'Lưu cấu hình hệ thống'}
              </button>
            )}
          </div>
        </div>

      </form>

      {/* Quick Visual Demonstration / Live Print Preview Mockup */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Minh họa bố cục in ấn thực tế (PDF Header Mockup)</h3>
        
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 font-serif text-slate-800 text-[11px] leading-relaxed max-w-full overflow-x-auto">
          <div className="flex justify-between items-start border-b border-black pb-3 mb-4">
            
            {/* Logo and Department */}
            <div className="flex items-center gap-3">
              {logoBase64 ? (
                <img 
                  src={logoBase64} 
                  alt="Hospital Logo" 
                  className="h-10 w-10 object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-10 w-10 border border-dashed border-slate-300 rounded-md bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 font-sans text-center">
                  Logo
                </div>
              )}
              <div className="font-sans">
                <div className="uppercase font-semibold text-[10px]">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</div>
                <div className="uppercase font-bold text-[11px]">BỆNH VIỆN ĐA KHOA THÀNH PHỐ CẦN THƠ</div>
                <div className="text-[10px] border-t border-black/20 mt-0.5 pt-0.5">KHOA XÉT NGHIỆM</div>
              </div>
            </div>

            {/* Configured Document Code Block */}
            <div className="text-right font-sans text-[10px]">
              <div>Số tài liệu: <span className="font-semibold text-slate-900">{header1 || 'QT-QLCL-05-BM03'}</span></div>
              <div>{header2 || 'Phiên bản: 1.2 (2429-QĐ/BYT)'}</div>
              <div>{header3 || 'Ngày hiệu lực:'} <span className="font-medium">{header4 || '15/07/2026'}</span></div>
            </div>

          </div>

          <div className="text-center py-6 font-sans">
            <h4 className="text-xs font-bold tracking-wider">[TIÊU ĐỀ PHIẾU KIỂM SOÁT IN ẤN]</h4>
            <p className="text-[9px] text-slate-400 italic mt-1">Dữ liệu mẫu của phiếu in ấn...</p>
          </div>
        </div>
      </div>

    </div>
  );
}
