import React, { useState, useEffect, useRef } from 'react';
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
  Printer
} from 'lucide-react';
import { InUseStability, ReagentMaterial, LabCategory, User, BarcodeCategory, SystemSettings } from '../types';
import { formatDateVN, exportToExcel, exportToPDF } from '../utils';
import JsBarcode from 'jsbarcode';

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

  // Barcode Print States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedInUseForPrint, setSelectedInUseForPrint] = useState<InUseStability | null>(null);
  const [selectedBarcodeCategory, setSelectedBarcodeCategory] = useState<BarcodeCategory | null>(null);
  const [printConfig, setPrintConfig] = useState({
    hospitalName: 'BVĐK TP Cần Thơ - Khoa XN',
    includeLot: false,
    includeIndex: false,
    customCount: 1,
    labelSize: '50x20' as '35x22' | '50x20' | '50x20_double',
    barcodeOrientation: 'horizontal' as 'horizontal' | 'vertical' | 'rotate180' | 'vertical270',
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
      includeLot: false,
      includeIndex: false,
      customCount: 1,
    }));
    setIsPrintModalOpen(true);
  };

  const handlePrintAction = () => {
    if (!selectedInUseForPrint) return;

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
        preparedBy: selectedInUseForPrint?.openedBy || '',
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

    const renderSingleLabelHtml = (item: typeof labels[0]) => {
      if (isVertical) {
        return `
          <div class="print-label print-label-vertical">
            <div class="bc-vert-col">
              <div class="bc-vert-wrapper" style="transform: rotate(${rotDeg}deg);">
                <svg class="barcode-svg" data-value="${item.barcodeValue}"></svg>
                <div class="barcode-text-vert">${item.barcodeValue}</div>
              </div>
            </div>
            <div class="info-vert-col">
              <div class="item-name-vert">${item.displayName}</div>
              <div class="details-vert">
                <div>LOT: ${item.lot || '---'}</div>
                <div>HSD: ${item.expiry}</div>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="print-label ${isRot180 ? 'rot-180' : ''}">
          <div class="barcode-container">
            <svg class="barcode-svg" data-value="${item.barcodeValue}"></svg>
          </div>
          <div class="barcode-text">
            ${item.barcodeValue}
          </div>
          <div class="footer-text">
            <span class="display-name">${item.displayName}</span>
            <span>HSD: ${item.expiry}</span>
          </div>
        </div>
      `;
    };

    const rowsHtml = labelRows.map((row) => `
      <div class="print-row">
        <!-- Label 1 -->
        ${row[0] ? renderSingleLabelHtml(row[0]) : ''}

        <!-- Label 2 -->
        ${itemsPerRow === 2 && row[1] ? renderSingleLabelHtml(row[1]) : ''}
      </div>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>In_Tem_Mo_Nap</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-weight: 800;
    }
    .print-row {
      display: flex;
      width: ${printConfig.labelSize === '50x20' ? '50mm' : printConfig.labelSize === '50x20_double' ? '104mm' : '74mm'};
      height: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '20mm' : '22mm'};
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      background: #ffffff;
    }
    .print-label {
      width: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '50mm' : '35mm'};
      height: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '20mm' : '22mm'};
      box-sizing: border-box;
      padding: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '1.5mm 1.5mm 1.2mm 1.5mm' : '1.2mm 1mm 1mm 1mm'};
      margin: 0;
      margin-right: ${printConfig.labelSize === '50x20' ? '0' : '4mm'};
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
    .barcode-container {
      padding: 0;
      margin: 0;
      flex: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      overflow: hidden;
    }
    .barcode-svg {
      display: block !important;
      margin-left: auto !important;
      margin-right: auto !important;
      max-width: 95% !important;
      height: auto !important;
    }
    .barcode-text {
      font-size: ${printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double' ? '8.5px' : '7.5px'};
      font-family: 'Consolas', 'Courier New', monospace;
      font-weight: 900 !important;
      text-align: center;
      width: 100%;
      letter-spacing: ${printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double' ? '1.4px' : '0.8px'};
      color: #000000 !important;
      margin-top: 1px;
      line-height: 1;
    }
    .footer-text {
      font-size: ${printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double' ? '7px' : '5.5px'};
      font-weight: 900 !important;
      color: #000000 !important;
      border-top: 1.5px solid #000000 !important;
      padding-top: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '2.5px' : '1.5px'};
      margin-top: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '2px' : '1.5px'};
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      line-height: 1.1;
    }
    .display-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 900 !important;
      color: #000000 !important;
      max-width: ${printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double' ? '28mm' : '15mm'};
    }
    @page {
      size: ${printConfig.labelSize === '50x20' ? '50mm 20mm' : printConfig.labelSize === '50x20_double' ? '104mm 20mm' : '74mm 22mm'};
      margin: 0;
    }
  </style>
</head>
<body>
  ${rowsHtml}
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.onload = function() {
      var svgs = document.querySelectorAll('.barcode-svg');
      svgs.forEach(function(svg) {
        var val = svg.getAttribute('data-value');
        if (val) {
          try {
            var barWidth = ${is50x20 ? 1.3 : 1.0};
            if (val.length > 20) {
              barWidth = 0.95;
            } else if (val.length > 15) {
              barWidth = 1.1;
            }
            JsBarcode(svg, val, {
              format: 'CODE128',
              width: barWidth,
              height: ${is50x20 ? 25 : 22},
              displayValue: false,
              margin: 0,
              lineColor: '#000000',
              background: '#ffffff'
            });
            svg.style.display = 'block';
            svg.style.marginLeft = 'auto';
            svg.style.marginRight = 'auto';
          } catch(e) {
            console.error(e);
          }
        }
      });
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch(e) {
          console.error(e);
        }
      }, 500);
    };
  </script>
</body>
</html>
    `;

    // Print using hidden iframe
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }

    // Fallback Download
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `In_Tem_Mo_Nap_${selectedInUseForPrint.reagentName.replace(/\s+/g, '_')}.html`;
      setTimeout(() => {
        a.click();
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (err) {
      console.error('Fallback download error:', err);
    }

    // Clean up
    setTimeout(() => {
      document.body.removeChild(printFrame);
    }, 10000);
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

      {/* ================= MODAL: PRINT BARCODE LABELS ================= */}
      {isPrintModalOpen && selectedInUseForPrint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-2 flex items-center gap-2">
              <Printer className="h-5 w-5 text-teal-600" /> Thiết lập In mã vạch (Barcode)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Cấu hình thông số tem in mã vạch dán trực tiếp lên hộp hóa chất mở nắp.
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* Select Barcode Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mẫu mã viết tắt danh mục *</label>
                <select
                  value={selectedBarcodeCategory?.id || ''}
                  onChange={(e) => {
                    const cat = barcodeCategories.find(c => c.id === e.target.value);
                    if (cat) setSelectedBarcodeCategory(cat);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                >
                  <option value="" disabled>-- Chọn mã danh mục viết tắt --</option>
                  {barcodeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.code} - {cat.name} ({cat.category})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Mã vạch CODE128 sẽ được sinh tự động dựa trên Mã danh mục đã chọn.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Label size */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Kích thước khổ tem</label>
                  <select
                    value={printConfig.labelSize}
                    onChange={(e) => setPrintConfig({...printConfig, labelSize: e.target.value as '35x22' | '50x20' | '50x20_double'})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="50x20">Khổ 1 tem 50x20 mm</option>
                    <option value="50x20_double">Khổ 2 tem hàng ngang 50x20 mm</option>
                    <option value="35x22">Khổ 2 tem song song 35x22 mm</option>
                  </select>
                </div>

                {/* Print Count */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Số lượng nhãn tem in</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={printConfig.customCount}
                    onChange={(e) => setPrintConfig({...printConfig, customCount: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Chiều in Barcode / Hướng mã vạch */}
              <div className="p-3 bg-white border border-teal-200 rounded-xl space-y-2 shadow-2xs">
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
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
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
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center gap-2 ${
                      printConfig.barcodeOrientation === 'horizontal'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-base font-mono">═</span>
                    <div>
                      <div className="leading-tight">Ngang 0° (Chuẩn)</div>
                      <div className={`text-[8.5px] font-normal ${printConfig.barcodeOrientation === 'horizontal' ? 'text-teal-100' : 'text-slate-400'}`}>Mã vạch ngang 50mm</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintConfig({ ...printConfig, barcodeOrientation: 'vertical' })}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center gap-2 ${
                      printConfig.barcodeOrientation === 'vertical'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-base font-mono">║</span>
                    <div>
                      <div className="leading-tight">Dọc 90°</div>
                      <div className={`text-[8.5px] font-normal ${printConfig.barcodeOrientation === 'vertical' ? 'text-teal-100' : 'text-slate-400'}`}>Mã vạch dọc</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Options check */}
              <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="toggle-print-lot-inuse"
                    checked={printConfig.includeLot}
                    onChange={(e) => setPrintConfig({...printConfig, includeLot: e.target.checked})}
                    className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                  />
                  <label htmlFor="toggle-print-lot-inuse" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    Ghép thêm số Lô sản xuất gốc (Lot number) vào đuôi Barcode
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="toggle-print-index-inuse"
                    checked={printConfig.includeIndex}
                    onChange={(e) => setPrintConfig({...printConfig, includeIndex: e.target.checked})}
                    className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                  />
                  <label htmlFor="toggle-print-index-inuse" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    Đánh số thứ tự tem (Index) tự động nếu in số lượng nhiều tem
                  </label>
                </div>
              </div>

              {/* Guidance alerts */}
              <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-[11px] leading-relaxed">
                <strong>💡 Lưu ý thiết lập Driver máy in tem nhãn nhiệt:</strong><br />
                1. Đảm bảo đã chọn máy in decal chuyên dụng (thermal label printer).<br />
                2. Thiết lập kích thước khổ giấy in trong Driver máy in là <strong>{printConfig.labelSize === '50x20' ? '50x20 mm (5x2 cm)' : printConfig.labelSize === '50x20_double' ? '2 tem/hàng · 50x20 mm' : '2 tem/hàng · 35x22 mm'}</strong>.<br />
                3. Trình duyệt Chrome/Edge: Đặt lề (Margins) là "None" và bỏ tích "Headers and footers" để tem khớp hoàn toàn.
              </div>

              {/* Real-time Preview Area */}
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Xem trước nhãn tem in thực tế</span>
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-x-auto min-h-[140px]">
                  {(() => {
                    const labelCount = printConfig.customCount || 1;
                    const labels = [];
                    for (let i = 1; i <= Math.min(labelCount, 4); i++) {
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
                      });
                    }

                    const is50x20 = printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double';
                    const itemsPerRow = printConfig.labelSize === '50x20' ? 1 : 2;
                    const rows = [];
                    for (let i = 0; i < labels.length; i += itemsPerRow) {
                      rows.push(labels.slice(i, i + itemsPerRow));
                    }

                    return (
                      <div className="space-y-3 bg-white p-4 rounded-lg shadow-xs scale-100 origin-center max-w-full">
                        <div className="text-[10px] text-slate-400 font-bold mb-1 border-b pb-1">
                          Trực quan {printConfig.labelSize === '50x20' ? 'Cuộn decal 1 hàng (5x2 cm)' : printConfig.labelSize === '50x20_double' ? 'Cuộn decal 2 hàng (5x2 cm)' : 'Cuộn decal 2 hàng song song'} (Hiển thị tối đa 4 tem đầu tiên)
                        </div>
                        <div className="space-y-1">
                          {rows.map((rowItems, idx) => (
                            <div key={idx} className="flex gap-2 justify-center">
                              {rowItems.map((lbl, lIdx) => (
                                <div 
                                  key={lIdx} 
                                  className="bg-white border border-slate-400 text-black flex flex-col justify-between" 
                                  style={{ 
                                    width: is50x20 ? '150px' : '105px', 
                                    height: is50x20 ? '60px' : '66px',
                                    padding: is50x20 ? '6px 4px 4px 4px' : '4px 3px 3px 3px',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <div className="flex-1 flex flex-col justify-center items-center">
                                    <BarcodeRenderer 
                                      value={lbl.barcodeValue} 
                                      width={is50x20 ? 0.75 : 0.6} 
                                      height={is50x20 ? 15 : 18} 
                                    />
                                  </div>
                                  <div className="text-[6px] font-mono font-bold text-center tracking-normal scale-90 truncate">
                                    {lbl.barcodeValue}
                                  </div>
                                  <div className="flex justify-between items-center text-[5px] font-bold border-t border-slate-100 pt-0.5 mt-0.5 scale-90 origin-bottom leading-none">
                                    <span className="truncate max-w-[45%]">{lbl.displayName}</span>
                                    <span>HSD: {lbl.expiry}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsPrintModalOpen(false);
                  setSelectedInUseForPrint(null);
                }}
                className="px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handlePrintAction}
                className="px-5 py-2 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer font-bold shadow-md flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Bắt đầu in tem (Ctrl+P)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= PRINT CONTAINER: HIDDEN ON SCREEN, VISIBLE ON PRINT ================= */}
      {selectedInUseForPrint && (
        <div id="print-label-area-inuse" className="hidden">
          {(() => {
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
                preparedBy: selectedInUseForPrint?.openedBy || '',
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

            return labelRows.map((row, rIndex) => (
              <div key={rIndex} className="print-row">
                {/* Label 1 */}
                {row[0] && (
                  <div className="print-label">
                    <div className="py-1 flex-1 flex flex-col justify-center animate-none" style={{ padding: '2px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <BarcodeRenderer 
                        value={row[0].barcodeValue} 
                        width={is50x20 ? 1.4 : 1.05} 
                        height={is50x20 ? 25 : 22} 
                      />
                    </div>
                    <div className="text-[7px] font-mono font-black text-center text-slate-900 tracking-wider" style={{ fontSize: is50x20 ? '8px' : '7px', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center', letterSpacing: is50x20 ? '1.2px' : '1px' }}>
                      {row[0].barcodeValue}
                    </div>
                    <div className="flex items-center justify-between text-[5px] font-bold text-slate-600 border-t border-slate-100 pt-0.5 mt-0.5" style={{ fontSize: is50x20 ? '6.5px' : '5px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: is50x20 ? '3px' : '2px', marginTop: is50x20 ? '3px' : '2px' }}>
                      <span className="truncate" style={{ maxWidth: is50x20 ? '28mm' : '15mm' }}>{row[0].displayName}</span>
                      <span>HSD: {row[0].expiry}</span>
                    </div>
                  </div>
                )}

                {/* Label 2 */}
                {itemsPerRow === 2 && row[1] && (
                  <div className="print-label">
                    <div className="py-1 flex-1 flex flex-col justify-center animate-none" style={{ padding: '2px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <BarcodeRenderer 
                        value={row[1].barcodeValue} 
                        width={is50x20 ? 1.4 : 1.05} 
                        height={is50x20 ? 25 : 22} 
                      />
                    </div>
                    <div className="text-[7px] font-mono font-black text-center text-slate-900 tracking-wider" style={{ fontSize: is50x20 ? '8px' : '7px', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'center', letterSpacing: is50x20 ? '1.2px' : '1px' }}>
                      {row[1].barcodeValue}
                    </div>
                    <div className="flex items-center justify-between text-[5px] font-bold text-slate-600 border-t border-slate-100 pt-0.5 mt-0.5" style={{ fontSize: is50x20 ? '6.5px' : '5px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: is50x20 ? '3px' : '2px', marginTop: is50x20 ? '3px' : '2px' }}>
                      <span className="truncate" style={{ maxWidth: is50x20 ? '28mm' : '15mm' }}>{row[1].displayName}</span>
                      <span>HSD: {row[1].expiry}</span>
                    </div>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
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

          #print-label-area-inuse {
            display: block !important;
            width: ${printConfig.labelSize === '50x20' ? '50mm' : printConfig.labelSize === '50x20_double' ? '104mm' : '74mm'} !important;
            background: white !important;
            margin: 0 auto !important;
            padding: 0 !important;
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
            background: white !important;
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
            padding: ${(printConfig.labelSize === '50x20' || printConfig.labelSize === '50x20_double') ? '2mm 1.5mm 1.5mm 1.5mm' : '1.5mm 1mm 1mm 1mm'} !important;
            margin: 0 !important;
            margin-right: ${printConfig.labelSize === '50x20' ? '0' : '4mm'} !important; /* spacing between the 2 labels on roll */
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            font-family: 'Inter', sans-serif !important;
            color: black !important;
            background: white !important;
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

          /* Set page dimension to label size */
          @page {
            size: ${printConfig.labelSize === '50x20' ? '50mm 20mm' : printConfig.labelSize === '50x20_double' ? '104mm 20mm' : '74mm 22mm'};
            margin: 0;
          }
        }
      `}} />

    </div>
  );
}

function BarcodeRenderer({ value, width = 1.05, height = 22, heightMm = 7.5 }: { value: string; width?: number; height?: number; heightMm?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cleanVal = (value || 'QC').trim();
  const numModules = cleanVal.length * 11 + 35;
  const targetWidthMm = Math.max(30, Math.min(43, Math.round(numModules * 0.19 * 10) / 10));

  useEffect(() => {
    if (svgRef.current && cleanVal) {
      try {
        JsBarcode(svgRef.current, cleanVal, {
          format: 'CODE128',
          width: 2,
          height: 40,
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
          svgRef.current.style.maxWidth = '44mm';
          svgRef.current.style.height = `${heightMm}mm`;
        }
      } catch (err) {
        console.error('Barcode error:', err);
      }
    }
  }, [cleanVal, targetWidthMm, heightMm]);

  return (
    <div className="w-full flex items-center justify-center text-center">
      <svg ref={svgRef} className="block mx-auto" />
    </div>
  );
}
