
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bell,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

type Theme = "light" | "dark";

type Institution = {
  id: string;
  institution_name: string;
  city: string | null;
  status: string;
  created_at: string;
};

type DashboardData = {
  totalInstitutions: number | null;
  activeInstitutions: number | null;
  totalUsers: number | null;
  institutions: Institution[];
};

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Institutions", icon: Building2 },
  { label: "Admin Requests", icon: ShieldCheck },
  { label: "Users", icon: Users },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "System Health", icon: Activity },
  { label: "Audit Logs", icon: ClipboardList },
];

const emptyDashboard: DashboardData = {
  totalInstitutions: null,
  activeInstitutions: null,
  totalUsers: null,
  institutions: [],
};

function formatNumber(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-IN");
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [dashboard, setDashboard] =
    useState<DashboardData>(emptyDashboard);

  // Automatically detect the operating system's appearance.
  const [theme, setTheme] = useState<Theme>(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  // Listen for system appearance changes while the app is open.
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleThemeChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    // Synchronize the initial theme with the current system setting.
    setTheme(mediaQuery.matches ? "dark" : "light");

    mediaQuery.addEventListener("change", handleThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange);
    };
  }, []);

  // Load dashboard data from Supabase.
  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setDashboardError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        if (active) {
          setAdminEmail(user.email ?? "Super Admin");
        }

        const [
          institutionCountResult,
          activeInstitutionCountResult,
          userCountResult,
          institutionListResult,
        ] = await Promise.all([
          supabase
            .from("institutions")
            .select("id", { count: "exact", head: true }),

          supabase
            .from("institutions")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),

          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true }),

          supabase
            .from("institutions")
            .select(
              "id, institution_name, city, status, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        const firstError =
          institutionCountResult.error ??
          activeInstitutionCountResult.error ??
          userCountResult.error ??
          institutionListResult.error;

        if (firstError) throw firstError;

        if (!active) return;

        setDashboard({
          totalInstitutions: institutionCountResult.count,
          activeInstitutions: activeInstitutionCountResult.count,
          totalUsers: userCountResult.count,
          institutions: institutionListResult.data ?? [],
        });
      } catch (error) {
        if (!active) return;

        setDashboardError(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard data."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  // Sign out the current administrator.
  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      window.alert(`Unable to sign out: ${error.message}`);
      setSigningOut(false);
    }

    // AuthGate observes the sign-out event and displays the login screen.
  };

  // Dashboard statistics.
  const stats = [
    {
      label: "Total Institutions",
      value: formatNumber(dashboard.totalInstitutions),
      icon: Building2,
      color: "brown",
    },
    {
      label: "Active Institutions",
      value: formatNumber(dashboard.activeInstitutions),
      icon: GraduationCap,
      color: "green",
    },
    {
      label: "Total Users",
      value: formatNumber(dashboard.totalUsers),
      icon: Users,
      color: "burgundy",
    },
    {
      label: "Pending Requests",
      value: "—",
      icon: Clock3,
      color: "gold",
    },
  ];

  return (
    <div className={`app-shell ${theme}-theme`}>
      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}
      >
        <div className="brand">
          <div className="brand-icon">
            <GraduationCap size={25} />
          </div>

          <div>
            <h2>AttendFlow</h2>
            <span>SUPER ADMIN</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage(item.label);
                  setSidebarOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.label === "Admin Requests" && (
                  <span className="nav-count">—</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`nav-item ${
              activePage === "Settings" ? "active" : ""
            }`}
            onClick={() => {
              setActivePage("Settings");
              setSidebarOpen(false);
            }}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="sidebar-profile">
            <div className="profile-avatar">
              {getInitials(adminEmail || "SA")}
            </div>

            <div className="profile-info">
              <strong>Super Admin</strong>
              <span title={adminEmail}>{adminEmail}</span>
            </div>

            <button
              className="profile-logout"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Platform <span>/</span>{" "}
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <div className="system-indicator">
              <span />
              Dashboard
            </div>

            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={19} />
            </button>

            <button
              className="topbar-avatar"
              title={adminEmail}
              aria-label={`Signed in as ${adminEmail}`}
            >
              {getInitials(adminEmail || "SA")}
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="page-content">
          <section className="welcome-section">
            <div>
              <div className="eyebrow">
                ATTENDFLOW · PLATFORM CONTROL
              </div>

              <h1>
                {activePage === "Overview"
                  ? "Platform Overview"
                  : activePage}
              </h1>

              <p>
                Monitor institutions, users and overall platform activity.
              </p>
            </div>

            <button className="date-button" disabled>
              <Clock3 size={16} />
              Current data
              <ChevronDown size={15} />
            </button>
          </section>

          {/* Dashboard error */}
          {dashboardError && (
            <section className="panel" role="alert">
              <div className="activity-item">
                <div className="activity-icon warning">
                  <AlertCircle size={18} />
                </div>

                <div className="activity-copy">
                  <strong>Unable to load dashboard data</strong>
                  <span>{dashboardError}</span>

                  <button
                    className="text-link"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Overview page */}
          {activePage === "Overview" ? (
            <>
              {/* Statistics */}
              <section className="stats-grid">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <article
                      className="stat-card"
                      key={stat.label}
                    >
                      <div className="stat-top">
                        <span>{stat.label}</span>

                        <div className={`stat-icon ${stat.color}`}>
                          <Icon size={19} />
                        </div>
                      </div>

                      <div className="stat-value">
                        {loading ? "…" : stat.value}
                      </div>

                      <div className="stat-change neutral">
                        {loading
                          ? "Loading..."
                          : stat.label === "Pending Requests"
                            ? "Request data not connected"
                            : "Live database count"}
                      </div>
                    </article>
                  );
                })}
              </section>

              {/* Growth and connectivity */}
              <section className="dashboard-grid">
                <article className="panel growth-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Platform Growth</h3>
                      <p>Institution registration history</p>
                    </div>
                  </div>

                  <div className="placeholder-panel">
                    <div className="placeholder-icon">
                      <ChartNoAxesCombined size={28} />
                    </div>

                    <h2>Growth analytics</h2>

                    <p>
                      Historical registration data will be connected
                      when the analytics query is implemented.
                    </p>
                  </div>
                </article>

                <article className="panel health-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Platform Connectivity</h3>
                      <p>Dashboard data connection</p>
                    </div>
                  </div>

                  <div className="health-list">
                    <div>
                      <span>
                        <i className="health-green" />
                        Supabase authentication
                      </span>

                      <strong>Connected</strong>
                    </div>

                    <div>
                      <span>
                        <i className="health-green" />
                        Database queries
                      </span>

                      <strong>
                        {loading
                          ? "Checking"
                          : dashboardError
                            ? "Error"
                            : "Responding"}
                      </strong>
                    </div>
                  </div>

                  <p className="health-note">
                    This reports the dashboard's connection only. It is
                    not a full infrastructure uptime measurement.
                  </p>
                </article>
              </section>

              {/* Institutions and activity */}
              <section className="bottom-grid">
                <article className="panel institutions-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Institutions</h3>
                      <p>Recently registered institutions</p>
                    </div>

                    <button
                      className="text-link"
                      onClick={() => setActivePage("Institutions")}
                    >
                      View all
                      <ArrowUpRight size={15} />
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>INSTITUTION</th>
                          <th>CITY</th>
                          <th>STATUS</th>
                          <th>CREATED</th>
                        </tr>
                      </thead>

                      <tbody>
                        {!loading &&
                          dashboard.institutions.map((institution) => (
                            <tr key={institution.id}>
                              <td>
                                <div className="institution-cell">
                                  <div className="institution-avatar">
                                    {getInitials(
                                      institution.institution_name
                                    )}
                                  </div>

                                  <div>
                                    <strong>
                                      {institution.institution_name}
                                    </strong>
                                  </div>
                                </div>
                              </td>

                              <td>{institution.city || "—"}</td>

                              <td>
                                <span
                                  className={`status-badge ${
                                    institution.status?.toLowerCase() ||
                                    "unknown"
                                  }`}
                                >
                                  {institution.status || "Unknown"}
                                </span>
                              </td>

                              <td>
                                {formatDate(institution.created_at)}
                              </td>
                            </tr>
                          ))}

                        {!loading &&
                          !dashboardError &&
                          dashboard.institutions.length === 0 && (
                            <tr>
                              <td colSpan={4}>
                                No institutions have been registered yet.
                              </td>
                            </tr>
                          )}

                        {loading && (
                          <tr>
                            <td colSpan={4}>
                              Loading institutions...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Recent Activity</h3>
                      <p>Platform events</p>
                    </div>
                  </div>

                  <div className="placeholder-panel">
                    <div className="placeholder-icon">
                      <ClipboardList size={27} />
                    </div>

                    <h2>Activity feed not connected</h2>

                    <p>
                      No activity records are being displayed until we
                      connect a verified audit-event source.
                    </p>
                  </div>
                </article>
              </section>
            </>
          ) : (
            /* Placeholder for other sections */
            <section className="panel placeholder-panel">
              <div className="placeholder-icon">
                <LayoutDashboard size={28} />
              </div>

              <h2>{activePage}</h2>

              <p>
                This section is ready for implementation. We'll connect
                it to the AttendFlow database in the next stages.
              </p>

              <button
                className="primary-button"
                onClick={() => setActivePage("Overview")}
              >
                Back to Overview
              </button>
            </section>
          )}

          {/* Footer */}
          <footer className="footer">
            <span>© 2026 AttendFlow Platform</span>

            <span>
              Platform Administration Console <b>•</b> v1.0
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
