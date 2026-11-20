#!/usr/bin/env node
/**
 * CI 用：读取仓库根目录的 pool.json，按里面的代码重新抓 120 天净值、重算指标，写回。
 * 只依赖 Node 18+ 内置能力，不需要 npm 依赖。
 */
import fs from "node:fs";

const UA = "Mozilla/5.0 (compatible; jice-bot/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (url, referer, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, referer }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(500 * (i + 1));
    }
  }
};

async function nav(code, days = 120) {
  const rows = [];
  for (let page = 1; page <= Math.ceil(days / 20) + 1; page++) {
    const txt = await get(
      `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=${page}&pageSize=20`,
      "https://fundf10.eastmoney.com/"
    );
    const part = (JSON.parse(txt)?.Data?.LSJZList || []).filter((x) => Number(x.DWJZ) > 0);
    if (!part.length) break;
    rows.push(...part);
    if (part.length < 20 || rows.length >= days) break;
  }
  const seen = new Set();
  return rows
    .filter((x) => (seen.has(x.FSRQ) ? false : seen.add(x.FSRQ)))
    .slice(0, days)
    .reverse()
    .map((x) => ({ date: x.FSRQ, nav: Number(x.DWJZ), ret: x.JZZZL === "" ? 0 : Number(x.JZZZL) / 100 }));
}

function metrics(points) {
  const pts = points.filter((p) => p.nav > 0);
  const n = pts.length - 1;
  if (n < 30) return null;
  const idx = [100];
  for (let i = 0; i < n; i++) idx.push(idx[i] * (1 + pts[i + 1].ret));
  const win = (k) => Math.min(k, n);
  const cum = (k) => idx[n] / idx[n - Math.min(k, n)] - 1;
  const rets = pts.slice(1).map((p) => p.ret);
  const vol = (k) => {
    const w = rets.slice(n - win(k));
    const mu = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt((w.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, w.length - 1)) * 252);
  };
  let peak = idx[0], dd = 0;
  for (const v of idx) { peak = Math.max(peak, v); dd = Math.min(dd, v / peak - 1); }
  const annual = (c, k) => (k >= 240 ? Math.pow(1 + c, 252 / k) - 1 : c);
  const r1y = cum(252), r3y = cum(756);
  const vol3y = vol(756), vol1y = vol(252), mdd3y = dd;
  const cagr3y = annual(r3y, win(756));
  return {
    start: pts[0].date, end: pts[pts.length - 1].date, days: pts.length,
    r3m: cum(63), r6m: cum(126), r1y, r3y, cagr3y, vol1y, vol3y, mdd3y,
    sharpe3y: vol3y > 1e-6 ? (cagr3y - 0.02) / vol3y : 0,
    calmar3y: mdd3y < -1e-6 ? cagr3y / Math.abs(mdd3y) : 0,
  };
}

const file = process.argv[2] || "pool.json";
const snap = JSON.parse(fs.readFileSync(file, "utf8"));
const out = [];
let n = 0;

for (const f of snap.funds) {
  n++;
  try {
    const pts = await nav(f.code, 120);
    const m = pts.length >= 30 ? metrics(pts) : null;
    if (m) {
      out.push({ ...f, ...m });
      process.stdout.write(`✓ ${f.code} ${f.name} ${m.end}\n`);
    } else {
      out.push(f);
      process.stdout.write(`- ${f.code} 数据不足，保留旧值\n`);
    }
  } catch (e) {
    out.push(f);
    process.stdout.write(`✗ ${f.code} ${e.message}\n`);
  }
  await sleep(150);
}

const asOf = out.map((f) => f.end).filter(Boolean).sort().at(-1) || snap.asOf;
fs.writeFileSync(file, JSON.stringify({ asOf, generatedAt: new Date().toISOString(), count: out.length, funds: out }));
console.log(`\n写入 ${file}：${out.length} 只，净值截至 ${asOf}`);
