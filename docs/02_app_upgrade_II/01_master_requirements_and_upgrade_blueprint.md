# AI MOVIE FACTORY — MASTER REQUIREMENTS & UPGRADE BLUEPRINT
## GELOMBANG II: USER-INTEREST CENTRIC, PRODUCTION OPERATING SYSTEM & OTT ECOSYSTEM
### (Production-Hardened, Multi-Gate Workflow, Cost Protection & Phased Implementation)

- **Dokumen:** Master Requirements & Spesifikasi Peningkatan Aplikasi
- **Lokasi Direktori:** `docs/02_app_upgrade_II/01_master_requirements_and_upgrade_blueprint.md`
- **Versi Rilis Dokumen:** 2.1 (Gelombang II Upgrade — Production-Hardened)
- **Timestamp:** `2026-11-10 07:45 +07:00`
- **Fokus Utama:** Transformasi AMF dari sekadar AI Generator menjadi **AI Film Production & Creator Business Operating System** yang terintegrasi penuh dari ide cerita, produksi riil, proteksi biaya pengguna, hingga monetisasi multi-saluran (Medsos, Web Mandiri, & OTT) dengan tata kelola deployment produksi yang aman.

---

## 🛡️ IMPLEMENTATION GOVERNANCE & CHANGE CONTROL

Mengingat AI Movie Factory telah aktif berjalan di lingkungan produksi (Vercel, Supabase, GitHub, dan Google Cloud), seluruh pengembangan Gelombang II wajib tunduk pada aturan tata kelola perubahan berikut:

1. **Perlindungan Sistem Produksi Aktif:** Seluruh fondasi Gen 1 yang telah teruji (23 tabel PostgreSQL, Row-Level Security, atomic credit ledger 2-Phase Commit, Google Gemini 2.5 Flash serverless functions) harus diperlakukan sebagai sistem produksi hidup yang tidak boleh dirusak atau dirombak tanpa justifikasi migrasi.
2. **Definisi Ruang Lingkup (Scope Boundary):** Sebelum memodifikasi kode atau skema, tentukan batasan perubahan secara presisi. Dilarang merombak modul yang sudah bekerja hanya demi pergantian gaya kode.
3. **Kompatibilitas Mundur (Backward Compatibility):** Semua perubahan skema database dan API harus mempertahankan backward compatibility. Gunakan migration script terstruktur (`supabase/migrations/`) yang menyertakan rencana rollback.
4. **Prinsip Kejujuran Teknis (Zero Mockup Status):** Jika suatu fitur belum selesai atau provider API belum terhubung, tampilkan status *Pending / Under Development* secara transparan. Dilarang keras membuat mock status sukses seolah-olah produksi riil telah terjadi.
5. **Pencatatan Riwayat Perubahan (SSOT Changelog):** Dokumen Master Blueprint ini berfungsi sebagai acuan kebutuhan masa depan (*future requirements*), sedangkan `CHANGELOG.md` tetap menjadi rekaman historis kebenaran tunggal (*Single Source of Truth*) atas apa yang benar-benar telah diubah dan diuji pada aplikasi.

---

## 🎯 VISI UTAMA & POSISI PENGGUNA

> *"Saya memosisikan diri sebagai pengguna sekaligus sutradara dan pemilik bisnis kreator yang ingin membuat drama/film AI profesional dari nol sampai menghasilkan pendapatan nyata.*  
> *Saya tidak ingin aplikasi yang sekadar membingungkan dengan tumpukan menu dan generator AI tanpa arah. Saya ingin AI Movie Factory menjadi pabrik produksi film terpadu yang memandu saya langkah demi langkah, mengendalikan biaya, melindungi data saya, dan mengubah karya menjadi keuntungan finansial yang terukur."*

### Filosofi Inti: AMF Bekerja untuk Pengguna
> **"AMF harus bekerja keras untuk mempermudah pekerjaan pengguna. Bukan pengguna yang harus bekerja keras untuk memahami cara kerja teknis AMF."**

### Dua Mesin Utama AI Movie Factory
1. **Production Engine:** Mengubah ide mentah menjadi film berkualitas tinggi dengan konsistensi visual-audio yang terjaga melalui persetujuan sutradara berlapis.
2. **Creator Business & Monetization Engine:** Mengubah aset film menjadi jangkauan audiens massal, multi-channel distribution, kepemilikan platform mandiri, dan keuntungan bersih terverifikasi.

---

## 💡 USER EXPERIENCE & USER-INTEREST PRINCIPLES

Untuk memastikan AMF ramah pengguna (*user-friendly*), efisien, dan fokus pada kepentingan kreator (*user-interest centric*), antarmuka dan interaksi wajib mematuhi 8 prinsip berikut:

1. **Easy to Start (Mudah Dimulai):**
   - Pengguna baru langsung disambut oleh *First-Time User Onboarding* interaktif.
   - Pilihan *Template Proyek Siap Pakai* berdasarkan format populer: *YouTube Shorts / TikTok (9:16)*, *Cinematic Drama Series (16:9)*, *Micro-Drama Reel*, atau *Commercial Film*.
   - Pengguna dapat memulai proyek tanpa wajib memahami arsitektur AI di belakang layar.
2. **Guided Workflow & Next Best Action:**
   - Di setiap modul dan dashboard, sistem menampilkan kartu panduan: *"Langkah Terbaik Selanjutnya (Next Best Action)"*.
   - Pengguna tidak pernah dibiarkan bingung di layar kosong; sistem selalu menunjukkan status saat ini dan satu tombol aksi prioritas untuk melanjutkan.
3. **Smart Defaults (Pilihan Awal Cerdas):**
   - Setiap form generasi AI telah terisi dengan parameter standar industri yang terbukti berhasil (aspek rasio, resolusi, pencahayaan, lensa, dan frame rate).
   - Pengguna pemula cukup menekan satu tombol; pengguna mahir dapat membuka opsi lanjutan.
4. **Progressive Disclosure (Penyederhanaan Bertingkat):**
   - Tampilan utama hanya menyajikan kontrol esensial (karakter, naskah, tombol aksi, preview hasil).
   - Pengaturan teknis mendalam (model weighting, seed injection, negative prompt, sampler steps, API payload) disembunyikan di dalam menu *Advanced Settings (Dapat Diperluas)*.
5. **Contextual Help & Transparent Status:**
   - Setiap modul menyajikan ringkasan singkat: *Tujuan Modul*, *Input yang Dibutuhkan*, *Hasil yang Akan Diperoleh*, dan *Estimasi Kredit/Waktu*.
   - Tooltip kontekstual tersedia di setiap istilah teknis perfilman atau AI.
6. **Autosave, Draft Recovery & Conflict Handling:**
   - Setiap perubahan naskah, storyboard, dan timeline disimpan otomatis (*Autosave*) dengan indikator visual *"Tersimpan"* yang jelas.
   - Tersedia riwayat versi draft (*Version History*) dan fitur *Undo / Redo*.
   - Jika tab browser tidak sengaja tertutup atau jaringan terputus, pekerjaan dapat dipulihkan seketika dari cache/database lokal tanpa kehilangan data.
7. **Complete User Control (Kendali Penuh Sutradara):**
   - AI hanya bertindak sebagai asisten kreatif; sutradara memegang kendali mutlak untuk menyetujui (*Approve*), menolak (*Reject*), merevisi (*Regenerate Partial*), membandingkan versi (*Side-by-Side Comparison*), atau membatalkan proses (*Cancel*).
8. **Responsive & Ergonomic Workspace:**
   - Navigasi utama dirancang fleksibel untuk workstation desktop multi-monitor, laptop standar, maupun tablet review sutradara.

---

## ⚖️ LIMA PRINSIP NON-KOMPROMI SUTRADARA (THE 5 GOLDEN RULES)

Dalam seluruh siklus pengembangan dan produksi, lima prinsip ini tidak boleh ditawar:

1. **Konsistensi Karakter Multi-Layer:** Identitas visual karakter (wajah, postur, warna mata, busana khas) harus konsisten di seluruh shot dan episode. Karena tidak ada satu pun model AI yang menjamin kemiripan 100% hanya melalui seed acak, AMF menerapkan **8-Layer Consistency Architecture** (Master Reference, Identity DNA, Image Conditioning, Attribute Locking, Model Tuning, Face Similarity QC, Human Review Gate, Versioned References).
2. **Konsistensi Cerita (Single Source of Truth):** Seluruh visual, adegan, shot list, dan dialog wajib patuh pada naskah yang telah melalui *Script Approval Gate*. Perubahan pada naskah memicu *Change Impact Analysis* yang menandai shot atau aset yang terpengaruh.
3. **Integrasi Nyata Antarmodul:** Semua modul saling berbagi data terpusat dalam skema proyek yang sama melalui PostgreSQL Supabase, bukan bekerja secara terisolasi sebagai pulau data mandiri.
4. **Produksi Nyata (Real Asset Generation):** Gambar, video, audio, dan editing harus menghasilkan file fisik riil melalui provider AI yang terintegrasi. Sistem dilarang menampilkan simulasi sukses jika aset belum benar-benar ter-render dan tersimpan di storage.
5. **Keamanan Data & Perlindungan Biaya:** Data naskah, aset media, dan kredit pengguna tidak boleh hilang akibat gangguan jaringan atau kegagalan worker. Setiap transaksi generasi AI dilindungi oleh estimasi biaya transparan dan proteksi kegagalan.

---

# 🎬 MASTER WORKFLOW & PRODUCTION EXECUTION ORDER

AI Movie Factory beroperasi menyerupai studio produksi film profesional. Pengguna dipandu melalui urutan kerja produksi yang terstruktur, memiliki ketergantungan tegas antarmodul, dan dilengkapi gerbang persetujuan sutradara (*Director Approval Gates*) di setiap tahap krusial.

### A. Urutan Kerja Utama dari Awal hingga Monetisasi (18 Tahapan Terstruktur)

```
01. PROJECT SETUP & TEMPLATE SELECTION
        │
        ▼
02. STORY DEVELOPMENT (Ide → Logline → Sinopsis → Treatment → Naskah)
        │
        ▼
03. [GATE 1] SCRIPT APPROVAL (Kunci Naskah Final & Version Lock)
        │
        ├───────────────────────────────────────┐
        ▼                                       ▼
04A. WORLD BUILDER                      04B. CHARACTER STUDIO
     (Lokasi, Pencahayaan, Atmosfer)          (DNA Karakter, Master Reference)
        │                                       │
        └───────────────────┬───────────────────┘
                            ▼
05. [GATE 2] WORLD & CHARACTER APPROVAL (Kunci Aset Master)
                            │
                            ▼
06. STORYBOARD STUDIO (Scene Breakdown → Shot List → Camera Direction)
                            │
                            ▼
07. [GATE 3] STORYBOARD APPROVAL (Kunci Komposisi & Rencana Shot)
                            │
                            ▼
08. IMAGE GENERATION (Keyframe / Master Still per Shot)
                            │
                            ▼
09. [GATE 4] KEYFRAME IMAGE APPROVAL (Kunci Visual Dasar Shot)
                            │
                            ▼
10. VIDEO GENERATION (Motion Synthesis / Video Rendering)
        │
        ├───────────────────────────────────────┐
        ▼                                       ▼
11A. VOICE & DIALOGUE                   11B. MUSIC & SOUND DESIGN
     (Karakter Suara, Dialog, Lip-sync)       (BGM, SFX, Ambient Foley)
        │                                       │
        └───────────────────┬───────────────────┘
                            ▼
12. QUALITY CONTROL & CONTINUITY INSPECTION (15 Parameter QC)
                            │
                            ▼
13. EDITING & POST-PRODUCTION (Assembly, Multi-Track, Color, Subtitle)
                            │
                            ▼
14. [GATE 5] FINAL QC & DIRECTOR MASTER APPROVAL
                            │
                            ▼
15. MASTER RENDER & MULTI-PRESET EXPORT (Web MP4 vs Master ProRes)
                            │
                            ▼
16. DISTRIBUTION & MULTI-PLATFORM PUBLISHING (Medsos, Web, OTT)
                            │
                            ▼
17. PERFORMANCE MONITORING & AUDIENCE RETENTION
                            │
                            ▼
18. MONETIZATION, REVENUE ANALYSIS & BUSINESS OPTIMIZATION
```

---

### B. Ketentuan Ketergantungan Antarmodul (Module Dependency Matrix)

Setiap tahapan produksi memiliki prasyarat ketat. Modul berikutnya dilarang mengeksekusi generasi jika input data dari modul sebelumnya belum lengkap dan belum disetujui:

| Tahapan Produksi | Prasyarat Wajib Sebelum Generasi / Eksekusi | Keterangan Dependensi |
| :--- | :--- | :--- |
| **01. Project Setup** | Metadata proyek, rasio aspek (16:9 / 9:16), target durasi | Inisialisasi konfigurasi proyek |
| **02. Story Development** | Parameter proyek telah tersimpan | Membangun naskah terstruktur |
| **03. Script Approval** | Naskah adegan lengkap, durasi estimasi dihitung | **Pintu masuk wajib (Gate 1)** sebelum perancangan visual |
| **04. World & Character** | Naskah berstatus `APPROVED` (Gate 1) | Membangun referensi visual karakter dan lokasi |
| **05. World & Char Approval** | Master character sheet dan master environment disetujui | **Pintu masuk wajib (Gate 2)** sebelum perancangan shot |
| **06. Storyboard Studio** | Naskah `APPROVED` + Karakter & Lokasi `LOCKED` | Memecah adegan menjadi shot list teknis |
| **07. Storyboard Approval** | Seluruh prompt shot, framing, dan camera movement disetujui | **Pintu masuk wajib (Gate 3)** sebelum generasi gambar |
| **08. Image Generation** | Storyboard `APPROVED` + Seed/Reference Image terkunci | Menghasilkan keyframe visual fisik |
| **09. Image Approval** | Keyframe gambar per shot disetujui sutradara | **Pintu masuk wajib (Gate 4)** sebelum animasi video |
| **10. Video Generation** | *Tergantung Mode Generasi (Lihat Aturan Khusus di bawah)* | Mengubah prompt/keyframe menjadi motion video riil |
| **11A. Voice & Dialogue** | Naskah dialog approved, profil suara karakter terpilih | Dapat diproses paralel dengan video |
| **11B. Music & SFX** | Mood cerita approved, durasi adegan diketahui | Dapat diproses paralel dengan video |
| **12. Quality Control** | Aset video, dialog, dan audio adegan telah di-render | Evaluasi kontinuitas dan kualitas teknis |
| **13. Editing & Post-Pro** | Seluruh klip video lulus QC teknis dasar | Penggabungan timeline, transisi, audio mixing |
| **14. Final Approval** | Assembly timeline lengkap, audio mix seimbang | **Pintu masuk wajib (Gate 5)** sebelum render akhir |
| **15. Master Render** | Proyek berstatus `FINAL_APPROVED` | Ekspor file video master sesuai preset |
| **16. Distribution** | File master render fisik tersedia di storage | Publikasi ke multi-platform atau OTT |
| **17. Performance Analytics** | Konten berhasil terpublikasi dan memiliki tracking ID | Monitoring data views, watch time, audiens |
| **18. Monetization Analysis** | Data analitik dan laporan transaksi penonton tersedia | Laporan laba bersih dan feedback loop produksi |

---

### C. Aturan Khusus Dependensi Metode Generasi Video

Modul Video Generation wajib membedakan tiga alur kerja input yang berbeda agar tidak terjadi kegagalan atau pemborosan kredit:

1. **Text-to-Video (T2V):**
   - *Input Wajib:* Naskah shot yang telah disetujui + Style Preset + Camera Movement Prompt.
   - *Batasan:* Digunakan khusus untuk shot latar belakang (*establishing shot*), lanskap alam, atau shot tanpa karakter utama manusia.
2. **Image-to-Video (I2V) — Standar Utama Film:**
   - *Input Wajib:* Keyframe Image yang telah lulus *Gate 4 (Image Approval)* + Motion Prompt + Dynamic Strength parameter.
   - *Keunggulan:* Menjamin karakter dan lokasi identik dengan keyframe yang disetujui sutradara sebelum dianimasikan.
3. **Storyboard-to-Video (Batch Sequence Video):**
   - *Input Wajib:* Rangkaian keyframe awal (*First Frame*) dan keyframe akhir (*Last Frame*) + Motion Vectors + Transition Data.
   - *Penggunaan:* Digunakan untuk adegan aksi kompleks atau transisi kamera berkelanjutan antarshot.

---

### D. Lima Gerbang Persetujuan Sutradara (The 5 Director Approval Gates)

Sistem AMF memberlakukan 5 gerbang persetujuan wajib yang tidak dapat dilewati secara otomatis:

```
[GATE 1] SCRIPT APPROVAL GATE
         └─ Naskah, dialog, dan struktur scene dikunci sebagai SSOT.
[GATE 2] WORLD & CHARACTER APPROVAL GATE
         └─ Wajah, proporsi, pakaian karakter, dan master lokasi dikunci ke database.
[GATE 3] STORYBOARD APPROVAL GATE
         └─ Shot breakdown, framing, sudut kamera, dan durasi shot disetujui.
[GATE 4] KEYFRAME IMAGE APPROVAL GATE
         └─ Gambar acuan setiap shot disetujui sebelum biaya komputasi video dikeluarkan.
[GATE 5] FINAL MASTER APPROVAL GATE
         └─ Peninjauan hasil editing utuh (video + audio + subtitle) sebelum ekspor master.
```

---

### E. Siklus Revisi Cerdas (Smart Revision Loop & Impact Analysis)

Jika sutradara memutuskan untuk melakukan revisi pada tahap mana pun, AMF menerapkan aturan penanganan dampak (*Impact Analysis*):

1. **Revisi Naskah (Pasca Gate 1):** Sistem menandai shot, dialog, dan aset visual yang terdampak perubahan sebagai status `OUTDATED / REQUIRES_REVIEW`. Aset shot yang tidak berubah tetap dipertahankan untuk menghemat biaya.
2. **Revisi Karakter (Pasca Gate 2):** Jika referensi karakter diubah, sistem memberikan opsi:
   - *Global Update:* Regenerasi seluruh keyframe yang melibatkan karakter tersebut.
   - *Selective Update:* Hanya perbarui karakter pada shot tertentu.
3. **Revisi Shot Tunggal (In-Timeline):** Sutradara dapat merevisi satu shot video langsung dari timeline editor tanpa merender ulang shot lain di sekitarnya.

---

# 🏛️ BAGIAN I: PRODUCTION ENGINE (7 MODUL UTAMA)

### 1. Modul Proyek Saya (Project Management & Templates)
- **Dashboard Proyek:** Menampilkan katalog proyek aktif, status tahapan produksi, persentase kelulusan, dan total biaya yang telah digunakan.
- **First-Time User Onboarding:** Panduan interaktif 3 langkah untuk kreator baru: (1) Pilih Format & Genre, (2) Masukkan Ide Cerita, (3) Jalankan Naskah Pertama.
- **Katalog Template Siap Pakai:**
  - *Short-Form Viral (9:16, 60 detik, pacing cepat, hook 3 detik).*
  - *Cinematic Drama Series (16:9, episode 3-5 menit, multi-karakter).*
  - *Micro-Series OTT (Vertikal/Horisontal, episode cliffhanger).*
  - *Commercial / Trailer (Format sinematik 30 detik).*

### 2. Modul Cerita & Naskah (Story Development & Version Lock)
- Generator naskah berbantu AI (Gemini 2.5 Flash) dari ide mentah menjadi format naskah standar industri.
- Format breakdown: Scene Number, Slugline (INT/EXT - LOKASI - WAKTU), Action Description, Character Dialogue, Parenthetical, Camera Notes.
- **Script Version Lock:** Penguncian naskah final berstatus `LOCKED_V1` dengan audit trail perubahan.
- **Change Impact Indicator:** Notifikasi visual otomatis jika naskah diubah setelah storyboard dibuat.

### 3. Modul World Builder (Pembangunan Dunia Cerita)
- Pembangunan ensiklopedia lokasi dan atmosfer visual film.
- **Master Location Reference:** 1 Master Still Lokasi dengan metadata pencahayaan (*Golden Hour, Cyberpunk Neon, Moody Fog*), cuaca, dan palet warna.
- Generator konsistensi lingkungan multi-sudut (*Wide Shot, Medium Interior, Detail Prop*).

### 4. Modul Character Studio (8-Layer Consistency Architecture)
Untuk mengatasi keterbatasan AI yang tidak dapat menjamin 100% konsistensi hanya dengan seed, AMF menerapkan 8 lapisan penguncian karakter:
1. **Master Character Reference Sheet:** Minimal 4 sudut pandang visual (Front, 3/4 Left, 3/4 Right, Close-Up Portrait).
2. **Character Identity DNA Profile:** Atribut tekstual permanen (usia, etnisitas, warna/tekstur rambut, bentuk mata, bekas luka khas, pakaian default).
3. **Reference Image Conditioning (IP-Adapter / ControlNet):** Injeksi gambar acuan langsung ke payload provider AI video/gambar.
4. **Attribute Prompt Locking:** Token positif dan negatif wajib yang otomatis disisipkan ke setiap prompt shot yang melibatkan karakter.
5. **Provider-Specific Seed Anchoring:** Penyimpanan seed per model AI yang mendukung reproduksibilitas.
6. **Face Similarity Evaluation:** Inspeksi QC otomatis berbasis embedding kemiripan wajah (threshold kelulusan min. 80%).
7. **Human Approval Override:** Pilihan persetujuan manual oleh sutradara jika AI memberikan variasi minor yang dapat diterima secara artistik.
8. **Versioned Character Assets:** Penyimpanan variasi pakaian (*Wardrobe Variants*) yang tetap menjaga struktur wajah yang sama.

### 5. Modul Storyboard Studio (Perencanaan Visual & Shot List)
- Breakdown otomatis naskah menjadi shot list terstruktur:
  - *Shot Size:* Extreme Wide Shot (EWS), Wide (WS), Medium (MS), Close Up (CU), Extreme Close Up (ECU).
  - *Camera Angle:* Eye Level, High Angle, Low Angle, Dutch Angle, Over the Shoulder (OTS).
  - *Camera Movement:* Static, Pan, Tilt, Dolly/Tracking, Zoom, Crane.
  - *Action Prompt & Lighting Direction*.
- Estimasi durasi per shot dan visualisasi storyboard grid.

### 6. Modul Media Studio (Real AI Generation & Provider Capability Matrix)
Media Studio mengintegrasikan generator aset fisik nyata dengan transparansi kapabilitas provider:

| Provider AI | Tipe Input | Resolusi Maksimal | Durasi per Shot | Fitur Khusus | Estimasi Biaya |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Imagen 3** | Text / Image | Up to 4K | Keyframe Image | Photorealism, Text Rendering | Rendah |
| **Runway Gen-3 Alpha** | Text / Image (I2V) | 1080p | 5s - 10s | Camera Control, Director Motion | Menengah-Tinggi |
| **Luma Dream Machine**| Text / Image | 1080p | 5s | Fisika Gerak Halus, Transisi Cepat | Menengah |
| **Kling AI** | Text / Image | 1080p | 5s - 10s | Konsistensi Anatomi, Multi-Shot | Menengah |
| **ElevenLabs Voice** | Text / SSML | 44.1kHz Studio | Sesuai Naskah | Voice Cloning, Emotion Tags | Rendah |

- **Side-by-Side Version Comparison:** Menampilkan hingga 4 variasi hasil generasi untuk dipilih oleh sutradara.
- **Partial Regeneration (Inpainting):** Regenerasi area tertentu pada keyframe tanpa merombak seluruh gambar.

### 7. Modul Editing & Post-Produksi
- **Browser-Side Non-Linear Editor (NLE Preview):**
  - Multi-track timeline (Video Track, Dialog Track, BGM Track, SFX Track, Subtitle Track).
  - Trimming, split, ripple edit, cross-dissolve, cut-on-action.
  - Real-time subtitle generator (SRT/VTT) tersinkronisasi otomatis dengan naskah dialog.
- **Multi-Tier Export Presets:**
  - *Social Web Preset (Default):* MP4, H.264 / AAC, 1080p (16:9 atau 9:16), target loudness -16 LUFS (standar YouTube/TikTok/Reels).
  - *Cinema / Master Preset:* ProRes 422 HQ / MP4 H.265, 4K UHD, 24fps, target loudness -14 LUFS (standar streaming premium/OTT).

---

# 🎛️ BAGIAN II: PRODUCTION CONTROL, QUALITY ASSURANCE & RELIABILITY

### 8. Quality Control & Kontinuitas (15 Parameter Wajib Berlapis)
QC AMF membedakan evaluasi menjadi 3 kategori: **AI Auto-Analysis**, **Technical Rule Engine**, dan **Director Manual Verification**.

1. **Konsistensi Wajah Karakter (Layer 6 Similarity Check)** — *Auto AI*
2. **Konsistensi Pakaian & Properti Karakter** — *Auto AI & Manual*
3. **Konsistensi Lingkungan & Latar Belakang** — *Auto AI*
4. **Kontinuitas Pencahayaan & Palet Warna** — *Technical Check*
5. **Kesesuaian Aksi Visual terhadap Naskah** — *Manual Director*
6. **Deteksi Distorsi Anatomi & AI Glitch** — *Auto AI*
7. **Kelancaran Gerak Kamera & Anti-Jitter** — *Technical Check*
8. **Sinkronisasi Gerak Bibir & Dialog (Lip-sync)** — *Technical Check*
9. **Kualitas & Kejelasan Suara Dialog** — *Technical Check*
10. **Keseimbangan Audio Mix (Voice vs Music vs SFX)** — *Technical Check*
11. **Penyelarasan Emosi Musik terhadap Mood Adegan** — *Manual Director*
12. **Ketepatan Durasi, Timing, dan Ritme Editing** — *Technical Check*
13. **Kesesuaian Target Resolusi & Aspek Rasio** — *Technical Check*
14. **Kepatuhan Loudness Standar Distribusi (-14 s.d. -16 LUFS)** — *Technical Check*
15. **Kesesuaian Format Ekspor & Subtitle Timing** — *Technical Check*

- **Severity Levels & Exception Handling:**
  - *Critical Blocker:* Cacat anatomis berat, distorsi wajah fatal, audio clipping $\rightarrow$ Wajib revisi, tombol ekspor terkunci.
  - *Warning / Advisory:* Variasi pencahayaan minor, durasi lebih 0.5s $\rightarrow$ Sutradara dapat memberikan *Override Approval* dengan alasan tercatat.

---

### 9. Pipeline Orchestrator, Job Queue & Background Recovery

Untuk menjamin pekerjaan tidak hilang ketika koneksi putus atau tab browser ditutup, AMF dilengkapi sistem manajemen antrean tangguh:

```
[User Action: Generate]
        │
        ▼
[Pre-Generation Cost Estimation & Wallet Balance Check]
        │
   (Approved)
        ▼
[Create Job Record in DB (Status: QUEUED, Idempotency Key)]
        │
        ▼
[Asynchronous Background Worker / Serverless Edge]
        ├── Polling / Webhook from AI Provider
        ├── Progress Tracking (0% ── 50% ── 100%)
        └── Timeout & Exponential Backoff Retry (Max 3x)
        │
   (Success) ──────────────────────────┐ (Unrecoverable Error)
        ▼                               ▼
[Download & Save Physical Asset]    [Auto-Refund Reserved Credits]
[Update DB Status: COMPLETED]       [Mark Status: FAILED + Reason]
[Notify User in Dashboard]          [Suggest Actionable Next Step]
```

#### Fitur Keandalan Antrean:
1. **Asynchronous Execution:** Proses komputasi video berjalan mandiri di backend; pengguna bebas menutup browser atau berpindah halaman.
2. **Idempotency Protection:** Setiap request generasi dilengkapi token idempotency unik untuk mencegah pemotongan kredit ganda atau duplikasi render akibat double-click.
3. **Resilience & State Recovery:** Jika koneksi terputus saat streaming, status terakhir tetap tersimpan di database; saat pengguna membuka kembali AMF, progress langsung dipulihkan.
4. **Actionable Failure Messages:** Jika provider AI menolak request (misal: filter konten atau kuota rate limit), sistem menampilkan pesan manusiawi beserta opsi solusi (revisi prompt atau beralih ke provider alternatif).

---

### 10. Cost Estimation & Spending Protection (Credit Management)

Tombol eksekusi generasi di AMF dilindungi oleh transparansi biaya:

1. **Pre-Generation Cost Preview:** Sebelum proses generasi dijalankan, modal dialog menampilkan rincian: *Model AI yang Digunakan*, *Estimasi Waktu Pengerjaan*, *Kredit yang Dibutuhkan*, dan *Sisa Saldo Kredit*.
2. **Project Budget Cap:** Sutradara dapat menyetel batas maksimal pengeluaran kredit untuk satu proyek tertentu guna menghindari pembengkakan biaya tak terencana.
3. **Failed Job Credit Guarantee:** Jika sebuah job generasi dinyatakan gagal oleh provider atau mengalami timeout sistem, kredit yang telah dipotong/dipesan otomatis dikembalikan 100% ke saldo pengguna dengan catatan audit di ledger transaksi.
4. **Daily / Monthly Spend Alerts:** Notifikasi visual saat pengeluaran telah mencapai 80% dari batas anggaran harian yang ditentukan pengguna.

---

### 11. AI Agent Manager (Tim Produksi Virtual 15 Agen Spesialis)

Sistem didukung 15 agen virtual yang bertindak sebagai kru film digital pengguna:

1. **Executive Producer Agent:** Pengawasan anggaran proyek, timeline, dan alokasi kredit.
2. **Scriptwriter Agent:** Perumusan ide, penulisan sinopsis, dan formatting naskah film.
3. **Script Doctor Agent:** Analisis kelemahan plot, struktur dramaturgi, dan penguatan dialog.
4. **Production Designer Agent:** Konseptualisasi dunia cerita, palet warna, dan estetika latar.
5. **Casting Director Agent:** Perancangan visual karakter, DNA atribut, dan variasi kostum.
6. **Director of Photography (DoP) Agent:** Penentuan jenis shot, pergerakan kamera, dan pencahayaan.
7. **Storyboard Artist Agent:** Visualisasi komposisi shot dan prompt generasi keyframe.
8. **AI Prompt Engineer Agent:** Optimasi prompt khusus sesuai sintaks spesifik masing-masing provider.
9. **Visual Generation Operator Agent:** Eksekusi batch generation gambar dan video.
10. **Voice Casting & Dialogue Director Agent:** Kurasi karakter vokal, intonasi, dan lip-syncing.
11. **Sound Designer Agent:** Perancangan ambience suara, foley effect, dan spatial audio.
12. **Film Composer Agent:** Produksi musik latar (BGM) sesuai dinamika emosi cerita.
13. **Lead Film Editor Agent:** Pemotongan timeline, kontinuitas transisi, dan ritme adegan.
14. **Quality Control Inspector Agent:** Evaluasi 15 parameter QC dan penandaan cacat visual.
15. **Distribution & Marketing Strategist Agent:** Perancangan metadata, thumbnail, dan strategi rilis multi-platform.

---

# 🌐 BAGIAN III: DISTRIBUTION ENGINE & CREATOR BUSINESS HUB

### 1. Multi-Platform Publishing Studio
- **Platform API Capability Matrix:**
  - *YouTube (Direct API):* Unggah video otomatis, setel judul, deskripsi, tag, visibilitas (Public/Unlisted/Draft), dan thumbnail.
  - *TikTok (Direct API / Share Kit):* Distribusi video vertikal 9:16 dengan tagar trending dan suara terintegrasi.
  - *Instagram Reels & Facebook (Meta Graph API):* Publikasi video pendek dan scheduling feed.
  - *Export Package (Manual Mode):* Bagi platform tanpa API terbuka, AMF menyediakan tombol *One-Click Download All* yang berisi video siap tayang, file cover thumbnail, dokumen teks caption/hashtag, dan subtitle SRT.
- **Publishing Calendar & Scheduling:** Penjadwalan posting otomatis berdasarkan jam tayang puncak audiens.

### 2. Performance Analytics Dashboard
- Integrasi metrik performa lintas kanal: Total Views, Watch Time, Average View Duration (AVD), Audience Retention Curve, Likes, Comments, Shares, dan Click-Through Rate (CTR).
- **Content Performance Feedback Loop:** Analitik performa audiens dapat dikirimkan kembali ke *Story Development Module* sebagai wawasan data untuk menentukan tema, hook adegan pembuka, atau genre film berikutnya.

### 3. Comprehensive Financial Breakdown (Revenue Intelligence)
AMF menyajikan kalkulasi finansial bisnis yang transparan, memisahkan data aktual dari proyeksi AI:

$$\text{Net Profit} = \text{Gross Revenue} - (\text{Refunds} + \text{Platform Fees} + \text{Payment Gateway Fees} + \text{AI Production Cost} + \text{Hosting \& CDN Cost} + \text{Tax})$$

- **Aturan Transparansi Keuangan:**
  1. *Actual Revenue vs Estimated RPM:* Pendapatan nyata yang sudah diterima ditandai label **[VERIFIED ACTUAL]**, sedangkan proyeksi pendapatan berdasarkan tayangan ditandai label **[ESTIMATED PROJECTION]**.
  2. *Data Integrity:* Jika data analitik monetisasi pihak ketiga belum tersedia atau belum terhubung, sistem menampilkan status **[DATA PENDING / NOT CONNECTED]**, dilarang menampilkan angka fiktif atau angka nol yang menyesatkan.
  3. *ROI Calculation:* Perhitungan Return on Investment hanya diaktifkan jika biaya produksi riil tercatat di sistem.

### 4. AI Business Advisor (Penasihat Strategis Kreator)
- AI Advisor memberikan rekomendasi bisnis berbasis data analitik riil penonton.
- *Etika Rekomendasi:* AI Advisor dilarang membuat klaim garansi keuntungan mutlak. Setiap saran wajib menyertakan data acuan, asumsi pasar, tingkat keyakinan (*confidence level*), serta batas risiko bisnis.

---

# 📺 BAGIAN IV: INDEPENDENT OTT & VIDEO PLATFORM PUBLISHING (PILAR BISNIS KEEMPAT)

Pilar ini dirancang untuk memerdekakan kreator film AI dari ketergantungan sepihak pada algoritma media sosial pihak ketiga dengan membangun ekosistem streaming mandiri.

### 1. Ragam Model Platform OTT Mandiri
Kreator dapat membuat portal streaming web profesional untuk:
- *Micro-Drama Subscription Hub (Short Series bulanan bergaya DramaBox / ReelShort).*
- *Indie Film Premiere Platform (Pay-Per-View rilis film bioskop mandiri).*
- *Web Series Episodic Channel (Akses serial berbayar dengan episode awal gratis).*
- *Studio Film Showcase & Portfolio (Katalog portofolio studio untuk klien komersial).*

### 2. No-Code Visual Website Builder di Dalam AMF
- Builder halaman visual dengan komponen sinematik siap pakai: Hero Video Banner, Netflix-Style Carousel Tray, Episode Grid, Cast Showcase, Pricing Table, dan Floating Video Player.
- Kustomisasi identitas merek: Domain kustom (CNAME), logo studio, palet warna, tipografi, dan favicon.

### 3. Model Monetisasi Mandiri Terpadu
- **SVOD (Subscription Video on Demand):** Langganan mingguan, bulanan, atau tahunan.
- **TVOD (Transactional Video on Demand / Pay-Per-View):** Pembelian atau penyewaan per film/episode.
- **AVOD (Advertising-Supported Video on Demand):** Penayangan iklan VAST/VPAID mandiri sebelum video.
- **Creator Tipping & Fan Sponsorship:** Donasi langsung dari penonton setia.
- **Integrasi Payment Gateway:** Stripe, Midtrans, PayPal, dan metode pembayaran lokal terpercaya.

### 4. Arsitektur Video Streaming & Keamanan Konten
- **Adaptive Bitrate Streaming (HLS):** Streaming video lancar multi-resolusi (1080p, 720p, 480p, 360p) menyesuaikan kecepatan internet penonton.
- **Signed URL & Token-Based Authentication:** Video hanya dapat diputar oleh penonton yang memiliki hak akses sah, mencegah pencurian tautan video langsung (*hotlinking*).
- **Dynamic Watermarking:** Penempatan watermark dinamis (User ID / Email penonton) transparan di atas video untuk mencegah pembajakan rekaman layar (*screen recording*).

---

# 🗺️ BAGIAN V: ARSITEKTUR BESAR 5 PILAR EKOSISTEM AMF

Seluruh kemampuan AI Movie Factory terangkum dalam 5 pilar arsitektur yang saling terintegrasi:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI MOVIE FACTORY (AMF)                          │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. PRODUCTION     │ 2. PRODUCTION     │ 3. DISTRIBUTION                │
│    ENGINE         │    CONTROL        │    ENGINE                      │
│ ├─ Project Mgmt   │ ├─ 15 QC Params   │ ├─ YouTube API Direct          │
│ ├─ Story & Script │ ├─ 5 Approval Gate│ ├─ TikTok Direct               │
│ ├─ World Builder  │ ├─ Pipeline Engine│ ├─ Meta / Reels API            │
│ ├─ Char Studio    │ ├─ Job Queue & Rec│ ├─ Publishing Calendar         │
│ ├─ Storyboard     │ ├─ 15 AI Agents   │ ├─ Multi-Channel Analytics     │
│ ├─ Real Media Gen │ ├─ Cost Protection│ └─ Asset Export Package        │
│ └─ NLE Post-Pro   │ └─ Evidence Tests │                                │
├───────────────────┴───────────────────┴────────────────────────────────┤
│ 4. INDEPENDENT OTT & STREAMING PLATFORM                                │
│ ├─ No-Code Website Builder (Sinematik, Tray, Player HLS)               │
│ ├─ SVOD, TVOD, AVOD, Fan Tipping, Licensing                            │
│ ├─ Payment Gateways (Stripe, Midtrans, PayPal)                         │
│ ├─ Signed URLs, Dynamic Watermark & DRM Token                          │
│ └─ Platform Member & Subscriber Management                             │
├────────────────────────────────────────────────────────────────────────┤
│ 5. CREATOR BUSINESS INTELLIGENCE                                       │
│ ├─ Real Financial Breakdown (Gross, Fees, AI Cost, Taxes, Net Profit)  │
│ ├─ Actual vs Estimated RPM Tracking                                    │
│ ├─ Real-Time Production ROI Calculator                                 │
│ ├─ AI Business Advisor (Evidence-based recommendations)                │
│ └─ Analytics-to-Production Feedback Loop                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

# 🔐 SECURITY, DATA PROTECTION & PRODUCTION DEPLOYMENT RULES

Mengingat agen pengembang memiliki akses ke kredensial produksi (Supabase, Vercel, GitHub, Google Cloud), aturan keamanan ketat berikut bersifat mutlak:

1. **Pengelolaan Kredensial & Secrets:**
   - Seluruh token akses pribadi (*Personal Access Token / PAT*), API keys, service role keys, dan credential string dilarang keras ditulis di kode sumber (*source code*), commit git, dokumentasi terbuka, atau log aplikasi.
   - Semua rahasia wajib dimuat melalui file `.env` lokal (yang masuk `.gitignore`) atau melalui *Vercel Environment Variables Console*.
2. **Prinsip Least Privilege:**
   - Akses CLI dan token hanya digunakan untuk membaca status, mengecek log error, memverifikasi healthcheck, dan melakukan migrasi yang terencana.
   - Dilarang membuat, menghapus, atau merotasi kredensial produksi tanpa instruksi eksplisit dari pemilik akun.
3. **Integritas Database Supabase:**
   - Dilarang menjalankan perintah SQL destruktif (`DROP TABLE`, `TRUNCATE`, `DROP COLUMN`) pada database produksi tanpa persetujuan eksplisit dan backup data yang terverifikasi.
   - Setiap tabel baru yang menyimpan data pengguna atau proyek wajib mengaktifkan Row-Level Security (RLS) dengan kebijakan isolasi data per akun (`auth.uid() = user_id`).
4. **Verifikasi Build & Healthcheck:**
   - Setiap perubahan kode harus lulus validasi build lokal (`npm run build` dengan 0 TypeScript error) sebelum di-push ke branch repository utama.
   - Deployment Vercel harus diverifikasi mencapai status `READY (200 OK)` pasca-push.

---

# 🚀 PHASED IMPLEMENTATION & RELEASE ROADMAP

Pengembangan Gelombang II tidak dikerjakan secara serentak melainkan melalui 6 fase rilis terukur. Setiap fase harus memenuhi kriteria penerimaan dan bukti pengujian sebelum melanjutkan ke fase berikutnya:

| Fase | Nama Fase | Fokus Implementasi Utama | Kriteria Keberhasilan & Bukti Uji |
| :---: | :--- | :--- | :--- |
| **Fase 1** | **Foundation & Security** | Login, RLS, Database 23 tabel, atomic credit ledger, Vercel build bersih | *Telah selesai & terverifikasi di Gen 1 (Commit 135dd60, Status READY).* |
| **Fase 2** | **Production Workflow & Multi-Gate Engine** | Alur naskah, karakter, storyboard, media studio, NLE timeline, dan 5 Approval Gates | Naskah tersimpan, shot list terbentuk, keyframe ter-render, approval gate berfungsi memblokir tahapan berikutnya jika belum disetujui. |
| **Fase 3** | **Production Reliability & Cost Protection** | Job queue, background worker, idempotency token, proteksi saldo gagal render | Tab ditutup saat render video tetap selesai di background; kredit gagal di-refund otomatis. |
| **Fase 4** | **Distribution Engine** | Integrasi API medsos, scheduler calendar, paket ekspor aset | Metadata ter-generate otomatis; paket unduhan lengkap (video, cover, caption, subtitle). |
| **Fase 5** | **Creator Business Intelligence** | Formula laba bersih nyata, pemisahan actual vs estimated, AI advisor | Dashboard keuangan menampilkan biaya riil, fee platform, dan estimasi net profit yang akurat. |
| **Fase 6** | **Web & Independent OTT Studio** | Website builder, video player HLS, payment gateway, streaming paywall | Situs web kreator aktif; penonton dapat membeli akses film dan memutar video aman. |

---

# 🧪 ACCEPTANCE TEST MATRIX (EVIDENCE-BASED)

Seluruh acceptance test pada Gelombang II berstatus awal `[ ]` (Pending Verification) dan hanya dapat ditandai lulus apabila disertai bukti pengujian aktual (log, screenshot, atau response ID):

| Test ID | Skenario Pengujian | Target Lingkungan | Status Verifikasi | Kriteria Kelulusan & Bukti Uji |
| :--- | :--- | :--- | :---: | :--- |
| **TC-WF-01** | **Project Setup & Template Selection** | Staging / Prod | `[ ]` Pending | Proyek berhasil dibuat dari template YouTube Shorts dengan konfigurasi 9:16 tersimpan di database. |
| **TC-WF-02** | **Script Generation & Version Locking** | Staging / Prod | `[ ]` Pending | Gemini API menghasilkan naskah berstruktur slugline lengkap; status `LOCKED_V1` berhasil tersimpan. |
| **TC-WF-03** | **Director Approval Gate 1 (Script)** | Staging / Prod | `[ ]` Pending | Storyboard Studio menolak membuat shot list jika naskah belum diberi tanda `APPROVED` oleh sutradara. |
| **TC-WF-04** | **8-Layer Character Consistency Lock** | Staging / Prod | `[ ]` Pending | Character Master Sheet tersimpan; prompt generasi otomatis menginjeksi DNA atribut karakter. |
| **TC-WF-05** | **Director Approval Gate 2 (Character)** | Staging / Prod | `[ ]` Pending | Keyframe Image Generator menolak proses sebelum master karakter disetujui sutradara. |
| **TC-WF-06** | **Storyboard Breakdown & Gate 3** | Staging / Prod | `[ ]` Pending | Scene terurai menjadi 5 shot dengan atribut kamera spesifik; Gate 3 mengunci komposisi shot. |
| **TC-WF-07** | **Image Keyframe Generation & Gate 4** | Staging / Prod | `[ ]` Pending | Provider menghasilkan file gambar fisik di storage; Gate 4 memvalidasi keyframe sebelum komputasi video. |
| **TC-WF-08** | **Video Generation (I2V Mode)** | Staging / Prod | `[ ]` Pending | Video berdurasi 5 detik ter-render berdasarkan keyframe gambar; file MP4 valid tersimpan di storage. |
| **TC-WF-09** | **Asynchronous Job Queue & Tab Close** | Staging / Prod | `[ ]` Pending | Browser ditutup saat video 30% berjalan; saat dibuka kembali, job berhasil berstatus `COMPLETED`. |
| **TC-WF-10** | **Failed Job Credit Protection** | Staging / Prod | `[ ]` Pending | Simulasi request error ke provider; sistem otomatis mengembalikan kuota kredit tanpa tagihan ganda. |
| **TC-WF-11** | **Voice Dialogue & Lip-sync Integration**| Staging / Prod | `[ ]` Pending | Voice provider menghasilkan dialog vokal sinkron dengan durasi shot dan teks naskah. |
| **TC-WF-12** | **15-Parameter Continuous QC Check** | Staging / Prod | `[ ]` Pending | Sistem QC memeriksa kontinuitas visual dan kesesuaian audio loudness (-14 s.d. -16 LUFS). |
| **TC-WF-13** | **Multi-Track NLE Timeline Editing** | Staging / Prod | `[ ]` Pending | Klip video, audio dialog, dan subtitle VTT terangkai di timeline browser dan dapat diputar sinkron. |
| **TC-WF-14** | **Director Approval Gate 5 & Master Export**| Staging / Prod | `[ ]` Pending | Ekspor master ProRes / MP4 1080p berhasil menghasilkan file unduhan fisik yang dapat diputar lokal. |
| **TC-WF-15** | **Multi-Channel Publishing Package** | Staging / Prod | `[ ]` Pending | Satu klik menghasilkan video, thumbnail JPG, teks caption, hashtag, dan file subtitle siap posting. |
| **TC-WF-16** | **Financial Breakdown & Profit Calculation**| Staging / Prod | `[ ]` Pending | Formula Net Profit memotong seluruh komponen biaya aktual (produksi, gateway, hosting) secara transparan. |

---

# ⚖️ REBUTTAL & TECHNICAL CLARIFICATION MATRIX

Berdasarkan tinjauan kritis sebelumnya, berikut adalah tanggapan teknis (*rebuttal*) objektif dan klarifikasi implementasi demi menyelaraskan persepsi dengan arsitektur nyata AMF:

| Poin Reviewer | Tanggapan / Rebuttal Teknis AMF | Status Tindakan |
| :--- | :--- | :--- |
| **1. "Halaman web AMF tidak dapat diinspeksi / halaman kosong tanpa konten."** | **REBUTTAL OBJEKTIF:** URL produksi `https://ai-movie-factory.vercel.app/` berstatus **HTTP 200 OK** dan aktif. Ketiadaan konten saat diinspeksi oleh web crawler disebabkan oleh arsitektur **Single Page Application (SPA React 19)** dengan guard autentikasi Supabase (`<ProtectedRoute>`). Mesin crawler tanpa JavaScript tidak mengeksekusi hydration browser. Deployment Vercel terbukti aktif melayani pengguna terautentikasi dan 8 serverless functions beroperasi normal. | **Dijelaskan:** Tata cara pengujian sistem kini wajib melalui browser aktif dengan sesi autentikasi pengguna yang sah. |
| **2. "AMF dinilai hanya sebuah mockup/prototipe UI tanpa sistem yang benar-benar bekerja."** | **REBUTTAL OBJEKTIF:** Penilaian ini tidak akurat terhadap fondasi Gen 1 yang telah terbangun. AMF telah memiliki database produksi PostgreSQL Supabase (23 tabel dengan RLS), sistem pencatatan keuangan kredit atomik 2-Phase Commit (`deduct_credits_with_ledger`), integrasi live Google Gemini 2.5 Flash, dan build produksi bersih tanpa error (Commit `135dd60`). Gelombang II adalah *peningkatan orkestrasi dan alur kerja*, bukan memulai aplikasi kosong dari nol. | **Diadopsi:** Menambahkan bab *Implementation Governance* agar pengembang tidak merombak apa yang sudah bekerja. |
| **3. "Standar ProRes 4K dan -14 LUFS terlalu kaku dan tidak realistis untuk seluruh film web."** | **KLARIFIKASI & ADOPSI SEBAGIAN:** Parameter ProRes 4K dan -14 LUFS dirancang sebagai standar *Master Archival / Premium OTT*, bukan untuk membatasi kreator medsos. Kritik ini sangat tepat dalam hal fleksibilitas. AMF kini membagi output menjadi **Multi-Preset Export**: preset default web/medsos (MP4, H.264, -16 LUFS) dan preset master film sinema (ProRes 422 HQ, -14 LUFS). | **Diadopsi:** Menambahkan opsi preset fleksibel di Modul 7 (Editing & Post-Pro). |
| **4. "Persetujuan naskah dan aset ditempatkan terlambat di urutan workflow awal."** | **SEPENUHNYA VALID & DIADOPSI:** Naskah dan aset karakter memang wajib disetujui sebelum storyboard dan generasi gambar dieksekusi agar kredit komputasi tidak terbuang sia-sia. | **Diadopsi:** Membagi workflow menjadi 5 Director Approval Gates yang ditempatkan secara berurutan dan ketat. |
| **5. "Jangan menjanjikan 100% konsistensi wajah absolut hanya dengan seed."** | **SEPENUHNYA VALID & DIADOPSI:** Model generative AI memiliki stochastic variance yang tidak dapat dijamin 100% identik hanya lewat seed. | **Diadopsi:** Mengganti janji absolut dengan arsitektur pertahanan berlapis **8-Layer Character Consistency System**. |
| **6. "Acceptance test tidak boleh diberi tanda centang [x] tanpa bukti pengujian riil."** | **SEPENUHNYA VALID & DIADOPSI:** Penggunaan centang [x] pada dokumen perencanaan menimbulkan ilusi kelulusan sebelum pengujian aktual dilaksanakan. | **Diadopsi:** Mengubah semua status menjadi `[ ]` Pending dengan tabel Acceptance Test Matrix berbasis bukti uji. |
| **7. "Perhitungan keuntungan harus memasukkan refund, gateway fee, dan biaya hosting."** | **SEPENUHNYA VALID & DIADOPSI:** Formula bisnis kreator wajib memperhitungkan potongan biaya riil secara komprehensif. | **Diadopsi:** Memperbarui formula Revenue Intelligence dengan seluruh komponen biaya operasional dan label *Actual vs Estimated*. |

---

# 🔒 HAK CIPTA, KEPEMILIKAN & LISENSI DATA

AI Movie Factory dibangun dengan prinsip kedaulatan kreator (*Creator Sovereignty*):

1. **Kepemilikan Karya:** Seluruh naskah, alur cerita, karakter, shot list, susunan editing, dan hasil master render adalah milik sah kreator pengguna AMF, dengan tetap tunduk pada ketentuan layanan masing-masing provider AI yang digunakan, lisensi aset pihak ketiga, dan peraturan perlindungan hak cipta yang berlaku.
2. **Kedaulatan Data Penonton:** Pada platform Web & OTT mandiri, data akun penonton, riwayat transaksi, dan database pelanggan adalah aset milik kreator seutuhnya tanpa dimonopoli oleh platform pihak ketiga.
3. **Fitur Portabilitas Data:** AMF menyediakan sarana ekspor data proyek lengkap (*Project Archive Export*) dan opsi penghapusan akun beserta seluruh data secara permanen (*Right to be Forgotten*) sesuai standar privasi data global.

---

*Dokumen ini merupakan Dokumen Spesifikasi Kebutuhan Resmi (Master Requirements) Gelombang II AI Movie Factory yang telah diperkuat dan diselaraskan untuk implementasi aman.*
