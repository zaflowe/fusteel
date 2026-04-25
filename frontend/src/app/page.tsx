"use client";

import { useEffect, useState, useRef } from 'react';
import { useProjectStore, Project, ProjectSort, PriorityFilter } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Calendar, CheckCircle2, ChevronRight, Database, Clock, User, FileSpreadsheet, FileArchive, AlertCircle, FileUp, ArrowUpDown, Check, Gauge } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ProjectCycleBadge from '@/components/ProjectCycleBadge';
import LatestUpdateLine from '@/components/LatestUpdateLine';
import PriorityBadge from '@/components/PriorityBadge';
import PdfImportDialog from '@/components/PdfImportDialog';

// 排序下拉选项定义（与后端 sort 参数严格对齐）
const SORT_OPTIONS: { value: ProjectSort; label: string; hint?: string }[] = [
  { value: 'latest_update_desc', label: '最近固化 · 新→旧', hint: '默认' },
  { value: 'latest_update_asc',  label: '最近固化 · 旧→新', hint: '找僵尸项目' },
  { value: 'created_desc',       label: '立项时间 · 新→旧' },
  { value: 'created_asc',        label: '立项时间 · 旧→新' },
];

// ABC Tab 定义（空字符串 = "全部"，与后端 priority 参数保持一致）
const PRIORITY_TABS: { value: PriorityFilter; label: string; tone: string }[] = [
  { value: '',      label: '全部',      tone: 'border-border text-foreground' },
  { value: 'A',     label: 'A 类',      tone: 'border-red-500/70   text-red-600   bg-red-50' },
  { value: 'B',     label: 'B 类',      tone: 'border-amber-500/70 text-amber-600 bg-amber-50' },
  { value: 'C',     label: 'C 类',      tone: 'border-gray-400/70  text-gray-600  bg-gray-50' },
  { value: 'unset', label: '未定级',    tone: 'border-dashed border-gray-300 text-gray-500' },
];

export default function DashboardPage() {
  const {
    projects, loading, keyword, sort,
    priorityFilter, priorityStats,
    setKeyword, setSort, setPriorityFilter,
    fetchProjects, fetchPriorityStats,
    completeProject, uploadExcel, exportExcel, exportAllFilesZip,
    downloadAutoScoreCsv,
  } = useProjectStore();
  const [searchInput, setSearchInput] = useState(keyword);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label || '排序';

  useEffect(() => {
    fetchProjects();
    fetchPriorityStats();
  }, [fetchProjects, fetchPriorityStats]);

  const handleDownloadAutoScoreCsv = () => {
    toast.promise(downloadAutoScoreCsv(), {
      loading: '正在生成 ABC 自动打分草表...',
      success: 'CSV 已下载，可用 Excel 打开评审',
      error: '下载失败，请稍后重试',
    });
  };

  const tabCount = (v: PriorityFilter): number => {
    if (v === '')      return priorityStats.total;
    if (v === 'unset') return priorityStats.unset;
    return priorityStats[v] ?? 0;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.promise(uploadExcel(file), {
        loading: '正在解析并导入 Excel 数据 (防重执行中)...',
        success: '数据增量导入成功！',
        error: '导入失败，请检查文件格式或后端运行状态。',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportExcel = async () => {
    toast.promise(exportExcel(), {
      loading: '正在生成 Excel 报表...',
      success: 'Excel 导出成功！',
      error: '导出失败，请稍后重试。',
    });
  };

  const handleExportZip = async () => {
    toast.promise(exportAllFilesZip(), {
      loading: '正在打包所有项目文件（流式传输）...',
      success: 'ZIP 打包下载成功！',
      error: '打包失败，请检查文件状态。',
    });
  };

  // Three-state split
  const inProgressProjects = projects.filter(p => p.status === '实施中');
  const pendingProjects = projects.filter(p => p.status === '已完成');
  const completedProjects = projects.filter(p => p.status === '已结项');
  const pausedProjects = projects.filter(p => p.status === '暂停中');

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            项目调度中枢
          </h1>
          <p className="text-muted-foreground mt-1">富于学,钢于行</p>
        </div>
        
        <div className="flex w-full md:w-auto items-center gap-3 flex-wrap">
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <Button 
            type="button" 
            variant="outline"
            size="sm"
            className="border-primary/50 text-primary hover:bg-primary/10 shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
             <Database className="h-4 w-4 mr-2" /> 导入Excel
          </Button>

          <Button 
            type="button" 
            variant="outline"
            size="sm"
            className="border-rose-500/50 text-rose-600 hover:bg-rose-500/10 shrink-0"
            onClick={() => setPdfDialogOpen(true)}
          >
             <FileUp className="h-4 w-4 mr-2" /> 导入PDF
          </Button>

          <Button 
            type="button" 
            variant="outline"
            size="sm"
            className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 shrink-0"
            onClick={handleExportExcel}
          >
             <FileSpreadsheet className="h-4 w-4 mr-2" /> 导出Excel
          </Button>

          <Button 
            type="button" 
            variant="outline"
            size="sm"
            className="border-blue-500/50 text-blue-600 hover:bg-blue-500/10 shrink-0"
            onClick={handleExportZip}
          >
             <FileArchive className="h-4 w-4 mr-2" /> 打包下载
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-fuchsia-500/50 text-fuchsia-600 hover:bg-fuchsia-500/10 shrink-0"
            onClick={handleDownloadAutoScoreCsv}
            title="按规则自动给全部项目打 ABC 建议分，生成 CSV 草表供人工评审（不落库）"
          >
            <Gauge className="h-4 w-4 mr-2" /> ABC 打分草表
          </Button>

          {/* 项目排序下拉（Base UI 的 Menu.Trigger 不支持 asChild，直接挂 Button 样式） */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
              title={'按"最近固化时间 / 立项时间"调整项目展示顺序'}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              {currentSortLabel}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1 text-xs text-muted-foreground">项目排序方式</div>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    {opt.value === sort
                      ? <Check className="h-3.5 w-3.5 text-primary" />
                      : <span className="w-3.5" />}
                    {opt.label}
                  </span>
                  {opt.hint && (
                    <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <form onSubmit={handleSearch} className="flex relative w-full md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              type="search" 
              placeholder='搜索项目...' 
              className="pl-9 pr-4 rounded-full bg-secondary/50 border-transparent focus-visible:ring-primary/50 transition-all h-9 w-full"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>
        </div>
      </div>

      {/* ABC 分级 Tab 栏：一眼看清楚 80 个项目"要盯几个 A" */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground mr-1">按 ABC 过滤：</span>
        {PRIORITY_TABS.map(t => {
          const active = priorityFilter === t.value;
          const count = tabCount(t.value);
          return (
            <button
              key={t.value || 'all'}
              type="button"
              onClick={() => setPriorityFilter(t.value)}
              className={cn(
                'px-3 py-1 rounded-full border text-xs font-medium transition-all',
                active
                  ? `${t.tone} border-2 shadow-sm scale-[1.03]`
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
              title={
                t.value === ''
                  ? '显示全部项目'
                  : t.value === 'unset'
                    ? '只看尚未定级的项目（需要尽快评级）'
                    : `只看 ${t.label} 项目`
              }
            >
              {t.label}
              <span className={cn(
                'ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px]',
                active ? 'bg-white/70 text-current' : 'bg-muted-foreground/10',
              )}>
                {count}
              </span>
            </button>
          );
        })}
        {priorityStats.unset > 0 && priorityFilter !== 'unset' && (
          <span className="text-[11px] text-amber-600 ml-2">
            ⚠ 还有 {priorityStats.unset} 个项目未定级，建议先导出 CSV 批量评审
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* 实施中项目 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></div>
              实施中 <span className="text-sm font-normal text-muted-foreground ml-1">({inProgressProjects.length} 项)</span>
            </h2>
            {inProgressProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {inProgressProjects.map((project) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onComplete={() => completeProject(project.id)} 
                  />
                ))}
              </div>
            ) : (
              <div className="h-28 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground text-sm">
                暂无实施中的项目
              </div>
            )}
          </section>

          {/* 暂停中项目 */}
          {(pausedProjects.length > 0) && (
            <section className="space-y-4 pt-2">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-red-500">
                <AlertCircle className="h-5 w-5" />
                暂停中 <span className="text-sm font-normal text-muted-foreground ml-1">({pausedProjects.length} 项)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                {pausedProjects.map((project) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    isPaused
                  />
                ))}
              </div>
            </section>
          )}

          {/* 待结项项目 */}
          {(pendingProjects.length > 0 || searchInput) && (
            <section className="space-y-4 pt-2">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-500">
                <Clock className="h-5 w-5" />
                已完成 <span className="text-sm font-normal text-muted-foreground ml-1">({pendingProjects.length} 项，等待结项归档)</span>
              </h2>
              {pendingProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pendingProjects.map((project) => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      onComplete={() => completeProject(project.id)}
                      isPending
                    />
                  ))}
                </div>
              ) : (
                <div className="h-20 border-2 border-dashed border-amber-500/20 rounded-xl flex items-center justify-center text-muted-foreground text-sm">
                  暂无待归档的已完成项目
                </div>
              )}
            </section>
          )}

          {/* 已完成归档 */}
          {completedProjects.length > 0 && (
            <section className="space-y-4 pt-2 border-t border-border/50">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-muted-foreground">
                 <CheckCircle2 className="h-5 w-5" />
                 已结项归档 <span className="text-sm font-normal ml-1">({completedProjects.length} 项)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-70 hover:opacity-100 transition-opacity">
                {completedProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} isCompleted />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* PDF 批量导入弹窗 */}
      <PdfImportDialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen} />
    </div>
  );
}

function ProjectCard({ project, isFocus = false, isPending = false, isCompleted = false, isPaused = false, onComplete }: { 
  project: Project; 
  isFocus?: boolean; 
  isPending?: boolean;
  isCompleted?: boolean; 
  isPaused?: boolean;
  onComplete?: () => void;
}) {
  const router = useRouter();
  
  const bannerColor = isCompleted 
    ? 'bg-emerald-500/50' 
    : isPaused
      ? 'bg-red-500/50'
      : isPending 
        ? 'bg-amber-500' 
        : 'bg-blue-500';

  const statusBadgeClass = isCompleted
    ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
    : isPaused
      ? 'text-red-500 border-red-500/30 bg-red-500/10'
      : isPending
        ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
        : 'text-blue-500 border-blue-500/30 bg-blue-500/10';

  return (
    <Card 
      onClick={() => router.push(`/project/${project.id}`)}
      className={`group flex flex-col transition-all overflow-hidden relative cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${isPending ? 'border-amber-500/20' : isPaused ? 'border-red-500/20 opacity-80' : 'hover:border-primary/50'}`}
    >
      <div className={`h-1.5 w-full ${bannerColor}`} />

      <CardHeader className="pb-3 px-5 pt-5 flex-1 cursor-pointer">
         <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1.5">
              <PriorityBadge priority={project.priority} size="sm" />
              <Badge variant="outline" className={`text-xs ${statusBadgeClass}`}>
                {project.status}
              </Badge>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
         </div>
         <CardTitle className="text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {project.title}
         </CardTitle>
         {/* 项目周期胶囊 Badge */}
         <ProjectCycleBadge createdAt={project.created_at} endDate={project.end_date} compact />
         <CardDescription className="flex flex-col gap-1 mt-2 text-xs">
            {project.department && <span className="font-medium text-foreground/80">{project.department}</span>}
            {project.leader && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                负责人：{project.leader}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(project.created_at), 'yyyy/MM/dd')} 立项
            </span>
         </CardDescription>
      </CardHeader>
      
      <CardContent className="px-5 pb-4 space-y-2">
        <div className="flex flex-wrap gap-1.5 min-h-[32px] items-start">
           {project.tags.map(tag => (
             <Badge key={tag} variant="secondary" className="text-xs font-normal py-0 pb-0.5 px-2 bg-secondary/60 hover:bg-secondary">
               {tag}
             </Badge>
           ))}
        </div>
        {/* 最近一次项目固化（时间 · 汇报人 · 摘要）— 超期自动告警配色 */}
        <LatestUpdateLine
          latestAt={project.latest_update_at}
          summary={project.latest_update_summary}
          reporter={project.latest_update_reporter}
        />
      </CardContent>

      {!isCompleted && !isPaused && onComplete && (
        <CardFooter className="px-5 pb-5 pt-0 mt-auto">
          <Button 
            variant={"outline"} 
            className={`w-full justify-center h-9 text-xs ${isPending ? 'border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10' : 'group-hover:border-primary/40 group-hover:text-primary transition-colors'}`}
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> 
            {isPending ? '确认结项归档' : '打钩已完成'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
