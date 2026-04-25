"use client";

import { Clock, AlertTriangle, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 超期阈值：
 * - 30 天以上：黄色（warning）
 * - 60 天以上：红色（danger）
 * - 30 天以内：正常灰
 * - 从未固化：红色 + 专用文案
 */
const WARNING_DAYS = 30;
const DANGER_DAYS = 60;

function diffDays(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export interface LatestUpdateLineProps {
  latestAt?: string | null;
  summary?: string | null;
  reporter?: string | null;
  /** 紧凑模式用于卡片底部；非紧凑模式用于详情页小标题 */
  compact?: boolean;
  className?: string;
}

/**
 * 项目卡片底部展示"最近一次项目固化"的小尾巴。
 * 显示顺序：时间（距今） + 汇报人 + 摘要。
 * 超期会自动换成黄色 / 红色提示，从未固化则特别红标"尚未固化"。
 */
export default function LatestUpdateLine({
  latestAt,
  summary,
  reporter,
  compact = true,
  className = '',
}: LatestUpdateLineProps) {
  const days = diffDays(latestAt);

  // 从未固化：特别红标
  if (!latestAt) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-red-600 ${className}`}
        title="该项目尚未录入任何项目固化记录"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">尚未固化</span>
        <span className="text-red-400">· 请补录进展</span>
      </div>
    );
  }

  // 正常 / 告警颜色
  let tone = 'text-muted-foreground';
  if (days !== null && days >= DANGER_DAYS) tone = 'text-red-600';
  else if (days !== null && days >= WARNING_DAYS) tone = 'text-amber-600';

  const relative = (() => {
    try {
      return formatDistanceToNow(new Date(latestAt), { addSuffix: true, locale: zhCN });
    } catch {
      return '';
    }
  })();

  return (
    <div
      className={`flex items-start gap-1.5 text-xs ${tone} ${className}`}
      title={summary || ''}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div className={`flex-1 ${compact ? 'line-clamp-1' : ''}`}>
        <span className="font-medium">{relative}</span>
        {reporter && (
          <span className="opacity-80">
            <span className="mx-1">·</span>
            <User className="inline h-3 w-3 mr-0.5 -mt-0.5" />
            {reporter}
          </span>
        )}
        {summary && (
          <>
            <span className="mx-1 opacity-50">·</span>
            <span>{summary}</span>
          </>
        )}
      </div>
    </div>
  );
}
