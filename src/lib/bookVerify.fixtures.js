// src/lib/bookVerify.fixtures.js — short-title verification cases.
//
// These are the exact shape that broke exact-phrase matching: a common short
// title the user types off the spine, a catalog full title with a subtitle, and
// often a DIFFERENT book that shares the short title. `scoreMatch` must rank the
// right book (by author) above the impostor and above the wrong edition. The
// candidate sets mirror what Google Books / Open Library actually return, so the
// scoring is testable without the (egress-blocked) live catalog.
export const VERIFY_FIXTURES = [
  {
    query: { title: 'Winning', author: 'Tim Grover' },
    candidates: [
      { title: 'Winning: The Unforgiving Race to Greatness', authors: ['Tim S. Grover', 'Shari Wenk'], publishedDate: '2021' },
      { title: 'Winning', authors: ['Jack Welch', 'Suzy Welch'], publishedDate: '2005' },
      { title: 'Winning!', authors: ['Clive Woodward'], publishedDate: '2004' },
    ],
    expectTopAuthorIncludes: 'grover',
    expectTopTitleIncludes: 'Unforgiving',
  },
  {
    query: { title: 'Influence', author: 'Robert Cialdini' },
    candidates: [
      { title: 'Influence: The Psychology of Persuasion', authors: ['Robert B. Cialdini'], publishedDate: '2006' },
      { title: 'Influence: Science and Practice', authors: ['Robert B. Cialdini'], publishedDate: '2008' },
      { title: 'The Influence', authors: ['Ramsey Campbell'], publishedDate: '1988' },
    ],
    expectTopAuthorIncludes: 'cialdini',
  },
  {
    query: { title: 'Mindset', author: 'Carol Dweck' },
    candidates: [
      { title: 'Mindset: The New Psychology of Success', authors: ['Carol S. Dweck'], publishedDate: '2007' },
      { title: 'Mindset', authors: ['Brian Moran'], publishedDate: '2015' },
    ],
    expectTopAuthorIncludes: 'dweck',
    expectTopTitleIncludes: 'New Psychology',
  },
];
