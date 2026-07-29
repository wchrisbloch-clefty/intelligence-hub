/**
 * LADDER REGISTRY
 *
 * Adding a new ladder = add the content-pack file, add one import, add one
 * array entry. No component changes, ever. Same rule as the vertical configs.
 *
 * Planned next packs (per CB's open gaps):
 *   negotiation.js   — Never Split the Difference + Influence, drilled
 *   real-estate.js   — investment criteria, underwriting, first-deal readiness
 *   longevity.js     — Attia / Huberman protocols, once HRV baseline exists
 */

import sofcPowerdeal from './sofc-powerdeal.js';

export const LADDERS = [sofcPowerdeal];

export const getLadder = (id) => LADDERS.find((l) => l.id === id) || null;

export default LADDERS;
