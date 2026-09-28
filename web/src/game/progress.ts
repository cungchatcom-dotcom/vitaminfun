import type { PlayChapter, PlayStage, PlayWorldDetail } from '@/lib/types';

/**
 * MÀN NÚT "CHƠI NGAY" SẼ VÀO — và là màn được tô sáng.
 *
 * Theo thứ tự ưu tiên:
 *
 *   1. Màn đang chơi DỞ và còn giờ — `resume_stage_id`. Người chơi đóng nhầm
 *      tab giữa chừng rồi quay lại thì thứ họ muốn là cái đang làm dở. Server
 *      quyết chuyện "còn giờ hay không", vì chỉ nó biết `started_at`.
 *   2. Màn mở CUỐI CÙNG — mép tiến độ của người chơi. Ném họ về màn 1 mỗi lần
 *      bấm là bắt chơi lại thứ đã xong để tới được thứ chưa xong.
 *
 * Ở ĐÂY chứ không trong nút Chơi: hàng chương và minimap tô sáng theo cùng luật
 * này. Hai bản chép thì sớm muộn lệch nhau, và học sinh bấm Chơi rồi bị đưa vào
 * một màn khác với màn đang sáng lên — tức cái viền sáng nói dối.
 */
export function playTarget(world: PlayWorldDetail): PlayStage | undefined {
  const stages = world.chapters?.flatMap((c) => c.stages) ?? [];
  const dangDo = world.resume_stage_id
    ? stages.find((stage) => stage.id === world.resume_stage_id)
    : undefined;
  return dangDo ?? stages.filter((stage) => stage.unlocked).at(-1);
}

/**
 * NHỮNG MÀN ĐƯỢC TÔ SÁNG: màn đang chơi dở VÀ màn mở cuối cùng.
 *
 * Tập hợp, không phải một màn: hai thứ đó có thể khác nhau — đang dở màn 2 mà
 * đã đủ điểm mở tới màn 5 — và cả hai đều là "chỗ nên nhìn vào". Nút Chơi chỉ
 * đi được một chỗ (`playTarget`), còn mắt thì nhìn được cả hai.
 */
export function highlightedStageIds(world: PlayWorldDetail): Set<string> {
  const stages = world.chapters?.flatMap((c) => c.stages) ?? [];
  const ids = new Set<string>();
  if (world.resume_stage_id && stages.some((s) => s.id === world.resume_stage_id)) {
    ids.add(world.resume_stage_id);
  }
  const moCuoi = stages.filter((stage) => stage.unlocked).at(-1);
  if (moCuoi) ids.add(moCuoi.id);
  return ids;
}

/** Chương có chứa một màn đang được tô sáng không. */
export function isHighlightedChapter(chapter: PlayChapter, ids: Set<string>): boolean {
  return chapter.stages.some((stage) => ids.has(stage.id));
}
