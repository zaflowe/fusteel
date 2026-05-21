'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  Download,
  ChevronRight,
  LayoutGrid,
  Activity,
  CheckCircle2,
  PauseCircle,
  User,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  fetchDepartmentStats,
  fetchGroupProjects,
  exportStatsExcelUrl,
  DepartmentProjectItem,
  StatsBucket,
  StatsDimension,
  StatsRange,
  StatsQuery,
  completionRate,
} from '@/lib/departmentStats';
import StatusDonut, { DONUT_COLORS } from '@/components/departments/StatusDonut';
import KpiCard from '@/components/departments/KpiCard';

function GroupDetailInner() {
  const router = useRouter();
  const params = useParams<{ group: string }>();
  const searchParams = useSearchParams();
  const groupKey = decodeURIComponent(params.group);

  const dimension = (searchParams.get('dimension') || 'department') as StatsDimension;
  const range = (searchParams.get('range') || 'all') as StatsRange;
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
  const start = searchParams.get('start') || undefined;
  const end = searchParams.get('end') || undefined;
  const includeCompleted = searchParams.get('include_completed') !== 'false';

  const query: StatsQuery = { dimension, range, year, start, end, include_completed: includeCompleted };

  const [bucket, setBucket] = useState<StatsBucket | null>(null);
  const [projects, setProjects] = useState<DepartmentProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, list] = await Promise.all([
        fetchDepartmentStats(query),
        fetchGroupProjects(groupKey, query),
      ]);
      const g = statsRes.groups.find((x) => x.key === groupKey);
      setBucket(g ? { total: g.total, byStatus: g.byStatus, byYear: g.byYear } : null);
      setProjects(list);
    } catch {
      toast.error('加载分厂数据失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, searchParams]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    const a = document.createElement('a');
    a.href = exportStatsExcelUrl(query);
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('正在下载 Excel');
  };

  const filteredProjects = statusFilter ? projects.filter((p) => p.status === statusFilter) : projects;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total = bucket?.total ?? 0;
  const done = bucket?.byStatus['已结项'] ?? 0;
  const inProgress = bucket?.byStatus['实施中'] ?? 0;
  const paused = bucket?.byStatus['暂停中'] ?? 0;
  const rate = bucket ? completionRate(total, bucket.byStatus) : 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8 max-w-6xl">
      {/* —— 顶部 —— */}
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b pb-6"
      >
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/departments')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 返回部门统计
          </Button>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            {groupKey}
          </h1>
          <p className="text-sm text-muted-foreground">
            {bucket?.total ?? 0} 个项目 · 完成率 <span className="text-emerald-600 font-medium">{rate}%</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> 导出 Excel
        </Button>
      </motion.section>

      {/* —— KPI —— */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="项目总数" value={total} icon={LayoutGrid} accent="emerald" caption={`分厂占比 ${pct(total)}%`} index={0} />
        <KpiCard label="实施中" value={inProgress} icon={Activity} accent="blue" caption={`占本厂 ${pct(inProgress)}%`} trend={pct(inProgress)} index={1} />
        <KpiCard label="已结项" value={done} icon={CheckCircle2} accent="emerald" caption={`完成率 ${rate}%`} trend={rate} index={2} />
        <KpiCard label="暂停中" value={paused} icon={PauseCircle} accent="rose" caption={`占本厂 ${pct(paused)}%`} trend={-pct(paused)} index={3} />
      </section>

      {/* —— 状态环形 + 项目列表 —— */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">状态分布</CardTitle>
              <p className="text-xs text-muted-foreground">点击右侧图例可筛选项目</p>
            </CardHeader>
            <CardContent>
              {bucket && <StatusDonut byStatus={bucket.byStatus} total={total} />}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {Object.entries(DONUT_COLORS).map(([k, c]) => {
                  const active = statusFilter === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setStatusFilter(active ? '' : k)}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-2 border transition',
                        active ? 'bg-muted border-foreground/30' : 'bg-muted/30 hover:bg-muted/60',
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
                        {k}
                      </div>
                      <div className="text-xs tabular-nums">
                        {bucket?.byStatus[k] ?? 0}
                        <span className="ml-1 text-muted-foreground">· {pct(bucket?.byStatus[k] ?? 0)}%</span>
                      </div>
                    </button>
                  );
                })}
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter('')}
                    className="col-span-2 text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-lg border border-dashed"
                  >
                    清除状态筛选
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="lg:col-span-3"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">项目列表</CardTitle>
              <p className="text-xs text-muted-foreground">
                共 {filteredProjects.length} 项{statusFilter ? ` · 筛选：${statusFilter}` : ''}
              </p>
            </CardHeader>
            <CardContent className="divide-y">
              {filteredProjects.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">暂无项目</div>
              ) : (
                filteredProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/project/${p.id}`}
                    className="group flex items-center justify-between gap-3 py-3 px-2 rounded-md hover:bg-muted/50 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate group-hover:text-emerald-600 transition">{p.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-muted-foreground">#</span>
                          {p.project_code || '—'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {p.leader || '未指定'}
                        </span>
                        {p.created_at && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(p.created_at).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-[11px] px-2 py-1 rounded-full border tabular-nums"
                      style={{
                        color: DONUT_COLORS[p.status] || '#94a3b8',
                        borderColor: `${DONUT_COLORS[p.status] || '#94a3b8'}55`,
                        background: `${DONUT_COLORS[p.status] || '#94a3b8'}14`,
                      }}
                    >
                      {p.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </div>
  );
}

export default function DepartmentGroupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <GroupDetailInner />
    </Suspense>
  );
}
