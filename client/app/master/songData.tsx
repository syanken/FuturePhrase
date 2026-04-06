
export interface NoteData {
  pitch: string;       // 音高 "1", "2", ..., "7", "0" (休止符)
  octave: number;      // 八度: 1 (高), 0 (中), -1 (低)
  duration: number;    // 时值: 0.25, 0.5, 1, 2, 4...
  lyric: string;       // 歌词
}

export interface MeasureData {
  id: number;
  notes: NoteData[];
}

export interface SongData {
  title: string;
  artist: string;
  key: string;
  beat: string;
  measures: MeasureData[];
}


export const SONG_DATA: SongData = {
  title: "时值测试曲",
  artist: "系统生成",
  key: "1=C",
  beat: "4/4",
  measures: [
    {
      id: 1,
      notes: [
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
      ]
    },
    {
      id: 2,
      notes: [
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
      ]
    },
    {
      id: 3,
      notes: [
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
      ]
    },
    {
      id: 4,
      notes: [
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 0.5, lyric: "" },
        { pitch: "5", octave: -1, duration: 0.5, lyric: "" },
      ]
    },
    {
      id: 5,
      notes: [
        { pitch: "5", octave: -1, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 0.5, lyric: "" },
        { pitch: "3", octave: 0, duration: 0.5, lyric: "" },
        { pitch: "4", octave: 0, duration: 0.5, lyric: "" },
        { pitch: "3", octave: 0, duration: 0.5, lyric: "" },
        { pitch: "2", octave: 0, duration: 0.5, lyric: "" },
        { pitch: "7", octave: -1, duration: 0.5, lyric: "" },
      ]
    },
    {
      id: 6,
      notes: [
        { pitch: "1", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 1, lyric: "" },
        { pitch: "0", octave: 0, duration: 0.5, lyric: "" },
        { pitch: "6", octave: -1, duration: 0.5, lyric: "" },
      ]
    },
    {
      id: 7,
      notes: [
        { pitch: "1", octave: 1, duration: 0.25, lyric: "三" },
        { pitch: "2", octave: 1, duration: 0.25, lyric: "十" },
        { pitch: "3", octave: -1, duration: 0.5, lyric: "二" },
        { pitch: "5", octave: -1, duration: 0.25, lyric: "音" },
        { pitch: "6", octave: 0, duration: 0.25, lyric: "符" },
        { pitch: "5", octave: 0, duration: 0.25, lyric: "" },
        { pitch: "4", octave: 0, duration: 0.25, lyric: "" },
        { pitch: "1", octave: 0, duration: 0.25, lyric: "" },
        { pitch: "2", octave: 0, duration: 0.25, lyric: "十" },
        { pitch: "3", octave: 0, duration: 0.25, lyric: "二" },
        { pitch: "3", octave: 0, duration: 0.125, lyric: "二" },
        { pitch: "4", octave: -1, duration: 0.125, lyric: "分" },
        { pitch: "5", octave: 0, duration: 0.5, lyric: "音" },
        { pitch: "6", octave: 0, duration: 0.5, lyric: "符" },
      ]
    },
    {
      id: 8,
      notes: [
        { pitch: "1", octave: 0, duration: 0.5, lyric: "八" },
        { pitch: "1", octave: 0, duration: 0.5, lyric: "分" },
        { pitch: "1", octave: 0, duration: 0.5, lyric: "八" },
        { pitch: "1", octave: 0, duration: 0.5, lyric: "分" },
        { pitch: "1", octave: 0, duration: 1, lyric: "四" },
        { pitch: "1", octave: 0, duration: 1, lyric: "分" },
      ]
    },
    {
      id: 9,
      notes: [
        { pitch: "6", octave: 0, duration: 0.25, lyric: "道" },
        { pitch: "5", octave: 0, duration: 0.25, lyric: "从" },
        { pitch: "6", octave: 0, duration: 0.25, lyric: "后" },
        { pitch: "1", octave: 1, duration: 0.25, lyric: "脑" },
        { pitch: "1", octave: 1, duration: 1, lyric: "" },
        { pitch: "6", octave: 0, duration: 0.25, lyric: "可" },
        { pitch: "5", octave: 0, duration: 0.25, lyric: "以" },
        { pitch: "6", octave: 0, duration: 0.25, lyric: "望" },
        { pitch: "2", octave: 1, duration: 0.25, lyric: "穿" },
        { pitch: "2", octave: 1, duration: 0.5, lyric: "" },
        { pitch: "1", octave: 1, duration: 0.5, lyric: "我" },
      ]
    },
    {
      id: 10,
      notes: [
        { pitch: "1", octave: 0, duration: 6, lyric: "六" },
        { pitch: "1", octave: 0, duration: 8, lyric: "八" },
      ]
    },
    {
      id: 11,
      notes: [
        { pitch: "1", octave: 0, duration: 6, lyric: "六" },
        { pitch: "1", octave: 0, duration: 8, lyric: "八" },
      ]
    }
  ]
};
