/**
 * LADDER CONTENT PACK — PowerDeal / BTM SOFC Baseload Power
 *
 * This file is DATA ONLY. It contains no components and no logic.
 * Adding another ladder = adding another file like this one. Zero component edits.
 *
 * TIERING (the Hub invariant — nothing renders un-tiered):
 *   'verified' — physics, definitions, standards. True regardless of vendor.
 *   'reported' — market/competitor figures from public sources. Goes stale. Date it.
 *   'inferred' — our positioning, estimates, or anything not yet confirmed internally.
 *
 * CONFIRM GATE: any block carrying `confirm: '<id>'` is locked out of Field Mode
 * until the matching entry in `confirms` is marked resolved. Unresolved = you do
 * not say it in front of a customer.
 */

export default {
  id: 'sofc-powerdeal',
  title: 'PowerDeal',
  subtitle: 'BTM SOFC Baseload Power — BD Field Manual',
  domain: 'Business Development · Energy',
  emoji: '⚡',
  accent: '#8B5CF6',
  version: '2.0',
  lastVerified: '2026-07-29',
  summary:
    'How power gets made, why electrochemistry breaks the combustion trade-off, how to survive the one-line conversation, how the deal actually prices, and how to close it.',

  // ── CONFIRM LEDGER ────────────────────────────────────────────────────────
  // Every claim here is currently UNVERIFIED. Nothing gated behind these ships
  // to a customer until owner + date are filled and status flips to 'resolved'.
  confirms: [
    {
      id: 'ck-heatrate',
      claim: 'Our SOFC platform heat rate (BTU/kWh) and the fleet-wide realized figure',
      why: 'The entire efficiency and fuel-cost argument rests on this single number. Quoting it wrong to a refinery is a career event.',
      owner: '',
      status: 'open',
    },
    {
      id: 'ck-fleet',
      claim: 'Installed fleet size, cumulative runtime hours, realized availability %',
      why: '"Unproven at scale" is the #1 objection. You cannot answer it with a feeling.',
      owner: '',
      status: 'open',
    },
    {
      id: 'ck-chp',
      claim: 'Does the platform support waste-heat recovery / steam export, and at what grade?',
      why: 'The CHP steam load is the silent deal-killer on every refining and petrochem account.',
      owner: '',
      status: 'open',
    },
    {
      id: 'ck-capex',
      claim: 'Installed $/kW capex band and O&M $/MWh, by project size',
      why: 'Every LCOE number in Level 5 is illustrative until this is filled. Illustrative numbers do not go in a proposal.',
      owner: '',
      status: 'open',
    },
    {
      id: 'ck-tax',
      claim: 'Current federal credit eligibility for a natural-gas-fueled fuel cell, and TX JETI abatement applicability',
      why: 'Credit rules moved in 2025. This is tax counsel territory, not BD territory. Never quote a percentage.',
      owner: '',
      status: 'open',
    },
    {
      id: 'ck-modes',
      claim: 'Which interconnection modes the product actually supports (export / non-export / island / microgrid)',
      why: 'Promising seamless island mode you cannot deliver is how you lose a data center account in week three.',
      owner: '',
      status: 'open',
    },
    {
      id: 'ck-uptime',
      claim: 'Contractual uptime guarantee and liquidated-damages structure',
      why: '"Zero planned outages" is a design claim. What you will sign is a different question, and the buyer asks it second.',
      owner: '',
      status: 'open',
    },
  ],

  // ── LEVELS ────────────────────────────────────────────────────────────────
  levels: [
    // ═══════════════════════ L1 ═══════════════════════
    {
      id: 'l1',
      tag: 'FUNDAMENTALS',
      title: 'Power Generation Fundamentals',
      sub: 'How electricity gets made, the five ways, and why heat rate and baseload decide the deal.',
      minutes: 18,
      blocks: [
        {
          k: 'call', tone: 'key', tier: 'verified',
          title: 'The one idea that anchors everything',
          html: 'Electricity is not stored on the grid in any meaningful quantity — it is made the instant you use it. Every power conversation is really about <b>how</b> you convert an energy source into electrons, and <b>what you sacrifice</b> doing it. The whole sales thesis lives here.',
        },
        { k: 'h', n: '1.1', t: 'The ways power gets made' },
        { k: 'p', html: '<b>Two fundamental families.</b>' },
        { k: 'p', html: '<b>Family 1 — Combustion.</b> Burn a fuel, the heat spins a shaft (or makes steam that spins a shaft), and the spinning makes electricity. This is most of what you compete against:' },
        {
          k: 'ul', tier: 'reported',
          items: [
            '<b>Reciprocating engines</b> (Wärtsilä, INNIO Jenbacher, CAT) — giant industrial engines. Heat rate 7,500–8,500 BTU/kWh. Emit NOx, CO, particulates.',
            '<b>Aeroderivative turbines</b> (GE LM series, Solar Turbines) — jet engines on the ground. Heat rate 8,500–10,000. Often paired with steam (CHP).',
            '<b>Microturbines</b> (Capstone) — small turbines. Heat rate 10,000–12,000. "Low NOx" but <i>not zero</i>.',
          ],
        },
        { k: 'p', html: '<b>Family 2 — Electrochemical.</b> No burning. A fuel cell converts fuel to electricity through a chemical reaction — like a battery you feed fuel into.' },
        {
          k: 'ul', tier: 'reported',
          items: [
            '<b>SOFC</b> (our platform) — solid oxide fuel cell. Zero NOx, zero SOx, no combustion, no rotating equipment.',
            '<b>MCFC</b> (FuelCell Energy) — molten carbonate. Also zero NOx/SOx. Heat rate ~6,200–6,800.',
          ],
        },
        { k: 'p', html: 'And two that are not onsite combustion at all: <b>Grid / ERCOT</b> (no equipment, but you inherit the multi-year queue and Uri-class volatility) and <b>Battery + Solar</b> (zero fuel, but roughly 20% capacity factor against 95% baseload).' },

        { k: 'h', n: '1.2', t: 'The two terms you must own cold' },
        {
          k: 'p', tier: 'verified',
          html: '<b>Heat rate</b> = how much fuel energy (BTU) it takes to make one kWh. <em>Lower is better</em> — more efficient, less gas per unit of power. This is the quietest but deadliest weapon: lower heat rate means less gas per MWh, which means the lowest fuel-cost dispatchable option, and the advantage <i>widens</i> when gas gets expensive.',
        },
        {
          k: 'call', tone: 'sport', tier: 'verified',
          title: 'Sports analogy',
          html: 'Heat rate is gas mileage. A car getting 50 mpg beats a truck getting 12 mpg every time you fill up — and <b>especially</b> when gas gets expensive. Same trip, different pain.',
        },
        {
          k: 'p', tier: 'verified',
          html: '<b>Baseload</b> = power that runs continuously, 24/7, at steady output. Refineries, data centers, and industrial plants are baseload by nature — they never turn off, so the perfect power source never turns off either.',
        },
        {
          k: 'call', tone: 'sell', tier: 'inferred',
          title: 'Why this matters for selling',
          html: 'When a competitor brags about "flexible load following" (recips genuinely do this well), that is a feature for a <b>peaking</b> application — irrelevant to a refinery running flat 24/7. You reframe their strength as a non-benefit for THIS customer. You never say their product is bad. You say it is built for a different job.',
        },

        { k: 'h', n: '1.3', t: 'The four levers — the value spine' },
        { k: 'p', html: 'Every deal gets argued on four levers. Memorize them as a unit — they are the chorus you return to in every objection:' },
        {
          k: 'table', tier: 'inferred',
          head: ['Lever', 'What it covers'],
          rows: [
            ['<b>1 · Cost</b>', '$/MWh all-in, demand charges, 4CP transmission exposure'],
            ['<b>2 · Speed</b>', 'Time-to-power against the grid queue or a permit timeline'],
            ['<b>3 · Reliability</b>', 'Uptime, planned outages, Uri-class resilience'],
            ['<b>4 · ESG</b>', 'NOx/SOx, Scope 1, permitting in non-attainment zones'],
          ],
        },
        {
          k: 'call', tone: 'key', tier: 'inferred',
          title: 'Strategic thesis — say it before you pitch',
          html: 'Combustion alternatives force the customer to sacrifice <b>at least one</b> lever. Our SOFC platform delivers all four simultaneously. Teach this before you pitch anything.',
        },
      ],
      cards: [
        ['Heat rate', 'Lower = better. Less gas per MWh. The efficiency edge.', 'verified'],
        ['Baseload', '24/7 steady output. ~95% capacity factor.', 'verified'],
        ['Capacity factor', 'Actual output ÷ max possible. Solar ~20%, SOFC ~95%.', 'verified'],
        ['The 4 levers', 'Cost · Speed · Reliability · ESG', 'inferred'],
        ['Electrochemical', 'No flame. Fuel → electricity directly. Zero NOx/SOx.', 'verified'],
        ['The thesis', 'Combustion sacrifices a lever. We do not.', 'inferred'],
      ],
      quiz: [
        { q: 'Combustion alternatives force the customer to sacrifice at least one of…', opts: ['Cost, speed, reliability, ESG', 'Gas, oil, coal, nuclear', 'Voltage, current, power, frequency', 'Capex, opex, tax, financing'], a: 0, e: 'The four levers. The entire thesis is delivering all four at once — no tradeoff.' },
        { q: 'A LOWER heat rate means…', opts: ['Less efficient, more gas per kWh', 'More efficient, less gas per kWh', 'Higher emissions', 'Slower time-to-power'], a: 1, e: 'Heat rate is gas mileage. Lower = less BTU per kWh = the lowest fuel-cost dispatchable option, and the gap widens as gas gets expensive.' },
        { q: 'Which TWO technologies are BOTH zero NOx and zero SOx?', opts: ['Recip engines and microturbines', 'Aero turbines and CCGT', 'SOFC and MCFC', 'Battery and grid'], a: 2, e: 'Both are electrochemical fuel cells — no flame, so no NOx/SOx. The trap: microturbines are only LOW NOx, not zero.' },
        { q: 'A recip salesman touts "flexible load following" to a refinery. Best reframe?', opts: ['Agree it is the key feature', 'Point out that is a peaking benefit, irrelevant to a flat 24/7 baseload', 'Offer a lower price', 'Concede the deal'], a: 1, e: 'Load-following is a peaking virtue. A refinery runs flat 24/7 — so you reframe their strength as a non-benefit for THIS customer.' },
        { q: 'Which lever is the grid/ERCOT alternative WORST on for a growing load?', opts: ['ESG', 'Cost', 'Speed (time-to-power)', 'Reliability'], a: 2, e: 'The interconnection queue is the binding constraint — speed is where the grid physically cannot deliver. Reliability is a close second.' },
      ],
    },

    // ═══════════════════════ L2 ═══════════════════════
    {
      id: 'l2',
      tag: 'MECHANISM',
      title: 'SOFC vs. Combustion',
      sub: 'Why electrochemistry is different in kind, not degree, from burning fuel.',
      minutes: 15,
      blocks: [
        {
          k: 'call', tone: 'key', tier: 'verified',
          title: 'The one idea',
          html: 'An SOFC does not burn anything. Combustion creates heat by oxidizing fuel in a flame, then converts heat → motion → electricity — three lossy steps. An SOFC converts fuel chemically <b>straight to electricity</b> — fewer steps, higher efficiency, and no flame means no NOx, no SOx, no rotating equipment. A difference in <b>kind</b>, not degree.',
        },
        { k: 'h', n: '2.1', t: 'The product anchor (never deviate)' },
        {
          k: 'table', tier: 'inferred', confirm: 'ck-heatrate',
          head: ['Attribute', 'Detail'],
          rows: [
            ['Technology', 'Solid oxide fuel cell (SOFC) platform'],
            ['Combustion', '<b>None — electrochemical conversion</b>'],
            ['Emissions', 'Zero NOx, zero SOx'],
            ['Siting', 'Behind-the-meter; off-grid or grid-parallel'],
            ['Planned outages', '<b>Zero — continuous baseload operation</b>'],
            ['Weather resilience', 'Weatherproof, climate-independent'],
            ['Deployment', 'Modular, rapid time-to-power'],
            ['Permitting advantage', 'No combustion = no NSR/BACT trigger for NOx/SOx in non-attainment zones'],
            ['Maintenance', 'Zero planned downtime; remote monitoring + predictive maintenance'],
            ['Safety', 'No combustion, no rotating equipment, no high-pressure steam'],
          ],
        },
        { k: 'h', n: '2.2', t: 'Why electrochemistry wins on all four levers' },
        {
          k: 'ul', tier: 'inferred',
          items: [
            '<b>Cost / efficiency:</b> skipping the heat→motion steps means a lower heat rate than any combustion alternative. Less gas per MWh, structurally.',
            '<b>Speed:</b> no combustion means no NSR/BACT permitting trigger in non-attainment zones. Modular means rapid time-to-power.',
            '<b>Reliability:</b> no rotating equipment and no scheduled hot-section overhauls means zero planned outages. Weatherproof means Uri-resilient.',
            '<b>ESG:</b> no flame means zero NOx, zero SOx. Lowest CO₂/MWh among dispatchable sources. Hydrogen-ready — the bridge narrative.',
          ],
        },
        {
          k: 'call', tone: 'win', tier: 'inferred',
          title: 'The combustion trade-off triangle',
          html: 'Every combustion alternative forces a sacrifice: permit fast OR run clean; cheap capex OR no maintenance windows; big single unit OR modular scaling. SOFC refuses the trade-off — that is the entire Blue Ocean position. You are not competing harder on their axes. You are on a different axis.',
        },
        {
          k: 'call', tone: 'sport', tier: 'inferred',
          title: 'Sports analogy',
          html: 'Combustion is a pitcher who throws hard but tips every pitch — velocity, but you pay somewhere. SOFC is the pitcher with command AND velocity AND stamina who never needs a day off. The customer does not have to choose what to give up.',
        },
        {
          k: 'call', tone: 'warn', tier: 'inferred', confirm: 'ck-uptime',
          title: 'Where this claim gets tested',
          html: '"Zero planned outages" is a design property. The second question a good buyer asks is: <i>what will you sign?</i> Design claim and contractual guarantee are different objects. Know both before you use either.',
        },
      ],
      cards: [
        ['Planned outages', 'Zero. No rotating parts, no overhauls.', 'inferred'],
        ['Emissions', 'Zero NOx, zero SOx. No flame.', 'verified'],
        ['NSR trigger', 'Combustion triggers it in non-attainment. We do not.', 'verified'],
        ['Heat→motion', 'The lossy steps combustion takes; SOFC skips them.', 'verified'],
        ['Blue Ocean', 'Different axis, not competing harder on theirs.', 'inferred'],
        ['H₂-ready', 'Same hardware; drop in hydrogen later.', 'inferred'],
      ],
      quiz: [
        { q: 'What does an SOFC skip that combustion must do?', opts: ['Using natural gas', 'The heat → motion conversion steps', 'Connecting to a load', 'Producing electricity'], a: 1, e: 'Combustion goes fuel → heat → motion → electricity. SOFC goes fuel → electricity electrochemically, skipping the lossy middle. That is the root cause of both the efficiency and the zero emissions.' },
        { q: 'Why does "no flame" automatically mean zero NOx and zero SOx?', opts: ['Because the gas is cleaner', 'Because NOx/SOx are products of high-temperature combustion that never occurs', 'Because of a scrubber', 'Because of carbon capture'], a: 1, e: 'NOx and SOx form in the combustion flame. No flame, no formation — categorical, not incremental. That is why there is no NSR/BACT trigger.' },
        { q: 'The "trade-off triangle" is best described as…', opts: ['A pricing model', 'Combustion must sacrifice one of: fast permit / clean / cheap capex / no outages / modular', 'A financing structure', 'A type of turbine'], a: 1, e: 'Every combustion option gives up at least one. SOFC refuses the trade — the Blue Ocean position.' },
        { q: 'A buyer says "zero planned outages — will you put that in the contract?" The right move is…', opts: ['Say yes immediately', 'Know the difference between the design claim and the signed guarantee, and answer with the one you can actually deliver', 'Change the subject', 'Say outages are not contractual'], a: 1, e: 'Design property and contractual guarantee are different objects. Over-promising on the uptime guarantee is how a technical win becomes a legal loss.' },
        { q: 'The hydrogen-ready story matters because…', opts: ['It lowers capex today', 'Same hardware can run on H₂ later — a bridge narrative for ESG buyers', 'It eliminates the gas supply', 'It speeds permitting'], a: 1, e: 'The platform is a bridge: gas now, hydrogen as supply matures, without replacing the hardware.' },
      ],
    },

    // ═══════════════════════ L3 ═══════════════════════
    {
      id: 'l3',
      tag: 'INTEGRATION',
      title: 'Electrical Infrastructure',
      sub: 'Speak watts/volts/amps, AC vs DC, the equipment chain, and survive the one-line conversation.',
      minutes: 35,
      blocks: [
        {
          k: 'call', tone: 'key', tier: 'inferred',
          title: 'Why this level decides deals',
          html: 'Electrical integration is where deals get technically derailed, or where you build unshakeable credibility. A BD/AE who can discuss one-lines, protection schemes, and SCADA earns the trust of the utilities superintendent and the reliability engineer — the people who approve or kill your project. You do not need to be the engineer. You need to speak the language and ask the right questions.',
        },
        { k: 'h', n: '3.1', t: 'Electricity basics — the vocabulary' },
        {
          k: 'pair', tier: 'verified',
          pairs: [
            ['Voltage (V)', 'Water PRESSURE. How hard electricity is pushed.'],
            ['Current (A)', 'FLOW RATE. How much is actually moving.'],
            ['Power (W)', 'The WORK done. Watts = Volts × Amps.'],
            ['Resistance (Ω)', 'How narrow or clogged the pipe is.'],
          ],
        },
        {
          k: 'table', tier: 'verified',
          head: ['Term', 'Unit', 'What it is', 'Why a BD/AE cares'],
          rows: [
            ['<b>Voltage</b>', 'V, kV', 'Electrical pressure', 'Site service voltage (4.16/13.8/34.5 kV) sets transformer and switchgear needs'],
            ['<b>Current</b>', 'A', 'Rate of electron flow', 'Drives conductor and breaker sizing; fault current sets switchgear duty'],
            ['<b>Power</b>', 'W, kW, MW', 'Volts × Amps = real work', 'The deal is sized in MW. 1 MW = 1,000 kW'],
            ['<b>Energy</b>', 'kWh, MWh', 'Power × time', 'What you bill. $/MWh is the scoreboard'],
            ['<b>Frequency</b>', 'Hz', 'Cycles per second of AC', 'US grid = 60 Hz. Generation must sync or it trips offline'],
            ['<b>Power factor</b>', '0–1', 'Real vs. apparent power alignment', 'Poor PF means utility penalties; SOFC inverters help correct it'],
          ],
        },

        { k: 'h', n: '3.2', t: 'AC vs. DC — the inverter is the heart of the system' },
        {
          k: 'table', tier: 'verified',
          head: ['', 'DC — Direct Current', 'AC — Alternating Current'],
          rows: [
            ['<b>Flow</b>', 'One direction, steady', 'Reverses 60× per second'],
            ['<b>Where</b>', 'Batteries, solar panels, <b>fuel cells</b>', 'The grid, motors, site distribution'],
            ['<b>Analogy</b>', 'Water down a one-way pipe', 'Water sloshing back and forth'],
            ['<b>The catch</b>', 'Hard to transform voltage or send far', 'Easy to step up/down, easy to transmit'],
          ],
        },
        {
          k: 'call', tone: 'key', tier: 'verified',
          title: 'The key fact: an SOFC produces DC',
          html: 'A fuel cell, like a battery, produces <b>DC</b>. The grid and the site run on <b>AC</b>. So every SOFC needs an <b>inverter</b> to convert DC → AC, synchronized to 60 Hz. The inverter is not an accessory — it is the handshake between our box and the customer\'s world.',
        },
        {
          k: 'ul', tier: 'verified',
          items: [
            '<b>DC → AC conversion:</b> turns the stack\'s DC output into grid-standard AC.',
            '<b>Synchronization:</b> matches voltage, frequency, and phase so we can run grid-parallel without tripping.',
            '<b>Power quality:</b> clean sine wave, low harmonic distortion, power-factor correction — meets IEEE 519.',
            '<b>Anti-islanding:</b> senses a grid outage and stops back-feeding a dead line. A safety must for utility approval (IEEE 1547).',
            '<b>Grid-forming vs. grid-following:</b> grid-following rides the grid\'s beat; <em>grid-forming</em> sets the beat itself — the magic behind island and microgrid mode.',
          ],
        },
        {
          k: 'call', tone: 'sport', tier: 'inferred',
          title: 'Sports analogy',
          html: 'The stack is the pitcher throwing DC heat. The inverter is the catcher calling the game — converting raw stuff into pitches the grid (the umpire at 60 Hz) will accept, and knowing when to stop throwing if the game has been called. That last part is anti-islanding.',
        },

        { k: 'h', n: '3.3', t: 'Three-phase power' },
        {
          k: 'call', tone: 'key', tier: 'verified',
          title: 'The idea in one breath',
          html: 'Single-phase AC is one wave rising and falling 60× per second — power pulses to zero twice per cycle. <b>Three-phase</b> runs three of those waves offset 120° apart, so at any instant at least one is delivering power. Combined power is smooth and constant. That is why motors, transformers, and generators are three-phase: smoother power, less vibration, and roughly 1.7× (√3) more power for the same conductor size.',
        },
        {
          k: 'pair', tier: 'verified',
          pairs: [
            ['Single-phase', 'One-piston engine — power pulses with every stroke'],
            ['Three-phase', 'A V6 — three pistons firing offset, smooth continuous power'],
            ['120° apart', 'Three friends pushing a merry-go-round at staggered intervals'],
            ['√3 ≈ 1.73', 'The constant in P = √3 × V × I × PF'],
          ],
        },
        {
          k: 'table', tier: 'verified',
          head: ['Term', 'What it means', 'Where it shows up'],
          rows: [
            ['<b>Phase</b>', 'One of the three AC waveforms, 120° apart', '"3-phase, 4-wire service" on a one-line'],
            ['<b>Line voltage</b>', 'Voltage between any two phase conductors', 'The voltage you quote: 480V, 13.8kV'],
            ['<b>Phase voltage</b>', 'Voltage between one phase and neutral', 'V_line = √3 × V_phase in a wye system'],
            ['<b>Wye vs. Delta</b>', 'Two ways to wire three-phase windings', 'Wye gives a neutral; Delta does not'],
            ['<b>3-phase power</b>', 'P = √3 × V × I × PF', 'The formula behind every MW↔Amp conversion'],
          ],
        },

        { k: 'h', n: '3.4', t: 'Generators, per-unit, and fault current' },
        { k: 'p', tier: 'verified', html: 'Traditional generators in recips, turbines, and CCGT are <b>synchronous machines</b> — a rotating magnet spins inside copper windings, producing three-phase AC mechanically locked to 60 Hz by shaft speed. That is why combustion generators need governors and synchronizing equipment: the physical shaft speed <i>is</i> the frequency. An SOFC has no shaft — the inverter creates the waveform electronically, which is more precise and is what enables grid-forming and island mode.' },
        { k: 'p', tier: 'verified', html: '<b>Per-unit (p.u.)</b> is engineer shorthand — a ratio to a base value rather than raw ohms. You will never calculate in per-unit. You need to recognize it so you do not freeze when it appears.' },
        { k: 'p', tier: 'verified', html: 'A <b>fault</b> is an unintended short circuit. Current can spike 10–50× normal because only system impedance limits it. <b>Fault duty</b> (in kA) is the maximum current switchgear and breakers must interrupt safely. Adding a new generation source changes the fault current available at the tie-in — the existing gear must still have margin.' },
        {
          k: 'call', tone: 'sport', tier: 'inferred',
          title: 'Sports analogy',
          html: 'Normal current is a steady jog. A fault is everyone in the stadium sprinting through one exit at once. The breaker is the door that has to slam shut fast enough to survive that surge. Fault duty is how big a surge that door is rated for.',
        },

        { k: 'h', n: '3.5', t: 'Generation → Transmission → Distribution' },
        {
          k: 'flow', tier: 'verified',
          stages: [
            { n: '01', nm: 'Generation', v: 'low/med kV', d: 'Plant makes power; step-UP transformer raises voltage for transport' },
            { n: '02', nm: 'Transmission', v: 'hundreds of kV', d: 'High voltage moves bulk power far with low loss. THIS is the grid queue' },
            { n: '03', nm: 'Substation', v: 'stepped down', d: 'Step-DOWN transformers plus switchgear. The PCC lives near here' },
            { n: '04', nm: 'Distribution', v: '4.16/13.8/34.5 kV', d: 'Medium-voltage feeders carry power around the site' },
            { n: '05', nm: 'Onsite load', v: '480 V → use', d: 'Final step-down. The refinery or data center you power', us: true },
          ],
        },
        {
          k: 'call', tone: 'win', tier: 'verified',
          title: 'Why higher voltage for transport — the one-liner that earns nods',
          html: 'Power = Volts × Amps. To send the same power, raising voltage lets you lower current — and line losses rise with the <b>square</b> of current. So utilities crank voltage up to ship power across the state, then step it down near the load. Behind-the-meter generation sits <b>at</b> the load and skips the entire round trip. Less loss, no transmission queue, no exposure to grid-wide failure.',
        },
        {
          k: 'table', tier: 'verified',
          head: ['Topology', 'How it is wired', 'Tradeoff'],
          rows: [
            ['<b>Radial</b>', 'Single path out to each load, like tree branches', 'Cheapest. One fault takes out everyone downstream. Most common for industrial feeders'],
            ['<b>Ring (loop)</b>', 'Feeder loops back, can be fed from either end', 'A fault can be isolated and power restored from the other direction'],
            ['<b>Network</b>', 'Multiple substations, multiple paths to any load', 'Highest reliability, highest cost. Dense urban and critical facilities'],
          ],
        },
        {
          k: 'call', tone: 'sell', tier: 'inferred',
          title: 'Why topology matters for selling',
          html: 'A site on a <b>radial</b> feeder has a single upstream point of failure — every fault on that feeder takes the whole site down. That is the strongest possible argument for island-capable SOFC. A site already on a <b>ring or network</b> has utility-side redundancy, so your reliability pitch should lean on Uri-class events (when the whole area goes down regardless of topology) rather than routine feeder faults.',
        },

        { k: 'h', n: '3.6', t: 'The equipment chain — every box, in order' },
        {
          k: 'table', tier: 'verified',
          head: ['Equipment', 'What it does', 'Where it sits'],
          rows: [
            ['<b>Fuel cell stack</b>', 'Produces raw DC power electrochemically', 'The SOFC module itself'],
            ['<b>Inverter (PCS)</b>', 'DC → AC, syncs to 60 Hz, power quality, anti-islanding', 'Immediately after the stack'],
            ['<b>Step-up transformer</b>', 'Raises inverter output to site distribution voltage', 'Between inverter and site bus'],
            ['<b>Switchgear</b>', 'Heavy-duty breakers, disconnects, relays at medium voltage', 'MV tie-in point'],
            ['<b>Switchboard</b>', 'Low-voltage distribution and protection hub', 'LV side, downstream'],
            ['<b>Circuit breaker</b>', 'Automatic switch that trips on fault. Resettable', 'Inside switchgear/switchboard'],
            ['<b>Protective relays</b>', 'The brains — sense over/under voltage, frequency, overcurrent, anti-islanding (IEEE 1547)', 'Within switchgear'],
            ['<b>Revenue meter</b>', 'Measures output for PPA billing (ANSI C12.20)', 'At the tie-in'],
            ['<b>ATS / static switch</b>', 'Transfers load between SOFC, grid, backup', 'Between sources and critical load'],
            ['<b>Substation</b>', 'Where transmission meets distribution. The PCC often lives here', 'Utility / site boundary'],
          ],
        },
        {
          k: 'call', tone: 'key', tier: 'verified',
          title: 'Switchboard vs. switchgear — the one people mix up',
          html: '<b>Switchboard</b> = lower voltage, front access, distributes power to many circuits in a building. <b>Switchgear</b> = higher voltage, heavier fault duty, metal-clad, built for utility-grade protection and isolation. On a one-line, switchgear is where the serious protection lives. Saying the right one in the room signals you actually know the system.',
        },

        { k: 'h', n: '3.7', t: 'Reading a single-line diagram' },
        {
          k: 'table', tier: 'verified',
          head: ['Symbol', 'What it represents', 'What to look for'],
          rows: [
            ['Circle with internal lines', 'Generator or motor', 'Existing cogen, diesel gensets, or your future SOFC tie-in'],
            ['Two overlapping circles', 'Transformer', 'Voltage each side tells you the step ratio'],
            ['Rectangle on a bus line', 'Switchgear or switchboard', 'Where breakers, relays, and disconnects live'],
            ['Small box with diagonal line', 'Circuit breaker', 'Spare slots = room to add a feeder without new switchgear'],
            ['Heavy horizontal line', 'Bus — the shared conductor', 'Your SOFC feeder connects to a bus section'],
            ['Zigzag to ground', 'Grounding connection', 'Tells you the grounding scheme'],
            ['Arrow down from a line', 'Load or feeder to a downstream panel', 'Where power actually goes to do work'],
          ],
        },
        {
          k: 'call', tone: 'sell', tier: 'inferred',
          title: 'What to actually do with a one-line',
          html: '<b>Look for:</b> service entrance (where utility power enters, what voltage, what size) · main switchgear (fault duty rating, spare breaker space) · existing generation and how it is tied in · tie-point candidates · critical loads on emergency power · grounding configuration.<br><br><b>Red flags:</b> no spare breaker capacity (new switchgear = cost) · existing generation with no clear protection scheme (coordination study) · classified-area markings near the proposed location · no space shown for new equipment.<br><br><b>Hand the one-line to engineering with your observations. Do not interpret beyond what is visible.</b>',
        },

        { k: 'h', n: '3.8', t: 'Interconnection modes' },
        {
          k: 'table', tier: 'inferred', confirm: 'ck-modes',
          head: ['Mode', 'Description', 'Use case', 'Key considerations'],
          rows: [
            ['<b>Grid-parallel (export)</b>', 'Synced with grid; excess can flow out', 'Most common BTM industrial', 'Interconnect agreement, revenue metering, anti-islanding'],
            ['<b>Grid-parallel (non-export)</b>', 'Synced; reverse-power relay blocks export', 'Simpler interconnect', 'Reverse power relay; output ≤ facility load'],
            ['<b>Island / off-grid</b>', 'SOFC is sole source', 'Remote / behind-the-fence', 'Black-start, load management, frequency and voltage regulation by SOFC'],
            ['<b>Island-capable (microgrid)</b>', 'Grid-parallel normally, seamless island on grid loss', 'Max resilience — data centers, critical process', 'Microgrid controller, auto transfer, load-shed logic'],
          ],
        },

        { k: 'h', n: '3.9', t: 'Site assessment checklist (Discovery)' },
        {
          k: 'table', tier: 'inferred',
          head: ['Area', 'Question to ask', 'Why it matters'],
          rows: [
            ['Service voltage', 'Primary distribution voltage? 4.16 / 13.8 / 34.5 kV?', 'Sets transformer and switchgear requirements'],
            ['Available capacity', 'Main switchgear capacity? Room for a new feeder?', 'Maxed infrastructure raises integration cost'],
            ['One-line diagram', 'Can we get the one-line? Where would SOFC tie in?', 'Defines interconnection point and protection scope'],
            ['Point of common coupling', 'Where does the facility connect to the utility?', 'Sets interconnect agreement scope and cost'],
            ['Existing backup gen', 'Diesel gensets, UPS, cogen?', 'Defines how SOFC interacts with existing assets'],
            ['Protection coordination', 'Existing relay settings and schemes?', 'SOFC must not disrupt existing fault protection'],
            ['Power quality', 'Harmonics, voltage regulation, PF needs?', 'Inverters must meet site and IEEE 519 standards'],
            ['Grounding', 'Solidly grounded, resistance, or ungrounded?', 'Affects SOFC grounding config and protection'],
            ['Hazardous area', 'NEC Class I Div 1 or Div 2 near the location?', 'Drives enclosure, wiring, siting constraints'],
            ['Space and routing', 'Cable routing, transformer pad, clearances?', 'Often the hidden constraint, especially brownfield'],
          ],
        },

        { k: 'h', n: '3.10', t: 'Integration risk flags' },
        {
          k: 'table', tier: 'inferred',
          head: ['Risk', 'RED — stop and assess', 'YELLOW — manageable', 'GREEN — straightforward'],
          rows: [
            ['<b>Voltage mismatch</b>', 'No tie-in; needs new substation', 'Step-up needed, space exists', 'Direct match to existing bus'],
            ['<b>Protection coord.</b>', 'Incompatible; full relay study', 'Setting changes; adaptable', 'Accommodates with minimal change'],
            ['<b>Space</b>', 'No room without civil or demo', 'Tight but feasible', 'Open pad near electrical room'],
            ['<b>Hazardous area</b>', 'Class I Div 1; major mods', 'Class I Div 2; manageable', 'Non-classified area'],
            ['<b>SCADA/controls</b>', 'Legacy, no standard protocol', 'Standard protocol, custom mapping', 'Modern DCS, plug-and-play'],
            ['<b>Utility cooperation</b>', 'Hostile or obstructive', 'Neutral but slow', 'Supportive; precedent exists'],
          ],
        },
        {
          k: 'ul', tier: 'verified',
          items: [
            '<b>Protocols:</b> Modbus TCP/IP, DNP3, OPC-UA, BACnet. Confirm site DCS compatibility (Honeywell, Emerson DeltaV, ABB, Yokogawa, Siemens).',
            '<b>Standards that come up:</b> IEEE 1547 (DER interconnection), IEEE 519 (harmonics), ANSI C12.20 (revenue metering), NEC (grounding, hazardous area), NERC CIP (cybersecurity where applicable).',
            '<b>ERCOT BTM:</b> non-export serving onsite load typically needs no ERCOT registration; a utility interconnect agreement is required regardless. Study chain: screening → system impact → facilities → agreement.',
          ],
        },
        {
          k: 'call', tone: 'sell', tier: 'inferred',
          title: 'Your lane vs. engineering\'s lane',
          html: '<b>You own:</b> asking for the one-line · identifying voltage and capacity · flagging hazardous area early · explaining interconnection modes · discussing SCADA at protocol level · quantifying an integration cost RANGE · spotting space and routing constraints.<br><br><b>Engineering owns:</b> the detailed electrical study · protection coordination design · equipment ratings · the interconnection application · detailed SCADA engineering · the detailed cost estimate · civil and cable routing.',
        },
      ],
      cards: [
        ['Inverter', 'DC → AC, syncs to 60 Hz, anti-islanding. The handshake.', 'verified'],
        ['SOFC output', 'DC — like a battery. Always needs an inverter.', 'verified'],
        ['Switchgear', 'MV protection: breakers + relays + disconnects.', 'verified'],
        ['Switchboard', 'LV distribution panel. Downstream of switchgear.', 'verified'],
        ['Breaker', 'Auto switch; trips on fault. Resettable.', 'verified'],
        ['Transformer', 'Steps voltage up or down. Step-up after inverter.', 'verified'],
        ['Relay', 'The brains; senses faults, commands breakers (IEEE 1547).', 'verified'],
        ['PCC', 'Point of common coupling — where you meet the utility.', 'verified'],
        ['Anti-islanding', 'Stop back-feeding a dead grid. Safety must.', 'verified'],
        ['IEEE 1547', 'The DER interconnection standard.', 'verified'],
        ['Three-phase', '3 AC waves, 120° apart. Smooth power. Nearly all industrial.', 'verified'],
        ['√3 (≈1.73)', 'The constant in P = √3 × V × I × PF.', 'verified'],
        ['Wye vs. Delta', 'Wye gives a neutral; Delta does not.', 'verified'],
        ['Synchronous generator', 'Spinning shaft IS the frequency. Needs governors.', 'verified'],
        ['Fault duty (kA)', 'How big a short-circuit surge the switchgear can interrupt.', 'verified'],
        ['One-line diagram', '3-phase system drawn as one line. Ask for it first.', 'verified'],
        ['Prime mover', 'What spins the generator shaft. SOFC has none.', 'verified'],
        ['Voltage regulation', '% voltage change no-load → full-load.', 'verified'],
        ['Power flow study', 'What an interconnection study is actually computing.', 'verified'],
        ['Radial feeder', 'Single path. One fault = everyone downstream dark.', 'verified'],
      ],
      quiz: [
        { q: 'An SOFC stack produces ____, but the grid runs on ____.', opts: ['AC; DC', 'DC; AC', 'DC; DC', 'AC; AC'], a: 1, e: 'A fuel cell makes DC. The grid and site run on AC. That mismatch is exactly why every SOFC needs an inverter.' },
        { q: 'The single most important job of the inverter is…', opts: ['Cooling the stack', 'Converting DC → AC and synchronizing to 60 Hz', 'Storing energy', 'Measuring fuel flow'], a: 1, e: 'DC→AC plus grid synchronization is the core. It also handles power quality and anti-islanding.' },
        { q: 'What is anti-islanding and why do utilities require it?', opts: ['Keeping the SOFC on its own island', 'Sensing a grid outage and stopping back-feed into a dead line — a safety must', 'A cooling mode', 'A billing method'], a: 1, e: 'If the grid goes down you must not energize a line crews believe is dead. IEEE 1547. Non-negotiable for interconnection approval.' },
        { q: 'Switchgear vs. switchboard — the real difference?', opts: ['Same thing, different brand', 'Switchgear = higher voltage, heavier fault duty, utility-grade protection; switchboard = lower-voltage downstream distribution', 'Switchboard is outdoors only', 'Switchgear has no breakers'], a: 1, e: 'Switchgear is the serious MV protection node. A switchboard is LV distribution further downstream.' },
        { q: 'Why does the grid raise voltage to ship power long distances?', opts: ['To increase current', 'Because losses rise with the square of current — higher voltage lets you lower current for the same power', 'To trigger NSR', 'To improve ESG'], a: 1, e: 'Power = V × A. Raise V, lower A for the same power; losses scale with current squared. BTM sits at the load and skips the round trip.' },
        { q: 'FIRST document you ask for in a site assessment?', opts: ['The lease', 'The one-line diagram', 'The tax return', 'The org chart'], a: 1, e: 'The one-line shows service entrance, switchgear capacity, tie-in candidates, existing generation, and grounding. It defines the whole integration scope.' },
        { q: 'Legacy control system with no standard protocol AND a Class I Div 1 area at the proposed location. Read?', opts: ['Green — proceed', 'Two RED flags — stop, assess, flag both to engineering early', 'Yellow — minor', 'Irrelevant to BD'], a: 1, e: 'Both are RED. Surface them early, hand to engineering, and reset timeline and cost expectations before they derail the deal.' },
        { q: 'A rectangle with a diagonal line on a one-line usually represents — and spare ones matter because?', opts: ['A transformer; spares mean nothing', 'A circuit breaker; spare slots mean room to add a feeder without buying new switchgear', 'A generator; spares are backup units', 'A grounding point'], a: 1, e: 'Spare breaker positions can be the difference between a modest tie-in and a six-figure switchgear purchase.' },
        { q: '"Fault duty" refers to…', opts: ['The SOFC normal output rating', 'The maximum short-circuit current switchgear must safely interrupt', 'A billing penalty', 'Harmonic distortion limit'], a: 1, e: 'A fault can spike current 10–50× normal. Adding SOFC generation can change available fault current at the tie-in — engineering confirms the existing gear still has margin.' },
        { q: 'Why does an SOFC not need a governor the way a recip does?', opts: ['It does not produce AC', 'A synchronous generator\'s shaft speed IS the frequency — SOFC has no shaft; the inverter creates the waveform electronically', 'SOFCs are exempt from IEEE 1547', 'It only runs in island mode'], a: 1, e: 'No rotating shaft means no RPM-linked frequency. The inverter generates and syncs the waveform — which is what enables grid-forming and island mode.' },
        { q: 'A prospect sits on a single RADIAL feeder. Strongest reliability argument?', opts: ['They are already redundant', 'A radial feeder is a single upstream point of failure — any fault takes the whole site down, the strongest case for island-capable SOFC', 'Radial feeders are immune to outages', 'Only matters for ring topologies'], a: 1, e: 'One path, tree branch. One upstream fault drops everyone downstream. That is exactly what island-capable SOFC solves — lead with it.' },
      ],
    },

    // ═══════════════════════ L4 ═══════════════════════
    {
      id: 'l4',
      tag: 'COMPETITIVE',
      title: 'Competitive Landscape',
      sub: 'Position against utility, recips, turbines, aeros, and linear generation. Win / lose / kill shot.',
      minutes: 25,
      blocks: [
        {
          k: 'call', tone: 'key', tier: 'inferred',
          title: 'Positioning rule — read before the battle cards',
          html: 'Never disparage by name unprompted. Lead with what combustion and the grid <b>cannot</b> do. When asked directly about a competitor, concede where they genuinely win, then pivot to the four levers. A rep who trashes a competitor sounds threatened. A rep who credits them and reframes sounds like the expert in the room.',
        },
        {
          k: 'call', tone: 'warn', tier: 'reported',
          title: 'This level has a shelf life',
          html: 'Competitor specs, financial health, and permitting timelines move. Everything on this level is REPORTED, not verified, and it was last checked on the date stamped at the top of this ladder. Before you cite any number to a customer, search it. A stale spec quoted confidently is worse than saying "let me confirm that."',
        },
        { k: 'h', n: '4.1', t: 'Quick-reference matrix' },
        {
          k: 'table', tier: 'reported', confirm: 'ck-heatrate',
          head: ['Technology', 'Key players', 'Heat rate', 'Permitting', 'Time-to-power'],
          rows: [
            ['<b>Recip engines</b>', 'Wärtsilä, INNIO, CAT', '7,500–8,500', 'NSR in non-attainment', '12–18 mo'],
            ['<b>Aero turbines</b>', 'GE LM, Solar Turbines', '8,500–10,000', 'NSR in non-attainment', '18–24 mo'],
            ['<b>Microturbines</b>', 'Capstone', '10,000–12,000', 'Easier, not exempt', '6–12 mo'],
            ['<b>MCFC fuel cells</b>', 'FuelCell Energy', '~6,200–6,800', 'Non-combustion advantage', '18–24 mo'],
            ['<b>Grid / ERCOT</b>', 'Utility / ERCOT', 'N/A', 'Interconnect queue', 'Multi-year'],
            ['<b>Battery + Solar</b>', 'Various', 'N/A', 'Site-specific', '12–24 mo'],
            ['<b>Our SOFC</b>', '—', 'CONFIRM', 'No NSR trigger', 'Rapid / modular'],
          ],
        },

        { k: 'h', n: '4.2', t: 'Battle cards' },
        {
          k: 'bc', tier: 'inferred',
          title: 'UTILITY / ERCOT',
          sub: '"we will just wait for the grid" — the real default competitor',
          win: 'No onsite equipment, no fuel management, no capital commitment, no OEM relationship. Doing nothing is always the easiest thing to approve.',
          ours: [
            'Large-load interconnection queues run years, not months — search the current figure for their zone before citing',
            'Winter Storm Uri (Feb 2021) is the reference event for Texas industrial buyers. Another one is a question of when, not if',
            'Real-time scarcity pricing creates volatility that behind-the-meter generation eliminates entirely',
          ],
          kill: 'Make the cost of waiting concrete with THEIR numbers: queue-delay cost = $/month of delayed production × months in queue. Then ask what their backup plan is if the queue slips again.',
          watch: 'Their inertia is comfort, not logic. You are not fighting an alternative — you are fighting the status quo, which never has to justify itself. Give the status quo a price tag.',
        },
        {
          k: 'bc', tier: 'inferred',
          title: 'RECIP ENGINES',
          sub: 'Wärtsilä / INNIO Jenbacher / CAT',
          win: 'Flexible load following, peaking applications, lower upfront $/kW, strong installed base and service network, deep relationships with reliability engineers.',
          ours: [
            'Any non-attainment zone — they cannot permit without NSR, BACT, and NOx offsets',
            'Zero planned downtime against their scheduled maintenance windows',
            'No combustion means no additional hydrocarbon-exposure concerns in refinery environments',
            'Efficiency: our heat rate (CONFIRM) against their 7,500–8,500 BTU/kWh',
          ],
          kill: '"In HGB, they cannot permit. Full stop." Then plant the question: "What does your TCEQ NSR timeline look like for a recip in this zone?"',
          watch: 'Incumbent relationships with refinery reliability engineers are real and earned. Do not fight on familiarity. Fight on permitting and emissions, where familiarity does not help them.',
        },
        {
          k: 'bc', tier: 'inferred', confirm: 'ck-chp',
          title: 'TURBINES / CCGT / AERO',
          sub: 'combined-cycle and aeroderivative',
          win: 'Largest single-unit capacity. Strong CHP and process-steam value. Combined-cycle squeezes more electricity from the same gas. Established EPC and financing paths.',
          ours: [
            'Same permitting wall — combustion triggers NSR, and larger capacity makes the NOx problem bigger, not smaller',
            'Long build and commissioning against modular, rapid time-to-power',
            'Planned outages for hot-section inspections and major overhauls against zero planned downtime',
            'We scale incrementally; CCGT is a large lumpy commitment sized to a load they do not have yet',
          ],
          kill: '"CCGT only pencils at large scale — and at that scale the NOx footprint is exactly what this zone will not permit. We deliver baseload now, modularly, with zero NOx."',
          watch: 'THE STEAM TRAP. A large process-heat load makes CHP value genuinely real. Answer it explicitly or it becomes the silent deal-killer. Do not answer it until ck-chp is closed.',
        },
        {
          k: 'bc', tier: 'inferred',
          title: 'LINEAR GENERATION',
          sub: 'linear-generator and free-piston entrants',
          win: 'Newer category. Typically pitched on fuel flexibility, modularity, and fast start. May claim lower emissions than conventional recips. Verify actual specs and financial health before any customer conversation.',
          ours: [
            'If it involves combustion or oxidation in any form, it still faces NSR/BACT. "Low" and "flexible" are not "zero"',
            'Zero NOx and zero SOx is categorical, not incremental. Permitting math does not care about better combustion',
            'Fleet scale, reference base, and uptime guarantee against an early-stage entrant (CONFIRM our own fleet data first)',
          ],
          kill: '"Cleaner combustion is still combustion. In a non-attainment zone the regulator scores NOx, not intentions. Zero is a different category than low."',
          watch: 'Do not over-claim against an unfamiliar entrant. The durable line is the categorical permitting and emissions advantage — not a spec war on numbers you have not verified.',
        },
        {
          k: 'ul', tier: 'reported',
          items: [
            '<b>Microturbines (Capstone):</b> win on small footprint and low capex below 1 MW. We win because low NOx is not zero NOx, and they do not scale to MW-plus loads. Check financial health before citing.',
            '<b>MCFC (FuelCell Energy):</b> also zero NOx/SOx, and wins in carbon-capture niches. We win on efficiency at industrial scale and faster modular deployment. Our heat-rate edge compresses their LCOE story.',
            '<b>Battery + Solar:</b> zero fuel and tax-credit stacking. We win on capacity factor — roughly 95% baseload against roughly 20% solar. Do the math on delivered $/MWh, not nameplate $/kW.',
          ],
        },
      ],
      cards: [
        ['Default competitor', 'The grid. Doing nothing. Give the status quo a price tag.', 'inferred'],
        ['Recip kill shot', 'In non-attainment, they cannot permit. Full stop.', 'inferred'],
        ['The steam trap', 'CHP value is real. Concede it, then answer it.', 'inferred'],
        ['Linear gen line', 'Cleaner combustion is still combustion. Zero ≠ low.', 'inferred'],
        ['Positioning rule', 'Concede where they win, then pivot to the four levers.', 'inferred'],
        ['Solar comparison', 'Nameplate $/kW is the wrong denominator. Delivered $/MWh is right.', 'verified'],
      ],
      quiz: [
        { q: 'In most deals, the true default competitor is…', opts: ['Wärtsilä', 'The grid / ERCOT — "we will just wait"', 'Battery plus solar', 'FuelCell Energy'], a: 1, e: 'The customer default is to wait. Kill shot: multi-year queue, Uri, and price volatility — priced in their dollars.' },
        { q: 'The single hardest reason recips lose in a non-attainment zone?', opts: ['Too expensive', 'They cannot permit — NSR, BACT, NOx offsets', 'Too quiet', 'Foreign-made'], a: 1, e: 'Plant the TCEQ NSR timeline question and let permitting reality do the work for you.' },
        { q: 'The CCGT / aero "steam trap" is…', opts: ['A pricing trick', 'Their real CHP and process-steam value — must be answered explicitly, not ignored', 'A type of turbine', 'A permitting loophole'], a: 1, e: 'If the customer has a steam load, CHP is genuine value. Concede it, then answer. And do not answer until the CHP capability confirm is closed.' },
        { q: 'A prospect likes a "clean" linear-generator entrant. Durable line, and what NOT to do?', opts: ['Match their spec claims aggressively', '"Cleaner combustion is still combustion — zero is not low"; do NOT spec-war on unverified numbers', 'Disparage them by name', 'Drop the deal'], a: 1, e: 'Lead with the categorical permitting and emissions advantage. Do not over-claim against an entrant whose numbers you have not confirmed.' },
        { q: 'When the customer names a competitor, the rule is…', opts: ['Attack immediately', 'Concede where they genuinely win, then pivot to the four levers', 'Refuse to discuss', 'Match their price'], a: 1, e: 'Credit them, then reframe. A rep who trashes a competitor sounds threatened. A rep who credits them sounds like the expert.' },
        { q: 'Everything on this level carries which tier — and what does that obligate you to do?', opts: ['Verified; cite freely', 'Reported; search and confirm the figure before quoting it to a customer', 'Inferred; never mention it', 'Untiered'], a: 1, e: 'Competitor data is reported, it goes stale, and it is stamped with a date. A stale spec quoted confidently is worse than "let me confirm that."' },
      ],
    },

    // ═══════════════════════ L5 — NEW ═══════════════════════
    {
      id: 'l5',
      tag: 'ECONOMICS',
      title: 'Deal Economics',
      sub: 'The money math. $/MWh, the fuel calculation, the customer bill, LCOE, and the three numbers that close.',
      minutes: 30,
      blocks: [
        {
          k: 'call', tone: 'key', tier: 'inferred',
          title: 'Why this level exists',
          html: 'You can win every physics argument in Levels 1–4 and still lose the deal at procurement. The engineer approves you. The CFO buys you. This level is the money — and it is the single most common gap in an otherwise strong technical seller.',
        },

        { k: 'h', n: '5.1', t: 'The scoreboard is delivered $/MWh' },
        { k: 'p', tier: 'verified', html: 'One number survives the meeting: <b>all-in delivered $/MWh</b>. Everything else — capex, heat rate, capacity factor, tax treatment — is an input that rolls up into it. If you cannot state your number and their current number in the same units, you are not in a commercial conversation yet.' },
        {
          k: 'call', tone: 'sport', tier: 'inferred',
          title: 'Sports analogy',
          html: '$/MWh is batting average. Annual dollars saved is RBIs. Nobody in the front office gets excited about average alone — they want to know how many runs came home. Always convert the rate into the annual dollar.',
        },

        { k: 'h', n: '5.2', t: 'The fuel calculation you must do in your head' },
        {
          k: 'math', tier: 'verified',
          title: 'Fuel cost per MWh',
          lines: [
            'Fuel $/MWh  =  (heat rate BTU/kWh ÷ 1,000) × gas price $/MMBtu',
            '',
            'Why: 1 MWh = 1,000 kWh. So 8,000 BTU/kWh = 8,000,000 BTU = 8 MMBtu per MWh.',
          ],
          result: 'A recip at 8,000 BTU/kWh with $3.50 gas: 8.0 × $3.50 = $28.00/MWh of fuel.',
        },
        {
          k: 'table', tier: 'verified',
          head: ['Heat rate', 'Gas @ $3.00', 'Gas @ $3.50', 'Gas @ $5.00', 'Gas @ $7.00'],
          rows: [
            ['6,500 BTU/kWh', '$19.50', '$22.75', '$32.50', '$45.50'],
            ['8,000 BTU/kWh', '$24.00', '$28.00', '$40.00', '$56.00'],
            ['10,000 BTU/kWh', '$30.00', '$35.00', '$50.00', '$70.00'],
            ['<b>Spread (6.5k vs 8k)</b>', '<b>$4.50</b>', '<b>$5.25</b>', '<b>$7.50</b>', '<b>$10.50</b>'],
          ],
        },
        {
          k: 'call', tone: 'key', tier: 'verified',
          title: 'The insight most reps miss',
          html: 'The efficiency advantage is a <b>levered bet on gas prices</b>. The spread does not stay flat — it widens as gas gets more expensive. At $3.50 gas, a 1,500 BTU/kWh edge is $5.25/MWh. At $7.00 gas it is $10.50/MWh, double. So when a customer worries about gas price volatility, the efficient asset is the <i>hedge</i>, not the exposure. That reframe wins the "what if gas spikes" objection outright.',
        },
        {
          k: 'math', tier: 'verified',
          title: 'Converting the spread into annual dollars',
          lines: [
            '95% capacity factor  =  0.95 × 8,760 h  =  8,322 hours/year',
            '1 MW running 8,322 h  =  8,322 MWh/year',
            '',
            '$5.25/MWh × 8,322 MWh  =  $43,690 per MW per year',
          ],
          result: 'On a 20 MW deal at $3.50 gas, the heat-rate edge alone is roughly $874,000 per year. At $7.00 gas it is roughly $1.75M per year.',
        },

        { k: 'h', n: '5.3', t: 'Deconstruct what they actually pay today' },
        { k: 'p', tier: 'verified', html: 'Most reps sell against the energy line only. That is the smallest of the three things behind-the-meter generation attacks.' },
        {
          k: 'table', tier: 'verified',
          head: ['Bill component', 'What it is', 'Does BTM generation cut it?'],
          rows: [
            ['<b>Energy charge</b>', 'Cents per kWh consumed', 'Yes — directly displaced'],
            ['<b>Demand charge</b>', '$/kW-month on peak demand, usually the highest 15-minute interval. Often a large share of an industrial bill, and frequently carries a ratchet that keeps you paying a past peak for months', 'Yes — shaving the peak is where the quiet money is'],
            ['<b>Transmission (4CP)</b>', 'In ERCOT, large customers\' transmission cost for the next calendar year is set by their average demand during the ERCOT system peak 15-minute interval in each of June, July, August and September', 'Yes — reducing load during four intervals resets next year\'s cost'],
            ['<b>Riders / delivery / ancillary</b>', 'Pass-throughs, capacity, ancillary services', 'Partially — varies by tariff'],
          ],
        },
        {
          k: 'call', tone: 'win', tier: 'inferred',
          title: 'The triple hit',
          html: 'Behind-the-meter generation cuts energy AND demand AND 4CP transmission. Ask for twelve months of billing detail, not just an average rate. The blended rate hides where the money actually is — and the customer usually does not know either.',
        },
        {
          k: 'call', tone: 'sport', tier: 'verified',
          title: '4CP in one breath',
          html: 'Four Coincident Peak. Picture four snapshots taken in June, July, August, and September, each at the exact moment all of Texas is pulling the hardest. Your average across those four photos is your transmission bill for the whole next year. Miss those four moments and you pay less for twelve months. It is the single highest-leverage hour in the Texas industrial year.',
        },

        { k: 'h', n: '5.4', t: 'Capacity factor is a $/MWh multiplier' },
        {
          k: 'math', tier: 'verified',
          title: 'Nameplate is a lie; delivered energy is the truth',
          lines: [
            '1 MW at 95% capacity factor  →  8,322 MWh/year',
            '1 MW at 20% capacity factor  →  1,752 MWh/year',
            '',
            'Same nameplate. 4.75× the delivered energy.',
          ],
          result: 'Capex per nameplate kW is the wrong denominator. Capex per delivered MWh is the right one. This is the entire solar comparison in one line.',
        },

        { k: 'h', n: '5.5', t: 'LCOE — the one formula worth memorizing' },
        {
          k: 'math', tier: 'verified',
          title: 'Levelized cost of energy',
          lines: [
            'LCOE  =  (Capex × CRF + Fixed O&M) ÷ Annual MWh  +  Fuel $/MWh  +  Variable $/MWh',
            '',
            'CRF (capital recovery factor)  =  i(1+i)^n ÷ ((1+i)^n − 1)',
            'At i = 8%, n = 20 years:  CRF ≈ 0.102',
          ],
          result: 'Plain English: at 8% over 20 years you recover about 10.2% of your capital cost every year. That single number turns any capex into an annual charge.',
        },
        {
          k: 'math', tier: 'inferred', confirm: 'ck-capex',
          title: 'Worked example — ILLUSTRATIVE INPUTS ONLY',
          lines: [
            'Assume: 10 MW · $50M installed · 8% / 20 yr · 95% CF · 6,500 BTU/kWh · $3.50 gas · $8/MWh O&M',
            '',
            'Annual energy:      10 MW × 8,322 h        =  83,220 MWh',
            'Capital recovery:   $50M × 0.102           =  $5.10M/yr',
            'Capital $/MWh:      $5.10M ÷ 83,220        =  $61.28/MWh',
            'Fuel $/MWh:         6.5 × $3.50            =  $22.75/MWh',
            'O&M $/MWh:                                 =  $8.00/MWh',
            '                                             ───────────',
            'All-in LCOE:                               ≈  $92/MWh',
          ],
          result: 'Every input above is a placeholder. Learn the mechanic, not the number. Nothing here goes in a proposal until ck-capex is closed.',
        },

        { k: 'h', n: '5.6', t: 'Deal structures — who owns the box' },
        {
          k: 'table', tier: 'inferred',
          head: ['Structure', 'How it works', 'Customer holds', 'We hold', 'Best when'],
          rows: [
            ['<b>Customer capex</b>', 'They buy and own the asset', 'Fuel risk, performance risk, residual value, balance sheet', 'Warranty and service obligation', 'They have capital, appetite, and a long horizon. Best NPV for them'],
            ['<b>PPA / energy-as-a-service</b>', 'We own; they pay $/MWh for what they take', 'Almost nothing', 'Fuel risk, performance risk, capital, residual', 'They have no capex appetite or want risk transferred. Highest-probability close'],
            ['<b>Shared savings</b>', 'They pay a share of measured savings vs. baseline', 'Baseline dispute risk', 'Everything, plus measurement burden', 'The savings case is strong and the baseline is clean'],
            ['<b>Tolling</b>', 'They supply the gas; pay a conversion fee', 'Fuel price risk (deliberately)', 'Conversion performance', 'They already have favorable gas supply and want to keep that upside'],
          ],
        },
        {
          k: 'call', tone: 'sell', tier: 'inferred',
          title: 'The structure IS the objection handler',
          html: '"What if gas prices spike?" is not really a fuel question — it is a risk-allocation question. A PPA moves fuel risk to us. Tolling keeps it with them on purpose. Naming the structure that resolves their specific fear is more persuasive than any spec sheet.',
        },

        { k: 'h', n: '5.7', t: 'The incentives layer — route, do not quote' },
        {
          k: 'call', tone: 'warn', tier: 'inferred', confirm: 'ck-tax',
          title: 'Hard rule: never quote a credit percentage',
          html: 'Federal clean-energy credit rules changed materially through 2025, and the treatment of a <i>natural-gas-fueled</i> fuel cell is not the same as a zero-emissions resource under the technology-neutral regime. Texas property-tax abatement also moved — the old Chapter 313 program expired and a successor program replaced it. Both are counsel questions with real dollars attached.<br><br><b>Your line:</b> "There is an incentive layer here that can move the number meaningfully. I will get you our tax counsel\'s read rather than guess." That answer builds more trust than a confident wrong percentage, and it is the only defensible one.',
        },
        { k: 'p', tier: 'inferred', html: 'What you should know exists, without quoting terms: federal investment credits (eligibility varies by technology and fuel), carbon-capture credits where capture is in scope, Texas property-tax abatement for qualifying projects, and the fact that Texas has no state income tax — which changes the after-tax math relative to other states.' },

        { k: 'h', n: '5.8', t: 'The three numbers that close' },
        {
          k: 'ul', tier: 'inferred',
          items: [
            '<b>1 · The delta.</b> Your all-in $/MWh against their current all-in $/MWh. Same units, same scope, no asterisks.',
            '<b>2 · The annual dollar.</b> Delta × their annual MWh. This is the number that gets repeated in the meeting you are not in.',
            '<b>3 · The cost of waiting.</b> $/month of delayed production, curtailment risk, or outage exposure × months in the queue. This is the number that kills the status quo.',
          ],
        },
        {
          k: 'call', tone: 'key', tier: 'inferred',
          title: 'Never present the rate alone',
          html: 'A $/MWh figure by itself invites a procurement comparison you may lose on one line. The rate plus the annual dollar plus the cost of doing nothing is a business case, and a business case is much harder to shop.',
        },
      ],
      cards: [
        ['Fuel $/MWh formula', '(heat rate ÷ 1,000) × gas price $/MMBtu', 'verified'],
        ['8,322 hours', '95% capacity factor × 8,760 h. The baseload year.', 'verified'],
        ['CRF at 8% / 20yr', '≈ 0.102 — you recover ~10.2% of capex per year.', 'verified'],
        ['LCOE', '(Capex × CRF + fixed O&M) ÷ MWh + fuel + variable.', 'verified'],
        ['4CP', 'Avg demand during ERCOT peak in Jun/Jul/Aug/Sep sets next year\'s transmission cost.', 'verified'],
        ['Demand charge', '$/kW-month on peak 15-min demand. Often ratcheted.', 'verified'],
        ['The triple hit', 'BTM cuts energy AND demand AND 4CP.', 'inferred'],
        ['Levered gas bet', 'Efficiency spread widens as gas rises. Efficiency is the hedge.', 'verified'],
        ['Capacity factor multiplier', '95% vs 20% = 4.75× delivered energy per nameplate MW.', 'verified'],
        ['PPA', 'We own, they pay $/MWh. Transfers fuel and performance risk.', 'inferred'],
        ['Tolling', 'They supply gas, pay a conversion fee. Keeps fuel upside with them.', 'inferred'],
        ['Tax rule', 'Route to counsel. Never quote a credit percentage.', 'inferred'],
        ['The three numbers', 'Delta $/MWh · annual dollars · cost of waiting.', 'inferred'],
      ],
      quiz: [
        { q: 'A competitor runs 8,000 BTU/kWh. Gas is $4.00/MMBtu. Their fuel cost per MWh?', opts: ['$8.00', '$32.00', '$320.00', '$3.20'], a: 1, e: '(8,000 ÷ 1,000) × $4.00 = 8 × 4 = $32.00/MWh. Memorize the divide-by-1,000 step — 1 MWh is 1,000 kWh.' },
        { q: 'Gas rises from $3.50 to $7.00. What happens to a 1,500 BTU/kWh efficiency advantage?', opts: ['It stays flat', 'It roughly doubles, from ~$5.25/MWh to ~$10.50/MWh', 'It shrinks', 'It disappears'], a: 1, e: 'The spread scales linearly with gas price. Efficiency is a levered bet — which is why the efficient asset is the hedge against volatility, not the exposure to it.' },
        { q: 'In ERCOT, 4CP determines…', opts: ['The energy charge for the current month', 'Next calendar year\'s transmission cost, set by average demand during the system peak interval in Jun/Jul/Aug/Sep', 'The interconnection queue position', 'The ancillary services price'], a: 1, e: 'Four snapshots, four months, one bill for the next twelve. It is the highest-leverage set of intervals in the Texas industrial year.' },
        { q: 'A customer gives you their blended $/kWh rate. Why is that not enough?', opts: ['It is always inaccurate', 'It hides the demand and transmission components — which is where BTM generation delivers the quiet money', 'Blended rates are illegal', 'You need it in dollars per therm'], a: 1, e: 'Ask for twelve months of billing detail. Selling against the energy line alone leaves the two biggest levers on the table.' },
        { q: 'At 8% over 20 years, the capital recovery factor is ~0.102. What does that mean in plain English?', opts: ['The project returns 10.2% profit', 'You must recover about 10.2% of the capital cost every year to pay off capital plus interest over the term', 'Depreciation is 10.2% per year', 'The discount rate is 10.2%'], a: 1, e: 'CRF converts any capex into an annual charge. It is the single number that turns a capital cost into a $/MWh component.' },
        { q: 'Solar and SOFC quote a similar $/kW capex. Why is that comparison misleading?', opts: ['Solar capex is always understated', 'Nameplate is the wrong denominator — at ~95% vs ~20% capacity factor, SOFC delivers ~4.75× the energy per nameplate MW', 'Solar has higher O&M', 'They use different currencies'], a: 1, e: 'Capex per delivered MWh is the honest comparison. This one reframe is the entire battery-plus-solar battle card.' },
        { q: 'A CFO asks what federal tax credit applies. The correct move is…', opts: ['Quote the percentage you remember', 'Say there is a meaningful incentive layer and route it to tax counsel rather than guess', 'Say there are no credits', 'Tell them to ask their accountant and move on'], a: 1, e: 'Credit rules moved through 2025 and gas-fueled fuel cells are treated differently from zero-emissions resources. Routing to counsel builds more trust than a confident wrong number.' },
        { q: 'Which structure moves fuel-price risk from the customer to us?', opts: ['Customer capex', 'PPA / energy-as-a-service', 'Tolling', 'Shared savings baseline'], a: 1, e: 'Under a PPA we own the asset and sell $/MWh, so we carry fuel and performance risk. Tolling does the opposite on purpose — the customer keeps their gas supply upside.' },
        { q: 'The three numbers that close a deal are…', opts: ['Capex, opex, IRR', 'Delta $/MWh, annual dollars saved, and the cost of waiting', 'Heat rate, capacity factor, NOx', 'Price, term, warranty'], a: 1, e: 'The rate alone invites a procurement line-item comparison. Rate plus annual dollars plus cost of doing nothing is a business case — much harder to shop.' },
      ],
    },

    // ═══════════════════════ L6 ═══════════════════════
    {
      id: 'l6',
      tag: 'FIELD READY',
      title: 'Synthesis: Field Ready',
      sub: 'Diagnose a live scenario, pick the frame, map the decision, neutralize the objection.',
      minutes: 28,
      blocks: [
        {
          k: 'call', tone: 'key', tier: 'inferred',
          title: 'The one idea',
          html: 'Mastery is not reciting facts. It is diagnosing a live situation, picking the right frame, and advancing the deal. Every output should move a stage gate, preempt a gap, neutralize an objection, or strengthen a stakeholder relationship — or it does not ship.',
        },
        { k: 'h', n: '6.1', t: 'Lead with commercial insight' },
        { k: 'p', tier: 'inferred', html: 'Teach the buyer something about <em>their</em> business — permitting math, transmission exposure, queue reality, the margin impact of an outage — BEFORE you discuss product. The product then becomes the obvious resolution to a tension you surfaced, rather than a thing you are pushing.' },
        {
          k: 'call', tone: 'win', tier: 'inferred',
          title: 'Refining hook',
          html: '<i>"Your facility\'s NOx budget has [X] headroom remaining. Any combustion replacement above [threshold] triggers NSR — 18 to 36 months and an uncertain outcome. Meanwhile every month of reliability risk on your aging cogen carries [$/month] in restart exposure. There is a path that bypasses permitting entirely and eliminates the planned downtime your maintenance window creates."</i>',
        },

        { k: 'h', n: '6.2', t: 'Objection handling' },
        { k: 'p', tier: 'inferred', html: 'Sequence: <b>Label → Mirror → Reframe → Support → Calibrated question.</b> Name the emotion first, repeat their own last few words, reframe to the four levers, support with data, then ask a question that advances.' },
        {
          k: 'table', tier: 'inferred',
          head: ['Objection', 'The underlying fear', 'Reframe angle'],
          rows: [
            ['"SOFC is unproven at scale"', 'Career risk', 'Fleet data, reference sites, uptime guarantee with LDs, insurer acceptance'],
            ['"Stack degradation and replacement cost"', 'Hidden lifecycle cost', 'Predictable and budgetable, like a turbine overhaul. Show 20-year TCO'],
            ['"Natural gas is still fossil fuel"', 'ESG / greenwashing exposure', 'Combustion vs. electrochemistry. Zero NOx/SOx, lowest CO₂ per MWh among dispatchable, hydrogen-ready bridge'],
            ['"What if gas prices spike?"', 'Fuel cost volatility', 'Efficiency is the hedge — the spread widens as gas rises. And a PPA transfers the risk to us'],
            ['"We already have a working cogen"', 'Stranded asset, internal conflict', 'Complement rather than replace. Aging-asset risk. Baseload vs. peaking allocation'],
            ['"Your price is higher than [competitor]"', 'Being overcharged', 'Concede the line they win, pivot to permitting, outages, and 20-year TCO. Capex is one line; the deal is the bundle'],
          ],
        },

        { k: 'h', n: '6.3', t: 'Map the decision before you build momentum' },
        { k: 'p', tier: 'inferred', html: 'For committee-driven industrial and defense buyers, the decision <i>process</i> is the deal. The veto point is frequently not economics — it is security, HSE, or compliance. Surface it in the first meeting, not after you have spent three months building consensus somewhere else.' },
        {
          k: 'ul', tier: 'inferred',
          items: [
            '<b>Who signs</b> at what dollar threshold, and what changes above it?',
            '<b>Who can veto</b> regardless of the business case — security, HSE, legal, insurance?',
            '<b>What killed</b> the last similar project here?',
            '<b>What is the sequence</b> — feasibility study, then FEL, then capital committee, then board?',
            '<b>Who is the economic buyer</b> versus the technical champion, and are they aligned?',
            '<b>Single-threaded is a cap.</b> If you only have one relationship, your deal health is capped no matter how good that relationship is.',
          ],
        },

        { k: 'h', n: '6.4', t: 'Worked scenario — Gulf Coast petrochem' },
        {
          k: 'call', tone: 'sport', tier: 'inferred',
          title: 'The setup',
          html: 'Gulf Coast petrochem or refining site in a non-attainment corridor. Aging gas-turbine cogen around 20 years old. Leaning toward a new aeroderivative because "that is what we know," and the reliability engineer trusts the incumbent OEM. Significant process-steam load.',
        },
        {
          k: 'ul', tier: 'inferred',
          items: [
            '<b>Diagnose:</b> Speed and ESG are the hidden landmines (NSR in non-attainment). Reliability is their stated driver. The steam load is the trap.',
            '<b>Frame:</b> teach the NSR timeline before pitching. "What does your TCEQ timeline look like for an aero here?"',
            '<b>Neutralize the steam trap:</b> concede CHP value is real, then answer it — waste-heat recovery or a separate steam solution. Do not let it become the silent killer, and do not answer it until the CHP confirm is closed.',
            '<b>Disarm incumbent comfort:</b> "Your engineer\'s trust in [incumbent] is earned — and irrelevant to whether the agency issues the permit."',
            '<b>Bring the money:</b> their current all-in $/MWh including demand and 4CP, your delta, the annual dollar, and the cost of the outage window they already schedule.',
            '<b>Advance:</b> "What would your reliability engineer and HSE need to see to support a feasibility study?" Mutual next step, named owner, date.',
          ],
        },

        { k: 'h', n: '6.5', t: 'Worked scenario — defense prime, single utility' },
        {
          k: 'call', tone: 'sport', tier: 'inferred',
          title: 'The setup',
          html: 'Defense prime with a critical-mission facility on a single utility connection. They have never sole-sourced anything else — steel, chips, capital. Energy security and domestic supply are explicit program priorities.',
        },
        {
          k: 'ul', tier: 'inferred',
          items: [
            '<b>Diagnose:</b> Reliability and the domestic-supply angle lead. ESG is secondary. Expect a security or compliance gate that can stop the project outright.',
            '<b>The door-opener:</b> "You do not sole-source any other critical input — steel, chips, capital, water. Why sole-source electricity, your highest-operational-risk input? The grid is a single point of failure you would never accept anywhere else."',
            '<b>Stack the domestic angle:</b> "…and you would never sole-source it through a supply chain running through China." This is the Chip War argument, and it lands with program leadership and the CFO simultaneously.',
            '<b>Map the veto early:</b> ask who signs at what threshold, when security review enters, and what has killed similar projects before. Do this in meeting one.',
            '<b>Advance:</b> a named decision-process map feeding a mutual action plan. Multi-thread facilities, security, program, and finance from the start.',
          ],
        },
      ],
      cards: [
        ['Commercial insight first', 'Teach their business before pitching product.', 'inferred'],
        ['Label', 'Name the emotion first.', 'inferred'],
        ['Mirror', 'Repeat their last two or three words.', 'inferred'],
        ['Calibrated question', '"What would need to be true for…"', 'inferred'],
        ['The steam trap', 'CHP value is real. Concede, then answer.', 'inferred'],
        ['Single-source reframe', '"You do not sole-source steel, chips, capital — why electricity?"', 'inferred'],
        ['Domestic moat', 'Made in USA, no China supply chain. The Chip War argument.', 'inferred'],
        ['Decision map', 'Find the veto point — often security or HSE — in meeting one.', 'inferred'],
        ['Single-threaded', 'One relationship caps deal health no matter how good it is.', 'inferred'],
        ['The ask', 'Always a mutual next step, named owner, date.', 'inferred'],
      ],
      quiz: [
        { q: 'For a defense prime, what is the door-opener BEFORE any product talk?', opts: ['Lead with pricing and incentives', 'The single-source reframe — they would never sole-source steel, chips, or capital, so why electricity?', 'Ask for an NDA', 'Pitch zero emissions'], a: 1, e: 'It reframes you as a second source rather than a bet-the-business switch. The domestic supply-chain angle then stacks on top.' },
        { q: 'For a committee-driven buyer, what is most likely the REAL veto point and when do you find it?', opts: ['Price, at contract signing', 'Security, HSE, or compliance — surfaced in the FIRST meeting via the decision map', 'Marketing approval, found late', 'There is no veto point'], a: 1, e: 'The decision process IS the deal. A compliance gate can stop a project outright regardless of economics. Map it before you build momentum elsewhere.' },
        { q: '"What if gas prices spike?" — the strongest reframe now that you know the math?', opts: ['"Gas will not spike"', '"Our efficiency edge widens as gas rises — the efficient asset is the hedge — and a PPA transfers the risk to us entirely"', '"Switch to diesel"', '"That is not our problem"'], a: 1, e: 'Two moves: efficiency is the hedge (the spread scales with gas price), and the structure reallocates the risk. Then the calibrated question about an all-in $/MWh.' },
        { q: 'Hyperscaler, phased 200 MW, multi-year queue, 24/7 carbon-free mandate. Lead levers in order?', opts: ['Cost, then ESG', 'Speed, then ESG, then reliability', 'ESG only', 'Reliability, then cost'], a: 1, e: 'Speed is the binding constraint, ESG is the gate that rules out combustion, reliability backs it up. Cost leads last — they will pay for power that actually arrives.' },
        { q: 'Customer says a competitor quoted a lower $/kW. Best move?', opts: ['Match the price', 'Concede capex, then pivot to permitting, zero planned outages, and 20-year TCO including their maintenance windows', 'Walk away', 'Attack the competitor'], a: 1, e: 'Concede the line they genuinely win, then move to the bundle they cannot match. Capex is one line item; the deal is the whole cost stack over the term.' },
        { q: 'Every gameplan ends with…', opts: ['A spec sheet', 'A mutual next step with a named owner and a date', 'A price cut', 'A second quote'], a: 1, e: 'Never leave a meeting with only one undefined next step. Name the move, the owner, and the date.' },
      ],
    },
  ],

  // ── FIELD MODE ────────────────────────────────────────────────────────────
  // One-thumb, 60-second pre-call cram. Built for the truck outside the plant.
  field: [
    {
      id: 'f-grid',
      label: 'They want to wait for the grid',
      sub: 'The default competitor',
      open: 'Before we talk equipment — what is your current interconnection queue position, and what does a month of delayed production cost you?',
      kill: 'The queue is years, not months. Uri happened. Give the status quo a price tag: $/month of delay × months in queue.',
      objections: [
        { q: '"The grid is cheaper."', a: 'Cheaper per kWh on the energy line. Ask for twelve months of billing detail — demand charges and 4CP transmission are where the real money sits, and BTM cuts all three.' },
        { q: '"We can wait."', a: 'What is the production value of the load you cannot serve while you wait? That number is usually larger than the entire project.' },
        { q: '"Uri was a one-off."', a: 'Maybe. What is your plan if it is not? You do not carry insurance because you expect a fire.' },
      ],
      ask: 'What would your team need to see to justify a feasibility study while you stay in the queue?',
    },
    {
      id: 'f-recip',
      label: 'They are leaning recip or turbine',
      sub: 'Combustion incumbent',
      open: 'What does your NSR permitting timeline look like for a combustion unit in this zone?',
      kill: 'In non-attainment, combustion cannot permit without NSR, BACT, and NOx offsets. That is 18–36 months and an uncertain outcome. Zero NOx is a different category, not a better score.',
      objections: [
        { q: '"They quoted lower $/kW."', a: 'Concede it — they do win on upfront capex. Then pivot: permitting timeline, zero planned outages, and 20-year TCO including their maintenance windows.' },
        { q: '"We trust our OEM."', a: 'That trust is earned and it is real. It is also irrelevant to whether the agency issues the permit.' },
        { q: '"They do load following better."', a: 'True, and that is a peaking virtue. Your plant runs flat 24/7 — you are buying a feature you will never use.' },
      ],
      ask: 'What would your HSE and reliability leads need to see to support a feasibility study?',
    },
    {
      id: 'f-steam',
      label: 'They have a big steam load',
      sub: 'The silent deal-killer',
      open: 'Walk me through your process steam demand — grade, volume, and how it is served today.',
      kill: 'Do not fight this one. CHP value is genuinely real. Concede it fully, then bring the answer. If the CHP confirm is still open, say you will come back with engineering rather than improvise.',
      objections: [
        { q: '"CCGT gives us steam and power."', a: 'It does. And it triggers NSR at a scale that makes the NOx problem bigger, not smaller. The question is whether the steam value survives an 18–36 month permitting risk.' },
        { q: '"You cannot serve our steam."', a: 'Let me get you a straight engineering answer rather than a sales answer. What grade and what volume?' },
      ],
      ask: 'Can I bring engineering back with a specific answer on your steam requirement?',
    },
    {
      id: 'f-economics',
      label: 'The CFO is in the room',
      sub: 'Money conversation',
      open: 'Can we work from twelve months of billing detail rather than a blended rate? The blended number hides where the savings actually are.',
      kill: 'Three numbers, always together: delta $/MWh · annual dollars saved · cost of waiting. Never the rate alone.',
      objections: [
        { q: '"What if gas spikes?"', a: 'Our efficiency edge widens as gas rises — the spread roughly doubles from $3.50 to $7.00 gas. Efficiency is the hedge, not the exposure. And a PPA moves the risk to us entirely.' },
        { q: '"What tax credits apply?"', a: 'There is a meaningful incentive layer here and the rules moved in 2025. I will get you our tax counsel\'s read rather than guess.' },
        { q: '"Solar quoted a similar $/kW."', a: 'Nameplate is the wrong denominator. At 95% versus 20% capacity factor we deliver about 4.75× the energy per nameplate MW. Compare capex per delivered MWh.' },
      ],
      ask: 'If we brought an all-in $/MWh with the fuel risk on our side of the line, does that change the evaluation?',
    },
    {
      id: 'f-defense',
      label: 'Defense or critical mission',
      sub: 'Security and supply chain',
      open: 'You do not sole-source steel, chips, or capital. Why sole-source electricity — your highest-operational-risk input?',
      kill: 'Second source, not a switch. Then stack the domestic supply-chain angle: no rare-earth dependency, no China exposure.',
      objections: [
        { q: '"We have backup generators."', a: 'For how long, on what fuel supply, and tested under what conditions? Backup is a bridge. This is a source.' },
        { q: '"Security review will take forever."', a: 'Which is exactly why I want to map it in this meeting rather than discover it in month four. Who owns that gate?' },
      ],
      ask: 'Who needs to be in the room from security and program before we go further?',
    },
    {
      id: 'f-unproven',
      label: 'They think it is unproven',
      sub: 'Career-risk objection',
      open: 'Fair concern. What would proof look like to you — fleet hours, reference sites, or a contractual guarantee?',
      kill: 'This is a career-risk objection wearing a technical costume. Answer the fear, not the words: references, guarantees with LDs, and insurer acceptance.',
      objections: [
        { q: '"Nobody at our scale has done this."', a: 'Let me get you the fleet data and reference sites rather than characterize it. What scale and what industry would be most credible to your team?' },
        { q: '"What about stack degradation?"', a: 'It is predictable and budgetable, the same way a turbine overhaul is. Show it in the 20-year TCO instead of leaving it as an unknown.' },
      ],
      ask: 'Who at your company would need to be convinced, and what would convince them specifically?',
    },
  ],
};
