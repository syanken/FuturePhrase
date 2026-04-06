"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import jianpuStyles from './master/page.module.css'
import { mockProjects } from './mockData'
import { styles } from './styles'
import type { JianpuSegment, LyricsSegment, MeasureData, Note, Project } from './types'

const API_URL = 'http://192.168.1.21:6789'

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

// ===== 主组件 =====
export default function WorkspaceDemo() {
  // 项目列表状态
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string>('')

  // 当前项目（work）
  const [work, setWork] = useState<Project | null>(null)
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([])
  const [input, setInput] = useState('')
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

  // 初始化：加载项目列表
  useEffect(() => {
    setProjects(mockProjects)
    setCurrentProjectId('proj_001')
    setWork(mockProjects[0])
    setMessages([{ role: 'assistant', content: '你好！选择一个项目开始创作，或新建项目。' }])
  }, [])

  // 切换项目
  const switchProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setCurrentProjectId(projectId)
      setWork(project)
      setMessages([{ role: 'assistant', content: `已切换到「${project.title}」，继续创作吧！` }])
    }
  }

  // 新建项目
  const createNewProject = () => {
    const newId = `proj_${Date.now()}`
    const newProject: Project = {
      id: newId,
      title: '未命名歌曲',
      lyrics: [
        { id: 'seg_verse_1', type: 'verse', order: 0, label: '主歌 A', text_content: '', status: 'draft' },
        { id: 'seg_chorus_1', type: 'chorus', order: 1, label: '副歌', text_content: '', status: 'draft' },
        { id: 'seg_verse_2', type: 'verse', order: 2, label: '主歌 A2', text_content: '', status: 'draft' },
      ],
      jianpu: [
        { id: 'seg_verse_1', type: 'verse', order: 0, label: '主歌 A', measures: [], status: 'draft' },
        { id: 'seg_chorus_1', type: 'chorus', order: 1, label: '副歌', measures: [], status: 'draft' },
        { id: 'seg_verse_2', type: 'verse', order: 2, label: '主歌 A2', measures: [], status: 'draft' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setProjects(prev => [...prev, newProject])
    setCurrentProjectId(newId)
    setWork(newProject)
    setMessages([{ role: 'assistant', content: '新建项目成功！告诉我你想写一首什么样的歌？' }])
  }

  // 删除项目
  const deleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (projects.length <= 1) {
      alert('至少保留一个项目')
      return
    }

    const newProjects = projects.filter(p => p.id !== projectId)
    setProjects(newProjects)

    if (currentProjectId === projectId) {
      const firstProject = newProjects[0]
      setCurrentProjectId(firstProject.id)
      setWork(firstProject)
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

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !work) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const response = await fetch(`${API_URL}/api/v1/work/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data && data !== '{}') {
                setMessages(prev => {
                  const newMsgs = [...prev]
                  const last = newMsgs[newMsgs.length - 1]
                  if (last && last.role === 'assistant') {
                    newMsgs[newMsgs.length - 1] = {
                      ...last,
                      content: last.content + data
                    }
                  }
                  return newMsgs
                })
              }
            } else if (line.startsWith('event: work_update')) {
              const dataLineIdx = lines.indexOf(line) + 1
              if (dataLineIdx < lines.length) {
                const dataLine = lines[dataLineIdx]
                if (dataLine.startsWith('data: ')) {
                  const workData = JSON.parse(dataLine.slice(6))
                  setWork(workData)
                  // 同步更新项目列表中的数据
                  setProjects(prev => prev.map(p =>
                    p.id === currentProjectId ? { ...p, ...workData } : p
                  ))
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('请求失败:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误。' }])
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
                        <button
                          onClick={() => moveSegment(idx, 'up')}
                          title="上移"
                          style={{
                            width: 20,
                            height: 20,
                            fontSize: 12,
                            lineHeight: '18px',
                            textAlign: 'center' as const,
                            color: '#667eea',
                            backgroundColor: '#f0f2ff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >↑</button>
                        <button
                          onClick={() => moveSegment(idx, 'down')}
                          title="下移"
                          style={{
                            width: 20,
                            height: 20,
                            fontSize: 12,
                            lineHeight: '18px',
                            textAlign: 'center' as const,
                            color: '#667eea',
                            backgroundColor: '#f0f2ff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >↓</button>
                      </div>
                      <button
                        onClick={() => handleAITool(segment.id, 'generate')}
                        title="生成"
                        style={{ ...aiToolBtnStyle('#d1fae5', '#059669'), width: 42, fontSize: 12 }}
                      >生成</button>
                      <button
                        onClick={() => handleAITool(segment.id, 'rewrite')}
                        title="改写"
                        style={{ ...aiToolBtnStyle('#e8e0ff', '#7c3aed'), width: 42, fontSize: 12 }}
                      >改写</button>
                      <button
                        onClick={() => handleAITool(segment.id, 'extend')}
                        title="续写"
                        style={{ ...aiToolBtnStyle('#e0f2fe', '#0284c7'), width: 42, fontSize: 12 }}
                      >续写</button>

                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          onClick={() => deleteSegment(segment.id)}
                          title="删除此段落"
                          style={{
                            width: 20,
                            height: 20,
                            fontSize: 13,
                            lineHeight: '20px',
                            textAlign: 'center' as const,
                            color: '#ff6b6b',
                            backgroundColor: '#f0f2ff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >×</button>
                        <button
                          onClick={() => insertSegment(idx)}
                          title="在下方插入段落"
                          style={{
                            width: 20,
                            height: 20,
                            fontSize: 14,
                            lineHeight: '18px',
                            textAlign: 'center' as const,
                            color: '#667eea',
                            backgroundColor: '#f0f2ff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >+</button>
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
        <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>
          🤖 AI 作词助手
        </div>

        <div style={styles.chatMessages}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                ...styles.message,
                backgroundColor: msg.role === 'user' ? '#667eea' : '#f0f0f0',
                color: msg.role === 'user' ? '#fff' : '#333',
                marginLeft: msg.role === 'user' ? 'auto' : 0,
              }}
            >
              {msg.content || '...'}
            </div>
          ))}
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
