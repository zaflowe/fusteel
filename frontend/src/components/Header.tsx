'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AIChatBot } from '@/components/AIChatBot';
import { siteConfig } from '@/config/site';

export default function Header() {
  const pathname = usePathname();
  
  // 检测是否在门户路由下（/portal 或 /share）
  const isPortalRoute = pathname?.startsWith('/portal') || pathname?.startsWith('/share');
  
  return (
    <>
      {/* 非门户路由：显示完整导航 */}
      {!isPortalRoute && (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center flex-1 pr-6 pl-8 max-w-none">
            <div className="flex gap-2 items-center mr-8">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold tracking-tighter">AI</span>
              </div>
              <span className="font-bold text-lg hidden sm:inline-block">
                项目调度中枢
              </span>
            </div>
            
            <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
              <nav className="flex items-center gap-6 text-sm font-medium mr-auto">
                <a className="transition-colors hover:text-foreground/80 text-foreground" href="/">看板</a>
                <Link href="/ai-scheduler" className="transition-colors hover:text-foreground/80 text-foreground/60">{siteConfig.nav.scheduler}</Link>
                <a className="transition-colors hover:text-foreground/80 text-foreground/60" href="/files">智汇文件</a>
              </nav>
              <div className="w-full flex-1 md:w-auto md:flex-none">
                {/* Search will go here or in specific pages */}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* 门户路由：只显示 Logo */}
      {isPortalRoute && (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center px-4 max-w-none">
            <div className="flex gap-2 items-center">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold tracking-tighter">AI</span>
              </div>
              <span className="font-bold text-lg">
                项目调度中枢
              </span>
            </div>
          </div>
        </header>
      )}

      {/* 非门户路由：显示 AI Chatbot */}
      {!isPortalRoute && <AIChatBot />}
    </>
  );
}