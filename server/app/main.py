import sys
import io
import os
from dotenv import load_dotenv
# 最先加载环境变量
load_dotenv()

import time
import json
import uvicorn
from models import Work, ChatRequest, ConfirmRequest, Candidate
from session import (
    init_mock_data, get_project, clear_chat_history,
    get_all_projects, create_project, delete_project, update_project
)
from agent import lyric_agent
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Generic, TypeVar, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from workflows.lyric_gen import LyricWorkflow, AutoCompleteWorkflow, ImitateWorkflow, LyricFittingWorkflow

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 应用元数据
app = FastAPI(
    title="FuturePhrase API",
    description="AI 歌词创作服务 - 项目级隔离架构",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化演示项目
init_mock_data()

# Workflow 注册表 - 避免重复的 if-elif
WORKFLOW_REGISTRY = {
    'full': LyricWorkflow,
    'auto_complete': AutoCompleteWorkflow,
    'imitate': ImitateWorkflow,
    'fitting': LyricFittingWorkflow,
}

T = TypeVar('T')

class BaseResponse(BaseModel, Generic[T]):
    code: int = Field(default=0, description="业务状态码：0 成功，非 0 失败")
    message: str = Field(default="success", description="人类可读的消息")
    data: Optional[T] = Field(default=None, description="实际数据")

class GenerationRequest(BaseModel):
    theme: str = Field(..., min_length=1, max_length=2000, description="输入主题或歌词")
    style: str = Field(default="", max_length=100, description="风格偏好（可选）")
    mode: str = Field(default="full", pattern="^(full|auto_complete|imitate|fitting)$")

class ChatRequestWithProject(BaseModel):
    """带项目ID的对话请求"""
    project_id: str
    message: str
    target_segment_ids: list[str] = []

class ConfirmRequestWithProject(BaseModel):
    """带项目ID的确认请求"""
    project_id: str
    candidate_id: str
    action: str  # "accept" | "reject"

# 全局异常处理中间件
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": exc.detail, "data": None}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": f"服务器内部错误: {str(exc)}", "data": None}
    )

# ==================== 路由 ====================

@app.get("/", tags=["页面"])
async def read_root():
    return FileResponse("templates/index.html")

@app.get("/debug", tags=["页面"])
async def debug_page():
    return FileResponse("templates/debug.html")

@app.get("/api/v1/health", tags=["系统"])
async def health_check():
    """健康检查端点"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": app.version,
        "uptime": time.time() - start_time
    }

# ==================== 项目管理 API ====================

@app.get("/api/v1/projects", tags=["项目管理"])
async def list_projects():
    """获取所有项目列表"""
    projects = get_all_projects()
    return {"code": 0, "data": [p.model_dump() for p in projects]}


@app.post("/api/v1/projects", tags=["项目管理"])
async def new_project(req: dict = None):
    """创建新项目"""
    title = req.get("title", "未命名歌曲") if req else "未命名歌曲"
    project = create_project(title)
    return {"code": 0, "data": project.model_dump()}


@app.delete("/api/v1/projects/{project_id}", tags=["项目管理"])
async def remove_project(project_id: str):
    """删除项目"""
    projects = get_all_projects()
    if len(projects) <= 1:
        raise HTTPException(status_code=400, detail="至少保留一个项目")
    
    success = delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    return {"code": 0, "message": "项目已删除"}


@app.put("/api/v1/projects/{project_id}", tags=["项目管理"])
async def update_project_endpoint(project_id: str, req: dict):
    """整体更新项目（标题、歌词、简谱）"""
    project = update_project(project_id, req)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    return {"code": 0, "data": project.model_dump()}


@app.get("/api/v1/projects/{project_id}", tags=["项目管理"])
async def get_project_detail(project_id: str):
    """获取单个项目详情（包含聊天历史和候选）"""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"code": 0, "data": project.model_dump()}


# ==================== 聊天和候选 API（项目级） ====================

@app.post("/api/v1/projects/{project_id}/chat", tags=["AI对话"])
async def chat_with_project(project_id: str, req: ChatRequest):
    """AI 对话（核心接口）- 项目级隔离"""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    def json_serializer(obj):
        """自定义 JSON 序列化器"""
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    async def generate():
        async for event in lyric_agent.process_message(req.message, project_id):
            event_type = event.get("event", "message")
            event_data = event.get("data", {})
            yield f"event: {event_type}\ndata: {json.dumps(event_data, ensure_ascii=False, default=json_serializer)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@app.delete("/api/v1/projects/{project_id}/chat", tags=["AI对话"])
async def clear_project_chat(project_id: str):
    """清空项目的聊天历史和候选内容"""
    success = clear_chat_history(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"code": 0, "message": "聊天历史已清空"}


@app.post("/api/v1/projects/{project_id}/confirm", tags=["AI对话"])
async def confirm_candidate_endpoint(project_id: str, req: ConfirmRequest):
    """确认或拒绝候选内容"""
    result = await lyric_agent.confirm_candidate(project_id, req.candidate_id, req.action)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "操作失败"))
    
    return {"code": 0, "data": result}


@app.get("/api/v1/projects/{project_id}/candidates", tags=["AI对话"])
async def get_project_candidates(project_id: str):
    """获取项目的待确认候选内容列表"""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    pending = [c for c in project.candidates if c.status == "pending"]
    return {"code": 0, "data": [c.model_dump() for c in pending]}


@app.put("/api/v1/projects/{project_id}/segments", tags=["AI对话"])
async def update_project_segments(project_id: str, segments: list[dict]):
    """手动更新段落内容"""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    for seg_update in segments:
        for seg in project.lyrics:
            if seg.id == seg_update.get("id"):
                seg.text_content = seg_update.get("text_content", "")
                seg.status = "done"
                break
    
    project.updated_at = datetime.now()
    return {"code": 0, "data": project.model_dump()}


# ==================== 其他 API ====================

@app.get("/api/v1/modes", tags=["系统"])
async def get_available_modes():
    """获取所有可用的模式列表"""
    return BaseResponse(data={
        "modes": [
            {"id": "full", "name": "自由创作", "description": "根据主题生成完整歌词"},
            {"id": "auto_complete", "name": "自动补全", "description": "填写歌词中的【PLACEHOLDER】占位符"},
            {"id": "imitate", "name": "风格模仿", "description": "模仿指定歌曲的风格创作"},
            {"id": "fitting", "name": "歌词填空", "description": "根据模板精确字数填词"},
        ]
    })

@app.post("/api/v1/generate", tags=["歌词生成"])
async def generate_lyrics(req: GenerationRequest):
    user_input = req.theme.strip()
    
    if not user_input:
        raise HTTPException(status_code=400, detail="主题不能为空")
    
    if req.mode not in WORKFLOW_REGISTRY:
        raise HTTPException(status_code=400, detail=f"不支持的模式: {req.mode}")
    
    try:
        workflow_class = WORKFLOW_REGISTRY[req.mode]
        workflow = workflow_class()
        return StreamingResponse(
            workflow.run(user_input=user_input),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

# 启动时间记录
start_time = time.time()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=6789, reload=True)
