"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  erasForCollection,
  filterWorks,
  getAsset,
  localized,
  paginate,
  visibleWorks,
} from "@/lib/content/utils";
import type {
  Artist,
  CollectionId,
  ContentDocument,
  FeedbackAttachment,
  LocalizedText,
  Work,
} from "@/lib/types";

type DrawerName = "logs" | "feedback" | null;
const MAX_FEEDBACK_FILE_SIZE = 10 * 1024 * 1024;
interface MuseumClientProps {
  content: ContentDocument;
}

function text(value: LocalizedText, locale: "zh" | "en") {
  return localized(value, locale);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeUploadName(value: string) {
  const basename = value.split(/[\\/]/).pop() || "upload";
  return basename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "upload";
}

function Icon({ name }: { name: "arrow" | "close" }) {
  if (name === "arrow") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "close") return <span aria-hidden="true">×</span>;
  return null;
}

function MediaImage({
  asset,
  alt,
  className,
}: {
  asset?: { url: string; status: string; alt?: LocalizedText };
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!asset || asset.status !== "active" || !asset.url || failed) {
    return <div className={`media-placeholder ${className || ""}`} role="img" aria-label={`${alt}（待补资源）`}><span>待补资源</span></div>;
  }
  return <img className={className} src={asset.url} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function Header({
  locale,
  scrolled,
  onLogs,
  onFeedback,
  onWestern,
  onChina,
}: {
  locale: "zh" | "en";
  scrolled: boolean;
  onLogs: () => void;
  onFeedback: () => void;
  onWestern: () => void;
  onChina: () => void;
}) {
  const zh = locale === "zh";
  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <a className="brand" href="#top" onClick={() => onWestern()}>GPNU Milk Frog</a>
      <div className="header-actions">
        <nav aria-label={zh ? "主导航" : "Main navigation"}>
          <button type="button" onClick={onLogs}>{zh ? "更新日志" : "Updates"}</button>
          <button type="button" onClick={onFeedback}>{zh ? "意见箱" : "Feedback"}</button>
        </nav>
        <button className="visit-btn" type="button" onClick={onChina}>{zh ? "参观中国馆" : "China Museum"}</button>
      </div>
    </header>
  );
}

function FloatingSchoolBadge() {
  const [motion, setMotion] = useState({ left: 48, top: 26, rotate: 0 });

  useEffect(() => {
    const size = 100;
    const margin = 12;
    const safeInset = Math.ceil((Math.sqrt(2) * size - size) / 2) + margin;
    let timer: number | undefined;

    const move = () => {
      const maxLeft = window.innerWidth - size - safeInset;
      const maxTop = window.innerHeight - size - safeInset;
      const leftRange = Math.max(0, maxLeft - safeInset);
      const topRange = Math.max(0, maxTop - safeInset);
      setMotion({
        left: leftRange ? safeInset + Math.random() * leftRange : Math.max(0, (window.innerWidth - size) / 2),
        top: topRange ? safeInset + Math.random() * topRange : Math.max(0, (window.innerHeight - size) / 2),
        rotate: Math.round(Math.random() * 360 - 180),
      });
      timer = window.setTimeout(move, 2200 + Math.random() * 1800);
    };

    move();
    const handleResize = () => move();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <a
      className="school-badge-float"
      href="https://gpnu.edu.cn"
      aria-label="访问广东技术师范大学官网"
      style={{ left: motion.left, top: motion.top, transform: `rotate(${motion.rotate}deg)` }}
    >
      <img src="/school-badge.png" alt="广东技术师范大学校徽" />
    </a>
  );
}

function MobileEntry({
  visible,
  leaving,
  locale,
  videoUrl,
  onEnter,
}: {
  visible: boolean;
  leaving: boolean;
  locale: "zh" | "en";
  videoUrl?: string;
  onEnter: () => void;
}) {
  if (!visible) return null;
  const zh = locale === "zh";
  return (
    <div className={`mobile-entry ${leaving ? "entering" : ""}`} role="dialog" aria-hidden={leaving ? "true" : "false"} aria-label={zh ? "进入奶蛙博物馆" : "Enter Milk Frog Museum"}>
      {videoUrl ? <video src={videoUrl} autoPlay muted loop playsInline preload="auto" /> : <div className="mobile-entry-fallback" />}
      <div className="mobile-entry-wash" />
      <div className="mobile-entry-content">
        <span>MUSÉE DU MILK FROG</span>
        <h1>{zh ? "奶蛙博物馆" : "Milk Frog Museum"}</h1>
        <button type="button" aria-label={zh ? "进入博物馆" : "Enter museum"} onClick={onEnter}><Icon name="arrow" /></button>
      </div>
    </div>
  );
}

function Drawer({
  locale,
  content,
  onClose,
}: {
  locale: "zh" | "en";
  content: ContentDocument;
  onClose: () => void;
}) {
  const zh = locale === "zh";
  return (
    <aside className="drawer update-log open" aria-hidden="false">
      <div className="drawer-head">
        <div><span className="drawer-kicker">MUSÉE DU MILK FROG</span><h2>{zh ? "更新日志" : "Updates"}</h2></div>
        <button className="drawer-close" type="button" aria-label={zh ? "关闭" : "Close"} onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="log-list">
        {content.logs.filter((entry) => entry.visible).sort((a, b) => a.order - b.order).map((entry) => (
          <article className="log-entry" key={entry.id}><time dateTime={entry.date}>{entry.date.replaceAll("-", ".")}</time><h3>{text(entry.title, locale)}</h3><p>{text(entry.body, locale)}</p></article>
        ))}
      </div>
    </aside>
  );
}

function FeedbackPanel({
  locale,
  onClose,
}: {
  locale: "zh" | "en";
  onClose: () => void;
}) {
  const zh = locale === "zh";
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function addFiles(input: FileList | null) {
    if (!input) return;
    const incoming = Array.from(input);
    const oversized = incoming.filter((file) => file.size > MAX_FEEDBACK_FILE_SIZE);
    const valid = incoming.filter((file) => file.size <= MAX_FEEDBACK_FILE_SIZE);
    const messages = [];
    if (oversized.length) messages.push(zh ? `${oversized.length} 个文件超过 10 MB，未添加。` : `${oversized.length} file(s) exceed 10 MB and were not added.`);
    if (valid.length > 1) messages.push(zh ? "一次只能上传一个文件，已保留第一个。" : "Only one file can be uploaded at a time; the first was kept.");
    if (messages.length) setStatus(messages.join(" "));
    if (valid.length) setFiles([valid[0]]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = message.trim();
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (!value) {
      setStatus(zh ? "请先写下你的意见。" : "Please write a note first.");
      return;
    }
    if (files.length > 1 || files.some((file) => file.size > MAX_FEEDBACK_FILE_SIZE) || total > 10 * 1024 * 1024) {
      setStatus(zh ? "只能上传一个文件，且文件不能超过 10 MB。" : "Only one file can be uploaded, and it must be no larger than 10 MB.");
      return;
    }
    setSubmitting(true);
    setStatus(zh ? "正在投递意见……" : "Submitting your note…");
    const submissionId = crypto.randomUUID().replaceAll("-", "");
    try {
      const attachments: FeedbackAttachment[] = [];
      for (const file of files) {
        const pathname = `feedback/${submissionId}/${crypto.randomUUID()}-${safeUploadName(file.name)}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/feedback/upload",
          clientPayload: JSON.stringify({ submissionId }),
          multipart: file.size > 4.5 * 1024 * 1024,
          contentType: file.type || "application/octet-stream",
        });
        attachments.push({ id: pathname.split("/").pop() || pathname, pathname: blob.pathname, filename: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      }
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: submissionId, message: value, attachments }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "Feedback submission failed");
      }
      setMessage("");
      setFiles([]);
      setStatus(zh ? "意见已投递到博物馆后台，谢谢。" : "Your note has reached the museum inbox. Thank you.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (zh ? "投递失败，请稍后再试。" : "Submission failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="drawer feedback-panel open" aria-hidden="false">
      <div className="drawer-head"><div><span className="drawer-kicker">MUSÉE DU MILK FROG</span><h2>{zh ? "意见箱" : "Feedback"}</h2></div><button className="drawer-close" type="button" aria-label={zh ? "关闭意见箱" : "Close feedback"} onClick={onClose}><Icon name="close" /></button></div>
      <form className="feedback-form" onSubmit={submit}>
        <p className="feedback-lead">{zh ? "告诉馆长你希望下一次看到什么。" : "Tell the curator what you would like to see next."}</p>
        <textarea className="feedback-text" value={message} onChange={(event) => setMessage(event.target.value)} rows={7} maxLength={10000} placeholder={zh ? "写下你的意见……" : "Write your note…"} aria-label={zh ? "意见内容" : "Feedback message"} />
        <label className="file-label"><span>{zh ? "添加图片或文件（不超过 10 MB）" : "Add one image or file (10 MB maximum)"}</span><input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} /></label>
        <div className="feedback-files" aria-live="polite">{files.map((file, index) => <div className="feedback-file" key={`${file.name}-${index}`}><span className="feedback-file-name">{file.name}</span><span className="feedback-file-size">{formatBytes(file.size)}</span><button className="feedback-file-remove" type="button" aria-label={`${zh ? "删除" : "Remove "}${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></div>)}</div>
        <button className="feedback-submit" type="submit" disabled={submitting}>{submitting ? (zh ? "投递中……" : "Submitting…") : (zh ? "投递意见" : "Submit note")}</button>
        <p className="feedback-status" aria-live="polite">{status}</p>
      </form>
    </aside>
  );
}

function CollectionView({
  content,
  locale,
  collection,
  onOpenWork,
}: {
  content: ContentDocument;
  locale: "zh" | "en";
  collection: CollectionId;
  onOpenWork: (work: Work, sequence: Work[]) => void;
}) {
  const zh = locale === "zh";
  const works = useMemo(() => visibleWorks(content, collection), [content, collection]);
  const eras = useMemo(() => erasForCollection(content, collection), [content, collection]);
  const [eraId, setEraId] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterWorks(works, eraId), [works, eraId]);
  const paged = useMemo(() => paginate(filtered, page, 6), [filtered, page]);

  return (
    <section className="collection-section" id="collection">
      <div className="collection-shell">
        <div className="collection-head"><div>{collection === "china" && <div className="sub">{zh ? "中国奶蛙典藏系列" : "The Chinese Milk Frog Collection"}</div>}<h2>{collection === "china" ? (zh ? "中国馆" : "China Museum") : (zh ? "典藏系列" : "The Collection")}</h2></div><span className="collection-count">{works.length} {zh ? "件作品" : "works"}</span></div>
        <div className="filters" aria-label={zh ? "年代筛选" : "Era filters"}>
          <button className={`filter-button ${eraId === "all" ? "active" : ""}`} type="button" onClick={() => { setEraId("all"); setPage(1); }}>{zh ? "全部" : "All"}</button>
          {eras.map((era) => <button className={`filter-button ${eraId === era.id ? "active" : ""}`} type="button" key={era.id} onClick={() => { setEraId(era.id); setPage(1); }}>{text(era.label, locale)}</button>)}
        </div>
        <div className="gallery">
          {paged.items.map((work) => {
            const asset = getAsset(content, work.primaryAssetId);
            const era = content.eras.find((entry) => entry.id === work.eraId);
            const artist = content.artists.find((entry) => entry.id === work.artistId);
            return <button className="card" type="button" key={work.id} aria-label={`${zh ? "查看作品：" : "View work: "}${text(work.title, locale)}`} onClick={() => onOpenWork(work, filtered)}>
              <div className="card-media"><MediaImage asset={asset} alt={text(work.title, locale)} /><span className="card-index">{work.accession}</span></div>
              <div className="card-meta"><div className="card-era">{era ? text(era.label, locale) : work.eraId}</div><h3>{text(work.title, locale)}</h3><div className="card-original"><span>{text(work.originalTitle, locale)} · {artist ? text(artist.displayName, locale) : "Unknown"}</span><span className="card-year">{work.year}</span></div></div>
            </button>;
          })}
          {!paged.items.length && <div className="empty-state">{zh ? "暂无内容" : "No works are on view."}</div>}
        </div>
        {paged.pageCount > 1 && <nav className="pagination" aria-label={zh ? "作品分页" : "Work pagination"}>
          <button type="button" aria-label={zh ? "上一页" : "Previous page"} disabled={paged.page <= 1} onClick={() => setPage((current) => current - 1)}>‹</button>
          {Array.from({ length: paged.pageCount }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={number === paged.page ? "active" : ""} aria-current={number === paged.page ? "page" : undefined} aria-label={`${zh ? "第" : "Page "}${number}${zh ? "页" : ""}`} onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" aria-label={zh ? "下一页" : "Next page"} disabled={paged.page >= paged.pageCount} onClick={() => setPage((current) => current + 1)}>›</button>
        </nav>}
      </div>
    </section>
  );
}

function Lightbox({
  content,
  locale,
  work,
  sequence,
  onClose,
  onOpenArtist,
  onMove,
}: {
  content: ContentDocument;
  locale: "zh" | "en";
  work: Work;
  sequence: Work[];
  onClose: () => void;
  onOpenArtist: (artist: Artist) => void;
  onMove: (work: Work) => void;
}) {
  const zh = locale === "zh";
  const asset = getAsset(content, work.primaryAssetId);
  const era = content.eras.find((entry) => entry.id === work.eraId);
  const artist = content.artists.find((entry) => entry.id === work.artistId);
  const index = sequence.findIndex((entry) => entry.id === work.id);
  const move = (offset: number) => {
    if (!sequence.length) return;
    const next = sequence[(index + offset + sequence.length) % sequence.length];
    onMove(next);
  };
  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-label={text(work.title, locale)} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="lightbox-panel">
        <button className="modal-close" type="button" aria-label={zh ? "关闭作品" : "Close work"} onClick={onClose}><Icon name="close" /></button>
        <div className="lightbox-visual">
          <div className="lightbox-front"><MediaImage asset={asset} alt={text(work.title, locale)} /></div>
          <button className="lightbox-control prev" type="button" aria-label={zh ? "上一件作品" : "Previous work"} onClick={() => move(-1)}>‹</button><button className="lightbox-control next" type="button" aria-label={zh ? "下一件作品" : "Next work"} onClick={() => move(1)}>›</button>
        </div>
        <div className="lightbox-copy"><div className="kicker">{era ? text(era.label, locale) : work.eraId}</div><h2>{text(work.title, locale)}</h2><p className="original">{text(work.originalTitle, locale)}</p><div className="detail-row"><span>{zh ? "馆藏编号" : "Accession"}</span><span>{work.accession}</span></div><div className="detail-row"><span>{zh ? "艺术家" : "Artist"}</span><span>{artist ? <button className="artist-trigger" type="button" onClick={() => onOpenArtist(artist)}>{text(artist.displayName, locale)}</button> : "Unknown"}</span></div><div className="detail-row"><span>{zh ? "年代" : "Date"}</span><span>{work.year}</span></div><div className="detail-copy"><h3>{zh ? "作品介绍" : "About the work"}</h3><p>{text(work.introduction, locale)}</p></div></div>
      </div>
    </div>
  );
}

function ArtistModal({ artist, content, locale, onClose }: { artist: Artist; content: ContentDocument; locale: "zh" | "en"; onClose: () => void }) {
  const zh = locale === "zh";
  const portrait = getAsset(content, artist.portraitAssetId);
  return <div className="modal open" role="dialog" aria-modal="true" aria-label={text(artist.displayName, locale)} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="artist-modal-inner"><button className="modal-close" type="button" aria-label={zh ? "关闭艺术家资料" : "Close artist"} onClick={onClose}><Icon name="close" /></button>{portrait && <MediaImage asset={portrait} alt={text(artist.displayName, locale)} className="artist-portrait" />}<h2>{text(artist.displayName, locale)}</h2><p className="life">{artist.life || (zh ? "生平待补" : "Biography pending")}</p><p className="artist-story">{text(artist.story, locale)}</p></div></div>;
}

export default function MuseumClient({ content }: MuseumClientProps) {
  const locale = "zh" as const;
  const [scrolled, setScrolled] = useState(false);
  const [entryVisible, setEntryVisible] = useState(false);
  const [entryLeaving, setEntryLeaving] = useState(false);
  const [collection, setCollection] = useState<CollectionId>("western");
  const [drawer, setDrawer] = useState<DrawerName>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<Work[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  const heroVideo = getAsset(content, content.site.heroVideoAssetId);
  const selectedWork = selectedWorkId ? content.works.find((work) => work.id === selectedWorkId) : undefined;
  const selectedArtist = selectedArtistId ? content.artists.find((artist) => artist.id === selectedArtistId) : undefined;

  const moveWork = useCallback((offset: number) => {
    if (!selectedWork || !selectedSequence.length) return;
    const index = selectedSequence.findIndex((work) => work.id === selectedWork.id);
    setSelectedWorkId(selectedSequence[(index + offset + selectedSequence.length) % selectedSequence.length].id);
  }, [selectedSequence, selectedWork]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const updateMobile = () => { const value = query.matches; setEntryVisible(value && !window.sessionStorage.getItem("mfm-entered")); };
    updateMobile(); query.addEventListener("change", updateMobile);
    return () => query.removeEventListener("change", updateMobile);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDrawer(null); setSelectedWorkId(null); setSelectedArtistId(null); }
      if (selectedWork && event.key === "ArrowRight") moveWork(1);
      if (selectedWork && event.key === "ArrowLeft") moveWork(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveWork, selectedWork]);

  const goWestern = useCallback(() => {
    setCollection("western"); setDrawer(null); setEntryVisible(false);
    window.requestAnimationFrame(() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }));
  }, []);
  const goChina = useCallback(() => {
    setCollection("china"); setDrawer(null); setEntryVisible(false);
    window.requestAnimationFrame(() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }));
  }, []);
  const openWork = useCallback((work: Work, sequence: Work[]) => { setSelectedWorkId(work.id); setSelectedSequence(sequence); }, []);
  function enterMuseum() {
    setEntryLeaving(true); window.sessionStorage.setItem("mfm-entered", "true");
    window.setTimeout(() => { setEntryVisible(false); setEntryLeaving(false); }, 720);
  }
  return <div className="museum-app">
    <MobileEntry visible={entryVisible} leaving={entryLeaving} locale={locale} videoUrl={heroVideo?.status === "active" ? heroVideo.url : undefined} onEnter={enterMuseum} />
    <Header locale={locale} scrolled={scrolled} onLogs={() => setDrawer("logs")} onFeedback={() => setDrawer("feedback")} onWestern={goWestern} onChina={goChina} />
    {collection === "western" ? <>
      <FloatingSchoolBadge />
      <main id="top"><section className="hero" aria-label={locale === "zh" ? "奶蛙博物馆首页影像" : "Milk Frog Museum film"}><div className="hero-media">{heroVideo?.status === "active" && <video src={heroVideo.url} autoPlay muted loop playsInline preload="auto" />}</div><div className="hero-wash" /><div className="hero-caption"><span className="hero-kicker">THE MILK FROG · 2026</span><h1>{locale === "zh" ? <>跨越艺术史的<br />静默凝视</> : <>A silent gaze<br />across art history</>}</h1><p>{locale === "zh" ? <>广东技术师范大学 × 奶娃博物馆<br />倾情呈现</> : "From cave fire to Impressionist afternoons, a rounded and quiet presence remains."}</p><div className="hero-links"><a href="#collection">{locale === "zh" ? "探索典藏" : "Explore the collection"}</a><button type="button" onClick={goChina}>{locale === "zh" ? "参观中国馆" : "Visit China Museum"}</button></div></div></section></main>
      <section className="intro" id="intro"><div className="section-kicker">Curatorial Statement</div><p>{text(content.site.intro, locale).split("\n").map((line, index) => <span className="intro-line" key={`${line}-${index}`}>{line.includes("奶蛙") ? <>{line.split("奶蛙")[0]}<em>奶蛙</em>{line.split("奶蛙").slice(1).join("奶蛙")}</> : line}</span>)}</p><div className="intro-signature">— {text(content.site.curator, locale)}</div></section>
      <CollectionView key="western" content={content} locale={locale} collection="western" onOpenWork={openWork} />
      <Footer content={content} locale={locale} onChina={goChina} onFeedback={() => setDrawer("feedback")} />
    </> : <main className="china-page"><div className="china-page-top"><button className="china-back" type="button" onClick={goWestern}>← {locale === "zh" ? "返回西方馆" : "Back to Western Museum"}</button><span className="china-page-code">MFM · CN</span></div><CollectionView key="china" content={content} locale={locale} collection="china" onOpenWork={openWork} /></main>}
    <div className={`overlay ${drawer ? "open" : ""}`} onClick={() => setDrawer(null)} />
    {drawer === "logs" && <Drawer locale={locale} content={content} onClose={() => setDrawer(null)} />}
    {drawer === "feedback" && <FeedbackPanel locale={locale} onClose={() => setDrawer(null)} />}
    {selectedWork && <Lightbox content={content} locale={locale} work={selectedWork} sequence={selectedSequence} onClose={() => setSelectedWorkId(null)} onOpenArtist={(artist) => setSelectedArtistId(artist.id)} onMove={(work) => { setSelectedWorkId(work.id); }} />}
    {selectedArtist && <ArtistModal artist={selectedArtist} content={content} locale={locale} onClose={() => setSelectedArtistId(null)} />}
    {entryLeaving && <span className="sr-only">Entering museum</span>}
  </div>;
}

function Footer({ content, locale, onChina, onFeedback }: { content: ContentDocument; locale: "zh" | "en"; onChina: () => void; onFeedback: () => void }) {
  const zh = locale === "zh";
  return <footer className="site-footer" id="footer"><div className="footer-content"><div><div className="footer-brand">奶蛙<em>博物馆</em></div><p className="footer-tagline">{text(content.site.footerTagline, locale)}</p></div><div className="footer-column"><h3>{zh ? "参观" : "Visit"}</h3><p>{text(content.site.openingHours, locale)}</p></div><div className="footer-column"><h3>{zh ? "展馆" : "Museum"}</h3><a href="#collection">{zh ? "典藏" : "Collection"}</a><a href="#intro">{zh ? "策展序言" : "Curatorial statement"}</a><button type="button" onClick={onChina}>{zh ? "中国馆" : "China Museum"}</button><button type="button" onClick={onFeedback}>{zh ? "意见箱" : "Feedback"}</button></div><div className="footer-column"><h3>{zh ? "联系" : "Contact"}</h3><p>{text(content.site.contact, locale)}</p></div></div><div className="footer-bottom"><span>© MMXXV Musée du Milk Frog</span></div></footer>;
}
