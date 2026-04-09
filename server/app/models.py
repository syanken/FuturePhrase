from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
from enum import Enum


# ==================== 基础模型 ====================

class Note(BaseModel):
    """单个音符"""
    pitch: str = "0"
    octave: int = 0
    duration: float = 1.0
    lyric: str = ""


class Measure(BaseModel):
    """小节"""
    id: int
    notes: List[Note] = []


# ==================== 段落模型 ====================

class LyricsSegment(BaseModel):
    """歌词段落"""
    id: str
    type: str = "verse"  # verse, chorus, bridge, outro
    order: int = 0
    label: str = ""  # 如 "主歌 A1"
    text_content: str = ""
    status: str = "draft"  # draft, done


class JianpuSegment(BaseModel):
    """简谱段落"""
    id: str
    type: str = "verse"  # verse, chorus, bridge, outro
    order: int = 0
    label: str = ""  # 如 "主歌 A1"
    measures: List[Measure] = []
    status: str = "draft"  # draft, done


# ==================== 作品模型 ====================

class Work(BaseModel):
    """完整作品 - 项目级隔离，包含聊天历史和候选内容"""
    id: str = "demo_work_001"
    title: str = "未命名歌曲"
    lyrics: List[LyricsSegment] = []
    jianpu: List[JianpuSegment] = []
    chat_history: List["ChatMessage"] = []  # 聊天历史
    candidates: List["Candidate"] = []      # 候选内容
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

# ==================== Agent 架构新增模型 ====================

class CandidateStatus(str, Enum):
    """候选内容状态"""
    PENDING = "pending"      # 等待用户确认
    ACCEPTED = "accepted"    # 用户已接受
    REJECTED = "rejected"    # 用户已拒绝

class Candidate(BaseModel):
    """候选内容 - 生成后暂存，等待用户确认"""
    id: str
    work_id: str
    type: Literal["lyrics", "segment", "style"]  # 候选类型
    content: dict  # 候选内容 {"segments": [...], "title": "..."}
    description: str = ""  # AI 对候选内容的描述
    status: CandidateStatus = CandidateStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.now)

class ChatMessage(BaseModel):
    """聊天消息"""
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    tool_calls: List[dict] = []  # 工具调用记录
    created_at: datetime = Field(default_factory=datetime.now)

# 更新 Work 模型的 forward references
Work.model_rebuild()

class ChatRequest(BaseModel):
    """对话请求"""
    message: str
    target_segment_ids: List[str] = []  # 可选：指定操作哪些段落

class ConfirmRequest(BaseModel):
    """确认候选请求"""
    candidate_id: str
    action: Literal["accept", "reject"]

# ==================== SSE 事件类型 ====================

class SSEEvent(BaseModel):
    """SSE 事件基类"""
    event: str
    data: dict

class TextChunkEvent(SSEEvent):
    """文本流式输出"""
    event: str = "text_chunk"
    chunk: str = ""

class ToolStartEvent(SSEEvent):
    """工具开始执行"""
    event: str = "tool_start"
    tool_name: str = ""
    tool_args: dict = {}

class ToolStreamEvent(SSEEvent):
    """工具执行流式输出"""
    event: str = "tool_stream"
    tool_name: str = ""
    chunk: str = ""

class ToolEndEvent(SSEEvent):
    """工具执行完成"""
    event: str = "tool_end"
    tool_name: str = ""
    result: dict = {}

class WorkUpdateEvent(SSEEvent):
    """作品更新"""
    event: str = "work_update"
    work: dict = {}

class CandidateUpdateEvent(SSEEvent):
    """候选内容更新"""
    event: str = "candidate_update"
    candidate: dict = {}
