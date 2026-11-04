import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Code,
  X
} from 'lucide-react';
import { ReconstitutionLog, LabCategory, User as AppUser, ReagentMaterial, BarcodeCategory, SystemSettings } from '../types';
import { formatDateTimeVN, formatDateVN, exportToExcel, exportToPDF } from '../utils';
import JsBarcode from 'jsbarcode';

// Remove Vietnamese accents and sanitize special control chars for TSPL / ZPL thermal printers (CP437 / ASCII)
function removeAccents(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/"/g, "'")
    .replace(/[\^~]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

// Generate raw printer machine code (TSPL / ZPL) for 50x20mm single roll (1-row) or 2x(50x20mm) double roll (2-row)
// Standard 203 DPI (8 dots/mm):
// - 1-row (50mm x 20mm, Gap 2mm): Width = 400 dots, Height = 160 dots, Safe Margin = 2mm (16 dots)
// - 2-row (2 x 50mm x 20mm, Gap 2mm): Total Width = 102mm (816 dots), Left X = 16 dots, Right X = 424 dots
function generatePrinterCode(
  labels: { index: string; barcodeValue: string; displayName: string; lot: string; expiry: string; preparedBy: string; hospitalName: string }[],
  format: 'TSPL' | 'ZPL',
  labelRowType: '1-row' | '2-row' = '1-row'
): string {
  if (labelRowType === '2-row') {
    // 2 labels side-by-side per row: each label is 50mm x 20mm with 2mm gap
    const pairs: [typeof labels[0], (typeof labels[0]) | null][] = [];
    for (let i = 0; i < labels.length; i += 2) {
      pairs.push([labels[i], labels[i + 1] || null]);
    }

    if (format === 'TSPL') {
      return pairs.map(([left, right]) => {
        const lines: string[] = [
          `SIZE 102 mm, 20 mm`,
          `GAP 2 mm, 0 mm`,
          `DIRECTION 1`,
          `CLS`
        ];

        const addLabelCmds = (lbl: typeof labels[0], xOffset: number) => {
          const cleanHosp = removeAccents(lbl.hospitalName || 'BVDK TP CAN THO').slice(0, 22);
          const cleanName = removeAccents(lbl.displayName || 'MAU QC').slice(0, 24);
          const cleanLot = removeAccents(lbl.lot ? `LOT:${lbl.lot}` : '');
          const cleanExp = removeAccents(lbl.expiry ? `HSD:${lbl.expiry}` : '');
          const cleanIndex = lbl.index ? `#${lbl.index}` : '';
          const footText = [cleanLot, cleanExp].filter(Boolean).join(' ');

          // Safe margin: X = xOffset (16 dots = 2mm), Y = 12 dots (1.5mm)
          lines.push(`TEXT ${xOffset},12,"1",0,1,1,"${cleanHosp}${cleanIndex ? ' ' + cleanIndex : ''}"`);
          lines.push(`TEXT ${xOffset},28,"2",0,1,1,"${cleanName}"`);
          lines.push(`BARCODE ${xOffset},48,"128",40,1,0,2,2,"${lbl.barcodeValue}"`);
          lines.push(`TEXT ${xOffset},114,"1",0,1,1,"${footText}"`);
        };

        addLabelCmds(left, 16); // Left label safe margin 2mm (16 dots)
        if (right) {
          addLabelCmds(right, 424); // Right label at 52mm + 1mm margin (424 dots)
        }

        lines.push(`PRINT 1,1`);
        return lines.join('\n');
      }).join('\n\n');
    } else {
      return pairs.map(([left, right]) => {
        const lines: string[] = [
          `^XA`,
          `^PW816`,
          `^LL160`
        ];

        const addZplCmds = (lbl: typeof labels[0], xOffset: number) => {
          const cleanHosp = removeAccents(lbl.hospitalName || 'BVDK TP CAN THO').slice(0, 22);
          const cleanName = removeAccents(lbl.displayName || 'MAU QC').slice(0, 24);
          const cleanLot = removeAccents(lbl.lot ? `LOT:${lbl.lot}` : '');
          const cleanExp = removeAccents(lbl.expiry ? `HSD:${lbl.expiry}` : '');
          const cleanIndex = lbl.index ? `#${lbl.index}` : '';
          const footText = [cleanLot, cleanExp].filter(Boolean).join(' ');

          lines.push(`^FO${xOffset},12^A0N,15,15^FD${cleanHosp}${cleanIndex ? ' ' + cleanIndex : ''}^FS`);
          lines.push(`^FO${xOffset},29^A0N,18,18^FD${cleanName}^FS`);
          lines.push(`^FO${xOffset},50^BY2,2,38^BCN,38,Y,N,N^FD${lbl.barcodeValue}^FS`);
          lines.push(`^FO${xOffset},114^A0N,15,15^FD${footText}^FS`);
        };

        addZplCmds(left, 16);
        if (right) {
          addZplCmds(right, 424);
        }

        lines.push(`^XZ`);
        return lines.join('\n');
      }).join('\n');
    }
  }

  // 1-ROW: Single Label Roll 50mm x 20mm, Gap 2mm (203 DPI: 400 x 160 dots, Safe Margin: 1.5mm - 2mm = 12 - 16 dots)
  if (format === 'TSPL') {
    return labels.map((lbl) => {
      const cleanHosp = removeAccents(lbl.hospitalName || 'BVDK TP CAN THO').slice(0, 22);
      const cleanName = removeAccents(lbl.displayName || 'MAU QC').slice(0, 24);
      const cleanLot = removeAccents(lbl.lot ? `LOT:${lbl.lot}` : '');
      const cleanExp = removeAccents(lbl.expiry ? `HSD:${lbl.expiry}` : '');
      const cleanIndex = lbl.index ? `#${lbl.index}` : '';
      const footText = [cleanLot, cleanExp].filter(Boolean).join(' ');

      return [
        `SIZE 50 mm, 20 mm`,
        `GAP 2 mm, 0 mm`,
        `DIRECTION 1`,
        `CLS`,
        `TEXT 16,12,"1",0,1,1,"${cleanHosp}${cleanIndex ? ' ' + cleanIndex : ''}"`,
        `TEXT 16,28,"2",0,1,1,"${cleanName}"`,
        `BARCODE 16,48,"128",40,1,0,2,2,"${lbl.barcodeValue}"`,
        `TEXT 16,114,"1",0,1,1,"${footText}"`,
        `PRINT 1,1`
      ].join('\n');
    }).join('\n\n');
  } else {
    // ZPL format for Zebra barcode printers (50mm x 20mm label roll, 203 DPI: width = 400 dots, height = 160 dots)
    return labels.map((lbl) => {
      const cleanHosp = removeAccents(lbl.hospitalName || 'BVDK TP CAN THO').slice(0, 22);
      const cleanName = removeAccents(lbl.displayName || 'MAU QC').slice(0, 24);
      const cleanLot = removeAccents(lbl.lot ? `LOT:${lbl.lot}` : '');
      const cleanExp = removeAccents(lbl.expiry ? `HSD:${lbl.expiry}` : '');
      const cleanIndex = lbl.index ? `#${lbl.index}` : '';
      const footText = [cleanLot, cleanExp].filter(Boolean).join(' ');

      return [
        `^XA`,
        `^PW400`,
        `^LL160`,
        `^FO16,12^A0N,15,15^FD${cleanHosp}${cleanIndex ? ' ' + cleanIndex : ''}^FS`,
        `^FO16,29^A0N,18,18^FD${cleanName}^FS`,
        `^FO16,50^BY2,2,38^BCN,38,Y,N,N^FD${lbl.barcodeValue}^FS`,
        `^FO16,114^A0N,15,15^FD${footText}^FS`,
        `^XZ`
      ].join('\n');
    }).join('\n');
  }
}

// Pure 1:1 Vector SVG generator for crisp thermal printing on 50mm x 20mm labels (Safe zone: 46mm x 17mm)
// Converts bars to <path d="..."> and sets explicit mm width/height so browser print engines never collapse SVG width or rect bars
function generatePureBarcodeSvg(value: string, heightMm = 7.0, maxWidthMm = 44): string {
  try {
    const cleanVal = (value || 'QC').trim();
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    JsBarcode(svgNode, cleanVal, {
      format: 'CODE128',
      width: 2, // Integer module width for 1:1 bar ratio
      height: 40,
      displayValue: false,
      margin: 0, // Quiet zone is guaranteed by the 2mm label padding
      background: 'transparent',
      lineColor: '#000000',
    });

    const vbAttr = svgNode.getAttribute('viewBox') || '';
    const vbParts = vbAttr.trim().split(/\s+/).map(Number);
    const widthAttr = parseFloat(svgNode.getAttribute('width') || '160') || 160;
    const heightAttr = parseFloat(svgNode.getAttribute('height') || '40') || 40;
    const vbWidth = vbParts.length === 4 && vbParts[2] > 0 ? vbParts[2] : widthAttr;
    const vbHeight = vbParts.length === 4 && vbParts[3] > 0 ? vbParts[3] : heightAttr;

    // Convert all <rect> bars into a single <path> so CSS rules on rect/children can never collapse bar widths
    const rects = Array.from(svgNode.querySelectorAll('rect'));
    const pathSegments: string[] = [];
    rects.forEach((r) => {
      const styleAttr = r.getAttribute('style') || '';
      const fillAttr = r.getAttribute('fill') || '';
      if (styleAttr.includes('transparent') || fillAttr === 'transparent' || fillAttr === 'none') {
        return;
      }
      const x = parseFloat(r.getAttribute('x') || '0');
      const y = parseFloat(r.getAttribute('y') || '0');
      const w = parseFloat(r.getAttribute('width') || '0');
      const h = parseFloat(r.getAttribute('height') || String(vbHeight));
      if (w > 0 && h > 0) {
        pathSegments.push(`M${x},${y}h${w}v${h}h-${w}Z`);
      }
    });

    const naturalWidthMm = Number(((vbWidth / vbHeight) * heightMm).toFixed(2));
    const finalWidthMm = Math.min(maxWidthMm, Math.max(22, naturalWidthMm));

    if (pathSegments.length > 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbWidth} ${vbHeight}" width="${finalWidthMm}mm" height="${heightMm}mm" preserveAspectRatio="none" shape-rendering="crispEdges" style="display:block;margin:0 auto;width:${finalWidthMm}mm;max-width:${maxWidthMm}mm;height:${heightMm}mm;shape-rendering:crispEdges;overflow:visible;"><path d="${pathSegments.join('')}" fill="#000000" shape-rendering="crispEdges"/></svg>`;
    }

    svgNode.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgNode.setAttribute('viewBox', `0 0 ${vbWidth} ${vbHeight}`);
    svgNode.setAttribute('width', `${finalWidthMm}mm`);
    svgNode.setAttribute('height', `${heightMm}mm`);
    svgNode.setAttribute('preserveAspectRatio', 'none');
    svgNode.setAttribute('shape-rendering', 'crispEdges');
    svgNode.setAttribute(
      'style',
      `display:block;margin:0 auto;width:${finalWidthMm}mm;max-width:${maxWidthMm}mm;height:${heightMm}mm;shape-rendering:crispEdges;`
    );
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

  // Print Label Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPrePrintOverlayOpen, setIsPrePrintOverlayOpen] = useState(false);
  const [selectedReconForPrint, setSelectedReconForPrint] = useState<ReconstitutionLog | null>(null);
  const [selectedBarcodeCategory, setSelectedBarcodeCategory] = useState<BarcodeCategory | null>(null);
  const [printModalTab, setPrintModalTab] = useState<'label' | 'code'>('label');
  const [printerCodeFormat, setPrinterCodeFormat] = useState<'TSPL' | 'ZPL'>('TSPL');
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Custom print config for 50x20mm (1-row) or 2x(50x20mm) (2-row)
  const [printConfig, setPrintConfig] = useState({
    hospitalName: 'BVĐK TP Cần Thơ - Khoa XN',
    includeHospital: true,
    includeLot: true,
    includeIndex: true,
    customCount: 0, // 0 means use remainingAliquots, > 0 means custom count
    labelRowType: '1-row' as '1-row' | '2-row', // '1-row' = 1 hàng tem (50x20mm), '2-row' = 2 hàng tem đôi (102x20mm)
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

  // Group labels into pairs of 2 for 2-row (2-across) label rolls
  const getPairedLabelRows = () => {
    const labels = getPreparedLabels();
    const rows: [typeof labels[0], (typeof labels[0]) | null][] = [];
    for (let i = 0; i < labels.length; i += 2) {
      rows.push([labels[i], labels[i + 1] || null]);
    }
    return rows;
  };

  // Handlers for Printer Code (TSPL / ZPL) with reliable fallback copy for BarTender / Zebra Setup Utilities
  const handleCopyPrinterCode = () => {
    const labels = getPreparedLabels();
    if (labels.length === 0) return;
    const code = generatePrinterCode(labels, printerCodeFormat, printConfig.labelRowType);

    const markCopied = () => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(markCopied).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          markCopied();
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        markCopied();
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleDownloadPrinterCode = () => {
    const labels = getPreparedLabels();
    if (labels.length === 0) return;
    const code = generatePrinterCode(labels, printerCodeFormat, printConfig.labelRowType);
    const itemName = (selectedBarcodeCategory?.code || selectedReconForPrint?.targetItemName || 'Tem_2x10').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    const ext = printerCodeFormat.toLowerCase();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ma_In_${printerCodeFormat}_${printConfig.labelRowType}_${itemName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Thermal Label Roll Print HTML:
  // - 1-row: 50mm x 20mm single label roll (@page { size: 50mm 20mm; margin: 0; }, Safe Margin: 1.5mm top/bottom, 2mm left/right)
  // - 2-row: 102mm x 20mm double label roll (2 x 50mm x 20mm with 2mm gap)
  const getPrintLabelHtml = (includeInteractiveToolbar = false) => {
    if (!selectedReconForPrint && !selectedBarcodeCategory) return null;

    const labels = getPreparedLabels();
    if (labels.length === 0) return null;

    const isTwoRow = printConfig.labelRowType === '2-row';
    const pageWidthMm = isTwoRow ? '102mm' : '50mm';

    const renderSingleSticker = (item: typeof labels[0] | null, extraClass = '') => {
      if (!item) {
        return `<div class="label-sticker-50x20 ${extraClass}"></div>`;
      }
      const barcodeSvg = generatePureBarcodeSvg(item.barcodeValue, 7.0, 44);
      return `
        <div class="label-sticker-50x20 ${extraClass}">
          <div class="label-header">
            <span class="header-hosp">${item.hospitalName ? item.hospitalName : ''}</span>
            ${item.index ? `<span class="index-badge">#${item.index}</span>` : ''}
          </div>
          <div class="item-name">${item.displayName}</div>
          <div class="barcode-section">
            ${barcodeSvg}
            <div class="barcode-text">${item.barcodeValue}</div>
          </div>
          <div class="label-footer">
            <span>LOT:${item.lot || '---'}</span>
            <span>HSD:${item.expiry || '---'}</span>
          </div>
        </div>
      `;
    };

    const labelsHtml = isTwoRow
      ? getPairedLabelRows().map(([left, right]) => `
          <div class="label-row-2col">
            ${renderSingleSticker(left)}
            ${renderSingleSticker(right)}
          </div>
        `).join('')
      : labels.map((item) => renderSingleSticker(item, 'single-page-break')).join('');

    const toolbarHtml = includeInteractiveToolbar
      ? `
      <div class="no-print" style="background:#0f172a;color:#f8fafc;padding:12px 16px;font-family:system-ui,sans-serif;border-bottom:2px solid #14b8a6;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
        <div style="font-size:12px;line-height:1.5;">
          <div style="font-weight:800;color:#5eead4;font-size:13px;">🖨️ CỬA SỔ IN TEM NHÃN NHIỆT ĐỘC LẬP (${isTwoRow ? '102 × 20 mm - 2 Hàng Tem' : '50 × 20 mm - 1 Hàng Tem'})</div>
          <div>Kiểm tra nhanh: <b>Paper Size:</b> ${isTwoRow ? '102×20mm (hoặc 100×20mm)' : '50×20mm'} &nbsp;|&nbsp; <b>Margins:</b> None (Không lề) &nbsp;|&nbsp; <b>Scale:</b> 100% (Không Fit to Page)</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="window.focus();window.print();" style="background:#0d9488;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;">🖨️ Bấm để In ngay</button>
          <button onclick="window.close();" style="background:#334155;color:#e2e8f0;border:none;padding:8px 12px;border-radius:8px;font-weight:600;font-size:12px;cursor:pointer;">✕ Đóng</button>
        </div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            try {
              window.focus();
              window.print();
            } catch (e) {
              console.error(e);
            }
          }, 180);
        };
      </script>
      `
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>In_Tem_50x20mm_${isTwoRow ? '2_Hang_Tem' : '1_Hang_Tem'}</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      margin: 0;
      padding: 0;
    }
    @page {
      size: ${pageWidthMm} 20mm !important;
      margin: 0 !important;
    }
    @media screen {
      body {
        background: ${includeInteractiveToolbar ? '#1e293b' : '#ffffff'};
      }
      .print-labels-wrapper {
        margin: ${includeInteractiveToolbar ? '20px auto' : '0'};
        width: ${pageWidthMm};
        display: flex;
        flex-direction: column;
        gap: ${includeInteractiveToolbar ? '8px' : '0'};
      }
    }
    @media print {
      @page {
        size: ${pageWidthMm} 20mm !important;
        margin: 0 !important;
      }
      html, body {
        width: ${pageWidthMm} !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .no-print {
        display: none !important;
      }
      .print-labels-wrapper {
        width: ${pageWidthMm} !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
      .single-page-break, .label-row-2col {
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .single-page-break:last-child, .label-row-2col:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }
    html, body {
      margin: 0;
      padding: 0;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      -webkit-font-smoothing: none;
    }
    .label-sticker-50x20 {
      width: 50mm;
      height: 20mm;
      max-width: 50mm;
      max-height: 20mm;
      padding: 1.5mm 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #ffffff;
      color: #000000;
    }
    .single-page-break {
      page-break-after: always;
      break-after: page;
    }
    .label-row-2col {
      width: 102mm;
      height: 20mm;
      display: grid;
      grid-template-columns: 50mm 50mm;
      column-gap: 2mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      background: #ffffff;
    }
    .label-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      line-height: 1;
    }
    .header-hosp {
      font-size: 6.2px;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 35mm;
      color: #000000;
    }
    .index-badge {
      font-size: 6.8px;
      font-weight: 900;
      color: #000000;
      line-height: 1;
    }
    .item-name {
      font-size: 8px;
      font-weight: 900;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 46mm;
      line-height: 1.05;
      color: #000000;
    }
    .barcode-section {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0;
    }
    .barcode-section svg {
      display: block !important;
      margin: 0 auto !important;
      height: 7.0mm !important;
      max-width: 44mm !important;
      shape-rendering: crispEdges !important;
      overflow: visible !important;
    }
    .barcode-section svg path,
    .barcode-section svg rect {
      fill: #000000 !important;
      shape-rendering: crispEdges !important;
    }
    .barcode-text {
      font-size: 6.8px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-weight: 900;
      letter-spacing: 0.4px;
      line-height: 1;
      margin-top: 0.2mm;
      text-align: center;
      color: #000000;
    }
    .label-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6px;
      font-weight: 700;
      border-top: 0.4px solid #000000;
      padding-top: 0.3mm;
      line-height: 1;
      width: 100%;
      color: #000000;
    }
  </style>
</head>
<body>
  ${toolbarHtml}
  <div class="print-labels-wrapper">
    ${labelsHtml}
  </div>
</body>
</html>`;
  };

  const handleDownloadPrintHtml = () => {
    const html = getPrintLabelHtml(true);
    if (!html) return;
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const itemName = (selectedBarcodeCategory?.code || selectedReconForPrint?.targetItemName || 'Tem_50x20').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      a.download = `In_Tem_50x20mm_${printConfig.labelRowType}_${itemName}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Open standalone unsandboxed print window (escapes iframe sandbox restrictions)
  const handleOpenPrintWindow = (): boolean => {
    const htmlWithToolbar = getPrintLabelHtml(true);
    if (!htmlWithToolbar) return false;
    try {
      const printWin = window.open('', '_blank', 'width=860,height=640');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlWithToolbar);
        printWin.document.close();
        printWin.focus();
        return true;
      }
    } catch (err) {
      console.warn('Popup print window error:', err);
    }
    return false;
  };

  // Synchronous Hidden Iframe Print
  const executeHiddenIframePrint = () => {
    const html = getPrintLabelHtml(false);
    if (!html) return;

    try {
      const existingIframe = document.getElementById('thermal-print-hidden-iframe') as HTMLIFrameElement | null;
      if (existingIframe && existingIframe.parentNode) {
        existingIframe.parentNode.removeChild(existingIframe);
      }

      const printFrame = document.createElement('iframe');
      printFrame.id = 'thermal-print-hidden-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.left = '-9999px';
      printFrame.style.top = '0';
      printFrame.style.width = printConfig.labelRowType === '2-row' ? '102mm' : '50mm';
      printFrame.style.height = '20mm';
      printFrame.style.border = '0';
      printFrame.style.visibility = 'visible';
      document.body.appendChild(printFrame);

      const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (doc && printFrame.contentWindow) {
        doc.open();
        doc.write(html);
        doc.close();
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        return;
      }
    } catch (err) {
      console.warn('Hidden iframe print fallback to window.print():', err);
    }

    window.focus();
    window.print();
  };

  // Trigger print synchronously on user click gesture (preserves 100% transient user activation
  // and prints the isolated #thermal-print-portal mounted directly on document.body)
  const handlePrintAction = () => {
    window.focus();
    window.print();
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
                Định nghĩa sẵn các từ viết tắt và tên của Calib/QC để kết hợp tự động in mã vạch chuẩn Form 2x10.
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

      {/* ================= MODAL: PRINT BARCODE LABELS (FORM 2x10 - 100x20 mm & PRINTER CODE) ================= */}
      {isPrintModalOpen && (selectedReconForPrint || selectedBarcodeCategory) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 relative animate-fade-in flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 text-lg font-bold">
                  🏷️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                    In Tem Nhãn Mã Vạch - Form 2x10 cm
                    <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-teal-200">
                      Khổ tem: 100 × 20 mm
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    In trực tiếp cuộn decal tem 100×20mm hoặc xuất mã lệnh máy in (TSPL / ZPL) truyền thẳng vào máy in tem.
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
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Tab Switcher: Direct Print vs Printer Code */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
              <button
                type="button"
                onClick={() => setPrintModalTab('label')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                  printModalTab === 'label'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Printer className="h-4 w-4" /> 🏷️ In tem trực tiếp (Khổ 100 × 20 mm)
              </button>
              <button
                type="button"
                onClick={() => setPrintModalTab('code')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                  printModalTab === 'code'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Code className="h-4 w-4" /> 💻 Xem & Xuất Mã Code máy in (TSPL / ZPL)
              </button>
            </div>

            {printModalTab === 'label' ? (
              /* TAB 1: DIRECT LABEL PRINTING */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-y-auto min-h-0 pr-1">
                
                {/* Left Settings Panel */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5">
                    <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cấu hình tem 50 × 20 mm</span>
                      <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        {printConfig.labelRowType === '2-row' ? '2 tem/hàng (102×20mm)' : '1 tem/hàng (50×20mm)'}
                      </span>
                    </div>

                    {/* Label Roll Row Type Selector: 1-row (50x20mm) vs 2-row (2 x 50x20mm) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Loại cuộn tem (Số hàng tem) *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPrintConfig({ ...printConfig, labelRowType: '1-row' })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                            printConfig.labelRowType === '1-row'
                              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/40'
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            <span>Loại 1 hàng tem</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${printConfig.labelRowType === '1-row' ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'}`}>1 tem/hàng</span>
                          </div>
                          <span className={`text-[10px] ${printConfig.labelRowType === '1-row' ? 'text-teal-100' : 'text-slate-500'}`}>
                            Cuộn đơn 50 × 20 mm (Gap 2mm)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrintConfig({ ...printConfig, labelRowType: '2-row' })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                            printConfig.labelRowType === '2-row'
                              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/40'
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            <span>Loại 2 hàng tem</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${printConfig.labelRowType === '2-row' ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'}`}>2 tem/hàng</span>
                          </div>
                          <span className={`text-[10px] ${printConfig.labelRowType === '2-row' ? 'text-teal-100' : 'text-slate-500'}`}>
                            Cuộn đôi 2 × (50 × 20 mm)
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Template selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Mã QC viết tắt *</label>
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
                    </div>

                    {/* Quantity and Quick count buttons */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Số lượng tem cần in</label>
                        <span className="text-[10px] font-bold text-teal-700">
                          {printConfig.customCount || selectedReconForPrint?.remainingAliquots || 1} tem
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={printConfig.customCount || selectedReconForPrint?.remainingAliquots || 1}
                        onChange={(e) => setPrintConfig({...printConfig, customCount: Math.max(1, parseInt(e.target.value) || 1)})}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-bold text-slate-800"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setPrintConfig({...printConfig, customCount: 1})}
                          className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                        >
                          1 tem
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintConfig({...printConfig, customCount: 5})}
                          className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                        >
                          5 tem
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintConfig({...printConfig, customCount: 10})}
                          className="px-2.5 py-1 text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg transition-all cursor-pointer"
                        >
                          10 tem
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintConfig({...printConfig, customCount: 20})}
                          className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                        >
                          20 tem
                        </button>
                        {selectedReconForPrint && selectedReconForPrint.remainingAliquots !== undefined && (
                          <button
                            type="button"
                            onClick={() => setPrintConfig({...printConfig, customCount: selectedReconForPrint.remainingAliquots || 1})}
                            className="px-2.5 py-1 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-all cursor-pointer"
                          >
                            Số tuýp còn lại ({selectedReconForPrint.remainingAliquots})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          id="toggle-form-index"
                          checked={printConfig.includeIndex}
                          onChange={(e) => setPrintConfig({...printConfig, includeIndex: e.target.checked})}
                          className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                        />
                        <label htmlFor="toggle-form-index" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                          Đánh số thứ tự tuýp tự động (#01, #02, #03...)
                        </label>
                      </div>

                      {selectedReconForPrint && selectedReconForPrint.lotNumber && (
                        <div className="flex items-center gap-2 py-0.5">
                          <input
                            type="checkbox"
                            id="toggle-form-lot"
                            checked={printConfig.includeLot}
                            onChange={(e) => setPrintConfig({...printConfig, includeLot: e.target.checked})}
                            className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                          />
                          <label htmlFor="toggle-form-lot" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                            Ghép kèm Số lô gốc ({selectedReconForPrint.lotNumber}) vào mã Barcode
                          </label>
                        </div>
                      )}

                      <div className="pt-1">
                        <div className="flex items-center gap-2 py-0.5">
                          <input
                            type="checkbox"
                            id="toggle-form-hospital"
                            checked={printConfig.includeHospital}
                            onChange={(e) => setPrintConfig({...printConfig, includeHospital: e.target.checked})}
                            className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                          />
                          <label htmlFor="toggle-form-hospital" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                            Hiện tiêu đề Tên đơn vị / Bệnh viện
                          </label>
                        </div>
                        {printConfig.includeHospital && (
                          <input
                            type="text"
                            value={printConfig.hospitalName}
                            onChange={(e) => setPrintConfig({...printConfig, hospitalName: e.target.value})}
                            placeholder="Tên BV / Phòng xét nghiệm..."
                            className="w-full mt-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-medium"
                          />
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Thermal Printer Advice */}
                  <div className="bg-teal-50 border border-teal-200 p-3 rounded-2xl text-[11px] text-teal-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-teal-950">
                      <span>💡 Hướng dẫn in trực tiếp chuẩn Khổ 2x10 cm (100×20 mm):</span>
                    </div>
                    <p>1. Trong hộp thoại in của trình duyệt (Ctrl+P):</p>
                    <div className="bg-white/80 p-2 rounded-lg border border-teal-100 text-[10.5px] space-y-0.5 font-medium">
                      <div>• <strong>Khổ giấy (Paper size):</strong> Chọn <strong>100 × 20 mm</strong> (hoặc Custom / User-Defined).</div>
                      <div>• <strong>Lề (Margins):</strong> Chọn <strong>Không có (None)</strong>.</div>
                      <div>• <strong>Tỷ lệ (Scale):</strong> Chọn <strong>100%</strong> (hoặc Vừa trang).</div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Nếu máy in nhiệt của bạn dùng phần mềm chuyên dụng, chuyển sang tab <strong>"Xem & Xuất Mã Code máy in"</strong> để lấy mã TSPL/ZPL.
                    </p>
                  </div>
                </div>

                {/* Right Live Preview Panel */}
                <div className="lg:col-span-7 bg-slate-100 border border-slate-200 rounded-2xl p-4 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3 shrink-0 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        📺 Xem trước cuộn tem ({printConfig.labelRowType === '2-row' ? 'Loại 2 hàng tem · 2 tem/hàng' : 'Loại 1 hàng tem · 1 tem/hàng'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full text-emerald-800 bg-emerald-50 border border-emerald-200">
                        {printConfig.labelRowType === '2-row' ? '2 × (50×20 mm) / hàng' : '100 × 20 mm / hàng'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                        {getPreparedLabels().length} tem ({printConfig.labelRowType === '2-row' ? `${Math.ceil(getPreparedLabels().length / 2)} hàng` : `${getPreparedLabels().length} hàng`})
                      </span>
                    </div>
                  </div>

                  {/* Label preview area */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-200 rounded-xl min-h-[360px] max-h-[500px]">
                    {(() => {
                      const labels = getPreparedLabels();
                      if (labels.length === 0) {
                        return (
                          <div className="text-center py-12 text-slate-400 text-xs italic">
                            Chưa có tem nào được chọn.
                          </div>
                        );
                      }

                      if (printConfig.labelRowType === '2-row') {
                        const pairedRows = getPairedLabelRows();
                        return pairedRows.map((pair, rowIdx) => (
                          <div
                            key={rowIdx}
                            className="grid grid-cols-2 gap-2.5 mx-auto max-w-[460px] bg-slate-300/60 p-1.5 rounded-xl border border-dashed border-slate-400"
                          >
                            {pair.map((item, colIdx) =>
                              item ? (
                                <div
                                  key={colIdx}
                                  className="bg-white rounded-lg shadow-xs border border-slate-300 p-2 transition-all hover:border-teal-500"
                                >
                                  <div className="flex items-center justify-between text-[7.5px] font-bold text-slate-900 border-b border-slate-200 pb-0.5 leading-none">
                                    <span className="truncate max-w-[115px] uppercase">{item.hospitalName || 'Khoa XN'}</span>
                                    {item.index && <span className="text-teal-700 font-extrabold">#{item.index}</span>}
                                  </div>
                                  <div className="text-[8.5px] font-bold text-slate-950 truncate mt-0.5 leading-tight">
                                    {item.displayName}
                                  </div>
                                  <div className="my-1 flex flex-col items-center justify-center">
                                    <BarcodeRenderer
                                      value={item.barcodeValue}
                                      heightMm={7.0}
                                      maxWidthMm={40}
                                      isVertical={false}
                                    />
                                    <div className="text-[7px] font-mono font-black text-slate-900 tracking-wide mt-0.5 leading-none">
                                      {item.barcodeValue}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-[6.5px] font-bold text-slate-700 border-t border-slate-800 pt-0.5 mt-0.5 leading-none">
                                    <span>LOT:{item.lot || '--'}</span>
                                    <span>HSD:{item.expiry}</span>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  key={colIdx}
                                  className="bg-slate-200/50 rounded-lg border border-dashed border-slate-300 p-2 flex items-center justify-center text-[10px] text-slate-400 italic"
                                >
                                  (Tem trống)
                                </div>
                              )
                            )}
                          </div>
                        ));
                      }

                      return labels.map((item, idx) => (
                        <div 
                          key={idx}
                          className="bg-white rounded-lg shadow-sm border border-slate-300 p-2.5 mx-auto max-w-[420px] transition-all hover:border-teal-500 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between text-[8px] font-bold text-slate-900 border-b border-slate-200 pb-0.5 leading-none">
                            <span className="truncate max-w-[240px] uppercase">{item.hospitalName || 'Khoa Xét Nghiệm'}</span>
                            {item.index && <span className="text-teal-700 font-extrabold">Tuýp #{item.index}</span>}
                          </div>
                          <div className="text-[10px] font-bold text-slate-950 truncate mt-1 leading-tight">
                            {item.displayName}
                          </div>
                          <div className="my-1.5 flex flex-col items-center justify-center">
                            <BarcodeRenderer 
                              value={item.barcodeValue} 
                              heightMm={7.8}
                              maxWidthMm={68}
                              isVertical={false}
                            />
                            <div className="text-[8px] font-mono font-black text-slate-900 tracking-wider mt-0.5 leading-none">
                              {item.barcodeValue}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] font-bold text-slate-700 border-t border-slate-800 pt-1 mt-0.5 leading-none">
                            <span>LOT: {item.lot || '---'}</span>
                            <span>HSD: {item.expiry}</span>
                            <span>{item.preparedBy ? `KTV: ${item.preparedBy}` : ''}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

              </div>
            ) : (
              /* TAB 2: PRINTER CODE (TSPL / ZPL) */
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Ngôn ngữ lệnh máy in
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrinterCodeFormat('TSPL')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            printerCodeFormat === 'TSPL'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          TSPL (Xprinter, TSC, Godex, Gprinter...)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrinterCodeFormat('ZPL')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            printerCodeFormat === 'ZPL'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          ZPL (Zebra)
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Loại cuộn tem (Số hàng tem)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrintConfig({ ...printConfig, labelRowType: '1-row' })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            printConfig.labelRowType === '1-row'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Loại 1 hàng tem (50×20mm)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintConfig({ ...printConfig, labelRowType: '2-row' })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            printConfig.labelRowType === '2-row'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Loại 2 hàng tem (2×50×20mm)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                      {printConfig.labelRowType === '2-row'
                        ? `Khổ 102×20mm (2 tem/hàng) · ${getPreparedLabels().length} tem (${Math.ceil(getPreparedLabels().length / 2)} lệnh PRINT)`
                        : `Khổ 50×20mm (1 tem/hàng) · ${getPreparedLabels().length} lệnh PRINT`}
                    </span>
                  </div>
                </div>

                {/* Code Block Container */}
                <div className="relative">
                  <div className="flex items-center justify-between bg-slate-800 text-slate-300 px-4 py-2 rounded-t-xl text-xs font-mono">
                    <span>
                      Mã lệnh in {printerCodeFormat} ({printConfig.labelRowType === '2-row' ? 'Loại 2 hàng tem - SIZE 102x20mm / ^PW816' : 'Loại 1 hàng tem - SIZE 50x20mm / ^PW400'})
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">✓ Chuẩn ASCII không dấu (BarTender / Zebra Ready)</span>
                  </div>
                  <pre className="bg-slate-900 text-emerald-400 p-4 rounded-b-xl font-mono text-xs overflow-x-auto max-h-[360px] select-all leading-relaxed">
                    {generatePrinterCode(getPreparedLabels(), printerCodeFormat, printConfig.labelRowType)}
                  </pre>
                </div>

                {/* Integration advice */}
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <span>💡 Cách sử dụng mã code in (Đã lọc sạch dấu tiếng Việt bằng removeAccents):</span>
                  </div>
                  <div>• <strong>TSC / Xprinter / Godex (TSPL):</strong> Dán trực tiếp vào <em>BarTender</em>, <em>DiagTool</em> hoặc <em>TSC Console</em> (SIZE 50x20mm, GAP 2mm, BARCODE 128).</div>
                  <div>• <strong>Zebra (ZPL):</strong> Mở <em>Zebra Setup Utilities</em> ➔ <em>Open Communication With Printer</em> ➔ Dán mã ZPL (^PW400, ^LL160, ^BCN) và bấm <em>Send to Printer</em>.</div>
                  <div>• <strong>Tự động hóa:</strong> Nhúng file mã in vào phần mềm LIS/HIS gửi qua socket TCP port 9100 để in tự động.</div>
                </div>
              </div>
            )}

            {/* Pre-Print Checklist Reminder Banner (Always visible before printing) */}
            {printModalTab === 'label' && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Kiểm tra hộp thoại In:</strong> Khổ giấy (Paper Size):{' '}
                    <strong className="text-teal-800 underline">
                      {printConfig.labelRowType === '2-row' ? '102 × 20 mm (hoặc 100 × 20 mm)' : '50 × 20 mm'}
                    </strong>{' '}
                    · Lề (Margins): <strong>None</strong> · Tỷ lệ (Scale): <strong className="text-rose-600">100%</strong> (Không chọn Fit to Page)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrePrintOverlayOpen(true)}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer shrink-0"
                >
                  Xem hướng dẫn chi tiết
                </button>
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Khổ tem chuẩn: <strong>{printConfig.labelRowType === '2-row' ? '102 × 20 mm (2 tem 50×20mm, Gap 2mm)' : '50 × 20 mm (1 tem đơn, Gap 2mm, Safe Margin 1.5–2mm)'}</strong>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {printModalTab === 'code' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadPrinterCode}
                      className="px-4 py-2 text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-all cursor-pointer font-bold border border-teal-200 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Tải file mã in (.{printerCodeFormat.toLowerCase()})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPrinterCode}
                      className="px-5 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      {copiedCode ? <CheckCircle className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedCode ? 'Đã sao chép mã!' : 'Sao chép mã Code'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadPrintHtml}
                      className="px-3 py-2 text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-all cursor-pointer font-bold border border-teal-200 flex items-center gap-1.5 shadow-2xs"
                      title="Tải file HTML chuẩn khổ 50x20mm để mở trên mọi máy tính hoặc in offline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Tải file HTML</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPrintWindow}
                      className="px-3 py-2 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer font-bold border border-indigo-200 flex items-center gap-1.5 shadow-2xs"
                      title="Mở cửa sổ in độc lập trong tab mới"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>Mở Tab In Riêng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPrintModalOpen(false);
                        setIsPrePrintOverlayOpen(false);
                        setSelectedReconForPrint(null);
                        setSelectedBarcodeCategory(null);
                      }}
                      className="px-3.5 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200 font-semibold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintAction}
                      className="px-6 py-2.5 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-md hover:shadow-lg flex items-center gap-2 text-sm"
                    >
                      <Printer className="h-4 w-4" /> BẮT ĐẦU IN ({printConfig.labelRowType === '2-row' ? '2 × 50×20 mm' : '50 × 20 mm'})
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ================= PRE-PRINT REMINDER OVERLAY (HƯỚNG DẪN KIỂM TRA NHANH TRƯỚC KHI IN) ================= */}
            {isPrePrintOverlayOpen && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fade-in">
                <div className="bg-white rounded-3xl border-2 border-teal-500 max-w-lg w-full p-6 shadow-2xl space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-lg">
                        ⚠️
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                          Kiểm tra nhanh thông số Hộp thoại In
                        </h4>
                        <p className="text-[11px] text-teal-700 font-semibold">
                          Môi trường in đã được cô lập hoàn toàn chuẩn kích thước tem
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPrePrintOverlayOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-4 space-y-2.5 text-xs text-slate-800">
                    <div className="flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-teal-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <div>
                        <span className="font-bold text-slate-900">Khổ giấy (Paper Size): </span>
                        Chọn đúng <strong className="text-teal-800 underline">{printConfig.labelRowType === '2-row' ? '102 × 20 mm (hoặc 100 × 20 mm)' : '50 × 20 mm (5 × 2 cm)'}</strong> trong mục <em>More settings</em> của máy in nhiệt.
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-teal-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <div>
                        <span className="font-bold text-slate-900">Lề trang (Margins): </span>
                        Bắt buộc chọn <strong className="text-teal-800">None (Không có)</strong> hoặc <strong className="text-teal-800">Minimum</strong> (lề an toàn 1.5–2mm đã được căn sẵn trong tem).
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-teal-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div>
                        <span className="font-bold text-slate-900">Tỷ lệ (Scale): </span>
                        Giữ nguyên <strong className="text-rose-600">100% (Default / Actual Size)</strong> — <em>Tuyệt đối không chọn Fit to page / Fit to printable area</em>.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsPrePrintOverlayOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
                    >
                      Đóng thông báo
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPrintWindow}
                      className="px-4 py-2 text-xs font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 rounded-xl border border-teal-300 flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <ArrowUpRight className="h-4 w-4" /> Mở Tab In Riêng
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintAction}
                      className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Printer className="h-4 w-4" /> Bấm để In ngay
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ================= PORTAL PRINT CONTAINER: DIRECT CHILD OF DOCUMENT.BODY ================= */}
      {isPrintModalOpen && (selectedReconForPrint || selectedBarcodeCategory) && typeof document !== 'undefined' && createPortal(
        <div id="thermal-print-portal" className="hidden">
          {printConfig.labelRowType === '2-row'
            ? getPairedLabelRows().map((pair, rowIdx) => (
                <div key={rowIdx} className="label-item-2x10 label-row-2col">
                  {pair.map((item, colIdx) =>
                    item ? (
                      <div key={colIdx} className="label-half-cell">
                        <div className="label-header">
                          <span className="header-hosp">{item.hospitalName ? item.hospitalName : ''}</span>
                          {item.index ? <span className="index-badge">#{item.index}</span> : null}
                        </div>
                        <div className="item-name">{item.displayName}</div>
                        <div className="barcode-section">
                          <div
                            className="w-full flex items-center justify-center"
                            dangerouslySetInnerHTML={{
                              __html: generatePureBarcodeSvg(item.barcodeValue, 7.0, 44),
                            }}
                          />
                          <div className="barcode-text">{item.barcodeValue}</div>
                        </div>
                        <div className="label-footer">
                          <span>LOT:{item.lot || '--'}</span>
                          <span>HSD:{item.expiry || '--'}</span>
                        </div>
                      </div>
                    ) : (
                      <div key={colIdx} className="label-half-cell" />
                    )
                  )}
                </div>
              ))
            : getPreparedLabels().map((item, idx) => (
                <div key={idx} className="label-item-2x10">
                  <div className="label-header">
                    <span className="header-hosp">{item.hospitalName ? item.hospitalName : ''}</span>
                    {item.index ? <span className="index-badge">#{item.index}</span> : null}
                  </div>
                  <div className="item-name">{item.displayName}</div>
                  <div className="barcode-section">
                    <div
                      className="w-full flex items-center justify-center"
                      dangerouslySetInnerHTML={{
                        __html: generatePureBarcodeSvg(item.barcodeValue, 7.0, 44),
                      }}
                    />
                    <div className="barcode-text">{item.barcodeValue}</div>
                  </div>
                  <div className="label-footer">
                    <span>LOT:{item.lot || '---'}</span>
                    <span>HSD:{item.expiry || '---'}</span>
                  </div>
                </div>
              ))}
        </div>,
        document.body
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

      {/* ================= PRINT LOG CONTAINER (PORTAL ON DOCUMENT.BODY) ================= */}
      {isPrintLogModalOpen && typeof document !== 'undefined' && createPortal(
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
        </div>,
        document.body
      )}

      {/* Dynamic Embedded Print CSS style tag */}
      <style>{`
        /* Print media styles */
        @media print {
          /* Hide main React root and all non-print portals when printing */
          body > *:not(#thermal-print-portal):not(#print-log-area) {
            display: none !important;
          }

          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #print-log-area {
            display: ${isPrintLogModalOpen ? 'block' : 'none'} !important;
            width: 100% !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #thermal-print-portal {
            display: ${isPrintModalOpen ? 'block' : 'none'} !important;
            width: ${printConfig.labelRowType === '2-row' ? '102mm' : '50mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .label-item-2x10 {
            width: 50mm !important;
            height: 20mm !important;
            max-width: 50mm !important;
            max-height: 20mm !important;
            box-sizing: border-box !important;
            padding: 1.5mm 2mm !important;
            border: none !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          .label-item-2x10.label-row-2col {
            width: 102mm !important;
            max-width: 102mm !important;
            padding: 0 !important;
            display: grid !important;
            grid-template-columns: 50mm 50mm !important;
            column-gap: 2mm !important;
            align-items: stretch !important;
          }

          .label-half-cell {
            width: 50mm !important;
            height: 20mm !important;
            max-width: 50mm !important;
            max-height: 20mm !important;
            box-sizing: border-box !important;
            padding: 1.5mm 2mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
          }

          .label-item-2x10:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .label-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            line-height: 1 !important;
          }

          .header-hosp {
            font-size: 6.2px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 35mm !important;
            color: #000000 !important;
          }

          .index-badge {
            font-size: 6.8px !important;
            font-weight: 900 !important;
            color: #000000 !important;
            line-height: 1 !important;
          }

          .item-name {
            font-size: 8px !important;
            font-weight: 900 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 46mm !important;
            line-height: 1.05 !important;
            color: #000000 !important;
          }

          .barcode-section {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 !important;
          }

          .barcode-section svg {
            display: block !important;
            margin: 0 auto !important;
            height: 7.0mm !important;
            max-width: 44mm !important;
            shape-rendering: crispEdges !important;
            overflow: visible !important;
          }

          .barcode-section svg path,
          .barcode-section svg rect {
            fill: #000000 !important;
            shape-rendering: crispEdges !important;
          }

          .barcode-text {
            font-size: 6.8px !important;
            font-family: 'Consolas', 'Courier New', monospace !important;
            font-weight: 900 !important;
            letter-spacing: 0.4px !important;
            line-height: 1 !important;
            margin-top: 0.2mm !important;
            text-align: center !important;
            color: #000000 !important;
          }

          .label-footer {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            font-size: 6px !important;
            font-weight: 700 !important;
            border-top: 0.4px solid #000000 !important;
            padding-top: 0.3mm !important;
            line-height: 1 !important;
            width: 100% !important;
            color: #000000 !important;
          }

          #thermal-print-portal svg,
          #thermal-print-portal svg * {
            shape-rendering: crispEdges !important;
          }

          /* Cố định cứng khổ giấy: 50mm x 20mm (1-row) hoặc 102mm x 20mm (2-row) */
          @page {
            size: ${isPrintLogModalOpen ? 'A4 portrait' : printConfig.labelRowType === '2-row' ? '102mm 20mm !important' : '50mm 20mm !important'};
            margin: ${isPrintLogModalOpen ? '10mm' : '0mm !important'};
          }
        }
      `}</style>

    </div>
  );
}

function BarcodeRenderer({ 
  value, 
  heightMm = 7.0,
  maxWidthMm = 44,
}: { 
  value: string; 
  heightMm?: number;
  maxWidthMm?: number;
  isVertical?: boolean;
  width?: number; 
  height?: number; 
}) {
  const cleanVal = (value || 'QC').trim();
  const svgHtml = generatePureBarcodeSvg(cleanVal, heightMm, maxWidthMm);

  return (
    <div
      className="w-full flex items-center justify-center text-center"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
