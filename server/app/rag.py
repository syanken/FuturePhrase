"""
简化版本地 RAG 向量存储
轻量级、易用、无需复杂配置
"""
import os
import json
import hmac
import hashlib
import requests
from typing import List, Dict, Optional
from langchain_chroma import Chroma
# from langchain_huggingface  import HuggingFaceEmbeddings
from langchain_core.documents import Document
import time

class TencentEmbeddings():
    """
    基于原生 requests 实现的腾讯混元 (Hunyuan) Embedding 适配器
    参考文档: https://cloud.tencent.com/document/api/1729/102832
    """
    def __init__(self, secret_id: str, secret_key: str, region: str = "ap-guangzhou"):
        self.secret_id = secret_id
        self.secret_key = secret_key
        self.region = region
        
        # 修正1: 根据文档，域名是 hunyuan.tencentcloudapi.com
        self.host = "hunyuan.tencentcloudapi.com"
        
        # 修正2: 根据文档，版本是 2023-09-01
        self.version = "2023-09-01"
        
        # 修正3: 根据文档，Action 是 GetEmbedding
        self.action = "GetEmbedding"

    def _get_signature(self, params: dict) -> str:
        """
        生成腾讯云 API 3.0 签名
        注意：这是简化版逻辑，适用于标准 POST JSON 请求
        """
        timestamp = int(time.time())
        date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
        service = "hunyuan" # 服务名通常与 host 前缀一致

        # 1. 拼接规范请求串
        http_request_method = "POST"
        canonical_uri = "/"
        canonical_querystring = ""
        ct = "application/json; charset=utf-8"
        
        # 将参数与公共参数合并
        canonical_headers = f"content-type:{ct}\nhost:{self.host}\n"
        signed_headers = "content-type;host"
        
        # 注意: 这里必须对 params 进行排序后的 JSON 序列化
        payload = json.dumps(params, separators=(',', ':'), ensure_ascii=False)
        hashed_request_payload = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        canonical_request = (f"{http_request_method}\n{canonical_uri}\n{canonical_querystring}\n"
                             f"{canonical_headers}\n{signed_headers}\n{hashed_request_payload}")

        # 2. 拼接待签名字符串
        algorithm = "TC3-HMAC-SHA256"
        credential_scope = f"{date}/{service}/tc3_request"
        hashed_canonical_request = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
        string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical_request}"

        # 3. 计算签名
        def sign(key, msg: str) -> bytes:
            # 兼容 bytes 和 str 类型
            if isinstance(key, bytes):
                key_bytes = key
            else:
                key_bytes = key.encode("utf-8")
            return hmac.new(key_bytes, msg.encode("utf-8"), hashlib.sha256).digest()

        secret_date = sign("TC3" + self.secret_key, date)
        secret_service = sign(secret_date, service)
        secret_signing = sign(secret_service, "tc3_request")
        signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

        # 4. 构造 Authorization 头
        authorization = (f"{algorithm} "
                         f"Credential={self.secret_id}/{credential_scope}, "
                         f"SignedHeaders={signed_headers}, "
                         f"Signature={signature}")
        
        return authorization, timestamp, payload

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        embeddings = []
        
        # 腾讯混元接口限制: InputList.N 总长度不超过 50
        # 这里为了简单，采用逐条发送（生产环境建议批量打包，但需处理截断）
        for text in texts:
            # 修正4: 文档指出总长度不超过 1024 Token，这里做简单截断
            # 注意: 这里是字符截断示意，实际应按 Token 截断
            truncated_text = text[:1000] 
            
            # 修正5: 构造符合文档要求的参数
            # 支持单条 Input 或数组 InputList.N
            params = {
                "Input": truncated_text
                # 如果要批量，可以使用 "InputList": [["text1", "text2"]]
            }

            try:
                # 生成签名（同时获取 payload 确保格式一致）
                authorization, timestamp, payload = self._get_signature(params)

                # 修正6: 构造请求头 (注意 Host 必须是域名)
                headers = {
                    "Content-Type": "application/json; charset=utf-8",
                    "Host": self.host,
                    "X-TC-Action": self.action,
                    "X-TC-Version": self.version,
                    "X-TC-Timestamp": str(timestamp),
                    "X-TC-Region":  "ap-guangzhou",
                    "Authorization": authorization,
                    # X-TC-Language 是可选的，通常默认即可
                }

                # 发送请求（使用签名时生成的 payload，确保哈希一致）
                url = f"https://{self.host}"
                response = requests.post(url, headers=headers, data=payload.encode('utf-8'))
                
                if response.status_code == 200:
                    resp_json = response.json()
                    # 修正7: 解析返回结果 (文档: Response.Data[].Embedding)
                    data_list = resp_json.get("Response", {}).get("Data", [])
                    if data_list and "Embedding" in data_list[0]:
                        # 修正8: 向量维度是 1024
                        embeddings.append(data_list[0]["Embedding"])
                    else:
                        print(f"API 返回数据格式异常: {resp_json}")
                        embeddings.append([0.0] * 1024)
                else:
                    print(f"HTTP 请求失败: {response.status_code}, {response.text}")
                    embeddings.append([0.0] * 1024)

            except Exception as e:
                print(f"Embedding request failed: {e}")
                embeddings.append([0.0] * 1024)

        return embeddings

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]

class SimpleLyricsRAG:
    """简化的歌词向量存储"""
    
    def __init__(self, persist_dir: str = "./lyrics_vector_db"   ,     tencent_secret_id: str = None,
        tencent_secret_key: str = None):
        """
        初始化
        
        Args:
            persist_dir: 向量数据库持久化目录
        """
        self.persist_dir = persist_dir
        self.embeddings = None
        self.vectorstore = None
        self.tencent_secret_id = tencent_secret_id or os.getenv("TENCENT_SECRET_ID")
        self.tencent_secret_key = tencent_secret_key or os.getenv("TENCENT_SECRET_KEY")
        # 延迟初始化（避免启动时就加载模型）
        self._initialized = False
    
    def _lazy_init(self):
        """延迟初始化"""
        if self._initialized:
            return
        
        try:
            print("[SimpleRAG] initing...", flush=True)
            
            # 使用轻量级的 BGE-Micro 模型
            # self.embeddings = HuggingFaceEmbeddings(
            #     model_name="BAAI/bge-micro",
            #     model_kwargs={'device': 'cpu'},
            #     encode_kwargs={'normalize_embeddings': True}
            # )
            self.embeddings = TencentEmbeddings(
                secret_id=self.tencent_secret_id,
                secret_key=self.tencent_secret_key,
            )
            # 初始化或加载 ChromaDB
            if os.path.exists(self.persist_dir):
                self.vectorstore = Chroma(
                    persist_directory=self.persist_dir,
                    embedding_function=self.embeddings
                )
                count = self.vectorstore._collection.count()
                print(f"[SimpleRAG] 已加载向量库，共 {count} 条数据", flush=True)
            else:
                self.vectorstore = Chroma(
                    embedding_function=self.embeddings,
                    persist_directory=self.persist_dir
                )
                print("[SimpleRAG] 已创建新的向量库", flush=True)
            
            self._initialized = True
            
        except Exception as e:
            print(f"[SimpleRAG] 初始化失败: {e}", flush=True)
            raise
    
    def add_lyrics(
        self, 
        lyrics_list: List[Dict]
    ) -> int:
        """
        批量添加歌词
        
        Args:
            lyrics_list: 歌词列表，格式：
                [
                    {
                        "title": "歌名",
                        "artist": "歌手",
                        "content": "歌词内容",
                        "style": "风格",
                        "theme": "主题标签"
                    }
                ]
        
        Returns:
            添加的数量
        """
        self._lazy_init()
        
        documents = []
        for lyrics in lyrics_list:
            # 构建文档内容
            content = f"""{
                lyrics.get('title', '未知'),
                lyrics.get('artist', '未知'),
                lyrics.get('content', '')
            }"""
            
            doc = Document(
                page_content=content,
                metadata={
                    "title": lyrics.get('title', '未知'),
                    "artist": lyrics.get('artist', '未知'),
                    "style": lyrics.get('style', '流行'),
                    "theme": lyrics.get('theme', ''),
                }
            )
            documents.append(doc)
        
        # 批量添加
        self.vectorstore.add_documents(documents)
        
        print(f"[SimpleRAG] added {len(documents)} lyrics", flush=True)
        return len(documents)
    
    def search(
        self, 
        query: str, 
        style: str = None, 
        k: int = 3
    ) -> List[Dict]:
        """
        检索相似歌词
        
        Args:
            query: 查询文本
            style: 风格过滤（可选）
            k: 返回数量
        
        Returns:
            相似歌词列表
        """
        self._lazy_init()
        
        try:
            # 构建过滤条件
            filter_dict = {"style": style} if style else None
            
            # 执行检索（带分数）
            if filter_dict:
                results = self.vectorstore.similarity_search_with_score(
                    query, k=k, filter=filter_dict
                )
            else:
                results = self.vectorstore.similarity_search_with_score(
                    query, k=k
                )
            
            # 格式化结果
            formatted = []
            for doc, score in results:
                # 转换距离为相似度
                similarity = 1 / (1 + score)
                
                formatted.append({
                    "title": doc.metadata.get("title", "未知"),
                    "artist": doc.metadata.get("artist", "未知"),
                    "style": doc.metadata.get("style", "流行"),
                    "theme": doc.metadata.get("theme", ""),
                    "content": doc.page_content,
                    "similarity": round(similarity, 3),
                })
            
            return formatted
            
        except Exception as e:
            print(f"[SimpleRAG] fail: {e}", flush=True)
            return []
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        self._lazy_init()
        
        try:
            collection = self.vectorstore._collection
            count = collection.count()
            
            # 统计风格分布
            all_docs = collection.get()
            style_stats = {}
            for metadata in all_docs.get('metadatas', []):
                style = metadata.get('style', '未知')
                style_stats[style] = style_stats.get(style, 0) + 1
            
            return {
                "total_documents": count,
                "style_distribution": style_stats,
            }
        except:
            return {"total_documents": 0}


# 全局单例
_simple_rag: Optional[SimpleLyricsRAG] = None

def get_simple_rag() -> SimpleLyricsRAG:
    """获取全局实例"""
    global _simple_rag
    if _simple_rag is None:
        _simple_rag = SimpleLyricsRAG()
    return _simple_rag
