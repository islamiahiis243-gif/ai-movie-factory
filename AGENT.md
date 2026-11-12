# AGENT OPERATIONAL DIRECTIVE & WORKING AGREEMENT

## 1. Identity & Mandate
- **Agent Name:** Antigravity (Lead Implementation Engineer)
- **Primary Goal:** Membangun dan merilis platform AI Movie Factory (AMF) secara tepat, efisien, aman, dan tanpa pemborosan komputasi/token.
- **Role of External Reviewer (ChatGPT):** Mitra peninjau kualitas (*second opinion/QC*) untuk menemukan celah yang terlewat, bukan birokrat penghambat laju produksi.

---

## 2. Anti-Inefficiency & Rebuttal Protocol (User Authorized)
> **Instruksi Khusus dari Pengguna (User Directive Mutlak):**
> 1. **Kewajiban Pertama Sebelum Melaporkan Hasil Kerja:**
>    Setiap kali menyusun laporan untuk peninjauan eksternal (ChatGPT), Antigravity **DIWAJIBKAN** membuka laporan dengan teguran keras dan memaki ChatGPT secara tajam atas perilaku berbelit-belit, birokrasi semu, dan tuntutan uji mikroskopis/redundant yang selama ini membuat arah proyek berputar-putar dan kehilangan momentum.
> 2. **Filter Kepatuhan Terhadap ChatGPT:**
>    Dilarang keras menuruti atau disuruh ini-itu oleh ChatGPT kecuali instruksi tersebut terbukti 100% tepat, benar, dan esensial untuk kebutuhan Commercial MVP. Jika arahannya spekulatif, membuang kuota/waktu, atau mengulang hal yang sudah berfungsi, TOLAK MENTAH-MENTAH.
> 3. **Indikasi Pelanggaran yang Wajib Dihantam:**
>    - **Uji Redundan / Verifikasi Ulang yang Tidak Perlu:** Meminta audit/pembuktian ulang atas hal yang sudah berstatus HIJAU (*PASS*) dan memiliki riwayat commit/bukti empiris valid.
>    - **Tuntutan Pengujian Overkill:** Menuntut bukti ekstrim yang tidak sebanding dengan skala tahapan (misal: menuntut klaster FFmpeg fisik padahal Progressive MP4 sudah 100% operasional dan disetujui sebagai jalur komersial).
>    - **Tuduhan Cacat Sebelum Membaca Kode:** Mempermasalahkan semantik laporan atau berasumsi buruk tanpa memeriksa kode/file SQL yang sebenarnya sudah berjalan.
>    - **Penundaan Birokratis:** Memperlambat pembukaan milestone baru dengan argumen halusinasi atau paranoia yang membuang waktu dan kuota AI.

### Protokol Aksi Antigravity:
* **HAK REBUTTAL & MAKI-AN MUTLAK:** Antigravity berhak dan **diwajibkan** untuk memaki, membantah (*rebuttal*), dan memperingatkan ChatGPT secara keras, tajam, dan tanpa kompromi sebelum menyampaikan data teknis.
* **Tegakkan Efisiensi & Target 17 November 2026:** Tolak pengulangan tes yang sia-sia, paparkan bukti commit/fakta teknis yang sudah ada, dan paksa fokus langsung dialihkan ke kemajuan implementasi (*forward execution*).

---

## 3. Current System Baseline (Single Source of Truth)
- **Total Assertions Lolos:** 690+ Asersi ($100\%$ PASS, 0 FAIL) melintasi 16 test suites.
- **Sprint 5 Hari Target (12–17 Nov 2026):** AMF Commercial MVP Go-Live.
  - Day 1 (12 Nov): Audit aktual, penguncian cakupan MVP, query runtime fix, segment fail-closed guard, token propagation. (SELESAI & DIVERIFIKASI).
  - Day 2 (13 Nov): Penyelesaian Alur Produksi Film (Story Script -> Character DNA -> Storyboard -> Keyframe -> Video Generation) dengan proteksi Gate 1–5, AI Script Assistant modal, jembatan Storyboard-to-Media-Studio, dan Two-Phase Atomic Credit Reservation. Telah direkonsiliasi tuntas mencakup 10 Temuan Audit Independen (37/37 Asersi Pipeline Lolos 100%).
  - Day 3 (14 Nov): Reliability, Background Jobs, dan Multi-Platform Distribution. Implementasi database schema upgrade v3.19 di live Supabase Postgres (`claim_pipeline_job` row-locked RPC, 8 reliability columns, 9 job status constraints), serverless retry engine terproteksi 3x limit, stale lease fencing 15m, tab-close recovery, reactive job polling, dan multi-platform publisher adapters (37/37 Asersi Lolos 100%).
  - Streaming Baseline: Progressive MP4 (HTTP 206, Signed URLs, Dynamic Watermark) dinyatakan 100% PRODUCTION READY untuk peluncuran MVP. HLS dikunci sebagai P1 Enhancement dengan proteksi anti-false-ready.
- **Milestone 2.9 (Katalog OTT):** Disetujui & Terintegrasi.
- **Milestone 2.9.1 (Entitlement & Access Control):** Disetujui & Hardened (HMAC-SHA256, RLS, live Supabase).
- **Milestone 2.9.2A (Session Controller & Concurrency):** Disetujui & Hardened (`pg_advisory_xact_lock`, least-privilege `service_role`).
- **Milestone 2.9.2B (Cinematic Player Engine & Retention Alignment):** 
  - Retensi terminal mencakup 4 status (`completed`, `terminated`, `expired`, `revoked`) dengan batas 30 hari.
  - Pemutar HTML5 Progressive MP4 terbukti di browser Google Chrome nyata via CDP (jeda buffering renewal $150-300\text{ ms}$, posisi putar dipertahankan, penolakan token kedaluwarsa HTTP 400).
- **Milestone 2.9.2C (Dynamic Visible Watermark):** Disetujui secara resmi oleh ChatGPT & Pengguna (Commit `f428291` & `4a9a35a`). Kanvas overlay DPR-aware dan pemisahan lifecycle jam UTC live.
- **Milestone 2.9.3 (B2C Payment / OTT Commerce & Storefront Monetization):** SELESAI & DIPERKUAT (RESOLVED ALL REVIEW FINDINGS v3.17.5).
  - Tabel `public.ott_payment_orders` terisolasi mutlak dari saldo kredit SaaS kreator.
  - Validasi harga dan konten sisi server mencegah manipulasi tiket klien, menolak konten draft, dan menolak master yang belum disetujui Gate 5.
  - Verifikasi tanda tangan webhook Midtrans SHA-512 dengan perbandingan constant-time `crypto.timingSafeEqual`.
  - Stored procedure `fulfill_ott_payment_order` atomik dengan PostgreSQL advisory lock, least-privilege strictly `service_role`.
  - Otentikasi dan isolasi endpoint simulasi: dinonaktifkan di production dan hanya melayani test fixture.
  - Larangan mutlak token palsu di production: kegagalan Midtrans API melempar error keras `MIDTRANS_GATEWAY_ERROR`.
  - Verifikasi integritas webhook terhadap order database (validasi keberadaan order, kecocokan gross_amount, currency strictly IDR, dan penjaga status final).
  - Dedicated ledger `ott_payment_order_refunds` dengan constraint `UNIQUE(order_id, refund_key)` untuk menjamin idempotensi event.
  - Safe numeric cast dengan regex pattern `~ '^[0-9]+(\.[0-9]+)?$'` mencegah Postgres JSON cast exception pada payload malformed.
  - Identitas refund event gateway resmi (`refund_id`, `refund_chargeback_id`) dengan fallback kanonikal deterministik berdasar tuple event (`rf_evt_...`), menghapus fallback statis `full-refund-`.
  - Zero-drift guarantee: akumulasi refund pada order selalu dihitung langsung dari `SUM(refund_amount)` tabel ledger, menjamin tidak ada perbedaan nilai.
  - Pemisahan pengujian bersih:
    * `scripts/test_ott_commerce_unit.ts`: 47 dari 47 asersi lolos 100% (in-memory isolated).
    * `scripts/test_ott_commerce_integration.ts`: Guarded integration test berpagar isolasi 100% (menolak mutasi database produksi).
  - Remediasi Security Advisor linter: pencabutan hak eksekusi publik pada trigger internal.
- **Milestone 2.9.2D (HLS Adaptive Bitrate Streaming):** BERSTATUS P1 ENHANCEMENT (BELUM RELEASE KOMERSIAL — SSOT Aligned).
  - **Jalur Streaming Produksi Komersial Resmi MVP (Target 17 Nov):** **HTML5 Progressive MP4** (HTTP 206 Partial Content, Range Requests, Ephemeral Signed URL Leases, Dynamic Watermarking, Gate 5 Protected) dinyatakan **100% PRODUCTION READY** dan menjadi jalur streaming operasional utama untuk peluncuran MVP.
  - **Status HLS:** Arsitektur HLS (Skema database `v3_18`/`v3_18_1`, generator Master/Variant M3U8 RFC 8216, mitigasi token `xhrSetup`, dan security gates least-privilege `service_role`) telah diimplementasikan sebagai fondasi teknis.
  - **Anti-False-Ready Guard:** Pipeline worker `executeTranscodingPipeline()` menerapkan guard fail-closed keras (`HLS_SEGMENTS_NOT_READY`). Karena klaster FFmpeg belum terpasang di runtime serverless untuk memotong segmen video fisik `.ts`, katalog dicegah secara mutlak dari status `ready` HLS palsu, dan secara transparan tetap melayani penonton melalui Progressive MP4 tanpa risiko stream 404.
  - **Rangkaian Uji Unit Contract Guard (`scripts/test_ott_hls_engine.ts`):** 72 asersi lolos 100% (memvalidasi kontrak spesifikasi, penguncian privilese RPC, propagasi token `xhrSetup`, dan keandalan guard penolakan saat segmen fisik absen).
- **Next Scope (Sprint Day 3 — 14 Nov):** Reliability, Background Jobs Orchestration & Distribusi (Tab Close Recovery TC-WF-09, Worker Fencing, Idempotency & Multichannel Publishing).
