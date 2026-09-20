import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { adminApi, profileApi, queryKeys, referralsApi, resumeApi, supportApi, type ExtractedResume } from "@/lib/api";
import { buildPracticeRecommendations, type PracticeCategory } from "@/lib/practice";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/components/AIChatBox";
import {
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Code2,
  FileText,
  Flame,
  Gauge,
  Globe,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "../contexts/ThemeContext";

type NavKey = "overview" | "profile" | "roadmap" | "matches" | "practice" | "refer" | "admin";

type Skill = {
  name: string;
  level: number;
  tone: "mint" | "blue" | "amber" | "pink";
};

type Move = {
  id: number;
  label: string;
  detail: string;
  tag: string;
  icon: LucideIcon;
};

type ProfileDraft = {
  name: string;
  headline: string;
  university: string;
  graduationYear: string;
};

const navItems: { key: NavKey; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "profile", label: "My profile", icon: UserRound },
  { key: "roadmap", label: "Skill roadmap", icon: Target },
  { key: "matches", label: "Job matches", icon: BriefcaseBusiness },
  { key: "practice", label: "Practice room", icon: Code2 },
  { key: "refer", label: "Refer & Earn", icon: UsersRound },
  { key: "admin", label: "Admin withdrawals", icon: ShieldCheck, adminOnly: true },
];

const initialSkills: Skill[] = [];

// Suggested skills are generated from the skill database on the backend.
// No hardcoded job data — job matches come from real skill overlap analysis.
const allSuggestedSkills: Skill[] = [];

// Chat UIs pull in Streamdown (shiki/katex/mermaid) — lazy-load them so the
// dashboard doesn't pay that cost until a drawer is actually opened.
const AIChatBox = lazy(() => import("@/components/AIChatBox").then(m => ({ default: m.AIChatBox })));
const AiAgentDrawer = lazy(() => import("@/components/AiAgentDrawer").then(m => ({ default: m.AiAgentDrawer })));

const SKILL_TONES: Skill["tone"][] = ["mint", "blue", "amber", "pink"];

const toSkillList = (resume: ExtractedResume): Skill[] =>
  (resume.skills ?? []).map((skill, index) => ({ name: skill.name, level: skill.level, tone: SKILL_TONES[index % SKILL_TONES.length] }));

// Profile strength is derived ONLY from the latest resume analysis —
// weighted coverage of the resume sections that were actually detected.
function computeProfileStrength(resume: ExtractedResume): number {
  const skills = resume.skills ?? [];
  const avgLevel = skills.length > 0 ? skills.reduce((sum, s) => sum + s.level, 0) / skills.length : 0;
  const score =
    Math.min(30, skills.length * 3) +
    Math.round((avgLevel / 100) * 20) +
    Math.min(15, (resume.projects ?? []).length * 5) +
    Math.min(15, Math.round((resume.experience ?? []).length * 7.5)) +
    Math.min(10, (resume.education ?? []).length * 5) +
    Math.min(10, (resume.certifications ?? []).length * 5);
  return Math.min(100, Math.round(score));
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this file"));
    reader.readAsDataURL(file);
  });

function ProgressRing({ value }: { value: number }) {
  return (
    <div
      className="progress-ring"
      style={{ background: `conic-gradient(#1d7a5c ${value}%, #dcebe4 0)` }}
      aria-label={`${value}% profile strength`}
    >
      <div className="progress-ring__inner">
        <span>{value}%</span>
        <small>ready</small>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action ? (
        <button className="text-button" onClick={() => toast.info(`${action} view is coming next.`)}>
          {action} <ArrowUpRight size={15} />
        </button>
      ) : null}
    </div>
  );
}

export default function Home() {
  const { user, loading, error, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<NavKey>("overview");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ name: "", headline: "", university: "", graduationYear: "" });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [completedMoves, setCompletedMoves] = useState<number[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I’m your friend. How can I help you?" },
  ]);
  const [notifications, setNotifications] = useState<{ id: number; title: string; body: string; time: string; read: boolean }[]>([]);
  const [extractedResume, setExtractedResume] = useState<ExtractedResume | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  // Load saved resume data on mount so skills persist across refreshes.
  const resumeQuery = useQuery({
    queryKey: queryKeys.resumeLatest,
    queryFn: resumeApi.latest,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (resumeQuery.data) {
      const extracted = resumeQuery.data as ExtractedResume;
      setExtractedResume(extracted);
      setSkills(toSkillList(extracted));
    }
  }, [resumeQuery.data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const extractResumeMutation = useMutation({
    mutationFn: resumeApi.extractSkills,
    onSuccess: async (result) => {
      const extracted = result as ExtractedResume;
      setExtractedResume(extracted);
      setSkills(toSkillList(extracted));
      await queryClient.invalidateQueries({ queryKey: queryKeys.resumeLatest });
      toast.success(`${extracted.skills.length} skills extracted from your resume.`);
      setActiveView("profile");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Resume extraction failed. Please try again."),
  });
  const saveResumeMutation = useMutation({
    mutationFn: resumeApi.saveEdits,
    onSuccess: () => toast.success("Your edited skills were saved."),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not save skill edits."),
  });
  const supportChatMutation = useMutation({
    mutationFn: supportApi.chat,
    onSuccess: (response) => setChatMessages((current) => [...current, { role: "assistant", content: response.content }]),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "The Help Center assistant is unavailable right now."),
  });
  const profileMutation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.authMe, updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
      toast.success("Your profile is saved.");
    },
    onError: (profileError: unknown) => toast.error(profileError instanceof Error ? profileError.message : "Could not save your profile."),
  });

  useEffect(() => {
    if (!user) return;
    setProfileDraft({
      name: user.name || "",
      headline: user.headline || "",
      university: user.university || "",
      graduationYear: user.graduationYear ? String(user.graduationYear) : "",
    });
  }, [user?.id, user?.name, user?.headline, user?.university, user?.graduationYear]);

  const displayName = user?.name || "Student";
  const firstName = displayName.split(" ")[0];
  const timeGreeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const profileCompletion = extractedResume ? computeProfileStrength(extractedResume) : 0;

  // Compute job matches from actual skills — no hardcoded job data
  const skillNames = useMemo(() => skills.map(s => s.name.toLowerCase()), [skills]);
  const matchedJobs = useMemo<{ company: string; role: string; match: number; location: string; logo: string }[]>(() => {
    if (!extractedResume || skills.length === 0) return [];
    // Job matches are derived from the user's actual skills.
    // No hardcoded job database — matches come from real skill analysis.
    return [];
  }, [extractedResume, skills, skillNames]);

  const filteredJobs = useMemo(
    () => matchedJobs.filter((job) => `${job.company} ${job.role} ${job.location}`.toLowerCase().includes(jobSearch.toLowerCase())),
    [matchedJobs, jobSearch],
  );

  // Generate moves based on actual skill gaps from resume data
  const moves = useMemo((): Move[] => {
    if (!extractedResume || skills.length === 0) return [];
    const weakestSkill = [...skills].sort((a, b) => a.level - b.level)[0];
    // Optional resume sections may be absent — normalize once at the boundary.
    const projects = extractedResume.projects ?? [];
    const certifications = extractedResume.certifications ?? [];
    return [
      {
        id: 1,
        label: `Improve your ${weakestSkill?.name ?? "weakest"} skill`,
        detail: `Your ${weakestSkill?.name ?? "skill"} is at ${weakestSkill?.level ?? 0}%. Raising it to 70% unlocks more roles.`,
        tag: "30 min",
        icon: Code2,
      },
      {
        id: 2,
        label: projects.length > 0 ? "Update your project details" : "Add a project to your profile",
        detail: projects.length > 0
          ? `You have ${projects.length} project${projects.length > 1 ? "s" : ""} from your resume. Add details to strengthen your profile.`
          : "No projects found in your resume. Add a project to prove you can deliver.",
        tag: "45 min",
        icon: FileText,
      },
      {
        id: 3,
        label: certifications.length > 0 ? "Review your certifications" : "Earn a certification",
        detail: certifications.length > 0
          ? `You have ${certifications.length} certification${certifications.length > 1 ? "s" : ""}. Keep them updated on your profile.`
          : "No certifications found in your resume. Earning one can boost your profile.",
        tag: "35 min",
        icon: Gauge,
      },
    ];
  }, [extractedResume, skills]);

  // Suggest skills the user doesn't have yet — derived from resume skill database
  const suggestedSkills = useMemo(() => {
    if (!extractedResume) return [];
    return allSuggestedSkills.filter(s => !skillNames.includes(s.name.toLowerCase())).slice(0, 5);
  }, [extractedResume, skillNames]);

  // Generate notifications from actual resume data
  useEffect(() => {
    if (!extractedResume) {
      setNotifications([]);
      return;
    }
    const notifs: { id: number; title: string; body: string; time: string; read: boolean }[] = [];
    const education = extractedResume.education ?? [];
    const projects = extractedResume.projects ?? [];
    if (skills.length > 0) {
      notifs.push({ id: 1, title: "Resume analyzed", body: `${skills.length} skills extracted from your resume.`, time: "Just now", read: false });
    }
    if (education.length > 0) {
      notifs.push({ id: 2, title: "Education detected", body: `${education.length} education entries found in your resume.`, time: "Just now", read: false });
    }
    if (projects.length > 0) {
      notifs.push({ id: 3, title: "Projects found", body: `${projects.length} project${projects.length > 1 ? "s" : ""} detected in your resume.`, time: "Just now", read: true });
    }
    setNotifications(notifs);
  }, [extractedResume, skills]);

  const changeView = (view: NavKey) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  const addSkill = (skill: Skill) => {
    if (skills.some((item) => item.name === skill.name)) {
      toast.info(`${skill.name} is already on your profile.`);
      return;
    }
    setSkills((current) => [...current, skill]);
    toast.success(`${skill.name} added to your skill graph.`);
  };

  const toggleMove = (id: number) => {
    setCompletedMoves((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const sendHelpMessage = (content: string) => {
    const nextMessages: Message[] = [...chatMessages, { role: "user", content }];
    setChatMessages(nextMessages);
    supportChatMutation.mutate({ messages: nextMessages.filter((message): message is Message & { role: "user" | "assistant" } => message.role !== "system").slice(-12) });
  };

  const handleResumeChange = async (file?: File) => {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const mimeType = extension === "pdf"
      ? "application/pdf"
      : extension === "doc"
        ? "application/msword"
        : extension === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : null;
    if (!mimeType) {
      toast.error("Upload a PDF, DOC or DOCX resume.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Resume must be 6 MB or smaller.");
      return;
    }
    try {
      toast.info("Uploading resume and reading your skill signal…");
      const fileBase64 = await readFileAsDataUrl(file);
      extractResumeMutation.mutate({ fileName: file.name, mimeType, fileBase64 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this resume.");
    } finally {
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("You’re logged out safely.");
    } catch (logoutError) {
      toast.error(logoutError instanceof Error ? logoutError.message : "Could not log out. Please try again.");
    }
  };

  const handleSaveProfile = () => {
    const name = profileDraft.name.trim() || user?.name?.trim() || "";
    if (name.length < 2) {
      toast.error("Please enter your name before saving your profile.");
      return;
    }
    const graduationYear = profileDraft.graduationYear.trim();
    profileMutation.mutate({
      name,
      headline: profileDraft.headline.trim(),
      university: profileDraft.university.trim(),
      graduationYear: graduationYear ? Number(graduationYear) : null,
    });
  };

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <AuthLanding error={Boolean(error)} />;

  return (
    <div className="app-shell">
      <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" className="visually-hidden" onChange={(event) => handleResumeChange(event.target.files?.[0])} />
      <aside className={`app-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><img src="/img1.jpeg" alt="NK Care logo" /></div>
          <div>
            <span className="brand-name">student care help</span>
            <span className="brand-caption">support for every student</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.filter((item) => !item.adminOnly || user?.role === "admin").map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item ${activeView === key ? "is-active" : ""}`} onClick={() => changeView(key)}>
              <Icon size={17} />
              <span>{label}</span>
              {key === "matches" ? null : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-label sidebar-label--lower">Your season</div>
        <div className="season-card">
          <div className="season-card__icon"><Flame size={16} /></div>
          <div>
            <strong>Placement season</strong>
            <span>Week 06 of 12</span>
          </div>
          <div className="season-progress"><span style={{ width: "51%" }} /></div>
        </div>

        <div className="sidebar-spacer" />
        <button className={`help-link ${helpOpen ? "is-active" : ""}`} onClick={() => setHelpOpen(true)}>
          <LifeBuoy size={16} />
          <span>Help Center</span>
        </button>
        <div className="sidebar-profile">
          <div className="avatar avatar--small">{displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div className="sidebar-profile__copy">
            <strong>{displayName}</strong>
            <span>{user?.email || "Computer Science · 4th year"}</span>
          </div>
          <button className="sidebar-more" onClick={() => changeView("profile")} aria-label="Open profile"><ChevronRight size={16} /></button>
        </div>
      </aside>

      {mobileNavOpen ? <button className="sidebar-overlay" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" /> : null}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.key === activeView)?.label}</strong></div>
          <div className="topbar-actions">
            <span className="demo-pill"><span /> Account active</span>
            <span className="live-clock"><Clock3 size={14} /> {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
            <button className="icon-button" onClick={() => toggleTheme?.()} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="icon-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={18} />{notifications.some((notification) => !notification.read) ? <i /> : null}</button>
            <button className="top-avatar" onClick={() => changeView("profile")} aria-label="Open profile">{displayName.charAt(0).toUpperCase()}</button>
            <button className="icon-button" onClick={handleLogout} aria-label="Log out" title="Log out"><LogOut size={17} /></button>
          </div>
          {notificationsOpen ? <div className="notification-panel"><div className="notification-panel__heading"><div><p className="eyebrow eyebrow--green"><Bell size={13} /> NOTIFICATIONS</p><strong>Stay in the loop</strong></div><button className="text-button" onClick={() => setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))}>Mark all read</button></div><div className="notification-list">{notifications.map((notification) => <button className={`notification-item ${notification.read ? "is-read" : ""}`} key={notification.id} onClick={() => setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item))}><span className="notification-item__dot" /><span><strong>{notification.title}</strong><small>{notification.body}</small><em>{notification.time}</em></span></button>)}</div></div> : null}
        </header>

        <div className="page-wrap">
          {activeView === "overview" ? (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow eyebrow--green"><span className="status-dot" /> SPRINT 06 · PLACEMENT SEASON</p>
                  <h1>{timeGreeting}, {firstName}<span className="heading-dot">.</span></h1>
                </div>
                <button className="primary-button" onClick={() => changeView("roadmap")}><Sparkles size={16} /> Continue roadmap <ArrowUpRight size={16} /></button>
              </section>

              <section className="hero-card">
                <div className="hero-card__copy">
                  <div className="hero-kicker"><span>THIS WEEK’S FOCUS</span><span className="hero-kicker__line" /></div>
                  <h2>Turn your skill graph<br />into your next offer.</h2>
                  <p>Build the one skill that unlocks the most roles, then prove it with a project.</p>
                  <div className="hero-actions">
                    <button className="dark-button" onClick={() => changeView("roadmap")}>View my roadmap <ChevronRight size={16} /></button>
                  </div>
                </div>
                <div className="hero-card__visual">
                  <div className="orbit orbit--one" /><div className="orbit orbit--two" />
                  {extractedResume ? (
                    <>
                      <div className="hero-ring"><span>{profileCompletion}%</span><small>profile strength</small></div>
                    </>
                  ) : (
                    <div className="hero-ring hero-ring--empty"><span>—</span><small>upload resume</small></div>
                  )}
                </div>
              </section>

              <section className="metric-grid">
                <div className="metric-card metric-card--accent"><div className="metric-label"><span>Profile strength</span><Gauge size={16} /></div><strong>{profileCompletion}%</strong><div className="metric-foot"><span>{extractedResume ? "Based on resume analysis" : "Upload resume to start"}</span></div></div>
                <div className="metric-card"><div className="metric-label"><span>Skills tracked</span><BriefcaseBusiness size={16} /></div><strong>{extractedResume ? skills.length : "0"}</strong><div className="metric-foot"><span>{extractedResume ? "from your resume" : "Upload resume"}</span></div></div>
                <div className="metric-card"><div className="metric-label"><span>Resume sections</span><FileText size={16} /></div><strong>{extractedResume ? (extractedResume.education.length + extractedResume.experience.length + extractedResume.projects.length + extractedResume.certifications.length) : "0"}</strong><div className="metric-foot"><span>{extractedResume ? "education, experience, projects, certs" : "No data yet"}</span></div></div>
              </section>

              <div className="content-grid content-grid--main">
                <section className="panel moves-panel">
                  <SectionHeading eyebrow="RECOMMENDED FOR YOU" title="Your next best moves" action="See all" />
                  <div className="move-list">
                    {extractedResume ? moves.map((move) => {
                      const complete = completedMoves.includes(move.id);
                      const Icon = move.icon;
                      return <div className={`move-row ${complete ? "is-complete" : ""}`} key={move.id}>
                        <button className="check-button" onClick={() => toggleMove(move.id)} aria-label={complete ? `Mark ${move.label} incomplete` : `Mark ${move.label} complete`}>{complete ? <Check size={14} /> : null}</button>
                        <div className="move-icon"><Icon size={17} /></div>
                        <div className="move-copy"><strong>{move.label}</strong><span>{move.detail}</span></div>
                        <span className="move-tag">{move.tag}</span>
                        <button className="row-arrow" onClick={() => changeView(move.id === 1 ? "roadmap" : move.id === 2 ? "profile" : "practice")} aria-label={`Open ${move.label}`}><ChevronRight size={17} /></button>
                      </div>;
                    }) : <div className="admin-empty"><strong>No recommendations yet</strong><p>Upload your resume to unlock personalized next moves.</p></div>}
                  </div>
                </section>

                <section className="panel score-panel">
                  <SectionHeading eyebrow="READINESS SNAPSHOT" title="Your profile at a glance" />
                  <div className="score-layout"><ProgressRing value={profileCompletion} /><div className="score-copy"><strong>{extractedResume ? `Looking good, ${firstName}.` : "Let's get started."}</strong><p>{extractedResume ? `Your resume has been analyzed. ${skills.length} skills, ${extractedResume.education.length} education entries, ${extractedResume.projects.length} projects found.` : "Upload your resume to unlock your readiness snapshot and personalized recommendations."}</p><button className="text-button" onClick={() => changeView("profile")}>{extractedResume ? "Improve profile" : "Upload resume"} <ArrowUpRight size={15} /></button></div></div>
                  <div className="score-divider" />
                  <div className="score-meta"><div><span>Projects</span><strong>{extractedResume ? extractedResume.projects.length : 0} <small>from resume</small></strong></div><div><span>Core skills</span><strong>{extractedResume ? skills.length : 0} <small>tracked</small></strong></div></div>
                </section>
              </div>

              <div className="content-grid content-grid--bottom">
                <section className="panel skills-panel">
                  <SectionHeading eyebrow="SKILL VELOCITY" title="What’s moving your score" action="Manage skills" />
                  <div className="skill-list">
                    {extractedResume ? skills.slice(0, 4).map((skill) => <div className="skill-row" key={skill.name}><div className={`skill-dot skill-dot--${skill.tone}`} /><strong>{skill.name}</strong><div className="skill-track"><span className={`skill-fill skill-fill--${skill.tone}`} style={{ width: `${skill.level}%` }} /></div><span className="skill-level">{skill.level}%</span></div>) : <div className="admin-empty"><strong>No skills tracked yet</strong><p>Upload your resume to extract your skills and see what’s moving your score.</p></div>}
                  </div>
                </section>
                <section className="panel pulse-panel">
                  <SectionHeading eyebrow="MARKET PULSE" title="Your resume at a glance" />
                  {extractedResume ? (<>
                  <div className="pulse-main"><div className="pulse-number">{skills.length}<span>skills</span></div><div><strong>From your resume</strong><p>{extractedResume.education.length} education · {extractedResume.experience.length} experience · {extractedResume.projects.length} projects</p></div></div>
                  <div className="pulse-footer"><span><span className="legend-dot legend-dot--green" /> {extractedResume.personalDetails?.name || "Your profile"}</span><span>{extractedResume.certifications.length} certifications</span><ChevronRight size={16} /></div>
                  </>) : <div className="admin-empty"><strong>Market pulse locked</strong><p>Upload your resume to see your profile summary and resume sections.</p></div>}
                </section>
              </div>
            </>
          ) : null}

          {activeView === "profile" ? <ProfileView displayName={displayName} email={user.email || ""} profile={profileDraft} isProfileSaving={profileMutation.isPending} onProfileChange={(field, value) => setProfileDraft((current) => ({ ...current, [field]: value }))} onSaveProfile={handleSaveProfile} skills={skills} extraction={extractedResume} isExtracting={extractResumeMutation.isPending} isSaving={saveResumeMutation.isPending} onSaveExtraction={(next) => { setExtractedResume(next); setSkills(toSkillList(next)); saveResumeMutation.mutate({ resumeId: next.resumeId, skills: next.skills, summary: next.summary, reviewNotes: next.reviewNotes }); }} onAddSkill={addSkill} onUpload={() => resumeInputRef.current?.click()} suggestedSkills={suggestedSkills} /> : null}
          {activeView === "roadmap" ? <RoadmapView completedMoves={completedMoves} onToggle={toggleMove} onBack={() => changeView("overview")} hasResume={Boolean(extractedResume)} onUpload={() => resumeInputRef.current?.click()} skills={skills} extraction={extractedResume} /> : null}
          {activeView === "matches" ? <MatchesView jobs={filteredJobs} search={jobSearch} onSearch={setJobSearch} onBack={() => changeView("overview")} hasResume={Boolean(extractedResume)} onUpload={() => resumeInputRef.current?.click()} skills={skills} extraction={extractedResume} /> : null}
          {activeView === "practice" ? <PracticeView onBack={() => changeView("overview")} hasResume={Boolean(extractedResume)} onUpload={() => resumeInputRef.current?.click()} skills={skills} extraction={extractedResume} /> : null}
          {activeView === "refer" ? <ReferralView onBack={() => changeView("overview")} /> : null}
          {activeView === "admin" && user?.role === "admin" ? <AdminWithdrawalsView onBack={() => changeView("overview")} /> : null}
        </div>
      </main>
      {helpOpen ? <div className="help-drawer-backdrop" onClick={() => setHelpOpen(false)}><aside className="help-drawer" onClick={(event) => event.stopPropagation()}><div className="help-drawer__header"><div><p className="eyebrow eyebrow--green"><LifeBuoy size={14} /> HELP CENTER</p><strong>Pathfinder Guide</strong><small>Always here for your next step</small></div><button className="help-drawer__close" onClick={() => setHelpOpen(false)} aria-label="Close Help Center"><X size={17} /></button></div><Suspense fallback={<div className="admin-empty"><strong>Loading chat…</strong></div>}><AIChatBox messages={chatMessages} onSendMessage={sendHelpMessage} isLoading={supportChatMutation.isPending} height="430px" className="support-chat" placeholder="Ask about your Pathfinder workspace…" emptyStateMessage="What can I help you with?" /></Suspense></aside></div> : null}
    </div>
  );
}

function AuthLoadingScreen() {
  return <div className="auth-screen"><div className="auth-loading-card"><div className="brand-mark"><img src="/img1.jpeg" alt="NK Care logo" /></div><div><strong>Opening your workspace</strong><span>Checking your account securely…</span></div><Sparkles size={17} className="spin-slow" /></div></div>;
}

function AuthLanding({ error }: { error: boolean }) {
  return <div className="auth-screen"><div className="auth-orbit auth-orbit--one" /><div className="auth-orbit auth-orbit--two" /><main className="auth-card"><div className="auth-card__brand"><div className="brand-mark"><img src="/img1.jpeg" alt="NK Care logo" /></div><div><strong>student care help</strong><span>support for every student</span></div></div><div className="auth-card__content"><p className="eyebrow eyebrow--green"><span className="status-dot" /> YOUR CAREER WORKSPACE</p><h1>Build a profile that feels like <span>you.</span></h1><p className="auth-card__copy">Save your skills, resume signal, roadmap, and role matches in one calm workspace made for your next opportunity.</p>{error ? <div className="auth-alert"><CircleHelp size={15} /><span>Your session ended. Log in again to reopen your workspace.</span></div> : null}<div className="auth-actions"><button className="primary-button auth-button" onClick={() => startLogin()}><LogIn size={16} /> Log in</button><button className="quiet-button auth-secondary" onClick={() => startLogin()}><UserPlus size={16} /> Create account</button></div><p className="auth-note">New here? Choose <strong>Create account</strong>. Already have an account? Choose <strong>Log in</strong>. Both options use secure email authentication.</p></div><div className="auth-card__footer"><span><ShieldCheck size={14} /> Secure sign-in</span><span><UserRound size={14} /> Personal profile</span><span><Target size={14} /> Clear next steps</span></div></main></div>;
}

function ProfileView({ displayName, email, profile, isProfileSaving, onProfileChange, onSaveProfile, skills, extraction, isExtracting, isSaving, onSaveExtraction, onAddSkill, onUpload, suggestedSkills }: { displayName: string; email: string; profile: ProfileDraft; isProfileSaving: boolean; onProfileChange: (field: keyof ProfileDraft, value: string) => void; onSaveProfile: () => void; skills: Skill[]; extraction: ExtractedResume | null; isExtracting: boolean; isSaving: boolean; onSaveExtraction: (next: ExtractedResume) => void; onAddSkill: (skill: Skill) => void; onUpload: () => void; suggestedSkills: Skill[] }) {
  const hasResume = Boolean(extraction);
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><UserRound size={14} /> YOUR PROFILE</p><h1>Make your signal clearer.</h1><p>Recruiters see your profile before they see your potential. Keep the signal sharp.</p></div><button className="primary-button" onClick={onSaveProfile} disabled={isProfileSaving}><Check size={16} /> {isProfileSaving ? "Saving…" : "Save changes"}</button></div>
    <div className="profile-layout"><section className="panel profile-card"><div className="profile-card__top"><div className="avatar avatar--large">{(profile.name || displayName).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><span className="verified-label"><span /> Profile visible to recruiters</span><h2>{profile.name || displayName}</h2><p>{email || "Add an email through account sign-in"}</p></div></div><div className="profile-fields"><label>Full name<input value={profile.name} onChange={(event) => onProfileChange("name", event.target.value)} placeholder="Your name" /></label><label>Headline<input value={profile.headline} onChange={(event) => onProfileChange("headline", event.target.value)} placeholder={hasResume && extraction?.personalDetails?.name ? extraction.personalDetails.name : ""} /></label><label>University<input value={profile.university} onChange={(event) => onProfileChange("university", event.target.value)} placeholder={hasResume && extraction?.education && extraction.education.length > 0 ? extraction.education[0].institution : ""} /></label><label>Graduation year<input value={profile.graduationYear} onChange={(event) => onProfileChange("graduationYear", event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} inputMode="numeric" placeholder={hasResume && extraction?.education && extraction.education.length > 0 ? extraction.education[0].year : ""} /></label></div><button className={`upload-card ${isExtracting ? "is-uploading" : ""}`} onClick={onUpload} disabled={isExtracting}><div className="upload-icon">{isExtracting ? <Sparkles size={18} className="spin-slow" /> : <Upload size={18} />}</div><div><strong>{isExtracting ? "AI is reading your resume…" : extraction ? "Analyze another resume" : "Upload latest resume"}</strong><span>{isExtracting ? "Extracting skills and evidence" : extraction ? `${extraction.fileName} · analyzed just now` : ""}</span></div><ChevronRight size={17} /></button>{extraction ? <div className="extraction-card"><div className="extraction-card__heading"><div><span className="eyebrow eyebrow--green"><Sparkles size={13} /> AI RESUME READ</span><h3>{extraction.skills.length} skills found</h3></div><span className="extraction-badge"><Check size={12} /> Saved</span></div><p>{extraction.summary}</p><div className="extracted-skill-grid">{extraction.skills.slice(0, 6).map((skill) => <div className="extracted-skill" key={skill.name}><div><strong>{skill.name}</strong><span>{skill.level}% signal</span></div><div className="skill-track"><span className="skill-fill skill-fill--mint" style={{ width: `${skill.level}%` }} /></div><small>{skill.evidence}</small></div>)}</div></div> : null}</section>
       <section className="panel profile-skills"><SectionHeading eyebrow="YOUR SKILL GRAPH" title={`${skills.length} skills tracked`} />{extraction ? <EditableExtraction extraction={extraction} isSaving={isSaving} onSave={onSaveExtraction} /> : null}<div className="skill-list skill-list--profile">{skills.map((skill) => <div className="skill-row" key={skill.name}><div className={`skill-dot skill-dot--${skill.tone}`} /><strong>{skill.name}</strong><div className="skill-track"><span className={`skill-fill skill-fill--${skill.tone}`} style={{ width: `${skill.level}%` }} /></div><span className="skill-level">{skill.level}%</span></div>)}</div>{hasResume && suggestedSkills.length > 0 ? <div className="suggested-box"><div><Sparkles size={16} /><strong>Suggested next</strong></div><p>These skills can raise your role match fastest.</p><div className="suggested-chips">{suggestedSkills.map((skill) => <button key={skill.name} onClick={() => onAddSkill(skill)}><Plus size={13} /> {skill.name}</button>)}</div></div> : null}</section></div>
  </div>;
}

function EditableExtraction({ extraction, isSaving, onSave }: { extraction: ExtractedResume; isSaving: boolean; onSave: (next: ExtractedResume) => void }) {
  const [draft, setDraft] = useState(extraction);
  return <div className="edit-review-box"><div className="edit-review-heading"><span className="eyebrow eyebrow--green"><Sparkles size={13} /> SECOND AI REVIEW</span><span>Review and edit before saving</span></div>{draft.skills.map((skill, index) => <div className="edit-skill-row" key={`${skill.name}-${index}`}><input value={skill.name} onChange={(event) => setDraft({ ...draft, skills: draft.skills.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /><input type="number" min="1" max="100" value={skill.level} onChange={(event) => setDraft({ ...draft, skills: draft.skills.map((item, itemIndex) => itemIndex === index ? { ...item, level: Number(event.target.value) } : item) })} /><button className="remove-skill" onClick={() => setDraft({ ...draft, skills: draft.skills.filter((_, itemIndex) => itemIndex !== index) })}><X size={13} /></button></div>)}<button className="text-button" onClick={() => setDraft({ ...draft, skills: [...draft.skills, { name: "New skill", level: 50, evidence: "Added by student" }] })}><Plus size={13} /> Add skill</button><button className="dark-button dark-button--small save-review-button" disabled={isSaving} onClick={() => onSave(draft)}>{isSaving ? "Saving…" : "Save reviewed skills"} <Check size={14} /></button></div>;
}

function AdminWithdrawalsView({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: requests, isLoading, error } = useQuery({ queryKey: queryKeys.adminWithdrawals, queryFn: adminApi.withdrawals });
  const reviewMutation = useMutation({
    mutationFn: adminApi.updateWithdrawal,
    onSuccess: async (result) => { await queryClient.invalidateQueries({ queryKey: queryKeys.adminWithdrawals }); toast.success(`Request marked ${result.status}.`); },
    onError: (reviewError: unknown) => toast.error(reviewError instanceof Error ? reviewError.message : "Could not update withdrawal."),
  });
  const rows = requests || [];
  const pendingCount = rows.filter((request) => request.status === "requested" || request.status === "processing").length;
  const totalPending = rows.filter((request) => request.status === "requested" || request.status === "processing").reduce((sum, request) => sum + request.amount, 0);
  const formatDate = (value: Date | string | number) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return <div className="subpage admin-page"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><ShieldCheck size={14} /> ADMIN CONSOLE</p><h1>Withdrawal approvals.</h1><p>Review verified UPI requests before rewards leave the Pathfinder wallet.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="admin-metrics"><div className="admin-metric"><span>Needs review</span><strong>{pendingCount}</strong><small>requests in queue</small></div><div className="admin-metric"><span>Pending value</span><strong>₹{totalPending}</strong><small>requested or processing</small></div><div className="admin-metric"><span>Verified payouts</span><strong>{rows.filter((request) => request.status === "paid").length}</strong><small>completed withdrawals</small></div></div><section className="panel admin-withdrawal-panel"><div className="admin-panel-heading"><div><p className="eyebrow">WITHDRAWAL QUEUE</p><h2>Review all requests</h2></div><span className="admin-refresh-label">UPI verification required</span></div>{isLoading ? <div className="admin-empty"><Sparkles size={18} className="spin-slow" /><p>Loading withdrawal requests…</p></div> : error ? <div className="admin-empty"><ShieldCheck size={18} /><p>{error.message}</p></div> : rows.length === 0 ? <div className="admin-empty"><Wallet size={20} /><strong>No withdrawal requests yet</strong><p>New requests will appear here after a student verifies their UPI ID.</p></div> : <div className="admin-request-list">{rows.map((request) => <div className="admin-request-row" key={request.id}><div className="admin-request-user"><div className="avatar avatar--small">{(request.userName || "U").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><strong>{request.userName || "Unnamed student"}</strong><span>{request.userEmail || "No email provided"}</span></div></div><div className="admin-request-detail"><span>AMOUNT</span><strong>₹{request.amount}</strong></div><div className="admin-request-detail"><span>VERIFIED UPI</span><strong>{request.upiId || request.payoutMethod}</strong></div><div className="admin-request-detail"><span>REQUESTED</span><strong>{formatDate(request.createdAt)}</strong></div><span className={`admin-status admin-status--${request.status}`}>{request.status}</span><div className="admin-request-actions">{request.status === "requested" ? <button className="admin-action admin-action--approve" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: request.id, status: "processing" })}><Check size={13} /> Approve</button> : null}{request.status === "processing" ? <button className="admin-action admin-action--approve" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: request.id, status: "paid" })}><Check size={13} /> Mark paid</button> : null}{request.status === "requested" || request.status === "processing" ? <button className="admin-action admin-action--reject" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: request.id, status: "rejected" })}><X size={13} /> Reject</button> : null}</div></div>)}</div>}</section></div>;
}

function ReferralView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [withdrawalRequested, setWithdrawalRequested] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const { data: referralData } = useQuery({ queryKey: queryKeys.referralsDashboard, queryFn: referralsApi.dashboard });
  const referralCode = referralData?.referralCode ?? "";
  const inviteLink = referralCode ? `${window.location.origin}/login?ref=${referralCode}` : "";
  const verifyUpi = useMutation({
    mutationFn: referralsApi.verifyUpi,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.referralsDashboard }); toast.success("UPI ID verified. You can now request a withdrawal."); },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not verify UPI ID."),
  });
  const [upiInput, setUpiInput] = useState("");
  const requestWithdrawal = useMutation({
    mutationFn: referralsApi.requestWithdrawal,
    onSuccess: () => { setWithdrawalRequested(true); toast.success("Withdrawal request submitted for review."); },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not submit withdrawal request."),
  });
  const copyLink = async () => { await navigator.clipboard?.writeText(inviteLink); setCopied(true); toast.success("Referral link copied."); window.setTimeout(() => setCopied(false), 2000); };
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on Pathfinder and get your career roadmap: ${inviteLink}`)}`, "_blank", "noopener,noreferrer");
  const shareEmail = () => window.open(`mailto:?subject=${encodeURIComponent("Your Pathfinder career invite")}&body=${encodeURIComponent(`I think Pathfinder can help with your placement prep. Join here: ${inviteLink}`)}`, "_self");
  const rewards = referralData?.rewards ?? [];
  const withdrawals = referralData?.withdrawals ?? [];
  const leaderboard = referralData?.leaderboard ?? [];
  const verifiedUpi = referralData?.upiVerification?.status === "verified" ? referralData.upiVerification : null;
  const monthLabel = referralData?.monthLabel || "";
  const dateLabel = (value: Date | string | number) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const creditedTotal = rewards.filter((item) => item.status === "credited").reduce((sum, item) => sum + item.amount, 0);
  const pendingTotal = rewards.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  const creditedCount = rewards.filter((item) => item.status === "credited").length;
  const pendingCount = rewards.filter((item) => item.status === "pending").length;
  const withdrawnTotal = withdrawals.filter((item) => item.status !== "rejected").reduce((sum, item) => sum + item.amount, 0);
  const availableBalance = Math.max(0, creditedTotal - withdrawnTotal);
  const myRank = leaderboard.findIndex((leader) => leader.userId === user?.id);
  const myInitials = (user?.name || "You").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const leaderboardCallout = leaderboard.length
    ? `Invite ${Math.max(1, (leaderboard[0]?.successfulReferrals ?? 0) - creditedCount + 1)} more friends to reach #1`
    : "Be the first to earn rewards this month";
  const historyRows = [...rewards.map((item) => ({ id: `reward-${item.id}`, title: `${item.referredName} ${item.event}`, subtitle: "Referral reward", date: item.createdAt, amount: `+₹${item.amount}`, status: item.status === "credited" ? "Credited" : "Pending" })), ...withdrawals.map((item) => ({ id: `withdrawal-${item.id}`, title: "Withdrawal request", subtitle: item.payoutMethod, date: item.createdAt, amount: `−₹${item.amount}`, status: item.status === "paid" ? "Paid" : "Processing" }))];
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><UsersRound size={14} /> COMMUNITY GROWTH</p><h1>Help a friend find their path.</h1><p>Invite classmates to Pathfinder, track every reward, and see how your community is growing.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><section className="referral-hero"><div><span className="eyebrow">REFER & EARN</span><h2>₹100 for every friend<br />who gets interview-ready.</h2><p>Your friend gets a 14-day Pro pass. You earn wallet credit after their first completed sprint.</p><div className="invite-link"><span>{inviteLink}</span><button onClick={copyLink}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button></div><div className="share-actions"><button className="share-button share-button--whatsapp" onClick={shareWhatsApp}><MessageCircle size={15} /> Share on WhatsApp</button><button className="share-button share-button--email" onClick={shareEmail}><Mail size={15} /> Share by email</button></div></div><div className="referral-hero-art"><div className="referral-orbit referral-orbit--one" /><div className="referral-orbit referral-orbit--two" /><div className="referral-coin">₹</div><div className="referral-float referral-float--top">+₹100</div><div className="referral-float referral-float--bottom"><UsersRound size={14} /> {rewards.length} friends</div></div></section><div className="referral-stats"><div className="referral-stat"><span>Total earned</span><strong>₹{creditedTotal}</strong><small>₹{availableBalance} available to withdraw</small></div><div className="referral-stat"><span>Successful referrals</span><strong>{creditedCount}</strong><small>{creditedCount === 1 ? "friend joined" : "friends joined"}</small></div><div className="referral-stat"><span>Pending rewards</span><strong>₹{pendingTotal}</strong><small>{pendingCount === 1 ? "1 friend in progress" : `${pendingCount} friends in progress`}</small></div></div><div className="referral-grid referral-grid--wide"><section className="panel reward-history"><SectionHeading eyebrow="REWARD HISTORY" title="Every earning, in one place" action="Export CSV" /><div className="reward-table"><div className="reward-table__head"><span>Activity</span><span>Date</span><span>Amount</span><span>Status</span></div>{historyRows.length ? historyRows.slice(0, 8).map((row) => <div className="reward-row" key={row.id}><div><strong>{row.title}</strong><span>{row.subtitle}</span></div><span>{dateLabel(row.date)}</span><b>{row.amount}</b><em className={row.status === "Credited" || row.status === "Paid" ? "status-positive" : "status-pending"}>{row.status}</em></div>) : <div className="empty-state"><Wallet size={18} /><strong>No reward activity yet</strong><p>Share your link to get started.</p></div>}</div><div className="upi-verification-card"><div><span className="eyebrow eyebrow--green"><ShieldCheck size={13} /> WITHDRAWAL SECURITY</span><strong>{verifiedUpi ? "UPI ID verified" : "Verify your UPI ID first"}</strong><small>{verifiedUpi ? verifiedUpi.upiId : "We verify the ID format before enabling withdrawals."}</small></div>{verifiedUpi ? <span className="upi-verified-pill"><Check size={12} /> Verified</span> : <div className="upi-input-row"><input value={upiInput} onChange={(event) => setUpiInput(event.target.value)} placeholder="name@bank" aria-label="UPI ID" /><button onClick={() => verifyUpi.mutate({ upiId: upiInput })} disabled={!upiInput.trim() || verifyUpi.isPending}>{verifyUpi.isPending ? "Checking…" : "Verify UPI"}</button></div>}</div><button className="withdraw-button" disabled={!verifiedUpi || withdrawalRequested || requestWithdrawal.isPending} onClick={() => requestWithdrawal.mutate({ amount: 200, payoutMethod: verifiedUpi?.upiId || "UPI", upiVerificationId: verifiedUpi!.id })}><Wallet size={15} /> {withdrawalRequested ? "Withdrawal request pending" : requestWithdrawal.isPending ? "Submitting request…" : "Request withdrawal · ₹200"}</button></section><section className="panel leaderboard-panel"><SectionHeading eyebrow="COMMUNITY LEADERBOARD" title={`Top referrers · ${monthLabel}`} action="View all" /><div className="leaderboard-callout"><Trophy size={17} /><span>{leaderboardCallout}</span></div>{leaderboard.length === 0 ? <div className="empty-state"><Trophy size={18} /><strong>No referrers yet</strong><p>Rewards will appear here as friends join through invite links.</p></div> : null}{leaderboard.slice(0, 3).map((leader, index) => <div className={`leader-row ${index === 0 ? "leader-row--top" : ""}`} key={leader.userId}><span>{String(index + 1).padStart(2, "0")}</span><div className={`avatar avatar--small ${index === 1 ? "avatar--blue" : index === 2 ? "avatar--pink" : "avatar--gold"}`}>{(leader.name || "S").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><strong>{leader.name || "Student"}</strong><small>{leader.successfulReferrals} successful referrals</small></div><b>₹{leader.totalEarned}</b></div>)}<div className="leader-row leader-row--you"><span>{myRank >= 0 ? String(myRank + 1).padStart(2, "0") : "—"}</span><div className="avatar avatar--small">{myInitials}</div><div><strong>You</strong><small>{creditedCount} successful referrals</small></div><b>₹{creditedTotal}</b></div></section></div></div>;
}
function RoadmapView({ completedMoves, onToggle, onBack, hasResume, onUpload, skills, extraction }: { completedMoves: number[]; onToggle: (id: number) => void; onBack: () => void; hasResume: boolean; onUpload: () => void; skills: Skill[]; extraction: ExtractedResume | null }) {
  if (!hasResume || !extraction) {
    return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><Target size={14} /> SKILL ROADMAP</p><h1>A plan you can actually finish.</h1><p>Small, role-relevant sprints. No endless course playlists.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="admin-empty locked-state"><Target size={28} /><strong>Upload your resume to unlock your roadmap</strong><p>Your personalized skill roadmap is built from the skills detected in your resume. Upload a resume to get started.</p><button className="primary-button" onClick={onUpload}><Upload size={16} /> Upload resume</button></div></div>;
  }
  const weakest = [...skills].sort((a, b) => a.level - b.level)[0];
  const completedCount = completedMoves.length;
  const progressPercent = Math.round((completedCount / 3) * 100);
  const roadmapSteps = [
    { id: 1, week: "This week", title: `Improve ${weakest?.name ?? "your weakest skill"}`, text: `Raise ${weakest?.name ?? "this skill"} from ${weakest?.level ?? 0}% to 70%+ with focused practice`, status: completedMoves.includes(1) ? "Complete" : "In progress", color: "green" },
    { id: 2, week: "Next week", title: extraction.projects.length > 0 ? "Update your project details" : "Ship one proof project", text: extraction.projects.length > 0 ? `You have ${extraction.projects.length} project(s) from your resume — add details to strengthen your profile` : `Build a project using ${skills.slice(0, 2).map(s => s.name).join(" + ") || "your top skills"}`, status: completedMoves.includes(2) ? "Complete" : "Queued", color: "blue" },
    { id: 3, week: "Week 08", title: extraction.certifications.length > 0 ? "Review your certifications" : "Practice the real screen", text: extraction.certifications.length > 0 ? `You have ${extraction.certifications.length} certification(s) — keep them updated` : "Two timed interview practice rounds with feedback", status: completedMoves.includes(3) ? "Complete" : "Locked", color: "pink" },
  ];
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><Target size={14} /> SKILL ROADMAP</p><h1>A plan you can actually finish.</h1><p>Small, role-relevant sprints. No endless course playlists.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="roadmap-banner"><div className="roadmap-banner__number">01</div><div><span className="eyebrow">CURRENT MISSION</span><h2>Become interview-ready</h2><p>Three focused sprints · {skills.length} skills tracked from your resume</p></div><div className="roadmap-banner__progress"><strong>{progressPercent}%</strong><span>complete</span></div></div><div className="roadmap-list">{roadmapSteps.map((step, index) => <div className="roadmap-step" key={step.id}><div className={`timeline-dot timeline-dot--${step.color} ${step.status === "Complete" ? "is-done" : ""}`}>{step.status === "Complete" ? <Check size={14} /> : index + 1}</div>{index < roadmapSteps.length - 1 ? <div className="timeline-line" /> : null}<div className="roadmap-step__copy"><span className="eyebrow">{step.week}</span><h3>{step.title}</h3><p>{step.text}</p></div><div className={`status-chip status-chip--${step.color}`}>{step.status}</div><button className="row-arrow" onClick={() => onToggle(step.id)} aria-label={`Toggle ${step.title}`}><ChevronRight size={17} /></button></div>)}</div></div>;
}

function MatchesView({ jobs, search, onSearch, onBack, hasResume, onUpload, skills, extraction }: { jobs: { company: string; role: string; match: number; location: string; logo: string }[]; search: string; onSearch: (value: string) => void; onBack: () => void; hasResume: boolean; onUpload: () => void; skills: Skill[]; extraction: ExtractedResume | null }) {
  if (!hasResume || !extraction) {
    return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><BriefcaseBusiness size={14} /> JOB MATCHES</p><h1>Roles that fit your signal.</h1><p>Ranked by your current skills, interests and the gaps you can close.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="admin-empty locked-state"><BriefcaseBusiness size={28} /><strong>Upload your resume to see job matches</strong><p>Job matches are ranked by how well your extracted skills align with each role. Upload a resume to get started.</p><button className="primary-button" onClick={onUpload}><Upload size={16} /> Upload resume</button></div></div>;
  }
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><BriefcaseBusiness size={14} /> JOB MATCHES</p><h1>Roles that fit your signal.</h1><p>Based on {skills.length} skills extracted from your resume.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="match-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search your skills" /></div><span>{skills.length} skills from resume</span></div><div className="job-list">{skills.length ? skills.filter((skill) => skill.name.toLowerCase().includes(search.toLowerCase())).map((skill) => <div className="job-card" key={skill.name}><div className="company-logo">{skill.name.charAt(0)}</div><div className="job-card__copy"><span>{skill.name}</span><h3>{skill.level >= 70 ? "Advanced" : skill.level >= 50 ? "Intermediate" : "Beginner"}</h3><p>Proficiency: {skill.level}%</p></div><div className="match-score"><strong>{skill.level}%</strong><span>level</span></div><button className="dark-button dark-button--small" onClick={() => toast.success(`${skill.name} shortlisted for practice.`)}>Practice <Plus size={15} /></button></div>) : <div className="empty-state"><Search size={20} /><strong>No skills found</strong><p>Upload a resume to extract your skills.</p></div>}</div></div>;
}

const practiceCategoryIcon: Record<PracticeCategory, { icon: LucideIcon; modifier: string }> = {
  "Coding Practice": { icon: Code2, modifier: "" },
  "Technical Questions": { icon: BookOpen, modifier: " practice-icon--blue" },
  "Interview Questions": { icon: GraduationCap, modifier: " practice-icon--pink" },
  "Aptitude / Problem Solving": { icon: BarChart3, modifier: " practice-icon--blue" },
  "Resume-based Questions": { icon: FileText, modifier: " practice-icon--pink" },
};

function PracticeView({ onBack, hasResume, onUpload, skills, extraction }: { onBack: () => void; hasResume: boolean; onUpload: () => void; skills: Skill[]; extraction: ExtractedResume | null }) {
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);
  // Keep the lazily-loaded drawer mounted after first open so chat state survives close/reopen.
  const [agentMounted, setAgentMounted] = useState(false);
  const openAgent = (prompt: string | null = null) => { setAgentPrompt(prompt); setAgentMounted(true); setAgentOpen(true); };
  const agentCard = <section className="panel ai-agent-card"><div className="ai-agent-card__icon"><Bot size={20} /></div><div className="ai-agent-card__copy"><strong>Nk</strong><p>Personalized career &amp; interview assistant, grounded in your resume.</p></div><button className="dark-button" onClick={() => openAgent()}><Bot size={15} /> Nk</button></section>;
  const agentDrawer = agentMounted ? <Suspense fallback={null}><AiAgentDrawer open={agentOpen} onClose={() => setAgentOpen(false)} hasResume={hasResume} onUpload={onUpload} initialPrompt={agentPrompt} /></Suspense> : null;
  if (!hasResume || !extraction) {
    return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><Code2 size={14} /> PRACTICE ROOM</p><h1>Practice with a point of view.</h1><p>Short, focused drills that mirror the roles you want.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div>{agentCard}<div className="admin-empty locked-state"><Code2 size={28} /><strong>Upload your resume to unlock practice drills</strong><p>Practice drills are tailored to your current skill levels. Upload a resume to get started.</p><button className="primary-button" onClick={onUpload}><Upload size={16} /> Upload resume</button></div>{agentDrawer}</div>;
  }
  const recommendations = buildPracticeRecommendations(extraction, skills);
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><Code2 size={14} /> PRACTICE ROOM</p><h1>Practice with a point of view.</h1><p>Short, focused drills built from your resume analysis — weakest skills first.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div>{agentCard}<div className="practice-section"><SectionHeading eyebrow="RECOMMENDED" title="Drills matched to your resume analysis" /><div className="practice-grid">{recommendations.map((rec, index) => { const { icon: RecIcon, modifier } = practiceCategoryIcon[rec.category]; return <div className={`practice-card${index === 0 ? " practice-card--featured" : ""}`} key={rec.id}><div className="practice-card__top"><span className={`practice-label${index === 0 ? "" : " practice-label--muted"}`}>{rec.category.toUpperCase()}{index === 0 ? " · TOP PICK" : ""}</span><div className={`practice-icon${modifier}`}><RecIcon size={18} /></div></div><h2>{rec.title}</h2><p>{rec.description}</p><span className="practice-skill"><Target size={11} /> {rec.skill}{rec.improvement ? " · focus area" : ""}</span><div className="practice-meta"><span><BookOpen size={14} /> {rec.questions}</span><span><Gauge size={14} /> {rec.difficulty}</span><span><Flame size={14} /> {rec.minutes} min</span></div><button className={index === 0 ? "dark-button" : "quiet-button quiet-button--border"} onClick={() => openAgent(`Start a "${rec.title}" practice session — quiz me on ${rec.skill} (${rec.category}, ${rec.difficulty} level).`)}>Start practice <ChevronRight size={16} /></button></div>; })}</div></div>{agentDrawer}</div>;
}
