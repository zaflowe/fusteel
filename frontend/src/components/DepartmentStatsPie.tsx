'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { STATUS_COLORS, STATUS_ORDER } from '@/lib/departmentStats';

interface Props {
  byStatus: Record<string, number>;
  size?: number;
  /** 'none' | 'right'（在饼图右侧竖排）*/
  legend?: 'none' | 'right';
}

export default function DepartmentStatsPie({ byStatus, size = 160, legend = 'none' }: Props) {
  const data = STATUS_ORDER.map((name) => ({
    name,
    value: byStatus[name] ?? 0,
  })).filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  // legend 在右侧时，容器要给图例预留空间
  const width = legend === 'right' ? size + 110 : size;

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground rounded-full bg-muted/30"
        style={{ width: size, height: size }}
      >
        暂无
      </div>
    );
  }

  return (
    <ResponsiveContainer width={width} height={size}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx={legend === 'right' ? size / 2 : '50%'}
          cy="50%"
          innerRadius={size * 0.28}
          outerRadius={size * 0.42}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
          ))}
        </Pie>
        {legend === 'right' && (
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingLeft: 8 }}
          />
        )}
        <Tooltip formatter={(v: number, n: string) => [`${v} 项`, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
