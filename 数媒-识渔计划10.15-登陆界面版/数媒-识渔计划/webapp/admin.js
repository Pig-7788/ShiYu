/* ============ 识渔计划 · 数据观测台（管理员控制台）v1 ============
 * 入口：首页「数据观测台 · 管理员」（仅 role=admin 可见）
 * 能力：① 训练数据看板（KPI + 两张分析图）② 题库编辑（自定义题目，全站生效）
 *       ③ 波次编排（4 波题序，覆盖内置 WAVES）④ 账号管理 ⑤ 数据导出 / 导入
 * 存储：shiyu_bank / shiyu_waves 为全局共享（全站生效）；学员数据按账号隔离（AKEY）
 */
"use strict";

const CAT_COLOR = {
  domain_spoof: "#35E0C8", link_mismatch: "#4D9EFF", personal_info: "#FF5470",
  urgency: "#FFB84D", authority: "#A78BFA", attachment: "#F472B6", reward_bait: "#7CE38B",
};

/* ---------- 数据层：题库 / 波次 / 账号数据聚合 ---------- */
const AdminData = {
  BANK: "shiyu_bank",
  WAVES_KEY: "shiyu_waves",

  raw(key, dft) { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? dft : v; } catch (e) { return dft; } },
  put(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} },

  custom() { const b = this.raw(this.BANK, []); return Array.isArray(b) ? b : []; },
  saveCustom(list) { this.put(this.BANK, list); },
  builtin() { return (typeof SAMPLES !== "undefined" ? SAMPLES : []).filter((s) => !s.__custom); },

  /* 把自定义题目并进运行时题库（每日挑战自动抽到；编入波次后也会进拦截战）
     先撤掉上一轮并入的自定义题，保证「改题」也能立即生效，无需刷新页面 */
  applyBank() {
    if (typeof SAMPLES === "undefined") return 0;
    for (let i = SAMPLES.length - 1; i >= 0; i--) {
      if (SAMPLES[i] && SAMPLES[i].__custom) {
        if (typeof SAMPLE_MAP !== "undefined") delete SAMPLE_MAP[SAMPLES[i].id];
        SAMPLES.splice(i, 1);
      }
    }
    const list = this.custom(); let n = 0;
    list.forEach((s) => {
      if (!s || !s.id || (typeof SAMPLE_MAP !== "undefined" && SAMPLE_MAP[s.id])) return;
      s.__custom = true; SAMPLES.push(s);
      if (typeof SAMPLE_MAP !== "undefined") SAMPLE_MAP[s.id] = s;
      n++;
    });
    return n;
  },

  allIds() {
    const ids = {};
    this.builtin().forEach((s) => { ids[s.id] = true; });
    this.custom().forEach((s) => { if (s && s.id) ids[s.id] = true; });
    return ids;
  },

  waves() {
    const w = this.raw(this.WAVES_KEY, null);
    if (!Array.isArray(w) || w.length !== 4) return null;
    const ids = this.allIds();
    const ok = w.every((x) => x && Array.isArray(x.ids) && x.ids.length && x.ids.every((i) => ids[i]));
    return ok ? w : null;
  },
  saveWaves(w) { this.put(this.WAVES_KEY, w); },
  defaultWaves() {
    return (typeof WAVES !== "undefined" ? WAVES : []).map((w) => ({ name: w.name, ids: w.ids.slice(), reveal: !!w.reveal }));
  },

  /* 题目校验：返回 {ok, errors[], clean} —— 与 data.js 的 Schema 同构 */
  validateBank(list) {
    const errors = [], clean = [];
    if (!Array.isArray(list)) return { ok: false, errors: ["顶层必须是数组 [ …题目… ]"], clean: [] };
    const builtin = {};
    (typeof SAMPLES !== "undefined" ? SAMPLES : []).forEach((s) => { if (!s.__custom) builtin[s.id] = true; });
    const seen = {};
    list.forEach((raw, i) => {
      const at = "第 " + (i + 1) + " 题";
      if (!raw || typeof raw !== "object") { errors.push(at + "：不是对象"); return; }
      const s = JSON.parse(JSON.stringify(raw));
      Object.keys(s).forEach((k) => { if (k[0] === "_") delete s[k]; });
      if (!s.id || !/^[a-z0-9_-]{2,20}$/i.test(s.id)) { errors.push(at + "：id 缺失或非法（2–20 位字母数字_-）"); return; }
      if (builtin[s.id]) { errors.push(at + "：id「" + s.id + "」与内置题目重复，请换一个（如 " + s.id + "-v2）"); return; }
      if (seen[s.id]) { errors.push(at + "：id「" + s.id + "」在自定义题库里重复"); return; }
      seen[s.id] = true;
      if (!["email", "sms", "linkpage"].includes(s.carrier)) { errors.push(at + "：carrier 必须是 email / sms / linkpage"); return; }
      if (![1, 2, 3].includes(s.difficulty)) errors.push(at + "：difficulty 必须是 1 / 2 / 3（决定限时 12/9/7 秒）");
      if (typeof s.phishing !== "boolean") { errors.push(at + "：phishing 必须是 true / false"); return; }
      if (!s.scene) errors.push(at + "：缺少 scene（场景名）");
      s.meta = s.meta || {};
      s.parts = Array.isArray(s.parts) ? s.parts : [];
      s.redflags = Array.isArray(s.redflags) ? s.redflags : [];
      s.legitNotes = Array.isArray(s.legitNotes) ? s.legitNotes : [];
      s.parts.forEach((p) => { if (p && p._) delete p._; });
      s.redflags.forEach((r) => { if (r && r._) delete r._; });
      if (s.carrier === "email" && !(s.meta.from && s.meta.addr && s.meta.subj)) errors.push(at + "：邮件需要 meta.from / meta.addr / meta.subj");
      if (s.carrier === "sms" && !s.meta.phone) errors.push(at + "：短信需要 meta.phone");
      if (s.carrier === "linkpage" && !(s.meta.url && s.meta.title)) errors.push(at + "：网页需要 meta.url / meta.title");
      if (s.phishing && !s.redflags.length) errors.push(at + "：钓鱼样本至少要 1 条 redflags（破绽标注）");
      if (!s.phishing && !s.legitNotes.length) errors.push(at + "：正常样本至少要 1 条 legitNotes（讲解）");
      const avail = {};
      if (s.carrier === "email" && s.meta.addr) avail[s.id + "-addr"] = true;
      if (s.carrier === "linkpage" && s.meta.url) avail[s.id + "-url"] = true;
      s.parts.forEach((p) => {
        if (p && p.id) avail[p.id] = true;
        if (p && p.html) [...String(p.html).matchAll(/data-el="([^"]+)"/g)].forEach((m) => { avail[m[1]] = true; });
      });
      s.redflags.forEach((r, k) => {
        if (!r || !r.category) { errors.push(at + "：redflags[" + k + "] 缺 category"); return; }
        if (typeof CATEGORY_NAME !== "undefined" && !CATEGORY_NAME[r.category]) {
          errors.push(at + "：redflags[" + k + "].category「" + r.category + "」不在 7 类破绽里（" + Object.keys(CATEGORY_NAME).join("/") + "）");
        }
        if (!r.target) errors.push(at + "：redflags[" + k + "] 缺 target");
        else if (!avail[r.target]) errors.push(at + "：redflags[" + k + "].target「" + r.target + "」找不到对应靶点（要用 parts[].id 或 parts[].html 里 data-el 的 id；也可写 " + s.id + "-addr / " + s.id + "-url）");
        if (!r.explain) errors.push(at + "：redflags[" + k + "] 缺 explain（讲解文案）");
      });
      s.legitNotes.forEach((n, k) => {
        if (n && n.target && !avail[n.target]) errors.push(at + "：legitNotes[" + k + "].target「" + n.target + "」找不到对应靶点");
      });
      clean.push(s);
    });
    return { ok: errors.length === 0, errors, clean };
  },

  template() {
    return [{
      _说明: "以 _ 开头的字段只是注释，保存时会被自动丢弃；id 不能与内置 20 题重复",
      id: "cust1", carrier: "sms", difficulty: 2, phishing: true, scene: "选课系统缴费",
      meta: { phone: "106-9xxx-8888", time: "今天 09:12" },
      parts: [
        { t: "p", html: "教务处通知：你的选课费尚未缴纳，<b data-el=\"cust1-urg\">请在 20 分钟内完成缴费</b>，逾期视为放弃。" },
        { t: "link", id: "cust1-link", text: "jw-cust-pay.top/pay" },
      ],
      redflags: [
        { category: "urgency", target: "cust1-urg", explain: "用 20 分钟倒计时压缩你的核实时间——真实教务不会用短信限时收费。" },
        { category: "link_mismatch", target: "cust1-link", explain: "学校缴费只在官方平台内完成，短信里的短域名是仿冒入口。" },
      ],
      legitNotes: [],
    }];
  },

  /* 聚合全部账号的训练数据（看板数据源） */
  collect() {
    return Auth.list().map((u) => {
      const rec = AdminData.raw(AKEY("v3", u.u), null) || {};
      const wb = AdminData.raw(AKEY("wrong", u.u), null) || {};
      const r = rec.report || null;
      return {
        u: u.u, nick: u.nick || u.u, role: u.role, created: u.created || 0, last: u.last || 0,
        report: r, missCat: rec.missCat || {}, wrongN: Object.keys(wb).length,
      };
    });
  },
};

/* ---------- 视图层 ---------- */
const AdminUI = {
  inited: false,
  el(id) { return document.getElementById(id); },
  num(v, d) { return v == null ? (d == null ? "--" : d) : v; },

  render() {
    if (!Auth.isAdmin()) { show("home"); return; }
    if (!this.inited) { this.bind(); this.inited = true; }
    this.dashboard();
    this.renderBank();
    this.renderWaves();
    this.renderUsers();
  },

  /* ===== ① 看板：KPI + 两张分析图 ===== */
  dashboard() {
    const rows = AdminData.collect();
    const done = rows.filter((x) => x.report);
    const posts = done.map((x) => x.report.post).filter((v) => typeof v === "number");
    const pres = done.map((x) => x.report.pre).filter((v) => typeof v === "number");
    const avg = (a) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null);
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const bankN = AdminData.builtin().length + AdminData.custom().length;
    const kpi = [
      ["注册账号", rows.length, "含管理员 " + rows.filter((x) => x.role === "admin").length + " 个"],
      ["完成训练", done.length, "完成率 " + (rows.length ? Math.round((done.length / rows.length) * 100) : 0) + "%"],
      ["平均后测识别率", this.num(avg(posts), "--") + "%", "前测均值 " + this.num(avg(pres), "--") + "%"],
      ["今日活跃", rows.filter((x) => x.last >= today0.getTime()).length, "按最近登录统计"],
      ["平均综合分", this.num(avg(done.map((x) => x.report.avg).filter((v) => typeof v === "number")), "--"), "五维均分 / 100"],
      ["题库题量", bankN, "内置 " + AdminData.builtin().length + " + 自定义 " + AdminData.custom().length],
    ];
    this.el("ad-kpis").innerHTML = kpi.map(([k, v, s]) =>
      '<div class="kpi"><div class="kpi-v">' + v + '</div><div class="kpi-k">' + k + '</div><div class="kpi-s">' + s + "</div></div>").join("");

    const missAgg = {};
    done.forEach((x) => Object.keys(x.missCat).forEach((c) => { missAgg[c] = (missAgg[c] || 0) + x.missCat[c]; }));
    this.lineChart(this.el("ad-chart-line"), done);
    this.donutChart(this.el("ad-chart-donut"), missAgg);
    this.el("ad-data-note").textContent = done.length
      ? "数据源：本机浏览器内 " + done.length + " 个账号的最近一轮训练存档（实时读取，不联网）"
      : "暂无训练数据——新建账号打完一轮「拦截战」后，这里会自动出现统计";
  },

  reset2d(cv, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(280, cv.parentElement.clientWidth - 4);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = "100%"; cv.style.height = h + "px";
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    return { c, w, h };
  },

  /* 图一：前测 → 后测 识别率折线图（按学员，含群体均值参考线） */
  lineChart(cv, rows) {
    if (!cv) return;
    const { c, w, h } = this.reset2d(cv, 264);
    const L = 40, R = 14, T = 22, B = 54;
    const pw = w - L - R, ph = h - T - B;
    const y = (v) => T + ph - (Math.max(0, Math.min(100, v)) / 100) * ph;
    c.font = "10px sans-serif"; c.textBaseline = "middle";
    for (let v = 0; v <= 100; v += 25) {                       // 网格 + y 轴刻度
      c.beginPath(); c.moveTo(L, y(v)); c.lineTo(L + pw, y(v));
      c.strokeStyle = "rgba(120,150,190,.16)"; c.stroke();
      c.fillStyle = "#7E8FA8"; c.textAlign = "right";
      c.fillText(v + "%", L - 6, y(v));
    }
    c.strokeStyle = "rgba(120,150,190,.35)"; c.beginPath();
    c.moveTo(L, T); c.lineTo(L, T + ph); c.lineTo(L + pw, T + ph); c.stroke();

    const data = rows.slice().sort((a, b) => (b.report.post || 0) - (a.report.post || 0)).slice(0, 8);
    if (!data.length) {
      c.fillStyle = "#7E8FA8"; c.textAlign = "center"; c.font = "12px sans-serif";
      c.fillText("暂无训练数据：完成一轮拦截战后自动生成", L + pw / 2, T + ph / 2);
      this.el("ad-legend-line").innerHTML = "";
      return;
    }
    const step = pw / Math.max(1, data.length);
    const x = (i) => L + step * i + step / 2;
    const line = (vals, color, dash, dots) => {
      c.setLineDash(dash || []); c.strokeStyle = color; c.lineWidth = 2; c.beginPath();
      vals.forEach((v, i) => { i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v)); });
      c.stroke(); c.setLineDash([]);
      if (dots !== false) vals.forEach((v, i) => {
        c.beginPath(); c.arc(x(i), y(v), 3.2, 0, 7); c.fillStyle = color; c.fill();
        c.fillStyle = "#C9D6E8"; c.font = "9px sans-serif"; c.textAlign = "center";
        c.fillText(v, x(i), y(v) - 11);
      });
    };
    const pre = Math.round(data.reduce((s, d) => s + (d.report.pre || 0), 0) / data.length);
    const post = Math.round(data.reduce((s, d) => s + (d.report.post || 0), 0) / data.length);
    line(data.map((d) => d.report.pre || 0), "#7E8FA8", [4, 4]);
    line(data.map((d) => d.report.post || 0), "#35E0C8");
    c.setLineDash([6, 5]); c.strokeStyle = "#FFB84D"; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(L, y(post)); c.lineTo(L + pw, y(post)); c.stroke(); c.setLineDash([]);
    c.fillStyle = "#FFB84D"; c.textAlign = "left"; c.font = "bold 10px sans-serif";
    c.fillText("均值 " + post + "%", L + 3, y(post) - 8);
    c.fillStyle = "#7E8FA8"; c.font = "9.5px sans-serif"; c.textAlign = "center";
    data.forEach((d, i) => c.fillText(d.nick.slice(0, 6), x(i), T + ph + 14));
    c.fillText("学员（按后测识别率排序）", L + pw / 2, T + ph + 36);
    this.el("ad-legend-line").innerHTML =
      '<span><i style="background:#7E8FA8"></i>前测识别率 ' + pre + '%</span>' +
      '<span><i style="background:#35E0C8"></i>后测识别率 ' + post + '%</span>' +
      '<span><i style="background:#FFB84D"></i>群体均值 ' + post + '%</span>' +
      '<span class="lg-up">平均提升 ' + (post - pre >= 0 ? "+" : "") + (post - pre) + " 个百分点</span>";
  },

  /* 图二：破绽漏判分布环形图 */
  donutChart(cv, agg) {
    if (!cv) return;
    const { c, w, h } = this.reset2d(cv, 250);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 12, r0 = R * 0.62;
    const items = Object.keys(agg).map((k) => ({ k, n: agg[k] })).sort((a, b) => b.n - a.n);
    const total = items.reduce((s, i) => s + i.n, 0);
    if (!total) {
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.arc(cx, cy, r0, 0, 7, true);
      c.fillStyle = "rgba(120,150,190,.12)"; c.fill();
      c.fillStyle = "#7E8FA8"; c.font = "12px sans-serif"; c.textAlign = "center";
      c.fillText("暂无漏判数据", cx, cy - 6);
      c.font = "10px sans-serif"; c.fillText("拆解台试错后自动记录", cx, cy + 12);
      this.el("ad-legend-donut").innerHTML = "";
      return;
    }
    let a0 = -Math.PI / 2;
    items.forEach((it) => {
      const a1 = a0 + (it.n / total) * Math.PI * 2;
      c.beginPath(); c.arc(cx, cy, R, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath();
      c.fillStyle = CAT_COLOR[it.k] || "#5B6B82"; c.fill();
      c.strokeStyle = "rgba(7,11,20,.9)"; c.lineWidth = 1.5; c.stroke();
      a0 = a1;
    });
    c.fillStyle = "#fff"; c.font = "bold 22px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(total, cx, cy - 6);
    c.fillStyle = "#7E8FA8"; c.font = "10px sans-serif";
    c.fillText("漏判总次数", cx, cy + 14);
    this.el("ad-legend-donut").innerHTML = items.map((it) =>
      '<span><i style="background:' + (CAT_COLOR[it.k] || "#5B6B82") + '"></i>' +
      (CATEGORY_NAME[it.k] || (DIMENSIONS.find((d) => d.key === it.k) || {}).name || it.k) +
      " <b>" + it.n + "</b> 次 · " + Math.round((it.n / total) * 100) + "%</span>").join("");
  },

  /* ===== ② 题库编辑 ===== */
  renderBank() {
    const n = AdminData.custom().length;
    this.el("ad-bank-count").textContent = "内置 " + AdminData.builtin().length + " 题 · 自定义 " + n + " 题";
    if (!this.el("ad-bank-text").value) this.el("ad-bank-text").value = JSON.stringify(AdminData.custom(), null, 2);
    this.bankMsg(n ? "已载入本机自定义题库 " + n + " 题" : "本机暂无自定义题目，可点「插入模板」照着加", "ok");
  },
  bankMsg(t, kind) {
    const m = this.el("ad-bank-msg");
    m.textContent = t || "";
    m.className = "ad-msg" + (kind ? " " + kind : "");
  },
  parseBank() {
    try { return { ok: true, list: JSON.parse(this.el("ad-bank-text").value || "[]") }; }
    catch (e) { return { ok: false, msg: "JSON 语法错误：" + e.message }; }
  },
  checkBank(silent) {
    const p = this.parseBank();
    if (!p.ok) { this.bankMsg(p.msg, "bad"); return null; }
    const v = AdminData.validateBank(p.list);
    if (!v.ok) { this.bankMsg("校验未通过（" + v.errors.length + " 处）：\n· " + v.errors.slice(0, 8).join("\n· "), "bad"); return null; }
    if (!silent) this.bankMsg("✔ 校验通过：" + v.clean.length + " 道自定义题目，靶点与类别全部合规", "ok");
    return v.clean;
  },
  saveBank() {
    const clean = this.checkBank(true);
    if (!clean) return;
    AdminData.saveCustom(clean);
    AdminData.applyBank();                       // 立即并入运行时题库：不刷新页面就能抽到
    this.el("ad-bank-text").value = JSON.stringify(clean, null, 2);
    this.el("ad-bank-count").textContent = "内置 " + AdminData.builtin().length + " 题 · 自定义 " + clean.length + " 题";
    this.bankMsg("✔ 已保存到本机题库（" + clean.length + " 题，已立即生效）——新增题目会自动进入「每日挑战」，编入波次后也会出现在拦截战", "ok");
    if (typeof refreshDailySub === "function") refreshDailySub();
    this.renderWaves();
  },

  /* ===== ③ 波次编排 ===== */
  renderWaves() {
    const w = AdminData.waves() || AdminData.defaultWaves();
    this.el("ad-wave-text").value = JSON.stringify(w, null, 2);
    const custom = AdminData.waves() ? "当前使用：管理员自定义波次" : "当前使用：内置默认波次";
    this.el("ad-wave-msg").textContent = custom + "（4 波固定：第 1 波=前测、第 4 波=后测）";
    this.el("ad-wave-msg").className = "ad-msg ok";
  },
  saveWaves() {
    let w;
    try { w = JSON.parse(this.el("ad-wave-text").value || "null"); }
    catch (e) { this.el("ad-wave-msg").textContent = "JSON 语法错误：" + e.message; this.el("ad-wave-msg").className = "ad-msg bad"; return; }
    if (!Array.isArray(w) || w.length !== 4) { this.el("ad-wave-msg").textContent = "必须是 4 个波次（第 1 波前测、第 4 波后测）"; this.el("ad-wave-msg").className = "ad-msg bad"; return; }
    const ids = AdminData.allIds(), bad = [];
    w.forEach((x, i) => {
      if (!x || !Array.isArray(x.ids) || !x.ids.length) { bad.push("第 " + (i + 1) + " 波缺少 ids 数组"); return; }
      x.ids.forEach((id) => { if (!ids[id]) bad.push("第 " + (i + 1) + " 波：" + id + " 不在题库里"); });
      if (!x.name) x.name = "第 " + (i + 1) + " 波";
      x.reveal = !!x.reveal;
    });
    if (bad.length) { this.el("ad-wave-msg").textContent = "校验未通过：\n· " + bad.slice(0, 8).join("\n· "); this.el("ad-wave-msg").className = "ad-msg bad"; return; }
    AdminData.saveWaves(w);
    this.el("ad-wave-text").value = JSON.stringify(w, null, 2);
    this.el("ad-wave-msg").textContent = "✔ 已保存：下一局「拦截战」按新波次出题（每波 " + w.map((x) => x.ids.length).join("/") + " 题）";
    this.el("ad-wave-msg").className = "ad-msg ok";
  },

  /* ===== ④ 账号管理 ===== */
  renderUsers() {
    const rows = Auth.list().map((u) => {
      const r = Auth.progressOf(u.u);
      const state = r ? "已完成 · " + r.rank + " · " + (r.post == null ? "--" : r.post + "%") : "未完成";
      return "<tr><td><b>" + esc(u.u) + "</b><small>" + esc(u.nick) + "</small></td>" +
        '<td><span class="tag ' + (u.role === "admin" ? "tag-admin" : "tag-user") + '">' + (u.role === "admin" ? "管理员" : "学员") + "</span></td>" +
        "<td>" + (u.created ? new Date(u.created).toLocaleDateString() : "--") + "</td>" +
        '<td><span class="' + (r ? "ad-ok" : "ad-dim") + '">' + state + "</span></td>" +
        '<td class="ad-ops"><button data-op="reset" data-u="' + u.u + '">重置密码</button>' +
        (u.u === Auth.username() ? "" : '<button data-op="del" data-u="' + u.u + '" class="danger">删除</button>') + "</td></tr>";
    }).join("");
    this.el("ad-user-table").innerHTML =
      "<thead><tr><th>账号</th><th>角色</th><th>注册</th><th>训练状态</th><th>操作</th></tr></thead><tbody>" + rows + "</tbody>";
    this.el("ad-user-table").querySelectorAll("button[data-op]").forEach((b) => {
      b.onclick = () => {
        const u = b.dataset.u;
        if (b.dataset.op === "reset") {
          const p = Auth.resetPassword(u);
          this.userMsg(p ? "已重置「" + u + "」的密码： " + p + "   （请立刻转告本人，关闭本页后不再显示）" : "重置失败", p ? "ok" : "bad");
        } else {
          if (!confirm("删除账号「" + u + "」及其本机训练数据？不可恢复。")) return;
          this.userMsg(Auth.remove(u) ? "已删除「" + u + "」" : "删除失败（不能删除自己或最后一个管理员）", "ok");
        }
        this.renderUsers(); this.dashboard();
      };
    });
  },
  userMsg(t, k) {
    const m = this.el("ad-user-msg");
    m.textContent = t; m.className = "ad-msg " + (k || "");
  },
  createUser() {
    const u = this.el("ad-new-user").value.trim(), p = this.el("ad-new-pass").value, role = this.el("ad-new-role").value;
    const r = Auth.create(u, p, role, this.el("ad-new-nick").value);
    if (!r.ok) { this.userMsg(r.msg, "bad"); return; }
    ["ad-new-user", "ad-new-pass", "ad-new-nick"].forEach((i) => { this.el(i).value = ""; });
    this.userMsg("✔ 已创建 " + (role === "admin" ? "管理员" : "学员") + "账号「" + r.user + "」", "ok");
    this.renderUsers(); this.dashboard();
  },

  /* ===== ⑤ 数据导出 / 导入 ===== */
  archive() {
    const progress = {};
    Auth.list().forEach((u) => {
      progress[u.u] = {};
      ["v3", "wrong", "daily"].forEach((k) => { const v = AdminData.raw(AKEY(k, u.u), null); if (v) progress[u.u][k] = v; });
    });
    return { version: 1, app: "识渔计划 SHIYU", exportedAt: new Date().toISOString(),
      users: Auth.users(), bank: AdminData.custom(), waves: AdminData.raw(AdminData.WAVES_KEY, null), progress };
  },
  download(name, text, mime) {
    const blob = new Blob([text], { type: (mime || "application/json") + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  exportJSON() {
    this.download("识渔计划_全量数据_" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(this.archive(), null, 2));
    this.exMsg("✔ 已导出 JSON（含账号、题库、波次、训练存档）", "ok");
  },
  exportCSV() {
    const rows = AdminData.collect();
    const head = ["用户名", "昵称", "角色", "注册日期", "最近登录", "前测%", "后测%", "提升", "段位", "战绩", "最高连击", "五维均分", "错题数"];
    const body = rows.map((x) => {
      const r = x.report || {};
      const d = (r.pre != null && r.post != null) ? r.post - r.pre : "";
      return [x.u, x.nick, x.role === "admin" ? "管理员" : "学员",
        x.created ? new Date(x.created).toLocaleDateString() : "", x.last ? new Date(x.last).toLocaleString() : "",
        AdminUI.num(r.pre), AdminUI.num(r.post), d, r.rank || "", r.score == null ? "" : r.score,
        r.bestCombo == null ? "" : r.bestCombo, AdminUI.num(r.avg), x.wrongN];
    });
    const csv = "\uFEFF" + [head].concat(body).map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    this.download("识渔计划_成绩汇总_" + new Date().toISOString().slice(0, 10) + ".csv", csv, "text/csv");
    this.exMsg("✔ 已导出 CSV（" + rows.length + " 行，Excel 可直接打开）", "ok");
  },
  importJSON() {
    let a;
    try { a = JSON.parse(this.el("ad-import-text").value || "null"); }
    catch (e) { this.exMsg("JSON 语法错误：" + e.message, "bad"); return; }
    if (!a || !a.users) { this.exMsg("导入失败：缺少 users 字段（请用本页导出的 JSON）", "bad"); return; }
    if (!confirm("导入将覆盖本机账号、题库与训练存档，且不可撤销。继续？")) return;
    Auth.save(a.users);
    if (Array.isArray(a.bank)) AdminData.saveCustom(a.bank);
    if (Array.isArray(a.waves)) AdminData.saveWaves(a.waves); else localStorage.removeItem(AdminData.WAVES_KEY);
    Object.keys(a.progress || {}).forEach((u) => Object.keys(a.progress[u]).forEach((k) => AdminData.put(AKEY(k, u), a.progress[u][k])));
    this.exMsg("✔ 导入完成：账号 " + Object.keys(a.users).length + " 个，自定义题目 " + (a.bank || []).length + " 道。若当前登录账号被覆盖请重新登录。", "ok");
    this.dashboard(); this.renderBank(); this.renderWaves(); this.renderUsers();
  },
  exMsg(t, k) { const m = this.el("ad-ex-msg"); m.textContent = t; m.className = "ad-msg " + (k || ""); },

  /* ===== 绑定 ===== */
  bind() {
    document.querySelectorAll(".atab").forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll(".atab").forEach((x) => x.classList.toggle("on", x === t));
        document.querySelectorAll(".ad-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.p !== t.dataset.p));
      };
    });
    this.el("ad-refresh").onclick = () => { this.dashboard(); this.renderUsers(); this.exMsg("已刷新看板", "ok"); };
    this.el("ad-bank-check").onclick = () => this.checkBank(false);
    this.el("ad-bank-save").onclick = () => this.saveBank();
    this.el("ad-bank-load").onclick = () => { this.el("ad-bank-text").value = JSON.stringify(AdminData.custom(), null, 2); this.bankMsg("已载入本机自定义题库", "ok"); };
    this.el("ad-bank-tpl").onclick = () => {
      const cur = this.parseBank();
      const base = cur.ok && Array.isArray(cur.list) ? cur.list : [];
      const tpl = AdminData.template();
      tpl[0].id = "cust" + (base.length + 1);
      base.push(tpl[0]);
      this.el("ad-bank-text").value = JSON.stringify(base, null, 2);
      this.bankMsg("已插入 1 道模板题（含 data-el 靶点写法），改完点「校验」再「保存」", "ok");
    };
    this.el("ad-bank-clear").onclick = () => {
      if (!confirm("清空本机自定义题库？（内置 20 题不受影响）")) return;
      AdminData.saveCustom([]); this.el("ad-bank-text").value = "[]";
      this.bankMsg("已清空自定义题库", "ok"); this.renderWaves(); this.dashboard();
    };
    this.el("ad-wave-save").onclick = () => this.saveWaves();
    this.el("ad-wave-reset").onclick = () => { localStorage.removeItem(AdminData.WAVES_KEY); this.renderWaves(); this.el("ad-wave-msg").textContent = "✔ 已恢复内置默认波次"; };
    this.el("ad-new-go").onclick = () => this.createUser();
    this.el("ad-ex-json").onclick = () => this.exportJSON();
    this.el("ad-ex-csv").onclick = () => this.exportCSV();
    this.el("ad-ex-import").onclick = () => this.importJSON();
  },
};

/* 控制台入口按钮与返回首页由 app.js 的 init() 统一绑定（那里同时控制管理员可见性） */
