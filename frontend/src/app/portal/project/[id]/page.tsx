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
  Presentation, Loader2, Archive, Tag, Camera, LogOut
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import UpdateForm from '@/components/UpdateForm';
import UpdateTimeline from '@/components/UpdateTimeline';

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
}

export default function PortalProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<FileType | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

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

  // 处理文件选择
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // 下载选中文件
  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0) {
      toast.error('请先选择要下载的文件');
      return;
    }

    setDownloading(true);
    try {
      const selectedIds = Array.from(selectedFiles);
      
      if (selectedIds.length === 1) {
        // 单文件直接下载
        const fileId = selectedIds[0];
        const response = await axios.get(`${API_URL}/files/${fileId}/download`, {
          responseType: 'blob'
        });
        
        const file = files.find(f => f.id === fileId);
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file?.original_name || '下载文件';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('✅ 文件下载成功');
      } else {
        // 多文件打包下载
        const response = await axios.post(`${API_URL}/files/download/batch`, selectedIds, {
          responseType: 'blob'
        });
        
        const blob = new Blob([response.data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `下载文件.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('✅ 批量下载成功');
      }
    } catch (error) {
      toast.error('❌ 下载失败：未找到文件');
    } finally {
      setDownloading(false);
    }
  };

  // 删除文件
  const handleDelete = async (fileId: string) => {
    try {
      await axios.delete(`${API_URL}/files/${fileId}`);
      toast.success('删除成功');
      const newSelected = new Set(selectedFiles);
      newSelected.delete(fileId);
      setSelectedFiles(newSelected);
      await fetchDetails();
    } catch (error) {
      toast.error('删除失败');
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
              <h1 className="text-2xl font-bold">{project.title}</h1>
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
                <div className="font-medium font-mono text-xs">{project.id}</div>
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
                  {project.participants && project.participants.length > 0 
                    ? project.participants.join('、') 
                    : '暂无参与人员'}
                </div>
              </div>
            </div>
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
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="h-6 w-6 text-primary" /> 
              项目资料池
            </h2>
            
            {selectedFiles.size > 0 && (
              <Button 
                onClick={handleDownloadSelected} 
                disabled={downloading}
                className="gap-2"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                下载选中文件 ({selectedFiles.size})
              </Button>
            )}
          </div>

          <Tabs defaultValue="application" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="application" className="gap-2">
                <FileText className="h-4 w-4" />
                立项申请表
                {filesByType.application.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{filesByType.application.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ppt" className="gap-2">
                <Presentation className="h-4 w-4" />
                结项 PPT
                {filesByType.ppt.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{filesByType.ppt.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="free_resource" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                自由资料池
                {filesByType.free_resource.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{filesByType.free_resource.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="application">
              <FileTypeSection
                title="立项申请表"
                description="上传项目的立项申请表（PDF格式），每个项目只能有一份"
                fileType="application"
                files={filesByType.application}
                accept=".pdf"
                uploading={uploading === 'application'}
                selectedFiles={selectedFiles}
                onToggleSelect={toggleFileSelection}
                onUpload={handleUpload}
                onDelete={handleDelete}
                formatFileSize={formatFileSize}
              />
            </TabsContent>

            <TabsContent value="ppt">
              <FileTypeSection
                title="结项 PPT"
                description="上传结项汇报PPT（PPT/PPTX格式），上传后将自动更新项目状态为待结项"
                fileType="ppt"
                files={filesByType.ppt}
                accept=".ppt,.pptx"
                uploading={uploading === 'ppt'}
                selectedFiles={selectedFiles}
                onToggleSelect={toggleFileSelection}
                onUpload={handleUpload}
                onDelete={handleDelete}
                formatFileSize={formatFileSize}
              />
            </TabsContent>

            <TabsContent value="free_resource">
              <FileTypeSection
                title="自由资料池"
                description="上传任意类型的辅助资料（照片、文档、表格等），可上传多份"
                fileType="free_resource"
                files={filesByType.free_resource}
                accept="*/*"
                uploading={uploading === 'free_resource'}
                selectedFiles={selectedFiles}
                onToggleSelect={toggleFileSelection}
                onUpload={handleUpload}
                onDelete={handleDelete}
                formatFileSize={formatFileSize}
                allowMultiple={true}
              />
            </TabsContent>
          </Tabs>
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

// 文件类型区块组件
interface FileTypeSectionProps {
  title: string;
  description: string;
  fileType: FileType;
  files: ProjectFile[];
  accept: string;
  uploading: boolean;
  selectedFiles: Set<string>;
  onToggleSelect: (fileId: string) => void;
  onUpload: (fileType: FileType, file: File) => void;
  onDelete: (fileId: string) => void;
  formatFileSize: (bytes: number) => string;
  allowMultiple?: boolean;
}

function FileTypeSection({
  title,
  description,
  fileType,
  files,
  accept,
  uploading,
  selectedFiles,
  onToggleSelect,
  onUpload,
  onDelete,
  formatFileSize,
  allowMultiple = false
}: FileTypeSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(fileType, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 上传区域 */}
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            uploading ? 'bg-primary/5 border-primary' : 'border-border hover:border-primary/50 hover:bg-secondary/50'
          }`}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
          />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">正在上传...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">点击上传文件</span>
              <span className="text-xs text-muted-foreground">
                支持格式: {accept === '*/*' ? '任意文件' : accept}
              </span>
            </div>
          )}
        </div>

        {/* 文件列表 */}
        {files.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-muted-foreground">共 {files.length} 个文件</span>
            </div>
            
            {files.map((file) => (
              <div 
                key={file.id} 
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <Checkbox 
                  checked={selectedFiles.has(file.id)}
                  onCheckedChange={() => onToggleSelect(file.id)}
                />
                
                <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.original_name}</div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>•</span>
                    <span>{format(new Date(file.uploaded_at), 'yyyy-MM-dd HH:mm')}</span>
                    <span>•</span>
                    <span>{file.uploaded_by}</span>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(file.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            暂无文件，请点击上方上传
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    '实施中': { class: 'bg-blue-500 text-white', label: '实施中' },
    '待结项': { class: 'bg-amber-500 text-white', label: '待结项' },
    '已完成': { class: 'bg-emerald-500 text-white', label: '已完成' }
  };
  const { class: bgClass, label } = config[status] || config['实施中'];
  return <Badge className={`${bgClass}`}>{label}</Badge>;
}