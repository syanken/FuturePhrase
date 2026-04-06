import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from models import Intent, Work, Segment

class Orchestrator:
    """意图路由器"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="hunyuan-lite",
            streaming=True,
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_API_BASE"),
        )
    
    async def process(self, user_message: str, current_work: Work):
        """处理用户消息，返回流式响应"""
        intent = self._detect_intent(user_message, current_work)
        
        if intent.type == "generate":
            async for chunk in self._generate_full(user_message, current_work):

                yield chunk
        elif intent.type == "rewrite":
            async for chunk in self._rewrite_segment(user_message, current_work, intent.target_segments):

                yield chunk
        elif intent.type == "extend":
            async for chunk in self._extend(user_message, current_work):

                yield chunk
        else:
            async for chunk in self._chat(user_message, current_work):

                yield chunk
    
    def _detect_intent(self, message: str, work: Work) -> Intent:
        """简单的意图识别"""
        rewrite_keywords = ["改", "换", "重写", "修改", "改成", "调整"]
        if any(kw in message for kw in rewrite_keywords):
            target_segments = []
            if "副歌" in message:
                target_segments = ["seg_chorus_1"]
            elif "主歌" in message:
                target_segments = ["seg_verse_1", "seg_verse_2"]
            return Intent(type="rewrite", text=message, target_segments=target_segments)
        
        extend_keywords = ["续写", "继续", "加一段", "再来一段"]
        if any(kw in message for kw in extend_keywords):
            return Intent(type="extend", text=message, target_segments=[])
        
        return Intent(type="generate", text=message, target_segments=[])
    
    async def _generate_full(self, message: str, work: Work):
        """全文生成"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一位专业作词人。根据用户需求创作歌词。

【输出格式要求 - 必须严格遵守】
输出 JSON 格式，不要有任何额外文字：
{{
    "segments": [
        {{"id": "seg_verse_1", "text": "主歌第一段内容..."}},
        {{"id": "seg_chorus_1", "text": "副歌内容..."}},
        {{"id": "seg_verse_2", "text": "主歌第二段内容..."}}
    ]
}}

注意：
- text 字段直接写歌词文字，不要加引号外的标点
- 每段 4-6 句为宜
- 必须输出完整 JSON，不要省略"""),
            ("human", "{input}")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        async for chunk in chain.astream({"input": message}):
            
            yield f"data: {chunk}\n\n"
    
    async def _rewrite_segment(self, message: str, work: Work, target_ids: list[str]):
        """重写指定段落"""
        context_parts = []
        for seg in work.segments:
            context_parts.append(f"[{seg.label}]: {seg.text_content}")
        context = "\n".join(context_parts)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一位专业作词人。用户想修改某段歌词。

【当前歌曲内容】
{context}

【用户需求】
{message}

【输出格式要求】
输出 JSON 格式：
{{
    "segments": [
        {{"id": "目标段落id", "text": "修改后的内容..."}}
    ]
}}

只输出被修改的段落，不要输出其他段落。"""),
            ("human", "{input}")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        async for chunk in chain.astream({"context": context, "message": message, "input": message}):
            yield f"data: {chunk}\n\n"
    
    async def _extend(self, message: str, work: Work):
        """续写新段落"""
        context = "\n".join([f"[{seg.label}]: {seg.text_content}" for seg in work.segments])
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一位专业作词人。根据现有歌词续写新段落。

【当前歌词】
{context}

【用户需求】
{message}

【输出格式】
JSON 格式：
{{
    "segments": [
        {{"id": "seg_new_1", "text": "新段落内容..."}}
    ]
}}"""),
            ("human", "{message}")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        async for chunk in chain.astream({"context": context, "message": message}):
            yield f"data: {chunk}\n\n"
    
    async def _chat(self, message: str, work: Work):
        """自由对话"""
        context = "\n".join([f"[{seg.label}]: {seg.text_content}" for seg in work.segments])
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一位专业的作词助手。当前歌曲：
{context}

与用户交流，给出建议或帮助。简洁回复，不超过 100 字。"""),
            ("human", "{message}")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        async for chunk in chain.astream({"context": context, "message": message}):
            yield f"data: {chunk}\n\n"
