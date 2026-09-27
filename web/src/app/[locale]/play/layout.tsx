import { setRequestLocale } from 'next-intl/server';

import type { ReactNode } from 'react';

/**
 * Khung chung của MỌI màn học sinh: bản đồ thiên hà, phòng chờ, màn chơi.
 *
 * KHÔNG có thanh trên cùng. Xem `PlayerMenu` và docs/UI_META_SCREENS.md.
 *
 * Cũng KHÔNG có lớp phủ "xoay ngang máy" nữa. Nó từng nằm ở đây, một bản cho cả
 * ba màn — đúng khi mọi màn đều chỉ có bố cục ngang. Giờ mỗi màn có thể mang
 * thêm một bố cục DỌC do người dựng thiết kế, và màn nào có thì không được mời
 * xoay: lớp phủ sẽ che đúng cái bố cục vừa vẽ ra cho nó.
 *
 * Nên việc mời xoay chuyển về cho từng màn tự quyết — xem `RotateGate`.
 */
export default async function PlayLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <>{children}</>;
}
