import { getTranslations } from 'next-intl/server';

import { WorldLobby } from './world-lobby';

import type { PlayWorldDetail } from '@/lib/types';

/**
 * Phòng chờ của một world (S1) — CHỈ giao diện đồ hoạ, TRỌN MÀN HÌNH.
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
 * ## Vụn đường dẫn cũng đi nốt
 *
 * Hai dòng "← Galaxy map" và "Galaxy map / Lost in Atlantis" từng đứng phía
 * trên tấm khung. Cả hai đều là bản sao: LỐI RA đã nằm sẵn trong chính tấm
 * khung (nút "← Bản đồ thiên hà" góc trên trái, xem `WorldLobby`), còn TÊN
 * WORLD thì tấm nền đã viết to giữa màn hình. Giữ chúng lại chỉ để đẩy tấm
 * khung tụt xuống bốn chục pixel và ăn mất đúng thứ nó cần nhất: chiều cao.
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
      <WorldLobby world={world} />

      {/* Báo mở được Cánh cổng Thời gian — một trạng thái mà tấm khung không vẽ,
          nên nó không phải bản sao của cái gì cả.

          NỔI LÊN TRÊN tấm khung chứ không xếp bên dưới: xếp dưới thì nó chiếm
          một dải chiều cao vĩnh viễn, và phòng chờ co lại chỉ vì một dòng chữ
          mà đa số thời gian không có. Đứng ở mép trên, giữa màn, thì nó là một
          lời báo — đúng cái nó là. */}
      {world.gate_ready && (
        <p
          className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-xl border border-orichalcum-500/40 bg-abyss-950/85 px-4 py-2 text-sm text-orichalcum-400 backdrop-blur">
          ⏳ {t('gateReady')}
        </p>
      )}
    </>
  );
}
