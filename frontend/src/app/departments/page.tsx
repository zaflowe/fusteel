'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Loader2,
  Download,
  LayoutGrid,
  Activity,
  CheckCircle2,
  PauseCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DepartmentStatsResponse,
  StatsDimension,
  StatsRange,
  StatsQuery,
  fetchDepartmentStats,
  exportStatsExcelUrl,
} from '@/lib/departmentStats';
import KpiCard from '@/components/departments/KpiCard';
import StatusDonut, { DONUT_COLORS } from '@/components/departments/StatusDonut';
import GroupCard from '@/components/departments/GroupCard';

const CURRENT_YEAR = new Date().getFullYear();

export default function DepartmentsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DepartmentStatsResponse | null>(null);

  const [dimension, setDimension] = useState<StatsDimension>('department');
  const [range, setRange] = useState<StatsRange>('all');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [customStart, setCustomStart] = useState(`${CURRENT_YEAR}-01-01`);
  const [customEnd, setCustomEnd] = useState(`${CURRENT_YEAR}-12-31`);
  const [includeCompleted, setIncludeCompleted] = useState(true);

  const buildQuery = useCallback((): StatsQuery => ({
    dimension,
    range,
    year: range === 'year' ? parseInt(year, 10) : undefined,
    start: range === 'custom' ? customStart : undefined,
    end: range === 'custom' ? customEnd : undefined,
    include_completed: includeCompleted,
  }), [dimension, range, year, customStart, customEnd, includeCompleted]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDepartmentStats(buildQuery());
      setStats(data);
    } catch {
      toast.error('加载部门统计失败');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleExport = () => {
    try {
      const url = exportStatsExcelUrl(buildQuery());
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('正在下载 Excel（含饼图）');
    } catch {
      toast.error('下载失败，请重试');
    }
  };

  const groupHref = (key: string) => {
    const params = new URLSearchParams();
    params.set('dimension', dimension);
    params.set('range', range);
    if (range === 'year') params.set('year', year);
    if (range === 'custom') {
      params.set('start', customStart);
      params.set('end', customEnd);
    }
    params.set('include_completed', String(includeCompleted));
    return `/departments/${encodeURIComponent(key)}?${params.toString()}`;
  };

  if (loading && !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const overall = stats?.overall ?? { total: 0, byStatus: {}, byYear: {} };
  const total = overall.total;
  const done = overall.byStatus['已结项'] ?? 0;
  const inProgress = overall.byStatus['实施中'] ?? 0;
  const paused = overall.byStatus['暂停中'] ?? 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const rangeLabel =
    range === 'all' ? '累计在管' :
    range === 'year' ? `${year} 年度` :
    range === 'last_year' ? `${CURRENT_YEAR - 1} 年度` :
    `${customStart} ~ ${customEnd}`;

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8 max-w-7xl">
      {/* —— Hero —— */}
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b pb-6"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            部门统计
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            按分厂查看项目完成情况 · {dimension === 'department' ? '申报单位' : '改造场地'} · {rangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={dimension} onChange={(v) => setDimension(v as StatsDimension)}>
            <option value="department">申报单位</option>
            <option value="site">改造场地</option>
          </FilterSelect>
          <FilterSelect value={range} onChange={(v) => setRange(v as StatsRange)}>
            <option value="all">累计在管</option>
            <option value="year">本年度</option>
            <option value="last_year">上年度</option>
            <option value="custom">自定义</option>
          </FilterSelect>
          {range === 'year' && (
            <FilterSelect value={year} onChange={setYear}>
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                <option key={y} value={String(y)}>{y} 年</option>
              ))}
            </FilterSelect>
          )}
          {range === 'custom' && (
            <>
              <Input type="date" className="w-[140px]" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-muted-foreground text-sm">至</span>
              <Input type="date" className="w-[140px]" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          <Button
            variant={includeCompleted ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIncludeCompleted(!includeCompleted)}
          >
            {includeCompleted ? '含已结项' : '不含已结项'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> 导出 Excel
          </Button>
        </div>
      </motion.section>

      {/* —— KPI 四联卡（点击跳到首页对应看板） —— */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="项目总数" value={total} icon={LayoutGrid} accent="emerald" caption={`覆盖 ${stats?.groups.length ?? 0} 个分组 · 查看全部项目 →`} index={0} href="/" />
        <KpiCard label="实施中" value={inProgress} icon={Activity} accent="blue" caption={`占总数 ${pct(inProgress)}% · 查看看板 →`} trend={pct(inProgress)} index={1} href="/#section-in-progress" />
        <KpiCard label="已结项（完成率）" value={done} icon={CheckCircle2} accent="emerald" caption={`完成率 ${pct(done)}% · 查看看板 →`} trend={pct(done)} index={2} href="/#section-completed" />
        <KpiCard label="暂停中" value={paused} icon={PauseCircle} accent="rose" caption={`占总数 ${pct(paused)}% · 查看看板 →`} trend={-pct(paused)} index={3} href="/#section-paused" />
      </section>

      {/* —— 状态环形图 —— */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">状态分布</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <StatusDonut byStatus={overall.byStatus} total={total} />
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DONUT_COLORS).map(([k, c]) => (
                  <div key={k} className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
                      {k}
                    </div>
                    <div className="text-xs tabular-nums">
                      {overall.byStatus[k] ?? 0}
                      <span className="ml-1 text-muted-foreground">· {pct(overall.byStatus[k] ?? 0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* —— 分厂矩阵 —— */}
      <section>
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-end justify-between mb-4"
        >
          <div>
            <h2 className="text-xl font-semibold">分厂矩阵</h2>
            <p className="text-xs text-muted-foreground mt-1">点击任意分厂卡片，进入完整项目列表</p>
          </div>
        </motion.header>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {stats?.groups.map((g, i) => (
            <GroupCard key={g.key} group={g} href={groupHref(g.key)} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* —— 小型筛选器组件 —— */

function FilterSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-9 rounded-md border bg-background px-3 text-sm')}
    >
      {children}
    </select>
  );
}
