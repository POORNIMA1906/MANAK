import React from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { BottomNav } from '../common/BottomNav';
import { Camera, Globe, AlertTriangle, CheckCircle2, ChevronRight, TrendingUp, FileText, Inbox, Bot, Sparkles, Cpu, WifiOff } from 'lucide-react';
import { getRecordImage, DEFAULT_COMMODITY_IMAGE } from '../../utils/imageUtils';

export const OfficerDashboardScreen: React.FC = () => {
  const { navigateTo, inspections, setAnalysisData, consumerReports } = useApp();
  const pendingGrievances = consumerReports.filter(r => r.status !== 'action_taken' && r.status !== 'dismissed').length;

  const totalInspections = inspections.length;
  const violationsFound = inspections.filter(i => !i.is_compliant).length;
  const pendingReports = inspections.filter(i => !i.is_signed).length;

  return (
    <div className="w-full h-full bg-[#F5F6F8] font-poppins flex flex-col justify-between overflow-hidden">
      <Header showOfficerBadge showLogo />

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-3.5 sm:px-4 pt-3 pb-8 space-y-3.5 hide-scrollbar">
        {/* Section: Summary Stat Cards */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mono">
              Field Inspection Overview
            </h2>
            <span className="text-[10px] text-slate-400 mono">Updated Live</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Stat 1 */}
            <div className="bg-gradient-to-br from-blue-50/90 via-white to-blue-50/50 rounded-xl p-2.5 border border-blue-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-600 leading-tight">
                  Total<br />Inspections
                </span>
                <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <TrendingUp className="w-3 h-3" />
                </div>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-black text-blue-950 mono">{totalInspections}</span>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-gradient-to-br from-red-50/90 via-white to-red-50/50 rounded-xl p-2.5 border border-red-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-600 leading-tight">
                  Violations<br />Flagged
                </span>
                <div className="w-5 h-5 rounded-md bg-red-600 text-white flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-3 h-3" />
                </div>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-black text-red-600 mono">{violationsFound}</span>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 rounded-xl p-2.5 border border-amber-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-600 leading-tight">
                  Unsigned<br />Reports
                </span>
                <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-3 h-3" />
                </div>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-black text-amber-700 mono">{pendingReports}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Side-by-Side Quick Actions (Same Color, Icon + Short Name, No Descriptions) */}
        <section className="grid grid-cols-2 gap-2.5">
          {/* Action 1: Scan Product */}
          <button
            onClick={() => navigateTo('scan_camera')}
            className="group relative overflow-hidden rounded-2xl p-3.5 bg-gradient-to-br from-[#0A3663] via-[#0E4984] to-[#082E55] text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex flex-col justify-between border border-blue-400/20 text-left min-h-[96px]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <Camera className="w-5 h-5 text-amber-300" />
              </div>
              <span className="text-[9.5px] font-bold bg-white/15 text-blue-100 px-2 py-0.5 rounded-full border border-white/20">
                Camera
              </span>
            </div>
            <div className="flex items-center justify-between w-full mt-2.5">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white">
                Scan Product
              </span>
              <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Action 2: Check URL */}
          <button
            onClick={() => navigateTo('check_url')}
            className="group relative overflow-hidden rounded-2xl p-3.5 bg-gradient-to-br from-[#0A3663] via-[#0E4984] to-[#082E55] text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex flex-col justify-between border border-blue-400/20 text-left min-h-[96px]"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <Globe className="w-5 h-5 text-sky-300" />
              </div>
              <span className="text-[9.5px] font-bold bg-white/15 text-blue-100 px-2 py-0.5 rounded-full border border-white/20">
                Online
              </span>
            </div>
            <div className="flex items-center justify-between w-full mt-2.5">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white">
                Check URL
              </span>
              <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </section>

        {/* Section: Citizen Grievance & MANAK Assistant (Clean, Professional, No Heavy Text) */}
        <section className="space-y-2.5">
          {/* Feature 3: Citizen Grievance */}
          <div
            onClick={() => navigateTo('officer_consumer_reports')}
            className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-sm hover:border-amber-300 hover:shadow-md cursor-pointer active:scale-[0.99] transition-all group flex items-center justify-between"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Inbox className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Citizen Grievance
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              {pendingGrievances > 0 ? (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {pendingGrievances} Active
                </span>
              ) : (
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                  All Clear
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Feature 4: MANAK Assistant */}
          <div
            onClick={() => navigateTo('compliance_chat')}
            className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-sm hover:border-purple-300 hover:shadow-md cursor-pointer active:scale-[0.99] transition-all group flex items-center justify-between"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  MANAK Assistant
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>AI Chatbot</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Feature 5: MANAK AI OFFLINE (100% On-Device Neural Retrieval) */}
          <div
            onClick={() => navigateTo('manak_ai_offline')}
            className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-sm hover:border-teal-300 hover:shadow-md cursor-pointer active:scale-[0.99] transition-all group flex items-center justify-between"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 via-emerald-600 to-cyan-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  MANAK AI OFFLINE
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-[10px] font-bold bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded-full border border-teal-200 flex items-center space-x-1">
                <WifiOff className="w-3.5 h-3.5 text-teal-600" />
                <span>100% Offline</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </section>

        {/* Section: Recent Field Inspections */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">Recent Inspections</h3>
            <button
              onClick={() => navigateTo('inspection_history')}
              className="text-[11px] font-semibold text-manak-navy hover:underline"
            >
              View All ({inspections.length})
            </button>
          </div>

          {inspections.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-slate-200 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">No inspections recorded yet.</p>
              <p className="text-[11px] text-slate-400">Use "Scan Product" or "Check URL" above to start an audit.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inspections.slice(0, 5).map(record => (
                <div
                  key={record.id}
                  onClick={() => {
                    setAnalysisData(record.product, record.extraction, record.evaluations, record.id);
                    navigateTo('inspection_report');
                  }}
                  className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-subtle hover:border-blue-300 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={getRecordImage(record)}
                        alt={record.product.title}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_COMMODITY_IMAGE;
                        }}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate max-w-[170px]">
                          {record.product.title}
                        </h4>
                        <p className="text-[10px] text-slate-500">{record.product.brand} • {record.timestamp.split(' ')[0]}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      {record.is_compliant ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Compliant</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[9.5px] font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{record.total_violations} Violations</span>
                        </span>
                      )}
                      <span className="block text-[9.5px] text-slate-400 mono mt-0.5">
                        {record.status === 'verified' ? 'Signed' : 'Provisional'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};
