'use client';

import { useEffect, useRef } from 'react';

import {
  ambientFromVideo,
  readAudio,
  resolveAudio,
  type AudioSurface,
  type AudioTrack,
} from '@/game/audio';

import type { BackgroundKind } from '@/lib/media';

import { useMusicPrefs } from './music-controls';

/**
 * Nhạc nền cho các màn DOM của học sinh — bản đồ thiên hà và phòng chờ world.
 *
 * Màn chơi không dùng cái này: nó chạy trong Phaser và có trình phát riêng
 * (`StageScene.startAudio`). Nhưng cả hai đều đọc cấu hình qua `resolveAudio()`
 * và cùng tuân theo `useMusicPrefs()`, nên tắt nhạc ở đâu thì im ở mọi màn.
 *
 * ## MỘT nguồn sự thật: tuỳ chọn của người chơi
 *
 * Bản trước có hai đường điều khiển đánh nhau — một `useEffect` tự phát sau cú
 * chạm đầu tiên, và một hàm `toggle()` bật/tắt bằng tay. Hậu quả là một lỗi
 * nhìn thì vô lý: cú bấm vào chính cái nút loa CŨNG LÀ cú chạm đầu tiên, nên nó
 * vừa mở nhạc (do listener) vừa tắt ngay (do toggle) — người chơi phải bấm hai
 * lần mới nghe được.
 *
 * Giờ chỉ còn một chiều: `prefs.on` là sự thật, và một `useEffect` kéo thẻ
 * `<audio>` về đúng trạng thái đó. Cái nút chỉ đổi tuỳ chọn, không tự đụng vào
 * trình phát. Không còn hai thứ cùng ra lệnh thì không còn chỗ để chúng cãi nhau.
 */
export function AmbientPlayer({
  audio,
  audioUrls,
  surface,
  backgroundKind,
}: {
  audio: unknown;
  audioUrls: Record<string, string> | undefined;
  surface: AudioSurface;
  /**
   * Nền của màn này là ảnh hay video.
   *
   * Cần biết vì nhạc nền có thể đang đến TỪ CHÍNH TẤM NỀN. Lúc đó thẻ `<audio>`
   * ở đây phải im hẳn, nếu không thì hai nguồn tiếng chồng lên nhau — đúng thứ
   * giáo viên vừa bảo là không muốn khi họ bật cờ.
   */
  backgroundKind?: BackgroundKind | null;
}) {
  const player = useRef<HTMLAudioElement>(null);
  const [prefs] = useMusicPrefs();
  // Tuỳ chọn MỚI NHẤT, để listener đọc lại được — xem `retry` bên dưới.
  const liveOn = useRef(prefs.on);
  liveOn.current = prefs.on;

  const map = readAudio(audio, surface);
  const track: AudioTrack | undefined = map.ambient;
  // Tiếng đến từ video nền thì KHÔNG có URL nào ở đây cả, và thẻ `<audio>` không
  // được dựng ra. Tắt bằng cách bỏ nguồn chứ không bằng một cờ `paused`: một thẻ
  // đang tạm dừng vẫn là một thứ có thể bị bật lại do nhầm.
  const url = ambientFromVideo(map, backgroundKind) ? undefined : audioUrls?.ambient;
  const spec = resolveAudio('ambient', track);
  // Âm lượng của giáo viên NHÂN với âm lượng tổng của người chơi: giữ nguyên
  // cân bằng giữa các khối, người chơi vặn to nhỏ cả bản phối.
  const volume = spec.volume * prefs.master;

  // Âm lượng, tốc độ và cờ lặp ghi THẲNG vào phần tử: React không nhận chúng
  // như thuộc tính JSX trên `<audio>`.
  useEffect(() => {
    const el = player.current;
    if (!el) return;
    el.volume = volume;
    el.playbackRate = spec.rate;
    el.loop = spec.loop;
  }, [volume, spec.rate, spec.loop, url]);

  // Kéo trình phát về đúng `prefs.on`. Chạy lại mỗi khi tuỳ chọn hoặc bản nhạc
  // đổi, nên nó cũng là chỗ xử lý chuyện trình duyệt CHẶN âm thanh tự chạy:
  // thử phát, bị từ chối thì đợi cú chạm đầu tiên rồi thử lại. Chỉ MỘT chỗ ra
  // lệnh cho trình phát, nên cú bấm nút không bao giờ giành nhau với nó.
  useEffect(() => {
    const el = player.current;
    if (!el || !url) return;

    if (!prefs.on) {
      el.pause();
      return;
    }

    let huy = false;
    const retry = () => {
      // Đọc lại tuỳ chọn NGAY LÚC NÀY, không tin vào giá trị bắt được lúc gắn.
      //
      // Cú bấm vào chính cái nút loa cũng là một `pointerdown` trên `window`,
      // và nó chạy SAU handler của React. Không kiểm lại thì thứ tự thành: tắt
      // nhạc → rồi vẫn phát → rồi effect mới dọn dẹp và tắt lại. Người chơi
      // nghe thấy một nhịp chớp đúng vào lúc họ vừa bảo im.
      if (huy || !liveOn.current) return;
      void el.play().catch(() => undefined);
    };

    void el.play().catch(() => {
      // Chưa ai chạm vào trang. Đây là luật của trình duyệt, không phải lỗi —
      // đợi cú chạm đầu tiên rồi vào nhạc.
      if (huy) return;
      window.addEventListener('pointerdown', retry, { once: true });
      window.addEventListener('keydown', retry, { once: true });
    });

    return () => {
      huy = true;
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
    };
  }, [prefs.on, url]);

  if (!url) return null;

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio ref={player} src={url} preload="auto" />;
}

/**
 * Thông số tiếng để giao cho `BackgroundLayer`, khi nhạc nền lấy từ video nền.
 *
 * `null` = video phải câm (nền là ảnh tĩnh, hoặc giáo viên không bật cờ, hoặc
 * nhạc đang đến từ một file tải riêng).
 *
 * Ở đây thay vì viết lại trong `GalaxyMap` và `WorldLobby`: hai màn ấy giống
 * nhau đến từng dòng, và phép nhân "âm lượng của giáo viên × âm lượng tổng của
 * người chơi" là thứ chỉ được có MỘT bản.
 */
export function useAmbientVideoSound(
  audio: unknown,
  backgroundKind: BackgroundKind | null | undefined,
  surface: AudioSurface,
): { on: boolean; volume: number } | null {
  const [prefs] = useMusicPrefs();
  const map = readAudio(audio, surface);
  if (!ambientFromVideo(map, backgroundKind)) return null;
  return { on: prefs.on, volume: resolveAudio('ambient', map.ambient).volume * prefs.master };
}
