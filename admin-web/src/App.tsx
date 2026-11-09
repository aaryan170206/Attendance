
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  ChartNoAxesCombined,
  Activity,
  ClipboardList,
  Settings,
  Bell,
  ChevronDown,
  ArrowUpRight,
  Menu,
  X,
  GraduationCap,
  Clock3,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import "./App.css";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Institutions", icon: Building2 },
  { label: "Admin Requests", icon: ShieldCheck },
  { label: "Users", icon: Users },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "System Health", icon: Activity },
  { label: "Audit Logs", icon: ClipboardList },
];

const stats = [
  { label: "Total Institutions", value: "24", change: "+12.5%", positive: true, icon: Building2 },
  { label: "Active Institutions", value: "21", change: "+8.2%", positive: true, icon: GraduationCap },
  { label: "Total Users", value: "12,840", change: "+18.4%", positive: true, icon: Users },
  { label: "Pending Requests", value: "08", change: "Needs review", positive: false, icon: Clock3 },
];

const institutions = [
  { name: "Government College of Commerce", location: "Chandigarh", users: "1,240", status: "Active", initials: "GC" },
  { name: "North Valley Institute", location: "Delhi", users: "856", status: "Active", initials: "NV" },
  { name: "Modern College of Technology", location: "Punjab", users: "2,104", status: "Pending", initials: "MC" },
  { name: "City Business School", location: "Mumbai", users: "642", status: "Suspended", initials: "CB" },
];

const activities = [
  { title: "New institution registered", detail: "Modern College of Technology", time: "12 minutes ago", type: "success" },
  { title: "Admin access request received", detail: "Government College of Commerce", time: "38 minutes ago", type: "pending" },
  { title: "Institution suspended", detail: "City Business School", time: "2 hours ago", type: "warning" },
  { title: "New platform user registered", detail: "Student account created", time: "4 hours ago", type: "success" },
];

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><GraduationCap size={25} /></div>
          <div>
            <h2>AttendFlow</h2>
            <span>PLATFORM CONTROL</span>
          </div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X /></button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`nav-item ${activePage === item.label ? "active" : ""}`}
                onClick={() => {
                  setActivePage(item.label);
                  setSidebarOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.label === "Admin Requests" && <span className="nav-count">08</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className={`nav-item ${activePage === "Settings" ? "active" : ""}`} onClick={() => setActivePage("Settings")}>
            <Settings size={19} /><span>Settings</span>
          </button>
          <div className="sidebar-profile">
            <div className="profile-avatar">SA</div>
            <div className="profile-info">
              <strong>Super Admin</strong>
              <span>Platform Owner</span>
            </div>
            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="breadcrumb">Platform <span>/</span> <strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <div className="system-indicator"><span /> All systems operational</div>
            <button className="icon-button notification-button"><Bell size={19} /><i /></button>
            <div className="topbar-avatar">SA</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-section">
            <div>
              <div className="eyebrow">THURSDAY, NOVEMBER 05, 2026</div>
              <h1>{activePage === "Overview" ? "Platform Overview" : activePage}</h1>
              <p>Here's what's happening across your AttendFlow platform.</p>
            </div>
            <button className="date-button"><Clock3 size={16} /> Last 30 days <ChevronDown size={15} /></button>
          </section>

          {activePage === "Overview" ? (
            <>
              <section className="stats-grid">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <article className="stat-card" key={stat.label}>
                      <div className="stat-top">
                        <span>{stat.label}</span>
                        <div className="stat-icon"><Icon size={19} /></div>
                      </div>
                      <div className="stat-value">{stat.value}</div>
                      <div className={`stat-change ${stat.positive ? "positive" : "neutral"}`}>
                        {stat.positive ? <ArrowUpRight size={15} /> : <Clock3 size={14} />}
                        {stat.change}
                        {stat.positive && <span> vs last month</span>}
                      </div>
                    </article>
                  );
                })}
              </section>

              <section className="dashboard-grid">
                <article className="panel growth-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Platform Growth</h3>
                      <p>Institution registrations over time</p>
                    </div>
                    <button className="select-button">This year <ChevronDown size={14} /></button>
                  </div>
                  <div className="chart-summary">
                    <strong>24 <span>institutions</span></strong>
                    <span className="chart-growth"><ArrowUpRight size={15} /> 12.5%</span>
                  </div>
                  <div className="chart">
                    <div className="chart-y-labels"><span>30</span><span>20</span><span>10</span><span>0</span></div>
                    <div className="chart-main">
                      <div className="chart-grid-lines"><i /><i /><i /><i /></div>
                      <svg viewBox="0 0 700 190" preserveAspectRatio="none" className="growth-svg">
                        <defs>
                          <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#71856B" stopOpacity=".28" />
                            <stop offset="100%" stopColor="#71856B" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M0 160 C55 150 65 145 100 148 S170 130 200 133 S260 110 300 118 S365 85 400 94 S460 70 500 78 S560 45 600 55 S660 25 700 20 L700 190 L0 190 Z" fill="url(#growthFill)" />
                        <path d="M0 160 C55 150 65 145 100 148 S170 130 200 133 S260 110 300 118 S365 85 400 94 S460 70 500 78 S560 45 600 55 S660 25 700 20" fill="none" stroke="#637D5D" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                        <circle cx="700" cy="20" r="5" fill="#637D5D" />
                      </svg>
                      <div className="chart-x-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span></div>
                    </div>
                  </div>
                </article>

                <article className="panel health-panel">
                  <div className="panel-heading">
                    <div><h3>Platform Health</h3><p>Current system status</p></div>
                    <span className="health-dot"><i /> Live</span>
                  </div>
                  <div className="health-score">
                    <div className="health-ring"><div><strong>99.8%</strong><span>Uptime</span></div></div>
                  </div>
                  <div className="health-list">
                    <div><span><i className="health-green" /> Database</span><strong>Operational</strong></div>
                    <div><span><i className="health-green" /> Authentication</span><strong>Operational</strong></div>
                    <div><span><i className="health-green" /> API Services</span><strong>Operational</strong></div>
                  </div>
                </article>
              </section>

              <section className="bottom-grid">
                <article className="panel institutions-panel">
                  <div className="panel-heading">
                    <div><h3>Institutions</h3><p>Recently registered institutions</p></div>
                    <button className="text-link" onClick={() => setActivePage("Institutions")}>View all <ArrowUpRight size={15} /></button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>INSTITUTION</th><th>USERS</th><th>STATUS</th><th /></tr></thead>
                      <tbody>
                        {institutions.map((institution) => (
                          <tr key={institution.name}>
                            <td><div className="institution-cell"><div className="institution-avatar">{institution.initials}</div><div><strong>{institution.name}</strong><span>{institution.location}</span></div></div></td>
                            <td>{institution.users}</td>
                            <td><span className={`status-badge ${institution.status.toLowerCase()}`}>{institution.status}</span></td>
                            <td><button className="row-action"><ArrowUpRight size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h3>Recent Activity</h3><p>Latest platform events</p></div><button className="more-button">•••</button></div>
                  <div className="activity-list">
                    {activities.map((activity, index) => (
                      <div className="activity-item" key={index}>
                        <div className={`activity-icon ${activity.type}`}>
                          {activity.type === "success" ? <CheckCircle2 size={16} /> : activity.type === "pending" ? <Clock3 size={16} /> : <AlertCircle size={16} />}
                        </div>
                        <div className="activity-copy"><strong>{activity.title}</strong><span>{activity.detail}</span><small>{activity.time}</small></div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            </>
          ) : (
            <section className="panel placeholder-panel">
              <div className="placeholder-icon"><LayoutDashboard size={28} /></div>
              <h2>{activePage}</h2>
              <p>This section is ready for implementation. We'll connect it to the AttendFlow backend in the next stages.</p>
              <button className="primary-button" onClick={() => setActivePage("Overview")}>Back to Overview</button>
            </section>
          )}
          <footer className="footer"><span>© 2026 AttendFlow Platform</span><span>Platform Administration Console <b>•</b> v1.0</span></footer>
        </div>
      </main>
      {sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}

export default App;
