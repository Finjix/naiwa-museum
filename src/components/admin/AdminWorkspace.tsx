"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { AdminSection } from "@/lib/admin-sections";
import { referencedAssetIds } from "@/lib/content/utils";
import type { Artist, ContentDocument, ContentSnapshot, Era, FeedbackRecord, LocalizedText, MediaAsset, UpdateLog, Work } from "@/lib/types";

const NAV_ITEMS: Array<{ id: AdminSection; label: string }> = [
  { id: "dashboard", label: "总览" }, { id: "works", label: "展品" }, { id: "artists", label: "艺术家" }, { id: "eras", label: "年代" }, { id: "site", label: "首页配置" }, { id: "logs", label: "更新日志" }, { id: "assets", label: "媒体资产" }, { id: "feedback", label: "意见箱" },
];

const ADMIN_HREFS: Record<AdminSection, string> = {
  dashboard: "/admin", works: "/admin/works", artists: "/admin/artists", eras: "/admin/eras", site: "/admin/site", logs: "/admin/logs", assets: "/admin/assets", feedback: "/admin/feedback",
};

function ChineseField({ label, value, onChange, multiline = false }: { label: string; value: LocalizedText; onChange: (value: LocalizedText) => void; multiline?: boolean }) {
  const update = (next: string) => onChange({ zh: next, en: next });
  return <div className={`admin-field ${multiline ? "full" : ""}`}><label>{label}</label>{multiline ? <textarea value={value.zh} onChange={(event) => update(event.target.value)} /> : <input value={value.zh} onChange={(event) => update(event.target.value)} />}</div>;
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <label className="admin-check"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{children}</label>;
}

function MediaSelect({ assets, value, onChange, kinds }: { assets: MediaAsset[]; value?: string; onChange: (value: string) => void; kinds?: MediaAsset["kind"][] }) {
  const choices = assets.filter((asset) => !kinds || kinds.includes(asset.kind));
  return <select value={value || ""} onChange={(event) => onChange(event.target.value)}><option value="">— 未选择 —</option>{choices.map((asset) => <option value={asset.id} key={asset.id}>{asset.status === "missing" ? "[待补] " : ""}{asset.filename}</option>)}</select>;
}

function SectionCard({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="admin-card"><div className="admin-card-heading"><h2>{title}</h2>{actions}</div>{children}</section>;
}

export default function AdminWorkspace({ section }: { section: AdminSection }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/admin/content").then(async (response) => { if (!response.ok) throw new Error("后台内容读取失败。"); return response.json() as Promise<ContentSnapshot>; }), section === "feedback" ? fetch("/api/admin/feedback").then(async (response) => { if (!response.ok) throw new Error("意见读取失败。"); return response.json() as Promise<{ records: FeedbackRecord[] }>; }) : Promise.resolve({ records: [] })]).then(([contentResult, feedbackResult]) => { if (!cancelled) { setSnapshot(contentResult); setFeedback(feedbackResult.records); } }).catch((error: unknown) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "后台读取失败。"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [section]);

  function patchDraft(updater: (document: ContentDocument) => ContentDocument) {
    setSnapshot((current) => current ? { ...current, draft: updater(current.draft) } : current);
  }

  async function saveDraft() {
    if (!snapshot) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: snapshot.draft, baseRevision: snapshot.draft.revision }) });
      const body = await response.json() as { document?: ContentDocument; error?: string };
      if (!response.ok || !body.document) throw new Error(body.error || "草稿保存失败。");
      setSnapshot((current) => current ? { ...current, draft: body.document! } : current); setNotice(`草稿已保存 · revision ${body.document.revision}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "草稿保存失败。"); } finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/content/publish", { method: "POST" });
      const body = await response.json() as { document?: ContentDocument; error?: string };
      if (!response.ok || !body.document) throw new Error(body.error || "发布失败。");
      setSnapshot((current) => current ? { draft: current.draft, published: body.document! } : current); setNotice(`已发布 · revision ${body.document.revision}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "发布失败。"); } finally { setBusy(false); }
  }

  async function logout() { await fetch("/api/admin/auth/logout", { method: "POST" }); router.push("/admin/login"); }

  if (loading || !snapshot) return <main className="admin-body"><div className="admin-main"><p className="admin-muted">后台载入中……</p></div></main>;
  const draft = snapshot.draft;
  const missingCount = draft.assets.filter((asset) => asset.status === "missing").length;
  const title = NAV_ITEMS.find((item) => item.id === section)?.label || "后台";

  return <main className="admin-body"><div className="admin-shell"><aside className="admin-sidebar"><Link className="admin-logo" href="/admin">GPNU Milk Frog</Link><nav className="admin-nav">{NAV_ITEMS.map((item) => <Link className={item.id === section ? "active" : ""} href={ADMIN_HREFS[item.id] as never} key={item.id}>{item.label}</Link>)}</nav><p className="admin-sidebar-foot">单管理员 · Blob JSON<br />草稿 revision {draft.revision}</p></aside><div className="admin-main"><div className="admin-topbar"><h1>{title}</h1><div className="admin-actions"><button className="admin-button" type="button" onClick={saveDraft} disabled={busy}>保存草稿</button><button className="admin-button primary" type="button" onClick={publish} disabled={busy}>发布</button><button className="admin-button" type="button" onClick={logout}>退出</button></div></div>{notice && <div className="admin-notice" role="status">{notice}</div>}{section === "dashboard" && <Dashboard draft={draft} published={snapshot.published} missingCount={missingCount} />}{section === "works" && <WorksEditor document={draft} patchDraft={patchDraft} />}{section === "artists" && <ArtistsEditor document={draft} patchDraft={patchDraft} />}{section === "eras" && <ErasEditor document={draft} patchDraft={patchDraft} />}{section === "site" && <SiteEditor document={draft} patchDraft={patchDraft} />}{section === "logs" && <LogsEditor document={draft} patchDraft={patchDraft} />}{section === "assets" && <AssetsEditor document={draft} patchDraft={patchDraft} setNotice={setNotice} />}{section === "feedback" && <FeedbackEditor records={feedback} setRecords={setFeedback} />}</div></div></main>;
}

function Dashboard({ draft, published, missingCount }: { draft: ContentDocument; published: ContentDocument; missingCount: number }) {
  const changes = draft.revision !== published.revision;
  return <><div className="admin-grid"><div className="admin-stat"><span>展品</span><strong>{draft.works.length}</strong></div><div className="admin-stat"><span>艺术家</span><strong>{draft.artists.length}</strong></div><div className="admin-stat"><span>媒体</span><strong>{draft.assets.length}</strong></div><div className="admin-stat"><span>待补资源</span><strong className={missingCount ? "admin-missing" : ""}>{missingCount}</strong></div></div><SectionCard title="发布状态"><p className="admin-muted">当前草稿 revision {draft.revision}，最后更新于 {draft.updatedAt}。</p><p className="admin-muted">已发布 revision {published.revision}。{changes ? " 草稿与公开内容存在差异，保存后点击发布才会对外可见。" : " 当前没有未发布改动。"}</p></SectionCard></>;
}

function WorksEditor({ document, patchDraft }: { document: ContentDocument; patchDraft: (updater: (document: ContentDocument) => ContentDocument) => void }) {
  const [selectedId, setSelectedId] = useState(document.works[0]?.id || "");
  const [query, setQuery] = useState("");
  const selected = document.works.find((work) => work.id === selectedId) || document.works[0];
  const filtered = document.works.filter((work) => `${work.title.zh} ${work.accession}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.order - b.order);
  function update(work: Work) { patchDraft((current) => ({ ...current, works: current.works.map((item) => item.id === work.id ? work : item) })); }
  function add() { const id = `work-new-${crypto.randomUUID().slice(0, 8)}`; const era = document.eras.find((item) => item.collection === "western") || document.eras[0]; const asset = document.assets.find((item) => item.status === "active" && item.kind === "image"); const work: Work = { id, slug: "new-work", collection: era?.collection || "western", title: { zh: "新展品", en: "新展品" }, eraId: era?.id || "general", artistId: undefined, originalTitle: { zh: "仿 未知原作", en: "仿 未知原作" }, year: "", accession: "MFM · NEW", primaryAssetId: asset?.id || "asset-unassigned", introduction: { zh: "", en: "" }, visible: true, order: document.works.length }; patchDraft((current) => ({ ...current, works: [...current.works, work] })); setSelectedId(id); }
  function remove() { if (!selected) return; patchDraft((current) => ({ ...current, works: current.works.filter((item) => item.id !== selected.id) })); setSelectedId(filtered.find((item) => item.id !== selected.id)?.id || ""); }
  return <div className="admin-two-pane"><SectionCard title="展品列表" actions={<button className="admin-button" type="button" onClick={add}>新增</button>}><input className="admin-search" placeholder="搜索展品或编号" value={query} onChange={(event) => setQuery(event.target.value)} /> <div className="admin-list admin-scroll-list">{filtered.map((work) => <button className={`admin-list-row ${selected?.id === work.id ? "selected" : ""}`} type="button" key={work.id} onClick={() => setSelectedId(work.id)}><span><strong>{work.title.zh}</strong><small>{work.accession} · {work.collection === "china" ? "中国馆" : "西方馆"}</small></span><span className="status-pill">{work.visible ? "上架" : "下架"}</span></button>)}</div></SectionCard>{selected ? <SectionCard title="编辑展品" actions={<button className="admin-button danger" type="button" onClick={remove}>删除展品</button>}><div className="admin-form"><ChineseField label="标题" value={selected.title} onChange={(value) => update({ ...selected, title: value })} /><div className="admin-form-grid"><div className="admin-field"><label>馆藏编号</label><input value={selected.accession} onChange={(event) => update({ ...selected, accession: event.target.value })} /></div><div className="admin-field"><label>年份</label><input value={selected.year} onChange={(event) => update({ ...selected, year: event.target.value })} /></div><div className="admin-field"><label>馆藏</label><select value={selected.collection} onChange={(event) => update({ ...selected, collection: event.target.value as Work["collection"] })}><option value="western">西方馆</option><option value="china">中国馆</option></select></div><div className="admin-field"><label>年代</label><select value={selected.eraId} onChange={(event) => update({ ...selected, eraId: event.target.value })}>{document.eras.map((era) => <option value={era.id} key={era.id}>{era.label.zh}</option>)}</select></div><div className="admin-field"><label>艺术家</label><select value={selected.artistId || ""} onChange={(event) => update({ ...selected, artistId: event.target.value || undefined })}><option value="">无署名</option>{document.artists.map((artist) => <option value={artist.id} key={artist.id}>{artist.displayName.zh}</option>)}</select></div><div className="admin-field"><label>主图</label><MediaSelect assets={document.assets} value={selected.primaryAssetId} kinds={["image"]} onChange={(value) => update({ ...selected, primaryAssetId: value })} /></div><div className="admin-field"><label>排序</label><input type="number" value={selected.order} onChange={(event) => update({ ...selected, order: Number(event.target.value) })} /></div></div><ChineseField label="原作名称" value={selected.originalTitle} onChange={(value) => update({ ...selected, originalTitle: value })} /><ChineseField label="作品介绍" value={selected.introduction} multiline onChange={(value) => update({ ...selected, introduction: value })} /><Toggle checked={selected.visible} onChange={(value) => update({ ...selected, visible: value })}>公开展示</Toggle></div></SectionCard> : <SectionCard title="编辑展品"><p className="admin-muted">暂无展品。</p></SectionCard>}</div>;
}

function ArtistsEditor({ document: source, patchDraft }: { document: ContentDocument; patchDraft: (updater: (document: ContentDocument) => ContentDocument) => void }) {
  const document = { ...source, artists: [...source.artists] };
  const [selectedId, setSelectedId] = useState(document.artists[0]?.id || "");
  const selected = document.artists.find((artist) => artist.id === selectedId) || document.artists[0];
  function update(artist: Artist) { patchDraft((current) => ({ ...current, artists: current.artists.map((item) => item.id === artist.id ? artist : item) })); }
  function add() { const id = `artist-new-${crypto.randomUUID().slice(0, 8)}`; const artist: Artist = { id, canonicalName: "新艺术家", displayName: { zh: "新艺术家", en: "新艺术家" }, life: "", story: { zh: "", en: "" }, visible: true, order: document.artists.length }; patchDraft((current) => ({ ...current, artists: [...current.artists, artist] })); setSelectedId(id); }
  function remove() { if (!selected) return; if (document.works.some((work) => work.artistId === selected.id)) return; patchDraft((current) => ({ ...current, artists: current.artists.filter((item) => item.id !== selected.id) })); setSelectedId(document.artists.find((item) => item.id !== selected.id)?.id || ""); }
  return <div className="admin-two-pane"><SectionCard title="艺术家列表" actions={<button className="admin-button" type="button" onClick={add}>新增</button>}><div className="admin-list admin-scroll-list">{document.artists.sort((a, b) => a.order - b.order).map((artist) => <button className={`admin-list-row ${selected?.id === artist.id ? "selected" : ""}`} type="button" key={artist.id} onClick={() => setSelectedId(artist.id)}><span><strong>{artist.displayName.zh}</strong><small>{artist.life || "生平待补"}</small></span><span className="status-pill">{artist.visible ? "显示" : "隐藏"}</span></button>)}</div></SectionCard>{selected ? <SectionCard title="编辑艺术家" actions={<button className="admin-button danger" type="button" onClick={remove} disabled={document.works.some((work) => work.artistId === selected.id)}>删除</button>}><div className="admin-form"><div className="admin-form-grid"><div className="admin-field"><label>规范名称</label><input value={selected.canonicalName} onChange={(event) => update({ ...selected, canonicalName: event.target.value })} /></div><div className="admin-field"><label>生卒年</label><input value={selected.life} onChange={(event) => update({ ...selected, life: event.target.value })} /></div><div className="admin-field"><label>排序</label><input type="number" value={selected.order} onChange={(event) => update({ ...selected, order: Number(event.target.value) })} /></div><div className="admin-field"><label>肖像</label><MediaSelect assets={document.assets} value={selected.portraitAssetId} kinds={["image"]} onChange={(value) => update({ ...selected, portraitAssetId: value || undefined })} /></div></div><ChineseField label="显示名称" value={selected.displayName} onChange={(value) => update({ ...selected, displayName: value })} /><ChineseField label="艺术家资料" value={selected.story} multiline onChange={(value) => update({ ...selected, story: value })} /><Toggle checked={selected.visible} onChange={(value) => update({ ...selected, visible: value })}>公开显示</Toggle></div></SectionCard> : null}</div>;
}

function ErasEditor({ document: source, patchDraft }: { document: ContentDocument; patchDraft: (updater: (document: ContentDocument) => ContentDocument) => void }) {
  const document = { ...source, eras: [...source.eras] };
  function update(era: Era) { patchDraft((current) => ({ ...current, eras: current.eras.map((item) => item.id === era.id ? era : item) })); }
  function add() { const id = `era-new-${crypto.randomUUID().slice(0, 8)}`; const era: Era = { id, label: { zh: "新年代", en: "新年代" }, code: "NEW", collection: "western", order: document.eras.length, visible: true }; patchDraft((current) => ({ ...current, eras: [...current.eras, era] })); }
  function remove(era: Era) { if (document.works.some((work) => work.eraId === era.id)) return; patchDraft((current) => ({ ...current, eras: current.eras.filter((item) => item.id !== era.id) })); }
  const sorted = document.eras.sort((a, b) => a.order - b.order);
  return <SectionCard title="年代管理" actions={<button className="admin-button" type="button" onClick={add}>新增年代</button>}><div className="admin-list">{sorted.map((era) => <div className="admin-list-row" key={era.id}><div className="admin-form-grid"><div className="admin-field"><label>名称</label><input value={era.label.zh} onChange={(event) => update({ ...era, label: { ...era.label, zh: event.target.value } })} /></div><div className="admin-field"><label>编码</label><input value={era.code} onChange={(event) => update({ ...era, code: event.target.value })} /></div><div className="admin-field"><label>排序</label><input type="number" value={era.order} onChange={(event) => update({ ...era, order: Number(event.target.value) })} /></div></div><div className="admin-row-actions"><Toggle checked={era.visible} onChange={(value) => update({ ...era, visible: value })}>显示年代</Toggle><button className="admin-button danger" type="button" onClick={() => remove(era)} disabled={document.works.some((work) => work.eraId === era.id)}>删除</button></div></div>)}</div></SectionCard>;
}

function SiteEditor({ document, patchDraft }: { document: ContentDocument; patchDraft: (updater: (document: ContentDocument) => ContentDocument) => void }) {
  const update = (site: ContentDocument["site"]) => patchDraft((current) => ({ ...current, site }));
  return <SectionCard title="首页与联系信息"><div className="admin-form"><ChineseField label="策展序言" value={document.site.intro} multiline onChange={(intro) => update({ ...document.site, intro })} /><ChineseField label="馆长署名" value={document.site.curator} onChange={(curator) => update({ ...document.site, curator })} /><ChineseField label="页脚标语" value={document.site.footerTagline} onChange={(footerTagline) => update({ ...document.site, footerTagline })} /><ChineseField label="开放时间" value={document.site.openingHours} multiline onChange={(openingHours) => update({ ...document.site, openingHours })} /><ChineseField label="联系方式" value={document.site.contact} multiline onChange={(contact) => update({ ...document.site, contact })} /><div className="admin-form-grid"><div className="admin-field"><label>Hero / 入场视频</label><MediaSelect assets={document.assets} value={document.site.heroVideoAssetId} kinds={["video"]} onChange={(heroVideoAssetId) => update({ ...document.site, heroVideoAssetId: heroVideoAssetId || undefined })} /></div></div></div></SectionCard>;
}

function LogsEditor({ document: source, patchDraft }: { document: ContentDocument; patchDraft: (updater: (document: ContentDocument) => ContentDocument) => void }) {
  const document = { ...source, logs: [...source.logs] };
  const [selectedId, setSelectedId] = useState(document.logs[0]?.id || "");
  const selected = document.logs.find((entry) => entry.id === selectedId) || document.logs[0];
  function update(log: UpdateLog) { patchDraft((current) => ({ ...current, logs: current.logs.map((item) => item.id === log.id ? log : item) })); }
  function add() { const log: UpdateLog = { id: `log-new-${crypto.randomUUID().slice(0, 8)}`, date: new Date().toISOString().slice(0, 10), title: { zh: "新日志", en: "新日志" }, body: { zh: "", en: "" }, visible: true, order: document.logs.length }; patchDraft((current) => ({ ...current, logs: [...current.logs, log] })); setSelectedId(log.id); }
  function remove() { if (!selected) return; const next = document.logs.find((entry) => entry.id !== selected.id); patchDraft((current) => ({ ...current, logs: current.logs.filter((item) => item.id !== selected.id) })); setSelectedId(next?.id || ""); }
  return <div className="admin-two-pane"><SectionCard title="日志列表" actions={<button className="admin-button" type="button" onClick={add}>新增</button>}><div className="admin-list admin-scroll-list">{document.logs.sort((a, b) => a.order - b.order).map((log) => <button className={`admin-list-row ${selected?.id === log.id ? "selected" : ""}`} type="button" key={log.id} onClick={() => setSelectedId(log.id)}><span><strong>{log.title.zh}</strong><small>{log.date}</small></span><span className="status-pill">{log.visible ? "发布" : "隐藏"}</span></button>)}</div></SectionCard>{selected && <SectionCard title="编辑日志" actions={<button className="admin-button danger" type="button" onClick={remove}>删除日志</button>}><div className="admin-form"><div className="admin-form-grid"><div className="admin-field"><label>日期</label><input type="date" value={selected.date} onChange={(event) => update({ ...selected, date: event.target.value })} /></div><div className="admin-field"><label>排序</label><input type="number" value={selected.order} onChange={(event) => update({ ...selected, order: Number(event.target.value) })} /></div></div><ChineseField label="标题" value={selected.title} onChange={(title) => update({ ...selected, title })} /><ChineseField label="正文" value={selected.body} multiline onChange={(body) => update({ ...selected, body })} /><Toggle checked={selected.visible} onChange={(visible) => update({ ...selected, visible })}>公开显示</Toggle></div></SectionCard>}</div>;
}

function AssetsEditor({ document, patchDraft, setNotice }: { document: ContentDocument; patchDraft: (updater: (document: ContentDocument) => ContentDocument) => void; setNotice: (value: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const references = referencedAssetIds(document);
  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const kind: MediaAsset["kind"] = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document";
    const id = `asset-upload-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const filename = file.name.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "upload";
    setUploading(true); setNotice("正在上传媒体……");
    try {
      const blob = await upload(`media/${kind}/${id}-${filename}`, file, { access: "public", handleUploadUrl: "/api/admin/assets/upload", multipart: file.size > 4.5 * 1024 * 1024, contentType: file.type || "application/octet-stream" });
      const asset: MediaAsset = { id, pathname: blob.pathname, url: blob.url, filename: file.name, kind, contentType: file.type || "application/octet-stream", size: file.size, status: "active", alt: { zh: file.name, en: file.name }, source: "uploaded", createdAt: new Date().toISOString() };
      const response = await fetch("/api/admin/assets/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset, baseRevision: document.revision }) });
      const body = await response.json() as { document?: ContentDocument; error?: string };
      if (!response.ok || !body.document) throw new Error(body.error || "媒体登记失败。");
      patchDraft(() => body.document!); setNotice(`媒体已上传：${file.name}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "媒体上传失败。"); } finally { setUploading(false); }
  }
  async function remove(asset: MediaAsset) {
    const response = await fetch("/api/admin/assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: asset.id, baseRevision: document.revision }) });
    const body = await response.json() as { document?: ContentDocument; error?: string };
    if (!response.ok || !body.document) { setNotice(body.error || "媒体删除失败。"); return; }
    patchDraft(() => body.document!); setNotice(`已删除 ${asset.filename}`);
  }
  return <SectionCard title="媒体资产" actions={<label className="admin-button primary">{uploading ? "上传中……" : "上传媒体"}<input type="file" hidden accept="image/*,video/mp4,video/webm,audio/*,.pdf,.txt,.zip" onChange={uploadAsset} disabled={uploading} /></label>}><p className="admin-muted">公开展品媒体上传到 public Blob。正在被内容引用的资产不能删除，需先在展品或首页中解除引用。</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>预览</th><th>文件</th><th>类型</th><th>大小</th><th>状态</th><th>操作</th></tr></thead><tbody>{document.assets.map((asset) => <tr key={asset.id}><td>{asset.kind === "image" ? <img className="asset-preview" src={asset.url || ""} alt="" /> : asset.kind}</td><td>{asset.filename}<br /><small>{asset.pathname}</small></td><td>{asset.contentType}</td><td>{asset.size ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : "—"}</td><td><span className={`status-pill ${asset.status === "missing" ? "new" : ""}`}>{asset.status === "missing" ? "待补" : references.has(asset.id) ? "引用中" : "未引用"}</span></td><td><button className="admin-button danger" type="button" disabled={references.has(asset.id)} onClick={() => remove(asset)}>删除</button></td></tr>)}</tbody></table></div></SectionCard>;
}

function FeedbackEditor({ records, setRecords }: { records: FeedbackRecord[]; setRecords: (records: FeedbackRecord[]) => void }) {
  const [selectedId, setSelectedId] = useState(records[0]?.id || "");
  const selected = records.find((record) => record.id === selectedId);
  async function changeStatus(id: string, status: FeedbackRecord["status"]) {
    const response = await fetch("/api/admin/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const body = await response.json() as { record?: FeedbackRecord };
    if (body.record) setRecords(records.map((record) => record.id === id ? body.record! : record));
  }
  return <div className="admin-two-pane"><SectionCard title={`收件箱 · ${records.length}`}><div className="admin-list admin-scroll-list">{records.map((record) => <button className={`admin-list-row ${selected?.id === record.id ? "selected" : ""}`} type="button" key={record.id} onClick={() => setSelectedId(record.id)}><span><strong>{record.message.slice(0, 42)}</strong><small>{record.createdAt}</small></span><span className={`status-pill ${record.status}`}>{record.status}</span></button>)}{!records.length && <p className="admin-muted">暂无意见。</p>}</div></SectionCard>{selected && <SectionCard title="意见详情"><p className="feedback-message">{selected.message}</p><p className="admin-muted">提交于 {selected.createdAt} · 更新于 {selected.updatedAt}</p><div className="admin-actions"><button className="admin-button" type="button" onClick={() => changeStatus(selected.id, "read")}>标记已读</button><button className="admin-button" type="button" onClick={() => changeStatus(selected.id, "archived")}>归档</button><button className="admin-button" type="button" onClick={() => changeStatus(selected.id, "new")}>恢复未读</button></div>{selected.attachments.length > 0 && <div className="admin-attachments"><h3>附件</h3>{selected.attachments.map((attachment) => <a href={`/api/admin/feedback/${selected.id}/attachment/${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer" key={attachment.id}>{attachment.filename} · {(attachment.size / 1024).toFixed(0)} KB</a>)}</div>}</SectionCard>}</div>;
}
