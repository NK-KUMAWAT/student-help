import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
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
  GraduationCap,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Sparkles,
  Target,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type NavKey = "overview" | "profile" | "roadmap" | "matches" | "practice" | "refer";

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

type ExtractedResume = {
  fileName: string;
  resumeId: number;
  summary: string;
  reviewNotes: string;
  skills: { name: string; level: number; evidence: string }[];
};

const navItems: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "profile", label: "My profile", icon: UserRound },
  { key: "roadmap", label: "Skill roadmap", icon: Target },
  { key: "matches", label: "Job matches", icon: BriefcaseBusiness },
  { key: "practice", label: "Practice room", icon: Code2 },
  { key: "refer", label: "Refer & Earn", icon: UsersRound },
];

const initialSkills: Skill[] = [
  { name: "React", level: 82, tone: "mint" },
  { name: "JavaScript", level: 74, tone: "blue" },
  { name: "SQL", level: 58, tone: "amber" },
  { name: "DSA", level: 42, tone: "pink" },
];

const moves: Move[] = [
  {
    id: 1,
    label: "Close your DSA gap",
    detail: "Complete 2 array patterns to unlock 6 new roles.",
    tag: "25 min",
    icon: Code2,
  },
  {
    id: 2,
    label: "Refresh your resume",
    detail: "Your impact statements are missing measurable outcomes.",
    tag: "10 min",
    icon: FileText,
  },
  {
    id: 3,
    label: "Practice a frontend screen",
    detail: "A timed React round is ready for your current level.",
    tag: "35 min",
    icon: Gauge,
  },
];

const jobs = [
  { company: "Mosaic Labs", role: "Frontend Engineer", match: 88, location: "Bengaluru · Hybrid", logo: "M" },
  { company: "Northstar AI", role: "React Developer", match: 84, location: "Remote · India", logo: "N" },
  { company: "Orbit Systems", role: "Product Engineer", match: 79, location: "Pune · On-site", logo: "O" },
];

const suggestedSkills: Skill[] = [
  { name: "TypeScript", level: 18, tone: "blue" },
  { name: "Node.js", level: 24, tone: "mint" },
  { name: "System design", level: 12, tone: "pink" },
];

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
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<NavKey>("overview");
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [completedMoves, setCompletedMoves] = useState<number[]>([2]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [extractedResume, setExtractedResume] = useState<ExtractedResume | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const extractResumeMutation = trpc.resume.extractSkills.useMutation({
    onSuccess: (result) => {
      const extracted = result as ExtractedResume;
      setExtractedResume(extracted);
      extracted.skills.forEach((skill) => addSkill({ name: skill.name, level: skill.level, tone: "mint" }));
      toast.success(`${extracted.skills.length} skills extracted from your resume.`);
    },
    onError: (error) => toast.error(error.message || "Resume extraction failed. Please try again."),
  });
  const saveResumeMutation = trpc.resume.saveEdits.useMutation({
    onSuccess: () => toast.success("Your edited skills were saved."),
    onError: (error) => toast.error(error.message || "Could not save skill edits."),
  });

  const displayName = user?.name || "Aarav Mehta";
  const firstName = displayName.split(" ")[0];
  const profileCompletion = Math.min(100, 62 + (skills.length - initialSkills.length) * 6);
  const filteredJobs = useMemo(
    () => jobs.filter((job) => `${job.company} ${job.role} ${job.location}`.toLowerCase().includes(jobSearch.toLowerCase())),
    [jobSearch],
  );

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

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={17} strokeWidth={2.6} /></div>
          <div>
            <span className="brand-name">pathfinder</span>
            <span className="brand-caption">career OS for students</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item ${activeView === key ? "is-active" : ""}`} onClick={() => changeView(key)}>
              <Icon size={17} />
              <span>{label}</span>
              {key === "matches" ? <span className="nav-count">12</span> : null}
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
        <button className="help-link" onClick={() => toast.info("Guidance centre will be connected in the next build.")}>
          <CircleHelp size={16} />
          <span>Guidance centre</span>
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
            <span className="demo-pill"><span /> Demo workspace</span>
            <span className="live-clock"><Clock3 size={14} /> {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
            <button className="icon-button" onClick={() => toast.info("You're all caught up.")} aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="top-avatar" onClick={() => changeView("profile")} aria-label="Open profile">{displayName.charAt(0).toUpperCase()}</button>
          </div>
        </header>

        <div className="page-wrap">
          {activeView === "overview" ? (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow eyebrow--green"><span className="status-dot" /> SPRINT 06 · PLACEMENT SEASON</p>
                  <h1>Good morning, {firstName}<span className="heading-dot">.</span></h1>
                  <p className="welcome-copy">Your next opportunity is closer than your last commit. Here’s the clearest path forward today.</p>
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
                    <button className="quiet-button" onClick={() => resumeInputRef.current?.click()}><Upload size={15} /> Upload resume</button>
                    <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" className="visually-hidden" onChange={(event) => handleResumeChange(event.target.files?.[0])} />
                  </div>
                </div>
                <div className="hero-card__visual">
                  <div className="orbit orbit--one" /><div className="orbit orbit--two" />
                  <div className="hero-badge hero-badge--top"><BarChart3 size={15} /><span>+18%<small>this month</small></span></div>
                  <div className="hero-ring"><span>4.2</span><small>skill score</small></div>
                  <div className="hero-badge hero-badge--bottom"><div className="mini-stack"><span>R</span><span>J</span><span>S</span></div><span>3 roles<small>newly unlocked</small></span></div>
                </div>
              </section>

              <section className="metric-grid">
                <div className="metric-card metric-card--accent"><div className="metric-label"><span>Profile strength</span><Gauge size={16} /></div><strong>{profileCompletion}%</strong><div className="metric-foot"><span className="trend-up">+8% <ArrowUpRight size={12} /></span> from last week</div></div>
                <div className="metric-card"><div className="metric-label"><span>Role matches</span><BriefcaseBusiness size={16} /></div><strong>12</strong><div className="metric-foot"><span className="trend-up">+3 new</span> since Monday</div></div>
                <div className="metric-card"><div className="metric-label"><span>Practice streak</span><Flame size={16} /></div><strong>06 <small>days</small></strong><div className="metric-foot"><span className="trend-warm">Keep it going</span> 2 sessions left</div></div>
              </section>

              <div className="content-grid content-grid--main">
                <section className="panel moves-panel">
                  <SectionHeading eyebrow="RECOMMENDED FOR YOU" title="Your next best moves" action="See all" />
                  <div className="move-list">
                    {moves.map((move) => {
                      const complete = completedMoves.includes(move.id);
                      const Icon = move.icon;
                      return <div className={`move-row ${complete ? "is-complete" : ""}`} key={move.id}>
                        <button className="check-button" onClick={() => toggleMove(move.id)} aria-label={complete ? `Mark ${move.label} incomplete` : `Mark ${move.label} complete`}>{complete ? <Check size={14} /> : null}</button>
                        <div className="move-icon"><Icon size={17} /></div>
                        <div className="move-copy"><strong>{move.label}</strong><span>{move.detail}</span></div>
                        <span className="move-tag">{move.tag}</span>
                        <button className="row-arrow" onClick={() => changeView(move.id === 1 ? "roadmap" : move.id === 2 ? "profile" : "practice")} aria-label={`Open ${move.label}`}><ChevronRight size={17} /></button>
                      </div>;
                    })}
                  </div>
                </section>

                <section className="panel score-panel">
                  <SectionHeading eyebrow="READINESS SNAPSHOT" title="Your profile at a glance" />
                  <div className="score-layout"><ProgressRing value={profileCompletion} /><div className="score-copy"><strong>Looking good, {firstName}.</strong><p>You’re ahead of 68% of students in your cohort. Add one project to reach “interview ready”.</p><button className="text-button" onClick={() => changeView("profile")}>Improve profile <ArrowUpRight size={15} /></button></div></div>
                  <div className="score-divider" />
                  <div className="score-meta"><div><span>Projects</span><strong>2 <small>/ 3 recommended</small></strong></div><div><span>Core skills</span><strong>{skills.length} <small>tracked</small></strong></div></div>
                </section>
              </div>

              <div className="content-grid content-grid--bottom">
                <section className="panel skills-panel">
                  <SectionHeading eyebrow="SKILL VELOCITY" title="What’s moving your score" action="Manage skills" />
                  <div className="skill-list">
                    {skills.slice(0, 4).map((skill) => <div className="skill-row" key={skill.name}><div className={`skill-dot skill-dot--${skill.tone}`} /><strong>{skill.name}</strong><div className="skill-track"><span className={`skill-fill skill-fill--${skill.tone}`} style={{ width: `${skill.level}%` }} /></div><span className="skill-level">{skill.level}%</span></div>)}
                  </div>
                </section>
                <section className="panel pulse-panel">
                  <SectionHeading eyebrow="MARKET PULSE" title="Roles hiring around you" />
                  <div className="pulse-main"><div className="pulse-number">+24<span>%</span></div><div><strong>Frontend roles</strong><p>more listings this week</p></div><div className="sparkline"><span style={{ height: "38%" }} /><span style={{ height: "54%" }} /><span style={{ height: "46%" }} /><span style={{ height: "68%" }} /><span style={{ height: "61%" }} /><span style={{ height: "86%" }} /><span style={{ height: "100%" }} /></div></div>
                  <div className="pulse-footer"><span><span className="legend-dot legend-dot--green" /> React</span><span>1,240 open roles</span><ChevronRight size={16} /></div>
                </section>
              </div>
            </>
          ) : null}

          {activeView === "profile" ? <ProfileView displayName={displayName} email={user?.email || "aarav.mehta@campus.edu"} skills={skills} extraction={extractedResume} isExtracting={extractResumeMutation.isPending} isSaving={saveResumeMutation.isPending} onSaveExtraction={(next) => { setExtractedResume(next); saveResumeMutation.mutate({ resumeId: next.resumeId, skills: next.skills, summary: next.summary, reviewNotes: next.reviewNotes }); }} onAddSkill={addSkill} onUpload={() => resumeInputRef.current?.click()} /> : null}
          {activeView === "roadmap" ? <RoadmapView completedMoves={completedMoves} onToggle={toggleMove} onBack={() => changeView("overview")} /> : null}
          {activeView === "matches" ? <MatchesView jobs={filteredJobs} search={jobSearch} onSearch={setJobSearch} onBack={() => changeView("overview")} /> : null}
          {activeView === "practice" ? <PracticeView onBack={() => changeView("overview")} /> : null}
          {activeView === "refer" ? <ReferralView onBack={() => changeView("overview")} /> : null}
        </div>
      </main>
    </div>
  );
}

function ProfileView({ displayName, email, skills, extraction, isExtracting, isSaving, onSaveExtraction, onAddSkill, onUpload }: { displayName: string; email: string; skills: Skill[]; extraction: ExtractedResume | null; isExtracting: boolean; isSaving: boolean; onSaveExtraction: (next: ExtractedResume) => void; onAddSkill: (skill: Skill) => void; onUpload: () => void }) {
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><UserRound size={14} /> YOUR PROFILE</p><h1>Make your signal clearer.</h1><p>Recruiters see your profile before they see your potential. Keep the signal sharp.</p></div><button className="primary-button" onClick={() => toast.success("Profile changes saved in this prototype.")}><Check size={16} /> Save changes</button></div>
    <div className="profile-layout"><section className="panel profile-card"><div className="profile-card__top"><div className="avatar avatar--large">{displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><span className="verified-label"><span /> Profile visible to recruiters</span><h2>{displayName}</h2><p>{email}</p></div></div><div className="profile-fields"><label>Headline<input defaultValue="B.Tech CSE student · Frontend developer" /></label><label>University<input defaultValue="National Institute of Technology" /></label><label>Graduation year<input defaultValue="2026" /></label></div><button className={`upload-card ${isExtracting ? "is-uploading" : ""}`} onClick={onUpload} disabled={isExtracting}><div className="upload-icon">{isExtracting ? <Sparkles size={18} className="spin-slow" /> : <Upload size={18} />}</div><div><strong>{isExtracting ? "AI is reading your resume…" : extraction ? "Analyze another resume" : "Upload latest resume"}</strong><span>{isExtracting ? "Extracting skills and evidence" : extraction ? `${extraction.fileName} · analyzed just now` : "PDF, DOC or DOCX · up to 6 MB"}</span></div><ChevronRight size={17} /></button>{extraction ? <div className="extraction-card"><div className="extraction-card__heading"><div><span className="eyebrow eyebrow--green"><Sparkles size={13} /> AI RESUME READ</span><h3>{extraction.skills.length} skills found</h3></div><span className="extraction-badge"><Check size={12} /> Saved</span></div><p>{extraction.summary}</p><div className="extracted-skill-grid">{extraction.skills.slice(0, 6).map((skill) => <div className="extracted-skill" key={skill.name}><div><strong>{skill.name}</strong><span>{skill.level}% signal</span></div><div className="skill-track"><span className="skill-fill skill-fill--mint" style={{ width: `${skill.level}%` }} /></div><small>{skill.evidence}</small></div>)}</div></div> : null}</section>
       <section className="panel profile-skills"><SectionHeading eyebrow="YOUR SKILL GRAPH" title={`${skills.length} skills tracked`} />{extraction ? <EditableExtraction extraction={extraction} isSaving={isSaving} onSave={onSaveExtraction} /> : null}<div className="skill-list skill-list--profile">{skills.map((skill) => <div className="skill-row" key={skill.name}><div className={`skill-dot skill-dot--${skill.tone}`} /><strong>{skill.name}</strong><div className="skill-track"><span className={`skill-fill skill-fill--${skill.tone}`} style={{ width: `${skill.level}%` }} /></div><span className="skill-level">{skill.level}%</span></div>)}</div><div className="suggested-box"><div><Sparkles size={16} /><strong>Suggested next</strong></div><p>These skills can raise your role match fastest.</p><div className="suggested-chips">{suggestedSkills.map((skill) => <button key={skill.name} onClick={() => onAddSkill(skill)}><Plus size={13} /> {skill.name}</button>)}</div></div></section></div>
  </div>;
}

function EditableExtraction({ extraction, isSaving, onSave }: { extraction: ExtractedResume; isSaving: boolean; onSave: (next: ExtractedResume) => void }) {
  const [draft, setDraft] = useState(extraction);
  return <div className="edit-review-box"><div className="edit-review-heading"><span className="eyebrow eyebrow--green"><Sparkles size={13} /> SECOND AI REVIEW</span><span>Review and edit before saving</span></div>{draft.skills.map((skill, index) => <div className="edit-skill-row" key={`${skill.name}-${index}`}><input value={skill.name} onChange={(event) => setDraft({ ...draft, skills: draft.skills.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /><input type="number" min="1" max="100" value={skill.level} onChange={(event) => setDraft({ ...draft, skills: draft.skills.map((item, itemIndex) => itemIndex === index ? { ...item, level: Number(event.target.value) } : item) })} /><button className="remove-skill" onClick={() => setDraft({ ...draft, skills: draft.skills.filter((_, itemIndex) => itemIndex !== index) })}><X size={13} /></button></div>)}<button className="text-button" onClick={() => setDraft({ ...draft, skills: [...draft.skills, { name: "New skill", level: 50, evidence: "Added by student" }] })}><Plus size={13} /> Add skill</button><button className="dark-button dark-button--small save-review-button" disabled={isSaving} onClick={() => onSave(draft)}>{isSaving ? "Saving…" : "Save reviewed skills"} <Check size={14} /></button></div>;
}

function ReferralView({ onBack }: { onBack: () => void }) {
  const referralCode = "AARAV-PATH26";
  const [copied, setCopied] = useState(false);
  const inviteLink = `https://pathfinder.app/join/${referralCode}`;
  const copyLink = async () => {
    await navigator.clipboard?.writeText(inviteLink);
    setCopied(true);
    toast.success("Referral link copied.");
    window.setTimeout(() => setCopied(false), 2200);
  };
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><UsersRound size={14} /> COMMUNITY GROWTH</p><h1>Help a friend find their path.</h1><p>Invite classmates to Pathfinder and earn rewards when they complete their first career sprint.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><section className="referral-hero"><div><span className="eyebrow">REFER & EARN</span><h2>₹100 for every friend<br />who gets interview-ready.</h2><p>Your friend gets a 14-day Pro pass. You earn wallet credit after their first completed sprint.</p><div className="invite-link"><span>{inviteLink}</span><button onClick={copyLink}><Copy size={14} /> {copied ? "Copied" : "Copy link"}</button></div></div><div className="referral-hero-art"><div className="referral-orbit referral-orbit--one" /><div className="referral-orbit referral-orbit--two" /><div className="referral-coin">₹</div><div className="referral-float referral-float--top">+₹100</div><div className="referral-float referral-float--bottom"><UsersRound size={14} /> 3 friends</div></div></section><div className="referral-stats"><div className="referral-stat"><span>Total earned</span><strong>₹300</strong><small>Available to redeem</small></div><div className="referral-stat"><span>Successful referrals</span><strong>3</strong><small>2 this month</small></div><div className="referral-stat"><span>Pending rewards</span><strong>₹100</strong><small>1 friend in progress</small></div></div><div className="referral-grid"><section className="panel referral-steps"><SectionHeading eyebrow="HOW IT WORKS" title="Three steps, one good nudge" /><div className="referral-step"><span>01</span><div><strong>Share your invite</strong><p>Send your personal link to a classmate or friend.</p></div></div><div className="referral-step"><span>02</span><div><strong>They start their sprint</strong><p>Your friend joins and completes their first roadmap sprint.</p></div></div><div className="referral-step"><span>03</span><div><strong>You get rewarded</strong><p>₹100 credit lands in your rewards wallet.</p></div></div></section><section className="panel referral-activity"><SectionHeading eyebrow="RECENT ACTIVITY" title="Your referral circle" action="View wallet" /><div className="referral-person"><div className="avatar avatar--small">RK</div><div><strong>Riya Kapoor</strong><span>Completed first sprint</span></div><b>+₹100</b></div><div className="referral-person"><div className="avatar avatar--small avatar--blue">AS</div><div><strong>Arjun Singh</strong><span>Started a roadmap</span></div><em>Pending</em></div><div className="referral-person"><div className="avatar avatar--small avatar--pink">PM</div><div><strong>Priya Mehta</strong><span>Completed first sprint</span></div><b>+₹100</b></div></section></div></div>;
}

function RoadmapView({ completedMoves, onToggle, onBack }: { completedMoves: number[]; onToggle: (id: number) => void; onBack: () => void }) {
  const roadmapSteps = [{ id: 1, week: "This week", title: "Close your DSA gap", text: "Arrays, hash maps and two-pointer patterns", status: completedMoves.includes(1) ? "Complete" : "In progress", color: "green" }, { id: 2, week: "Next week", title: "Ship one proof project", text: "Build a role-shaped React dashboard with an API", status: "Queued", color: "blue" }, { id: 3, week: "Week 08", title: "Practice the real screen", text: "Two timed frontend interviews with feedback", status: "Locked", color: "pink" }];
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><Target size={14} /> SKILL ROADMAP</p><h1>A plan you can actually finish.</h1><p>Small, role-relevant sprints. No endless course playlists.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="roadmap-banner"><div className="roadmap-banner__number">01</div><div><span className="eyebrow">CURRENT MISSION</span><h2>Become interview-ready for frontend roles</h2><p>Three focused sprints · 4h 20m estimated</p></div><div className="roadmap-banner__progress"><strong>34%</strong><span>complete</span></div></div><div className="roadmap-list">{roadmapSteps.map((step, index) => <div className="roadmap-step" key={step.id}><div className={`timeline-dot timeline-dot--${step.color} ${step.status === "Complete" ? "is-done" : ""}`}>{step.status === "Complete" ? <Check size={14} /> : index + 1}</div>{index < roadmapSteps.length - 1 ? <div className="timeline-line" /> : null}<div className="roadmap-step__copy"><span className="eyebrow">{step.week}</span><h3>{step.title}</h3><p>{step.text}</p></div><div className={`status-chip status-chip--${step.color}`}>{step.status}</div><button className="row-arrow" onClick={() => onToggle(step.id)} aria-label={`Toggle ${step.title}`}><ChevronRight size={17} /></button></div>)}</div></div>;
}

function MatchesView({ jobs, search, onSearch, onBack }: { jobs: { company: string; role: string; match: number; location: string; logo: string }[]; search: string; onSearch: (value: string) => void; onBack: () => void }) {
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><BriefcaseBusiness size={14} /> JOB MATCHES</p><h1>Roles that fit your signal.</h1><p>Ranked by your current skills, interests and the gaps you can close.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="match-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search roles, companies or locations" /></div><span>{jobs.length} of 12 matches shown</span></div><div className="job-list">{jobs.length ? jobs.map((job) => <div className="job-card" key={job.company}><div className="company-logo">{job.logo}</div><div className="job-card__copy"><span>{job.company}</span><h3>{job.role}</h3><p>{job.location}</p></div><div className="match-score"><strong>{job.match}%</strong><span>match</span></div><button className="dark-button dark-button--small" onClick={() => toast.success(`${job.role} at ${job.company} saved to your shortlist.`)}>Shortlist <Plus size={15} /></button></div>) : <div className="empty-state"><Search size={20} /><strong>No roles found</strong><p>Try a broader search term.</p></div>}</div></div>;
}

function PracticeView({ onBack }: { onBack: () => void }) {
  return <div className="subpage"><div className="subpage-heading"><div><p className="eyebrow eyebrow--green"><Code2 size={14} /> PRACTICE ROOM</p><h1>Practice with a point of view.</h1><p>Short, focused drills that mirror the roles you want.</p></div><button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button></div><div className="practice-grid"><div className="practice-card practice-card--featured"><div className="practice-card__top"><span className="practice-label">RECOMMENDED</span><div className="practice-icon"><Code2 size={18} /></div></div><h2>React component screen</h2><p>Build a filterable user list with accessible states and clean component boundaries.</p><div className="practice-meta"><span><BookOpen size={14} /> 8 prompts</span><span><Flame size={14} /> 35 min</span></div><button className="dark-button" onClick={() => toast.success("Practice room opened. Timer ready in the next build.")}>Start practice <ChevronRight size={16} /></button></div><div className="practice-card"><div className="practice-card__top"><span className="practice-label practice-label--muted">WARM UP</span><div className="practice-icon practice-icon--blue"><BarChart3 size={18} /></div></div><h2>SQL for product analytics</h2><p>Translate a product question into a query and explain the tradeoffs.</p><div className="practice-meta"><span><BookOpen size={14} /> 6 prompts</span><span><Flame size={14} /> 20 min</span></div><button className="quiet-button quiet-button--border" onClick={() => toast.info("SQL warm-up will open in the next build.")}>View drill <ChevronRight size={16} /></button></div><div className="practice-card"><div className="practice-card__top"><span className="practice-label practice-label--muted">FOUNDATIONS</span><div className="practice-icon practice-icon--pink"><GraduationCap size={18} /></div></div><h2>Tell your project story</h2><p>Turn your strongest project into a clear two-minute interview narrative.</p><div className="practice-meta"><span><BookOpen size={14} /> 5 prompts</span><span><Flame size={14} /> 15 min</span></div><button className="quiet-button quiet-button--border" onClick={() => toast.info("Story coach will open in the next build.")}>View drill <ChevronRight size={16} /></button></div></div></div>;
}
