import requests
from bs4 import BeautifulSoup

class LyricsNetCn:
    def __init__(self):
        self.base_url = 'https://lyrics.net.cn'

    def query_lyrics(self,query):
        """
        根据查询词在 lyrics.net.cn 上搜索歌词信息。

        参数:
        query (str): 查询词，如歌曲名，歌词或歌手名。

        返回值:
        dict: 搜索结果字典，键为类别（如 '歌曲' ，'歌词'或 '歌手'），值为包含 'name' 和 'id' 的字典列表。
        """
        query_url = self.base_url+'/search/?q=' + query
        res = requests.get(query_url).text
        soup = BeautifulSoup(res, 'lxml')
        titles = soup.find_all('div', class_='search_title')
        results = {}
        for title in titles:
            title_text = title.get_text(strip=True)
            if '搜索结果' not in title_text and '搜索結果' not in title_text:
                continue
            title_text = title_text[1:3]
            ls = []
            content = title.find_next_sibling('div').select('a')
            for c in content:
                text = c.get_text(strip=True)
                href = c.get('href').split('/')[-1]
                ls.append({
                    'name': text,
                    'id': href
                })
            results[title_text] = ls
        return results


    def lyrics_details(self,id):
        """
        根据歌词 ID 获取歌词信息。
        参数:
        id (str): 歌词ID。

        返回值:
        dict: 歌词信息字典，包含 'title'（歌曲标题）、'artist'（歌手名称）、'lyrics'（歌词内容）。
        """
        url = self.base_url + '/lyrics/' + str(id)
        res = requests.get(url).text
        try:
            soup = BeautifulSoup(res, 'lxml')
            title_name = soup.find('h2').text
            artist_name = soup.select_one('#artist').text
            container = soup.select_one('.lyrics_main')
            lyrics_text = container.get_text(separator='\n', strip=True)
            lyrics_list = [line for line in lyrics_text.split('\n') if line != '查看歌词解读']
            interpretation_link = container.find('a', href=lambda x: x and '/interpretation/' in x)['href']
            return {
                'title': title_name,
                'artist': artist_name,
                'content': lyrics_list
            }
        except:
            return None


    def artist_details(self,id):
        """
        根据艺术家ID获取歌曲列表详情信息。

        参数:
        id (str): 艺术家ID。

        返回值:
        dict: 包含艺术家歌曲列表的信息字典。
        """
        url = self.base_url+'/artist/' + str(id)
        res = requests.get(url).text
        soup = BeautifulSoup(res, 'lxml')
        container = soup.select_one('.hot_list')
        links = container.select('a')
        songs = [
            a for a in links
            if a.get('href', '').startswith('/lyrics/')
        ]
        songs_list = [{'name': link.get_text(strip=True), 'id': link.get('href').split('/')[-1]} for link in songs if
                    '/lyrics/' in link.get('href')]

        return {
            'songs': songs_list
        }

if __name__ == '__main__':
    ln = LyricsNetCn()
    print(ln.lyrics_details(14586))