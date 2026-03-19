import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '项目调度中枢',
  description: '高效、极简的项目管理与AI调度平台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased min-h-screen flex flex-col`}>
        {/* Header 组件（客户端组件，处理路由检测） */}
        <Header />

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        <Toaster />
      </body>
    </html>
  );
}