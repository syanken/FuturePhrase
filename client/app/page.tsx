"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import jianpuStyles from './master/page.module.css'
import { styles } from './styles'
import type { JianpuSegment, LyricsSegment, MeasureData, Note, Project } from './types'

const API_URL = 'http://192.168.1.21:6789'

// 防抖函数
function debounce<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

// ===== 布局计算工具函数 =====

/** 计算小节权重（基于音符总时值） */
function calculateMeasureWeight(measure: MeasureData): number {
  return measure.notes.reduce((sum, n) => sum + n.duration, 0)
}

/** 布局配置 */
const LAYOUT_CONFIG = {
  UNIT_WIDTH: 36,        // 单位时值对应的基础宽度(px)
  MIN_MEASURE_WIDTH: 80, // 最小小节宽度
  MEASURE_GAP: 8,        // 小节间距
  ROW_PADDING: 16,       // 行内边距
}

interface MeasureWithWeight {
  measure: MeasureData
  weight: number
  segmentId: string
}

interface LayoutRow {
  measures: MeasureWithWeight[]
  totalWeight: number
  segmentId: string
}

/** 分行算法 */
function layoutMeasures(
  segments: JianpuSegment[],
  containerWidth: number
): LayoutRow[] {
  if (containerWidth <= 0) return []

  const rows: LayoutRow[] = []
  let currentRow: MeasureWithWeight[] = []
  let currentWeight = 0

  // 按段落顺序处理
  for (const segment of segments) {
    if (segment.measures.length === 0) continue

    for (const measure of segment.measures) {
      const weight = calculateMeasureWeight(measure)
      const estimatedWidth = weight * LAYOUT_CONFIG.UNIT_WIDTH + LAYOUT_CONFIG.MEASURE_GAP

      // 检查是否需要换行
      if (currentRow.length > 0 && currentWeight * LAYOUT_CONFIG.UNIT_WIDTH + estimatedWidth > containerWidth - LAYOUT_CONFIG.ROW_PADDING * 2) {
        // 当前行放不下，先保存当前行
        rows.push({
          measures: currentRow,
          totalWeight: currentWeight,
          segmentId: currentRow[0].segmentId,
        })
        currentRow = []
        currentWeight = 0
      }

      currentRow.push({
        measure,
        weight,
        segmentId: segment.id,
      })
      currentWeight += weight
    }
  }

  // 保存最后一行
  if (currentRow.length > 0) {
    rows.push({
      measures: currentRow,
      totalWeight: currentWeight,
      segmentId: currentRow[0].segmentId,
    })
  }

  return rows
}

// ===== 简谱组件 =====

const Beat = ({ note }: { note: Note }) => {
  const lineCount = note.duration < 1 ? Math.log2(1 / note.duration) : 0
  return (
    <div className={jianpuStyles.beatCell}>
      <div className={jianpuStyles.highDots}>{note.octave > 0 && <span className={jianpuStyles.dot} />}</div>
      <div className={jianpuStyles.pitch}>{note.pitch}</div>
      <div className={jianpuStyles.underlineContainer}>
        {lineCount >= 1 && <div className={`${jianpuStyles.line} ${jianpuStyles.line1}`} />}
        {lineCount >= 2 && <div className={`${jianpuStyles.line} ${jianpuStyles.line2}`} />}
        {lineCount >= 3 && <div className={`${jianpuStyles.line} ${jianpuStyles.line3}`} />}
      </div>
      <div className={jianpuStyles.lowDots}>{note.octave < 0 && <span className={jianpuStyles.dot} />}</div>
      <div className={jianpuStyles.lyric}>{note.lyric}</div>
    </div>
  )
}

const BeatGroup = ({ notes }: { notes: Note[] }) => (
  <div className={jianpuStyles.beatGroup}>
    {notes.map((note, idx) => <Beat key={idx} note={note} />)}
  </div>
)

/** 单个小节：将音符按 1 拍为单位分组为 BeatGroup */
const Measure = ({ data, flexWeight }: { data: MeasureData; flexWeight: number }) => {
  const packs: Note[][] = []
  let pack: Note[] = []
  let dur = 0

  for (const note of data.notes) {
    // 处理延音：duration > 1 时拆分成多个音符
    const notesToAdd: Note[] = []
    if (note.duration > 1) {
      notesToAdd.push({ ...note, duration: 1 })
      for (let i = 1; i < note.duration; i++) {
        notesToAdd.push({ ...note, octave: 0, pitch: '-', duration: 1, lyric: '' }) // 延音线
      }
    } else {
      notesToAdd.push(note)
    }

    // 将拆分后的音符加入 pack，并处理打包
    for (const n of notesToAdd) {
      pack.push(n)
      dur += n.duration
      if (dur >= 1) {
        packs.push(pack)
        pack = []
        dur = 0
      }
    }
  }
  if (pack.length > 0) packs.push(pack)

  return (
    <div className={jianpuStyles.measure} style={{ flex: flexWeight, minWidth: LAYOUT_CONFIG.MIN_MEASURE_WIDTH }}>
      <div className={jianpuStyles.notesRow}>
        {packs.map((p, idx) => (
          <BeatGroup key={idx} notes={p} />
        ))}
      </div>
      <div className={jianpuStyles.barLine}></div>
    </div>
  )
}

/** 单行小节 */
const MeasureRow = ({ row }: { row: LayoutRow; segmentLabels: Record<string, string> }) => {
  return (
    <div className={jianpuStyles.measureRow}>
      {row.measures.map((item, idx) => (
        <Measure key={`${item.segmentId}-${item.measure.id}-${idx}`} data={item.measure} flexWeight={item.weight} />
      ))}
    </div>
  )
}

/** 段落标签 */
const SegmentLabel = ({ label, isFirst }: { label: string; isFirst: boolean }) => (
  <div className={jianpuStyles.segmentLabel} style={{ marginTop: isFirst ? 0 : 16 }}>
    {label}
  </div>
)

const JianpuView = ({ segments, title }: { segments: JianpuSegment[], title: string }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([])
  const [containerWidth, setContainerWidth] = useState(0)

  // 构建段落标签映射
  const segmentLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const seg of segments) {
      labels[seg.id] = seg.label || seg.type
    }
    return labels
  }, [segments])

  // 检查是否有任何简谱数据
  const hasNotes = segments.some((s) => s.measures.length > 0)

  // 计算布局
  const updateLayout = useCallback(() => {
    if (!containerRef.current) return
    const width = containerRef.current.clientWidth
    setContainerWidth(width)
    const rows = layoutMeasures(segments, width)
    setLayoutRows(rows)
  }, [segments])

  // 监听容器宽度变化
  useEffect(() => {
    updateLayout()

    const observer = new ResizeObserver(() => {
      updateLayout()
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [updateLayout])

  if (!hasNotes) {
    return (
      <div style={{ ...styles.jianpuEmptyTip, marginTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎼</div>
        <div>暂无简谱数据</div>
        <div style={{ fontSize: 13, color: '#bbb', marginTop: 8 }}>请在歌词模式下生成内容后，再切换到简谱模式</div>
      </div>
    )
  }

  // 构建渲染数据：按段落分组显示
  const renderContent = () => {
    const elements: React.ReactNode[] = []
    let currentSegmentId = ''

    for (let rowIndex = 0; rowIndex < layoutRows.length; rowIndex++) {
      const row = layoutRows[rowIndex]
      const isFirstOfSegment = row.segmentId !== currentSegmentId

      if (isFirstOfSegment) {
        currentSegmentId = row.segmentId
        elements.push(
          <SegmentLabel
            key={`label-${currentSegmentId}-${rowIndex}`}
            label={segmentLabels[currentSegmentId]}
            isFirst={rowIndex === 0}
          />
        )
      }

      elements.push(
        <MeasureRow
          key={`row-${rowIndex}`}
          row={row}
          segmentLabels={segmentLabels}
        />
      )
    }

    return elements
  }

  return (
    <div style={styles.jianpuContainer} ref={containerRef}>
      <header style={styles.jianpuHeader}>
        <h2 style={styles.jianpuTitle}>{title}</h2>
        <div style={styles.jianpuMeta}>
          <span>C 大调</span>
          <span>4/4 拍</span>
          <span>♩= 90</span>
        </div>
      </header>

      <div className={jianpuStyles.scoreBody}>
        {renderContent()}
      </div>
    </div>
  )
}

// AI 工具按钮样式工厂
const aiToolBtnStyle = (bgColor: string, color: string) => ({
  width: 26,
  height: 26,
  fontSize: 13,
  lineHeight: '24px',
  textAlign: 'center' as const,
  backgroundColor: bgColor,
  color,
  border: 'none',
  borderRadius: 5,
  cursor: 'pointer',
})

// 小工具按钮样式工厂
const smallBtnStyle = (color: string) => ({
  width: 20,
  height: 20,
  fontSize: 12,
  lineHeight: '18px',
  textAlign: 'center' as const,
  color,
  backgroundColor: '#f0f2ff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
})

// ===== 主组件 =====
export default function WorkspaceDemo() {
  // 项目列表状态
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string>('')

  // 当前项目（work）
  const [work, setWork] = useState<Project | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  // 消息类型：支持不同的事件类型作为独立消息块
  const [messages, setMessages] = useState<{ role: string, content: string, msgType?: string, lyricsContent?: string, timestamp: number, candidateMeta?: { targetId?: string, candidateType?: string, description?: string } }[]>([])
  const [input, setInput] = useState('')
  // AI生成的歌词候选，用于应用功能（使用ref避免闭包问题）
  const pendingLyricsRef = useRef<{ content: string, timestamp: number } | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewMode, setViewMode] = useState<'lyrics' | 'jianpu'>('lyrics')
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('')
  const [editingSegmentId, setEditingSegmentId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动撑开textarea高度的辅助函数
  const autoResizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  // 将歌词中的中文标点替换为换行符，用于卡片展示
  const formatLyricsForDisplay = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/[，。！？；、]/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim()
  }

  // 保存状态
  const [isSaving, setIsSaving] = useState(false)
  const workRef = useRef(work)
  const currentProjectIdRef = useRef(currentProjectId)
  const isInitializingRef = useRef(true)

  // 保持 ref 同步
  useEffect(() => {
    workRef.current = work
    currentProjectIdRef.current = currentProjectId
  }, [work, currentProjectId])

  // 防抖保存到后端
  const saveWorkToBackend = useMemo(
    () => debounce(async (projectData: Project) => {
      if (!projectData || !currentProjectIdRef.current) return
      setIsSaving(true)
      try {
        await fetch(`${API_URL}/api/v1/projects/${projectData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: projectData.title,
            lyrics: projectData.lyrics,
            jianpu: projectData.jianpu,
          }),
        })
      } catch (err) {
        console.error('保存失败:', err)
      } finally {
        setIsSaving(false)
      }
    }, 1000),
    []
  )

  // work 变化时触发保存（仅当 work 变化时）
  useEffect(() => {
    if (work) {
      saveWorkToBackend(work)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work])

  // 初始化：从后端加载项目列表
  useEffect(() => {
    const createDefaultProject = () => {
      const defaultProject: Project = {
        id: `default_${Date.now()}`,
        title: '我的歌曲',
        lyrics: [],
        jianpu: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setProjects([defaultProject])
      setCurrentProjectId(defaultProject.id)
      setWork(defaultProject)
      setMessages([{ role: 'assistant', content: '你好！告诉我你想写一首什么样的歌？', timestamp: Date.now() }])
      setIsInitializing(false)
      isInitializingRef.current = false
    }

    const loadProjects = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/projects`)
        const json = await res.json()
        if (json.code === 0 && json.data.length > 0) {
          const projectsData = json.data as Project[]
          setProjects(projectsData)
          setCurrentProjectId(projectsData[0].id)
          setWork(projectsData[0])
          setMessages([{ role: 'assistant', content: `已切换到「${projectsData[0].title}」，继续创作吧！`, timestamp: Date.now() }])
        } else {
          createDefaultProject()
        }
      } catch (err) {
        console.error('加载项目失败:', err)
        createDefaultProject()
      } finally {
        isInitializingRef.current = false
      }
    }

    // 设置超时，防止无限等待
    const timeout = setTimeout(() => {
      if (isInitializingRef.current) {
        createDefaultProject()
      }
    }, 5000)

    loadProjects()

    return () => clearTimeout(timeout)
  }, [])

  // 切换项目（本地切换，无需通知后端）
  const switchProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project || projectId === currentProjectId) return

    // 立即切换 UI
    setCurrentProjectId(projectId)
    setWork(project)
    setMessages([{ role: 'assistant', content: `已切换到「${project.title}」，继续创作吧！`, timestamp: Date.now() }])
  }

  // 新建项目
  const createNewProject = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '未命名歌曲' }),
      })
      const json = await res.json()
      if (json.code === 0) {
        const newProject = json.data as Project
        setProjects(prev => [...prev, newProject])
        setCurrentProjectId(newProject.id)
        setWork(newProject)
        setMessages([{ role: 'assistant', content: '新建项目成功！告诉我你想写一首什么样的歌？', timestamp: Date.now() }])
      }
    } catch (err) {
      console.error('新建项目失败:', err)
    }
  }

  // 删除项目
  const deleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (projects.length <= 1) {
      alert('至少保留一个项目')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.code === 0) {
        const newProjects = projects.filter(p => p.id !== projectId)
        setProjects(newProjects)

        if (currentProjectId === projectId) {
          const firstProject = newProjects[0]
          setCurrentProjectId(firstProject.id)
          setWork(firstProject)
        }
      }
    } catch (err) {
      console.error('删除项目失败:', err)
    }
  }

  // 插入新段落
  const insertSegment = (afterIndex: number) => {
    if (!work) return
    const newSegId = `seg_${Date.now()}`

    // 同时在 lyrics 和 jianpu 中插入
    const newLyricsSegment: LyricsSegment = {
      id: newSegId,
      type: 'verse',
      order: afterIndex + 1,
      label: `新段落 ${afterIndex + 2}`,
      text_content: '',
      status: 'draft',
    }
    const newJianpuSegment: JianpuSegment = {
      id: newSegId,
      type: 'verse',
      order: afterIndex + 1,
      label: `新段落 ${afterIndex + 2}`,
      measures: [],
      status: 'draft',
    }

    const newLyrics = [...work.lyrics]
    newLyrics.splice(afterIndex + 1, 0, newLyricsSegment)
    const reorderedLyrics = newLyrics.map((s, i) => ({ ...s, order: i }))

    const newJianpu = [...work.jianpu]
    newJianpu.splice(afterIndex + 1, 0, newJianpuSegment)
    const reorderedJianpu = newJianpu.map((s, i) => ({ ...s, order: i }))

    const updatedWork = { ...work, lyrics: reorderedLyrics, jianpu: reorderedJianpu }
    setWork(updatedWork)
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, lyrics: reorderedLyrics, jianpu: reorderedJianpu } : p))
  }

  // 删除段落
  const deleteSegment = (segId: string) => {
    if (!work) return
    if (work.lyrics.length <= 1) {
      alert('至少保留一个段落')
      return
    }
    const newLyrics = work.lyrics.filter(s => s.id !== segId).map((s, i) => ({ ...s, order: i }))
    const newJianpu = work.jianpu.filter(s => s.id !== segId).map((s, i) => ({ ...s, order: i }))
    const updatedWork = { ...work, lyrics: newLyrics, jianpu: newJianpu }
    setWork(updatedWork)
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, lyrics: newLyrics, jianpu: newJianpu } : p))
  }

  // 上移/下移段落
  const moveSegment = (idx: number, direction: 'up' | 'down') => {
    if (!work) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= work.lyrics.length) return

    // 同时移动 lyrics 和 jianpu
    const newLyrics = [...work.lyrics]
      ;[newLyrics[idx], newLyrics[newIdx]] = [newLyrics[newIdx], newLyrics[idx]]
    const reorderedLyrics = newLyrics.map((s, i) => ({ ...s, order: i }))

    const newJianpu = [...work.jianpu]
      ;[newJianpu[idx], newJianpu[newIdx]] = [newJianpu[newIdx], newJianpu[idx]]
    const reorderedJianpu = newJianpu.map((s, i) => ({ ...s, order: i }))

    setWork({ ...work, lyrics: reorderedLyrics, jianpu: reorderedJianpu })
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, lyrics: reorderedLyrics, jianpu: reorderedJianpu } : p))
  }

  // 模拟 AI 工具操作（后续对接真实后端）
  const handleAITool = (segId: string, toolType: string) => {
    if (!work) return

    const mockTextMap: Record<string, string> = {
      rewrite: '城市的霓虹灯在夜色中闪烁\n车流如织，人潮涌动\n我在这个路口等了太久\n却等不到你回头',
      extend: '城市的霓虹灯在夜色中闪烁\n车流如织，人潮涌动\n我在这个路口等了太久\n却等不到你回头\n\n风吹过街角带走了最后一句问候\n留下的只有沉默和无尽的心痛',
      polish: '城市霓虹，夜色阑珊\n车水马龙，人来人往\n伫立路口，久候成空\n君不回首，独留余憾',
      shorten: '霓虹闪烁夜未央\n车流不息人匆忙\n路口久等无归影\n此情终成旧时光',
      generate: '月光洒落在安静的窗台\n思念像风轻轻吹过来\n那些说过的话还在耳边徘徊\n你却早已走出了我的未来',
    }

    const currentSeg = work.lyrics.find(s => s.id === segId)
    const newContent = mockTextMap[toolType] || (currentSeg?.text_content || '')
    const newLyrics = work.lyrics.map(s =>
      s.id === segId ? { ...s, text_content: newContent } : s
    )
    const updatedWork = { ...work, lyrics: newLyrics }
    setWork(updatedWork)
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, lyrics: newLyrics } : p))
  }

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 将AI生成的歌词应用到工作区
  const applyLyricsToWorkspace = (lyricsContent: string, candidateMeta?: { targetId?: string, candidateType?: string, description?: string }) => {
    if (!work || !lyricsContent.trim()) return

    // 如果是 segment 类型（如 rewrite_segment_tool 的结果），更新到目标段落卡片
    if (candidateMeta?.candidateType === 'segment' && candidateMeta?.targetId) {
      const targetSeg = work.lyrics.find(s => s.id === candidateMeta.targetId)
      if (targetSeg) {
        // 将中文标点替换为换行，在一个卡片内分行显示
        const formatted = lyricsContent.trim().replace(/[，。！？；、]/g, '\n').replace(/\n{2,}/g, '\n')
        const newLyrics = work.lyrics.map(s =>
          s.id === candidateMeta.targetId ? { ...s, text_content: formatted } : s
        )
        const updatedWork = { ...work, lyrics: newLyrics }
        setWork(updatedWork)
        setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedWork : p))
        return
      }
      // 目标段落不存在时，降级为追加逻辑
    }

    // 如果是 lyrics 类型且内容包含 [label] 格式的段落（generate_lyrics_tool 结果）
    if (candidateMeta?.candidateType === 'lyrics') {
      const segmentPattern = /^\[(.+?)\]\s*(.+)$/gm
      const parsedSegments: { label: string, text: string }[] = []
      let match: RegExpExecArray | null
      while ((match = segmentPattern.exec(lyricsContent)) !== null) {
        parsedSegments.push({ label: match[1], text: match[2].trim() })
      }
      if (parsedSegments.length > 0) {
        // 根据标签映射类型
        const typeMap: Record<string, string> = { '副歌': 'chorus', '主歌': 'verse', '桥段': 'bridge', '前奏': 'intro', '尾奏': 'outro' }
        const newLyrics: LyricsSegment[] = parsedSegments.map((seg, idx) => ({
          id: `ai_seg_${Date.now()}_${idx}`,
          type: (typeMap[seg.label] || 'verse') as LyricsSegment['type'],
          order: idx,
          label: seg.label,
          text_content: seg.text.replace(/[，。！？；、]/g, '\n'),
          status: 'draft',
        }))
        const newJianpu: JianpuSegment[] = newLyrics.map(s => ({
          id: s.id,
          type: s.type,
          order: s.order,
          label: s.label,
          measures: [],
          status: 'draft',
        }))
        const updatedWork = { ...work, lyrics: newLyrics, jianpu: newJianpu }
        setWork(updatedWork)
        setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedWork : p))
        return
      }
      // 无 [label] 格式则降级为普通处理
    }

    // 解析歌词内容：先替换中英文逗号为换行，再识别段落结构
    const normalized = lyricsContent.trim().replace(/[,，]/g, '\n')
    const lines = normalized.split('\n').filter(l => l.trim())
    
    if (lines.length === 0) {
      alert('歌词内容为空')
      return
    }

    // 检查是否有多行歌词（有段落结构）
    if (lines.length > 1) {
      // 多个段落，提示用户选择
      const choice = window.confirm(
        `检测到 ${lines.length} 行歌词。\n\n` +
        `• 确定：替换全部段落\n• 取消：追加到末尾`
      )

      if (choice) {
        // 替换全部段落 - 为每行创建一个段落
        const newLyrics: LyricsSegment[] = lines.map((line, idx) => ({
          id: `ai_seg_${Date.now()}_${idx}`,
          type: idx === 0 ? 'chorus' : 'verse' as const,
          order: idx,
          label: idx === 0 ? '副歌' : `段落${idx + 1}`,
          text_content: line.trim(),
          status: 'draft' as const,
        }))
        const newJianpu: JianpuSegment[] = newLyrics.map(s => ({
          id: s.id,
          type: s.type,
          order: s.order,
          label: s.label,
          measures: [],
          status: 'draft' as const,
        }))
        const updatedWork = { ...work, lyrics: newLyrics, jianpu: newJianpu }
        setWork(updatedWork)
        setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedWork : p))
      } else {
        // 追加到末尾
        const lastSegId = work.lyrics[work.lyrics.length - 1]?.id || ''
        insertSegment(work.lyrics.length - 1)
        // 延迟更新内容
        setTimeout(() => {
          const newLyrics = work.lyrics.map((s, i) => 
            i === work.lyrics.length - 1 ? { ...s, text_content: lines.join('\n') } : s
          )
          const updatedWork = { ...work, lyrics: newLyrics }
          setWork(updatedWork)
          setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedWork : p))
        }, 100)
      }
    } else {
      // 单行歌词，追加或替换当前选中段落
      if (selectedSegmentId) {
        // 替换当前选中段落
        const newLyrics = work.lyrics.map(s =>
          s.id === selectedSegmentId ? { ...s, text_content: lyricsContent.trim() } : s
        )
        const updatedWork = { ...work, lyrics: newLyrics }
        setWork(updatedWork)
        setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedWork : p))
      } else {
        // 追加新段落
        insertSegment(work.lyrics.length - 1)
        setTimeout(() => {
          const newLyrics = [...work.lyrics, {
            id: `ai_seg_${Date.now()}`,
            type: 'verse' as const,
            order: work.lyrics.length,
            label: `段落${work.lyrics.length + 1}`,
            text_content: lyricsContent.trim(),
            status: 'draft' as const,
          }]
          const newJianpu = [...work.jianpu, {
            id: `ai_seg_${Date.now()}`,
            type: 'verse' as const,
            order: work.lyrics.length,
            label: `段落${work.lyrics.length + 1}`,
            measures: [],
            status: 'draft' as const,
          }]
          const updatedWork = { ...work, lyrics: newLyrics, jianpu: newJianpu }
          setWork(updatedWork)
          setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedWork : p))
        }, 100)
      }
    }

    // 清空待应用歌词
    pendingLyricsRef.current = null
    
    // 添加系统消息提示
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: '✅ 歌词已应用到工作区！',
      msgType: 'system',
      timestamp: Date.now(),
    }])
  }

  // 清空消息上下文
  const clearMessages = async () => {
    try {
      await fetch(`${API_URL}/api/v1/projects/${currentProjectId}/chat`, { method: 'DELETE' })
      setMessages([{ role: 'assistant', content: '消息已清空，开始新的对话吧！', timestamp: Date.now() }])
    } catch (err) {
      console.error('清空失败:', err)
    }
  }

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !work) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }])
    setIsStreaming(true)
    pendingLyricsRef.current = null
    // 创建空的助手消息占位符
    setMessages(prev => [...prev, { role: 'assistant', content: '', msgType: 'text_chunk', lyricsContent: '', timestamp: Date.now() }])

    try {
      const response = await fetch(`${API_URL}/api/v1/projects/${currentProjectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''
        let currentEvent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7)
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6)
              if (dataStr && dataStr !== '{}') {
                try {
                  const data = JSON.parse(dataStr)

                  if (currentEvent === 'thought') {
                    // ReAct: 思考过程 - 创建独立消息块
                    const thought = data.content || ''
                    if (thought) {
                      setMessages(prev => [...prev, { role: 'assistant', content: `💭 ${thought}`, msgType: 'thought', timestamp: Date.now() }])
                    }
                  } else if (currentEvent === 'action') {
                    // ReAct: 执行行动 - 创建独立消息块
                    const tool = data.tool || ''
                    setMessages(prev => [...prev, { role: 'assistant', content: `🔧 调用工具: ${tool}`, msgType: 'action', timestamp: Date.now() }])
                  } else if (currentEvent === 'observation') {
                    // ReAct: 观察结果（含评估）- 创建独立消息块
                    const result = data.result || {}
                    const evaluation = data.evaluation
                    const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                    
                    // 从observation中提取歌词内容
                    let extractedLyrics = ''
                    if (result && typeof result === 'object') {
                      const contentObj = result.content
                      // 格式1: { content: "纯字符串歌词" }
                      if (typeof contentObj === 'string' && contentObj.trim()) {
                        extractedLyrics = contentObj
                      }
                      // 格式2: { content: { text: "歌词" } }  — segment 重写
                      else if (contentObj && typeof contentObj === 'object' && contentObj.text && typeof contentObj.text === 'string') {
                        extractedLyrics = contentObj.text
                      }
                      // 格式3: { content: { segments: [{ text, label, id }] } }  — 完整生成（如 generate_lyrics_tool）
                      else if (contentObj && typeof contentObj === 'object' && Array.isArray(contentObj.segments)) {
                        extractedLyrics = contentObj.segments
                          .map((seg: any) => `[${seg.label || seg.id}] ${seg.text}`)
                          .join('\n\n')
                      }
                      // 格式4: { lyrics: "歌词" }
                      if (!extractedLyrics && result.lyrics && typeof result.lyrics === 'string' && result.lyrics.trim()) {
                        extractedLyrics = result.lyrics
                      }
                      // 格式5: { text: "歌词" }
                      if (!extractedLyrics && result.text && typeof result.text === 'string' && result.text.trim()) {
                        extractedLyrics = result.text
                      }
                      // 格式6: { candidate: { text_content: "..." } }
                      if (!extractedLyrics && result.candidate && result.candidate.text_content) {
                        extractedLyrics = result.candidate.text_content
                      }
                    }
                    
                    // 如果提取到了歌词，更新pendingLyrics
                    if (extractedLyrics.trim()) {
                      pendingLyricsRef.current = {
                        content: extractedLyrics,
                        timestamp: Date.now(),
                      }
                    }
                    
                    let evalStr = ''
                    if (evaluation && evaluation.quality && evaluation.quality !== 'n/a') {
                      const qualityEmoji = evaluation.quality === 'good' ? '✨' : evaluation.quality === 'acceptable' ? '👍' : '⚠️'
                      evalStr = ` ${qualityEmoji}[${evaluation.quality}]`
                      if (evaluation.reason) {
                        evalStr += ` ${evaluation.reason}`
                      }
                    }
                    const description = result.description || ''
                    const displayLyrics = extractedLyrics ? formatLyricsForDisplay(extractedLyrics) : ''
                    // 提取候选元信息：目标段落ID和类型
                    const contentObj = result.content
                    const targetId = (contentObj && typeof contentObj === 'object' && contentObj.id) ? contentObj.id : undefined
                    const candidateType = result.type || undefined
                    setMessages(prev => [...prev, { 
                      role: 'assistant', 
                      content: displayLyrics || `✅ 结果: ${resultStr}${evalStr}`, 
                      msgType: 'observation', 
                      lyricsContent: extractedLyrics, 
                      timestamp: Date.now(),
                      candidateMeta: { targetId, candidateType, description },
                    }])
                  } else if (currentEvent === 'clarify') {
                    // 需要用户澄清 - 创建独立消息块
                    const question = data.question || '请提供更多信息'
                    setMessages(prev => [...prev, { role: 'assistant', content: `❓ ${question}`, msgType: 'clarify', timestamp: Date.now() }])
                  } else if (currentEvent === 'text_chunk') {
                    // 文本流式输出 - 追加到最后一个消息块
                    const chunk = data.chunk || ''
                    const currentTimestamp = Date.now()
                    
                    setMessages(prev => {
                      const newMsgs = [...prev]
                      const lastMsg = newMsgs[newMsgs.length - 1]
                      if (lastMsg && lastMsg.role === 'assistant') {
                        // 更新最后一个消息块
                        newMsgs[newMsgs.length - 1] = {
                          ...lastMsg,
                          content: lastMsg.content + chunk,
                          lyricsContent: (lastMsg.lyricsContent || '') + chunk,
                          timestamp: currentTimestamp,
                        }
                      } else {
                        // 创建新消息块
                        newMsgs.push({ 
                          role: 'assistant', 
                          content: chunk, 
                          msgType: 'text_chunk', 
                          lyricsContent: chunk, 
                          timestamp: currentTimestamp 
                        })
                      }
                      return newMsgs
                    })
                    
                    // 追踪最新的歌词内容
                    pendingLyricsRef.current = {
                      content: (pendingLyricsRef.current?.content || '') + chunk,
                      timestamp: currentTimestamp,
                    }
                  } else if (currentEvent === 'work_update') {
                    // 作品更新
                    setWork(data.work || data)
                    setProjects(prev => prev.map(p =>
                      p.id === currentProjectId ? { ...p, ...(data.work || data) } : p
                    ))
                  } else if (currentEvent === 'candidate_update') {
                    // 候选内容更新
                    console.log('候选内容:', data.candidate)
                  } else if (currentEvent === 'tool_start') {
                    // 工具开始
                    console.log('工具开始:', data.tool_name)
                  } else if (currentEvent === 'tool_end') {
                    // 工具结束
                    console.log('工具结束:', data.tool_name)
                  } else if (currentEvent === 'error') {
                    // 错误 - 创建独立消息块
                    setMessages(prev => [...prev, { role: 'assistant', content: `❌ 错误: ${data.message || '未知错误'}`, msgType: 'error', timestamp: Date.now() }])
                  }
                } catch {
                  // 非 JSON 数据，创建独立消息块
                  if (dataStr.trim()) {
                    setMessages(prev => [...prev, { role: 'assistant', content: dataStr, msgType: 'raw', timestamp: Date.now() }])
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('请求失败:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误。', timestamp: Date.now() }])
    } finally {
      setIsStreaming(false)
    }
  }

  if (!work) {
    return <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      加载中...
    </div>
  }

  return (
    <div style={styles.container}>
      {/* 最左侧：项目列表栏 */}
      <div style={styles.projectSidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>我的作品</span>
          <span style={{ fontSize: 12, color: '#667eea' }}>{projects.length}</span>
        </div>

        <div style={styles.projectList}>
          {projects.map(project => (
            <div
              key={project.id}
              style={{
                ...styles.projectItem,
                ...(project.id === currentProjectId ? styles.projectItemActive : styles.projectItemInactive),
              }}
              onClick={() => switchProject(project.id)}
              onMouseEnter={(e) => {
                if (project.id !== currentProjectId) {
                  e.currentTarget.style.backgroundColor = '#2d2d44'
                }
              }}
              onMouseLeave={(e) => {
                if (project.id !== currentProjectId) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span style={styles.projectIcon}>🎵</span>
              <span style={styles.projectTitle}>{project.title}</span>
              {projects.length > 1 && (
                <button
                  style={styles.deleteBtn}
                  onClick={(e) => deleteProject(project.id, e)}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button style={styles.newProjectBtn} onClick={createNewProject}>
          <span>+</span>
          <span>新建项目</span>
        </button>
      </div>

      {/* 中间：歌词/简谱画布 */}
      <div style={styles.leftPanel}>
        {/* 固定头部：标题 + 视图切换 */}
        <div style={styles.leftPanelHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: '#333', flex: 1 }}>{work.title}</h2>
            <button
              style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff' }}
              onClick={() => {
                const newTitle = prompt('修改标题', work.title)
                if (newTitle) {
                  setWork({ ...work, title: newTitle })
                  setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, title: newTitle } : p))
                }
              }}
            >
              编辑标题
            </button>
          </div>

          {/* 视图切换按钮 */}
          <div style={styles.viewToggle}>
            <button
              style={{
                ...styles.viewToggleBtn,
                ...(viewMode === 'lyrics' ? styles.viewToggleBtnActive : {}),
              }}
              onClick={() => setViewMode('lyrics')}
            >
              📝 歌词模式
            </button>
            <button
              style={{
                ...styles.viewToggleBtn,
                ...(viewMode === 'jianpu' ? styles.viewToggleBtnActive : {}),
              }}
              onClick={() => setViewMode('jianpu')}
            >
              🎼 简谱模式
            </button>
          </div>
        </div>

        {/* 滚动内容区：歌词或简谱 */}
        <div style={styles.leftPanelContent}>

          {/* ====== 歌词视图 ====== */}
          {viewMode === 'lyrics' && (
            <>
              {work.lyrics.map((segment, idx) => (
                <div
                  key={segment.id}
                  style={{
                    ...styles.segmentCard,
                    ...(selectedSegmentId === segment.id ? styles.segmentCardSelected : {}),
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    gap: 12,
                  }}
                  onClick={() => setSelectedSegmentId(selectedSegmentId === segment.id ? '' : segment.id)}
                >
                  {/* 左侧：类型 + 歌词 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.segmentType}>
                      <select
                        value={segment.type}
                        onChange={(e) => {
                          e.stopPropagation()
                          const newLyrics = work.lyrics.map(s =>
                            s.id === segment.id ? { ...s, type: e.target.value as LyricsSegment['type'], label: e.target.options[e.target.selectedIndex].text } : s
                          )
                          setWork({ ...work, lyrics: newLyrics })
                          setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, lyrics: newLyrics } : p))
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#667eea',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="verse">主歌</option>
                        <option value="chorus">副歌</option>
                        <option value="bridge">桥段</option>
                        <option value="intro">前奏</option>
                        <option value="outro">尾奏</option>
                      </select>
                    </div>
                    <div
                      style={{ ...styles.segmentContent }}
                      onClick={(e) => { e.stopPropagation(); setSelectedSegmentId(segment.id); setEditingSegmentId(segment.id) }}
                    >
                      {editingSegmentId === segment.id ? (
                        <textarea
                          ref={(el) => { if (el) autoResizeTextarea(el) }}
                          value={segment.text_content}
                          onChange={(e) => {
                            const newLyrics = work.lyrics.map(s =>
                              s.id === segment.id ? { ...s, text_content: e.target.value } : s
                            )
                            setWork({ ...work, lyrics: newLyrics })
                            setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, lyrics: newLyrics } : p))
                            autoResizeTextarea(e.target)
                          }}
                          onBlur={() => setEditingSegmentId('')}
                          autoFocus
                          style={{
                            width: '100%',
                            fontSize: 16,
                            lineHeight: 1.8,
                            fontFamily: 'inherit',
                            color: '#333',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            resize: 'none' as const,
                            overflow: 'hidden' as const,
                            padding: 0,
                            margin: 0,
                            display: 'block',
                          }}
                        />
                      ) : (
                        <span style={{ whiteSpace: 'pre-wrap' }}>
                          {segment.text_content || <span style={{ color: '#999', cursor: 'text' }}>点击编辑歌词...</span>}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 右侧：工具栏 */}
                  {selectedSegmentId === segment.id && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => moveSegment(idx, 'up')} title="上移" style={smallBtnStyle('#475ec4')}>↑</button>
                        <button onClick={() => moveSegment(idx, 'down')} title="下移" style={smallBtnStyle('#475ec4')}>↓</button>
                      </div>
                      <button onClick={() => handleAITool(segment.id, 'generate')} title="生成" style={{ ...aiToolBtnStyle('#d1fae5', '#059669'), width: 42, fontSize: 12 }}>生成</button>
                      <button onClick={() => handleAITool(segment.id, 'rewrite')} title="改写" style={{ ...aiToolBtnStyle('#e8e0ff', '#7c3aed'), width: 42, fontSize: 12 }}>改写</button>
                      <button onClick={() => handleAITool(segment.id, 'extend')} title="续写" style={{ ...aiToolBtnStyle('#e0f2fe', '#0284c7'), width: 42, fontSize: 12 }}>续写</button>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => deleteSegment(segment.id)} title="删除此段落" style={smallBtnStyle('#ff6b6b')}>×</button>
                        <button onClick={() => insertSegment(idx)} title="在下方插入段落" style={smallBtnStyle('#475ec4')}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => insertSegment(work.lyrics.length - 1)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 14,
                    color: '#667eea',
                    backgroundColor: '#f5f5ff',
                    border: '2px dashed #d0d5ff',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#eef0ff'
                    e.currentTarget.style.borderColor = '#667eea'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5ff'
                    e.currentTarget.style.borderColor = '#d0d5ff'
                  }}
                >
                  <span style={{ fontSize: 18 }}>+</span>
                  <span>添加段落</span>
                </button>
              </div>

              <div style={{ marginTop: 20, padding: 12, backgroundColor: '#e3f2fd', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#1976d2', fontWeight: 600 }}>💡 试试这些操作：</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  • "写一首关于加班的歌"<br />
                  • "把副歌改得伤感一点"<br />
                  • "续写一段桥段"
                </div>
              </div>
            </>
          )}

          {/* ====== 简谱视图 ====== */}
          {viewMode === 'jianpu' && (
            <JianpuView segments={work.jianpu} title={work.title} />
          )}
        </div>
      </div>

      {/* 右侧：AI 对话 */}
      <div style={styles.rightPanel}>
        <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🤖 AI 作词助手</span>
          <button
            onClick={clearMessages}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              border: '1px solid #ddd',
              borderRadius: 4,
              background: '#fff',
              cursor: 'pointer',
              color: '#666',
            }}
            title="清空对话历史"
          >
            清空上下文
          </button>
        </div>

        <div style={styles.chatMessages}>
          {messages.map((msg, idx) => {
            // 根据消息类型确定样式
            let msgStyle: React.CSSProperties = { ...styles.message }

            if (msg.role === 'user') {
              // 用户消息
              msgStyle = {
                ...msgStyle,
                backgroundColor: '#667eea',
                color: '#fff',
                marginLeft: 'auto',
              }
            } else {
              // AI 消息 - 根据类型区分样式
              switch (msg.msgType) {
                case 'thought':
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#e3f2fd',
                    color: '#1565c0',
                    borderLeft: '3px solid #1976d2',
                    fontSize: 13,
                  }
                  break
                case 'action':
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#fff3e0',
                    color: '#e65100',
                    borderLeft: '3px solid #ff9800',
                    fontSize: 13,
                  }
                  break
                case 'observation':
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#e8f5e9',
                    color: '#2e7d32',
                    borderLeft: '3px solid #4caf50',
                    fontSize: 13,
                  }
                  break
                case 'clarify':
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#fff8e1',
                    color: '#f57f17',
                    borderLeft: '3px solid #ffc107',
                    fontSize: 13,
                  }
                  break
                case 'error':
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    borderLeft: '3px solid #f44336',
                    fontSize: 13,
                  }
                  break
                case 'text_chunk':
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#f8f9ff',
                    color: '#333',
                    fontSize: 14,
                    border: '1px solid #e0e0ff',
                  }
                  break
                case 'system':
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#e8f5e9',
                    color: '#2e7d32',
                    fontSize: 13,
                    textAlign: 'center' as const,
                  }
                  break
                case 'apply_prompt':
                  msgStyle = {
                    ...msgStyle,
                    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%)',
                    color: '#4a5568',
                    fontSize: 14,
                    border: '1px solid #c7d2fe',
                    textAlign: 'center' as const,
                  }
                  break
                default:
                  msgStyle = {
                    ...msgStyle,
                    backgroundColor: '#f0f0f0',
                    color: '#333',
                  }
              }
            }

            // 判断是否为可应用的歌词提示块
            const canApply = (msg.msgType === 'apply_prompt' || msg.msgType === 'observation') && msg.lyricsContent && msg.lyricsContent.trim().length > 0

            return (
              <div
                key={idx}
                style={styles.messageWrapper}
              >
                <div style={msgStyle}>
                  {msg.msgType === 'observation' && canApply ? (
                    <div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 2 }}>
                        {msg.content}
                      </pre>
                      <button
                        onClick={() => applyLyricsToWorkspace(msg.lyricsContent!, msg.candidateMeta)}
                        style={{
                          marginTop: 12,
                          padding: '8px 20px',
                          fontSize: 13,
                          backgroundColor: '#667eea',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          width: '100%',
                          justifyContent: 'center',
                        }}
                      >
                        <span>✨</span>
                        <span>应用到工作区</span>
                      </button>
                    </div>
                  ) : (
                    msg.content || '...'
                  )}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <div style={styles.inputArea}>
          <input
            style={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="输入你的想法..."
            disabled={isStreaming}
          />
          <button
            style={{ ...styles.sendBtn, opacity: isStreaming ? 0.6 : 1 }}
            onClick={sendMessage}
            disabled={isStreaming}
          >
            {isStreaming ? '生成中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
