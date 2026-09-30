import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Layers, 
  AlertTriangle, 
  Thermometer, 
  Search, 
  Plus, 
  Printer, 
  FileText, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Tag, 
  X, 
  ArrowRight, 
  Info, 
  Beaker, 
  Droplet, 
  Snowflake, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Flame,
  Zap,
  Lock,
  Eye,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { 
  ReagentMaterial, 
  InUseStability, 
  ReconstitutionLog, 
  SystemSettings, 
  User, 
  LabCategory, 
  FridgeId, 
  FridgeLocationItem 
} from '../types';
import { formatDateVN, exportToExcel, exportToPDF } from '../utils';

interface FridgeLocationTabProps {
  reagents: ReagentMaterial[];
  inUseStability: InUseStability[];
  reconstitutions: ReconstitutionLog[];
  simulatedTime: string; // ISO String
  currentUser: User;
  systemSettings?: SystemSettings;
}

// Initial pre-populated fridge mapping items with Ngăn Đông (Tier 0) + Tầng 1, 2, 3
const DEFAULT_FRIDGE_ITEMS: FridgeLocationItem[] = [
  // --- TỦ 1: TỦ SINH HÓA ---
  {
    id: 'FLI-F01',
    fridgeId: 'tu-sinh-hoa',
    shelfTier: 0,
    itemName: 'QC Lyphochek Level 1 & 2 Frozen Aliquots (-20°C)',
    category: 'Sinh hóa',
    lotNumber: 'LOT-LYPH-FZ-2026',
    originalExpiryDate: '2027-06-30',
    openOrReconDate: '2026-07-01',
    inUseStabilityInfo: 'Đông lạnh -20°C ổn định 30 ngày sau pha',
    quantity: '12 tuýp aliquots (0.5mL)',
    status: 'in_use',
    notes: 'Bảo quản nghiêm ngặt ngăn đông -20°C, rã đông trước khi chạy'
  },
  {
    id: 'FLI-F02',
    fridgeId: 'tu-sinh-hoa',
    shelfTier: 0,
    itemName: 'Multical Calibrator Frozen Serum Stock',
    category: 'Sinh hóa',
    lotNumber: 'LOT-CAL-FZ-99',
    originalExpiryDate: '2027-10-15',
    quantity: '6 tuýp dự trữ đông',
    status: 'normal',
    notes: 'Huyết thanh chuẩn chia nhỏ cấp đông dự phòng'
  },
  {
    id: 'FLI-001',
    fridgeId: 'tu-sinh-hoa',
    shelfTier: 1,
    itemName: 'Multical Calibrator (Cobas)',
    category: 'Sinh hóa',
    lotNumber: 'LOT-CAL-2026A',
    originalExpiryDate: '2027-08-30',
    quantity: '5 lọ nguyên hộp',
    status: 'normal',
    notes: 'Lọ Calib gốc dự trữ dài hạn theo đúng số lô'
  },
  {
    id: 'FLI-002',
    fridgeId: 'tu-sinh-hoa',
    shelfTier: 1,
    itemName: 'Glucose Liquicolor Reagent Kit',
    category: 'Sinh hóa',
    lotNumber: 'LOT-GLU-2045A',
    originalExpiryDate: '2027-05-15',
    quantity: '10 hộp nguyên',
    status: 'normal',
    notes: 'Hóa chất dự trữ dài hạn'
  },
  {
    id: 'FLI-003',
    fridgeId: 'tu-sinh-hoa',
    shelfTier: 2,
    itemName: 'QC Lyphochek Level 2 (Đã rã đông / hoàn nguyên)',
    category: 'Sinh hóa',
    lotNumber: 'LOT-LYPH-9921',
    originalExpiryDate: '2026-11-20',
    openOrReconDate: '2026-07-10',
    inUseStabilityInfo: 'Hạn ổn định 7 ngày sau pha (bảo quản 2-8°C)',
    quantity: '6 tuýp nhỏ (0.5mL/tuýp)',
    status: 'in_use',
    notes: 'Khay chứa lọ QC đã pha đang sử dụng'
  },
  {
    id: 'FLI-004',
    fridgeId: 'tu-sinh-hoa',
    shelfTier: 2,
    itemName: 'AST/GOT Liquid Reagent (Đang mở nắp)',
    category: 'Sinh hóa',
    lotNumber: 'LOT-AST-3098B',
    originalExpiryDate: '2026-08-15',
    openOrReconDate: '2026-07-01',
    inUseStabilityInfo: 'Hạn ổn định 30 ngày trên máy/tủ lạnh',
    quantity: '1 chai đang sử dụng',
    status: 'in_use',
    notes: 'Đồng bộ cảnh báo ISO 2429'
  },
  {
    id: 'FLI-005',
    fridgeId: 'tu-sinh-hoa',
    shelfTier: 3,
    itemName: 'Alcohol/Ammonia/Carbonate Calibrator (ĐÃ HẾT HẠN)',
    category: 'Sinh hóa',
    lotNumber: 'LOT-ALC-1092-EXP',
    originalExpiryDate: '2026-06-30',
    openOrReconDate: '2026-05-10',
    inUseStabilityInfo: 'Đã quá hạn hoàn nguyên & hạn gốc',
    quantity: '2 lọ hết hạn',
    status: 'expired_isolated',
    notes: 'Đã cách ly, dán nhãn đỏ KHÔNG SỬ DỤNG chờ tiêu hủy',
    isRedTagged: true
  },

  // --- TỦ 2: TỦ MIỄN DỊCH ---
  {
    id: 'FLI-F03',
    fridgeId: 'tu-mien-dich',
    shelfTier: 0,
    itemName: 'HBsAg / HIV Positive Control Aliquots (-20°C)',
    category: 'Miễn dịch',
    lotNumber: 'LOT-IMM-FZ-8802',
    originalExpiryDate: '2027-11-20',
    openOrReconDate: '2026-06-15',
    inUseStabilityInfo: 'Đông lạnh -20°C ổn định 60 ngày',
    quantity: '10 tuýp aliquot frozen',
    status: 'in_use',
    notes: 'Mẫu kiểm tra chất lượng miễn dịch cấp đông'
  },
  {
    id: 'FLI-F04',
    fridgeId: 'tu-mien-dich',
    shelfTier: 0,
    itemName: 'Troponin I High Sensitive Standard Frozen Stock',
    category: 'Miễn dịch',
    lotNumber: 'LOT-TROP-FZ-02',
    originalExpiryDate: '2027-09-10',
    quantity: '4 vial đông lạnh',
    status: 'normal',
    notes: 'Chất chuẩn tim mạch lưu trữ ngăn đông'
  },
  {
    id: 'FLI-006',
    fridgeId: 'tu-mien-dich',
    shelfTier: 1,
    itemName: 'VIROTROL II Immunoassay Control Set',
    category: 'Miễn dịch',
    lotNumber: 'LOT-VIR-8802',
    originalExpiryDate: '2027-12-10',
    quantity: '4 kit nguyên hộp',
    status: 'normal',
    notes: 'Bảo quản nghiêm ngặt dải 2°C - 8°C'
  },
  {
    id: 'FLI-007',
    fridgeId: 'tu-mien-dich',
    shelfTier: 1,
    itemName: 'Troponin I High Sensitive Reagent Pack',
    category: 'Miễn dịch',
    lotNumber: 'LOT-TROP-Ab12',
    originalExpiryDate: '2027-02-14',
    quantity: '3 hộp nguyên',
    status: 'normal',
    notes: 'Dự trữ lâu dài'
  },
  {
    id: 'FLI-008',
    fridgeId: 'tu-mien-dich',
    shelfTier: 2,
    itemName: 'Atellica IM HBsII QC Control (Đang dùng)',
    category: 'Miễn dịch',
    lotNumber: 'LOT-ATL-HBS-401',
    originalExpiryDate: '2026-10-15',
    openOrReconDate: '2026-07-05',
    inUseStabilityInfo: 'Hạn ổn định 14 ngày sau mở nắp',
    quantity: '2 lọ đang mở nắp',
    status: 'in_use',
    notes: 'Kiểm soát chặt chẽ nhiệt độ 2-8°C'
  },
  {
    id: 'FLI-009',
    fridgeId: 'tu-mien-dich',
    shelfTier: 3,
    itemName: 'HBsAg QC Control Kit (ĐÃ HẾT HẠN SỬ DỤNG GỐC)',
    category: 'Miễn dịch',
    lotNumber: 'LOT-HBS-OLD-2025',
    originalExpiryDate: '2026-06-01',
    quantity: '1 bộ QC hết hạn',
    status: 'expired_isolated',
    notes: 'Biệt lập hàng chờ tiêu hủy theo SOP 2429',
    isRedTagged: true
  },

  // --- TỦ 3: TỦ HUYẾT HỌC ---
  {
    id: 'FLI-F05',
    fridgeId: 'tu-huyet-hoc',
    shelfTier: 0,
    itemName: 'HemosIL Coagulation Control Frozen Aliquots (-20°C)',
    category: 'Huyết học',
    lotNumber: 'LOT-HEM-FZ-5510',
    originalExpiryDate: '2027-05-30',
    openOrReconDate: '2026-07-05',
    inUseStabilityInfo: 'Hạn đông lạnh 30 ngày ở -20°C',
    quantity: '8 tuýp đông lạnh (0.5mL)',
    status: 'in_use',
    notes: 'Huyết tương đông máu rã đông trước khi kiểm chuẩn'
  },
  {
    id: 'FLI-F06',
    fridgeId: 'tu-huyet-hoc',
    shelfTier: 0,
    itemName: 'Thrombin Standard Frozen Stock (-20°C)',
    category: 'Huyết học',
    lotNumber: 'LOT-THROM-FZ-01',
    originalExpiryDate: '2027-01-20',
    quantity: '5 lọ cấp đông',
    status: 'normal',
    notes: 'Thrombin chuẩn bảo quản nhiệt độ âm'
  },
  {
    id: 'FLI-010',
    fridgeId: 'tu-huyet-hoc',
    shelfTier: 1,
    itemName: 'HemosIL Control Coagulation Normal & Pathological',
    category: 'Huyết học',
    lotNumber: 'LOT-HEM-5510',
    originalExpiryDate: '2027-04-20',
    quantity: '6 lọ nguyên',
    status: 'normal',
    notes: 'Lưu trữ dung dịch control đông máu chưa mở'
  },
  {
    id: 'FLI-011',
    fridgeId: 'tu-huyet-hoc',
    shelfTier: 2,
    itemName: 'Sysmex e-CHECK Hematology Control (Tri-Level)',
    category: 'Huyết học',
    lotNumber: 'LOT-SYS-CHK-703',
    originalExpiryDate: '2026-09-10',
    openOrReconDate: '2026-07-08',
    inUseStabilityInfo: 'Hạn ổn định 14 ngày sau khi chọc hút',
    quantity: '3 lọ đang chọc hút',
    status: 'in_use',
    notes: 'Kiểm chuẩn dòng tế bào máu tự động'
  },
  {
    id: 'FLI-012',
    fridgeId: 'tu-huyet-hoc',
    shelfTier: 3,
    itemName: 'Dung dịch Kiểm chuẩn Huyết học Cũ (ĐÃ HẾT HẠN)',
    category: 'Huyết học',
    lotNumber: 'LOT-HEM-EXPIRED-22',
    originalExpiryDate: '2026-05-20',
    quantity: '2 lọ quá hạn',
    status: 'expired_isolated',
    notes: 'Dán nhãn đỏ "HÓA CHẤT HẾT HẠN - KHÔNG SỬ DỤNG"',
    isRedTagged: true
  }
];

export default function FridgeLocationTab({
  reagents,
  inUseStability,
  reconstitutions,
  simulatedTime,
  currentUser,
  systemSettings
}: FridgeLocationTabProps) {
  // Navigation & Filter States
  const [selectedFridge, setSelectedFridge] = useState<FridgeId | 'all'>('all');
  const [selectedTier, setSelectedTier] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'graphic' | 'grid' | 'table'>('graphic');

  // Custom Items State stored in LocalStorage
  const [customItems, setCustomItems] = useState<FridgeLocationItem[]>(() => {
    try {
      const saved = localStorage.getItem('lab_fridge_location_items_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load fridge items', e);
    }
    return DEFAULT_FRIDGE_ITEMS;
  });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRedTagModalOpen, setIsRedTagModalOpen] = useState(false);
  const [selectedRedTagItem, setSelectedRedTagItem] = useState<FridgeLocationItem | null>(null);

  // Form State for Adding / Assigning Item to Fridge
  const [newItemForm, setNewItemForm] = useState({
    fridgeId: 'tu-sinh-hoa' as FridgeId,
    shelfTier: 1 as 0 | 1 | 2 | 3,
    itemName: '',
    category: 'Sinh hóa' as LabCategory,
    lotNumber: '',
    originalExpiryDate: '',
    openOrReconDate: '',
    inUseStabilityInfo: '',
    quantity: '1 lọ',
    notes: ''
  });

  // Save custom items to localStorage
  const saveCustomItems = (items: FridgeLocationItem[]) => {
    setCustomItems(items);
    try {
      localStorage.setItem('lab_fridge_location_items_v2', JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save fridge items', e);
    }
  };

  // Combine custom items with live reagents, in-use items, and reconstitutions
  const allFridgeItems = useMemo(() => {
    const items: FridgeLocationItem[] = [...customItems];
    const existingIds = new Set(items.map(i => i.id));

    // Map active reagents to Tier 1 (if unopened) or Tier 3 (if expired)
    reagents.forEach(r => {
      const isExpired = new Date(r.originalExpiryDate) < new Date(simulatedTime);
      const isSinhHoa = r.category === 'Sinh hóa';
      const isMienDich = r.category === 'Miễn dịch';
      const targetFridge: FridgeId = isSinhHoa ? 'tu-sinh-hoa' : isMienDich ? 'tu-mien-dich' : 'tu-huyet-hoc';

      if (isExpired) {
        const id = `AUTO-EXP-REAGENT-${r.id}`;
        if (!existingIds.has(id)) {
          items.push({
            id,
            fridgeId: targetFridge,
            shelfTier: 3,
            itemName: `${r.name} (Hóa chất hết hạn gốc)`,
            category: r.category,
            lotNumber: r.lotNumber,
            originalExpiryDate: r.originalExpiryDate,
            quantity: `${r.currentStock} ${r.unit}`,
            status: 'expired_isolated',
            notes: 'Hệ thống tự động phát hiện hết hạn - Cần dán nhãn đỏ tiêu hủy',
            isRedTagged: true
          });
        }
      } else if (r.currentStock > 0) {
        const id = `AUTO-STOCK-REAGENT-${r.id}`;
        if (!existingIds.has(id)) {
          items.push({
            id,
            fridgeId: targetFridge,
            shelfTier: 1,
            itemName: r.name,
            category: r.category,
            lotNumber: r.lotNumber,
            originalExpiryDate: r.originalExpiryDate,
            quantity: `${r.currentStock} ${r.unit}`,
            status: 'normal',
            notes: r.packSize ? `Dự trữ: ${r.packSize}` : 'Hóa chất dự trữ dài hạn nguyên hộp'
          });
        }
      }
    });

    // Map active in-use stability items to Tier 2
    inUseStability.forEach(st => {
      if (st.status === 'active') {
        const targetFridge: FridgeId = st.category === 'Sinh hóa' ? 'tu-sinh-hoa' : st.category === 'Miễn dịch' ? 'tu-mien-dich' : 'tu-huyet-hoc';
        const id = `AUTO-INUSE-${st.id}`;
        if (!existingIds.has(id)) {
          items.push({
            id,
            fridgeId: targetFridge,
            shelfTier: 2,
            itemName: `${st.reagentName} (Đang mở nắp)`,
            category: st.category,
            lotNumber: st.lotNumber,
            originalExpiryDate: st.originalExpiryDate,
            openOrReconDate: st.openedDate,
            inUseStabilityInfo: `Hạn in-use: ${formatDateVN(st.calculatedExpiry)} (Mở bởi: ${st.openedBy})`,
            quantity: st.remainingTests !== undefined ? `${st.remainingTests} tests còn lại` : '1 lọ đang dùng',
            status: 'in_use',
            notes: st.positionInMachine ? `Vị trí: ${st.positionInMachine}` : 'Đang theo dõi thời gian mở nắp'
          });
        }
      } else if (st.status === 'expired') {
        const targetFridge: FridgeId = st.category === 'Sinh hóa' ? 'tu-sinh-hoa' : st.category === 'Miễn dịch' ? 'tu-mien-dich' : 'tu-huyet-hoc';
        const id = `AUTO-EXPIRED-INUSE-${st.id}`;
        if (!existingIds.has(id)) {
          items.push({
            id,
            fridgeId: targetFridge,
            shelfTier: 3,
            itemName: `${st.reagentName} (Quá hạn mở nắp In-use)`,
            category: st.category,
            lotNumber: st.lotNumber,
            originalExpiryDate: st.originalExpiryDate,
            openOrReconDate: st.openedDate,
            inUseStabilityInfo: `Đã quá hạn mở nắp ngày: ${formatDateVN(st.calculatedExpiry)}`,
            quantity: '1 lọ',
            status: 'expired_isolated',
            notes: 'Hết hạn sử dụng sau mở nắp - Biệt lập tại Tầng 3',
            isRedTagged: true
          });
        }
      }
    });

    // Map active reconstitutions to Tier 2
    reconstitutions.forEach(recon => {
      if (recon.status === 'Đang sử dụng') {
        const targetFridge: FridgeId = recon.category === 'Sinh hóa' ? 'tu-sinh-hoa' : recon.category === 'Miễn dịch' ? 'tu-mien-dich' : 'tu-huyet-hoc';
        const id = `AUTO-RECON-${recon.id}`;
        if (!existingIds.has(id)) {
          items.push({
            id,
            fridgeId: targetFridge,
            shelfTier: 2,
            itemName: `${recon.targetItemName} (QC/Calib đã hoàn nguyên)`,
            category: recon.category,
            lotNumber: recon.sourceLot,
            originalExpiryDate: formatDateVN(recon.expiryTimestamp),
            openOrReconDate: formatDateVN(recon.timestamp),
            inUseStabilityInfo: `Hạn ổn định: ${formatDateVN(recon.expiryTimestamp)} (Pha bởi: ${recon.preparedBy})`,
            quantity: recon.remainingAliquots ? `${recon.remainingAliquots} tuýp (${recon.aliquotVolume || ''})` : recon.volume,
            status: 'in_use',
            notes: `Dung môi: ${recon.solvent}`
          });
        }
      }
    });

    return items;
  }, [customItems, reagents, inUseStability, reconstitutions, simulatedTime]);

  // Filtered items based on search and selected filters
  const filteredItems = useMemo(() => {
    return allFridgeItems.filter(item => {
      const matchFridge = selectedFridge === 'all' || item.fridgeId === selectedFridge;
      const matchTier = selectedTier === 'all' || item.shelfTier === selectedTier;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        item.itemName.toLowerCase().includes(q) ||
        item.lotNumber.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchFridge && matchTier && matchQuery;
    });
  }, [allFridgeItems, selectedFridge, selectedTier, searchQuery]);

  // Summary Counts
  const stats = useMemo(() => {
    const tier0Count = allFridgeItems.filter(i => i.shelfTier === 0).length;
    const tier1Count = allFridgeItems.filter(i => i.shelfTier === 1).length;
    const tier2Count = allFridgeItems.filter(i => i.shelfTier === 2).length;
    const tier3Count = allFridgeItems.filter(i => i.shelfTier === 3).length;
    const totalCount = allFridgeItems.length;

    const fridge1Count = allFridgeItems.filter(i => i.fridgeId === 'tu-sinh-hoa').length;
    const fridge2Count = allFridgeItems.filter(i => i.fridgeId === 'tu-mien-dich').length;
    const fridge3Count = allFridgeItems.filter(i => i.fridgeId === 'tu-huyet-hoc').length;

    return {
      tier0Count,
      tier1Count,
      tier2Count,
      tier3Count,
      totalCount,
      fridge1Count,
      fridge2Count,
      fridge3Count
    };
  }, [allFridgeItems]);

  // Handler to add a new item to fridge
  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.itemName) return;

    const newItem: FridgeLocationItem = {
      id: `FLI-USER-${Date.now()}`,
      fridgeId: newItemForm.fridgeId,
      shelfTier: newItemForm.shelfTier,
      itemName: newItemForm.itemName,
      category: newItemForm.category,
      lotNumber: newItemForm.lotNumber || 'N/A',
      originalExpiryDate: newItemForm.originalExpiryDate || new Date().toISOString().split('T')[0],
      openOrReconDate: newItemForm.openOrReconDate,
      inUseStabilityInfo: newItemForm.inUseStabilityInfo,
      quantity: newItemForm.quantity,
      status: newItemForm.shelfTier === 3 ? 'expired_isolated' : newItemForm.shelfTier === 2 ? 'in_use' : 'normal',
      notes: newItemForm.notes,
      isRedTagged: newItemForm.shelfTier === 3
    };

    const updated = [newItem, ...customItems];
    saveCustomItems(updated);
    setIsAddModalOpen(false);

    // Reset form
    setNewItemForm({
      fridgeId: 'tu-sinh-hoa',
      shelfTier: 1,
      itemName: '',
      category: 'Sinh hóa',
      lotNumber: '',
      originalExpiryDate: '',
      openOrReconDate: '',
      inUseStabilityInfo: '',
      quantity: '1 lọ',
      notes: ''
    });
  };

  // Handler to delete a custom item
  const handleDeleteCustomItem = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa vị trí lưu trữ này khỏi sơ đồ tủ lạnh?')) {
      const updated = customItems.filter(i => i.id !== id);
      saveCustomItems(updated);
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    const headers = ['STT', 'Tủ lạnh', 'Vị trí tầng', 'Tên Hóa chất / QC / Calib', 'Phân loại', 'Số lô (LOT)', 'Hạn dùng gốc', 'Thông tin In-use', 'Số lượng', 'Trạng thái ISO', 'Ghi chú'];
    const keys = ['stt', 'fridge', 'tier', 'itemName', 'category', 'lot', 'expiry', 'inUse', 'quantity', 'status', 'notes'];

    const exportData = filteredItems.map((item, idx) => ({
      stt: idx + 1,
      fridge: item.fridgeId === 'tu-sinh-hoa' ? 'Tủ 1: Sinh hóa' : item.fridgeId === 'tu-mien-dich' ? 'Tủ 2: Miễn dịch' : 'Tủ 3: Huyết học',
      tier: item.shelfTier === 0 ? 'Ngăn Đông (-20°C)' : `Tầng ${item.shelfTier}`,
      itemName: item.itemName,
      category: item.category,
      lot: item.lotNumber,
      expiry: item.originalExpiryDate,
      inUse: item.inUseStabilityInfo || item.openOrReconDate || 'N/A',
      quantity: item.quantity || 'N/A',
      status: item.shelfTier === 3 ? 'ĐÃ HẾT HẠN - BIỆT LẬP (NHÃN ĐỎ)' : item.shelfTier === 0 ? 'ĐÔNG LẠNH -20°C' : item.shelfTier === 2 ? 'Đang sử dụng / In-use' : 'Nguyên hộp chưa mở',
      notes: item.notes || ''
    }));

    exportToExcel(exportData, headers, keys, 'SO_DO_VI_TRI_3_TU_LANH_2429');
  };

  const handleExportPDF = () => {
    const headers = ['STT', 'Tủ lạnh', 'Vị trí tầng', 'Tên Hóa chất / QC', 'Số lô (LOT)', 'Hạn dùng', 'Trạng thái'];
    const keys = ['stt', 'fridge', 'tier', 'itemName', 'lot', 'expiry', 'status'];

    const exportData = filteredItems.map((item, idx) => ({
      stt: idx + 1,
      fridge: item.fridgeId === 'tu-sinh-hoa' ? 'Tủ Sinh hóa' : item.fridgeId === 'tu-mien-dich' ? 'Tủ Miễn dịch' : 'Tủ Huyết học',
      tier: item.shelfTier === 0 ? 'Ngăn Đông (-20°C)' : `Tầng ${item.shelfTier}`,
      itemName: item.itemName,
      lot: item.lotNumber,
      expiry: item.originalExpiryDate,
      status: item.shelfTier === 3 ? 'HẾT HẠN (NHÃN ĐỎ)' : item.shelfTier === 0 ? 'ĐÔNG LẠNH (-20°C)' : item.shelfTier === 2 ? 'Đang dùng (In-use)' : 'Nguyên hộp'
    }));

    exportToPDF('SƠ ĐỒ PHÂN LOẠI VỊ TRÍ 3 TỦ LẠNH XÉT NGHIỆM ISO 2429', headers, keys, exportData, {}, systemSettings);
  };

  // Fridges Configuration
  const fridgesConfig = [
    {
      id: 'tu-sinh-hoa' as FridgeId,
      name: 'Tủ 1: Tủ Sinh hóa',
      shortName: 'Tủ Sinh hóa',
      category: 'Sinh hóa' as LabCategory,
      tempFreezer: '-20.5°C',
      tempMain: '3.8°C',
      tempRangeFreezer: '-25°C đến -15°C',
      tempRangeMain: '2°C - 8°C',
      status: 'An toàn',
      themeColor: 'emerald',
      bgHeader: 'from-emerald-700 via-teal-800 to-slate-900',
      doorBorder: 'border-emerald-300/60',
      description: 'Chuyên biệt cho hóa chất, chất chuẩn (Calib) và kiểm chuẩn (QC) Sinh hóa. Trang bị 1 Ngăn đông (-20°C) bảo quản mẫu QC/Huyết thanh chia nhỏ và 3 Tầng mát (2-8°C).',
      icon: Beaker
    },
    {
      id: 'tu-mien-dich' as FridgeId,
      name: 'Tủ 2: Tủ Miễn dịch',
      shortName: 'Tủ Miễn dịch',
      category: 'Miễn dịch' as LabCategory,
      tempFreezer: '-21.2°C',
      tempMain: '4.1°C',
      tempRangeFreezer: '-25°C đến -15°C',
      tempRangeMain: '2°C - 8°C',
      status: 'An toàn',
      themeColor: 'purple',
      bgHeader: 'from-purple-800 via-indigo-900 to-slate-900',
      doorBorder: 'border-purple-300/60',
      description: 'Chuyên biệt cho kit xét nghiệm Miễn dịch (Atellica IM, VIROTROL). Ngăn đông -20°C bảo quản Aliquots mẫu dương/âm QC và 3 Tầng mát 2-8°C.',
      icon: Sparkles
    },
    {
      id: 'tu-huyet-hoc' as FridgeId,
      name: 'Tủ 3: Tủ Huyết học',
      shortName: 'Tủ Huyết học',
      category: 'Huyết học' as LabCategory,
      tempFreezer: '-19.8°C',
      tempMain: '4.5°C',
      tempRangeFreezer: '-25°C đến -15°C',
      tempRangeMain: '2°C - 8°C',
      status: 'An toàn',
      themeColor: 'rose',
      bgHeader: 'from-rose-800 via-red-900 to-slate-900',
      doorBorder: 'border-rose-300/60',
      description: 'Bảo quản Control đông máu HemosIL, dung dịch kiểm chuẩn tế bào máu Sysmex. Ngăn đông -20°C giữ huyết tương chuẩn và 3 Tầng mát 2-8°C.',
      icon: Droplet
    }
  ];

  return (
    <div className="space-y-6 pb-12" id="fridge-location-tab-root">
      
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-md shrink-0 mt-0.5">
              <Snowflake className="h-6 w-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold font-display text-slate-800 uppercase tracking-tight">
                  MÔ TẢ CẤU TRÚC QUẢN LÝ VỊ TRÍ 3 TỦ LẠNH XÉT NGHIỆM
                </h1>
                <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-900 text-[10px] font-mono font-bold rounded-full border border-cyan-300 uppercase shrink-0">
                  SOP 2429 / ISO 15189
                </span>
                <span className="px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full shadow-2xs font-mono shrink-0">
                  + 1 NGĂN ĐÔNG (-20°C) / MỖI TỦ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Mô hình trực quan mô phỏng 3 Tủ Lạnh Chuyên Biệt (Sinh hóa, Miễn dịch, Huyết học). Mỗi tủ trang bị <strong>1 Ngăn đông (-20°C)</strong> chuyên bảo quản mẫu QC/Huyết thanh đông lạnh và <strong>3 Tầng ngăn mát (2°C - 8°C)</strong> phân vùng nghiêm ngặt.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              id="btn-add-fridge-item"
            >
              <Plus className="h-4 w-4" />
              Gán vị trí Tủ lạnh
            </button>
            <button
              onClick={() => {
                setTimeout(() => {
                  window.print();
                }, 300);
              }}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="In sơ đồ lưu trữ A4"
            >
              <Printer className="h-4 w-4 text-indigo-600" />
              <span>In Sơ đồ A4</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="Xuất báo cáo PDF"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              <span>Xuất PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="Xuất Excel sơ đồ vị trí"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* METRICS FOR 4 TIERS (NGĂN ĐÔNG + 3 TẦNG) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Total Overall */}
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 flex items-center justify-between shadow-md">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng vị trí lưu trữ</p>
              <p className="text-xl font-bold font-mono mt-0.5">{stats.totalCount} <span className="text-xs font-sans text-slate-300">mục</span></p>
              <p className="text-[10px] text-teal-400 mt-1">Phân bổ 3 Tủ Chuyên Biệt</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-800 text-teal-400 flex items-center justify-center font-bold">
              3 TỦ
            </div>
          </div>

          {/* Tier 0: Ngăn Đông */}
          <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-sky-900 uppercase tracking-wider">
                <Snowflake className="h-3.5 w-3.5 text-sky-600 animate-spin-slow" />
                Ngăn Đông (-20°C)
              </div>
              <p className="text-xl font-bold text-sky-950 font-mono mt-0.5">{stats.tier0Count} <span className="text-xs font-sans text-sky-700">mục</span></p>
              <p className="text-[10px] text-sky-700 mt-1 truncate">Mẫu QC đông lạnh / Aliquots</p>
            </div>
            <div className="px-2 py-1 bg-sky-200 text-sky-900 rounded-lg text-xs font-black font-mono">
              -20°C
            </div>
          </div>

          {/* Tier 1: Tầng 1 */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                <Box className="h-3.5 w-3.5 text-blue-600" />
                Tầng 1 (Nguyên Hộp)
              </div>
              <p className="text-xl font-bold text-blue-950 font-mono mt-0.5">{stats.tier1Count} <span className="text-xs font-sans text-blue-700">mục</span></p>
              <p className="text-[10px] text-blue-600 mt-1 truncate">Hàng chưa mở / Dải 2-8°C</p>
            </div>
            <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold font-mono">
              T1
            </div>
          </div>

          {/* Tier 2: Tầng 2 */}
          <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                <Droplet className="h-3.5 w-3.5 text-purple-600" />
                Tầng 2 (Đang Dùng)
              </div>
              <p className="text-xl font-bold text-purple-950 font-mono mt-0.5">{stats.tier2Count} <span className="text-xs font-sans text-purple-700">mục</span></p>
              <p className="text-[10px] text-purple-600 mt-1 truncate">In-use / Mở nắp / Pha QC</p>
            </div>
            <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold font-mono">
              T2
            </div>
          </div>

          {/* Tier 3: Tầng 3 */}
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-rose-900 uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 animate-bounce" />
                Tầng 3 (Biệt Lập)
              </div>
              <p className="text-xl font-bold text-rose-950 font-mono mt-0.5">{stats.tier3Count} <span className="text-xs font-sans text-rose-700">mục</span></p>
              <p className="text-[10px] font-bold text-rose-600 mt-1 truncate">NHÃN ĐỎ: HẾT HẠN ISO</p>
            </div>
            <div className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-extrabold font-mono tracking-tight animate-pulse">
              NHÃN ĐỎ
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTROLS: SEARCH, FRIDGE FILTER, TIER FILTER & VIEW MODES */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên hóa chất, số lô (LOT), phân loại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Fridge Selector Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedFridge('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFridge === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tất cả 3 Tủ ({stats.totalCount})
            </button>
            <button
              onClick={() => setSelectedFridge('tu-sinh-hoa')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFridge === 'tu-sinh-hoa' ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Tủ 1: Sinh hóa ({stats.fridge1Count})
            </button>
            <button
              onClick={() => setSelectedFridge('tu-mien-dich')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFridge === 'tu-mien-dich' ? 'bg-purple-700 text-white shadow-xs' : 'text-purple-800 hover:bg-purple-50'
              }`}
            >
              Tủ 2: Miễn dịch ({stats.fridge2Count})
            </button>
            <button
              onClick={() => setSelectedFridge('tu-huyet-hoc')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedFridge === 'tu-huyet-hoc' ? 'bg-rose-700 text-white shadow-xs' : 'text-rose-800 hover:bg-rose-50'
              }`}
            >
              Tủ 3: Huyết học ({stats.fridge3Count})
            </button>
          </div>

          {/* Shelf Tier Filter */}
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-semibold text-slate-700"
          >
            <option value="all">Tất cả các Tầng (Ngăn Đông + Tầng 1, 2, 3)</option>
            <option value="0">❄️ Ngăn Đông (-20°C): Mẫu QC/Calib đông lạnh</option>
            <option value="1">📦 Tầng 1: Hàng Nguyên hộp chưa mở (2-8°C)</option>
            <option value="2">🧪 Tầng 2: Đang sử dụng / In-use / Pha QC (2-8°C)</option>
            <option value="3">⚠️ Tầng 3: Biệt lập - Hóa chất hết hạn ISO</option>
          </select>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setViewMode('graphic')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'graphic' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Snowflake className="h-3.5 w-3.5 text-cyan-400" />
            Vẽ Mô Hình Tủ Lạnh 3D
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sơ đồ Lưới
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'table' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Bảng Danh sách
          </button>
        </div>
      </div>

      {/* 3. MAIN DISPLAY MODE 1: VISUAL PHYSICAL REFRIGERATOR RENDER (VẼ MÔ HÌNH TỦ LẠNH) */}
      {viewMode === 'graphic' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {fridgesConfig
            .filter(f => selectedFridge === 'all' || selectedFridge === f.id)
            .map(fridge => {
              const fridgeItems = filteredItems.filter(i => i.fridgeId === fridge.id);
              const tier0Items = fridgeItems.filter(i => i.shelfTier === 0);
              const tier1Items = fridgeItems.filter(i => i.shelfTier === 1);
              const tier2Items = fridgeItems.filter(i => i.shelfTier === 2);
              const tier3Items = fridgeItems.filter(i => i.shelfTier === 3);

              return (
                <div 
                  key={fridge.id}
                  className="bg-slate-900 rounded-3xl p-3 sm:p-4 border-4 border-slate-700 shadow-2xl relative overflow-hidden flex flex-col group h-[720px]"
                >
                  {/* METALLIC CABINET GLOW EFFECT */}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-800/50 via-slate-900/80 to-slate-950 pointer-events-none" />

                  {/* 1. TOP DIGITAL TEMPERATURE & CONTROLLER PANEL */}
                  <div className="relative z-10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl p-3 border border-slate-700/80 mb-3 shadow-inner shrink-0">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold">
                          <fridge.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-black font-display text-white uppercase tracking-wider">{fridge.name}</h2>
                          <p className="text-[9.5px] text-slate-400">{fridge.category} • ISO 15189 / SOP 2429</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[9px] font-mono font-bold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        HOẠT ĐỘNG
                      </span>
                    </div>

                    {/* DUAL DIGITAL TEMP READOUTS (FREEZER vs MAIN) */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {/* FREEZER READOUT */}
                      <div className="bg-slate-950 p-2 rounded-xl border border-sky-900/60 flex items-center justify-between">
                        <div>
                          <span className="text-[8.5px] font-mono uppercase text-sky-400 font-bold block">NGĂN ĐÔNG</span>
                          <span className="text-xs font-mono font-black text-sky-300 flex items-center gap-1">
                            <Snowflake className="h-3 w-3 text-sky-400 animate-spin-slow" />
                            {fridge.tempFreezer}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-slate-500 text-right block">{fridge.tempRangeFreezer}</span>
                      </div>

                      {/* MAIN FRIDGE READOUT */}
                      <div className="bg-slate-950 p-2 rounded-xl border border-teal-900/60 flex items-center justify-between">
                        <div>
                          <span className="text-[8.5px] font-mono uppercase text-teal-400 font-bold block">NGĂN MÁT</span>
                          <span className="text-xs font-mono font-black text-emerald-400 flex items-center gap-1">
                            <Thermometer className="h-3 w-3 text-emerald-400" />
                            {fridge.tempMain}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-slate-500 text-right block">{fridge.tempRangeMain}</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. REFRIGERATOR BODY & DOOR ENCLOSURE (SCROLLABLE INTERIOR) */}
                  <div className="relative z-10 border-2 border-slate-700/80 rounded-2xl bg-slate-950 overflow-y-auto flex-1 shadow-2xl space-y-2 p-2.5 pr-2 custom-scrollbar">
                    
                    {/* ================= SECTION A: NGĂN ĐÔNG (FREEZER COMPARTMENT - TẦNG 0) ================= */}
                    {(selectedTier === 'all' || selectedTier === 0) && (
                      <div className="relative rounded-xl border-2 border-sky-500/60 bg-gradient-to-b from-sky-950 via-slate-900 to-indigo-950 p-3 overflow-hidden shadow-inner">
                        {/* Frost Particles Overlay */}
                        <div className="absolute top-1 right-2 text-sky-300/20 pointer-events-none text-4xl font-mono">❄</div>
                        
                        {/* Door Header Bar */}
                        <div className="flex items-center justify-between border-b border-sky-800/60 pb-2 mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-sky-500 text-slate-950 rounded-md text-[10px] font-black font-mono flex items-center gap-1">
                              <Snowflake className="h-3 w-3" />
                              NGĂN ĐÔNG (-20°C)
                            </span>
                            <span className="text-[10px] font-bold text-sky-200">
                              Mẫu QC & Huyết Thanh Cấp Đông
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-900/60 px-2 py-0.5 rounded-full border border-sky-700/50">
                            {tier0Items.length} mục
                          </span>
                        </div>

                        {/* Items inside Freezer */}
                        {tier0Items.length === 0 ? (
                          <div className="text-center py-3 text-[11px] text-sky-300/50 italic bg-sky-950/40 rounded-lg border border-dashed border-sky-800/40">
                            Không có mẫu QC/Hóa chất nào ở Ngăn Đông
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {tier0Items.map(item => (
                              <div 
                                key={item.id}
                                className="bg-sky-900/40 border border-sky-500/40 hover:border-sky-300 rounded-xl p-2.5 transition-all text-white flex items-start justify-between gap-2 group/item"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-sky-100 font-display">{item.itemName}</span>
                                    <span className="px-1.5 py-0.2 bg-sky-400/20 text-sky-300 text-[8.5px] font-mono font-bold rounded border border-sky-400/30">
                                      -20°C
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] text-sky-200/80 font-mono mt-1 space-y-0.5">
                                    <p>LOT: <strong className="text-white">{item.lotNumber}</strong> • Hạn gốc: <strong>{formatDateVN(item.originalExpiryDate)}</strong></p>
                                    {item.inUseStabilityInfo && <p className="text-cyan-300 font-bold">🧊 {item.inUseStabilityInfo}</p>}
                                    {item.quantity && <p className="text-sky-300/70">Số lượng: {item.quantity}</p>}
                                  </div>
                                </div>
                                {item.id.startsWith('FLI-USER') && (
                                  <button
                                    onClick={() => handleDeleteCustomItem(item.id)}
                                    className="text-[9px] text-rose-400 hover:text-rose-300 underline shrink-0 cursor-pointer"
                                  >
                                    Xóa
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ================= SECTION B: NGĂN MÁT (MAIN REFRIGERATOR BODY - 2°C ĐẾN 8°C) ================= */}
                    <div className="space-y-2 pt-1 border-t-2 border-slate-800">
                      
                      {/* --- TẦNG 1: KHU VỰC TRÊN - HÀNG NGUYÊN HỘP CHƯA MỞ --- */}
                      {(selectedTier === 'all' || selectedTier === 1) && (
                        <div className="bg-slate-900/90 border border-blue-500/40 rounded-xl p-3 space-y-2 relative">
                          <div className="flex items-center justify-between border-b border-blue-900/60 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[9.5px] font-black font-mono">
                                TẦNG 1
                              </span>
                              <span className="text-[10.5px] font-bold text-blue-200 uppercase">
                                Hàng Nguyên Hộp Chưa Mở (2°C - 8°C)
                              </span>
                            </div>
                            <span className="text-[10px] text-blue-300 font-mono bg-blue-950 px-2 py-0.5 rounded-full border border-blue-800">
                              {tier1Items.length} mục
                            </span>
                          </div>

                          {tier1Items.length === 0 ? (
                            <div className="text-center py-2 text-[10.5px] text-slate-500 italic">
                              Chưa lưu trữ hàng nguyên hộp
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {tier1Items.map(item => (
                                <div key={item.id} className="bg-slate-950/80 border border-slate-800 hover:border-blue-400/60 rounded-lg p-2 text-slate-200 text-xs flex justify-between items-start">
                                  <div>
                                    <p className="font-bold text-blue-100 text-[11px]">{item.itemName}</p>
                                    <p className="text-[9.5px] text-slate-400 font-mono">LOT: <strong className="text-slate-200">{item.lotNumber}</strong> • Expiry: <strong className="text-emerald-400">{formatDateVN(item.originalExpiryDate)}</strong> ({item.quantity})</p>
                                  </div>
                                  {item.id.startsWith('FLI-USER') && (
                                    <button onClick={() => handleDeleteCustomItem(item.id)} className="text-[9px] text-rose-400 hover:underline cursor-pointer">Gỡ</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- TẦNG 2: KHU VỰC GIỮA - LỌ ĐANG SỬ DỤNG / IN-USE / PHA QC --- */}
                      {(selectedTier === 'all' || selectedTier === 2) && (
                        <div className="bg-slate-900/90 border border-purple-500/40 rounded-xl p-3 space-y-2 relative">
                          <div className="flex items-center justify-between border-b border-purple-900/60 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-purple-600 text-white rounded text-[9.5px] font-black font-mono">
                                TẦNG 2
                              </span>
                              <span className="text-[10.5px] font-bold text-purple-200 uppercase">
                                Đang Sử Dụng / In-use / Pha QC (2°C - 8°C)
                              </span>
                            </div>
                            <span className="text-[10px] text-purple-300 font-mono bg-purple-950 px-2 py-0.5 rounded-full border border-purple-800">
                              {tier2Items.length} mục
                            </span>
                          </div>

                          {tier2Items.length === 0 ? (
                            <div className="text-center py-2 text-[10.5px] text-slate-500 italic">
                              Chưa có mục nào đang sử dụng
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {tier2Items.map(item => (
                                <div key={item.id} className="bg-purple-950/40 border border-purple-800/60 hover:border-purple-400/80 rounded-lg p-2 text-purple-100 text-xs flex justify-between items-start">
                                  <div>
                                    <p className="font-bold text-purple-100 text-[11px]">{item.itemName}</p>
                                    <p className="text-[9.5px] text-purple-300/80 font-mono">LOT: <strong>{item.lotNumber}</strong> • Mở: <strong>{item.openOrReconDate}</strong></p>
                                    {item.inUseStabilityInfo && <p className="text-[9px] font-bold text-purple-300 bg-purple-900/60 px-1.5 py-0.5 rounded mt-0.5 inline-block">⏱ {item.inUseStabilityInfo}</p>}
                                  </div>
                                  {item.id.startsWith('FLI-USER') && (
                                    <button onClick={() => handleDeleteCustomItem(item.id)} className="text-[9px] text-rose-400 hover:underline cursor-pointer">Gỡ</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- TẦNG 3: KHU VỰC ĐÁY - BIỆT LẬP HÀNG HẾT HẠN ISO 2429 --- */}
                      {(selectedTier === 'all' || selectedTier === 3) && (
                        <div className="bg-rose-950/60 border-2 border-rose-500/80 rounded-xl p-3 space-y-2 relative">
                          <div className="flex items-center justify-between border-b border-rose-800/60 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9.5px] font-black font-mono animate-pulse">
                                TẦNG 3
                              </span>
                              <span className="text-[10.5px] font-bold text-rose-200 uppercase">
                                Biệt Lập Hóa Chất Hết Hạn (NHÃN ĐỎ)
                              </span>
                            </div>
                            <span className="text-[10px] text-rose-300 font-mono bg-rose-950 px-2 py-0.5 rounded-full border border-rose-800">
                              {tier3Items.length} mục
                            </span>
                          </div>

                          {tier3Items.length === 0 ? (
                            <div className="text-center py-2 text-[10.5px] text-rose-300/60 italic">
                              Không có hóa chất hết hạn (An toàn)
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {tier3Items.map(item => (
                                <div key={item.id} className="bg-slate-950 border border-rose-500/70 rounded-lg p-2 text-rose-200 text-xs flex justify-between items-center">
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                                      <p className="font-bold text-rose-300 text-[11px]">{item.itemName}</p>
                                    </div>
                                    <p className="text-[9.5px] text-rose-400/80 font-mono">LOT: <strong>{item.lotNumber}</strong> • Hạn: <strong>{formatDateVN(item.originalExpiryDate)}</strong></p>
                                  </div>
                                  <button 
                                    onClick={() => { setSelectedRedTagItem(item); setIsRedTagModalOpen(true); }}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded cursor-pointer shrink-0"
                                  >
                                    In Nhãn Đỏ
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>

                  {/* 3. REFRIGERATOR BASE VENTILATION GRILL & FEET */}
                  <div className="relative z-10 mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-slate-500 text-[9px] font-mono shrink-0">
                    <div className="flex gap-1">
                      <div className="h-2 w-4 bg-slate-800 rounded-sm" />
                      <div className="h-2 w-4 bg-slate-800 rounded-sm" />
                      <div className="h-2 w-4 bg-slate-800 rounded-sm" />
                      <div className="h-2 w-4 bg-slate-800 rounded-sm" />
                    </div>
                    <span>CẢM BIẾN TỰ ĐỘNG ISO 2429</span>
                    <div className="flex gap-1">
                      <div className="h-2 w-4 bg-slate-800 rounded-sm" />
                      <div className="h-2 w-4 bg-slate-800 rounded-sm" />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* 4. MAIN DISPLAY MODE 2: GRAPHIC MAPPING GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {fridgesConfig
            .filter(f => selectedFridge === 'all' || selectedFridge === f.id)
            .map(fridge => {
              const fridgeItems = filteredItems.filter(i => i.fridgeId === fridge.id);
              const tier0Items = fridgeItems.filter(i => i.shelfTier === 0);
              const tier1Items = fridgeItems.filter(i => i.shelfTier === 1);
              const tier2Items = fridgeItems.filter(i => i.shelfTier === 2);
              const tier3Items = fridgeItems.filter(i => i.shelfTier === 3);

              return (
                <div 
                  key={fridge.id}
                  className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-md flex flex-col transition-all hover:border-slate-300 h-[720px]"
                >
                  {/* FRIDGE HEADER BAR */}
                  <div className={`bg-gradient-to-r ${fridge.bgHeader} p-4 text-white flex items-center justify-between shrink-0`}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
                        <fridge.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold font-display uppercase tracking-wide">{fridge.name}</h2>
                        <p className="text-[10px] text-white/80 line-clamp-1">{fridge.description}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-sky-300 font-mono text-xs font-bold">
                        <Snowflake className="h-3 w-3" />
                        <span>{fridge.tempFreezer}</span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-300 font-mono text-xs font-bold mt-0.5">
                        <Thermometer className="h-3 w-3" />
                        <span>{fridge.tempMain}</span>
                      </div>
                    </div>
                  </div>

                  {/* SHELVES LISTING */}
                  <div className="p-4 space-y-4 bg-slate-50/50 flex-1 overflow-y-auto custom-scrollbar">
                    
                    {/* NGĂN ĐÔNG */}
                    {(selectedTier === 'all' || selectedTier === 0) && (
                      <div className="bg-sky-50/80 border-2 border-sky-300 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                          <span className="px-2 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded-md font-mono">
                            NGĂN ĐÔNG (-20°C)
                          </span>
                          <span className="text-[10px] font-bold text-sky-800 font-mono">{tier0Items.length} mục</span>
                        </div>
                        {tier0Items.map(item => (
                          <div key={item.id} className="bg-white border border-sky-200 rounded-xl p-2.5 text-xs space-y-1">
                            <p className="font-bold text-slate-800">{item.itemName}</p>
                            <p className="text-[10px] text-slate-500 font-mono">LOT: {item.lotNumber} • Hạn: {formatDateVN(item.originalExpiryDate)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TẦNG 1 */}
                    {(selectedTier === 'all' || selectedTier === 1) && (
                      <div className="bg-white border border-blue-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-md font-mono">
                            TẦNG 1 (NGUYÊN HỘP)
                          </span>
                          <span className="text-[10px] font-bold text-blue-800 font-mono">{tier1Items.length} mục</span>
                        </div>
                        {tier1Items.map(item => (
                          <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs space-y-1">
                            <p className="font-bold text-slate-800">{item.itemName}</p>
                            <p className="text-[10px] text-slate-500 font-mono">LOT: {item.lotNumber} • Hạn: {formatDateVN(item.originalExpiryDate)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TẦNG 2 */}
                    {(selectedTier === 'all' || selectedTier === 2) && (
                      <div className="bg-white border border-purple-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                          <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-md font-mono">
                            TẦNG 2 (IN-USE / PHA)
                          </span>
                          <span className="text-[10px] font-bold text-purple-800 font-mono">{tier2Items.length} mục</span>
                        </div>
                        {tier2Items.map(item => (
                          <div key={item.id} className="bg-purple-50/50 border border-purple-200 rounded-xl p-2.5 text-xs space-y-1">
                            <p className="font-bold text-purple-950">{item.itemName}</p>
                            <p className="text-[10px] text-purple-800 font-mono">LOT: {item.lotNumber} • Mở/Pha: {item.openOrReconDate}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TẦNG 3 */}
                    {(selectedTier === 'all' || selectedTier === 3) && (
                      <div className="bg-rose-50/80 border-2 border-rose-300 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                          <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-md font-mono">
                            TẦNG 3 (HẾT HẠN - NHÃN ĐỎ)
                          </span>
                          <span className="text-[10px] font-bold text-rose-800 font-mono">{tier3Items.length} mục</span>
                        </div>
                        {tier3Items.map(item => (
                          <div key={item.id} className="bg-white border border-rose-300 rounded-xl p-2.5 text-xs space-y-1">
                            <p className="font-bold text-rose-950">{item.itemName}</p>
                            <p className="text-[10px] text-rose-800 font-mono">LOT: {item.lotNumber} • Expiry: {formatDateVN(item.originalExpiryDate)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* 5. MAIN DISPLAY MODE 3: TABLE LIST VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">DANH SÁCH CHI TIẾT TẤT CẢ VỊ TRÍ 3 TỦ LẠNH</h3>
            <span className="text-xs font-mono font-bold text-slate-500">Tổng số: {filteredItems.length} mục</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-mono tracking-wider">
                <tr>
                  <th className="p-3">STT</th>
                  <th className="p-3">Tủ Lạnh</th>
                  <th className="p-3">Ngăn / Tầng Vị Trí</th>
                  <th className="p-3">Tên Hóa chất / QC / Calib</th>
                  <th className="p-3">Số Lô (LOT)</th>
                  <th className="p-3">Hạn Dùng Gốc</th>
                  <th className="p-3">Mở Nắp / In-use</th>
                  <th className="p-3">Số Lượng</th>
                  <th className="p-3">Trạng Thái ISO</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      {item.fridgeId === 'tu-sinh-hoa' ? 'Tủ 1: Sinh hóa' : item.fridgeId === 'tu-mien-dich' ? 'Tủ 2: Miễn dịch' : 'Tủ 3: Huyết học'}
                    </td>
                    <td className="p-3">
                      {item.shelfTier === 0 ? (
                        <span className="px-2 py-0.5 bg-sky-100 text-sky-800 border border-sky-300 rounded font-mono font-bold text-[10px]">
                          ❄️ Ngăn Đông (-20°C)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded font-mono font-bold text-[10px]">
                          Tầng {item.shelfTier} (2-8°C)
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-900">{item.itemName}</td>
                    <td className="p-3 font-mono font-semibold text-slate-700">{item.lotNumber}</td>
                    <td className="p-3 font-mono text-slate-700">{formatDateVN(item.originalExpiryDate)}</td>
                    <td className="p-3 font-mono text-purple-700">{item.inUseStabilityInfo || item.openOrReconDate || '—'}</td>
                    <td className="p-3 text-slate-600">{item.quantity || 'N/A'}</td>
                    <td className="p-3">
                      {item.shelfTier === 3 ? (
                        <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9.5px] font-bold font-mono">
                          HẾT HẠN - NHÃN ĐỎ
                        </span>
                      ) : item.shelfTier === 0 ? (
                        <span className="px-2 py-0.5 bg-sky-600 text-white rounded text-[9.5px] font-bold font-mono">
                          ĐÔNG LẠNH -20°C
                        </span>
                      ) : item.shelfTier === 2 ? (
                        <span className="px-2 py-0.5 bg-purple-600 text-white rounded text-[9.5px] font-bold font-mono">
                          ĐANG SỬ DỤNG
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[9.5px] font-bold font-mono">
                          NGUYÊN HỘP
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {item.shelfTier === 3 && (
                        <button
                          onClick={() => { setSelectedRedTagItem(item); setIsRedTagModalOpen(true); }}
                          className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded hover:bg-rose-700 cursor-pointer"
                        >
                          In Nhãn Đỏ
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD NEW FRIDGE ITEM */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800">Gán vị trí Hóa chất / QC vào Tủ Lạnh</h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Tủ Lạnh Chuyên Biệt</label>
                <select
                  value={newItemForm.fridgeId}
                  onChange={(e) => setNewItemForm({...newItemForm, fridgeId: e.target.value as FridgeId})}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold bg-slate-50"
                >
                  <option value="tu-sinh-hoa">Tủ 1: Tủ Sinh hóa</option>
                  <option value="tu-mien-dich">Tủ 2: Tủ Miễn dịch</option>
                  <option value="tu-huyet-hoc">Tủ 3: Tủ Huyết học</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Tầng / Ngăn Bảo Quản</label>
                <select
                  value={newItemForm.shelfTier}
                  onChange={(e) => setNewItemForm({...newItemForm, shelfTier: Number(e.target.value) as 0 | 1 | 2 | 3})}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-bold bg-slate-50"
                >
                  <option value="0">❄️ Ngăn Đông (-20°C): Mẫu QC / Aliquots đông lạnh</option>
                  <option value="1">📦 Tầng 1: Khu vực trên - Hàng nguyên hộp chưa mở (2-8°C)</option>
                  <option value="2">🧪 Tầng 2: Khu vực giữa - Lọ đang sử dụng / In-use / Pha QC (2-8°C)</option>
                  <option value="3">⚠️ Tầng 3: Khu vực đáy - Biệt lập hàng chờ tiêu hủy (Dán Nhãn Đỏ ISO 2429)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Hóa chất / Chất chuẩn / QC *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Multical Calibrator, QC Lyphochek..."
                  value={newItemForm.itemName}
                  onChange={(e) => setNewItemForm({...newItemForm, itemName: e.target.value})}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số lô (LOT)</label>
                  <input
                    type="text"
                    placeholder="LOT-2026..."
                    value={newItemForm.lotNumber}
                    onChange={(e) => setNewItemForm({...newItemForm, lotNumber: e.target.value})}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạn dùng gốc</label>
                  <input
                    type="date"
                    value={newItemForm.originalExpiryDate}
                    onChange={(e) => setNewItemForm({...newItemForm, originalExpiryDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày mở nắp / pha</label>
                  <input
                    type="date"
                    value={newItemForm.openOrReconDate}
                    onChange={(e) => setNewItemForm({...newItemForm, openOrReconDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng / Thể tích</label>
                  <input
                    type="text"
                    placeholder="5 lọ, 10mL..."
                    value={newItemForm.quantity}
                    onChange={(e) => setNewItemForm({...newItemForm, quantity: e.target.value})}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú bổ sung</label>
                <input
                  type="text"
                  placeholder="Ghi chú điều kiện bảo quản..."
                  value={newItemForm.notes}
                  onChange={(e) => setNewItemForm({...newItemForm, notes: e.target.value})}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl hover:bg-teal-700 cursor-pointer shadow-sm"
                >
                  Xác nhận Gán Vị Trí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RED TAG WARNING PRINT (IN NHÃN ĐỎ THEO SOP 2429) */}
      {isRedTagModalOpen && selectedRedTagItem && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-4 border-rose-500 space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <span className="px-2.5 py-0.5 bg-rose-600 text-white text-[10px] font-black font-mono rounded uppercase">
                NHÃN ĐỎ CẢNH BÁO ISO 2429
              </span>
              <button onClick={() => setIsRedTagModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>

            {/* PREVIEW OF RED TAG TO PRINT */}
            <div className="bg-rose-50 border-4 border-rose-600 rounded-2xl p-4 text-center space-y-3 shadow-inner">
              <div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <AlertTriangle className="h-7 w-7 animate-bounce" />
              </div>

              <h2 className="text-lg font-black text-rose-950 uppercase tracking-tight">
                HÓA CHẤT HẾT HẠN - KHÔNG SỬ DỤNG
              </h2>
              <p className="text-[10px] font-bold text-rose-800 uppercase font-mono">
                CÁCH LY TẠI TẦNG 3 TỦ LẠNH - CHỜ TIÊU HỦY SOP 2429
              </p>

              <div className="bg-white rounded-xl p-3 text-left border border-rose-200 text-xs font-mono space-y-1">
                <p><strong>Tên mặt hàng:</strong> {selectedRedTagItem.itemName}</p>
                <p><strong>Số lô (LOT):</strong> {selectedRedTagItem.lotNumber}</p>
                <p><strong>Hạn dùng gốc:</strong> {formatDateVN(selectedRedTagItem.originalExpiryDate)}</p>
                <p><strong>Ngày phát hiện:</strong> {formatDateVN(simulatedTime)}</p>
                <p><strong>Người thực hiện:</strong> {currentUser.fullName} ({currentUser.role})</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRedTagModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                In Nhãn Đỏ Này
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
