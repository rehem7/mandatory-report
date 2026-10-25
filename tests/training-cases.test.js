import test from 'node:test';
import assert from 'node:assert/strict';
import { cases, publicCases, gradeTraining } from '../content.js';

test('新增家庭冲突、网暴、多重风险及沉默场景保持评分与答案隔离', () => {
  const ids = ['child-witness', 'young-creator', 'overlapping-risks', 'quiet-student'];
  const visible = publicCases();
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length);
  for (const id of ids) {
    const c = cases.find(item => item.id === id); assert.ok(c);
    const publicCase = visible.find(item => item.id === id);
    for (const secret of ['facts', 'expectedRisk', 'expectedCommunication', 'expectedEvidence', 'decision', 'rationale']) assert.ok(!(secret in publicCase));
    const result = gradeTraining(c, { risk: c.expectedRisk, communication: c.expectedCommunication, evidence: c.expectedEvidence, safety: '安排可靠成年人在安全地点陪伴，避免再次接触危险', reason: '已经出现具体疑似侵害与近期危险，需及时报告并进一步核实', decision: 'report', preserveOriginal: true, protectPrivacy: true, report: { location: c.location, type: c.type, description: '依据本次虚构场景客观记录已有观察、时间、陈述与当前安全情况', confirmFictional: true } }, [{ role: 'user', content: '你愿意告诉我现在是否安全吗？' }]);
    assert.equal(result.total, 100); assert.ok(result.items.every(item => item.score <= 20));
  }
  assert.equal(cases.find(c => c.id === 'overlapping-risks').difficulty, '高阶');
  assert.match(cases.find(c => c.id === 'quiet-student').facts, /允许暂不回答/);
});
