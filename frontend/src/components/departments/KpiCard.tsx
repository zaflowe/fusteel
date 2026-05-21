'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: 'emerald' | 'blue' | 'amber' | 'rose';
  caption?: string;
  trend?: number;
  index?: number;
  /** 若提供，整张卡片可点击跳转 */
  href?: string;
}

const ACCENT_MAP: Record<NonNullable<Props['accent']>, { iconBg: string; iconText: string; bar: string; trendUp: string; trendDown: string }> = {
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-600',
    bar: 'bg-emerald-500',
    trendUp: 'text-emerald-600 bg-emerald-500/10',
    trendDown: 'text-rose-600 bg-rose-500/10',
  },
  blue: {
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-600',
    bar: 'bg-blue-500',
    trendUp: 'text-blue-600 bg-blue-500/10',
    trendDown: 'text-rose-600 bg-rose-500/10',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-600',
    bar: 'bg-amber-500',
    trendUp: 'text-amber-600 bg-amber-500/10',
    trendDown: 'text-rose-600 bg-rose-500/10',
  },
  rose: {
    iconBg: 'bg-rose-500/10',
    iconText: 'text-rose-600',
    bar: 'bg-rose-500',
    trendUp: 'text-rose-600 bg-rose-500/10',
    trendDown: 'text-rose-600 bg-rose-500/10',
  },
};

export default function KpiCard({
  label, value, icon: Icon, accent = 'emerald', caption, trend, index = 0, href,
}: Props) {
  const a = ACCENT_MAP[accent];
  const percent =
    typeof value === 'number'
      ? Math.min(100, value)
      : (() => {
          const m = String(value).match(/(\d+)/);
          return m ? Math.min(100, parseInt(m[1], 10)) : 70;
        })();

  const inner = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className={`h-10 w-10 rounded-xl ${a.iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${a.iconText}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend >= 0 ? a.trendUp : a.trendDown}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums">{value}</span>
      </div>

      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}

      <div className="mt-4 h-[3px] w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${a.bar} opacity-80`} style={{ width: `${percent}%` }} />
      </div>
    </CardContent>
  );

  const card = href ? (
    <Link href={href} aria-label={`${label} · 跳转看板`} className="block group">
      <Card className="cursor-pointer transition-all hover:shadow-md hover:border-foreground/20 group-hover:-translate-y-0.5">
        {inner}
      </Card>
    </Link>
  ) : (
    <Card className="hover:shadow-md transition-shadow">{inner}</Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      {card}
    </motion.div>
  );
}
