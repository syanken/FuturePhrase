export interface Note {
  pitch: string
  octave: number
  duration: number
  lyric: string
}

export interface MeasureData {
  id: number
  notes: Note[]
}

// 歌词段落
export interface LyricsSegment {
  id: string
  type: string      // verse, chorus, bridge, etc.
  order: number
  label: string     // 主歌 A, 副歌, etc.
  text_content: string
  status: string    // draft, done
}

// 简谱段落
export interface JianpuSegment {
  id: string
  type: string      // verse, chorus, bridge, etc.
  order: number
  label: string     // 主歌 A, 副歌, etc.
  measures: MeasureData[]
  status: string    // draft, done
}

export interface Project {
  id: string
  title: string
  lyrics: LyricsSegment[]    // 歌词数据
  jianpu: JianpuSegment[]    // 简谱数据
  createdAt: string
  updatedAt: string
}
