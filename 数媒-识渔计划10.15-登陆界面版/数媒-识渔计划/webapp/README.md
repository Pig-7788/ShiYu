# 识渔计划 SHIYU · Web 前端（v3 游戏版）

反钓鱼攻防训练 H5 游戏：**拦截战**（拖拽分拣）+ **拆解台**（证物归类）+ **造浪者组装实验室**（拖卡调参/自由撰写）+ **AI 蓝军安全官**（打字机点评、语音、追问）。纯静态实现，零后端、零外部依赖、离线可运行，进度存 localStorage。

## 快速启动

- **Windows**：双击项目根目录 `启动识渔计划.bat`（它把服务指向 `webapp/` 目录，**不要**把服务指向项目根，否则会暴露目录列表）
- **任意系统**：
  ```bash
  cd webapp
  python -m http.server 8765      # 或 npx serve / 任意静态服务器
  # 浏览器访问 http://127.0.0.1:8765（建议手机竖屏或浏览器开发者工具移动视口）
  ```
- 打开后先**登录或注册**：注册只需用户名+密码（≥6 位）；管理员账号见根目录 `管理员账号.md`（登录后首页会多出「数据观测台」入口）。
- **部署**：整目录上传任意静态托管（校园服务器 / GitHub Pages / 对象存储），入口 `index.html`，建议 HTTPS，**且只发布 `webapp/` 这一层**（`config.js` 在前端，别把上层资料一起发布）。

## 文件结构

| 文件 | 职责 |
|---|---|
| `index.html` | 页面骨架：登录/注册遮罩 + 首页 / 拦截战(v-game) / 报告 / 造浪者(v-attack) / 画像 / **管理台(v-admin)** / 关于 |
| `styles.css` | 深色科技风全部样式；拖拽/槽位高亮/扫描束/连击弹字等动效关键帧；登录页与管理台样式 |
| `data.js` | **数据层**：20 个虚构样本（含破绽标注）、战役波次编排、9 张基因卡、五维/类别常量 |
| `auth.js` | **账号体系**：注册/登录/会话/角色、纯 JS SHA-256（局域网 http 下 `crypto.subtle` 不可用）、5 个管理员账号种子、存档键 `AKEY()` 按账号隔离 |
| `app.js` | **逻辑层**：拦截战状态机、拆解台拖放、组装实验室（滑杆+预测仪+扫描束）、安全官（TTS/打字机）、雷达图、本地存档 |
| `agent.js` / `config.js` | AI 智能体「渔安」：云端配置（Key 混淆存储）与 OpenAI 兼容流式对话封装（`Agent.cloudChat`，`noHist` 参数供分析类单发调用） |
| `analyst.js` | **AI 训练诊断**：把段位/五维/漏判分布/错题本打包成快照 → 大模型流式出具个性化诊断（报告页 + 画像页）；按 `report.at` 缓存，云端不可用回落规则版诊断 |
| `admin.js` | **数据观测台（管理员）**：KPI 看板 + 训练成效折线图 + 破绽漏判环形图；题库编辑（含靶点校验）、波次编排、账号管理（改密/删除/新增）、JSON/CSV 导出导入 |

## 核心模块速览（app.js）

- `startGame()/nextCard()/sortCard()` —— 拦截战：发牌、限时、拖拽/键盘分拣、连击与血量结算
- `startDismantle()/bindChipDrag()/finishDismantle()` —— 拆解台：证物生成、指针坐标命中槽位、首放命中/试错计分、判定与讲解
- `renderAttack()/bindGeneDrag()/launchAttack()/launchFreeAttack()` —— 实验室：拖卡装配、滑杆实时改预测仪（±误差）、投放噪声结算、扫描束动画；自由撰写规则引擎（`FREE_RULES`）
- `Officer` —— 安全官：逐条打字机气泡 + Web Speech 语音 + 快捷追问（`OFFICER_QA`，本地知识库回答）
- `SFX` —— WebAudio 合成音效（拾取/命中/警报/连击），无音频文件
- `drawRadar()/finishGame()/renderReport()` —— 五维画像与前后测报告
- `Analyst`（analyst.js）—— AI 训练诊断：训练数据快照 → 云端流式出具「总评 / 薄弱分析 / 训练处方 / 提醒」；报告页与画像页共用一套缓存，`AI_DIAG_SYS` 为提示词

## 数据结构（data.js）
样本 Schema（后端化时题库表结构同构）：

```jsonc
{
  "id": "em1", "carrier": "email|sms|linkpage", "difficulty": 1-3,
  "phishing": true, "scene": "场景名",
  "meta": { "from/addr/subj/time" | "phone/time" | "url/title" },
  "parts": [ { "t": "p|link|attach|qr|btn|field", "id": "靶点id", "text|html": "…" } ],
  "redflags": [ { "category": "7类之一", "target": "parts.id", "explain": "讲解文案" } ],
  "legitNotes": [ { "target": "…", "note": "正常样本的教学说明" } ]
}
```

## 如何扩展

- **加样本**：①（推荐）用管理员账号进「数据观测台 → 题库编辑」按同 Schema 追加，点校验+保存后**立即生效**并自动进入每日挑战；② 直接改 `data.js` 的 `SAMPLES`，并把 id 编入 `app.js` 顶部的 `WAVES`（默认四波；管理员存过 `shiyu_waves` 则以管理员编排为准）。靶点 id 必须与 `redflags.target` 一致（可跑 `node tools/validate_data.js` 核对）。
- **改波次**：管理员控制台「波次编排」改 4 波题序，保存即生效（第 1 波＝前测、第 4 波＝后测）。
- **加检测规则**：`FREE_RULES` 追加 `{k, name, cls, det, re, know}` 即同时生效于自由撰写与复盘。
- **换/接大模型**：`Officer.play(script)` 的 script 与 `OFFICER_QA[*].a()` 是唯一话术出口——替换为后端流式接口即可，前端打字机与 TTS 复用；`launchAttack` 的检出公式可替换为服务端分类器。
- **调 AI 训练诊断**：编辑 `analyst.js` 顶部 `AI_DIAG_SYS`（输出格式与约束）和 `snapshot()`（喂给模型的数据字段）；缓存键 `LS_CACHE`，按 `report.at` 世代失效；本地联调可用 `scripts/mock_llm.py`（会识别“训练教练”系统提示词并回显快照数字）。
- **音效/语音开关**：右上 `🔊`（localStorage `shiyu_voice`）。

## 账号与存储

- **账号**：演示级本机鉴权（`auth.js`）。密码不存明文，每账号独立 salt + `SHA-256(salt:密码:salt)`；管理员角色为 `role=admin`，首页多出数据观测台入口。
- **存档键**：训练数据按账号隔离 —— `shiyu_v3@用户名` / `shiyu_wrong@…` / `shiyu_daily@…` / `shiyu_ai_diag@…`（统一由 `AKEY()` 生成）；题库与波次为全站共享：`shiyu_bank` / `shiyu_waves`。
- **注意**：清缓存/换浏览器即丢失，迁移用管理台「导出全量 JSON」+「覆盖导入」；正式部署必须换成服务端鉴权（开发文档 §7）。

## 合规要点（内建）

全部样本虚构（域名/人名/链接均为演示虚构，不产生真实跳转）；无发送能力；界面“教学模拟”水印；免登录匿名、数据仅存本地；高发骗术类型参考国家反诈中心公开宣传。参赛提交时按当届要求附《AI 工具使用说明》（模板见根目录申报书第七章）。

## 已知限制 / Roadmap

- 题库 20 题（精标），“每日挑战”动态出题需后端 LLM 管线（见开发文档 §7）
- 判分为规则引擎，后端化后替换为自建数据集训练的分类器（评测表方案见开发文档 §9）
- 语音为浏览器本地 TTS，音色依系统而定；可换云端音色
