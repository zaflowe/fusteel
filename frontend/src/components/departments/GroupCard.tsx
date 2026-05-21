'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_ORDER, StatsGroup, completionRate, STATUS_COLORS } from '@/lib/departmentStats';

interface Props {
  group: StatsGroup;
  href: string;
  index?: number;
}

export default function GroupCard({ group, href, index = 0 }: Props) {
  const data = STATUS_ORDER
    .map((name) => ({ name, value: group.byStatus[name] ?? 0 }))
    .filter((d) => d.value > 0);

  const done = group.byStatus['已结项'] ?? 0;
  const rate = completionRate(group.total, group.byStatus);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={href} className="block group">
        <Card className="hover:shadow-md hover:border-emerald-500/40 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1 truncate group-hover:text-emerald-600 transition">
                {group.key}
                <ChevronRight className="h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition" />
              </span>
              <Badge variant="outline" className="text-xs">{group.total}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-4">
                <Metric label="项目总数" value={group.total} />
                <Metric label="已完成" value={done} accent="text-emerald-600" />
                <Metric label="完成率" value={`${rate}%`} accent="text-amber-600" />
              </div>
              <div className="w-[88px] h-[88px] shrink-0">
                {data.length === 0 ? (
                  <div className="w-full h-full rounded-full border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">
                    无
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={26}
                        outerRadius={40}
                        paddingAngle={2}
                        cornerRadius={2}
                      >
                        {data.map((d) => (
                          <Cell key={d.name} fill={STATUS_COLORS[d.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((st) => (
                <Badge
                  key={st}
                  variant="secondary"
                  className="text-[11px] border"
                  style={{ borderColor: STATUS_COLORS[st], color: STATUS_COLORS[st] }}
                >
                  {st} {group.byStatus[st] ?? 0}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function Metric({ label, value, accent = '' }: { label: string; value: number | string; accent?: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold leading-none tabular-nums ${accent}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
