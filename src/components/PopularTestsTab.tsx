import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Settings, 
  Layers, 
  FileText, 
  AlertCircle 
} from 'lucide-react';
import { PopularTest, User, TestGroup } from '../types';

interface PopularTestsTabProps {
  popularTests: PopularTest[];
  onSavePopularTest: (test: PopularTest) => void;
  onDeletePopularTest: (id: string) => void;
  testGroups?: TestGroup[];
  onSaveTestGroup?: (group: TestGroup) => void;
  onDeleteTestGroup?: (id: string) => void;
  currentUser: User;
}

export default function PopularTestsTab({
  popularTests,
  onSavePopularTest,
  onDeletePopularTest,
  testGroups = [],
  onSaveTestGroup,
  onDeleteTestGroup,
  currentUser
}: PopularTestsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newTestName, setNewTestName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States for Group creation
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTestsInGroup, setSelectedTestsInGroup] = useState<string[]>([]);
  const [groupErrorMsg, setGroupErrorMsg] = useState<string | null>(null);

  // Filter tests based on search query
  const filteredTests = popularTests.filter(test => 
    test.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle adding a new test
  const handleAddTest = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = newTestName.trim();
    if (!name) {
      setErrorMsg('Vui lòng nhập tên test!');
      return;
    }

    // Check for duplicates (case-insensitive)
    const exists = popularTests.some(
      t => t.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setErrorMsg(`Test "${name}" đã tồn tại trong danh mục chọn nhanh!`);
      return;
    }

    // Enforce matching ID format: alphanumeric plus underscore or hyphen
    const id = name.replace(/[^a-zA-Z0-9_\-]/g, '_');

    onSavePopularTest({
      id,
      name
    });

    setNewTestName('');
  };

  // Handle deleting a test
  const handleDeleteTest = (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa test "${name}" khỏi danh mục chọn nhanh? Thao tác này sẽ không ảnh hưởng đến các hóa chất đã được gán test này trước đó.`)) {
      onDeletePopularTest(id);
    }
  };

  // Handle creating a test group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setGroupErrorMsg(null);

    const name = newGroupName.trim();
    if (!name) {
      setGroupErrorMsg('Vui lòng nhập tên nhóm test!');
      return;
    }

    if (selectedTestsInGroup.length === 0) {
      setGroupErrorMsg('Vui lòng chọn ít nhất một test cho nhóm này!');
      return;
    }

    // Check for duplicates (case-insensitive)
    const exists = testGroups.some(
      g => g.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setGroupErrorMsg(`Nhóm test "${name}" đã tồn tại!`);
      return;
    }

    const id = 'group_' + name.replace(/[^a-zA-Z0-9_\-]/g, '_') + '_' + Date.now();

    if (onSaveTestGroup) {
      onSaveTestGroup({
        id,
        name,
        testNames: selectedTestsInGroup
      });
    }

    setNewGroupName('');
    setSelectedTestsInGroup([]);
  };

  // Handle deleting a test group
  const handleDeleteGroup = (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa nhóm test "${name}"? Các hóa chất đã gán các test này vẫn sẽ giữ nguyên.`)) {
      if (onDeleteTestGroup) {
        onDeleteTestGroup(id);
      }
    }
  };

  return (
    <div className="space-y-6" id="popular-tests-tab-root">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-teal-50 rounded-xl text-teal-600 shrink-0">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 font-display">
              Khai báo Danh mục Test & Nhóm Test Phổ biến
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Cấu hình các chỉ số xét nghiệm và nhóm test (profiles) hiển thị tại <strong>Vùng chọn nhanh</strong> khi thêm mới hoặc chỉnh sửa thông tin Hóa chất / Vật tư Xét nghiệm.
            </p>
          </div>
        </div>

        {/* Quick info status badge */}
        <div className="flex items-center gap-1.5 self-start md:self-auto text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-600">
          <Layers className="h-4 w-4 text-teal-600" />
          <span>Tổng số test: <strong>{popularTests.length}</strong> | Nhóm test: <strong>{testGroups.length}</strong></span>
        </div>
      </div>

      {/* Control area: Add & Search (Part 1 - Individual Tests) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form to Add New Test */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs h-fit space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plus className="h-4 w-4 text-teal-600" /> Thêm Test mới chọn nhanh
          </h3>

          <form onSubmit={handleAddTest} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tên chỉ số xét nghiệm (Test) *</label>
              <input
                type="text"
                required
                value={newTestName}
                onChange={(e) => {
                  setNewTestName(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Ví dụ: HEV, HBeAg, FT4, Na+..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all font-mono uppercase"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Thêm vào danh sách chọn nhanh
            </button>
          </form>

          {/* Guidelines */}
          <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-xl space-y-2 text-[11px] text-amber-900">
            <div className="flex items-center gap-1.5 font-bold">
              <FileText className="h-3.5 w-3.5 text-amber-600" />
              <span>Hướng dẫn sử dụng:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 leading-relaxed">
              <li>Mỗi test thêm mới sẽ xuất hiện ngay lập tức trong bảng chọn nhanh ở form Thêm/Sửa hóa chất.</li>
              <li>Bạn nên đặt tên ngắn gọn, rõ ràng theo đúng ký hiệu chuyên môn xét nghiệm (ví dụ: AST, ALT, Glucose).</li>
            </ul>
          </div>
        </div>

        {/* List of Current Tests */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs lg:col-span-2 space-y-4">
          
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              🧬 Danh sách Test chọn nhanh hiện tại
            </h3>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhanh tên test..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all font-mono"
              />
            </div>
          </div>

          {/* Test items grid */}
          {filteredTests.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredTests.map((test) => (
                <div 
                  key={test.id}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl transition-all group"
                >
                  <span className="text-xs font-bold font-mono text-slate-700 truncate" title={test.name}>
                    {test.name}
                  </span>
                  
                  {/* Delete button (visible on hover) */}
                  <button
                    onClick={() => handleDeleteTest(test.id, test.name)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    title={`Xóa test ${test.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Không tìm thấy chỉ số xét nghiệm nào</p>
              <p className="text-[10px] text-slate-400 mt-1">Hãy thử nhập từ khóa tìm kiếm khác hoặc thêm test mới ở bên trái.</p>
            </div>
          )}

        </div>

      </div>

      {/* Control area: Test Groups (Part 2 - Nhóm Test) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
        
        {/* Form to Add Test Group */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs h-fit space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plus className="h-4 w-4 text-teal-600" /> Tạo Nhóm Test mới (Profiles)
          </h3>

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tên Nhóm Test *</label>
              <input
                type="text"
                required
                value={newGroupName}
                onChange={(e) => {
                  setNewGroupName(e.target.value);
                  setGroupErrorMsg(null);
                }}
                placeholder="Ví dụ: ĐƯỜNG HUYẾT, CHỨC NĂNG GAN..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all font-bold uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Chọn các Test trong Nhóm *</label>
              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-2">
                {popularTests.map((test) => {
                  const isChecked = selectedTestsInGroup.includes(test.name);
                  return (
                    <label key={test.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-white/60 p-1.5 rounded-md transition-all">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedTestsInGroup(selectedTestsInGroup.filter(name => name !== test.name));
                          } else {
                            setSelectedTestsInGroup([...selectedTestsInGroup, test.name]);
                          }
                          setGroupErrorMsg(null);
                        }}
                        className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span className="font-mono font-bold">{test.name}</span>
                    </label>
                  );
                })}
                {popularTests.length === 0 && (
                  <p className="text-[11px] text-slate-400 italic text-center py-4">Vui lòng khai báo danh sách test trước</p>
                )}
              </div>
            </div>

            {groupErrorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                <span>{groupErrorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Lưu Nhóm Test
            </button>
          </form>
        </div>

        {/* List of Test Groups */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            📂 Danh sách các Nhóm Test hiện tại
          </h3>

          {testGroups.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {testGroups.map((group) => (
                <div 
                  key={group.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 hover:bg-slate-100/60 border border-slate-200/80 rounded-2xl transition-all"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                      {group.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Các test trong nhóm: <span className="font-mono text-teal-700 font-bold">{group.testNames.join(', ')}</span>
                    </p>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    className="self-end sm:self-auto px-2.5 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa nhóm
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Layers className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Chưa có Nhóm Test nào được tạo</p>
              <p className="text-[10px] text-slate-400 mt-1">Sử dụng biểu mẫu bên trái để gộp nhiều chỉ số thành một nhóm chọn nhanh.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
