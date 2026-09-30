import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { 
  ReagentMaterial, 
  Transaction, 
  ReconstitutionLog, 
  InUseStability, 
  User,
  BarcodeCategory,
  PopularTest,
  POPULAR_TESTS,
  TestGroup,
  QcResult,
  SystemSettings
} from './types';
import { 
  INITIAL_REAGENTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_RECONSTITUTIONS, 
  INITIAL_IN_USE_STABILITY,
  INITIAL_QC_RESULTS
} from './mockData';

// Load credentials from the auto-provisioned config
import firebaseConfigJson from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = initializeApp(firebaseConfig);

// Use the designated custom database ID provided by the environment configuration
export const db = getFirestore(app, firebaseConfigJson.firestoreDatabaseId);

// Operation Type & Error Handling helper for Firebase Integration Skill compliance
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('Quota limit exceeded') || errorMessage.includes('quota') || errorMessage.includes('resource-exhausted')) {
    window.dispatchEvent(new CustomEvent('firebase-quota-exceeded'));
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (!errorMessage.includes('Quota limit exceeded') && !errorMessage.includes('resource-exhausted')) {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Generic sub-methods with onSnapshot real-time sync or one-off fetches
export function subscribeToCollection<T>(
  collectionName: string, 
  callback: (data: T[]) => void,
  sortField?: string,
  sortDir: 'asc' | 'desc' = 'asc'
) {
  const colRef = collection(db, collectionName);
  let q = colRef;
  if (sortField) {
    q = query(colRef, orderBy(sortField, sortDir)) as any;
  }
  return onSnapshot(q, (snapshot) => {
    const list: T[] = [];
    snapshot.forEach((doc) => {
      list.push({ ...doc.data() } as T);
    });
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, collectionName);
  });
}

// 1. Initial Seeding of Database if empty
export async function seedDatabaseIfEmpty() {
  try {
    // Check users
    let usersSnap;
    try {
      usersSnap = await getDocs(collection(db, 'users'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'users');
    }

    if (usersSnap.empty) {
      console.log('Seeding initial users...');
      const defaultUsers: User[] = [
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
      for (const u of defaultUsers) {
        try {
          await setDoc(doc(db, 'users', u.username), u);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${u.username}`);
        }
      }
    } else {
      // Migrate existing admin name in DB if it is the old name
      try {
        const adminDocRef = doc(db, 'users', 'admin');
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists()) {
          const adminData = adminSnap.data() as User;
          if (adminData.fullName === 'TS. BS. Nguyễn Văn An') {
            await setDoc(adminDocRef, { ...adminData, fullName: 'Ths. Nguyễn Dương Hiển' }, { merge: true });
            console.log('Updated existing admin fullName to Ths. Nguyễn Dương Hiển in Firestore');
          }
        }
      } catch (err) {
        console.warn('Could not update existing admin name in DB', err);
      }
    }

    // Check reagents
    let reagentsSnap;
    try {
      reagentsSnap = await getDocs(collection(db, 'reagents'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'reagents');
    }

    if (reagentsSnap.empty) {
      console.log('Seeding initial reagents...');
      for (const r of INITIAL_REAGENTS) {
        try {
          await setDoc(doc(db, 'reagents', r.id), r);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `reagents/${r.id}`);
        }
      }
    }

    // Check transactions
    let txSnap;
    try {
      txSnap = await getDocs(collection(db, 'transactions'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'transactions');
    }

    if (txSnap.empty) {
      console.log('Seeding initial transactions...');
      for (const t of INITIAL_TRANSACTIONS) {
        try {
          await setDoc(doc(db, 'transactions', t.id), t);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `transactions/${t.id}`);
        }
      }
    }

    // Check reconstitutions
    let reconSnap;
    try {
      reconSnap = await getDocs(collection(db, 'reconstitutions'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'reconstitutions');
    }

    if (reconSnap.empty) {
      console.log('Seeding initial reconstitutions...');
      for (const rc of INITIAL_RECONSTITUTIONS) {
        const enrichedRc = {
          ...rc,
          aliquotsCount: rc.aliquotsCount || 10,
          aliquotVolume: rc.aliquotVolume || '0.5 mL',
          remainingAliquots: rc.remainingAliquots !== undefined ? rc.remainingAliquots : 10
        };
        try {
          await setDoc(doc(db, 'reconstitutions', rc.id), enrichedRc);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `reconstitutions/${rc.id}`);
        }
      }
    }

    // Check inUseStability
    let inUseSnap;
    try {
      inUseSnap = await getDocs(collection(db, 'inUseStability'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'inUseStability');
    }

    if (inUseSnap.empty) {
      console.log('Seeding initial in-use stability...');
      for (const us of INITIAL_IN_USE_STABILITY) {
        try {
          await setDoc(doc(db, 'inUseStability', us.id), us);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `inUseStability/${us.id}`);
        }
      }
    }

    // Check barcodeCategories
    let barcodeCategoriesSnap;
    try {
      barcodeCategoriesSnap = await getDocs(collection(db, 'barcodeCategories'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'barcodeCategories');
    }

    if (barcodeCategoriesSnap.empty) {
      console.log('Seeding initial barcode categories...');
      const defaultCategories: BarcodeCategory[] = [
        {
          id: 'QCSH2',
          code: 'QCSH2',
          name: 'QC Sinh hóa Level 2',
          category: 'Sinh hóa',
          description: 'QC chất lượng Sinh hóa Level 2',
          createdAt: new Date().toISOString()
        },
        {
          id: 'QCSH3',
          code: 'QCSH3',
          name: 'QC Sinh hóa Level 3',
          category: 'Sinh hóa',
          description: 'QC chất lượng Sinh hóa Level 3',
          createdAt: new Date().toISOString()
        },
        {
          id: 'QCHH1',
          code: 'QCHH1',
          name: 'QC Huyết học Level 1',
          category: 'Huyết học',
          description: 'QC chất lượng Huyết học Level 1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'QCMDH1',
          code: 'QCMDH1',
          name: 'QC Miễn dịch Level 1',
          category: 'Miễn dịch',
          description: 'QC chất lượng Miễn dịch Level 1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'CSH1',
          code: 'CSH1',
          name: 'Calibrator Sinh hóa L1',
          category: 'Sinh hóa',
          description: 'Hiệu chuẩn Sinh hóa Level 1',
          createdAt: new Date().toISOString()
        }
      ];
      for (const bc of defaultCategories) {
        try {
          await setDoc(doc(db, 'barcodeCategories', bc.id), bc);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `barcodeCategories/${bc.id}`);
        }
      }
    }

    // Check popularTests
    let popularTestsSnap;
    try {
      popularTestsSnap = await getDocs(collection(db, 'popularTests'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'popularTests');
    }

    if (popularTestsSnap.empty) {
      console.log('Seeding initial popular tests...');
      for (const t of POPULAR_TESTS) {
        // Enforce secure matching ID format: alphanumeric plus underscore or hyphen
        const id = t.replace(/[^a-zA-Z0-9_\-]/g, '_');
        try {
          await setDoc(doc(db, 'popularTests', id), { id, name: t });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `popularTests/${id}`);
        }
      }
    }

    // Check qcResults
    let qcResultsSnap;
    try {
      qcResultsSnap = await getDocs(collection(db, 'qcResults'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'qcResults');
    }

    if (qcResultsSnap.empty) {
      console.log('Seeding initial QC results...');
      for (const qc of INITIAL_QC_RESULTS) {
        try {
          await setDoc(doc(db, 'qcResults', qc.id), qc);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `qcResults/${qc.id}`);
        }
      }
    }

    // Check system state
    let stateDoc;
    try {
      stateDoc = await getDoc(doc(db, 'systemState', 'current'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'systemState/current');
    }

    if (!stateDoc.exists()) {
      try {
        await setDoc(doc(db, 'systemState', 'current'), {
          simulatedTime: '',
          isSimulated: false
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'systemState/current');
      }
    }

    // Check system settings
    let settingsDoc;
    try {
      settingsDoc = await getDoc(doc(db, 'settings', 'systemConfig'));
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, 'settings/systemConfig');
    }

    if (!settingsDoc.exists()) {
      try {
        await setDoc(doc(db, 'settings', 'systemConfig'), {
          hospitalLogo: '',
          headerRow1: 'QT-QLCL-05-BM03',
          headerRow2: 'Phiên bản: 1.2 (2429-QĐ/BYT)',
          headerRow3: 'Ngày hiệu lực:',
          headerRow4: '15/07/2026'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/systemConfig');
      }
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// 2. Reset Database to Default Mock Data
export async function resetDatabaseToDefault() {
  try {
    const collectionsToReset = ['reagents', 'transactions', 'reconstitutions', 'inUseStability', 'systemState', 'barcodeCategories', 'popularTests', 'qcResults'];
    for (const col of collectionsToReset) {
      let snap;
      try {
        snap = await getDocs(collection(db, col));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, col);
        continue;
      }
      for (const document of snap.docs) {
        try {
          await deleteDoc(doc(db, col, document.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `${col}/${document.id}`);
        }
      }
    }
    await seedDatabaseIfEmpty();
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

// Helper to recursively remove undefined properties from any object for Firestore compatibility
function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// 3. Reagents CRUD
export async function saveReagent(reagent: ReagentMaterial) {
  try {
    const cleanData = cleanUndefined(reagent);
    await setDoc(doc(db, 'reagents', reagent.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `reagents/${reagent.id}`);
  }
}

export async function deleteReagentFromDb(id: string) {
  try {
    await deleteDoc(doc(db, 'reagents', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reagents/${id}`);
  }
}

// 4. Transactions CRUD
export async function saveTransaction(transaction: Transaction) {
  try {
    const cleanData = cleanUndefined(transaction);
    await setDoc(doc(db, 'transactions', transaction.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `transactions/${transaction.id}`);
  }
}

export async function clearAllTransactionsInDb() {
  try {
    const snap = await getDocs(collection(db, 'transactions'));
    for (const document of snap.docs) {
      try {
        await deleteDoc(doc(db, 'transactions', document.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `transactions/${document.id}`);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'transactions');
  }
}

// 5. Reconstitution CRUD
export async function saveReconstitution(reconstitution: ReconstitutionLog) {
  try {
    const cleanData = cleanUndefined(reconstitution);
    await setDoc(doc(db, 'reconstitutions', reconstitution.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `reconstitutions/${reconstitution.id}`);
  }
}

export async function deleteReconstitutionFromDb(id: string) {
  try {
    await deleteDoc(doc(db, 'reconstitutions', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reconstitutions/${id}`);
  }
}

// 6. In-Use Stability CRUD
export async function saveInUseStability(inUse: InUseStability) {
  try {
    const cleanData = cleanUndefined(inUse);
    await setDoc(doc(db, 'inUseStability', inUse.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `inUseStability/${inUse.id}`);
  }
}

export async function deleteInUseStabilityFromDb(id: string) {
  try {
    await deleteDoc(doc(db, 'inUseStability', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `inUseStability/${id}`);
  }
}

// 7. Users CRUD
export async function saveUser(user: User) {
  try {
    const cleanData = cleanUndefined(user);
    await setDoc(doc(db, 'users', user.username), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.username}`);
  }
}

export async function deleteUserFromDb(username: string) {
  try {
    await deleteDoc(doc(db, 'users', username));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${username}`);
  }
}

// 8. Simulated Time persistence
export async function saveSimulatedTime(timeStr: string, isSimulated: boolean = true) {
  try {
    await setDoc(doc(db, 'systemState', 'current'), { 
      simulatedTime: timeStr,
      isSimulated
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'systemState/current');
  }
}

// 9. Barcode Categories CRUD
export async function saveBarcodeCategory(barcodeCategory: BarcodeCategory) {
  try {
    const cleanData = cleanUndefined(barcodeCategory);
    await setDoc(doc(db, 'barcodeCategories', barcodeCategory.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `barcodeCategories/${barcodeCategory.id}`);
  }
}

export async function deleteBarcodeCategoryFromDb(id: string) {
  try {
    await deleteDoc(doc(db, 'barcodeCategories', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `barcodeCategories/${id}`);
  }
}

// 10. Popular Tests CRUD
export async function savePopularTest(test: PopularTest) {
  try {
    const cleanData = cleanUndefined(test);
    await setDoc(doc(db, 'popularTests', test.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `popularTests/${test.id}`);
  }
}

export async function deletePopularTestFromDb(id: string) {
  try {
    await deleteDoc(doc(db, 'popularTests', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `popularTests/${id}`);
  }
}

// 11. Test Groups CRUD
export async function saveTestGroup(group: TestGroup) {
  try {
    const cleanData = cleanUndefined(group);
    await setDoc(doc(db, 'testGroups', group.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `testGroups/${group.id}`);
  }
}

export async function deleteTestGroupFromDb(id: string) {
  try {
    await deleteDoc(doc(db, 'testGroups', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `testGroups/${id}`);
  }
}

// 12. QC Results CRUD
export async function saveQcResult(qcResult: QcResult) {
  try {
    const cleanData = cleanUndefined(qcResult);
    await setDoc(doc(db, 'qcResults', qcResult.id), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `qcResults/${qcResult.id}`);
  }
}

export async function deleteQcResultFromDb(id: string) {
  try {
    await deleteDoc(doc(db, 'qcResults', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `qcResults/${id}`);
  }
}

// 13. System Settings CRUD
export async function saveSystemSettings(settings: SystemSettings) {
  try {
    const cleanData = cleanUndefined(settings);
    await setDoc(doc(db, 'settings', 'systemConfig'), cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/systemConfig');
  }
}

export function subscribeToSystemSettings(callback: (settings: SystemSettings | null) => void) {
  return onSnapshot(doc(db, 'settings', 'systemConfig'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as SystemSettings);
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'settings/systemConfig');
  });
}


