from models import Work, LyricsSegment, JianpuSegment, Candidate, ChatMessage, CandidateStatus, Note, Measure
from datetime import datetime
import uuid

# 项目存储（支持多项目，每个项目独立存储聊天历史和候选）
PROJECT_STORE: dict[str, Work] = {}


def init_mock_data():
    """初始化 mock 数据"""
    # 项目1: 加班的歌
    proj_001 = Work(
        id="proj_001",
        title="加班的歌",
        lyrics=[
            LyricsSegment(
                id="seg_verse_1", type="verse", order=0, label="主歌 A",
                text_content="凌晨两点的办公室\n只有屏幕还在亮\n咖啡又喝了一杯\n明天还得继续忙",
                status="draft"
            ),
            LyricsSegment(
                id="seg_chorus_1", type="chorus", order=1, label="副歌",
                text_content="加班加到天亮\n梦想还在路上\n这一路跌跌撞撞\n只为心中的光",
                status="draft"
            ),
        ],
        jianpu=[
            JianpuSegment(
                id="seg_verse_1", type="verse", order=0, label="主歌 A",
                status="draft",
                measures=[
                    Measure(id=1, notes=[
                        Note(pitch="3", octave=0, duration=1, lyric="凌"),
                        Note(pitch="5", octave=0, duration=1, lyric="晨"),
                        Note(pitch="6", octave=0, duration=1, lyric="两"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                    ]),
                    Measure(id=2, notes=[
                        Note(pitch="1", octave=1, duration=2, lyric="点"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                        Note(pitch="7", octave=0, duration=1, lyric="的"),
                    ]),
                    Measure(id=3, notes=[
                        Note(pitch="6", octave=0, duration=1, lyric="公"),
                        Note(pitch="5", octave=0, duration=1, lyric="室"),
                        Note(pitch="3", octave=0, duration=1, lyric="只"),
                        Note(pitch="5", octave=0, duration=1, lyric="有"),
                    ]),
                    Measure(id=4, notes=[
                        Note(pitch="6", octave=0, duration=1, lyric="屏"),
                        Note(pitch="1", octave=1, duration=2, lyric="幕"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                    ]),
                    Measure(id=5, notes=[
                        Note(pitch="7", octave=0, duration=1, lyric="还"),
                        Note(pitch="6", octave=0, duration=1, lyric="在"),
                        Note(pitch="5", octave=0, duration=1, lyric="亮"),
                        Note(pitch="5", octave=0, duration=1, lyric="咖"),
                    ]),
                    Measure(id=6, notes=[
                        Note(pitch="3", octave=0, duration=1, lyric="啡"),
                        Note(pitch="5", octave=0, duration=1, lyric="又"),
                        Note(pitch="3", octave=0, duration=1, lyric="喝"),
                        Note(pitch="5", octave=0, duration=1, lyric="了"),
                    ]),
                    Measure(id=7, notes=[
                        Note(pitch="1", octave=1, duration=2, lyric="一"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                        Note(pitch="5", octave=0, duration=1, lyric="杯"),
                    ]),
                    Measure(id=8, notes=[
                        Note(pitch="6", octave=0, duration=1, lyric="明"),
                        Note(pitch="1", octave=1, duration=1, lyric="天"),
                        Note(pitch="7", octave=0, duration=1, lyric="还"),
                        Note(pitch="6", octave=0, duration=1, lyric="得"),
                    ]),
                    Measure(id=9, notes=[
                        Note(pitch="5", octave=0, duration=1, lyric="继"),
                        Note(pitch="3", octave=0, duration=1, lyric="续"),
                        Note(pitch="5", octave=0, duration=1, lyric="忙"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                    ]),
                ]
            ),
            JianpuSegment(
                id="seg_chorus_1", type="chorus", order=1, label="副歌",
                status="draft",
                measures=[
                    Measure(id=1, notes=[
                        Note(pitch="1", octave=1, duration=1, lyric="加"),
                        Note(pitch="1", octave=1, duration=1, lyric="班"),
                        Note(pitch="3", octave=1, duration=1, lyric="加"),
                        Note(pitch="2", octave=1, duration=1, lyric="到"),
                    ]),
                    Measure(id=2, notes=[
                        Note(pitch="1", octave=1, duration=2, lyric="天"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                        Note(pitch="7", octave=0, duration=1, lyric="亮"),
                    ]),
                    Measure(id=3, notes=[
                        Note(pitch="6", octave=0, duration=1, lyric="梦"),
                        Note(pitch="1", octave=1, duration=1, lyric="想"),
                        Note(pitch="7", octave=0, duration=1, lyric="还"),
                        Note(pitch="6", octave=0, duration=1, lyric="在"),
                    ]),
                    Measure(id=4, notes=[
                        Note(pitch="5", octave=0, duration=2, lyric="路"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                        Note(pitch="3", octave=0, duration=1, lyric="上"),
                    ]),
                    Measure(id=5, notes=[
                        Note(pitch="5", octave=-1, duration=0.25, lyric="这"),
                        Note(pitch="5", octave=0, duration=0.25, lyric="这"),
                        Note(pitch="3", octave=0, duration=0.5, lyric="一"),
                        Note(pitch="5", octave=0, duration=1, lyric="路"),
                        Note(pitch="6", octave=0, duration=0.5, lyric="跌"),
                        Note(pitch="5", octave=0, duration=0.5, lyric="跌"),
                        Note(pitch="3", octave=0, duration=1, lyric="撞"),
                        Note(pitch="2", octave=0, duration=1, lyric="撞"),
                    ]),
                    Measure(id=6, notes=[
                        Note(pitch="1", octave=1, duration=1, lyric="只"),
                        Note(pitch="7", octave=0, duration=1, lyric="为"),
                        Note(pitch="6", octave=0, duration=1, lyric="心"),
                        Note(pitch="5", octave=0, duration=1, lyric="中"),
                    ]),
                    Measure(id=7, notes=[
                        Note(pitch="3", octave=0, duration=2, lyric="的"),
                        Note(pitch="0", octave=0, duration=1, lyric=""),
                        Note(pitch="1", octave=1, duration=1, lyric="光"),
                    ]),
                ]
            ),
        ],
        chat_history=[],
        candidates=[],
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    # 项目2: 未命名歌曲
    proj_002 = Work(
        id="proj_002",
        title="未命名歌曲",
        lyrics=[
            LyricsSegment(id="seg_verse_1", type="verse", order=0, label="主歌 A", text_content="", status="draft"),
        ],
        jianpu=[
            JianpuSegment(id="seg_verse_1", type="verse", order=0, label="主歌 A", measures=[], status="draft"),
        ],
        chat_history=[],
        candidates=[],
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    PROJECT_STORE["proj_001"] = proj_001
    PROJECT_STORE["proj_002"] = proj_002
    return proj_001


# ==================== 项目管理 ====================

def get_all_projects() -> list[Work]:
    """获取所有项目"""
    return list(PROJECT_STORE.values())


def get_project(project_id: str) -> Work | None:
    """获取单个项目"""
    return PROJECT_STORE.get(project_id)


def create_project(title: str = "未命名歌曲") -> Work:
    """创建新项目"""
    project_id = f"proj_{uuid.uuid4().hex[:8]}"
    project = Work(
        id=project_id,
        title=title,
        lyrics=[
            LyricsSegment(id="seg_verse_1", type="verse", order=0, label="主歌 A", text_content="", status="draft"),
            LyricsSegment(id="seg_chorus_1", type="chorus", order=1, label="副歌", text_content="", status="draft"),
            LyricsSegment(id="seg_verse_2", type="verse", order=2, label="主歌 A2", text_content="", status="draft"),
        ],
        jianpu=[
            JianpuSegment(id="seg_verse_1", type="verse", order=0, label="主歌 A", measures=[], status="draft"),
            JianpuSegment(id="seg_chorus_1", type="chorus", order=1, label="副歌", measures=[], status="draft"),
            JianpuSegment(id="seg_verse_2", type="verse", order=2, label="主歌 A2", measures=[], status="draft"),
        ],
        chat_history=[],
        candidates=[],
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    PROJECT_STORE[project_id] = project
    return project


def delete_project(project_id: str) -> bool:
    """删除项目"""
    if project_id in PROJECT_STORE:
        del PROJECT_STORE[project_id]
        return True
    return False


def update_project(project_id: str, project_data: dict) -> Work | None:
    """整体更新项目（标题、歌词、简谱）"""
    project = PROJECT_STORE.get(project_id)
    if not project:
        return None

    # 更新标题
    if "title" in project_data:
        project.title = project_data["title"]

    # 更新歌词段落
    if "lyrics" in project_data:
        project.lyrics = [
            LyricsSegment(**seg) if isinstance(seg, dict) else seg
            for seg in project_data["lyrics"]
        ]

    # 更新简谱段落
    if "jianpu" in project_data:
        project.jianpu = [
            JianpuSegment(**seg) if isinstance(seg, dict) else seg
            for seg in project_data["jianpu"]
        ]

    project.updated_at = datetime.now()
    return project


# ==================== 聊天和候选（项目级） ====================

def add_chat_message(project_id: str, role: str, content: str, tool_calls: list[dict] = None) -> ChatMessage:
    """添加聊天消息到项目"""
    project = PROJECT_STORE.get(project_id)
    if not project:
        return None
    
    message = ChatMessage(
        id=f"msg_{uuid.uuid4().hex[:8]}",
        role=role,
        content=content,
        tool_calls=tool_calls or [],
        created_at=datetime.now()
    )
    
    project.chat_history.append(message)
    project.updated_at = datetime.now()
    return message


def add_candidate(project_id: str, candidate_type: str, content: dict, description: str = "", candidate_id: str = None) -> Candidate:
    """添加候选内容到项目"""
    project = PROJECT_STORE.get(project_id)
    if not project:
        return None
    
    candidate = Candidate(
        id=candidate_id or f"cand_{uuid.uuid4().hex[:8]}",
        work_id=project_id,
        type=candidate_type,
        content=content,
        description=description,
        status=CandidateStatus.PENDING,
        created_at=datetime.now()
    )
    
    project.candidates.append(candidate)
    project.updated_at = datetime.now()
    return candidate


def get_pending_candidates(project_id: str) -> list[Candidate]:
    """获取项目的待确认候选内容"""
    project = PROJECT_STORE.get(project_id)
    if not project:
        return []
    return [c for c in project.candidates if c.status == CandidateStatus.PENDING]


def clear_chat_history(project_id: str) -> bool:
    """清空项目的聊天历史"""
    project = PROJECT_STORE.get(project_id)
    if not project:
        return False
    project.chat_history = []
    project.candidates = []  # 同时清空候选内容
    project.updated_at = datetime.now()
    return True


def confirm_candidate(project_id: str, candidate_id: str, action: str) -> Candidate | None:
    """确认或拒绝候选内容"""
    project = PROJECT_STORE.get(project_id)
    if not project:
        return None
    
    for candidate in project.candidates:
        if candidate.id == candidate_id:
            if action == "accept":
                candidate.status = CandidateStatus.ACCEPTED
                # 将候选内容应用到 Work
                _apply_candidate_to_work(project, candidate)
            elif action == "reject":
                candidate.status = CandidateStatus.REJECTED
            
            project.updated_at = datetime.now()
            return candidate
    
    return None


def _apply_candidate_to_work(work: Work, candidate: Candidate):
    """将候选内容应用到作品"""
    if candidate.type == "lyrics":
        # 应用完整歌词
        if "segments" in candidate.content:
            for seg_data in candidate.content["segments"]:
                for seg in work.lyrics:
                    if seg.id == seg_data.get("id"):
                        seg.text_content = seg_data.get("text", "")
                        seg.status = "done"
                        break
    
    elif candidate.type == "segment":
        # 应用单个段落
        seg_data = candidate.content
        for seg in work.lyrics:
            if seg.id == seg_data.get("id"):
                seg.text_content = seg_data.get("text", "")
                seg.status = "done"
                break
    
    work.updated_at = datetime.now()
