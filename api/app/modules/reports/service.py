"""Nghiệp vụ báo cáo: đọc, gộp, đếm. KHÔNG ghi gì cả.

Ba luật xuyên suốt module này, vi phạm chỗ nào là báo cáo nói dối chỗ đó:

1. **BỎ lượt chơi thử.** `stage_runs.is_trial` bật cho mọi lượt của giáo viên và
   admin. Một buổi chiều dựng nội dung có thể sinh ra vài chục lượt như thế, và
   nếu chúng lọt vào đây thì "hôm nay có bao nhiêu người chơi" đếm cả người
   đang soạn bài.

2. **BỎ bot.** `stage_run_players.user_id` là NULL với bot. Mọi phép đếm người
   đều phải loại chúng ra, không thì số người chơi phình lên theo số ghế trống.

3. **Lọc theo world thì lọc qua `stages -> chapters -> worlds`.** `stage_runs`
   không giữ `world_id`; đi tắt bằng cách đoán từ đâu đó khác là tạo ra một
   nguồn thứ hai cho một quan hệ đã có sẵn.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Float, Select, and_, case, cast, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.content import Chapter, Stage, World
from app.db.models.progress import MapShardOwned, StageProgress, WorldProgress
from app.db.models.run import RunStatus, StageRun, StageRunPlayer
from app.db.models.user import User, UserRole

#: Trần cho danh sách lượt chơi gần đây trong hộp thoại chi tiết.
RECENT_RUNS_LIMIT = 40

#: Số ngày của biểu đồ cột.
DAILY_DAYS = 14


def _mui_gio() -> ZoneInfo:
    """Múi giờ cắt ngày. Cấu hình sai thì lùi về UTC chứ không làm sập báo cáo."""
    try:
        return ZoneInfo(settings.reports_timezone)
    except Exception:  # noqa: BLE001 — tên múi giờ là chuỗi người gõ vào .env
        return ZoneInfo("UTC")


def _nua_dem(ngay_truoc: int = 0) -> datetime:
    """Mốc 00:00 của ngày hôm nay lùi `ngay_truoc` ngày, theo múi giờ báo cáo."""
    tz = _mui_gio()
    hom_nay = datetime.now(tz).date() - timedelta(days=ngay_truoc)
    return datetime.combine(hom_nay, datetime.min.time(), tzinfo=tz)


def _loc_world(stmt: Select, world_id: uuid.UUID | None) -> Select:
    """Thu hẹp một truy vấn đã JOIN `StageRun` về đúng một world."""
    if world_id is None:
        return stmt
    return (
        stmt.join(Stage, Stage.id == StageRun.stage_id)
        .join(Chapter, Chapter.id == Stage.chapter_id)
        .where(Chapter.world_id == world_id)
    )


#: THỜI LƯỢNG MỘT LƯỢT — đọc thẳng cột, KHÔNG chặn trần lần nữa ở đây.
#:
#: Trần đã được áp ở đúng chỗ nó thuộc về: `play/service.py::thoi_luong_choi()`,
#: lúc chốt lượt chơi, bằng giới hạn giờ trong ĐỀ BÀI ĐÃ ĐÓNG BĂNG của chính
#: lượt ấy. Chặn thêm một lần ở đây bằng `stages.time_limit_seconds` HIỆN TẠI là
#: một luật thứ hai đọc một nguồn khác: người dựng hạ giới hạn giờ của màn xuống
#: thì mọi lượt chơi CŨ tự nhiên ngắn lại trong báo cáo, dù chúng đã được chấm
#: xong theo luật cũ.
#:
#: Dữ liệu ghi trước bản vá ấy được nắn lại một lần bằng
#: `scripts/fix_run_durations.py`.
THOI_LUONG = StageRun.duration_seconds


# ---------------------------------------------------------------------------
# TỔNG QUAN
# ---------------------------------------------------------------------------


async def dem_theo_cua_so(
    db: AsyncSession,
    world_id: uuid.UUID | None,
    *,
    cot,
) -> dict[str, int]:
    """Đếm `cot` theo bốn cửa sổ thời gian bằng MỘT lần quét bảng.

    Bốn câu `SELECT count(...)` riêng cho bốn mốc là bốn lần quét cùng một tập
    dòng. `count(... FILTER (WHERE ...))` của PostgreSQL làm cả bốn trong một
    lượt, và đó cũng là cách viết ra ý định rõ nhất: bốn con số này là BỐN LÁT
    CẮT của cùng một tập, không phải bốn phép đo độc lập.
    """
    hom_nay = _nua_dem()
    bay_ngay = _nua_dem(6)
    ba_muoi = _nua_dem(29)

    stmt = select(
        func.count(distinct(cot)).filter(StageRun.started_at >= hom_nay),
        func.count(distinct(cot)).filter(StageRun.started_at >= bay_ngay),
        func.count(distinct(cot)).filter(StageRun.started_at >= ba_muoi),
        func.count(distinct(cot)),
    ).select_from(StageRun)

    if cot is not StageRun.id:
        stmt = stmt.join(StageRunPlayer, StageRunPlayer.stage_run_id == StageRun.id).where(
            StageRunPlayer.user_id.is_not(None)
        )

    stmt = _loc_world(stmt.where(StageRun.is_trial.is_(False)), world_id)
    row = (await db.execute(stmt)).one()
    return {"today": row[0], "last_7d": row[1], "last_30d": row[2], "total": row[3]}


async def tong_quan(db: AsyncSession, world_id: uuid.UUID | None) -> dict:
    players = await dem_theo_cua_so(db, world_id, cot=StageRunPlayer.user_id)
    runs = await dem_theo_cua_so(db, world_id, cot=StageRun.id)

    # Phân rã theo kết thúc + thời lượng trung bình: cùng một tập `stage_runs`,
    # nên một câu.
    stmt = select(
        func.count().filter(StageRun.status == RunStatus.WON),
        func.count().filter(StageRun.status == RunStatus.LOST_TIME),
        func.count().filter(StageRun.status == RunStatus.ABANDONED),
        func.count().filter(StageRun.status == RunStatus.PLAYING),
        func.avg(THOI_LUONG).filter(StageRun.duration_seconds.is_not(None)),
    ).select_from(StageRun)
    won, lost, abandoned, playing, avg_duration = (
        await db.execute(_loc_world(stmt.where(StageRun.is_trial.is_(False)), world_id))
    ).one()

    # Điểm và nhiệm vụ: ở `stage_run_players`, nên một câu riêng.
    #
    # Điểm trung bình tính theo PHẦN TRĂM chứ không phải điểm thô: các màn có
    # tổng điểm khác nhau, nên trung bình của điểm thô là trung bình của những
    # thứ không so được với nhau.
    stmt2 = (
        select(
            func.avg(
                case(
                    (
                        StageRunPlayer.max_score > 0,
                        StageRunPlayer.score / cast(StageRunPlayer.max_score, Float),
                    ),
                    else_=None,
                )
            ),
            func.coalesce(func.sum(StageRunPlayer.quests_completed), 0),
            func.coalesce(func.sum(StageRunPlayer.skill_pts_earned), 0),
        )
        .select_from(StageRunPlayer)
        .join(StageRun, StageRun.id == StageRunPlayer.stage_run_id)
        .where(StageRunPlayer.user_id.is_not(None))
    )
    avg_pct, quests, skill_pts = (
        await db.execute(_loc_world(stmt2.where(StageRun.is_trial.is_(False)), world_id))
    ).one()

    ket_thuc = won + lost + abandoned

    return {
        "players": players,
        "runs": runs,
        "runs_won": won,
        "runs_lost": lost,
        "runs_abandoned": abandoned,
        "runs_playing": playing,
        "win_rate": (won / ket_thuc) if ket_thuc else None,
        "avg_score_pct": float(avg_pct) if avg_pct is not None else None,
        "avg_duration_seconds": int(avg_duration) if avg_duration is not None else None,
        "quests_completed": int(quests or 0),
        "skill_pts_awarded": int(skill_pts or 0),
        "daily": await theo_ngay(db, world_id),
        "timezone": settings.reports_timezone,
    }


async def theo_ngay(db: AsyncSession, world_id: uuid.UUID | None) -> list[dict]:
    """Người chơi và lượt chơi của `DAILY_DAYS` ngày gần nhất."""
    tz = _mui_gio()
    tu = _nua_dem(DAILY_DAYS - 1)

    # `timezone(:tz, started_at)` đổi mốc sang giờ địa phương TRƯỚC khi cắt
    # ngày. Không đổi thì mọi lượt chơi buổi tối ở Việt Nam rơi sang ngày hôm
    # sau của UTC, và cái biểu đồ lệch đi đúng một cột.
    ngay = func.date(func.timezone(settings.reports_timezone, StageRun.started_at)).label("ngay")

    stmt = (
        select(
            ngay,
            func.count(distinct(StageRunPlayer.user_id)),
            func.count(distinct(StageRun.id)),
        )
        .select_from(StageRun)
        .join(
            StageRunPlayer,
            and_(
                StageRunPlayer.stage_run_id == StageRun.id,
                StageRunPlayer.user_id.is_not(None),
            ),
            isouter=True,
        )
        .where(StageRun.is_trial.is_(False), StageRun.started_at >= tu)
        .group_by(ngay)
    )

    co = {r[0]: (r[1], r[2]) for r in (await db.execute(_loc_world(stmt, world_id))).all()}

    # Trả đủ `DAILY_DAYS` cột, ngày trống điền 0 — xem ghi chú ở `OverviewOut`.
    hom_nay: date = datetime.now(tz).date()
    ra: list[dict] = []
    for lui in range(DAILY_DAYS - 1, -1, -1):
        d = hom_nay - timedelta(days=lui)
        players, runs = co.get(d, (0, 0))
        ra.append({"day": d, "players": players, "runs": runs})
    return ra


async def danh_sach_world(db: AsyncSession) -> list[dict]:
    """Các world ĐÃ CÓ NGƯỜI CHƠI, kèm số người và số lượt.

    Chỉ những world có dữ liệu: ô lọc là để đi tới chỗ có gì để xem, và một
    danh sách năm mươi world trống rỗng thì không giúp ai chọn được gì.
    """
    stmt = (
        select(
            World.id,
            World.name_i18n,
            func.count(distinct(StageRunPlayer.user_id)),
            func.count(distinct(StageRun.id)),
        )
        .select_from(StageRun)
        .join(Stage, Stage.id == StageRun.stage_id)
        .join(Chapter, Chapter.id == Stage.chapter_id)
        .join(World, World.id == Chapter.world_id)
        .join(
            StageRunPlayer,
            and_(
                StageRunPlayer.stage_run_id == StageRun.id,
                StageRunPlayer.user_id.is_not(None),
            ),
            isouter=True,
        )
        .where(StageRun.is_trial.is_(False))
        .group_by(World.id, World.name_i18n, World.position)
        .order_by(World.position, World.id)
    )
    return [
        {"world_id": r[0], "name_i18n": r[1] or {}, "players": r[2], "runs": r[3]}
        for r in (await db.execute(stmt)).all()
    ]


# ---------------------------------------------------------------------------
# BẢNG XẾP HẠNG
# ---------------------------------------------------------------------------


async def xep_hang(
    db: AsyncSession,
    *,
    world_id: uuid.UUID | None,
    page: int,
    size: int,
    tim: str | None,
) -> tuple[list[dict], int]:
    """Một trang của bảng xếp hạng, kèm TỔNG số người để vẽ thanh phân trang.

    Xếp theo điểm chiến lực giảm dần. Lọc theo world thì đọc thẳng
    `world_progress` của world ấy; không lọc thì CỘNG qua mọi world — điểm
    chiến lực vốn riêng theo từng world, nên con số cộng lại chỉ có nghĩa như
    một thước xếp hạng chung, và giao diện nói rõ điều đó.
    """
    # CHỈ HỌC SINH. Mọi lượt chơi của giáo viên/admin đều mang cờ `is_trial`
    # (xem `is_preview_role`), nên phần "lượt chơi" của họ đã bị loại từ trước —
    # nhưng `world_progress` thì vẫn cộng điểm cho những lượt ấy, và hậu quả là
    # cô giáo dựng bài cả tuần đứng hạng nhì trong bảng xếp hạng của lớp mình,
    # với số lượt chơi bằng 0. Một hàng như thế không sai về số học, nó chỉ trả
    # lời một câu hỏi mà không ai hỏi.
    dieu_kien = [User.deleted_at.is_(None), User.role == UserRole.STUDENT]
    if world_id is not None:
        dieu_kien.append(WorldProgress.world_id == world_id)
    if tim:
        mau = f"%{tim.strip().lower()}%"
        dieu_kien.append(
            func.lower(User.display_name).like(mau) | func.lower(User.email).like(mau)
        )

    diem = func.coalesce(func.sum(WorldProgress.skill_pts), 0).label("diem")

    base = (
        select(
            User.id,
            User.display_name,
            User.email,
            diem,
            func.coalesce(func.sum(WorldProgress.stages_completed), 0),
            func.count(distinct(WorldProgress.world_id)),
            func.max(WorldProgress.last_played_at),
        )
        .select_from(User)
        .join(WorldProgress, WorldProgress.user_id == User.id)
        .where(*dieu_kien)
        .group_by(User.id, User.display_name, User.email)
    )

    # Đếm tổng bằng chính truy vấn trên, bọc lại thành bảng con. Viết lại một
    # câu đếm riêng là hai điều kiện lọc phải giữ khớp nhau bằng tay.
    tong = await db.scalar(select(func.count()).select_from(base.subquery()))

    trang = (
        await db.execute(
            base.order_by(
                diem.desc(),
                func.max(WorldProgress.last_played_at).desc().nulls_last(),
                User.display_name,
            )
            .limit(size)
            .offset((page - 1) * size)
        )
    ).all()

    hang: list[dict] = []
    for i, r in enumerate(trang):
        hang.append(
            {
                "user_id": r[0],
                "display_name": r[1],
                "email": r[2],
                "rank": (page - 1) * size + i + 1,
                "skill_pts": int(r[3] or 0),
                "stages_completed": int(r[4] or 0),
                "worlds_played": int(r[5] or 0),
                "runs": 0,
                "runs_won": 0,
                "play_seconds": 0,
                "last_played_at": r[6],
            }
        )

    # Số lượt chơi hỏi RIÊNG, và chỉ hỏi cho 50 người của trang này.
    #
    # Nối nó vào truy vấn trên thì mỗi người bị nhân bản theo số lượt chơi, và
    # `sum(skill_pts)` cộng lên gấp mấy chục lần — kiểu sai mà không có dòng nào
    # trông sai cả, chỉ có những con số to bất thường.
    if hang:
        ids = [h["user_id"] for h in hang]
        stmt = (
            select(
                StageRunPlayer.user_id,
                func.count(distinct(StageRun.id)),
                func.count(distinct(StageRun.id)).filter(StageRun.status == RunStatus.WON),
                func.coalesce(func.sum(THOI_LUONG), 0),
            )
            .select_from(StageRunPlayer)
            .join(StageRun, StageRun.id == StageRunPlayer.stage_run_id)
            .where(StageRunPlayer.user_id.in_(ids), StageRun.is_trial.is_(False))
            .group_by(StageRunPlayer.user_id)
        )
        theo_nguoi = {
            r[0]: (r[1], r[2], int(r[3] or 0))
            for r in (await db.execute(_loc_world(stmt, world_id))).all()
        }
        for h in hang:
            runs, wins, giay = theo_nguoi.get(h["user_id"], (0, 0, 0))
            h["runs"], h["runs_won"], h["play_seconds"] = runs, wins, giay

    return hang, int(tong or 0)


# ---------------------------------------------------------------------------
# CHI TIẾT MỘT NGƯỜI
# ---------------------------------------------------------------------------


async def chi_tiet(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    user = await db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if user is None:
        return None

    # --- Tiến trình từng world ---
    wp_rows = (
        await db.execute(
            select(WorldProgress, World)
            .join(World, World.id == WorldProgress.world_id)
            .where(WorldProgress.user_id == user_id)
            .order_by(World.position, World.id)
        )
    ).all()

    shards = dict(
        (
            await db.execute(
                select(MapShardOwned.world_id, func.count())
                .where(MapShardOwned.user_id == user_id)
                .group_by(MapShardOwned.world_id)
            )
        ).all()
    )

    # --- Thành tích từng màn, gom sẵn theo world ---
    sp_rows = (
        await db.execute(
            select(StageProgress, Stage, Chapter)
            .join(Stage, Stage.id == StageProgress.stage_id)
            .join(Chapter, Chapter.id == Stage.chapter_id)
            .where(StageProgress.user_id == user_id)
            .order_by(Chapter.order_index, Stage.order_index)
        )
    ).all()

    # Lượt chơi gộp theo màn: thời lượng nhanh nhất, lần chơi gần nhất và kết
    # thúc của lần ấy. `stage_progress` giữ thành tích TỐT NHẤT nhưng không giữ
    # thời gian, mà "em ấy làm màn này mất bao lâu" là câu giáo viên sẽ hỏi.
    theo_man = {
        r[0]: r
        for r in (
            await db.execute(
                select(
                    StageRun.stage_id,
                    func.min(THOI_LUONG).filter(StageRun.status == RunStatus.WON),
                    func.max(StageRun.started_at),
                    func.max(StageRunPlayer.max_score),
                )
                .select_from(StageRunPlayer)
                .join(StageRun, StageRun.id == StageRunPlayer.stage_run_id)
                .where(StageRunPlayer.user_id == user_id, StageRun.is_trial.is_(False))
                .group_by(StageRun.stage_id)
            )
        ).all()
    }

    # Kết thúc của lượt GẦN NHẤT ở mỗi màn — `max(status)` là vô nghĩa, nên phải
    # đi tìm đúng dòng ấy. `DISTINCT ON` của PostgreSQL làm việc đó trong một
    # câu, không cần truy vấn lồng.
    trang_thai_cuoi = dict(
        (
            await db.execute(
                select(StageRun.stage_id, StageRun.status)
                .select_from(StageRunPlayer)
                .join(StageRun, StageRun.id == StageRunPlayer.stage_run_id)
                .where(StageRunPlayer.user_id == user_id, StageRun.is_trial.is_(False))
                .distinct(StageRun.stage_id)
                .order_by(StageRun.stage_id, StageRun.started_at.desc())
            )
        ).all()
    )

    man_theo_world: dict[uuid.UUID, list[dict]] = {}
    for sp, stage, chapter in sp_rows:
        gop = theo_man.get(stage.id)
        man_theo_world.setdefault(chapter.world_id, []).append(
            {
                "stage_id": stage.id,
                "name_i18n": stage.name_i18n or {},
                "chapter_name_i18n": chapter.name_i18n or {},
                "order_index": stage.order_index,
                "best_score": sp.best_score,
                "max_score": int(gop[3] or 0) if gop else 0,
                "best_quests_completed": sp.best_quests_completed,
                "times_played": sp.times_played,
                "skill_pts_earned_total": sp.skill_pts_earned_total,
                "best_duration_seconds": gop[1] if gop else None,
                "first_completed_at": sp.first_completed_at,
                "last_played_at": gop[2] if gop else None,
                "last_status": trang_thai_cuoi.get(stage.id),
            }
        )

    worlds = [
        {
            "world_id": world.id,
            "name_i18n": world.name_i18n or {},
            "skill_pts": wp.skill_pts,
            "stages_completed": wp.stages_completed,
            "shards_owned": int(shards.get(world.id, 0)),
            "shard_total": world.shard_total,
            "first_played_at": wp.first_played_at,
            "last_played_at": wp.last_played_at,
            "completed_at": wp.completed_at,
            "gate_opened_at": wp.gate_opened_at,
            "stages": man_theo_world.get(world.id, []),
        }
        for wp, world in wp_rows
    ]

    # --- Lịch sử gần đây ---
    lich_su = (
        await db.execute(
            select(StageRun, StageRunPlayer, Stage, World)
            .select_from(StageRunPlayer)
            .join(StageRun, StageRun.id == StageRunPlayer.stage_run_id)
            .join(Stage, Stage.id == StageRun.stage_id)
            .join(Chapter, Chapter.id == Stage.chapter_id)
            .join(World, World.id == Chapter.world_id)
            .where(StageRunPlayer.user_id == user_id, StageRun.is_trial.is_(False))
            .order_by(StageRun.started_at.desc())
            .limit(RECENT_RUNS_LIMIT)
        )
    ).all()

    recent = [
        {
            "run_id": run.id,
            "stage_id": stage.id,
            "stage_name_i18n": stage.name_i18n or {},
            "world_name_i18n": world.name_i18n or {},
            "status": run.status,
            "score": player.score,
            "max_score": player.max_score,
            "quests_completed": player.quests_completed,
            "skill_pts_earned": player.skill_pts_earned,
            "got_map_shard": player.got_map_shard,
            "duration_seconds": run.duration_seconds,
            "started_at": run.started_at,
            "ended_at": run.ended_at,
        }
        for run, player, stage, world in lich_su
    ]

    tong = (
        await db.execute(
            select(
                func.count(distinct(StageRun.id)),
                func.count(distinct(StageRun.id)).filter(StageRun.status == RunStatus.WON),
                func.coalesce(func.sum(THOI_LUONG), 0),
            )
            .select_from(StageRunPlayer)
            .join(StageRun, StageRun.id == StageRunPlayer.stage_run_id)
            .where(StageRunPlayer.user_id == user_id, StageRun.is_trial.is_(False))
        )
    ).one()

    return {
        "user_id": user.id,
        "display_name": user.display_name,
        "email": user.email,
        "created_at": user.created_at,
        "runs": tong[0],
        "runs_won": tong[1],
        "play_seconds": int(tong[2] or 0),
        "skill_pts": sum(w["skill_pts"] for w in worlds),
        "worlds": worlds,
        "recent_runs": recent,
    }
