import { HeadphoneProfile } from "../types/audio";

export const HEADPHONE_PROFILES: HeadphoneProfile[] = [
  {
    id: "flat",
    name: "Sin Calibración (Plano / Bypass)",
    brand: "Genérico",
    type: "Over-Ear",
    filters: []
  },
  {
    id: "hyperx_cloud_2",
    name: "Cloud II / Cloud Alpha",
    brand: "HyperX",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 62 Hz Gain -2.8 dB Q 1.41",
      "Filter: ON PK Fc 220 Hz Gain -1.9 dB Q 0.85",
      "Filter: ON PK Fc 3300 Hz Gain 4.2 dB Q 2.10",
      "Filter: ON PK Fc 5900 Hz Gain -4.8 dB Q 3.20"
    ]
  },
  {
    id: "logitech_g_pro_x",
    name: "G Pro X / G Pro X 2 Lightspeed",
    brand: "Logitech",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 80 Hz Gain -3.2 dB Q 1.10",
      "Filter: ON PK Fc 240 Hz Gain -2.4 dB Q 0.90",
      "Filter: ON PK Fc 2800 Hz Gain 3.8 dB Q 1.80",
      "Filter: ON PK Fc 6200 Hz Gain -3.5 dB Q 2.60"
    ]
  },
  {
    id: "epos_pc38x",
    name: "PC38X / Game Zero",
    brand: "Sennheiser / EPOS",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 110 Hz Gain -1.5 dB Q 1.20",
      "Filter: ON PK Fc 3000 Hz Gain 2.1 dB Q 1.50",
      "Filter: ON PK Fc 5500 Hz Gain -2.2 dB Q 2.00"
    ]
  },
  {
    id: "beyerdynamic_dt770_80",
    name: "DT 770 Pro (80 Ohm)",
    brand: "Beyerdynamic",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 95 Hz Gain -3.6 dB Q 0.90",
      "Filter: ON PK Fc 220 Hz Gain -2.1 dB Q 1.40",
      "Filter: ON PK Fc 5900 Hz Gain -5.8 dB Q 3.50",
      "Filter: ON PK Fc 8400 Hz Gain -4.2 dB Q 4.00"
    ]
  },
  {
    id: "beyerdynamic_dt990_pro",
    name: "DT 990 Pro (250 Ohm)",
    brand: "Beyerdynamic",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 120 Hz Gain -2.0 dB Q 1.00",
      "Filter: ON PK Fc 5800 Hz Gain -6.5 dB Q 3.80",
      "Filter: ON PK Fc 8200 Hz Gain -5.0 dB Q 3.20"
    ]
  },
  {
    id: "ath_m50x",
    name: "ATH-M50x",
    brand: "Audio-Technica",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 180 Hz Gain -4.2 dB Q 0.80",
      "Filter: ON PK Fc 380 Hz Gain 2.0 dB Q 1.60",
      "Filter: ON PK Fc 9200 Hz Gain -4.5 dB Q 3.00"
    ]
  },
  {
    id: "steelseries_nova_pro",
    name: "Arctis Nova Pro / Arctis 7",
    brand: "SteelSeries",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 130 Hz Gain -2.5 dB Q 1.20",
      "Filter: ON PK Fc 3100 Hz Gain 3.5 dB Q 2.00",
      "Filter: ON PK Fc 6400 Hz Gain -3.8 dB Q 2.80"
    ]
  },
  {
    id: "razer_blackshark_v2",
    name: "BlackShark V2 / V2 Pro",
    brand: "Razer",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 140 Hz Gain -3.8 dB Q 0.95",
      "Filter: ON PK Fc 1800 Hz Gain 2.5 dB Q 1.50",
      "Filter: ON PK Fc 4200 Hz Gain -3.2 dB Q 2.40"
    ]
  },
  {
    id: "astro_a40_tr",
    name: "Astro A40 TR / A50",
    brand: "Astro Gaming",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 115 Hz Gain -3.0 dB Q 1.10",
      "Filter: ON PK Fc 2500 Hz Gain 3.0 dB Q 1.70",
      "Filter: ON PK Fc 7100 Hz Gain -4.0 dB Q 3.00"
    ]
  },
  {
    id: "apple_earpods",
    name: "EarPods (3.5mm Jack)",
    brand: "Apple",
    type: "IEM",
    filters: [
      "Filter: ON PK Fc 75 Hz Gain 4.5 dB Q 0.90",
      "Filter: ON PK Fc 2100 Hz Gain -3.5 dB Q 1.60",
      "Filter: ON PK Fc 5200 Hz Gain 3.0 dB Q 2.20"
    ]
  },
  {
    id: "truthear_zero_red",
    name: "x Crinacle ZERO: RED",
    brand: "Truthear",
    type: "IEM",
    filters: [
      "Filter: ON PK Fc 150 Hz Gain -1.2 dB Q 1.20",
      "Filter: ON PK Fc 3100 Hz Gain 1.8 dB Q 1.80",
      "Filter: ON PK Fc 6000 Hz Gain -2.0 dB Q 2.50"
    ]
  },
  {
    id: "moondrop_chu_2",
    name: "Chu II / Aria",
    brand: "Moondrop",
    type: "IEM",
    filters: [
      "Filter: ON PK Fc 200 Hz Gain -1.8 dB Q 1.10",
      "Filter: ON PK Fc 2800 Hz Gain -2.2 dB Q 2.00",
      "Filter: ON PK Fc 6500 Hz Gain -3.0 dB Q 2.50"
    ]
  },
  {
    id: "tangzu_waner",
    name: "Wan'er S.G",
    brand: "Tangzu",
    type: "IEM",
    filters: [
      "Filter: ON PK Fc 120 Hz Gain -1.5 dB Q 1.00",
      "Filter: ON PK Fc 3200 Hz Gain 2.0 dB Q 1.60",
      "Filter: ON PK Fc 5800 Hz Gain -2.5 dB Q 2.20"
    ]
  },
  {
    id: "sennheiser_hd560s",
    name: "HD 560S / HD 599",
    brand: "Sennheiser",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 50 Hz Gain 3.5 dB Q 0.80",
      "Filter: ON PK Fc 1400 Hz Gain -1.5 dB Q 1.80",
      "Filter: ON PK Fc 4500 Hz Gain -2.8 dB Q 2.50"
    ]
  },
  {
    id: "sennheiser_hd600",
    name: "HD 600 / HD 650 / HD 6XX",
    brand: "Sennheiser",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 45 Hz Gain 4.8 dB Q 0.70",
      "Filter: ON PK Fc 3200 Hz Gain -2.0 dB Q 2.20"
    ]
  },
  {
    id: "corsair_hs80",
    name: "HS80 RGB Wireless",
    brand: "Corsair",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 110 Hz Gain -3.4 dB Q 1.10",
      "Filter: ON PK Fc 2600 Hz Gain 3.2 dB Q 1.80",
      "Filter: ON PK Fc 7000 Hz Gain -4.1 dB Q 3.00"
    ]
  },
  {
    id: "sony_wh1000xm4",
    name: "WH-1000XM4 / XM5 (Modo Cable)",
    brand: "Sony",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 160 Hz Gain -5.5 dB Q 0.75",
      "Filter: ON PK Fc 1100 Hz Gain 2.8 dB Q 1.40",
      "Filter: ON PK Fc 6800 Hz Gain -4.2 dB Q 2.80"
    ]
  },
  {
    id: "iem_harman_generic",
    name: "Cualquier IEM (Compensación Harman)",
    brand: "Genérico",
    type: "IEM",
    filters: [
      "Filter: ON PK Fc 200 Hz Gain -1.5 dB Q 1.00",
      "Filter: ON PK Fc 2800 Hz Gain 2.0 dB Q 1.50",
      "Filter: ON PK Fc 6000 Hz Gain -2.5 dB Q 2.00"
    ]
  },
  {
    id: "headset_harman_generic",
    name: "Auricular Cerrado Genérico",
    brand: "Genérico",
    type: "Over-Ear",
    filters: [
      "Filter: ON PK Fc 150 Hz Gain -2.5 dB Q 0.90",
      "Filter: ON PK Fc 3000 Hz Gain 2.5 dB Q 1.60",
      "Filter: ON PK Fc 6000 Hz Gain -3.0 dB Q 2.20"
    ]
  }
];
