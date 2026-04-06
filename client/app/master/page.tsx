'use client'
import React, { useState } from 'react';
import { SONG_DATA, NoteData } from './songData';
import styles from './page.module.css';

// 最底层音符组件
const Beat = ({ 
  note, 
  onUpdateLyric 
}: { 
  note: NoteData;
  onUpdateLyric: (value: string) => void;
}) => {
  const lineCount = note.duration < 1 ? Math.log2(1 / note.duration) : 0;

  return (
    <div className={styles.beatCell}>
      <div className={styles.highDots}>{note.octave > 0 && <span className={styles.dot} />}</div>
      <div className={styles.pitch}>{note.pitch}</div>
      <div className={styles.underlineContainer}>
        {lineCount >= 1 && <div className={`${styles.line} ${styles.line1}`} />}
        {lineCount >= 2 && <div className={`${styles.line} ${styles.line2}`} />}
        {lineCount >= 3 && <div className={`${styles.line} ${styles.line3}`} />}
      </div>
      <div className={styles.lowDots}>{note.octave < 0 && <span className={styles.dot} />}</div>
      <div className={styles.lyric}>{note.lyric}
        {/* <input 
          type="text" 
          value={note.lyric}
          className={styles.lyricInput}
        /> */}
      </div>
    </div>
  );
};

// 拍组组件：传递真实的全局索引
const BeatGroup = ({ 
  notes, 
  onUpdateNote,
  startIndex // 🔥 新增：这个包在小节里从第几个音符开始
}: { 
  notes: NoteData[];
  onUpdateNote: (globalIndex: number, lyric: string) => void;
  startIndex: number;
}) => {
  return (
    <div className={styles.beatGroup}>
      {notes.map((note, idx) => (
        <Beat 
          key={idx} 
          note={note} 
          onUpdateLyric={(v) => onUpdateNote(startIndex + idx, v)} 
        />
      ))}
    </div>
  );
};

// 小节组件：打包时记录每个包的起始索引
const Measure = ({ 
  data, 
  onUpdateMeasure 
}: { 
  data: { id: number; notes: NoteData[] };
  onUpdateMeasure: (mid: number, globalIndex: number, lyric: string) => void;
}) => {
  const packs: { notes: NoteData[]; start: number }[] = []; // 🔥 存包+起始索引
  let currentPack: NoteData[] = [];
  let currentDuration = 0;
  let globalIndex = 0; // 🔥 全局音符计数

  data.notes.forEach((note) => {
    currentPack.push(note);
    currentDuration += note.duration;

    if (currentDuration >= 1) {
      packs.push({
        notes: currentPack,
        start: globalIndex - currentPack.length + 1 // 🔥 记录起始位置
      });
      currentPack = [];
      currentDuration = 0;
    }
    globalIndex++;
  });

  if (currentPack.length > 0) {
    packs.push({
      notes: currentPack,
      start: globalIndex - currentPack.length
    });
  }

  return (
    <div className={styles.measure}>
      <div className={styles.notesRow}>
        {packs.map((pack, idx) => (
          <BeatGroup 
            key={idx} 
            notes={pack.notes} 
            startIndex={pack.start} // 🔥 传给子组件
            onUpdateNote={(globalIdx, lyric) => {
              onUpdateMeasure(data.id, globalIdx, lyric);
            }}
          />
        ))}
      </div>
      <div className={styles.barLine}></div>
    </div>
  );
};

// 主页面
export default function JianpuPage() {
  const [songData, setSongData] = useState(SONG_DATA);

  const handleUpdateNote = (
    measureId: number,
    globalNoteIndex: number, // 🔥 现在是真实索引！
    newLyric: string
  ) => {
    setSongData(prev => {
      const newMeasures = prev.measures.map(measure => {
        if (measure.id !== measureId) return measure;

        const newNotes = [...measure.notes];
        if (newNotes[globalNoteIndex]) {
          newNotes[globalNoteIndex] = {
            ...newNotes[globalNoteIndex],
            lyric: newLyric
          };
        }

        return { ...measure, notes: newNotes };
      });

      return { ...prev, measures: newMeasures };
    });
  };

  return (
    <main className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>{songData.title}</h1>
        <div className={styles.meta}>
          <span>{songData.artist}</span>
          <span>{songData.key}</span>
          <span>{songData.beat}</span>
        </div>
      </header>

      <div className={styles.scoreSystem}>
        {songData.measures.map((measure) => (
          <Measure 
            key={measure.id} 
            data={measure} 
            onUpdateMeasure={handleUpdateNote} 
          />
        ))}
        <div className={styles.barLine} style={{ width: '4px' }}></div>
      </div>
    </main>
  );
}