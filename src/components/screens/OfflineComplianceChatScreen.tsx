import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { BottomNav } from '../common/BottomNav';
import { Send, Scale, BookOpen, Loader2, Cpu, CheckCircle2, WifiOff, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { askOfflineLegalMetrologyApi, OfflineQueryResult } from '../../services/offlineVectorStore';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citation?: string;
  retrievedRules?: OfflineQueryResult['retrievedRules'];
  time: string;
}

export const OfflineComplianceChatScreen: React.FC = () => {
  const { navigateTo } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: 'Namaste Officer. I am your **MANAK AI OFFLINE** Legal Metrology Assistant. I run **100% locally on your device** with zero internet connection required.\n\nYou can ask me about Rule 7 numeral height tables, Rule 32 compounding penalties, Rule 6 mandatory declarations, sticker prohibitions, or statutory exemptions under Rule 26.',
      citation: 'Legal Metrology (Packaged Commodities) Rules, 2011 — Offline Knowledge Base',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRulesId, setExpandedRulesId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setIsLoading(true);

    try {
      const res = await askOfflineLegalMetrologyApi(textToSend);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: res.answer,
        citation: res.citation,
        retrievedRules: res.retrievedRules,
        time: res.timestamp
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: 'All pre-packaged commodities sold or distributed in India are governed by the Legal Metrology (Packaged Commodities) Rules, 2011. Key mandatory declarations include Name & Complete Address of Manufacturer, Generic Name, Net Quantity, MRP (inclusive of all taxes), Date of Manufacture, and Consumer Care details.',
        citation: 'Rule 6(1), Legal Metrology (Packaged Commodities) Rules, 2011',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Markdown / Rich Text formatter for legal metrology answers
  const renderMessageContent = (text: string, isUser: boolean) => {
    if (isUser) {
      return <p className="whitespace-pre-wrap text-xs">{text}</p>;
    }

    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs leading-relaxed text-slate-800">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          // Parse **bold** parts
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

          // Horizontal rule
          if (trimmed === '---' || trimmed === '***') {
            return <hr key={idx} className="my-2 border-slate-200" />;
          }

          // Bullet list items
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            return (
              <div key={idx} className="flex items-start gap-2 ml-1">
                <span className="text-teal-600 font-bold leading-none mt-1">•</span>
                <span className="flex-1">{renderedParts}</span>
              </div>
            );
          }

          // Numbered list items
          if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.)\s(.*)/);
            return (
              <div key={idx} className="flex items-start gap-2 ml-1">
                <span className="text-emerald-700 font-bold font-mono">{match ? match[1] : '•'}</span>
                <span className="flex-1">{match ? match[2] : renderedParts}</span>
              </div>
            );
          }

          // Header lines (###, ####, or ##)
          if (trimmed.startsWith('#### ')) {
            const headingText = trimmed.replace(/^####\s*/, '');
            return (
              <h5 key={idx} className="font-bold text-slate-800 text-[11.5px] mt-2 mb-0.5">
                {headingText}
              </h5>
            );
          }

          if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
            const headingText = trimmed.replace(/^#+\s*/, '');
            return (
              <h4 key={idx} className="font-extrabold text-teal-900 text-xs mt-2.5 mb-1 border-b border-teal-100 pb-0.5">
                {headingText}
              </h4>
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

  const quickPrompts = [
    'Rule 7 numeral height table',
    'Compounding fine under Rule 32',
    'Can stickers alter MRP?',
    'Selling above printed MRP',
    'Mandatory declarations checklist',
    'Statutory exemptions under Rule 26'
  ];

  return (
    <div className="w-full h-full bg-[#F5F6F8] flex flex-col justify-between overflow-hidden">
      <Header title="MANAK AI OFFLINE" showBack showLogo />

      {/* Chat History */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
        {/* Offline Vector Engine Status Banner */}
        <div className="bg-gradient-to-r from-teal-900/10 via-emerald-50 to-cyan-500/10 rounded-2xl p-3 border border-teal-300/60 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white flex items-center justify-center shadow-xs">
              <Cpu className="w-4 h-4 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-900">MANAK AI OFFLINE</span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  100% On-Device
                </span>
              </div>
              <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5">
                <WifiOff className="w-3 h-3 text-emerald-600" />
                <span>Works without internet &bull; 42 Vector Rule Chunks</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-teal-700 block mono">Rules 2011</span>
            <span className="text-[9px] text-slate-400">Knowledge DB</span>
          </div>
        </div>

        {/* Message Stream */}
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isExpanded = expandedRulesId === msg.id;

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs ${
                  isUser
                    ? 'bg-gradient-to-tr from-[#0F4C81] to-[#1E3A8A] text-white rounded-tr-xs'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                }`}
              >
                {renderMessageContent(msg.text, isUser)}

                {/* Retrieved Rule Chunks Inspector (if available) */}
                {!isUser && msg.retrievedRules && msg.retrievedRules.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setExpandedRulesId(isExpanded ? null : msg.id)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-teal-800 hover:text-teal-950 py-1"
                    >
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                        <span>Retrieved {msg.retrievedRules.length} Verified Rules (Vector RAG)</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-1.5 space-y-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200 text-[10.5px]">
                        {msg.retrievedRules.map((r, i) => (
                          <div key={i} className="p-1.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span className="truncate">{r.requirement_name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-700 mono">
                                ₹{r.penalty}
                              </span>
                            </div>
                            <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">{r.rule_source}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Citation line */}
                {!isUser && msg.citation && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-teal-700 font-mono">
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
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              <span>Querying local SQLite vector store &amp; rules engine...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Suggested Quick Prompts */}
      <div className="px-3.5 py-2 bg-white border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto hide-scrollbar flex-shrink-0">
        {quickPrompts.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSend(q)}
            disabled={isLoading}
            className="whitespace-nowrap px-2.5 py-1 rounded-full bg-teal-50/80 hover:bg-teal-100 hover:text-teal-900 border border-teal-200/80 text-[10px] font-medium text-teal-800 transition-colors disabled:opacity-50 flex items-center space-x-1 active:scale-95"
          >
            <BookOpen className="w-2.5 h-2.5 opacity-70" />
            <span>{q}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-slate-200/80 shadow-nav flex items-center space-x-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask offline about Legal Metrology rules..."
          disabled={isLoading}
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-all"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-700 via-emerald-600 to-cyan-600 hover:opacity-95 active:scale-95 text-white flex items-center justify-center shadow-sm disabled:opacity-40 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
};
