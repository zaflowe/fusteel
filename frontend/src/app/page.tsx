"use client";

import { useEffect, useState, useRef } from 'react';
import { useProjectStore, Project } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar, Activity, CheckCircle2, ChevronRight, Database, Clock, User, FileSpreadsheet, FileArchive } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { projects, loading, keyword, setKeyword, fetchProjects, completeProject, uploadExcel, exportExcel, exportAllFilesZip } = useProjectStore();
  const [searchInput, setSearchInput] = useState(keyword);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
  const pendingProjects = projects.filter(p => p.status === '待结项');
  const completedProjects = projects.filter(p => p.status === '已完成');

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
             <Database className="h-4 w-4 mr-2" /> 导入
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

          {/* 待结项项目 */}
          {(pendingProjects.length > 0 || searchInput) && (
            <section className="space-y-4 pt-2">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-500">
                <Clock className="h-5 w-5" />
                待结项 <span className="text-sm font-normal text-muted-foreground ml-1">({pendingProjects.length} 项，等待结项审批)</span>
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
                  暂无待结项的项目
                </div>
              )}
            </section>
          )}

          {/* 已完成归档 */}
          {completedProjects.length > 0 && (
            <section className="space-y-4 pt-2 border-t border-border/50">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-muted-foreground">
                 <CheckCircle2 className="h-5 w-5" />
                 已完成归档 <span className="text-sm font-normal ml-1">({completedProjects.length} 项)</span>
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
    </div>
  );
}

function ProjectCard({ project, isFocus = false, isPending = false, isCompleted = false, onComplete }: { 
  project: Project; 
  isFocus?: boolean; 
  isPending?: boolean;
  isCompleted?: boolean; 
  onComplete?: () => void;
}) {
  const router = useRouter();
  
  const bannerColor = isCompleted 
    ? 'bg-emerald-500/50' 
    : isPending 
      ? 'bg-amber-500' 
      : 'bg-blue-500';

  const statusBadgeClass = isCompleted
    ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
    : isPending
      ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
      : 'text-blue-500 border-blue-500/30 bg-blue-500/10';

  return (
    <Card 
      onClick={() => router.push(`/project/${project.id}`)}
      className={`group flex flex-col transition-all overflow-hidden relative cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${isPending ? 'border-amber-500/20' : 'hover:border-primary/50'}`}
    >
      <div className={`h-1.5 w-full ${bannerColor}`} />

      <CardHeader className="pb-3 px-5 pt-5 flex-1 cursor-pointer">
         <div className="flex justify-between items-start mb-2">
            <Badge variant="outline" className={`text-xs ${statusBadgeClass}`}>
              {project.status}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
         </div>
         <CardTitle className="text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {project.title}
         </CardTitle>
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
      
      <CardContent className="px-5 pb-4">
        <div className="flex flex-wrap gap-1.5 min-h-[32px] items-start">
           {project.tags.map(tag => (
             <Badge key={tag} variant="secondary" className="text-xs font-normal py-0 pb-0.5 px-2 bg-secondary/60 hover:bg-secondary">
               {tag}
             </Badge>
           ))}
        </div>
      </CardContent>

      {!isCompleted && onComplete && (
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
            {isPending ? '确认结项完成' : '打钩结项'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
