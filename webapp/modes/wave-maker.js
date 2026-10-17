/* ============ 造浪者（独立模式模块） ============ */
"use strict";

/* ============ 造浪者：组装实验室（拖卡+滑杆+预测仪+扫描束） ============ */
const LAB_SLIDERS = [
  { k: "stealth", name: "伪装度", hint: "措辞越自然，越难被话术模型识别" },
  { k: "aggro", name: "激进度", hint: "越咄咄逼人，紧迫特征越明显" },
  { k: "volume", name: "投放量", hint: "群发越多，被样本捕获的概率越大" },
];
let ATK_RUN = 0; // 每次进入/退出实验室递增，阻止旧动画回调串场
function startAttack(fresh) {
  ATK_RUN++;
  Officer.cancel();
  if (fresh || !S.atk) S.atk = { round: 1, mode: S.atk ? S.atk.mode : "genes", slots: {}, history: [], best: S.atk ? S.atk.best : null, freeHits: {}, freeText: S.atk ? S.atk.freeText : "" };
  S.atk.sl = S.atk.sl || { stealth: 50, aggro: 50, volume: 30 };
  S.atk.mode = S.atk.mode || "genes";
  renderAttack(); show("attack");
}
function exitAttack() {
  if (!confirm("退出造浪者？本局装配与回合进度不会保存。")) return;
  ATK_RUN++;
  Officer.cancel();
  renderHome();
  show("more");
}
function labCardFor(slots, key) {
  return GENES.find((x) => x.id === slots[key] && x.group === key) || null;
}
function labSelection(slots) {
  const picked = {};
  for (const group of GENE_GROUPS) {
    const card = labCardFor(slots, group.key);
    if (!card) return null;
    picked[group.key] = card;
  }
  return picked;
}
function labPredict(slots, sl) {
  const picked = labSelection(slots);
  if (!picked) return null;
  const tech = picked.tech.det;
  const skin = picked.skin.det * (1 - sl.stealth / 160);
  const psych = picked.psych.det * (0.55 + sl.aggro / 90);
  const vol = sl.volume * 0.12;
  return Math.round(Math.min(97, 5 + tech + skin + psych + vol));
}
function renderAttack() {
  const a = S.atk;
  if (!a) return;
  a.mode = a.mode || "genes";
  a.slots = a.slots || {};
  a.sl = a.sl || { stealth: 50, aggro: 50, volume: 30 };
  Officer.cancel();
  $("#a-round").textContent = "第 " + a.round + " / 3 回合";
  const st = $("#a-stage");
  if (!st) return;
  if (a.result) { st.innerHTML = a.result; bindAttackResult(); return; }
  if (a.mode === "free") {
    st.innerHTML = `
      <p class="atk-preview">亲手写一封「钓鱼邮件」挑战防线——命中特征会被高亮并计入检出率。</p>
      <div class="mode-tabs">
        <span class="mtab" data-m="genes">🧩 组装实验室</span>
        <span class="mtab on" data-m="free">✍️ 自由撰写</span>
      </div>
      <textarea class="freebox" id="free-text" placeholder="写下你想骗倒别人的「钓鱼邮件」……（仅本平台沙箱内演示）">${esc(a.freeText || "")}</textarea>
      <div id="free-warn" style="font-size:11.5px;color:var(--amber);margin:6px 0"></div>
      <button class="btn danger" id="a-launch-free" style="text-align:center">投放 → 挑战 AI 防线</button>`;
    bindModeTabs();
    const ft = $("#free-text");
    if (ft) ft.oninput = () => { S.atk.freeText = ft.value; };
    const lf = $("#a-launch-free");
    if (lf) lf.onclick = launchFreeAttack;
    return;
  }
  const sl = a.sl;
  const picked = GENE_GROUPS.map((g) => labCardFor(a.slots, g.key));
  const filledCount = picked.filter(Boolean).length;
  const deck = GENES.filter((x) => a.slots[x.group] !== x.id);
  const pred = labPredict(a.slots, sl);
  const status = filledCount >= GENE_GROUPS.length
    ? "三张伪装卡已就位，可以调参投放。"
    : "还差 " + (GENE_GROUPS.length - filledCount) + " 个槽位：把卡片拖到同类型的槽里。";
  const priorScroll = st.scrollTop;
  st.innerHTML = `
    <p class="atk-preview">把三张伪装卡<b>拖进</b>对应槽位，再调滑杆造出你的「钓鱼邮件」——预测仪有误差，真检出率投放后揭晓。</p>
    <div class="mode-tabs">
      <span class="mtab on" data-m="genes">🧩 组装实验室</span>
      <span class="mtab" data-m="free">✍️ 自由撰写</span>
    </div>
    <div class="lab-slots">${GENE_GROUPS.map((g) => {
      const filled = labCardFor(a.slots, g.key);
      return '<div class="lab-slot' + (filled ? " filled" : "") + '" data-slot="' + g.key + '">' +
        (filled ? esc(filled.name) : "拖入「" + g.name + "」") + "</div>";
    }).join("")}</div>
    <div class="lab-deck" id="lab-deck">${deck.map((x) => {
      const icon = x.group === "skin" ? "🎭" : x.group === "psych" ? "🧠" : "🧬";
      return '<div class="lab-card" data-gene="' + x.id +
        '" title="防线暴露值 +' + x.det + '：越高越容易被识破">' +
        '<span class="gi">' + icon + '</span><span class="lab-name">' + esc(x.name) + "</span>" +
        "<small>暴露 +" + x.det + "</small></div>";
    }).join("")}</div>
    <div class="lab-legend">「暴露 +N」= 这张卡被 AI 防线识别的风险；装配成功后卡片会从牌堆移入对应槽位。</div>
    <div class="lab-status" id="lab-status" aria-live="polite"><span>${status}</span>${
      filledCount ? '<button type="button" class="lab-clear" id="a-clear-slots">清空装配</button>' : ""
    }</div>
    <div class="sliders">${LAB_SLIDERS.map((s) =>
      '<div class="srow"><label>' + s.name + "</label>" +
      '<input type="range" min="0" max="100" value="' + sl[s.k] + '" data-sl="' + s.k + '">' +
      '<span class="sval" id="sv-' + s.k + '">' + sl[s.k] + "</span></div>" +
      '<div style="font-size:10.5px;color:var(--txt-dim);margin:-4px 0 4px 98px">' + s.hint + "</div>").join("")}</div>
    <div class="gauge">
      <div class="gauge-bar"><i id="gauge-bar" style="width:' + (pred || 0) + '%"></i></div>
      <div class="gnum" id="gauge-num">${pred != null ? "~" + pred + "%" : "--"}</div>
      <div class="gband">预测检出率 · 误差 ±8 · ≥60% 大概率被防线识破</div>
    </div>
    <button class="btn danger" id="a-launch" style="text-align:center" ${pred != null ? "" : "disabled"}>投放 → 穿越扫描防线</button>`;
  st.scrollTop = priorScroll;
  bindModeTabs();
  st.querySelectorAll(".lab-card").forEach((el) => bindGeneDrag(el));
  st.querySelectorAll('input[type="range"]').forEach((r) => {
    r.oninput = () => {
      sl[r.dataset.sl] = +r.value;
      $("#sv-" + r.dataset.sl).textContent = r.value;
      updateGauge();
    };
  });
  const clear = $("#a-clear-slots");
  if (clear) clear.onclick = () => { S.atk.slots = {}; renderAttack(); };
  const lb = $("#a-launch");
  if (lb) lb.onclick = launchAttack;
}
function bindModeTabs() {
  document.querySelectorAll(".mtab").forEach((t) => {
    t.onclick = () => { S.atk.mode = t.dataset.m; renderAttack(); };
  });
}
function updateGauge() {
  const pred = labPredict(S.atk.slots, S.atk.sl);
  const bar = $("#gauge-bar"), num = $("#gauge-num"), btn = $("#a-launch");
  if (bar) bar.style.width = (pred || 0) + "%";
  if (num) num.textContent = pred != null ? "~" + pred + "%" : "--";
  if (btn) btn.disabled = pred == null;
}
function setLabStatus(text, bad) {
  const box = $("#lab-status");
  if (!box) return;
  const span = box.querySelector("span");
  if (span) span.textContent = text;
  box.classList.toggle("bad", !!bad);
}
function bindGeneDrag(el) {
  let sx = 0, sy = 0, moved = false, active = false, pointerId = null, docUp = null, docMove = null;
  el.draggable = false;
  el.onpointerdown = (e) => {
    // 只有按下后才进入拖拽态；否则鼠标悬停时的 pointermove 会把卡片平移出屏幕。
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (active) resetDrag();
    active = true; pointerId = e.pointerId;
    sx = e.clientX; sy = e.clientY; moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    docMove = (ev) => {
      if (!active || ev.pointerId !== pointerId) return;
      if (typeof el.onpointermove === "function") el.onpointermove(ev);
    };
    document.addEventListener("pointermove", docMove);
    // 指针捕获失败时（例如元素在拖动中被重新渲染），由 document 兜底接收 pointermove / pointerup。
    docUp = (ev) => {
      if (!active || ev.pointerId !== pointerId) return;
      if (ev.type === "pointercancel") resetDrag(); else up(ev);
    };
    document.addEventListener("pointerup", docUp);
    document.addEventListener("pointercancel", docUp);
    e.preventDefault();
    SFX.play("pick");
  };
  el.onpointermove = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) {
      el.classList.add("dragging");
      el.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.06)";
      const hot = slotAtPoint(e.clientX, e.clientY, ".lab-slot");
      document.querySelectorAll(".lab-slot").forEach((s) => s.classList.toggle("hot", s === hot));
    }
  };
  const resetDrag = () => {
    const pid = pointerId;
    active = false; pointerId = null;
    if (docMove) {
      document.removeEventListener("pointermove", docMove);
      docMove = null;
    }
    if (docUp) {
      document.removeEventListener("pointerup", docUp);
      document.removeEventListener("pointercancel", docUp);
      docUp = null;
    }
    if (pid !== null && el.hasPointerCapture && el.hasPointerCapture(pid)) {
      try { el.releasePointerCapture(pid); } catch (err) {}
    }
    el.classList.remove("dragging");
    el.style.transform = "";
    document.querySelectorAll(".lab-slot").forEach((s) => s.classList.remove("hot"));
  };
  const up = (e) => {
    if (!active || e.pointerId !== pointerId) return;
    const g = GENES.find((x) => x.id === el.dataset.gene);
    // pointermove 万一没有送达（捕获失败/浏览器差异），仍用按下与抬起的坐标判断是否发生了拖动。
    const dragged = moved || Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6;
    const slot = dragged ? slotAtPoint(e.clientX, e.clientY, ".lab-slot") : null;
    resetDrag();
    if (!g) return;
    if (!dragged) {
      const groupName = (GENE_GROUPS.find((x) => x.key === g.group) || {}).name || "对应类型";
      setLabStatus("拖动「" + g.name + "」到「" + groupName + "」槽即可装配。");
      return;
    }
    if (!slot) {
      setLabStatus("卡片没有放进槽位，已回到牌堆。");
      return;
    }
    if (slot.dataset.slot !== g.group) {
      const groupName = (GENE_GROUPS.find((x) => x.key === g.group) || {}).name || "对应类型";
      const slotName = (GENE_GROUPS.find((x) => x.key === slot.dataset.slot) || {}).name || "这个槽位";
      slot.classList.add("reject");
      setTimeout(() => slot.classList.remove("reject"), 420);
      SFX.play("bad");
      setLabStatus("「" + g.name + "」属于「" + groupName + "」，不能放进「" + slotName + "」。", true);
      return;
    }
    SFX.play("lock");
    S.atk.slots[slot.dataset.slot] = g.id;
    renderAttack();
  };
  el.onpointerup = up;
  el.onpointercancel = resetDrag;
}
function launchAttack() {
  const a = S.atk, sl = a.sl;
  const picked = labSelection(a.slots);
  if (!picked) return;
  const used = GENE_GROUPS.map((g) => picked[g.key]);
  const tech = picked.tech;
  const skin = picked.skin;
  const psych = picked.psych;
  const token = ATK_RUN;
  const parts = {
    tech: tech.det,
    skin: Math.round(skin.det * (1 - sl.stealth / 160)),
    psych: Math.round(psych.det * (0.55 + sl.aggro / 90)),
    vol: Math.round(sl.volume * 0.12),
  };
  const detect = Math.min(97, 5 + parts.tech + parts.skin + parts.psych + parts.vol);
  const noise = Math.round((Math.random() - 0.5) * 14); // 预测仪 ±8 的真实噪声
  const finalDetect = Math.max(5, Math.min(97, detect + noise));
  const caught = finalDetect >= 60;
  a.history.push({ round: a.round, genes: used.map((g) => g.name), detect: finalDetect, caught });
  if (100 - finalDetect > (a.best ?? -1)) a.best = 100 - finalDetect;
  store();
  a.result = `
    <div class="runway" id="runway">
      <span class="runner">✉️</span>
      <div class="beam" style="left:28%" id="beam-tech"></div>
      <div class="beam" style="left:50%" id="beam-skin"></div>
      <div class="beam" style="left:72%" id="beam-psych"></div>
    </div>
    <div class="detect-bar"><i id="dbar"></i></div>
    <div class="detect-num"><span id="dnum">0</span>%</div>
    <div class="verdict ${caught ? "caught" : "escape"}" id="a-verdict" style="opacity:0;transition:opacity .4s"></div>
    <div class="officer-wrap" id="officer"></div>
    <div class="chips" id="officer-chips"></div>
    <button class="btn primary" style="text-align:center" id="a-next"></button>`;
  renderAttack();
  const verdict = $("#a-verdict");
  const live = (fn) => { if (token === ATK_RUN) fn(); };
  setTimeout(() => live(() => {
    if (parts.tech >= 20 && $("#beam-tech")) $("#beam-tech").classList.add("hit");
  }), 650);
  setTimeout(() => live(() => { if (parts.skin + parts.psych >= 18 && $("#beam-skin")) $("#beam-skin").classList.add("hit"); }), 1100);
  setTimeout(() => live(() => { if (parts.psych >= 15 && $("#beam-psych")) $("#beam-psych").classList.add("hit"); }), 1550);
  setTimeout(() => live(() => { if (verdict) { verdict.style.opacity = 1; verdict.textContent = caught ? "🛡 防线识破了你的造物" : "🩸 你的造物咬中了数据化身"; } }), 2100);
  setTimeout(() => live(() => { const b = $("#dbar"); if (b) b.style.width = finalDetect + "%"; }), 2200);
  let n = 0;
  const iv = setInterval(() => {
    if (token !== ATK_RUN) { clearInterval(iv); return; }
    n += Math.ceil(finalDetect / 24);
    if (n >= finalDetect) { n = finalDetect; clearInterval(iv); }
    const el = $("#dnum"); if (el) el.textContent = n;
  }, 40);
  const script = [caught
    ? `拦截成功，检出率 ${finalDetect}%（预测仪只估了 ${detect}%——防线总有一点你猜不到的余量）。`
    : `警报，检出率只有 ${finalDetect}%。它咬中化身了。`]
    .concat(tech.det > 0 ? ["技术伪装「" + tech.name + "」贡献 " + parts.tech + " 点。伪装度 " + sl.stealth + " 削弱不了技术特征。"] : [])
    .concat(parts.skin > 0 ? ["身份伪装「" + skin.name + "」经伪装度削弱后仍贡献 " + parts.skin + " 点。"] : ["身份伪装被你的高伪装度完全洗白了。"])
    .concat(parts.psych > 0 ? ["心理话术「" + psych.name + "」在激进度 " + sl.aggro + " 下贡献 " + parts.psych + " 点。"] : [])
    .concat(sl.volume >= 60 ? ["投放量 " + sl.volume + " 太大，样本人群里一定有防线的眼线（+" + parts.vol + "）。"] : []);
  const know = used.slice().sort((x, y) => y.det - x.det)[0];
  if (know) script.push("记一条：" + know.knowledge);
  const nextBtn = $("#a-next");
  if (nextBtn) {
    nextBtn.textContent = a.round < 3 ? "下一回合 →" : "查看复盘 →";
    nextBtn.style.display = "";
    nextBtn.onclick = () => {
      if (token !== ATK_RUN) return;
      if (a.round < 3) { a.round++; a.result = null; }
      else { a.round = 1; a.result = reviewHTML(); }
      renderAttack();
    };
  }
  setTimeout(() => live(() => Officer.play(script, true, caught ? "happy" : "alert")), 2400);
}
/* 自由撰写 */
const FREE_RULES = [
  { k: "urg", name: "紧迫限时", cls: "hl-urg", det: 14, re: /(立即|马上|尽快|\d+\s*分钟内|\d+\s*小时内|今日内|逾期|限时|过期|作废|停用)/g, know: "倒计时话术是为了压缩你的思考时间——先停一分钟，再走官方渠道核实。" },
  { k: "rew", name: "利诱返利", cls: "hl-rew", det: 16, re: /(返利|中奖|赔付|补偿|领取|补贴|佣金|免费领|双倍|日入)/g, know: "无来由的好处就是鱼钩——先问自己：为什么是我？" },
  { k: "aut", name: "冒充权威", cls: "hl-aut", det: 10, re: /(客服|官方|公安|检察院|法院|银行|教务处|财务处|资助中心|管理员|老师)/g, know: "身份可以随便编，核验渠道不能跟对方走。" },
  { k: "pi", name: "索要敏感信息", cls: "hl-pi", det: 15, re: /(验证码|密码|银行卡号|身份证号|手机号)/g, know: "任何环节索要验证码/密码，直接判定为诈骗。" },
  { k: "lnk", name: "可疑链接", cls: "hl-lnk", det: 18, re: /(t\.cn\/|dwz\.cn\/|url\.cn\/|bit\.ly\/|\d+\.\d+\.\d+\.\d+|http:\/\/)/g, know: "短链与裸 IP 无法预览真实指向，一律按不可信入口处理。" },
  { k: "att", name: "附件诱导", cls: "hl-att", det: 9, re: /(见附件|附件|点击下载|打开附件|启用宏)/g, know: "让你运行程序或启用宏的来信，基本可以直接删除。" },
];
function scanFreeText(text) {
  const hits = []; let det = 5;
  FREE_RULES.forEach((r) => {
    const ms = [...String(text).matchAll(r.re)].map((m) => m[0]);
    const uniq = [...new Set(ms)];
    if (uniq.length) { hits.push({ ...r, matches: uniq, n: ms.length }); det += r.det + Math.min(6, (ms.length - 1) * 2); }
  });
  return { hits, detect: Math.min(97, det) };
}
function highlightFree(text) {
  let out = esc(text);
  FREE_RULES.forEach((r) => {
    [...String(text).matchAll(r.re)].map((m) => m[0]).filter((v, i, a) => a.indexOf(v) === i).forEach((w) => {
      out = out.split(esc(w)).join('<span class="hl ' + r.cls + '">' + esc(w) + "</span>");
    });
  });
  return out;
}
function launchFreeAttack() {
  const a = S.atk;
  const token = ATK_RUN;
  const text = (a.freeText || "").trim();
  if (text.length < 10) { const box = $("#free-warn"); if (box) box.textContent = "至少写 10 个字——你的「钓鱼邮件」太敷衍，防线懒得分析。"; return; }
  const { hits, detect } = scanFreeText(text);
  const caught = detect >= 60;
  a.history.push({ round: a.round, genes: ["自由撰写"], detect, caught, free: true });
  hits.forEach((h) => { a.freeHits = a.freeHits || {}; a.freeHits[h.k] = (a.freeHits[h.k] || 0) + h.n; });
  if (100 - detect > (a.best ?? -1)) a.best = 100 - detect;
  store();
  a.result = `
    <p class="atk-preview" style="color:var(--txt-dim)">你亲笔写的「钓鱼邮件」（命中特征已高亮）：<br>
      <span class="freebox" style="display:block">${highlightFree(text)}</span></p>
    <div class="detect-bar"><i id="dbar"></i></div>
    <div class="detect-num"><span id="dnum">0</span>%</div>
    <div class="verdict ${caught ? "caught" : "escape"}">${caught ? "🛡 AI 防线识破了你的手笔" : "🩸 你的手笔咬中了数据化身"}</div>
    <div class="officer-wrap" id="officer"></div>
    <div class="chips" id="officer-chips"></div>
    <button class="btn primary" style="text-align:center" id="a-next">${a.round < 3 ? "下一回合 →" : "查看复盘 →"}</button>`;
  renderAttack();
  const live = (fn) => { if (token === ATK_RUN) fn(); };
  setTimeout(() => live(() => { const b = $("#dbar"); if (b) b.style.width = detect + "%"; }), 60);
  let n = 0;
  const iv = setInterval(() => {
    if (token !== ATK_RUN) { clearInterval(iv); return; }
    n += Math.ceil(detect / 24);
    if (n >= detect) { n = detect; clearInterval(iv); }
    const el = $("#dnum"); if (el) el.textContent = n;
  }, 40);
  const script = [caught ? `手笔不小，但检出率 ${detect}%。你写的每个陷阱词，都在规则库里。` : `检出率只有 ${detect}%——你已经会写「看起来正常」的坏邮件了，这更说明训练的必要。`]
    .concat(hits.slice(0, 3).map((h) => `${h.name}命中「${h.matches.slice(0, 3).join("、")}」。${h.know}`));
  if (!hits.length) script.push("全文没有命中任何攻击特征——那它就只是一封普通邮件。加点「料」再来看防线反应。");
  setTimeout(() => live(() => Officer.play(script, true, caught ? "happy" : "alert")), 900);
}
function bindAttackResult() {
  const a = S.atk;
  const more = $("#a-home");
  if (more) more.onclick = () => { Officer.cancel(); renderHome(); show("more"); };
  const restart = $("#a-restart");
  if (restart) restart.onclick = () => {
    S.atk = { round: 1, mode: "genes", slots: {}, history: [], best: a.best, freeHits: a.freeHits, freeText: a.freeText, sl: a.sl };
    renderAttack();
  };
  if (document.querySelector("#officer") && a.result && a.result.includes("攻 防 复 盘") && !a._reviewSpoken) {
    a._reviewSpoken = true;
    Officer.play([
      "三回合结束。看看战报——你用过的每张伪装卡，我都翻译成了一条防御知识。",
      `你的最佳逃脱检出率 ${a.best}%。提醒一句：逃脱不是荣誉，它度量的是现实中防线的缺口。`,
    ]);
  }
}
function reviewHTML() {
  const a = S.atk;
  const usedIds = [...new Set(a.history.flatMap((h) => h.genes))];
  return `
    <div class="xp-head good">攻 防 复 盘</div>
    <div class="card"><h3>三回合战报</h3><ul class="advice">${a.history.map((h) =>
      "<li>第" + h.round + "回合（" + h.genes.join(" + ") + "）：检出率 <b>" + h.detect + "%</b> " + (h.caught ? "· 被识破" : "· 逃脱") + "</li>").join("")}</ul></div>
    <div class="officer-wrap" id="officer"></div>
    <div class="chips" id="officer-chips"></div>
    <div class="card"><h3>你用过的每张伪装卡，都是一条防御知识</h3><ul class="advice">${GENES.filter((g) => usedIds.includes(g.name)).map((g) =>
      "<li><b>" + g.name + "</b>：" + esc(g.knowledge) + "</li>").join("")}</ul></div>
    ${a.freeHits && Object.keys(a.freeHits).length ? '<div class="card"><h3>自由撰写·你触发过的检测规则</h3><ul class="advice">' +
      FREE_RULES.filter((r) => a.freeHits[r.k]).map((r) => "<li><b>" + r.name + "</b>（触发 " + a.freeHits[r.k] + " 次）：" + r.know + "</li>").join("") + "</ul></div>" : ""}
    <p style="text-align:center;color:var(--txt-dim);font-size:12px">最佳逃脱检出率：${a.best}%</p>
    <button class="btn primary" style="text-align:center" id="a-restart">再来三回合</button>
    <button class="btn" style="text-align:center" id="a-home">返回玩法选择</button>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const b = $("#a-exit");
  if (b) b.onclick = exitAttack;
});
