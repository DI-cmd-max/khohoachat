import React, { useState, useEffect } from 'react';
import { Beaker, User as UserIcon, Lock, UserPlus, LogIn, ClipboardList, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { subscribeToCollection, saveUser } from '../firebase';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

const DEFAULT_USERS: User[] = [
  {
    username: 'admin',
    fullName: 'Ths. Nguyễn Dương Hiển',
    role: 'Admin',
    password: '123456'
  },
  {
    username: 'ktv_binh',
    fullName: 'CN. Lê Thanh Bình',
    role: 'KTV_Truong',
    password: '123'
  },
  {
    username: 'ktv_vi',
    fullName: 'KTV. Trần Thị Tường Vi',
    role: 'KTV',
    password: '123'
  }
];

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isChangePassword, setIsChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Load and save users dynamically to Firestore
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    // Subscribe to Firestore 'users' collection
    const unsubscribe = subscribeToCollection<User>('users', (data) => {
      if (data.length > 0) {
        setUsers(data);
      } else {
        setUsers(DEFAULT_USERS);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    const currentUsersList = users.length > 0 ? users : DEFAULT_USERS;
    const matchedUser = currentUsersList.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );

    if (matchedUser) {
      onLoginSuccess(matchedUser);
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !oldPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setError('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    if (newPassword.length < 3) {
      setError('Mật khẩu mới phải có ít nhất 3 ký tự.');
      return;
    }

    const currentUsersList = users.length > 0 ? users : DEFAULT_USERS;
    const userIndex = currentUsersList.findIndex(
      u => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (userIndex === -1) {
      setError('Tên đăng nhập không tồn tại trên hệ thống.');
      return;
    }

    const user = currentUsersList[userIndex];
    if (user.password !== oldPassword) {
      setError('Mật khẩu hiện tại không chính xác.');
      return;
    }

    const updatedUser: User = {
      ...user,
      password: newPassword
    };

    try {
      await saveUser(updatedUser);
      setSuccess('Đã đổi mật khẩu thành công! Quay lại đăng nhập sau vài giây...');
      
      setTimeout(() => {
        setIsChangePassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPassword('');
        setSuccess('');
        setError('');
      }, 2000);
    } catch (err: any) {
      setError(`Không thể đổi mật khẩu: ${err.message || err}`);
    }
  };

  const handleSelectQuickAccount = (user: User) => {
    setUsername(user.username);
    setPassword(user.password || '');
    setError('');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'Admin': return 'Trưởng Khoa Xét nghiệm';
      case 'Pho_Khoa': return 'Phó khoa';
      case 'KTV_Truong': return 'Kỹ thuật viên Trưởng';
      case 'CN_XN': return 'Cử nhân xét nghiệm';
      case 'KTV': return 'Kỹ thuật viên xét nghiệm';
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-teal-500 selection:text-white relative overflow-hidden" id="auth-screen-root">
      
      {/* Background Decorative Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 rounded-full bg-teal-600/10 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="w-full max-w-md bg-slate-850 border border-slate-800 rounded-3xl shadow-2xl p-6 relative z-10 backdrop-blur-md">
        
        {/* Lab Branding */}
        <div className="text-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 mx-auto mb-4 animate-pulse">
            <Beaker className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Khoa Xét nghiệm BVĐKTPCT
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 uppercase tracking-widest font-semibold">
            Hệ thống Quản lý Lab & 2429-QĐ/BYT
          </p>
        </div>

        {/* Messaging Area */}
        {error && (
          <div className="p-3.5 mb-4 bg-red-950/40 border border-red-500/35 text-red-300 text-xs rounded-xl flex items-start gap-2 animate-shake" id="auth-error-msg">
            <span className="text-red-400 font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 mb-4 bg-emerald-950/40 border border-emerald-500/35 text-emerald-300 text-xs rounded-xl flex items-start gap-2" id="auth-success-msg">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>{success}</span>
          </div>
        )}

        {!isChangePassword ? (
          /* Login Form */
          <form onSubmit={handleLogin} className="space-y-4" id="login-form">
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Tên đăng nhập</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <UserIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Nhập tên đăng nhập (e.g. admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-slate-200 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Mật khẩu</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-slate-200 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                id="btn-goto-changepass"
                onClick={() => {
                  setIsChangePassword(true);
                  setError('');
                  setSuccess('');
                }}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer transition-all hover:underline"
              >
                Đổi mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              id="btn-login-submit"
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              <LogIn className="h-4 w-4" />
              ĐĂNG NHẬP HỆ THỐNG
            </button>

          </form>
        ) : (
          /* Change Password Form */
          <form onSubmit={handleChangePassword} className="space-y-4" id="changepass-form">
            <div className="text-center pb-2 border-b border-slate-850/60 mb-2">
              <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider">Đổi mật khẩu tài khoản</h3>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Tên đăng nhập</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <UserIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Nhập tên đăng nhập của bạn"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-slate-200 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Mật khẩu hiện tại</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu cũ"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-slate-200 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Mật khẩu mới</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  placeholder="Mật khẩu mới (ít nhất 3 ký tự)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-slate-200 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-slate-200 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                id="btn-changepass-submit"
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                CẬP NHẬT MẬT KHẨU
              </button>

              <button
                type="button"
                id="btn-back-to-login"
                onClick={() => {
                  setIsChangePassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                QUAY LẠI ĐĂNG NHẬP
              </button>
            </div>
          </form>
        )}

        {/* Authentication notice */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            Hệ thống quản lý nội bộ bảo mật. Vui lòng liên hệ Quản trị viên/Trưởng khoa nếu chưa được cấp tài khoản.
          </p>
        </div>

      </div>

      {/* ISO compliance info at the bottom */}
      <p className="text-[11px] text-slate-500 mt-6 font-sans flex items-center gap-1">
        <span>© 2026 BVĐKTPCT - Hệ thống đạt tiêu chuẩn 2429-QĐ/BYT</span>
      </p>

    </div>
  );
}
