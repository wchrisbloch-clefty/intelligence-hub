// src/modules/shared/MentalModelChip.jsx — "Through my mental models", on demand.
// Mount on any guide or deep dive: <MentalModelChip title={…} body={markdown} />.
// Nothing runs until the reader taps it. Result renders below as one labelled
// section with the shared SectionState contract (loading / error + Retry).
import { useState } from 'react';
import { callClaude } from '../../utils.js';
import { buildMentalModelPrompt, MENTAL_MODELS_HEADING } from '../../lib/mentalModels.js';
import { capTierMarkers } from '../../lib/rigor.js';
import { SectionSkeleton, SectionError } from './SectionState.jsx';
import MD from './MD.jsx';
import './mental-model-chip.css';

export default function MentalModelChip({ title, body, disabled = false }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [out, setOut] = useState('');
  const [err, setErr] = useState('');
  const run = async () => {
    if (!body || status === 'loading') return;
    setStatus('loading'); setErr('');
    try {
      const { system, user } = buildMentalModelPrompt({ title, body });
      const text = await callClaude({ system, messages: [{ role: 'user', content: user }], maxTokens: 1400, job: 'default' });
      // A reframe is synthesis — it can never claim more than [inferred].
      setOut(capTierMarkers(text, 'inferred')); setStatus('ready');
    } catch (e) { setErr(e?.message || 'Providers unavailable.'); setStatus('error'); }
  };
  return (
    <div className="mm" data-status={status}>
      <button type="button" className="chip mm-chip tap" aria-pressed={status === 'ready'}
        onClick={status === 'ready' ? () => setStatus('idle') : run} disabled={disabled || !body || status === 'loading'}
        aria-busy={status === 'loading' ? 'true' : undefined}>
        {status === 'ready' ? `Hide · ${MENTAL_MODELS_HEADING}` : MENTAL_MODELS_HEADING}
      </button>
      {status === 'loading' && <SectionSkeleton rows={3} label={MENTAL_MODELS_HEADING} />}
      {status === 'error' && <SectionError label="the mental-model reframe" onRetry={run} detail={err} />}
      {status === 'ready' && <div className="mm-out"><MD text={out} color="var(--accent-text)" /></div>}
    </div>
  );
}
