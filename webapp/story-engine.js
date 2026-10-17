/* ============ 识渔计划 · 剧情模式引擎 ============ */
/* 线性主线：学费 → 学长 → 饰品 → 修电脑 → 代刷
   规则：第五章结束后统计五章的好结局数量；
        好结局 ≤ 2 章进入终章「回血」，固定走坏结局；
        好结局 ≥ 3 章不进入终章，直接走主线好结局。 */
"use strict";

const STORY_ORDER = ["tuition", "senior", "cs-steam", "repair", "daishua"];
const STORY_FINALE = "revenge";
const STORY_TOTAL = STORY_ORDER.length;
/* 默认：本章只要选错一次就是坏结局；代刷按最后一次选择判定（止损成功仍算好结局） */
const STORY_ENDING_MODE = { daishua: "finalCorrect" };

function freshStory() {
  return {
    phase: "home",        // home | intro | event | outcome | episodeEnd | final
    idx: 0,               // 0-4 前五章；5 表示终章
    storyId: null,
    eventId: null,
    page: 0,              // 当前故事正文页
    wrongInStory: 0,
    choicesInStory: 0,
    lastCorrect: null,
    outcomeKind: null,    // onRight | onWrong | onWrongA | onWrongB
    route: null,          // {type:"event",id} | {type:"ending",kind}
    results: [],          // [{id, ending, wrong, choices}]
    final: null,          // good | bad
    completed: false,
    review: null          // 重读：{ id, snapshot, kind }
  };
}

function storyWorld() { return (typeof STORY_WORLD !== "undefined") ? STORY_WORLD : {}; }
function storyData(id) { return (window.STORY_REGISTRY || {})[id] || null; }
function storyCurrent() { return storyData(S.story.storyId); }
function storyEvent(story, id) {
  return (story && story.events) ? story.events.find((e) => e.id === id) : null;
}

/* ---------- 故事正文分页 ---------- */
/* 把长段落按句号切成可控的小块，避免单块超出固定文本框 */
function storySplitText(text, maxLen) {
  const s = String(text || "").trim();
  if (!s) return [];
  if (s.length <= maxLen) return [s];
  const pieces = s.match(/[^。！？!?…；;]+[。！？!?…；;]*/g) || [s];
  const out = [];
  let buf = "";
  pieces.forEach((piece) => {
    let p = piece;
    if (p.length > maxLen) {
      if (buf) { out.push(buf); buf = ""; }
      for (let i = 0; i < p.length; i += maxLen) out.push(p.slice(i, i + maxLen));
      return;
    }
    if (buf && (buf + p).length > maxLen) { out.push(buf); buf = ""; }
    buf += p;
  });
  if (buf) out.push(buf);
  return out.length ? out : [s];
}

function storyTextBlocks(lines, cls, maxLen) {
  const out = [];
  (lines || []).forEach((text) => {
    storySplitText(text, maxLen || 48).forEach((chunk) => {
      out.push({
        html: "<p" + (cls ? ' class="' + cls + '"' : "") + ">" + esc(chunk) + "</p>"
      });
    });
  });
  return out;
}

/* 邮件/聊天统一渲染为引用卡片：发件人只在卡片头部出现一次 */
function storyChatBlocks(messages) {
  const out = [];
  let group = 0;
  const stageWidth = (document.querySelector("#wrap") || {}).clientWidth || window.innerWidth || 0;
  const quoteMax = stageWidth <= 320 ? 32 : 44;
  (messages || []).forEach((m) => {
    const sender = m.sender || "";
    const narration = /^[（(]/.test(sender) || /系统|旁白/.test(sender);
    if (narration || !sender) {
      out.push.apply(out, storyTextBlocks(m.lines || [], "", 48));
      return;
    }
    const id = "q" + (group++);
    let first = true;
    (m.lines || []).forEach((line) => {
      storySplitText(line, quoteMax).forEach((chunk) => {
        out.push({
          html: '<p class="story-quote-line">' + esc(chunk) + "</p>",
          quote: { group: id, sender: sender, start: first }
        });
        first = false;
      });
    });
  });
  return out;
}

/* 把当前页的块拼成 HTML：连续引用块合成一张卡片，跨页时加“续” */
function storyPageHTML(blocks) {
  const list = blocks || [];
  let html = "";
  let i = 0;
  while (i < list.length) {
    const b = list[i];
    const q = (b && typeof b === "object") ? b.quote : null;
    if (q) {
      const group = q.group;
      const body = [];
      while (i < list.length && list[i] && typeof list[i] === "object" &&
             list[i].quote && list[i].quote.group === group) {
        body.push(list[i].html || "");
        i++;
      }
      html += '<div class="story-quote"><div class="story-quote-head">' +
        esc(q.sender) + (q.start ? "" : '<span class="quote-cont">续</span>') +
        "</div>" + body.join("") + "</div>";
    } else {
      html += (b && typeof b === "object") ? (b.html || "") : (b || "");
      i++;
    }
  }
  return html || '<p class="story-empty">……</p>';
}

/* 按真实高度分页：每次用最终页 HTML 测量，卡片边框/内边距/续页标识都计入 */
function storyPaginate(blocks, host) {
  const list = (blocks && blocks.length) ? blocks.slice() : [{
    html: '<p class="story-empty">……</p>'
  }];
  const limit = (host.clientHeight || 0) - 2;
  const width = host.clientWidth || 0;
  if (limit < 40 || width < 40) return [list];

  const probe = document.createElement("div");
  probe.className = "story-text story-probe";
  probe.style.width = (width - 2) + "px";
  document.body.appendChild(probe);

  const pages = [];
  let cur = [];
  list.forEach((block) => {
    cur.push(block);
    probe.innerHTML = storyPageHTML(cur);
    if (probe.getBoundingClientRect().height > limit && cur.length > 1) {
      cur.pop();
      pages.push(cur);
      cur = [block];
      probe.innerHTML = storyPageHTML(cur);
    }
  });
  if (cur.length) pages.push(cur);
  probe.remove();
  return pages.length ? pages : [list];
}

function storyScrollTop() {
  const app = $("#app");
  if (app) app.scrollTop = 0;
  window.scrollTo(0, 0);
}

function chapterPhase(st) {
  return st.storyId === STORY_FINALE ? "终 章" : "第 " + (st.idx + 1) + " 章";
}

/* 五章中已达成好结局的章节数 */
function storyGoodCount(st) {
  return ((st && st.results) || []).filter((r) => r.ending === "good").length;
}

/* 好结局 ≤ 2 章时进入终章；否则第五章结束后直接进入主线好结局 */
function storyFinaleUnlocked(st) {
  return ((st && st.results) || []).length >= STORY_TOTAL && storyGoodCount(st) <= 2;
}

const Story = {
  open() {
    if (!S.story || !Array.isArray(S.story.results)) S.story = Object.assign(freshStory(), S.story || {});
    show("story");
    if (S.story.review && S.story.phase !== "home") this.renderCurrent();
    else this.renderStoryHome();
  },

  renderStoryHome() {
    const st = S.story || (S.story = freshStory());
    const started = st.phase !== "home" || st.results.length > 0 || !!st.final;
    $("#st-phase").textContent = "剧 情 模 式";
    $("#st-progress").textContent = st.final
      ? (st.final === "good" ? "主线 · 好结局" : "终章 · 坏结局")
      : (st.storyId === STORY_FINALE
          ? "终章 · 进行中"
          : (st.results.length ? "已完成 " + st.results.length + " / " + STORY_TOTAL + " 章" : "未开始"));

    const chapters = STORY_ORDER.map((id, i) => {
      const d = storyData(id);
      const r = st.results.find((x) => x.id === id);
      let cls = "locked", status = "未解锁";
      if (r) {
        cls = r.ending;
        status = r.ending === "good" ? "已读 · 好结局" : "已读 · 坏结局";
      } else if (st.storyId === id && st.phase !== "final") {
        cls = "current";
        status = "进行中";
      } else if (i === 0 && !started) {
        cls = "";
        status = "待开始";
      } else if (i === st.results.length && !st.final) {
        cls = "";
        status = "下一章";
      }
      return this.chapterRow({
        id: id,
        cls: cls,
        title: d ? d.title : id,
        status: status,
        review: !!r
      });
    }).join("");

    let fCls = "locked", fStatus = "未解锁 · 好结局章节须 ≤ 2", fReview = false;
    if (st.final === "bad") {
      fCls = "bad";
      fStatus = "已达成 · 坏结局";
      fReview = true;
    } else if (st.final === "good") {
      fCls = "locked";
      fStatus = "本周目未开启";
    } else if (storyFinaleUnlocked(st)) {
      fCls = "current";
      fStatus = st.storyId === STORY_FINALE ? "进行中" : "已解锁";
    }
    const fd = storyData(STORY_FINALE);
    const finale = this.chapterRow({
      id: STORY_FINALE,
      cls: fCls,
      title: fd ? fd.title : "终章 · 回血",
      status: fStatus,
      review: fReview
    });

    $("#story-stage").innerHTML = `
      <div class="story-home">
        <p class="story-lead">五个故事改编自校园里真实发生过的骗局。顺序固定，每一次选择都会被记住。已读章节可以点击重读，不会影响当前剧情进度。</p>
        <div class="story-chapters">${chapters}${finale}</div>
        <div class="story-actions">
          <button class="btn primary" data-act="${started ? "resume" : "new"}">${started ? "继续剧情" : "开始剧情"}</button>
          ${started ? '<button class="btn" data-act="new">重新开始</button>' : ""}
          <button class="btn" data-act="backHome">返回首页</button>
        </div>
        <p class="story-note">规则：五章结束后统计好结局章节，好结局不超过 2 章会解锁终章「回血」并进入坏结局；好结局达到 3 章及以上则直接进入主线好结局。</p>
      </div>`;
    this.bindStage();
    storyScrollTop();
  },

  chapterRow(opts) {
    const tag = opts.review ? "button" : "div";
    const attrs = opts.review
      ? ' type="button" data-review="' + esc(opts.id) + '" title="重读本章"'
      : "";
    return "<" + tag + ' class="story-chapter ' + opts.cls + '"' + attrs + '><span class="nm">' +
      esc(opts.title) + '</span><span class="st ' + opts.cls + '">' + opts.status +
      (opts.review ? ' <span class="replay-hint">↻ 重读</span>' : "") + "</span></" + tag + ">";
  },

  bindStage() {
    const stage = $("#story-stage");
    stage.querySelectorAll("[data-act]").forEach((b) => {
      b.onclick = () => this.act(b.dataset.act);
    });
    stage.querySelectorAll("[data-choice]").forEach((b) => {
      b.onclick = () => this.choose(Number(b.dataset.choice));
    });
    stage.querySelectorAll("[data-review]").forEach((b) => {
      b.onclick = () => this.reviewChapter(b.dataset.review);
    });
  },

  act(act) {
    if (act === "new") this.startNew();
    else if (act === "resume") this.resume();
    else if (act === "startChapter") this.startEvents();
    else if (act === "outcomeNext") this.applyRoute();
    else if (act === "nextChapter") this.nextChapter();
    else if (act === "finale") this.enterFinale();
    else if (act === "finalGood") this.finishCampaign("good");
    else if (act === "reviewAgain") this.reviewAgain();
    else if (act === "storyHome") { this.exitReview(); this.renderStoryHome(); }
    else if (act === "backHome") { this.exitReview(); renderHome(); show("home"); }
    else if (act === "pagePrev") this.page(-1);
    else if (act === "pageNext") this.page(1);
  },

  startNew() {
    const old = S.story;
    if (old && (old.phase !== "home" || old.results.length || old.final)) {
      if (!confirm("重新开始会清空当前剧情进度，确认？")) return;
    }
    S.story = freshStory();
    S.story.phase = "intro";
    S.story.idx = 0;
    S.story.storyId = STORY_ORDER[0];
    store();
    show("story");
    this.renderIntro();
  },

  resume() {
    const st = S.story;
    if (!st) return this.startNew();
    if (st.final) return this.renderFinal(st.final);
    if (st.phase === "home") {
      if (st.storyId && st.results.length) st.phase = "intro";
      else return this.renderStoryHome();
    }
    this.renderCurrent();
  },

  /* 按当前存档阶段重绘（翻页 / 窗口尺寸变化时复用） */
  renderCurrent() {
    const st = S.story;
    if (!st) return this.renderStoryHome();
    if (st.final) return this.renderFinal(st.final);
    switch (st.phase) {
      case "intro": return this.renderIntro();
      case "event": return this.renderEvent();
      case "outcome": return this.renderOutcome();
      case "episodeEnd": {
        if (st.review) return this.renderEpisodeEnding(st.review.kind || "bad");
        const r = st.results.find((x) => x.id === st.storyId);
        return this.renderEpisodeEnding(r ? r.ending : "bad");
      }
      case "final": return this.renderFinal(st.final || "good");
      default: return this.renderStoryHome();
    }
  },

  /* 故事正文翻页：页码由 reader 在测量后夹紧 */
  page(delta) {
    const st = S.story;
    if (!st) return;
    st.page = Math.max(0, (st.page || 0) + delta);
    store();
    this.renderCurrent();
  },

  /* 已读章节重读：保存本周目进度快照，读完可完整还原 */
  reviewChapter(id, keepSnapshot) {
    const st = S.story;
    if (!st || !storyData(id)) return;
    const source = (st.review && st.review.snapshot) || st;
    const done = (source.results || []).find((r) => r.id === id);
    const finaleDone = id === STORY_FINALE && source.final === "bad";
    if (!done && !finaleDone) return;
    const idx = id === STORY_FINALE ? STORY_TOTAL : STORY_ORDER.indexOf(id);
    if (idx < 0) return;

    const snapshot = keepSnapshot || (() => {
      const copy = JSON.parse(JSON.stringify(st));
      delete copy.review;
      return copy;
    })();

    st.review = { id: id, snapshot: snapshot, kind: null };
    st.idx = idx;
    st.storyId = id;
    st.phase = "intro";
    st.eventId = null;
    st.page = 0;
    st.outcomeKind = null;
    st.route = null;
    st.wrongInStory = 0;
    st.choicesInStory = 0;
    st.lastCorrect = null;
    st.final = null;
    st.completed = false;
    store();
    this.renderIntro();
    storyScrollTop();
  },

  reviewAgain() {
    const r = S.story && S.story.review;
    if (r) this.reviewChapter(r.id, r.snapshot);
  },

  /* 重读结束/中途退出：还原进入重读前的剧情进度 */
  exitReview() {
    const st = S.story;
    if (!st || !st.review) return false;
    const restored = JSON.parse(JSON.stringify(st.review.snapshot || {}));
    delete restored.review;
    S.story = Object.assign(freshStory(), restored);
    store();
    return true;
  },

  /* 统一的固定高度阅读器：正文分页，末页才显示选择/继续按钮 */
  renderReader(opts) {
    const st = S.story;
    $("#st-phase").textContent = opts.phase || chapterPhase(st);
    $("#st-progress").textContent = opts.progress || "";
    $("#story-stage").innerHTML = `
      <div class="story-screen">
        <div class="story-head">
          <div class="story-head-row">
            <div class="story-kicker">${opts.kicker || ""}</div>
            <button class="story-home-link" data-act="storyHome">剧情主页</button>
          </div>
          <h2 class="story-title${opts.titleClass ? " " + opts.titleClass : ""}">${esc(opts.title || "")}</h2>
        </div>
        <div class="story-reader">
          <div class="story-text" id="story-text"></div>
          <div class="story-pagebar" id="story-pagebar"></div>
        </div>
        <div class="story-actions is-waiting" id="story-actions">
          <div class="story-actions-inner">${opts.actions || ""}</div>
          <div class="story-wait">继续阅读至最后一页</div>
        </div>
      </div>`;

    const host = $("#story-text");
    const pages = storyPaginate(opts.blocks || [], host);
    const total = pages.length;
    const page = Math.max(0, Math.min(st.page || 0, total - 1));
    st.page = page;
    host.innerHTML = storyPageHTML(pages[page]);

    const bar = $("#story-pagebar");
    bar.innerHTML = total > 1
      ? '<button class="story-pgbtn" data-act="pagePrev"' + (page <= 0 ? " disabled" : "") + '>← 上一页</button>' +
        '<span class="story-pageinfo">第 ' + (page + 1) + " / " + total + " 页</span>" +
        '<button class="story-pgbtn" data-act="pageNext"' + (page >= total - 1 ? " disabled" : "") + '>下一页 →</button>'
      : '<span class="story-pageinfo">全文已显示</span>';

    const last = page >= total - 1;
    $("#story-actions").classList.toggle("is-waiting", !last);
    this.bindStage();
    storyScrollTop();
  },

  renderIntro() {
    const st = S.story, d = storyCurrent();
    if (!d) return this.renderStoryHome();
    const isFinale = st.storyId === STORY_FINALE;
    const review = !!st.review;
    this.renderReader({
      kicker: review ? "REPLAY · 重读" : (isFinale ? "FINALE · 回血" : "CHAPTER " + (st.idx + 1)),
      title: d.title,
      phase: chapterPhase(st),
      progress: review
        ? "重读 · " + (isFinale ? "终章" : "第 " + (st.idx + 1) + " 章")
        : (isFinale ? "FINALE" : "CHAPTER " + (st.idx + 1) + " / " + STORY_TOTAL),
      blocks: storyTextBlocks((d.intro && d.intro.length) ? d.intro : ["（本章暂无简介）"]),
      actions: '<button class="btn primary" data-act="startChapter">开始本章</button>'
    });
  },

  startEvents() {
    const d = storyCurrent();
    if (!d || !d.events || !d.events.length) return this.finishEpisode();
    S.story.phase = "event";
    S.story.eventId = d.events[0].id;
    S.story.page = 0;
    S.story.wrongInStory = 0;
    S.story.choicesInStory = 0;
    S.story.lastCorrect = null;
    store();
    this.renderEvent();
  },

  renderEvent() {
    const st = S.story, d = storyCurrent(), ev = storyEvent(d, st.eventId);
    if (!d) return this.renderStoryHome();
    if (!ev) return this.finishEpisode();
    const blocks = [].concat(
      storyTextBlocks(ev.scene || []),
      storyTextBlocks(ev.systemState || [], "story-secondary"),
      storyChatBlocks(ev.messages || [])
    );
    const choices = (ev.choices || []).map((c, i) =>
      '<button class="story-choice" data-choice="' + i + '"><span class="idx">' + (i + 1) + "</span>" + esc(c.text) + "</button>"
    ).join("");
    this.renderReader({
      kicker: st.review ? "REPLAY · 重读" : (st.storyId === STORY_FINALE ? "FINALE" : "CHAPTER " + (st.idx + 1)),
      title: d.title,
      phase: chapterPhase(st),
      progress: st.review
        ? "重读 · " + (st.storyId === STORY_FINALE ? "终章" : "第 " + (st.idx + 1) + " 章")
        : (st.storyId === STORY_FINALE ? "FINALE" : "第 " + (st.idx + 1) + " / " + STORY_TOTAL + " 章"),
      blocks,
      actions: choices
        ? '<div class="story-choices">' + choices + "</div>"
        : '<button class="btn primary" data-act="outcomeNext">继续</button>'
    });
  },

  choose(i) {
    const st = S.story, d = storyCurrent(), ev = storyEvent(d, st.eventId);
    if (!d || !ev || !ev.choices || !ev.choices[i]) return;
    const c = ev.choices[i];
    const wrong = !c.correct;
    st.wrongInStory += wrong ? 1 : 0;
    st.choicesInStory += 1;
    st.lastCorrect = !!c.correct;

    let kind = null;
    if (wrong && c.wrongPath === "A" && ev.onWrongA) kind = "onWrongA";
    else if (wrong && c.wrongPath === "B" && ev.onWrongB) kind = "onWrongB";
    else if (c.correct && ev.onRight) kind = "onRight";
    else if (wrong && ev.onWrong) kind = "onWrong";
    st.outcomeKind = kind;

    if (c.next) st.route = { type: "event", id: c.next };
    else if (c.ending) st.route = { type: "ending", kind: c.ending };
    else st.route = { type: "ending", kind: c.correct ? "good" : "bad" };

    st.phase = "outcome";
    st.page = 0;
    store();
    SFX.play(c.correct ? "good" : "bad");
    this.renderOutcome();
  },

  renderOutcome() {
    const st = S.story, d = storyCurrent(), ev = storyEvent(d, st.eventId);
    if (!d) return this.renderStoryHome();
    const lines = (ev && st.outcomeKind && ev[st.outcomeKind]) ? ev[st.outcomeKind] : [];
    if (!lines.length) return this.applyRoute();
    this.renderReader({
      kicker: st.review ? "REPLAY · 重读" : (st.storyId === STORY_FINALE ? "FINALE" : "CHAPTER " + (st.idx + 1)),
      title: d.title,
      phase: chapterPhase(st),
      progress: st.review
        ? "重读 · " + (st.storyId === STORY_FINALE ? "终章" : "第 " + (st.idx + 1) + " 章")
        : (st.storyId === STORY_FINALE ? "FINALE" : "第 " + (st.idx + 1) + " / " + STORY_TOTAL + " 章"),
      blocks: storyTextBlocks(lines),
      actions: '<button class="btn primary" data-act="outcomeNext">继续</button>'
    });
  },

  applyRoute() {
    const st = S.story, d = storyCurrent(), route = st.route;
    st.route = null;
    st.outcomeKind = null;
    if (!route) return this.finishEpisode();
    if (route.type === "event") {
      const ev = storyEvent(d, route.id);
      if (!ev) return this.finishEpisode();
      st.eventId = route.id;
      st.phase = "event";
      st.page = 0;
      store();
      return this.renderEvent();
    }
    this.finishEpisode(route.kind);
  },

  finishEpisode(kind) {
    const st = S.story, d = storyCurrent();
    if (!d) return this.renderStoryHome();
    let finalKind = kind || null;
    if (!finalKind) {
      const mode = STORY_ENDING_MODE[d.id] || "anyWrong";
      if (mode === "finalCorrect") finalKind = st.lastCorrect ? "good" : "bad";
      else finalKind = st.wrongInStory > 0 ? "bad" : "good";
    }
    if (d.forceEnding) finalKind = d.forceEnding;

    if (st.review) {
      st.review.kind = finalKind;
      st.phase = "episodeEnd";
      st.page = 0;
      store();
      return this.renderEpisodeEnding(finalKind);
    }

    if (d.id === STORY_FINALE) {
      st.final = "bad";
      st.completed = true;
      st.phase = "final";
      st.page = 0;
      store();
      return this.renderFinal("bad");
    }

    const result = { id: d.id, ending: finalKind, wrong: st.wrongInStory, choices: st.choicesInStory };
    const found = st.results.findIndex((r) => r.id === d.id);
    if (found >= 0) st.results[found] = result;
    else st.results.push(result);
    st.phase = "episodeEnd";
    st.page = 0;
    store();
    this.renderEpisodeEnding(finalKind);
  },

  renderEpisodeEnding(kind) {
    const st = S.story, d = storyCurrent();
    if (!d) return this.renderStoryHome();
    const review = !!st.review;
    const isLast = !review && st.idx >= STORY_TOTAL - 1;
    const label = kind === "good" ? "好结局" : "坏结局";
    const lines = (kind === "good" ? d.goodEnding : d.badEnding) || ["……"];
    const goodCount = storyGoodCount(st);
    const finaleUnlocked = storyFinaleUnlocked(st);
    const next = review
      ? '<button class="btn primary" data-act="reviewAgain">再读一次</button>' +
        '<button class="btn" data-act="storyHome">返回剧情主页</button>'
      : (isLast
          ? (finaleUnlocked
              ? '<button class="btn danger" data-act="finale">进入终章 · 回血</button>'
              : '<button class="btn primary" data-act="finalGood">查看主线结局</button>')
          : '<button class="btn primary" data-act="nextChapter">下一章</button>');
    const blocks = storyTextBlocks(lines);
    if (isLast) {
      blocks.push('<p class="story-note">' + (finaleUnlocked
        ? "五章中有 " + goodCount + " 章好结局（不超过 2 章）。终章「回血」已解锁，主线将进入坏结局。"
        : "五章中有 " + goodCount + " 章好结局（达到 3 章及以上）。终章不会开启，主线将直接进入好结局。") + "</p>");
    }
    const where = st.storyId === STORY_FINALE ? "终章" : "第 " + (st.idx + 1) + " 章";
    this.renderReader({
      kicker: review ? "REPLAY · " + label : (kind === "good" ? "CHAPTER CLEARED · 好结局" : "CHAPTER FAILED · 坏结局"),
      title: d.title + " · " + label,
      titleClass: kind,
      phase: chapterPhase(st),
      progress: review
        ? "重读 · " + where + " · " + label
        : "第 " + (st.idx + 1) + " / " + STORY_TOTAL + " 章 · " + label,
      blocks,
      actions: next
    });
  },

  nextChapter() {
    const st = S.story;
    if (st.idx >= STORY_TOTAL - 1) return;
    st.idx += 1;
    st.storyId = STORY_ORDER[st.idx];
    st.phase = "intro";
    st.eventId = null;
    st.page = 0;
    st.wrongInStory = 0;
    st.choicesInStory = 0;
    st.lastCorrect = null;
    store();
    this.renderIntro();
  },

  enterFinale() {
    const st = S.story;
    st.idx = STORY_TOTAL;
    st.storyId = STORY_FINALE;
    st.phase = "intro";
    st.eventId = null;
    st.page = 0;
    st.wrongInStory = 0;
    st.choicesInStory = 0;
    st.lastCorrect = null;
    store();
    this.renderIntro();
  },

  finishCampaign(kind) {
    const st = S.story;
    st.final = kind;
    st.completed = true;
    st.phase = "final";
    st.page = 0;
    store();
    this.renderFinal(kind);
  },

  renderFinal(kind) {
    const st = S.story, w = storyWorld(), fd = storyData(STORY_FINALE);
    const lines = kind === "good"
      ? (w.campaignGoodEnding || []).concat(w.goodEndingTail ? [w.goodEndingTail] : [])
      : ((fd && fd.badEnding) || ["……"]).concat(w.badEndingTail ? [w.badEndingTail] : []);
    const blocks = storyTextBlocks(lines);
    blocks.push('<p class="story-final-head">本周目章节记录</p>');
    if (st.results.length) {
      st.results.forEach((r) => {
        const d = storyData(r.id);
        blocks.push('<p class="story-final-item">' +
          '<span class="' + (r.ending === "good" ? "good" : "bad") + '">' + esc(d ? d.title : r.id) + "</span> · " +
          (r.ending === "good" ? "好结局" : "坏结局") + "（选错 " + r.wrong + " / " + r.choices + " 次）</p>");
      });
    } else {
      blocks.push('<p class="story-final-item">暂无记录</p>');
    }
    this.renderReader({
      kicker: "ALL CHAPTERS · 全剧终",
      title: kind === "good" ? "主 线 好 结 局" : "终 章 坏 结 局",
      titleClass: kind,
      phase: "全 剧 终",
      progress: kind === "good" ? "主线 · 好结局" : "终章 · 坏结局",
      blocks,
      actions: '<button class="btn primary" data-act="new">重新开始剧情</button>' +
        '<button class="btn" data-act="backHome">返回首页</button>'
    });
  }
};

/* 屏幕尺寸 / 手机浏览器地址栏变化后重新测量正文分页 */
let storyResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(storyResizeTimer);
  storyResizeTimer = setTimeout(() => {
    const view = $("#v-story");
    if (!view || !view.classList.contains("active")) return;
    if (!S.story || S.story.phase === "home") return;
    Story.renderCurrent();
  }, 160);
});
