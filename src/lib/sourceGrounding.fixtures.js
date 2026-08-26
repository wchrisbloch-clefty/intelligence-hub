// src/lib/sourceGrounding.fixtures.js — retrieval-chain cases.
//
// The live catalogs (Open Library, Library of Congress) are egress-blocked in the
// sandbox, so these fixtures exercise the chain with a MOCK web pass: they cover
// the two failure modes the retrieval work is meant to beat —
//   • sparse TOC ("Winning" is 13 named principles, no formal contents page)
//   • post-cutoff ("The Way of Excellence", published after the model cutoff)
// Each `web(query)` mimics what the batched web pass returns for a given query:
// NOT FOUND for the strict "table of contents" phrasing, a real chapter/principle
// list for the looser structure query — verifying the chain ACCEPTS a reported
// non-formal breakdown rather than giving up.
const grover13 = ['Blackout', 'Sacrifice', 'The Zone', 'Winning Is Selfish', 'Trust Yourself',
  'Adapt', 'Retreat', 'No Comfort', 'The Dark Side', 'Own It', 'Control the Room',
  'Prove Them Wrong', 'Winning Is Everything'];
const stulberg = ['Pseudo-excellence vs Genuine excellence', 'Consistency over Intensity',
  'Fundamentals over Fads', 'Gumption', 'Community and Craft', 'The Way of Excellence'];
const cialdini = ['Weapons of Influence', 'Reciprocation', 'Commitment and Consistency',
  'Social Proof', 'Liking', 'Authority', 'Scarcity', 'Instant Influence'];

const numbered = (arr) => arr.map((c, i) => `${i + 1}. ${c}`).join('\n');

export const RETRIEVAL_FIXTURES = [
  {
    name: 'Winning (Grover) — sparse TOC, 13 named principles',
    query: { title: 'Winning', author: 'Tim Grover' },
    // Strict "table of contents" phrasing finds nothing (there is no formal TOC);
    // the looser "principles/chapter list" query returns the 13 principles.
    web: (q) => /table of contents/i.test(q) && !/principle|chapter list|section/i.test(q) ? 'NOT FOUND' : numbered(grover13),
    expectMinChapters: 13,
    expectSource: 'web',
  },
  {
    name: 'The Way of Excellence (Stulberg) — post-cutoff',
    query: { title: 'The Way of Excellence', author: 'Brad Stulberg' },
    web: () => numbered(stulberg),
    expectMinChapters: 6,
    expectSource: 'web',
  },
  {
    name: 'Influence (Cialdini) — formal TOC',
    query: { title: 'Influence', author: 'Robert Cialdini' },
    web: () => numbered(cialdini),
    expectMinChapters: 7,
    expectSource: 'web',
  },
];
