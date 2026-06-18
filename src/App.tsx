import { useEffect, useMemo, useState, type ReactNode, type TouchEvent } from 'react'
import { ArrowLeft, FolderKanban, Home, Lightbulb, MoveRight, Settings, Trash2 } from 'lucide-react'
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

  useEffect(() => {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  const counts = useMemo(
    () => ({ ideas: state.ideas.length, projects: state.projects.length }),
    [state.ideas.length, state.projects.length],
  )

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="icon-button" onClick={() => setPage(page === 'home' ? 'home' : 'home')}>
          {page === 'home' ? <Lightbulb size={20} /> : <ArrowLeft size={20} />}
        </button>
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
        <p className="hero-mark">💡</p>
        <h2>Make ideas reality</h2>
        <p>
          Catch ideas when they hit, keep them readable, and move the best ones into projects without turning the app into a mess.
        </p>
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
