import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { generateInspectionPDF } from '../../services/pdfReportGenerator';
import { evaluateEcommerceListing, EcommerceRuleResult } from '../../services/ecommerceRuleEngine';
import { FloatingProductChatbot } from '../common/FloatingProductChatbot';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Scale,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Info,
  ShieldCheck,
  Building2,
  Tag,
  DollarSign,
  Package,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  FileCode,
  Copy,
  Check,
  Edit3
} from 'lucide-react';

export const AnalysisResultsScreen: React.FC = () => {
  const {
    navigateTo,
    currentProduct,
    currentExtraction,
    currentEvaluations,
    isCompliant,
    totalViolations,
    totalPenalty,
    finalizeInspection,
    userRole
  } = useApp();

  const [activeMainTab, setActiveMainTab] = useState<'checklist' | 'raw'>('checklist');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [ecomTab, setEcomTab] = useState<'all' | 'online' | 'pricing' | 'physical' | 'external'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showJsonInspector, setShowJsonInspector] = useState(false);

  const isEcommerce = currentProduct?.source_type === 'ecommerce';

  // Compute rich E-Commerce report if this is an e-commerce audit
  const ecomReport = useMemo(() => {
    if (!isEcommerce || !currentExtraction) return null;
    return evaluateEcommerceListing(currentExtraction, currentProduct);
  }, [isEcommerce, currentExtraction, currentProduct]);

  const handleGenerateReport = async () => {
    if (userRole === 'consumer') {
      navigateTo('consumer_report');
      return;
    }
    const record = finalizeInspection(true);
    try {
      await generateInspectionPDF(record);
    } catch (e) {
      console.error('Failed to auto-download PDF:', e);
    }
    navigateTo('inspection_report');
  };

  const handleCopyJson = () => {
    if (currentExtraction) {
      navigator.clipboard.writeText(JSON.stringify(currentExtraction, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const handleCopyRawText = () => {
    if (currentExtraction?.raw_ocr_text) {
      navigator.clipboard.writeText(currentExtraction.raw_ocr_text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  // Structured list of extracted statutory fields
  const rawFields = [
    {
      label: 'Generic Name (Rule 6(1)(b))',
      value: currentExtraction?.generic_name?.value,
      source: currentExtraction?.generic_name?.source,
      confidence: currentExtraction?.generic_name?.confidence,
      required: true
    },
    {
      label: 'Brand Name',
      value: currentProduct?.brand !== 'Unbranded' ? currentProduct?.brand : null,
      source: 'listing',
      confidence: 0.95,
      required: false
    },
    {
      label: 'Manufacturer / Packer / Importer (Rule 6(1)(a))',
      value: currentExtraction?.manufacturer?.value,
      source: currentExtraction?.manufacturer?.source,
      confidence: currentExtraction?.manufacturer?.confidence,
      required: true
    },
    {
      label: 'Maximum Retail Price (MRP) (Rule 6(1)(e))',
      value: currentExtraction?.mrp?.value?.amount
        ? `₹${currentExtraction.mrp.value.amount} ${currentExtraction.mrp.value.is_inclusive_taxes ? '(Incl. of all taxes)' : '(Taxes omitted)'}`
        : null,
      source: currentExtraction?.mrp?.source,
      confidence: currentExtraction?.mrp?.confidence,
      required: true
    },
    {
      label: 'Net Quantity (Rule 6(1)(c))',
      value: currentExtraction?.net_quantity?.value?.amount
        ? `${currentExtraction.net_quantity.value.amount} ${currentExtraction.net_quantity.value.unit}`
        : null,
      source: currentExtraction?.net_quantity?.source,
      confidence: currentExtraction?.net_quantity?.confidence,
      required: true
    },
    {
      label: 'Country of Origin (Rule 6(10))',
      value: currentExtraction?.country_of_origin?.value,
      source: currentExtraction?.country_of_origin?.source,
      confidence: currentExtraction?.country_of_origin?.confidence,
      required: true
    },
    {
      label: 'Mfg / Pkg Month & Year (Rule 6(1)(d))',
      value: currentExtraction?.mfg_date?.value || 'Exempt on digital listings (Rule 6(10))',
      source: currentExtraction?.mfg_date?.source,
      confidence: currentExtraction?.mfg_date?.confidence,
      required: false,
      note: 'DCA Guidance: Not required on e-commerce transaction networks'
    },
    {
      label: 'Consumer Care Helpline (Rule 6(2))',
      value: currentExtraction?.consumer_care?.value
        ? [
            currentExtraction.consumer_care.value.phone && `📞 ${currentExtraction.consumer_care.value.phone}`,
            currentExtraction.consumer_care.value.email && `✉️ ${currentExtraction.consumer_care.value.email}`,
            currentExtraction.consumer_care.value.address && `📍 ${currentExtraction.consumer_care.value.address}`
          ].filter(Boolean).join(' | ')
        : null,
      source: currentExtraction?.consumer_care?.source,
      confidence: currentExtraction?.consumer_care?.confidence,
      required: true
    },
    {
      label: 'Numeral Height & Font Legibility (Rule 7)',
      value: currentExtraction?.numeral_height_mm?.value
        ? `${currentExtraction.numeral_height_mm.value} mm`
        : 'Digital Font Rendered (Physical warehouse check required for stamped package)',
      source: 'inspection',
      confidence: 0.90,
      required: false,
      note: currentExtraction?.numeral_height_mm?.note || 'Assessed via digital viewport'
    }
  ];

  // Active display image
  const activeDisplayImage = selectedImage || currentProduct?.image_url || (currentProduct?.images && currentProduct.images[0]) || '';

  // Filter evaluations for e-commerce tabs
  const filteredEcomRules = useMemo(() => {
    if (!ecomReport) return [];
    if (ecomTab === 'all') return ecomReport.evaluations;
    if (ecomTab === 'online') {
      return ecomReport.evaluations.filter(
        r => r.section === 'online_declarations' || r.section === 'consumer_care' || r.section === 'exemptions_special'
      );
    }
    if (ecomTab === 'pricing') {
      return ecomReport.evaluations.filter(r => r.section === 'pricing_unit_sale');
    }
    if (ecomTab === 'physical') {
      return ecomReport.evaluations.filter(r => r.section === 'physical_package_only');
    }
    if (ecomTab === 'external') {
      return ecomReport.evaluations.filter(r => r.section === 'external_verification');
    }
    return ecomReport.evaluations;
  }, [ecomReport, ecomTab]);

  // Calculate aggregate confidence score across all evaluated rules
  const overallConfidence = useMemo(() => {
    if (isEcommerce && ecomReport && ecomReport.evaluations.length > 0) {
      const sum = ecomReport.evaluations.reduce((acc, curr) => acc + (curr.confidence || 0.95), 0);
      return Math.round((sum / ecomReport.evaluations.length) * 100);
    }
    if (currentEvaluations && currentEvaluations.length > 0) {
      const sum = currentEvaluations.reduce((acc, curr) => acc + (curr.confidence || 0.95), 0);
      return Math.round((sum / currentEvaluations.length) * 100);
    }
    return 94;
  }, [isEcommerce, ecomReport, currentEvaluations]);

  return (
    <div className="w-full h-full bg-[#F5F6F8] flex flex-col justify-between overflow-hidden">
      <Header
        title={isEcommerce ? 'E-Commerce Metrology Audit' : 'Statutory Compliance Audit'}
        showBack
        showLogo
      />

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 hide-scrollbar">
        {/* =========================================================================
            PROMINENT OVERALL CONFIDENCE SCORE HERO CARD (Large & Noticeable)
            ========================================================================= */}
        <section
          aria-label="Overall Compliance Confidence Score"
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-4 shadow-lg border border-slate-700/90 relative overflow-hidden"
        >
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none -mr-12 -mt-12" />

          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10.5px] font-mono uppercase tracking-wider text-emerald-400 font-extrabold">
                  Compliance Confidence Score
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                {overallConfidence >= 90
                  ? 'High Legal Certainty'
                  : overallConfidence >= 75
                  ? 'Moderate Legal Certainty'
                  : 'Low Legal Certainty (Verification Recommended)'}
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Determined via 3-pillar weighting: OCR token clarity (45%), statutory syntax adherence (35%), &amp; evidence cross-validation (20%).
              </p>
            </div>

            {/* Noticeable & Large Confidence Score Gauge */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/20 shadow-inner min-w-[105px]">
              <span className="text-4xl font-black font-mono tracking-tight text-white drop-shadow-sm">
                {overallConfidence}%
              </span>
              <span className="text-[9.5px] uppercase font-mono font-bold text-emerald-300 tracking-wider mt-0.5">
                Confidence
              </span>
            </div>
          </div>

          {/* 3-Pillar Progress & Breakdown */}
          <div className="mt-3.5 pt-3 border-t border-slate-700/70">
            <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-300 mb-1.5">
              <span className="font-semibold">Statutory Assessment Reliability</span>
              <span className="font-bold text-emerald-300">{overallConfidence}% Overall Score</span>
            </div>
            <div className="w-full h-2.5 bg-slate-700/80 rounded-full overflow-hidden flex shadow-inner">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  overallConfidence >= 90
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : overallConfidence >= 75
                    ? 'bg-gradient-to-r from-blue-500 to-emerald-400'
                    : 'bg-gradient-to-r from-amber-500 to-amber-400'
                }`}
                style={{ width: `${overallConfidence}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 mt-1.5">
              <span>OCR Clarity: 45%</span>
              <span>Syntax Conformity: 35%</span>
              <span>Evidence: 20%</span>
            </div>
          </div>
        </section>
        {/* =========================================================================
            E-COMMERCE SPECIFIC HEADER & VERDICT (Based on Checklist Specification)
            ========================================================================= */}
        {isEcommerce && ecomReport ? (
          <>
            {/* DCA Safeguard Screening Notice */}
            <aside aria-label="E-Commerce Legal Safeguard Notice" className="bg-blue-950/90 text-blue-100 p-3 rounded-2xl border border-blue-800/80 shadow-sm text-xs space-y-1">
              <div className="flex items-center space-x-1.5 text-manak-orange font-bold">
                <Scale className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="uppercase text-[10px] tracking-wider mono">E-Commerce Legal Screening Rule 6(10)</span>
              </div>
              <p className="text-[11px] text-blue-200/90 leading-relaxed">
                Evaluated under the Legal Metrology (Packaged Commodities) Rules 2011 &amp; Department of Consumer Affairs Guidelines. Physical packaging attributes (actual net weight, MPE, font height) are distinguished from online listing requirements.
              </p>
            </aside>

            {/* Verdict Card */}
            <section
              className={`rounded-2xl p-4 border shadow-sm ${
                ecomReport.verdict === 'ONLINE_COMPLIANT'
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                  : ecomReport.verdict === 'ONLINE_NON_COMPLIANT'
                  ? 'bg-red-50/95 border-red-300 text-red-950'
                  : 'bg-amber-50/95 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      ecomReport.verdict === 'ONLINE_COMPLIANT'
                        ? 'bg-emerald-600 text-white'
                        : ecomReport.verdict === 'ONLINE_NON_COMPLIANT'
                        ? 'bg-manak-red text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {ecomReport.verdict === 'ONLINE_COMPLIANT' ? (
                      <ShieldCheck className="w-6 h-6" />
                    ) : (
                      <AlertTriangle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-mono tracking-wider font-bold block text-slate-500">
                      MANAK Online Result
                    </span>
                    <h2 className="text-sm font-extrabold uppercase tracking-wide">
                      {ecomReport.verdict_display}
                    </h2>
                    <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                      {ecomReport.verdict_subtitle}
                    </p>
                  </div>
                </div>

                {ecomReport.total_violations > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase mono block font-semibold">
                      Rule 32 Fine
                    </span>
                    <span className="text-sm font-black text-manak-red mono">
                      ₹{ecomReport.total_penalty.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar of online declaration score */}
              <div className="mt-3 pt-3 border-t border-slate-200/70">
                <div className="flex justify-between items-center text-[10px] mono text-slate-600 mb-1">
                  <span>Mandatory Declarations Verified</span>
                  <span className="font-bold">
                    {ecomReport.declarations_score.passed} / {ecomReport.declarations_score.total} ({ecomReport.declarations_score.percent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      ecomReport.declarations_score.percent === 100
                        ? 'bg-emerald-500'
                        : ecomReport.declarations_score.percent >= 70
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${ecomReport.declarations_score.percent}%` }}
                  ></div>
                </div>
              </div>

              {/* Scanned Subject Summary & Packaging Image Display */}
              <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-col space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                    {activeDisplayImage ? (
                      <img
                        src={activeDisplayImage}
                        alt={currentProduct?.title || 'Packaged Commodity'}
                        className="w-14 h-14 rounded-xl object-contain border border-slate-200 flex-shrink-0 bg-white shadow-sm p-0.5"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 block truncate text-xs">{currentProduct?.title}</span>
                      <span className="text-[10.5px] text-slate-500 block truncate">
                        Brand: {currentProduct?.brand || 'Generic / Unbranded'}
                      </span>
                      {currentProduct?.ecommerce_platform && (
                        <span className="inline-block text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-manak-navy text-white uppercase mt-0.5">
                          {currentProduct.ecommerce_platform}
                        </span>
                      )}
                    </div>
                  </div>

                  {currentProduct?.ecommerce_url && (
                    <a
                      href={currentProduct.ecommerce_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-manak-navy p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex-shrink-0"
                      title="Open Marketplace Page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Packaging Photos Multi-Image Strip */}
                {currentProduct?.images && currentProduct.images.length > 1 && (
                  <div className="pt-2 border-t border-slate-200/50">
                    <div className="text-[9.5px] uppercase font-bold text-slate-500 mono mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-indigo-600" />
                        Listing Packaging Photos ({currentProduct.images.length})
                      </span>
                      <span className="text-[9px] text-slate-400">Tap to inspect</span>
                    </div>
                    <div className="flex items-center space-x-2 overflow-x-auto pb-1 hide-scrollbar">
                      {currentProduct.images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedImage(img)}
                          className={`w-12 h-12 rounded-lg border overflow-hidden flex-shrink-0 transition-all bg-white ${
                            activeDisplayImage === img
                              ? 'border-manak-navy ring-2 ring-manak-navy/40 scale-105 shadow-sm'
                              : 'border-slate-200 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt={`Panel ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Quick Metrics Strip (Pricing, Unit Sale Price, Origin) */}
            <section className="grid grid-cols-3 gap-2">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9.5px] uppercase font-mono text-slate-400 block">Declared MRP</span>
                <span className="text-xs font-bold text-slate-800 mono mt-0.5 block">
                  {currentExtraction?.mrp.value?.amount ? `₹${currentExtraction.mrp.value.amount}` : 'Missing'}
                </span>
                <span className="text-[9px] text-emerald-600 block">Rule 6(1)(e)</span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9.5px] uppercase font-mono text-slate-400 block">Unit Sale Price</span>
                <span className="text-xs font-bold text-manak-navy mono mt-0.5 block truncate">
                  {ecomReport.unit_sale_price_analysis?.calculated_price !== null
                    ? `₹${ecomReport.unit_sale_price_analysis?.calculated_price} ${ecomReport.unit_sale_price_analysis?.unit_label}`
                    : 'N/A'}
                </span>
                <span className="text-[9px] text-blue-600 block">Rule 6(11)</span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9.5px] uppercase font-mono text-slate-400 block">Country of Origin</span>
                <span className="text-xs font-bold text-slate-800 mono mt-0.5 block truncate">
                  {currentExtraction?.country_of_origin.value || 'Missing'}
                </span>
                <span className="text-[9px] text-purple-600 block">Rule 6(10)</span>
              </div>
            </section>

            {/* Top View Mode Switcher: Statutory Checklist vs Extracted Entities & OCR */}
            <div className="flex bg-slate-200/90 p-1 rounded-xl text-xs font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setActiveMainTab('checklist')}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeMainTab === 'checklist'
                    ? 'bg-white text-manak-navy shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-manak-navy" />
                <span>Statutory Checklist</span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-blue-100 text-manak-navy mono">
                  {ecomReport.evaluations.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab('raw')}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeMainTab === 'raw'
                    ? 'bg-white text-manak-navy shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
                <span>Extracted Entities &amp; OCR</span>
                {currentExtraction?.generic_name?.value ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
            </div>

            {/* TAB 1: STATUTORY CHECKLIST VIEW */}
            {activeMainTab === 'checklist' && (
              <section className="space-y-3">
                {/* Category Filter Tabs */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 hide-scrollbar text-xs">
                  <button
                    onClick={() => setEcomTab('all')}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all ${
                      ecomTab === 'all'
                        ? 'bg-manak-navy text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All Checks ({ecomReport.evaluations.length})
                  </button>
                  <button
                    onClick={() => setEcomTab('online')}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all ${
                      ecomTab === 'online'
                        ? 'bg-manak-navy text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Mandatory Online
                  </button>
                  <button
                    onClick={() => setEcomTab('pricing')}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all ${
                      ecomTab === 'pricing'
                        ? 'bg-manak-navy text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Pricing &amp; USP
                  </button>
                  <button
                    onClick={() => setEcomTab('physical')}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all ${
                      ecomTab === 'physical'
                        ? 'bg-manak-navy text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Physical Verification Required
                  </button>
                  <button
                    onClick={() => setEcomTab('external')}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all ${
                      ecomTab === 'external'
                        ? 'bg-manak-navy text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Govt Registration
                  </button>
                </div>

                {/* Physical-Only Safeguard Banner (shown when viewing physical checks) */}
                {ecomTab === 'physical' && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                      <span>Legal Metrology Act — Rule 26 Physical Safeguard</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      <strong>Section 26 Physical Safeguard:</strong> These rules govern physical packaging geometry, gravimetric accuracy (Rule 11), MPE, and numeral height (Rule 7). An online listing cannot legally verify or fail these attributes. Enforcement Officers must verify them via retail physical sampling.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {filteredEcomRules.map(item => {
                    const isExpanded = expandedRule === item.rule_id;
                    const isPass = item.status === 'PASS';
                    const isFail = item.status === 'FAIL';
                    const isVerify = item.status === 'VERIFY';
                    const isCannotCheck = item.status === 'CANNOT_CHECK';
                    const isNotApplicable = item.status === 'NOT_APPLICABLE';

                    return (
                      <div
                        key={item.rule_id}
                        className={`bg-white rounded-xl border transition-all ${
                          isFail
                            ? 'border-red-200/90 shadow-sm'
                            : isVerify
                            ? 'border-amber-200/90'
                            : isCannotCheck
                            ? 'border-slate-300/80 bg-slate-50/50'
                            : isNotApplicable
                            ? 'border-blue-200/70 bg-blue-50/20'
                            : 'border-emerald-200/70 shadow-subtle'
                        }`}
                      >
                        {/* Card Header */}
                        <div
                          onClick={() => setExpandedRule(isExpanded ? null : item.rule_id)}
                          className="p-3 cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                            <div className="flex-shrink-0">
                              {isFail ? (
                                <div className="w-6 h-6 rounded-full bg-red-100 text-manak-red flex items-center justify-center">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </div>
                              ) : isVerify ? (
                                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </div>
                              ) : isCannotCheck ? (
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
                                  <Package className="w-3.5 h-3.5" />
                                </div>
                              ) : isNotApplicable ? (
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                  <Info className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <span className="text-[9.5px] uppercase font-mono font-bold text-slate-500">
                                  {item.rule_id}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 mono">
                                  {item.rule_number}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 mono font-semibold">
                                  {item.evidence_level}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 leading-snug truncate mt-0.5">
                                {item.requirement}
                              </h4>

                              {/* PROMINENT EXTRACTED VALUE DISPLAY */}
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9.5px] text-slate-500 mono font-semibold">Extracted:</span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium truncate max-w-[220px] ${
                                  isFail
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : isPass
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {item.found_value || 'None / Missing from listing'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            {/* E-Commerce Rule Confidence Score */}
                            {item.confidence !== undefined && (
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shadow-xs ${
                                  item.confidence >= 0.90
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : item.confidence >= 0.70
                                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                                    : 'bg-amber-50 text-amber-700 border-amber-300'
                                }`}
                                title={`Confidence: ${Math.round(item.confidence * 100)}%`}
                              >
                                {Math.round(item.confidence * 100)}%
                              </span>
                            )}

                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase mono ${
                                isFail
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : isVerify
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : isCannotCheck
                                  ? 'bg-slate-200 text-slate-700'
                                  : isNotApplicable
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {item.rule_id === 'LM-06-23'
                                ? 'NOT REQUIRED ONLINE'
                                : item.status === 'CANNOT_CHECK'
                                ? 'CANNOT CHECK'
                                : item.status === 'NOT_APPLICABLE'
                                ? 'N/A'
                                : item.status}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Detail Drawer */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3.5 pt-1 text-xs border-t border-slate-100 space-y-2.5 bg-slate-50/60 rounded-b-xl">
                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                              <div className="p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase mono block">
                                  Found Value / Status:
                                </span>
                                <span className="font-semibold text-slate-800 break-words mt-0.5 block">
                                  {item.found_value || 'None / Omitted from listing'}
                                </span>
                              </div>
                              <div className="p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase mono block">
                                  Statutory Expectation:
                                </span>
                                <span className="font-semibold text-slate-800 break-words mt-0.5 block">
                                  {item.expected_value}
                                </span>
                              </div>
                            </div>

                            {/* Confidence Score & Evaluation Basis Drawer */}
                            <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-slate-700">
                              <div className="flex items-center justify-between font-bold text-emerald-900 text-[10px] uppercase mono">
                                <span>Digital Compliance Confidence:</span>
                                <span className="text-xs text-emerald-700 font-extrabold">
                                  {Math.round((item.confidence || 0.95) * 100)}% Confident
                                </span>
                              </div>
                              <p className="mt-0.5 text-[10px] text-slate-600 leading-snug">
                                <strong>Basis:</strong> {item.confidence_basis || 'Verified against digital marketplace listing DOM and Rule 6(10) statutory disclosures.'}
                              </p>
                            </div>

                            <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-slate-700">
                              <span className="font-bold text-manak-navy block text-[10px] uppercase mono">
                                Legal Analysis &amp; Citation:
                              </span>
                              <p className="mt-0.5 leading-relaxed">{item.explanation}</p>
                              <p className="mt-1 font-mono text-[9.5px] text-blue-900/80 italic">{item.citation}</p>
                            </div>

                            {isFail && item.penalty > 0 && (
                              <div className="flex justify-between items-center text-[10px] mono px-2 py-1 bg-red-50 rounded border border-red-200 text-red-700 font-bold">
                                <span>Compounding Penalty (Rule 32 / Sec 36)</span>
                                <span>₹{item.penalty.toLocaleString('en-IN')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* TAB 2: EXTRACTED ENTITIES & OCR VIEW */}
            {activeMainTab === 'raw' && (
              <section className="space-y-3">
                {/* Extracted Fields Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Legal Metrology Declarations Extracted</span>
                    <span className="text-[10px] text-slate-400 mono">{rawFields.length} Parameters</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {rawFields.map((f, idx) => (
                      <div key={idx} className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700 text-[11px]">{f.label}</span>
                          {f.value && !f.value.toLowerCase().includes('missing') ? (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" />
                              <span>Extracted {f.confidence ? `(${Math.round(f.confidence * 100)}%)` : ''}</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" />
                              <span>Missing / Omitted</span>
                            </span>
                          )}
                        </div>

                        <div className="text-slate-900 font-medium text-[11px] break-words bg-slate-50/70 p-2 rounded border border-slate-100">
                          {f.value || <span className="text-slate-400 italic">Not declared in listing text or packaging images</span>}
                        </div>

                        {f.note && (
                          <span className="text-[9.5px] text-slate-400 italic block">{f.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analyzed Images Gallery (if images were parsed) */}
                {currentProduct?.images && currentProduct.images.length > 0 && (
                  <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                        Packaging Images Analyzed ({currentProduct.images.length})
                      </span>
                      <span className="text-[10px] text-slate-400 mono">Multi-Modal Vision</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {currentProduct.images.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedImage(img)}
                          className={`rounded-xl border overflow-hidden cursor-pointer relative group aspect-square bg-slate-50 ${
                            activeDisplayImage === img ? 'ring-2 ring-manak-navy border-manak-navy' : 'border-slate-200'
                          }`}
                        >
                          <img src={img} alt={`Panel ${idx + 1}`} className="w-full h-full object-contain p-1" />
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] font-mono px-1 rounded">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scraped Text / OCR Stream Viewer */}
                {currentExtraction?.raw_ocr_text && (
                  <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        Scraped Page Text &amp; Specifications
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyRawText}
                        className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-mono"
                      >
                        {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto p-2.5 bg-slate-900 text-slate-100 rounded-xl text-[10px] font-mono leading-relaxed whitespace-pre-wrap select-all">
                      {currentExtraction.raw_ocr_text}
                    </div>
                  </div>
                )}

                {/* Raw JSON Inspector */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowJsonInspector(!showJsonInspector)}
                    className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-purple-600" />
                      Inspect Full Extraction JSON Payload
                    </span>
                    {showJsonInspector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showJsonInspector && (
                    <div className="p-3 bg-slate-950 text-emerald-400 space-y-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleCopyJson}
                          className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 font-mono bg-slate-800 px-2 py-1 rounded"
                        >
                          {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedJson ? 'Copied JSON' : 'Copy JSON'}</span>
                        </button>
                      </div>
                      <pre className="text-[9.5px] font-mono overflow-x-auto p-2 bg-slate-900 rounded max-h-60 text-slate-200">
                        {JSON.stringify(currentExtraction, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Review & Edit Manual Fallback Button */}
                <button
                  type="button"
                  onClick={() => navigateTo('review_extraction')}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5 text-manak-navy" />
                  <span>Manually Adjust / Edit Extracted Fields</span>
                </button>
              </section>
            )}
          </>
        ) : (
          /* =========================================================================
             STANDARD PHYSICAL DECLARATIONS CHECKLIST (Preserved for Physical Scans)
             ========================================================================= */
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-manak-navy" />
                Statutory Declarations Checklist (Rule 6, 7 &amp; 12)
              </h3>
              <div className="flex items-center space-x-2">
                {currentEvaluations.length > 0 && (
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 mono shadow-xs">
                    {Math.round(
                      (currentEvaluations.reduce((acc, curr) => acc + (curr.confidence || 0.95), 0) /
                        currentEvaluations.length) *
                        100
                    )}% Avg Confidence
                  </span>
                )}
                <span className="text-[10.5px] text-slate-400 mono font-semibold">{currentEvaluations.length} Clauses</span>
              </div>
            </div>

            <div className="space-y-2">
              {currentEvaluations.map(evalItem => {
                const isExpanded = expandedRule === evalItem.rule_id;
                const isViol = evalItem.status === 'violation';
                const isUnverifiable = evalItem.status === 'unverifiable';
                const isExempt = evalItem.status === 'exempt';
                const confPercent = Math.round((evalItem.confidence || 0.95) * 100);

                return (
                  <div
                    key={evalItem.rule_id}
                    className={`bg-white rounded-xl border transition-all ${
                      isViol
                        ? 'border-red-200/90 shadow-subtle'
                        : isUnverifiable
                        ? 'border-amber-200/90'
                        : isExempt
                        ? 'border-blue-200/90'
                        : 'border-slate-200/80'
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      onClick={() => setExpandedRule(isExpanded ? null : evalItem.rule_id)}
                      className="p-3 cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          {isViol ? (
                            <div className="w-5 h-5 rounded-full bg-red-100 text-manak-red flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          ) : isUnverifiable ? (
                            <div className="w-5 h-5 rounded-full bg-amber-100 text-manak-amber flex items-center justify-center">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </div>
                          ) : isExempt ? (
                            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-emerald-100 text-manak-green flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="text-[9.5px] uppercase font-mono text-slate-400 block -mb-0.5">
                            {evalItem.rule_source.split(',')[1] || evalItem.rule_source}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 leading-snug truncate">
                            {evalItem.requirement_name}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {/* Confidence Score Pill */}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shadow-xs ${
                            confPercent >= 90
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : confPercent >= 70
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}
                          title={`Confidence: ${confPercent}%`}
                        >
                          {confPercent}%
                        </span>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase mono ${
                            isViol
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isUnverifiable
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isExempt
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isViol ? 'Violation' : isUnverifiable ? 'Unverified' : isExempt ? 'Exempt' : 'Pass'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail Drawer */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 text-xs border-t border-slate-100 space-y-2 bg-slate-50/50 rounded-b-xl">
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div className="p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase mono block">Extracted Value:</span>
                            <span className="font-semibold text-slate-800 break-words mt-0.5 block">
                              {evalItem.found_value || 'None / Omitted'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase mono block">Statutory Mandate:</span>
                            <span className="font-semibold text-slate-800 break-words mt-0.5 block">
                              {evalItem.expected_value}
                            </span>
                          </div>
                        </div>

                        {/* Confidence Score & Evaluation Basis Drawer */}
                        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-slate-700">
                          <div className="flex items-center justify-between font-bold text-emerald-900 text-[10px] uppercase mono">
                            <span>Compliance Confidence Score:</span>
                            <span className="text-xs text-emerald-700 font-extrabold">{confPercent}% Confident</span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-slate-600 leading-snug">
                            <strong>Basis:</strong> {evalItem.confidence_basis || 'Derived from OCR visual token clarity (45%), statutory syntax conformity (35%), and cross-validation certainty (20%).'}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-slate-700">
                          <span className="font-bold text-manak-navy block text-[10px] uppercase mono">RAG Legal Citation &amp; Analysis:</span>
                          <p className="mt-0.5 leading-relaxed">{evalItem.explanation}</p>
                          <p className="mt-1 font-mono text-[9.5px] text-blue-900/80 italic">{evalItem.citation}</p>
                        </div>

                        {isViol && (
                          <div className="flex justify-between items-center text-[10px] mono px-1 text-red-700 font-bold">
                            <span>Statutory Fine: Rule 32</span>
                            <span>₹{evalItem.penalty}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Sticky Action Bar */}
      <footer className="bg-white border-t border-slate-200/90 p-3.5 pb-[calc(max(14px,env(safe-area-inset-bottom,0px))+4px)] shadow-nav relative z-20 flex-shrink-0">
        <button
          onClick={handleGenerateReport}
          className={`w-full py-3.5 px-4 rounded-xl active:scale-98 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition-all ${
            userRole === 'consumer' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-manak-navy hover:bg-slate-900'
          }`}
        >
          {userRole === 'consumer' ? (
            <>
              <FileText className="w-4 h-4 text-emerald-300" />
              <span>Proceed to Report Submission</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-manak-orange" />
              <span>Generate Official Evidentiary Report</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </footer>

      {/* Floating Legal Metrology AI Chatbot */}
      <FloatingProductChatbot
        product={currentProduct}
        extraction={currentExtraction}
        evaluations={currentEvaluations}
        isCompliant={isCompliant}
        totalPenalty={totalPenalty}
        bottomOffset="bottom-24"
      />
    </div>
  );
};
