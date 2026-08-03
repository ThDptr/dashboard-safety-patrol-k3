// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// lib/modules.ts � 17 Modul/Topik Patroli (Single Source of Truth)
// Dashboard Patroli Kesling & K3 RSOMH
// ����������������������������������������������������������������������������������������������������������������������������������������������������������

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
   * Scored Yes/No questions � these drive the % calculation.
   * N/A answers are excluded from denominator.
   */
  questions: QuestionDef[];
  /**
   * Non-scored fields (counts, dates, free text, flags) � displayed as info,
   * not used in % calculation.
   */
  extraFields?: ExtraFieldDef[];
  /** Column header for the photo URL field */
  photoHeader?: string;
  /** Column header for the findings description */
  descriptionHeader?: string;
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

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// A. Dalam Gedung — Bulanan  (6 modul)
// ����������������������������������������������������������������������������������������������������������������������������������������������������������

const PERALATAN_KERJA: ModuleDef = {
  slug: "peralatan-kerja",
  title: "Peralatan Kerja",
  icon: "🔧",
  group: "Dalam Gedung — Bulanan",
  scope: "DALAM_BULANAN",
  questions: [
    {
      sheetHeader:
        "Peralatan Kerja [Peralatan Kerja - Ergonomi]",
      label: "Mobiler ergonomi",
      type: "yntb",
    },
    {
      sheetHeader: "Peralatan Kerja [Peralatan Kerja - Penempatan Teratur dan 5R]",
      label: "Penempatan dan 5R",
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
      label: "Berfungsi baik",
      type: "yntb",
    },
    {
      sheetHeader:
        "Peralatan Medik [Peralatan Medik - Kartu/Label kalibrasi masih berlaku (pilih N/A jika di ruangan tidak terdapat peralatan medik)]",
      label: "Kartu/label kalibrasi berlaku",
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
      sheetHeader: "APAR - Jumlah Apar Powder",
      label: "Jumlah APAR Powder",
      fieldType: "number",
    },
    {
      sheetHeader: "APAR - Jumlah Apar Powder CO2",
      label: "Jumlah APAR CO2",
      fieldType: "number",
    },
    {
      sheetHeader: "APAR - Tanggal pemeliharaan terakhir",
      label: "Tgl. Pemeliharaan Terakhir",
      fieldType: "date",
    },
  ],
  questions: [
    {
      sheetHeader: "APAR  [APAR - Terjangkau]",
      label: "Terjangkau",
      type: "yntb",
    },
    {
      sheetHeader: "APAR  [APAR - Rambu dan SOP terpasang]",
      label: "Rambu dan SOP",
      type: "yntb",
    },
    {
      sheetHeader: "APAR  [APAR - Kartu pemeliharaan terisi]",
      label: "Kartu pemeliharaan terisi",
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
  extraFields: [
    {
      sheetHeader: "Terdapat Hydrant",
      label: "Terdapat Hydrant",
      fieldType: "yn",
    },
  ],
  questions: [
    {
      sheetHeader: "HYDRANT [Hydrant - Box tersedia dan lengkap]",
      label: "Box tersedia dan lengkap",
      type: "yn",
    },
    {
      sheetHeader: "HYDRANT [Hydrant - SOP terpasang]",
      label: "SOP terpasang",
      type: "yn",
    },
    {
      sheetHeader: "HYDRANT [Hydrant - Fire alarm]",
      label: "Fire alarm",
      type: "yn",
    },
    {
      sheetHeader: "HYDRANT [Terdapat kartu pemeliharaan yang masih berlaku]",
      label: "Kartu pemeliharaan berlaku",
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
      sheetHeader:
        "Sarana Proteksi Kebakaran [Sarana Proteksi - Smoke Detector]",
      label: "Smoke Detector",
      type: "yntb",
    },
    {
      sheetHeader:
        "Sarana Proteksi Kebakaran [Sarana Proteksi - Heat Detector]",
      label: "Heat Detector",
      type: "yntb",
    },
    {
      sheetHeader: "Sarana Proteksi Kebakaran [Sarana Proteksi - Sprinkler]",
      label: "Sprinkler",
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
      label: "Jalur evakuasi",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Exit/keluar]",
      label: "Exit/keluar",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Hati-hati terpeleset]",
      label: "Hati-hati terpeleset",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Hati-hati tersandung]",
      label: "Hati-hati tersandung",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Peta evakuasi]",
      label: "Peta evakuasi",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Bis pada anak tangga]",
      label: "Bis pada anak tangga",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Titik kumpul]",
      label: "Titik kumpul",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Dilarang merokok]",
      label: "Dilarang merokok",
      type: "yntb",
    },
    {
      sheetHeader: "Rambu Keselamatan [Rambu - Hemat listrik/air]",
      label: "Hemat listrik/air",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Rambu Keselamatan",
  descriptionHeader:
    "Rambu Keselamatan : Deskripsi singkat (lokasi, kondisi, dan risiko)",
};

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// B. Dalam Gedung — Harian  (8 modul)
// ����������������������������������������������������������������������������������������������������������������������������������������������������������

const ELEKTRIK: ModuleDef = {
  slug: "elektrik",
  title: "Elektrik",
  icon: "⚡",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Elektrik [Elektrik - Perkabelan aman]",
      label: "Perkabelan aman",
      type: "yntb",
    },
    {
      sheetHeader: "Elektrik [Elektrik - Sambungan listrik aman]",
      label: "Sambungan listrik aman",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Elektrik",
  descriptionHeader: "Deskripsi Temuan - Elektrik",
};

const EVAKUASI: ModuleDef = {
  slug: "evakuasi",
  title: "Keamanan Jalur Evakuasi",
  icon: "🚪",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader:
        "Keamanan Jalur Evakuasi [Jalur Evakuasi - Bebas hambatan]",
      label: "Bebas hambatan",
      type: "yntb",
    },
    {
      sheetHeader:
        "Keamanan Jalur Evakuasi [Jalur Evakuasi - Pintu darurat berfungsi]",
      label: "Pintu darurat berfungsi",
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
      sheetHeader:
        "Kelengkapan, Keamanan dan Kebersihan Sarana [Kebersihan - Dinding bersih]",
      label: "Dinding bersih",
      type: "yntb",
    },
    {
      sheetHeader:
        "Kelengkapan, Keamanan dan Kebersihan Sarana [Kebersihan - Pintu/jendela berfungsi]",
      label: "Pintu/jendela berfungsi",
      type: "yntb",
    },
    {
      sheetHeader:
        "Kelengkapan, Keamanan dan Kebersihan Sarana [Kebersihan - Lantai bersih dan rata]",
      label: "Lantai bersih dan rata",
      type: "yntb",
    },
    {
      sheetHeader:
        "Kelengkapan, Keamanan dan Kebersihan Sarana [Kebersihan - Plafon bersih]",
      label: "Plafon bersih",
      type: "yntb",
    },
    {
      sheetHeader:
        "Kelengkapan, Keamanan dan Kebersihan Sarana [Kebersihan - Lampu berfungsi]",
      label: "Lampu berfungsi",
      type: "yntb",
    },
    {
      sheetHeader:
        "Kelengkapan, Keamanan dan Kebersihan Sarana [Kebersihan - Ventilasi tersedia]",
      label: "Ventilasi tersedia",
      type: "yntb",
    },
    {
      sheetHeader:
        "Kelengkapan, Keamanan dan Kebersihan Sarana [Kebersihan - Tidak ada puntung rokok]",
      label: "Tidak ada puntung rokok",
      type: "yntb",
    },
  ],
  photoHeader: "Foto Temuan - Kebersihan Sarana",
  descriptionHeader: "Deskripsi Temuan - Kebersihan Sarana",
};

const RISIKO: ModuleDef = {
  slug: "risiko",
  title: "Risiko Kecelakaan",
  icon: "⚠️",
  group: "Dalam Gedung — Harian",
  scope: "DALAM_HARIAN",
  questions: [
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Anak tangga aman]",
      label: "Anak tangga aman",
      type: "yntb",
    },
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Lantai aman]",
      label: "Lantai aman",
      type: "yntb",
    },
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Jalur Ramp aman]",
      label: "Jalur Ramp aman",
      type: "yntb",
    },
    {
      sheetHeader: "Risiko Kecelakaan  [Risiko - Penempatan alat aman]",
      label: "Penempatan alat aman",
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
      label: "Ketersediaan terpenuhi",
      type: "yntb",
    },
    {
      sheetHeader: "APD [APD - Karyawan menggunakan APD sesuai]",
      label: "Karyawan menggunakan APD sesuai",
      type: "yntb",
    },
  ],
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
      label: "Sampah sesuai label",
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
  extraFields: [
    {
      sheetHeader: "CODE RED -  terdapat Papan Code Red",
      label: "Terdapat Papan Code Red",
      fieldType: "yn",
    },
  ],
  questions: [
    {
      sheetHeader:
        "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Papan Code Red kondisi baik]",
      label: "Papan Code Red kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader:
        "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm merah kondisi baik]",
      label: "Helm merah kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader:
        "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm putih kondisi baik]",
      label: "Helm putih kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader:
        "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm biru kondisi baik]",
      label: "Helm biru kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader:
        "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Helm kuning kondisi baik]",
      label: "Helm kuning kondisi baik",
      type: "yntb",
    },
    {
      sheetHeader:
        "Sarana Proteksi Kebakaran : CODE RED [CODE RED - Papan terisi tanggal dan nama]",
      label: "Papan terisi tanggal dan nama",
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
  questions: [], // No scored questions � log only
  extraFields: [
    {
      sheetHeader: "Sosialisasi - Topik",
      label: "Topik",
      fieldType: "checkbox",
    },
    {
      sheetHeader: "Sosialisasi - Sasaran",
      label: "Sasaran",
      fieldType: "text",
    },
  ],
  photoHeader: "Foto Temuan - Keluhan",
  descriptionHeader: "Deskripsi Temuan - Keluhan",
  logOnly: true,
};

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// C. Jalur Khusus  (3 modul)
// ����������������������������������������������������������������������������������������������������������������������������������������������������������

const PCRA: ModuleDef = {
  slug: "pcra",
  title: "PCRA",
  icon: "🚧",
  group: "Lainnya",
  scope: "PCRA",
  extraFields: [
    {
      sheetHeader: "PCRA - Lokasi dan deskripsi pekerjaan",
      label: "Lokasi & Deskripsi Pekerjaan",
      fieldType: "text",
    },
  ],
  questions: [
    {
      sheetHeader: "PCRA [PCRA - Sosialisasi K3 dari kontraktor]",
      label: "Sosialisasi K3 dari kontraktor",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Pekerja menggunakan APD lengkap]",
      label: "Pekerja menggunakan APD lengkap",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Pembatasan area (barrier)]",
      label: "Pembatasan area (barrier)",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Rambu keselamatan terpasang]",
      label: "Rambu keselamatan terpasang",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Tidak ada pekerja merokok]",
      label: "Tidak ada pekerja merokok",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Tempat material rapi dan bersih]",
      label: "Tempat material rapi dan bersih",
      type: "yntb",
    },
    {
      sheetHeader: "PCRA [PCRA - Pembersihan sisa pekerjaan]",
      label: "Pembersihan sisa pekerjaan",
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
      sheetHeader: "APAR Luar -  Jumlah APAR Powder 6 kg",
      label: "Jumlah APAR Powder 6 kg",
      fieldType: "number",
    },
    {
      sheetHeader: "APAR Luar -  Jumlah APAR Powder 25 kg",
      label: "Jumlah APAR Powder 25 kg",
      fieldType: "number",
    },
    {
      sheetHeader: "APAR Luar -  Jumlah APAR CO2",
      label: "Jumlah APAR CO2",
      fieldType: "number",
    },
    {
      sheetHeader: "APAR Luar - Tanggal pemeliharaan terakhir",
      label: "Tgl. Pemeliharaan Terakhir",
      fieldType: "date",
    },
  ],
  questions: [
    {
      sheetHeader: "Luar Gedung : APAR [APAR Luar - Terjangkau]",
      label: "APAR Terjangkau",
      type: "yntb",
    },
    {
      sheetHeader: "Luar Gedung : APAR [APAR Luar - Rambu dan SOP]",
      label: "Rambu dan SOP",
      type: "yntb",
    },
    {
      sheetHeader:
        "Luar Gedung : APAR [APAR Luar - Kartu pemeliharaan terisi]",
      label: "Kartu pemeliharaan terisi",
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
      sheetHeader: "B3 - Jumlah Lemari ",
      label: "Jumlah Lemari B3",
      fieldType: "number",
    },
    {
      sheetHeader: "B3 - Jumlah Eyewasher",
      label: "Jumlah Eyewasher",
      fieldType: "number",
    },
    {
      sheetHeader: "B3 - Jumlah Bodywasher",
      label: "Jumlah Bodywasher",
      fieldType: "number",
    },
  ],
  questions: [
    {
      sheetHeader: "B3 [B3 - Penyimpanan B3]",
      label: "Penyimpanan B3",
      type: "yntb",
    },
    {
      sheetHeader: "B3 [B3 - Ketersediaan SDS]",
      label: "Ketersediaan SDS",
      type: "yntb",
    },
    {
      sheetHeader: "B3 [B3 - Ketersediaan Spill Kit]",
      label: "Ketersediaan Spill Kit",
      type: "yntb",
    },
    {
      sheetHeader: "B3 [B3 - Kelengkapan Spill Kit]",
      label: "Kelengkapan Spill Kit",
      type: "yntb",
    },
    {
      sheetHeader: "  B3 - Eyewasher berfungsi baik  ",
      label: "Eyewasher berfungsi baik",
      type: "yntb",
    },
    {
      sheetHeader: "  B3 - Bodywasher berfungsi baik  ",
      label: "Bodywasher berfungsi baik",
      type: "yntb",
    },
  ],
  badgeHeader: "B3 - Sub-Unit Bermasalah ",
  photoHeader: "Foto Temuan - B3",
  descriptionHeader: "Deskripsi Temuan - B3",
};

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// Master list � ORDER MATTERS (determines sidebar order)
// ����������������������������������������������������������������������������������������������������������������������������������������������������������

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


