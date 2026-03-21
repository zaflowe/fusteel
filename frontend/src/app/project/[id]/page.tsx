"use client";

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore, Project } from '@/store/projectStore';
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
  AlertCircle, History
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
  const [delayHistory, setDelayHistory] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newEndDate, setNewEndDate] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [updating, setUpdating] = useState(false);
  
  const { addTag, removeTag } = useProjectStore();

  // 获取延期历史
  const fetchDelayHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/projects/${id}/delay-history`);
      setDelayHistory(res.data);
    } catch (error) {
      console.error("获取延期历史失败", error);
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
    fetchDelayHistory();
  }, [id]);

  // 处理保存周期修改
  const handleSaveCycle = async () => {
    if (!newEndDate || !delayReason.trim()) {
      toast.error('请填写结项时间和延期原因');
      return;
    }
    
    setUpdating(true);
    try {
      await axios.put(`${API_URL}/projects/${id}`, {
        end_date: newEndDate,
        delay_reason: delayReason
      });
      toast.success('项目周期更新成功');
      setShowEditModal(false);
      setNewEndDate('');
      setDelayReason('');
      await fetchDetails();
      await fetchDelayHistory();
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
              {project.end_date && (
                <div 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    setNewEndDate(format(new Date(project.end_date!), 'yyyy-MM-dd'));
                    setShowEditModal(true);
                  }}
                  title="点击修改周期"
                >
                  <ProjectCycleBadge createdAt={project.created_at} endDate={project.end_date} compact />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-muted-foreground">
              <Badge variant="secondary">{project.department}</Badge>
              <StatusBadge status={project.status} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 flex items-center justify-center text-gray-500 font-mono text-xs font-bold">ID</div>
            <div>
              <div className="text-sm text-muted-foreground">项目编号</div>
              <div className="font-medium font-mono text-xs">
                {project.project_code || '未设置'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-sm text-muted-foreground">项目负责人</div>
              <div className="font-medium">{project.leader || '未指定'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-purple-500" />
            <div>
              <div className="text-sm text-muted-foreground">项目参与人员</div>
              <div className="font-medium">
                {project.participants?.length > 0 
                  ? project.participants.join('、') 
                  : '暂无参与人员'}
              </div>
            </div>
          </div>
        </div>

        {/* 项目周期编辑区域 */}
        <div className="mt-4 p-3 bg-secondary/30 rounded-lg flex items-center gap-2 flex-wrap">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground">项目周期：</span>
          {project.end_date ? (
            <>
              <span className="text-sm font-medium">
                {format(new Date(project.created_at), 'yyyy/MM/dd')} 至 {format(new Date(project.end_date), 'yyyy/MM/dd')}
              </span>
              {project.delay_reason && (
                <span className="text-orange-600 text-xs" title={project.delay_reason}>
                  （延期：{project.delay_reason.length > 20 ? project.delay_reason.slice(0, 20) + '…' : project.delay_reason}）
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">未设置结项时间</span>
          )}
          {/* 细微内联编辑图标 */}
          <button
            className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded px-1.5 py-0.5 hover:bg-primary/10"
            onClick={() => {
              setNewEndDate(project.end_date ? format(new Date(project.end_date), 'yyyy-MM-dd') : '');
              setShowEditModal(true);
            }}
            title="修改项目周期"
          >
            <Edit3 className="h-3 w-3" />
            <span>编辑</span>
          </button>
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

          {/* 右侧：历史记录（包含固化记录和周期变更） */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-muted-foreground">历史记录</h3>
            
            {/* 周期变更历史 */}
            {delayHistory.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  周期变更记录
                </h4>
                <div className="space-y-2">
                  {delayHistory.map((record, index) => (
                    <div 
                      key={record.id} 
                      className="flex items-start gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100"
                    >
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-xs font-medium text-orange-600">
                        {delayHistory.length - index}
                      </div>
                      <div className="flex-1 text-xs">
                        <div>
                          <span className="text-muted-foreground">原定</span>
                          <span className="font-medium mx-1">
                            {record.old_end_date 
                              ? format(new Date(record.old_end_date), 'yyyy/MM/dd') 
                              : '未设置'}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium mx-1 text-primary">
                            {format(new Date(record.new_end_date), 'yyyy/MM/dd')}
                          </span>
                        </div>
                        <div className="text-orange-600 mt-0.5">
                          原因：{record.reason}
                        </div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">
                          {format(new Date(record.created_at), 'yyyy-MM-dd HH:mm')} · {record.changed_by}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 固化记录时间轴 */}
            {updatesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>加载固化记录...</p>
              </div>
            ) : (
              <UpdateTimeline updates={updates} />
            )}
          </div>
        </div>
      </section>

      {/* 修改周期 Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              修改项目周期
            </DialogTitle>
            <DialogDescription>
              调整项目结项时间，系统将自动记录变更历史
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">
                新的结项时间 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delayReason">
                变更原因 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="delayReason"
                placeholder="请详细说明延期原因（必填）"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                修改周期必须填写原因，以便追溯变更记录
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    '实施中': {
      class: 'bg-blue-500 text-white',
      label: '实施中'
    },
    '待结项': {
      class: 'bg-amber-500 text-white',
      label: '待结项'
    },
    '已完成': {
      class: 'bg-emerald-500 text-white',
      label: '已完成'
    }
  };
  
  const { class: bgClass, label } = config[status] || config['实施中'];
  
  return (
    <Badge className={`${bgClass}`}>
      {label}
    </Badge>
  );
}