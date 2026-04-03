"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Check, X, Clock, HelpCircle, Activity, User, Save, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { siteConfig } from '@/config/site';
import Link from 'next/link';

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
  const [actions, setActions] = useState<any[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fetchActions = async () => {
    try {
      setLoadingActions(true);
      const res = await axios.get(`${API_URL}/ai_actions/pending`);
      setActions(res.data);
    } catch (error) {
      toast.error("获取待办动作失败");
    } finally {
      setLoadingActions(false);
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
    fetchActions();
    fetchHistory();
  }, []);

  const handleApprove = async (id: string, payload: any) => {
    try {
      await axios.post(`${API_URL}/ai_actions/${id}/approve`, payload);
      toast.success("审批通过，指令已执行！");
      fetchActions();
    } catch (error) {
      toast.error("审批失败");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/ai_actions/${id}`);
      toast.success("已驳回该建议动作");
      fetchActions();
    } catch (error) {
      toast.error("操作失败");
    }
  };

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

        {/* 右侧：调度决策中枢 */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-500" />
            调度干预动作
          </h2>
          
          {loadingActions ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border-2 border-dashed bg-muted/20">
               <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                 <Check className="h-8 w-8 text-emerald-500" />
               </div>
               <h3 className="text-lg font-semibold">当前暂无待办干预</h3>
               <p className="text-sm text-muted-foreground mt-1 max-w-xs">业务运转良好，暂无需介入的调度任务</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {actions.map((action) => (
                <ActionCard 
                  key={action.id} 
                  action={action} 
                  onApprove={(payload: any) => handleApprove(action.id, payload)}
                  onReject={() => handleReject(action.id)}
                />
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

function ActionCard({ action, onApprove, onReject }: any) {
  const [payload, setPayload] = useState(action.suggested_payload || {});

  const handlePayloadChange = (key: string, value: string) => {
    setPayload({ ...payload, [key]: value });
  };

  return (
    <Card className="border-indigo-500/20 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -z-10" />
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
             {action.action_type}
          </Badge>
          <div className="flex items-center text-xs text-muted-foreground">
             <Clock className="mr-1 h-3 w-3" /> 刚刚
          </div>
        </div>
        <CardTitle className="text-lg">
          {action.action_type === '新增里程碑' && '建议为本期项目追加新里程碑'}
          {action.action_type === '企微催收' && '建议向项目组发送企微催办卡片'}
        </CardTitle>
        <CardDescription className="flex items-center gap-1 mt-1">
          <HelpCircle className="h-3 w-3" />
          系统检测到目前进度异常，建议采取辅助措施。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="bg-secondary/30 p-4 rounded-lg space-y-3 border">
           <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">指令参数预设 (可自由修改)</h4>
           {Object.entries(payload).map(([key, value]: [string, any]) => (
             <div key={key} className="space-y-1.5">
               <Label className="text-xs font-medium text-foreground/70 capitalize">{key}</Label>
               <Input 
                 value={value} 
                 onChange={(e) => handlePayloadChange(key, e.target.value)} 
                 className="h-8 bg-background border-muted"
               />
             </div>
           ))}
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-3 pt-2 pb-5 px-6">
        <Button variant="outline" className="flex-1 border-destructive/20 text-destructive hover:bg-destructive hover:text-white" onClick={onReject}>
          <X className="mr-2 h-4 w-4" /> 忽略/驳回
        </Button>
        <Button className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-md shadow-indigo-500/20" onClick={() => onApprove(payload)}>
          <Check className="mr-2 h-4 w-4" /> 批准下发
        </Button>
      </CardFooter>
    </Card>
  );
}
