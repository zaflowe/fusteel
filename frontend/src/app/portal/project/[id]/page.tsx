"use client";

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UploadCloud, FileText, ArrowLeft, X, 
  User, Users, Calendar, Trash2, Download, File, FileSpreadsheet, 
  Presentation, Loader2, Archive, Tag, Camera, LogOut, Clock,
  UserCheck, UserPlus, Edit3, AlertCircle, Wrench, Save
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import UpdateForm from '@/components/UpdateForm';
import UpdateTimeline from '@/components/UpdateTimeline';
import ProjectCycleBadge from '@/components/ProjectCycleBadge';
import FilePoolSection from '@/components/FilePoolSection';

const API_URL = '/api';

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

interface Project {
  id: string;
  title: string;
  department: string;
  leader?: string;
  participants?: string[];
  status: string;
  tags: string[];
  created_at: string;
  end_date?: string | null;
  delay_reason?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  proposer?: string | null;
  post_delivery_person?: string | null;
  current_problem?: string | null;
  technical_solution?: string | null;
}

export default function PortalProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<FileType | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  // 外部门户：交付后负责人编辑
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryDraft, setDeliveryDraft] = useState('');

  // 获取门户 token
  const getPortalToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('portal_token');
    }
    return null;
  };

  // 获取固化记录
  const fetchUpdates = async () => {
    const token = getPortalToken();
    if (!token) return;
    
    try {
      setUpdatesLoading(true);
      const res = await axios.get(`${API_URL}/portal/projects/${id}/updates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUpdates(res.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error("获取固化记录失败");
      }
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
    const token = getPortalToken();
    if (!token) {
      router.push('/portal');
      return;
    }
    
    try {
      setLoading(true);
      const [projRes, fileRes] = await Promise.all([
        axios.get(`${API_URL}/portal/projects/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/portal/projects/${id}/files`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setProject(projRes.data);
      setFiles(fileRes.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('登录已过期，请重新登录');
        handleLogout();
      } else if (error.response?.status === 403) {
        toast.error('无权访问该项目');
        router.push('/portal/dashboard');
      } else {
        toast.error("获取项目详情失败");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    fetchUpdates();
  }, [id]);

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

    const token = getPortalToken();
    if (!token) {
      toast.error('登录已过期');
      handleLogout();
      return;
    }

    setUploading(fileType);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);

    try {
      await axios.post(`${API_URL}/projects/${id}/files`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
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

  // 外部门户：保存"交付后负责人"
  const saveDeliveryPerson = async () => {
    const token = getPortalToken();
    if (!token) { handleLogout(); return; }
    try {
      const res = await axios.patch(
        `${API_URL}/portal/projects/${id}/delivery-person`,
        { post_delivery_person: deliveryDraft.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProject(res.data);
      toast.success('已更新交付后负责人');
      setEditingDelivery(false);
    } catch (error: any) {
      if (error.response?.status === 401) { handleLogout(); return; }
      toast.error(error.response?.data?.detail || '更新失败');
    }
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_project_ids');
    localStorage.removeItem('portal_user_name');
    router.push('/portal');
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
    <div className="min-h-screen bg-gray-50">
      {/* 门户顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/portal/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回项目列表
            </Button>
            <h1 className="text-lg font-semibold">{project.title}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> 退出登录
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* 项目基本信息 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{project.title}</h1>
                {(project.planned_end_date || project.end_date) && (
                  <ProjectCycleBadge
                    createdAt={project.planned_start_date || project.created_at}
                    endDate={project.planned_end_date || project.end_date!}
                    compact
                  />
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                <Badge variant="secondary">{project.department}</Badge>
                <StatusBadge status={project.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
            {/* Row1 */}
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 flex items-center justify-center text-gray-500 font-mono text-xs font-bold">ID</div>
              <div>
                <div className="text-sm text-muted-foreground">项目编号</div>
                <div className="font-medium font-mono text-xs">{project.id}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-blue-500" />
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">项目负责人</div>
                <div className="font-medium">{project.leader || '未指定'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-500" />
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">项目参与人员</div>
                <div className="font-medium truncate" title={project.participants?.join('、')}>
                  {project.participants && project.participants.length > 0 
                    ? project.participants.join('、') 
                    : '暂无参与人员'}
                </div>
              </div>
            </div>

            {/* Row2 */}
            {/* 交付后负责人：外部人员可编辑 */}
            <div className="flex items-center gap-3 group">
              <UserCheck className="h-5 w-5 text-emerald-500" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground flex items-center justify-between">
                  项目交付后负责人
                  {!editingDelivery && (
                    <Edit3
                      className="h-3 w-3 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-primary transition-opacity"
                      onClick={() => { setEditingDelivery(true); setDeliveryDraft(project.post_delivery_person || ''); }}
                    />
                  )}
                </div>
                {editingDelivery ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      autoFocus
                      className="h-7 text-xs px-2 flex-1"
                      value={deliveryDraft}
                      onChange={e => setDeliveryDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveDeliveryPerson(); if (e.key === 'Escape') setEditingDelivery(false); }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={saveDeliveryPerson}>
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingDelivery(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="font-medium">{project.post_delivery_person || '未指定'}</div>
                )}
              </div>
            </div>
            {/* 项目提出者：只读 */}
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-amber-500" />
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">项目提出者</div>
                <div className="font-medium">{project.proposer || '未指定'}</div>
              </div>
            </div>
            <div className="hidden md:block" />
          </div>

          {/* 项目周期区域（外部人员只读） */}
          <div className="mt-4 p-3 bg-secondary/30 rounded-lg flex items-center gap-4 flex-wrap">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">项目周期：</span>
            <span className="text-sm font-medium">
              {project.planned_start_date
                ? format(new Date(project.planned_start_date), 'yyyy/MM/dd')
                : '未设置'}
              <span className="mx-2 text-muted-foreground">—</span>
              {(project.planned_end_date || project.end_date)
                ? format(new Date(project.planned_end_date || project.end_date!), 'yyyy/MM/dd')
                : '未设置'}
            </span>
            {project.delay_reason && (
              <span className="text-orange-600 text-xs" title={project.delay_reason}>
                （最近变更原因：{project.delay_reason.length > 20 ? project.delay_reason.slice(0, 20) + '…' : project.delay_reason}）
              </span>
            )}
          </div>

          {/* 标签展示（只读） */}
          {project.tags && project.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-5 w-5 text-orange-500" />
                <span className="text-sm text-muted-foreground">项目标签</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="px-3 py-1">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
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

        {/* 现状问题 / 采取的措施（外部人员只读） */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                <CardTitle className="text-base">现状问题</CardTitle>
              </div>
              <CardDescription className="text-xs">来自立项申请表『目前存在的问题』</CardDescription>
            </CardHeader>
            <CardContent>
              {project.current_problem ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed min-h-[120px]">{project.current_problem}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic min-h-[120px] flex items-center justify-center">暂无内容</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-indigo-500" />
                <CardTitle className="text-base">采取的措施</CardTitle>
              </div>
              <CardDescription className="text-xs">来自立项申请表『解决的技术指标及主要方案』</CardDescription>
            </CardHeader>
            <CardContent>
              {project.technical_solution ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed min-h-[120px]">{project.technical_solution}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic min-h-[120px] flex items-center justify-center">暂无内容</p>
              )}
            </CardContent>
          </Card>
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

            {/* 右侧：时间轴展示 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-muted-foreground">历史记录</h3>
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
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    '实施中': { class: 'bg-blue-500 text-white', label: '实施中' },
    '已完成': { class: 'bg-amber-500 text-white', label: '已完成' },
    '已结项': { class: 'bg-emerald-500 text-white', label: '已结项' }
  };
  const { class: bgClass, label } = config[status] || config['实施中'];
  return <Badge className={`${bgClass}`}>{label}</Badge>;
}