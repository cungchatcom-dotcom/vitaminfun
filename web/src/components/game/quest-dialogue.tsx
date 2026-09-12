"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DIALOGUE,
  DIALOGUE_BACKGROUND,
  DIALOGUE_BLOCK_KEYS,
  dialogueBox,
  dialogueContent,
  type DialogueBlockKey,
  type DialogueSaved,
} from "@/game/dialogue";
import {
  DIALOGUE_REST,
  spriteFrame,
  type DialoguePose,
  type DialogueRole,
} from "@/game/character";

import { FitScale } from "./fit-scale";

import type { DialogueActor } from "@/lib/play";

import type { ReactNode } from "react";

/** Một câu đang nằm trong bong bóng. `null` = bong bóng đó chưa có gì để nói. */
export interface DialogueLine {
  /** Chữ của câu. Với câu NGHE thì đây cũng chính là transcript. */
  text: string;
  /** Đổi màu chữ theo giọng: khen, chê, hay kể. Không đổi bố cục. */
  tone?: "plain" | "praise" | "wrong";
  /**
   * Dòng phụ dưới câu chính, chữ nhỏ hơn và mờ hơn — bản dịch của đề bài.
   *
   * Cùng một bong bóng chứ không phải một bong bóng thứ hai: bản dịch KHÔNG
   * phải một câu người canh giữ nói ra, nó là chú thích cho câu vừa nói. Tách
   * thành bong bóng riêng là dựng ra một người thứ ba trong cuộc trò chuyện.
   */
  aside?: string | null;
}

const TONE: Record<NonNullable<DialogueLine["tone"]>, string> = {
  plain: "",
  praise: "text-emerald-700",
  wrong: "text-rose-700",
};

/**
 * MÀN HỘI THOẠI VỚI NGƯỜI CANH GIỮ — phần VẼ.
 *
 * Component này không biết luật chơi: nó nhận vào ai đang nói, nói gì, và vẽ ra
 * theo bố cục giáo viên đã căn. Quyết định chấm bài, đếm lượt thử, đi câu tiếp
 * đều nằm ở `quest-panel.tsx`. Một file vẽ, một file quyết — cùng ranh giới với
 * `PhaserCanvas` và `StagePlay`.
 *
 * ## Tấm bảng TRONG SUỐT
 *
 * Không nền, không viền, không bóng đổ. Cảnh chơi thật đang nằm ngay sau lưng —
 * vẽ thêm một tấm ảnh nền nữa lên trên nó là che mất đúng chỗ học sinh đang
 * đứng, và dựng một cái khung quanh cuộc trò chuyện thì biến nó thành hộp thoại
 * của hệ điều hành. Chỉ những thứ CẦN nền mới có nền: bong bóng, và khung trả
 * lời.
 *
 * (Trình thiết kế của giáo viên không có cảnh Phaser nào phía sau, nên nó tự vẽ
 * ảnh nền của màn DƯỚI tấm bảng này — xem `dialogue-designer.tsx`.)
 *
 * ## Bong bóng là Ô CỐ ĐỊNH, không phải danh sách cuộn
 *
 * Bản phác ban đầu vẽ một cột tin nhắn cuộn lên như Messenger. Nhưng giáo viên
 * KÉO THẢ từng khối, và một danh sách cuộn thì không có chỗ để mà kéo — nó dài
 * ra theo số câu đã hỏi. Nên `npcBubble` là chỗ đứng của **câu NPC mới nhất**,
 * `playerBubble` là chỗ đứng của **bài trả lời mới nhất**.
 *
 * ## Không có thanh cuộn ở đâu cả — nhưng hai cách khác nhau
 *
 * BONG BÓNG thì DÀI RA cho vừa chữ: cỡ chữ là thứ người dựng chọn, và cỡ khối
 * họ căn là cỡ TỐI THIỂU. Mép trên đứng yên, bong bóng mọc xuống dưới — đúng
 * như một bong bóng thoại phình ra khi có nhiều lời hơn.
 *
 * KHUNG TRẢ LỜI thì ngược lại: nó THU nội dung cho vừa (`FitScale`). Nó không
 * được phép dài ra, vì bên trong là nút bấm và ô nhập — thứ phải nằm đúng chỗ
 * người dựng đặt, không được trôi xuống dưới mép tấm bảng.
 *
 * Cả hai đều không có thanh cuộn: một thanh cuộn trong một cái bong bóng là dấu
 * hiệu bố cục đã hỏng, và cũng chẳng ai bấm vào giữa lúc đang trả lời.
 *
 * ## Toạ độ theo PHẦN TRĂM của hệ 1000×700
 *
 * Khối lưu theo hệ ảo `DIALOGUE`, vẽ ra bằng `%` — nên tấm bảng co giãn theo
 * cửa sổ mà bố cục không lệch. Cùng cách `StageScene` làm với hệ 3200×1800.
 */
export function QuestDialogue({
  layout,
  urls,
  npcName,
  npc,
  npcPose,
  playerName,
  player,
  playerPose,
  npcQuestion,
  playerLine,
  npcVerdict,
  typing,
  answer,
  header,
  onClose,
  onTypingChange,
}: {
  layout: DialogueSaved;
  /**
   * URL ảnh nền của TỪNG KHỐI, tra sẵn theo `media_id` bên trong bố cục.
   *
   * Khối lưu id chứ không lưu URL — id thì bền, URL thì đổi khi kho ảnh đổi.
   * Server tra một lượt cho cả sáu khối (`block_urls`), y như `audio_urls`.
   */
  urls: Record<string, string>;
  npcName: string;
  /** Người canh giữ, kèm mọi tư thế đã tải. `null` = chưa gán ai. */
  npc: DialogueActor | null;
  /** Tư thế người canh giữ đang ở. */
  npcPose: DialoguePose;
  playerName: string;
  player: DialogueActor | null;
  /** Tư thế nhân vật học sinh đang ở. */
  playerPose: DialoguePose;
  /** Câu người canh giữ đang HỎI. Đứng yên suốt cả câu đó, kể cả khi trả lời sai. */
  npcQuestion: DialogueLine | null;
  /** Bài học sinh vừa nộp. `null` = chưa trả lời gì cho câu này. */
  playerLine: DialogueLine | null;
  /** Lời phán đúng/sai. `null` = chưa có gì để phán. */
  npcVerdict: DialogueLine | null;
  /** Người canh giữ đang "gõ" — bong bóng LỜI PHÁN hiện ba chấm thay cho chữ. */
  typing: boolean;
  /** Vùng trả lời. Đổi theo dạng câu hỏi; component này không cần biết dạng nào. */
  answer: ReactNode;
  /** Cụm nhỏ ở góc trên phải: bước mấy trên mấy. Nút đóng thì đây tự vẽ. */
  header: ReactNode;
  onClose: () => void;
  onTypingChange: (typing: boolean) => void;
}) {
  const t = useTranslations();

  return (
    <section
      className="pointer-events-auto relative h-full max-h-full w-auto max-w-full"
      style={{
        // Cao TRƯỚC, rộng suy ra. Khu chơi rộng và thấp, nên chiều cao mới là
        // cái chặn — lấy bề rộng làm chuẩn thì tấm bảng cao hơn khung nhìn và
        // cả câu hỏi lẫn nút Trả lời đều bị cắt mất. Đã gặp thật.
        aspectRatio: `${DIALOGUE.width} / ${DIALOGUE.height}`,
        // `cqw` của các khối con đo theo BỀ RỘNG TẤM BẢNG này. Thiếu dòng này
        // thì `cqw` không có gì để đo và cỡ chữ nhảy loạn — chữ NPC to gấp ba.
        containerType: "inline-size",
      }}
      // Gõ trong bảng này thì cảnh Phaser phải ngừng nhận WASD, không thì gõ
      // chữ "a" là nhân vật chạy sang trái.
      onFocusCapture={() => onTypingChange(true)}
      onBlurCapture={() => onTypingChange(false)}
    >
      {/* Ảnh nền của cả tấm bảng — TUỲ CHỌN, và mặc định là không có.
          Không có thì tấm bảng trong suốt và cảnh chơi thật hiện xuyên qua.
          Có thì người dựng muốn cuộc trò chuyện diễn ra trong một khung cảnh
          riêng, nên nó phủ kín và bo góc như một tấm bảng thật. */}
      {urls[DIALOGUE_BACKGROUND] && (
        <img
          src={urls[DIALOGUE_BACKGROUND]}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full rounded-2xl object-cover"
          draggable={false}
        />
      )}
      {/* Cụm điều khiển nép sát góc, nhỏ nhất mà vẫn bấm được. Học sinh dùng nó
          hai lần một màn; chiếm chỗ hơn thế là lấn vào cuộc trò chuyện.

          TÊN NHIỆM VỤ không ở đây: học sinh vừa đi tới tận nơi và bấm vào chính
          vật thể đó, nhắc lại tên nó là nói cho họ nghe một việc họ vừa làm. */}
      <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 p-[1.2%]">
        {header}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("game.leave")}
          className="grid size-7 place-items-center rounded-full bg-abyss-950/45 text-slate-200 backdrop-blur-sm transition hover:bg-abyss-950/80 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <Block k="npcAvatar" layout={layout} urls={urls}>
        <Actor actor={npc} role="npc" pose={npcPose} name={npcName} />
      </Block>

      <Block k="npcBubble" layout={layout} urls={urls} grow>
        {npcQuestion && (
          <Bubble
            side="npc"
            layout={layout}
            urls={urls}
            k="npcBubble"
            line={npcQuestion}
          />
        )}
      </Block>

      <Block k="playerBubble" layout={layout} urls={urls} grow>
        {playerLine && (
          <Bubble
            side="me"
            layout={layout}
            urls={urls}
            k="playerBubble"
            line={playerLine}
          />
        )}
      </Block>

      {/* Lời phán. Ba chấm "đang gõ" hiện ở ĐÂY chứ không ở bong bóng câu hỏi:
          thứ học sinh đang chờ sau khi bấm Trả lời là câu này, và đề bài thì
          phải đứng yên để họ còn đối chiếu. */}
      <Block k="npcVerdict" layout={layout} urls={urls} grow>
        {(npcVerdict || typing) && (
          <Bubble
            side="npc"
            layout={layout}
            urls={urls}
            k="npcVerdict"
            line={npcVerdict}
            dots={typing}
          />
        )}
      </Block>

      <Block k="playerAvatar" layout={layout} urls={urls}>
        <Actor
          actor={player}
          role="player"
          pose={playerPose}
          name={playerName}
        />
      </Block>

      {/* Không có gì để làm thì KHÔNG vẽ khung nào. Mở lại một nhiệm vụ đã
          xong là một ví dụ: người canh giữ nói lại câu chia tay, và hết —
          một tấm bảng tối rỗng nằm dưới đó chỉ là một cái khung chờ việc
          không bao giờ tới. */}
      {answer && (
        <Block k="answerBox" layout={layout} urls={urls}>
          {/* Ảnh nền do người dựng tải lên thì bỏ hết khung mặc định đi: hai lớp
            khung lồng nhau là thứ không ai cố ý muốn. */}
          <div
            className={`size-full p-[2.5%] ${
              urls.answerBox
                ? ""
                : "rounded-2xl bg-abyss-950/55 ring-1 ring-white/10 backdrop-blur-[2px]"
            }`}
          >
            {/* `center`: nội dung ngắn — một ô nhập, một dòng nút — thì nằm giữa
              khối chứ không dính lên mép trên rồi bỏ trống nửa dưới. Nội dung
              cao hơn khối thì `center` tự thành 0, tức vẫn bám mép trên. */}
            <FitScale center>{answer}</FitScale>
          </div>
        </Block>
      )}
    </section>
  );
}

/**
 * Một khối, đặt theo bố cục.
 *
 * `x`/`y` là TÂM khối nên phải trừ đi nửa bề rộng — cùng phép toán với khối
 * phòng chờ và vật thể nhiệm vụ. Đổi sang góc trên trái ở đây thôi là bố cục
 * căn bên trình thiết kế hiện lệch nửa khối bên màn học sinh.
 */
function Block({
  k,
  layout,
  urls,
  grow = false,
  children,
}: {
  k: DialogueBlockKey;
  layout: DialogueSaved;
  urls: Record<string, string>;
  /**
   * Khối DÀI RA cho vừa nội dung thay vì ép nội dung nhỏ lại cho vừa khối.
   *
   * Chỉ dành cho bong bóng chữ. Cỡ khối người dựng căn trở thành cỡ TỐI THIỂU,
   * và mép TRÊN đứng yên — bong bóng mọc xuống dưới, đúng như một bong bóng
   * thoại phình ra khi có nhiều lời hơn.
   *
   * Bản trước làm ngược: thu chữ cho vừa khối. Nó hỏng ở cả hai đầu — một câu
   * hỏi dài thì chữ bé tí không đọc nổi, còn lời chia tay của người canh giữ
   * thì teo lại giữa một cái bong bóng rỗng. Cỡ chữ là thứ người dựng CHỌN, và
   * bóp nó đi là bỏ qua chính lựa chọn đó.
   */
  grow?: boolean;
  children: ReactNode;
}) {
  const box = dialogueBox(k, layout[k]);
  const url = urls[k];
  const height = `${(box.height / DIALOGUE.height) * 100}%`;
  return (
    <div
      className="absolute"
      style={{
        left: `${((box.x - box.width / 2) / DIALOGUE.width) * 100}%`,
        top: `${((box.y - box.height / 2) / DIALOGUE.height) * 100}%`,
        width: `${(box.width / DIALOGUE.width) * 100}%`,
        ...(grow ? { minHeight: height } : { height }),
      }}
    >
      {/* Ảnh nền CĂNG kín khối, không giữ tỉ lệ gốc — cùng luật với khối phòng
          chờ: khối có cỡ thật do người dựng kéo, nên ảnh phải vừa đúng khung
          đó. Vẽ ở đây, một chỗ, cho cả sáu khối; để mỗi khối tự vẽ lấy là sáu
          chỗ để quên. */}
      {url && (
        <img
          src={url}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full"
          draggable={false}
        />
      )}
      {children}
    </div>
  );
}

/**
 * Bong bóng: ảnh nền của khối nếu người dựng đã tải lên, không thì tấm giấy mặc
 * định. Chữ nằm trong KHUNG NỘI DUNG, toạ độ tính bằng phần trăm của khối.
 */
function Bubble({
  side,
  layout,
  urls,
  k,
  line,
  dots = false,
}: {
  side: "npc" | "me";
  layout: DialogueSaved;
  urls: Record<string, string>;
  k: DialogueBlockKey;
  line: DialogueLine | null;
  /** Hiện ba chấm "đang gõ" thay cho chữ. */
  dots?: boolean;
}) {
  const saved = layout[k];
  const outer = dialogueBox(k, saved);
  const box = dialogueContent(k, saved?.content);

  /**
   * Khung nội dung đổi từ MỘT CÁI HỘP thành BỐN CÁI LỀ.
   *
   * Người dựng vẫn kéo đúng cái khung ấy, và nó vẫn nói đúng chỗ chữ bắt đầu.
   * Nhưng một cái hộp có chiều cao cố định thì chữ dài hơn nó sẽ tràn hoặc phải
   * co lại; bốn cái lề thì chữ cứ chảy, và khối cha dài ra theo.
   *
   * Lề tính bằng `cqw` — phần trăm bề rộng TẤM BẢNG. Hệ toạ độ 1000×700 và tỉ
   * lệ khung là một, nên một đơn vị của hệ đó bằng đúng 0,1cqw ở CẢ HAI chiều;
   * không cần `cqh`, và cũng không có `cqh` để mà dùng khi khối tự dài ra.
   */
  const pad = {
    paddingLeft: `${(((box.x - box.w / 2) / 100) * outer.width) / 10}cqw`,
    paddingRight: `${((1 - (box.x + box.w / 2) / 100) * outer.width) / 10}cqw`,
    paddingTop: `${(((box.y - box.h / 2) / 100) * outer.height) / 10}cqw`,
    paddingBottom: `${((1 - (box.y + box.h / 2) / 100) * outer.height) / 10}cqw`,
  };

  // Chưa ai tải ảnh thì vẽ TẤM GIẤY mặc định — màn hình phải chạy được trước
  // khi ai kịp vẽ ảnh. Tải rồi thì ảnh đã nằm dưới (xem `Block`), và thêm một
  // lớp giấy nữa lên trên là che mất đúng thứ vừa tải.
  //
  // Một góc bo nhỏ hẳn ở phía người nói: đó là cái đuôi bong bóng, rút gọn còn
  // một chi tiết. Vẽ hẳn một cái đuôi nhọn thì nó phải biết người nói đứng đâu,
  // mà chỗ đứng thì giáo viên kéo đi bất cứ đâu cũng được.
  const skin = urls[k]
    ? null
    : side === "npc"
      ? "rounded-[1.6rem] rounded-bl-sm bg-[#fdf6ea] shadow-lg shadow-abyss-950/30 ring-1 ring-black/10"
      : "rounded-[1.6rem] rounded-br-sm bg-lagoon-500 shadow-lg shadow-abyss-950/30 ring-1 ring-white/25";

  return (
    <div className="relative min-h-full">
      {skin && <div className={`absolute inset-0 ${skin}`} />}
      <div
        className="relative flex min-h-full items-center justify-center text-center leading-snug font-medium"
        style={{
          ...pad,
          color: box.color,
          // Cỡ chữ của người dựng, ĐÚNG như họ căn. Không co, không bóp.
          fontSize: `${(box.font / 100) * 2.4}cqw`,
        }}
      >
        {dots ? <Dots /> : <Line line={line} />}
      </div>
    </div>
  );
}

function Line({ line }: { line: DialogueLine | null }) {
  if (!line) return null;
  return (
    <span className={`block whitespace-pre-line ${TONE[line.tone ?? "plain"]}`}>
      {line.text}
      {line.aside && (
        // `0.82em` và mờ đi: bản dịch phải đọc được nhưng không được tranh chỗ
        // với câu tiếng Anh — học sinh tới đây để đọc câu tiếng Anh.
        <span className="mt-[0.35em] block text-[0.82em] leading-snug opacity-70">
          {line.aside}
        </span>
      )}
    </span>
  );
}

/** Ba chấm nhấp nháy — "tôi nghe rồi, đang nghĩ". Xem ghi chú ở `quest-panel`. */
function Dots() {
  return (
    <span className="flex items-center justify-center gap-[0.3em]" aria-hidden>
      {[0, 0.18, 0.36].map((delay) => (
        <span
          key={delay}
          className="size-[0.4em] animate-pulse rounded-full bg-current opacity-45"
          style={{ animationDelay: `${delay}s`, animationDuration: "1.25s" }}
        />
      ))}
    </span>
  );
}

/**
 * Tấm ảnh mà `Actor` SẼ vẽ cho một vai ở một tư thế — hoặc `null` nếu không có.
 *
 * Cùng ba nấc lùi với `Actor`, và cố ý dùng chung một hàm: chỗ nào cần ĐỢI tấm
 * ảnh đó tải xong (xem `quest-panel.tsx`) mà tự đoán lấy URL thì sẽ có ngày đợi
 * một tấm khác với tấm đang hiện ra.
 */
export function actorImageUrl(
  actor: DialogueActor | null,
  role: DialogueRole,
  pose: DialoguePose,
): string | null {
  const sprites = actor?.sprites ?? [];
  const sheet =
    sprites.find((sprite) => sprite.action_key === pose) ??
    sprites.find((sprite) => sprite.action_key === DIALOGUE_REST[role]);
  return sheet?.url ?? actor?.avatar_url ?? null;
}

/**
 * MỘT NGƯỜI trong màn hội thoại — CHỈ tấm ảnh, không gì khác.
 *
 * Không vòng tròn, không viền sáng, không nền tối. Ảnh do người dựng vẽ đã có
 * bố cục và ánh sáng của riêng nó; đóng khung nó lại là dán một cái huy hiệu
 * tròn lên một bức tranh, và nhân vật thành cái ảnh đại diện trên một diễn đàn.
 * Cảnh chơi thật nằm ngay sau lưng, nên một nhân vật cắt nền đứng trên đó trông
 * như đang đứng TRONG cảnh — đó mới là thứ cả màn này dựng lên để tạo ra.
 *
 * Ba nấc lùi, dừng ở nấc đầu tiên có ảnh:
 *
 *   1. spritesheet của đúng tư thế đang cần,
 *   2. spritesheet của tư thế NGHỈ (`wait` cho người canh giữ, `listen` cho học
 *      sinh) — người dựng tải đúng MỘT tấm cũng đã có hội thoại chạy được,
 *   3. `avatar_url` — một tấm tĩnh, nhưng còn hơn một khung trống.
 *
 * Không có nấc thứ tư. Chưa có ảnh nào thì KHÔNG VẼ GÌ: một chữ cái đầu tên
 * trong vòng tròn là thứ duy nhất trên màn hình không thuộc về thế giới đang
 * diễn ra, và một khoảng trống thì ít ra không nói dối điều gì.
 *
 * Đứng bằng CHÂN: nhân vật đặt trên mép dưới của khối, như
 * đứng trên mặt đất. Căn giữa thì họ lơ lửng, và người dựng phải kéo cái khối
 * lệch đi để bù — một phép bù mà không gì trên màn hình giải thích.
 */
function Actor({
  actor,
  role,
  pose,
  name,
}: {
  actor: DialogueActor | null;
  role: DialogueRole;
  pose: DialoguePose;
  name: string;
}) {
  const sprites = actor?.sprites ?? [];
  const sheet =
    sprites.find((s) => s.action_key === pose) ??
    sprites.find((s) => s.action_key === DIALOGUE_REST[role]);

  if (sheet) {
    // KHÔNG truyền `fit`: `spriteFrame` sẽ thu theo một trần tính bằng pixel,
    // mà tấm bảng thì co giãn theo cửa sổ — sprite giữ nguyên cỡ pixel trong
    // khi mọi thứ quanh nó to nhỏ theo màn hình là sai ngay từ cái nhìn đầu.
    // Ở đây tự đo khối rồi thu-phóng theo nó (`SpriteFill`).
    const frame = spriteFrame({
      media_url: sheet.url,
      frames: sheet.frames,
      frame_width: sheet.frame_width,
      frame_height: sheet.frame_height,
      frame_rate: sheet.frame_rate,
    });
    return (
      <SpriteFill
        width={sheet.frame_width}
        height={sheet.frame_height}
        wrapperStyle={frame.wrapperStyle}
        style={frame.style}
      />
    );
  }

  const avatar = actor?.avatar_url;
  if (!avatar) return null;

  // `object-contain` chứ không `cover`: khối do giáo viên kéo, và cắt cụt mặt
  // một nhân vật để lấp đầy một cái hộp là hỏng đúng thứ cần giữ.
  return (
    <img
      src={avatar}
      alt={name}
      className="size-full object-contain object-bottom"
    />
  );
}

/**
 * Một khung sprite, PHÓNG cho vừa khối — theo cả hai chiều, giữ đúng tỉ lệ.
 *
 * Phóng chứ không chỉ thu: khung sprite thường là 64 hay 128 pixel, còn khối
 * người dựng kéo ra thì to hơn thế nhiều. Để nguyên cỡ gốc là một nhân vật tí
 * hon lọt thỏm giữa một khoảng trống, và người dựng không có cách nào sửa —
 * kéo khối to thêm chỉ làm khoảng trống to thêm.
 *
 * Đo bằng `ResizeObserver` chứ không tính bằng `cqw`: cỡ khung sprite là một
 * con số pixel đến từ dữ liệu, mà CSS thì không chia được một độ dài cho một độ
 * dài. Ảnh pixel-art phóng lên vẫn nét nhờ `image-rendering: pixelated` mà
 * `spriteFrame()` đã đặt sẵn.
 *
 * Gốc phóng ở ĐÁY-GIỮA: nhân vật lớn lên từ chỗ đứng, không trôi khỏi mặt đất.
 */
function SpriteFill({
  width,
  height,
  wrapperStyle,
  style,
}: {
  width: number;
  height: number;
  wrapperStyle: React.CSSProperties;
  style: React.CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  //: Cả ba con số cùng một lượt đo — chỗ đặt phụ thuộc tỉ lệ, tách ra là hai
  //: lượt vẽ và một nhịp nhân vật nhảy chỗ.
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 });

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (!w || !h || !width || !height) return;
      const scale = Math.min(w / width, h / height);
      // Căn giữa ngang, ĐÁY chạm đáy khối. Tính bằng pixel chứ không nhờ Grid
      // hay Flex căn hộ: khung sprite thật có thể cao 1376px trong một khối chỉ
      // 197px, và với một phần tử TRÀN khỏi khung thì `align-items: end` bị
      // trình duyệt hạ về `start` để không cắt mất nội dung. Kết quả: hộp nằm
      // từ mép trên khối kéo dài xuống 1376px, `transform-origin: bottom` ghim
      // vào cái đáy ở tận đó, và nhân vật hiện ra cách khối hơn 1200px — tức
      // ngoài màn hình. Đã gặp thật, và không có gì trên màn hình nói vì sao.
      setFit({
        scale,
        left: (w - width * scale) / 2,
        top: h - height * scale,
      });
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, [width, height]);

  return (
    <div ref={box} className="relative size-full">
      <div
        style={{
          ...wrapperStyle,
          position: "absolute",
          left: fit.left,
          top: fit.top,
          transform: `scale(${fit.scale})`,
          // Góc TRÊN-TRÁI: cùng gốc với phép tính `left`/`top` ở trên, nên hộp
          // sau khi thu nằm đúng vào chỗ vừa tính. Mọi gốc khác là một phép bù
          // thứ hai phải nhớ, và là chỗ vừa sai.
          transformOrigin: "top left",
        }}
      >
        <div style={style} />
      </div>
    </div>
  );
}

/** Danh sách khối, để trình thiết kế và màn chơi duyệt cùng một thứ tự. */
export { DIALOGUE_BLOCK_KEYS };
