import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, XCircle, Info, CheckCircle } from 'lucide-react';
import { SearchVerificationIssue } from '../types';

interface VerificationModalProps {
  issue: SearchVerificationIssue | null;
  onClose: () => void;
  onOverride: (issueId: string) => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ issue, onClose, onOverride }) => {
  if (!issue) return null;

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badge: 'bg-red-100 text-red-700'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badge: 'bg-yellow-100 text-yellow-700'
        };
      case 'info':
        return {
          icon: Info,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badge: 'bg-blue-100 text-blue-700'
        };
      default:
        return {
          icon: Info,
          color: 'text-slate-600',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200',
          badge: 'bg-slate-100 text-slate-700'
        };
    }
  };

  const config = getSeverityConfig(issue.severity);
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={`p-6 ${config.bgColor} border-b ${config.borderColor}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`p-3 ${config.badge} rounded-xl`}>
                  <Icon className={`w-6 h-6 ${config.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">Verification Issue Detected</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${config.badge}`}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{issue.explanation}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Body - Side by Side Comparison */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* AI Claim */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <h4 className="font-semibold text-slate-900 text-sm">AI Generated Claim</h4>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-sm text-slate-800 font-mono leading-relaxed">
                    {issue.claim}
                  </p>
                </div>
              </div>

              {/* Source Data */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h4 className="font-semibold text-slate-900 text-sm">Actual Source Data</h4>
                </div>
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <p className="text-sm text-slate-800 font-mono leading-relaxed">
                    {issue.sourceData}
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            {(issue.field || issue.trialId) && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-slate-900 text-sm mb-3">Additional Details</h4>
                <div className="space-y-2 text-sm">
                  {issue.field && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Field Checked:</span>
                      <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                        {issue.field}
                      </span>
                    </div>
                  )}
                  {issue.trialId && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Trial ID:</span>
                      <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                        {issue.trialId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warning/Info Box */}
            {issue.severity === 'critical' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 text-sm mb-1">Critical Issue</p>
                    <p className="text-sm text-red-700 leading-relaxed">
                      This issue indicates potentially fabricated or severely incorrect information.
                      Please verify the source data before proceeding. Acknowledging this issue will
                      allow you to continue, but the information may be unreliable.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 text-sm mb-1">Verification Note</p>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      This issue has been detected but may not be critical. Review the comparison above
                      and decide whether to acknowledge this discrepancy or return to search for more accurate results.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Actions */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onOverride(issue.id);
                onClose();
              }}
              className="px-6 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-700 hover:to-brand-600 transition-all shadow-md hover:shadow-lg font-semibold text-sm flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Acknowledge & Continue
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
