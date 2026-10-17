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
function init() {
  restore();
  Officer.initVoice();
  const pet = $("#hero-pet");
  if (pet) pet.innerHTML = officerChar();
  renderHome();
  $("#b-story").onclick = () => Story.open();
  $("#b-more").onclick = () => show("more");
  $("#b-home-more").onclick = () => { renderHome(); show("home"); };
  $("#b-start").onclick = () => startGame();
  $("#b-attack").onclick = () => startAttack(true);
  $("#b-profile").onclick = () => { renderProfile(); show("profile"); };
  $("#b-about").onclick = () => show("about");
  $("#b-home1").onclick = $("#b-home2").onclick = $("#b-home3").onclick = () => { Officer.cancel(); renderHome(); show("home"); };
  $("#b-report-again").onclick = () => startGame();
  $("#b-report-dismantle").onclick = () => startReviewDismantle();
  $("#b-more-report").onclick = () => { renderHome(); show("more"); };
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
