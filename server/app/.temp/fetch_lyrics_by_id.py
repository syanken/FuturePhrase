"""
批量获取歌词ID 1-1000 并添加到RAG库
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')  # 添加这行

from core.lyrics_api import LyricsNetCn
from rag import get_simple_rag
from dotenv import load_dotenv
load_dotenv()
def main():
    ln = LyricsNetCn()
    rag = get_simple_rag()
    
    print("开始获取歌词 ID 1-1000...\n")
    
    for lyrics_id in range(1, 1001):
        print(f"[{lyrics_id}/1000] ", end="", flush=True)
        
        try:
            details = ln.lyrics_details(lyrics_id)
            
            if not details:
                continue
            
            content = '\n'.join(details.get('content', []))
            
            rag.add_lyrics([{
                "title": details.get('title', '未知'),
                "artist": details.get('artist', '未知'),
                "content": content,
                "style": "流行",
                "theme": ""
            }])
            
            print(f"✅ {details.get('title')} - {details.get('artist')}")
            
        except Exception as e:
            print(f"❌ fail2: {e}")
    
    stats = rag.get_stats()
    print(f"\n完成！库中共 {stats['total_documents']} 首歌词")

if __name__ == '__main__':
    main()
