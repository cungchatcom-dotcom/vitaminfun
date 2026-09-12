import { setRequestLocale } from 'next-intl/server';

import { SiteConfigForm } from '@/components/site-config-form';
import { requireUser } from '@/lib/auth';

/** Cấu hình đổi được lúc đang chạy — không nằm trong bộ nhớ đệm dùng chung. */
export const dynamic = 'force-dynamic';

export default async function SiteConfigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware đã chặn `/teacher/*` với học sinh; lớp này bắt trường hợp cookie
  // còn hạn mà tài khoản vừa bị hạ vai trò.
  await requireUser();

  return <SiteConfigForm />;
}
