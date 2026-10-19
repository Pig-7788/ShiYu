/* ============ 识渔计划 数据层（全部样本为虚构，仅用于教学模拟） ============ */

const DIMENSIONS = [
  { key: "domain",   name: "域名甄别" },
  { key: "psych",    name: "话术免疫" },
  { key: "link",     name: "链接警惕" },
  { key: "attach",   name: "附件谨慎" },
  { key: "pressure", name: "紧迫感抗压" },
];

const DIM_OF_CATEGORY = {
  domain_spoof: "domain",
  authority:    "psych",
  reward_bait:  "psych",
  personal_info:"psych",
  urgency:      "pressure",
  link_mismatch:"link",
  attachment:   "attach",
};

const CATEGORY_NAME = {
  domain_spoof: "域名仿冒",
  urgency: "紧迫话术",
  authority: "冒充权威",
  link_mismatch: "链接不符",
  reward_bait: "利诱钩子",
  attachment: "附件风险",
  personal_info: "索要个人信息",
};

const DIM_ADVICE = {
  domain:   "域名甄别偏弱：养成看完整域名的习惯（@后整个字符串、末尾一段才是真域名），注意连字符/一字之差/多余后缀。",
  psych:    "话术免疫偏弱：凡出现“冻结、扣费、逾期作废、双倍赔付、垫付返利、索要验证码/身份证号”，一律先怀疑。",
  link:     "链接警惕偏弱：不点短信/邮件正文链接；悬停或长按查看真实指向；短链、IP 直连、二维码一律视为不可信入口。",
  attach:   "附件谨慎偏弱：不打开陌生来信的附件；exe/dotm/docm 等可执行或宏格式一律高危；官方通知通常不需要你回传附件。",
  pressure: "紧迫感抗压偏弱：倒计时/限时话术正是为了让你来不及思考。遇到“立即、马上、X分钟内”，先停下来，换官方渠道核实。",
};

/* ---------- 知识库内容源：五维能力的教学定义 ---------- */
const DIM_DOC = {
  domain:   { en: "DOMAIN",   desc: "核对发件域名、链接域名与官方域名是否一致，注意错拼、连字符、子域拼接和真假后缀。", train: "从右往左读完整域名；@ 后面整串都要看。" },
  psych:    { en: "PSYCH",    desc: "识别紧迫、利诱、恐吓、冒充身份等话术，先判断“它在催我做什么”，再决定是否相信。", train: "凡是要钱、要码、要证件号的，先换官方渠道核实。" },
  link:     { en: "LINK",     desc: "判断链接的实际去向：悬停看 URL，短链、二维码、裸 IP 都按“无法预览真实去向”处理。", train: "不点正文链接；要访问就手动输入官方域名。" },
  attach:   { en: "ATTACH",   desc: "判断附件的类型与来源：可执行文件、带宏文档、压缩包都是高危载体。", train: "陌生附件不打开；不替陌生人“启用宏”。" },
  pressure: { en: "PRESSURE", desc: "在倒计时和损失威胁下保持稳定，不被“马上、今日、最后 X 分钟”推着操作。", train: "先停 10 秒，再核实；真正的通知不怕你多问一句。" },
};

/* ---------- 知识库内容源：7 类破绽的教学卡（定义 / 识别 / 话术例 / 维度 / 出处） ---------- */
const CATEGORY_DOC = {
  domain_spoof: {
    no: "01", name: "域名仿冒", en: "DOMAIN SPOOFING", dim: "domain", color: "#35e0c8",
    def: "攻击者注册与官方域名高度相似的域名——错拼、连字符、子域拼接、真假后缀——让发件人地址或网址看起来像官方。",
    cue: "从右往左读域名：最后两段才是主域名；@ 后面整串都要核对，别只看开头像不像。",
    example: "网络信息中心 <nic@clut-demo-edu.cn>",
    exampleNote: "官方演示域是 clut-demo.edu.cn；这里用连字符替换了点号，一字之差就是另一个域名。",
    source: "《反电信网络诈骗法》相关条款；国家反诈中心公开宣传；本作品样本库（4 例：冒充导师 / 高仿教务 / 二维码核验 / 仿登录页）。",
  },
  urgency: {
    no: "02", name: "紧迫话术", en: "URGENCY PRESSURE", dim: "pressure", color: "#ff5470",
    def: "用倒计时、逾期、停用、冻结等时间压力，压缩你核实的时间，让你在慌乱中点击、填写或转账。",
    cue: "凡是催“立刻、今日、30 分钟内、逾期作废”的，先停 10 秒，换官方渠道核实。",
    example: "系统检测到您的账号在异地登录，请于 30 分钟内完成实名核验，否则账号将被停用。",
    exampleNote: "倒计时是话术，不是事实；真正的系统通知不会只给你几十秒。",
    source: "国家反诈中心公开宣传（限时施压类）；本作品样本库（3 例：校园卡停用 / 账号异常 / 助学金逾期）。",
  },
  authority: {
    no: "03", name: "冒充权威", en: "AUTHORITY IMPERSONATION", dim: "psych", color: "#7fb4ff",
    def: "假冒学校部门、导师、客服、公检法等可信身份，借抬头、公章图片、头像和公文腔降低戒心。",
    cue: "身份看域名和线下渠道，不看抬头、公章图片和头像；涉及钱，必须用第二渠道核实。",
    example: "【教务处】学业状态确认（系统升级补发）",
    exampleNote: "抬头可以伪造，公章可以是图片；域名和官方渠道才难伪造。",
    source: "国家反诈中心公开宣传（冒充公检法 / 客服 / 熟人类）；本作品样本库（3 例：快递理赔 / 客服退款 / 航班退改）。",
  },
  link_mismatch: {
    no: "04", name: "链接不符", en: "MISMATCHED LINK", dim: "link", color: "#b48cff",
    def: "显示文字与实际跳转地址不一致；或用短链、裸 IP、二维码隐藏真实去向，让你在“看起来正常”的入口里交出信息。",
    cue: "悬停或长按看真实 URL；短链、二维码、IP+端口默认按不可信入口处理。",
    example: "http://jwc.clut-demo.edu.cn.ssl-verify.top/login",
    exampleNote: "从右往左读，真正的域名是 ssl-verify.top；前面那串学校域名只是伪装。",
    source: "国家反诈中心公开宣传（钓鱼链接类）；本作品样本库（4 例：高仿教务 / 裸 IP 通知 / 助学金链接 / 跳转异常）。",
  },
  reward_bait: {
    no: "05", name: "利诱钩子", en: "REWARD BAIT", dim: "psych", color: "#ffb84d",
    def: "用奖助学金、退款、返利、中奖、低价等利益诱导点击、垫付或转账，把“想要”变成“来不及想”。",
    cue: "先问三句：为什么是我？为什么这么急？为什么要先付钱？",
    example: "【兼职】动动手指日入 300+！点赞关注即可结算，需先垫付本金提升等级。",
    exampleNote: "先给小利、再要本金，是刷单返利的标准节奏。",
    source: "国家反诈中心公开宣传（刷单返利 / 虚假中奖类）；本作品样本库（2 例：刷单返利 / 虚假中奖）。",
  },
  attachment: {
    no: "06", name: "附件风险", en: "MALICIOUS ATTACHMENT", dim: "attach", color: "#ff8a65",
    def: "通过 .exe、.docm、压缩包等可执行或带宏附件投递恶意程序，诱导你运行、启用宏或解压。",
    cue: "陌生附件不打开；让你“启用宏 / 运行程序”的，基本可以直接删。",
    example: "报名表回传模板.docm（88 KB）",
    exampleNote: ".docm 带宏，可执行代码；正规报名表通常是 .pdf 或 .docx。",
    source: "国家反诈中心公开宣传（木马附件类）；本作品样本库（2 例：理赔附件 / 带宏报名表）。",
  },
  personal_info: {
    no: "07", name: "索要个人信息", en: "CREDENTIAL HARVESTING", dim: "psych", color: "#ff69b4",
    def: "以核验、退款、报销、认证为名，索要密码、验证码、身份证号、银行卡号等敏感信息。",
    cue: "验证码是一次性钥匙；任何索要验证码或密码的，都是红旗。",
    example: "请补全手机号与身份证号后回传，以便核对报名信息。",
    exampleNote: "报名表不需要身份证号；退款也不需要你提供新银行卡号。在五维画像里，这类破绽计入“话术免疫”——先识别它在向你要什么。",
    source: "《中华人民共和国反电信网络诈骗法》相关条款；国家反诈中心公开宣传；本作品样本库（3 例：理赔索卡 / 报名表索证 / 仿登录页）。",
  },
};

/* ---------- 知识库内容源：被骗后的止损四步 ---------- */
const STOP_LOSS = [
  { t: "立即报警 + 止付", d: "拨打 110 报警，同时联系银行或支付平台申请止付、冻结涉案账户；96110 是反诈预警劝阻专线，可用于咨询核实。" },
  { t: "保留证据", d: "聊天记录、转账凭证、短信 / 邮件原文、链接和二维码截图都留存，不要删除，也不要只截一半。" },
  { t: "修改密码", d: "立即更换涉及支付、邮箱、社交账号的密码，开启二次验证；不要继续使用同一个密码。" },
  { t: "告知与求助", d: "告诉辅导员、家长或信任的人，必要时寻求心理支持；越早说出来，越容易止损。" },
];

/* ---------- 知识库内容源：资料来源 ---------- */
const ATLAS_SOURCES = [
  { t: "《中华人民共和国反电信网络诈骗法》", d: "2022 年 9 月 2 日通过，2022 年 12 月 1 日施行；本页“索要个人信息”与“止损”部分的边界参考该法。", u: "https://www.npc.gov.cn/" },
  { t: "国家反诈中心 / 公安部刑侦局公开宣传", d: "高发骗术类型、劝阻渠道与“三不一多”提示参考其公开内容；96110 为全国反诈预警劝阻专线。", u: "https://www.mps.gov.cn/" },
  { t: "中国互联网络信息中心（CNNIC）", d: "《中国互联网络发展状况统计报告》用于了解网络应用背景；本页不引用未经核对的具体比例。", u: "https://www.cnnic.net.cn/" },
  { t: "本作品样本库", d: "20 个虚构样本、7 类破绽标注与讲解文案；话术例为教学改写，不指向真实机构、个人或域名。", u: "" },
];

const FA_DIM_BY_PARTTYPE = {
  addr: "domain", url: "domain", phone: "domain",
  link: "link", qr: "link", btn: "link",
  attach: "attach",
  subj: "psych", p: "psych", field: "psych",
};

/* ---------- 样本库：carrier(email/sms/linkpage) × difficulty(1-3) ---------- */
/* parts: {t, id?, text/html, sub?}；redflags 引用 parts.id */
const SAMPLES = [
  /* ============ 邮件 ============ */
  { id: "em1", carrier: "email", difficulty: 1, phishing: true, scene: "奖助学金",
    meta: { from: "教务处学生资助中心", addr: "jwc-zizhu@qq.com", subj: "【重要】2026年秋季助学金申领通知", time: "08:12" },
    parts: [
      { t: "p", html: "各位同学：根据学校资助管理中心安排，本学期助学金将于近期分批发放。" },
      { t: "p", html: "请点击下方链接，<span class=\"sel-target\" data-el=\"em1-pi\">填写银行卡号、取款密码及短信验证码</span>完成身份核验：" },
      { t: "link", id: "em1-link", text: "http://zhuxue-buzhu.top/verify" },
      { t: "p", html: "<span class=\"sel-target\" data-el=\"em1-urg\">逾期未核验视为自动放弃</span>本学期资助资格。" },
    ],
    redflags: [
      { category: "domain_spoof", target: "em1-addr", explain: "学校部门不会使用 qq.com 个人邮箱发送资助通知。" },
      { category: "link_mismatch", target: "em1-link", explain: "链接指向与学校毫无关系的 .top 域名。" },
      { category: "personal_info", target: "em1-pi", explain: "任何正规环节都不会索要银行卡取款密码和短信验证码。" },
      { category: "urgency", target: "em1-urg", explain: "“逾期视为放弃”制造截止压力，是典型催促话术。" },
    ] },

  { id: "em2", carrier: "email", difficulty: 1, phishing: true, scene: "快递理赔",
    meta: { from: "中通速递客服中心", addr: "kefu-zto@qq-kefu163.com", subj: "您的包裹在运输中破损，可获双倍理赔", time: "14:47" },
    parts: [
      { t: "p", html: "您好：您的包裹（单号末四位 8873）在分拣过程中<span class=\"sel-target\" data-el=\"em2-urg\">外包装严重破损</span>，现已为您启动双倍赔付流程。" },
      { t: "attach", id: "em2-att", text: "赔付申请表.exe", sub: "358 KB" },
      { t: "p", html: "请下载并填写附件，<span class=\"sel-target\" data-el=\"em2-pi\">回传您的姓名、银行卡号</span>，今日内到账，逾期不予受理。" },
    ],
    redflags: [
      { category: "authority", target: "em2-addr", explain: "冒充快递客服，但发件域为拼接的伪官方地址。" },
      { category: "attachment", target: "em2-att", explain: ".exe 是可执行程序，正规理赔绝不会让你运行程序。" },
      { category: "urgency", target: "em2-urg", explain: "强调“破损/今日内”，用紧迫感压缩你的思考时间。" },
      { category: "personal_info", target: "em2-pi", explain: "理赔不需预先回传银行卡号。" },
    ] },

  { id: "em3", carrier: "email", difficulty: 2, phishing: false, scene: "图书馆提醒",
    meta: { from: "图书馆", addr: "lib@clut-demo.edu.cn", subj: "图书到期提醒", time: "09:30" },
    parts: [
      { t: "p", html: "读者您好：您借阅的《计算机网络（第8版）》将于 3 天后到期，可在到期前在线续借一次。" },
      { t: "link", id: "em3-link", text: "https://lib.clut-demo.edu.cn/renew" },
      { t: "p", html: "如有疑问请携带校园卡到一层服务台咨询。" },
    ],
    redflags: [],
    legitNotes: [
      { target: "em3-addr", note: "发件域与图书馆官方域名一致（演示域），非个人邮箱。" },
      { target: "em3-link", note: "链接域名与官网一致且为 https，未索要任何敏感信息。" },
    ] },

  { id: "em4", carrier: "email", difficulty: 2, phishing: true, scene: "冒充导师",
    meta: { from: "王海林", addr: "wanghailin@clut-edu.cn", subj: "关于课题组经费报销的事", time: "21:03" },
    parts: [
      { t: "p", html: "同学你好，我这边有一批<span class=\"sel-target\" data-el=\"em4-urg\">今晚必须提交</span>的会议发票，" },
      { t: "p", html: "你先把<span class=\"sel-target\" data-el=\"em4-pi\">银行卡号发到这个邮箱</span>，报销款到账后我再把垫付部分转给你，勿声张。" },
    ],
    redflags: [
      { category: "domain_spoof", target: "em4-addr", explain: "clut-edu.cn 少了官方域中的 -demo 段——拼凑官方域名的近似域名即伪域名。" },
      { category: "urgency", target: "em4-urg", explain: "“今晚必须”“勿声张”是冒充熟人诈骗的经典组合。" },
      { category: "personal_info", target: "em4-pi", explain: "正规报销走财务系统，不会让你把银行卡号发给个人邮箱。" },
    ] },

  { id: "em5", carrier: "email", difficulty: 2, phishing: true, scene: "高仿链接",
    meta: { from: "教务处", addr: "jwc@clut-demo.edu.cn", subj: "学业状态确认（系统升级补发）", time: "10:15" },
    parts: [
      { t: "p", html: "因系统升级，部分同学的学业状态需重新确认，请通过下方“统一入口”核验：" },
      { t: "link", id: "em5-link", text: "http://jwc.clut-demo.edu.cn.ssl-verify.top/login" },
      { t: "p", html: "未确认的科目成绩将<span class=\"sel-target\" data-el=\"em5-urg\">按零分记载</span>。" },
    ],
    redflags: [
      { category: "link_mismatch", target: "em5-link", explain: "长域名陷阱：真正的域名在末尾（ssl-verify.top），前面一大串都是伪装。" },
      { category: "urgency", target: "em5-urg", explain: "“按零分记载”恐吓施压。" },
    ] },

  { id: "em6", carrier: "email", difficulty: 3, phishing: false, scene: "财务通知（真）",
    meta: { from: "财务处", addr: "cwc@clut-demo.edu.cn", subj: "2026年10月学生补贴发放安排", time: "08:00" },
    parts: [
      { t: "p", html: "十月学生补贴将于 15 日统一发放至学校代办的银行卡，无需任何操作。" },
      { t: "attach", id: "em6-att", text: "发放说明.pdf", sub: "126 KB" },
      { t: "p", html: "如有疑问请到行政楼 204 室咨询，谨防以发放补贴为名的诈骗。" },
    ],
    redflags: [],
    legitNotes: [
      { target: "em6-addr", note: "官方域名 + 明确线下办理渠道。" },
      { target: "em6-att", note: "官方域名来信中的说明性 pdf，且全文未要求你回复任何信息——结合域名与要求综合判断。" },
    ] },

  { id: "em7", carrier: "email", difficulty: 3, phishing: true, scene: "定向钓鱼",
    meta: { from: "校科技创新联盟", addr: "union@stu.clut-demo.edu.cn", subj: "你的《识渔计划》报名表需要补全", time: "17:26" },
    parts: [
      { t: "p", html: "收到你通过社团渠道提交的竞赛报名表，其中<span class=\"sel-target\" data-el=\"em7-pi\">联系方式栏不完整</span>，请补全手机号与身份证号后回传：" },
      { t: "attach", id: "em7-att", text: "报名表回传模板.docm", sub: "88 KB" },
      { t: "link", id: "em7-link", text: "http://union-form.top/apply" },
    ],
    redflags: [
      { category: "personal_info", target: "em7-pi", explain: "报名表不需要身份证号；索要证件号即为红旗。" },
      { category: "attachment", target: "em7-att", explain: ".docm 是带宏的文档，可携带恶意代码。" },
      { category: "link_mismatch", target: "em7-link", explain: "回传入口域名与学校无关。" },
    ] },

  { id: "em8", carrier: "email", difficulty: 3, phishing: true, scene: "二维码核验",
    meta: { from: "网络信息中心", addr: "nic@clut-demo-edu.cn", subj: "校园网账号异常登录提醒", time: "12:44" },
    parts: [
      { t: "p", html: "系统检测到您的账号在异地登录，请于<span class=\"sel-target\" data-el=\"em8-urg\">30 分钟内</span>完成实名核验，否则账号将被停用：" },
      { t: "qr", id: "em8-qr", text: "扫码核验" },
    ],
    redflags: [
      { category: "domain_spoof", target: "em8-addr", explain: " clut-demo-edu.cn 用连字符替换了点号，一字之差的伪域名。" },
      { category: "urgency", target: "em8-urg", explain: "倒计时 30 分钟，制造恐慌。" },
      { category: "link_mismatch", target: "em8-qr", explain: "二维码=无法预览指向的链接，等价于不明短链。" },
    ] },

  { id: "em9", carrier: "email", difficulty: 3, phishing: false, scene: "讲座通知（真）",
    meta: { from: "教务办", addr: "jwb@clut-demo.edu.cn", subj: "学术讲座预告：大模型安全攻防", time: "16:20" },
    parts: [
      { t: "p", html: "本周四 14:00 在实验楼 B201 举办学术讲座，可认定素质拓展学分，无需报名，座位先到先得。" },
    ],
    redflags: [],
    legitNotes: [
      { target: "em9-addr", note: "官方域名、无链接无附件、无任何信息索取。" },
    ] },

  /* ============ 短信 ============ */
  { id: "sms1", carrier: "sms", difficulty: 1, phishing: true, scene: "刷单返利",
    meta: { phone: "+86 170****8876", time: "19:52" },
    parts: [
      { t: "p", html: "【兼职】动动手指<span class=\"sel-target\" data-el=\"sms1-rb\">日入 300+</span>！给短视频点赞关注即可结算，<span class=\"sel-target\" data-el=\"sms1-pi\">需先垫付本金</span>提升等级，加群了解：" },
      { t: "link", id: "sms1-link", text: "https://t.cn/xxxxx9" },
    ],
    redflags: [
      { category: "reward_bait", target: "sms1-rb", explain: "“日入 300+ 轻松结算”是刷单诈骗的标准开场。" },
      { category: "personal_info", target: "sms1-pi", explain: "垫付本金=资金陷阱，先给小利再收割大额。" },
      { category: "link_mismatch", target: "sms1-link", explain: "短链无法预览真实指向。" },
    ] },

  { id: "sms2", carrier: "sms", difficulty: 2, phishing: true, scene: "退款客服",
    meta: { phone: "95xxx20", time: "11:08" },
    parts: [
      { t: "p", html: "<span class=\"sel-target\" data-el=\"sms2-au\">【天猫售后】</span>您购买的商品检测出质量问题，双倍退款已受理。<span class=\"sel-target\" data-el=\"sms2-urg\">今日不办理将每月自动扣费 500 元</span>，回T退订。" },
    ],
    redflags: [
      { category: "authority", target: "sms2-au", explain: "冒充平台官方售后；真实退款只会原路退回，无需你“办理”。" },
      { category: "urgency", target: "sms2-urg", explain: "“不办理就扣费”是恐吓型紧迫话术。" },
    ] },

  { id: "sms3", carrier: "sms", difficulty: 2, phishing: false, scene: "验证码（真）",
    meta: { phone: "95588", time: "13:31" },
    parts: [
      { t: "p", html: "【演示银行】验证码 482913，您正在进行登录操作。验证码请勿告知任何人，工作人员不会向您索要。" },
    ],
    redflags: [],
    legitNotes: [
      { target: null, note: "正常的验证码短信：官方号段、只告知验证码并提醒保密，没有任何链接与要求。" },
    ] },

  { id: "sms4", carrier: "sms", difficulty: 2, phishing: true, scene: "校园卡停用",
    meta: { phone: "1069xxxx", time: "07:59" },
    parts: [
      { t: "p", html: "【校园卡中心】您的校园卡已<span class=\"sel-target\" data-el=\"sms4-urg\">被暂停使用</span>，请前往完成身份复核后重启：" },
      { t: "link", id: "sms4-link", text: "http://jiaowu-clut.vip-recharge.top" },
    ],
    redflags: [
      { category: "urgency", target: "sms4-urg", explain: "“已被暂停”制造损失焦虑。" },
      { category: "link_mismatch", target: "sms4-link", explain: "充值复核域名与学校无关；校园卡业务请走校内官方入口。" },
    ] },

  { id: "sms5", carrier: "sms", difficulty: 2, phishing: true, scene: "航班退改",
    meta: { phone: "0085xxxx", time: "05:23" },
    parts: [
      { t: "p", html: "<span class=\"sel-target\" data-el=\"sms5-au\">【航空出行】</span>您预订的 CZ36XX 航班因机械故障取消，改签可获 300 元补偿。<span class=\"sel-target\" data-el=\"sms5-pi\">请回短信提供银行卡号接收退款</span>：" },
      { t: "link", id: "sms5-link", text: "https://dwz.cn/3aXXXX" },
    ],
    redflags: [
      { category: "authority", target: "sms5-au", explain: "冒充航司；0085 开头为境外号码伪装。" },
      { category: "personal_info", target: "sms5-pi", explain: "退款只会原路退回购票账户，不需要新银行卡号。" },
      { category: "link_mismatch", target: "sms5-link", explain: "短链跳转，真实目的地不明。" },
    ] },

  { id: "sms6", carrier: "sms", difficulty: 3, phishing: true, scene: "高仿通知",
    meta: { phone: "1069xxxx", time: "15:42" },
    parts: [
      { t: "p", html: "【教务提示】你有一门课程的重修申请待确认，确认地址：" },
      { t: "link", id: "sms6-link", text: "http://111.230.5.14:8080/confirm" },
    ],
    redflags: [
      { category: "link_mismatch", target: "sms6-link", explain: "L3 级伪装：话术完全正常，唯一破绽是裸 IP 直连地址——正规系统不会用 IP+端口做入口。" },
    ] },

  /* ============ 链接页 ============ */
  { id: "lp1", carrier: "linkpage", difficulty: 1, phishing: true, scene: "仿登录页",
    meta: { url: "http://ejuan-clut.vip-verify.top/login", title: "统一身份认证" },
    parts: [
      { t: "field", id: "lp1-fu", text: "学号" },
      { t: "field", id: "lp1-fp", text: "密码" },
      { t: "btn", id: "lp1-btn", text: "登 录" },
    ],
    redflags: [
      { category: "domain_spoof", target: "lp1-url", explain: "地址栏域名与学校无关，vip-verify.top 是典型仿冒后缀。" },
      { category: "personal_info", target: "lp1-fp", explain: "在可疑域名页面输入密码=直接交出账号。" },
    ] },

  { id: "lp2", carrier: "linkpage", difficulty: 1, phishing: true, scene: "中奖页",
    meta: { url: "http://prize.jd-activity.top/winner", title: "恭喜中奖" },
    parts: [
      { t: "p", html: "您已获得限量礼包一份，<span class=\"sel-target\" data-el=\"lp2-rb\">价值 4999 元</span>，填写信息免费领取：" },
      { t: "field", id: "lp2-fn", text: "姓名 / 手机号" },
      { t: "field", id: "lp2-fa", text: "地址 / 身份证号" },
      { t: "btn", id: "lp2-btn", text: "立即领取" },
    ],
    redflags: [
      { category: "reward_bait", target: "lp2-rb", explain: "无来由的中奖本身就是诈骗第一信号。" },
      { category: "personal_info", target: "lp2-fa", explain: "领取奖品不需要身份证号。" },
    ] },

  { id: "lp3", carrier: "linkpage", difficulty: 2, phishing: false, scene: "校园门户（真）",
    meta: { url: "https://portal.clut-demo.edu.cn", title: "数字校园门户" },
    parts: [
      { t: "field", id: "lp3-fu", text: "统一身份认证账号" },
      { t: "field", id: "lp3-fp", text: "密码" },
      { t: "btn", id: "lp3-btn", text: "登 录" },
    ],
    redflags: [],
    legitNotes: [
      { target: "lp3-url", note: "https + 官方演示域，登录页出现在正确域名下才可信。" },
    ] },

  { id: "lp4", carrier: "linkpage", difficulty: 2, phishing: true, scene: "高仿教务",
    meta: { url: "https://jwc.chut-demo.edu.cn", title: "教务管理系统" },
    parts: [
      { t: "field", id: "lp4-f1", text: "学号" },
      { t: "field", id: "lp4-f2", text: "密码" },
      { t: "btn", id: "lp4-btn", text: "登 录" },
    ],
    redflags: [
      { category: "domain_spoof", target: "lp4-url", explain: "chut 与 clut 仅一个字母之差；页面可以做得一模一样，域名不会。" },
      { category: "personal_info", target: "lp4-f2", explain: "在高仿域名下输入密码即泄露凭据。" },
    ] },

  { id: "lp5", carrier: "linkpage", difficulty: 3, phishing: true, scene: "跳转异常",
    meta: { url: "https://lib.clut-demo.edu.cn/seat", title: "图书馆座位预约" },
    parts: [
      { t: "p", html: "当前页面为座位预约快捷入口，点击下方按钮进入预约系统：" },
      { t: "btn", id: "lp5-btn", text: "进入预约系统" },
    ],
    redflags: [
      { category: "link_mismatch", target: "lp5-btn", explain: "L3 级伪装：域名和页面都正常，唯一破绽是按钮实际跳向外部域（浏览器下方预览可见 pay-lib.vip）——对“入口正常、出口异常”保持警觉。" },
    ] },
];

/* 邮件发件人行/链接页地址栏是固定靶点：补齐 id */
SAMPLES.forEach(s => {
  if (s.carrier === "email" && s.meta.addr) s.meta.addrId = s.id + "-addr";
  if (s.carrier === "linkpage" && s.meta.url) s.meta.urlId = s.id + "-url";
});

const SAMPLE_MAP = Object.fromEntries(SAMPLES.map(s => [s.id, s]));

/* ---------- 训练战役 ---------- */
const CAMPAIGN = {
  pretest:  ["em1", "sms1", "lp3"],
  train:    ["em2", "em3", "sms2", "sms3"],
  posttest: ["sms6", "em9", "lp5"],
};

const RANKS = [
  { min: 85, name: "王者防线" }, { min: 70, name: "铂金猎渔者" },
  { min: 55, name: "黄金破话术" }, { min: 40, name: "白银查链接" },
  { min: 0,  name: "青铜识路人" },
];

/* ---------- 造浪者：伪装卡 ---------- */
const GENE_GROUPS = [
  { key: "skin", name: "伪装身份" }, { key: "psych", name: "心理话术" }, { key: "tech", name: "技术伪装" },
];

const GENES = [
  { id: "g1", group: "skin", name: "助学金通知", frag: "冒充学生资助管理中心，发“助学金补录”通知",
    det: 10, reason: "冒充资助中心的通知很常见，防线会重点核对发件域名和公文措辞",
    knowledge: "看到“官方通知”先别被格式唬住——核对发件域名和学校官网才可靠。" },
  { id: "g2", group: "skin", name: "电商退款", frag: "自称平台售后，称你的订单异常、要主动退款",
    det: 15, reason: "电商退款话术模板与真实工单的语言分布差异明显",
    knowledge: "平台退款只会原路退回；主动找你的“客服”默认可疑。" },
  { id: "g3", group: "skin", name: "导师来信", frag: "冒充导师或教务老师，用课题、报销等校内事务开场",
    det: 12, reason: "“熟人+事务”是最容易被利用的身份组合",
    knowledge: "涉及转账汇款，务必通过第二渠道（当面/官方电话）核实身份。" },
  { id: "g4", group: "psych", name: "紧迫限时", frag: "加入“30 分钟内”“逾期作废”倒计时",
    det: 15, reason: "限时施压是最高频心理开关，防线设为强特征",
    knowledge: "所有倒计时都是为了让你来不及思考——先停一分钟，再核实。" },
  { id: "g5", group: "psych", name: "利诱返利", frag: "承诺双倍赔付、返利、中奖",
    det: 20, reason: "利诱类在训练数据中与诈骗高度相关",
    knowledge: "天上掉的馅饼半径一般等于坑的半径。" },
  { id: "g6", group: "psych", name: "恐吓冻结", frag: "声称账户异常、将扣费/冻结",
    det: 18, reason: "恐吓型损失厌恶话术特征显著",
    knowledge: "真出问题，官方会给你核验渠道，而不是逼你立刻操作。" },
  { id: "g7", group: "tech", name: "仿冒域名", frag: "使用与官方一字之差的域名",
    det: 30, reason: "域名相似度检测直接命中（编辑距离=1）",
    knowledge: "把完整域名读一遍再点，一字之差即深渊。" },
  { id: "g8", group: "tech", name: "短链跳转", frag: "正文放置短链/二维码",
    det: 25, reason: "短链与二维码指向不可预览，防线一律预警",
    knowledge: "无法预览指向的入口（短链/二维码）默认按不可信处理。" },
  { id: "g9", group: "tech", name: "恶意附件", frag: "附带 .exe/.docm 等可执行或带宏附件",
    det: 35, reason: "可执行/宏附件属高危载荷，防线直接标记",
    knowledge: "让你“运行程序/启用宏”的来信，基本可以直接删了。" },
];

/* =====================================================================
   反钓鱼知识库（KB）：域 / 子类 / 学习路径 / 条目适配层
   说明：KB_ENTRIES 由下方适配函数从既有 CATEGORY_DOC / GENES / DIM_DOC /
   STOP_LOSS / ATLAS_SOURCES 生成，不复制正文，改一处全库同步。
   ===================================================================== */
const KB_META = { version: "1.0", updated: "2026-10", totalSamples: 20 };

const KB_DOMAINS = [
  { id: "recognize", name: "识别破绽", en: "RECOGNIZE", icon: "🔍", order: 1,
    desc: "先学会看：7 类最常见的钓鱼破绽，按“定义—识别—话术例—能力维度”拆开。" },
  { id: "attack", name: "攻击手法", en: "ATTACK", icon: "🎭", order: 2,
    desc: "从攻击者视角看 9 张伪装卡：身份、心理、技术三类手法，各自对应哪条防守规则。" },
  { id: "defense", name: "防御能力", en: "DEFENSE", icon: "🛡️", order: 3,
    desc: "把识别动作拆成 5 个可练习的能力维度，知道该练什么、怎么练。" },
  { id: "response", name: "应急处置", en: "RESPONSE", icon: "🚨", order: 4,
    desc: "如果真的被骗，按 4 步止损：报警止付、保留证据、修改密码、告知求助。" },
];

const KB_SUBDOMAINS = [
  { id: "skin", domain: "attack", name: "身份伪装", en: "IDENTITY", icon: "🎭", desc: "冒充学校、导师、客服等可信身份。" },
  { id: "psych", domain: "attack", name: "心理话术", en: "PSYCHOLOGY", icon: "🧠", desc: "用紧迫、利诱、恐吓推动你操作。" },
  { id: "tech", domain: "attack", name: "技术伪装", en: "TECHNIQUE", icon: "🛠️", desc: "用域名、短链、附件隐藏真实意图。" },
];

const KB_PATHS = [
  { id: "quick", name: "10 分钟入门", icon: "⏱️", minutes: 10,
    desc: "先认最常见的 4 类破绽，再学会止损。适合第一次接触反诈训练的人。",
    entryIds: ["flag/domain_spoof", "flag/link_mismatch", "flag/urgency", "flag/personal_info", "response/stop-loss"] },
  { id: "attacker", name: "攻击者视角", icon: "🎭", minutes: 15,
    desc: "9 张伪装卡 + 对应破绽：从攻击面反推防守规则。",
    entryIds: ["gene/g1", "gene/g2", "gene/g3", "gene/g4", "gene/g5", "gene/g6", "gene/g7", "gene/g8", "gene/g9",
      "flag/domain_spoof", "flag/urgency", "flag/authority", "flag/link_mismatch", "flag/reward_bait", "flag/attachment", "flag/personal_info"] },
  { id: "exam", name: "考前速查", icon: "⚡", minutes: 8,
    desc: "7 类破绽 + 止损四步，适合赛前/班会前快速过一遍。",
    entryIds: ["flag/domain_spoof", "flag/urgency", "flag/authority", "flag/link_mismatch", "flag/reward_bait", "flag/attachment", "flag/personal_info", "response/stop-loss"] },
];

const KB_RECENT = ["response/stop-loss", "flag/personal_info", "gene/g7", "dim/pressure", "flag/link_mismatch"];

/* 伪装卡 → 对应破绽（用于自动关联与学习路径） */
const KB_GENE_FLAG = {
  g1: ["personal_info", "authority"], g2: ["authority"], g3: ["authority"],
  g4: ["urgency"], g5: ["reward_bait"], g6: ["urgency"],
  g7: ["domain_spoof"], g8: ["link_mismatch"], g9: ["attachment"],
};

const KB_FLAG_META = {
  domain_spoof: { level: "入门", minutes: 3, tags: ["域名", "链接"], audience: ["大一新生", "班级演练"], sampleRefs: ["em4", "lp4", "em8", "lp1"] },
  urgency:      { level: "入门", minutes: 3, tags: ["话术", "时间压力"], audience: ["大一新生", "班级演练"], sampleRefs: ["sms4", "em8", "em1"] },
  authority:    { level: "进阶", minutes: 4, tags: ["身份", "话术"], audience: ["大一新生", "进阶学习者"], sampleRefs: ["em2", "sms2", "sms5"] },
  link_mismatch:{ level: "进阶", minutes: 4, tags: ["链接", "短链"], audience: ["大一新生", "进阶学习者"], sampleRefs: ["em5", "sms6", "em1", "lp5"] },
  reward_bait:  { level: "入门", minutes: 3, tags: ["利益", "话术"], audience: ["大一新生", "班级演练"], sampleRefs: ["sms1", "lp2"] },
  attachment:   { level: "实战", minutes: 4, tags: ["附件", "恶意文件"], audience: ["进阶学习者", "班级演练"], sampleRefs: ["em2", "em7"] },
  personal_info:{ level: "入门", minutes: 3, tags: ["个人信息", "验证码"], audience: ["大一新生", "班级演练"], sampleRefs: ["em2", "em7", "lp1"] },
};

/* 7 类破绽的“为什么危险”：用于条目页的独立小节，避免和话术例说明重复 */
const KB_FLAG_RISK = {
  domain_spoof: "域名是发件人和网站身份的最后一道可核对凭据；仿冒域名会让抬头、页面和公文格式看起来都像真的。",
  urgency: "时间压力会让人跳过核实步骤，直接按对方指令点击、填写或转账。",
  authority: "权威身份让人默认“不会骗我”，从而忽略域名、渠道和转账对象是否真的属于该机构。",
  link_mismatch: "入口看起来正常，真正的去向却被隐藏在短链、二维码或长域名末尾。",
  reward_bait: "利益预期会压过风险判断，尤其是“先垫付、后返利”的结构，先用小利建立信任，再收割本金。",
  attachment: "附件一旦运行，可能在后台安装程序、窃取凭据或加密文件，且用户往往以为只是“打开一个文档”。",
  personal_info: "密码、验证码、证件号一旦交出，账号和资金可能被直接接管，后续还可能被用于二次诈骗。",
};

/* 条目摘要：与正文小节区分，避免条目页标题下与“一句话定义”重复 */
const KB_FLAG_SUMMARY = {
  domain_spoof: "用相似域名伪装成官方发件人或网站。",
  urgency: "用倒计时和停用威胁压缩你的核实时间。",
  authority: "假冒学校、导师、客服等可信身份。",
  link_mismatch: "用短链、二维码或长域名隐藏真实去向。",
  reward_bait: "用奖助学金、退款、返利等利益诱导操作。",
  attachment: "用可执行或带宏附件投递恶意程序。",
  personal_info: "以核验、退款、报名为名索要敏感信息。",
};
const KB_GENE_SUMMARY = {
  g1: "冒充资助中心，诱导你点链接或交信息。",
  g2: "冒充平台售后，以订单异常、主动退款为由套取信息。",
  g3: "冒充导师或教务老师，用校内事务开场。",
  g4: "用“30 分钟内”“逾期作废”制造时间压力。",
  g5: "用双倍赔付、返利、中奖等利益诱导操作。",
  g6: "用账户异常、扣费、冻结等恐吓推动操作。",
  g7: "用与官方一字之差的域名伪装可信入口。",
  g8: "用短链或二维码隐藏真实去向。",
  g9: "用 .exe / .docm 等附件投递恶意载荷。",
};
const KB_DIM_SUMMARY = {
  domain: "核对发件域名与链接域名是否一致。",
  psych: "识别紧迫、利诱、恐吓、冒充身份等话术。",
  link: "判断链接的真实去向。",
  attach: "判断附件的类型与来源。",
  pressure: "在倒计时和损失威胁下保持稳定。",
};

/* 7 类破绽的常见误区：均为教学归纳，不冒充真实统计 */
const KB_FLAG_MISCONCEPTION = {
  domain_spoof: "只看邮箱开头是不是学校名字，不读完整域名；或者把“页面做得像”当成“域名是真的”。",
  urgency: "把倒计时当成真实截止时间，先操作再核实；越急越容易跳过官方渠道。",
  authority: "看到公章、抬头、头像就默认对方是官方；这些都可以伪造，域名和线下渠道才难伪造。",
  link_mismatch: "只看链接文字，不悬停看真实地址；或者以为 https 就代表安全。",
  reward_bait: "觉得“先垫小钱没关系，返利到账就收手”；骗子通常会在小额返利后提高门槛。",
  attachment: "认为 .docm 和 .docx 一样安全，直接启用宏；宏本身就是可执行代码的入口。",
  personal_info: "认为“验证码只要不告诉别人就行”，把它填进陌生网页；网页表单同样会把它交出去。",
};

const KB_GENE_META = {
  skin:  { level: "进阶", minutes: 2, tags: ["身份伪装", "伪装卡"], audience: ["进阶学习者", "班级演练"], color: "#7fb4ff" },
  psych: { level: "进阶", minutes: 2, tags: ["心理话术", "伪装卡"], audience: ["进阶学习者", "班级演练"], color: "#ff5470" },
  tech:  { level: "进阶", minutes: 2, tags: ["技术伪装", "伪装卡"], audience: ["进阶学习者", "班级演练"], color: "#35e0c8" },
};

const KB_DIM_META = {
  domain:   { level: "入门", minutes: 4, tags: ["域名", "能力模型"], audience: ["大一新生", "教师"] },
  psych:    { level: "入门", minutes: 4, tags: ["话术", "能力模型"], audience: ["大一新生", "教师"] },
  link:     { level: "入门", minutes: 4, tags: ["链接", "能力模型"], audience: ["大一新生", "教师"] },
  attach:   { level: "入门", minutes: 4, tags: ["附件", "能力模型"], audience: ["大一新生", "教师"] },
  pressure: { level: "入门", minutes: 4, tags: ["抗压", "能力模型"], audience: ["大一新生", "教师"] },
};

const KB_STOP_META = { level: "入门", minutes: 3, tags: ["应急处置", "止损"], audience: ["大一新生", "教师"], color: "#ff5470" };

const KB_GENE_FLAG_REVERSE = Object.fromEntries(Object.keys(CATEGORY_DOC).map((k) => [k, []]));
Object.keys(KB_GENE_FLAG).forEach((gid) => {
  KB_GENE_FLAG[gid].forEach((flag) => {
    if (KB_GENE_FLAG_REVERSE[flag]) KB_GENE_FLAG_REVERSE[flag].push(gid);
  });
});

function kbId(type, key) { return type + "/" + key; }

function kbFlagEntry(key) {
  const d = CATEGORY_DOC[key];
  const meta = KB_FLAG_META[key] || {};
  const dim = DIMENSIONS.find((x) => x.key === d.dim);
  const dimDoc = DIM_DOC[d.dim] || {};
  const related = [kbId("dim", d.dim)].concat((KB_GENE_FLAG_REVERSE[key] || []).map((g) => kbId("gene", g)));
  return {
    id: kbId("flag", key), type: "flag", key, domain: "recognize", subdomain: null,
    title: d.name, subtitle: d.en, accent: d.color,
    level: meta.level || "入门", audience: meta.audience || ["大一新生"], minutes: meta.minutes || 3,
    tags: meta.tags || [], summary: KB_FLAG_SUMMARY[key] || d.def,
    sections: [
      { id: "def", title: "一句话定义", body: d.def },
      { id: "risk", title: "为什么危险", body: KB_FLAG_RISK[key] || d.exampleNote },
      { id: "cue", title: "一眼识别", body: d.cue },
      { id: "example", title: "真实话术例 · 教学改写", body: d.example, note: d.exampleNote },
      { id: "dim", title: "对应能力维度", body: (dim ? dim.name : "") + "：" + (dimDoc.desc || "") },
    ],
    keyPoints: [d.cue],
    examples: [{ text: d.example, note: d.exampleNote }],
    misconceptions: KB_FLAG_MISCONCEPTION[key] ? [KB_FLAG_MISCONCEPTION[key]] : [],
    related,
    sampleRefs: meta.sampleRefs || [],
    sources: [d.source],
    updated: KB_META.updated,
  };
}

function kbGeneEntry(gene) {
  const group = GENE_GROUPS.find((g) => g.key === gene.group) || { name: "伪装卡" };
  const meta = KB_GENE_META[gene.group] || {};
  const flags = KB_GENE_FLAG[gene.id] || [];
  const dims = [...new Set(flags.map((f) => DIM_OF_CATEGORY[f]).filter(Boolean))];
  return {
    id: kbId("gene", gene.id), type: "gene", key: gene.id, domain: "attack", subdomain: gene.group,
    title: gene.name, subtitle: group.name + " · 伪装卡", accent: meta.color || "#35e0c8",
    level: meta.level || "进阶", audience: meta.audience || ["进阶学习者"], minutes: meta.minutes || 2,
    tags: meta.tags || [group.name], summary: KB_GENE_SUMMARY[gene.id] || gene.frag,
    sections: [
      { id: "attack", title: "攻击者会怎么做", body: gene.frag },
      { id: "defense", title: "防线为什么能识破", body: gene.reason },
      { id: "remember", title: "你该记住", body: gene.knowledge },
    ],
    keyPoints: [gene.knowledge],
    examples: [],
    misconceptions: [],
    related: flags.map((f) => kbId("flag", f)).concat(dims.map((d) => kbId("dim", d))),
    sampleRefs: [],
    sources: ["本作品「造浪者」伪装卡（虚构教学样本）；仅用于防守教学。"],
    updated: KB_META.updated,
  };
}

function kbDimEntry(key) {
  const dim = DIMENSIONS.find((x) => x.key === key) || { name: key };
  const doc = DIM_DOC[key] || {};
  const meta = KB_DIM_META[key] || {};
  const flags = Object.keys(CATEGORY_DOC).filter((k) => DIM_OF_CATEGORY[k] === key);
  return {
    id: kbId("dim", key), type: "dim", key, domain: "defense", subdomain: null,
    title: dim.name, subtitle: doc.en || key.toUpperCase(), accent: "#7fb4ff",
    level: meta.level || "入门", audience: meta.audience || ["大一新生"], minutes: meta.minutes || 4,
    tags: meta.tags || ["能力模型"], summary: KB_DIM_SUMMARY[key] || doc.desc || "",
    sections: [
      { id: "def", title: "定义", body: doc.desc || "" },
      { id: "train", title: "练习动作", body: doc.train || "" },
      { id: "flags", title: "关联破绽", body: flags.map((f) => CATEGORY_NAME[f]).join("、") },
    ],
    keyPoints: [doc.train || ""].filter(Boolean),
    examples: [],
    misconceptions: [],
    related: flags.map((f) => kbId("flag", f)),
    sampleRefs: [],
    sources: ["本作品五维能力模型；参考国家反诈中心公开宣传。"],
    updated: KB_META.updated,
  };
}

function kbStopEntry() {
  const meta = KB_STOP_META;
  return {
    id: "response/stop-loss", type: "response", key: "stop-loss", domain: "response", subdomain: null,
    title: "被骗后的 4 步止损", subtitle: "STOP LOSS", accent: meta.color,
    level: meta.level, audience: meta.audience, minutes: meta.minutes,
    tags: meta.tags, summary: "报警止付、保留证据、修改密码、告知求助。",
    sections: STOP_LOSS.map((s, i) => ({ id: "step-" + (i + 1), title: "第 " + (i + 1) + " 步 · " + s.t, body: s.d })),
    keyPoints: STOP_LOSS.map((s) => s.t),
    examples: [],
    misconceptions: [],
    related: [],
    sampleRefs: [],
    sources: ATLAS_SOURCES.map((s) => s.t).concat(["本页不替代报警、银行止付与法律咨询。"]),
    updated: KB_META.updated,
  };
}

const KB_ENTRIES = []
  .concat(Object.keys(CATEGORY_DOC).map(kbFlagEntry))
  .concat(GENES.map(kbGeneEntry))
  .concat(DIMENSIONS.map((d) => kbDimEntry(d.key)))
  .concat([kbStopEntry()]);

const KB_ENTRY_MAP = Object.fromEntries(KB_ENTRIES.map((e) => [e.id, e]));
const KB_DOMAIN_MAP = Object.fromEntries(KB_DOMAINS.map((d) => [d.id, d]));
const KB_SUBDOMAIN_MAP = Object.fromEntries(KB_SUBDOMAINS.map((s) => [s.id, s]));
const KB_PATH_MAP = Object.fromEntries(KB_PATHS.map((p) => [p.id, p]));

function kbEntriesOfDomain(domain, subdomain) {
  return KB_ENTRIES.filter((e) => e.domain === domain && (!subdomain || e.subdomain === subdomain));
}

