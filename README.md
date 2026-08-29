# 奶蛙博物馆

基于 Next.js App Router、TypeScript 和 Vercel Blob 的奶蛙博物馆迁移版。公开展馆使用已发布内容，后台以单管理员维护草稿、发布版本、媒体和意见箱。

## 本地运行

```bash
npm install
npm run dev
```

开发环境默认使用 `src/data/legacy-seed.json` 和本地 `.local-data/`，不会把内容写回旧 HTML。未配置生产凭据时，本地后台账号是 `admin` / `milkfrog`；该回退凭据只在非生产环境启用。

## 内容与媒体迁移

旧 HTML、`app.js.下载` 和本地资源仍保留在工作区，供一次性提取使用：

```bash
npm run legacy:extract
npm run migration:check
```

设置 `MUSEUM_DATA_SOURCE=blob`、`BLOB_MEDIA_READ_WRITE_TOKEN` 和 `BLOB_PRIVATE_READ_WRITE_TOKEN` 后执行：

```bash
npm run migration:blob
```

迁移脚本会把本地 55 张展品图和现有 MP4 上传到 `media/`，把 `content/draft.json`、`content/published.json`、`content/history/{revision}.json` 和 `assets/index.json` 写入私有 Blob。远程缺失资源保持为“待补”，不会自动下载或生成。

## Vercel 环境变量

生产环境至少配置：

- `MUSEUM_DATA_SOURCE=blob`
- `BLOB_MEDIA_READ_WRITE_TOKEN`：公开展品图片、视频等媒体 Blob store token
- `BLOB_PRIVATE_READ_WRITE_TOKEN`：内容 JSON、意见和私有附件 Blob store token
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`：bcrypt 哈希，不保存明文密码
- `AUTH_SECRET`：随机、长期有效的会话签名密钥
- `MUSEUM_PUBLIC_ORIGIN`：正式站点 origin，例如 `https://museum.example.com`

部署前先执行 Blob 迁移，再运行 `npm run build`。确认公开站点和后台均能读取 Blob 后，才删除旧 HTML、旧脚本和本地大媒体；`.vercelignore` 已避免这些旧文件进入 Vercel 部署包。

## 管理后台

- `/admin/login`：登录
- `/admin`：发布状态与迁移概览
- `/admin/works`、`/admin/artists`、`/admin/eras`：展品资料
- `/admin/site`、`/admin/logs`、`/admin/quiz`：站点、日志和鉴定所
- `/admin/assets`：媒体上传、预览和引用保护
- `/admin/feedback`：意见收件、已读/归档和私有附件查看

保存草稿会递增 revision；发布前未发布内容不会出现在公开站点。删除正在引用的媒体会由服务端拒绝，必须先解除引用。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run migration:check
npm run build
```
