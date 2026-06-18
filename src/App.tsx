import { useEffect, useMemo, useState, type ReactNode, type TouchEvent } from 'react'
import { ArrowLeft, FolderKanban, Home, Lightbulb, MoveRight, RefreshCw, Settings, Trash2 } from 'lucide-react'
import './App.css'

type Page = 'home' | 'ideas' | 'projects' | 'settings'
type ThemeMode = 'system' | 'red-white' | 'red-black'

type Idea = {
  id: string
  title: string
  note: string
  createdAt: string
}

type AppState = {
  ideas: Idea[]
  projects: Idea[]
}

type ReleaseOption = {
  tag: string
  name: string
  apkUrl: string
}

const APP_VERSION = '0.2.1'
const REPO_OWNER = 'Dexter9532'
const REPO_NAME = 'lightbulb'
const APP_STORAGE_KEY = 'lightbulb-simple-v2'
const THEME_STORAGE_KEY = 'lightbulb-theme-v1'
const SWIPE_THRESHOLD = 90

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const emptyState = (): AppState => ({
  ideas: [],
  projects: [],
})

function App() {
  const [page, setPage] = useState<Page>('home')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? 'system'
  })
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(APP_STORAGE_KEY)
    if (!saved) return emptyState()

    try {
      return JSON.parse(saved) as AppState
    } catch {
      return emptyState()
    }
  })
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaNote, setIdeaNote] = useState('')
  const [releases, setReleases] = useState<ReleaseOption[]>([])
  const [selectedTag, setSelectedTag] = useState('')
  const [releaseStatus, setReleaseStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [releaseMessage, setReleaseMessage] = useState('')

  useEffect(() => {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  useEffect(() => {
    void loadReleases()
  }, [])

  const counts = useMemo(
    () => ({ ideas: state.ideas.length, projects: state.projects.length }),
    [state.ideas.length, state.projects.length],
  )

  const selectedRelease = releases.find((release) => release.tag === selectedTag) ?? null
  const latestRelease = releases[0] ?? null

  async function loadReleases() {
    setReleaseStatus('loading')
    setReleaseMessage('')

    try {
      const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`)
      if (!response.ok) {
        throw new Error(`GitHub returned ${response.status}`)
      }

      const data = (await response.json()) as Array<{
        tag_name: string
        name: string | null
        draft: boolean
        prerelease: boolean
        assets: Array<{ name: string; browser_download_url: string }>
      }>

      const nextReleases = data
        .filter((release) => !release.draft && !release.prerelease)
        .map((release) => {
          const apkAsset = release.assets.find((asset) => asset.name.endsWith('.apk'))
          if (!apkAsset) return null

          return {
            tag: release.tag_name,
            name: release.name || release.tag_name,
            apkUrl: apkAsset.browser_download_url,
          } satisfies ReleaseOption
        })
        .filter((release): release is ReleaseOption => release !== null)

      setReleases(nextReleases)
      setSelectedTag((current) => current || nextReleases[0]?.tag || '')
      setReleaseStatus('ready')

      if (nextReleases.length === 0) {
        setReleaseMessage('No APK releases found yet.')
      }
    } catch {
      setReleaseStatus('error')
      setReleaseMessage('Could not load releases right now.')
    }
  }

  const createIdea = () => {
    if (!ideaTitle.trim()) return

    const idea: Idea = {
      id: newId(),
      title: ideaTitle.trim(),
      note: ideaNote.trim(),
      createdAt: new Date().toISOString(),
    }

    setState((current) => ({
      ...current,
      ideas: [idea, ...current.ideas],
    }))
    setIdeaTitle('')
    setIdeaNote('')
  }

  const deleteIdea = (list: 'ideas' | 'projects', ideaId: string) => {
    setState((current) => ({
      ...current,
      [list]: current[list].filter((idea) => idea.id !== ideaId),
    }))
  }

  const moveIdea = (from: 'ideas' | 'projects', to: 'ideas' | 'projects', ideaId: string) => {
    if (from === to) return

    setState((current) => {
      const item = current[from].find((idea) => idea.id === ideaId)
      if (!item) return current

      return {
        ...current,
        [from]: current[from].filter((idea) => idea.id !== ideaId),
        [to]: [item, ...current[to]],
      }
    })
  }

  const runUpdate = () => {
    if (!selectedRelease) return
    window.open(selectedRelease.apkUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="icon-button static-icon">
          {page === 'home' ? <Lightbulb size={20} /> : <ArrowLeft size={20} />}
        </div>
        <div className="topbar-copy">
          <p className="brand">Lightbulb</p>
          <h1>{page === 'home' ? 'Make ideas reality' : page[0].toUpperCase() + page.slice(1)}</h1>
        </div>
        <button type="button" className="icon-button" onClick={() => setPage('settings')}>
          <Settings size={20} />
        </button>
      </header>

      {page === 'home' ? (
        <HomePage counts={counts} onOpenIdeas={() => setPage('ideas')} onOpenProjects={() => setPage('projects')} />
      ) : null}

      {page === 'ideas' ? (
        <section className="page-stack">
          <article className="panel composer-panel">
            <div className="section-copy">
              <h2>New idea</h2>
              <p>Write it fast, clean it up later.</p>
            </div>
            <input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Idea title" />
            <textarea
              value={ideaNote}
              onChange={(event) => setIdeaNote(event.target.value)}
              placeholder="Short note or brain dump"
              rows={4}
            />
            <button type="button" className="primary-button" onClick={createIdea}>
              Save idea
            </button>
          </article>

          <section className="page-stack">
            <div className="section-copy compact">
              <h2>Ideas</h2>
              <p>Swipe left to delete, swipe right to move to projects.</p>
            </div>
            <IdeaBoard
              items={state.ideas}
              emptyText="No ideas yet. Add one above."
              onDelete={(ideaId) => deleteIdea('ideas', ideaId)}
              onMoveRight={(ideaId) => moveIdea('ideas', 'projects', ideaId)}
              moveRightLabel="Move to projects"
            />
          </section>
        </section>
      ) : null}

      {page === 'projects' ? (
        <section className="page-stack">
          <div className="section-copy compact">
            <h2>Projects</h2>
            <p>Your moved ideas live here. Swipe left to delete, swipe right to move back to ideas.</p>
          </div>
          <IdeaBoard
            items={state.projects}
            emptyText="No project ideas yet. Move some over from Ideas."
            onDelete={(ideaId) => deleteIdea('projects', ideaId)}
            onMoveRight={(ideaId) => moveIdea('projects', 'ideas', ideaId)}
            moveRightLabel="Move back to ideas"
          />
        </section>
      ) : null}

      {page === 'settings' ? (
        <section className="page-stack">
          <article className="panel settings-panel">
            <div className="section-copy compact">
              <h2>Theme</h2>
              <p>Pick the look you want for the app.</p>
            </div>
            <div className="theme-options">
              <ThemeButton label="System" value="system" selected={themeMode === 'system'} onSelect={setThemeMode} />
              <ThemeButton label="Red and white" value="red-white" selected={themeMode === 'red-white'} onSelect={setThemeMode} />
              <ThemeButton label="Red and black" value="red-black" selected={themeMode === 'red-black'} onSelect={setThemeMode} />
            </div>
          </article>

          <article className="panel settings-panel">
            <div className="section-copy compact">
              <h2>App update</h2>
              <p>Current version: {APP_VERSION}</p>
            </div>

            <div className="update-row">
              <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} disabled={releases.length === 0}>
                {releases.length === 0 ? <option value="">No releases</option> : null}
                {releases.map((release) => (
                  <option key={release.tag} value={release.tag}>
                    {release.tag}
                  </option>
                ))}
              </select>
              <button type="button" className="small-button" onClick={runUpdate} disabled={!selectedRelease}>
                Update
              </button>
            </div>

            <div className="update-meta-row">
              <button type="button" className="tiny-button" onClick={() => void loadReleases()}>
                <RefreshCw size={14} />
                Refresh
              </button>
              <span>
                Latest: {latestRelease?.tag ?? 'none'}
              </span>
            </div>

            {selectedRelease ? <p className="helper-text">Selected release: {selectedRelease.name}</p> : null}
            {releaseStatus === 'loading' ? <p className="helper-text">Loading releases...</p> : null}
            {releaseMessage ? <p className="helper-text">{releaseMessage}</p> : null}
            <p className="helper-text">Pressing update downloads the APK from the selected GitHub release tag.</p>
          </article>
        </section>
      ) : null}

      <nav className="bottom-nav">
        <NavButton icon={<Home size={18} />} label="Home" active={page === 'home'} onClick={() => setPage('home')} />
        <NavButton icon={<Lightbulb size={18} />} label="Ideas" active={page === 'ideas'} onClick={() => setPage('ideas')} />
        <NavButton icon={<FolderKanban size={18} />} label="Projects" active={page === 'projects'} onClick={() => setPage('projects')} />
      </nav>
    </div>
  )
}

function HomePage({
  counts,
  onOpenIdeas,
  onOpenProjects,
}: {
  counts: { ideas: number; projects: number }
  onOpenIdeas: () => void
  onOpenProjects: () => void
}) {
  return (
    <section className="page-stack">
      <article className="hero-card panel">
        <Lightbulb size={72} strokeWidth={1.8} />
      </article>

      <div className="home-grid">
        <button type="button" className="home-box panel" onClick={onOpenIdeas}>
          <Lightbulb size={28} />
          <span>Ideas</span>
          <strong>{counts.ideas}</strong>
        </button>
        <button type="button" className="home-box panel" onClick={onOpenProjects}>
          <FolderKanban size={28} />
          <span>Projects</span>
          <strong>{counts.projects}</strong>
        </button>
      </div>
    </section>
  )
}

function IdeaBoard({
  items,
  emptyText,
  onDelete,
  onMoveRight,
  moveRightLabel,
}: {
  items: Idea[]
  emptyText: string
  onDelete: (ideaId: string) => void
  onMoveRight: (ideaId: string) => void
  moveRightLabel: string
}) {
  if (items.length === 0) {
    return <article className="panel empty-panel">{emptyText}</article>
  }

  return (
    <div className="idea-list">
      {items.map((idea) => (
        <SwipeIdeaCard
          key={idea.id}
          idea={idea}
          onDelete={() => onDelete(idea.id)}
          onMoveRight={() => onMoveRight(idea.id)}
          moveRightLabel={moveRightLabel}
        />
      ))}
    </div>
  )
}

function SwipeIdeaCard({
  idea,
  onDelete,
  onMoveRight,
  moveRightLabel,
}: {
  idea: Idea
  onDelete: () => void
  onMoveRight: () => void
  moveRightLabel: string
}) {
  const [startX, setStartX] = useState<number | null>(null)
  const [deltaX, setDeltaX] = useState(0)

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setStartX(event.changedTouches[0].clientX)
  }

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (startX === null) return
    setDeltaX(event.changedTouches[0].clientX - startX)
  }

  const handleTouchEnd = () => {
    if (deltaX <= -SWIPE_THRESHOLD) {
      onDelete()
    } else if (deltaX >= SWIPE_THRESHOLD) {
      onMoveRight()
    }

    setStartX(null)
    setDeltaX(0)
  }

  return (
    <div className="swipe-shell">
      <div className="swipe-hint swipe-left">
        <Trash2 size={16} />
        <span>Delete</span>
      </div>
      <div className="swipe-hint swipe-right">
        <MoveRight size={16} />
        <span>{moveRightLabel}</span>
      </div>
      <article
        className="panel idea-card-simple"
        style={{ transform: `translateX(${Math.max(-120, Math.min(120, deltaX))}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="idea-copy">
          <h3>{idea.title}</h3>
          <p>{idea.note || 'No extra note yet.'}</p>
        </div>
        <div className="idea-actions">
          <button type="button" className="ghost-action danger" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
          <button type="button" className="ghost-action" onClick={onMoveRight}>
            <MoveRight size={16} />
          </button>
        </div>
      </article>
    </div>
  )
}

function ThemeButton({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string
  value: ThemeMode
  selected: boolean
  onSelect: (value: ThemeMode) => void
}) {
  return (
    <button type="button" className={`theme-button ${selected ? 'selected' : ''}`} onClick={() => onSelect(value)}>
      {label}
    </button>
  )
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

export default App
