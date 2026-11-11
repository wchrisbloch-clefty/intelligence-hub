import { createContext, useContext, useState, useEffect } from 'react';
import { loadGraph, loadProjects, loadNotes, loadResearch, saveProjects, uid } from './utils.js';
import { CONTAINERS, containerOfMode } from './constants.js';
import { readLocal, writeThrough } from './lib/storage.js';
import { getTheme, applyTheme } from './theme.js';
import './save-to-project.css';
import './loading-screen.css';
import useViewport from './hooks/useViewport.js';
import TopBar from './modules/TopBar.jsx';
import ChatPanel from './modules/ChatPanel.jsx';
import { SideNav, BottomNav, ModeChips } from './modules/shared/ContainerNav.jsx';
import HomeDashboard from './modules/HomeDashboard.jsx';
import MobileHome from './modules/home/MobileHome.jsx';
import WhatsHappening from './modules/WhatsHappening.jsx';
import Notes from './modules/Notes.jsx';
import Recaps from './modules/Recaps.jsx';
import LearningCenter from './modules/LearningCenter.jsx';
import LearningLadder from './modules/LearningLadder.jsx';
import Academy from './modules/Academy.jsx';
import BookClub from './modules/BookClub.jsx';
import ResearchHub from './modules/ResearchHub.jsx';
import DeepDive from './modules/DeepDive.jsx';
import TranslatorHub from './modules/TranslatorHub.jsx';
import ProjectsOS from './modules/ProjectsOS.jsx';
import MasteryVault from './modules/MasteryVault.jsx';
import Skills from './modules/Skills.jsx';
import GrowthTools from './modules/GrowthTools.jsx';
import PodcastHub from './modules/PodcastHub.jsx';
import ContentInbox from './modules/ContentInbox.jsx';
import DecisionLog from './modules/DecisionLog.jsx';
import CreationStudio from './modules/CreationStudio.jsx';
import TEDHub from './modules/TEDHub.jsx';
import QuizCenter from './modules/QuizCenter.jsx';
import { DebugOverlay, dbgRender } from './modules/debug/index.jsx';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export default function App() {
  dbgRender('App');
  // ?mode=<moduleId> deep link (used by scripts/audit-responsive.mjs to reach every container).
  const [activeModule,     setActiveModuleRaw]  = useState(() => { try { return new URLSearchParams(location.search).get('mode') || 'home'; } catch { return 'home'; } });
  const [navModes,         setNavModes]         = useState(() => readLocal('aether_nav_v1', {}));
  const [chatOpen,         setChatOpen]         = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [chatPrefill,      setChatPrefill]      = useState('');
  const [chatAttach,       setChatAttach]       = useState(null); // { label } — what the chat is attached to

  const [graph,    setGraph]    = useState(null);
  const [projects, setProjects] = useState([]);
  const [notes,    setNotes]    = useState([]);
  const [research, setResearch] = useState([]);
  const [loaded,   setLoaded]   = useState(false);

  const [theme, setTheme] = useState(getTheme);
  const [pendingArtifact, setPendingArtifact] = useState(null);
  const [newChatNonce, setNewChatNonce] = useState(0); // bump → session-aware surfaces start fresh
  const [captureRoute, setCaptureRoute] = useState(null);   // last routed intent, consumed by target module
  const [focusCaptureNonce, setFocusCaptureNonce] = useState(0);
  const [studioSource, setStudioSource] = useState(null);   // { kind, id, title } handed to Creation Studio

  const { isMobile, isTablet, isPhone, isDesktop, isWide } = useViewport();

  useEffect(() => {
    applyTheme(theme); // sets data-theme + persists fr-theme + updates theme-color
  }, [theme]);

  useEffect(() => {
    Promise.all([loadGraph(), loadProjects(), loadNotes(), loadResearch()]).then(([g, p, n, r]) => {
      setGraph(g); setProjects(p); setNotes(n); setResearch(r); setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingScreen />;

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // Navigation. Modes and legacy module ids are the same strings, so every
  // existing setActiveModule('<moduleId>') deep-link still works. Two special
  // cases: 'coach' has no screen anymore — it opens the global Ask layer; and
  // each container remembers the last mode you were on inside it.
  const setActiveModule = (id) => {
    if (id === 'coach') { setChatOpen(true); return; }   // Coach → Ask layer
    setActiveModuleRaw(id);
    const container = containerOfMode(id);
    setNavModes(prev => {
      if (prev[container] === id) return prev;
      const next = { ...prev, [container]: id };
      writeThrough('aether_nav_v1', next);               // fire-and-forget; local write is optimistic
      return next;
    });
  };
  // Selecting a container jumps to its last-used mode (or its first).
  const openContainer = (containerId) => {
    const c = CONTAINERS.find(x => x.id === containerId);
    if (!c) return;
    const remembered = navModes[containerId];
    setActiveModule(c.modes.includes(remembered) ? remembered : c.modes[0]);
  };

  // Global "New chat": start a fresh session in the current module's chat
  // surface. For non-chat modules, open the global Intelligence Chat fresh.
  const triggerNewChat = () => {
    setNewChatNonce(n => n + 1);
    setChatAttach(null); // a fresh chat is no longer attached to an artifact
    if (activeModule !== 'coach') setChatOpen(true);
  };

  // Universal capture: route a classified intent to its module, pre-filled.
  const ROUTE_MODULE = { learn: 'learn', ladder: 'ladder', deepdive: 'deepdive', research: 'research', project: 'projects', note: 'inbox', book: 'books' };
  const applyRoute = (payload) => {
    setCaptureRoute({ ...payload, ts: Date.now() });
    setActiveModule(ROUTE_MODULE[payload.route] || 'home');
  };
  const clearCapture = () => setCaptureRoute(null);
  const focusCapture = () => { setActiveModule('home'); setFocusCaptureNonce(n => n + 1); };

  // Creation Studio hand-off from a Deep Dive / ladder / session.
  const openStudio = (source) => { setStudioSource(source); setActiveModule('studio'); };

  const saveArtifactToProject = async (projectId, artifact) => {
    const updated = projects.map(p => {
      if (p.id !== projectId) return p;
      const existing = p.artifacts || [];
      return { ...p, artifacts: [...existing, { id: uid(), ...artifact, savedAt: Date.now() }], updatedAt: Date.now() };
    });
    setProjects(updated);
    await saveProjects(updated);
    setPendingArtifact(null);
  };

  const ctx = {
    activeModule, setActiveModule, openContainer,
    chatOpen,     setChatOpen,
    searchQuery,  setSearchQuery,
    chatPrefill,  setChatPrefill,
    chatAttach,   setChatAttach,
    graph,        setGraph,
    projects,     setProjects,
    notes,        setNotes,
    research,     setResearch,
    isMobile, isTablet, isPhone, isDesktop, isWide,
    theme,    toggleTheme,
    pendingArtifact, setPendingArtifact, saveArtifactToProject,
    newChatNonce, triggerNewChat,
    captureRoute, applyRoute, clearCapture,
    focusCapture, focusCaptureNonce,
    studioSource, setStudioSource, openStudio,
  };

  const modules = {
    home:      isMobile ? <MobileHome /> : <HomeDashboard />, // phone Home surface (Order C)
    feed:      <WhatsHappening />,
    notes:     <Notes />,
    recaps:    <Recaps />,
    learn:     <LearningCenter />,
    academy:   <Academy />,
    ladder:    <LearningLadder />,
    books:     <BookClub />,
    research:  <ResearchHub />,
    deepdive:  <DeepDive />,
    translate: <TranslatorHub />,
    projects:  <ProjectsOS />,
    podcast:   <PodcastHub />,
    skills:    <Skills />,
    vault:     <MasteryVault />,
    growth:    <GrowthTools />,
    inbox:     <ContentInbox />,
    decisions: <DecisionLog />,
    studio:    <CreationStudio />,
    ted:       <TEDHub />,
    quiz:      <QuizCenter />,
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="fr-shell" data-chat={chatOpen ? 'open' : 'closed'}>
        <TopBar />

        {/* Layout is CSS-only (src/styles/tokens.css · docs/RESPONSIVE.md):
            both nav surfaces always render and media queries pick one, so a
            phone's first paint is never the desktop layout. */}
        <div className="fr-body">
          <div className="fr-sidebar"><SideNav /></div>
          <main className="fr-main">
            {/* Container's modes, as a scrollable chip row under the header */}
            <ModeChips />
            {/* Orchestrated entrance: each view rises 8px + fades on mount */}
            <div key={activeModule} className="rise">
              {modules[activeModule] || <HomeDashboard />}
            </div>
          </main>
        </div>

        <div className="fr-tabbar"><BottomNav /></div>
        <ChatPanel />
        <DebugOverlay />
        {pendingArtifact && (
          <SaveToProjectModal
            artifact={pendingArtifact}
            projects={projects}
            onSave={saveArtifactToProject}
            onClose={() => setPendingArtifact(null)}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}

function SaveToProjectModal({ artifact, projects, onSave, onClose }) {
  const [selectedId, setSelectedId] = useState(
    projects.find(p => p.status === 'active')?.id || projects[0]?.id || null
  );
  return (
    <div className="stp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="stp" role="dialog" aria-modal="true" aria-label="Save to Project">
        <div className="stp-head">
          <div className="stp-title">Save to Project</div>
          <button type="button" className="stp-close tap" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="stp-body">
          <div className="stp-saving">
            Saving: <b>{artifact.title || 'AI Output'}</b>
          </div>
          <div className="stp-list">
            {projects.map(p => (
              <button type="button" key={p.id} className="stp-row" aria-pressed={selectedId === p.id}
                onClick={() => setSelectedId(p.id)} style={p.color ? { '--c': p.color } : undefined}>
                <div className="stp-emoji" aria-hidden="true">{p.emoji}</div>
                <div className="stp-row-main">
                  <div className="stp-row-title">{p.title}</div>
                  <div className="stp-row-status">{p.status}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="stp-actions">
            <button type="button" className="stp-cancel tap" onClick={onClose}>Cancel</button>
            <button type="button" className="stp-save tap" onClick={() => selectedId && onSave(selectedId, artifact)} disabled={!selectedId}>
              Save to Project →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="ls" aria-busy="true" aria-label="Loading">
      <div className="ls-title">The Film Room</div>
      <div className="ls-dots" aria-hidden="true">
        {[0, 1, 2].map(i => <span key={i} className="ls-dot" style={{ '--i': i }} />)}
      </div>
      <div className="ls-kicker">Studying the tape</div>
    </div>
  );
}
