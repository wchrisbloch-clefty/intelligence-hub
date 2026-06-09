import { useState } from 'react';
import { useApp } from '../App.jsx';
import { callClaude } from '../utils.js';
import { CB_LEARNING_SPINE } from '../constants.js';
import MD from './shared/MD.jsx';
import { Card, Label, Badge, Btn, ThinkingDots } from './shared/Common.jsx';

const GOALS = [
  { id: 'passive', label: '$10K+/mo Passive Income', target: 10000, current: 0, unit: '/mo', color: '#00FFB2', icon: '💰', horizon: '3-5 years' },
  { id: 'health', label: 'Longevity Protocol Active', target: 5, current: 3, unit: ' / 5 pillars', color: '#ff8844', icon: '⚡', horizon: 'Ongoing' },
  { id: 'business', label: 'Scalable Business Revenue', target: 50000, current: 0, unit: '/mo', color: '#6366F1', icon: '📊', horizon: '5 years' },
  { id: 'learning', label: 'Learning Hours This Year', target: 200, current: 15, unit: 'h', color: '#ffcc44', icon: '📚', horizon: '2025' },
];

const SKILLS = [
  { name: 'Business Development', level: 9, growth: '+0', color: '#6366F1' },
  { name: 'Real Estate Investing', level: 6, growth: '+2', color: '#00FFB2' },
  { name: 'Negotiation', level: 8, growth: '+1', color: '#ff4488' },
  { name: 'Capital Allocation', level: 5, growth: '+1', color: '#ffcc44' },
  { name: 'Stoic Leadership', level: 8, growth: '0', color: '#ff8844' },
  { name: 'Systems Thinking', level: 7, growth: '+1', color: '#44ffcc' },
  { name: 'Health/Longevity', level: 7, growth: '+2', color: '#ff6644' },
  { name: 'AI/Technology', level: 4, growth: '+2', color: '#4488ff' },
];

const CERTS = [
  { name: 'Real Estate License', status: 'exploring', color: '#00FFB2' },
  { name: 'CFA Level 1', status: 'exploring', color: '#ffcc44' },
  { name: 'Options Trading (CBOE)', status: 'exploring', color: '#ff8844' },
];

export default function GrowthTools() {
  const { graph, projects, isMobile, isPhone, isTablet, setChatPrefill, setChatOpen } = useApp();
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
      const r = await callClaude({ system: CB_LEARNING_SPINE, messages: [{ role: 'user', content: `CB's goal: ${goal.label}. Current: ${goal.current}${goal.unit} of ${goal.target}${goal.unit} (${Math.min(100, Math.round((goal.current / goal.target) * 100))}%). Horizon: ${goal.horizon}.\n\nGive CB: (1) the single biggest lever to accelerate progress toward this goal, (2) one common mistake to avoid, (3) a specific 30-day sprint target. Be decisive and CB-specific.` }], maxTokens: 500 });
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
      const r = await callClaude({ system: CB_LEARNING_SPINE, messages: [{ role: 'user', content: `CB's skill: ${skill.name} — self-assessed ${skill.level}/10, growth trend ${skill.growth}.\n\nGive CB: (1) what getting from ${skill.level} to ${Math.min(10, skill.level + 2)} looks like in practice, (2) the highest-leverage resource or method to level up this skill, (3) how this skill connects to CB's BD/investing/Houston goals. Be specific.` }], maxTokens: 450 });
      setSkillAI(p => ({ ...p, [skill.name]: r }));
    } catch { setSkillAI(p => ({ ...p, [skill.name]: 'Network error — try again.' })); }
    setSkillAILoading(null);
  };

  const getCertAI = async (cert) => {
    if (certAI[cert.name]) { setCertAI(p => ({ ...p, [cert.name]: '' })); return; }
    setCertAILoading(cert.name);
    try {
      const r = await callClaude({ system: CB_LEARNING_SPINE, messages: [{ role: 'user', content: `CB is exploring the ${cert.name} certification (status: ${cert.status}). Give CB: (1) honest ROI assessment — is this worth the time and money for a BD professional/investor in Houston? (2) time commitment and difficulty, (3) decisive recommendation: pursue, deprioritize, or find a better alternative.` }], maxTokens: 450 });
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
      const reply = await callClaude({ system: CB_LEARNING_SPINE, messages: [{ role: 'user', content: prompt }], maxTokens: 800 });
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
    <div style={{ padding: isMobile ? '16px 16px 60px' : '24px 28px 60px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: '#44ffcc', textTransform: 'uppercase', marginBottom: 6 }}>Growth & Synthesis</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Compounding Dashboard</div>
        <div style={{ fontSize: 11, color: 'var(--subtle)' }}>Goals · Skills · Synthesis · Certifications</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr 1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {[
          { label: 'Avg Confidence', value: avgConf + '/10', color: '#44ffcc', icon: '🎯' },
          { label: 'Topics Mastered', value: topics.filter(t => t.confidence >= 7).length, color: '#00FFB2', icon: '✓' },
          { label: 'Streak', value: streak + 'd', color: '#ffcc44', icon: '🔥' },
          { label: 'Hours Invested', value: Math.round(totalMin / 60) + 'h', color: '#6366F1', icon: '⏱' },
        ].map(s => (
          <Card key={s.label} color={s.color} style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.value}</div>
            <div style={{ fontSize: isMobile ? 10 : 9, color: 'var(--subtle)', marginTop: 4, letterSpacing: 0.5 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 16px', fontSize: 11, fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? '#44ffcc' : 'var(--subtle)', cursor: 'pointer', borderBottom: activeTab === t.id ? '2px solid #44ffcc' : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
          </div>
        ))}
      </div>

      {activeTab === 'goals' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {GOALS.map(g => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            const isExpanded = expandedGoal === g.id;
            return (
              <Card key={g.id} color={g.color} style={{ padding: '18px', cursor: 'pointer', transition: 'border-color 0.15s' }} onClick={() => getGoalAI(g)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>{g.icon}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1 }}>{g.horizon}</div>
                    <div style={{ fontSize: 9, color: isExpanded ? g.color : 'var(--dim)', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{g.label}</div>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 14 }}>{g.current}{g.unit} / {g.target}{g.unit}</div>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: 8 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${g.color}, ${g.color}80)`, borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 10, color: g.color, marginBottom: isExpanded ? 12 : 0 }}>{pct}% to goal · tap for AI insights</div>
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${g.color}20` }} onClick={e => e.stopPropagation()}>
                    {goalAILoading === g.id
                      ? <ThinkingDots color={g.color} />
                      : goalAI[g.id]
                        ? <MD text={goalAI[g.id]} color={g.color} />
                        : null}
                    <div onClick={() => { setChatPrefill(`Help me make progress on my goal: ${g.label}. I'm at ${g.current}${g.unit} out of ${g.target}${g.unit}.`); setChatOpen(true); }}
                      style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: `${g.color}10`, border: `1px solid ${g.color}30`, borderRadius: 7, fontSize: 10, fontWeight: 600, color: g.color, cursor: 'pointer' }}>
                      💬 Ask CB AI about this goal
                    </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {SKILLS.map(s => {
              const isExp = expandedSkill === s.name;
              return (
                <div key={s.name} onClick={() => getSkillAI(s)}
                  style={{ padding: '12px 16px', background: 'var(--surface)', border: `1px solid ${isExp ? s.color + '60' : s.color + '20'}`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 9, color: s.growth.startsWith('+') ? '#00FFB2' : 'var(--subtle)' }}>{s.growth}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.level}/10</div>
                      <div style={{ fontSize: 9, color: isExp ? s.color : 'var(--dim)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: 2, height: 3, marginBottom: isExp ? 12 : 0 }}>
                    <div style={{ width: `${s.level * 10}%`, height: '100%', background: s.color, borderRadius: 2 }} />
                  </div>
                  {isExp && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${s.color}20` }} onClick={e => e.stopPropagation()}>
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
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#00FFB208', border: '1px solid #00FFB220', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: '#00FFB2', marginBottom: 4 }}>🎯 Top leverage skill to develop next</div>
            <div style={{ fontSize: 12, color: 'var(--text-c)' }}>AI/Technology (currently 4/10) — highest asymmetric upside given your BD + real estate focus. A BD professional fluent in AI tools is a rare, compounding edge.</div>
          </div>
        </div>
      )}

      {activeTab === 'synthesis' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <Label>Growth Synthesis</Label>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: -6 }}>AI-generated · Based on your learning history, projects, and goals</div>
            </div>
            <div onClick={generateSynthesis} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #44ffcc, #6366F1)', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#000', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {synthLoading ? '...' : '⚡ Generate'}
            </div>
          </div>
          {synthLoading && (
            <Card color="#44ffcc" style={{ padding: '20px' }}>
              <div style={{ fontSize: 10, color: '#44ffcc', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Analyzing your growth trajectory...</div>
              <ThinkingDots color="#44ffcc" />
            </Card>
          )}
          {synthesis && !synthLoading && (
            <Card color="#44ffcc" style={{ padding: '20px' }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: '#44ffcc', textTransform: 'uppercase', marginBottom: 14 }}>Growth Synthesis · CB Intelligence</div>
              <MD text={synthesis} color="#44ffcc" />
            </Card>
          )}
          {!synthesis && !synthLoading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>Get your Growth Synthesis</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>AI analysis of what's compounding in your favor, your biggest gap, and the highest-leverage action for the next 90 days.</div>
              <div onClick={generateSynthesis} style={{ display: 'inline-block', padding: '11px 22px', background: 'linear-gradient(135deg, #44ffcc, #6366F1)', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Generate Synthesis →</div>
            </div>
          )}
          {topics.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Label>Knowledge Cross-References</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topics.filter(t => t.confidence >= 7).slice(0, 5).map(t => (
                  <div key={t.title} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-c)' }}>✓ {t.title}</div>
                    <div style={{ fontSize: 10, color: '#00FFB2' }}>Strong ({t.confidence}/10)</div>
                  </div>
                ))}
                {topics.filter(t => t.confidence < 5).slice(0, 3).map(t => (
                  <div key={t.title} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid #ff444420', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-c)' }}>⚠ {t.title}</div>
                    <div style={{ fontSize: 10, color: '#ff6644' }}>Needs work ({t.confidence}/10)</div>
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
            <div key={c.name} style={{ padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${c.color}20`, borderRadius: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
              <Badge color={c.color}>{c.status}</Badge>
            </div>
          ))}
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'center', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)' }}>+ Add certification or credential</div>
          </div>
        </div>
      )}
    </div>
  );
}
