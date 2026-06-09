import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import {
  KNOWN_BOOKS, TYPE_META, SESSION_MODES, ACCEPT_TYPES,
  CONTENT_TYPES, READER_GOALS, DEPTH_LEVELS, READING_PROGRESS_OPTIONS,
} from '../constants.js';
import {
  buildSystem, buildReadingSystem, buildQuizPrompt, callClaude, buildApiMessages,
  logSession, saveGraph, extractYouTubeId, fetchYouTubeTranscript,
  fetchYouTubeMeta, processFiles,
} from '../utils.js';
import MD from './shared/MD.jsx';
import QuizMode from './shared/QuizMode.jsx';
import { Btn, Input, Textarea, Label, Card, Badge, ThinkingDots, BottomSheet } from './shared/Common.jsx';

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
  const { graph, setGraph, isMobile, isPhone, isTablet } = useApp();
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
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [webUrl, setWebUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [topicInput, setTopicInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [annotationText, setAnnotationText] = useState('');

  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const currentContentType = CONTENT_TYPES.find(t => t.id === contentType) || CONTENT_TYPES[0];
  const accentColor = entryMode === 'reading' ? currentContentType.color : '#00FFB2';
  const sessionTitle = entryMode === 'reading' ? context.title : entryMode === 'topic' ? context.topic : entryMode === 'youtube' ? context.title : 'Document';

  const send = async (text, attachments = []) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;
    const userMsg = { role: 'user', content: text, attachments };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setUploadedFiles([]);
    setLoading(true);
    try {
      const apiMessages = await buildApiMessages(newHistory);
      const system = entryMode === 'reading'
        ? buildReadingSystem({ contentType, goal: readerGoal, depth: depthLevel, progress: readingProgress, content: context, graph })
        : buildSystem(entryMode, sessionMode, context, graph);
      const reply = await callClaude({ system, messages: apiMessages, searchEnabled });
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Try again.' }]);
    }
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
      };
      opener = eMode === 'book' ? (openers.book[sMode] || openers.book.chat) : openers[eMode];
    }
    try {
      const system = eMode === 'reading'
        ? buildReadingSystem({ contentType: cType, goal, depth, progress, content: ctx, graph })
        : buildSystem(eMode, sMode, ctx, graph);
      const reply = await callClaude({ system, messages: [{ role: 'user', content: opener }] });
      setMessages([{ role: 'assistant', content: reply }]);
    } catch {
      setMessages([{ role: 'assistant', content: 'Ready. What would you like to explore?' }]);
    }
    setLoading(false);
  };

  const generateQuiz = async () => {
    setQuizLoading(true);
    try {
      const reply = await callClaude({ system: '', messages: [{ role: 'user', content: buildQuizPrompt(context, entryMode) }] });
      const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
      setQuizQuestions(parsed.questions || []);
      setQuizMode(true);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Quiz generation failed. Ask me to quiz you directly.' }]);
    }
    setQuizLoading(false);
  };

  const onQuizComplete = (scores) => {
    const pct = Math.round((scores.filter(s => s > 0).length / scores.length) * 100);
    setQuizMode(false);
    setQuizQuestions([]);
    setMessages(prev => [...prev, { role: 'assistant', content: `**Quiz Complete — ${pct}%**\n\n${pct >= 80 ? 'Strong. Core material internalized.' : pct >= 60 ? 'Solid foundation. Review what you missed.' : 'Early stages — this is data, not judgment. Run it again after another pass.'}\n\nWant to go deeper on anything you missed?` }]);
  };

  const handleYouTube = async () => {
    if (!youtubeUrl.trim()) return;
    const videoId = extractYouTubeId(youtubeUrl.trim());
    if (!videoId) { setYtError('Invalid YouTube URL.'); return; }
    setYtLoading(true); setYtError('');
    const [meta, transcript] = await Promise.all([fetchYouTubeMeta(videoId), fetchYouTubeTranscript(videoId)]);
    const ctx = { url: youtubeUrl.trim(), videoId, title: meta?.title || 'YouTube Video', channel: meta?.author_name || 'Unknown', transcript: transcript || '', transcriptAvailable: !!(transcript && transcript.length > 100) };
    setContext(ctx); setEntryMode('youtube'); setScreen('session'); setYoutubeUrl('');
    autoOpen('youtube', sessionMode, ctx);
    setYtLoading(false);
  };

  const handleLogSession = async (conf, notes) => {
    const durationMin = sessionStart ? Math.round((Date.now() - sessionStart) / 60000) : 5;
    const updated = await logSession(sessionTitle, entryMode, Math.max(durationMin, 1), conf, notes);
    setGraph(updated);
    setShowLogModal(false);
  };

  const getQuickPrompts = () => {
    if (entryMode === 'reading') return READING_QUICK_PROMPTS[contentType] || READING_QUICK_PROMPTS.nonfiction;
    const qp = {
      book: { package: ['Confirm format proposed', 'Go deeper on key framework', 'Connect to my mental models', 'Decisive action now'], readalong: ["What connects to my other books?", 'Watch for next?', 'Master-expert breakdown', 'Connect to my goals'], reference: ['Go master-expert deep', 'CB application', 'What am I missing?', 'Cross-book connection'], socratic: ['Next question', 'Go harder', 'Explain what I got wrong', 'Scorecard'], chat: ['Sharpest counterargument', 'Blue Ocean angle', 'What would Buffett say?', 'One decisive action'] },
      document: ['Core thesis', 'Extract key frameworks', 'Connect to my goals', 'What to act on now', 'Quiz me on this'],
      topic: ['Full course outline', 'Start Module 1', 'Tipping point in this field', 'Blue Ocean opportunities', 'Decisive bet'],
      youtube: ['3 biggest ideas', 'Connect to my mental models', 'What should I act on?', 'Quiz me on this video'],
    };
    if (entryMode === 'book') return qp.book[sessionMode] || qp.book.chat;
    return qp[entryMode] || qp.topic;
  };

  const pad = isMobile ? '16px 16px 70px' : '24px 28px 80px';

  if (screen === 'home') return (
    <div style={{ padding: pad, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 6 }}>CB · Learning Center</div>
        <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", letterSpacing: -0.5, marginBottom: 6 }}>What do you want to learn?</div>
        <div style={{ fontSize: 11, color: 'var(--subtle)' }}>Books · Documents · Topics · YouTube — all tracked, all connected.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { icon: '📚', label: 'Reading Companion', desc: 'Any book, paper, manual, or novel — personal mentor as you read.', color: '#00FFB2', action: () => setScreen('reading-add') },
          { icon: '🎓', label: 'Topic / Course', desc: 'Name any subject. I build a structured course.', color: '#ff8844', action: () => { setEntryMode('topic'); setScreen('topic-input'); } },
          { icon: '▶️', label: 'YouTube', desc: 'Paste a URL. Transcript extraction + deep analysis.', color: '#ff4444', action: () => { setEntryMode('youtube'); setScreen('youtube-input'); } },
          { icon: '📄', label: 'Document', desc: 'PDF, Word, Excel, image, or web link.', color: '#4488ff', action: () => { setEntryMode('document'); setScreen('doc-upload'); } },
        ].map(m => (
          <Card key={m.label} color={m.color} onClick={m.action} style={{ padding: '16px 18px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 24 }}>{m.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.55 }}>{m.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Knowledge Graph</Label>
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr 1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {[
            ['Topics', Object.keys(graph?.topics || {}).length, '#00FFB2'],
            ['Sessions', (graph?.sessions || []).length, '#6366F1'],
            ['Minutes', graph?.totalTime || 0, '#ff8844'],
            ['Avg Conf', (Object.values(graph?.topics || {}).length ? Math.round(Object.values(graph.topics).reduce((s, t) => s + t.confidence, 0) / Object.values(graph.topics).length) : 0) + '/10', '#ffcc44'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: 'var(--surface)', border: `1px solid ${color}20`, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'Fraunces', serif" }}>{val}</div>
              <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--dim)', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
        {Object.values(graph?.topics || {}).slice(0, 4).map(t => (
          <div key={t.title}
            onClick={() => { setContext({ topic: t.title }); setEntryMode('topic'); setSessionMode('chat'); setScreen('session'); autoOpen('topic', 'chat', { topic: t.title }); }}
            style={{ padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t.title}</div>
              <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 1 }}>{t.sessions} sessions · {t.totalMin}min · tap to continue</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.confidence >= 7 ? '#00FFB2' : t.confidence >= 4 ? '#ffcc44' : '#ff6644' }}>{t.confidence}/10</div>
              <div style={{ fontSize: 10, color: 'var(--subtle)' }}>→</div>
            </div>
          </div>
        ))}
      </div>
      <div onClick={() => setScreen('book-select')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', textAlign: 'center', padding: '10px', borderTop: '1px solid var(--bord2)', marginTop: 8 }}>
        Browse CB Reading List →
      </div>
    </div>
  );

  if (screen === 'reading-add') return (
    <div style={{ padding: pad, maxWidth: 640, margin: '0 auto' }}>
      <div onClick={() => setScreen('home')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 16 }}>← Learn</div>
      <div style={{ fontSize: 9, letterSpacing: 4, color: '#00FFB2', textTransform: 'uppercase', marginBottom: 8 }}>📚 Reading Companion</div>
      <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 6 }}>What are you reading?</div>
      <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 24 }}>Book, paper, manual, textbook, novel — anything.</div>

      <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Title *"
        style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text-b)', fontSize: 14, outline: 'none', fontFamily: 'inherit', fontWeight: 700, boxSizing: 'border-box', marginBottom: 10 }} />
      <input value={customAuthor} onChange={e => setCustomAuthor(e.target.value)} placeholder="Author / Source (optional)"
        style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 20 }} />

      <Label>Quick-add from reading list</Label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {KNOWN_BOOKS.slice(0, 10).map(b => (
          <div key={b.title} onClick={() => { setCustomTitle(b.title); setCustomAuthor(b.author); }}
            style={{ fontSize: 10, padding: '4px 10px', background: customTitle === b.title ? `${b.color}20` : 'var(--surface)', border: `1px solid ${customTitle === b.title ? b.color : 'var(--border)'}`, color: customTitle === b.title ? b.color : 'var(--subtle)', borderRadius: 20, cursor: 'pointer' }}>
            {b.title}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div onClick={() => setScreen('book-select')} style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--subtle)', cursor: 'pointer' }}>Browse Full List</div>
        <div onClick={() => { if (!customTitle.trim()) return; setContext({ title: customTitle.trim(), author: customAuthor.trim() }); setScreen('content-type'); }}
          style={{ flex: 2, padding: '11px', background: customTitle.trim() ? '#00FFB2' : 'var(--bord2)', borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: customTitle.trim() ? '#000' : 'var(--dim)', cursor: customTitle.trim() ? 'pointer' : 'default' }}>
          Continue →
        </div>
      </div>
    </div>
  );

  if (screen === 'content-type') return (
    <div style={{ padding: pad, maxWidth: 640, margin: '0 auto' }}>
      <div onClick={() => setScreen('reading-add')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 16 }}>← Back</div>
      <div style={{ fontSize: 9, letterSpacing: 3, color: '#00FFB2', textTransform: 'uppercase', marginBottom: 6 }}>Step 1 of 2</div>
      <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>What type of content is this?</div>
      <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 20 }}>"{context.title}"</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
        {CONTENT_TYPES.map(t => (
          <div key={t.id} onClick={() => setContentType(t.id)}
            style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${contentType === t.id ? t.color : 'var(--bord2)'}`, background: contentType === t.id ? `${t.color}12` : 'var(--surface)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: contentType === t.id ? t.color : 'var(--text)' }}>{t.label}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--subtle)', lineHeight: 1.5 }}>{t.examples}</div>
          </div>
        ))}
      </div>
      <div onClick={() => setScreen('reader-setup')}
        style={{ width: '100%', padding: '12px', background: currentContentType.color, borderRadius: 10, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#000', cursor: 'pointer', boxSizing: 'border-box' }}>
        Continue →
      </div>
    </div>
  );

  if (screen === 'reader-setup') return (
    <div style={{ padding: pad, maxWidth: 640, margin: '0 auto' }}>
      <div onClick={() => setScreen('content-type')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 16 }}>← Back</div>
      <div style={{ fontSize: 9, letterSpacing: 3, color: currentContentType.color, textTransform: 'uppercase', marginBottom: 6 }}>Step 2 of 2</div>
      <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>How do you want to engage?</div>
      <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 22 }}>"{context.title}"</div>

      <Label>Your Goal</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
        {READER_GOALS.map(g => (
          <div key={g.id} onClick={() => setReaderGoal(g.id)}
            style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${readerGoal === g.id ? currentContentType.color : 'var(--bord2)'}`, background: readerGoal === g.id ? `${currentContentType.color}10` : 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>{g.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: readerGoal === g.id ? currentContentType.color : 'var(--text)' }}>{g.label}</div>
              <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{g.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <Label>Depth Level</Label>
      <div style={{ display: 'flex', gap: 7, marginBottom: 20, flexWrap: 'wrap' }}>
        {DEPTH_LEVELS.map(d => (
          <div key={d.id} onClick={() => setDepthLevel(d.id)}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${depthLevel === d.id ? currentContentType.color : 'var(--bord2)'}`, background: depthLevel === d.id ? `${currentContentType.color}15` : 'var(--surface)', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: depthLevel === d.id ? currentContentType.color : 'var(--text)' }}>{d.label}</div>
            <div style={{ fontSize: 9, color: 'var(--subtle)', marginTop: 2 }}>{d.desc}</div>
          </div>
        ))}
      </div>

      <Label>Where are you in this content?</Label>
      <div style={{ display: 'flex', gap: 7, marginBottom: 24, flexWrap: 'wrap' }}>
        {READING_PROGRESS_OPTIONS.map(p => (
          <div key={p.id} onClick={() => setReadingProgress(p.id)}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${readingProgress === p.id ? currentContentType.color : 'var(--bord2)'}`, background: readingProgress === p.id ? `${currentContentType.color}15` : 'var(--surface)', cursor: 'pointer', fontSize: 11, fontWeight: readingProgress === p.id ? 700 : 400, color: readingProgress === p.id ? currentContentType.color : 'var(--subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{p.icon}</span> {p.label}
          </div>
        ))}
      </div>

      <div onClick={() => { setEntryMode('reading'); setScreen('session'); autoOpen('reading', sessionMode, context, contentType, readerGoal, depthLevel, readingProgress); }}
        style={{ width: '100%', padding: '13px', background: currentContentType.color, borderRadius: 10, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#000', cursor: 'pointer', boxSizing: 'border-box' }}>
        Start Session →
      </div>
    </div>
  );

  if (screen === 'book-select') return (
    <div style={{ padding: pad, maxWidth: 800, margin: '0 auto' }}>
      <div onClick={() => setScreen('home')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 16 }}>← Learn</div>
      <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 14 }}>CB Reading List · {KNOWN_BOOKS.length} Books</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['all', ...Object.keys(TYPE_META)].map(t => (
          <div key={t} onClick={() => setFilterType(t)}
            style={{ padding: '4px 12px', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', border: `1px solid ${filterType === t ? '#00FFB2' : 'var(--bord2)'}`, color: filterType === t ? '#00FFB2' : 'var(--subtle)', borderRadius: 20, cursor: 'pointer', background: filterType === t ? '#00FFB218' : 'transparent' }}>
            {t === 'all' ? 'All' : TYPE_META[t]?.label}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 24 }}>
        {(filterType === 'all' ? KNOWN_BOOKS : KNOWN_BOOKS.filter(b => b.type === filterType)).map(book => (
          <div key={book.title} onClick={() => { setContext({ title: book.title, author: book.author }); setContentType('nonfiction'); setScreen('reader-setup'); }}
            style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid var(--bord2)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{book.title}</div>
              <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{book.author}</div>
            </div>
            <div style={{ fontSize: 9, color: book.color, textAlign: 'right' }}>
              <div style={{ fontSize: 14 }}>{TYPE_META[book.type]?.icon}</div>
              <div style={{ marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>{TYPE_META[book.type]?.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div onClick={() => setScreen('reading-add')} style={{ textAlign: 'center', fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', padding: 10 }}>
        + Add any other book or content
      </div>
    </div>
  );

  if (screen === 'doc-upload') return (
    <div style={{ padding: pad, maxWidth: 640, margin: '0 auto' }}>
      <div onClick={() => setScreen('home')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 16 }}>← Back</div>
      <div style={{ fontSize: 9, letterSpacing: 4, color: '#4488ff', textTransform: 'uppercase', marginBottom: 8 }}>📄 Document Intelligence</div>
      <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: 'var(--text)', marginBottom: 20, fontFamily: "'Fraunces', serif" }}>Upload Your Document</div>
      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={async e => { e.preventDefault(); setDragOver(false); const files = await processFiles(e.dataTransfer.files); setUploadedFiles(p => [...p, ...files]); }}
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${dragOver ? '#4488ff' : 'var(--border)'}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: dragOver ? '#4488ff08' : 'transparent' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 3 }}>Drop files or tap to browse</div>
        <div style={{ fontSize: 10, color: 'var(--subtle)' }}>PDF · Word · Excel · PowerPoint · Images</div>
        <input ref={fileRef} type="file" multiple accept={ACCEPT_TYPES} style={{ display: 'none' }} onChange={async e => { const files = await processFiles(e.target.files); setUploadedFiles(p => [...p, ...files]); }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Or Paste a Web Link</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={webUrl} onChange={e => setWebUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && webUrl.trim() && (setUploadedFiles(p => [...p, { type: 'url', url: webUrl, name: webUrl, icon: '🔗', label: 'Web Link' }]), setWebUrl(''))}
            placeholder="https://..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 13, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={() => { if (webUrl.trim()) { setUploadedFiles(p => [...p, { type: 'url', url: webUrl, name: webUrl, icon: '🔗', label: 'Web Link' }]); setWebUrl(''); } }}
            style={{ padding: '10px 14px', background: '#4488ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Add</button>
        </div>
      </div>
      {uploadedFiles.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {uploadedFiles.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{f.icon}</span>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
              <div onClick={() => setUploadedFiles(p => p.filter((_, j) => j !== i))} style={{ color: '#ff4444', cursor: 'pointer', fontSize: 14 }}>✕</div>
            </div>
          ))}
        </div>
      )}
      <Btn color="#4488ff" disabled={uploadedFiles.length === 0} onClick={() => { setContext({ files: uploadedFiles }); setEntryMode('document'); setScreen('session'); autoOpen('document', sessionMode, { files: uploadedFiles }); }}>
        Analyze {uploadedFiles.length > 1 ? `${uploadedFiles.length} Documents` : 'Document'} →
      </Btn>
    </div>
  );

  if (screen === 'topic-input') return (
    <div style={{ padding: pad, maxWidth: 640, margin: '0 auto' }}>
      <div onClick={() => setScreen('home')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 16 }}>← Back</div>
      <div style={{ fontSize: 9, letterSpacing: 4, color: '#ff8844', textTransform: 'uppercase', marginBottom: 8 }}>🎓 Topic / Course Builder</div>
      <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: 'var(--text)', marginBottom: 20, fontFamily: "'Fraunces', serif" }}>What do you want to master?</div>
      <Textarea value={topicInput} onChange={setTopicInput} rows={3} placeholder={'ERCOT energy markets\nReal estate underwriting\nSemiconductor supply chain\nNegotiation psychology'} />
      <div style={{ marginBottom: 16 }}>
        <Label>Mode</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: 'chat', label: 'Course Build' }, { id: 'socratic', label: '🧠 Quiz Me' }].map(m => (
            <div key={m.id} onClick={() => setSessionMode(m.id)}
              style={{ flex: 1, padding: '10px', border: `1px solid ${sessionMode === m.id ? '#ff8844' : 'var(--bord2)'}`, borderRadius: 8, textAlign: 'center', fontSize: 11, color: sessionMode === m.id ? '#ff8844' : 'var(--subtle)', cursor: 'pointer', background: sessionMode === m.id ? '#ff884408' : 'transparent' }}>
              {m.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['ERCOT energy markets', 'Real estate underwriting', 'Semiconductor supply chain', 'Options basics', 'Negotiation psychology', 'Longevity & biohacking', 'AI agents', 'Dividend investing'].map(s => (
          <div key={s} onClick={() => setTopicInput(s)} style={{ fontSize: 10, padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 20, cursor: 'pointer' }}>{s}</div>
        ))}
      </div>
      <Btn color="#ff8844" disabled={!topicInput.trim()} onClick={() => { setContext({ topic: topicInput }); setEntryMode('topic'); setScreen('session'); autoOpen('topic', sessionMode, { topic: topicInput }); }}>
        {sessionMode === 'socratic' ? 'Start Quiz →' : 'Build My Course →'}
      </Btn>
    </div>
  );

  if (screen === 'youtube-input') return (
    <div style={{ padding: pad, maxWidth: 640, margin: '0 auto' }}>
      <div onClick={() => setScreen('home')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 16 }}>← Back</div>
      <div style={{ fontSize: 9, letterSpacing: 4, color: '#ff4444', textTransform: 'uppercase', marginBottom: 8 }}>▶️ YouTube Intelligence</div>
      <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: 'var(--text)', marginBottom: 20, fontFamily: "'Fraunces', serif" }}>Paste a YouTube URL</div>
      <Input label="YouTube URL" value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://youtube.com/watch?v=..." />
      {ytError && <div style={{ fontSize: 11, color: '#ff4444', marginBottom: 12, padding: '8px 12px', background: '#ff444412', borderRadius: 6 }}>{ytError}</div>}
      <div style={{ marginBottom: 16 }}>
        <Label>Mode</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: 'chat', label: 'Teach Me' }, { id: 'socratic', label: '🧠 Quiz Me' }].map(m => (
            <div key={m.id} onClick={() => setSessionMode(m.id)}
              style={{ flex: 1, padding: '10px', border: `1px solid ${sessionMode === m.id ? '#ff4444' : 'var(--bord2)'}`, borderRadius: 8, textAlign: 'center', fontSize: 11, color: sessionMode === m.id ? '#ff4444' : 'var(--subtle)', cursor: 'pointer', background: sessionMode === m.id ? '#ff444408' : 'transparent' }}>
              {m.label}
            </div>
          ))}
        </div>
      </div>
      <Btn color="#ff4444" disabled={!youtubeUrl.trim() || ytLoading} onClick={handleYouTube}>
        {ytLoading ? 'Fetching transcript...' : 'Analyze Video →'}
      </Btn>
    </div>
  );

  if (screen === 'session') {
    const sessionModeLabel = SESSION_MODES.find(m => m.id === sessionMode);
    const prompts = getQuickPrompts();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--bord2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: accentColor, textTransform: 'uppercase', marginBottom: 3 }}>
                {entryMode === 'reading' ? `${currentContentType.icon} ${currentContentType.label}` : `${sessionModeLabel?.icon} ${sessionModeLabel?.label}`}
                {sessionTitle ? ` · ${sessionTitle.slice(0, isMobile ? 24 : 40)}${sessionTitle.length > (isMobile ? 24 : 40) ? '...' : ''}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {entryMode === 'reading' && (
                  <div style={{ fontSize: 9, padding: '2px 7px', background: `${accentColor}15`, border: `1px solid ${accentColor}30`, borderRadius: 6, color: accentColor }}>
                    {READER_GOALS.find(g => g.id === readerGoal)?.icon} {READER_GOALS.find(g => g.id === readerGoal)?.label}
                  </div>
                )}
                <div onClick={() => setSearchEnabled(s => !s)}
                  style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${searchEnabled ? '#4488ff' : 'var(--border)'}`, borderRadius: 6, color: searchEnabled ? '#4488ff' : 'var(--dim)', cursor: 'pointer' }}>
                  🔍 Web {searchEnabled ? 'ON' : 'OFF'}
                </div>
                <div onClick={generateQuiz} style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${accentColor}40`, borderRadius: 6, color: accentColor, cursor: 'pointer', background: `${accentColor}10` }}>
                  {quizLoading ? '...' : '🧠 Quiz'}
                </div>
                {entryMode === 'reading' && (
                  <div onClick={() => setShowAnnotation(s => !s)} style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${showAnnotation ? accentColor : 'var(--border)'}`, borderRadius: 6, color: showAnnotation ? accentColor : 'var(--dim)', cursor: 'pointer', background: showAnnotation ? `${accentColor}10` : 'transparent' }}>
                    📌 Passage
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <div onClick={() => setShowLogModal(true)} style={{ fontSize: 10, color: accentColor, padding: '5px 10px', border: `1px solid ${accentColor}40`, borderRadius: 6, cursor: 'pointer' }}>Log</div>
              <div onClick={() => { setScreen('home'); setContext({}); setMessages([]); setUploadedFiles([]); setQuizMode(false); setShowAnnotation(false); }} style={{ fontSize: 10, color: 'var(--subtle)', padding: '5px 10px', border: '1px solid var(--bord2)', borderRadius: 6, cursor: 'pointer' }}>← Learn</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 200px' }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{entryMode === 'reading' ? currentContentType.icon : '📚'}</div>
              <div style={{ fontSize: 13, color: 'var(--dim)' }}>Initializing...</div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 18, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: 720, margin: '0 auto 18px' }}>
              {msg.role === 'user' ? (
                <div style={{ background: 'var(--u-bubble)', border: '1px solid var(--u-bubble-b)', borderRadius: '16px 16px 4px 16px', padding: '11px 15px', maxWidth: '85%', fontSize: 13, lineHeight: 1.7, color: 'var(--u-bubble-text)' }}>{msg.content}</div>
              ) : (
                <div style={{ background: 'var(--surface)', border: `1px solid ${accentColor}18`, borderRadius: '4px 16px 16px 16px', padding: '14px 18px', maxWidth: '92%', width: '100%' }}>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: accentColor, textTransform: 'uppercase', marginBottom: 10 }}>
                    {entryMode === 'reading' ? `${currentContentType.label} · ${DEPTH_LEVELS.find(d => d.id === depthLevel)?.label}` : 'CB Intelligence'}
                    {searchEnabled ? ' · 🔍 Web' : ''}
                  </div>
                  <MD text={msg.content} color={accentColor} />
                </div>
              )}
            </div>
          ))}
          {quizMode && quizQuestions.length > 0 && (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <QuizMode questions={quizQuestions} color={accentColor} onComplete={onQuizComplete} />
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: 720, margin: '0 auto 18px' }}>
              <div style={{ background: 'var(--surface)', border: `1px solid ${accentColor}18`, borderRadius: '4px 16px 16px 16px', padding: '12px 16px' }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: accentColor, textTransform: 'uppercase', marginBottom: 8 }}>Thinking...</div>
                <ThinkingDots color={accentColor} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!quizMode && (
          <div style={{ position: 'sticky', bottom: 72, left: 0, right: 0, padding: '0 12px 6px', background: 'linear-gradient(transparent, var(--bg) 30%)', display: 'flex', gap: 5, overflowX: 'auto' }}>
            {prompts.slice(0, isMobile ? 2 : 5).map(p => (
              <div key={p} onClick={() => send(p)} style={{ fontSize: 10, padding: '5px 11px', background: 'var(--surface)', border: '1px solid var(--bord2)', color: 'var(--subtle)', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center' }}>{p}</div>
            ))}
          </div>
        )}

        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', borderTop: '1px solid var(--bord2)', padding: '8px 12px 12px' }}>
          {showAnnotation && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: accentColor, letterSpacing: 1, marginBottom: 4 }}>📌 PASTE A PASSAGE FROM YOUR TEXT</div>
              <textarea value={annotationText} onChange={e => setAnnotationText(e.target.value)}
                placeholder="Paste any passage, paragraph, or excerpt you want analyzed..."
                rows={3} style={{ width: '100%', background: `${accentColor}08`, border: `1px solid ${accentColor}30`, borderRadius: 8, padding: '8px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
              {uploadedFiles.map((f, i) => (
                <div key={i} style={{ fontSize: 9, color: '#4488ff', background: '#4488ff12', border: '1px solid #4488ff30', borderRadius: 5, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {f.icon} {f.name.slice(0, 16)}<span onClick={() => setUploadedFiles(p => p.filter((_, j) => j !== i))} style={{ color: '#ff4444', cursor: 'pointer' }}>✕</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 7, maxWidth: 720, margin: '0 auto', alignItems: 'flex-end' }}>
            <div onClick={() => fileRef.current?.click()} style={{ padding: '9px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--subtle)', fontSize: 13, flexShrink: 0 }}>📎</div>
            <input ref={fileRef} type="file" multiple accept={ACCEPT_TYPES} style={{ display: 'none' }} onChange={async e => { const files = await processFiles(e.target.files); setUploadedFiles(p => [...p, ...files]); }} />
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); showAnnotation ? sendWithAnnotation() : send(input, uploadedFiles); } }}
              rows={1} placeholder={showAnnotation ? 'Add your question about the passage...' : 'Ask anything...'}
              style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: isMobile ? '12px 14px' : '9px 13px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 13, outline: 'none', fontFamily: 'inherit', resize: 'none', maxHeight: 90 }} />
            <button onClick={() => showAnnotation ? sendWithAnnotation() : send(input, uploadedFiles)}
              disabled={(!input.trim() && !annotationText.trim() && uploadedFiles.length === 0) || loading}
              style={{ padding: '9px 14px', background: (input.trim() || annotationText.trim() || uploadedFiles.length > 0) && !loading ? accentColor : 'var(--bord2)', border: 'none', borderRadius: 9, color: (input.trim() || annotationText.trim() || uploadedFiles.length > 0) && !loading ? '#000' : 'var(--dim)', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>→</button>
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
    <BottomSheet title={`Log: ${title}`} accent={color} onClose={onSkip}>
      <div style={{ marginBottom: 16 }}>
        <Label>Confidence Level: {conf}/10</Label>
        <input type="range" min={1} max={10} value={conf} onChange={e => setConf(+e.target.value)} style={{ width: '100%', accentColor: color }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', marginTop: 4 }}>
          <span>Just started</span><span>Fuzzy</span><span>Solid</span><span>Mastered</span>
        </div>
      </div>
      <Textarea value={notes} onChange={setNotes} placeholder="Key insight or note (optional)..." rows={2} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={onSkip} style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--subtle)', cursor: 'pointer' }}>Skip</div>
        <div onClick={() => onLog(conf, notes)} style={{ flex: 2, padding: '11px', background: color, borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Log Session →</div>
      </div>
    </BottomSheet>
  );
}
