"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  QuizResult,
  Work,
} from "@/lib/types";

type DrawerName = "menu" | "logs" | "feedback" | null;
type QuizStage = "intro" | "questions" | "loading" | "result";

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

function Icon({ name }: { name: "arrow" | "close" | "download" | "paperclip" | "moon" | "sun" | "museum" | "quiz" }) {
  if (name === "arrow") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "close") return <span aria-hidden="true">×</span>;
  if (name === "download") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16" /></svg>;
  if (name === "paperclip") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.3-9.3a4 4 0 0 1 5.7 5.7l-9.3 9.3a2 2 0 0 1-2.8-2.8l8.7-8.7" /></svg>;
  if (name === "moon") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.3A8.7 8.7 0 0 1 8.7 3.5 8.7 8.7 0 1 0 20.5 15.3Z" /></svg>;
  if (name === "sun") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (name === "museum") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18M2 9h20" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H8l-4 3zM8 9h8M8 12.5h5" /></svg>;
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
  night,
  scrolled,
  onMenu,
  onLocale,
  onNight,
  onQuiz,
  onFeedback,
  onWestern,
  onChina,
}: {
  locale: "zh" | "en";
  night: boolean;
  scrolled: boolean;
  onMenu: () => void;
  onLocale: () => void;
  onNight: () => void;
  onQuiz: () => void;
  onFeedback: () => void;
  onWestern: () => void;
  onChina: () => void;
}) {
  const zh = locale === "zh";
  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <button className="menu-trigger" type="button" aria-label={zh ? "打开菜单" : "Open menu"} onClick={onMenu}>
        <span /><span />
      </button>
      <a className="brand" href="#top" onClick={() => onWestern()}>MUSÉE DU MILK FROG</a>
      <nav aria-label={zh ? "主导航" : "Main navigation"}>
        <a href="#intro">{zh ? "序言" : "Statement"}</a>
        <a href="#collection">{zh ? "典藏" : "Collection"}</a>
        <a href="#collection">{zh ? "年代" : "Eras"}</a>
        <a href="#footer">{zh ? "造访" : "Visit"}</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label={zh ? "切换夜间模式" : "Toggle night mode"} onClick={onNight}><Icon name={night ? "sun" : "moon"} /></button>
        <button className="icon-button" type="button" aria-label={zh ? "打开鉴定所" : "Open identification lab"} onClick={onQuiz}><Icon name="quiz" /></button>
        <button className="icon-button" type="button" aria-label={zh ? "打开意见箱" : "Open feedback"} onClick={onFeedback}>✉</button>
        <button type="button" aria-label={zh ? "切换英文" : "Switch to Chinese"} onClick={onLocale}>{zh ? "EN" : "中"}</button>
        <button className="visit-btn" type="button" onClick={onChina}>{zh ? "参观中国馆" : "China Museum"}</button>
      </div>
    </header>
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
  name,
  locale,
  content,
  onClose,
  onChina,
  onQuiz,
  onLogs,
  onFeedback,
  onNight,
  night,
}: {
  name: Exclude<DrawerName, null>;
  locale: "zh" | "en";
  content: ContentDocument;
  onClose: () => void;
  onChina: () => void;
  onQuiz: () => void;
  onLogs: () => void;
  onFeedback: () => void;
  onNight: () => void;
  night: boolean;
}) {
  const zh = locale === "zh";
  const isMenu = name === "menu";
  return (
    <aside className={`drawer ${name === "menu" ? "menu-drawer" : name === "logs" ? "update-log" : "feedback-panel"} open`} aria-hidden="false">
      <div className="drawer-head">
        <div><span className="drawer-kicker">MUSÉE DU MILK FROG</span><h2>{name === "menu" ? (zh ? "菜单" : "Menu") : name === "logs" ? (zh ? "更新日志" : "Updates") : (zh ? "意见箱" : "Feedback")}</h2></div>
        <button className="drawer-close" type="button" aria-label={zh ? "关闭" : "Close"} onClick={onClose}><Icon name="close" /></button>
      </div>
      {isMenu ? (
        <>
          <div className="drawer-rule" />
          <div className="drawer-nav">
            <button type="button" onClick={onChina}><Icon name="museum" /><span><strong>{zh ? "参观中国馆" : "Visit China Museum"}</strong><small>{zh ? "进入史前与先秦第一厅" : "Enter the first hall"}</small></span></button>
            <button type="button" onClick={onQuiz}><Icon name="quiz" /><span><strong>{zh ? "奶蛙鉴定所" : "Identification Lab"}</strong><small>{zh ? "开始一场身份鉴定" : "Find your Milk Frog identity"}</small></span></button>
            <button type="button" onClick={onLogs}><span className="drawer-icon">✦</span><span><strong>{zh ? "更新日志" : "Updates"}</strong><small>{zh ? "查看博物馆最近发生的事" : "What has changed in the museum"}</small></span></button>
            <button type="button" onClick={onFeedback}><span className="drawer-icon">✉</span><span><strong>{zh ? "意见箱" : "Feedback"}</strong><small>{zh ? "告诉馆长你希望看到什么" : "Leave a note for the curator"}</small></span></button>
            <button type="button" onClick={onNight}><span className="drawer-icon"><Icon name={night ? "sun" : "moon"} /></span><span><strong>{night ? (zh ? "切换日间模式" : "Day mode") : (zh ? "切换夜间模式" : "Night mode")}</strong><small>{zh ? "保存你的参观偏好" : "Keep your viewing preference"}</small></span></button>
          </div>
          <div className="drawer-foot">{zh ? "MFM · 常设典藏 · 2026" : "MFM · PERMANENT COLLECTION · 2026"}</div>
        </>
      ) : name === "logs" ? (
        <div className="log-list">
          {content.logs.filter((entry) => entry.visible).sort((a, b) => a.order - b.order).map((entry) => (
            <article className="log-entry" key={entry.id}><time dateTime={entry.date}>{entry.date.replaceAll("-", ".")}</time><h3>{text(entry.title, locale)}</h3><p>{text(entry.body, locale)}</p></article>
          ))}
        </div>
      ) : null}
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
    setFiles((current) => [...current, ...incoming].slice(0, 6));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = message.trim();
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (!value) {
      setStatus(zh ? "请先写下你的意见。" : "Please write a note first.");
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024) || total > 20 * 1024 * 1024) {
      setStatus(zh ? "单个文件不能超过 10 MB，附件总量不能超过 20 MB。" : "Each file must be under 10 MB and total attachments under 20 MB.");
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
        <label className="file-label"><Icon name="paperclip" /><span>{zh ? "添加图片或文件" : "Add images or files"}</span><input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} /></label>
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
        <div className="collection-head"><div><div className="sub">{collection === "china" ? (zh ? "中国奶蛙典藏系列" : "The Chinese Milk Frog Collection") : (zh ? "常设典藏" : "The Permanent Collection")}</div><h2>{collection === "china" ? (zh ? "中国馆" : "China Museum") : (zh ? "典藏系列" : "The Collection")}</h2></div><span className="collection-count">{works.length} {zh ? "件作品" : "works"}</span></div>
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
  flipped,
  onFlip,
  onClose,
  onOpenArtist,
  onMove,
}: {
  content: ContentDocument;
  locale: "zh" | "en";
  work: Work;
  sequence: Work[];
  flipped: boolean;
  onFlip: () => void;
  onClose: () => void;
  onOpenArtist: (artist: Artist) => void;
  onMove: (work: Work) => void;
}) {
  const zh = locale === "zh";
  const asset = getAsset(content, work.primaryAssetId);
  const original = getAsset(content, work.originalAssetId);
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
        <div className={`lightbox-visual ${flipped ? "flipped" : ""}`} onDoubleClick={onFlip}>
          <div className="lightbox-front"><MediaImage asset={asset} alt={text(work.title, locale)} /></div>
          <div className="lightbox-back"><div className="section-kicker">{zh ? "奶蛙馆藏故事" : "Studio note"}</div><p className="detail-copy">{text(work.curatorialNote, locale)}</p><h3>{zh ? "创作轶事" : "A small story"}</h3><p className="detail-copy">{text(work.trivia, locale)}</p>{original && <div className="original-reference"><div className="section-kicker">{zh ? "原作参考图" : "Original reference"}</div><MediaImage asset={original} alt={text(work.originalTitle, locale)} /></div>}<div className="flip-hint">{zh ? "双击返回作品" : "Double-click to return"}</div></div>
          <div className="flip-hint">{zh ? "双击查看作品故事" : "Double-click for the story"}</div>
          <button className="lightbox-control prev" type="button" aria-label={zh ? "上一件作品" : "Previous work"} onClick={() => move(-1)}>‹</button><button className="lightbox-control next" type="button" aria-label={zh ? "下一件作品" : "Next work"} onClick={() => move(1)}>›</button>
        </div>
        <div className="lightbox-copy"><div className="kicker">{era ? text(era.label, locale) : work.eraId}</div><h2>{text(work.title, locale)}</h2><p className="original">{text(work.originalTitle, locale)}</p><div className="detail-row"><span>{zh ? "馆藏编号" : "Accession"}</span><span>{work.accession}</span></div><div className="detail-row"><span>{zh ? "艺术家" : "Artist"}</span><span>{artist ? <button className="artist-trigger" type="button" onClick={() => onOpenArtist(artist)}>{text(artist.displayName, locale)}</button> : "Unknown"}</span></div><div className="detail-row"><span>{zh ? "年代" : "Date"}</span><span>{work.year}</span></div><div className="detail-copy"><h3>{zh ? "作品介绍" : "About the work"}</h3><p>{text(work.introduction, locale)}</p></div><p className="flip-note">{zh ? "双击左侧作品图，查看馆藏故事与原作参考。" : "Double-click the work image to see its story and original reference."}</p></div>
      </div>
    </div>
  );
}

function ArtistModal({ artist, content, locale, onClose }: { artist: Artist; content: ContentDocument; locale: "zh" | "en"; onClose: () => void }) {
  const zh = locale === "zh";
  const portrait = getAsset(content, artist.portraitAssetId);
  return <div className="modal open" role="dialog" aria-modal="true" aria-label={text(artist.displayName, locale)} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="artist-modal-inner"><button className="modal-close" type="button" aria-label={zh ? "关闭艺术家资料" : "Close artist"} onClick={onClose}><Icon name="close" /></button>{portrait && <MediaImage asset={portrait} alt={text(artist.displayName, locale)} className="artist-portrait" />}<h2>{text(artist.displayName, locale)}</h2><p className="life">{artist.life || (zh ? "生平待补" : "Biography pending")}</p><p className="artist-story">{text(artist.story, locale)}</p></div></div>;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const paragraphs = value.split(/\n+/);
  for (const paragraph of paragraphs) {
    let line = "";
    for (const character of paragraph) {
      const next = line + character;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = character;
        y += lineHeight;
      } else line = next;
    }
    if (line) { ctx.fillText(line, x, y); y += lineHeight; }
    y += lineHeight * .35;
  }
  return y;
}

function QuizModal({ content, locale, onClose }: { content: ContentDocument; locale: "zh" | "en"; onClose: () => void }) {
  const zh = locale === "zh";
  const questions = useMemo(() => content.quiz.questions.filter((question) => question.visible).sort((a, b) => a.order - b.order), [content.quiz.questions]);
  const results = useMemo(() => content.quiz.results.filter((result) => result.visible).sort((a, b) => a.order - b.order), [content.quiz.results]);
  const [stage, setStage] = useState<QuizStage>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (stage !== "loading") return;
    timer.current = setTimeout(() => {
      const score = answers.reduce((total, value) => total + value, 0);
      setResult(results[score % Math.max(results.length, 1)] || null);
      setStage("result");
    }, 850);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [answers, results, stage]);

  function start() { setAnswers([]); setQuestionIndex(0); setResult(null); setStatus(""); setStage(questions.length ? "questions" : "result"); }
  function choose(index: number) {
    const nextAnswers = [...answers, index];
    setAnswers(nextAnswers);
    if (questionIndex + 1 >= questions.length) setStage("loading");
    else setQuestionIndex((current) => current + 1);
  }
  async function saveCard() {
    if (!result) return;
    const canvas = document.createElement("canvas");
    canvas.width = 900; canvas.height = 1180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f4f0e8"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#a8894f"; ctx.fillRect(0, 0, canvas.width, 95);
    ctx.fillStyle = "#ffffff"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.fillText(zh ? "奶蛙鉴定完成" : "MILK FROG IDENTIFICATION", canvas.width / 2, 58);
    const imageAsset = getAsset(content, result.imageAssetId);
    if (imageAsset?.url && imageAsset.status === "active") {
      await new Promise<void>((resolve) => { const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => { const ratio = Math.min(700 / image.width, 360 / image.height); const width = image.width * ratio; const height = image.height * ratio; ctx.drawImage(image, (canvas.width - width) / 2, 130, width, height); resolve(); }; image.onerror = () => resolve(); image.src = imageAsset.url; });
    }
    ctx.textAlign = "left"; ctx.fillStyle = "#a8894f"; ctx.font = "18px Arial"; ctx.fillText(zh ? "你是——" : "YOU ARE—", 100, 575);
    ctx.fillStyle = "#1a1712"; ctx.font = "42px Georgia"; let y = wrapCanvasText(ctx, text(result.name, locale), 100, 635, 700, 52);
    ctx.strokeStyle = "#c9b183"; ctx.beginPath(); ctx.moveTo(100, y + 4); ctx.lineTo(800, y + 4); ctx.stroke();
    ctx.font = "19px Arial"; ctx.fillStyle = "#a8894f"; y += 52; ctx.fillText(zh ? "馆藏编号" : "NUMBER", 100, y); ctx.fillText(zh ? "稀有度" : "RARITY", 350, y); ctx.fillText(zh ? "出没地点" : "HABITAT", 565, y);
    ctx.fillStyle = "#1a1712"; ctx.font = "22px Arial"; y += 38; ctx.fillText(result.collectionNumber, 100, y); ctx.fillText("★".repeat(result.rarity) + "☆".repeat(5 - result.rarity), 350, y); y = wrapCanvasText(ctx, text(result.habitat, locale), 565, y, 230, 28);
    ctx.fillStyle = "#4a443b"; ctx.font = "20px Arial"; y += 55; ctx.fillText(zh ? "馆长评语" : "CURATOR'S NOTE", 100, y); ctx.font = "19px Georgia"; y += 38; wrapCanvasText(ctx, result.comment.map((line) => text(line, locale)).join("\n"), 100, y, 700, 31);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${zh ? "奶蛙鉴定" : "milk-frog-card"}-${result.collectionNumber}.png`; link.click(); URL.revokeObjectURL(link.href);
    setStatus(zh ? "鉴定卡片已保存。" : "The identification card was saved.");
  }

  return <div className="modal open" role="dialog" aria-modal="true" aria-label={zh ? "奶蛙鉴定所" : "Milk Frog Identification Lab"} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="quiz-panel"><button className="modal-close" type="button" aria-label={zh ? "关闭鉴定所" : "Close lab"} onClick={onClose}><Icon name="close" /></button><div className="quiz-content">
    {stage === "intro" && <div><div className="quiz-kicker">MILK FROG IDENTIFICATION LAB</div><h2>{zh ? "奶蛙鉴定所" : "Identification Lab"}</h2><p>{zh ? "回答 4 道题，馆长会在 30 秒内把你鉴定成一只奶蛙。\n那只奶蛙是你。" : "Answer four questions. The curator will identify your Milk Frog self."}</p></div>}
    {stage === "questions" && questions[questionIndex] && <div className="quiz-question"><div className="quiz-progress">{questionIndex + 1} / {questions.length}</div><div className="quiz-progress-bar"><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div><h3>{text(questions[questionIndex].question, locale)}</h3><div className="quiz-options">{questions[questionIndex].options.map((option, index) => <button className="quiz-option" type="button" key={`${questions[questionIndex].id}-${index}`} onClick={() => choose(index)}><b>{String.fromCharCode(65 + index)}</b><span>{text(option, locale)}</span></button>)}</div></div>}
    {stage === "loading" && <div className="quiz-loading"><div><div className="spinner" /><p>{zh ? "鉴定中……" : "Identifying…"}</p></div></div>}
    {stage === "result" && result && <div className="spec-card"><div className="spec-badge">{zh ? "鉴定完成" : "IDENTIFICATION COMPLETE"}</div>{getAsset(content, result.imageAssetId) && <MediaImage asset={getAsset(content, result.imageAssetId)} alt={text(result.name, locale)} className="spec-image" />}<p className="spec-lead">{zh ? "你是——" : "YOU ARE—"}</p><h3>{text(result.name, locale)}</h3><div className="spec-row"><span>{zh ? "馆藏编号" : "Number"}</span><b>{result.collectionNumber}</b></div><div className="spec-row"><span>{zh ? "稀有度" : "Rarity"}</span><b>{"★".repeat(result.rarity)}{"☆".repeat(5 - result.rarity)}</b></div><div className="spec-row"><span>{zh ? "出没地点" : "Habitat"}</span><b>{text(result.habitat, locale)}</b></div><div className="spec-note"><strong>{zh ? "馆长评语" : "Curator's note"}</strong><br />{result.comment.map((line) => <span key={line.zh}>{text(line, locale)}<br /></span>)}</div></div>}
    {stage === "result" && !result && <p>{zh ? "鉴定结果暂未配置。" : "No result has been configured yet."}</p>}
    {status && <p className="feedback-status">{status}</p>}
  </div><div className="quiz-actions">{stage === "intro" && <button className="quiz-primary" type="button" onClick={start}>{zh ? "开始鉴定" : "Start"}</button>}{stage === "result" && <><button className="quiz-primary" type="button" onClick={saveCard}><Icon name="download" /> {zh ? "保存卡片" : "Save card"}</button><button className="quiz-again" type="button" onClick={start}>{zh ? "重新鉴定" : "Try again"}</button></>}{stage === "questions" && <span className="admin-muted">{zh ? "请选择最符合你的选项" : "Choose the answer that feels most like you."}</span>}</div></div></div>;
}

export default function MuseumClient({ content }: MuseumClientProps) {
  const [locale, setLocale] = useState<"zh" | "en">("zh");
  const [night, setNight] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [entryVisible, setEntryVisible] = useState(false);
  const [entryLeaving, setEntryLeaving] = useState(false);
  const [collection, setCollection] = useState<CollectionId>("western");
  const [drawer, setDrawer] = useState<DrawerName>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<Work[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  const heroVideo = getAsset(content, content.site.heroVideoAssetId);
  const selectedWork = selectedWorkId ? content.works.find((work) => work.id === selectedWorkId) : undefined;
  const selectedArtist = selectedArtistId ? content.artists.find((artist) => artist.id === selectedArtistId) : undefined;

  const moveWork = useCallback((offset: number) => {
    if (!selectedWork || !selectedSequence.length) return;
    const index = selectedSequence.findIndex((work) => work.id === selectedWork.id);
    setSelectedWorkId(selectedSequence[(index + offset + selectedSequence.length) % selectedSequence.length].id);
    setFlipped(false);
  }, [selectedSequence, selectedWork]);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("mfm-locale");
    const savedNight = window.localStorage.getItem("mfm-night");
    if (savedLocale === "zh" || savedLocale === "en") setLocale(savedLocale);
    if (savedNight === "true") setNight(true);
    const query = window.matchMedia("(max-width: 720px)");
    const updateMobile = () => { const value = query.matches; setEntryVisible(value && !window.sessionStorage.getItem("mfm-entered")); };
    updateMobile(); query.addEventListener("change", updateMobile);
    return () => query.removeEventListener("change", updateMobile);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("night", night);
    window.localStorage.setItem("mfm-night", String(night));
  }, [night]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDrawer(null); setQuizOpen(false); setSelectedWorkId(null); setSelectedArtistId(null); }
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
  const openWork = useCallback((work: Work, sequence: Work[]) => { setSelectedWorkId(work.id); setSelectedSequence(sequence); setFlipped(false); }, []);
  function enterMuseum() {
    setEntryLeaving(true); window.sessionStorage.setItem("mfm-entered", "true");
    window.setTimeout(() => { setEntryVisible(false); setEntryLeaving(false); }, 720);
  }
  function toggleLocale() { setLocale((current) => { const next = current === "zh" ? "en" : "zh"; window.localStorage.setItem("mfm-locale", next); return next; }); }

  return <div className="museum-app">
    <MobileEntry visible={entryVisible} leaving={entryLeaving} locale={locale} videoUrl={heroVideo?.status === "active" ? heroVideo.url : undefined} onEnter={enterMuseum} />
    <Header locale={locale} night={night} scrolled={scrolled} onMenu={() => setDrawer("menu")} onLocale={toggleLocale} onNight={() => setNight((current) => !current)} onQuiz={() => { setDrawer(null); setQuizOpen(true); }} onFeedback={() => setDrawer("feedback")} onWestern={goWestern} onChina={goChina} />
    {collection === "western" ? <>
      <main id="top"><section className="hero" aria-label={locale === "zh" ? "奶蛙博物馆首页影像" : "Milk Frog Museum film"}><div className="hero-media">{heroVideo?.status === "active" && <video src={heroVideo.url} autoPlay muted loop playsInline preload="auto" />}</div><div className="hero-wash" /><div className="hero-caption"><span className="hero-kicker">THE MILK FROG · 2026</span><h1>{locale === "zh" ? <>跨越艺术史的<br />静默凝视</> : <>A silent gaze<br />across art history</>}</h1><p>{locale === "zh" ? "从洞窟的火光到印象派的午后，一个圆润而沉静的身影，始终在场。" : "From cave fire to Impressionist afternoons, a rounded and quiet presence remains."}</p><div className="hero-links"><a href="#collection">{locale === "zh" ? "探索典藏" : "Explore the collection"} <Icon name="arrow" /></a><button type="button" onClick={goChina}>{locale === "zh" ? "参观中国馆" : "Visit China Museum"}</button></div></div></section></main>
      <section className="intro" id="intro"><div className="section-kicker">Curatorial Statement</div><p>{text(content.site.intro, locale).split("\n").map((line, index) => <span className="intro-line" key={`${line}-${index}`}>{line.includes("奶蛙") ? <>{line.split("奶蛙")[0]}<em>奶蛙</em>{line.split("奶蛙").slice(1).join("奶蛙")}</> : line}</span>)}</p><div className="intro-signature">— {text(content.site.curator, locale)}</div></section>
      <CollectionView key="western" content={content} locale={locale} collection="western" onOpenWork={openWork} />
      <Footer content={content} locale={locale} onChina={goChina} onFeedback={() => setDrawer("feedback")} />
    </> : <main className="china-page"><div className="china-page-top"><button className="china-back" type="button" onClick={goWestern}>← {locale === "zh" ? "返回西方馆" : "Back to Western Museum"}</button><span className="china-page-code">MFM · CN</span></div><CollectionView key="china" content={content} locale={locale} collection="china" onOpenWork={openWork} /></main>}
    <div className={`overlay ${drawer ? "open" : ""}`} onClick={() => setDrawer(null)} />
    {drawer === "menu" && <Drawer name="menu" locale={locale} content={content} night={night} onClose={() => setDrawer(null)} onChina={goChina} onQuiz={() => { setDrawer(null); setQuizOpen(true); }} onLogs={() => setDrawer("logs")} onFeedback={() => setDrawer("feedback")} onNight={() => setNight((current) => !current)} />}
    {drawer === "logs" && <Drawer name="logs" locale={locale} content={content} night={night} onClose={() => setDrawer(null)} onChina={goChina} onQuiz={() => { setDrawer(null); setQuizOpen(true); }} onLogs={() => setDrawer("logs")} onFeedback={() => setDrawer("feedback")} onNight={() => setNight((current) => !current)} />}
    {drawer === "feedback" && <FeedbackPanel locale={locale} onClose={() => setDrawer(null)} />}
    {selectedWork && <Lightbox content={content} locale={locale} work={selectedWork} sequence={selectedSequence} flipped={flipped} onFlip={() => setFlipped((current) => !current)} onClose={() => setSelectedWorkId(null)} onOpenArtist={(artist) => setSelectedArtistId(artist.id)} onMove={(work) => { setSelectedWorkId(work.id); setFlipped(false); }} />}
    {selectedArtist && <ArtistModal artist={selectedArtist} content={content} locale={locale} onClose={() => setSelectedArtistId(null)} />}
    {quizOpen && <QuizModal content={content} locale={locale} onClose={() => setQuizOpen(false)} />}
    {entryLeaving && <span className="sr-only">Entering museum</span>}
  </div>;
}

function Footer({ content, locale, onChina, onFeedback }: { content: ContentDocument; locale: "zh" | "en"; onChina: () => void; onFeedback: () => void }) {
  const zh = locale === "zh";
  return <footer className="site-footer" id="footer"><div className="footer-content"><div><div className="footer-brand">奶蛙<em>博物馆</em></div><p className="footer-tagline">{text(content.site.footerTagline, locale)}</p></div><div className="footer-column"><h3>{zh ? "参观" : "Visit"}</h3><p>{text(content.site.openingHours, locale)}</p></div><div className="footer-column"><h3>{zh ? "展馆" : "Museum"}</h3><a href="#collection">{zh ? "常设典藏" : "Permanent collection"}</a><a href="#intro">{zh ? "策展序言" : "Curatorial statement"}</a><button type="button" onClick={onChina}>{zh ? "中国馆" : "China Museum"}</button><button type="button" onClick={onFeedback}>{zh ? "意见箱" : "Feedback"}</button></div><div className="footer-column"><h3>{zh ? "联系" : "Contact"}</h3><p>{text(content.site.contact, locale)}</p></div></div><p className="easter-note">{text(content.site.easterNote, locale)}</p><div className="footer-bottom"><span>© MMXXV Musée du Milk Frog</span><span>{zh ? "所有作品均为转化性戏仿" : "All Works Transformative Parody"}</span></div></footer>;
}
