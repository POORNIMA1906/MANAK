import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useApp } from './context/AppContext';
import { DeviceFrame } from './components/common/DeviceFrame';

// Shared Screens
import { SplashScreen } from './components/screens/SplashScreen';
import { RoleSelectionScreen } from './components/screens/RoleSelectionScreen';
import { OcrExtractionScreen } from './components/screens/OcrExtractionScreen';
import { ExtractedTextReviewScreen } from './components/screens/ExtractedTextReviewScreen';

// Officer Screens
import { OfficerLoginScreen } from './components/screens/OfficerLoginScreen';
import { OfficerDashboardScreen } from './components/screens/OfficerDashboardScreen';
import { CameraScanScreen } from './components/screens/CameraScanScreen';
import { CheckUrlScreen } from './components/screens/CheckUrlScreen';
import { ExtractionProcessingScreen } from './components/screens/ExtractionProcessingScreen';
import { AnalysisResultsScreen } from './components/screens/AnalysisResultsScreen';
import { InspectionReportScreen } from './components/screens/InspectionReportScreen';
import { InspectionHistoryScreen } from './components/screens/InspectionHistoryScreen';
import { ComplianceChatScreen } from './components/screens/ComplianceChatScreen';
import { OfflineComplianceChatScreen } from './components/screens/OfflineComplianceChatScreen';
import { OfficerConsumerReportsScreen } from './components/screens/OfficerConsumerReportsScreen';
import { OfficerProfileScreen } from './components/screens/OfficerProfileScreen';

// Consumer Screens
import { ConsumerLoginScreen } from './components/screens/ConsumerLoginScreen';
import { ConsumerDashboardScreen } from './components/screens/ConsumerDashboardScreen';
import { ConsumerCheckProductScreen } from './components/screens/ConsumerCheckProductScreen';
import { ConsumerReportViolationScreen } from './components/screens/ConsumerReportViolationScreen';
import { ConsumerReportConfirmationScreen } from './components/screens/ConsumerReportConfirmationScreen';
import { ConsumerMyReportsScreen } from './components/screens/ConsumerMyReportsScreen';

export const App: React.FC = () => {
  const { activeScreen } = useApp();
  const [isReallyOffline, setIsReallyOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsReallyOffline(true);
    const goOnline  = () => setIsReallyOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
    };
  }, []);

  const renderActiveScreen = () => {
    switch (activeScreen) {
      // Shared
      case 'splash':
        return <SplashScreen />;
      case 'role_select':
        return <RoleSelectionScreen />;
      case 'ocr_extracting':
        return <OcrExtractionScreen />;
      case 'review_extraction':
        return <ExtractedTextReviewScreen />;

      // Officer Flow
      case 'officer_login':
        return <OfficerLoginScreen />;
      case 'officer_dashboard':
        return <OfficerDashboardScreen />;
      case 'scan_camera':
        return <CameraScanScreen />;
      case 'check_url':
        return <CheckUrlScreen />;
      case 'ocr_processing':
        return <ExtractionProcessingScreen />;
      case 'analysis_results':
        return <AnalysisResultsScreen />;
      case 'inspection_report':
        return <InspectionReportScreen />;
      case 'inspection_history':
        return <InspectionHistoryScreen />;
      case 'compliance_chat':
        return <ComplianceChatScreen />;
      case 'manak_ai_offline':
        return <OfflineComplianceChatScreen />;
      case 'officer_consumer_reports':
        return <OfficerConsumerReportsScreen />;
      case 'officer_profile':
        return <OfficerProfileScreen />;

      // Consumer Flow
      case 'consumer_login':
        return <ConsumerLoginScreen />;
      case 'consumer_dashboard':
        return <ConsumerDashboardScreen />;
      case 'consumer_check':
        return <ConsumerCheckProductScreen />;
      case 'consumer_report':
        return <ConsumerReportViolationScreen />;
      case 'consumer_confirm':
        return <ConsumerReportConfirmationScreen />;
      case 'consumer_my_reports':
        return <ConsumerMyReportsScreen />;

      default:
        return <SplashScreen />;
    }
  };

  return (
    <DeviceFrame>
      {/* Offline Banner — overlays current screen when device has no internet */}
      {isReallyOffline && (
        <div className="absolute top-0 inset-x-0 z-[100] bg-amber-500 text-white text-[11px] font-bold px-3 pt-[calc(max(8px,env(safe-area-inset-top,0px))+4px)] pb-2 flex items-center justify-center gap-2 shadow-lg animate-pulse">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>No Internet Connection — Working in Offline Mode</span>
        </div>
      )}
      {renderActiveScreen()}
    </DeviceFrame>
  );
};
