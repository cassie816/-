const STORAGE_KEY = 'fanTrackerData'
const THEME_KEY = 'fanTrackerTheme' // values: 'light' | 'dark' | 'system'
const CURR_USER_KEY = 'fanTrackerCurrentUser'

let fullData = []
let chartFollowers = null
let chartLikes = null
let currentSort = {key:'date', dir:1} // dir: 1 asc, -1 desc
let currentFilters = {startDate:null,endDate:null,search:''}

function getCurrentUser(){
  return localStorage.getItem(CURR_USER_KEY) || null
}

function loadAll(){
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : {}
}

function saveAll(obj){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

function loadUserData(){
  const user = getCurrentUser()
  if(!user) return null
  const all = loadAll()
  return all[user] || []
}

function saveUserData(arr){
  const user = getCurrentUser()
  if(!user) return
  const all = loadAll()
  all[user] = arr
  saveAll(all)
}

function loadData(){ return loadUserData() || [] }
function saveData(data){ saveUserData(data) }

function renderTable(displayed){
  const tbody = document.querySelector('#dataTable tbody')
  tbody.innerHTML = ''
  if(!displayed || displayed.length===0) return
  const frag = document.createDocumentFragment()
  // compute chronological delta map so delta is always previous-day delta
  const deltaMap = computeDeltaMap(fullData)
  for(let i=0;i<displayed.length;i++){
    const row = displayed[i]
    const delta = deltaMap[row.date] || 0
    const tr = document.createElement('tr')
    tr.dataset.date = row.date
    tr.innerHTML = `<td>${row.date}</td><td>${row.followers}</td><td>${row.likes}</td><td>${delta}</td><td><button data-date="${row.date}" class="btn-del">删除</button></td>`
    frag.appendChild(tr)
  }
  tbody.appendChild(frag)
  tbody.querySelectorAll('.btn-del').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const date = e.currentTarget.dataset.date
      const idx = fullData.findIndex(d=>d.date===date)
      if(idx>-1){
        fullData.splice(idx,1)
        saveData(fullData)
        updateAll()
      }
    })
  })
}

function updateCharts(data){
  const ctxF = document.getElementById('deltaChartFollowers').getContext('2d')
  const ctxL = document.getElementById('deltaChartLikes').getContext('2d')
  const sorted = data.slice().sort((a,b)=> a.date.localeCompare(b.date))
  const labels = sorted.map(r=>r.date)
  const deltasFollowers = sorted.map((r,i)=> i===0 ? 0 : r.followers - sorted[i-1].followers)
  const deltasLikes = sorted.map((r,i)=> i===0 ? 0 : r.likes - sorted[i-1].likes)
  // determine theme: respect user preference if set, otherwise use system
  const userPref = localStorage.getItem(THEME_KEY) || 'system'
  const isDark = (userPref === 'dark') || (userPref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  // prefer using CSS variables so palette is centralized in style.css
  const rootStyles = getComputedStyle(document.documentElement)
  const bodyStyles = getComputedStyle(document.body)
  const accent = rootStyles.getPropertyValue('--accent').trim() || (isDark? '#7fb07f' : '#7a9a7a')
  const accent2 = rootStyles.getPropertyValue('--accent-2').trim() || (isDark? '#5b7a5b' : '#c8d7c7')
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)'
  const textColor = bodyStyles.color || (isDark? '#e6eef8' : '#0f172a')

  // helper: convert hex to rgba string
  function hexToRgba(hex, alpha){
    if(!hex) return null
    hex = hex.replace('#','')
    if(hex.length === 3) hex = hex.split('').map(c=>c+c).join('')
    const r = parseInt(hex.substring(0,2),16)
    const g = parseInt(hex.substring(2,4),16)
    const b = parseInt(hex.substring(4,6),16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  const bgFill = accent2.startsWith('rgba') || accent2.startsWith('hsla') ? accent2 : hexToRgba(accent2, 0.12)
  if(chartFollowers) chartFollowers.destroy()
  if(chartLikes) chartLikes.destroy()

  chartFollowers = new Chart(ctxF,{
    type:'line',
    data:{ labels, datasets: [{label:'当日涨粉',data:deltasFollowers,fill:true,backgroundColor: bgFill || (isDark? hexToRgba(accent,0.12) : hexToRgba(accent,0.08)),borderColor: accent,pointBackgroundColor: accent,pointRadius:4,tension:0.25}] },
    options:{ responsive:true, maintainAspectRatio:true, aspectRatio: 16/9, plugins:{legend:{display:true,position:'top',align:'center'}}, scales:{ x:{ grid:{color:gridColor}, ticks:{color:textColor} }, y:{ grid:{color:gridColor}, ticks:{color:textColor} } } }
  })

  chartLikes = new Chart(ctxL,{
    type:'line',
    data:{ labels, datasets: [{label:'当日点赞增量',data:deltasLikes,fill:false,borderColor: accent,pointBackgroundColor: accent,pointRadius:3,tension:0.25}] },
    options:{ responsive:true, maintainAspectRatio:true, aspectRatio: 16/9, plugins:{legend:{display:true,position:'top',align:'center'}}, scales:{ x:{ grid:{color:gridColor}, ticks:{color:textColor} }, y:{ grid:{color:gridColor}, ticks:{color:textColor} } } }
  })

  // backward-compat: expose primary chart as window.chart
  window.chart = chartFollowers
  // listen for color scheme changes to update chart
  if(window.matchMedia){
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    if(mq.addEventListener){
      mq.addEventListener('change', ()=> {
        // only auto-update when user preference is 'system'
        if((localStorage.getItem(THEME_KEY) || 'system') === 'system') updateCharts(data)
      })
    } else if(mq.addListener){
      mq.addListener(()=>{ if((localStorage.getItem(THEME_KEY) || 'system') === 'system') updateCharts(data) })
    }
  }
}

function applyFiltersAndSort(data){
  let arr = data.slice()
  if(currentFilters.startDate) arr = arr.filter(d=> d.date >= currentFilters.startDate)
  if(currentFilters.endDate) arr = arr.filter(d=> d.date <= currentFilters.endDate)
  if(currentFilters.search && currentFilters.search.trim()){
    const s = currentFilters.search.trim().toLowerCase()
    arr = arr.filter(d=> d.date.includes(s) || String(d.followers).includes(s) || String(d.likes).includes(s))
  }
  const k = currentSort.key
  if(k === 'delta'){
    // compute delta per date based on chronological order
    const deltaMap = computeDeltaMap(data)
    arr.sort((a,b)=> currentSort.dir * ( (deltaMap[a.date]||0) - (deltaMap[b.date]||0) ))
  } else {
    arr.sort((a,b)=>{
      let va = a[k], vb = b[k]
      if(k === 'date') return currentSort.dir * va.localeCompare(vb)
      return currentSort.dir * (Number(va) - Number(vb))
    })
  }
  return arr
}

function computeDeltaMap(data){
  const map = {}
  const sorted = (data||[]).slice().sort((a,b)=> a.date.localeCompare(b.date))
  for(let i=0;i<sorted.length;i++){
    const cur = sorted[i]
    const prev = i===0 ? null : sorted[i-1]
    map[cur.date] = prev ? cur.followers - prev.followers : 0
  }
  return map
}

function updateHeaderSortIndicators(){
  document.querySelectorAll('#dataTable thead th').forEach(th=>{
    th.classList.remove('sort-asc','sort-desc')
  })
  const th = document.querySelector(`#dataTable thead th[data-key="${currentSort.key}"]`)
  if(th){
    th.classList.add(currentSort.dir===1? 'sort-asc':'sort-desc')
  }
}

function exportDisplayedCsv(displayed){
  if(!displayed) displayed = applyFiltersAndSort(fullData)
  const rows = [['日期','粉丝','点赞','当日涨粉']]
  for(let i=0;i<displayed.length;i++){
    const r = displayed[i]
    const prev = i===0 ? null : displayed[i-1]
    const delta = prev ? r.followers - prev.followers : 0
    rows.push([r.date, r.followers, r.likes, delta])
  }
  const csv = rows.map(r=>r.map(c=> String(c).includes(',')?`"${String(c).replace(/"/g,'""')}"`:c).join(',')).join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'fan-data.csv'; a.click(); URL.revokeObjectURL(url)
}

function updateAll(){
  fullData = loadData()
  const displayed = applyFiltersAndSort(fullData)
  renderTable(displayed)
  updateCharts(fullData)
}

document.addEventListener('DOMContentLoaded', ()=>{
  // backward compatibility: if no current user but STORAGE_KEY holds a legacy array,
  // migrate it into an object under a temporary key and set that as current user.
  const existingUser = getCurrentUser()
  if(!existingUser){
    try{
      const raw = localStorage.getItem(STORAGE_KEY)
      if(raw){
        const parsed = JSON.parse(raw)
        if(Array.isArray(parsed)){
          const legacyKey = '__legacy__'
          const migrated = {}
          migrated[legacyKey] = parsed
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          localStorage.setItem(CURR_USER_KEY, legacyKey)
        }
      }
    }catch(err){
      // if parsing fails, fall back to requiring login
    }
  }
  // NOTE: don't auto-redirect to login here — allow legacy/testing workflows
  // where tests inject `fanTrackerData` and reload the page. If a proper
  // user flow is needed, the login page still exists and can set `fanTrackerCurrentUser`.
  const form = document.getElementById('entryForm')
  const currentUserEl = document.getElementById('currentUser')
  const logoutBtn = document.getElementById('logoutBtn')
  if(currentUserEl) currentUserEl.textContent = getCurrentUser()
  if(logoutBtn) logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem(CURR_USER_KEY); window.location.href='login.html' })
  const exportBtn = document.getElementById('exportBtn')
  const exportCsvBtn = document.getElementById('exportCsvBtn')
  const importFile = document.getElementById('importFile')
  const clearBtn = document.getElementById('clearBtn')
  const startDate = document.getElementById('startDate')
  const endDate = document.getElementById('endDate')
  const searchInput = document.getElementById('searchInput')
  const resetFilters = document.getElementById('resetFilters')

  form.addEventListener('submit', e=>{
    e.preventDefault()
    const date = document.getElementById('date').value
    const followers = Number(document.getElementById('followers').value)
    const likes = Number(document.getElementById('likes').value)
    if(!date) return
    const data = loadData()
    const exists = data.find(d=>d.date===date)
    if(exists){
      exists.followers = followers
      exists.likes = likes
    } else {
      data.push({date,followers,likes})
    }
    saveData(data)
    form.reset()
    updateAll()
  })

  exportBtn.addEventListener('click', ()=>{
    const data = loadData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'fan-data.json'; a.click()
    URL.revokeObjectURL(url)
  })

  exportCsvBtn.addEventListener('click', ()=>{
    const displayed = applyFiltersAndSort(fullData)
    exportDisplayedCsv(displayed)
  })

  importFile.addEventListener('change', e=>{
    const f = e.target.files[0]
    if(!f) return
    const reader = new FileReader()
    reader.onload = ()=>{
      try{
        const imported = JSON.parse(reader.result)
        if(Array.isArray(imported)){
          saveData(imported)
          updateAll()
        } else alert('JSON 格式不正确，需要数组')
      }catch(err){alert('读取失败: '+err.message)}
    }
    reader.readAsText(f)
  })

  clearBtn.addEventListener('click', ()=>{
    if(confirm('确定清空所有数据吗？')){
      const user = getCurrentUser()
      if(user){
        const all = loadAll()
        delete all[user]
        saveAll(all)
      }
      updateAll()
    }
  })

  // filters
  startDate.addEventListener('change', ()=>{ currentFilters.startDate = startDate.value || null; updateAll() })
  endDate.addEventListener('change', ()=>{ currentFilters.endDate = endDate.value || null; updateAll() })
  searchInput.addEventListener('input', ()=>{ currentFilters.search = searchInput.value || ''; updateAll() })
  resetFilters.addEventListener('click', ()=>{ startDate.value=''; endDate.value=''; searchInput.value=''; currentFilters={startDate:null,endDate:null,search:''}; updateAll() })

  // theme toggle logic
  const themeToggle = document.getElementById('themeToggle')
  function applyTheme(pref){
    const body = document.body
    body.classList.remove('theme-dark','theme-light')
    if(pref === 'dark') body.classList.add('theme-dark')
    else if(pref === 'light') body.classList.add('theme-light')
    // update toggle UI
    if(themeToggle){
      const pressed = pref === 'dark'
      themeToggle.setAttribute('aria-pressed', String(pressed))
      themeToggle.textContent = pressed ? '🌙' : '☀️'
    }
  }

  // initialize theme from storage (default system)
  const stored = localStorage.getItem(THEME_KEY) || 'system'
  applyTheme(stored)

  if(themeToggle){
    themeToggle.addEventListener('click', ()=>{
      const cur = localStorage.getItem(THEME_KEY) || 'system'
      // cycle: system -> dark -> light -> system
      const next = cur === 'system' ? 'dark' : (cur === 'dark' ? 'light' : 'system')
      localStorage.setItem(THEME_KEY, next)
      applyTheme(next)
      // re-render charts with new theme
      updateCharts(fullData)
    })
  }

  // table header sorting (use data-key)
  document.querySelectorAll('#dataTable thead th[data-key]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.key
      if(!key) return
      if(currentSort.key === key){
        currentSort.dir = currentSort.dir * -1
      } else {
        currentSort.key = key
        currentSort.dir = -1 // default to descending on first click
      }
      updateAll()
    })
  })

  updateAll()
})
