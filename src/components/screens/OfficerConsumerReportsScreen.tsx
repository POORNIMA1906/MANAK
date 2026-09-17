import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { BottomNav } from '../common/BottomNav';
import { ConsumerReport } from '../../types';
import {
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  UserCheck, X, Inbox, Lock
} from 'lucide-react';
import { MOCK_CONSUMER_REPORTS } from '../../data/mockData';
import { decryptData } from '../../services/cryptoService';
import { getConsumerReportImage, DEFAULT_COMMODITY_IMAGE } from '../../utils/imageUtils';

const STATUS_META: Record<ConsumerReport['status'], { label: string; bg: string; text: string }> = {
  submitted:        { label: 'New',          bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-700'    },
  officer_assigned: { label: 'Assigned',     bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700'   },
  under_review:     { label: 'Under Review', bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700'   },
  action_taken:     { label: 'Action Taken', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  dismissed:        { label: 'Dismissed',    bg: 'bg-slate-100 border-slate-200',    text: 'text-slate-500'   },
};

const ConsumerStatementText: React.FC<{ note: string }> = ({ note }) => {
  const [text, setText] = useState(note);
  useEffect(() => {
    decryptData(note).then(setText);
  }, [note]);
  return <p className="leading-relaxed italic text-slate-800">"{text}"</p>;
};

export const OfficerConsumerReportsScreen: React.FC = () => {
  const { consumerReports, inspections } = useApp();

  // Merge live reports with seeded mock data (deduplicated by id)
  const allReports = [
    ...consumerReports,
    ...MOCK_CONSUMER_REPORTS.filter(m => !consumerReports.find(r => r.id === m.id)),
  ];

  const [expandedId, setExpandedId] = useState<string | null>(allReports[0]?.id ?? null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [actioned, setActioned] = useState<Record<string, ConsumerReport['status']>>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'done'>('all');

  const pending = allReports.filter(r => {
    const s = actioned[r.id] ?? r.status;
    return s !== 'action_taken' && s !== 'dismissed';
  });
  const done = allReports.filter(r => {
    const s = actioned[r.id] ?? r.status;
    return s === 'action_taken' || s === 'dismissed';
  });

  const filtered =
    activeFilter === 'pending' ? pending :
    activeFilter === 'done'    ? done    :
    allReports;

  const getStatus = (r: ConsumerReport): ConsumerReport['status'] =>
    actioned[r.id] ?? r.status;

  return (
    <div className="w-full h-full bg-[#F5F6F8] flex flex-col justify-between overflow-hidden">
      <Header title="Citizen Grievance Queue" showBack showLogo />

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3 hide-scrollbar">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total',    count: allReports.length, cls: 'bg-white border-slate-200 text-manak-navy' },
            { label: 'Pending',  count: pending.length,    cls: 'bg-amber-50 border-amber-200 text-amber-700' },
            { label: 'Actioned', count: done.length,       cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-2.5 border shadow-subtle text-center ${s.cls}`}>
              <span className="text-lg font-extrabold mono">{s.count}</span>
              <p className="text-[10px] font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Pills */}
        <div className="flex space-x-2">
          {(['all', 'pending', 'done'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 rounded-full text-[10.5px] font-bold capitalize transition-colors ${
                activeFilter === f
                  ? 'bg-manak-navy text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {f === 'all'     ? `All (${allReports.length})`  :
               f === 'pending' ? `Pending (${pending.length})` :
                                 `Actioned (${done.length})`}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">No reports here</p>
            <p className="text-xs text-slate-400 max-w-[220px]">
              Consumer complaints routed to your zone will appear here.
            </p>
          </div>
        )}

        {/* Report Cards */}
        <div className="space-y-2.5">
          {filtered.map(report => {
            const status = getStatus(report);
            const meta = STATUS_META[status];
            const isExpanded = expandedId === report.id;
            const isActioned = status === 'action_taken' || status === 'dismissed';

            return (
              <div
                key={report.id}
                className={`bg-white rounded-2xl border shadow-subtle transition-all ${
                  status === 'submitted' ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                }`}
              >
                {/* Card Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  className="p-3.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2.5">
                      <img
                        src={getConsumerReportImage(report, inspections)}
                        alt={report.product_name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_COMMODITY_IMAGE;
                        }}
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                      />
                      <div>
                        <div className="flex items-center space-x-1.5 mb-0.5">
                          <span className="text-[10px] mono font-bold text-emerald-800">{report.reference_id}</span>
                          {status === 'submitted' && (
                            <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-full uppercase">
                              NEW
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{report.product_name}</h4>
                        <p className="text-[10px] text-slate-500">{report.brand}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold ${meta.bg} ${meta.text}`}>
                        {status === 'action_taken'
                          ? <CheckCircle2 className="w-3 h-3" />
                          : <Clock className="w-3 h-3" />}
                        <span>{meta.label}</span>
                      </span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="mono">{report.submitted_at}</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <AlertTriangle className="w-3 h-3 text-manak-orange" />
                      {report.violations_summary.length} issue{report.violations_summary.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Expanded Panel */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-3 border-t border-slate-100 space-y-3 bg-slate-50/60 rounded-b-2xl">

                    {/* Violations */}
                    <div>
                      <span className="text-[10px] font-bold uppercase mono text-slate-500 block mb-1.5">
                        Reported Issues:
                      </span>
                      <div className="space-y-1">
                        {report.violations_summary.map((v, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-red-900 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            {v}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Consumer note (E2EE Encrypted) */}
                    {report.consumer_note && (
                      <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px] text-slate-700 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-manak-navy uppercase mono flex items-center gap-1">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            Consumer Statement (E2EE Verified):
                          </span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                            Encrypted
                          </span>
                        </div>
                        <ConsumerStatementText note={report.consumer_note} />
                      </div>
                    )}

                    {/* Existing remark */}
                    {report.officer_remark && !actioned[report.id] && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800">
                        <span className="text-[10px] font-bold uppercase mono block mb-0.5">Prior Action:</span>
                        <p>{report.officer_remark}</p>
                      </div>
                    )}

                    {/* Action Zone */}
                    {!isActioned ? (
                      <div className="space-y-2 pt-1">
                        <label className="text-[10.5px] font-bold text-slate-700 uppercase mono block">
                          Officer Notes & Field Action:
                        </label>
                        <textarea
                          rows={3}
                          value={remarks[report.id] ?? ''}
                          onChange={e => setRemarks(prev => ({ ...prev, [report.id]: e.target.value }))}
                          placeholder="e.g. Physical inspection conducted. Compounding notice served under Rule 32..."
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-manak-navy resize-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleAction(report.id, 'action_taken')}
                            className="py-2.5 rounded-xl bg-manak-navy hover:bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-manak-orange" />
                            <span>Mark Actioned</span>
                          </button>
                          <button
                            onClick={() => handleAction(report.id, 'dismissed')}
                            className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Dismiss</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-2 ${
                        status === 'action_taken'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                        {status === 'action_taken'
                          ? <><CheckCircle2 className="w-4 h-4" /> Action recorded — citizen will be notified.</>
                          : <><X className="w-4 h-4" /> Report dismissed.</>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  );

  function handleAction(id: string, s: ConsumerReport['status']) {
    setActioned(prev => ({ ...prev, [id]: s }));
  }
};
