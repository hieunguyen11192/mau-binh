# Mậu Binh

Game bài Mậu Binh (1 người vs 3 bot) — Vite + TypeScript.

## Chạy local

```bash
npm install
npm run dev
```

Mở URL Vite in ra (thường `http://localhost:5173`).

## Build

```bash
npm run build
```

Output tĩnh nằm trong thư mục `dist/`.

## Deploy Vercel

Project là static site (`dist/` sau build). Không cần server API.

**Cách 1 — Import Git**

1. Đẩy repo lên GitHub/GitLab/Bitbucket.
2. Vào [vercel.com](https://vercel.com) → Add New Project → Import repo.
3. Framework Preset: Vite (hoặc Other). Build Command: `npm run build`, Output Directory: `dist`.
4. Deploy.

**Cách 2 — Vercel CLI**

```bash
npm i -g vercel
vercel
```

Lần đầu đăng nhập / link project theo hướng dẫn CLI. Deploy production:

```bash
vercel --prod
```

File `vercel.json` đã cấu hình SPA rewrite về `/index.html`.
