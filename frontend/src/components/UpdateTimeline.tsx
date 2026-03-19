"use client";

import { useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Clock, Image as ImageIcon, X } from 'lucide-react';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

const API_URL = '';

interface ProjectUpdate {
  id: string;
  project_id: string;
  reporter_name: string;
  content: string;
  image_urls: string[];
  created_at: string;
}

interface UpdateTimelineProps {
  updates: ProjectUpdate[];
}

export default function UpdateTimeline({ updates }: UpdateTimelineProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<{ src: string }[]>([]);

  if (!updates || updates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
        <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p>暂无固化记录</p>
        <p className="text-sm mt-1">提交第一条进展汇报后将在此显示</p>
      </div>
    );
  }

  // 打开图片灯箱
  const openLightbox = (imageUrls: string[], startIndex: number) => {
    const slides = imageUrls.map(url => ({
      src: url.startsWith('http') ? url : `${API_URL}${url}`
    }));
    setLightboxImages(slides);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        进展时间轴
        <Badge variant="secondary" className="ml-2">{updates.length} 条记录</Badge>
      </h3>

      <div className="relative space-y-4">
        {/* 时间轴线 */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

        {updates.map((update, index) => (
          <Card key={update.id} className="relative ml-8 border-l-4 border-l-primary">
            {/* 时间轴节点 */}
            <div className="absolute -left-[39px] top-4 w-6 h-6 rounded-full bg-primary border-4 border-background" />
            
            <CardContent className="p-4">
              {/* 头部：时间和汇报人 */}
              <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                    {format(new Date(update.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{update.reporter_name}</span>
                </div>
                {index === 0 && (
                  <Badge variant="default" className="text-xs">最新</Badge>
                )}
              </div>

              {/* 汇报内容 */}
              {update.content && (
                <div className="mb-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {update.content}
                </div>
              )}

              {/* 图片缩略图 */}
              {update.image_urls && update.image_urls.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <ImageIcon className="h-3 w-3" />
                    <span>现场照片 ({update.image_urls.length}张)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {update.image_urls.map((url, imgIndex) => (
                      <button
                        key={imgIndex}
                        onClick={() => openLightbox(update.image_urls, imgIndex)}
                        className="relative w-20 h-20 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <img
                          src={url.startsWith('http') ? url : `${API_URL}${url}`}
                          alt={`现场照片 ${imgIndex + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 图片灯箱 */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages}
        index={lightboxIndex}
        plugins={[Thumbnails, Zoom]}
        thumbnails={{ position: "bottom" }}
      />
    </div>
  );
}