import { ReagentMaterial, Transaction, ReconstitutionLog, InUseStability, QcResult } from './types';

export const INITIAL_REAGENTS: ReagentMaterial[] = [
  {
    id: 'R-001',
    name: 'Glucose Liquicolor (Cobas)',
    category: 'Sinh hóa',
    manufacturer: 'Roche Diagnostics',
    lotNumber: 'LOT-GLU-2045A',
    originalExpiryDate: '2027-05-15',
    minStockLimit: 10,
    unit: 'Hộp',
    packSize: '400 tests/hộp',
    reconstitutionRequired: false,
    inUseStabilityDays: 28,
    currentStock: 0,
    location: 'Tủ lạnh 2-8°C',
    notes: 'Hóa chất đo Glucose trong huyết thanh/huyết tương'
  },
  {
    id: 'R-002',
    name: 'AST/GOT Liquid (Cobas)',
    category: 'Sinh hóa',
    manufacturer: 'Roche Diagnostics',
    lotNumber: 'LOT-AST-3098B',
    originalExpiryDate: '2026-07-20',
    minStockLimit: 8,
    unit: 'Hộp',
    packSize: '200 tests/hộp',
    reconstitutionRequired: true,
    inUseStabilityDays: 30,
    currentStock: 0,
    location: 'Tủ lạnh 2-8°C',
    notes: 'Hóa chất đo hoạt độ Men gan AST'
  },
  {
    id: 'R-003',
    name: 'Cellpack DCL (XN-1000)',
    category: 'Huyết học',
    manufacturer: 'Sysmex',
    lotNumber: 'LOT-DCL-Sys405',
    originalExpiryDate: '2027-08-30',
    minStockLimit: 6,
    unit: 'Chai',
    packSize: '20 L/chai',
    reconstitutionRequired: false,
    inUseStabilityDays: 60,
    currentStock: 0,
    location: 'Nhiệt độ phòng (20-25°C)',
    notes: 'Dung dịch pha loãng tế bào máu dùng cho máy Sysmex XN'
  },
  {
    id: 'R-004',
    name: 'Lysercell WDF (XN-1000)',
    category: 'Huyết học',
    manufacturer: 'Sysmex',
    lotNumber: 'LOT-WDF-Sys901',
    originalExpiryDate: '2026-06-25',
    minStockLimit: 4,
    unit: 'Chai',
    packSize: '5 L/chai',
    reconstitutionRequired: false,
    inUseStabilityDays: 30,
    currentStock: 0,
    location: 'Nhiệt độ phòng (20-25°C)',
    notes: 'Dung dịch ly giải tế bào Lympho/Bạch cầu ái toan'
  },
  {
    id: 'R-005',
    name: 'Troponin I High Sensitive',
    category: 'Miễn dịch',
    manufacturer: 'Abbott Laboratories',
    lotNumber: 'LOT-TROP-Ab12',
    originalExpiryDate: '2027-02-14',
    minStockLimit: 5,
    unit: 'Hộp',
    packSize: '100 tests/hộp',
    reconstitutionRequired: false,
    inUseStabilityDays: 14,
    currentStock: 0,
    location: 'Tủ lạnh 2-8°C',
    notes: 'Hóa chất xét nghiệm Troponin I tim nhạy cao'
  },
  {
    id: 'R-006',
    name: 'Immunology Wash Buffer',
    category: 'Miễn dịch',
    manufacturer: 'Abbott Laboratories',
    lotNumber: 'LOT-WASH-Roche55',
    originalExpiryDate: '2027-10-10',
    minStockLimit: 4,
    unit: 'Chai',
    packSize: '10 L/chai',
    reconstitutionRequired: false,
    inUseStabilityDays: 60,
    currentStock: 0,
    location: 'Nhiệt độ phòng (20-25°C)',
    notes: 'Dung dịch rửa dùng cho hệ thống miễn dịch tự động'
  },
  {
    id: 'R-007',
    name: 'Multical calibrator (Sinh hóa)',
    category: 'Sinh hóa',
    manufacturer: 'Roche Diagnostics',
    lotNumber: 'LOT-MC-88',
    originalExpiryDate: '2027-01-01',
    minStockLimit: 3,
    unit: 'Lọ',
    packSize: '5 x 3 mL/hộp',
    reconstitutionRequired: true,
    inUseStabilityDays: 1,
    currentStock: 0,
    location: 'Tủ lạnh 2-8°C',
    notes: 'Chất chuẩn đa thành phần cho máy Sinh hóa'
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-001',
    timestamp: '2026-06-15T08:30:00Z',
    reagentId: 'R-001',
    reagentName: 'Glucose Liquicolor (Cobas)',
    category: 'Sinh hóa',
    type: 'nhap',
    quantity: 10,
    actor: 'Nguyễn Thị Minh',
    notes: 'Nhập kho hóa chất định kỳ từ Roche Việt Nam'
  },
  {
    id: 'TX-002',
    timestamp: '2026-06-16T10:15:00Z',
    reagentId: 'R-001',
    reagentName: 'Glucose Liquicolor (Cobas)',
    category: 'Sinh hóa',
    type: 'linh',
    quantity: 4,
    actor: 'Trần Văn Hùng',
    notes: 'Lĩnh 4 hộp cấp phát cho lab chính (máy Cobas c501)'
  },
  {
    id: 'TX-003',
    timestamp: '2026-06-20T14:00:00Z',
    reagentId: 'R-002',
    reagentName: 'AST/GOT Liquid (Cobas)',
    category: 'Sinh hóa',
    type: 'nhap',
    quantity: 12,
    actor: 'Nguyễn Thị Minh',
    notes: 'Nhập kho lô mới, hạn dùng ngắn cần lưu ý'
  },
  {
    id: 'TX-004',
    timestamp: '2026-06-22T09:00:00Z',
    reagentId: 'R-004',
    reagentName: 'Lysercell WDF (XN-1000)',
    category: 'Huyết học',
    type: 'xuat',
    quantity: 1,
    actor: 'Lê Văn Lâm',
    notes: 'Xuất hủy 1 chai do quá hạn sử dụng gốc'
  },
  {
    id: 'TX-005',
    timestamp: '2026-06-28T16:45:00Z',
    reagentId: 'R-005',
    reagentName: 'Troponin I High Sensitive',
    category: 'Miễn dịch',
    type: 'linh',
    quantity: 3,
    actor: 'Phan Huy Hoàng',
    notes: 'Lĩnh về máy Architect i2000SR phục vụ trực đêm'
  }
];

export const INITIAL_RECONSTITUTIONS: ReconstitutionLog[] = [
  {
    id: 'RC-001',
    timestamp: '2026-06-29T18:00:00Z', // Reconstituted 15.5 hours before current time
    targetItemName: 'Multical calibrator (Lọ chuẩn)',
    category: 'Sinh hóa',
    sourceLot: 'LOT-MC-88',
    volume: '3.0 mL',
    solvent: 'Nước cất hai lần (deionized)',
    preparedBy: 'Trần Văn Hùng',
    stabilityHours: 24,
    expiryTimestamp: '2026-06-30T18:00:00Z', // Expires in 16.5 hours
    status: 'Đang sử dụng',
    notes: 'Để yên 30 phút ổn định trước khi chạy calibrator',
    aliquotsCount: 6,
    aliquotVolume: '0.5 mL',
    remainingAliquots: 4
  },
  {
    id: 'RC-002',
    timestamp: '2026-06-29T11:00:00Z', // Reconstituted 14.5 hours before current time (expired!)
    targetItemName: 'QC Lyphochek Level 1',
    category: 'Sinh hóa',
    sourceLot: 'LOT-QC-L1-44B',
    volume: '5.0 mL',
    solvent: 'Dung môi hoàn nguyên Bio-Rad',
    preparedBy: 'Nguyễn Thị Lan',
    stabilityHours: 12, // Stable for 12h at 2-8°C
    expiryTimestamp: '2026-06-29T23:00:00Z', // Expired yesterday
    status: 'Đã hết',
    notes: 'Đã dùng hết và hủy vỏ lọ',
    aliquotsCount: 10,
    aliquotVolume: '0.5 mL',
    remainingAliquots: 0
  },
  {
    id: 'RC-003',
    timestamp: '2026-06-30T00:30:00Z', // Reconstituted 1 hour before current time (active, 11 hours left)
    targetItemName: 'QC Lyphochek Level 2',
    category: 'Sinh hóa',
    sourceLot: 'LOT-QC-L2-44C',
    volume: '5.0 mL',
    solvent: 'Dung môi hoàn nguyên Bio-Rad',
    preparedBy: 'Lê Văn Lâm',
    stabilityHours: 12,
    expiryTimestamp: '2026-06-30T12:30:00Z', // Expires in 11 hours
    status: 'Đang sử dụng',
    notes: 'Sử dụng cho kiểm tra chất lượng đầu ngày',
    aliquotsCount: 10,
    aliquotVolume: '0.5 mL',
    remainingAliquots: 8
  }
];

export const INITIAL_IN_USE_STABILITY: InUseStability[] = [
  {
    id: 'US-001',
    reagentId: 'R-002',
    reagentName: 'AST/GOT Liquid (Cobas)',
    category: 'Sinh hóa',
    lotNumber: 'LOT-AST-3098B',
    openedDate: '2026-06-01',
    openedBy: 'Trần Văn Hùng',
    inUseStabilityDays: 30,
    originalExpiryDate: '2026-07-20',
    calculatedExpiry: '2026-07-01', // Opened date + 30 days = July 1st (tomorrow!)
    positionInMachine: 'Cobas c501 - Vị trí 12',
    remainingTests: 45,
    totalTests: 200,
    status: 'active', // Triggers in-use warning (expires tomorrow)
    notes: 'Mở nắp đặt trực tiếp trên khoang lạnh máy Cobas c501'
  },
  {
    id: 'US-002',
    reagentId: 'R-001',
    reagentName: 'Glucose Liquicolor (Cobas)',
    category: 'Sinh hóa',
    lotNumber: 'LOT-GLU-2045A',
    openedDate: '2026-06-25',
    openedBy: 'Lê Văn Lâm',
    inUseStabilityDays: 28,
    originalExpiryDate: '2027-05-15',
    calculatedExpiry: '2026-07-23', // Opened date + 28 days
    positionInMachine: 'Cobas c501 - Vị trí 03',
    remainingTests: 310,
    totalTests: 400,
    status: 'active',
    notes: 'Đang chạy ổn định, kiểm tra QC đạt'
  },
  {
    id: 'US-003',
    reagentId: 'R-006',
    reagentName: 'Immunology Wash Buffer',
    category: 'Miễn dịch',
    lotNumber: 'LOT-WASH-Roche55',
    openedDate: '2026-04-15', // Opened 76 days ago
    openedBy: 'Phan Huy Hoàng',
    inUseStabilityDays: 60, // Stable for 60 days
    originalExpiryDate: '2027-10-10',
    calculatedExpiry: '2026-06-14', // Expired 16 days ago!
    positionInMachine: 'Architect i2000SR - Bình phụ R2',
    remainingTests: 1200,
    totalTests: 5000,
    status: 'active', // Will trigger CRITICAL open stability warning!
    notes: 'Wash buffer bình lớn bên hông máy. Cần thay thế ngay!'
  }
];

export const INITIAL_QC_RESULTS: QcResult[] = [
  {
    id: 'QC-RES-001',
    date: '2026-07-08',
    testName: 'Glucose',
    category: 'Sinh hóa',
    level: 'Level 2',
    value: 5.1,
    minVal: 4.5,
    maxVal: 5.5,
    unit: 'mmol/L',
    status: 'Passed'
  },
  {
    id: 'QC-RES-002',
    date: '2026-07-08',
    testName: 'AST (GOT)',
    category: 'Sinh hóa',
    level: 'Level 2',
    value: 41,
    minVal: 30,
    maxVal: 50,
    unit: 'U/L',
    status: 'Passed'
  },
  {
    id: 'QC-RES-003',
    date: '2026-07-08',
    testName: 'ALT (GPT)',
    category: 'Sinh hóa',
    level: 'Level 2',
    value: 62,
    minVal: 32,
    maxVal: 48,
    unit: 'U/L',
    status: 'Warning',
    westgardRule: '1-3s (Vượt ngưỡng 3 SD)'
  },
  {
    id: 'QC-RES-004',
    date: '2026-07-08',
    testName: 'WBC (Bạch cầu)',
    category: 'Huyết học',
    level: 'Level 1',
    value: 7.2,
    minVal: 4.0,
    maxVal: 10.0,
    unit: 'G/L',
    status: 'Passed'
  },
  {
    id: 'QC-RES-005',
    date: '2026-07-08',
    testName: 'HGB (Huyết sắc tố)',
    category: 'Huyết học',
    level: 'Level 1',
    value: 135,
    minVal: 110,
    maxVal: 165,
    unit: 'g/L',
    status: 'Passed'
  },
  {
    id: 'QC-RES-006',
    date: '2026-07-08',
    testName: 'PLT (Tiểu cầu)',
    category: 'Huyết học',
    level: 'Level 1',
    value: 120,
    minVal: 150,
    maxVal: 450,
    unit: 'G/L',
    status: 'Warning',
    westgardRule: '2-2s (2 kết quả liên tiếp vượt 2 SD)'
  },
  {
    id: 'QC-RES-007',
    date: '2026-07-08',
    testName: 'TSH (Hormone giáp)',
    category: 'Miễn dịch',
    level: 'Level 1',
    value: 2.1,
    minVal: 0.4,
    maxVal: 4.0,
    unit: 'mIU/L',
    status: 'Passed'
  },
  {
    id: 'QC-RES-008',
    date: '2026-07-08',
    testName: 'Troponin I HS',
    category: 'Miễn dịch',
    level: 'Level 2',
    value: 0.28,
    minVal: 0.0,
    maxVal: 0.05,
    unit: 'ng/mL',
    status: 'Warning',
    westgardRule: '1-3s (Vượt ngưỡng 3 SD)'
  }
];

