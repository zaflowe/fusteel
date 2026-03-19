"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Check, X, Clock, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = 'http://127.0.0.1:8000/api';

export default function AISchedulerPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/ai_actions/pending`);
      setActions(res.data);
    } catch (error) {
      toast.error("获取待办动作失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
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
    <div className="container mx-auto p-6 md:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI 调度审批中枢 (Human-in-the-loop)</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
           <div className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
             <Check className="h-10 w-10 text-emerald-500" />
           </div>
           <h3 className="text-xl font-semibold">当前暂无待办干预</h3>
           <p className="text-muted-foreground mt-2 max-w-sm">一切尽在 AI 掌控之中，无需人工界入</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {actions.map((action) => (
            <ActionCard 
              key={action.id} 
              action={action} 
              onApprove={(payload) => handleApprove(action.id, payload)}
              onReject={() => handleReject(action.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionCard({ action, onApprove, onReject }: any) {
  // 动态表单控制 (根据 AI payload)
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
          系统检测到目前进度滞缓，AI 认为有必要采取辅助措施。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="bg-secondary/30 p-4 rounded-lg space-y-3 border">
           <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payload 预设表单 (可自由修改)</h4>
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
        <Button className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20" onClick={() => onApprove(payload)}>
          <Check className="mr-2 h-4 w-4" /> 批准并下发
        </Button>
      </CardFooter>
    </Card>
  );
}
