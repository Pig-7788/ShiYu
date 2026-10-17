/* ============ 拦截战 / 拆解台（独立模式模块） ============ */
"use strict";

/* ============ 拦截战（拖拽分拣，10 波后结算） ============ */
const WAVES = [
  { name: "前测侦察", ids: CAMPAIGN.pretest.slice(0, 2), reveal: false },
  { name: "前测侦察", ids: CAMPAIGN.pretest.slice(2, 4), reveal: false },
  { name: "前测侦察", ids: CAMPAIGN.pretest.slice(4), reveal: false },
  { name: "近海拦截", ids: CAMPAIGN.train.slice(0, 2), reveal: true },
  { name: "近海拦截", ids: CAMPAIGN.train.slice(2, 4), reveal: true },
  { name: "深水区", ids: CAMPAIGN.train.slice(4, 6), reveal: true },
  { name: "深水区", ids: CAMPAIGN.train.slice(6, 8), reveal: true },
  { name: "深水区", ids: CAMPAIGN.train.slice(8, 10), reveal: true },
  { name: "终局后测", ids: CAMPAIGN.posttest.slice(0, 2), reveal: false },
  { name: "终局后测", ids: CAMPAIGN.posttest.slice(2), reveal: false },
];
let G = null; // 战局状态
function waveLabel(w) {
  return G && w ? "第 " + (G.waveIdx + 1) + " / " + WAVES.length + " 波 · " + w.name : "";
}
function startGame() {
  Officer.cancel();
  if (G) clearInterval(G.tick);
  G = { waveIdx: 0, cardIdx: 0, lives: 100, score: 0, combo: 0, bestCombo: 0,
        answers: WAVES.map(() => []), sortLog: [] };
  S.dims = freshDims(); S.missCat = {}; S.report = null; store();
  show("game"); nextCard();
}
function exitGame() {
  if (!G) { show("more"); return; }
  if (!confirm("退出拦截战？本局分数不会保留。")) return;
  clearInterval(G.tick);
  Officer.cancel();
  G = null;
  $("#v-game").classList.remove("shake");
  renderHome();
  show("more");
}
function wave() { return G ? WAVES[G.waveIdx] : null; }
function cardFace(q) {
  const bits = q.parts.filter((p) => ["link", "attach", "qr"].includes(p.t)).map((p) =>
    p.t === "link" ? '<div class="cf-link">🔗 ' + esc(p.text) + "</div>" :
    p.t === "attach" ? '<div class="cf-att">📎 ' + esc(p.text) + "</div>" :
    '<div class="cf-qr">▦ ' + esc(p.text) + "</div>").join("");
  const body = '<div class="cf-body">' + esc(plainText(q).slice(0, 110)) + "</div>";
  if (q.carrier === "email") return '<div class="cf-meta">📮 ' + esc(q.meta.from) + " &lt;" + esc(q.meta.addr) + "&gt;</div>" +
    '<div class="cf-subj">' + esc(q.meta.subj) + "</div>" + bits + body;
  if (q.carrier === "sms") return '<div class="cf-meta">💬 ' + esc(q.meta.phone) + "</div>" + bits + body;
  return '<div class="cf-meta">🌐 ' + esc(q.meta.url) + "</div>" + '<div class="cf-subj">' + esc(q.meta.title) + "</div>" + bits;
}
function nextCard() {
  if (!G) return;
  const w = wave();
  if (!w) { finishGame(); return; }
  if (G.cardIdx >= w.ids.length) { startDismantle(); return; }
  const q = SAMPLE_MAP[w.ids[G.cardIdx]];
  G.cur = q; G.locked = false;
  $("#g-phase").textContent = waveLabel(w);
  $("#g-wave").textContent = (G.cardIdx + 1) + "/" + w.ids.length;
  $("#g-timer-txt").textContent = "";
  $("#g-stage").innerHTML = `
    <div class="g-sorter">
      <div class="dropzone dz-phish" id="dzL"><span>钓 鱼</span></div>
      <div class="g-center">
        <div class="g-timerbar" id="g-timerbar"><i id="g-timer" style="width:100%"></i></div>
        <div class="g-card" id="g-card">${cardFace(q)}</div>
        <div class="g-queue" id="g-queue">${"●".repeat(w.ids.length - G.cardIdx - 1) || "○"}</div>
      </div>
      <div class="dropzone dz-safe" id="dzR"><span>正 常</span></div>
    </div>
    <div class="hint">把消息卡<b>拖进</b>左侧渔网（钓鱼）或右侧收件箱（正常）｜电脑可用 ←/→ 键</div>`;
  bindCardDrag(q);
  startCardTimer(q);
}
function startCardTimer(q) {
  if (!G) return;
  const secs = [12, 9, 7][q.difficulty - 1];
  const t0 = Date.now();
  clearInterval(G.tick);
  const tick = () => {
    if (!G || G.locked) { if (G) clearInterval(G.tick); return; }
    const left = secs - (Date.now() - t0) / 1000;
    const bar = $("#g-timer"), wrap = $("#g-timerbar");
    if (bar) { bar.style.width = Math.max(0, (left / secs) * 100) + "%"; }
    if (wrap) wrap.classList.toggle("urgent", left < secs * 0.3);
    if ($("#g-timer-txt")) $("#g-timer-txt").textContent = left > 0 ? "⏱ " + Math.ceil(left) + "s" : "";
    if (left <= 0) { clearInterval(G.tick); if (!G.locked) sortCard(null); }
  };
  tick(); G.tick = setInterval(tick, 200);
}
function bindCardDrag(q) {
  const card = $("#g-card");
  if (!card) return;
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
  card.onpointerdown = (e) => {
    if (!G || G.locked) return;
    dragging = true; sx = e.clientX; sy = e.clientY;
    ox = card.offsetLeft; oy = card.offsetTop;
    card.classList.add("dragging"); SFX.play("pick");
    try { card.setPointerCapture(e.pointerId); } catch (err) {}
  };
  card.onpointermove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    card.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + dx * 0.04 + "deg)";
    const r = card.getBoundingClientRect();
    const L = $("#dzL"), R = $("#dzR");
    if (L && R) {
      const lrect = L.getBoundingClientRect(), rrect = R.getBoundingClientRect();
      L.classList.toggle("hot", r.left < lrect.right - 8);
      R.classList.toggle("hot", r.right > rrect.left + 8);
    }
  };
  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging");
    const r = card.getBoundingClientRect();
    const L = $("#dzL"), R = $("#dzR");
    let side = null;
    if (L && R) {
      const lrect = L.getBoundingClientRect(), rrect = R.getBoundingClientRect();
      L.classList.remove("hot"); R.classList.remove("hot");
      if (r.left < lrect.right - 8) side = "phish";
      else if (r.right > rrect.left + 8) side = "safe";
    }
    if (side) sortCard(side);
    else { card.style.transform = ""; SFX.play("drop"); }
  };
  card.onpointerup = finish; card.onpointercancel = finish;
}
document.addEventListener("keydown", (e) => {
  if (!G || G.locked || !$("#v-game").classList.contains("active") || !$("#g-card")) return;
  if (e.key === "ArrowLeft") { $("#g-card").style.transform = "translateX(-140px)"; setTimeout(() => sortCard("phish"), 120); }
  if (e.key === "ArrowRight") { $("#g-card").style.transform = "translateX(140px)"; setTimeout(() => sortCard("safe"), 120); }
});
function sortCard(side) {
  if (!G || G.locked) return;
  G.locked = true; clearInterval(G.tick);
  const q = G.cur, w = wave();
  const correct = side === (q.phishing ? "phish" : "safe");
  G.answers[G.waveIdx].push({ qid: q.id, correct, timeout: side === null });
  if (side === null) G.sortLog.push({ qid: q.id, kind: "timeout" });
  else G.sortLog.push({ qid: q.id, kind: correct ? "ok" : "wrong" });
  if (correct) {
    G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
    G.score += 100 + (G.combo - 1) * 20;
    SFX.play("good");
    if (G.combo >= 3) { SFX.play("combo"); popCombo(G.combo); }
    badge("good", "✓ 拦截正确");
  } else {
    G.combo = 0; G.lives = Math.max(0, G.lives - 15);
    SFX.play("bad");
    $("#v-game").classList.add("shake"); setTimeout(() => $("#v-game").classList.remove("shake"), 400);
    badge("bad", side === null ? "⏱ 超时漏网" : "✗ 分拣错误");
  }
  refreshHud();
  const card = $("#g-card");
  if (card) card.style.transform = "";
  setTimeout(() => {
    if (!G) return;
    if (w.reveal) {
      const b = $("#g-stage .g-badge");
      if (b) b.innerHTML += '<div style="font-size:12px;font-weight:600;margin-top:4px">真实身份：' + (q.phishing ? "钓鱼样本" : "正常样本") + "</div>";
    }
    G.cardIdx++;
    setTimeout(nextCard, w.reveal ? 850 : 420);
  }, 460);
}
function badge(kind, text) {
  const host = $("#g-stage .g-center") || $("#g-stage");
  const b = document.createElement("div");
  b.className = "g-badge " + kind; b.textContent = text;
  host.appendChild(b);
  setTimeout(() => b.remove(), 1300);
}
function popCombo(n) {
  const host = $("#g-stage");
  const c = document.createElement("div");
  c.className = "combo-pop"; c.textContent = "连击 x" + n + "！";
  host.appendChild(c); setTimeout(() => c.remove(), 1000);
}
function refreshHud() {
  if (!G) return;
  $("#g-score").textContent = G.score;
  $("#g-combo").textContent = G.combo >= 2 ? "连击x" + G.combo : "";
  const lv = $("#g-lives");
  if (lv) { lv.style.width = G.lives + "%"; $("#g-lives-wrap").classList.toggle("low", G.lives <= 40); }
}

/* ============ 拆解台（证物拖放分类） ============ */
let DM = null;
function startDismantle() {
  if (!G) return;
  const w = wave();
  if (!w) { finishGame(); return; }
  const phish = w.ids.map((id) => SAMPLE_MAP[id]).filter((q) => q.phishing);
  if (!phish.length || !w.reveal) { endWave(); return; }
  DM = { list: phish, chips: [], placed: 0 };
  phish.forEach((q) => q.redflags.forEach((r) => DM.chips.push({ q, r, tries: 0, done: false })));
  const slotCats = [...new Set(DM.chips.map((c) => c.r.category))];
  $("#g-phase").textContent = waveLabel(w) + " · 拆解台";
  $("#g-wave").textContent = "证物 " + DM.chips.length;
  $("#g-stage").innerHTML = `
    <div class="hint">把证物<b>拖进</b>对应破绽类别槽（点一下证物可查看内容）</div>
    <div class="dm-board" id="dm-board">
      <div class="dm-src">${phish.map((q) => "📮/💬/🌐 " + esc((q.meta.subj || q.meta.url || q.scene).slice(0, 26))).join("<br>")}</div>
      <div class="dm-chips" id="dm-chips"></div>
      <div class="dm-slots" id="dm-slots">
        ${Object.keys(CATEGORY_NAME).map((k) => '<div class="dm-slot" data-cat="' + k + '"><b>' + CATEGORY_NAME[k] + "</b></div>").join("")}
      </div>
      <div class="dm-inspect" id="dm-inspect">— 点击证物查看内容，拖到类别槽完成归类 —</div>
    </div>
    <button class="btn primary" id="dm-done" style="text-align:center" disabled>完成拆解 →</button>`;
  const chipHost = $("#dm-chips");
  DM.chips.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = "chip-ev"; el.dataset.i = i;
    el.textContent = chipLabel(c.q, c.r).slice(0, 22);
    el.style.left = (6 + (i % 3) * 31 + Math.random() * 6) + "%";
    el.style.top = (Math.floor(i / 3) * 52 + Math.random() * 8) + "px";
    chipHost.appendChild(el);
    c.el = el;
  });
  chipHost.querySelectorAll(".chip-ev").forEach((el) => bindChipDrag(el));
  $("#dm-done").onclick = finishDismantle;
}
function bindChipDrag(el) {
  let sx = 0, sy = 0, moved = false, active = false, pointerId = null;
  el.onpointerdown = (e) => {
    const c = DM && DM.chips[+el.dataset.i];
    if (!c || c.done) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    active = true; pointerId = e.pointerId;
    sx = e.clientX; sy = e.clientY; moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    SFX.play("pick");
  };
  el.onpointermove = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    const c = DM && DM.chips[+el.dataset.i];
    if (!c || c.done) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) {
      el.classList.add("dragging");
      el.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.05)";
      el.style.zIndex = 8;
      const hot = slotAtPoint(e.clientX, e.clientY, ".dm-slot");
      document.querySelectorAll(".dm-slot").forEach((s) => s.classList.toggle("hot", s === hot));
    }
  };
  const resetDrag = () => {
    active = false; pointerId = null;
    el.classList.remove("dragging");
    el.style.transform = ""; el.style.zIndex = "";
    document.querySelectorAll(".dm-slot").forEach((s) => s.classList.remove("hot"));
  };
  const up = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    const c = DM && DM.chips[+el.dataset.i];
    const hitSlot = moved ? slotAtPoint(e.clientX, e.clientY, ".dm-slot") : null;
    resetDrag();
    if (!c || c.done) return;
    if (!moved) { // 点击=查看
      $("#dm-inspect").textContent = "证物内容：" + (partOf(c.q, c.r.target) ? esc(String(partOf(c.q, c.r.target).text).slice(0, 70)) : c.r.category);
      return;
    }
    if (!hitSlot) { SFX.play("drop"); return; }
    c.tries++;
    if (hitSlot.dataset.cat === c.r.category) {
      c.done = true; DM.placed++;
      const tag = document.createElement("span");
      tag.className = "placed" + (c.tries > 1 ? " miss" : "");
      tag.textContent = el.textContent.slice(0, 10);
      hitSlot.appendChild(tag);
      el.remove();
      const dim = DIM_OF_CATEGORY[c.r.category];
      S.dims[dim][c.tries > 1 ? "miss" : "hit"]++;
      if (c.tries > 1) S.missCat[c.r.category] = (S.missCat[c.r.category] || 0) + 1;
      SFX.play("lock");
      $("#g-wave").textContent = "证物 " + (DM.chips.length - DM.placed);
      if (DM.placed >= DM.chips.length) $("#dm-done").disabled = false;
    } else {
      el.classList.add("bounce"); setTimeout(() => el.classList.remove("bounce"), 380);
      SFX.play("bad");
      $("#dm-inspect").textContent = "放错了——「" + el.textContent.slice(0, 12) + "」不属于「" + CATEGORY_NAME[hitSlot.dataset.cat] + "」";
    }
  };
  el.onpointerup = up;
  el.onpointercancel = resetDrag;
  el.onlostpointercapture = resetDrag;
}
function finishDismantle() {
  if (!G || !DM) return;
  const missed = DM.chips.filter((c) => c.tries > 1);
  const html = DM.chips.map((c) =>
    '<div class="flaw ' + (c.tries > 1 ? "miss" : "hit") + '"><div class="f-t">' +
    (c.tries > 1 ? "⚠ 试错后归位" : "✓ 首放命中") + " · " + CATEGORY_NAME[c.r.category] +
    "</div><div class=\"f-d\">" + esc(chipLabel(c.q, c.r)) + "：" + esc(c.r.explain) + "</div></div>").join("");
  G.score += DM.chips.filter((c) => c.tries === 1).length * 50;
  refreshHud();
  $("#g-stage").innerHTML = `
    <div class="xp-head ${missed.length ? "bad" : "good"}">拆 解 判 定</div>
    <div class="officer-wrap" id="officer"></div>
    <div class="dm-verdict">${html}</div>
    <button class="btn primary" id="dm-next" style="text-align:center">下一波 →</button>`;
  const lines = [missed.length
    ? "这波拆解有 " + missed.length + " 个证物放错了槽。看判 定，每个证物我都写了它属于哪类、为什么。"
    : "全部首放命中，漂亮。这一波的破绽语法你已经掌握了。"];
  const topMiss = Object.entries(S.missCat).sort((a, b) => b[1] - a[1])[0];
  if (topMiss && missed.length) lines.push("目前你最常漏的是「" + CATEGORY_NAME[topMiss[0]] + "」：" + DIM_ADVICE[DIM_OF_CATEGORY[topMiss[0]]]);
  Officer.play(lines);
  $("#dm-next").onclick = endWave;
}
function endWave() {
  if (!G) return;
  Officer.cancel();
  G.waveIdx++;
  if (G.waveIdx >= WAVES.length) { finishGame(); return; }
  G.cardIdx = 0; nextCard();
}

document.addEventListener("DOMContentLoaded", () => {
  const b = $("#g-exit");
  if (b) b.onclick = exitGame;
});
