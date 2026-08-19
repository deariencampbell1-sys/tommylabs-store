# Tommy Labs Maker Catalog — Deploy Guide

Target: **`catalog.tommylabs.store`** — the community catalog (Maker World-style
hub): browse ideas, upload your own, hang out on the workbench, and the 2D→3D
Lab slot where the future image→3D engine plugs in.

This folder is **self-contained** — static files only, no build step. It is
ready to hand to whoever holds the Cloudflare credentials for `tommylabs.store`.

---

## 1. Local preview (any machine)

```bash
cd catalog
npx serve .            # or: python -m http.server 8080
# open http://localhost:8080
```

## 2. Deploy to Cloudflare Pages (needs Cloudflare credentials)

The storefront (`tommylabs.store`) lives on Cloudflare Pages as project
`tommylabs-store`. The catalog should be its **own Pages project** so it gets
its own URL space.

### Option A — wrangler CLI (fastest)

```bash
# from repo root (wrangler is already a devDependency here)
npx wrangler pages project create tommylabs-catalog --production-branch main

# deploy this folder
npx wrangler pages deploy catalog --project-name tommylabs-catalog

# attach the custom subdomain
npx wrangler pages domain add tommylabs-catalog catalog.tommylabs.store
```

### Option B — Cloudflare dashboard

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**
2. Project name: `tommylabs-catalog`, upload the **`catalog/`** folder (not the repo root)
3. After first deploy: **Custom domains** → **Set up a custom domain** →
   `catalog.tommylabs.store`
4. If the zone prompts for DNS: add a `CNAME` record `catalog` →
   `tommylabs-catalog.pages.dev` (or accept Cloudflare's automatic record)

## 3. DNS (if not auto-created)

```text
Type: CNAME
Name: catalog
Target: tommylabs-catalog.pages.dev
Proxy: Proxied (orange cloud)
```

## 4. Verify like a user

- Open `https://catalog.tommylabs.store` — home feed renders, category chips filter, search works
- Upload an image → it appears in the grid as a **PENDING REVIEW** community item and persists on refresh
- Open the **2D → 3D Lab**, paste a picture (Ctrl+V) → preview appears; the output panel shows the engine-slot state
- Store items (badge `STORE`) show a live 3D viewer — the GLBs are pulled cross-origin from `https://tommylabs.store/models-webp/*.glb` (CORS headers already set in the store's `_headers`)

## 5. Installing the 2D→3D engine (later)

Open `catalog/index.html`, find the block at the top of the script:

```js
window.TOMMY_3D_ENGINE = {
  endpoint: null,   // ← engine URL goes here
  apiKey: null,
  prompt: ""
};
```

Contract: `POST { image: "<dataURL jpeg>", prompt: "<text>" }` →
`{ modelUrl: "https://…/result.glb" }` (a bare URL string also works).
The Lab renders any returned GLB in the built-in model-viewer and falls back
gracefully when the slot is empty. No other code changes needed.

---

Notes:

- Community uploads and workbench posts persist in **localStorage** (per
  browser) until a real backend is added — by design for the preview phase.
- Images uploaded are downscaled to ≤900px JPEG in-browser before storage.
- `vendor/model-viewer.min.js` is a local copy — the catalog works with zero
  external requests except the store GLBs.
