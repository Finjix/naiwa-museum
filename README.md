# 奶蛙博物馆

基于 Next.js App Router、TypeScript 和 Vercel Blob 的奶蛙博物馆。

## 本地运行

```bash
npm install
npm run dev
```

## Vercel 环境变量

生产环境至少配置：

- `MUSEUM_DATA_SOURCE=blob`
- `BLOB_MEDIA_READ_WRITE_TOKEN`：公开展品图片、视频等媒体 Blob store token
- `BLOB_PRIVATE_READ_WRITE_TOKEN`：内容 JSON、意见和私有附件 Blob store token
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`：bcrypt 哈希，不保存明文密码
- `AUTH_SECRET`：随机、长期有效的会话签名密钥
- `MUSEUM_PUBLIC_ORIGIN`：正式站点 origin，例如 `https://museum.example.com`

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
