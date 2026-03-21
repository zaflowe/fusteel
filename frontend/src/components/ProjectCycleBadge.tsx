"use client";

import { Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ProjectCycleBadgeProps {
  createdAt: string;
  endDate?: string | null;
  /** 简洁模式：省略年份，用在看板卡片上 */
  compact?: boolean;
}

/** 根据剩余天数计算胶囊颜色 */
function getCycleStyle(endDateStr: string): {
  className: string;
  urgencyLabel: string | null;
} {
  const endDate = new Date(endDateStr);
  const now = new Date();
  const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)
    return { className: 'bg-red-100 text-red-700 border-red-300', urgencyLabel: '已超期' };
  if (diffDays <= 15)
    return { className: 'bg-orange-100 text-orange-700 border-orange-300', urgencyLabel: `还${diffDays}天` };
  return { className: 'bg-blue-50 text-blue-600 border-blue-200', urgencyLabel: null };
}

/**
 * 项目周期胶囊标签 — 公共组件
 *
 * 用于看板卡片（compact=true，省略年份）和详情页（完整日期）。
 */
export default function ProjectCycleBadge({ createdAt, endDate, compact = false }: ProjectCycleBadgeProps) {
  if (!endDate) return null;

  const { className, urgencyLabel } = getCycleStyle(endDate);
  const dateFormat = compact ? 'MM/dd' : 'yyyy/MM/dd';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${className}`}
    >
      <Clock className="h-2.5 w-2.5 flex-shrink-0" />
      {format(new Date(createdAt), dateFormat)}
      {compact ? ' → ' : ' 至 '}
      {format(new Date(endDate), dateFormat)}
      {urgencyLabel && (
        <span className="ml-1 font-semibold">· {urgencyLabel}</span>
      )}
    </span>
  );
}
