import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, User as UserIcon, Lock, ClipboardList, CheckCircle, AlertCircle, Users, Trash2 } from 'lucide-react';
import { User } from '../types';
import { subscribeToCollection, saveUser, deleteUserFromDb } from '../firebase';

interface UsersTabProps {
  currentUser: User;
}

export default function UsersTab({ currentUser }: UsersTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('KTV');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canModifyUser = (targetUser: User) => {
    if (targetUser.username === currentUser.username) return false; // Không thể tự thay đổi quyền của bản thân
    if (currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.username === 'admin') return true;
    if (currentUser.role === 'KTV_Truong' && targetUser.role !== 'Admin' && targetUser.role !== 'Pho_Khoa' && targetUser.username !== 'admin') return true;
    return false;
  };

  useEffect(() => {
    // Subscribe to Firestore 'users' collection
    const unsubscribe = subscribeToCollection<User>('users', (data) => {
      setUsers(data);
    });
    return () => unsubscribe();
  }, []);

  // Force role to KTV or CN_XN if current user is KTV_Truong and not admin
  useEffect(() => {
    if (currentUser.role === 'KTV_Truong' && currentUser.username !== 'admin') {
      if (role !== 'KTV' && role !== 'CN_XN') {
        setRole('KTV');
      }
    }
  }, [currentUser, role]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password.trim() || !fullName.trim()) {
      setError('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError('Tên đăng nhập phải chứa ít nhất 3 ký tự.');
      return;
    }

    // Check existing
    const isExisting = users.some(u => u.username.toLowerCase() === cleanUsername);
    if (isExisting) {
      setError('Tên đăng nhập đã tồn tại trong hệ thống.');
      return;
    }

    // Role safety enforcement
    let finalRole: string = role;
    if (currentUser.role === 'KTV_Truong') {
      if (role !== 'KTV' && role !== 'CN_XN') {
        finalRole = 'KTV'; // KTV_Truong can only create KTV or CN_XN
      }
    }

    const newUser: User = {
      username: cleanUsername,
      fullName: fullName.trim(),
      role: finalRole,
      password: password
    };

    try {
      await saveUser(newUser);
      setSuccess(`Đã tạo tài khoản cán bộ "${newUser.fullName}" thành công trên hệ thống.`);
      
      // Reset form
      setUsername('');
      setFullName('');
      setPassword('');
      if (currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa') {
        setRole('KTV');
      }
    } catch (err: any) {
      setError(`Không thể tạo tài khoản: ${err.message || err}`);
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'Admin':
        return (
          <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-150 inline-flex items-center gap-1">
            <Shield className="h-3 w-3 text-red-600" />
            Trưởng Khoa
          </span>
        );
      case 'Pho_Khoa':
        return (
          <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-lg border border-orange-150 inline-flex items-center gap-1">
            <Shield className="h-3 w-3 text-orange-600" />
            Phó Khoa
          </span>
        );
      case 'KTV_Truong':
        return (
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-150 inline-flex items-center gap-1">
            <Shield className="h-3 w-3 text-blue-600" />
            KTV Trưởng
          </span>
        );
      case 'CN_XN':
        return (
          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-150 inline-flex items-center gap-1">
            <Shield className="h-3 w-3 text-teal-600" />
            Cử nhân Xét nghiệm
          </span>
        );
      case 'KTV':
        return (
          <span className="px-2.5 py-1 bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 inline-flex items-center gap-1">
            <UserIcon className="h-3 w-3 text-slate-500" />
            Kỹ thuật viên
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-gray-50 text-gray-700 text-xs rounded-lg border border-gray-150">
            {r}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="users-management-root">
      
      {/* Informative Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            Quản lý Nhân sự & Phân quyền Hệ thống
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chức năng quản trị bảo mật giúp tạo tài khoản và phân cấp vai trò truy cập theo tiêu chuẩn 2429-QĐ/BYT.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs text-slate-400 font-medium">Tài khoản đang thao tác:</span>
          <div className="text-xs font-bold text-slate-700 mt-0.5">
            {currentUser.fullName} ({currentUser.role === 'Admin' ? 'Trưởng Khoa' : currentUser.role === 'Pho_Khoa' ? 'Phó Khoa' : currentUser.role === 'KTV_Truong' ? 'KTV Trưởng' : currentUser.role === 'CN_XN' ? 'Cử nhân Xét nghiệm' : 'Kỹ thuật viên'})
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Creation Form or Roles & Privileges Card */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs h-fit">
          {currentUser.role !== 'Admin' && currentUser.role !== 'KTV_Truong' && currentUser.username !== 'admin' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <Shield className="h-4.5 w-4.5 text-teal-600" />
                Cơ cấu phân quyền của bạn
              </h3>
              
              <div className="p-3 bg-teal-50 border border-teal-150 rounded-xl">
                <p className="text-xs font-semibold text-teal-800 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                  Tài khoản: Kỹ thuật viên (KTV)
                </p>
                <p className="text-[11px] text-teal-700 mt-1">
                  Bạn có quyền ghi chép, cập nhật hạn sử dụng thực tế và thực hiện giao dịch trong lab. Để tạo mới hoặc thay đổi quyền của nhân sự, vui lòng liên hệ KTV Trưởng hoặc Trưởng Khoa.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cấp độ truy cập hệ thống:</h4>
                
                <div className="p-3 rounded-xl border border-slate-150 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                    <Shield className="h-3.5 w-3.5 text-red-600" />
                    Trưởng Khoa (Admin)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Toàn quyền quản trị hệ thống, danh mục hóa chất, phê duyệt hủy bỏ hóa chất quá hạn và phân cấp vai trò nhân sự.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-150 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                    <Shield className="h-3.5 w-3.5 text-blue-600" />
                    KTV Trưởng (KTV_Truong)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Quản lý danh mục hóa chất, cập nhật hạn mở nắp, hoàn nguyên Calib/QC và cấp quyền/tạo tài khoản cho Kỹ thuật viên.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-150 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-750">
                    <UserIcon className="h-3.5 w-3.5 text-slate-505" />
                    Kỹ thuật viên (KTV)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ghi nhận hạn dùng mở nắp/hoàn nguyên, nhập xuất vật tư hàng ngày. Không có quyền can thiệp cấu hình hệ thống hoặc nhân sự.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <UserPlus className="h-4.5 w-4.5 text-teal-600" />
                Thêm tài khoản nhân viên
              </h3>

              {error && (
                <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-start gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Họ và tên cán bộ</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <ClipboardList className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Vd: CN. Nguyễn Hoàng Nam"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Tên đăng nhập mới</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <UserIcon className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Viết liền không dấu, vd: ktv_nam"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Mật khẩu bảo mật</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="password"
                      placeholder="Nhập mật khẩu tự chọn"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Chức danh / Vai trò</label>
                  {currentUser.role === 'KTV_Truong' && currentUser.username !== 'admin' ? (
                    <div>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white cursor-pointer transition-all text-slate-700"
                      >
                        <option value="KTV">Kỹ thuật viên (KTV)</option>
                        <option value="CN_XN">Cử nhân xét nghiệm (CN_XN)</option>
                      </select>
                      <p className="text-[10px] text-amber-600 mt-1">
                        * Bạn được quyền tạo tài khoản cho Kỹ thuật viên (KTV) và Cử nhân xét nghiệm (CN_XN).
                      </p>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        list="roles-list"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 focus:bg-white transition-all text-slate-700"
                        placeholder="Chọn hoặc nhập chức danh mới..."
                      />
                      <datalist id="roles-list">
                        <option value="KTV">Kỹ thuật viên (KTV)</option>
                        <option value="CN_XN">Cử nhân xét nghiệm (CN_XN)</option>
                        <option value="KTV_Truong">Kỹ thuật viên Trưởng (KTV_Truong)</option>
                        <option value="Pho_Khoa">Phó khoa (Pho_Khoa)</option>
                        <option value="Admin">Trưởng Khoa (Admin)</option>
                      </datalist>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <UserPlus className="h-4 w-4" />
                  TẠO TÀI KHOẢN MỚI
                </button>

              </form>
            </>
          )}
        </div>

        {/* Existing Users List */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
            <Users className="h-4.5 w-4.5 text-teal-600" />
            Danh sách cán bộ trong khoa ({users.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {users.map((user) => {
              const editable = canModifyUser(user);
              return (
                <div 
                  key={user.username}
                  className="p-3.5 rounded-xl border border-slate-150 hover:border-slate-300 transition-all bg-slate-50/50 flex flex-col justify-between gap-2 relative group"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold text-slate-850 text-xs sm:text-sm">{user.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Tên đăng nhập: <strong className="text-slate-600 font-semibold">{user.username}</strong>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Mật khẩu: <span className="text-slate-500 font-medium">{user.password || '••••••'}</span>
                      </div>
                    </div>
                    {editable && (
                      <button
                        onClick={async () => {
                          if (confirm(`Bạn có chắc chắn muốn xóa tài khoản của cán bộ "${user.fullName}" (${user.username})? Thao tác này sẽ thu hồi toàn bộ quyền truy cập hệ thống.`)) {
                            try {
                              await deleteUserFromDb(user.username);
                              setSuccess(`Đã xóa tài khoản "${user.fullName}" thành công.`);
                              setTimeout(() => setSuccess(''), 3000);
                            } catch (err: any) {
                              setError(`Không thể xóa tài khoản: ${err.message || err}`);
                            }
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Xóa tài khoản này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
                    {editable ? (
                      <div className="flex items-center gap-1.5 w-full justify-between">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Phân quyền:</span>
                        <select
                          value={user.role}
                          onChange={async (e) => {
                            const newRole = e.target.value as 'Admin' | 'Pho_Khoa' | 'KTV_Truong' | 'CN_XN' | 'KTV';
                            const roleLabels: Record<string, string> = {
                              Admin: 'Trưởng Khoa',
                              Pho_Khoa: 'Phó Khoa',
                              KTV_Truong: 'KTV Trưởng',
                              CN_XN: 'Cử nhân Xét nghiệm',
                              KTV: 'Kỹ thuật viên'
                            };
                            if (confirm(`Bạn có chắc muốn đổi quyền của cán bộ "${user.fullName}" thành "${roleLabels[newRole] || newRole}"?`)) {
                              try {
                                await saveUser({ ...user, role: newRole });
                                setSuccess(`Đã cập nhật phân quyền cho "${user.fullName}" thành công.`);
                                setTimeout(() => setSuccess(''), 3000);
                              } catch (err: any) {
                                setError(`Lỗi phân quyền: ${err.message || err}`);
                              }
                            }
                          }}
                          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 outline-hidden cursor-pointer hover:border-teal-500 transition-all"
                        >
                          <option value="KTV">Kỹ thuật viên (KTV)</option>
                          <option value="CN_XN">Cử nhân Xét nghiệm (CN_XN)</option>
                          {(currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.username === 'admin') && <option value="KTV_Truong">KTV Trưởng</option>}
                          {(currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.username === 'admin') && <option value="Pho_Khoa">Phó Khoa</option>}
                          {(currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.username === 'admin') && <option value="Admin">Trưởng Khoa (Admin)</option>}
                          {currentUser.role === 'KTV_Truong' && user.role === 'KTV_Truong' && <option value="KTV_Truong">KTV Trưởng</option>}
                        </select>
                      </div>
                    ) : (
                      <>
                        {getRoleBadge(user.role)}
                        <span className="text-[10px] text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-md font-mono">
                          ID: {user.username}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
