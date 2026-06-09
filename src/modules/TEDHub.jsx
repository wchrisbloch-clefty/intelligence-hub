import { useState } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, saveNotes, uid } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT        = '#e2231a';
const ACCENT_BG     = 'rgba(226,35,26,0.07)';
const ACCENT_BORDER = 'rgba(226,35,26,0.2)';

const TOPIC_FILTERS = [
  { id: 'all',        label: 'All Talks' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'mindset',    label: 'Mindset' },
  { id: 'finance',    label: 'Finance' },
  { id: 'health',     label: 'Longevity' },
  { id: 'ai',         label: 'AI & Tech' },
];

const CURATED_TALKS = [
  {
    id: 'sinek',
    title: 'How Great Leaders Inspire Action',
    speaker: 'Simon Sinek',
    year: 2009, duration: '18 min',
    topic: 'leadership', relevance: 10,
    tags: ['Start With Why', 'Strategy', 'Communication'],
    url: 'https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action',
    relevanceNote: 'Start With Why is the foundation of every BD pitch, brand, and business CB builds.',
  },
  {
    id: 'dalio',
    title: 'How to Build a Company Where the Best Ideas Win',
    speaker: 'Ray Dalio',
    year: 2017, duration: '16 min',
    topic: 'finance', relevance: 10,
    tags: ['Principles', 'Finance', 'Systems'],
    url: 'https://www.ted.com/talks/ray_dalio_how_to_build_a_company_where_the_best_ideas_win',
    relevanceNote: 'Dalio\'s principles on meritocracy and radical truth apply to CB\'s passive income and business-building systems.',
  },
  {
    id: 'duckworth',
    title: 'Grit: The Power of Passion and Perseverance',
    speaker: 'Angela Duckworth',
    year: 2013, duration: '6 min',
    topic: 'mindset', relevance: 9,
    tags: ['Grit', 'Performance', 'Long Game'],
    url: 'https://www.ted.com/talks/angela_lee_duckworth_grit_the_power_of_passion_and_perseverance',
    relevanceNote: 'Grit as long-game operating system — maps to Fortitude, Extreme Ownership, and CB\'s stoic philosophy.',
  },
  {
    id: 'pink',
    title: 'The Puzzle of Motivation',
    speaker: 'Dan Pink',
    year: 2009, duration: '18 min',
    topic: 'leadership', relevance: 9,
    tags: ['Motivation', 'Autonomy', 'Leadership'],
    url: 'https://www.ted.com/talks/dan_pink_the_puzzle_of_motivation',
    relevanceNote: 'Intrinsic vs. extrinsic motivation is critical for BD team building and keeping CB\'s own performance engine running.',
  },
  {
    id: 'dweck',
    title: 'The Power of Believing That You Can Improve',
    speaker: 'Carol Dweck',
    year: 2014, duration: '10 min',
    topic: 'mindset', relevance: 9,
    tags: ['Growth Mindset', 'Learning', 'Confidence'],
    url: 'https://www.ted.com/talks/carol_dweck_the_power_of_believing_that_you_can_improve',
    relevanceNote: 'Growth mindset is the cognitive infrastructure behind CB\'s entire learning system and skill compounding strategy.',
  },
  {
    id: 'robbins',
    title: 'Why We Do What We Do',
    speaker: 'Tony Robbins',
    year: 2006, duration: '21 min',
    topic: 'mindset', relevance: 9,
    tags: ['Psychology', 'Drive', 'Human Needs'],
    url: 'https://www.ted.com/talks/tony_robbins_why_we_do_what_we_do',
    relevanceNote: 'Understanding the invisible forces driving behavior — applies to CB\'s coaching framework and team influence.',
  },
  {
    id: 'urban',
    title: 'Inside the Mind of a Master Procrastinator',
    speaker: 'Tim Urban',
    year: 2016, duration: '14 min',
    topic: 'mindset', relevance: 8,
    tags: ['Productivity', 'Procrastination', 'Execution'],
    url: 'https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator',
    relevanceNote: 'The "Panic Monster" framework maps to CB\'s project execution gaps — critical self-awareness tool.',
  },
  {
    id: 'iliff',
    title: 'One More Reason to Get a Good Night\'s Sleep',
    speaker: 'Jeff Iliff',
    year: 2014, duration: '11 min',
    topic: 'health', relevance: 8,
    tags: ['Sleep', 'Brain Health', 'Longevity'],
    url: 'https://www.ted.com/talks/jeff_iliff_one_more_reason_to_get_a_good_night_s_sleep',
    relevanceNote: 'Sleep is the foundation of Attia\'s longevity protocol — glymphatic system is the recovery mechanism CB is optimizing.',
  },
  {
    id: 'brown',
    title: 'The Power of Vulnerability',
    speaker: 'Brené Brown',
    year: 2010, duration: '20 min',
    topic: 'leadership', relevance: 8,
    tags: ['Vulnerability', 'Courage', 'Connection'],
    url: 'https://www.ted.com/talks/brene_brown_the_power_of_vulnerability',
    relevanceNote: 'Applies to BD relationship-building and the courage required for Extreme Ownership — being right vs. being authentic.',
  },
  {
    id: 'diamandis',
    title: 'Abundance Is Our Future',
    speaker: 'Peter Diamandis',
    year: 2012, duration: '16 min',
    topic: 'ai', relevance: 8,
    tags: ['Technology', 'Exponential Growth', 'Innovation'],
    url: 'https://www.ted.com/talks/peter_diamandis_abundance_is_our_future',
    relevanceNote: 'Exponential technology framing is the macro backdrop for CB\'s AI-augmented BD strategy and business positioning.',
  },
];

function RelevanceDot({ score }) {
  const color = score >= 9 ? '#00CC76' : score >= 7 ? '#ffcc44' : '#ff8844';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{score}/10</span>
    </div>
  );
}

function TalkCard({ talk, onSaveToVault }) {
  const [expanded,  setExpanded]  = useState(false);
  const [analysis,  setAnalysis]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [vaulted,   setVaulted]   = useState(false);

  const analyze = async () => {
    if (analysis) { setExpanded(e => !e); return; }
    setExpanded(true);
    setLoading(true);
    try {
      const prompt = `Analyze TED Talk: "${talk.title}" by ${talk.speaker} (${talk.year}).

Give CB a tight intelligence brief. Format:
**🎯 Core Thesis** — The single big idea in one sentence.
**⚡ 3 Key Insights** — Most actionable takeaways for CB (BD, real estate, leadership, longevity).
**🧠 Mental Model Connection** — Link to CB's library (Extreme Ownership, Never Split the Difference, Chip War, etc.).
**🚀 CB's Immediate Action** — One thing CB should do or change based on this talk.

Context: ${talk.relevanceNote}
Be blunt. CB-style. No fluff.`;
      const reply = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompt }], maxTokens: 500 });
      setAnalysis(reply);
    } catch {
      setAnalysis('Analysis unavailable. Check connection.');
    }
    setLoading(false);
  };

  const saveToVault = () => {
    onSaveToVault(`TED: ${talk.title} — ${talk.speaker}`, analysis);
    setVaulted(true);
  };

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${expanded ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>{talk.title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{talk.speaker} · {talk.year} · {talk.duration}</div>
          </div>
          <RelevanceDot score={talk.relevance} />
        </div>

        <div style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 10 }}>{talk.relevanceNote}</div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {talk.tags.map(t => (
            <span key={t} style={{ fontSize: 9, padding: '2px 7px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 4, color: ACCENT, fontWeight: 600 }}>{t}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <a href={talk.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, padding: '6px 12px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 7, color: ACCENT, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
            ▶ Watch
          </a>
          <button onClick={analyze}
            style={{ fontSize: 11, padding: '6px 12px', background: expanded && analysis ? 'var(--surf2)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-b)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flex: 1, textAlign: 'left' }}>
            {loading ? 'Analyzing…' : analysis ? (expanded ? '▲ Hide Analysis' : '▼ CB Analysis') : '✦ AI Analyze'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${ACCENT_BORDER}`, padding: '14px 16px', background: ACCENT_BG }}>
          {loading ? (
            <div>
              <div style={{ fontSize: 10, color: ACCENT, marginBottom: 8 }}>Generating CB-style brief…</div>
              <ThinkingDots color={ACCENT} />
            </div>
          ) : (
            <>
              <MD text={analysis} color={ACCENT} />
              {!vaulted && (
                <button onClick={saveToVault}
                  style={{ marginTop: 12, fontSize: 10, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-c)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  🏛 Save to Vault
                </button>
              )}
              {vaulted && <div style={{ marginTop: 8, fontSize: 10, color: '#00CC76' }}>✓ Saved to Vault</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TEDHub() {
  const { isMobile, notes, setNotes, setActiveModule, setChatPrefill, setChatOpen } = useApp();
  const [topicFilter, setTopicFilter] = useState('all');
  const [sortBy,      setSortBy]      = useState('relevance');
  const [search,      setSearch]      = useState('');

  const saveToVault = (title, content) => {
    const note = { id: uid(), title, content, source: 'ted', createdAt: Date.now(), tags: ['TED', 'Thought Leadership'] };
    const updated = [note, ...(notes || [])];
    setNotes(updated);
    saveNotes(updated);
  };

  const filtered = CURATED_TALKS
    .filter(t => topicFilter === 'all' || t.topic === topicFilter)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.speaker.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'relevance' ? b.relevance - a.relevance : b.year - a.year);

  const pad = isMobile ? '14px' : '24px';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ padding: `20px ${pad} 16px`, borderBottom: '1px solid var(--bord2)' }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase', marginBottom: 4 }}>Thought Leadership</div>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", letterSpacing: -0.5, marginBottom: 4 }}>
          TED Intelligence Hub
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim)' }}>
          {CURATED_TALKS.length} curated talks · scored for CB's interests · AI analysis on demand
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: `14px ${pad}`, borderBottom: '1px solid var(--bord2)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search talks or speakers…"
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-b)', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="relevance">Sort: Relevance</option>
          <option value="year">Sort: Newest</option>
        </select>
      </div>

      {/* Topic filters */}
      <div style={{ padding: `10px ${pad}`, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--bord2)' }}>
        {TOPIC_FILTERS.map(f => (
          <div key={f.id} onClick={() => setTopicFilter(f.id)}
            style={{ flexShrink: 0, padding: '5px 12px', fontSize: 10, fontWeight: 600, borderRadius: 14, cursor: 'pointer', transition: 'all 0.12s', border: `1px solid ${topicFilter === f.id ? ACCENT_BORDER : 'var(--border)'}`, background: topicFilter === f.id ? ACCENT_BG : 'transparent', color: topicFilter === f.id ? ACCENT : 'var(--subtle)' }}>
            {f.label}
          </div>
        ))}
      </div>

      {/* Talks grid */}
      <div style={{ padding: `16px ${pad}`, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--dim)', fontSize: 12 }}>
            No talks match your filter.
          </div>
        ) : (
          filtered.map(talk => (
            <TalkCard key={talk.id} talk={talk} onSaveToVault={saveToVault} />
          ))
        )}
      </div>

      {/* Add your own */}
      <div style={{ margin: `0 ${pad} 20px`, padding: '16px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Want to analyze a specific TED talk or YouTube talk?</div>
        <div onClick={() => {
          setChatPrefill('Analyze this TED talk for me: ');
          setChatOpen(true);
        }} style={{ fontSize: 11, color: ACCENT, fontWeight: 700, cursor: 'pointer' }}>
          Open AI Chat to analyze any talk URL →
        </div>
        <div onClick={() => setActiveModule('podcast')} style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
          Or go to Podcast Hub to paste a URL
        </div>
      </div>
    </div>
  );
}
