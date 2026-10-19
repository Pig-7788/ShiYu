/* ============ 识渔计划 v3：游戏化应用逻辑（拦截战 / 拆解台 / 组装实验室） ============ */
"use strict";
const $ = (s) => document.querySelector(s);
const LS_KEY = "shiyu_v3";

/* ---------- 状态 ---------- */
let S = { dims: null, missCat: {}, report: null, atk: null, story: null };
function freshDims() { const d = {}; DIMENSIONS.forEach((x) => (d[x.key] = { hit: 0, miss: 0, fa: 0 })); return d; }
function store() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      dims: S.dims, report: S.report, missCat: S.missCat, atkBest: S.atk ? S.atk.best : null, atkFreeHits: S.atk ? (S.atk.freeHits || null) : null,
      story: S.story,
    }));
  } catch (e) {}
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    S.dims = (d && d.dims) || freshDims();
    S.report = (d && d.report) || null;
    S.missCat = (d && d.missCat) || {};
    S.atk = { round: 1, mode: "genes", slots: {}, history: [], best: d ? d.atkBest : null, freeHits: (d && d.atkFreeHits) || {}, freeText: "" };
    S.story = Object.assign(freshStory(), (d && d.story) || {});
  } catch (e) {
    S.dims = freshDims();
    S.atk = { round: 1, mode: "genes", slots: {}, history: [], best: null, freeHits: {}, freeText: "" };
    S.story = freshStory();
  }
}

/* ---------- 视图 ---------- */
function show(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("#v-" + id).classList.add("active");
  const app = $("#app");
  if (app) app.scrollTop = 0;
  window.scrollTo(0, 0);
}

/* ---------- 音效（WebAudio 合成，零素材） ---------- */
const SFX = {
  ctx: null, on: true,
  ac() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return this.ctx; },
  play(kind) {
    if (!this.on) return;
    const ac = this.ac(); if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime;
    const tone = (f0, f1, dur, type, vol) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    };
    if (kind === "pick") tone(300, 520, 0.08, "sine", 0.06);
    else if (kind === "drop") tone(500, 240, 0.1, "sine", 0.07);
    else if (kind === "good") { tone(523, 784, 0.12, "sine", 0.09); setTimeout(() => tone(784, 1046, 0.14, "sine", 0.07), 90); }
    else if (kind === "bad") tone(220, 90, 0.3, "sawtooth", 0.08);
    else if (kind === "combo") tone(660, 1320, 0.16, "triangle", 0.08);
    else if (kind === "alarm") { tone(880, 880, 0.09, "square", 0.05); setTimeout(() => tone(660, 660, 0.09, "square", 0.05), 110); }
    else if (kind === "lock") tone(880, 660, 0.1, "sine", 0.07);
  },
};

/* ---------- 2D 宠物 + AI 蓝军安全官 ---------- */
function officerChar() { return `<span class="opet-fish">🐟</span>`; }
const Officer = {
  voiceOn: true, timer: null, mood: "normal",
  initVoice() { try { const v = localStorage.getItem("shiyu_voice"); if (v != null) { this.voiceOn = v === "1"; SFX.on = this.voiceOn; } } catch (e) {} },
  syncBtn() { const b = $("#a-voice"); if (b) { b.textContent = this.voiceOn ? "🔊 音效" : "🔇 静音"; b.classList.toggle("on", this.voiceOn); } },
  toggle() { this.voiceOn = !this.voiceOn; SFX.on = this.voiceOn; if (!this.voiceOn) this.stopTTS();
    try { localStorage.setItem("shiyu_voice", this.voiceOn ? "1" : "0"); } catch (e) {} this.syncBtn(); return this.voiceOn; },
  stopTTS() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} },
  cancel() { if (this.timer) clearInterval(this.timer); this.timer = null; this.stopTTS(); },
  tts(text) {
    if (!this.voiceOn) return;
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[+≥%]/g, " "));
      u.lang = "zh-CN"; u.rate = 1.05;
      const zh = speechSynthesis.getVoices().find((v) => /zh|Chinese/i.test(v.lang));
      if (zh) u.voice = zh;
      speechSynthesis.speak(u);
    } catch (e) {}
  },
  say(text, done) {
    const host = $("#officer"); if (!host) { if (done) done(); return; }
    const b = document.createElement("div");
    b.className = "obubble";
    b.innerHTML = '<div class="officer-ava talking ' + this.mood + '">' + officerChar() + '</div><div class="otext"></div>';
    host.appendChild(b);
    const t = b.querySelector(".otext"); let i = 0;
    this.tts(text);
    this.timer = setInterval(() => {
      i += 1; t.textContent = text.slice(0, i);
      b.scrollIntoView({ block: "nearest" });
      if (i >= text.length) {
        clearInterval(this.timer); this.timer = null;
        b.classList.add("done");
        b.querySelector(".officer-ava").classList.remove("talking");
        if (done) done();
      }
    }, 24);
  },
  play(lines, thenChips, mood) {
    this.mood = mood || "normal"; this.cancel();
    const host = $("#officer"); if (host) host.innerHTML = "";
    const next = (k) => { if (k >= lines.length) { if (thenChips) this.showChips(); return; } this.say(lines[k], () => next(k + 1)); };
    next(0);
  },
  showChips() {
    const box = $("#officer-chips"); if (!box) return;
    box.innerHTML = OFFICER_QA.map((q, i) => '<span class="chip" data-q="' + i + '">' + esc(q.q) + "</span>").join("");
    box.querySelectorAll(".chip").forEach((c) => {
      c.onclick = () => { box.innerHTML = ""; this.play(OFFICER_QA[+c.dataset.q].a(), true); };
    });
  },
};
const OFFICER_QA = [
  { q: "怎么把分数打高？", a: () => [
      "拦截战里连击是关键：连续正确分拣，分数倍率会一直涨，错一张清零。",
      "拆解台尽量一次放对槽位——首放正确才算命中，放错弹回就记漏判了。",
    ] },
  { q: "造浪者怎么玩出高分？", a: () => [
      "组装实验室里，预测仪只是参考——它有误差带，真检出率要投放后才知道。",
      "调低激进度的同时提高伪装度，能压低检出；但投放量大本身会增加暴露面。",
    ] },
  { q: "普通学生最该防哪类？", a: () => [
      "利诱钩子与紧迫话术是命中率最高的两类破绽，几乎每封钓鱼都有其一。",
      "实操三条：不点正文链接、不给验证码、限时话术先冷静一分钟再核实。",
    ] },
  { q: "你是真人吗？", a: () => [
      "我是作品内置的AI蓝军安全官，本地规则与知识库驱动，浏览器语音合成播报。",
      "后端接入大模型后我会有自由问答能力——演示环节，零依赖最稳。",
    ] },
];

/* ---------- 工具函数 ---------- */
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function plainText(q) { return q.parts.map((p) => (p.t === "p" ? p.html.replace(/<[^>]+>/g, "") : "")).join(""); }
function partOf(q, id) {
  if (id === q.meta.addrId) return { t: "addr", text: q.meta.addr };
  if (id === q.meta.urlId) return { t: "url", text: q.meta.url };
  const p = (q.parts || []).find((x) => x.id === id);
  if (!p) return null;
  return { t: p.t, text: p.text || plainText({ parts: [p] }) };
}
function chipLabel(q, r) {
  const p = partOf(q, r.target);
  if (!p) return r.category;
  if (p.t === "addr") return "发件域名 " + String(p.text).split("@").pop();
  if (p.t === "url") return "地址栏 " + p.text;
  if (p.t === "link") return "链接 " + p.text;
  if (p.t === "attach") return "附件 " + p.text;
  if (p.t === "qr") return "二维码";
  if (p.t === "field") return "表单 " + p.text;
  return String(p.text).slice(0, 14);
}
function slotAtPoint(x, y, selector) {
  return [...document.querySelectorAll(selector)].find((s) => {
    const b = s.getBoundingClientRect();
    return x > b.left && x < b.right && y > b.top && y < b.bottom;
  });
}

/* ============ 报告 / 画像 / 雷达 ============ */
function normalizeDims() {
  const out = {};
  DIMENSIONS.forEach((d) => {
    const v = S.dims[d.key];
    out[d.key] = Math.min(98, Math.max(5, Math.round(50 + v.hit * 11 - v.miss * 7 - v.fa * 4)));
  });
  return out;
}
function rankOf(avg) { return RANKS.find((r) => avg >= r.min).name; }
function accOfSamples(ids) {
  if (!G) return null;
  const wanted = new Set(ids || []);
  const rows = G.answers.reduce((all, a) => all.concat(a), []).filter((x) => wanted.has(x.qid));
  if (!rows.length) return null;
  return Math.round((100 * rows.filter((x) => x.correct).length) / rows.length);
}
function finishGame() {
  if (!G) return;
  clearInterval(G.tick);
  const pre = accOfSamples(CAMPAIGN.pretest), post = accOfSamples(CAMPAIGN.posttest);
  const dimsN = normalizeDims();
  const avg = Math.round(DIMENSIONS.reduce((s, d) => s + dimsN[d.key], 0) / DIMENSIONS.length);
  S.report = { pre, post, dims: dimsN, avg, rank: rankOf(avg), score: G.score, bestCombo: G.bestCombo, at: Date.now() };
  G.done = true;
  store();
  renderReport(); show("report");
}
function renderReport() {
  const r = S.report; if (!r) return;
  $("#r-pre").textContent = (r.pre ?? "--") + "%";
  const p = $("#r-post"); p.textContent = (r.post ?? "--") + "%";
  if (r.post != null && r.pre != null) { const d = r.post - r.pre; p.textContent += (d >= 0 ? " ↑" : " ↓") + Math.abs(d); }
  $("#r-rank").textContent = r.rank;
  drawRadar($("#radar-report"), r.dims);
  const cats = Object.entries(S.missCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  $("#r-topmiss").innerHTML = cats.length
    ? cats.map(([c, n]) => "<li><b>" + CATEGORY_NAME[c] + "</b>：漏判 " + n + " 次</li>").join("")
    : "<li>全部破绽均被首放命中，表现出色！</li>";
  const weak = DIMENSIONS.slice().sort((a, b) => r.dims[a.key] - r.dims[b.key]).slice(0, 2);
  $("#r-advice").innerHTML = weak.map((d) => "<li><b>" + d.name + "（" + r.dims[d.key] + "）</b>：" + DIM_ADVICE[d.key] + "</li>").join("");
  const extra = $("#r-extra");
  if (extra && r.score != null) extra.textContent = "战绩：" + r.score + " 分 · 最高连击 x" + (r.bestCombo || 0) + " · 数据完整度 " + (G ? G.lives : "--") + "%";
  const reviewBtn = $("#b-report-dismantle");
  if (reviewBtn) {
    const n = typeof reportReviewSamples === "function" ? reportReviewSamples().length : 0;
    reviewBtn.style.display = n ? "" : "none";
    const hint = reviewBtn.querySelector("small");
    if (hint) hint.textContent = n ? "把本局 " + n + " 个钓鱼样本的破绽拖进类别槽" : "";
  }
}
function drawRadar(cv, dims) {
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 52;
  ctx.clearRect(0, 0, W, H);
  const n = DIMENSIONS.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = ang(i % n), rr = (R * ring) / 4;
      i ? ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    ctx.strokeStyle = "rgba(53,224,200,.18)"; ctx.stroke();
  }
  ctx.font = "11px sans-serif"; ctx.fillStyle = "#7e8fa8"; ctx.textAlign = "center";
  DIMENSIONS.forEach((d, i) => {
    const a = ang(i);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
    ctx.strokeStyle = "rgba(53,224,200,.18)"; ctx.stroke();
    ctx.fillText(d.name, cx + (R + 26) * Math.cos(a), cy + (R + 26) * Math.sin(a) + 4);
  });
  ctx.beginPath();
  DIMENSIONS.forEach((d, i) => {
    const a = ang(i), rr = (R * dims[d.key]) / 100;
    i ? ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(53,224,200,.25)"; ctx.fill();
  ctx.strokeStyle = "#35e0c8"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#d7e3f4"; ctx.font = "bold 10px sans-serif";
  DIMENSIONS.forEach((d, i) => {
    const a = ang(i), rr = Math.max(14, (R * dims[d.key]) / 100 - 16);
    ctx.fillText(dims[d.key], cx + rr * Math.cos(a), cy + rr * Math.sin(a) + 3);
  });
}


/* ---------- 画像 / 首页 / 初始化 ---------- */
function renderProfile() {
  const b = $("#p-body");
  if (!S.report) {
    b.innerHTML = '<div class="card"><p style="font-size:13px;line-height:2;color:var(--txt-dim)">还没有战绩记录。<br>打一轮「拦截战」即可生成五维风险画像与段位。</p></div>';
    return;
  }
  const r = S.report, dims = r.dims;
  b.innerHTML = `
    <div class="rankline">段位：<b>${r.rank}</b> · 综合 ${r.avg}${r.score != null ? " · 战绩 " + r.score + " 分" : ""}</div>
    <div class="radar-wrap"><canvas id="radar-p" width="320" height="300"></canvas></div>
    <div class="card"><h3>维度得分</h3><ul class="advice">${DIMENSIONS.map((d) => "<li><b>" + d.name + "</b>：" + dims[d.key] + " / 100</li>").join("")}</ul></div>
    ${S.atk && S.atk.best != null ? '<p style="text-align:center;color:var(--txt-dim);font-size:12px">造浪者最佳逃脱检出率：' + S.atk.best + "%</p>" : ""}`;
  drawRadar($("#radar-p"), dims);
}
function renderHome() {
  const el = $("#home-rank");
  const st = S.story || {};
  const done = Array.isArray(st.results) ? st.results.length : 0;
  let tail = "";
  if (st.final === "good") tail = ' · <span style="color:var(--good)">剧情 · 好结局</span>';
  else if (st.final === "bad") tail = ' · <span style="color:var(--red)">剧情 · 坏结局</span>';
  else if (st.phase && st.phase !== "home") tail = ' · <span style="color:var(--cyan)">剧情 ' + done + "/5</span>";
  el.innerHTML = (S.report
    ? '段位 <b>' + S.report.rank + "</b> · 战绩 " + (S.report.score ?? "--") + ' · <span style="color:var(--txt-dim)">再战一轮刷新画像</span>'
    : '<span style="color:var(--txt-dim)">尚无画像 · 完成一场拦截战后生成</span>') + tail;
}
/* ================= 反钓鱼知识库（KB）：hash 路由 / L0-L1-L2 / 搜索 / 知识树 ================= */
const KB_READ_KEY = "shiyu_kb_read_v1";
const KB_DOMAIN_COLOR = { recognize: "#35e0c8", attack: "#ff5470", defense: "#7fb4ff", response: "#ffb84d" };
const KB_TYPE_LABEL = { flag: "破绽", gene: "伪装卡", dim: "能力", response: "应急" };
let kbReturn = "home";
let KB_STATE = {
  route: { type: "home" }, routeKey: "", q: "", homeQuery: "",
  filter: { level: "all", tag: "all" }, back: "exit", backLabel: "← 退出", error: "", lastFocus: null,
};
let KB_READ = { read: {}, recent: [] };

function kbRestoreRead() {
  try {
    const d = JSON.parse(localStorage.getItem(KB_READ_KEY) || "null");
    if (d && typeof d === "object") {
      KB_READ.read = d.read || {};
      KB_READ.recent = Array.isArray(d.recent) ? d.recent : [];
    }
  } catch (e) {}
}
function kbSaveRead() {
  try { localStorage.setItem(KB_READ_KEY, JSON.stringify(KB_READ)); } catch (e) {}
}
function kbIsRead(id) { return !!KB_READ.read[id]; }
function kbTouchRecent(id) {
  if (!KB_ENTRY_MAP[id]) return;
  KB_READ.recent = [id].concat(KB_READ.recent.filter((x) => x !== id)).slice(0, 8);
  kbSaveRead();
}
function kbToggleRead(id) {
  if (!KB_ENTRY_MAP[id]) return;
  const now = !KB_READ.read[id];
  if (now) KB_READ.read[id] = true; else delete KB_READ.read[id];
  kbSaveRead();
  const btn = document.querySelector('[data-kb-read="' + id + '"]');
  if (btn) {
    btn.classList.toggle("on", now);
    btn.textContent = now ? "✓ 已读" : "标记已读";
  }
}
function kbProgress(ids) {
  const total = ids.length;
  const done = ids.filter(kbIsRead).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
function kbBar(p) {
  return '<span class="kb-bar"><i style="width:' + p.pct + '%"></i></span>';
}
function kbAttr(s) {
  return esc(String(s == null ? "" : s)).replace(/"/g, "&quot;");
}

/* ---------- 路由 ---------- */
function kbParseHash() {
  let raw = "";
  try { raw = decodeURIComponent((location.hash || "").replace(/^#/, "")); }
  catch (e) { raw = (location.hash || "").replace(/^#/, ""); }
  const p = raw.split("/").filter(Boolean);
  if (!p.length || p[0] !== "kb") return { type: "home" };
  if (p.length === 1) return { type: "home" };
  if (p[1] === "domain" && p[2]) {
    if (!KB_DOMAIN_MAP[p[2]]) return { type: "invalid", reason: "未找到该知识域" };
    if (p[3]) {
      const sub = KB_SUBDOMAIN_MAP[p[3]];
      if (!sub || sub.domain !== p[2] || p.length > 4) return { type: "invalid", reason: "未找到该子类" };
      return { type: "domain", domain: p[2], sub: p[3] };
    }
    if (p.length > 3) return { type: "invalid", reason: "未找到该页面" };
    return { type: "domain", domain: p[2] };
  }
  if (p[1] === "entry" && p[2] && p[3]) {
    const id = p[2] + "/" + p[3];
    if (!KB_ENTRY_MAP[id] || p.length > 4) return { type: "invalid", reason: "未找到该条目" };
    return { type: "entry", id };
  }
  if (p[1] === "path" && p[2] && KB_PATH_MAP[p[2]] && p.length === 3) return { type: "path", id: p[2] };
  return { type: "invalid", reason: "未找到该页面" };
}
function kbGo(hash) {
  if (!hash) return;
  const target = hash.charAt(0) === "#" ? hash : "#" + hash;
  if (location.hash === target) kbRender();
  else location.hash = target;
}
function kbOpen() {
  const act = document.querySelector(".view.active");
  const id = act ? act.id.replace(/^v-/, "") : "";
  if (id && id !== "atlas") kbReturn = id;
  if ((location.hash || "") !== "#kb") location.hash = "#kb";
  else kbRender();
}
function kbExit() {
  const target = (!kbReturn || kbReturn === "atlas") ? "home" : kbReturn;
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  if (target === "home") renderHome();
  show(target);
}

/* ---------- 面包屑 / 返回 ---------- */
function kbCrumbLink(href, label) {
  return '<a href="' + href + '">' + esc(label) + "</a>";
}
function kbChrome(route) {
  const sep = '<span class="kb-sep">›</span>';
  if (route.type === "home" || route.type === "invalid") {
    return { crumbs: '<span class="kb-crumb-current">知识库</span>', back: "exit", backLabel: "← 退出" };
  }
  if (route.type === "path") {
    const p = KB_PATH_MAP[route.id];
    return {
      crumbs: kbCrumbLink("#kb", "知识库") + sep + '<span class="kb-crumb-current">' + esc(p.name) + "</span>",
      back: "#kb", backLabel: "← 返回",
    };
  }
  if (route.type === "domain") {
    const d = KB_DOMAIN_MAP[route.domain];
    if (route.sub) {
      const s = KB_SUBDOMAIN_MAP[route.sub];
      return {
        crumbs: kbCrumbLink("#kb", "知识库") + sep + kbCrumbLink("#kb/domain/" + d.id, d.name) + sep +
          '<span class="kb-crumb-current">' + esc(s.name) + "</span>",
        back: "#kb/domain/" + d.id, backLabel: "← 返回",
      };
    }
    return {
      crumbs: kbCrumbLink("#kb", "知识库") + sep + '<span class="kb-crumb-current">' + esc(d.name) + "</span>",
      back: "#kb", backLabel: "← 返回",
    };
  }
  const e = KB_ENTRY_MAP[route.id];
  const d = KB_DOMAIN_MAP[e.domain];
  let crumbs = kbCrumbLink("#kb", "知识库") + sep + kbCrumbLink("#kb/domain/" + d.id, d.name);
  let back = "#kb/domain/" + d.id;
  if (e.subdomain) {
    const s = KB_SUBDOMAIN_MAP[e.subdomain];
    crumbs += sep + kbCrumbLink("#kb/domain/" + d.id + "/" + s.id, s.name);
    back = "#kb/domain/" + d.id + "/" + s.id;
  }
  crumbs += sep + '<span class="kb-crumb-current">' + esc(e.title) + "</span>";
  return { crumbs, back, backLabel: "← 返回" };
}

/* ---------- 渲染入口 ---------- */
function kbRender() {
  if (typeof KB_ENTRIES === "undefined") return;
  let route = kbParseHash();
  const key = JSON.stringify(route);
  if (key !== KB_STATE.routeKey) {
    KB_STATE.routeKey = key;
    KB_STATE.q = "";
    KB_STATE.homeQuery = "";
    KB_STATE.filter = { level: "all", tag: "all" };
  }
  if (route.type === "invalid") {
    KB_STATE.error = (route.reason || "未找到该页面") + "，已返回知识库首页。";
    try { history.replaceState(null, "", location.pathname + location.search + "#kb"); } catch (e) {}
    route = { type: "home" };
    KB_STATE.invalid = true;
  } else {
    KB_STATE.invalid = false;
  }
  KB_STATE.route = route;
  let html = "";
  if (route.type === "home") {
    if (!KB_STATE.invalid) KB_STATE.error = "";
    html = kbHomeHTML();
  } else if (route.type === "domain") {
    KB_STATE.error = "";
    html = kbDomainHTML(route);
  } else if (route.type === "entry") {
    KB_STATE.error = "";
    html = kbEntryHTML(route);
  } else if (route.type === "path") {
    KB_STATE.error = "";
    html = kbPathHTML(route);
  }
  const chrome = kbChrome(route);
  KB_STATE.back = chrome.back;
  KB_STATE.backLabel = chrome.backLabel;
  $("#kb-crumbs").innerHTML = chrome.crumbs;
  $("#kb-back").textContent = chrome.backLabel;
  $("#kb-body").innerHTML = html;
  show("atlas");
  const view = $("#v-atlas");
  if (view) view.scrollTop = 0;
  kbBuildTree();
  if (route.type === "entry") {
    const e = KB_ENTRY_MAP[route.id];
    if (e) kbTouchRecent(e.id);
    const toc = $("#kb-toc");
    if (toc && window.matchMedia("(min-width:560px)").matches) toc.open = true;
  }
}

/* ---------- 首页 ---------- */
function kbHomeHTML() {
  const seen = KB_READ.recent.length > 0;
  const recent = (seen ? KB_READ.recent : KB_RECENT).map((id) => KB_ENTRY_MAP[id]).filter(Boolean).slice(0, 5);
  const domains = KB_DOMAINS.slice().sort((a, b) => a.order - b.order).map((d) => {
    const list = KB_ENTRIES.filter((e) => e.domain === d.id);
    const p = kbProgress(list.map((e) => e.id));
    return `<a class="kb-domain-card" href="#kb/domain/${d.id}" style="--accent:${KB_DOMAIN_COLOR[d.id] || "#35e0c8"}">
      <div class="kb-domain-icon" aria-hidden="true">${d.icon}</div>
      <div class="kb-domain-head"><h3>${esc(d.name)}</h3><span>${esc(d.en)}</span></div>
      <p>${esc(d.desc)}</p>
      <div class="kb-domain-reps">${list.slice(0, 3).map((e) => '<span>' + esc(e.title) + "</span>").join("")}</div>
      <div class="kb-domain-foot"><span>${list.length} 个条目</span><span>${p.done}/${p.total} 已读</span></div>
      ${kbBar(p)}
    </a>`;
  }).join("");
  const paths = KB_PATHS.map((p) => {
    const prog = kbProgress(p.entryIds);
    return `<a class="kb-path-card" href="#kb/path/${p.id}">
      <div class="kb-path-icon" aria-hidden="true">${p.icon}</div>
      <div class="kb-path-head"><h3>${esc(p.name)}</h3><span>${p.minutes} 分钟</span></div>
      <p>${esc(p.desc)}</p>
      <div class="kb-domain-foot"><span>${p.entryIds.length} 个条目</span><span>${prog.done}/${prog.total} 已读</span></div>
      ${kbBar(prog)}
    </a>`;
  }).join("");
  const recentHTML = recent.map((e) => `<a class="kb-recent" href="#kb/entry/${e.id}">
    <span>${KB_TYPE_LABEL[e.type]}</span><b>${esc(e.title)}</b><small>${esc(e.subtitle)}</small></a>`).join("");
  const sources = ATLAS_SOURCES.map((s) => `<li>${s.u
    ? '<a href="' + s.u + '" target="_blank" rel="noopener noreferrer">' + esc(s.t) + " ↗</a>"
    : "<b>" + esc(s.t) + "</b>"}<p>${esc(s.d)}</p></li>`).join("");
  return `<div class="kb-page kb-home">
    ${KB_STATE.error ? '<div class="kb-alert">' + esc(KB_STATE.error) + '<button class="kb-alert-close" data-kb-dismiss="error" type="button" aria-label="关闭提示">×</button></div>' : ""}
    <header class="kb-hero">
      <div class="kb-kicker">FIELD NOTES · 反钓鱼知识库</div>
      <h1>反钓鱼知识库</h1>
      <p>按知识域、条目、关联组织。先定位问题，再读条目，最后去训练验证。</p>
      <div class="kb-stats">
        <span><b>${KB_ENTRIES.length}</b> 条目</span><span><b>${KB_DOMAINS.length}</b> 知识域</span>
        <span><b>${KB_PATHS.length}</b> 学习路径</span><span><b>${KB_META.totalSamples}</b> 训练样本</span>
      </div>
    </header>
    <div class="kb-searchbar"><span aria-hidden="true">🔍</span><input id="kb-home-search" type="search" placeholder="搜索破绽、伪装卡、能力维度…" autocomplete="off"><kbd>/</kbd></div>
    <div id="kb-home-results" class="kb-home-results"></div>
    <section class="kb-block"><div class="kb-block-head"><h2>知识域</h2><span>KNOWLEDGE DOMAINS</span></div><div class="kb-domain-grid">${domains}</div></section>
    <section class="kb-block"><div class="kb-block-head"><h2>学习路径</h2><span>LEARNING PATHS</span></div><div class="kb-path-grid">${paths}</div></section>
    <section class="kb-block"><div class="kb-block-head"><h2>${seen ? "最近浏览" : "最近更新"}</h2><span>${seen ? "RECENTLY VIEWED" : "RECENT"}</span></div><div class="kb-recent-list">${recentHTML}</div></section>
    <section class="kb-block"><div class="kb-block-head"><h2>怎么用</h2><span>HOW TO USE</span></div>
      <ol class="kb-steps"><li>先读域描述，判断问题属于“识别 / 攻击 / 防御 / 应急”哪一类。</li><li>按学习路径读条目，或直接搜索关键词。</li><li>去拦截战或造浪者验证，再回条目页补课。</li></ol>
    </section>
    <details class="kb-details"><summary>资料来源与版本</summary><ul class="kb-source-list">${sources}</ul><p class="kb-muted">全部样本为虚构，仅用于教学模拟；不指向任何真实机构、个人或域名。知识版本 v${KB_META.version} · ${KB_META.updated}。</p></details>
    <button class="kb-exit" data-kb-action="exit">退出知识库，返回进入前页面</button>
  </div>`;
}

/* ---------- 知识域 / 子类 ---------- */
function kbFilteredEntries(domain, sub) {
  let list = KB_ENTRIES.filter((e) => e.domain === domain && (!sub || e.subdomain === sub));
  if (KB_STATE.filter.level !== "all") list = list.filter((e) => e.level === KB_STATE.filter.level);
  if (KB_STATE.filter.tag !== "all") list = list.filter((e) => e.tags.includes(KB_STATE.filter.tag));
  const q = KB_STATE.q.trim().toLowerCase();
  if (q) list = list.filter((e) => (e.title + e.summary + e.tags.join(" ") + e.keyPoints.join(" ")).toLowerCase().includes(q));
  return list;
}
function kbRowHTML(e) {
  return `<a class="kb-row" href="#kb/entry/${e.id}">
    <div class="kb-row-head"><span class="kb-type">${KB_TYPE_LABEL[e.type]}</span><h3>${esc(e.title)}</h3><span class="kb-level">${esc(e.level)}</span></div>
    <p>${esc(e.summary)}</p>
    <div class="kb-row-meta"><span>${e.minutes} 分钟</span>${e.tags.slice(0, 2).map((t) => "<span>" + esc(t) + "</span>").join("")}<span>${kbIsRead(e.id) ? "✓ 已读" : "未读"}</span></div>
  </a>`;
}
function kbDomainListHTML(route) {
  const list = kbFilteredEntries(route.domain, route.sub);
  if (!list.length) return '<div class="kb-empty">没有匹配的条目，试试清除筛选或换一个关键词。</div>';
  if (route.domain === "attack" && !route.sub) {
    return KB_SUBDOMAINS.filter((s) => s.domain === "attack").map((s) => {
      const group = list.filter((e) => e.subdomain === s.id);
      if (!group.length) return "";
      return `<section class="kb-subgroup"><div class="kb-subgroup-head"><span aria-hidden="true">${s.icon}</span><div><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div><a href="#kb/domain/attack/${s.id}">查看子类 →</a></div>${group.map(kbRowHTML).join("")}</section>`;
    }).join("");
  }
  return list.map(kbRowHTML).join("");
}
function kbDomainHTML(route) {
  const d = KB_DOMAIN_MAP[route.domain];
  const s = route.sub ? KB_SUBDOMAIN_MAP[route.sub] : null;
  const base = KB_ENTRIES.filter((e) => e.domain === route.domain && (!route.sub || e.subdomain === route.sub));
  const readP = kbProgress(base.map((e) => e.id));
  const levels = ["入门", "进阶", "实战"].map((lv) => ({ lv, n: base.filter((e) => e.level === lv).length })).filter((x) => x.n);
  const tags = [...new Set(base.flatMap((e) => e.tags))].slice(0, 10);
  const levelBtns = ["all", "入门", "进阶", "实战"].map((lv) =>
    `<button class="kb-filter ${KB_STATE.filter.level === lv ? "on" : ""}" data-kb-level="${lv}">${lv === "all" ? "全部难度" : lv}</button>`).join("");
  const tagBtns = ['<button class="kb-filter ' + (KB_STATE.filter.tag === "all" ? "on" : "") + '" data-kb-tag="all">全部标签</button>']
    .concat(tags.map((t) => `<button class="kb-filter ${KB_STATE.filter.tag === t ? "on" : ""}" data-kb-tag="${kbAttr(t)}">${esc(t)}</button>`)).join("");
  return `<div class="kb-page kb-domain" style="--accent:${KB_DOMAIN_COLOR[route.domain] || "#35e0c8"}">
    <header class="kb-domain-hero">
      <div class="kb-kicker">${esc(d.en)} · KNOWLEDGE DOMAIN</div>
      <div class="kb-domain-title"><span aria-hidden="true">${s ? s.icon : d.icon}</span><h1>${esc(s ? s.name : d.name)}</h1></div>
      <p>${esc(s ? s.desc : d.desc)}</p>
      <div class="kb-stats"><span><b>${base.length}</b> 条目</span><span><b>${readP.done}</b> 已读</span>${levels.map((x) => `<span><b>${x.n}</b> ${x.lv}</span>`).join("")}</div>
      ${kbBar(readP)}
    </header>
    <div class="kb-filterbar">
      <input id="kb-domain-search" class="kb-input" type="search" value="${kbAttr(KB_STATE.q)}" placeholder="在本知识域内搜索…" autocomplete="off">
      <div class="kb-filter-row">${levelBtns}${tagBtns}</div>
    </div>
    <div class="kb-list-head"><span id="kb-domain-count">共 ${kbFilteredEntries(route.domain, route.sub).length} 条</span><span>点击条目查看详情</span></div>
    <div id="kb-domain-list">${kbDomainListHTML(route)}</div>
    <button class="kb-exit" data-kb-action="exit">退出知识库，返回进入前页面</button>
  </div>`;
}
function kbRenderDomainList() {
  const route = KB_STATE.route;
  if (route.type !== "domain") return;
  const host = $("#kb-domain-list");
  if (host) host.innerHTML = kbDomainListHTML(route);
  const count = $("#kb-domain-count");
  if (count) count.textContent = "共 " + kbFilteredEntries(route.domain, route.sub).length + " 条";
  document.querySelectorAll("[data-kb-level]").forEach((b) => b.classList.toggle("on", b.dataset.kbLevel === KB_STATE.filter.level));
  document.querySelectorAll("[data-kb-tag]").forEach((b) => b.classList.toggle("on", b.dataset.kbTag === KB_STATE.filter.tag));
}

/* ---------- 学习路径 ---------- */
function kbPathHTML(route) {
  const p = KB_PATH_MAP[route.id];
  const entries = p.entryIds.map((id) => KB_ENTRY_MAP[id]).filter(Boolean);
  const prog = kbProgress(p.entryIds);
  return `<div class="kb-page kb-path">
    <header class="kb-path-hero">
      <div class="kb-kicker">LEARNING PATH · 学习路径</div>
      <h1><span aria-hidden="true">${p.icon}</span> ${esc(p.name)}</h1>
      <p>${esc(p.desc)}</p>
      <div class="kb-stats"><span><b>${entries.length}</b> 条目</span><span><b>${p.minutes}</b> 分钟</span><span><b>${prog.done}</b> 已读</span></div>
      ${kbBar(prog)}
    </header>
    <div class="kb-path-list">${entries.map((e, i) => `<a class="kb-path-item" href="#kb/entry/${e.id}">
      <span class="kb-path-no">${String(i + 1).padStart(2, "0")}</span>
      <div><h3>${esc(e.title)}</h3><p>${esc(e.summary)}</p></div>
      <span class="kb-level">${esc(e.level)}</span><span class="kb-read-dot">${kbIsRead(e.id) ? "✓" : "○"}</span>
    </a>`).join("")}</div>
    <button class="kb-exit" data-kb-action="exit">退出知识库，返回进入前页面</button>
  </div>`;
}

/* ---------- 条目 ---------- */
function kbRelatedHTML(entries) {
  if (!entries.length) return '<p class="kb-muted">暂无关联条目。</p>';
  return '<div class="kb-related-grid">' + entries.map((e) => `<a class="kb-related" href="#kb/entry/${e.id}">
    <span>${KB_TYPE_LABEL[e.type]}</span><b>${esc(e.title)}</b><small>${esc(e.subtitle)}</small></a>`).join("") + "</div>";
}
function kbEntryHTML(route) {
  const e = KB_ENTRY_MAP[route.id];
  if (!e) return kbHomeHTML();
  const d = KB_DOMAIN_MAP[e.domain];
  const siblings = KB_ENTRIES.filter((x) => x.domain === e.domain);
  const idx = siblings.findIndex((x) => x.id === e.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const related = e.related.map((id) => KB_ENTRY_MAP[id]).filter(Boolean);
  const backlinks = KB_ENTRIES.filter((x) => x.id !== e.id && x.related.includes(e.id));
  const toc = e.sections.map((s) => `<li><button type="button" data-kb-toc="kb-sec-${s.id}">${esc(s.title)}</button></li>`).join("");
  const sections = e.sections.map((s) => {
    let inner = "<p>" + esc(s.body) + "</p>";
    if (s.id === "example") inner = '<blockquote class="kb-quote">' + esc(s.body) + "</blockquote>" + (s.note ? '<p class="kb-note">' + esc(s.note) + "</p>" : "");
    return `<section class="kb-sec" id="kb-sec-${s.id}"><h2>${esc(s.title)}</h2>${inner}</section>`;
  }).join("");
  const keyPoints = e.keyPoints.length
    ? '<div class="kb-callout"><b>关键点</b><ul>' + e.keyPoints.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div>" : "";
  const mis = e.misconceptions.length
    ? '<ul class="kb-warn-list">' + e.misconceptions.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>"
    : '<p class="kb-muted">暂未收录。</p>';
  const read = kbIsRead(e.id);
  const action = e.domain === "attack" ? "attack" : "train";
  const actionLabel = e.domain === "attack" ? "去造浪者验证" : "去拦截战验证";
  const tocOpen = window.matchMedia("(min-width:560px)").matches ? " open" : "";
  return `<div class="kb-page kb-entry" style="--accent:${e.accent || KB_DOMAIN_COLOR[e.domain] || "#35e0c8"}">
    <header class="kb-entry-head">
      <div class="kb-kicker">${KB_TYPE_LABEL[e.type]} · ${esc(d.name)}</div>
      <h1>${esc(e.title)}</h1>
      <p class="kb-subtitle">${esc(e.subtitle)}</p>
      <p class="kb-entry-summary">${esc(e.summary)}</p>
      <div class="kb-meta"><span class="kb-level">${esc(e.level)}</span><span>${e.minutes} 分钟</span><span>${esc(e.audience.join(" / "))}</span><span>更新 ${esc(e.updated)}</span>${e.sampleRefs.length ? "<span>关联样本 " + e.sampleRefs.length + " 个</span>" : ""}</div>
      <div class="kb-tags">${e.tags.map((t) => "<span>" + esc(t) + "</span>").join("")}</div>
      <div class="kb-entry-actions"><button class="kb-read-btn ${read ? "on" : ""}" data-kb-read="${e.id}">${read ? "✓ 已读" : "标记已读"}</button><button class="kb-train-btn" data-kb-action="${action}">${actionLabel}</button></div>
    </header>
    <div class="kb-entry-grid">
      <details class="kb-toc" id="kb-toc"${tocOpen}><summary>本页目录 <span>${e.sections.length} 节</span></summary><ol>${toc}</ol></details>
      <article class="kb-article">
        ${sections}
        ${keyPoints}
        <section class="kb-entry-sec"><h2>常见误区</h2>${mis}</section>
        <section class="kb-entry-sec"><h2>关联知识</h2>${kbRelatedHTML(related)}</section>
        <section class="kb-entry-sec"><h2>被以下条目引用</h2>${kbRelatedHTML(backlinks)}</section>
        <section class="kb-entry-sec" id="kb-sources"><h2>出处与更新</h2><ul class="kb-source-list">${e.sources.map((s) => "<li>" + esc(s) + "</li>").join("")}</ul><p class="kb-muted">知识版本 v${KB_META.version} · 更新 ${esc(e.updated)} · 仅用于教学模拟。</p></section>
        <div class="kb-prevnext">${prev ? '<a href="#kb/entry/' + prev.id + '">← ' + esc(prev.title) + "</a>" : "<span></span>"}${next ? '<a href="#kb/entry/' + next.id + '">' + esc(next.title) + " →</a>" : "<span></span>"}</div>
      </article>
    </div>
    <button class="kb-exit" data-kb-action="exit">退出知识库，返回进入前页面</button>
  </div>`;
}

/* ---------- 搜索 ---------- */
function kbSearch(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return KB_ENTRIES.map((e) => {
    let score = 0;
    if (e.title.toLowerCase().includes(q)) score += 8;
    if (e.subtitle.toLowerCase().includes(q)) score += 2;
    if (e.summary.toLowerCase().includes(q)) score += 3;
    if (e.tags.some((t) => t.toLowerCase().includes(q))) score += 4;
    if (e.keyPoints.some((t) => String(t).toLowerCase().includes(q))) score += 2;
    if (e.sections.some((s) => String(s.title + s.body).toLowerCase().includes(q))) score += 1;
    return { e, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 30);
}
function kbHighlight(text, q) {
  const safe = esc(String(text || ""));
  const query = String(q || "").trim();
  if (!query) return safe;
  const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
  return safe.replace(re, "<mark>$1</mark>");
}
function kbSearchListHTML(results, q, compact) {
  if (!q) return '<div class="kb-empty">输入关键词开始搜索。</div>';
  if (!results.length) return '<div class="kb-empty">没有找到“' + esc(q) + '”相关条目。</div>';
  const list = compact ? results.slice(0, 6) : results;
  const groups = {};
  list.forEach(({ e }) => { (groups[e.domain] = groups[e.domain] || []).push(e); });
  return Object.keys(groups).map((id) => {
    const d = KB_DOMAIN_MAP[id];
    return `<div class="kb-search-group"><div class="kb-search-group-head">${d.icon} ${esc(d.name)}</div>${groups[id].map((e) => `<a class="kb-search-item" href="#kb/entry/${e.id}"><b>${kbHighlight(e.title, q)}</b><span>${kbHighlight(e.summary, q)}</span><small>${KB_TYPE_LABEL[e.type]} · ${esc(e.level)}</small></a>`).join("")}</div>`;
  }).join("");
}
function kbRenderSearchResults() {
  const input = $("#kb-search-input");
  const host = $("#kb-search-results");
  if (!input || !host) return;
  const q = input.value.trim();
  host.innerHTML = kbSearchListHTML(kbSearch(q), q, false);
}

/* ---------- 知识树 / 浮层 ---------- */
function kbTreeLink(e) {
  const active = KB_STATE.route.type === "entry" && KB_STATE.route.id === e.id;
  return `<a class="kb-tree-link${active ? " active" : ""}" href="#kb/entry/${e.id}"><span>${KB_TYPE_LABEL[e.type]}</span>${esc(e.title)}</a>`;
}
function kbBuildTree() {
  const root = $("#kb-tree");
  if (!root) return;
  const cur = KB_STATE.route;
  const curEntry = cur.type === "entry" ? KB_ENTRY_MAP[cur.id] : null;
  root.innerHTML = KB_DOMAINS.map((d) => {
    const list = KB_ENTRIES.filter((e) => e.domain === d.id);
    const dActive = (cur.type === "domain" && cur.domain === d.id) || (curEntry && curEntry.domain === d.id);
    let body = "";
    if (d.id === "attack") {
      body = KB_SUBDOMAINS.filter((s) => s.domain === "attack").map((s) => {
        const es = list.filter((e) => e.subdomain === s.id);
        const sActive = (cur.type === "domain" && cur.domain === "attack" && cur.sub === s.id) || (curEntry && curEntry.subdomain === s.id);
        return `<div class="kb-tree-sub"><a class="kb-tree-subhead${sActive ? " active" : ""}" href="#kb/domain/attack/${s.id}"><span>${s.icon}</span>${esc(s.name)}<em>${es.length}</em></a>${es.map(kbTreeLink).join("")}</div>`;
      }).join("");
    } else {
      body = list.map(kbTreeLink).join("");
    }
    return `<section class="kb-tree-domain"><a class="kb-tree-domainhead${dActive ? " active" : ""}" href="#kb/domain/${d.id}"><span>${d.icon}</span><b>${esc(d.name)}</b><em>${list.length}</em></a>${body}</section>`;
  }).join("");
}
function kbOpenDrawer() {
  kbCloseSearch();
  kbBuildTree();
  const el = $("#kb-drawer");
  if (!el) return;
  KB_STATE.lastFocus = document.activeElement;
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
  const btn = $("#kb-drawer-close");
  if (btn) btn.focus();
}
function kbCloseDrawer() {
  const el = $("#kb-drawer");
  if (el) { el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); }
  if (KB_STATE.lastFocus && KB_STATE.lastFocus.focus) KB_STATE.lastFocus.focus();
}
function kbOpenSearch(initial) {
  kbCloseDrawer();
  const el = $("#kb-search-panel");
  const input = $("#kb-search-input");
  if (!el || !input) return;
  KB_STATE.lastFocus = document.activeElement;
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
  input.value = initial || "";
  kbRenderSearchResults();
  input.focus();
}
function kbCloseSearch() {
  const el = $("#kb-search-panel");
  if (el) { el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); }
  if (KB_STATE.lastFocus && KB_STATE.lastFocus.focus) KB_STATE.lastFocus.focus();
}

/* ---------- 事件 ---------- */
function kbDelegatedClick(e) {
  const dismiss = e.target.closest("[data-kb-dismiss]");
  if (dismiss) { KB_STATE.error = ""; const box = dismiss.closest(".kb-alert"); if (box) box.remove(); return; }
  const close = e.target.closest("[data-kb-close]");
  if (close) { e.preventDefault(); if (close.dataset.kbClose === "drawer") kbCloseDrawer(); else kbCloseSearch(); return; }
  const toc = e.target.closest("[data-kb-toc]");
  if (toc) {
    e.preventDefault();
    const el = document.getElementById(toc.dataset.kbToc);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const read = e.target.closest("[data-kb-read]");
  if (read) { e.preventDefault(); kbToggleRead(read.dataset.kbRead); return; }
  const lvl = e.target.closest("[data-kb-level]");
  if (lvl) { KB_STATE.filter.level = lvl.dataset.kbLevel; kbRenderDomainList(); return; }
  const tag = e.target.closest("[data-kb-tag]");
  if (tag) { KB_STATE.filter.tag = tag.dataset.kbTag; kbRenderDomainList(); return; }
  const act = e.target.closest("[data-kb-action]");
  if (act) {
    e.preventDefault();
    if (act.dataset.kbAction === "exit") kbExit();
    else if (act.dataset.kbAction === "attack") startAttack(true);
    else if (act.dataset.kbAction === "train") startGame();
    return;
  }
  if (e.target.closest("#kb-drawer a")) { kbCloseDrawer(); return; }
  if (e.target.closest("#kb-search-results a")) { kbCloseSearch(); }
}
function kbDelegatedInput(e) {
  if (e.target.id === "kb-home-search") {
    const q = e.target.value.trim();
    KB_STATE.homeQuery = q;
    const host = $("#kb-home-results");
    if (host) host.innerHTML = q ? '<div class="kb-inline-results">' + kbSearchListHTML(kbSearch(q), q, true) + "</div>" : "";
  } else if (e.target.id === "kb-domain-search") {
    KB_STATE.q = e.target.value;
    kbRenderDomainList();
  } else if (e.target.id === "kb-search-input") {
    kbRenderSearchResults();
  }
}
function kbKeydown(e) {
  const search = $("#kb-search-panel");
  const drawer = $("#kb-drawer");
  if (e.key === "Escape") {
    if (search && search.classList.contains("open")) { kbCloseSearch(); e.preventDefault(); return; }
    if (drawer && drawer.classList.contains("open")) { kbCloseDrawer(); e.preventDefault(); return; }
  }
  if (!$("#v-atlas").classList.contains("active")) return;
  const typing = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable;
  if ((e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) && !typing) {
    e.preventDefault();
    kbOpenSearch("");
  }
}
function kbHashChange() {
  const h = location.hash || "";
  if (h === "#kb" || h.indexOf("#kb/") === 0) { kbRender(); return; }
  if ($("#v-atlas").classList.contains("active")) {
    const target = (!kbReturn || kbReturn === "atlas") ? "home" : kbReturn;
    if (target === "home") renderHome();
    show(target);
  }
}

function init() {
  restore();
  const splash = $("#splash");
  if (splash) setTimeout(() => { splash.classList.add("done"); setTimeout(() => splash.remove(), 380); }, 2000);
  Officer.initVoice();
  const pet = $("#hero-pet");
  if (pet) pet.innerHTML = officerChar();
  renderHome();
  $("#b-story").onclick = () => Story.open();
  $("#b-start").onclick = () => startGame();
  $("#b-attack").onclick = () => startAttack(true);
  $("#b-profile").onclick = () => { renderProfile(); show("profile"); };
  $("#b-about").onclick = () => show("about");
  kbRestoreRead();
  $("#b-atlas").onclick = kbOpen;
  $("#b-report-atlas").onclick = kbOpen;
  $("#b-about-atlas").onclick = kbOpen;
  $("#kb-back").onclick = () => { if (KB_STATE.back === "exit") kbExit(); else kbGo(KB_STATE.back); };
  $("#kb-search-btn").onclick = () => kbOpenSearch("");
  $("#kb-tree-btn").onclick = kbOpenDrawer;
  $("#kb-drawer-close").onclick = kbCloseDrawer;
  $("#kb-search-close").onclick = kbCloseSearch;
  document.querySelectorAll("[data-kb-close]").forEach((el) => {
    el.onclick = () => { if (el.dataset.kbClose === "drawer") kbCloseDrawer(); else kbCloseSearch(); };
  });
  document.addEventListener("click", kbDelegatedClick);
  document.addEventListener("input", kbDelegatedInput);
  document.addEventListener("keydown", kbKeydown);
  window.addEventListener("hashchange", kbHashChange);
  kbBuildTree();
  const initialHash = location.hash || "";
  if (initialHash === "#kb" || initialHash.indexOf("#kb/") === 0) kbRender();
  $("#b-home1").onclick = $("#b-home2").onclick = $("#b-home3").onclick = () => { Officer.cancel(); renderHome(); show("home"); };
  $("#b-report-again").onclick = () => startGame();
  $("#b-report-dismantle").onclick = () => startReviewDismantle();
  const vb = $("#a-voice");
  if (vb) vb.onclick = () => Officer.toggle();
  Officer.syncBtn();
  $("#b-reset").onclick = () => {
    if (!confirm("确认清空全部战绩、画像与剧情进度？")) return;
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    S = { dims: freshDims(), missCat: {}, report: null, atk: { round: 1, mode: "genes", slots: {}, history: [], best: null, freeHits: {}, freeText: "", sl: { stealth: 50, aggro: 50, volume: 30 } }, story: freshStory() };
    renderProfile(); renderHome();
  };
}
document.addEventListener("DOMContentLoaded", init);
