import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/calc.js';
import { generateAdvice, healthScore } from '../src/advice.js';
import { PERSONAS } from './fixtures/personas.js';

for (const persona of PERSONAS) {
  test(`評測：${persona.name}`, () => {
    const advice = generateAdvice(analyze(persona.data));
    const ids = advice.map((a) => a.id);

    for (const id of persona.mustInclude) assert.ok(ids.includes(id), `缺少建議 ${id}；實際：${ids.join(', ')}`);
    for (const id of persona.mustExclude) assert.ok(!ids.includes(id), `不應出現建議 ${id}`);
    if (persona.exactCount !== undefined) assert.equal(ids.length, persona.exactCount, `實際：${ids.join(', ')}`);
    if (persona.score) {
      const { score } = healthScore(advice);
      const [min, max] = persona.score;
      assert.ok(score >= min && score <= max, `分數 ${score} 不在 ${min}–${max}`);
    }
  });
}
