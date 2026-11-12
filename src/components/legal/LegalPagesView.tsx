import React, { useState } from 'react';
import { Shield, FileText, ArrowLeft, Globe, CheckCircle2, Lock, ExternalLink, Mail } from 'lucide-react';
import amfEmblem from '../../assets/branding/amf-emblem.png';

interface LegalPagesViewProps {
  initialTab?: 'privacy' | 'terms';
  onBack: () => void;
}

export const LegalPagesView: React.FC<LegalPagesViewProps> = ({
  initialTab = 'privacy',
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);
  const [lang, setLang] = useState<'en' | 'id'>('en');

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-200 antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#07090E]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/60 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'id' ? 'Kembali' : 'Back to Home'}</span>
            </button>
            <div className="flex items-center gap-2.5">
              <img src={amfEmblem} alt="AI Movie Factory" className="w-7 h-7 object-contain rounded-md" />
              <span className="font-bold text-white text-sm tracking-wide">AI MOVIE FACTORY</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  lang === 'en' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('id')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  lang === 'id' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                Indonesia
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-8">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{lang === 'id' ? 'Kebijakan Privasi (Privacy Policy)' : 'Privacy Policy'}</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{lang === 'id' ? 'Ketentuan Layanan (Terms of Service)' : 'Terms of Service'}</span>
          </button>
        </div>

        {/* Content Body */}
        {activeTab === 'privacy' ? (
          <article className="space-y-8 text-sm leading-relaxed text-slate-300">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold mb-3">
                {lang === 'id' ? 'Terakhir Diperbarui: 12 November 2026' : 'Last Updated: November 12, 2026'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {lang === 'id' ? 'Kebijakan Privasi AI Movie Factory' : 'Privacy Policy for AI Movie Factory'}
              </h1>
              <p className="mt-2 text-slate-400">
                {lang === 'id'
                  ? 'Kebijakan Privasi ini menjelaskan bagaimana AI Movie Factory mengumpulkan, menggunakan, melindungi, dan mengelola informasi Anda, termasuk saat menggunakan Google OAuth dan YouTube Data API.'
                  : 'This Privacy Policy explains how AI Movie Factory ("AMF", "we", "us", or "our") collects, uses, protects, and handles your information, including your interactions with Google OAuth and YouTube Data APIs.'}
              </p>
            </div>

            {/* MANDATORY GOOGLE LIMITED USE DISCLOSURE BOX */}
            <div className="rounded-2xl p-5 bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-500/40 shadow-xl">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Google API Services User Data Policy Compliance</span>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  </h3>
                  <p className="mt-1.5 text-xs text-blue-200/90 leading-relaxed font-sans">
                    <strong>AI Movie Factory&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{' '}
                    <a
                      href="https://developers.google.com/terms/api-services-user-data-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-300 hover:text-white"
                    >
                      Google API Services User Data Policy
                    </a>
                    , including the Limited Use requirements.</strong>
                  </p>
                </div>
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                1. {lang === 'id' ? 'Identitas Pengelola Data' : 'Identity of the Data Controller'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'AI Movie Factory adalah platform produksi film berbasis kecerdasan buatan dan ekosistem distribusi kreator. Layanan ini dapat diakses secara publik melalui tautan https://ai-movie-factory.vercel.app.'
                  : 'AI Movie Factory is an AI-assisted film production studio and creator business operating system accessible via https://ai-movie-factory.vercel.app.'}
              </p>
              <p>
                {lang === 'id'
                  ? 'Untuk pertanyaan terkait privasi data dan perlindungan informasi pribadi, silakan hubungi kontak resmi kami:'
                  : 'For any privacy-related inquiries or data protection requests, you may contact our official data representative at:'}
              </p>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 font-mono text-xs text-amber-400 flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                <span>Contact Email: islamiahiis243@gmail.com</span>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                2. {lang === 'id' ? 'Informasi yang Kami Kumpulkan' : 'Information We Collect'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Kami hanya mengumpulkan informasi yang esensial untuk mengoperasikan fungsi studio dan distribusi konten Anda:'
                  : 'We strictly collect only the minimal information required to provide you with seamless studio and publishing capabilities:'}
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
                <li>
                  <strong>Google User Profile Data:</strong>{' '}
                  {lang === 'id'
                    ? 'Ketika Anda memilih masuk menggunakan Google Sign-In, kami menerima nama lengkap, alamat email, dan URL foto profil Anda untuk membuat dan memverifikasi akun Anda di Supabase Auth.'
                    : 'When you sign in using Google OAuth, we receive your name, email address, and profile picture URL solely to authenticate your identity and provision your user account in Supabase Auth.'}
                </li>
                <li>
                  <strong>YouTube API Scopes:</strong>{' '}
                  {lang === 'id'
                    ? 'Jika Anda menghubungkan saluran YouTube untuk distribusi langsung (Direct Publishing), sistem kami meminta izin akses terotentikasi (https://www.googleapis.com/auth/youtube.upload) untuk mengunggah video yang Anda setujui.'
                    : 'When you explicitly connect your YouTube channel for direct publishing, our system requests the authenticated scope (https://www.googleapis.com/auth/youtube.upload) exclusively to upload your approved video files upon your direct request.'}
                </li>
                <li>
                  <strong>Film Production Assets:</strong>{' '}
                  {lang === 'id'
                    ? 'Naskah cerita, deskripsi karakter, storyboard, gambar keyframe, dan file video yang Anda buat disimpan dengan aman di database terenkripsi kami.'
                    : 'Screenplays, character profiles, storyboards, keyframe stills, and generated film media that you create within the studio workspace.'}
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                3. {lang === 'id' ? 'Bagaimana Kami Menggunakan Informasi Anda' : 'How We Use Your Information'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Kami mematuhi prinsip pembatasan tujuan ketat. Data Anda hanya digunakan untuk:'
                  : 'We adhere to strict purpose-limitation principles. Your information is used solely to:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-xs">
                    {lang === 'id' ? 'Memverifikasi identitas Anda saat login dan menjaga keamanan sesi akun.' : 'Authenticate your identity upon sign-in and protect your user session.'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-xs">
                    {lang === 'id' ? 'Mengunggah video film Anda ke kanal YouTube Anda saat Anda menekan tombol publikasi.' : 'Upload your rendered film files to your YouTube channel when you trigger publication.'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-xs">
                    {lang === 'id' ? 'Menyimpan progres proyek naskah, storyboard, dan timeline video secara aman.' : 'Securely persist your projects, scripts, storyboards, and editing timelines.'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-xs">
                    {lang === 'id' ? 'Menampilkan analitik performa video tayangan dan perhitungan keuntungan kreator.' : 'Display video audience performance analytics and creator net revenue metrics.'}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                4. {lang === 'id' ? 'Komitmen Kami: Apa yang TIDAK Kami Lakukan' : 'What We Strictly DO NOT Do With Your Data'}
              </h2>
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-200/90 text-xs space-y-2">
                <p>
                  <strong>• NO DATA SELLING:</strong> We do NOT sell, rent, or monetize your personal data or Google account information to any third parties.
                </p>
                <p>
                  <strong>• NO THIRD-PARTY AD TARGETING:</strong> We do NOT transfer Google user data or YouTube tokens to advertising brokers or data brokers.
                </p>
                <p>
                  <strong>• NO GENERAL AI TRAINING:</strong> We do NOT use your private scripts, YouTube videos, or Google account metadata to train general public generative AI models without your express consent.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                5. {lang === 'id' ? 'Keamanan Data & Penyimpanan' : 'Data Storage & Security Safeguards'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Seluruh data pengguna disimpan pada infrastruktur PostgreSQL Supabase terkelola dengan Row-Level Security (RLS) aktif penuh. Seluruh komunikasi jaringan diamankan melalui enkripsi TLS 1.3 / HTTPS. Token kredensial disimpan dalam server-side secure vault dan tidak pernah diekspos ke bundel JavaScript klien.'
                  : 'All user records are maintained on enterprise PostgreSQL instances managed via Supabase with strict Row-Level Security (RLS) policies. Network transfers are secured end-to-end via TLS 1.3 / HTTPS encryption. Client ID credentials and OAuth secrets are quarantined strictly inside serverless runtime environments.'}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                6. {lang === 'id' ? 'Hak Anda: Pencabutan Akses & Penghapusan Data' : 'Your Rights: Access Revocation & Data Deletion'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Anda memiliki kendali penuh atas akun dan izin data Anda:'
                  : 'You retain full control over your connected accounts and personal data:'}
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
                <li>
                  <strong>{lang === 'id' ? 'Mencabut Izin Google / YouTube:' : 'Revoking Google / YouTube Permissions:'}</strong>{' '}
                  {lang === 'id'
                    ? 'Anda dapat mencabut izin akses AI Movie Factory kapan saja melalui portal Google Security di '
                    : 'You can instantly revoke AI Movie Factory\'s access at any time via Google Account Security settings at '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-amber-400 hover:text-white"
                  >
                    https://myaccount.google.com/permissions
                  </a>.
                </li>
                <li>
                  <strong>{lang === 'id' ? 'Permintaan Penghapusan Akun Total:' : 'Requesting Complete Account Deletion:'}</strong>{' '}
                  {lang === 'id'
                    ? 'Anda dapat meminta penghapusan permanen akun beserta seluruh naskah dan aset dengan mengirimkan permohonan ke islamiahiis243@gmail.com. Data akan dihapus secara tuntas dalam waktu 7 hari kerja.'
                    : 'You may request permanent deletion of your account, projects, and metadata by emailing islamiahiis243@gmail.com. All records will be expunged within 7 business days.'}
                </li>
              </ul>
            </section>
          </article>
        ) : (
          <article className="space-y-8 text-sm leading-relaxed text-slate-300">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-semibold mb-3">
                {lang === 'id' ? 'Terakhir Diperbarui: 12 November 2026' : 'Last Updated: November 12, 2026'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {lang === 'id' ? 'Ketentuan Layanan AI Movie Factory' : 'Terms of Service for AI Movie Factory'}
              </h1>
              <p className="mt-2 text-slate-400">
                {lang === 'id'
                  ? 'Harap baca Ketentuan Layanan ini secara saksama sebelum menggunakan platform studio AI Movie Factory.'
                  : 'Please read these Terms of Service carefully before utilizing the AI Movie Factory studio platform.'}
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                1. {lang === 'id' ? 'Penerimaan Ketentuan' : 'Acceptance of Terms'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Dengan mengakses atau menggunakan AI Movie Factory (https://ai-movie-factory.vercel.app), Anda menyetujui untuk terikat oleh Ketentuan Layanan ini dan Kebijakan Privasi kami. Jika Anda tidak menyetujui ketentuan ini, Anda tidak diperkenankan menggunakan layanan kami.'
                  : 'By accessing or utilizing AI Movie Factory (https://ai-movie-factory.vercel.app), you confirm your binding agreement to these Terms of Service and our Privacy Policy. If you disagree with any portion of these terms, you must discontinue using our services immediately.'}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                2. {lang === 'id' ? 'Deskripsi Layanan' : 'Description of Services'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'AI Movie Factory menyediakan lingkungan kerja digital untuk memproduksi film berbantu AI: penyusunan naskah, perancangan konsistensi karakter, pembuatan storyboard, rendering visual gambar & video, penyuntingan timeline NLE, serta distribusi ke platform media sosial (seperti YouTube) dan portal OTT mandiri.'
                  : 'AI Movie Factory provides a cloud-native creative operating system for AI-assisted film production: script development, character consistency management, storyboard structuring, visual asset generation, non-linear video editing, and multi-channel publishing to third-party networks (including YouTube) and OTT storefronts.'}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                3. {lang === 'id' ? 'Kedaulatan & Kepemilikan Karya Kreator' : 'Creator Sovereignty & Content Ownership'}
              </h2>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <p>
                  <strong>• {lang === 'id' ? 'Kepemilikan Penuh Pengguna:' : 'Full Creator Ownership:'}</strong>{' '}
                  {lang === 'id'
                    ? 'Anda memegang kepemilikan hak cipta atas seluruh alur cerita, naskah dialog, shot list, dan hasil film final yang Anda susun di AI Movie Factory, dengan tetap tunduk pada ketentuan layanan masing-masing model generative AI yang digunakan.'
                    : 'You retain full intellectual property ownership over your screenplays, dialogues, shot arrangements, and finalized rendered films created through AI Movie Factory, subject to the applicable licensing terms of the underlying generative model providers.'}
                </p>
                <p>
                  <strong>• {lang === 'id' ? 'Kedaulatan Data Penonton:' : 'Audience Data Sovereignty:'}</strong>{' '}
                  {lang === 'id'
                    ? 'Pada platform streaming mandiri (OTT), data pelanggan dan penonton adalah aset milik kreator seutuhnya.'
                    : 'On independent OTT channels, your subscriber lists and audience relationship records remain your exclusive asset.'}
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                4. {lang === 'id' ? 'Kebijakan Penggunaan yang Diperbolehkan' : 'Acceptable Use Policy'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Pengguna dilarang keras menggunakan AI Movie Factory untuk menghasilkan, mengedit, atau menyebarkan konten yang:'
                  : 'Users are strictly prohibited from utilizing AI Movie Factory to generate, manipulate, or distribute content that:'}
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300 ml-2 text-xs">
                <li>{lang === 'id' ? 'Melanggar hak cipta, merek dagang, atau hak kekayaan intelektual pihak lain tanpa izin sah.' : 'Infringes third-party copyrights, trademarks, or proprietary rights.'}</li>
                <li>{lang === 'id' ? 'Mengandung pornografi anak, eksploitasi kekerasan ekstrem, atau ajaran kebencian ilegal.' : 'Involves child exploitation, extreme gratuitous violence, or unlawful hate speech.'}</li>
                <li>{lang === 'id' ? 'Membuat deepfake yang bertujuan memfitnah, menipu, atau memanipulasi identitas orang nyata tanpa persetujuan.' : 'Creates malicious deceptive deepfakes aimed at defaming or impersonating individuals without authorization.'}</li>
                <li>{lang === 'id' ? 'Melakukan serangan siber, rekayasa balik (reverse engineering), atau manipulasi sistem kredit.' : 'Conducts denial-of-service attacks, reverse engineering, or payment tampering.'}</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                5. {lang === 'id' ? 'Integrasi Pihak Ketiga (Google & YouTube)' : 'Third-Party Integrations (Google & YouTube)'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Fitur pengunggahan otomatis ke YouTube tunduk pada Persyaratan Layanan YouTube (https://www.youtube.com/t/terms) dan Kebijakan Privasi Google. Dengan menggunakan fitur ini, Anda setuju untuk mematuhi pedoman komunitas YouTube.'
                  : 'Our direct publishing features interact with YouTube API Services governed by the YouTube Terms of Service (https://www.youtube.com/t/terms) and Google Privacy Policy. By utilizing these direct distribution features, you agree to be bound by YouTube Community Guidelines.'}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                6. {lang === 'id' ? 'Kontak & Bantuan Hukum' : 'Contact & Inquiries'}
              </h2>
              <p>
                {lang === 'id'
                  ? 'Untuk pertanyaan seputar ketentuan ini atau pelaporan pelanggaran, silakan hubungi tim kami:'
                  : 'For legal notices or questions regarding these Terms, please contact our administrative desk:'}
              </p>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 font-mono text-xs text-amber-400">
                Email: islamiahiis243@gmail.com | AI Movie Factory (https://ai-movie-factory.vercel.app)
              </div>
            </section>
          </article>
        )}
      </main>
    </div>
  );
};
