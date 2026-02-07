import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { RegulatoryNewsItem, NewsCategory } from '@/types';

interface NewsCardProps {
  news: RegulatoryNewsItem;
}

// Company logo colors (brand colors)
const COMPANY_COLORS: Record<string, string> = {
  'Pfizer': 'bg-blue-500',
  'Johnson & Johnson': 'bg-red-500',
  'Merck': 'bg-green-600',
  'AbbVie': 'bg-purple-600',
  'AstraZeneca': 'bg-indigo-600'
};

// Category colors
const CATEGORY_COLORS: Record<NewsCategory, string> = {
  'FDA Approval': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Clinical Trial': 'bg-blue-100 text-blue-800 border-blue-200',
  'Partnership': 'bg-violet-100 text-violet-800 border-violet-200',
  'Financial': 'bg-amber-100 text-amber-800 border-amber-200',
  'R&D': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Policy Update': 'bg-orange-100 text-orange-800 border-orange-200',
  'Safety Alert': 'bg-red-100 text-red-800 border-red-200',
  'General News': 'bg-slate-100 text-slate-800 border-slate-200'
};

export const NewsCard: React.FC<NewsCardProps> = ({ news }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleClick = () => {
    window.open(news.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${COMPANY_COLORS[news.company] || 'bg-gray-500'}`} />
          <span className="font-semibold text-slate-900">{news.company}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>{formatDate(news.publishedDate)}</span>
          <ExternalLink className="w-4 h-4" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-slate-900 mb-3 leading-tight">
        {news.title}
      </h3>

      {/* Summary */}
      {news.summary && (
        <p className="text-slate-600 mb-4 line-clamp-2 leading-relaxed">
          {news.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Category */}
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[news.category]}`}>
          {news.category}
        </span>

        {/* Tags */}
        {news.tags && news.tags.slice(0, 2).map((tag, idx) => (
          <span
            key={idx}
            className="text-xs text-slate-500 font-medium"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
};
