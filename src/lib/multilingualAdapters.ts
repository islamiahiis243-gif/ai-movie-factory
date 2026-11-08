/**
 * Multilingual & Global Expansion Adapters - AI Movie Factory (SSOT Section 42)
 * Handles international language translation with cultural honorific preservation,
 * regional currency exchange auto-detection, native TTS vocal models,
 * and community template marketplace seed data.
 */

import {
  CurrencyCode,
  LanguageCode,
  MarketplaceCharacterPack,
  MarketplaceTemplate,
  MultilingualScriptTranslation,
  SceneItem,
  ScriptBlock
} from '../types/database';

export interface SupportedLanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  defaultCurrency: CurrencyCode;
  cinematicTone: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguageInfo[] = [
  {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    defaultCurrency: 'IDR',
    cinematicTone: 'Sinema Nusantara & Narasi Epik Kolosal'
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English (US/UK)',
    flag: '🇬🇧',
    defaultCurrency: 'USD',
    cinematicTone: 'Hollywood High-Concept & Prestige Television'
  },
  {
    code: 'zh',
    name: 'Mandarin Chinese',
    nativeName: '简体中文',
    flag: '🇨🇳',
    defaultCurrency: 'CNY',
    cinematicTone: 'Xianxia / Wuxia Classical Cultivation Lore & Poetic Couplets'
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    defaultCurrency: 'JPY',
    cinematicTone: 'Anime Drama, J-Horror & Dramatic Pacing with Honorifics'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    defaultCurrency: 'EUR',
    cinematicTone: 'High Emotional Stakes, Magical Realism & Expressive Dialogue'
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    defaultCurrency: 'USD',
    cinematicTone: 'K-Drama Narrative Arcs, Subtle Dramatic Tension & Social Hierarchy'
  },
  {
    code: 'th',
    name: 'Thai',
    nativeName: 'ไทย',
    flag: '🇹🇭',
    defaultCurrency: 'USD',
    cinematicTone: 'Supernatural Folklore & Kinetic Martial Choreography'
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    defaultCurrency: 'USD',
    cinematicTone: 'Historical Grand Epics & Ornate Poetic Dialogue'
  }
];

export const REGIONAL_CURRENCIES: Record<
  CurrencyCode,
  { symbol: string; name: string; rateToUsd: number }
> = {
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', rateToUsd: 16000 },
  USD: { symbol: '$', name: 'US Dollar', rateToUsd: 1 },
  CNY: { symbol: '¥', name: 'Chinese Yuan', rateToUsd: 7.25 },
  JPY: { symbol: '¥', name: 'Japanese Yen', rateToUsd: 152 },
  EUR: { symbol: '€', name: 'Euro', rateToUsd: 0.92 }
};

export function convertPrice(
  amountIdr: number,
  targetCurrency: CurrencyCode
): { formatted: string; amount: number } {
  const usd = amountIdr / REGIONAL_CURRENCIES.IDR.rateToUsd;
  const target = REGIONAL_CURRENCIES[targetCurrency];
  const converted = usd * target.rateToUsd;

  let formatted = '';
  if (targetCurrency === 'IDR') {
    formatted = `Rp${Math.round(converted).toLocaleString('id-ID')}`;
  } else if (targetCurrency === 'USD') {
    formatted = `$${converted.toFixed(2)}`;
  } else if (targetCurrency === 'EUR') {
    formatted = `€${converted.toFixed(2)}`;
  } else if (targetCurrency === 'CNY') {
    formatted = `¥${Math.round(converted).toLocaleString('zh-CN')}`;
  } else if (targetCurrency === 'JPY') {
    formatted = `¥${Math.round(converted).toLocaleString('ja-JP')}`;
  }

  return { formatted, amount: Math.round(converted) };
}

/**
 * Translates a screenplay scene into target language with culturally preserved honorifics
 */
export function translateScriptScene(
  sceneTitle: string,
  slugline: string,
  blocks: ScriptBlock[],
  targetLang: 'zh' | 'ja' | 'ko' | 'th' | 'ar' | 'es' | 'en' | 'id'
): MultilingualScriptTranslation {
  const langMeta: Record<string, { name: string; titleTrans: string; slugTrans: string }> = {
    zh: {
      name: 'Mandarin Chinese (简体中文)',
      titleTrans: '第一幕：苍龙之誓',
      slugTrans: '内景. 苍龙禁阁 - 夜晚'
    },
    ja: {
      name: 'Japanese (日本語)',
      titleTrans: '第一幕：青龍の誓い',
      slugTrans: '室内. 蒼竜の聖域 - 夜'
    },
    ko: {
      name: 'Korean (한국어)',
      titleTrans: '제1막: 청룡의 맹세',
      slugTrans: '실내. 청룡의 성역 - 밤'
    },
    es: {
      name: 'Spanish (Español)',
      titleTrans: 'Acto I: El Juramento del Dragón Azul',
      slugTrans: 'INT. SANTUARIO DEL DRAGÓN AZUL - NOCHE'
    },
    th: {
      name: 'Thai (ไทย)',
      titleTrans: 'องก์ที่ 1: คำสาบานแห่งมังกรคราม',
      slugTrans: 'ภายใน. ศาลเจ้ามังกรคราม - กลางคืน'
    },
    ar: {
      name: 'Arabic (العربية)',
      titleTrans: 'الفصل الأول: قسم التنين الأزرق',
      slugTrans: 'داخلي. ملاذ التنين الأزرق - ليل'
    },
    en: {
      name: 'English (US)',
      titleTrans: 'Act I: The Azure Dragon Oath',
      slugTrans: 'INT. AZURE DRAGON SANCTUARY - NIGHT'
    },
    id: {
      name: 'Bahasa Indonesia',
      titleTrans: sceneTitle,
      slugTrans: slugline
    }
  };

  const meta = langMeta[targetLang] || langMeta.en;

  // Translation mappings for demo blocks
  const translatedBlocks = blocks.map(b => {
    let text = b.text;
    let notes: string | undefined = undefined;

    if (b.type === 'dialogue') {
      if (targetLang === 'zh') {
        text = '青龙宗绝不向血煞山的霸道屈服！九星龙吟剑定会为宗门讨回公道！';
        notes = 'Preserved classical Wuxia idiom (宗门, 霸道) with solemn heroic cadence.';
      } else if (targetLang === 'ja') {
        text = '青龍宗は決して血の山の専横に屈しない！我が九星龍剣が貴様の思い上がりを砕く！';
        notes = 'Applied samurai/shonen dramatic diction with formal defiance particles.';
      } else if (targetLang === 'ko') {
        text = '청룡종은 결코 피의 산의 폭정에 굴복하지 않을 것이다! 나의 구성용검이 진실을 증명하리라!';
        notes = 'Utilized martial arts novel (무협) elevated court speech.';
      } else if (targetLang === 'es') {
        text = '¡La Secta del Dragón Azul jamás se doblegará ante la tiranía de la Montaña Sangrienta!';
        notes = 'Adapted with impassioned dramatic emphasis and castilian exclamation rhythm.';
      } else if (targetLang === 'en') {
        text = 'The Azure Dragon Sect will never bow to the tyranny of Blood Mountain!';
        notes = 'Standard cinematic fantasy screenplay phrasing.';
      }
    } else if (b.type === 'action') {
      if (targetLang === 'zh') {
        text = '月光透过破损的琉璃瓦倾泻而下。肖晨紧握剑柄，周身真气化作一缕苍蓝龙影。';
      } else if (targetLang === 'ja') {
        text = '月の光が壊れた瓦から差し込む。シャオ・チェンは刀の柄を強く握りしめ、青い闘気が龍の姿となって揺らめく。';
      } else if (targetLang === 'es') {
        text = 'La luz de la luna se filtra a través de las tejas rotas. Xiao Chen empuña su espada mientras un aura azul toma forma de dragón.';
      } else if (targetLang === 'en') {
        text = 'Moonlight floods through the broken tiles. Xiao Chen grips his scabbard as azure Qi manifests like a serpentine dragon.';
      }
    }

    return {
      id: b.id,
      type: b.type,
      speaker: b.character_name,
      translated_text: text,
      cultural_notes: notes
    };
  });

  const scriptBlocks: ScriptBlock[] = translatedBlocks.map((b) => ({
    id: b.id,
    type: b.type,
    character_name: b.speaker,
    text: b.translated_text,
    notes: b.cultural_notes
  }));

  const culturalNotesList: string[] = [
    `Cinematic register and honorifics adapted for ${meta.name}`,
    `Scene pacing and dialogue rhythm aligned with regional cinema expectations`
  ];

  return {
    language: targetLang,
    language_name: meta.name,
    target_language_name: meta.name,
    translated_title: meta.titleTrans,
    translated_slugline: meta.slugTrans,
    translated_blocks: scriptBlocks,
    blocks: translatedBlocks,
    cultural_notes: culturalNotesList
  };
}

/**
 * Curated Community Marketplace Templates (SSOT Section 42)
 */
export const INITIAL_MARKETPLACE_TEMPLATES: MarketplaceTemplate[] = [
  {
    id: 'tmpl_xianxia_starter',
    title: 'Xianxia Epic Universe Master Bible & Sect Codex',
    description: 'Arsitektur dunia kultivasi lengkap dengan 9 ranah spiritual, kode etik 5 sekte besar, dan aturan pil alkimia kuno.',
    category: 'universe_bible',
    genre: 'Xianxia',
    author_name: 'Master Script Architect (Amf Curators)',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    downloads_count: 842,
    rating: 4.96,
    reviews_count: 76,
    credit_cost: 0,
    tags: ['Xianxia', 'Cultivation', 'Martial Arts', 'World Bible', 'Realms'],
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=350&fit=crop',
    preview_data: {
      world_summary: 'Benua Tianlan dengan 9 Lapisan Langit dan Lembah Binatang Roh Kuno.',
      realms_count: 9,
      characters_count: 8,
      scenes_count: 24,
      sample_dialogue: 'Bahkan jika surga menentangku, pedang spiritualku akan membelah langit!',
      target_languages: ['id', 'en', 'zh']
    },
    created_at: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'tmpl_cyberpunk_tokyo',
    title: 'Cyberpunk Neo-Tokyo 2099: Neon Noir Asset Pack',
    description: 'Prompt master kontinuitas visual gaya neon sinematik 24fps, rig kamera drone anamorphic, dan preset suara synth retro.',
    category: 'character_pack',
    genre: 'Science Fiction',
    author_name: 'Studio Kusanagi',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    downloads_count: 1204,
    rating: 4.88,
    reviews_count: 114,
    credit_cost: 25,
    tags: ['Cyberpunk', 'Sci-Fi', 'Neon', 'Camera Rig', 'LUTs'],
    thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&h=350&fit=crop',
    preview_data: {
      world_summary: 'Megacity Shinjuku bawah tanah dengan konglomerat korporat bioteknologi.',
      characters_count: 6,
      scenes_count: 18,
      sample_dialogue: 'Memori augmentasi Anda telah didekripsi oleh agen bayangan.',
      target_languages: ['en', 'ja', 'es']
    },
    created_at: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    id: 'tmpl_kdrama_romance',
    title: 'K-Drama Romance Tension: 16-Episode Arc Template',
    description: 'Struktur ketegangan emosional Kishōtenketsu 4 babak, pola pertemuan takdir (Meet-Cute), dan formula plot twist keluarga chaebol.',
    category: 'screenplay_arc',
    genre: 'Drama / Romance',
    author_name: 'Seoul Creative Writers Guild',
    author_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    downloads_count: 650,
    rating: 4.92,
    reviews_count: 58,
    credit_cost: 15,
    tags: ['K-Drama', 'Romance', 'Beat Sheet', 'Emotional Pacing'],
    thumbnail_url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&h=350&fit=crop',
    preview_data: {
      world_summary: 'Dunia firma hukum elite Seoul dan konspirasi pewaris konglomerasi.',
      characters_count: 4,
      scenes_count: 32,
      sample_dialogue: 'Apakah kau pikir aku ada di sampingmu hanya karena kebetulan belaka?',
      target_languages: ['ko', 'id', 'en']
    },
    created_at: new Date(Date.now() - 12 * 86400000).toISOString()
  },
  {
    id: 'tmpl_martial_choreography',
    title: 'High-Impact Martial Arts Fight Choreography Pipeline',
    description: 'Alur kerja agen Fight Choreographer teruji: penguraian beat kinetik per 0.5 detik, penataan kamera orbital, dan timing tabrakan energi spiritual.',
    category: 'workflow_pipeline',
    genre: 'Action',
    author_name: 'Dragon Kinetic Lab',
    author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    downloads_count: 980,
    rating: 4.98,
    reviews_count: 89,
    credit_cost: 0,
    tags: ['Wuxia', 'Choreography', 'Combat Beats', 'Action Pipeline'],
    thumbnail_url: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&h=350&fit=crop',
    preview_data: {
      world_summary: 'Sistem koreografi pedang terbang dan pertarungan tangan kosong wushu.',
      characters_count: 4,
      scenes_count: 12,
      sample_dialogue: 'Jurus ini diciptakan bukan untuk membunuh, melainkan untuk meluruskan takdir!',
      target_languages: ['id', 'en', 'zh', 'ja']
    },
    created_at: new Date(Date.now() - 8 * 86400000).toISOString()
  }
];

export const INITIAL_CHARACTER_MARKETPLACE_PACKS: MarketplaceCharacterPack[] = [
  {
    id: 'cpack_xianxia_immortals',
    title: 'Nine Heavens Immortal Roster (Xianxia / Wuxia Pack)',
    description: 'Paket 3 karakter kultivator legendaris siap pakai lengkap dengan lembar seed kontinuitas visual, katalog jubah kultivasi & senjata pusaka, serta profil vokal dramatis.',
    genre: 'Xianxia / Wuxia',
    author_name: 'Celestial Jade Studio',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    downloads_count: 1840,
    rating: 4.97,
    reviews_count: 164,
    credit_cost: 0,
    tags: ['Xianxia', 'Wuxia', 'Immortal', 'Pedang Terbang', 'Visual Seed Ready'],
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=350&fit=crop',
    created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    characters: [
      {
        id: 'char_pack_lin_xuan',
        name: 'Lin Xuan',
        native_name: '林轩',
        role: 'protagonist',
        age: 22,
        gender: 'Pria',
        occupation_cultivation_level: 'Nascent Soul (Yuan Ying) — Puncak',
        sect_or_faction: 'Sekte Pedang Awan Biru',
        personality: 'Tenang, tajam, pantang menyerah terhadap ketidakadilan langit, setia pada sumpah perguruan.',
        motivation: 'Memulihkan segel meridian klannya yang dihancurkan oleh Istana Darah Abadi.',
        background: 'Mantan murid luar yang menemukan prasasti pedang kuno di dasar Jurang Bintang Jatuh.',
        physical_appearance: {
          face_structure: 'Rahang tegas pahatan giok, alis tajam menyerupai bilah pedang, kulit pucat bersih',
          eyes: 'Iris hitam pekat dengan kilatan cahaya perak bintang saat mengerahkan Qi',
          hair: 'Rambut hitam panjang sepunggung diikat separuh dengan mahkota giok biru langit',
          physique_height: '185 cm, proporsi atletis ramping namun padat akan tenaga dalam',
          distinguishing_features: 'Tanda segel pedang perak samar di antara kedua alis'
        },
        costume: {
          daily_attire: 'Jubah sutra putih bersih berpadu gradasi biru langit dengan sulaman awan perak di lengan lebar',
          battle_robes: 'Zirah ringan sisik naga perak di atas jubah tempur biru tua dengan jubah bahu berkibar',
          accessories_artifacts: 'Pedang Pusaka Qingyun (bilah giok transparan bercahaya cyan) & Liontin Giok Sembilan Langit di pinggang'
        },
        voice_characteristics: {
          pitch_tone: 'Bariton muda yang jernih, tenang namun berwibawa tajam',
          speech_tempo: 'Terukur, lugas, penuh penekanan saat mengucapkan mantra pedang',
          voice_actor_reference: 'Mandarin Xianxia Heroic Baritone (Bian Jiang / Zhang Jie Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Lin Xuan, 22yo Xianxia male immortal cultivator, sharp jade-carved jawline, sword-like eyebrows, deep black eyes with silver starlight glint, long flowing jet-black hair half-up with azure jade crown, wearing white and sky-blue silk Hanfu robes with silver cloud embroidery, carrying glowing cyan jade sword Qingyun, cinematic Unreal Engine 5 Donghua aesthetic, 8k --seed 884120]'
      },
      {
        id: 'char_pack_su_qingxue',
        name: 'Su Qingxue',
        native_name: '苏清雪',
        role: 'supporting',
        age: 20,
        gender: 'Wanita',
        occupation_cultivation_level: 'Golden Core (Jin Dan) — Sempurna',
        sect_or_faction: 'Lembah Teratai Es',
        personality: 'Anggun, dingin terhadap orang asing namun sangat protektif terhadap rekan seperjuangan.',
        motivation: 'Menjaga kemurnian Teratai Es Seribu Tahun dan mematahkan kutukan pembekuan meridian.',
        background: 'Putri suci (Saintess) Lembah Teratai Es yang mewarisi darah Phoenix Salju Kuno.',
        physical_appearance: {
          face_structure: 'Wajah oval klasik nan anggun, kulit seputih salju abadi, bibir merah muda lembut',
          eyes: 'Iris biru es kristal dengan tatapan jernih menembus ilusi',
          hair: 'Rambut hitam berkilau kebiruan sepanjang pinggang dengan tusuk konde kristal es berbentuk phoenix',
          physique_height: '172 cm, siluet ramping anggun bagaikan dewi turun dari kayangan',
          distinguishing_features: 'Corak bunga es kristal kecil di sudut pelipis kanan'
        },
        costume: {
          daily_attire: 'Gaun Hanfu berlapis organza putih salju dan biru es transparan dengan selendang sutra melayang (Pibo)',
          battle_robes: 'Jubah tempur perak es dengan pelindung bahu bulu phoenix putih dan sulaman kristal beku',
          accessories_artifacts: 'Kecapi Giok Es (Ice Jade Guqin) & Sabuk Lonceng Kristal Penenang Jiwa'
        },
        voice_characteristics: {
          pitch_tone: 'Sopran lirik yang sejuk, jernih bagai gemerincing es, dan menenangkan',
          speech_tempo: 'Lembut, anggun, tidak pernah terburu-buru bahkan di tengah pertempuran',
          voice_actor_reference: 'Ethereal Ice Saintess Sopran (Ji Guanlin Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Su Qingxue, 20yo Xianxia ice saintess, flawless snow-white skin, crystal ice-blue eyes, waist-length glossy dark hair with frost phoenix hairpin, wearing layered snow-white and translucent ice-blue silk Hanfu with floating celestial ribbon, holding Ice Jade Guqin, frost particles aura, 8k cinematic lighting --seed 884121]'
      },
      {
        id: 'char_pack_mo_wuya',
        name: 'Kaisar Iblis Mo Wuya',
        native_name: '魔无涯',
        role: 'antagonist',
        age: 400,
        gender: 'Pria',
        occupation_cultivation_level: 'Soul Formation (Hua Shen) — Kaisar Iblis',
        sect_or_faction: 'Istana Darah Abadi',
        personality: 'Karismatik, kejam namun menjunjung tinggi kekuatan mutlak, memandang hukum langit sebagai kemunafikan.',
        motivation: 'Meruntuhkan Segel Tiga Alam dan menyatukan benua di bawah panji Istana Darah Abadi.',
        background: 'Dulu merupakan jenius sekte ortodoks yang dikhianati lalu bangkit kembali dari Lautan Darah Purba.',
        physical_appearance: {
          face_structure: 'Garis wajah aristokrat tajam dan mengintimidasi, senyum sinis penuh dominasi',
          eyes: 'Iris merah kirmizi menyala dengan pupil vertikal keemasan',
          hair: 'Rambut putih perak panjang tergerai liar kontras dengan mahkota tanduk obsidian hitam',
          physique_height: '192 cm, postur tegap menjulang dengan aura tekanan spiritual hitam-merah',
          distinguishing_features: 'Tato rune darah kuno merambat dari leher kiri hingga rahang bawah'
        },
        costume: {
          daily_attire: 'Jubah kebesaran beludru hitam pekat dengan kerah tinggi berbulu gagak malam dan sulaman naga merah darah',
          battle_robes: 'Zirah baja obsidian hitam berukir emas gelap dengan jubah energi bayangan merah kirmizi',
          accessories_artifacts: 'Tombak Halberd Penghancur Surga (Obsidian & Crimson Flame) & Cincin Dimensi Raja Iblis'
        },
        voice_characteristics: {
          pitch_tone: 'Bass-bariton dalam, berat, bergema dengan tekanan spiritual yang menggetarkan',
          speech_tempo: 'Lambat, penuh wibawa intimidatif, setiap kata terdengar seperti titah mutlak',
          voice_actor_reference: 'Deep Resonant Overlord Bass (Wu Lei / Overlord Villain Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Demon Emperor Mo Wuya, regal intimidating aristocrat face, glowing crimson eyes with gold slit pupils, long wild silver-white hair with black obsidian crown, ancient blood rune tattoo on neck, wearing black velvet and crimson dragon-embroidered imperial demonic robes, dark red spiritual aura, 8k cinematic dark fantasy --seed 884122]'
      }
    ]
  },
  {
    id: 'cpack_cyberpunk_neotokyo',
    title: 'Cyberpunk Neo-Tokyo 2099: Syndicate & Netrunners Pack',
    description: 'Paket 2 karakter sci-fi masa depan dengan detail implan sibernetik, jaket taktis holografik, senjata frekuensi tinggi, dan profil suara sintetis-organik.',
    genre: 'Sci-Fi / Cyberpunk',
    author_name: 'Kowloon Neon Collective',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    downloads_count: 1420,
    rating: 4.94,
    reviews_count: 112,
    credit_cost: 0,
    tags: ['Cyberpunk', 'Sci-Fi', 'Netrunner', 'Mecha-Implants', 'Visual Seed Ready'],
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=350&fit=crop',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    characters: [
      {
        id: 'char_pack_kaelen_vance',
        name: 'Kaelen "Zero" Vance',
        native_name: 'カエレン・ヴァンス',
        role: 'protagonist',
        age: 27,
        gender: 'Pria',
        occupation_cultivation_level: 'Tier-9 Ghost Netrunner & Ex-Corp Enforcer',
        sect_or_faction: 'Ghost Protocol Underground',
        personality: 'Sinis, sangat kalkulatif di bawah tekanan, menyimpan empati tersembunyi bagi korban megakorporasi.',
        motivation: 'Membongkar server memori Arasaka-Helios untuk mengembalikan kesadaran adiknya yang terperangkap di jaringan.',
        background: 'Mantan agen keamanan siber korporat yang membelot setelah mengetahui proyek eksperimen kesadaran manusia.',
        physical_appearance: {
          face_structure: 'Rahang tegas dengan garis implan siber berlapis krom tipis di sepanjang tulang pipi',
          eyes: 'Mata bionik optik biru cyan dengan HUD telemetri menyala halus di kegelapan',
          hair: 'Potongan undercut asimetris hitam legam dengan kilau abu-abu metalik',
          physique_height: '183 cm, atletis taktis dengan lengan kiri sibernetik serat karbon hitam-emas',
          distinguishing_features: 'Port antarmuka neural berlapis emas di belakang pelipis kiri dan lengan bionik'
        },
        costume: {
          daily_attire: 'Jaket trench coat kulit sintetis matte hitam dengan kerah LED biru neon menyala dan kaos taktis abu-abu',
          battle_robes: 'Eksoskeleton tempur siluman ringan berlapis kevlar heksagonal dan pelindung dada optik kamuflase',
          accessories_artifacts: 'Katana Frekuensi Tinggi (Thermal Red Edge), Dek Peretas Neural Pergelangan Tangan, & Pistol Smart-Link'
        },
        voice_characteristics: {
          pitch_tone: 'Bariton serak tipis bergaya film noir dengan resonansi mikrofon internal',
          speech_tempo: 'Cepat dan taktis saat meretas, lambat dan sinis saat bernegosiasi',
          voice_actor_reference: 'Cyber-Noir Gritty Baritone (Keanu / Troy Baker Cyberpunk Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Kaelen Zero Vance, 27yo cyberpunk netrunner, sharp jawline with chrome cyberware seam lines on cheekbones, glowing cyan bionic optic eyes, black asymmetric undercut hair, black-gold carbon fiber cybernetic left arm, wearing matte black leather trench coat with glowing neon blue LED collar, holding thermal red high-frequency katana, rain-slicked Neo-Tokyo neon lighting, 8k --seed 772310]'
      },
      {
        id: 'char_pack_nyx_valkyrie',
        name: 'Nyx "Valkyrie" Kuroda',
        native_name: '黒田 ニクス',
        role: 'supporting',
        age: 24,
        gender: 'Wanita',
        occupation_cultivation_level: 'Apex Street Samurai & Drone Tactician',
        sect_or_faction: 'Ghost Protocol Underground',
        personality: 'Berani, sarkastik, sangat cekatan dalam pertarungan jarak dekat dan modifikasi perangkat keras.',
        motivation: 'Membebaskan distrik bawah tanah Sektor 9 dari blokade drone militer korporasi.',
        background: 'Mekanik tempur jalanan jenius yang merakit sendiri tubuh sibernetiknya dari suku cadang militer kelas atas.',
        physical_appearance: {
          face_structure: 'Wajah oval tajam ekspresif dengan garis riasan neon magenta di bawah mata',
          eyes: 'Iris bionik ungu violet dengan lensa zoom makro mekanis',
          hair: 'Rambut bob pendek perak platinum dengan gradasi ujung merah muda neon (neon pink)',
          physique_height: '170 cm, lincah dan akrobatik dengan sendi kaki bionik pendorong lompatan tinggi',
          distinguishing_features: 'Garis pelat krom perak di pangkal hidung dan tato sirkuit bercahaya di bahu'
        },
        costume: {
          daily_attire: 'Jaket bomber cropped holografik perak-magenta, bodysuit serat karbon hitam, dan celana kargo taktis',
          battle_robes: 'Zirah tempur ringan Valkyrie dengan sayap drone mikro di punggung dan visor AR tempur penuh',
          accessories_artifacts: 'Sepasang Belati Monowire Bercahaya Ungu & 3 Drone Intai Otonom Mini'
        },
        voice_characteristics: {
          pitch_tone: 'Mezzo-sopran energik, tajam, dan penuh percaya diri',
          speech_tempo: 'Dinamis, ritmis, penuh istilah teknis jalanan',
          voice_actor_reference: 'Edgerunner Energetic Mezzo (Cherami Leigh / Aoi Yuuki Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Nyx Valkyrie Kuroda, 24yo female street samurai, platinum silver bob hair with neon pink tips, violet bionic eyes, silver chrome nose bridge plate, wearing holographic silver-magenta cropped bomber jacket over black carbon bodysuit, wielding glowing purple monowire daggers, cyberpunk neon alley background, 8k --seed 772311]'
      }
    ]
  },
  {
    id: 'cpack_nusantara_majapahit',
    title: 'Nusantara Kolosal: Jawara & Putri Keraton Majapahit Pack',
    description: 'Paket 2 karakter kolosal Nusantara dengan detail anatomi autentik, busana bangsawan & pendekar kerajaan, pusaka keris luk 9 bercahaya, serta profil vokal teater kolosal.',
    genre: 'Action / Historical',
    author_name: 'Nusantara Sinema Pusaka',
    author_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
    downloads_count: 1190,
    rating: 4.98,
    reviews_count: 94,
    credit_cost: 0,
    tags: ['Nusantara', 'Kolosal', 'Majapahit', 'Pendekar', 'Keris Pusaka'],
    thumbnail_url: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&h=350&fit=crop',
    created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    characters: [
      {
        id: 'char_pack_arya_kamandanu',
        name: 'Raden Arya Wirabhumi',
        native_name: 'ꦄꦂꦪꦮꦶꦫꦨূꦩꦶ',
        role: 'protagonist',
        age: 26,
        gender: 'Pria',
        occupation_cultivation_level: 'Senopati Bhayangkara Utama — Kanuragan Tingkat Puncak',
        sect_or_faction: 'Pasukan Khusus Bhayangkara Surya',
        personality: 'Ksatria, memegang teguh dharma keprajuritan, rendah hati namun tak tergoyahkan di medan perang.',
        motivation: 'Menjaga keutuhan mandala Nusantara dari pemberontakan sekte gelap dan pengkhianat istana.',
        background: 'Keturunan bangsawan yang memilih ditempa di padepokan lereng Gunung Semeru sejak usia tujuh tahun.',
        physical_appearance: {
          face_structure: 'Rahang kokoh khas ksatria Jawa kuno, kulit sawo matang bersih berkilau hangat, sorot wajah teduh namun tegas',
          eyes: 'Mata coklat gelap tajam bagai elang Jawa dengan ketenangan batin tinggi',
          hair: 'Rambut hitam bergelombang sebahu diikat rapi dengan udeng kepala batik emas kerajaan',
          physique_height: '181 cm, tubuh kekar berotot alami hasil tempaan silat kuno dan olah napas kanuragan',
          distinguishing_features: 'Bekas luka tipis terhormat di bahu kanan dan kalung taring macan berikat emas'
        },
        costume: {
          daily_attire: 'Rompi kulit kerbau berukir motif sulur emas tanpa lengan, kain dodot batik parang barong merah-emas, dan sabuk logam perunggu',
          battle_robes: 'Zirah rantai tembaga-emas ringan khas Senopati Majapahit dengan pelindung lengan (kelat bahu) naga emas',
          accessories_artifacts: 'Keris Pusaka Nagasasra Luk 9 (berpamor emas menyala merah bara) & Tombak Pendek Trisula'
        },
        voice_characteristics: {
          pitch_tone: 'Bariton hangat, mantap, dan berwibawa bak ksatria keraton',
          speech_tempo: 'Tenang, santun dalam tata krama tinggi, namun menggelegar saat memimpin pasukan',
          voice_actor_reference: 'Indonesian Epic Colossal Hero Baritone (Ario Bayu / Iko Uwais Dramatic Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Raden Arya Wirabhumi, 26yo ancient Javanese Majapahit warrior commander, strong jawline, warm bronze tan skin, sharp hawk-like dark brown eyes, shoulder-length wavy black hair tied with royal gold batik headband, muscular martial arts physique, wearing gold-embossed leather vest, royal red-gold Parang batik waistcloth, golden dragon armlets, wielding glowing gold-inlaid Luk-9 Keris dagger, epic cinematic lighting, 8k --seed 991045]'
      },
      {
        id: 'char_pack_dyah_gayatri',
        name: 'Dyah Pitaloka Anindita',
        native_name: 'ꦢꦾꦃꦥꦶꦠꦭꦺꦴꦏ',
        role: 'supporting',
        age: 21,
        gender: 'Wanita',
        occupation_cultivation_level: 'Empu Strategi & Pendekar Kipas Sutra Emas',
        sect_or_faction: 'Keraton Agung Wilwatikta',
        personality: 'Cerdas, diplomatis, piawai membaca intrik politik istana sekaligus mematikan dalam bela diri.',
        motivation: 'Menyatukan aliansi kerajaan kepulauan melalui jalur diplomasi maupun ketegasan militer.',
        background: 'Putri bangsawan yang menguasai sastra kuno lontar sekaligus ilmu beladiri rahasia keraton.',
        physical_appearance: {
          face_structure: 'Wajah oval anggun memesona, kulit kuning langsat halus, senyum tenang penuh wibawa bangsawan',
          eyes: 'Mata hitam indah berbulu mata lentik dengan tatapan tajam penuh kecerdasan',
          hair: 'Rambut hitam legam disanggul agung dengan hiasan jamang mahkota emas bunga cempaka',
          physique_height: '168 cm, postur tegap anggun seperti penari keraton namun sangat tangkas',
          distinguishing_features: 'Subang (anting) emas kuno berbentuk garuda kecil di kedua telinga'
        },
        costume: {
          daily_attire: 'Kemben sutra merah marun bersulam benang emas murni, kain batik tulis klasik, dan selendang sutra kuning keemasan',
          battle_robes: 'Busana pendekar keraton ringkas berlapis pelindung dada emas berukir surya majapahit dan kain celana silat beludru',
          accessories_artifacts: 'Sepasang Kipas Baja Sutra Emas & Tusuk Konde Rahasia Beracun'
        },
        voice_characteristics: {
          pitch_tone: 'Mezzo-sopran anggun, merdu namun tegas dan meyakinkan',
          speech_tempo: 'Teratur, puitis, dengan diksi bangsawan yang memikat pendengar',
          voice_actor_reference: 'Royal Nusantara Princess Mezzo (Dian Sastrowardoyo / Tara Basro Epic Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Dyah Pitaloka Anindita, 21yo royal Majapahit warrior princess, graceful oval face, radiant golden-fair skin, intelligent dark eyes, elaborate black hair updo with golden Cempaka crown ornament (Jamang), wearing maroon silk kemben with pure gold thread embroidery, classical royal batik, holding golden steel-ribbed silk war fan, tropical palace golden hour lighting, 8k --seed 991046]'
      }
    ]
  },
  {
    id: 'cpack_kdrama_chaebol',
    title: 'Seoul Prestige K-Drama: Chaebol Heir & Ace Prosecutor Pack',
    description: 'Paket 2 karakter utama drama modern Korea (Chaebol & Thriller Hukum) dengan spesifikasi busana haute couture, pencahayaan sinematik Seoul, dan profil intonasi vokal emosional.',
    genre: 'Drama / Romance',
    author_name: 'Seoul Creative Writers Guild',
    author_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    downloads_count: 1050,
    rating: 4.95,
    reviews_count: 82,
    credit_cost: 0,
    tags: ['K-Drama', 'Chaebol', 'Legal Thriller', 'Romance', 'Modern Cinema'],
    thumbnail_url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&h=350&fit=crop',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    characters: [
      {
        id: 'char_pack_kang_tae_oh',
        name: 'Kang Tae-Oh',
        native_name: '강태오',
        role: 'protagonist',
        age: 30,
        gender: 'Pria',
        occupation_cultivation_level: 'CEO Hanseong Group & Ahli Strategi Korporat',
        sect_or_faction: 'Hanseong Conglomerate (Chaebol)',
        personality: 'Perfeksionis, tampak dingin dan tak tersentuh di depan publik, namun menyimpan luka masa lalu dan kesetiaan mendalam.',
        motivation: 'Membersihkan korupsi internal di konglomerasi keluarganya dan menemukan kebenaran kecelakaan 10 tahun silam.',
        background: 'Pewaris generasi ketiga Hanseong Group yang kembali ke Seoul setelah menyelesaikan gelar ganda di luar negeri.',
        physical_appearance: {
          face_structure: 'Garis rahang V-line tajam proporsional, hidung mancung tegas, kulit bersih bercahaya (glass skin)',
          eyes: 'Mata monolid tajam dengan sorot intens yang berubah hangat saat menatap orang yang dipercaya',
          hair: 'Rambut hitam kecoklatan ditata comma-hair rapi bergaya eksekutif Seoul',
          physique_height: '187 cm, bahu lebar proporsional dengan postur tegap sempurna dalam balutan jas bespoke',
          distinguishing_features: 'Tahi lalat kecil di bawah mata kiri'
        },
        costume: {
          daily_attire: 'Setelan jas bespoke tiga potong warna charcoal navy, kemeja putih kerah tegak, dan mantel cashmere panjang hitam',
          battle_robes: 'Setelan jas malam hitam formal Rapat Umum Pemegang Saham dengan dasi sutra burgundy dan manset platinum',
          accessories_artifacts: 'Jam Tangan Kronograf Tourbillon Platinum & Pena Fountain Edisi Terbatas'
        },
        voice_characteristics: {
          pitch_tone: 'Bariton rendah yang lembut namun penuh otoritas ruang rapat',
          speech_tempo: 'Tenang, artikulasi sangat presisi, dengan jeda emosional khas drama Korea',
          voice_actor_reference: 'K-Drama Prestige Leading Man Baritone (Song Joong-Ki / Hyun Bin Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Kang Tae-Oh, 30yo Korean chaebol CEO, sharp masculine jawline, expressive monolid dark eyes with tiny beauty mark under left eye, dark brown comma-styled hair, 187cm broad-shouldered physique, wearing bespoke charcoal-navy three-piece suit under long black cashmere overcoat, platinum chronograph watch, cinematic Seoul night bokeh lighting, 85mm f/1.4 portrait lens, 8k --seed 665010]'
      },
      {
        id: 'char_pack_han_so_hee',
        name: 'Han Seo-Yun',
        native_name: '한서윤',
        role: 'supporting',
        age: 28,
        gender: 'Wanita',
        occupation_cultivation_level: 'Jaksa Investigasi Khusus Kejahatan Finansial',
        sect_or_faction: 'Kejaksaan Agung Distrik Pusat Seoul',
        personality: 'Berani, tajam dalam berargumen di ruang sidang, berempati tinggi pada pencari keadilan.',
        motivation: 'Menegakkan keadilan tanpa pandang bulu terhadap kekuasaan konglomerat yang kebal hukum.',
        background: 'Lulusan terbaik Institut Penelitian dan Pelatihan Yudisial yang menolak tawaran firma hukum besar demi menjadi jaksa publik.',
        physical_appearance: {
          face_structure: 'Wajah oval proporsional dengan fitur lembut namun sorot ekspresi tegas dan berani',
          eyes: 'Mata coklat jernih ekspresif yang memancarkan keteguhan hati',
          hair: 'Rambut hitam gelombang lembut sebahu dengan poni tipis samping',
          physique_height: '169 cm, postur ramping elegan dan langkah kaki cepat penuh determinasi',
          distinguishing_features: 'Senyum hangat yang langsung mencairkan suasana tegang'
        },
        costume: {
          daily_attire: 'Blazer tailored warna ivory-beige di atas blus sutra hitam dan celana panjang high-waist rapi',
          battle_robes: 'Jubah resmi Jaksa Penuntut Umum Korea Selatan (hitam-merah marun) dengan lencana keadilan di dada',
          accessories_artifacts: 'Lencana Kejaksaan Distrik Pusat Seoul, Tas Kerja Kulit Hitam & Rekaman Bukti Digital'
        },
        voice_characteristics: {
          pitch_tone: 'Alto-mezzo jernih, artikulatif, meyakinkan dan kaya nuansa emosi',
          speech_tempo: 'Cepat dan tajam saat interogasi, hangat dan tulus dalam percakapan pribadi',
          voice_actor_reference: 'K-Drama Ace Prosecutor Alto-Mezzo (Kim Tae-Ri / Jeon Yeo-Been Style)'
        },
        visual_consistency_prompt: '[Master Character Seed: Han Seo-Yun, 28yo Korean special prosecutor, elegant oval face, clear expressive dark brown eyes, shoulder-length soft wavy black hair, wearing tailored ivory-beige blazer over black silk blouse, prosecutor badge, holding legal dossier, warm cinematic Seoul courthouse lighting, 85mm portrait lens, 8k --seed 665011]'
      }
    ]
  }
];
