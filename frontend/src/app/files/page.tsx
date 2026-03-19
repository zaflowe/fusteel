"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Image as ImageIcon, Filter, Download } from 'lucide-react';

export default function FilesGalleryPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // 模拟的图库数据
  const mockFiles = [
    { id: 1, name: '加热炉现场勘测.jpg', project: '加热炉改造', type: 'image', size: '2.4 MB', date: '2026-03-10' },
    { id: 2, name: '设备验收单据.pdf', project: '轧钢大棒产线', type: 'document', size: '1.1 MB', date: '2026-03-11' },
    { id: 3, name: '厂房图纸v2.dwg', project: '自动化控制中心', type: 'cad', size: '15.6 MB', date: '2026-03-08' },
    { id: 4, name: '涂层厂设备安装记录.docx', project: '涂层厂产线', type: 'document', size: '840 KB', date: '2026-03-09' },
    { id: 5, name: '竣工现场照片_01.png', project: '冷却床技改', type: 'image', size: '3.2 MB', date: '2026-03-05' },
    { id: 6, name: '竣工现场照片_02.png', project: '冷却床技改', type: 'image', size: '4.1 MB', date: '2026-03-05' },
  ];

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-6 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            智汇文件
          </h1>
          <p className="text-muted-foreground mt-1">这里汇总了所有项目中上传的开放性“碎片资料”与核心附件。</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="搜索文件名或后缀..." 
              className="pl-9 bg-secondary/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 图片瀑布流/网格展示区域 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4">
        {mockFiles.map((file) => (
          <Card key={file.id} className="group overflow-hidden border-border/50 hover:border-emerald-500/50 transition-all hover:shadow-md">
            {/* 模拟缩略图区域 */}
            <div className="h-40 bg-secondary/30 flex items-center justify-center relative overflow-hidden">
               {file.type === 'image' ? (
                 <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                   <ImageIcon className="h-12 w-12 text-emerald-500/50 group-hover:scale-110 transition-transform duration-500" />
                 </div>
               ) : (
                 <div className="text-4xl font-black text-muted-foreground/20 uppercase">
                    {file.name.split('.').pop()}
                 </div>
               )}
               
               {/* 悬浮操作遮罩 */}
               <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <Button variant="secondary" size="icon" className="rounded-full shadow-lg h-10 w-10">
                    <Download className="h-4 w-4" />
                  </Button>
               </div>
            </div>
            
            <CardContent className="p-4">
              <p className="font-medium text-sm truncate" title={file.name}>{file.name}</p>
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                 <span className="truncate max-w-[120px]" title={file.project}>{file.project}</span>
                 <span>{file.size}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
