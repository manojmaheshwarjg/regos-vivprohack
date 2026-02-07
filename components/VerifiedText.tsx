import React, { useMemo } from 'react';
import { SearchVerificationIssue } from '../types';
import { AlertTriangle, XCircle, Info } from 'lucide-react';

interface VerifiedTextProps {
  text: string;
  issues: SearchVerificationIssue[];
  onIssueClick: (issue: SearchVerificationIssue) => void;
}

interface TextSegment {
  text: string;
  issue?: SearchVerificationIssue;
}

export const VerifiedText: React.FC<VerifiedTextProps> = ({ text, issues, onIssueClick }) => {
  // Parse text into segments with issue highlights
  const segments = useMemo(() => {
    if (issues.length === 0) {
      return [{ text }];
    }

    // Sort issues by start index
    const sortedIssues = [...issues]
      .filter(issue => issue.startIndex !== undefined && issue.endIndex !== undefined)
      .sort((a, b) => a.startIndex! - b.startIndex!);

    const result: TextSegment[] = [];
    let currentIndex = 0;

    sortedIssues.forEach(issue => {
      // Add text before the issue
      if (issue.startIndex! > currentIndex) {
        result.push({
          text: text.substring(currentIndex, issue.startIndex!)
        });
      }

      // Add the highlighted issue
      result.push({
        text: text.substring(issue.startIndex!, issue.endIndex!),
        issue
      });

      currentIndex = issue.endIndex!;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      result.push({
        text: text.substring(currentIndex)
      });
    }

    return result;
  }, [text, issues]);

  const getIssueIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-3 h-3 inline-block mr-1" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3 inline-block mr-1" />;
      case 'info':
        return <Info className="w-3 h-3 inline-block mr-1" />;
      default:
        return null;
    }
  };

  const getIssueStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-b-2 border-red-500 text-red-900 hover:bg-red-200';
      case 'warning':
        return 'bg-yellow-100 border-b-2 border-yellow-500 text-yellow-900 hover:bg-yellow-200';
      case 'info':
        return 'bg-blue-100 border-b-2 border-blue-500 text-blue-900 hover:bg-blue-200';
      default:
        return '';
    }
  };

  return (
    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
      {segments.map((segment, index) => {
        if (segment.issue) {
          const { issue } = segment;

          if (issue.isOverridden) {
            // Render overridden issues with strike-through
            return (
              <span
                key={index}
                className="line-through text-slate-400"
                title="This issue has been acknowledged"
              >
                {segment.text}
              </span>
            );
          }

          return (
            <span
              key={index}
              className={`${getIssueStyle(issue.severity)} px-1 cursor-pointer transition-all relative group rounded`}
              onClick={() => onIssueClick(issue)}
              role="button"
              tabIndex={0}
            >
              {segment.text}

              {/* Tooltip on hover */}
              <span className="invisible group-hover:visible absolute left-0 top-full mt-2 w-72 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
                <div className="flex items-start gap-2 mb-2">
                  {getIssueIcon(issue.severity)}
                  <strong className="text-xs uppercase">{issue.severity}</strong>
                </div>
                <div className="mb-2">
                  <div className="text-slate-300 mb-1">Claimed:</div>
                  <div className="font-mono bg-slate-800 p-1 rounded">{issue.claim}</div>
                </div>
                <div>
                  <div className="text-slate-300 mb-1">Actual:</div>
                  <div className="font-mono bg-slate-800 p-1 rounded">{issue.sourceData}</div>
                </div>
                <div className="mt-2 text-slate-400 border-t border-slate-700 pt-2">
                  Click for details
                </div>
                {/* Arrow */}
                <div className="absolute left-4 -top-1 w-2 h-2 bg-slate-900 transform rotate-45"></div>
              </span>
            </span>
          );
        }

        return <span key={index}>{segment.text}</span>;
      })}
    </div>
  );
};
