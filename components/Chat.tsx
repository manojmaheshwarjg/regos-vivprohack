import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, Trash2, Check, X, Clock, Building2, Users, MapPin, Calendar, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatSession, Message, ClinicalTrial } from '../types';
import { generateChatResponse } from '../services/geminiService';

interface ChatProps {
  initialSession?: ChatSession | null;
  onSessionsChange?: (hasSessions: boolean) => void;
}

export const Chat: React.FC<ChatProps> = ({ initialSession, onSessionsChange }) => {
  const processedSessionRef = useRef<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTrial, setSelectedTrial] = useState<ClinicalTrial | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('regosChatSessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        setChatSessions(parsed.slice(0, 50)); // Keep last 50 sessions
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  }, []);

  // Save chat sessions to localStorage whenever they change
  useEffect(() => {
    if (chatSessions.length > 0) {
      try {
        localStorage.setItem('regosChatSessions', JSON.stringify(chatSessions));
      } catch (error) {
        console.error('Failed to save chat sessions:', error);
      }
    } else {
      // Remove from localStorage if empty
      localStorage.removeItem('regosChatSessions');
    }

    // Notify parent of session count change
    // IMPORTANT: Don't trigger redirect if we have a pending initialSession
    if (onSessionsChange) {
      const hasAnySessions = chatSessions.length > 0 || !!initialSession;
      onSessionsChange(hasAnySessions);
    }
  }, [chatSessions, onSessionsChange, initialSession]);

  // Handle initial session from search
  useEffect(() => {
    if (initialSession && processedSessionRef.current !== initialSession.id) {
      processedSessionRef.current = initialSession.id;

      // Add the new session to the existing sessions
      setChatSessions(prev => {
        // Check if this session already exists
        const exists = prev.some(s => s.id === initialSession.id);
        if (exists) return prev;
        return [initialSession, ...prev];
      });
      setActiveChatId(initialSession.id);
    }
  }, [initialSession]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatSessions, activeChatId]);

  const activeSession = chatSessions.find(s => s.id === activeChatId);


  const deleteSession = (sessionId: string) => {
    if (confirm('Delete this chat session?')) {
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeChatId === sessionId) {
        setActiveChatId(null);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeSession || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString() + Math.random(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: Date.now()
    };

    // Add user message to session
    setChatSessions(prev =>
      prev.map(session =>
        session.id === activeChatId
          ? {
              ...session,
              messages: [...session.messages, userMessage],
              title: session.messages.length === 0 ? inputMessage.trim().substring(0, 50) : session.title,
              updatedAt: Date.now()
            }
          : session
      )
    );

    setInputMessage('');
    setIsGenerating(true);

    try {
      // Generate AI response
      const response = await generateChatResponse(
        [...activeSession.messages, userMessage],
        activeSession.contextTrials
      );

      const assistantMessage: Message = {
        id: Date.now().toString() + Math.random(),
        role: 'assistant',
        content: response.answer,
        timestamp: Date.now(),
        citations: response.citations
      };

      // Add assistant message to session
      setChatSessions(prev =>
        prev.map(session =>
          session.id === activeChatId
            ? {
                ...session,
                messages: [...session.messages, assistantMessage],
                updatedAt: Date.now()
              }
            : session
        )
      );
    } catch (error) {
      console.error('Failed to generate chat response:', error);
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString() + Math.random(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error generating a response. Please try again.',
        timestamp: Date.now()
      };
      setChatSessions(prev =>
        prev.map(session =>
          session.id === activeChatId
            ? {
                ...session,
                messages: [...session.messages, errorMessage],
                updatedAt: Date.now()
              }
            : session
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCitedTrial = (nctId: string): ClinicalTrial | null => {
    if (!activeSession) return null;
    return activeSession.contextTrials.find(t => t.nctId === nctId) || null;
  };

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Session Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-600">
            <MessageSquare className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-lg text-slate-900">Chat Sessions</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">Convert searches to start conversations</p>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chatSessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No chat sessions yet</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">Go to Search, run a query, and click "Continue in Chat" to start</p>
            </div>
          ) : (
            chatSessions.map(session => (
              <button
                key={session.id}
                onClick={() => setActiveChatId(session.id)}
                className={`w-full text-left p-3 rounded-lg transition-all group ${
                  activeChatId === session.id
                    ? 'bg-brand-50 border-2 border-brand-300'
                    : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <h4 className={`text-sm font-semibold line-clamp-2 flex-1 ${
                    activeChatId === session.id ? 'text-brand-700' : 'text-slate-900'
                  }`}>
                    {session.title}
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-1 hover:bg-red-100 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(session.updatedAt)}
                  </span>
                  <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full">
                    {session.messages.length} msgs
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {!activeSession ? (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-brand-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">No Chat Selected</h2>
              <p className="text-slate-600 mb-6">
                Select a chat from the sidebar to continue the conversation. To start a new chat, go to the Search page, run a query, and click "Continue in Chat" on the AI-generated answer.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Search className="w-4 h-4" />
                <span>Start from Search → Get AI Answer → Continue in Chat</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white">
              <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{activeSession.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {activeSession.contextTrials.length} clinical trial{activeSession.contextTrials.length === 1 ? '' : 's'} in context
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeSession.messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-brand-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">Start the Conversation</h4>
                  <p className="text-slate-600 text-sm max-w-md mx-auto">
                    Ask questions about the {activeSession.contextTrials.length} clinical trial{activeSession.contextTrials.length === 1 ? '' : 's'} in this chat.
                    I can help you analyze phases, sponsors, conditions, and more.
                  </p>
                </div>
              ) : (
                activeSession.messages.map((message, idx) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-3xl ${message.role === 'user' ? 'w-auto' : 'w-full'}`}>
                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-5 py-4 ${
                          message.role === 'user'
                            ? 'bg-brand-600 text-white'
                            : 'bg-white border border-slate-200 shadow-sm'
                        }`}
                      >
                        <p className={`text-[15px] leading-relaxed ${
                          message.role === 'user' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {message.content}
                        </p>

                        {/* Citations */}
                        {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                              <Check className="w-3 h-3 text-brand-600" />
                              References
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {message.citations.map((nctId, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedTrial(getCitedTrial(nctId))}
                                  className="group px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-all shadow-sm hover:shadow-md"
                                >
                                  {nctId}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className={`text-xs text-slate-400 mt-1 px-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}

              {/* Typing Indicator */}
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                      <span className="text-sm text-slate-600">Analyzing trials...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-3">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask about the clinical trials..."
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none text-sm"
                    rows={2}
                    disabled={isGenerating}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isGenerating}
                    className={`px-5 py-3 rounded-xl flex items-center gap-2 transition-all font-semibold text-sm ${
                      inputMessage.trim() && !isGenerating
                        ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Trial Details Modal */}
      <AnimatePresence>
        {selectedTrial && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedTrial.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-lg text-xs font-bold">
                        {selectedTrial.nctId}
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                        {selectedTrial.phase}
                      </span>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        selectedTrial.status === 'Recruiting'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedTrial.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTrial(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Description</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedTrial.description}</p>
                </div>

                {/* Conditions */}
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Conditions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTrial.conditions.map((condition, idx) => (
                      <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Key Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <Building2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wide">Sponsor</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{selectedTrial.sponsor}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wide">Enrollment</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{selectedTrial.enrollment} participants</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wide">Locations</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{selectedTrial.locations.length} sites</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wide">Start Date</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{selectedTrial.startDate || 'N/A'}</p>
                  </div>
                </div>

                {/* Intervention */}
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Intervention</h4>
                  <p className="text-sm text-slate-700">{selectedTrial.intervention}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
