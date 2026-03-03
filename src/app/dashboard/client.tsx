"use client";

import { useState, useMemo } from "react";

// ─── Types ───

type SourceCount = { source: string; count: number };

type FieldRow = {
  id: string;
  name: string;
  fieldKey: string | null;
  dataType: string | null;
  parentId: string | null;
  filledCount: number;
  filledPct: number;
  totalContacts: number;
  sourceBreakdown: SourceCount[];
};

type SourceAgg = {
  source: string;
  totalContacts: number;
  fieldsUsed: number;
};

type SyncInfo = {
  status: string;
  startedAt: string;
  finishedAt: string | null;
  contactsIngested: number;
  fieldsIngested: number;
} | null;

type Props = {
  fields: FieldRow[];
  sources: SourceAgg[];
  lastSync: SyncInfo;
};

// ─── Palette ───

const P = {
  bg: "#0B0F1A", card: "#111827", cardHover: "#1a2236",
  border: "#1E293B", text: "#E2E8F0", textMuted: "#94A3B8", textDim: "#64748B",
  accent: "#38BDF8", danger: "#EF4444", dangerBg: "#451218", dangerBorder: "#7F1D1D",
  success: "#10B981", successBg: "#064E3B", warning: "#F59E0B",
  purple: "#A78BFA", pink: "#F472B6", orange: "#FB923C",
};
const BC = ["#38BDF8", "#A78BFA", "#F472B6", "#FB923C", "#10B981", "#F59E0B", "#EF4444", "#6366F1"];
const mono = "'JetBrains Mono', monospace";

// ─── Small components ───

function TypeBadge({ type }: { type: string | null }) {
  const m: Record<string, string> = { RADIO: "#F472B6", TEXT: "#94A3B8", SINGLE_OPTIONS: "#A78BFA", MULTIPLE_OPTIONS: "#FB923C", LARGE_TEXT: "#64748B" };
  const c = m[type || ""] || "#94A3B8";
  return (
    <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, color: c, background: c + "1A", letterSpacing: 0.3, fontFamily: mono, textTransform: "uppercase" }}>
      {(type || "—").replace(/_/g, " ")}
    </span>
  );
}

function UsageBar({ pct }: { pct: number }) {
  const color = pct === 0 ? P.danger : pct < 0.05 ? P.warning : pct < 0.3 ? P.accent : P.success;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 130 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct * 100, 0.4)}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: mono, color: P.textMuted, minWidth: 40, textAlign: "right" }}>
        {(pct * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function StatCard({ label, value, sub, color = P.accent }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 22px", flex: 1, minWidth: 170 }}>
      <div style={{ fontSize: 11, color: P.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4, fontFamily: mono }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: P.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Main Dashboard ───

export default function DashboardClient({ fields, sources, lastSync }: Props) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "unused" | "bySource">("all");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState<FieldRow | null>(null);
  const [sourceDetail, setSourceDetail] = useState<FieldRow | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ msg: string; type: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<"filled" | "name" | "type">("filled");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const showNotif = (msg: string, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const activeData = useMemo(() => fields.filter((d) => !deletedIds.has(d.id)), [fields, deletedIds]);

  const filtered = useMemo(() => {
    let list = activeData;
    if (tab === "unused") list = list.filter((d) => d.filledCount === 0);
    if (typeFilter !== "ALL") list = list.filter((d) => d.dataType === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || (d.fieldKey || "").toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let c = 0;
      if (sortBy === "filled") c = a.filledCount - b.filledCount;
      else if (sortBy === "name") c = a.name.localeCompare(b.name);
      else if (sortBy === "type") c = (a.dataType || "").localeCompare(b.dataType || "");
      return sortDir === "desc" ? -c : c;
    });
    return list;
  }, [activeData, tab, typeFilter, search, sortBy, sortDir]);

  // Source aggregation from field-level source breakdowns
  const sourceAgg = useMemo(() => {
    const map: Record<string, { source: string; totalFills: number; fieldCount: number; fields: { name: string; count: number; id: string }[] }> = {};
    activeData.forEach((f) => {
      f.sourceBreakdown.forEach((s) => {
        if (!map[s.source]) map[s.source] = { source: s.source, totalFills: 0, fieldCount: 0, fields: [] };
        map[s.source].totalFills += s.count;
        map[s.source].fieldCount++;
        map[s.source].fields.push({ name: f.name, count: s.count, id: f.id });
      });
    });
    return Object.values(map).sort((a, b) => b.totalFills - a.totalFills);
  }, [activeData]);

  const totalContacts = activeData.length ? activeData[0].totalContacts : 0;
  const unusedCount = activeData.filter((d) => d.filledCount === 0).length;
  const types = [...new Set(activeData.map((d) => d.dataType).filter(Boolean))].sort() as string[];
  const topField = activeData[0];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/fields", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeletedIds((prev) => new Set([...prev, deleteTarget.id]));
        showNotif(`Deleted "${deleteTarget.name}"`);
      } else {
        showNotif(data.error || "Delete failed", "error");
      }
    } catch (e: any) {
      showNotif(e.message || "Network error", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleSort = (col: "filled" | "name" | "type") => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const th: React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: P.textDim, textTransform: "uppercase", letterSpacing: 0.7, whiteSpace: "nowrap", userSelect: "none", cursor: "pointer" };
  const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top" };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: P.bg, minHeight: "100vh", color: P.text }}>
      {/* Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar { width: 5px; height: 5px; } ::-webkit-scrollbar-track { background: ${P.bg}; } ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 3px; } @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Notification toast */}
      {notification && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 1000,
          background: notification.type === "success" ? P.successBg : P.dangerBg,
          border: `1px solid ${notification.type === "success" ? P.success : P.danger}`,
          color: notification.type === "success" ? P.success : P.danger,
          padding: "10px 18px", borderRadius: 8, fontSize: 12, fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "fadeIn 0.25s ease",
        }}>
          {notification.msg}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => !deleting && setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: P.card, border: `1px solid ${P.dangerBorder}`, borderRadius: 14, padding: 28, maxWidth: 460, width: "92%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeIn 0.2s ease" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: P.danger, marginBottom: 8 }}>Delete Custom Field</div>
            <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 12 }}>
              This will permanently remove this field from GoHighLevel:
            </div>
            <div style={{ background: P.dangerBg, border: `1px solid ${P.dangerBorder}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{deleteTarget.name}</div>
              <div style={{ fontSize: 10, fontFamily: mono, color: P.textDim, marginTop: 4, wordBreak: "break-all" }}>{deleteTarget.id}</div>
              <div style={{ fontSize: 12, color: deleteTarget.filledCount > 0 ? P.danger : P.success, marginTop: 6 }}>
                {deleteTarget.filledCount > 0
                  ? `⚠ ${deleteTarget.filledCount} contacts have data in this field — it will be lost.`
                  : "✓ 0 contacts use this field. Safe to remove."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ padding: "7px 18px", borderRadius: 7, border: `1px solid ${P.border}`, background: "transparent", color: P.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: P.danger, color: "#fff", cursor: deleting ? "wait" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Deleting…" : "Delete Field"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source detail modal */}
      {sourceDetail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} onClick={() => setSourceDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: 28, maxWidth: 500, width: "92%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: P.text }}>{sourceDetail.name}</div>
                <div style={{ fontSize: 10, fontFamily: mono, color: P.textDim, marginTop: 3 }}>{sourceDetail.fieldKey}</div>
              </div>
              <button onClick={() => setSourceDetail(null)} style={{ background: "none", border: "none", color: P.textDim, cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: P.textMuted, marginBottom: 14 }}>
              {sourceDetail.filledCount} contacts across {sourceDetail.sourceBreakdown.length} source{sourceDetail.sourceBreakdown.length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {sourceDetail.sourceBreakdown.map((s, i) => {
                const total = sourceDetail.sourceBreakdown.reduce((a, b) => a + b.count, 0);
                const pct = total > 0 ? s.count / total : 0;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ minWidth: 110, fontSize: 12, color: P.text }}>{s.source}</span>
                    <div style={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                      <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 4, background: BC[i % BC.length] }} />
                    </div>
                    <span style={{ minWidth: 40, textAlign: "right", fontSize: 11, fontFamily: mono, color: P.textMuted }}>{s.count}</span>
                    <span style={{ minWidth: 36, textAlign: "right", fontSize: 10, fontFamily: mono, color: P.textDim }}>{(pct * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.border}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(180deg, rgba(56,189,248,0.03) 0%, transparent 100%)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
            <span style={{ color: P.accent }}>GHL</span> Field Usage Dashboard
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: P.textDim }}>
            Audit &amp; clean {totalContacts.toLocaleString()} contacts · {activeData.length} custom fields
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastSync && (
            <span style={{ fontSize: 10, color: lastSync.status === "done" ? P.success : P.warning, fontFamily: mono }}>
              Last sync: {lastSync.contactsIngested} contacts · {lastSync.status}
            </span>
          )}
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: lastSync?.status === "done" ? P.success : P.warning, boxShadow: `0 0 6px ${lastSync?.status === "done" ? P.success : P.warning}` }} />
        </div>
      </div>

      <div style={{ padding: "20px 28px", maxWidth: 1360, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Total Contacts" value={totalContacts.toLocaleString()} color={P.accent} />
          <StatCard label="Custom Fields" value={activeData.length} sub={deletedIds.size > 0 ? `${deletedIds.size} removed` : ""} color={P.purple} />
          <StatCard label="Unused (0%)" value={unusedCount} sub={unusedCount > 0 ? "Ready to clean" : "All in use"} color={unusedCount > 0 ? P.warning : P.success} />
          <StatCard label="Most Used" value={topField ? topField.filledCount.toLocaleString() : "—"} sub={topField?.name?.slice(0, 28)} color={P.pink} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          {([
            { key: "all" as const, label: `All (${activeData.length})` },
            { key: "unused" as const, label: `Unused (${unusedCount})` },
            { key: "bySource" as const, label: "By Source" },
          ]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "7px 16px", borderRadius: 7,
              border: `1px solid ${tab === t.key ? P.accent : P.border}`,
              background: tab === t.key ? "rgba(56,189,248,0.08)" : "transparent",
              color: tab === t.key ? P.accent : P.textMuted,
              cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans',sans-serif",
            }}>
              {t.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {tab !== "bySource" && (
            <>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${P.border}`, background: P.card, color: P.textMuted, fontSize: 11, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", outline: "none" }}>
                <option value="ALL">All Types</option>
                {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <input type="text" placeholder="Search fields…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 12, fontFamily: "'DM Sans',sans-serif", width: 200, outline: "none" }} />
            </>
          )}
        </div>

        {/* BY SOURCE TAB */}
        {tab === "bySource" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sourceAgg.map((src, i) => (
              <div key={src.source} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: BC[i % BC.length] }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{src.source}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <span style={{ fontSize: 11, color: P.textMuted }}><span style={{ fontFamily: mono, color: P.accent, fontWeight: 600 }}>{src.totalFills.toLocaleString()}</span> fills</span>
                    <span style={{ fontSize: 11, color: P.textMuted }}><span style={{ fontFamily: mono, color: P.purple, fontWeight: 600 }}>{src.fieldCount}</span> fields</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {src.fields.sort((a, b) => b.count - a.count).slice(0, 8).map((f, j) => (
                    <span key={f.id + j} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 3, fontSize: 10, background: "rgba(255,255,255,0.03)", color: P.textMuted, border: `1px solid ${P.border}` }}>
                      {f.name.slice(0, 28)} <span style={{ color: BC[j % BC.length], fontFamily: mono, fontWeight: 600 }}>{f.count}</span>
                    </span>
                  ))}
                  {src.fields.length > 8 && <span style={{ fontSize: 10, color: P.textDim, padding: "2px 4px" }}>+{src.fields.length - 8}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FIELDS TABLE */}
        {tab !== "bySource" && (
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${P.border}`, background: "rgba(255,255,255,0.02)" }}>
                    <th style={{ ...th, width: 260 }} onClick={() => toggleSort("name")}>Field {sortBy === "name" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</th>
                    <th style={{ ...th, width: 95 }} onClick={() => toggleSort("type")}>Type {sortBy === "type" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</th>
                    <th style={{ ...th, width: 65 }} onClick={() => toggleSort("filled")}>Filled {sortBy === "filled" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</th>
                    <th style={{ ...th, width: 150, cursor: "default" }}>Usage</th>
                    <th style={{ ...th, width: 220, cursor: "default" }}>Sources</th>
                    <th style={{ ...th, width: 55, textAlign: "center", cursor: "default" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 36, textAlign: "center", color: P.textDim }}>
                        {activeData.length === 0 ? "No data yet. Run sync first: pnpm sync:all" : "No fields match your filters."}
                      </td>
                    </tr>
                  )}
                  {filtered.map((f) => (
                    <tr key={f.id} style={{ borderBottom: `1px solid ${P.border}`, background: f.filledCount === 0 ? "rgba(239,68,68,0.03)" : "transparent" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = P.cardHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = f.filledCount === 0 ? "rgba(239,68,68,0.03)" : "transparent"; }}
                    >
                      <td style={td}>
                        <div style={{ fontWeight: 500, color: P.text, lineHeight: 1.3, fontSize: 12 }}>{f.name}</div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: P.textDim, marginTop: 2, wordBreak: "break-all" }}>{f.fieldKey}</div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: P.textDim, opacity: 0.5, marginTop: 1 }}>{f.id}</div>
                      </td>
                      <td style={td}><TypeBadge type={f.dataType} /></td>
                      <td style={{ ...td, fontFamily: mono, fontWeight: 600, color: f.filledCount === 0 ? P.danger : P.text, fontSize: 12 }}>
                        {f.filledCount.toLocaleString()}
                      </td>
                      <td style={td}><UsageBar pct={f.filledPct} /></td>
                      <td style={td}>
                        <div onClick={() => f.sourceBreakdown.length > 0 && setSourceDetail(f)} style={{ cursor: f.sourceBreakdown.length > 0 ? "pointer" : "default", display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {f.sourceBreakdown.length === 0
                            ? <span style={{ color: P.textDim, fontSize: 11 }}>—</span>
                            : <>
                                {f.sourceBreakdown.slice(0, 3).map((s, i) => (
                                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 3, fontSize: 10, background: "rgba(255,255,255,0.04)", color: P.textMuted, border: `1px solid ${P.border}` }}>
                                    {s.source} <span style={{ color: BC[i % BC.length], fontFamily: mono, fontWeight: 600 }}>{s.count}</span>
                                  </span>
                                ))}
                                {f.sourceBreakdown.length > 3 && <span style={{ fontSize: 10, color: P.textDim }}>+{f.sourceBreakdown.length - 3}</span>}
                              </>
                          }
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button onClick={() => setDeleteTarget(f)} title="Delete field" aria-label="Delete field"
                          style={{ background: "rgba(239,68,68,0.08)", border: `1px solid rgba(239,68,68,0.3)`, cursor: "pointer", borderRadius: 6, padding: "6px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                          onMouseEnter={(e) => { const t = e.currentTarget; t.style.borderColor = P.danger; t.style.background = "rgba(239,68,68,0.2)"; }}
                          onMouseLeave={(e) => { const t = e.currentTarget; t.style.borderColor = "rgba(239,68,68,0.3)"; t.style.background = "rgba(239,68,68,0.08)"; }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${P.border}`, fontSize: 11, color: P.textDim, display: "flex", justifyContent: "space-between" }}>
              <span>Showing {filtered.length} of {activeData.length}</span>
              {deletedIds.size > 0 && <span style={{ fontFamily: mono, color: P.danger }}>{deletedIds.size} deleted this session</span>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 28, padding: "14px 0", borderTop: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: P.textDim }}>ORA AI · GHL Field Dashboard</span>
          <span style={{ fontSize: 10, color: P.textDim, fontFamily: mono }}>v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
