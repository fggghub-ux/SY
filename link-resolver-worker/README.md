# U2 Link Resolver Worker

该 Worker 为 iMessage 外链消息读取无需登录的公开网页。它不使用 Cookie，不绕过登录、验证码或平台访问限制。

## 部署

1. 安装 Node.js 18 或更高版本，并登录 Cloudflare：`npx wrangler login`。
2. 将 `wrangler.toml` 中的 `ALLOWED_ORIGINS` 改成实际网页 Origin，例如 `https://example.github.io`。本地和线上地址可用逗号分隔。
3. 在本目录执行 `npm install` 和 `npm run deploy`。
4. 将返回的 `https://....workers.dev` 地址填入 U2 的“设置 → API 配置 → 外链解析”。

## 本地验证

```powershell
npm test
npm run dev
```

健康检查为 `GET /health`，解析接口为 `POST /v1/resolve-link`。短链和每次跳转都会重新执行公网地址检查。

## 限制

- 小红书、抖音、微博等平台可能因登录墙或反爬只返回预览信息。
- 单页响应最大 2 MiB，提取正文最多 50,000 字符，超出时返回 `truncated: true`。
- 不下载视频，不执行页面 JavaScript。
