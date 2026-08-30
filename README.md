# 奶蛙博物馆

基于 Next.js App Router、TypeScript 和 Vercel Blob 的奶蛙博物馆。公开展馆使用已发布内容，后台以单管理员维护草稿、发布版本、媒体和意见箱。

## 本地运行

```bash
npm install
npm run dev
```

开发环境默认使用 `src/data/legacy-seed.json` 和本地 `.local-data/`，不会把内容写回旧 HTML。未配置生产凭据时，本地后台账号是 `admin` / `milkfrog`；该回退凭据只在非生产环境启用。

## Vercel 环境变量

生产环境至少配置：

- `MUSEUM_DATA_SOURCE=blob`
- `BLOB_MEDIA_READ_WRITE_TOKEN`：公开展品图片、视频等媒体 Blob store token
- `BLOB_PRIVATE_READ_WRITE_TOKEN`：内容 JSON、意见和私有附件 Blob store token
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`：bcrypt 哈希，不保存明文密码
- `AUTH_SECRET`：随机、长期有效的会话签名密钥
- `MUSEUM_PUBLIC_ORIGIN`：正式站点 origin，例如 `https://museum.example.com`

正式部署已绑定上述变量；`MUSEUM_PUBLIC_ORIGIN` 指向 `https://naiwa-museum.vercel.app`。后台初始账号为 `admin`，初始密码沿用本地回退密码 `milkfrog`，登录后应立即更换 `ADMIN_PASSWORD_HASH`。`.vercelignore` 仍屏蔽同名旧资源，防止误恢复时进入部署包。

## 管理后台

- `/admin/login`：登录
- `/admin`：发布状态
- `/admin/works`、`/admin/artists`、`/admin/eras`：展品资料
- `/admin/site`、`/admin/logs`：站点与更新日志
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
