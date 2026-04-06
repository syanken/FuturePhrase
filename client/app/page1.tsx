"use client"

import styles from './page.module.css'
import { useState } from 'react'
import Link from 'next/link';
export default function Home() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState({ title: '', lyrics: [] })
  const [inputValue, setInputValue] = useState('');

  const [autoCompleteInputValue, setAutoCompleteInputValue] = useState('');
  const [imitateInputValue, setImitateInputValue] = useState('');

  const handleRequset = async (input: string, mode: string, setValue: Function) => {
    console.log(input)
    const response = await fetch('http://localhost:6789/api/v1/generate', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        theme: input,
        style: "string",
        mode: mode
      }),
    })
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let accumulatedJson = '';
      let jsonStack = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream complete');
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          const data = line.replace('data: ', '')
          if (data === '[DONE]') continue;
          for (const c of data) {
            accumulatedJson += c;
            if (c == '}' || c == ']') {
              jsonStack = jsonStack.slice(0, -1);
              const jsonstr = accumulatedJson + jsonStack.split('').reverse().join('')
              try {
                const parsedData = JSON.parse(jsonstr);
                setValue(parsedData);
                console.log(parsedData)
              }
              catch (e) {
                console.log(jsonstr)
              }
            } else if (c == '{') {
              jsonStack += '}'
            } else if (c == '[') {
              jsonStack += ']'
            }
          }
        }
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  }

  const handleClick = async () => {
    if (loading) return

    setLoading(true)
    setResult({ title: '', lyrics: [] })

    try {
      await handleRequset(inputValue, 'full', setResult)

    } catch (error) {
      console.error('请求失败:', error)
      alert('请求失败，请检查控制台')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.container}>
      {/* 左列 */}
      <div className={styles.leftColumn}>
        <div className={styles.bottomElms}>
          <div className={styles.des}>自由创作</div>
          <textarea className={styles.textarea} value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder='输入想要什么'></textarea>
          <button className={styles.button} onClick={handleClick}> click </button>
        </div>
        <div className={styles.bottomElms}>
          <div className={styles.des}>微调</div>
          <textarea className={styles.textarea} value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder='输入想要什么'></textarea>
          <button className={styles.button} onClick={handleClick}> click </button>
        </div>
        <div className={styles.bottomElms}>
          <div className={styles.des}>模仿</div>
          <textarea className={styles.textarea} value={imitateInputValue} onChange={(e) => { setImitateInputValue(e.target.value) }} placeholder='输入想要什么'></textarea>
          <button className={styles.button} onClick={() => handleRequset(imitateInputValue, 'imitate', setImitateInputValue)}> click </button>
        </div>
        <div className={styles.bottomElms}>
          <div className={styles.des}>补全</div>
          <textarea className={styles.textarea} value={autoCompleteInputValue} onChange={(e) => setAutoCompleteInputValue(e.target.value)} placeholder='输入想要什么'></textarea>
          <button className={styles.button} onClick={() => handleRequset(autoCompleteInputValue, 'auto_complete', setAutoCompleteInputValue)}> click </button>
        </div>
      </div>

      {/* 右列 */}
      <div className={styles.rightColumn}>
        {result.lyrics.map((item: any) => (
          <div
            key={item.id}
            className={styles.lyrics}
          >
            <span style={{ fontWeight: 'bold', color: '#0070f3' }}>
              {item.id}
            </span>
            <div>{item.content}</div>
          </div>
        )) || '等待点击生成...'}
        <div className={styles.bottomElms}>
          <button className={styles.button}> 替换 </button>
        </div>
        <Link href="/master" className={styles.button}>去高级页</Link>
      </div>
    </main>
  )
}