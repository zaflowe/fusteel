"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Check, X, Clock, HelpCircle, Activity, User, Save, RefreshCw, Zap } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { siteConfig } from '@/config/site';
import Link from 'next/link';
import { format } from 'date-fns';
import type { GlobalChangeLog } from '@/store/projectStore';

const API_URL = '/api';

interface ProjectLogRemark {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface HistoryItem {
  id: string;
  project_id: string;
  project_title: string;
  reporter_name: string;
  content: string;
  image_urls: string[];
  remarks: ProjectLogRemark[];
  created_at: string;
}

export default function SchedulerPage() {
  const [changeLogs, setChangeLogs] = useState<GlobalChangeLog[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadingChangeLogs, setLoadingChangeLogs] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fetchChangeLogs = async () => {
    try {
      setLoadingChangeLogs(true);
      const res = await axios.get(`${API_URL}/change-logs?limit=100`);
      setChangeLogs(res.data);
    } catch (error) {
      toast.error("获取干预动作失败");
    } finally {
      setLoadingChangeLogs(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axios.get(`${API_URL}/history?limit=50`);
      setHistoryItems(res.data);
    } catch (error) {
      toast.error("获取历史固化记录失败");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchChangeLogs();
    fetchHistory();
  }, []);

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8 max-w-7xl">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{siteConfig.schedulerPage.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        
        {/* 左侧：项目固化历史流 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              项目固化历史流
            </h2>
            <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loadingHistory}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingHistory ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
          
          <div className="relative border-l-2 border-muted pl-6 space-y-10 py-2">
            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无历史固化记录</div>
            ) : (
              historyItems.map((item) => (
                <HistoryFeedItem key={item.id} item={item} onImageClick={setLightboxImage} />
              ))
            )}
          </div>
        </div>

        {/* 右侧：干预动作（统一变更记录流） */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500" />
              干预动作
            </h2>
            <Button variant="ghost" size="sm" onClick={fetchChangeLogs} disabled={loadingChangeLogs}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingChangeLogs ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
          <p className="text-xs text-muted-foreground -mt-4">
            统一汇总所有项目的字段编辑、标签、状态、文件、PDF 导入等留痕记录
          </p>

          {loadingChangeLogs ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : changeLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border-2 border-dashed bg-muted/20">
               <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                 <Check className="h-8 w-8 text-emerald-500" />
               </div>
               <h3 className="text-lg font-semibold">暂无干预动作</h3>
               <p className="text-sm text-muted-foreground mt-1 max-w-xs">目前没有任何项目被修改过，系统保持静默</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-muted pl-6 space-y-4 py-2">
              {changeLogs.map((log) => (
                <GlobalChangeLogItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>

      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <Button
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white"
              variant="ghost"
              size="icon"
              onClick={() => setLightboxImage(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            <img 
              src={lightboxImage} 
              alt="放大图片" 
              className="max-w-full max-h-[85vh] object-contain rounded-md"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryFeedItem({ item, onImageClick }: { item: HistoryItem, onImageClick: (url: string) => void }) {
  const [remarkInput, setRemarkInput] = useState("");
  const [savings, setSaving] = useState(false);
  const [remarksList, setRemarksList] = useState(item.remarks || []);

  const handleSaveRemark = async () => {
    if (!remarkInput.trim()) return;
    try {
      setSaving(true);
      const res = await axios.post(`${API_URL}/history/${item.id}/remarks`, { content: remarkInput });
      toast.success("备注发表成功");
      setRemarksList(prev => [...prev, res.data]);
      setRemarkInput("");
    } catch (err) {
      toast.error("备注保存失败");
    } finally {
      setSaving(false);
    }
  };

  const formattedTime = new Date(item.created_at).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="relative">
      {/* Timeline Dot */}
      <div className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-background bg-indigo-500 shadow-sm" />
      
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <Link 
              href={`/project/${item.project_id}`} 
              className="font-medium text-primary hover:underline"
            >
              {item.project_title}
            </Link>
            <span className="text-xs text-muted-foreground flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formattedTime}
            </span>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex items-center text-xs text-muted-foreground bg-muted/50 w-fit px-2 py-1 rounded">
            <User className="w-3 h-3 mr-1" />
            {item.reporter_name}
          </div>
          
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {item.content}
          </p>

          {item.image_urls && item.image_urls.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {item.image_urls.map((url, idx) => (
                <div 
                  key={idx} 
                  className="relative h-20 w-20 overflow-hidden rounded-md border cursor-pointer hover:opacity-90 transition-opacity bg-muted/30"
                  onClick={() => onImageClick(url)}
                >
                  <img
                    src={url}
                    alt={`现场图 ${idx}`}
                    loading="lazy"
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          )}

          {remarksList && remarksList.length > 0 && (
            <div className="mt-4 pt-3 border-t border-dashed space-y-2">
              {remarksList.map((r) => (
                <div key={r.id} className="text-sm bg-muted/30 p-2 rounded-md">
                  <span className="text-xs text-muted-foreground mr-2 font-mono">
                    {new Date(r.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-xs text-indigo-600 mr-2">{r.created_by}:</span>
                  <span className="text-foreground/80 break-words">{r.content}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="p-3 bg-muted/10 border-t flex items-center gap-2">
          <Input 
            placeholder="添加新备注..." 
            className="flex-1 h-8 text-xs bg-background focus-visible:ring-1"
            value={remarkInput}
            onChange={(e) => setRemarkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRemark();
            }}
          />
          <Button 
            size="sm" 
            variant="secondary" 
            className="h-8 text-xs px-3"
            onClick={handleSaveRemark}
            disabled={savings || !remarkInput.trim()}
          >
            {savings ? <div className="animate-spin border-Primary border-b-2 h-3 w-3 rounded-full mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            {savings ? '发送中' : '发送'}
          </Button>
        </CardFooter>
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
  priority_change: { label: 'ABC 定级', dot: 'bg-fuchsia-500', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600' },
};

function GlobalChangeLogItem({ log }: { log: GlobalChangeLog }) {
  const style = CHANGELOG_STYLE[log.action_type] || CHANGELOG_STYLE.field_edit;
  const time = format(new Date(log.created_at), 'yyyy-MM-dd HH:mm');
  return (
    <div className="relative">
      <div className={`absolute -left-[33px] top-2 h-4 w-4 rounded-full ${style.dot} border-2 border-background shadow-sm`} />
      <div className="bg-card border rounded-lg px-4 py-3 hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className={`${style.bg} ${style.text} border-0 shrink-0`}>
              {style.label}
            </Badge>
            <Link
              href={`/project/${log.project_id}`}
              className="text-sm font-medium text-primary hover:underline truncate"
              title={log.project_title}
            >
              {log.project_title}
            </Link>
          </div>
          <span className="text-xs text-muted-foreground flex items-center shrink-0">
            <Clock className="w-3 h-3 mr-1" />
            {time}
          </span>
        </div>
        <div className="text-sm leading-relaxed pl-1 break-words">
          {log.summary}
        </div>
      </div>
    </div>
  );
}
