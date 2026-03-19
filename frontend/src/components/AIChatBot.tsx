"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, X, Send, Download } from "lucide-react";

export function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string | React.ReactNode }[]>([
    { role: 'assistant', content: "你好！总办管理员。我是全知 AI 管家。你可以让我帮你搜索项目，或者直接提取任意附件（比如：“把轧钢大棒的立项申请表给我”）" }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add User Message
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    
    // Mock AI Function Calling logic based on prompt
    setTimeout(() => {
      let aiResponse: string | React.ReactNode = "我已经收到您的指令。目前 AI 正在联调后端接口...";
      
      if (input.includes("立项申请表") || input.includes("文件") || input.includes("提取")) {
        // Render `<DownloadCard />` Component purely in chat stream
        aiResponse = (
          <div className="flex flex-col gap-2 mt-2">
            <span>为您找到该项目文件，请直接点击下载：</span>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-background shadow-sm hover:border-primary/50 transition-colors cursor-pointer group">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 bg-rose-500/10 rounded-md flex items-center justify-center">
                   <span className="text-rose-600 font-bold text-xs">PDF</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-sm font-medium group-hover:text-primary transition-colors">最新立项申请表_v2.pdf</span>
                   <span className="text-xs text-muted-foreground">3.2 MB • 随动提取</span>
                 </div>
               </div>
               <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary">
                 <Download className="h-4 w-4" />
               </Button>
            </div>
          </div>
        );
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    }, 1000);

    setInput("");
  };

  return (
    <>
      {/* Floating Button */}
      <div 
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
      >
        <div className="group relative">
           <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 opacity-70 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
           <button 
             onClick={() => setIsOpen(true)}
             className="relative h-14 w-14 rounded-full bg-background flex items-center justify-center text-primary shadow-2xl border hover:bg-secondary/50 transition-colors"
            >
             <Bot className="h-6 w-6 text-indigo-500" />
           </button>
        </div>
      </div>

      {/* Chat Window Panel */}
      <div 
        className={`fixed bottom-6 right-6 z-50 w-[380px] h-[580px] transition-all duration-300 origin-bottom-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <Card className="w-full h-full flex flex-col shadow-2xl border-indigo-500/20">
          <CardHeader className="p-4 border-b bg-secondary/30 flex flex-row items-center justify-between space-y-0 rounded-t-xl">
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                 <Bot className="h-4 w-4 text-white" />
               </div>
               <div>
                  <CardTitle className="text-md font-bold">全知 AI 助手</CardTitle>
                  <p className="text-xs text-muted-foreground">Function Calling Tool 即刻响应</p>
               </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
            <ScrollArea className="h-full w-full p-4">
               <div className="space-y-4 pb-4">
                 {messages.map((msg, idx) => (
                   <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     {msg.role === 'assistant' && (
                       <div className="h-8 w-8 rounded-full border border-indigo-500/30 bg-background flex items-center justify-center shrink-0 mt-1">
                         <Bot className="h-4 w-4 text-indigo-500" />
                       </div>
                     )}
                     
                     <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                       msg.role === 'user' 
                         ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                         : 'bg-secondary border rounded-tl-sm text-foreground/90'
                     }`}>
                       {msg.content}
                     </div>

                     {msg.role === 'user' && (
                       <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                         <User className="h-4 w-4 text-primary" />
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </ScrollArea>
          </CardContent>
          
          <CardFooter className="p-3 border-t bg-background rounded-b-xl">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex w-full items-center gap-2"
            >
              <Input 
                 placeholder="发号施令，例如“提取文件”" 
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 className="flex-1 border-muted focus-visible:ring-indigo-500/50 rounded-full bg-secondary/30"
              />
              <Button type="submit" size="icon" className="h-10 w-10 rounded-full shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
