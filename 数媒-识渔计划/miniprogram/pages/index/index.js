// 页面：首页
const D = require("../../utils/data");
Page({
  data: { rank: "", scoreTxt: "", streakTxt: "", dailySub: "按日期生成新题 · 冲刺个人最佳与连胜" },
  onShow() {
    const g = getApp().globalData;
    const d = g.daily || {};
    const today = this.dateStr();
    this.setData({
      rank: g.report ? "段位 " + g.report.rank + " · 战绩 " + (g.report.score ?? "--") : "尚无画像 · 完成一场拦截战后生成",
      streakTxt: d.streak ? "每日连胜 " + d.streak + " 天" : "",
      dailySub: d.lastDate === today ? "今日已战 · 最佳 " + (d.best || 0) + " 分 · 连胜 " + (d.streak || 1) + " 天" : "按日期生成新题 · 冲刺个人最佳与连胜",
    });
  },
  dateStr() { const x = new Date(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); },
  goCampaign() { wx.navigateTo({ url: "/pages/game/game?mode=campaign" }); },
  goDaily() { wx.navigateTo({ url: "/pages/game/game?mode=daily" }); },
  goLab() { wx.navigateTo({ url: "/pages/lab/lab" }); },
  goProfile() { wx.navigateTo({ url: "/pages/profile/profile" }); },
  goAgent() { wx.navigateTo({ url: "/pages/agent/agent" }); },
});
