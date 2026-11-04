import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  Activity, 
  Calendar, 
  Trash2, 
  Compass, 
  Check, 
  AlertTriangle,
  RotateCcw,
  Tag,
  Clock,
  HelpCircle,
  FileText,
  FileSpreadsheet,
  Printer,
  X,
  Download,
  Copy,
  Code,
  CheckCircle,
  ArrowUpRight
} from 'lucide-react';
import { InUseStability, ReagentMaterial, LabCategory, User, BarcodeCategory, SystemSettings } from '../types';
import { formatDateVN, exportToExcel, exportToPDF } from '../utils';
import JsBarcode from 'jsbarcode';

// Remove Vietnamese accents and sanitize special characters for thermal barcode printer compatibility (CP437 / ASCII)
function removeAccents(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/["^~]/g, '') // Strip TSPL/ZPL control delimiters so commands never break in BarTender / Diagnostic Tool
    .replace(/[^\x20-\x7E]/g, '') // Ensure strict printable ASCII
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
    const pairs: (typeof labels)[] = [];
    for (let i = 0; i < labels.length; i += 2) {
      pairs.push(labels.slice(i, i + 2));
    }

    if (format === 'TSPL') {
      return pairs.map((pair) => {
        const lines: string[] = [
          `SIZE 102 mm, 20 mm`,
          `GAP 2 mm, 0 mm`,
          `DIRECTION 1`,
          `CLS`
        ];
        pair.forEach((lbl, colIdx) => {
          const xOffset = colIdx === 0 ? 16 : 424;
          const cleanHosp = removeAccents(lbl.hospitalName || 'BVDK TP CAN THO').slice(0, 22);
          const cleanName = removeAccents(lbl.displayName || 'HOA CHAT').slice(0, 24);
          const cleanLot = removeAccents(lbl.lot ? `LOT:${lbl.lot}` : '');
          const cleanExp = removeAccents(lbl.expiry ? `HSD:${lbl.expiry}` : '');
          const cleanIndex = lbl.index ? `#${lbl.index}` : '';
          const footText = [cleanLot, cleanExp].filter(Boolean).join(' ');

          lines.push(`TEXT ${xOffset},12,"1",0,1,1,"${cleanHosp}${cleanIndex ? ' ' + cleanIndex : ''}"`);
          lines.push(`TEXT ${xOffset},28,"2",0,1,1,"${cleanName}"`);
          lines.push(`BARCODE ${xOffset},48,"128",40,1,0,2,2,"${lbl.barcodeValue}"`);
          lines.push(`TEXT ${xOffset},114,"1",0,1,1,"${footText}"`);
        });
        lines.push(`PRINT 1,1`);
        return lines.join('\n');
      }).join('\n\n');
    } else {
      return pairs.map((pair) => {
        const lines: string[] = [
          `^XA`,
          `^PW816`,
          `^LL160`
        ];
        pair.forEach((lbl, colIdx) => {
          const xOffset = colIdx === 0 ? 16 : 424;
          const cleanHosp = removeAccents(lbl.hospitalName || 'BVDK TP CAN THO').slice(0, 22);
          const cleanName = removeAccents(lbl.displayName || 'HOA CHAT').slice(0, 24);
          const cleanLot = removeAccents(lbl.lot ? `LOT:${lbl.lot}` : '');
          const cleanExp = removeAccents(lbl.expiry ? `HSD:${lbl.expiry}` : '');
          const cleanIndex = lbl.index ? `#${lbl.index}` : '';
          const footText = [cleanLot, cleanExp].filter(Boolean).join(' ');

          lines.push(`^FO${xOffset},12^A0N,15,15^FD${cleanHosp}${cleanIndex ? ' ' + cleanIndex : ''}^FS`);
          lines.push(`^FO${xOffset},29^A0N,18,18^FD${cleanName}^FS`);
          lines.push(`^FO${xOffset},50^BY2,2,38^BCN,38,Y,N,N^FD${lbl.barcodeValue}^FS`);
          lines.push(`^FO${xOffset},114^A0N,15,15^FD${footText}^FS`);
        });
        lines.push(`^XZ`);
        return lines.join('\n');
      }).join('\n');
    }
  }

  // 1-ROW: Single Label Roll 50mm x 20mm, Gap 2mm (203 DPI: 400 x 160 dots, Safe Margin: 1.5mm - 2mm = 12 - 16 dots)
  if (format === 'TSPL') {
    return labels.map((lbl) => {
      const cleanHosp = removeAccents(lbl.hospitalName || 'BVDK TP CAN THO').slice(0, 22);
      const cleanName = removeAccents(lbl.displayName || 'HOA CHAT MO NAP').slice(0, 24);
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
      const cleanName = removeAccents(lbl.displayName || 'HOA CHAT MO NAP').slice(0, 24);
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
    const cleanVal = (value || 'HC').trim();
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    JsBarcode(svgNode, cleanVal, {
      format: 'CODE128',
      width: 2,
      height: 40,
      displayValue: false,
      margin: 0,
      background: 'transparent',
      lineColor: '#000000',
    });

    const vbAttr = svgNode.getAttribute('viewBox') || '';
    const vbParts = vbAttr.trim().split(/\s+/).map(Number);
    const widthAttr = parseFloat(svgNode.getAttribute('width') || '160') || 160;
    const heightAttr = parseFloat(svgNode.getAttribute('height') || '40') || 40;
    const vbWidth = vbParts.length === 4 && vbParts[2] > 0 ? vbParts[2] : widthAttr;
    const vbHeight = vbParts.length === 4 && vbParts[3] > 0 ? vbParts[3] : heightAttr;

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

interface InUseStabilityTabProps {
  inUseStability: InUseStability[];
  reagents: ReagentMaterial[];
  simulatedTime: string; // ISO String
  onAddInUseStability: (reagentId: string, openedBy: string, positionInMachine: string, remainingTests?: number) => void;
  onUpdateRemainingTests: (id: string, tests: number) => void;
  onUpdateInUseStatus: (id: string, status: 'active' | 'expired' | 'depleted' | 'discarded') => void;
  onDeleteInUse: (id: string) => void;
  currentUser: User;
  targetHighlight?: { tab: string; id?: string; name?: string };
  onClearHighlight?: () => void;
  barcodeCategories?: BarcodeCategory[];
  systemSettings?: SystemSettings;
}

export default function InUseStabilityTab({
  inUseStability,
  reagents,
  simulatedTime,
  onAddInUseStability,
  onUpdateRemainingTests,
  onUpdateInUseStatus,
  onDeleteInUse,
  currentUser,
  targetHighlight,
  onClearHighlight,
  barcodeCategories = [],
  systemSettings,
}: InUseStabilityTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpdateTestsModalOpen, setIsUpdateTestsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InUseStability | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<LabCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'active' | 'expired' | 'completed'>('All');

  // Selection state for export
  const [selectedInUseIds, setSelectedInUseIds] = useState<string[]>([]);

  useEffect(() => {
    if (inUseStability && inUseStability.length > 0) {
      setSelectedInUseIds(prev => {
        const itemIds = inUseStability.map(item => item.id);
        if (prev.length === 0) return itemIds;
        return prev.filter(id => itemIds.includes(id));
      });
    }
  }, [inUseStability]);

  // React to targetHighlight
  useEffect(() => {
    if (targetHighlight) {
      setCategoryFilter('All');
      setStatusFilter('All');
      
      const timer = setTimeout(() => {
        const element = document.getElementById(`inuse-row-${targetHighlight.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetHighlight]);

  // Form states for manual open
  const [addReagentId, setAddReagentId] = useState('');
  const [addOpenedBy, setAddOpenedBy] = useState(currentUser?.fullName || '');
  const [addPosition, setAddPosition] = useState('');
  const [addTests, setAddTests] = useState<number | undefined>(undefined);

  // Keep state in sync with currentUser
  React.useEffect(() => {
    if (currentUser?.fullName) {
      setAddOpenedBy(currentUser.fullName);
    }
  }, [currentUser]);

  // Form states for test updates
  const [newTestsCount, setNewTestsCount] = useState(100);

  // Barcode Print States (Form 2x10 - 100x20 mm & TSPL/ZPL Code)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedInUseForPrint, setSelectedInUseForPrint] = useState<InUseStability | null>(null);
  const [selectedBarcodeCategory, setSelectedBarcodeCategory] = useState<BarcodeCategory | null>(null);
  const [printModalTab, setPrintModalTab] = useState<'label' | 'code'>('label');
  const [printerCodeFormat, setPrinterCodeFormat] = useState<'TSPL' | 'ZPL'>('TSPL');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isPrePrintOverlayOpen, setIsPrePrintOverlayOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    hospitalName: 'BVĐK TP Cần Thơ - Khoa XN',
    includeHospital: true,
    includeLot: false,
    includeIndex: false,
    customCount: 1,
    labelRowType: '1-row' as '1-row' | '2-row',
  });

  const simulatedDateStr = simulatedTime.slice(0, 10);
  const simulatedDate = new Date(simulatedDateStr);

  // Filter logic
  const filteredInUse = inUseStability.filter(item => {
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    
    let matchesStatus = true;
    const isExpired = new Date(item.calculatedExpiry) <= simulatedDate;

    if (statusFilter === 'active') {
      matchesStatus = item.status === 'active' && !isExpired;
    } else if (statusFilter === 'expired') {
      matchesStatus = item.status === 'active' && isExpired;
    } else if (statusFilter === 'completed') {
      matchesStatus = item.status === 'depleted' || item.status === 'discarded';
    }

    return matchesCategory && matchesStatus;
  }).sort((a, b) => new Date(b.openedDate).getTime() - new Date(a.openedDate).getTime());

  const filteredIds = filteredInUse.map(item => item.id);
  const selectedFilteredIds = filteredIds.filter(id => selectedInUseIds.includes(id));
  const isAllFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedInUseIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedInUseIds(prev => {
        const next = [...prev];
        filteredIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedInUseIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExportPDFReport = () => {
    const headers = ['Hóa chất xét nghiệm', 'Khoa phòng', 'Số lô (LOT)', 'Vị trí máy', 'Ngày mở nắp', 'Hạn dùng gốc', 'Hạn mở nắp tối đa', 'Số test còn lại', 'Trạng thái'];
    const keys = ['reagentName', 'category', 'lotNumber', 'positionInMachine', 'openedDate', 'originalExpiryDate', 'calculatedExpiry', 'testsInfo', 'statusDisplay'];
    const formatters = {
      openedDate: (val: any) => formatDateVN(val),
      originalExpiryDate: (val: any) => formatDateVN(val),
      calculatedExpiry: (val: any) => formatDateVN(val),
      testsInfo: (val: any, row: any) => row.remainingTests !== undefined ? `${row.remainingTests} / ${row.totalTests || '—'}` : '—',
      statusDisplay: (val: any, row: any) => {
        const isExpired = new Date(row.calculatedExpiry) <= simulatedDate;
        if (row.status === 'active') {
          return isExpired ? 'Đã quá hạn' : 'Đang hoạt động';
        }
        return row.status === 'depleted' ? 'Đã dùng hết' : 'Đã hủy bỏ';
      }
    };
    const exportData = filteredInUse.filter(item => selectedInUseIds.includes(item.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một hóa chất để xuất PDF!');
      return;
    }
    exportToPDF('BÁO CÁO GIÁM SÁT HẠN DÙNG SAU MỞ NẮP (IN-USE STABILITY)', headers, keys, exportData, formatters, systemSettings);
  };

  const handleExportExcelReport = () => {
    const headers = ['Hóa chất xét nghiệm', 'Khoa phòng', 'Số lô (LOT)', 'Vị trí máy', 'Ngày mở nắp', 'Hạn dùng gốc', 'Hạn mở nắp tối đa', 'Số test còn lại', 'Trạng thái'];
    const keys = ['reagentName', 'category', 'lotNumber', 'positionInMachine', 'openedDate', 'originalExpiryDate', 'calculatedExpiry', 'testsInfo', 'statusDisplay'];
    const formatters = {
      openedDate: (val: any) => formatDateVN(val),
      originalExpiryDate: (val: any) => formatDateVN(val),
      calculatedExpiry: (val: any) => formatDateVN(val),
      testsInfo: (val: any, row: any) => row.remainingTests !== undefined ? `${row.remainingTests} / ${row.totalTests || '—'}` : '—',
      statusDisplay: (val: any, row: any) => {
        const isExpired = new Date(row.calculatedExpiry) <= simulatedDate;
        if (row.status === 'active') {
          return isExpired ? 'Đã quá hạn mở nắp' : 'Đang hoạt động';
        }
        return row.status === 'depleted' ? 'Đã dùng hết' : 'Đã hủy bỏ';
      }
    };
    const exportData = filteredInUse.filter(item => selectedInUseIds.includes(item.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một hóa chất để xuất Excel!');
      return;
    }
    exportToExcel(exportData, headers, keys, 'Han_Mo_Nap_InUse_ISO_15189', formatters);
  };

  // Handle open Add Modal
  const openAddModal = () => {
    // Set first available reagent
    const selectable = reagents.filter(r => r.currentStock > 0);
    if (selectable.length > 0) {
      setAddReagentId(selectable[0].id);
      const r = selectable[0];
      setAddPosition(r.category === 'Sinh hóa' ? 'Cobas c501 - Khay R1 - Vị trí ' : 'Architect i2000SR - Vị trí ');
    } else {
      setAddReagentId('');
      setAddPosition('');
    }
    setAddOpenedBy(currentUser?.fullName || '');
    setAddTests(undefined);
    setIsAddModalOpen(true);
  };

  const handleReagentChange = (reagentId: string) => {
    setAddReagentId(reagentId);
    const r = reagents.find(item => item.id === reagentId);
    if (r) {
      setAddPosition(r.category === 'Sinh hóa' ? 'Cobas c501 - Khay R1 - Vị trí ' : 'Architect i2000SR - Vị trí ');
    }
  };

  // Submit Add
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addReagentId) {
      alert('Vui lòng chọn một hóa chất để mở nắp.');
      return;
    }
    onAddInUseStability(addReagentId, addOpenedBy, addPosition, addTests);
    setIsAddModalOpen(false);
  };

  // --- PRINT BARCODE LABELS HANDLERS ---
  // --- PRINT BARCODE LABELS HANDLERS (UNIVERSAL FORM 2x10) ---
  const openPrintModal = (item: InUseStability) => {
    setSelectedInUseForPrint(item);
    // Find matching barcode category template by comparing text or linked category code
    const matchingReagent = reagents.find(r => r.id === item.reagentId);
    const matched = barcodeCategories.find(bc => 
      bc.code === matchingReagent?.barcodeCategoryCode ||
      item.reagentName.toLowerCase().includes(bc.name.toLowerCase()) ||
      item.reagentName.toLowerCase().includes(bc.code.toLowerCase()) ||
      bc.name.toLowerCase().includes(item.reagentName.toLowerCase())
    ) || barcodeCategories[0] || null;

    setSelectedBarcodeCategory(matched);
    setPrintConfig(prev => ({
      ...prev,
      hospitalName: 'BVĐK TP Cần Thơ - Khoa XN',
      includeHospital: true,
      includeLot: false,
      includeIndex: false,
      customCount: 1,
    }));
    setIsPrintModalOpen(true);
  };

  const getPreparedLabels = () => {
    if (!selectedInUseForPrint && !selectedBarcodeCategory) return [];

    const labelCount = printConfig.customCount || 1;
    const labels = [];
    for (let i = 1; i <= labelCount; i++) {
      const tubeIndex = String(i).padStart(2, '0');
      let barcodeValue = selectedBarcodeCategory?.code || 'HC';
      if (printConfig.includeLot && selectedInUseForPrint?.lotNumber) {
        barcodeValue += `-${selectedInUseForPrint.lotNumber}`;
      }
      if (printConfig.includeIndex) {
        barcodeValue += `-${tubeIndex}`;
      }
      
      labels.push({
        index: tubeIndex,
        barcodeValue,
        displayName: selectedBarcodeCategory?.name || selectedInUseForPrint?.reagentName || '',
        lot: selectedInUseForPrint?.lotNumber || '',
        expiry: selectedInUseForPrint ? formatDateVN(selectedInUseForPrint.calculatedExpiry) : '',
        preparedBy: selectedInUseForPrint?.openedBy || currentUser?.fullName || '',
        hospitalName: printConfig.includeHospital ? printConfig.hospitalName : '',
      });
    }
    return labels;
  };

  // Group labels into pairs of 2 when 2-row mode is selected
  const getPairedLabelRows = (labels = getPreparedLabels()) => {
    const pairs: (typeof labels)[] = [];
    for (let i = 0; i < labels.length; i += 2) {
      pairs.push(labels.slice(i, i + 2));
    }
    return pairs;
  };

  // Handlers for Printer Code (TSPL / ZPL) with fallback copy for iframe environments
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
        try {
          const textArea = document.createElement('textarea');
          textArea.value = code;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          markCopied();
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
      });
    } else {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        markCopied();
      } catch (err) {
        console.error('Copy code failed:', err);
      }
    }
  };

  const handleDownloadPrinterCode = () => {
    const labels = getPreparedLabels();
    if (labels.length === 0) return;
    const code = generatePrinterCode(labels, printerCodeFormat, printConfig.labelRowType);
    const itemName = (selectedBarcodeCategory?.code || selectedInUseForPrint?.reagentName || 'Tem_2x10').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    const ext = printerCodeFormat.toLowerCase();
    const rowSuffix = printConfig.labelRowType === '2-row' ? '2HangTem' : '1HangTem';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ma_In_${printerCodeFormat}_${rowSuffix}_${itemName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Thermal Label Roll Print HTML:
  // - 1-row: 50mm x 20mm single label roll (@page { size: 50mm 20mm; margin: 0; }, Safe Margin: 1.5mm top/bottom, 2mm left/right)
  // - 2-row: 102mm x 20mm double label roll (2 x 50mm x 20mm with 2mm gap)
  const getPrintLabelHtml = (includeInteractiveToolbar = false) => {
    if (!selectedInUseForPrint && !selectedBarcodeCategory) return null;

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
            <span>LOT:${item.lot || '--'}</span>
            <span>HSD:${item.expiry || '--'}</span>
          </div>
        </div>
      `;
    };

    let labelsHtml = '';
    if (isTwoRow) {
      const pairs = getPairedLabelRows(labels);
      labelsHtml = pairs.map((pair) => `
        <div class="label-row-2col">
          ${renderSingleSticker(pair[0] || null)}
          ${renderSingleSticker(pair[1] || null)}
        </div>
      `).join('');
    } else {
      labelsHtml = labels.map((item) => renderSingleSticker(item, 'single-page-break')).join('');
    }

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
  <title>In_Tem_50x20mm_Mo_Nap</title>
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
      a.download = `In_Tem_50x20mm_${printConfig.labelRowType}_${(selectedInUseForPrint?.reagentName || 'Mo_Nap').replace(/\s+/g, '_')}.html`;
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

  // Execute isolated Hidden Iframe Print + Portal fallback
  const executeHiddenIframePrint = () => {
    const html = getPrintLabelHtml(false);
    if (!html) return;

    try {
      const existingIframe = document.getElementById('thermal-print-hidden-iframe-inuse') as HTMLIFrameElement | null;
      if (existingIframe && existingIframe.parentNode) {
        existingIframe.parentNode.removeChild(existingIframe);
      }

      const isTwoRow = printConfig.labelRowType === '2-row';
      const printFrame = document.createElement('iframe');
      printFrame.id = 'thermal-print-hidden-iframe-inuse';
      printFrame.style.position = 'fixed';
      printFrame.style.left = '-9999px';
      printFrame.style.top = '0';
      printFrame.style.width = isTwoRow ? '102mm' : '50mm';
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

  // Trigger print SYNCHRONOUSLY on user click gesture so Chromium preserves Transient User Activation
  // #thermal-print-portal-inuse is mounted directly on document.body via createPortal, isolating CSS from #root
  const handlePrintAction = () => {
    window.focus();
    window.print();
  };

  // Open Update Tests Modal
  const openUpdateTestsModal = (item: InUseStability) => {
    setSelectedItem(item);
    setNewTestsCount(item.remainingTests || 0);
    setIsUpdateTestsModalOpen(true);
  };

  // Submit Update Tests
  const handleUpdateTestsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItem) {
      onUpdateRemainingTests(selectedItem.id, newTestsCount);
      setIsUpdateTestsModalOpen(false);
    }
  };

  // Calculate status and remaining days
  const getInUseExpiryState = (item: InUseStability) => {
    if (item.status !== 'active') {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            {item.status === 'depleted' ? 'Đã dùng hết' : 'Đã hủy bỏ'}
          </span>
        ),
        daysString: '—',
        alertLevel: 'info'
      };
    }

    const expiryDate = new Date(item.calculatedExpiry);
    const diffTime = expiryDate.getTime() - simulatedDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white animate-pulse">
            ❌ Đã Quá Hạn Mở Nắp
          </span>
        ),
        daysString: `Đã quá hạn ${Math.abs(diffDays)} ngày! SOP: Thay hộp ngay`,
        alertLevel: 'critical'
      };
    }

    if (diffDays <= 3) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white animate-pulse">
            ⚠️ Sắp Hết Hạn
          </span>
        ),
        daysString: `Chỉ còn ${diffDays} ngày`,
        alertLevel: 'warning'
      };
    }

    return {
      badge: (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          🟢 Đang hoạt động
        </span>
      ),
      daysString: `Còn ${diffDays} ngày`,
      alertLevel: 'active'
    };
  };

  return (
    <div className="space-y-4" id="in-use-tab-root">
      
      {/* Control bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Quick Info */}
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-600" />
          <p className="text-xs text-slate-500">
            Theo dõi dải hạn dùng sau mở nắp (In-use stability) và vị trí hộp hóa chất đặt trong khoang máy phân tích.
          </p>
        </div>

        {/* Filters and Action */}
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
          >
            <option value="All">Trạng thái hạn mở nắp (Tất cả)</option>
            <option value="active">Đang mở nắp an toàn</option>
            <option value="expired">Đã quá hạn mở nắp (ISO Alert)</option>
            <option value="completed">Lịch sử lọ đã hết/đã hủy</option>
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
          </div>

        {/* Add Open Vial */}
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ml-auto md:ml-0"
          id="btn-open-stability-manual"
        >
          <Plus className="h-4 w-4" /> Ghi nhận mở nắp thủ công
        </button>

      </div>

      {targetHighlight && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span>Đang tiêu điểm tìm kiếm mở nắp: <strong>{targetHighlight.name}</strong></span>
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

    </div>

    {/* Main Grid Table */}
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-3 w-10 text-center">
                <input 
                  type="checkbox"
                  id="checkbox-all-inuse"
                  checked={isAllFilteredSelected}
                  onChange={handleToggleSelectAll}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                  title="Chọn tất cả"
                />
              </th>
              <th className="px-5 py-3">Hóa chất y tế mở nắp</th>
              <th className="px-4 py-3">Khoa phòng</th>
              <th className="px-4 py-3">Số lô (LOT)</th>
              <th className="px-4 py-3">Vị trí lắp trên máy xét nghiệm</th>
              <th className="px-4 py-3">Ngày mở nắp</th>
              <th className="px-4 py-3">Hạn mở nắp tối đa</th>
              <th className="px-4 py-3 text-center">Số Tests còn lại</th>
              <th className="px-4 py-3">Độ ổn định còn lại</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInUse.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-12 text-center text-slate-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Không tìm thấy thông tin mở nắp nào phù hợp điều kiện lọc.
                </td>
              </tr>
            ) : (
              filteredInUse.map((item) => {
                const expiryState = getInUseExpiryState(item);

                return (
                  <tr 
                    key={item.id} 
                    id={`inuse-row-${item.id}`}
                    className={`hover:bg-slate-50/50 transition-all ${
                      targetHighlight?.id === item.id
                        ? 'ring-2 ring-amber-400 bg-amber-50/50 animate-pulse'
                        : ''
                    }`}
                  >
                      
                      {/* Checkbox */}
                      <td className="px-3 py-4 w-10 text-center">
                        <input 
                          type="checkbox"
                          id={`checkbox-inuse-${item.id}`}
                          checked={selectedInUseIds.includes(item.id)}
                          onChange={() => handleToggleSelectRow(item.id)}
                          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                        />
                      </td>
                      
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 leading-tight">
                            {item.reagentName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {item.id} | Người mở: {item.openedBy}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          item.category === 'Sinh hóa' ? 'bg-teal-50 text-teal-700' :
                          item.category === 'Huyết học' ? 'bg-sky-50 text-sky-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>
                          {item.category}
                        </span>
                      </td>

                      {/* Lot number */}
                      <td className="px-4 py-4 whitespace-nowrap font-mono font-bold text-slate-600">
                        {item.lotNumber}
                      </td>

                      {/* Machine Position */}
                      <td className="px-4 py-4">
                        <div className="text-slate-700 font-medium max-w-[150px] truncate" title={item.positionInMachine}>
                          {item.positionInMachine}
                        </div>
                      </td>

                      {/* Opened date */}
                      <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                        {formatDateVN(item.openedDate)}
                      </td>

                      {/* Calculated expiry */}
                      <td className="px-4 py-4 whitespace-nowrap text-slate-700 font-mono font-semibold">
                        {formatDateVN(item.calculatedExpiry)}
                      </td>

                      {/* Remaining tests count */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {item.remainingTests !== undefined && item.totalTests !== undefined ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 font-mono text-xs">
                              {item.remainingTests} / {item.totalTests}
                            </span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 mx-auto overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  (item.remainingTests / item.totalTests) < 0.2 ? 'bg-red-500 animate-pulse' :
                                  (item.remainingTests / item.totalTests) < 0.5 ? 'bg-amber-400' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, (item.remainingTests / item.totalTests) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Stability days left indicator */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className={`font-semibold ${
                          expiryState.alertLevel === 'critical' ? 'text-red-600 font-bold' :
                          expiryState.alertLevel === 'warning' ? 'text-amber-500' :
                          expiryState.alertLevel === 'active' ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {expiryState.daysString}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {expiryState.badge}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {item.status === 'active' && (
                            <>
                              {/* Update remaining tests */}
                              <button
                                onClick={() => openUpdateTestsModal(item)}
                                className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-all cursor-pointer font-medium"
                                title="Cập nhật số tests còn lại của hộp hóa chất"
                              >
                                Thống kê test
                              </button>

                              {/* Mark as depleted */}
                              <button
                                onClick={() => onUpdateInUseStatus(item.id, 'depleted')}
                                className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-md transition-all cursor-pointer font-medium"
                                title="Đánh dấu đã sử dụng hết hộp hóa chất này"
                              >
                                Hết hàng
                              </button>

                              {/* Mark as discarded */}
                              {currentUser && (
                                <button
                                  onClick={() => onUpdateInUseStatus(item.id, 'discarded')}
                                  className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-md transition-all cursor-pointer font-medium"
                                  title="Hủy bỏ, xả bỏ hộp hóa chất này"
                                >
                                  Hủy bỏ
                                </button>
                              )}
                            </>
                          )}

                          {/* In Barcode */}
                          <button
                            onClick={() => openPrintModal(item)}
                            className="p-1 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                            title="In nhãn mã vạch Barcode"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete entirely */}
                          {currentUser && (
                            <button
                              onClick={() => {
                                if (confirm('Bạn có chắc muốn xóa bản ghi mở nắp này khỏi hệ thống lưu trữ?')) {
                                  onDeleteInUse(item.id);
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
      </div>

      {/* ISO SOP Reference Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-600">
        <HelpCircle className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-700">Quy định dán nhãn In-use Stability theo chuẩn 2429-QĐ/BYT:</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Mỗi hộp hóa chất khi lắp đặt lên máy phải được theo dõi chặt chẽ. Hạn dùng thực tế sau khi mở nắp (calculated expiry) luôn được tính là giá trị nhỏ nhất giữa: <strong>(Ngày mở nắp + Hạn ổn định mở nắp)</strong> và <strong>(Hạn sử dụng gốc của nhà sản xuất)</strong>. Việc vi phạm quy định này sẽ làm tăng nguy cơ sai hỏng dữ liệu chất lượng xét nghiệm bệnh nhân.
          </p>
        </div>
      </div>

      {/* ================= MODAL: MANUAL OPEN VIAL ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-4">
              Ghi nhận Mở nắp Hóa chất Thủ công
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              
              <div className="space-y-3">
                
                {/* Select Reagent */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Chọn hóa chất mở nắp *</label>
                  <select
                    value={addReagentId}
                    onChange={(e) => handleReagentChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="" disabled>-- Chọn hóa chất có sẵn --</option>
                    {reagents.filter(r => r.currentStock > 0).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Lô: {r.lotNumber}, Còn: {r.currentStock} {r.unit})
                      </option>
                    ))}
                  </select>
                  {reagents.filter(r => r.currentStock > 0).length === 0 && (
                    <span className="text-[10px] text-rose-500 font-semibold mt-1 block">
                      ⚠️ Toàn bộ danh mục hóa chất đều đang hết hàng trong kho. Hãy nhập kho trước!
                    </span>
                  )}
                </div>

                {/* Opened By */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nhân viên y tế thực hiện mở *</label>
                  <input
                    type="text"
                    required
                    value={addOpenedBy}
                    onChange={(e) => setAddOpenedBy(e.target.value)}
                    placeholder="Tên nhân viên y tế"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vị trí lắp đặt trên máy xét nghiệm *</label>
                  <input
                    type="text"
                    required
                    value={addPosition}
                    onChange={(e) => setAddPosition(e.target.value)}
                    placeholder="Ví dụ: Cobas c501 - Vị trí 25"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

                {/* Tests */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dung lượng xét nghiệm khởi đầu (Tests) - Tùy chọn</label>
                  <input
                    type="number"
                    min={1}
                    value={addTests || ''}
                    onChange={(e) => setAddTests(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Ví dụ: 100, 250, 400"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                  />
                </div>

              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!addReagentId}
                  className={`px-4 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-sm ${
                    !addReagentId ? 'bg-slate-300 cursor-not-allowed hover:bg-slate-300' : ''
                  }`}
                >
                  Kích hoạt mở nắp
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: UPDATE REMAINING TESTS ================= */}
      {isUpdateTestsModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-1">
              Cập nhật Thống kê Tests còn lại
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Thiết lập số test còn lại đo được từ hệ thống cho: <span className="text-slate-800 font-bold">{selectedItem.reagentName}</span> (Lô: {selectedItem.lotNumber})
            </p>

            <form onSubmit={handleUpdateTestsSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số Tests hiện tại còn lại trên máy *</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={selectedItem.totalTests}
                  value={newTestsCount}
                  onChange={(e) => setNewTestsCount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Công suất dung tích hộp gốc: {selectedItem.totalTests} tests.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUpdateTestsModalOpen(false)}
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

      {/* ================= MODAL: PRINT BARCODE LABELS (FORM 2x10) ================= */}
      {isPrintModalOpen && selectedInUseForPrint && (
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
                    In Tem Nhãn Mã Vạch Hóa Chất Mở Nắp - Form 2x10 cm
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
                  setSelectedInUseForPrint(null);
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
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cấu hình in Form 2x10</span>
                      <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        {printConfig.labelRowType === '2-row' ? '2 tem/hàng (2×50×20mm)' : '1 tem/hàng (100×20mm)'}
                      </span>
                    </div>

                    {/* Label Roll Row Type Selector: 1-row vs 2-row */}
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
                            1 tem ngang 100 × 20 mm
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
                            2 tem đôi 50 × 20 mm
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Template selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Mã hóa chất / Barcode ID *</label>
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
                          {printConfig.customCount || 1} tem
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={printConfig.customCount || 1}
                          onChange={(e) => setPrintConfig({...printConfig, customCount: Math.max(1, parseInt(e.target.value) || 1)})}
                          className="w-24 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-mono font-bold text-center"
                        />
                        <div className="flex items-center gap-1 flex-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setPrintConfig({...printConfig, customCount: 1})}
                            className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-all cursor-pointer"
                          >
                            1 tem
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintConfig({...printConfig, customCount: 5})}
                            className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-all cursor-pointer"
                          >
                            5 tem
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintConfig({...printConfig, customCount: 10})}
                            className="px-2.5 py-1 text-[10px] font-bold bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg text-teal-800 transition-all cursor-pointer"
                          >
                            10 tem
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintConfig({...printConfig, customCount: 20})}
                            className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-all cursor-pointer"
                          >
                            20 tem
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={printConfig.includeIndex}
                          onChange={(e) => setPrintConfig({...printConfig, includeIndex: e.target.checked})}
                          className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="text-xs text-slate-700 font-medium">
                          Đánh số thứ tự hộp tự động (<code className="text-teal-700 font-bold">#01, #02...</code>)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={printConfig.includeLot}
                          onChange={(e) => setPrintConfig({...printConfig, includeLot: e.target.checked})}
                          className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="text-xs text-slate-700 font-medium">
                          Ghép số Lô (LOT) vào chuỗi Barcode
                        </span>
                      </label>

                      <div className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={printConfig.includeHospital}
                            onChange={(e) => setPrintConfig({...printConfig, includeHospital: e.target.checked})}
                            className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="text-xs text-slate-700 font-medium">In tiêu đề cơ sở y tế / Khoa phòng</span>
                        </label>
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
                        const pairedRows = getPairedLabelRows(labels);
                        return pairedRows.map((pair, rowIdx) => (
                          <div
                            key={rowIdx}
                            className="grid grid-cols-2 gap-2.5 mx-auto max-w-[460px] bg-slate-300/60 p-1.5 rounded-xl border border-dashed border-slate-400"
                          >
                            {pair.map((item, colIdx) => (
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
                            ))}
                            {pair.length === 1 && (
                              <div className="bg-slate-200/50 rounded-lg border border-dashed border-slate-300 p-2 flex items-center justify-center text-[10px] text-slate-400 italic">
                                (Tem trống)
                              </div>
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
                            {item.index && <span className="text-teal-700 font-extrabold">Hộp #{item.index}</span>}
                          </div>
                          <div className="text-[10px] font-bold text-slate-950 truncate mt-1 leading-tight">
                            {item.displayName}
                          </div>
                          <div className="my-1.5 flex flex-col items-center justify-center">
                            <BarcodeRenderer 
                              value={item.barcodeValue} 
                              heightMm={7.8}
                              maxWidthMm={68}
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
                        ? `2 tem/hàng · ${getPreparedLabels().length} tem (${Math.ceil(getPreparedLabels().length / 2)} hàng in)`
                        : `1 tem/hàng · ${getPreparedLabels().length} lệnh in`}
                    </span>
                  </div>
                </div>

                {/* Code Block Container */}
                <div className="relative">
                  <div className="flex items-center justify-between bg-slate-800 text-slate-300 px-4 py-2 rounded-t-xl text-xs font-mono">
                    <span>
                      Mã lệnh in {printerCodeFormat} ({printConfig.labelRowType === '2-row' ? 'Loại 2 hàng tem - 102×20mm (2×50×20mm, Gap 2mm)' : 'Loại 1 hàng tem - 50×20mm (Gap 2mm)'})
                    </span>
                    <span className="text-[10px] text-slate-400">Đã lọc removeAccents (ASCII/CP437 chuẩn BarTender)</span>
                  </div>
                  <pre className="bg-slate-900 text-emerald-400 p-4 rounded-b-xl font-mono text-xs overflow-x-auto max-h-[360px] select-all leading-relaxed">
                    {generatePrinterCode(getPreparedLabels(), printerCodeFormat, printConfig.labelRowType)}
                  </pre>
                </div>

                {/* Integration advice */}
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <span>💡 Cách sử dụng mã code in:</span>
                  </div>
                  <div>• <strong>TSC / Xprinter / Godex:</strong> Mở công cụ <em>Diagnostic Tool</em> hoặc <em>BarTender / DiagTool</em>, chọn cổng USB / COM / IP và gửi chuỗi lệnh TSPL.</div>
                  <div>• <strong>Zebra:</strong> Mở <em>Zebra Setup Utilities</em> ➔ Chọn <em>Open Communication With Printer</em> ➔ Dán mã ZPL và bấm Send to Printer.</div>
                  <div>• <strong>Tự động hóa:</strong> Nhúng file mã in vào phần mềm LIS/HIS gửi qua socket TCP port 9100 để in tự động.</div>
                </div>
              </div>
            )}

            {/* Pre-Print Checklist Reminder Banner (Always visible before printing) */}
            {printModalTab === 'preview' && (
              <div className="mt-4 bg-amber-50/90 border border-amber-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-950 shrink-0">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Kiểm tra nhanh khi hộp thoại In mở ra:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-white px-2 py-0.5 rounded border border-amber-300 font-mono">
                    Khổ giấy (Paper Size): <strong>{printConfig.labelRowType === '2-row' ? '102×20 mm' : '50×20 mm'}</strong>
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded border border-amber-300 font-mono">
                    Lề (Margins): <strong>None / Minimum</strong>
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded border border-amber-300 font-mono">
                    Scale: <strong>100% (Không Fit to Page)</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Khổ tem vật lý: <strong>{printConfig.labelRowType === '2-row' ? '102 × 20 mm (2 tem 50×20mm, Gap 2mm)' : '50 × 20 mm (Gap 2mm, Safe Margin 1.5–2mm)'}</strong> · Cô lập môi trường in 1:1.
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
                      className="px-3 py-2 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer font-bold border border-slate-300 flex items-center gap-1.5"
                      title="Tải file HTML chuẩn kích thước tem để in offline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Tải file HTML</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenPrintWindow()}
                      className="px-3.5 py-2 text-xs text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl transition-all cursor-pointer font-bold border border-teal-300 flex items-center gap-1.5 shadow-2xs"
                      title="Mở tab in độc lập mới nếu trình duyệt chặn hộp thoại in"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>Mở Tab In Riêng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPrintModalOpen(false);
                        setSelectedInUseForPrint(null);
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
                      <Printer className="h-4 w-4" /> BẮT ĐẦU IN ({printConfig.labelRowType === '2-row' ? '2×50×20' : '50 × 20'} mm)
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Pre-Print Reminder Overlay (Hidden Iframe Print Guide) */}
            {isPrePrintOverlayOpen && (
              <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
                <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-teal-200 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          Kiểm tra thông số trước khi In
                        </h4>
                        <p className="text-xs text-slate-500">
                          Hệ thống đã cô lập môi trường in qua Hidden Iframe
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPrePrintOverlayOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-2.5 text-xs text-slate-800 mb-5">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <span>⚡ Lưu ý quan trọng trong hộp thoại Print:</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-black text-teal-700">1.</span>
                      <div>
                        <strong>Khổ giấy (Paper Size):</strong> Chọn đúng kích thước cuộn tem{' '}
                        <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 text-teal-900">
                          {printConfig.labelRowType === '2-row' ? '102 × 20 mm (hoặc 100 × 20 mm)' : '50 × 20 mm'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-black text-teal-700">2.</span>
                      <div>
                        <strong>Lề trang in (Margins):</strong> Bắt buộc chọn{' '}
                        <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 text-teal-900">
                          None (Không lề)
                        </span>{' '}
                        hoặc <strong>Minimum</strong>.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-black text-teal-700">3.</span>
                      <div>
                        <strong>Tỷ lệ (Scale):</strong> Giữ nguyên{' '}
                        <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 text-teal-900">
                          100% (Default / Actual Size)
                        </span>{' '}
                        — <em>Tuyệt đối không chọn Fit to Page</em>.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPrePrintOverlayOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-all"
                    >
                      Đã hiểu & Đóng
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPrintWindow}
                      className="px-4 py-2 text-xs font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 rounded-xl border border-teal-300 flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      <span>Mở Cửa Sổ In Riêng</span>
                    </button>
                    <button
                      type="button"
                      onClick={executeHiddenIframePrint}
                      className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Gọi lại hộp thoại In</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ================= PORTAL PRINT CONTAINER: DIRECT CHILD OF DOCUMENT.BODY ================= */}
      {isPrintModalOpen && selectedInUseForPrint && typeof document !== 'undefined' && createPortal(
        <div id="thermal-print-portal-inuse" className="hidden">
          {printConfig.labelRowType === '2-row'
            ? getPairedLabelRows(getPreparedLabels()).map((pair, rowIdx) => (
                <div key={rowIdx} className="label-item-2x10 label-row-2col">
                  {pair.map((item, colIdx) => (
                    <div key={colIdx} className="label-half-cell">
                      <div className="label-header">
                        <span className="header-hosp">{item.hospitalName ? item.hospitalName : ''}</span>
                        {item.index ? <span className="index-badge">#{item.index}</span> : null}
                      </div>
                      <div className="item-name">{item.displayName}</div>
                      <div className="barcode-section">
                        <div
                          className="w-full flex items-center justify-center"
                          dangerouslySetInnerHTML={{ __html: generatePureBarcodeSvg(item.barcodeValue, 7.0, 44) }}
                        />
                        <div className="barcode-text">{item.barcodeValue}</div>
                      </div>
                      <div className="label-footer">
                        <span>LOT:{item.lot || '--'}</span>
                        <span>HSD:{item.expiry || '--'}</span>
                      </div>
                    </div>
                  ))}
                  {pair.length === 1 && <div className="label-half-cell" />}
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
                      dangerouslySetInnerHTML={{ __html: generatePureBarcodeSvg(item.barcodeValue, 7.0, 44) }}
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

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide main React root and all non-print portals when printing */
          body > *:not(#thermal-print-portal-inuse) {
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

          #thermal-print-portal-inuse {
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

          #thermal-print-portal-inuse svg,
          #thermal-print-portal-inuse svg * {
            shape-rendering: crispEdges !important;
          }

          /* Cố định cứng khổ giấy: 50mm x 20mm (1-row) hoặc 102mm x 20mm (2-row) */
          @page {
            size: ${printConfig.labelRowType === '2-row' ? '102mm 20mm !important' : '50mm 20mm !important'};
            margin: 0 !important;
          }
        }
      `}} />

    </div>
  );
}

function BarcodeRenderer({ value, heightMm = 7.0, maxWidthMm = 44 }: { value: string; width?: number; height?: number; heightMm?: number; maxWidthMm?: number }) {
  const cleanVal = (value || 'QC').trim();
  const svgHtml = generatePureBarcodeSvg(cleanVal, heightMm, maxWidthMm);

  return (
    <div
      className="w-full flex items-center justify-center text-center"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
