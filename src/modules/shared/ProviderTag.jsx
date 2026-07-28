// A quiet label showing which AI provider actually answered. Metadata, not a
// headline — uses --text-tertiary. A Groq answer and a Claude answer should not
// look identical when they aren't. Renders nothing until a provider is known.
export default function ProviderTag({ provider, style }) {
  if (!provider) return null;
  return (
    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: 0.2, fontWeight: 500, ...style }}>
      via {provider}
    </span>
  );
}
