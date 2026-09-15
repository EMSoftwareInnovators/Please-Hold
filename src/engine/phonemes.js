/* ============================================================
   phonemes.js -- turn a written line into something a throat
   could plausibly have done.

   The old synthesizer cycled six vowel colours in step with a
   syllable count. That produces a sequence of tuned bursts: it
   has the right RHYTHM and none of the right TEXTURE, which is
   why it read as beeps rather than as a person.

   What was missing was not better filters. It was consonants,
   and transitions between them. Speech is mostly the MOVEMENT
   between targets -- the ear identifies a voice from the way its
   formants slide, and from the hiss and the silences that
   interrupt the voicing. A vowel held still is a synthesizer. A
   vowel that arrives from an /s/ and leaves into an /m/ is a
   mouth.

   So this maps English spelling onto a rough phoneme string and
   hands back timed segments. It is not a pronunciation
   dictionary and is not trying to be: nothing in this game is
   ever meant to be intelligible -- every voice arrives through a
   300-3400Hz telephone band, muffled on purpose. It only has to
   be WRONG IN THE WAY A REAL VOICE IS WRONG through a handset.

   Add a character's accent by scaling `formant` in their voice
   profile; add a new sound by adding it to SOUNDS.
   ============================================================ */

/**
 * Every sound this knows about.
 *
 *   f      formant targets [F1, F2, F3] in Hz, for a neutral adult tract
 *   kind   voiced | fric | stop | nasal | liquid
 *   dur    nominal duration in seconds, before the speaker's rate
 *   amp    relative loudness
 *   noise  [centre Hz, Q] for the turbulent part, if any
 */
export const SOUNDS = {
  /* ---- vowels ---- */
  iy: { f: [270, 2290, 3010], kind: 'voiced', dur: 0.135, amp: 1.00 },
  ih: { f: [390, 1990, 2550], kind: 'voiced', dur: 0.105, amp: 0.95 },
  eh: { f: [530, 1840, 2480], kind: 'voiced', dur: 0.115, amp: 1.00 },
  ae: { f: [660, 1720, 2410], kind: 'voiced', dur: 0.140, amp: 1.05 },
  aa: { f: [730, 1090, 2440], kind: 'voiced', dur: 0.145, amp: 1.10 },
  ao: { f: [570, 840, 2410],  kind: 'voiced', dur: 0.135, amp: 1.05 },
  uh: { f: [520, 1190, 2390], kind: 'voiced', dur: 0.095, amp: 0.90 },
  uw: { f: [300, 870, 2240],  kind: 'voiced', dur: 0.130, amp: 0.95 },
  er: { f: [490, 1350, 1690], kind: 'voiced', dur: 0.130, amp: 0.95 },
  ow: { f: [500, 1000, 2400], kind: 'voiced', dur: 0.150, amp: 1.05 },
  ay: { f: [700, 1400, 2500], kind: 'voiced', dur: 0.160, amp: 1.05 },

  /* ---- nasals: voiced, but the mouth is shut, so quiet and dark ---- */
  m:  { f: [280, 1100, 2400], kind: 'nasal', dur: 0.080, amp: 0.55 },
  n:  { f: [280, 1700, 2600], kind: 'nasal', dur: 0.075, amp: 0.55 },
  ng: { f: [280, 2000, 2800], kind: 'nasal', dur: 0.085, amp: 0.50 },

  /* ---- liquids and glides: vowel-like, and they SLIDE ---- */
  l:  { f: [360, 1100, 2600], kind: 'liquid', dur: 0.075, amp: 0.80 },
  r:  { f: [420, 1300, 1600], kind: 'liquid', dur: 0.080, amp: 0.80 },
  w:  { f: [300, 610, 2200],  kind: 'liquid', dur: 0.065, amp: 0.75 },
  y:  { f: [270, 2290, 3010], kind: 'liquid', dur: 0.060, amp: 0.75 },

  /* ---- fricatives: turbulence, with or without voicing under it ---- */
  s:  { f: [500, 1500, 2500], kind: 'fric', dur: 0.105, amp: 0.55, noise: [5200, 2.6] },
  z:  { f: [400, 1400, 2400], kind: 'fric', dur: 0.090, amp: 0.55, noise: [4600, 2.4], voiced: true },
  sh: { f: [500, 1800, 2500], kind: 'fric', dur: 0.115, amp: 0.60, noise: [2600, 1.6] },
  f:  { f: [400, 1400, 2400], kind: 'fric', dur: 0.095, amp: 0.38, noise: [3800, 0.9] },
  v:  { f: [400, 1400, 2400], kind: 'fric', dur: 0.080, amp: 0.40, noise: [3400, 0.9], voiced: true },
  th: { f: [400, 1600, 2500], kind: 'fric', dur: 0.085, amp: 0.34, noise: [4400, 0.8], voiced: true },
  h:  { f: [500, 1500, 2500], kind: 'fric', dur: 0.070, amp: 0.30, noise: [1400, 0.5] },

  /* ---- stops: a closure, then a burst. The SILENCE is the consonant. ---- */
  p:  { f: [400, 1100, 2300], kind: 'stop', dur: 0.070, amp: 0.55, noise: [900, 1.2] },
  b:  { f: [350, 1100, 2300], kind: 'stop', dur: 0.060, amp: 0.50, noise: [700, 1.2], voiced: true },
  t:  { f: [400, 1800, 2600], kind: 'stop', dur: 0.070, amp: 0.60, noise: [3600, 1.6] },
  d:  { f: [350, 1700, 2600], kind: 'stop', dur: 0.058, amp: 0.55, noise: [3000, 1.6], voiced: true },
  k:  { f: [400, 1600, 2400], kind: 'stop', dur: 0.075, amp: 0.60, noise: [1900, 1.1] },
  g:  { f: [350, 1600, 2400], kind: 'stop', dur: 0.062, amp: 0.55, noise: [1500, 1.1], voiced: true },
  ch: { f: [450, 1900, 2600], kind: 'stop', dur: 0.100, amp: 0.60, noise: [2800, 1.8] },
  j:  { f: [400, 1800, 2600], kind: 'stop', dur: 0.090, amp: 0.55, noise: [2400, 1.8], voiced: true },
};

/** Two- and three-letter spellings, tried before single letters. */
const DIGRAPHS = [
  ['igh', ['ay']], ['tch', ['ch']], ['sch', ['s', 'k']],
  ['th', ['th']], ['sh', ['sh']], ['ch', ['ch']], ['ph', ['f']], ['wh', ['w']],
  ['ck', ['k']], ['ng', ['ng']], ['qu', ['k', 'w']], ['gh', []],
  ['ee', ['iy']], ['ea', ['iy']], ['oo', ['uw']], ['ou', ['ow']], ['ow', ['ow']],
  ['oa', ['ow']], ['ai', ['ay']], ['ay', ['ay']], ['oi', ['ao', 'iy']], ['oy', ['ao', 'iy']],
  ['au', ['ao']], ['aw', ['ao']], ['ey', ['ay']], ['ie', ['iy']],
  ['ar', ['aa', 'r']], ['or', ['ao', 'r']], ['er', ['er']], ['ir', ['er']], ['ur', ['er']],
];

const SINGLE = {
  a: 'ae', e: 'eh', i: 'ih', o: 'aa', u: 'uh',
  b: 'b', c: 'k', d: 'd', f: 'f', g: 'g', h: 'h', j: 'j', k: 'k', l: 'l',
  m: 'm', n: 'n', p: 'p', q: 'k', r: 'r', s: 's', t: 't', v: 'v', w: 'w',
  x: 'k', y: 'iy', z: 'z',
};

/** Words that are never stressed, so a sentence has a shape. */
const WEAK = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'is', 'it',
  'and', 'or', 'but', 'for', 'was', 'are', 'be', 'i', 'you', 'that', 'this']);

/** Spelling -> a rough phoneme string. Not a dictionary, and not trying. */
export function wordToPhones(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return [];
  const out = [];
  let i = 0;
  while (i < w.length) {
    // A final silent 'e' lengthens rather than sounds.
    if (w[i] === 'e' && i === w.length - 1 && w.length > 2 && out.length) { i++; continue; }
    let hit = null;
    for (const [seq, phones] of DIGRAPHS) {
      if (w.startsWith(seq, i)) { hit = [seq.length, phones]; break; }
    }
    if (hit) {
      out.push(...hit[1]);
      i += hit[0];
      continue;
    }
    // A doubled consonant is one sound.
    if (w[i] === w[i + 1] && !'aeiou'.includes(w[i])) { i++; continue; }
    const p = SINGLE[w[i]];
    if (p) out.push(p);
    i++;
  }
  return out.filter((p) => SOUNDS[p]);
}

/**
 * A whole line, as timed segments.
 *
 * Returns `{ segments, duration }` where each segment is
 * `{ sound, dur, stress, pitch }` -- `sound` null meaning silence.
 * `pitch` is a multiplier on the speaker's base, carrying the phrase's
 * declination, its stresses, and the rise at a question mark.
 */
export function lineToSegments(text, { rate = 1, pause = 1 } = {}) {
  const raw = String(text || '');
  const isQuestion = /\?\s*$/.test(raw);
  const tokens = raw.split(/\s+/).filter(Boolean);
  const segments = [];

  // Where each word sits in the sentence, for the falling contour.
  const total = Math.max(1, tokens.length);
  tokens.forEach((token, wi) => {
    const bare = token.replace(/[^A-Za-z']/g, '');
    const phones = wordToPhones(bare);
    const weak = WEAK.has(bare.toLowerCase()) || phones.length <= 1;
    const frac = wi / total;

    // Declination: a sentence starts high and runs downhill. A question
    // turns that around over its last quarter.
    let contour = 1.10 - frac * 0.26;
    if (isQuestion && frac > 0.72) contour = 0.95 + (frac - 0.72) * 1.4;

    let stressed = false;
    phones.forEach((p) => {
      const s = SOUNDS[p];
      // First full vowel of a content word takes the stress.
      const isVowel = s.kind === 'voiced';
      const stress = !weak && isVowel && !stressed;
      if (stress) stressed = true;
      segments.push({
        sound: p,
        dur: s.dur * (stress ? 1.22 : 1) * (weak ? 0.82 : 1) / rate,
        stress,
        pitch: contour * (stress ? 1.06 : 1),
      });
    });

    // Punctuation is breathing. It is most of what makes a line scan as a
    // sentence rather than as a list of words.
    const tail = token.slice(bare.length ? token.indexOf(bare) + bare.length : 0);
    let gap = 0.045;
    if (/[,;:]/.test(tail)) gap = 0.17;
    if (/[.!?]/.test(tail)) gap = 0.26;
    if (/[—–-]$/.test(token)) gap = 0.20;
    if (/\.\.\./.test(tail)) gap = 0.42;
    if (wi < tokens.length - 1 || gap > 0.1) {
      segments.push({ sound: null, dur: gap * pause / rate, stress: false, pitch: contour });
    }
  });

  const duration = segments.reduce((a, s) => a + s.dur, 0);
  return { segments, duration, isQuestion };
}
