import React from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { BottomNav } from '../common/BottomNav';
import { FileCheck, Clock, CheckCircle2, AlertTriangle, ShieldCheck, ChevronRight, Inbox, Camera } from 'lucide-react';
import { getConsumerReportImage, DEFAULT_COMMODITY_IMAGE } from '../../utils/imageUtils';

export const ConsumerMyReportsScreen: React.FC = () => {
  const { consumerReports, inspections, navigateTo } = useApp();

  return (
    <div className="w-full h-full bg-[#F5F6F8] flex flex-col justify-between overflow-hidden">
      <Header title="My Reported Grievances" showBack showLogo />

      {/* Main List */}
      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3 hide-scrollbar">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 tracking-tight">Active Citizen Reports</h2>
          <span className="text-[10px] text-slate-400 mono">{consumerReports.length} Registered</span>
        </div>

        {/* Empty State */}
        {consumerReports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 space-y-3 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">No reports filed yet</p>
              <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
                Scan a product or paste an online link to check its packaging. If you find a violation, you can report it here.
              </p>
            </div>
            <button
              onClick={() => navigateTo('consumer_check')}
              className="mt-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center space-x-2 transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Check a Product</span>
            </button>
          </div>
        )}

        <div className="space-y-3">
          {consumerReports.map(report => (
            <div
              key={report.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-subtle space-y-3"
            >
              {/* Header: ID + Status */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-extrabold text-emerald-800 mono">
                  {report.reference_id}
                </span>

                {report.status === 'action_taken' ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Action Taken</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[9.5px] font-bold">
                    <Clock className="w-3 h-3" />
                    <span>Under Review</span>
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="flex items-start space-x-3">
                <img
                  src={getConsumerReportImage(report, inspections)}
                  alt={report.product_name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_COMMODITY_IMAGE;
                  }}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">{report.product_name}</h3>
                  <p className="text-[10.5px] text-slate-500">{report.brand}</p>
                  <p className="text-[9.5px] text-slate-400 mono mt-0.5">Submitted on: {report.submitted_at}</p>
                </div>
              </div>

              {/* Violations Reported */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                <span className="text-[10px] font-bold uppercase mono text-slate-500 block">Reported Issues:</span>
                {report.violations_summary.map((v, i) => (
                  <div key={i} className="text-[11px] flex items-center gap-1.5 text-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>

              {/* Officer Remarks */}
              {report.officer_remark && (
                <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-100 text-xs text-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase mono text-manak-navy block">
                    Enforcement Official Action:
                  </span>
                  <p className="text-[11px] text-slate-700 leading-relaxed">{report.officer_remark}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};
