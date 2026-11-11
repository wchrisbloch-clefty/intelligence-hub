import { useState } from 'react';
import { useApp } from '../App.jsx';
import { callClaude } from '../utils.js';
import { SYSTEM_LEARNING } from '../constants.js';
import MD from './shared/MD.jsx';
import { Card, Label, Badge, Btn, ThinkingDots } from './shared/Common.jsx';
import Icon from './shared/Icon.jsx';
import './growth-tools.css';

const GOALS = [
  { id: 'passive', label: '$10K+/mo Passive Income', target: 10000, current: 0, unit: '/mo', color: 'var(--accent-text)', icon: 'DollarSign', horizon: '3-5 years' },
  { id: 'health', label: 'Longevity Protocol Active', target: 5, current: 3, unit: ' / 5 pillars', color: 'var(--accent-text)', icon: 'Zap', horizon: 'Ongoing' },
  { id: 'business', label: 'Scalable Business Revenue', target: 50000, current: 0, unit: '/mo', color: 'var(--accent-text)', icon: 'BarChart3', horizon: '5 years' },
  { id: 'learning', label: 'Learning Hours This Year', target: 200, current: 15, unit: 'h', color: 'var(--accent-text)', icon: 'BookMarked', horizon: '2025' },
];

const SKILLS = [
  { name: 'Business Development', level: 9, growth: '+0', color: 'var(--accent-text)' },
  { name: 'Real Estate Investing', level: 6, growth: '+2', color: 'var(--accent-text)' },
  { name: 'Negotiation', level: 8, growth: '+1', color: 'var(--accent-text)' },
  { name: 'Capital Allocation', level: 5, growth: '+1', color: 'var(--accent-text)' },
  { name: 'Stoic Leadership', level: 8, growth: '0', color: 'var(--accent-text)' },
  { name: 'Systems Thinking', level: 7, growth: '+1', color: 'var(--accent-text)' },
  { name: 'Health/Longevity', level: 7, growth: '+2', color: 'var(--accent-text)' },
  { name: 'AI/Technology', level: 4, growth: '+2', color: 'var(--accent-text)' },
];

const CERTS = [
  { name: 'Real Estate License', status: 'exploring', color: 'var(--accent-text)' },
  { name: 'CFA Level 1', status: 'exploring', color: 'var(--accent-text)' },
  { name: 'Options Trading (CBOE)', status: 'exploring', color: 'var(--accent-text)' },
];

export default function GrowthTools() {
  const { graph, projects, setChatPrefill, setChatOpen } = useApp();
  const [synthesis, setSynthesis] = useState('');
  const [synthLoading, setSynthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('goals');
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [goalAI, setGoalAI] = useState({});
  const [goalAILoading, setGoalAILoading] = useState(null);
  const [expandedSkill, setExpandedSkill] = useState(null);
  const [skillAI, setSkillAI] = useState({});
  const [skillAILoading, setSkillAILoading] = useState(null);
  const [certAI, setCertAI] = useState({});
  const [certAILoading, setCertAILoading] = useState(null);

  const getGoalAI = async (goal) => {
    if (expandedGoal === goal.id) { setExpandedGoal(null); return; }
    setExpandedGoal(goal.id);
    if (goalAI[goal.id]) return;
    setGoalAILoading(goal.id);
    try {
      const r = await callClaude({ system: SYSTEM_LEARNING, messages: [{ role: 'user', content: `CB's goal: ${goal.label}. Current: ${goal.current}${goal.unit} of ${goal.target}${goal.unit} (${Math.min(100, Math.round((goal.current / goal.target) * 100))}%). Horizon: ${goal.horizon}.\n\nGive CB: (1) the single biggest lever to accelerate progress toward this goal, (2) one common mistake to avoid, (3) a specific 30-day sprint target. Be decisive and CB-specific.` }], maxTokens: 500 });
      setGoalAI(p => ({ ...p, [goal.id]: r }));
    } catch { setGoalAI(p => ({ ...p, [goal.id]: 'Network error — try again.' })); }
    setGoalAILoading(null);
  };

  const getSkillAI = async (skill) => {
    if (expandedSkill === skill.name) { setExpandedSkill(null); return; }
    setExpandedSkill(skill.name);
    if (skillAI[skill.name]) return;
    setSkillAILoading(skill.name);
    try {
      const r = await callClaude({ system: SYSTEM_LEARNING, messages: [{ role: 'user', content: `CB's skill: ${skill.name} — self-assessed ${skill.level}/10, growth trend ${skill.growth}.\n\nGive CB: (1) what getting from ${skill.level} to ${Math.min(10, skill.level + 2)} looks like in practice, (2) the highest-leverage resource or method to level up this skill, (3) how this skill connects to CB's BD/investing/Houston goals. Be specific.` }], maxTokens: 450 });
      setSkillAI(p => ({ ...p, [skill.name]: r }));
    } catch { setSkillAI(p => ({ ...p, [skill.name]: 'Network error — try again.' })); }
    setSkillAILoading(null);
  };

  const getCertAI = async (cert) => {
    if (certAI[cert.name]) { setCertAI(p => ({ ...p, [cert.name]: '' })); return; }
    setCertAILoading(cert.name);
    try {
      const r = await callClaude({ system: SYSTEM_LEARNING, messages: [{ role: 'user', content: `CB is exploring the ${cert.name} certification (status: ${cert.status}). Give CB: (1) honest ROI assessment — is this worth the time and money for a BD professional/investor in Houston? (2) time commitment and difficulty, (3) decisive recommendation: pursue, deprioritize, or find a better alternative.` }], maxTokens: 450 });
      setCertAI(p => ({ ...p, [cert.name]: r }));
    } catch { setCertAI(p => ({ ...p, [cert.name]: 'Network error — try again.' })); }
    setCertAILoading(null);
  };

  const totalMin = graph?.totalTime || 0;
  const streak = graph?.streak || 0;
  const topics = Object.values(graph?.topics || {});
  const avgConf = topics.length ? Math.round(topics.reduce((s, t) => s + t.confidence, 0) / topics.length) : 0;

  const generateSynthesis = async () => {
    setSynthLoading(true);
    try {
      const topicList = topics.slice(-5).map(t => `${t.title} (confidence ${t.confidence}/10)`).join(', ');
      const projList = projects.filter(p => p.status === 'active').map(p => p.title).join(', ');
      const prompt = `CB's Growth Synthesis Request:\n\nRecent learning: ${topicList}\nActive projects: ${projList}\nLearning streak: ${streak} days\nTotal learning: ${Math.round(totalMin / 60)}h\n\nGenerate a decisive growth synthesis: (1) What is compounding right now in CB's favor? (2) What's the biggest gap between where he is and where he wants to be? (3) The single highest-leverage action for the next 90 days — be specific, be decisive. Format in CB style: big picture first, decisive action last.`;
      const reply = await callClaude({ system: SYSTEM_LEARNING, messages: [{ role: 'user', content: prompt }], maxTokens: 800 });
      setSynthesis(reply);
    } catch {
      setSynthesis('Network error. Try again.');
    }
    setSynthLoading(false);
  };

  const tabs = [
    { id: 'goals', label: 'Goals' },
    { id: 'skills', label: 'Skills' },
    { id: 'synthesis', label: 'Synthesis' },
    { id: 'certs', label: 'Certs' },
  ];

  return (
    <div className="gt">
      <div className="gt-head">
        <div className="gt-eyebrow">Growth & Synthesis</div>
        <div className="gt-title">Compounding Dashboard</div>
        <div className="gt-sub">Goals · Skills · Synthesis · Certifications</div>
      </div>

      <div className="gt-stats">
        {[
          { label: 'Avg Confidence', value: avgConf + '/10', color: 'var(--accent-text)', icon: 'Target' },
          { label: 'Topics Mastered', value: topics.filter(t => t.confidence >= 7).length, color: 'var(--accent-text)', icon: 'Check' },
          { label: 'Streak', value: streak + 'd', color: 'var(--accent-text)', icon: 'Flame' },
          { label: 'Hours Invested', value: Math.round(totalMin / 60) + 'h', color: 'var(--accent-text)', icon: 'Clock' },
        ].map(s => (
          <Card key={s.label} color={s.color} style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div className="gt-stat-ico"><Icon name={s.icon} size="header" /></div>
            <div className="gt-stat-val">{s.value}</div>
            <div className="gt-stat-label">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="gt-tabs" role="tablist" aria-label="Growth sections">
        {tabs.map(t => (
          <button type="button" key={t.id} role="tab" className="gt-tab tap" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'goals' && (
        <div className="gt-goals">
          {GOALS.map(g => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            const isExpanded = expandedGoal === g.id;
            return (
              <Card key={g.id} color={g.color} style={{ padding: 0 }}>
                <button type="button" className="gt-goal" aria-expanded={isExpanded} onClick={() => getGoalAI(g)}>
                  <div className="gt-goal-top">
                    <Icon name={g.icon} size={24} className="gt-ico" />
                    <div className="gt-goal-meta">
                      <div className="gt-horizon">{g.horizon}</div>
                      <Icon name="ChevronDown" size={14} className="gt-chev" data-open={isExpanded ? '' : undefined} />
                    </div>
                  </div>
                  <div className="gt-goal-label">{g.label}</div>
                  <div className="gt-goal-nums">{g.current}{g.unit} / {g.target}{g.unit}</div>
                  <div className="gt-bar"><span style={{ '--pct': `${pct}%` }} /></div>
                  <div className="gt-goal-pct">{pct}% to goal · tap for AI insights</div>
                </button>
                {isExpanded && (
                  <div className="gt-goal-panel">
                    {goalAILoading === g.id
                      ? <ThinkingDots color={g.color} />
                      : goalAI[g.id]
                        ? <MD text={goalAI[g.id]} color={g.color} />
                        : null}
                    <button type="button" className="gt-ask tap" onClick={() => { setChatPrefill(`Help me make progress on my goal: ${g.label}. I'm at ${g.current}${g.unit} out of ${g.target}${g.unit}.`); setChatOpen(true); }}>
                      <Icon name="MessageSquare" size={14} /> Ask CB AI about this goal
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'skills' && (
        <div>
          <Label>Skill Radar — Self Assessment · tap any skill for AI coaching</Label>
          <div className="gt-skills">
            {SKILLS.map(s => {
              const isExp = expandedSkill === s.name;
              return (
                <div key={s.name} className="gt-skill" data-open={isExp ? '' : undefined}>
                  <button type="button" className="gt-skill-btn" aria-expanded={isExp} onClick={() => getSkillAI(s)}>
                    <div className="gt-skill-top">
                      <div className="gt-skill-name">{s.name}</div>
                      <div className="gt-skill-meta">
                        <div className="gt-skill-growth" data-up={s.growth.startsWith('+') ? '' : undefined}>{s.growth}</div>
                        <div className="gt-skill-level">{s.level}/10</div>
                        <Icon name="ChevronDown" size={14} className="gt-chev" data-open={isExp ? '' : undefined} />
                      </div>
                    </div>
                    <div className="gt-bar gt-bar-thin"><span style={{ '--pct': `${s.level * 10}%` }} /></div>
                  </button>
                  {isExp && (
                    <div className="gt-skill-panel">
                      {skillAILoading === s.name
                        ? <ThinkingDots color={s.color} />
                        : skillAI[s.name]
                          ? <MD text={skillAI[s.name]} color={s.color} />
                          : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="gt-callout">
            <div className="gt-callout-kick"><Icon name="Target" size={14} /> Top leverage skill to develop next</div>
            <div className="gt-callout-body">AI/Technology (currently 4/10) — highest asymmetric upside given your BD + real estate focus. A BD professional fluent in AI tools is a rare, compounding edge.</div>
          </div>
        </div>
      )}

      {activeTab === 'synthesis' && (
        <div>
          <div className="gt-synth-head">
            <div className="gt-synth-id">
              <Label>Growth Synthesis</Label>
              <div className="gt-synth-sub">AI-generated · Based on your learning history, projects, and goals</div>
            </div>
            <button type="button" className="btn btn-primary gt-gen tap" aria-busy={synthLoading} onClick={generateSynthesis}>
              {synthLoading ? '...' : <><Icon name="Zap" size={14} /> Generate</>}
            </button>
          </div>
          {synthLoading && (
            <Card color="var(--accent-text)" style={{ padding: '20px' }}>
              <div className="gt-kick">Analyzing your growth trajectory...</div>
              <ThinkingDots color="var(--accent-text)" />
            </Card>
          )}
          {synthesis && !synthLoading && (
            <Card color="var(--accent-text)" style={{ padding: '20px' }}>
              <div className="gt-kick gt-kick-sm">Growth Synthesis · CB Intelligence</div>
              <MD text={synthesis} color="var(--accent-text)" />
            </Card>
          )}
          {!synthesis && !synthLoading && (
            <div className="gt-empty">
              <div className="gt-empty-ico"><Icon name="Zap" size={40} strokeWidth={1.5} /></div>
              <div className="gt-empty-title">Get your Growth Synthesis</div>
              <div className="gt-empty-body">AI analysis of what's compounding in your favor, your biggest gap, and the highest-leverage action for the next 90 days.</div>
              <button type="button" className="btn btn-primary gt-gen-lg tap" onClick={generateSynthesis}>Generate Synthesis →</button>
            </div>
          )}
          {topics.length > 0 && (
            <div className="gt-xref">
              <Label>Knowledge Cross-References</Label>
              <div className="gt-xref-list">
                {topics.filter(t => t.confidence >= 7).slice(0, 5).map(t => (
                  <div key={t.title} className="gt-xref-row">
                    <div className="gt-xref-title"><Icon name="Check" size={14} /> {t.title}</div>
                    <div className="gt-xref-val">Strong ({t.confidence}/10)</div>
                  </div>
                ))}
                {topics.filter(t => t.confidence < 5).slice(0, 3).map(t => (
                  <div key={t.title} className="gt-xref-row" data-weak="">
                    <div className="gt-xref-title"><Icon name="AlertTriangle" size={14} /> {t.title}</div>
                    <div className="gt-xref-val">Needs work ({t.confidence}/10)</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'certs' && (
        <div>
          <Label>Certifications & Credentials</Label>
          {CERTS.map(c => (
            <div key={c.name} className="gt-cert">
              <div className="gt-cert-name">{c.name}</div>
              <Badge color={c.color}>{c.status}</Badge>
            </div>
          ))}
          <div className="gt-cert-add">
            <div>+ Add certification or credential</div>
          </div>
        </div>
      )}
    </div>
  );
}
