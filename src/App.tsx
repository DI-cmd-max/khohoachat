import React, { useState, useEffect } from 'react';
import { 
  Beaker, 
  Layers, 
  Activity, 
  Clock, 
  ShieldAlert, 
  Database,
  ArrowRight,
  Info,
  ExternalLink,
  Users,
  BookOpen,
  Settings,
  ListTodo,
  Menu,
  X,
  Sliders,
  LogOut,
  AlertTriangle,
  Snowflake
} from 'lucide-react';

import { 
  ReagentMaterial, 
  Transaction, 
  ReconstitutionLog, 
  InUseStability, 
  TransactionType, 
  LabCategory,
  User,
  BarcodeCategory,
  PopularTest,
  TestGroup,
  QcResult,
  SystemSettings
} from './types';

import { 
  INITIAL_REAGENTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_RECONSTITUTIONS, 
  INITIAL_IN_USE_STABILITY 
} from './mockData';

import { 
  loadFromLocalStorage, 
  saveToLocalStorage, 
  generateIsoWarnings, 
  calculateInUseExpiry,
  formatDateString,
  formatDateTimeVN
} from './utils';

import {
  seedDatabaseIfEmpty,
  resetDatabaseToDefault,
  subscribeToCollection,
  saveReagent,
  deleteReagentFromDb,
  saveTransaction,
  clearAllTransactionsInDb,
  saveReconstitution,
  deleteReconstitutionFromDb,
  saveInUseStability,
  deleteInUseStabilityFromDb,
  saveSimulatedTime,
  db,
  saveBarcodeCategory,
  deleteBarcodeCategoryFromDb,
  savePopularTest,
  deletePopularTestFromDb,
  saveTestGroup,
  deleteTestGroupFromDb,
  saveQcResult,
  deleteQcResultFromDb,
  saveSystemSettings,
  subscribeToSystemSettings
} from './firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

import Header from './components/Header';
import DashboardTab from './components/DashboardTab';
import CatalogTab from './components/CatalogTab';
import TransactionsTab from './components/TransactionsTab';
import ReconstitutionTab from './components/ReconstitutionTab';
import InUseStabilityTab from './components/InUseStabilityTab';
import AuthScreen from './components/AuthScreen';
import UsersTab from './components/UsersTab';
import DocsViewerTab from './components/DocsViewerTab';
import PopularTestsTab from './components/PopularTestsTab';
import QcPlanningTab from './components/QcPlanningTab';
import SystemSettingsTab from './components/SystemSettingsTab';
import FridgeLocationTab from './components/FridgeLocationTab';

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('firebase-quota-exceeded', handleQuota);
    return () => window.removeEventListener('firebase-quota-exceeded', handleQuota);
  }, []);

  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('lab_current_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // --- Simulation Time State ---
  const [simulatedTime, setSimulatedTime] = useState<string>(() => new Date().toISOString());
  const [isTimeSimulated, setIsTimeSimulated] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // --- Core States ---
  const [reagents, setReagents] = useState<ReagentMaterial[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reconstitutions, setReconstitutions] = useState<ReconstitutionLog[]>([]);
  const [inUseStability, setInUseStability] = useState<InUseStability[]>([]);
  const [barcodeCategories, setBarcodeCategories] = useState<BarcodeCategory[]>([]);
  const [popularTests, setPopularTests] = useState<PopularTest[]>([]);
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [qcResults, setQcResults] = useState<QcResult[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    hospitalLogo: '',
    headerRow1: 'QT-QLCL-05-BM03',
    headerRow2: 'Phiên bản: 1.2 (2429-QĐ/BYT)',
    headerRow3: 'Ngày hiệu lực:',
    headerRow4: '15/07/2026'
  });

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [targetHighlight, setTargetHighlight] = useState<{ tab: string; id?: string; name?: string } | null>(null);

  // --- Cross-tab pre-fill state (Flow 1 & 2) ---
  const [prefillCatalogBarcode, setPrefillCatalogBarcode] = useState<string>('');
  const [prefillReconstitutionData, setPrefillReconstitutionData] = useState<{
    barcodeCategoryCode?: string;
    name?: string;
    lotNumber?: string;
    category?: LabCategory;
  } | null>(null);

  const handleNavigateToCatalogWithBarcodeCode = (code: string) => {
    setActiveTab('catalog');
    setPrefillCatalogBarcode(code);
    setTargetHighlight(null);
  };

  const handleNavigateToReconstitutionWithData = (data: {
    barcodeCategoryCode?: string;
    name?: string;
    lotNumber?: string;
    category?: LabCategory;
  }) => {
    setActiveTab('reconstitution');
    setPrefillReconstitutionData(data);
    setTargetHighlight(null);
  };

  const handleSetActiveTab = (tabId: string) => {
    setActiveTab(tabId);
    setTargetHighlight(null);
  };

  const handleNavigateFromWarning = (tabId: string, relatedId?: string, itemName?: string) => {
    setActiveTab(tabId);
    setTargetHighlight({ tab: tabId, id: relatedId, name: itemName });
  };

  // Firebase initial seeding and continuous real-time multi-terminal state subscriptions
  useEffect(() => {
    async function initFirebaseAndSeed() {
      await seedDatabaseIfEmpty();
    }
    initFirebaseAndSeed();

    const unsubReagents = subscribeToCollection<ReagentMaterial>('reagents', setReagents, 'id', 'asc');
    const unsubTx = subscribeToCollection<Transaction>('transactions', setTransactions, 'timestamp', 'desc');
    const unsubRecon = subscribeToCollection<ReconstitutionLog>('reconstitutions', setReconstitutions, 'timestamp', 'desc');
    const unsubInUse = subscribeToCollection<InUseStability>('inUseStability', setInUseStability, 'id', 'desc');
    const unsubBarcodeCategories = subscribeToCollection<BarcodeCategory>('barcodeCategories', setBarcodeCategories, 'code', 'asc');
    const unsubPopularTests = subscribeToCollection<PopularTest>('popularTests', setPopularTests, 'name', 'asc');
    const unsubTestGroups = subscribeToCollection<TestGroup>('testGroups', setTestGroups, 'name', 'asc');
    const unsubQcResults = subscribeToCollection<QcResult>('qcResults', setQcResults, 'testName', 'asc');
    const unsubSettings = subscribeToSystemSettings((data) => {
      if (data) {
        setSystemSettings(data);
      }
    });

    // Subscribe to shared time state
    const unsubTime = onSnapshot(doc(db, 'systemState', 'current'), (snapshot) => {
      const data = snapshot.data();
      if (data) {
        if (data.isSimulated && data.simulatedTime) {
          setSimulatedTime(data.simulatedTime);
          setIsTimeSimulated(true);
        } else {
          setSimulatedTime(new Date().toISOString());
          setIsTimeSimulated(false);
        }
      } else {
        setSimulatedTime(new Date().toISOString());
        setIsTimeSimulated(false);
      }
    });

    return () => {
      unsubReagents();
      unsubTx();
      unsubRecon();
      unsubInUse();
      unsubBarcodeCategories();
      unsubPopularTests();
      unsubTestGroups();
      unsubQcResults();
      unsubSettings();
      unsubTime();
    };
  }, []);

  // Sync stale system simulation time to real-world current date on initial load
  useEffect(() => {
    const syncSystemTimeOnLoad = async () => {
      try {
        const timeDocRef = doc(db, 'systemState', 'current');
        const timeSnap = await getDoc(timeDocRef);
        if (timeSnap.exists()) {
          const data = timeSnap.data();
          if (data && data.isSimulated && data.simulatedTime) {
            const simulatedDate = new Date(data.simulatedTime);
            const realDate = new Date();
            // If simulated date is in the past (older than 24 hours), reset to live time so it updates every day!
            if (simulatedDate.getTime() < realDate.getTime() - 24 * 60 * 60 * 1000) {
              await saveSimulatedTime('', false);
              console.log("Automatically reset stale simulation date to real-world current date.");
            }
          }
        }
      } catch (err) {
        console.warn("Error auto-syncing system time:", err);
      }
    };
    
    syncSystemTimeOnLoad();
  }, []);

  // --- Sync Auth State to Local Storage ---
  useEffect(() => {
    if (currentUser) {
      saveToLocalStorage('lab_current_user', currentUser);
    } else {
      localStorage.removeItem('lab_current_user');
    }
  }, [currentUser]);

  // Local real-time ticking clock when not in simulation mode
  useEffect(() => {
    if (isTimeSimulated) return;

    const interval = setInterval(() => {
      setSimulatedTime(new Date().toISOString());
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimeSimulated]);

  const handleSignOut = () => {
    setCurrentUser(null);
  };

  // --- Dynamic ISO Warning Generation ---
  const warnings = generateIsoWarnings(reagents, inUseStability, reconstitutions, simulatedTime);
  const criticalCount = warnings.filter(w => w.severity === 'CRITICAL').length;
  const warningCount = warnings.filter(w => w.severity === 'WARNING').length;

  // --- DB Operations / Handlers ---

  // 1. Reset all data to Default Mock Data
  const handleResetData = async () => {
    if (confirm('Bạn có thực sự muốn reset toàn bộ hệ thống dữ liệu y tế phòng lab trên Cloud? Thao tác này sẽ xóa mọi bản ghi tự nhập và khôi phục về trạng thái mẫu ban đầu cho tất cả các máy tính.')) {
      await resetDatabaseToDefault();
      setActiveTab('dashboard');
    }
  };

  // 2. Add New Catalog Reagent Item
  const handleAddReagent = async (newItem: Omit<ReagentMaterial, 'id' | 'currentStock'> & { currentStock?: number }) => {
    const numericIds = reagents.map(r => {
      const match = r.id.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
    const newId = `R-${String(nextNum).padStart(3, '0')}`;

    const initialStock = newItem.currentStock || 0;

    const reagent: ReagentMaterial = {
      ...newItem,
      id: newId,
      currentStock: initialStock,
    };
    await saveReagent(reagent);

    // If initial stock is positive, record an import transaction automatically to match
    if (initialStock > 0) {
      const numericTxIds = transactions.map(t => {
        const match = t.id.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      });
      const nextTxNum = numericTxIds.length > 0 ? Math.max(...numericTxIds) + 1 : 1;
      const txId = `TX-${String(nextTxNum).padStart(3, '0')}`;

      const initialTx: Transaction = {
        id: txId,
        timestamp: simulatedTime,
        reagentId: newId,
        reagentName: reagent.name,
        category: reagent.category,
        type: 'nhap',
        quantity: initialStock,
        actor: currentUser?.fullName || 'Hệ thống',
        notes: 'Nhập kho ban đầu khi khai báo hóa chất mới',
      };
      await saveTransaction(initialTx);
    }
    return reagent;
  };

  // 3. Edit Reagent Details
  const handleEditReagent = async (updatedItem: ReagentMaterial) => {
    await saveReagent(updatedItem);
    
    // Also, update name and category cached inside Open Vial tracker if relevant
    for (const vial of inUseStability) {
      if (vial.reagentId === updatedItem.id) {
        const updatedVial: InUseStability = {
          ...vial,
          reagentName: updatedItem.name,
          category: updatedItem.category,
          lotNumber: updatedItem.lotNumber,
          originalExpiryDate: updatedItem.originalExpiryDate,
          calculatedExpiry: calculateInUseExpiry(vial.openedDate, updatedItem.inUseStabilityDays, updatedItem.originalExpiryDate)
        };
        await saveInUseStability(updatedVial);
      }
    }
  };

  // 4. Delete Reagent from Catalog
  const handleDeleteReagent = async (id: string) => {
    await deleteReagentFromDb(id);
    // Also mark active vials of this reagent as discarded
    for (const vial of inUseStability) {
      if (vial.reagentId === id) {
        await saveInUseStability({ ...vial, status: 'discarded' });
      }
    }
  };

  // 5. Register Stock Transaction (Auto syncs inventory level!)
  const handleAddTransaction = async (
    reagentId: string, 
    type: TransactionType, 
    quantity: number, 
    actor: string, 
    notes: string
  ) => {
    const reagent = reagents.find(r => r.id === reagentId);
    if (!reagent) return;

    const numericIds = transactions.map(t => {
      const match = t.id.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
    const txId = `TX-${String(nextNum).padStart(3, '0')}`;

    const newTx: Transaction = {
      id: txId,
      timestamp: simulatedTime, // transaction recorded at simulated time for consistency!
      reagentId,
      reagentName: reagent.name,
      category: reagent.category,
      type,
      quantity,
      actor,
      notes,
    };

    let stockDelta = type === 'nhap' ? quantity : -quantity;
    const updatedStock = Math.max(0, reagent.currentStock + stockDelta);

    await saveTransaction(newTx);
    await saveReagent({ ...reagent, currentStock: updatedStock });
  };

  // 6. Clear Transaction History Ledger
  const handleClearTransactions = async () => {
    if (confirm('Bạn có chắc muốn xóa sạch lịch sử giao dịch trên Cloud?')) {
      await clearAllTransactionsInDb();
    }
  };

  // 7. Add Reconstitution Prep Log (Calib/QC)
  const handleAddReconstitution = async (logs: Omit<ReconstitutionLog, 'id' | 'expiryTimestamp'> | Omit<ReconstitutionLog, 'id' | 'expiryTimestamp'>[]) => {
    const logsArray = Array.isArray(logs) ? logs : [logs];
    
    const numericIds = reconstitutions.map(r => {
      const match = r.id.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    let nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;

    for (const log of logsArray) {
      const newId = `RC-${String(nextNum).padStart(3, '0')}`;
      nextNum++;

      const prepDate = new Date(simulatedTime);
      const expiryDate = new Date(prepDate.getTime() + log.stabilityHours * 60 * 60 * 1000);

      const newLog: ReconstitutionLog = {
        ...log,
        id: newId,
        timestamp: simulatedTime,
        expiryTimestamp: expiryDate.toISOString(),
        status: 'Đang sử dụng'
      };

      await saveReconstitution(newLog);
    }
  };

  // 8. Update Reconstitution Status (e.g. Depleted, Discarded)
  const handleUpdateReconStatus = async (id: string, status: 'Đang sử dụng' | 'Đã hết' | 'Đã hủy') => {
    const found = reconstitutions.find(r => r.id === id);
    if (!found) return;

    const updated = { ...found, status };
    if (status === 'Đã hết') {
      updated.remainingAliquots = 0;
    }
    await saveReconstitution(updated);
  };

  // 8.5. Decrement Remaining Aliquots
  const handleDecrementAliquot = async (id: string) => {
    const found = reconstitutions.find(r => r.id === id);
    if (!found) return;

    const remaining = found.remainingAliquots !== undefined ? found.remainingAliquots : 0;
    const newRemaining = Math.max(0, remaining - 1);
    const status = newRemaining === 0 ? 'Đã hết' : found.status;

    await saveReconstitution({
      ...found,
      remainingAliquots: newRemaining,
      status
    });
  };

  // 8.6. Update Reconstitution Log (Edit feature)
  const handleUpdateReconstitution = async (updatedLog: ReconstitutionLog) => {
    const prepDate = new Date(updatedLog.timestamp);
    const expiryDate = new Date(prepDate.getTime() + updatedLog.stabilityHours * 60 * 60 * 1000);
    const logWithExpiry = {
      ...updatedLog,
      expiryTimestamp: expiryDate.toISOString(),
    };
    await saveReconstitution(logWithExpiry);
  };

  // 9. Delete Reconstitution Entry
  const handleDeleteRecon = async (id: string) => {
    await deleteReconstitutionFromDb(id);
  };

  // 9b. Barcode Category Management Handlers
  const handleSaveBarcodeCategory = async (bc: BarcodeCategory) => {
    await saveBarcodeCategory(bc);
  };

  const handleDeleteBarcodeCategory = async (id: string) => {
    await deleteBarcodeCategoryFromDb(id);
  };

  // 10. Register Open-Vial Stability Tracker (On-Machine Mount)
  const handleAddInUseStability = async (
    reagentId: string, 
    openedBy: string, 
    positionInMachine: string, 
    remainingTests?: number,
    overriddenBarcodeCode?: string
  ) => {
    const reagent = reagents.find(r => r.id === reagentId);
    if (!reagent) return;

    // Detect total tests capacity from pack size or default to 100
    let totalTests = 100;
    const match = reagent.packSize.match(/(\d+)\s*tests/i);
    if (match) {
      totalTests = parseInt(match[1]);
    }

    const numericIds = inUseStability.map(v => {
      const match = v.id.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
    const newId = `US-${String(nextNum).padStart(3, '0')}`;
    const openedDateStr = simulatedTime.slice(0, 10); // current simulated date

    const calculatedExpiry = calculateInUseExpiry(openedDateStr, reagent.inUseStabilityDays, reagent.originalExpiryDate);

    // Intelligent barcode category auto-detection
    let detectedBarcodeCode = overriddenBarcodeCode || reagent.barcodeCategoryCode || '';
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

    const newVial: InUseStability = {
      id: newId,
      reagentId,
      reagentName: reagent.name,
      category: reagent.category,
      lotNumber: reagent.lotNumber,
      openedDate: openedDateStr,
      openedBy,
      inUseStabilityDays: reagent.inUseStabilityDays,
      originalExpiryDate: reagent.originalExpiryDate,
      calculatedExpiry,
      positionInMachine,
      remainingTests: remainingTests !== undefined ? remainingTests : totalTests,
      totalTests,
      status: 'active',
      barcodeCategoryCode: detectedBarcodeCode,
    };

    await saveInUseStability(newVial);
  };

  // 11. Rapid Open Stability Trigger from Catalog Tab
  const handleOpenStabilityFromCatalog = async (reagentId: string, openedBy: string, position: string) => {
    await handleAddInUseStability(reagentId, openedBy, position);
  };

  // 12. Update Remaining Tests Count of Opened Vial
  const handleUpdateRemainingTests = async (id: string, tests: number) => {
    const found = inUseStability.find(v => v.id === id);
    if (!found) return;

    const status = tests === 0 ? 'depleted' as const : found.status;
    await saveInUseStability({ ...found, remainingTests: tests, status });
  };

  // 13. Update Opened Vial Status (depleted / discarded)
  const handleUpdateInUseStatus = async (id: string, status: 'active' | 'expired' | 'depleted' | 'discarded') => {
    const found = inUseStability.find(v => v.id === id);
    if (!found) return;

    const updated = { ...found, status };
    if (status === 'depleted') {
      updated.remainingTests = 0;
    }
    await saveInUseStability(updated);
  };

  // 14. Delete Open Vial entry
  const handleDeleteInUse = async (id: string) => {
    await deleteInUseStabilityFromDb(id);
  };

  // 15. Real-time Shared Time Sync setter
  const handleSetSimulatedTime = async (timeStr: string, isSimulated: boolean = true) => {
    await saveSimulatedTime(timeStr, isSimulated);
  };

  if (quotaExceeded) {
    return (
      <div className="min-h-screen bg-pastel-mesh flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-xl text-center space-y-6 border border-white/60">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Đã vượt quá giới hạn dữ liệu</h2>
          <p className="text-slate-600 text-sm">
            Hệ thống đã đạt giới hạn truy cập cơ sở dữ liệu (Firestore) miễn phí trong ngày.
          </p>
          <div className="bg-slate-100/80 rounded-2xl p-4 text-left">
            <p className="text-sm font-semibold text-slate-700 mb-2">Vui lòng quay lại đăng nhập vào:</p>
            <p className="text-lg font-bold text-teal-600 flex items-center justify-center gap-2">
              <Clock className="h-5 w-5" />
              14:00 chiều mai (hoặc 14:00 chiều nay)
            </p>
            <p className="text-xs text-slate-500 mt-2 text-center">
              (Thời gian hệ thống làm mới dung lượng - 00:00 PST)
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-pastel-mesh flex flex-col md:flex-row font-sans text-slate-700 selection:bg-teal-500 selection:text-white" id="main-layout-root">
      
      {/* 1. Desktop FIXED Sidebar */}
      <aside className="hidden md:flex w-72 border-r border-slate-200/80 bg-white/85 backdrop-blur-md flex-col justify-between sticky top-0 h-screen shrink-0 z-30 shadow-xs sidebar" id="app-sidebar">
        {/* Sidebar Header / Logo */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            {systemSettings?.hospitalLogo ? (
              <img 
                src={systemSettings.hospitalLogo} 
                alt="Hospital Logo" 
                className="h-9 w-9 object-contain shrink-0" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-100 shrink-0">
                <Beaker className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-bold text-slate-800 uppercase tracking-tight leading-none truncate">
                  KHOA XÉT NGHIỆM
                </h1>
                <span className="px-1 py-0.5 bg-teal-50 text-teal-700 text-[8px] font-mono font-bold rounded border border-teal-100 uppercase shrink-0">
                  2429
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-sans mt-0.5 leading-none truncate">
                BVĐK TP CẦN THƠ
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Tabs Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-2 tracking-wider">CHỨC NĂNG CHÍNH</div>
          
          <button
            onClick={() => handleSetActiveTab('dashboard')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
              <span>Tổng quan & Cảnh báo</span>
            </div>
            {warnings.length > 0 && (
              <span className={`h-4 min-w-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none ${
                criticalCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-900'
              }`}>
                {warnings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSetActiveTab('catalog')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Database className="h-4 w-4 shrink-0 text-indigo-500" />
            <span>Danh mục Hóa chất</span>
          </button>

          <button
            onClick={() => handleSetActiveTab('stability')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'stability'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Theo dõi Mở nắp</span>
            </div>
            {inUseStability.filter(s => s.status === 'active').length > 0 && (
              <span className="bg-blue-100 text-blue-700 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
                {inUseStability.filter(s => s.status === 'active').length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSetActiveTab('reconstitution')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'reconstitution'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 shrink-0 text-purple-500" />
              <span>Hoàn nguyên Calib/QC</span>
            </div>
            {reconstitutions.filter(r => r.status === 'Đang sử dụng').length > 0 && (
              <span className="bg-purple-100 text-purple-700 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
                {reconstitutions.filter(r => r.status === 'Đang sử dụng').length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSetActiveTab('transactions')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Nhật ký Nhập / Xuất</span>
          </button>

          <button
            onClick={() => handleSetActiveTab('documents')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0 text-teal-500" />
            <span>Tra cứu HDSD & Quy trình</span>
          </button>

          <button
            onClick={() => handleSetActiveTab('fridge-location')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'fridge-location'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Snowflake className="h-4 w-4 shrink-0 text-cyan-500" />
              <span>Vị trí 3 Tủ Lạnh</span>
            </div>
            <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-mono font-bold rounded">
              2429
            </span>
          </button>

          <div className="text-[10px] font-bold text-slate-400 uppercase px-2 pt-4 mb-2 tracking-wider">HỖ TRỢ & NỘI KIỂM</div>

          <button
            onClick={() => handleSetActiveTab('qc-planning')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'qc-planning'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ListTodo className="h-4 w-4 shrink-0 text-teal-600" />
            <span>Lập kế hoạch & Nội kiểm</span>
          </button>

          <button
            onClick={() => handleSetActiveTab('popular-tests')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'popular-tests'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500" />
            <span>Khai báo Test phổ biến</span>
          </button>

          <button
            onClick={() => handleSetActiveTab('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Sliders className="h-4 w-4 shrink-0 text-teal-600 animate-pulse" />
            <span>Cài đặt Hệ thống</span>
          </button>

          {currentUser && (
            <button
              onClick={() => {
                if (currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.role === 'KTV_Truong' || currentUser.username === 'admin') {
                  handleSetActiveTab('users');
                }
              }}
              disabled={currentUser.role !== 'Admin' && currentUser.role !== 'Pho_Khoa' && currentUser.role !== 'KTV_Truong' && currentUser.username !== 'admin'}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                currentUser.role !== 'Admin' && currentUser.role !== 'Pho_Khoa' && currentUser.role !== 'KTV_Truong' && currentUser.username !== 'admin'
                  ? 'opacity-45 cursor-not-allowed text-slate-400'
                  : activeTab === 'users'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 shrink-0" />
                <span>Quản lý Nhân sự</span>
              </div>
              {currentUser.role !== 'Admin' && currentUser.role !== 'Pho_Khoa' && currentUser.role !== 'KTV_Truong' && currentUser.username !== 'admin' && (
                <span className="text-[10px]">🔒</span>
              )}
            </button>
          )}
        </nav>

        {/* Sidebar Footer / Current User Profile */}
        <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{currentUser.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser.roleDisplay || currentUser.role}</p>
            </div>
            <button 
              onClick={handleSignOut}
              className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Mobile Header Bar & Hamburger Menu */}
      <div className="md:hidden flex flex-col bg-white border-b border-slate-200 sticky top-0 z-40 shrink-0 shadow-xs header" id="mobile-header">
        <div className="px-3 py-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {systemSettings?.hospitalLogo ? (
              <img 
                src={systemSettings.hospitalLogo} 
                alt="Hospital Logo" 
                className="h-6 w-6 object-contain shrink-0" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-6 w-6 rounded bg-teal-600 flex items-center justify-center text-white shrink-0">
                <Beaker className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h1 className="text-[11px] font-bold text-slate-800 tracking-tight leading-none uppercase truncate">
                  Khoa Xét nghiệm BVĐKTPCT
                </h1>
                <span className="px-1 py-0.2 bg-teal-50 text-teal-700 text-[7px] font-mono font-extrabold rounded border border-teal-100 uppercase shrink-0">
                  2429
                </span>
              </div>
              <p className="text-[9px] text-slate-500 font-mono font-medium mt-0.5 leading-none">
                Thời gian: {formatDateTimeVN(simulatedTime)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer shrink-0"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile Full Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="border-t border-slate-100 bg-white p-3 space-y-1 shadow-inner max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => { handleSetActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <span>Tổng quan & Cảnh báo</span>
              </div>
              {warnings.length > 0 && (
                <span className="bg-red-500 text-white h-4 min-w-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                  {warnings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { handleSetActiveTab('catalog'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'catalog' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Database className="h-4 w-4 text-indigo-500" />
              <span>Danh mục Hóa chất</span>
            </button>

            <button
              onClick={() => { handleSetActiveTab('stability'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'stability' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span>Theo dõi Mở nắp</span>
              </div>
              {inUseStability.filter(s => s.status === 'active').length > 0 && (
                <span className="bg-blue-100 text-blue-700 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
                  {inUseStability.filter(s => s.status === 'active').length}
                </span>
              )}
            </button>

            <button
              onClick={() => { handleSetActiveTab('reconstitution'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'reconstitution' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-purple-500" />
                <span>Hoàn nguyên Calib/QC</span>
              </div>
              {reconstitutions.filter(r => r.status === 'Đang sử dụng').length > 0 && (
                <span className="bg-purple-100 text-purple-700 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
                  {reconstitutions.filter(r => r.status === 'Đang sử dụng').length}
                </span>
              )}
            </button>

            <button
              onClick={() => { handleSetActiveTab('transactions'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'transactions' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Nhật ký Nhập / Xuất</span>
            </button>

            <button
              onClick={() => { handleSetActiveTab('documents'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'documents' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <BookOpen className="h-4 w-4 text-teal-500" />
              <span>Tra cứu HDSD & Quy trình</span>
            </button>

            <button
              onClick={() => { handleSetActiveTab('fridge-location'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'fridge-location' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Snowflake className="h-4 w-4 text-cyan-500" />
              <span>Vị trí 3 Tủ Lạnh (SOP 2429)</span>
            </button>

            <button
              onClick={() => { handleSetActiveTab('qc-planning'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'qc-planning' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ListTodo className="h-4 w-4 text-teal-600" />
              <span>Lập kế hoạch & Nội kiểm</span>
            </button>

            <button
              onClick={() => { handleSetActiveTab('popular-tests'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'popular-tests' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Khai báo Test phổ biến</span>
            </button>

            <button
              onClick={() => { handleSetActiveTab('settings'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sliders className="h-4 w-4 text-teal-600" />
              <span>Cài đặt Hệ thống</span>
            </button>

            {currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.role === 'KTV_Truong' || currentUser.username === 'admin') && (
              <button
                onClick={() => { handleSetActiveTab('users'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="h-4 w-4 text-slate-600" />
                <span>Quản lý Nhân sự</span>
              </button>
            )}

            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs px-3">
              <span className="text-slate-500 font-medium">Đăng nhập: {currentUser.fullName}</span>
              <button onClick={handleSignOut} className="text-red-500 font-bold hover:underline cursor-pointer">
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main content area for BOTH Desktop and Mobile */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top simulated time indicator and critical counts */}
        <div className="hidden md:block header" id="app-header-container">
          <Header 
            simulatedTime={simulatedTime}
            setSimulatedTime={handleSetSimulatedTime}
            isTimeSimulated={isTimeSimulated}
            criticalCount={criticalCount}
            warningCount={warningCount}
            onResetData={handleResetData}
            currentUser={currentUser}
            onSignOut={handleSignOut}
          />
        </div>

        {/* Content Tab viewport wrapper */}
        <div className="flex-1 flex flex-col min-h-0" id="tab-viewport-container">
          
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex-1 w-full flex flex-col gap-4">
            
            <div className="flex-1 min-h-0" id="tab-viewport">
              {activeTab === 'dashboard' && (
                <DashboardTab 
                  warnings={warnings}
                  totalReagents={reagents.length}
                  activeOpenVials={inUseStability.filter(v => v.status === 'active').length}
                  activeReconstitutions={reconstitutions.filter(r => r.status === 'Đang sử dụng').length}
                  onNavigateToTab={handleNavigateFromWarning}
                  qcResults={qcResults}
                  onSaveQcResult={saveQcResult}
                  onDeleteQcResult={deleteQcResultFromDb}
                  currentUser={currentUser}
                  reagents={reagents}
                  transactions={transactions}
                  simulatedTime={simulatedTime}
                />
              )}

              {activeTab === 'catalog' && currentUser && (
                <CatalogTab 
                  reagents={reagents}
                  onAddReagent={handleAddReagent}
                  onEditReagent={handleEditReagent}
                  onDeleteReagent={handleDeleteReagent}
                  onOpenStability={handleOpenStabilityFromCatalog}
                  onAddTransaction={handleAddTransaction}
                  currentUser={currentUser}
                  targetHighlight={targetHighlight && targetHighlight.tab === 'catalog' ? targetHighlight : undefined}
                  onClearHighlight={() => setTargetHighlight(null)}
                  transactions={transactions}
                  simulatedTime={simulatedTime}
                  popularTests={popularTests}
                  barcodeCategories={barcodeCategories}
                  testGroups={testGroups}
                  prefillBarcodeCategoryCode={prefillCatalogBarcode}
                  onClearPrefillBarcode={() => setPrefillCatalogBarcode('')}
                  onNavigateToReconstitutionWithData={handleNavigateToReconstitutionWithData}
                  onAddReconstitution={handleAddReconstitution}
                  systemSettings={systemSettings}
                />
              )}

              {activeTab === 'popular-tests' && currentUser && (
                <PopularTestsTab 
                  popularTests={popularTests}
                  onSavePopularTest={savePopularTest}
                  onDeletePopularTest={deletePopularTestFromDb}
                  testGroups={testGroups}
                  onSaveTestGroup={saveTestGroup}
                  onDeleteTestGroup={deleteTestGroupFromDb}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'stability' && currentUser && (
                <InUseStabilityTab 
                  inUseStability={inUseStability}
                  reagents={reagents}
                  simulatedTime={simulatedTime}
                  onAddInUseStability={handleAddInUseStability}
                  onUpdateRemainingTests={handleUpdateRemainingTests}
                  onUpdateInUseStatus={handleUpdateInUseStatus}
                  onDeleteInUse={handleDeleteInUse}
                  currentUser={currentUser}
                  targetHighlight={targetHighlight && targetHighlight.tab === 'stability' ? targetHighlight : undefined}
                  onClearHighlight={() => setTargetHighlight(null)}
                  barcodeCategories={barcodeCategories}
                  systemSettings={systemSettings}
                />
              )}

              {activeTab === 'reconstitution' && currentUser && (
                <ReconstitutionTab 
                  reconstitutions={reconstitutions}
                  reagents={reagents}
                  simulatedTime={simulatedTime}
                  onAddReconstitution={handleAddReconstitution}
                  onUpdateReconstitution={handleUpdateReconstitution}
                  onUpdateReconStatus={handleUpdateReconStatus}
                  onDecrementAliquot={handleDecrementAliquot}
                  onDeleteRecon={handleDeleteRecon}
                  onAddTransaction={handleAddTransaction}
                  currentUser={currentUser}
                  targetHighlight={targetHighlight && targetHighlight.tab === 'reconstitution' ? targetHighlight : undefined}
                  onClearHighlight={() => setTargetHighlight(null)}
                  barcodeCategories={barcodeCategories}
                  onSaveBarcodeCategory={handleSaveBarcodeCategory}
                  onDeleteBarcodeCategory={handleDeleteBarcodeCategory}
                  prefillReconstitutionData={prefillReconstitutionData}
                  onClearPrefillRecon={() => setPrefillReconstitutionData(null)}
                  onNavigateToCatalogWithBarcodeCode={handleNavigateToCatalogWithBarcodeCode}
                  systemSettings={systemSettings}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsTab 
                  transactions={transactions}
                  onClearTransactions={handleClearTransactions}
                  systemSettings={systemSettings}
                />
              )}

              {activeTab === 'documents' && currentUser && (
                <DocsViewerTab 
                  reagents={reagents}
                  onEditReagent={handleEditReagent}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'fridge-location' && currentUser && (
                <FridgeLocationTab 
                  reagents={reagents}
                  inUseStability={inUseStability}
                  reconstitutions={reconstitutions}
                  simulatedTime={simulatedTime}
                  currentUser={currentUser}
                  systemSettings={systemSettings}
                />
              )}

              {activeTab === 'qc-planning' && currentUser && (
                <QcPlanningTab 
                  barcodeCategories={barcodeCategories}
                  reagents={reagents}
                  inUseStability={inUseStability}
                  reconstitutions={reconstitutions}
                  simulatedTime={simulatedTime}
                  onSaveBarcodeCategory={handleSaveBarcodeCategory}
                  onDeleteBarcodeCategory={handleDeleteBarcodeCategory}
                  currentUser={currentUser}
                  systemSettings={systemSettings}
                />
              )}

              {activeTab === 'settings' && currentUser && (
                <SystemSettingsTab 
                  settings={systemSettings}
                  onSaveSettings={saveSystemSettings}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'users' && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Pho_Khoa' || currentUser.role === 'KTV_Truong' || currentUser.username === 'admin') && (
                <UsersTab currentUser={currentUser} />
              )}
            </div>

          </main>

        </div>

        {/* Humble, Professional Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 shrink-0 mt-auto pb-28 md:pb-16 footer" id="app-footer">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:flex sm:items-center sm:justify-between">
            <div className="text-xs text-slate-400 font-sans">
              &copy; 2026 LAB-STABILITY. Thiết kế chuyên sâu tối ưu hóa quy trình kiểm toán 2429-QĐ/BYT.
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 sm:mt-0 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-teal-600" /> Bản build đã kiểm tra đạt chuẩn 2429-QĐ/BYT
              </span>
            </div>
          </div>
        </footer>

        {/* Support Information Marquee Footer Bar - FIXED at bottom */}
        <div className="fixed bottom-12 md:bottom-0 left-0 md:left-72 right-0 bg-teal-900 text-teal-100 text-[11px] py-1.5 overflow-hidden whitespace-nowrap border-t border-teal-800 z-35 select-none shadow-md flex items-center footer" id="app-marquee-footer">
          <div className="inline-flex gap-8 animate-marquee">
            <span>Mọi thắc mắc, góp ý hoặc yêu cầu hỗ trợ về phần mềm xin vui lòng báo về cho đội ngũ QC Khoa Xét nghiệm để được xử lý kịp thời.</span>
            <span>Mọi thắc mắc, góp ý hoặc yêu cầu hỗ trợ về phần mềm xin vui lòng báo về cho đội ngũ QC Khoa Xét nghiệm để được xử lý kịp thời.</span>
            <span>Mọi thắc mắc, góp ý hoặc yêu cầu hỗ trợ về phần mềm xin vui lòng báo về cho đội ngũ QC Khoa Xét nghiệm để được xử lý kịp thời.</span>
            <span>Mọi thắc mắc, góp ý hoặc yêu cầu hỗ trợ về phần mềm xin vui lòng báo về cho đội ngũ QC Khoa Xét nghiệm để được xử lý kịp thời.</span>
          </div>
        </div>

      </div>

      {/* 4. Bottom Navigation Bar for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-12 bg-white border-t border-slate-200 z-40 flex items-center justify-around shadow-lg shrink-0 footer" id="mobile-bottom-nav">
        <button
          onClick={() => handleSetActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer ${
            activeTab === 'dashboard' ? 'text-teal-600' : 'text-slate-400'
          }`}
        >
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-bold mt-0.5 leading-none">Tổng quan</span>
        </button>

        <button
          onClick={() => handleSetActiveTab('catalog')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer ${
            activeTab === 'catalog' ? 'text-teal-600' : 'text-slate-400'
          }`}
        >
          <Database className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-bold mt-0.5 leading-none">Danh mục</span>
        </button>

        <button
          onClick={() => handleSetActiveTab('stability')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer ${
            activeTab === 'stability' ? 'text-teal-600' : 'text-slate-400'
          }`}
        >
          <Activity className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-bold mt-0.5 leading-none">Mở nắp</span>
        </button>

        <button
          onClick={() => handleSetActiveTab('reconstitution')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer ${
            activeTab === 'reconstitution' ? 'text-teal-600' : 'text-slate-400'
          }`}
        >
          <Layers className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-bold mt-0.5 leading-none">Hoàn nguyên</span>
        </button>

        <button
          onClick={() => handleSetActiveTab('settings')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer ${
            activeTab === 'settings' ? 'text-teal-600' : 'text-slate-400'
          }`}
        >
          <Sliders className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-bold mt-0.5 leading-none">Cài đặt</span>
        </button>
      </div>

    </div>
  );
}
