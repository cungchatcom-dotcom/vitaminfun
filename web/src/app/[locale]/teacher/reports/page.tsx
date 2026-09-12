import { setRequestLocale } from 'next-intl/server';

import { ReportsDashboard } from '@/components/report/reports-dashboard';
import { requireUser } from '@/lib/auth';

/**
 * Dữ liệu của NGƯỜI KHÁC, và thay đổi từng phút. Không được nằm trong bộ nhớ
 * đệm dùng chung — cùng lý do với bảng điều khiển giáo viên.
 */
export const dynamic = 'force-dynamic';

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware đã chặn `/teacher/*` với học sinh, nhưng lớp này vẫn cần: cookie
  // còn hạn mà tài khoản vừa bị hạ vai trò thì middleware không biết.
  await requireUser();

  return <ReportsDashboard />;
}
