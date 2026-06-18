import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { closestCenter, DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, CirclePlus, FolderKanban, GripVertical, Lightbulb, Link as LinkIcon, NotebookText, Package, Plus, Sparkles, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import './App.css'

type Segment = {
  id: string
  title: string
  description: string
  link: string
  reference: string
}

type Idea = {
  id: string
  title: string
  summary: string
  notes: string
  templateId: string
  components: string[]
  segments: Segment[]
  updatedAt: string
}

type Project = {
  id: string
  name: string
  description: string
  ideaIds: string[]
}

type BoardState = {
  ideas: Record<string, Idea>
  projects: Project[]
  inboxIdeaIds: string[]
  archiveIdeaIds: string[]
}

type IdeaForm = {
  title: string
  summary: string
  templateId: string
}

type Template = {
  id: string
  name: string
  description: string
  notes: string
  components: string[]
  segments: Omit<Segment, 'id'>[]
}

const STORAGE_KEY = 'lightbulb-board-v1'
const INBOX_ID = 'inbox'
const ARCHIVE_ID = 'archive'

const templates: Template[] = [
  {
    id: 'starter',
    name: 'Starter idea',
    description: 'Good for raw ideas you want to sharpen later.',
    notes: 'What sparked this idea? What feels promising? What would make it worth building?',
    components: ['Core concept'],
    segments: [
      {
        title: 'Problem',
        description: 'What problem or itch does this idea solve?',
        link: '',
        reference: '',
      },
      {
        title: 'Audience',
        description: 'Who is this for and why would they care?',
        link: '',
        reference: '',
      },
    ],
  },
  {
    id: 'product',
    name: 'Product concept',
    description: 'For turning an idea into a product or app.',
    notes: 'Write the user flow, the main value, the constraints, and the first shippable version.',
    components: ['Main feature', 'Supporting feature', 'First version'],
    segments: [
      {
        title: 'User flow',
        description: 'Describe the main path from opening the product to getting value.',
        link: '',
        reference: '',
      },
      {
        title: 'Risks',
        description: 'What might block this from working or being adopted?',
        link: '',
        reference: '',
      },
    ],
  },
  {
    id: 'research',
    name: 'Research stack',
    description: 'For ideas built from links, references, and notes.',
    notes: 'Capture what you have already learned, what still needs checking, and what references matter most.',
    components: ['Primary source', 'Open question'],
    segments: [
      {
        title: 'Reference trail',
        description: 'Save the strongest references and why they matter.',
        link: '',
        reference: '',
      },
      {
        title: 'Next probe',
        description: 'What should be researched or tested next?',
        link: '',
        reference: '',
      },
    ],
  },
]

const emptyBoard = (): BoardState => ({
  ideas: {},
  projects: [],
  inboxIdeaIds: [],
  archiveIdeaIds: [],
})

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const buildIdea = (form: IdeaForm): Idea => {
  const template = templates.find((entry) => entry.id === form.templateId) ?? templates[0]

  return {
    id: newId(),
    title: form.title.trim(),
    summary: form.summary.trim(),
    notes: template.notes,
    templateId: template.id,
    components: [...template.components],
    segments: template.segments.map((segment) => ({ ...segment, id: newId() })),
    updatedAt: new Date().toISOString(),
  }
}

const defaultIdeaForm: IdeaForm = {
  title: '',
  summary: '',
  templateId: templates[0].id,
}

const findIdeaContainer = (state: BoardState, itemId: string) => {
  if (state.inboxIdeaIds.includes(itemId)) return INBOX_ID
  if (state.archiveIdeaIds.includes(itemId)) return ARCHIVE_ID

  const project = state.projects.find((entry) => entry.ideaIds.includes(itemId))
  return project?.id ?? null
}

const getContainerIdeaIds = (state: BoardState, containerId: string) => {
  if (containerId === INBOX_ID) return state.inboxIdeaIds
  if (containerId === ARCHIVE_ID) return state.archiveIdeaIds
  return state.projects.find((project) => project.id === containerId)?.ideaIds ?? []
}

const setContainerIdeaIds = (state: BoardState, containerId: string, ideaIds: string[]) => {
  if (containerId === INBOX_ID) {
    return { ...state, inboxIdeaIds: ideaIds }
  }

  if (containerId === ARCHIVE_ID) {
    return { ...state, archiveIdeaIds: ideaIds }
  }

  return {
    ...state,
    projects: state.projects.map((project) =>
      project.id === containerId ? { ...project, ideaIds } : project,
    ),
  }
}

const moveIdeaBetweenContainers = (
  state: BoardState,
  fromContainer: string,
  toContainer: string,
  ideaId: string,
  targetIndex: number,
) => {
  const fromIdeas = getContainerIdeaIds(state, fromContainer)
  const toIdeas = getContainerIdeaIds(state, toContainer)

  const nextFrom = fromIdeas.filter((id) => id !== ideaId)
  const nextToBase = fromContainer === toContainer ? nextFrom : toIdeas.filter((id) => id !== ideaId)
  const safeIndex = Math.max(0, Math.min(targetIndex, nextToBase.length))
  const nextTo = [...nextToBase.slice(0, safeIndex), ideaId, ...nextToBase.slice(safeIndex)]

  let nextState = setContainerIdeaIds(state, fromContainer, nextFrom)
  nextState = setContainerIdeaIds(nextState, toContainer, nextTo)
  return nextState
}

function App() {
  const [board, setBoard] = useState<BoardState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return emptyBoard()

    try {
      const parsed = JSON.parse(saved) as BoardState
      return parsed
    } catch {
      return emptyBoard()
    }
  })
  const [ideaForm, setIdeaForm] = useState<IdeaForm>(defaultIdeaForm)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [expandedIdeaIds, setExpandedIdeaIds] = useState<string[]>([])
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
  }, [board])

  const template = useMemo(
    () => templates.find((entry) => entry.id === ideaForm.templateId) ?? templates[0],
    [ideaForm.templateId],
  )

  const createIdea = () => {
    if (!ideaForm.title.trim()) return

    const idea = buildIdea(ideaForm)
    setBoard((current) => ({
      ...current,
      ideas: { ...current.ideas, [idea.id]: idea },
      inboxIdeaIds: [idea.id, ...current.inboxIdeaIds],
    }))
    setExpandedIdeaIds((current) => [idea.id, ...current])
    setIdeaForm(defaultIdeaForm)
  }

  const createProject = () => {
    if (!projectName.trim()) return

    const project: Project = {
      id: newId(),
      name: projectName.trim(),
      description: projectDescription.trim(),
      ideaIds: [],
    }

    setBoard((current) => ({
      ...current,
      projects: [project, ...current.projects],
    }))
    setProjectName('')
    setProjectDescription('')
  }

  const updateIdea = (ideaId: string, updater: (idea: Idea) => Idea) => {
    setBoard((current) => ({
      ...current,
      ideas: {
        ...current.ideas,
        [ideaId]: { ...updater(current.ideas[ideaId]), updatedAt: new Date().toISOString() },
      },
    }))
  }

  const removeIdea = (ideaId: string) => {
    setBoard((current) => {
      const nextIdeas = { ...current.ideas }
      delete nextIdeas[ideaId]

      return {
        ideas: nextIdeas,
        projects: current.projects.map((project) => ({
          ...project,
          ideaIds: project.ideaIds.filter((id) => id !== ideaId),
        })),
        inboxIdeaIds: current.inboxIdeaIds.filter((id) => id !== ideaId),
        archiveIdeaIds: current.archiveIdeaIds.filter((id) => id !== ideaId),
      }
    })
    setExpandedIdeaIds((current) => current.filter((id) => id !== ideaId))
  }

  const removeProject = (projectId: string) => {
    setBoard((current) => {
      const project = current.projects.find((entry) => entry.id === projectId)
      if (!project) return current

      return {
        ...current,
        projects: current.projects.filter((entry) => entry.id !== projectId),
        inboxIdeaIds: [...project.ideaIds, ...current.inboxIdeaIds],
      }
    })
  }

  const toggleIdea = (ideaId: string) => {
    setExpandedIdeaIds((current) =>
      current.includes(ideaId) ? current.filter((id) => id !== ideaId) : [...current, ideaId],
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveIdeaId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) return

    setBoard((current) => {
      const fromContainer = findIdeaContainer(current, activeId)
      if (!fromContainer) return current

      const toContainer = [INBOX_ID, ARCHIVE_ID, ...current.projects.map((project) => project.id)].includes(overId)
        ? overId
        : findIdeaContainer(current, overId)

      if (!toContainer || fromContainer === toContainer) return current

      const destinationIds = getContainerIdeaIds(current, toContainer)
      const targetIndex = destinationIds.includes(overId) ? destinationIds.indexOf(overId) : destinationIds.length

      return moveIdeaBetweenContainers(current, fromContainer, toContainer, activeId, targetIndex)
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    setActiveIdeaId(null)
    if (!overId) return

    setBoard((current) => {
      const containerId = findIdeaContainer(current, activeId)
      if (!containerId) return current

      const sameContainerIds = getContainerIdeaIds(current, containerId)
      const overContainer = [INBOX_ID, ARCHIVE_ID, ...current.projects.map((project) => project.id)].includes(overId)
        ? overId
        : findIdeaContainer(current, overId)

      if (!overContainer) return current
      if (containerId !== overContainer) return current

      const oldIndex = sameContainerIds.indexOf(activeId)
      const newIndex = sameContainerIds.includes(overId) ? sameContainerIds.indexOf(overId) : sameContainerIds.length - 1
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return current

      return setContainerIdeaIds(current, containerId, arrayMove(sameContainerIds, oldIndex, newIndex))
    })
  }

  const ideaCount = Object.keys(board.ideas).length
  const projectIdeaCount = board.projects.reduce((sum, project) => sum + project.ideaIds.length, 0)

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Lightbulb</p>
          <h1>Turn ideas into projects without losing the messy middle.</h1>
          <p className="hero-copy">
            Capture ideas, structure them with lightweight templates, attach components and references, then drag them into live projects.
          </p>
        </div>
        <div className="hero-stats">
          <StatCard icon={<Lightbulb size={18} />} label="Ideas" value={ideaCount} />
          <StatCard icon={<FolderKanban size={18} />} label="Projects" value={board.projects.length} />
          <StatCard icon={<Sparkles size={18} />} label="Active in projects" value={projectIdeaCount} />
        </div>
      </header>

      <section className="composer-grid">
        <article className="panel form-panel">
          <div className="panel-title-row">
            <div>
              <h2>New idea</h2>
              <p>Start loose, then sharpen it later inside the card.</p>
            </div>
            <button type="button" className="primary-button" onClick={createIdea}>
              <CirclePlus size={18} />
              Create idea
            </button>
          </div>

          <label>
            Title
            <input
              value={ideaForm.title}
              onChange={(event) => setIdeaForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Idea title"
            />
          </label>

          <label>
            Quick summary
            <textarea
              value={ideaForm.summary}
              onChange={(event) => setIdeaForm((current) => ({ ...current, summary: event.target.value }))}
              placeholder="What is the idea in one or two lines?"
              rows={3}
            />
          </label>

          <label>
            Template
            <select
              value={ideaForm.templateId}
              onChange={(event) => setIdeaForm((current) => ({ ...current, templateId: event.target.value }))}
            >
              {templates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <div className="template-preview">
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <ul>
              {template.segments.map((segment) => (
                <li key={segment.title}>{segment.title}</li>
              ))}
            </ul>
          </div>
        </article>

        <article className="panel form-panel">
          <div className="panel-title-row">
            <div>
              <h2>New project</h2>
              <p>Create project buckets and drag ideas into them.</p>
            </div>
            <button type="button" className="secondary-button" onClick={createProject}>
              <Plus size={18} />
              Add project
            </button>
          </div>

          <label>
            Project name
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Project name"
            />
          </label>

          <label>
            Description
            <textarea
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="What is this project trying to achieve?"
              rows={4}
            />
          </label>

          <div className="tips-box">
            <h3>Suggested flow</h3>
            <ol>
              <li>Create raw ideas in the inbox.</li>
              <li>Use notes, components, and segments to shape them.</li>
              <li>Drag the strongest ideas into projects.</li>
              <li>Archive ideas when they are parked or done.</li>
            </ol>
          </div>
        </article>
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <section className="dashboard-grid">
          <BoardColumn title="Idea inbox" subtitle="Fresh ideas and early drafts" icon={<NotebookText size={18} />} containerId={INBOX_ID}>
            <IdeaList
              ideaIds={board.inboxIdeaIds}
              ideas={board.ideas}
              expandedIdeaIds={expandedIdeaIds}
              activeIdeaId={activeIdeaId}
              onToggleIdea={toggleIdea}
              onUpdateIdea={updateIdea}
              onRemoveIdea={removeIdea}
            />
          </BoardColumn>

          <section className="projects-stack">
            <div className="section-heading">
              <h2>Projects dashboard</h2>
              <p>Drag ideas into any project and reorder inside each one.</p>
            </div>
            {board.projects.length === 0 ? (
              <article className="empty-state">
                <FolderKanban size={22} />
                <p>No projects yet. Create one above and start dropping ideas into it.</p>
              </article>
            ) : (
              board.projects.map((project) => (
                <BoardColumn
                  key={project.id}
                  title={project.name}
                  subtitle={project.description || 'No description yet'}
                  icon={<FolderKanban size={18} />}
                  containerId={project.id}
                  action={
                    <button type="button" className="ghost-button danger" onClick={() => removeProject(project.id)}>
                      <Trash2 size={16} />
                    </button>
                  }
                >
                  <IdeaList
                    ideaIds={project.ideaIds}
                    ideas={board.ideas}
                    expandedIdeaIds={expandedIdeaIds}
                    activeIdeaId={activeIdeaId}
                    onToggleIdea={toggleIdea}
                    onUpdateIdea={updateIdea}
                    onRemoveIdea={removeIdea}
                  />
                </BoardColumn>
              ))
            )}
          </section>

          <BoardColumn title="Archive" subtitle="Ideas you want out of the way, not deleted" icon={<Archive size={18} />} containerId={ARCHIVE_ID}>
            <IdeaList
              ideaIds={board.archiveIdeaIds}
              ideas={board.ideas}
              expandedIdeaIds={expandedIdeaIds}
              activeIdeaId={activeIdeaId}
              onToggleIdea={toggleIdea}
              onUpdateIdea={updateIdea}
              onRemoveIdea={removeIdea}
            />
          </BoardColumn>
        </section>
      </DndContext>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function BoardColumn({
  title,
  subtitle,
  icon,
  containerId,
  action,
  children,
}: {
  title: string
  subtitle: string
  icon: ReactNode
  containerId: string
  action?: ReactNode
  children: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: containerId })

  return (
    <article ref={setNodeRef} className={clsx('panel board-column', isOver && 'droppable-over')}>
      <div className="column-header">
        <div>
          <div className="column-title">
            {icon}
            <h2>{title}</h2>
          </div>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </article>
  )
}

function IdeaList({
  ideaIds,
  ideas,
  expandedIdeaIds,
  activeIdeaId,
  onToggleIdea,
  onUpdateIdea,
  onRemoveIdea,
}: {
  ideaIds: string[]
  ideas: Record<string, Idea>
  expandedIdeaIds: string[]
  activeIdeaId: string | null
  onToggleIdea: (ideaId: string) => void
  onUpdateIdea: (ideaId: string, updater: (idea: Idea) => Idea) => void
  onRemoveIdea: (ideaId: string) => void
}) {
  if (ideaIds.length === 0) {
    return (
      <div className="empty-dropzone">
        <p>Drop ideas here.</p>
      </div>
    )
  }

  return (
    <SortableContext items={ideaIds} strategy={rectSortingStrategy}>
      <div className="idea-list">
        {ideaIds.map((ideaId) => {
          const idea = ideas[ideaId]
          if (!idea) return null

          return (
            <IdeaCard
              key={idea.id}
              idea={idea}
              expanded={expandedIdeaIds.includes(idea.id)}
              active={activeIdeaId === idea.id}
              onToggle={() => onToggleIdea(idea.id)}
              onUpdate={(updater) => onUpdateIdea(idea.id, updater)}
              onRemove={() => onRemoveIdea(idea.id)}
            />
          )
        })}
      </div>
    </SortableContext>
  )
}

function IdeaCard({
  idea,
  expanded,
  active,
  onToggle,
  onUpdate,
  onRemove,
}: {
  idea: Idea
  expanded: boolean
  active: boolean
  onToggle: () => void
  onUpdate: (updater: (idea: Idea) => Idea) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx('idea-card', expanded && 'expanded', active && 'active', isDragging && 'dragging')}
    >
      <div className="idea-card-header">
        <button type="button" className="drag-handle" aria-label="Drag idea" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <button type="button" className="idea-summary" onClick={onToggle}>
          <div>
            <h3>{idea.title || 'Untitled idea'}</h3>
            <p>{idea.summary || 'No summary yet'}</p>
          </div>
          <span className="badge">{templates.find((entry) => entry.id === idea.templateId)?.name ?? 'Custom'}</span>
        </button>
        <button type="button" className="ghost-button danger" onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </div>

      {expanded ? (
        <div className="idea-editor">
          <label>
            Title
            <input value={idea.title} onChange={(event) => onUpdate((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            Summary
            <textarea
              rows={2}
              value={idea.summary}
              onChange={(event) => onUpdate((current) => ({ ...current, summary: event.target.value }))}
            />
          </label>
          <label>
            Brainstorm notes
            <textarea
              rows={5}
              value={idea.notes}
              onChange={(event) => onUpdate((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <div className="subsection">
            <div className="subsection-header">
              <h4>
                <Package size={16} /> Components
              </h4>
              <button
                type="button"
                className="ghost-button"
                onClick={() => onUpdate((current) => ({ ...current, components: [...current.components, ''] }))}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            <div className="chip-list">
              {idea.components.map((component, index) => (
                <div key={`${idea.id}-component-${index}`} className="chip-input-row">
                  <input
                    value={component}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        components: current.components.map((entry, entryIndex) =>
                          entryIndex === index ? event.target.value : entry,
                        ),
                      }))
                    }
                    placeholder="Component"
                  />
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() =>
                      onUpdate((current) => ({
                        ...current,
                        components: current.components.filter((_, entryIndex) => entryIndex !== index),
                      }))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="subsection">
            <div className="subsection-header">
              <h4>
                <LinkIcon size={16} /> Segments and references
              </h4>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    segments: [
                      ...current.segments,
                      { id: newId(), title: '', description: '', link: '', reference: '' },
                    ],
                  }))
                }
              >
                <Plus size={14} />
                Add segment
              </button>
            </div>

            <div className="segment-list">
              {idea.segments.map((segment) => (
                <div key={segment.id} className="segment-card">
                  <div className="segment-card-header">
                    <input
                      value={segment.title}
                      onChange={(event) =>
                        onUpdate((current) => ({
                          ...current,
                          segments: current.segments.map((entry) =>
                            entry.id === segment.id ? { ...entry, title: event.target.value } : entry,
                          ),
                        }))
                      }
                      placeholder="Segment title"
                    />
                    <button
                      type="button"
                      className="ghost-button danger"
                      onClick={() =>
                        onUpdate((current) => ({
                          ...current,
                          segments: current.segments.filter((entry) => entry.id !== segment.id),
                        }))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={segment.description}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        segments: current.segments.map((entry) =>
                          entry.id === segment.id ? { ...entry, description: event.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Description"
                  />
                  <input
                    value={segment.link}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        segments: current.segments.map((entry) =>
                          entry.id === segment.id ? { ...entry, link: event.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Link"
                  />
                  <input
                    value={segment.reference}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        segments: current.segments.map((entry) =>
                          entry.id === segment.id ? { ...entry, reference: event.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Reference or note"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default App
