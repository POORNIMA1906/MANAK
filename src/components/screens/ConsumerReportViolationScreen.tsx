import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { AlertTriangle, CheckCircle2, Send, Upload, Camera, ShieldCheck, MapPin, Globe } from 'lucide-react';
import { getCurrentGeoLocation, GeoLocationResult } from '../../services/locationService';
import { FloatingProductChatbot } from '../common/FloatingProductChatbot';

export const ConsumerReportViolationScreen: React.FC = () => {
  const { navigateTo, currentProduct, currentExtraction, currentEvaluations, isCompliant, submitNewConsumerReport } = useApp();
  const isEcom = currentProduct?.source_type === 'ecommerce';
  const [note, setNote] = useState(
    isEcom
      ? 'E-commerce platform listing omitted mandatory declarations under Rule 6(10) of Packaged Commodities Rules 2011.'
      : 'Store was selling this pack above printed MRP with no tax disclaimer.'
  );
  const [geoLoc, setGeoLoc] = useState<GeoLocationResult | null>(null);

  useEffect(() => {
    getCurrentGeoLocation().then(res => setGeoLoc(res));
  }, []);

  const violations = currentEvaluations.filter(e => e.status === 'violation');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitNewConsumerReport(note);
    navigateTo('consumer_confirm');
  };

  return (
    <div className="w-full h-full bg-[#F5F6F8] flex flex-col justify-between overflow-y-auto hide-scrollbar">
      <Header title={isEcom ? "Report E-Commerce Listing" : "Report Label Discrepancy"} showBack showLogo />

      <main className="p-4 space-y-4 my-auto">
        {/* Verification Status Card */}
        <div
          className={`rounded-2xl p-4 border shadow-subtle ${
            isCompliant
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-950'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isCompliant ? 'bg-emerald-600 text-white' : 'bg-manak-red text-white'
              }`}
            >
              {isCompliant ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-sm font-bold">
                {isCompliant ? (isEcom ? 'Listing Appears Compliant' : 'Packaging Appears Compliant') : `${violations.length} Suspected Discrepancies`}
              </h2>
              <p className="text-[11px] text-slate-600">
                {isCompliant
                  ? (isEcom ? 'All mandatory Rule 6(10) declarations were found on listing.' : 'All mandatory 2011 declarations were found on the label.')
                  : (isEcom ? 'The e-commerce listing violates statutory Rule 6(10) requirements.' : 'The package violates statutory labeling requirements.')}
              </p>
            </div>
          </div>
        </div>

        {/* Detected Violations List */}
        {!isCompliant && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-subtle space-y-2.5">
            <span className="text-[11px] font-bold text-slate-800 uppercase mono block">
              Auto-Detected Labeling Issues:
            </span>

            <div className="space-y-1.5">
              {violations.map((v, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-red-50/70 border border-red-200 text-xs text-red-950 space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                    <span>{v.requirement_name}</span>
                  </div>
                  <p className="text-[10.5px] text-red-800/90 pl-3">{v.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complaint Formulation Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-subtle space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Add Note / Discrepancy Details (Optional)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder={isEcom ? "e.g. Seller did not mention country of origin or MRP tax disclaimer on listing..." : "e.g. Shopkeeper charged ₹10 above printed MRP in Khan Market store..."}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
            ></textarea>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            {isEcom ? (
              <>
                <span className="text-slate-600 text-[11px] flex items-center gap-1 font-medium truncate pr-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                  <span className="truncate">URL Listing: {currentProduct?.ecommerce_platform ? currentProduct.ecommerce_platform.toUpperCase() : (currentProduct?.ecommerce_url || 'Online E-Commerce Platform')}</span>
                </span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                  Online Listing
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-600 text-[11px] flex items-center gap-1 font-medium truncate pr-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                  <span>Geo-Tagging: {geoLoc?.address || 'GPS Coordinates Acquired'}</span>
                </span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                  GPS Verified
                </span>
              </>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Submit Report to Legal Metrology Officer</span>
          </button>
        </form>
      </main>

      <footer className="p-3 pb-[max(16px,env(safe-area-inset-bottom,0px))] text-center">
        <p className="text-[10px] text-slate-400 mono">
          Your report will be automatically routed to Zone 4 Delhi Enforcement Queue
        </p>
      </footer>

      {/* Floating Legal Metrology AI Chatbot */}
      <FloatingProductChatbot
        product={currentProduct}
        extraction={currentExtraction}
        evaluations={currentEvaluations}
        isCompliant={isCompliant}
        bottomOffset="bottom-24"
      />
    </div>
  );
};
