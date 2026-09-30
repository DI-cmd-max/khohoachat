import { ReagentMaterial, Transaction, ReconstitutionLog, InUseStability, IsoWarning, SystemSettings } from './types';

// Helper to parse date strings properly
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr);
}

// Format Date to YYYY-MM-DD
export function formatDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Calculate after-opening (in-use) expiry date
export function calculateInUseExpiry(openedDateStr: string, stabilityDays: number, originalExpiryStr: string): string {
  const openedDate = new Date(openedDateStr);
  const inUseExpiryDate = new Date(openedDate.getTime() + stabilityDays * 24 * 60 * 60 * 1000);
  const originalExpiryDate = new Date(originalExpiryStr);

  // Expiry is the earlier of original expiry and calculated open stability expiry
  const actualExpiry = inUseExpiryDate < originalExpiryDate ? inUseExpiryDate : originalExpiryDate;
  return formatDateString(actualExpiry);
}

// Format date and time for vietnamese locale
export function formatDateTimeVN(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${timePart} - ${datePart}`;
  } catch (e) {
    return isoStr;
  }
}

export function formatDateVN(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

// Calculate 2429-QĐ/BYT warnings dynamically based on active state and simulated current time
export function generateIsoWarnings(
  reagents: ReagentMaterial[],
  inUseItems: InUseStability[],
  reconstitutions: ReconstitutionLog[],
  simulatedTimeStr: string // ISO string
): IsoWarning[] {
  const warnings: IsoWarning[] = [];
  const simulatedTime = new Date(simulatedTimeStr);
  const simulatedTimeMs = simulatedTime.getTime();
  const simulatedDateOnlyStr = formatDateString(simulatedTime);
  const simulatedDateOnly = new Date(simulatedDateOnlyStr);

  // 1. ORIGINAL EXPIRY WARNINGS
  reagents.forEach(reagent => {
    const expiryDate = new Date(reagent.originalExpiryDate);
    const diffTime = expiryDate.getTime() - simulatedDateOnly.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      warnings.push({
        id: `W-EXP-ORIG-CRIT-${reagent.id}`,
        type: 'EXPIRY_ORIGINAL',
        severity: 'CRITICAL',
        itemName: reagent.name,
        category: reagent.category,
        message: `Hóa chất đã hết hạn sử dụng gốc (Lô: ${reagent.lotNumber})`,
        details: `Hạn dùng gốc: ${formatDateVN(reagent.originalExpiryDate)} (Đã quá hạn ${Math.abs(diffDays)} ngày). Theo 2429-QĐ/BYT, ngưng sử dụng ngay lập tức!`,
        relatedId: reagent.id
      });
    } else if (diffDays <= 30) {
      warnings.push({
        id: `W-EXP-ORIG-WARN-${reagent.id}`,
        type: 'EXPIRY_ORIGINAL',
        severity: 'WARNING',
        itemName: reagent.name,
        category: reagent.category,
        message: `Hóa chất sắp hết hạn sử dụng gốc (Còn ${diffDays} ngày)`,
        details: `Hạn dùng gốc: ${formatDateVN(reagent.originalExpiryDate)} (Lô: ${reagent.lotNumber}). Lên kế hoạch đặt hàng bổ sung và sử dụng trước.`,
        relatedId: reagent.id
      });
    }
  });

  // 2. IN-USE STABILITY WARNINGS
  inUseItems.forEach(item => {
    if (item.status !== 'active') return;

    const calcExpiryDate = new Date(item.calculatedExpiry);
    const diffTime = calcExpiryDate.getTime() - simulatedDateOnly.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      warnings.push({
        id: `W-EXP-INUSE-CRIT-${item.id}`,
        type: 'EXPIRY_IN_USE',
        severity: 'CRITICAL',
        itemName: item.reagentName,
        category: item.category,
        message: `Hóa chất mở nắp hết hạn dùng trên máy (In-use Stability)`,
        details: `Hạn mở nắp tối đa: ${formatDateVN(item.calculatedExpiry)} (Lô: ${item.lotNumber}, Vị trí: ${item.positionInMachine}). Đã quá hạn mở nắp ${Math.abs(diffDays)} ngày. Nguy cơ sai lệch kết quả xét nghiệm!`,
        relatedId: item.id
      });
    } else if (diffDays <= 3) {
      warnings.push({
        id: `W-EXP-INUSE-WARN-${item.id}`,
        type: 'EXPIRY_IN_USE',
        severity: 'WARNING',
        itemName: item.reagentName,
        category: item.category,
        message: `Hóa chất mở nắp sắp hết hạn dùng trên máy (Còn ${diffDays} ngày)`,
        details: `Hạn dùng sau mở nắp: ${formatDateVN(item.calculatedExpiry)} (Lô: ${item.lotNumber}, Vị trí: ${item.positionInMachine}). Hãy chuẩn bị sẵn hộp hóa chất mới để thay thế.`,
        relatedId: item.id
      });
    }
  });

  // 3. LOW STOCK WARNINGS
  reagents.forEach(reagent => {
    if (reagent.currentStock === 0) {
      warnings.push({
        id: `W-STOCK-CRIT-${reagent.id}`,
        type: 'LOW_STOCK',
        severity: 'CRITICAL',
        itemName: reagent.name,
        category: reagent.category,
        message: `Hết hàng tồn kho!`,
        details: `Sản phẩm hiện không còn trong kho lẻ/kho chính. Cần liên hệ phòng vật tư khẩn cấp để tránh gián đoạn xét nghiệm bệnh nhân.`,
        relatedId: reagent.id
      });
    } else if (reagent.currentStock < reagent.minStockLimit) {
      warnings.push({
        id: `W-STOCK-WARN-${reagent.id}`,
        type: 'LOW_STOCK',
        severity: 'WARNING',
        itemName: reagent.name,
        category: reagent.category,
        message: `Tồn kho dưới mức tối thiểu (${reagent.currentStock}/${reagent.minStockLimit} ${reagent.unit})`,
        details: `Mức tồn kho hiện tại (${reagent.currentStock}) thấp hơn ngưỡng an toàn quy định (${reagent.minStockLimit} ${reagent.unit}).`,
        relatedId: reagent.id
      });
    }
  });

  // 4. RECONSTITUTED WARNINGS
  reconstitutions.forEach(recon => {
    if (recon.status !== 'Đang sử dụng') return;

    const expiryTime = new Date(recon.expiryTimestamp).getTime();
    const diffMs = expiryTime - simulatedTimeMs;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs <= 0) {
      warnings.push({
        id: `W-RECON-CRIT-${recon.id}`,
        type: 'EXPIRY_RECONSTITUTED',
        severity: 'CRITICAL',
        itemName: recon.targetItemName,
        category: recon.category,
        message: `Chất hoàn nguyên/pha đã hết hạn sử dụng!`,
        details: `Hạn dùng hoàn nguyên: ${formatDateTimeVN(recon.expiryTimestamp)} (Lô gốc: ${recon.sourceLot}). Đã hết hạn. Hủy bỏ và pha lọ mới trước khi chạy Calib/QC!`,
        relatedId: recon.id
      });
    } else if (diffHours <= 2) {
      const minsLeft = Math.ceil(diffMs / (1000 * 60));
      warnings.push({
        id: `W-RECON-WARN-${recon.id}`,
        type: 'EXPIRY_RECONSTITUTED',
        severity: 'WARNING',
        itemName: recon.targetItemName,
        category: recon.category,
        message: `Chất hoàn nguyên/pha sắp hết hạn (Còn ${minsLeft} phút)`,
        details: `Hạn dùng hoàn nguyên: ${formatDateTimeVN(recon.expiryTimestamp)} (Lô gốc: ${recon.sourceLot}, Pha bởi: ${recon.preparedBy}). Sắp hết độ ổn định.`,
        relatedId: recon.id
      });
    }
  });

  return warnings;
}

// Local Storage helpers
export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error(`Error loading key ${key} from localStorage`, e);
  }
  return defaultValue;
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving key ${key} to localStorage`, e);
  }
}

// 15. Excel Export Helper with Gridlines & UTF-8 for Vietnamese
export function exportToExcel(data: any[], headers: string[], keys: string[], filename: string, formatters?: Record<string, (val: any, row?: any) => string>) {
  let xml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
  xml += `<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>`;
  xml += `<table border="1">`;
  
  // Headers
  xml += `<tr style="background-color: #0f766e; color: #ffffff; font-weight: bold; text-align: left;">`;
  headers.forEach(h => {
    xml += `<th>${h}</th>`;
  });
  xml += `</tr>`;
  
  // Rows
  data.forEach(item => {
    xml += `<tr>`;
    keys.forEach(key => {
      let val = item[key];
      if (formatters && formatters[key]) {
        val = formatters[key](val, item);
      }
      if (val === undefined || val === null) val = '';
      xml += `<td>${val}</td>`;
    });
    xml += `</tr>`;
  });
  xml += `</table></body></html>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// 16. PDF Export / Print Helper styled according to 2429-QĐ/BYT
export function exportToPDF(
  reportTitle: string,
  headers: string[],
  keys: string[],
  data: any[],
  formatters?: Record<string, (val: any, row?: any) => string>,
  settings?: SystemSettings
) {
  const nowStr = formatDateTimeVN(new Date().toISOString());
  
  let html = `
    <html>
    <head>
      <title>${reportTitle}</title>
      <style>
        body {
          font-family: "Segoe UI", Arial, sans-serif;
          color: #1e293b;
          margin: 40px;
          font-size: 11px;
          line-height: 1.4;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        .header-left {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          color: #0f766e;
          width: 50%;
          text-align: left;
        }
        .header-right {
          font-size: 11px;
          text-align: right;
          color: #64748b;
          width: 50%;
        }
        .report-title {
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
          margin: 15px 0 5px 0;
          color: #0f172a;
          letter-spacing: 0.5px;
        }
        .report-subtitle {
          font-size: 11px;
          text-align: center;
          color: #64748b;
          margin-bottom: 30px;
          font-style: italic;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .data-table th {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 8px 6px;
          font-weight: bold;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          color: #334155;
        }
        .data-table td {
          border: 1px solid #cbd5e1;
          padding: 7px 6px;
          font-size: 10px;
          word-break: break-word;
        }
        .data-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .signatures-container {
          margin-top: 40px;
          width: 100%;
          page-break-inside: avoid;
        }
        .signature-box {
          width: 50%;
          text-align: center;
          float: left;
          font-size: 11px;
        }
        .signature-title {
          font-weight: bold;
          margin-bottom: 60px;
          color: #334155;
        }
        .signature-name {
          font-style: italic;
          color: #64748b;
        }
        .clear {
          clear: both;
        }
        @media print {
          body { margin: 20px; }
          @page { size: portrait; margin: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td class="header-left">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${settings?.hospitalLogo ? `<img src="${settings.hospitalLogo}" style="height: 48px; max-width: 48px; object-fit: contain; margin-right: 12px; float: left;" referrerPolicy="no-referrer" />` : ''}
              <div style="float: left; text-align: left;">
                SỞ Y TẾ THÀNH PHỐ CẦN THƠ<br/>
                BỆNH VIỆN ĐA KHOA THÀNH PHỐ CẦN THƠ<br/>
                <span style="font-size: 11px; font-weight: 800; text-decoration: underline;">KHOA XÉT NGHIỆM BVĐKTPCT</span>
              </div>
              <div style="clear: both;"></div>
            </div>
          </td>
          <td class="header-right" style="font-size: 10px; line-height: 1.4; text-align: right; color: #475569;">
            ${settings ? `
              Số hiệu: <span style="font-weight: bold; color: #1e293b;">${settings.headerRow1}</span><br/>
              ${settings.headerRow2}<br/>
              ${settings.headerRow3} <span style="font-weight: 500; color: #1e293b;">${settings.headerRow4}</span>
            ` : `
              Mã số tài liệu: QT-QLK-04<br/>
              Phiên bản: 2.0 (2429-QĐ/BYT)<br/>
              Ngày hiệu lực: 15/07/2026
            `}
          </td>
        </tr>
      </table>

      <div class="report-title">${reportTitle}</div>
      <div class="report-subtitle">Thời gian xuất báo cáo: ${nowStr} (Theo chuẩn kiểm soát chất lượng 2429-QĐ/BYT)</div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 4%; text-align: center;">STT</th>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map((row, index) => {
            return `
              <tr>
                <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                ${keys.map(k => {
                  let val = row[k];
                  if (formatters && formatters[k]) {
                    val = formatters[k](val, row);
                  }
                  if (val === undefined || val === null) val = '';
                  return `<td>${val}</td>`;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="signatures-container">
        <div class="signature-box">
          <div class="signature-title">NGƯỜI LẬP BÁO CÁO</div>
          <div style="margin-bottom: 45px; color: #cbd5e1;">&nbsp;</div>
          <div class="signature-name">&nbsp;</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">TRƯỞNG KHOA XÉT NGHIỆM</div>
          <div style="margin-bottom: 45px; color: #cbd5e1;">&nbsp;</div>
          <div class="signature-name">Ths. Nguyễn Dương Hiển</div>
        </div>
        <div class="clear"></div>
      </div>
    </body>
    </html>
  `;

  // Create clean iframe for print to avoid disturbing user UI
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  
  // Download as a fully styled offline HTML report immediately
  // This is highly reliable inside iframe environments and allows easy print via any browser
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/\s+/g, '_')}_ISO15189.html`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download offline HTML fallback', err);
  }

  if (iframeDoc) {
    try {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      
      // Trigger print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Direct print blocked by iframe sandbox restriction:', e);
          alert(
            "⚠️ THÔNG BÁO QUAN TRỌNG (Hỗ trợ in ấn 2429-QĐ/BYT):\n\n" +
            "Do cơ chế bảo mật (Sandbox) của AI Studio chặn lệnh in trực tiếp từ khung xem thử (iFrame):\n" +
            "1. Ứng dụng đã tự động tải xuống file báo cáo dạng HTML chuẩn hóa.\n" +
            "2. Hãy mở file HTML vừa tải xuống bằng Chrome/Edge và nhấn [Ctrl + P] để Lưu PDF hoặc In sắc nét.\n" +
            "3. Hoặc bấm nút 'Mở tab mới' (Open in new tab) ở thanh công cụ phía trên bên phải của AI Studio để chạy chế độ toàn màn hình, lệnh in trực tiếp sẽ hoạt động ngay lập tức!"
          );
        } finally {
          try {
            document.body.removeChild(iframe);
          } catch (_) {}
        }
      }, 500);
    } catch (err) {
      console.error(err);
    }
  } else {
    // Fallback to new tab if iframe fails
    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.print();
      }
    } catch (err) {
      console.warn('Popup blocked, fallback to file download completed.', err);
    }
  }
}

export interface ForecastResult {
  reagentId: string;
  reagentName: string;
  lotNumber: string;
  category: string;
  packSize: string;
  currentStock: number;
  consumedQty: number;
  forecastQty: number;
}

export function calculateSmartForecasting(
  reagents: ReagentMaterial[],
  transactions: Transaction[],
  simulatedTimeStr: string
): ForecastResult[] {
  const simulatedTime = new Date(simulatedTimeStr);
  const thirtyDaysAgoMs = simulatedTime.getTime() - 30 * 24 * 60 * 60 * 1000;

  // Filter transactions within the last 30 days
  const recentTx = transactions.filter(tx => {
    const txTime = new Date(tx.timestamp).getTime();
    return txTime >= thirtyDaysAgoMs && txTime <= simulatedTime.getTime();
  });

  return reagents.map(reagent => {
    const reagentTxs = recentTx.filter(tx => tx.reagentId === reagent.id);
    const consumedQty = reagentTxs
      .filter(tx => tx.type === 'xuat' || tx.type === 'linh')
      .reduce((sum, tx) => sum + tx.quantity, 0);

    const forecastQty = consumedQty - reagent.currentStock;

    return {
      reagentId: reagent.id,
      reagentName: reagent.name,
      lotNumber: reagent.lotNumber,
      category: reagent.category,
      packSize: reagent.packSize,
      currentStock: reagent.currentStock,
      consumedQty,
      forecastQty,
    };
  }).filter(item => item.forecastQty > 0);
}


