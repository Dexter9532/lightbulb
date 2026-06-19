import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, FolderKanban, Home, ImagePlus, Lightbulb, MoveLeft, MoveRight, Plus, RefreshCw, Settings, Trash2 } from 'lucide-react'
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

type ReleaseOption = {
  tag: string
  name: string
  apkUrl: string
}

const REPO_OWNER = 'Dexter9532'
const REPO_NAME = 'lightbulb'
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
  const detailIdea = detailTarget ? state[detailTarget.kind].find((idea) => idea.id === detailTarget.id) ?? null : null

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

  const runUpdate = () => {
    if (!selectedRelease) return
    window.open(selectedRelease.apkUrl, '_blank', 'noopener,noreferrer')
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
              <span>Latest: {latestRelease?.tag ?? 'none'}</span>
            </div>

            {selectedRelease ? <p className="helper-text">Selected release: {selectedRelease.name}</p> : null}
            {releaseStatus === 'loading' ? <p className="helper-text">Loading releases...</p> : null}
            {releaseMessage ? <p className="helper-text">{releaseMessage}</p> : null}
            <p className="helper-text">Updates should keep your app data. Uninstalling the app would remove local data.</p>
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
    const parsedElements = (elementsBlockMatch?.[1] ?? '')
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)

    onUpdate((current) => ({
      ...current,
      title: parsedTitle,
      summary: parsedDescription,
      elements: parsedElements.length > 0
        ? parsedElements.map((title, index) => current.elements[index]
          ? { ...current.elements[index], title: current.elements[index].title || title }
          : { id: newId(), title, note: '' })
        : current.elements,
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
          placeholder={"Title:\n\nDescription:\n\nElements:\n- element one\n- element two"}
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
