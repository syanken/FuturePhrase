import { Project } from './types'

export const mockProjects: Project[] = [
  {
    id: 'proj_001',
    title: '加班的歌',
    lyrics: [
      {
        id: 'seg_verse_1', type: 'verse', order: 0, label: '主歌 A',
        text_content: '凌晨两点的办公室\n只有屏幕还在亮\n咖啡又喝了一杯\n明天还得继续忙',
        status: 'draft',
      },
      {
        id: 'seg_chorus_1', type: 'chorus', order: 1, label: '副歌',
        text_content: '加班加到天亮\n梦想还在路上\n这一路跌跌撞撞\n只为心中的光',
        status: 'draft',
      },
    ],
    jianpu: [
      {
        id: 'seg_verse_1', type: 'verse', order: 0, label: '主歌 A',
        status: 'draft',
        measures: [
          { id: 1, notes: [
            { pitch: '3', octave: 0, duration: 1, lyric: '凌' },
            { pitch: '5', octave: 0, duration: 1, lyric: '晨' },
            { pitch: '6', octave: 0, duration: 1, lyric: '两' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
          ]},
          { id: 2, notes: [
            { pitch: '1', octave: 1, duration: 2, lyric: '点' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
            { pitch: '7', octave: 0, duration: 1, lyric: '的' },
          ]},
          { id: 3, notes: [
            { pitch: '6', octave: 0, duration: 1, lyric: '公' },
            { pitch: '5', octave: 0, duration: 1, lyric: '室' },
            { pitch: '3', octave: 0, duration: 1, lyric: '只' },
            { pitch: '5', octave: 0, duration: 1, lyric: '有' },
          ]},
          { id: 4, notes: [
            { pitch: '6', octave: 0, duration: 1, lyric: '屏' },
            { pitch: '1', octave: 1, duration: 2, lyric: '幕' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
          ]},
          { id: 5, notes: [
            { pitch: '7', octave: 0, duration: 1, lyric: '还' },
            { pitch: '6', octave: 0, duration: 1, lyric: '在' },
            { pitch: '5', octave: 0, duration: 1, lyric: '亮' },
            { pitch: '5', octave: 0, duration: 1, lyric: '咖' },
          ]},
          { id: 6, notes: [
            { pitch: '3', octave: 0, duration: 1, lyric: '啡' },
            { pitch: '5', octave: 0, duration: 1, lyric: '又' },
            { pitch: '3', octave: 0, duration: 1, lyric: '喝' },
            { pitch: '5', octave: 0, duration: 1, lyric: '了' },
          ]},
          { id: 7, notes: [
            { pitch: '1', octave: 1, duration: 2, lyric: '一' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
            { pitch: '5', octave: 0, duration: 1, lyric: '杯' },
          ]},
          { id: 8, notes: [
            { pitch: '6', octave: 0, duration: 1, lyric: '明' },
            { pitch: '1', octave: 1, duration: 1, lyric: '天' },
            { pitch: '7', octave: 0, duration: 1, lyric: '还' },
            { pitch: '6', octave: 0, duration: 1, lyric: '得' },
          ]},
          { id: 9, notes: [
            { pitch: '5', octave: 0, duration: 1, lyric: '继' },
            { pitch: '3', octave: 0, duration: 1, lyric: '续' },
            { pitch: '5', octave: 0, duration: 1, lyric: '忙' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
          ]},
        ],
      },
      {
        id: 'seg_chorus_1', type: 'chorus', order: 1, label: '副歌',
        status: 'draft',
        measures: [
          { id: 1, notes: [
            { pitch: '1', octave: 1, duration: 1, lyric: '加' },
            { pitch: '1', octave: 1, duration: 1, lyric: '班' },
            { pitch: '3', octave: 1, duration: 1, lyric: '加' },
            { pitch: '2', octave: 1, duration: 1, lyric: '到' },
          ]},
          { id: 2, notes: [
            { pitch: '1', octave: 1, duration: 2, lyric: '天' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
            { pitch: '7', octave: 0, duration: 1, lyric: '亮' },
          ]},
          { id: 3, notes: [
            { pitch: '6', octave: 0, duration: 1, lyric: '梦' },
            { pitch: '1', octave: 1, duration: 1, lyric: '想' },
            { pitch: '7', octave: 0, duration: 1, lyric: '还' },
            { pitch: '6', octave: 0, duration: 1, lyric: '在' },
          ]},
          { id: 4, notes: [
            { pitch: '5', octave: 0, duration: 2, lyric: '路' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
            { pitch: '3', octave: 0, duration: 1, lyric: '上' },
          ]},
          { id: 5, notes: [
            { pitch: '5', octave: -1, duration: 0.25, lyric: '这' },
            { pitch: '5', octave: 0, duration: 0.25, lyric: '这' },
            { pitch: '3', octave: 0, duration: 0.5, lyric: '一' },
            { pitch: '5', octave: 0, duration: 1, lyric: '路' },
            { pitch: '6', octave: 0, duration: 0.5, lyric: '跌' },
            { pitch: '5', octave: 0, duration: 0.5, lyric: '跌' },
            { pitch: '3', octave: 0, duration: 1, lyric: '撞' },
            { pitch: '2', octave: 0, duration: 1, lyric: '撞' },
          ]},
          { id: 6, notes: [
            { pitch: '1', octave: 1, duration: 1, lyric: '只' },
            { pitch: '7', octave: 0, duration: 1, lyric: '为' },
            { pitch: '6', octave: 0, duration: 1, lyric: '心' },
            { pitch: '5', octave: 0, duration: 1, lyric: '中' },
          ]},
          { id: 7, notes: [
            { pitch: '3', octave: 0, duration: 2, lyric: '的' },
            { pitch: '0', octave: 0, duration: 1, lyric: '' },
            { pitch: '1', octave: 1, duration: 1, lyric: '光' },
          ]},
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proj_002',
    title: '未命名歌曲',
    lyrics: [
      { id: 'seg_verse_1', type: 'verse', order: 0, label: '主歌 A', text_content: '', status: 'draft' },
    ],
    jianpu: [
      { id: 'seg_verse_1', type: 'verse', order: 0, label: '主歌 A', measures: [], status: 'draft' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
