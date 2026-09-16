/* Validates every call script without launching the game.
   Checks the dialogue graph (missing gotos, unreachable nodes, stalls) and
   every effect op against the resolver's actual op list. */
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const load = async (p) => (await import(pathToFileURL(resolve(p)).href));

const { CALLS } = await load('src/data/calls/index.js');
const { validateCall } = await load('src/game/dialogue.js');
const { OP_NAMES } = await load('src/game/effects.js');
const { HORROR_NAMES } = await load('src/game/horror.js');

let problems = [];
const ids = new Set();

for (const call of CALLS) {
  problems.push(...validateCall(call));
  if (ids.has(call.id)) problems.push(`duplicate call id "${call.id}"`);
  ids.add(call.id);

  // walk every effects array in the script and check the ops exist
  const check = (list, where) => {
    for (const op of list || []) {
      if (!op || !op.op) { problems.push(`${call.id}: ${where}: effect with no op`); continue; }
      if (!OP_NAMES.includes(op.op)) problems.push(`${call.id}: ${where}: unknown op "${op.op}"`);
      if (op.op === 'horror' && !HORROR_NAMES.includes(op.event)) {
        problems.push(`${call.id}: ${where}: unknown horror event "${op.event}"`);
      }
      if (op.op === 'schedule' && !CALLS.some((c) => c.id === op.call)) {
        problems.push(`${call.id}: ${where}: schedules unknown call "${op.call}"`);
      }
    }
  };
  for (const [nid, node] of Object.entries(call.nodes)) {
    check(node.effects, `node ${nid}`);
    for (const [i, c] of (node.choices || []).entries()) check(c.effects, `node ${nid} choice ${i}`);
    for (const [i, l] of (node.lines || []).entries()) if (l && l.effects) check(l.effects, `node ${nid} line ${i}`);
  }
}

/* Reachability across the whole shift: every call must be reachable by a
   beat, a time, the random pool, or by another call scheduling it. */
const scheduledBy = new Set();
for (const call of CALLS) {
  for (const node of Object.values(call.nodes)) {
    const all = [node.effects, ...(node.choices || []).map((c) => c.effects)].flat().filter(Boolean);
    for (const op of all) if (op.op === 'schedule') scheduledBy.add(op.call);
  }
}
/* Calls that GAME CODE fires rather than another script: the 0417
   fragments, the day shift, the last call. They are marked `type: 'called'`
   and the one thing worth checking about them is that something in src/
   actually names them. */
const src = [
  'src/game/game.js', 'src/data/sequences/index.js',
].map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');

for (const call of CALLS) {
  const t = (call.schedule || {}).type;
  if (t === 'queued' && !scheduledBy.has(call.id)) {
    problems.push(`${call.id}: schedule.type is "queued" but no call ever schedules it`);
  }
  if (t === 'called' && !src.includes(`'${call.id}'`) && !scheduledBy.has(call.id)) {
    problems.push(`${call.id}: schedule.type is "called" but nothing in src/ fires it`);
  }
  if (!t) problems.push(`${call.id}: no schedule block`);
}

const nodes = CALLS.reduce((n, c) => n + Object.keys(c.nodes).length, 0);
const lines = CALLS.reduce((n, c) => n + Object.values(c.nodes).reduce((m, x) => m + (x.lines || []).length, 0), 0);
const choices = CALLS.reduce((n, c) => n + Object.values(c.nodes).reduce((m, x) => m + (x.choices || []).length, 0), 0);

console.log(`calls:   ${CALLS.length}`);
console.log(`nodes:   ${nodes}`);
console.log(`lines:   ${lines}`);
console.log(`choices: ${choices}`);
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
console.log('\nall call scripts valid');
