import { createContext, useContext, useState, useEffect } from 'react';
import { loadGraph, loadProjects, loadNotes, loadResearch } from './utils.js';
import { NAV_ITEMS, THEME_DARK, THEME_LIGHT } from './constants.js';
import useViewport from './hooks/useViewport.js';
import TopBar from './modules/TopBar.jsx';
import Sidebar from './modules/Sidebar.jsx';
import ChatPanel from './modules/ChatPanel.jsx';
import HomeDashboard from './modules/HomeDashboard.jsx';
import LearningCenter from './modules/LearningCenter.jsx';
import BookClub from './modules/BookClub.jsx';
import ResearchHub from './modules/ResearchHub.jsx';
import TranslatorHub from './modules/TranslatorHub.jsx';
import ProjectsOS from './modules/ProjectsOS.jsx';
import MasteryVault from './modules/MasteryVault.jsx';
import GrowthTools from './modules/GrowthTools.jsx';
import PodcastHub from './modules/PodcastHub.jsx';
import ContentInbox from './modules/ContentInbox.jsx';
import DecisionLog from './modules/DecisionLog.jsx';
import CoachAI from './modules/CoachAI.jsx';
import TEDHub from './modules/TEDHub.jsx';
import QuizCenter from './modules/QuizCenter.jsx';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function applyThemeVars(vars) {
  const root = document.documentElement.style;
  Object.entries(vars).forEach(([k, v]) => root.setProperty(k, v));
}

export default function App() {
  const [activeModule,     setActiveModule]    = useState('home');
  const [chatOpen,         setChatOpen]         = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [chatPrefill,      setChatPrefill]      = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [graph,    setGraph]    = useState(null);
  const [projects, setProjects] = useState([]);
  const [notes,    setNotes]    = useState([]);
  const [research, setResearch] = useState([]);
  const [loaded,   setLoaded]   = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('aether-theme') || 'dark');

  const { isMobile, isTablet, isPhone, isDesktop, isWide } = useViewport();

  useEffect(() => {
    applyThemeVars(theme === 'light' ? THEME_LIGHT : THEME_DARK);
    localStorage.setItem('aether-theme', theme);
  }, [theme]);

  useEffect(() => {
    Promise.all([loadGraph(), loadProjects(), loadNotes(), loadResearch()]).then(([g, p, n, r]) => {
      setGraph(g); setProjects(p); setNotes(n); setResearch(r); setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingScreen />;

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const ctx = {
    activeModule, setActiveModule,
    chatOpen,     setChatOpen,
    searchQuery,  setSearchQuery,
    chatPrefill,  setChatPrefill,
    graph,        setGraph,
    projects,     setProjects,
    notes,        setNotes,
    research,     setResearch,
    isMobile, isTablet, isPhone, isDesktop, isWide,
    theme,    toggleTheme,
  };

  const modules = {
    home:      <HomeDashboard />,
    learn:     <LearningCenter />,
    books:     <BookClub />,
    research:  <ResearchHub />,
    translate: <TranslatorHub />,
    projects:  <ProjectsOS />,
    podcast:   <PodcastHub />,
    vault:     <MasteryVault />,
    growth:    <GrowthTools />,
    inbox:     <ContentInbox />,
    decisions: <DecisionLog />,
    coach:     <CoachAI />,
    ted:       <TEDHub />,
    quiz:      <QuizCenter />,
  };

  // Tablets show icon-only sidebar automatically
  const collapsed = isTablet || sidebarCollapsed;

  return (
    <AppContext.Provider value={ctx}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
        <TopBar />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {!isMobile && (
            <Sidebar collapsed={collapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
          )}
          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: (!isMobile && chatOpen) ? 360 : 0,
            transition: 'padding-right 0.22s ease',
          }}>
            {/* Orchestrated entrance: each view rises 8px + fades on mount */}
            <div key={activeModule} className="rise">
              {modules[activeModule] || <HomeDashboard />}
            </div>
          </main>
        </div>

        {isMobile && <BottomNav activeModule={activeModule} setActiveModule={setActiveModule} isPhone={isPhone} />}
        <ChatPanel />
      </div>
    </AppContext.Provider>
  );
}

// Scrollable bottom nav — supports any number of items
function BottomNav({ activeModule, setActiveModule, isPhone }) {
  return (
    <nav style={{
      height: isPhone ? 56 : 62,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      flexShrink: 0,
      zIndex: 30,
    }}>
      {NAV_ITEMS.map(item => {
        const active = activeModule === item.id;
        return (
          <button key={item.id} onClick={() => setActiveModule(item.id)}
            style={{
              minWidth: isPhone ? 52 : 60,
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: 'none',
              borderTop: `2px solid ${active ? (item.accent || 'var(--accent, #D9A441)') : 'transparent'}`,
              background: 'transparent',
              color: active ? (item.accent || 'var(--accent, #D9A441)') : 'var(--muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'color 0.12s',
              padding: '0 2px',
            }}>
            <span style={{ fontSize: isPhone ? 18 : 16 }}>{item.icon}</span>
            {!isPhone && <span style={{ fontSize: 7, fontWeight: active ? 700 : 500, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 30, fontFamily: "'Newsreader', serif", fontWeight: 600, color: 'var(--chalk, var(--text))', letterSpacing: -0.5 }}>The Film Room</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent, #D9A441)', animation: `pulse 1.2s ${i * 0.2}s infinite ease-in-out` }} />
        ))}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase' }}>Studying the tape</div>
    </div>
  );
}
