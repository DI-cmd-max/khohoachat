import React from 'react';
import { Calendar, AlertTriangle, Play, RefreshCw, Beaker, LogOut, User as UserIcon } from 'lucide-react';
import { formatDateTimeVN, formatDateVN } from '../utils';
import { User } from '../types';

interface HeaderProps {
  simulatedTime: string;
  setSimulatedTime: (time: string, isSimulated: boolean) => void;
  isTimeSimulated: boolean;
  criticalCount: number;
  warningCount: number;
  onResetData: () => void;
  currentUser: User | null;
  onSignOut: () => void;
}

export default function Header({
  simulatedTime,
  setSimulatedTime,
  isTimeSimulated,
  criticalCount,
  warningCount,
  onResetData,
  currentUser,
  onSignOut,
}: HeaderProps) {
  // Common dates to simulate
  const handleSimulateDays = (days: number) => {
    if (days === 0) {
      setSimulatedTime('', false);
    } else {
      const baseDate = new Date();
      const futureDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
      setSimulatedTime(futureDate.toISOString(), true);
    }
  };

  const handleResetTime = () => {
    setSimulatedTime('', false);
  };

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 shadow-xs" id="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          
          {/* Logo and App Title */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-100">
              <Beaker className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-display font-bold text-slate-800 tracking-tight uppercase">
                  Khoa Xét nghiệm BVĐKTPCT
                </h1>
                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-mono font-bold rounded-md border border-teal-200 uppercase shrink-0">
                  2429-QĐ/BYT
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-sans leading-none mt-0.5">
                Hệ thống Giám sát Hóa chất, Vật tư, Pha chế & Hạn dùng sau mở nắp (In-use)
              </p>
            </div>
          </div>

          {/* Time Simulator and Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            
            {/* Simulation Controller */}
            <div className="bg-slate-50 rounded-xl p-1.5 border border-slate-200 flex items-center gap-2">
              <div className="flex items-center gap-1.5 pl-1 pr-2">
                <Calendar className="h-3.5 w-3.5 text-teal-600" />
                <div className="text-left">
                  <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider leading-none">
                    {isTimeSimulated ? 'HỆ THỐNG GIẢ LẬP THỜI GIAN' : 'THỜI GIAN HIỆN TẠI'}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-700 leading-none mt-0.5">
                    {formatDateTimeVN(simulatedTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Reset Data & Profile */}
            <div className="flex items-center gap-2">
              {currentUser && currentUser.role === 'Admin' && (
                <button
                  onClick={onResetData}
                  className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  title="Đặt lại toàn bộ dữ liệu mẫu về trạng thái ban đầu"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset Data
                </button>
              )}

              {/* Logged in user profile */}
              {currentUser && (
                <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5">
                  <div className="h-6 w-6 rounded-full bg-teal-600 flex items-center justify-center text-white shrink-0">
                    <UserIcon className="h-3 w-3" />
                  </div>
                  <div className="text-left hidden md:block max-w-[130px]">
                    <div className="text-[10px] font-bold text-slate-800 leading-none truncate">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[9px] text-teal-600 font-semibold mt-0.5 leading-none truncate">
                      {currentUser.role === 'Admin' ? 'Trưởng Khoa' : currentUser.role === 'Pho_Khoa' ? 'Phó Khoa' : currentUser.role === 'KTV_Truong' ? 'KTV Trưởng' : currentUser.role === 'CN_XN' ? 'Cử nhân Xét nghiệm' : 'Kỹ thuật viên'}
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all ml-1 cursor-pointer shrink-0"
                    title="Đăng xuất"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
