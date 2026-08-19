# FINDER — TommyLabs 3D assets (29-product batch + booth 360)

**Status 2026-08-19:** batch ~18/29 done, running on the Lightning A100.
**Owner rule: everything lives in R2 (or HF). No other store.**

## Where the finished assets ARE / WILL BE

### 1. R2 (canonical, the ONE place)
- Bucket: `rhobear-plans-cloud`, endpoint `https://c7571465de05d07542774a24fa9b0021.r2.cloudflarestorage.com`
- Creds: `D:\rhobear-agent-vault\cloudflare\r2-owner-token.txt` (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)
- Prefix: `rhobear/3d/runs/<run-id>/` — each run = ONE product:
  - `RHOBEAR_CHECKPOINT_MANIFEST.json` (schema v1, sha256 per file)
  - `objects/<product>.glb` — textured PBR GLB (albedo + metallic-roughness baked)
  - `objects/<product>_v00..v07.png` — 8-view color turntable renders
- `rhobear/3d/aliases/` — pointer to "latest" run (being added at batch end)

### 2. Lightning A100 (working copy, may sleep)
- SSH: `ssh -i ~/.ssh/lightning_rsa s_01kzxs2hjb2swseh6cbenctecf@ssh.lightning.ai`
- Account: dearien.campbell1@gmail.com (NOT the pit account — creds in ~/.lightning/credentials.json are the real one since the setup script ran)
- Working dir: `/teamspace/studios/this_studio/out_exact/`
  - `glb/<product>.glb`, `renders/<product>_vNN.png`, `results.json` (status per product)
- Source photos: `/teamspace/studios/this_studio/photos_exact/` (the 29, renamed_images)
- Booth videos: `/teamspace/studios/this_studio/booth/` (2 MP4s) + `frames_*` (extracted) + `masks_*` (person masks)

### 3. Site repo (where they ship)
- `C:\Users\slang\tommylabs-store\` (public: deariencampbell1-sys/tommylabs-store)
- Site loads `models-webp/*.glb` (WebP textures, ~400KB–1.1MB) + `img/previews/*.jpg`
- Current models in site: batman, dragon, owl, tiger, wolf (old set)
- **Asset compiler step needed:** Hunyuan GLBs have JPG textures (~4–9MB); the site format is WebP-compressed (~0.5–1MB). The gen-runtime repo has the compiler lane (`rhobear-gen-runtime` tools/ — gltf-transform webp). Convert before shipping.

## File naming (input == output, per owner rule)
`batman cowl.jpeg` (input) → `batman cowl.glb` + `batman cowl_v00..v07.png` (output).
`results.json` keys by the exact input filename. Pairing is deterministic.

## Pipeline recap (for the next agent)
- Runner: `C:\Users\slang\tmp_batch_3d\run_batch.py` (Hunyuan3D 2.1: rembg → shape → PBR paint → pygltflib GLB → turntable renders)
- Checkpoint: `r2_checkpoint.py push_checkpoint(dir, family, run_id, source, alias)` — per-item R2 push after each success
- Watchdog: `C:\Users\slang\tmp_batch_3d\watchdog.py` — restarts studio + resumes batch (`--resume` skips done)
- Studio auto-shutdown DISABLED (disable_auto_shutdown=true) — no more idle kills

## Booth 360 lane (after the 29)
Videos → COLMAP poses → 3D Gaussian Splatting → three exports:
1. full scene (walkthrough), 2. person-only splat (masks), 3. booth-only splat (person masked out)
→ three.js gaussian-splat renderer, scroll-driven, isolate/toggle controls.
