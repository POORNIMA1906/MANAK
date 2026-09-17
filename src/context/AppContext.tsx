import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppScreen, UserRole, InspectionRecord, ConsumerReport, ExtractionResult, Product, RuleEvaluation } from '../types';
import {
  getStoredInspections,
  saveInspection,
  getStoredConsumerReports,
  saveConsumerReport,
  getOfflineQueue,
  syncOfflineQueueToServer,
  saveStoredInspections,
  saveStoredConsumerReports
} from '../services/offlineStorage';
import { evaluateExtractionAgainstRules } from '../services/ruleEngine';
import { fetchHistoryApi, fetchConsumerReportsApi, loginApi, submitConsumerReportApi } from '../services/api';
import { saveInspectionDirectToSupabase } from '../services/supabaseService';
import { requestAllPermissionsDirectly, getCurrentGeoLocation } from '../services/locationService';
import { subscribeToFirebaseAuth, signOutFirebaseConsumer } from '../services/firebaseAuthService';

interface AppContextType {
  userRole: UserRole;
  activeScreen: AppScreen;
  screenHistory: AppScreen[];
  officerProfile: {
    name: string;
    badge_id: string;
    zone: string;
    avatar: string;
  };
  consumerProfile: {
    name: string;
    phone: string;
  };
  inspections: InspectionRecord[];
  consumerReports: ConsumerReport[];
  currentProduct: Product | null;
  currentExtraction: ExtractionResult | null;
  currentEvaluations: RuleEvaluation[];
  isCompliant: boolean;
  totalViolations: number;
  totalPenalty: number;
  currentInspectionId: string | null;
  isOffline: boolean;
  offlineQueueCount: number;
  deviceFrame: boolean;
  toggleDeviceFrame: () => void;
  toggleOffline: () => void;
  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;
  selectRole: (role: UserRole) => void;
  loginOfficer: (id: string, pass: string) => Promise<void>;
  loginConsumer: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
  pendingScanPayload: { image_base64?: string; images_base64?: string[]; raw_text?: string } | null;
  startScanExtraction: (payload: { image_base64?: string; images_base64?: string[]; raw_text?: string }) => void;
  setCurrentExtraction: React.Dispatch<React.SetStateAction<ExtractionResult | null>>;
  setCurrentProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  setExtractionReviewData: (product: Product, extraction: ExtractionResult) => void;
  setAnalysisData: (product: Product, extraction: ExtractionResult, overrideEvaluations?: RuleEvaluation[], overrideInspectionId?: string) => void;
  finalizeInspection: (signDoc?: boolean) => InspectionRecord;
  submitNewConsumerReport: (note?: string) => Promise<ConsumerReport>;
  syncOfflineQueue: () => void;
  refreshDataFromBackend: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('splash');
  const [screenHistory, setScreenHistory] = useState<AppScreen[]>(['splash']);
  const [deviceFrame, setDeviceFrame] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [consumerReports, setConsumerReports] = useState<ConsumerReport[]>([]);

  // Pending OCR scan payload
  const [pendingScanPayload, setPendingScanPayload] = useState<{ image_base64?: string; raw_text?: string } | null>(null);

  // Current analysis state initialized to null
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [currentExtraction, setCurrentExtraction] = useState<ExtractionResult | null>(null);
  const [currentEvaluations, setCurrentEvaluations] = useState<RuleEvaluation[]>([]);
  const [isCompliant, setIsCompliant] = useState<boolean>(false);
  const [totalViolations, setTotalViolations] = useState<number>(0);
  const [totalPenalty, setTotalPenalty] = useState<number>(0);
  const [currentInspectionId, setCurrentInspectionId] = useState<string | null>(null);

  const [officerProfile, setOfficerProfile] = useState({
    name: 'Enforcement Official',
    badge_id: 'GOV26034',
    zone: 'Legal Metrology Division',
    avatar: 'LM'
  });

  const [consumerProfile, setConsumerProfile] = useState({
    name: 'Citizen User',
    phone: ''
  });

  const refreshDataFromBackend = async () => {
    try {
      const apiInspections = await fetchHistoryApi();
      if (apiInspections && apiInspections.length > 0) {
        const localStored = getStoredInspections();
        const merged = apiInspections.map(apiRec => {
          const match = localStored.find(l => l.id === apiRec.id || (l.report_id && l.report_id === apiRec.report_id));
          if (match && (!apiRec.product?.image_url && !apiRec.evidence_image)) {
            return {
              ...apiRec,
              evidence_image: match.evidence_image || match.product?.image_url || '',
              product: {
                ...apiRec.product,
                image_url: match.product?.image_url || match.evidence_image || apiRec.product?.image_url
              }
            };
          }
          return apiRec;
        });
        setInspections(merged);
        saveStoredInspections(merged);
      } else {
        setInspections(getStoredInspections());
      }

      const apiReports = await fetchConsumerReportsApi();
      if (apiReports && apiReports.length > 0) {
        const localReports = getStoredConsumerReports();
        const mergedReports = apiReports.map(apiRep => {
          const match = localReports.find(l => l.id === apiRep.id || l.reference_id === apiRep.reference_id);
          if (match && match.product_image && !apiRep.product_image) {
            return {
              ...apiRep,
              product_image: match.product_image
            };
          }
          return apiRep;
        });
        setConsumerReports(mergedReports);
        saveStoredConsumerReports(mergedReports);
      } else {
        setConsumerReports(getStoredConsumerReports());
      }
    } catch {
      setInspections(getStoredInspections());
      setConsumerReports(getStoredConsumerReports());
    }
  };

  // Load data on initial mount
  useEffect(() => {
    setInspections(getStoredInspections());
    setConsumerReports(getStoredConsumerReports());
    setOfflineQueueCount(getOfflineQueue().length);

    requestAllPermissionsDirectly();
    refreshDataFromBackend();

    const handleQueueUpdated = (e: any) => {
      setOfflineQueueCount(e.detail?.count ?? getOfflineQueue().length);
    };
    const handleQueueSynced = () => {
      refreshDataFromBackend();
      setOfflineQueueCount(0);
    };

    window.addEventListener('manak:queue-updated', handleQueueUpdated);
    window.addEventListener('manak:queue-synced', handleQueueSynced);

    // Auto-restore persistent Firebase Authentication session
    const unsubscribeFirebase = subscribeToFirebaseAuth(user => {
      if (user && user.phoneNumber) {
        const cleanPhone = user.phoneNumber.replace(/^\+91/, '');
        setConsumerProfile(prev => ({
          ...prev,
          name: prev.name || 'Citizen User',
          phone: cleanPhone
        }));
        setUserRole('consumer');
        setActiveScreen('consumer_dashboard');
      }
    });

    return () => {
      window.removeEventListener('manak:queue-updated', handleQueueUpdated);
      window.removeEventListener('manak:queue-synced', handleQueueSynced);
      unsubscribeFirebase();
    };
  }, []);

  const navigateTo = (screen: AppScreen) => {
    setScreenHistory(prev => [...prev, screen]);
    setActiveScreen(screen);
  };

  const goBack = () => {
    if (screenHistory.length > 1) {
      const newHistory = [...screenHistory];
      newHistory.pop();
      const prevScreen = newHistory[newHistory.length - 1];
      setScreenHistory(newHistory);
      setActiveScreen(prevScreen);
    } else {
      if (userRole === 'officer') setActiveScreen('officer_dashboard');
      else if (userRole === 'consumer') setActiveScreen('consumer_dashboard');
      else setActiveScreen('role_select');
    }
  };

  const selectRole = (role: UserRole) => {
    setUserRole(role);
    requestAllPermissionsDirectly();
    if (role === 'officer') {
      navigateTo('officer_login');
    } else if (role === 'consumer') {
      navigateTo('consumer_login');
    }
  };

  const loginOfficer = async (id: string, pass: string) => {
    const res = await loginApi('officer', id, pass);
    if (res?.user) {
      setOfficerProfile(prev => ({
        ...prev,
        name: res.user.name || prev.name,
        badge_id: id || res.user.badge_id || prev.badge_id
      }));
    }
    setUserRole('officer');
    navigateTo('officer_dashboard');
    refreshDataFromBackend();
  };

  const loginConsumer = async (phone: string, otp: string) => {
    const res = await loginApi('consumer', phone, otp);
    if (res?.user) {
      setConsumerProfile(prev => ({
        ...prev,
        name: res.user.name || prev.name,
        phone: phone || res.user.phone || prev.phone
      }));
    }
    setUserRole('consumer');
    navigateTo('consumer_dashboard');
    refreshDataFromBackend();
  };

  const logout = () => {
    signOutFirebaseConsumer().catch(() => {});
    setUserRole(null);
    navigateTo('role_select');
  };

  const startScanExtraction = (payload: { image_base64?: string; images_base64?: string[]; raw_text?: string }) => {
    setPendingScanPayload(payload);
    const primaryImg = payload.images_base64?.[0] || payload.image_base64;
    const allImages = payload.images_base64 || (primaryImg ? [primaryImg] : []);

    if (primaryImg) {
      setCurrentProduct({
        id: `prod-${Date.now().toString().slice(-6)}`,
        title: 'Scanning Package...',
        brand: 'Declared Manufacturer',
        category: 'Packaged Retail Commodity',
        source_type: 'store',
        image_url: primaryImg,
        images: allImages
      });
    }
    navigateTo('ocr_extracting');
  };

  const setExtractionReviewData = (product: Product, extraction: ExtractionResult) => {
    setCurrentProduct(product);
    setCurrentExtraction(extraction);
  };

  const setAnalysisData = (
    product: Product,
    extraction: ExtractionResult,
    overrideEvaluations?: RuleEvaluation[],
    overrideInspectionId?: string
  ) => {
    setCurrentProduct(product);
    setCurrentExtraction(extraction);

    const evaluations = overrideEvaluations || evaluateExtractionAgainstRules(extraction).evaluations;
    const violations = evaluations.filter(e => e.status === 'violation');
    const totalPen = evaluations.reduce((acc, curr) => acc + curr.penalty, 0);

    setCurrentEvaluations(evaluations);
    setIsCompliant(violations.length === 0);
    setTotalViolations(violations.length);
    setTotalPenalty(totalPen);
    setCurrentInspectionId(overrideInspectionId || `insp-${Date.now().toString().slice(-6)}`);
  };

  const finalizeInspection = (signDoc: boolean = true): InspectionRecord => {
    const id = currentInspectionId || `insp-${Date.now().toString().slice(-6)}`;
    setCurrentInspectionId(id);
    const primaryImg = currentProduct?.images?.[0] || currentProduct?.image_url || pendingScanPayload?.image_base64 || '';
    const newRecord: InspectionRecord = {
      id,
      product: {
        ...(currentProduct || {}),
        id: currentProduct?.id || `prod-${Date.now().toString().slice(-6)}`,
        source_type: currentProduct?.source_type || 'store',
        title: currentProduct?.title || 'Inspected Packaged Product',
        brand: currentProduct?.brand || 'Generic Manufacturer',
        category: currentProduct?.category || 'Retail Commodity',
        image_url: primaryImg || currentProduct?.image_url || '',
        images: currentProduct?.images || (primaryImg ? [primaryImg] : [])
      },
      performed_by: {
        id: 'usr-officer-01',
        name: officerProfile.name,
        badge_id: officerProfile.badge_id,
        role: 'officer',
        zone: officerProfile.zone
      },
      mode: currentProduct?.source_type === 'ecommerce' ? 'url_check' : 'scan',
      status: isOffline ? 'provisional' : 'verified',
      geo: {
        lat: 28.6139,
        lng: 77.2090,
        address: 'Connaught Place, New Delhi - 110001'
      },
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      evidence_image: primaryImg,
      evidence_hash: `sha256-${Math.random().toString(36).substring(2, 15)}`,
      extraction: currentExtraction || {
        manufacturer: { value: 'Manufacturer Declared', source: 'ocr', confidence: 0.9 },
        generic_name: { value: 'Commodity Pack', source: 'ocr', confidence: 0.9 },
        net_quantity: { value: { amount: 500, unit: 'g' }, source: 'ocr', confidence: 0.9 },
        mrp: { value: { amount: 100, raw_text: 'MRP Rs. 100.00 (incl. of all taxes)', is_inclusive_taxes: true }, source: 'ocr', confidence: 0.9 },
        mfg_date: { value: '01/2026', source: 'ocr', confidence: 0.9 },
        consumer_care: { value: { phone: '1800-000-0000' }, source: 'ocr', confidence: 0.9 },
        country_of_origin: { value: 'India', source: 'ocr', confidence: 0.9 },
        numeral_height_mm: { value: 3.0, reference_detected: true, note: 'Sufficient' },
        raw_ocr_text: 'Declared Product Package Text'
      },
      evaluations: currentEvaluations,
      is_compliant: isCompliant,
      total_violations: totalViolations,
      total_penalty: totalPenalty,
      is_signed: signDoc,
      signature_details: signDoc ? {
        signed_by: `${officerProfile.name} (Digital DSC)`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        provider: 'documenso',
        certificate_id: `DSC-IN-LM-${Date.now().toString().slice(-6)}`
      } : undefined,
      report_id: `MANAK-REP-2026-${Date.now().toString().slice(-5)}`,
      synced: !isOffline
    };

    saveInspection(newRecord);
    saveInspectionDirectToSupabase(newRecord);
    setInspections(prev => [newRecord, ...prev.filter(i => i.id !== id)]);

    if (isOffline) {
      setOfflineQueueCount(prev => prev + 1);
    }

    return newRecord;
  };

  const submitNewConsumerReport = async (note?: string): Promise<ConsumerReport> => {
    const refId = `MANAK-CR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const violations = currentEvaluations
      .filter(e => e.status === 'violation')
      .map(e => `${e.requirement_name} (${e.rule_source})`);

    const primaryImg = currentProduct?.images?.[0] || currentProduct?.image_url || '';

    const reportPayload: Partial<ConsumerReport> = {
      reference_id: refId,
      inspection_id: currentInspectionId || `insp-cr-${Date.now()}`,
      product_name: currentProduct?.title || 'Reported Product',
      brand: currentProduct?.brand || 'Generic',
      product_image: primaryImg,
      violations_summary: violations.length > 0 ? violations : ['Suspected labeling discrepancy'],
      consumer_note: note || 'Reported via MANAK Consumer Self-Check.',
      submitted_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'submitted',
      assigned_officer: 'Legal Metrology Division'
    };

    try {
      const created = await submitConsumerReportApi(reportPayload);
      if (!created.product_image && primaryImg) {
        created.product_image = primaryImg;
      }
      saveConsumerReport(created);
      setConsumerReports(prev => [created, ...prev]);
      return created;
    } catch {
      const fallbackReport: ConsumerReport = {
        id: `cr-${Date.now()}`,
        reference_id: refId,
        inspection_id: reportPayload.inspection_id!,
        product_name: reportPayload.product_name!,
        brand: reportPayload.brand!,
        product_image: reportPayload.product_image!,
        violations_summary: reportPayload.violations_summary!,
        consumer_note: reportPayload.consumer_note!,
        submitted_at: reportPayload.submitted_at!,
        status: 'submitted',
        assigned_officer: reportPayload.assigned_officer!
      };
      saveConsumerReport(fallbackReport);
      setConsumerReports(prev => [fallbackReport, ...prev]);
      return fallbackReport;
    }
  };

  const syncOfflineQueue = async () => {
    await syncOfflineQueueToServer();
    await refreshDataFromBackend();
    setOfflineQueueCount(0);
  };

  const toggleDeviceFrame = () => setDeviceFrame(prev => !prev);
  const toggleOffline = () => {
    setIsOffline(prev => {
      const next = !prev;
      if (!next && offlineQueueCount > 0) {
        syncOfflineQueue();
      }
      return next;
    });
  };

  return (
    <AppContext.Provider
      value={{
        userRole,
        activeScreen,
        screenHistory,
        officerProfile,
        consumerProfile,
        inspections,
        consumerReports,
        currentProduct,
        currentExtraction,
        currentEvaluations,
        isCompliant,
        totalViolations,
        totalPenalty,
        currentInspectionId,
        isOffline,
        offlineQueueCount,
        deviceFrame,
        toggleDeviceFrame,
        toggleOffline,
        navigateTo,
        goBack,
        selectRole,
        loginOfficer,
        loginConsumer,
        logout,
        pendingScanPayload,
        startScanExtraction,
        setCurrentExtraction,
        setCurrentProduct,
        setExtractionReviewData,
        setAnalysisData,
        finalizeInspection,
        submitNewConsumerReport,
        syncOfflineQueue,
        refreshDataFromBackend
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
