"use client";

import type { ProjectPriority } from '@/store/projectStore';

/**
 * ABC 优先级角标。
 * 三档色彩映射：
 *   A → 红色（核心，一眼就识别）
 *   B → 琥珀（重点）
 *   C → 灰色（一般）
 *   未定级（priority == null）→ 虚线边框 + "未" 字，提示需尽快评级
 *
 * size:
 *   'sm'   卡片左上角使用的小方块
 *   'md'   详情页/工具栏用的稍大角标
 *   'lg'   指挥舱 / 空态提示页用
 */
export interface PriorityBadgeProps {
  priority?: ProjectPriority | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean; // true → 显示"A 类"中文全称
  className?: string;
}

const COLOR_MAP: Record<ProjectPriority, { bg: string; border: string; text: string; label: string }> = {
  A: { bg: 'bg-red-500',    border: 'border-red-600',    text: 'text-white', label: 'A 类' },
  B: { bg: 'bg-amber-500',  border: 'border-amber-600',  text: 'text-white', label: 'B 类' },
  C: { bg: 'bg-gray-400',   border: 'border-gray-500',   text: 'text-white', label: 'C 类' },
};

const SIZE_MAP: Record<NonNullable<PriorityBadgeProps['size']>, { box: string; font: string }> = {
  sm: { box: 'h-5 min-w-5 px-1',   font: 'text-[11px]' },
  md: { box: 'h-6 min-w-6 px-1.5', font: 'text-xs'     },
  lg: { box: 'h-8 min-w-8 px-2',   font: 'text-sm'     },
};

export default function PriorityBadge({
  priority,
  size = 'sm',
  showLabel = false,
  className = '',
}: PriorityBadgeProps) {
  const sizing = SIZE_MAP[size];

  // 未定级：虚线边框 + 灰字，提示还要处理
  if (!priority) {
    return (
      <span
        title="该项目尚未定级，请在详情页评定 ABC 等级"
        className={`inline-flex items-center justify-center rounded border border-dashed border-gray-300 bg-white text-gray-400 font-semibold tracking-tight ${sizing.box} ${sizing.font} ${className}`}
      >
        {showLabel ? '未定级' : '未'}
      </span>
    );
  }

  const cfg = COLOR_MAP[priority];
  return (
    <span
      title={`${cfg.label}项目`}
      className={`inline-flex items-center justify-center rounded border ${cfg.bg} ${cfg.border} ${cfg.text} font-bold tracking-tight shadow-sm ${sizing.box} ${sizing.font} ${className}`}
    >
      {showLabel ? cfg.label : priority}
    </span>
  );
}
