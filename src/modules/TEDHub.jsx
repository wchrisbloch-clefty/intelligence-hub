import { useState } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, saveNotes, uid } from '../utils.js';
import { SYSTEM_BASE } from '../constants.js';
import { isPostCutoff } from '../lib/bookVerify.js';
import { TIER_INSTRUCTION } from '../lib/rigor.js';
import { USER_GROUNDING_TYPES, groundingTypeMeta } from '../lib/sourceGrounding.js';
import SourceGrounding from './shared/SourceGrounding.jsx';
import MD from './shared/MD.jsx';
import { SectionSkeleton, SectionError } from './shared/SectionState.jsx';
import Icon from './shared/Icon.jsx';
import './ted-hub.css';

// Non-book surfaces accept a transcript/notes the model can't reach.
const SRC_TYPES = USER_GROUNDING_TYPES.filter((t) => ['excerpt', 'notes'].includes(t.id));

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
  return (
    <div className="ted-score">
      <div className="ted-score-dot" />
      <span className="ted-score-val">{score}/10</span>
    </div>
  );
}

function TalkCard({ talk, onSaveToVault }) {
  const [expanded,  setExpanded]  = useState(false);
  const [analysis,  setAnalysis]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [vaulted,   setVaulted]   = useState(false);
  const [userSrc,   setUserSrc]   = useState(null); // transcript / notes the user supplied
  // Failure as STATE, not content (used to be written into `analysis`).
  const [err,       setErr]       = useState('');

  const analyze = () => {
    if (analysis) { setExpanded(e => !e); return; }
    setExpanded(true);
    runAnalysis();
  };
  const runAnalysis = async () => {
    setLoading(true); setErr('');
    try {
      // Same drift risk as a book: summarizing a real talk with nothing anchoring
      // it. The title/speaker/year are the metadata anchor; a post-cutoff talk
      // also gets a live web pass for the actual argument before we brief it.
      let webThesis = '';
      if (isPostCutoff(String(talk.year))) {
        try {
          webThesis = await callClaude({
            system: 'You retrieve the actual argument of one specific TED talk from current sources. Report only what is truly in THIS talk; if you cannot find it, reply exactly NOT FOUND.',
            messages: [{ role: 'user', content: `What is the actual core argument and structure of the TED talk "${talk.title}" by ${talk.speaker} (${talk.year})?` }],
            job: 'web', maxTokens: 600,
          });
          if (/^\s*NOT FOUND/i.test(webThesis)) webThesis = '';
        } catch { /* best-effort */ }
      }
      const gm = userSrc?.text ? groundingTypeMeta(userSrc.type) : null;
      const userBlock = gm ? `\n\nSOURCE THE USER SUPPLIED (${gm.label} — first-hand, tier ${gm.tier}; ground the brief in this and cite it):\n${userSrc.text}` : '';
      const prompt = `Analyze TED Talk: "${talk.title}" by ${talk.speaker} (${talk.year}).${webThesis ? `\n\nGROUNDING (the actual talk, retrieved from the web — match THIS, do not invent):\n${webThesis}` : ''}${userBlock}

Give CB a tight intelligence brief. Format:
**🎯 Core Thesis** — The single big idea in one sentence.
**⚡ 3 Key Insights** — Most actionable takeaways for CB (BD, real estate, leadership, longevity).
**🧠 Mental Model Connection** — Link to CB's library (Extreme Ownership, Never Split the Difference, Chip War, etc.).
**🚀 CB's Immediate Action** — One thing CB should do or change based on this talk.

Context: ${talk.relevanceNote}
Be blunt. CB-style. No fluff.

${TIER_INSTRUCTION}`;
      const reply = await callClaude({ system: SYSTEM_BASE, messages: [{ role: 'user', content: prompt }], maxTokens: 700 });
      setAnalysis(reply);
    } catch (e) {
      setErr(e?.message || 'The AI providers were unavailable.');
    }
    setLoading(false);
  };

  // Explicit status of this talk's generated brief. 'empty' has no placeholder —
  // expanding the card always starts the analysis.
  const status = loading ? 'loading' : err ? 'error' : analysis ? 'ready' : 'empty';

  const saveToVault = () => {
    onSaveToVault(`TED: ${talk.title} — ${talk.speaker}`, analysis);
    setVaulted(true);
  };

  return (
    <div className="ted-card" data-expanded={expanded || undefined}>
      <div className="ted-card-body">
        <div className="ted-card-top">
          <div className="ted-card-main">
            <div className="ted-card-title">{talk.title}</div>
            <div className="ted-card-meta">{talk.speaker} · {talk.year} · {talk.duration}</div>
          </div>
          <RelevanceDot score={talk.relevance} />
        </div>

        <div className="ted-note">{talk.relevanceNote}</div>

        <div className="ted-tags">
          {talk.tags.map(t => (
            <span key={t} className="ted-tag">{t}</span>
          ))}
        </div>

        <div className="ted-actions">
          <a href={talk.url} target="_blank" rel="noopener noreferrer" className="ted-watch tap">
            <Icon name="Play" aria-hidden="true" /> Watch
          </a>
          <button type="button" onClick={analyze} className="ted-analyze tap" data-open={(expanded && analysis) || undefined} aria-expanded={expanded}>
            {loading ? 'Analyzing…' : analysis ? (expanded ? 'Hide analysis' : 'Show analysis') : 'Analyze talk'}
          </button>
        </div>
      </div>

      {expanded && (
        <div data-status={status} className="ted-brief">
          {status === 'loading' ? (
            <SectionSkeleton rows={4} lead label="talk brief" />
          ) : status === 'error' ? (
            <SectionError label="the talk brief" onRetry={runAnalysis} detail={err} />
          ) : (
            <>
              <div className="ted-ground">
                <SourceGrounding value={userSrc} onSave={(v) => { setUserSrc(v); runAnalysis(); }} onClear={() => setUserSrc(null)} types={SRC_TYPES}
                  label="I have the transcript / notes — paste to ground this" />
              </div>
              <MD text={analysis} color="var(--accent-text)" />
              {analysis && !vaulted && (
                <button type="button" onClick={saveToVault} className="ted-vault tap">
                  <Icon name="Landmark" aria-hidden="true" /> Save to Vault
                </button>
              )}
              {vaulted && <div className="ted-vaulted"><Icon name="Check" aria-hidden="true" /> Saved to Vault</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TEDHub() {
  const { notes, setNotes, setActiveModule, setChatPrefill, setChatOpen } = useApp();
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

  return (
    <div className="ted">

      {/* Header */}
      <div className="ted-head">
        <div className="ted-eyebrow">Thought Leadership</div>
        <div className="ted-title">TED Intelligence Hub</div>
        <div className="ted-sub">
          {CURATED_TALKS.length} curated talks · scored for CB's interests · AI analysis on demand
        </div>
      </div>

      {/* Controls */}
      <div className="ted-controls">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search talks or speakers…" aria-label="Search talks or speakers"
          className="ted-input"
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="ted-select" aria-label="Sort talks">
          <option value="relevance">Sort: Relevance</option>
          <option value="year">Sort: Newest</option>
        </select>
      </div>

      {/* Topic filters */}
      <div className="ted-filters" data-scroll-x>
        {TOPIC_FILTERS.map(f => (
          <button type="button" key={f.id} onClick={() => setTopicFilter(f.id)}
            className="chip ted-filter tap" aria-pressed={topicFilter === f.id}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Talks grid */}
      <div className="ted-grid">
        {filtered.length === 0 ? (
          <div className="ted-none">
            No talks match your filter.
          </div>
        ) : (
          filtered.map(talk => (
            <TalkCard key={talk.id} talk={talk} onSaveToVault={saveToVault} />
          ))
        )}
      </div>

      {/* Add your own */}
      <div className="ted-own">
        <div className="ted-own-q">Want to analyze a specific TED talk or YouTube talk?</div>
        <button type="button" className="ted-link tap" onClick={() => {
          setChatPrefill('Analyze this TED talk for me: ');
          setChatOpen(true);
        }}>
          Open AI Chat to analyze any talk URL →
        </button>
        <button type="button" className="ted-link tap" data-quiet onClick={() => setActiveModule('podcast')}>
          Or go to Podcast Hub to paste a URL
        </button>
      </div>
    </div>
  );
}
