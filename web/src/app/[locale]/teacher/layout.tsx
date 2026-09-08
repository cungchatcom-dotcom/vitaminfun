import { redirect } from 'next/navigation';

import { AuthProvider } from '@/components/auth-context';
import { TopBar } from '@/components/top-bar';
import { requireUser } from '@/lib/auth';

import type { ReactNode } from 'react';

/**
 * Khung chung cho mọi màn `/teacher/*`.
 *
 * Kiểm vai trò ở ĐÂY chứ không ở từng trang: thêm một trang mới mà quên kiểm
 * thì trang đó hở. Middleware cũng chặn rồi, nhưng middleware chỉ đọc cookie —
 * lớp này hỏi lại server, nên tài khoản vừa bị đổi vai trò hoặc bị khoá sẽ bị
 * chặn ngay, không phải chờ token hết hạn.
 */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (user.role !== 'teacher' && user.role !== 'admin') redirect(user.home_route);

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-full flex-col">
        <TopBar accent="teacher" />
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
