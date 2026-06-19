import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Download, FolderKanban, Home, ImagePlus, Lightbulb, MoveLeft, MoveRight, Plus, Settings, Trash2, Upload } from 'lucide-react'
import { APP_VERSION } from './version'
import './App.css'

type ThemeMode = 'system' | 'red-white' | 'red-black'
type Page = 'home' | 'ideas' | 'projects' | 'settings'
type IdeaListKind = 'ideas' | 'projects'

type IdeaElement = {
  id: string
  title: string
  note: string
}

type IdeaImage = {
  id: string
  name: string
  dataUrl: string
}

type Idea = {
  id: string
  title: string
  summary: string
  rating: number
  notes: string
  elements: IdeaElement[]
  images: IdeaImage[]
  createdAt: string
  updatedAt: string
}

type AppState = {
  ideas: Idea[]
  projects: Idea[]
}

const APP_STORAGE_KEY = 'lightbulb-simple-v4'
const THEME_STORAGE_KEY = 'lightbulb-theme-v1'

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

const createIdeaRecord = (title: string, summary: string): Idea => ({
  id: newId(),
  title: title.trim(),
  summary: summary.trim(),
  rating: 5,
  notes: '',
  elements: [],
  images: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const sortIdeasByRating = (ideas: Idea[]) =>
  [...ideas].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

const getRatingTone = (rating: number) => {
  if (rating <= 3) return 'rating-bad'
  if (rating <= 5) return 'rating-mid'
  if (rating <= 7) return 'rating-good'
  return 'rating-great'
}

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
  const [ideaSummary, setIdeaSummary] = useState('')
  const [detailTarget, setDetailTarget] = useState<{ kind: IdeaListKind; id: string } | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

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
  const detailIdea = detailTarget ? state[detailTarget.kind].find((idea) => idea.id === detailTarget.id) ?? null : null

  const createIdea = () => {
    if (!ideaTitle.trim()) return

    const idea = createIdeaRecord(ideaTitle, ideaSummary)
    setState((current) => ({
      ...current,
      ideas: sortIdeasByRating([idea, ...current.ideas]),
    }))
    setIdeaTitle('')
    setIdeaSummary('')
  }

  const updateIdea = (kind: IdeaListKind, ideaId: string, updater: (idea: Idea) => Idea) => {
    setState((current) => ({
      ...current,
      [kind]: sortIdeasByRating(
        current[kind].map((idea) =>
          idea.id === ideaId ? { ...updater(idea), updatedAt: new Date().toISOString() } : idea,
        ),
      ),
    }))
  }

  const deleteIdea = (list: IdeaListKind, ideaId: string) => {
    setState((current) => ({
      ...current,
      [list]: current[list].filter((idea) => idea.id !== ideaId),
    }))

    setDetailTarget((current) => (current?.id === ideaId ? null : current))
  }

  const moveIdea = (from: IdeaListKind, to: IdeaListKind, ideaId: string) => {
    if (from === to) return

    setState((current) => {
      const item = current[from].find((idea) => idea.id === ideaId)
      if (!item) return current

      return {
        ...current,
        [from]: current[from].filter((idea) => idea.id !== ideaId),
        [to]: sortIdeasByRating([{ ...item, updatedAt: new Date().toISOString() }, ...current[to]]),
      }
    })

    setDetailTarget({ kind: to, id: ideaId })
  }

  const exportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      data: state,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `lightbulb-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setBackupMessage('Backup exported.')
  }

  const importBackup = async (file: File | null) => {
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as { data?: AppState } | AppState
      const importedState: AppState =
        typeof parsed === 'object' && parsed !== null && 'data' in parsed && parsed.data
          ? parsed.data
          : (parsed as AppState)

      if (!importedState || !Array.isArray(importedState.ideas) || !Array.isArray(importedState.projects)) {
        throw new Error('Invalid backup file')
      }

      setState({
        ideas: sortIdeasByRating(importedState.ideas),
        projects: sortIdeasByRating(importedState.projects),
      })
      setBackupMessage('Backup imported.')
    } catch {
      setBackupMessage('Could not import that backup file.')
    }
  }

  const openLatestRelease = () => {
    window.open('https://github.com/Dexter9532/lightbulb/releases/latest', '_blank', 'noopener,noreferrer')
  }

  const onBack = () => {
    if (detailTarget) {
      setDetailTarget(null)
      return
    }

    setPage('home')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        {page === 'home' && !detailTarget ? (
          <div className="icon-button static-icon">
            <Lightbulb size={20} />
          </div>
        ) : (
          <button type="button" className="icon-button" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="topbar-copy">
          <p className="brand">Lightbulb</p>
          <h1>
            {detailTarget && detailIdea
              ? detailIdea.title
              : page === 'home'
                ? 'Make ideas reality'
                : page[0].toUpperCase() + page.slice(1)}
          </h1>
        </div>
        <button type="button" className="icon-button" onClick={() => setPage('settings')}>
          <Settings size={20} />
        </button>
      </header>

      {detailTarget && detailIdea ? (
        <IdeaDetailPage
          idea={detailIdea}
          kind={detailTarget.kind}
          onUpdate={(updater) => updateIdea(detailTarget.kind, detailTarget.id, updater)}
          onMove={() => moveIdea(detailTarget.kind, detailTarget.kind === 'ideas' ? 'projects' : 'ideas', detailTarget.id)}
          onDelete={() => deleteIdea(detailTarget.kind, detailTarget.id)}
        />
      ) : null}

      {!detailTarget && page === 'home' ? (
        <HomePage counts={counts} onOpenIdeas={() => setPage('ideas')} onOpenProjects={() => setPage('projects')} />
      ) : null}

      {!detailTarget && page === 'ideas' ? (
        <section className="page-stack">
          <article className="panel composer-panel">
            <div className="section-copy">
              <h2>New idea</h2>
              <p>Add the name first, then open it and build it out.</p>
            </div>
            <input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Idea name" />
            <textarea
              value={ideaSummary}
              onChange={(event) => setIdeaSummary(event.target.value)}
              placeholder="Short summary"
              rows={3}
            />
            <button type="button" className="primary-button" onClick={createIdea}>
              Add idea
            </button>
          </article>

          <section className="page-stack">
            <div className="section-copy compact">
              <h2>Ideas</h2>
              <p>Highest-rated ideas stay at the top.</p>
            </div>
            <IdeaBoard
              items={state.ideas}
              emptyText="No ideas yet. Add one above."
              onOpen={(ideaId) => setDetailTarget({ kind: 'ideas', id: ideaId })}
              onDelete={(ideaId) => deleteIdea('ideas', ideaId)}
              onMove={(ideaId) => moveIdea('ideas', 'projects', ideaId)}
              moveLabel="Move to projects"
              moveIcon={<MoveRight size={14} />}
            />
          </section>
        </section>
      ) : null}

      {!detailTarget && page === 'projects' ? (
        <section className="page-stack">
          <div className="section-copy compact">
            <h2>Projects</h2>
            <p>Best-rated ideas stay at the top here too.</p>
          </div>
          <IdeaBoard
            items={state.projects}
            emptyText="No project ideas yet. Move some over from Ideas."
            onOpen={(ideaId) => setDetailTarget({ kind: 'projects', id: ideaId })}
            onDelete={(ideaId) => deleteIdea('projects', ideaId)}
            onMove={(ideaId) => moveIdea('projects', 'ideas', ideaId)}
            moveLabel="Move back to ideas"
            moveIcon={<MoveLeft size={14} />}
          />
        </section>
      ) : null}

      {!detailTarget && page === 'settings' ? (
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
              <h2>How to update</h2>
              <p>Current version: {APP_VERSION}</p>
            </div>

            <ol className="tutorial-steps">
              <li>Export your backup first.</li>
              <li>Press Update app to open the latest release on GitHub.</li>
              <li>Install the new APK. If Android blocks it, delete the old app first.</li>
              <li>Import your backup again after installing.</li>
            </ol>

            <div className="update-row backup-row">
              <button type="button" className="small-button" onClick={exportBackup}>
                <Download size={14} />
                Export backup
              </button>
              <button type="button" className="small-button" onClick={openLatestRelease}>
                Update app
              </button>
              <button type="button" className="small-button" onClick={() => importInputRef.current?.click()}>
                <Upload size={14} />
                Import backup
              </button>
              <button type="button" className="small-button" onClick={openLatestRelease}>
                Go to GitHub latest
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden-input"
                onChange={(event) => void importBackup(event.target.files?.[0] ?? null)}
              />
            </div>

            {backupMessage ? <p className="helper-text">{backupMessage}</p> : null}
            <p className="helper-text">Use the backup first. Then update, install the APK, and import the data again if Android makes you start over.</p>
          </article>
        </section>
      ) : null}

      {!detailTarget ? (
        <nav className="bottom-nav">
          <NavButton icon={<Home size={18} />} label="Home" active={page === 'home'} onClick={() => setPage('home')} />
          <NavButton icon={<Lightbulb size={18} />} label="Ideas" active={page === 'ideas'} onClick={() => setPage('ideas')} />
          <NavButton icon={<FolderKanban size={18} />} label="Projects" active={page === 'projects'} onClick={() => setPage('projects')} />
        </nav>
      ) : null}
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
    <section className="page-stack home-stack">
      <div className="home-bulb">
        <Lightbulb size={88} strokeWidth={1.8} />
      </div>

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
  onOpen,
  onDelete,
  onMove,
  moveLabel,
  moveIcon,
}: {
  items: Idea[]
  emptyText: string
  onOpen: (ideaId: string) => void
  onDelete: (ideaId: string) => void
  onMove: (ideaId: string) => void
  moveLabel: string
  moveIcon: ReactNode
}) {
  if (items.length === 0) {
    return <article className="panel empty-panel">{emptyText}</article>
  }

  return (
    <div className="idea-list">
      {sortIdeasByRating(items).map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onOpen={() => onOpen(idea.id)}
          onDelete={() => onDelete(idea.id)}
          onMove={() => onMove(idea.id)}
          moveLabel={moveLabel}
          moveIcon={moveIcon}
        />
      ))}
    </div>
  )
}

function IdeaCard({
  idea,
  onOpen,
  onDelete,
  onMove,
  moveLabel,
  moveIcon,
}: {
  idea: Idea
  onOpen: () => void
  onDelete: () => void
  onMove: () => void
  moveLabel: string
  moveIcon: ReactNode
}) {
  return (
    <article className={`idea-card-plain ${getRatingTone(idea.rating)}`}>
      <div className="idea-card-top">
        <h3>{idea.title}</h3>
        <span className="rating-pill">{idea.rating}/10</span>
      </div>

      <div className="idea-card-actions">
        <button type="button" className="card-action-button" onClick={onOpen}>
          Edit
        </button>
        <button type="button" className="card-action-button" onClick={onMove}>
          {moveIcon}
          {moveLabel}
        </button>
        <button type="button" className="card-action-button danger-text" onClick={onDelete}>
          Discard
        </button>
      </div>
    </article>
  )
}

function IdeaDetailPage({
  idea,
  kind,
  onUpdate,
  onMove,
  onDelete,
}: {
  idea: Idea
  kind: IdeaListKind
  onUpdate: (updater: (idea: Idea) => Idea) => void
  onMove: () => void
  onDelete: () => void
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [aiDraft, setAiDraft] = useState('')

  const addElement = () => {
    onUpdate((current) => ({
      ...current,
      elements: [...current.elements, { id: newId(), title: '', note: '' }],
    }))
  }

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const items = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<IdeaImage>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              if (typeof reader.result !== 'string') {
                reject(new Error('Could not read image'))
                return
              }

              resolve({ id: newId(), name: file.name, dataUrl: reader.result })
            }
            reader.onerror = () => reject(new Error('Could not read image'))
            reader.readAsDataURL(file)
          }),
      ),
    )

    onUpdate((current) => ({
      ...current,
      images: [...current.images, ...items],
    }))
  }

  const buildAiTemplate = () => {
    const elementLines = idea.elements.length > 0
      ? idea.elements.map((element) => `- ${element.title || 'Element name'}`).join('\n')
      : '- '

    return `Title: ${idea.title}\n\nDescription: ${idea.summary || idea.notes || ''}\n\nElements:\n${elementLines}`
  }

  const parseAiElements = (input: string) => {
    const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    return lines
      .map((line, index) => {
        const cleaned = line.replace(/^[-*•]\s*/, '')
        const withoutOpen = cleaned.startsWith('{') || cleaned.startsWith('[') ? cleaned.slice(1).trimStart() : cleaned
        const final = withoutOpen.endsWith('}') || withoutOpen.endsWith(']') ? withoutOpen.slice(0, -1).trimEnd() : withoutOpen
        const numberedMatch = final.match(/^(?:element\s*)?(\d+)[:.)-]\s*(.+)$/i)
        const colonMatch = final.match(/^(.+?):\s*(.+)$/)

        if (numberedMatch) {
          return {
            id: newId(),
            title: numberedMatch[2].trim() || `Element ${numberedMatch[1]}`,
            note: `Element ${numberedMatch[1]}`,
          }
        }

        if (colonMatch) {
          return {
            id: newId(),
            title: colonMatch[1].trim(),
            note: colonMatch[2].trim(),
          }
        }

        return {
          id: newId(),
          title: final,
          note: `Element ${index + 1}`,
        }
      })
  }

  const copyAiTemplate = async () => {
    const template = buildAiTemplate()

    try {
      await navigator.clipboard.writeText(template)
      setAiDraft(template)
    } catch {
      setAiDraft(template)
    }
  }

  const importAiDraft = () => {
    const titleMatch = aiDraft.match(/Title:\s*(.*)/i)
    const descriptionMatch = aiDraft.match(/Description:\s*([\s\S]*?)(?:\n\s*Elements:|$)/i)
    const elementsBlockMatch = aiDraft.match(/Elements:\s*([\s\S]*)$/i)

    const parsedTitle = titleMatch?.[1]?.trim() ?? idea.title
    const parsedDescription = descriptionMatch?.[1]?.trim() ?? idea.summary
    const parsedElements = parseAiElements(elementsBlockMatch?.[1] ?? '')

    onUpdate((current) => ({
      ...current,
      title: parsedTitle,
      summary: parsedDescription,
      elements: parsedElements.length > 0 ? parsedElements : current.elements,
    }))
  }

  return (
    <section className="page-stack detail-stack">
      <article className="panel detail-panel">
        <div className="section-copy compact">
          <h2>Idea name</h2>
        </div>
        <input value={idea.title} onChange={(event) => onUpdate((current) => ({ ...current, title: event.target.value }))} />

        <div className="section-copy compact">
          <h2>Rating</h2>
          <p>Rate this idea from 1 to 10.</p>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={idea.rating}
          onChange={(event) => onUpdate((current) => ({ ...current, rating: Number(event.target.value) }))}
        />
        <div className="rating-detail-row">
          <span className={`rating-pill ${getRatingTone(idea.rating)}`}>{idea.rating}/10</span>
        </div>

        <div className="section-copy compact">
          <h2>Short summary</h2>
        </div>
        <textarea
          rows={3}
          value={idea.summary}
          onChange={(event) => onUpdate((current) => ({ ...current, summary: event.target.value }))}
          placeholder="What is this idea about?"
        />

        <div className="section-copy compact">
          <h2>Notes</h2>
        </div>
        <textarea
          rows={6}
          value={idea.notes}
          onChange={(event) => onUpdate((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Write all your notes here"
        />
      </article>

      <article className="panel detail-panel">
        <div className="detail-header-row">
          <div className="section-copy compact">
            <h2>AI helper</h2>
            <p>Copy a clean template, talk to AI, then paste the result back here.</p>
          </div>
          <button type="button" className="tiny-button" onClick={() => void copyAiTemplate()}>
            Copy template
          </button>
        </div>

        <textarea
          rows={8}
          value={aiDraft}
          onChange={(event) => setAiDraft(event.target.value)}
          placeholder={"Title: My idea\n\nDescription: What it does\n\nElements:\n1. First element: what it means\n2. Second element: more detail"}
        />

        <div className="detail-actions-panel single-row-actions">
          <button type="button" className="small-button" onClick={importAiDraft}>
            Import AI result
          </button>
        </div>
      </article>

      <article className="panel detail-panel">
        <div className="detail-header-row">
          <div className="section-copy compact">
            <h2>Elements</h2>
            <p>Add your own pieces inside the idea.</p>
          </div>
          <button type="button" className="tiny-button" onClick={addElement}>
            <Plus size={14} />
            Add
          </button>
        </div>

        <div className="element-list">
          {idea.elements.length === 0 ? <p className="helper-text">No elements yet.</p> : null}
          {idea.elements.map((element) => (
            <div key={element.id} className="element-card">
              <input
                value={element.title}
                onChange={(event) =>
                  onUpdate((current) => ({
                    ...current,
                    elements: current.elements.map((item) =>
                      item.id === element.id ? { ...item, title: event.target.value } : item,
                    ),
                  }))
                }
                placeholder="Element name"
              />
              <textarea
                rows={3}
                value={element.note}
                onChange={(event) =>
                  onUpdate((current) => ({
                    ...current,
                    elements: current.elements.map((item) =>
                      item.id === element.id ? { ...item, note: event.target.value } : item,
                    ),
                  }))
                }
                placeholder="Element notes"
              />
              <button
                type="button"
                className="ghost-action danger align-self-end"
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    elements: current.elements.filter((item) => item.id !== element.id),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </article>

      <article className="panel detail-panel">
        <div className="detail-header-row">
          <div className="section-copy compact">
            <h2>Images</h2>
            <p>Add images to this idea.</p>
          </div>
          <button type="button" className="tiny-button" onClick={() => imageInputRef.current?.click()}>
            <ImagePlus size={14} />
            Add image
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden-input"
            onChange={(event) => void handleImageFiles(event.target.files)}
          />
        </div>

        {idea.images.length === 0 ? <p className="helper-text">No images yet.</p> : null}
        <div className="image-grid">
          {idea.images.map((image) => (
            <div key={image.id} className="image-card">
              <img src={image.dataUrl} alt={image.name} />
              <div className="image-card-footer">
                <span>{image.name}</span>
                <button
                  type="button"
                  className="ghost-action danger"
                  onClick={() =>
                    onUpdate((current) => ({
                      ...current,
                      images: current.images.filter((item) => item.id !== image.id),
                    }))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel detail-panel detail-actions-panel">
        <button type="button" className="small-button" onClick={onMove}>
          {kind === 'ideas' ? 'Move to projects' : 'Move back to ideas'}
        </button>
        <button type="button" className="small-button danger-button" onClick={onDelete}>
          Discard idea
        </button>
      </article>
    </section>
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
