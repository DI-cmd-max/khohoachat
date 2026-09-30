import React, { useState } from 'react';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  Download, 
  Calendar, 
  FileSpreadsheet, 
  FileText,
  Clock
} from 'lucide-react';
import { Transaction, LabCategory, TransactionType, SystemSettings } from '../types';
import { formatDateTimeVN, exportToExcel, exportToPDF } from '../utils';

interface TransactionsTabProps {
  transactions: Transaction[];
  onClearTransactions: () => void;
  systemSettings?: SystemSettings;
}

export default function TransactionsTab({
  transactions,
  onClearTransactions,
  systemSettings,
}: TransactionsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | TransactionType>('All');
  const [categoryFilter, setCategoryFilter] = useState<LabCategory | 'All'>('All');

  // Selection state for export
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (transactions && transactions.length > 0) {
      setSelectedTxIds(prev => {
        const itemIds = transactions.map(item => item.id);
        if (prev.length === 0) return itemIds;
        return prev.filter(id => itemIds.includes(id));
      });
    }
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.reagentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          tx.actor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'All' || tx.type === typeFilter;
    const matchesCategory = categoryFilter === 'All' || tx.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredIds = filteredTransactions.map(tx => tx.id);
  const selectedFilteredIds = filteredIds.filter(id => selectedTxIds.includes(id));
  const isAllFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedTxIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedTxIds(prev => {
        const next = [...prev];
        filteredIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedTxIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Function to simulate exporting CSV
  const handleExportCSV = () => {
    try {
      // Create CSV content
      const headers = ['Mã GD', 'Thời gian', 'Tên hóa chất', 'Khoa phòng', 'Loại giao dịch', 'Số lượng', 'Người thực hiện', 'Ghi chú'];
      const exportData = filteredTransactions.filter(tx => selectedTxIds.includes(tx.id));
      if (exportData.length === 0) {
        alert('Vui lòng chọn ít nhất một giao dịch để xuất CSV!');
        return;
      }
      const rows = exportData.map(tx => [
        tx.id,
        formatDateTimeVN(tx.timestamp),
        `"${tx.reagentName.replace(/"/g, '""')}"`,
        tx.category,
        tx.type === 'nhap' ? 'Nhập kho' : tx.type === 'linh' ? 'Cấp phát/Lĩnh' : 'Xuất hủy',
        tx.quantity,
        `"${tx.actor.replace(/"/g, '""')}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Nhat_ky_Kho_Xet_Nghiem_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Không thể xuất báo cáo vào thời điểm này.');
    }
  };

  const handleExportPDFReport = () => {
    const headers = ['Thời gian giao dịch', 'Tên hóa chất / vật tư', 'Khoa phòng', 'Loại giao dịch', 'Số lượng', 'Người thực hiện', 'Ghi chú'];
    const keys = ['timestamp', 'reagentName', 'category', 'typeDisplay', 'quantity', 'actor', 'notes'];
    const formatters = {
      timestamp: (val: any) => formatDateTimeVN(val),
      typeDisplay: (val: any, row: any) => row.type === 'nhap' ? 'Nhập kho' : row.type === 'linh' ? 'Cấp phát/Lĩnh' : 'Xuất hủy',
      quantity: (val: any, row: any) => `${val} ${row.unit || ''}`
    };
    const exportData = filteredTransactions.filter(tx => selectedTxIds.includes(tx.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một giao dịch để xuất PDF!');
      return;
    }
    exportToPDF('BÁO CÁO NHẬT KÝ GIAO DỊCH NHẬP - XUẤT KHO HÓA CHẤT', headers, keys, exportData, formatters, systemSettings);
  };

  const handleExportExcelReport = () => {
    const headers = ['Thời gian giao dịch', 'Tên hóa chất / vật tư', 'Khoa phòng', 'Loại giao dịch', 'Số lượng', 'Người thực hiện', 'Ghi chú'];
    const keys = ['timestamp', 'reagentName', 'category', 'typeDisplay', 'quantity', 'actor', 'notes'];
    const formatters = {
      timestamp: (val: any) => formatDateTimeVN(val),
      typeDisplay: (val: any, row: any) => row.type === 'nhap' ? 'Nhập kho' : row.type === 'linh' ? 'Cấp phát/Lĩnh' : 'Xuất hủy',
      quantity: (val: any, row: any) => `${val} ${row.unit || ''}`
    };
    const exportData = filteredTransactions.filter(tx => selectedTxIds.includes(tx.id));
    if (exportData.length === 0) {
      alert('Vui lòng chọn ít nhất một giao dịch để xuất Excel!');
      return;
    }
    exportToExcel(exportData, headers, keys, 'Nhat_Ky_Giao_Dich_Kho_ISO_15189', formatters);
  };

  return (
    <div className="space-y-4" id="transactions-tab-root">
      
      {/* Control bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, người lĩnh, ghi chú..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
          
          {/* Category Filter */}
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

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 cursor-pointer"
          >
            <option value="All">Tất cả loại giao dịch</option>
            <option value="nhap">Nhập kho (+)</option>
            <option value="linh">Lĩnh về phòng xét nghiệm (-)</option>
            <option value="xuat">Xuất hủy / Hao phí (-)</option>
          </select>

          {/* Export buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPDFReport}
              disabled={filteredTransactions.length === 0}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1 transition-all cursor-pointer ${
                filteredTransactions.length === 0
                  ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
              }`}
              title="Xuất báo cáo PDF tiêu chuẩn 2429-QĐ/BYT"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              <span>Xuất PDF</span>
            </button>
            <button
              onClick={handleExportExcelReport}
              disabled={filteredTransactions.length === 0}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1 transition-all cursor-pointer ${
                filteredTransactions.length === 0
                  ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-2xs'
              }`}
              title="Xuất dữ liệu Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
          </div>

          {/* Clear logs button */}
          <button
            onClick={() => {
              if (confirm('Bạn có chắc muốn xóa lịch sử nhật ký kho này? Dữ liệu tồn kho hiện tại sẽ không bị ảnh hưởng, nhưng lịch sử giao dịch sẽ bị xóa sạch.')) {
                onClearTransactions();
              }
            }}
            className="px-3 py-2 text-xs text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl transition-all cursor-pointer font-medium"
          >
            Xóa lịch sử
          </button>

        </div>

      </div>

      {/* Main Grid table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <input 
                    type="checkbox"
                    id="checkbox-all-txs"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                    title="Chọn tất cả"
                  />
                </th>
                <th className="px-5 py-3">Mã GD</th>
                <th className="px-4 py-3">Thời điểm thực hiện</th>
                <th className="px-4 py-3">Mặt hàng y tế</th>
                <th className="px-4 py-3">Khoa phòng</th>
                <th className="px-4 py-3">Loại GD</th>
                <th className="px-4 py-3 text-center">Số lượng</th>
                <th className="px-4 py-3">Cán bộ thực hiện</th>
                <th className="px-5 py-3">Lý do & Ghi chú chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Không tìm thấy bản ghi giao dịch nào.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-all">
                    
                    {/* Checkbox */}
                    <td className="px-3 py-4 w-10 text-center">
                      <input 
                        type="checkbox"
                        id={`checkbox-tx-${tx.id}`}
                        checked={selectedTxIds.includes(tx.id)}
                        onChange={() => handleToggleSelectRow(tx.id)}
                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                      />
                    </td>
                    
                    {/* Transaction ID */}
                    <td className="px-5 py-4 whitespace-nowrap font-mono font-semibold text-slate-500">
                      {tx.id}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600 font-medium">
                      {formatDateTimeVN(tx.timestamp)}
                    </td>

                    {/* Reagent Name */}
                    <td className="px-4 py-4 font-bold text-slate-800">
                      {tx.reagentName}
                      <span className="block text-[10px] text-slate-400 font-mono font-normal">ID mặt hàng: {tx.reagentId}</span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        tx.category === 'Sinh hóa' ? 'bg-teal-50 text-teal-700' :
                        tx.category === 'Huyết học' ? 'bg-sky-50 text-sky-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {tx.category}
                      </span>
                    </td>

                    {/* Transaction Type Indicator */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {tx.type === 'nhap' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowUpRight className="h-3 w-3" /> Nhập kho
                        </span>
                      ) : tx.type === 'linh' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <ArrowDownLeft className="h-3 w-3" /> Lĩnh dùng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Trash2 className="h-3 w-3" /> Xuất hủy
                        </span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-4 whitespace-nowrap text-center font-bold font-mono text-sm">
                      <span className={tx.type === 'nhap' ? 'text-emerald-600' : tx.type === 'linh' ? 'text-blue-600' : 'text-rose-600'}>
                        {tx.type === 'nhap' ? '+' : '-'}{tx.quantity}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-700">
                      {tx.actor}
                    </td>

                    {/* Notes */}
                    <td className="px-5 py-4 text-slate-500 max-w-xs truncate" title={tx.notes}>
                      {tx.notes}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
