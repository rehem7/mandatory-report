import crypto from 'node:crypto';
export const MIN_READ_SECONDS = 30;
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const common = { question: '【虚构情境】你发现了疑似侵害线索，但尚未收集齐全部证据，应如何做？', options: ['先自行调查，证据齐全再报告', '如实记录已有线索与不确定信息，及时报告并保护安全', '先在群里公开征集证人'], correct: 1, explanation: '练习要点是及时报告已有疑似线索，同时保护安全；不要等待自行调查完成，也不要公开传播身份信息。' };
const quizzes = {
  'report-duty': [common, { question: '【虚构情境】教师已经向校内负责人汇报，是否可以因此一直推迟对外报告？', options: ['不可以，内部汇报不能成为延迟报告的理由', '可以，内部说过即可', '只要孩子愿意回家就不必关注'], correct: 0, explanation: '内部流转与履行报告职责要衔接，不能用内部汇报替代或延迟应履行的报告。' }],
  'evidence-privacy': [{ question: '【虚构情境】孩子给你看了威胁聊天记录，哪种留存方式更适当？', options: ['裁剪改写后发到公开群聊', '妥善保留已有原始记录及时间，通过必要渠道提供', '让孩子反复复述并拍视频公开'], correct: 1, explanation: '保留已有原始材料和时间，减少反复问询与二次传播。' }, { question: '孩子说“别告诉任何人”，更适当的回应是？', options: ['保证无论发生什么都绝对保密', '直接要求承认遭受侵害', '温和说明会尽力保护隐私，并联系必要的保护力量'], correct: 2, explanation: '说明隐私保护和必要报告边界，不承诺绝对保密，不诱导回答。' }],
  'teacher-duty': [{ question: '【虚构情境】学生反复出现淤青且害怕离校，教师首先应关注什么？', options: ['当前安全与可靠陪伴，同时记录和及时报告线索', '让学生独自回家找家长证明', '先在班群公开照片'], correct: 0, explanation: '先落实眼前安全和陪伴，再如实记录、及时履行报告职责，避免扩散隐私。' }, { question: '哪一句更适合开启沟通？', options: ['是不是你父亲打的？你必须承认', '你愿意说说现在是否安全、有什么担心吗？', '不说清楚就不帮助你'], correct: 1, explanation: '采用开放、温和的问题，允许暂不回答，避免诱导和逼问。' }],
  'doctor-duty': [{ question: '【虚构情境】接诊时发现疑似侵害线索，应如何兼顾工作？', options: ['先停止救治等待调查', '不作记录，避免麻烦', '必要救治、客观记录、隐私保护和及时报告并行'], correct: 2, explanation: '救治与报告并行，不由医护自行作犯罪终审认定。' }, { question: '陪同人不愿配合时，是否就停止关注和报告？', options: ['否，应优先考虑未成年人安全并请求有关部门协助', '是，陪同人说了算', '将全部病历发到网络求助'], correct: 0, explanation: '不能仅因陪同人抵触就忽视风险；按职责保护患者、记录并请求协助。' }],
  'community-duty': [{ question: '【虚构情境】孩子长时间独自在家、缺少食物，应优先核实什么？', options: ['家庭收入排名', '当前安全、基本照料和可靠照护人', '把邻居的猜测当成结论'], correct: 1, explanation: '关注具体安全与照料事实，将困难与侵害定性分开，并对疑似侵害或危险及时报告。' }, common]
};
const related = { 'report-duty': ['school-injury', 'community-care'], 'evidence-privacy': ['online-threat', 'young-creator'], 'teacher-duty': ['school-injury', 'quiet-student'], 'doctor-duty': ['clinic-safety'], 'community-duty': ['community-care', 'child-witness'] };
export function lessonMetadata(material) { return { ...material, minReadSeconds: MIN_READ_SECONDS, relatedCaseIds: related[material.id] || [], quiz: quizzes[material.id].map(({ correct, explanation, ...q }, index) => ({ ...q, id: String(index) })) }; }
export function lessonState(db, ownerId, material) {
  const p = (db.learningProgress || []).find(p => p.ownerId === ownerId && p.materialId === material.id);
  const record = (db.learning || []).find(r => r.ownerId === ownerId && r.materialId === material.id);
  return { materialId: material.id, readSeconds: p?.readSeconds || 0, reachedEnd: !!p?.reachedEnd, ready: !!record || (p?.readSeconds >= MIN_READ_SECONDS && p?.reachedEnd), active: !!p?.active, record: record || null };
}
export function readingPulse(db, actor, material, input, stamp = Date.now()) {
  if (!['start', 'pulse', 'pause'].includes(input.action)) fail('阅读进度操作无效');
  db.learningProgress ||= [];
  let progress = db.learningProgress.find(p => p.ownerId === actor.ownerId && p.materialId === material.id);
  if (!progress) { progress = { ownerId: actor.ownerId, materialId: material.id, readSeconds: 0, reachedEnd: false, active: false, lastPulse: stamp }; db.learningProgress.push(progress); }
  // Only server elapsed time is counted; a long background gap adds at most one pulse.
  if (progress.active && input.action !== 'start') progress.readSeconds = Math.min(MIN_READ_SECONDS, progress.readSeconds + Math.max(0, Math.min(6, (stamp - progress.lastPulse) / 1000)));
  if (input.action === 'start') for (const p of db.learningProgress.filter(p => p.ownerId === actor.ownerId)) p.active = false;
  if (input.atEnd === true && (progress.active || input.action === 'start')) progress.reachedEnd = true;
  progress.active = input.action === 'start' ? input.active === true : progress.active && input.action !== 'pause' && input.active === true;
  progress.lastPulse = stamp;
  return lessonState(db, actor.ownerId, material);
}
export function completeReading(db, actor, material, stamp = Date.now()) {
  const state = lessonState(db, actor.ownerId, material);
  if (!state.ready) fail(`请先有效阅读至少${MIN_READ_SECONDS}秒，并浏览到本节内容末尾`, 409);
  if (state.record) return state.record;
  const record = { id: crypto.randomUUID(), ownerId: actor.ownerId, learnerId: actor.profile.id, materialId: material.id, title: material.title, completedAt: new Date(stamp).toISOString(), readSeconds: Math.floor(state.readSeconds), masteredAt: null, bestScore: null, attempts: 0 };
  db.learning.push(record); return record;
}
export function assessLesson(db, actor, material, answers, stamp = Date.now()) {
  const record = lessonState(db, actor.ownerId, material).record;
  if (!record) fail('请先完成阅读，再进行知识检验', 409);
  const qs = quizzes[material.id];
  if (!Array.isArray(answers) || answers.length !== qs.length || answers.some((answer, i) => !Number.isInteger(answer) || answer < 0 || answer >= qs[i].options.length)) fail('请完成本节全部情境题');
  const items = qs.map((q, i) => ({ question: q.question, selected: q.options[answers[i]], correctAnswer: q.options[q.correct], correct: answers[i] === q.correct, explanation: q.explanation }));
  const score = Math.round(items.filter(i => i.correct).length / qs.length * 100), passed = score === 100;
  record.attempts = (record.attempts || 0) + 1; record.bestScore = Math.max(record.bestScore || 0, score);
  record.lastQuiz = { score, passed, items, completedAt: new Date(stamp).toISOString() };
  if (passed) record.masteredAt ||= record.lastQuiz.completedAt;
  return record;
}
