// Spaced repetition (SM-2).
//   review:{topicId} = { topicId, topicLabel, ease, interval, reps, dueAt, lastResult, updatedAt }
//   reviews           = [ { topicId, topicLabel, dueAt, interval, ease, lastResult } ]  (index)
// Scheduled on quiz completion; Home surfaces whatever is due.
import { readLocal, writeThrough, hydrate, storage } from './storage.js';

const IDX = 'reviews';
const key = (topicId) => `review:${topicId}`;
const DAY = 86_400_000;

// Grade buttons → SM-2 quality (0–5).
export const GRADES = [
  { id: 'again', label: 'Again', quality: 1 },
  { id: 'hard',  label: 'Hard',  quality: 3 },
  { id: 'good',  label: 'Good',  quality: 4 },
  { id: 'easy',  label: 'Easy',  quality: 5 },
];

// Quiz percentage → SM-2 quality.
export function pctToQuality(pct) {
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  if (pct >= 20) return 1;
  return 0;
}

// Core SM-2 step. `prev` may be undefined for a first schedule.
export function schedule(prev, quality) {
  let ease = prev?.ease ?? 2.5;
  let reps = prev?.reps ?? 0;
  let interval;
  if (quality < 3) {
    reps = 0;
    interval = 0; // lapse — resurface today for another pass
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round((prev?.interval || 1) * ease);
    reps += 1;
  }
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) ease = 1.3;
  return { ease: Math.round(ease * 100) / 100, reps, interval, dueAt: Date.now() + interval * DAY };
}

export function loadIndex() { return readLocal(IDX, []); }
export async function hydrateIndex() { const r = await hydrate(IDX); return Array.isArray(r) ? r : undefined; }
export function loadReview(topicId) { return readLocal(key(topicId), null); }

function persist(review) {
  writeThrough(key(review.topicId), review);
  const meta = { topicId: review.topicId, topicLabel: review.topicLabel, dueAt: review.dueAt, interval: review.interval, ease: review.ease, lastResult: review.lastResult };
  const next = [meta, ...loadIndex().filter(s => s.topicId !== review.topicId)].sort((a, b) => a.dueAt - b.dueAt);
  writeThrough(IDX, next);
  return next;
}

// Upsert a review from a completed quiz.
export function recordQuizResult({ topicId, topicLabel, results }) {
  if (!topicId) return;
  const graded = (results || []).filter(r => r.score !== null && r.score !== undefined);
  const pct = graded.length ? Math.round((graded.filter(r => r.score > 0).length / graded.length) * 100) : 0;
  gradeTopic(topicId, pctToQuality(pct), { topicLabel, lastResult: `${pct}%` });
}

// Apply a grade (from Home buttons or a quiz) and reschedule.
export function gradeTopic(topicId, quality, { topicLabel, lastResult } = {}) {
  const prev = loadReview(topicId);
  const s = schedule(prev, quality);
  const review = {
    topicId,
    topicLabel: topicLabel || prev?.topicLabel || topicId,
    ...s,
    lastResult: lastResult ?? (quality >= 3 ? 'recalled' : 'missed'),
    updatedAt: Date.now(),
  };
  persist(review);
  return review;
}

export function removeReview(topicId) {
  storage.delete(key(topicId));
  const next = loadIndex().filter(s => s.topicId !== topicId);
  writeThrough(IDX, next);
  return next;
}

export function dueReviews(index = loadIndex(), now = Date.now()) {
  return index.filter(r => r.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
}
