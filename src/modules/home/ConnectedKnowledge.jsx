import ConnectedKnowledgePanel from '../shared/ConnectedKnowledge.jsx';

// Home section wrapper around the shared Connected Knowledge panel, so the
// section registry stays uniform (one component per section id).
export default function ConnectedKnowledge() {
  return <ConnectedKnowledgePanel />;
}
