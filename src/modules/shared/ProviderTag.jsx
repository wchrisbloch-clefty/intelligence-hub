import './provider-tag.css';
// A quiet label showing which AI provider actually answered. Metadata, not a
// headline — uses --text-subtle. A Groq answer and a Claude answer should not
// look identical when they aren't. Renders nothing until a provider is known.
export default function ProviderTag({ provider, style }) {
  if (!provider) return null;
  return (
    <span className="pt" style={style}>
      via {provider}
    </span>
  );
}
