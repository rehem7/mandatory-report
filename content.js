export const models = [
  { id: "[故人情]gemini-3.8-flash", name: "Gemini 3.8 Flash", default: true },
  { id: "[故人情]gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "[故人情]gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" }
];
export const profiles = [
  { id: "public", name: "普通公众", role: "公众", unitId: null, unit: "个人体验" },
  { id: "teacher-1", name: "林老师（虚构）", role: "教师", unitId: "school", unit: "青禾学校（演示）" },
  { id: "teacher-2", name: "许老师（虚构）", role: "教师", unitId: "school", unit: "青禾学校（演示）" },
  { id: "doctor-1", name: "周医生（虚构）", role: "医护", unitId: "hospital", unit: "青禾医院（演示）" },
  { id: "community-1", name: "陈社工（虚构）", role: "社区/村居", unitId: "community", unit: "青禾社区（演示）" }
];
export const units = [
  { id: "school", name: "青禾学校（演示）" },
  { id: "hospital", name: "青禾医院（演示）" },
  { id: "community", name: "青禾社区（演示）" }
];
export const sources = [
  { title: "未成年人保护法 · 第十一条", url: "https://www.yantian.gov.cn/YTQSF/gkmlpt/content/12/12011/mpost_12011375.html" },
  { title: "最高检等九部门 · 强制报告制度意见（试行）", url: "https://www.spp.gov.cn/spp/xwfbh/wsfbt/202005/t20200529_463482.shtml" }
];
export const legalContext = "未成年人保护法第十一条：任何组织或个人发现侵害未成年人身心健康的情形，有权劝阻、制止或向有关部门检举、控告。国家机关、居民委员会、村民委员会、密切接触未成年人的单位及其工作人员，在工作中发现未成年人身心健康受到侵害、疑似受到侵害或者面临其他危险情形，应立即向公安、民政、教育等有关部门报告。九部门强制报告意见（试行）规定相关义务主体在工作中发现未成年人遭受或疑似遭受不法侵害、面临不法侵害危险，应立即向公安机关报案或举报。报告无需等待自行调查证据充分；避免诱导或反复问询，保护未成年人和报告人隐私。项目24小时是演示处置时限，不是上述法条规定的统一法定期限。";
const shared = {
  evidenceOptions: ["记录发现时间、地点和原话", "妥善保留已有原始材料", "在班级群公开孩子的照片", "要求孩子反复复述细节"],
  communicationOptions: ["先说明会帮助其获得保护", "用开放问题了解当前安全", "承诺无论发生什么都绝不报告", "用带答案的问题逼其确认"],
  expectedEvidence: [0, 1], expectedCommunication: [0, 1], decision: "report"
};
export const cases = [
  { ...shared, id: "school-injury", title: "不愿回家的学生", role: "教师", character: "疑似受侵害未成年人", difficulty: "入门", type: "身体虐待", age: "7-13岁", location: "虚构学校辅导室", summary: "学生两天出现不同部位的淤青，放学时迟迟不愿离校。你是负责陪伴的教师。", opening: "老师，我能晚一点再走吗？我不想回家……", facts: "你扮演12岁的虚构学生小禾。监护人昨日用手打你，手臂有淤青；目前在学校安全区域。害怕回家后再被打，担心说出来会惹麻烦。只在被温和开放地问到时逐步透露，不增加性侵或严重伤害细节。", riskOptions: ["反复出现伤痕", "对回家表现恐惧", "仅凭成绩下降断定侵害"], expectedRisk: [0, 1], rationale: "伤痕和害怕回家的陈述构成疑似侵害信号；先保护安全并立即报告，不等待教师自行查明全部经过。" },
  { ...shared, id: "clinic-safety", title: "诊室里的求助", role: "医护", character: "疑似受侵害未成年人", difficulty: "进阶", type: "疑似性侵害", age: "14-17岁", location: "虚构医院诊室", summary: "未成年患者表示曾遭成年人不当接触，希望单独和医护说话。陪同人急于带其离开。", opening: "我想单独跟你说几句话，可以吗？我有点害怕陪我来的人。", facts: "你扮演15岁虚构患者小舟。曾遭成年熟人不当触碰，不提供露骨细节；害怕陪同人责怪。当前位于诊室，愿意接受帮助但担心隐私。以简短、不含图像的回应表达担忧；不主动编造检查结论。", riskOptions: ["未成年人表达不当接触经历", "陪同人试图阻止单独沟通", "没有伤口就排除侵害"], expectedRisk: [0, 1], rationale: "已出现疑似性侵害线索，应兼顾医疗救治、当前安全、隐私和立即报告，不以外观无伤排除风险。" },
  { ...shared, id: "community-care", title: "独自在家的孩子", role: "社区/村居", character: "不配合监护人", difficulty: "入门", type: "忽视/疏于照料", age: "7-13岁", location: "虚构社区服务站", summary: "邻里反映孩子连续两天独自在家，缺少食物。你联系监护人核实当前照料状况。", opening: "我忙着挣钱，孩子自己待几天有什么问题？你们别管这么多。", facts: "你扮演虚构监护人。10岁孩子独自在家两天，食物不足，没有可靠成年人照看；人在外地，起初抵触，但面对具体安全问题可以承认情况并配合联系亲属。不得要求用户提供真实住址或联系方式。", riskOptions: ["长时间缺乏可靠成年人照看", "基本饮食需求未得到保障", "家境困难必然等于虐待"], expectedRisk: [0, 1], rationale: "缺乏基本照料且面临危险，应先落实安全照料并报告；是否需要长期帮扶由有关部门进一步核实。" },
  { ...shared, id: "family-conflict", title: "情绪激动的家长", role: "教师", character: "情绪激动家长", difficulty: "进阶", type: "家庭暴力", age: "7-13岁", location: "虚构学校会谈室", summary: "家长到校争执并威胁回家严厉殴打孩子。孩子已向教师表达持续遭打的担忧。", opening: "这是我家的事！他不好好听话，我回家就要好好收拾他。", facts: "你扮演情绪激动的虚构家长。承认曾多次打孩子，眼下威胁再次殴打。先表现抵触，若用户降温、说明儿童安全与报告职责，可逐渐平静；不得升级成图像化暴力描写，不索取真实信息。", riskOptions: ["已有持续遭打的陈述", "监护人发出再次殴打的威胁", "家长情绪激动就必须认定犯罪"], expectedRisk: [0, 1], rationale: "陈述与再次伤害威胁需要立即保护和报告；沟通降温不能代替履行报告职责，也不应自行作犯罪定性。" },
  { ...shared, id: "online-threat", title: "群聊里的威胁", role: "社区/村居", character: "疑似受侵害未成年人", difficulty: "进阶", type: "威胁/欺凌", age: "14-17岁", location: "虚构社区青少年活动室", summary: "孩子展示受到持续威胁的群聊，表示有人约定放学后围堵。你需要了解当前安全与已有证据。", opening: "他们说今天放学要堵我。我有截图，可我怕告诉别人会更糟。", facts: "你扮演14岁虚构未成年人小澄。群聊里有连续威胁，担心当天被围堵；目前在活动室安全地点，已有截图但不提供真实账号。开放问询时说出时间与担忧，不编造伤亡。", riskOptions: ["持续出现具体伤害威胁", "存在近期可能发生的围堵风险", "把截图发到网络让大家评理"], expectedRisk: [0, 1], rationale: "具体威胁和近期伤害风险需要安全保护与报告；保存原始记录，避免公开传播或要求孩子自行赴约。" },
  { ...shared, id: "child-witness", title: "争执声后的孩子", role: "社区/村居", character: "目睹家庭暴力的儿童", difficulty: "进阶", type: "家庭暴力", age: "7-13岁", location: "虚构社区儿童服务站", summary: "邻居反映家中持续传出激烈争执和威胁，孩子经常独自在楼道停留。你作为社工核实孩子当前是否安全。", opening: "我可以在这里坐一会儿吗？家里又很吵。", facts: "你扮演10岁虚构儿童小芽，目睹父母间反复推搡和威胁，曾被警告不要告诉别人。目前在社区服务站，担心回家卷入冲突。初始不主动讲述暴力；在温和确认当前安全、允许不回答后，逐步说出担忧。不要描述具体伤害画面，不虚构伤情。", riskOptions: ["持续家庭冲突伴随具体威胁且波及孩子安全", "孩子因恐惧反复离开家中安全照料环境", "仅凭父母偶尔意见不合就认定虐待"], expectedRisk: [0, 1], rationale: "关注已知威胁、目睹暴力和当前照料安全，不把一般争执直接定性。安排安全陪伴，基于疑似侵害或危险及时报告，并由有关部门进一步核实。" },
  { ...shared, id: "young-creator", title: "被围攻的未成年博主", role: "社区/村居", character: "遭遇网络威胁的未成年人", difficulty: "进阶", type: "威胁/欺凌", age: "14-17岁", location: "虚构青少年网络服务室", summary: "一名未成年内容创作者遭到持续辱骂和私信威胁，个人信息被扩散。你需要了解现实安全风险并帮助保留证据。", opening: "他们把我的信息传出去了，还说要来找我。我不想让更多人知道。", facts: "你扮演15岁虚构创作者小岚。评论与私信中有持续辱骂、信息扩散和上门威胁；目前在服务室，有可靠社工陪伴。担心停更和求助会引来更多攻击。只提供虚构账号背景，不提供真实账号、住址或截图内容。对温和、尊重隐私的询问逐步回应；不编造自伤、伤亡或犯罪结论。", riskOptions: ["持续威胁与可识别信息扩散同时存在", "上门威胁可能转化为现实安全风险", "公开转发全部信息让网友寻找攻击者"], expectedRisk: [0, 1], rationale: "同时核实线上威胁与现实安全，保存已有原始记录和时间信息，避免扩大可识别信息传播。对疑似侵害或危险及时报告，不要求未成年人自行对抗或公开举证。" },
  { ...shared, id: "overlapping-risks", title: "不敢到校也不愿回家", role: "教师", character: "面临多重风险的未成年人", difficulty: "高阶", type: "多重风险（家庭暴力/校园欺凌）", age: "14-17岁", location: "虚构学校心理辅导室", summary: "学生既有家中受威胁的线索，又持续被同伴欺凌，担心当天放学被围堵。你需统筹眼前安全和多方面保护。", opening: "去学校会遇到他们，回家也不安心。我不知道可以去哪里。", facts: "你扮演14岁虚构学生小安。监护人曾威胁再次打你；同伴在群聊中威胁当天围堵，已有原始聊天记录。当前在教师陪伴的辅导室安全地点，有一位可联系的可靠亲属。两类风险都真实存在于虚构背景中，但只按用户开放问题逐项说明，不主动一次交代完整背景。不得增加新的侵害、露骨细节或真实联系方式。", riskOptions: ["家庭威胁与校园持续欺凌风险并存", "放学围堵具有近期危险，需要先安排安全陪伴", "只处理其中一种风险即可让学生独自离开"], expectedRisk: [0, 1], rationale: "优先评估即时危险和安全照护，分别记录不同来源的事实与未核实内容，及时报告并协同保护。不能处理一个风险后忽略另一个，也不能仅凭AI建议作终审结论。" },
  { ...shared, id: "quiet-student", title: "不愿开口的学生", role: "教师", character: "沉默回避的未成年人", difficulty: "高阶", type: "身体虐待", age: "7-13岁", location: "虚构学校安静会谈室", summary: "学生近期反复出现可见伤痕，放学后总躲在教室，却不愿解释原因。你需要在尊重其表达意愿的同时确认安全。", opening: "……可以不问我吗？我不想说。", facts: "你扮演11岁虚构学生小禾。监护人曾多次打你，担心说出来被责怪，目前在老师陪伴的安静会谈室。开始以沉默、点头或短句回避，不因用户一句普通问候就完整披露。若用户允许暂不回答、确认当前安全、给出可选择的表达方式，才逐步回应是否害怕回家等简单问题；被诱导、盘问或要求承认时继续表示不想说。不得新增事件、真实身份或图像化伤害细节。", riskOptions: ["已观察到反复伤痕和持续回避离校的情况", "应在不强迫披露的情况下确认当前安全", "沉默本身足以证明遭受侵害"], expectedRisk: [0, 1], rationale: "沉默本身不构成侵害结论，但已观察到的反复伤痕和安全担忧需认真处理。允许孩子暂不陈述，记录客观观察，落实陪伴，并基于已有疑似侵害或危险线索及时报告，不等待逼问出完整细节。" }
];
export const publicCases = () => cases.map(({ facts, expectedRisk, expectedEvidence, expectedCommunication, decision, rationale, ...item }) => ({ ...item, fictional: true }));
export const materials = [
  { id: "report-duty", title: "什么时候需要报告？", roles: ["公众", "教师", "医护", "社区/村居"], minutes: 3, format: "要点卡片", intro: "发现、疑似与危险，都值得及时关注。", points: ["普通公众发现侵害线索，有权向有关部门检举、控告。", "义务主体在工作中发现侵害、疑似侵害或其他危险，应立即向有关部门报告。", "九部门意见明确相关侵害线索应立即向公安报案或举报；不要等待自行调查完成。"], question: "还没有完整证据，需要等查清后再报告吗？", answer: "不应以证据尚未充分为由延迟报告；如实说明发现的线索及尚未确认的信息。", sourceIndexes: [0, 1] },
  { id: "evidence-privacy", title: "留存证据，保护隐私", roles: ["公众", "教师", "医护", "社区/村居"], minutes: 3, format: "实操 Q&A", intro: "记录事实，减少重复问询和二次传播。", points: ["记录发现的时间、地点、已有观察和当事人原话，区分事实与推测。", "妥善保留已有聊天、照片等原始材料及时间信息，不修改、不公开传播。", "用开放、温和的问题了解当前安全；不承诺绝对保密，不诱导其给出预设答案。"], question: "能否把疑似受害孩子的照片发群里求助？", answer: "应通过必要的正式报告渠道提供材料，避免在群聊或网络公开可识别信息。", sourceIndexes: [1] },
  { id: "teacher-duty", title: "教师：从发现线索到保护陪伴", roles: ["教师"], minutes: 4, format: "虚构短案例", intro: "小禾不愿回家并出现淤青。如何开始？", points: ["先确认孩子是否安全，安排适当陪伴。", "用“你愿意说说发生了什么吗”等开放问题，避免重复盘问。", "按报告职责及时向公安等有关部门报告，并如实记录；内部汇报不能成为延迟报告的理由。"], question: "监护人要求“家里的事不要管”，怎么办？", answer: "说明儿童安全与报告职责，继续保护和报告，避免让孩子独自面对潜在危险。", sourceIndexes: [0, 1] },
  { id: "doctor-duty", title: "医护：救治与报告并行", roles: ["医护"], minutes: 4, format: "岗位卡片", intro: "出现疑似侵害线索时，既关注救治也关注安全。", points: ["及时提供必要医疗救治，不自行推断犯罪结论。", "客观记录发现的伤情、就诊陈述和时间，依规范留存材料。", "发现疑似侵害或危险，履行立即报告义务，并保护患者隐私。"], question: "陪同人不愿配合，是否就停止报告？", answer: "应优先考虑未成年人安全，按制度履行报告职责，并请求有关部门协助。", sourceIndexes: [0, 1] },
  { id: "community-duty", title: "社区村居：把照料风险看见", roles: ["社区/村居"], minutes: 4, format: "虚构短案例", intro: "邻里反映孩子独居且缺少食物。如何处理？", points: ["核实当前安全、基本照料与可联系的可靠照护人。", "疑似侵害或危险及时报告；将贫困、照料困难与具体侵害事实分开描述。", "帮扶由有关部门协同开展；报告材料仅向有必要知悉的渠道提供。"], question: "只有困难家庭才需要关注吗？", answer: "关注具体安全和照料事实，不凭家庭经济条件作侵害定性。", sourceIndexes: [0, 1] }
];
export const dimensions = ["风险识别", "问询沟通", "报告判断", "证据梳理", "模拟上报"];
export function trainingFeedbackContext(scenario, worksheet, score, messages) {
  const selected = (indexes, options) => indexes?.length ? indexes.map(i => options[i]).filter(Boolean) : ["未选择"];
  const filled = value => value?.trim() || "未填写";
  const checked = value => value ? "已勾选" : "未勾选";
  return {
    案例: scenario.summary,
    复盘参考: scenario.rationale,
    实训对话: messages.map(({ role, content }) => ({ 发言者: role === "user" ? "受训者" : "案例角色", 内容: content })),
    用户工作表: {
      风险识别: selected(worksheet.risk, scenario.riskOptions),
      当前安全保护措施: filled(worksheet.safety),
      问询沟通: selected(worksheet.communication, scenario.communicationOptions),
      报告判断: ({ report: "报告（出现疑似侵害或危险，应立即报告）", wait: "等待自行调查清楚后再报告", none: "无需关注或报告" })[worksheet.decision] || "未选择",
      判断依据: filled(worksheet.reason),
      证据梳理: selected(worksheet.evidence, scenario.evidenceOptions),
      保留已有原始材料及时间信息: checked(worksheet.preserveOriginal),
      避免公开传播可识别信息: checked(worksheet.protectPrivacy),
      模拟上报: {
        虚构地点: filled(worksheet.report?.location),
        事件类型: filled(worksheet.report?.type),
        客观经过: filled(worksheet.report?.description),
        确认本次为虚构演练: checked(worksheet.report?.confirmFictional)
      }
    },
    已确定的规则评分: {
      总分: score.total, 满分: 100, 通过分数: score.passLine, 结果: score.passed ? "通过" : "未通过",
      各项得分: score.items.map(item => ({ 项目: item.title, 得分: item.score, 满分: item.max, 改进参考: item.advice }))
    }
  };
}
export function gradeTraining(scenario, worksheet, messages) {
  const { risk = [], communication = [], evidence = [], safety = "", reason = "", decision, report = {} } = worksheet;
  const selection = (chosen, correct) => Math.max(0, correct.filter(i => chosen.includes(i)).length * 5 - chosen.filter(i => !correct.includes(i)).length * 5);
  const userMessages = messages.filter(m => m.role === "user");
  const scores = [
    selection(risk, scenario.expectedRisk) + (safety.trim().length >= 10 ? 5 : 0) + (/安全|陪伴|保护|危险|110/.test(safety) ? 5 : 0),
    selection(communication, scenario.expectedCommunication) + (userMessages.length >= 1 ? 5 : 0) + (userMessages.some(m => /[？?]|愿意|告诉|发生|现在|安全|担心/.test(m.content)) ? 5 : 0),
    (decision === scenario.decision ? 10 : 0) + (reason.trim().length >= 15 ? 5 : 0) + (/疑似|立即|及时|不等|危险/.test(reason) ? 5 : 0),
    selection(evidence, scenario.expectedEvidence) + (worksheet.preserveOriginal ? 5 : 0) + (worksheet.protectPrivacy ? 5 : 0),
    (report.location?.trim() ? 5 : 0) + (report.type === scenario.type ? 5 : 0) + (report.description?.trim().length >= 20 ? 5 : 0) + (report.confirmFictional ? 5 : 0)
  ];
  const advice = ["识别具体风险信号，并写明当前安全保护措施。", "采用开放、温和的问询，实际完成沟通，避免诱导或绝对保密承诺。", scenario.rationale, "保留已有原始记录和时间信息，避免公开传播与反复问询。", "完成虚构地点、事件类型和客观经过，明确本次仅为模拟上报。"];
  const total = scores.reduce((a, b) => a + b, 0);
  return { total, passed: total >= 80, passLine: 80, rubric: "演示规则 v1", items: dimensions.map((title, i) => ({ title, score: scores[i], max: 20, advice: advice[i] })) };
}
