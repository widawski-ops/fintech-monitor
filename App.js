import { useState, useEffect, useRef, useCallback } from "react";

const PL_STAGES = [
  { id: "konsultacje", label: "Konsultacje",       short: "KONS",     color: "#6366f1" },
  { id: "projekt",     label: "Projekt rządowy",   short: "PROJ",     color: "#8b5cf6" },
  { id: "sejm1",       label: "Sejm I czytanie",   short: "SEJM I",   color: "#3b82f6" },
  { id: "komisja",     label: "Komisja sejmowa",   short: "KOM",      color: "#06b6d4" },
  { id: "sejm3",       label: "Sejm III czytanie", short: "SEJM III", color: "#0ea5e9" },
  { id: "senat",       label: "Senat RP",          short: "SENAT",    color: "#f59e0b" },
  { id: "podpisana",   label: "Dz.U. / Podpisana", short: "DZ.U",     color: "#22c55e" },
];
const EU_STAGES = [
  { id: "konsultacje",  label: "Konsultacje KE",     short: "KONS",  color: "#6366f1" },
  { id: "proposal",     label: "Wniosek KE",         short: "KE",    color: "#8b5cf6" },
  { id: "parlament",    label: "Parlament EU",        short: "PE",    color: "#3b82f6" },
  { id: "trilog",       label: "Trilog",             short: "TRI",   color: "#06b6d4" },
  { id: "przyjeta",     label: "Przyjęta",           short: "PRZYJ", color: "#f59e0b" },
  { id: "transpozycja", label: "Transpozycja do PL", short: "TRANS", color: "#f97316" },
  { id: "obowiazuje",   label: "Obowiązuje",         short: "OBO",   color: "#22c55e" },
];
const TOPICS = [
  { id: "all",         label: "Wszystkie",    icon: "⚡" },
  { id: "payments",    label: "Płatności",    icon: "💳" },
  { id: "crypto",      label: "Krypto/DeFi",  icon: "₿"  },
  { id: "aml",         label: "AML/KYC",      icon: "🔒" },
  { id: "lending",     label: "Kredyt",       icon: "🏦" },
  { id: "openbanking", label: "Open Banking", icon: "🔗" },
  { id: "ai",          label: "AI/Dane",      icon: "🤖" },
  { id: "dora",        label: "Cyber/DORA",   icon: "🛡️" },
];
const UM = {
  high:   { l: "Pilne",    c: "#ef4444" },
  medium: { l: "Ważne",    c: "#f59e0b" },
  low:    { l: "Rutynowe", c: "#22c55e" },
};

const getStages   = r => r === "PL" ? PL_STAGES : EU_STAGES;
const getStageIdx = (r, id) => getStages(r).findIndex(s => s.id === id);
const getStageObj = (r, id) => getStages(r).find(s => s.id === id) || getStages(r)[0];
const daysSince   = d => { if (!d) return null; const n = Math.floor((Date.now() - new Date(d)) / 86400000); return isNaN(n) ? null : n; };
const daysUntil   = d => { if (!d) return null; const n = Math.floor((new Date(d) - Date.now()) / 86400000); return isNaN(n) ? null : n; };
const fmtDate     = d => d ? new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" }) : "—";
const uid         = () => Math.random().toString(36).slice(2, 8);

const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY || "";

const SYS = `Jesteś ekspertem regulacji finansowych fintech PL i EU. Odpowiadasz TYLKO jako JSON tablica, zero markdown, zero komentarzy.
Schemat każdego obiektu:
{"id":"kebab-case","title":"pełna nazwa aktu","shortTitle":"max 4 słowa","region":"PL|EU","topic":"payments|crypto|aml|lending|openbanking|ai|dora","icon":"emoji","stage":"id_etapu","stageChangedAt":"YYYY-MM-DD","deadline":"YYYY-MM-DD|null","urgency":"high|medium|low","summary":"2-3 zdania o treści","impact":"konkretny wpływ na fintech","nextStep":"następny krok i kiedy","source":"organ/instytucja"}
Etapy PL: konsultacje|projekt|sejm1|komisja|sejm3|senat|podpisana
Etapy EU: konsultacje|proposal|parlament|trilog|przyjeta|transpozycja|obowiazuje
Zwróć 10-12 rzeczywistych, aktualnych projektów. Dzisiaj: ${new Date().toISOString().split("T")[0]}.`;

export default function App() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [topic,      setTopic]      = useState("all");
  const [region,     setRegion]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [view,       setView]       = useState("list");
  const [notes,      setNotes]      = useState({});
  const [alerts,     setAlerts]     = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [lastUp,     setLastUp]     = useState(null);
  const [error,      setError]      = useState(null);
  const [apiKey,     setApiKey]     = useState(API_KEY);
  const [showKeyInput, setShowKeyInput] = useState(!API_KEY);
  const prev = useRef({});

  const load = useCallback(async (key) => {
    const k = key || apiKey;
    if (!k) { setShowKeyInput(true); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": k, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: SYS,
          messages: [{ role: "user", content: `Pobierz aktualne projekty legislacyjne fintech ${region !== "all" ? `tylko ${region}` : "PL i EU"} ${topic !== "all" ? `kategoria ${topic}` : ""}.` }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const txt = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      const cl = txt.replace(/```json|```/g, "").trim();
      const s = cl.indexOf("["), e = cl.lastIndexOf("]") + 1;
      const parsed = JSON.parse(cl.slice(s, e));
      const newA = [];
      parsed.forEach(item => {
        const p = prev.current[item.id];
        if (p && p.stage !== item.stage) {
          newA.push({ id: uid(), itemId: item.id, icon: item.icon, title: item.shortTitle, msg: `${getStageObj(item.region, p.stage).label} → ${getStageObj(item.region, item.stage).label}` });
        }
      });
      if (newA.length) setAlerts(a => [...newA, ...a].slice(0, 20));
      const m = {}; parsed.forEach(i => { m[i.id] = i; }); prev.current = m;
      setItems(parsed); setLastUp(new Date());
      if (parsed.length > 0) setSelected(parsed[0]);
    } catch (e) {
      setError("Błąd: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [region, topic, apiKey]);

  useEffect(() => { if (apiKey) load(); }, [region, topic]);

  const filtered = items.filter(i =>
    !search || i.title?.toLowerCase().includes(search.toLowerCase()) || i.shortTitle?.toLowerCase().includes(search.toLowerCase())
  );
  const urgent = filtered.filter(i => i.urgency === "high");
  const kanbanStages = region === "EU" ? EU_STAGES : PL_STAGES;

  const exportPDF = () => {
    const now = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
    const rows = filtered.map(i => {
      const st = getStageObj(i.region, i.stage);
      return `<tr><td>${i.icon} ${i.title}</td><td style="color:${i.region === "PL" ? "#1d4ed8" : "#7c3aed"};font-weight:700">${i.region}</td><td>${st.label}</td><td style="color:${UM[i.urgency]?.c}">${UM[i.urgency]?.l || ""}</td><td>${i.deadline ? fmtDate(i.deadline) : "—"}</td><td style="color:#666;font-size:11px">${notes[i.id] || "—"}</td></tr>`;
    }).join("");
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Raport — Fintech Poland</title>
    <style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:20px;margin-bottom:4px}.sub{color:#64748b;font-size:12px;margin-bottom:22px}
    table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;border-bottom:2px solid #e2e8f0}
    td{padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:12.5px;vertical-align:top}
    .stats{display:flex;gap:20px;margin-bottom:22px;padding:14px 20px;background:#f8fafc;border-radius:8px}
    .sv{font-size:22px;font-weight:700;color:#1d4ed8}.sl{font-size:10px;color:#94a3b8;text-transform:uppercase}</style></head><body>
    <h1>⚖️ Monitor Legislacyjny</h1><div class="sub">Fintech Poland · ${now} · ${filtered.length} projektów</div>
    <div class="stats">
      <div><div class="sv">${filtered.length}</div><div class="sl">Projekty</div></div>
      <div><div class="sv">${urgent.length}</div><div class="sl">Pilne</div></div>
      <div><div class="sv">${filtered.filter(i => i.region === "PL").length}</div><div class="sl">Polska</div></div>
      <div><div class="sv">${filtered.filter(i => i.region === "EU").length}</div><div class="sl">UE</div></div>
    </div>
    <table><thead><tr><th>Projekt</th><th>Region</th><th>Etap</th><th>Priorytet</th><th>Termin</th><th>Notatki</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:28px;color:#94a3b8;font-size:11px;text-align:center">Fintech Poland · Monitor Legislacyjny · AI-powered</p>
    </body></html>`);
    w.document.close(); setTimeout(() => w.print(), 500);
  };

  // ── API KEY SCREEN ──
  if (showKeyInput) return (
    <div style={{ minHeight: "100vh", background: "#040b16", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: "#060d1c", border: "1px solid #1a2744", borderRadius: 16, padding: "40px 36px", maxWidth: 420, width: "90%" }}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>⚖️</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3b82f6", letterSpacing: "0.15em", textAlign: "center", marginBottom: 6 }}>FINTECH POLAND</div>
        <h1 style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Monitor Legislacyjny</h1>
        <p style={{ color: "#475569", fontSize: 13, textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
          Podaj klucz API Anthropic aby uruchomić wyszukiwanie legislacyjne zasilane AI.
        </p>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Klucz API (z console.anthropic.com)</div>
          <input
            type="password"
            placeholder="sk-ant-..."
            onChange={e => setApiKey(e.target.value)}
            style={{ width: "100%", background: "#09111f", border: "1px solid #1a2744", borderRadius: 8, color: "#dde8f8", padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "monospace" }}
          />
        </div>
        <button onClick={() => { setShowKeyInput(false); load(apiKey); }} style={{ width: "100%", background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", border: "none", borderRadius: 8, color: "white", padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
          Uruchom Dashboard →
        </button>
        <p style={{ color: "#1e2d4a", fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          Klucz jest przechowywany tylko lokalnie w przeglądarce.<br />
          Nie masz klucza? Zdobądź go na <span style={{ color: "#3b82f6" }}>console.anthropic.com</span>
        </p>
      </div>
    </div>
  );

  // ── MAIN DASHBOARD ──
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#040b16", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#dde8f8", overflow: "hidden" }}>
      <style>{`
        @keyframes fu { from { opacity:0; transform:translateY(5px) } to { opacity:1; transform:translateY(0) } }
        @keyframes sr { from { opacity:0; transform:translateX(8px) } to { opacity:1; transform:translateX(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        * { box-sizing:border-box; margin:0; padding:0 }
        ::-webkit-scrollbar { width:4px; height:4px }
        ::-webkit-scrollbar-thumb { background:#1a2744; border-radius:3px }
        .hov:hover { background:#0d1f38 !important }
        button { cursor:pointer; transition:opacity .15s }
        button:hover { opacity:.75 }
        input::placeholder, textarea::placeholder { color:#1a2744 }
        textarea:focus, input:focus { border-color:#2563eb !important; outline:none }
      `}</style>

      {/* TOPBAR */}
      <div style={{ background: "#060d1c", borderBottom: "1px solid #0c1828", padding: "0 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, position: "relative" }}>
              ⚖️
              <div style={{ position: "absolute", bottom: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: loading ? "#f59e0b" : "#22c55e", border: "2px solid #060d1c", animation: loading ? "pulse 1s infinite" : "none" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: "#3b82f6", letterSpacing: "0.15em" }}>FINTECH POLAND</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Monitor Legislacyjny</div>
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "#0c1828", margin: "0 4px" }} />

          {items.length > 0 && [
            { v: items.length, l: "Projekty", c: "#60a5fa" },
            { v: urgent.length, l: "Pilne", c: "#f87171" },
            { v: items.filter(i => i.region === "PL").length, l: "PL", c: "#818cf8" },
            { v: items.filter(i => i.region === "EU").length, l: "EU", c: "#a78bfa" },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 7, color: "#1a2744", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.l}</div>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 szukaj projektu..."
            style={{ background: "#09111f", border: "1px solid #0c1828", borderRadius: 6, color: "#dde8f8", padding: "5px 10px", fontSize: 11, width: 160 }} />

          <div style={{ display: "flex", gap: 2, background: "#09111f", borderRadius: 6, padding: 2, border: "1px solid #0c1828" }}>
            {["all", "PL", "EU"].map(r => (
              <button key={r} onClick={() => setRegion(r)} style={{ background: region === r ? "#1a2744" : "transparent", border: "none", borderRadius: 4, color: region === r ? "#dde8f8" : "#334155", padding: "3px 8px", fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>
                {r === "all" ? "ALL" : r}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 2, background: "#09111f", borderRadius: 6, padding: 2, border: "1px solid #0c1828" }}>
            {[["list", "☰"], ["kanban", "⊞"]].map(([v, ic]) => (
              <button key={v} onClick={() => setView(v)} style={{ background: view === v ? "#1a2744" : "transparent", border: "none", borderRadius: 4, color: view === v ? "#dde8f8" : "#334155", padding: "3px 8px", fontSize: 13 }}>
                {ic}
              </button>
            ))}
          </div>

          <button onClick={() => setAlertsOpen(o => !o)} style={{ position: "relative", background: alerts.length ? "#100a00" : "#09111f", border: `1px solid ${alerts.length ? "#92400e55" : "#0c1828"}`, borderRadius: 6, color: alerts.length ? "#f59e0b" : "#334155", padding: "5px 10px", fontSize: 13 }}>
            🔔
            {alerts.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{alerts.length > 9 ? "9+" : alerts.length}</span>}
          </button>

          <button onClick={exportPDF} style={{ background: "#041009", border: "1px solid #14532d44", borderRadius: 6, color: "#22c55e", padding: "5px 10px", fontSize: 10, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>↓ PDF</button>

          <button onClick={() => load()} disabled={loading} style={{ background: "#09111f", border: "1px solid #0c1828", borderRadius: 6, color: "#334155", padding: "5px 10px", fontSize: 13 }}>
            <span style={{ display: "inline-block", animation: loading ? "spin .7s linear infinite" : "none" }}>↻</span>
          </button>

          {lastUp && <div style={{ fontSize: 8, color: "#1a2744", fontFamily: "'Space Mono', monospace" }}>{lastUp.toLocaleTimeString("pl-PL")}</div>}
        </div>

        {/* Topics */}
        <div style={{ display: "flex", gap: 3, paddingBottom: 8, overflowX: "auto" }}>
          {TOPICS.map(t => (
            <button key={t.id} onClick={() => setTopic(t.id)} style={{ background: topic === t.id ? "#1a2744" : "transparent", border: `1px solid ${topic === t.id ? "#2563eb44" : "#0c1828"}`, borderRadius: 5, color: topic === t.id ? "#93c5fd" : "#334155", padding: "3px 10px", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ALERTS DROPDOWN */}
      {alertsOpen && (
        <div style={{ position: "fixed", top: 58, right: 14, width: 300, background: "#060d1c", border: "1px solid #1a2744", borderRadius: 10, zIndex: 100, padding: "12px", boxShadow: "0 20px 60px #000000aa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 8, color: "#f59e0b", fontFamily: "'Space Mono', monospace", letterSpacing: "0.12em" }}>🔔 ALERTY LEGISLACYJNE</div>
            <div style={{ display: "flex", gap: 8 }}>
              {alerts.length > 0 && <button onClick={() => setAlerts([])} style={{ background: "none", border: "none", color: "#334155", fontSize: 10 }}>Wyczyść</button>}
              <button onClick={() => setAlertsOpen(false)} style={{ background: "none", border: "none", color: "#334155", fontSize: 15 }}>×</button>
            </div>
          </div>
          {alerts.length === 0
            ? <div style={{ textAlign: "center", padding: "18px", color: "#1a2744", fontSize: 12 }}>Brak alertów</div>
            : alerts.slice(0, 6).map(a => (
              <div key={a.id} style={{ display: "flex", gap: 8, padding: "8px 10px", background: "#09111f", borderRadius: 7, marginBottom: 5, border: "1px solid #1a2744" }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fbbf24", fontWeight: 600, fontSize: 11 }}>{a.title}</div>
                  <div style={{ color: "#475569", fontSize: 10, marginTop: 1 }}>{a.msg}</div>
                </div>
                <button onClick={() => setAlerts(al => al.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", color: "#334155", fontSize: 13 }}>×</button>
              </div>
            ))
          }
        </div>
      )}

      {/* URGENT BANNER */}
      {!loading && urgent.length > 0 && (
        <div style={{ background: "#0e0508", borderBottom: "1px solid #7f1d1d22", padding: "4px 14px", display: "flex", gap: 7, alignItems: "center", overflowX: "auto", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: "#ef4444", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>⚠ PILNE</span>
          {urgent.map(i => (
            <button key={i.id} onClick={() => { setSelected(i); setView("list"); }} style={{ background: "#180508", border: "1px solid #7f1d1d33", borderRadius: 5, color: "#fca5a5", padding: "2px 8px", fontSize: 10, whiteSpace: "nowrap" }}>
              {i.icon} {i.shortTitle}
            </button>
          ))}
        </div>
      )}

      {/* MAIN */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, border: "3px solid #0c1828", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <div style={{ color: "#1a2744", fontSize: 13 }}>Przeszukuję źródła legislacyjne...</div>
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#0e0508", border: "1px solid #7f1d1d", borderRadius: 12, padding: "24px 28px", color: "#fca5a5", textAlign: "center", maxWidth: 360 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>{error}</div>
            <button onClick={() => load()} style={{ background: "#3b82f6", border: "none", borderRadius: 6, color: "white", padding: "8px 20px", fontSize: 12, fontWeight: 600 }}>Spróbuj ponownie</button>
            <button onClick={() => setShowKeyInput(true)} style={{ display: "block", width: "100%", marginTop: 8, background: "transparent", border: "1px solid #334155", borderRadius: 6, color: "#64748b", padding: "8px 20px", fontSize: 12 }}>Zmień klucz API</button>
          </div>
        </div>
      ) : view === "list" ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* LIST */}
          <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid #0c1828", overflowY: "auto", padding: "8px" }}>
            {filtered.length === 0
              ? <div style={{ textAlign: "center", padding: "40px", color: "#1a2744", fontSize: 12 }}>Brak wyników</div>
              : filtered.map(item => {
                const st = getStageObj(item.region, item.stage);
                const ds = daysSince(item.stageChangedAt);
                const um = UM[item.urgency] || UM.low;
                const sel = selected?.id === item.id;
                return (
                  <div key={item.id} className="hov" onClick={() => setSelected(item)}
                    style={{ background: sel ? "#0d1f3c" : "#080f1c", border: `1px solid ${sel ? st.color + "66" : "#111d30"}`, borderLeft: `3px solid ${st.color}`, borderRadius: 9, padding: "10px 12px", cursor: "pointer", marginBottom: 5, transition: "all .18s", animation: "fu .3s ease both" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 4 }}>
                          {[
                            [item.region, item.region === "PL" ? "#60a5fa" : "#a78bfa"],
                            [st.short, st.color],
                            [um.l, um.c],
                          ].map(([label, color]) => (
                            <span key={label} style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: color + "1a", color, border: `1px solid ${color}33`, fontFamily: "monospace" }}>{label}</span>
                          ))}
                          {item.deadline && (() => { const d = daysUntil(item.deadline); if (d === null) return null; const c = d < 0 ? "#64748b" : d < 30 ? "#ef4444" : d < 90 ? "#f59e0b" : "#22c55e"; return <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: c + "1a", color: c, border: `1px solid ${c}33`, fontFamily: "monospace" }}>{d < 0 ? "MINĄŁ" : d + "d"} ⏱</span>; })()}
                        </div>
                        <div style={{ color: "#dde8f8", fontWeight: 600, fontSize: 12, lineHeight: 1.4, marginBottom: 2 }}>{item.shortTitle}</div>
                        <div style={{ color: "#2d3f58", fontSize: 10 }}>{item.source}{ds !== null && <span style={{ color: ds > 45 ? "#1e2d4a" : "#f59e0b" }}> · {ds}d</span>}</div>
                        <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
                          {getStages(item.region).map((s, i) => { const idx = getStageIdx(item.region, item.stage); return <div key={s.id} style={{ flex: 1, height: i === idx ? 4 : 2, borderRadius: 2, background: i <= idx ? s.color : "#1a2744", boxShadow: i === idx ? `0 0 6px ${s.color}99` : "none" }} />; })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* DETAIL */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {!selected ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ fontSize: 48 }}>⚖️</div>
                <div style={{ color: "#111d30", fontSize: 12, textAlign: "center", lineHeight: 1.8 }}>Wybierz projekt<br />aby zobaczyć szczegóły</div>
              </div>
            ) : <DetailView item={selected} notes={notes} setNotes={setNotes} />}
          </div>
        </div>
      ) : (
        /* KANBAN */
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", display: "flex" }}>
          {kanbanStages.map(stage => {
            const col = filtered.filter(i => i.stage === stage.id && (region === "all" || i.region === region));
            return (
              <div key={stage.id} style={{ minWidth: 180, maxWidth: 200, flexShrink: 0, borderRight: "1px solid #0c1828", display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ padding: "9px 12px", background: "#060d1c", borderBottom: "1px solid #0c1828", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: stage.color, boxShadow: `0 0 6px ${stage.color}` }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: stage.color, fontFamily: "monospace", letterSpacing: "0.08em" }}>{stage.short}</span>
                  </div>
                  <div style={{ fontSize: 9, color: "#1a2744", marginBottom: 3 }}>{stage.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: col.length ? "#dde8f8" : "#1a2744" }}>{col.length}</div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
                  {col.map(item => (
                    <div key={item.id} className="hov" onClick={() => { setSelected(item); setView("list"); }}
                      style={{ background: "#080f1c", border: "1px solid #111d30", borderLeft: `3px solid ${stage.color}`, borderRadius: 7, padding: "9px 10px", cursor: "pointer", marginBottom: 5, animation: "fu .3s ease both" }}>
                      <div style={{ display: "flex", gap: 3, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: (item.region === "PL" ? "#60a5fa" : "#a78bfa") + "1a", color: item.region === "PL" ? "#60a5fa" : "#a78bfa", fontFamily: "monospace" }}>{item.region}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: (UM[item.urgency]?.c || "#22c55e") + "1a", color: UM[item.urgency]?.c || "#22c55e", fontFamily: "monospace" }}>{UM[item.urgency]?.l}</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#c8d8f0", lineHeight: 1.4, marginBottom: 3 }}>{item.icon} {item.shortTitle}</div>
                      <div style={{ fontSize: 9, color: "#1a2744" }}>{item.source}</div>
                      {notes[item.id] && <div style={{ marginTop: 4, fontSize: 8, color: "#34d399", fontFamily: "monospace" }}>📝 notatka</div>}
                    </div>
                  ))}
                  {col.length === 0 && <div style={{ textAlign: "center", padding: "16px 0", color: "#0c1828", fontSize: 16 }}>·</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailView({ item, notes, setNotes }) {
  const st = getStageObj(item.region, item.stage);
  const um = UM[item.urgency] || UM.low;
  const stages = getStages(item.region);
  const idx = getStageIdx(item.region, item.stage);
  const [noteVal, setNoteVal] = useState(notes[item.id] || "");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => { setNoteVal(notes[item.id] || ""); }, [item.id, notes]);

  const saveNote = () => {
    setNotes(n => ({ ...n, [item.id]: noteVal }));
    setNoteSaved(true); setTimeout(() => setNoteSaved(false), 1800);
  };

  return (
    <div style={{ padding: "18px", animation: "sr .22s ease both" }}>
      <div style={{ display: "flex", gap: 11, marginBottom: 16 }}>
        <span style={{ fontSize: 30, flexShrink: 0 }}>{item.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {[[item.region, item.region === "PL" ? "#60a5fa" : "#a78bfa"], [st.label, st.color], [um.l, um.c]].map(([label, color]) => (
              <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: color + "1a", color, border: `1px solid ${color}33`, fontFamily: "monospace" }}>{label}</span>
            ))}
          </div>
          <h2 style={{ color: "#eef2ff", fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 3 }}>{item.title}</h2>
          <div style={{ color: "#2d3f58", fontSize: 11 }}>{item.source}</div>
        </div>
      </div>

      {/* Pipeline */}
      <div style={{ background: "#060c18", border: "1px solid #111d30", borderRadius: 9, padding: "13px", marginBottom: 10 }}>
        <div style={{ fontSize: 8, color: "#1e2d4a", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 11 }}>PIPELINE LEGISLACYJNY</div>
        {stages.map((s, i) => {
          const done = i < idx, active = i === idx;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
                <div style={{ width: active ? 14 : 8, height: active ? 14 : 8, borderRadius: "50%", background: done || active ? s.color : "#111d30", border: `2px solid ${done || active ? s.color : "#1a2744"}`, boxShadow: active ? `0 0 10px ${s.color}` : "none", transition: "all .3s" }} />
                {i < stages.length - 1 && <div style={{ width: 2, height: 18, background: done ? s.color + "55" : "#111d30", marginTop: 1 }} />}
              </div>
              <div style={{ flex: 1, padding: "2px 9px", borderRadius: 5, marginBottom: 1, background: active ? s.color + "12" : "transparent", border: `1px solid ${active ? s.color + "33" : "transparent"}` }}>
                <div style={{ color: active ? s.color : done ? "#475569" : "#1a2744", fontWeight: active ? 700 : 400, fontSize: 11 }}>
                  {s.label}{active && <span style={{ marginLeft: 7, fontSize: 8, background: s.color, color: "#000", borderRadius: 3, padding: "1px 5px", fontWeight: 800 }}>TERAZ</span>}
                </div>
                {active && item.stageChangedAt && <div style={{ color: "#334155", fontSize: 9, marginTop: 1 }}>od {fmtDate(item.stageChangedAt)} · {daysSince(item.stageChangedAt)}d temu</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#060c18", border: "1px solid #111d30", borderRadius: 9, padding: "12px", marginBottom: 9 }}>
        <div style={{ fontSize: 8, color: "#1e2d4a", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 7 }}>OPIS</div>
        <p style={{ color: "#7a92b8", fontSize: 12.5, lineHeight: 1.8 }}>{item.summary}</p>
      </div>

      <div style={{ background: "#060c18", border: `1px solid ${st.color}33`, borderLeft: `3px solid ${st.color}`, borderRadius: 9, padding: "12px", marginBottom: 9 }}>
        <div style={{ fontSize: 8, color: st.color, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 7 }}>WPŁYW NA FINTECH</div>
        <p style={{ color: "#93c5fd", fontSize: 12.5, lineHeight: 1.8 }}>{item.impact}</p>
      </div>

      {item.nextStep && <div style={{ background: "#040e08", border: "1px solid #14532d44", borderLeft: "3px solid #22c55e", borderRadius: 9, padding: "12px", marginBottom: 9 }}>
        <div style={{ fontSize: 8, color: "#22c55e", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 7 }}>NASTĘPNY KROK</div>
        <p style={{ color: "#86efac", fontSize: 12.5, lineHeight: 1.8 }}>{item.nextStep}</p>
      </div>}

      {item.deadline && <div style={{ background: "#060c18", border: "1px solid #111d30", borderRadius: 9, padding: "11px 14px", marginBottom: 9, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <div>
          <div style={{ fontSize: 8, color: "#1e2d4a", fontFamily: "monospace", letterSpacing: "0.1em" }}>TERMIN WEJŚCIA W ŻYCIE</div>
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, marginTop: 2 }}>{fmtDate(item.deadline)}</div>
        </div>
      </div>}

      <div style={{ background: "#060c18", border: "1px solid #111d30", borderRadius: 9, padding: "12px" }}>
        <div style={{ fontSize: 8, color: "#1e2d4a", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 9 }}>📝 NOTATKI ZESPOŁU</div>
        <textarea value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="Przypisz osobę, dodaj komentarz, zaznacz priorytet..." rows={3}
          style={{ width: "100%", background: "#09111f", border: "1px solid #1a2744", borderRadius: 6, color: "#c8d8f0", padding: "8px 11px", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
        <button onClick={saveNote} style={{ marginTop: 7, background: "#1e3a5f", border: "1px solid #2563eb44", borderRadius: 5, color: "#60a5fa", padding: "5px 13px", fontSize: 10, fontWeight: 600 }}>
          {noteSaved ? "✓ Zapisano" : "Zapisz notatkę"}
        </button>
      </div>
    </div>
  );
}
