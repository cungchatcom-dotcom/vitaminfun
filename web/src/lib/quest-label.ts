import { pickText } from "@/lib/i18n-text";

/**
 * Tên hiển thị của một nhiệm vụ.
 *
 * `quest_object_key` là khoá KỸ THUẬT — `mast`, `hull`, `npc` — dùng để cảnh
 * Phaser biết gắn nhiệm vụ vào vật thể nào. Học sinh không nên nhìn thấy nó,
 * nên khi giáo viên chưa đặt tên riêng thì:
 *
 *   - nhiệm vụ NPC lùi về nhãn ĐÃ DỊCH (`stage.quest.npcDefault`), vì cái này
 *     sinh ra tự động cùng màn chơi nên phần lớn thời gian sẽ chưa có tên;
 *   - nhiệm vụ thường vẫn lùi về khoá kỹ thuật, vì chính giáo viên gõ ra nó và
 *     nó thường đã là chữ đọc được.
 *
 * Nhãn mặc định nằm ở `messages/` chứ không nằm trong database: một hàng
 * `quests` chứa sẵn chữ tiếng Việt thì không dịch sang tiếng Anh được nữa.
 */
export function questLabel(
  quest: {
    name_i18n: Record<string, string>;
    quest_object_key: string;
    phase: string;
  },
  locale: string,
  t: (key: string) => string,
): string {
  const own = pickText(quest.name_i18n, locale);
  if (own) return own;
  return quest.phase === "advisor"
    ? t("stage.quest.npcDefault")
    : quest.quest_object_key;
}
