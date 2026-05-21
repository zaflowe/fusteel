'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { STATUS_ORDER, STATUS_COLORS } from '@/lib/departmentStats';

/** 与项目原有 STATUS_COLORS 保持一致：blue / amber / emerald / red */
const DONUT_COLORS = STATUS_COLORS;

interface Props {
  byStatus: Record<string, number>;
  total: number;
}

export default function StatusDonut({ byStatus, total }: Props) {
  const data = STATUS_ORDER
    .map((name) => ({ name, value: byStatus[name] ?? 0 }))
    .filter((d) => d.value > 0);

  if (!data.length) {
    return (
      <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={108}
            paddingAngle={3}
            cornerRadius={4}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={DONUT_COLORS[d.name] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
            }}
            formatter={(v: number, n: string) => [`${v} 项`, n]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 中心数字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground mt-1">项目总数</span>
      </div>
    </div>
  );
}

export { DONUT_COLORS };
