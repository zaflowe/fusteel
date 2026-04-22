"use client";

import { useEffect, useState, use, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore, Project, ProjectChangeLog } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UploadCloud, FileText, CheckCircle2, ArrowLeft, Plus, X, 
  User, Users, Calendar, Trash2, Download, File, FileSpreadsheet, 
  Presentation, Loader2, Archive, Tag, Camera, Edit3, Clock,
  AlertCircle, History, UserCheck, UserPlus, Activity, Save,
  Wrench, Lightbulb
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import UpdateForm from '@/components/UpdateForm';
import UpdateTimeline from '@/components/UpdateTimeline';
import ProjectCycleBadge from '@/components/ProjectCycleBadge';
import FilePoolSection from '@/components/FilePoolSection';

const API_URL = '/api';

// 文件类型定义
type FileType = 'application' | 'ppt' | 'free_resource';

interface ProjectFile {
  id: string;
  project_id: string;
  file_type: FileType;
  storage_path: string;
  original_name: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<FileType | null>(null);
  const [newTag, setNewTag] = useState('');
  const [managingTags, setManagingTags] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [changeLogs, setChangeLogs] = useState<ProjectChangeLog[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newEndDate, setNewEndDate] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [updating, setUpdating] = useState(false);

  // 内联编辑的字段类型：覆盖负责人/参与人员/交付后负责人/提出者 + 开始时间
  type InlineField = 'leader' | 'participants' | 'post_delivery_person' | 'proposer' | 'planned_start_date';
  const [editingField, setEditingField] = useState<InlineField | null>(null);
  const [editValue, setEditValue] = useState('');

  // 现状问题 / 采取的措施：整块文本框编辑
  type TextBlockField = 'current_problem' | 'technical_solution';
  const [editingBlock, setEditingBlock] = useState<TextBlockField | null>(null);
  const [blockDraft, setBlockDraft] = useState('');
  
  const { addTag, removeTag, updateProject } = useProjectStore();

  const handleInlineSave = async () => {
    if (!editingField) return;
    try {
      const v = editValue.trim();
      if (editingField === 'leader') {
        await updateProject(id, { leader: v });
      } else if (editingField === 'participants') {
        const parts = editValue.split(/[,，、\s]+/).filter(Boolean);
        await updateProject(id, { participants: parts });
      } else if (editingField === 'post_delivery_person') {
        await updateProject(id, { post_delivery_person: v });
      } else if (editingField === 'proposer') {
        await updateProject(id, { proposer: v });
      } else if (editingField === 'planned_start_date') {
        // 日期：空串 → 清空
        await updateProject(id, { planned_start_date: v ? new Date(v).toISOString() : null } as any);
      }
      toast.success('已保存');
      await fetchDetails();
      await fetchChangeLogs();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '更新失败');
    } finally {
      setEditingField(null);
    }
  };

  const handleBlockSave = async () => {
    if (!editingBlock) return;
    try {
      await updateProject(id, { [editingBlock]: blockDraft } as any);
      toast.success('已保存');
      await fetchDetails();
      await fetchChangeLogs();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '保存失败');
    } finally {
      setEditingBlock(null);
    }
  };

  // 获取变更记录（干预动作）
  const fetchChangeLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/projects/${id}/change-logs`);
      setChangeLogs(res.data);
    } catch (error) {
      console.error("获取变更记录失败", error);
    }
  };

  // 获取固化记录
  const fetchUpdates = async () => {
    try {
      setUpdatesLoading(true);
      const res = await axios.get(`${API_URL}/projects/${id}/updates`);
      setUpdates(res.data);
    } catch (error) {
      toast.error("获取固化记录失败");
    } finally {
      setUpdatesLoading(false);
    }
  };

  // 处理汇报提交成功
  const handleUpdateSubmitted = () => {
    fetchUpdates();
    toast.success('固化记录提交成功');
  };

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [projRes, fileRes] = await Promise.all([
        axios.get(`${API_URL}/projects/${id}`),
        axios.get(`${API_URL}/projects/${id}/files`)
      ]);
      setProject(projRes.data);
      setFiles(fileRes.data);
    } catch (error) {
      toast.error("获取项目详情失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    fetchUpdates();
    fetchChangeLogs();
  }, [id]);

  // 处理保存项目结束时间（需要原因）
  const handleSaveCycle = async () => {
    if (!newEndDate || !delayReason.trim()) {
      toast.error('请填写项目结束时间和变更原因');
      return;
    }
    
    setUpdating(true);
    try {
      await axios.put(`${API_URL}/projects/${id}`, {
        planned_end_date: newEndDate,
        delay_reason: delayReason
      });
      toast.success('项目结束时间已更新');
      setShowEditModal(false);
      setNewEndDate('');
      setDelayReason('');
      await fetchDetails();
      await fetchChangeLogs();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '更新失败');
    } finally {
      setUpdating(false);
    }
  };

  // 按类型分组文件
  const filesByType = {
    application: files.filter(f => f.file_type === 'application'),
    ppt: files.filter(f => f.file_type === 'ppt'),
    free_resource: files.filter(f => f.file_type === 'free_resource')
  };

  // 处理文件上传
  const handleUpload = async (fileType: FileType, file: File) => {
    // 验证文件类型
    if (fileType === 'application' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('立项申请表只接受 PDF 文件');
      return;
    }
    if (fileType === 'ppt' && !file.name.toLowerCase().match(/\.(ppt|pptx)$/)) {
      toast.error('结项PPT只接受 PPT/PPTX 文件');
      return;
    }

    setUploading(fileType);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);

    try {
      await axios.post(`${API_URL}/projects/${id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('上传成功！');
      await fetchDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '上传失败');
    } finally {
      setUploading(null);
    }
  };

  // 处理文件下载
  const handleDownloadSingle = async (fileId: string, originalName: string) => {
    try {
      const response = await axios.get(`${API_URL}/files/${fileId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('✅ 文件下载成功');
    } catch (error) {
      toast.error('❌ 下载失败');
    }
  };

  // 删除文件
  const handleDelete = async (fileId: string) => {
    try {
      await axios.delete(`${API_URL}/files/${fileId}`);
      toast.success('删除成功');
      await fetchDetails();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">加载中...</div>;
  if (!project) return <div className="p-8 text-center text-destructive">未找到项目信息</div>;

  return (
    <div className="container mx-auto p-6 md:p-10 space-y-8 max-w-6xl">
      {/* 返回按钮 */}
      <Button variant="outline" className="mb-4" onClick={() => router.push('/')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> 返回看板
      </Button>

      {/* 项目基本信息 */}
      <div className="bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{project.title}</h1>
              {/* 周期状态标签 - 显示在项目名称右侧 */}
              {(project.planned_end_date || project.end_date) && (
                <div 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    const raw = project.planned_end_date || project.end_date!;
                    setNewEndDate(format(new Date(raw), 'yyyy-MM-dd'));
                    setShowEditModal(true);
                  }}
                  title="点击修改项目结束时间"
                >
                  <ProjectCycleBadge 
                    createdAt={project.planned_start_date || project.created_at} 
                    endDate={project.planned_end_date || project.end_date!} 
                    compact 
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-muted-foreground flex-wrap">
              <Badge variant="secondary">{project.department}</Badge>
              <StatusBadge status={project.status} />
              
              <div className="flex gap-2 ml-2">
                {project.status !== '暂停中' ? (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={async () => {
                    await addTag(project.id, '#暂停');
                    toast.success('项目已暂停');
                    fetchDetails();
                  }}>强制暂停</Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50" onClick={async () => {
                    await addTag(project.id, '#实施中');
                    toast.success('项目恢复实施');
                    fetchDetails();
                  }}>恢复实施</Button>
                )}
                {project.status !== '已结项' && project.status !== '已完成' && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs border-amber-200 text-amber-600 hover:bg-amber-50" onClick={async () => {
                    await addTag(project.id, '#已完成');
                    toast.success('项目已标记为完成，等待后续归档');
                    fetchDetails();
                  }}>标记为已完成</Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 人员信息：2 行 x 3 列 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          {/* Row1 col1: 项目编号 */}
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 flex items-center justify-center text-gray-500 font-mono text-xs font-bold">ID</div>
            <div>
              <div className="text-sm text-muted-foreground">项目编号</div>
              <div className="font-medium font-mono text-xs">
                {project.project_code || '未设置'}
              </div>
            </div>
          </div>
          {/* Row1 col2: 项目负责人 */}
          <InlinePersonField
            icon={<User className="h-5 w-5 text-blue-500 flex-shrink-0" />}
            label="项目负责人"
            value={project.leader || ''}
            placeholder="未指定"
            editing={editingField === 'leader'}
            editValue={editValue}
            onEditStart={() => { setEditingField('leader'); setEditValue(project.leader || ''); }}
            onEditValueChange={setEditValue}
            onSave={handleInlineSave}
          />
          {/* Row1 col3: 项目参与人员 */}
          <InlinePersonField
            icon={<Users className="h-5 w-5 text-purple-500 flex-shrink-0" />}
            label="项目参与人员"
            value={(project.participants && project.participants.length > 0) ? project.participants.join('、') : ''}
            placeholder="暂无参与人员"
            editing={editingField === 'participants'}
            editValue={editValue}
            editPlaceholder="逗号或空格分隔"
            onEditStart={() => { setEditingField('participants'); setEditValue((project.participants || []).join(', ')); }}
            onEditValueChange={setEditValue}
            onSave={handleInlineSave}
          />
          {/* Row2 col1: 项目交付后负责人 */}
          <InlinePersonField
            icon={<UserCheck className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
            label="项目交付后负责人"
            value={project.post_delivery_person || ''}
            placeholder="未指定"
            editing={editingField === 'post_delivery_person'}
            editValue={editValue}
            onEditStart={() => { setEditingField('post_delivery_person'); setEditValue(project.post_delivery_person || ''); }}
            onEditValueChange={setEditValue}
            onSave={handleInlineSave}
          />
          {/* Row2 col2: 项目提出者 */}
          <InlinePersonField
            icon={<UserPlus className="h-5 w-5 text-amber-500 flex-shrink-0" />}
            label="项目提出者"
            value={project.proposer || ''}
            placeholder="未指定"
            editing={editingField === 'proposer'}
            editValue={editValue}
            onEditStart={() => { setEditingField('proposer'); setEditValue(project.proposer || ''); }}
            onEditValueChange={setEditValue}
            onSave={handleInlineSave}
          />
          {/* Row2 col3: 留白 */}
          <div className="hidden md:block" />
        </div>

        {/* 项目周期编辑区域：开始时间（内联编辑）+ 结束时间（弹窗） */}
        <div className="mt-4 p-3 bg-secondary/30 rounded-lg flex items-center gap-4 flex-wrap">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">项目周期：</span>

          {/* 开始时间 */}
          <div className="inline-flex items-center gap-1">
            <span className="text-xs text-muted-foreground">开始</span>
            {editingField === 'planned_start_date' ? (
              <Input
                type="date"
                autoFocus
                className="h-7 w-36 text-xs px-2"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleInlineSave}
                onKeyDown={e => e.key === 'Enter' && handleInlineSave()}
              />
            ) : (
              <button
                className="text-sm font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => {
                  setEditingField('planned_start_date');
                  setEditValue(project.planned_start_date
                    ? format(new Date(project.planned_start_date), 'yyyy-MM-dd')
                    : '');
                }}
                title="点击修改项目开始时间"
              >
                {project.planned_start_date
                  ? format(new Date(project.planned_start_date), 'yyyy/MM/dd')
                  : <span className="text-muted-foreground">未设置</span>}
                <Edit3 className="h-3 w-3 opacity-60" />
              </button>
            )}
          </div>

          <span className="text-muted-foreground">—</span>

          {/* 结束时间 */}
          <div className="inline-flex items-center gap-1">
            <span className="text-xs text-muted-foreground">结束</span>
            {(() => {
              const endRaw = project.planned_end_date || project.end_date;
              return (
                <button
                  className="text-sm font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={() => {
                    setNewEndDate(endRaw ? format(new Date(endRaw), 'yyyy-MM-dd') : '');
                    setShowEditModal(true);
                  }}
                  title="修改项目结束时间（需原因）"
                >
                  {endRaw
                    ? format(new Date(endRaw), 'yyyy/MM/dd')
                    : <span className="text-muted-foreground">未设置</span>}
                  <Edit3 className="h-3 w-3 opacity-60" />
                </button>
              );
            })()}
          </div>

          {project.delay_reason && (
            <span className="text-orange-600 text-xs" title={project.delay_reason}>
              （最近变更原因：{project.delay_reason.length > 20 ? project.delay_reason.slice(0, 20) + '…' : project.delay_reason}）
            </span>
          )}
        </div>

        {/* 标签管理区域 */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">项目标签</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setManagingTags(!managingTags)}
            >
              {managingTags ? '完成' : '管理标签'}
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            {project.tags?.length > 0 ? (
              project.tags.map((tag) => (
                <Badge 
                  key={tag} 
                  variant="secondary"
                  className="flex items-center gap-1 px-3 py-1"
                >
                  {tag}
                  {managingTags && (
                    <button
                      onClick={async () => {
                        try {
                          await removeTag(project.id, tag);
                          toast.success('标签已删除');
                          await fetchDetails();
                        } catch (error: any) {
                          toast.error(error.response?.data?.detail || '删除失败');
                        }
                      }}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">暂无标签</span>
            )}
            
            {managingTags && (
              <div className="flex items-center gap-2 ml-2">
                <Input
                  placeholder="输入标签按回车"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      try {
                        await addTag(project.id, newTag.trim());
                        toast.success('标签已添加');
                        setNewTag('');
                        await fetchDetails();
                      } catch (error: any) {
                        toast.error(error.response?.data?.detail || '添加失败');
                      }
                    }
                  }}
                  className="w-40 h-8 text-sm"
                />
              </div>
            )}
          </div>
          
          {managingTags && (
            <p className="text-xs text-muted-foreground mt-2">
              提示：输入标签名称按回车添加，点击标签上的 × 删除
            </p>
          )}
        </div>
      </div>

      {/* 资料池区块 */}
      <section className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" /> 
            项目资料池
          </h2>
        </div>
        <FilePoolSection 
          files={files} 
          uploadingType={uploading} 
          onUpload={handleUpload} 
          onDownload={handleDownloadSingle} 
          onDelete={handleDelete} 
        />
      </section>

      {/* 现状问题 / 采取的措施 */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EditableTextCard
          icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
          title="现状问题"
          helpText="来自立项申请表『目前存在的问题』"
          value={project.current_problem || ''}
          editing={editingBlock === 'current_problem'}
          draft={blockDraft}
          onEditStart={() => { setEditingBlock('current_problem'); setBlockDraft(project.current_problem || ''); }}
          onDraftChange={setBlockDraft}
          onSave={handleBlockSave}
          onCancel={() => setEditingBlock(null)}
        />
        <EditableTextCard
          icon={<Wrench className="h-5 w-5 text-indigo-500" />}
          title="采取的措施"
          helpText="来自立项申请表『解决的技术指标及主要方案』"
          value={project.technical_solution || ''}
          editing={editingBlock === 'technical_solution'}
          draft={blockDraft}
          onEditStart={() => { setEditingBlock('technical_solution'); setBlockDraft(project.technical_solution || ''); }}
          onDraftChange={setBlockDraft}
          onSave={handleBlockSave}
          onCancel={() => setEditingBlock(null)}
        />
      </section>

      {/* 项目固化记录区块 */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" /> 
            项目固化记录
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：提交固化记录表单 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-muted-foreground">提交新记录</h3>
            <UpdateForm 
              projectId={id} 
              onSuccess={handleUpdateSubmitted} 
            />
          </div>

          {/* 右侧：统一时间轴（固化记录 + 变更记录） */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-muted-foreground">历史记录</h3>
            <p className="text-xs text-muted-foreground">
              包含项目的『固化记录』与所有的『干预动作（字段编辑、标签、状态、文件、PDF 导入等）』
            </p>
            {updatesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>加载历史记录...</p>
              </div>
            ) : (
              <MergedTimeline updates={updates} changeLogs={changeLogs} />
            )}
          </div>
        </div>
      </section>

      {/* 修改项目结束时间 Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              修改项目结束时间
            </DialogTitle>
            <DialogDescription>
              调整项目结束时间必须填写变更原因，系统会自动记录到干预动作
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">
                新的项目结束时间 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delayReason">
                变更原因 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="delayReason"
                placeholder="请详细说明变更原因（必填）"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                修改结束时间必须填写原因，以便追溯变更记录
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setNewEndDate('');
                setDelayReason('');
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveCycle}
              disabled={updating || !newEndDate || !delayReason.trim()}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存修改'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InlinePersonField({
  icon, label, value, placeholder = '',
  editing, editValue, editPlaceholder,
  onEditStart, onEditValueChange, onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder?: string;
  editing: boolean;
  editValue: string;
  editPlaceholder?: string;
  onEditStart: () => void;
  onEditValueChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 group">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground flex items-center justify-between">
          {label}
          {!editing && (
            <Edit3
              className="h-3 w-3 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-primary transition-opacity"
              onClick={onEditStart}
            />
          )}
        </div>
        {editing ? (
          <div className="flex items-center gap-1 mt-1">
            <Input
              autoFocus
              className="h-7 text-xs px-2"
              value={editValue}
              placeholder={editPlaceholder}
              onChange={e => onEditValueChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSave()}
              onBlur={onSave}
            />
          </div>
        ) : (
          <div className="font-medium line-clamp-2 truncate" title={value}>
            {value || <span className="text-muted-foreground">{placeholder}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function EditableTextCard({
  icon, title, helpText, value, editing, draft,
  onEditStart, onDraftChange, onSave, onCancel,
}: {
  icon: React.ReactNode;
  title: string;
  helpText?: string;
  value: string;
  editing: boolean;
  draft: string;
  onEditStart: () => void;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {!editing ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEditStart}>
              <Edit3 className="h-3 w-3 mr-1" /> 编辑
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCancel}>
                <X className="h-3 w-3 mr-1" /> 取消
              </Button>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={onSave}>
                <Save className="h-3 w-3 mr-1" /> 保存
              </Button>
            </div>
          )}
        </div>
        {helpText && <CardDescription className="text-xs">{helpText}</CardDescription>}
      </CardHeader>
      <CardContent>
        {editing ? (
          <Textarea
            autoFocus
            className="min-h-[140px] text-sm"
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            placeholder="请输入内容..."
          />
        ) : value ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed min-h-[120px]">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic min-h-[120px] flex items-center justify-center">
            暂无内容，点击右上角"编辑"补充
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// 合并 固化记录(updates) + 干预动作(changeLogs) 到一条时间轴
function MergedTimeline({
  updates, changeLogs,
}: {
  updates: any[];
  changeLogs: ProjectChangeLog[];
}) {
  type Item =
    | { kind: 'update'; at: number; raw: any }
    | { kind: 'change'; at: number; raw: ProjectChangeLog };

  const items: Item[] = useMemo(() => {
    const us: Item[] = (updates || []).map((u: any) => ({
      kind: 'update', at: new Date(u.created_at).getTime(), raw: u,
    }));
    const cs: Item[] = (changeLogs || []).map((c) => ({
      kind: 'change', at: new Date(c.created_at).getTime(), raw: c,
    }));
    return [...us, ...cs].sort((a, b) => b.at - a.at);
  }, [updates, changeLogs]);

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground py-6 text-center">暂无历史记录</div>;
  }

  return (
    <div className="relative border-l-2 border-muted pl-5 space-y-4 py-2">
      {items.map((it) => it.kind === 'update'
        ? <UpdateCard key={`u-${it.raw.id}`} item={it.raw} />
        : <ChangeLogCard key={`c-${it.raw.id}`} item={it.raw} />
      )}
    </div>
  );
}

function UpdateCard({ item }: { item: any }) {
  const time = format(new Date(item.created_at), 'yyyy-MM-dd HH:mm');
  return (
    <div className="relative">
      <div className="absolute -left-[26px] top-2 h-3 w-3 rounded-full bg-indigo-500 border-2 border-background" />
      <Card className="shadow-sm">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-0">固化记录</Badge>
            <span className="text-[10px] text-muted-foreground">{time}</span>
          </div>
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            <User className="inline w-3 h-3 mr-1" />{item.reporter_name}
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.content}</p>
          {item.image_urls && item.image_urls.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {item.image_urls.map((url: string, idx: number) => (
                <img key={idx} src={url} alt="" className="h-16 w-16 object-cover rounded border" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const CHANGELOG_STYLE: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  field_edit:    { label: '字段编辑', dot: 'bg-sky-500',      bg: 'bg-sky-500/10',     text: 'text-sky-600' },
  date_edit:     { label: '开始时间', dot: 'bg-blue-500',     bg: 'bg-blue-500/10',    text: 'text-blue-600' },
  date_delay:    { label: '结束时间', dot: 'bg-orange-500',   bg: 'bg-orange-500/10',  text: 'text-orange-600' },
  tag_add:       { label: '新增标签', dot: 'bg-emerald-500',  bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  tag_remove:    { label: '删除标签', dot: 'bg-rose-500',     bg: 'bg-rose-500/10',    text: 'text-rose-600' },
  status_change: { label: '状态变更', dot: 'bg-purple-500',   bg: 'bg-purple-500/10',  text: 'text-purple-600' },
  file_upload:   { label: '上传文件', dot: 'bg-teal-500',     bg: 'bg-teal-500/10',    text: 'text-teal-600' },
  file_delete:   { label: '删除文件', dot: 'bg-red-500',      bg: 'bg-red-500/10',     text: 'text-red-600' },
  pdf_import:    { label: 'PDF 导入', dot: 'bg-indigo-500',   bg: 'bg-indigo-500/10',  text: 'text-indigo-600' },
  portal_edit:   { label: '门户修改', dot: 'bg-cyan-500',     bg: 'bg-cyan-500/10',    text: 'text-cyan-600' },
};

function ChangeLogCard({ item }: { item: ProjectChangeLog }) {
  const time = format(new Date(item.created_at), 'yyyy-MM-dd HH:mm');
  const style = CHANGELOG_STYLE[item.action_type] || CHANGELOG_STYLE.field_edit;
  return (
    <div className="relative">
      <div className={`absolute -left-[26px] top-2 h-3 w-3 rounded-full ${style.dot} border-2 border-background`} />
      <div className="bg-card border rounded-lg px-3 py-2 flex items-start gap-2">
        <Badge variant="secondary" className={`${style.bg} ${style.text} border-0 shrink-0`}>
          {style.label}
        </Badge>
        <div className="flex-1 text-sm">
          <div className="leading-relaxed">{item.summary}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{time}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    '实施中': {
      class: 'bg-blue-500 text-white',
      label: '实施中'
    },
    '已完成': {
      class: 'bg-amber-500 text-white',
      label: '已完成'
    },
    '已结项': {
      class: 'bg-emerald-500 text-white',
      label: '已结项'
    },
    '暂停中': {
      class: 'bg-red-500 text-white',
      label: '暂停中'
    }
  };
  
  const { class: bgClass, label } = config[status] || config['实施中'];
  
  return (
    <Badge className={`${bgClass}`}>
      {label}
    </Badge>
  );
}