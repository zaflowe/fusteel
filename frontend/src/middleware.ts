import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // const { pathname, searchParams } = request.nextUrl;
  
  // // 获取User-Agent
  // const userAgent = request.headers.get('user-agent') || '';
  
  // // 检测是否为移动设备
  // const isMobile = /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(userAgent);
  
  // // 如果是访问根路径，根据设备类型重定向
  // if (pathname === '/') {
  //   if (isMobile) {
  //     // 移动端访问根路径，重定向到移动端门户
  //     return NextResponse.redirect(new URL('/portal', request.url));
  //   }
  //   // PC端保持原样，访问dashboard
  //   return NextResponse.next();
  // }
  
  // // 如果PC端访问/portal，也允许访问（方便测试）
  // // 如果移动端访问/dashboard，重定向到/portal
  // if (pathname === '/dashboard' && isMobile) {
  //   return NextResponse.redirect(new URL('/portal', request.url));
  // }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard', '/portal'],
};