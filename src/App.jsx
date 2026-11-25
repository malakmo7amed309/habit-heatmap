import { useEffect, useMemo, useState } from 'react'

const STORAGE = 'hh-data-v1'
const DAY = 86400000

const PALETTE = ['#1d3129', '#24503c', '#2f7350', '#43a06b', '#6fd598']

const DEFAULT_HABITS = [
  { id: 'read', name: 'Read 20 pages', color: 0, created: daysAgo(96) },
  { id: 'run', name: 'Morning run', color: 0, created: daysAgo(40) },
  { id: 'code', name: 'Code 1 hour', color: 0, created: daysAgo(180) },
]

function daysAgo(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime() - n * DAY
}

function dayKey(t) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (raw) return JSON.parse(raw)
  } catch { /* fresh start */ }
  // seed with believable history so the heatmap tells a story on first visit
  const checks = {}
  let t = daysAgo(180)
  const now = daysAgo(0)
  while (t <= now) {
    const k = dayKey(t)
    const dow = new Date(t).getDay()
    if (Math.random() < 0.62) checks[`read|${k}`] = 1
    if (dow !== 5 && Math.random() < 0.45) checks[`run|${k}`] = 1
    if (Math.random() < (dow === 5 || dow === 6 ? 0.8 : 0.55)) checks[`code|${k}`] = 1
    t += DAY
  }
  return { habits: DEFAULT_HABITS, checks }
}

export default function App() {
  const [data, setData] = useState(load)
  const [activeId, setActiveId] = useState(data.habits[0]?.id)
  const [weeks, setWeeks] = useState(26)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(data))
  }, [data])

  const active = data.habits.find((h) => h.id === activeId) || data.habits[0]

  const toggle = (habitId, t) => {
    const k = `${habitId}|${dayKey(t)}`
    setData((d) => {
      const checks = { ...d.checks }
      if (checks[k]) delete checks[k]
      else checks[k] = 1
      return { ...d, checks }
    })
  }

  const addHabit = () => {
    const name = newName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || `h${Date.now()}`
    if (data.habits.some((h) => h.id === id)) return
    setData((d) => ({ ...d, habits: [...d.habits, { id, name, color: 0, created: daysAgo(0) }] }))
    setNewName('')
    setActiveId(id)
  }

  const removeHabit = (id) => {
    setData((d) => {
      const checks = Object.fromEntries(Object.entries(d.checks).filter(([k]) => !k.startsWith(id + '|')))
      return { habits: d.habits.filter((h) => h.id !== id), checks }
    })
    if (activeId === id) setActiveId(data.habits.find((h) => h.id !== id)?.id)
  }

  const grid = useMemo(() => {
    const today = daysAgo(0)
    const startOfThisWeek = today - ((new Date(today).getDay() + 1) % 7) * DAY // weeks start Saturday (EG weekend Fri-Sat)
    const start = startOfThisWeek - (weeks - 1) * 7 * DAY
    const cols = []
    for (let w = 0; w < weeks; w++) {
      const col = []
      for (let d = 0; d < 7; d++) col.push(start + w * 7 * DAY + d * DAY)
      cols.push(col)
    }
    return cols
  }, [weeks])

  const stats = useMemo(() => {
    if (!active) return null
    const isDone = (t) => !!data.checks[`${active.id}|${dayKey(t)}`]
    // current streak: walk back from today (today not done yet doesn't break it)
    let cur = 0
    let t = daysAgo(0)
    if (!isDone(t)) t -= DAY
    while (isDone(t) && t >= active.created) { cur++; t -= DAY }
    // best streak
    let best = 0
    let run = 0
    for (let x = active.created; x <= daysAgo(0); x += DAY) {
      run = isDone(x) ? run + 1 : 0
      if (run > best) best = run
    }
    // last 28 days rate
    let n = 0
    for (let x = daysAgo(27); x <= daysAgo(0); x += DAY) if (isDone(x)) n++
    const rate = Math.round((n / 28) * 100)
    // weekday rhythm: done count per weekday over the window
    const rhythm = [0, 0, 0, 0, 0, 0, 0]
    const totals = [0, 0, 0, 0, 0, 0, 0]
    for (let x = Math.max(active.created, daysAgo((weeks * 7) - 1)); x <= daysAgo(0); x += DAY) {
      const dow = new Date(x).getDay()
      totals[dow]++
      if (isDone(x)) rhythm[dow]++
    }
    return { cur, best, rate, rhythm, totals, total: Object.keys(data.checks).filter((k) => k.startsWith(active.id + '|')).length }
  }, [data, active, weeks])

  const cellLevel = (t) => {
    if (!active) return -1
    if (t < active.created || t > daysAgo(0)) return -1
    return data.checks[`${active.id}|${dayKey(t)}`] ? 3 : 0
  }

  const today = daysAgo(0)
  const DOW = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  return (
    <div className="min-h-screen bg-deep text-mint">
      <header className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-3 px-4 pt-10 sm:px-6">
        <div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Habit Heatmap</h1>
          <p className="mt-1 text-sm text-mintdim">Don't break the chain. Your year, in pixels.</p>
        </div>
        <div className="flex gap-2 text-xs">
          {[[13, '13 weeks'], [26, '26 weeks'], [52, '52 weeks']].map(([w, l]) => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`rounded-full border px-3 py-1.5 transition ${weeks === w ? 'border-glow bg-glow/15 text-glow' : 'border-line text-mintdim hover:text-mint'}`}>
              {l}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-12 sm:px-6">
        {/* habit tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {data.habits.map((h) => (
            <button key={h.id} onClick={() => setActiveId(h.id)}
              className={`group rounded-xl border px-4 py-2 text-sm transition ${active?.id === h.id ? 'border-glow bg-panel text-glow' : 'border-line bg-panel/60 text-mintdim hover:text-mint'}`}>
              {h.name}
              {data.habits.length > 1 && (
                <span onClick={(e) => { e.stopPropagation(); removeHabit(h.id) }}
                  className="ml-2 hidden text-mintdim/60 hover:text-red-400 group-hover:inline" title="Delete habit">x</span>
              )}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              placeholder="New habit"
              className="w-28 rounded-xl border border-line bg-panel px-3 py-2 text-sm text-mint placeholder-mintdim/50 focus:border-glow focus:outline-none" />
            <button onClick={addHabit} className="rounded-xl border border-glow/50 px-3 py-2 text-sm text-glow transition hover:bg-glow/10">+</button>
          </div>
        </div>

        {active && stats && (
          <>
            {/* today check-in */}
            <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-mintdim">Today</p>
                <p className="font-display text-lg">{active.name}</p>
              </div>
              <button onClick={() => toggle(active.id, today)}
                className={`rounded-xl px-5 py-2.5 font-display text-sm font-semibold transition ${
                  data.checks[`${active.id}|${dayKey(today)}`]
                    ? 'bg-glow text-deep shadow-[0_0_24px_rgba(111,213,152,0.35)]'
                    : 'border border-glow/60 text-glow hover:bg-glow/10'
                }`}>
                {data.checks[`${active.id}|${dayKey(today)}`] ? 'Done today' : 'Mark done'}
              </button>
            </section>

            {/* stats */}
            <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Current streak', `${stats.cur}d`],
                ['Best streak', `${stats.best}d`],
                ['Last 28 days', `${stats.rate}%`],
                ['All time', stats.total],
              ].map(([l, v]) => (
                <div key={l} className="rounded-2xl border border-line bg-panel px-4 py-3 text-center">
                  <p className="font-display text-2xl text-glow">{v}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-widest text-mintdim">{l}</p>
                </div>
              ))}
            </section>

            {/* heatmap */}
            <section className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel p-4">
              <div className="flex gap-[3px]" role="grid" aria-label={`${active.name} activity heatmap`}>
                <div className="mr-1 flex flex-col justify-between py-[2px] text-[9px] text-mintdim">
                  {DOW.map((d, i) => <span key={d} className={i % 2 ? 'opacity-0 sm:opacity-40' : ''}>{d}</span>)}
                </div>
                {grid.map((col, ci) => (
                  <div key={ci} className="flex flex-col gap-[3px]">
                    {col.map((t) => {
                      const lvl = cellLevel(t)
                      const isToday = t === today
                      return (
                        <button
                          key={t}
                          disabled={lvl === -1}
                          onClick={() => toggle(active.id, t)}
                          title={`${new Date(t).toDateString()} - ${lvl > 0 ? 'done' : lvl === 0 ? 'missed - click to fix' : ''}`}
                          className={`h-[13px] w-[13px] rounded-[3px] transition sm:h-[15px] sm:w-[15px] ${
                            lvl === -1 ? 'cursor-default bg-transparent' : 'hover:ring-1 hover:ring-glow'
                          } ${isToday ? 'ring-1 ring-glow' : ''}`}
                          style={lvl >= 0 ? { background: lvl === 0 ? PALETTE[0] : PALETTE[3] } : {}}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-mintdim">
                <span>Weeks start Saturday. Click any past day to correct the record.</span>
                <span className="flex items-center gap-1">
                  less
                  {[0, 3].map((l) => <span key={l} className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: PALETTE[l === 0 ? 0 : 3] }} />)}
                  more
                </span>
              </div>
            </section>

            {/* rhythm */}
            <section className="mt-4 rounded-2xl border border-line bg-panel p-4">
              <p className="text-[11px] uppercase tracking-widest text-mintdim">Weekly rhythm - which days you actually show up</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                  const pct = stats.totals[i] ? Math.round((stats.rhythm[i] / stats.totals[i]) * 100) : 0
                  return (
                    <div key={d} className="flex flex-1 flex-col items-center gap-1">
                      <span className="font-display text-xs text-glow">{pct}%</span>
                      <div className="flex h-20 w-full items-end rounded bg-deep/60">
                        <div className="w-full rounded transition-all" style={{ height: `${Math.max(pct, 3)}%`, background: PALETTE[3] }} />
                      </div>
                      <span className="text-[10px] text-mintdim">{d}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mx-auto max-w-4xl px-4 pb-8 text-center text-[11px] text-mintdim sm:px-6">
        Everything lives in your browser's localStorage - no account, no server. Deleting a habit deletes its history.
      </footer>
    </div>
  )
}
