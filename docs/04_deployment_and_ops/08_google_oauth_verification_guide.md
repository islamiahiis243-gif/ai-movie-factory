# PANDUAN LENGKAP PENGAJUAN VERIFIKASI GOOGLE OAUTH & YOUTUBE API
## AI Movie Factory — Persiapan Verifikasi Aplikasi Publik (Google Trust & Safety)

Dokumen ini berisi panduan langkah demi langkah dan teks jawaban resmi (*Copy-Paste Ready*) untuk mengisi formulir **OAuth Consent Screen & App Verification** di **Google Cloud Console**.

---

### 1. Informasi Dasar Proyek Google Cloud

| Parameter | Nilai Resmi |
|---|---|
| **Google Cloud Project ID** | `ai-movie-factory` |
| **Project Number** | `849277677377` |
| **Akun Pemilik (Admin)** | `islamiahiis243@gmail.com` |
| **Nama Aplikasi (App Name)** | `AI Movie Factory` |
| **User Support Email** | `islamiahiis243@gmail.com` |
| **Developer Contact Email** | `islamiahiis243@gmail.com` |
| **Application Home Page** | `https://ai-movie-factory.vercel.app` |
| **Application Privacy Policy Link** | `https://ai-movie-factory.vercel.app/privacy` |
| **Application Terms of Service Link** | `https://ai-movie-factory.vercel.app/terms` |
| **Authorized Domain** | `vercel.app` (atau domain kustom Anda) |

---

### 2. Konfigurasi OAuth Consent Screen (Langkah demi Langkah)

Buka [Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent?project=ai-movie-factory):

#### Langkah A: App Information
1. **App Name:** `AI Movie Factory`
2. **User Support Email:** Pilih `islamiahiis243@gmail.com`.
3. **App Logo:** Unggah emblem resmi AI Movie Factory (tersedia di `src/assets/branding/amf-emblem.png` - ukuran 120x120 px).
4. **App Domain:**
   - Application Home Page: `https://ai-movie-factory.vercel.app`
   - Application Privacy Policy: `https://ai-movie-factory.vercel.app/privacy`
   - Application Terms of Service: `https://ai-movie-factory.vercel.app/terms`
5. **Authorized Domains:** Tambahkan `vercel.app`.
6. **Developer Contact Information:** `islamiahiis243@gmail.com`.
7. Klik **Save and Continue**.

---

### 3. Konfigurasi Scopes (Izin yang Diminta)

Klik **Add or Remove Scopes**, lalu pilih:

| Scope | Tipe | Tujuan Penggunaan |
|---|---|---|
| `.../auth/userinfo.email` | Non-sensitive | Otentikasi & identifikasi akun pengguna di AI Movie Factory |
| `.../auth/userinfo.profile` | Non-sensitive | Menampilkan nama dan avatar pengguna di studio cockpit |
| `openid` | Non-sensitive | Spesifikasi standar OpenID Connect untuk login aman |
| `https://www.googleapis.com/auth/youtube.upload` | Sensitive | Mengunggah video film hasil render ke kanal YouTube pengguna atas perintah langsung pengguna |

> [!IMPORTANT]
> **Prinsip Least-Privilege:** Jangan mencentang `https://www.googleapis.com/auth/youtube` (akses penuh) atau `https://www.googleapis.com/auth/youtube.readonly` jika tidak dibutuhkan. Hanya minta `youtube.upload`. Hal ini membuat proses persetujuan Google 3x lebih cepat disetujui karena tidak meminta akses data pribadi penonton.

---

### 4. Teks Justifikasi Penggunaan Scope (Copy-Paste ke Google Form)

Saat meminta verifikasi untuk scope sensitif `https://www.googleapis.com/auth/youtube.upload`, Google akan meminta penjelasan tertulis (*Justification / Scope explanation*). Salin teks berikut:

#### Field: *How will your app use the requested scopes?* (Bahasa Inggris Wajib)
```text
AI Movie Factory (https://ai-movie-factory.vercel.app) is an AI-assisted creative studio that empowers independent filmmakers and digital creators to write screenplays, produce visual storyboards, and edit cinematic films.

We request the 'https://www.googleapis.com/auth/youtube.upload' scope solely to allow authenticated users to publish their finalized, user-created video assets directly to their own YouTube channels upon their explicit command from the Publishing Studio dashboard.

Our application strictly adheres to the principle of least privilege:
1. Video uploads occur ONLY when the creator clicks the "Publish to YouTube" button.
2. We do NOT read, edit, or delete existing videos on the user's channel.
3. We do NOT access private playlists, viewer comments, or personal watch history.
4. User access tokens are securely stored in server-side encrypted vaults and are never exposed or sold to third parties.
5. In compliance with the Google API Services User Data Policy, user data is strictly limited to video publication and is never used to train generalized AI models.
```

---

### 5. Persyaratan Video Demonstrasi (YouTube Demo Video)

Google mewajibkan satu tautan video YouTube (*Unlisted Video*, durasi 1–2 menit) yang memperlihatkan alur kerja di layar:

#### Skenario Rekaman Video yang Diminta Google:
1. **Layar Awal:** Tampilkan halaman utama `https://ai-movie-factory.vercel.app` dan bilah URL browser (Google ingin melihat Client ID di address bar).
2. **Login / Otorisasi:** Klik tombol login Google atau sambungkan YouTube. Tampilkan layar persetujuan izin Google (*Consent Screen*) yang memuat nama aplikasi `AI Movie Factory` dan daftar izin yang diminta.
3. **Eksekusi Fitur:** Di dalam studio, buka menu *Publishing Studio* / *Editing & Post-Produksi*, pilih video contoh, lalu tekan tombol publikasi ke YouTube.
4. **Hasil Akhir:** Tunjukkan bahwa video berhasil terunggah ke kanal YouTube pengguna sebagai bukti bahwa izin `youtube.upload` bekerja persis seperti yang dijelaskan.
5. **Unggah ke YouTube:** Setel privasi video ke **Unlisted** (bukan private), lalu tempelkan link URL tersebut ke kotak *YouTube Demo Video URL* di Google Cloud Console.

---

### 6. Mode Operasional Selama Menunggu Verifikasi

| Tahap | Status Akses | Siapa yang Bisa Menggunakan? |
|---|---|---|
| **Sekarang (Testing Mode)** | **Aktif 100%** | Akun pemilik (`islamiahiis243@gmail.com`) dan hingga **100 akun email uji coba** yang didaftarkan di *OAuth Consent Screen ➔ Test Users*. |
| **Fitur Alternatif (Export Package)** | **Aktif 100% untuk Semua Pengguna** | Seluruh pengunjung dan kreator dapat menggunakan tombol **One-Click Download All** (MP4 + Thumbnail + Caption + Subtitle) untuk posting manual tanpa verifikasi OAuth. |
| **Pasca-Persetujuan Google (In Production)** | **Publik Global** | Seluruh pengguna publik di seluruh dunia dapat langsung menghubungkan YouTube tanpa melihat layar peringatan *"Google hasn't verified this app"*. |

---

*Panduan ini disusun untuk mempercepat proses persetujuan Google Trust & Safety AI Movie Factory.*
