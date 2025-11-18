// src/components/Owner/RevenueSection.jsx
import React, { useEffect, useState, useMemo } from "react";
import "../../App.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// small helpers
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return "₹0.00";
  return "₹" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function RevenueSection() {
  const [report, setReport] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line
  }, []);

  async function fetchReport(range = null) {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const params = new URLSearchParams();
      if (range?.from) params.set("from", range.from);
      if (range?.to) params.set("to", range.to);
      const query = params.toString() ? `?${params.toString()}` : "";

      const res = await fetch(`${API}/api/reports${query}`, { headers: { Accept: "application/json" } });
      const text = await res.text().catch(() => "");

      if (!res.ok) {
        const snippet = text ? text.slice(0, 2000) : `Status ${res.status}`;
        throw new Error(`Server returned ${res.status}: ${snippet}`);
      }

      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        const snippet = text ? text.slice(0, 1000) : "Empty response";
        throw new Error(`Invalid JSON response from server: ${snippet}`);
      }

      // map backend -> frontend shape (same mappings as before)
      const totalOrders = Number(data.ordersCount || 0);
      const totalItems =
        Array.isArray(data.byItem) && data.byItem.length
          ? data.byItem.reduce((s, it) => s + (Number(it.qtySold || 0)), 0)
          : 0;
      const totalAmount = Number(data.totalRevenue || 0);

      const dishCounts = Array.isArray(data.byItem)
        ? data.byItem.map(it => ({ name: it.name || "Unknown", count: Number(it.qtySold || 0), revenue: Number(it.revenue || 0) }))
        : [];

      const byDay = Array.isArray(data.byDay)
        ? data.byDay.map(d => ({ date: d._id, revenue: Number(d.total || 0), orders: Number(d.orders || 0) }))
        : [];

      setReport({
        totalOrders,
        totalItems,
        totalAmount,
        dishCounts,
        byDay
      });
    } catch (err) {
      console.error("fetchReport error:", err);
      setError(typeof err === "string" ? err : (err.message || "Failed to fetch report"));
    } finally {
      setLoading(false);
    }
  }

  function quick(type) {
    const now = new Date();
    let f = null;
    let t = null;

    if (type === "today") {
      f = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (type === "thisMonth") {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      t = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (type === "lastMonth") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfLast = new Date(first.getTime() - 1);
      f = new Date(lastDayOfLast.getFullYear(), lastDayOfLast.getMonth(), 1);
      t = new Date(lastDayOfLast.getFullYear(), lastDayOfLast.getMonth(), lastDayOfLast.getDate() + 1);
    }

    fetchReport({ from: f.toISOString(), to: t.toISOString() });
    setFrom(formatInputDate(f));
    setTo(formatInputDate(new Date(t.getTime() - 1)));
  }

  function formatInputDate(d) {
    const pad = (n) => (n < 10 ? "0" + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function submit(e) {
    e.preventDefault();
    if (!from || !to) return alert("Pick both dates");

    const fIso = new Date(from + "T00:00:00").toISOString();
    const tIso = new Date(new Date(to + "T00:00:00").getTime() + 86400000).toISOString();
    fetchReport({ from: fIso, to: tIso });
  }

  // Derived chart data (memoized)
  const revenueSeries = useMemo(() => {
    if (!report || !report.byDay || report.byDay.length === 0) return [];
    // ensure sorted by date
    const sorted = [...report.byDay].sort((a, b) => (a.date > b.date ? 1 : -1));
    return sorted.map(r => ({ x: r.date, y: Number(r.revenue || 0), orders: r.orders || 0 }));
  }, [report]);

  const topDishes = useMemo(() => {
    if (!report || !report.dishCounts) return [];
    return [...report.dishCounts].sort((a,b) => b.count - a.count).slice(0, 8);
  }, [report]);

  // CSV export
  function exportCsv() {
    if (!report) return;
    const rows = [["Date","Revenue","Orders"]];
    (report.byDay || []).forEach(d => rows.push([d.date, d.revenue, d.orders]));
    rows.push([]);
    rows.push(["Dish","Count","Revenue"]);
    (report.dishCounts || []).forEach(d => rows.push([d.name, d.count, d.revenue || ""]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Small chart components (inline)
  function RevenueLineChart({ data, height = 160 }) {
    if (!data || data.length === 0) return <div className="chart-empty">No revenue data</div>;
    const width = Math.max(300, Math.min(900, data.length * 36));
    const values = data.map(d => d.y);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const pad = max === min ? max || 1 : 0;
    const range = Math.max(1, max - min);
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * (width - 24) + 12;
      const y = height - 12 - ((d.y - min) / range) * (height - 36 || 1);
      return `${x},${y}`;
    }).join(" ");

    // area path for smoothness (we'll use straight polyline for simplicity)
    return (
      <div className="chart-wrap" style={{ overflowX: data.length > 12 ? "auto" : "hidden" }}>
        <svg className="line-chart" width={Math.max(width, 300)} height={height} role="img" aria-label="Revenue chart">
          {/* gridlines */}
          {[0,0.25,0.5,0.75,1].map((t,i)=>(
            <line key={i} x1={12} x2={Math.max(width,300)-12} y1={12 + t*(height-36)} y2={12 + t*(height-36)} stroke="#eef2f7" strokeWidth="1" />
          ))}
          {/* polyline */}
          <polyline fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
          {/* area under (light fill) */}
          <polygon fill="rgba(37,99,235,0.08)" points={`${12},${height-12} ${points} ${Math.max(width,300)-12},${height-12}`} />
          {/* dots */}
          {data.map((d,i)=>{
            const x = (i / (data.length - 1 || 1)) * (Math.max(width,300) - 24) + 12;
            const y = height - 12 - ((d.y - min) / range) * (height - 36 || 1);
            return <circle key={i} cx={x} cy={y} r={3.4} fill="#fff" stroke="#2563eb" strokeWidth="1.6" />;
          })}
        </svg>
        <div className="chart-legend">
          <div className="legend-item"><span className="dot blue" /> Revenue</div>
          <div className="legend-item"><span className="dot gray" /> Orders</div>
        </div>
      </div>
    );
  }

  function DishBarChart({ data }) {
    if (!data || data.length === 0) return <div className="chart-empty">No dish data</div>;
    const max = Math.max(...data.map(d => d.count), 1);
    return (
      <div className="bar-chart">
        {data.map((d, i) => (
          <div key={i} className="bar-row">
            <div className="bar-label">{d.name}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${clamp((d.count / max) * 100, 2, 100)}%` }} />
            </div>
            <div className="bar-value">{d.count}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="panel dashboard-panel">
      <div className="panel-header dashboard-header">
        <div>
          <h2>Revenue dashboard</h2>
          <div className="muted">Realtime summary and sales insights (completed orders only)</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => fetchReport()}>Refresh</button>
          <button className="btn" onClick={exportCsv} disabled={!report}>Export CSV</button>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="quick-filters">
          <button className="chip" onClick={() => quick("today")}>Today</button>
          <button className="chip" onClick={() => quick("thisMonth")}>This Month</button>
          <button className="chip" onClick={() => quick("lastMonth")}>Last Month</button>
          <button className="chip" onClick={() => fetchReport()}>All</button>
        </div>

        <form onSubmit={submit} className="date-range">
          <label>From <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} /></label>
          <label>To <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} /></label>
          <button className="btn btn-primary" type="submit">Apply</button>
        </form>
      </div>

      {loading && <div className="loader">Loading…</div>}
      {error && <div className="error">{error}</div>}

      {report && !loading && (
        <div className="dashboard-grid">
          <div className="cards">
            <div className="stat-card">
              <div className="stat-title">Total Revenue</div>
              <div className="stat-value">{fmtMoney(report.totalAmount)}</div>
            </div>

            <div className="stat-card">
              <div className="stat-title">Orders</div>
              <div className="stat-value">{report.totalOrders}</div>
            </div>

            <div className="stat-card">
              <div className="stat-title">Items Sold</div>
              <div className="stat-value">{report.totalItems}</div>
            </div>

            <div className="stat-card muted-card">
              <div className="stat-title">Top Dish</div>
              <div className="stat-value">{(report.dishCounts && report.dishCounts.length) ? report.dishCounts.reduce((a,b)=>a.count>b.count?a:b).name : "—"}</div>
            </div>
          </div>

          <div className="charts">
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-title">Revenue by day</div>
                <div className="chart-sub">{revenueSeries.length} points</div>
              </div>
              <RevenueLineChart data={revenueSeries} />
            </div>

            <div className="chart-card small">
              <div className="chart-card-header">
                <div className="chart-title">Top dishes</div>
                <div className="chart-sub">{topDishes.length} items</div>
              </div>
              <DishBarChart data={topDishes} />
            </div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <div>Day</div>
              <div>Orders</div>
              <div>Revenue</div>
            </div>
            <div className="table-body">
              {(report.byDay || []).slice().sort((a,b)=>a.date<b.date?-1:1).map((d, i) => (
                <div key={i} className="table-row">
                  <div>{d.date}</div>
                  <div>{d.orders}</div>
                  <div>{fmtMoney(d.revenue)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
