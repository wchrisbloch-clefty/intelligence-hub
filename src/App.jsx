import { T, withAlpha } from './theme';
import { createContext, useContext, useState, useEffect } from 'react';
import { loadGraph, loadProjects, loadNotes, loadResearch, saveProjects, uid } from './utils.js';
import { CONTAINERS, containerOfMode } from './constants.js';
import { readLocal, writeThrough } from './lib/storage.js';
import { getTheme, applyTheme } from './theme.js';
import useViewport from './hooks/useViewport.js';
import TopBar from './modules/TopBar.jsx';
import ChatPanel from './modules/ChatPanel.jsx';
import { SideNav, BottomNav, ModeChips } from './modules/shared/ContainerNav.jsx';
import HomeDashboard from './modules/HomeDashboard.jsx';
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

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export default function App() {
  const [activeModule,     setActiveModuleRaw]  = useState('home');
  const [navModes,         setNavModes]         = useState(() => readLocal('aether_nav_v1', {}));
  const [chatOpen,         setChatOpen]         = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [chatPrefill,      setChatPrefill]      = useState('');

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
    home:      <HomeDashboard />,
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
        <TopBar />

        {/* Body row: container rail (≥768) + scrolling content, capped at
            1280 on desktop. Mobile drops the rail for the bottom bar. */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, width: '100%', maxWidth: isDesktop ? 1280 : '100%', margin: '0 auto' }}>
          {!isMobile && <SideNav />}
          <main style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: (!isMobile && chatOpen) ? 360 : 0,
            transition: 'padding-right 0.22s ease',
          }}>
            {/* Container's modes, as a scrollable chip row under the header */}
            <ModeChips />
            {/* Orchestrated entrance: each view rises 8px + fades on mount */}
            <div key={activeModule} className="rise">
              {modules[activeModule] || <HomeDashboard />}
            </div>
          </main>
        </div>

        {isMobile && <BottomNav />}
        <ChatPanel />
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
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>Save to Project</div>
          <div onClick={onClose} style={{ fontSize: 'var(--fs-lg)', color: 'var(--subtle)', cursor: 'pointer' }}>✕</div>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--subtle)', marginBottom: 14 }}>
            Saving: <span style={{ color: 'var(--text-b)', fontWeight: 600 }}>{artifact.title || 'AI Output'}</span>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {projects.map(p => (
              <div key={p.id} onClick={() => setSelectedId(p.id)}
                style={{ padding: '10px 12px', background: selectedId === p.id ? withAlpha(p.color || T.accent, 8) : 'var(--bg)', border: `1px solid ${selectedId === p.id ? withAlpha(p.color || T.accent, 31) : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 'var(--fs-lg)'}}>{p.emoji}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-b)' }}>{p.title}</div>
                  <div style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{p.status}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--subtle)', fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => selectedId && onSave(selectedId, artifact)} disabled={!selectedId}
              style={{ flex: 2, padding: '10px', background: selectedId ? T.accent : 'var(--bord2)', border: 'none', borderRadius: 8, color: selectedId ? '#000' : 'var(--dim)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: selectedId ? 'pointer' : 'default', fontFamily: 'inherit' }}>
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
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 'var(--fs-2xl)', fontFamily: "'Newsreader', serif", fontWeight: 600, color: 'var(--chalk, var(--text))', letterSpacing: -0.5 }}>The Film Room</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent, #D9A441)', animation: `pulse 1.2s ${i * 0.2}s infinite ease-in-out` }} />
        ))}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase' }}>Studying the tape</div>
    </div>
  );
}
