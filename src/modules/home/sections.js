import DailyBrief from './DailyBrief.jsx';
import OpportunityCards from './OpportunityCards.jsx';
import SignalFeed from './SignalFeed.jsx';
import ActiveProjects from './ActiveProjects.jsx';
import SkillSnapshot from './SkillSnapshot.jsx';
import ConnectedKnowledge from './ConnectedKnowledge.jsx';

// The Home section registry. HomeDashboard is a renderer over this list —
// nothing is inline, so sections can be reordered, hidden, and collapsed.
// `icon` is a lucide name (see shared/Icon). Order/visibility here are defaults;
// the user's saved layout (aether_home_layout) overrides them.
export const SECTIONS = [
  { id: 'brief',      label: 'Daily Brief',        icon: 'Zap',       component: DailyBrief,        defaultVisible: true, defaultOrder: 0 },
  { id: 'opportunity',label: 'Blue Ocean Signals', icon: 'Waves',     component: OpportunityCards,   defaultVisible: true, defaultOrder: 1 },
  { id: 'connected',  label: 'Connected Knowledge',icon: 'Share2',    component: ConnectedKnowledge, defaultVisible: true, defaultOrder: 2 },
  { id: 'skills',     label: 'Skill Snapshot',     icon: 'Target',    component: SkillSnapshot,      defaultVisible: true, defaultOrder: 3 },
  { id: 'projects',   label: 'Active Projects',    icon: 'Layers',    component: ActiveProjects,     defaultVisible: true, defaultOrder: 4 },
  { id: 'signals',    label: 'Live Signal Feed',   icon: 'Radio',     component: SignalFeed,         defaultVisible: true, defaultOrder: 5 },
];

export const sectionById = (id) => SECTIONS.find((s) => s.id === id);
