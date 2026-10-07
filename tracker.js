import fs from "node:fs";
import { chromium } from "playwright";

const X_USER = "Koisuru_2026";
const IG_USER = "koisuru_2026";
const OUT = "current.json";

function n(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([KMB万]?)$/i);
  if (!m) return null;
  let x = Number(m[1]);
  const u = m[2].toUpperCase();
  if (u === "K") x *= 1e3;
  else if (u === "M") x *= 1e6;
  else if (u === "B") x *= 1e9;
  else if (u === "万") x *= 1e4;
  return Number.isFinite(x) ? Math.round(x) : null;
}
function jst() {
  return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date()).replace(" ","T")+"+09:00";
}
async function context(browser, stateEnv) {
  let storageState;
  if (process.env[stateEnv]) {
    try { storageState = JSON.parse(Buffer.from(process.env[stateEnv],"base64").toString("utf8")); }
    catch { console.error(stateEnv+" is invalid; continuing logged out"); }
  }
  return browser.newContext({storageState,locale:"ja-JP",userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36"});
}
async function instagram(browser) {
  const c=await context(browser,"INSTAGRAM_STORAGE_STATE_B64"), p=await c.newPage();
  try {
    await p.goto(`https://www.instagram.com/${IG_USER}/`,{waitUntil:"domcontentloaded",timeout:45000});
    await p.waitForTimeout(5000);
    const html=await p.content();
    for (const re of [
      /"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)/,
      /"follower_count"\s*:\s*(\d+)/,
      /([\d.,]+[KMB万]?)\s*(?:Followers|followers|フォロワー)/
    ]) { const m=html.match(re); if(m){const v=n(m[1]); if(v!==null)return v;} }
    return null;
  } finally { await c.close(); }
}
async function x(browser) {
  const c=await context(browser,"X_STORAGE_STATE_B64"), p=await c.newPage();
  try {
    await p.goto(`https://x.com/${X_USER}`,{waitUntil:"domcontentloaded",timeout:45000});
    await p.waitForTimeout(5000);
    const text=await p.locator("body").innerText().catch(()=> "");
    for (const re of [
      /([\d.,]+[KMB万]?)\s*(?:Followers|フォロワー)/i,
      /(?:Followers|フォロワー)\s*([\d.,]+[KMB万]?)/i
    ]) { const m=text.match(re); if(m){const v=n(m[1]); if(v!==null)return v;} }
    return null;
  } finally { await c.close(); }
}
const old=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT,"utf8")):{};
const browser=await chromium.launch({headless:true});
let xv=null, igv=null;
try { xv=await x(browser); } catch(e){ console.error("X failed:",e.message); }
try { igv=await instagram(browser); } catch(e){ console.error("Instagram failed:",e.message); }
await browser.close();
const prevX=old.x_followers ?? null, prevIg=old.instagram_followers ?? null;
const out={
  fetched_at_jst:jst(),
  x_followers:xv,
  previous_x_followers:prevX,
  delta_x_followers_from_previous:xv!==null&&prevX!==null?xv-prevX:null,
  instagram_followers:igv,
  previous_instagram_followers:prevIg,
  delta_instagram_followers_from_previous:igv!==null&&prevIg!==null?igv-prevIg:null
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+"\n");
console.log(out);
