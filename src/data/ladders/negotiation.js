/**
 * LADDER CONTENT PACK — Negotiation / Never Split the Difference
 *
 * DATA ONLY. No components, no logic. Same schema as sofc-powerdeal.js.
 *
 * This pack treats Chris Voss's *Never Split the Difference* as CANON — a core
 * mental model, not one source among many — and drills its eight field tools.
 * Every level is one concept: concept → worked example (BD + personal) →
 * practice scenario → a confirm-ledger field check you resolve before you run
 * the tactic live.
 *
 * TIERING (the Hub invariant — nothing renders un-tiered):
 *   'verified' — the book's definitions and mechanics. Canon.
 *   'reported' — outside figures/claims; date them.
 *   'inferred' — CB's own application to his BD and personal world.
 *
 * CONFIRM GATE: a block carrying `confirm: '<id>'` is a claim you do NOT run in
 * front of a real counterpart until the matching `confirms` entry is resolved
 * (owner + date). A tactic aimed at the wrong person or without your own number
 * set is worse than no tactic.
 *
 * Every level names a `concept`; the Academy engine logConcepts it (source =
 * this pack) so each tool becomes its own trajectory in Skills.
 */

export default {
  id: 'nsd-negotiation',
  title: 'Negotiation',
  subtitle: 'Never Split the Difference — Tactical Empathy in the Field',
  domain: 'Business Development · Personal',
  emoji: '🤝',
  accent: 'var(--accent)', // engine uses the system token; kept for parity, no hex
  version: '1.0',
  lastVerified: '2026-08-20',
  summary:
    'Voss’s eight field tools, drilled: tactical empathy, calibrated questions, mirroring, labeling, the accusation audit, "that’s right" vs "you’re right", loss-aversion framing, and Ackerman bargaining — each with a BD example, a personal example, and a field check.',

  // ── CONFIRM LEDGER ─────────────────────────────────────────────────────────
  // One field check per tool. These are not book claims — they are the things
  // about YOUR situation that must be true before the tactic works live.
  confirms: [
    { id: 'cf-empathy',    claim: 'The counterpart’s actual pressures on THIS deal — their boss, their timeline, their fear — not your assumption of them.', why: 'Tactical empathy is naming their world accurately. Name the wrong fear and you signal you were not listening — the opposite of the tool.', owner: '', status: 'open' },
    { id: 'cf-calibrated', claim: 'Who the real decision-maker is and what metric they are judged on, before you ask "How am I supposed to do that?"', why: 'A calibrated question aimed at someone with no authority just teaches them your constraints for free.', owner: '', status: 'open' },
    { id: 'cf-mirror',     claim: 'That you can stay silent for 4+ seconds after a mirror without rescuing the pause.', why: 'The mirror only works if you shut up after it. If you fill the silence you answer your own question.', owner: '', status: 'open' },
    { id: 'cf-label',      claim: 'The specific emotion in the room, not a generic one — "It seems like the budget timing is the real problem" beats "It seems like you’re frustrated".', why: 'A vague label is a miss the counterpart quietly notes. A precise label is what earns "that’s right".', owner: '', status: 'open' },
    { id: 'cf-audit',      claim: 'The worst thing they could say about you/your offer, stated in their words, before you pitch.', why: 'The accusation audit only defuses if you name the real objection. Guess wrong and you plant one they had not thought of.', owner: '', status: 'open' },
    { id: 'cf-thatsright', claim: 'A one-paragraph summary of THEIR position good enough that they would say "that’s right" — written before the meeting.', why: 'You cannot fish for "that’s right" live if you have not first understood their side well enough to summarize it.', owner: '', status: 'open' },
    { id: 'cf-loss',       claim: 'The concrete thing they LOSE by not moving — quantified in their terms, not the upside of your offer.', why: 'Loss-aversion framing needs a real, specific loss. A vague "you’ll miss out" moves no one.', owner: '', status: 'open' },
    { id: 'cf-ackerman',   claim: 'Your true walk-away number and ceiling, set in writing before the first offer.', why: 'Ackerman is a disciplined climb to a target. Without your own ceiling fixed first, the anchoring runs on you instead.', owner: '', status: 'open' },
  ],

  levels: [
    // ── L1 · Tactical Empathy ────────────────────────────────────────────────
    {
      id: 'l1', concept: 'Tactical Empathy', title: 'Tactical Empathy', minutes: 12,
      sub: 'Understand and name the other side’s feelings — out loud — so they feel heard before you ask for anything.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: 'Tactical empathy is the deliberate skill of <b>recognizing the other side’s perspective and emotions and saying them back</b>. It is not being nice and it is not agreeing — it is demonstrating you see their world accurately. People who feel understood stop fighting and start negotiating.' },
        { k: 'h', n: '1.1', t: 'What it is — and is not' },
        { k: 'ul', tier: 'verified', items: [
          '<b>It is</b> naming their pressures, fears, and constraints precisely enough that they think "yes, exactly".',
          '<b>It is not</b> sympathy, capitulation, or "I understand" (the two most useless words in negotiation).',
          'Emotions are not obstacles to the deal — they are the <b>means</b>. You cannot argue someone out of a feeling; you can only name it so it loses its grip.',
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'A procurement lead is stalling. Instead of re-pitching value: <i>"It seems like signing a new vendor right before your fiscal close feels like the risky move here."</i> You just named the real blocker — timing risk, not price. He exhales. Now you can solve the actual problem.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'Your spouse is tense about a big house repair. Not "it’ll be fine": <i>"Sounds like it feels like we’re spending money we said we’d save."</i> Naming the fear drains it, and you’re on the same side of the table.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-empathy', title: 'Practice scenario — run it, then verify', html: 'Before your next real negotiation, write the ONE sentence that names the counterpart’s true pressure on this deal. Say it out loud first, before any ask. <b>Field check:</b> is that pressure the real one, or your assumption of it?' },
      ],
      cards: [
        ['Tactical empathy', 'Naming the other side’s perspective + emotions out loud, accurately. Not agreement.', 'verified'],
        ['Why it works', 'People who feel understood stop defending and start problem-solving.', 'verified'],
        ['The trap phrase', '"I understand" — proves nothing. Name the specific feeling instead.', 'verified'],
        ['Emotions are…', 'the means, not the obstacle. You name them, you don’t argue them.', 'verified'],
      ],
      quiz: [
        { q: 'Tactical empathy means…', opts: ['Agreeing to keep the peace', 'Naming the other side’s perspective and emotions out loud, accurately', 'Hiding your own feelings', 'Splitting the difference'], a: 1, e: 'It is demonstrating you see their world — not agreement, not sympathy.' },
        { q: 'Why is "I understand" weak?', opts: ['It’s too long', 'It proves nothing — it names no specific feeling', 'It’s too aggressive', 'It anchors too high'], a: 1, e: 'Understanding is shown by naming the actual pressure, not by claiming it.' },
        { q: 'In Voss’s frame, emotions in a negotiation are…', opts: ['Obstacles to remove', 'Irrelevant', 'The means to the outcome', 'A sign of weakness'], a: 2, e: 'You work through emotions by naming them, not around them.' },
        { q: 'Best tactical-empathy move with a stalling buyer?', opts: ['Re-list the features', 'Drop the price', 'Name the real blocker: "signing before fiscal close feels risky"', 'Set a deadline'], a: 2, e: 'Naming the true pressure (timing risk) surfaces the real problem to solve.' },
        { q: 'Tactical empathy is NOT…', opts: ['Naming feelings', 'Capitulation or being "nice"', 'Understanding their constraints', 'Saying their perspective back'], a: 1, e: 'It is a skill of accurate understanding, not softness or surrender.' },
      ],
    },

    // ── L2 · Calibrated Questions ────────────────────────────────────────────
    {
      id: 'l2', concept: 'Calibrated Questions', title: 'Calibrated Questions', minutes: 12,
      sub: 'Open-ended "how" and "what" questions that hand the other side the problem — and the illusion of control.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: 'A calibrated question is an open question the other side cannot answer with yes/no, usually starting with <b>"How"</b> or <b>"What"</b>. It makes them solve your problem for you while feeling in control. The crown jewel: <b>"How am I supposed to do that?"</b>' },
        { k: 'h', n: '2.1', t: 'The rules' },
        { k: 'ul', tier: 'verified', items: [
          'Start with <b>How</b> or <b>What</b>. Avoid <b>Why</b> — it sounds like an accusation in every language.',
          'Never ask a question you don’t want the answer worked out loud to.',
          '"How am I supposed to do that?" refuses a demand <b>without saying no</b> — and forces them to consider your constraints.',
        ]},
        { k: 'table', tier: 'verified', head: ['Instead of', 'Ask'], rows: [
          ['"That price won’t work."', '"How am I supposed to do that at that price?"'],
          ['"I need it by Friday."', '"What’s realistic given your timeline?"'],
          ['"Why did you choose them?"', '"What made their offer work for you?"'],
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'Buyer demands a 20% discount. You: <i>"How am I supposed to do that and still guarantee the SLA you need?"</i> You said no without "no," and made him weigh his own tradeoff.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'Contractor wants full payment up front. You: <i>"What happens if the work runs past the date — how do we handle that?"</i> Calibrated, not combative, and it surfaces the real risk.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-calibrated', title: 'Practice scenario — run it, then verify', html: 'Draft two "How/What" questions for your next negotiation that hand them a problem to solve. <b>Field check:</b> are you asking the person who actually decides — and do you know the metric they’re judged on?' },
      ],
      cards: [
        ['Calibrated question', 'Open "How/What" question the other side can’t answer yes/no.', 'verified'],
        ['The crown jewel', '"How am I supposed to do that?" — refuses without saying no.', 'verified'],
        ['Avoid', '"Why" — it sounds like an accusation. Use How/What.', 'verified'],
        ['Effect', 'They solve your problem while feeling in control.', 'verified'],
      ],
      quiz: [
        { q: 'A calibrated question usually starts with…', opts: ['Why', 'How or What', 'Do you', 'Can you'], a: 1, e: 'How/What are open and non-accusatory; "Why" triggers defensiveness.' },
        { q: 'The single most useful calibrated question is…', opts: ['"Is that your best price?"', '"How am I supposed to do that?"', '"Why not?"', '"Can you do better?"'], a: 1, e: 'It refuses a demand without saying no and forces them to weigh your constraint.' },
        { q: 'Why avoid "Why" questions?', opts: ['Too vague', 'They sound like accusations', 'They’re closed-ended', 'They anchor low'], a: 1, e: '"Why" implies blame in nearly every language and puts people on defense.' },
        { q: 'Buyer demands 20% off. Best calibrated response?', opts: ['"No."', '"How am I supposed to do that and still guarantee your SLA?"', '"Fine, 10%."', '"Why do you need that?"'], a: 1, e: 'It declines without "no" and hands him his own tradeoff.' },
        { q: 'Calibrated questions give the other side…', opts: ['A deadline', 'The illusion of control while they solve your problem', 'A lower price', 'An ultimatum'], a: 1, e: 'They feel in control, and do your problem-solving.' },
      ],
    },

    // ── L3 · Mirroring ───────────────────────────────────────────────────────
    {
      id: 'l3', concept: 'Mirroring', title: 'Mirroring', minutes: 10,
      sub: 'Repeat the last 1–3 words they said, then go silent. The cheapest tool that keeps them talking.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: 'A mirror is <b>repeating the last one to three words</b> the other person said, as a question, then <b>staying silent</b>. It signals "tell me more" without a single opinion of your own, and it buys you thinking time.' },
        { k: 'h', n: '3.1', t: 'How to run it' },
        { k: 'ul', tier: 'verified', items: [
          'Use an <b>inquisitive, late-night-FM voice</b> — curious, not challenging.',
          'Mirror the last few words (or the critical 1–3 words), then <b>shut up</b> for at least four seconds.',
          'The silence is the tool. If you rescue the pause, you answer your own mirror.',
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'Prospect: "Your onboarding is just too heavy for us right now." You: <i>"Too heavy right now?"</i> …silence… and he explains the real staffing constraint you can actually solve.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'Teenager: "Everyone else gets to stay out later." You: <i>"Everyone else?"</i> …silence… and the actual plan (and who’s driving) comes out.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-mirror', title: 'Practice scenario — run it, then verify', html: 'In your next three conversations, mirror once and count to four before speaking. <b>Field check:</b> can you actually hold the silence without rescuing it? That is the whole skill.' },
      ],
      cards: [
        ['Mirror', 'Repeat the last 1–3 words as a question, then go silent.', 'verified'],
        ['The voice', 'Inquisitive, late-night-FM — curious, not challenging.', 'verified'],
        ['The real tool', 'The silence after. Hold 4+ seconds.', 'verified'],
        ['Effect', 'Keeps them talking and reveals more, with zero opinion from you.', 'verified'],
      ],
      quiz: [
        { q: 'A mirror is…', opts: ['Restating your offer', 'Repeating their last 1–3 words as a question, then silence', 'Agreeing with them', 'Matching their body language'], a: 1, e: 'Verbal mirror = last few words back, then hold silence.' },
        { q: 'The most important part of a mirror is…', opts: ['The tone', 'The silence after it', 'The word choice', 'The volume'], a: 1, e: 'If you fill the pause, you answer your own question.' },
        { q: 'Best voice for a mirror?', opts: ['Firm and loud', 'Inquisitive, late-night-FM', 'Fast and clipped', 'Flat monotone'], a: 1, e: 'Curious, downward-inflected — invites more, doesn’t challenge.' },
        { q: 'Prospect: "Onboarding is too heavy right now." Best mirror?', opts: ['"It’s not that heavy."', '"Too heavy right now?"', '"Why is it heavy?"', '"We can fix that."'], a: 1, e: 'Mirror the critical words, then silence — he reveals the real constraint.' },
        { q: 'How long should you hold silence after a mirror?', opts: ['Half a second', 'At least ~4 seconds', 'Never — keep talking', 'Until they leave'], a: 1, e: 'The pause does the work; four seconds feels long but pays.' },
      ],
    },

    // ── L4 · Labeling ────────────────────────────────────────────────────────
    {
      id: 'l4', concept: 'Labeling', title: 'Labeling', minutes: 11,
      sub: 'Name their emotion with "It seems / It sounds / It looks like…" to defuse the negative and reinforce the positive.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: 'A label is a verbal observation of the other side’s feeling, framed as <b>"It seems like…", "It sounds like…", "It looks like…"</b> — never "I". Labeling a negative emotion diffuses it; labeling a positive one reinforces it.' },
        { k: 'h', n: '4.1', t: 'The mechanics' },
        { k: 'ul', tier: 'verified', items: [
          'Start with <b>"It seems/sounds/looks like"</b> — the third-person framing keeps it about them, not you.',
          'Then <b>go silent</b> and let them react. They’ll correct or confirm — either way you learn.',
          'Never start a label with "I" — "I think you’re upset" makes it about you and invites a fight.',
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'Client goes quiet after the number. You: <i>"It seems like that came in higher than you’d planned for."</i> You named the sticker shock so it stops running silently, and he tells you the budget he actually has.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'A friend is short with you. <i>"It seems like something about last week is still bugging you."</i> The label opens the door sympathy would have kept shut.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-label', title: 'Practice scenario — run it, then verify', html: 'Write a label for the exact emotion you expect in your next negotiation — specific, not generic. <b>Field check:</b> "It seems like the budget timing is the problem" is a hit; "It seems like you’re frustrated" is a miss. Which did you write?' },
      ],
      cards: [
        ['Label', 'Name their feeling with "It seems/sounds/looks like…", then silence.', 'verified'],
        ['Never start with', '"I" — it makes the label about you and invites a fight.', 'verified'],
        ['Negative emotion', 'Labeling it diffuses it.', 'verified'],
        ['Positive emotion', 'Labeling it reinforces it.', 'verified'],
      ],
      quiz: [
        { q: 'A label should start with…', opts: ['"I feel like…"', '"It seems / sounds / looks like…"', '"You are…"', '"Why do you…"'], a: 1, e: 'Third-person framing keeps it about them and lowers defenses.' },
        { q: 'Labeling a NEGATIVE emotion…', opts: ['Amplifies it', 'Diffuses it', 'Ignores it', 'Hides it'], a: 1, e: 'Naming a fear out loud drains its power.' },
        { q: 'Why never start a label with "I"?', opts: ['Too formal', 'It makes it about you and invites a fight', 'It’s ungrammatical', 'It anchors high'], a: 1, e: '"I think you’re upset" centers you; "It seems like…" centers them.' },
        { q: 'After you label, you should…', opts: ['Immediately pitch', 'Go silent and let them react', 'Ask "why"', 'Restate your price'], a: 1, e: 'The silence lets them confirm or correct — you learn either way.' },
        { q: 'Which is a strong (specific) label?', opts: ['"It seems like you’re unhappy"', '"It seems like the fiscal-close timing is the real risk here"', '"I think you’re stressed"', '"You seem difficult"'], a: 1, e: 'Precise labels earn agreement; vague ones read as a guess.' },
      ],
    },

    // ── L5 · The Accusation Audit ────────────────────────────────────────────
    {
      id: 'l5', concept: 'Accusation Audit', title: 'The Accusation Audit', minutes: 11,
      sub: 'Say the worst thing they could think about you first — so it loses its charge before you ask.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: 'An accusation audit is <b>listing every negative the other side could level at you, and voicing them yourself first</b>. Naming the objection out loud defuses it; hearing you say it makes them want to argue it’s not that bad.' },
        { k: 'h', n: '5.1', t: 'How to run it' },
        { k: 'ul', tier: 'verified', items: [
          'List the harshest things they might say about you or your offer.',
          'Front-load them: <i>"You’re probably going to think this is overpriced, that we’re the risky new option, and that the timing is terrible…"</i>',
          'Overstate slightly. When you exaggerate the accusation, they instinctively pull it back toward reasonable.',
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'Opening a pitch to a skeptical committee: <i>"You’re probably thinking we’re the unproven option, that switching now is a headache, and that our price looks high next to the incumbent."</i> Half of them nod — and then start defending why it might be worth it.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'Asking a favor after a busy stretch: <i>"I know I’ve been heads-down and this is bad timing to ask…"</i> Naming it first removes the guilt tax before the request.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-audit', title: 'Practice scenario — run it, then verify', html: 'Before your next pitch, write the three worst things they could think, in their words, and say them first. <b>Field check:</b> is the top item their REAL objection — or one you’re guessing at and might plant?' },
      ],
      cards: [
        ['Accusation audit', 'Voice the worst things they could think about you — first.', 'verified'],
        ['Why it works', 'Named objections lose charge; they rush to say it’s "not that bad".', 'verified'],
        ['Technique', 'Slightly overstate the accusation so they pull it back.', 'verified'],
        ['When', 'Front-load it — before the ask, not after the pushback.', 'verified'],
      ],
      quiz: [
        { q: 'An accusation audit means…', opts: ['Accusing the other side', 'Voicing the negatives they might think about you, first', 'Auditing their finances', 'Listing your strengths'], a: 1, e: 'You pre-empt their objections by saying them yourself.' },
        { q: 'Voicing an objection yourself first…', opts: ['Confirms it', 'Diffuses its charge', 'Insults them', 'Wastes time'], a: 1, e: 'Named out loud by you, the objection loses its power.' },
        { q: 'A useful trick within the audit is to…', opts: ['Understate the negatives', 'Slightly overstate them so they pull them back', 'Skip the harsh ones', 'Blame the market'], a: 1, e: 'Exaggerate a touch and they instinctively say "well, it’s not THAT bad".' },
        { q: 'When do you run an accusation audit?', opts: ['After they object', 'Front-loaded, before the ask', 'Only in writing', 'Never in person'], a: 1, e: 'Defuse the objection before it’s raised.' },
        { q: 'Best audit opener to a skeptical buyer?', opts: ['"You’ll love this."', '"You’re probably thinking we’re the unproven, pricier, switch-is-a-headache option…"', '"Why are you skeptical?"', '"Trust me."'], a: 1, e: 'Name their real doubts first and they start arguing the other way.' },
      ],
    },

    // ── L6 · "That's right" vs "You're right" ────────────────────────────────
    {
      id: 'l6', concept: '"That’s right" vs "You’re right"', title: '"That’s right" vs "You’re right"', minutes: 10,
      sub: 'The two words that signal real breakthrough — and the two that signal you’ve been dismissed.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: '<b>"That’s right"</b> is the breakthrough: it means the other side feels you’ve truly understood their position, and it precedes real movement. <b>"You’re right"</b> is the opposite — a polite brush-off that means "please stop talking now." Fish for the first; distrust the second.' },
        { k: 'table', tier: 'verified', head: ['Signal', 'What it really means'], rows: [
          ['<b>"That’s right"</b>', 'They feel understood. Agreement and movement follow.'],
          ['<b>"You’re right"</b>', 'They’ve disengaged. You’ve been placated, not persuaded.'],
        ]},
        { k: 'h', n: '6.1', t: 'How to earn "that’s right"' },
        { k: 'ul', tier: 'verified', items: [
          'Summarize their position back — a good <b>summary</b> = labels + paraphrase of their world.',
          'Do it well enough that they say, unprompted, "that’s right." That is the hinge of the negotiation.',
          'If you’re getting "you’re right," you’re talking too much and understanding too little. Back up and label.',
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'You summarize a client’s bind: <i>"So switching now means retraining your team mid-quarter, and if it slips it’s your name on the miss — and the incumbent is the safe story."</i> "That’s right." Now he’s ready to solve it with you.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'Mid-argument with your partner you stop pitching and summarize their side until they say "…that’s right." The temperature drops instantly — because they finally feel heard.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-thatsright', title: 'Practice scenario — run it, then verify', html: 'Write a one-paragraph summary of the counterpart’s position so accurate they’d say "that’s right." <b>Field check:</b> did you write it BEFORE the meeting? You can’t fish for it live if you haven’t understood their side first.' },
      ],
      cards: [
        ['"That’s right"', 'Breakthrough — they feel understood; movement follows.', 'verified'],
        ['"You’re right"', 'Brush-off — they’ve disengaged. Distrust it.', 'verified'],
        ['How to earn it', 'Summarize their position (labels + paraphrase) until they say it.', 'verified'],
        ['If you hear "you’re right"', 'You’re talking too much. Back up and label.', 'verified'],
      ],
      quiz: [
        { q: 'Which phrase signals a real breakthrough?', opts: ['"You’re right"', '"That’s right"', '"Fair enough"', '"Maybe"'], a: 1, e: '"That’s right" = they feel understood; movement follows.' },
        { q: '"You’re right" usually means…', opts: ['Genuine agreement', 'They’ve disengaged / are placating you', 'You’ve won', 'They’ll sign'], a: 1, e: 'It’s the polite "please stop talking now".' },
        { q: 'You earn "that’s right" by…', opts: ['Repeating your offer', 'Summarizing their position back accurately', 'Lowering the price', 'Asking "why"'], a: 1, e: 'A good summary = labels + paraphrase of their world.' },
        { q: 'If you keep hearing "you’re right," you should…', opts: ['Push harder', 'Talk less, label more, understand their side', 'Give a discount', 'Set a deadline'], a: 1, e: 'It signals you’re pitching past them — back up and label.' },
        { q: 'The single hinge moment of a Voss negotiation is when they say…', opts: ['"You’re right"', '"That’s right"', '"No"', '"Yes"'], a: 1, e: 'It marks the shift from resistance to working the problem together.' },
      ],
    },

    // ── L7 · Loss-Aversion Framing ───────────────────────────────────────────
    {
      id: 'l7', concept: 'Loss Aversion Framing', title: 'Loss-Aversion Framing', minutes: 11,
      sub: 'People work harder to avoid a loss than to achieve an equal gain. Frame the cost of NOT moving.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: 'From prospect theory: <b>a loss looms about twice as large as an equivalent gain</b>. So don’t only sell the upside of yes — make the <b>cost of no</b> concrete and specific. What do they lose by standing still?' },
        { k: 'h', n: '7.1', t: 'How to frame the loss' },
        { k: 'ul', tier: 'verified', items: [
          'Quantify the loss in <b>their</b> terms — dollars, risk, time, reputation — not the abstract upside of your offer.',
          'Make it concrete and near-term: "each month you wait costs roughly X" beats "you’ll miss out".',
          'Pair it with a way out — loss framing motivates movement; it should point at the door, not just the cliff.',
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'Not "our platform saves 12%." Instead: <i>"Every quarter on the current setup is roughly $180k of avoidable spend and one more Uri-class outage you’re exposed to."</i> The avoidable loss moves the committee the upside couldn’t.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'On your own health: not "exercise adds years." Instead: "skipping the base-building now is the fitness I don’t get back later." Framing the loss beats the abstract gain — even with yourself.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-loss', title: 'Practice scenario — run it, then verify', html: 'Write the specific, quantified thing the counterpart LOSES by not moving. <b>Field check:</b> is it a real number in their terms — or a vague "you’ll miss out" that moves no one?' },
      ],
      cards: [
        ['Loss aversion', 'A loss feels ~2x an equal gain (prospect theory).', 'verified'],
        ['The move', 'Frame the concrete cost of NOT moving, in their terms.', 'verified'],
        ['Gain vs loss', 'The upside of yes persuades less than the cost of no.', 'verified'],
        ['Make it', 'Specific, quantified, near-term — and point at the exit.', 'verified'],
      ],
      quiz: [
        { q: 'Loss aversion says a loss feels…', opts: ['Half as strong as a gain', 'About the same', 'Roughly twice as strong as an equal gain', 'Irrelevant'], a: 2, e: 'Prospect theory: losses loom ~2x larger than equivalent gains.' },
        { q: 'The practical move is to…', opts: ['Sell only the upside', 'Frame the concrete cost of NOT moving', 'Lower the price', 'Add features'], a: 1, e: 'Make the loss of standing still specific and near-term.' },
        { q: 'A strong loss frame is…', opts: ['"You’ll miss out"', '"Each quarter on the current setup is ~$180k avoidable spend"', '"It’s a great deal"', '"Trust me"'], a: 1, e: 'Quantified, in their terms — that’s what moves people.' },
        { q: 'Loss framing should be paired with…', opts: ['A threat', 'A concrete way out / next step', 'A discount', 'Silence'], a: 1, e: 'Point at the door, not just the cliff — motivate movement.' },
        { q: 'Which persuades more, per Voss/Kahneman?', opts: ['The gain from saying yes', 'The loss from saying no (equal size)', 'They’re identical', 'Neither'], a: 1, e: 'The equally-sized loss carries more motivational weight.' },
      ],
    },

    // ── L8 · Ackerman Bargaining ─────────────────────────────────────────────
    {
      id: 'l8', concept: 'Ackerman Bargaining', title: 'Ackerman Bargaining', minutes: 13,
      sub: 'A disciplined offer system: set your target, open at 65%, climb in decreasing steps, and use odd, precise numbers.',
      blocks: [
        { k: 'call', tone: 'key', tier: 'verified', title: 'The one idea', html: 'Ackerman is a <b>system, not a haggle</b>. Set your target price. Open at <b>65%</b> of it. Climb to 85%, 95%, then 100% in <b>decreasing increments</b>. Use <b>empathy and calibrated "no"</b> between offers, end on a <b>precise, odd number</b>, and throw in a small <b>non-monetary extra</b> at the final number to signal you’re truly at your limit.' },
        { k: 'flow', tier: 'verified', stages: [
          { n: 'Step 1', nm: '65%', v: 'of target', d: 'Anchor low but credible.' },
          { n: 'Step 2', nm: '85%', v: '', d: 'Only after they push; use a calibrated question.' },
          { n: 'Step 3', nm: '95%', v: '', d: 'Smaller step signals you’re near the ceiling.' },
          { n: 'Step 4', nm: '100%', v: 'e.g. $37,893', d: 'Odd, precise number + a small non-cash extra.' },
        ]},
        { k: 'ul', tier: 'verified', items: [
          '<b>Decreasing increments</b> (20 → 10 → 5 points) tell them, without words, that you’re running out of room.',
          '<b>Precise numbers</b> ($37,893, not $38,000) feel calculated and final — round numbers feel like placeholders.',
          'The <b>non-monetary throw-in</b> at the end ("…and I’ll include the onboarding") says "this is genuinely it."',
        ]},
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — BD', html: 'Target on a services deal is $40k. You open at $26k, then $34k, then $38k, landing at <i>$39,750 plus a free integration review</i>. The shrinking steps and the odd final number close it where a "meet at $35k" would have left value on the table.' },
        { k: 'call', tone: 'win', tier: 'inferred', title: 'Worked example — personal', html: 'Buying a used truck listed at $22k. Target $18k. Open $13k → $16k → $17.5k → <i>$17,650 and I’ll pick it up today</i>. The precise number plus the convenience throw-in reads as your true ceiling.' },
        { k: 'call', tone: 'warn', tier: 'inferred', confirm: 'cf-ackerman', title: 'Practice scenario — run it, then verify', html: 'Pick a real upcoming negotiation. Write your target, your 65/85/95/100 ladder, and your final odd number + throw-in. <b>Field check:</b> is your true walk-away and ceiling fixed IN WRITING first? Without it, the anchoring runs on you.' },
      ],
      cards: [
        ['Ackerman opener', 'Open at 65% of your target price.', 'verified'],
        ['The climb', '65 → 85 → 95 → 100%, in DECREASING increments.', 'verified'],
        ['Precise numbers', 'Odd, exact figures ($37,893) feel final; round feels placeholder.', 'verified'],
        ['Final-offer signal', 'Add a small non-monetary extra to say "this is truly it".', 'verified'],
        ['Prerequisite', 'Your walk-away + ceiling set in writing BEFORE offer one.', 'inferred'],
      ],
      quiz: [
        { q: 'The Ackerman opening offer is…', opts: ['100% of target', '85% of target', '65% of target', '50% of target'], a: 2, e: 'Open at 65%, then climb 85 → 95 → 100.' },
        { q: 'Increments across the offers should…', opts: ['Increase', 'Stay equal', 'Decrease', 'Be random'], a: 2, e: 'Shrinking steps signal you’re running out of room.' },
        { q: 'Why use a precise number like $37,893?', opts: ['It’s easier math', 'It feels calculated and final; round numbers feel like placeholders', 'It anchors higher', 'It hides the total'], a: 1, e: 'Odd, exact figures read as a hard-computed ceiling.' },
        { q: 'The final Ackerman move is…', opts: ['A bigger discount', 'A small non-monetary throw-in to signal "this is truly it"', 'An ultimatum', 'Walking out'], a: 1, e: 'The extra says you’re genuinely at your limit.' },
        { q: 'Before making ANY Ackerman offer you must…', opts: ['Know their budget', 'Fix your own walk-away and ceiling in writing', 'Get them to name a number', 'Split the difference'], a: 1, e: 'Without your ceiling set first, the anchoring runs on you.' },
      ],
    },
  ],
};
