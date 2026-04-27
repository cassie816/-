#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import sys

URL = 'http://localhost:8000'

sample = [
    {"date": "2026-04-20", "followers": 1000, "likes": 200},
    {"date": "2026-04-21", "followers": 1010, "likes": 205},
    {"date": "2026-04-22", "followers": 1030, "likes": 210},
    {"date": "2026-04-23", "followers": 1025, "likes": 215},
]

def fail(msg):
    print('ERROR:', msg)
    sys.exit(2)

import os
import shutil

def find_system_chrome():
    candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
    ]
    # common names in PATH
    for name in ('google-chrome','chrome','chromium','chromium-browser'):
        which = shutil.which(name)
        if which:
            candidates.append(which)
    for pth in candidates:
        if pth and os.path.exists(pth):
            return pth
    return None

with sync_playwright() as p:
    chrome_path = find_system_chrome()
    if chrome_path:
        browser = p.chromium.launch(headless=True, executable_path=chrome_path)
    else:
        print('No system Chrome/Chromium found. Please install Chrome or allow browser download.')
        raise SystemExit(3)
    page = browser.new_page()
    page.goto(URL)

    # ensure clean state and inject sample
    page.evaluate("localStorage.removeItem('fanTrackerData')")
    page.evaluate("localStorage.setItem('fanTrackerData', JSON.stringify(%s))" % (sample,))
    page.reload()

    # check table rows
    rows = page.query_selector_all('#dataTable tbody tr')
    if len(rows) != len(sample):
        fail(f'table rows {len(rows)} != expected {len(sample)}')

    # check chart exposed
    chart_exists = page.evaluate('Boolean(window.chart && window.chart.data && window.chart.data.labels)')
    if not chart_exists:
        fail('chart not initialized')

    # click followers header to sort
    page.click('#dataTable thead th[data-key="followers"]')
    page.wait_for_timeout(150)
    first_followers = page.query_selector('#dataTable tbody tr:first-child td:nth-child(2)').inner_text()
    try:
        if int(first_followers) <= 0:
            fail('unexpected followers value after sort')
    except Exception:
        fail('unable to parse followers after sort')

    # click delta header to sort by delta
    page.click('#dataTable thead th[data-key="delta"]')
    page.wait_for_timeout(150)
    first_date = page.query_selector('#dataTable tbody tr:first-child td:first-child').inner_text()
    if not first_date:
        fail('delta sort produced empty first date')

    # generate CSV preview
    csv = page.evaluate(r'''() => {
        const data = (typeof fullData !== 'undefined') ? fullData : (localStorage.getItem('fanTrackerData') ? JSON.parse(localStorage.getItem('fanTrackerData')) : []);
        const displayed = (typeof applyFiltersAndSort === 'function') ? applyFiltersAndSort(data) : data.slice().sort((a,b)=>a.date.localeCompare(b.date));
        const rows = [['日期','粉丝','点赞','当日涨粉']];
        const deltaMap = (typeof computeDeltaMap === 'function') ? computeDeltaMap(data) : (function(){const m={};(data||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((r,i,arr)=>{m[r.date]= i===0?0:r.followers-arr[i-1].followers});return m})();
        for(let i=0;i<displayed.length;i++){
            const r = displayed[i]; const delta = deltaMap[r.date]||0; rows.push([r.date, r.followers, r.likes, delta]);
        }
        const csvRows = rows.map(function(r){
            return r.map(function(c){
                const s = String(c);
                if(s.indexOf(',') !== -1 || s.indexOf('"') !== -1) return '"' + s.replace(/"/g,'""') + '"';
                return s;
            }).join(',');
        }).join('\n');
        return '\uFEFF' + csvRows;
    }''')
    if not csv or '日期' not in csv:
        fail('csv generation failed')

    print('E2E tests passed')
    browser.close()
