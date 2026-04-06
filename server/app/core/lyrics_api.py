import requests
from bs4 import BeautifulSoup

def query_lyrics(query):
    query_url = 'https://lyrics.net.cn/search/?q=' + query
    res = requests.get(query_url).text
    soup = BeautifulSoup(res, 'lxml')
    links = soup.select('a')
    lyrics, artist = [], []

    for link in links:
        href = link.get('href')
        if not href: continue

        text = link.get_text(strip=True)
        song_id = href.split('/')[-1]

        if '/lyrics/' in href:
            lyrics.append({'name': text, 'id': song_id})
        elif '/artist/' in href:
            artist.append({'name': text, 'id': song_id})

    return lyrics, artist

def lyrics_details(id):
    url = 'https://lyrics.net.cn/lyrics/' + str(id)
    res = requests.get(url).text
    soup = BeautifulSoup(res, 'lxml')
    container = soup.select_one('.lyrics_main')

    lyrics_text = container.get_text(separator='\n', strip=True)
    lyrics_list = [line for line in lyrics_text.split('\n') if line != '查看歌词解读']

    interpretation_link = container.find('a', href=lambda x: x and '/interpretation/' in x)['href']
    return lyrics_list, interpretation_link


def artist_details(id):
    url = 'https://lyrics.net.cn/artist/' + str(id)
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

    return songs_list
