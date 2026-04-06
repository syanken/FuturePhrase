from models import Work, Segment
from datetime import datetime

# 全局作品存储（demo阶段用内存）
WORK_STORE: dict[str, Work] = {}

def init_demo_work():
    """初始化一个空白作品"""
    work = Work(
        id="demo_work_001",
        title="未命名歌曲",
        segments=[
            Segment(id="seg_verse_1", type="verse", order=0, label="主歌 A"),
            Segment(id="seg_chorus_1", type="chorus", order=1, label="副歌"),
            Segment(id="seg_verse_2", type="verse", order=2, label="主歌 A2"),
        ],
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    WORK_STORE["demo_work_001"] = work
    return work

def get_work(work_id: str) -> Work | None:
    return WORK_STORE.get(work_id)

def update_work(work_id: str, segments: list[Segment]) -> Work | None:
    """更新作品的段落"""
    work = WORK_STORE.get(work_id)
    if not work:
        return None
    work.segments = segments
    work.updated_at = datetime.now()
    return work
