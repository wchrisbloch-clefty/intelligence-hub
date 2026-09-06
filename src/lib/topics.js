// src/lib/topics.js — lightweight topic following, a learning layer between the
// broad user-owned domains (aether_signal_domains_v1) and auto-logged graph
// concepts. A topic is something the user is CURRENTLY interested in — narrower
// than a domain, more explicit than a concept the system logged on its own.
//
// Follow from anywhere in one tap (a signal card, a feed item, a deep dive, a
// graph concept). Topics feed buildSignalContext() alongside domains. A stale
// topic list is worse than none, so lastActivity is tracked and surfaced.
import { readLocal } from './storage.js';

export const TOPICS_KEY = 'aether_topics_v1';
const DAY = 86_400_000;
export const STALE_DAYS = 30;
const uid = () => 'top_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const norm = (s) => String(s || '').trim().toLowerCase();

export function loadTopics() { const t = readLocal(TOPICS_KEY, []); return Array.isArray(t) ? t : []; }
export const isFollowing = (list, name) => (list || []).some((t) => norm(t.name) === norm(name));

// Pure transforms — the caller persists (awaited/revert).
export function followTopic(list, name, source = '') {
  const n = String(name || '').trim();
  if (!n || isFollowing(list, n)) return list;
  return [{ id: uid(), name: n, source, followedAt: Date.now(), lastActivity: Date.now() }, ...list];
}
export function unfollowTopic(list, name) {
  return (list || []).filter((t) => norm(t.name) !== norm(name));
}
// Bump lastActivity when a followed topic sees action (a matching item kept, a
// dive started). No-op if not followed.
export function touchTopic(list, name) {
  return (list || []).map((t) => (norm(t.name) === norm(name) ? { ...t, lastActivity: Date.now() } : t));
}
export const isStaleTopic = (t) => Date.now() - (t?.lastActivity || t?.followedAt || 0) > STALE_DAYS * DAY;
export const daysSince = (ts) => Math.round((Date.now() - (ts || Date.now())) / DAY);

// Match live feed items to a topic/thread by keyword overlap on the title. Stop
// words dropped so "the ERCOT market" matches on ERCOT/market, not "the".
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is', 'are', 'why', 'how', 'what', 'with', 'that', 'this', 'from', 'about', 'your', 'my']);
export function topicTokens(text) {
  return [...new Set(norm(text).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
}
export function matchItems(items, topicText, tags = []) {
  const toks = [...new Set([...topicTokens(topicText), ...tags.flatMap((t) => topicTokens(t))])];
  if (!toks.length) return [];
  return (items || [])
    .map((it) => ({ it, hits: toks.filter((t) => norm(it.title).includes(t)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.it);
}
