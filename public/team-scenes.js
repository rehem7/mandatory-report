// 找茬大侦探 · 组员提供的 6 个情境（分流(2).docx，2026-11-14 接手）
//
// 这份数据同时给两边用：
//   1. 服务端：game-content.js 把它接进 detectiveScenes，按剧情挂到对应的岗位节下；
//   2. 浏览器：随 /api/portal/catalog 下发，学习页底部「找茬大侦探」直接可玩（2 个场景一节的关卡条）。
//
// 挂在哪一节，看场景发生在谁的岗位上，不看它考哪条法：
//   学习三 teacher-duty   教师：从发现线索到保护陪伴 —— 课后教室、一张截图
//   学习四 doctor-duty    医护：救治与报告并行     —— 儿科诊室、急诊处置室
//   学习五 community-duty 社区村居：把照料风险看见 —— 便民服务站、调解室里的视频
// 六个场景正好三节各 2 关。别再把它们全摞在两节通用材料下：那样教师、医护、社区三节
// 学完没有可玩的找茬关，而找茬考的偏偏就是这三个岗位每天真会遇上的场面。
//
// 台词规则：一律用组员文档的原句，逐字不改。文档没给的三样由这边补——
//   人名（文档只写"班主任/小禾/配班老师"，名牌需要名字）、旁白 brief 与时间地点。
//
// 角色站位不按文档的"角色1/2/3"编号，按画面构图排：6 关的错误角色要落在左/中/右三档
// （现在是右、中、中、左、左、中）。全照文档顺序时六关的错误角色都在最右边，
// 玩家点两关就学会"点第三个人"，关卡就废了。台词、身份标签一个没动。
//
// 知识点索引对齐 content.js 的 materials[].points（换节时这两个索引要跟着改，别照抄）：
//   teacher-duty    [0] 先确认安全、安排陪伴 [1] 开放提问、不反复盘问
//                   [2] 及时报告、如实记录，内部汇报不能延迟 [3] 材料只向必要渠道提交
//   doctor-duty     [0] 及时救治、不自行定性 [1] 客观记录、依规范留存材料
//                   [2] 履行立即报告义务、保护患者隐私
//   community-duty  [0] 核实安全与基本照料 [1] 疑似侵害或危险及时报告
//                   [2] 帮扶协同、材料只向必要知悉的渠道提供
//
// 素材目录固定在 public/assets/visual/{scenes-team,cast/stand-team}/，文件名见每关的 background
// 与 characters[].id；旧版那两套素材已经移出仓库，前端不再需要按关卡切目录。

const line = (id, text, { error = false, pointIndex = null, knowledge = "" } = {}) =>
  ({ id, text, isError: error, pointIndex, knowledge });

export const teamScenes = [
  // ── 学习三 · 教师 ────────────────────────────────────────────────
  {
    id: "team-classroom",
    materialId: "teacher-duty",
    unit: "学习三",
    unitTitle: "教师：从发现线索到保护陪伴",
    title: "课后教室",
    brief: "你是班主任。放学后教室里只剩你、小禾和配班老师，小禾抬手时袖子滑下去，手臂上的淤青露了出来。",
    time: "傍晚 17:20 · 虚构小学教室",
    background: "team-classroom",
    misjudgePoint: 2,
    characters: [
      {
        id: "he-teacher", name: "何老师", role: "班主任", stance: 0.94,
        line: line("tx1-2", "小禾，你胳膊上的淤青看着很疼，和老师说说发生什么事了？")
      },
      {
        id: "xiaohe", name: "小禾", role: "学生", stance: 0.76,
        line: line("tx1-1", "我……我不敢说，是家里弄的。")
      },
      {
        id: "zhou-teacher", name: "周老师", role: "配班老师", stance: 1,
        line: line("tx1-3", "先别着急上报，咱们慢慢查清楚拿到完整证据再说上报的事。", { error: true, pointIndex: 2, knowledge: "报告不以「查清全部事实」为前提。等证据齐了再报，这几天里没有任何人接到报告，孩子也一直待在原来的环境里。" })
      }
    ]
  },
  {
    id: "team-office",
    materialId: "teacher-duty",
    unit: "学习三",
    unitTitle: "教师：从发现线索到保护陪伴",
    title: "一张截图",
    brief: "你是班主任。小禾把手机递给你，屏幕上是同班同学被威胁的群聊截图，发送时间就在今天下午。",
    time: "下午 16:10 · 虚构学校班主任办公室",
    background: "team-office",
    misjudgePoint: 3,
    characters: [
      {
        id: "li-teacher", name: "李老师", role: "班主任", stance: 0.94,
        line: line("tx4-1", "我先把截图原文件保存好，记录时间，只写我看到的原话，不添加自己的猜测。")
      },
      {
        id: "han-teacher", name: "韩老师", role: "任课老师", stance: 1,
        line: line("tx4-3", "这个截图很关键，我发到家长群里，让大家一起帮忙看看是谁干的。", { error: true, pointIndex: 3, knowledge: "公开传播截图会扩散可识别信息、造成二次伤害。材料只应向有必要知悉的渠道提供，家长群不在此列。" })
      },
      {
        id: "xiaohe", name: "小禾", role: "学生", stance: 0.76,
        line: line("tx4-2", "老师，我害怕别的同学都知道这件事。")
      }
    ]
  },

  // ── 学习四 · 医护 ────────────────────────────────────────────────
  {
    id: "team-clinic",
    materialId: "doctor-duty",
    unit: "学习四",
    unitTitle: "医护：救治与报告并行",
    title: "儿科诊室",
    brief: "你是儿科医生。一位母亲带孩子来看「从床上摔下来」，孩子坐在诊床上一声不吭。",
    time: "上午 10:35 · 虚构医院儿科诊室",
    background: "team-clinic",
    misjudgePoint: 2,
    characters: [
      {
        id: "chen-doctor", name: "陈医生", role: "儿科医生", stance: 1,
        line: line("tx2-1", "小朋友身上多处伤痕，伤痕形态和家属描述的摔倒不一致，我要做好接诊记录。")
      },
      {
        id: "mom", name: "小禾妈妈", role: "家属", stance: 0.96,
        line: line("tx2-3", "这点小事是家里管教孩子，你们先别上报，等我们回家教育好就没事了。", { error: true, pointIndex: 2, knowledge: "监护人说「家里管教」不能替代报告判断。发现疑似侵害就应当报告，不把决定权交回给可能的加害人。" })
      },
      {
        id: "xiaohe", name: "小禾", role: "就诊儿童", stance: 0.76,
        line: line("tx2-2", "我不想回家……")
      }
    ]
  },
  {
    id: "team-er",
    materialId: "doctor-duty",
    unit: "学习四",
    unitTitle: "医护：救治与报告并行",
    title: "急诊处置室",
    brief: "你是急诊护士。一位亲属带孩子来处理手臂的烫伤，他在处置室外一直举着手机拍照。",
    time: "夜间 20:50 · 虚构医院急诊处置室",
    background: "team-er",
    misjudgePoint: 1,
    characters: [
      {
        id: "cui", name: "崔叔叔", role: "陪同就诊亲戚", stance: 0.9,
        line: line("tx5-3", "照片拍得很清楚，我转发给亲戚朋友，大家一起帮忙评评理。", { error: true, pointIndex: 1, knowledge: "伤情照片属于涉案材料，应依规范随病历留存、只在诊疗与报告渠道内使用。转发给亲友「评理」会造成二次传播，也会让孩子再被议论一次。" })
      },
      {
        id: "xiaohe", name: "小禾", role: "就诊儿童", stance: 0.76,
        line: line("tx5-2", "能不能不要把我的照片给很多人看。")
      },
      {
        id: "xu", name: "许护士", role: "急诊护士", stance: 0.95,
        line: line("tx5-1", "拍摄的伤情照片会保存在医院病历系统，仅用于诊疗和报告留存，不会外传。")
      }
    ]
  },

  // ── 学习五 · 社区 ────────────────────────────────────────────────
  {
    id: "team-desk",
    materialId: "community-duty",
    unit: "学习五",
    unitTitle: "社区村居：把照料风险看见",
    title: "便民服务站",
    brief: "你是社区工作人员。一位住户来便民服务站，说连着几晚听见隔壁有孩子哭，还有大人训斥的声音。",
    time: "上午 09:40 · 虚构社区便民服务站",
    background: "team-desk",
    misjudgePoint: 1,
    characters: [
      {
        id: "guo", name: "小郭", role: "社区协管员", stance: 0.99,
        line: line("tx3-3", "只是听见哭声没有亲眼看到受伤，证据不足，不用上报。", { error: true, pointIndex: 1, knowledge: "报告不以「亲眼看见」为条件。听见、看到、被居民反映的疑似情形，都应当及时报告；是否需要核实、如何核实，由有权机关判断。" })
      },
      {
        id: "cui", name: "老崔", role: "反映情况的居民", stance: 0.9,
        line: line("tx3-1", "我连续好几个晚上都听见孩子哭，还听到训斥的声音。")
      },
      {
        id: "lin", name: "小林", role: "社区工作人员", stance: 0.94,
        line: line("tx3-2", "谢谢你主动反映这个线索，我们先把听到的情况如实记录下来。")
      }
    ]
  },
  {
    id: "team-mediation",
    materialId: "community-duty",
    unit: "学习五",
    unitTitle: "社区村居：把照料风险看见",
    title: "调解室里的视频",
    brief: "你是社区工作人员。一位邻居拿着手机来调解室，说他拍到隔壁孩子被大人反锁在家里。",
    time: "下午 15:00 · 虚构社区调解室",
    background: "team-mediation",
    misjudgePoint: 2,
    characters: [
      {
        id: "chen", name: "小陈", role: "社区工作人员", stance: 0.99,
        line: line("tx6-1", "我把原视频妥善保存，标注拍摄时间地点，只提交给公安和民政部门。")
      },
      {
        id: "xia", name: "小夏", role: "实习社工", stance: 0.93,
        line: line("tx6-3", "这个视频很有说服力，我发社区业主群征集更多线索。", { error: true, pointIndex: 2, knowledge: "把视频发进业主群等于放弃知悉范围的控制。材料只提交给必要部门，转发出去就收不回来了。" })
      },
      {
        id: "cui", name: "老崔", role: "提供线索的邻居", stance: 0.9,
        line: line("tx6-2", "视频我只录了一小段，希望孩子能安全一点。")
      }
    ]
  }
];

// 立绘与底图的文件名：public/assets/visual/cast/stand-team/<id>.webp、scenes-team/<background>.webp
export const teamArt = {
  cast: ["xiaohe", "he-teacher", "zhou-teacher", "chen-doctor", "mom", "cui", "lin", "guo", "li-teacher", "han-teacher", "xu", "chen", "xia"],
  scenes: ["team-classroom", "team-clinic", "team-desk", "team-office", "team-er", "team-mediation"]
};
