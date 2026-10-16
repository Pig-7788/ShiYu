/* ============ 识渔计划 · 账号体系（注册 / 登录 / 角色 / 会话）v1 ============
 * 纯前端演示级鉴权：账号与训练数据全部保存在本机浏览器 localStorage，
 * 不联网、不上传、不收集任何个人信息（真实部署应改为服务端鉴权，见开发文档 §7）。
 * · 密码不落明文：每账号独立 salt + SHA-256(salt:pwd:salt) 存哈希
 * · SHA-256 自带纯 JS 实现（局域网 http:// 下 crypto.subtle 不可用，故不依赖它）
 * · 训练存档按账号隔离：shiyu_v3@用户名 / shiyu_wrong@用户名 / …（AKEY）
 * · 题库 / 波次 为全局共享（管理员维护，全站生效）：shiyu_bank / shiyu_waves
 */
"use strict";

/* ---------- 纯 JS SHA-256 ---------- */
const SHA256 = (function () {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H0 = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  return function sha256(msg) {
    const bytes = new TextEncoder().encode(String(msg));
    const l = bytes.length, blocks = Math.ceil((l + 9) / 64);
    const buf = new Uint8Array(blocks * 64);
    buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer), bitLen = l * 8;
    dv.setUint32(blocks * 64 - 8, Math.floor(bitLen / 4294967296), false);
    dv.setUint32(blocks * 64 - 4, bitLen >>> 0, false);
    const H = H0.slice(), w = new Uint32Array(64);
    for (let b = 0; b < blocks; b++) {
      const off = b * 64;
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        const mj = (a & bb) ^ (a & c) ^ (bb & c);
        const t2 = (S0 + mj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return Array.prototype.map.call(H, (x) => x.toString(16).padStart(8, "0")).join("");
  };
})();

/* ---------- 存储键 ---------- */
const AUTH_USERS = "shiyu_users";
const AUTH_SESSION = "shiyu_session";
const AUTH_SEED = "shiyu_seeded_v1";

/* 按账号隔离的存档键：AKEY("v3") -> shiyu_v3@用户名；AKEY("v3","someone") 可指定账号 */
function AKEY(base, username) {
  let u = username;
  if (u == null) { const s = Auth.session(); u = s ? s.u : ""; }
  return "shiyu_" + base + (u ? "@" + u : "");
}

/* ---------- 管理员默认账号（首次打开自动创建，交付后请立即改密） ---------- */
const ADMIN_SEED = [
  { u: "admin01", p: "Shiyu@2026#01", nick: "主管理员" },
  { u: "admin02", p: "Shiyu@2026#02", nick: "题库管理员" },
  { u: "admin03", p: "Shiyu@2026#03", nick: "数据分析员" },
  { u: "admin04", p: "Shiyu@2026#04", nick: "演练组织员" },
  { u: "admin05", p: "Shiyu@2026#05", nick: "运营管理员" },
];

/* ---------- 账号存储 ---------- */
const Auth = {
  _read(key, dft) { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? dft : v; } catch (e) { return dft; } },
  _write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} },

  randHex(n) {
    const a = new Uint8Array(n);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, (x) => x.toString(16).padStart(2, "0")).join("");
  },
  hash(pass, salt) { return SHA256(salt + ":" + pass + ":" + salt); },

  users() { return this._read(AUTH_USERS, {}); },
  save(users) { this._write(AUTH_USERS, users); },
  list() {
    const m = this.users();
    return Object.keys(m).map((u) => Object.assign({ u }, m[u])).sort((a, b) => (a.created || 0) - (b.created || 0));
  },
  get(name) { return this.users()[String(name || "").toLowerCase()] || null; },

  create(name, pass, role, nick) {
    const u = String(name || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(u)) return { ok: false, msg: "用户名需为 3–16 位字母 / 数字 / 下划线" };
    if (String(pass || "").length < 6) return { ok: false, msg: "密码至少 6 位" };
    const all = this.users();
    if (all[u]) return { ok: false, msg: "该用户名已被注册" };
    const salt = this.randHex(8);
    all[u] = { salt, hash: this.hash(pass, salt), role: role === "admin" ? "admin" : "user",
      nick: String(nick || "").trim().slice(0, 16) || u, created: Date.now(), last: 0, runs: 0 };
    this.save(all);
    return { ok: true, user: u };
  },
  verify(name, pass) {
    const rec = this.get(name);
    if (!rec) return { ok: false, msg: "用户名不存在" };
    if (rec.hash !== this.hash(pass, rec.salt)) return { ok: false, msg: "密码不正确" };
    return { ok: true, user: rec };
  },
  login(name, pass) {
    const r = this.verify(name, pass);
    if (!r.ok) return r;
    const u = String(name).trim().toLowerCase(), all = this.users();
    all[u].last = Date.now(); this.save(all);
    this._write(AUTH_SESSION, { u, role: all[u].role, at: Date.now() });
    return { ok: true, user: all[u] };
  },
  logout() { try { localStorage.removeItem(AUTH_SESSION); } catch (e) {} },
  session() { return this._read(AUTH_SESSION, null); },
  current() { const s = this.session(); return s ? this.get(s.u) : null; },
  username() { const s = this.session(); return s ? s.u : ""; },
  isAdmin() { const c = this.current(); return !!c && c.role === "admin"; },

  /* 首次打开自动注入 5 个管理员账号 */
  seedAdmins() {
    if (localStorage.getItem(AUTH_SEED) === "1") return 0;
    let n = 0;
    ADMIN_SEED.forEach((a) => { if (!this.get(a.u)) { const r = this.create(a.u, a.p, "admin", a.nick); if (r.ok) n++; } });
    try { localStorage.setItem(AUTH_SEED, "1"); } catch (e) {}
    return n;
  },
  /* 重置密码：返回一次性新密码 */
  resetPassword(name) {
    const all = this.users(), u = String(name || "").toLowerCase();
    if (!all[u]) return null;
    const fresh = "Sy" + this.randHex(3) + "@" + Math.floor(1000 + Math.random() * 8999);
    all[u].salt = this.randHex(8);
    all[u].hash = this.hash(fresh, all[u].salt);
    this.save(all);
    return fresh;
  },
  changePassword(name, oldPass, newPass) {
    const r = this.verify(name, oldPass);
    if (!r.ok) return r;
    if (String(newPass || "").length < 6) return { ok: false, msg: "新密码至少 6 位" };
    const all = this.users(), u = String(name).toLowerCase();
    all[u].salt = this.randHex(8); all[u].hash = this.hash(newPass, all[u].salt); this.save(all);
    return { ok: true };
  },
  remove(name) {
    const all = this.users(), u = String(name || "").toLowerCase();
    if (!all[u]) return false;
    if (u === this.username()) return false;           // 不能删自己
    if (all[u].role === "admin" && this.list().filter((x) => x.role === "admin").length <= 1) return false;
    delete all[u]; this.save(all);
    ["v3", "wrong", "daily", "ai_diag"].forEach((k) => { try { localStorage.removeItem(AKEY(k, u)); } catch (e) {} });
    return true;
  },
  /* 某账号是否已完成训练（供看板统计） */
  progressOf(name) {
    const rec = this._read(AKEY("v3", name), null);
    return rec && rec.report ? rec.report : null;
  },
};

/* ---------- 登录 / 注册界面 ---------- */
const Gate = {
  el(id) { return document.getElementById(id); },
  msg(id, text, kind) {
    const m = this.el(id); if (!m) return;
    m.textContent = text || "";
    m.className = "gate-msg" + (kind ? " " + kind : "");
  },
  tab(which) {
    document.querySelectorAll(".gtab").forEach((t) => t.classList.toggle("on", t.dataset.t === which));
    this.el("gate-login").classList.toggle("hidden", which !== "login");
    this.el("gate-reg").classList.toggle("hidden", which !== "reg");
    const f = which === "login" ? this.el("lg-user") : this.el("rg-user");
    if (f) setTimeout(() => f.focus(), 30);
  },
  open() {
    document.body.classList.add("locked");
    const g = this.el("auth-gate"); if (g) g.classList.remove("hidden");
    this.tab("login");
  },
  close() {
    document.body.classList.remove("locked");
    const g = this.el("auth-gate"); if (g) g.classList.add("hidden");
    if (typeof renderHome === "function") renderHome();
  },
  doLogin() {
    const u = (this.el("lg-user").value || "").trim(), p = this.el("lg-pass").value || "";
    if (!u || !p) { this.msg("lg-msg", "请填写用户名与密码", "bad"); return; }
    const r = Auth.login(u, p);
    if (!r.ok) { this.msg("lg-msg", r.msg, "bad"); return; }
    this.msg("lg-msg", "");
    this.el("lg-pass").value = "";
    Gate.enter();
  },
  doRegister() {
    const u = (this.el("rg-user").value || "").trim(), nick = this.el("rg-nick").value || "";
    const p = this.el("rg-pass").value || "", p2 = this.el("rg-pass2").value || "";
    if (p !== p2) { this.msg("rg-msg", "两次输入的密码不一致", "bad"); return; }
    const r = Auth.create(u, p, "user", nick);
    if (!r.ok) { this.msg("rg-msg", r.msg, "bad"); return; }
    Auth.login(r.user, p);
    this.msg("rg-msg", "");
    ["rg-user", "rg-nick", "rg-pass", "rg-pass2"].forEach((i) => { this.el(i).value = ""; });
    Gate.enter("注册成功，已自动登录");
  },
  /* 登录成功后的入口：重新装载该账号存档并进入首页 */
  enter(tip) {
    if (typeof bootstrapUser === "function") bootstrapUser();
    this.close();
    if (typeof show === "function") show("home");
    if (tip && typeof Officer !== "undefined") Officer.play([tip + "，欢迎 " + Auth.username() + "。"]);
  },
  logout() {
    if (!confirm("退出登录？本机训练数据会保留，重新登录可继续。")) return;
    Auth.logout();
    if (typeof Officer !== "undefined") Officer.cancel();
    if (typeof clearGame === "function") clearGame();
    this.open();
  },
  boot() {
    Auth.seedAdmins();
    const c = Auth.current();
    if (c) { if (typeof bootstrapUser === "function") bootstrapUser(); this.close(); }
    else this.open();
  },
  bind() {
    document.querySelectorAll(".gtab").forEach((t) => { t.onclick = () => this.tab(t.dataset.t); });
    const g = this.el("lg-go"); if (g) g.onclick = () => this.doLogin();
    const r = this.el("rg-go"); if (r) r.onclick = () => this.doRegister();
    [["lg-user", "doLogin"], ["lg-pass", "doLogin"], ["rg-pass2", "doRegister"]].forEach(([id, fn]) => {
      const i = this.el(id);
      if (i) i.addEventListener("keydown", (e) => { if (e.key === "Enter") Gate[fn](); });
    });
    const out = this.el("user-out"); if (out) out.onclick = () => this.logout();
  },
};

/* 先于 app.js 的 init 绑定：决定显示登录页还是直接进应用（避免闪屏） */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => { Gate.bind(); Gate.boot(); });
}
