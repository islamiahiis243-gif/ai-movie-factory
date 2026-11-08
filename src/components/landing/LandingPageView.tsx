/**
 * LandingPageView.tsx
 * Flagship Cinematic Landing Page for AI Movie Factory (AMF)
 * High-Impact Branding, Neon Hollywood Aesthetics, and Multi-Modal AI Showreel
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  Film,
  Bot,
  Zap,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Layers,
  Video,
  Clapperboard,
  Compass,
  Users,
  ScrollText,
  Sliders,
  DollarSign,
  HelpCircle,
  ChevronDown,
  MonitorPlay,
  Cpu,
  Palette,
  Volume2,
  ExternalLink,
  Flame,
  Award,
  Globe2,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../lib/billingEngine';
import { useAuth } from '../../context/AuthContext';
import { convertPrice } from '../../lib/multilingualAdapters';

interface LandingPageViewProps {
  onEnterStudio: () => void;
  onOpenAuth: () => void;
  onOpenSubscriptionModal?: (packageId: string) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onEnterStudio,
  onOpenAuth,
  onOpenSubscriptionModal,
}) => {
  const { user, profile, currency, language } = useAuth();
  const [selectedDemoTab, setSelectedDemoTab] = useState<'cyberpunk' | 'nusantara' | 'anime' | 'thriller'>('cyberpunk');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const DEMO_PREVIEWS = {
    cyberpunk: {
      genre: 'Sci-Fi Cyberpunk',
      title: 'Jakarta 2088: Hujan Asam & Rekonstruksi Memori',
      logline: 'Di bawah sorotan neon kota futuristik, detektif sibernetik memburu android pemberontak yang menyimpan memori terlarang pendiri kota.',
      camera: '35mm Anamorphic • Low Angle Pedestal • Golden Neon Rim Light',
      audio: 'Ambient Rain + Synthwave Pulse + Sub-bass Drone (Dolby 5.1 Atmos)',
      agents: [
        { name: 'Sutradara AI', task: 'Menentukan ritme naratif noir & tempo dramatis' },
        { name: 'Character Studio', task: 'Mengunci konsistensi implan neon & wajah cyborg' },
        { name: 'DoP AI', task: 'Pencahayaan volumetric cyan & bayangan kontras tinggi' },
        { name: 'Audio Master', task: 'Efek foley tapak kaki basah & desis generator kota' },
      ],
      tag: '4K Ultra HD • 24 FPS Cinema Ready',
    },
    nusantara: {
      genre: 'Historical Epic Drama',
      title: 'Darah Majapahit: Sumpah di Bawah Kabut Bromo',
      logline: 'Panglima setia berhadapan dengan dilema kehormatan saat kerajaan agung diuji oleh perpecahan takhta di puncak kaldera sakral.',
      camera: '50mm Master Prime • Wide Crane Sweep • Golden Hour Sun Flare',
      audio: 'Orkestrasi Gamelan Kolosal + Gemuruh Angin Lembah Kaldera',
      agents: [
        { name: 'World Builder', task: 'Rekonstruksi candi bata merah & desa abad ke-14' },
        { name: 'Screenwriter AI', task: 'Dialog bahasa kawi puitis berbobot kepemimpinan' },
        { name: 'Wardrobe AI', task: 'Kain tenun autentik & zirah tembaga prajurit' },
        { name: 'QC Supervisor', task: 'Memastikan anatomi tombak dan senjata konsisten' },
      ],
      tag: 'Color Graded • DCI-P3 Cinema Color',
    },
    anime: {
      genre: 'Anime Fantasi Kontemporer',
      title: 'Ksatria Bintang: Gerbang Gravitasi Langit',
      logline: 'Gadis muda menemukan relik kuno yang mampu memutarbalikkan gravitasi pulau melayang sebelum badai kehampaan tiba.',
      camera: 'Anime Dynamic Fisheye • Speed Lines • Floating Particle Shimmer',
      audio: 'Piano Melankolis + J-Rock Crescendo + Desir Angin Astral',
      agents: [
        { name: 'Character Studio', task: 'Style cell-shaded modern & ekspresi emosi anime' },
        { name: 'VFX Animator', task: 'Partikel sihir berpendar & distorsi gravitasi' },
        { name: 'Director AI', task: 'Transisi kamera dinamis 360 derajat di udara' },
        { name: 'Foley AI', task: 'Dentang pedang energi & letupan medan magnetik' },
      ],
      tag: 'Hand-drawn Aesthetic • 60 FPS Fluid Motion',
    },
    thriller: {
      genre: 'Psychological Horror Thriller',
      title: 'Malam Satu Suro: Rumah Joglo Lembah Sunyi',
      logline: 'Keluarga pewaris tanah leluhur mendapati bayangan di cermin antik bergerak beberapa detik lebih lambat daripada tubuh aslinya.',
      camera: '24mm Ultra Wide • Slow Creeping Push-In • Chiaroscuro Shadows',
      audio: 'Detak Jantung Lambat + Gesekan Dawai Cello Disonan + Suara Bisikan',
      agents: [
        { name: 'Lighting Master', task: 'Pencahayaan temaram lilin & bayangan dinding jati' },
        { name: 'Script Supervisor', task: 'Tension pacing & ketegangan psikologis berlapis' },
        { name: 'Sound Designer', task: 'Binaural 3D audio bisikan di telinga penonton' },
        { name: 'Continuity AI', task: 'Kunci posisi retakan cermin di setiap sudut shot' },
      ],
      tag: 'Dolby Vision • Suspense Psycho-Acoustics',
    },
  };

  const FAQS = [
    {
      q: 'Apakah film dan video yang saya hasilkan di AI Movie Factory bebas hak cipta komersial?',
      a: 'Ya, 100%! Seluruh aset visual, naskah, karakter, storyboard, dan video hasil render di AI Movie Factory sepenuhnya menjadi milik Anda untuk ditayangkan di YouTube, bioskop, festival film, Netflix, maupun keperluan iklan komersial tanpa royalti tambahan.',
    },
    {
      q: 'Bagaimana cara AI Movie Factory menjaga konsistensi wajah karakter antar adegan?',
      a: 'Kami menyematkan modul Character Studio berteknologi Deep Face & Wardrobe Anchor. Sistem kami memetakan multi-sudut wajah aktor, pakaian, dan prop tubuh ke dalam memori proyek, sehingga aktor Anda tampil konsisten dari shot 1 hingga adegan terakhir.',
    },
    {
      q: 'Bagaimana alur pembayaran paket langganan di Indonesia?',
      a: 'Sistem kami terhubung langsung dengan rekening resmi Bank Mandiri dan dompet digital (GoPay, OVO, DANA) a/n SUMARLIN, serta integrasi Virtual Account BCA & QRIS. Verifikasi diproses secara otomatis via webhook serverless tanpa perlu antrean manual.',
    },
    {
      q: 'Apakah saya bisa mulai tanpa membayar (Gratis)?',
      a: 'Tentu saja! Setiap akun yang baru mendaftar langsung mendapatkan saldo selamat datang 150 Kredit secara cuma-cuma tanpa perlu memasukkan informasi kartu kredit. Anda dapat langsung menguji naskah, world builder, dan membuat proyek pertama Anda.',
    },
    {
      q: 'Apa itu 14 Agen AI Sutradara dan bagaimana mereka bekerja?',
      a: 'Bagaikan kru film Hollywood profesional di dalam satu layar. Kami memiliki agen spesialis mulai dari Sutradara Utama, Penulis Skenario, Penata Kamera (DoP), Desainer Karakter, Penata Suara (Foley & Music), hingga Pengawas Kontinuitas yang bekerja sama menyelesaikan setiap babak film secara otomatis.',
    },
    {
      q: 'Apakah ada batasan resolusi ekspor?',
      a: 'Paket Free dan Creator mendukung resolusi Full HD 1080p. Untuk kreator profesional dan rumah produksi (Paket Pro Studio & Production House), Anda mendapatkan akses ekspor Ultra HD 4K, ProRes Cinema, serta jalur render GPU berprioritas tinggi.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 selection:bg-amber-500/20 selection:text-amber-300 relative overflow-hidden">
      {/* Background Ambient Glows & Cyber Grids */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] bg-gradient-to-b from-indigo-900/20 via-purple-900/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 -left-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none -z-10" />
      <div className="absolute top-60 -right-48 w-96 h-96 bg-amber-500/10 rounded-full blur-[128px] pointer-events-none -z-10" />

      {/* Top Floating Promo Bar */}
      <div className="bg-gradient-to-r from-amber-500/10 via-purple-600/10 to-cyan-500/10 border-b border-slate-800/60 py-2 px-4 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-xs font-medium text-slate-300">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold uppercase tracking-wider text-[10px]">
            <Sparkles className="w-3 h-3" /> Flagship V3.3
          </span>
          <span>
            Studio Produksi Film AI Generasi Baru — Didukung 14 Agen Mandiri & Output Resolusi 4K Sinematik.
          </span>
          <button
            onClick={user ? onEnterStudio : onOpenAuth}
            className="hidden sm:inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer ml-1"
          >
            {user ? 'Buka Studio Cockpit →' : 'Klaim 150 Kredit Gratis →'}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-6 sm:px-8 max-w-7xl mx-auto text-center flex flex-col items-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider shadow-lg shadow-amber-500/5 mb-8">
          <Film className="w-3.5 h-3.5 text-amber-400" />
          <span>The Next Generation Hollywood AI Studio</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </div>

        {/* Master Branding Visual: Official New Logo Display */}
        <div className="relative group mb-8">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-amber-500/20 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <div className="relative rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xl shadow-2xl max-w-xl mx-auto">
            <img
              src="/assets/branding/amf-logo-master.png"
              alt="AI Movie Factory Official Branding"
              className="w-full h-auto object-contain rounded-xl max-h-52 sm:max-h-64 drop-shadow-[0_0_35px_rgba(56,189,248,0.25)]"
            />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15] mb-6">
          Ubah Ide Naskah Menjadi{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
            Film Layar Lebar
          </span>{' '}
          dalam Hitungan Menit.
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed mb-10 font-normal">
          Ekosistem studio produksi film dan serial terintegrasi berbasis kecerdasan buatan terlengkap.
          Rancang semesta cerita, kunci konsistensi aktor, rancang storyboard sinematik, hingga render video 4K —
          seluruhnya diorkestrasikan oleh <strong>14 agen AI profesional</strong> di kendali Anda.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center mb-14">
          <button
            onClick={user ? onEnterStudio : onOpenAuth}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-3 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-slate-950" />
            <span>{user ? 'Masuk ke Studio Cockpit' : 'Mulai Produksi Sekarang (Gratis)'}</span>
            <ArrowRight className="w-5 h-5 text-slate-950" />
          </button>

          <a
            href="#interactive-demo"
            className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 text-white font-semibold text-base backdrop-blur-md flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
            <span>Jelajahi Demo & Alur Kerja</span>
          </a>
        </div>

        {/* Trust Badges & Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl pt-6 border-t border-slate-800/70 text-left">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 mb-1">14 Agen</div>
            <div className="text-xs text-slate-400">Kru Sutradara & Kru AI Mandiri</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 mb-1">10 Modul</div>
            <div className="text-xs text-slate-400">Tahap Produksi Sinematik E2E</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mb-1">4K UHD</div>
            <div className="text-xs text-slate-400">Format Ekspor Layar Bioskop</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mb-1">150 Kredit</div>
            <div className="text-xs text-slate-400">Modal Awal Gratis Tanpa Syarat</div>
          </div>
        </div>
      </section>

      {/* Interactive Reel & Studio Simulator Section */}
      <section id="interactive-demo" className="py-20 px-6 sm:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <MonitorPlay className="w-3.5 h-3.5" />
            Interactive Studio Simulator
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Lihat Bagaimana 14 Agen AI Memproduksi Setiap Shot
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Pilih genre di bawah ini untuk melihat bagaimana naskah, pencahayaan kamera, konsistensi aktor, dan desain suara dieksekusi secara instan.
          </p>
        </div>

        {/* Genre Selector Tabs */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap mb-8">
          {(['cyberpunk', 'nusantara', 'anime', 'thriller'] as const).map((key) => {
            const data = DEMO_PREVIEWS[key];
            const isSelected = selectedDemoTab === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedDemoTab(key)}
                className={`px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-amber-500/20 text-white border border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Film className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{data.genre}</span>
              </button>
            );
          })}
        </div>

        {/* Live Simulator Monitor Canvas */}
        <div className="rounded-2xl border border-slate-800 bg-[#0B0F17] shadow-2xl overflow-hidden">
          {/* Virtual Top Bar */}
          <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-xs font-mono text-slate-400 border-l border-slate-800 pl-3">
                AMF Studio Live Pipeline • Scene #01 Production Monitor
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-mono text-emerald-400 uppercase font-semibold">
                Autonomous AI Crew Active
              </span>
            </div>
          </div>

          {/* Simulator Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 p-6 sm:p-8 gap-8">
            {/* Left: Cinematic Preview & Logline */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                  <Award className="w-4 h-4" />
                  <span>{DEMO_PREVIEWS[selectedDemoTab].genre}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{DEMO_PREVIEWS[selectedDemoTab].tag}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  {DEMO_PREVIEWS[selectedDemoTab].title}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                  &ldquo;{DEMO_PREVIEWS[selectedDemoTab].logline}&rdquo;
                </p>

                {/* Technical Direction Box */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                    <Video className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400">Komposisi Kamera & Lensa:</span>
                      <div className="text-slate-200 mt-0.5">{DEMO_PREVIEWS[selectedDemoTab].camera}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                    <Volume2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400">Tata Suara & Soundscapes:</span>
                      <div className="text-slate-200 mt-0.5">{DEMO_PREVIEWS[selectedDemoTab].audio}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Call */}
              <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Siap untuk memproduksi adegan Anda sendiri?
                </span>
                <button
                  onClick={user ? onEnterStudio : onOpenAuth}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Klon Template Ini</span>
                </button>
              </div>
            </div>

            {/* Right: Active AI Agent Orchestrator */}
            <div className="lg:col-span-5 bg-slate-950/80 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Bot className="w-4 h-4 text-cyan-400" />
                    <span>Orkestrasi Agen Terhubung</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    4/14 Kru Beroperasi
                  </span>
                </div>

                <div className="space-y-3">
                  {DEMO_PREVIEWS[selectedDemoTab].agents.map((agent, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 font-mono text-xs font-bold">
                        0{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>{agent.name}</span>
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            SINKRON
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {agent.task}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                <span>Latency: 180ms</span>
                <span>Consistency Guarantee: 99.4%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10 Production Modules Ecosystem */}
      <section className="py-20 px-6 sm:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Layers className="w-3.5 h-3.5" />
            10 Tahapan Studio Produksi Terpadu
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Seluruh Pipeline Hollywood dalam Satu Layar
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Tidak ada lagi aplikasi terpisah-pisah. AI Movie Factory menggabungkan 10 instrumen produksi dari konsepsi naskah hingga pascaproduksi akhir.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Cerita & Naskah Standar',
              desc: 'Tulis skenario 3-babak standar industri dengan format screenplay otomatis, deskripsi adegan mendalam, dan penulisan dialog emosional.',
              icon: ScrollText,
              color: 'text-amber-400',
              bg: 'bg-amber-500/10',
              border: 'border-amber-500/30',
            },
            {
              title: 'World Builder & Konsistensi Universe',
              desc: 'Bangun semesta cerita, biome, arsitektur, iklim, dan tata artistik lingkungan 3D/AI yang konsisten dari adegan pertama hingga terakhir.',
              icon: Compass,
              color: 'text-cyan-400',
              bg: 'bg-cyan-500/10',
              border: 'border-cyan-500/30',
            },
            {
              title: 'Character Studio (Face Lock)',
              desc: 'Desain aktor AI dengan penentuan multi-angle, kostum, prop, dan kunci wajah (deep face consistency) agar tidak berubah antar adegan.',
              icon: Users,
              color: 'text-purple-400',
              bg: 'bg-purple-500/10',
              border: 'border-purple-500/30',
            },
            {
              title: 'Storyboard Sinematik Visual',
              desc: 'Petakan shot-by-shot dengan arahan sinematografer: focal length (35mm/50mm), pergerakan kamera (pan/crane/dolly), dan lighting angle.',
              icon: Clapperboard,
              color: 'text-rose-400',
              bg: 'bg-rose-500/10',
              border: 'border-rose-500/30',
            },
            {
              title: 'Orkestrasi 14 Agen AI Mandiri',
              desc: 'Pekerjakan kru virtual yang terdiri dari Sutradara, Sinematografer, Penata Suara, Desainer Kostum, dan Pengawas Kontinuitas mandiri.',
              icon: Bot,
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10',
              border: 'border-emerald-500/30',
            },
            {
              title: 'Media Studio Multi-Modal',
              desc: 'Generate gambar still visual, video gerak tinggi, musik orkestra orisinal, efek suara foley spatial, dan dubbing suara natural AI.',
              icon: Sparkles,
              color: 'text-indigo-400',
              bg: 'bg-indigo-500/10',
              border: 'border-indigo-500/30',
            },
            {
              title: 'Pipeline Produksi Paralel',
              desc: 'Lacak antrean render multi-shot secara paralel dengan status real-time, estimasi waktu GPU, dan notifikasi otomatis saat selesai.',
              icon: Sliders,
              color: 'text-blue-400',
              bg: 'bg-blue-500/10',
              border: 'border-blue-500/30',
            },
            {
              title: 'QC & Pengawas Kontinuitas',
              desc: 'Audit otomatis mendeteksi inkonsistensi kostum, lighting, atau anatomi sebelum render final diekspor ke format tayang.',
              icon: ShieldCheck,
              color: 'text-teal-400',
              bg: 'bg-teal-500/10',
              border: 'border-teal-500/30',
            },
            {
              title: 'Editing & Pascaproduksi Multitrack',
              desc: 'Susun urutan klip di timeline multitrack dengan transisi sinematik, grading warna bioskop (LUT), dan sinkronisasi takarir subtitle.',
              icon: Video,
              color: 'text-yellow-400',
              bg: 'bg-yellow-500/10',
              border: 'border-yellow-500/30',
            },
          ].map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all hover:bg-slate-900/70 group"
              >
                <div className={`w-11 h-11 rounded-xl ${mod.bg} ${mod.border} border flex items-center justify-center ${mod.color} mb-4 group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{mod.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{mod.desc}</p>
              </div>
            );
          })}

          {/* 10th Card: Marketplace */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/30 hover:border-amber-500/50 transition-all group">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 mb-4 group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Pasar Template & Cetak Biru Film</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
              Klon proyek film siap pakai yang sudah dirancang oleh sineas profesional. Langsung mulai dari template cyberpunk, horor, fantasi, atau komedi dalam 1 klik.
            </p>
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
              Jelajahi Template Siap Pakai →
            </span>
          </div>
        </div>
      </section>

      {/* Comparison: Traditional vs AI Movie Factory */}
      <section className="py-20 px-6 sm:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            Revolusi Biaya & Waktu
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Mengapa Sineas Beralih ke AI Movie Factory?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Bandingkan alur produksi konvensional yang menguras modal dengan kekuatan 14 agen AI modern.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Traditional Production */}
          <div className="rounded-2xl p-6 sm:p-8 bg-slate-950/60 border border-rose-950/40">
            <div className="text-rose-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
              Cara Konvensional (Lama)
            </div>
            <h3 className="text-xl font-bold text-slate-300 mb-6">
              Studio & Rumah Produksi Tradisional
            </h3>
            <ul className="space-y-4 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>Biaya ratusan juta hingga miliaran rupiah untuk sewa kamera, lokasi, dan kru.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>Waktu produksi memakan waktu 3 sampai 8 bulan per episode atau film pendek.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>Reshoot sangat mahal jika ada adegan salah atau pemeran tidak cocok.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>Terbatas oleh cuaca, izin lokasi syuting, dan jadwal aktor fisik.</span>
              </li>
            </ul>
          </div>

          {/* AI Movie Factory */}
          <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-amber-500/10 to-purple-500/10 border border-amber-500/40 relative shadow-xl shadow-amber-500/5">
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
              Solusi AMF
            </div>
            <div className="text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
              Modern AI Movie Studio
            </div>
            <h3 className="text-xl font-bold text-white mb-6">
              AI Movie Factory (AMF)
            </h3>
            <ul className="space-y-4 text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Mulai dari <strong>Rp 0 (150 Kredit Gratis)</strong>, hemat 95% anggaran produksi.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Dari ide kasar menjadi storyboard dan shot video selesai dalam <strong>hitungan menit</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>1-klik regenerasi prompt untuk mengubah angle kamera, cuaca, atau emosi adegan.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Konsistensi aktor terjamin dengan sistem <strong>Character Studio Deep-Lock</strong>.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing Showcase with Indonesian Gateway Badges */}
      <section className="py-20 px-6 sm:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <DollarSign className="w-3.5 h-3.5" />
            Investasi Transparan
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Pilih Paket Studio Sesuai Skala Produksi Anda
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Semua paket mendukung pembayaran instan via Bank Mandiri, BCA Virtual Account, GoPay, OVO, DANA, dan QRIS.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SUBSCRIPTION_PLANS.map((pkg) => {
            const isPopular = pkg.id === 'pro_studio' || pkg.recommended;
            return (
              <div
                key={pkg.id}
                className={`rounded-2xl p-6 flex flex-col justify-between transition-all relative ${
                  isPopular
                    ? 'bg-gradient-to-b from-amber-500/15 via-purple-500/10 to-slate-900/90 border-2 border-amber-500/70 shadow-2xl shadow-amber-500/10 scale-105 z-10'
                    : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-widest shadow-md">
                    Paling Direkomendasikan
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 min-h-8 mb-4">{pkg.tagline}</p>

                  <div className="mb-6 pb-6 border-b border-slate-800">
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">
                      {pkg.monthlyPriceIdr === 0 ? 'Gratis' : convertPrice(pkg.monthlyPriceIdr, currency).formatted}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {pkg.monthlyPriceIdr === 0 ? 'Selamanya aktif' : 'per bulan'}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Termasuk:
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span><strong>{pkg.monthlyCredits.toLocaleString('id-ID')} Kredit</strong> per bulan</span>
                    </div>
                    {pkg.features.map((feat, fi) => (
                      <div key={fi} className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!user) {
                      onOpenAuth();
                    } else if (onOpenSubscriptionModal) {
                      onOpenSubscriptionModal(pkg.id);
                    } else {
                      onEnterStudio();
                    }
                  }}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isPopular
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  {pkg.monthlyPriceIdr === 0 ? 'Mulai Gratis Sekarang' : `Pilih Paket ${pkg.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Payment Channels Grid */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-950/80 border border-slate-800 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <div className="text-xs font-bold text-white flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Saluran Pembayaran Resmi Terverifikasi</span>
            </div>
            <div className="text-xs text-slate-400">
              Rekening Resmi a/n <strong>SUMARLIN</strong> • Transaksi aman & otomatis dikreditkan seketika.
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-300">
              Bank Mandiri
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-300">
              BCA VA
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-300">
              GoPay
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-300">
              OVO / DANA
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-semibold text-slate-300">
              QRIS
            </span>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 sm:px-8 max-w-4xl mx-auto border-t border-slate-800/80">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            Tanya Jawab (FAQ)
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pertanyaan yang Sering Diajukan
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = expandedFaq === index;
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setExpandedFaq(isOpen ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-white hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Grand Call-to-Action */}
      <section className="py-20 px-6 sm:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="rounded-3xl p-8 sm:p-14 bg-gradient-to-r from-cyan-950/40 via-purple-950/40 to-amber-950/40 border border-amber-500/30 text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
              Mulai Produksi Film Pertama Anda Hari Ini.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mb-8 max-w-2xl mx-auto">
              Daftar gratis sekarang dan langsung dapatkan <strong>150 Kredit Starter</strong> untuk mengeksplorasi seluruh modul studio AI kami.
            </p>
            <button
              onClick={user ? onEnterStudio : onOpenAuth}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-base shadow-xl shadow-amber-500/30 inline-flex items-center gap-3 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-5 h-5" />
              <span>{user ? 'Buka Studio Cockpit Sekarang' : 'Daftar Gratis & Dapatkan 150 Kredit'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#05070A] py-12 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <img
              src="/assets/branding/amf-emblem.png"
              alt="AI Movie Factory Icon"
              className="w-8 h-8 object-contain rounded-md"
            />
            <span className="font-bold text-white text-sm tracking-wide">
              AI MOVIE FACTORY (AMF)
            </span>
          </div>
          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} AI Movie Factory. Hak Cipta Dilindungi Undang-Undang. Rekening Resmi a/n SUMARLIN.
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <button onClick={user ? onEnterStudio : onOpenAuth} className="hover:text-white cursor-pointer">
              {user ? 'Studio Cockpit' : 'Masuk Studio'}
            </button>
            <a href="#interactive-demo" className="hover:text-white">
              Fitur Demo
            </a>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Sistem Operasional (Live)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
