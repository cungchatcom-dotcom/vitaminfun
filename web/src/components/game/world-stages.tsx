import { getTranslations } from 'next-intl/server';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Card } from '@/components/ui/primitives';

import { WorldLobby } from './world-lobby';
import { pickText } from '@/lib/i18n-text';
import { localizedPath } from '@/lib/routes';

import type { PlayWorldDetail } from '@/lib/types';

/**
 * Phòng chờ của một world (S1) — CHỈ giao diện đồ hoạ.
 *
 * Trước đây dưới khung phòng chờ còn một danh sách chương và màn chơi dạng thẻ
 * chữ, kèm một tiêu đề trang lặp lại tên world, cốt truyện, điểm chiến lực và số
 * mảnh bản đồ. Cả hai đều nói lại đúng những gì cái khung phía trên đã vẽ: tên
 * và cốt truyện nằm trong khung tiêu đề, điểm và mảnh nằm ở bảng thành tích,
 * còn chương thì có hàng chương bấm vào là mở bản đồ chương ra.
 *
 * Hai bản của cùng một thứ trên cùng một màn hình thì bản nào cũng làm yếu bản
 * kia: người dựng căn tấm khung cho đẹp, rồi bên dưới là một danh sách chữ
 * không liên quan gì tới nó. Giữ đúng MỘT bản, và bản đó là cái người dựng dựng.
 *
 * Đường vào màn chơi không mất: bấm một chương ở hàng chương là mở
 * `ChapterMinimap`, và mỗi màn trong đó dẫn thẳng tới `/play/stage/{id}`.
 *
 * Trạng thái khoá/mở vẫn do BACKEND quyết trong `unlocked`, frontend không tự so
 * điểm. Tính lại ở đây thì có hai bản của cùng một luật, và bản sai là bản cho
 * người chơi vào màn họ chưa đủ điểm.
 */
export async function WorldStages({ world, locale }: { world: PlayWorldDetail; locale: string }) {
  const t = await getTranslations('play');

  return (
    <>
      {/* Vụn đường dẫn GIỮ LẠI: nó là lối ra, không phải bản sao của tấm khung.
          Khung phòng chờ có nút về bản đồ thiên hà, nhưng không có đường về
          danh sách world. */}
      <Breadcrumb
        items={[
          { label: t('title'), href: localizedPath('/play', locale) },
          { label: pickText(world.name_i18n, locale) },
        ]}
      />

      <div className="mb-6">
        <WorldLobby world={world} />
      </div>

      {/* Báo mở được Cánh cổng Thời gian — một trạng thái mà tấm khung không vẽ,
          nên nó không phải bản sao của cái gì cả. */}
      {world.gate_ready && (
        <Card className="mb-6 border-orichalcum-500/40 bg-orichalcum-500/5">
          <p className="text-orichalcum-400">⏳ {t('gateReady')}</p>
        </Card>
      )}
    </>
  );
}
