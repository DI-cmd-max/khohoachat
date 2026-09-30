import React, { useState, useRef, useEffect } from 'react';
import { usePagination } from '../hooks/usePagination';
import { 
  Plus, 
  Layers, 
  CheckCircle, 
  Trash2, 
  AlertTriangle, 
  User, 
  Beaker,
  Droplet,
  Clock,
  HelpCircle,
  XCircle,
  Minus,
  Camera,
  FileText,
  FileSpreadsheet,
  Paperclip,
  Download,
  Eye,
  ArrowUpRight,
  Printer,
  Edit,
  Settings,
  Search,
  Copy,
  X
} from 'lucide-react';
import { ReconstitutionLog, LabCategory, User as AppUser, ReagentMaterial, BarcodeCategory, SystemSettings } from '../types';
import { formatDateTimeVN, formatDateVN, exportToExcel, exportToPDF } from '../utils';
import JsBarcode from 'jsbarcode';

// Pure SVG generator for 100% offline, standalone barcode rendering fitted for 2x5cm (50x20mm)
function generatePureBarcodeSvg(value: string, heightMm = 7.5, isVertical = false): string {
  try {
    const cleanVal = (value || 'QC').trim();
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Code 128 module count: ~11 modules per character + 35 start/stop/check modules
    const numModules = cleanVal.length * 11 + 35;
    // In vertical mode on a 50x20mm label, barcode length fits in ~15.5mm
    const targetWidthMm = isVertical 
      ? 15.5 
      : Math.max(30, Math.min(43, Math.round(numModules * 0.19 * 10) / 10));

    JsBarcode(svgNode, cleanVal, {
      format: 'CODE128',
      width: isVertical ? 1 : 2,
      height: isVertical ? 25 : 40,
      displayValue: false,
      margin: 0,
      background: 'transparent',
      lineColor: '#000000',
    });

    // Make SVG vector scalable with exact 2x5cm fitting
    svgNode.setAttribute('preserveAspectRatio', 'none');
    svgNode.setAttribute('style', `display:block;margin:0 auto;width:${targetWidthMm}mm;max-width:${isVertical ? '16mm' : '44mm'};height:${heightMm}mm;`);
    return svgNode.outerHTML;
  } catch (err) {
    console.error('generatePureBarcodeSvg error:', err);
    return `<div style="font-family:monospace;font-size:10px;text-align:center;">${value}</div>`;
  }
}

interface ReconstitutionTabProps {
  reconstitutions: ReconstitutionLog[];
  reagents: ReagentMaterial[];
  simulatedTime: string; // ISO String
  onAddReconstitution: (log: Omit<ReconstitutionLog, 'id' | 'expiryTimestamp'> | Omit<ReconstitutionLog, 'id' | 'expiryTimestamp'>[]) => void;
  onUpdateReconstitution: (log: ReconstitutionLog) => void;
  onUpdateReconStatus: (id: string, status: 'Đang sử dụng' | 'Đã hết' | 'Đã hủy') => void;
  onDecrementAliquot: (id: string) => void;
  onDeleteRecon: (id: string) => void;
  onAddTransaction: (reagentId: string, type: 'nhap' | 'xuat' | 'Hủy' | 'Xuất' | 'linh' | 'Thanh lý' | 'Lỗi/Hỏng', quantity: number, actor: string, notes: string) => Promise<void>;
  currentUser: AppUser;
  targetHighlight?: { tab: string; id?: string; name?: string };
  onClearHighlight?: () => void;
  barcodeCategories: BarcodeCategory[];
  onSaveBarcodeCategory: (bc: BarcodeCategory) => void;
  onDeleteBarcodeCategory: (id: string) => void;
  prefillReconstitutionData?: {
    barcodeCategoryCode?: string;
    name?: string;
    lotNumber?: string;
    category?: LabCategory;
  } | null;
  onClearPrefillRecon?: () => void;
  onNavigateToCatalogWithBarcodeCode?: (code: string) => void;
  systemSettings?: SystemSettings;
}

export default function ReconstitutionTab({
  reconstitutions,
  reagents = [],
  simulatedTime,
  onAddReconstitution,
  onUpdateReconstitution,
  onUpdateReconStatus,
  onDecrementAliquot,
  onDeleteRecon,
  onAddTransaction,
  currentUser,
  targetHighlight,
  onClearHighlight,
  barcodeCategories = [],
  onSaveBarcodeCategory,
  onDeleteBarcodeCategory,
  prefillReconstitutionData,
  onClearPrefillRecon,
  onNavigateToCatalogWithBarcodeCode,
  systemSettings,
}: ReconstitutionTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<LabCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'ACTIVE' | 'EXPIRED' | 'COMPLETED'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [unregisteredCode, setUnregisteredCode] = useState('');
  const [isUnregisteredDialogOpen, setIsUnregisteredDialogOpen] = useState(false);

  // Selection state for export
  const [selectedReconIds, setSelectedReconIds] = useState<string[]>([]);

  useEffect(() => {
    if (reconstitutions && reconstitutions.length > 0) {
      setSelectedReconIds(prev => {
        const itemIds = reconstitutions.map(item => item.id);
        if (prev.length === 0) return itemIds;
        return prev.filter(id => itemIds.includes(id));
      });
    }
  }, [reconstitutions]);

  const [innerTab, setInnerTab] = useState<'log' | 'catalog'>('log');

  // Barcode Catalog Form State (for adding/editing barcode categories)
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BarcodeCategory | null>(null);
  const [catalogFormData, setCatalogFormData] = useState({
    code: '',
    name: '',
    category: 'Sinh hóa' as LabCategory,
    description: '',
  });

  // Print Label Modal State - Dedicated to TSC TL 240
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedReconForPrint, setSelectedReconForPrint] = useState<ReconstitutionLog | null>(null);
  const [selectedBarcodeCategory, setSelectedBarcodeCategory] = useState<BarcodeCategory | null>(null);
  const [isTSCGuideOpen, setIsTSCGuideOpen] = useState(false);
  const [isBarTenderGuideOpen, setIsBarTenderGuideOpen] = useState(false);
  
  // Custom print config for TSC TL 240 (50mm x 20mm)
  const [printConfig, setPrintConfig] = useState({
    hospitalName: 'BVĐK TP Cần Thơ - Khoa XN',
    includeHospital: true,
    includeLot: false,
    includeIndex: false,
    customCount: 0, // 0 means use remainingAliquots, > 0 means custom count
    labelSize: '50x20' as '50x20' | '50x20_double',
    orientation: 'landscape' as 'landscape' | 'portrait',
    barcodeOrientation: 'horizontal' as 'horizontal' | 'vertical' | 'rotate180' | 'vertical270',
    barcodeHeight: 7.5, // 7.5mm standard, fits 2x5cm perfectly
  });

  // React to targetHighlight
  useEffect(() => {
    if (targetHighlight) {
      setCategoryFilter('All');
      setStatusFilter('All');
      
      const timer = setTimeout(() => {
        const element = document.getElementById(`recon-row-${targetHighlight.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetHighlight]);

  useEffect(() => {
    if (prefillReconstitutionData) {
      // Find the reagent in the list to fully prefill
      const matchedReagent = reagents.find(r => 
        (prefillReconstitutionData.name && r.name.toLowerCase() === prefillReconstitutionData.name.toLowerCase() && r.lotNumber === prefillReconstitutionData.lotNumber) ||
        (prefillReconstitutionData.barcodeCategoryCode && r.barcodeCategoryCode === prefillReconstitutionData.barcodeCategoryCode)
      );

      if (matchedReagent) {
        setSelectedReagent(matchedReagent);
        setFormData(prev => ({
          ...prev,
          targetItemName: matchedReagent.name,
          category: matchedReagent.category,
          sourceLot: matchedReagent.lotNumber || '',
          stabilityDays: matchedReagent.inUseStabilityDays ? matchedReagent.inUseStabilityDays : prev.stabilityDays,
          barcodeCategoryCode: matchedReagent.barcodeCategoryCode || '',
        }));
        setSelectedReagentTests(matchedReagent.assignedTests || []);
        setSelectedReagentImageUrl(matchedReagent.specTableImageUrl || '');
      } else {
        // Fallback prefill if not found in list
        setFormData(prev => ({
          ...prev,
          targetItemName: prefillReconstitutionData.name || '',
          category: prefillReconstitutionData.category || 'Sinh hóa',
          sourceLot: prefillReconstitutionData.lotNumber || '',
          barcodeCategoryCode: prefillReconstitutionData.barcodeCategoryCode || '',
        }));
      }

      setIsAddModalOpen(true);

      // Clear the prefill state so it doesn't trigger again on tab switch
      if (onClearPrefillRecon) {
        onClearPrefillRecon();
      }
    }
  }, [prefillReconstitutionData, reagents]);

  const handleSearchSubmit = (query: string) => {
    const q = query.trim();
    if (!q) return;

    // Check if there is any reagent in reagents matching this query
    const hasReagentMatch = reagents.some(r => 
      r.id.toLowerCase() === q.toLowerCase() ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.lotNumber.toLowerCase() === q.toLowerCase() ||
      (r.barcodeCategoryCode && r.barcodeCategoryCode.toLowerCase() === q.toLowerCase())
    );

    // Check if there is any barcode category with this code
    const hasBarcodeCatMatch = barcodeCategories.some(bc =>
      bc.code.toLowerCase() === q.toLowerCase() ||
      bc.name.toLowerCase().includes(q.toLowerCase())
    );

    // Check if there is any reconstitution matching it
    const hasReconMatch = reconstitutions.some(recon =>
      recon.targetItemName.toLowerCase().includes(q.toLowerCase()) ||
      recon.sourceLot.toLowerCase() === q.toLowerCase() ||
      recon.id.toLowerCase() === q.toLowerCase()
    );

    if (!hasReagentMatch && !hasBarcodeCatMatch && !hasReconMatch) {
      // If none matches, show confirm dialog
      setUnregisteredCode(q);
      setIsUnregisteredDialogOpen(true);
    }
  };

  // Form states for adding reconstitution
  const [formData, setFormData] = useState({
    targetItemName: '',
    category: 'Sinh hóa' as LabCategory,
    sourceLot: '',
    volume: '3.0 mL',
    solvent: 'Nước cất hai lần (deionized)',
    preparedBy: currentUser?.fullName || '',
    stabilityDays: 28,
    notes: '',
    aliquotsCount: 10,
    aliquotVolume: '0.5 mL',
    barcodeCategoryCode: '',
    sourceBottlesCount: 1,
    aliquotsPerBottle: 10,
  });

  // Print Log states
  const [isPrintLogModalOpen, setIsPrintLogModalOpen] = useState(false);
  const [printLogStartDate, setPrintLogStartDate] = useState('');
  const [printLogEndDate, setPrintLogEndDate] = useState('');

  // Edit reconstitution states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ReconstitutionLog | null>(null);
  const [editFormData, setEditFormData] = useState({
    targetItemName: '',
    category: 'Sinh hóa' as LabCategory,
    sourceLot: '',
    volume: '',
    solvent: '',
    preparedBy: '',
    stabilityDays: 28,
    notes: '',
    aliquotsCount: 0,
    aliquotVolume: '',
    remainingAliquots: 0,
    barcodeCategoryCode: '',
  });

  const handleOpenEditModal = (log: ReconstitutionLog) => {
    setEditingLog(log);
    setEditFormData({
      targetItemName: log.targetItemName || '',
      category: log.category || 'Sinh hóa',
      sourceLot: log.sourceLot || '',
      volume: log.volume || '',
      solvent: log.solvent || '',
      preparedBy: log.preparedBy || '',
      stabilityDays: Math.round((log.stabilityHours || 0) / 24),
      notes: log.notes || '',
      aliquotsCount: log.aliquotsCount || 0,
      aliquotVolume: log.aliquotVolume || '',
      remainingAliquots: log.remainingAliquots !== undefined ? log.remainingAliquots : (log.aliquotsCount || 0),
      barcodeCategoryCode: log.barcodeCategoryCode || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    onUpdateReconstitution({
      ...editingLog,
      targetItemName: editFormData.targetItemName,
      category: editFormData.category,
      sourceLot: editFormData.sourceLot,
      volume: editFormData.volume,
      solvent: editFormData.solvent,
      preparedBy: editFormData.preparedBy,
      stabilityHours: editFormData.stabilityDays * 24,
      notes: editFormData.notes,
      aliquotsCount: editFormData.aliquotsCount,
      aliquotVolume: editFormData.aliquotVolume,
      remainingAliquots: editFormData.remainingAliquots,
      barcodeCategoryCode: editFormData.barcodeCategoryCode,
    });

    setIsEditModalOpen(false);
    setEditingLog(null);
  };

  // Keep state in sync with currentUser
  React.useEffect(() => {
    if (currentUser?.fullName) {
      setFormData(prev => ({ ...prev, preparedBy: currentUser.fullName }));
    }
  }, [currentUser]);

  // AI Image OCR State & Handler
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [selectedReagent, setSelectedReagent] = useState<ReagentMaterial | null>(null);
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
  const [selectedReagentTests, setSelectedReagentTests] = useState<string[]>([]);
  const [selectedReagentImageUrl, setSelectedReagentImageUrl] = useState<string>('');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedReagentsList, setSelectedReagentsList] = useState<ReagentMaterial[]>([]);
  const [highlightedFields, setHighlightedFields] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOcrClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result as string;
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
          targetItemName: data.name || '',
          sourceLot: data.lotNumber || '',
          volume: '', // Clear volume completely
          aliquotsCount: '' as any, // Clear aliquotsCount completely
          aliquotVolume: '', // Clear aliquotVolume completely
          notes: '', // Clear notes completely
        }));

        const newHighlights: Record<string, boolean> = {};
        if (!data.name) newHighlights.targetItemName = true;
        if (!data.lotNumber) newHighlights.sourceLot = true;
        
        // Always highlight fields that cannot be read from labels to remind the technician
        newHighlights.volume = true;
        newHighlights.aliquotsCount = true;
        newHighlights.aliquotVolume = true;
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

  const simulatedTimeMs = new Date(simulatedTime).getTime();

  // Filter logic
  const filteredReconstitutions = reconstitutions.filter(recon => {
    const matchesCategory = categoryFilter === 'All' || recon.category === categoryFilter;
    
    let matchesStatus = true;
    const isExpired = new Date(recon.expiryTimestamp).getTime() <= simulatedTimeMs;
    
    if (statusFilter === 'ACTIVE') {
      matchesStatus = recon.status === 'Đang sử dụng' && !isExpired;
    } else if (statusFilter === 'EXPIRED') {
      matchesStatus = recon.status === 'Đang sử dụng' && isExpired;
    } else if (statusFilter === 'COMPLETED') {
      matchesStatus = recon.status === 'Đã hết' || recon.status === 'Đã hủy';
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();
    let matchesSearch = true;
    if (normalizedQuery) {
      // Find matching barcode category template by comparing text
      const matchedBC = barcodeCategories.find(bc => 
        bc.name.toLowerCase() === recon.targetItemName.toLowerCase() ||
        recon.targetItemName.toLowerCase().includes(bc.name.toLowerCase()) ||
        bc.name.toLowerCase().includes(recon.targetItemName.toLowerCase())
      );
      
      const barcodeCode = matchedBC ? matchedBC.code.toLowerCase() : '';
      const barcodeWithLot = matchedBC ? `${matchedBC.code}-${recon.sourceLot}`.toLowerCase() : '';

      const matchingReagent = reagents.find(r => 
        (r.name === recon.targetItemName && r.lotNumber === recon.sourceLot) ||
        r.name === recon.targetItemName
      );
      const assignedTests = matchingReagent?.assignedTests || [];
      const matchesTestNames = assignedTests.some(test => test.toLowerCase().includes(normalizedQuery));

      matchesSearch = 
        recon.targetItemName.toLowerCase().includes(normalizedQuery) ||
        recon.sourceLot.toLowerCase().includes(normalizedQuery) ||
        recon.id.toLowerCase().includes(normalizedQuery) ||
        (recon.notes || '').toLowerCase().includes(normalizedQuery) ||
        (recon.preparedBy || '').toLowerCase().includes(normalizedQuery) ||
        barcodeCode.includes(normalizedQuery) ||
        barcodeWithLot.includes(normalizedQuery) ||
        matchesTestNames;
    }

    return matchesCategory && matchesStatus && matchesSearch;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const { next, prev, jump, currentData: paginatedReconstitutions, currentPage, maxPage, totalItems } = usePagination(filteredReconstitutions, 20);

  const filteredIds = paginatedReconstitutions.map(recon => recon.id);
  const selectedFilteredIds = filteredIds.filter(id => selectedReconIds.includes(id));
  const isAllFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedReconIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedReconIds(prev => {
        const next = [...prev];
        filteredIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedReconIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Handle open Add Modal
  const openAddModal = () => {
    setFormData({
      targetItemName: '',
      category: 'Sinh hóa',
      sourceLot: '',
      volume: '3.0 mL',
      solvent: 'Nước cất hai lần (deionized)',
      preparedBy: currentUser?.fullName || '',
      stabilityDays: 28,
      notes: '',
      aliquotsCount: 10,
      aliquotVolume: '0.5 mL',
      barcodeCategoryCode: '',
      sourceBottlesCount: 1,
      aliquotsPerBottle: 10,
    });
    setSelectedReagent(null);
    setSelectedReagentTests([]);
    setSelectedReagentImageUrl('');
    setHighlightedFields({});
    setToastMessage(null);
    setIsAddModalOpen(true);
  };

  // Duplicate Reconstitution
  const handleDuplicateRecon = (recon: ReconstitutionLog) => {
    setFormData({
      targetItemName: recon.targetItemName,
      category: recon.category,
      sourceLot: recon.sourceLot,
      volume: recon.volume,
      solvent: recon.solvent,
      preparedBy: currentUser?.fullName || '',
      stabilityDays: Math.round(recon.stabilityHours / 24),
      notes: recon.notes || '',
      aliquotsCount: recon.aliquotsCount || 10,
      aliquotVolume: recon.aliquotVolume || '',
      barcodeCategoryCode: recon.barcodeCategoryCode || '',
      sourceBottlesCount: 1,
      aliquotsPerBottle: recon.aliquotsCount || 10,
    });
    
    // Find matching reagent to preselect if possible
    const reagent = reagents.find(r => r.name === recon.targetItemName && r.lotNumber === recon.sourceLot);
    if (reagent) {
      setSelectedReagent(reagent);
      setSelectedReagentTests(reagent.assignedTests || []);
      setSelectedReagentImageUrl(reagent.specTableImageUrl || '');
    } else {
      setSelectedReagent(null);
      setSelectedReagentTests([]);
      setSelectedReagentImageUrl('');
    }
    
    setHighlightedFields({});
    setToastMessage(null);
    setIsAddModalOpen(true);
  };

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isMultiSelectMode && selectedReagentsList.length > 0) {
      // 1. Validation
      for (const r of selectedReagentsList) {
        if (r.currentStock < formData.sourceBottlesCount) {
          setToastMessage(`Lỗi: Tồn kho của ${r.name} (${r.currentStock}) không đủ để xuất ra ${formData.sourceBottlesCount} chai.`);
          return;
        }
      }
      
      // 2. Add Transactions
      for (const r of selectedReagentsList) {
        await onAddTransaction(r.id, 'xuat', formData.sourceBottlesCount, currentUser?.fullName || '', `Pha/hoàn nguyên (${formData.sourceBottlesCount} chai, ${formData.aliquotsCount} tuýp)`);
      }

      const logs = selectedReagentsList.map(r => {
        let detectedBarcodeCode = '';
        if (r.name && barcodeCategories.length > 0) {
          const matchedBC = barcodeCategories.find(bc => r.name.toLowerCase().includes(bc.name.toLowerCase()) || r.name.toLowerCase() === bc.name.toLowerCase());
          if (matchedBC) detectedBarcodeCode = matchedBC.code;
        }

        return {
          targetItemName: r.name,
          category: r.category as LabCategory,
          sourceLot: r.lotNumber || '',
          volume: formData.volume,
          solvent: formData.solvent,
          preparedBy: formData.preparedBy,
          stabilityHours: formData.stabilityDays * 24,
          notes: formData.notes,
          aliquotsCount: formData.aliquotsCount,
          aliquotVolume: formData.aliquotVolume,
          remainingAliquots: formData.aliquotsCount,
          status: 'Đang sử dụng' as const,
          timestamp: simulatedTime,
          barcodeCategoryCode: detectedBarcodeCode,
        };
      });
      onAddReconstitution(logs);
    } else {
      // Single item case
      if (selectedReagent) {
         if (selectedReagent.currentStock < formData.sourceBottlesCount) {
           setToastMessage(`Lỗi: Tồn kho của ${selectedReagent.name} (${selectedReagent.currentStock}) không đủ để xuất ra ${formData.sourceBottlesCount} chai.`);
           return;
         }
         await onAddTransaction(selectedReagent.id, 'xuat', formData.sourceBottlesCount, currentUser?.fullName || '', `Pha/hoàn nguyên (${formData.sourceBottlesCount} chai, ${formData.aliquotsCount} tuýp)`);
      }

      onAddReconstitution({
        targetItemName: formData.targetItemName,
        category: formData.category,
        sourceLot: formData.sourceLot,
        volume: formData.volume,
        solvent: formData.solvent,
        preparedBy: formData.preparedBy,
        stabilityHours: formData.stabilityDays * 24,
        notes: formData.notes,
        aliquotsCount: formData.aliquotsCount,
        aliquotVolume: formData.aliquotVolume,
        remainingAliquots: formData.aliquotsCount,
        status: 'Đang sử dụng',
        timestamp: simulatedTime,
        barcodeCategoryCode: formData.barcodeCategoryCode,
      });
    }
    
    setSelectedReagent(null);
    setSelectedReagentsList([]);
    setIsMultiSelectMode(false);
    setIsAddModalOpen(false);
  };

  // --- BARCODE CATALOG MANAGEMENT HANDLERS ---
  const handleOpenCatalogModal = (cat?: BarcodeCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCatalogFormData({
        code: cat.code,
        name: cat.name,
        category: cat.category,
        description: cat.description || '',
      });
    } else {
      setEditingCategory(null);
      setCatalogFormData({
        code: '',
        name: '',
        category: 'Sinh hóa',
        description: '',
      });
    }
    setIsCatalogModalOpen(true);
  };

  const handleCatalogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogFormData.code.trim() || !catalogFormData.name.trim()) return;

    const bcData: BarcodeCategory = {
      id: editingCategory?.id || catalogFormData.code.toUpperCase().trim(),
      code: catalogFormData.code.toUpperCase().trim(),
      name: catalogFormData.name.trim(),
      category: catalogFormData.category,
      description: catalogFormData.description.trim(),
      createdAt: editingCategory?.createdAt || new Date().toISOString(),
    };

    onSaveBarcodeCategory(bcData);
    setIsCatalogModalOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCatalogItem = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa mã Barcode viết tắt này khỏi danh mục hệ thống?')) {
      onDeleteBarcodeCategory(id);
    }
  };

  // --- PRINT BARCODE LABELS HANDLERS ---
  const openPrintModal = (recon: ReconstitutionLog) => {
    setSelectedReconForPrint(recon);
    // Find matching barcode category template by comparing text
    const matched = barcodeCategories.find(bc => 
      recon.targetItemName.toLowerCase().includes(bc.name.toLowerCase()) ||
      recon.targetItemName.toLowerCase().includes(bc.code.toLowerCase()) ||
      bc.name.toLowerCase().includes(recon.targetItemName.toLowerCase())
    ) || barcodeCategories[0] || null;

    setSelectedBarcodeCategory(matched);
    setPrintConfig(prev => ({
      ...prev,
      hospitalName: 'BVĐK TP Cần Thơ - Khoa XN',
      includeLot: false,
      includeIndex: false,
      customCount: recon.remainingAliquots || recon.aliquotsCount || 1,
    }));
    setIsPrintModalOpen(true);
  };

  const openPrintCatalogModal = (cat: BarcodeCategory) => {
    setSelectedReconForPrint(null);
    setSelectedBarcodeCategory(cat);
    setPrintConfig(prev => ({
      ...prev,
      hospitalName: 'BVĐK TP Cần Thơ - Khoa XN',
      includeLot: false,
      includeIndex: false,
      customCount: 1,
    }));
    setIsPrintModalOpen(true);
  };

  // Helper to generate current label list based on printConfig
  const getPreparedLabels = () => {
    if (!selectedReconForPrint && !selectedBarcodeCategory) return [];

    const labelCount = printConfig.customCount || selectedReconForPrint?.remainingAliquots || selectedReconForPrint?.aliquotsCount || 1;
    const labels = [];
    for (let i = 1; i <= labelCount; i++) {
      const tubeIndex = String(i).padStart(2, '0');
      let barcodeValue = selectedBarcodeCategory?.code || 'QC';
      if (printConfig.includeLot && selectedReconForPrint?.lotNumber) {
        barcodeValue += `-${selectedReconForPrint.lotNumber}`;
      }
      if (printConfig.includeIndex) {
        barcodeValue += `-${tubeIndex}`;
      }
      
      labels.push({
        index: tubeIndex,
        barcodeValue,
        displayName: selectedBarcodeCategory?.name || selectedReconForPrint?.targetItemName || '',
        lot: selectedReconForPrint?.lotNumber || '',
        expiry: selectedReconForPrint ? formatDateVN(selectedReconForPrint.expiryTimestamp) : '',
        preparedBy: selectedReconForPrint?.preparedBy || currentUser?.fullName || '',
        hospitalName: printConfig.includeHospital ? printConfig.hospitalName : '',
      });
    }
    return labels;
  };

  // 1. Export BarTender CSV format (UTF-8 with BOM for Vietnamese characters)
  const handleExportBarTenderCSV = () => {
    const labels = getPreparedLabels();
    if (labels.length === 0) return;

    const headers = [
      'Barcode',
      'TenChatChuanQC',
      'SoLo',
      'HanSuDung',
      'SoThuTuTuyp',
      'NguoiHoanNguyen',
      'DonVi'
    ];

    const escapeCsv = (str: string) => {
      if (!str) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvRows = [
      headers.join(','),
      ...labels.map(l => [
        escapeCsv(l.barcodeValue),
        escapeCsv(l.displayName),
        escapeCsv(l.lot),
        escapeCsv(l.expiry),
        escapeCsv(l.index),
        escapeCsv(l.preparedBy),
        escapeCsv(l.hospitalName)
      ].join(','))
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanName = (labels[0]?.displayName || 'BarTender').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    link.href = url;
    link.setAttribute('download', `BarTender_Data_${cleanName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Export BarTender XML Script (.btxml) for BarTender Enterprise Automation / Integration Builder
  const handleExportBarTenderXML = () => {
    const labels = getPreparedLabels();
    if (labels.length === 0) return;

    const escapeXml = (unsafe: string) => {
      return (unsafe || '').replace(/[<>&'"]/g, (c) => {
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

    const cleanName = (labels[0]?.displayName || 'BarTender').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    const targetPrinterName = 'TSC TL 240';
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<XMLScript Version="2.0">
  <Command Name="PrintJob_HoanNguyen_${Date.now()}">
    <Print>
      <Format>C:\\BarTender_Templates\\Tem_Hoan_Nguyen_50x20.btw</Format>
      <PrintSetup>
        <Printer>${targetPrinterName}</Printer>
        <IdenticalCopiesOfLabel>1</IdenticalCopiesOfLabel>
      </PrintSetup>
      <RecordSet Name="Labels">
${labels.map(l => `        <Record>
          <Field Name="Barcode">${escapeXml(l.barcodeValue)}</Field>
          <Field Name="TenChatChuanQC">${escapeXml(l.displayName)}</Field>
          <Field Name="SoLo">${escapeXml(l.lot)}</Field>
          <Field Name="HanSuDung">${escapeXml(l.expiry)}</Field>
          <Field Name="SoThuTuTuyp">${escapeXml(l.index)}</Field>
          <Field Name="NguoiHoanNguyen">${escapeXml(l.preparedBy)}</Field>
          <Field Name="DonVi">${escapeXml(l.hospitalName)}</Field>
        </Record>`).join('\n')}
      </RecordSet>
    </Print>
  </Command>
</XMLScript>`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BarTender_Automation_${cleanName}_${new Date().toISOString().slice(0, 10)}.btxml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Export native TSC TSPL/TSPL2 code (.tspl / .prn) for TSC TL 240 / TE240 calibrated for 2x5cm
  const handleExportTSPL = () => {
    const labels = getPreparedLabels();
    if (labels.length === 0) return;

    const removeAccents = (str: string) => {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };

    const rotationDeg = printConfig.barcodeOrientation === 'vertical' ? 90 : printConfig.barcodeOrientation === 'vertical270' ? 270 : printConfig.barcodeOrientation === 'rotate180' ? 180 : 0;

    const tsplBlocks = labels.map(l => {
      const cleanName = removeAccents(l.displayName).substring(0, 24);
      const cleanHosp = l.hospitalName ? removeAccents(l.hospitalName).substring(0, 28) : '';
      const val = l.barcodeValue;
      // Calculate Code 128 width in dots at 203 DPI (8 dots/mm, 50mm = 400 dots, 20mm = 160 dots)
      const numModules = val.length * 11 + 35;
      // If 2 dots/module exceeds 340 dots (leaving 30 dots = 3.75mm quiet margin on each side), use narrow=1
      const narrow = (numModules * 2 > 340) ? 1 : 2;
      const barcodeWidthDots = numModules * narrow;
      const startX = Math.max(16, Math.floor((400 - barcodeWidthDots) / 2));
      const bcHeight = cleanHosp ? 42 : 50; // dots
      const bcY = cleanHosp ? 50 : 32;
      const textY = bcY + bcHeight + 4;
      const footerY = textY + 22;

      return `SIZE 50 mm, 20 mm
GAP 2 mm, 0 mm
DIRECTION 1,0
REFERENCE 0,0
OFFSET 0 mm
SET PEEL OFF
SET CUTTER OFF
SET PARTIAL_CUTTER OFF
CLS
${cleanHosp ? `TEXT 200,8,"0",0,1,1,2,"${cleanHosp}"\nBARLINE 15,24,370,1\nTEXT 200,28,"0",0,1,1,2,"${cleanName}"` : `TEXT 200,10,"0",0,1,1,2,"${cleanName}"`}
BARCODE ${startX},${bcY},"128",${bcHeight},0,${rotationDeg},${narrow},${narrow * 2},"${val}"
TEXT 200,${textY},"0",0,1,1,2,"${val}"
BARLINE 15,${footerY - 3},370,1
TEXT 20,${footerY},"0",0,1,1,0,"LOT: ${l.lot || '---'}"
TEXT 200,${footerY},"0",0,1,1,0,"HSD: ${l.expiry}"
${l.index ? `TEXT 340,${footerY},"0",0,1,1,0,"#${l.index}"` : ''}
PRINT 1,1`;
    }).join('\n\n');

    const cleanName = (labels[0]?.displayName || 'TSC_TL240').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    const blob = new Blob([tsplBlocks], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TSC_TL240_${cleanName}_${new Date().toISOString().slice(0, 10)}.tspl`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Print action specifically calibrated for TSC TL 240 (50mm x 20mm)
  const getPrintLabelHtml = () => {
    if (!selectedReconForPrint && !selectedBarcodeCategory) return null;

    const labels = getPreparedLabels();
    if (labels.length === 0) return null;

    const labelRows = [];
    const isDoubleRow = printConfig.labelSize === '50x20_double';
    const itemsPerRow = isDoubleRow ? 2 : 1;
    for (let i = 0; i < labels.length; i += itemsPerRow) {
      if (itemsPerRow === 1) {
        labelRows.push([labels[i]]);
      } else {
        labelRows.push([labels[i], labels[i + 1]]);
      }
    }

    const isVertical = printConfig.barcodeOrientation === 'vertical' || printConfig.barcodeOrientation === 'vertical270';
    const isRot180 = printConfig.barcodeOrientation === 'rotate180';
    const rotDeg = printConfig.barcodeOrientation === 'vertical270' ? -90 : 90;

    const renderSingleLabel = (item: typeof labels[0]) => {
      const bcHeight = isVertical ? 6.0 : (printConfig.includeHospital ? 7.0 : (printConfig.barcodeHeight || 8.0));
      const barcodeSvg = generatePureBarcodeSvg(item.barcodeValue, bcHeight, isVertical);

      if (isVertical) {
        return `
          <div class="print-label print-label-vertical">
            <div class="bc-vert-col">
              <div class="bc-vert-wrapper" style="transform: rotate(${rotDeg}deg);">
                ${barcodeSvg}
                <div class="barcode-text-vert">${item.barcodeValue}</div>
              </div>
            </div>
            <div class="info-vert-col">
              ${(printConfig.includeHospital && item.hospitalName) ? `<div class="header-hosp-vert">${item.hospitalName}</div>` : ''}
              <div class="item-name-vert">${item.displayName}</div>
              <div class="details-vert">
                <div>LOT: ${item.lot || '---'}</div>
                <div>HSD: ${item.expiry || '---'}</div>
              </div>
              ${item.index ? `<div class="index-badge-vert">Tuýp #${item.index}</div>` : `<div style="font-size: 6.5px; color: #64748b; text-align: right;">50x20mm</div>`}
            </div>
          </div>
        `;
      }

      return `
        <div class="print-label ${isRot180 ? 'rot-180' : ''}">
          ${(printConfig.includeHospital && item.hospitalName) ? `<div class="header-hosp">${item.hospitalName}</div>` : ''}
          <div class="item-name">${item.displayName}</div>
          <div class="barcode-container">
            ${barcodeSvg}
          </div>
          <div class="barcode-text">${item.barcodeValue}</div>
          <div class="footer-text">
            <span>LOT: ${item.lot || '---'}</span>
            <span>HSD: ${item.expiry || '---'}</span>
            ${item.index ? `<span>#${item.index}</span>` : ''}
          </div>
        </div>
      `;
    };

    const rowsHtml = labelRows.map((row) => `
      <div class="print-row">
        ${row[0] ? renderSingleLabel(row[0]) : ''}
        ${itemsPerRow === 2 && row[1] ? renderSingleLabel(row[1]) : ''}
      </div>
    `).join('');

    const pageWidth = isDoubleRow ? '104mm' : '50mm';
    const pageHeight = '20mm';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>In_Tem_TSC_TL240_50x20</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: ${pageWidth} ${pageHeight};
      margin: 0mm !important;
    }
    @media print {
      @page {
        size: ${pageWidth} ${pageHeight};
        margin: 0mm !important;
      }
      html, body {
        width: ${pageWidth} !important;
        height: ${pageHeight} !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: hidden !important;
      }
      .print-row {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .print-row:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-weight: 800;
      width: ${pageWidth};
      height: ${pageHeight};
      overflow: hidden;
    }
    .print-row {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      width: ${pageWidth};
      height: ${pageHeight};
      max-height: ${pageHeight};
      box-sizing: border-box;
      margin: 0 auto;
      padding: 0;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      background: #ffffff;
    }
    .print-row:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .print-label {
      width: 50mm;
      height: 20mm;
      max-width: 50mm;
      max-height: 20mm;
      min-width: 50mm;
      min-height: 20mm;
      box-sizing: border-box;
      padding: 0.8mm 1.5mm 0.8mm 1.5mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      overflow: hidden;
      border: none;
      background: #ffffff;
      color: #000000;
    }
    .print-label.print-label-vertical {
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
      padding: 0.8mm 1.5mm;
      text-align: left;
    }
    .print-label.rot-180 {
      transform: rotate(180deg);
    }
    .bc-vert-col {
      width: 18mm;
      height: 18.2mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .bc-vert-wrapper {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 16mm;
      height: 16mm;
      transform-origin: center center;
    }
    .barcode-text-vert {
      font-size: 7.5px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-weight: 900;
      text-align: center;
      margin-top: 0.5px;
      line-height: 1;
      color: #000000;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .info-vert-col {
      flex: 1;
      height: 18.2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-left: 1.5mm;
      border-left: 0.8px dashed #000000;
      box-sizing: border-box;
      overflow: hidden;
      min-width: 0;
    }
    .header-hosp-vert {
      font-size: 6px;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1;
      color: #000000;
    }
    .item-name-vert {
      font-size: 8.5px;
      font-weight: 900;
      line-height: 1.15;
      color: #000000;
      letter-spacing: -0.1px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      max-height: 6.8mm;
    }
    .details-vert {
      font-size: 7px;
      font-weight: 800;
      line-height: 1.2;
      color: #000000;
    }
    .index-badge-vert {
      font-size: 7.5px;
      font-weight: 900;
      color: #000000;
      text-align: right;
      line-height: 1;
    }
    .header-hosp {
      font-size: 6.5px;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 47mm;
      line-height: 1;
      color: #000000;
      letter-spacing: 0.1px;
    }
    .item-name {
      font-size: ${printConfig.includeHospital ? '8.5px' : '10px'};
      font-weight: 900;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 47mm;
      line-height: 1.15;
      color: #000000;
      letter-spacing: -0.1px;
    }
    .barcode-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      margin: 0.2mm auto;
      text-align: center;
    }
    .barcode-container svg {
      display: block !important;
      margin: 0 auto !important;
    }
    .barcode-text {
      font-size: 8.5px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-weight: 900 !important;
      text-align: center;
      width: 100%;
      letter-spacing: 0.8px;
      color: #000000 !important;
      line-height: 1;
      margin: 0.2mm 0;
    }
    .footer-text {
      font-size: 7.2px;
      font-weight: 800 !important;
      color: #000000 !important;
      border-top: 0.8px solid #000000 !important;
      padding-top: 0.4mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      line-height: 1;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  ${rowsHtml}
</body>
</html>`;
  };

  const handleDownloadPrintHtml = () => {
    const html = getPrintLabelHtml();
    if (!html) return;
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const itemName = (selectedBarcodeCategory?.code || selectedReconForPrint?.targetItemName || 'Tem').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      a.download = `In_Tem_TSC_${itemName}_50x20.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handlePrintAction = () => {
    const html = getPrintLabelHtml();
    if (!html) return;

    // Direct, reliable printing for TSC TL 240
    let printed = false;
    try {
      const printWindow = window.open('', '_blank', 'width=750,height=550');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 350);
        printed = true;
      }
    } catch (e) {
      console.warn('Popup blocked, falling back to iframe:', e);
    }

    if (!printed) {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      printFrame.style.width = '50mm';
      printFrame.style.height = '20mm';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch (err) {
            console.error('Print iframe error:', err);
          }
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 60000);
        }, 300);
      }

      // Also trigger direct HTML download so user has zero-obstacle offline print
      handleDownloadPrintHtml();
    }
  };

  const handleExportPDFReport = () => {
    const headers = ['Tên mẫu phẩm cần pha', 'Khoa phòng', 'Lô gốc', 'Thể tích', 'Dung môi', 'Người pha', 'Hạn sử dụng tối đa', 'Tuýp Aliquot', 'Trạng thái'];
    const keys = ['targetItemName', 'category', 'sourceLot', 'volume', 'solvent', 'preparedBy', 'expiryTimestamp', 'aliquotInfo', 'status'];
    const formatters = {
      expiryTimestamp: (val: any) => formatDateTimeVN(val),
      aliquotInfo: (val: any, row: any) => row.aliquotsCount !== undefined ? `${row.remainingAliquots}/${row.aliquotsCount} tuýp (${row.aliquotVolume})` : '—',
    };
    const exportData = filteredReconstitutions.filter(recon => selectedReconIds.includes(recon.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một mẫu phẩm để xuất PDF!');
      return;
    }
    exportToPDF('BÁO CÁO GIÁM SÁT HOÀN NGUYÊN CALIBRATOR / QC', headers, keys, exportData, formatters, systemSettings);
  };

  const handleExportExcelReport = () => {
    const headers = ['Tên mẫu phẩm cần pha', 'Khoa phòng', 'Lô gốc', 'Thể tích', 'Dung môi', 'Người pha', 'Hạn sử dụng tối đa', 'Tuýp Aliquot', 'Trạng thái'];
    const keys = ['targetItemName', 'category', 'sourceLot', 'volume', 'solvent', 'preparedBy', 'expiryTimestamp', 'aliquotInfo', 'status'];
    const formatters = {
      expiryTimestamp: (val: any) => formatDateTimeVN(val),
      aliquotInfo: (val: any, row: any) => row.aliquotsCount !== undefined ? `${row.remainingAliquots}/${row.aliquotsCount} tuýp (${row.aliquotVolume})` : 'Chưa chia tuýp',
    };
    const exportData = filteredReconstitutions.filter(recon => selectedReconIds.includes(recon.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một mẫu phẩm để xuất Excel!');
      return;
    }
    exportToExcel(exportData, headers, keys, 'Bao_Cao_Hoan_Nguyen_ISO_15189', formatters);
  };

  // Calculate status and remaining time string
  const getReconStabilityStatus = (recon: ReconstitutionLog) => {
    if (recon.status !== 'Đang sử dụng') {
      const isAliquot = recon.aliquotsCount !== undefined && recon.aliquotsCount > 0;
      const statusText = recon.status === 'Đã hết' 
        ? (isAliquot ? 'Hết Aliquot' : 'Đã hết') 
        : 'Đã hủy bỏ';
      return {
        badge: (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
            recon.status === 'Đã hết' 
              ? 'bg-rose-50 text-rose-700 border-rose-200' 
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {statusText}
          </span>
        ),
        timeString: '—',
        alertLevel: 'info'
      };
    }

    const expiryTime = new Date(recon.expiryTimestamp).getTime();
    const diffMs = expiryTime - simulatedTimeMs;

    if (diffMs <= 0) {
      const absHours = Math.abs(Math.ceil(diffMs / (1000 * 60 * 60)));
      let overdueString = '';
      if (absHours >= 24) {
        overdueString = `Đã quá hạn ${Math.floor(absHours / 24)} ngày ${absHours % 24} giờ. Hủy bỏ ngay!`;
      } else {
        overdueString = `Đã quá hạn ${absHours} giờ. Hủy bỏ ngay!`;
      }
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white animate-pulse">
            ❌ Hết hạn sử dụng
          </span>
        ),
        timeString: overdueString,
        alertLevel: 'critical'
      };
    }

    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hoursLeft < 2) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white animate-pulse">
            ⚠️ Sắp hết hạn
          </span>
        ),
        timeString: `Còn ${hoursLeft}h ${minsLeft}p (ổn định thấp)`,
        alertLevel: 'warning'
      };
    }

    let timeString = '';
    if (hoursLeft >= 24) {
      const daysLeft = Math.floor(hoursLeft / 24);
      const remainingHours = hoursLeft % 24;
      timeString = `Còn ${daysLeft} ngày ${remainingHours} giờ`;
    } else {
      timeString = `Còn ${hoursLeft}h ${minsLeft}p`;
    }

    return {
      badge: (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          🟢 Đang hoạt động
        </span>
      ),
      timeString: timeString,
      alertLevel: 'active'
    };
  };

  return (
    <div className="space-y-4" id="reconstitution-tab-root">
      
      {/* Sub-tab switcher */}
      <div className="flex border-b border-slate-200 shrink-0">
        <button
          onClick={() => setInnerTab('log')}
          className={`px-5 py-2.5 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            innerTab === 'log'
              ? 'border-teal-600 text-teal-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Nhật ký Hoàn nguyên</span>
        </button>
        <button
          onClick={() => setInnerTab('catalog')}
          className={`px-5 py-2.5 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            innerTab === 'catalog'
              ? 'border-teal-600 text-teal-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Danh mục mã Barcode QC/Calib ({barcodeCategories.length})</span>
        </button>
      </div>

      {innerTab === 'log' ? (
        <>
          {/* Control bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        
        {/* Search & Guide */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80 shrink-0 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên QC/CALIB, lot, tên TEST, barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(searchQuery);
                  }
                }}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchSubmit(searchQuery)}
              className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
              title="Quét hoặc kiểm tra xem mã đã được khai báo chưa"
            >
              <span>Kiểm tra mã</span>
            </button>
          </div>
          <div className="hidden xl:flex items-center gap-1.5 text-slate-400">
            <Layers className="h-3.5 w-3.5 text-teal-600/70" />
            <span className="text-[11px]">Giám sát hoàn nguyên Calibrator / QC đông khô</span>
          </div>
        </div>

        {/* Filters and Action */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
          
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
          >
            <option value="All">Trạng thái ổn định (Tất cả)</option>
            <option value="ACTIVE">Đang hoạt động ổn định</option>
            <option value="EXPIRED">Đã hết hạn độ ổn định</option>
            <option value="COMPLETED">Lịch sử lọ đã hết / hủy</option>
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
              onClick={() => {
                const now = new Date(simulatedTime);
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                setPrintLogStartDate(firstDay);
                setPrintLogEndDate(lastDay);
                setIsPrintLogModalOpen(true);
              }}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="In Nhật ký Pha / Hoàn nguyên"
            >
              <Printer className="h-3.5 w-3.5 text-indigo-600" />
              <span>In Nhật ký</span>
            </button>
          </div>

          {/* Add Reconstitution */}
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ml-auto md:ml-0"
            id="btn-add-reconstitution"
          >
            <Plus className="h-4 w-4" /> Pha / Hoàn nguyên mới
          </button>

        </div>

      </div>

      {targetHighlight && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span>Đang tiêu điểm tìm kiếm hoàn nguyên: <strong>{targetHighlight.name}</strong></span>
          </div>
          <button 
            onClick={() => {
              onClearHighlight?.();
            }}
            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md font-semibold transition-all cursor-pointer text-[11px]"
          >
            Hiển thị lại tất cả
          </button>
        </div>
      )}

      {/* Main Grid table */}
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[9px] tracking-wider">
            <tr>
              <th className="px-1.5 py-2 w-8 text-center">
                <input 
                  type="checkbox"
                  id="checkbox-all-recons"
                  checked={isAllFilteredSelected}
                  onChange={handleToggleSelectAll}
                  className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                  title="Chọn tất cả"
                />
              </th>
              <th className="px-2 py-2">Tên & Lô SX</th>
              <th className="px-1.5 py-2">Thể tích & Tồn kho</th>
              <th className="px-1.5 py-2">Thời gian (Pha - HSD)</th>
              <th className="px-1.5 py-2">Độ ổn định / Trạng thái</th>
              <th className="px-2 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredReconstitutions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Không tìm thấy dữ liệu hoàn nguyên nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              paginatedReconstitutions.map((recon) => {
                const stabilityStatus = getReconStabilityStatus(recon);
                const matchingReagent = reagents.find(r => 
                  (r.name === recon.targetItemName && r.lotNumber === recon.sourceLot) ||
                  r.name === recon.targetItemName
                );
                const assignedTests = matchingReagent?.assignedTests || [];

                return (
                  <tr 
                    key={recon.id} 
                    id={`recon-row-${recon.id}`}
                    className={`hover:bg-slate-50/50 transition-all ${
                      targetHighlight?.id === recon.id
                        ? 'ring-2 ring-amber-400 bg-amber-50/50 animate-pulse'
                        : ''
                    }`}
                  >
                      
                      {/* Checkbox */}
                      <td className="px-1.5 py-2.5 w-8 text-center">
                        <input 
                          type="checkbox"
                          id={`checkbox-recon-${recon.id}`}
                          checked={selectedReconIds.includes(recon.id)}
                          onChange={() => handleToggleSelectRow(recon.id)}
                          className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                        />
                      </td>
                      
                      {/* Target Item Name & Lot */}
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 text-xs">
                              {recon.targetItemName}
                            </span>
                            {matchingReagent?.attachmentUrl && (
                              <button
                                onClick={() => {
                                  setDocViewerReagent(matchingReagent);
                                  setIsDocViewerOpen(true);
                                }}
                                className="px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 border border-teal-100 text-teal-700 rounded-md text-[9px] font-bold flex items-center gap-0.5 transition-all cursor-pointer inline-flex scale-95 origin-left"
                                title={`Xem tài liệu đính kèm: ${matchingReagent.attachmentName || 'Tài liệu kỹ thuật'}`}
                              >
                                <Paperclip className="h-2.5 w-2.5" />
                                <span>Tài liệu</span>
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>Lô: <strong className="font-mono text-slate-700">{recon.sourceLot}</strong></span>
                            <span>| ID: {recon.id}</span>
                            <span>| Người pha: {recon.preparedBy}</span>
                          </div>
                        </div>
                      </td>

                      {/* Volume & Stock */}
                      <td className="px-1.5 py-2.5">
                        <div className="flex flex-col gap-1.5">
                          <div className="text-slate-800 font-medium flex items-center gap-1 text-[11px]">
                            <Beaker className="h-3 w-3 text-teal-600 shrink-0" />
                            <span>
                              {recon.aliquotsCount ? `Tổng: ${recon.volume} (đã chia ${recon.aliquotsCount} tuýp)` : recon.volume}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-0.5 truncate max-w-[180px]" title={recon.solvent}>
                            <Droplet className="h-2.5 w-2.5 text-blue-500 shrink-0" /> {recon.solvent}
                          </div>
                          {recon.aliquotsCount !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500">Tồn kho:</span>
                              <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md ${
                                recon.remainingAliquots === 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-teal-50 text-teal-800 border border-teal-100'
                              }`}>
                                {recon.remainingAliquots} / {recon.aliquotsCount} tuýp
                              </span>
                              {recon.status === 'Đang sử dụng' && recon.remainingAliquots !== undefined && recon.remainingAliquots > 0 && (
                                <button
                                  onClick={() => onDecrementAliquot(recon.id)}
                                  className="px-1.5 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 hover:text-teal-800 border border-teal-200 hover:border-teal-300 rounded-md transition-all cursor-pointer flex items-center gap-1 font-semibold text-[9px]"
                                  title="Rã đông & sử dụng 1 tuýp"
                                >
                                  <Minus className="h-2 w-2 stroke-[3px]" />
                                  <span>- 1 tuýp</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Prep & Expiry Time */}
                      <td className="px-1.5 py-2.5">
                        <div className="flex flex-col gap-1 text-[11px]">
                          <div className="text-slate-500 whitespace-nowrap">
                            <span className="inline-block w-8 font-semibold">Pha:</span> 
                            <span>{formatDateTimeVN(recon.timestamp)}</span>
                          </div>
                          <div className="text-slate-700 font-mono font-medium whitespace-nowrap">
                            <span className="inline-block w-8 font-semibold">HSD:</span>
                            <span>{formatDateTimeVN(recon.expiryTimestamp)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Stability & Status */}
                      <td className="px-1.5 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          {stabilityStatus.badge}
                          <div className={`text-[10px] font-medium mt-0.5 whitespace-nowrap ${
                            stabilityStatus.alertLevel === 'critical' ? 'text-red-600 font-bold' :
                            stabilityStatus.alertLevel === 'warning' ? 'text-amber-600 font-semibold' :
                            stabilityStatus.alertLevel === 'active' ? 'text-emerald-600' : 'text-slate-400'
                          }`}>
                            {stabilityStatus.timeString}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Edit button */}
                          <button
                            onClick={() => handleOpenEditModal(recon)}
                            className="px-2 py-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-300 rounded-md transition-all cursor-pointer font-bold flex items-center gap-1 shrink-0 shadow-3xs"
                            title="Sửa thông tin hoàn nguyên"
                          >
                            <Edit className="h-3 w-3 text-amber-600" />
                            <span>Sửa</span>
                          </button>

                          {/* Duplicate recon button */}
                          <button
                            onClick={() => handleDuplicateRecon(recon)}
                            className="px-2 py-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 hover:border-blue-300 rounded-md transition-all cursor-pointer font-bold flex items-center gap-1 shrink-0 shadow-3xs"
                            title="Pha tương tự (tạo bản ghi mới cập nhật thời gian hiện tại)"
                          >
                            <Copy className="h-3 w-3 text-blue-600" />
                            <span>Pha lại</span>
                          </button>

                          {/* Print label button */}
                          <button
                            onClick={() => openPrintModal(recon)}
                            className="px-2 py-1 text-[10px] bg-teal-50 hover:bg-teal-100 hover:text-teal-700 border border-teal-200 hover:border-teal-300 rounded-md transition-all cursor-pointer font-bold flex items-center gap-1 shrink-0 shadow-3xs"
                            title="Giao diện in tem nhãn mã vạch (2 tem/hàng)"
                          >
                            <Printer className="h-3 w-3 text-teal-600" />
                            <span>In tem</span>
                          </button>

                          {recon.status === 'Đang sử dụng' ? (
                            <>
                              {/* Mark as depleted */}
                              <button
                                onClick={() => onUpdateReconStatus(recon.id, 'Đã hết')}
                                className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-md transition-all cursor-pointer font-medium"
                                title="Đánh dấu lọ này đã dùng hết mẫu phẩm"
                              >
                                Đã hết
                              </button>

                              {/* Mark as discarded */}
                              {currentUser && (
                                <button
                                  onClick={() => onUpdateReconStatus(recon.id, 'Đã hủy')}
                                  className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-md transition-all cursor-pointer font-medium"
                                  title="Hủy bỏ lọ này do lỗi hoặc quá hạn"
                                >
                                  Hủy lọ
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Lưu trữ</span>
                          )}
 
                          {/* Delete entirely */}
                          {currentUser && (
                            <button
                              onClick={() => {
                                if (confirm('Bạn có chắc muốn xóa bản ghi hoàn nguyên này khỏi lịch sử lưu trữ?')) {
                                  onDeleteRecon(recon.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
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

      {/* ISO Quality Control Guidance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-600">
        <HelpCircle className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-700">Tiêu chí tuân thủ 2429-QĐ/BYT cho Calibrator & QC hoàn nguyên:</p>
          <ul className="text-[11px] text-slate-500 list-disc list-inside space-y-1 leading-relaxed">
            <li>Sử dụng đúng dung môi hoàn nguyên được chỉ định từ nhà sản xuất hóa chất gốc.</li>
            <li>Sau khi bơm dung môi, KHÔNG lắc mạnh. Để yên từ 15-30 phút và xoay nhẹ ống nghiệm để hòa tan hoàn toàn.</li>
            <li>Ghi nhận rõ ràng người pha, thể tích thực tế và giờ pha để tính chính xác thời gian hoạt động ổn định (Stability hours).</li>
            <li className="font-medium text-amber-800 bg-amber-50/50 px-1 rounded-sm">Khi rã đông tuýp Aliquot, chỉ rã đông đủ dùng cho ca làm việc, tuyệt đối KHÔNG cấp đông lại (re-freeze) tuýp đã rã đông. Ghi nhận chính xác số tuýp đã tiêu thụ trong ngày.</li>
          </ul>
        </div>
      </div>
      </>
    ) : (
      /* BARCODE CATALOG MANAGEMENT UI */
      <div className="space-y-4">
        {/* Catalog Control Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-teal-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Danh mục viết tắt Mã vạch</h4>
              <p className="text-[11px] text-slate-500">
                Định nghĩa sẵn các từ viết tắt và tên của Calib/QC để kết hợp tự động in mã vạch chuẩn y tế 35x22mm.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenCatalogModal()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Thêm mã viết tắt mới
          </button>
        </div>

        {/* Catalog Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[9px] tracking-wider">
                <tr>
                  <th className="px-2 py-2">Mã viết tắt (Barcode)</th>
                  <th className="px-2 py-2">Tên đầy đủ Calibrator/QC</th>
                  <th className="px-2 py-2">Khoa phòng</th>
                  <th className="px-2 py-2">Ghi chú mô tả</th>
                  <th className="px-2 py-2">Mô phỏng Barcode</th>
                  <th className="px-2 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {barcodeCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <Printer className="h-8 w-8 mx-auto mb-2 opacity-50 text-slate-300" />
                      <p className="text-xs font-bold text-slate-500">Chưa cấu hình mã viết tắt nào</p>
                      <p className="text-[10px] text-slate-400">Vui lòng nhấp nút "Thêm mã viết tắt mới" để tạo cấu hình ban đầu.</p>
                    </td>
                  </tr>
                ) : (
                  barcodeCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg font-mono text-[11px] font-bold">
                          {cat.code}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-bold text-slate-800">
                        {cat.name}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          cat.category === 'Sinh hóa' 
                            ? 'bg-teal-50 text-teal-700 border-teal-200' 
                            : cat.category === 'Huyết học' 
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {cat.category}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-500 max-w-xs truncate">
                        {cat.description || <span className="text-slate-300 italic">Không có</span>}
                      </td>
                      <td className="px-2 py-2">
                        <div className="w-32 bg-slate-50 p-1.5 border border-slate-200 rounded-lg text-center shadow-3xs scale-90 origin-left">
                          <BarcodeRenderer value={cat.code} />
                          <span className="text-[8px] font-mono font-bold text-slate-500 block mt-1">{cat.code}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openPrintCatalogModal(cat)}
                            className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-all cursor-pointer"
                            title="In nhãn decal mã vạch cho mã này"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenCatalogModal(cat)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            title="Sửa"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCatalogItem(cat.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      {/* ================= DIALOG: UNREGISTERED BARCODE WARNING (Flow 1) ================= */}
      {isUnregisteredDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-fade-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-amber-100 p-3 rounded-full shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-display mb-1">
                  Mã hóa chất chưa khai báo
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mã hóa chất <span className="font-bold text-amber-700">[{unregisteredCode}]</span> chưa được khai báo trong danh mục hệ thống. Bạn có muốn chuyển sang màn hình để khai báo mới không?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsUnregisteredDialogOpen(false);
                  setUnregisteredCode('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUnregisteredDialogOpen(false);
                  if (onNavigateToCatalogWithBarcodeCode) {
                    onNavigateToCatalogWithBarcodeCode(unregisteredCode);
                  }
                  setUnregisteredCode('');
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Khai báo mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD RECONSTITUTION ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative animate-fade-in">
            <form onSubmit={handleAddSubmit} className="flex flex-col h-full max-h-[92vh] overflow-hidden">
              
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 shrink-0">
                <h3 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                  <Layers className="h-5 w-5 text-teal-600" />
                  Ghi nhận Pha / Hoàn nguyên Mẫu chuẩn, QC
                </h3>
              </div>
              
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {toastMessage && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-xs animate-pulse">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{toastMessage}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3.5">
                
                {/* Quick Select from Catalog */}
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                      Chọn nhanh từ danh mục hoá chất vật tư
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded text-teal-600 focus:ring-teal-500 bg-teal-50 border-teal-300"
                        checked={isMultiSelectMode}
                        onChange={(e) => {
                          setIsMultiSelectMode(e.target.checked);
                          if (!e.target.checked) {
                            setSelectedReagentsList([]);
                          } else if (selectedReagent) {
                            setSelectedReagentsList([selectedReagent]);
                          }
                        }}
                      />
                      <span className="text-[10px] font-semibold text-teal-800 uppercase tracking-wider">Pha nhiều cùng lúc</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    list="reagents-datalist"
                    placeholder="-- Gõ để tìm hóa chất / Calib / QC --"
                    className="w-full px-3 py-2 text-xs bg-teal-50/50 border border-teal-200 rounded-xl focus:outline-hidden focus:border-teal-500 text-teal-900 font-medium placeholder-teal-600/50"
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      if (!selectedVal) {
                        if (!isMultiSelectMode) {
                          setSelectedReagent(null);
                          setSelectedReagentImageUrl('');
                        }
                        return;
                      }
                      
                      const reagent = reagents.find(r => 
                        `[${r.category}] ${r.name} ${r.lotNumber ? `(Lô: ${r.lotNumber})` : ''}` === selectedVal
                      );
                      
                      if (reagent) {
                        if (isMultiSelectMode) {
                          if (!selectedReagentsList.find(r => r.id === reagent.id)) {
                            setSelectedReagentsList([...selectedReagentsList, reagent]);
                          }
                          e.target.value = ''; // clear input
                        } else {
                          setSelectedReagent(reagent);
                          
                          // Intelligent barcode category auto-detection
                          let detectedBarcodeCode = reagent.barcodeCategoryCode || '';
                          if (!detectedBarcodeCode && barcodeCategories && barcodeCategories.length > 0) {
                            const matchedBc = barcodeCategories.find(bc => 
                              reagent.name.toLowerCase().includes(bc.name.toLowerCase()) ||
                              reagent.name.toLowerCase().includes(bc.code.toLowerCase()) ||
                              bc.name.toLowerCase().includes(reagent.name.toLowerCase())
                            );
                            if (matchedBc) {
                              detectedBarcodeCode = matchedBc.code;
                            }
                          }

                          setFormData(prev => ({
                            ...prev,
                            targetItemName: reagent.name,
                            category: reagent.category,
                            sourceLot: reagent.lotNumber || '',
                            stabilityDays: reagent.inUseStabilityDays ? reagent.inUseStabilityDays : prev.stabilityDays,
                            barcodeCategoryCode: detectedBarcodeCode,
                          }));
                          setSelectedReagentImageUrl(reagent.specTableImageUrl || '');
                          setHighlightedFields({});
                        }
                      }
                    }}
                  />
                  <datalist id="reagents-datalist">
                    {reagents.filter(r => r.reconstitutionRequired).map(r => (
                      <option key={r.id} value={`[${r.category}] ${r.name} ${r.lotNumber ? `(Lô: ${r.lotNumber})` : ''}`} />
                    ))}
                  </datalist>

                  {/* DISPLAY MULTI-SELECT LIST */}
                  {isMultiSelectMode && selectedReagentsList.length > 0 && (
                    <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-2 max-h-32 overflow-y-auto space-y-1">
                      {selectedReagentsList.map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-slate-100 shadow-2xs">
                          <span className="text-[11px] font-medium text-slate-700 truncate pr-2">
                            [{r.category}] {r.name} {r.lotNumber ? `(Lô: ${r.lotNumber})` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedReagentsList(selectedReagentsList.filter(item => item.id !== r.id))}
                            className="text-slate-400 hover:text-red-500 p-0.5 shrink-0"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DISPLAY TESTS & IMAGES OF SELECTED REAGENT (Single Mode Only) */}
                  {!isMultiSelectMode && selectedReagentImageUrl && (
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 space-y-2">
                      <div className="mt-1 pt-1">
                        <span className="block text-[10px] font-bold text-teal-700/80 mb-1">
                          📸 Bảng thông số nhà sản xuất:
                        </span>
                        <div className="max-w-xs h-32 rounded-lg overflow-hidden border border-teal-200 bg-white p-1">
                          <img 
                            src={selectedReagentImageUrl} 
                            alt="Manufacturer's Spec Table" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                      
                      {selectedReagent?.attachmentUrl && (
                        <div className="mt-2 pt-2 border-t border-teal-200/50 flex items-center justify-between gap-2 flex-wrap">
                          <span className="block text-[10px] font-bold text-teal-700/80 flex items-center gap-1">
                            <Paperclip className="h-3 w-3" /> Tài liệu kỹ thuật đi kèm:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDocViewerReagent(selectedReagent);
                              setIsDocViewerOpen(true);
                            }}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Xem tài liệu</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isMultiSelectMode && (
                  <>
                    {/* Select from Barcode Category shortcuts */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
                        Mã liên kết Barcode (Mã viết tắt QC/Calib)
                      </label>
                      <select
                        value={formData.barcodeCategoryCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const matched = barcodeCategories.find(bc => bc.code === code);
                          setFormData(prev => ({
                            ...prev,
                            barcodeCategoryCode: code,
                            targetItemName: matched ? matched.name : prev.targetItemName,
                            category: matched ? matched.category : prev.category,
                          }));
                          if (matched) {
                            setHighlightedFields(prev => ({ ...prev, targetItemName: false }));
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-teal-50/50 border border-teal-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer font-medium text-teal-900"
                      >
                        <option value="">-- Chọn mã viết tắt Barcode (ví dụ QCSH2, QCHH1) --</option>
                        {barcodeCategories.map(cat => (
                          <option key={cat.id} value={cat.code}>
                            {cat.code} - {cat.name} ({cat.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Name */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên mẫu calibrator / QC / hóa chất cần hoàn nguyên *</label>
                      <input
                        type="text"
                        required={!isMultiSelectMode}
                        value={formData.targetItemName}
                        onChange={(e) => {
                          setFormData({...formData, targetItemName: e.target.value});
                          setHighlightedFields(prev => ({ ...prev, targetItemName: false }));
                        }}
                        placeholder="Ví dụ: Lyphochek QC Level 1; Multical Calibrator"
                        className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                          highlightedFields.targetItemName 
                            ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                            : 'border-slate-200 focus:border-teal-500'
                        }`}
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Khoa phòng *</label>
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

                    {/* Source Lot */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số lô của hộp gốc (LOT) *</label>
                      <input
                        type="text"
                        required={!isMultiSelectMode}
                        value={formData.sourceLot}
                        onChange={(e) => {
                          setFormData({...formData, sourceLot: e.target.value});
                          setHighlightedFields(prev => ({ ...prev, sourceLot: false }));
                        }}
                        placeholder="Ví dụ: LOT-QC-445"
                        className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                          highlightedFields.sourceLot 
                            ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                            : 'border-slate-200 focus:border-teal-500'
                        }`}
                      />
                    </div>
                  </>
                )}

                {/* Volume */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Thể tích dung môi pha *</label>
                  <input
                    type="text"
                    required
                    value={formData.volume}
                    onChange={(e) => {
                      setFormData({...formData, volume: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, volume: false }));
                    }}
                    placeholder="Ví dụ: 3.0 mL; 5.0 mL"
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.volume 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                {/* Solvent */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dung môi sử dụng *</label>
                  <input
                    type="text"
                    required
                    value={formData.solvent}
                    onChange={(e) => setFormData({...formData, solvent: e.target.value})}
                    placeholder="Ví dụ: Nước cất 2 lần, Lyphochek Solvent"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Source Bottles Count */}
                <div>
                  <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1" title="Số lượng chai hóa chất/vật tư gốc lấy từ kho">Số lượng chai gốc xuất ra *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.sourceBottlesCount}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setFormData({...formData, sourceBottlesCount: count, aliquotsCount: count * formData.aliquotsPerBottle});
                    }}
                    placeholder="Ví dụ: 2"
                    className="w-full px-3 py-2 text-xs bg-teal-50 border border-teal-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white font-mono text-teal-900 font-bold"
                  />
                </div>

                {/* Aliquots Per Bottle */}
                <div>
                  <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">Số tuýp chia rã đông / 1 chai *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.aliquotsPerBottle}
                    onChange={(e) => {
                      const perBottle = parseInt(e.target.value) || 0;
                      setFormData({...formData, aliquotsPerBottle: perBottle, aliquotsCount: formData.sourceBottlesCount * perBottle});
                      setHighlightedFields(prev => ({ ...prev, aliquotsCount: false }));
                    }}
                    placeholder="Ví dụ: 5"
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white font-mono transition-all ${
                      highlightedFields.aliquotsCount 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>
                
                {/* Total Aliquots Count (Read-only) */}
                <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Tổng số tuýp tạo thành:</span>
                  <span className="text-sm font-bold text-teal-600 font-mono">
                    {formData.sourceBottlesCount * formData.aliquotsPerBottle} tuýp
                  </span>
                </div>

                {/* Aliquot Volume */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Thể tích mỗi tuýp *</label>
                  <input
                    type="text"
                    required
                    value={formData.aliquotVolume}
                    onChange={(e) => {
                      setFormData({...formData, aliquotVolume: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, aliquotVolume: false }));
                    }}
                    placeholder="Ví dụ: 0.5 mL"
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white font-mono transition-all ${
                      highlightedFields.aliquotVolume 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                {/* Prepared By */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nhân viên y tế pha chế *</label>
                  <input
                    type="text"
                    required
                    value={formData.preparedBy}
                    onChange={(e) => setFormData({...formData, preparedBy: e.target.value})}
                    placeholder="Tên nhân viên"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Stability Days */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Độ ổn định tối đa (ngày) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.stabilityDays}
                    onChange={(e) => setFormData({...formData, stabilityDays: parseInt(e.target.value) || 28})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white font-mono"
                  />
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ghi chú điều kiện bảo quản sau pha</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => {
                      setFormData({...formData, notes: e.target.value});
                      setHighlightedFields(prev => ({ ...prev, notes: false }));
                    }}
                    rows={2}
                    placeholder="Ví dụ: Bảo quản tránh ánh sáng ở tủ lạnh 2-8°C. Không lắc mạnh..."
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-hidden focus:bg-white transition-all ${
                      highlightedFields.notes 
                        ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-100 focus:border-amber-500' 
                        : 'border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                </div>

              </div>

              {/* Modal Actions Footer */}
              <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/50">
                <div className="flex items-center gap-1 text-[11px] text-teal-600 font-semibold bg-teal-50 px-2 py-1 rounded-lg border border-teal-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                  Gemini Flash: Miễn phí & Không giới hạn lượt quét
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                      setSelectedReagent(null);
                    }}
                    className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-sm"
                  >
                    Xác nhận pha mẫu
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DOCUMENT VIEWER ================= */}
      {isDocViewerOpen && docViewerReagent && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full h-[90vh] shadow-2xl p-6 flex flex-col relative animate-fade-in">
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

            <div className="flex-1 min-h-0 bg-slate-50 rounded-2xl border border-slate-200 p-2 flex flex-col relative overflow-hidden">
              {docViewerReagent.attachmentUrl ? (
                docViewerReagent.attachmentType === 'pdf' ? (
                  activePdfBlobUrl ? (
                    <div className="flex-1 flex flex-col h-full">
                      <div className="bg-amber-50 border-b border-amber-100 px-3 py-1.5 flex items-center gap-2 shrink-0 rounded-t-xl">
                        <span className="text-xs">📱</span>
                        <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                          <strong>Lưu ý di động & Chrome:</strong> Nếu tài liệu bị trống hoặc bị chặn, vui lòng nhấn nút <span className="font-bold text-teal-700">"Mở cửa sổ mới"</span> ở góc trên bên phải hoặc mở ứng dụng trong Tab trình duyệt riêng biệt.
                        </p>
                      </div>
                      <iframe
                        src={activePdfBlobUrl}
                        title={docViewerReagent.attachmentName || 'Tài liệu kỹ thuật'}
                        className="w-full h-full rounded-b-xl border-none flex-1"
                      />
                    </div>
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

      {/* ================= MODAL: BARCODE CATALOG EDIT/ADD ================= */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-fade-in">
            <h3 className="text-sm font-bold text-slate-800 font-display mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-teal-600" />
              {editingCategory ? 'Cập nhật mã viết tắt' : 'Đăng ký mã viết tắt mới'}
            </h3>

            <form onSubmit={handleCatalogSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mã viết tắt (Barcode ID) *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingCategory}
                  value={catalogFormData.code}
                  onChange={(e) => setCatalogFormData({...catalogFormData, code: e.target.value})}
                  placeholder="Ví dụ: QCSH2, QCHH1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-mono uppercase font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Mã định danh duy nhất in trên tem (không khoảng trắng, không dấu).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên đầy đủ của QC / Calibrator *</label>
                <input
                  type="text"
                  required
                  value={catalogFormData.name}
                  onChange={(e) => setCatalogFormData({...catalogFormData, name: e.target.value})}
                  placeholder="Ví dụ: QC Sinh hóa Level 2"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phòng Lab / Khoa phòng *</label>
                <select
                  value={catalogFormData.category}
                  onChange={(e) => setCatalogFormData({...catalogFormData, category: e.target.value as LabCategory})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                >
                  <option value="Sinh hóa">Sinh hóa</option>
                  <option value="Huyết học">Huyết học</option>
                  <option value="Miễn dịch">Miễn dịch</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ghi chú mô tả thêm</label>
                <textarea
                  value={catalogFormData.description}
                  onChange={(e) => setCatalogFormData({...catalogFormData, description: e.target.value})}
                  rows={2}
                  placeholder="Nhập ghi chú hoặc mô tả về nồng độ, hãng sản xuất..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCatalogModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-sm"
                >
                  Lưu danh mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINT BARCODE LABELS (TSC TL 240 EXCLUSIVE) ================= */}
      {isPrintModalOpen && (selectedReconForPrint || selectedBarcodeCategory) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-fade-in flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 text-lg font-bold">
                  🖨️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                    In Tem Nhãn Mã Vạch - Máy in TSC TL 240
                    <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                      Khổ chuẩn 50x20 mm
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tự động tạo mã vạch Code 128 vector căn giữa tuyệt đối, không nhòe, hỗ trợ in trình duyệt & BarTender.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPrintModalOpen(false);
                  setSelectedReconForPrint(null);
                  setSelectedBarcodeCategory(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Layout Split */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 overflow-y-auto min-h-0 pr-1">
              
              {/* Left Settings Panel */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>Cấu hình in tem</span>
                    <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">TSC TL 240</span>
                  </h4>

                  {/* Template selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mã QC viết tắt *</label>
                    <select
                      value={selectedBarcodeCategory?.id || ''}
                      onChange={(e) => {
                        const matched = barcodeCategories.find(bc => bc.id === e.target.value);
                        if (matched) setSelectedBarcodeCategory(matched);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer font-medium"
                    >
                      <option value="">-- Chọn từ danh mục mã --</option>
                      {barcodeCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.code} - {cat.name}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1">
                      KTV chọn đúng tên mã QC trong menu thả xuống để hệ thống kết hợp in tự động Barcode.
                    </p>
                  </div>

                  {/* Kích thước & Khổ giấy in nhãn */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Khổ giấy decal của máy *</label>
                    <select
                      value={printConfig.labelSize}
                      onChange={(e) => setPrintConfig({...printConfig, labelSize: e.target.value as '50x20' | '50x20_double'})}
                      className="w-full px-3 py-2 text-xs bg-teal-50/50 border border-teal-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer font-bold text-teal-900"
                    >
                      <option value="50x20">1 tem/hàng · 50x20 mm (5x2 cm) [Chuẩn máy TSC TL 240]</option>
                      <option value="50x20_double">2 tem/hàng song song · 50x20 mm (10x2 cm)</option>
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1">
                      Kích thước chuẩn cho cuộn decal nhiệt máy TSC TL 240.
                    </p>
                  </div>

                  {/* Chiều in Barcode / Hướng mã vạch */}
                  <div className="p-3 bg-white border border-teal-200 rounded-xl space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-teal-600">🔄</span> Chiều in Barcode *
                      </label>
                      <button
                        type="button"
                        onClick={() => setPrintConfig(prev => ({
                          ...prev,
                          barcodeOrientation: prev.barcodeOrientation === 'horizontal' ? 'vertical' : 'horizontal'
                        }))}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Bấm để đổi ngay chiều in Barcode giữa Ngang và Dọc"
                      >
                        <span>🔄 Đổi chiều:</span>
                        <span className="font-extrabold text-teal-950 underline">
                          {printConfig.barcodeOrientation === 'horizontal' ? 'Ngang ➔ Dọc' : 'Dọc ➔ Ngang'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPrintConfig({ ...printConfig, barcodeOrientation: 'horizontal' })}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center gap-2 ${
                          printConfig.barcodeOrientation === 'horizontal'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-lg font-mono leading-none">═</span>
                        <div>
                          <div className="leading-tight flex items-center gap-1">
                            Ngang 0°
                            <span className="text-[8px] px-1 py-0.2 rounded-sm bg-teal-100 text-teal-900 font-extrabold">Chuẩn</span>
                          </div>
                          <div className={`text-[8.5px] font-normal ${printConfig.barcodeOrientation === 'horizontal' ? 'text-teal-100' : 'text-slate-400'}`}>Dán ngang mặt hộp / tuýp</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrintConfig({ ...printConfig, barcodeOrientation: 'vertical' })}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center gap-2 ${
                          printConfig.barcodeOrientation === 'vertical'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-lg font-mono leading-none">║</span>
                        <div>
                          <div className="leading-tight">Dọc 90°</div>
                          <div className={`text-[8.5px] font-normal ${printConfig.barcodeOrientation === 'vertical' ? 'text-teal-100' : 'text-slate-400'}`}>Dán dọc thân tuýp</div>
                        </div>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setPrintConfig({ ...printConfig, barcodeOrientation: 'vertical270' })}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer text-center ${
                          printConfig.barcodeOrientation === 'vertical270'
                            ? 'bg-teal-100 border-teal-500 text-teal-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        🔁 Dọc ngược 270°
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintConfig({ ...printConfig, barcodeOrientation: 'rotate180' })}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer text-center ${
                          printConfig.barcodeOrientation === 'rotate180'
                            ? 'bg-teal-100 border-teal-500 text-teal-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        🔃 Ngang đảo 180°
                      </button>
                    </div>
                  </div>

                  {/* Form tem chuẩn cố định */}
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏷️</span>
                      <div>
                        <div className="text-xs font-bold text-emerald-950">Form in chuẩn cố định</div>
                        <div className="text-[10px] text-emerald-700">Khổ 50 x 20 mm (Máy TSC TL 240)</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                      ✓ Đứng form 100%
                    </span>
                  </div>

                  {/* Label count */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số lượng tem cần in</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={printConfig.customCount}
                      onChange={(e) => setPrintConfig({...printConfig, customCount: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-mono font-bold"
                    />
                    <p className="text-[9px] text-slate-400 mt-1">
                      {selectedReconForPrint 
                        ? `Mặc định khớp với số tuýp còn lại (${selectedReconForPrint.remainingAliquots} tuýp).` 
                        : 'Mặc định in 1 tem nhãn decal.'}
                    </p>
                  </div>

                  {/* Lot suffix toggle */}
                  {selectedReconForPrint && (
                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="toggle-print-lot"
                        checked={printConfig.includeLot}
                        onChange={(e) => setPrintConfig({...printConfig, includeLot: e.target.checked})}
                        className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="toggle-print-lot" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                        Ghép kèm Số lô của hộp gốc ({selectedReconForPrint.lotNumber})
                      </label>
                    </div>
                  )}

                  {/* Tube index toggle */}
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="toggle-print-index"
                      checked={printConfig.includeIndex}
                      onChange={(e) => setPrintConfig({...printConfig, includeIndex: e.target.checked})}
                      className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="toggle-print-index" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      Đánh số thứ tự tuýp tự động (01, 02, 03...)
                    </label>
                  </div>

                  {/* Hospital header toggle */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="toggle-print-hospital"
                        checked={printConfig.includeHospital}
                        onChange={(e) => setPrintConfig({...printConfig, includeHospital: e.target.checked})}
                        className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="toggle-print-hospital" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        Hiện tên đơn vị / Bệnh viện
                      </label>
                    </div>
                    {printConfig.includeHospital && (
                      <input
                        type="text"
                        value={printConfig.hospitalName}
                        onChange={(e) => setPrintConfig({...printConfig, hospitalName: e.target.value})}
                        placeholder="Nhập tên đơn vị / BV..."
                        className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-medium"
                      />
                    )}
                  </div>

                  {/* Barcode height selection for 2x5cm */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Độ cao mã vạch (Tem 2x5cm)
                      </label>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                        {printConfig.barcodeHeight === 8.5 ? '8.5 mm' : '7.5 mm (Khuyên dùng)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPrintConfig({...printConfig, barcodeHeight: 7.5})}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                          (printConfig.barcodeHeight || 7.5) === 7.5
                            ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div>Chuẩn 7.5 mm</div>
                        <div className="text-[9px] font-normal text-slate-500">Cân đối đẹp nhất</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintConfig({...printConfig, barcodeHeight: 8.5})}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                          printConfig.barcodeHeight === 8.5
                            ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div>Lớn 8.5 mm</div>
                        <div className="text-[9px] font-normal text-slate-500">Mã vạch cao hơn</div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2x5cm Sizing & Troubleshooting banner */}
                <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-2xl shadow-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                    <span>⚠️</span>
                    <span>Khắc phục lỗi in bị khoảng trống dài ở dưới (như giấy A4):</span>
                  </div>
                  <div className="text-[11px] text-amber-900 leading-relaxed space-y-1">
                    <p>Khi hộp thoại in của trình duyệt (Ctrl+P) hiện lên, cần lưu ý 2 cài đặt:</p>
                    <div className="bg-white/80 p-2 rounded-lg border border-amber-200 text-[10.5px] space-y-1 font-medium">
                      <div>1. <strong>Máy in (Destination):</strong> Phải chọn đúng máy in <strong>TSC TL 240</strong> (hoặc tên máy in mã vạch).</div>
                      <div>2. <strong>Khổ giấy (Paper size):</strong> Bấm <em>Cài đặt khác (More settings)</em> ➔ <strong>Khổ giấy</strong> ➔ Chọn đúng <strong>50 x 20 mm</strong> (hoặc USER / 2.00x0.79 in). <em>Nếu để A4 thì máy sẽ nhả giấy trống cả đoạn dài!</em></div>
                      <div>3. <strong>Lề (Margins):</strong> Chọn <strong>Không có (None)</strong> · <strong>Tỷ lệ (Scale):</strong> 100%.</div>
                    </div>
                  </div>
                </div>

                {/* Hardware & Calibration helper box */}
                <div className="bg-blue-50 border-2 border-blue-300 p-3 rounded-2xl shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">⚙️</span>
                      <div>
                        <h4 className="text-xs font-bold text-blue-950">
                          Mẹo căn giữa 100% trên máy TSC TL 240:
                        </h4>
                        <p className="text-[11px] text-blue-800 leading-relaxed mt-0.5">
                          1. Gạt <strong>2 thanh kẹp màu xanh</strong> ép sát 2 bên mép cuộn tem.<br/>
                          2. Nhấn giữ nút <strong>FEED</strong> để máy tự Calibrate khoảng cách tem (Gap).
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTSCGuideOpen(true)}
                    className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>🛠️ Xem 4 bước cân chỉnh chi tiết máy TSC TL 240</span>
                  </button>
                </div>

                {/* BarTender / TSPL export box */}
                <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/90 border border-indigo-200 p-3 rounded-2xl shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🏷️</span>
                      <h4 className="text-xs font-bold text-indigo-950">
                        Xuất dữ liệu cho BarTender Enterprise
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBarTenderGuideOpen(true)}
                      className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                    >
                      📖 Hướng dẫn
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={handleExportBarTenderCSV}
                      className="p-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-2xs cursor-pointer"
                    >
                      <span>📊 Xuất CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportBarTenderXML}
                      className="p-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-2xs cursor-pointer"
                    >
                      <span>⚡ BTXML</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportTSPL}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-2xs cursor-pointer"
                      title="Tải mã lệnh TSPL (.tspl / .prn) căn giữa chuẩn cho máy in TSC TL 240"
                    >
                      <span>🖨️ Lệnh TSPL</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Live Preview Panel */}
              <div className="lg:col-span-3 bg-slate-100 border border-slate-200 rounded-2xl p-4 flex flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3 shrink-0 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      📺 Xem trước tem in thực tế (TSC TL 240 · 50x20mm)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrintConfig(prev => ({
                        ...prev,
                        barcodeOrientation: prev.barcodeOrientation === 'horizontal' ? 'vertical' : 'horizontal'
                      }))}
                      className="px-2.5 py-1 text-[10px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Chuyển đổi tức thì giữa in mã vạch Ngang 0° và Dọc 90°"
                    >
                      <span>🔄 Đổi chiều Barcode:</span>
                      <span className="font-extrabold text-teal-950 underline">
                        {printConfig.barcodeOrientation === 'horizontal' ? 'Ngang ➔ Dọc' : 'Dọc ➔ Ngang'}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full text-emerald-800 bg-emerald-50 border border-emerald-200">
                      ✓ Đứng form 50x20mm
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {printConfig.labelSize === '50x20' ? '1 tem / hàng' : '2 tem / hàng song song'}
                    </span>
                  </div>
                </div>

                {/* decall strip scroll list */}
                <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-200 rounded-xl min-h-[300px] flex flex-col justify-start">
                  {(() => {
                    const labelCount = printConfig.customCount || selectedReconForPrint?.remainingAliquots || selectedReconForPrint?.aliquotsCount || 1;
                    const labels = [];
                    for (let i = 1; i <= labelCount; i++) {
                      const tubeIndex = String(i).padStart(2, '0');
                      let barcodeValue = selectedBarcodeCategory?.code || 'QC';
                      if (printConfig.includeLot && selectedReconForPrint?.lotNumber) {
                        barcodeValue += `-${selectedReconForPrint.lotNumber}`;
                      }
                      if (printConfig.includeIndex) {
                        barcodeValue += `-${tubeIndex}`;
                      }
                      
                      labels.push({
                        index: tubeIndex,
                        barcodeValue,
                        displayName: selectedBarcodeCategory?.name || selectedReconForPrint?.targetItemName || '',
                        lot: selectedReconForPrint?.lotNumber || '',
                        expiry: selectedReconForPrint ? formatDateVN(selectedReconForPrint.expiryTimestamp) : '',
                        preparedBy: selectedReconForPrint?.preparedBy || '',
                      });
                    }

                    const labelRows = [];
                    const itemsPerRow = printConfig.labelSize === '50x20' ? 1 : 2;
                    for (let i = 0; i < labels.length; i += itemsPerRow) {
                      if (itemsPerRow === 1) {
                        labelRows.push([labels[i]]);
                      } else {
                        labelRows.push([labels[i], labels[i + 1]]);
                      }
                    }

                    if (labelRows.length === 0) {
                      return (
                        <div className="text-center p-8 text-slate-400 my-auto">
                          Chọn cấu hình in nhãn để tạo dải nhãn xem trước.
                        </div>
                      );
                    }

                    const isVertical = printConfig.barcodeOrientation === 'vertical' || printConfig.barcodeOrientation === 'vertical270';
                    const isRot180 = printConfig.barcodeOrientation === 'rotate180';
                    const rotClass = printConfig.barcodeOrientation === 'vertical270' ? '-rotate-90' : 'rotate-90';

                    const renderLabelCard = (item: typeof labels[0]) => {
                      if (isVertical) {
                        return (
                          <div className="label-preview-item-50x20 relative !flex !flex-row !justify-between !items-stretch !p-[1mm_1.5mm] !text-left shadow-xs">
                            {/* Left Column: Barcode Vertical */}
                            <div className="w-[18mm] h-[18.2mm] flex flex-col items-center justify-center shrink-0 overflow-hidden bg-slate-50 rounded-xs">
                              <div className={`flex flex-col items-center justify-center w-[16mm] h-[16mm] ${rotClass}`}>
                                <BarcodeRenderer 
                                  value={item.barcodeValue} 
                                  heightMm={6.0}
                                  isVertical={true}
                                />
                                <div className="text-[7px] font-mono font-black text-slate-950 tracking-wider text-center mt-0.5 leading-none">
                                  {item.barcodeValue}
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Info */}
                            <div className="flex-1 h-[18.2mm] flex flex-col justify-between pl-1.5 border-l border-dashed border-slate-300 min-w-0">
                              {printConfig.includeHospital && printConfig.hospitalName && (
                                <div className="text-[6px] font-bold text-slate-600 uppercase tracking-tight truncate leading-none">
                                  {printConfig.hospitalName}
                                </div>
                              )}
                              <div className="font-black text-slate-950 text-[8.5px] leading-tight line-clamp-2">
                                {item.displayName}
                              </div>
                              <div className="text-[7px] font-bold text-slate-700 leading-tight">
                                <div>LOT: {item.lot || '---'}</div>
                                <div>HSD: {item.expiry}</div>
                              </div>
                              {item.index ? (
                                <div className="text-[7.5px] font-black text-teal-700 text-right leading-none">
                                  Tuýp #{item.index}
                                </div>
                              ) : (
                                <div className="text-[6.5px] font-semibold text-slate-400 text-right leading-none">
                                  50x20mm
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className={`label-preview-item-50x20 relative ${isRot180 ? 'rotate-180' : ''} shadow-xs`}>
                          {printConfig.includeHospital && printConfig.hospitalName && (
                            <div className="text-[6.5px] font-bold text-slate-700 uppercase tracking-wider text-center truncate w-full leading-none mb-0.5">
                              {printConfig.hospitalName}
                            </div>
                          )}
                          <div className={`font-black text-slate-950 text-center truncate w-full leading-tight ${printConfig.includeHospital ? 'text-[8.5px]' : 'text-[10px]'}`}>
                            {item.displayName}
                          </div>
                          <div className="flex-1 flex flex-col justify-center items-center w-full text-center my-0.5">
                            <BarcodeRenderer 
                              value={item.barcodeValue} 
                              heightMm={printConfig.includeHospital ? 7.0 : (printConfig.barcodeHeight || 8.0)}
                              isVertical={false}
                            />
                          </div>
                          <div className="text-[8.5px] font-mono font-black text-center text-slate-950 tracking-wider w-full leading-none">
                            {item.barcodeValue}
                          </div>
                          <div className="flex items-center justify-between text-[7.2px] font-bold text-slate-900 border-t border-slate-900 pt-0.5 mt-0.5 w-full leading-none">
                            <span className="truncate max-w-[20mm]">LOT: {item.lot || '---'}</span>
                            <span>HSD: {item.expiry}</span>
                            {item.index && <span>#{item.index}</span>}
                          </div>
                        </div>
                      );
                    };

                    return labelRows.map((row, rIndex) => (
                      <div key={rIndex} className="flex gap-4 justify-center items-center">
                        {/* Label 1 Preview */}
                        {row[0] && renderLabelCard(row[0])}

                        {/* Label 2 Preview */}
                        {itemsPerRow === 2 && (
                          row[1] ? renderLabelCard(row[1]) : (
                            <div 
                              className="border-2 border-dashed border-slate-300 rounded-md flex items-center justify-center text-[10px] text-slate-400 italic bg-white/50"
                              style={{ width: '50mm', height: '20mm' }}
                            >
                              Trống (Lẻ hàng)
                            </div>
                          )
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>

            </div>

            {/* Print Dialog Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportBarTenderCSV}
                  className="px-3.5 py-2 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer font-bold border border-indigo-200 flex items-center gap-1.5 shadow-2xs"
                  title="Tải file CSV chứa toàn bộ thông tin lô tem để nhập vào BarTender in"
                >
                  <span>📊 Xuất CSV BarTender</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportTSPL}
                  className="px-3.5 py-2 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer font-bold border border-blue-200 flex items-center gap-1.5 shadow-2xs"
                  title="Tải file lệnh TSPL (.prn / .tspl) chuẩn phần cứng TSC TL 240"
                >
                  <span>⚡ Tải mã TSPL (.tspl)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTSCGuideOpen(true)}
                  className="px-3 py-2 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer font-bold border border-slate-200 flex items-center gap-1"
                >
                  <span>🛠️ Căn lề máy in</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPrintHtml}
                  className="px-3.5 py-2 text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-all cursor-pointer font-bold border border-teal-200 flex items-center gap-1.5 shadow-2xs"
                  title="Tải file HTML chuẩn khổ 50x20mm để mở trực tiếp trên trình duyệt hoặc in độc lập"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải file in (HTML)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    setSelectedReconForPrint(null);
                    setSelectedBarcodeCategory(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handlePrintAction}
                  className="px-6 py-2.5 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-md hover:shadow-lg flex items-center gap-2 text-sm"
                >
                  <Printer className="h-4 w-4" /> BẮT ĐẦU IN (MÁY TSC TL 240)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= TSC TL 240 / TE240 GUIDE MODAL ================= */}
      {isTSCGuideOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 text-lg font-bold">
                  🖨️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Hướng dẫn căn giữa Barcode cho máy in TSC TL 240 / TE240
                  </h3>
                  <p className="text-xs text-slate-500">
                    Căn 2 thanh kẹp cuộn giấy, Calibrate cảm biến Gap và căn giữa trên BarTender Designer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTSCGuideOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="overflow-y-auto flex-1 py-4 space-y-4 pr-1 text-slate-700 text-xs">
              
              {/* Highlight summary */}
              <div className="bg-blue-50 border-l-4 border-blue-600 p-3 rounded-r-xl">
                <p className="font-bold text-blue-950">
                  📌 Tại sao tem in ra máy TSC TL 240 bị lệch lề hoặc mã vạch không nằm ngay giữa?
                </p>
                <p className="text-blue-900 mt-1 leading-relaxed">
                  Máy in <strong>TSC TL 240 / TE240</strong> sử dụng cơ chế kéo cuộn giấy định tâm (Center-aligned). 3 nguyên nhân chính khiến mã vạch không nằm ở giữa:
                  <strong> (1)</strong> Hai thanh kẹp màu xanh giữ cuộn decal chưa được ép sát cuộn tem; 
                  <strong> (2)</strong> Cảm biến Gap chưa được Calibrate khiến máy nhảy bước tem; 
                  <strong> (3)</strong> Đối tượng Barcode trong BarTender Designer chưa được chọn "Center in Form".
                </p>
              </div>

              {/* Step 1 */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Phần cứng: Căn chỉnh 2 thanh kẹp màu xanh ép sát cuộn giấy
                  </h4>
                </div>
                <div className="pl-8 space-y-1.5 leading-relaxed text-slate-600">
                  <p>Đây là <strong>bước quyết định vị trí vật lý</strong> của con tem:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Mở nắp máy in TSC TL 240.</li>
                    <li>Lắp cuộn tem 50x20mm vào trục giữa.</li>
                    <li>Dùng tay <strong>gạt 2 thanh kẹp màu xanh lục (Green Media Guides)</strong> ép sát vào hai bên mép của cuộn decal (vừa khít, không bóp quá chặt để cuộn giấy xoay êm).</li>
                    <li>Điều này đảm bảo khi máy kéo giấy ra, cuộn tem luôn chạy chính xác 100% tại tâm giữa của đầu in nhiệt, không bị trượt sang trái hoặc phải.</li>
                  </ul>
                </div>
              </div>

              {/* Step 2 */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Tự động Calibrate Cảm biến Gap trên máy TSC TL 240 (Chống nhảy tem)
                  </h4>
                </div>
                <div className="pl-8 space-y-1.5 leading-relaxed text-slate-600">
                  <p>Mỗi khi đổi sang máy mới hoặc cuộn tem mới, hãy thực hiện thao tác Calibrate cảm biến khe hở tem (Gap):</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li><strong>Tắt công tắc nguồn</strong> phía sau máy in TSC TL 240.</li>
                    <li>Nhấn giữ nút tròn <strong>FEED</strong> ở mặt trước máy, đồng thời <strong>bật công tắc nguồn</strong>.</li>
                    <li>Đèn LED trên máy sẽ nháy theo chu kỳ: <em>Đỏ (5 lần) $\rightarrow$ Cam (5 lần) $\rightarrow$ Xanh (5 lần)</em>.</li>
                    <li><strong>Nhả nút FEED ngay khi đèn nhấp nháy màu ĐỎ</strong> (chế độ Gap/Black Mark Sensor Calibration).</li>
                    <li>Máy TSC TL 240 sẽ tự động đẩy ra 2-3 con tem để nhận diện chính xác khoảng cách khe hở giữa các con tem (2mm) và lưu vào bộ nhớ.</li>
                  </ol>
                </div>
              </div>

              {/* Step 3 */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Căn giữa Barcode trong BarTender Designer (Nếu in qua BarTender)
                  </h4>
                </div>
                <div className="pl-8 space-y-1.5 leading-relaxed text-slate-600">
                  <p>Trong phần mềm BarTender Designer:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Nhấp chuột chọn đối tượng mã vạch <strong>Barcode</strong>.</li>
                    <li>Trên thanh menu trên cùng: Chọn <strong>Arrange (Sắp xếp) &gt; Align (Căn chỉnh) &gt; Center in Form (Căn giữa khổ tem)</strong>.</li>
                    <li>Hoặc nhấp đúp vào Barcode $\rightarrow$ tại cây bên trái chọn <strong>Position (Vị trí)</strong> $\rightarrow$ mục <em>Object Alignment</em>: chuyển sang <strong>Center</strong>.</li>
                    <li>Làm tương tự với dòng Tên hóa chất và Số lô. Khi đó dù mã dài hay ngắn, BarTender luôn tự động căn giữa cân đối tuyệt đối!</li>
                  </ul>
                </div>
              </div>

              {/* Step 4 */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">4</span>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Cấu hình Driver TSC TL 240 trong Windows
                  </h4>
                </div>
                <div className="pl-8 space-y-1.5 leading-relaxed text-slate-600">
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Vào <em>Windows Settings &gt; Bluetooth &amp; devices &gt; Printers &amp; scanners &gt; TSC TL 240 &gt; Printing Preferences</em>.</li>
                    <li>Tab <strong>Page Setup</strong>: Chọn hoặc bấm <em>New...</em> tạo khổ tem: <strong>Width: 50.0mm</strong>, <strong>Height: 20.0mm</strong>, <strong>Gap: 2.0mm</strong>.</li>
                    <li>Tab <strong>Graphics</strong>: Chọn <em>Dithering: None</em> (giúp mã vạch đen tuyền 100%, không bị chấm hạt).</li>
                    <li>Tab <strong>Options</strong>: Darkness đặt <strong>10 - 12</strong>, Speed đặt <strong>2.0 in/s hoặc 3.0 in/s</strong>.</li>
                  </ul>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsTSCGuideOpen(false)}
                className="px-5 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 font-bold rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
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
                    Hướng dẫn in tem qua BarTender Enterprise / Designer
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kết nối file CSV hoặc Automation Script cho máy in Zebra ZD421 không bao giờ bị lệch chiều
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
            <div className="overflow-y-auto py-4 space-y-4 text-xs text-slate-700 pr-1 flex-1">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-start gap-2.5">
                <span className="text-base mt-0.5">💡</span>
                <div className="leading-relaxed text-indigo-900">
                  <strong>Tại sao nên in qua BarTender?</strong><br />
                  BarTender giao tiếp trực tiếp với Driver Seagull gốc của Zebra ZD421. Nó tự động khóa đúng chiều ngang của nhãn 50x20mm, mã vạch Code 128 được vẽ chuẩn 100% không bao giờ bị mờ nét hay in ngược chiều dọc như trình duyệt web!
                </div>
              </div>

              {/* Cách 1: Kết nối CSV (Phổ biến & đơn giản nhất - 30 giây) */}
              <div className="border border-indigo-100 rounded-2xl p-3.5 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">A</span>
                    <h4 className="font-bold text-indigo-950 text-sm">
                      Cách 1: Mở mẫu tem BarTender &amp; Kết nối file .CSV (30 giây)
                    </h4>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                    Dễ nhất
                  </span>
                </div>
                <div className="pl-8 space-y-2 leading-relaxed">
                  <p><strong>Bước 1:</strong> Bấm nút <strong>"Xuất CSV"</strong> trên phần mềm để tải file dữ liệu về máy tính (ví dụ: <code>BarTender_Data_Atellica_...csv</code>).</p>
                  <p><strong>Bước 2:</strong> Mở BarTender Designer, tạo khổ tem:
                    <ul className="list-disc pl-4 mt-1 text-slate-600">
                      <li>Width: <strong>50.0 mm</strong>, Height: <strong>20.0 mm</strong>.</li>
                      <li>Orientation: <strong>Portrait</strong> (hoặc Landscape tùy chiều cuộn ra của máy in).</li>
                    </ul>
                  </p>
                  <p><strong>Bước 3:</strong> Trên menu BarTender, chọn <strong>File &gt; Database Connection Setup</strong> (Thiết lập cơ sở dữ liệu) &gt; chọn <strong>Text File</strong> &gt; Browse đến file <code>.csv</code> vừa tải.</p>
                  <p><strong>Bước 4:</strong> Kéo đối tượng <strong>Barcode (Code 128)</strong> vào tem &gt; chọn nguồn dữ liệu (Data Source) là trường <code>Barcode</code>. Kéo Text box liên kết trường <code>TenChatChuanQC</code>, <code>HanSuDung</code>, <code>SoThuTuTuyp</code>.</p>
                  <p><strong>Bước 5:</strong> Bấm <strong>Ctrl + P</strong> trên BarTender &gt; Máy in Zebra ZD421 sẽ in toàn bộ lô tem ra nhanh chóng, rõ nét tuyệt đối!</p>
                </div>
              </div>

              {/* Cách 2: Tự động hóa hoàn toàn với BarTender Enterprise Automation */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">B</span>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Cách 2: BarTender Enterprise Automation (.BTXML Script)
                    </h4>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    Tự động
                  </span>
                </div>
                <div className="pl-8 space-y-1.5 leading-relaxed text-slate-600">
                  <p>Bấm nút <strong>"Xuất BTXML"</strong> để tải file kịch bản in XML.</p>
                  <p>Nếu bệnh viện dùng <strong>BarTender Integration Builder</strong> hoặc <strong>BarTender Commander</strong>:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Thả file <code>.btxml</code> vào thư mục Scan Folder (Hot Folder).</li>
                    <li>BarTender Enterprise Automation sẽ tự động phát hiện và kích hoạt lệnh in ngay lập tức mà nhân viên không cần mở giao diện BarTender!</li>
                  </ul>
                </div>
              </div>

              {/* Cách 3: Nạp trực tiếp mã ZPL vào máy in */}
              <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">C</span>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Cách 3: Gửi mã Native ZPL trực tiếp sang Zebra ZD421
                    </h4>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    Không cần phần mềm
                  </span>
                </div>
                <div className="pl-8 space-y-1.5 leading-relaxed text-slate-600">
                  <p>Bấm nút <strong>"Mã Zebra ZPL"</strong> để tải file <code>.zpl</code>.</p>
                  <p>Mở công cụ <strong>Zebra Setup Utilities</strong> &gt; chọn Zebra ZD421 &gt; <em>Open Communication with Printer</em> &gt; Dán nội dung ZPL và bấm <em>Send To Printer</em>. Tem sẽ được in tức thì với tốc độ phần cứng cao nhất.</p>
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

      {/* ================= PRINT CONTAINER: HIDDEN ON SCREEN, VISIBLE ON PRINT ================= */}
      {(selectedReconForPrint || selectedBarcodeCategory) && (
        <div id="print-label-area" className="hidden">
          {(() => {
            const labelCount = printConfig.customCount || selectedReconForPrint?.remainingAliquots || selectedReconForPrint?.aliquotsCount || 1;
            const labels = [];
            for (let i = 1; i <= labelCount; i++) {
              const tubeIndex = String(i).padStart(2, '0');
              let barcodeValue = selectedBarcodeCategory?.code || 'QC';
              if (printConfig.includeLot && selectedReconForPrint?.lotNumber) {
                barcodeValue += `-${selectedReconForPrint.lotNumber}`;
              }
              if (printConfig.includeIndex) {
                barcodeValue += `-${tubeIndex}`;
              }
              
              labels.push({
                index: tubeIndex,
                barcodeValue,
                displayName: selectedBarcodeCategory?.name || selectedReconForPrint?.targetItemName || '',
                lot: selectedReconForPrint?.lotNumber || '',
                expiry: selectedReconForPrint ? formatDateVN(selectedReconForPrint.expiryTimestamp) : '',
                preparedBy: selectedReconForPrint?.preparedBy || '',
              });
            }

            const labelRows = [];
            const is50x20 = printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double';
            const itemsPerRow = printConfig.labelSize === '50x20' ? 1 : 2;
            for (let i = 0; i < labels.length; i += itemsPerRow) {
              if (itemsPerRow === 1) {
                labelRows.push([labels[i]]);
              } else {
                labelRows.push([labels[i], labels[i + 1]]);
              }
            }

            const isVertical = printConfig.barcodeOrientation === 'vertical' || printConfig.barcodeOrientation === 'vertical270';
            const isRot180 = printConfig.barcodeOrientation === 'rotate180';
            const rotDeg = printConfig.barcodeOrientation === 'vertical270' ? -90 : 90;

            const renderAreaLabel = (item: typeof labels[0]) => {
              if (isVertical) {
                return (
                  <div className="print-label print-label-vertical">
                    <div className="bc-vert-col">
                      <div className="bc-vert-wrapper" style={{ transform: `rotate(${rotDeg}deg)` }}>
                        <BarcodeRenderer 
                          value={item.barcodeValue} 
                          heightMm={6.0}
                          isVertical={true}
                        />
                        <div className="barcode-text-vert">{item.barcodeValue}</div>
                      </div>
                    </div>
                    <div className="info-vert-col">
                      {printConfig.includeHospital && printConfig.hospitalName && (
                        <div className="header-hosp-vert">{printConfig.hospitalName}</div>
                      )}
                      <div className="item-name-vert">{item.displayName}</div>
                      <div className="details-vert">
                        <div>LOT: {item.lot || '---'}</div>
                        <div>HSD: {item.expiry}</div>
                      </div>
                      {item.index ? (
                        <div className="index-badge-vert">Tuýp #{item.index}</div>
                      ) : (
                        <div style={{ fontSize: '6.5px', color: '#64748b', textAlign: 'right' }}>50x20mm</div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div className={`print-label ${isRot180 ? 'rot-180' : ''}`}>
                  {printConfig.includeHospital && printConfig.hospitalName && (
                    <div className="header-hosp" style={{ fontSize: '6.5px', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.5px' }}>
                      {printConfig.hospitalName}
                    </div>
                  )}
                  <div className="item-name" style={{ fontSize: printConfig.includeHospital ? '8.5px' : '10px', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.1px' }}>
                    {item.displayName}
                  </div>
                  <div className="barcode-container" style={{ margin: '0.2mm auto' }}>
                    <BarcodeRenderer 
                      value={item.barcodeValue} 
                      heightMm={printConfig.includeHospital ? 7.0 : (printConfig.barcodeHeight || 8.0)}
                      isVertical={false}
                    />
                  </div>
                  <div className="barcode-text" style={{ fontSize: '8.5px', fontFamily: 'monospace', fontWeight: 900, textAlign: 'center', letterSpacing: '0.8px', lineHeight: 1, margin: '0.2mm 0' }}>
                    {item.barcodeValue}
                  </div>
                  <div className="footer-text" style={{ fontSize: '7.2px', fontWeight: 800, borderTop: '0.8px solid #000', paddingTop: '1px', display: 'flex', justifyContent: 'space-between', width: '100%', lineHeight: 1 }}>
                    <span>LOT: {item.lot || '---'}</span>
                    <span>HSD: {item.expiry}</span>
                    {item.index && <span>#{item.index}</span>}
                  </div>
                </div>
              );
            };

            return labelRows.map((row, rIndex) => (
              <div key={rIndex} className="print-row">
                {/* Label 1 */}
                {row[0] && renderAreaLabel(row[0])}

                {/* Label 2 */}
                {itemsPerRow === 2 && row[1] && renderAreaLabel(row[1])}
              </div>
            ));
          })()}
        </div>
      )}

      {/* ================= MODAL: EDIT RECONSTITUTION LOG ================= */}
      {isEditModalOpen && editingLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-800 font-display">
                  Sửa Bản Ghi Hoàn Nguyên: {editingLog.targetItemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingLog(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                
                {/* Reagent Name (ReadOnly display) */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tên hóa chất / QC / Calib</label>
                  <input
                    type="text"
                    disabled
                    value={editFormData.targetItemName}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium"
                  />
                </div>

                {/* Lot Number (ReadOnly display) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Số lô (Lot Number)</label>
                  <input
                    type="text"
                    disabled
                    value={editFormData.sourceLot || 'Không có'}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium"
                  />
                </div>

                {/* Category (ReadOnly display) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Khoa phòng / Phân hệ</label>
                  <input
                    type="text"
                    disabled
                    value={editFormData.category}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium"
                  />
                </div>

                {/* Volume */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Thể tích hoàn nguyên *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.volume}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, volume: e.target.value }))}
                    placeholder="Ví dụ: 3.0 mL"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Solvent */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dung môi sử dụng *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.solvent}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, solvent: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Prepared By */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Người thực hiện pha *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.preparedBy}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, preparedBy: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Stability Days */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Độ ổn định sau pha (Số ngày) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editFormData.stabilityDays}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, stabilityDays: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white font-mono"
                  />
                </div>

                {/* Aliquots Count */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tổng số tuýp chia lẻ *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editFormData.aliquotsCount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, aliquotsCount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white font-mono"
                  />
                </div>

                {/* Remaining Aliquots */}
                <div>
                  <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">Số tuýp tồn hiện tại *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={editFormData.aliquotsCount}
                    value={editFormData.remainingAliquots}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, remainingAliquots: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-xs bg-teal-50 border border-teal-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white font-mono text-teal-900 font-bold"
                  />
                </div>

                {/* Aliquot Volume */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Thể tích mỗi tuýp chia lẻ *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.aliquotVolume}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, aliquotVolume: e.target.value }))}
                    placeholder="Ví dụ: 0.5 mL"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Barcode Category Code Link */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">Mã liên kết Barcode (Mã viết tắt QC/Calib)</label>
                  <select
                    value={editFormData.barcodeCategoryCode}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, barcodeCategoryCode: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-teal-50 border border-teal-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer font-semibold text-teal-900"
                  >
                    <option value="">-- Click để liên kết mã Barcode --</option>
                    {barcodeCategories.map(cat => (
                      <option key={cat.id} value={cat.code}>
                        {cat.code} - {cat.name} ({cat.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ghi chú chỉnh sửa</label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingLog(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= PRINT LOG MODAL ================= */}
      {isPrintLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                <Printer className="h-5 w-5 text-indigo-600" />
                In Nhật ký Hoàn nguyên
              </h3>
              <button 
                onClick={() => setIsPrintLogModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={printLogStartDate}
                  onChange={(e) => setPrintLogStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={printLogEndDate}
                  onChange={(e) => setPrintLogEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-xs text-indigo-800 flex items-start gap-2">
                <Printer className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600" />
                <p>Nhấn "Bắt đầu in" để tạo mẫu báo cáo PDF phù hợp in giấy A4.</p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsPrintLogModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeout(() => {
                    window.print();
                    setIsPrintLogModalOpen(false);
                  }, 500);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Bắt đầu in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINT LOG CONTAINER ================= */}
      {isPrintLogModalOpen && (
        <div id="print-log-area" className="hidden">
          <div className="print-log-container bg-white p-8">
            {/* Header with Logo */}
            <div className="flex items-start justify-between mb-8 border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-4">
                {systemSettings?.hospitalLogo && (
                  <img src={systemSettings.hospitalLogo} alt="Logo" className="w-16 h-16 object-contain" />
                )}
                <div>
                  <h1 className="font-bold text-sm uppercase">{systemSettings?.headerRow1 || 'SỞ Y TẾ'}</h1>
                  <h2 className="font-bold text-sm uppercase">{systemSettings?.headerRow2 || 'BỆNH VIỆN / PHÒNG KHÁM'}</h2>
                  <p className="text-xs">{systemSettings?.headerRow3}</p>
                  <p className="text-xs">{systemSettings?.headerRow4}</p>
                </div>
              </div>
              <div className="text-right">
                <h3 className="font-bold text-xl uppercase mb-1">NHẬT KÝ PHA / HOÀN NGUYÊN MẪU CHUẨN, QC</h3>
                <p className="text-xs italic">
                  Từ ngày: {printLogStartDate ? printLogStartDate.split('-').reverse().join('/') : ''} - Đến ngày: {printLogEndDate ? printLogEndDate.split('-').reverse().join('/') : ''}
                </p>
                <p className="text-xs italic mt-1">
                  Ngày in: {formatDateVN(simulatedTime)}
                </p>
              </div>
            </div>

            {/* Content Table */}
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 p-2 text-center w-10">STT</th>
                  <th className="border border-slate-800 p-2 text-left">Ngày giờ pha</th>
                  <th className="border border-slate-800 p-2 text-left">Tên hoá chất/QC</th>
                  <th className="border border-slate-800 p-2 text-left">Lô SX</th>
                  <th className="border border-slate-800 p-2 text-center">Tồn kho / Tổng</th>
                  <th className="border border-slate-800 p-2 text-left">Dung môi</th>
                  <th className="border border-slate-800 p-2 text-left">Ngày hết hạn</th>
                  <th className="border border-slate-800 p-2 text-left">Người pha</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredLogs = reconstitutions.filter(log => {
                    const logDateObj = new Date(log.timestamp);
                    const logDate = `${logDateObj.getFullYear()}-${String(logDateObj.getMonth() + 1).padStart(2, '0')}-${String(logDateObj.getDate()).padStart(2, '0')}`;
                    return logDate >= printLogStartDate && logDate <= printLogEndDate;
                  });

                  if (filteredLogs.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="border border-slate-800 p-4 text-center italic text-slate-500">
                          Không có dữ liệu trong khoảng thời gian này
                        </td>
                      </tr>
                    );
                  }

                  return filteredLogs.map((log, index) => (
                    <tr key={log.id}>
                      <td className="border border-slate-800 p-2 text-center">{index + 1}</td>
                      <td className="border border-slate-800 p-2">{formatDateVN(log.timestamp)}</td>
                      <td className="border border-slate-800 p-2 font-semibold">{log.targetItemName}</td>
                      <td className="border border-slate-800 p-2">{log.sourceLot}</td>
                      <td className="border border-slate-800 p-2 text-center">
                        {log.remainingAliquots !== undefined && log.aliquotsCount !== undefined 
                          ? `${log.remainingAliquots} / ${log.aliquotsCount} tuýp` 
                          : log.volume}
                      </td>
                      <td className="border border-slate-800 p-2">{log.solvent}</td>
                      <td className="border border-slate-800 p-2">{formatDateVN(log.expiryTimestamp)}</td>
                      <td className="border border-slate-800 p-2">{log.preparedBy}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
            
            {/* Signature Area */}
            <div className="flex justify-end mt-12 pr-12">
              <div className="text-center">
                <p className="text-sm font-bold mb-16">Người lập bảng</p>
                <p className="text-sm">{currentUser?.fullName || '...........................................'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Embedded Print CSS style tag */}
      <style>{`
        /* Screen styles for preview */
        .label-preview-row {
          display: flex;
          gap: 8px;
          background: #f1f5f9;
          padding: 8px;
          border-radius: 8px;
          justify-content: center;
        }
        .label-preview-item {
          width: 35mm;
          height: 22mm;
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 1.5mm 1mm 1mm 1mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: 'Inter', sans-serif;
          color: black;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .label-preview-item-50x20 {
          width: 50mm;
          height: 20mm;
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 0.6mm 1.5mm 0.6mm 1.5mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: black;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        
        /* Print media styles */
        @media print {
          /* Remove standard application layout from print flow */
          #main-layout-root > aside,
          #app-header-container,
          #app-header,
          #mobile-header,
          #mobile-bottom-nav,
          #app-marquee-footer,
          #app-footer,
          #tab-viewport-container {
            display: none !important;
          }

          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          #print-log-area {
            display: ${isPrintLogModalOpen ? 'block' : 'none'} !important;
            width: 100% !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #print-label-area {
            display: ${isPrintModalOpen ? 'block' : 'none'} !important;
            width: ${printConfig.labelSize === '50x20' ? '50mm' : printConfig.labelSize === '50x20_double' ? '104mm' : '74mm'} !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: white !important;
          }

          .print-row {
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            width: ${printConfig.labelSize === '50x20' ? '50mm' : printConfig.labelSize === '50x20_double' ? '104mm' : '74mm'} !important;
            height: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '20mm' : '22mm'} !important;
            max-height: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '20mm' : '22mm'} !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
          }
          .print-row:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .print-label {
            width: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '50mm' : '35mm'} !important;
            height: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '20mm' : '22mm'} !important;
            max-height: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '20mm' : '22mm'} !important;
            box-sizing: border-box !important;
            padding: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '0.5mm 1.5mm 0.5mm 1.5mm' : '1.2mm 1mm 1mm 1mm'} !important;
            margin: 0 !important;
            margin-right: ${printConfig.labelSize === '50x20' ? '0' : '4mm'} !important; /* spacing between the 2 labels on roll */
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
            font-weight: 800 !important;
            color: #000000 !important;
            background: #ffffff !important;
            border: none !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-label.print-label-vertical {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: stretch !important;
            text-align: left !important;
          }

          .print-label.rot-180 {
            transform: rotate(180deg) !important;
          }

          .bc-vert-col {
            width: 18mm !important;
            height: 18.2mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
          }

          .bc-vert-wrapper {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            width: 16mm !important;
            height: 16mm !important;
            transform-origin: center center !important;
          }

          .info-vert-col {
            flex: 1 !important;
            height: 18.2mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding-left: 1.5mm !important;
            border-left: 0.8px dashed #000000 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            min-width: 0 !important;
          }

          #print-label-area svg {
            shape-rendering: auto;
          }

          /* Set page dimension to label size */
          @page {
            size: ${isPrintLogModalOpen ? 'A4 portrait' : (printConfig.labelSize === '50x20' ? '50mm 20mm' : printConfig.labelSize === '50x20_double' ? '104mm 20mm' : '74mm 22mm')};
            margin: ${isPrintLogModalOpen ? '10mm' : '0mm'};
          }
        }
      `}</style>

    </div>
  );
}

function BarcodeRenderer({ 
  value, 
  heightMm = 7.5,
  isVertical = false,
  width, 
  height 
}: { 
  value: string; 
  heightMm?: number;
  isVertical?: boolean;
  width?: number; 
  height?: number; 
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cleanVal = (value || 'QC').trim();
  const numModules = cleanVal.length * 11 + 35;
  const targetWidthMm = isVertical ? 15.5 : Math.max(30, Math.min(43, Math.round(numModules * 0.19 * 10) / 10));

  useEffect(() => {
    if (svgRef.current && cleanVal) {
      try {
        JsBarcode(svgRef.current, cleanVal, {
          format: 'CODE128',
          width: isVertical ? 1 : 2,
          height: isVertical ? 25 : 40,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
        });
        if (svgRef.current) {
          svgRef.current.setAttribute('preserveAspectRatio', 'none');
          svgRef.current.style.display = 'block';
          svgRef.current.style.marginLeft = 'auto';
          svgRef.current.style.marginRight = 'auto';
          svgRef.current.style.width = `${targetWidthMm}mm`;
          svgRef.current.style.maxWidth = isVertical ? '16mm' : '44mm';
          svgRef.current.style.height = `${heightMm}mm`;
        }
      } catch (err) {
        console.error('Barcode error:', err);
      }
    }
  }, [cleanVal, targetWidthMm, heightMm, isVertical]);

  return (
    <div className="w-full flex items-center justify-center text-center">
      <svg ref={svgRef} className="block mx-auto" />
    </div>
  );
}
