import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, X, Send, ChevronDown, Scale, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Product, ExtractionResult, RuleEvaluation } from '../../types';
import { askComplianceChatApi } from '../../services/api';

interface FloatingProductChatbotProps {
  product?: Product | null;
  extraction?: ExtractionResult | null;
  evaluations?: RuleEvaluation[];
  isCompliant?: boolean;
  totalPenalty?: number;
  bottomOffset?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citation?: string;
  time: string;
}

export const FloatingProductChatbot: React.FC<FloatingProductChatbotProps> = ({
  product,
  extraction,
  evaluations = [],
  isCompliant = true,
  totalPenalty = 0,
  bottomOffset = 'bottom-20'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const productTitle = product?.title || extraction?.generic_name?.value || 'Inspected Commodity';
  const violations = evaluations.filter(e => e.status === 'violation');

  // Build comprehensive product context string for Gemini AI
  const productContextString = [
    `Product Title: ${productTitle}`,
    `Brand: ${product?.brand || 'Unknown'}`,
    `Category: ${product?.category || 'Packaged Commodity'}`,
    `Source: ${product?.source_type === 'ecommerce' ? 'E-Commerce Online Listing' : 'Physical Package Label'}`,
    `Declared Generic Name: ${extraction?.generic_name?.value || 'Not Detected'}`,
    `Declared Manufacturer / Packer: ${extraction?.manufacturer?.value || 'Not Detected'}`,
    `Declared Net Quantity: ${extraction?.net_quantity?.value ? `${extraction.net_quantity.value.amount} ${extraction.net_quantity.value.unit}` : 'Not Detected'}`,
    `Declared MRP: ${extraction?.mrp?.value ? `Rs. ${extraction.mrp.value.amount} (Text: "${extraction.mrp.value.raw_text}", Has "incl. of all taxes": ${extraction.mrp.value.is_inclusive_taxes})` : 'Not Detected'}`,
    `Declared Mfg Date: ${extraction?.mfg_date?.value || 'Not Detected'}`,
    `Declared Consumer Care: ${extraction?.consumer_care?.value?.phone || extraction?.consumer_care?.value?.email || 'Not Detected'}`,
    `Declared Country of Origin: ${extraction?.country_of_origin?.value || 'Not Detected'}`,
    `Principal Display Panel Font Height: ${extraction?.numeral_height_mm?.value ? `${extraction.numeral_height_mm.value} mm (${extraction.numeral_height_mm.note || ''})` : 'Not Detected'}`,
    `Overall Audit Status: ${isCompliant ? 'COMPLIANT' : `NON-COMPLIANT (${violations.length} violations)`}`,
    `Total Statutory Penalty: Rs. ${totalPenalty}`,
    `Detailed Rule Evaluations:`,
    ...evaluations.map(e => `- [${e.status.toUpperCase()}] ${e.requirement_name} (${e.rule_source}): Found "${e.found_value || 'None'}" vs Expected "${e.expected_value}". ${e.explanation || ''} ${e.penalty ? `(Penalty: Rs. ${e.penalty})` : ''} Citation: ${e.citation}`)
  ].join('\n');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Namaste! I have analyzed **${productTitle}** (${product?.brand || 'Packaged Commodity'}). You can ask me anything about this product's statutory declarations, why any rule failed, font height thresholds, or compounding penalties under the Legal Metrology Act 2009 & PCR 2011.`,
      citation: 'Legal Metrology (Packaged Commodities) Rules, 2011',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await askComplianceChatApi(q, newHistory, productContextString);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: res.answer || 'Refer to the Legal Metrology (Packaged Commodities) Rules, 2011 for applicable statutory directives.',
        citation: res.citation || 'Legal Metrology (Packaged Commodities) Rules, 2011',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: violations.length > 0
          ? `For this product, ${violations.length} issue(s) were flagged: ${violations.map(v => v.requirement_name).join(', ')}. Under Rule 32 of Legal Metrology Rules, these offenses are compoundable or subject to notice under Section 36 of the 2009 Act.`
          : `All mandatory declarations under Rule 6(1) for this product appear compliant with statutory requirements.`,
        citation: 'Rule 6 & Rule 32, Packaged Commodities Rules 2011',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = violations.length > 0
    ? [
        'Why was this product flagged?',
        'What are the compounding penalties?',
        'Check font height requirement',
        'Mandatory declarations summary'
      ]
    : [
        'Are all mandatory declarations valid?',
        'What are the net quantity rules?',
        'Verify MRP & tax wording',
        'Check consumer care compliance'
      ];

  const renderFormattedText = (text: string, isUser: boolean) => {
    if (isUser) {
      return <p className="whitespace-pre-wrap text-xs">{text}</p>;
    }

    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs leading-relaxed text-slate-800">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-0.5" />;

          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const renderedParts = parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={i} className="font-bold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            return (
              <div key={idx} className="flex items-start gap-1.5 ml-1">
                <span className="text-purple-600 font-bold leading-none mt-1">•</span>
                <span className="flex-1">{renderedParts}</span>
              </div>
            );
          }

          if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.)\s(.*)/);
            return (
              <div key={idx} className="flex items-start gap-1.5 ml-1">
                <span className="text-amber-600 font-bold font-mono">{match ? match[1] : '•'}</span>
                <span className="flex-1">{match ? match[2] : renderedParts}</span>
              </div>
            );
          }

          if (trimmed === '---' || trimmed === '***') {
            return <hr key={idx} className="my-2 border-slate-200" />;
          }

          if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
            const headingText = trimmed.replace(/^#+\s*/, '');
            return (
              <h5 key={idx} className="font-bold text-slate-900 text-xs mt-2.5 mb-1 border-b border-slate-100 pb-0.5">
                {headingText}
              </h5>
            );
          }

          return (
            <p key={idx} className="text-xs leading-relaxed break-words">
              {renderedParts}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Floating Action Button (FAB) - Extra large, prominent, and visible on all screens */}
      {!isOpen && (
        <div className={`fixed ${bottomOffset} right-3.5 z-40 flex flex-col items-end gap-1.5 animate-fade-in`}>
          {/* Always-Visible Glowing Pill Tooltip */}
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600 text-white px-3 py-1 rounded-full shadow-lg border border-white/60 text-[10.5px] font-bold tracking-wide hover:shadow-xl transition-all group active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
            <span>Ask Product AI</span>
          </button>

          {/* Main Large Glowing Floating Circle Button */}
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open Product AI Chatbot"
            className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full bg-gradient-to-tr from-purple-800 via-indigo-600 to-blue-500 text-white shadow-2xl hover:shadow-[0_12px_30px_rgba(79,70,229,0.5)] hover:scale-108 active:scale-92 transition-all duration-200 border-[2.5px] border-white ring-4 ring-indigo-400/35 flex items-center justify-center relative group cursor-pointer"
          >
            <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-30 pointer-events-none" />
            <Bot className="w-8 h-8 sm:w-9 sm:h-9 text-white group-hover:scale-110 transition-transform duration-200 drop-shadow-sm" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white ring-2 ring-emerald-500/50 shadow-sm" />
          </button>
        </div>
      )}

      {/* Slide-Up Chat Sheet / Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-fade-in">
          {/* Backdrop dismiss */}
          <div className="flex-1" onClick={() => setIsOpen(false)} />

          {/* Chat Container */}
          <div className="bg-white rounded-t-3xl shadow-2xl border-t border-slate-200/90 flex flex-col h-[82vh] max-h-[640px] w-full max-w-lg mx-auto overflow-hidden animate-slide-up">
            
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-[#0B2545] via-[#133E68] to-[#1D2D50] text-white flex items-center justify-between shadow-sm flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-inner">
                  <Bot className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-xs sm:text-sm font-bold tracking-tight">MANAK Legal Metrology AI</h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-[10px] text-blue-200/90 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Product Intelligence &bull; Gemini Flash</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspected Product Context Pill Bar */}
            <div className="px-4 py-2 bg-purple-50/90 border-b border-purple-100 flex items-center justify-between text-xs flex-shrink-0">
              <div className="flex items-center space-x-2 truncate mr-2">
                <Scale className="w-3.5 h-3.5 text-purple-700 flex-shrink-0" />
                <span className="text-[11px] font-bold text-slate-800 truncate">
                  {productTitle}
                </span>
              </div>
              {isCompliant ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9.5px] font-bold flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Compliant</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[9.5px] font-bold flex-shrink-0">
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  <span>{violations.length} Issues</span>
                </span>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F8F9FA] hide-scrollbar">
              {messages.map(msg => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[86%] rounded-2xl p-3 shadow-xs ${
                        isUser
                          ? 'bg-gradient-to-tr from-manak-navy to-blue-800 text-white rounded-tr-xs'
                          : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                      }`}
                    >
                      {renderFormattedText(msg.text, isUser)}

                      {/* Citation line */}
                      {!isUser && msg.citation && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-purple-700 font-mono">
                          <span className="truncate">&sect; {msg.citation}</span>
                          <span className="text-slate-400 font-sans ml-2">{msg.time}</span>
                        </div>
                      )}

                      {isUser && (
                        <div className="text-[9px] text-blue-200 text-right mt-1">
                          {msg.time}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-3 shadow-xs flex items-center space-x-2 text-slate-600 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span>Analyzing Legal Metrology rules for this product...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Question Chips */}
            <div className="px-3.5 py-2 bg-white border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto hide-scrollbar flex-shrink-0">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 border border-slate-200/80 text-[10px] font-medium text-slate-700 transition-colors disabled:opacity-50 flex items-center space-x-1"
                >
                  <span>{q}</span>
                  <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-slate-200/80 flex items-center space-x-2 flex-shrink-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about this product's legal metrology..."
                disabled={isLoading}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white flex items-center justify-center shadow-sm disabled:opacity-40 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
