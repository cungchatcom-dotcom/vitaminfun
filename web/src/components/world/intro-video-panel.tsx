'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { MediaField } from '@/components/media-field';
import { Card, SectionTitle } from '@/components/ui/primitives';
import type { Stage, updateStage } from '@/lib/worlds';

/**
 * Trên bao nhiêu giây thì kêu người dựng cắt ngắn lại.
 *
 * 15, không phải 10: đoạn 5–10 giây là ý muốn, nhưng một cảnh báo bật lên ngay
 * ở giây thứ 11 thì thành tiếng ồn — người dựng học cách bỏ qua nó, rồi bỏ qua
 * luôn cái ở giây thứ 60. Để một khoảng đệm thì lời cảnh báo giữ được sức nặng.
 */
const DAI_QUA = 15;

/**
 * VIDEO MỞ MÀN — bảng của giáo viên.
 *
 * Đây không phải chỗ gắn một đoạn phim vào màn chơi. Nó là TẤM MÀN che đúng
 * khoảng thời gian màn chơi đang nạp: gói Phaser gần một megabyte, ảnh nền có
 * khi là video, spritesheet bốn hướng. Khoảng chờ đó có thật và không bỏ đi
 * được; thứ bỏ đi được là cái màn hình trống trong lúc chờ.
 *
 * ## Bỏ trống là một lựa chọn ĐÚNG, và bảng nói thẳng như vậy
 *
 * `NULL` = học sinh vào thẳng, y như trước. Một dòng nhắc màu cam kiểu "chưa
 * có video" sẽ đọc thành "bạn còn thiếu một bước", và 30 màn đã dựng bỗng dưng
 * trông như 30 màn làm dở. Nên chỗ này dùng chữ xám, và nói rõ đây là hợp lệ.
 *
 * ## Nói trước cái GIÁ, bằng con số của chính file vừa tải
 *
 * Đồng hồ làm bài chạy ngay từ lúc video bắt đầu — không hoãn được, vì một lượt
 * chơi là của cả phòng tối đa bốn người và `started_at` là một cột dùng chung
 * (xem GAME_DOMAIN §3e). Người dựng phải biết điều đó TRƯỚC khi tải một đoạn
 * 60 giây lên, không phải sau khi một lớp học phàn nàn.
 *
 * Độ dài ĐO từ metadata của chính tệp, không lưu thành cột: một con số trong
 * database chỉ là bản sao có thể lệch với file, và không ai kiểm được nó lệch
 * lúc nào.
 */
export function IntroVideoPanel({
  stage,
  onPatch,
}: {
  stage: Stage;
  /** Vá một mẩu vào màn chơi. Chỗ gọi lo việc lưu và báo lỗi. */
  onPatch: (payload: Parameters<typeof updateStage>[1]) => void;
}) {
  const t = useTranslations();

  // Chỉ biết được sau khi thẻ `<video>` đọc xong metadata, nên `null` lúc đầu
  // và cũng `null` mãi nếu tệp hỏng. Không có nó thì không hiện dòng nào —
  // không đoán một con số để lấp chỗ trống.
  const [giay, setGiay] = useState<number | null>(null);

  const co = stage.intro_video_media_id != null;
  const daiQua = giay !== null && giay > DAI_QUA;

  return (
    <Card>
      <SectionTitle>{t('designer.introVideo.title')}</SectionTitle>

      <p className="mt-2 mb-3 text-[11px] leading-snug text-slate-500">
        {t('designer.introVideo.hint')}
      </p>

      <MediaField
        kind="video"
        folder="stage-intro"
        removeLabel={t('designer.introVideo.remove')}
        value={{
          mediaId: stage.intro_video_media_id ?? null,
          url: stage.intro_video_url ?? null,
        }}
        onChange={(next) => {
          // Đổi tệp thì con số cũ phải đi theo tệp cũ. Giữ lại thì bảng nói về
          // một đoạn video không còn ở đó nữa.
          setGiay(null);
          onPatch({ intro_video_media_id: next.mediaId });
        }}
        onDuration={setGiay}
      />

      {/* Chưa có video: chữ XÁM, và nói rõ đây là hợp lệ. Xem ghi chú đầu file. */}
      {!co && (
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          {t('designer.introVideo.empty')}
        </p>
      )}

      {co && giay !== null && (
        <p
          className={`mt-2 text-[11px] leading-snug ${
            daiQua ? 'text-orichalcum-400' : 'text-slate-400'
          }`}
        >
          {daiQua
            ? `⚠ ${t('designer.introVideo.tooLong', { seconds: Math.round(giay) })}`
            : t('designer.introVideo.duration', { seconds: Math.round(giay) })}
        </p>
      )}

      {/* Cái giá nói MỘT LẦN, ngay khi đã có video — không đợi tới lúc dài quá.
          Người dựng cần biết luật, không chỉ biết mình vừa phạm luật. */}
      {co && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          {t('designer.introVideo.clock')}
        </p>
      )}
    </Card>
  );
}
