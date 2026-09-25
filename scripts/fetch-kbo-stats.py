#!/usr/bin/env python3
"""Fetch KBO regular-season team records from koreabaseball.com and write league totals.

Output: data/kbo-league-stats.json — per season, each team's raw table rows and the league
'합계' row, for hitting, pitching and base running. docs/CALIBRATION.md cites this file.

Usage: python3 scripts/fetch-kbo-stats.py 2021 2022 2023 2024 2025
Standard library only. The pages are ASP.NET forms: a season is chosen by posting back the
season drop-down with the page's __VIEWSTATE.
"""
import html
import http.cookiejar
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

BASE = 'https://www.koreabaseball.com/Record/Team/'
PAGES = {
    'hitter1': 'Hitter/Basic1.aspx',
    'hitter2': 'Hitter/Basic2.aspx',
    'pitcher1': 'Pitcher/Basic1.aspx',
    'pitcher2': 'Pitcher/Basic2.aspx',
    'runner': 'Runner/Basic.aspx',
    'defense': 'Defense/Basic.aspx',
}
OUT = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'kbo-league-stats.json'

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (research script)')]


def get(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    with opener.open(url, body, timeout=60) as r:
        return r.read().decode('utf-8')


def hidden_fields(page):
    return {m.group(1): html.unescape(m.group(2)) for m in re.finditer(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', page)}


def table(page):
    t = re.search(r'<table.*?</table>', page, re.S).group(0)
    rows = []
    for tr in re.findall(r'<tr.*?</tr>', t, re.S):
        cells = [html.unescape(re.sub(r'<.*?>', '', c)).strip() for c in re.findall(r'<t[hd].*?</t[hd]>', tr, re.S)]
        if cells:
            rows.append(cells)
    return rows


def season_page(path, season):
    url = BASE + path
    first = get(url)
    name = re.search(r'name="([^"]*ddlSeason\$ddlSeason)"', first).group(1)
    series = re.search(r'name="([^"]*ddlSeries\$ddlSeries)"', first)
    form = hidden_fields(first)
    form.update({'__EVENTTARGET': name, '__EVENTARGUMENT': '', name: str(season)})
    if series:
        form[series.group(1)] = '0'  # regular season
    page = get(url, form)
    selected = re.search(r'<option selected="selected" value="(\d{4})"', page)
    if not selected or selected.group(1) != str(season):
        raise SystemExit(f'{path}: season {season} was not selected')
    return page


def to_record(header, row):
    # The total row has no rank column: '합계' sits under 순위 and every value shifts left by one.
    if row[0] == '합계':
        row = ['', '합계'] + row[1:]
    out = {}
    for k, v in zip(header, row):
        v = v.replace(',', '')
        try:
            out[k] = float(v) if '.' in v else int(v)
        except ValueError:
            out[k] = v
    return out


def main():
    seasons = [int(s) for s in sys.argv[1:]] or [2023, 2024, 2025]
    result = json.loads(OUT.read_text()) if OUT.exists() else {}
    result.setdefault('source', 'https://www.koreabaseball.com/Record/Team/ (정규시즌 팀 기록)')
    for season in seasons:
        entry = {}
        for key, path in PAGES.items():
            rows = table(season_page(path, season))
            header, body = rows[0], rows[1:]
            records = [to_record(header, r) for r in body]
            entry[key] = {
                'teams': [r for r in records if r.get('팀명') != '합계'],
                'total': next((r for r in records if r.get('팀명') == '합계'), None),
            }
            print(f'{season} {key}: {len(entry[key]["teams"])} teams')
        result[str(season)] = entry
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
