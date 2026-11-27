// src/modules/shared/FollowButton.jsx — one-tap topic follow, droppable on any
// artifact (a signal card, a feed item, a deep dive, a graph concept). Self-
// contained: reads/writes aether_topics_v1 through writeThrough. Following a topic
// is what weights the platform toward the user's current interests.
import { useState } from 'react';
import { readLocal, writeThrough } from '../../lib/storage.js';
import { TOPICS_KEY, loadTopics, isFollowing, followTopic, unfollowTopic } from '../../lib/topics.js';
import Icon from './Icon.jsx';

export default function FollowButton({ name, source = '', size = 'sm', style = {} }) {
  const [following, setFollowing] = useState(() => isFollowing(loadTopics(), name));
  const toggle = async (e) => {
    e?.stopPropagation?.();
    const list = readLocal(TOPICS_KEY, []) || [];
    const next = following ? unfollowTopic(list, name) : followTopic(list, name, source);
    setFollowing(!following);
    const r = await writeThrough(TOPICS_KEY, next);
    if (!r.localOk) setFollowing(following); // revert on failed on-device write
  };
  return (
    <button type="button" onClick={toggle} className="chip tap" aria-pressed={following}
      title={following ? 'Following — tap to unfollow' : 'Follow this topic'} style={style}>
      <Icon name={following ? 'Check' : 'Plus'} size={13} /> {following ? 'Following' : 'Follow'}
    </button>
  );
}
