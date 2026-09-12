"""Các DỊCH VỤ đọc chữ thành tiếng, sau một cái cửa chung.

Mỗi nhà cung cấp chỉ phải trả lời đúng một câu: *bạn có những giọng nào*. Phần
còn lại — lưu vào đâu, lọc thế nào, giao diện vẽ ra sao — không ai trong này
biết, và đó là chủ ý: thêm minimax hay gemini-tts là thêm MỘT lớp ở file này
cộng một dòng trong `PROVIDERS`, không phải một migration và không phải sửa
giao diện.

Danh sách nhà cung cấp cũng đi xuống giao diện qua `GET /voices/providers`, nên
ô chọn đầu tiên không có tên nào viết cứng ở client.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.errors import ConflictError, ErrorCode
from app.core.logging import logger


@dataclass(frozen=True)
class VoiceRecord:
    """Một giọng, đã gạn về đúng những gì kho của ta cần.

    Nhà cung cấp nào cũng trả về một đống trường riêng của họ — hạng tài khoản,
    mã model, trạng thái gán nhãn. Gạn ngay ở cửa vào chứ không bê nguyên vào
    database: giữ lại thứ không ai đọc thì đến ngày đổi nhà cung cấp, không ai
    dám bỏ vì không biết chỗ nào đang dùng.
    """

    external_id: str
    name: str
    gender: str | None
    age_group: str | None
    accent: str | None
    style: str | None
    use_case: str | None
    language: str
    preview_url: str | None


class VoiceProvider(Protocol):
    key: str

    async def fetch(self, language: str) -> list[VoiceRecord]: ...

    async def speak(
        self, text: str, external_voice_id: str, *, pcm_rate: int | None = None
    ) -> bytes: ...

    async def speak_parts(
        self, parts: list[str], external_voice_id: str, *, pcm_rate: int
    ) -> list[bytes]: ...

    async def health(self) -> dict[str, object]: ...


class ElevenLabsProvider:
    """https://elevenlabs.io — nhà cung cấp mặc định."""

    key = "elevenlabs"
    base_url = "https://api.elevenlabs.io/v1"

    async def fetch(self, language: str) -> list[VoiceRecord]:
        if not settings.elevenlabs_api_key:
            raise ConflictError(ErrorCode.CONFLICT, field="ELEVENLABS_API_KEY")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.base_url}/voices",
                headers={"xi-api-key": settings.elevenlabs_api_key},
            )
        response.raise_for_status()

        out: list[VoiceRecord] = []
        for item in response.json().get("voices", []):
            labels = item.get("labels") or {}
            # LỌC THEO NGÔN NGỮ ngay ở đây. Tài khoản này có cả giọng tiếng Việt,
            # mà game dạy tiếng Anh — kéo hết về rồi để giao diện lọc là bắt
            # người dựng cuộn qua ba mươi giọng họ không bao giờ dùng.
            if (labels.get("language") or "en") != language:
                continue
            out.append(
                VoiceRecord(
                    external_id=item["voice_id"],
                    name=item.get("name") or item["voice_id"],
                    gender=labels.get("gender"),
                    # ElevenLabs gọi là `age`, ta gọi là `age_group` — "age" trần
                    # trụi trông như một con số, mà đây là một nhóm.
                    age_group=labels.get("age"),
                    accent=labels.get("accent"),
                    style=labels.get("descriptive"),
                    use_case=labels.get("use_case"),
                    language=language,
                    preview_url=item.get("preview_url"),
                )
            )

        logger.info("elevenlabs.voices.fetched", count=len(out), language=language)
        return out

    async def health(self) -> dict[str, object]:
        """API còn sống không, và còn bao nhiêu ký tự.

        KHÔNG tốn một ký tự nào: chỉ hỏi thông tin tài khoản. Bấm kiểm tra mà
        mất tiền thì người ta ngại bấm, và cái nút thành vô dụng đúng lúc cần.

        Trả về `ok=False` kèm lý do thay vì ném lỗi: "khoá sai" và "hết hạn
        mức" là hai việc phải sửa ở hai chỗ khác nhau, mà một mã lỗi 500 thì
        nói cả hai thành một.
        """
        if not settings.elevenlabs_api_key:
            return {"ok": False, "reason": "no_key"}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    f"{self.base_url}/user/subscription",
                    headers={"xi-api-key": settings.elevenlabs_api_key},
                )
        except httpx.HTTPError as exc:
            logger.warning("elevenlabs.health.unreachable", error=str(exc))
            return {"ok": False, "reason": "unreachable"}

        if response.status_code in (401, 403):
            return {"ok": False, "reason": "bad_key"}
        if response.status_code >= 400:
            return {"ok": False, "reason": f"http_{response.status_code}"}

        data = response.json()
        used = int(data.get("character_count") or 0)
        limit = int(data.get("character_limit") or 0)
        return {
            "ok": True,
            "tier": data.get("tier"),
            "characters_used": used,
            "characters_limit": limit,
            # Số CÒN LẠI là thứ người dựng thật sự cần trước khi bấm sinh cả mẻ.
            "characters_left": max(0, limit - used),
        }

    async def speak(
        self, text: str, external_voice_id: str, *, pcm_rate: int | None = None
    ) -> bytes:
        """Đọc một đoạn chữ, trả về mp3 — hoặc PCM thô nếu có `pcm_rate`.

        `eleven_multilingual_v2` chứ không phải bản `flash`: đây là tiếng đọc
        cho học sinh nghe đi nghe lại, sinh MỘT LẦN rồi lưu — chất giọng đáng
        giá hơn vài trăm mili giây độ trễ mà không ai chờ.
        """
        audio, _ = await self._post(text, external_voice_id, pcm_rate=pcm_rate)
        return audio

    async def speak_parts(
        self, parts: list[str], external_voice_id: str, *, pcm_rate: int
    ) -> list[bytes]:
        """Đọc NHIỀU khúc của CÙNG MỘT câu, sao cho ghép lại vẫn liền mạch.

        Đây là đường của câu điền khuyết: lời đề bị cắt tại mỗi ô trống, đọc
        từng khúc, rồi khâu lại quanh tiếng bíp.

        Đọc thẳng từng khúc thì mỗi khúc ra một câu riêng — `"The team"` bị hạ
        giọng ở cuối như đã hết câu, `"Orion yet."` mở đầu như vừa hít vào. Ghép
        lại nghe rời rạc, và đó chính là thứ nghe ra ngay khi nghe thử.
        ElevenLabs có sẵn ba tham số cho đúng bệnh này:

          - `previous_text` / `next_text` — phần chữ đứng trước và sau khúc đang
            đọc. KHÔNG được đọc ra, chỉ dùng để biết câu này đang đi tới đâu.
          - `previous_request_ids` — mã của những lượt sinh TRƯỚC đó, để lượt
            này nối tiếp đúng hơi và đúng cao độ của tiếng vừa sinh ra, chứ
            không chỉ đoán từ chữ.

        Tối đa ba mã gần nhất; nhà cung cấp không nhận nhiều hơn.
        """
        out: list[bytes] = []
        request_ids: list[str] = []

        for index, part in enumerate(parts):
            audio, request_id = await self._post(
                part,
                external_voice_id,
                pcm_rate=pcm_rate,
                previous_text=" ".join(parts[:index]) or None,
                next_text=" ".join(parts[index + 1 :]) or None,
                previous_request_ids=request_ids[-3:],
            )
            out.append(audio)
            if request_id:
                request_ids.append(request_id)

        return out

    async def _post(
        self,
        text: str,
        external_voice_id: str,
        *,
        pcm_rate: int | None = None,
        previous_text: str | None = None,
        next_text: str | None = None,
        previous_request_ids: list[str] | None = None,
    ) -> tuple[bytes, str | None]:
        """Một lượt gọi. Trả về (tiếng, mã lượt).

        Mã lượt đi ra ngoài vì lượt SAU cần nó để nối mạch — xem `speak_parts`.

        Timeout rộng tay: một đoạn hai ba câu mất vài giây, và cắt giữa chừng
        thì vẫn mất tiền mà không có file nào.
        """
        if not settings.elevenlabs_api_key:
            raise ConflictError(ErrorCode.CONFLICT, field="ELEVENLABS_API_KEY")

        body: dict[str, object] = {"text": text, "model_id": "eleven_multilingual_v2"}
        if previous_text:
            body["previous_text"] = previous_text
        if next_text:
            body["next_text"] = next_text
        if previous_request_ids:
            body["previous_request_ids"] = previous_request_ids

        async with httpx.AsyncClient(timeout=120) as client:
            # QUÁ TẢI thì LÙI LẠI, đừng bỏ cuộc.
            #
            # Sinh cả mẻ chạy nhiều luồng cùng lúc, và trần số luồng của nhà
            # cung cấp thay đổi theo hạng tài khoản — không đoán đúng được từ
            # đây. Không thử lại thì đặt số luồng quá tay một chút là cả mẻ hỏng
            # lẻ tẻ: vài câu có tiếng, vài câu không, và không ai biết câu nào.
            #
            # Lùi theo cấp số nhân, tôn trọng `Retry-After` nếu họ gửi. Bốn lần
            # là đủ cho một cơn nghẽn ngắn; nghẽn lâu hơn thì số luồng đang đặt
            # sai, và lỗi ném ra nói đúng điều đó.
            for lan in range(4):
                response = await client.post(
                    f"{self.base_url}/text-to-speech/{external_voice_id}",
                    headers={
                        "xi-api-key": settings.elevenlabs_api_key,
                        "accept": "audio/pcm" if pcm_rate else "audio/mpeg",
                    },
                    params={"output_format": f"pcm_{pcm_rate}"} if pcm_rate else {},
                    json=body,
                )
                if response.status_code != 429 or lan == 3:
                    break
                cho = float(response.headers.get("retry-after") or 0) or 2**lan
                logger.warning("elevenlabs.busy", wait=cho, attempt=lan + 1)
                await asyncio.sleep(cho)

        response.raise_for_status()
        return response.content, response.headers.get("request-id")


#: Sổ đăng ký. Thêm một nhà cung cấp = thêm một dòng ở đây.
PROVIDERS: dict[str, VoiceProvider] = {
    ElevenLabsProvider.key: ElevenLabsProvider(),
}

#: Nhà cung cấp mặc định của ô chọn đầu tiên.
DEFAULT_PROVIDER = ElevenLabsProvider.key
