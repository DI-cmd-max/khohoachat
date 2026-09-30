import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Settings, 
  Check, 
  Printer, 
  Clock, 
  Plus, 
  Sliders, 
  ListTodo, 
  FileText, 
  CheckSquare, 
  Square,
  Search,
  CheckCircle2,
  Save,
  HelpCircle,
  X,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarcodeCategory, ReagentMaterial, InUseStability, ReconstitutionLog, LabCategory, User, SystemSettings } from '../types';
import { formatDateVN, formatDateString } from '../utils';

interface QcPlanningTabProps {
  barcodeCategories: BarcodeCategory[];
  reagents: ReagentMaterial[];
  inUseStability: InUseStability[];
  reconstitutions: ReconstitutionLog[];
  simulatedTime: string; // ISO String
  onSaveBarcodeCategory: (bc: BarcodeCategory) => void;
  onDeleteBarcodeCategory: (id: string) => void;
  currentUser: User;
  systemSettings?: SystemSettings;
}

const WEEK_DAYS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ Nhật' }
];

export default function QcPlanningTab({
  barcodeCategories,
  reagents,
  inUseStability,
  reconstitutions,
  simulatedTime,
  onSaveBarcodeCategory,
  onDeleteBarcodeCategory,
  currentUser,
  systemSettings
}: QcPlanningTabProps) {
  // 1. Base states
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    try {
      return simulatedTime.slice(0, 10);
    } catch {
      return formatDateString(new Date());
    }
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);

  // Add QC Category form states
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<LabCategory>('Sinh hóa');

  const handleAddNewQC = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      setToastMessage('Vui lòng nhập đầy đủ Mã QC và Tên hóa chất!');
      return;
    }

    const newQC: BarcodeCategory = {
      id: 'qc_' + Date.now(),
      code: newCode.trim().toUpperCase(),
      name: newName.trim(),
      category: newCategory,
      createdAt: simulatedTime || new Date().toISOString(),
      frequencyType: 'daily'
    };

    onSaveBarcodeCategory(newQC);
    setIsAddingNew(false);
    setNewCode('');
    setNewName('');
    setNewCategory('Sinh hóa');
    setToastMessage(`Đã thêm loại QC mới: ${newQC.name}`);
  };

  const handleDeleteQC = (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa danh mục QC "${name}" khỏi kế hoạch năm?`)) {
      onDeleteBarcodeCategory(id);
      setToastMessage(`Đã xóa danh mục QC: ${name}`);
    }
  };
  
  // 2. Config form states
  const [formFreqType, setFormFreqType] = useState<'daily' | 'weekly' | 'interval' | 'none'>('daily');
  const [formWeeklyDays, setFormWeeklyDays] = useState<number[]>([]);
  const [formIntervalDays, setFormIntervalDays] = useState<number>(3);
  const [formStartDate, setFormStartDate] = useState<string>(() => {
    try {
      return simulatedTime.slice(0, 10);
    } catch {
      return formatDateString(new Date());
    }
  });

  // 3. Daily task selection & custom LOT states
  const [checkedTaskIds, setCheckedTaskIds] = useState<Record<string, boolean>>({});
  const [customLots, setCustomLots] = useState<Record<string, string>>({});
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync date when simulatedTime changes
  useEffect(() => {
    if (simulatedTime) {
      setSelectedDateStr(simulatedTime.slice(0, 10));
    }
  }, [simulatedTime]);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Helper to resolve the active LOT number for a given QC category item
  const getActiveLot = (bc: BarcodeCategory): string => {
    // If user has customized it on-the-fly, return that
    if (customLots[bc.id]) {
      return customLots[bc.id];
    }

    // 1. Look for matching active reconstitution (status 'Đang sử dụng')
    const matchRecon = reconstitutions.find(r => 
      r.status === 'Đang sử dụng' && 
      (r.targetItemName.toLowerCase().includes(bc.name.toLowerCase()) || 
       r.targetItemName.toLowerCase().includes(bc.code.toLowerCase()) ||
       bc.name.toLowerCase().includes(r.targetItemName.toLowerCase()))
    );
    if (matchRecon) return matchRecon.sourceLot;

    // 2. Look for matching open vial (status 'active')
    const matchInUse = inUseStability.find(s => 
      s.status === 'active' && 
      (s.reagentName.toLowerCase().includes(bc.name.toLowerCase()) || 
       s.reagentName.toLowerCase().includes(bc.code.toLowerCase()) ||
       bc.name.toLowerCase().includes(s.reagentName.toLowerCase()))
    );
    if (matchInUse) return matchInUse.lotNumber;

    // 3. Find matching active reagent from catalog
    const matchReagent = reagents.find(r => 
      r.category === bc.category && 
      (r.name.toLowerCase().includes(bc.name.toLowerCase()) || 
       r.name.toLowerCase().includes(bc.code.toLowerCase()) ||
       bc.name.toLowerCase().includes(r.name.toLowerCase()) ||
       (r.notes && r.notes.toLowerCase().includes(bc.code.toLowerCase())))
    );
    if (matchReagent) return matchReagent.lotNumber;

    // 4. Fallback: first active item in department
    const deptInUse = inUseStability.find(s => s.status === 'active' && s.category === bc.category);
    if (deptInUse) return deptInUse.lotNumber;

    const deptReagent = reagents.find(r => r.category === bc.category);
    if (deptReagent) return deptReagent.lotNumber;

    return 'Chưa mở lô';
  };

  // Helper to resolve the list of planned tests for a given QC category
  const getTestsForBarcodeCategory = (bc: BarcodeCategory): string => {
    // 1. Try to find reagents linked specifically by barcodeCategoryCode
    let matchedReagents = reagents.filter(r => r.barcodeCategoryCode === bc.code);
    
    // 2. Fallback to name/code fuzzy matching if no direct links found
    if (matchedReagents.length === 0) {
      const match = reagents.find(r => 
        r.category === bc.category && 
        (r.name.toLowerCase().includes(bc.name.toLowerCase()) || 
         r.name.toLowerCase().includes(bc.code.toLowerCase()) ||
         bc.name.toLowerCase().includes(r.name.toLowerCase()) ||
         (r.notes && r.notes.toLowerCase().includes(bc.code.toLowerCase())))
      );
      if (match) {
        matchedReagents = [match];
      }
    }

    // 3. Extract and combine assignedTests
    const allTests: string[] = [];
    matchedReagents.forEach(r => {
      if (r.assignedTests && r.assignedTests.length > 0) {
        r.assignedTests.forEach(t => {
          if (!allTests.includes(t)) {
            allTests.push(t);
          }
        });
      }
    });

    if (allTests.length > 0) {
      return allTests.join(', ');
    }

    // 4. Fallback: Parse from bc.name or bc.code
    let cleanName = bc.name
      .replace(/QC/i, '')
      .replace(/Nội kiểm/i, '')
      .replace(/Kiểm tra/i, '')
      .replace(/Kiểm soát/i, '')
      .trim();
    
    if (!cleanName && bc.code) {
      cleanName = bc.code.replace(/QC_/i, '').replace(/_/g, ' ').trim();
    }
    
    return cleanName || 'Tất cả test ' + bc.category;
  };

  // Helper to resolve the list of linked QC reagent names for a given QC category
  const getLinkedQcTypes = (bc: BarcodeCategory): string => {
    // 1. Try to find reagents linked specifically by barcodeCategoryCode
    let matchedReagents = reagents.filter(r => r.barcodeCategoryCode === bc.code);
    
    // 2. Fallback to name/code fuzzy matching if no direct links found
    if (matchedReagents.length === 0) {
      const match = reagents.filter(r => 
        r.category === bc.category && 
        (r.name.toLowerCase().includes(bc.name.toLowerCase()) || 
         r.name.toLowerCase().includes(bc.code.toLowerCase()) ||
         bc.name.toLowerCase().includes(r.name.toLowerCase()) ||
         (r.notes && r.notes.toLowerCase().includes(bc.code.toLowerCase())))
      );
      if (match.length > 0) {
        matchedReagents = match;
      }
    }

    // 3. Find active reconstitutions linked to this barcodeCategoryCode
    const matchedRecons = reconstitutions.filter(recon => 
      recon.status === 'Đang sử dụng' && 
      (recon.barcodeCategoryCode === bc.code || 
       recon.targetItemName.toLowerCase().includes(bc.name.toLowerCase()))
    );

    const reagentNames = matchedReagents.map(r => r.name);
    const reconNames = matchedRecons.map(recon => `${recon.targetItemName} (Lô: ${recon.sourceLot})`);

    const combined = [...new Set([...reagentNames, ...reconNames])];

    if (combined.length > 0) {
      return combined.join(', ');
    }

    return 'Chưa liên kết';
  };

  // Check if a category runs on the selected date
  const isScheduledForDate = (bc: BarcodeCategory, dateStr: string): boolean => {
    const freq = bc.frequencyType || 'daily'; // Default to daily if not configured
    
    if (freq === 'none') {
      return false;
    }
    
    if (freq === 'daily') {
      return true;
    }
    
    if (freq === 'weekly') {
      const days = bc.weeklyDays || [];
      if (days.length === 0) return true; // Default fallback if config empty
      const d = new Date(dateStr);
      const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday, etc.
      return days.includes(dayOfWeek);
    }
    
    if (freq === 'interval') {
      const interval = bc.intervalDays || 1;
      const startStr = bc.startDate || dateStr;
      
      const start = new Date(startStr);
      const current = new Date(dateStr);
      
      start.setHours(0,0,0,0);
      current.setHours(0,0,0,0);
      
      const diffTime = current.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays >= 0 && diffDays % interval === 0;
    }
    
    return true;
  };

  // Generate the active tasks list for the selected date
  const activeTasks = barcodeCategories.filter(bc => isScheduledForDate(bc, selectedDateStr));

  // Initialize checkboxes for new active tasks list
  useEffect(() => {
    const newChecked: Record<string, boolean> = {};
    activeTasks.forEach(task => {
      newChecked[task.id] = checkedTaskIds[task.id] !== undefined ? checkedTaskIds[task.id] : true;
    });
    setCheckedTaskIds(newChecked);
  }, [selectedDateStr, barcodeCategories]);

  // Handle master checkbox toggle
  const allChecked = activeTasks.length > 0 && activeTasks.every(t => checkedTaskIds[t.id]);
  const handleToggleAll = () => {
    const nextVal = !allChecked;
    const updated = { ...checkedTaskIds };
    activeTasks.forEach(t => {
      updated[t.id] = nextVal;
    });
    setCheckedTaskIds(updated);
  };

  const handleToggleTask = (id: string) => {
    setCheckedTaskIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleLotChange = (id: string, lot: string) => {
    setCustomLots(prev => ({
      ...prev,
      [id]: lot
    }));
  };

  // Handle configuration edit initialization
  const handleStartConfig = (bc: BarcodeCategory) => {
    setActiveConfigId(bc.id);
    setFormFreqType(bc.frequencyType || 'daily');
    setFormWeeklyDays(bc.weeklyDays || []);
    setFormIntervalDays(bc.intervalDays || 3);
    setFormStartDate(bc.startDate || selectedDateStr);
  };

  const handleSaveConfig = (bc: BarcodeCategory) => {
    const updated: BarcodeCategory = {
      ...bc,
      frequencyType: formFreqType,
      weeklyDays: formFreqType === 'weekly' ? formWeeklyDays : undefined,
      intervalDays: formFreqType === 'interval' ? formIntervalDays : undefined,
      startDate: formFreqType === 'interval' ? formStartDate : undefined,
    };
    onSaveBarcodeCategory(updated);
    setActiveConfigId(null);
    setToastMessage(`Đã cập nhật kế hoạch QC cho ${bc.name}`);
  };

  const toggleWeeklyDay = (day: number) => {
    if (formWeeklyDays.includes(day)) {
      setFormWeeklyDays(formWeeklyDays.filter(d => d !== day));
    } else {
      setFormWeeklyDays([...formWeeklyDays, day].sort());
    }
  };

  const getFrequencyText = (bc: BarcodeCategory) => {
    const type = bc.frequencyType || 'daily';
    if (type === 'none') return 'Tắt chạy QC (Không chạy)';
    if (type === 'daily') return 'Hàng ngày';
    if (type === 'weekly') {
      const days = bc.weeklyDays || [];
      if (days.length === 0) return 'Các thứ trong tuần (Chưa chọn)';
      const labels = days.map(d => {
        const found = WEEK_DAYS.find(wd => wd.value === d);
        return found ? found.label : '';
      });
      return `Thứ cố định: ${labels.join(', ')}`;
    }
    if (type === 'interval') {
      return `Giãn cách: ${bc.intervalDays} ngày (Từ ${formatDateVN(bc.startDate || '')})`;
    }
    return 'Chưa cấu hình';
  };

  const getDayNameVN = (dateStr: string): string => {
    try {
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const d = new Date(dateStr);
      return days[d.getDay()];
    } catch {
      return '';
    }
  };

  const handlePrint = () => {
    const dayName = getDayNameVN(selectedDateStr);
    const formattedDate = formatDateVN(selectedDateStr);
    const operatorName = currentUser?.fullName || 'Kỹ thuật viên';
    
    const rowsHtml = selectedTasksToPrint.map((task, idx) => `
      <tr>
        <td class="text-center font-mono" style="text-align: center; font-family: monospace; border: 1px solid black; padding: 8px 10px;">${idx + 1}</td>
        <td style="border: 1px solid black; padding: 8px 10px; text-align: left;">
          <div class="font-bold" style="font-weight: bold;">${task.name}</div>
          <div style="font-size: 10px; font-family: monospace; color: #555;">(${task.code})</div>
        </td>
        <td style="border: 1px solid black; padding: 8px 10px; text-align: left; font-size: 11px;">${getLinkedQcTypes(task)}</td>
        <td class="text-center font-mono font-bold" style="text-align: center; font-family: monospace; font-weight: bold; border: 1px solid black; padding: 8px 10px;">${getActiveLot(task)}</td>
        <td style="border: 1px solid black; padding: 8px 10px; text-align: left;">${getTestsForBarcodeCategory(task)}</td>
        <td class="text-center" style="text-align: center; border: 1px solid black; padding: 8px 10px;">
          <span style="display: inline-block; width: 14px; height: 14px; border: 1px solid black; margin-top: 4px;"></span>
        </td>
      </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Phieu_Kiem_Soat_QC_Hang_Ngay</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      margin: 20px;
      color: black;
      background: white;
      font-size: 13px;
      line-height: 1.4;
    }
    @page {
      size: portrait;
      margin: 1.5cm;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      border-bottom: 2px solid black;
      padding-bottom: 8px;
    }
    .header-left {
      text-align: left;
      font-size: 11px;
      line-height: 1.5;
    }
    .header-right {
      text-align: right;
      font-size: 11px;
      line-height: 1.5;
    }
    .title-container {
      text-align: center;
      margin: 25px 0;
    }
    .title-main {
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title-sub {
      font-size: 12px;
      font-style: italic;
      margin-top: 5px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12px;
    }
    .data-table th, .data-table td {
      border: 1px solid black;
      padding: 8px 10px;
      text-align: left;
    }
    .data-table th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: center;
    }
    .text-center {
      text-align: center !important;
    }
    .font-mono {
      font-family: monospace;
    }
    .font-bold {
      font-weight: bold;
    }
    .instructions {
      margin-top: 25px;
      font-size: 11px;
      font-style: italic;
      line-height: 1.5;
    }
    .signatures-container {
      margin-top: 45px;
      width: 100%;
    }
    .signature-box {
      width: 50%;
      float: left;
      text-align: center;
      font-size: 12px;
    }
    .signature-title {
      font-weight: bold;
      margin-bottom: 65px;
    }
    .signature-name {
      font-weight: bold;
    }
    .clear {
      clear: both;
    }
  </style>
</head>
<body>
  <table class="header-table" style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 2px solid black; padding-bottom: 8px;">
    <tr>
      <td class="header-left" style="text-align: left; font-size: 11px; line-height: 1.5; vertical-align: top;">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 44px; max-width: 44px; object-fit: contain; margin-right: 10px; float: left;" referrerPolicy="no-referrer" />` : ''}
          <div style="float: left;">
            SỞ Y TẾ THÀNH PHỐ CẦN THƠ<br/>
            <strong>BỆNH VIỆN ĐA KHOA THÀNH PHỐ CẦN THƠ</strong><br/>
            <span style="border-top: 1px solid #ccc; display: inline-block; padding-top: 2px; margin-top: 2px;">KHOA XÉT NGHIỆM</span>
          </div>
          <div style="clear: both;"></div>
        </div>
      </td>
      <td class="header-right" style="text-align: right; font-size: 11px; line-height: 1.5; vertical-align: top; font-family: sans-serif;">
        ${systemSettings ? `
          Số hiệu: <span style="font-weight: bold; color: black;">${systemSettings.headerRow1}</span><br/>
          ${systemSettings.headerRow2}<br/>
          ${systemSettings.headerRow3} <span style="font-weight: 500; color: black;">${systemSettings.headerRow4}</span>
        ` : `
          Mã tài liệu: QT-QLCL-05-BM03<br/>
          Phiên bản: 1.2 (2429-QĐ/BYT)
        `}
      </td>
    </tr>
  </table>

  <div class="title-container" style="text-align: center; margin: 25px 0;">
    <div class="title-main" style="font-size: 18px; font-weight: bold; text-transform: uppercase;">PHIẾU KIỂM SOÁT NỘI KIỂM (QC) HÀNG NGÀY</div>
    <div class="title-sub" style="font-size: 12px; font-style: italic; margin-top: 5px;">
      Ngày thực hiện: ${dayName}, ngày ${formattedDate}
    </div>
  </div>

  <table class="data-table" style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px;">
    <thead>
      <tr style="background-color: #f1f5f9;">
        <th style="border: 1px solid black; padding: 8px 10px; font-weight: bold; text-align: center; width: 5%;">STT</th>
        <th style="border: 1px solid black; padding: 8px 10px; font-weight: bold; text-align: left; width: 20%;">Tên QC / Mã Vật Tư</th>
        <th style="border: 1px solid black; padding: 8px 10px; font-weight: bold; text-align: left; width: 25%;">Hóa chất / Loại QC liên kết</th>
        <th style="border: 1px solid black; padding: 8px 10px; font-weight: bold; text-align: center; width: 16%;">Số lô (LOT) Hiện Hành</th>
        <th style="border: 1px solid black; padding: 8px 10px; font-weight: bold; text-align: left; width: 22%;">Các Test theo Kế hoạch</th>
        <th style="border: 1px solid black; padding: 8px 10px; font-weight: bold; text-align: center; width: 12%;">Xác nhận (Tick)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="instructions" style="margin-top: 25px; font-size: 11px; font-style: italic; line-height: 1.5;">
    <strong>* Hướng dẫn ghi nhận:</strong><br/>
    - Kỹ thuật viên (KTV) chạy xong kết quả QC, đối chiếu biểu đồ Levey-Jennings.<br/>
    - Ký xác nhận vào ô trống nếu QC ĐẠT. Trường hợp QC LỖI (Vi phạm Westgard), ghi nhận biên bản khắc phục sự cố QC riêng kèm theo.
  </div>

  <div class="signatures-container" style="margin-top: 45px; width: 100%;">
    <div class="signature-box" style="width: 50%; float: left; text-align: center; font-size: 12px;">
      <div class="signature-title" style="font-weight: bold; margin-bottom: 65px;">KTV Thực Hiện</div>
      <div class="signature-name" style="font-weight: bold;">${operatorName}</div>
    </div>
    <div class="signature-box" style="width: 50%; float: left; text-align: center; font-size: 12px;">
      <div class="signature-title" style="font-weight: bold; margin-bottom: 65px;">QLCL / Người Giám Sát</div>
      <div class="signature-name" style="font-weight: bold;"></div>
    </div>
    <div class="clear" style="clear: both;"></div>
  </div>
</body>
</html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;

    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_Kiem_Soat_QC_Hang_Ngay_${selectedDateStr}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download fallback print file', err);
    }

    if (iframeDoc) {
      try {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('Direct print blocked by iframe sandbox:', e);
            alert(
              "⚠️ THÔNG BÁO QUAN TRỌNG (Hỗ trợ in ấn Phiếu QC):\n\n" +
              "Do cơ chế bảo mật (Sandbox) của AI Studio chặn lệnh in trực tiếp từ khung xem thử (iFrame):\n" +
              "1. Hệ thống đã tự động tải xuống phiếu in dạng file HTML chuẩn hóa (đầy đủ định dạng A4).\n" +
              "2. Hãy mở file HTML vừa tải xuống bằng trình duyệt của bạn (Chrome/Edge/Safari) và nhấn [Ctrl + P] để In hoặc Lưu PDF sắc nét.\n" +
              "3. Hoặc bấm nút 'Mở tab mới' (Open in new tab) ở thanh công cụ phía trên bên phải của AI Studio để chạy trực tiếp, lúc đó tính năng in trực tiếp sẽ hoạt động ngay lập tức!"
            );
          } finally {
            try {
              document.body.removeChild(iframe);
            } catch (_) {}
          }
        }, 300);
      } catch (err) {
        console.error(err);
      }
    }

    setIsPrintPreviewOpen(false);
  };

  const selectedTasksToPrint = activeTasks.filter(t => checkedTaskIds[t.id]);

  // Filter barcode categories based on search
  const filteredCategories = barcodeCategories.filter(bc => 
    bc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bc.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="qc-planning-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-3xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl border border-teal-100">
              <ListTodo className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Kế hoạch & Nội kiểm Hàng ngày
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Số hóa kế hoạch chạy QC năm cho từng hóa chất/vật tư và tự động lập, xuất phiếu công việc (worklist) kiểm soát hàng ngày theo tiêu chuẩn 2429-QĐ/BYT.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Year-Round QC Schedule Digitalization (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-3xs p-6 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Settings className="h-4 w-4 text-slate-500" />
                  Kế hoạch Nội kiểm Năm
                </h2>
                <p className="text-[11px] text-slate-500">Cấu hình tần suất chạy QC cho từng loại vật tư</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(!isAddingNew)}
                  className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-[11px] font-bold border border-teal-100 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm loại QC
                </button>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                  {barcodeCategories.length} QC
                </span>
              </div>
            </div>

            {/* Inline Add New Form */}
            {isAddingNew && (
              <form onSubmit={handleAddNewQC} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl mb-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Plus className="h-4 w-4 text-teal-600" />
                    Thêm Loại QC Mới
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingNew(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Mã QC (ví dụ: QC_AST)
                    </label>
                    <input
                      type="text"
                      placeholder="Mã QC..."
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Tên hóa chất / vật tư
                    </label>
                    <select
                      value={newName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewName(val);
                        const found = reagents.find(r => r.name === val);
                        if (found) {
                          setNewCategory(found.category);
                        }
                        if (!newCode && val) {
                          const initials = val
                            .replace(/[^a-zA-Z0-9\s]/g, '')
                            .split(/\s+/)
                            .map(w => w.charAt(0))
                            .join('')
                            .toUpperCase();
                          setNewCode('QC_' + initials);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                    >
                      <option value="">-- Chọn hóa chất/vật tư --</option>
                      {['Sinh hóa', 'Huyết học', 'Miễn dịch'].map((cat) => {
                        const catReagents = reagents.filter(r => r.category === cat);
                        if (catReagents.length === 0) return null;
                        return (
                          <optgroup key={cat} label={cat}>
                            {catReagents.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Bộ phận / Khoa phòng
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as LabCategory)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                  >
                    <option value="Sinh hóa">Sinh hóa</option>
                    <option value="Huyết học">Huyết học</option>
                    <option value="Miễn dịch">Miễn dịch</option>
                  </select>
                </div>

                <div className="flex justify-end gap-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-3 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-[10px] font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <Save className="h-3 w-3" />
                    Lưu danh mục
                  </button>
                </div>
              </form>
            )}

            {/* Search */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã QC, tên hóa chất..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white placeholder-slate-400 transition-all"
              />
            </div>

            {/* List and Configurator Panel */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[550px]">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Không tìm thấy danh mục QC nào phù hợp.
                </div>
              ) : (
                filteredCategories.map((bc) => {
                  const isEditing = activeConfigId === bc.id;
                  const freqText = getFrequencyText(bc);
                  const activeLot = getActiveLot(bc);
                  
                  return (
                    <div 
                      key={bc.id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        isEditing 
                          ? 'border-teal-500 bg-teal-50/20 ring-2 ring-teal-100' 
                          : 'border-slate-150 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {/* Item Info Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-slate-900 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md">
                              {bc.code}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              bc.category === 'Sinh hóa' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                              bc.category === 'Huyết học' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                              'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}>
                              {bc.category}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 mt-1.5 leading-tight">
                            {bc.name}
                          </h4>
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartConfig(bc)}
                              className="p-1.5 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
                              title="Cấu hình tần suất chạy QC"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteQC(bc.id, bc.name)}
                              className="p-1.5 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center"
                              title="Xóa loại QC này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Display Mode */}
                      {!isEditing ? (
                        <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Tần suất QC:</span>
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {freqText}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Số lô (LOT) hiện hành:</span>
                            <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded-sm text-[10px]">
                              {activeLot}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Editing Mode Inline Form */
                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
                          <div className="text-xs font-bold text-teal-800 flex items-center gap-1">
                            <Settings className="h-3 w-3" />
                            Thiết lập Tần suất Chạy QC
                          </div>

                          {/* Frequency Type Select */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Loại tần suất
                            </label>
                            <select
                              value={formFreqType}
                              onChange={(e) => setFormFreqType(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
                            >
                              <option value="daily">Hàng ngày (Mọi ngày)</option>
                              <option value="weekly">Thứ cố định trong tuần</option>
                              <option value="interval">Chu kỳ (Số ngày giãn cách)</option>
                              <option value="none">Tắt chạy QC (Không chạy)</option>
                            </select>
                          </div>

                          {/* Weekly options */}
                          {formFreqType === 'weekly' && (
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Chọn ngày chạy QC
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {WEEK_DAYS.map((day) => {
                                  const active = formWeeklyDays.includes(day.value);
                                  return (
                                    <button
                                      key={day.value}
                                      type="button"
                                      onClick={() => toggleWeeklyDay(day.value)}
                                      className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer border ${
                                        active 
                                          ? 'bg-teal-600 border-teal-600 text-white shadow-2xs' 
                                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      {day.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Interval options */}
                          {formFreqType === 'interval' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Giãn cách (ngày)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  value={formIntervalDays}
                                  onChange={(e) => setFormIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Ngày bắt đầu chu kỳ
                                </label>
                                <input
                                  type="date"
                                  value={formStartDate}
                                  onChange={(e) => setFormStartDate(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Form action buttons */}
                          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setActiveConfigId(null)}
                              className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveConfig(bc)}
                              className="px-2.5 py-1.5 text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Save className="h-3 w-3" />
                              Lưu lại
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Daily Task Generator & Daily Worklist (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-3xs p-6 flex flex-col h-full min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-4 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Danh sách Nội kiểm Ngày (Daily Worklist)
                </h2>
                <p className="text-[11px] text-slate-500">Hệ thống tự động lập danh sách công việc kiểm soát hàng ngày</p>
              </div>

              {/* Day selector */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-1.5 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 pl-1">Chọn ngày:</span>
                <input
                  type="date"
                  value={selectedDateStr}
                  onChange={(e) => setSelectedDateStr(e.target.value)}
                  className="px-2 py-0.5 text-xs font-semibold bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-teal-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Date Details & Quick summary */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-150 p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Thời điểm kiểm tra</span>
                <span className="text-xs font-bold text-slate-800">
                  {getDayNameVN(selectedDateStr)}, Ngày {formatDateVN(selectedDateStr)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block">Tổng số việc:</span>
                  <span className="text-xs font-bold text-slate-700">{activeTasks.length} mã QC cần thực hiện</span>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block">Đã chọn để in:</span>
                  <span className="text-xs font-extrabold text-teal-600">{selectedTasksToPrint.length} mã QC</span>
                </div>
              </div>
            </div>

            {/* Worklist Table */}
            <div className="flex-1 overflow-y-auto max-h-[420px] mb-4">
              {activeTasks.length === 0 ? (
                <div className="text-center py-16 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                  <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Không có lịch QC nào cần thực hiện trong ngày này</p>
                  <p className="text-[10px] text-slate-400 mt-1">Cấu hình lịch chạy QC năm ở cột bên trái để hiển thị danh sách tại đây.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" id="daily-worklist-table">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">
                          <button
                            type="button"
                            onClick={handleToggleAll}
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-500 cursor-pointer transition-all inline-flex items-center justify-center"
                          >
                            {allChecked ? (
                              <CheckSquare className="h-4 w-4 text-teal-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-2">Mã / Tên QC</th>
                        <th className="py-2.5 px-2">Khoa phòng / Bộ phận</th>
                        <th className="py-2.5 px-2 w-44">Số lô (LOT) hiện hành</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {activeTasks.map((task) => {
                        const isChecked = !!checkedTaskIds[task.id];
                        const activeLot = getActiveLot(task);
                        
                        return (
                          <tr 
                            key={task.id} 
                            className={`hover:bg-slate-50/50 transition-all ${
                              isChecked ? 'bg-teal-50/10' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleTask(task.id)}
                                className="p-1 hover:bg-slate-100 rounded-md text-slate-500 cursor-pointer transition-all inline-flex items-center justify-center"
                              >
                                {isChecked ? (
                                  <CheckSquare className="h-4 w-4 text-teal-600" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                            </td>

                            {/* Name & Code */}
                            <td className="py-3 px-2">
                              <div className="font-mono text-[10px] font-extrabold text-slate-500">
                                {task.code}
                              </div>
                              <div className="font-bold text-slate-800 leading-tight">
                                {task.name}
                              </div>
                              <div className="text-[10px] text-slate-400 italic">
                                {getFrequencyText(task)}
                              </div>
                            </td>

                            {/* Department / Category */}
                            <td className="py-3 px-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                task.category === 'Sinh hóa' ? 'bg-teal-50 text-teal-800 border border-teal-100' :
                                task.category === 'Huyết học' ? 'bg-sky-50 text-sky-800 border border-sky-100' :
                                'bg-purple-50 text-purple-800 border border-purple-100'
                              }`}>
                                Bộ phận {task.category}
                              </span>
                            </td>

                            {/* LOT current - EDITABLE */}
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">LÔ:</span>
                                <input
                                  type="text"
                                  value={activeLot}
                                  onChange={(e) => handleLotChange(task.id, e.target.value)}
                                  placeholder="Nhập số LOT..."
                                  className="w-full px-2 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500 focus:bg-white"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Print Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4 mt-auto shrink-0">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Số lô được tự động đề xuất từ hệ thống nhưng KTV có thể chỉnh sửa trực tiếp.</span>
              </div>
              <button
                type="button"
                disabled={selectedTasksToPrint.length === 0}
                onClick={() => setIsPrintPreviewOpen(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                  selectedTasksToPrint.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <Printer className="h-4 w-4" />
                In danh sách công việc ({selectedTasksToPrint.length})
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* PRINT PREVIEW MODAL / DIALOG */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4" id="print-preview-modal">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Printer className="h-4 w-4 text-slate-500" />
                  Bản xem trước phiếu in (Print Preview)
                </h3>
                <p className="text-[10px] text-slate-500">Biểu mẫu kiểm soát được xuất theo quy định vận hành 2429-QĐ/BYT</p>
              </div>
              <button
                onClick={() => setIsPrintPreviewOpen(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-full cursor-pointer transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Paper Canvas */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
              {/* Paper styled block (A4 Proportion) */}
              <div 
                id="print-area" 
                className="bg-white w-[210mm] min-h-[297mm] p-10 shadow-lg border border-slate-200 text-black flex flex-col"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              >
                {/* Hospital & Department Header */}
                <div className="flex justify-between items-start border-b border-black pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    {systemSettings?.hospitalLogo && (
                      <img 
                        src={systemSettings.hospitalLogo} 
                        alt="Hospital Logo" 
                        className="h-11 w-11 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div>
                      <h2 className="text-[11px] uppercase font-bold tracking-tight text-black">
                        SỞ Y TẾ THÀNH PHỐ CẦN THƠ
                      </h2>
                      <h1 className="text-[12px] uppercase font-extrabold text-black">
                        BỆNH VIỆN ĐA KHOA THÀNH PHỐ CẦN THƠ
                      </h1>
                      <h2 className="text-[11px] font-bold text-black border-t border-black/30 pt-0.5 mt-0.5">
                        KHOA XÉT NGHIỆM
                      </h2>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-black font-sans">
                    {systemSettings ? (
                      <>
                        <p>Số hiệu: <span className="font-bold">{systemSettings.headerRow1}</span></p>
                        <p>{systemSettings.headerRow2}</p>
                        <p>{systemSettings.headerRow3} <span className="font-medium">{systemSettings.headerRow4}</span></p>
                      </>
                    ) : (
                      <>
                        <p>Mã tài liệu: QT-QLCL-05-BM03</p>
                        <p>Phiên bản: 1.2 (2429-QĐ/BYT)</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="text-center my-6">
                  <h1 className="text-[18px] uppercase font-bold tracking-wider text-black">
                    PHIẾU KIỂM SOÁT NỘI KIỂM (QC) HÀNG NGÀY
                  </h1>
                  <p className="text-[12px] italic mt-1 text-black">
                    Ngày thực hiện: {getDayNameVN(selectedDateStr)}, ngày {formatDateVN(selectedDateStr)}
                  </p>
                </div>

                {/* Main Control Table */}
                <table className="w-full border-collapse border border-black text-[12px] text-black my-4">
                  <thead>
                    <tr className="bg-slate-100/30">
                      <th className="border border-black py-2 px-1 text-center font-bold w-12">STT</th>
                      <th className="border border-black py-2 px-3 text-left font-bold w-44">Tên QC / Mã Vật Tư</th>
                      <th className="border border-black py-2 px-3 text-left font-bold w-52">Hóa chất / Loại QC liên kết</th>
                      <th className="border border-black py-2 px-3 text-center font-bold w-36">Số lô (LOT) Hiện Hành</th>
                      <th className="border border-black py-2 px-3 text-left font-bold w-44">Các Test theo Kế hoạch</th>
                      <th className="border border-black py-2 px-2 text-center font-bold w-20">Xác nhận (Tick)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTasksToPrint.map((task, idx) => (
                      <tr key={task.id} className="h-10">
                        <td className="border border-black py-2 px-1 text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="border border-black py-2 px-3 text-left">
                          <p className="font-bold">{task.name}</p>
                          <p className="text-[10px] font-mono text-black/65">({task.code})</p>
                        </td>
                        <td className="border border-black py-2 px-3 text-left text-[11px]">
                          {getLinkedQcTypes(task)}
                        </td>
                        <td className="border border-black py-2 px-3 text-center font-mono font-bold">
                          {getActiveLot(task)}
                        </td>
                        <td className="border border-black py-2 px-3 text-left">
                          {getTestsForBarcodeCategory(task)}
                        </td>
                        <td className="border border-black py-2 px-2 text-center">
                          <span className="inline-block w-3.5 h-3.5 border border-black rounded-xs mt-1"></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Rules / Note section */}
                <div className="mt-6 text-[11px] italic text-black/90 space-y-1">
                  <p className="font-bold">* Hướng dẫn ghi nhận:</p>
                  <p>- Kỹ thuật viên (KTV) chạy xong kết quả QC, đối chiếu biểu đồ Levey-Jennings.</p>
                  <p>- Ký xác nhận vào ô trống nếu QC ĐẠT. Trường hợp QC LỖI (Vi phạm Westgard), ghi nhận biên bản khắc phục sự cố QC riêng kèm theo.</p>
                </div>

                {/* Signatures section */}
                <div className="mt-12 grid grid-cols-2 text-center text-[12px] text-black gap-12 mt-auto pb-6">
                  <div>
                    <p className="font-bold">KTV Thực Hiện</p>
                    <p className="text-[11px] italic text-black/65">(Ký, ghi rõ họ tên)</p>
                    <div className="h-20"></div>
                    <p className="font-bold text-black/80">{currentUser?.fullName || 'Kỹ thuật viên'}</p>
                  </div>
                  <div>
                    <p className="font-bold">QLCL / Người Giám Sát</p>
                    <p className="text-[11px] italic text-black/65">(Ký, kiểm tra chất lượng)</p>
                    <div className="h-20"></div>
                    <p className="border-t border-dashed border-black/30 w-3/4 mx-auto pt-2 text-black/30"></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-150 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Lưu ý: Mẫu in này tuân thủ các quy tắc hiển thị chuẩn A4. Click nút để xuất lệnh in hệ thống.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Quay lại sửa đổi
                </button>
                <button
                  onClick={handlePrint}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  Xác nhận In (Print)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Global CSS Style tag to override printing format */}
      <style>{`
        @media print {
          /* Hide all general body elements */
          body * {
            visibility: hidden !important;
          }
          
          /* Show ONLY the print area and its contents */
          #print-area, #print-area * {
            visibility: visible !important;
          }
          
          /* Override modal and parent layouts to let the print area take up the page */
          #print-preview-modal {
            visibility: visible !important;
            background: transparent !important;
            backdrop-filter: none !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Style the modal container wrapper to be transparent and not clip */
          #print-preview-modal > div {
            visibility: visible !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            max-width: none !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Style the print canvas to print beautifully as an A4 document */
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  );
}
