"""
歌词创作工具集
"""
import os
import json
import uuid
from typing import Any
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from core.lyrics_api import LyricsNetCn

# ==================== 上下文管理（项目级） ====================

_current_project: dict = {}

def get_current_session_context() -> dict:
    """获取当前项目上下文"""
    return _current_project

def set_current_session_context(project_id: str, work_data: dict):
    """设置当前项目上下文"""
    global _current_project
    _current_project = {
        "project_id": project_id,
        "work": work_data
    }


# ==================== 工具函数 ====================

def _call_llm(prompt: str) -> str:
    """调用 LLM"""
    llm = ChatOpenAI(
        model=os.getenv("MODEL"),
        streaming=False,
        temperature=0.7,
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_API_BASE"),
    )
    return llm.invoke(prompt).content


def _parse_json(text: str) -> dict:
    """从文本中解析 JSON"""
    try:
        start = text.find("{")
        end = text.rfind("}") + 1

        if start != -1 and end > start:
            return json.loads(text[start:end].replace('\n', ''))
    except:
        pass
    return {"raw": text}


# ==================== Function Tools ====================

@tool
def generate_lyrics_tool(theme: str, style: str = "流行") -> dict:
    """
    根据主题生成完整歌词。
    
    Args:
        theme: 创作主题，如"思念"、"青春"
        style: 风格偏好，如"民谣"、"摇滚"（默认流行）
    
    Returns:
        包含候选ID和生成内容的字典
    """
    context = get_current_session_context()
    work_data = context.get("work", {})
    
    # 构建现有内容
    lyrics = work_data.get("lyrics", [])
    existing = "\n".join([
        f"[{s.get('label', s.get('type'))}]: {s.get('text_content', '(空)')}" 
        for s in lyrics
    ]) if lyrics else "空白作品"
    
    prompt = f"""根据以下要求创作歌词：

            主题：{theme}
            风格：{style}

            当前作品：
            {existing}

            【格式要求】
            - 歌词必须使用中文标点（逗号、句号、感叹号等）分隔每个句子/分句
            - 示例："月光洒在窗台，思念像鸟儿飞来。那些回忆仍在心间荡漾，你的笑容清晰可见。"

            请输出 JSON 格式：
            {{
                "segments": [
                    {{"id": "seg_verse_1", "text": "主歌内容...", "label": "主歌 A"}},
                    {{"id": "seg_chorus_1", "text": "副歌内容...", "label": "副歌"}}
                ]
            }}

            整首歌词的至少要有约 4-8 个段落，每个段落至少有4-8句歌词。直接输出 JSON。"""
    
    result = _call_llm(prompt)
    parsed = _parse_json(result)
    print(parsed,flush=True)
    return {
        "candidate_id": f"cand_{uuid.uuid4().hex[:8]}",
        "type": "lyrics",
        "content": parsed,
        "description": f"根据「{theme}」生成的歌词"
    }


@tool  
def rewrite_segment_tool(segment_label: str, instruction: str) -> dict:
    """
    重写指定的歌词段落。
    
    Args:
        segment_label: 段落标签，如"主歌"、"副歌"
        instruction: 修改指令，如"更加伤感一点"
    
    Returns:
        包含候选ID和重写内容的字典
    """
    context = get_current_session_context()
    work_data = context.get("work", {})
    
    # 找目标段落
    target = None
    for seg in work_data.get("lyrics", []):
        label = seg.get("label", "")
        if segment_label in label or label in segment_label:
            target = seg
            break
    
    if not target:
        return {"error": f"未找到段落: {segment_label}"}
    
    prompt = f"""重写以下歌词段落：

            段落：{target.get('label')}
            当前内容：{target.get('text_content', '(空)')}

            修改要求：{instruction}

            【格式要求】
            - 歌词必须使用中文标点（逗号、句号、感叹号等）分隔每个句子/分句
            - 示例："月光洒在窗台，思念像鸟儿飞来。那些回忆仍在心间荡漾。"

            输出 JSON：
            {{"id": "{target.get('id')}", "text": "修改后的内容..."}}"""
    
    result = _call_llm(prompt)
    parsed = _parse_json(result)
    
    return {
        "candidate_id": f"cand_{uuid.uuid4().hex[:8]}",
        "type": "segment",
        "content": parsed,
        "description": f"重写「{segment_label}」"
    }


@tool
def extend_lyrics_tool(instruction: str) -> dict:
    """
    续写新的歌词段落。
    
    Args:
        instruction: 续写要求，如"加一段桥段"
    
    Returns:
        包含候选ID和新段落的字典
    """
    context = get_current_session_context()
    work_data = context.get("work", {})
    
    existing = "\n".join([
        f"[{s.get('label')}]: {s.get('text_content', '(空)')}" 
        for s in work_data.get("lyrics", [])
    ])
    
    prompt = f"""根据现有歌词续写新段落：

        现有内容：
        {existing}

        续写要求：{instruction}

        【格式要求】
        - 歌词必须使用中文标点（逗号、句号、感叹号等）分隔每个句子/分句
        - 示例："月光洒在窗台，思念像鸟儿飞来。那些回忆仍在心间荡漾。"

        输出 JSON：
        {{
            "segments": [
                {{"id": "seg_new", "text": "新段落内容...", "label": "新段落", "type": "bridge"}}
            ]
        }}"""
    
    result = _call_llm(prompt)
    parsed = _parse_json(result)
    
    return {
        "candidate_id": f"cand_{uuid.uuid4().hex[:8]}",
        "type": "lyrics",
        "content": parsed,
        "description": "续写的新段落"
    }


@tool
def ask_clarification_tool(question: str) -> dict:
    """
    当用户需求不明确时，向用户提问。
    
    Args:
        question: 要问用户的问题
    
    Returns:
        问题字典
    """
    return {
        "action": "clarify",
        "question": question
    }
@tool
def lyric_search(query: str) -> dict:
    """
    根据歌曲名搜索歌词。
    
    Args:
        query: 歌曲名查询字符串
    
    Returns:
        搜索结果字典
    """
    ln=LyricsNetCn()
    search_results = ln.query_lyrics(query)
    if not search_results:
            return {
                "found": False,
                "message": f"未找到歌曲「{song_name}」"
            }
    songs = search_results.get('歌曲', [])
    first_song = songs[0]
    song_id = first_song.get('id')
    details = ln.lyrics_details(song_id)
    return {
        "candidate_id": f"cand_{uuid.uuid4().hex[:8]}",
        "type": "lyrics",
        "content": details,
        "description": "歌词"
    }
    
@tool
def search_local_lyrics(query: str, style: str = None, k: int = 3) -> dict:
    """
    从本地歌词库中检索相似歌词作为参考。
    
    使用场景：
    - 用户要求参考某种风格的歌词
    - 需要查找特定主题的歌曲
    - 想了解某种风格的歌曲特点
    
    Args:
        query: 查询文本（主题、关键词、风格描述等），如"青春 怀念"、"失恋 悲伤"
        style: 风格过滤（可选），如"民谣"、"摇滚"、"流行"、"中国风"
        k: 返回结果数量（默认3条，最多10条）
    
    Returns:
        包含检索结果的字典，格式：
        {
            "found": bool,
            "count": int,
            "results": [
                {
                    "title": "歌名",
                    "artist": "歌手",
                    "style": "风格",
                    "theme": "主题",
                    "similarity": 0.85,
                    "content": "完整歌词内容"
                }
            ],
            "message": "检索结果说明"
        }
    """
    try:
        from rag import get_simple_rag
        
        # 获取 RAG 实例
        rag = get_simple_rag()
        
        # 限制 k 的最大值
        k = min(k, 10)
        
        # 执行检索
        results = rag.search(query, style=style, k=k)
        
        if not results:
            return {
                "found": False,
                "count": 0,
                "results": [],
                "message": f"未找到与「{query}」相关的歌词" + (f"，风格：{style}" if style else "")
            }
        
        # 格式化返回结果
        formatted = []
        for result in results:
            formatted.append({
                "title": result["title"],
                "artist": result["artist"],
                "style": result["style"],
                "theme": result["theme"],
                "similarity": result["similarity"],
                "content": result["content"]
            })
        
        # 计算平均相似度
        avg_similarity = sum(r["similarity"] for r in results) / len(results)
        
        return {
            "found": True,
            "count": len(formatted),
            "results": formatted,
            "message": f"找到 {len(formatted)} 首相关歌词，平均相似度：{avg_similarity:.2f}"
        }
        
    except Exception as e:
        return {
            "found": False,
            "count": 0,
            "results": [],
            "message": f"检索失败: {str(e)}",
            "error": str(e)
        }


# 导出所有工具
ALL_TOOLS = [
    generate_lyrics_tool,
    rewrite_segment_tool,
    extend_lyrics_tool,
    ask_clarification_tool,
    lyric_search,
    search_local_lyrics, 
]
