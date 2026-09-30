export type LabCategory = 'Sinh hóa' | 'Huyết học' | 'Miễn dịch';

export interface ReagentMaterial {
  id: string;
  name: string;
  category: LabCategory;
  manufacturer: string;
  lotNumber: string;
  originalExpiryDate: string; // YYYY-MM-DD
  minStockLimit: number;
  unit: string;
  packSize: string; // e.g. "250 tests/hộp", "500 mL/chai"
  reconstitutionRequired: boolean;
  inUseStabilityDays: number; // Number of days stable after opening
  currentStock: number; // Current stock count
  location: string; // "Tủ lạnh 2-8°C", "Tủ đông -20°C", "Nhiệt độ phòng (20-25°C)"
  notes?: string;
  assignedTests?: string[]; // List of tests assigned for QC/Calibrator
  specTableImageUrl?: string; // Spec table image URL or base64 data
  attachmentUrl?: string; // PDF or Image file data URL (base64)
  attachmentName?: string; // The file name of the attachment
  attachmentType?: string; // 'pdf' | 'image' | 'other'
  barcodeCategoryCode?: string; // Linked Barcode Category code (if any)
}

export const POPULAR_TESTS = [
  'Glucose', 'AST (GOT)', 'ALT (GPT)', 'Urea', 'Creatinine',
  'HBsAg', 'HIV', 'HCV', 'Troponin', 'Cholesterol', 'Triglycerides',
  'Bilirubin', 'Albumin', 'Protein', 'Amylase', 'CK-MB', 'HbA1c',
  'TSH', 'FT3', 'FT4', 'CRP', 'Na+', 'K+', 'Cl-', 'Ca++',
  'WBC', 'RBC', 'HGB', 'PLT'
];

export type TransactionType = 'nhap' | 'xuat' | 'Hủy' | 'Xuất' | 'linh' | 'Thanh lý' | 'Lỗi/Hỏng';

export interface Transaction {
  id: string;
  timestamp: string; // ISO String
  reagentId: string;
  reagentName: string; // Cache reagent name for easier display
  category: LabCategory;
  type: TransactionType;
  quantity: number;
  actor: string;
  notes?: string;
}

export interface ReconstitutionLog {
  id: string;
  timestamp: string; // ISO String
  targetItemName: string; // Calibrator Multical, QC L1, AST Reagent, etc.
  category: LabCategory;
  sourceLot: string;
  volume: string; // e.g., "3.0 mL", "5.0 mL"
  solvent: string; // e.g., "Nước cất deion", "Dung môi đi kèm"
  preparedBy: string;
  stabilityHours: number; // Hours it is stable at 2-8°C after reconstitution
  expiryTimestamp: string; // ISO String (calculated)
  notes?: string;
  status: 'Đang sử dụng' | 'Đã hết' | 'Đã hủy';
  aliquotsCount?: number; // Number of small tubes split
  aliquotVolume?: string; // Volume of each tube (e.g. "0.5 mL/tuýp")
  remainingAliquots?: number; // Number of small tubes remaining
  barcodeCategoryCode?: string; // Linked Barcode Category code (if any)
}

export interface InUseStability {
  id: string;
  reagentId: string;
  reagentName: string;
  category: LabCategory;
  lotNumber: string;
  openedDate: string; // YYYY-MM-DD or ISO String
  openedBy: string;
  inUseStabilityDays: number;
  originalExpiryDate: string;
  calculatedExpiry: string; // YYYY-MM-DD (min of originalExpiryDate and openedDate + inUseStabilityDays)
  positionInMachine: string; // e.g., "Cobas c501 - Khay R1 - Vị trí 25"
  remainingTests?: number;
  totalTests?: number;
  status: 'active' | 'expired' | 'depleted' | 'discarded';
  notes?: string;
  barcodeCategoryCode?: string; // Linked Barcode Category code (if any)
}

export interface IsoWarning {
  id: string;
  type: 'EXPIRY_ORIGINAL' | 'EXPIRY_IN_USE' | 'LOW_STOCK' | 'EXPIRY_RECONSTITUTED';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  itemName: string;
  category: LabCategory;
  message: string;
  details: string;
  relatedId: string; // ID of the reagent, open vial, or reconstitution
}

export interface User {
  username: string;
  fullName: string;
  role: string;
  password?: string;
}

export interface BarcodeCategory {
  id: string;
  code: string;
  name: string;
  category: LabCategory;
  description?: string;
  createdAt: string;
  // QC Planning fields
  frequencyType?: 'daily' | 'weekly' | 'interval' | 'none';
  weeklyDays?: number[]; // [1, 2, 3, 4, 5, 6, 0] where 1 = Thứ 2, ..., 0 = Chủ Nhật
  intervalDays?: number; // Số ngày giãn cách
  startDate?: string; // Ngày bắt đầu chu kỳ (YYYY-MM-DD)
}

export interface PopularTest {
  id: string;
  name: string;
}

export interface TestGroup {
  id: string;
  name: string;
  testNames: string[];
}

export interface QcResult {
  id: string;
  date: string; // YYYY-MM-DD
  testName: string;
  category: LabCategory;
  level: string; // "Level 1" | "Level 2" | "Level 3"
  machineName?: string; // Tên máy xét nghiệm
  value: number;
  minVal: number;
  maxVal: number;
  unit: string;
  status: 'Passed' | 'Warning' | 'Resolved';
  westgardRule?: string; // e.g. "1-3s", "2-2s"
  correctiveAction?: 'Calib lại' | 'Thay hóa chất mới' | 'Bảo dưỡng máy' | 'Lý do khác' | string;
  correctiveNotes?: string;
  handledBy?: string;
  handledAt?: string; // ISO String
}

export type FridgeId = 'tu-sinh-hoa' | 'tu-mien-dich' | 'tu-huyet-hoc';

export interface FridgeLocationItem {
  id: string;
  fridgeId: FridgeId;
  shelfTier: 0 | 1 | 2 | 3; // Tier 0: Freezer (-20°C), Tier 1: Original/Unopened (2-8°C), Tier 2: In-Use/Reconstituted (2-8°C), Tier 3: Expired/Quarantine
  itemName: string;
  category: LabCategory;
  lotNumber: string;
  originalExpiryDate: string;
  openOrReconDate?: string;
  inUseStabilityInfo?: string;
  quantity?: string;
  status: 'normal' | 'in_use' | 'expired_isolated';
  notes?: string;
  barcodeCategoryCode?: string;
  isRedTagged?: boolean;
}

export interface SystemSettings {
  hospitalLogo?: string;
  headerRow1: string;
  headerRow2: string;
  headerRow3: string;
  headerRow4: string;
}


