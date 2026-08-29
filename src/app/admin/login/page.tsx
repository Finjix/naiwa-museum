"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "登录失败。"); }
      const next = new URLSearchParams(window.location.search).get("next");
      router.push((next && next.startsWith("/") ? next : "/admin") as never); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败。"); } finally { setBusy(false); }
  }

  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><div className="kicker">MUSÉE DU MILK FROG · ADMIN</div><h1>后台管理</h1><div className="admin-field"><label htmlFor="username">管理员账号</label><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div><div className="admin-field"><label htmlFor="password">密码</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div>{error && <p className="admin-missing" role="alert">{error}</p>}<button className="admin-button primary" type="submit" disabled={busy}>{busy ? "登录中……" : "进入后台"}</button></form></main>;
}
