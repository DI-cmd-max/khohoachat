import React, { useState, useRef, useEffect } from 'react';
import { usePagination } from '../hooks/usePagination';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Compass, 
  Eye, 
  Beaker, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle,
  RotateCcw,
  Check,
  FileSpreadsheet,
  FileText,
  Settings,
  HelpCircle,
  Camera,
  Paperclip,
  Download,
  Layers,
  Tag,
  X,
  Printer,
  ExternalLink
} from 'lucide-react';
import { ReagentMaterial, LabCategory, TransactionType, User, Transaction, POPULAR_TESTS, PopularTest, BarcodeCategory, TestGroup, ReconstitutionLog, SystemSettings } from '../types';
import { formatDateVN, formatDateTimeVN, exportToExcel, exportToPDF, calculateSmartForecasting, ForecastResult } from '../utils';

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

const COMMON_UNITS = [
  'Hộp', 'Chai', 'Lọ', 'Ống', 'Cái', 'Bộ', 'Gói', 'Viên', 'Khay', 'Kit', 'Hũ', 'Cặp', 'Phiến', 'Cây', 'Thùng', 'Cuộn'
];

interface CatalogTabProps {
  reagents: ReagentMaterial[];
  onAddReagent: (reagent: Omit<ReagentMaterial, 'id' | 'currentStock'> & { currentStock?: number }) => any;
  onEditReagent: (reagent: ReagentMaterial) => void;
  onDeleteReagent: (id: string) => void;
  onOpenStability: (reagentId: string, openedBy: string, position: string) => void;
  onAddTransaction: (reagentId: string, type: TransactionType, quantity: number, actor: string, notes: string) => void;
  currentUser: User;
  targetHighlight?: { tab: string; id?: string; name?: string };
  onClearHighlight?: () => void;
  transactions: Transaction[];
  simulatedTime: string;
  popularTests?: PopularTest[];
  barcodeCategories?: BarcodeCategory[];
  testGroups?: TestGroup[];
  prefillBarcodeCategoryCode?: string;
  onClearPrefillBarcode?: () => void;
  onNavigateToReconstitutionWithData?: (data: {
    barcodeCategoryCode?: string;
    name?: string;
    lotNumber?: string;
    category?: LabCategory;
  }) => void;
  onAddReconstitution: (log: Omit<ReconstitutionLog, 'id' | 'expiryTimestamp'>) => void;
  systemSettings?: SystemSettings;
}

export default function CatalogTab({
  reagents,
  onAddReagent,
  onEditReagent,
  onDeleteReagent,
  onOpenStability,
  onAddTransaction,
  currentUser,
  targetHighlight,
  onClearHighlight,
  transactions,
  simulatedTime,
  popularTests = [],
  barcodeCategories = [],
  testGroups = [],
  prefillBarcodeCategoryCode,
  onClearPrefillBarcode,
  onNavigateToReconstitutionWithData,
  onAddReconstitution,
  systemSettings,
}: CatalogTabProps) {
  // Dynamic list of popular tests
  const testList = popularTests.length > 0 ? popularTests.map(t => t.name) : POPULAR_TESTS;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<LabCategory | 'All'>('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'LOW' | 'OUT'>('All');

  // Selection state for export
  const [selectedReagentIds, setSelectedReagentIds] = useState<string[]>([]);

  // BarTender Enterprise Automation Export states
  const [isBarTenderExportModalOpen, setIsBarTenderExportModalOpen] = useState(false);
  const [isBarTenderGuideOpen, setIsBarTenderGuideOpen] = useState(false);
  const [barTenderScope, setBarTenderScope] = useState<'all' | 'filtered' | 'selected'>('all');
  const [barTenderBarcodeFormat, setBarTenderBarcodeFormat] = useState<'id' | 'id_lot' | 'cat_or_id' | 'datamatrix'>('id_lot');
  const [barTenderQuantityMode, setBarTenderQuantityMode] = useState<'single' | 'stock' | 'custom'>('single');
  const [barTenderCustomCopies, setBarTenderCustomCopies] = useState(1);
  const [barTenderPrinter, setBarTenderPrinter] = useState<'TSC_TL240' | 'ZEBRA_ZD421'>('TSC_TL240');

  // Bulk reconstitution states
  const [isBulkReconModalOpen, setIsBulkReconModalOpen] = useState(false);
  const [bulkVolume, setBulkVolume] = useState('3.0 mL');
  const [bulkSolvent, setBulkSolvent] = useState('Nước cất hai lần (deionized)');
  const [bulkPreparedBy, setBulkPreparedBy] = useState(currentUser?.fullName || '');
  const [bulkAliquotsCount, setBulkAliquotsCount] = useState(10);
  const [bulkAliquotVolume, setBulkAliquotVolume] = useState('0.5 mL');
  const [useCommonStability, setUseCommonStability] = useState(false);
  const [commonStabilityHours, setCommonStabilityHours] = useState(720); // 30 days default
  const [bulkNotes, setBulkNotes] = useState('Hoàn nguyên hàng loạt từ danh mục');

  useEffect(() => {
    if (currentUser?.fullName) {
      setBulkPreparedBy(currentUser.fullName);
    }
  }, [currentUser]);

  useEffect(() => {
    if (reagents && reagents.length > 0) {
      setSelectedReagentIds(prev => {
        const reagentIds = reagents.map(r => r.id);
        if (prev.length === 0) return [];
        return prev.filter(id => reagentIds.includes(id));
      });
    }
  }, [reagents]);

  // React to targetHighlight
  useEffect(() => {
    if (targetHighlight && targetHighlight.name) {
      setSearchQuery(targetHighlight.name);
      setCategoryFilter('All');
      setStockFilter('All');
      
      const timer = setTimeout(() => {
        const element = document.getElementById(`reagent-row-${targetHighlight.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetHighlight]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);

  // Selected item states
  const [selectedReagent, setSelectedReagent] = useState<ReagentMaterial | null>(null);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    category: 'Sinh hóa' as LabCategory,
    manufacturer: '',
    lotNumber: '',
    originalExpiryDate: '',
    minStockLimit: 1,
    unit: 'Chai',
    packSize: '100 ml/Chai',
    reconstitutionRequired: false,
    inUseStabilityDays: 30,
    location: 'Tủ lạnh 2-8°C',
    notes: '',
    assignedTests: [] as string[],
    specTableImageUrl: '',
    attachmentUrl: '',
    attachmentName: '',
    attachmentType: '',
    barcodeCategoryCode: '',
  });

  const handleSelectGroup = (groupTests: string[]) => {
    setFormData(prev => {
      const currentSelected = prev.assignedTests || [];
      const newSelected = Array.from(new Set([...currentSelected, ...groupTests]));
      return { ...prev, assignedTests: newSelected };
    });
  };

  // Document Viewer Modal State
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [docViewerReagent, setDocViewerReagent] = useState<ReagentMaterial | null>(null);
  const [activePdfBlobUrl, setActivePdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isDocViewerOpen && docViewerReagent && docViewerReagent.attachmentUrl) {
      const dataUrl = docViewerReagent.attachmentUrl;
      // Only process as blob if it's a base64 data URL
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
  }, [isDocViewerOpen, docViewerReagent]);

  // Prefill states and Dialog variables (Flow 2 & 3)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateWarningInfo, setDuplicateWarningInfo] = useState<{
    name: string;
    lotNumber: string;
    newReagentData: any;
  } | null>(null);

  const [isReconConfirmOpen, setIsReconConfirmOpen] = useState(false);
  const [newlySavedReagent, setNewlySavedReagent] = useState<ReagentMaterial | null>(null);

  const [lotNumberBlurred, setLotNumberBlurred] = useState(false);

  useEffect(() => {
    if (prefillBarcodeCategoryCode) {
      setFormData({
        name: '',
        category: 'Sinh hóa' as LabCategory,
        manufacturer: '',
        lotNumber: '',
        originalExpiryDate: '',
        minStockLimit: 1,
        unit: 'Chai',
        packSize: '100 ml/Chai',
        reconstitutionRequired: false,
        inUseStabilityDays: 30,
        location: 'Tủ lạnh 2-8°C',
        notes: '',
        assignedTests: [] as string[],
        specTableImageUrl: '',
        attachmentUrl: '',
        attachmentName: '',
        attachmentType: '',
        barcodeCategoryCode: prefillBarcodeCategoryCode,
      });
      setPackNum('100');
      setPackUnit('ml/Chai');
      setInitialStockQty(1);

      setIsAddModalOpen(true);

      if (onClearPrefillBarcode) {
        onClearPrefillBarcode();
      }
    }
  }, [prefillBarcodeCategoryCode]);

  // Pack size split states
  const [packNum, setPackNum] = useState('5');
  const [packUnit, setPackUnit] = useState('ml/Chai');
  const [initialStockQty, setInitialStockQty] = useState<number>(0);

  // AI Image OCR State & Handler
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isSpecTableLoading, setIsSpecTableLoading] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specTableInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const handleOcrClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      let base64Image = reader.result as string;
      try {
        base64Image = await compressImage(base64Image, 1000, 1000, 0.7);
      } catch (err) {
        console.error('Image compression error:', err);
      }
      
      setIsOcrLoading(true);
      setToastMessage(null);
      try {
        const res = await fetch('/api/ocr-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image })
        });
        if (!res.ok) {
          throw new Error('Không thể kết nối hoặc phân tích ảnh bằng AI.');
        }
        const data = await res.json();
        
        // Auto-fill extracted info and clear unread ones to highlight them
        setFormData(prev => ({
          ...prev,
          name: data.name || '',
          lotNumber: data.lotNumber || '',
          originalExpiryDate: data.originalExpiryDate || '',
          manufacturer: data.manufacturer || '',
          notes: '', // Clear to force manual verification
          location: '', // Clear to force manual verification
        }));

        const newHighlights: Record<string, boolean> = {};
        if (!data.name) newHighlights.name = true;
        if (!data.lotNumber) newHighlights.lotNumber = true;
        if (!data.originalExpiryDate) newHighlights.originalExpiryDate = true;
        if (!data.manufacturer) newHighlights.manufacturer = true;
        
        // Always highlight fields that cannot be read from labels to remind the technician
        newHighlights.location = true;
        newHighlights.notes = true;
        
        setHighlightedFields(newHighlights);

        // Show toast notification
        setToastMessage('Đã bóc tách dữ liệu từ ảnh thành công. Vui lòng kiểm tra lại các ô còn thiếu trước khi lưu!');
        setTimeout(() => setToastMessage(null), 8000);
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Lỗi bóc tách hình ảnh.');
      } finally {
        setIsOcrLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSpecTableClick = () => {
    specTableInputRef.current?.click();
  };

  const handleSpecTableChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      let base64Image = reader.result as string;
      try {
        base64Image = await compressImage(base64Image, 1000, 1000, 0.7);
      } catch (err) {
        console.error('Spec table image compression error:', err);
      }

      setIsSpecTableLoading(true);
      setToastMessage(null);
      try {
        // Save base64 image data so we can view it
        setFormData(prev => ({
          ...prev,
          specTableImageUrl: base64Image
        }));

        const res = await fetch('/api/analyze-spec-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image })
        });
        if (!res.ok) {
          throw new Error('Không thể kết nối hoặc phân tích bảng thông số bằng AI.');
        }
        const data = await res.json();
        
        if (data.extractedTests && Array.isArray(data.extractedTests)) {
          // Match tests case-insensitively or partially
          const matchedTests: string[] = [];
          data.extractedTests.forEach((testName: string) => {
            const cleanTestName = testName.trim().toLowerCase();
            const found = testList.find(t => 
              t.toLowerCase() === cleanTestName ||
              t.toLowerCase().includes(cleanTestName) ||
              cleanTestName.includes(t.toLowerCase())
            );
            if (found) {
              if (!matchedTests.includes(found)) {
                matchedTests.push(found);
              }
            } else {
              if (testName.trim().length > 0 && !matchedTests.includes(testName.trim())) {
                matchedTests.push(testName.trim());
              }
            }
          });

          setFormData(prev => ({
            ...prev,
            assignedTests: matchedTests
          }));

          setToastMessage(`AI đã phân tích bảng thông số thành công! Đã phát hiện và tự động tích chọn ${matchedTests.length} test.`);
          setTimeout(() => setToastMessage(null), 8000);
        } else {
          setToastMessage('Không tìm thấy chỉ số xét nghiệm nào từ bảng thông số.');
        }
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Lỗi bóc tách bảng thông số.');
      } finally {
        setIsSpecTableLoading(false);
        if (specTableInputRef.current) specTableInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAttachmentClick = () => {
    attachmentInputRef.current?.click();
  };

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'other';

    if (type === 'pdf') {
      const maxPdfSize = 650 * 1024; // 650 KB limit
      if (file.size > maxPdfSize) {
        alert(`Tài liệu PDF quá lớn (${(file.size / 1024 / 1024).toFixed(2)} MB).\nVui lòng chọn file PDF có dung lượng nhỏ hơn 650 KB để đảm bảo lưu trữ ổn định trên hệ thống.`);
        if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async () => {
      let base64Data = reader.result as string;
      if (type === 'image') {
        try {
          base64Data = await compressImage(base64Data, 1000, 1000, 0.7);
        } catch (err) {
          console.error('Attachment image compression error:', err);
        }
      }

      setFormData(prev => ({
        ...prev,
        attachmentUrl: base64Data,
        attachmentName: file.name,
        attachmentType: type
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAttachmentRemove = () => {
    setFormData(prev => ({
      ...prev,
      attachmentUrl: '',
      attachmentName: '',
      attachmentType: ''
    }));
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  // Form states for transaction adjustment
  const [txType, setTxType] = useState<TransactionType>('nhap');
  const [txQty, setTxQty] = useState(1);
  const [txActor, setTxActor] = useState(currentUser?.fullName || '');
  const [txNotes, setTxNotes] = useState('');

  // Form states for mounting / opening stability
  const [mountBy, setMountBy] = useState(currentUser?.fullName || '');
  const [mountPosition, setMountPosition] = useState('Cobas c501 - Khay R1 - Vị trí 15');

  // Keep states in sync with currentUser
  React.useEffect(() => {
    if (currentUser?.fullName) {
      setTxActor(currentUser.fullName);
      setMountBy(currentUser.fullName);
    }
  }, [currentUser]);

  // Filter logic
  const filteredReagents = reagents.filter(reagent => {
    const matchesSearch = 
      reagent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reagent.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reagent.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'All' || reagent.category === categoryFilter;
    
    let matchesStock = true;
    if (stockFilter === 'OUT') {
      matchesStock = reagent.currentStock === 0;
    } else if (stockFilter === 'LOW') {
      matchesStock = reagent.currentStock > 0 && reagent.currentStock < reagent.minStockLimit;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  const { next, prev, jump, currentData: paginatedReagents, currentPage, maxPage, totalItems } = usePagination(filteredReagents, 20);

  const filteredIds = paginatedReagents.map(r => r.id);
  const selectedFilteredIds = filteredIds.filter(id => selectedReagentIds.includes(id));
  const isAllFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Unselect all in the filtered list
      setSelectedReagentIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all in the filtered list
      setSelectedReagentIds(prev => {
        const next = [...prev];
        filteredIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedReagentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExportPDFReport = () => {
    const headers = ['Tên hóa chất / Vật tư', 'Khoa phòng', 'Hãng sản xuất', 'Số lô (LOT)', 'Hạn dùng gốc', 'Tồn kho thực tế', 'Ngưỡng tối thiểu', 'Đơn vị', 'Vị trí bảo quản', 'Hạn mở nắp'];
    const keys = ['name', 'category', 'manufacturer', 'lotNumber', 'originalExpiryDate', 'currentStock', 'minStockLimit', 'unit', 'location', 'inUseStabilityDays'];
    const formatters = {
      originalExpiryDate: (val: any) => formatDateVN(val),
      inUseStabilityDays: (val: any) => `${val} ngày`,
      currentStock: (val: any, row: any) => `${val} ${row.unit}`,
      minStockLimit: (val: any, row: any) => `${val} ${row.unit}`,
    };
    const exportData = filteredReagents.filter(r => selectedReagentIds.includes(r.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một hóa chất để xuất PDF!');
      return;
    }
    exportToPDF('BÁO CÁO DANH MỤC HÓA CHẤT & VẬT TƯ XÉT NGHIỆM', headers, keys, exportData, formatters, systemSettings);
  };

  const handleExportExcelReport = () => {
    const headers = ['Tên hóa chất / Vật tư', 'Khoa phòng', 'Hãng sản xuất', 'Số lô (LOT)', 'Hạn dùng gốc', 'Tồn kho thực tế', 'Ngưỡng tối thiểu', 'Đơn vị', 'Quy cách', 'Vị trí bảo quản', 'Hạn mở nắp (ngày)'];
    const keys = ['name', 'category', 'manufacturer', 'lotNumber', 'originalExpiryDate', 'currentStock', 'minStockLimit', 'unit', 'packSize', 'location', 'inUseStabilityDays'];
    const formatters = {
      originalExpiryDate: (val: any) => formatDateVN(val),
      inUseStabilityDays: (val: any) => `${val}`,
      currentStock: (val: any) => `${val}`,
      minStockLimit: (val: any) => `${val}`,
    };
    const exportData = filteredReagents.filter(r => selectedReagentIds.includes(r.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một hóa chất để xuất Excel!');
      return;
    }
    exportToExcel(exportData, headers, keys, 'Danh_Muc_Hoa_Chat_Vat_Tu_ISO_15189', formatters);
  };

  const handleExportForecastPDF = () => {
    const forecastData = calculateSmartForecasting(reagents, transactions, simulatedTime);
    const headers = ['Tên hóa chất / Vật tư (Mã)', 'Khoa phòng', 'Quy cách', 'Tồn kho hiện tại', 'Đã tiêu hao (30 ngày qua)', 'Gợi ý cần mua (Dự trù)'];
    const keys = ['reagentName', 'category', 'packSize', 'currentStock', 'consumedQty', 'forecastQty'];
    const formatters = {
      reagentName: (val: any, row: any) => `${val} (${row.reagentId})`,
      currentStock: (val: any) => `${val}`,
      consumedQty: (val: any) => `${val}`,
      forecastQty: (val: any) => `${val}`,
    };
    exportToPDF('BÁO CÁO DỰ TRÙ HÓA CHẤT & VẬT TƯ (30 NGÀY TỚI)', headers, keys, forecastData, formatters, systemSettings);
  };

  const handleExportForecastExcel = () => {
    const forecastData = calculateSmartForecasting(reagents, transactions, simulatedTime);
    const headers = ['Mã hóa chất', 'Tên hóa chất / Vật tư', 'Khoa phòng', 'Quy cách', 'Tồn kho hiện tại', 'Đã tiêu hao (30 ngày qua)', 'Gợi ý cần mua (Dự trù)'];
    const keys = ['reagentId', 'reagentName', 'category', 'packSize', 'currentStock', 'consumedQty', 'forecastQty'];
    const formatters = {
      currentStock: (val: any) => `${val}`,
      consumedQty: (val: any) => `${val}`,
      forecastQty: (val: any) => `${val}`,
    };
    exportToExcel(forecastData, headers, keys, 'Du_Tru_Hoa_Chat_Vat_Tu_30_Ngay_Toi', formatters);
  };

  // ================= BARTENDER ENTERPRISE AUTOMATION EXPORT SUITE =================
  const openBarTenderExportModal = (presetScope?: 'all' | 'filtered' | 'selected') => {
    if (presetScope) {
      setBarTenderScope(presetScope);
    } else if (selectedReagentIds.length > 0) {
      setBarTenderScope('selected');
    } else if (searchQuery || categoryFilter !== 'All' || stockFilter !== 'All') {
      setBarTenderScope('filtered');
    } else {
      setBarTenderScope('all');
    }
    setIsBarTenderExportModalOpen(true);
  };

  const getBarTenderExportRows = () => {
    let sourceList: ReagentMaterial[] = [];
    if (barTenderScope === 'selected' && selectedReagentIds.length > 0) {
      sourceList = reagents.filter(r => selectedReagentIds.includes(r.id));
    } else if (barTenderScope === 'filtered') {
      sourceList = filteredReagents;
    } else {
      sourceList = reagents;
    }

    const hospital = systemSettings?.headerRow2 || systemSettings?.headerRow1 || 'BV Đa Khoa - Khoa Xét Nghiệm';
    const nowStr = formatDateTimeVN(simulatedTime);

    const rows: Array<{
      barcode: string;
      reagentId: string;
      name: string;
      category: string;
      manufacturer: string;
      lotNumber: string;
      expiryVN: string;
      expiryISO: string;
      unit: string;
      packSize: string;
      stock: number;
      minStock: number;
      location: string;
      stabilityDays: number;
      reconRequired: string;
      barcodeCategory: string;
      tests: string;
      notes: string;
      copyIndex: number;
      totalCopies: number;
      hospital: string;
      exportTime: string;
    }> = [];

    sourceList.forEach(reagent => {
      let copies = 1;
      if (barTenderQuantityMode === 'stock') {
        copies = reagent.currentStock > 0 ? reagent.currentStock : 1;
      } else if (barTenderQuantityMode === 'custom') {
        copies = Math.max(1, barTenderCustomCopies || 1);
      }

      let barcodeValue = reagent.id;
      if (barTenderBarcodeFormat === 'id_lot') {
        barcodeValue = reagent.lotNumber ? `${reagent.id}-${reagent.lotNumber}` : reagent.id;
      } else if (barTenderBarcodeFormat === 'cat_or_id') {
        barcodeValue = reagent.barcodeCategoryCode || reagent.id;
      } else if (barTenderBarcodeFormat === 'datamatrix') {
        const cleanExp = (reagent.originalExpiryDate || '').replace(/-/g, '');
        barcodeValue = `${reagent.id}|${reagent.lotNumber || 'NOLOT'}|${cleanExp}`;
      }

      for (let c = 1; c <= copies; c++) {
        rows.push({
          barcode: barcodeValue,
          reagentId: reagent.id,
          name: reagent.name,
          category: reagent.category,
          manufacturer: reagent.manufacturer || '',
          lotNumber: reagent.lotNumber || '',
          expiryVN: formatDateVN(reagent.originalExpiryDate),
          expiryISO: reagent.originalExpiryDate || '',
          unit: reagent.unit || '',
          packSize: reagent.packSize || '',
          stock: reagent.currentStock,
          minStock: reagent.minStockLimit,
          location: reagent.location || '',
          stabilityDays: reagent.inUseStabilityDays || 0,
          reconRequired: reagent.reconstitutionRequired ? 'Có' : 'Không',
          barcodeCategory: reagent.barcodeCategoryCode || '',
          tests: (reagent.assignedTests || []).join('; '),
          notes: reagent.notes || '',
          copyIndex: c,
          totalCopies: copies,
          hospital: hospital,
          exportTime: nowStr,
        });
      }
    });

    return rows;
  };

  const handleExportBarTenderCSV = () => {
    const rows = getBarTenderExportRows();
    if (rows.length === 0) {
      alert('Không có hóa chất nào trong danh sách xuất! Vui lòng kiểm tra lại bộ lọc hoặc lựa chọn.');
      return;
    }

    const headers = [
      'Barcode',
      'MaHoaChat',
      'TenHoaChat',
      'KhoaPhong',
      'HangSanXuat',
      'SoLo',
      'HanSuDung',
      'HanDungGoc_ISO',
      'DonVi',
      'QuyCach',
      'TonKho',
      'NguongToiThieu',
      'ViTriLuuTru',
      'HanMoNap_Ngay',
      'YeuCauHoanNguyen',
      'MaDanhMucBarcode',
      'XetNghiemLienQuan',
      'GhiChu',
      'SoBanIn',
      'TongSoBanIn',
      'DonViYTe',
      'NgayXuatDuLieu'
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvLines = [
      headers.join(','),
      ...rows.map(r => [
        escapeCsv(r.barcode),
        escapeCsv(r.reagentId),
        escapeCsv(r.name),
        escapeCsv(r.category),
        escapeCsv(r.manufacturer),
        escapeCsv(r.lotNumber),
        escapeCsv(r.expiryVN),
        escapeCsv(r.expiryISO),
        escapeCsv(r.unit),
        escapeCsv(r.packSize),
        escapeCsv(r.stock),
        escapeCsv(r.minStock),
        escapeCsv(r.location),
        escapeCsv(r.stabilityDays),
        escapeCsv(r.reconRequired),
        escapeCsv(r.barcodeCategory),
        escapeCsv(r.tests),
        escapeCsv(r.notes),
        escapeCsv(r.copyIndex),
        escapeCsv(r.totalCopies),
        escapeCsv(r.hospital),
        escapeCsv(r.exportTime)
      ].join(','))
    ];

    // UTF-8 BOM for flawless Vietnamese character recognition in BarTender and Excel
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `BarTender_HoaChat_${barTenderScope}_${datePart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportBarTenderBTXML = () => {
    const rows = getBarTenderExportRows();
    if (rows.length === 0) {
      alert('Không có hóa chất nào trong danh sách xuất!');
      return;
    }

    const escapeXml = (unsafe: any) => {
      return String(unsafe ?? '').replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    const targetPrinterName = barTenderPrinter === 'TSC_TL240' ? 'TSC TL 240' : 'Zebra ZD421';
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<XMLScript Version="2.0">
  <Command Name="PrintJob_HoaChat_${Date.now()}">
    <Print>
      <Format>C:\\BarTender_Templates\\Tem_HoaChat_VatTu.btw</Format>
      <PrintSetup>
        <Printer>${targetPrinterName}</Printer>
        <IdenticalCopiesOfLabel>1</IdenticalCopiesOfLabel>
      </PrintSetup>
      <RecordSet Name="Reagents">
${rows.map(r => `        <Record>
          <Field Name="Barcode">${escapeXml(r.barcode)}</Field>
          <Field Name="MaHoaChat">${escapeXml(r.reagentId)}</Field>
          <Field Name="TenHoaChat">${escapeXml(r.name)}</Field>
          <Field Name="KhoaPhong">${escapeXml(r.category)}</Field>
          <Field Name="HangSanXuat">${escapeXml(r.manufacturer)}</Field>
          <Field Name="SoLo">${escapeXml(r.lotNumber)}</Field>
          <Field Name="HanSuDung">${escapeXml(r.expiryVN)}</Field>
          <Field Name="DonVi">${escapeXml(r.unit)}</Field>
          <Field Name="QuyCach">${escapeXml(r.packSize)}</Field>
          <Field Name="ViTriLuuTru">${escapeXml(r.location)}</Field>
          <Field Name="DonViYTe">${escapeXml(r.hospital)}</Field>
        </Record>`).join('\n')}
      </RecordSet>
    </Print>
  </Command>
</XMLScript>`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BarTender_Automation_HoaChat_${new Date().toISOString().slice(0, 10)}.btxml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTSPL = () => {
    const rows = getBarTenderExportRows();
    if (rows.length === 0) {
      alert('Không có hóa chất nào trong danh sách xuất!');
      return;
    }

    const removeAccents = (str: string) => {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };

    const tsplBlocks = rows.map(r => {
      const cleanName = removeAccents(r.name).substring(0, 24);
      const cleanHosp = removeAccents(r.hospital).substring(0, 28);
      const cleanLoc = removeAccents(r.location).substring(0, 20);
      const val = r.barcode;
      // Calculate Code 128 width to center mathematically on 400 dots (50mm at 203 DPI)
      const approxWidth = (val.length * 11 + 35) * 2;
      const startX = Math.max(10, Math.floor((400 - approxWidth) / 2));

      return `SIZE 50 mm, 20 mm
GAP 2 mm, 0 mm
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET PEEL OFF
SET CUTTER OFF
SET PARTIAL_CUTTER OFF
CLS
TEXT 200,8,"0",0,1,1,2,"${cleanHosp}"
BARLINE 15,26,370,1
TEXT 200,32,"0",0,1,1,2,"${cleanName}"
BARCODE ${startX},56,"128",38,0,0,2,2,"${val}"
TEXT 200,98,"0",0,1,1,2,"${val}"
TEXT 20,122,"0",0,1,1,0,"LOT: ${r.lotNumber || 'N/A'}"
TEXT 210,122,"0",0,1,1,0,"HSD: ${r.expiryVN}"
TEXT 20,140,"0",0,1,1,0,"VT: ${cleanLoc}"
PRINT 1,1`;
    }).join('\n\n');

    const blob = new Blob([tsplBlocks], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TSC_TL240_HoaChat_${new Date().toISOString().slice(0, 10)}.tspl`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportZPL = () => {
    const rows = getBarTenderExportRows();
    if (rows.length === 0) {
      alert('Không có hóa chất nào trong danh sách xuất!');
      return;
    }

    const removeAccents = (str: string) => {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };

    const zplBlocks = rows.map(r => {
      const cleanName = removeAccents(r.name).substring(0, 24);
      const cleanHosp = removeAccents(r.hospital).substring(0, 28);
      const cleanLoc = removeAccents(r.location).substring(0, 20);
      const val = r.barcode;
      const approxWidth = (val.length * 11 + 35) * 2;
      const startX = Math.max(10, Math.floor((400 - approxWidth) / 2));
      return `^XA
^PW400
^LL160
^PON
^FO15,10^A0N,18,18^FB370,1,0,C^FD${cleanHosp}^FS
^FO15,28^GB370,1,2^FS
^FO15,34^A0N,20,20^FB370,1,0,C^FD${cleanName}^FS
^FO${startX},56^BY2,2,40^BCN,40,N,N,N^FD${val}^FS
^FO15,100^A0N,16,16^FB370,1,0,C^FD${val}^FS
^FO15,120^GB370,1,1^FS
^FO15,126^A0N,15,15^FDLOT: ${r.lotNumber || 'N/A'}^FS
^FO200,126^A0N,15,15^FDHSD: ${r.expiryVN}^FS
^FO15,142^A0N,13,13^FDVT: ${cleanLoc}^FS
^XZ`;
    });

    const blob = new Blob([zplBlocks.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Zebra_ZD421_HoaChat_${new Date().toISOString().slice(0, 10)}.zpl`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle open Add Modal
  const openAddModal = () => {
    setFormData({
      name: '',
      category: 'Sinh hóa',
      manufacturer: '',
      lotNumber: '',
      originalExpiryDate: '2027-06-30',
      minStockLimit: 1,
      unit: 'Chai',
      packSize: '100 ml/Chai',
      reconstitutionRequired: false,
      inUseStabilityDays: 30,
      location: 'Tủ lạnh 2-8°C',
      notes: '',
      assignedTests: [],
      specTableImageUrl: '',
      attachmentUrl: '',
      attachmentName: '',
      attachmentType: '',
      barcodeCategoryCode: '',
    });
    setPackNum('5');
    setPackUnit('ml/Chai');
    setInitialStockQty(0);
    setHighlightedFields({});
    setToastMessage(null);
    setIsAddModalOpen(true);
  };

  // Handle open Edit Modal
  const openEditModal = (reagent: ReagentMaterial) => {
    setSelectedReagent(reagent);
    
    // Parse the packSize
    const match = reagent.packSize.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    let num = '5';
    let unit = 'ml/Chai';
    if (match) {
      num = match[1];
      const parsedUnit = match[2].trim();
      const lower = parsedUnit.toLowerCase();
      if (lower.includes('ml') && lower.includes('chai')) {
        unit = 'ml/Chai';
      } else if (lower.includes('ml') && lower.includes('hộp')) {
        unit = 'ml/hộp';
      } else if (lower.includes('test')) {
        unit = 'test/hộp';
      } else {
        unit = parsedUnit || 'ml/Chai';
      }
    }
    setPackNum(num);
    setPackUnit(unit);

    setFormData({
      name: reagent.name,
      category: reagent.category,
      manufacturer: reagent.manufacturer,
      lotNumber: reagent.lotNumber,
      originalExpiryDate: reagent.originalExpiryDate,
      minStockLimit: reagent.minStockLimit,
      unit: reagent.unit,
      packSize: reagent.packSize,
      reconstitutionRequired: reagent.reconstitutionRequired,
      inUseStabilityDays: reagent.inUseStabilityDays,
      location: reagent.location || 'Tủ lạnh 2-8°C',
      notes: reagent.notes || '',
      assignedTests: reagent.assignedTests || [],
      specTableImageUrl: reagent.specTableImageUrl || '',
      attachmentUrl: reagent.attachmentUrl || '',
      attachmentName: reagent.attachmentName || '',
      attachmentType: reagent.attachmentType || '',
      barcodeCategoryCode: reagent.barcodeCategoryCode || '',
    });
    setIsEditModalOpen(true);
  };

  // Save reagent and prompt for reconstitution if required
  const saveNewReagentAndHandleFlows = async (reagentData: any) => {
    setIsAddModalOpen(false);
    const saved = await onAddReagent(reagentData);
    if (saved && saved.reconstitutionRequired) {
      setNewlySavedReagent(saved);
      setIsReconConfirmOpen(true);
    }
  };

  const handleProceedSaveDuplicate = async () => {
    if (duplicateWarningInfo) {
      setIsDuplicateDialogOpen(false);
      const dataToSave = duplicateWarningInfo.newReagentData;
      setDuplicateWarningInfo(null);
      await saveNewReagentAndHandleFlows(dataToSave);
    }
  };

  const handleCancelSaveDuplicate = () => {
    setIsDuplicateDialogOpen(false);
    setDuplicateWarningInfo(null);
  };

  const handleReconConfirmYes = () => {
    setIsReconConfirmOpen(false);
    if (newlySavedReagent && onNavigateToReconstitutionWithData) {
      onNavigateToReconstitutionWithData({
        barcodeCategoryCode: newlySavedReagent.barcodeCategoryCode,
        name: newlySavedReagent.name,
        lotNumber: newlySavedReagent.lotNumber,
        category: newlySavedReagent.category,
      });
    }
    setNewlySavedReagent(null);
  };

  const handleReconConfirmNo = () => {
    setIsReconConfirmOpen(false);
    setNewlySavedReagent(null);
  };

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate LOT (Flow 3)
    const isDuplicate = reagents.some(r => 
      r.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
      r.lotNumber.toLowerCase().trim() === formData.lotNumber.toLowerCase().trim()
    );

    const finalPackSize = `${packNum} ${packUnit}`;
    const newReagentData = {
      ...formData,
      packSize: finalPackSize,
      currentStock: initialStockQty,
    };

    if (isDuplicate) {
      setDuplicateWarningInfo({
        name: formData.name,
        lotNumber: formData.lotNumber,
        newReagentData,
      });
      setIsDuplicateDialogOpen(true);
      return;
    }

    await saveNewReagentAndHandleFlows(newReagentData);
  };

  // Submit Edit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPackSize = `${packNum} ${packUnit}`;
    if (selectedReagent) {
      onEditReagent({
        ...selectedReagent,
        ...formData,
        packSize: finalPackSize,
      });
    }
    setIsEditModalOpen(false);
  };

  // Open Transaction Modal (Nhập/Xuất/Lĩnh)
  const openTransactionModal = (reagent: ReagentMaterial) => {
    setSelectedReagent(reagent);
    setTxType('nhap');
    setTxQty(1);
    setTxActor(currentUser?.fullName || '');
    setTxNotes('');
    setIsTransactionModalOpen(true);
  };

  // Submit Transaction
  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReagent) {
      // Validate that we don't dispatch more than we have for "linh" or "xuat"
      if (txType !== 'nhap' && txQty > selectedReagent.currentStock) {
        alert(`Số lượng giao dịch (${txQty}) vượt quá tồn kho hiện tại (${selectedReagent.currentStock}) của mặt hàng này!`);
        return;
      }
      onAddTransaction(selectedReagent.id, txType, txQty, txActor, txNotes);
      setIsTransactionModalOpen(false);
    }
  };

  // Open Mount Modal (Mở nắp đặt lên máy)
  const openMountModal = (reagent: ReagentMaterial) => {
    setSelectedReagent(reagent);
    setMountBy(currentUser?.fullName || '');
    // Pre-populate realistic locations based on machine
    if (reagent.category === 'Sinh hóa') {
      setMountPosition('Cobas c501 - Khay R1 - Vị trí ');
    } else if (reagent.category === 'Huyết học') {
      setMountPosition('Sysmex XN-1000 - Buồng ');
    } else {
      setMountPosition('Architect i2000SR - Vị trí ');
    }
    setIsMountModalOpen(true);
  };

  // Submit Mount/Open
  const handleMountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReagent) {
      if (selectedReagent.currentStock <= 0) {
        alert('Hóa chất này đã hết tồn kho, không thể mở nắp sử dụng! Hãy thực hiện nhập kho trước.');
        return;
      }
      // Add opened stability tracker
      onOpenStability(selectedReagent.id, mountBy, mountPosition);
      // Deduct 1 unit from stock since we are mounting/using 1 container
      onAddTransaction(
        selectedReagent.id, 
        'linh', 
        1, 
        mountBy, 
        `Mở nắp sử dụng: Đưa lên máy xét nghiệm (${mountPosition})`
      );
      setIsMountModalOpen(false);
    }
  };

  // Helper to render badge for stock
  const getStockBadge = (current: number, min: number, unit: string) => {
    if (current === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Hết hàng (0 {unit})
        </span>
      );
    }
    if (current < min) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Thiếu ({current}/{min} {unit})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        An toàn ({current} {unit})
      </span>
    );
  };

  const handleBulkReconSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReagentIds.length === 0) return;
    
    const selectedReagents = reagents.filter(r => selectedReagentIds.includes(r.id));
    
    selectedReagents.forEach(reagent => {
      const stabHours = useCommonStability 
        ? commonStabilityHours 
        : (reagent.inUseStabilityDays ? reagent.inUseStabilityDays * 24 : 720);
        
      onAddReconstitution({
        targetItemName: reagent.name,
        category: reagent.category,
        sourceLot: reagent.lotNumber || '',
        volume: bulkVolume,
        solvent: bulkSolvent,
        preparedBy: bulkPreparedBy,
        stabilityHours: stabHours,
        notes: bulkNotes,
        aliquotsCount: bulkAliquotsCount,
        aliquotVolume: bulkAliquotVolume,
        remainingAliquots: bulkAliquotsCount,
        status: 'Đang sử dụng',
        timestamp: simulatedTime,
        barcodeCategoryCode: reagent.barcodeCategoryCode,
      });
    });
    
    // Reset selection and close modal
    setSelectedReagentIds([]);
    setIsBulkReconModalOpen(false);
    alert(`Đã hoàn nguyên hàng loạt thành công ${selectedReagents.length} hóa chất!`);
  };

  return (
    <div className="space-y-4" id="catalog-tab-root">
      
      {/* Search & Filtering Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, số lô, hãng sản xuất..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filters and Add Button */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
          
          {/* Department Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as LabCategory | 'All')}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
          >
            <option value="All">Tất cả khoa phòng</option>
            <option value="Sinh hóa">Sinh hóa</option>
            <option value="Huyết học">Huyết học</option>
            <option value="Miễn dịch">Miễn dịch</option>
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
          >
            <option value="All">Mức tồn kho (Tất cả)</option>
            <option value="LOW">Dưới tối thiểu</option>
            <option value="OUT">Hết hàng tồn</option>
          </select>

          {/* Export buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPDFReport}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="Xuất báo cáo PDF tiêu chuẩn 2429-QĐ/BYT"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              <span>Xuất PDF</span>
            </button>
            <button
              onClick={handleExportExcelReport}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="Xuất dữ liệu Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
            <button
              onClick={() => openBarTenderExportModal()}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
              title="Xuất file CSV chuẩn định dạng để nhập vào BarTender Enterprise Automation in barcode chuyên nghiệp"
            >
              <span className="text-sm group-hover:scale-110 transition-transform">🏷️</span>
              <span className="font-bold">BarTender CSV</span>
            </button>
          </div>

          {/* Smart Forecasting button */}
          <button
            onClick={() => setIsForecastModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border border-slate-700 ml-auto md:ml-0"
            id="btn-smart-forecasting"
            title="Dự trù hóa chất thông minh dựa trên dữ liệu tiêu hao 30 ngày qua"
          >
            <span>📊 Phân tích Dự trù</span>
          </button>

          {/* Add New Reagent button */}
          {currentUser && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              id="btn-add-reagent"
            >
              <Plus className="h-4 w-4" /> Thêm hóa chất mới
            </button>
          )}

        </div>

      </div>

      {targetHighlight && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span>Đang tiêu điểm tìm kiếm hóa chất: <strong>{targetHighlight.name}</strong></span>
          </div>
          <button 
            onClick={() => {
              setSearchQuery('');
              onClearHighlight?.();
            }}
            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md font-semibold transition-all cursor-pointer text-[11px]"
          >
            Hiển thị lại tất cả
          </button>
        </div>
      )}

      {selectedReagentIds.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 text-white p-2.5 rounded-lg font-bold text-sm h-10 w-10 flex items-center justify-center shadow-xs shrink-0">
              {selectedReagentIds.length}
            </div>
            <div>
              <div className="font-bold text-teal-900 text-xs uppercase tracking-wide">Đang chọn {selectedReagentIds.length} hóa chất / QC / Calib</div>
              <div className="text-[11px] text-teal-700/80">Bạn có thể thực hiện thao tác hoàn nguyên đồng thời cho tất cả các mục này.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={() => openBarTenderExportModal('selected')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Xuất file BarTender CSV cho các hóa chất đã chọn"
            >
              <span>🏷️ BarTender CSV ({selectedReagentIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkReconModalOpen(true)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Hoàn nguyên hàng loạt</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedReagentIds([])}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Bỏ chọn tất cả
            </button>
          </div>
        </div>
      )}

      {/* Main Spreadsheet/Grid Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 w-10 text-center">
                  <input 
                    type="checkbox"
                    id="checkbox-all-reagents"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                    title="Chọn tất cả"
                  />
                </th>
                <th className="px-3 py-2.5">Mã / Tên hóa chất</th>
                <th className="px-2 py-2.5">Khoa phòng</th>
                <th className="px-2 py-2.5">Hãng / Số lô</th>
                <th className="px-2 py-2.5">Vị trí lưu trữ</th>
                <th className="px-2 py-2.5">Hạn dùng gốc</th>
                <th className="px-2 py-2.5">Hạn mở nắp</th>
                <th className="px-2 py-2.5">Tồn kho</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReagents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <Compass className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Không tìm thấy hóa chất nào khớp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                paginatedReagents.map((reagent) => (
                  <tr 
                    key={reagent.id} 
                    id={`reagent-row-${reagent.id}`}
                    className={`hover:bg-slate-50/50 transition-all ${
                      targetHighlight?.id === reagent.id
                        ? 'ring-2 ring-amber-400 bg-amber-50/50 animate-pulse'
                        : ''
                    }`}
                  >
                    
                    {/* Checkbox */}
                    <td className="px-3 py-2.5 w-10 text-center">
                      <input 
                        type="checkbox"
                        id={`checkbox-reagent-${reagent.id}`}
                        checked={selectedReagentIds.includes(reagent.id)}
                        onChange={() => handleToggleSelectRow(reagent.id)}
                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                      />
                    </td>
                    
                    {/* ID and Name */}
                    <td className="px-3 py-2.5">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800 leading-tight flex items-center gap-1.5 flex-wrap">
                          <span>{reagent.name}</span>
                          {reagent.attachmentUrl && (
                            <button
                              onClick={() => {
                                setDocViewerReagent(reagent);
                                setIsDocViewerOpen(true);
                              }}
                              className="px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 border border-teal-100 text-teal-700 rounded-md text-[9px] font-bold flex items-center gap-0.5 transition-all cursor-pointer inline-flex scale-95 origin-left"
                              title={`Xem tài liệu đính kèm: ${reagent.attachmentName || 'Tài liệu kỹ thuật'}`}
                            >
                              <Paperclip className="h-2.5 w-2.5" />
                              <span>Tài liệu</span>
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          ID: {reagent.id} | Quy cách: {reagent.packSize}
                        </div>
                        {reagent.assignedTests && reagent.assignedTests.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 max-w-xs">
                            {reagent.assignedTests.map(test => (
                              <span key={test} className="px-1.5 py-0.5 bg-teal-50 border border-teal-100 text-teal-700 font-semibold rounded-md text-[9px] scale-95 origin-left">
                                {test}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Department Category */}
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        reagent.category === 'Sinh hóa' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                        reagent.category === 'Huyết học' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                        'bg-purple-50 text-purple-700 border border-purple-100'
                      }`}>
                        {reagent.category}
                      </span>
                    </td>

                    {/* Manufacturer & Lot */}
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="text-slate-700">{reagent.manufacturer}</div>
                        <div className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm inline-block">
                          {reagent.lotNumber}
                        </div>
                      </div>
                    </td>

                    {/* Storage Location */}
                    <td className="px-2 py-2.5">
                      <div className="text-slate-500 max-w-[110px] truncate" title={reagent.location}>
                        {reagent.location}
                      </div>
                    </td>

                    {/* Original Expiry */}
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <div className="text-slate-700 font-mono text-[11px]">
                        {formatDateVN(reagent.originalExpiryDate)}
                      </div>
                    </td>

                    {/* In-Use Stability Days */}
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="text-slate-700 font-medium">
                          {reagent.inUseStabilityDays} ngày
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {reagent.reconstitutionRequired ? '⚠️ Hoàn nguyên' : 'Dùng trực tiếp'}
                        </div>
                      </div>
                    </td>

                    {/* Current Stock */}
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      {getStockBadge(reagent.currentStock, reagent.minStockLimit, reagent.unit)}
                    </td>

                    {/* Action buttons */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Nhập/Xuất kho button */}
                        <button
                          onClick={() => openTransactionModal(reagent)}
                          className="px-1.5 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-all cursor-pointer font-medium flex items-center gap-0.5"
                          title="Nhập thêm, xuất bỏ hoặc cấp phát vật tư này"
                        >
                          <Settings className="h-3 w-3 text-slate-500" /> Nhập/Xuất
                        </button>

                        {/* Mở nắp lên máy button */}
                        <button
                          onClick={() => openMountModal(reagent)}
                          disabled={reagent.currentStock === 0}
                          className={`px-1.5 py-1 text-[10px] font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-0.5 ${
                            reagent.currentStock === 0
                              ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                              : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                          }`}
                          title="Ghi nhận mở nắp hộp mới đặt trực tiếp lên hệ thống máy xét nghiệm"
                        >
                          <Plus className="h-3 w-3" /> Mở nắp
                        </button>

                        {/* BarTender Export Single */}
                        <button
                          onClick={() => {
                            setSelectedReagentIds([reagent.id]);
                            openBarTenderExportModal('selected');
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                          title={`Xuất tem BarTender cho "${reagent.name}"`}
                        >
                          <Tag className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit Button */}
                        {currentUser && (
                          <button
                            onClick={() => openEditModal(reagent)}
                            className="p-1 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                            title="Chỉnh sửa thông số kỹ thuật"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Delete Button */}
                        {currentUser && (
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa hóa chất "${reagent.name}" ra khỏi danh mục hệ thống? Thao tác này không thể hoàn tác.`)) {
                                onDeleteReagent(reagent.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                            title="Xóa khỏi danh mục"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {maxPage > 1 && (
          <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 font-medium">
              Hiển thị {(currentPage - 1) * 20 + 1} - {Math.min(currentPage * 20, totalItems)} trong số {totalItems} bản ghi
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={prev}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 text-slate-600 rounded-lg transition-all"
              >
                Trước
              </button>
              <div className="text-[11px] text-slate-600 font-semibold px-2">
                Trang {currentPage} / {maxPage}
              </div>
              <button
                onClick={next}
                disabled={currentPage === maxPage}
                className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 text-slate-600 rounded-lg transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ISO SOP Reference Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-600">
        <HelpCircle className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-700">Hướng dẫn nhanh SOP - Ghi nhận Mở nắp (In-use):</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Khi mang 1 hộp hóa chất từ kho lưu trữ và bóc nhãn lắp lên khay máy xét nghiệm, hãy click nút <strong>"Mở nắp (In-use)"</strong>. Hệ thống sẽ tự động trừ 01 sản phẩm khỏi kho lưu trữ chính, ghi nhận ngày mở nắp, người thực hiện, và tính toán chính xác hạn sử dụng mới sau mở nắp của lô này.
          </p>
        </div>
      </div>

      {/* ================= DIALOG: DUPLICATE LOT WARNING (Flow 3) ================= */}
      {isDuplicateDialogOpen && duplicateWarningInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-fade-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-amber-100 p-3 rounded-full shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-display mb-1">
                  Cảnh báo: Trùng lặp Số lô (LOT)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cảnh báo: Hóa chất <span className="font-bold text-slate-800">[{duplicateWarningInfo.name}]</span> với Số lô <span className="font-bold text-amber-700">[{duplicateWarningInfo.lotNumber}]</span> đã tồn tại. Bạn có chắc chắn muốn tạo thêm bản ghi này không?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancelSaveDuplicate}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleProceedSaveDuplicate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                Tiếp tục lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DIALOG: CONFIRM RECONSTITUTION NEED (Flow 2) ================= */}
      {isReconConfirmOpen && newlySavedReagent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-fade-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-teal-100 p-3 rounded-full shrink-0">
                <HelpCircle className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-display mb-1">
                  Khai báo thành công!
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Khai báo hóa chất thành công! Hóa chất <span className="font-bold text-slate-800">{newlySavedReagent.name}</span> này có cần thực hiện hoàn nguyên trước khi sử dụng không?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleReconConfirmNo}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Không
              </button>
              <button
                type="button"
                onClick={handleReconConfirmYes}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" /> Có (Hoàn nguyên)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD REAGENT ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-4">
              Thêm Hóa chất / Vật tư Xét nghiệm Mới
            </h3>

            {toastMessage && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-xs animate-pulse">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{toastMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên hóa chất / vật tư *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({...formData, name: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, name: false }));
                    }}
                    placeholder="Ví dụ: Glucose Liquicolor (Cobas)"
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.name 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mã QC liên kết (Kế hoạch năm)</label>
                  <select
                    value={formData.barcodeCategoryCode}
                    onChange={(e) => setFormData({...formData, barcodeCategoryCode: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">-- Không liên kết --</option>
                    {barcodeCategories.map(bc => (
                      <option key={bc.id} value={bc.code}>
                        [{bc.code}] {bc.name} ({bc.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phân loại phòng *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value as LabCategory})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="Sinh hóa">Sinh hóa</option>
                    <option value="Huyết học">Huyết học</option>
                    <option value="Miễn dịch">Miễn dịch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Đơn vị tính *</label>
                  <div className="space-y-1.5">
                    <select
                      value={COMMON_UNITS.includes(formData.unit) ? formData.unit : 'Khác'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Khác') {
                          setFormData({ ...formData, unit: '' });
                        } else {
                          setFormData({ ...formData, unit: val });
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                    >
                      {COMMON_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                      <option value="Khác">Khác (Tự nhập tay)...</option>
                    </select>
                    
                    {!COMMON_UNITS.includes(formData.unit) && (
                      <input
                        type="text"
                        required
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="Nhập đơn vị tính khác (ví dụ: chai nhỏ, vỉ, bộ...)"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-amber-300 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hãng sản xuất *</label>
                  <input
                    type="text"
                    required
                    value={formData.manufacturer}
                    onChange={(e) => {
                      setFormData({...formData, manufacturer: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, manufacturer: false }));
                    }}
                    placeholder="Ví dụ: Roche, Abbott, Sysmex"
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.manufacturer 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số lô (LOT) *</label>
                  <input
                    type="text"
                    required
                    value={formData.lotNumber}
                    onChange={(e) => {
                      setFormData({...formData, lotNumber: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, lotNumber: false }));
                    }}
                    onBlur={() => setLotNumberBlurred(true)}
                    onFocus={() => setLotNumberBlurred(false)}
                    placeholder="Ví dụ: LOT-GLU-2026X"
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.lotNumber 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                  {lotNumberBlurred && formData.name.trim() !== '' && formData.lotNumber.trim() !== '' && reagents.some(r => 
                    r.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
                    r.lotNumber.toLowerCase().trim() === formData.lotNumber.toLowerCase().trim()
                  ) && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600 font-medium animate-fade-in">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Số lô này đã tồn tại cho hóa chất này!</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hạn dùng gốc *</label>
                  <input
                    type="date"
                    required
                    value={formData.originalExpiryDate}
                    onChange={(e) => {
                      setFormData({...formData, originalExpiryDate: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, originalExpiryDate: false }));
                    }}
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.originalExpiryDate 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Quy cách đóng gói</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      value={packNum}
                      onChange={(e) => setPackNum(e.target.value)}
                      placeholder="Số lượng"
                      className="w-1/2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    />
                    <select
                      value={packUnit}
                      onChange={(e) => setPackUnit(e.target.value)}
                      className="w-1/2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    >
                      <option value="ml/Chai">ml/Chai</option>
                      <option value="test/hộp">test/hộp</option>
                      <option value="ml/hộp">ml/hộp</option>
                      <option value="lọ/hộp">lọ/hộp</option>
                      <option value="tests/hộp">tests/hộp</option>
                      <option value="mL/chai">mL/chai</option>
                      <option value="L/chai">L/chai</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tồn kho tối thiểu *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.minStockLimit}
                    onChange={(e) => setFormData({...formData, minStockLimit: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hạn ổn định sau mở (Ngày)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.inUseStabilityDays}
                    onChange={(e) => setFormData({...formData, inUseStabilityDays: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số lượng nhập ban đầu (nếu có)</label>
                  <input
                    type="number"
                    min={0}
                    value={initialStockQty === 0 ? '' : initialStockQty}
                    onChange={(e) => setInitialStockQty(parseInt(e.target.value) || 0)}
                    placeholder="Ví dụ: 5 (bỏ trống = 0)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vị trí lưu trữ bảo quản</label>
                  <select
                    value={formData.location}
                    onChange={(e) => {
                      setFormData({...formData, location: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, location: false }));
                    }}
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.location 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  >
                    <option value="Tủ lạnh 2-8°C">Tủ lạnh 2-8°C</option>
                    <option value="Tủ âm sâu -20°C">Tủ âm sâu -20°C</option>
                    <option value="Tủ âm sâu -70°C">Tủ âm sâu -70°C</option>
                    <option value="Nhiệt độ phòng (20-25°C)">Nhiệt độ phòng (20-25°C)</option>
                  </select>
                </div>

                <div className="col-span-2 flex items-center gap-2 py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3">
                  <input
                    type="checkbox"
                    id="reconstitute-add"
                    checked={formData.reconstitutionRequired}
                    onChange={(e) => setFormData({...formData, reconstitutionRequired: e.target.checked})}
                    className="h-5 w-5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                  />
                  <label htmlFor="reconstitute-add" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    Là hóa chất đông khô / Cần hoàn nguyên (Yêu cầu quy trình Hoàn nguyên / Pha)
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ghi chú thêm</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => {
                      setFormData({...formData, notes: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, notes: false }));
                    }}
                    rows={2}
                    placeholder="Yêu cầu bảo quản đặc biệt hoặc thông tin phụ..."
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.notes 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                {/* --- CHỈ SỐ XÉT NGHIỆM CHO QC / CALIBRATOR (TESTS) --- */}
                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
                        🧬 Quản lý Thông số Xét nghiệm (Tests) cho QC/Calibrator
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, assignedTests: testList }))}
                          className="px-2 py-1 bg-white hover:bg-teal-50 text-[10px] text-teal-700 font-semibold border border-teal-200 rounded-lg transition-all cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, assignedTests: [] }))}
                          className="px-2 py-1 bg-white hover:bg-rose-50 text-[10px] text-rose-700 font-semibold border border-rose-200 rounded-lg transition-all cursor-pointer"
                        >
                          Bỏ chọn hết
                        </button>
                      </div>
                    </div>

                    {/* Vùng 1: Multi-select Checklist */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">
                        Vùng 1: Danh sách chọn nhanh Test phổ biến
                      </label>
                      <div className="grid grid-cols-4 gap-2 bg-white border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                        {testList.map(testName => {
                          const isChecked = formData.assignedTests?.includes(testName);
                          return (
                            <label key={testName} className="flex items-center gap-1.5 p-1 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      assignedTests: [...(prev.assignedTests || []), testName]
                                    }));
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      assignedTests: (prev.assignedTests || []).filter(t => t !== testName)
                                    }));
                                  }
                                }}
                                className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                              />
                              <span className="text-xs text-slate-700 select-none truncate" title={testName}>
                                {testName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chọn nhanh theo Nhóm Test hoặc Sao chép */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed border-teal-100">
                      {/* Chọn theo Nhóm Test */}
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                          Chọn nhanh theo Nhóm Test:
                        </span>
                        {testGroups && testGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-50 border border-slate-150 rounded-xl">
                            {testGroups.map(group => (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => handleSelectGroup(group.testNames)}
                                className="px-2 py-1 bg-white hover:bg-teal-100 hover:text-teal-900 text-teal-800 text-[10px] font-bold border border-teal-200 rounded-lg transition-all cursor-pointer shadow-3xs flex items-center gap-1"
                                title={`Chọn các test: ${group.testNames.join(', ')}`}
                              >
                                📂 {group.name} ({group.testNames.length})
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Chưa khai báo nhóm test nào.</p>
                        )}
                      </div>

                      {/* Sao chép từ hóa chất khác */}
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                          Sao chép test từ hóa chất cùng loại ({formData.category}):
                        </span>
                        {reagents.filter(r => r.category === formData.category && r.assignedTests && r.assignedTests.length > 0 && r.id !== (formData as any).id).length > 0 ? (
                          <div className="p-1 bg-slate-50 border border-slate-150 rounded-xl">
                            <select
                              onChange={(e) => {
                                const selectedReagentId = e.target.value;
                                if (selectedReagentId) {
                                  const sourceReagent = reagents.find(r => r.id === selectedReagentId);
                                  if (sourceReagent && sourceReagent.assignedTests) {
                                    setFormData(prev => ({
                                      ...prev,
                                      assignedTests: [...sourceReagent.assignedTests]
                                    }));
                                  }
                                }
                              }}
                              defaultValue=""
                              className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-teal-500 font-medium"
                            >
                              <option value="">-- Chọn hóa chất để sao chép test --</option>
                              {reagents
                                .filter(r => r.category === formData.category && r.assignedTests && r.assignedTests.length > 0 && r.id !== (formData as any).id)
                                .map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.assignedTests.length} tests)
                                  </option>
                                ))
                              }
                            </select>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Chưa có hóa chất cùng loại nào khác có gán test.</p>
                        )}
                      </div>
                    </div>

                    {/* Vùng 2: AI Upload Spec Table */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">
                        Vùng 2: Cập nhật chỉ số từ Bảng thông số của Nhà sản xuất (AI)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Drag and Drop / Action button */}
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-teal-200 rounded-xl p-4 bg-white hover:bg-teal-50/20 transition-all">
                          <input
                            type="file"
                            ref={specTableInputRef}
                            onChange={handleSpecTableChange}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={handleSpecTableClick}
                            disabled={isSpecTableLoading}
                            className={`px-4 py-2 text-xs font-bold rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                              isSpecTableLoading
                                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                : 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600 shadow-xs'
                            }`}
                          >
                            <Camera className="h-4 w-4" />
                            {isSpecTableLoading ? 'AI Đang quét bảng...' : '🤖 Quét bảng thông số bằng AI'}
                          </button>
                          <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
                            Tải ảnh bảng thông số kiểm chuẩn từ nhà sản xuất để AI tự động trích xuất các test chỉ định.
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-1 text-[9px] text-teal-600 font-medium bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                            Gemini Flash: Miễn phí & Không giới hạn lượt quét
                          </div>
                        </div>

                        {/* Image Preview / Status */}
                        <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-2 relative h-32 overflow-hidden">
                          {formData.specTableImageUrl ? (
                            <>
                              <img
                                src={formData.specTableImageUrl}
                                alt="Bảng thông số nhà sản xuất"
                                className="object-contain max-h-full max-w-full rounded-lg"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, specTableImageUrl: '' }))}
                                className="absolute top-1.5 right-1.5 bg-slate-900/60 hover:bg-slate-950 text-white rounded-full p-1 transition-all"
                                title="Xóa ảnh"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <div className="text-center p-4">
                              <p className="text-xs text-slate-400 font-medium">Chưa có hình ảnh bảng thông số</p>
                              <p className="text-[10px] text-slate-300 mt-0.5">Hỗ trợ định dạng JPG, PNG, WEBP</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* File đính kèm tài liệu kỹ thuật */}
                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <label className="block text-xs font-bold text-teal-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" /> Tài liệu đính kèm (QC value / Calib / Spec Sheet)
                  </label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Drag and Drop area or button */}
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all">
                      <input
                        type="file"
                        ref={attachmentInputRef}
                        onChange={handleAttachmentChange}
                        accept="image/*,application/pdf"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleAttachmentClick}
                        className="px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="h-4 w-4 text-slate-500" /> Chọn tệp tin đính kèm
                      </button>
                      <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
                        Hỗ trợ định dạng Ảnh (PNG, JPG, WEBP) hoặc tài liệu PDF.
                      </p>
                    </div>

                    {/* Preview / Status */}
                    <div className="flex items-center justify-center bg-slate-50/30 border border-slate-100 rounded-2xl p-3 relative h-28 overflow-hidden">
                      {formData.attachmentUrl ? (
                        <div className="w-full h-full flex flex-col justify-between p-1">
                          <div className="flex items-start gap-2 bg-white border border-slate-100 rounded-xl p-2 shadow-2xs">
                            {formData.attachmentType === 'pdf' ? (
                              <div className="p-2 bg-red-50 rounded-lg text-red-600 font-bold text-xs shrink-0 flex items-center justify-center h-10 w-10">
                                PDF
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 shrink-0">
                                <img src={formData.attachmentUrl} alt="Attached Preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={formData.attachmentName}>
                                {formData.attachmentName || 'Tài liệu đính kèm'}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">
                                {formData.attachmentType === 'pdf' ? 'Tài liệu PDF' : 'Ảnh thông số'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDocViewerReagent({
                                  name: formData.name || 'Tài liệu tạm thời',
                                  attachmentUrl: formData.attachmentUrl,
                                  attachmentName: formData.attachmentName,
                                  attachmentType: formData.attachmentType,
                                } as ReagentMaterial);
                                setIsDocViewerOpen(true);
                              }}
                              className="flex-1 py-1 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 rounded-lg transition-all text-center flex items-center justify-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> Xem nhanh
                            </button>
                            <button
                              type="button"
                              onClick={handleAttachmentRemove}
                              className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-all text-center"
                            >
                              Xóa tệp
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-2">
                          <p className="text-xs text-slate-400 font-medium">Chưa có tệp tin đính kèm nào</p>
                          <p className="text-[10px] text-slate-300 mt-0.5">Vui lòng tải lên tài liệu QC / Calib</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-teal-600 font-semibold bg-teal-50 px-2 py-1 rounded-lg border border-teal-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                    Gemini Flash: Miễn phí & Không giới hạn lượt quét
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleOcrClick}
                      disabled={isOcrLoading}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isOcrLoading 
                          ? 'bg-amber-50 text-amber-600 border-amber-200' 
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 shadow-2xs'
                      }`}
                    >
                      <Camera className="h-4 w-4" />
                      {isOcrLoading ? 'Đang phân tích...' : '📷 Quét ảnh nhãn hóa chất'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setHighlightedFields({});
                        setToastMessage(null);
                      }}
                      className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-sm"
                    >
                      Xác nhận thêm
                    </button>
                  </div>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT REAGENT ================= */}
      {isEditModalOpen && selectedReagent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-4">
              Cập nhật Thông số: {selectedReagent.name}
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên hóa chất / vật tư *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mã QC liên kết (Kế hoạch năm)</label>
                  <select
                    value={formData.barcodeCategoryCode}
                    onChange={(e) => setFormData({...formData, barcodeCategoryCode: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">-- Không liên kết --</option>
                    {barcodeCategories.map(bc => (
                      <option key={bc.id} value={bc.code}>
                        [{bc.code}] {bc.name} ({bc.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phân loại phòng *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value as LabCategory})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="Sinh hóa">Sinh hóa</option>
                    <option value="Huyết học">Huyết học</option>
                    <option value="Miễn dịch">Miễn dịch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Đơn vị tính *</label>
                  <div className="space-y-1.5">
                    <select
                      value={COMMON_UNITS.includes(formData.unit) ? formData.unit : 'Khác'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Khác') {
                          setFormData({ ...formData, unit: '' });
                        } else {
                          setFormData({ ...formData, unit: val });
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                    >
                      {COMMON_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                      <option value="Khác">Khác (Tự nhập tay)...</option>
                    </select>
                    
                    {!COMMON_UNITS.includes(formData.unit) && (
                      <input
                        type="text"
                        required
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="Nhập đơn vị tính khác (ví dụ: chai nhỏ, vỉ, bộ...)"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-amber-300 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hãng sản xuất *</label>
                  <input
                    type="text"
                    required
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số lô (LOT) *</label>
                  <input
                    type="text"
                    required
                    value={formData.lotNumber}
                    onChange={(e) => setFormData({...formData, lotNumber: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hạn dùng gốc *</label>
                  <input
                    type="date"
                    required
                    value={formData.originalExpiryDate}
                    onChange={(e) => setFormData({...formData, originalExpiryDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Quy cách đóng gói</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      value={packNum}
                      onChange={(e) => setPackNum(e.target.value)}
                      placeholder="Số lượng"
                      className="w-1/2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    />
                    <select
                      value={packUnit}
                      onChange={(e) => setPackUnit(e.target.value)}
                      className="w-1/2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    >
                      <option value="ml/Chai">ml/Chai</option>
                      <option value="test/hộp">test/hộp</option>
                      <option value="ml/hộp">ml/hộp</option>
                      <option value="lọ/hộp">lọ/hộp</option>
                      <option value="tests/hộp">tests/hộp</option>
                      <option value="mL/chai">mL/chai</option>
                      <option value="L/chai">L/chai</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tồn kho tối thiểu *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.minStockLimit}
                    onChange={(e) => setFormData({...formData, minStockLimit: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hạn ổn định sau mở (Ngày)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.inUseStabilityDays}
                    onChange={(e) => setFormData({...formData, inUseStabilityDays: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vị trí lưu trữ bảo quản</label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  >
                    <option value="Tủ lạnh 2-8°C">Tủ lạnh 2-8°C</option>
                    <option value="Tủ âm sâu -20°C">Tủ âm sâu -20°C</option>
                    <option value="Tủ âm sâu -70°C">Tủ âm sâu -70°C</option>
                    <option value="Nhiệt độ phòng (20-25°C)">Nhiệt độ phòng (20-25°C)</option>
                  </select>
                </div>

                <div className="col-span-2 flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="reconstitute-edit"
                    checked={formData.reconstitutionRequired}
                    onChange={(e) => setFormData({...formData, reconstitutionRequired: e.target.checked})}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                  />
                  <label htmlFor="reconstitute-edit" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Hóa chất này yêu cầu Quy trình Hoàn Nguyên / Pha (Calibrator/QC khô)
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ghi chú thêm</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* --- CHỈ SỐ XÉT NGHIỆM CHO QC / CALIBRATOR (TESTS) --- */}
                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
                        🧬 Quản lý Thông số Xét nghiệm (Tests) cho QC/Calibrator
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, assignedTests: testList }))}
                          className="px-2 py-1 bg-white hover:bg-teal-50 text-[10px] text-teal-700 font-semibold border border-teal-200 rounded-lg transition-all cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, assignedTests: [] }))}
                          className="px-2 py-1 bg-white hover:bg-rose-50 text-[10px] text-rose-700 font-semibold border border-rose-200 rounded-lg transition-all cursor-pointer"
                        >
                          Bỏ chọn hết
                        </button>
                      </div>
                    </div>

                    {/* Vùng 1: Multi-select Checklist */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">
                        Vùng 1: Danh sách chọn nhanh Test phổ biến
                      </label>
                      <div className="grid grid-cols-4 gap-2 bg-white border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                        {testList.map(testName => {
                          const isChecked = formData.assignedTests?.includes(testName);
                          return (
                            <label key={testName} className="flex items-center gap-1.5 p-1 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      assignedTests: [...(prev.assignedTests || []), testName]
                                    }));
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      assignedTests: (prev.assignedTests || []).filter(t => t !== testName)
                                    }));
                                  }
                                }}
                                className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                              />
                              <span className="text-xs text-slate-700 select-none truncate" title={testName}>
                                {testName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chọn nhanh theo Nhóm Test hoặc Sao chép */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed border-teal-100">
                      {/* Chọn theo Nhóm Test */}
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                          Chọn nhanh theo Nhóm Test:
                        </span>
                        {testGroups && testGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-50 border border-slate-150 rounded-xl">
                            {testGroups.map(group => (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => handleSelectGroup(group.testNames)}
                                className="px-2 py-1 bg-white hover:bg-teal-100 hover:text-teal-900 text-teal-800 text-[10px] font-bold border border-teal-200 rounded-lg transition-all cursor-pointer shadow-3xs flex items-center gap-1"
                                title={`Chọn các test: ${group.testNames.join(', ')}`}
                              >
                                📂 {group.name} ({group.testNames.length})
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Chưa khai báo nhóm test nào.</p>
                        )}
                      </div>

                      {/* Sao chép từ hóa chất khác */}
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                          Sao chép test từ hóa chất cùng loại ({formData.category}):
                        </span>
                        {reagents.filter(r => r.category === formData.category && r.assignedTests && r.assignedTests.length > 0 && r.id !== (formData as any).id).length > 0 ? (
                          <div className="p-1 bg-slate-50 border border-slate-150 rounded-xl">
                            <select
                              onChange={(e) => {
                                const selectedReagentId = e.target.value;
                                if (selectedReagentId) {
                                  const sourceReagent = reagents.find(r => r.id === selectedReagentId);
                                  if (sourceReagent && sourceReagent.assignedTests) {
                                    setFormData(prev => ({
                                      ...prev,
                                      assignedTests: [...sourceReagent.assignedTests]
                                    }));
                                  }
                                }
                              }}
                              defaultValue=""
                              className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-teal-500 font-medium"
                            >
                              <option value="">-- Chọn hóa chất để sao chép test --</option>
                              {reagents
                                .filter(r => r.category === formData.category && r.assignedTests && r.assignedTests.length > 0 && r.id !== (formData as any).id)
                                .map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.assignedTests.length} tests)
                                  </option>
                                ))
                              }
                            </select>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Chưa có hóa chất cùng loại nào khác có gán test.</p>
                        )}
                      </div>
                    </div>

                    {/* Vùng 2: AI Upload Spec Table */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">
                        Vùng 2: Cập nhật chỉ số từ Bảng thông số của Nhà sản xuất (AI)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Drag and Drop / Action button */}
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-teal-200 rounded-xl p-4 bg-white hover:bg-teal-50/20 transition-all">
                          <input
                            type="file"
                            ref={specTableInputRef}
                            onChange={handleSpecTableChange}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={handleSpecTableClick}
                            disabled={isSpecTableLoading}
                            className={`px-4 py-2 text-xs font-bold rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                              isSpecTableLoading
                                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                : 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600 shadow-xs'
                            }`}
                          >
                            <Camera className="h-4 w-4" />
                            {isSpecTableLoading ? 'AI Đang quét bảng...' : '🤖 Quét bảng thông số bằng AI'}
                          </button>
                          <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
                            Tải ảnh bảng thông số kiểm chuẩn từ nhà sản xuất để AI tự động trích xuất các test chỉ định.
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-1 text-[9px] text-teal-600 font-medium bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                            Gemini Flash: Miễn phí & Không giới hạn lượt quét
                          </div>
                        </div>

                        {/* Image Preview / Status */}
                        <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-2 relative h-32 overflow-hidden">
                          {formData.specTableImageUrl ? (
                            <>
                              <img
                                src={formData.specTableImageUrl}
                                alt="Bảng thông số nhà sản xuất"
                                className="object-contain max-h-full max-w-full rounded-lg"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, specTableImageUrl: '' }))}
                                className="absolute top-1.5 right-1.5 bg-slate-900/60 hover:bg-slate-950 text-white rounded-full p-1 transition-all"
                                title="Xóa ảnh"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <div className="text-center p-4">
                              <p className="text-xs text-slate-400 font-medium">Chưa có hình ảnh bảng thông số</p>
                              <p className="text-[10px] text-slate-300 mt-0.5">Hỗ trợ định dạng JPG, PNG, WEBP</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* File đính kèm tài liệu kỹ thuật */}
                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <label className="block text-xs font-bold text-teal-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" /> Tài liệu đính kèm (QC value / Calib / Spec Sheet)
                  </label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Drag and Drop area or button */}
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all">
                      <input
                        type="file"
                        ref={attachmentInputRef}
                        onChange={handleAttachmentChange}
                        accept="image/*,application/pdf"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleAttachmentClick}
                        className="px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="h-4 w-4 text-slate-500" /> Chọn tệp tin đính kèm
                      </button>
                      <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
                        Hỗ trợ định dạng Ảnh (PNG, JPG, WEBP) hoặc tài liệu PDF.
                      </p>
                    </div>

                    {/* Preview / Status */}
                    <div className="flex items-center justify-center bg-slate-50/30 border border-slate-100 rounded-2xl p-3 relative h-28 overflow-hidden">
                      {formData.attachmentUrl ? (
                        <div className="w-full h-full flex flex-col justify-between p-1">
                          <div className="flex items-start gap-2 bg-white border border-slate-100 rounded-xl p-2 shadow-2xs">
                            {formData.attachmentType === 'pdf' ? (
                              <div className="p-2 bg-red-50 rounded-lg text-red-600 font-bold text-xs shrink-0 flex items-center justify-center h-10 w-10">
                                PDF
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 shrink-0">
                                <img src={formData.attachmentUrl} alt="Attached Preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={formData.attachmentName}>
                                {formData.attachmentName || 'Tài liệu đính kèm'}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">
                                {formData.attachmentType === 'pdf' ? 'Tài liệu PDF' : 'Ảnh thông số'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDocViewerReagent({
                                  name: formData.name || 'Tài liệu tạm thời',
                                  attachmentUrl: formData.attachmentUrl,
                                  attachmentName: formData.attachmentName,
                                  attachmentType: formData.attachmentType,
                                } as ReagentMaterial);
                                setIsDocViewerOpen(true);
                              }}
                              className="flex-1 py-1 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 rounded-lg transition-all text-center flex items-center justify-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> Xem nhanh
                            </button>
                            <button
                              type="button"
                              onClick={handleAttachmentRemove}
                              className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-all text-center"
                            >
                              Xóa tệp
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-2">
                          <p className="text-xs text-slate-400 font-medium">Chưa có tệp tin đính kèm nào</p>
                          <p className="text-[10px] text-slate-300 mt-0.5">Vui lòng tải lên tài liệu QC / Calib</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: STOCK TRANSACTION (Nhập/Xuất kho) ================= */}
      {isTransactionModalOpen && selectedReagent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-1">
              Khởi Tạo Giao Dịch Kho
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Thiết lập số lượng xuất/nhập thực tế cho: <span className="text-slate-800 font-bold">{selectedReagent.name}</span> (Số lô: {selectedReagent.lotNumber})
            </p>

            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              
              <div className="space-y-3">
                
                {/* Transaction Type Radio Buttons */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Loại giao dịch *</label>
                  <div className="grid grid-cols-3 gap-2">
                    
                    <label className={`border rounded-xl p-2.5 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      txType === 'nhap' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}>
                      <input 
                        type="radio" 
                        name="tx-type" 
                        value="nhap" 
                        checked={txType === 'nhap'}
                        onChange={() => setTxType('nhap')}
                        className="sr-only" 
                      />
                      <ArrowUpRight className="h-4 w-4 text-emerald-600 mb-1" />
                      <span className="text-xs">Nhập kho</span>
                    </label>

                    <label className={`border rounded-xl p-2.5 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      txType === 'linh' 
                        ? 'bg-blue-50 border-blue-500 text-blue-800 font-bold' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}>
                      <input 
                        type="radio" 
                        name="tx-type" 
                        value="linh" 
                        checked={txType === 'linh'}
                        onChange={() => setTxType('linh')}
                        className="sr-only" 
                      />
                      <ArrowDownLeft className="h-4 w-4 text-blue-600 mb-1" />
                      <span className="text-xs">Lĩnh/Cấp phát</span>
                    </label>

                    <label className={`border rounded-xl p-2.5 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      txType === 'xuat' 
                        ? 'bg-rose-50 border-rose-500 text-rose-800 font-bold' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}>
                      <input 
                        type="radio" 
                        name="tx-type" 
                        value="xuat" 
                        checked={txType === 'xuat'}
                        onChange={() => setTxType('xuat')}
                        className="sr-only" 
                      />
                      <Trash2 className="h-4 w-4 text-rose-600 mb-1" />
                      <span className="text-xs">Xuất hủy/Hao phí</span>
                    </label>

                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số lượng ({selectedReagent.unit}) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={txQty}
                    onChange={(e) => setTxQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Tồn kho hiện tại trong hệ thống: {selectedReagent.currentStock} {selectedReagent.unit}
                  </span>
                </div>

                {/* Actor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nhân viên y tế thực hiện *</label>
                  <input
                    type="text"
                    required
                    value={txActor}
                    onChange={(e) => setTxActor(e.target.value)}
                    placeholder="Nhập tên người chịu trách nhiệm"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Lý do giao dịch / Ghi chú</label>
                  <textarea
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    rows={2}
                    required
                    placeholder="Ví dụ: Nhập hàng bổ sung từ nhà phân phối; Hủy do hỏng tủ lạnh bảo quản..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-sm"
                >
                  Xác nhận lưu kho
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: MOUNT TO ANALYZER (Mở nắp sử dụng) ================= */}
      {isMountModalOpen && selectedReagent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-1 flex items-center gap-1.5">
              <Compass className="h-5 w-5 text-teal-600 animate-spin-slow" /> Ghi nhận Mở nắp lên Máy Xét nghiệm
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-normal">
              Bạn đang chuẩn bị mở một chai hóa chất mới để đặt trực tiếp lên hệ thống máy tự động. Hệ thống sẽ bắt đầu <strong>kích hoạt đồng hồ đo in-use stability</strong> và đồng thời <strong>trừ 01 đơn vị trong kho lưu trữ chính</strong>.
            </p>

            <form onSubmit={handleMountSubmit} className="space-y-4">
              
              <div className="space-y-3">
                
                {/* Details card */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Sản phẩm kích hoạt</div>
                  <div className="text-xs font-bold text-slate-800">{selectedReagent.name}</div>
                  <div className="text-[10px] font-mono text-slate-600">LOT: {selectedReagent.lotNumber} | Hạn dùng gốc: {formatDateVN(selectedReagent.originalExpiryDate)}</div>
                  <div className="text-[10px] text-teal-700 font-semibold">Độ ổn định sau mở: {selectedReagent.inUseStabilityDays} ngày</div>
                </div>

                {/* Actor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Người mở nắp & lắp đặt *</label>
                  <input
                    type="text"
                    required
                    value={mountBy}
                    onChange={(e) => setMountBy(e.target.value)}
                    placeholder="Nhập tên người thực hiện"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vị trí lắp đặt trên máy xét nghiệm *</label>
                  <input
                    type="text"
                    required
                    value={mountPosition}
                    onChange={(e) => setMountPosition(e.target.value)}
                    placeholder="Ví dụ: Cobas c501 - Khay R1 - Vị trí 12"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMountModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-sm"
                >
                  Xác nhận kích hoạt mở nắp
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SMART FORECASTING ================= */}
      {isForecastModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                <span>Bảng Dự Trù Hóa Chất (30 ngày tới)</span>
              </h3>
              <button
                onClick={() => setIsForecastModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1.5 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 leading-normal max-w-md">
                Hệ thống phân tích lịch sử giao dịch <strong>xuất kho</strong> và <strong>mở nắp sử dụng</strong> trong vòng 30 ngày qua (so với thời gian hiện tại {formatDateVN(simulatedTime)}) để tính tốc độ tiêu hao thực tế (Burn Rate), từ đó dự toán số lượng cần nhập kho bổ sung.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleExportForecastPDF}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  title="Xuất báo cáo PDF dự trù"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-600" />
                  <span>Xuất PDF</span>
                </button>
                <button
                  onClick={handleExportForecastExcel}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  title="Xuất dữ liệu Excel dự trù"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Xuất Excel</span>
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl mb-4">
              <table className="w-full border-collapse text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Tên hóa chất / Mã</th>
                    <th className="px-4 py-3 text-center">Tồn kho hiện tại</th>
                    <th className="px-4 py-3 text-center">Đã dùng (30 ngày qua)</th>
                    <th className="px-4 py-3 text-center text-amber-700 bg-amber-50/50">Gợi ý cần mua</th>
                    <th className="px-4 py-3">Đơn vị tính (Quy cách)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculateSmartForecasting(reagents, transactions, simulatedTime).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        🎉 Không có hóa chất nào cần mua thêm! Tồn kho hiện tại đủ đáp ứng nhu cầu sử dụng dựa trên tốc độ tiêu hao 30 ngày qua.
                      </td>
                    </tr>
                  ) : (
                    calculateSmartForecasting(reagents, transactions, simulatedTime).map((item) => (
                      <tr key={item.reagentId} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <div>{item.reagentName}</div>
                          <div className="text-[10px] font-mono text-slate-400">Mã: {item.reagentId}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">
                          {item.currentStock}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 font-medium">
                          {item.consumedQty}
                        </td>
                        <td className="px-4 py-3 text-center text-amber-700 font-bold bg-amber-50/50">
                          +{item.forecastQty}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.packSize}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsForecastModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200 font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DOCUMENT VIEWER ================= */}
      {isDocViewerOpen && docViewerReagent && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 md:p-4 z-55">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-7xl w-full h-[95vh] shadow-2xl p-4 md:p-5 flex flex-col relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-display">
                    {docViewerReagent.attachmentName || 'Tài liệu kỹ thuật đính kèm'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sản phẩm: {docViewerReagent.name} | Lô: {docViewerReagent.lotNumber || 'Chưa rõ'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {docViewerReagent.attachmentType === 'pdf' && activePdfBlobUrl && (
                  <a
                    href={activePdfBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl transition-all flex items-center gap-1 text-xs font-bold cursor-pointer border border-teal-100"
                    title="Mở tài liệu trong cửa sổ trình duyệt mới"
                  >
                    <ArrowUpRight className="h-4 w-4" /> Mở cửa sổ mới
                  </a>
                )}
                {docViewerReagent.attachmentUrl && (
                  <a
                    href={activePdfBlobUrl || docViewerReagent.attachmentUrl}
                    download={docViewerReagent.attachmentName || 'tai-lieu-ky-thuat'}
                    className="p-2 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer border border-slate-200"
                    title="Tải xuống tài liệu"
                  >
                    <Download className="h-4 w-4" /> Tải xuống
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsDocViewerOpen(false);
                    setDocViewerReagent(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-slate-50 rounded-2xl border border-slate-200 p-2 flex items-center justify-center relative overflow-hidden">
              {docViewerReagent.attachmentUrl ? (
                docViewerReagent.attachmentType === 'pdf' ? (
                  activePdfBlobUrl ? (
                    <iframe
                      src={activePdfBlobUrl}
                      title={docViewerReagent.attachmentName || 'Tài liệu kỹ thuật'}
                      className="w-full h-full rounded-xl border-none"
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-3"></div>
                      <p className="text-xs font-medium">Đang chuẩn bị tài liệu PDF...</p>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                    <img
                      src={docViewerReagent.attachmentUrl}
                      alt={docViewerReagent.attachmentName || 'Tài liệu đính kèm'}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )
              ) : (
                <div className="text-center p-6 text-slate-400">
                  <p className="text-sm font-semibold">Tài liệu không khả dụng hoặc liên kết bị hỏng.</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsDocViewerOpen(false);
                  setDocViewerReagent(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= MODAL: BULK RECONSTITUTION ================= */}
      {isBulkReconModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in text-left">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800 font-display">
                  Hoàn Nguyên Hàng Loạt ({selectedReagentIds.length} hóa chất)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkReconModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleBulkReconSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Selected List */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Danh sách hóa chất thực hiện pha hàng loạt:</span>
                <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-slate-700 font-medium">
                  {reagents.filter(r => selectedReagentIds.includes(r.id)).map(r => (
                    <div key={r.id} className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                      <span>• {r.name}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-sm">Lô: {r.lotNumber || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Volume */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Thể tích dung môi pha chung *</label>
                  <input
                    type="text"
                    required
                    value={bulkVolume}
                    onChange={(e) => setBulkVolume(e.target.value)}
                    placeholder="Ví dụ: 3.0 mL"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Solvent */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dung môi sử dụng chung *</label>
                  <input
                    type="text"
                    required
                    value={bulkSolvent}
                    onChange={(e) => setBulkSolvent(e.target.value)}
                    placeholder="Ví dụ: Nước cất hai lần"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Prepared By */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Người thực hiện pha *</label>
                  <input
                    type="text"
                    required
                    value={bulkPreparedBy}
                    onChange={(e) => setBulkPreparedBy(e.target.value)}
                    placeholder="Tên người pha"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Aliquots Count */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số tuýp chia lẻ (mỗi loại) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={bulkAliquotsCount}
                    onChange={(e) => setBulkAliquotsCount(parseInt(e.target.value) || 0)}
                    placeholder="Ví dụ: 10"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white font-mono"
                  />
                </div>

                {/* Aliquot Volume */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Thể tích mỗi tuýp chia lẻ *</label>
                  <input
                    type="text"
                    required
                    value={bulkAliquotVolume}
                    onChange={(e) => setBulkAliquotVolume(e.target.value)}
                    placeholder="Ví dụ: 0.5 mL"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Stability configurations */}
                <div className="col-span-2 space-y-2 border-t border-slate-100 pt-3">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-display">Hạn dùng ổn định sau pha:</span>
                  
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={!useCommonStability}
                        onChange={() => setUseCommonStability(false)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>Sử dụng cấu hình hạn ổn định riêng của từng hóa chất (khai báo tại Catalog)</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={useCommonStability}
                        onChange={() => setUseCommonStability(true)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>Sử dụng một hạn ổn định chung (số giờ)</span>
                    </label>
                  </div>

                  {useCommonStability && (
                    <div className="pl-5 pt-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hạn ổn định chung sau khi pha (Số giờ) *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={commonStabilityHours}
                        onChange={(e) => setCommonStabilityHours(parseInt(e.target.value) || 0)}
                        placeholder="Số giờ ổn định (Ví dụ 720 = 30 ngày)"
                        className="w-36 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ghi chú hoàn nguyên hàng loạt</label>
                  <textarea
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBulkReconModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Xác nhận pha hàng loạt
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= BARTENDER ENTERPRISE EXPORT MODAL ================= */}
      {isBarTenderExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 text-xl font-bold shadow-2xs">
                  🏷️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Xuất dữ liệu Hóa chất cho BarTender Enterprise
                    </h3>
                    <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      Automation Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Định dạng file CSV chuẩn UTF-8 BOM, hỗ trợ liên kết Database Connection Setup để in barcode sắc nét trên máy in Zebra
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBarTenderGuideOpen(true)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>📖 Hướng dẫn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBarTenderExportModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto py-4 space-y-4 text-xs pr-1 flex-1">
              
              {/* Scope selection */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  1. Phạm vi dữ liệu hóa chất xuất ra file:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    barTenderScope === 'all'
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="bt-scope"
                      checked={barTenderScope === 'all'}
                      onChange={() => setBarTenderScope('all')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div>Tất cả danh mục</div>
                      <span className="text-[10px] text-slate-500 font-normal">({reagents.length} hóa chất trong kho)</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    barTenderScope === 'filtered'
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="bt-scope"
                      checked={barTenderScope === 'filtered'}
                      onChange={() => setBarTenderScope('filtered')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div>Theo bộ lọc hiện tại</div>
                      <span className="text-[10px] text-slate-500 font-normal">({filteredReagents.length} hóa chất hiển thị)</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    barTenderScope === 'selected'
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                      : selectedReagentIds.length === 0
                        ? 'opacity-60 bg-slate-100 border-slate-200 cursor-not-allowed'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="bt-scope"
                      disabled={selectedReagentIds.length === 0}
                      checked={barTenderScope === 'selected'}
                      onChange={() => setBarTenderScope('selected')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div>Mục đã tích chọn (Checkbox)</div>
                      <span className="text-[10px] text-slate-500 font-normal">({selectedReagentIds.length} mục đã chọn)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Barcode Scheme & Quantity options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* Barcode scheme */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    2. Cấu trúc giá trị mã Barcode:
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name="bt-barcode-format"
                        checked={barTenderBarcodeFormat === 'id_lot'}
                        onChange={() => setBarTenderBarcodeFormat('id_lot')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">Mã hóa chất + Số lô (Khuyên dùng)</span>
                        <div className="text-[10px] text-slate-500 font-mono">Ví dụ: R-001-LOT-GLU-2045A</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name="bt-barcode-format"
                        checked={barTenderBarcodeFormat === 'id'}
                        onChange={() => setBarTenderBarcodeFormat('id')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">Chỉ mã hóa chất (ID duy nhất)</span>
                        <div className="text-[10px] text-slate-500 font-mono">Ví dụ: R-001</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name="bt-barcode-format"
                        checked={barTenderBarcodeFormat === 'cat_or_id'}
                        onChange={() => setBarTenderBarcodeFormat('cat_or_id')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">Mã vạch danh mục Barcode (nếu có)</span>
                        <div className="text-[10px] text-slate-500 font-mono">Ví dụ: GLU / AST / R-001</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name="bt-barcode-format"
                        checked={barTenderBarcodeFormat === 'datamatrix'}
                        onChange={() => setBarTenderBarcodeFormat('datamatrix')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">Chuỗi 2D DataMatrix / QR Code</span>
                        <div className="text-[10px] text-slate-500 font-mono">Ví dụ: R-001|LOT-GLU-2045A|20270515</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Quantity mode */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    3. Số lượng nhãn tem in cho mỗi loại:
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name="bt-qty-mode"
                        checked={barTenderQuantityMode === 'single'}
                        onChange={() => setBarTenderQuantityMode('single')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">1 tem cho mỗi loại hóa chất</span>
                        <div className="text-[10px] text-slate-500">Thích hợp dán vị trí kệ, tủ lạnh bảo quản hoặc sổ theo dõi</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name="bt-qty-mode"
                        checked={barTenderQuantityMode === 'stock'}
                        onChange={() => setBarTenderQuantityMode('stock')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">Theo số lượng tồn kho thực tế</span>
                        <div className="text-[10px] text-slate-500">Ví dụ: Tồn kho 5 hộp $\rightarrow$ sinh 5 tem để dán từng hộp</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name="bt-qty-mode"
                        checked={barTenderQuantityMode === 'custom'}
                        onChange={() => setBarTenderQuantityMode('custom')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">Cố định số tem mỗi loại:</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={barTenderCustomCopies}
                          onChange={(e) => setBarTenderCustomCopies(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 px-2 py-0.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                          onClick={(e) => {
                            setBarTenderQuantityMode('custom');
                            e.stopPropagation();
                          }}
                        />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Target Printer Model Selector */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 text-xs">Loại máy in tem nhãn nhiệt:</span>
                    <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                      {barTenderPrinter === 'TSC_TL240' ? 'TSC TL 240 / TE240' : 'Zebra ZD421'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBarTenderPrinter('TSC_TL240')}
                      className={`p-2 rounded-xl text-left border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                        barTenderPrinter === 'TSC_TL240'
                          ? 'bg-white border-indigo-500 text-indigo-950 shadow-xs ring-2 ring-indigo-200'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <span className="text-base">🖨️</span>
                      <div>
                        <div>TSC TL 240</div>
                        <div className="text-[9.5px] font-normal text-indigo-600 font-sans">Lệnh TSPL · 203 DPI</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarTenderPrinter('ZEBRA_ZD421')}
                      className={`p-2 rounded-xl text-left border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                        barTenderPrinter === 'ZEBRA_ZD421'
                          ? 'bg-white border-indigo-500 text-indigo-950 shadow-xs ring-2 ring-indigo-200'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <span className="text-base">🦓</span>
                      <div>
                        <div>Zebra ZD421</div>
                        <div className="text-[9.5px] font-normal text-slate-500 font-sans">Lệnh ZPL · 203 DPI</div>
                      </div>
                    </button>
                  </div>
                </div>

              </div>

              {/* Data Preview Box */}
              <div className="border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-indigo-950">
                    <span>👁️ Xem trước dữ liệu CSV (Mẫu 5 dòng đầu)</span>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Tổng cộng: <strong>{getBarTenderExportRows().length}</strong> dòng tem nhãn
                  </span>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl border border-indigo-100 max-h-44 shadow-2xs">
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead className="bg-indigo-50/70 border-b border-indigo-100 text-indigo-900 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 whitespace-nowrap">Barcode</th>
                        <th className="p-2 whitespace-nowrap">Tên hóa chất</th>
                        <th className="p-2 whitespace-nowrap">Số lô</th>
                        <th className="p-2 whitespace-nowrap">Hạn dùng</th>
                        <th className="p-2 whitespace-nowrap">Vị trí</th>
                        <th className="p-2 whitespace-nowrap">Tồn kho</th>
                        <th className="p-2 whitespace-nowrap">Bản in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getBarTenderExportRows().slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="p-2 font-mono font-bold text-indigo-700 whitespace-nowrap">{row.barcode}</td>
                          <td className="p-2 font-medium text-slate-800 max-w-[200px] truncate">{row.name}</td>
                          <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{row.lotNumber || '---'}</td>
                          <td className="p-2 text-slate-600 whitespace-nowrap">{row.expiryVN}</td>
                          <td className="p-2 text-slate-600 whitespace-nowrap">{row.location}</td>
                          <td className="p-2 text-slate-600 whitespace-nowrap">{row.stock} {row.unit}</td>
                          <td className="p-2 text-slate-500 font-mono whitespace-nowrap">#{row.copyIndex}/{row.totalCopies}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[10px] text-indigo-600/90 leading-relaxed">
                  💡 <strong>Ghi chú kỹ thuật:</strong> File CSV được lưu ở chuẩn <strong>UTF-8 with BOM</strong>. BarTender Enterprise và Microsoft Excel sẽ tự động nhận diện đúng 100% tiếng Việt có dấu. Tất cả 22 trường dữ liệu chuyên sâu được xuất đầy đủ.
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExportBarTenderBTXML}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                  title="Xuất script tự động hóa BTXML cho BarTender Integration Builder / Commander"
                >
                  <span>⚡ Script BTXML</span>
                </button>
                {barTenderPrinter === 'TSC_TL240' ? (
                  <button
                    type="button"
                    onClick={handleExportTSPL}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                    title="Xuất mã máy in TSC TSPL (.tspl) cho máy in TSC TL 240 / TE240"
                  >
                    <span>🖨️ Mã TSC TSPL</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleExportZPL}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                    title="Xuất mã máy in Zebra ZPL (.zpl) nạp trực tiếp qua Zebra Setup Utilities"
                  >
                    <span>🖨️ Mã ZPL</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsBarTenderExportModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleExportBarTenderCSV}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <span>📊 Tải file CSV BarTender ({getBarTenderExportRows().length} tem)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= BARTENDER INTEGRATION GUIDE MODAL ================= */}
      {isBarTenderGuideOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 text-lg font-bold">
                  🏷️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Hướng dẫn import CSV vào BarTender Enterprise Automation
                  </h3>
                  <p className="text-xs text-slate-500">
                    In barcode sắc nét, cố định chiều in, không bị lệch khổ giấy trên máy in Zebra
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBarTenderGuideOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-4 space-y-4 text-xs text-slate-700 pr-1 flex-1 leading-relaxed">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-start gap-2.5">
                <span className="text-base mt-0.5">💡</span>
                <div className="text-indigo-900">
                  <strong>Tại sao nên in qua BarTender với máy TSC TL 240?</strong><br />
                  BarTender giao tiếp trực tiếp với Driver Seagull gốc của máy in TSC TL 240 / TE240. Barcode Code 128 được vẽ từ font máy in phần cứng, đảm bảo máy đọc mã vạch quét ngay lập tức. Bạn chỉ cần chọn căn giữa (Center in Form) trên BarTender Designer để mã vạch luôn nằm chính xác ở tâm giữa tem 50x20mm.
                </div>
              </div>

              {/* Hướng dẫn căn giữa Barcode */}
              <div className="border border-blue-200 bg-blue-50/60 rounded-2xl p-3.5 space-y-1.5">
                <h4 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                  <span>🎯</span> Cách căn giữa Barcode 100% trên BarTender &amp; máy TSC TL 240:
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 text-xs">
                  <li><strong>Trên BarTender Designer:</strong> Nhấp chọn đối tượng Barcode $\rightarrow$ Menu <strong>Arrange (Sắp xếp) &gt; Align (Căn chỉnh) &gt; Center in Form (Căn giữa khổ tem)</strong>. Hoặc nhấp đúp Barcode $\rightarrow$ Tab <strong>Position</strong> $\rightarrow$ <strong>Object Alignment: Center</strong>.</li>
                  <li><strong>Trên máy in TSC TL 240:</strong> Mở nắp máy, dùng 2 ngón tay gạt <strong>2 thanh kẹp cuộn giấy màu xanh lục (Green Guides)</strong> ép sát vào hai mép cuộn tem để cuộn giấy luôn chạy ngay tâm giữa đầu in.</li>
                  <li><strong>Calibrate Gap TSC TL 240:</strong> Tắt nguồn máy $\rightarrow$ Nhấn giữ nút tròn <strong>FEED</strong> rồi bật nguồn $\rightarrow$ Thả nút FEED ngay khi đèn nháy đỏ để máy tự đo khoảng cách tem.</li>
                </ul>
              </div>

              {/* Cách 1: Kết nối CSV vào BarTender Designer */}
              <div className="border border-indigo-100 rounded-2xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                    <h4 className="font-bold text-indigo-950 text-sm">
                      Cách 1: Kết nối file .CSV vào BarTender Designer (Dễ nhất - 30 giây)
                    </h4>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                    Khuyên dùng
                  </span>
                </div>
                <div className="pl-8 space-y-2 text-slate-600">
                  <p><strong>Bước 1:</strong> Bấm nút <strong>"Tải file CSV BarTender"</strong> để tải file dữ liệu về máy tính (ví dụ: <code>BarTender_HoaChat_all_....csv</code>).</p>
                  <p><strong>Bước 2:</strong> Mở BarTender Designer, tạo khổ tem:
                    <ul className="list-disc pl-4 mt-1">
                      <li>Khổ tem phổ biến: Width <strong>50.0 mm</strong>, Height <strong>20.0 mm</strong> (hoặc khổ tem hiện có của viện).</li>
                    </ul>
                  </p>
                  <p><strong>Bước 3:</strong> Trên thanh menu của BarTender, chọn <strong>File &gt; Database Connection Setup</strong> (Thiết lập cơ sở dữ liệu) &gt; chọn <strong>Text File</strong> &gt; Duyệt tìm (Browse) đến file <code>.csv</code> vừa tải.</p>
                  <p><strong>Bước 4:</strong> Kéo các đối tượng lên mẫu tem:
                    <ul className="list-disc pl-4 mt-1">
                      <li>Đối tượng <strong>Barcode (Code 128)</strong>: Chọn Data Source nối với cột <code>Barcode</code>.</li>
                      <li>Các đối tượng <strong>Text</strong>: Nối với cột <code>TenHoaChat</code>, <code>SoLo</code>, <code>HanSuDung</code>, <code>ViTriLuuTru</code>, <code>DonViYTe</code>.</li>
                    </ul>
                  </p>
                  <p><strong>Bước 5:</strong> Bấm <strong>Ctrl + P</strong> $\rightarrow$ BarTender sẽ tự động in tất cả nhãn theo danh mục!</p>
                </div>
              </div>

              {/* Cách 2: Tự động hóa với BarTender Enterprise Automation */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Cách 2: BarTender Enterprise Automation (Hot Folder / Integration Builder)
                    </h4>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    Tự động
                  </span>
                </div>
                <div className="pl-8 space-y-1.5 text-slate-600">
                  <p>Cấu hình <strong>BarTender Integration Builder</strong> quét một thư mục định kỳ (ví dụ: <code>C:\HotFolder_InTem\</code>).</p>
                  <p>Khi tải file <code>.csv</code> hoặc bấm nút <strong>"Script BTXML"</strong> và lưu vào thư mục này, BarTender Enterprise Automation sẽ tự động phát hiện và kích hoạt lệnh in tức thì đến máy in Zebra ZD421 mà nhân viên không cần mở BarTender!</p>
                </div>
              </div>

              {/* Danh sách các trường dữ liệu chuẩn */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-white space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                  📋 Danh sách 22 trường dữ liệu chuẩn trong file CSV:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10.5px] text-slate-600">
                  <div>• <strong>Barcode</strong> (Mã quét)</div>
                  <div>• <strong>MaHoaChat</strong> (ID)</div>
                  <div>• <strong>TenHoaChat</strong> (Tên)</div>
                  <div>• <strong>KhoaPhong</strong> (Bộ phận)</div>
                  <div>• <strong>HangSanXuat</strong> (Hãng)</div>
                  <div>• <strong>SoLo</strong> (LOT)</div>
                  <div>• <strong>HanSuDung</strong> (dd/mm/yyyy)</div>
                  <div>• <strong>HanDungGoc_ISO</strong></div>
                  <div>• <strong>DonVi</strong> (Hộp/Chai)</div>
                  <div>• <strong>QuyCach</strong> (Pack size)</div>
                  <div>• <strong>TonKho</strong> (Số lượng)</div>
                  <div>• <strong>NguongToiThieu</strong></div>
                  <div>• <strong>ViTriLuuTru</strong> (Tủ lạnh)</div>
                  <div>• <strong>HanMoNap_Ngay</strong></div>
                  <div>• <strong>YeuCauHoanNguyen</strong></div>
                  <div>• <strong>MaDanhMucBarcode</strong></div>
                  <div>• <strong>XetNghiemLienQuan</strong></div>
                  <div>• <strong>GhiChu</strong></div>
                  <div>• <strong>SoBanIn</strong> / <strong>TongSoBanIn</strong></div>
                  <div>• <strong>DonViYTe</strong></div>
                  <div>• <strong>NgayXuatDuLieu</strong></div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportBarTenderCSV}
                className="px-4 py-2 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold rounded-xl transition-all cursor-pointer border border-indigo-200 flex items-center gap-1.5"
              >
                <span>📊 Tải file CSV ngay</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBarTenderGuideOpen(false)}
                className="px-5 py-2 text-xs text-white bg-slate-800 hover:bg-slate-900 font-bold rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
