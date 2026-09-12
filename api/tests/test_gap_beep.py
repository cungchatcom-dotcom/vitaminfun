"""Test cho tieng BIP thay cho o trong trong cau dien khuyet.

Vi sao dang mot file test rieng: cai hong o day khong bao loi bao gio. Cat sai
mot khuc thi may van doc, van luu, van phat — chi la hoc sinh nghe thay "dau
ngoac nhon mot" giua cau, hoac nghe thieu han mot cho trong roi khong hieu vi
sao minh dien sai. Khong co exception nao ne ra, va khong ai xem lai file wav.

Nen ba thu duoc chot lai bang test: CAT dung so khuc, DEM dung so tieng bip, va
tieng bip TO vua tai so voi giong doc.
"""

from __future__ import annotations

import io
import math
import struct
import wave

from app.modules.voices import beep
from app.modules.voices import tts
from app.modules.voices.tts import GAP_MARK, segments


def _gaps(parts: list[str | None]) -> int:
    return sum(1 for p in parts if p is None)


def test_cat_cau_thanh_khuc_va_cho_trong() -> None:
    assert segments("She {{1}} to school.") == ["She", None, "to school."]


def test_o_trong_dung_dau_cau() -> None:
    """Khong duoc de ra mot khuc rong o dau — gui chuoi rong sang nha cung cap
    la mot lan tra tien cho khong co gi."""
    assert segments("{{1}} is a cat.") == [None, "is a cat."]


def test_hai_o_trong_dinh_nhau_van_ra_hai_tieng_bip() -> None:
    parts = segments("a {{1}}{{2}} b")
    assert _gaps(parts) == 2
    assert parts == ["a", None, None, "b"]


def test_khuc_chi_co_dau_cau_thi_bo() -> None:
    """`... and {{2}}.` cat ra mot khuc cuoi la dung mot dau cham. Dau cham cuoi
    cau khong phat ra thanh tieng, ma gui di van tinh tien."""
    assert segments("made of {{1}} and {{2}}.") == ["made of", None, "and", None]


def test_cau_khong_co_o_trong_giu_nguyen_mot_khuc() -> None:
    """Khong co o trong thi phai di duong mp3 mot lan goi, khong cat gi ca."""
    parts = segments("No gaps here.")
    assert parts == ["No gaps here."]
    assert _gaps(parts) == 0


def test_cau_chi_co_moi_o_trong() -> None:
    """Khong con chu nao de doc: khong goi nha cung cap lan nao."""
    assert segments("{{1}}") == [None]


def test_mark_hien_cho_nguoi_dung_khong_phai_chu() -> None:
    """Nguoi dung nhin thay mot vet trong, khong phai mot tu tieng Anh nao."""
    assert not any(ch.isalnum() for ch in GAP_MARK)


def test_bip_la_mot_hinh_sin_dung_cao_do() -> None:
    pcm = beep.beep_pcm(0.2)
    data = struct.unpack(f"<{len(pcm) // 2}h", pcm)

    # Dem so lan doi dau -> tan so. Mot hinh sin sach thi con so nay khop han.
    core = [s for s in data if s]
    crossings = sum(1 for a, b in zip(core, core[1:]) if (a >= 0) != (b >= 0))
    seconds = len(core) / beep.SAMPLE_RATE
    assert abs(crossings / 2 / seconds - beep.BEEP_HZ) < 20


def test_bip_co_lang_hai_ben() -> None:
    """Khong co khoang lang thi bip dinh vao tu truoc va tu sau."""
    pcm = beep.beep_pcm(0.2)
    pad = int(beep.SAMPLE_RATE * beep.PAD_MS / 1000) * 2
    assert pcm[:pad] == b"\x00" * pad
    assert pcm[-pad:] == b"\x00" * pad


def test_bip_khong_mo_dau_bang_mot_cu_nhay() -> None:
    """Vuot mo dau: mau dau tien cua phan co tieng phai gan khong, neu khong
    thi phat ra mot tieng 'tach'."""
    pcm = beep.beep_pcm(0.35)
    pad = int(beep.SAMPLE_RATE * beep.PAD_MS / 1000) * 2
    first = struct.unpack("<h", pcm[pad : pad + 2])[0]
    assert abs(first) < 0.02 * 32767


def test_do_to_bam_theo_giong_doc() -> None:
    """Giong to thi bip to theo, giong nho thi bip nho theo — do la ca ly do
    `level_for` ton tai."""
    quiet = beep.level_for(_tone(1500))
    loud = beep.level_for(_tone(6000))
    assert quiet < loud
    assert beep.rms(beep.beep_pcm(loud)) > beep.rms(beep.beep_pcm(quiet))


def test_do_to_bi_chan_hai_dau() -> None:
    assert beep.level_for(_tone(400)) == beep.LEVEL_MIN
    assert beep.level_for(_tone(30000)) == beep.LEVEL_MAX


def test_khong_co_giong_nao_de_do() -> None:
    """Loi de chi co moi o trong: khong do duoc gi, phai co mot muc mac dinh."""
    assert beep.level_for(b"") == beep.LEVEL_ALONE


def test_doan_im_lim_khong_bi_hieu_la_giong_rat_nho() -> None:
    """Ca doan nam duoi nguong im thi coi nhu KHONG do duoc, chu khong phai do
    ra mot con so ti hon roi ha bip xuong muc khong ai nghe thay."""
    assert beep.level_for(_tone(50)) == beep.LEVEL_ALONE


def test_quang_lang_khong_keo_phep_do_xuong() -> None:
    """May doc chu nao cung de mot quang lang dau va cuoi. Tinh ca quang do vao
    thi mot cau ngan hoa ra 'nho tieng' chi vi no ngan."""
    speech = _tone(4000)
    padded = b"\x00\x00" * beep.SAMPLE_RATE + speech + b"\x00\x00" * beep.SAMPLE_RATE
    assert abs(beep.rms(padded) - beep.rms(speech)) < 1


def test_wav_doc_duoc_bang_trinh_duyet() -> None:
    """Mot kenh, 16-bit, dung tan so lay mau — sai mot cai la trinh duyet phat
    ra tieng ri hoac tu choi han."""
    data = beep.to_wav(beep.beep_pcm(0.2))
    with wave.open(io.BytesIO(data)) as w:
        assert w.getnchannels() == 1
        assert w.getsampwidth() == 2
        assert w.getframerate() == beep.SAMPLE_RATE


def _tone(amplitude: int) -> bytes:
    """Mot doan PCM gia, to dung bang `amplitude` (dinh)."""
    return b"".join(
        struct.pack("<h", int(math.sin(2 * math.pi * 200 * i / beep.SAMPLE_RATE) * amplitude))
        for i in range(beep.SAMPLE_RATE // 2)
    )


# --------------------------------------------------------------------------
# O trong viet bang GACH DUOI
#
# Day la cach viet DONG HON trong kho cau hoi that: nguoi soan go thang `___`
# vao loi de cua cau trac nghiem, chu khong dung ma o `{{n}}` cua trinh soan.
# Bo sot no thi khong co loi nao nem ra — cau van sinh duoc audio, chi la may
# doc nguyen may cai gach duoi. Hong kieu chi phat hien duoc bang cach NGHE.
# --------------------------------------------------------------------------


def test_gach_duoi_cung_la_o_trong() -> None:
    assert segments("The team ___ three matching clues.") == [
        "The team",
        None,
        "three matching clues.",
    ]


def test_hai_o_gach_duoi_trong_mot_cau() -> None:
    parts = segments("The team ___ three clues, but they ___ Orion yet.")
    assert _gaps(parts) == 2
    assert parts == ["The team", None, "three clues, but they", None, "Orion yet."]


def test_gach_duoi_do_dai_bat_ky() -> None:
    """Nguoi soan go bao nhieu gach la tuy tay ho, khong phai mot quy uoc."""
    for blank in ("__", "___", "__________"):
        assert segments(f"She {blank} home.") == ["She", None, "home."]


def test_gach_duoi_GIUA_TU_thi_khong_phai_o_trong() -> None:
    """`snake_case` hay `text_file` la mot tu, khong phai mot cho de dien —
    doc no thanh mot tieng bip la doc sai han cau."""
    assert segments("Open the text_file now.") == ["Open the text_file now."]


def test_lan_lon_hai_cach_viet_trong_cung_mot_cau() -> None:
    parts = segments("She {{1}} and he ___ too.")
    assert _gaps(parts) == 2


# --------------------------------------------------------------------------
# LOI CHIA TAY cua nguoi canh giu
# --------------------------------------------------------------------------


class _FakeStage:
    def __init__(self, outro):
        self.advisor_outro_i18n = outro


def test_loi_chia_tay_doc_ban_TIENG_ANH() -> None:
    """Nguoi canh giu noi tieng Anh, ke ca khi hoc sinh dang xem giao dien tieng
    Viet: ca tro choi nay day tieng Anh, va chu tieng Viet canh trinh phat la ban
    dich de doc theo, khong phai loi thoai."""
    stage = _FakeStage({"en": "Take this handbook.", "vi": "Cam lay cuon so tay nay."})
    assert tts.outro_text(stage) == "Take this handbook."


def test_chua_co_ban_tieng_anh_thi_doc_ban_co_san() -> None:
    """Tha doc bang thu tieng co san con hon im lang ma khong noi vi sao."""
    assert tts.outro_text(_FakeStage({"vi": "Cam lay cuon so tay."})) == "Cam lay cuon so tay."


def test_chua_soan_loi_chia_tay() -> None:
    assert tts.outro_text(_FakeStage({})) == ""
    assert tts.outro_text(_FakeStage({"en": "   "})) == ""


def test_loi_chia_tay_cung_di_duong_bip_neu_co_o_trong() -> None:
    """Khong co luat rieng cho loi chia tay: no di qua dung `speak()` nhu moi
    doan chu khac, nen mot o trong trong do cung ra tieng bip."""
    assert _gaps(segments(tts.outro_text(_FakeStage({"en": "Find the ___ key."})))) == 1
