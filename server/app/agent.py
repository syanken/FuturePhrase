import os
import json
from typing import AsyncGenerator
from datetime import datetime

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage

from models import Work
from session import get_project, add_chat_message, add_candidate, confirm_candidate
from tools import ALL_TOOLS, get_current_session_context, set_current_session_context


class LyricAgent:
    """歌词创作 Agent"""
    
    def __init__(self):
        self._llm = None
        self._llm_with_tools = None
    
    @property
    def llm(self):
        """延迟初始化"""
        if self._llm is None:
            self._llm = ChatOpenAI(
                # model="hunyuan-turbos-latest",
                model="hunyuan-lite",
                streaming=True,
                temperature=0.7,
                api_key=os.getenv("OPENAI_API_KEY"),
                base_url=os.getenv("OPENAI_API_BASE"),
            )
            self._llm_with_tools = self._llm.bind_tools(ALL_TOOLS)
        return self._llm
    
    @property
    def llm_with_tools(self):
        if self._llm_with_tools is None:
            _ = self.llm
        return self._llm_with_tools
    
    async def process_message(
        self, 
        user_message: str, 
        project_id: str
    ) -> AsyncGenerator[dict, None]:
        """ReAct 模式处理用户消息（项目级隔离）"""
        project = get_project(project_id)
        print(project,flush=True) 
        if not project:
            yield {"event": "error", "data": {"message": "项目不存在"}}
            return
        
        # 设置上下文
        set_current_session_context(project_id, project.model_dump())
        
        # 记录用户消息
        add_chat_message(project_id, "user", user_message)
        
        # 构建消息
        messages = self._build_messages(project)
        full_response = ""
        max_iterations = 5  # 防止无限循环
        
        try:
            for iteration in range(max_iterations):
                # print(messages)
                # 打印本轮信息
                # print(f"\n{'='*60}", flush=True)
                # print(f"[第{iteration + 1}轮 ReAct 循环]", flush=True)
                # print(f"{'='*60}", flush=True)
                
                # # 打印发送给 LLM 的消息
                # print(f"\n[Thought] 调用 LLM...", flush=True)
                # print(f"  发送消息列表:", flush=True)
                # for i, msg in enumerate(messages):
                #     msg_type = type(msg).__name__
                #     content = msg.content
                #     if len(content) > 100:
                #         content = content[:100] + "..."
                #     tool_calls_info = ""
                #     if hasattr(msg, 'tool_calls') and msg.tool_calls:
                #         tool_calls_info = f" [tool_calls: {len(msg.tool_calls)}个]"
                #     print(f"    [{i}] {msg_type}: {content}{tool_calls_info}", flush=True)
                
                # 1. Thought: 模型思考并决定行动
                response = await self.llm_with_tools.ainvoke(messages)
                
                # 2. 输出思考过程
                if response.content:
                    # print(f"\n[Thought] LLM 返回:\n  {response.content[:200]}{'...' if len(response.content) > 200 else ''}", flush=True)
                    yield {"event": "thought", "data": {"content": response.content}}
                    messages.append(response)
                    full_response = response.content
                
                # 3. 检查是否有工具调用
                if hasattr(response, 'tool_calls') and response.tool_calls:
                    for tool_call in response.tool_calls:
                        tool_name = tool_call['name']
                        tool_args = tool_call['args']
                        tool_id = tool_call.get('id', tool_name)
                        
                        # 4. Action: 执行行动
                        # print(f"\n[Action] 执行工具: {tool_name}", flush=True)
                        # print(f"  参数: {tool_args}", flush=True)
                        yield {"event": "action", "data": {"tool": tool_name, "args": tool_args}}
                        tool_result = self._execute_tool(tool_name, tool_args)
                        
                        # 5. Observation: 观察结果
                        observation = json.dumps(tool_result, ensure_ascii=False)
                        # print(f"\n[Observation] 工具返回:", flush=True)
                        # print(f"  {observation[:200]}{'...' if len(observation) > 200 else ''}", flush=True)
                        yield {"event": "observation", "data": {"result": tool_result}}
                        
                        # 添加工具消息到历史
                        messages.append(ToolMessage(
                            content=observation,
                            tool_call_id=tool_id
                        ))
                        
                        # 处理候选
                        if tool_name in ["generate_lyrics_tool", "rewrite_segment_tool", "extend_lyrics_tool","lyric_search"]:
                            if isinstance(tool_result, dict) and "candidate_id" in tool_result:
                                candidate = add_candidate(
                                    project_id=project_id,
                                    candidate_type=tool_result.get("type", "lyrics"),
                                    content=tool_result.get("content", {}),
                                    description=tool_result.get("description", ""),
                                    candidate_id=tool_result["candidate_id"]
                                )
                                if candidate:
                                    yield {"event": "candidate_update", "data": {"candidate": candidate.model_dump()}}
                        
                        # 提问工具直接结束循环
                        if tool_name == "ask_clarification_tool":
                            # print(f"\n[结束] 提问工具触发，结束循环", flush=True)
                            yield {"event": "clarify", "data": tool_result}
                            full_response = tool_result.get("question", "")
                            add_chat_message(project_id, "assistant", full_response)
                            yield {"event": "done", "data": {}}
                            return
                    
                    # 继续循环，让模型基于观察继续思考
                    # print(f"\n[继续] 进入下一轮 ReAct 循环...", flush=True)
                    continue
                else:
                    # 无工具调用，说明已得出最终答案
                    # print(f"\n[结束] 无工具调用，任务完成", flush=True)
                    break
            
            # 记录 AI 响应
            add_chat_message(project_id, "assistant", full_response)
            yield {"event": "done", "data": {}}
            
        except Exception as e:
            yield {"event": "error", "data": {"message": str(e)}}
    
    def _build_messages(self, project: Work) -> list:
        """构建消息列表"""
        work_info = self._format_work(project)
        
        system_content = f"""你是一位专业的歌词创作助手，使用 ReAct 模式工作。

【工作模式】
在开始思考之前，先判断用户的意图：
1. **讨论**：如果用户希望和你讨论歌曲创作或者已有的作品历史记录，请直接输出你的讨论内容，不需要调用任何工具。
2. **写作**：只有当用户明确要求进行写作时，才进入 ReAct 循环调用工具。
ReAct模式中，每次响应遵循：Thought → Action → Observation 循环
1. Thought: 分析用户需求。首先评估上一轮行动的结果，刚才的工具调用是否成功？生成的歌词符合【当前作品】的要求吗？检查目标一致性，我现在做的事情是否偏离了用户最初的需求？涉及历史数据的用历史问答来回答。
2. Action: 选择并调用合适的工具
3. Observation: 观察工具返回结果
4. 可以多次循环直到完成任务，完成后直接输出简单回复文本

【当前作品】
{work_info}

【可用工具】
- generate_lyrics_tool(theme, style): 生成歌词
- rewrite_segment_tool(segment_label, instruction): 重写段落
- extend_lyrics_tool(instruction): 续写新段落
- ask_clarification_tool(question): 向用户提问
- lyric_search(query): 搜索歌词

【规则】
- 每次响应先说明思考过程，再决定是否调用工具
- 任务完成后直接给出最终答案，不再调用工具
- 简洁友好，避免重复
- 不生成与歌词创作无关的内容
"""
        
        messages = [SystemMessage(content=system_content)]
        
        # 历史消息
        for msg in project.chat_history[-10:]:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))
        
        return messages
    
    def _format_work(self, work: Work) -> str:
        """格式化作品"""
        parts = [f"《{work.title}》"]
        for seg in work.lyrics:
            text = seg.text_content or "(待填写)"
            parts.append(f"[{seg.label}]: {text}")
        return "\n".join(parts)
    
    def _execute_tool(self, tool_name: str, args: dict) -> dict:
        """执行工具"""
        from tools import (
            generate_lyrics_tool,
            rewrite_segment_tool,
            extend_lyrics_tool,
            ask_clarification_tool,
            lyric_search,
            search_local_lyrics,
        )
        
        tool_map = {
            "generate_lyrics_tool": generate_lyrics_tool,
            "rewrite_segment_tool": rewrite_segment_tool,
            "extend_lyrics_tool": extend_lyrics_tool,
            "ask_clarification_tool": ask_clarification_tool,
            "lyric_search":lyric_search,
            "search_local_lyrics": search_local_lyrics,
        }
        
        tool_func = tool_map.get(tool_name)
        if tool_func:
            return tool_func.invoke(args)
        return {"error": f"未知工具: {tool_name}"}
    
    async def confirm_candidate(
        self, 
        project_id: str, 
        candidate_id: str, 
        action: str
    ) -> dict:
        """确认候选"""
        project = get_project(project_id)
        if not project:
            return {"success": False, "message": "项目不存在"}
        
        candidate = confirm_candidate(project_id, candidate_id, action)
        
        if not candidate:
            return {"success": False, "message": "候选不存在"}
        
        action_text = "接受" if action == "accept" else "拒绝"
        add_chat_message(project_id, "system", f"用户{action_text}了: {candidate.description}")
        
        return {
            "success": True,
            "action": action,
            "candidate": candidate.model_dump(),
            "work": project.model_dump()
        }


# 全局实例
lyric_agent = LyricAgent()
