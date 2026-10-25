import crypto from "node:crypto";

const fixtureVersion = "receiver-cases-v3";
const source2024 = "https://www.spp.gov.cn/spp/xwfbh/dxal/202407/t20240705_659674.shtml";
const workflowNote = "依据公开案例整理；部门视图、标签和处置操作用于流程回放，不代表本平台实际受理记录。";

// Restore the receiver's complete report state to the twelve baseline cases.
export function resetDemoData(db, now = Date.now()) {
  const removed = db.reports.length;
  const rows = [
    {
      title: "姚某甲强奸案：医务人员主动报告", identity: "医护人员", age: "14岁", region: "山东省 · 德州市 · 乐陵市", types: ["性侵害"], tag: "A",
      period: "2022年6月至2023年5月", publishedAt: "2024-07-05", url: source2024,
      description: "接诊医生发现未成年患者低龄怀孕、智力发育异常，判断存在遭受性侵害的可能，依强制报告制度报告。检察机关提起公诉后，法院于2023年5月18日判处被告人有期徒刑六年。"
    },
    {
      title: "杨某甲虐待案：学校报告与多部门救助", identity: "教师/教育工作者", age: "7岁", region: "福建省 · 龙岩市 · 新罗区", types: ["身体虐待"], tag: "A", department: "民政",
      period: "2018年至2023年2月", publishedAt: "2024-07-05", url: source2024,
      description: "校长观察到学生情绪异常、手臂活动受限及颈部瘀青，了解情况后及时报案。法院于2023年2月9日判处被告人有期徒刑二年三个月。办案机关推动将孩子纳入事实无人抚养儿童保障，并落实临时照护、司法救助及转学、心理疏导等措施。",
      helpSummary: "学校报告后启动保护救助。民政部门将孩子纳入事实无人抚养儿童保障，安排临时照护；相关部门协同落实生活保障、转学及心理支持。",
      helpNote: "公开案例记载：纳入事实无人抚养儿童保障，安排福利院临时照护并发放生活补贴。"
    },
    {
      title: "高某某虐待案：教师识别异常并报告", identity: "教师/教育工作者", age: "8岁", region: "河南省 · 濮阳市 · 华龙区", types: ["身体虐待"], tag: "A", department: "教育",
      period: "2021年7月至2024年1月", publishedAt: "2024-07-05", url: source2024,
      description: "班主任发现学生行走不便，进一步观察到烫伤和多处陈旧伤痕，按要求报告学校；学校报告教育部门及乡政府，乡政法委员随后报案。2024年1月26日，法院判处被告人有期徒刑一年六个月。办案机关推动调整抚养安排，孩子后由生母抚养。",
      helpSummary: "班主任发现异常后，学校、教育部门与乡政府联动报告。公开办理结果显示，孩子已调整抚养安排，由生母抚养。教育视图用于回放学校报告与保护衔接。",
      helpNote: "公开案例记载：教师发现伤情后报告学校，学校及时报告教育部门及乡政府。"
    },
    {
      title: "王某故意伤害案：护士与妇联共同报告", identity: "医护人员", age: "未披露", region: "山东省 · 临沂市 · 临沭县", types: ["暴力伤害"], tag: "A", department: "妇联",
      period: "2021年6月至8月", publishedAt: "2022-05-27", url: "https://www.spp.gov.cn/spp/bhsndn/202205/t20220527_558431.shtml",
      description: "护士发现住院未成年人伤情异常，向县妇联工作人员反映。两人探视后判断可能存在家庭暴力并决定报警，公安机关随后抓获嫌疑人。法院依法判处被告人有期徒刑四年六个月，未履行报告义务的相关人员被追责。",
      helpSummary: "护士向县妇联工作人员反映住院儿童异常伤情，二人探视后共同决定报警。妇联视图用于回放线索发现、报告与跨部门衔接。",
      helpNote: "公开案例记载：护士与县妇联工作人员探视儿童后决定报警，推动公安机关介入。"
    },
    {
      title: "雷波县酒店报告案：异常入住及时核查", identity: "其他", identityOther: "住宿经营者", age: "13岁", region: "四川省 · 凉山彝族自治州 · 雷波县", types: ["其他"], tag: "C",
      period: "2023年4月6日", publishedAt: "2024-07-05", url: source2024,
      description: "酒店工作人员核对未成年人与同住成年人的关系、监护人联系方式时发现可疑情况，二人离开后立即报告公安机关。民警及时找到相关人员并核查情况，联系监护人接回未成年人，对成年人进行批评教育。"
    },
    {
      title: "江某某侵害学生案：强制报告衔接立案监督", identity: "教师/教育工作者", age: "14岁", region: "湖北省 · 襄阳市 · 枣阳市", types: ["性侵害"], tag: "A",
      period: "2019年5月至12月", publishedAt: "2019-12-20", url: "https://www.spp.gov.cn/spp/jhmyghzdmhmt/201912/t20191220_519508.shtml",
      description: "学生家长向教育部门反映并报警后，公安机关起初未立案。教育局依强制报告制度向检察机关通报，检察机关启动立案监督，公安机关随后立案侦查。法院最终判处被告人有期徒刑一年，并适用从业禁止。",
      supervisionReason: "立案监督：教育部门通报后，检察机关监督推动公安机关立案侦查"
    },
    {
      title: "孙某汝强奸案：医疗机构未报告被追责", identity: "医护人员", age: "未满14岁", region: "辽宁省 · 丹东市 · 东港市", types: ["性侵害"], tag: "A",
      period: "2021年2月至2022年3月", publishedAt: "2022-05-27", url: "https://www.spp.gov.cn/spp/bhsndn/202205/t20220527_558432.shtml",
      description: "未成年女孩遭受侵害后曾到医疗机构就诊，接诊人员明知其未满14周岁，仍未履行强制报告义务。女孩母亲获悉情况后报警。法院于2022年3月21日判处被告人有期徒刑十年，相关医疗机构和人员未报告的问题被依法追责。",
      supervisionReason: "应报未报：医疗机构发现未满14周岁患者怀孕后未履行报告义务"
    },
    {
      title: "陈某甲过失致人死亡案：基层组织报告责任", identity: "医护人员", age: "3岁", region: "上海市 · 普陀区", types: ["其他"], tag: "A",
      period: "2020年8月至2021年3月", publishedAt: "2022-05-27", url: "https://www.spp.gov.cn/spp/bhsndn/202205/t20220527_558394.shtml",
      description: "医院发现幼童死亡原因可疑，立即向公安机关报案并报告检察机关。调查发现，基层组织此前已注意到异常养育及伤情线索，但未及时报告。法院于2021年3月19日以过失致人死亡罪判处被告人有期徒刑二年、缓刑二年。",
      supervisionReason: "应报未报：基层组织发现异常养育及伤情线索后未及时报告"
    },
    {
      title: "张某猥亵儿童案：学校瞒报被追责", identity: "教师/教育工作者", age: "未披露", region: "安徽省 · 合肥市", types: ["性侵害"], tag: "A", department: "教育",
      period: "2019年下半年至2020年10月", publishedAt: "2022-05-27", url: "https://www.spp.gov.cn/spp/bhsndn/202205/t20220527_558433.shtml",
      description: "某小学教师侵害多名学生，学校负责人获悉后仅私下协调赔偿，未按规定报告。法院依法判处被告人有期徒刑四年，相关学校负责人因履职失责受到处理。",
      helpSummary: "学校负责人获悉侵害线索后未及时报告，相关责任人员被追责。教育视图用于回放学校报告责任、问题整改与保护机制衔接。",
      helpNote: "公开案例记载：学校相关负责人因未履行报告职责受到追责处理。",
      supervisionReason: "应报未报：学校知悉侵害线索后私下协调，未依法报告"
    },
    {
      title: "许某某等人强奸案：住宿经营者未报告被处罚", identity: "其他", identityOther: "住宿经营者", age: "未披露", region: "广西壮族自治区 · 桂林市 · 七星区", types: ["性侵害"], tag: "A",
      period: "2021年6月至10月", publishedAt: "2022-05-27", url: "https://www.spp.gov.cn/xwfbh/wsfbt/202205/t20220527_557995.shtml",
      description: "宾馆接待成年人与未成年人共同入住时，发现未成年人状态异常，仍未严格落实身份核验、询问和报告要求。案件发生后，相关犯罪人员被依法追究刑事责任，宾馆因未履行报告等职责受到处罚。",
      supervisionReason: "应报未报：住宿经营者发现未成年人异常入住情况后未及时核验、询问和报告"
    },
    {
      title: "李某某强奸案：住宿经营者及时保护并报告", identity: "其他", identityOther: "住宿经营者", age: "12岁", region: "贵州省 · 毕节市 · 威宁县", types: ["性侵害"], tag: "A",
      period: "2022年10月至2023年4月", publishedAt: "2024-07-05", url: source2024,
      description: "宾馆经营者发现入住未成年人神情恐惧、抗拒同住成年人，且二人年龄差距及身份关系异常，先将孩子带至前台保护并立即报警。案件得到及时查处，法院于2023年4月10日判处被告人有期徒刑五年六个月。"
    },
    {
      title: "韦某虐待小菲案：班主任报告衔接保护安置", identity: "教师/教育工作者", age: "小学二年级（年龄未披露）", region: "浙江省 · 台州市 · 临海市", types: ["身体虐待"], tag: "A",
      period: "具体时间见来源原文", publishedAt: "2022-05-30", url: "https://www.spp.gov.cn/spp/zdgz/202205/t20220530_558447.shtml",
      description: "班主任家访时发现学生持续遭受家庭暴力，依强制报告要求报告。检察机关介入后推动案件由自诉转为公诉，并衔接心理支持、临时安置与家庭教育指导。法院以虐待罪判处被告人有期徒刑一年、缓刑二年。"
    }
  ];
  const reports = rows.map((row, index) => ({
    id: `CASE-BASE-${String(index + 1).padStart(3, "0")}`,
    receipt: crypto.randomBytes(24).toString("hex"), demoFixture: fixtureVersion,
    ownerId: "demo-fixtures", identity: row.identity, identityOther: row.identityOther || "", typeOther: "",
    region: row.region, address: "具体地址未公开", occurredAt: null, age: row.age,
    reporter: { name: "", organization: "", phone: "" }, anonymous: null, obligated: true, attachments: [],
    receivedAt: null, deadline: null,
    sourceCase: { title: row.title, publisher: "最高人民检察院", url: row.url, publishedAt: row.publishedAt, eventPeriod: row.period, workflowNote },
    ai: { tag: row.tag, risk: row.tag === "A" ? "高" : "待核实", infringement: row.types.join("、"), threshold: "依据公开材料回放报告与协同流程", reason: row.title, evidence: [], mock: true },
    types: row.types, description: row.description, confirmedTag: row.tag, status: "已归档", department: row.department || null,
    helpSummary: row.helpSummary || "", helpRecords: row.helpNote ? [{ department: row.department, note: row.helpNote, time: null }] : [],
    supervision: row.supervisionReason ? [{ reason: row.supervisionReason, time: null }] : []
  }));
  db.reports = reports;
  db.logs = [];
  for (const report of reports) {
    db.logs.push({ id: crypto.randomUUID(), role: "系统", action: "导入公开案例回放：" + report.sourceCase.title, reportId: report.id, time: new Date(now).toISOString() });
  }
  return { created: reports.length, removed };
}
