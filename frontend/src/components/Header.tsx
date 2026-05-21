'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AIChatBot } from '@/components/AIChatBot';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

// 顶部导航定义：路由匹配规则决定当前 active 哪一项
const NAV_ITEMS: { href: string; label: string; match: (p: string) => boolean }[] = [
  {
    href: '/',
    label: '看板',
    // 看板：首页 / 项目详情 / AI 配置 等都视为「看板」分支
    match: (p) => p === '/' || p.startsWith('/project') || p.startsWith('/ai-config'),
  },
  {
    href: '/ai-scheduler',
    label: '', // 由 siteConfig 提供，运行时填充
    match: (p) => p.startsWith('/ai-scheduler'),
  },
  {
    href: '/departments',
    label: '部门统计',
    match: (p) => p.startsWith('/departments') || p.startsWith('/files'),
  },
];

export default function Header() {
  const pathname = usePathname() || '/';

  // 检测是否在门户路由下（/portal 或 /share）
  const isPortalRoute = pathname.startsWith('/portal') || pathname.startsWith('/share');

  // 计算当前 active 的 nav 项（只允许一个高亮）
  const activeHref = (() => {
    const matched = NAV_ITEMS.filter((n) => n.match(pathname));
    if (!matched.length) return null;
    // 多个匹配时优先精度更高的（路径更长的）
    return matched.sort((a, b) => b.href.length - a.href.length)[0].href;
  })();

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
              <nav className="flex items-center gap-6 text-sm mr-auto">
                {NAV_ITEMS.map((item) => {
                  const label = item.href === '/ai-scheduler' ? siteConfig.nav.scheduler : item.label;
                  const isActive = activeHref === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'relative transition-colors hover:text-foreground/80',
                        isActive
                          ? 'font-bold text-foreground'
                          : 'font-medium text-foreground/60',
                      )}
                    >
                      {label}
                      {/* 当前页面：底部高亮短条 */}
                      {isActive && (
                        <span className="absolute -bottom-[22px] left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-foreground" />
                      )}
                    </Link>
                  );
                })}
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