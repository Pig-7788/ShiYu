// 数据完整性校验：node tools/validate_data.js
// 校验样本靶点、战役队列、维度覆盖——加题/改题后必跑
"use strict";
const fs = require("fs");
const path = require("path");

// 载入 data.js（CommonJS 环境下模拟浏览器全局）
const src = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");
const body = src.replace(/^(const|let)\s+(\w+)/gm, "var $2") + "\nreturn {" +
  ["SAMPLES", "CAMPAIGN", "DIMENSIONS", "DIM_OF_CATEGORY", "CATEGORY_NAME", "GENES", "GENE_GROUPS", "RANKS"].join(",") +
  "};";
const sandbox = new Function(body)();
const { SAMPLES, CAMPAIGN, DIM_OF_CATEGORY } = sandbox;

let bad = 0;
const ids = (s) => {
  const set = new Set();
  if (s.meta.addrId) set.add(s.meta.addrId);
  if (s.meta.urlId) set.add(s.meta.urlId);
  set.add(s.id + "-subj"); set.add(s.id + "-ph");
  (s.parts || []).forEach((p) => {
    if (p.id) set.add(p.id);
    if (p.html) [...p.html.matchAll(/data-el="([^"]+)"/g)].forEach((m) => set.add(m[1]));
  });
  return set;
};
SAMPLES.forEach((s) => {
  const av = ids(s);
  s.redflags.forEach((r) => { if (!av.has(r.target)) { bad++; console.log("MISS", s.id, r.category, r.target); } });
  (s.legitNotes || []).forEach((n) => { if (n.target && !av.has(n.target)) { bad++; console.log("MISSNOTE", s.id, n.target); } });
  if (s.phishing && s.redflags.length === 0) { bad++; console.log("EMPTYFLAGS", s.id); }
  if (!s.phishing && s.redflags.length > 0) { bad++; console.log("LEGITWFLAG", s.id); }
});
const all = new Set(SAMPLES.map((s) => s.id));
Object.entries(CAMPAIGN).forEach(([ph, q]) => q.forEach((id) => { if (!all.has(id)) { bad++; console.log("BADQID", ph, id); } }));
const dimCov = {};
SAMPLES.forEach((s) => s.redflags.forEach((r) => { dimCov[DIM_OF_CATEGORY[r.category]] = (dimCov[DIM_OF_CATEGORY[r.category]] || 0) + 1; }));
console.log(`样本 ${SAMPLES.length} 题 | 战役 ${Object.values(CAMPAIGN).flat().length} 题 | 维度覆盖`, dimCov);
console.log(bad === 0 ? "✔ 数据校验通过" : `✘ ${bad} 处问题`);
process.exit(bad === 0 ? 0 : 1);
