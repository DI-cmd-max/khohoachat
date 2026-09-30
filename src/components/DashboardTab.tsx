import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Beaker, 
  CheckCircle2, 
  TrendingDown, 
  ShieldAlert, 
  ArrowRight, 
  Layers, 
  Activity, 
  PackageCheck,
  FileCheck2,
  Upload,
  Plus,
  Check,
  FileSpreadsheet,
  Filter,
  Wrench,
  History,
  UserCheck,
  Download,
  Info,
  RefreshCw,
  X,
  User as UserIcon,
  Search
} from 'lucide-react';
import { IsoWarning, LabCategory, QcResult, User, ReagentMaterial, Transaction } from '../types';
import { INITIAL_QC_RESULTS } from '../mockData';
import { useInventoryForecast } from '../hooks/useInventoryForecast';

interface DashboardTabProps {
  warnings: IsoWarning[];
  totalReagents: number;
  activeOpenVials: number;
  activeReconstitutions: number;
  onNavigateToTab: (tabId: string, relatedId?: string, itemName?: string) => void;
  qcResults: QcResult[];
  onSaveQcResult: (qcResult: QcResult) => Promise<void>;
  onDeleteQcResult: (id: string) => Promise<void>;
  currentUser: User;
  reagents: ReagentMaterial[];
  transactions: Transaction[];
  simulatedTime: string;
}

export default function DashboardTab({
  warnings,
  totalReagents,
  activeOpenVials,
  activeReconstitutions,
  onNavigateToTab,
  qcResults = [],
  onSaveQcResult,
  onDeleteQcResult,
  currentUser,
  reagents,
  transactions,
  simulatedTime
}: DashboardTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<LabCategory | 'All'>('All');
  const inventoryForecast = useInventoryForecast(reagents || [], transactions || [], simulatedTime || new Date().toISOString());
  const [selectedSeverity, setSelectedSeverity] = useState<'All' | 'CRITICAL' | 'WARNING'>('All');

  // --- Daily QC Tracking States & Methods ---
  const [selectedQcCategory, setSelectedQcCategory] = useState<LabCategory | 'All'>('All');
  const [selectedMachine, setSelectedMachine] = useState<string>('All');
  const [selectedQcStatus, setSelectedQcStatus] = useState<string>('All');
  const [isQcUploading, setIsQcUploading] = useState<boolean>(false);
  const [selectedQcToCorrect, setSelectedQcToCorrect] = useState<QcResult | null>(null);
  const [qcToDelete, setQcToDelete] = useState<QcResult | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [correctiveAction, setCorrectiveAction] = useState<string>('Calib lại');
  const [customAction, setCustomAction] = useState<string>('');
  const [correctiveNotes, setCorrectiveNotes] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Clear toast after 4 seconds
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const parseQCFile = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedResults: QcResult[] = [];
    
    let separator = ',';
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine.includes(';')) separator = ';';
      else if (firstLine.includes('\t')) separator = '\t';
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header lines
      if (line.toLowerCase().includes('tên test') || 
          line.toLowerCase().includes('testname') || 
          line.toLowerCase().includes('parameter') || 
          line.toLowerCase().includes('phân loại') ||
          line.toLowerCase().includes('ngưỡng') ||
          line.toLowerCase().includes('mức qc')) {
        continue;
      }
      
      const columns = line.split(separator).map(col => col.replace(/^["']|["']$/g, '').trim());
      if (columns.length < 4) continue;
      
      const testName = columns[0];
      const categoryRaw = columns[1] || 'Sinh hóa';
      const level = columns[2] || 'Level 1';
      const valueNum = parseFloat(columns[3]);
      const minValNum = columns[4] ? parseFloat(columns[4]) : 0;
      const maxValNum = columns[5] ? parseFloat(columns[5]) : 1000;
      const unit = columns[6] || '';
      const westgardRule = columns[7] || '';
      const machineName = columns[8] || (categoryRaw.includes('Huyết') ? 'Sysmex XN-1000' : categoryRaw.includes('Miễn') ? 'Atellica Ci1900' : 'AU 680_2');
      
      if (!testName || isNaN(valueNum)) {
        continue;
      }
      
      let category: LabCategory = 'Sinh hóa';
      if (categoryRaw.includes('Huyết') || categoryRaw.toLowerCase().includes('hematology') || categoryRaw.toLowerCase().includes('hh') || categoryRaw.toLowerCase().includes('huyết học')) {
        category = 'Huyết học';
      } else if (categoryRaw.includes('Miễn') || categoryRaw.toLowerCase().includes('immuno') || categoryRaw.toLowerCase().includes('md') || categoryRaw.toLowerCase().includes('miễn dịch')) {
        category = 'Miễn dịch';
      }
      
      const minLimit = isNaN(minValNum) ? 0 : minValNum;
      const maxLimit = isNaN(maxValNum) ? 1000 : maxValNum;
      const isWarning = valueNum < minLimit || valueNum > maxLimit;
      const status = isWarning ? 'Warning' : 'Passed';
      const autoWestgard = isWarning ? (westgardRule || '1-3s (Vượt dải Min-Max cho phép)') : '';

      parsedResults.push({
        id: `QC-RES-${Date.now()}-${Math.floor(Math.random() * 10000)}-${i}`,
        date: new Date().toISOString().slice(0, 10),
        testName,
        category,
        level,
        machineName,
        value: valueNum,
        minVal: minLimit,
        maxVal: maxLimit,
        unit,
        status,
        westgardRule: autoWestgard
      });
    }
    
    return parsedResults;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsQcUploading(true);

    const fileType = file.type;
    const isPdfOrImage = fileType === 'application/pdf' || fileType.startsWith('image/') || file.name.endsWith('.pdf');

    if (isPdfOrImage) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64String = reader.result as string;
          const response = await fetch('/api/parse-qc-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileData: base64String,
              mimeType: fileType || 'application/pdf',
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Server error');
          }

          const data = await response.json();
          if (!data.qcResults || data.qcResults.length === 0) {
            setToast({ message: 'Không thể nhận diện bất kỳ kết quả QC nào từ tệp PDF/Hình ảnh này. Vui lòng đảm bảo tệp chứa báo cáo kết quả QC hợp lệ.', type: 'error' });
            return;
          }

          const parsedResults: QcResult[] = data.qcResults.map((res: any, index: number) => {
            const meanVal = typeof res.mean === 'number' ? res.mean : 0;
            const sdVal = typeof res.sd === 'number' ? res.sd : 0;
            const valueNum = typeof res.value === 'number' ? res.value : 0;
            
            // Accept range is Mean +/- 2SD by default
            const minVal = res.minVal !== undefined && res.minVal !== null ? res.minVal : (meanVal - 2 * sdVal);
            const maxVal = res.maxVal !== undefined && res.maxVal !== null ? res.maxVal : (meanVal + 2 * sdVal);

            let category: LabCategory = 'Sinh hóa';
            if (res.category === 'Huyết học' || res.category === 'Miễn dịch') {
              category = res.category;
            }

            // Strictly look at whether Accept column has a tick (Warning if status is Warning, else Passed)
            const isWarning = res.status === 'Warning';
            const status = isWarning ? 'Warning' : 'Passed';
            const machineName = res.machineName || (category === 'Huyết học' ? 'Sysmex XN-1000' : category === 'Miễn dịch' ? 'Atellica Ci1900' : 'AU 680_2');

            return {
              id: `QC-RES-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
              date: new Date().toISOString().slice(0, 10),
              testName: res.testName || 'Unknown',
              category: category,
              level: res.level || 'Level 1',
              machineName: machineName,
              value: valueNum,
              minVal: parseFloat(minVal.toFixed(2)),
              maxVal: parseFloat(maxVal.toFixed(2)),
              unit: res.unit || '',
              status: status,
              westgardRule: isWarning ? (res.westgardRule || 'Vi phạm luật kiểm chuẩn (Không đạt ô Accept)') : '',
            };
          });

          for (const res of parsedResults) {
            // Auto resolve previous warning if this one is Passed
            if (res.status === 'Passed') {
              const existingWarning = qcResults.find(
                q => q.testName.toLowerCase() === res.testName.toLowerCase() &&
                     q.level === res.level &&
                     q.status === 'Warning'
              );
              if (existingWarning) {
                const updatedQc: QcResult = {
                  ...existingWarning,
                  status: 'Resolved',
                  correctiveAction: 'Khắc phục bằng tệp kết quả mới đạt chuẩn',
                  correctiveNotes: `Hệ thống tự động chuyển trạng thái thành Đã xử lý do KTV đã tải lên tệp báo cáo kết quả kiểm chuẩn Đạt mới vào ngày ${new Date().toLocaleDateString('vi-VN')}.`,
                  handledBy: currentUser?.fullName || 'Hệ thống AI',
                  handledAt: new Date().toISOString()
                };
                await onSaveQcResult(updatedQc);
              }
            }
            await onSaveQcResult(res);
          }

          setToast({ message: `Phân tích AI thành công! Đã trích xuất và đồng bộ ${parsedResults.length} kết quả QC mới từ báo cáo PDF/Hình ảnh lên hệ thống Cloud.`, type: 'success' });
        } catch (err: any) {
          console.error("Error parsing QC PDF via AI:", err);
          setToast({ message: `Lỗi phân tích AI: ${err.message || 'Có lỗi xảy ra khi gọi dịch vụ AI phân tích PDF.'}`, type: 'error' });
        } finally {
          setIsQcUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        setToast({ message: 'Có lỗi xảy ra khi đọc tệp tin PDF/Hình ảnh.', type: 'error' });
        setIsQcUploading(false);
      };
    } else {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = parseQCFile(text);
          if (parsed.length === 0) {
            setToast({ message: 'Không thể tự động nhận diện dữ liệu từ tệp này. Vui lòng kiểm tra lại định dạng CSV (đầy đủ các cột: Tên test, Phân loại, Mức QC, Kết quả, Ngưỡng dưới, Ngưỡng trên, Đơn vị).', type: 'error' });
            setIsQcUploading(false);
            return;
          }
          
          for (const res of parsed) {
            // Auto resolve previous warning if this one is Passed
            if (res.status === 'Passed') {
              const existingWarning = qcResults.find(
                q => q.testName.toLowerCase() === res.testName.toLowerCase() &&
                     q.level === res.level &&
                     q.status === 'Warning'
              );
              if (existingWarning) {
                const updatedQc: QcResult = {
                  ...existingWarning,
                  status: 'Resolved',
                  correctiveAction: 'Khắc phục bằng tệp kết quả mới đạt chuẩn',
                  correctiveNotes: `Hệ thống tự động chuyển trạng thái thành Đã xử lý do KTV đã tải lên tệp báo cáo kết quả kiểm chuẩn Đạt mới vào ngày ${new Date().toLocaleDateString('vi-VN')}.`,
                  handledBy: currentUser?.fullName || 'Hệ thống AI',
                  handledAt: new Date().toISOString()
                };
                await onSaveQcResult(updatedQc);
              }
            }
            await onSaveQcResult(res);
          }
          
          setToast({ message: `Phân tích tự động thành công! Đã đồng bộ ${parsed.length} kết quả QC mới lên hệ thống Cloud.`, type: 'success' });
        } catch (err) {
          setToast({ message: 'Có lỗi xảy ra khi đọc tệp tin QC.', type: 'error' });
        } finally {
          setIsQcUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = `Tên Test,Phân Loại,Mức QC,Kết Quả,Ngưỡng Dưới,Ngưỡng Trên,Đơn Vị,Ghi Chú Westgard
Glucose,Sinh hóa,Level 2,5.1,4.5,5.5,mmol/L,
AST (GOT),Sinh hóa,Level 2,41,30,50,U/L,
ALT (GPT),Sinh hóa,Level 2,62,32,48,U/L,1-3s (Vượt ngưỡng 3 SD)
WBC (Bạch cầu),Huyết học,Level 1,7.2,4.0,10.0,G/L,
HGB (Huyết sắc tố),Huyết học,Level 1,135,110,165,g/L,
PLT (Tiểu cầu),Huyết học,Level 1,120,150,450,G/L,2-2s (2 kết quả liên tiếp vượt 2 SD)
TSH (Hormone giáp),Miễn dịch,Level 1,2.1,0.4,4.0,mIU/L,
Troponin I HS,Miễn dịch,Level 2,0.28,0.0,0.05,ng/mL,1-3s (Vượt dải 3 SD)`;

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ket_qua_qc_mau.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadDemoData = async () => {
    setIsQcUploading(true);
    try {
      const demoData = INITIAL_QC_RESULTS.map((res, index) => ({
        ...res,
        id: `QC-RES-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`
      }));
      
      for (const res of demoData) {
        await onSaveQcResult(res);
      }
      setToast({ message: 'Đã tải thành công 8 kết quả kiểm chuẩn (QC) mẫu cho hôm nay lên Cloud!', type: 'success' });
    } catch (e) {
      setToast({ message: 'Không thể nạp dữ liệu mẫu.', type: 'error' });
    } finally {
      setIsQcUploading(false);
    }
  };

  const handleOpenCorrectModal = (qc: QcResult) => {
    setSelectedQcToCorrect(qc);
    setCorrectiveAction('Calib lại');
    setCustomAction('');
    setCorrectiveNotes('');
    setIsCorrectionModalOpen(true);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQcToCorrect) return;

    const finalAction = correctiveAction === 'Lý do khác' ? (customAction.trim() || 'Hành động khác') : correctiveAction;

    const updatedQc: QcResult = {
      ...selectedQcToCorrect,
      status: 'Resolved',
      correctiveAction: finalAction,
      correctiveNotes: correctiveNotes.trim(),
      handledBy: currentUser?.fullName || 'Cán bộ xét nghiệm',
      handledAt: new Date().toISOString()
    };

    try {
      await onSaveQcResult(updatedQc);
      setIsCorrectionModalOpen(false);
      setToast({ message: `Đã khắc phục lỗi QC cho chỉ số "${selectedQcToCorrect.testName}". Trạng thái chuyển thành "Đã xử lý"!`, type: 'success' });
    } catch (err: any) {
      console.error("Lỗi khi khắc phục QC:", err);
      setToast({ message: `Lỗi khi lưu khắc phục: ${err.message || 'Không thể lưu.'}`, type: 'error' });
    }
  };

  // Filter warnings
  const filteredWarnings = warnings.filter(w => {
    const matchCategory = selectedCategory === 'All' || w.category === selectedCategory;
    const matchSeverity = selectedSeverity === 'All' || w.severity === selectedSeverity;
    return matchCategory && matchSeverity;
  });

  const criticalWarnings = warnings.filter(w => w.severity === 'CRITICAL');
  const warningWarnings = warnings.filter(w => w.severity === 'WARNING');

  // Helper to get local date in YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDateString();

  // Extract unique machine names of TODAY'S records to populate machine filter
  const uniqueMachines = Array.from(
    new Set(
      qcResults
        .filter(q => q.date === todayStr)
        .map(q => q.machineName || 'Chưa rõ')
    )
  );

  // Filter QC Results
  const filteredQcResults = qcResults.filter(qc => {
    // 1. Only show today's results
    const isToday = qc.date === todayStr;
    if (!isToday) return false;

    // 2. Filter by category (department)
    const matchCategory = selectedQcCategory === 'All' || qc.category === selectedQcCategory;

    // 3. Filter by machine
    const machineNameVal = qc.machineName || 'Chưa rõ';
    const matchMachine = selectedMachine === 'All' || machineNameVal === selectedMachine;

    // 4. Filter by status / error
    const matchStatus = selectedQcStatus === 'All' || 
      (selectedQcStatus === 'Passed' && qc.status === 'Passed') ||
      (selectedQcStatus === 'Warning' && qc.status === 'Warning') ||
      (selectedQcStatus === 'Resolved' && qc.status === 'Resolved');

    // 5. Search query
    const matchSearch = searchQuery === '' || 
      qc.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (qc.machineName && qc.machineName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (qc.correctiveAction && qc.correctiveAction.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCategory && matchMachine && matchStatus && matchSearch;
  });

  const totalQcCount = filteredQcResults.length;
  const passedQcCount = filteredQcResults.filter(q => q.status === 'Passed').length;
  const warningQcCount = filteredQcResults.filter(q => q.status === 'Warning').length;
  const resolvedQcCount = filteredQcResults.filter(q => q.status === 'Resolved').length;

  return (
    <div className="space-y-6">
      
      {/* Toast floating notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-100' 
            : 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-100'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          )}
          <span className="text-xs font-semibold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Catalog Reagents */}
        <div 
          onClick={() => onNavigateToTab('catalog')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-teal-500 hover:shadow-md transition-all duration-200 cursor-pointer group"
          id="stat-catalog"
        >
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-all">
              <Beaker className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-teal-600">Danh mục</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-display font-bold text-slate-800">{totalReagents}</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              Hóa chất & vật tư lưu trữ <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </p>
          </div>
        </div>

        {/* Card 2: Active Open Vials */}
        <div 
          onClick={() => onNavigateToTab('stability')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all duration-200 cursor-pointer group"
          id="stat-stability"
        >
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-blue-600">Trên máy</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-display font-bold text-slate-800">{activeOpenVials}</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              Hộp đang mở nắp (In-use) <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </p>
          </div>
        </div>

        {/* Card 3: Active Reconstitutions */}
        <div 
          onClick={() => onNavigateToTab('reconstitution')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-purple-500 hover:shadow-md transition-all duration-200 cursor-pointer group"
          id="stat-reconstitution"
        >
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
              <Layers className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-purple-600">Hoàn nguyên</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-display font-bold text-slate-800">{activeReconstitutions}</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              Lọ Calib/QC đang sử dụng <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </p>
          </div>
        </div>

        {/* Card 4: Total Active Alerts */}
        <div 
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden"
          id="stat-alerts"
        >
          <div className="flex items-center justify-between">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              criticalWarnings.length > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cảnh báo</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-display font-bold text-slate-800">{warnings.length}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Phát hiện không phù hợp ISO
            </p>
          </div>
          {/* Subtle colored side accent */}
          <div className={`absolute top-0 right-0 h-full w-1 ${
            criticalWarnings.length > 0 ? 'bg-red-500' : 'bg-emerald-500'
          }`} />
        </div>

      </div>

      {/* ==================== BẢNG THEO DÕI QC HẰNG NGÀY (ISO 15189 / 2429) ==================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden" id="daily-qc-dashboard">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500 animate-ping shrink-0" />
              <h2 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-600" />
                Bảng Theo Dõi Trạng Thái QC Hằng Ngày
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Giám sát chất lượng kết quả xét nghiệm theo tiêu chuẩn <strong className="text-slate-700">ISO 15189 & Quyết định 2429/QĐ-BYT</strong>
            </p>
          </div>

          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv,.txt,.pdf,image/*" 
              className="hidden" 
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isQcUploading}
              className="px-3.5 py-1.5 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              {isQcUploading ? 'Đang phân tích...' : 'Tải file kết quả QC'}
            </button>

            <button
              onClick={handleLoadDemoData}
              disabled={isQcUploading}
              className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-all"
              title="Nạp nhanh 8 dữ liệu QC mẫu chuẩn để kiểm tra chức năng"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              Nạp dữ liệu mẫu
            </button>

            <button
              onClick={downloadSampleCSV}
              className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-lg flex items-center gap-1.5 transition-all"
              title="Tải tệp tin CSV mẫu để xem định dạng dữ liệu"
            >
              <Download className="h-3.5 w-3.5" />
              Tải CSV mẫu
            </button>
          </div>
        </div>

        {/* Filters & QC Stats row */}
        <div className="p-6 border-b border-slate-100 bg-white space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Department tabs selector */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {(['All', 'Sinh hóa', 'Huyết học', 'Miễn dịch'] as const).map(dept => (
                <button
                  key={dept}
                  onClick={() => setSelectedQcCategory(dept)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    selectedQcCategory === dept
                      ? 'bg-white text-slate-800 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {dept === 'All' ? 'Tất cả phân khoa' : dept}
                </button>
              ))}
            </div>

            {/* Live QC statistics tracker */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 flex items-center gap-1.5 font-medium">
                <span>Tổng QC:</span>
                <strong className="text-slate-800 font-bold">{totalQcCount}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Đạt (Passed):</span>
                <strong className="text-emerald-800 font-bold">{passedQcCount}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-1.5 font-medium animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>Cần theo dõi:</span>
                <strong className="text-rose-800 font-bold">{warningQcCount}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span>Đã khắc phục (Resolved):</span>
                <strong className="text-blue-800 font-bold">{resolvedQcCount}</strong>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên chỉ số xét nghiệm, trạng thái, máy, biện pháp khắc phục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Advanced Filters: Machine & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-50">
            {/* Filter by Machine */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Activity className="h-3 w-3 text-slate-400" />
                Lọc theo máy xét nghiệm
              </label>
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 bg-white text-slate-700 font-medium"
              >
                <option value="All">Tất cả máy ({uniqueMachines.length})</option>
                {uniqueMachines.map(machine => (
                  <option key={machine} value={machine}>{machine}</option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3 text-slate-400" />
                Lọc theo lỗi / trạng thái QC
              </label>
              <select
                value={selectedQcStatus}
                onChange={(e) => setSelectedQcStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 bg-white text-slate-700 font-medium"
              >
                <option value="All">Tất cả trạng thái</option>
                <option value="Passed">Đạt (Passed)</option>
                <option value="Warning">Có lỗi (Warning)</option>
                <option value="Resolved">Đã khắc phục (Resolved)</option>
              </select>
            </div>

            {/* Clear filters buttons if any is active */}
            {(selectedMachine !== 'All' || selectedQcStatus !== 'All' || selectedQcCategory !== 'All' || searchQuery !== '') && (
              <div className="flex items-end justify-start md:justify-end">
                <button
                  onClick={() => {
                    setSelectedMachine('All');
                    setSelectedQcStatus('All');
                    setSelectedQcCategory('All');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-rose-600 hover:text-white border border-rose-200 hover:bg-rose-500 hover:border-rose-500 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>

        {/* QC Table list */}
        {filteredQcResults.length === 0 ? (
          <div className="p-12 text-center bg-white space-y-4">
            <div className="h-14 w-14 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Chưa có kết quả QC nào được tải lên hôm nay</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tải lên báo cáo QC dạng <strong className="text-slate-700">PDF, Ảnh chụp (OCR)</strong> hoặc tệp <strong className="text-slate-700">CSV/Excel</strong> để AI tự động trích xuất các chỉ số xét nghiệm, hoặc nhấp vào <strong className="text-slate-700">"Nạp dữ liệu mẫu"</strong> để xem trước.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5" style={{ width: '25%' }}>Chỉ số xét nghiệm / Phân khoa</th>
                  <th className="px-6 py-3.5" style={{ width: '10%' }}>Mức QC</th>
                  <th className="px-6 py-3.5" style={{ width: '15%' }}>Tên máy</th>
                  <th className="px-6 py-3.5 text-center" style={{ width: '15%' }}>Trạng thái QC</th>
                  <th className="px-6 py-3.5" style={{ width: '25%' }}>Chi tiết lỗi & Nhật ký khắc phục (Audit Trail)</th>
                  <th className="px-6 py-3.5 text-right" style={{ width: '10%' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredQcResults.map(qc => (
                  <tr 
                    key={qc.id} 
                    className={`hover:bg-slate-50/50 transition-colors ${
                      qc.status === 'Warning' ? 'bg-rose-50/10' : qc.status === 'Resolved' ? 'bg-blue-50/5' : ''
                    }`}
                  >
                    {/* Test & Dept */}
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800 font-display text-sm">{qc.testName}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                            {qc.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Ngày chạy: {qc.date}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Level */}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        qc.level === 'Level 3' 
                          ? 'bg-purple-100 text-purple-700' 
                          : qc.level === 'Level 2' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {qc.level}
                      </span>
                    </td>

                    {/* Machine Column */}
                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        {qc.machineName || 'Chưa rõ'}
                      </span>
                    </td>

                    {/* QC Status badges */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        {qc.status === 'Passed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold">
                            <Check className="h-3.5 w-3.5" />
                            ĐẠT (PASSED)
                          </span>
                        )}
                        {qc.status === 'Warning' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold animate-pulse">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                            CÓ LỖI (WARNING)
                          </span>
                        )}
                        {qc.status === 'Resolved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                            <UserCheck className="h-3.5 w-3.5" />
                            ĐÃ KHẮC PHỤC (RESOLVED)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Corrective Action Audit Trail */}
                    <td className="px-6 py-4">
                      {qc.status === 'Warning' && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                            ⚠️ Lỗi: {qc.westgardRule || 'Vi phạm dải kiểm chuẩn'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Yêu cầu: Tải báo cáo QC đạt mới để tự động cập nhật, hoặc bấm nút khắc phục bên phải.
                          </p>
                        </div>
                      )}
                      
                      {qc.status === 'Resolved' && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                            🛠️ {qc.correctiveAction}
                          </p>
                          {qc.correctiveNotes && (
                            <p className="text-[10.5px] text-slate-500 italic">
                              "{qc.correctiveNotes}"
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-1.5 text-[9px] text-slate-400 pt-0.5 mt-0.5 font-mono">
                            <span className="flex items-center gap-0.5">
                              <UserIcon className="h-2.5 w-2.5 text-slate-400" /> {qc.handledBy}
                            </span>
                            <span>•</span>
                            <span>{qc.handledAt ? new Date(qc.handledAt).toLocaleDateString('vi-VN') : ''}</span>
                          </div>
                        </div>
                      )}

                      {qc.status === 'Passed' && (
                        <span className="text-emerald-600 text-[11px] font-medium">Đạt tiêu chuẩn y khoa</span>
                      )}
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {qc.status === 'Warning' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleOpenCorrectModal(qc);
                            }}
                            className="p-1 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all cursor-pointer"
                            title="Khắc phục thủ công"
                          >
                            <Wrench className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setQcToDelete(qc);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                          title="Xóa dòng QC này"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2429-QĐ/BYT Educational Notice Banner */}
      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-2xs">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileCheck2 className="h-4.5 w-4.5 text-teal-600" />
            Tiêu chuẩn 2429-QĐ/BYT trong Quản lý Hóa chất & Vật tư Phòng xét nghiệm
          </h4>
          <p className="text-xs text-slate-500 max-w-4xl">
            2429-QĐ/BYT yêu cầu phòng xét nghiệm phải giám sát liên tục: độ ổn định sau khi pha (Reconstitution stability), hạn sử dụng sau khi đặt lên máy (In-use stability), bảo quản đúng dải nhiệt độ, và duy trì mức tồn kho tối thiểu để bảo đảm kết quả xét nghiệm chính xác và liên tục.
          </p>
        </div>
        <div className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 whitespace-nowrap">
          Chỉ số chất lượng (QI): <strong className="text-teal-600">100% kiểm soát</strong>
        </div>
      </div>

      {/* Warnings & Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Alerts Sidebar and Filter (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bộ lọc Cảnh báo</h3>
            
            {/* Department Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Phòng xét nghiệm</label>
              <div className="grid grid-cols-1 gap-1">
                {(['All', 'Sinh hóa', 'Huyết học', 'Miễn dịch'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-all ${
                      selectedCategory === cat
                        ? 'bg-teal-600 text-white font-medium'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/50'
                    }`}
                  >
                    {cat === 'All' ? 'Tất cả khoa phòng' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Selector */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-medium text-slate-600">Mức độ cảnh báo</label>
              <div className="grid grid-cols-1 gap-1">
                {(['All', 'CRITICAL', 'WARNING'] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-all ${
                      selectedSeverity === sev
                        ? 'bg-teal-600 text-white font-medium'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/50'
                    }`}
                  >
                    {sev === 'All' ? 'Tất cả mức độ' : sev === 'CRITICAL' ? '⚠️ Nguy cấp (Đỏ)' : '🔔 Cảnh báo (Vàng)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Compliance Quick Fact */}
            <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100/50 space-y-1">
              <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Quy định Lưu trữ</span>
              <p className="text-[11px] text-teal-700 leading-relaxed">
                Tất cả các cảnh báo đỏ (Nguy cấp) bắt buộc phải được nhân viên lab xử lý ngay lập tức và ghi nhận biên bản hành động khắc phục trong hệ thống tài liệu ISO.
              </p>
            </div>
          </div>

        </div>

        {/* Real-time Alerts Feed & Inventory Forecast (9 cols) */}
        <div className="lg:col-span-9 space-y-4">
          
          {/* Inventory Forecast Widget */}
          {inventoryForecast.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-amber-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                  <h2 className="text-sm font-bold text-slate-800 font-display">
                    Dự báo cạn kho (Dưới 15 ngày)
                  </h2>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {inventoryForecast.map(item => (
                  <div key={item.reagentId} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider">{item.category}</span>
                        <span className="text-xs text-slate-500 font-mono">| {item.lotNumber}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 font-display">{item.reagentName}</h4>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Tốc độ tiêu hao: <strong className="text-slate-800">{item.dailyConsumptionRate.toFixed(1)}</strong>/ngày
                        <span className="mx-2 text-slate-300">•</span>
                        Tồn hiện tại: <strong className="text-slate-800">{item.currentStock}</strong>
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 self-start md:self-auto">
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
                        Dự kiến hết sau {item.daysToDepletion} ngày nữa - Cần dự trù!
                      </span>
                      <button
                        onClick={() => onNavigateToTab('catalog', item.reagentId, item.reagentName)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-all whitespace-nowrap"
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-800 font-display">
                  Danh sách Cảnh báo Không phù hợp ({filteredWarnings.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Màu biểu thị mức độ nghiêm trọng</span>
              </div>
            </div>

            {filteredWarnings.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-sm font-semibold text-slate-800">Phòng xét nghiệm tuân thủ tốt!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Không phát hiện bất cứ sự không phù hợp nào về hạn dùng, hạn mở nắp, tồn kho tối thiểu hay hạn dùng hoàn nguyên cho các bộ lọc đang chọn.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
                {filteredWarnings.map(warning => (
                  <div 
                    key={warning.id} 
                    className={`p-5 transition-all flex flex-col md:flex-row gap-4 items-start ${
                      warning.severity === 'CRITICAL' ? 'bg-rose-50/25 hover:bg-rose-50/40' : 'bg-amber-50/15 hover:bg-amber-50/35'
                    }`}
                    id={`warning-item-${warning.id}`}
                  >
                    
                    {/* Severity Icon */}
                    <div className="mt-0.5 shrink-0">
                      {warning.severity === 'CRITICAL' ? (
                        <div className="h-9 w-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    {/* Alert Text */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide ${
                          warning.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {warning.severity === 'CRITICAL' ? 'Nguỵ cấp (ISO CRITICAL)' : 'Cảnh báo'}
                        </span>
                        
                        <span className="text-xs font-semibold text-slate-500">
                          {warning.category}
                        </span>

                        <span className="text-xs text-slate-400 font-mono">
                          | {warning.itemName}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 font-display">
                        {warning.message}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {warning.details}
                      </p>

                      {/* 2429-QĐ/BYT Action Plan Suggestion */}
                      <div className="bg-white/80 p-3 rounded-lg border border-slate-200/60 mt-2 space-y-1">
                        <span className="text-[10px] font-semibold text-teal-800 uppercase tracking-wider flex items-center gap-1">
                          <PackageCheck className="h-3.5 w-3.5 text-teal-600" />
                          Hành động khắc phục đề xuất (2429-QĐ/BYT SOP):
                        </span>
                        <p className="text-xs text-slate-700 italic">
                          {getIsoActionPlan(warning.type, warning.itemName, warning.category)}
                        </p>
                      </div>

                    </div>

                    {/* Quick Navigation Button */}
                    <div className="shrink-0 self-end md:self-center">
                      <button
                        onClick={() => navigateFromWarning(warning.type, warning.relatedId, warning.itemName, onNavigateToTab)}
                        className={`text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          warning.severity === 'CRITICAL' 
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        Xử lý ngay <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick ISO Guidelines Footnote */}
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-teal-800 uppercase tracking-wider">Lưu ý khi đánh giá phòng xét nghiệm</h5>
              <p className="text-xs text-teal-700 leading-relaxed">
                Đoàn đánh giá chứng nhận 2429-QĐ/BYT thường kiểm tra ngẫu nhiên hóa chất đang lắp đặt trên máy xem có ghi nhận rõ ngày mở nắp, người mở nắp và đối chiếu xem đã quá hạn dùng sau mở nắp hay chưa. Việc duy trì hệ thống quản lý số này là một bằng chứng rõ ràng đáp ứng sự tuân thủ cao nhất của Lab.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* ==================== MODAL GHI NHẬN BIỆN PHÁP KHẮC PHỤC QC (AUDIT TRAIL) ==================== */}
      {isCorrectionModalOpen && selectedQcToCorrect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsCorrectionModalOpen(false)}
          />

          {/* Modal Body */}
          <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-xl max-w-lg w-full border border-slate-150 z-10 animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800" id="modal-title">
                      Ghi Nhận Hành Động Khắc Phục QC
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Thiết lập biên bản xử lý sự cố lỗi kiểm chuẩn
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitCorrection}>
                <div className="px-6 py-5 space-y-4">
                  {/* Summary of affected test */}
                  <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-100/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Chỉ số xét nghiệm:</span>
                      <span className="font-mono text-slate-800 bg-white border px-2 py-0.5 rounded-md font-semibold">
                        {selectedQcToCorrect.testName} ({selectedQcToCorrect.category})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Kết quả đo:</span>
                      <span className="font-mono text-rose-700 font-bold">
                        {selectedQcToCorrect.value} {selectedQcToCorrect.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Dải cho phép (Min-Max):</span>
                      <span className="font-mono text-slate-600">
                        {selectedQcToCorrect.minVal} - {selectedQcToCorrect.maxVal} {selectedQcToCorrect.unit}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-rose-100/50 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Vi phạm Westgard phát hiện:</span>
                      <p className="text-xs text-rose-700 font-medium font-sans">
                        ⚠️ {selectedQcToCorrect.westgardRule || '1-3s (Vượt dải Min-Max cho phép)'}
                      </p>
                    </div>
                  </div>

                  {/* Dropdown Corrective Action */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      Hành động khắc phục <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={correctiveAction}
                      onChange={(e) => setCorrectiveAction(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white"
                      required
                    >
                      <option value="Calib lại">Calib lại (Hiệu chuẩn lại thiết bị)</option>
                      <option value="Thay hóa chất mới">Thay hóa chất mới (Đổi vial/lô hóa chất)</option>
                      <option value="Bảo dưỡng máy">Bảo dưỡng máy (Clean kim hút, bảo dưỡng quang học...)</option>
                      <option value="Lý do khác">Lý do khác (Nhập thủ công)</option>
                    </select>
                  </div>

                  {/* Custom Action (If 'Lý do khác' is selected) */}
                  {correctiveAction === 'Lý do khác' && (
                    <div className="space-y-1.5 animate-in fade-in duration-150">
                      <label className="text-xs font-bold text-slate-700">Nhập hành động khác</label>
                      <input
                        type="text"
                        placeholder="VD: Chạy lại mẫu QC rã đông mới, Ủ ấm hóa chất..."
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                        required
                      />
                    </div>
                  )}

                  {/* Corrective Notes Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Ghi chú chi tiết sự việc</label>
                    <textarea
                      placeholder="Ghi nhận cụ thể lý do lệch QC và tiến trình xử lý để phục vụ các đợt đánh giá chứng nhận ISO 15189 / 2429..."
                      value={correctiveNotes}
                      onChange={(e) => setCorrectiveNotes(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 min-h-[90px] resize-y"
                    />
                  </div>

                  {/* Audit Trail Note */}
                  <div className="flex items-start gap-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Thông tin này sẽ được ký nhận tự động bằng tài khoản của bạn (<strong className="text-slate-700">{currentUser?.fullName || 'Kỹ thuật viên'}</strong>) và lưu vết vĩnh viễn trên cơ sở dữ liệu Cloud của phòng Lab.
                    </p>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCorrectionModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Xác nhận khắc phục
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}

      {/* ==================== MODAL XÓA BẢN GHI QC (MANUAL DELETE) ==================== */}
      {isDeleteModalOpen && qcToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Overlay backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsDeleteModalOpen(false)}
          />

          {/* Modal Body */}
          <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-xl max-w-md w-full border border-slate-150 z-10 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Xóa Bản Ghi QC
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa thủ công bản ghi kết quả QC này không? Hành động này sẽ loại bỏ dữ liệu khỏi hệ thống Cloud và không thể phục hồi.
                </p>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs font-medium text-slate-700">
                  <div className="flex justify-between">
                    <span>Chỉ số:</span>
                    <strong className="text-slate-900">{qcToDelete.testName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Mức QC:</span>
                    <strong className="text-slate-900">{qcToDelete.level}</strong>
                  </div>
                  {qcToDelete.machineName && (
                    <div className="flex justify-between">
                      <span>Tên máy:</span>
                      <strong className="text-slate-900">{qcToDelete.machineName}</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Trạng thái:</span>
                    <span className={`font-semibold ${qcToDelete.status === 'Warning' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {qcToDelete.status === 'Warning' ? 'Có lỗi (Warning)' : 'Đạt (Passed)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onDeleteQcResult(qcToDelete.id);
                      setToast({ message: `Đã xóa thành công dòng kết quả QC chỉ số "${qcToDelete.testName}"!`, type: 'success' });
                    } catch (err: any) {
                      setToast({ message: `Lỗi khi xóa: ${err.message || 'Không thể xóa.'}`, type: 'error' });
                    } finally {
                      setIsDeleteModalOpen(false);
                      setQcToDelete(null);
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-lg cursor-pointer transition-all shadow-xs"
                >
                  Xác nhận Xóa
                </button>
              </div>
            </div>
        </div>
      )}

    </div>
  );
}

// Map warning type to precise ISO actions
function getIsoActionPlan(type: string, name: string, category: string): string {
  switch (type) {
    case 'EXPIRY_ORIGINAL':
      return `Ngưng sử dụng lô hóa chất ${name} ngay lập tức. Di dời toàn bộ sản phẩm hết hạn ra khỏi tủ lưu trữ chính, dán nhãn 'HÓA CHẤT HẾT HẠN - KHÔNG SỬ DỤNG' để đưa đi tiêu hủy. Tiến hành lập báo cáo hao hụt.`;
    case 'EXPIRY_IN_USE':
      return `Hóa chất mở nắp ${name} đã quá hạn in-use stability trên máy xét nghiệm. Thực hiện xả bỏ hộp cũ, vệ sinh khay, lắp đặt hộp mới và thực hiện chạy kiểm chuẩn (QC) trước khi tiếp tục chạy mẫu bệnh nhân.`;
    case 'LOW_STOCK':
      return `Tồn kho ${name} dưới ngưỡng an toàn. Gửi đề xuất cấp phát kho tổng (nếu là kho lẻ) hoặc tạo phiếu yêu cầu mua sắm khẩn cấp gửi phòng Vật tư thiết bị y tế.`;
    case 'EXPIRY_RECONSTITUTED':
      return `Chất Calib/QC hoàn nguyên ${name} đã mất hoạt tính ổn định. Thực hiện xả bỏ lọ hiện tại, hoàn nguyên (pha) một lọ mới bằng dung môi chuẩn, đợi ổn định nhiệt độ (thường là 30 phút) trước khi thực hiện hiệu chuẩn hoặc kiểm chuẩn máy.`;
    default:
      return 'Kiểm tra quy trình thao tác chuẩn (SOP) tương ứng với loại hóa chất và liên hệ quản lý phòng xét nghiệm để xử lý không phù hợp.';
  }
}

// Map warning type to which tab we should navigate to for handling
function navigateFromWarning(
  type: string, 
  relatedId: string, 
  itemName: string, 
  onNavigateToTab: (tabId: string, relatedId?: string, itemName?: string) => void
) {
  switch (type) {
    case 'EXPIRY_ORIGINAL':
    case 'LOW_STOCK':
      onNavigateToTab('catalog', relatedId, itemName);
      break;
    case 'EXPIRY_IN_USE':
      onNavigateToTab('stability', relatedId, itemName);
      break;
    case 'EXPIRY_RECONSTITUTED':
      onNavigateToTab('reconstitution', relatedId, itemName);
      break;
    default:
      onNavigateToTab('catalog', relatedId, itemName);
  }
}
