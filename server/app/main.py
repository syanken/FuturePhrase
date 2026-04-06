import sys
import io
import time
import uvicorn
from models import Work, ChatRequest
from session import init_demo_work, get_work, update_work
from orchestrator import Orchestrator
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Generic, TypeVar, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from workflows.lyric_gen import LyricWorkflow, AutoCompleteWorkflow, ImitateWorkflow, LyricFittingWorkflow
from dotenv import load_dotenv
load_dotenv()

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 应用元数据
app = FastAPI(
    title="FuturePhrase API",
    description="AI 歌词创作服务 - 支持自由创作、自动补全、风格模仿、歌词填空四种模式",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
demo_work = init_demo_work()
orchestrator = Orchestrator()
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

@app.get("/api/v1/work", tags=["Demo"])
async def get_current_work():
    """获取当前作品"""
    work = get_work("demo_work_001")
    return {"code": 0, "data": work.model_dump()}

@app.post("/api/v1/work/chat", tags=["Demo"])
async def chat_with_work(req: ChatRequest):
    """AI 对话（核心接口）"""
    work = get_work("demo_work_001")
    if not work:
        raise HTTPException(status_code=404, detail="作品不存在")
    
    async def generate():
        full_response = ""
        async for chunk in orchestrator.process(req.message, work):
            full_response += chunk.replace("data: ", "").replace("\n\n", "")
            
            yield chunk
        
        # 尝试解析完整响应，更新 work
        try:
            # 提取 JSON 部分
            json_start = full_response.find("{")
            json_end = full_response.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                json_str = full_response[json_start:json_end]
                data = json.loads(json_str)
                # 更新段落
                if "segments" in data:
                    for seg_update in data["segments"]:
                        for seg in work.segments:
                            if seg.id == seg_update.get("id"):
                                seg.text_content = seg_update.get("text", "")
                                break
                    
                    # 发送更新事件
                    yield f"event: work_update\ndata: {json.dumps(work.model_dump())}\n\n"
        except Exception as e:
            print(f"解析响应失败: {e}")
        
        yield "event: done\ndata: {}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.put("/api/v1/work/segments", tags=["Demo"])
async def update_segments(segments: list[dict]):
    """手动更新段落内容"""
    work = get_work("demo_work_001")
    if not work:
        raise HTTPException(status_code=404, detail="作品不存在")
    
    for seg_update in segments:
        for seg in work.segments:
            if seg.id == seg_update.get("id"):
                seg.text_content = seg_update.get("text_content", "")
                break
    
    return {"code": 0, "data": work.model_dump()}

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