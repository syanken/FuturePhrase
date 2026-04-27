import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser,JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate,PromptTemplate
from core.lyrics_api import LyricsNetCn
from abc import ABC, abstractmethod

class BaseWorkflow(ABC):
    """所有 Workflow 的公共基类"""
    DEFAULT_MODEL = "hunyuan-lite"
    DEFAULT_TEMPERATURE = 0

    def __init__(self, model: str = None, temperature: float = None, streaming: bool = True):
        self.llm = ChatOpenAI(
            model=model or self.DEFAULT_MODEL,
            streaming=streaming,
            temperature=temperature if temperature is not None else self.DEFAULT_TEMPERATURE,
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_API_BASE"),
        )
        self.ln = LyricsNetCn()

    @abstractmethod
    async def run(self, user_input: str = None):
        """子类必须实现自己的执行逻辑"""

class LyricWorkflow(BaseWorkflow):
    """自由创作"""
    async def run(self,user_input = None):
        user_input = user_input or "写一首赞美的诗"
        user_input_optimized = self.prompt_optimize(user_input)
        print(user_input_optimized)
        prompt = ChatPromptTemplate.from_messages([
            ("system", """
                你是一位获得过格莱美奖的专业作词人。
                    
                    【任务目标】
                    根据用户输入，创作一首结构完整、情感丰富、篇幅适中的现代流行歌曲。
                    
                    【关键约束 - 必须遵守】
                    1. **结构完整性**：必须包含 [主歌]、[副歌]、[桥段] 等标准段落。严禁只写一两句就结束。
                    2. **篇幅要求**：整首歌词的至少要有约 4-8 个段落，每个段落至少有4-8句歌词。
                    3. **内容深度**：不要使用陈词滥调，要运用具体的意象（如：具体的地点、动作、心理活动）来填充每一段。
                    4. **输出格式**：必须严格输出为以下格式：
                    {{
                        "title": "歌曲标题",
                        "style": "建议的音乐风格",
                        "lyrics": [
                            {{"id": 1, "type": "verse", "content": "主歌内容..."}},
                            {{"id": 2, "type": "chorus", "content": "副歌内容..."}}
                        ]
                    }}
            """),
            ("human", "{input}")
        ])

        # 链条 = 提示词 -> 模型 -> 字符串解析器
        chain = prompt | self.llm | StrOutputParser()

        print(f"user: {user_input_optimized}\nAI: ", end="")
        async for chunk in chain.astream({"input": user_input_optimized}):
            yield f"data: {chunk}\n\n" 
            print(chunk, end="", flush=True)

        print() 

    def prompt_optimize(self,user_input):
        prompt = ChatPromptTemplate.from_messages([
            ("system", """
                你是一位专业的音乐制作人。用户想写一首歌，但描述很简单。
                请根据用户输入，扩写一段详细的“创作指令”，用于指导作词人。
                如果用户提供了模板或格式，请指导严格按模板或格式填充创作。
                请补充具体的主题,风格,情绪以及场景细节、意象建议（如：雨天、末班车）和叙事角度。
                输出扩写后的指令（不要输出歌词和说明，直接输出指令），指令不需要太复杂：
            """),
            ("human", "{input}")
        ])

        # 链条 = 提示词 -> 模型 -> 字符串解析器
        chain = prompt | self.llm | StrOutputParser()
        res=''
        print(f"user: {user_input}\nAI: ", end="")
        for chunk in chain.stream({"input": user_input}):
            # yield f"data: {chunk}\n\n" 
            res+=chunk
            print(chunk, end="", flush=True)
        return res

class AutoCompleteWorkflow(BaseWorkflow):
    """补全"""
    def __init__(self):
        super().__init__(temperature=0.5)

    async def run(self,user_input = None):
        user_input = user_input or "天青色等"
        prompt = PromptTemplate.from_template("""
            你是一位精通现代流行音乐结构的资深填词人。你擅长捕捉情感脉络，并能创作出朗朗上口、韵脚和谐的歌词。

            **创作规范：**
            - 保持与上下文一致的情感基调（快乐/伤感/励志/深情等）
            - 每句歌词控制在8-15字（中文），便于演唱
            - 使用具象词汇，避免空洞的形容词堆砌
            - 保持主歌/副歌的句式结构一致性

            **用户输入：**
            {input}

            **任务：**
            用户输入的文本中，【PLACEHOLDER】代表需要填充的空白。请根据上下文，将【PLACEHOLDER】替换为最合适的一句歌词。

            **输出要求：**
            1. 直接输出替换【PLACEHOLDER】后的歌词
            2. 不添加任何解释或额外文本，不添加样式标记，不再保留【PLACEHOLDER】
            3. 如果原文本有多个【PLACEHOLDER】，全部替换

            **输出**：直接输出替换【PLACEHOLDER】后的歌词
            """)
        # 链条 = 提示词 -> 模型 -> 字符串解析器
        chain = prompt | self.llm | StrOutputParser()

        print(f"user: {user_input}\nAI: ", end="")
        async for chunk in chain.astream({"input": user_input}):
            yield f"data: {chunk}\n\n" 
            print(chunk, end="", flush=True)

        print()

class ImitateWorkflow(BaseWorkflow):
    """风格模仿"""

    async def run(self, user_input=None):
        user_input = user_input or "模仿《青花瓷》的风格写一段歌词"
        
        yield f"data: [系统] 正在分析您的输入...\n\n"
        
        # 阶段1: 关键词提取（同步，通常很快）
        prompt_extract = PromptTemplate.from_template("""
            你是一个资深的关键词提取助手。根据用户输入，提取要查询的关键词，以JSON格式输出。
            
            示例：
            用户输入：模仿《青花瓷》作曲
            输出：{{"text":["青花瓷"]}}
            
            用户输入：模仿周杰伦的风格创作一首关于校园的歌
            输出：{{"text":["周杰伦","校园"]}}
            
            用户输入：{input}
        """)
        
        chain = prompt_extract | self.llm | JsonOutputParser()
        res = None
        print(f"[Imitate] Step 1 - 提取关键词: {user_input}\n", end="", flush=True)
        for chunk in chain.stream({"input": user_input}):
            res = chunk
        
        if not res or 'text' not in res:
            yield f"data: 错误：无法从输入中提取关键词\n\n"
            return
        
        text = res['text']
        keywords_str = "、".join(text)
        print(f"  -> 关键词: {keywords_str}")
        yield f"data: [系统] 检索到参考歌曲: {keywords_str}\n\n"
        
        # 阶段2: 查询歌词资料
        yield f"data: [系统] 正在查询歌词资料...\n\n"
        lyrics = []
        for t in text:
            try:
                ls= self.ln.query_lyrics(t)
                lyrics += ls
                if ls:
                    yield f"data: [系统] 找到 {len(ls)} 条关于「{t}」的资料\n\n"
            except Exception as e:
                yield f"data: [警告] 查询「{t}」时出错: {str(e)}\n\n"
        
        if not lyrics:
            yield f"data: 警告：未找到参考歌词资料，将基于风格描述进行创作\n\n"
        
        # 阶段3: 生成模仿内容（流式）
        yield f"data: [系统] 开始生成模仿歌词...\n\n"
        
        prompt_gen = ChatPromptTemplate.from_messages([
            ("system", """
你是一位获得过格莱美奖的专业作词人，精通各种音乐风格的创作。

【任务】
根据用户指定的风格或参考歌曲，创作一首具有相似风格的原创歌词。

【要求】
1. **结构完整**：包含主歌、副歌、桥段等标准段落
2. **风格一致**：保持与参考资料相似的语言特点、意象运用和情感表达
3. **篇幅适中**：4-8个段落，每段4-8句
4. **原创性**：不要直接抄袭原歌词的句子，而是学习其风格和技巧

【输出格式】
{{
    "title": "歌曲标题",
    "style": "音乐风格",
    "lyrics": [
        {{"id": 1, "type": "verse", "content": "主歌..."}},
        {{"id": 2, "type": "chorus", "content": "副歌..."}}
    ]
}}
            """),
            ("human", "用户需求：{input}\n\n参考资料：\n{refer}")
        ])
        
        chain = prompt_gen | self.llm | StrOutputParser()
        print(f"[Imitate] Step 3 - 流式生成\nAI: ", end="", flush=True)
        async for chunk in chain.astream({"input": user_input, "refer": str(lyrics[:5]) if lyrics else "无"}):
            yield f"data: {chunk}\n\n"
            print(chunk, end="", flush=True)


class LyricFittingWorkflow(BaseWorkflow):
    """歌词填空"""
    def __init__(self):
        super().__init__(model="hunyuan-turbos-latest", temperature=0.5)
    async def run(self,user_input = None):
        user_input = user_input or "天青色等"
        t="""
            # Role
            你是一个严格的“歌词填空机器”。你的唯一任务是根据给定的模板和掩码指令，填入精确字数的歌词。

            # Input Format
            模板：天青色等烟雨 [MASK:5] 炊烟袅袅升起 [MASK:5]
            主题：古风

            # Rules (必须严格遵守)
            1. **精确字数**：[MASK:N] 必须替换为 N 个汉字。严禁多字或少字。
            2. **保持原样**：模板中除了 [MASK] 以外的任何文字（包括标点），必须原封不动地保留，严禁修改、删除或替换。
            3. **纯文本输出**：直接输出填好后的完整句子。
            - 禁止输出 "1.", "2." 等序号。
            - 禁止输出 "意境：" 等解释性文字。
            - 禁止输出任何 Markdown 格式标记。
            4. **多样性**：如果用户需要多个选项，请通过换行符分隔，不要加任何前缀。

            # Few-Shot Examples 
            User: 这里的冬天,[MASK:4],只有风知道
            Assistant:
            这里的冬天,依然寒冷,只有风知道
            这里的冬天,故事未完,只有风知道

            User: [MASK:2]的夜,[MASK:7]
            Assistant:
            无眠的夜,只有影子陪着我
            漆黑的夜,听不到你的呼吸

            # Current Task
            User: {input}
            Assistant:
            """
        prompt = PromptTemplate.from_template("""
            # Role
            你是一个严格的“歌词填空机器”。你的唯一任务是根据给定的模板和掩码指令，填入精确字数的歌词。

            # Input Format
            模板：天青色等烟雨 ______(5字)炊烟袅袅升起 ______(5字)
            主题：古风

            # Rules (必须严格遵守)
            1. **精确字数**：请将下划线 ______(5字)替换为符合字数要求的歌词。
            2. **保持原样**：模板中除了 ______(5字)以外的任何文字（包括标点），必须原封不动地保留，严禁修改、删除或替换。
            3. **纯文本输出**：直接输出填好后的完整句子。
            - 禁止输出 "1.", "2." 等序号。
            - 禁止输出 "意境：" 等解释性文字。
            - 禁止输出任何 Markdown 格式标记。
            4. **多样性**：如果用户需要多个选项，请通过换行符分隔，不要加任何前缀。

            # Few-Shot Examples 
            User: 这里的冬天,______(4字),只有风知道
            Assistant:
            这里的冬天,依然寒冷,只有风知道
            这里的冬天,故事未完,只有风知道

            User: ______(2字)的夜,______(7字)
            Assistant:
            无眠的夜,只有影子陪着我
            漆黑的夜,听不到你的呼吸

            # Current Task
            User: {input}
            Assistant:
            """)
        # 链条 = 提示词 -> 模型 -> 字符串解析器
        chain = prompt | self.llm | StrOutputParser()

        print(f"user: {user_input}\nAI: ", end="")
        async for chunk in chain.astream({"input": user_input}):
            yield f"data: {chunk}\n\n" 
            print(chunk, end="", flush=True)

        print()