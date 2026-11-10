import { T } from '../theme';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import {
  KNOWN_BOOKS, TYPE_META, SESSION_MODES, ACCEPT_TYPES,
  CONTENT_TYPES, READER_GOALS, DEPTH_LEVELS, READING_PROGRESS_OPTIONS,
} from '../constants.js';
import {
  buildSystem, buildReadingSystem, buildQuizPrompt, callClaude, buildApiMessages,
  logSession, extractYouTubeId, fetchYouTubeTranscript,
  fetchYouTubeMeta, processFiles, depthNeedsWeb,
  fetchArticle, detectCaptureType,
} from '../utils.js';
import { recordQuizResult } from '../lib/reviews.js';
import { logConcept } from '../lib/graph.js';
import MD from './shared/MD.jsx';
import Icon from './shared/Icon.jsx';
import ProviderTag from './shared/ProviderTag.jsx';
import DiagramBlock from './shared/DiagramBlock.jsx';
import QuizMode from './shared/QuizMode.jsx';
import { TIER_INSTRUCTION } from '../lib/rigor.js';
import { SectionSkeleton, SectionError, SectionEmpty } from './shared/SectionState.jsx';
import { Btn, Input, Textarea, Label, Card, Badge, BottomSheet } from './shared/Common.jsx';
import './learning-center.css';

// Styling lives in learning-center.css (lc-) — tokens only, no inline colour.
const Back = ({ onClick, children }) => <button type="button" className="lc-back tap" onClick={onClick}>{children}</button>;

const READING_QUICK_PROMPTS = {
  nonfiction:  ["What's the single most important framework?", 'Connect this to my other reading', 'How does this apply to my goals?', 'What is the author getting wrong?', 'Quiz me on this section'],
  fiction:     ['What does this character reveal?', 'What theme is emerging?', "What's the author doing here?", 'Historical or cultural context?', 'What should I watch for next?'],
  academic:    ['Explain this concept simply first', 'What prerequisites am I missing?', 'Generate a practice question', 'What do I need before moving on?', 'What would this look like on an exam?'],
  history:     ["What's the evidence for this claim?", 'Who disputes this interpretation?', "What's the present-day parallel?", 'Primary source vs. narrative?', 'What context am I missing?'],
  reference:   ['Explain this term precisely', 'What are the exceptions?', 'When does this NOT apply?', "What's the risk of misapplying this?", 'Adjacent concepts I should know?'],
  training:    ['How do I apply this now?', 'Give me a scenario to practice', 'What competency does this build?', 'Connect to my current projects', 'What does mastery look like?'],
  philosophy:  ['What is the argument actually claiming?', 'Steelman this position', 'Strongest counterargument?', 'What does this assume?', 'How does this connect to other thinkers?'],
  scifi:       ["What's the real-world science here?", "What's the speculative thesis?", 'What social issue is this allegorizing?', 'Internal consistency check', 'What genre conventions are at play?'],
};

export default function LearningCenter() {
  const { graph, setGraph, isMobile, isPhone, isTablet, captureRoute, clearCapture } = useApp();
  const [screen, setScreen] = useState('home');
  const [entryMode, setEntryMode] = useState(null);
  const [sessionMode, setSessionMode] = useState('chat');
  const [context, setContext] = useState({});

  const [contentType, setContentType] = useState('nonfiction');
  const [readerGoal, setReaderGoal] = useState('master');
  const [depthLevel, setDepthLevel] = useState('standard');
  const [readingProgress, setReadingProgress] = useState('start');
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState(''); // live streamed assistant text
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [webUrl, setWebUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [topicInput, setTopicInput] = useState('');
  const [captureInput, setCaptureInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  // Failures as STATE, not content: a failed reply used to be appended to the
  // transcript as if the assistant had said it, and a failed opener was replaced
  // by a fake "Ready." greeting.
  const [sessionErr, setSessionErr] = useState('');
  const [quizErr, setQuizErr] = useState('');
  const lastFailRef = useRef(null); // { kind:'send', history } | { kind:'open', args }
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [annotationText, setAnnotationText] = useState('');

  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, stream]);
  // Capture-bar route (D1): drop into the topic-course entry, pre-filled.
  useEffect(() => {
    if (captureRoute?.route === 'learn') {
      setTopicInput(captureRoute.topic || '');
      setEntryMode('topic');
      setScreen('topic-input');
      clearCapture?.();
    }
  }, [captureRoute, clearCapture]);

  const currentContentType = CONTENT_TYPES.find(t => t.id === contentType) || CONTENT_TYPES[0];
  const accentColor = T.accent; // one confident accent — the active session is gold
  const sessionTitle = entryMode === 'reading' ? context.title : entryMode === 'topic' ? context.topic : entryMode === 'youtube' ? context.title : entryMode === 'capture' ? context.title : 'Document';
  // Explicit status of the session's generated replies (the primary artifact).
  const sessionStatus = loading ? 'loading' : sessionErr ? 'error' : messages.some(m => m.role === 'assistant') ? 'ready' : 'empty';

  const send = async (text, attachments = []) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;
    const userMsg = { role: 'user', content: text, attachments };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setUploadedFiles([]);
    await respond(newHistory);
  };

  // The reply half of send(), split out so Retry re-runs ONLY the failed reply
  // against the same history (the user's message is already in the transcript).
  const respond = async (newHistory) => {
    setLoading(true);
    setStream('');
    setSessionErr('');
    try {
      const apiMessages = await buildApiMessages(newHistory);
      // Reading mode summarizes EXTERNAL material the user acts on → tier its
      // claims (source trust). Free chat about the user's own thinking does not.
      const system = entryMode === 'reading'
        ? `${buildReadingSystem({ contentType, goal: readerGoal, depth: depthLevel, progress: readingProgress, content: context, graph })}\n\n${TIER_INSTRUCTION}`
        : buildSystem(entryMode, sessionMode, context, graph);
      // Deep/Expert reading depth grounds itself in live sources — auto-enable web.
      const useWeb = searchEnabled || (entryMode === 'reading' && depthNeedsWeb(depthLevel));
      let provider = '';
      const reply = await callClaude({ system, messages: apiMessages, searchEnabled: useWeb, job: useWeb ? 'web' : 'reason', onToken: (t) => setStream(s => s + t), onProvider: (p) => { provider = p; } });
      setMessages(prev => [...prev, { role: 'assistant', content: reply, provider }]);
    } catch (e) {
      lastFailRef.current = { kind: 'send', history: newHistory };
      setSessionErr(e?.authExpired ? 'Auth expired — re-enter your code to continue.' : (e?.message || 'AI request failed.'));
    }
    setStream('');
    setLoading(false);
  };

  const sendWithAnnotation = () => {
    if (!annotationText.trim() && !input.trim()) return;
    const text = annotationText.trim()
      ? `[PASSAGE FROM TEXT]:\n"${annotationText.trim()}"\n\n${input.trim() || 'Analyze this passage.'}`
      : input;
    setAnnotationText('');
    setShowAnnotation(false);
    send(text, uploadedFiles);
  };

  const autoOpen = async (eMode, sMode, ctx, cType, goal, depth, progress) => {
    setMessages([]);
    setSessionStart(Date.now());
    setLoading(true);
    setStream('');
    setSessionErr('');
    let opener = '';
    if (eMode === 'reading') {
      const t = ctx.title;
      const a = ctx.author ? ` by ${ctx.author}` : '';
      opener = progress === 'done'
        ? `I've finished "${t}"${a}. Let's do a full synthesis — key takeaways, connections, and what I should do with this.`
        : progress === 'reference'
        ? `I'm using "${t}"${a} as a reference. I have a specific question — ready when you are.`
        : progress === 'mid'
        ? `I'm mid-way through "${t}"${a}. Let's work through what I've been reading.`
        : `I'm starting "${t}"${a}. Orient me — what should I know before diving in, and what should I watch for as I read?`;
    } else {
      const openers = {
        book: {
          package:   `I want the full intelligence package for "${ctx.book?.title}". Propose the right format and ask about depth.`,
          readalong: `I'm reading "${ctx.book?.title}". Set up read-along — structural map first, then ask where I am.`,
          reference: `I'm using "${ctx.book?.title}" as reference. Give master-expert orientation and ask what I want to go deep on.`,
          socratic:  `Start the Socratic session on "${ctx.book?.title}". First question now.`,
          chat:      `Let's talk about "${ctx.book?.title}". Sharpest single insight most people miss, then ask what's on my mind.`,
        },
        document: "I've uploaded a document. Analyze completely, teach in CB style, connect to my mental models and goals.",
        topic:    sMode === 'socratic' ? `Start Socratic mode on: "${ctx.topic}". First question now.` : `I want to learn about "${ctx.topic}". Master expert mode. Full course outline or specific module?`,
        youtube:  `YouTube: "${ctx.title}" by ${ctx.channel}. ${ctx.transcriptAvailable ? 'Transcript in context.' : 'No transcript — use your knowledge.'} Teach me now.`,
        capture:  `I've captured content ("${ctx.title}"). ${ctx.articleAvailable ? 'Full content is in context.' : 'Content could not be retrieved — use your knowledge and say so.'} Analyze it, teach in CB style, connect to my mental models and goals, and tell me what to act on.`,
      };
      opener = eMode === 'book' ? (openers.book[sMode] || openers.book.chat) : openers[eMode];
    }
    try {
      const system = eMode === 'reading'
        ? buildReadingSystem({ contentType: cType, goal, depth, progress, content: ctx, graph })
        : buildSystem(eMode, sMode, ctx, graph);
      let provider = '';
      const reply = await callClaude({ system, messages: [{ role: 'user', content: opener }], job: 'reason', onToken: (t) => setStream(s => s + t), onProvider: (p) => { provider = p; } });
      setMessages([{ role: 'assistant', content: reply, provider }]);
    } catch (e) {
      lastFailRef.current = { kind: 'open', args: [eMode, sMode, ctx, cType, goal, depth, progress] };
      setSessionErr(e?.message || 'The AI providers were unavailable.');
    }
    setStream('');
    setLoading(false);
  };

  const generateQuiz = async () => {
    if (quizLoading) return;
    setQuizLoading(true); setQuizErr('');
    try {
      const reply = await callClaude({ system: '', messages: [{ role: 'user', content: buildQuizPrompt({ subject: sessionTitle, count: 5, includeRate: false }) }] });
      const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
      setQuizQuestions(parsed.questions || []);
      setQuizMode(true);
    } catch (e) {
      setQuizErr(e?.message || 'Quiz generation failed.');
    }
    setQuizLoading(false);
  };

  // Retry re-runs ONLY the failed call — the reply or the session opener.
  const retrySession = () => {
    const f = lastFailRef.current;
    if (!f || loading) return;
    if (f.kind === 'send') respond(f.history);
    else autoOpen(...f.args);
  };

  const onQuizComplete = (results) => {
    const graded = results.filter(r => r.score !== null);
    const pct = graded.length ? Math.round((graded.filter(r => r.score > 0).length / graded.length) * 100) : 0;
    if (sessionTitle) recordQuizResult({ topicId: sessionTitle.toLowerCase().replace(/\s+/g, '_'), topicLabel: sessionTitle, results });
    setQuizMode(false);
    setQuizQuestions([]);
    setMessages(prev => [...prev, { role: 'assistant', content: `**Quiz Complete — ${pct}%**\n\n${pct >= 80 ? 'Strong. Core material internalized.' : pct >= 60 ? 'Solid foundation. Review what you missed.' : 'Early stages — this is data, not judgment. Run it again after another pass.'}\n\nWant to go deeper on anything you missed?` }]);
  };

  const handleYouTube = async (urlArg) => {
    // urlArg may be a string (from Universal Capture) or a click event (from the
    // button) — only treat a string as an explicit URL, else read from state.
    const raw = (typeof urlArg === 'string' ? urlArg : youtubeUrl).trim();
    if (!raw) return;
    const videoId = extractYouTubeId(raw);
    if (!videoId) { setYtError('Invalid YouTube URL.'); return; }
    setYtLoading(true); setYtError('');
    const [meta, transcript] = await Promise.all([fetchYouTubeMeta(videoId), fetchYouTubeTranscript(videoId)]);
    const ctx = { url: raw, videoId, title: meta?.title || 'YouTube Video', channel: meta?.author_name || 'Unknown', transcript: transcript || '', transcriptAvailable: !!(transcript && transcript.length > 100) };
    setContext(ctx); setEntryMode('youtube'); setScreen('session'); setYoutubeUrl('');
    autoOpen('youtube', sessionMode, ctx);
    setYtLoading(false);
  };

  // Universal Capture — accepts a YouTube URL, any article URL, or raw text,
  // auto-detects the type, and routes into the session engine.
  const handleCapture = async (raw) => {
    const value = (raw ?? captureInput).trim();
    if (!value) return;
    const kind = detectCaptureType(value);
    setCaptureInput('');

    if (kind === 'youtube') {
      await handleYouTube(value);   // pass the URL explicitly — no state race
      return;
    }

    setYtLoading(true);
    let ctx;
    if (kind === 'url') {
      const article = await fetchArticle(value);
      ctx = {
        captureKind: 'url',
        url: value,
        title: value.replace(/^https?:\/\//, '').slice(0, 60),
        content: article || '',
        articleAvailable: !!article,
      };
    } else {
      ctx = {
        captureKind: 'text',
        title: 'Pasted Content',
        content: value,
        articleAvailable: true,
      };
    }
    setContext(ctx);
    setEntryMode('capture');
    setScreen('session');
    autoOpen('capture', sessionMode, ctx);
    setYtLoading(false);
  };

  const handleLogSession = async (conf, notes) => {
    const durationMin = sessionStart ? Math.round((Date.now() - sessionStart) / 60000) : 5;
    await logSession(sessionTitle, entryMode, Math.max(durationMin, 1), conf, notes);
    // Emit into the knowledge graph so this study session connects to the same
    // topic wherever else it's touched (research, quiz, books).
    const { graph: g } = await logConcept({ topic: sessionTitle, source: sessionTitle, module: 'learn', confidence: conf });
    if (g) setGraph(g);
    setShowLogModal(false);
  };

  const getQuickPrompts = () => {
    if (entryMode === 'reading') return READING_QUICK_PROMPTS[contentType] || READING_QUICK_PROMPTS.nonfiction;
    const qp = {
      book: { package: ['Confirm format proposed', 'Go deeper on key framework', 'Connect to my mental models', 'Decisive action now'], readalong: ["What connects to my other books?", 'Watch for next?', 'Master-expert breakdown', 'Connect to my goals'], reference: ['Go master-expert deep', 'CB application', 'What am I missing?', 'Cross-book connection'], socratic: ['Next question', 'Go harder', 'Explain what I got wrong', 'Scorecard'], chat: ['Sharpest counterargument', 'Blue Ocean angle', 'What would Buffett say?', 'One decisive action'] },
      document: ['Core thesis', 'Extract key frameworks', 'Connect to my goals', 'What to act on now', 'Quiz me on this'],
      topic: ['Full course outline', 'Start Module 1', 'Tipping point in this field', 'Blue Ocean opportunities', 'Decisive bet'],
      youtube: ['3 biggest ideas', 'Connect to my mental models', 'What should I act on?', 'Quiz me on this video'],
      capture: ['3 biggest ideas', 'Connect to my mental models', 'What should I act on?', 'Build a course from this', 'Quiz me on this', 'Blue Ocean angle', 'Contrast with what I\'ve read', 'Sports-analogy summary'],
    };
    if (entryMode === 'book') return qp.book[sessionMode] || qp.book.chat;
    return qp[entryMode] || qp.topic;
  };

  // Hidden file input lives OUTSIDE the drop-zone button (no nested controls).
  const fileInput = (
    <input ref={fileRef} type="file" multiple accept={ACCEPT_TYPES} className="lc-hidden" onChange={async e => { const files = await processFiles(e.target.files); setUploadedFiles(p => [...p, ...files]); }} />
  );

  if (screen === 'home') return (
    <div className="lc-page">
      <div className="lc-intro">
        <div className="lc-eyebrow">CB · Learning Center</div>
        <div className="lc-title">What do you want to learn?</div>
        <div className="lc-lede">Capture · Books · Documents · Topics · YouTube — all tracked, all connected.</div>
      </div>

      <div className="lc-entries">
        {[
          { icon: 'Zap', label: 'Universal Capture', desc: 'Paste anything — a link, an article, a YouTube URL, or raw text. I detect it and teach you.', color: 'var(--accent-text)', action: () => { setEntryMode('capture'); setScreen('capture-input'); } },
          { icon: 'Library', label: 'Reading Companion', desc: 'Any book, paper, manual, or novel — personal mentor as you read.', color: 'var(--accent-text)', action: () => setScreen('reading-add') },
          { icon: 'GraduationCap', label: 'Topic / Course', desc: 'Name any subject. I build a structured course.', color: 'var(--accent-text)', action: () => { setEntryMode('topic'); setScreen('topic-input'); } },
          { icon: 'Play', label: 'YouTube', desc: 'Paste a URL. Transcript extraction + deep analysis.', color: T.negative, tone: 'negative', action: () => { setEntryMode('youtube'); setScreen('youtube-input'); } },
          { icon: 'FileText', label: 'Document', desc: 'PDF, Word, Excel, image, or web link.', color: 'var(--accent-text)', action: () => { setEntryMode('document'); setScreen('doc-upload'); } },
        ].map(m => (
          <Card key={m.label} color={m.color} onClick={m.action}>
            <div className="lc-entry lc-entry-row" data-lc-tone={m.tone || 'accent'}>
              <span className="lc-entry-icon"><Icon name={m.icon} size="nav" /></span>
              <div className="lc-entry-text">
                <div className="lc-entry-label">{m.label}</div>
                <div className="lc-entry-desc">{m.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="lc-graph">
        <Label>Knowledge Graph</Label>
        <div className="lc-stats">
          {[
            ['Topics', Object.keys(graph?.topics || {}).length],
            ['Sessions', (graph?.sessions || []).length],
            ['Minutes', graph?.totalTime || 0],
            ['Avg Conf', (Object.values(graph?.topics || {}).length ? Math.round(Object.values(graph.topics).reduce((s, t) => s + t.confidence, 0) / Object.values(graph.topics).length) : 0) + '/10'],
          ].map(([label, val]) => (
            <div key={label} className="lc-stat">
              <div className="lc-stat-val">{val}</div>
              <div className="lc-stat-label">{label}</div>
            </div>
          ))}
        </div>
        {Object.values(graph?.topics || {}).slice(0, 4).map(t => (
          <button type="button" key={t.title} className="lc-row tap"
            onClick={() => { setContext({ topic: t.title }); setEntryMode('topic'); setSessionMode('chat'); setScreen('session'); autoOpen('topic', 'chat', { topic: t.title }); }}>
            <div className="lc-row-main">
              <div className="lc-row-title">{t.title}</div>
              <div className="lc-row-sub">{t.sessions} sessions · {t.totalMin}min · tap to continue</div>
            </div>
            <div className="lc-row-side">
              <div className="lc-row-conf">{t.confidence}/10</div>
              <div className="lc-row-go" aria-hidden="true">→</div>
            </div>
          </button>
        ))}
      </div>
      <button type="button" className="lc-link-row tap" onClick={() => setScreen('book-select')}>
        Browse CB Reading List →
      </button>
    </div>
  );

  if (screen === 'reading-add') return (
    <div className="lc-page" data-w="narrow">
      <Back onClick={() => setScreen('home')}>← Learn</Back>
      <div className="lc-eyebrow" data-lc-tone="accent"><Icon name="Library" size={14} /> Reading Companion</div>
      <div className="lc-title">What are you reading?</div>
      <div className="lc-lede" data-gap="xxl">Book, paper, manual, textbook, novel — anything.</div>

      <input className="lc-input" data-size="lg" value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Title *" aria-label="Title" />
      <input className="lc-input" data-gap="lg" value={customAuthor} onChange={e => setCustomAuthor(e.target.value)} placeholder="Author / Source (optional)" aria-label="Author or source" />

      <Label>Quick-add from reading list</Label>
      <div className="lc-chips">
        {KNOWN_BOOKS.slice(0, 10).map(b => (
          <button type="button" key={b.title} className="lc-chip tap" aria-pressed={customTitle === b.title}
            onClick={() => { setCustomTitle(b.title); setCustomAuthor(b.author); }}>
            {b.title}
          </button>
        ))}
      </div>

      <div className="lc-btns">
        <button type="button" className="lc-btn tap" onClick={() => setScreen('book-select')}>Browse Full List</button>
        <button type="button" className="lc-btn tap" data-grow="2" data-primary="" disabled={!customTitle.trim()}
          onClick={() => { if (!customTitle.trim()) return; setContext({ title: customTitle.trim(), author: customAuthor.trim() }); setScreen('content-type'); }}>
          Continue →
        </button>
      </div>
    </div>
  );

  if (screen === 'content-type') return (
    <div className="lc-page" data-w="narrow">
      <Back onClick={() => setScreen('reading-add')}>← Back</Back>
      <div className="lc-eyebrow" data-tight="" data-lc-tone="accent">Step 1 of 2</div>
      <div className="lc-title" data-gap="sm">What type of content is this?</div>
      <div className="lc-lede" data-gap="lg">"{context.title}"</div>
      <div className="lc-types">
        {CONTENT_TYPES.map(t => (
          <button type="button" key={t.id} className="lc-opt tap" aria-pressed={contentType === t.id} onClick={() => setContentType(t.id)}>
            <div className="lc-opt-head">
              <Icon name={t.icon} size="header" />
              <span className="lc-opt-label">{t.label}</span>
            </div>
            <div className="lc-opt-desc">{t.examples}</div>
          </button>
        ))}
      </div>
      <button type="button" className="lc-btn tap" data-primary="" data-block="" onClick={() => setScreen('reader-setup')}>
        Continue →
      </button>
    </div>
  );

  if (screen === 'reader-setup') return (
    <div className="lc-page" data-w="narrow">
      <Back onClick={() => setScreen('content-type')}>← Back</Back>
      <div className="lc-eyebrow" data-tight="" data-lc-tone="muted">Step 2 of 2</div>
      <div className="lc-title" data-gap="sm">How do you want to engage?</div>
      <div className="lc-lede" data-gap="xl">"{context.title}"</div>

      <Label>Your Goal</Label>
      <div className="lc-goals">
        {READER_GOALS.map(g => (
          <button type="button" key={g.id} className="lc-opt lc-goal tap" aria-pressed={readerGoal === g.id} onClick={() => setReaderGoal(g.id)}>
            <Icon name={g.icon} size="header" />
            <div>
              <div className="lc-opt-label">{g.label}</div>
              <div className="lc-opt-desc">{g.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <Label>Depth Level</Label>
      <div className="lc-flexopts">
        {DEPTH_LEVELS.map(d => (
          <button type="button" key={d.id} className="lc-opt lc-depth tap" aria-pressed={depthLevel === d.id} onClick={() => setDepthLevel(d.id)}>
            <div className="lc-opt-label">{d.label}</div>
            <div className="lc-opt-desc">{d.desc}</div>
          </button>
        ))}
      </div>

      <Label>Where are you in this content?</Label>
      <div className="lc-flexopts" data-gap="lg">
        {READING_PROGRESS_OPTIONS.map(p => (
          <button type="button" key={p.id} className="lc-opt lc-prog tap" aria-pressed={readingProgress === p.id} onClick={() => setReadingProgress(p.id)}>
            <Icon name={p.icon} size={16} /> {p.label}
          </button>
        ))}
      </div>

      <button type="button" className="lc-btn tap" data-primary="" data-block="lg"
        onClick={() => { setEntryMode('reading'); setScreen('session'); autoOpen('reading', sessionMode, context, contentType, readerGoal, depthLevel, readingProgress); }}>
        Start Session →
      </button>
    </div>
  );

  if (screen === 'book-select') return (
    <div className="lc-page">
      <Back onClick={() => setScreen('home')}>← Learn</Back>
      <div className="lc-eyebrow" data-tight="">CB Reading List · {KNOWN_BOOKS.length} Books</div>
      <div className="lc-chips" data-gap="md">
        {['all', ...Object.keys(TYPE_META)].map(t => (
          <button type="button" key={t} className="lc-chip tap" data-kind="filter" aria-pressed={filterType === t} onClick={() => setFilterType(t)}>
            {t === 'all' ? 'All' : TYPE_META[t]?.label}
          </button>
        ))}
      </div>
      <div className="lc-books">
        {(filterType === 'all' ? KNOWN_BOOKS : KNOWN_BOOKS.filter(b => b.type === filterType)).map(book => (
          <button type="button" key={book.title} className="lc-row lc-book tap"
            onClick={() => { setContext({ title: book.title, author: book.author }); setContentType('nonfiction'); setScreen('reader-setup'); }}>
            <div className="lc-row-main">
              <div className="lc-book-title">{book.title}</div>
              <div className="lc-book-author">{book.author}</div>
            </div>
            <div className="lc-book-type">
              <Icon name={TYPE_META[book.type]?.icon} size={16} />
              <div>{TYPE_META[book.type]?.label}</div>
            </div>
          </button>
        ))}
      </div>
      <button type="button" className="lc-link-row tap" data-plain="" onClick={() => setScreen('reading-add')}>
        + Add any other book or content
      </button>
    </div>
  );

  if (screen === 'doc-upload') return (
    <div className="lc-page" data-w="narrow">
      <Back onClick={() => setScreen('home')}>← Back</Back>
      <div className="lc-eyebrow" data-lc-tone="accent"><Icon name="FileText" size={14} /> Document Intelligence</div>
      <div className="lc-title" data-gap="lg">Upload Your Document</div>
      <button type="button" className="lc-drop tap" data-over={dragOver ? '' : undefined}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={async e => { e.preventDefault(); setDragOver(false); const files = await processFiles(e.dataTransfer.files); setUploadedFiles(p => [...p, ...files]); }}
        onClick={() => fileRef.current?.click()}>
        <span className="lc-drop-icon"><Icon name="FileText" size="nav" /></span>
        <div className="lc-drop-title">Drop files or tap to browse</div>
        <div className="lc-drop-sub">PDF · Word · Excel · PowerPoint · Images</div>
      </button>
      {fileInput}
      <div className="lc-block" data-gap="sm">
        <Label>Or Paste a Web Link</Label>
        <div className="lc-inline">
          <input className="lc-input" value={webUrl} onChange={e => setWebUrl(e.target.value)} aria-label="Web link"
            onKeyDown={e => e.key === 'Enter' && webUrl.trim() && (setUploadedFiles(p => [...p, { type: 'url', url: webUrl, name: webUrl, icon: '🔗', label: 'Web Link' }]), setWebUrl(''))}
            placeholder="https://..." />
          <button type="button" className="lc-add" onClick={() => { if (webUrl.trim()) { setUploadedFiles(p => [...p, { type: 'url', url: webUrl, name: webUrl, icon: '🔗', label: 'Web Link' }]); setWebUrl(''); } }}>Add</button>
        </div>
      </div>
      {uploadedFiles.length > 0 && (
        <div className="lc-block" data-gap="sm">
          {uploadedFiles.map((f, i) => (
            <div key={i} className="lc-file">
              <Icon name={f.icon} size="header" />
              <div className="lc-file-name">{f.name}</div>
              <button type="button" className="lc-x tap" aria-label={`Remove ${f.name}`} onClick={() => setUploadedFiles(p => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <Btn color="var(--accent-text)" disabled={uploadedFiles.length === 0} onClick={() => { setContext({ files: uploadedFiles }); setEntryMode('document'); setScreen('session'); autoOpen('document', sessionMode, { files: uploadedFiles }); }}>
        Analyze {uploadedFiles.length > 1 ? `${uploadedFiles.length} documents` : 'document'}
      </Btn>
    </div>
  );

  if (screen === 'topic-input') return (
    <div className="lc-page" data-w="narrow">
      <Back onClick={() => setScreen('home')}>← Back</Back>
      <div className="lc-eyebrow" data-lc-tone="accent"><Icon name="GraduationCap" size={14} /> Topic / Course Builder</div>
      <div className="lc-title" data-gap="lg">What do you want to master?</div>
      <Textarea value={topicInput} onChange={setTopicInput} rows={3} placeholder={'ERCOT energy markets\nReal estate underwriting\nSemiconductor supply chain\nNegotiation psychology'} />
      <div className="lc-block">
        <Label>Mode</Label>
        <div className="lc-modes">
          {[{ id: 'chat', label: 'Course Build' }, { id: 'socratic', label: 'Quiz Me', icon: 'Brain' }].map(m => (
            <button type="button" key={m.id} className="lc-mode tap" aria-pressed={sessionMode === m.id} onClick={() => setSessionMode(m.id)}>
              {m.icon && <Icon name={m.icon} size={16} />}{m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="lc-chips">
        {['ERCOT energy markets', 'Real estate underwriting', 'Semiconductor supply chain', 'Options basics', 'Negotiation psychology', 'Longevity & biohacking', 'AI agents', 'Dividend investing'].map(s => (
          <button type="button" key={s} className="lc-chip tap" data-muted="" onClick={() => setTopicInput(s)}>{s}</button>
        ))}
      </div>
      <Btn color="var(--accent-text)" disabled={!topicInput.trim()} onClick={() => { setContext({ topic: topicInput }); setEntryMode('topic'); setScreen('session'); autoOpen('topic', sessionMode, { topic: topicInput }); }}>
        {sessionMode === 'socratic' ? 'Start Quiz →' : 'Build My Course →'}
      </Btn>
    </div>
  );

  if (screen === 'capture-input') return (
    <div className="lc-page" data-w="narrow">
      <Back onClick={() => { setScreen('home'); setCaptureInput(''); }}>← Learn</Back>
      <div className="lc-eyebrow" data-lc-tone="accent"><Icon name="Zap" size={14} /> Universal Capture</div>
      <div className="lc-title" data-gap="md">Paste anything</div>
      <div className="lc-lede" data-gap="md">YouTube · Article URL · Development plan · Any text.</div>
      <textarea className="lc-input lc-textarea" value={captureInput} onChange={e => setCaptureInput(e.target.value)} aria-label="Content to capture"
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && captureInput.trim() && !ytLoading) handleCapture(); }}
        rows={6} placeholder={'https://youtube.com/watch?v=…\nhttps://an-article.com/…\n\nOr paste a development plan, notes, a transcript — anything.'} />
      <Btn color="var(--accent-text)" disabled={!captureInput.trim() || ytLoading} onClick={() => handleCapture()}>
        {ytLoading ? 'Reading & analyzing…' : 'Analyze →'}
      </Btn>
    </div>
  );

  if (screen === 'youtube-input') return (
    <div className="lc-page" data-w="narrow">
      <Back onClick={() => setScreen('home')}>← Back</Back>
      <div className="lc-eyebrow" data-lc-tone="negative"><Icon name="Play" size={14} /> YouTube Intelligence</div>
      <div className="lc-title" data-gap="lg">Paste a YouTube URL</div>
      <Input label="YouTube URL" value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://youtube.com/watch?v=..." />
      {ytError && <div className="lc-err">{ytError}</div>}
      <div className="lc-block">
        <Label>Mode</Label>
        <div className="lc-modes">
          {[{ id: 'chat', label: 'Teach Me' }, { id: 'socratic', label: 'Quiz Me', icon: 'Brain' }].map(m => (
            <button type="button" key={m.id} className="lc-mode tap" aria-pressed={sessionMode === m.id} onClick={() => setSessionMode(m.id)}>
              {m.icon && <Icon name={m.icon} size={16} />}{m.label}
            </button>
          ))}
        </div>
      </div>
      <Btn color={T.negative} disabled={!youtubeUrl.trim() || ytLoading} onClick={handleYouTube}>
        {ytLoading ? 'Fetching transcript...' : 'Analyze video'}
      </Btn>
    </div>
  );

  if (screen === 'session') {
    const sessionModeLabel = SESSION_MODES.find(m => m.id === sessionMode);
    const prompts = getQuickPrompts();
    const canSend = (input.trim() || annotationText.trim() || uploadedFiles.length > 0) && !loading;
    return (
      <div className="lc-session">
        <div className="lc-shead">
          <div className="lc-shead-row">
            <div className="lc-shead-main">
              <div className="lc-eyebrow">
                <span className="lc-shead-kind"><Icon name={entryMode === 'reading' ? currentContentType.icon : sessionModeLabel?.icon} size={14} /> {entryMode === 'reading' ? currentContentType.label : sessionModeLabel?.label}</span>
                {sessionTitle ? ` · ${sessionTitle.slice(0, isMobile ? 24 : 40)}${sessionTitle.length > (isMobile ? 24 : 40) ? '...' : ''}` : ''}
              </div>
              <div className="lc-tools">
                {entryMode === 'reading' && (
                  <span className="lc-tag" data-accent="">
                    <Icon name={READER_GOALS.find(g => g.id === readerGoal)?.icon} size={13} /> {READER_GOALS.find(g => g.id === readerGoal)?.label}
                  </span>
                )}
                <button type="button" className="lc-tag tap" aria-pressed={searchEnabled} onClick={() => setSearchEnabled(s => !s)}>
                  <Icon name="Search" size={13} /> Web {searchEnabled ? 'ON' : 'OFF'}
                </button>
                <button type="button" className="lc-tag tap" data-accent="" aria-busy={quizLoading || undefined} onClick={generateQuiz}>
                  {quizLoading ? '...' : <><Icon name="Brain" size={13} /> Quiz</>}
                </button>
                {entryMode === 'reading' && (
                  <button type="button" className="lc-tag tap" aria-pressed={showAnnotation} onClick={() => setShowAnnotation(s => !s)}>
                    <Icon name="MapPin" size={13} /> Passage
                  </button>
                )}
              </div>
            </div>
            <div className="lc-shead-actions">
              <button type="button" className="lc-shead-btn tap" data-accent="" onClick={() => setShowLogModal(true)}>Save session</button>
              <button type="button" className="lc-shead-btn tap" onClick={() => { setScreen('home'); setContext({}); setMessages([]); setUploadedFiles([]); setQuizMode(false); setShowAnnotation(false); setSessionErr(''); setQuizErr(''); }}>← Learn</button>
            </div>
          </div>
        </div>

        <div className="lc-thread" data-status={sessionStatus}>
          {sessionStatus === 'empty' && messages.length === 0 && (
            <div className="lc-col" data-flush="">
              <SectionEmpty what="No session yet" how="Ask a question below — or use Summarize / Quiz me — to start this session." />
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="lc-msg" data-role={msg.role}>
              {msg.role === 'user' ? (
                <div className="lc-ubub">{msg.content}</div>
              ) : (
                <div className="lc-abub">
                  <div className="lc-abub-head">
                    <div className="lc-abub-label">
                      {entryMode === 'reading' ? `${currentContentType.label} · ${DEPTH_LEVELS.find(d => d.id === depthLevel)?.label}` : 'CB Intelligence'}
                      {searchEnabled ? ' · Web' : ''}
                    </div>
                    <ProviderTag provider={msg.provider} />
                  </div>
                  <MD text={msg.content} color={accentColor} />
                  {msg.content.length > 220 && (
                    <DiagramBlock content={msg.content} hint="Diagram the structure of this explanation." label="Visualize" compact />
                  )}
                </div>
              )}
            </div>
          ))}
          {(quizLoading || quizErr) && (
            <div className="lc-col" data-status={quizLoading ? 'loading' : 'error'}>
              {quizLoading
                ? <SectionSkeleton rows={5} label="quiz" />
                : <SectionError label="the quiz" onRetry={generateQuiz} detail={quizErr} />}
            </div>
          )}
          {quizMode && quizQuestions.length > 0 && (
            <div className="lc-col" data-flush="">
              <QuizMode questions={quizQuestions} color={accentColor} onComplete={onQuizComplete} />
            </div>
          )}
          {loading && stream && (
            <div className="lc-msg">
              <div className="lc-abub">
                <div className="lc-abub-label">CB Intelligence</div>
                <MD text={stream + '▍'} color={accentColor} />
              </div>
            </div>
          )}
          {/* Skeleton only until the first streamed token arrives. */}
          {loading && !stream && (
            <div className="lc-col">
              <SectionSkeleton rows={messages.length ? 3 : 5} lead={!messages.length} label="response" />
            </div>
          )}
          {sessionStatus === 'error' && (
            <div className="lc-col">
              <SectionError label={lastFailRef.current?.kind === 'open' ? 'the session opener' : 'this reply'} onRetry={retrySession} detail={sessionErr} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!quizMode && (
          <div className="lc-dock">
            {/* Prominent action chips — surface the instant content loads */}
            {messages.length <= 1 && (
              <div className="lc-scroll" data-scroll-x="">
                {[
                  { label: 'Summarize', icon: 'Sparkles', onClick: () => send('Give me the CB-style summary — thesis first, then key points.') },
                  { label: 'Quiz me', icon: 'Brain', onClick: generateQuiz },
                  { label: 'Recommend related', icon: 'Share2', onClick: () => send('Recommend related content, creators, and books connected to my mental model library.') },
                ].map(a => (
                  <button type="button" key={a.label} className="lc-action" onClick={a.onClick}>
                    <Icon name={a.icon} size={16} /> {a.label}
                  </button>
                ))}
              </div>
            )}
            <div className="lc-scroll" data-gap="sm" data-scroll-x="">
              {prompts.slice(0, isMobile ? 2 : 5).map(p => (
                <button type="button" key={p} className="lc-qp" onClick={() => send(p)}>{p}</button>
              ))}
            </div>
          </div>
        )}

        <div className="lc-composer">
          {showAnnotation && (
            <div className="lc-passage">
              <div className="lc-passage-label"><Icon name="MapPin" size={13} /> PASTE A PASSAGE FROM YOUR TEXT</div>
              <textarea className="lc-passage-input" value={annotationText} onChange={e => setAnnotationText(e.target.value)} aria-label="Passage from your text"
                placeholder="Paste any passage, paragraph, or excerpt you want analyzed..."
                rows={3} />
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="lc-attached">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="lc-attached-chip">
                  <Icon name={f.icon} size={16} /> {f.name.slice(0, 16)}
                  <button type="button" className="lc-x tap" data-sm="" aria-label={`Remove ${f.name}`} onClick={() => setUploadedFiles(p => p.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="lc-compose-row">
            <button type="button" className="lc-attach tap" aria-label="Attach files" onClick={() => fileRef.current?.click()}><Icon name="Paperclip" size={16} /></button>
            {fileInput}
            <textarea className="lc-composer-input" value={input} onChange={e => setInput(e.target.value)} aria-label="Message"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); showAnnotation ? sendWithAnnotation() : send(input, uploadedFiles); } }}
              rows={1} placeholder={showAnnotation ? 'Add your question about the passage...' : 'Ask anything...'} />
            <button type="button" className="lc-send tap" aria-label="Send"
              onClick={() => showAnnotation ? sendWithAnnotation() : send(input, uploadedFiles)}
              disabled={!canSend}>→</button>
          </div>
        </div>

        {showLogModal && <LogSessionModal title={sessionTitle} color={accentColor} onLog={handleLogSession} onSkip={() => setShowLogModal(false)} />}
      </div>
    );
  }

  return null;
}

function LogSessionModal({ title, onLog, onSkip, color }) {
  const [conf, setConf] = useState(7);
  const [notes, setNotes] = useState('');
  return (
    <BottomSheet title={`Save session — ${title}`} accent={color} onClose={onSkip}>
      <div className="lc-block">
        <Label>Confidence Level: {conf}/10</Label>
        <input type="range" className="lc-range" min={1} max={10} value={conf} onChange={e => setConf(+e.target.value)} aria-label="Confidence level" />
        <div className="lc-scale">
          <span>Just started</span><span>Fuzzy</span><span>Solid</span><span>Mastered</span>
        </div>
      </div>
      <Textarea value={notes} onChange={setNotes} placeholder="Key insight or note (optional)..." rows={2} />
      <div className="lc-btns">
        <button type="button" className="lc-btn tap" onClick={onSkip}>Skip</button>
        <button type="button" className="lc-btn tap" data-grow="2" data-primary="" onClick={() => onLog(conf, notes)}>Save session</button>
      </div>
    </BottomSheet>
  );
}
