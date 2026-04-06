from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Note(BaseModel):
    """单个音符（为简谱预留，demo阶段可暂不填充）"""
    pitch: str = "0"
    octave: int = 0
    duration: float = 1.0
    lyric: str = ""

class Segment(BaseModel):
    """歌词段落"""
    id: str
    type: str = "verse"  # verse, chorus, bridge, outro
    order: int = 0
    label: str = ""  # 如 "主歌 A1"
    notes: List[Note] = []
    text_content: str = ""  # 纯文本内容（文本视图用）
    status: str = "draft"  # draft, editing, confirmed

class Work(BaseModel):
    """完整作品"""
    id: str = "demo_work_001"
    title: str = "未命名歌曲"
    segments: List[Segment] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class ChatRequest(BaseModel):
    """对话请求"""
    message: str
    target_segment_ids: List[str] = []  # 可选：指定操作哪些段落

class Intent(BaseModel):
    """AI识别的用户意图"""
    type: str  # generate, rewrite, extend, chat
    text: str
    target_segments: List[str] = []
