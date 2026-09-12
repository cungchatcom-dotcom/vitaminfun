"""Tiếng BÍP thay cho ô trống, và cách ghép nó vào giữa lời đọc.

Câu điền khuyết đọc lên thì chỗ khuyết phải NGHE THẤY được. Máy đọc chữ chỉ biết
đọc chữ: đưa `{{1}}` vào thì nó đọc "dấu ngoặc nhọn một", đưa chữ "blank" vào thì
lời đề bỗng có thêm một từ tiếng Anh mà học sinh phải học cách bỏ qua. Cả hai đều
dạy nhầm.

Nên chỗ khuyết không sinh ra từ máy đọc chữ nữa — nó là một tiếng bíp ta tự dựng
lấy, và lời đề được đọc thành từng khúc rồi khâu lại quanh những tiếng bíp đó.

## Vì sao là PCM chứ không phải mp3

Nối hai file mp3 bằng cách dán byte thì đôi khi chạy, đôi khi ra tiếng lụp bụp ở
mối nối, tuỳ trình duyệt — mp3 chia khung, mà mối nối không rơi đúng biên khung.
Xin nhà cung cấp trả về PCM thô thì mỗi mẫu là một con số, nối là nối thật, và
gói lại thành WAV bằng `wave` của thư viện chuẩn. Không thêm ffmpeg, không thêm
gói ngoài, và không có mối nối nào phải đoán.

Đổi lại file WAV nặng hơn mp3 chừng mười lần. Chấp nhận được vì CHỈ câu điền
khuyết đi đường này; câu thường vẫn là một lần gọi, vẫn ra mp3.
"""

from __future__ import annotations

import io
import math
import struct
import wave

#: Tần số lấy mẫu xin từ nhà cung cấp. 24 kHz đủ trong cho tiếng nói, và là mức
#: PCM mọi hạng tài khoản đều lấy được — `pcm_44100` thì không.
SAMPLE_RATE = 24_000

#: Cao độ tiếng bíp. Chọn quãng cao hẳn so với giọng người (nam ~120 Hz, nữ
#: ~220 Hz) để tai không nhầm nó là một âm tiết trong câu.
BEEP_HZ = 880

#: Bíp dài bao lâu. Đủ để nghe rõ là một chỗ trống, đủ ngắn để không cắt mạch câu.
BEEP_MS = 500

#: Khoảng LẶNG hai bên tiếng bíp. Không có nó thì bíp dính vào từ trước và từ
#: sau, nghe như một tiếng rít giữa câu chứ không phải một chỗ để điền.
PAD_MS = 220

#: Vuốt mở đầu và vuốt tắt. Cắt cụt một hình sin đang giữa chừng thì cái nhảy
#: biên độ ấy phát ra thành một tiếng "tách".
FADE_MS = 15

#: Bíp to bằng bao nhiêu lần GIỌNG ĐỌC vừa sinh ra.
#:
#: Không đặt được một mức tuyệt đối: đo trên hai giọng thật của cùng nhà cung
#: cấp cho ra 1800 và 5000 RMS — gần ba lần. Một con số cố định thì hoặc chìm
#: dưới giọng này, hoặc quát vào tai người nghe giọng kia. Nên bíp được chỉnh
#: theo chính đoạn nó sắp nằm vào giữa.
#:
#: Nhỉnh hơn một chút chứ không bằng: chỗ trống phải nổi lên khỏi câu.
LEVEL_VS_SPEECH = 1.2

#: Chặn hai đầu, phòng khi phép đo đi lạc — một giọng thu quá nhỏ thì bíp
#: không được rơi xuống mức không nghe thấy, và một đoạn có tiếng ồn nền thì
#: bíp không được vọt lên mức vỡ tiếng.
LEVEL_MIN = 0.05
LEVEL_MAX = 0.35

#: Dùng khi KHÔNG có giọng nào để đo — lời đề chỉ có mỗi ô trống.
LEVEL_ALONE = 0.15

_PEAK = 32767


def _silence(ms: int, rate: int) -> bytes:
    return b"\x00\x00" * int(rate * ms / 1000)


#: Dưới mức này coi như im lặng, không tính vào phép đo.
_FLOOR = 300


def rms(pcm: bytes) -> float:
    """Độ to trung bình của PHẦN CÓ TIẾNG trong một đoạn PCM.

    Bỏ những mẫu gần im: máy đọc chữ nào cũng để một quãng lặng đầu và cuối, mà
    tính cả quãng đó vào thì một câu ngắn hoá ra "nhỏ tiếng" chỉ vì nó ngắn.
    """
    if not pcm:
        return 0.0
    raw = struct.unpack(f"<{len(pcm) // 2}h", pcm[: len(pcm) // 2 * 2])
    samples = [s for s in raw if abs(s) > _FLOOR]
    if not samples:
        return 0.0
    return math.sqrt(sum(s * s for s in samples) / len(samples))


def level_for(speech: bytes) -> float:
    """Bíp nên to cỡ nào để vừa với đoạn giọng đọc này."""
    measured = rms(speech)
    if measured <= 0:
        return LEVEL_ALONE
    # RMS của hình sin biên độ A là A/√2 — đi ngược lại để ra biên độ cần.
    want = measured * LEVEL_VS_SPEECH * math.sqrt(2) / _PEAK
    return min(LEVEL_MAX, max(LEVEL_MIN, want))


def beep_pcm(level: float = LEVEL_ALONE, rate: int = SAMPLE_RATE) -> bytes:
    """Một tiếng bíp hoàn chỉnh: lặng · bíp có vuốt · lặng."""
    count = int(rate * BEEP_MS / 1000)
    fade = max(1, int(rate * FADE_MS / 1000))
    samples = bytearray()

    for i in range(count):
        # Vuốt tuyến tính hai đầu; giữa thì để nguyên.
        gain = min(1.0, i / fade, (count - i) / fade)
        value = math.sin(2 * math.pi * BEEP_HZ * i / rate) * level * gain
        samples += struct.pack("<h", int(value * _PEAK))

    pad = _silence(PAD_MS, rate)
    return pad + bytes(samples) + pad


def to_wav(pcm: bytes, rate: int = SAMPLE_RATE) -> bytes:
    """Gói PCM 16-bit một kênh thành WAV.

    Trình duyệt không đọc được PCM trần: nó cần cái đầu file nói cho biết mỗi
    mẫu mấy byte và một giây bao nhiêu mẫu.
    """
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(pcm)
    return buffer.getvalue()
