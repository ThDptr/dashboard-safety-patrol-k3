// ============================================================================
// lib/modules.ts — 17 Modul/Topik Patroli (Single Source of Truth)
// Dashboard Patroli Kesling & K3 RSOMH
// ============================================================================
// Semua sheetHeader diselaraskan dengan readm.md (mapping kolom A–DU)
// pada Google Sheet "Form Responses 1" yang baru.
// ============================================================================

export const HARIAN_SLUGS = ["evakuasi", "kebersihan", "risiko", "sampah", "code-red"] as const;
export type HarianSlug = typeof HARIAN_SLUGS[number];

export const HARIAN_ABBREV: Record<HarianSlug, string[]> = {
  "evakuasi":   ["Hmbt", "Pintu"],
  "kebersihan": ["Dndg", "P/J", "Lntai", "Plfn", "Lmpu", "Vntl", "Rkok"],
  "risiko":     ["Tngga", "Lntai", "Ramp", "Alat"],
  "sampah":     ["Label"],
  "code-red":   ["Papan", "H.Merah", "H.Putih", "H.Biru", "H.Kng", "P.Tanggal"],
};

export type JawabanType = "yntb" | "yn"; // yntb = Ya/Tidak/N/A, yn = Ya/Tidak only

export interface QuestionDef {
  /** Exact column header in Google Sheet (key in data object) */
  sheetHeader: string;
  /** Human-readable short label for UI display */
  label: string;
  /** Answer type */
  type: JawabanType;
}

export interface ExtraFieldDef {
  sheetHeader: string;
  label: string;
  fieldType: "number" | "date" | "text" | "yn" | "checkbox";
}

export type ModuleScope =
  | "DALAM_BULANAN"
  | "DALAM_HARIAN"
  | "PCRA"
  | "LUAR_GEDUNG"
  | "B3";

export interface ModuleDef {
  /** URL-safe slug, used in routes `/patroli/[slug]` */
  slug: string;
  /** Display title */
  title: string;
  /** Emoji icon */
  icon: string;
  /** Navigation group */
  group: "Dalam Gedung — Bulanan" | "Dalam Gedung — Harian" | "Lainnya";
  /** Which form branch this module belongs to */
  scope: ModuleScope;
  /**
   * Scored Yes/No questions — these drive the % calculation.
   * N/A answers are excluded from denominator.
   */
  questions: QuestionDef[];
  /**
   * Non-scored fields (counts, dates, free text, flags) — displayed as info,
   * not used in % calculation.
   */
  extraFields?: ExtraFieldDef[];
  /** Column header for the photo URL field */
  photoHeader?: string;
  /** Column header for the findings description */
  descriptionHeader?: string;
  /**
   * Secondary photo/description group header — used when a module has two
   * distinct observation sections (e.g. B3 has separate Eyewasher/Bodywasher section).
   */
  secondaryPhotoHeader?: string;
  secondaryDescriptionHeader?: string;
  /**
   * If true, this module has no scored questions and is displayed
   * as a log/activity list only (e.g. Sosialisasi).
   */
  logOnly?: boolean;
  /**
   * Column header for badge/warning tags (comma-separated string).
   * e.g. APD non-compliant units, B3 sub-units with issues.
   */
  badgeHeader?: string;
}

// ============================================================================
// A. Dalam Gedung — Bulanan  (6 modul)
// ============================================================================

const PERALATAN_KERJA: ModuleDef = {
  slug: "peralatan-kerja",
  title: "Peralatan Kerja",
  icon: "🔧",
  group: "Dalam Gedung — Bulanan",
  scope: "DALAM_BULANAN",
  questions: [
    {
      sheetHeader: "Peralatan Kerja [Peralatan Kerja - Ergonomi]",
      label: "Peralatan Kerja - Ergonomi",
      type: "yntb",
    },
    {
      sheetHeader: "Peralatan Kerja [Peralatan Kerja - Penempatan Teratur dan 5R]",
      label: "Peralatan Kerja - Penempatan Teratur dan 5R",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Peralatan Kerja",
  descriptionHeader: "Deskripsi Temuan - Peralatan Kerja",
};

const PERALATAN_MEDIK: ModuleDef = {
  slug: "peralatan-medik",
  title: "Peralatan Medik",
  icon: "💉",
  group: "Dalam Gedung — Bulanan",
  scope: "DALAM_BULANAN",
  questions: [
    {
      sheetHeader: "Peralatan Medik [Peralatan Medik - Berfungsi baik]",
      label: "Peralatan Medik - Berfungsi baik",
      type: "yntb",
    },
    {
      sheetHeader: "Peralatan Medik [Peralatan Medik - Kartu/Label kalibrasi masih berlaku]",
      label: "Peralatan Medik - Kartu/Label kalibrasi masih berlaku",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Peralatan Medik",
  descriptionHeader: "Deskripsi Temuan - Peralatan Medik",
};

const APAR: ModuleDef = {
  slug: "apar",
  title: "APAR",
  icon: "🧯",
  group: "Dalam Gedung — Bulanan",
  scope: "DALAM_BULANAN",
  extraFields: [
    {
      // readm.md kolom O
      sheetHeader: "APAR - Jumlah APAR Powder",
      label: "Jumlah APAR Powder",
      fieldType: "number",
    },
    {
      // readm.md kolom P
      sheetHeader: "APAR - Jumlah APAR CO2",
      label: "Jumlah APAR CO2",
      fieldType: "number",
    },
    {
      // readm.md kolom T
      sheetHeader: "APAR - Tanggal pemeliharaan terakhir",
      label: "Tgl. Pemeliharaan Terakhir",
      fieldType: "date",
    },
  ],
  questions: [
    {
      // Header asli Google Sheet: "APAR  [APAR - Terjangkau]" (double space)
      sheetHeader: "APAR  [APAR - Terjangkau]",
      label: "APAR - Terjangkau",
      type: "yntb",
    },
    {
      sheetHeader: "APAR  [APAR - Rambu dan SOP terpasang]",
      label: "APAR - Rambu dan SOP terpasang",
      type: "yntb",
    },
    {
      sheetHeader: "APAR  [APAR - Kartu pemeliharaan terisi]",
      label: "APAR - Kartu pemeliharaan terisi",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - APAR",
  descriptionHeader: "Deskripsi Temuan - APAR",
};

const HYDRANT: ModuleDef = {
  slug: "hydrant",
  title: "Hydrant",
  icon: "🚒",
  group: "Dalam Gedung — Bulanan",
  scope: "DALAM_BULANAN",
  questions: [
    {
      sheetHeader: "HYDRANT [Hydrant - Box tersedia dan lengkap]",
      label: "Hydrant - Box tersedia dan lengkap",
      type: "yn",
    },
    {
      sheetHeader: "HYDRANT [Hydrant - SOP terpasang]",
      label: "Hydrant - SOP terpasang",
      type: "yn",
    },
    {
      sheetHeader: "HYDRANT [Hydrant - Fire alarm]",
      label: "Hydrant - Fire alarm",
      type: "yn",
    },
    {
      sheetHeader: "HYDRANT [Hydrant - Terdapat kartu pemeliharaan berlaku ]",
      label: "Hydrant - Terdapat kartu pemeliharaan berlaku",
      type: "yn",
    },
  ],
  photoHeader: "Foto Temuan - HYDRANT",
  descriptionHeader: "Deskripsi Temuan - HYDRANT",
};

const SARANA_PROTEKSI: ModuleDef = {
  slug: "sarana-proteksi",
  title: "Sarana Proteksi Kebakaran",
  icon: "🔥",
  group: "Dalam Gedung — Bulanan",
  scope: "DALAM_BULANAN",
  questions: [
    {
      sheetHeader: "Sarana Proteksi Kebakaran [Sarana Proteksi - Smoke Detector/Heat Detector]",
      label: "Sarana Proteksi - Smoke Detector/Heat Detector",
      type: "yntb",
    },
    {
      sheetHeader: "Sarana Proteksi Kebakaran [Sarana Proteksi - Sprinkler]",
      label: "Sarana Proteksi - Sprinkler",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Sarana Proteksi Kebakaran",
  descriptionHeader: "Deskripsi Temuan - Sarana Proteksi Kebakaran",
};

const RAMBU: ModuleDef = {
  slug: "rambu",
  title: "Rambu Keselamatan",
  icon: "🪧",
  group: "Dalam Gedung — Bulanan",
  scope: "DALAM_BULANAN",
  questions: [
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Jalur evakuasi]",
      label: "Rambu - Jalur evakuasi",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Exit/keluar]",
      label: "Rambu - Exit/keluar",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Peringatan]",
      label: "Rambu - Peringatan",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Hati-hati tersandung (pilih N/A, jika tidak ada lantai beda ketinggian)]",
      label: "Rambu - Hati-hati tersandung",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Peta evakuasi]",
      label: "Rambu - Peta evakuasi",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Bis pada anak tangga (Pilih N/A, jika tidak ada tangga)]",
      label: "Rambu - Bis pada anak tangga",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Titik kumpul (Selain IGD dan Singgalang 1, pilih N/A)]",
      label: "Rambu - Titik kumpul",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Dilarang merokok]",
      label: "Rambu - Dilarang merokok",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Hemat listrik/air]",
      label: "Rambu - Hemat listrik/air",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Rambu Keselamatan",
  descriptionHeader: "Deskripsi Temuan - Rambu Keselamatan",
};

// ============================================================================
// B. Dalam Gedung — Harian  (8 modul)
// ============================================================================

const ELEKTRIK: ModuleDef = {
  slug: "elektrik",
  title: "Elektrik",
  icon: "⚡",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Elektrik [Elektrik - Perkabelan aman]",
      label: "Elektrik - Perkabelan aman",
      type: "yntb",
    },
    {
      sheetHeader: "Elektrik [Elektrik - Sumber  dan sambungan listrik aman]",
      label: "Elektrik - Sumber dan sambungan listrik aman",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Elektrik",
  descriptionHeader: "Deskripsi Temuan - Elektrik",
};

const EVAKUASI: ModuleDef = {
  slug: "evakuasi",
  title: "Keamanan Jalur Evakuasi",
  icon: "🚶",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Keamanan Jalur Evakuasi [Jalur Evakuasi - Bebas hambatan]",
      label: "Jalur Evakuasi - Bebas hambatan",
      type: "yntb",
    },
    {
      sheetHeader: "Keamanan Jalur Evakuasi [Jalur Evakuasi - Pintu darurat berfungsi (Pilih N/A, jika tidak ada pintu darurat)]",
      label: "Jalur Evakuasi - Pintu darurat berfungsi (Pilih N/A, jika tidak ada pintu darurat)",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Jalur Evakuasi",
  descriptionHeader: "Deskripsi Temuan - Jalur Evakuasi",
};

const KEBERSIHAN: ModuleDef = {
  slug: "kebersihan",
  title: "Kelengkapan, Keamanan dan Kebersihan Sarana",
  icon: "🧹",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Kelengkapan, Keamanan dan Kebersihan Sarana [Keamanan - Dinding Aman]",
      label: "Keamanan - Dinding Aman",
      type: "yntb",
    },
    {
      sheetHeader: "Kelengkapan, Keamanan dan Kebersihan Sarana [Keamanan - Pintu/jendela Aman]",
      label: "Keamanan - Pintu/jendela Aman",
      type: "yntb",
    },
    {
      sheetHeader: "Kelengkapan, Keamanan dan Kebersihan Sarana [Keamanan - Lantai Aman]",
      label: "Keamanan - Lantai Aman",
      type: "yntb",
    },
    {
      sheetHeader: "Kelengkapan, Keamanan dan Kebersihan Sarana [Keamanan - Plafon Aman]",
      label: "Keamanan - Plafon Aman",
      type: "yntb",
    },
    {
      sheetHeader: "Kelengkapan, Keamanan dan Kebersihan Sarana [Keamanan - Lampu berfungsi]",
      label: "Keamanan - Lampu berfungsi",
      type: "yntb",
    },
    {
      sheetHeader: "Kelengkapan, Keamanan dan Kebersihan Sarana [Keamanan - Ventilasi tersedia]",
      label: "Keamanan - Ventilasi tersedia",
      type: "yntb",
    },
    {
      sheetHeader: "Kelengkapan, Keamanan dan Kebersihan Sarana [Keamanan - Tidak ada puntung rokok]",
      label: "Keamanan - Tidak ada puntung rokok",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Keamanan Sarana",
  descriptionHeader: "Deskripsi Temuan - Keamanan Sarana",
};

const RISIKO: ModuleDef = {
  slug: "risiko",
  title: "Risiko Kecelakaan",
  icon: "⚠️",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Anak tangga aman (pilih N/A, jika tidak ada tangga)]",
      label: "Risiko - Anak tangga aman (pilih N/A, jika tidak ada tangga)",
      type: "yntb",
    },
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Lantai aman]",
      label: "Risiko - Lantai aman",
      type: "yntb",
    },
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Jalur Ramp aman (Selain Singgalang Lt2, Singgalang Lt3 dan Poli Lt 2, pilih N/A)]",
      label: "Risiko - Jalur Ramp aman (Selain Singgalang Lt2, Singgalang Lt3 dan Poli Lt 2, pilih N/A)",
      type: "yntb",
    },
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Penempatan alat aman]",
      label: "Risiko - Penempatan alat aman",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Risiko Kecelakaan",
  descriptionHeader: "Deskripsi Temuan - Risiko Kecelakaan",
};

const APD: ModuleDef = {
  slug: "apd",
  title: "APD",
  icon: "🦺",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "APD [APD - Ketersediaan terpenuhi]",
      label: "APD - Ketersediaan terpenuhi",
      type: "yntb",
    },
    {
      sheetHeader: "APD [APD - Karyawan menggunakan APD sesuai]",
      label: "APD - Karyawan menggunakan APD sesuai",
      type: "yntb",
    },
  ],
  // readm.md kolom BQ–BU: [1]–[5] (bukan [lebih])
  badgeHeader: "APD - Unit Tidak Patuh (gabungan)",
  photoHeader: "Foto Temuan - APD",
  descriptionHeader: "Deskripsi Temuan - APD",
};

const SAMPAH: ModuleDef = {
  slug: "sampah",
  title: "Sampah",
  icon: "🗑️",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Sampah [B3 - Sampah sesuai label]",
      label: "B3 - Sampah sesuai label",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Sampah",
  descriptionHeader: "Deskripsi Temuan - Sampah",
};

const CODE_RED: ModuleDef = {
  slug: "code-red",
  title: "Code Red",
  icon: "🚨",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Papan kondisi baik]",
      label: "CODE RED - Papan kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader: "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm merah kondisi baik]",
      label: "CODE RED - Helm merah kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader: "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm putih kondisi baik]",
      label: "CODE RED - Helm putih kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader: "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm biru kondisi baik]",
      label: "CODE RED - Helm biru kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader: "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm kuning kondisi baik]",
      label: "CODE RED - Helm kuning kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader: "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Papan terisi tanggal dan nama]",
      label: "CODE RED - Papan terisi tanggal dan nama",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - CODE RED",
  descriptionHeader: "Deskripsi Temuan - CODE RED",
};

const SOSIALISASI: ModuleDef = {
  slug: "sosialisasi",
  title: "Sosialisasi/Safety Talking",
  icon: "🗣️",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [], // No scored questions — log only
  extraFields: [
    {
      // readm.md kolom CI
      sheetHeader: "Sosialisasi - Topik",
      label: "Topik",
      fieldType: "checkbox",
    },
    {
      // readm.md kolom CJ
      sheetHeader: "Sosialisasi - Sasaran",
      label: "Sasaran",
      fieldType: "text",
    },
  ],
  photoHeader: "Foto Temuan - Keluhan",
  descriptionHeader: "Deskripsi Temuan - Keluhan",
  logOnly: true,
};

// ============================================================================
// C. Jalur Khusus  (3 modul)
// ============================================================================

const PCRA: ModuleDef = {
  slug: "pcra",
  title: "PCRA",
  icon: "🚧",
  group: "Lainnya",
  scope: "PCRA",
  extraFields: [
    {
      // readm.md kolom CM
      sheetHeader: "PCRA - Lokasi dan deskripsi pekerjaan",
      label: "Lokasi & Deskripsi Pekerjaan",
      fieldType: "text",
    },
  ],
  questions: [
    {
      sheetHeader: "PCRA [PCRA - Sosialisasi K3 dari kontraktor]",
      label: "PCRA - Sosialisasi K3 dari kontraktor",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Pekerja menggunakan APD lengkap]",
      label: "PCRA - Pekerja menggunakan APD lengkap",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Pembatasan area (barrier)]",
      label: "PCRA - Pembatasan area (barrier)",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Rambu keselamatan terpasang]",
      label: "PCRA - Rambu keselamatan terpasang",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Tidak ada pekerja merokok]",
      label: "PCRA - Tidak ada pekerja merokok",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Tempat material rapi dan bersih]",
      label: "PCRA - Tempat material rapi dan bersih",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Pembersihan sisa pekerjaan]",
      label: "PCRA - Pembersihan sisa pekerjaan",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - PCRA",
  descriptionHeader: "Deskripsi Temuan - PCRA",
};

const LUAR_GEDUNG: ModuleDef = {
  slug: "luar-gedung",
  title: "Luar Gedung",
  icon: "🌳",
  group: "Lainnya",
  scope: "LUAR_GEDUNG",
  extraFields: [
    {
      // readm.md kolom CX
      sheetHeader: "APAR Luar -  Jumlah APAR Powder 6 kg",
      label: "Jumlah APAR Powder 6 kg",
      fieldType: "number",
    },
    {
      // readm.md kolom CY
      sheetHeader: "APAR Luar -  Jumlah APAR Powder 25 kg",
      label: "Jumlah APAR Powder 25 kg",
      fieldType: "number",
    },
    {
      // readm.md kolom CZ
      sheetHeader: "APAR Luar -  Jumlah APAR CO2",
      label: "Jumlah APAR CO2",
      fieldType: "number",
    },
    {
      // readm.md kolom DD
      sheetHeader: "APAR Luar - Tanggal pemeliharaan terakhir",
      label: "Tgl. Pemeliharaan Terakhir",
      fieldType: "date",
    },
  ],
  questions: [
    {
      sheetHeader: "Luar Gedung : APAR [APAR Luar - Terjangkau]",
      label: "APAR Luar - Terjangkau",
      type: "yntb",
    },
    {
      sheetHeader: "Luar Gedung : APAR [APAR Luar - Rambu dan SOP Terpasang]",
      label: "APAR Luar - Rambu dan SOP",
      type: "yntb",
    },
    {
      sheetHeader: "Luar Gedung : APAR [APAR Luar - Kartu pemeliharaan terisi]",
      label: "APAR Luar - Kartu pemeliharaan terisi",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - APAR Luar",
  descriptionHeader: "Deskripsi Temuan - APAR Luar",
};

const B3: ModuleDef = {
  slug: "b3",
  title: "Keamanan B3 dan Limbah B3",
  icon: "☣️",
  group: "Lainnya",
  scope: "B3",
  extraFields: [
    {
      // readm.md kolom DH
      sheetHeader: "B3 - Jumlah Lemari ",
      label: "Jumlah Lemari B3",
      fieldType: "number",
    },
    {
      // readm.md kolom DQ
      sheetHeader: "Jumlah Eyewasher",
      label: "Jumlah Eyewasher",
      fieldType: "number",
    },
    {
      // readm.md kolom DS
      sheetHeader: "Jumlah Bodywasher",
      label: "Jumlah Bodywasher",
      fieldType: "number",
    },
  ],
  questions: [
    {
      sheetHeader: "B3 [B3 - Penyimpanan Terpisah]",
      label: "B3 - Penyimpanan B3",
      type: "yntb",
    },
    {
      sheetHeader: "B3 [B3 - Ketersediaan SDS]",
      label: "B3 - Ketersediaan SDS",
      type: "yntb",
    },
    {
      sheetHeader: "B3 [B3 - Ketersediaan Spill Kit]",
      label: "B3 - Ketersediaan Spill Kit",
      type: "yntb",
    },
    {
      sheetHeader: "B3 [B3 - Kelengkapan Spill Kit]",
      label: "B3 - Kelengkapan Spill Kit",
      type: "yntb",
    },
    {
      sheetHeader: "Eyewasher berfungsi baik  ",
      label: "Eyewasher berfungsi baik",
      type: "yntb",
    },
    {
      sheetHeader: "Bodywasher berfungsi baik  ",
      label: "Bodywasher berfungsi baik",
      type: "yntb",
    },
  ],
  // readm.md kolom DM
  badgeHeader: "B3 - Sub-Unit Bermasalah ",
  // a. Penyimpanan B3, SDS, Spill Kit
  photoHeader: "Foto Temuan - B3",
  descriptionHeader: "Deskripsi Temuan - B3",
  // c. Eyewasher & Bodywasher (foto & deskripsi terpisah)
  secondaryPhotoHeader: "Foto Temuan - Eyewasher dan Bodywasher",
  secondaryDescriptionHeader: "Deskripsi Temuan - Eyewasher dan Bodywasher",
};

// ============================================================================
// Master list — ORDER MATTERS (determines sidebar order)
// ============================================================================

export const MODULES: ModuleDef[] = [
  // Bulanan
  PERALATAN_KERJA,
  PERALATAN_MEDIK,
  APAR,
  HYDRANT,
  SARANA_PROTEKSI,
  RAMBU,
  // Harian
  ELEKTRIK,
  EVAKUASI,
  KEBERSIHAN,
  RISIKO,
  APD,
  SAMPAH,
  CODE_RED,
  SOSIALISASI,
  // Lainnya
  PCRA,
  LUAR_GEDUNG,
  B3,
];

export const MODULE_BY_SLUG: Record<string, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.slug, m])
);

export const GROUPS = [
  "Dalam Gedung — Bulanan",
  "Dalam Gedung — Harian",
  "Lainnya",
] as const;

export type GroupName = (typeof GROUPS)[number];

export const MODULES_BY_GROUP: Record<GroupName, ModuleDef[]> = {
  "Dalam Gedung — Bulanan": MODULES.filter(
    (m) => m.group === "Dalam Gedung — Bulanan"
  ),
  "Dalam Gedung — Harian": MODULES.filter(
    (m) => m.group === "Dalam Gedung — Harian"
  ),
  Lainnya: MODULES.filter((m) => m.group === "Lainnya"),
};

// Lokasi luar gedung dropdown options
export const LOKASI_LUAR_GEDUNG = [
  "Pos Satpam",
  "BPD",
  "Mini Market Depan",
  "Mini Market Belakang",
  "Mushola",
  "Ruang Oksigen Limpapeh",
  "Ruang Oksigen Cathlab",
  "Ruang Genset Samping Limpapeh",
  "Ruang Genset Dalam Penunjang",
  "Ruang Genset Luar Penunjang",
  "TPS B3",
] as const;
