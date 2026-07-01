# FuturePhrase - AI 歌词创作工作台

> 一个实验性的 AI 驱动的歌词创作工作台，将 ReAct Agent 与歌词编辑、简谱可视化相结合，为音乐创作者提供全新的创作体验。

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3.0-1C3C3C?logo=langchain&logoColor=white)](https://www.langchain.com/)

---

## 📖 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 文档](#api-文档)
- [环境变量](#环境变量)
- [后续规划](#后续规划)
- [License](#license)

---

## 🎯 项目简介

**FuturePhrase** 是一个将 **ReAct Agent** 与歌词创作深度融合的实验性工作台。它不仅仅是"生成歌词"，更是一个**可交互、可迭代、可追溯**的创作伙伴。

与传统的 AI 生成工具不同，FuturePhrase 的核心设计理念是：

- **透明性**：Agent 的每一步思考（Thought）、工具调用（Action）和观察结果（Observation）都通过 SSE 实时推送到前端，用户可以看到 AI 的"创作过程"。
- **可控性**：用户可以选择接受/拒绝 AI 的建议（Candidates），将满意的候选项应用到工作区，保留人工决策的最终权力。
- **项目化**：每首歌以 Work/Project 为单位隔离存储，包含歌词段落、简谱数据、聊天历史和候选项，方便多作品并行创作。

这个项目诞生于对"AI 能否真正辅助创作"的探索，目前处于**原型验证阶段**，未来计划持续迭代。

---

## ✨ 核心功能

### 🎭 ReAct Agent 驱动创作
Agent 以 **Thought → Action → Observation** 的循环方式工作，支持以下工具：
- **生成（Generate）**：根据提示词从零创作歌词
- **改写（Rewrite）**：对现有段落进行风格/主题改写
- **续写（Continue）**：基于已有内容续写下一段
- **检索（Retrieve）**：从知识库中检索相关素材
- **澄清（Clarify）**：向用户提问以获取更多上下文

### 📝 多模式创作工作流
支持四种工作流模式，适应不同创作场景：
| 模式 | 说明 |
|:---|:---|
| `full` | 完整创作：从主题到完整歌词全流程生成 |
| `auto_complete` | 自动补全：基于已写部分智能续写 |
| `imitate` | 风格模仿：学习参考文本的风格进行创作 |
| `fitting` | 配合作曲：基于简谱/旋律约束生成歌词 |

### 🌊 流式交互体验
通过 **Server-Sent Events (SSE)** 实时推送 Agent 的每一步输出：
- `thought`：Agent 当前思考过程
- `action`：调用的工具名称与参数
- `observation`：工具执行结果
- `text_chunk`：生成文本的增量片段
- `candidate_update`：新的候选项产生
- `clarify`：Agent 向用户提问
- `work_update`：工作区状态更新
- `done` / `error`：流结束或错误

### 🎨 前端创作界面
- **歌词编辑**：段落级别的增删改，实时保存
- **简谱视图**：与歌词段落关联的可视化布局
- **候选管理**：浏览 AI 生成的多个候选版本，一键"应用到工作区"
- **聊天面板**：与 Agent 自由对话，记录完整创作历史

---

## 🛠️ 技术栈

### 前端
| 技术 | 版本 | 用途 |
|:---|:---|:---|
| TypeScript | 5.x | 类型安全 |
| Next.js | 16 (App Router) | React 全栈框架 |
| React | 19.x | UI 构建 |
| TailwindCSS | 3.x | 样式方案 |

### 后端
| 技术 | 版本 | 用途 |
|:---|:---|:---|
| Python | 3.10+ | 运行环境 |
| FastAPI | 0.135.2 | Web API 框架 |
| Uvicorn | 0.42.0 | ASGI 服务器 |
| Pydantic | 2.12.5 | 数据校验 |
| LangChain | 1.2.13 | Agent 框架 |
| LangChain-OpenAI | 1.1.12 | OpenAI 模型集成 |

### 通信
- **SSE (Server-Sent Events)**：`text/event-stream` 流式推送

---

## 🚀 快速开始

### 前置要求
- Python 3.10+
- Node.js 18+
- OpenAI API Key（或其他兼容的 LLM API）

### 1. 克隆仓库
```bash
git clone https://github.com/syanken/FuturePhrase.git
cd FuturePhrase
```

### 2. 启动后端

```bash
cd server
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 配置环境变量（详见"环境变量"章节）
export OPENAI_API_KEY=your_api_key_here
export OPENAI_API_BASE=https://your-openai-base.example.com  # 可选

uvicorn main:app --host 0.0.0.0 --port 6789 --reload
```

后端服务将在 `http://localhost:6789` 运行，API 文档访问 `/docs`。

### 3. 启动前端

```bash
cd client
npm install
npm run dev
```

前端开发服务将在 `http://localhost:3000` 运行。

---

## 📂 项目结构

```
FuturePhrase/
├── client/                          # Next.js 前端
│   ├── app/
│   │   └── page.tsx                 # 主 UI（歌词编辑、简谱渲染、SSE 客户端）
│   ├── mockData.ts                  # 模拟数据
│   ├── styles.ts                    # 样式定义
│   ├── types.ts                     # 类型声明
│   └── package.json
│
├── server/                          # FastAPI 后端
│   ├── app/
│   │   ├── main.py                  # FastAPI 应用入口与路由
│   │   ├── agent.py                 # LyricAgent（ReAct 循环实现）
│   │   ├── session.py               # 内存/Mock 数据管理
│   │   ├── models.py                # Pydantic 数据模型
│   │   ├── rag.py                   # 检索/RAG 逻辑
│   │   ├── workflows/               # 四种工作流实现
│   │   │   ├── full.py
│   │   │   ├── auto_complete.py
│   │   │   ├── imitate.py
│   │   │   └── fitting.py
│   │   └── templates/               # 静态调试页面
│   │       └── debug.html
│   └── requirements.txt
│
└── README.md
```

---

## 📮 API 文档

### 健康检查
`GET /api/v1/health`

### 项目管理
| Method | Endpoint | Description |
|:---|:---|:---|
| GET | `/api/v1/projects` | 获取所有项目列表 |
| POST | `/api/v1/projects` | 创建新项目 |
| GET | `/api/v1/projects/{project_id}` | 获取指定项目详情 |
| PUT | `/api/v1/projects/{project_id}` | 更新项目内容 |
| DELETE | `/api/v1/projects/{project_id}` | 删除项目 |

### 对话与生成（SSE 流）
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/api/v1/projects/{project_id}/chat` | 与 Agent 对话（SSE 流式） |
| DELETE | `/api/v1/projects/{project_id}/chat` | 清空项目聊天历史 |
| POST | `/api/v1/projects/{project_id}/confirm` | 确认/拒绝候选（accept/reject） |
| GET | `/api/v1/projects/{project_id}/candidates` | 获取所有候选项 |
| GET | `/api/v1/modes` | 获取所有可用工作流模式 |
| POST | `/api/v1/generate` | 独立歌词生成（SSE 流） |

### SSE 事件类型
| Event | Description |
|:---|:---|
| `thought` | Agent 当前思考内容 |
| `action` | 工具调用（名称 + 参数） |
| `observation` | 工具执行结果 |
| `text_chunk` | 生成文本的增量片段 |
| `candidate_update` | 新候选项产生 |
| `clarify` | Agent 向用户提问 |
| `work_update` | 工作区状态更新 |
| `done` | 流正常结束 |
| `error` | 错误发生 |

---

## 🔧 环境变量
编写.env文件
| 变量名 | 是否必需 | 说明 |
|:---|:---:|:---|
| `MODEL` | ✅ | LLM 名称 |
| `OPENAI_API_KEY` | ✅ | LLM API 密钥 |
| `OPENAI_API_BASE` | ❌ | 自定义 LLM 服务端点（如使用代理或本地模型） |


---

## 🗺️ 后续规划

FuturePhrase 目前处于**原型验证阶段**，以下功能已在规划中：

- [ ] **持久化存储**：从内存/Mock 迁移到 PostgreSQL + 文件存储
- [ ] **用户认证**：支持多用户隔离创作空间
- [ ] **简谱编辑增强**：支持交互式简谱拖拽编辑
- [ ] **更多工作流**：支持歌词押韵优化、情绪分析等
- [ ] **导出功能**：支持导出为 MIDI、标准歌词文件格式
- [ ] **模型切换**：支持多种 LLM 后端（Claude、本地模型等）

欢迎通过 Issue 或 PR 参与贡献！

---

## 📄 License

[MIT License](LICENSE)

---

## 🙏 致谢

- [LangChain](https://www.langchain.com/) - Agent 框架
- [FastAPI](https://fastapi.tiangolo.com/) - 高性能 Web 框架
- [Next.js](https://nextjs.org/) - React 全栈框架
- [OpenAI](https://openai.com/) - LLM API

---

*FuturePhrase — 让创作过程可见，让 AI 成为真正的工作伙伴。*
