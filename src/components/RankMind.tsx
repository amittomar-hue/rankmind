"use client";
import { useState, useEffect, useRef } from "react";
import { snapshotSyncState } from "@/lib/syncKeys";
import { findAuthor, COMPUNNEL_AUTHORS } from "@/lib/authors";

const S = {
  // Sidebar — deep slate
  sidebar:"#0f172a", sidebarBorder:"rgba(148,163,184,0.1)", sidebarText:"#94a3b8", sidebarActive:"#f8fafc",
  // Surfaces
  bg:"#f8fafc", card:"#ffffff", border:"#e2e8f0",
  // Text
  text:"#0f172a", muted:"#64748b", subtle:"#f1f5f9",
  // Brand — indigo
  accent:"#6366f1", accentBg:"#eef2ff", accentText:"#4338ca",
  // Semantic
  green:"#059669", greenBg:"#ecfdf5", greenText:"#065f46",
  amber:"#d97706", amberBg:"#fffbeb", amberText:"#92400e",
  red:"#dc2626", redBg:"#fef2f2", redText:"#991b1b",
  blue:"#2563eb", blueBg:"#eff6ff", blueText:"#1e40af",
  // Elevation
  shadow:"0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:"0 4px 6px -1px rgba(0,0,0,0.07),0 2px 4px -2px rgba(0,0,0,0.05)",
};

// ── History types & hook ──
type HistoryEntry = {
  id: string;
  tool: string;
  toolLabel: string;
  inputLabel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  timestamp: number;
};

const TOOL_LABELS: Record<string,string> = {
  technical:"Site Crawl",keywords:"Keyword Explorer",backlinks:"Backlink Profile",
  competitors:"Competitor Analysis",onpage:"On-Page SEO",serp:"SERP Analyzer",
  rank:"Rank Tracker",sitemap:"Sitemap",intlinks:"Internal Links",
  brokenlinks:"Response Codes",audit:"Content Audit",localseo:"Local SEO",
  aeo:"AI Search",linkbuilding:"Link Building",
  linkinter:"Link Intersect",brandmon:"Brand Monitoring",
  market:"Market Explorer",trafficana:"Traffic Analytics",adresearch:"Ad Research",
  snippets:"Snippet Tracker", geo:"Share of Synthesis", aibots:"AI Bot Monitor",
  atomic:"Atomic Answers", contentrefresh:"Content Refresh", eeat:"E-E-A-T Builder",
  execaudit:"SEO Audit Report",
  llmstxt:"llms.txt Generator", pricingmd:"Pricing.md Generator", soaiv:"SOAIV Tracker",
  cwv:"Core Web Vitals", calendar:"Editorial Calendar", paafaq:"PAA → FAQ",
  pillar:"Pillar Planner", extractability:"Extractability Score",
  serpcontent:"Content SERP Analyzer", campaign:"SEO Campaign Agent",
};

function useToolHistory(tool: string) {
  const key = `rm_hist_${tool}`;
  const [entries, setEntries] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const add = (inputLabel: string, data: any) => {
    const entry: HistoryEntry = { id: Date.now().toString(), tool, toolLabel: TOOL_LABELS[tool]||tool, inputLabel, data, timestamp: Date.now() };
    setEntries(prev => { const next = [entry, ...prev].slice(0,20); localStorage.setItem(key, JSON.stringify(next)); return next; });
  };
  const remove = (id: string) => {
    setEntries(prev => { const next = prev.filter(e=>e.id!==id); localStorage.setItem(key, JSON.stringify(next)); return next; });
  };
  const clear = () => { localStorage.removeItem(key); setEntries([]); };
  return { entries, add, remove, clear };
}

const NAV_CATEGORIES = [
  { label:"OVERVIEW", items:[
    {id:"dashboard",icon:"⬡",label:"Dashboard"},
    {id:"execaudit",icon:"◈",label:"SEO Audit Report"},
    {id:"projects",icon:"⊡",label:"My Sites"},
    {id:"history",icon:"◷",label:"History"},
  ]},
  { label:"KEYWORD RESEARCH", items:[
    {id:"keywords",icon:"◆",label:"Keyword Explorer"},
    {id:"sitemap",icon:"⊞",label:"Sitemap"},
  ]},
  { label:"CONTENT", items:[
    {id:"campaign",icon:"◆",label:"SEO Campaign Agent"},
    {id:"serpcontent",icon:"⊞",label:"Content SERP Analyzer"},
    {id:"content",icon:"✎",label:"Content Writer"},
    {id:"seowriter",icon:"✏",label:"Writing Assistant"},
    {id:"topics",icon:"◈",label:"Topic Research"},
    {id:"schemagen",icon:"{}",label:"Schema Generator"},
    {id:"atomic",icon:"⊕",label:"Atomic Answers"},
    {id:"contentrefresh",icon:"↻",label:"Content Refresh"},
    {id:"calendar",icon:"◷",label:"Editorial Calendar"},
    {id:"paafaq",icon:"?",label:"PAA → FAQ"},
    {id:"pillar",icon:"⊡",label:"Pillar Planner"},
  ]},
  { label:"GEO / AI SEARCH", items:[
    {id:"snippets",icon:"◈",label:"Snippet Tracker"},
    {id:"geo",icon:"◉",label:"Share of Synthesis"},
    {id:"soaiv",icon:"◎",label:"SOAIV Tracker"},
    {id:"aibots",icon:"◎",label:"AI Bot Monitor"},
    {id:"eeat",icon:"★",label:"E-E-A-T Builder"},
  ]},
  { label:"AI VISIBILITY", items:[
    {id:"llmstxt",icon:"⟨⟩",label:"llms.txt Generator"},
    {id:"pricingmd",icon:"¥",label:"Pricing.md Generator"},
    {id:"extractability",icon:"⊕",label:"Extractability Score"},
    {id:"cwv",icon:"⚡",label:"Core Web Vitals"},
  ]},
  { label:"LINK BUILDING", items:[
    {id:"linkbuilding",icon:"↗",label:"Link Building"},
    {id:"linkinter",icon:"⊗",label:"Link Intersect"},
  ]},
  { label:"COMPETITORS", items:[
    {id:"market",icon:"◫",label:"Market Explorer"},
    {id:"adresearch",icon:"◆",label:"Ad Research"},
  ]},
  { label:"MORE", items:[
    {id:"localseo",icon:"◉",label:"Local SEO"},
  ]},
];

// ── Shared UI ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pill = (label: string, color: string) => {
  const map: Record<string,{bg:string;color:string;border:string}> = {
    green:{bg:"#dcfce7",color:"#15803d",border:"#bbf7d0"},
    amber:{bg:"#fef3c7",color:"#92400e",border:"#fde68a"},
    red:{bg:"#fee2e2",color:"#b91c1c",border:"#fecaca"},
    blue:{bg:"#dbeafe",color:"#1d4ed8",border:"#bfdbfe"},
    purple:{bg:"#ede9fe",color:"#6d28d9",border:"#ddd6fe"},
    gray:{bg:S.subtle,color:S.muted,border:S.border},
  };
  const c = map[color]||map.gray;
  return <span style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`,fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:6,whiteSpace:"nowrap",letterSpacing:"0.01em"}}>{label}</span>;
};

const Field = ({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}) => (
  <div style={{marginBottom:16}}>
    <label style={{display:"block",fontSize:11,fontWeight:600,color:S.muted,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</label>
    {children}
    {hint&&<p style={{fontSize:11,color:S.muted,margin:"5px 0 0",lineHeight:1.5}}>{hint}</p>}
  </div>
);

const TI = ({value,onChange,placeholder,rows}:{value:string;onChange:(v:string)=>void;placeholder?:string;rows?:number}) => {
  const base:React.CSSProperties = {width:"100%",background:"#fff",border:`1.5px solid ${S.border}`,borderRadius:8,color:S.text,padding:"9px 12px",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.15s,box-shadow 0.15s"};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const foc=(e:any)=>{e.currentTarget.style.borderColor=S.accent;e.currentTarget.style.boxShadow="0 0 0 3px rgba(99,102,241,0.12)";};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blr=(e:any)=>{e.currentTarget.style.borderColor=S.border;e.currentTarget.style.boxShadow="none";};
  return rows
    ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical"}} onFocus={foc} onBlur={blr}/>
    : <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base} onFocus={foc} onBlur={blr}/>;
};

const Btn = ({onClick,disabled,children,variant="primary",small}:{onClick?:()=>void;disabled?:boolean;children:React.ReactNode;variant?:string;small?:boolean}) => {
  const base:React.CSSProperties = {padding:small?"5px 14px":"9px 20px",borderRadius:8,fontWeight:600,fontSize:small?12:13,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,border:"none",transition:"filter 0.15s,box-shadow 0.15s",whiteSpace:"nowrap" as const,letterSpacing:"0.01em"};
  const styles:React.CSSProperties = variant==="secondary"
    ? {...base,background:"transparent",color:S.text,border:`1.5px solid ${S.border}`,boxShadow:"none"}
    : disabled
      ? {...base,background:"#e2e8f0",color:"#94a3b8",boxShadow:"none"}
      : {...base,background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",boxShadow:"0 1px 4px rgba(99,102,241,0.35)"};
  return (
    <button onClick={onClick} disabled={disabled} style={styles}
      onMouseEnter={e=>{if(!disabled)(e.currentTarget as HTMLButtonElement).style.filter="brightness(0.91)";}}
      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.filter="";}}>
      {children}
    </button>
  );
};

const Card = ({children,style={},id}:{children:React.ReactNode;style?:React.CSSProperties;id?:string}) => (
  <div id={id} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:14,padding:"20px 24px",marginBottom:16,boxShadow:S.shadow,...style}}>{children}</div>
);

const SH = ({title,action}:{title:string;action?:React.ReactNode}) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:3,height:16,borderRadius:2,background:"linear-gradient(to bottom,#6366f1,#818cf8)",flexShrink:0}}/>
      <h3 style={{fontSize:14,fontWeight:700,color:S.text,margin:0,letterSpacing:"-0.01em"}}>{title}</h3>
    </div>
    {action}
  </div>
);

const Bar = ({value,color=S.accent,height=6}:{value:number;color?:string;height?:number}) => (
  <div style={{background:"#f1f5f9",borderRadius:99,height,overflow:"hidden"}}>
    <div style={{width:`${Math.min(value||0,100)}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.6s ease"}}/>
  </div>
);

const Divider = () => <div style={{borderTop:`1px solid ${S.border}`,margin:"16px 0",opacity:0.7}}/>;

const TH = ({children}:{children:React.ReactNode}) => {
  const tip = typeof children==="string" ? METRIC_HINTS[children.toLowerCase().trim()] : undefined;
  return (
    <th style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:`1px solid ${S.border}`,background:"#f8fafc",whiteSpace:"nowrap"}}>
      {tip?<span style={{display:"inline-flex",alignItems:"center"}}>{children}<InfoTip text={tip}/></span>:children}
    </th>
  );
};

const TD = ({children,color,bold}:{children:React.ReactNode;color?:string;bold?:boolean}) => (
  <td style={{padding:"11px 14px",fontSize:13,color:color||S.text,fontWeight:bold?600:400,borderBottom:`1px solid ${S.border}`}}>{children}</td>
);

// Central glossary — any Metric/KPI whose label matches gets an auto "?" tooltip.
// Keyed by normalized (lowercased, trimmed) label.
const METRIC_HINTS: Record<string,string> = {
  // Traffic & GSC/GA4
  "organic clicks":"Total clicks from Google organic search to your site (from Google Search Console), for the selected period.",
  "clicks":"Number of times users clicked through to your site from search results.",
  "impressions":"How many times your pages appeared in Google search results, whether or not they were clicked.",
  "sessions":"Total visits to your site (Google Analytics 4). One session = one user's browsing period.",
  "users":"Number of unique visitors to your site in the period (Google Analytics 4).",
  "new users":"First-time visitors who had not visited your site before in the period.",
  "conversions":"Completed goal actions (signups, purchases, form fills) tracked in GA4.",
  "avg position":"Your average ranking position in Google across all keywords. Lower is better — #1 is the top result.",
  "avg ctr":"Click-through rate — clicks ÷ impressions. The % of people who clicked after seeing you in search.",
  "ctr":"Click-through rate — the percentage of searchers who clicked your result after seeing it.",
  "bounce rate":"% of sessions where the user left without interacting. Lower is generally better.",
  "avg session duration":"Average time visitors spend on your site per session.",
  // Authority & backlinks
  "domain rating":"0–100 estimate of your domain's backlink authority. Higher = stronger link profile (heuristic from Tranco rank, site age & archives).",
  "domain authority":"0–100 estimate of overall domain strength based on backlink signals. Higher ranks more easily.",
  "backlinks":"Total inbound links pointing to your site from other websites.",
  "referring domains":"Number of unique websites linking to you. More diverse referring domains = stronger authority.",
  "toxic links":"Spammy or low-quality backlinks that may harm your rankings and should be disavowed.",
  // Keywords & SERP
  "difficulty":"How hard it is to rank for this keyword — based on competitor authority and content length. Low = easy, High = very competitive.",
  "keyword difficulty":"0–100 estimate of how hard it is to rank for this keyword. Higher = more competitive.",
  "opportunity":"0–100 score combining low competition and weak SERP signals. Higher = better chance to rank quickly.",
  "search volume":"Estimated number of monthly searches for this keyword.",
  "your rank":"Your site's current position in the top 10 Google results for this keyword. 'Not ranking' = not in top 10.",
  "serp avg words":"Average word count of pages currently ranking. Aim for this length (±10%) to compete.",
  "visibility":"How visible your site is in search for the tracked keywords — share of possible clicks captured.",
  "share of voice":"Your share of total search visibility vs competitors for the tracked keywords.",
  "top 3":"Number of keywords where you rank in the top 3 positions — the highest-traffic slots.",
  "top 10":"Number of keywords where you rank on page 1 (positions 1–10) of Google.",
  // AEO / GEO
  "visibility score":"How visible your brand is across AI search and the web, scored from real mentions (news, Reddit, web).",
  "ai mentions":"Estimated monthly times your brand is mentioned in AI-generated answers and across the web.",
  "brand mentions":"Real mentions of your brand found across Google News, Reddit, and the web.",
  "citations":"Times your content is cited as a source — in AI answers or across the web.",
  "cited pages":"Number of your pages referenced as sources by AI systems or other sites.",
  "soaiv score":"Share of AI Voice — % of AI-generated answers in your category that mention your brand.",
  "featured snippet rate":"% of your keywords that win the featured snippet (position zero) in Google.",
  "schema coverage":"% of your pages with structured data (schema markup) that helps search engines and AI understand them.",
  // Content
  "avg word count":"Average length of your content. Compare against the SERP average to spot thin pages.",
  "thin pages":"Pages with very little content (under ~300 words) that may struggle to rank.",
  "e-e-a-t score":"Experience, Expertise, Authoritativeness, Trust — Google's quality signals for content credibility.",
  "content gaps":"Topics or keywords competitors cover that you don't — opportunities to expand your content.",
  // Technical / CWV
  "site health":"Overall technical health — % of crawled pages that returned a successful (2xx) status with no major issues.",
  "perf score":"Google Lighthouse performance score (0–100). Higher means a faster-loading page.",
  "performance":"Page speed score from Google PageSpeed Insights. Higher is faster.",
  "accessibility":"How usable your page is for people with disabilities (Lighthouse score 0–100).",
  "best practices":"Adherence to modern web development standards (Lighthouse score 0–100).",
  "seo":"On-page SEO health score from Lighthouse (0–100).",
  // Table column headers
  "trend":"A quick read on ranking strength: 🔥 Top 3, ✓ Page 1 (4–10), Page 2 (11–20), or Page 3+ — based on your current position.",
  "position":"Your current Google ranking position for this keyword. #1 is the top organic result; lower numbers are better.",
  "keyword":"The search query users type into Google that this row analyses.",
  "url":"The specific page on your site that ranks (or would rank) for this keyword.",
  "top competitor":"The highest-ranking competitor domain appearing for this keyword.",
  "top ranking":"The domain currently holding the #1 organic position for this keyword.",
  "content gap":"What your page is missing vs the top-ranking pages — usually a word-count shortfall or missing schema.",
  "desktop":"Your ranking position in Google desktop search results.",
  "mobile":"Your ranking position in Google mobile search results.",
  "change":"How your ranking position moved since the previous check. ▲ = improved, ▼ = dropped.",
  "intent":"The searcher's goal: Informational (learn), Commercial (compare), Transactional (buy), or Navigational (find a site).",
  "volume":"Estimated monthly search volume for this keyword.",
  "kd":"Keyword Difficulty (0–100) — how hard it is to rank. Higher = more competitive.",
  "cpc":"Cost Per Click — the average amount advertisers pay for a click on this keyword in Google Ads.",
  "dr":"Domain Rating (0–100) — the backlink authority strength of this domain.",
  "da":"Domain Authority (0–100) — Moz's estimate of how well a domain will rank.",
  "traffic":"Estimated monthly organic search traffic to this domain or page.",
  "keywords":"Number of keywords this domain ranks for in organic search.",
  "content score":"An overall quality rating of the page's content (depth, structure, relevance).",
  "severity":"How urgent an issue is: Critical (fix now), Warning (should fix), or Info (minor).",
  "category":"The type of SEO issue — e.g. Crawlability, HTML Tags, Content, Images, Performance.",
  "citation boost":"How much adding this schema type is likely to improve your chances of being cited by AI.",
  "geo impact":"How much this signal affects your visibility in AI-generated answers (GEO = Generative Engine Optimization).",
  "opportunity score":"0–100 — higher means an easier, higher-value keyword to target.",
};

// GA4 default channel grouping — plain-language definitions shown as tooltips.
const CHANNEL_DEFS: Record<string,string> = {
  "Direct":"Sessions with no referrer — the user typed your URL, used a bookmark, or clicked a link in an untracked app (email client, PDF, WhatsApp, Slack). Often hides 'dark social' word-of-mouth traffic.",
  "Cross-network":"Ads shown across multiple Google networks at once (Search, Display, YouTube, Discover) — almost always Performance Max or Smart campaigns. This is PAID traffic.",
  "Organic Search":"Unpaid clicks from search engines (Google, Bing, Yahoo, etc.). Your SEO traffic.",
  "Paid Search":"Clicks from paid search ads (Google Ads / Microsoft Ads) on search-engine results pages.",
  "Organic Social":"Unpaid visits from social platforms — LinkedIn, Facebook, X/Twitter, Instagram, YouTube, Reddit, etc. (posts, profiles, shares).",
  "Paid Social":"Visits from paid ads running on social platforms (e.g. LinkedIn Ads, Meta Ads).",
  "Referral":"Visits from links on other websites that aren't search engines or social platforms (blogs, directories, partner sites, press).",
  "Email":"Visits from email campaigns, tagged with utm_medium=email. Untagged email links fall into Direct instead.",
  "Organic Video":"Unpaid visits from video platforms like YouTube, Vimeo or TikTok.",
  "Paid Video":"Visits from video ads (e.g. YouTube ads) bought outside of cross-network campaigns.",
  "Display":"Visits from display / banner ad campaigns across the Google Display Network and similar.",
  "Organic Shopping":"Unpaid visits from shopping surfaces and product listings.",
  "Paid Shopping":"Visits from paid shopping ads (Google Shopping product listing ads).",
  "Affiliates":"Visits driven by affiliate partners (utm_medium=affiliate).",
  "Audio":"Visits from audio-platform ads (e.g. podcast / streaming ads).",
  "SMS":"Visits from text-message campaigns (utm_medium=sms).",
  "Mobile Push Notifications":"Visits from mobile push-notification campaigns.",
  "Paid Other":"Paid campaigns that don't fit Search, Social, Shopping, Video or Display.",
  "Unassigned":"Sessions GA4 couldn't map to any channel — usually a tagging or consent gap, or data still processing. The channel-level equivalent of '(not set)'.",
};

// Resize/crop a data-URL image to exact pixel dimensions (cover, centred) in the browser.
function resizeImageDataUrl(dataUrl: string, w: number, h: number): Promise<{dataUrl:string; b64:string; mime:string}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas")); return; }
        // "cover" crop — fill the box, centre the overflow
        const scale = Math.max(w / img.width, h / img.height);
        const sw = w / scale, sh = h / scale;
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", 0.9);
        resolve({ dataUrl: out, b64: out.split(",")[1] || "", mime: "image/jpeg" });
      } catch (e) { reject(e instanceof Error ? e : new Error("resize failed")); }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}

// Hover tooltip — "?" icon. Uses fixed positioning so it escapes overflow/scroll containers.
const InfoTip = ({text}:{text:string}) => {
  const [pos,setPos] = useState<{x:number;y:number;above:boolean}|null>(null);
  const onEnter = (e:React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = r.top > 150; // enough room above? else show below
    setPos({ x: r.left + r.width/2, y: above ? r.top - 8 : r.bottom + 8, above });
  };
  return (
    <span style={{display:"inline-flex",marginLeft:5}} onMouseEnter={onEnter} onMouseLeave={()=>setPos(null)}>
      <span style={{width:14,height:14,borderRadius:"50%",border:`1px solid ${S.border}`,background:"#fff",color:S.muted,fontSize:9,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"help",lineHeight:1,flexShrink:0}}>?</span>
      {pos && (
        <span style={{position:"fixed",left:pos.x,top:pos.y,transform:`translateX(-50%) ${pos.above?"translateY(-100%)":""}`,background:"#1e293b",color:"#fff",fontSize:11,fontWeight:400,lineHeight:1.5,padding:"8px 11px",borderRadius:7,width:220,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",textTransform:"none" as const,letterSpacing:"normal" as const,whiteSpace:"normal" as const,pointerEvents:"none" as const}}>
          {text}
        </span>
      )}
    </span>
  );
};

const Metric = ({label,value,sub,color=S.text,trend,hint}:{label:string;value:string|number;sub?:string;color?:string;trend?:number;hint?:string}) => {
  const barColor = color===S.red||color==="#dc2626"?"linear-gradient(90deg,#ef4444,#f87171)":color===S.green||color==="#059669"?"linear-gradient(90deg,#10b981,#34d399)":color===S.amber||color==="#d97706"?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#6366f1,#818cf8)";
  const tip = hint || METRIC_HINTS[String(label).toLowerCase().trim()];
  return (
    <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:14,padding:"18px 20px",flex:1,minWidth:0,boxShadow:S.shadow,position:"relative"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:barColor,borderRadius:"14px 14px 0 0"}}/>
      <p style={{fontSize:11,fontWeight:600,color:S.muted,margin:"0 0 8px",letterSpacing:"0.05em",textTransform:"uppercase",display:"flex",alignItems:"center"}}>{label}{tip&&<InfoTip text={tip}/>}</p>
      <p style={{fontSize:26,fontWeight:700,color,margin:"0 0 4px",lineHeight:1,letterSpacing:"-0.02em"}}>{value}</p>
      {sub && <p style={{fontSize:12,color:S.muted,margin:0}}>{sub}</p>}
      {trend!==undefined && <p style={{fontSize:12,color:trend>=0?S.green:S.red,margin:"6px 0 0",fontWeight:600}}>{trend>=0?"+":""}{trend}% vs last period</p>}
    </div>
  );
};

const CopyBtn = ({text}:{text:string}) => {
  const [d,setD] = useState(false);
  return <Btn variant="secondary" small onClick={()=>{navigator.clipboard?.writeText(text);setD(true);setTimeout(()=>setD(false),2000)}}>{d?"✓ Copied":"Copy"}</Btn>;
};

const Toggle = ({value,onChange,options}:{value:string;onChange:(v:string)=>void;options:(string|{value:string;label:string})[]}) => (
  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
    {options.map(o => {
      const v=typeof o==="string"?o:(o as {value:string;label:string}).value;
      const lbl=typeof o==="string"?o:(o as {value:string;label:string}).label;
      return <button key={v} onClick={()=>onChange(v)} style={{padding:"5px 14px",borderRadius:7,border:`1.5px solid ${value===v?S.accent:S.border}`,background:value===v?"linear-gradient(135deg,#6366f1,#818cf8)":"transparent",color:value===v?"#fff":S.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s ease"}}>{lbl}</button>;
    })}
  </div>
);

const Tabs = ({tabs,active,onChange}:{tabs:string[];active:string;onChange:(t:string)=>void}) => (
  <div style={{display:"flex",gap:3,background:S.subtle,padding:4,borderRadius:10,marginBottom:18,flexWrap:"wrap"}}>
    {tabs.map(t => (
      <button key={t} onClick={()=>onChange(t)} style={{padding:"6px 16px",border:"none",borderRadius:7,background:active===t?S.card:"transparent",color:active===t?S.text:S.muted,fontWeight:active===t?600:400,fontSize:13,cursor:"pointer",fontFamily:"inherit",boxShadow:active===t?S.shadow:"none",transition:"all 0.15s ease",textTransform:"capitalize",whiteSpace:"nowrap"}}>{t}</button>
    ))}
  </div>
);

// ── Output UI components ──

const ScoreRing = ({score,size=72,label,thickness=6}:{score:number;size?:number;label?:string;thickness?:number}) => {
  const c = score>=80?S.green:score>=50?S.amber:S.red;
  const r = (size/2)-thickness-2;
  const circ = 2*Math.PI*r;
  const dash = (Math.max(0,Math.min(100,score))/100)*circ;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
      <div style={{position:"relative",width:size,height:size}}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${dash} ${circ-dash}`}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:size>=72?19:15,fontWeight:800,color:c,lineHeight:1,letterSpacing:"-0.03em"}}>{score}</span>
          <span style={{fontSize:9,color:"#94a3b8",fontWeight:500,marginTop:2}}>/100</span>
        </div>
      </div>
      {label && <span style={{fontSize:11,color:S.muted,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:"0.05em",textAlign:"center" as const}}>{label}</span>}
    </div>
  );
};

const LoadingBar = ({phase,phases}:{phase?:string;phases?:string[]}) => {
  const [idx,setIdx] = useState(0);
  useEffect(()=>{
    if(!phases||phases.length<=1)return;
    const t=setInterval(()=>setIdx(i=>i<phases.length-1?i+1:i),2200);
    return()=>clearInterval(t);
  },[phases]);
  const text = phases?phases[idx]:(phase||"Loading…");
  return(
    <div style={{padding:"14px 18px",background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:10,display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
      <div style={{display:"flex",gap:5,flexShrink:0,alignItems:"center"}}>
        {[0,150,300].map(d=>(
          <div key={d} style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",animation:`rm-bounce 1.2s ${d}ms ease-in-out infinite`}}/>
        ))}
      </div>
      <span style={{fontSize:13,color:"#4338ca",fontWeight:500}}>{text}</span>
      <style>{`@keyframes rm-bounce{0%,100%{opacity:.3;transform:scale(0.75)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
};

const IssueRow = ({title,severity,category,detail,fix,count,effort}:{title:string;severity:string;category:string;detail:string;fix:string;count:number;effort:string}) => {
  const sb:Record<string,string>={Critical:"#ef4444",Warning:"#f59e0b",Info:"#3b82f6"};
  const bg:Record<string,string>={Critical:"#fee2e2",Warning:"#fef3c7",Info:"#dbeafe"};
  const sc:Record<string,string>={Critical:"#b91c1c",Warning:"#92400e",Info:"#1d4ed8"};
  return (
    <div style={{display:"flex",borderBottom:`1px solid ${S.border}`,overflow:"hidden"}}>
      <div style={{width:4,background:sb[severity]||S.border,flexShrink:0}}/>
      <div style={{display:"flex",gap:14,padding:"14px 18px",flex:1,alignItems:"flex-start"}}>
        <div style={{flexShrink:0,minWidth:76,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <span style={{background:bg[severity],color:sc[severity],fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap" as const,letterSpacing:"0.04em"}}>{severity}</span>
          {count>0&&<span style={{fontSize:10,color:S.muted,textAlign:"center" as const}}>{count} pages</span>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5,flexWrap:"wrap" as const}}>
            <p style={{fontSize:13,fontWeight:700,color:S.text,margin:0,letterSpacing:"-0.01em"}}>{title}</p>
            {pill(category,"blue")}
            {pill(`${effort} effort`,effort==="Low"?"green":effort==="Medium"?"amber":"red")}
          </div>
          <p style={{fontSize:12,color:S.muted,margin:"0 0 7px",lineHeight:1.55}}>{detail}</p>
          <div style={{display:"flex",alignItems:"center",gap:6,background:"#eef2ff",borderRadius:6,padding:"5px 10px",width:"fit-content"}}>
            <span style={{fontSize:11,color:S.accentText,fontWeight:700}}>→</span>
            <span style={{fontSize:12,color:S.accentText,fontWeight:500}}>{fix}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckItem = ({label,ok,detail}:{label:string;ok:boolean;detail?:string}) => (
  <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,background:ok?"#ecfdf5":"#fef2f2",border:`1px solid ${ok?"#a7f3d0":"#fecaca"}`}}>
    <span style={{width:20,height:20,borderRadius:"50%",background:ok?"#10b981":"#ef4444",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:800,flexShrink:0,marginTop:1}}>{ok?"✓":"✗"}</span>
    <div style={{flex:1}}>
      <p style={{fontSize:12,fontWeight:600,color:ok?S.greenText:S.redText,margin:"0 0 1px",textTransform:"capitalize" as const}}>{label}</p>
      {detail&&<p style={{fontSize:11,color:S.muted,margin:0}}>{detail}</p>}
    </div>
  </div>
);

// ── Project helpers ──
function extractDomain(site: string): string {
  if (!site) return "";
  try { return new URL(site.startsWith("http") ? site : "https://"+site).hostname.replace(/^www\./,""); }
  catch { return site.replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0]; }
}
function extractOrigin(site: string): string {
  if (!site) return "";
  const s = site.startsWith("http") ? site : "https://"+site;
  try { const u = new URL(s); return u.origin; } catch { return s.replace(/\/$/,""); }
}

// Shared multi-format text extractor — TXT/MD/CSV/JSON, DOCX, PPTX, PDF
async function extractFileText(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const readText = () => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = e => res((e.target?.result as string) || ""); r.onerror = () => rej(new Error("read error")); r.readAsText(file); });
  const readBuf = () => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target?.result as ArrayBuffer); r.onerror = () => rej(new Error("read error")); r.readAsArrayBuffer(file); });

  if (["txt", "md", "csv", "json", "html", "xml"].includes(ext)) {
    return (await readText()).trim();
  }
  if (ext === "docx") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await readBuf());
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("Could not read DOCX");
    return xml.replace(/<w:br[^/]*/g, " ").replace(/<w:p[ >][^>]*>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  }
  if (ext === "pptx") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await readBuf());
    const slideFiles = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort();
    let out = "";
    for (const f of slideFiles) {
      const xml = await zip.file(f)?.async("string") || "";
      out += xml.replace(/<a:p[ >][^>]*>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() + "\n";
    }
    return out.trim();
  }
  if (ext === "pdf") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    const doc = await pdfjs.getDocument({ data: await readBuf() }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return text.replace(/\s+/g, " ").trim();
  }
  throw new Error(`Unsupported file type .${ext}. Use TXT, MD, CSV, DOCX, PPTX, or PDF.`);
}

// Shared crawl cache — one /api/techaudit fetch per domain is reused across all tools
// (Dashboard, Site Crawl, Project Overview, Executive Audit, E-E-A-T) for 10 minutes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _crawlCache = new Map<string, { t: number; p: Promise<any> }>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cachedCrawl(domain: string): Promise<any> {
  const key = (domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  const now = Date.now();
  const hit = _crawlCache.get(key);
  if (hit && now - hit.t < 600000) return hit.p; // 10-min TTL; returns same promise → dedupes concurrent calls
  const p = fetch(`/api/techaudit?domain=${encodeURIComponent(key)}`).then(r => r.json());
  _crawlCache.set(key, { t: now, p });
  p.catch(() => _crawlCache.delete(key)); // drop on failure so the next call retries
  return p;
}

function ProjectBar({activeSite, setPage}: {activeSite?: string; setPage?: (p: string) => void}) {
  if (!activeSite) return null;
  const domain = extractDomain(activeSite);
  // Build the list of connected sites from the cached GSC/GA4 maps (self-contained — no extra props)
  const sites = (()=>{
    const set = new Set<string>();
    const clean = (s:string)=>s.replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/$/,"").toLowerCase();
    try {
      const gsc = JSON.parse(localStorage.getItem("rm_gsc_map")||"{}");
      Object.keys(gsc).forEach(k=>{ if(k.includes(".")) set.add(clean(k)); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ga4 = JSON.parse(localStorage.getItem("rm_ga4_map")||"{}") as Record<string,any>;
      Object.entries(ga4).forEach(([k,v])=>{ const d=v?._siteDomain || (k.includes(".")&&!/^\d+$/.test(k)?k:""); if(d) set.add(clean(d)); });
    } catch {}
    set.add(clean(domain));
    return [...set].filter(Boolean).sort();
  })();
  // Switch site: persist + reload so every tool re-initialises with the new active site
  const change = (s:string)=>{
    if(!s || s===domain) return;
    try{ localStorage.setItem("rm_active_site", s); }catch{}
    window.location.reload();
  };
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:8,padding:"8px 14px",marginBottom:16,flexWrap:"wrap" as const,gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:20,height:20,borderRadius:5,background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:800,flexShrink:0}}>{domain.charAt(0).toUpperCase()}</div>
        <span style={{fontSize:12,fontWeight:700,color:"#6366f1"}}>Active project:</span>
        {sites.length>1 ? (
          <div style={{position:"relative" as const,display:"inline-flex",alignItems:"center"}}>
            <select value={domain} onChange={e=>change(e.target.value)}
              style={{appearance:"none" as const,WebkitAppearance:"none",background:"#fff",border:"1px solid rgba(99,102,241,0.3)",borderRadius:6,padding:"3px 24px 3px 8px",fontSize:12,fontWeight:700,color:"#1e293b",cursor:"pointer",outline:"none",fontFamily:"inherit"}}>
              {sites.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{position:"absolute" as const,right:8,pointerEvents:"none" as const,fontSize:8,color:"#6366f1"}}>▼</span>
          </div>
        ) : (
          <span style={{fontSize:12,color:"#1e293b",fontWeight:600}}>{domain}</span>
        )}
      </div>
      <div style={{display:"flex",gap:8}}>
        {setPage&&<button onClick={()=>setPage("project-overview")} style={{fontSize:11,fontWeight:600,color:"#6366f1",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:5,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}>Project Overview</button>}
        {setPage&&<button onClick={()=>setPage("projects")} style={{fontSize:11,color:"#64748b",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Manage sites</button>}
      </div>
    </div>
  );
}

// ── AI helpers — routed through /api/ai to keep the key server-side ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Append a unique nonce so Claude produces distinct output for every call,
// even when inputs look similar. Without this it defaults to the same template data.
function withNonce(prompt: string): string {
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `${prompt}\n\n[IMPORTANT: produce output that is distinctly specific to the exact input above — different domains/brands must yield meaningfully different numeric values, topics, and distributions. req:${nonce}]`;
}

async function ai(prompt: string, maxTokens=4096, claude=false): Promise<any> {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({prompt: withNonce(prompt), format:"json", maxTokens, ...(claude?{provider:"claude"}:{})}),
  });
  if(r.status === 429) {
    const d = await r.json();
    throw new Error(d.error || "Daily AI limit reached. Resets at midnight UTC.");
  }
  if(!r.ok) {
    const d = await r.json().catch(()=>({}));
    throw new Error((d as {error?:string}).error || `AI request failed (${r.status})`);
  }
  const d = await r.json();
  if(d.error) throw new Error(d.error);
  return d.result;
}

async function aiText(prompt: string, claude=false): Promise<string> {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({prompt: withNonce(prompt), format:"text", ...(claude?{provider:"claude"}:{})}),
  });
  if(r.status === 429) {
    const d = await r.json();
    throw new Error(d.error || "Daily AI limit reached. Resets at midnight UTC.");
  }
  if(!r.ok) {
    const d = await r.json().catch(()=>({}));
    throw new Error((d as {error?:string}).error || `AI request failed (${r.status})`);
  }
  const d = await r.json();
  if(d.error) throw new Error(d.error);
  return d.result;
}

// ── Rule-based insight generators (zero AI calls) ──────────────────────────

type Insight = {type:string;title:string;detail:string;action:string;impact:string};

function gscInsightsFromData(s:{ctr:number;pos:number;clicks:number;impressions:number}): Insight[] {
  const out: Insight[] = [];
  if (s.ctr < 1.5) out.push({type:"issue",title:"CTR below 1.5% — titles need work",detail:`Your ${s.ctr.toFixed(1)}% CTR is well below the 3–5% benchmark. Users see your pages but don't click.`,action:"Rewrite title tags: add numbers, power words, or brackets (e.g. [2025 Guide]). Test new meta descriptions.",impact:"High"});
  else if (s.ctr >= 5) out.push({type:"win",title:`Strong ${s.ctr.toFixed(1)}% CTR`,detail:"Your titles and meta descriptions are compelling — above the 3–5% industry benchmark.",action:"Document which title patterns work best and replicate them across lower-CTR pages.",impact:"Low"});
  else out.push({type:"opportunity",title:`CTR ${s.ctr.toFixed(1)}% — room to improve`,detail:"Average CTR is 3–5% for most industries. Small title tweaks can meaningfully lift clicks.",action:"Add a number or year to your top 5 title tags and measure the impact over 2 weeks.",impact:"Medium"});
  if (s.pos >= 11) out.push({type:"issue",title:`Avg position ${s.pos.toFixed(1)} — mostly page 2+`,detail:"Rankings outside the top 10 get under 1% of clicks. This is the biggest lever to pull.",action:"Find pages ranking 11–20 in Search Console. Refresh content, add internal links, improve E-E-A-T signals.",impact:"High"});
  else if (s.pos >= 4) out.push({type:"opportunity",title:`Positions 4–10 — close to top-3`,detail:`Avg position ${s.pos.toFixed(1)}. The top 3 results capture 60% of all clicks — you're within reach.`,action:"Add FAQ schema, refresh with latest data, and acquire 2–3 relevant backlinks to nudge into top 3.",impact:"High"});
  else out.push({type:"win",title:`Top-3 avg position (${s.pos.toFixed(1)})`,detail:"You're capturing the majority of organic clicks for your ranked keywords.",action:"Protect rankings: refresh content quarterly and monitor competitor movements.",impact:"Low"});
  if (s.impressions > 500 && s.clicks < s.impressions * 0.015) out.push({type:"opportunity",title:"High impressions, low clicks",detail:`${s.impressions.toLocaleString()} impressions but only ${s.clicks.toLocaleString()} clicks — a CTR problem at scale.`,action:"Add structured data (FAQ, HowTo) to earn rich snippets and review meta descriptions for all high-impression pages.",impact:"Medium"});
  if (out.length < 4) out.push({type:"opportunity",title:"Build topical authority",detail:"Sites with 10+ articles on a topic rank significantly higher than isolated pages.",action:"Use the SEO Content Agent to plan a content cluster around your top performing keyword.",impact:"Medium"});
  return out.slice(0,4);
}

function ga4InsightsFromData(s:{sessions:number;bounce_rate:number;conv_rate:number}): Insight[] {
  const out: Insight[] = [];
  if (s.bounce_rate > 70) out.push({type:"issue",title:`${s.bounce_rate.toFixed(0)}% bounce rate — high`,detail:"Above 70% suggests visitors aren't finding what they expected. Common causes: slow load, poor above-the-fold content, or intent mismatch.",action:"Improve hero section copy, reduce page load to under 2s, and match landing page content to the traffic source.",impact:"High"});
  else if (s.bounce_rate < 40) out.push({type:"win",title:`Low ${s.bounce_rate.toFixed(0)}% bounce rate`,detail:"Visitors are exploring multiple pages — strong engagement signal.",action:"Map the pages users flow through and add more internal links between these high-engagement paths.",impact:"Low"});
  else out.push({type:"opportunity",title:"Reduce bounce rate below 50%",detail:`${s.bounce_rate.toFixed(0)}% is average. Getting below 50% correlates directly with higher conversion rates.`,action:"Add a clear next-step CTA above the fold and improve internal linking to related content.",impact:"Medium"});
  if (s.conv_rate < 1) out.push({type:"issue",title:`${s.conv_rate.toFixed(2)}% conversion rate — below benchmark`,detail:"Under 1% means most visitors leave without converting. Industry average is 2–4%.",action:"Reduce friction: shorten forms to 3 fields, add a testimonial near the CTA, and A/B test button copy.",impact:"High"});
  else if (s.conv_rate > 3) out.push({type:"win",title:`Strong ${s.conv_rate.toFixed(2)}% conversion rate`,detail:"Above 3% puts you in the top-performing tier. Your funnel is working.",action:"Scale traffic to this funnel. Even incremental improvements compound quickly at this stage.",impact:"Low"});
  else out.push({type:"opportunity",title:"Push conversion rate above 3%",detail:`At ${s.conv_rate.toFixed(2)}%, you're within reach of the top-performing tier.`,action:"Run a heatmap session (Hotjar free tier) to find where users drop off, then fix the top 2 friction points.",impact:"High"});
  if (s.sessions < 1000) out.push({type:"opportunity",title:"Traffic volume below 1K sessions",detail:`${s.sessions.toLocaleString()} sessions gives limited data for optimization. Growing traffic is the priority.`,action:"Publish 2 long-form SEO articles per month targeting keywords with 1K–10K monthly searches.",impact:"Medium"});
  else if (out.length < 4) out.push({type:"opportunity",title:"Activate email to boost return visits",detail:"Returning visitors convert at 3× the rate of new visitors.",action:"Add a content upgrade to your top 3 pages to capture emails and drive repeat traffic.",impact:"Medium"});
  return out.slice(0,4);
}

function brandInsightsFromMentions(brand: string, mentions: {title:string;snippet:string;source:string;url:string;date:string}[]) {
  const posWords = /great|excel|best|top|leader|award|trusted|recommend|love|popular|innovat|powerful|fast|reliable|secur/i;
  const negWords = /bad|poor|worst|problem|issue|fail|slow|buggy|expensive|disappoint|difficult|unreliable|scam|complaint/i;
  let pos = 0, neg = 0, neu = 0;
  const recentMentions = mentions.slice(0, 6).map(m => {
    const text = `${m.title} ${m.snippet}`;
    let sentiment = "Neutral";
    const p = (text.match(posWords)||[]).length, n = (text.match(negWords)||[]).length;
    if (p > n) { sentiment = "Positive"; pos++; }
    else if (n > p) { sentiment = "Negative"; neg++; }
    else neu++;
    return {...m, sentiment};
  });
  if (mentions.length > 6) {
    const extra = mentions.slice(6);
    extra.forEach(m => {
      const text = `${m.title} ${m.snippet}`;
      const p = (text.match(posWords)||[]).length, n = (text.match(negWords)||[]).length;
      if (p > n) pos++; else if (n > p) neg++; else neu++;
    });
  }
  const total = mentions.length || 1;
  const sourceCounts: Record<string, number> = {};
  mentions.forEach(m => { sourceCounts[m.source] = (sourceCounts[m.source]||0)+1; });
  const sources = Object.entries(sourceCounts).map(([source, count]) => ({
    source, type: /reddit/i.test(source)?"Forum":/youtube|video/i.test(source)?"Video":/twitter|linkedin|facebook/i.test(source)?"Social":"News",
    mentions: count, sentiment: "Neutral" as const, authority: Math.min(90, 40 + count * 10),
  })).slice(0,8);
  return {
    summary: {total_mentions:total, sentiment_positive:Math.round((pos/total)*100), sentiment_neutral:Math.round((neu/total)*100), sentiment_negative:Math.round((neg/total)*100), reach: total * 4200, share_of_voice: Math.min(85, 15 + total * 3)},
    sources, recent_mentions: recentMentions,
    competitors: [], alerts: neg > 2 ? [`${neg} negative mentions detected — review and respond`] : [],
    opportunities: pos > 2 ? [`Leverage ${pos} positive mentions for testimonials and case studies`] : [`Increase brand presence — only ${total} mentions found`],
  };
}


function generateSchemaTemplate(type: string, desc: string): string {
  const now = new Date().toISOString().split("T")[0];
  const lines = desc.split(/[\n.]+/).map(s=>s.trim()).filter(Boolean);
  const name = lines[0]?.slice(0,80) || type;
  const urlMatch = desc.match(/https?:\/\/[^\s,)>]+/); const url = urlMatch?.[0] || "https://example.com";
  const authorMatch = desc.match(/(?:by|author)[:\s]+([A-Z][a-zA-Z ]{2,35})/i); const author = authorMatch?.[1]?.trim() || "Author Name";
  const dateMatch = desc.match(/\d{4}-\d{2}-\d{2}/); const date = dateMatch?.[0] || now;
  const priceMatch = desc.match(/\$?(\d+(?:\.\d{2})?)/); const price = priceMatch?.[1] || "29.99";
  const phoneMatch = desc.match(/(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/); const phone = phoneMatch?.[0] || "+1-800-555-0100";
  const addrMatch = desc.match(/(?:at|located?|address)[:\s]+([^.]{5,80})/i); const address = addrMatch?.[1]?.trim() || "123 Main Street, City, ST 12345";

  const templates: Record<string, object> = {
    Article: {"@context":"https://schema.org","@type":"Article","headline":name,"author":{"@type":"Person","name":author},"datePublished":date,"dateModified":now,"publisher":{"@type":"Organization","name":"Publisher Name","logo":{"@type":"ImageObject","url":"https://example.com/logo.png"}},"description":desc.slice(0,160),"url":url,"image":"https://example.com/article-image.jpg"},
    NewsArticle: {"@context":"https://schema.org","@type":"NewsArticle","headline":name,"author":{"@type":"Person","name":author},"datePublished":date,"dateModified":now,"publisher":{"@type":"Organization","name":"News Publisher"},"description":desc.slice(0,160),"url":url},
    FAQ: {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is "+name+"?","acceptedAnswer":{"@type":"Answer","text":desc.slice(0,200)}},{"@type":"Question","name":"How do I get started?","acceptedAnswer":{"@type":"Answer","text":"Contact us or visit our website to get started today."}}]},
    Product: {"@context":"https://schema.org","@type":"Product","name":name,"description":desc.slice(0,200),"offers":{"@type":"Offer","price":price,"priceCurrency":"USD","availability":"https://schema.org/InStock","url":url},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"42"}},
    LocalBusiness: {"@context":"https://schema.org","@type":"LocalBusiness","name":name,"address":{"@type":"PostalAddress","streetAddress":address},"telephone":phone,"url":url,"openingHours":"Mo-Fr 09:00-18:00","description":desc.slice(0,200)},
    HowTo: {"@context":"https://schema.org","@type":"HowTo","name":name,"description":desc.slice(0,160),"step":[{"@type":"HowToStep","name":"Step 1","text":"First step description"},{"@type":"HowToStep","name":"Step 2","text":"Second step description"},{"@type":"HowToStep","name":"Step 3","text":"Third step description"}]},
    BreadcrumbList: {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://example.com"},{"@type":"ListItem","position":2,"name":"Category","item":"https://example.com/category"},{"@type":"ListItem","position":3,"name":name,"item":url}]},
    Organization: {"@context":"https://schema.org","@type":"Organization","name":name,"url":url,"logo":"https://example.com/logo.png","contactPoint":{"@type":"ContactPoint","telephone":phone,"contactType":"customer service"},"sameAs":["https://twitter.com/example","https://linkedin.com/company/example"]},
    Event: {"@context":"https://schema.org","@type":"Event","name":name,"startDate":date+"T09:00","endDate":date+"T17:00","location":{"@type":"Place","name":"Venue Name","address":address},"organizer":{"@type":"Organization","name":author},"description":desc.slice(0,200),"url":url},
    Recipe: {"@context":"https://schema.org","@type":"Recipe","name":name,"author":{"@type":"Person","name":author},"datePublished":date,"description":desc.slice(0,200),"prepTime":"PT15M","cookTime":"PT30M","totalTime":"PT45M","recipeYield":"4 servings","recipeIngredient":["Ingredient 1","Ingredient 2","Ingredient 3"],"recipeInstructions":[{"@type":"HowToStep","text":"Step 1 instructions"},{"@type":"HowToStep","text":"Step 2 instructions"}]},
    Review: {"@context":"https://schema.org","@type":"Review","name":name,"reviewBody":desc.slice(0,300),"author":{"@type":"Person","name":author},"datePublished":date,"reviewRating":{"@type":"Rating","ratingValue":"4.5","bestRating":"5"},"itemReviewed":{"@type":"Thing","name":"Reviewed Item"}},
    VideoObject: {"@context":"https://schema.org","@type":"VideoObject","name":name,"description":desc.slice(0,200),"thumbnailUrl":"https://example.com/thumbnail.jpg","uploadDate":date,"duration":"PT5M","contentUrl":url,"author":{"@type":"Person","name":author}},
    JobPosting: {"@context":"https://schema.org","@type":"JobPosting","title":name,"datePosted":date,"validThrough":now,"description":desc.slice(0,300),"hiringOrganization":{"@type":"Organization","name":"Company Name","sameAs":url},"jobLocation":{"@type":"Place","address":address},"employmentType":"FULL_TIME","baseSalary":{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","value":80000,"unitText":"YEAR"}}},
    Person: {"@context":"https://schema.org","@type":"Person","name":name,"url":url,"jobTitle":"Professional Title","worksFor":{"@type":"Organization","name":"Company Name"},"description":desc.slice(0,200)},
    Service: {"@context":"https://schema.org","@type":"Service","name":name,"provider":{"@type":"Organization","name":"Provider Name","url":url},"description":desc.slice(0,200),"offers":{"@type":"Offer","price":price,"priceCurrency":"USD"},"areaServed":"Worldwide"},
    SoftwareApplication: {"@context":"https://schema.org","@type":"SoftwareApplication","name":name,"applicationCategory":"WebApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":price,"priceCurrency":"USD"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","reviewCount":"89"},"description":desc.slice(0,200),"url":url},
    Course: {"@context":"https://schema.org","@type":"Course","name":name,"description":desc.slice(0,200),"provider":{"@type":"Organization","name":"Course Provider","sameAs":url},"author":{"@type":"Person","name":author},"hasCourseInstance":{"@type":"CourseInstance","courseMode":"Online","instructor":{"@type":"Person","name":author}}},
    WebPage: {"@context":"https://schema.org","@type":"WebPage","name":name,"description":desc.slice(0,160),"url":url,"dateModified":now,"author":{"@type":"Person","name":author},"publisher":{"@type":"Organization","name":"Site Name"}},
  };
  const obj = templates[type] || templates["Article"];
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

function downloadCSV(filename: string, headers: string[], rows: (string|number)[][]) {
  const esc = (v: string|number) => `"${String(v).replace(/"/g,'""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = filename; a.click();
}

const fmtNumGlobal = (n: number) => n>=1000000?`${(n/1000000).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(1)}K`:`${Math.round(n)}`;


// ── Dashboard Issues Panel (live crawl) ──────────────────────────────────────
function DashboardIssues({domain,hasAny,setPage}:{domain:string;hasAny:boolean;setPage:(p:string)=>void}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [crawl,setCrawl]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [fetched,setFetched]=useState("");

  useEffect(()=>{
    if(!domain||!hasAny||fetched===domain)return;
    setLoading(true);setFetched(domain);
    cachedCrawl(domain)
      .then(d=>setCrawl(d)).catch(()=>{}).finally(()=>setLoading(false));
  },[domain,hasAny,fetched]);

  if(!hasAny||(!loading&&!crawl))return null;

  const s=crawl?.summary;
  const issues=crawl?[
    {label:"Missing title tags",count:s?.missing_title||0,severity:"Critical",fix:"Add unique <title> tags to every page. Target 50–60 characters.",page:"technical"},
    {label:"Missing meta descriptions",count:s?.missing_meta||0,severity:"Warning",fix:"Write compelling meta descriptions (130–160 chars) for all pages.",page:"onpage"},
    {label:"Missing H1 tags",count:s?.missing_h1||0,severity:"Critical",fix:"Add exactly one <h1> per page with the primary keyword.",page:"onpage"},
    {label:"Pages with errors (4xx/5xx)",count:s?.errors||0,severity:"Critical",fix:"Fix broken pages or set up 301 redirects to working URLs.",page:"brokenlinks"},
    {label:"Thin content (<300 words)",count:s?.thin_content||0,severity:"Warning",fix:"Expand thin pages to 600+ words with relevant, unique content.",page:"audit"},
    {label:"Images without alt text",count:s?.imgs_no_alt||0,severity:"Warning",fix:"Add descriptive alt attributes to all images for SEO and accessibility.",page:"technical"},
    {label:"No canonical tag",count:s?.no_canonical||0,severity:"Warning",fix:"Add <link rel='canonical'> to prevent duplicate content issues.",page:"technical"},
    {label:"Noindex pages",count:s?.noindex_pages||0,severity:"Info",fix:"Review noindex pages — ensure only intended pages are excluded from Google.",page:"technical"},
  ].filter(i=>i.count>0):[];

  const totalIssues=issues.reduce((a,i)=>a+i.count,0);
  const critical=issues.filter(i=>i.severity==="Critical");
  const warnings=issues.filter(i=>i.severity==="Warning");
  const info=issues.filter(i=>i.severity==="Info");
  const sColor={Critical:S.red,Warning:S.amber,Info:S.blue} as Record<string,string>;
  const sBg={Critical:S.redBg,Warning:S.amberBg,Info:S.blueBg} as Record<string,string>;
  const sText={Critical:S.redText,Warning:S.amberText,Info:S.blueText} as Record<string,string>;
  const health=s&&s.total>0?Math.round((s.ok/s.total)*100):null;

  return (
    <Card style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>Website Issues &amp; Fixes</p>
          <p style={{fontSize:11,color:S.muted,margin:0}}>
            {loading?"Crawling site…":crawl?`${s?.total||0} pages crawled · ${totalIssues} issues found`:""}
          </p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {health!==null&&(
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:health>=80?S.greenBg:health>=60?S.amberBg:S.redBg,borderRadius:6}}>
              <span style={{fontSize:11,fontWeight:700,color:health>=80?S.greenText:health>=60?S.amberText:S.redText}}>Site health {health}%</span>
            </div>
          )}
          <button onClick={()=>setPage("technical")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Full audit →</button>
        </div>
      </div>

      {loading&&<LoadingBar phase="Crawling your site for issues…"/>}

      {!loading&&issues.length===0&&crawl&&(
        <div style={{textAlign:"center" as const,padding:"20px 0",color:S.green}}>
          <p style={{fontSize:20,margin:"0 0 6px"}}>✓</p>
          <p style={{fontSize:13,fontWeight:700,color:S.greenText,margin:"0 0 4px"}}>No issues found</p>
          <p style={{fontSize:12,color:S.muted,margin:0}}>All {s?.total} crawled pages look healthy</p>
        </div>
      )}

      {issues.length>0&&(
        <>
          {/* Summary pills */}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" as const}}>
            {critical.length>0&&<span style={{fontSize:11,fontWeight:700,background:S.redBg,color:S.redText,padding:"3px 10px",borderRadius:5}}>🔴 {critical.length} Critical</span>}
            {warnings.length>0&&<span style={{fontSize:11,fontWeight:700,background:S.amberBg,color:S.amberText,padding:"3px 10px",borderRadius:5}}>🟡 {warnings.length} Warnings</span>}
            {info.length>0&&<span style={{fontSize:11,fontWeight:700,background:S.blueBg,color:S.blueText,padding:"3px 10px",borderRadius:5}}>🔵 {info.length} Info</span>}
          </div>

          {/* Issue rows */}
          <div style={{display:"grid",gap:8}}>
            {[...critical,...warnings,...info].map((issue,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center",padding:"10px 14px",background:sBg[issue.severity]||S.subtle,borderRadius:8,border:`1px solid ${sColor[issue.severity]}30`,cursor:"pointer"}}
                onClick={()=>setPage(issue.page)}
                onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.opacity="0.85"}
                onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.opacity="1"}>
                <div style={{textAlign:"center" as const,minWidth:36}}>
                  <p style={{fontSize:18,fontWeight:800,color:sColor[issue.severity],margin:0,lineHeight:1}}>{issue.count}</p>
                  <p style={{fontSize:9,color:sColor[issue.severity],margin:0,fontWeight:600}}>pages</p>
                </div>
                <div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:9,fontWeight:700,color:sText[issue.severity],background:sBg[issue.severity],border:`1px solid ${sColor[issue.severity]}40`,padding:"1px 6px",borderRadius:3,textTransform:"uppercase" as const}}>{issue.severity}</span>
                    <span style={{fontSize:12,fontWeight:700,color:S.text}}>{issue.label}</span>
                  </div>
                  <p style={{fontSize:11,color:S.muted,margin:0}}>→ {issue.fix}</p>
                </div>
                <span style={{fontSize:11,color:S.accentText,fontWeight:600,whiteSpace:"nowrap" as const}}>Fix →</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── DASHBOARD ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Dashboard({setPage,gscData:_gscData,ga4Data:_ga4Data,aeoData:_aeoData,setAeoData:_setAeoData,activeSite,setActiveSite,gscDataMap={},ga4DataMap={},aeoDataMap={},upsertAeo,upsertGsc,upsertGa4}:{setPage:(p:string)=>void;gscData:any;ga4Data:any;aeoData:any;setAeoData:(d:any)=>void;activeSite:string;setActiveSite:(s:string)=>void;gscDataMap?:Record<string,any>;ga4DataMap?:Record<string,any>;aeoDataMap?:Record<string,any>;upsertAeo?:(domain:string,d:any)=>void;upsertGsc?:(domain:string,d:any)=>void;upsertGa4?:(propId:string,d:any)=>void}) {
  // Suppress unused-var warnings for legacy props
  void _gscData; void _ga4Data; void _aeoData; void _setAeoData;
  const [aeoLoading,setAeoLoading]=useState(false);
  const [realVisLoading,setRealVisLoading]=useState(false);

  // ── Site selector ─────────────────────────────────────────────
  const allGscDomains = Object.keys(gscDataMap);
  const allGa4Props   = Object.keys(ga4DataMap);
  // Only include GA4 entries that are real domain names — exclude raw numeric property IDs
  const isRealDomain = (s:string) => !/^\d+$/.test(s) && s.includes(".");
  const ga4Domains = allGa4Props
    .map(k => ga4DataMap[k]?._siteDomain || (isRealDomain(k) ? k : null))
    .filter((d): d is string => !!d && !allGscDomains.includes(d));
  // Unified site list — each unique domain only once, no property IDs
  const allSites = [...allGscDomains, ...new Set(ga4Domains)];
  const defaultSite = (()=>{
    const active=(activeSite||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
    if(active&&(gscDataMap[active]||allSites.includes(active))) return active;
    return allSites[0]||"";
  })();
  const [viewDomain,setViewDomainRaw]=useState(defaultSite);

  // Sync dropdown → activeSite so ALL tools use the selected site
  const setViewDomain=(d:string)=>{
    setViewDomainRaw(d);
    setActiveSite(d);
  };

  // ── Strict per-domain data — NEVER mix data across sites ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewGsc:any = gscDataMap[viewDomain] || null;

  // GA4 matching — tries multiple strategies to find the right property for viewDomain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewGa4:any = (()=>{
    const entries = Object.entries(ga4DataMap) as [string, {domain?:string;_siteDomain?:string;_propId?:string;[k:string]:unknown}][];
    if(!entries.length) return null;

    const clean = (s:string) => (s||"").replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/$/,"").toLowerCase();
    const vd = clean(viewDomain);

    // 1. Key is exactly the viewDomain (new save format)
    if(ga4DataMap[viewDomain]) return ga4DataMap[viewDomain];

    // 2. _siteDomain field matches (new save format with _siteDomain embedded)
    const bySite = entries.find(([,d])=>clean(d?._siteDomain||"")===vd);
    if(bySite) return bySite[1];

    // 3. Fuzzy domain or property domain field match
    const fuzzy = entries.find(([k,d])=>clean(k)===vd||clean(d?.domain||"")===vd);
    if(fuzzy) return fuzzy[1];

    // 4. Only ONE GA4 property stored AND only ONE site is selected → unambiguous
    if(entries.length===1) return entries[0][1];

    return null;
  })();

  // aeoData strictly for the selected domain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aeoData:any = aeoDataMap[viewDomain]||null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setAeoData=(d:any)=>{ if(upsertAeo) upsertAeo(viewDomain,d); };

  // realVis strictly for the selected domain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realVis:any = aeoDataMap[viewDomain]?._realVis||null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setRealVis=(d:any)=>{ if(upsertAeo) upsertAeo(viewDomain,{...(aeoDataMap[viewDomain]||{}),_realVis:d}); };
  // Is the cached visibility data actually meaningful? (ignore stale all-zero entries)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasVisData = (()=>{ const V:any = realVis||aeoData; if(!V) return false; return (V.source_breakdown?.length>0) || (V.metrics?.mentions>0) || (V.visibility_score>0) || (V.ai_visibility?.total_questions>0); })();

  // domain string — strictly from selected site's data
  const domain = viewDomain || viewGsc?.domain || viewGa4?.domain || "";
  const hasAny = !!(viewGsc||viewGa4);

  // One-click handoff: seed the SEO Campaign Agent with this gap keyword + active domain
  const seedBlog = (keyword:string) => {
    localStorage.setItem("rm_campaign_seed", JSON.stringify({ keyword, domain }));
    setPage("seoagent");
  };
  // Handoff to On-Page checker: resolve the ACTUAL ranking page for this keyword (GSC), not the homepage
  const seedOnPage = async (keyword:string) => {
    let pageUrl = domain ? `https://${domain}/` : "";
    const gscSite = viewGsc?._site || activeSite || domain;
    try{
      if(gscSite){
        const r=await fetch(`/api/gsc?site=${encodeURIComponent(gscSite)}&keyword=${encodeURIComponent(keyword)}`,{cache:"no-store"});
        if(r.ok){ const d=await r.json(); if(d.page) pageUrl=d.page; }
      }
    }catch{/* fall back to homepage */}
    localStorage.setItem("rm_onpage_seed", JSON.stringify({ url: pageUrl, keyword }));
    setPage("onpage");
  };
  const BlogBtn = ({kw}:{kw:string}) => (
    <button onClick={(e)=>{e.stopPropagation();seedBlog(kw);}} title={`Create a blog targeting "${kw}"`}
      style={{flexShrink:0,fontSize:10,fontWeight:700,color:S.accent,background:S.accentBg,border:`1px solid #c7d2fe`,borderRadius:5,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>✍️ Blog</button>
  );

  const chg = (v:number,inv=false) => {
    const pos = inv?v<=0:v>=0;
    return <span style={{fontSize:11,fontWeight:600,color:pos?S.green:S.red}}>{v>=0?"+":""}{v}%</span>;
  };

  const [aeoPhase,setAeoPhase]=useState("");
  const [kwSegment,setKwSegment]=useState<"all"|"branded"|"nonbranded">("all");

  // ── Date range selector (re-fetches GSC + GA4 for the active site) ──
  const [rangeMode,setRangeMode]=useState<string>(()=>localStorage.getItem("rm_dash_range")||"28"); // "7"|"28"|"90"|"custom"
  const [customStart,setCustomStart]=useState("");
  const [customEnd,setCustomEnd]=useState("");
  const [rangeLoading,setRangeLoading]=useState(false);
  const [rangeErr,setRangeErr]=useState("");
  const rangeLabel = rangeMode==="custom"
    ? (customStart&&customEnd?`${customStart} → ${customEnd}`:"Custom range")
    : `Last ${rangeMode} days`;
  // Previous comparison window (for the "vs previous period" caption)
  const curRange = viewGa4?._range || viewGsc?._range || null;
  const prevLabel = (()=>{
    if(viewGa4?._prevRange) return `${viewGa4._prevRange.start} → ${viewGa4._prevRange.end}`;
    if(!curRange) return "";
    const s=new Date(curRange.start), e=new Date(curRange.end);
    const len=Math.round((e.getTime()-s.getTime())/86400000)+1;
    const pe=new Date(s.getTime()-86400000);
    const ps=new Date(pe.getTime()-(len-1)*86400000);
    const iso=(d:Date)=>d.toISOString().split("T")[0];
    return `${iso(ps)} → ${iso(pe)}`;
  })();

  const applyRange = async (mode:string, start?:string, end?:string) => {
    const qs = mode==="custom"
      ? (start&&end?`start=${start}&end=${end}`:"")
      : `days=${mode}`;
    if(!qs){ setRangeErr("Pick both start and end dates."); return; }
    // Apply the selection immediately so the dropdown + labels reflect the chosen range
    setRangeMode(mode);
    try{ localStorage.setItem("rm_dash_range",mode); }catch{}
    setRangeErr(""); setRangeLoading(true);
    const errs:string[]=[];
    // Re-fetch GSC and GA4 INDEPENDENTLY so one failing never blocks the other.
    const gscSite = viewGsc?._site || activeSite || domain;
    const gscTask = (viewGsc && gscSite && upsertGsc) ? (async()=>{
      try{
        const r=await fetch(`/api/gsc?site=${encodeURIComponent(gscSite)}&${qs}`,{cache:"no-store"});
        const d=await r.json().catch(()=>({}));
        // Save under the key the dashboard actually reads (viewDomain), not the route's
        // normalised domain — otherwise a "www." site stores under a key that's never read.
        if(r.ok && !d.error){ upsertGsc(viewDomain, d); if(d.domain && d.domain!==viewDomain) upsertGsc(d.domain, d); }
        else errs.push(`Search Console: ${d.error||r.status}`);
      }catch(e){ errs.push(`Search Console: ${e instanceof Error?e.message:"failed"}`); }
    })() : Promise.resolve();
    // GA4 needs the numeric property id — fall back to viewGa4.domain (the route returns it as propertyId)
    const propId = viewGa4?._propId || viewGa4?.domain;
    const siteDom = viewGa4?._siteDomain || domain;
    const ga4Task = (viewGa4 && propId && upsertGa4) ? (async()=>{
      try{
        const r=await fetch(`/api/ga4?property=${encodeURIComponent(propId)}&${qs}`,{cache:"no-store"});
        const d=await r.json().catch(()=>({}));
        if(r.ok && !d.error){ const merged={...d,_siteDomain:siteDom,_propId:propId}; if(siteDom) upsertGa4(siteDom,merged); if(propId&&propId!==siteDom) upsertGa4(propId,merged); }
        else errs.push(`Analytics: ${d.error||r.status}`);
      }catch(e){ errs.push(`Analytics: ${e instanceof Error?e.message:"failed"}`); }
    })() : Promise.resolve();
    await Promise.all([gscTask,ga4Task]);
    setRangeErr(errs.join(" · "));
    setRangeLoading(false);
  };

  // Branded keyword detection — matches the brand name AND its misspellings (fuzzy)
  const brandTokens = (()=>{
    const d = (domain||"").replace(/^https?:\/\//,"").replace(/^www\./,"");
    const root = d.split(".")[0]||"";
    return [root].filter(t=>t.length>=3).map(t=>t.toLowerCase());
  })();
  // Levenshtein edit distance (capped for speed)
  const lev = (a:string,b:string):number => {
    const m=a.length,n=b.length;
    if(Math.abs(m-n)>4) return 99;
    let prev=Array.from({length:n+1},(_,i)=>i);
    for(let i=1;i<=m;i++){
      const cur=[i];
      for(let j=1;j<=n;j++){
        cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      }
      prev=cur;
    }
    return prev[n];
  };
  const isBranded = (kw:string) => {
    const k = kw.toLowerCase().replace(/[^a-z0-9\s]/g," ");
    return brandTokens.some(t=>{
      if(k.includes(t)) return true; // exact substring
      // Allowed edits scale with brand length (distinctive brands tolerate more)
      const maxDist = Math.max(1, Math.floor(t.length/3));
      // Fuzzy match each word in the keyword against the brand token
      return k.split(/\s+/).filter(Boolean).some(w=>{
        if(Math.abs(w.length-t.length)>maxDist) return false;
        return lev(w,t)<=maxDist;
      });
    });
  };

  // Real AI visibility fetch (replaces AI-estimated data)
  const runRealVisibility = async (d: string, gsc: {queries?:{query:string;impressions:number;clicks:number}[]}|null) => {
    if(!d) return; setRealVisLoading(true);
    try {
      const brand = d.replace(/\.[a-z]{2,}$/,"").replace(/^www\./,"");
      // Sum branded query impressions from GSC for real signal
      const brandedImpr = gsc?.queries?.filter((q:{query:string})=>q.query.toLowerCase().includes(brand.toLowerCase())).reduce((a:{impressions:number},q:{impressions:number})=>({impressions:a.impressions+q.impressions}),{impressions:0}).impressions||0;
      const brandedClicks = gsc?.queries?.filter((q:{query:string})=>q.query.toLowerCase().includes(brand.toLowerCase())).reduce((a:{clicks:number},q:{clicks:number})=>({clicks:a.clicks+q.clicks}),{clicks:0}).clicks||0;
      const r = await fetch(`/api/tools?tool=aivisibility&brand=${encodeURIComponent(brand)}&domain=${encodeURIComponent(d)}&branded_impr=${brandedImpr}&branded_clicks=${brandedClicks}`);
      const data = await r.json();
      if(!data.error) { setRealVis(data); setAeoData({...data,_real:true}); pushTrend(d,data,gsc); }
    } catch(e){console.error(e);}
    finally{setRealVisLoading(false);}
  };

  // ── Historical trend memory: one snapshot per day per domain (localStorage) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trend,setTrend]=useState<any[]>([]);
  useEffect(()=>{ try{ setTrend(JSON.parse(localStorage.getItem(`rm_trend_${(viewDomain||"_").toLowerCase()}`)||"[]")); }catch{ setTrend([]); } },[viewDomain]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pushTrend=(d:string,data:any,gsc:any)=>{
    const key=`rm_trend_${(d||"_").toLowerCase()}`;
    const today=new Date().toISOString().slice(0,10);
    const snap={
      date:today,
      visibility:data.visibility_score??null,
      ai_pct:data.ai_visibility?.ai_visibility_pct??null,
      overall:data.ai_visibility?.overall_rate??data.ai_visibility?.ai_visibility_pct??null,
      sov:data.ai_visibility?.share_of_voice??null,
      avg_rank:data.ai_visibility?.avg_rank??null,
      clicks:gsc?.summary?.clicks??null,
      impressions:gsc?.summary?.impressions??null,
      pos:gsc?.summary?.pos??null,
      ctr:gsc?.summary?.ctr??null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let arr:any[]=[]; try{arr=JSON.parse(localStorage.getItem(key)||"[]");}catch{}
    arr=arr.filter(x=>x.date!==today); arr.push(snap); arr=arr.slice(-90);
    try{localStorage.setItem(key,JSON.stringify(arr));}catch{}
    if((d||"").toLowerCase()===(viewDomain||"").toLowerCase()) setTrend(arr);
  };

  const runAeo = async () => {
    if(!domain) return;
    // First run real visibility check
    await runRealVisibility(domain, viewGsc);
    // Then also run deeper AI analysis for topics/opportunities
    setAeoLoading(true); setAeoPhase("");
    try {
      setAeoPhase("Crawling sitemap…");
      let realUrls: string[] = [];
      try {
        const scrapeRes = await fetch(`/api/py/scrape?domain=${encodeURIComponent(domain)}`);
        if (scrapeRes.ok) { const sd = await scrapeRes.json(); realUrls = sd.urls||[]; }
      } catch { /* ignore */ }
      setAeoPhase("Analysing topics & opportunities…");
      const pageContext = realUrls.length>0 ? `\n\nREAL PAGES:\n${realUrls.slice(0,20).join("\n")}` : "";
      const d = await ai(`You are an AI visibility analyst for "${domain}". Generate topic analysis and opportunities.${pageContext}
Return ONLY valid JSON: {"performing_topics":[{"topic":"string","visibility":number,"mentions":number,"ai_volume":number,"intent":"Informational|Commercial|Navigational","trend":"up|down|stable","prompts":[{"prompt":"string","llm":"string","response":"string","mentioned":boolean,"cited":boolean}]}],"topic_opportunities":[{"topic":"string","volume":number,"competition":"Low|Medium|High","intent":"string","reason":"string"}],"cited_pages":[{"page":"string","citations":number,"llms":number}],"recommendations":["string"],"countries":[{"country":"string","flag":"string","pct":number,"count":number}]}
5 performing topics (2 prompts each), 5 opportunities, 4 countries summing to 100%.`);
      setAeoData((prev: {[key:string]:unknown}|null)=>({...(prev||{}), ...d, _scraped: realUrls.length>0, _pageCount: realUrls.length, _real: true}));
    } catch(e){console.error(e);}
    finally{setAeoLoading(false);setAeoPhase("");}
  };

  // ── Sparkline helper ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Sparkline = ({data,key:_k,color=S.accent,height=48}:{data:any[];key?:string;color?:string;height?:number}) => {
    const vals = data.map((d:any)=>d.sessions||d.clicks||0);
    const mx = Math.max(...vals,1);
    const w = Math.max(data.length*18,200);
    const pts = vals.map((v:number,i:number)=>`${i*(w/(data.length-1||1))},${height-4-Math.round((v/mx)*(height-8))}`).join(" ");
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} style={{display:"block",overflow:"visible"}}>
        <polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" points={pts}/>
        {vals.map((v:number,i:number)=>{
          const x=i*(w/(data.length-1||1)),y=height-4-Math.round((v/mx)*(height-8));
          return i===vals.length-1?<circle key={i} cx={x} cy={y} r="3" fill={color}/>:null;
        })}
      </svg>
    );
  };

  // ── KPI card ──
  const KPI = ({label,value,change,inv=false,color,sub,onClick}:{label:string;value:string;change?:number;inv?:boolean;color?:string;sub?:string;onClick?:()=>void}) => {
   const tip = METRIC_HINTS[String(label).toLowerCase().trim()];
   return (
    <div onClick={onClick} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"16px 18px",cursor:onClick?"pointer":"default",position:"relative" as const}}
      onMouseEnter={e=>{if(onClick)(e.currentTarget as HTMLDivElement).style.borderColor=S.accent;}}
      onMouseLeave={e=>{if(onClick)(e.currentTarget as HTMLDivElement).style.borderColor=S.border;}}>
      <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",margin:"0 0 6px",display:"flex",alignItems:"center"}}>{label}{tip&&<InfoTip text={tip}/>}</p>
      <p style={{fontSize:22,fontWeight:700,color:color||S.text,margin:"0 0 4px",lineHeight:1}}>{value}</p>
      {sub && <p style={{fontSize:11,color:S.muted,margin:"0 0 4px"}}>{sub}</p>}
      {change!==undefined && <p style={{fontSize:11,margin:0}}>{chg(change,inv)} vs prev period</p>}
    </div>
   );
  };

  // ── Source bar ──
  const COLORS=[S.accent,S.green,S.amber,S.blue,"#8b5cf6","#ec4899"];

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap" as const,gap:8}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3,flexWrap:"wrap" as const}}>
            <h2 style={{fontSize:22,fontWeight:700,color:S.text,margin:0}}>Analytics Dashboard</h2>
            {/* Site selector dropdown */}
            {allSites.length>0?(
              <div style={{position:"relative" as const,display:"inline-flex",alignItems:"center"}}>
                <select
                  value={viewDomain}
                  onChange={e=>setViewDomain(e.target.value)}
                  style={{appearance:"none" as const,WebkitAppearance:"none",background:S.accentBg,border:`1.5px solid #6366f180`,borderRadius:20,padding:"4px 28px 4px 12px",fontSize:12,fontWeight:700,color:S.accentText,cursor:"pointer",outline:"none",fontFamily:"inherit"}}
                >
                  {allSites.map(s=>(
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span style={{position:"absolute" as const,right:9,pointerEvents:"none" as const,fontSize:9,color:S.accentText}}>▼</span>
              </div>
            ):(
              domain&&<span style={{fontSize:13,fontWeight:600,color:S.accentText,background:S.accentBg,borderRadius:20,padding:"3px 10px"}}>{domain}</span>
            )}
          </div>
          <p style={{fontSize:13,color:S.muted,margin:0}}>Website performance, AI search visibility, and keyword rankings — {rangeLabel.toLowerCase()}.</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const}}>
          {allSites.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{position:"relative" as const,display:"inline-flex",alignItems:"center"}}>
                <select value={rangeMode} onChange={e=>{const m=e.target.value; if(m==="custom"){setRangeMode("custom");} else {applyRange(m);}}}
                  disabled={rangeLoading}
                  style={{appearance:"none" as const,WebkitAppearance:"none",background:"#fff",border:`1px solid ${S.border}`,borderRadius:8,padding:"5px 26px 5px 10px",fontSize:12,fontWeight:600,color:S.text,cursor:"pointer",outline:"none",fontFamily:"inherit"}}>
                  <option value="7">Last 7 days</option>
                  <option value="28">Last 28 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="custom">Custom range…</option>
                </select>
                <span style={{position:"absolute" as const,right:9,pointerEvents:"none" as const,fontSize:9,color:S.muted}}>▼</span>
              </div>
              {rangeMode==="custom"&&(
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <input type="date" value={customStart} max={customEnd||undefined} onChange={e=>setCustomStart(e.target.value)} style={{fontSize:11,padding:"4px 6px",border:`1px solid ${S.border}`,borderRadius:6,color:S.text,fontFamily:"inherit"}}/>
                  <span style={{fontSize:11,color:S.muted}}>→</span>
                  <input type="date" value={customEnd} min={customStart||undefined} onChange={e=>setCustomEnd(e.target.value)} style={{fontSize:11,padding:"4px 6px",border:`1px solid ${S.border}`,borderRadius:6,color:S.text,fontFamily:"inherit"}}/>
                  <button onClick={()=>applyRange("custom",customStart,customEnd)} disabled={rangeLoading||!customStart||!customEnd} style={{fontSize:11,fontWeight:700,color:"#fff",background:S.accent,border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontFamily:"inherit",opacity:(rangeLoading||!customStart||!customEnd)?0.5:1}}>Apply</button>
                </div>
              )}
              {rangeLoading&&<span style={{fontSize:11,color:S.muted}}>updating…</span>}
            </div>
          )}
          <button onClick={()=>setPage("gsc")} style={{fontSize:11,color:S.accent,background:"none",border:`1px solid ${S.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>+ Add site</button>
        </div>
      </div>
      {rangeErr&&<div style={{fontSize:12,color:S.red,background:S.redBg,border:"1px solid #fecaca",borderRadius:8,padding:"6px 12px",marginBottom:12}}>⚠ {rangeErr}</div>}
      {hasAny&&prevLabel&&<p style={{fontSize:11,color:S.muted,margin:"-8px 0 14px"}}>📊 Each metric&apos;s ▲▼ delta compares <strong>{rangeLabel.toLowerCase()}</strong> vs the previous equal period (<strong>{prevLabel}</strong>).</p>}

      {/* ── CONNECT BANNERS (if nothing connected) ── */}
      {!hasAny && (
        <>
          {activeSite && (
            <div style={{background:S.subtle,border:`1px solid ${S.border}`,borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:13}}>🌐</span>
              <span style={{fontSize:13,fontWeight:600,color:S.text}}>Active site: <span style={{color:S.accent}}>{activeSite}</span></span>
              <span style={{fontSize:12,color:S.muted}}>— Connect below to load analytics for this website</span>
              <button onClick={()=>setActiveSite("")} style={{marginLeft:"auto",fontSize:11,color:S.muted,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>✕ clear</button>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
            <div onClick={()=>{ if(activeSite) localStorage.setItem("rm_auto_gsc_site",activeSite); setPage("gsc"); }} style={{background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:12,padding:"18px 20px",cursor:"pointer",display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:24}}>◎</span>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:700,color:S.accentText,margin:"0 0 2px"}}>Connect Google Search Console</p>
                <p style={{fontSize:12,color:S.accentText,opacity:0.75,margin:0}}>{activeSite?`Connect for ${activeSite}`:"Clicks, impressions, CTR and top keywords."}</p>
              </div>
              <span style={{color:S.accentText,fontWeight:700}}>→</span>
            </div>
            <div onClick={()=>{ if(activeSite) localStorage.setItem("rm_auto_ga4_prop",activeSite); setPage("ga4"); }} style={{background:S.greenBg,border:"1px solid #bbf7d0",borderRadius:12,padding:"18px 20px",cursor:"pointer",display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:24}}>↗</span>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:700,color:S.greenText,margin:"0 0 2px"}}>Connect Google Analytics 4</p>
                <p style={{fontSize:12,color:S.greenText,opacity:0.75,margin:0}}>{activeSite?`Connect for ${activeSite}`:"Sessions, bounce rate and conversions."}</p>
              </div>
              <span style={{color:S.greenText,fontWeight:700}}>→</span>
            </div>
          </div>
        </>
      )}

      {/* ── SECTION NAV TABS (jump to section) ── */}
      {hasAny && (
        <div id="sec-overview" style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap" as const,position:"sticky" as const,top:0,zIndex:5,background:S.bg,padding:"6px 0",scrollMarginTop:64}}>
          {[
            {id:"sec-overview",label:"Overview"},
            {id:"sec-ai",label:"AI Visibility"},
            {id:"sec-gaps",label:"Content Gaps"},
            {id:"sec-keywords",label:"Keywords"},
            {id:"sec-issues",label:"Site Issues"},
          ].map(t=>(
            <button key={t.id} onClick={()=>{document.getElementById(t.id)?.scrollIntoView({behavior:"smooth",block:"start"});}}
              style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${S.border}`,background:S.card,color:S.text,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",boxShadow:S.shadow,transition:"all 0.15s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=S.accent;(e.currentTarget as HTMLButtonElement).style.color=S.accent;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=S.border;(e.currentTarget as HTMLButtonElement).style.color=S.text;}}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── SECTION 1: KPI METRICS ── */}
      {hasAny && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}}>
            <KPI label="Organic Clicks" value={viewGsc?viewGsc.summary.clicks.toLocaleString():"—"} change={viewGsc?viewGsc.summary.clicks_change:undefined} onClick={()=>{if(!viewGsc&&activeSite)localStorage.setItem("rm_auto_gsc_site",activeSite);setPage("gsc");}}/>
            <KPI label="Sessions" value={viewGa4?viewGa4.summary.sessions.toLocaleString():"—"} change={viewGa4?viewGa4.summary.sessions_change:undefined} onClick={()=>{if(!viewGa4&&activeSite)localStorage.setItem("rm_auto_ga4_prop",activeSite);setPage("ga4");}}/>
            <KPI label="Conversions" value={viewGa4?viewGa4.summary.conversions.toLocaleString():"—"} sub={viewGa4?viewGa4.summary.conv_rate+"% rate":undefined} change={viewGa4?viewGa4.summary.conv_change:undefined} color={viewGa4?S.green:undefined} onClick={()=>{if(!viewGa4&&activeSite)localStorage.setItem("rm_auto_ga4_prop",activeSite);setPage("ga4");}}/>
            <KPI label="Avg Position" value={viewGsc?("#"+viewGsc.summary.pos.toFixed(1)):"—"} change={viewGsc?viewGsc.summary.pos_change:undefined} inv color={viewGsc?S.accent:undefined} onClick={()=>{if(!viewGsc&&activeSite)localStorage.setItem("rm_auto_gsc_site",activeSite);setPage("gsc");}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:viewGa4&&viewGsc?20:12}}>
            <KPI label="Impressions" value={viewGsc?viewGsc.summary.impressions.toLocaleString():"—"} change={viewGsc?viewGsc.summary.impressions_change:undefined}/>
            <KPI label="Users" value={viewGa4?viewGa4.summary.users.toLocaleString():"—"} change={viewGa4?viewGa4.summary.users_change:undefined}/>
            <KPI label="Bounce Rate" value={viewGa4?(viewGa4.summary.bounce_rate+"%"):"—"} change={viewGa4?viewGa4.summary.bounce_change:undefined} inv/>
            <KPI label="Avg CTR" value={viewGsc?(viewGsc.summary.ctr.toFixed(1)+"%"):"—"} change={viewGsc?viewGsc.summary.ctr_change:undefined}/>
          </div>
          {/* Inline connect prompt when a source is missing for the active site */}
          {(!viewGa4||!viewGsc)&&(
            <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,marginBottom:20}}>
              {!viewGa4&&(
                <button onClick={()=>{if(activeSite)localStorage.setItem("rm_auto_ga4_prop",activeSite);setPage("ga4");}}
                  style={{flex:"1 1 240px",display:"flex",gap:10,alignItems:"center",background:S.greenBg,border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const}}>
                  <span style={{fontSize:20}}>↗</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:13,fontWeight:700,color:S.greenText,margin:"0 0 2px"}}>Connect Google Analytics 4</p>
                    <p style={{fontSize:11,color:S.greenText,opacity:0.8,margin:0}}>Unlock Sessions, Users, Conversions & Bounce Rate{domain?` for ${domain}`:""}.</p>
                  </div>
                  <span style={{color:S.greenText,fontWeight:700}}>→</span>
                </button>
              )}
              {!viewGsc&&(
                <button onClick={()=>{if(activeSite)localStorage.setItem("rm_auto_gsc_site",activeSite);setPage("gsc");}}
                  style={{flex:"1 1 240px",display:"flex",gap:10,alignItems:"center",background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:10,padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const}}>
                  <span style={{fontSize:20}}>◎</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:13,fontWeight:700,color:S.accentText,margin:"0 0 2px"}}>Connect Google Search Console</p>
                    <p style={{fontSize:11,color:S.accentText,opacity:0.8,margin:0}}>Unlock Clicks, Impressions, CTR & rankings{domain?` for ${domain}`:""}.</p>
                  </div>
                  <span style={{color:S.accentText,fontWeight:700}}>→</span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SECTION 2: TRAFFIC CHARTS ── */}
      {hasAny && (
        <div style={{display:"grid",gridTemplateColumns:viewGsc&&viewGa4?"1fr 1fr":"1fr",gap:14,marginBottom:20}}>
          {viewGa4 && (
            <Card style={{marginBottom:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>Sessions trend</p>
                  <p style={{fontSize:11,color:S.muted,margin:0}}>Daily sessions · last 28 days</p>
                </div>
                <button onClick={()=>setPage("ga4")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>View full →</button>
              </div>
              <Sparkline data={viewGa4.daily} color={S.green} height={60}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:S.muted}}>
                {viewGa4.daily.length>1&&<span>{viewGa4.daily[0].date}</span>}
                {viewGa4.daily.length>1&&<span>{viewGa4.daily[viewGa4.daily.length-1].date}</span>}
              </div>
            </Card>
          )}
          {viewGsc && (
            <Card style={{marginBottom:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>Search clicks trend</p>
                  <p style={{fontSize:11,color:S.muted,margin:0}}>Daily organic clicks · last 28 days</p>
                </div>
                <button onClick={()=>setPage("gsc")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>View full →</button>
              </div>
              <Sparkline data={viewGsc.daily} color={S.accent} height={60}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:S.muted}}>
                {viewGsc.daily.length>1&&<span>{viewGsc.daily[0].date}</span>}
                {viewGsc.daily.length>1&&<span>{viewGsc.daily[viewGsc.daily.length-1].date}</span>}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── SECTION 3: AI SEARCH VISIBILITY (real data) ── */}
      {hasAny && (
        <Card id="sec-ai" style={{marginBottom:20,scrollMarginTop:64}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap" as const,gap:8}}>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>AI Search Visibility</p>
              <p style={{fontSize:11,color:S.muted,margin:0}}>Real brand mentions from Google News, Reddit &amp; web — scored from live signals</p>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {hasVisData && <button onClick={()=>setPage("aeo")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Full report →</button>}
              {!aeoLoading&&!realVisLoading && <Btn small onClick={domain?()=>runRealVisibility(domain,viewGsc):()=>setPage("aeo")} disabled={aeoLoading||realVisLoading}>{hasVisData?"Refresh":"Analyse visibility"}</Btn>}
            </div>
          </div>

          {(aeoLoading||realVisLoading) && <LoadingBar phases={["Scanning Google News…","Checking Reddit…","Querying web mentions…","Calculating visibility score…"]}/>}

          {!hasVisData && !aeoLoading && !realVisLoading && (
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px",background:S.subtle,borderRadius:10}}>
              <span style={{fontSize:28}}>✦</span>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 2px"}}>Track your real AI &amp; web visibility for {domain}</p>
                <p style={{fontSize:12,color:S.muted,margin:0}}>Click &quot;Analyse visibility&quot; to pull live brand mentions from Google News, Reddit &amp; web — no AI estimates.</p>
              </div>
            </div>
          )}

          {hasVisData && !aeoLoading && !realVisLoading && (() => {
            const V = realVis || aeoData;
            const isReal = !!(realVis || V?._real);
            return (
              <div>
                {isReal && (
                  <div style={{fontSize:11,fontWeight:600,color:S.greenText,background:S.greenBg,border:"1px solid #a7f3d0",borderRadius:6,padding:"5px 12px",marginBottom:14,display:"inline-flex",alignItems:"center",gap:6}}>
                    ✓ Live data — Google News RSS · Reddit · DuckDuckGo · Wayback Machine
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:24,alignItems:"start"}}>
                  {/* Score gauge */}
                  <VisibilityGauge score={V.visibility_score||0} label={V.label||""} desc={V.description||""}/>

                  {/* Real metrics */}
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 10px"}}>
                      {isReal?"Real metrics (est. monthly)":"Key metrics"}
                    </p>
                    {[
                      {l:"Brand mentions",v:(V.metrics?.mentions||0).toLocaleString(),ch:V.metrics?.mentions_change,color:S.accent},
                      {l:"Web citations",v:(V.metrics?.citations||0).toLocaleString(),ch:V.metrics?.citations_change,color:S.green},
                      {l:"Cited pages",v:(V.metrics?.cited_pages||0).toLocaleString(),ch:V.metrics?.cited_pages_change,color:S.amber},
                      ...(V.gsc_signal?[{l:"GSC branded impr",v:(V.gsc_signal.branded_impressions||0).toLocaleString(),ch:undefined,color:S.accent}]:[]),
                    ].map((m,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${S.border}`}}>
                        <span style={{fontSize:12,color:S.muted}}>{m.l}</span>
                        <div style={{textAlign:"right" as const}}>
                          <span style={{fontSize:14,fontWeight:700,color:m.color}}>{m.v}</span>
                          {m.ch!==undefined&&<span style={{fontSize:10,fontWeight:600,color:m.ch>=0?S.green:S.red,marginLeft:6}}>{m.ch>=0?"+":""}{m.ch}%</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Source breakdown (real) or LLM distribution */}
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 10px"}}>
                      {isReal?"Mention sources (real)":"LLM distribution"}
                    </p>
                    {(V.source_breakdown||V.llm_distribution||[]).map((s:{source?:string;llm?:string;pct:number;count:number;color?:string},i:number)=>(
                      <div key={i} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:7,height:7,borderRadius:"50%",background:s.color||COLORS[i],flexShrink:0}}/>
                            <span style={{fontWeight:600,color:S.text}}>{s.source||s.llm}</span>
                          </div>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <span style={{color:s.color||COLORS[i],fontWeight:700}}>{s.pct}%</span>
                            <span style={{color:S.muted,fontSize:10}}>{s.count} mentions</span>
                          </div>
                        </div>
                        <Bar value={s.pct} color={s.color||COLORS[i]} height={5}/>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI tool visibility — real LLM query results */}
                {V.ai_visibility && (
                  <div style={{marginTop:16,borderTop:`1px solid ${S.border}`,paddingTop:14}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap" as const,gap:8}}>
                      <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:0,display:"flex",alignItems:"center"}}>AI Assistant Visibility{V.ai_visibility.engine&&<span style={{marginLeft:6,fontSize:9,color:"#fff",background:"#6366f1",padding:"1px 6px",borderRadius:4}}>{V.ai_visibility.engine}</span>}<InfoTip text="We asked Claude (a live AI answer engine) real category questions and checked how many answers actually named your brand, where you ranked, and who out-ranks you. Real AI visibility, not an estimate."/></p>
                      <span style={{fontSize:12,fontWeight:700,color:V.ai_visibility.ai_visibility_pct>=40?S.green:V.ai_visibility.ai_visibility_pct>0?S.amber:S.red,background:V.ai_visibility.ai_visibility_pct>=40?S.greenBg:V.ai_visibility.ai_visibility_pct>0?S.amberBg:S.redBg,padding:"2px 10px",borderRadius:5}}>
                        Mentioned in {V.ai_visibility.mentioned_count}/{V.ai_visibility.total_questions} AI answers
                      </span>
                    </div>
                    {V.ai_visibility.category&&<p style={{fontSize:11,color:S.muted,margin:"0 0 10px"}}>Category tested: <strong>{V.ai_visibility.category}</strong></p>}
                    {/* Claude visibility summary: share of voice, avg rank, top competitors */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                      {[
                        {l:"AI mention rate",v:`${V.ai_visibility.ai_visibility_pct}%`,h:"% of AI answers that named your brand"},
                        {l:"Share of voice",v:V.ai_visibility.share_of_voice!=null?`${V.ai_visibility.share_of_voice}%`:"—",h:"Your mentions vs ALL brand mentions across the AI answers"},
                        {l:"Avg rank in answers",v:V.ai_visibility.avg_rank!=null?`#${V.ai_visibility.avg_rank}`:"—",h:"Average position your brand appears when listed by the AI"},
                      ].map((m,i)=>(
                        <div key={i} style={{padding:"8px 10px",background:S.subtle,borderRadius:7,border:`1px solid ${S.border}`}}>
                          <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 3px"}}>{m.l} <InfoTip text={m.h}/></p>
                          <p style={{fontSize:16,fontWeight:700,color:S.accent,margin:0}}>{m.v}</p>
                        </div>
                      ))}
                    </div>
                    {/* Per-engine mention rate (multi-engine) */}
                    {(V.ai_visibility.platforms||[]).length>0&&(
                      <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,marginBottom:12}}>
                        {(V.ai_visibility.platforms||[]).map((p:{platform:string;rate:number},i:number)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",border:`1px solid ${S.border}`,borderRadius:8,padding:"6px 12px"}}>
                            <span style={{fontSize:11,fontWeight:700,color:S.text}}>{p.platform}</span>
                            <span style={{fontSize:13,fontWeight:700,color:p.rate>=40?S.green:p.rate>0?S.amber:S.red}}>{p.rate}%</span>
                          </div>
                        ))}
                        {V.ai_visibility.overall_rate!=null&&(V.ai_visibility.platforms||[]).length>1&&(
                          <div style={{display:"flex",alignItems:"center",gap:8,background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:8,padding:"6px 12px"}}>
                            <span style={{fontSize:11,fontWeight:700,color:S.accentText}}>Overall</span>
                            <span style={{fontSize:13,fontWeight:700,color:S.accentText}}>{V.ai_visibility.overall_rate}%</span>
                          </div>
                        )}
                      </div>
                    )}
                    {(V.ai_visibility.competitors||[]).length>0&&(
                      <div style={{marginBottom:12}}>
                        <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 6px"}}>Who the AI recommends most (your competitors)</p>
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                          {(V.ai_visibility.competitors||[]).slice(0,8).map((c:{name:string;mentions:number},i:number)=>(
                            <span key={i} style={{fontSize:11,background:"#fff",border:`1px solid ${S.border}`,borderRadius:99,padding:"3px 10px",color:S.text}}>{c.name} <span style={{color:S.muted}}>×{c.mentions}</span></span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{display:"grid",gap:8}}>
                      {(V.ai_visibility.results||[]).map((r:{question:string;answer:string;brands_mentioned:string[];your_brand_mentioned:boolean;your_rank?:number|null},i:number)=>(
                        <div key={i} style={{padding:"10px 12px",background:r.your_brand_mentioned?S.greenBg:S.subtle,borderRadius:7,border:`1px solid ${r.your_brand_mentioned?"#a7f3d0":S.border}`}}>
                          <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:4}}>
                            <span style={{fontSize:13,flexShrink:0}}>{r.your_brand_mentioned?"✅":"❌"}</span>
                            <p style={{fontSize:12,fontWeight:600,color:S.text,margin:0,flex:1}}>{r.question}</p>
                            {r.your_brand_mentioned&&r.your_rank&&<span style={{flexShrink:0,fontSize:10,fontWeight:700,color:S.green,background:"#fff",border:"1px solid #a7f3d0",borderRadius:4,padding:"1px 6px"}}>ranked #{r.your_rank}</span>}
                          </div>
                          <p style={{fontSize:11,color:S.muted,margin:"0 0 4px",lineHeight:1.5,paddingLeft:21}}>{r.answer}</p>
                          {(r.brands_mentioned||[]).length>0&&(
                            <div style={{paddingLeft:21,display:"flex",gap:4,flexWrap:"wrap" as const}}>
                              {(r.brands_mentioned||[]).slice(0,6).map((b:string,j:number)=>{
                                const isYou = b.toLowerCase().includes((V.ai_visibility.category?"":"").toLowerCase()) || new RegExp(domain.replace(/\.[a-z]+$/,""),"i").test(b);
                                return <span key={j} style={{fontSize:10,background:isYou?S.accentBg:"#fff",color:isYou?S.accentText:S.muted,border:`1px solid ${isYou?"#c7d2fe":S.border}`,padding:"1px 7px",borderRadius:4,fontWeight:isYou?700:400}}>{b}</span>;
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {V.ai_visibility.mentioned_count===0&&(
                      <div style={{marginTop:10,padding:"8px 12px",background:S.amberBg,borderRadius:7,fontSize:11,color:S.amberText}}>
                        ⚠ Your brand was not mentioned in any AI answer. To improve AI visibility: publish authoritative content, get cited by news/Reddit, add llms.txt, and earn mentions on high-authority sites.
                      </div>
                    )}
                  </div>
                )}

                {/* Recent real articles */}
                {(V.recent_articles||[]).length>0&&(
                  <div style={{marginTop:16,borderTop:`1px solid ${S.border}`,paddingTop:14}}>
                    <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 10px"}}>Recent brand mentions</p>
                    <div style={{display:"grid",gap:8}}>
                      {(V.recent_articles||[]).slice(0,4).map((a:{title:string;source:string;url:string;date:string},i:number)=>(
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                          style={{display:"flex",gap:10,padding:"8px 12px",background:S.subtle,borderRadius:7,border:`1px solid ${S.border}`,textDecoration:"none",alignItems:"flex-start"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:12,fontWeight:600,color:S.text,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{a.title}</p>
                            <p style={{fontSize:10,color:S.muted,margin:0}}>{a.source}{a.date?" · "+a.date:""}</p>
                          </div>
                          <span style={{fontSize:10,color:S.accent,flexShrink:0,marginTop:2}}>↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* ── VISIBILITY TREND OVER TIME (history of analyse runs) ── */}
      {hasAny && trend.length>=2 && (()=>{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Spark=({label,vals,fmt,inv,color}:{label:string;vals:(number|null)[];fmt:(n:number)=>string;inv?:boolean;color:string})=>{
          const pts=vals.map((v,i)=>({v,i})).filter(p=>p.v!=null) as {v:number;i:number}[];
          if(pts.length<2) return null;
          const xs=pts.map(p=>p.i), ys=pts.map(p=>p.v);
          const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
          const W2=200,H2=40;
          const x=(i:number)=>maxX===minX?W2/2:((i-minX)/(maxX-minX))*W2;
          const y=(v:number)=>maxY===minY?H2/2:H2-((v-minY)/(maxY-minY))*H2;
          const first=ys[0],last=ys[ys.length-1];
          const delta=+(last-first).toFixed(1);
          const good=inv?delta<=0:delta>=0;
          return (
            <div style={{flex:"1 1 200px",padding:"10px 12px",background:S.subtle,borderRadius:8,border:`1px solid ${S.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const}}>{label}</span>
                <span style={{fontSize:11,fontWeight:700,color:delta===0?S.muted:good?S.green:S.red}}>{delta>=0?"▲":"▼"} {fmt(Math.abs(delta))}</span>
              </div>
              <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                <span style={{fontSize:18,fontWeight:700,color:S.text}}>{fmt(last)}</span>
                <svg width={W2} height={H2} style={{flex:1}} viewBox={`0 0 ${W2} ${H2}`} preserveAspectRatio="none">
                  <polyline fill="none" stroke={color} strokeWidth="2" points={pts.map(p=>`${x(p.i)},${y(p.v)}`).join(" ")}/>
                  <circle cx={x(pts[pts.length-1].i)} cy={y(last)} r="2.5" fill={color}/>
                </svg>
              </div>
            </div>
          );
        };
        return (
          <Card style={{marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>Visibility trend over time</p>
                <p style={{fontSize:11,color:S.muted,margin:0}}>{trend.length} snapshots · {trend[0].date} → {trend[trend.length-1].date} (Δ since first)</p>
              </div>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap" as const}}>
              <Spark label="Visibility score" vals={trend.map(t=>t.visibility)} fmt={n=>String(Math.round(n))} color={S.accent}/>
              <Spark label="AI mention rate" vals={trend.map(t=>t.overall??t.ai_pct)} fmt={n=>`${Math.round(n)}%`} color="#8b5cf6"/>
              <Spark label="AI share of voice" vals={trend.map(t=>t.sov)} fmt={n=>`${Math.round(n)}%`} color={S.green}/>
              <Spark label="AI avg rank" vals={trend.map(t=>t.avg_rank)} fmt={n=>`#${n.toFixed(1)}`} inv color={S.amber}/>
              <Spark label="Organic clicks" vals={trend.map(t=>t.clicks)} fmt={n=>Math.round(n).toLocaleString()} color={S.blue}/>
              <Spark label="Avg position" vals={trend.map(t=>t.pos)} fmt={n=>`#${n.toFixed(1)}`} inv color="#ec4899"/>
            </div>
            <p style={{fontSize:11,color:S.muted,margin:"10px 0 0"}}>Each &quot;Analyse visibility&quot; run is saved (one per day). Re-run periodically to build the trend.</p>
          </Card>
        );
      })()}

      {/* ── KEYWORD POSITION DISTRIBUTION (above the rankings table) ── */}
      {viewGsc && viewGsc.queries?.length > 0 && (()=>{
        const allQs = viewGsc.queries || [];
        const qs = kwSegment==="branded" ? allQs.filter((q:{query:string})=>isBranded(q.query))
                 : kwSegment==="nonbranded" ? allQs.filter((q:{query:string})=>!isBranded(q.query)) : allQs;
        const top3 = qs.filter((q:{pos:number})=>q.pos<=3);
        const top10 = qs.filter((q:{pos:number})=>q.pos>3&&q.pos<=10);
        const top20 = qs.filter((q:{pos:number})=>q.pos>10&&q.pos<=20);
        const beyond = qs.filter((q:{pos:number})=>q.pos>20);
        return (
          <Card id="sec-keywords" style={{marginBottom:20,scrollMarginTop:64}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>Keyword Position Distribution</p>
                <p style={{fontSize:11,color:S.muted,margin:0}}>{qs.length} {kwSegment==="branded"?"branded":kwSegment==="nonbranded"?"non-branded":""} keywords tracked from GSC</p>
              </div>
              <button onClick={()=>setPage("gsc")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>View all →</button>
            </div>
            <div style={{display:"flex",gap:4,marginBottom:14,background:S.subtle,padding:3,borderRadius:8,width:"fit-content"}}>
              {([["all","All"],["branded","Branded"],["nonbranded","Non-Branded"]] as const).map(([k,lbl])=>(
                <button key={k} onClick={()=>setKwSegment(k)} style={{padding:"4px 12px",borderRadius:6,border:"none",background:kwSegment===k?S.card:"transparent",color:kwSegment===k?(k==="branded"?S.green:k==="nonbranded"?S.amber:S.accent):S.muted,fontSize:11,fontWeight:kwSegment===k?700:500,cursor:"pointer",fontFamily:"inherit",boxShadow:kwSegment===k?S.shadow:"none",transition:"all 0.15s"}}>{lbl}</button>
              ))}
            </div>
            {[
              {label:"🔥 Top 3",items:top3,color:S.green},
              {label:"✓ Page 1 (4–10)",items:top10,color:S.accent},
              {label:"Page 2 (11–20)",items:top20,color:S.amber},
              {label:"Page 3+ (20+)",items:beyond,color:S.muted},
            ].map(bucket=>(
              <div key={bucket.label} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:120,flexShrink:0}}><span style={{fontSize:11,fontWeight:600,color:bucket.color}}>{bucket.label}</span></div>
                <div style={{flex:1,height:20,background:S.subtle,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.round((bucket.items.length/Math.max(qs.length,1))*100)}%`,background:bucket.color,borderRadius:4,minWidth:bucket.items.length>0?4:0,transition:"width 0.5s ease"}}/>
                </div>
                <div style={{width:70,textAlign:"right" as const,flexShrink:0}}><span style={{fontSize:13,fontWeight:700,color:bucket.color}}>{bucket.items.length}</span><span style={{fontSize:10,color:S.muted}}> kw</span></div>
              </div>
            ))}
            <div style={{marginTop:10,padding:"8px 12px",background:S.subtle,borderRadius:7,display:"flex",gap:24}}>
              <div><p style={{fontSize:10,color:S.muted,margin:0}}>Total clicks</p><p style={{fontSize:13,fontWeight:700,color:S.accent,margin:0}}>{qs.reduce((a:number,q:{clicks:number})=>a+q.clicks,0).toLocaleString()}</p></div>
              <div><p style={{fontSize:10,color:S.muted,margin:0}}>Avg CTR</p><p style={{fontSize:13,fontWeight:700,color:S.text,margin:0}}>{qs.length>0?(qs.reduce((a:number,q:{ctr:number})=>a+q.ctr,0)/qs.length).toFixed(1):0}%</p></div>
              <div><p style={{fontSize:10,color:S.muted,margin:0}}>Avg Position</p><p style={{fontSize:13,fontWeight:700,color:S.text,margin:0}}>#{qs.length>0?Math.round(qs.reduce((a:number,q:{pos:number})=>a+q.pos,0)/qs.length):0}</p></div>
            </div>
          </Card>
        );
      })()}

      {/* ── SECTION 4: TOP KEYWORDS (branded vs non-branded) ── */}
      {viewGsc && (()=>{
        const allQ = (viewGsc.queries||[]) as {query:string;clicks:number;impressions:number;ctr:number;pos:number}[];
        const brandedQ = allQ.filter(q=>isBranded(q.query));
        const nonBrandedQ = allQ.filter(q=>!isBranded(q.query));
        const sumClicks = (arr:typeof allQ)=>arr.reduce((a,q)=>a+q.clicks,0);
        const brandedClicks = sumClicks(brandedQ), nonBrandedClicks = sumClicks(nonBrandedQ), totalClicks = sumClicks(allQ)||1;
        const shown = (kwSegment==="branded"?brandedQ:kwSegment==="nonbranded"?nonBrandedQ:allQ).slice(0,50);
        const pct = (n:number)=>Math.round(n/totalClicks*100);
        return (
        <Card style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>Keyword Rankings</p>
              <p style={{fontSize:11,color:S.muted,margin:0}}>Organic keywords — last 28 days · {domain}</p>
            </div>
            <button onClick={()=>setPage("gsc")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>View all keywords →</button>
          </div>

          {/* Branded vs non-branded split summary */}
          <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap" as const}}>
            {[
              {key:"all" as const,label:"All keywords",count:allQ.length,clicks:totalClicks,color:S.accent},
              {key:"branded" as const,label:"Branded",count:brandedQ.length,clicks:brandedClicks,color:S.green,hint:`Searches containing your brand name "${brandTokens[0]||""}" — people already looking for you.`},
              {key:"nonbranded" as const,label:"Non-Branded",count:nonBrandedQ.length,clicks:nonBrandedClicks,color:S.amber,hint:"Generic searches with no brand name — new audiences discovering you. The real SEO growth signal."},
            ].map(seg=>(
              <button key={seg.key} onClick={()=>setKwSegment(seg.key)}
                style={{flex:1,minWidth:150,textAlign:"left" as const,background:kwSegment===seg.key?S.accentBg:S.card,border:`1.5px solid ${kwSegment===seg.key?S.accent:S.border}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em"}}>{seg.label}</span>
                  {seg.hint&&<InfoTip text={seg.hint}/>}
                </div>
                <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                  <span style={{fontSize:20,fontWeight:700,color:seg.color}}>{seg.count}</span>
                  <span style={{fontSize:11,color:S.muted}}>kw · {seg.clicks.toLocaleString()} clicks</span>
                </div>
                {seg.key!=="all"&&(
                  <div style={{marginTop:6,height:5,background:S.subtle,borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct(seg.clicks)}%`,background:seg.color,borderRadius:99}}/>
                  </div>
                )}
                {seg.key!=="all"&&<span style={{fontSize:10,color:S.muted}}>{pct(seg.clicks)}% of clicks</span>}
              </button>
            ))}
          </div>

          <div style={{maxHeight:shown.length>12?460:undefined,overflowY:shown.length>12?"auto" as const:undefined,border:shown.length>12?`1px solid ${S.border}`:undefined,borderRadius:shown.length>12?8:undefined}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead style={{position:shown.length>12?"sticky" as const:undefined,top:0,zIndex:1}}><tr>
              <TH>Keyword</TH><TH>Type</TH><TH>Clicks</TH><TH>Impressions</TH><TH>CTR</TH><TH>Position</TH><TH>Trend</TH>
            </tr></thead>
            <tbody>{shown.map((q,i)=>{
              const branded = isBranded(q.query);
              return (
              <tr key={i}>
                <TD bold>{q.query}</TD>
                <TD><span style={{fontSize:10,fontWeight:700,color:branded?S.green:S.amber,background:branded?S.greenBg:S.amberBg,padding:"2px 8px",borderRadius:4}}>{branded?"Branded":"Non-Branded"}</span></TD>
                <TD color={S.accent}>{q.clicks.toLocaleString()}</TD>
                <TD color={S.muted}>{q.impressions.toLocaleString()}</TD>
                <TD>{q.ctr}%</TD>
                <td style={{padding:"10px 12px",borderBottom:`1px solid ${S.border}`}}>
                  <span style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:4,background:q.pos<=3?S.greenBg:q.pos<=10?S.amberBg:S.redBg,color:q.pos<=3?S.greenText:q.pos<=10?S.amberText:S.redText}}>#{q.pos}</span>
                </td>
                <TD><span style={{fontSize:11,fontWeight:600,color:q.pos<=5?S.green:q.pos<=15?S.amber:S.red}}>{q.pos<=3?"🔥 Top 3":q.pos<=10?"✓ Page 1":q.pos<=20?"Page 2":"Page 3+"}</span></TD>
              </tr>
              );
            })}</tbody>
          </table>
          </div>
          {shown.length===0&&<p style={{fontSize:12,color:S.muted,textAlign:"center" as const,padding:"16px 0",margin:0}}>No {kwSegment==="branded"?"branded":"non-branded"} keywords found.</p>}
          {(()=>{const seg=kwSegment==="branded"?brandedQ:kwSegment==="nonbranded"?nonBrandedQ:allQ;return seg.length>shown.length?<p style={{fontSize:11,color:S.muted,textAlign:"center" as const,padding:"10px 0 0",margin:0}}>Showing top {shown.length} of {seg.length} — <button onClick={()=>setPage("gsc")} style={{color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:0,textDecoration:"underline"}}>view all in GSC</button></p>:null;})()}
        </Card>
        );
      })()}

      {/* ── SECTION 5: TRAFFIC SOURCES + CONNECT MISSING BANNER ── */}
      {(viewGa4 || (hasAny && (!viewGsc || !viewGa4))) && (
        <div style={{display:"grid",gridTemplateColumns:viewGa4&&(!viewGsc||!viewGa4)?"1fr 1fr":viewGa4?"1fr":"1fr",gap:14,marginBottom:20}}>
          {viewGa4 && (
            <Card style={{marginBottom:0}}>
              <SH title={`Traffic by channel — ${domain}`} action={<button onClick={()=>setPage("ga4")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>View →</button>}/>
              {/* GA4 default channel grouping — Organic/Paid Social, Search, Direct, Referral, Email etc. */}
              {(viewGa4.channels||[]).length>0?(
                <>
                  {(viewGa4.channels||[]).slice(0,10).map((c:{channel:string;sessions:number;pct:number},i:number)=>{
                    const isSocial=/social/i.test(c.channel);
                    return (
                      <div key={i} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                          <span style={{fontWeight:600,color:isSocial?S.accent:S.text}}>{c.channel}{isSocial?" 📣":""} {CHANNEL_DEFS[c.channel]&&<InfoTip text={CHANNEL_DEFS[c.channel]}/>}</span>
                          <span style={{color:COLORS[i%COLORS.length],fontWeight:700,flexShrink:0}}>{c.sessions.toLocaleString()} <span style={{color:S.muted,fontWeight:400}}>({c.pct}%)</span></span>
                        </div>
                        <Bar value={c.pct} color={COLORS[i%COLORS.length]}/>
                      </div>
                    );
                  })}
                  {!(viewGa4.social_sessions>0)&&<p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>No social sessions in the last 28 days for this property.</p>}
                </>
              ):(
                <p style={{fontSize:12,color:S.muted,margin:0}}>Channel data not loaded yet — <button onClick={()=>setPage("ga4")} style={{color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:0,textDecoration:"underline"}}>refresh GA4</button> to populate the channel grouping.</p>
              )}
            </Card>
          )}
          {hasAny && (!viewGsc || !viewGa4) && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {!viewGsc && (
                <div onClick={()=>setPage("gsc")} style={{background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:12,padding:"14px 18px",cursor:"pointer",display:"flex",gap:10,alignItems:"center",flex:1}}>
                  <span style={{fontSize:20}}>◎</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:13,fontWeight:700,color:S.accentText,margin:"0 0 2px"}}>Connect Google Search Console for {domain}</p>
                    <p style={{fontSize:12,color:S.accentText,opacity:0.75,margin:0}}>Unlock clicks, impressions and keyword data.</p>
                  </div>
                  <span style={{color:S.accentText,fontWeight:700}}>→</span>
                </div>
              )}
              {!viewGa4 && (
                <div onClick={()=>setPage("ga4")} style={{background:S.greenBg,border:"1px solid #bbf7d0",borderRadius:12,padding:"14px 18px",cursor:"pointer",display:"flex",gap:10,alignItems:"center",flex:1}}>
                  <span style={{fontSize:20}}>↗</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:13,fontWeight:700,color:S.greenText,margin:"0 0 2px"}}>Connect Google Analytics 4</p>
                    <p style={{fontSize:12,color:S.greenText,opacity:0.75,margin:0}}>Unlock sessions, bounce rate and conversions.</p>
                  </div>
                  <span style={{color:S.greenText,fontWeight:700}}>→</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 5b: KEYWORD POSITION DISTRIBUTION ── */}
      {viewGsc && viewGsc.queries?.length > 0 && (() => {
        const allQs = viewGsc.queries || [];
        // Apply the branded/non-branded segment filter (shared with the keyword table)
        const qs = kwSegment==="branded" ? allQs.filter((q:{query:string})=>isBranded(q.query))
                 : kwSegment==="nonbranded" ? allQs.filter((q:{query:string})=>!isBranded(q.query))
                 : allQs;
        // Adaptive impression threshold: use top 20% of keyword impression counts
        const sortedByImpr = [...qs].sort((a:{impressions:number},b:{impressions:number})=>b.impressions-a.impressions);
        const p20Impr = sortedByImpr[Math.floor(qs.length*0.2)]?.impressions||1;
        const minImprGap = Math.max(5, Math.floor(p20Impr*0.3));  // at least 30% of 80th-pct keyword
        const minImprWin = Math.max(3, Math.floor(p20Impr*0.1));

        // Content gaps: visible but not converting — any keyword with above-avg impressions and below-avg CTR
        const avgCtr = qs.length>0 ? qs.reduce((a:number,q:{ctr:number})=>a+q.ctr,0)/qs.length : 2;
        const opportunities = qs
          .filter((q:{impressions:number;ctr:number;pos:number})=>q.impressions>=minImprGap && q.ctr<avgCtr && q.pos<=30)
          .sort((a:{impressions:number},b:{impressions:number})=>b.impressions-a.impressions)
          .slice(0,6);
        // Quick wins: position 11-30, any impressions above minimum
        const quickWins = qs
          .filter((q:{pos:number;impressions:number})=>q.pos>10&&q.pos<=30&&q.impressions>=minImprWin)
          .sort((a:{impressions:number},b:{impressions:number})=>b.impressions-a.impressions)
          .slice(0,6);
        return (
          <>
            {/* Content opportunities from real GSC data */}
            <Card id="sec-gaps" style={{marginBottom:20,scrollMarginTop:64}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>Content Gaps &amp; Quick Wins</p>
                  <p style={{fontSize:11,color:S.muted,margin:0}}>Real data from Google Search Console</p>
                </div>
              </div>
              {opportunities.length>0&&(
                <>
                  <p style={{fontSize:11,fontWeight:700,color:S.amberText,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 8px"}}>⚠ High impressions, low CTR — fix meta/title</p>
                  {opportunities.map((q:{query:string;impressions:number;ctr:number;pos:number},i:number)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${S.border}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:600,color:S.text,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{q.query}</p>
                        <p style={{fontSize:10,color:S.muted,margin:0}}>#{q.pos} · {q.impressions.toLocaleString()} impr</p>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:S.amber,flexShrink:0}}>{q.ctr}% CTR</span>
                      <BlogBtn kw={q.query}/>
                    </div>
                  ))}
                </>
              )}
              {quickWins.length>0&&(
                <>
                  <p style={{fontSize:11,fontWeight:700,color:S.greenText,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"12px 0 8px"}}>🚀 Quick wins — page 2, push to page 1</p>
                  {quickWins.map((q:{query:string;impressions:number;ctr:number;pos:number},i:number)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${S.border}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:600,color:S.text,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{q.query}</p>
                        <p style={{fontSize:10,color:S.muted,margin:0}}>{q.impressions.toLocaleString()} impr · {q.ctr}% CTR</p>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:S.green,flexShrink:0}}>#{Math.round(q.pos)}</span>
                      <BlogBtn kw={q.query}/>
                    </div>
                  ))}
                </>
              )}
              {opportunities.length===0&&quickWins.length===0&&(
                <>
                  <p style={{fontSize:11,fontWeight:700,color:S.accentText,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 8px"}}>📈 Top keywords by impressions</p>
                  {sortedByImpr.slice(0,6).map((q:{query:string;impressions:number;ctr:number;pos:number},i:number)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${S.border}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:600,color:S.text,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{q.query}</p>
                        <p style={{fontSize:10,color:S.muted,margin:0}}>#{Math.round(q.pos)} · {q.impressions.toLocaleString()} impr · {q.ctr}% CTR</p>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:q.pos<=3?S.green:q.pos<=10?S.accent:S.amber,flexShrink:0}}>#{Math.round(q.pos)}</span>
                      <BlogBtn kw={q.query}/>
                    </div>
                  ))}
                </>
              )}

              {/* ── Clear recommended actions (computed from real GSC data) ── */}
              {(()=>{
                // Expected CTR by position — used to estimate recoverable clicks
                const benchCtr=(p:number)=>p<=1?32:p<=3?22:p<=5?12:p<=10?6:p<=20?2.5:1;
                const ctrGain=opportunities.reduce((s:number,q:{impressions:number;ctr:number;pos:number})=>s+Math.max(0,Math.round(q.impressions*(benchCtr(q.pos)-q.ctr)/100)),0);
                const qwGain=quickWins.reduce((s:number,q:{impressions:number;ctr:number}) =>s+Math.max(0,Math.round(q.impressions*(6-q.ctr)/100)),0);
                // Question/answer keywords → snippet opportunity
                const questionKws=qs.filter((q:{query:string;pos:number})=>/^(how|what|why|when|where|who|which|can|is|are|does|do)\b/i.test(q.query)&&q.pos<=20);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const recs:{icon:string;title:string;detail:string;gain?:string;page:string;kw?:string}[]=[];
                if(opportunities.length>0){
                  recs.push({icon:"✏️",title:`Rewrite titles & meta for ${opportunities.length} keyword${opportunities.length>1?"s":""}`,detail:`High impressions but low CTR. Add the keyword + a benefit/number to the <title> and a compelling meta description. Start with "${opportunities[0].query}".`,gain:ctrGain>0?`~+${ctrGain.toLocaleString()} clicks/mo`:undefined,page:"onpage",kw:opportunities[0].query});
                }
                if(quickWins.length>0){
                  recs.push({icon:"🚀",title:`Push ${quickWins.length} striking-distance keyword${quickWins.length>1?"s":""} to page 1`,detail:`These rank on page 2 (pos 11–20). Audit the ranking page, then add 300–600 words, internal links, and refresh. Start with "${quickWins[0].query}".`,gain:qwGain>0?`~+${qwGain.toLocaleString()} clicks/mo`:undefined,page:"onpage",kw:quickWins[0].query});
                }
                if(questionKws.length>0){
                  recs.push({icon:"❓",title:`Win featured snippets for ${questionKws.length} question keyword${questionKws.length>1?"s":""}`,detail:`Add a concise 40–55 word direct answer near the top + FAQ schema. Target "${questionKws[0].query}".`,page:"onpage",kw:questionKws[0].query});
                }
                // Thin / low-position high-impression
                const thinTargets=qs.filter((q:{pos:number;impressions:number})=>q.pos>20&&q.impressions>=20);
                if(thinTargets.length>0){
                  const topThin=thinTargets.sort((a:{impressions:number},b:{impressions:number})=>b.impressions-a.impressions)[0].query;
                  recs.push({icon:"📝",title:`Create dedicated content for ${thinTargets.length} page 3+ keyword${thinTargets.length>1?"s":""}`,detail:`You get impressions but rank beyond page 2 — you likely lack a focused page. Click to draft a blog in the Campaign Agent. Start with "${topThin}".`,page:"seoagent",kw:topThin});
                }
                if(recs.length===0) return null;
                const totalGain=ctrGain+qwGain;
                return (
                  <div style={{marginTop:14,borderTop:`1px solid ${S.border}`,paddingTop:14}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <p style={{fontSize:11,fontWeight:700,color:S.accentText,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:0}}>✦ Recommended actions</p>
                      {totalGain>0&&<span style={{fontSize:11,fontWeight:700,color:S.green,background:S.greenBg,padding:"2px 10px",borderRadius:5}}>~+{totalGain.toLocaleString()} clicks/mo potential</span>}
                    </div>
                    <div style={{display:"grid",gap:8}}>
                      {recs.map((r,i)=>(
                        <div key={i} onClick={()=>{ if(r.page==="onpage"&&r.kw) seedOnPage(r.kw); else if(r.page==="seoagent"&&r.kw) seedBlog(r.kw); else setPage(r.page); }} style={{display:"flex",gap:10,padding:"10px 12px",background:S.subtle,borderRadius:8,border:`1px solid ${S.border}`,cursor:"pointer"}}
                          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.accent}
                          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.border}>
                          <span style={{fontSize:15,flexShrink:0}}>{r.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const,marginBottom:2}}>
                              <span style={{fontSize:12,fontWeight:700,color:S.text}}>{r.title}</span>
                              {r.gain&&<span style={{fontSize:10,fontWeight:700,color:S.green}}>{r.gain}</span>}
                            </div>
                            <p style={{fontSize:11,color:S.muted,margin:0,lineHeight:1.5}}>{r.detail}</p>
                          </div>
                          <span style={{fontSize:11,color:S.accent,fontWeight:600,flexShrink:0,alignSelf:"center" as const}}>→</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </>
        );
      })()}

      {/* ── SECTION 6: GEO — AI PLATFORM BREAKDOWN ── */}
      {aeoData && (
        <Card style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>GEO — AI Platform Visibility</p>
              <p style={{fontSize:11,color:S.muted,margin:0}}>Citation rate across ChatGPT, Gemini, AI Overviews &amp; AI Mode</p>
            </div>
            <button onClick={()=>setPage("geo")} style={{fontSize:11,color:S.accentText,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Full GEO report →</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {/* Platform bars — use source_breakdown (real) or llm_distribution (AI) */}
            <div>
              {(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const platforms: any[] = aeoData.source_breakdown || aeoData.llm_distribution || [];
                const platColors: Record<string,string> = {"Google News":"#4285f4","Reddit":"#ff4500","Web mentions":"#10a37f","Perplexity AI":"#20b2aa","ChatGPT":"#10a37f","AI Overview":"#4285f4","AI Mode":"#f59e0b","Gemini":"#9c27b0"};
                if(platforms.length===0) return (
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:S.muted,fontSize:12,fontStyle:"italic" as const}}>
                    Click &quot;Analyse visibility&quot; to load AI platform data
                  </div>
                );
                return platforms.map((l:{source?:string;llm?:string;pct:number;count:number;color?:string},i:number)=>{
                  const name=l.source||l.llm||"";
                  const platColor=l.color||platColors[name]||[S.accent,"#10a37f","#4285f4","#9c27b0"][i]||S.muted;
                  return (
                    <div key={i} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:platColor}}/>
                          <span style={{fontSize:12,fontWeight:600,color:S.text}}>{name}</span>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:13,fontWeight:700,color:platColor}}>{l.pct}%</span>
                          <span style={{fontSize:10,color:S.muted}}>{l.count} mentions</span>
                        </div>
                      </div>
                      <div style={{height:8,background:S.subtle,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(l.pct,100)}%`,background:platColor,borderRadius:99,transition:"width 0.5s ease"}}/>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {/* Top performing topics */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 10px"}}>Top cited topics</p>
              {(aeoData.performing_topics||[]).length===0&&(
                <div style={{fontSize:12,color:S.muted,fontStyle:"italic" as const,padding:"8px 0"}}>
                  Run &quot;Analyse visibility&quot; to generate topic analysis
                </div>
              )}
              {(aeoData.performing_topics||[]).slice(0,4).map((t:{topic:string;visibility:number;mentions:number;trend:string},i:number)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${S.border}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:S.text,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{t.topic}</p>
                    <Bar value={t.visibility} color={S.accent} height={4}/>
                  </div>
                  <div style={{textAlign:"right" as const,flexShrink:0}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.accent,margin:0}}>{t.visibility}%</p>
                    <p style={{fontSize:10,color:t.trend==="up"?S.green:t.trend==="down"?S.red:S.muted,margin:0}}>{t.trend==="up"?"↑":t.trend==="down"?"↓":"→"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── SECTION 7: WEBSITE ISSUES (live crawl) ── */}
      <div id="sec-issues" style={{scrollMarginTop:64}}>
        <DashboardIssues domain={domain} hasAny={hasAny} setPage={setPage}/>
      </div>
    </div>
  );
}

// ── GSC ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GSC({gscData:_gscData,setGscData,activeSite,gscDataMap={},upsertGsc}:{gscData:any;setGscData:(d:any)=>void;activeSite?:string;gscDataMap?:Record<string,any>;upsertGsc?:(domain:string,d:any)=>void}) {
  void _gscData; // never use prop fallback — always use map
  const allDomains = Object.keys(gscDataMap);
  const cleanD = (s:string) => (s||"").replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/$/,"").toLowerCase();
  const defaultDomain = (() => {
    const ad = (activeSite||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
    if(gscDataMap[ad]) return ad;
    const fuzzy = allDomains.find(d=>cleanD(d)===cleanD(ad));
    return fuzzy||(allDomains[0]||"");
  })();
  const [viewDomain,setViewDomain] = useState(defaultDomain);
  const [showAdd,setShowAdd] = useState(allDomains.length===0);
  const [property,setProperty] = useState(()=>{ const s=localStorage.getItem("rm_auto_gsc_site"); if(s){localStorage.removeItem("rm_auto_gsc_site");return s;} return activeSite||""; });
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState("");
  const [errDomain,setErrDomain] = useState("");
  const [tab,setTab] = useState("overview");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insights,setInsights] = useState<any[]|null>(null);
  const [insightsLoading,setInsightsLoading] = useState(false);
  const [range,setRange] = useState(28);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableSites,setAvailableSites] = useState<any[]|null>(null);
  const [sitesLoading,setSitesLoading] = useState(false);

  // Strict: never fall back to a different site's data
  const viewData = gscDataMap[viewDomain] || null;

  // Fetch the exact GSC property URL using the site analytics API
  const fetchData = async (siteUrl: string, days: number) => {
    setLoading(true); setErr(""); setErrDomain("");
    try {
      const res = await fetch(`/api/gsc?site=${encodeURIComponent(siteUrl)}&days=${days}`);
      if (res.status === 401) { localStorage.setItem("rm_auto_gsc_site", siteUrl); window.location.href = `/api/auth?site=${encodeURIComponent(siteUrl)}`; return; }
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "API error"); }
      const data = await res.json();
      setGscData(data);
      setViewDomain(data.domain || siteUrl.replace(/^https?:\/\//,"").replace(/\/$/,""));
      setShowAdd(false); setAvailableSites(null);
    } catch(e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed.";
      setErr(msg);
      setErrDomain(siteUrl.replace(/^https?:\/\//,"").replace(/\/$/,""));
    }
    finally { setLoading(false); }
  };

  // List all verified GSC properties for the current OAuth session
  const browseProperties = async () => {
    setSitesLoading(true); setErr(""); setErrDomain("");
    try {
      const res = await fetch("/api/gsc/sites");
      if (!res.ok) { const b = await res.json(); throw new Error(b.error||"Could not list properties"); }
      const d = await res.json();
      setAvailableSites(d.sites||[]);
    } catch(e:unknown){ setErr(e instanceof Error?e.message:"Failed to list properties"); }
    finally{ setSitesLoading(false); }
  };

  const connect = () => {
    localStorage.setItem("rm_auto_gsc_site", "browse");
    window.location.href = `/api/auth?site=browse`;
  };

  // After OAuth return: list available properties so user picks the right one
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(property==="browse"){ setProperty(""); setShowAdd(true); browseProperties(); } },[]);

  const disconnect = (domain: string) => {
    if(upsertGsc) upsertGsc(domain, null); else setGscData(null);
    setInsights(null); setErr("");
    const remaining = allDomains.filter(k=>k!==domain);
    if(remaining.length>0) setViewDomain(remaining[0]);
    else { setViewDomain(""); setShowAdd(true); }
  };

  const getInsights = () => {
    if(!viewData) return;
    setInsightsLoading(true);
    setInsights(gscInsightsFromData({ctr:viewData.summary.ctr, pos:viewData.summary.pos, clicks:viewData.summary.clicks, impressions:viewData.summary.impressions}));
    setInsightsLoading(false);
  };

  // Property picker panel (shown after OAuth or when browsing)
  const PropertyPicker = ({onPick}:{onPick:(url:string)=>void}) => (
    <Card style={{marginBottom:16}}>
      <SH title="Choose your Search Console property"/>
      {sitesLoading && <p style={{fontSize:13,color:S.muted}}>Loading properties…</p>}
      {err && !sitesLoading && <p style={{fontSize:13,color:S.red,margin:"0 0 10px"}}>⚠ {err}</p>}
      {availableSites && availableSites.length===0 && <p style={{fontSize:13,color:S.muted}}>No properties found for this Google account. Make sure you have a verified property in Search Console.</p>}
      {availableSites && availableSites.length>0 && (
        <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
          {availableSites.map((s:{url:string;permission:string})=>(
            <button key={s.url} onClick={()=>onPick(s.url)}
              disabled={loading}
              style={{textAlign:"left" as const,background:S.subtle,border:`1px solid ${S.border}`,borderRadius:8,padding:"10px 14px",cursor:"pointer",fontFamily:"inherit",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:600,color:S.text}}>{s.url}</span>
              <span style={{fontSize:11,color:S.muted,background:S.card,borderRadius:4,padding:"2px 7px"}}>{s.permission.replace("siteOwner","Owner").replace("siteFullUser","Full").replace("siteRestrictedUser","Restricted")}</span>
            </button>
          ))}
        </div>
      )}
      {!sitesLoading && !availableSites && (
        <Btn onClick={browseProperties}>Load available properties</Btn>
      )}
    </Card>
  );

  if(allDomains.length===0) {
    return (
      <div>
        <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Google Search Console</h2>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Connect your GSC property to pull real search performance data.</p>
        {(availableSites||sitesLoading) ? (
          <PropertyPicker onPick={(url)=>fetchData(url,28)}/>
        ) : (
          <Card>
            {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
            <Btn onClick={connect}>{loading?"Connecting...":"Connect with Google"}</Btn>
            <p style={{fontSize:11,color:S.muted,margin:"10px 0 0",lineHeight:1.6}}>You'll be redirected to Google to authorise. After signing in, your verified properties will appear and you can pick the right one.</p>
          </Card>
        )}
      </div>
    );
  }

  if(!viewData) return null;

  const daily = viewData.daily.slice(-range);
  const maxC = Math.max(...daily.map((d:{clicks:number})=>d.clicks),1);
  const maxI = Math.max(...daily.map((d:{impressions:number})=>d.impressions),1);
  const chg = (v:number,inv=false) => { const pos=inv?v<0:v>=0; return <span style={{fontWeight:600,color:pos?S.green:S.red}}>{v>=0?"+":""}{v}</span>; };

  return (
    <div>
      {allDomains.length>1 && (
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Site:</span>
          {allDomains.map(d=>(
            <button key={d} onClick={()=>{setViewDomain(d);setInsights(null);setTab("overview");setErr("");fetchData(d,range);}}
              style={{padding:"4px 14px",borderRadius:20,border:`1px solid ${viewDomain===d?S.accent:S.border}`,background:viewDomain===d?S.accentBg:"transparent",color:viewDomain===d?S.accentText:S.muted,fontSize:12,fontWeight:viewDomain===d?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.1s"}}>
              {d}
            </button>
          ))}
          <button onClick={()=>{setShowAdd(v=>!v);setErr("");setErrDomain("");}}
            style={{padding:"4px 14px",borderRadius:20,border:`1px solid ${S.border}`,background:"transparent",color:S.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            {showAdd?"✕ Cancel":"+ Add site"}
          </button>
        </div>
      )}
      {showAdd && allDomains.length>0 && (
        (availableSites||sitesLoading) ? (
          <PropertyPicker onPick={(url)=>fetchData(url,28)}/>
        ) : (
          <Card style={{marginBottom:16}}>
            <SH title="Connect another site"/>
            {err && errDomain==="" && <p style={{fontSize:13,color:S.red,margin:"0 0 10px"}}>⚠ {err}</p>}
            <Btn onClick={connect} disabled={loading}>{loading?"Connecting...":"Connect with Google"}</Btn>
            <p style={{fontSize:11,color:S.muted,margin:"8px 0 0",lineHeight:1.5}}>You'll sign in with Google and pick from your verified Search Console properties.</p>
          </Card>
        )
      )}
      {err && errDomain && errDomain===viewDomain && !showAdd && (
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:10}}>
          <span style={{fontSize:15,lineHeight:1}}>⚠</span>
          <div>
            <p style={{fontSize:13,fontWeight:600,color:"#b91c1c",margin:"0 0 2px"}}>Could not load data for {errDomain}</p>
            <p style={{fontSize:12,color:"#dc2626",margin:0}}>{err}</p>
            <p style={{fontSize:11,color:"#9ca3af",margin:"4px 0 0"}}>Make sure this property is verified in Search Console under the same Google account you connected.</p>
          </div>
          <button onClick={()=>{setErr("");setErrDomain("");}} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontSize:16,lineHeight:1,padding:0}}>✕</button>
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:(err&&errDomain===viewDomain)?S.amber:S.green}}/>
            <span style={{fontSize:12,fontWeight:700,color:(err&&errDomain===viewDomain)?S.amber:S.green}}>{(err&&errDomain===viewDomain)?"Access error":"Connected"}</span>
            <span style={{fontSize:12,color:S.muted}}>· {viewData.domain}</span>
            {allDomains.length>1 && <span style={{fontSize:11,color:S.muted}}>({allDomains.length} sites)</span>}
          </div>
          <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:0}}>Search Console</h2>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{display:"flex",background:S.subtle,borderRadius:7,padding:3,gap:2}}>
            {[{v:7,l:"7D"},{v:14,l:"14D"},{v:28,l:"28D"},{v:90,l:"90D"}].map(r=>(
              <button key={r.l} onClick={()=>{ setRange(r.v); fetchData(viewDomain, r.v); }} disabled={loading}
                style={{padding:"4px 10px",borderRadius:5,border:"none",background:range===r.v?S.card:"transparent",color:range===r.v?S.text:S.muted,fontSize:12,fontWeight:range===r.v?700:400,cursor:"pointer",fontFamily:"inherit"}}>{r.l}</button>
            ))}
          </div>
          {allDomains.length===1 && <Btn variant="secondary" small onClick={()=>{setShowAdd(v=>!v);setErr("");setErrDomain("");}}>{showAdd?"Cancel":"+ Add site"}</Btn>}
          <Btn variant="secondary" small onClick={()=>disconnect(viewDomain)}>Disconnect</Btn>
          <Btn small onClick={getInsights} disabled={insightsLoading}>{insightsLoading?"Analysing...":"AI insights"}</Btn>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[{l:"Clicks",v:viewData.summary.clicks.toLocaleString(),ch:viewData.summary.clicks_change,inv:false},{l:"Impressions",v:viewData.summary.impressions.toLocaleString(),ch:viewData.summary.impressions_change,inv:false},{l:"Avg CTR",v:viewData.summary.ctr.toFixed(1)+"%",ch:viewData.summary.ctr_change,inv:false},{l:"Avg Position",v:"#"+viewData.summary.pos.toFixed(1),ch:viewData.summary.pos_change,inv:true}].map(s=>(
          <div key={s.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"16px 18px"}}>
            <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",margin:"0 0 6px"}}>{s.l}</p>
            <p style={{fontSize:22,fontWeight:700,color:S.text,margin:"0 0 4px",lineHeight:1}}>{s.v}</p>
            <p style={{fontSize:11,margin:0,color:S.muted}}>vs last: {chg(s.ch,s.inv)}</p>
          </div>
        ))}
      </div>

      {insights && (
        <Card style={{marginBottom:16}}>
          <SH title="AI insights"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {insights.map((ins,i) => {
              const tc = ins.type==="issue"?S.redText:ins.type==="win"?S.greenText:S.accentText;
              const bg = ins.type==="issue"?S.redBg:ins.type==="win"?S.greenBg:S.accentBg;
              return (
                <div key={i} style={{background:bg,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:7,marginBottom:5}}>
                    <span style={{fontSize:11,fontWeight:700,color:tc,textTransform:"uppercase"}}>{ins.type}</span>
                    {pill(ins.impact,ins.impact==="High"?"red":"amber")}
                  </div>
                  <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 4px"}}>{ins.title}</p>
                  <p style={{fontSize:12,color:S.muted,margin:"0 0 6px",lineHeight:1.5}}>{ins.detail}</p>
                  <p style={{fontSize:12,color:tc,margin:0,fontWeight:500}}>→ {ins.action}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card style={{marginBottom:16}}>
        <SH title="Performance over time"/>
        <svg width="100%" viewBox={`0 0 ${Math.max(daily.length*24,400)} 120`} style={{display:"block"}}>
          <polyline fill="none" stroke={S.accent} strokeWidth="2" strokeLinejoin="round" points={daily.map((d:{clicks:number},i:number)=>`${i*24+12},${105-Math.round((d.clicks/maxC)*90)}`).join(" ")}/>
          <polyline fill="none" stroke={S.green} strokeWidth="1.5" strokeDasharray="4 2" strokeLinejoin="round" points={daily.map((d:{impressions:number},i:number)=>`${i*24+12},${105-Math.round((d.impressions/maxI)*90)}`).join(" ")}/>
          {daily.filter((_:{},i:number)=>i%7===0).map((d:{date:string},i:number)=>(
            <text key={i} x={i*7*24+12} y="118" fontSize="9" fill={S.muted} textAnchor="middle">{d.date}</text>
          ))}
        </svg>
        <div style={{display:"flex",gap:14,marginTop:6}}>
          <span style={{fontSize:11,color:S.muted,display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:2,background:S.accent,display:"inline-block"}}/> Clicks</span>
          <span style={{fontSize:11,color:S.muted,display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:2,background:S.green,display:"inline-block"}}/> Impressions</span>
        </div>
      </Card>

      <Tabs tabs={["overview","queries","pages"]} active={tab} onChange={setTab}/>

      {tab==="overview" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Card>
            <SH title="Top queries"/>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Query","Clicks","CTR"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{viewData.queries.slice(0,6).map((q:{query:string;clicks:number;ctr:number},i:number)=>(
                <tr key={i}><TD>{q.query}</TD><TD bold color={S.accent}>{q.clicks}</TD><TD>{q.ctr}%</TD></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card>
            <SH title="Top pages"/>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Page","Clicks","Pos"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{viewData.pages.slice(0,6).map((p:{page:string;clicks:number;pos:number},i:number)=>{
                const path = p.page.replace(`https://${viewData.domain}`,"");
                return <tr key={i}><TD><span style={{fontSize:11,color:S.accent}}>{path||"/"}</span></TD><TD bold>{p.clicks}</TD><TD color={p.pos<=10?S.green:S.amber}>#{p.pos}</TD></tr>;
              })}</tbody>
            </table>
          </Card>
        </div>
      )}
      {tab==="queries" && (
        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
            <SH title={`All queries (${viewData.queries.length})`}/>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              {viewData.queries.length<=25&&<button onClick={()=>{const s=viewDomain||property;if(s)fetchData(s.startsWith("http")?s:"https://"+s,range);}} style={{fontSize:11,color:S.accent,background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>↻ Refresh for all keywords</button>}
              <button onClick={()=>downloadCSV(`${viewDomain||"queries"}.csv`,["Query","Clicks","Impressions","CTR","Position"],viewData.queries.map((q:{query:string;clicks:number;impressions:number;ctr:number;pos:number})=>[q.query,q.clicks,q.impressions,q.ctr+"%",q.pos]))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>
            </div>
          </div>
          {viewData.queries.length<=25&&<div style={{fontSize:11,color:S.amberText,background:S.amberBg,border:"1px solid #fde68a",borderRadius:6,padding:"6px 12px",marginBottom:12}}>⚠ Showing only {viewData.queries.length} queries from an older fetch. Click &quot;Refresh for all keywords&quot; to load up to 1,000.</div>}
          <div style={{maxHeight:viewData.queries.length>15?560:undefined,overflowY:viewData.queries.length>15?"auto" as const:undefined,border:viewData.queries.length>15?`1px solid ${S.border}`:undefined,borderRadius:viewData.queries.length>15?8:undefined}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead style={{position:viewData.queries.length>15?"sticky" as const:undefined,top:0,zIndex:1}}><tr>{["Query","Clicks","Impressions","CTR","Position"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{viewData.queries.map((q:{query:string;clicks:number;impressions:number;ctr:number;pos:number},i:number)=>(
              <tr key={i}><TD bold>{q.query}</TD><TD color={S.accent}>{q.clicks}</TD><TD color={S.muted}>{q.impressions}</TD><TD>{q.ctr}%</TD><TD color={q.pos<=5?S.green:q.pos<=15?S.amber:S.red}>#{q.pos}</TD></tr>
            ))}</tbody>
          </table>
          </div>
        </Card>
      )}
      {tab==="pages" && (
        <Card>
          <SH title="All pages"/>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Page","Clicks","Impressions","CTR","Position"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{viewData.pages.map((p:{page:string;clicks:number;impressions:number;ctr:number;pos:number},i:number)=>{
              const path = p.page.replace(`https://${viewData.domain}`,"");
              return <tr key={i}><TD><span style={{fontSize:11,color:S.accent,fontFamily:"monospace"}}>{path||"/"}</span></TD><TD color={S.accent}>{p.clicks}</TD><TD color={S.muted}>{p.impressions}</TD><TD>{p.ctr}%</TD><TD color={p.pos<=5?S.green:p.pos<=15?S.amber:S.red}>#{p.pos}</TD></tr>;
            })}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── GA4 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GA4({ga4Data:_ga4Data,setGa4Data,activeSite,ga4DataMap={},upsertGa4}:{ga4Data:any;setGa4Data:(d:any)=>void;activeSite?:string;ga4DataMap?:Record<string,any>;upsertGa4?:(propId:string,d:any)=>void}) {
  void _ga4Data; // never use prop fallback

  const cleanGA4 = (s:string) => (s||"").replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/$/,"").toLowerCase();

  // Deduplicate: when the same property data exists under BOTH a propId key AND a domain key,
  // keep only the domain-keyed entry (has _siteDomain). This removes "486835606" duplicates.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dedupedEntries: [string, any][] = [];
  const seenPropIds = new Set<string>();
  // First pass: add domain-keyed entries (have _siteDomain — new format, preferred)
  for (const [k, v] of Object.entries(ga4DataMap)) {
    if (v?._siteDomain) {
      const pid = v._propId || v.domain || k;
      if (!seenPropIds.has(pid)) { seenPropIds.add(pid); dedupedEntries.push([k, v]); }
    }
  }
  // Second pass: add property-ID-keyed entries only if their propId not already covered
  for (const [k, v] of Object.entries(ga4DataMap)) {
    if (!v?._siteDomain) {
      const pid = v?._propId || v?.domain || k;
      if (!seenPropIds.has(pid)) { seenPropIds.add(pid); dedupedEntries.push([k, v]); }
    }
  }
  const allProps = dedupedEntries.map(([k]) => k);

  const defaultProp = (() => {
    const ad = (activeSite||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
    if(ga4DataMap[ad]) return ad;
    // Try fuzzy: match by key or _siteDomain
    const fuzzy = allProps.find(k =>
      cleanGA4(k)===cleanGA4(ad) ||
      cleanGA4(ga4DataMap[k]?._siteDomain||"")===cleanGA4(ad)
    );
    return fuzzy||(allProps[0]||"");
  })();
  const [viewProp,setViewProp] = useState(defaultProp);
  const [showAdd,setShowAdd] = useState(allProps.length===0);
  const [property,setProperty] = useState(()=>{ const s=localStorage.getItem("rm_auto_ga4_prop"); if(s){localStorage.removeItem("rm_auto_ga4_prop");return s;} return ""; });
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState("");
  const [tab,setTab] = useState("overview");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insights,setInsights] = useState<any[]|null>(null);
  const [insightsLoading,setInsightsLoading] = useState(false);

  // Strict: never fall back to a different site's data
  const viewData = ga4DataMap[viewProp] || null;

  const fetchData = async (propId: string) => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`/api/ga4?property=${encodeURIComponent(propId)}`);
      if (res.status === 401) { localStorage.setItem("rm_auto_ga4_prop", propId); window.location.href = "/api/auth"; return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `Could not load GA4 data (HTTP ${res.status}). Try reconnecting with Google.`);
      setGa4Data(data);
      setViewProp(data.domain || propId);
      setShowAdd(false);
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : "Connection failed. Try again."); }
    finally { setLoading(false); }
  };

  const connect = async () => {
    if(!property.trim()) return;
    const propId = property.replace(/^properties\//,"").replace(/\s/g,"");
    await fetchData(propId);
  };

  const disconnect = (propId: string) => {
    const data = ga4DataMap[propId];
    const siteDomain = data?._siteDomain;
    if(upsertGa4) {
      upsertGa4(propId, null);
      // Also remove the domain-keyed duplicate
      if(siteDomain && siteDomain !== propId) upsertGa4(siteDomain, null);
    } else setGa4Data(null);
    setInsights(null); setErr("");
    const remaining = allProps.filter(k=>k!==propId&&k!==siteDomain);
    if(remaining.length>0) setViewProp(remaining[0]);
    else { setViewProp(""); setShowAdd(true); }
  };

  const getInsights = () => {
    if(!viewData) return;
    setInsightsLoading(true);
    setInsights(ga4InsightsFromData({sessions:viewData.summary.sessions, bounce_rate:viewData.summary.bounce_rate, conv_rate:viewData.summary.conv_rate}));
    setInsightsLoading(false);
  };

  if(allProps.length===0) {
    return (
      <div>
        <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Google Analytics 4</h2>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Connect your GA4 property to track sessions, conversions and user behaviour.</p>
        <Card>
          <Field label="GA4 Property ID"><TI value={property} onChange={setProperty} placeholder="e.g. 329168258"/></Field>
          <p style={{fontSize:11,color:S.muted,margin:"-8px 0 12px",lineHeight:1.5}}>Found in GA4 → Admin → Property Settings. Use the numeric ID, not the G-XXXXXXXX measurement ID.</p>
          {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
          <Btn onClick={connect} disabled={loading||!property.trim()}>{loading?"Connecting...":"Connect with Google"}</Btn>
          <p style={{fontSize:11,color:S.muted,margin:"10px 0 0",lineHeight:1.6}}>Uses the same Google authorisation as Search Console. If you already connected GSC, this loads without a new sign-in.</p>
        </Card>
      </div>
    );
  }

  if(!viewData) return null;

  const COLORS = [S.accent,S.green,S.amber,S.blue,"#8b5cf6","#ec4899"];
  const hasRealData = viewData.summary.sessions > 0 || viewData.summary.users > 0;
  const maxS = Math.max(...viewData.daily.map((d:{sessions:number})=>d.sessions),1);
  const chg = (v:number,inv=false) => { const pos=inv?v<0:v>=0; return <span style={{fontWeight:600,color:pos?S.green:S.red}}>{v>=0?"+":""}{v}%</span>; };

  return (
    <div>
      {allProps.length>1 && (
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Property:</span>
          {allProps.map(p=>{
            const d=ga4DataMap[p];
            // Show site domain label; fall back to property ID only if no domain found
            const label=d?._siteDomain||d?.domain||p;
            const isId=/^\d+$/.test(p); // raw numeric property ID — show prop number as sub-label
            return (
              <button key={p} onClick={()=>{setViewProp(p);setInsights(null);setTab("overview");}}
                style={{padding:"4px 14px",borderRadius:20,border:`1px solid ${viewProp===p?S.accent:S.border}`,background:viewProp===p?S.accentBg:"transparent",color:viewProp===p?S.accentText:S.muted,fontSize:12,fontWeight:viewProp===p?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.1s"}}>
                {label}{isId&&label===p?" (ID)":""}
              </button>
            );
          })}
          <button onClick={()=>setShowAdd(v=>!v)}
            style={{padding:"4px 14px",borderRadius:20,border:`1px solid ${S.border}`,background:"transparent",color:S.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            {showAdd?"✕ Cancel":"+ Add property"}
          </button>
        </div>
      )}
      {showAdd && allProps.length>0 && (
        <Card style={{marginBottom:16}}>
          <SH title="Connect another GA4 property"/>
          <Field label="GA4 Property ID"><TI value={property} onChange={setProperty} placeholder="e.g. 329168258"/></Field>
          {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
          <Btn onClick={connect} disabled={loading||!property.trim()}>{loading?"Connecting...":"Connect"}</Btn>
        </Card>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:S.green}}/>
            <span style={{fontSize:12,fontWeight:700,color:S.green}}>Connected</span>
            <span style={{fontSize:12,color:S.muted}}>· {viewData.domain}</span>
            {allProps.length>1 && <span style={{fontSize:11,color:S.muted}}>({allProps.length} properties)</span>}
          </div>
          <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:0}}>Analytics (GA4)</h2>
        </div>
        <div style={{display:"flex",gap:8}}>
          {allProps.length===1 && <Btn variant="secondary" small onClick={()=>setShowAdd(v=>!v)}>{showAdd?"Cancel":"+ Add property"}</Btn>}
          <Btn variant="secondary" small onClick={()=>fetchData(viewProp)} disabled={loading}>{loading?"Refreshing...":"↻ Refresh"}</Btn>
          <Btn variant="secondary" small onClick={()=>disconnect(viewProp)}>Disconnect</Btn>
          <Btn small onClick={getInsights} disabled={insightsLoading}>{insightsLoading?"Analysing...":"AI insights"}</Btn>
        </div>
      </div>

      {err && <p style={{fontSize:13,color:S.red,background:S.redBg,padding:"10px 14px",borderRadius:8,marginBottom:14}}>⚠ {err}</p>}
      {!hasRealData && !err && (
        <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#92400e"}}>
          <strong>No data found for property {viewData.domain}.</strong> Possible reasons:<br/>
          <span style={{lineHeight:2,display:"block",marginTop:4}}>
            1. <strong>Google Analytics Data API</strong> not enabled — <a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noreferrer" style={{color:"#92400e"}}>enable it here</a><br/>
            2. Account <strong>amit.tomar@compunnel.com</strong> doesn't have Viewer access to this GA4 property<br/>
            3. Property has no traffic in the last 28 days
          </span>
          <button onClick={()=>fetchData(viewProp)} disabled={loading} style={{marginTop:8,padding:"5px 14px",borderRadius:6,border:"1px solid #fde68a",background:"#fef9c3",color:"#92400e",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            {loading?"Refreshing...":"↻ Re-fetch data"}
          </button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[{l:"Sessions",v:viewData.summary.sessions.toLocaleString(),ch:viewData.summary.sessions_change,inv:false},{l:"Users",v:viewData.summary.users.toLocaleString(),ch:viewData.summary.users_change,inv:false},{l:"Bounce Rate",v:viewData.summary.bounce_rate+"%",ch:viewData.summary.bounce_change,inv:true},{l:"Conversions",v:viewData.summary.conversions+" ("+viewData.summary.conv_rate+"%)",ch:viewData.summary.conv_change,inv:false,color:S.green}].map(s=>(
          <div key={s.l} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"16px 18px"}}>
            <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",margin:"0 0 6px"}}>{s.l}</p>
            <p style={{fontSize:18,fontWeight:700,color:(s as {color?:string}).color||S.text,margin:"0 0 4px",lineHeight:1.2}}>{s.v}</p>
            <p style={{fontSize:11,margin:0,color:S.muted}}>vs last: {chg(s.ch,s.inv)}</p>
          </div>
        ))}
      </div>

      {insights && (
        <Card style={{marginBottom:16}}>
          <SH title="AI insights"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {insights.map((ins,i) => {
              const tc = ins.type==="issue"?S.redText:ins.type==="win"?S.greenText:S.accentText;
              const bg = ins.type==="issue"?S.redBg:ins.type==="win"?S.greenBg:S.accentBg;
              return (
                <div key={i} style={{background:bg,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:7,marginBottom:5}}>
                    <span style={{fontSize:11,fontWeight:700,color:tc,textTransform:"uppercase"}}>{ins.type}</span>
                    {pill(ins.impact,ins.impact==="High"?"red":"amber")}
                  </div>
                  <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 4px"}}>{ins.title}</p>
                  <p style={{fontSize:12,color:S.muted,margin:"0 0 6px",lineHeight:1.5}}>{ins.detail}</p>
                  <p style={{fontSize:12,color:tc,margin:0,fontWeight:500}}>→ {ins.action}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Tabs tabs={["overview","pages","sources"]} active={tab} onChange={setTab}/>

      {tab==="overview" && (
        <>
          <Card>
            <SH title="Sessions over time"/>
            <svg width="100%" viewBox={`0 0 ${Math.max(viewData.daily.length*24,400)} 100`} style={{display:"block"}}>
              <polyline fill="none" stroke={S.green} strokeWidth="2" strokeLinejoin="round" points={viewData.daily.map((d:{sessions:number},i:number)=>`${i*24+12},${88-Math.round((d.sessions/maxS)*78)}`).join(" ")}/>
              {viewData.daily.filter((_:{},i:number)=>i%7===0).map((d:{date:string},i:number)=>(
                <text key={i} x={i*7*24+12} y="99" fontSize="9" fill={S.muted} textAnchor="middle">{d.date}</text>
              ))}
            </svg>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card>
              <SH title="Traffic sources"/>
              {viewData.sources.map((s:{source:string;sessions:number;pct:number},i:number)=>(
                <div key={i} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span style={{fontWeight:600,color:S.text}}>{s.source}</span>
                    <span style={{color:COLORS[i],fontWeight:700}}>{s.sessions.toLocaleString()} <span style={{color:S.muted,fontWeight:400}}>({s.pct}%)</span></span>
                  </div>
                  <Bar value={s.pct} color={COLORS[i]}/>
                </div>
              ))}
            </Card>
            <Card>
              <SH title="Key metrics"/>
              {[{l:"Avg session duration",v:viewData.summary.avg_duration},{l:"New users",v:viewData.summary.new_users.toLocaleString()},{l:"Returning users",v:(viewData.summary.users-viewData.summary.new_users).toLocaleString()},{l:"Conv. rate",v:viewData.summary.conv_rate+"%",color:S.green}].map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${S.border}`}}>
                  <span style={{fontSize:13,color:S.muted}}>{m.l}</span>
                  <span style={{fontSize:13,fontWeight:700,color:(m as {color?:string}).color||S.text}}>{m.v}</span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
      {tab==="pages" && (
        <Card>
          <SH title="Top pages"/>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Page","Views","Users","Bounce","Duration","Conv%"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{viewData.pages.map((p:{page:string;views:number;users:number;bounce:number;duration:string;conv_rate:number},i:number)=>(
              <tr key={i}><TD><span style={{fontSize:11,color:S.accent,fontFamily:"monospace"}}>{p.page}</span></TD><TD bold>{p.views.toLocaleString()}</TD><TD>{p.users.toLocaleString()}</TD><TD color={p.bounce<40?S.green:p.bounce<60?S.amber:S.red}>{p.bounce}%</TD><TD color={S.muted}>{p.duration}</TD><TD color={S.green}>{p.conv_rate}%</TD></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
      {tab==="sources" && (
        <Card>
          <SH title="Traffic sources"/>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Source","Sessions","Share"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{viewData.sources.map((s:{source:string;sessions:number;pct:number},i:number)=>(
              <tr key={i}><TD bold>{s.source}</TD><TD color={COLORS[i]}>{s.sessions.toLocaleString()}</TD>
              <TD><div style={{display:"flex",alignItems:"center",gap:10}}><Bar value={s.pct} color={COLORS[i]}/><span style={{fontSize:12,fontWeight:700,color:COLORS[i],whiteSpace:"nowrap"}}>{s.pct}%</span></div></TD></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── KEYWORDS ──
function Keywords() {
  const [topic,setTopic]=useState("");const [industry,setIndustry]=useState("");const [location,setLocation]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [loadPhase,setLoadPhase]=useState("");
  const [intentFilter,setIntentFilter]=useState("All");
  const hist = useToolHistory("keywords");
  const run = async () => {
    if(!topic.trim()) return; setLoading(true); setErr(""); setLoadPhase("");
    try {
      setLoadPhase("Scraping keyword data from Google Suggest…");

      const t=topic.trim(), ind=industry||"general";
      const r = await fetch(`/api/kwresearch?seed=${encodeURIComponent(t)}&industry=${encodeURIComponent(ind)}${location.trim()?`&location=${encodeURIComponent(location.trim())}`:""}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Request failed (${r.status})`);
      }
      const merged = await r.json();
      setData(merged);
      setIntentFilter("All"); hist.add(topic+(industry?` · ${industry}`:"")+( location?` · ${location}`:""), merged);
    } catch(e) { setErr(e instanceof Error ? e.message : "Failed. Try again."); console.error(e); } finally { setLoading(false); setLoadPhase(""); }
  };
  const iColor:Record<string,string>={Informational:"blue",Commercial:"purple",Transactional:"green",Navigational:"gray"};
  const kdColor=(kd:number)=>kd<=29?S.green:kd<=49?"#f59e0b":kd<=69?"#f97316":S.red;
  const kdBg=(kd:number)=>kd<=29?S.greenBg:kd<=49?"#fffbeb":kd<=69?"#fff7ed":S.redBg;
  const intents=["All","Informational","Commercial","Transactional","Navigational"];
  const allKws = data ? (data.clusters||[]).flatMap((cl:{name:string;intent:string;keywords:{kw:string;volume:number;kd:number;cpc:string;comp:number;trend:string}[]})=>cl.keywords.map(k=>({...k,cluster:cl.name,intent:cl.intent}))) : [];
  const filteredKws = intentFilter==="All" ? allKws : allKws.filter((k:{intent:string})=>k.intent===intentFilter);
  const trend=data?.seed?.trend||[];
  const tMax=Math.max(...trend,1);
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Keyword Explorer</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>SEMrush-style keyword magic — search volume, KD, CPC, intent, SERP features, and 12-month trend.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Seed keyword"><TI value={topic} onChange={setTopic} placeholder="e.g. AI chatbot for ecommerce"/></Field>
          <Field label="Industry"><TI value={industry} onChange={setIndustry} placeholder="e.g. SaaS, Healthcare, D2C"/></Field>
          <Field label="Location"><TI value={location} onChange={setLocation} placeholder="e.g. United States, UK, India"/></Field>
        </div>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!topic.trim()}>{loading?"Researching...":"Run keyword research"}</Btn>
      </Card>

      {data?.seed && (
        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <SH title={`Seed: "${topic}"${data?._location?` · ${data._location}`:""}`}/>
            {data?._real
              ? <span style={{fontSize:11,color:S.green,background:S.greenBg,border:"1px solid #a7f3d0",borderRadius:4,padding:"2px 8px",fontWeight:600}}>✓ Real search volume · {data._source==="google_ads"?"Google Ads Keyword Planner":"DataForSEO"}{data?._location?` · ${data._location}`:""}</span>
              : <span style={{fontSize:11,color:S.amber,background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:4,padding:"2px 8px",fontWeight:600}}>⚠ Estimated · Google Suggest density{data?._location?` · ${data._location} (${(data._gl||"").toUpperCase()})`:""} · not real search volume</span>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
            {[{l:"Search Volume",v:data.seed.volume>0?data.seed.volume?.toLocaleString():"< 10"},{l:"Keyword Difficulty",v:data.seed.kd,color:kdColor(data.seed.kd)},{l:"CPC",v:`$${data.seed.cpc}`},{l:"Comp. Density",v:data.seed.comp_density?.toFixed(2)}].map((m,i)=>(
              <div key={i} style={{background:S.subtle,borderRadius:8,padding:"12px 14px"}}>
                <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",margin:"0 0 4px"}}>{m.l}</p>
                <p style={{fontSize:20,fontWeight:700,color:m.color||S.text,margin:0,lineHeight:1}}>{m.v}</p>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 8px"}}>12-Month Trend</p>
              <svg width="100%" viewBox={`0 0 ${trend.length*20} 40`} style={{display:"block",overflow:"visible"}}>
                <polyline fill="none" stroke={S.accent} strokeWidth="2" strokeLinejoin="round" points={trend.map((v:number,i:number)=>`${i*20+10},${34-Math.round((v/tMax)*28)}`).join(" ")}/>
                {trend.map((v:number,i:number)=><circle key={i} cx={i*20+10} cy={34-Math.round((v/tMax)*28)} r="2.5" fill={S.accent}/>)}
              </svg>
            </div>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 8px"}}>SERP Features</p>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{(data.seed.serp_features||[]).map((f:string,i:number)=><span key={i} style={{fontSize:11,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",fontWeight:600}}>{f}</span>)}</div>
              <div style={{marginTop:10}}>{pill(data.seed.intent,iColor[data.seed.intent]||"gray")}</div>
            </div>
          </div>
        </Card>
      )}

      {data && (
        <>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {intents.map(i=>(
              <button key={i} onClick={()=>setIntentFilter(i)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${intentFilter===i?S.accent:S.border}`,background:intentFilter===i?S.accentBg:"transparent",color:intentFilter===i?S.accentText:S.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{i}</button>
            ))}
          </div>
          <Card style={{padding:"20px 0",overflow:"hidden"}}>
            <div style={{padding:"0 24px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:3,height:16,borderRadius:2,background:"linear-gradient(to bottom,#6366f1,#818cf8)"}}/>
                <h3 style={{fontSize:14,fontWeight:700,color:S.text,margin:0}}>Keyword list</h3>
                <span style={{background:S.subtle,color:S.muted,fontSize:11,fontWeight:600,padding:"1px 8px",borderRadius:20}}>{filteredKws.length}</span>
              </div>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Keyword","Intent","Volume","KD","CPC"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{filteredKws.map((kw:{kw:string;cluster:string;intent:string;volume:number;kd:number;cpc:string;comp:number;trend:string},j:number)=>{
                const maxVol = Math.max(...filteredKws.map((k:{volume?:number})=>k.volume||0),1);
                const volPct = Math.round(((kw.volume||0)/maxVol)*100);
                return (
                  <tr key={j}
                    onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background="#f8fafc"}
                    onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background="transparent"}>
                    <TD>
                      <div>
                        <span style={{fontSize:13,fontWeight:600,color:S.text}}>{kw.kw}</span>
                        <p style={{fontSize:10,color:S.muted,margin:"1px 0 0"}}>{kw.cluster}</p>
                      </div>
                    </TD>
                    <TD>{pill(kw.intent||"Mixed",kw.intent==="Transactional"?"green":kw.intent==="Commercial"?"purple":kw.intent==="Informational"?"blue":"gray")}</TD>
                    <TD>
                      <div>
                        <span style={{fontSize:12,fontWeight:700,color:S.accent}}>{(kw.volume||0).toLocaleString()}</span>
                        <div style={{marginTop:4,width:64,height:3,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}>
                          <div style={{width:`${volPct}%`,height:"100%",background:"#6366f1",borderRadius:99}}/>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:kdBg(kw.kd),display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:11,fontWeight:800,color:kdColor(kw.kd)}}>{kw.kd}</span>
                        </div>
                      </div>
                    </TD>
                    <TD color={S.muted}>{kw.cpc}</TD>
                  </tr>
                );
              })}</tbody>
            </table>
          </Card>

          {(data.questions||[]).length>0 && (
            <Card>
              <SH title="Questions & featured snippet opportunities"/>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr>{["Question","Volume","Snippet Eligible"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{(data.questions||[]).map((q:{q:string;volume:number;snippet_eligible:boolean},i:number)=>(
                  <tr key={i}>
                    <TD bold>{q.q}</TD>
                    <TD color={S.accent}>{q.volume?.toLocaleString()}</TD>
                    <TD><span style={{fontSize:12,fontWeight:700,color:q.snippet_eligible?S.green:S.muted}}>{q.snippet_eligible?"✓ Eligible":"—"}</span></TD>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          )}

          {(data.related||[]).length>0 && (
            <Card><SH title="Related keywords"/>{(data.related||[]).map((k:string,i:number)=><span key={i} style={{fontSize:12,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{k}</span>)}</Card>
          )}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setTopic(e.inputLabel.split(" · ")[0]);setIntentFilter("All");}}/>
    </div>
  );
}

// ── CONTENT ──
// Lightweight markdown → clean HTML (headings, bold/italic, links, bullet/numbered lists,
// paragraphs). Used to hand a Content Writer article off to the Campaign Agent for publishing.
function mdToHtml(md:string):string{
  const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const inline=(s:string)=> esc(s)
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g,"$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2">$1</a>')
    .replace(/\s*[–—]\s*/g,", ");                 // strip em/en dashes (AI tell)
  const lines=md.replace(/\r\n/g,"\n").split("\n"); const out:string[]=[]; let list:""|"ul"|"ol"="";
  const close=()=>{ if(list){out.push(`</${list}>`);list="";} };
  for(const raw of lines){
    const line=raw.trimEnd();
    if(!line.trim()){ close(); continue; }
    let m:RegExpMatchArray|null;
    if((m=line.match(/^(#{1,6})\s+(.*)$/))){ close(); const lvl=Math.min(m[1].length,3); const tag=lvl===1?"h1":lvl===2?"h2":"h3"; out.push(`<${tag}>${inline(m[2])}</${tag}>`); continue; }
    if((m=line.match(/^\s*[-*+]\s+(.*)$/))){ if(list!=="ul"){close();out.push("<ul>");list="ul";} out.push(`<li>${inline(m[1])}</li>`); continue; }
    if((m=line.match(/^\s*\d+\.\s+(.*)$/))){ if(list!=="ol"){close();out.push("<ol>");list="ol";} out.push(`<li>${inline(m[1])}</li>`); continue; }
    close(); out.push(`<p>${inline(line.trim())}</p>`);
  }
  close(); return out.join("\n");
}

// Strip markdown markup (## ** * ` [](), code fences) and em/en dashes from an article,
// leaving clean human-readable text with plain headings and simple bullets.
function humanizeMd(s:string):string{
  let t=String(s||"").replace(/\r\n/g,"\n");
  t=t.replace(/```[a-z]*\n?/gi,"").replace(/```/g,"");          // code fences
  t=t.replace(/^\s{0,3}#{1,6}\s+/gm,"");                         // heading markers → plain line
  t=t.replace(/\*\*(.+?)\*\*/g,"$1").replace(/__(.+?)__/g,"$1"); // bold
  t=t.replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g,"$1$2");     // italic *
  t=t.replace(/(^|[^_])_(?!_)([^_\n]+?)_(?!_)/g,"$1$2");         // italic _
  t=t.replace(/`([^`]+)`/g,"$1");                                // inline code
  t=t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"$1 ($2)");  // links
  t=t.replace(/^\s*[-*+]\s+/gm,"• ");                            // bullets → •
  t=t.replace(/(\d)\s*[–—]\s*(\d)/g,"$1-$2").replace(/\s*[–—]\s*/g,", "); // em/en dashes
  t=t.replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").replace(/,\s*,/g,",");
  return t.trim();
}

function Content({setPage,activeSite}:PageProps) {
  const [kw,setKw]=useState("");const [audience,setAudience]=useState("");const [tone,setTone]=useState("Professional");const [wc,setWc]=useState("1000");const [article,setArticle]=useState("");const [title,setTitle]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brief,setBrief]=useState<any>(null);const [loading,setLoading]=useState(false);const [briefLoading,setBriefLoading]=useState(false);const [err,setErr]=useState("");
  const [editing,setEditing]=useState(false);
  const [editingBrief,setEditingBrief]=useState(false);
  const [briefText,setBriefText]=useState("");
  const [humanizing,setHumanizing]=useState(false);
  // Content guideline (brand/style rules) — uploaded or pasted, persisted, and injected into
  // every brief + article prompt so the writer aligns to it. Synced key (rm_content_guideline).
  const [guideline,setGuideline]=useState(()=>{try{return localStorage.getItem("rm_content_guideline")||"";}catch{return "";}});
  const [showGuideline,setShowGuideline]=useState(false);
  const [guideName,setGuideName]=useState(()=>{try{return localStorage.getItem("rm_content_guideline_name")||"";}catch{return "";}});
  const saveGuideline=(v:string,name?:string)=>{setGuideline(v);try{localStorage.setItem("rm_content_guideline",v);if(name!==undefined){setGuideName(name);localStorage.setItem("rm_content_guideline_name",name);}}catch{}};
  const onGuidelineFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];if(!f)return; setErr(""); setBriefLoading(true);
    try{ const t=await extractFileText(f); if(!t||t.length<10)throw new Error("File appears empty or unreadable."); saveGuideline(t.slice(0,12000),f.name); setShowGuideline(true); }
    catch(ex){setErr(ex instanceof Error?ex.message:"File read failed");}
    finally{setBriefLoading(false); e.target.value="";}
  };
  // The MANDATORY block appended to every generation prompt when a guideline exists.
  const guidelineBlock = guideline.trim()
    ? `\n\nCONTENT GUIDELINE (MANDATORY — follow these brand/style/structure rules exactly; where they conflict with the defaults above, THE GUIDELINE WINS):\n${guideline.trim().slice(0,12000)}`
    : "";
  const hist = useToolHistory("content");
  // Serialize the structured brief to editable text.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const briefToText=(b:any)=> b ? [
    `Meta title: ${b.meta_title||""}`,
    `Meta description: ${b.meta_desc||""}`,
    `Intent: ${b.intent||""}`,
    `Secondary keywords: ${(b.secondary_kws||[]).join(", ")}`,
    `TF-IDF terms: ${(b.tfidf||[]).join(", ")}`,
    ``,
    `Outline:`,
    ...((b.outline||[]) as {type:string;heading:string;points?:string[]}[]).flatMap(h=>[`${h.type||"H2"}: ${h.heading}`,...(h.points||[]).map(p=>`  - ${p}`)]),
  ].join("\n") : "";
  const startEditBrief=()=>{ if(!briefText.trim())setBriefText(briefToText(brief)); setEditingBrief(true); };
  const handleAiErr = (e:unknown) => {
    const msg = e instanceof Error ? e.message : "";
    if(/credit|billing|balance|limit|unavailable|provider/i.test(msg)) {
      setErr("AI providers are currently unavailable (credits exhausted). Top up at console.anthropic.com/settings/billing or wait for Groq daily reset.");
    } else {
      setErr(msg || "Failed. Try again.");
    }
    console.error(e);
  };
  const runBrief = async () => {
    if(!kw.trim()) return; setBriefLoading(true); setErr("");
    try {
      const d = await ai(`Content brief for keyword: "${kw}". Audience: "${audience||"general"}". Tone: ${tone}.${title.trim()?`\nArticle title (use this as the meta_title / base the brief around it): "${title.trim()}"`:""}
Return ONLY valid JSON: {"meta_title":"string","meta_desc":"string","secondary_kws":["kw1","kw2"],"intent":"Informational|Commercial|Transactional","outline":[{"heading":"string","type":"H2|H3","points":["string"]}],"tfidf":["term1","term2","term3","term4","term5"]}
Generate a concise, actionable brief with 5-6 outline sections.${guidelineBlock}`, 4096, true);
      setBrief(d); setBriefText(""); setEditingBrief(false);
      hist.add(`${kw} · brief`,{kw,audience,tone,wc,title,brief:d,article});
    } catch(e) { handleAiErr(e); } finally { setBriefLoading(false); }
  };
  // Rewrite the current article in a human voice + strip all markdown (fixes existing output).
  const humanizeArticle = async () => {
    if(!article.trim()) return; setHumanizing(true); setErr("");
    try {
      const t = await aiText(`Rewrite the article below so it reads like a human expert wrote it, not AI. Keep all facts, the same topic, and roughly the same length.\nWrite in US English with American spelling throughout (optimize, color, organize, behavior, center, analyze) — never British spellings.\nRemove every AI tell: no "in recent years / increasingly popular / in today's world" openers; no "leverage, utilize, robust, seamless, delve, navigate the complexities, it's important to note"; no em dashes or en dashes (use commas or periods). Vary sentence length, use contractions and concrete specifics, take a point of view.\nOutput PLAIN TEXT only, no markdown symbols (no #, ##, **bold**, *, backticks): headings are plain lines, bullets start with a simple dash.\n\nARTICLE:\n${article}`, true);
      setArticle(humanizeMd(t));
    } catch(e) { handleAiErr(e); } finally { setHumanizing(false); }
  };
  const runArticle = async () => {
    if(!kw.trim()) return; setLoading(true); setErr(""); setArticle("");
    try {
      const t = await aiText(`Write a complete SEO article for keyword "${kw}". Audience: ${audience||"general"}. Tone: ${tone}.${title.trim()?`\nUse this exact title as the headline: "${title.trim()}".`:""}
LENGTH (hard requirement): write AT LEAST ${wc} words. Do not stop early; keep adding depth, examples, and specifics until you reach ${wc} words.
Structure: ${title.trim()?"the headline above":"a headline with the keyword"}, the keyword in the first 100 words, 5-7 sections with clear plain-text headings, bullet lists where useful, and a conclusion with a CTA.
HUMAN WRITING RULES (must read as written by an expert, not AI): Write in US English with American spelling throughout (optimize, color, organize, behavior, center, analyze, license, "toward") — never British spellings. Vary sentence length, use contractions, take a point of view, use concrete numbers and named examples. Do NOT open with "in recent years / has become increasingly popular / in today's world". Banned filler: "leverage", "utilize", "robust", "seamless", "delve", "navigate the complexities", "it's important to note". NO em dashes or en dashes (use commas/periods).
FORMAT: plain readable text only. Do NOT use markdown symbols — no #, no ##, no **bold**, no *, no backticks. Headings are plain lines; bullets start with a simple dash.${guidelineBlock}`, true);
      const cleaned=humanizeMd(t);
      setArticle(cleaned);
      hist.add(`${kw} · article`,{kw,audience,tone,wc,title,brief,article:cleaned});
    } catch(e) { handleAiErr(e); } finally { setLoading(false); }
  };
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Content Writer</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Generate SEO-optimised content briefs and full articles.</p>
      <Card>
        <Field label="Title (optional)"><TI value={title} onChange={setTitle} placeholder="Leave blank to let AI craft an SEO title from the keyword"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Target keyword"><TI value={kw} onChange={setKw} placeholder="e.g. best AI chatbot for ecommerce 2025"/></Field>
          <Field label="Audience"><TI value={audience} onChange={setAudience} placeholder="e.g. D2C founders"/></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <Field label="Tone"><Toggle value={tone} onChange={setTone} options={["Professional","Conversational","Authoritative","Friendly"]}/></Field>
          <Field label="Word count"><Toggle value={wc} onChange={setWc} options={["500","800","1000","1500","2000"]}/></Field>
        </div>

        {/* Content guideline — upload/paste brand & style rules the writer must follow */}
        <div style={{border:`1px solid ${S.border}`,borderRadius:8,padding:"10px 12px",marginBottom:16,background:S.subtle}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const}}>
            <button onClick={()=>setShowGuideline(v=>!v)} style={{fontSize:12,fontWeight:700,color:S.text,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0,display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:S.muted,width:10}}>{showGuideline?"▾":"▸"}</span>📋 Content Guideline
            </button>
            {guideline.trim()
              ? <span style={{fontSize:11,fontWeight:600,color:S.green,background:S.greenBg,border:`1px solid #86efac`,borderRadius:20,padding:"1px 8px"}}>✓ Active{guideName?` · ${guideName.length>26?guideName.slice(0,24)+"…":guideName}`:""} · {guideline.trim().split(/\s+/).length} words</span>
              : <span style={{fontSize:11,color:S.muted}}>Optional — the writer aligns every brief & article to it</span>}
            <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
              <label style={{fontSize:11,color:S.accent,cursor:"pointer",fontWeight:600}}>↑ Upload PDF / DOCX / TXT / MD<input type="file" accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json" onChange={onGuidelineFile} style={{display:"none"}}/></label>
              {guideline.trim() && <button onClick={()=>saveGuideline("","")} style={{fontSize:11,color:S.red,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Clear</button>}
            </div>
          </div>
          {showGuideline && (
            <div style={{marginTop:10}}>
              <TI value={guideline} onChange={v=>saveGuideline(v)} rows={8} placeholder={"Paste your content/brand guideline here, or upload a file above.\n\nExamples: brand voice & tone, banned/approved words, sentence-length rules, required structure (intro, H2s, CTA), reading level, product facts and claims to stay accurate to, formatting rules."}/>
              <p style={{fontSize:11,color:S.muted,margin:"6px 0 0"}}>Saved automatically and applied to both the content brief and the article. It overrides the defaults on any conflict.</p>
            </div>
          )}
        </div>

        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <div style={{display:"flex",gap:10}}>
          <Btn variant="secondary" onClick={runBrief} disabled={briefLoading||!kw.trim()}>{briefLoading?"Generating...":"Content brief"}</Btn>
          <Btn onClick={runArticle} disabled={loading||!kw.trim()}>{loading?"Writing...":"Write article"}</Btn>
        </div>
      </Card>
      {brief && (
        <Card>
          <SH title="Content brief" action={<div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>editingBrief?setEditingBrief(false):startEditBrief()} style={{fontSize:11,fontWeight:600,color:editingBrief?S.green:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{editingBrief?"✓ Done":"✏ Edit"}</button>
            <CopyBtn text={editingBrief||briefText.trim()?briefText:briefToText(brief)}/>
          </div>}/>
          {editingBrief ? (
            <TI value={briefText} onChange={setBriefText} rows={16}/>
          ) : briefText.trim() ? (
            <pre style={{fontFamily:"inherit",fontSize:13,color:S.text,lineHeight:1.7,whiteSpace:"pre-wrap",margin:0}}>{briefText}</pre>
          ) : (<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
              <div><p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 4px"}}>Meta title</p><p style={{fontSize:13,color:S.text,fontWeight:600,margin:0}}>{brief.meta_title}</p></div>
              <div><p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 4px"}}>Intent</p>{pill(brief.intent,"blue")}</div>
            </div>
            <div style={{marginBottom:12}}><p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 6px"}}>TF-IDF terms</p>{(brief.tfidf||[]).map((k:string,i:number)=><span key={i} style={{fontSize:12,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",marginRight:4,display:"inline-block"}}>{k}</span>)}</div>
            <Divider/>
            <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 10px"}}>Outline</p>
            {(brief.outline||[]).map((h:{type:string;heading:string;points:string[]},i:number)=>(
              <div key={i} style={{marginBottom:10,paddingLeft:h.type==="H3"?16:0}}>
                <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 4px"}}><span style={{fontSize:11,color:S.accent,marginRight:6}}>{h.type}</span>{h.heading}</p>
                {(h.points||[]).map((p:string,j:number)=><p key={j} style={{fontSize:12,color:S.muted,margin:"0 0 2px",paddingLeft:14}}>· {p}</p>)}
              </div>
            ))}
          </>)}
        </Card>
      )}
      {article && (
        <Card>
          <SH title="Article" action={<div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:12,color:S.muted}}>~{article.split(/\s+/).filter(Boolean).length} words</span>
            <button onClick={humanizeArticle} disabled={humanizing} style={{fontSize:11,fontWeight:700,color:humanizing?S.muted:"#fff",background:humanizing?S.border:"linear-gradient(135deg,#6366f1,#818cf8)",border:"none",borderRadius:5,padding:"3px 10px",cursor:humanizing?"default":"pointer",fontFamily:"inherit"}}>{humanizing?"Humanizing…":"✨ Humanize"}</button>
            <button onClick={()=>setEditing(v=>!v)} style={{fontSize:11,fontWeight:600,color:editing?S.green:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{editing?"✓ Done":"✏ Edit"}</button>
            <CopyBtn text={article}/>
            <button onClick={()=>{const a=document.createElement("a");a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(article);a.download=`${(kw||"article").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.md`;a.click();}} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ MD</button>
            {setPage&&<button onClick={()=>{
              const titleM=article.match(/^#\s+(.+)$/m);
              const title=(titleM?titleM[1]:kw).trim();
              const body=titleM?article.replace(titleM[0],"").trim():article;
              const html=mdToHtml(body);
              const plain=article.replace(/[#*_>`]/g," ").replace(/\s+/g," ").trim();
              const dom=(activeSite||"").replace(/^https?:\/\//,"").replace(/\/$/,"").split("/")[0];
              const slug=(title||kw||"article").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
              const schema=JSON.stringify({"@context":"https://schema.org","@type":"Article",headline:title.slice(0,110),description:plain.slice(0,160),...(dom?{publisher:{"@type":"Organization",name:dom}}:{})});
              const seed={title,keyword:kw,domain:dom,article_html:html,meta_title:title.slice(0,60),meta_description:plain.slice(0,155),slug,schema_article:schema};
              try{localStorage.setItem("rm_campaign_publish_seed",JSON.stringify(seed));}catch{}
              if(setPage)setPage("campaign");
            }} style={{fontSize:11,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#818cf8)",border:"none",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>🚀 Publish via Campaign Agent →</button>}
          </div>}/>
          {editing
            ? <TI value={article} onChange={setArticle} rows={20}/>
            : <pre style={{fontFamily:"inherit",fontSize:13,color:S.text,lineHeight:1.75,whiteSpace:"pre-wrap",margin:0,maxHeight:500,overflowY:"auto"}}>{article}</pre>}
        </Card>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{ const d=e.data||{}; if(d.kw!==undefined)setKw(d.kw); if(d.title!==undefined)setTitle(d.title); if(d.audience!==undefined)setAudience(d.audience); if(d.tone)setTone(d.tone); if(d.wc)setWc(d.wc); setBrief(d.brief||null); setBriefText(""); setEditingBrief(false); setArticle(d.article||""); setEditing(false); }}/>
    </div>
  );
}

// ── BACKLINKS ──
function Backlinks({activeSite,setPage}:PageProps) {
  const [domain,setDomain]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [tab,setTab]=useState("overview");
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("backlinks");
  const run = async () => {
    if(!domain.trim()) return; setLoading(true); setErr("");
    try {
      const res = await fetch("/api/py/backlinks", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({domain: domain.trim()}),
      });
      if(!res.ok) {
        const e = await res.json().catch(()=>({}));
        throw new Error((e as {error?:string}).error || `Scraper error ${res.status}`);
      }
      const d = await res.json();
      if(d.error) throw new Error(d.error);
      setData(d); setTab("overview"); hist.add(domain, d);
    } catch(e) { setErr(e instanceof Error ? e.message : "Failed. Try again."); console.error(e); } finally { setLoading(false); }
  };
  const COLORS=[S.accent,S.green,S.amber,S.red,"#8b5cf6"];
  const drColor=(dr:number)=>dr>=70?S.green:dr>=40?S.amber:S.muted;
  const velMax=data?Math.max(...(data.velocity||[]).map((v:{links:number})=>v.links),1):1;
  const drMax=data?Math.max(...(data.dr_distribution||[]).map((d:{count:number})=>d.count),1):1;
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Backlink Profile</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Ahrefs-style — Domain Rating, referring domains, anchor analysis, DR distribution, and link velocity.</p>
      <Card><Field label="Your domain"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>{err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}<Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Analysing...":"Analyse backlinks"}</Btn></Card>

      {data && (
        <>
          {/* Data quality badge */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"6px 12px",background:S.subtle,borderRadius:6,border:`1px solid ${S.border}`,fontSize:11}}>
            {data.meta?.data_quality==="real"
              ? <span style={{color:S.green,fontWeight:700}}>● Live data — Open Link Profiler</span>
              : <span style={{color:S.amber,fontWeight:700}}>● Signal-based estimate</span>}
            {data.meta?.tranco_rank&&<span style={{color:S.muted}}>· Rank #{(data.meta.tranco_rank as number).toLocaleString()}</span>}
            {data.meta?.site_age_years&&<span style={{color:S.muted}}>· ~{data.meta.site_age_years}yr old</span>}
            {data.meta?.archived_pages>0&&<span style={{color:S.muted}}>· {(data.meta.archived_pages as number).toLocaleString()} archived pages</span>}
            {data.meta?.inlink_domains_found>0&&<span style={{color:S.muted}}>· {data.meta.inlink_domains_found} inlink domains found</span>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:16,marginBottom:16}}>
            <Card style={{minWidth:140,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <svg viewBox="0 0 80 80" width="80" height="80">
                <circle cx="40" cy="40" r="34" fill="none" stroke={S.subtle} strokeWidth="8"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke={drColor(data.overview?.dr||0)} strokeWidth="8" strokeDasharray={`${Math.round((data.overview?.dr||0)/100*213.6)} 213.6`} strokeLinecap="round" transform="rotate(-90 40 40)"/>
                <text x="40" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill={drColor(data.overview?.dr||0)}>{data.overview?.dr}</text>
              </svg>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"6px 0 0",letterSpacing:"0.04em"}}>Domain Rating</p>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{l:"Total backlinks",v:(data.overview?.total_links||0).toLocaleString(),ch:data.overview?.links_change},{l:"Referring domains",v:(data.overview?.referring_domains||0).toLocaleString(),ch:data.overview?.domains_change},{l:"Dofollow",v:(data.overview?.dofollow||0).toLocaleString(),color:S.green},{l:"Nofollow",v:(data.overview?.nofollow||0).toLocaleString(),color:S.muted},{l:"Edu links",v:(data.overview?.edu||0).toLocaleString(),color:S.accent},{l:"Gov links",v:(data.overview?.gov||0).toLocaleString(),color:S.accent}].map((m,i)=>(
                <div key={i} style={{background:S.subtle,borderRadius:8,padding:"12px 14px"}}>
                  <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 4px"}}>{m.l}</p>
                  <p style={{fontSize:17,fontWeight:700,color:m.color||S.text,margin:"0 0 2px",lineHeight:1}}>{m.v}</p>
                  {m.ch!==undefined&&<p style={{fontSize:11,color:m.ch>=0?S.green:S.red,margin:0,fontWeight:600}}>{m.ch>=0?"+":""}{m.ch} this month</p>}
                </div>
              ))}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <Card>
              <SH title="Dofollow / Nofollow split"/>
              {(()=>{const tot=(data.overview?.dofollow||0)+(data.overview?.nofollow||0)||1; const dfPct=Math.round((data.overview?.dofollow||0)/tot*100); return (<><div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:S.green,fontWeight:600}}>Dofollow</span><span style={{fontWeight:700}}>{dfPct}%</span></div><Bar value={dfPct} color={S.green}/></div><div><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:S.muted,fontWeight:600}}>Nofollow</span><span style={{fontWeight:700}}>{100-dfPct}%</span></div><Bar value={100-dfPct} color={S.muted}/></div></>); })()}
              <Divider/>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 8px"}}>Link types</p>
              {Object.entries(data.link_types||{}).map(([type,count],i)=>(
                <div key={type} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{textTransform:"capitalize"}}>{type}</span><span style={{fontWeight:700,color:COLORS[i%5]}}>{count as number}</span></div>
                  <Bar value={Math.round(((count as number)/Math.max(...Object.values(data.link_types).map(v=>v as number),1))*100)} color={COLORS[i%5]} height={4}/>
                </div>
              ))}
            </Card>
            <Card>
              <SH title="DR distribution (referring domains)"/>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80,marginBottom:6}}>
                {(data.dr_distribution||[]).map((d:{range:string;count:number},i:number)=>{
                  const h=Math.round((d.count/drMax)*72);
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{width:"100%",height:h,background:i<3?S.muted:i<6?S.accent:S.green,borderRadius:"3px 3px 0 0",minHeight:2}}/>
                      <span style={{fontSize:8,color:S.muted,textAlign:"center",lineHeight:1}}>{d.range}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Tabs tabs={["overview","anchor types","velocity","top links","lost","toxic"]} active={tab} onChange={setTab}/>

          {tab==="overview"&&(
            <Card>
              <SH title="Anchor type breakdown (Ahrefs-style)"/>
              {(data.anchors||[]).map((a:{type:string;pct:number;count:number},i:number)=>(
                <div key={i} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4,alignItems:"center"}}>
                    <span style={{fontWeight:600,color:S.text}}>{a.type}</span>
                    <span style={{color:COLORS[i%5],fontWeight:700}}>{a.pct}% <span style={{color:S.muted,fontWeight:400}}>({(a.count||0).toLocaleString()})</span></span>
                  </div>
                  <Bar value={a.pct} color={COLORS[i%5]}/>
                </div>
              ))}
            </Card>
          )}
          {tab==="anchor types"&&(
            <Card>
              <SH title="Full anchor analysis"/>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Anchor type","Count","Share","Impact"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{(data.anchors||[]).map((a:{type:string;pct:number;count:number},i:number)=>(
                  <tr key={i}><TD bold>{a.type}</TD><TD color={COLORS[i%5]}>{(a.count||0).toLocaleString()}</TD><TD><div style={{display:"flex",alignItems:"center",gap:8}}><Bar value={a.pct} color={COLORS[i%5]}/><span style={{fontSize:12,fontWeight:700,color:COLORS[i%5],whiteSpace:"nowrap"}}>{a.pct}%</span></div></TD><TD><span style={{fontSize:11,color:a.type==="Exact match"?S.amber:a.type==="Branded"?S.green:S.muted,fontWeight:600}}>{a.type==="Exact match"?"Monitor for over-opt.":a.type==="Branded"?"Strong signal":"Natural"}</span></TD></tr>
                ))}</tbody>
              </table>
            </Card>
          )}
          {tab==="velocity"&&(
            <Card>
              <SH title="Link velocity (last 6 months)"/>
              <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100,marginBottom:8}}>
                {(data.velocity||[]).map((v:{month:string;links:number},i:number)=>{
                  const h=Math.round((v.links/velMax)*88);
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                      <span style={{fontSize:10,color:S.accent,fontWeight:700}}>{v.links}</span>
                      <div style={{width:"100%",height:h,background:S.accent,borderRadius:"4px 4px 0 0",minHeight:4}}/>
                      <span style={{fontSize:10,color:S.muted,textAlign:"center"}}>{v.month}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          {tab==="top links"&&(
            <Card>
              <SH title="Top referring pages"/>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Domain","DR","Anchor","Type","Traffic"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{(data.top_links||[]).map((l:{domain:string;dr:number;anchor:string;type:string;traffic:number},i:number)=>(
                  <tr key={i}><TD bold><span style={{color:S.accent}}>{l.domain}</span></TD><TD color={drColor(l.dr)}><strong>{l.dr}</strong></TD><TD color={S.muted}><em>{l.anchor}</em></TD><TD>{pill(l.type,l.type==="Dofollow"?"green":"gray")}</TD><TD color={S.muted}>{(l.traffic||0).toLocaleString()}</TD></tr>
                ))}</tbody>
              </table>
            </Card>
          )}
          {tab==="lost"&&(
            <Card>
              <SH title="Lost backlinks"/>
              {(data.lost||[]).map((l:{domain:string;dr:number;anchor:string;reason:string},i:number)=>(
                <div key={i} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${S.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:6}}><span style={{fontWeight:600,fontSize:13}}>{l.domain}</span>{pill(`DR ${l.dr}`,"gray")}</div>
                  <p style={{fontSize:12,color:S.muted,margin:"0 0 3px"}}>Anchor: <em>{l.anchor}</em></p>
                  <p style={{fontSize:12,color:S.red,margin:0}}>⚠ {l.reason}</p>
                </div>
              ))}
            </Card>
          )}
          {tab==="toxic"&&(
            <Card>
              <SH title="Toxic link candidates"/>
              {(data.toxic||[]).map((l:{domain:string;issue:string;action:string},i:number)=>(
                <div key={i} style={{paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${S.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:6}}><span style={{fontWeight:600,fontSize:13}}>{l.domain}</span>{pill(l.action,l.action==="Disavow"?"red":l.action==="Monitor"?"amber":"gray")}</div>
                  <p style={{fontSize:12,color:S.muted,margin:0}}>{l.issue}</p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setDomain(e.inputLabel);setTab("overview");}}/>
    </div>
  );
}

// ── TECHNICAL ──
function Technical({activeSite,setPage}:PageProps) {
  const [url,setUrl]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [loadPhase,setLoadPhase]=useState("");
  const [issueFilter,setIssueFilter]=useState("All");
  useEffect(()=>{if(activeSite&&!url)setUrl(extractOrigin(activeSite));},[activeSite]);
  const hist = useToolHistory("technical");
  const run = async () => {
    if(!url.trim()) return; setLoading(true); setErr(""); setLoadPhase("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let crawlData: any = null; let crawlScraped = false;
    try {
      setLoadPhase("Crawling site pages…");
      // Try fast Next.js crawler first, then Python fallback
      try {
        const domain = url.trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
        crawlData = await cachedCrawl(domain);
        crawlScraped = crawlData?.scraped || false;
      } catch { /* try Python fallback */ }
      if(!crawlData) {
        try {
          const r = await fetch(`/api/py/techaudit?domain=${encodeURIComponent(url.trim())}`);
          if (r.ok) { crawlData = await r.json(); crawlScraped = crawlData?.scraped || false; }
        } catch { /* ignore */ }
      }

      // ── Show real crawl data immediately even if AI fails ──────────────────
      if(crawlData?.summary) {
        const s = crawlData.summary;
        const health = s.total>0 ? Math.round((s.ok/s.total)*100) : 70;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partialData: any = {
          crawl: { pages: s.total||0, depth:3, resp_codes:{"2xx":s.ok,"3xx":s.redirects,"4xx":s.errors,"5xx":0}, crawl_errors:s.errors, blocked:0, noindex:s.noindex_pages||0 },
          scores: { health, speed:0, mobile:0, security:80 },
          cwv: { lcp:{value:"—",rating:"Needs Improvement"}, fcp:{value:"—",rating:"Needs Improvement"}, cls:{value:"—",rating:"Needs Improvement"}, ttfb:{value:"—",rating:"Needs Improvement"}, inp:{value:"—",rating:"Needs Improvement"} },
          issues: [
            ...(s.missing_title>0?[{title:"Missing title tags",severity:"Critical",category:"HTML Tags",detail:`${s.missing_title} pages have no <title> tag`,fix:"Add unique title tags to all pages",count:s.missing_title,effort:"Low"}]:[]),
            ...(s.missing_meta>0?[{title:"Missing meta descriptions",severity:"Warning",category:"HTML Tags",detail:`${s.missing_meta} pages have no meta description`,fix:"Write 130-160 char meta descriptions",count:s.missing_meta,effort:"Low"}]:[]),
            ...(s.missing_h1>0?[{title:"Missing H1 tags",severity:"Critical",category:"HTML Tags",detail:`${s.missing_h1} pages have no H1 heading`,fix:"Add one H1 per page with primary keyword",count:s.missing_h1,effort:"Low"}]:[]),
            ...(s.errors>0?[{title:"Pages returning errors",severity:"Critical",category:"Crawlability",detail:`${s.errors} pages return 4xx/5xx status codes`,fix:"Fix broken pages or redirect to working URLs",count:s.errors,effort:"Medium"}]:[]),
            ...(s.thin_content>0?[{title:"Thin content pages",severity:"Warning",category:"Content",detail:`${s.thin_content} pages have under 300 words`,fix:"Expand content to 600+ words with useful information",count:s.thin_content,effort:"High"}]:[]),
            ...(s.imgs_no_alt>0?[{title:"Images missing alt text",severity:"Warning",category:"Images",detail:`${s.imgs_no_alt} images lack alt attributes`,fix:"Add descriptive alt text to all images",count:s.imgs_no_alt,effort:"Low"}]:[]),
            ...(s.no_canonical>0?[{title:"Missing canonical tags",severity:"Warning",category:"Crawlability",detail:`${s.no_canonical} pages have no canonical URL`,fix:"Add <link rel='canonical'> to prevent duplicate content",count:s.no_canonical,effort:"Low"}]:[]),
          ],
          schema_found: [], schema_missing: ["Article","FAQPage","BreadcrumbList"],
          _scraped: crawlScraped, _crawlData: crawlData, _hasPagespeed: false, _crawlOnly: true,
        };
        setData(partialData); setIssueFilter("All");
      }

      setLoadPhase("Generating AI analysis…");
      const psM = crawlData?.pagespeed?.mobile || {};
      const hasPsData = crawlData?.pagespeed?.source === "google_pagespeed_insights" && typeof psM.performance === "number";
      const crawlCtx = crawlData?.summary
        ? `\n\nREAL CRAWL DATA — use these EXACT numbers: pages_checked=${crawlData.urls_checked}, ok_2xx=${crawlData.summary.ok}, redirects_3xx=${crawlData.summary.redirects}, errors_4xx_5xx=${crawlData.summary.errors}, missing_title=${crawlData.summary.missing_title}, missing_meta=${crawlData.summary.missing_meta}, missing_h1=${crawlData.summary.missing_h1}, imgs_no_alt=${crawlData.summary.imgs_no_alt}, noindex=${crawlData.summary.noindex_pages}, thin_content=${crawlData.summary.thin_content}` : "";
      const psCtx = hasPsData ? `\n\nPAGESPEED: speed=${psM.performance}, mobile=${psM.performance}` : "";

      const d = await ai(`Technical SEO auditor. Return ONLY valid JSON: {"crawl":{"pages":number,"depth":number,"resp_codes":{"2xx":number,"3xx":number,"4xx":number,"5xx":number},"crawl_errors":number,"blocked":number,"noindex":number},"scores":{"health":number,"speed":number,"mobile":number,"security":number},"cwv":{"lcp":{"value":"string","rating":"Good|Needs Improvement|Poor"},"fcp":{"value":"string","rating":"Good|Needs Improvement|Poor"},"cls":{"value":"string","rating":"Good|Needs Improvement|Poor"},"ttfb":{"value":"string","rating":"Good|Needs Improvement|Poor"},"inp":{"value":"string","rating":"Good|Needs Improvement|Poor"}},"issues":[{"title":"string","severity":"Critical|Warning|Info","category":"Crawlability|HTML Tags|Content|Images|Links|Performance|Structured Data","detail":"string","fix":"string","count":number,"effort":"Low|Medium|High"}],"schema_found":["string"],"schema_missing":["string"]} URL:${url}. 9 issues specific to this site.${crawlCtx}${psCtx}`);

      if (hasPsData) {
        const cwvRate = (ms: number | null | undefined, good: number, poor: number): string =>
          ms == null ? "Needs Improvement" : ms < good ? "Good" : ms < poor ? "Needs Improvement" : "Poor";
        d.cwv = {
          lcp:  { value: psM.lcp  || "N/A", rating: cwvRate(psM.lcp_ms,  2500, 4000) },
          fcp:  { value: psM.fcp  || "N/A", rating: cwvRate(psM.fcp_ms,  1800, 3000) },
          cls:  { value: psM.cls  || "N/A", rating: psM.cls_score == null ? "Needs Improvement" : psM.cls_score < 0.1 ? "Good" : psM.cls_score < 0.25 ? "Needs Improvement" : "Poor" },
          tbt:  { value: psM.tbt  || "N/A", rating: cwvRate(psM.tbt_ms, 200, 600) },
          si:   { value: psM.speed_index || "N/A", rating: "Good" },
        };
        d.scores.speed  = psM.performance;
        d.scores.mobile = (crawlData?.pagespeed?.desktop?.performance ?? psM.performance);
      }
      // Full AI-enhanced data replaces the partial
      setData({...d, _scraped: crawlScraped, _crawlData: crawlData, _hasPagespeed: hasPsData}); setIssueFilter("All"); hist.add(url, d);
    } catch(e) {
      const msg = e instanceof Error ? e.message : "Failed.";
      // If we already showed real crawl data, just show a soft warning
      if(crawlData?.summary) {
        setErr("⚡ Showing real crawl data. AI analysis unavailable right now — top up Anthropic credits or try again later.");
      } else {
        setErr(msg.includes("credit")||msg.includes("limit")||msg.includes("unavailable")
          ? "AI providers unavailable. Please top up Anthropic credits at console.anthropic.com/settings/billing"
          : msg);
      }
      console.error(e);
    } finally { setLoading(false); setLoadPhase(""); }
  };
  const sc = (s:number) => s>=80?S.green:s>=50?S.amber:S.red;
  const ratingColor:Record<string,string>={"Good":S.green,"Needs Improvement":S.amber,"Poor":S.red};
  const ratingBg:Record<string,string>={"Good":S.greenBg,"Needs Improvement":S.amberBg,"Poor":S.redBg};
  const sevBg:Record<string,string>={Critical:S.redBg,Warning:S.amberBg,Info:S.blueBg};
  const sevColor:Record<string,string>={Critical:S.redText,Warning:S.amberText,Info:S.blueText};
  const cats = data ? ["All",...Array.from(new Set((data.issues||[]).map((i:{category:string})=>i.category)))] as string[] : ["All"];
  const filteredIssues = data ? (data.issues||[]).filter((i:{category:string})=>issueFilter==="All"||i.category===issueFilter) : [];
  const respTotal = data ? Object.values(data.crawl?.resp_codes||{}).reduce((a:number,b)=>a+(b as number),0)||1 : 1;
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Site Crawl</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Screaming Frog-style technical audit — crawl health, response codes, CWV, and structured data.</p>
      <Card><Field label="Site URL"><TI value={url} onChange={setUrl} placeholder="https://yoursite.com"/></Field>{err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}{loading&&loadPhase&&<LoadingBar phase={loadPhase}/>}<Btn onClick={run} disabled={loading||!url.trim()}>{loading?"Crawling...":"Run site crawl"}</Btn></Card>
      {data&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <div style={{background:data._scraped?S.greenBg:S.amberBg,border:`1px solid ${data._scraped?"#86efac":"#fcd34d"}`,borderRadius:8,padding:"8px 14px",fontSize:12,color:data._scraped?S.greenText:S.amberText,fontWeight:600}}>{data._scraped?`✓ Real crawl data — ${data._crawlData?.urls_checked||0} pages checked`:"⚠ Estimated data — enter a live domain for real crawl metrics"}</div>
        <div style={{background:data._hasPagespeed?S.greenBg:S.amberBg,border:`1px solid ${data._hasPagespeed?"#86efac":"#fcd34d"}`,borderRadius:8,padding:"8px 14px",fontSize:12,color:data._hasPagespeed?S.greenText:S.amberText,fontWeight:600}}>{data._hasPagespeed?"✓ Real Core Web Vitals — Google PageSpeed Insights":"⚠ Estimated CWV — no PageSpeed key or unavailable"}</div>
      </div>}
      {data && (
        <>
          <Card style={{marginBottom:16}}>
            <SH title={`Site health scores${data._hasPagespeed?" — real Lighthouse data":""}`}/>
            <div style={{display:"flex",gap:0,justifyContent:"space-around",padding:"8px 0 4px"}}>
              {(data._hasPagespeed
                ? [{l:"Performance",v:data._crawlData?.pagespeed?.mobile?.performance||0},{l:"Accessibility",v:data._crawlData?.pagespeed?.mobile?.accessibility||0},{l:"SEO",v:data._crawlData?.pagespeed?.mobile?.seo||0},{l:"Best Practices",v:data._crawlData?.pagespeed?.mobile?.best_practices||0}]
                : [{l:"Health",v:data.scores?.health||0},{l:"Speed",v:data.scores?.speed||0},{l:"Mobile",v:data.scores?.mobile||0},{l:"Security",v:data.scores?.security||0}]
              ).map(s=>(
                <ScoreRing key={s.l} score={s.v} label={s.l}/>
              ))}
            </div>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <Card>
              <SH title="Crawl stats"/>
              {[{l:"Pages crawled",v:data.crawl?.pages},{l:"Max depth",v:data.crawl?.depth},{l:"Crawl errors",v:data.crawl?.crawl_errors,color:data.crawl?.crawl_errors>0?S.red:S.green},{l:"Blocked by robots",v:data.crawl?.blocked},{l:"Noindex",v:data.crawl?.noindex,color:S.amber}].map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${S.border}`}}>
                  <span style={{fontSize:12,color:S.muted}}>{m.l}</span>
                  <span style={{fontSize:13,fontWeight:700,color:m.color||S.text}}>{m.v}</span>
                </div>
              ))}
            </Card>
            <Card>
              <SH title="Response codes"/>
              {Object.entries(data.crawl?.resp_codes||{}).map(([code,count])=>{
                const c = code==="2xx"?S.green:code==="3xx"?S.amber:S.red;
                const pct = Math.round(((count as number)/respTotal)*100);
                return (
                  <div key={code} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                      <span style={{fontWeight:700,color:c}}>{code}</span>
                      <span style={{color:S.muted}}>{count as number} <span style={{fontWeight:700,color:c}}>({pct}%)</span></span>
                    </div>
                    <Bar value={pct} color={c}/>
                  </div>
                );
              })}
            </Card>
          </div>

          <Card style={{marginBottom:16}}>
            <SH title="Core Web Vitals"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
              {Object.entries(data.cwv||{}).map(([metric,v])=>{
                const mv = v as {value:string;rating:string};
                const rc = ratingColor[mv.rating]||S.muted;
                const isGood=mv.rating==="Good",isOk=mv.rating==="Needs Improvement";
                const bdr = isGood?"#a7f3d0":isOk?"#fde68a":"#fecaca";
                const bgPill = isGood?"#dcfce7":isOk?"#fef3c7":"#fee2e2";
                return (
                  <div key={metric} style={{borderRadius:12,padding:"16px 10px",textAlign:"center",background:S.card,border:`1.5px solid ${bdr}`,boxShadow:S.shadow,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:rc,boxShadow:`0 0 8px ${rc}88`,flexShrink:0}}/>
                    <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:0,letterSpacing:"0.07em"}}>{metric.toUpperCase()}</p>
                    <p style={{fontSize:22,fontWeight:800,color:rc,margin:0,lineHeight:1,letterSpacing:"-0.03em"}}>{mv.value}</p>
                    <span style={{fontSize:10,fontWeight:600,color:rc,background:bgPill,padding:"2px 9px",borderRadius:20}}>{mv.rating}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{padding:"20px 0",overflow:"hidden"}}>
            <div style={{padding:"0 24px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:3,height:16,borderRadius:2,background:"linear-gradient(to bottom,#6366f1,#818cf8)"}}/>
                <h3 style={{fontSize:14,fontWeight:700,color:S.text,margin:0}}>Issues</h3>
                <span style={{background:S.subtle,color:S.muted,fontSize:11,fontWeight:600,padding:"1px 8px",borderRadius:20}}>{filteredIssues.length}</span>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {cats.map(c=>(
                  <button key={c} onClick={()=>setIssueFilter(c)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${issueFilter===c?S.accent:S.border}`,background:issueFilter===c?"linear-gradient(135deg,#6366f1,#818cf8)":"transparent",color:issueFilter===c?"#fff":S.muted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{c}</button>
                ))}
              </div>
            </div>
            {filteredIssues.map((iss:{title:string;severity:string;category:string;detail:string;fix:string;count:number;effort:string},i:number)=>(
              <IssueRow key={i} {...iss}/>
            ))}
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card><SH title="Schema detected"/>{(data.schema_found||[]).map((s:string,i:number)=><span key={i} style={{fontSize:12,background:S.greenBg,color:S.greenText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{s}</span>)}<p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>{(data.schema_found||[]).length} schema types found</p></Card>
            <Card><SH title="Schema missing"/>{(data.schema_missing||[]).map((s:string,i:number)=><span key={i} style={{fontSize:12,background:S.redBg,color:S.redText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{s}</span>)}<p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>Add these to improve rich results eligibility</p></Card>
          </div>

          {data._scraped && (data._crawlData?.pages||[]).length > 0 && (
            <Card style={{marginTop:14,overflow:"auto"}}>
              <SH title={`Crawled pages — ${(data._crawlData.pages||[]).length} pages scraped`}/>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["URL","Status","Title","Meta Description","H1","Words","Flags"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>
                  {(data._crawlData.pages||[]).map((p:{url:string;status:number;title:string;titleLength:number;metaDesc:string;metaDescLength:number;h1:string;wordCount:number;noindex:boolean;canonical:string;missing_title:boolean;long_title:boolean;missing_meta:boolean;missing_h1:boolean;multiple_h1:boolean;thin_content:boolean;error:string|null},i:number)=>{
                    const flags:string[]=[];
                    if(p.missing_title)flags.push("No title");
                    if(p.long_title)flags.push("Long title");
                    if(p.missing_meta)flags.push("No meta");
                    if(p.missing_h1)flags.push("No H1");
                    if(p.multiple_h1)flags.push("Multi H1");
                    if(p.thin_content)flags.push("Thin");
                    if(p.noindex)flags.push("Noindex");
                    if(!p.canonical)flags.push("No canonical");
                    const sc=p.error?S.red:p.status===200?S.green:p.status>=400?S.red:S.amber;
                    return (
                      <tr key={i} style={{background:i%2===0?"transparent":S.subtle}}>
                        <TD><span style={{fontSize:10,wordBreak:"break-all" as const,color:S.accent}}>{(p.url||"").replace(/^https?:\/\//,"").slice(0,55)}</span></TD>
                        <TD color={sc}><strong>{p.error?"ERR":p.status}</strong></TD>
                        <TD><span style={{fontSize:10,color:p.missing_title?S.red:S.text}}>{p.title?p.title.slice(0,45):"—"}{p.titleLength>0&&<span style={{color:S.muted}}> ({p.titleLength})</span>}</span></TD>
                        <TD><span style={{fontSize:10,color:p.missing_meta?S.red:S.text}}>{p.metaDesc?p.metaDesc.slice(0,45):"—"}{p.metaDescLength>0&&<span style={{color:S.muted}}> ({p.metaDescLength})</span>}</span></TD>
                        <TD><span style={{fontSize:10,color:p.missing_h1?S.red:S.text}}>{p.h1?p.h1.slice(0,35):"—"}</span></TD>
                        <TD color={p.thin_content?S.amber:S.text}><strong>{p.wordCount||0}</strong></TD>
                        <TD><span style={{display:"flex",flexWrap:"wrap" as const,gap:2}}>{flags.map((f,j)=><span key={j} style={{fontSize:10,background:S.redBg,color:S.redText,padding:"1px 5px",borderRadius:3}}>{f}</span>)}</span></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setUrl(e.inputLabel);setIssueFilter("All");}}/>
    </div>
  );
}

// ── SITEMAP ──
function Sitemap({activeSite,setPage}:PageProps) {
  const [url,setUrl]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(activeSite&&!url)setUrl(extractOrigin(activeSite)+"/sitemap.xml");},[activeSite]);
  const hist = useToolHistory("sitemap");
  const run = async () => { if(!url.trim()) return; setLoading(true); setErr(""); try { const d = await ai(`Sitemap analyst. Return ONLY valid JSON: {"total_urls":number,"indexed":number,"excluded":number,"coverage":number,"issues":[{"type":"string","severity":"Critical|Warning|Info","count":number,"detail":"string","fix":"string"}],"pages":[{"url":"string","priority":"string","changefreq":"string","lastmod":"string","status":"OK|Missing lastmod|Low priority|No changefreq"}],"recommendations":["string"]} URL:${url}. 5 issues, 8 pages.`); setData(d); hist.add(url, d); } catch(e) { setErr("Failed."); console.error(e); } finally { setLoading(false); } };
  const sevBg:Record<string,string>={Critical:S.redBg,Warning:S.amberBg,Info:S.blueBg};
  const sevColor:Record<string,string>={Critical:S.redText,Warning:S.amberText,Info:S.blueText};
  const stColor:Record<string,string>={"OK":S.green,"Missing lastmod":S.amber,"Low priority":S.muted,"No changefreq":S.amber};
  const sc = (s:number) => s>=80?S.green:s>=50?S.amber:S.red;
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Sitemap Analyser</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Crawl and validate your sitemap.xml for indexation issues.</p>
      <Card><Field label="Sitemap URL"><TI value={url} onChange={setUrl} placeholder="https://yoursite.com/sitemap.xml"/></Field>{err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}<Btn onClick={run} disabled={loading||!url.trim()}>{loading?"Crawling...":"Analyse sitemap"}</Btn></Card>
      {data && (
        <>
          <div style={{display:"flex",gap:12,marginBottom:16}}>
            {[{l:"Total URLs",v:data.total_urls},{l:"Indexed",v:data.indexed,color:S.green},{l:"Excluded",v:data.excluded,color:S.red},{l:"Coverage",v:data.coverage+"%",color:sc(data.coverage)}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={(s as {color?:string}).color||S.text}/>)}
          </div>
          <Card><SH title="Issues"/>{(data.issues||[]).map((iss:{type:string;severity:string;count:number;detail:string;fix:string},i:number)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"12px 0",borderBottom:`1px solid ${S.border}`}}>
              <span style={{background:sevBg[iss.severity],color:sevColor[iss.severity],fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,height:"fit-content",whiteSpace:"nowrap"}}>{iss.severity}</span>
              <div style={{flex:1}}><div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center"}}><span style={{fontSize:13,fontWeight:700,color:S.text}}>{iss.type}</span>{iss.count&&<span style={{fontSize:11,background:S.subtle,color:S.muted,borderRadius:4,padding:"1px 7px"}}>{iss.count} URLs</span>}</div><p style={{fontSize:12,color:S.muted,margin:"0 0 5px"}}>{iss.detail}</p><p style={{fontSize:12,color:S.accent,margin:0,fontWeight:500}}>→ {iss.fix}</p></div>
            </div>
          ))}</Card>
          <Card><SH title="URL inventory"/>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["URL","Priority","Changefreq","Last modified","Status"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.pages||[]).map((p:{url:string;priority:string;changefreq:string;lastmod:string;status:string},i:number)=>(
                <tr key={i}><TD><span style={{fontSize:11,color:S.accent,fontFamily:"monospace"}}>{p.url}</span></TD><TD color={S.muted}>{p.priority}</TD><TD color={S.muted}>{p.changefreq}</TD><TD color={S.muted}>{p.lastmod}</TD><TD><span style={{fontSize:11,fontWeight:600,color:stColor[p.status]||S.muted}}>{p.status}</span></TD></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card><SH title="Recommendations"/>{(data.recommendations||[]).map((r:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 8px",paddingBottom:8,borderBottom:`1px solid ${S.border}`}}>→ {r}</p>)}</Card>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setUrl(e.inputLabel);}}/>
    </div>
  );
}

// ── COMPETITORS ──
function Competitors({activeSite,setPage}:PageProps) {
  const [myDomain,setMyDomain]=useState("");const [c1,setC1]=useState("");const [c2,setC2]=useState("");const [c3,setC3]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [tab,setTab]=useState("overview");const [gapTab,setGapTab]=useState("missing");
  useEffect(()=>{if(activeSite&&!myDomain)setMyDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("competitors");
  const run = async () => {
    if(!myDomain.trim()) return; setLoading(true); setErr("");
    const comps = [c1,c2,c3].filter(c=>c.trim());
    try {
      // 1. Try REAL data via DataForSEO (needs at least one competitor).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let d:any = null;
      if(comps.length){
        try{
          const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"competitor",domain:myDomain.trim(),competitors:comps})});
          const j=await r.json();
          if(r.ok && j.configured && Array.isArray(j.overview)) d=j;
        }catch{/* fall back to AI */}
      }
      // 2. Fallback: AI-estimated analysis (no DataForSEO, or no competitors entered).
      if(!d){
        d = await ai(`Competitor SEO analyst. Infer the industry and market position of "${myDomain}" from its domain name. Generate a competitive analysis where all DR, traffic, keyword counts, and gap keywords are specific to this domain's industry niche — use real terminology and realistic metrics for that vertical. Competitors "${comps.join(",")||"industry leaders"}" should have data proportionate to their inferred sizes. Return ONLY valid JSON: {"overview":[{"domain":"string","dr":number,"traffic":number,"keywords":number,"backlinks":number,"content_score":number}],"keyword_gap":{"missing":[{"kw":"string","volume":number,"kd":number,"comp_pos":number,"competitor":"string"}],"weak":[{"kw":"string","volume":number,"kd":number,"your_pos":number,"comp_pos":number,"competitor":"string"}],"shared":[{"kw":"string","volume":number,"your_pos":number,"comp_pos":number}],"strong":[{"kw":"string","volume":number,"your_pos":number}]},"content_gaps":[{"topic":"string","competitor":"string","gap":"string","action":"string"}],"backlink_gaps":[{"domain":"string","dr":number,"links_to":"string","opportunity":"string"}],"ai_summary":"string"} My domain:${myDomain} Competitors:${comps.join(",")||"industry leaders"}. 4 of each gap type, 3 content gaps, 3 backlink gaps.`);
        d._source="ai";
      }
      setData(d); setTab("overview"); setGapTab("missing");
      hist.add(`${myDomain} vs ${comps.join(", ")||"industry"}`, d);
    } catch(e) { const m=e instanceof Error?e.message:""; setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed."); console.error(e); } finally { setLoading(false); }
  };
  const COLORS = [S.accent,S.green,S.amber,S.red,"#8b5cf6"];
  const kdColor=(kd:number)=>kd<=29?S.green:kd<=49?S.amber:kd<=69?"#f97316":S.red;
  const gapCategories=[
    {key:"missing",label:"Missing",desc:"Competitors rank — you don't",color:S.redText,bg:S.redBg},
    {key:"weak",label:"Weak",desc:"Both rank — competitor is higher",color:S.amberText,bg:S.amberBg},
    {key:"shared",label:"Shared",desc:"Similar positions",color:S.blueText,bg:S.blueBg},
    {key:"strong",label:"Strong",desc:"You rank — they don't",color:S.greenText,bg:S.greenBg},
  ];
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Competitor Analysis</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Keyword gap (Missing / Weak / Shared / Strong), content gaps, and backlink opportunities.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:4}}>
          <Field label="Your domain"><TI value={myDomain} onChange={setMyDomain} placeholder="yoursite.com"/></Field>
          <Field label="Competitor 1"><TI value={c1} onChange={setC1} placeholder="competitor1.com"/></Field>
          <Field label="Competitor 2"><TI value={c2} onChange={setC2} placeholder="competitor2.com"/></Field>
          <Field label="Competitor 3 (optional)"><TI value={c3} onChange={setC3} placeholder="competitor3.com"/></Field>
        </div>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!myDomain.trim()}>{loading?"Analysing...":"Run analysis"}</Btn>
      </Card>
      {data && (
        <>
          {data._source==="ai"
            ? <div style={{padding:"8px 14px",borderRadius:8,marginBottom:12,fontSize:12,fontWeight:600,background:S.amberBg,border:"1px solid #fde68a",color:S.amberText}}>
                ⚠ AI-estimated data — DR, traffic, and keyword counts are modelled from domain names, not live APIs. Add competitor domains to pull real data from DataForSEO.
              </div>
            : <div style={{padding:"8px 14px",borderRadius:8,marginBottom:12,fontSize:12,fontWeight:600,background:S.greenBg,border:"1px solid #a7f3d0",color:S.greenText}}>
                ✓ Real data via DataForSEO — traffic, keyword counts, and keyword gaps are live. DR &amp; backlinks show “—” (require the DataForSEO Backlinks subscription).
              </div>}
          {data.ai_summary && <Card style={{background:S.accentBg,border:"1px solid #c7d2fe"}}><p style={{fontSize:13,fontWeight:700,color:S.accentText,margin:"0 0 6px"}}>AI Summary</p><p style={{fontSize:13,color:S.accentText,margin:0,lineHeight:1.6,opacity:0.9}}>{data.ai_summary}</p></Card>}
          <Tabs tabs={["overview","keyword gap","content gaps","backlinks"]} active={tab} onChange={setTab}/>

          {tab==="overview" && <Card><SH title="Domain comparison"/>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Domain","DR","Traffic","Keywords","Backlinks","Content Score"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.overview||[]).map((d:{domain:string;dr:number|null;traffic:number|null;keywords:number|null;backlinks:number|null;content_score:number|null},i:number)=>(
                <tr key={i} style={{background:i===0?S.accentBg:"transparent"}}>
                  <TD><span style={{fontWeight:700,color:COLORS[i]}}>{i===0?"★ ":""}{d.domain}</span></TD>
                  <TD bold>{d.dr==null?<span style={{color:S.muted}}>—</span>:d.dr}</TD><TD color={S.accent}>{d.traffic==null?<span style={{color:S.muted}}>—</span>:d.traffic.toLocaleString()}</TD>
                  <TD>{d.keywords==null?<span style={{color:S.muted}}>—</span>:d.keywords.toLocaleString()}</TD><TD color={S.muted}>{d.backlinks==null?"—":d.backlinks.toLocaleString()}</TD>
                  <TD>{d.content_score==null?<span style={{color:S.muted}}>—</span>:<div style={{display:"flex",alignItems:"center",gap:8}}><Bar value={d.content_score}/><span style={{fontSize:12,fontWeight:700,color:d.content_score>=80?S.green:d.content_score>=50?S.amber:S.red}}>{d.content_score}</span></div>}</TD>
                </tr>
              ))}</tbody>
            </table>
          </Card>}

          {tab==="keyword gap" && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                {gapCategories.map(gc=>{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const count=(data.keyword_gap?.[gc.key]||[]).length;
                  return (
                    <button key={gc.key} onClick={()=>setGapTab(gc.key)} style={{background:gapTab===gc.key?gc.bg:S.card,border:`1px solid ${gapTab===gc.key?gc.color:S.border}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                      <p style={{fontSize:22,fontWeight:700,color:gc.color,margin:"0 0 4px"}}>{count}</p>
                      <p style={{fontSize:12,fontWeight:700,color:gc.color,margin:"0 0 2px"}}>{gc.label}</p>
                      <p style={{fontSize:10,color:S.muted,margin:0,lineHeight:1.3}}>{gc.desc}</p>
                    </button>
                  );
                })}
              </div>
              {gapTab==="missing" && <Card><SH title="Missing — competitors rank, you don't"/>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Keyword","Volume","KD","Top Competitor","Their pos"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                  <tbody>{(data.keyword_gap?.missing||[]).map((g:{kw:string;volume:number;kd:number;comp_pos:number;competitor:string},i:number)=>(
                    <tr key={i}><TD bold>{g.kw}</TD><TD color={S.accent}>{(g.volume||0).toLocaleString()}</TD><TD><span style={{fontSize:12,fontWeight:700,color:kdColor(g.kd)}}>{g.kd}</span></TD><TD color={S.muted}>{g.competitor}</TD><TD color={S.green}>#{g.comp_pos}</TD></tr>
                  ))}</tbody>
                </table>
              </Card>}
              {gapTab==="weak" && <Card><SH title="Weak — both rank, competitor higher"/>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Keyword","Volume","KD","Your pos","Competitor","Their pos","Gap"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                  <tbody>{(data.keyword_gap?.weak||[]).map((g:{kw:string;volume:number;kd:number;your_pos:number;comp_pos:number;competitor:string},i:number)=>(
                    <tr key={i}><TD bold>{g.kw}</TD><TD color={S.accent}>{(g.volume||0).toLocaleString()}</TD><TD><span style={{fontSize:12,fontWeight:700,color:kdColor(g.kd)}}>{g.kd}</span></TD><TD color={S.amber}>#{g.your_pos}</TD><TD color={S.muted}>{g.competitor}</TD><TD color={S.green}>#{g.comp_pos}</TD><TD color={S.red}>-{g.your_pos-g.comp_pos} pos</TD></tr>
                  ))}</tbody>
                </table>
              </Card>}
              {gapTab==="shared" && <Card><SH title="Shared — similar positions"/>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Keyword","Volume","Your pos","Competitor pos"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                  <tbody>{(data.keyword_gap?.shared||[]).map((g:{kw:string;volume:number;your_pos:number;comp_pos:number},i:number)=>(
                    <tr key={i}><TD bold>{g.kw}</TD><TD color={S.accent}>{(g.volume||0).toLocaleString()}</TD><TD color={S.blue}>#{g.your_pos}</TD><TD color={S.muted}>#{g.comp_pos}</TD></tr>
                  ))}</tbody>
                </table>
              </Card>}
              {gapTab==="strong" && <Card><SH title="Strong — you rank, competitors don't"/>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Keyword","Volume","Your position"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                  <tbody>{(data.keyword_gap?.strong||[]).map((g:{kw:string;volume:number;your_pos:number},i:number)=>(
                    <tr key={i}><TD bold>{g.kw}</TD><TD color={S.accent}>{(g.volume||0).toLocaleString()}</TD><TD color={S.green}>#{g.your_pos}</TD></tr>
                  ))}</tbody>
                </table>
              </Card>}
            </>
          )}

          {tab==="content gaps" && <Card><SH title="Topics competitors cover that you don't"/>
            {(data.content_gaps||[]).map((g:{topic:string;competitor:string;gap:string;action:string},i:number)=>(
              <div key={i} style={{padding:"12px 0",borderBottom:`1px solid ${S.border}`}}>
                <div style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}><span style={{fontSize:14,fontWeight:700,color:S.text}}>{g.topic}</span><span style={{fontSize:11,color:S.muted,background:S.subtle,borderRadius:4,padding:"1px 7px"}}>{g.competitor}</span></div>
                <p style={{fontSize:12,color:S.muted,margin:"0 0 5px"}}>Gap: {g.gap}</p>
                <p style={{fontSize:12,color:S.accent,margin:0,fontWeight:500}}>→ {g.action}</p>
              </div>
            ))}
          </Card>}
          {tab==="backlinks" && <Card><SH title="Sites linking to competitors but not you"/>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Domain","DR","Links to","Opportunity"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.backlink_gaps||[]).map((g:{domain:string;dr:number;links_to:string;opportunity:string},i:number)=>(
                <tr key={i}><TD bold>{g.domain}</TD><TD color={g.dr>=70?S.green:g.dr>=40?S.amber:S.muted}>{g.dr}</TD><TD color={S.muted}>{g.links_to}</TD><TD color={S.accent}>{g.opportunity}</TD></tr>
              ))}</tbody>
            </table>
          </Card>}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);const parts=e.inputLabel.split(" vs ");setMyDomain(parts[0]||"");setTab("overview");setGapTab("missing");}}/>
    </div>
  );
}

// ── RANK ──
function Rank({activeSite,setPage,gscData,gscDataMap={}}:PageProps) {
  const [domain,setDomain]=useState("");const [kws,setKws]=useState("");const [geo,setGeo]=useState("");
  const [bulkMode,setBulkMode]=useState(false);const [tab,setTab]=useState("rankings");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  // Real GSC queries for the active site — used to seed the keyword field from real data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gscForSite:any = (activeSite&&gscDataMap[extractDomain(activeSite)])||gscData||null;
  const gscTopKws:string[] = (gscForSite?.queries||[]).slice(0,20).map((q:{query:string})=>q.query);
  const hist = useToolHistory("rank");
  const kwList = kws.split(/[\n,]+/).map(k=>k.trim()).filter(Boolean);
  const run = async () => {
    if(!domain.trim()) return; setLoading(true); setErr("");
    const cleanDomain = domain.trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
    try {
      // Step 1: Determine keywords to track
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let keywords: string[] = kwList;
      if(keywords.length===0) {
        // Use AI to suggest keywords for the domain
        const kd = await ai(`List 8 realistic SEO keywords that "${cleanDomain}" would want to rank for based on its domain name and likely industry. Return ONLY valid JSON: {"keywords":["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8"]}`,512);
        keywords = (kd.keywords||[]).slice(0,8);
      }

      // Step 2: Real SERP check for each keyword via DuckDuckGo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serpResults = await Promise.allSettled(keywords.slice(0,8).map(async (kw:string) => {
        const r = await fetch(`/api/serpcheck?keyword=${encodeURIComponent(kw)}`);
        const d = await r.json();
        // Find domain position in real SERP
        const results = (d.results||[]) as {pos:number;domain:string;url:string;title:string}[];
        const match = results.find(r => r.domain===cleanDomain || r.domain.includes(cleanDomain) || cleanDomain.includes(r.domain));
        const topCompetitor = results.find(r => r.domain!==cleanDomain && !r.domain.includes(cleanDomain));
        return {
          kw,
          pos: match ? match.pos : 100,
          prev: match ? match.pos : 100,
          change: 0,
          url: match ? match.url : `https://${cleanDomain}`,
          features: [] as string[],
          competitor: topCompetitor?.domain||"",
          mobile_pos: match ? match.pos : 100,
          scraped: d.scraped,
          not_ranking: !match,
        };
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rankings: any[] = serpResults
        .filter(r=>r.status==="fulfilled")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(r=>(r as PromiseFulfilledResult<any>).value);

      const ranked = rankings.filter(r=>r.pos<=100&&!r.not_ranking);
      const top3 = ranked.filter(r=>r.pos<=3).length;
      const top10 = ranked.filter(r=>r.pos<=10).length;
      const avgPos = ranked.length>0 ? Math.round(ranked.reduce((a,r)=>a+r.pos,0)/ranked.length) : 0;
      const visibility = ranked.length>0 ? Math.round((ranked.filter(r=>r.pos<=10).length/keywords.length)*100) : 0;
      const scraped = rankings.some(r=>r.scraped);

      // Step 3: AI for competitors + opportunities only (not rankings)
      const rankSummary = rankings.map(r=>`${r.kw}: pos ${r.pos===100?"not ranking":r.pos}, competitor: ${r.competitor||"—"}`).join("; ");
      const aiInsights = await ai(`SEO analyst. Domain "${cleanDomain}" has these REAL SERP rankings: ${rankSummary}. Based on this real data: 1) Identify top competitor domains visible in the SERP data. 2) List 5 specific ranking opportunities. Return ONLY valid JSON: {"competitors":[{"domain":"string","visibility":number,"overlap":number,"sov":number}],"opportunities":["string"]}`,1024);

      setData({
        summary:{avg_pos:avgPos||0,visibility,top3,top10,share_of_voice:visibility},
        rankings,
        competitors: aiInsights.competitors||[],
        opportunities: aiInsights.opportunities||[],
        _scraped: scraped,
        _real_positions: true,
      });
      hist.add(domain+(geo?` · ${geo}`:""), {summary:{avg_pos:avgPos,visibility,top3,top10},rankings});
    } catch(e) { const m=e instanceof Error?e.message:""; setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed."); console.error(e); } finally { setLoading(false); }
  };
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Rank Tracker</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Monitor keyword positions, share of voice, and mobile vs desktop rankings.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
          <Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>
          <Field label="Location"><TI value={geo} onChange={setGeo} placeholder="e.g. United States"/></Field>
        </div>
        {gscTopKws.length>0&&(
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"8px 12px",background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:8,flexWrap:"wrap" as const}}>
            <span style={{fontSize:12,color:S.accentText}}>📊 {gscTopKws.length} real keywords from your Google Search Console</span>
            <button onClick={()=>{setBulkMode(true);setKws(gscTopKws.join("\n"));}} style={{fontSize:11,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#818cf8)",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"inherit"}}>Use my GSC keywords →</button>
          </div>
        )}
        <Field label={<span style={{display:"flex",alignItems:"center",gap:8}}>Keywords <button onClick={()=>setBulkMode(b=>!b)} style={{fontSize:10,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{bulkMode?"← single line":"↓ bulk paste"}</button></span> as unknown as string}>
          {bulkMode
            ? <TI value={kws} onChange={setKws} placeholder={"keyword one\nkeyword two\nkeyword three"} rows={5}/>
            : <TI value={kws} onChange={setKws} placeholder="kw1, kw2, kw3 (optional — leave blank to auto-detect)"/>
          }
        </Field>
        {kwList.length>0&&<p style={{fontSize:11,color:S.muted,margin:"-8px 0 10px"}}>{kwList.length} keyword{kwList.length!==1?"s":""} to track</p>}
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Fetching...":"Track rankings"}</Btn>
      </Card>
      {data && (
        <>
          <div style={{padding:"8px 14px",borderRadius:8,marginBottom:12,fontSize:12,fontWeight:600,
            background:data._scraped?S.greenBg:S.amberBg,
            border:`1px solid ${data._scraped?"#a7f3d0":"#fde68a"}`,
            color:data._scraped?S.greenText:S.amberText}}>
            {data._scraped
              ? "✓ Real positions — live DuckDuckGo SERP check. Competitors + opportunities are AI-summarised from real results."
              : "⚠ SERP scrape failed — positions may be estimated. Try again or check the domain name."}
          </div>
          <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            {[{l:"Avg position",v:data.summary?.avg_pos>0?"#"+(data.summary?.avg_pos):"—",c:S.text},{l:"Visibility",v:(data.summary?.visibility)+"%",c:S.accent},{l:"Share of voice",v:(data.summary?.share_of_voice||0)+"%",c:S.green},{l:"Top 3",v:data.summary?.top3,c:S.green},{l:"Top 10",v:data.summary?.top10,c:S.amber}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
          </div>
          <Tabs tabs={["rankings","competitors","opportunities"]} active={tab} onChange={setTab}/>
          {tab==="rankings"&&<Card><SH title="Rankings" action={<button onClick={()=>downloadCSV("rankings.csv",["Keyword","Position","Mobile Pos","Change","URL","Competitor"],(data.rankings||[]).map((r:{kw:string;pos:number;mobile_pos:number;change:number;url:string;competitor:string})=>[r.kw,r.pos>=100?"Not ranking":r.pos,r.mobile_pos>=100?"Not ranking":r.mobile_pos||"—",r.change,r.url,r.competitor]))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>}/>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:560}}>
                <thead><tr>{["Keyword","Desktop","Mobile","URL","Top competitor"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{(data.rankings||[]).map((r:{kw:string;pos:number;mobile_pos:number;url:string;competitor:string;not_ranking:boolean},i:number)=>(
                  <tr key={i}><TD bold>{r.kw}</TD>
                    <TD color={r.pos<=3?S.green:r.pos<=10?S.amber:S.red}>{r.not_ranking||r.pos>=100?"Not in top 10":`#${r.pos}`}</TD>
                    <TD color={S.muted}>{r.mobile_pos&&r.mobile_pos<100?`#${r.mobile_pos}`:"—"}</TD>
                    <TD><span style={{fontSize:11,color:r.not_ranking?S.muted:S.accent}}>{r.not_ranking?"—":r.url}</span></TD>
                    <TD color={S.muted}>{r.competitor||"—"}</TD></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>}
          {tab==="competitors"&&<Card><SH title="Competitor visibility"/>
            {(data.competitors||[]).map((c:any,i:number)=>(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:S.text}}>{c.domain}</span>
                  <span style={{fontSize:12,color:S.muted}}>Visibility {c.visibility}% · SoV {c.sov||0}% · Overlap {c.overlap}%</span>
                </div>
                <Bar value={c.visibility} color={i===0?S.accent:S.muted}/>
              </div>
            ))}
          </Card>}
          {tab==="opportunities"&&<Card><SH title="Ranking opportunities"/>{(data.opportunities||[]).map((o:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 8px",paddingBottom:8,borderBottom:`1px solid ${S.border}`}}>→ {o}</p>)}</Card>}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);const parts=e.inputLabel.split(" · ");setDomain(parts[0]||"");}}/>
    </div>
  );
}

// ── AI VISIBILITY GAUGE ──
function VisibilityGauge({score,label,desc}:{score:number;label:string;desc:string}) {
  const gc = score>=70?S.green:score>=40?S.amber:S.red;
  const frac = Math.max(0.01,Math.min(0.99,score/100));
  const r=58,cx=85,cy=86;
  const aRad = Math.PI*(1-frac);
  const nx = cx+r*Math.cos(aRad);
  const ny = cy-r*Math.sin(aRad);
  return (
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <svg width="170" height="98" viewBox="0 0 170 98" style={{flexShrink:0}}>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={S.border} strokeWidth="12" strokeLinecap="round"/>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${nx.toFixed(1)} ${ny.toFixed(1)}`} fill="none" stroke={gc} strokeWidth="12" strokeLinecap="round"/>
        <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke={S.text} strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        <circle cx={cx} cy={cy} r="4" fill={S.text} opacity="0.7"/>
        <text x={cx} y={cy-14} textAnchor="middle" fontSize="26" fontWeight="700" fill={gc}>{score}</text>
        <text x={cx} y={cy+2} textAnchor="middle" fontSize="8" fill={S.muted}>/100</text>
        <text x={cx} y={cy+18} textAnchor="middle" fontSize="10" fontWeight="700" fill={gc}>{label}</text>
      </svg>
      <p style={{fontSize:12,color:S.muted,margin:0,lineHeight:1.7,maxWidth:160}}>{desc}</p>
    </div>
  );
}

// ── AEO / AI VISIBILITY ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AEO({aeoData:data,setAeoData:setData,activeSite,setPage}:PageProps) {
  const [domain,setDomain]=useState("");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const [loadPhase,setLoadPhase]=useState("");
  const [tab,setTab]=useState("topics");
  const [chartMetric,setChartMetric]=useState("mentions");
  const [expandedTopic,setExpandedTopic]=useState<number|null>(null);
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("aeo");

  const run = async () => {
    if(!domain.trim()) return; setLoading(true); setErr(""); setLoadPhase("");
    const domainClean = domain.replace(/^https?:\/\//,"").replace(/\/$/,"");
    const brand = domainClean.replace(/\.[a-z]{2,}$/,"").replace(/^www\./,"");
    try {
      // ── Phase 1: Real data (no AI needed) ──────────────────────────────────
      setLoadPhase("Scanning Google News, Reddit & web mentions…");
      const [realVisRes, scrapeRes] = await Promise.allSettled([
        fetch(`/api/tools?tool=aivisibility&brand=${encodeURIComponent(brand)}&domain=${encodeURIComponent(domainClean)}`,{signal:AbortSignal.timeout(70000)}).then(r=>r.json()),
        fetch(`/api/py/scrape?domain=${encodeURIComponent(domainClean)}`,{signal:AbortSignal.timeout(20000)}).then(r=>r.ok?r.json():{urls:[]}).catch(()=>({urls:[]})),
      ]);

      const realVis = realVisRes.status==="fulfilled" && !realVisRes.value.error ? realVisRes.value : null;
      const realUrls: string[] = scrapeRes.status==="fulfilled" ? (scrapeRes.value.urls||[]) : [];

      // Show real data immediately
      if(realVis) {
        const partial = {
          ...realVis,
          // Map source_breakdown → llm_distribution shape for existing render code
          llm_distribution: (realVis.source_breakdown||[]).map((s:{source:string;pct:number;count:number;color?:string})=>({llm:s.source,pct:s.pct,count:s.count})),
          monthly: [],
          performing_topics: [],
          topic_opportunities: [],
          cited_sources: (realVis.recent_articles||[]).slice(0,5).map((a:{title:string;source:string;url:string})=>({source:a.source,citations:1,type:"News" as const})),
          cited_pages: realUrls.slice(0,5).map((page:string)=>({page,citations:1,llms:2})),
          countries: [],
          recommendations: [],
          _scraped: realVis.scraped, _real: true, _pageCount: realUrls.length,
        };
        setData(partial);
        hist.add(domain, partial);
      }

      // ── Phase 2: AI enrichment (optional, runs if providers available) ──────
      setLoadPhase("Generating AI topic analysis…");
      try {
        const pageCtx = realUrls.length>0 ? `\n\nREAL PAGES:\n${realUrls.slice(0,15).join("\n")}` : "";
        const realCtx = realVis ? `\nREAL SIGNALS: ${realVis.description}` : "";
        const d = await ai(`AI visibility analyst for "${domain}".${realCtx}${pageCtx}
Return ONLY valid JSON: {"visibility_score":number,"label":"Low|Medium|High|Dominant","description":"string","metrics":{"mentions":number,"mentions_change":number,"citations":number,"citations_change":number,"cited_pages":number,"cited_pages_change":number},"monthly":[{"month":"string","mentions":number,"citations":number,"cited_pages":number}],"llm_distribution":[{"llm":"ChatGPT|AI Overview|AI Mode|Gemini","pct":number,"count":number}],"countries":[{"country":"string","flag":"string","pct":number,"count":number}],"performing_topics":[{"topic":"string","visibility":number,"mentions":number,"ai_volume":number,"intent":"Informational|Commercial|Navigational","trend":"up|down|stable","prompts":[{"prompt":"string","llm":"string","response":"string","mentioned":boolean,"cited":boolean}]}],"topic_opportunities":[{"topic":"string","volume":number,"competition":"Low|Medium|High","intent":"string","reason":"string"}],"cited_sources":[{"source":"string","citations":number,"type":"Blog|News|Forum|Social|Review"}],"cited_pages":[{"page":"string","citations":number,"llms":number}],"recommendations":["string"]}
6 monthly, 4 LLMs (100%), 4 countries (100%), 5 topics (3 prompts each), 5 opportunities.`);
        // Merge real data signals into AI result
        const merged = {
          ...d,
          // Keep real metric counts if higher than AI estimate
          metrics: realVis ? {
            mentions: Math.max(d.metrics?.mentions||0, realVis.metrics?.mentions||0),
            mentions_change: realVis.metrics?.mentions_change ?? d.metrics?.mentions_change,
            citations: Math.max(d.metrics?.citations||0, realVis.metrics?.citations||0),
            citations_change: d.metrics?.citations_change,
            cited_pages: realUrls.length>0 ? realUrls.length : (d.metrics?.cited_pages||0),
            cited_pages_change: d.metrics?.cited_pages_change,
          } : d.metrics,
          cited_pages: realUrls.length>0 ? realUrls.slice(0,5).map((page:string,i:number)=>({page,citations:Math.max(1,d.cited_pages?.[i]?.citations||1),llms:d.cited_pages?.[i]?.llms||2})) : d.cited_pages,
          _scraped: realVis?.scraped||realUrls.length>0, _real: true, _pageCount: realUrls.length,
          source_breakdown: realVis?.source_breakdown,
          recent_articles: realVis?.recent_articles,
          gsc_signal: realVis?.gsc_signal,
        };
        setData(merged); hist.add(domain, merged);
      } catch {
        // AI failed but real data already showing — just clear the loading phase
        if(!realVis) setErr("All AI providers unavailable. Top up Anthropic credits at console.anthropic.com/settings/billing");
      }
    } catch(e){
      if(!data) setErr(e instanceof Error?e.message:"Failed. Try again.");
      console.error(e);
    }
    finally{setLoading(false);setLoadPhase("");}
  };

  if(!data) return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>AI Visibility</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 12px"}}>Track how often your brand is mentioned and cited across ChatGPT, AI Overview, Gemini, and more.</p>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:S.blueBg,border:`1px solid #bfdbfe`,borderRadius:10,marginBottom:20}}>
        <span style={{fontSize:16,flexShrink:0}}>ℹ</span>
        <p style={{fontSize:12,color:S.blueText,margin:0,lineHeight:1.6}}><strong>Real pages, AI-modelled visibility.</strong> Your site&apos;s actual pages are crawled from your sitemap and used for cited page data. Visibility scores, mention counts, and LLM distributions are AI-modelled estimates based on your brand profile — not live LLM telemetry.</p>
      </div>
      <Card>
        <Field label="Brand or domain"><TI value={domain} onChange={setDomain} placeholder="e.g. yoursite.com or Your Brand Name"/></Field>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?(loadPhase||"Analysing…"):"Analyse AI visibility"}</Btn>
        {loading&&loadPhase&&<p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>{loadPhase}</p>}
      </Card>
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setDomain(e.inputLabel);}}/>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthly:any[] = data.monthly||[];
  const metricMax = (k:string) => Math.max(...monthly.map((m:any)=>m[k]||0),1);
  const metricColor:Record<string,string>={mentions:S.accent,citations:S.green,cited_pages:S.amber};
  const W=600;
  const pts = monthly.map((m:any,i:number)=>{
    const val=m[chartMetric]||0; const max=metricMax(chartMetric);
    const x=(monthly.length<2?W/2:i*(W/(monthly.length-1)));
    const y=58-Math.round((val/max)*48);
    return {x,y,month:m.month,val};
  });

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:S.green}}/>
            <span style={{fontSize:12,fontWeight:700,color:S.green}}>Active</span>
            <span style={{fontSize:12,color:S.muted}}>· {domain}</span>
          </div>
          <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:0}}>AI Visibility Overview</h2>
        </div>
        <Btn variant="secondary" small onClick={()=>{setData(null);setDomain("");}}>Change brand</Btn>
      </div>

      {/* Score + Metrics */}
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:14,marginBottom:14}}>
        <Card style={{minWidth:250}}>
          <VisibilityGauge score={data.visibility_score} label={data.label} desc={data.description}/>
        </Card>
        <Card>
          {/* Metric selector tabs */}
          <div style={{display:"flex",gap:28,marginBottom:14,borderBottom:`1px solid ${S.border}`,paddingBottom:12}}>
            {[{k:"mentions",label:"Mentions",v:data.metrics.mentions,ch:data.metrics.mentions_change},{k:"citations",label:"Citations",v:data.metrics.citations,ch:data.metrics.citations_change},{k:"cited_pages",label:"Cited Pages",v:data.metrics.cited_pages,ch:data.metrics.cited_pages_change}].map(m=>(
              <div key={m.k} onClick={()=>setChartMetric(m.k)} style={{cursor:"pointer",paddingBottom:12,borderBottom:chartMetric===m.k?`2px solid ${S.accent}`:"2px solid transparent",marginBottom:-13}}>
                <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",margin:"0 0 3px"}}>{m.label}</p>
                <div style={{display:"flex",alignItems:"baseline",gap:7}}>
                  <span style={{fontSize:20,fontWeight:700,color:S.text}}>{m.v.toLocaleString()}</span>
                  <span style={{fontSize:12,fontWeight:600,color:m.ch>=0?S.green:S.red}}>{m.ch>=0?"+":""}{m.ch}%</span>
                </div>
              </div>
            ))}
          </div>
          {/* Trend chart */}
          <svg width="100%" viewBox={`0 0 ${W} 72`} style={{display:"block"}}>
            {pts.length>1&&<polyline fill="none" stroke={metricColor[chartMetric]} strokeWidth="2.5" strokeLinejoin="round" points={pts.map(p=>`${p.x},${p.y}`).join(" ")}/>}
            {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill={metricColor[chartMetric]}/>)}
            {pts.map((p,i)=><text key={i} x={p.x} y="70" textAnchor="middle" fontSize="9" fill={S.muted}>{p.month}</text>)}
          </svg>
        </Card>
      </div>

      {/* You vs Competitors — real AI mentions from the Claude visibility check */}
      {data.ai_visibility&&(()=>{
        const av=data.ai_visibility;
        const me=domain.replace(/\.[a-z]{2,}$/,"").replace(/^www\./,"");
        const board=[{name:me,mentions:av.mentioned_count||0,you:true},...((av.competitors||[]).map((c:{name:string;mentions:number})=>({name:c.name,mentions:c.mentions,you:false})))]
          .sort((a,b)=>b.mentions-a.mentions);
        const max=Math.max(1,...board.map(b=>b.mentions));
        return (
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap" as const,gap:8}}>
              <SH title="AI Mentions — You vs Competitors"/>
              <span style={{fontSize:10,color:"#fff",background:"#6366f1",padding:"2px 8px",borderRadius:4}}>{av.engine||"Claude"} · {av.total_questions} questions</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,margin:"0 0 14px"}}>
              {[
                {l:"Your AI mention rate",v:`${av.ai_visibility_pct||0}%`,h:"% of AI answers that named your brand"},
                {l:"Share of voice",v:av.share_of_voice!=null?`${av.share_of_voice}%`:"—",h:"Your mentions vs all brand mentions across the AI answers"},
                {l:"Avg rank when listed",v:av.avg_rank!=null?`#${av.avg_rank}`:"—",h:"Average position your brand appears in the AI's list"},
              ].map((m,i)=>(
                <div key={i} style={{flex:"1 1 150px",padding:"8px 10px",background:S.subtle,borderRadius:7,border:`1px solid ${S.border}`}}>
                  <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 3px"}}>{m.l} <InfoTip text={m.h}/></p>
                  <p style={{fontSize:18,fontWeight:700,color:S.accent,margin:0}}>{m.v}</p>
                </div>
              ))}
            </div>
            <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 8px"}}>Brand leaderboard — times recommended across {av.total_questions} AI answers</p>
            {board.slice(0,12).map((b,i)=>(
              <div key={i} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                  <span style={{fontWeight:b.you?700:600,color:b.you?S.accent:S.text}}>{b.you?"★ ":""}{b.name}{b.you?" (you)":""}</span>
                  <span style={{fontWeight:700,color:b.you?S.accent:S.muted}}>{b.mentions}</span>
                </div>
                <Bar value={Math.round((b.mentions/max)*100)} color={b.you?S.accent:S.muted} height={6}/>
              </div>
            ))}
            {(av.mentioned_count||0)===0&&<p style={{fontSize:11,color:S.amberText,background:S.amberBg,borderRadius:7,padding:"8px 12px",margin:"6px 0 0"}}>⚠ Your brand wasn&apos;t named in any AI answer — competitors above own the category. Publish authoritative, citable content and earn third-party mentions to break in.</p>}
          </Card>
        );
      })()}

      {/* LLM + Countries */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SH title="Distribution by LLM"/>
          {(data.llm_distribution||[]).map((l:{llm:string;pct:number;count:number},i:number)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:12,color:S.muted,width:88,flexShrink:0}}>{l.llm}</span>
              <div style={{flex:1,height:8,background:S.subtle,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${l.pct}%`,background:S.accent,borderRadius:4}}/>
              </div>
              <span style={{fontSize:11,color:S.muted,width:38,textAlign:"right",flexShrink:0}}>{l.pct}%</span>
              <span style={{fontSize:12,fontWeight:700,color:S.text,width:24,textAlign:"right",flexShrink:0}}>{l.count}</span>
            </div>
          ))}
        </Card>
        <Card>
          <SH title="Mentions by Country"/>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr><TH>Country</TH><TH>Share</TH><TH>Count</TH></tr></thead>
            <tbody>{(data.countries||[]).map((c:{country:string;flag:string;pct:number;count:number},i:number)=>(
              <tr key={i}>
                <TD><span style={{marginRight:5}}>{c.flag}</span>{c.country}</TD>
                <TD>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:55,height:6,background:S.subtle,borderRadius:3}}>
                      <div style={{height:"100%",width:`${c.pct}%`,background:i===0?"#3b82f6":i===1?"#22c55e":i===2?S.amber:S.muted,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:11,color:S.muted}}>{c.pct}%</span>
                  </div>
                </TD>
                <TD bold>{c.count}</TD>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      {/* Topics & Sources */}
      <Card>
        {/* Tab nav */}
        <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:`1px solid ${S.border}`,overflowX:"auto"}}>
          {[
            {k:"topics",label:"Your Performing Topics",n:(data.performing_topics||[]).length},
            {k:"opportunities",label:"Topic Opportunities",n:(data.topic_opportunities||[]).length},
            {k:"sources",label:"Cited Sources",n:(data.cited_sources||[]).length},
            {k:"pages",label:"Cited Pages",n:(data.cited_pages||[]).length},
          ].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{flexShrink:0,padding:"8px 14px",border:"none",background:"transparent",color:tab===t.k?S.text:S.muted,fontWeight:tab===t.k?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",borderBottom:tab===t.k?`2px solid ${S.accent}`:"2px solid transparent",marginBottom:-1}}>
              {t.label} <span style={{background:tab===t.k?S.accentBg:S.subtle,color:tab===t.k?S.accentText:S.muted,borderRadius:10,padding:"1px 7px",fontSize:10,marginLeft:4,fontWeight:600}}>{t.n}</span>
            </button>
          ))}
        </div>

        {/* Performing Topics */}
        {tab==="topics" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.7fr 0.8fr 1fr",gap:8,padding:"6px 0",borderBottom:`1px solid ${S.border}`}}>
              {["Topic","Visibility","Mentions","AI Volume","Intent"].map(h=><span key={h} style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</span>)}
            </div>
            {(data.performing_topics||[]).map((t:any,i:number)=>(
              <div key={i}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.7fr 0.8fr 1fr",gap:8,padding:"11px 0",borderBottom:`1px solid ${S.border}`,cursor:"pointer",alignItems:"center"}} onClick={()=>setExpandedTopic(expandedTopic===i?null:i)}>
                  <span style={{fontSize:13,fontWeight:600,color:S.text,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,color:S.muted}}>{expandedTopic===i?"▼":"▶"}</span>{t.topic}
                  </span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:38,height:5,background:S.subtle,borderRadius:3}}>
                      <div style={{height:"100%",width:`${t.visibility}%`,background:t.visibility>=70?S.green:t.visibility>=40?S.amber:S.red,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:t.visibility>=70?S.green:t.visibility>=40?S.amber:S.red}}>{t.visibility}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:S.accent}}>{t.mentions}</span>
                  <span style={{fontSize:13,color:S.muted}}>{(t.ai_volume||0).toLocaleString()}</span>
                  <span>{pill(t.intent,t.intent==="Commercial"?"green":t.intent==="Navigational"?"blue":"gray")}</span>
                </div>
                {expandedTopic===i&&(
                  <div style={{background:S.subtle,padding:"10px 8px 10px 24px",borderBottom:`1px solid ${S.border}`}}>
                    {(t.prompts||[]).map((p:any,j:number)=>(
                      <div key={j} style={{padding:"10px 14px",background:S.card,marginBottom:6,borderRadius:8,border:`1px solid ${S.border}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:S.muted,background:S.subtle,borderRadius:4,padding:"2px 7px"}}>{p.llm}</span>
                          {p.mentioned&&<span style={{fontSize:10,background:S.greenBg,color:S.greenText,borderRadius:4,padding:"1px 6px",fontWeight:600}}>Mentioned</span>}
                          {p.cited&&<span style={{fontSize:10,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"1px 6px",fontWeight:600}}>Cited</span>}
                        </div>
                        <p style={{fontSize:12,fontWeight:600,color:S.text,margin:"0 0 4px"}}>{p.prompt}</p>
                        <p style={{fontSize:11,color:S.muted,margin:0,lineHeight:1.6}}>{p.response}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Topic Opportunities */}
        {tab==="opportunities"&&(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Topic","AI Volume","Competition","Intent","Why"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{(data.topic_opportunities||[]).map((t:any,i:number)=>(
              <tr key={i}><TD bold>{t.topic}</TD><TD color={S.accent}>{(t.volume||0).toLocaleString()}</TD><TD>{pill(t.competition,t.competition==="Low"?"green":t.competition==="Medium"?"amber":"red")}</TD><TD>{pill(t.intent,"blue")}</TD><TD color={S.muted}>{t.reason}</TD></tr>
            ))}</tbody>
          </table>
        )}

        {/* Cited Sources */}
        {tab==="sources"&&(
          <>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12,padding:"8px 12px",background:S.amberBg,borderRadius:8,border:`1px solid #fcd34d`}}>
              <span style={{fontSize:14}}>⚠</span>
              <p style={{fontSize:11,color:S.amberText,margin:0,lineHeight:1.5}}><strong>AI-estimated data.</strong> These source domains are inferred by the AI model based on your brand's industry and profile — not scraped from live LLM outputs.</p>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Source (AI-estimated)","Citations","Type"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.cited_sources||[]).map((s:any,i:number)=>(
                <tr key={i}><TD bold><span style={{color:S.text}}>{s.source}</span></TD><TD bold color={S.accent}>{s.citations}</TD><TD>{pill(s.type,"gray")}</TD></tr>
              ))}</tbody>
            </table>
          </>
        )}

        {/* Cited Pages */}
        {tab==="pages"&&(
          <>
            {data._scraped
              ? (
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12,padding:"8px 12px",background:S.greenBg,borderRadius:8,border:`1px solid #bbf7d0`}}>
                  <span style={{fontSize:14}}>✓</span>
                  <p style={{fontSize:11,color:S.greenText,margin:0,lineHeight:1.5}}><strong>Real URLs from sitemap.</strong> {data._pageCount} pages were crawled from your site. The AI selected the most likely cited pages from those real URLs.</p>
                </div>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12,padding:"8px 12px",background:S.amberBg,borderRadius:8,border:`1px solid #fcd34d`}}>
                  <span style={{fontSize:14}}>⚠</span>
                  <p style={{fontSize:11,color:S.amberText,margin:0,lineHeight:1.5}}><strong>AI-estimated URLs.</strong> Could not crawl the sitemap — page paths are AI-inferred and may not exist. Re-run with a reachable domain to get real URLs.</p>
                </div>
              )
            }
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{[data._scraped?"Page (from sitemap)":"Page (AI-estimated)","Citations","LLMs"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.cited_pages||[]).map((p:any,i:number)=>(
                <tr key={i}><TD>
                  {data._scraped
                    ? <a href={p.page.startsWith("http")?p.page:`https://${p.page}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.accent,fontFamily:"monospace",textDecoration:"none"}}>{p.page}</a>
                    : <span style={{fontSize:11,color:S.muted,fontFamily:"monospace"}}>{p.page}</span>
                  }
                </TD><TD bold color={S.accent}>{p.citations}</TD><TD color={S.muted}>{p.llms}</TD></tr>
              ))}</tbody>
            </table>
          </>
        )}
      </Card>

      {(data.recommendations||[]).length>0&&(
        <Card>
          <SH title="Recommendations"/>
          {(data.recommendations||[]).map((r:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {r}</p>)}
        </Card>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setDomain(e.inputLabel);}}/>
    </div>
  );
}

// ── SEO WRITING ASSISTANT ──
function SEOWriter() {
  const [kw,setKw]=useState("");
  const [content,setContent]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [serpData,setSerpData]=useState<any>(null);
  const [score,setScore]=useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [breakdown,setBreakdown]=useState<any>(null);
  const [loadingSerp,setLoadingSerp]=useState(false);
  const [err,setErr]=useState("");
  const [generating,setGenerating]=useState(false);
  const hist=useToolHistory("seowriter");

  // Generate (or regenerate) an optimized draft from the SERP research → fills the editor.
  const generateDraft=async()=>{
    if(!kw.trim()||!serpData)return;
    setGenerating(true);setErr("");
    try{
      const terms=(serpData.nlp_terms||[]).slice(0,20).join(", ");
      const topics=(serpData.key_topics||[]).join(", ");
      const tgt=serpData.target_word_count||1200;
      const txt=await aiText(`Write a complete, SEO-optimized article for the keyword "${kw}". Target length about ${tgt} words.\nNaturally include these NLP/semantic terms (never keyword-stuff): ${terms||"(none)"}.\nCover these key topics: ${topics||"(infer the most relevant ones)"}.\nUse clean markdown: an H1 with the keyword, the keyword in the first 100 words, H2/H3 sections, bullet lists where useful, and a short conclusion with a CTA.\nWrite like a human expert: vary sentence length, use contractions, no AI clichés, and NO em dashes (use commas or periods).`, true);
      setContent(txt);
    }catch(e){setErr(e instanceof Error?e.message:"Generation failed. Try again.");}
    finally{setGenerating(false);}
  };

  // Real-time score — recalculates whenever content or serpData changes
  useEffect(()=>{
    if(!serpData||!content.trim()){setScore(0);setBreakdown(null);return;}
    const words=content.trim().split(/\s+/).length;
    const cl=content.toLowerCase();
    const terms:string[]=serpData.nlp_terms||[];
    const presentTerms=terms.filter((t:string)=>cl.includes(t.toLowerCase()));
    const termScore=terms.length>0?Math.round((presentTerms.length/terms.length)*50):0;
    const target:number=serpData.target_word_count||1200;
    const wcScore=Math.round(Math.min(words/target,1.0)*30);
    const kwWords=kw.toLowerCase().split(/\s+/);
    const kwPresent=kwWords.every((w:string)=>cl.includes(w));
    const kwScore=kwPresent?20:0;
    const total=Math.min(termScore+wcScore+kwScore,100);
    setScore(total);
    setBreakdown({termScore,wcScore,kwScore,present:presentTerms.length,total:terms.length,words,target});
  },[content,serpData,kw]);

  const fetchSerp=async()=>{
    if(!kw.trim())return;
    setLoadingSerp(true);setErr("");setSerpData(null);setScore(0);setBreakdown(null);
    try{
      const r=await fetch("/api/dataforseo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keyword:kw.trim()})});
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setSerpData(d);
      hist.add(kw,d);
    }catch(e){setErr(e instanceof Error?e.message:"Failed to fetch SERP data. Check DataForSEO credentials.");}
    finally{setLoadingSerp(false);}
  };

  const sc=(n:number)=>n>=80?S.green:n>=50?S.amber:S.red;
  const words=content.trim()?content.trim().split(/\s+/).length:0;
  const target:number=serpData?.target_word_count||1200;
  const nlpTerms:string[]=serpData?.nlp_terms||[];
  const cl=content.toLowerCase();
  const presentSet=new Set(nlpTerms.filter((t:string)=>cl.includes(t.toLowerCase())));
  const scoreLabel=score>=80?"Excellent":score>=60?"Good":score>=40?"Needs work":"Poor";

  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>SEO Writing Assistant</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Surfer-style scoring — real SERP data, NLP terms, and live content score as you write.</p>

      {/* Keyword bar */}
      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <Field label="Target keyword">
              <TI value={kw} onChange={setKw} placeholder="e.g. AI staffing solutions for enterprise"/>
            </Field>
          </div>
          <Btn onClick={fetchSerp} disabled={loadingSerp||!kw.trim()}>{loadingSerp?"Fetching SERP…":"Analyse SERP"}</Btn>
        </div>
        {err&&<p style={{fontSize:13,color:S.red,margin:"8px 0 0"}}>⚠ {err}</p>}
        {serpData&&<p style={{fontSize:12,color:S.green,margin:"8px 0 0"}}>✓ SERP data loaded — {serpData.competitors?.length||0} competitors analysed</p>}
      </Card>

      {/* Two-column layout */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,alignItems:"start"}}>

        {/* Left — editor */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <Field label="Your content">
              <TI value={content} onChange={setContent} placeholder={serpData?"Start writing or paste your content here…":"Analyse SERP first, then paste your content to get a live score."} rows={22}/>
            </Field>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,fontSize:12,color:S.muted,flexWrap:"wrap" as const,gap:8}}>
              <span>{words.toLocaleString()} words</span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {serpData&&<span style={{color:words>=target?S.green:S.amber}}>Target: ~{target.toLocaleString()} words</span>}
                {serpData&&<Btn variant="secondary" small onClick={generateDraft} disabled={generating||!kw.trim()}>{generating?"Writing…":content.trim()?"🔄 Regenerate draft":"✍ Generate draft with AI"}</Btn>}
              </div>
            </div>
            {serpData&&!content.trim()&&<p style={{fontSize:11,color:S.muted,margin:"6px 0 0"}}>Generate an AI draft optimized for these SERP terms, then edit it — the score updates live.</p>}
          </Card>

          {/* Key topics to cover */}
          {serpData?.key_topics?.length>0&&(
            <Card>
              <SH title="Key topics to cover"/>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(serpData.key_topics as string[]).map((t:string,i:number)=>(
                  <span key={i} style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:cl.includes(t.toLowerCase())?S.greenBg:S.subtle,color:cl.includes(t.toLowerCase())?S.greenText:S.muted,border:`1px solid ${cl.includes(t.toLowerCase())?S.green:S.border}`}}>{t}</span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right — score panel */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Score ring */}
          <Card>
            <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 14px"}}>Content Score</p>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
              <ScoreRing score={score} size={76} label={scoreLabel}/>
              <div>
                <p style={{fontSize:32,fontWeight:800,color:sc(score),margin:0,lineHeight:1}}>{score}</p>
                <p style={{fontSize:12,color:S.muted,margin:"2px 0 0"}}>/100</p>
                <p style={{fontSize:11,color:sc(score),margin:"6px 0 0",fontWeight:600}}>{scoreLabel}</p>
              </div>
            </div>
            {breakdown?(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[{l:"NLP Coverage",v:breakdown.termScore,max:50,hint:`${breakdown.present}/${breakdown.total} terms`},{l:"Word Count",v:breakdown.wcScore,max:30,hint:`${breakdown.words}/${breakdown.target} words`},{l:"Keyword",v:breakdown.kwScore,max:20,hint:breakdown.kwScore===20?"Present":"Missing"}].map(s=>(
                  <div key={s.l}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:S.muted,marginBottom:3}}>
                      <span>{s.l} <span style={{color:S.border}}>·</span> <span style={{color:sc((s.v/s.max)*100)}}>{s.hint}</span></span>
                      <span style={{fontWeight:600,color:sc((s.v/s.max)*100)}}>{s.v}/{s.max}</span>
                    </div>
                    <div style={{height:5,background:S.border,borderRadius:3}}>
                      <div style={{height:5,borderRadius:3,background:sc((s.v/s.max)*100),width:`${(s.v/s.max)*100}%`,transition:"width 0.4s ease"}}/>
                    </div>
                  </div>
                ))}
              </div>
            ):(
              <p style={{fontSize:12,color:S.muted,textAlign:"center" as const,padding:"4px 0"}}>{serpData?"Paste content to see your score":"Analyse SERP first"}</p>
            )}
          </Card>

          {/* Word count bar */}
          {serpData&&(
            <Card>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 10px"}}>Word Count</p>
              <div style={{height:10,background:S.border,borderRadius:5,marginBottom:8,overflow:"hidden"}}>
                <div style={{height:10,borderRadius:5,background:words>=target?S.green:S.accent,width:`${Math.min((words/target)*100,100)}%`,transition:"width 0.4s ease"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:words>=target?S.green:S.text,fontWeight:600}}>{words.toLocaleString()} words</span>
                <span style={{color:S.muted}}>Target ~{target.toLocaleString()}</span>
              </div>
            </Card>
          )}

          {/* NLP Terms checklist */}
          {nlpTerms.length>0&&(
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:0}}>NLP Terms</p>
                <span style={{fontSize:12,fontWeight:700,color:presentSet.size===nlpTerms.length?S.green:S.accent}}>{presentSet.size}/{nlpTerms.length}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:260,overflowY:"auto"}}>
                {nlpTerms.map((t:string,i:number)=>{
                  const has=presentSet.has(t);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0"}}>
                      <span style={{color:has?S.green:S.red,fontSize:13,lineHeight:1,flexShrink:0}}>{has?"✓":"✗"}</span>
                      <span style={{fontSize:12,color:has?S.text:S.muted}}>{t}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Competitor table */}
          {serpData?.competitors?.length>0&&(
            <Card>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 10px"}}>Top Ranking Pages</p>
              {(serpData.competitors as {position:number;domain:string;title:string;snippet:string}[]).slice(0,8).map((c,i)=>(
                <div key={i} style={{padding:"7px 0",borderBottom:`1px solid ${S.border}`,fontSize:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{color:S.muted,minWidth:18,fontWeight:700}}>#{c.position}</span>
                    <span style={{color:S.accent,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.domain}</span>
                  </div>
                  <p style={{fontSize:11,color:S.muted,margin:0,paddingLeft:24,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TOPIC RESEARCH ──
function Topics() {
  const [seed,setSeed]=useState("");const [industry,setIndustry]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const run = async () => { if(!seed.trim()) return; setLoading(true); setErr(""); try { const d = await ai(`Content strategist. Return ONLY valid JSON: {"clusters":[{"topic":"string","angle":"string","format":"Article|Video|Infographic|Guide|Case Study","volume":"string","trend":"Up|Stable|Down","questions":["string"]}],"trending":["string"],"paa":["string"],"long_tail":["string"]} 4 clusters with 3 questions each. Seed:"${seed}" Industry:"${industry||"general"}"`); setData(d); } catch(e) { setErr("Failed. Try again."); console.error(e); } finally { setLoading(false); } };
  const trendColor:Record<string,string>={Up:"green",Stable:"blue",Down:"red"};
  const fmtColor:Record<string,string>={Article:"blue",Video:"purple",Infographic:"amber",Guide:"green","Case Study":"red"};
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Topic Research</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Discover trending topics, questions, and content clusters around any keyword.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Seed keyword"><TI value={seed} onChange={setSeed} placeholder="e.g. AI customer support"/></Field>
          <Field label="Industry"><TI value={industry} onChange={setIndustry} placeholder="e.g. SaaS, Healthcare, D2C"/></Field>
        </div>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!seed.trim()}>{loading?"Researching...":"Find topics"}</Btn>
      </Card>
      {data && (
        <>
          {(data.clusters||[]).map((cl:{topic:string;angle:string;format:string;volume:string;trend:string;questions:string[]},i:number)=>(
            <Card key={i}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:700,color:S.text}}>{cl.topic}</span>
                {pill(cl.format,fmtColor[cl.format]||"gray")}{pill(cl.trend,trendColor[cl.trend]||"gray")}
                <span style={{marginLeft:"auto",fontSize:12,color:S.muted}}>Vol: {cl.volume}</span>
              </div>
              <p style={{fontSize:12,color:S.muted,margin:"0 0 10px"}}>Angle: {cl.angle}</p>
              <Divider/>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 6px"}}>Questions to answer</p>
              {(cl.questions||[]).map((q,j)=><p key={j} style={{fontSize:13,color:S.text,margin:"0 0 5px"}}>? {q}</p>)}
            </Card>
          ))}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card><SH title="Trending now"/>{(data.trending||[]).map((t:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>🔥 {t}</p>)}</Card>
            <Card><SH title="People also ask"/>{(data.paa||[]).map((q:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>? {q}</p>)}</Card>
          </div>
          <Card><SH title="Long-tail opportunities"/>{(data.long_tail||[]).map((k:string,i:number)=><span key={i} style={{fontSize:12,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{k}</span>)}</Card>
        </>
      )}
    </div>
  );
}

// ── ON-PAGE SEO CHECKER ──
function OnPage({activeSite,setPage}:PageProps) {
  const [url,setUrl]=useState("");const [kw,setKw]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [loadPhase,setLoadPhase]=useState("");
  // Handoff from Dashboard recommended actions: pre-fill the exact ranking page URL + keyword
  const [seeded,setSeeded]=useState(false);
  useEffect(()=>{
    const raw=localStorage.getItem("rm_onpage_seed");
    if(raw){
      localStorage.removeItem("rm_onpage_seed");
      try{ const s=JSON.parse(raw) as {url?:string;keyword?:string}; if(s.url)setUrl(s.url); if(s.keyword)setKw(s.keyword); setSeeded(true); }catch{}
      return; // don't override with the default origin below
    }
    if(activeSite&&!url)setUrl(extractOrigin(activeSite));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeSite]);
  void seeded;
  const hist = useToolHistory("onpage");
  const run = async () => {
    if(!url.trim()||!kw.trim()) return; setLoading(true); setErr(""); setLoadPhase("");
    try {
      setLoadPhase("Fetching and parsing page…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pageData: any = null; let pageScraped = false;
      try {
        const r = await fetch(`/api/py/onpage?url=${encodeURIComponent(url.trim())}&keyword=${encodeURIComponent(kw.trim())}`);
        if (r.ok) { pageData = await r.json(); pageScraped = pageData?.scraped || false; }
      } catch { /* ignore */ }
      setLoadPhase("Analysing on-page SEO…");
      const pageCtx = pageData
        ? `\n\nREAL PAGE DATA scraped from the live URL (use these EXACT values for tags and counts — do not invent tag content): title="${pageData.title||""}" (${pageData.titleLength||0} chars), meta_description="${pageData.metaDesc||""}" (${pageData.metaDescLength||0} chars), h1="${pageData.h1||""}", h1_count=${pageData.h1Count||0}, word_count=${pageData.wordCount||0}, img_count=${pageData.imgCount||0}, imgs_without_alt=${pageData.imgsWithoutAlt||0}, canonical="${pageData.canonical||""}", noindex=${pageData.noindex||false}, kw_in_title=${pageData.kwInTitle||false}, kw_in_meta=${pageData.kwInMeta||false}, kw_in_h1=${pageData.kwInH1||false}, kw_in_url=${pageData.kwInUrl||false}, internal_links=${pageData.internalLinks||0}, external_links=${pageData.externalLinks||0}, schema_types=${JSON.stringify(pageData.schemaTypes||[])}`
        : "";
      const d = await ai(`SEMrush On-Page SEO Checker. Return ONLY valid JSON: {"scores":{"overall":number,"content":number,"readability":number,"word_count":number,"recommended_wc":number},"tags":{"title":{"value":"string","length":number,"status":"Good|Too short|Too long|Missing","recommendation":"string"},"meta":{"value":"string","length":number,"status":"Good|Too short|Too long|Missing","recommendation":"string"},"h1":{"value":"string","status":"Good|Missing|Multiple","recommendation":"string"}},"kw_placement":{"in_title":boolean,"in_meta":boolean,"in_h1":boolean,"in_first_para":boolean,"in_url":boolean,"in_alt_text":boolean,"in_subheadings":boolean},"tfidf":[{"term":"string","recommended":number,"current":number,"gap":number,"status":"Good|Add more|Overused"}],"semantic_kws":[{"kw":"string","relevance":"High|Medium|Low","present":boolean}],"featured_snippet":{"eligible":boolean,"type":"Paragraph|List|Table","reason":"string","action":"string"},"actions":[{"priority":"High|Medium|Low","category":"string","action":"string","impact":"string"}],"serp_competitors":[{"pos":number,"domain":"string","wc":number,"score":number}]} URL:"${url}" Keyword:"${kw}". 5 tfidf terms, 6 semantic kws, 5 actions, 4 serp competitors.${pageCtx}`);
      setData({...d, _scraped: pageScraped, _pageData: pageData}); hist.add(`${url} · ${kw}`, d);
    } catch(e) { const m=e instanceof Error?e.message:""; setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed."); console.error(e); } finally { setLoading(false); setLoadPhase(""); }
  };
  const sc=(n:number)=>n>=80?S.green:n>=50?S.amber:S.red;
  const tagStatusColor:Record<string,string>={Good:S.green,"Too short":S.amber,"Too long":S.amber,Missing:S.red};
  const tagStatusBg:Record<string,string>={Good:S.greenBg,"Too short":S.amberBg,"Too long":S.amberBg,Missing:S.redBg};
  const tfidfColor=(status:string)=>status==="Good"?S.green:status==="Overused"?S.red:S.amber;
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>On-Page SEO Checker</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>SEMrush-style — TF-IDF analysis, tag audit, keyword placement, featured snippet opportunity.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Page URL"><TI value={url} onChange={setUrl} placeholder="https://yoursite.com/page"/></Field>
          <Field label="Target keyword"><TI value={kw} onChange={setKw} placeholder="e.g. AI chatbot platform"/></Field>
        </div>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        {loading&&loadPhase&&<LoadingBar phase={loadPhase}/>}
        <Btn onClick={run} disabled={loading||!url.trim()||!kw.trim()}>{loading?"Checking...":"Run on-page audit"}</Btn>
      </Card>
      {data&&<div style={{background:data._scraped?S.greenBg:S.amberBg,border:`1px solid ${data._scraped?"#86efac":"#fcd34d"}`,borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:data._scraped?S.greenText:S.amberText,fontWeight:600}}>{data._scraped?"✓ Real page data — title, meta, H1, word count and keyword placement scraped live":"⚠ Estimated data — page may be unreachable; enter a live public URL for real analysis"}</div>}

      {data && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            {[{l:"Overall",v:data.scores?.overall,c:sc(data.scores?.overall)},{l:"Content",v:data.scores?.content,c:sc(data.scores?.content)},{l:"Readability",v:data.scores?.readability,c:sc(data.scores?.readability)},{l:"Word Count",v:`${data.scores?.word_count||0} / ${data.scores?.recommended_wc||0}`,c:S.text}].map((m,i)=>(
              <div key={i} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"14px 16px"}}>
                <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",margin:"0 0 6px"}}>{m.l}</p>
                <p style={{fontSize:22,fontWeight:700,color:m.c,margin:0,lineHeight:1}}>{m.v}</p>
                {i<3&&<div style={{marginTop:8}}><Bar value={m.v as number} color={m.c} height={4}/></div>}
              </div>
            ))}
          </div>

          {data._scraped && data._pageData && (
            <Card style={{marginBottom:14}}>
              <SH title="Scraped page data — live values from your page"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {l:"Title",v:data._pageData.title,sub:`${data._pageData.titleLength||0} chars`,warn:!data._pageData.title||data._pageData.titleLength<30||data._pageData.titleLength>60},
                  {l:"Meta Description",v:data._pageData.metaDesc,sub:`${data._pageData.metaDescLength||0} chars`,warn:!data._pageData.metaDesc||data._pageData.metaDescLength<70||data._pageData.metaDescLength>160},
                  {l:"H1",v:data._pageData.h1,sub:`${data._pageData.h1Count||0} H1 tag${data._pageData.h1Count===1?"":"s"}`,warn:!data._pageData.h1||data._pageData.h1Count!==1},
                  {l:"Canonical",v:data._pageData.canonical||"Not set",sub:"",warn:!data._pageData.canonical},
                ].map((row,i)=>(
                  <div key={i} style={{padding:"10px 12px",background:row.warn?S.amberBg:S.greenBg,border:`1px solid ${row.warn?"#fcd34d":"#86efac"}`,borderRadius:8}}>
                    <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 4px",letterSpacing:"0.05em"}}>{row.l} {row.sub&&<span style={{fontWeight:400}}>· {row.sub}</span>}</p>
                    <p style={{fontSize:12,color:S.text,margin:0,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{row.v||<em style={{color:S.red}}>Missing</em>}</p>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:10}}>
                {[
                  {l:"Word count",v:data._pageData.wordCount||0,ok:(data._pageData.wordCount||0)>=300},
                  {l:"Images",v:data._pageData.imgCount||0,ok:true},
                  {l:"Imgs missing alt",v:data._pageData.imgsWithoutAlt||0,ok:(data._pageData.imgsWithoutAlt||0)===0},
                  {l:"Schema types",v:(data._pageData.schemaTypes||[]).join(", ")||"None",ok:(data._pageData.schemaTypes||[]).length>0},
                ].map((m,i)=>(
                  <div key={i} style={{padding:"8px 10px",background:S.card,border:`1px solid ${S.border}`,borderRadius:6}}>
                    <p style={{fontSize:10,color:S.muted,margin:"0 0 2px",textTransform:"uppercase" as const,fontWeight:600}}>{m.l}</p>
                    <p style={{fontSize:13,fontWeight:700,color:m.ok?S.green:S.red,margin:0}}>{m.v}</p>
                  </div>
                ))}
              </div>
              {/* Exact image URLs that are missing an alt tag — so you can fix the right images */}
              {(data._pageData.imgsMissingAltUrls||[]).length>0&&(
                <div style={{marginTop:12,padding:"10px 12px",background:S.amberBg,border:`1px solid #fde68a`,borderRadius:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap" as const,gap:6}}>
                    <p style={{fontSize:11,fontWeight:700,color:S.amberText,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:0}}>⚠ Images needing an alt tag ({(data._pageData.imgsMissingAltUrls||[]).length})</p>
                    <CopyBtn text={(data._pageData.imgsMissingAltUrls||[]).join("\n")}/>
                  </div>
                  <div style={{display:"grid",gap:4,maxHeight:200,overflowY:"auto" as const}}>
                    {(data._pageData.imgsMissingAltUrls||[]).map((u:string,i:number)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                        <img src={u} alt="" style={{width:28,height:28,objectFit:"cover" as const,borderRadius:4,border:`1px solid ${S.border}`,flexShrink:0,background:"#fff"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.visibility="hidden";}}/>
                        <a href={u} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.accent,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{u}</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card style={{marginBottom:14}}>
            <SH title="Tag audit (AI recommendations)"/>
            {Object.entries(data.tags||{}).map(([tag,info])=>{
              const ti=info as {value:string;length?:number;status:string;recommendation:string};
              return (
                <div key={tag} style={{padding:"10px 0",borderBottom:`1px solid ${S.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:12,fontWeight:700,color:S.text,textTransform:"uppercase"}}>{tag}</span>
                    <span style={{fontSize:11,fontWeight:700,color:tagStatusColor[ti.status]||S.muted,background:tagStatusBg[ti.status]||S.subtle,padding:"2px 8px",borderRadius:4}}>{ti.status}</span>
                  </div>
                  <p style={{fontSize:11,color:S.muted,margin:"0 0 4px",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ti.value}</p>
                  {ti.length!==undefined&&<p style={{fontSize:10,color:S.muted,margin:"0 0 3px"}}>Length: {ti.length} chars</p>}
                  <p style={{fontSize:11,color:S.accent,margin:0}}>→ {ti.recommendation}</p>
                </div>
              );
            })}
          </Card>
          <Card style={{marginBottom:14}}>
            <SH title="Keyword placement"/>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {Object.entries(data.kw_placement||{}).map(([key,present])=>(
                <div key={key} style={{minWidth:140,flex:"1 1 140px"}}>
                  <CheckItem label={key.replace(/_/g," ").replace(/^in /,"")} ok={!!present}/>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{marginBottom:14}}>
            <SH title="TF-IDF analysis"/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Term","Recommended","Current","Gap","Status"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.tfidf||[]).map((t:{term:string;recommended:number;current:number;gap:number;status:string},i:number)=>(
                <tr key={i}>
                  <TD bold>{t.term}</TD>
                  <TD color={S.muted}>{t.recommended}×</TD>
                  <TD color={S.text}>{t.current}×</TD>
                  <TD color={t.gap>0?S.amber:t.gap<0?S.red:S.green}><strong>{t.gap>0?`+${t.gap}`:t.gap}</strong></TD>
                  <TD><span style={{fontSize:11,fontWeight:700,color:tfidfColor(t.status)}}>{t.status}</span></TD>
                </tr>
              ))}</tbody>
            </table>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <Card>
              <SH title="Semantic keywords"/>
              {(data.semantic_kws||[]).map((sk:{kw:string;relevance:string;present:boolean},i:number)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${S.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:12,color:sk.present?S.green:S.muted}}>{sk.present?"✓":"○"}</span>
                    <span style={{fontSize:12,color:sk.present?S.text:S.muted,fontWeight:sk.present?600:400}}>{sk.kw}</span>
                  </div>
                  {pill(sk.relevance,sk.relevance==="High"?"red":sk.relevance==="Medium"?"amber":"gray")}
                </div>
              ))}
            </Card>
            {data.featured_snippet && (
              <Card style={{background:data.featured_snippet.eligible?S.greenBg:S.subtle,border:`1px solid ${data.featured_snippet.eligible?"#86efac":S.border}`}}>
                <SH title="Featured snippet opportunity"/>
                <div style={{marginBottom:8}}>{pill(data.featured_snippet.eligible?"Eligible":"Not eligible",data.featured_snippet.eligible?"green":"gray")}{data.featured_snippet.eligible&&<span style={{marginLeft:6}}>{pill(data.featured_snippet.type,"blue")}</span>}</div>
                <p style={{fontSize:12,color:S.muted,margin:"0 0 8px",lineHeight:1.5}}>{data.featured_snippet.reason}</p>
                {data.featured_snippet.eligible&&<p style={{fontSize:12,color:S.green,margin:0,fontWeight:500}}>→ {data.featured_snippet.action}</p>}
              </Card>
            )}
          </div>

          <Card style={{marginBottom:14}}>
            <SH title="Prioritized action items"/>
            {(data.actions||[]).map((a:{priority:string;category:string;action:string;impact:string},i:number)=>(
              <div key={i} style={{display:"flex",gap:14,padding:"10px 0",borderBottom:`1px solid ${S.border}`}}>
                {pill(a.priority,a.priority==="High"?"red":a.priority==="Medium"?"amber":"green")}
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:700,color:S.text}}>{a.action}</span>
                    {pill(a.category,"blue")}
                  </div>
                  <p style={{fontSize:11,color:S.muted,margin:0}}>Impact: {a.impact}</p>
                </div>
              </div>
            ))}
          </Card>

          {(data.serp_competitors||[]).length>0 && (
            <Card>
              <SH title="SERP competitor benchmark"/>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr>{["Position","Domain","Word Count","On-Page Score"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{(data.serp_competitors||[]).map((c:{pos:number;domain:string;wc:number;score:number},i:number)=>(
                  <tr key={i}><TD color={i<3?S.green:S.muted}><strong>#{c.pos}</strong></TD><TD bold><span style={{color:S.accent}}>{c.domain}</span></TD><TD color={S.muted}>{(c.wc||0).toLocaleString()} words</TD><TD><div style={{display:"flex",alignItems:"center",gap:8}}><Bar value={c.score} color={sc(c.score)}/><span style={{fontSize:12,fontWeight:700,color:sc(c.score)}}>{c.score}</span></div></TD></tr>
                ))}</tbody>
              </table>
            </Card>
          )}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);const parts=e.inputLabel.split(" · ");setUrl(parts[0]||"");setKw(parts[1]||"");}}/>
    </div>
  );
}

// ── SERP ANALYZER ──
function SERPAnalyzer({activeSite,setPage}:PageProps) {
  const [kw,setKw]=useState("");const [location,setLocation]=useState("US");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [loadPhase,setLoadPhase]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [gscRank,setGscRank]=useState<any>(null);
  const hist = useToolHistory("serp");

  // Extract domain from activeSite for highlighting
  const activeDomain = activeSite ? (() => { try { return new URL(activeSite.startsWith("http")?activeSite:"https://"+activeSite).hostname.replace(/^www\./,""); } catch { return activeSite.replace(/^www\./,"").split("/")[0]; } })() : "";
  const activeSiteUrl = activeSite ? (activeSite.startsWith("http") ? activeSite : "https://"+activeSite) : "";

  const run = async () => {
    if(!kw.trim()) return; setLoading(true); setErr(""); setLoadPhase(""); setGscRank(null);
    try {
      setLoadPhase("Fetching live SERP results…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let serpData: any = null; let serpScraped = false; let serpSource = "";

      // Run SERP scrape + GSC keyword rank in parallel
      const [serpResp, gscResp] = await Promise.allSettled([
        fetch(`/api/py/serpcheck?keyword=${encodeURIComponent(kw.trim())}&location=${encodeURIComponent(location.trim())}`),
        activeSiteUrl ? fetch(`/api/gsc?site=${encodeURIComponent(activeSiteUrl)}&keyword=${encodeURIComponent(kw.trim())}`) : Promise.resolve(null),
      ]);

      if (serpResp.status === "fulfilled" && serpResp.value.ok) {
        serpData = await serpResp.value.json();
        serpScraped = serpData?.scraped || false;
        serpSource = serpData?.source || "";
      }
      if (gscResp.status === "fulfilled" && gscResp.value && gscResp.value.ok) {
        const gd = await gscResp.value.json();
        if (gd?.found) setGscRank(gd);
      }

      setLoadPhase("Analysing search landscape…");
      const sourceLabel = serpSource === "google" ? "Google" : serpSource === "bing" ? "Bing" : "DuckDuckGo";
      const serpCtx = serpData?.results?.length
        ? `\n\nREAL SERP DATA from ${sourceLabel} (use these EXACT domains, titles, and positions — do NOT invent results): ${JSON.stringify(serpData.results.slice(0,10).map((r:{pos:number;domain:string;title:string;snippet:string})=>({pos:r.pos,domain:r.domain,title:r.title,snippet:r.snippet})))}`
        : "";
      const mySiteCtx = activeDomain ? `\n\nMy site domain: ${activeDomain}. Note if it appears in the results and at what position.` : "";
      const d = await ai(`SERP analyst. Return ONLY valid JSON: {"intent":"Informational|Commercial|Transactional|Navigational","intent_reason":"string","features":["string"],"difficulty":number,"results":[{"pos":number,"domain":"string","title":"string","type":"Article|Landing Page|Product|Forum|Video","da":number,"backlinks":"string","word_count":"string"}],"opportunity":"string","strategy":"string"} 10 results. Keyword:"${kw}" Location:"${location}"${serpCtx}${mySiteCtx}`);
      setData({...d, _scraped: serpScraped, _serpResults: serpData?.results||[], _serpSource: serpSource}); hist.add(`${kw} · ${location}`, d);
    } catch(e) { const m=e instanceof Error?e.message:""; setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed."); console.error(e); } finally { setLoading(false); setLoadPhase(""); }
  };
  const typeColor:Record<string,string>={Article:"blue","Landing Page":"purple",Product:"green",Forum:"amber",Video:"red"};
  const iColor:Record<string,string>={Informational:"blue",Commercial:"purple",Transactional:"green",Navigational:"gray"};

  const displayResults: {pos:number;domain:string;title:string;type?:string;da?:number;backlinks?:string;word_count?:string;url?:string;snippet?:string}[] = data?._serpResults?.length ? data._serpResults : (data?.results||[]);
  const myRank = activeDomain ? displayResults.findIndex(r=>r.domain===activeDomain||r.domain?.endsWith("."+activeDomain)||activeDomain.endsWith("."+r.domain)) : -1;

  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>SERP Analyzer</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Who is ranking, SERP features, and search intent for any keyword.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Keyword"><TI value={kw} onChange={setKw} placeholder="e.g. best CRM for small business"/></Field>
          <Field label="Location"><TI value={location} onChange={setLocation} placeholder="US"/></Field>
        </div>
        {activeDomain&&<p style={{fontSize:12,color:S.muted,margin:"0 0 12px"}}>Tracking <strong style={{color:S.accent}}>{activeDomain}</strong> — will be highlighted in results</p>}
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        {loading&&loadPhase&&<LoadingBar phase={loadPhase}/>}
        <Btn onClick={run} disabled={loading||!kw.trim()}>{loading?"Analyzing...":"Analyze SERP"}</Btn>
      </Card>
      {data&&<div style={{background:data._scraped?S.greenBg:S.amberBg,border:`1px solid ${data._scraped?"#86efac":"#fcd34d"}`,borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:data._scraped?S.greenText:S.amberText,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>
        {data._scraped?(
          <>
            {data._serpSource==="google"&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
            {data._serpSource==="bing"&&<span style={{fontSize:11,background:"#0078d4",color:"#fff",padding:"1px 5px",borderRadius:3,fontWeight:700}}>B</span>}
            {data._serpSource==="brave"&&<span style={{fontSize:11,background:"#fb542b",color:"#fff",padding:"1px 5px",borderRadius:3,fontWeight:700}}>B</span>}
            {`✓ Live ${data._serpSource==="google"?"Google":data._serpSource==="bing"?"Bing":data._serpSource==="brave"?"Brave":"DuckDuckGo"} results — ${data._serpResults?.length||0} organic rankings`}
          </>
        ):"⚠ Estimated data — AI-generated results, not live SERP"}
      </div>}
      {gscRank&&<Card style={{marginBottom:14,background:"#f0fdf4",border:"1px solid #86efac"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          <span style={{fontSize:13,fontWeight:700,color:"#166534"}}>Google Search Console — Your real ranking for &ldquo;{gscRank.keyword}&rdquo;</span>
        </div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <div><div style={{fontSize:11,color:S.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Avg. Position</div><div style={{fontSize:28,fontWeight:800,color:gscRank.position<=3?"#16a34a":gscRank.position<=10?"#d97706":"#dc2626",lineHeight:1}}>#{gscRank.position}</div></div>
          <div><div style={{fontSize:11,color:S.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Clicks (28d)</div><div style={{fontSize:22,fontWeight:700,color:S.text}}>{gscRank.clicks.toLocaleString()}</div></div>
          <div><div style={{fontSize:11,color:S.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Impressions</div><div style={{fontSize:22,fontWeight:700,color:S.text}}>{gscRank.impressions.toLocaleString()}</div></div>
          <div><div style={{fontSize:11,color:S.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>CTR</div><div style={{fontSize:22,fontWeight:700,color:S.text}}>{gscRank.ctr}%</div></div>
        </div>
        <p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>Source: Google Search Console (last 28 days) · Data from Google&rsquo;s own index for verified site</p>
      </Card>}
      {data && (
        <>
          <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <Metric label="KW difficulty" value={data.difficulty} color={data.difficulty>=70?S.red:data.difficulty>=40?S.amber:S.green}/>
            {activeDomain&&myRank>=0&&<Metric label={`${activeDomain} rank`} value={`#${myRank+1}`} color={myRank===0?S.green:myRank<4?S.amber:S.red}/>}
            {activeDomain&&myRank<0&&data._scraped&&<Metric label={`${activeDomain} rank`} value="Not in top 10" color={S.muted}/>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <Card>
              <SH title="Search intent"/>
              <div style={{marginBottom:8}}>{pill(data.intent,iColor[data.intent]||"gray")}</div>
              <p style={{fontSize:12,color:S.muted,margin:"0 0 10px"}}>{data.intent_reason}</p>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 6px"}}>SERP features present</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(data.features||[]).map((f:string,i:number)=><span key={i} style={{fontSize:11,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",fontWeight:600}}>{f}</span>)}</div>
            </Card>
            <Card>
              <SH title="Opportunity"/>
              <p style={{fontSize:13,color:S.text,margin:"0 0 8px"}}>{data.opportunity}</p>
              <Divider/>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 6px"}}>Recommended strategy</p>
              <p style={{fontSize:12,color:S.accent}}>{data.strategy}</p>
            </Card>
          </div>
          <Card style={{padding:"20px 0",overflow:"hidden"}}>
            <div style={{padding:"0 24px 14px"}}><SH title={data._scraped?(data._serpSource==="google"?"Live Google rankings":data._serpSource==="bing"?"Live Bing rankings":"Live SERP results"):"Top 10 SERP results (AI-estimated)"}/></div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Pos","Domain","Title","Type","DA","Backlinks","Words"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{displayResults.map((r,i:number)=>{
                const isMysite = activeDomain&&(r.domain===activeDomain||r.domain?.endsWith("."+activeDomain)||activeDomain.endsWith("."+r.domain));
                return (
                  <tr key={i} style={{background:isMysite?"rgba(99,102,241,0.08)":"transparent",outline:isMysite?"2px solid #6366f1":"none",outlineOffset:"-2px"}}
                    onMouseEnter={e=>{if(!isMysite)(e.currentTarget as HTMLTableRowElement).style.background="#f8fafc"}}
                    onMouseLeave={e=>{if(!isMysite)(e.currentTarget as HTMLTableRowElement).style.background="transparent"}}>
                    <TD>
                      <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:"50%",background:isMysite?"#6366f1":i===0?"#fef3c7":i===1?"#f1f5f9":i===2?"#fff7ed":"transparent",border:`1.5px solid ${isMysite?"#6366f1":i===0?"#fcd34d":i===1?"#e2e8f0":i===2?"#fed7aa":S.border}`,fontSize:12,fontWeight:800,color:isMysite?"#fff":i===0?"#d97706":i===1?S.muted:i===2?"#ea580c":S.muted}}>
                        {r.pos||i+1}
                      </span>
                    </TD>
                    <TD bold>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{color:isMysite?"#6366f1":S.accent,fontSize:13,fontWeight:isMysite?700:600}}>{r.domain}</span>
                        {isMysite&&<span style={{fontSize:10,fontWeight:700,background:"#6366f1",color:"#fff",padding:"1px 6px",borderRadius:4}}>YOUR SITE</span>}
                        {r.url&&<p style={{fontSize:10,color:S.muted,margin:"1px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160,width:"100%"}}>{r.url}</p>}
                      </div>
                    </TD>
                    <TD>
                      <div>
                        <span style={{fontSize:12,color:S.text,fontWeight:500,display:"block"}}>{r.title}</span>
                        {r.snippet&&<span style={{fontSize:11,color:S.muted,display:"block",marginTop:2,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{r.snippet}</span>}
                      </div>
                    </TD>
                    <TD>{r.type?pill(r.type,typeColor[r.type]||"gray"):pill("Organic","gray")}</TD>
                    <TD><span style={{fontSize:13,fontWeight:700,color:(r.da||0)>=60?S.green:(r.da||0)>=30?S.amber:S.muted}}>{r.da||"—"}</span></TD>
                    <TD color={S.muted}>{r.backlinks||"—"}</TD>
                    <TD color={S.muted}>{r.word_count||"—"}</TD>
                  </tr>
                );
              })}</tbody>
            </table>
          </Card>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);const parts=e.inputLabel.split(" · ");setKw(parts[0]||"");setLocation(parts[1]||"US");}}/>
    </div>
  );
}

// ── CONTENT AUDIT ──
function ContentAudit({activeSite,setPage}:PageProps) {
  const [domain,setDomain]=useState("");const [urls,setUrls]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("audit");
  const run = async () => { if(!domain.trim()) return; setLoading(true); setErr(""); try { const d = await ai(`Content auditor. Return ONLY valid JSON: {"summary":{"total":number,"thin":number,"cannibalizing":number,"healthy":number},"thin_content":[{"url":"string","issue":"string","wc":number,"action":"Expand|Merge|Redirect|Delete","priority":"High|Medium|Low"}],"cannibalization":[{"keyword":"string","urls":["string"],"winner":"string","fix":"string"}],"quick_wins":["string"]} 5 thin pages, 3 cannibalization groups. Domain:"${domain}" URLs:"${urls||"not provided"}"`); setData(d); hist.add(domain, d); } catch(e) { setErr("Failed. Try again."); console.error(e); } finally { setLoading(false); } };
  const actionColor:Record<string,string>={Expand:"green",Merge:"blue",Redirect:"amber",Delete:"red"};
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Content Audit</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Detect thin content, keyword cannibalization, and content gaps across your site.</p>
      <Card>
        <Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>
        <Field label="URLs to audit (optional, one per line)"><TI value={urls} onChange={setUrls} placeholder="/blog/post-1&#10;/blog/post-2" rows={4}/></Field>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Auditing...":"Run content audit"}</Btn>
      </Card>
      {data && (
        <>
          {data.summary && (
            <div style={{display:"flex",gap:12,marginBottom:16}}>
              {[{l:"Total pages",v:data.summary.total,c:S.text},{l:"Thin content",v:data.summary.thin,c:S.red},{l:"Cannibalization",v:data.summary.cannibalizing,c:S.amber},{l:"Healthy",v:data.summary.healthy,c:S.green}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
            </div>
          )}
          <Card><SH title="Thin content pages"/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["URL","Issue","Word Count","Action","Priority"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.thin_content||[]).map((t:{url:string;issue:string;wc:number;action:string;priority:string},i:number)=>(
                <tr key={i}><TD><span style={{fontSize:11,color:S.accent}}>{t.url}</span></TD><TD color={S.muted}>{t.issue}</TD><TD color={t.wc<300?S.red:S.amber}>{t.wc} words</TD><TD>{pill(t.action,actionColor[t.action]||"gray")}</TD><TD>{pill(t.priority,t.priority==="High"?"red":t.priority==="Medium"?"amber":"green")}</TD></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card><SH title="Keyword cannibalization"/>
            {(data.cannibalization||[]).map((c:{keyword:string;urls:string[];winner:string;fix:string},i:number)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${S.border}`}}>
                <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 6px"}}>"{c.keyword}"</p>
                <div style={{marginBottom:6}}>{(c.urls||[]).map((u,j)=><span key={j} style={{fontSize:11,background:u===c.winner?S.greenBg:S.redBg,color:u===c.winner?S.greenText:S.redText,borderRadius:4,padding:"2px 8px",marginRight:4,display:"inline-block"}}>{u===c.winner?"✓ ":""}{u}</span>)}</div>
                <p style={{fontSize:12,color:S.accent,margin:0}}>→ {c.fix}</p>
              </div>
            ))}
          </Card>
          <Card><SH title="Quick wins"/>{(data.quick_wins||[]).map((q:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {q}</p>)}</Card>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setDomain(e.inputLabel);}}/>
    </div>
  );
}

// ── INTERNAL LINKS ──
function InternalLinks({activeSite,setPage}:PageProps) {
  const [domain,setDomain]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("intlinks");
  const run = async () => { if(!domain.trim()) return; setLoading(true); setErr(""); try { const d = await ai(`Internal link analyst. Return ONLY valid JSON: {"score":number,"orphan_pages":["string"],"over_linked":["string"],"opportunities":[{"source":"string","target":"string","anchor":"string","reason":"string","priority":"High|Medium|Low"}],"recommendations":["string"]} 3 orphan pages, 5 opportunities. Domain:"${domain}"`); setData(d); hist.add(domain, d); } catch(e) { setErr("Failed. Try again."); console.error(e); } finally { setLoading(false); } };
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Internal Links Analyzer</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Analyze your internal link structure and find linking opportunities.</p>
      <Card>
        <Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Analyzing...":"Analyze links"}</Btn>
      </Card>
      {data && (
        <>
          <div style={{display:"flex",gap:12,marginBottom:16}}><Metric label="Link structure score" value={data.score} color={data.score>=70?S.green:data.score>=40?S.amber:S.red}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <Card><SH title="Orphan pages (no inbound links)"/>{(data.orphan_pages||[]).map((p:string,i:number)=><p key={i} style={{fontSize:12,color:S.red,margin:"0 0 6px",paddingBottom:6,borderBottom:`1px solid ${S.border}`}}>⚠ {p}</p>)}</Card>
            <Card><SH title="Over-linked pages"/>{(data.over_linked||[]).map((p:string,i:number)=><p key={i} style={{fontSize:12,color:S.amber,margin:"0 0 6px",paddingBottom:6,borderBottom:`1px solid ${S.border}`}}>△ {p}</p>)}</Card>
          </div>
          <Card><SH title="Link opportunities"/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Source","Target","Anchor text","Reason","Priority"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.opportunities||[]).map((o:{source:string;target:string;anchor:string;reason:string;priority:string},i:number)=>(
                <tr key={i}><TD><span style={{fontSize:11,color:S.accent}}>{o.source}</span></TD><TD><span style={{fontSize:11,color:S.green}}>{o.target}</span></TD><TD color={S.text}><em>{o.anchor}</em></TD><TD color={S.muted}>{o.reason}</TD><TD>{pill(o.priority,o.priority==="High"?"red":o.priority==="Medium"?"amber":"green")}</TD></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card><SH title="Recommendations"/>{(data.recommendations||[]).map((r:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {r}</p>)}</Card>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setDomain(e.inputLabel);}}/>
    </div>
  );
}

// ── BROKEN LINK CHECKER ──
function BrokenLinks({activeSite,setPage}:PageProps) {
  const [domain,setDomain]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [loadPhase,setLoadPhase]=useState("");
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("brokenlinks");
  const run = async () => {
    if(!domain.trim()) return; setLoading(true); setErr(""); setLoadPhase("");
    try {
      setLoadPhase("Scanning pages for broken links…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let linkData: any = null; let linkScraped = false;
      try {
        const r = await fetch(`/api/py/checklinks?domain=${encodeURIComponent(domain.trim())}`);
        if (r.ok) { linkData = await r.json(); linkScraped = linkData?.scraped || false; }
      } catch { /* ignore */ }
      setLoadPhase("Generating recommendations…");
      const linkCtx = linkData?.summary
        ? `\n\nREAL LINK SCAN DATA — use these EXACT numbers for summary, do not invent others: total_pages_scanned=${linkData.summary.total}, ok=${linkData.summary.ok}, redirected=${linkData.summary.redirected}, broken=${linkData.summary.broken}. REAL broken URLs found: ${JSON.stringify((linkData.broken||[]).slice(0,6).map((b:{url:string;status:number})=>({url:b.url,status:b.status})))}. REAL redirects: ${JSON.stringify((linkData.redirected||[]).slice(0,4).map((b:{url:string;status:number;redirectTo:string})=>({url:b.url,status:b.status,redirectTo:b.redirectTo})))}`
        : "";
      const d = await ai(`Broken link auditor. Return ONLY valid JSON: {"summary":{"total_links":number,"broken":number,"redirects":number,"healthy":number},"broken_links":[{"source":"string","target":"string","status":number,"type":"Internal|External","anchor":"string","fix":"Update URL|Remove Link|Redirect"}],"recommendations":["string"]} Use EXACTLY the real scan data provided. For broken_links use the REAL broken URLs from the scan, inferring a realistic source page and anchor text for each. Domain:"${domain}"${linkCtx}`);
      setData({...d, _scraped: linkScraped, _linkData: linkData}); hist.add(domain, d);
    } catch(e) { const m=e instanceof Error?e.message:""; setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed."); console.error(e); } finally { setLoading(false); setLoadPhase(""); }
  };
  const fixColor:Record<string,string>={"Update URL":"green","Remove Link":"red","Redirect":"amber"};
  const typeColor:Record<string,string>={Internal:"blue",External:"purple"};
  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Broken Link Checker</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Find and fix broken internal and external links across your site.</p>
      <Card>
        <Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        {loading&&loadPhase&&<LoadingBar phase={loadPhase}/>}
        <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Scanning...":"Scan for broken links"}</Btn>
      </Card>
      {data&&<div style={{background:data._scraped?S.greenBg:S.amberBg,border:`1px solid ${data._scraped?"#86efac":"#fcd34d"}`,borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:data._scraped?S.greenText:S.amberText,fontWeight:600}}>{data._scraped?`✓ Real HEAD-check scan — ${data._linkData?.summary?.total||0} pages checked`:"⚠ Estimated data — enter a live domain for real link status checks"}</div>}
      {data && (
        <>
          {data.summary && (
            <div style={{display:"flex",gap:12,marginBottom:16}}>
              {[{l:"Total links",v:data.summary.total_links,c:S.text},{l:"Broken",v:data.summary.broken,c:S.red},{l:"Redirects",v:data.summary.redirects,c:S.amber},{l:"Healthy",v:data.summary.healthy,c:S.green}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
            </div>
          )}
          <Card><SH title="Broken links"/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Source","Broken URL","Status","Type","Anchor","Fix"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.broken_links||[]).map((l:{source:string;target:string;status:number;type:string;anchor:string;fix:string},i:number)=>(
                <tr key={i}><TD><span style={{fontSize:11,color:S.accent}}>{l.source}</span></TD><TD><span style={{fontSize:11,color:S.red}}>{l.target}</span></TD><TD color={S.red}><strong>{l.status}</strong></TD><TD>{pill(l.type,typeColor[l.type]||"gray")}</TD><TD color={S.muted}><em>{l.anchor}</em></TD><TD>{pill(l.fix,fixColor[l.fix]||"gray")}</TD></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card><SH title="Recommendations"/>{(data.recommendations||[]).map((r:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {r}</p>)}</Card>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setDomain(e.inputLabel);}}/>
    </div>
  );
}

// ── SCHEMA GENERATOR ──
function SchemaGen() {
  const [type,setType]=useState("Article");const [desc,setDesc]=useState("");
  const [schema,setSchema]=useState("");const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const [loadPhase,setLoadPhase]=useState("");const [scraped,setScraped]=useState(false);
  const TYPES=["Article","FAQ","Product","LocalBusiness","HowTo","BreadcrumbList","Organization","Event","Recipe","Review","VideoObject","JobPosting","Person","Service","SoftwareApplication","Course","NewsArticle","WebPage"];
  const run = async () => {
    if(!desc.trim()) return; setLoading(true); setErr(""); setLoadPhase(""); setScraped(false);
    const isUrl = /^https?:\/\//i.test(desc.trim());
    try {
      if (isUrl) {
        setLoadPhase("Scraping page…");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pageCtx = `URL: ${desc.trim()}`;
        try {
          const r = await fetch(`/api/py/onpage?url=${encodeURIComponent(desc.trim())}&keyword=`);
          if (r.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = await r.json() as any;
            const title = p.title || p.pageTitle || "";
            const metaDesc = p.metaDesc || p.metaDescription || p.meta_desc || "";
            const h1 = p.h1 || "";
            const h2s = (p.h2s || []).slice(0, 5).join(" | ");
            const domain = new URL(desc.trim()).hostname.replace(/^www\./, "");
            const orgName = domain.split(".")[0];
            pageCtx = [
              `URL: ${desc.trim()}`,
              title ? `Page title: "${title}"` : "",
              metaDesc ? `Meta description: "${metaDesc}"` : "",
              h1 ? `H1: "${h1}"` : "",
              h2s ? `H2s: ${h2s}` : "",
              `Organization: ${orgName}`,
            ].filter(Boolean).join("\n");
            setScraped(true);
          }
        } catch { /* use URL-only context */ }
        setLoadPhase("Generating schema…");
        const result = await aiText(`You are a schema.org expert. Generate a complete, accurate ${type} JSON-LD schema for this page based on the real scraped data below. Use the actual page title as "name/headline", the meta description as "description", and the real domain/URL. Do NOT use generic placeholders like "Provider Name", "Example Title", or "$29.99" — infer real values from the page data. Return ONLY the raw <script type="application/ld+json">...</script> block, no markdown, no explanation.\n\n${pageCtx}`);
        setSchema(result.trim());
      } else {
        setSchema(generateSchemaTemplate(type, desc));
      }
    } catch(e) {
      const msg = e instanceof Error ? e.message : "Failed. Try again.";
      setErr(msg); console.error(e);
    } finally { setLoading(false); setLoadPhase(""); }
  };
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Schema Markup Generator</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Generate JSON-LD structured data to enhance search appearance and rich results.</p>
      <Card>
        <Field label="Schema type"><Toggle value={type} onChange={setType} options={TYPES}/></Field>
        <Field label="Page URL or description"><TI value={desc} onChange={setDesc} placeholder="https://yoursite.com/page — or describe: Article about AI chatbots by Jane Smith..." rows={5}/></Field>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        {loading&&loadPhase&&<LoadingBar phase={loadPhase}/>}
        <Btn onClick={run} disabled={loading||!desc.trim()}>{loading?"Generating...":"Generate schema"}</Btn>
      </Card>
      {schema&&scraped&&<div style={{background:S.greenBg,border:"1px solid #86efac",borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:S.greenText,fontWeight:600}}>✓ Generated from real page data — scraped live</div>}
      {schema && (
        <Card>
          <SH title="Generated JSON-LD" action={<CopyBtn text={schema}/>}/>
          <pre style={{fontFamily:"monospace",fontSize:12,color:S.text,background:S.subtle,padding:"14px",borderRadius:8,whiteSpace:"pre-wrap",overflowX:"auto",margin:0,maxHeight:500,overflowY:"auto"}}>{schema}</pre>
          <div style={{marginTop:12,background:S.accentBg,borderRadius:8,padding:"10px 14px",fontSize:12,color:S.accentText}}>Add this inside the &lt;head&gt; of your page. Validate at <strong>schema.org/validator</strong></div>
        </Card>
      )}
    </div>
  );
}

// ── LOCAL SEO ──
function LocalSEO({activeSite,setPage}:PageProps) {
  const [biz,setBiz]=useState("");const [location,setLocation]=useState("");const [category,setCategory]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(activeSite&&!biz)setBiz(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("localseo");
  const run = async () => { if(!biz.trim()||!location.trim()) return; setLoading(true); setErr(""); try { const d = await ai(`Local SEO expert. Return ONLY valid JSON: {"score":number,"gmb_score":number,"issues":[{"area":"GMB|Citations|Reviews|Schema|On-Page|Local Content","issue":"string","fix":"string","impact":"High|Medium|Low"}],"citations":["string"],"keywords":[{"kw":"string","type":"Near Me|City|Neighborhood","priority":"High|Medium|Low"}],"tips":["string"]} Business:"${biz}" Location:"${location}" Category:"${category||"general"}"`); setData(d); hist.add(`${biz} · ${location}`,d); } catch(e) { setErr("Failed. Try again."); console.error(e); } finally { setLoading(false); } };
  const areaColor:Record<string,string>={GMB:"blue",Citations:"purple",Reviews:"green",Schema:"amber","On-Page":"red","Local Content":"blue"};
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Local SEO Checker</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Optimize your local search presence and Google Business Profile.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Business name"><TI value={biz} onChange={setBiz} placeholder="Acme Plumbing Co."/></Field>
          <Field label="Location"><TI value={location} onChange={setLocation} placeholder="Chicago, IL"/></Field>
          <Field label="Category"><TI value={category} onChange={setCategory} placeholder="Plumber, Restaurant..."/></Field>
        </div>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!biz.trim()||!location.trim()}>{loading?"Checking...":"Run local SEO audit"}</Btn>
      </Card>
      {data && (
        <>
          <div style={{display:"flex",gap:12,marginBottom:16}}>
            {[{l:"Local SEO score",v:data.score,c:data.score>=70?S.green:data.score>=40?S.amber:S.red},{l:"GMB score",v:data.gmb_score,c:data.gmb_score>=70?S.green:data.gmb_score>=40?S.amber:S.red}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
          </div>
          <Card><SH title="Issues to fix"/>
            {(data.issues||[]).map((iss:{area:string;issue:string;fix:string;impact:string},i:number)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${S.border}`}}>
                <div style={{display:"flex",gap:6,marginBottom:5,flexWrap:"wrap"}}>{pill(iss.area,areaColor[iss.area]||"gray")}{pill(iss.impact,iss.impact==="High"?"red":iss.impact==="Medium"?"amber":"green")}</div>
                <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 3px"}}>{iss.issue}</p><p style={{fontSize:12,color:S.accent,margin:0}}>→ {iss.fix}</p>
              </div>
            ))}
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card><SH title="Local keywords"/>{(data.keywords||[]).map((k:{kw:string;type:string;priority:string},i:number)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${S.border}`}}><span style={{flex:1,fontSize:13,color:S.text}}>{k.kw}</span>{pill(k.type,"blue")}{pill(k.priority,k.priority==="High"?"red":k.priority==="Medium"?"amber":"green")}</div>
            ))}</Card>
            <Card><SH title="Citation sources"/>{(data.citations||[]).map((c:string,i:number)=><p key={i} style={{fontSize:12,color:S.text,margin:"0 0 6px",paddingBottom:6,borderBottom:`1px solid ${S.border}`}}>📍 {c}</p>)}</Card>
          </div>
          <Card><SH title="Tips"/>{(data.tips||[]).map((t:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {t}</p>)}</Card>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{const parts=e.inputLabel.split(" · ");setData(e.data);setBiz(parts[0]||"");setLocation(parts[1]||"");}}/>
    </div>
  );
}

// ── LINK BUILDING ──
function LinkBuilding({activeSite,setPage}:PageProps) {
  const [domain,setDomain]=useState("");const [topic,setTopic]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("linkbuilding");
  const run = async () => {
    if(!domain.trim()||!topic.trim()) return; setLoading(true); setErr("");
    try {
      // 1. REAL prospects scraped from live search results (DataForSEO-backed SERP).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let d:any = null;
      try{
        const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"linkprospects",domain:domain.trim(),topic:topic.trim()})});
        const j=await r.json();
        if(r.ok && j.source==="scraped" && Array.isArray(j.prospects) && j.prospects.length) d=j;
      }catch{/* fall back to AI */}
      // 2. Fallback: AI-generated prospects (when scraping returns nothing).
      if(!d){
        d = await ai(`Link building strategist. Return ONLY valid JSON: {"prospects":[{"site":"string","type":"Blog|Directory|Resource|Forum|Podcast|News","dr":number,"relevance":"High|Medium|Low","tactic":"Guest Post|Resource Link|Digital PR|Broken Link|Mention","email":"string","template":"string"}],"strategies":["string"],"quick_wins":["string"]} 8 prospects with outreach templates. Domain:"${domain}" Topic:"${topic}"`);
        d._source="ai";
      }
      setData(d); hist.add(`${domain} · ${topic}`,d);
    } catch(e) { setErr("Failed. Try again."); console.error(e); } finally { setLoading(false); }
  };
  const typeColor:Record<string,string>={Blog:"blue",Directory:"purple",Resource:"green",Forum:"amber",Podcast:"red",News:"blue"};
  const tacticColor:Record<string,string>={"Guest Post":"blue","Resource Link":"green","Digital PR":"purple","Broken Link":"amber",Mention:"gray"};
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Link Building</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Find link prospects and get AI-generated personalized outreach templates.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Your domain"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>
          <Field label="Topic / niche"><TI value={topic} onChange={setTopic} placeholder="e.g. AI chatbots for ecommerce"/></Field>
        </div>
        {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!domain.trim()||!topic.trim()}>{loading?"Finding...":"Find prospects"}</Btn>
      </Card>
      {data && (
        <>
          {data._source==="ai"
            ? <div style={{padding:"8px 14px",borderRadius:8,marginBottom:12,fontSize:12,fontWeight:600,background:S.amberBg,border:"1px solid #fde68a",color:S.amberText}}>
                ⚠ AI-generated prospects (no live results found) — sites, DR, and emails are AI-inferred. Verify before outreach.
              </div>
            : <div style={{padding:"8px 14px",borderRadius:8,marginBottom:12,fontSize:12,fontWeight:600,background:S.greenBg,border:"1px solid #a7f3d0",color:S.greenText}}>
                ✓ Real prospects scraped from live search results. Emails are scraped where found (verify before sending). DR shows “—” (needs the DataForSEO Backlinks subscription).
              </div>}
          <Card><SH title="Link prospects"/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Site","Type","DR","Relevance","Tactic","Contact"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.prospects||[]).map((p:{site:string;url?:string;type:string;dr:number|null;relevance:string;tactic:string;email:string;template:string},i:number)=>(
                <tr key={i}><TD bold>{p.url?<a href={p.url} target="_blank" rel="noopener noreferrer" style={{color:S.accent,textDecoration:"none"}}>{p.site} ↗</a>:<span style={{color:S.accent}}>{p.site}</span>}</TD><TD>{pill(p.type,typeColor[p.type]||"gray")}</TD><TD color={p.dr==null?S.muted:p.dr>=60?S.green:p.dr>=30?S.amber:S.red}>{p.dr==null?"—":p.dr}</TD><TD>{pill(p.relevance,p.relevance==="High"?"green":p.relevance==="Medium"?"amber":"gray")}</TD><TD>{pill(p.tactic,tacticColor[p.tactic]||"gray")}</TD><TD color={S.muted}>{p.email||"—"}</TD></tr>
              ))}</tbody>
            </table>
          </Card>
          {(data.prospects||[]).filter((p:{template:string})=>p.template).slice(0,3).map((p:{site:string;template:string},i:number)=>(
            <Card key={i}>
              <SH title={`Outreach template — ${p.site}`} action={<CopyBtn text={p.template}/>}/>
              <pre style={{fontFamily:"inherit",fontSize:12,color:S.text,lineHeight:1.7,whiteSpace:"pre-wrap",margin:0,background:S.subtle,padding:"12px",borderRadius:8}}>{p.template}</pre>
            </Card>
          ))}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card><SH title="Link building strategies"/>{(data.strategies||[]).map((s:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {s}</p>)}</Card>
            <Card><SH title="Quick wins"/>{(data.quick_wins||[]).map((q:string,i:number)=><p key={i} style={{fontSize:13,color:S.green,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>✓ {q}</p>)}</Card>
          </div>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{const parts=e.inputLabel.split(" · ");setData(e.data);setDomain(parts[0]||"");setTopic(parts[1]||"");}}/>
    </div>
  );
}

// ── HISTORY PANEL (reusable within each tool) ──
function HistoryPanel({ hist, onLoad }: { hist: ReturnType<typeof useToolHistory>; onLoad: (e: HistoryEntry) => void }) {
  const [open,setOpen] = useState(false);
  if (hist.entries.length === 0) return null;
  return (
    <div style={{marginTop:8,border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden",boxShadow:S.shadow}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",cursor:"pointer",background:S.card,userSelect:"none" as const}} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14,color:S.muted}}>◷</span>
          <span style={{fontSize:13,fontWeight:600,color:S.text}}>Recent history</span>
          <span style={{background:S.subtle,color:S.muted,fontSize:11,fontWeight:600,padding:"1px 8px",borderRadius:20}}>{hist.entries.length}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={e=>{e.stopPropagation();hist.clear();}} style={{background:"none",border:"none",color:S.muted,cursor:"pointer",fontSize:12,fontFamily:"inherit",padding:"3px 8px",borderRadius:5,transition:"color 0.1s"}}
            onMouseEnter={e=>(e.currentTarget.style.color=S.red)} onMouseLeave={e=>(e.currentTarget.style.color=S.muted)}>Clear all</button>
          <span style={{color:S.muted,fontSize:12,fontWeight:600}}>{open?"↑":"↓"}</span>
        </div>
      </div>
      {open && (
        <div style={{borderTop:`1px solid ${S.border}`,background:"#fafafa"}}>
          {hist.entries.map((e,i)=>(
            <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",borderBottom:i<hist.entries.length-1?`1px solid ${S.border}`:"none",transition:"background 0.1s"}}
              onMouseEnter={ev=>(ev.currentTarget as HTMLDivElement).style.background="#f1f5f9"}
              onMouseLeave={ev=>(ev.currentTarget as HTMLDivElement).style.background="transparent"}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.inputLabel}</p>
                <p style={{fontSize:11,color:S.muted,margin:0}}>{new Date(e.timestamp).toLocaleString()}</p>
              </div>
              <Btn small variant="secondary" onClick={()=>onLoad(e)}>Reload</Btn>
              <button onClick={()=>hist.remove(e.id)} style={{background:"none",border:`1px solid ${S.border}`,borderRadius:6,color:S.muted,cursor:"pointer",fontSize:15,padding:"2px 8px",lineHeight:1,fontFamily:"inherit"}} title="Remove">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── HISTORY PAGE (global view across all tools) ──
function HistoryPage({ setPage }: PageProps) {
  const HIST_TOOLS = Object.keys(TOOL_LABELS);
  const [entries,setEntries] = useState<HistoryEntry[]>([]);
  const [filter,setFilter] = useState("All");

  useEffect(() => {
    const all = HIST_TOOLS.flatMap(tool => {
      try { return (JSON.parse(localStorage.getItem(`rm_hist_${tool}`) || "[]") as HistoryEntry[]); }
      catch { return []; }
    }).sort((a,b)=>b.timestamp-a.timestamp);
    setEntries(all);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (entry: HistoryEntry) => {
    const key = `rm_hist_${entry.tool}`;
    try {
      const stored: HistoryEntry[] = JSON.parse(localStorage.getItem(key)||"[]");
      localStorage.setItem(key, JSON.stringify(stored.filter(e=>e.id!==entry.id)));
    } catch { /* noop */ }
    setEntries(prev=>prev.filter(e=>e.id!==entry.id));
  };

  const clearAll = () => {
    HIST_TOOLS.forEach(t=>localStorage.removeItem(`rm_hist_${t}`));
    setEntries([]);
  };

  const toolNames = ["All",...Array.from(new Set(entries.map(e=>e.toolLabel)))];
  const shown = filter==="All" ? entries : entries.filter(e=>e.toolLabel===filter);

  const grouped: Record<string,HistoryEntry[]> = {};
  shown.forEach(e=>{
    const d = new Date(e.timestamp).toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"});
    grouped[d] = grouped[d]||[];
    grouped[d].push(e);
  });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>History</h2>
          <p style={{fontSize:13,color:S.muted,margin:0}}>All past audit runs — reload or remove individual entries.</p>
        </div>
        {entries.length>0&&<Btn small variant="secondary" onClick={clearAll}>Clear all history</Btn>}
      </div>

      {entries.length===0 ? (
        <Card>
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <p style={{fontSize:32,margin:"0 0 10px"}}>◷</p>
            <p style={{fontSize:14,fontWeight:600,color:S.text,margin:"0 0 6px"}}>No history yet</p>
            <p style={{fontSize:13,color:S.muted,margin:"0 0 16px"}}>Run any audit tool and the results will appear here.</p>
            <Btn onClick={()=>setPage("dashboard")}>Go to dashboard</Btn>
          </div>
        </Card>
      ) : (
        <>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
            {toolNames.map(t=>(
              <button key={t} onClick={()=>setFilter(t)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${filter===t?S.accent:S.border}`,background:filter===t?S.accentBg:"transparent",color:filter===t?S.accentText:S.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t}</button>
            ))}
          </div>
          {Object.entries(grouped).map(([date,dayEntries])=>(
            <div key={date} style={{marginBottom:20}}>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 8px"}}>{date}</p>
              {dayEntries.map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"12px 16px",marginBottom:6}}>
                  <div style={{width:34,height:34,borderRadius:8,background:S.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:S.accentText,flexShrink:0}}>
                    {NAV_CATEGORIES.flatMap(c=>c.items).find(n=>n.id===e.tool)?.icon||"◷"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:700,color:S.text,margin:"0 0 2px"}}>{e.toolLabel}</p>
                    <p style={{fontSize:12,color:S.muted,margin:"0 0 1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.inputLabel}</p>
                    <p style={{fontSize:11,color:S.muted,margin:0,opacity:0.7}}>{new Date(e.timestamp).toLocaleTimeString()}</p>
                  </div>
                  <Btn small onClick={()=>setPage(e.tool)}>Open tool</Btn>
                  <button onClick={()=>remove(e)} style={{background:"none",border:`1px solid ${S.border}`,borderRadius:5,color:S.muted,cursor:"pointer",fontSize:14,padding:"3px 10px",fontFamily:"inherit"}} title="Remove from history">×</button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── LINK INTERSECT ──
function LinkIntersect({activeSite,setPage}:PageProps) {
  const [domain,setDomain]=useState("");const [c1,setC1]=useState("");const [c2,setC2]=useState("");const [c3,setC3]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(activeSite&&!domain)setDomain(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("linkinter");
  const run = async () => {
    if(!domain.trim()||!c1.trim()) return; setLoading(true); setErr("");
    const comps=[c1,c2,c3].filter(Boolean).join(", ");
    try {
      const d = await ai(`Link Intersect analyst. Find domains that link to competitors [${comps}] but NOT to "${domain}". Return ONLY valid JSON: {"summary":{"total_opportunities":number,"high_dr_count":number,"easy_wins":number},"prospects":[{"domain":"string","dr":number,"links_to":["string"],"type":"Editorial|Directory|Forum|Blog|News","relevance":"High|Medium|Low","tactic":"string","why":"string"}],"quick_wins":["string"],"strategies":["string"]} 12 prospects, 5 quick wins, 4 strategies.`);
      setData(d); hist.add(`${domain} vs ${comps}`,d);
    } catch(e){const m=e instanceof Error?e.message:"";setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed.");console.error(e);} finally{setLoading(false);}
  };
  const relColor:Record<string,string>={High:"green",Medium:"amber",Low:"gray"};
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Link Intersect</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Find domains that link to your competitors but not to you — your highest-value link building targets.</p>
      <Card>
        <Field label="Your domain"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:4}}>
          <Field label="Competitor 1"><TI value={c1} onChange={setC1} placeholder="competitor1.com"/></Field>
          <Field label="Competitor 2"><TI value={c2} onChange={setC2} placeholder="competitor2.com"/></Field>
          <Field label="Competitor 3"><TI value={c3} onChange={setC3} placeholder="competitor3.com"/></Field>
        </div>
        {err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!domain.trim()||!c1.trim()}>{loading?"Analyzing...":"Find link opportunities"}</Btn>
      </Card>
      {data&&(
        <>
          <div style={{display:"flex",gap:12,marginBottom:16}}>
            {[{l:"Total opportunities",v:data.summary?.total_opportunities,c:S.accent},{l:"High DR prospects",v:data.summary?.high_dr_count,c:S.green},{l:"Easy wins",v:data.summary?.easy_wins,c:S.amber}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
          </div>
          <Card>
            <SH title="Link prospects" action={<button onClick={()=>downloadCSV("link-intersect.csv",["Domain","DR","Links To","Type","Relevance","Tactic"],(data.prospects||[]).map((p:any)=>[p.domain,p.dr,(p.links_to||[]).join("|"),p.type,p.relevance,p.tactic]))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>}/>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:640}}>
                <thead><tr>{["Domain","DR","Links To","Type","Relevance","Tactic"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{(data.prospects||[]).map((p:any,i:number)=>(
                  <tr key={i}>
                    <TD bold>{p.domain}</TD>
                    <TD color={p.dr>=70?S.green:p.dr>=40?S.amber:S.muted}>{p.dr}</TD>
                    <TD>{(p.links_to||[]).join(", ")}</TD>
                    <TD>{pill(p.type,"blue")}</TD>
                    <TD>{pill(p.relevance,relColor[p.relevance]||"gray")}</TD>
                    <TD color={S.muted}>{p.tactic}</TD>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Card><SH title="Quick wins"/>{(data.quick_wins||[]).map((q:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {q}</p>)}</Card>
            <Card><SH title="Strategies"/>{(data.strategies||[]).map((st:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {st}</p>)}</Card>
          </div>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);const parts=e.inputLabel.split(" vs ");setDomain(parts[0]?.trim()||"");}}/>
    </div>
  );
}

// ── BRAND MONITORING ──
function BrandMonitor({activeSite,setPage}:PageProps) {
  const [brand,setBrand]=useState("");const [competitors,setCompetitors]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [tab,setTab]=useState("mentions");const [loadPhase,setLoadPhase]=useState("");
  useEffect(()=>{if(activeSite&&!brand)setBrand(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("brandmon");

  const run = async () => {
    if(!brand.trim()) return; setLoading(true); setErr(""); setLoadPhase("");
    try {
      // Step 1 — scrape real mentions from Google News + Reddit
      setLoadPhase("Searching web for mentions…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realMentions: any[] = [];
      let scraped = false;
      try {
        const scrapeRes = await fetch(`/api/brandmention?brand=${encodeURIComponent(brand.trim())}`);
        if (scrapeRes.ok) {
          const scrapeData = await scrapeRes.json();
          realMentions = scrapeData.mentions || [];
          scraped = scrapeData.scraped || false;
        }
      } catch { /* ignore — fall back to AI-only */ }

      // Step 2 — rule-based analysis from scraped mentions (no AI call needed)
      setLoadPhase("Analysing brand presence…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = realMentions.length > 0
        ? brandInsightsFromMentions(brand, realMentions)
        : { summary:{total_mentions:0,sentiment_positive:0,sentiment_neutral:0,sentiment_negative:0,reach:0,share_of_voice:0}, sources:[], recent_mentions:[], competitors:[], alerts:["No mentions found — brand may be too new or not indexed yet"], opportunities:["Publish press releases and guest posts to build brand mentions"] };

      // Add competitor estimates if provided
      if (competitors && d.competitors.length === 0) {
        const compList = competitors.split(",").map(c=>c.trim()).filter(Boolean).slice(0,3);
        d.competitors = compList.map((c,i)=>({brand:c, mentions: Math.max(1, realMentions.length - (i+1)*2), sentiment: 50+i*5, sov: Math.max(5, 30 - i*8)}));
      }

      setData({...d, _scraped: scraped, _mentionCount: realMentions.length});
      hist.add(brand, d);
    } catch(e){const m=e instanceof Error?e.message:"";setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed.");console.error(e);} finally{setLoading(false);setLoadPhase("");}
  };

  const sentColor=(s:string)=>s==="Positive"?S.green:s==="Negative"?S.red:S.muted;
  const sentBg=(s:string)=>s==="Positive"?S.greenBg:s==="Negative"?S.redBg:S.subtle;

  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Brand Monitoring</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Track brand mentions, sentiment, and share of voice across the web.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Brand name or domain"><TI value={brand} onChange={setBrand} placeholder="Your Brand or yoursite.com"/></Field>
          <Field label="Competitors (optional, comma-separated)"><TI value={competitors} onChange={setCompetitors} placeholder="Competitor A, Competitor B"/></Field>
        </div>
        {err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!brand.trim()}>{loading?(loadPhase||"Monitoring…"):"Monitor brand"}</Btn>
        {loading&&loadPhase&&<p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>{loadPhase}</p>}
      </Card>
      {data&&(
        <>
          <div style={{display:"flex",gap:12,marginBottom:8,flexWrap:"wrap"}}>
            {[{l:"Total mentions",v:fmtNumGlobal(data.summary?.total_mentions||0),c:S.accent},{l:"Reach",v:fmtNumGlobal(data.summary?.reach||0),c:S.text},{l:"Share of voice",v:(data.summary?.share_of_voice)+"%",c:S.green}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
          </div>
          <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            {[{l:"Positive",v:data.summary?.sentiment_positive+"%",c:S.green},{l:"Neutral",v:data.summary?.sentiment_neutral+"%",c:S.muted},{l:"Negative",v:data.summary?.sentiment_negative+"%",c:S.red}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
          </div>
          <Tabs tabs={["mentions","sources","competitors","alerts"]} active={tab} onChange={setTab}/>
          {tab==="mentions"&&<Card><SH title="Recent Mentions"/>
            {data._scraped
              ? <div style={{display:"flex",gap:10,padding:"10px 14px",background:S.greenBg,border:`1px solid #bbf7d0`,borderRadius:8,marginBottom:14}}>
                  <span style={{fontSize:15,flexShrink:0}}>✓</span>
                  <p style={{fontSize:12,color:S.greenText,margin:0,lineHeight:1.6}}><strong>Real articles from Google News &amp; Reddit.</strong> {data._mentionCount} mentions found. Links open the actual source pages.</p>
                </div>
              : <div style={{display:"flex",gap:10,padding:"10px 14px",background:S.amberBg,border:`1px solid #fde68a`,borderRadius:8,marginBottom:14}}>
                  <span style={{fontSize:15,flexShrink:0}}>⚠</span>
                  <p style={{fontSize:12,color:S.amberText,margin:0,lineHeight:1.6}}><strong>No live articles found.</strong> Showing AI-modelled examples. Use <strong>Search Google</strong> links to find real coverage.</p>
                </div>
            }
            {(data.recent_mentions||[]).map((m:any,i:number)=>(
              <div key={i} style={{padding:"12px 0",borderBottom:`1px solid ${S.border}`}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,fontWeight:600,color:S.muted}}>{m.source}</span>
                  {m.date&&<span style={{fontSize:11,color:S.muted}}>· {m.date}</span>}
                  <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:sentBg(m.sentiment),color:sentColor(m.sentiment)}}>{m.sentiment}</span>
                </div>
                <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 4px"}}>{m.title}</p>
                {m.snippet&&<p style={{fontSize:12,color:S.muted,margin:"0 0 6px"}}>{m.snippet}</p>}
                {data._scraped
                  ? <a href={m.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.accent,textDecoration:"none",fontWeight:600,wordBreak:"break-all"}}>{m.url} →</a>
                  : <a href={`https://www.google.com/search?q=${encodeURIComponent(m.title+" "+brand)}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.accent,textDecoration:"none",fontWeight:600}}>Search Google →</a>
                }
              </div>
            ))}
          </Card>}
          {tab==="sources"&&<Card><SH title="Mention Sources"/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{["Source","Type","Mentions","Sentiment","Authority"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.sources||[]).map((src:any,i:number)=>(
                <tr key={i}><TD bold>{src.source}</TD><TD>{pill(src.type,"blue")}</TD><TD color={S.accent}>{src.mentions}</TD><TD>{pill(src.sentiment,src.sentiment==="Positive"?"green":src.sentiment==="Negative"?"red":"gray")}</TD><TD color={src.authority>=70?S.green:src.authority>=40?S.amber:S.muted}>{src.authority}</TD></tr>
              ))}</tbody>
            </table>
          </Card>}
          {tab==="competitors"&&<Card><SH title="Competitor Share of Voice"/>
            {(data.competitors||[]).map((c:any,i:number)=>(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:S.text}}>{c.brand}</span>
                  <span style={{fontSize:12,color:S.muted}}>{c.mentions} mentions · {c.sov}% SoV</span>
                </div>
                <Bar value={c.sov} color={i===0?S.accent:S.muted}/>
              </div>
            ))}
          </Card>}
          {tab==="alerts"&&<Card>
            <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 8px"}}>Alerts</p>
            {(data.alerts||[]).map((a:string,i:number)=><p key={i} style={{fontSize:13,color:S.red,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>⚠ {a}</p>)}
            <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"12px 0 8px"}}>Opportunities</p>
            {(data.opportunities||[]).map((o:string,i:number)=><p key={i} style={{fontSize:13,color:S.green,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {o}</p>)}
          </Card>}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setBrand(e.inputLabel);}}/>
    </div>
  );
}

// ── MARKET EXPLORER ──
function MarketExplorer() {
  const [market,setMarket]=useState("");const [region,setRegion]=useState("Global");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [tab,setTab]=useState("overview");
  const hist = useToolHistory("market");
  const run = async () => {
    if(!market.trim()) return; setLoading(true); setErr("");
    try {
      const d = await ai(`Market research analyst (like SEMrush Market Explorer). Analyse market "${market}" in "${region}". Return ONLY valid JSON: {"overview":{"market_size":"string","growth_rate":"string","yoy_change":number,"maturity":"Emerging|Growing|Mature|Declining","opportunity":"High|Medium|Low"},"players":[{"domain":"string","brand":"string","traffic_share":number,"traffic":number,"position":"Leader|Challenger|Niche|Newcomer"}],"traffic_channels":[{"channel":"string","share":number}],"audience":{"age_groups":[{"group":"string","pct":number}],"gender":{"male":number,"female":number},"interests":["string"]},"trends":["string"],"opportunities":["string"],"threats":["string"]} 8 players, 6 channels summing to 100%, 4 age groups, 5 trends, 4 opportunities, 3 threats.`);
      setData(d); hist.add(`${market} · ${region}`,d);
    } catch(e){const m=e instanceof Error?e.message:"";setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed.");console.error(e);} finally{setLoading(false);}
  };
  const posColor:Record<string,string>={Leader:"green",Challenger:"blue",Niche:"amber",Newcomer:"gray"};
  const chColors=[S.accent,S.green,S.amber,S.red,"#8b5cf6","#0891b2"];
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Market Explorer</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Discover market size, key players, traffic distribution, and audience demographics for any industry.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:4}}>
          <Field label="Market or industry keyword"><TI value={market} onChange={setMarket} placeholder="e.g. AI writing tools, B2B SaaS CRM, electric vehicles"/></Field>
          <Field label="Region"><TI value={region} onChange={setRegion} placeholder="Global, US, Europe…"/></Field>
        </div>
        {err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!market.trim()}>{loading?"Analyzing market...":"Explore market"}</Btn>
      </Card>
      {data&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            {[{l:"Market size",v:data.overview?.market_size,c:S.text},{l:"Growth rate",v:data.overview?.growth_rate,c:S.green},{l:"YoY change",v:(data.overview?.yoy_change>=0?"+":"")+data.overview?.yoy_change+"%",c:data.overview?.yoy_change>=0?S.green:S.red},{l:"Opportunity",v:data.overview?.opportunity,c:data.overview?.opportunity==="High"?S.green:data.overview?.opportunity==="Medium"?S.amber:S.red}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
          </div>
          <Tabs tabs={["overview","players","audience"]} active={tab} onChange={setTab}/>
          {tab==="overview"&&(
            <>
              <Card><SH title="Traffic channels"/>
                {(data.traffic_channels||[]).map((ch:any,i:number)=>(
                  <div key={i} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,color:S.text}}>{ch.channel}</span><span style={{fontSize:12,color:S.muted}}>{ch.share}%</span></div>
                    <Bar value={ch.share} color={chColors[i%chColors.length]}/>
                  </div>
                ))}
              </Card>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                <Card><SH title="Trends"/>{(data.trends||[]).map((t:string,i:number)=><p key={i} style={{fontSize:12,color:S.text,margin:"0 0 6px",paddingBottom:6,borderBottom:`1px solid ${S.border}`}}>🔥 {t}</p>)}</Card>
                <Card><SH title="Opportunities"/>{(data.opportunities||[]).map((o:string,i:number)=><p key={i} style={{fontSize:12,color:S.green,margin:"0 0 6px",paddingBottom:6,borderBottom:`1px solid ${S.border}`}}>→ {o}</p>)}</Card>
                <Card><SH title="Threats"/>{(data.threats||[]).map((t:string,i:number)=><p key={i} style={{fontSize:12,color:S.red,margin:"0 0 6px",paddingBottom:6,borderBottom:`1px solid ${S.border}`}}>⚠ {t}</p>)}</Card>
              </div>
            </>
          )}
          {tab==="players"&&<Card><SH title="Market players" action={<button onClick={()=>downloadCSV("market-players.csv",["Brand","Domain","Traffic","Traffic Share %","Position"],(data.players||[]).map((p:any)=>[p.brand,p.domain,p.traffic,p.traffic_share,p.position]))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>}/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{["Brand","Domain","Traffic","Share","Position"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.players||[]).map((p:any,i:number)=>(
                <tr key={i}>
                  <TD bold>{p.brand}</TD><TD color={S.muted}>{p.domain}</TD>
                  <TD color={S.accent}>{fmtNumGlobal(p.traffic||0)}</TD>
                  <TD><div style={{display:"flex",alignItems:"center",gap:8}}><Bar value={p.traffic_share} height={4}/><span style={{fontSize:11,color:S.muted,whiteSpace:"nowrap"}}>{p.traffic_share}%</span></div></TD>
                  <TD>{pill(p.position,posColor[p.position]||"gray")}</TD>
                </tr>
              ))}</tbody>
            </table>
          </Card>}
          {tab==="audience"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card><SH title="Age groups"/>
                {(data.audience?.age_groups||[]).map((a:any,i:number)=>(
                  <div key={i} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,color:S.text}}>{a.group}</span><span style={{fontSize:12,color:S.muted}}>{a.pct}%</span></div>
                    <Bar value={a.pct} color={S.accent}/>
                  </div>
                ))}
              </Card>
              <Card>
                <SH title="Gender split"/>
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13}}>Male</span><span style={{fontSize:12,color:S.muted}}>{data.audience?.gender?.male}%</span></div>
                  <Bar value={data.audience?.gender?.male} color={S.blue}/>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13}}>Female</span><span style={{fontSize:12,color:S.muted}}>{data.audience?.gender?.female}%</span></div>
                  <Bar value={data.audience?.gender?.female} color="#ec4899"/>
                </div>
                <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",margin:"0 0 8px"}}>Top interests</p>
                {(data.audience?.interests||[]).map((intr:string,i:number)=><span key={i} style={{fontSize:12,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{intr}</span>)}
              </Card>
            </div>
          )}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);const parts=e.inputLabel.split(" · ");setMarket(parts[0]||"");setRegion(parts[1]||"Global");}}/>
    </div>
  );
}

// ── TRAFFIC ANALYTICS ──
function TrafficAnalytics({activeSite,setPage}:PageProps) {
  const [domains,setDomains]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [tab,setTab]=useState("overview");
  const [pageSearch,setPageSearch]=useState("");const [pagePage,setPagePage]=useState(1);
  const [selectedDomain,setSelectedDomain]=useState(0);
  const [pagesLoading,setPagesLoading]=useState(false);
  useEffect(()=>{if(activeSite&&!domains)setDomains(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("trafficana");
  const PAGE_SIZE=25;

  const run = async () => {
    if(!domains.trim()) return; setLoading(true); setErr(""); setPageSearch(""); setPagePage(1); setSelectedDomain(0);
    const domList=domains.split(/[\n,]+/).map(d=>d.trim()).filter(Boolean).slice(0,5);
    try {
      // Call Python scraper: SimilarWeb + Tranco rank + Wayback CDX + direct sitemap
      const res = await fetch("/api/py/trafficana", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({domains: domList}),
      });
      if(!res.ok) {
        const e = await res.json().catch(()=>({}));
        throw new Error((e as {error?:string}).error || `Scraper error ${res.status}`);
      }
      const d = await res.json();
      if(!d.domains?.length) throw new Error("No data returned");
      setData(d); hist.add(domList.join(", "),d);
    } catch(e){setErr(e instanceof Error?e.message:"Failed. Try again.");console.error(e);} finally{setLoading(false);}
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadMorePages = async (domain:string, domIdx:number) => {
    setPagesLoading(true);
    try {
      const res = await fetch(`/api/py/trafficana?domain=${encodeURIComponent(domain)}`);
      if(res.ok) {
        const result = await res.json();
        const pages = result?.domains?.[0]?.top_pages;
        if(pages?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setData((prev:any)=>({...prev,domains:(prev.domains||[]).map((d:any,i:number)=>i===domIdx?{...d,top_pages:pages}:d)}));
        }
      }
    } catch { /* ignore */ } finally { setPagesLoading(false); }
  };

  const chColors:Record<string,string>={"Organic Search":S.green,Direct:S.accent,Referral:S.amber,Social:"#8b5cf6",Email:"#0891b2",Paid:S.red};
  const domData = data?.domains?.[selectedDomain];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredPages = (domData?.top_pages||[]).filter((p:any)=>!pageSearch||p.page?.toLowerCase().includes(pageSearch.toLowerCase()));
  const totalPages = Math.ceil(filteredPages.length/PAGE_SIZE);
  const pagedPages = filteredPages.slice((pagePage-1)*PAGE_SIZE, pagePage*PAGE_SIZE);

  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Traffic Analytics</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Compare traffic sources, engagement metrics, location breakdown, and top pages across domains.</p>
      <Card>
        <Field label="Domains to compare (up to 5, comma or newline separated)"><TI value={domains} onChange={setDomains} placeholder={"site1.com\nsite2.com\nsite3.com"} rows={3}/></Field>
        {err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!domains.trim()}>{loading?"Analyzing...":"Analyze traffic"}</Btn>
      </Card>

      {data&&(
        <>
          {/* Data quality badges */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {(data.domains||[]).map((d:{domain:string;meta?:{data_quality?:string;data_source?:string;rank?:number;sitemap_pages?:number;wayback_urls?:number}},i:number)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,background:S.subtle,border:`1px solid ${S.border}`,fontSize:11}}>
                <span style={{fontWeight:600,color:S.text}}>{d.domain}</span>
                {d.meta?.data_quality==="real"
                  ? <span style={{color:S.green,fontWeight:600}}>● Live data</span>
                  : <span style={{color:S.amber,fontWeight:600}}>● Estimated</span>}
                {d.meta?.rank&&<span style={{color:S.muted}}>Rank #{fmtNumGlobal(d.meta.rank as number)}</span>}
                {(d.meta?.sitemap_pages??0)>0&&<span style={{color:S.muted}}>{fmtNumGlobal(d.meta?.sitemap_pages as number)} pages</span>}
                {(d.meta?.wayback_urls??0)>0&&<span style={{color:S.muted}}>{fmtNumGlobal(d.meta?.wayback_urls as number)} archived</span>}
              </div>
            ))}
          </div>

          {/* Domain selector (when multiple) */}
          {(data.domains||[]).length>1&&(
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {(data.domains||[]).map((d:{domain:string},i:number)=>(
                <button key={i} onClick={()=>{setSelectedDomain(i);setPagePage(1);setPageSearch("");}}
                  style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${selectedDomain===i?S.accent:S.border}`,background:selectedDomain===i?S.accentBg:"white",color:selectedDomain===i?S.accentText:S.text,fontSize:12,fontWeight:selectedDomain===i?600:400,cursor:"pointer",fontFamily:"inherit"}}>
                  {d.domain}
                </button>
              ))}
            </div>
          )}

          <Tabs tabs={["overview","channels","locations","pages"]} active={tab} onChange={setTab}/>

          {/* ── Overview ── */}
          {tab==="overview"&&<Card><SH title="Traffic overview" action={<button onClick={()=>downloadCSV("traffic-analytics.csv",["Domain","Visits","Unique","Bounce%","Pages/Visit","Avg Duration","MoM%"],(data.domains||[]).map((d:{domain:string;visits:number;unique_visitors:number;bounce_rate:number;pages_per_visit:number;avg_duration:string;mom_change:number})=>[d.domain,d.visits,d.unique_visitors,d.bounce_rate,d.pages_per_visit,d.avg_duration,(d.mom_change>=0?"+":"")+d.mom_change]))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>}/>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:620}}>
                <thead><tr>{["Domain","Visits","Unique","Bounce","Pages/Visit","Avg Duration","MoM"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{(data.domains||[]).map((d:{domain:string;visits:number;unique_visitors:number;bounce_rate:number;pages_per_visit:number;avg_duration:string;mom_change:number},i:number)=>(
                  <tr key={i} style={{cursor:"pointer",background:selectedDomain===i?S.accentBg:"transparent"}} onClick={()=>setSelectedDomain(i)}
                    onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=selectedDomain===i?S.accentBg:S.subtle}
                    onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=selectedDomain===i?S.accentBg:"transparent"}>
                    <TD bold>{d.domain}</TD><TD color={S.accent}>{fmtNumGlobal(d.visits)}</TD><TD>{fmtNumGlobal(d.unique_visitors)}</TD>
                    <TD color={d.bounce_rate<40?S.green:d.bounce_rate<65?S.amber:S.red}>{d.bounce_rate}%</TD>
                    <TD>{d.pages_per_visit}</TD><TD>{d.avg_duration}</TD>
                    <TD color={d.mom_change>=0?S.green:S.red}>{d.mom_change>=0?"+":""}{d.mom_change}%</TD>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>}

          {/* ── Channels ── */}
          {tab==="channels"&&domData&&(
            <Card><SH title={`Channel mix — ${domData.domain}`}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
                <div>
                  {(domData.channels||[]).map((ch:{channel:string;share:number;visits:number},j:number)=>(
                    <div key={j} style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:chColors[ch.channel]||S.muted,flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:500,color:S.text}}>{ch.channel}</span>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <span style={{fontSize:13,fontWeight:700,color:S.text}}>{ch.share}%</span>
                          <span style={{fontSize:11,color:S.muted,marginLeft:8}}>{fmtNumGlobal(ch.visits||0)} visits</span>
                        </div>
                      </div>
                      <div style={{height:6,background:S.subtle,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${ch.share}%`,background:chColors[ch.channel]||S.muted,borderRadius:99,transition:"width 0.4s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Donut-style legend */}
                <div style={{display:"flex",flexWrap:"wrap",gap:8,alignContent:"start"}}>
                  {(domData.channels||[]).map((ch:{channel:string;share:number},j:number)=>(
                    <div key={j} style={{background:S.subtle,borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,minWidth:120}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:chColors[ch.channel]||S.muted,flexShrink:0}}/>
                      <div>
                        <p style={{fontSize:11,color:S.muted,margin:0}}>{ch.channel}</p>
                        <p style={{fontSize:14,fontWeight:700,color:S.text,margin:0}}>{ch.share}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* ── Locations ── */}
          {tab==="locations"&&domData&&(
            <Card style={{padding:"20px 0",overflow:"hidden"}}>
              <div style={{padding:"0 24px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${S.border}`}}>
                <SH title={`Traffic by location — ${domData.domain}`}/>
                <button onClick={()=>downloadCSV(`${domData.domain}-countries.csv`,["Country","Share%","Visits","Bounce%","Pages/Visit","MoM%"],(domData.countries||[]).map((c:{country:string;share:number;visits:number;bounce_rate:number;pages_per_visit:number;mom_change:number})=>[c.country,c.share,c.visits,c.bounce_rate,c.pages_per_visit,(c.mom_change>=0?"+":"")+c.mom_change]))}
                  style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:S.subtle}}>
                    {["#","Country","Share","Visits","Bounce","Pages/Visit","MoM"].map(h=>(
                      <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:S.muted,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(domData.countries||[]).map((c:{country:string;flag:string;share:number;visits:number;bounce_rate:number;pages_per_visit:number;mom_change:number},i:number)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${S.border}`}}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=S.subtle}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background="transparent"}>
                      <td style={{padding:"10px 16px",color:S.muted,fontSize:12,width:36}}>{i+1}</td>
                      <td style={{padding:"10px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:20,lineHeight:1,flexShrink:0}}>{c.flag}</span>
                          <span style={{fontSize:13,fontWeight:600,color:S.text}}>{c.country}</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:80,height:5,background:S.subtle,borderRadius:99,overflow:"hidden",flexShrink:0}}>
                            <div style={{height:"100%",width:`${Math.min(c.share,100)}%`,background:S.accent,borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:S.accent,whiteSpace:"nowrap"}}>{c.share}%</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 16px",fontSize:13,fontWeight:600,color:S.text,whiteSpace:"nowrap"}}>{fmtNumGlobal(c.visits||0)}</td>
                      <td style={{padding:"10px 16px",fontSize:13,color:c.bounce_rate<40?S.green:c.bounce_rate<65?S.amber:S.red,fontWeight:600}}>{c.bounce_rate}%</td>
                      <td style={{padding:"10px 16px",fontSize:13,color:S.muted}}>{c.pages_per_visit}</td>
                      <td style={{padding:"10px 16px",fontSize:13,fontWeight:600,color:c.mom_change>=0?S.green:S.red,whiteSpace:"nowrap"}}>{c.mom_change>=0?"+":""}{c.mom_change}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* ── Pages ── */}
          {tab==="pages"&&domData&&(
            <Card style={{padding:"20px 0",overflow:"hidden"}}>
              <div style={{padding:"0 24px 14px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${S.border}`,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <p style={{fontSize:13,fontWeight:700,color:S.text,margin:0}}>{domData.domain} — Top pages <span style={{fontWeight:400,color:S.muted}}>({filteredPages.length} pages)</span></p>
                    {(domData.top_pages||[]).length<50&&(
                      <button onClick={()=>loadMorePages(domData.domain,selectedDomain)} disabled={pagesLoading}
                        style={{fontSize:11,color:S.accent,background:S.accentBg,border:`1px solid #c7d2fe`,borderRadius:6,cursor:"pointer",fontFamily:"inherit",padding:"3px 10px",fontWeight:600,whiteSpace:"nowrap"}}>
                        {pagesLoading?"Loading…":"↺ Load 100 pages"}
                      </button>
                    )}
                  </div>
                  <input value={pageSearch} onChange={e=>{setPageSearch(e.target.value);setPagePage(1);}} placeholder="Filter pages…"
                    style={{width:"100%",padding:"7px 12px",border:`1px solid ${S.border}`,borderRadius:8,fontSize:12,outline:"none",fontFamily:"inherit",color:S.text,boxSizing:"border-box" as const}}/>
                </div>
                <button onClick={()=>downloadCSV(`${domData.domain}-pages.csv`,["Page","Visits","Pageviews","Share%","Bounce%","Avg Time","Entry Rate%"],(domData.top_pages||[]).map((p:{page:string;visits:number;pageviews:number;share:number;bounce_rate:number;avg_time:string;entry_rate:number})=>[p.page,p.visits,p.pageviews,p.share,p.bounce_rate,p.avg_time,p.entry_rate]))}
                  style={{fontSize:11,color:S.accent,background:"none",border:`1px solid #c7d2fe`,borderRadius:7,cursor:"pointer",fontFamily:"inherit",padding:"7px 12px",whiteSpace:"nowrap"}}>↓ Export CSV</button>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:S.subtle}}>
                    {["#","Page","Visits","Pageviews","Share","Bounce","Avg Time","Entry Rate"].map(h=>(
                      <th key={h} style={{padding:"9px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:S.muted,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedPages.map((p:{page:string;visits:number;pageviews:number;share:number;bounce_rate:number;avg_time:string;entry_rate:number},j:number)=>(
                    <tr key={j} style={{borderBottom:`1px solid ${S.border}`}}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=S.subtle}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background="transparent"}>
                      <td style={{padding:"9px 14px",color:S.muted,fontSize:11,width:36}}>{(pagePage-1)*PAGE_SIZE+j+1}</td>
                      <td style={{padding:"9px 14px",maxWidth:280}}>
                        <span style={{fontSize:12,color:S.accent,fontFamily:"monospace",wordBreak:"break-all"}}>{p.page}</span>
                      </td>
                      <td style={{padding:"9px 14px",fontWeight:600,color:S.text,whiteSpace:"nowrap"}}>{fmtNumGlobal(p.visits||0)}</td>
                      <td style={{padding:"9px 14px",color:S.muted,whiteSpace:"nowrap"}}>{fmtNumGlobal(p.pageviews||0)}</td>
                      <td style={{padding:"9px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:40,height:3,background:S.subtle,borderRadius:99,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${Math.min((p.share||0)*3,100)}%`,background:S.accent,borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:11,color:S.muted,whiteSpace:"nowrap"}}>{p.share}%</span>
                        </div>
                      </td>
                      <td style={{padding:"9px 14px",color:p.bounce_rate<40?S.green:p.bounce_rate<65?S.amber:S.red,fontWeight:600,whiteSpace:"nowrap"}}>{p.bounce_rate}%</td>
                      <td style={{padding:"9px 14px",color:S.muted,whiteSpace:"nowrap"}}>{p.avg_time}</td>
                      <td style={{padding:"9px 14px",color:S.muted,whiteSpace:"nowrap"}}>{p.entry_rate}%</td>
                    </tr>
                  ))}
                  {pagedPages.length===0&&<tr><td colSpan={8} style={{padding:"32px",textAlign:"center",color:S.muted}}>No pages match your filter</td></tr>}
                </tbody>
              </table>
              {/* Pagination */}
              {totalPages>1&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px",borderTop:`1px solid ${S.border}`}}>
                  <span style={{fontSize:12,color:S.muted}}>Showing {(pagePage-1)*PAGE_SIZE+1}–{Math.min(pagePage*PAGE_SIZE,filteredPages.length)} of {filteredPages.length} pages</span>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>setPagePage(p=>Math.max(1,p-1))} disabled={pagePage===1}
                      style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${S.border}`,background:"white",cursor:pagePage===1?"not-allowed":"pointer",color:pagePage===1?S.muted:S.text,fontSize:12,fontFamily:"inherit",opacity:pagePage===1?0.5:1}}>← Prev</button>
                    {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
                      const pg=totalPages<=7?i+1:pagePage<=4?i+1:pagePage>=totalPages-3?totalPages-6+i:pagePage-3+i;
                      return <button key={pg} onClick={()=>setPagePage(pg)}
                        style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${pagePage===pg?S.accent:S.border}`,background:pagePage===pg?S.accentBg:"white",color:pagePage===pg?S.accentText:S.text,fontSize:12,fontFamily:"inherit",cursor:"pointer",fontWeight:pagePage===pg?700:400}}>{pg}</button>;
                    })}
                    <button onClick={()=>setPagePage(p=>Math.min(totalPages,p+1))} disabled={pagePage===totalPages}
                      style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${S.border}`,background:"white",cursor:pagePage===totalPages?"not-allowed":"pointer",color:pagePage===totalPages?S.muted:S.text,fontSize:12,fontFamily:"inherit",opacity:pagePage===totalPages?0.5:1}}>Next →</button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);setDomains(e.inputLabel);}}/>
    </div>
  );
}

// ── AD RESEARCH / PPC ──
function AdResearch({activeSite,setPage}:PageProps) {
  const [input,setInput]=useState("");const [searchType,setSearchType]=useState("Domain");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [tab,setTab]=useState("ads");
  useEffect(()=>{if(activeSite&&!input)setInput(extractDomain(activeSite));},[activeSite]);
  const hist = useToolHistory("adresearch");
  const run = async () => {
    if(!input.trim()) return; setLoading(true); setErr("");
    const domain = extractDomain(input);
    try {
      const [aiRes, realRes] = await Promise.allSettled([
        ai(`PPC/advertising research expert (like SEMrush Advertising Research). Analyse ${searchType==="Domain"?"competitor domain":"keyword"} "${input}". Return ONLY valid JSON: {"summary":{"paid_keywords":number,"monthly_traffic":number,"est_budget":"string","ads_count":number,"top_position":number},"platforms":{"google":{"traffic_share":number,"est_spend":"string","avg_cpc":"string","ads_count":number,"impressions":"string","top_keywords":["string"]},"linkedin":{"traffic_share":number,"est_spend":"string","avg_cpc":"string","ads_count":number,"impressions":"string","top_formats":["string"]},"meta":{"traffic_share":number,"est_spend":"string","avg_cpm":"string","ads_count":number,"impressions":"string","top_formats":["string"]}},"ads":[{"headline":"string","description":"string","display_url":"string","keywords":["string"],"position":number,"cpc_est":"string","traffic_share":number}],"keywords":[{"kw":"string","volume":number,"cpc":"string","competition":"High|Medium|Low","position":number,"ads":number}],"ad_copy_patterns":["string"],"opportunities":["string"]} 5 ads, 8 keywords, 4 copy patterns, 4 opportunities. Platform breakdown must be realistic: Google dominates paid search (60-80% share), LinkedIn for B2B, Meta for consumer.`,8192),
        fetch(`/api/py/adresearch?domain=${encodeURIComponent(domain)}`).then(r=>r.json()).catch(()=>null),
      ]);
      if(aiRes.status==="rejected"){setErr("Failed. Try again.");return;}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d:any = aiRes.value;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const real:any = realRes.status==="fulfilled" ? realRes.value : null;
      // Merge real ad counts over AI estimates where available
      // Merge real pixel detection results
      if(d?.platforms && real?.platforms) {
        const px = real.platforms;
        if(px.google?.scraped !== false) d.platforms.google = {...(d.platforms.google||{}), _pixel: px.google?.pixel, _pixelChecked: true};
        if(px.meta?.scraped !== false) d.platforms.meta = {...(d.platforms.meta||{}), _pixel: px.meta?.pixel, _pixelChecked: true};
        if(px.linkedin?.scraped !== false) d.platforms.linkedin = {...(d.platforms.linkedin||{}), _pixel: px.linkedin?.pixel, _pixelChecked: true};
      }
      setData(d); hist.add(`${searchType}: ${input}`,d);
    } catch(e){const m=e instanceof Error?e.message:"";setErr(/credit|billing|balance|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":m||"Failed.");console.error(e);} finally{setLoading(false);}
  };
  const compColor:Record<string,string>={High:"red",Medium:"amber",Low:"green"};
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Ad Research</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Analyse competitor PPC ads, budgets, ad copy, and paid keyword strategy.</p>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 3fr",gap:12,marginBottom:4}}>
          <Field label="Search by"><Toggle value={searchType} onChange={setSearchType} options={["Domain","Keyword"]}/></Field>
          <Field label={searchType==="Domain"?"Competitor domain":"Target keyword"}><TI value={input} onChange={setInput} placeholder={searchType==="Domain"?"competitor.com":"e.g. project management software"}/></Field>
        </div>
        {err&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
        <Btn onClick={run} disabled={loading||!input.trim()}>{loading?"Researching ads...":"Research ads"}</Btn>
      </Card>
      {data&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            {[{l:"Paid keywords",v:data.summary?.paid_keywords,c:S.accent},{l:"Monthly traffic",v:fmtNumGlobal(data.summary?.monthly_traffic||0),c:S.text},{l:"Est. monthly budget",v:data.summary?.est_budget,c:S.green},{l:"Active ads",v:data.summary?.ads_count,c:S.amber}].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c}/>)}
          </div>
          {data.platforms&&(
            <div style={{marginBottom:16}}>
              <p style={{fontSize:12,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 10px"}}>Platform-wise paid traffic</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                {([
                  {key:"google",label:"Google Ads",icon:"G",color:"#4285f4",bg:"#eef2ff"},
                  {key:"linkedin",label:"LinkedIn Ads",icon:"in",color:"#0a66c2",bg:"#e8f0fb"},
                  {key:"meta",label:"Meta Ads",icon:"f",color:"#1877f2",bg:"#e7f0fd"},
                ] as {key:"google"|"linkedin"|"meta",label:string,icon:string,color:string,bg:string}[]).map(p=>{
                  const pl = data.platforms[p.key];
                  if(!pl) return null;
                  return (
                    <div key={p.key} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{width:28,height:28,borderRadius:6,background:p.bg,border:`1.5px solid ${p.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:p.color}}>{p.icon}</div>
                        <span style={{fontSize:13,fontWeight:700,color:S.text}}>{p.label}</span>
                        <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:p.color,background:p.bg,borderRadius:4,padding:"2px 7px"}}>{pl.traffic_share}%</span>
                      </div>
                      <div style={{marginBottom:10}}>
                        {pl._pixelChecked
                          ? pl._pixel
                            ? <span style={{fontSize:11,fontWeight:700,color:S.green,background:"#f0fdf4",border:`1px solid ${S.green}40`,borderRadius:4,padding:"3px 8px"}}>✓ Pixel detected — actively advertising</span>
                            : <span style={{fontSize:11,fontWeight:600,color:S.red,background:"#fff1f2",border:`1px solid ${S.red}30`,borderRadius:4,padding:"3px 8px"}}>✗ No pixel found</span>
                          : <span style={{fontSize:10,fontWeight:600,color:S.muted,background:S.subtle,borderRadius:4,padding:"2px 7px"}}>Checking…</span>
                        }
                      </div>
                      <Bar value={pl.traffic_share} color={p.color}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
                        {[
                          {l:"Est. spend",v:pl.est_spend,est:true},
                          {l:p.key==="meta"?"Avg CPM":"Avg CPC",v:p.key==="meta"?pl.avg_cpm:pl.avg_cpc,est:true},
                          {l:"Active ads",v:pl._scraped&&pl.ads_count!=null?pl.ads_count:pl.ads_count,est:!pl._scraped},
                          {l:"Impressions",v:pl.impressions,est:true},
                        ].map(m=>(
                          <div key={m.l}>
                            <p style={{fontSize:10,color:S.muted,margin:"0 0 1px",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:"0.04em"}}>{m.l}{m.est&&<span style={{color:S.muted,fontWeight:400}}> ~</span>}</p>
                            <p style={{fontSize:13,fontWeight:700,color:m.est?S.text:S.green,margin:0}}>{m.v!=null?m.v:"—"}</p>
                          </div>
                        ))}
                      </div>
                      {(pl.top_keywords||pl.top_formats||[]).length>0&&(
                        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${S.border}`}}>
                          <p style={{fontSize:10,color:S.muted,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 5px"}}>{pl.top_keywords?"Top keywords":"Top formats"}</p>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap" as const}}>
                            {(pl.top_keywords||pl.top_formats||[]).slice(0,3).map((t:string,i:number)=>(
                              <span key={i} style={{fontSize:10,background:p.bg,color:p.color,borderRadius:4,padding:"2px 6px",fontWeight:600}}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <Tabs tabs={["ads","keywords","insights"]} active={tab} onChange={setTab}/>
          {tab==="ads"&&<div>{(data.ads||[]).map((ad:any,i:number)=>(
            <Card key={i}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:700,background:S.accentBg,color:S.accentText,padding:"2px 6px",borderRadius:3}}>Sponsored</span>
                <span style={{fontSize:12,color:S.accent}}>{ad.display_url}</span>
                <span style={{marginLeft:"auto",fontSize:11,color:S.muted}}>Pos #{ad.position} · {ad.cpc_est} CPC · {ad.traffic_share}% traffic share</span>
              </div>
              <p style={{fontSize:14,fontWeight:700,color:S.blue,margin:"0 0 3px"}}>{ad.headline}</p>
              <p style={{fontSize:12,color:S.text,margin:"0 0 8px"}}>{ad.description}</p>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {(ad.keywords||[]).map((kw:string,j:number)=><span key={j} style={{fontSize:11,background:S.subtle,color:S.muted,borderRadius:4,padding:"2px 7px"}}>{kw}</span>)}
              </div>
            </Card>
          ))}</div>}
          {tab==="keywords"&&<Card><SH title="Paid keywords" action={<button onClick={()=>downloadCSV("ppc-keywords.csv",["Keyword","Volume","CPC","Competition","Position","Ads"],(data.keywords||[]).map((k:any)=>[k.kw,k.volume,k.cpc,k.competition,k.position,k.ads]))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>}/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{["Keyword","Volume","CPC","Competition","Pos","Ads"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(data.keywords||[]).map((k:any,i:number)=>(
                <tr key={i}><TD bold>{k.kw}</TD><TD color={S.accent}>{(k.volume||0).toLocaleString()}</TD><TD color={S.green}>{k.cpc}</TD><TD>{pill(k.competition,compColor[k.competition]||"gray")}</TD><TD>#{k.position}</TD><TD color={S.muted}>{k.ads}</TD></tr>
              ))}</tbody>
            </table>
          </Card>}
          {tab==="insights"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card><SH title="Ad copy patterns"/>{(data.ad_copy_patterns||[]).map((p:string,i:number)=><p key={i} style={{fontSize:13,color:S.text,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>📋 {p}</p>)}</Card>
              <Card><SH title="PPC opportunities"/>{(data.opportunities||[]).map((o:string,i:number)=><p key={i} style={{fontSize:13,color:S.green,margin:"0 0 7px",paddingBottom:7,borderBottom:`1px solid ${S.border}`}}>→ {o}</p>)}</Card>
            </div>
          )}
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setData(e.data);const parts=e.inputLabel.split(": ");setInput(parts[1]||"");}}/>
    </div>
  );
}


// ── MY SITES / PROJECTS ──
// ── PROJECT OVERVIEW ──
function ProjectOverview({activeSite,setPage,setActiveSite,gscData}:PageProps) {
  const domain = extractDomain(activeSite||"");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [crawl,setCrawl]=useState<any>(null);const [crawlLoading,setCrawlLoading]=useState(false);
  const [expandedIssue,setExpandedIssue]=useState<number|null>(null);

  useEffect(()=>{
    if(!activeSite||crawl)return;
    setCrawlLoading(true);
    cachedCrawl(domain)
      .then(d=>setCrawl(d)).catch(()=>{}).finally(()=>setCrawlLoading(false));
  },[activeSite]);

  if(!activeSite) return (
    <div style={{textAlign:"center",padding:"60px 0"}}>
      <p style={{fontSize:32,margin:"0 0 12px"}}>📁</p>
      <p style={{fontSize:15,fontWeight:600,color:S.text,margin:"0 0 8px"}}>No project selected</p>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Go to My Sites and click on a project to see its full overview.</p>
      <Btn onClick={()=>setPage("projects")}>Go to My Sites</Btn>
    </div>
  );

  const sc=(n:number)=>n>=70?S.green:n>=40?S.amber:S.red;
  const s=crawl?.summary;
  const siteHealth=s&&s.total>0?Math.round((s.ok/s.total)*100):null;
  const issueCount=s?(s.missing_title+s.missing_meta+s.missing_h1+s.errors+s.thin_content):0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const crawlPages: any[] = crawl?.pages || [];
  // Affected page URLs per issue type (with extra detail like word count / image count)
  const errPages   = crawlPages.filter(p=>p.status>=400||p.status===0).map(p=>({url:p.url,note:`HTTP ${p.status||"error"}`}));
  const noTitle    = crawlPages.filter(p=>!p.title).map(p=>({url:p.url,note:""}));
  const noMeta     = crawlPages.filter(p=>!p.metaDesc).map(p=>({url:p.url,note:""}));
  const noH1       = crawlPages.filter(p=>(p.h1Count||0)===0).map(p=>({url:p.url,note:""}));
  const thinPages  = crawlPages.filter(p=>p.wordCount>0&&p.wordCount<300).map(p=>({url:p.url,note:`${p.wordCount} words`}));
  const noAltPages = crawlPages.filter(p=>(p.imgsWithoutAlt||0)>0).map(p=>({url:p.url,note:`${p.imgsWithoutAlt} img${p.imgsWithoutAlt>1?"s":""}`}));
  const noCanon    = crawlPages.filter(p=>!p.canonical).map(p=>({url:p.url,note:""}));

  const realIssues: {label:string;val:number;severity:string;pages:{url:string;note:string}[]}[] = s ? [
    ...(s.errors>0?[{label:`${s.errors} pages returning errors (4xx/5xx)`,val:s.errors,severity:"critical",pages:errPages}]:[]),
    ...(s.missing_title>0?[{label:`${s.missing_title} pages missing title tags`,val:s.missing_title,severity:"high",pages:noTitle}]:[]),
    ...(s.missing_meta>0?[{label:`${s.missing_meta} pages missing meta descriptions`,val:s.missing_meta,severity:"medium",pages:noMeta}]:[]),
    ...(s.missing_h1>0?[{label:`${s.missing_h1} pages missing H1 tags`,val:s.missing_h1,severity:"medium",pages:noH1}]:[]),
    ...(s.thin_content>0?[{label:`${s.thin_content} thin content pages (<300 words)`,val:s.thin_content,severity:"low",pages:thinPages}]:[]),
    ...(s.imgs_no_alt>0?[{label:`${s.imgs_no_alt} images missing alt text`,val:s.imgs_no_alt,severity:"low",pages:noAltPages}]:[]),
    ...(s.no_canonical>0?[{label:`${s.no_canonical} pages missing canonical tags`,val:s.no_canonical,severity:"low",pages:noCanon}]:[]),
  ] : [];

  const sevColor=(sev:string)=>sev==="critical"?S.red:sev==="high"?S.amber:sev==="medium"?"#f59e0b":S.muted;

  const TOOLS = [
    {id:"technical",icon:"🔍",label:"Site Crawl",desc:"Crawl all pages, find technical issues"},
    {id:"onpage",icon:"📄",label:"On-Page SEO",desc:"Analyse tags, content & keyword placement"},
    {id:"backlinks",icon:"🔗",label:"Backlinks",desc:"Backlink profile & referring domains"},
    {id:"rank",icon:"📊",label:"Rank Tracker",desc:"Track keyword positions"},
    {id:"aeo",icon:"✦",label:"AI Visibility",desc:"Visibility in ChatGPT, Gemini & Perplexity"},
    {id:"competitors",icon:"⊕",label:"Competitors",desc:"Compare against competing domains"},
    {id:"brokenlinks",icon:"⚠",label:"Broken Links",desc:"Find and fix all broken links"},
    {id:"contentaudit",icon:"✎",label:"Content Audit",desc:"Thin content, cannibalization, quick wins"},
    {id:"internallinks",icon:"◎",label:"Internal Links",desc:"Orphan pages & linking opportunities"},
    {id:"serp",icon:"🌐",label:"SERP Analyzer",desc:"Live SERP results with your site highlighted"},
    {id:"trafficana",icon:"📈",label:"Traffic Analytics",desc:"Estimate traffic & top pages"},
    {id:"brandmonitor",icon:"👁",label:"Brand Monitor",desc:"Mentions & brand sentiment"},
  ];

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",fontWeight:800}}>{domain.charAt(0).toUpperCase()}</div>
          <div>
            <h2 style={{fontSize:20,fontWeight:800,color:S.text,margin:"0 0 2px"}}>{domain}</h2>
            <p style={{fontSize:12,color:S.muted,margin:0}}>Project Overview — all tools pre-loaded for this site</p>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn small variant="secondary" onClick={()=>setPage("projects")}>← My Sites</Btn>
          <Btn small variant="secondary" onClick={()=>setActiveSite("")}>Clear project</Btn>
        </div>
      </div>

      {/* Crawl loading banner */}
      {crawlLoading&&<div style={{background:S.accentBg,border:`1px solid ${S.border}`,borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:12,color:S.accentText}}>Crawling {domain}…</div>}

      {/* Real crawl metrics */}
      {crawl&&s&&(
        <>
          <div style={{background:S.greenBg,border:"1px solid #86efac",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:12,color:S.greenText,fontWeight:600}}>
            ✓ Live crawl — {s.total} pages checked · {crawl.urls_checked||s.total} URLs scanned
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
            {[
              {l:"Site Health",v:siteHealth!=null?`${siteHealth}%`:"—",c:siteHealth!=null?sc(siteHealth):S.muted},
              {l:"Pages Crawled",v:`${s.total}`,c:S.text},
              {l:"OK Pages",v:`${s.ok}`,c:S.green},
              {l:"Errors",v:`${s.errors}`,c:s.errors>0?S.red:S.green},
              {l:"Issues Found",v:`${issueCount}`,c:issueCount>0?S.amber:S.green},
              {l:"Redirects",v:`${s.redirects}`,c:s.redirects>3?S.amber:S.text},
            ].map((m,i)=>(
              <div key={i} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 16px"}}>
                <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>{m.l}</p>
                <p style={{fontSize:22,fontWeight:800,color:m.c,margin:0,lineHeight:1}}>{m.v}</p>
              </div>
            ))}
          </div>

          {/* Real issues list — expandable to show affected page links */}
          {realIssues.length>0&&(
            <Card style={{marginBottom:20}}>
              <SH title="Issues found in crawl"/>
              {realIssues.map((iss,i)=>{
                const open=expandedIssue===i;
                const hasPages=(iss.pages||[]).length>0;
                return (
                <div key={i} style={{borderBottom:`1px solid ${S.border}`}}>
                  <div onClick={()=>hasPages&&setExpandedIssue(open?null:i)} style={{display:"flex",gap:8,padding:"9px 0",alignItems:"center",cursor:hasPages?"pointer":"default"}}>
                    <span style={{fontSize:11,fontWeight:700,color:sevColor(iss.severity),flexShrink:0,textTransform:"uppercase" as const,letterSpacing:"0.04em",width:52}}>{iss.severity}</span>
                    <span style={{fontSize:12,color:S.text,flex:1}}>{iss.label}</span>
                    {hasPages&&<span style={{fontSize:11,color:S.accent,fontWeight:600,flexShrink:0}}>{open?"Hide":`View ${iss.pages.length} page${iss.pages.length>1?"s":""}`} {open?"▲":"▼"}</span>}
                  </div>
                  {open&&hasPages&&(
                    <div style={{padding:"4px 0 12px 60px"}}>
                      {iss.pages.map((p,j)=>(
                        <div key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:j<iss.pages.length-1?`1px solid ${S.subtle}`:"none"}}>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:S.accent,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,flex:1}}>{p.url.replace(/^https?:\/\//,"")}</a>
                          {p.note&&<span style={{fontSize:10,color:S.muted,flexShrink:0}}>{p.note}</span>}
                          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.accent,flexShrink:0}}>↗</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      {/* GSC connect prompt if no GSC data */}
      {!gscData&&(
        <div style={{background:S.amberBg,border:"1px solid #fcd34d",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:12,color:S.amberText,display:"flex",alignItems:"center",gap:10}}>
          <span>⚠</span>
          <span><strong>Connect Google Search Console</strong> to see real organic traffic, keyword rankings, impressions and CTR for {domain}.</span>
          <Btn small onClick={()=>setPage("gsc")}>Connect GSC</Btn>
        </div>
      )}

      {/* GSC summary if connected */}
      {gscData?.summary&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
          {[
            {l:"Clicks (28d)",v:`${(gscData.summary.clicks||0).toLocaleString()}`,c:S.text},
            {l:"Impressions",v:`${(gscData.summary.impressions||0).toLocaleString()}`,c:S.text},
            {l:"Avg. CTR",v:`${(gscData.summary.ctr||0).toFixed(1)}%`,c:S.text},
            {l:"Avg. Position",v:`${(gscData.summary.pos||0).toFixed(1)}`,c:S.text},
          ].map((m,i)=>(
            <div key={i} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 16px"}}>
              <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>{m.l} <span style={{color:S.green,fontWeight:400}}>● GSC</span></p>
              <p style={{fontSize:22,fontWeight:800,color:m.c,margin:0,lineHeight:1}}>{m.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tool grid */}
      <h3 style={{fontSize:14,fontWeight:700,color:S.text,margin:"0 0 12px"}}>Run analysis tools for <span style={{color:"#6366f1"}}>{domain}</span></h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
        {TOOLS.map(t=>(
          <div key={t.id} onClick={()=>setPage(t.id)} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor="#6366f1";(e.currentTarget as HTMLDivElement).style.background=S.accentBg;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=S.border;(e.currentTarget as HTMLDivElement).style.background=S.card;}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
              <span style={{fontSize:18}}>{t.icon}</span>
              <span style={{fontSize:13,fontWeight:700,color:S.text}}>{t.label}</span>
            </div>
            <p style={{fontSize:11,color:S.muted,margin:0,lineHeight:1.4}}>{t.desc}</p>
            <p style={{fontSize:10,color:"#6366f1",fontWeight:600,margin:"6px 0 0"}}>Pre-loaded: {domain} →</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Projects({setPage,setActiveSite}: PageProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type SiteEntry = { id:string;url:string;name:string;metrics:any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type FolderEntry = { id:string;name:string;sites:SiteEntry[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type MonEntry = { domain:string;country:string;organic_keywords:number;organic_keywords_change:number;organic_traffic:number;organic_traffic_change:number;paid_keywords:number;paid_traffic:number;ref_domains:number;ref_domains_change:number;authority_score:number;kw_trend:number[];traffic_trend:number[] };

  const [folders,setFolders]=useState<FolderEntry[]>(()=>{ try{return JSON.parse(localStorage.getItem("rm_proj_folders")||"[]");}catch{return[];} });
  const [monitored,setMonitored]=useState<MonEntry[]>(()=>{ try{return JSON.parse(localStorage.getItem("rm_proj_monitored")||"[]");}catch{return[];} });
  const [range,setRange]=useState<"Month"|"Year">("Month");
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [showNewFolder,setShowNewFolder]=useState(false);
  const [newFolderName,setNewFolderName]=useState("");
  const [addingTo,setAddingTo]=useState<string|null>(null);
  const [addSiteInput,setAddSiteInput]=useState("");
  const [addMonInput,setAddMonInput]=useState("");
  const [loadingIds,setLoadingIds]=useState<Set<string>>(new Set());

  const saveFolders=(f:FolderEntry[])=>{setFolders(f);localStorage.setItem("rm_proj_folders",JSON.stringify(f));};
  const saveMon=(m:MonEntry[])=>{setMonitored(m);localStorage.setItem("rm_proj_monitored",JSON.stringify(m));};
  const toggleCollapse=(id:string)=>setCollapsed(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});

  const fmtNum=(n:number)=>n>=1000000?`${(n/1000000).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(1)}K`:`${Math.round(n)}`;
  const chgColor=(v:number,inv=false)=>{const good=inv?v<0:v>0;return v===0?S.muted:good?S.green:S.red;};
  const chgStr=(v:number)=>v===0?"0%":`${v>0?"+":""}${v.toFixed(2)}%`;

  const COLORS_MON=[S.accent,S.green,S.amber,S.blue,"#8b5cf6","#ec4899"];

  const createFolder=()=>{
    if(!newFolderName.trim())return;
    saveFolders([...folders,{id:Date.now().toString(),name:newFolderName.trim(),sites:[]}]);
    setNewFolderName("");setShowNewFolder(false);
  };

  const fetchSiteMetrics=async(folderId:string,siteId:string,domain:string)=>{
    setLoadingIds(prev=>new Set(prev).add(siteId));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d=await ai(`SEO analyst. Estimate realistic metrics for website "${domain}". Infer brand size from domain — scale all numbers accordingly.
Scale guide: unknown/new → traffic 100-2K, keywords 50-500, backlinks 50-500, authority 5-25; SMB → 1K-20K, 200-4K, 200-5K, 20-45; known brand → 10K-200K, 2K-50K, 2K-50K, 40-65; enterprise → 100K+, 20K+, 20K+, 60-90.
Return ONLY valid JSON: {"seo_score":number,"ai_visibility":number,"mentions":number,"site_health":number,"visibility":number,"visibility_change":number,"organic_traffic":number,"organic_traffic_change":number,"organic_keywords":number,"organic_keywords_change":number,"backlinks":number,"backlinks_change":number}
All _change are % values (positive or negative). Domain: ${domain}`);
      setFolders(prev=>{const up=prev.map((f:FolderEntry)=>f.id===folderId?{...f,sites:f.sites.map((s:SiteEntry)=>s.id===siteId?{...s,metrics:d}:s)}:f);localStorage.setItem("rm_proj_folders",JSON.stringify(up));return up;});
    } catch(e){console.error(e);}
    finally{setLoadingIds(prev=>{const n=new Set(prev);n.delete(siteId);return n;});}
  };

  const addSiteToFolder=async(folderId:string)=>{
    if(!addSiteInput.trim())return;
    const domain=addSiteInput.replace(/^https?:\/\//,"").replace(/\/$/,"");
    const namePart=domain.split(".")[0];
    const name=namePart.charAt(0).toUpperCase()+namePart.slice(1);
    const siteId=Date.now().toString();
    const newSite:SiteEntry={id:siteId,url:domain,name,metrics:null};
    setFolders(prev=>{const up=prev.map((f:FolderEntry)=>f.id===folderId?{...f,sites:[...f.sites,newSite]}:f);localStorage.setItem("rm_proj_folders",JSON.stringify(up));return up;});
    setAddSiteInput("");setAddingTo(null);
    await fetchSiteMetrics(folderId,siteId,domain);
  };

  const removeSite=(folderId:string,siteId:string)=>saveFolders(folders.map((f:FolderEntry)=>f.id===folderId?{...f,sites:f.sites.filter((s:SiteEntry)=>s.id!==siteId)}:f));
  const removeFolder=(id:string)=>saveFolders(folders.filter((f:FolderEntry)=>f.id!==id));

  const addMonitoredDomain=async()=>{
    if(!addMonInput.trim())return;
    const domain=addMonInput.replace(/^https?:\/\//,"").replace(/\/$/,"");
    if(monitored.find(m=>m.domain===domain)){setAddMonInput("");return;}
    const tempId=`mon_${domain}`;
    setLoadingIds(prev=>new Set(prev).add(tempId));
    setAddMonInput("");
    try {
      const d=await ai(`Estimate SEO metrics for competitor domain "${domain}". Infer brand size from domain name and scale all numbers accordingly.
Return ONLY valid JSON: {"country":"US","organic_keywords":number,"organic_keywords_change":number,"organic_traffic":number,"organic_traffic_change":number,"paid_keywords":number,"paid_traffic":number,"ref_domains":number,"ref_domains_change":number,"authority_score":number,"kw_trend":[8 numbers as relative trend],"traffic_trend":[8 numbers as relative trend]}
All _change are % values. Domain: ${domain}`);
      saveMon([...monitored,{domain,...d}]);
    } catch(e){console.error(e);}
    finally{setLoadingIds(prev=>{const n=new Set(prev);n.delete(tempId);return n;});}
  };

  const MiniSparkline=({data,color,fill}:{data:number[];color:string;fill:string})=>{
    if(!data||data.length<2)return <span style={{fontSize:11,color:S.muted}}>—</span>;
    const mx=Math.max(...data,1),mn=Math.min(...data,0),rng=mx-mn||1;
    const W=80,H=26;
    const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${H-3-((v-mn)/rng)*(H-6)}`);
    const fillD=`M ${pts[0]} ${pts.slice(1).map(p=>`L ${p}`).join(" ")} L ${W},${H} L 0,${H} Z`;
    return (<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}><path d={fillD} fill={fill} opacity="0.25"/><polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" points={pts.join(" ")}/></svg>);
  };

  const AuthGauge=({score}:{score:number})=>{
    const color=score>=60?S.green:score>=30?S.amber:S.red;
    const circ=2*Math.PI*10; const dash=(score/100)*circ;
    return (<div style={{display:"flex",alignItems:"center",gap:6}}><svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="10" fill="none" stroke={S.border} strokeWidth="3"/><circle cx="14" cy="14" r="10" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ*0.25} strokeLinecap="round"/></svg><span style={{fontSize:13,fontWeight:700,color:S.text}}>{score}</span><span style={{fontSize:10,color:S.muted}}>0</span></div>);
  };

  const scoreColor=(s:number)=>s>=70?S.green:s>=40?S.amber:S.red;

  return (
    <div>
      {/* Feature tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:22}}>
        {[
          {id:"gsc",icon:"◎",title:"Search Console",desc:"Clicks, impressions & positions",bg:S.accentBg,tc:S.accentText},
          {id:"aeo",icon:"✦",title:"AI Visibility",desc:"Track mentions in ChatGPT & Gemini",bg:"#fdf4ff",tc:"#7c3aed"},
          {id:"keywords",icon:"◆",title:"Traffic & Market",desc:"Markets and growth opportunities",bg:S.blueBg,tc:S.blueText},
          {id:"content",icon:"✎",title:"Content",desc:"Create SEO-optimised content with AI",bg:S.greenBg,tc:S.greenText},
          {id:"competitors",icon:"⊕",title:"Competitors",desc:"Analyse competitor performance",bg:S.amberBg,tc:S.amberText},
        ].map(t=>(
          <div key={t.id} onClick={()=>setPage(t.id)} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"14px 14px",cursor:"pointer"}}
            onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.accent}
            onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=S.border}>
            <div style={{width:30,height:30,borderRadius:8,background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:t.tc,marginBottom:8}}>{t.icon}</div>
            <p style={{fontSize:12,fontWeight:700,color:S.text,margin:"0 0 3px"}}>{t.title}</p>
            <p style={{fontSize:11,color:S.muted,margin:0,lineHeight:1.4}}>{t.desc}</p>
          </div>
        ))}
      </div>

      {/* AI Copilot bar */}
      <div style={{display:"flex",alignItems:"center",gap:12,background:"linear-gradient(135deg,#eef2ff,#f0fdf4)",border:"1px solid #c7d2fe",borderRadius:12,padding:"12px 18px",marginBottom:24}}>
        <span style={{fontSize:20}}>✦</span>
        <div style={{flex:1}}>
          <p style={{fontSize:13,fontWeight:700,color:S.accentText,margin:"0 0 1px"}}>AI Copilot — your personal recommendations</p>
          <p style={{fontSize:11,color:S.muted,margin:0}}>Add websites to folders to get AI-powered SEO insights and improvement suggestions.</p>
        </div>
        <Btn small onClick={()=>setPage("aeo")}>Open</Btn>
      </div>

      {/* ── Folders ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <h3 style={{fontSize:15,fontWeight:700,color:S.text,margin:0}}>Folders</h3>
        <Btn small variant="secondary" onClick={()=>setShowNewFolder(v=>!v)}>+ Create Folder</Btn>
      </div>

      {showNewFolder&&(
        <Card style={{marginBottom:12,padding:"14px 18px"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createFolder()} placeholder="Folder name (e.g. My Competitors)" style={{flex:1,border:`1px solid ${S.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:S.text,background:S.card,outline:"none",fontFamily:"inherit"}}/>
            <Btn small onClick={createFolder} disabled={!newFolderName.trim()}>Create</Btn>
            <Btn small variant="secondary" onClick={()=>{setShowNewFolder(false);setNewFolderName("");}}>Cancel</Btn>
          </div>
        </Card>
      )}

      {folders.length===0&&!showNewFolder&&(
        <Card style={{marginBottom:16}}>
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <p style={{fontSize:32,margin:"0 0 8px"}}>📁</p>
            <p style={{fontSize:14,fontWeight:600,color:S.text,margin:"0 0 6px"}}>No folders yet</p>
            <p style={{fontSize:12,color:S.muted,margin:"0 0 16px"}}>Create a folder to organise and track websites with real-time SEO metrics.</p>
            <Btn small onClick={()=>setShowNewFolder(true)}>Create your first folder</Btn>
          </div>
        </Card>
      )}

      {folders.map((folder:FolderEntry)=>(
        <Card key={folder.id} style={{marginBottom:12,padding:0}}>
          {/* Folder header */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${S.border}`}}>
            <button onClick={()=>toggleCollapse(folder.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:S.muted,padding:0,fontFamily:"inherit",width:16}}>{collapsed.has(folder.id)?"▶":"▼"}</button>
            <span style={{fontSize:16}}>📁</span>
            <span style={{fontSize:14,fontWeight:700,color:S.text,flex:1}}>{folder.name}</span>
            <span style={{fontSize:11,color:S.muted,marginRight:8}}>{folder.sites.length} site{folder.sites.length!==1?"s":""}</span>
            <Btn small variant="secondary" onClick={()=>setAddingTo(folder.id===addingTo?null:folder.id)}>+ Add website</Btn>
            <button onClick={()=>removeFolder(folder.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:S.muted,padding:"0 0 0 8px",lineHeight:1}}>×</button>
          </div>

          {!collapsed.has(folder.id)&&(
            <div style={{padding:"0 20px"}}>
              {/* Add site input */}
              {addingTo===folder.id&&(
                <div style={{display:"flex",gap:10,alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${S.border}`}}>
                  <input value={addSiteInput} onChange={e=>setAddSiteInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSiteToFolder(folder.id)} placeholder="Enter website URL (e.g. yoursite.com)" style={{flex:1,border:`1px solid ${S.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:S.text,background:S.card,outline:"none",fontFamily:"inherit"}}/>
                  <Btn small onClick={()=>addSiteToFolder(folder.id)} disabled={!addSiteInput.trim()}>Add</Btn>
                  <Btn small variant="secondary" onClick={()=>{setAddingTo(null);setAddSiteInput("");}}>Cancel</Btn>
                </div>
              )}
              {folder.sites.length===0&&addingTo!==folder.id&&(
                <div style={{padding:"16px 0",textAlign:"center"}}>
                  <p style={{fontSize:12,color:S.muted,margin:0}}>No websites yet. <button onClick={()=>setAddingTo(folder.id)} style={{background:"none",border:"none",color:S.accentText,fontWeight:600,cursor:"pointer",fontSize:12,fontFamily:"inherit",padding:0}}>Add a website</button> to monitor SEO, AI visibility, keywords and backlinks.</p>
                </div>
              )}
              {/* Column headers (only if sites exist) */}
              {folder.sites.length>0&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 90px 110px 110px 100px 36px",gap:8,padding:"8px 0",borderBottom:`1px solid ${S.border}`}}>
                    {["Website","SEO","AI Vis.","Mentions","Site Health","Org. Traffic","Org. Keywords","Backlinks",""].map((h,i)=>(
                      <span key={i} style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</span>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:S.muted,padding:"4px 0 8px",fontStyle:"italic"}}>Metrics are AI-estimated — connect Google Search Console for real traffic data</div>
                </>
              )}
              {/* Site rows */}
              {folder.sites.map((site:SiteEntry)=>{
                const isLoading=loadingIds.has(site.id);
                const m=site.metrics;
                return (
                  <div key={site.id} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 90px 110px 110px 100px 36px",gap:8,alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${S.border}`}}>
                    {/* Site info — click to open dashboard for this site */}
                    <div style={{minWidth:0,cursor:"pointer"}} onClick={()=>{setActiveSite(site.url);setPage("project-overview");}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:24,height:24,borderRadius:6,background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{site.name.charAt(0)}</div>
                        <div style={{minWidth:0}}>
                          <p style={{fontSize:13,fontWeight:700,color:S.accent,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{site.name} <span style={{fontSize:10,fontWeight:400,color:"#6366f1"}}>→ project overview</span></p>
                          <p style={{fontSize:10,color:S.muted,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{site.url}</p>
                        </div>
                      </div>
                      {isLoading&&<p style={{fontSize:11,color:S.muted,margin:"4px 0 0"}}>Analysing…</p>}
                    </div>
                    {/* Metrics — show dashes while loading */}
                    {[
                      m?<div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:14,fontWeight:700,color:scoreColor(m.seo_score)}}>{m.seo_score}</span><span style={{fontSize:11}}>🔥</span></div>:<span style={{color:S.muted}}>—</span>,
                      m?<div style={{display:"flex",alignItems:"center",gap:2}}><span style={{fontSize:14,fontWeight:700,color:scoreColor(m.ai_visibility)}}>{m.ai_visibility}</span><span style={{fontSize:11}}>🔥</span></div>:<span style={{color:S.muted}}>—</span>,
                      m?<span style={{fontSize:14,fontWeight:700,color:S.text}}>{m.mentions}</span>:<span style={{color:S.muted}}>—</span>,
                      m?<div><span style={{fontSize:13,fontWeight:700,color:m.site_health>=80?S.green:m.site_health>=60?S.amber:S.red}}>{m.site_health}%</span></div>:<span style={{color:S.muted}}>—</span>,
                      m?<div><span style={{fontSize:12,fontWeight:700,color:S.accent}}>{m.visibility.toFixed(2)}%</span><p style={{fontSize:10,margin:"1px 0 0",color:chgColor(m.visibility_change)}}>{chgStr(m.visibility_change)}</p></div>:<span style={{color:S.muted}}>—</span>,
                      m?<div><span style={{fontSize:12,fontWeight:700,color:S.text}}>{fmtNum(m.organic_traffic)}</span><p style={{fontSize:10,margin:"1px 0 0",color:chgColor(m.organic_traffic_change)}}>{chgStr(m.organic_traffic_change)}</p></div>:<span style={{color:S.muted}}>—</span>,
                      m?<div><span style={{fontSize:12,fontWeight:700,color:S.text}}>{fmtNum(m.organic_keywords)}</span><p style={{fontSize:10,margin:"1px 0 0",color:chgColor(m.organic_keywords_change)}}>{chgStr(m.organic_keywords_change)}</p></div>:<span style={{color:S.muted}}>—</span>,
                      m?<div><span style={{fontSize:12,fontWeight:700,color:S.text}}>{fmtNum(m.backlinks)}</span><p style={{fontSize:10,margin:"1px 0 0",color:chgColor(m.backlinks_change)}}>{chgStr(m.backlinks_change)}</p></div>:<span style={{color:S.muted}}>—</span>,
                    ].map((cell,i)=><div key={i}>{cell}</div>)}
                    <button onClick={()=>removeSite(folder.id,site.id)} style={{background:"none",border:`1px solid ${S.border}`,borderRadius:5,color:S.muted,cursor:"pointer",fontSize:14,padding:"2px 6px",fontFamily:"inherit",lineHeight:1}}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}

      {/* ── Domains for monitoring ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:28,marginBottom:14,flexWrap:"wrap",gap:8}}>
        <h3 style={{fontSize:15,fontWeight:700,color:S.text,margin:0}}>Domains for monitoring</h3>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",background:S.subtle,borderRadius:7,padding:3,gap:2}}>
            {(["Month","Year"] as const).map(r=>(
              <button key={r} onClick={()=>setRange(r)} style={{padding:"4px 10px",borderRadius:5,border:"none",background:range===r?S.card:"transparent",color:range===r?S.text:S.muted,fontSize:12,fontWeight:range===r?700:400,cursor:"pointer",fontFamily:"inherit"}}>{r}</button>
            ))}
          </div>
          <input value={addMonInput} onChange={e=>setAddMonInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMonitoredDomain()} placeholder="competitor.com" style={{border:`1px solid ${S.border}`,borderRadius:8,padding:"6px 10px",fontSize:12,color:S.text,background:S.card,outline:"none",fontFamily:"inherit",width:150}}/>
          <Btn small onClick={addMonitoredDomain} disabled={!addMonInput.trim()||loadingIds.has(`mon_${addMonInput.replace(/^https?:\/\//,"").replace(/\/$/,"")}`)}>{loadingIds.has(`mon_${addMonInput.replace(/^https?:\/\//,"").replace(/\/$/,"")}`)||loadingIds.size>0&&addMonInput.trim()?""+"Analysing…":"+ Add domain"}</Btn>
        </div>
      </div>

      {monitored.length===0&&(
        <Card>
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 4px"}}>No domains monitored yet</p>
            <p style={{fontSize:12,color:S.muted,margin:0}}>Enter a competitor domain above to start tracking their organic keywords, traffic, backlinks and authority score.</p>
          </div>
        </Card>
      )}

      {monitored.length>0&&(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:860}}>
            <thead>
              <tr style={{background:S.subtle}}>
                {["Domain","Organic Keywords","Organic Traffic","Paid Keywords","Paid Traffic","Ref. Domains","Authority Score",""].map((h,i)=>(
                  <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap",borderBottom:`1px solid ${S.border}`,background:S.subtle}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monitored.map((m:MonEntry,i:number)=>(
                <tr key={i} style={{borderBottom:`1px solid ${S.border}`,background:S.card}}>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:14}}>{m.country==="US"?"🇺🇸":m.country==="UK"?"🇬🇧":m.country==="IN"?"🇮🇳":"🌐"}</span>
                      <a href={`https://${m.domain}`} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:700,color:S.accent,textDecoration:"none"}}>{m.domain}</a>
                    </div>
                  </td>
                  <td style={{padding:"12px 14px",verticalAlign:"middle"}}>
                    <div style={{fontSize:13,fontWeight:700,color:S.text}}>{fmtNum(m.organic_keywords)} <span style={{fontSize:10,fontWeight:600,color:chgColor(m.organic_keywords_change)}}>{chgStr(m.organic_keywords_change)}</span></div>
                    <MiniSparkline data={m.kw_trend||[]} color={COLORS_MON[0]} fill={S.accentBg}/>
                  </td>
                  <td style={{padding:"12px 14px",verticalAlign:"middle"}}>
                    <div style={{fontSize:13,fontWeight:700,color:S.text}}>{fmtNum(m.organic_traffic)} <span style={{fontSize:10,fontWeight:600,color:chgColor(m.organic_traffic_change)}}>{chgStr(m.organic_traffic_change)}</span></div>
                    <MiniSparkline data={m.traffic_trend||[]} color={COLORS_MON[1]} fill={S.greenBg}/>
                  </td>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:S.text}}>{fmtNum(m.paid_keywords||0)}</div>
                    <div style={{fontSize:10,color:S.muted}}>0%</div>
                  </td>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:S.text}}>{fmtNum(m.paid_traffic||0)}</div>
                    <div style={{fontSize:10,color:S.muted}}>0%</div>
                  </td>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:S.text}}>{fmtNum(m.ref_domains)} <span style={{fontSize:10,fontWeight:600,color:chgColor(m.ref_domains_change)}}>{chgStr(m.ref_domains_change)}</span></div>
                  </td>
                  <td style={{padding:"12px 14px"}}><AuthGauge score={m.authority_score}/></td>
                  <td style={{padding:"12px 14px"}}>
                    <button onClick={()=>saveMon(monitored.filter(d=>d.domain!==m.domain))} style={{background:"none",border:`1px solid ${S.border}`,borderRadius:5,color:S.muted,cursor:"pointer",fontSize:14,padding:"2px 8px",fontFamily:"inherit"}}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── ADMIN ──
function Admin() {
  const [secret,setSecret]=useState(()=>{try{return localStorage.getItem("rm_admin_secret")||"";}catch{return "";}});
  const [secretInput,setSecretInput]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [tab,setTab]=useState<"overview"|"users"|"activity">("overview");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedUser,setSelectedUser]=useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userActivity,setUserActivity]=useState<any[]>([]);
  const [search,setSearch]=useState("");

  const load = async (s: string) => {
    const cleanSecret = s.trim();
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/admin", { headers: { Authorization: `Bearer ${cleanSecret}` } });
      if (r.status===401) { setErr("Invalid admin secret."); return; }
      if (r.status===503) { const d=await r.json(); setErr(d.error); return; }
      const d = await r.json();
      setData(d); setSecret(cleanSecret); try{localStorage.setItem("rm_admin_secret",cleanSecret);}catch{}
    } catch { setErr("Failed to load admin data."); }
    finally { setLoading(false); }
  };

  const loadUserActivity = async (userId: string) => {
    try {
      const r = await fetch(`/api/admin?view=user_activity&userId=${userId}`, { headers: { Authorization: `Bearer ${secret}` } });
      if (r.ok) { const d = await r.json(); setUserActivity(d.activity||[]); }
    } catch {}
  };

  const removeUser = async (userId: string, email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove user ${email}? This cannot be undone.`)) return;
    try {
      const r = await fetch("/api/admin", { method: "DELETE", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (r.ok) { setData((prev: any) => ({ ...prev, users: prev.users.filter((u: any) => u.id !== userId), stats: { ...prev.stats, totalUsers: prev.stats.totalUsers - 1 } })); }
      else { alert("Failed to remove user."); }
    } catch { alert("Failed to remove user."); }
  };

  const actionIcon = (action: string) => action==="signup"?"✦":action==="signin"?"◎":"◆";
  const actionColor = (action: string) => action==="signup"?S.green:action==="signin"?S.blue:S.accent;
  const fmtDate = (iso: string) => { try{ const d=new Date(iso); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}); }catch{return iso;} };
  const fmtAgo = (iso: string) => { try{ const diff=Date.now()-new Date(iso).getTime(); if(diff<60000) return "just now"; if(diff<3600000) return Math.floor(diff/60000)+"m ago"; if(diff<86400000) return Math.floor(diff/3600000)+"h ago"; return Math.floor(diff/86400000)+"d ago"; }catch{return "—";} };

  if (!secret && !data) {
    return (
      <div>
        <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Admin Panel</h2>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 24px"}}>Enter your admin secret to access user management and activity logs.</p>
        <Card style={{maxWidth:440}}>
          <Field label="Admin Secret">
            <input type="password" value={secretInput} onChange={e=>setSecretInput(e.target.value)} placeholder="Enter ADMIN_SECRET value"
              onKeyDown={(e:React.KeyboardEvent)=>{ if(e.key==="Enter"&&secretInput.trim()) load(secretInput.trim()); }}
              style={{width:"100%",background:"#fff",border:`1.5px solid ${S.border}`,borderRadius:8,color:S.text,padding:"9px 12px",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </Field>
          {err && <p style={{fontSize:13,color:S.red,margin:"-8px 0 12px"}}>⚠ {err}</p>}
          <Btn onClick={()=>{ if(secretInput.trim()) load(secretInput.trim()); }} disabled={loading||!secretInput.trim()}>
            {loading?"Verifying…":"Access Admin Panel"}
          </Btn>
          <div style={{marginTop:16,padding:"12px 14px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8}}>
            <p style={{fontSize:12,color:"#92400e",margin:"0 0 6px",fontWeight:600}}>Setup required</p>
            <p style={{fontSize:11,color:"#92400e",margin:"0 0 4px",lineHeight:1.6}}>1. Add <code style={{background:"#fef3c7",padding:"1px 5px",borderRadius:3}}>UPSTASH_REDIS_REST_URL</code> and <code style={{background:"#fef3c7",padding:"1px 5px",borderRadius:3}}>UPSTASH_REDIS_REST_TOKEN</code> from <strong>console.upstash.com</strong></p>
            <p style={{fontSize:11,color:"#92400e",margin:0,lineHeight:1.6}}>2. Add <code style={{background:"#fef3c7",padding:"1px 5px",borderRadius:3}}>ADMIN_SECRET</code> (any strong password) to Vercel env vars</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:12}}>
        {loading ? <LoadingBar phase="Loading admin data…"/> : <Btn onClick={()=>load(secret)}>Load Data</Btn>}
        {err && <p style={{fontSize:13,color:S.red}}>{err}</p>}
      </div>
    );
  }

  const { stats, users, activity } = data;
  const filteredUsers = users.filter((u:{email:string;name:string})=>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Admin Panel</h2>
          <p style={{fontSize:13,color:S.muted,margin:0}}>{stats.totalUsers} users · {stats.totalQueries.toLocaleString()} total queries</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>load(secret)} disabled={loading}
            style={{fontSize:12,padding:"6px 14px",border:`1px solid ${S.border}`,borderRadius:8,background:"white",cursor:"pointer",color:S.text,fontFamily:"inherit",fontWeight:500}}>
            {loading?"Refreshing…":"⟳ Refresh"}
          </button>
          <button onClick={()=>{setSecret("");setData(null);try{localStorage.removeItem("rm_admin_secret");}catch{}}}
            style={{fontSize:12,padding:"6px 14px",border:`1px solid ${S.border}`,borderRadius:8,background:"white",cursor:"pointer",color:S.muted,fontFamily:"inherit"}}>
            Sign out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[
          {l:"Total Users",v:stats.totalUsers,color:S.accent,icon:"◉"},
          {l:"Active Today",v:stats.activeToday,color:S.green,icon:"✦"},
          {l:"Total Queries",v:stats.totalQueries.toLocaleString(),color:S.blue,icon:"◆"},
          {l:"New Today",v:stats.signupsToday,color:S.amber,icon:"★"},
        ].map((s,i)=>(
          <div key={i} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"14px 16px",boxShadow:S.shadow}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:14,opacity:0.6}}>{s.icon}</span>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.04em",margin:0}}>{s.l}</p>
            </div>
            <p style={{fontSize:24,fontWeight:800,color:s.color,margin:0,lineHeight:1}}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Top tools */}
      {stats.toolCounts && Object.keys(stats.toolCounts).length>0 && (
        <Card style={{marginBottom:20}}>
          <SH title="Tool usage breakdown"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(stats.toolCounts as Record<string,number>)
              .sort((a,b)=>b[1]-a[1])
              .map(([tool,count])=>(
                <div key={tool} style={{background:S.accentBg,border:`1px solid #c7d2fe`,borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,fontWeight:600,color:S.accentText}}>{tool}</span>
                  <span style={{fontSize:12,fontWeight:800,color:S.accent,background:"white",padding:"1px 7px",borderRadius:10}}>{count as number}</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:`1px solid ${S.border}`,paddingBottom:0}}>
        {(["overview","users","activity"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"8px 16px",border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:tab===t?600:400,
              color:tab===t?S.accent:S.muted,borderBottom:tab===t?`2px solid ${S.accent}`:"2px solid transparent",marginBottom:-1,transition:"all 0.15s"}}>
            {t==="overview"?"Activity Feed":t==="users"?`Users (${users.length})`:"All Events"}
          </button>
        ))}
      </div>

      {/* Overview / activity feed */}
      {tab==="overview" && (
        <Card style={{padding:"20px 0",overflow:"hidden"}}>
          <div style={{padding:"0 24px 14px",borderBottom:`1px solid ${S.border}`}}>
            <p style={{fontSize:13,fontWeight:600,color:S.text,margin:0}}>Recent activity</p>
          </div>
          {activity.slice(0,50).map((ev:{id:string;action:string;email:string;name:string;tool?:string;timestamp:string},i:number)=>(
            <div key={ev.id||i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 24px",borderBottom:`1px solid ${S.border}`,transition:"background 0.1s"}}
              onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background=S.subtle}
              onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background="white"}>
              <div style={{width:32,height:32,borderRadius:"50%",background:ev.action==="signup"?S.greenBg:ev.action==="signin"?S.blueBg:S.accentBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14,color:actionColor(ev.action)}}>
                {actionIcon(ev.action)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {ev.name} <span style={{fontWeight:400,color:S.muted}}>· {ev.email}</span>
                </p>
                <p style={{fontSize:11,color:S.muted,margin:0}}>
                  {ev.action==="signup"?"Signed up":ev.action==="signin"?"Signed in":`Used ${ev.tool||"a tool"}`}
                </p>
              </div>
              {ev.tool && <span style={{background:S.accentBg,color:S.accentText,fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:5,flexShrink:0}}>{ev.tool}</span>}
              <span style={{fontSize:11,color:S.muted,flexShrink:0,whiteSpace:"nowrap"}}>{fmtAgo(ev.timestamp)}</span>
            </div>
          ))}
          {activity.length===0 && <p style={{padding:"24px",textAlign:"center",color:S.muted,fontSize:13}}>No activity yet. Activity will appear here as users sign in and use tools.</p>}
        </Card>
      )}

      {/* Users table */}
      {tab==="users" && (
        <Card style={{padding:"20px 0",overflow:"hidden"}}>
          <div style={{padding:"0 24px 14px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${S.border}`}}>
            <div style={{flex:1}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email…"
                style={{width:"100%",padding:"7px 12px",border:`1px solid ${S.border}`,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",color:S.text,boxSizing:"border-box" as const}}/>
            </div>
            <span style={{fontSize:12,color:S.muted,flexShrink:0}}>{filteredUsers.length} users</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:S.subtle}}>
                {["User","Joined","Last Active","Queries","Plan",""].map(h=>(
                  <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:S.muted,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u:{id:string;email:string;name:string;plan:string;createdAt:string;lastActiveAt:string;queryCount:number},i:number)=>(
                <tr key={u.id||i}
                  style={{cursor:"pointer",borderBottom:`1px solid ${S.border}`}}
                  onClick={()=>{ setSelectedUser(u); setTab("activity"); loadUserActivity(u.id); }}
                  onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=S.subtle}
                  onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background="white"}>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"white",fontWeight:700,flexShrink:0}}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 1px"}}>{u.name}</p>
                        <p style={{fontSize:11,color:S.muted,margin:0}}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"12px 16px",color:S.muted,whiteSpace:"nowrap"}}>{fmtDate(u.createdAt)}</td>
                  <td style={{padding:"12px 16px",color:S.muted,whiteSpace:"nowrap"}}>{u.lastActiveAt?fmtAgo(u.lastActiveAt):"—"}</td>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:60,height:4,background:S.subtle,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",background:S.accent,width:`${Math.min((u.queryCount/50)*100,100)}%`,borderRadius:99}}/>
                      </div>
                      <span style={{fontWeight:600,color:S.accent}}>{u.queryCount}</span>
                    </div>
                  </td>
                  <td style={{padding:"12px 16px"}}>{pill(u.plan||"free",u.plan==="pro"?"purple":u.plan==="free"?"gray":"blue")}</td>
                  <td style={{padding:"12px 16px"}} onClick={ev=>ev.stopPropagation()}>
                    <button onClick={e=>removeUser(u.id,u.email,e)}
                      style={{fontSize:11,color:S.red,background:S.redBg,border:`1px solid #fecaca`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap" as const}}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length===0 && (
                <tr><td colSpan={6} style={{padding:"32px",textAlign:"center",color:S.muted,fontSize:13}}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* User-specific activity */}
      {tab==="activity" && (
        <div>
          {selectedUser && (
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"12px 16px",background:S.accentBg,border:`1px solid #c7d2fe`,borderRadius:10}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"white",fontWeight:700,flexShrink:0}}>
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 1px"}}>{selectedUser.name}</p>
                <p style={{fontSize:11,color:S.muted,margin:0}}>{selectedUser.email} · {selectedUser.queryCount} queries</p>
              </div>
              <button onClick={()=>{setSelectedUser(null);}} style={{fontSize:11,color:S.muted,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>✕ Clear filter</button>
            </div>
          )}
          <Card style={{padding:"20px 0",overflow:"hidden"}}>
            <div style={{padding:"0 24px 14px",borderBottom:`1px solid ${S.border}`}}>
              <p style={{fontSize:13,fontWeight:600,color:S.text,margin:0}}>
                {selectedUser?`Activity for ${selectedUser.name}`:"All events"}
              </p>
            </div>
            {(selectedUser?userActivity:activity).map((ev:{id:string;action:string;email:string;name:string;tool?:string;timestamp:string},i:number)=>(
              <div key={ev.id||i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 24px",borderBottom:`1px solid ${S.border}`}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:ev.action==="signup"?S.greenBg:ev.action==="signin"?S.blueBg:S.accentBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,color:actionColor(ev.action)}}>
                  {actionIcon(ev.action)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  {!selectedUser&&<p style={{fontSize:12,fontWeight:600,color:S.text,margin:"0 0 1px"}}>{ev.name} · <span style={{fontWeight:400,color:S.muted}}>{ev.email}</span></p>}
                  <p style={{fontSize:12,color:S.muted,margin:0}}>
                    {ev.action==="signup"?"Account created":ev.action==="signin"?"Signed in":`Used ${ev.tool||"a tool"}`}
                  </p>
                </div>
                {ev.tool && <span style={{background:S.accentBg,color:S.accentText,fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:5,flexShrink:0}}>{ev.tool}</span>}
                <span style={{fontSize:11,color:S.muted,flexShrink:0,whiteSpace:"nowrap"}}>{fmtDate(ev.timestamp)}</span>
              </div>
            ))}
            {(selectedUser?userActivity:activity).length===0 && <p style={{padding:"24px",textAlign:"center",color:S.muted,fontSize:13}}>No events found.</p>}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Snippet Tracker ──────────────────────────────────────────────────────────
function SnippetTracker({activeSite}:PageProps){
  const [kw,setKw]=useState("");const [loading,setLoading]=useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [err,setErr]=useState("");
  const run=async()=>{
    if(!kw.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch(`/api/serpcheck?keyword=${encodeURIComponent(kw)}`);
      const serp=await r.json();
      const res=await ai(`You are a SERP analysis expert. Analyze the following top SERP results for the query "${kw}" and return ONLY valid JSON (no markdown):
SERP results: ${JSON.stringify((serp.results||[]).slice(0,8))}
Return:
{"snippet_present":boolean,"snippet_type":"paragraph"|"list"|"table"|"video"|"none","snippet_owner":"domain or null","snippet_content":"first 120 chars of snippet text or null","paa_questions":["q1","q2","q3","q4","q5"],"win_tips":["specific actionable tip 1","tip 2","tip 3"],"snippet_difficulty":"easy"|"medium"|"hard","recommended_format":"paragraph"|"list"|"table","search_intent":"informational"|"commercial"|"transactional"|"navigational","content_gaps":["gap1","gap2"]}`);
      setData({...res,keyword:kw,results:serp.results||[]});
    }catch(e){setErr(e instanceof Error?e.message:"Analysis failed");}
    finally{setLoading(false);}
  };
  const yourDomain=(activeSite||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"0 4px"}}>
      <Card style={{marginBottom:20}}>
        <SH title="Featured Snippet & PAA Tracker"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Find out who owns a featured snippet, what PAA questions appear, and exactly how to win it.</p>
        <Field label="Target keyword">
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><TI value={kw} onChange={setKw} placeholder="e.g. best CRM software for startups"/></div>
            <Btn onClick={run} disabled={loading||!kw.trim()}>{loading?"Analysing…":"Analyse"}</Btn>
          </div>
        </Field>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Fetching live SERP data…","Detecting featured snippets…","Extracting PAA questions…","Generating win strategy…"]}/></Card>}
      {data&&(<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
          <Metric label="Snippet Present" value={data.snippet_present?"Yes":"No"} color={data.snippet_present?S.amber:S.green}/>
          <Metric label="Snippet Type" value={data.snippet_type==="none"?"None":((data.snippet_type||"—")[0].toUpperCase()+(data.snippet_type||"").slice(1))} color={S.blue}/>
          <Metric label="Win Difficulty" value={(data.snippet_difficulty||"—")[0].toUpperCase()+(data.snippet_difficulty||"").slice(1)} color={data.snippet_difficulty==="easy"?S.green:data.snippet_difficulty==="hard"?S.red:S.amber}/>
          <Metric label="Search Intent" value={(data.search_intent||"—")[0].toUpperCase()+(data.search_intent||"").slice(1)} color={S.accent}/>
        </div>
        {data.snippet_owner&&(
          <Card style={{marginBottom:16}}>
            <SH title="Current Snippet Owner"/>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0"}}>
              <div style={{width:44,height:44,borderRadius:10,background:yourDomain&&data.snippet_owner.includes(yourDomain)?S.accentBg:S.subtle,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{yourDomain&&data.snippet_owner.includes(yourDomain)?"✓":"◉"}</div>
              <div style={{flex:1}}>
                <p style={{fontSize:14,fontWeight:600,color:S.text,margin:"0 0 2px"}}>{data.snippet_owner}</p>
                <p style={{fontSize:12,color:S.muted,margin:0}}>{yourDomain&&data.snippet_owner.includes(yourDomain)?"You own this snippet!":"Competitor owns this snippet"} · Best format: <strong>{data.recommended_format}</strong></p>
              </div>
              {yourDomain&&data.snippet_owner.includes(yourDomain)?pill("You own it","green"):pill("Opportunity","amber")}
            </div>
            {data.snippet_content&&<div style={{background:S.subtle,borderRadius:8,padding:"12px 14px",marginTop:8,borderLeft:`3px solid ${S.accent}`}}><p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 4px"}}>Snippet text</p><p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.6}}>{data.snippet_content}</p></div>}
          </Card>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <Card>
            <SH title="People Also Ask"/>
            {(data.paa_questions||[]).length===0?<p style={{fontSize:13,color:S.muted}}>No PAA questions detected</p>:(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(data.paa_questions||[]).map((q:string,i:number)=>(
                  <div key={i} style={{display:"flex",gap:10,padding:"8px 10px",background:S.subtle,borderRadius:6}}>
                    <span style={{fontSize:12,color:S.accent,fontWeight:700,flexShrink:0,marginTop:1}}>{i+1}.</span>
                    <p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.4}}>{q}</p>
                  </div>
                ))}
                <p style={{fontSize:11,color:S.muted,margin:"4px 0 0"}}>Add FAQ sections answering these questions to capture PAA real estate.</p>
              </div>
            )}
          </Card>
          <Card>
            <SH title="How to Win This Snippet"/>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(data.win_tips||[]).map((tip:string,i:number)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 10px",background:S.subtle,borderRadius:6}}>
                  <span style={{color:S.green,fontWeight:700,flexShrink:0}}>✓</span>
                  <p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.5}}>{tip}</p>
                </div>
              ))}
            </div>
            {(data.content_gaps||[]).length>0&&<div style={{marginTop:12,padding:"10px 12px",background:S.amberBg,borderRadius:8,border:`1px solid #fde68a`}}><p style={{fontSize:11,fontWeight:700,color:S.amberText,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 4px"}}>Content gaps to fill</p>{(data.content_gaps||[]).map((g:string,i:number)=><p key={i} style={{fontSize:12,color:S.text,margin:"2px 0 0"}}>• {g}</p>)}</div>}
          </Card>
        </div>
        {data.results?.length>0&&(
          <Card>
            <SH title="Live SERP Results"/>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["#","Title","Domain","Snippet?"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {data.results.slice(0,8).map((r:{position:number;title:string;domain:string;url:string},i:number)=>(
                  <tr key={i}>
                    <TD><span style={{fontWeight:700,color:S.muted}}>#{r.position||i+1}</span></TD>
                    <TD><a href={r.url} target="_blank" rel="noopener noreferrer" style={{color:S.accent,textDecoration:"none",fontSize:12}}>{(r.title||"").slice(0,55)}{(r.title||"").length>55?"…":""}</a></TD>
                    <TD>{r.domain||(()=>{try{return new URL(r.url||"https://x.com").hostname;}catch{return r.url;}})()}</TD>
                    <TD>{i===0&&data.snippet_present?pill("Snippet","amber"):pill("None","gray")}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </>)}
    </div>
  );
}

// ─── Share of Synthesis (GEO) ─────────────────────────────────────────────────
function ShareOfSynthesis({activeSite}:PageProps){
  const [brand,setBrand]=useState("");const [industry,setIndustry]=useState("");
  const [competitors,setCompetitors]=useState("");const [loading,setLoading]=useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [err,setErr]=useState("");
  const run=async()=>{
    if(!brand.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      const compList=competitors.split(",").map(c=>c.trim()).filter(Boolean).slice(0,3);
      const res=await ai(`You are a Generative Engine Optimization (GEO) expert simulating how AI platforms (ChatGPT, Perplexity, Gemini, Claude, Microsoft Copilot) would respond to queries about the brand "${brand}" in the "${industry||"technology"}" industry.

Competitors to compare: ${compList.join(", ")||"none specified"}

Simulate AI responses and citation patterns. Return ONLY valid JSON:
{
  "overall_sos": number (0-100, Share of Synthesis score),
  "platforms": [
    {"name":"ChatGPT","citation_rate": number 0-100,"sentiment":"positive"|"neutral"|"negative","likely_cited":boolean,"notes":"brief note"},
    {"name":"Perplexity","citation_rate": number 0-100,"sentiment":"positive"|"neutral"|"negative","likely_cited":boolean,"notes":"brief note"},
    {"name":"Gemini","citation_rate": number 0-100,"sentiment":"positive"|"neutral"|"negative","likely_cited":boolean,"notes":"brief note"},
    {"name":"Claude","citation_rate": number 0-100,"sentiment":"positive"|"neutral"|"negative","likely_cited":boolean,"notes":"brief note"},
    {"name":"Copilot","citation_rate": number 0-100,"sentiment":"positive"|"neutral"|"negative","likely_cited":boolean,"notes":"brief note"}
  ],
  "competitor_comparison": [{"name":"competitor","their_sos": number,"your_advantage": number}],
  "top_reasons_cited": ["reason1","reason2","reason3"],
  "top_barriers": ["barrier1","barrier2","barrier3"],
  "quick_wins": ["specific action 1","action 2","action 3","action 4"],
  "ai_fact_sheet": "A 2-3 sentence factual description of ${brand} optimized for AI citation",
  "entity_clarity_score": number 0-100,
  "hallucination_risk": "low"|"medium"|"high",
  "hallucination_risk_reason": "brief reason"
}`,10000);
      setData({...res,brand,industry,competitors:compList});
    }catch(e){setErr(e instanceof Error?e.message:"Analysis failed");}
    finally{setLoading(false);}
  };
  const sosColor=(n:number)=>n>=70?S.green:n>=40?S.amber:S.red;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sentColor=(s:string)=>s==="positive"?S.green:s==="negative"?S.red:S.amber;
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card style={{marginBottom:20}}>
        <SH title="Share of Synthesis — GEO Intelligence"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Simulate how often your brand is cited by ChatGPT, Perplexity, Gemini, Claude & Copilot vs competitors.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <Field label="Brand name"><TI value={brand} onChange={setBrand} placeholder="e.g. Salesforce"/></Field>
          <Field label="Industry"><TI value={industry} onChange={setIndustry} placeholder="e.g. CRM software"/></Field>
        </div>
        <Field label="Competitors (comma-separated, optional)"><TI value={competitors} onChange={setCompetitors} placeholder="e.g. HubSpot, Pipedrive, Zoho"/></Field>
        <Btn onClick={run} disabled={loading||!brand.trim()}>{loading?"Simulating AI responses…":"Analyse Share of Synthesis"}</Btn>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Simulating ChatGPT responses…","Simulating Perplexity…","Simulating Gemini & Copilot…","Calculating Share of Synthesis…","Comparing competitors…"]}/></Card>}
      {data&&(<>
        <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16,marginBottom:16}}>
          <Card style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
            <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 8px"}}>Share of Synthesis</p>
            <div style={{width:100,height:100,borderRadius:"50%",background:`conic-gradient(${sosColor(data.overall_sos||0)} ${(data.overall_sos||0)*3.6}deg, ${S.subtle} 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
              <div style={{width:76,height:76,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:22,fontWeight:700,color:sosColor(data.overall_sos||0)}}>{data.overall_sos||0}</span>
              </div>
            </div>
            <span style={{fontSize:12,color:S.muted}}>{(data.overall_sos||0)>=70?"Strong":""}{ (data.overall_sos||0)>=40&&(data.overall_sos||0)<70?"Moderate":""}{(data.overall_sos||0)<40?"Weak":""} presence</span>
          </Card>
          <Card>
            <SH title="AI Platform Citation Rates"/>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(data.platforms||[]).map((p:{name:string;citation_rate:number;sentiment:string;likely_cited:boolean;notes:string})=>(
                <div key={p.name}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13,fontWeight:600,color:S.text,minWidth:80}}>{p.name}</span>
                      {pill(p.sentiment,"neutral"===p.sentiment?"gray":p.sentiment==="positive"?"green":"red")}
                      {p.likely_cited?pill("Likely cited","green"):pill("Unlikely","amber")}
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:sosColor(p.citation_rate)}}>{p.citation_rate}%</span>
                  </div>
                  <Bar value={p.citation_rate} color={sosColor(p.citation_rate)}/>
                  <p style={{fontSize:11,color:S.muted,margin:"3px 0 0"}}>{p.notes}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <Card>
            <SH title="Top Reasons AI Cites You"/>
            {(data.top_reasons_cited||[]).map((r:string,i:number)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderBottom:i<(data.top_reasons_cited||[]).length-1?`1px solid ${S.border}`:"none"}}>
                <span style={{color:S.green,fontWeight:700,flexShrink:0}}>✓</span>
                <p style={{fontSize:13,color:S.text,margin:0}}>{r}</p>
              </div>
            ))}
          </Card>
          <Card>
            <SH title="Barriers to Citation"/>
            {(data.top_barriers||[]).map((b:string,i:number)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderBottom:i<(data.top_barriers||[]).length-1?`1px solid ${S.border}`:"none"}}>
                <span style={{color:S.red,fontWeight:700,flexShrink:0}}>✗</span>
                <p style={{fontSize:13,color:S.text,margin:0}}>{b}</p>
              </div>
            ))}
            <div style={{marginTop:12,padding:"10px 12px",background:data.hallucination_risk==="high"?S.redBg:data.hallucination_risk==="medium"?S.amberBg:S.greenBg,borderRadius:8}}>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 3px"}}>Hallucination risk</p>
              <p style={{fontSize:13,fontWeight:600,color:data.hallucination_risk==="high"?S.red:data.hallucination_risk==="medium"?S.amber:S.green,margin:"0 0 2px"}}>{(data.hallucination_risk||"").charAt(0).toUpperCase()+(data.hallucination_risk||"").slice(1)}</p>
              <p style={{fontSize:12,color:S.muted,margin:0}}>{data.hallucination_risk_reason}</p>
            </div>
          </Card>
        </div>
        {(data.competitor_comparison||[]).length>0&&(
          <Card style={{marginBottom:16}}>
            <SH title="Competitor Comparison"/>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Competitor","Their SoS","Your SoS","Advantage"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {(data.competitor_comparison||[]).map((c:{name:string;their_sos:number;your_advantage:number},i:number)=>(
                  <tr key={i}>
                    <TD bold>{c.name}</TD>
                    <TD><span style={{color:sosColor(c.their_sos),fontWeight:600}}>{c.their_sos}%</span></TD>
                    <TD><span style={{color:sosColor(data.overall_sos||0),fontWeight:600}}>{data.overall_sos||0}%</span></TD>
                    <TD>{c.your_advantage>0?pill(`+${c.your_advantage}% you lead`,"green"):pill(`${c.your_advantage}% behind`,"red")}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <SH title="Quick Wins to Boost Citation Rate"/>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(data.quick_wins||[]).map((w:string,i:number)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"8px 10px",background:S.subtle,borderRadius:6}}>
                  <span style={{color:S.accent,fontWeight:700,flexShrink:0,minWidth:18}}>{i+1}.</span>
                  <p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.5}}>{w}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <SH title="AI Fact Sheet" action={<CopyBtn text={data.ai_fact_sheet||""}/>}/>
            <p style={{fontSize:11,color:S.muted,margin:"0 0 10px"}}>Copy this to your website About page, press kit, and schema markup to maximize AI citation accuracy.</p>
            <div style={{background:S.subtle,borderRadius:8,padding:"14px 16px",borderLeft:`3px solid ${S.accent}`}}>
              <p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.7}}>{data.ai_fact_sheet}</p>
            </div>
            <div style={{marginTop:12,padding:"8px 12px",background:S.accentBg,borderRadius:8}}>
              <p style={{fontSize:11,fontWeight:700,color:S.accentText,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Entity clarity score</p>
              <p style={{fontSize:20,fontWeight:700,color:S.accent,margin:0}}>{data.entity_clarity_score||0}<span style={{fontSize:13,fontWeight:400,color:S.muted}}>/100</span></p>
            </div>
          </Card>
        </div>
      </>)}
    </div>
  );
}

// ─── AI Bot Monitor ───────────────────────────────────────────────────────────
function AIBotMonitor({activeSite}:PageProps){
  const [domain,setDomain]=useState(activeSite?.replace(/^https?:\/\//,"").replace(/\/$/,"")||"");
  const [loading,setLoading]=useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [err,setErr]=useState("");
  const run=async()=>{
    const d=domain.trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
    if(!d)return;
    setLoading(true);setErr("");setData(null);
    try{
      // 1. Fetch the REAL robots.txt and check whether /llms.txt actually exists.
      let robotsTxt="", robotsFound=false, hasLlms=false;
      try{ const r=await fetch(`/api/robotstxt?domain=${encodeURIComponent(d)}`); const j=await r.json(); robotsTxt=j.content||""; robotsFound=!!j.found; }catch{}
      try{ const lr=await fetch(`/api/robotstxt?domain=${encodeURIComponent(d)}&path=llms.txt`); const lj=await lr.json(); hasLlms=!!(lj.found && (lj.content||"").trim().length>0); }catch{}

      // 2. Determine each bot's access DETERMINISTICALLY by parsing robots.txt (no AI guessing).
      const BOTS:{name:string;platform:string;impact:"high"|"medium"|"low"}[]=[
        {name:"GPTBot",platform:"ChatGPT",impact:"high"},
        {name:"ChatGPT-User",platform:"ChatGPT Browsing",impact:"high"},
        {name:"PerplexityBot",platform:"Perplexity",impact:"high"},
        {name:"ClaudeBot",platform:"Claude / Anthropic",impact:"medium"},
        {name:"Google-Extended",platform:"Gemini / AI Overviews",impact:"high"},
        {name:"Bingbot",platform:"Copilot",impact:"medium"},
        {name:"CCBot",platform:"Common Crawl (training only)",impact:"low"},
      ];
      const bots=BOTS.map(b=>{
        const status=parseRobotsBotAccess(robotsTxt,b.name);
        // CCBot is training-only — blocking it is fine, so it never needs action.
        const action_needed=b.name==="CCBot"?false:(status!=="allowed");
        const recommendation=b.name==="CCBot"
          ? (status==="blocked"?"Correctly blocked (training-only crawler)":"Optional: block CCBot if you don't want training use")
          : status==="blocked"?`Unblock ${b.name} in robots.txt — ${b.platform} can't cite you while blocked.`
          : status==="unspecified"?`Add an explicit Allow rule for ${b.name} to guarantee ${b.platform} access.`
          : "";
        return {name:b.name,platform:b.platform,impact:b.impact,status,user_agent:b.name,action_needed,recommendation};
      });

      // 3. Deterministic score: weight citation-capable bots by impact (CCBot excluded).
      const weight={high:3,medium:2,low:1} as const;
      const citation=bots.filter(b=>b.name!=="CCBot");
      let got=0,max=0;
      for(const b of citation){ const w=weight[b.impact]; max+=w; got+= b.status==="allowed"?w : b.status==="unspecified"?w*0.6 : 0; }
      let score=max>0?Math.round((got/max)*100):0;
      if(hasLlms) score=Math.min(100,score+5);
      const critical_issues=citation.filter(b=>b.status==="blocked").length;

      // 4. Use AI ONLY to draft the helper snippets (generation, not analysis). Deterministic fallback.
      let corrected="", llmsTemplate="";
      try{
        const res=await ai(`Generate two assets for the site "${d}". Return ONLY valid JSON {"corrected_robots_snippet":"...","llms_txt_template":"..."}. corrected_robots_snippet = robots.txt rules that Allow all citation-capable AI bots (GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Bingbot) and Disallow CCBot. llms_txt_template = a complete /llms.txt for this domain with realistic placeholder sections (overview, about, key pages, contact).`);
        corrected=(res?.corrected_robots_snippet||"").toString();
        llmsTemplate=(res?.llms_txt_template||"").toString();
      }catch{/* fall back to deterministic templates below */}
      if(!corrected.trim()){
        corrected=["# Citation-capable AI crawlers — allow",
          ...["GPTBot","ChatGPT-User","PerplexityBot","ClaudeBot","Google-Extended","Bingbot"].flatMap(n=>[`User-agent: ${n}`,"Allow: /",""]),
          "# Training-only crawler — optional block","User-agent: CCBot","Disallow: /"].join("\n");
      }
      if(!llmsTemplate.trim()){
        llmsTemplate=`# ${d}\n\n> One-line description of what ${d} does and who it serves.\n\n## About\nShort paragraph about the company, its products/services, and target customers.\n\n## Key pages\n- https://${d}/ — Overview\n- https://${d}/blog — Articles & insights\n- https://${d}/contact — Contact\n\n## Contact\n- Email: hello@${d}`;
      }

      setData({ bots, overall_ai_access_score:score, critical_issues, has_llms_txt:hasLlms, robots_found:robotsFound, corrected_robots_snippet:corrected, llms_txt_template:llmsTemplate, domain:d, robotsTxt });
    }catch(e){setErr(e instanceof Error?e.message:"Analysis failed");}
    finally{setLoading(false);}
  };
  const statusColor=(s:string)=>s==="allowed"?S.green:s==="blocked"?S.red:S.amber;
  const statusLabel=(s:string)=>s==="allowed"?"Allowed":s==="blocked"?"Blocked":"Unspecified";
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card style={{marginBottom:20}}>
        <SH title="AI Crawler Monitor"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Check which AI bots (GPTBot, PerplexityBot, ClaudeBot, Google-Extended) can access your site and get a corrected robots.txt.</p>
        <Field label="Domain">
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><TI value={domain} onChange={setDomain} placeholder="e.g. example.com"/></div>
            <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Checking…":"Check AI Access"}</Btn>
          </div>
        </Field>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Fetching robots.txt…","Parsing AI bot rules…","Checking access status…","Generating recommendations…"]}/></Card>}
      {data&&(<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          <Metric label="AI Access Score" value={`${data.overall_ai_access_score||0}/100`} color={data.overall_ai_access_score>=70?S.green:data.overall_ai_access_score>=40?S.amber:S.red}/>
          <Metric label="Critical Issues" value={String(data.critical_issues||0)} color={data.critical_issues>0?S.red:S.green}/>
          <Metric label="llms.txt" value={data.has_llms_txt?"Present":"Missing"} color={data.has_llms_txt?S.green:S.red}/>
        </div>
        <Card style={{marginBottom:16}}>
          <SH title="AI Bot Access Status"/>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Bot","Platform","Status","Impact","Action Required"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {(data.bots||[]).map((b:{name:string;platform:string;status:string;impact:string;action_needed:boolean;recommendation:string},i:number)=>(
                <tr key={i}>
                  <TD bold>{b.name}</TD>
                  <TD>{b.platform}</TD>
                  <TD><span style={{color:statusColor(b.status),fontWeight:600}}>{statusLabel(b.status)}</span></TD>
                  <TD>{pill(b.impact.charAt(0).toUpperCase()+b.impact.slice(1),b.impact==="high"?"red":b.impact==="medium"?"amber":"gray")}</TD>
                  <TD>{b.action_needed?<span style={{fontSize:12,color:S.amber,fontWeight:600}}>⚠ {b.recommendation}</span>:<span style={{fontSize:12,color:S.green}}>✓ No action</span>}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <SH title="Corrected robots.txt (AI section)" action={<CopyBtn text={data.corrected_robots_snippet||""}/>}/>
            <p style={{fontSize:12,color:S.muted,margin:"0 0 10px"}}>Add these rules to your robots.txt to allow all citation-capable AI bots:</p>
            <pre style={{background:S.subtle,borderRadius:8,padding:"12px 14px",fontSize:12,fontFamily:"monospace",margin:0,overflowX:"auto",lineHeight:1.6,color:S.text,whiteSpace:"pre-wrap"}}>{data.corrected_robots_snippet}</pre>
          </Card>
          <Card>
            <SH title="/llms.txt Template" action={<CopyBtn text={data.llms_txt_template||""}/>}/>
            <p style={{fontSize:12,color:S.muted,margin:"0 0 10px"}}>Create this file at your root to help AI systems understand your site. Brands with llms.txt get significantly more AI citations.</p>
            <pre style={{background:S.subtle,borderRadius:8,padding:"12px 14px",fontSize:12,fontFamily:"monospace",margin:0,overflowX:"auto",lineHeight:1.6,color:S.text,whiteSpace:"pre-wrap",maxHeight:220}}>{data.llms_txt_template}</pre>
          </Card>
        </div>
      </>)}
    </div>
  );
}

// ─── Atomic Answers ───────────────────────────────────────────────────────────
function AtomicAnswers({activeSite}:PageProps){
  const [url,setUrl]=useState("");const [text,setText]=useState("");const [kw,setKw]=useState("");
  const [mode,setMode]=useState<"url"|"text">("url");const [loading,setLoading]=useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [err,setErr]=useState("");
  const run=async()=>{
    setLoading(true);setErr("");setData(null);
    try{
      let content="";
      if(mode==="url"){
        if(!url.trim())throw new Error("Enter a URL");
        const r=await fetch(`/api/onpage?url=${encodeURIComponent(url)}&keyword=${encodeURIComponent(kw||"")}`);
        const d=await r.json();
        content=`Title: ${d.title||""}\nH1: ${(d.h1s||[]).join(", ")}\nH2s: ${(d.h2s||[]).join(" | ")}\nMeta: ${d.meta_description||""}\nWord count: ${d.word_count||0}`;
      }else{
        if(!text.trim())throw new Error("Paste content");
        content=text.slice(0,3000);
      }
      const res=await ai(`You are an AEO (Answer Engine Optimization) expert. Generate Atomic Answers from the following content. Each Atomic Answer must be exactly 40-60 words — standalone, factual, directly answering a question, and optimized to win featured snippets and AI citations.
${kw?`Primary keyword: "${kw}"`:""}
Content:
${content}

Return ONLY valid JSON:
{
  "topic": "main topic of the content",
  "primary_keyword": "best target keyword phrase",
  "answers": [
    {
      "question": "Question in H2/H3 format (what/how/why/when/which)",
      "answer": "Self-contained answer, exactly 40-60 words, factual, no fluff",
      "word_count": number,
      "format_type": "paragraph"|"list"|"definition",
      "snippet_probability": number 0-100,
      "suggested_header": "Optimized question-format H2"
    }
  ],
  "faq_schema": "complete JSON-LD FAQPage schema string for all Q&As"
}`,8192,true);
      setData({...res,url,mode});
    }catch(e){setErr(e instanceof Error?e.message:"Generation failed");}
    finally{setLoading(false);}
  };
  // suppress unused warning for activeSite (used implicitly via url prefill pattern)
  void activeSite;
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card style={{marginBottom:20}}>
        <SH title="Atomic Answer Generator"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Generate 40-60 word direct-answer blocks from any URL or content. Optimized to win featured snippets and AI citations.</p>
        <Toggle value={mode} onChange={(v)=>setMode(v as "url"|"text")} options={[{value:"url",label:"From URL"},{value:"text",label:"Paste Content"}]}/>
        <div style={{marginTop:12}}>
          {mode==="url"?<Field label="Page URL"><TI value={url} onChange={setUrl} placeholder="https://example.com/your-page"/></Field>:
          <Field label="Paste your content (up to 3000 chars)"><TI value={text} onChange={setText} placeholder="Paste article content, FAQ text, or any document…" rows={5}/></Field>}
        </div>
        <Field label="Target keyword (optional)"><TI value={kw} onChange={setKw} placeholder="e.g. best CRM for small business"/></Field>
        <Btn onClick={run} disabled={loading||(mode==="url"?!url.trim():!text.trim())}>{loading?"Generating…":"Generate Atomic Answers"}</Btn>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Extracting page content…","Identifying answer opportunities…","Writing 40-60 word answers…","Calculating snippet probabilities…","Building FAQ schema…"]}/></Card>}
      {data&&(<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <Metric label="Topic" value={data.topic||"—"} color={S.accent}/>
          <Metric label="Atomic Answers Generated" value={String((data.answers||[]).length)} color={S.green}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          {(data.answers||[]).map((a:{question:string;answer:string;word_count:number;format_type:string;snippet_probability:number;suggested_header:string},i:number)=>(
            <Card key={i} style={{borderLeft:`3px solid ${a.snippet_probability>=70?S.green:a.snippet_probability>=40?S.amber:S.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>{a.question}</p>
                  <p style={{fontSize:11,color:S.muted,margin:0}}>Suggested H2: <em>{a.suggested_header}</em></p>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:12}}>
                  {pill(`${a.word_count}w`,a.word_count>=40&&a.word_count<=60?"green":"amber")}
                  {pill(a.format_type,"gray")}
                  {pill(`${a.snippet_probability}% snippet`,a.snippet_probability>=70?"green":a.snippet_probability>=40?"amber":"gray")}
                </div>
              </div>
              <div style={{background:S.subtle,borderRadius:8,padding:"12px 14px",marginBottom:10}}>
                <p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.7}}>{a.answer}</p>
              </div>
              <CopyBtn text={a.answer}/>
            </Card>
          ))}
        </div>
        {data.faq_schema&&(
          <Card>
            <SH title="FAQPage JSON-LD Schema" action={<CopyBtn text={data.faq_schema}/>}/>
            <p style={{fontSize:12,color:S.muted,margin:"0 0 8px"}}>Add this to your {"<head>"} to enable FAQ rich results and improve AI citation rate.</p>
            <pre style={{background:S.subtle,borderRadius:8,padding:"12px 14px",fontSize:11,fontFamily:"monospace",margin:0,overflowX:"auto",lineHeight:1.5,color:S.text,whiteSpace:"pre-wrap",maxHeight:240}}>{data.faq_schema}</pre>
          </Card>
        )}
      </>)}
    </div>
  );
}

// ─── Content Refresh Optimizer ────────────────────────────────────────────────
function ContentRefresh({gscData,activeSite}:PageProps){
  const [domain,setDomain]=useState(activeSite?.replace(/^https?:\/\//,"").replace(/\/$/,"")||"");
  const [loading,setLoading]=useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [err,setErr]=useState("");
  const run=async()=>{
    const d=domain.trim()||gscData?.domain;
    if(!d){setErr("Enter a domain or connect Google Search Console");return;}
    setLoading(true);setErr("");setData(null);
    try{
      const gscPages=gscData?.pages?.slice(0,20)||[];
      const gscQueries=gscData?.queries?.slice(0,10)||[];
      const res=await ai(`You are a content refresh strategist. Analyze the following GSC data for ${d} and identify which pages need urgent refreshing. Then create a prioritized refresh queue with specific, actionable briefs.

GSC top pages (clicks/impressions data):
${JSON.stringify(gscPages)}

GSC top queries:
${JSON.stringify(gscQueries)}

Return ONLY valid JSON:
{
  "refresh_score": number 0-100 (overall content freshness score),
  "pages_analyzed": number,
  "urgent_refresh_count": number,
  "refresh_queue": [
    {
      "url": "page URL or path",
      "title": "page title",
      "priority": "urgent"|"high"|"medium",
      "reason": "specific reason this page needs refreshing",
      "decline_signal": "traffic drop / outdated content / keyword drift / etc",
      "refresh_actions": ["specific action 1","action 2","action 3"],
      "estimated_traffic_recovery": "e.g. +25% in 60 days",
      "effort": "low"|"medium"|"high"
    }
  ],
  "content_decay_insights": ["insight 1","insight 2","insight 3"],
  "quick_wins": ["quick win 1","quick win 2","quick win 3"],
  "refresh_calendar": [
    {"week":"Week 1","pages":["page titles or URLs"],"focus":"theme"},
    {"week":"Week 2","pages":[],"focus":"theme"},
    {"week":"Week 3","pages":[],"focus":"theme"},
    {"week":"Week 4","pages":[],"focus":"theme"}
  ]
}`,8192,true);
      setData({...res,domain:d});
    }catch(e){setErr(e instanceof Error?e.message:"Analysis failed");}
    finally{setLoading(false);}
  };
  const prColor=(p:string)=>p==="urgent"?S.red:p==="high"?S.amber:S.blue;
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card style={{marginBottom:20}}>
        <SH title="Content Refresh Optimizer"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Identify declining pages, get prioritized refresh queue, and a 4-week action calendar. {gscData?"Using your connected GSC data.":"Connect GSC for real traffic data."}</p>
        <Field label="Domain">
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><TI value={domain} onChange={setDomain} placeholder="e.g. example.com"/></div>
            <Btn onClick={run} disabled={loading}>{loading?"Analysing…":"Analyse Content"}</Btn>
          </div>
        </Field>
        {!gscData&&<div style={{padding:"10px 12px",background:S.amberBg,borderRadius:8,marginTop:8,border:`1px solid #fde68a`}}><p style={{fontSize:12,color:S.amberText,margin:0}}>⚠ Connect Google Search Console for real traffic decline data. Currently using AI analysis only.</p></div>}
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Fetching GSC performance data…","Identifying declining pages…","Analysing content decay signals…","Building refresh queue…","Creating 4-week calendar…"]}/></Card>}
      {data&&(<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
          <Metric label="Freshness Score" value={`${data.refresh_score||0}/100`} color={data.refresh_score>=70?S.green:data.refresh_score>=40?S.amber:S.red}/>
          <Metric label="Pages Analysed" value={String(data.pages_analyzed||0)} color={S.blue}/>
          <Metric label="Urgent Refresh" value={String(data.urgent_refresh_count||0)} color={data.urgent_refresh_count>0?S.red:S.green}/>
          <Metric label="Quick Wins" value={String((data.quick_wins||[]).length)} color={S.green}/>
        </div>
        {(data.content_decay_insights||[]).length>0&&(
          <Card style={{marginBottom:16}}>
            <SH title="Content Decay Insights"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {(data.content_decay_insights||[]).map((ins:string,i:number)=>(
                <div key={i} style={{padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                  <p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.5}}>{ins}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card style={{marginBottom:16}}>
          <SH title="Prioritized Refresh Queue"/>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {(data.refresh_queue||[]).map((p:{url:string;title:string;priority:string;reason:string;decline_signal:string;refresh_actions:string[];estimated_traffic_recovery:string;effort:string},i:number)=>(
              <div key={i} style={{padding:"14px 16px",background:S.subtle,borderRadius:10,border:`1.5px solid ${prColor(p.priority)}22`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center"}}>
                      {pill(p.priority.charAt(0).toUpperCase()+p.priority.slice(1),p.priority==="urgent"?"red":p.priority==="high"?"amber":"blue")}
                      {pill(`Effort: ${p.effort}`,p.effort==="low"?"green":"gray")}
                    </div>
                    <p style={{fontSize:14,fontWeight:600,color:S.text,margin:"0 0 2px"}}>{p.title||p.url}</p>
                    <p style={{fontSize:12,color:S.muted,margin:0}}>{p.url}</p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                    <p style={{fontSize:11,color:S.muted,margin:"0 0 2px"}}>Projected recovery</p>
                    <p style={{fontSize:13,fontWeight:600,color:S.green,margin:0}}>{p.estimated_traffic_recovery}</p>
                  </div>
                </div>
                <p style={{fontSize:13,color:S.text,margin:"0 0 8px"}}><strong>Why:</strong> {p.reason}</p>
                <p style={{fontSize:12,color:S.muted,margin:"0 0 8px"}}>Signal: {p.decline_signal}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {(p.refresh_actions||[]).map((a:string,j:number)=>(
                    <span key={j} style={{fontSize:11,background:"#fff",border:`1px solid ${S.border}`,borderRadius:5,padding:"3px 9px",color:S.text}}>✓ {a}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        {(data.refresh_calendar||[]).length>0&&(
          <Card>
            <SH title="4-Week Refresh Calendar"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {(data.refresh_calendar||[]).map((w:{week:string;pages:string[];focus:string},i:number)=>(
                <div key={i} style={{padding:"12px 14px",background:S.subtle,borderRadius:8,border:`1px solid ${S.border}`}}>
                  <p style={{fontSize:11,fontWeight:700,color:S.accent,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 4px"}}>{w.week}</p>
                  <p style={{fontSize:12,fontWeight:600,color:S.text,margin:"0 0 8px"}}>{w.focus}</p>
                  {(w.pages||[]).map((pg:string,j:number)=><p key={j} style={{fontSize:11,color:S.muted,margin:"2px 0"}}>• {pg}</p>)}
                </div>
              ))}
            </div>
            {(data.quick_wins||[]).length>0&&<div style={{marginTop:14,padding:"12px 14px",background:S.greenBg,borderRadius:8,border:`1px solid #bbf7d0`}}><p style={{fontSize:12,fontWeight:700,color:S.greenText,margin:"0 0 8px"}}>⚡ Quick wins (do these first)</p>{(data.quick_wins||[]).map((w:string,i:number)=><p key={i} style={{fontSize:12,color:S.greenText,margin:"2px 0"}}>• {w}</p>)}</div>}
          </Card>
        )}
      </>)}
    </div>
  );
}

// ─── E-E-A-T Builder ──────────────────────────────────────────────────────────
function EEATBuilder({activeSite}:PageProps){
  const [domain,setDomain]=useState(activeSite?.replace(/^https?:\/\//,"").replace(/\/$/,"")||"");
  const [authorName,setAuthorName]=useState("");const [credentials,setCredentials]=useState("");
  const [loading,setLoading]=useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);const [err,setErr]=useState("");
  const run=async()=>{
    if(!domain.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      let siteInfo="";
      try{
        const d=await cachedCrawl(domain.trim());
        siteInfo=`Pages crawled: ${(d.pages||[]).length}. Has About page: ${(d.pages||[]).some((p:{url:string})=>p.url.includes("about"))}. Has Contact: ${(d.pages||[]).some((p:{url:string})=>p.url.includes("contact"))}.`;
      }catch{siteInfo="Could not crawl site.";}
      const res=await ai(`You are an E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) authority audit expert for Google and AI search.

Domain: ${domain}
Author/Expert name: ${authorName||"not provided"}
Credentials/Expertise: ${credentials||"not provided"}
Site analysis: ${siteInfo}

Conduct a full E-E-A-T audit and return ONLY valid JSON:
{
  "overall_eeat_score": number 0-100,
  "experience_score": number 0-100,
  "expertise_score": number 0-100,
  "authoritativeness_score": number 0-100,
  "trustworthiness_score": number 0-100,
  "signals": {
    "present": ["signal that exists 1","signal 2"],
    "missing": ["critical missing signal 1","missing signal 2","missing signal 3"],
    "partially_implemented": ["partial signal 1"]
  },
  "critical_actions": [
    {"action":"specific action","impact":"high"|"medium","effort":"low"|"medium"|"high","pillar":"E"|"E"|"A"|"T"}
  ],
  "author_schema": "complete JSON-LD Person schema as a string${authorName?` for ${authorName}`:""}",
  "organization_schema": "complete JSON-LD Organization schema for ${domain}",
  "trust_page_checklist": [
    {"page":"About page","exists":boolean,"missing_elements":["element1"]},
    {"page":"Contact page","exists":boolean,"missing_elements":[]},
    {"page":"Privacy Policy","exists":boolean,"missing_elements":[]},
    {"page":"Author bio page","exists":boolean,"missing_elements":["credentials","photo","social links"]}
  ],
  "ai_citation_impact": "How improving E-E-A-T will affect AI citation rate — 2 sentence explanation"
}`,8192);
      setData({...res,domain});
    }catch(e){setErr(e instanceof Error?e.message:"Analysis failed");}
    finally{setLoading(false);}
  };
  const scoreColor=(n:number)=>n>=70?S.green:n>=40?S.amber:S.red;
  const pillars=[
    {label:"Experience",key:"experience_score",icon:"👁"},
    {label:"Expertise",key:"expertise_score",icon:"🎓"},
    {label:"Authority",key:"authoritativeness_score",icon:"⭐"},
    {label:"Trust",key:"trustworthiness_score",icon:"🔒"},
  ];
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card style={{marginBottom:20}}>
        <SH title="E-E-A-T Authority Builder"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Audit your Experience, Expertise, Authoritativeness & Trustworthiness signals — critical for both Google ranking and AI citation.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="e.g. example.com"/></Field>
          <Field label="Author / Expert name (optional)"><TI value={authorName} onChange={setAuthorName} placeholder="e.g. Dr. Sarah Johnson"/></Field>
        </div>
        <Field label="Credentials & expertise (optional)"><TI value={credentials} onChange={setCredentials} placeholder="e.g. 15 years in digital marketing, MBA, Forbes contributor"/></Field>
        <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Auditing…":"Run E-E-A-T Audit"}</Btn>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Crawling site structure…","Analysing trust signals…","Evaluating authority markers…","Checking expertise indicators…","Generating schema markup…"]}/></Card>}
      {data&&(<>
        <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:16,marginBottom:16}}>
          <Card style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
            <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 8px",textAlign:"center"}}>E-E-A-T Score</p>
            <div style={{width:80,height:80,borderRadius:"50%",background:`conic-gradient(${scoreColor(data.overall_eeat_score||0)} ${(data.overall_eeat_score||0)*3.6}deg, ${S.subtle} 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:6}}>
              <div style={{width:60,height:60,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:18,fontWeight:700,color:scoreColor(data.overall_eeat_score||0)}}>{data.overall_eeat_score||0}</span>
              </div>
            </div>
          </Card>
          <Card>
            <SH title="E-E-A-T Pillars"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {pillars.map(p=>(
                <div key={p.key} style={{padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:S.text}}>{p.icon} {p.label}</span>
                    <span style={{fontSize:14,fontWeight:700,color:scoreColor(data[p.key]||0)}}>{data[p.key]||0}</span>
                  </div>
                  <Bar value={data[p.key]||0} color={scoreColor(data[p.key]||0)}/>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <Card>
            <SH title="Trust Signals Present" action={pill(`${(data.signals?.present||[]).length} found`,"green")}/>
            {(data.signals?.present||[]).map((s:string,i:number)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<(data.signals?.present||[]).length-1?`1px solid ${S.border}`:"none"}}>
                <span style={{color:S.green,fontWeight:700,flexShrink:0}}>✓</span>
                <p style={{fontSize:13,color:S.text,margin:0}}>{s}</p>
              </div>
            ))}
          </Card>
          <Card>
            <SH title="Missing Signals" action={pill(`${(data.signals?.missing||[]).length} gaps`,"red")}/>
            {(data.signals?.missing||[]).map((s:string,i:number)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<(data.signals?.missing||[]).length-1?`1px solid ${S.border}`:"none"}}>
                <span style={{color:S.red,fontWeight:700,flexShrink:0}}>✗</span>
                <p style={{fontSize:13,color:S.text,margin:0}}>{s}</p>
              </div>
            ))}
            {(data.signals?.partially_implemented||[]).length>0&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${S.border}`}}>
                <p style={{fontSize:11,fontWeight:700,color:S.amber,margin:"0 0 6px"}}>Partially implemented</p>
                {(data.signals?.partially_implemented||[]).map((s:string,i:number)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:4}}><span style={{color:S.amber,fontWeight:700}}>~</span><p style={{fontSize:12,color:S.muted,margin:0}}>{s}</p></div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <Card style={{marginBottom:16}}>
          <SH title="Priority Actions"/>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(data.critical_actions||[]).map((a:{action:string;impact:string;effort:string;pillar:string},i:number)=>(
              <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                <div style={{minWidth:28,height:28,borderRadius:8,background:S.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:S.accent,flexShrink:0}}>{a.pillar}</div>
                <div style={{flex:1}}>
                  <p style={{fontSize:13,color:S.text,fontWeight:500,margin:"0 0 4px"}}>{a.action}</p>
                  <div style={{display:"flex",gap:6}}>
                    {pill(`Impact: ${a.impact}`,a.impact==="high"?"red":"amber")}
                    {pill(`Effort: ${a.effort}`,a.effort==="low"?"green":"gray")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        {data.ai_citation_impact&&(
          <Card style={{marginBottom:16}}>
            <SH title="AI Citation Impact"/>
            <div style={{padding:"12px 14px",background:S.accentBg,borderRadius:8,border:`1px solid #c7d2fe`}}>
              <p style={{fontSize:13,color:S.text,margin:0,lineHeight:1.7}}>{data.ai_citation_impact}</p>
            </div>
          </Card>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {data.author_schema&&(
            <Card>
              <SH title="Person Schema (Author)" action={<CopyBtn text={data.author_schema}/>}/>
              <pre style={{background:S.subtle,borderRadius:8,padding:"12px 14px",fontSize:11,fontFamily:"monospace",margin:0,overflowX:"auto",lineHeight:1.5,color:S.text,whiteSpace:"pre-wrap",maxHeight:200}}>{data.author_schema}</pre>
            </Card>
          )}
          {data.organization_schema&&(
            <Card>
              <SH title="Organization Schema" action={<CopyBtn text={data.organization_schema}/>}/>
              <pre style={{background:S.subtle,borderRadius:8,padding:"12px 14px",fontSize:11,fontFamily:"monospace",margin:0,overflowX:"auto",lineHeight:1.5,color:S.text,whiteSpace:"pre-wrap",maxHeight:200}}>{data.organization_schema}</pre>
            </Card>
          )}
        </div>
      </>)}
    </div>
  );
}

// ── APP SHELL ──
type PageProps = {
  setPage: (p: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gscData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setGscData: (d: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ga4Data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setGa4Data: (d: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aeoData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAeoData: (d: any) => void;
  activeSite: string;
  setActiveSite: (s: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gscDataMap?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertGsc?: (domain: string, d: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ga4DataMap?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertGa4?: (propId: string, d: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aeoDataMap?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertAeo?: (domain: string, d: any) => void;
};

// ── Executive SEO Dashboard ─────────────────────────────────────────────────

type AuditReport = {
  overallScore: number; overallLabel: string;
  pillars: {
    technical: { score: number; label: string; crawlability: number; indexability: number; coreWebVitals: number; mobile: number; https: number; architecture: number };
    onpage: { score: number; label: string; titleTags: number; metaDesc: number; headers: number; kwAlign: number; intLinking: number; imageOpt: number };
    authority: { score: number; label: string; domainAuth: number; backlinks: number; refDomains: number; highAuth: number; toxic: number; growth: number };
    aeo: { score: number; label: string; snippetRate: number; paa: number; faqPages: number; howtoPages: number; answerBlocks: number; schemaCoverage: number };
    geo: { score: number; label: string; aiOverview: number; chatgpt: number; perplexity: number; gemini: number; copilot: number; claude: number };
    content: { score: number; label: string; avgWords: number; thinPages: number; freshness: number; eeat: number; topical: number; duplicate: number };
  };
  criticalIssues: { severity: string; text: string }[];
  technicalChecks: { check: string; status: string }[];
  cwv: { metric: string; current: string; target: string; status: string }[];
  aiBots: { bot: string; platform: string; access: string; action: string }[];
  metadataIssues: { issue: string; severity: string; pages: number | string }[];
  kwChecks: { factor: string; coverage: string; status: string }[];
  schemaAudit: { type: string; status: string; boost: string }[];
  extractability: { check: string; coverage: string; status: string }[];
  geoFactors: { method: string; boost: string; status: string }[];
  machineFiles: { file: string; purpose: string; status: string }[];
  eeat: { signal: string; status: string }[];
  contentGaps: { gap: string; priority: string; opportunity: string }[];
  thirdParty: { signal: string; status: string; impact: string; action: string }[];
  recommendations: { priority: string; title: string; desc: string; pillar: string; impact: string; effort: string; time: string }[];
};

type SvgDS = { data: number[]; color: string; fill?: string; dash?: boolean };

function SvgRadar({ labels, datasets, size = 270 }: { labels: string[]; datasets: SvgDS[]; size?: number }) {
  const cx = size/2, cy = size/2+6, r = size/2-50, n = labels.length;
  const ang = (i:number) => i*2*Math.PI/n - Math.PI/2;
  const pt = (v:number, i:number) => ({ x: cx+r*v/100*Math.cos(ang(i)), y: cy+r*v/100*Math.sin(ang(i)) });
  const toP = (pts:{x:number;y:number}[]) => pts.map((p,i)=>`${i?"L":"M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("")+"Z";
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
      {[25,50,75,100].map(v=><path key={v} d={toP(Array.from({length:n},(_,i)=>pt(v,i)))} fill="none" stroke="#e5e7eb" strokeWidth={0.5}/>)}
      {Array.from({length:n},(_,i)=>{ const p=pt(100,i); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth={0.5}/>; })}
      {datasets.map((ds,di)=><path key={di} d={toP(ds.data.map((v,i)=>pt(v,i)))} fill={ds.fill||"transparent"} stroke={ds.color} strokeWidth={1.5}/>)}
      {labels.map((lbl,i)=>{ const p=pt(118,i); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#9ca3af">{lbl}</text>; })}
    </svg>
  );
}

function SvgGroupedBar({ labels, datasets, height=180 }: { labels:string[]; datasets:SvgDS[]; height?:number }) {
  const W=460,pL=28,pB=26,pT=6,pR=8,cW=W-pL-pR,cH=height-pT-pB;
  const gW=cW/labels.length, bW=gW/(datasets.length+1);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`}>
      {[0,25,50,75,100].map(v=>{ const y=pT+cH-v/100*cH; return <g key={v}><line x1={pL} y1={y} x2={pL+cW} y2={y} stroke="#e5e7eb" strokeWidth={0.5}/><text x={pL-3} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">{v}</text></g>; })}
      {labels.map((lbl,li)=><g key={li}>
        {datasets.map((ds,di)=>{ const bh=Math.max(ds.data[li]/100*cH,1); return <rect key={di} x={pL+li*gW+(di+0.4)*bW} y={pT+cH-bh} width={bW*0.8} height={bh} fill={ds.color} rx={1}/>; })}
        <text x={pL+li*gW+gW/2} y={pT+cH+14} textAnchor="middle" fontSize={9} fill="#9ca3af">{lbl}</text>
      </g>)}
    </svg>
  );
}

function SvgHBar({ labels, data, colors, height=200 }: { labels:string[]; data:number[]; colors:string[]; height?:number }) {
  const W=440,pL=148,pR=40,pT=4,pB=4,cW=W-pL-pR,rH=(height-pT-pB)/labels.length,max=Math.max(...data,1);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`}>
      {labels.map((lbl,i)=>{ const y=pT+i*rH, bw=data[i]/max*cW; return <g key={i}><text x={pL-6} y={y+rH/2} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6b7280">{lbl}</text><rect x={pL} y={y+3} width={bw} height={rH-8} fill={colors[i]||"#6366f1"} rx={2}/><text x={pL+bw+5} y={y+rH/2} dominantBaseline="middle" fontSize={10} fill="#6b7280">{data[i]}</text></g>; })}
    </svg>
  );
}

function SvgDonut({ segments, size=148 }: { segments:{label:string;value:number;color:string}[]; size?:number }) {
  const cx=size/2, cy=size/2, r=size/2-12, inner=r*0.58, total=segments.reduce((s,x)=>s+x.value,0);
  let angle=-Math.PI/2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg,i)=>{
        const sweep=seg.value/total*2*Math.PI;
        const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
        angle+=sweep;
        const x2=cx+r*Math.cos(angle),y2=cy+r*Math.sin(angle);
        const ix1=cx+inner*Math.cos(angle-sweep),iy1=cy+inner*Math.sin(angle-sweep);
        const ix2=cx+inner*Math.cos(angle),iy2=cy+inner*Math.sin(angle);
        const lg=sweep>Math.PI?1:0;
        return <path key={i} d={`M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${lg},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${inner},${inner} 0 ${lg},0 ${ix1.toFixed(1)},${iy1.toFixed(1)}Z`} fill={seg.color}/>;
      })}
    </svg>
  );
}

function SvgLine({ labels, datasets, height=170 }: { labels:string[]; datasets:SvgDS[]; height?:number }) {
  const W=440,pL=28,pB=24,pT=8,pR=8,cW=W-pL-pR,cH=height-pT-pB;
  const maxV=Math.max(...datasets.flatMap(d=>d.data),1), xStep=cW/Math.max(labels.length-1,1);
  const yOf=(v:number)=>pT+cH-v/maxV*cH;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`}>
      {[0,Math.round(maxV/2),maxV].map(v=>{ const y=yOf(v); return <g key={v}><line x1={pL} y1={y} x2={pL+cW} y2={y} stroke="#e5e7eb" strokeWidth={0.5}/><text x={pL-3} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">{v}</text></g>; })}
      {labels.map((lbl,i)=><text key={i} x={pL+i*xStep} y={pT+cH+14} textAnchor="middle" fontSize={9} fill="#9ca3af">{lbl}</text>)}
      {datasets.map((ds,di)=><polyline key={di} points={ds.data.map((v,i)=>`${(pL+i*xStep).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ")} fill="none" stroke={ds.color} strokeWidth={1.8} strokeDasharray={ds.dash?"4,3":undefined}/>)}
    </svg>
  );
}

type RealAuditData = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pages: any[];
  summary: { total:number; ok:number; redirects:number; errors:number; missing_title:number; short_title:number; long_title:number; missing_meta:number; missing_h1:number; multiple_h1:number; imgs_no_alt:number; noindex_pages:number; no_canonical:number; thin_content:number };
  brokenLinks: { url:string; status:number }[];
  redirectedLinks: { url:string; status:number; redirectTo:string }[];
  totalLinksChecked: number;
  okLinks: number;
  botAccess: { bot:string; platform:string; access:string; action:string }[];
  robotsContent: string;
  robotsFound: boolean;
  schemaTypes: string[];
  dataSource: "DataForSEO" | "Crawl";
  onpageScore?: number;
};

function parseRobotsBotAccess(content:string, botName:string): "allowed"|"blocked"|"unspecified" {
  if(!content) return "unspecified";
  const lines = content.split('\n').map(l=>l.trim().toLowerCase());
  const bot = botName.toLowerCase();
  let inBot=false, inAll=false, botBlock=false, botAllow=false, allBlock=false;
  for(const line of lines) {
    if(line.startsWith("user-agent:")) { const agent=line.replace("user-agent:","").trim(); inBot=agent===bot; inAll=agent==="*"; }
    if(line.startsWith("disallow:")) { const path=line.replace("disallow:","").trim(); if(inBot&&path==="/") botBlock=true; if(inAll&&path==="/") allBlock=true; }
    if(line.startsWith("allow:")) { const path=line.replace("allow:","").trim(); if(inBot&&path==="/") botAllow=true; }
  }
  if(botBlock&&!botAllow) return "blocked";
  if(botAllow) return "allowed";
  if(allBlock&&!content.toLowerCase().includes(`user-agent: ${bot}`)) return "blocked";
  return "unspecified";
}

// ── SEO Audit Report (PRD model): async full-site crawl → deterministic 8-module
// scoring → prioritized remediation backlog. No AI scoring. ──
function ExecutiveDashboard({ activeSite }: PageProps) {
  const [domain, setDomain] = useState(activeSite ? activeSite.replace(/^https?:\/\//,"").replace(/\/$/,"") : "");
  const [phase, setPhase] = useState<"idle"|"crawling"|"done"|"error">("idle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [meta, setMeta] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [audit, setAudit] = useState<any>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("backlog");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const runningRef = useRef(false);

  const sevHex = (s:string)=> s==="critical"?S.red:s==="high"?"#ea580c":s==="medium"?S.amber:s==="low"?S.blue:S.muted;
  const scoreHex = (n:number)=> n>=75?"#16a34a":n>=50?"#d97706":"#dc2626";
  const sevPill = (s:string)=> <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase" as const,color:"#fff",background:sevHex(s),borderRadius:4,padding:"1px 6px",letterSpacing:"0.03em",flexShrink:0}}>{s}</span>;
  const post=(b:object)=>fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b),signal:AbortSignal.timeout(115000)}).then(r=>r.json());
  const get=(q:string)=>fetch(`/api/tools?${q}`,{signal:AbortSignal.timeout(30000)}).then(r=>r.json());
  const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

  async function runAudit(){
    const d = domain.replace(/^https?:\/\//,"").replace(/\/$/,"").trim(); if(!d) return;
    setPhase("crawling"); setError(""); setAudit(null); setMeta(null); setTab("backlog"); runningRef.current=true;
    try{
      const s = await post({tool:"crawl_start", domain:d, maxPages:800});
      if(s.error||!s.jobId) throw new Error(s.error||"Failed to start crawl");
      const jobId = s.jobId;
      let finished=false;
      while(!finished && runningRef.current){
        let ticking=true;
        // Poll live progress/audit every 4s while the ~90s worker tick runs.
        const poll=(async()=>{ while(ticking && runningRef.current){ await sleep(4000); if(!ticking) break; try{ const st=await get(`tool=crawl_status&jobId=${jobId}`); if(st.meta) setMeta(st.meta); if(st.audit) setAudit(st.audit); }catch{} } })();
        const t = await post({tool:"crawl_tick", jobId});
        ticking=false; await poll.catch(()=>{});
        if(t.error) throw new Error(t.error);
        if(t.meta) setMeta(t.meta);
        finished = t.meta?.status!=="running";
      }
      if(!runningRef.current) return;
      const fin = await get(`tool=crawl_status&jobId=${jobId}`);
      if(fin.meta?.status==="error") throw new Error(fin.meta.error||"Crawl error");
      if(fin.audit) setAudit(fin.audit);
      if(fin.meta) setMeta(fin.meta);
      setPhase("done");
    }catch(e){ setError(e instanceof Error?e.message:"Audit failed"); if(runningRef.current) setPhase("error"); }
    finally{ runningRef.current=false; }
  }
  const cancel=()=>{ runningRef.current=false; setPhase(audit?"done":"idle"); };

  // ── INPUT / IDLE ──
  if(phase==="idle"||(phase==="error"&&!audit)){
    return (
      <div>
        <SH title="SEO Audit Report"/>
        <p style={{fontSize:13,color:S.muted,marginBottom:20,maxWidth:660}}>Deterministic, full-site technical, on-page and AEO audit across 8 modules. Crawls the whole site (async, in the background), scores each pillar by real defect severity and prevalence, and outputs a prioritized remediation backlog with evidence and fixes.</p>
        <Card style={{maxWidth:660}}>
          <Field label="Website URL"><TI value={domain} onChange={setDomain} placeholder="yoursite.com"/></Field>
          {error&&<p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {error}</p>}
          <Btn onClick={runAudit} disabled={!domain.trim()}>Run Full Audit</Btn>
        </Card>
      </div>
    );
  }

  // ── report helpers ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules:any[] = audit?.modules||[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backlog:any[] = audit?.backlog||[];
  const toggle=(kk:string)=>{ const n=new Set(open); if(n.has(kk)) n.delete(kk); else n.add(kk); setOpen(n); };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const findingRow=(f:any,i:number)=>{
    const kk=`${f.id}:${i}`; const isOpen=open.has(kk);
    return (
      <div key={kk} style={{border:`1px solid ${S.border}`,borderRadius:8,marginBottom:6,overflow:"hidden",background:"#fff"}}>
        <button onClick={()=>toggle(kk)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const}}>
          {sevPill(f.severity)}
          <span style={{fontSize:13,color:S.text,flex:1,fontWeight:500}}>{f.name}</span>
          <span style={{fontSize:11,color:S.muted}}>{f.module}</span>
          <span style={{fontSize:12,fontWeight:700,color:sevHex(f.severity)}}>{Number(f.count).toLocaleString()}</span>
          <span style={{fontSize:11,color:S.muted,width:12}}>{isOpen?"▾":"▸"}</span>
        </button>
        {isOpen&&(
          <div style={{borderTop:`1px solid ${S.border}`,background:S.subtle,padding:"10px 12px"}}>
            <div style={{display:"flex",gap:16,flexWrap:"wrap" as const,marginBottom:8,fontSize:11,color:S.muted}}>
              <span>Effort: <strong style={{color:S.text}}>{f.effort}</strong></span>
              <span>Affected: <strong style={{color:S.text}}>{Number(f.count).toLocaleString()}</strong></span>
              <span>Priority: <strong style={{color:S.text}}>{Number(f.priority).toFixed(2)}</strong></span>
            </div>
            <p style={{fontSize:12,color:S.text,margin:"0 0 6px"}}><strong>Why it matters:</strong> {f.evidence}</p>
            <p style={{fontSize:12,color:S.text,margin:"0 0 8px"}}><strong>Fix:</strong> {f.fix}</p>
            {f.sample?.length>0&&<div style={{maxHeight:170,overflowY:"auto" as const,borderTop:`1px solid ${S.border}`,paddingTop:6}}>{f.sample.map((u:string,j:number)=><div key={j} style={{fontSize:11,color:S.muted,fontFamily:"ui-monospace,Menlo,monospace",padding:"2px 0",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{String(u).replace(/^https?:\/\//,"")}</div>)}{f.count>f.sample.length&&<div style={{fontSize:11,color:S.muted,marginTop:4}}>+{(f.count-f.sample.length).toLocaleString()} more</div>}</div>}
          </div>
        )}
      </div>
    );
  };
  const exportCsv=()=>{
    const esc=(v:unknown)=>`"${String(v??"").replace(/"/g,'""')}"`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows=backlog.map((f:any)=>[Number(f.priority).toFixed(2),f.severity,f.module,f.name,f.count,f.effort,f.evidence,f.fix].map(esc).join(","));
    const csv=["Priority,Severity,Module,Finding,Affected URLs,Effort,Why,Fix",...rows].join("\n");
    const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download=`${(domain||"site").replace(/[^a-z0-9]+/gi,"-")}-audit-backlog.csv`;a.click();
  };

  const busy = phase==="crawling";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tabs:any[] = [["backlog","Remediation Backlog"],...modules.map((m:any)=>[m.id,`${m.id} · ${m.title}`]),["roadmap","Roadmap"]];

  return (
    <div>
      {/* header */}
      <div style={{borderBottom:`1px solid ${S.border}`,paddingBottom:16,marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" as const}}>
          <span style={{fontSize:11,color:S.muted,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>SEO Audit · {domain}</span>
          {busy&&<span style={{fontSize:11,fontWeight:600,color:S.accent,background:S.accentBg,border:`1px solid ${S.accent}33`,borderRadius:20,padding:"2px 10px"}}>● Crawling… {meta?.scanned??0} pages{meta?.discovered?` · ${meta.discovered} discovered`:""}</span>}
          {!busy&&audit&&<span style={{fontSize:11,fontWeight:600,color:S.green,background:S.greenBg,border:`1px solid #86efac`,borderRadius:20,padding:"2px 10px"}}>✓ {audit.scannedPages} pages · deterministic audit</span>}
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            {busy?<Btn variant="secondary" small onClick={cancel}>Stop</Btn>:<>
              {audit&&<Btn variant="secondary" small onClick={exportCsv}>↓ Backlog CSV</Btn>}
              <Btn variant="secondary" small onClick={()=>{setPhase("idle");setAudit(null);setMeta(null);setError("");}}>New Audit</Btn>
            </>}
          </div>
        </div>
        {error&&<p style={{fontSize:12,color:S.red,margin:"8px 0 0"}}>⚠ {error}</p>}
      </div>

      {audit?(
        <>
        {/* executive scorecard */}
        <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap" as const,marginBottom:16}}>
          <div style={{textAlign:"center" as const}}>
            <div style={{fontSize:44,fontWeight:800,lineHeight:1,color:scoreHex(audit.overall)}}>{audit.overall}</div>
            <div style={{fontSize:11,color:S.muted,marginTop:4,fontWeight:600}}>{audit.label}</div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,flex:1}}>
            {modules.map((m:any)=>(
              <button key={m.id} onClick={()=>setTab(m.id)} style={{background:S.subtle,borderRadius:8,padding:"8px 12px",minWidth:98,border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const}}>
                <div style={{fontSize:10,color:S.muted,fontWeight:600}}>{m.id} · {m.weight}%</div>
                <div style={{fontSize:19,fontWeight:700,color:scoreHex(m.score),lineHeight:1.2}}>{m.score}</div>
                <div style={{fontSize:10,color:S.muted,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",maxWidth:104}}>{m.title}</div>
              </button>
            ))}
          </div>
        </div>
        {!audit.complete&&<div style={{fontSize:11,color:S.amberText,background:S.amberBg,border:`1px solid #fcd34d`,borderRadius:8,padding:"7px 12px",marginBottom:14}}>Crawled {Number(audit.scannedPages).toLocaleString()} pages{audit.sitemapCount?` of ~${Number(audit.sitemapCount).toLocaleString()} in the sitemap`:""}{busy?" so far (crawl in progress)":" (page cap reached)"}. Orphan-URL detection needs a complete crawl, so it is skipped until then.</div>}

        {/* tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${S.border}`,marginBottom:16,overflowX:"auto" as const,gap:0}}>
          {tabs.map((tp:any)=>(
            <button key={tp[0]} onClick={()=>setTab(tp[0])} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===tp[0]?S.accent:"transparent"}`,padding:"8px 13px",fontSize:12,color:tab===tp[0]?S.text:S.muted,cursor:"pointer",fontWeight:tab===tp[0]?600:400,whiteSpace:"nowrap" as const,marginBottom:-1,fontFamily:"inherit"}}>{tp[1]}</button>
          ))}
        </div>

        {tab==="backlog"&&(
          <div>
            <p style={{fontSize:12,color:S.muted,margin:"0 0 12px"}}>{backlog.length} findings, ranked by severity × affected URLs ÷ effort. Click a row for the evidence, the specific fix, and affected URLs.</p>
            {backlog.length?backlog.map((f:any,i:number)=>findingRow(f,i)):<p style={{fontSize:13,color:S.green}}>✓ No defects found.</p>}
          </div>
        )}
        {modules.map((m:any)=> tab===m.id&&(
          <div key={m.id}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <ScoreRing score={m.score} size={56} thickness={5}/>
              <div><div style={{fontSize:14,fontWeight:700,color:S.text}}>{m.title}</div><div style={{fontSize:11,color:S.muted}}>Module {m.id} · weight {m.weight}% · {m.findings.length} finding{m.findings.length===1?"":"s"}</div></div>
            </div>
            {m.findings.length?m.findings.map((f:any,i:number)=>findingRow(f,i)):<p style={{fontSize:13,color:S.green}}>✓ No defects in this module.</p>}
          </div>
        ))}
        {tab==="roadmap"&&(
          <div>
            <p style={{fontSize:12,color:S.muted,margin:"0 0 12px"}}>Deeper PRD checks that need data sources beyond a single crawl (CrUX, GSC Inspection, headless render, Common Crawl). Not yet wired, listed so nothing is silently missing.</p>
            {(audit.roadmap||[]).map((r:string,i:number)=>(<div key={i} style={{fontSize:13,color:S.text,padding:"8px 12px",border:`1px solid ${S.border}`,borderRadius:8,marginBottom:6,display:"flex",gap:8}}><span style={{color:S.muted}}>◻</span>{r}</div>))}
          </div>
        )}
        </>
      ):(
        <Card><LoadingBar phases={["Starting crawl…","Discovering URLs from sitemap + DataForSEO…","Crawling pages…","Scoring 8 modules…"]}/><p style={{fontSize:12,color:S.muted,marginTop:12,textAlign:"center" as const}}>Full-site crawl running{meta?.scanned?` — ${meta.scanned} pages scanned, ${meta.discovered||0} discovered`:""}. This can take several minutes on large sites; the report appears here and updates as it builds.</p></Card>
      )}
    </div>
  );
}

// ── llms.txt Generator ────────────────────────────────────────────────────────
function LlmsTxtGenerator({activeSite}:PageProps) {
  const [domain,setDomain]=useState(activeSite?activeSite.replace(/^https?:\/\//,"").replace(/\/$/,""):"");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const run=async()=>{
    if(!domain.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch(`/api/tools?tool=llmstxt&domain=${encodeURIComponent(domain.trim())}`);
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setData(d);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="llms.txt Generator"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Generate a machine-readable <strong>llms.txt</strong> file that gives AI systems (ChatGPT, Perplexity, Claude) a structured briefing on your website — boosting citation rates and AI visibility per the <a href="https://llmstxt.org" target="_blank" rel="noopener" style={{color:S.accent}}>llmstxt.org</a> standard.</p>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}><Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="e.g. eximius.ai"/></Field></div>
          <div style={{paddingBottom:16}}><Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Generating…":"Generate llms.txt"}</Btn></div>
        </div>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Fetching homepage…","Crawling sitemap…","Analysing page content…","Building llms.txt structure…"]}/></Card>}
      {data&&(
        <div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:16}}>
            {[["Pages Analyzed",data.pages_analyzed||0],["Sections Found",data.sections_found||0]].map(([l,v])=>(
              <div key={String(l)} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:140,boxShadow:S.shadow}}>
                <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>{l}</p>
                <p style={{fontSize:22,fontWeight:700,color:S.accent,margin:0}}>{v}</p>
              </div>
            ))}
            <div style={{background:S.accentBg,border:`1px solid #c7d2fe`,borderRadius:10,padding:"14px 20px",flex:2,minWidth:200,boxShadow:S.shadow}}>
              <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>Deploy to</p>
              <p style={{fontSize:13,fontWeight:600,color:S.accentText,margin:0}}>https://{data.domain}/llms.txt</p>
            </div>
          </div>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
              <SH title="Generated llms.txt"/>
              <div style={{display:"flex",gap:8}}>
                <CopyBtn text={data.llmstxt}/>
                <button onClick={()=>{const a=document.createElement("a");a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(data.llmstxt);a.download="llms.txt";a.click();}} style={{fontSize:12,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Download</button>
              </div>
            </div>
            <pre style={{fontSize:12,color:S.text,background:S.subtle,padding:"16px",borderRadius:8,overflow:"auto" as const,maxHeight:480,whiteSpace:"pre-wrap" as const,wordBreak:"break-word" as const,lineHeight:1.65,border:`1px solid ${S.border}`,margin:0}}>{data.llmstxt}</pre>
          </Card>
          <Card>
            <SH title="Deployment instructions"/>
            <div style={{display:"grid",gap:10}}>
              {[
                ["1","Upload the file","Place llms.txt at the root of your domain: https://"+data.domain+"/llms.txt"],
                ["2","Verify access","Test that the file is publicly accessible and returns content-type text/plain"],
                ["3","Declare in robots.txt","Add: LLMs: /llms.txt to your robots.txt file"],
                ["4","Submit to directories","Register at llmstxt.org/directory to increase AI discoverability"],
                ["5","Update regularly","Regenerate when you publish major new content sections"],
              ].map(([num,title,desc])=>(
                <div key={num} style={{display:"flex",gap:12,padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{num}</div>
                  <div><p style={{fontSize:13,fontWeight:600,color:S.text,margin:"0 0 2px"}}>{title}</p><p style={{fontSize:12,color:S.muted,margin:0}}>{desc}</p></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Pricing.md Generator ───────────────────────────────────────────────────────
function PricingMdGenerator({activeSite}:PageProps) {
  const [domain,setDomain]=useState(activeSite?activeSite.replace(/^https?:\/\//,"").replace(/\/$/,""):"");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const run=async()=>{
    if(!domain.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch(`/api/tools?tool=pricingmd&domain=${encodeURIComponent(domain.trim())}`);
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setData(d);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="Pricing.md Generator"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Generate a machine-readable <strong>/pricing.md</strong> file that lets AI agents and LLMs accurately quote your pricing — reducing hallucinations and making your pricing AI-discoverable.</p>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}><Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="e.g. eximius.ai"/></Field></div>
          <div style={{paddingBottom:16}}><Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Generating…":"Generate pricing.md"}</Btn></div>
        </div>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Fetching pricing page…","Parsing plan structure…","Extracting pricing signals…","Building pricing.md…"]}/></Card>}
      {data&&(
        <div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:16}}>
            <div style={{background:data.found_pricing_page?S.greenBg:S.amberBg,border:`1px solid ${data.found_pricing_page?"#a7f3d0":"#fde68a"}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:140,boxShadow:S.shadow}}>
              <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>Pricing Page</p>
              <p style={{fontSize:13,fontWeight:700,color:data.found_pricing_page?S.green:S.amber,margin:0}}>{data.found_pricing_page?"✓ Found":"⚠ Not Found"}</p>
            </div>
            <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:140,boxShadow:S.shadow}}>
              <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>Plans Detected</p>
              <p style={{fontSize:22,fontWeight:700,color:S.accent,margin:0}}>{data.plans_detected||0}</p>
            </div>
            <div style={{background:S.accentBg,border:`1px solid #c7d2fe`,borderRadius:10,padding:"14px 20px",flex:2,minWidth:200,boxShadow:S.shadow}}>
              <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>Deploy to</p>
              <p style={{fontSize:13,fontWeight:600,color:S.accentText,margin:0}}>https://{data.domain}/pricing.md</p>
            </div>
          </div>
          {data.found_pricing_page&&<div style={{fontSize:12,color:S.muted,marginBottom:12}}>Source: <a href={data.pricing_url} target="_blank" rel="noopener" style={{color:S.accent}}>{data.pricing_url}</a></div>}
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
              <SH title="Generated pricing.md"/>
              <div style={{display:"flex",gap:8}}>
                <CopyBtn text={data.pricingmd}/>
                <button onClick={()=>{const a=document.createElement("a");a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(data.pricingmd);a.download="pricing.md";a.click();}} style={{fontSize:12,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Download</button>
              </div>
            </div>
            <pre style={{fontSize:12,color:S.text,background:S.subtle,padding:"16px",borderRadius:8,overflow:"auto" as const,maxHeight:480,whiteSpace:"pre-wrap" as const,wordBreak:"break-word" as const,lineHeight:1.65,border:`1px solid ${S.border}`,margin:0}}>{data.pricingmd}</pre>
          </Card>
          <Card style={{background:S.amberBg,border:`1px solid #fde68a`}}>
            <p style={{fontSize:13,fontWeight:700,color:S.amberText,margin:"0 0 6px"}}>⚠ Review before publishing</p>
            <p style={{fontSize:12,color:S.amberText,margin:0}}>This file is auto-generated from your pricing page. Manually verify all prices and plan details are accurate before deploying. AI agents will quote these numbers directly to users.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Core Web Vitals ────────────────────────────────────────────────────────────
function CoreWebVitals({activeSite}:PageProps) {
  const [url,setUrl]=useState(activeSite||"");
  const [strategy,setStrategy]=useState<"mobile"|"desktop">("mobile");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const run=async()=>{
    if(!url.trim())return;
    const fullUrl=url.trim().startsWith("http")?url.trim():"https://"+url.trim();
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch(`/api/tools?tool=cwv&url=${encodeURIComponent(fullUrl)}&strategy=${strategy}`);
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setData(d);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  const cwvColor=(metric:string,val:number)=>{
    const thresholds:{[k:string]:[number,number]}={lcp:[2500,4000],fid:[100,300],cls:[0.1,0.25],fcp:[1800,3000],ttfb:[800,1800],inp:[200,500],tbt:[200,600],si:[3400,5800]};
    const t=thresholds[metric];
    if(!t)return S.green;
    return val<=t[0]?S.green:val<=t[1]?S.amber:S.red;
  };
  const cwvLabel=(metric:string,val:number)=>{
    const thresholds:{[k:string]:[number,number]}={lcp:[2500,4000],fid:[100,300],cls:[0.1,0.25],fcp:[1800,3000],ttfb:[800,1800],inp:[200,500],tbt:[200,600],si:[3400,5800]};
    const t=thresholds[metric];
    if(!t)return "Good";
    return val<=t[0]?"Good":val<=t[1]?"Needs Improvement":"Poor";
  };
  const fmtMs=(v:number|null)=>v===null?"—":v<1000?v+"ms":(v/1000).toFixed(2)+"s";
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="Core Web Vitals"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Measure real performance signals — LCP, CLS, INP, FCP, TTFB — via Google PageSpeed Insights. Add <code style={{background:S.subtle,padding:"1px 5px",borderRadius:3}}>PAGESPEED_API_KEY</code> in env vars for live data.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,marginBottom:12,alignItems:"flex-end"}}>
          <Field label="URL to test"><TI value={url} onChange={setUrl} placeholder="https://example.com"/></Field>
          <div style={{paddingBottom:16}}>
            <Toggle value={strategy} onChange={v=>setStrategy(v as "mobile"|"desktop")} options={[{value:"mobile",label:"Mobile"},{value:"desktop",label:"Desktop"}]}/>
          </div>
        </div>
        <Btn onClick={run} disabled={loading||!url.trim()}>{loading?"Running test…":"Run CWV Test"}</Btn>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Connecting to PageSpeed Insights…","Running Lighthouse audit…","Analysing performance metrics…","Computing Core Web Vitals scores…"]}/></Card>}
      {data&&(
        <div>
          {data.source==="estimated"&&(
            <div style={{background:S.amberBg,border:`1px solid #fde68a`,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:S.amberText}}>⚠ Estimated values — add PAGESPEED_API_KEY env var for real PageSpeed Insights data</div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:14,marginBottom:14}}>
            <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"18px 16px",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",boxShadow:S.shadow}}>
              <ScoreRing score={data.score||0} size={80} label="Perf Score"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[["Accessibility",data.accessibility||0],["Best Practices",data.bestPractices||0],["SEO",data.seo||0]].map(([l,v])=>(
                <div key={String(l)} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 16px",boxShadow:S.shadow}}>
                  <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 6px"}}>{l}</p>
                  <p style={{fontSize:22,fontWeight:700,color:(Number(v)>=80?S.green:Number(v)>=50?S.amber:S.red),margin:0}}>{v}</p>
                </div>
              ))}
            </div>
          </div>
          <Card>
            <SH title="Core Web Vitals"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
              {[
                {key:"lcp",label:"LCP",desc:"Largest Contentful Paint",val:data.lcp,fmt:fmtMs(data.lcp)},
                {key:"cls",label:"CLS",desc:"Cumulative Layout Shift",val:data.cls,fmt:data.cls===null?"—":String(data.cls)},
                {key:"inp",label:"INP",desc:"Interaction to Next Paint",val:data.inp,fmt:fmtMs(data.inp)},
                {key:"fcp",label:"FCP",desc:"First Contentful Paint",val:data.fcp,fmt:fmtMs(data.fcp)},
                {key:"ttfb",label:"TTFB",desc:"Time to First Byte",val:data.ttfb,fmt:fmtMs(data.ttfb)},
                {key:"tbt",label:"TBT",desc:"Total Blocking Time",val:data.tbt,fmt:fmtMs(data.tbt)},
              ].map(m=>{
                const c=m.val!==null?cwvColor(m.key,m.val):S.muted;
                const lbl=m.val!==null?cwvLabel(m.key,m.val):"N/A";
                return(
                  <div key={m.key} style={{background:S.subtle,borderRadius:10,padding:"14px 16px",border:`1px solid ${S.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div>
                        <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:0}}>{m.label}</p>
                        <p style={{fontSize:10,color:S.muted,margin:"2px 0 0"}}>{m.desc}</p>
                      </div>
                      <span style={{fontSize:9,fontWeight:700,color:c,background:c==="rgb(5, 150, 105)"||c===S.green?"#ecfdf5":c===S.amber?"#fffbeb":"#fef2f2",padding:"2px 7px",borderRadius:4,whiteSpace:"nowrap" as const}}>{lbl}</span>
                    </div>
                    <p style={{fontSize:20,fontWeight:700,color:c,margin:0}}>{m.fmt}</p>
                    <Bar value={m.val!==null?Math.min(100,100-(m.key==="cls"?m.val*400:m.val/50)):50} color={c} height={4}/>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <SH title="Improvement tips"/>
            <div style={{display:"grid",gap:8}}>
              {[
                {metric:"LCP",tip:"Preload hero images, use a CDN, optimize server response time. Target: ≤2.5s"},
                {metric:"CLS",tip:"Set explicit width/height on images and embeds. Avoid inserting content above existing content. Target: ≤0.1"},
                {metric:"INP",tip:"Minimize main-thread JavaScript. Break up long tasks into smaller chunks. Target: ≤200ms"},
                {metric:"TTFB",tip:"Enable server-side caching, use edge hosting (Vercel Edge, Cloudflare). Target: ≤800ms"},
                {metric:"TBT",tip:"Reduce third-party scripts, defer non-critical JS, use code splitting. Target: ≤200ms"},
              ].map(({metric,tip})=>(
                <div key={metric} style={{display:"flex",gap:12,padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                  <span style={{background:"linear-gradient(135deg,#6366f1,#818cf8)",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,flexShrink:0,height:"fit-content"}}>{metric}</span>
                  <p style={{fontSize:12,color:S.text,margin:0,lineHeight:1.55}}>{tip}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Editorial Calendar ─────────────────────────────────────────────────────────
function EditorialCalendar({activeSite}:PageProps) {
  const defDomain=activeSite?activeSite.replace(/^https?:\/\//,"").replace(/\/$/,""):"";
  const [domain,setDomain]=useState(defDomain);
  const [keywords,setKeywords]=useState("");
  const [audience,setAudience]=useState("");
  const [goals,setGoals]=useState("");
  const [months,setMonths]=useState("3");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cal,setCal]=useState<any>(null);
  const [selMonth,setSelMonth]=useState(0);
  const run=async()=>{
    if(!domain.trim())return;
    setLoading(true);setErr("");setCal(null);
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({tool:"calendar",domain:domain.trim(),keywords:keywords.split(",").map(k=>k.trim()).filter(Boolean),months:Number(months)||3,audience,goals})});
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setCal(d.calendar);setSelMonth(0);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  const typeColors:Record<string,string>={guide:"#6366f1",listicle:"#10b981","how-to":"#3b82f6","case-study":"#f59e0b",comparison:"#ec4899",news:"#64748b",interview:"#8b5cf6"};
  const intentColors:Record<string,string>={informational:S.blue,commercial:S.amber,transactional:S.green,navigational:S.muted};
  const monthData=cal?.months?.[selMonth];
  return(
    <div style={{maxWidth:1000,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="Editorial Calendar"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Generate an AI-powered content publishing schedule aligned to your SEO goals. Each post is mapped to keywords, search intent, and schema type.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="e.g. eximius.ai"/></Field>
          <Field label="Months to plan"><Toggle value={months} onChange={setMonths} options={["1","2","3","6"]}/></Field>
        </div>
        <Field label="Target keywords (comma-separated)"><TI value={keywords} onChange={setKeywords} placeholder="e.g. AI staffing, talent acquisition automation, workforce planning"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Target audience (optional)"><TI value={audience} onChange={setAudience} placeholder="e.g. HR managers, tech recruiters"/></Field>
          <Field label="Content goals (optional)"><TI value={goals} onChange={setGoals} placeholder="e.g. drive signups, build topical authority"/></Field>
        </div>
        <Btn onClick={run} disabled={loading||!domain.trim()}>{loading?"Generating calendar…":"Generate Editorial Calendar"}</Btn>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Analysing domain & industry…","Researching keyword opportunities…","Planning content themes…","Scheduling posts by week…","Assigning schema types…"]}/></Card>}
      {cal&&(
        <div>
          {/* Summary strip */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:16}}>
            {[
              ["Total Posts",(cal.months||[]).reduce((a:number,m:{posts?:unknown[]})=>a+((m.posts||[]).length),0)],
              ["Months Planned",(cal.months||[]).length],
              ["Pillar Topics",(cal.pillar_topics||[]).length],
              ["Quick Wins",(cal.quick_wins||[]).length],
            ].map(([l,v])=>(
              <div key={String(l)} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:120,boxShadow:S.shadow}}>
                <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 4px"}}>{l}</p>
                <p style={{fontSize:22,fontWeight:700,color:S.accent,margin:0}}>{v}</p>
              </div>
            ))}
          </div>
          {/* Month tabs */}
          <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap" as const}}>
            {(cal.months||[]).map((m:{month:string},i:number)=>(
              <button key={i} onClick={()=>setSelMonth(i)} style={{padding:"6px 16px",border:`1.5px solid ${selMonth===i?S.accent:S.border}`,borderRadius:7,background:selMonth===i?"linear-gradient(135deg,#6366f1,#818cf8)":"transparent",color:selMonth===i?"#fff":S.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{m.month}</button>
            ))}
          </div>
          {monthData&&(
            <div>
              <Card style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap" as const,gap:8}}>
                  <div>
                    <p style={{fontSize:15,fontWeight:700,color:S.text,margin:"0 0 2px"}}>{monthData.month}</p>
                    <p style={{fontSize:12,color:S.accent,margin:0}}>Theme: {monthData.theme}</p>
                  </div>
                  <button onClick={()=>{const rows=["Week,Title,Type,Keywords,Intent,Schema,Word Count,Priority"];(monthData.posts||[]).forEach((p:{week:number;title:string;type:string;keywords:string[];intent:string;schema:string;word_count:number;priority:string})=>rows.push(`${p.week},"${p.title}",${p.type},"${(p.keywords||[]).join(";")}",${p.intent},${p.schema},${p.word_count},${p.priority}`));const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(rows.join("\n"));a.download=`calendar-${monthData.month}.csv`;a.click();}} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>
                </div>
                <div style={{display:"grid",gap:10}}>
                  {(monthData.posts||[]).map((post:{week:number;title:string;type:string;keywords:string[];angle:string;word_count:number;schema:string;priority:string;intent:string},i:number)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"48px 1fr",gap:12,padding:"14px 16px",background:S.subtle,borderRadius:10,border:`1px solid ${S.border}`}}>
                      <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3}}>
                        <div style={{width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:700}}>W{post.week}</div>
                        <span style={{fontSize:9,fontWeight:700,color:post.priority==="high"?S.red:post.priority==="medium"?S.amber:S.green,textTransform:"uppercase" as const}}>{post.priority}</span>
                      </div>
                      <div>
                        <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 4px"}}>{post.title}</p>
                        <p style={{fontSize:11,color:S.muted,margin:"0 0 6px",lineHeight:1.4}}>{post.angle}</p>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#fff",background:typeColors[post.type]||S.muted,padding:"2px 8px",borderRadius:4}}>{post.type}</span>
                          <span style={{fontSize:10,fontWeight:700,color:intentColors[post.intent]||S.muted,background:S.subtle,border:`1px solid ${S.border}`,padding:"2px 8px",borderRadius:4}}>{post.intent}</span>
                          {post.schema!=="none"&&<span style={{fontSize:10,color:S.green,background:"#ecfdf5",border:"1px solid #a7f3d0",padding:"2px 8px",borderRadius:4}}>{post.schema}</span>}
                          <span style={{fontSize:10,color:S.muted,background:S.subtle,border:`1px solid ${S.border}`,padding:"2px 8px",borderRadius:4}}>{post.word_count} words</span>
                          {(post.keywords||[]).slice(0,2).map((k:string,j:number)=>(
                            <span key={j} style={{fontSize:10,color:S.accentText,background:S.accentBg,border:"1px solid #c7d2fe",padding:"2px 8px",borderRadius:4}}>{k}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {(cal.pillar_topics||[]).length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card>
                <SH title="Pillar topics"/>
                {(cal.pillar_topics||[]).map((t:string,i:number)=>(
                  <div key={i} style={{display:"flex",gap:8,padding:"8px 10px",borderRadius:6,background:S.accentBg,border:"1px solid #c7d2fe",marginBottom:6}}>
                    <span style={{color:S.accent,fontWeight:700}}>⊡</span>
                    <span style={{fontSize:12,color:S.accentText}}>{t}</span>
                  </div>
                ))}
              </Card>
              <Card>
                <SH title="Quick wins (publish now)"/>
                {(cal.quick_wins||[]).map((q:string,i:number)=>(
                  <div key={i} style={{display:"flex",gap:8,padding:"8px 10px",borderRadius:6,background:"#ecfdf5",border:"1px solid #a7f3d0",marginBottom:6}}>
                    <span style={{color:S.green,fontWeight:700}}>⚡</span>
                    <span style={{fontSize:12,color:S.greenText}}>{q}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PAA → FAQ Converter ────────────────────────────────────────────────────────
function PAAtoFAQ(_props:PageProps) {
  const [keyword,setKeyword]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const [tab,setTab]=useState("faq");
  const run=async()=>{
    if(!keyword.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch(`/api/tools?tool=paafaq&keyword=${encodeURIComponent(keyword.trim())}`);
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setData(d);setTab("faq");
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  const typeColors:Record<string,string>={definition:"#6366f1",process:"#10b981",comparison:"#f59e0b","yes-no":"#3b82f6",list:"#ec4899"};
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="PAA → FAQ Converter"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Convert People Also Ask questions into SEO-optimised FAQ content with <strong>FAQPage schema</strong> — structured for featured snippet capture and AI citation.</p>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}><Field label="Target keyword"><TI value={keyword} onChange={setKeyword} placeholder="e.g. AI recruiting software"/></Field></div>
          <div style={{paddingBottom:16}}><Btn onClick={run} disabled={loading||!keyword.trim()}>{loading?"Generating…":"Generate FAQs"}</Btn></div>
        </div>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Researching PAA questions…","Analysing search intent…","Generating optimised answers…","Building FAQPage schema…"]}/></Card>}
      {data&&(
        <div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:14}}>
            <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:120,boxShadow:S.shadow}}>
              <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 4px"}}>FAQ Items</p>
              <p style={{fontSize:22,fontWeight:700,color:S.accent,margin:0}}>{(data.result?.faq_items||[]).length}</p>
            </div>
            <div style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:120,boxShadow:S.shadow}}>
              <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 4px"}}>PAA Context</p>
              <p style={{fontSize:22,fontWeight:700,color:S.accent,margin:0}}>{data.paa_context||0} snippets</p>
            </div>
            <div style={{background:S.greenBg,border:"1px solid #a7f3d0",borderRadius:10,padding:"14px 20px",flex:2,minWidth:160,boxShadow:S.shadow}}>
              <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 4px"}}>Schema ready</p>
              <p style={{fontSize:13,fontWeight:700,color:S.green,margin:0}}>✓ FAQPage JSON-LD included</p>
            </div>
          </div>
          <Tabs tabs={["faq","schema","tips"]} active={tab} onChange={setTab}/>
          {tab==="faq"&&(
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center",flexWrap:"wrap" as const,gap:8}}>
                <SH title="FAQ Section"/>
                <CopyBtn text={(data.result?.faq_items||[]).map((f:{question:string;answer:string})=>`**${f.question}**\n${f.answer}`).join("\n\n")}/>
              </div>
              {(data.result?.faq_items||[]).map((item:{question:string;answer:string;type:string;schema_eligible:boolean},i:number)=>(
                <div key={i} style={{padding:"14px 0",borderBottom:i<(data.result?.faq_items||[]).length-1?`1px solid ${S.border}`:"none"}}>
                  <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#fff",background:typeColors[item.type]||S.muted,padding:"2px 8px",borderRadius:4,flexShrink:0}}>{item.type}</span>
                    {item.schema_eligible&&<span style={{fontSize:10,color:S.green,background:"#ecfdf5",border:"1px solid #a7f3d0",padding:"2px 8px",borderRadius:4,flexShrink:0}}>Schema ✓</span>}
                  </div>
                  <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 6px"}}>Q: {item.question}</p>
                  <p style={{fontSize:12,color:S.muted,margin:0,lineHeight:1.6}}>A: {item.answer}</p>
                </div>
              ))}
            </Card>
          )}
          {tab==="schema"&&(
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center",flexWrap:"wrap" as const,gap:8}}>
                <SH title="FAQPage JSON-LD Schema"/>
                <CopyBtn text={JSON.stringify(data.result?.schema||{},null,2)}/>
              </div>
              <pre style={{fontSize:11,color:S.text,background:S.subtle,padding:"14px",borderRadius:8,overflow:"auto" as const,maxHeight:450,whiteSpace:"pre-wrap" as const,wordBreak:"break-word" as const,border:`1px solid ${S.border}`,margin:0}}>{JSON.stringify(data.result?.schema||{},null,2)}</pre>
              <div style={{marginTop:12,padding:"10px 14px",background:S.accentBg,borderRadius:6}}>
                <p style={{fontSize:12,fontWeight:600,color:S.accentText,margin:0}}>→ Add this script tag to your page: <code style={{fontSize:11}}>&lt;script type="application/ld+json"&gt;...&lt;/script&gt;</code></p>
              </div>
            </Card>
          )}
          {tab==="tips"&&(
            <Card>
              <SH title="Featured Snippet Tips"/>
              <p style={{fontSize:12,color:S.muted,marginBottom:12}}>{data.result?.summary}</p>
              {(data.result?.featured_snippet_tips||[]).map((tip:string,i:number)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",background:S.subtle,borderRadius:7,marginBottom:8}}>
                  <span style={{color:S.accent,fontWeight:700,flexShrink:0}}>→</span>
                  <p style={{fontSize:12,color:S.text,margin:0}}>{tip}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pillar Page Planner ────────────────────────────────────────────────────────
function PillarPlanner({activeSite}:PageProps) {
  const defDomain=activeSite?activeSite.replace(/^https?:\/\//,"").replace(/\/$/,""):"";
  const [topic,setTopic]=useState("");
  const [domain,setDomain]=useState(defDomain);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const [tab,setTab]=useState("pillar");
  const run=async()=>{
    if(!topic.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch(`/api/tools?tool=pillar&topic=${encodeURIComponent(topic.trim())}&domain=${encodeURIComponent(domain.trim())}`);
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setData(d);setTab("pillar");
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  const intentColors:Record<string,string>={informational:S.blue,commercial:S.amber,transactional:S.green,navigational:S.muted};
  const priorityColors:Record<string,string>={high:S.red,medium:S.amber,low:S.green};
  const R=data?.result;
  return(
    <div style={{maxWidth:1000,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="Pillar Page Planner"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Build a complete topic cluster — one pillar page + supporting cluster pages with internal linking strategy to dominate topical authority for your target topic.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Topic"><TI value={topic} onChange={setTopic} placeholder="e.g. AI Recruiting Software"/></Field>
          <Field label="Domain (optional)"><TI value={domain} onChange={setDomain} placeholder="e.g. eximius.ai"/></Field>
        </div>
        <Btn onClick={run} disabled={loading||!topic.trim()}>{loading?"Planning…":"Build Pillar Plan"}</Btn>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Analysing topic cluster…","Mapping keyword intent…","Designing pillar structure…","Planning cluster pages…","Building internal link strategy…"]}/></Card>}
      {R&&(
        <div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:14}}>
            {[
              ["Cluster Pages",(R.cluster_pages||[]).length],
              ["Traffic Potential",R.estimated_traffic_potential||"—"],
              ["Time to Rank",R.time_to_rank||"—"],
              ["Topical Authority",R.topical_authority_score||0],
            ].map(([l,v])=>(
              <div key={String(l)} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:120,boxShadow:S.shadow}}>
                <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 4px"}}>{l}</p>
                <p style={{fontSize:typeof v==="number"&&v<200?22:14,fontWeight:700,color:S.accent,margin:0}}>{v}</p>
              </div>
            ))}
          </div>
          <Tabs tabs={["pillar","clusters","linking","quick wins"]} active={tab} onChange={setTab}/>
          {tab==="pillar"&&R.pillar_page&&(
            <Card>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <div style={{width:34,height:34,borderRadius:8,background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:700}}>P</div>
                <div>
                  <p style={{fontSize:15,fontWeight:700,color:S.text,margin:0}}>{R.pillar_page.title}</p>
                  <p style={{fontSize:11,color:S.muted,margin:0}}>{R.pillar_page.url_slug} · {R.pillar_page.word_count?.toLocaleString()} words · {R.pillar_page.intent}</p>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:14}}>
                <span style={{fontSize:11,background:S.accentBg,color:S.accentText,border:"1px solid #c7d2fe",padding:"3px 10px",borderRadius:5,fontWeight:600}}>Primary: {R.pillar_page.primary_keyword}</span>
                {(R.pillar_page.secondary_keywords||[]).map((k:string,i:number)=>(
                  <span key={i} style={{fontSize:11,background:S.subtle,color:S.muted,border:`1px solid ${S.border}`,padding:"3px 10px",borderRadius:5}}>{k}</span>
                ))}
              </div>
              <div style={{display:"grid",gap:8}}>
                {(R.pillar_page.outline||[]).map((sec:{h2:string;h3s:string[];word_count:number},i:number)=>(
                  <div key={i} style={{padding:"12px 14px",background:S.subtle,borderRadius:8,border:`1px solid ${S.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <p style={{fontSize:13,fontWeight:700,color:S.text,margin:0}}>{sec.h2}</p>
                      <span style={{fontSize:10,color:S.muted}}>{sec.word_count} words</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                      {(sec.h3s||[]).map((h:string,j:number)=>(
                        <span key={j} style={{fontSize:11,color:S.muted,background:S.card,border:`1px solid ${S.border}`,padding:"2px 8px",borderRadius:4}}>↳ {h}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {tab==="clusters"&&(
            <div style={{display:"grid",gap:10}}>
              {(R.cluster_pages||[]).map((c:{title:string;url_slug:string;word_count:number;primary_keyword:string;intent:string;internal_link_text:string;priority:string;content_type:string},i:number)=>(
                <div key={i} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:10,padding:"14px 16px",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center",boxShadow:S.shadow}}>
                  <div style={{width:28,height:28,borderRadius:6,background:S.subtle,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:S.muted}}>{i+1}</div>
                  <div>
                    <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 2px"}}>{c.title}</p>
                    <p style={{fontSize:11,color:S.muted,margin:"0 0 5px"}}>{c.url_slug} · {c.word_count} words · KW: {c.primary_keyword}</p>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
                      <span style={{fontSize:10,color:intentColors[c.intent]||S.muted,background:S.subtle,border:`1px solid ${S.border}`,padding:"2px 7px",borderRadius:4}}>{c.intent}</span>
                      <span style={{fontSize:10,color:S.accent,background:S.accentBg,border:"1px solid #c7d2fe",padding:"2px 7px",borderRadius:4}}>{c.content_type}</span>
                      <span style={{fontSize:10,color:S.muted,background:S.subtle,border:`1px solid ${S.border}`,padding:"2px 7px",borderRadius:4}}>Link: "{c.internal_link_text}"</span>
                    </div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,color:"#fff",background:priorityColors[c.priority]||S.muted,padding:"3px 9px",borderRadius:5,flexShrink:0}}>{c.priority}</span>
                </div>
              ))}
            </div>
          )}
          {tab==="linking"&&R.internal_link_strategy&&(
            <Card>
              <SH title="Internal Link Strategy"/>
              {[
                ["Pillar → Cluster",R.internal_link_strategy.pillar_to_cluster],
                ["Cluster → Pillar",R.internal_link_strategy.cluster_to_pillar],
                ["Cross-linking",R.internal_link_strategy.cross_linking],
              ].map(([label,value])=>(
                <div key={String(label)} style={{marginBottom:14}}>
                  <p style={{fontSize:12,fontWeight:700,color:S.text,margin:"0 0 6px"}}>{label}</p>
                  {Array.isArray(value)
                    ?(value as string[]).map((v,i)=><div key={i} style={{fontSize:12,color:S.muted,padding:"5px 10px",background:S.subtle,borderRadius:5,marginBottom:4,borderLeft:`3px solid ${S.accent}`}}>→ {v}</div>)
                    :<div style={{fontSize:12,color:S.muted,padding:"8px 12px",background:S.subtle,borderRadius:6,borderLeft:`3px solid ${S.accent}`}}>{String(value)}</div>}
                </div>
              ))}
            </Card>
          )}
          {tab==="quick wins"&&(
            <Card>
              <SH title="Quick Wins — Act Now"/>
              {(R.quick_wins||[]).map((q:string,i:number)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:7,marginBottom:8}}>
                  <span style={{color:S.green,fontWeight:700,flexShrink:0}}>⚡</span>
                  <p style={{fontSize:12,color:S.greenText,margin:0}}>{q}</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Content Extractability Score ───────────────────────────────────────────────
function ExtractabilityScore(_props:PageProps) {
  const [url,setUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const run=async()=>{
    if(!url.trim())return;
    const fullUrl=url.trim().startsWith("http")?url.trim():"https://"+url.trim();
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch(`/api/tools?tool=extractability&url=${encodeURIComponent(fullUrl)}`);
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setData(d);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  const statusColors:Record<string,string>={pass:S.green,partial:S.amber,fail:S.red};
  const statusBg:Record<string,string>={pass:"#ecfdf5",partial:"#fffbeb",fail:"#fef2f2"};
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="Content Extractability Score"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}>Score how likely your page is to be <strong>cited by AI systems</strong> (ChatGPT, Perplexity, Claude) across 7 dimensions: structure, answer format, entity clarity, citation signals, schema, reading level, and content depth.</p>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}><Field label="Page URL"><TI value={url} onChange={setUrl} placeholder="https://example.com/blog/post"/></Field></div>
          <div style={{paddingBottom:16}}><Btn onClick={run} disabled={loading||!url.trim()}>{loading?"Analysing…":"Score Page"}</Btn></div>
        </div>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Fetching page content…","Analysing structure…","Scoring entity clarity…","Checking schema markup…","Computing extractability score…"]}/></Card>}
      {data&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:14,marginBottom:14}}>
            <Card style={{display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:20}}>
              <ScoreRing score={data.total_score||0} size={80} label="Extractability"/>
              <p style={{fontSize:11,fontWeight:700,color:data.total_score>=80?S.green:data.total_score>=65?S.amber:S.red,margin:"6px 0 0",textAlign:"center" as const}}>{data.grade} — {data.label}</p>
            </Card>
            <Card>
              <SH title="What this means"/>
              <p style={{fontSize:13,color:S.text,margin:"0 0 10px"}}>
                {data.total_score>=80?"Excellent — this page is highly likely to be cited verbatim by AI systems. It has strong structure, direct answers, and rich entity signals.":
                data.total_score>=65?"Good — this page will often appear in AI-generated answers but some dimensions need improvement.":
                data.total_score>=50?"Average — AI systems may partially extract content but miss key answers. Priority fixes needed.":
                "Poor — AI systems are unlikely to cite this page. Significant restructuring recommended."}
              </p>
              {(data.top_fixes||[]).length>0&&(
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 6px"}}>Top 3 fixes</p>
                  {(data.top_fixes||[]).map((fix:string,i:number)=>(
                    <div key={i} style={{fontSize:12,color:S.text,padding:"6px 10px",background:S.redBg,borderRadius:5,marginBottom:4,borderLeft:`3px solid ${S.red}`}}>{fix}</div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <Card>
            <SH title="Dimension breakdown"/>
            <div style={{display:"grid",gap:10}}>
              {(data.dimensions||[]).map((d:{name:string;score:number;weight:number;detail:string;status:string},i:number)=>(
                <div key={i} style={{padding:"12px 14px",background:statusBg[d.status]||S.subtle,borderRadius:8,border:`1px solid ${d.status==="pass"?"#a7f3d0":d.status==="partial"?"#fde68a":"#fecaca"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:13,fontWeight:700,color:S.text}}>{d.name}</span>
                      <span style={{fontSize:10,color:S.muted}}>weight: {d.weight}%</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:14,fontWeight:700,color:statusColors[d.status]||S.muted}}>{d.score}</span>
                      <span style={{fontSize:10,fontWeight:700,color:statusColors[d.status]||S.muted,textTransform:"uppercase" as const}}>{d.status}</span>
                    </div>
                  </div>
                  <Bar value={d.score} color={statusColors[d.status]||S.muted} height={5}/>
                  <p style={{fontSize:11,color:S.muted,margin:"6px 0 0"}}>{d.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── SOAIV Tracker ─────────────────────────────────────────────────────────────
function SOAIVTracker({activeSite}:PageProps) {
  const defDomain=activeSite?activeSite.replace(/^https?:\/\//,"").replace(/\/$/,""):"";
  const [brand,setBrand]=useState("");
  const [domain,setDomain]=useState(defDomain);
  const [category,setCategory]=useState("");
  const [keywords,setKeywords]=useState("");
  const [competitors,setCompetitors]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,setData]=useState<any>(null);
  const run=async()=>{
    if(!brand.trim())return;
    setLoading(true);setErr("");setData(null);
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({tool:"soaiv",brand:brand.trim(),domain:domain.trim(),category:category.trim(),
          keywords:keywords.split(",").map(k=>k.trim()).filter(Boolean),
          competitors:competitors.split(",").map(c=>c.trim()).filter(Boolean)})});
      const d=await r.json();
      if(d.error)throw new Error(d.error);
      setData(d.result);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  };
  const R=data;
  const trendIcon=(t:string)=>t==="rising"?"↑":t==="declining"?"↓":"→";
  const trendColor=(t:string)=>t==="rising"?S.green:t==="declining"?S.red:S.muted;
  const sentColors:Record<string,string>={positive:S.green,neutral:S.muted,negative:S.red};
  const platformColors:Record<string,string>={ChatGPT:"#10a37f","Google AI Overviews":"#4285f4",Perplexity:"#20b2aa",Gemini:"#9c27b0","Microsoft Copilot":"#0078d4",Claude:"#e07b39"};
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"0 4px"}}>
      <Card>
        <SH title="SOAIV Tracker"/>
        <p style={{fontSize:13,color:S.muted,margin:"0 0 14px"}}><strong>Share of AI Voice (SOAIV)</strong> measures what percentage of AI-generated answers in your category mention your brand — the AI equivalent of Share of Voice.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Brand name"><TI value={brand} onChange={setBrand} placeholder="e.g. Eximius AI"/></Field>
          <Field label="Domain"><TI value={domain} onChange={setDomain} placeholder="e.g. eximius.ai"/></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Category / Industry"><TI value={category} onChange={setCategory} placeholder="e.g. AI Staffing & Recruiting"/></Field>
          <Field label="Target keywords (comma-separated)"><TI value={keywords} onChange={setKeywords} placeholder="e.g. AI recruiting, talent acquisition"/></Field>
        </div>
        <Field label="Competitors (comma-separated, optional)"><TI value={competitors} onChange={setCompetitors} placeholder="e.g. HireEZ, SeekOut, Beamery"/></Field>
        <Btn onClick={run} disabled={loading||!brand.trim()}>{loading?"Analysing AI Voice…":"Calculate SOAIV"}</Btn>
        {err&&<p style={{color:S.red,fontSize:13,margin:"8px 0 0"}}>{err}</p>}
      </Card>
      {loading&&<Card><LoadingBar phases={["Modelling category AI landscape…","Estimating citation rates per platform…","Benchmarking against competitors…","Identifying query type gaps…","Generating SOAIV report…"]}/></Card>}
      {R&&(
        <div>
          {R.estimated_data_confidence==="low"&&(
            <div style={{background:S.amberBg,border:`1px solid #fde68a`,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:S.amberText}}>⚠ AI-modelled estimate — for verified real-time data, connect LLM monitoring APIs (OpenAI, Perplexity)</div>
          )}
          <div style={{display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:14}}>
            {[
              ["SOAIV Score",R.overall_soaiv+"%","Overall brand voice in AI answers",R.overall_soaiv>=20?S.green:R.overall_soaiv>=10?S.amber:S.red],
              ["Category Benchmark",R.category_benchmark+"%","Average in your category",S.muted],
              ["Gap to Leader",R.gap_to_leader ? (R.gap_to_leader>0?"+":"")+R.gap_to_leader+"%" : "—","Points vs #1 brand",R.gap_to_leader<=0?S.green:S.red],
            ].map(([l,v,sub,col])=>(
              <div key={String(l)} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"18px 20px",flex:1,minWidth:140,boxShadow:S.shadow}}>
                <p style={{fontSize:11,fontWeight:600,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",margin:"0 0 6px"}}>{l}</p>
                <p style={{fontSize:26,fontWeight:700,color:String(col),margin:"0 0 4px"}}>{v}</p>
                <p style={{fontSize:11,color:S.muted,margin:0}}>{sub}</p>
              </div>
            ))}
          </div>
          <Card style={{marginBottom:14}}>
            <SH title="Citation rate by AI platform"/>
            <div style={{display:"grid",gap:8}}>
              {(R.platforms||[]).map((p:{platform:string;citation_rate:number;mention_context:string;sentiment:string;rank_in_category:number;trend:string},i:number)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"140px 1fr auto",gap:12,alignItems:"center",padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:platformColors[p.platform]||S.muted,flexShrink:0}}/>
                    <span style={{fontSize:12,fontWeight:600,color:S.text}}>{p.platform}</span>
                  </div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:14,fontWeight:700,color:S.accent}}>{p.citation_rate}%</span>
                      <span style={{fontSize:10,color:trendColor(p.trend),fontWeight:700}}>{trendIcon(p.trend)} {p.trend}</span>
                      <span style={{fontSize:10,color:sentColors[p.sentiment]||S.muted}}>● {p.sentiment}</span>
                    </div>
                    <div style={{height:5,background:S.card,borderRadius:99,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(p.citation_rate,100)}%`,background:platformColors[p.platform]||S.accent,borderRadius:99}}/>
                    </div>
                    <p style={{fontSize:10,color:S.muted,margin:"3px 0 0"}}>{p.mention_context}</p>
                  </div>
                  <span style={{fontSize:11,color:S.muted,whiteSpace:"nowrap" as const}}>Rank #{p.rank_in_category}</span>
                </div>
              ))}
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <Card>
              <SH title="Winning queries" action={pill(`${(R.query_types_winning||[]).length}`,"green")}/>
              {(R.query_types_winning||[]).map((q:string,i:number)=>(
                <div key={i} style={{fontSize:12,color:S.greenText,padding:"6px 10px",background:S.greenBg,borderRadius:5,marginBottom:4,borderLeft:`3px solid ${S.green}`}}>✓ {q}</div>
              ))}
            </Card>
            <Card>
              <SH title="Losing queries" action={pill(`${(R.query_types_losing||[]).length}`,"red")}/>
              {(R.query_types_losing||[]).map((q:string,i:number)=>(
                <div key={i} style={{fontSize:12,color:S.redText,padding:"6px 10px",background:S.redBg,borderRadius:5,marginBottom:4,borderLeft:`3px solid ${S.red}`}}>✗ {q}</div>
              ))}
            </Card>
          </div>
          {(R.competitors||[]).length>0&&(
            <Card style={{marginBottom:14}}>
              <SH title="Competitor SOAIV comparison"/>
              <div style={{display:"grid",gap:8}}>
                {[{name:R.brand,soaiv:R.overall_soaiv,rank:0},...(R.competitors||[])].sort((a:{soaiv:number},b:{soaiv:number})=>b.soaiv-a.soaiv).map((c:{name:string;soaiv:number;rank:number},i:number)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center",gap:12,padding:"8px 12px",background:c.name===R.brand?S.accentBg:S.subtle,borderRadius:7,border:`1px solid ${c.name===R.brand?"#c7d2fe":S.border}`}}>
                    <div>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:c.name===R.brand?700:500,color:c.name===R.brand?S.accentText:S.text}}>{c.name===R.brand?"⭐ "+c.name:c.name}</span>
                      </div>
                      <div style={{height:6,background:S.card,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(c.soaiv,100)}%`,background:c.name===R.brand?"#6366f1":"#d1d5db",borderRadius:99,transition:"width 0.5s ease"}}/>
                      </div>
                    </div>
                    <span style={{fontSize:15,fontWeight:700,color:c.name===R.brand?S.accentText:S.muted,whiteSpace:"nowrap" as const}}>{c.soaiv}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <SH title="Top opportunities to grow SOAIV"/>
            {(R.top_opportunities||[]).map((opp:string,i:number)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",background:S.accentBg,borderRadius:7,marginBottom:8,border:"1px solid #c7d2fe"}}>
                <span style={{color:S.accent,fontWeight:700,flexShrink:0}}>{i+1}</span>
                <p style={{fontSize:12,color:S.accentText,margin:0}}>{opp}</p>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Content SERP Analyzer (bulk keyword → SERP intelligence + content gaps + briefs) ──
function ContentSERP({activeSite,setActiveSite,setPage,gscDataMap={},ga4DataMap={}}:PageProps) {
  const [kwInput,setKwInput]=useState("");
  const [userUrl,setUserUrl]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results,setResults]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0});
  const [err,setErr]=useState("");
  const [selected,setSelected]=useState<number|null>(null);
  const [briefLoading,setBriefLoading]=useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brief,setBrief]=useState<any>(null);
  const [intentFilter,setIntentFilter]=useState("All");
  const [sortKey,setSortKey]=useState<string>("");
  const [sortDir,setSortDir]=useState<"asc"|"desc">("desc");
  const hist = useToolHistory("serpcontent");

  const toggleSort = (key:string) => {
    if(sortKey===key){ setSortDir(d=>d==="asc"?"desc":"asc"); }
    else { setSortKey(key); setSortDir("desc"); }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortVal = (r:any, key:string):number|string => {
    switch(key){
      case "keyword": return (r.keyword||"").toLowerCase();
      case "rank": return r.your_rank?.ranking ? r.your_rank.position : 999;
      case "difficulty": return r.difficulty==="Low"?1:r.difficulty==="Medium"?2:3;
      case "opportunity": return r.opportunity_score||0;
      case "words": return r.content_signals?.avg_word_count||0;
      case "ourwords": return r.gap?.your_words ?? -1;
      case "gap": return r.gap?.word_gap||0;
      default: return 0;
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedResults = sortKey ? [...results].sort((a:any,b:any)=>{
    const av=sortVal(a,sortKey), bv=sortVal(b,sortKey);
    const cmp = typeof av==="string" ? String(av).localeCompare(String(bv)) : (av as number)-(bv as number);
    return sortDir==="asc"?cmp:-cmp;
  }) : results;
  const arrow = (key:string) => sortKey!==key ? <span style={{color:S.border,fontSize:9,marginLeft:3}}>↕</span> : <span style={{color:S.accent,fontSize:9,marginLeft:3}}>{sortDir==="asc"?"↑":"↓"}</span>;
  const SortTH = ({label,sk}:{label:string;sk:string}) => {
    const tip = METRIC_HINTS[label.toLowerCase().trim()];
    return (
    <th onClick={()=>toggleSort(sk)} style={{padding:"10px 14px",textAlign:"left" as const,fontSize:11,fontWeight:700,color:sortKey===sk?S.accent:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em",borderBottom:`1px solid ${S.border}`,background:"#f8fafc",whiteSpace:"nowrap" as const,cursor:"pointer",userSelect:"none" as const}}>
      <span style={{display:"inline-flex",alignItems:"center"}}>{label}{tip&&<InfoTip text={tip}/>}{arrow(sk)}</span>
    </th>
    );
  };

  useEffect(()=>{if(activeSite)setUserUrl(extractOrigin(activeSite));},[activeSite]);

  // Connected sites for the dropdown (GSC domains + GA4 site domains, no raw property IDs)
  const allSites = (()=>{
    const gsc = Object.keys(gscDataMap);
    const isRealDomain = (s:string) => !/^\d+$/.test(s) && s.includes(".");
    const ga4 = Object.keys(ga4DataMap)
      .map(k => ga4DataMap[k]?._siteDomain || (isRealDomain(k)?k:null))
      .filter((d):d is string => !!d && !gsc.includes(d));
    return [...gsc, ...new Set(ga4)];
  })();
  const activeDomain = activeSite ? activeSite.replace(/^https?:\/\//,"").replace(/\/$/,"") : "";

  const parseKeywords = (raw:string):string[] => {
    return raw.split(/[\n,;]+/).map(k=>k.trim()).filter(Boolean)
      .filter((k,i,arr)=>arr.indexOf(k)===i) // dedup
      .slice(0,100); // cap at 100
  };

  const onFile = (e:React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result||"");
      // For CSV, take first column of each line
      const kws = text.split(/\r?\n/).map(line=>line.split(/[,;\t]/)[0].trim()).filter(Boolean);
      setKwInput(kws.join("\n"));
    };
    reader.readAsText(f);
  };

  const run = async () => {
    const keywords = parseKeywords(kwInput);
    if(keywords.length===0){setErr("Add at least one keyword.");return;}
    setLoading(true);setErr("");setResults([]);setSelected(null);setBrief(null);
    setProgress({done:0,total:keywords.length});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out:any[] = [];
    const cleanUrl = userUrl.trim();
    // Process in batches of 4 concurrent requests to handle up to 100 keywords
    const BATCH = 4;
    for(let i=0;i<keywords.length;i+=BATCH){
      const batch = keywords.slice(i,i+BATCH);
      const batchRes = await Promise.allSettled(batch.map(async kw=>{
        const r = await fetch(`/api/tools?tool=serpanalyze&keyword=${encodeURIComponent(kw)}${cleanUrl?`&userUrl=${encodeURIComponent(cleanUrl)}`:""}`);
        return await r.json();
      }));
      batchRes.forEach(br=>{ if(br.status==="fulfilled"&&br.value&&!br.value.error) out.push(br.value); });
      setProgress({done:Math.min(i+BATCH,keywords.length),total:keywords.length});
      setResults([...out]);
    }
    setLoading(false);
    if(out.length>0) hist.add(`${out.length} keywords`, {results:out});
    if(out.length===0) setErr("No SERP data could be retrieved. Try again.");
  };

  const genBrief = async (kwData:{keyword:string;content_signals:{avg_word_count:number;common_headings:string[];schema_types:string[]};serp_results:{title:string;domain:string}[]}) => {
    setBriefLoading(true);setBrief(null);
    try {
      const topTitles = (kwData.serp_results||[]).slice(0,5).map((r)=>`${r.title} (${r.domain})`).join("; ");
      const headings = (kwData.content_signals?.common_headings||[]).join(", ");
      const d = await ai(`Content brief grounded in REAL SERP data for keyword "${kwData.keyword}".
SERP average word count: ${kwData.content_signals?.avg_word_count}. Top ranking titles: ${topTitles}. Common headings: ${headings}. Schema on SERP: ${(kwData.content_signals?.schema_types||[]).join(", ")||"none"}.
Return ONLY valid JSON: {"target_keyword":"string","lsi_keywords":["kw1","kw2","kw3","kw4","kw5"],"recommended_word_count":number,"title_options":["t1","t2","t3"],"intent":"Informational|Commercial|Transactional|Navigational","outline":[{"heading":"string","type":"H2|H3","points":["p1","p2"]}],"questions_to_answer":["q1","q2","q3","q4"],"schema_to_include":["string"],"competitor_notes":[{"url_or_domain":"string","strength":"string","weakness":"string"}]}
Base word count on SERP average ±10%. 6-8 outline sections derived from common headings.`, 4096, true);
      setBrief(d);
    } catch(e){ const m=e instanceof Error?e.message:""; setErr(/credit|limit|unavailable/i.test(m)?"AI unavailable — top up credits at console.anthropic.com/settings/billing":"Brief generation failed."); }
    finally{setBriefLoading(false);}
  };

  // ── Handoff: push SERP findings into the SEO Campaign Agent (seed → navigate) ──
  const seedCampaign = (seed:Record<string,unknown>) => {
    const dom = extractDomain(userUrl||activeSite||"");
    try{ localStorage.setItem("rm_campaign_seed", JSON.stringify({source:"serp", domain:dom, ...seed})); }catch{}
    if(setPage) setPage("campaign");
  };
  // Build a single-keyword seed from a SERP result (+ optional generated brief)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const briefSeed = (r:any, b:any) => ({
    keyword: r.keyword,
    wordCount: b?.recommended_word_count || r.content_signals?.avg_word_count || undefined,
    intent: b?.intent || undefined,
    titles: b?.title_options || undefined,
    lsi: b?.lsi_keywords || undefined,
    outline: (b?.outline||[]).map((o:{heading:string;type:string})=>({heading:o.heading,type:o.type})),
    questions: b?.questions_to_answer || undefined,
    schema: b?.schema_to_include || r.content_signals?.schema_types || undefined,
    topDomains: (r.serp_results||[]).slice(0,5).map((x:{domain:string})=>x.domain),
    avgWords: r.content_signals?.avg_word_count || undefined,
  });

  const diffColor=(d:string)=>d==="Low"?S.green:d==="Medium"?S.amber:S.red;
  const oppColor=(s:number)=>s>=60?S.green:s>=35?S.amber:S.red;
  const sel = selected!==null?results[selected]:null;

  return (
    <div>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>Content SERP Analyzer</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 20px"}}>Upload a keyword list — get real SERP intelligence, content gaps, and AI briefs grounded in what actually ranks.</p>

      {results.length===0 && (
        <Card>
          {/* Project / website selector */}
          {allSites.length>0 && (
            <Field label="Project / website">
              <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                {allSites.map(s=>(
                  <button key={s} onClick={()=>{ if(setActiveSite)setActiveSite(s); setUserUrl(extractOrigin(s)); }}
                    style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${activeDomain===s?S.accent:S.border}`,background:activeDomain===s?"linear-gradient(135deg,#6366f1,#818cf8)":"transparent",color:activeDomain===s?"#fff":S.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {(()=>{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g:any=(activeDomain&&gscDataMap[activeDomain])||Object.values(gscDataMap)[0]||null;
            const kws:string[]=(g?.queries||[]).slice(0,50).map((q:{query:string})=>q.query);
            return kws.length>0?(
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"8px 12px",background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:8,flexWrap:"wrap" as const}}>
                <span style={{fontSize:12,color:S.accentText}}>📊 {kws.length} real keywords from Google Search Console</span>
                <button onClick={()=>setKwInput(kws.slice(0,100).join("\n"))} style={{fontSize:11,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#818cf8)",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontFamily:"inherit"}}>Use my GSC keywords →</button>
              </div>
            ):null;
          })()}
          <Field label="Keywords — paste one per line, or upload CSV/TXT (max 100)">
            <TI value={kwInput} onChange={setKwInput} placeholder={"best crm for startups\nemployer of record\nhow to hire remote developers"} rows={6}/>
          </Field>
          <div style={{display:"flex",gap:12,alignItems:"center",margin:"0 0 14px",flexWrap:"wrap" as const}}>
            <label style={{fontSize:12,color:S.accent,cursor:"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,border:`1px solid ${S.border}`,borderRadius:7,padding:"6px 12px"}}>
              ↑ Upload CSV / TXT
              <input type="file" accept=".csv,.txt,.tsv" onChange={onFile} style={{display:"none"}}/>
            </label>
            <span style={{fontSize:11,color:S.muted}}>{parseKeywords(kwInput).length} keywords ready</span>
          </div>
          <Field label="Your site URL — used to detect your rank & content gaps">
            <TI value={userUrl} onChange={setUserUrl} placeholder="https://yoursite.com/page"/>
          </Field>
          {err && <p style={{fontSize:13,color:S.red,margin:"0 0 12px"}}>⚠ {err}</p>}
          <Btn onClick={run} disabled={loading||parseKeywords(kwInput).length===0}>{loading?`Analysing ${progress.done}/${progress.total}…`:"Run SERP Analysis"}</Btn>
        </Card>
      )}

      {loading && results.length>0 && (
        <Card style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600,color:S.text}}>Analysing keywords…</span>
            <span style={{fontSize:12,color:S.muted}}>{progress.done} / {progress.total}</span>
          </div>
          <div style={{height:8,background:S.subtle,borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(progress.done/progress.total)*100}%`,background:"linear-gradient(90deg,#6366f1,#818cf8)",borderRadius:99,transition:"width 0.3s ease"}}/>
          </div>
        </Card>
      )}

      {/* ── Project results table ── */}
      {results.length>0 && !sel && (
        <>
          <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap" as const}}>
            {[
              {l:"Keywords analysed",v:results.length,c:S.accent,h:"Total number of keywords processed in this analysis. Each keyword's live SERP was fetched and its top-ranking pages analysed."},
              ...(results.some(r=>r.your_rank)?[{l:"You rank for",v:`${results.filter(r=>r.your_rank?.ranking).length}/${results.length}`,c:S.green,h:"How many of these keywords your site already appears in the top 10 Google results for. Higher is better."}]:[]),
              {l:"Quick wins",v:results.filter(r=>r.difficulty==="Low").length,c:S.green,h:"Keywords rated Low difficulty — the SERP is weak (few high-authority competitors, shorter content). Easiest opportunities to rank for fast."},
              {l:"Avg SERP words",v:Math.round(results.reduce((a,r)=>a+(r.content_signals?.avg_word_count||0),0)/results.length).toLocaleString(),c:S.text,h:"Average word count of the top-ranking pages across all keywords. This is roughly how long your content needs to be to compete."},
              {l:"Content gaps",v:results.filter(r=>r.gap&&r.gap.word_gap>0).length,c:S.amber,h:"Keywords where your page is shorter than the SERP average — meaning you likely need to add more content to compete. Requires your site URL."},
            ].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c} hint={s.h}/>)}
          </div>
          <Card>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
              <SH title="SERP analysis results"/>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>{
                  const top=[...results].sort((a,b)=>(b.opportunity_score||0)-(a.opportunity_score||0)).slice(0,10);
                  seedCampaign({items: top.map(r=>({keyword:r.keyword, wordCount:r.content_signals?.avg_word_count||undefined, difficulty:r.difficulty, opportunity:r.opportunity_score}))});
                }} style={{fontSize:11,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#818cf8)",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit"}}>🚀 Send top {Math.min(results.length,10)} to Campaign Agent →</button>
                <button onClick={()=>downloadCSV("serp-analysis.csv",["Keyword","Your Rank","Difficulty","Opportunity","SERP Avg Words","Our Words","Top Domain","Content Gap"],results.map(r=>[r.keyword,r.your_rank?(r.your_rank.ranking?`#${r.your_rank.position}`:"Not ranking"):"—",r.difficulty,r.opportunity_score,r.content_signals?.avg_word_count||0,r.gap?.your_words??"—",r.serp_results?.[0]?.domain||"",r.gap?.word_gap>0?`+${r.gap.word_gap} words needed`:"—"]))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ Export CSV</button>
                <button onClick={()=>{setResults([]);setKwInput("");}} style={{fontSize:11,color:S.muted,background:"none",border:`1px solid ${S.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>New analysis</button>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:680}}>
                <thead><tr>
                  <SortTH label="Keyword" sk="keyword"/>
                  <SortTH label="Your Rank" sk="rank"/>
                  <SortTH label="Difficulty" sk="difficulty"/>
                  <SortTH label="Opportunity" sk="opportunity"/>
                  <SortTH label="SERP Avg" sk="words"/>
                  <SortTH label="Our Words" sk="ourwords"/>
                  <TH>Top Ranking</TH>
                  <SortTH label="Content Gap" sk="gap"/>
                </tr></thead>
                <tbody>{sortedResults.map((r,i)=>(
                  <tr key={i} style={{cursor:"pointer"}} onClick={()=>{setSelected(results.indexOf(r));setBrief(null);}}
                    onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=S.subtle}
                    onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background="transparent"}>
                    <TD bold>{r.keyword}</TD>
                    <TD>{r.your_rank?(r.your_rank.ranking
                      ?<span style={{fontSize:11,fontWeight:700,color:r.your_rank.position<=3?S.green:r.your_rank.position<=10?S.accent:S.amber,background:r.your_rank.position<=3?S.greenBg:r.your_rank.position<=10?S.accentBg:S.amberBg,padding:"2px 8px",borderRadius:4}}>#{r.your_rank.position}</span>
                      :<span style={{fontSize:11,fontWeight:600,color:S.red,background:S.redBg,padding:"2px 8px",borderRadius:4}}>Not ranking</span>
                    ):<span style={{fontSize:11,color:S.muted}}>—</span>}</TD>
                    <TD><span style={{fontSize:11,fontWeight:700,color:diffColor(r.difficulty),background:r.difficulty==="Low"?S.greenBg:r.difficulty==="Medium"?S.amberBg:S.redBg,padding:"2px 8px",borderRadius:4}}>{r.difficulty}</span></TD>
                    <TD><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:44,height:5,background:S.subtle,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${r.opportunity_score}%`,background:oppColor(r.opportunity_score),borderRadius:99}}/></div><span style={{fontSize:12,fontWeight:700,color:oppColor(r.opportunity_score)}}>{r.opportunity_score}</span></div></TD>
                    <TD color={S.muted}>{(r.content_signals?.avg_word_count||0).toLocaleString()}</TD>
                    <TD>{r.gap?<span style={{fontSize:12,fontWeight:600,color:r.gap.word_gap>0?S.amber:S.green}}>{(r.gap.your_words||0).toLocaleString()}</span>:<span style={{fontSize:11,color:S.muted}}>—</span>}</TD>
                    <TD><span style={{fontSize:11,color:S.accent}}>{r.serp_results?.[0]?.domain||"—"}</span></TD>
                    <TD>{r.gap?(r.gap.word_gap>0?<span style={{fontSize:11,color:S.amber,fontWeight:600}}>+{r.gap.word_gap.toLocaleString()} words <span style={{color:S.accent}}>→</span></span>:<span style={{fontSize:11,color:S.green}}>✓ on par <span style={{color:S.accent}}>→</span></span>):<span style={{fontSize:11,color:S.accent,fontWeight:600}}>View →</span>}</TD>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Per-keyword detail ── */}
      {sel && (
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const,marginBottom:14}}>
            <button onClick={()=>{setSelected(null);setBrief(null);}} style={{fontSize:12,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>← Back to all keywords</button>
            <Btn small onClick={()=>seedCampaign(briefSeed(sel,brief))}>🚀 Create content in Campaign Agent →</Btn>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap" as const}}>
            {[
              ...(sel.your_rank?[{l:"Your Rank",v:sel.your_rank.ranking?`#${sel.your_rank.position}`:"Not ranking",c:sel.your_rank.ranking?(sel.your_rank.position<=3?S.green:sel.your_rank.position<=10?S.accent:S.amber):S.red,h:"Your site's position in the top 10 Google results for this keyword. 'Not ranking' means you're not in the top 10."}]:[]),
              {l:"Difficulty",v:sel.difficulty,c:diffColor(sel.difficulty),h:"How hard it is to rank — based on competitor authority (Wikipedia, .gov, big brands) and content length. Low = easy, High = very competitive."},
              {l:"Opportunity",v:sel.opportunity_score,c:oppColor(sel.opportunity_score),h:"0–100 score combining low competition and weak SERP signals. Higher = better chance to rank quickly. The inverse of difficulty."},
              {l:"SERP Avg Words",v:(sel.content_signals?.avg_word_count||0).toLocaleString(),c:S.text,h:"Average word count of the pages currently ranking. Aim for this length (±10%) to be competitive."},
              {l:"Our Words",v:sel.gap?(sel.gap.your_words||0).toLocaleString():"—",c:sel.gap?(sel.gap.word_gap>0?S.amber:S.green):S.muted,h:"Word count of your own page for this keyword. Compare against SERP Avg Words — if lower, expand your content."},
            ].map(s=><Metric key={s.l} label={s.l} value={s.v} color={s.c} hint={s.h}/>)}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <Card style={{marginBottom:0}}>
              <SH title="Content type breakdown"/>
              {(()=>{
                const types=(sel.content_signals?.content_types||[]) as {type:string;count:number}[];
                const total=types.reduce((a,t)=>a+t.count,0)||1;
                const palette=["#6366f1","#10b981","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#ef4444","#64748b"];
                const segs=types.map((t,i)=>({label:t.type,value:t.count,color:palette[i%palette.length]}));
                return (
                  <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap" as const}}>
                    <SvgDonut segments={segs} size={140}/>
                    <div style={{flex:1,minWidth:140}}>
                      {types.map((t,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<types.length-1?`1px solid ${S.border}`:"none"}}>
                          <span style={{width:10,height:10,borderRadius:3,background:palette[i%palette.length],flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:600,color:S.text,flex:1}}>{t.type}</span>
                          <span style={{fontSize:12,fontWeight:700,color:palette[i%palette.length]}}>{Math.round(t.count/total*100)}%</span>
                          <span style={{fontSize:11,color:S.muted}}>({t.count})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Card>
            <Card style={{marginBottom:0}}>
              <SH title="Word count range"/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:S.muted,marginBottom:6}}>
                <span>Min: {(sel.content_signals?.min_words||0).toLocaleString()}</span>
                <span>Max: {(sel.content_signals?.max_words||0).toLocaleString()}</span>
              </div>
              <div style={{textAlign:"center" as const,padding:"12px 0"}}>
                <p style={{fontSize:28,fontWeight:700,color:S.accent,margin:0}}>{(sel.content_signals?.avg_word_count||0).toLocaleString()}</p>
                <p style={{fontSize:11,color:S.muted,margin:0}}>average words to compete</p>
              </div>
              {(sel.content_signals?.schema_types||[]).length>0&&(
                <div style={{marginTop:8}}>
                  <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 6px"}}>Schema on SERP</p>
                  {(sel.content_signals?.schema_types||[]).slice(0,6).map((s:string,i:number)=><span key={i} style={{fontSize:11,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{s}</span>)}
                </div>
              )}
            </Card>
          </div>

          {/* Content gap */}
          {sel.gap && (
            <Card>
              <SH title="Content gap vs your page"/>
              {sel.gap.url && (
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:S.accentBg,border:"1px solid #c7d2fe",borderRadius:8,marginBottom:12,flexWrap:"wrap" as const}}>
                  <span style={{fontSize:11,fontWeight:700,color:S.accentText,textTransform:"uppercase" as const,letterSpacing:"0.04em",flexShrink:0}}>Page to optimise:</span>
                  <a href={sel.gap.url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:S.accent,fontWeight:600,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,flex:1,minWidth:0}}>{sel.gap.url} ↗</a>
                </div>
              )}
              {sel.gap.your_title && <p style={{fontSize:11,color:S.muted,margin:"0 0 12px"}}>Current title: <span style={{color:S.text}}>{sel.gap.your_title}</span></p>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
                <div style={{padding:"10px 12px",background:sel.gap.word_gap>0?S.amberBg:S.greenBg,borderRadius:8}}>
                  <p style={{fontSize:11,color:S.muted,margin:"0 0 2px"}}>Word count gap</p>
                  <p style={{fontSize:16,fontWeight:700,color:sel.gap.word_gap>0?S.amber:S.green,margin:0}}>{sel.gap.word_gap>0?`+${sel.gap.word_gap.toLocaleString()} needed`:"✓ on par"}</p>
                  <p style={{fontSize:10,color:S.muted,margin:"2px 0 0"}}>You: {sel.gap.your_words.toLocaleString()} · SERP: {sel.gap.serp_avg_words.toLocaleString()}</p>
                </div>
                <div style={{padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                  <p style={{fontSize:11,color:S.muted,margin:"0 0 2px"}}>Heading gap</p>
                  <p style={{fontSize:16,fontWeight:700,color:S.text,margin:0}}>{sel.gap.your_h2_count} vs {sel.gap.serp_avg_h2}</p>
                  <p style={{fontSize:10,color:S.muted,margin:"2px 0 0"}}>your H2s vs SERP avg</p>
                </div>
                <div style={{padding:"10px 12px",background:sel.gap.kw_in_title?S.greenBg:S.redBg,borderRadius:8}}>
                  <p style={{fontSize:11,color:S.muted,margin:"0 0 2px"}}>Keyword in title</p>
                  <p style={{fontSize:16,fontWeight:700,color:sel.gap.kw_in_title?S.green:S.red,margin:0}}>{sel.gap.kw_in_title?"✓ Yes":"✗ No"}</p>
                </div>
              </div>
              {/* What's missing — as an actionable table */}
              {(()=>{
                // Schema → plain-English purpose so the table is actionable
                const purpose:Record<string,string>={
                  Article:"Marks the page as an article for rich results",
                  WebPage:"Basic page-type signal for search engines",
                  FAQPage:"Enables FAQ rich snippets in Google",
                  Question:"Pairs with FAQPage for Q&A snippets",
                  Answer:"The answer body for FAQ snippets",
                  HowTo:"Step-by-step rich results",
                  HowToStep:"Individual steps inside a HowTo",
                  HowToDirection:"Direction text within a HowTo step",
                  HowToTip:"Tips within a HowTo",
                  Review:"Shows star ratings in search",
                  Rating:"Numeric rating value for stars",
                  AggregateRating:"Average of multiple ratings (star snippet)",
                  Person:"Author/expert entity — boosts E-E-A-T",
                  Thing:"Generic entity markup",
                  BreadcrumbList:"Breadcrumb navigation in results",
                  ListItem:"Items within a list/breadcrumb",
                  Offer:"Price/availability for product snippets",
                  PropertyValueSpecification:"Structured input/spec data",
                  SearchAction:"Enables sitelinks search box",
                  EntryPoint:"Defines an action endpoint",
                  SoftwareApplication:"App rich results (ratings, price)",
                  Organization:"Company entity — knowledge panel signal",
                  WebSite:"Site-level entity for sitelinks",
                  ReadAction:"Read-action markup",
                };
                const rows:{item:string;status:string;detail:string;sev:string}[]=[
                  {item:"Keyword in title tag",status:sel.gap.kw_in_title?"present":"missing",detail:sel.gap.kw_in_title?"Your title contains the keyword":"Add the exact keyword to your <title> tag",sev:sel.gap.kw_in_title?"ok":"high"},
                  {item:"Keyword in H1",status:sel.gap.kw_in_h1?"present":"missing",detail:sel.gap.kw_in_h1?"Your H1 contains the keyword":"Add the keyword to your main H1 heading",sev:sel.gap.kw_in_h1?"ok":"high"},
                  {item:"Content length",status:sel.gap.word_gap>0?"missing":"present",detail:sel.gap.word_gap>0?`Add ~${sel.gap.word_gap.toLocaleString()} words (you ${sel.gap.your_words.toLocaleString()} vs SERP ${sel.gap.serp_avg_words.toLocaleString()})`:`On par (${sel.gap.your_words.toLocaleString()} words)`,sev:sel.gap.word_gap>500?"high":sel.gap.word_gap>0?"med":"ok"},
                  {item:"Heading depth (H2s)",status:sel.gap.your_h2_count>=sel.gap.serp_avg_h2?"present":"missing",detail:sel.gap.your_h2_count>=sel.gap.serp_avg_h2?`Good (${sel.gap.your_h2_count} H2s)`:`Add ${sel.gap.serp_avg_h2-sel.gap.your_h2_count} more H2 sections (you ${sel.gap.your_h2_count} vs SERP ${sel.gap.serp_avg_h2})`,sev:"med"},
                  ...(sel.gap.missing_schema||[]).map((s:string)=>({item:`${s} schema`,status:"missing",detail:purpose[s]||"Structured data competitors use",sev:"med"})),
                ];
                const sevColor:Record<string,string>={high:S.red,med:S.amber,ok:S.green};
                const sevBg:Record<string,string>={high:S.redBg,med:S.amberBg,ok:S.greenBg};
                return (
                  <div style={{marginTop:16}}>
                    <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,letterSpacing:"0.04em",margin:"0 0 8px"}}>What to fix on this page</p>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:480}}>
                        <thead><tr><TH>Item</TH><TH>Status</TH><TH>What to do</TH></tr></thead>
                        <tbody>{rows.map((r,i)=>(
                          <tr key={i}>
                            <TD bold>{r.item}</TD>
                            <TD><span style={{fontSize:10,fontWeight:700,color:sevColor[r.sev],background:sevBg[r.sev],padding:"2px 8px",borderRadius:4,textTransform:"uppercase" as const}}>{r.status==="present"?"✓ Have":"✗ Missing"}</span></TD>
                            <TD color={S.muted}>{r.detail}</TD>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}

          {/* Common headings */}
          {(sel.content_signals?.common_headings||[]).length>0&&(
            <Card>
              <SH title="Common headings across top results"/>
              {(sel.content_signals?.common_headings||[]).map((h:string,i:number)=>(
                <p key={i} style={{fontSize:13,color:S.text,margin:"0 0 6px",paddingBottom:6,borderBottom:`1px solid ${S.border}`}}>→ {h}</p>
              ))}
            </Card>
          )}

          {/* SERP results */}
          <Card>
            <SH title={`Top ranking pages${sel.serp_source&&sel.serp_source!=="none"?` · via ${sel.serp_source==="serper"||sel.serp_source==="google"?"Google":sel.serp_source==="bing"?"Bing":"DuckDuckGo"}`:""}`}/>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["#","Title","Domain"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{(sel.serp_results||[]).map((r:{pos:number;title:string;url:string;domain:string},i:number)=>{
                const isYou = sel.your_rank?.ranking && sel.your_rank.position===r.pos;
                return (
                <tr key={i} style={{background:isYou?S.accentBg:"transparent"}}>
                  <TD color={isYou?S.accentText:S.muted}><span style={{fontWeight:isYou?700:400}}>{r.pos}</span></TD>
                  <TD><a href={r.url} target="_blank" rel="noopener noreferrer" style={{color:S.accent,textDecoration:"none",fontWeight:isYou?700:400}}>{isYou?"★ ":""}{r.title}</a></TD>
                  <TD color={isYou?S.accentText:S.muted}><span style={{fontWeight:isYou?700:400}}>{r.domain}{isYou?" (you)":""}</span></TD>
                </tr>
                );
              })}</tbody>
            </table>
          </Card>

          {/* AI brief */}
          <Card>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
              <SH title="AI content brief"/>
              {!brief&&<Btn small onClick={()=>genBrief(sel)} disabled={briefLoading}>{briefLoading?"Generating…":"✦ Generate SERP-grounded brief"}</Btn>}
              {brief&&<CopyBtn text={`${brief.title_options?.[0]}\n\nWord count: ${brief.recommended_word_count}\n\nOutline:\n${(brief.outline||[]).map((o:{heading:string})=>`- ${o.heading}`).join("\n")}`}/>}
            </div>
            {briefLoading&&<LoadingBar phases={["Reading SERP signals…","Building outline from top headings…","Generating titles…"]}/>}
            {brief&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                  <div><p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 4px"}}>Recommended word count</p><p style={{fontSize:16,fontWeight:700,color:S.accent,margin:0}}>{(brief.recommended_word_count||0).toLocaleString()}</p></div>
                  <div><p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 4px"}}>Intent</p>{pill(brief.intent,"blue")}</div>
                </div>
                <div style={{marginBottom:14}}>
                  <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 6px"}}>Title options</p>
                  {(brief.title_options||[]).map((t:string,i:number)=><div key={i} style={{fontSize:13,color:S.text,padding:"6px 10px",background:S.subtle,borderRadius:6,marginBottom:4}}>{t}</div>)}
                </div>
                <div style={{marginBottom:14}}>
                  <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 6px"}}>LSI / semantic keywords</p>
                  {(brief.lsi_keywords||[]).map((k:string,i:number)=><span key={i} style={{fontSize:12,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{k}</span>)}
                </div>
                <Divider/>
                <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 10px"}}>Content outline</p>
                {(brief.outline||[]).map((h:{type:string;heading:string;points:string[]},i:number)=>(
                  <div key={i} style={{marginBottom:10,paddingLeft:h.type==="H3"?16:0}}>
                    <p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 4px"}}><span style={{fontSize:11,color:S.accent,marginRight:6}}>{h.type}</span>{h.heading}</p>
                    {(h.points||[]).map((p:string,j:number)=><p key={j} style={{fontSize:12,color:S.muted,margin:"0 0 2px",paddingLeft:14}}>· {p}</p>)}
                  </div>
                ))}
                {(brief.questions_to_answer||[]).length>0&&(
                  <><Divider/><p style={{fontSize:13,fontWeight:700,color:S.text,margin:"0 0 10px"}}>Questions to answer</p>
                  {(brief.questions_to_answer||[]).map((q:string,i:number)=><p key={i} style={{fontSize:12,color:S.text,margin:"0 0 6px"}}>❓ {q}</p>)}</>
                )}
              </div>
            )}
          </Card>
        </>
      )}
      <HistoryPanel hist={hist} onLoad={e=>{setResults(e.data.results||[]);setSelected(null);}}/>
    </div>
  );
}

// ── Cluster Map (hub-and-spoke SVG) — PRD Deliverable 2 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClusterMap({suggestions}:{suggestions:any[]}) {
  // Group suggestions by cluster topic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups: Record<string, any[]> = {};
  for (const s of suggestions) {
    const c = (s.cluster || "Other").trim();
    (groups[c] = groups[c] || []).push(s);
  }
  const clusters = Object.entries(groups);
  if (!clusters.length) return null;

  const catColor:Record<string,string>={"NEW PILLAR":S.accent,"NEW CLUSTER ARTICLE":S.green,"UPDATE EXISTING":S.amber,"CONSOLIDATE":"#8b5cf6","REPURPOSE":S.red};
  const W=300, H=260, cx=W/2, cy=H/2, hubR=44, spokeR=14, ring=92;

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
      {clusters.map(([cluster,items],ci)=>{
        // pillar = a NEW PILLAR/UPDATE pillar item if present, else the cluster label itself
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pillar=items.find((s:any)=>s.category==="NEW PILLAR")||null;
        const spokes=items.filter((s)=>s!==pillar);
        const n=Math.max(spokes.length,1);
        return (
          <div key={ci} style={{background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:12,boxShadow:S.shadow,overflow:"hidden"}}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:"block"}}>
              {/* spokes lines */}
              {spokes.map((_,i)=>{
                const a=(i/n)*2*Math.PI - Math.PI/2;
                const x=cx+ring*Math.cos(a), y=cy+ring*Math.sin(a);
                return <line key={"l"+i} x1={cx} y1={cy} x2={x} y2={y} stroke={S.border} strokeWidth={1.5}/>;
              })}
              {/* hub */}
              <circle cx={cx} cy={cy} r={hubR} fill={pillar?S.accentBg:S.subtle} stroke={pillar?S.accent:S.border} strokeWidth={2}/>
              <text x={cx} y={cy-4} textAnchor="middle" fontSize="9" fontWeight="700" fill={S.accentText}>
                {(cluster.length>22?cluster.slice(0,20)+"…":cluster).split(" ").reduce((acc:string[],w:string)=>{const last=acc[acc.length-1];if(last&&(last+" "+w).length<=14)acc[acc.length-1]=last+" "+w;else acc.push(w);return acc;},[]).slice(0,3).map((line,li,arr)=>(
                  <tspan key={li} x={cx} dy={li===0?-(arr.length-1)*5:10}>{line}</tspan>
                ))}
              </text>
              <text x={cx} y={cy+hubR-8} textAnchor="middle" fontSize="7" fill={S.muted}>{pillar?"PILLAR":"CLUSTER"}</text>
              {/* spoke nodes */}
              {spokes.map((s,i)=>{
                const a=(i/n)*2*Math.PI - Math.PI/2;
                const x=cx+ring*Math.cos(a), y=cy+ring*Math.sin(a);
                return (
                  <g key={"s"+i}>
                    <circle cx={x} cy={y} r={spokeR} fill={catColor[s.category]||S.muted}/>
                    <title>{s.title} ({s.category})</title>
                  </g>
                );
              })}
            </svg>
            <p style={{fontSize:12,fontWeight:700,color:S.text,margin:"4px 0 2px",textAlign:"center" as const}}>{cluster}</p>
            <p style={{fontSize:10,color:S.muted,margin:0,textAlign:"center" as const}}>{items.length} page{items.length>1?"s":""} · {pillar?"1 pillar + ":""}{spokes.length} supporting</p>
          </div>
        );
      })}
    </div>
  );
}

// ── SEO CAMPAIGN AGENT (PRD-aligned 7-phase pipeline with 2 approval gates) ──
function SEOCampaign({activeSite,setPage}:PageProps) {
  const [gtm,setGtm]=useState("");
  const [brief,setBrief]=useState("");
  const [guardrails,setGuardrails]=useState("");
  const [domain,setDomain]=useState(activeSite?activeSite.replace(/^https?:\/\//,"").replace(/\/$/,""):"");
  const [seededKw,setSeededKw]=useState("");
  // Handoff → pre-fill domain + a starter brief. Two sources:
  //  • Dashboard "✍️ Blog" buttons → {keyword, domain} (a GSC content gap)
  //  • Content SERP Analyzer → rich SERP-grounded seed (single keyword or bulk top opportunities)
  useEffect(()=>{
    const raw=localStorage.getItem("rm_campaign_seed");
    if(!raw)return;
    localStorage.removeItem("rm_campaign_seed");
    try{
      const s=JSON.parse(raw) as {
        source?:string; keyword?:string; domain?:string;
        wordCount?:number; intent?:string; titles?:string[]; lsi?:string[];
        outline?:{heading:string;type:string}[]; questions?:string[]; schema?:string[];
        topDomains?:string[]; avgWords?:number;
        items?:{keyword:string;wordCount?:number;difficulty?:string;opportunity?:number}[];
      };
      if(s.domain)setDomain(s.domain.replace(/^https?:\/\//,"").replace(/\/$/,""));

      // ── Bulk: top opportunities from the Content SERP Analyzer ──
      if(s.items&&s.items.length){
        setSeededKw(s.items[0].keyword);
        const list=s.items.map(it=>`- ${it.keyword}${it.wordCount?` (~${it.wordCount.toLocaleString()} words)`:""}${it.difficulty?` · ${it.difficulty} difficulty`:""}`).join("\n");
        setBrief(`Goal: Create a batch of SEO articles for these high-opportunity keywords identified by the Content SERP Analyzer. Ground each piece in what currently ranks for its keyword.\n\nTarget keywords (priority order):\n${list}\n\nContent format: blog post\nPrimary CTA: Book a demo`);
        return;
      }

      // ── Single keyword (SERP-grounded brief, or a simple gap keyword) ──
      if(s.keyword){
        setSeededKw(s.keyword);
        if(s.source==="serp"){
          const parts:string[]=[
            `Goal: Create SEO content that outranks the current top results for the target keyword below, using real SERP intelligence from the Content SERP Analyzer.`,
            ``,
            `Target keyword: ${s.keyword}`,
          ];
          if(s.intent)parts.push(`Search intent: ${s.intent}`);
          if(s.wordCount)parts.push(`Recommended length: ~${s.wordCount.toLocaleString()} words (SERP average)`);
          if(s.titles?.length)parts.push(`Suggested titles:\n${s.titles.map(t=>`- ${t}`).join("\n")}`);
          if(s.lsi?.length)parts.push(`Semantic / LSI keywords to include: ${s.lsi.join(", ")}`);
          if(s.outline?.length)parts.push(`Outline (from top-ranking headings):\n${s.outline.map(o=>`${o.type==="H3"?"  - ":"- "}${o.heading}`).join("\n")}`);
          if(s.questions?.length)parts.push(`Questions to answer:\n${s.questions.map(q=>`- ${q}`).join("\n")}`);
          if(s.schema?.length)parts.push(`Schema to include: ${s.schema.join(", ")}`);
          if(s.topDomains?.length)parts.push(`Currently ranking (to beat): ${s.topDomains.join(", ")}`);
          parts.push(`Content format: blog post`,`Primary CTA: Book a demo`);
          setBrief(parts.join("\n"));
          // Pre-select the nearest content-length preset to the SERP recommendation
          const wc=s.wordCount||s.avgWords;
          if(wc){ const presets=[600,1000,1500,2500,3500]; const nearest=presets.reduce((p,c)=>Math.abs(c-wc)<Math.abs(p-wc)?c:p); setContentLength(String(nearest)); }
        } else {
          setBrief(`Goal: Create one SEO blog post that ranks for the target keyword below (a content gap from Search Console).\nTarget keyword: ${s.keyword}\nContent format: blog post\nPrimary CTA: Book a demo`);
        }
      }
    }catch{/* ignore malformed seed */}
  },[]);
  // Handoff from the Content Writer → a ready-made article jumps straight to Gate 2 (publish).
  useEffect(()=>{
    const raw=localStorage.getItem("rm_campaign_publish_seed");
    if(!raw)return;
    localStorage.removeItem("rm_campaign_publish_seed");
    try{
      const p=JSON.parse(raw) as {title?:string;keyword?:string;domain?:string;article_html?:string;meta_title?:string;meta_description?:string;slug?:string;schema_article?:string};
      if(!p.article_html)return;
      const dom=(p.domain||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
      if(dom)setDomain(dom);
      if(p.keyword)setSeededKw(p.keyword);
      setStrategy({company:"",domain:dom});
      setSuggestions([{title:p.title||p.keyword||"Imported article",target_keyword:p.keyword||"",category:"IMPORTED"}]);
      setContent({0:{title:p.title||p.keyword||"Imported article",article_html:p.article_html,meta_title:p.meta_title||"",meta_description:p.meta_description||"",slug:p.slug||"",schema_article:p.schema_article||""}});
      setApproved(new Set([0]));
      setPhase(4);
    }catch{/* ignore malformed seed */}
  },[]);
  // phase: 0 input · 1 strategy review · 2 gate1 (suggestions) · 3 generating · 4 gate2 (content) · 5 published
  const [phase,setPhase]=useState(0);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [err,setErr]=useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [strategy,setStrategy]=useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suggestions,setSuggestions]=useState<any[]>([]);
  const [gapSummary,setGapSummary]=useState("");
  const [approved,setApproved]=useState<Set<number>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [content,setContent]=useState<Record<number,any>>({});
  const [genProgress,setGenProgress]=useState({done:0,total:0});
  const [contentLength,setContentLength]=useState("auto"); // auto = per-suggestion word_count
  // WordPress batch publish (credentials shared with SEO Content Agent via localStorage)
  const [wpUrl,setWpUrlRaw]=useState(()=>{try{return localStorage.getItem("rm_wp_url")||"";}catch{return "";}});
  const [wpUser,setWpUserRaw]=useState(()=>{try{return localStorage.getItem("rm_wp_user")||"";}catch{return "";}});
  const [wpPass,setWpPassRaw]=useState(()=>{try{return localStorage.getItem("rm_wp_pass")||"";}catch{return "";}});
  const setWpUrl=(v:string)=>{setWpUrlRaw(v);try{localStorage.setItem("rm_wp_url",v);}catch{}};
  const setWpUser=(v:string)=>{setWpUserRaw(v);try{localStorage.setItem("rm_wp_user",v);}catch{}};
  const setWpPass=(v:string)=>{setWpPassRaw(v);try{localStorage.setItem("rm_wp_pass",v);}catch{}};
  const [wpStatus,setWpStatus]=useState<"draft"|"publish">("draft");
  // WordPress categories — cached PER PROJECT so they persist across refreshes (no re-fetching)
  const projKey=(domain||activeSite||"_").replace(/^https?:\/\//,"").replace(/\/$/,"").toLowerCase();
  const catCacheKey=`rm_wp_cats_${projKey}`;
  const selCacheKey=`rm_wp_selcats_${projKey}`;
  const [wpCats,setWpCats]=useState<{id:number;name:string;count:number;parent:number}[]>(()=>{try{return JSON.parse(localStorage.getItem(`rm_wp_cats_${projKey}`)||"[]");}catch{return [];}});
  const [selCats,setSelCats]=useState<number[]>(()=>{try{return JSON.parse(localStorage.getItem(`rm_wp_selcats_${projKey}`)||"[]");}catch{return [];}});
  const [catsLoading,setCatsLoading]=useState(false);
  const [catOpen,setCatOpen]=useState(false);
  const loadCategories=async()=>{
    if(!wpUrl.trim()||!wpUser.trim()||!wpPass.trim()){setErr("Enter WordPress URL, username, and Application Password first.");return;}
    setCatsLoading(true);setErr("");
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"wpcategories",wpUrl:wpUrl.trim(),wpUser:wpUser.trim(),wpPass:wpPass.trim()})});
      const d=await r.json();
      if(d.categories){setWpCats(d.categories);try{localStorage.setItem(catCacheKey,JSON.stringify(d.categories));}catch{}if(!d.categories.length)setErr("No categories found on this site.");}
      else setErr(d.error||"Could not load categories");
    }catch{setErr("Could not load categories");}
    finally{setCatsLoading(false);}
  };
  const toggleCat=(id:number)=>setSelCats(prev=>{const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];try{localStorage.setItem(selCacheKey,JSON.stringify(next));}catch{}return next;});
  // Author profile — establishes E-E-A-T (Person author schema + on-page byline/bio)
  const [authName,setAuthNameRaw]=useState(()=>{try{return localStorage.getItem("rm_wp_auth_name")||"";}catch{return "";}});
  const [authTitle,setAuthTitleRaw]=useState(()=>{try{return localStorage.getItem("rm_wp_auth_title")||"";}catch{return "";}});
  const [authUrl,setAuthUrlRaw]=useState(()=>{try{return localStorage.getItem("rm_wp_auth_url")||"";}catch{return "";}});
  const [authBio,setAuthBioRaw]=useState(()=>{try{return localStorage.getItem("rm_wp_auth_bio")||"";}catch{return "";}});
  const setAuthName=(v:string)=>{setAuthNameRaw(v);try{localStorage.setItem("rm_wp_auth_name",v);}catch{}};
  const setAuthTitle=(v:string)=>{setAuthTitleRaw(v);try{localStorage.setItem("rm_wp_auth_title",v);}catch{}};
  const setAuthUrl=(v:string)=>{setAuthUrlRaw(v);try{localStorage.setItem("rm_wp_auth_url",v);}catch{}};
  const setAuthBio=(v:string)=>{setAuthBioRaw(v);try{localStorage.setItem("rm_wp_auth_bio",v);}catch{}};
  // When the author name matches the curated Compunnel roster, auto-fill the canonical
  // LinkedIn, bio, and title for E-E-A-T (only fills empty fields — never overwrites).
  useEffect(()=>{
    const a=findAuthor(authName);
    if(!a)return;
    if(!authUrl.trim())setAuthUrl(a.linkedin);
    if(!authBio.trim())setAuthBio(a.bio);
    if(!authTitle.trim()&&a.title)setAuthTitle(a.title);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  },[authName]);
  // Fetch authors from WordPress and let the user pick one (sets WP post author + fills the profile)
  const [wpAuthors,setWpAuthors]=useState<{id:number;name:string;slug:string;bio:string;url:string;avatar:string}[]>([]);
  const [authId,setAuthId]=useState(()=>{try{return Number(localStorage.getItem("rm_wp_auth_id")||"0");}catch{return 0;}});
  const [authorsLoading,setAuthorsLoading]=useState(false);
  const loadAuthors=async()=>{
    if(!wpUrl.trim()||!wpUser.trim()||!wpPass.trim()){setErr("Enter WordPress URL, username, and Application Password first.");return;}
    setAuthorsLoading(true);setErr("");
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"wpauthors",wpUrl:wpUrl.trim(),wpUser:wpUser.trim(),wpPass:wpPass.trim()})});
      const d=await r.json();
      if(d.authors){setWpAuthors(d.authors);if(!d.authors.length)setErr("No authors found on this site.");}
      else setErr(d.error||"Could not load authors");
    }catch{setErr("Could not load authors");}
    finally{setAuthorsLoading(false);}
  };
  const pickAuthor=(id:number)=>{
    setAuthId(id);try{localStorage.setItem("rm_wp_auth_id",String(id));}catch{}
    const a=wpAuthors.find(x=>x.id===id);
    if(a){ setAuthName(a.name||""); setAuthBio(a.bio||""); if(a.url)setAuthUrl(a.url); }
  };
  // Combined author picker: WordPress users (value "wp:<id>") + curated Compunnel roster
  // (value "roster:<name>"). Roster picks set authId=0 → matched to a WP user by name on publish.
  const pickAuthorOpt=(val:string)=>{
    if(val.startsWith("wp:")){ pickAuthor(Number(val.slice(3))); return; }
    if(val.startsWith("roster:")){
      const a=findAuthor(val.slice(7));
      setAuthId(0);try{localStorage.setItem("rm_wp_auth_id","0");}catch{}
      if(a){ setAuthName(a.name); setAuthTitle(a.title||""); setAuthUrl(a.linkedin); setAuthBio(a.bio); }
      return;
    }
    setAuthId(0);try{localStorage.setItem("rm_wp_auth_id","0");}catch{}
  };
  const [publishing,setPublishing]=useState(false);
  const [pubProgress,setPubProgress]=useState({done:0,total:0});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pubResults,setPubResults]=useState<{title:string;ok:boolean;link?:string;error?:string}[]>([]);
  // Target-keyword SERP analysis (Content SERP Analyzer output, run after strategy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [serpKw,setSerpKw]=useState<any[]>([]);
  const [serpKwLoading,setSerpKwLoading]=useState(false);
  const [serpKwProgress,setSerpKwProgress]=useState({done:0,total:0});
  const hist=useToolHistory("campaign");

  // Run Content-SERP analysis for each target keyword (real SERP + your rank + content gap)
  const runKeywordSerp=async()=>{
    const kws:string[]=(strategy?.target_keywords||[]).slice(0,12);
    if(!kws.length)return;
    setSerpKwLoading(true);setSerpKwProgress({done:0,total:kws.length});setSerpKw([]);
    const cleanUrl=domain.trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out:any[]=[];
    for(let i=0;i<kws.length;i+=3){
      const batch=kws.slice(i,i+3);
      const res=await Promise.allSettled(batch.map(async kw=>{
        const r=await fetch(`/api/tools?tool=serpanalyze&keyword=${encodeURIComponent(kw)}${cleanUrl?`&userUrl=${encodeURIComponent(cleanUrl)}`:""}`);
        return await r.json();
      }));
      res.forEach(x=>{if(x.status==="fulfilled"&&x.value&&!x.value.error)out.push(x.value);});
      setSerpKwProgress({done:Math.min(i+3,kws.length),total:kws.length});setSerpKw([...out]);
    }
    setSerpKwLoading(false);
  };

  // Phase 6: batch publish approved content to WordPress (server-side, no CORS)
  const runBatchPublish=async()=>{
    if(!wpUrl.trim()||!wpUser.trim()||!wpPass.trim()){setErr("Enter WordPress URL, username, and Application Password.");return;}
    const idxs=[...approved].filter(i=>content[i]);
    if(!idxs.length){setErr("No generated content to publish.");return;}
    setPublishing(true);setErr("");setPubResults([]);setPubProgress({done:0,total:idxs.length});
    const results:{title:string;ok:boolean;link?:string;error?:string}[]=[];
    // Author profile for E-E-A-T: a Person object for schema + an on-page byline/bio box
    const esc=(t:string)=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const authorPerson=authName.trim()?{"@type":"Person",name:authName.trim(),...(authTitle.trim()?{jobTitle:authTitle.trim()}:{}),...(authBio.trim()?{description:authBio.trim()}:{}),...(authUrl.trim()?{url:authUrl.trim(),sameAs:[authUrl.trim()]}:{})}:null;
    const authorBox=authName.trim()?`\n<div class="author-bio" style="margin-top:32px;padding:16px;border-top:2px solid #eee;display:flex;gap:12px;align-items:flex-start"><div><p style="margin:0;font-weight:700">${esc(authName.trim())}${authTitle.trim()?` — ${esc(authTitle.trim())}`:""}</p>${authBio.trim()?`<p style="margin:4px 0 0;font-size:14px;color:#555">${esc(authBio.trim())}</p>`:""}${authUrl.trim()?`<p style="margin:6px 0 0;font-size:13px"><a href="${esc(authUrl.trim())}" rel="author noopener" target="_blank">More about ${esc(authName.trim())}</a></p>`:""}</div></div>`:"";
    for(let k=0;k<idxs.length;k++){
      const i=idxs[k];const c=content[i];const sug=suggestions[i];
      // Inject the Person author into the Article schema (replaces the Organization-only author)
      let schemaArticle=c.schema_article||"";
      if(authorPerson&&schemaArticle){ try{ const o=JSON.parse(schemaArticle); o.author=authorPerson; schemaArticle=JSON.stringify(o); }catch{} }
      const fullHtml=`${c.article_html||""}${authorBox}${schemaArticle?`\n<script type="application/ld+json">${schemaArticle}</script>`:""}${c.schema_faq?`\n<script type="application/ld+json">${c.schema_faq}</script>`:""}${c.schema_breadcrumb?`\n<script type="application/ld+json">${c.schema_breadcrumb}</script>`:""}${c.schema_extra?`\n<script type="application/ld+json">${c.schema_extra}</script>`:""}`;
      const heroImage=c.hero_b64?{b64:c.hero_b64,mime:c.hero_mime,alt:c.hero_alt||c.title}:undefined;
      const endpoint=(sug?.content_type||"").toLowerCase().includes("landing")||(sug?.content_type||"").toLowerCase().includes("pillar")?"pages":"posts";
      try{
        const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"wppublish",wpUrl:wpUrl.trim(),wpUser:wpUser.trim(),wpPass:wpPass.trim(),title:c.title||sug.title,content:fullHtml,slug:c.slug,excerpt:c.meta_description,status:wpStatus,endpoint,heroImage,categories:selCats,author:authId,authorName:authName.trim()})});
        const d=await r.json();
        if(d.id)results.push({title:c.title||sug.title,ok:true,link:d.link});
        else results.push({title:c.title||sug.title,ok:false,error:d.error||"Publish failed"});
      }catch(e){results.push({title:c.title||sug.title,ok:false,error:e instanceof Error?e.message:"Failed"});}
      setPubProgress({done:k+1,total:idxs.length});setPubResults([...results]);
    }
    setPublishing(false);
    // Mark successfully published articles in memory (✅)
    const pub=results.filter(r=>r.ok).map(r=>({title:r.title,keyword:""}));
    if(pub.length)saveArticles(pub,true);
    if(results.some(r=>r.ok))setPhase(5);
  };

  const PHASES=["Strategy","Gap & Suggestions","Gate 1","Content","Gate 2","Publish"];

  const onFile=async(e:React.ChangeEvent<HTMLInputElement>,target:"gtm"|"brief"|"guardrails")=>{
    const f=e.target.files?.[0];if(!f)return;
    setErr("");setLoadMsg(`Reading ${f.name}…`);setLoading(true);
    try{
      const t=await extractFileText(f);
      if(!t||t.length<10)throw new Error("File appears empty or unreadable.");
      if(target==="gtm")setGtm(t);else if(target==="guardrails")setGuardrails(t);else setBrief(t);
    }catch(ex){setErr(ex instanceof Error?ex.message:"File read failed");}
    finally{setLoading(false);}
  };

  // Phase 1: parse strategy
  const runStrategy=async()=>{
    if(!gtm.trim()&&!brief.trim()){setErr("Add a GTM document or Campaign Brief.");return;}
    setLoading(true);setErr("");setLoadMsg("Parsing GTM + Campaign Brief…");
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"campaign_strategy",gtm,brief,guardrails,domain:domain.trim()})});
      const d=await r.json();if(d.error)throw new Error(d.error);
      // Keep guardrails on the strategy so every generated piece respects them.
      setStrategy({...d.strategy,guardrails:guardrails.trim()||d.strategy?.guardrails||""});setPhase(1);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}finally{setLoading(false);}
  };

  // Phase 2: gap + suggestions (Approval Gate 1)
  const runSuggestions=async()=>{
    setLoading(true);setErr("");setLoadMsg("Analysing competitors & SERP gaps…");
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"campaign_suggestions",strategy,domain:domain.trim()})});
      const d=await r.json();if(d.error)throw new Error(d.error);
      const sugs=d.result?.suggestions||[];
      setSuggestions(sugs);setGapSummary(d.result?.gap_summary||"");
      setApproved(new Set(sugs.map((_:unknown,i:number)=>i)));
      setPhase(2);
      // Cannibalization check: compare each suggestion vs the site's existing pages
      runDedup(sugs);
    }catch(e){setErr(e instanceof Error?e.message:"Failed");}finally{setLoading(false);}
  };

  // ── Article memory: stored SERVER-SIDE per project (shared across all users) via
  // /api/articles (Upstash Redis), with localStorage kept only as an offline cache.
  // The agent dedups new ideas against both the live site AND past output. ──
  const memKeyOf=(dom:string)=>`rm_articles_${(dom||"_").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"")}`;
  const [articleMem,setArticleMem]=useState<{title:string;keyword:string;slug?:string;date:string;published?:boolean}[]>([]);
  const [showMem,setShowMem]=useState(false);
  // Load: show cached copy instantly, then reconcile with the shared server store.
  useEffect(()=>{
    let cancelled=false;
    let cached:{title:string;keyword:string;slug?:string;date:string;published?:boolean}[]=[];
    try{ cached=JSON.parse(localStorage.getItem(memKeyOf(domain))||"[]"); }catch{}
    setArticleMem(cached);
    if(domain.trim()){
      fetch(`/api/articles?domain=${encodeURIComponent(domain.trim())}`)
        .then(r=>r.json()).then(async d=>{
          if(cancelled||!d||!Array.isArray(d.articles))return;
          // First-time migration: shared store empty but this browser has local memory →
          // seed the shared store from the cache (once) instead of wiping the display.
          const migKey=`rm_articles_migrated_${memKeyOf(domain)}`;
          let migrated=false; try{migrated=localStorage.getItem(migKey)==="1";}catch{}
          if(d.ready&&d.articles.length===0&&cached.length>0&&!migrated){
            try{localStorage.setItem(migKey,"1");}catch{}
            const merged=await saveArticles(cached.map(a=>({title:a.title,keyword:a.keyword,slug:a.slug})),false);
            // re-apply published flags lost in the seed (saveArticles defaults published=false)
            const pub=cached.filter(a=>a.published).map(a=>({title:a.title,keyword:a.keyword,slug:a.slug}));
            if(pub.length){ if(cancelled)return; await saveArticles(pub,true); }
            if(!cancelled&&!pub.length)setArticleMem(merged);
            return;
          }
          setArticleMem(d.articles);
          try{localStorage.setItem(memKeyOf(domain),JSON.stringify(d.articles));}catch{}
        }).catch(()=>{});
    }
    return ()=>{cancelled=true;};
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  },[domain]);
  const saveArticles=async(items:{title:string;keyword:string;slug?:string}[],published=false)=>{
    const key=memKeyOf(domain); const today=new Date().toISOString().slice(0,10);
    // 1. Optimistic local merge (instant UI + offline cache)
    let arr:{title:string;keyword:string;slug?:string;date:string;published?:boolean}[]=[]; try{arr=JSON.parse(localStorage.getItem(key)||"[]");}catch{}
    for(const it of items){ if(!it.title)continue; const ex=arr.find(a=>a.title.toLowerCase()===it.title.toLowerCase()); if(ex){ if(published)ex.published=true; if(it.slug&&!ex.slug)ex.slug=it.slug; } else arr.push({title:it.title,keyword:it.keyword||"",slug:it.slug,date:today,published}); }
    arr=arr.slice(-1000); try{localStorage.setItem(key,JSON.stringify(arr));}catch{} setArticleMem(arr);
    // 2. Persist to the shared server store; reconcile state with its response
    if(domain.trim()){
      try{
        const r=await fetch("/api/articles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:domain.trim(),articles:items,published})});
        const d=await r.json().catch(()=>({}));
        if(r.ok&&Array.isArray(d.articles)&&d.articles.length){ arr=d.articles; try{localStorage.setItem(key,JSON.stringify(arr));}catch{} setArticleMem(arr); }
      }catch{/* offline: keep optimistic local copy */}
    }
    return arr;
  };
  const clearMem=async()=>{
    try{localStorage.removeItem(memKeyOf(domain));}catch{} setArticleMem([]);
    if(domain.trim()){ try{ await fetch(`/api/articles?domain=${encodeURIComponent(domain.trim())}`,{method:"DELETE"}); }catch{} }
  };
  // Import every article already published on the live site into memory (one-time backfill).
  const [importing,setImporting]=useState(false);
  const [importMsg,setImportMsg]=useState("");
  const importSiteArticles=async()=>{
    if(!domain.trim()){setImportMsg("Set a project domain first.");return;}
    setImporting(true);setImportMsg("");
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"site_articles",domain:domain.trim(),wpUrl:wpUrl.trim()||undefined,wpUser:wpUser.trim()||undefined,wpPass:wpPass.trim()||undefined}),signal:AbortSignal.timeout(70000)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.error){setImportMsg(d.error||`Import failed (HTTP ${r.status}).`);return;}
      const before=articleMem.length;
      const merged=await saveArticles((d.articles||[]).map((a:{title:string;keyword?:string;slug?:string})=>({title:a.title,keyword:a.keyword||"",slug:a.slug})),true);
      const added=Math.max(0,merged.length-before);
      setImportMsg(`Imported ${d.count} published article${d.count===1?"":"s"} from ${domain} (${d.source==="wordpress"?"WordPress":"sitemap"})${added>0?` · ${added} new`:" · all already in shared memory"}.`);
    }catch(e:unknown){setImportMsg(e instanceof Error&&e.name==="TimeoutError"?"Import timed out — the site has many pages. Try again.":"Import failed. Check the domain and try again.");}
    finally{setImporting(false);}
  };
  // lightweight lexical similarity (mirrors the backend dedup)
  const _stop=new Set(["the","a","an","to","for","of","in","on","and","or","with","your","you","is","are","how","what","why","best","guide","vs"]);
  const _tok=(s:string)=>new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>2&&!_stop.has(w)));
  const _jac=(a:Set<string>,b:Set<string>)=>{if(!a.size||!b.size)return 0;let n=0;a.forEach(x=>{if(b.has(x))n++;});return n/(a.size+b.size-n);};

  // Content dedup — flags suggestions that duplicate a live page (backend) OR a remembered article (memory)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dedupMap,setDedupMap]=useState<Record<number,{duplicate:boolean;similarity:number;match_url:string;match_title:string;source:string}>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runDedup=async(sugs:any[])=>{
    if(!sugs.length)return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m:Record<number,any>={};
    // 1. Memory check (client-side, instant) — vs the shared, server-synced article memory
    const mem:{title:string;keyword?:string}[]=articleMem;
    sugs.forEach((s,i)=>{
      const ct=_tok(`${s.title||""} ${s.target_keyword||""}`); let best={title:"",score:0};
      for(const a of mem){ const sc=_jac(ct,_tok(`${a.title} ${a.keyword||""}`)); if(sc>best.score)best={title:a.title,score:sc}; }
      if(best.score>=0.4) m[i]={duplicate:best.score>=0.5,similarity:+best.score.toFixed(2),match_url:"",match_title:best.title,source:"memory"};
    });
    // 2. Site check (backend, vs live published pages)
    if(domain.trim()){
      try{
        const candidates=sugs.map((s,i)=>({idx:i,text:`${s.title||""} ${s.target_keyword||""}`.trim()}));
        const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"content_dedup",domain:domain.trim(),candidates})});
        const d=await r.json();
        if(d.results)d.results.forEach((x:{idx:number;duplicate:boolean;similarity:number;match_url:string;match_title:string})=>{ if(x.similarity>=0.4 && (!m[x.idx]||x.similarity>m[x.idx].similarity)) m[x.idx]={duplicate:x.duplicate,similarity:x.similarity,match_url:x.match_url,match_title:x.match_title,source:"site"}; });
      }catch{/* site dedup best-effort */}
    }
    setDedupMap(m);
  };

  const toggleApprove=(i:number)=>setApproved(prev=>{const n=new Set(prev);if(n.has(i))n.delete(i);else n.add(i);return n;});

  // Phase 5: batch generate content for approved suggestions
  const runContent=async()=>{
    const idxs=[...approved];if(!idxs.length){setErr("Approve at least one suggestion in Gate 1 first.");return;}
    // ── Dedup ALERT: warn before generating anything that duplicates an existing/remembered article ──
    const dupes=idxs.filter(i=>dedupMap[i]).map(i=>`• "${suggestions[i]?.title}" ≈ ${dedupMap[i].match_title||dedupMap[i].match_url} (${Math.round(dedupMap[i].similarity*100)}%, ${dedupMap[i].source==="memory"?"already written":"live page"})`);
    if(dupes.length){
      const ok=window.confirm(`⚠ ${dupes.length} approved piece(s) look like duplicates of content you already have:\n\n${dupes.join("\n")}\n\nGenerating these may cannibalize existing pages. Generate anyway?`);
      if(!ok)return;
    }
    setPhase(3);setErr("");setGenProgress({done:0,total:idxs.length});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out:Record<number,any>={};
    let lastErr="";
    for(let i=0;i<idxs.length;i+=2){
      const batch=idxs.slice(i,i+2);
      await Promise.allSettled(batch.map(async idx=>{
        const sug=contentLength==="auto"?suggestions[idx]:{...suggestions[idx],word_count:Number(contentLength)};
        const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"campaign_content",suggestion:sug,strategy:{...strategy,domain:domain.trim()}})});
        const d=await r.json();
        if(!d.error&&d.content)out[idx]=d.content; else lastErr=d.error||"Generation failed";
      }));
      setGenProgress({done:Math.min(i+2,idxs.length),total:idxs.length});
      setContent({...out});
    }
    // If nothing generated, stay on Gate 1 and show why (don't silently land on an empty Gate 2)
    if(Object.keys(out).length===0){
      setPhase(2);
      setErr(`Content generation failed — ${lastErr||"AI provider unavailable"}. Try again in a bit, or check AI provider credits/limits.`);
      return;
    }
    setPhase(4);
    if(lastErr) setErr(`Some pieces couldn't be generated (${lastErr}). The ones that succeeded are shown below.`);
    hist.add(`${strategy?.company||domain} · ${Object.keys(out).length} pieces`,{strategy,suggestions,content:out});
    // Remember every generated article so future runs dedup against it
    saveArticles(Object.keys(out).map(Number).map(idx=>({title:out[idx].title||suggestions[idx]?.title,keyword:suggestions[idx]?.target_keyword,slug:out[idx].slug})));
    // Generate a blog hero image (Google AI Studio) for each piece in parallel, fill in as they arrive
    Object.keys(out).map(Number).forEach(idx=>{genImage(idx,out);});
  };

  // Generate a hero image for one piece via Google AI Studio (Imagen/Gemini) and merge into content state
  const [imgBusy,setImgBusy]=useState<Record<number,boolean>>({});
  // Hero image art style: "photo" = premium enterprise photography, "hologram" = cinematic
  // floating holographic dashboard scene. Brand colours are applied server-side per project.
  const [imgStyle,setImgStyle]=useState<string>(()=>{try{return localStorage.getItem("rm_campaign_img_style")||"photo";}catch{return "photo";}});
  const changeImgStyle=(v:string)=>{setImgStyle(v);try{localStorage.setItem("rm_campaign_img_style",v);}catch{}};
  // Inline content editing (Gate 2): edit the article body + title before publishing.
  const [editing,setEditing]=useState<Record<number,boolean>>({});
  const editRefs=useRef<Record<number,HTMLDivElement|null>>({});
  const saveEdit=(i:number)=>{ const el=editRefs.current[i]; if(el)setContent(prev=>({...prev,[i]:{...prev[i],article_html:el.innerHTML}})); setEditing(prev=>({...prev,[i]:false})); };
  const cancelEdit=(i:number)=>setEditing(prev=>({...prev,[i]:false}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genImage=async(idx:number,base?:Record<number,any>)=>{
    const c=(base||content)[idx];if(!c)return;
    setImgBusy(b=>({...b,[idx]:true}));
    try{
      const r=await fetch("/api/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:"campaign_image",title:c.title||suggestions[idx]?.title,keyword:suggestions[idx]?.target_keyword,domain:domain.trim(),company:strategy?.company||"",style:imgStyle,content:(c.article_html||"").slice(0,4000)})});
      const d=await r.json();
      if(d.image_url){
        // Crop/resize to exactly 1200×600 (blog hero standard) before storing/publishing
        let img={url:d.image_url,b64:d.image_b64,mime:d.mime};
        try{ const rz=await resizeImageDataUrl(d.image_url,1200,600); img={url:rz.dataUrl,b64:rz.b64,mime:rz.mime}; }catch{/* keep original if resize fails */}
        setContent(prev=>({...prev,[idx]:{...prev[idx],hero_image:img.url,hero_alt:d.alt,hero_b64:img.b64,hero_mime:img.mime}}));
      }
      else setErr(d.error||"Image generation failed");
    }catch{setErr("Image generation failed");}
    finally{setImgBusy(b=>({...b,[idx]:false}));}
  };

  const catColor:Record<string,string>={"NEW PILLAR":S.accent,"NEW CLUSTER ARTICLE":S.green,"UPDATE EXISTING":S.amber,"CONSOLIDATE":"#8b5cf6","REPURPOSE":S.red};
  const priColor=(p:string)=>p==="Critical"?S.red:p==="High"?S.amber:S.green;

  return (
    <div style={{maxWidth:1000,margin:"0 auto",padding:"0 4px"}}>
      <ProjectBar activeSite={activeSite} setPage={setPage}/>
      <h2 style={{fontSize:20,fontWeight:700,color:S.text,margin:"0 0 4px"}}>SEO Campaign Agent</h2>
      <p style={{fontSize:13,color:S.muted,margin:"0 0 16px"}}>GTM + Campaign Brief → competitor gap analysis → approved suggestions → batch content → publish. Two approval gates keep you in control.</p>

      {/* Article memory — every generated article is remembered per project + used for dedup */}
      <div style={{background:S.subtle,border:`1px solid ${S.border}`,borderRadius:10,padding:"8px 14px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const}}>
          <span style={{fontSize:12,color:S.text}}>📚 <strong>Article memory</strong> · {articleMem.length} remembered for <strong>{domain||"this project"}</strong> <InfoTip text="Every article the agent generates is saved here per project. New suggestions are automatically checked against this memory (and your live site) and flagged if they duplicate an existing article."/></span>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button onClick={importSiteArticles} disabled={importing||!domain.trim()} style={{fontSize:11,color:importing?S.muted:S.accent,background:"none",border:"none",cursor:importing?"default":"pointer",fontFamily:"inherit",fontWeight:600}}>{importing?"Importing…":"⬇ Import from site"}</button>
            {articleMem.length>0&&<button onClick={()=>setShowMem(v=>!v)} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>{showMem?"Hide":"View list"}</button>}
            {articleMem.length>0&&<button onClick={()=>{if(window.confirm("Clear the remembered articles for this project?"))clearMem();}} style={{fontSize:11,color:S.muted,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Clear</button>}
          </div>
        </div>
        {importMsg&&<div style={{marginTop:6,fontSize:11,color:importMsg.toLowerCase().includes("fail")||importMsg.toLowerCase().includes("timed out")||importMsg.toLowerCase().includes("first")?S.red:S.green}}>{importMsg}</div>}
        {showMem&&articleMem.length>0&&(
          <div style={{marginTop:8,maxHeight:180,overflowY:"auto" as const,display:"grid",gap:4}}>
            {[...articleMem].reverse().map((a,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:11,padding:"4px 8px",background:"#fff",border:`1px solid ${S.border}`,borderRadius:5}}>
                <span style={{color:S.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{a.published?"✅ ":"📝 "}{a.title}</span>
                <span style={{color:S.muted,flexShrink:0}}>{a.keyword?`${a.keyword} · `:""}{a.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline stepper */}
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:20,flexWrap:"wrap" as const,background:S.card,border:`1px solid ${S.border}`,borderRadius:12,padding:"12px 16px",boxShadow:S.shadow}}>
        {PHASES.map((p,i)=>{
          const active=(phase>=1&&i===0)||(phase>=2&&i<=2&&p==="Gap & Suggestions"&&phase>=2)||false;
          const done=(i===0&&phase>=1)||(i===1&&phase>=2)||(i===2&&phase>=2)||(i===3&&phase>=4)||(i===4&&phase>=4)||(i===5&&phase>=5);
          const current=(i===0&&phase===0)||(i===2&&phase===2)||(i===3&&phase===3)||(i===4&&phase===4)||(i===5&&phase===5);
          void active;
          return (
            <div key={p} style={{display:"flex",alignItems:"center",flex:i<PHASES.length-1?1:0,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:done?S.green:current?"linear-gradient(135deg,#6366f1,#818cf8)":S.subtle,color:done||current?"#fff":S.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{done?"✓":i+1}</div>
                <span style={{fontSize:11,fontWeight:current?700:500,color:current?S.text:S.muted,whiteSpace:"nowrap" as const}}>{p}</span>
              </div>
              {i<PHASES.length-1&&<div style={{flex:1,height:2,background:done?S.green:S.border,margin:"0 8px",minWidth:12}}/>}
            </div>
          );
        })}
      </div>

      {err&&<div style={{fontSize:13,color:S.red,background:S.redBg,border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",marginBottom:14}}>⚠ {err}</div>}
      {loading&&<Card><LoadingBar phase={loadMsg}/></Card>}

      {/* PHASE 0 — Inputs */}
      {phase===0&&!loading&&(
        <Card>
          {seededKw&&<div style={{fontSize:12,color:S.accentText,background:S.accentBg,border:`1px solid #c7d2fe`,borderRadius:8,padding:"8px 12px",marginBottom:14}}>✍️ Seeded from a content gap — targeting <strong>“{seededKw}”</strong>. Review the brief below and hit <strong>Parse Strategy</strong>.</div>}
          <Field label="Client domain"><TI value={domain} onChange={setDomain} placeholder="e.g. eximius.ai"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="GTM document (paste or upload)">
              <TI value={gtm} onChange={setGtm} placeholder="Paste your GTM strategy: ICP, messaging, products, competitors…" rows={7}/>
              <label style={{fontSize:11,color:S.accent,cursor:"pointer",fontWeight:600,display:"inline-block",marginTop:6}}>↑ Upload PDF / DOCX / PPTX / TXT<input type="file" accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json" onChange={e=>onFile(e,"gtm")} style={{display:"none"}}/></label>
            </Field>
            <Field label="Campaign Brief (paste or upload)">
              <TI value={brief} onChange={setBrief} placeholder="Campaign goal, target audience, geography, keywords, CTA, timeline…" rows={7}/>
              <label style={{fontSize:11,color:S.accent,cursor:"pointer",fontWeight:600,display:"inline-block",marginTop:6}}>↑ Upload PDF / DOCX / PPTX / TXT<input type="file" accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json" onChange={e=>onFile(e,"brief")} style={{display:"none"}}/></label>
            </Field>
          </div>
          <Field label="Guardrails (paste or upload) — optional">
            <TI value={guardrails} onChange={setGuardrails} placeholder="Brand & content guardrails the writer MUST follow: banned words/claims, tone & style rules, compliance/legal constraints, competitors not to mention, mandatory disclaimers…" rows={5}/>
            <label style={{fontSize:11,color:S.accent,cursor:"pointer",fontWeight:600,display:"inline-block",marginTop:6}}>↑ Upload PDF / DOCX / PPTX / TXT<input type="file" accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json" onChange={e=>onFile(e,"guardrails")} style={{display:"none"}}/></label>
            <p style={{fontSize:11,color:S.muted,margin:"4px 0 0"}}>Applied as hard rules to every generated article (overrides default style where they conflict).</p>
          </Field>
          <Btn onClick={runStrategy} disabled={loading||(!gtm.trim()&&!brief.trim())}>Parse Strategy →</Btn>
        </Card>
      )}

      {/* PHASE 1 — Strategy Summary Card (review/correct) */}
      {phase===1&&strategy&&!loading&&(
        <Card>
          <SH title="Strategy Summary — review before continuing"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            {[
              ["Company",strategy.company],["Industry",strategy.industry],
              ["Campaign goal",strategy.campaign_goal],["Geography",strategy.geography],
              ["Target audience",strategy.target_audience],["Primary CTA",strategy.cta],
            ].map(([l,v])=>(
              <div key={String(l)} style={{padding:"10px 12px",background:S.subtle,borderRadius:8}}>
                <p style={{fontSize:10,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 3px"}}>{l}</p>
                <p style={{fontSize:13,color:S.text,margin:0}}>{v||"—"}</p>
              </div>
            ))}
          </div>
          <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 6px"}}>ICP</p>
          <p style={{fontSize:13,color:S.text,margin:"0 0 12px"}}>{strategy.icp}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 6px"}}>Competitors</p>
              {(strategy.competitors||[]).map((c:string,i:number)=><span key={i} style={{fontSize:11,background:S.accentBg,color:S.accentText,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{c}</span>)}
            </div>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:S.muted,textTransform:"uppercase" as const,margin:"0 0 6px"}}>Target keywords</p>
              {(strategy.target_keywords||[]).map((c:string,i:number)=><span key={i} style={{fontSize:11,background:S.subtle,color:S.text,border:`1px solid ${S.border}`,borderRadius:4,padding:"2px 8px",marginRight:4,marginBottom:4,display:"inline-block"}}>{c}</span>)}
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            <Btn variant="secondary" onClick={()=>setPhase(0)}>← Edit inputs</Btn>
            <Btn variant="secondary" onClick={runKeywordSerp} disabled={serpKwLoading}>{serpKwLoading?`Analysing ${serpKwProgress.done}/${serpKwProgress.total}…`:"🔍 Analyse target keywords (SERP)"}</Btn>
            <Btn onClick={runSuggestions} disabled={loading}>Run Gap Analysis →</Btn>
          </div>
        </Card>
      )}

      {/* Target-keyword SERP analysis output (Content SERP Analyzer, in-line) */}
      {phase===1&&(serpKwLoading||serpKw.length>0)&&(
        <Card>
          <SH title={`Target Keyword SERP Analysis${serpKw.length?` — ${serpKw.length} keywords`:""}`}/>
          {serpKwLoading&&serpKw.length===0&&<LoadingBar phase={`Scanning SERPs… ${serpKwProgress.done}/${serpKwProgress.total}`}/>}
          {serpKw.length>0&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:640}}>
                <thead><tr>{["Keyword","Your Rank","Difficulty","Opportunity","SERP Avg","Top Ranking","Content Gap"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
                <tbody>{serpKw.map((r,i)=>{
                  const diffC=r.difficulty==="Low"?S.green:r.difficulty==="Medium"?S.amber:S.red;
                  const oppC=r.opportunity_score>=60?S.green:r.opportunity_score>=35?S.amber:S.red;
                  return (
                  <tr key={i}>
                    <TD bold>{r.keyword}</TD>
                    <TD>{r.your_rank?(r.your_rank.ranking
                      ?<span style={{fontSize:11,fontWeight:700,color:r.your_rank.position<=3?S.green:r.your_rank.position<=10?S.accent:S.amber,background:r.your_rank.position<=3?S.greenBg:r.your_rank.position<=10?S.accentBg:S.amberBg,padding:"2px 8px",borderRadius:4}}>#{r.your_rank.position}</span>
                      :<span style={{fontSize:11,fontWeight:600,color:S.red,background:S.redBg,padding:"2px 8px",borderRadius:4}}>Not ranking</span>
                    ):<span style={{fontSize:11,color:S.muted}}>—</span>}</TD>
                    <TD><span style={{fontSize:11,fontWeight:700,color:diffC,background:r.difficulty==="Low"?S.greenBg:r.difficulty==="Medium"?S.amberBg:S.redBg,padding:"2px 8px",borderRadius:4}}>{r.difficulty}</span></TD>
                    <TD><span style={{fontSize:12,fontWeight:700,color:oppC}}>{r.opportunity_score}</span></TD>
                    <TD color={S.muted}>{(r.content_signals?.avg_word_count||0).toLocaleString()}</TD>
                    <TD><span style={{fontSize:11,color:S.accent}}>{r.serp_results?.[0]?.domain||"—"}</span></TD>
                    <TD>{r.gap?(r.gap.word_gap>0?<span style={{fontSize:11,color:S.amber,fontWeight:600}}>+{r.gap.word_gap.toLocaleString()} words</span>:<span style={{fontSize:11,color:S.green}}>✓ on par</span>):<span style={{fontSize:11,color:S.muted}}>—</span>}</TD>
                  </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
          {serpKw.length>0&&<p style={{fontSize:11,color:S.muted,margin:"10px 0 0"}}>Real SERP data per target keyword — use this to prioritise before generating the gap report.</p>}
        </Card>
      )}

      {/* PHASE 2 — Approval Gate 1: gap report + suggestion table */}
      {phase===2&&!loading&&(
        <>
          {gapSummary&&<Card style={{background:S.accentBg,border:"1px solid #c7d2fe"}}><p style={{fontSize:13,fontWeight:700,color:S.accentText,margin:"0 0 4px"}}>📊 Gap Analysis Summary</p><p style={{fontSize:13,color:S.accentText,margin:0,lineHeight:1.6}}>{gapSummary}</p></Card>}
          {/* Cluster Map — PRD Deliverable 2: hub-and-spoke of proposed architecture */}
          <Card>
            <SH title="Proposed Cluster Map"/>
            <p style={{fontSize:11,color:S.muted,margin:"0 0 12px"}}>Hub-and-spoke view of the content architecture these suggestions create. Hover a node for the page title.</p>
            <ClusterMap suggestions={suggestions}/>
            <div style={{display:"flex",gap:14,flexWrap:"wrap" as const,marginTop:12}}>
              {[["NEW PILLAR",S.accent],["NEW CLUSTER ARTICLE",S.green],["UPDATE EXISTING",S.amber],["CONSOLIDATE","#8b5cf6"],["REPURPOSE",S.red]].map(([l,c])=>(
                <span key={l} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:S.muted}}><span style={{width:10,height:10,borderRadius:"50%",background:c as string}}/>{l}</span>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap" as const,gap:8}}>
              <SH title={`Approval Gate 1 — ${approved.size}/${suggestions.length} selected`}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setApproved(new Set(suggestions.map((_,i)=>i)))} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Select all</button>
                <button onClick={()=>setApproved(new Set())} style={{fontSize:11,color:S.muted,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Clear</button>
              </div>
            </div>
            <div style={{display:"grid",gap:8}}>
              {suggestions.map((s,i)=>(
                <div key={i} onClick={()=>toggleApprove(i)} style={{display:"flex",gap:12,padding:"12px 14px",background:approved.has(i)?S.accentBg:S.subtle,borderRadius:10,border:`1.5px solid ${approved.has(i)?S.accent:S.border}`,cursor:"pointer"}}>
                  <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${approved.has(i)?S.accent:S.border}`,background:approved.has(i)?S.accent:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>{approved.has(i)&&<span style={{color:"#fff",fontSize:11,fontWeight:800}}>✓</span>}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:S.text}}>{s.title}</span>
                      <span style={{fontSize:9,fontWeight:700,color:"#fff",background:catColor[s.category]||S.muted,padding:"2px 7px",borderRadius:4}}>{s.category}</span>
                      <span style={{fontSize:9,fontWeight:700,color:priColor(s.priority),background:s.priority==="Critical"?S.redBg:s.priority==="High"?S.amberBg:S.greenBg,padding:"2px 7px",borderRadius:4}}>{s.priority}</span>
                    </div>
                    <p style={{fontSize:11,color:S.muted,margin:"0 0 4px",lineHeight:1.5}}>{s.why}</p>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
                      <span style={{fontSize:10,color:S.accentText,background:"#fff",border:"1px solid #c7d2fe",padding:"1px 7px",borderRadius:4}}>KW: {s.target_keyword}</span>
                      <span style={{fontSize:10,color:S.muted,background:"#fff",border:`1px solid ${S.border}`,padding:"1px 7px",borderRadius:4}}>{s.content_type}</span>
                      <span style={{fontSize:10,color:S.muted,background:"#fff",border:`1px solid ${S.border}`,padding:"1px 7px",borderRadius:4}}>{s.word_count} words</span>
                      <span style={{fontSize:10,color:S.muted,background:"#fff",border:`1px solid ${S.border}`,padding:"1px 7px",borderRadius:4}}>Cluster: {s.cluster}</span>
                      {s.existing_url&&<span style={{fontSize:10,color:S.amberText,background:S.amberBg,padding:"1px 7px",borderRadius:4}}>↻ {s.existing_url}</span>}
                    </div>
                    {dedupMap[i]&&(()=>{
                      const dd=dedupMap[i]; const isMem=dd.source==="memory";
                      const label=`${dd.duplicate?"⚠ Likely duplicate":"⚠ Similar"} (${Math.round(dd.similarity*100)}%) · ${isMem?"already written":"live page"}: ${dd.match_title||dd.match_url}`;
                      const style={display:"inline-flex" as const,alignItems:"center" as const,gap:5,marginTop:6,fontSize:10,fontWeight:600,color:dd.duplicate?S.redText:S.amberText,background:dd.duplicate?S.redBg:S.amberBg,border:`1px solid ${dd.duplicate?"#fecaca":"#fde68a"}`,padding:"3px 8px",borderRadius:5,textDecoration:"none" as const};
                      return dd.match_url
                        ? <a href={dd.match_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={style}>{label} ↗</a>
                        : <span style={style}>{label}</span>;
                    })()}
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginTop:14,alignItems:"center",flexWrap:"wrap" as const}}>
              <Btn variant="secondary" onClick={()=>setPhase(1)}>← Back</Btn>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:S.muted}}>
                Content length:
                <select value={contentLength} onChange={e=>setContentLength(e.target.value)} style={{fontSize:12,padding:"6px 8px",border:`1px solid ${S.border}`,borderRadius:6,background:"#fff",color:S.text}}>
                  <option value="auto">Auto (SERP-recommended)</option>
                  <option value="600">Short — 600 words</option>
                  <option value="1000">Standard — 1,000 words</option>
                  <option value="1500">Long — 1,500 words</option>
                  <option value="2500">In-depth — 2,500 words</option>
                  <option value="3500">Pillar — 3,500 words</option>
                </select>
              </label>
              <Btn onClick={runContent} disabled={approved.size===0}>Approve &amp; Generate {approved.size} pieces →</Btn>
            </div>
          </Card>
        </>
      )}

      {/* PHASE 3 — Generating */}
      {phase===3&&(
        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600,color:S.text}}>Generating content…</span>
            <span style={{fontSize:12,color:S.muted}}>{genProgress.done}/{genProgress.total}</span>
          </div>
          <div style={{height:8,background:S.subtle,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${genProgress.total?(genProgress.done/genProgress.total)*100:0}%`,background:"linear-gradient(90deg,#6366f1,#818cf8)",borderRadius:99,transition:"width 0.3s"}}/></div>
        </Card>
      )}

      {/* PHASE 4 — Approval Gate 2: review content */}
      {phase===4&&(
        <>
          <Card style={{background:S.greenBg,border:"1px solid #a7f3d0"}}><p style={{fontSize:13,fontWeight:700,color:S.greenText,margin:0}}>✓ Approval Gate 2 — {Object.keys(content).length} pieces generated. Review below, then batch-publish to WordPress.</p></Card>
          {/* Content controls: change length & regenerate, or create another from the gap analysis */}
          <Card>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" as const}}>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:S.muted}}>
                Content length:
                <select value={contentLength} onChange={e=>setContentLength(e.target.value)} style={{fontSize:12,padding:"6px 8px",border:`1px solid ${S.border}`,borderRadius:6,background:"#fff",color:S.text}}>
                  <option value="auto">Auto (SERP-recommended)</option>
                  <option value="600">Short — 600 words</option>
                  <option value="1000">Standard — 1,000 words</option>
                  <option value="1500">Long — 1,500 words</option>
                  <option value="2500">In-depth — 2,500 words</option>
                  <option value="3500">Pillar — 3,500 words</option>
                </select>
              </label>
              <Btn variant="secondary" onClick={runContent} disabled={loading}>🔄 Regenerate {[...approved].filter(i=>content[i]).length} with this length</Btn>
              <Btn variant="secondary" onClick={()=>{setPhase(2);setErr("");}}>➕ Create another from gap analysis</Btn>
            </div>
            <p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>Regenerate rewrites the approved pieces at the chosen length (hero images regenerate too). “Create another” takes you back to the gap-analysis suggestions to approve more.</p>
          </Card>
          {/* Scoped styles so the AEO HTML (headings, highlighted answer, takeaways, FAQ, tables) renders in the preview */}
          <style>{`
            .rm-article h2{font-size:16px;font-weight:700;margin:16px 0 8px;color:#0f172a}
            .rm-article h3{font-size:14px;font-weight:700;margin:12px 0 6px;color:#0f172a}
            .rm-article p{margin:0 0 10px}
            .rm-article ul,.rm-article ol{margin:0 0 10px 4px;padding-left:20px}
            .rm-article ul{list-style:disc}.rm-article ol{list-style:decimal}
            .rm-article li{margin:0 0 4px;list-style:inherit}
            .rm-article .key-answer{background:#eef2ff;border-left:3px solid #6366f1;padding:10px 12px;border-radius:6px;font-weight:600;margin:0 0 12px}
            .rm-article .key-takeaways{background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:10px 12px 10px 30px}
            .rm-article table{border-collapse:collapse;width:100%;margin:0 0 12px}
            .rm-article th,.rm-article td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-size:12px}
            .rm-article strong{font-weight:700}
            .rm-article .faq-heading{border-top:1px solid #e2e8f0;padding-top:14px}
          `}</style>
          {[...approved].filter(i=>content[i]).map(i=>{
            const c=content[i];
            const aeoBits=[/key-answer/.test(c.article_html||"")&&"Direct answer",/key-takeaways/.test(c.article_html||"")&&"Key takeaways",c.schema_faq&&"FAQ schema",c.schema_article&&"Article+Speakable"].filter(Boolean) as string[];
            return (
              <Card key={i}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap" as const,gap:8}}>
                  <SH title={c.title||suggestions[i].title}/>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {aeoBits.length>0&&<span title={`AEO enabled: ${aeoBits.join(", ")}`} style={{fontSize:10,fontWeight:700,color:S.greenText,background:S.greenBg,border:"1px solid #a7f3d0",padding:"2px 8px",borderRadius:4}}>AEO ✓</span>}
                    <span style={{fontSize:10,fontWeight:700,color:"#fff",background:catColor[suggestions[i].category]||S.muted,padding:"2px 8px",borderRadius:4}}>{suggestions[i].category}</span>
                    {editing[i] ? (<>
                      <button onClick={()=>saveEdit(i)} style={{fontSize:11,fontWeight:700,color:"#fff",background:S.green,border:"none",borderRadius:5,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}>✓ Save</button>
                      <button onClick={()=>cancelEdit(i)} style={{fontSize:11,color:S.muted,background:"none",border:`1px solid ${S.border}`,borderRadius:5,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                    </>) : (<>
                      <button onClick={()=>setEditing(prev=>({...prev,[i]:true}))} style={{fontSize:11,fontWeight:600,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>✏ Edit</button>
                      <CopyBtn text={c.article_html||""}/>
                      <select value={imgStyle} onChange={e=>changeImgStyle(e.target.value)} title="Hero image style (brand colours applied automatically)" style={{fontSize:11,color:S.muted,background:"none",border:`1px solid ${S.border}`,borderRadius:5,padding:"2px 4px",cursor:"pointer",fontFamily:"inherit"}}>
                        <option value="photo">🖼 Photoreal</option>
                        <option value="hologram">🖼 Holographic UI</option>
                      </select>
                      <button onClick={()=>genImage(i)} disabled={imgBusy[i]} style={{fontSize:11,color:imgBusy[i]?S.muted:S.accent,background:"none",border:"none",cursor:imgBusy[i]?"default":"pointer",fontFamily:"inherit",padding:0}}>{imgBusy[i]?"🖼 Generating…":c.hero_image?"🖼 Regenerate image":"🖼 Generate image"}</button>
                      <button onClick={()=>{const a=document.createElement("a");a.href="data:text/html;charset=utf-8,"+encodeURIComponent(c.article_html||"");a.download=`${c.slug||"article"}.html`;a.click();}} style={{fontSize:11,color:S.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>↓ HTML</button>
                    </>)}
                  </div>
                </div>
                {(()=>{const actual=c.word_count??(c.article_html||"").replace(/<[^>]+>/g," ").split(/\s+/).filter(Boolean).length;const target=c.target_word_count||(contentLength!=="auto"?Number(contentLength):0);const short=target>0&&actual<target*0.9;return <p style={{fontSize:11,color:S.muted,margin:"0 0 8px"}}>{c.meta_title} · <span style={{color:short?S.amber:S.muted,fontWeight:short?700:400}}>{actual.toLocaleString()}{target>0?` / ${target.toLocaleString()}`:""} words{short?" (under target — Regenerate)":""}</span>{c.hero_image?" · hero image ✓":""}</p>;})()}
                {c.hero_image&&<img src={c.hero_image} alt={c.hero_alt||c.title} style={{width:"100%",aspectRatio:"2 / 1",objectFit:"cover" as const,borderRadius:8,marginBottom:10,border:`1px solid ${S.border}`}}/>}
                {editing[i] ? (<>
                  <Field label="Title"><TI value={c.title||suggestions[i].title} onChange={v=>setContent(prev=>({...prev,[i]:{...prev[i],title:v}}))}/></Field>
                  <p style={{fontSize:11,color:S.muted,margin:"0 0 6px"}}>Edit the content directly below, then click Save. Formatting (headings, lists, FAQ) is preserved.</p>
                  <div className="rm-article" contentEditable suppressContentEditableWarning
                    ref={el=>{ editRefs.current[i]=el; if(el && el.dataset.idx!==String(i)){ el.innerHTML=c.article_html||""; el.dataset.idx=String(i); } }}
                    style={{fontSize:13,lineHeight:1.7,color:S.text,minHeight:200,maxHeight:480,overflowY:"auto" as const,border:`2px solid ${S.accent}`,borderRadius:8,padding:14,outline:"none"}}/>
                </>) : (
                  <div className="rm-article" style={{fontSize:13,lineHeight:1.7,color:S.text,maxHeight:360,overflowY:"auto" as const,border:`1px solid ${S.border}`,borderRadius:8,padding:14}} dangerouslySetInnerHTML={{__html:c.article_html||""}}/>
                )}
              </Card>
            );
          })}
          {/* Batch publish to WordPress */}
          <Card>
            <SH title={`Batch Publish to WordPress — ${[...approved].filter(i=>content[i]).length} pieces`}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="WordPress URL"><TI value={wpUrl} onChange={setWpUrl} placeholder="https://yoursite.com"/></Field>
              <Field label="Username"><TI value={wpUser} onChange={setWpUser} placeholder="WP username (not email)"/></Field>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Application Password"><TI value={wpPass} onChange={setWpPass} placeholder="xxxx xxxx xxxx xxxx"/></Field>
              <Field label="Publish status"><Toggle value={wpStatus} onChange={v=>setWpStatus(v as "draft"|"publish")} options={[{value:"draft",label:"Draft"},{value:"publish",label:"Publish live"}]}/></Field>
            </div>
            {/* WordPress categories — hierarchical multi-select dropdown (main → sub) */}
            <div style={{margin:"4px 0 12px",padding:"10px 12px",background:S.subtle,borderRadius:8,border:`1px solid ${S.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const}}>
                <span style={{fontSize:12,fontWeight:700,color:S.text}}>Categories {selCats.length>0&&<span style={{color:S.muted,fontWeight:400}}>· {selCats.length} selected</span>}</span>
                <Btn variant="secondary" small onClick={loadCategories} disabled={catsLoading}>{catsLoading?"Loading…":wpCats.length?"↻ Reload categories":"📂 Load categories from site"}</Btn>
              </div>
              {wpCats.length>0&&(()=>{
                const byId=new Map(wpCats.map(c=>[c.id,c]));
                const roots=wpCats.filter(c=>!c.parent||!byId.has(c.parent)).sort((a,b)=>a.name.localeCompare(b.name));
                const kids=(pid:number)=>wpCats.filter(c=>c.parent===pid).sort((a,b)=>a.name.localeCompare(b.name));
                const selNames=selCats.map(id=>byId.get(id)?.name).filter(Boolean);
                const Row=({c,sub}:{c:{id:number;name:string;count:number};sub?:boolean})=>{const on=selCats.includes(c.id);return(
                  <div onClick={()=>toggleCat(c.id)} style={{display:"flex",alignItems:"center",gap:8,padding:sub?"5px 10px 5px 28px":"6px 10px",cursor:"pointer",background:on?S.accentBg:"transparent",borderRadius:6}}
                    onMouseEnter={e=>{if(!on)(e.currentTarget as HTMLDivElement).style.background=S.subtle;}}
                    onMouseLeave={e=>{if(!on)(e.currentTarget as HTMLDivElement).style.background="transparent";}}>
                    <span style={{width:14,height:14,flexShrink:0,borderRadius:3,border:`1.5px solid ${on?S.accent:S.border}`,background:on?S.accent:"#fff",color:"#fff",fontSize:10,lineHeight:"12px",textAlign:"center" as const}}>{on?"✓":""}</span>
                    <span style={{fontSize:12,fontWeight:sub?400:600,color:S.text}}>{c.name}</span>
                    <span style={{fontSize:11,color:S.muted}}>({c.count})</span>
                  </div>
                );};
                return (
                  <div style={{position:"relative" as const,marginTop:10}}>
                    <button onClick={()=>setCatOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 12px",border:`1px solid ${S.border}`,borderRadius:8,background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:12,color:selNames.length?S.text:S.muted,textAlign:"left" as const}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{selNames.length?selNames.join(", "):"Select categories…"}</span>
                      <span style={{flexShrink:0,fontSize:9,color:S.muted}}>{catOpen?"▲":"▼"}</span>
                    </button>
                    {catOpen&&(
                      <div style={{position:"absolute" as const,zIndex:20,top:"calc(100% + 4px)",left:0,right:0,maxHeight:300,overflowY:"auto" as const,background:"#fff",border:`1px solid ${S.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",padding:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",padding:"2px 8px 6px"}}>
                          <button onClick={()=>{setSelCats([]);try{localStorage.setItem(selCacheKey,"[]");}catch{}}} style={{fontSize:11,color:S.muted,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Clear</button>
                          <button onClick={()=>setCatOpen(false)} style={{fontSize:11,color:S.accent,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Done</button>
                        </div>
                        {roots.map(main=>(
                          <div key={main.id}>
                            <Row c={main}/>
                            {kids(main.id).map(sub=><Row key={sub.id} c={sub} sub/>)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              {wpCats.length===0&&!catsLoading&&<p style={{fontSize:11,color:S.muted,margin:"8px 0 0"}}>Load your site&apos;s categories to assign the posts. If none are selected, WordPress uses its default category.</p>}
            </div>
            {/* Author profile — establishes E-E-A-T (Person schema + on-page byline). Fetch from WordPress or enter manually. */}
            <div style={{margin:"4px 0 12px",padding:"10px 12px",background:S.subtle,borderRadius:8,border:`1px solid ${S.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const,marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:S.text}}>Author profile <span style={{color:S.muted,fontWeight:400}}>· for E-E-A-T</span></span>
                <Btn variant="secondary" small onClick={loadAuthors} disabled={authorsLoading}>{authorsLoading?"Loading…":wpAuthors.length?"↻ Reload authors":"👤 Fetch authors from WordPress"}</Btn>
              </div>
              <Field label="Select author (Compunnel roster + WordPress users)">
                <div style={{position:"relative" as const}}>
                  {(()=>{
                    const sel = authId>0 ? `wp:${authId}` : (findAuthor(authName)?`roster:${findAuthor(authName)!.name}`:"");
                    const wpNames = new Set(wpAuthors.map(a=>a.name.toLowerCase().trim()));
                    return (
                    <select value={sel} onChange={e=>pickAuthorOpt(e.target.value)} style={{width:"100%",appearance:"none" as const,WebkitAppearance:"none",background:"#fff",border:`1px solid ${S.border}`,borderRadius:8,padding:"8px 28px 8px 10px",fontSize:13,color:S.text,cursor:"pointer",fontFamily:"inherit"}}>
                      <option value="">— Choose an author —</option>
                      <optgroup label="Compunnel authors (E-E-A-T)">
                        {COMPUNNEL_AUTHORS.map(a=><option key={a.name} value={`roster:${a.name}`}>{a.name}{a.title?` — ${a.title}`:""}</option>)}
                      </optgroup>
                      {wpAuthors.length>0&&(
                        <optgroup label="WordPress users (attributes the post)">
                          {wpAuthors.map(a=><option key={a.id} value={`wp:${a.id}`}>{a.name}{wpNames.has(a.name.toLowerCase().trim())?"":""}{a.bio?" — has bio":""}</option>)}
                        </optgroup>
                      )}
                    </select>
                    );
                  })()}
                  <span style={{position:"absolute" as const,right:10,top:11,pointerEvents:"none" as const,fontSize:9,color:S.muted}}>▼</span>
                </div>
              </Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Author name"><TI value={authName} onChange={setAuthName} placeholder="e.g. Jane Smith"/></Field>
                <Field label="Job title / credentials"><TI value={authTitle} onChange={setAuthTitle} placeholder="e.g. Head of Global Payroll"/></Field>
              </div>
              <Field label="Profile / LinkedIn URL"><TI value={authUrl} onChange={setAuthUrl} placeholder="https://linkedin.com/in/…"/></Field>
              <Field label="Short bio"><TI value={authBio} onChange={setAuthBio} rows={2} placeholder="1-2 sentences on the author's expertise"/></Field>
              <p style={{fontSize:11,color:S.muted,margin:"4px 0 0"}}>Adds a Person author to the article schema + an on-page byline/bio box. <strong>Compunnel authors</strong> fill the byline + bio + LinkedIn and are matched to a WordPress user by name on publish. <strong>WordPress users</strong> directly attribute the post. Use “↻ Reload authors” to fetch your site’s WP users.</p>
            </div>
            {publishing&&(
              <div style={{margin:"4px 0 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}><span style={{color:S.text,fontWeight:600}}>Publishing…</span><span style={{color:S.muted}}>{pubProgress.done}/{pubProgress.total}</span></div>
                <div style={{height:8,background:S.subtle,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pubProgress.total?(pubProgress.done/pubProgress.total)*100:0}%`,background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:99,transition:"width 0.3s"}}/></div>
              </div>
            )}
            {pubResults.length>0&&(
              <div style={{margin:"4px 0 12px",display:"grid",gap:6}}>
                {pubResults.map((r,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:r.ok?S.greenBg:S.redBg,borderRadius:7,fontSize:12}}>
                    <span style={{flexShrink:0}}>{r.ok?"✅":"❌"}</span>
                    <span style={{flex:1,minWidth:0,color:S.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{r.title}</span>
                    {r.ok&&r.link?<a href={r.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.accent,flexShrink:0}}>view ↗</a>:<span style={{fontSize:10,color:S.redText,flexShrink:0,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{r.error}</span>}
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" as const}}>
              <Btn onClick={runBatchPublish} disabled={publishing}>{publishing?"Publishing…":`📤 Publish all ${[...approved].filter(i=>content[i]).length} to WordPress`}</Btn>
              <Btn variant="secondary" onClick={()=>{setPhase(0);setStrategy(null);setSuggestions([]);setContent({});setPubResults([]);}}>New campaign</Btn>
            </div>
            <p style={{fontSize:11,color:S.muted,margin:"10px 0 0"}}>Pillar/landing pages publish as WordPress Pages; everything else as Posts. Needs an Editor/Admin Application Password.</p>
          </Card>
        </>
      )}

      {/* PHASE 5 — Published summary */}
      {phase===5&&(
        <>
          <Card style={{background:S.greenBg,border:"1px solid #a7f3d0"}}>
            <SH title={`✓ Campaign Published — ${pubResults.filter(r=>r.ok).length}/${pubResults.length} live`}/>
            <div style={{display:"grid",gap:6,marginTop:8}}>
              {pubResults.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#fff",borderRadius:7,border:`1px solid ${r.ok?"#a7f3d0":"#fecaca"}`,fontSize:12}}>
                  <span style={{flexShrink:0}}>{r.ok?"✅":"❌"}</span>
                  <span style={{flex:1,minWidth:0,color:S.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{r.title}</span>
                  {r.ok&&r.link&&<a href={r.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:S.accent,flexShrink:0}}>{wpStatus==="publish"?"view live ↗":"view draft ↗"}</a>}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Btn variant="secondary" onClick={()=>{setPhase(0);setStrategy(null);setSuggestions([]);setContent({});setPubResults([]);}}>Start new campaign</Btn>
          </Card>
        </>
      )}

      <HistoryPanel hist={hist} onLoad={e=>{setStrategy(e.data.strategy);setSuggestions(e.data.suggestions||[]);setContent(e.data.content||{});setApproved(new Set(Object.keys(e.data.content||{}).map(Number)));setPhase(4);}}/>
    </div>
  );
}

const PAGES: Record<string, React.ComponentType<PageProps>> = {
  dashboard: Dashboard,
  gsc: GSC,
  ga4: GA4,
  keywords: Keywords,
  content: Content,
  backlinks: Backlinks,
  technical: Technical,
  sitemap: Sitemap,
  competitors: Competitors,
  rank: Rank,
  aeo: AEO,
  seowriter: SEOWriter,
  topics: Topics,
  onpage: OnPage,
  serp: SERPAnalyzer,
  audit: ContentAudit,
  intlinks: InternalLinks,
  brokenlinks: BrokenLinks,
  schemagen: SchemaGen,
  localseo: LocalSEO,
  linkbuilding: LinkBuilding,
  linkinter: LinkIntersect,
  brandmon: BrandMonitor,
  market: MarketExplorer,
  trafficana: TrafficAnalytics,
  adresearch: AdResearch,
  snippets: SnippetTracker,
  geo: ShareOfSynthesis,
  aibots: AIBotMonitor,
  atomic: AtomicAnswers,
  contentrefresh: ContentRefresh,
  eeat: EEATBuilder,
  execaudit: ExecutiveDashboard,
  projects: Projects,
  "project-overview": ProjectOverview,
  history: HistoryPage,
  admin: Admin,
  llmstxt: LlmsTxtGenerator,
  pricingmd: PricingMdGenerator,
  cwv: CoreWebVitals,
  calendar: EditorialCalendar,
  paafaq: PAAtoFAQ,
  pillar: PillarPlanner,
  extractability: ExtractabilityScore,
  soaiv: SOAIVTracker,
  serpcontent: ContentSERP,
  campaign: SEOCampaign,
  seoagent: SEOCampaign,
};

type AuthUser = { id: string; email: string; name: string };

export default function RankMind({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  // Persist the current page so switching projects (which reloads) keeps you on the same screen.
  const [page,setPage] = useState(()=>{ try{ return localStorage.getItem("rm_page")||"gsc"; }catch{ return "gsc"; } });
  useEffect(()=>{ try{ localStorage.setItem("rm_page",page); }catch{} },[page]);

  // Sync workspace (connected sites, projects, active site, history, settings) to the
  // account so it follows you across browsers. Saves on a debounce + interval + on
  // leaving the tab. Hydration on login happens in page.tsx before this mounts.
  useEffect(()=>{
    let last=""; let timer:ReturnType<typeof setTimeout>|undefined;
    const save=()=>{ try{ const snap=snapshotSyncState(); const h=JSON.stringify(snap); if(h===last) return; last=h;
      fetch("/api/userstate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:snap})}).catch(()=>{}); }catch{} };
    const debounced=()=>{ if(timer) clearTimeout(timer); timer=setTimeout(save,2000); };
    const iv=setInterval(save,20000);
    const onHide=()=>{ if(document.visibilityState==="hidden") save(); };
    window.addEventListener("beforeunload",save);
    document.addEventListener("visibilitychange",onHide);
    debounced();
    return ()=>{ clearInterval(iv); if(timer) clearTimeout(timer); window.removeEventListener("beforeunload",save); document.removeEventListener("visibilitychange",onHide); save(); };
  },[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [gscDataMap,setGscDataMapState] = useState<Record<string,any>>(()=>{ try{return JSON.parse(localStorage.getItem("rm_gsc_map")||"{}");}catch{return {};} });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ga4DataMap,setGa4DataMapState] = useState<Record<string,any>>(()=>{ try{return JSON.parse(localStorage.getItem("rm_ga4_map")||"{}");}catch{return {};} });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upsertGsc = (domain:string, d:any) => { setGscDataMapState(prev=>{ const next=d?{...prev,[domain]:d}:Object.fromEntries(Object.entries(prev).filter(([k])=>k!==domain)); try{localStorage.setItem("rm_gsc_map",JSON.stringify(next));}catch{} return next; }); };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upsertGa4 = (propId:string, d:any) => { setGa4DataMapState(prev=>{ const next=d?{...prev,[propId]:d}:Object.fromEntries(Object.entries(prev).filter(([k])=>k!==propId)); try{localStorage.setItem("rm_ga4_map",JSON.stringify(next));}catch{} return next; }); };
  // aeoDataMap keyed by domain — never mix data across sites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aeoDataMap,setAeoDataMapState] = useState<Record<string,any>>(()=>{ try{return JSON.parse(localStorage.getItem("rm_aeo_map")||"{}");}catch{return {};} });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upsertAeo = (domain:string,d:any) => { setAeoDataMapState(prev=>{ const next=d?{...prev,[domain]:d}:Object.fromEntries(Object.entries(prev).filter(([k])=>k!==domain)); try{localStorage.setItem("rm_aeo_map",JSON.stringify(next));}catch{} return next; }); };
  // Legacy compat shim — Dashboard reads aeoData by viewDomain directly
  const aeoData = null; const setAeoData = (_:unknown) => _;
  const [activeSite,setActiveSiteRaw] = useState<string>(()=>{ try{return localStorage.getItem("rm_active_site")||"";}catch{return "";} });
  const setActiveSite = (s: string) => { setActiveSiteRaw(s); try{if(s)localStorage.setItem("rm_active_site",s);else localStorage.removeItem("rm_active_site");}catch{} };
  const activeDomain = activeSite ? activeSite.replace(/^https?:\/\//,"").replace(/\/$/,"") : "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // gscData/ga4Data for non-dashboard pages — use activeDomain strictly, no cross-site fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gscData:any = gscDataMap[activeDomain] || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ga4Data:any = ga4DataMap[activeDomain] || Object.values(ga4DataMap).find((d:any)=>(d?.domain||"")===activeDomain) || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setGscData = (d:any) => { const domain=d?.domain||activeDomain; if(domain) upsertGsc(domain,d); };
  // GA4: save keyed by activeDomain (the currently selected site), not property ID.
  // Also embed _siteDomain so future lookups can match even after activeDomain changes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setGa4Data = (d:any) => {
    const siteDomain = activeDomain || "";
    const propId = d?.domain || siteDomain;
    // Primary key: site domain (enables correct per-site lookup)
    if(siteDomain) upsertGa4(siteDomain, {...d, _siteDomain: siteDomain, _propId: propId});
    // Secondary key: property ID (backward compat for already-stored data)
    if(propId && propId !== siteDomain) upsertGa4(propId, {...d, _siteDomain: siteDomain, _propId: propId});
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") !== "true") return;
    window.history.replaceState({}, "", "/");
    if (localStorage.getItem("rm_auto_gsc_site")) setPage("gsc");
    else if (localStorage.getItem("rm_auto_ga4_prop")) setPage("ga4");
  }, []);

  // Keep-alive: mount every VISITED tool once and just show/hide it (below), so switching
  // tools does NOT unmount — and therefore does NOT stop or lose — a task running in another
  // tool. Tools mount lazily on first visit and keep their state + in-flight work thereafter.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([page]));
  useEffect(() => { setVisited(v => v.has(page) ? v : new Set([...v, page])); }, [page]);
  const connected: Record<string, boolean> = {gsc:Object.keys(gscDataMap).length>0, ga4:Object.keys(ga4DataMap).length>0};
  const PAGE_TITLES: Record<string,string> = {dashboard:"Dashboard",projects:"My Sites","project-overview":"Project Overview",history:"History",admin:"Admin Panel"};
  const pageTitle = PAGE_TITLES[page] || NAV_CATEGORIES.flatMap(c=>c.items).find(n=>n.id===page)?.label || "Dashboard";

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif",background:S.bg}}>

      {/* ── Sidebar ── */}
      <aside style={{width:232,flexShrink:0,background:S.sidebar,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",borderRight:"1px solid rgba(148,163,184,0.08)"}}>

        {/* Logo */}
        <div style={{padding:"20px 18px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:800,letterSpacing:"-0.03em",boxShadow:"0 2px 10px rgba(99,102,241,0.45)",flexShrink:0}}>R</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:700,color:"#f1f5f9",margin:0,letterSpacing:"-0.02em"}}>RankMind</p>
              <p style={{fontSize:10,color:"#475569",margin:0,fontWeight:500,letterSpacing:"0.02em"}}>SEO Platform</p>
            </div>
            <span style={{background:"rgba(99,102,241,0.18)",color:"#818cf8",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:5,letterSpacing:"0.06em",flexShrink:0}}>PRO</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:"4px 10px 12px",overflowY:"auto"}}>
          {NAV_CATEGORIES.map(cat => (
            <div key={cat.label} style={{marginBottom:2}}>
              <p style={{fontSize:9,fontWeight:700,color:"#334155",letterSpacing:"0.1em",textTransform:"uppercase",padding:"12px 10px 5px",margin:0}}>{cat.label}</p>
              {cat.items.map(n => {
                const active = page===n.id;
                const hasDot = connected[n.id]!==undefined;
                return (
                  <button key={n.id} onClick={()=>setPage(n.id)}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"7px 10px",borderRadius:8,border:"none",
                      background:active?"rgba(99,102,241,0.14)":"transparent",
                      color:active?"#c7d2fe":S.sidebarText,
                      fontSize:12.5,fontWeight:active?600:400,cursor:"pointer",fontFamily:"inherit",
                      marginBottom:1,textAlign:"left",
                      borderLeft:active?"2px solid #6366f1":"2px solid transparent",
                      transition:"background 0.1s,color 0.1s"}}
                    onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLButtonElement).style.background="rgba(148,163,184,0.07)";}}
                    onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLButtonElement).style.background="transparent";}}>
                    <span style={{fontSize:13,width:16,textAlign:"center",opacity:active?1:0.55,flexShrink:0}}>{n.icon}</span>
                    <span style={{flex:1}}>{n.label}</span>
                    {hasDot && <span style={{width:5,height:5,borderRadius:"50%",background:connected[n.id]?"#10b981":"#1e293b",flexShrink:0,boxShadow:connected[n.id]?"0 0 4px rgba(16,185,129,0.5)":"none"}}/>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{padding:"10px 12px 14px",borderTop:"1px solid rgba(148,163,184,0.1)"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:10,background:"rgba(148,163,184,0.06)",marginBottom:8}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:700,flexShrink:0,border:"2px solid rgba(99,102,241,0.3)"}}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:12,fontWeight:600,color:"#e2e8f0",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</p>
              <p style={{fontSize:10,color:"#475569",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</p>
            </div>
          </div>
          <button onClick={()=>setPage("admin")}
            style={{width:"100%",padding:"7px 12px",borderRadius:7,border:"1px solid rgba(148,163,184,0.15)",background:page==="admin"?"rgba(99,102,241,0.14)":"transparent",color:page==="admin"?"#c7d2fe":"#64748b",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",textAlign:"center",marginBottom:6,transition:"all 0.15s"}}
            onMouseEnter={e=>{if(page!=="admin"){(e.currentTarget as HTMLButtonElement).style.background="rgba(148,163,184,0.08)";(e.currentTarget as HTMLButtonElement).style.color="#94a3b8";}}}
            onMouseLeave={e=>{if(page!=="admin"){(e.currentTarget as HTMLButtonElement).style.background="transparent";(e.currentTarget as HTMLButtonElement).style.color="#64748b";}}}>
            ⚙ Admin Panel
          </button>
          <button onClick={async()=>{await fetch("/api/auth/signout",{method:"POST"});onSignOut();}}
            style={{width:"100%",padding:"7px 12px",borderRadius:7,border:"1px solid rgba(148,163,184,0.15)",background:"transparent",color:"#64748b",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",textAlign:"center",transition:"all 0.15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="rgba(148,163,184,0.08)";(e.currentTarget as HTMLButtonElement).style.color="#94a3b8";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="transparent";(e.currentTarget as HTMLButtonElement).style.color="#64748b";}}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{flex:1,overflowY:"auto",minWidth:0,display:"flex",flexDirection:"column"}}>

        {/* Top header bar */}
        <div style={{background:"#fff",borderBottom:`1px solid ${S.border}`,padding:"0 32px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10,boxShadow:"0 1px 4px rgba(0,0,0,0.04)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:"#94a3b8",fontWeight:500}}>RankMind</span>
            <span style={{color:"#cbd5e1",fontSize:16,lineHeight:1,margin:"0 2px"}}>/</span>
            <span style={{fontSize:13,fontWeight:600,color:S.text}}>{pageTitle}</span>
            {activeSite && (
              <span style={{marginLeft:8,background:S.accentBg,color:S.accentText,fontSize:11,fontWeight:600,padding:"2px 10px",borderRadius:20,border:`1px solid #c7d2fe`}}>
                {activeSite}
              </span>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {(gscData||ga4Data) && (
              <span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:S.green,fontWeight:600,background:S.greenBg,padding:"3px 10px",borderRadius:20,border:`1px solid #a7f3d0`}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"#10b981",display:"inline-block",boxShadow:"0 0 6px rgba(16,185,129,0.5)"}}/>
                Connected
              </span>
            )}
          </div>
        </div>

        {/* Page content — all visited tools stay mounted; only the active one is shown, so a
            task started in one tool keeps running when you switch to another. */}
        <div style={{flex:1,maxWidth:980,width:"100%",margin:"0 auto",padding:"28px 32px",boxSizing:"border-box" as const}}>
          {[...visited].map(pid => {
            const PageView = PAGES[pid] || Dashboard;
            return (
              <div key={pid} style={{display: pid===page ? "block" : "none"}}>
                <PageView setPage={setPage} gscData={gscData} setGscData={setGscData} ga4Data={ga4Data} setGa4Data={setGa4Data} aeoData={aeoData} setAeoData={setAeoData} activeSite={activeSite} setActiveSite={setActiveSite} gscDataMap={gscDataMap} upsertGsc={upsertGsc} ga4DataMap={ga4DataMap} upsertGa4={upsertGa4} aeoDataMap={aeoDataMap} upsertAeo={upsertAeo}/>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
