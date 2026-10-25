import test from 'node:test';
import assert from 'node:assert/strict';
import { materials } from '../content.js';
import { lessonMetadata, lessonState, completeReading, assessLesson } from '../learning.js';
const actor = { ownerId: 'a', profile: { id: 'a-profile' } }, other = { ownerId: 'b', profile: { id: 'b-profile' } };
const teacher = materials.find(m => m.id === 'teacher-duty');
const answers = { 'report-duty': [1, 0, 2], 'evidence-privacy': [1, 2, 0], 'teacher-duty': [0, 1, 1], 'doctor-duty': [2, 0, 2], 'community-duty': [1, 2, 0] };

test('学习不再要求计时或确认阅读，直接提交同主题练习即可评分', () => {
  const db = { learning: [] };
  for (const material of materials) {
    const metadata = lessonMetadata(material);
    assert.equal(metadata.quiz.length, 3);
    assert.ok(!('minReadSeconds' in metadata));
    assert.ok(metadata.quiz.every(q => q.options.length === 3 && !('correct' in q) && !('explanation' in q)));
    const record = assessLesson(db, actor, material, answers[material.id]);
    assert.equal(record.lastQuiz.score, 100);
    assert.equal(record.lastQuiz.items.length, metadata.quiz.length);
    assert.deepEqual(record.lastQuiz.items.map(item => item.question), metadata.quiz.map(q => q.question));
    assert.ok(record.lastQuiz.items.every(item => item.correct && item.explanation));
    assert.ok(record.masteredAt);
  }
  assert.equal(db.learning.length, materials.length);
});

test('成绩、逐题解析、重试与最高分独立保存，错误练习不会清除已有掌握状态', () => {
  const db = { learning: [] };
  const failed = assessLesson(db, actor, teacher, [1, 0, 0]);
  assert.equal(failed.lastQuiz.score, 0); assert.equal(failed.masteredAt, null);
  assert.ok(failed.lastQuiz.items.every(item => !item.correct && item.selected && item.correctAnswer && item.explanation));
  const partial = assessLesson(db, actor, teacher, [0, 1, 0]); assert.equal(partial.lastQuiz.score, 67);
  const passed = assessLesson(db, actor, teacher, answers[teacher.id]);
  assert.equal(passed.bestScore, 100); assert.ok(passed.masteredAt); assert.equal(passed.attempts, 3);
  const retry = assessLesson(db, actor, teacher, [1, 0, 0]);
  assert.equal(retry.lastQuiz.score, 0); assert.equal(retry.bestScore, 100); assert.ok(retry.masteredAt);
  assert.equal(db.learning.length, 1);
});

test('不完整或无效答案不能创建学习记录', () => {
  const db = { learning: [] };
  for (const value of [undefined, [], [0, 1], [0, 1, 99], [0, 1, null], [0, 1, 1.5]]) {
    assert.throws(() => assessLesson(db, actor, teacher, value), /全部情境题/);
    assert.equal(db.learning.length, 0);
  }
});

test('同主题成绩按账号隔离，旧阅读记录可以直接补做练习', () => {
  const db = { learning: [] };
  const legacy = completeReading(db, actor, teacher); assert.equal(legacy.attempts, 0);
  assert.equal(completeReading(db, actor, teacher).id, legacy.id);
  assert.equal(lessonState(db, other.ownerId, teacher).record, null);
  assessLesson(db, actor, teacher, answers[teacher.id]);
  const second = assessLesson(db, other, teacher, [1, 0, 0]);
  assert.equal(second.lastQuiz.score, 0);
  assert.equal(lessonState(db, actor.ownerId, teacher).record.lastQuiz.score, 100);
  assert.notEqual(second.id, legacy.id); assert.equal(db.learning.length, 2);
  assert.ok(lessonMetadata(teacher).relatedCaseIds.includes('school-injury'));
});
