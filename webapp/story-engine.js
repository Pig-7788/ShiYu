/* ============ 识渔计划 · 剧情模式引擎 ============ */
/* 线性主线：学费 → 学长 → 饰品 → 修电脑 → 代刷
   规则：五章中只要有一步没选错，第五章结束后直接进入好结局；
        只有五章的所有选择全部选错，才会进入终章「回血」，并固定走坏结局。 */
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
    allWrong: true,       // 前五章是否所有选择都错
    wrongInStory: 0,
    choicesInStory: 0,
    lastCorrect: null,
    outcomeKind: null,    // onRight | onWrong | onWrongA | onWrongB
    route: null,          // {type:"event",id} | {type:"ending",kind}
    results: [],          // [{id, ending, wrong, choices}]
    final: null,          // good | bad
    completed: false
  };
}

function storyWorld() { return (typeof STORY_WORLD !== "undefined") ? STORY_WORLD : {}; }
function storyData(id) { return (window.STORY_REGISTRY || {})[id] || null; }
function storyCurrent() { return storyData(S.story.storyId); }
function storyEvent(story, id) {
  return (story && story.events) ? story.events.find((e) => e.id === id) : null;
}
function storyMsgHTML(m) {
  const sender = m.sender || "";
  const lines = (m.lines || []).map((x) => esc(x)).join("<br>");
  const narration = /^[（(]/.test(sender) || /系统|旁白/.test(sender);
  return narration
    ? '<div class="story-msg narration">' + lines + "</div>"
    : '<div class="story-msg"><span class="who">' + esc(sender) + "</span>" + lines + "</div>";
}

function chapterPhase(st) {
  return st.storyId === STORY_FINALE ? "终 章" : "第 " + (st.idx + 1) + " 章";
}

const Story = {
  open() {
    if (!S.story || !Array.isArray(S.story.results)) S.story = Object.assign(freshStory(), S.story || {});
    this.renderStoryHome();
    show("story");
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
      return '<div class="story-chapter ' + cls + '"><span class="nm">' +
        esc(d ? d.title : id) + '</span><span class="st ' + cls + '">' + status + "</span></div>";
    }).join("");

    let fCls = "locked", fStatus = "未解锁 · 前五章须全部选错";
    if (st.final === "bad") {
      fCls = "bad";
      fStatus = "已达成 · 坏结局";
    } else if (st.final === "good") {
      fCls = "locked";
      fStatus = "本周目未开启";
    } else if (st.allWrong && st.results.length >= STORY_TOTAL) {
      fCls = "current";
      fStatus = st.storyId === STORY_FINALE ? "进行中" : "已解锁";
    }
    const fd = storyData(STORY_FINALE);
    const finale = '<div class="story-chapter ' + fCls + '"><span class="nm">' +
      esc(fd ? fd.title : "终章 · 回血") + '</span><span class="st ' + fCls + '">' + fStatus + "</span></div>";

    $("#story-stage").innerHTML = `
      <p class="story-lead">五个故事改编自校园里真实发生过的骗局。顺序固定，每一次选择都会被记住。</p>
      <div class="story-chapters">${chapters}${finale}</div>
      <div class="story-actions">
        <button class="btn primary" data-act="${started ? "resume" : "new"}">${started ? "继续剧情" : "开始剧情"}</button>
        ${started ? '<button class="btn" data-act="new">重新开始</button>' : ""}
        <button class="btn" data-act="backHome">返回首页</button>
      </div>
      <p class="story-note">规则：五章中只要有一步没选错，第五章结束后会直接进入好结局；只有五章的所有选择全部选错，才会解锁终章「回血」。</p>`;
    this.bindStage();
    window.scrollTo(0, 0);
  },

  bindStage() {
    const stage = $("#story-stage");
    stage.querySelectorAll("[data-act]").forEach((b) => {
      b.onclick = () => this.act(b.dataset.act);
    });
    stage.querySelectorAll("[data-choice]").forEach((b) => {
      b.onclick = () => this.choose(Number(b.dataset.choice));
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
    else if (act === "storyHome") this.renderStoryHome();
    else if (act === "backHome") { renderHome(); show("home"); }
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
    switch (st.phase) {
      case "intro": return this.renderIntro();
      case "event": return this.renderEvent();
      case "outcome": return this.renderOutcome();
      case "episodeEnd": {
        const r = st.results.find((x) => x.id === st.storyId);
        return this.renderEpisodeEnding(r ? r.ending : "bad");
      }
      case "final": return this.renderFinal(st.final || "good");
      default: return this.renderStoryHome();
    }
  },

  renderIntro() {
    const st = S.story, d = storyCurrent();
    if (!d) return this.renderStoryHome();
    const isFinale = st.storyId === STORY_FINALE;
    $("#st-phase").textContent = chapterPhase(st);
    $("#st-progress").textContent = isFinale ? "FINALE" : "CHAPTER " + (st.idx + 1) + " / " + STORY_TOTAL;
    const intro = (d.intro || []).map((p) => "<p>" + esc(p) + "</p>").join("");
    $("#story-stage").innerHTML = `
      <div class="story-kicker">${isFinale ? "FINALE · 回血" : "CHAPTER " + (st.idx + 1)}</div>
      <h2 class="story-title">${esc(d.title)}</h2>
      <div class="story-intro">${intro || "<p>（本章暂无简介）</p>"}</div>
      <div class="story-actions">
        <button class="btn primary" data-act="startChapter">开始本章</button>
        <button class="btn" data-act="storyHome">剧情主页</button>
      </div>`;
    this.bindStage();
    window.scrollTo(0, 0);
  },

  startEvents() {
    const d = storyCurrent();
    if (!d || !d.events || !d.events.length) return this.finishEpisode();
    S.story.phase = "event";
    S.story.eventId = d.events[0].id;
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
    $("#st-phase").textContent = chapterPhase(st);
    $("#st-progress").textContent = st.storyId === STORY_FINALE ? "FINALE" : "第 " + (st.idx + 1) + " / " + STORY_TOTAL + " 章";
    const scene = (ev.scene || []).map((p) => "<p>" + esc(p) + "</p>").join("");
    const sys = (ev.systemState || []).map((p) => "<p>" + esc(p) + "</p>").join("");
    const msgs = (ev.messages || []).map(storyMsgHTML).join("");
    const choices = (ev.choices || []).map((c, i) =>
      '<button class="story-choice" data-choice="' + i + '"><span class="idx">' + (i + 1) + "</span>" + esc(c.text) + "</button>"
    ).join("");
    $("#story-stage").innerHTML = `
      <div class="story-kicker">${st.storyId === STORY_FINALE ? "FINALE" : "CHAPTER " + (st.idx + 1)}</div>
      <h2 class="story-title">${esc(d.title)}</h2>
      ${scene ? '<div class="story-lines">' + scene + "</div>" : ""}
      ${sys ? '<div class="story-sys">' + sys + "</div>" : ""}
      ${msgs ? '<div class="story-chat">' + msgs + "</div>" : ""}
      ${choices ? '<div class="story-choices">' + choices + "</div>" : '<div class="story-actions"><button class="btn primary" data-act="outcomeNext">继续</button></div>'}
      <div class="story-actions"><button class="btn" data-act="storyHome">剧情主页</button></div>`;
    this.bindStage();
    window.scrollTo(0, 0);
  },

  choose(i) {
    const st = S.story, d = storyCurrent(), ev = storyEvent(d, st.eventId);
    if (!d || !ev || !ev.choices || !ev.choices[i]) return;
    const c = ev.choices[i];
    const wrong = !c.correct;
    st.wrongInStory += wrong ? 1 : 0;
    st.choicesInStory += 1;
    st.lastCorrect = !!c.correct;
    if (st.storyId !== STORY_FINALE) st.allWrong = st.allWrong && wrong;

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
    store();
    SFX.play(c.correct ? "good" : "bad");
    this.renderOutcome();
  },

  renderOutcome() {
    const st = S.story, d = storyCurrent(), ev = storyEvent(d, st.eventId);
    if (!d) return this.renderStoryHome();
    const lines = (ev && st.outcomeKind && ev[st.outcomeKind]) ? ev[st.outcomeKind] : [];
    if (!lines.length) return this.applyRoute();
    $("#st-phase").textContent = chapterPhase(st);
    $("#st-progress").textContent = st.storyId === STORY_FINALE ? "FINALE" : "第 " + (st.idx + 1) + " / " + STORY_TOTAL + " 章";
    $("#story-stage").innerHTML = `
      <div class="story-kicker">${st.storyId === STORY_FINALE ? "FINALE" : "CHAPTER " + (st.idx + 1)}</div>
      <h2 class="story-title">${esc(d.title)}</h2>
      <div class="story-outcome">${lines.map((p) => "<p>" + esc(p) + "</p>").join("")}</div>
      <div class="story-actions">
        <button class="btn primary" data-act="outcomeNext">继续</button>
        <button class="btn" data-act="storyHome">剧情主页</button>
      </div>`;
    this.bindStage();
    window.scrollTo(0, 0);
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

    if (d.id === STORY_FINALE) {
      st.final = "bad";
      st.completed = true;
      st.phase = "final";
      store();
      return this.renderFinal("bad");
    }

    const result = { id: d.id, ending: finalKind, wrong: st.wrongInStory, choices: st.choicesInStory };
    const found = st.results.findIndex((r) => r.id === d.id);
    if (found >= 0) st.results[found] = result;
    else st.results.push(result);
    st.phase = "episodeEnd";
    store();
    this.renderEpisodeEnding(finalKind);
  },

  renderEpisodeEnding(kind) {
    const st = S.story, d = storyCurrent();
    if (!d) return this.renderStoryHome();
    const isLast = st.idx >= STORY_TOTAL - 1;
    const lines = (kind === "good" ? d.goodEnding : d.badEnding) || ["……"];
    $("#st-phase").textContent = chapterPhase(st);
    $("#st-progress").textContent = "第 " + (st.idx + 1) + " / " + STORY_TOTAL + " 章 · " + (kind === "good" ? "识破" : "中招");
    const next = isLast
      ? (st.allWrong
          ? '<button class="btn danger" data-act="finale">进入终章 · 回血</button>'
          : '<button class="btn primary" data-act="finalGood">查看主线结局</button>')
      : '<button class="btn primary" data-act="nextChapter">下一章</button>';
    $("#story-stage").innerHTML = `
      <div class="story-kicker">${kind === "good" ? "CHAPTER CLEARED" : "CHAPTER FAILED"}</div>
      <h2 class="story-title">${esc(d.title)}</h2>
      <div class="story-end ${kind}">
        <h2>${kind === "good" ? "本章 · 识破" : "本章 · 中招"}</h2>
        ${lines.map((p) => "<p>" + esc(p) + "</p>").join("")}
      </div>
      <div class="story-actions">${next}<button class="btn" data-act="storyHome">剧情主页</button></div>
      ${isLast ? (st.allWrong
        ? '<p class="story-note">五章的所有选择都错了。终章「回血」已解锁。</p>'
        : '<p class="story-note">你至少做对了一次，终章不会开启。主线将直接进入好结局。</p>') : ""}`;
    this.bindStage();
    window.scrollTo(0, 0);
  },

  nextChapter() {
    const st = S.story;
    if (st.idx >= STORY_TOTAL - 1) return;
    st.idx += 1;
    st.storyId = STORY_ORDER[st.idx];
    st.phase = "intro";
    st.eventId = null;
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
    store();
    this.renderFinal(kind);
  },

  renderFinal(kind) {
    const st = S.story, w = storyWorld(), fd = storyData(STORY_FINALE);
    const lines = kind === "good"
      ? (w.campaignGoodEnding || []).concat(w.goodEndingTail ? [w.goodEndingTail] : [])
      : ((fd && fd.badEnding) || ["……"]).concat(w.badEndingTail ? [w.badEndingTail] : []);
    const list = st.results.map((r) => {
      const d = storyData(r.id);
      return "<li>" + esc(d ? d.title : r.id) + " · " + (r.ending === "good" ? "好结局" : "坏结局") +
        "（选错 " + r.wrong + " / " + r.choices + " 次）</li>";
    }).join("");
    $("#st-phase").textContent = "全 剧 终";
    $("#st-progress").textContent = kind === "good" ? "主线 · 好结局" : "终章 · 坏结局";
    $("#story-stage").innerHTML = `
      <div class="story-end ${kind}">
        <h2>${kind === "good" ? "主 线 好 结 局" : "终 章 坏 结 局"}</h2>
        ${lines.map((p) => "<p>" + esc(p) + "</p>").join("")}
      </div>
      <div class="story-intro">
        <p style="margin-bottom:6px;color:var(--txt-dim)">本周目章节记录</p>
        <ul class="story-final-list">${list || "<li>暂无记录</li>"}</ul>
      </div>
      <div class="story-actions">
        <button class="btn primary" data-act="new">重新开始剧情</button>
        <button class="btn" data-act="storyHome">剧情主页</button>
        <button class="btn" data-act="backHome">返回首页</button>
      </div>`;
    this.bindStage();
    window.scrollTo(0, 0);
  }
};
