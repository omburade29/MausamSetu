"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const dictionaries = {
  en: {
    appTitle: "MausamSetu",
    shortTitle: "MausamSetu",
    disclaimer: "Model-generated estimates. Not official IMD forecasts.",
    dashboard: "Dashboard",
    map: "Map",
    forecast: "Compare",
    advisories: "Advisories",
    performance: "Model performance",
    data: "Data",
    models: "Models",
    reports: "Reports",
    admin: "Administration",
    login: "Sign in",
    logout: "Sign out",
    register: "Create account",
    state: "State",
    district: "District",
    block: "Block",
    panchayat: "Panchayat",
    date: "Date",
    rainfall: "Rainfall",
    tempMin: "Minimum temperature",
    tempMax: "Maximum temperature",
    humidity: "Relative humidity",
    wind: "Wind speed",
    windDir: "Wind direction",
    cloud: "Cloud cover",
    pop: "Probability of rain",
    confidence: "Confidence",
    uncertainty: "Uncertainty interval",
    loading: "Loading",
    empty: "Nothing to show yet",
    error: "Something went wrong",
    retry: "Try again",
    lowConfidence: "Low confidence",
    moderateConfidence: "Moderate confidence",
    higherConfidence: "Higher confidence",
    unavailable: "Unavailable",
    normal: "Normal",
    watch: "Watch",
    warning: "Warning",
    severe: "Severe",
    blockForecast: "Block forecast",
    downscaled: "Downscaled estimate",
    observed: "Observed",
    historical: "Historical average",
    difference: "Downscaled minus block",
  },
  mr: {
    appTitle: "MausamSetu",
    shortTitle: "MausamSetu",
    disclaimer: "हे मॉडेलने तयार केलेले अंदाज आहेत. अधिकृत IMD अंदाज नाहीत.",
    dashboard: "डॅशबोर्ड",
    map: "नकाशा",
    forecast: "तुलना",
    advisories: "कृषी सल्ला",
    performance: "मॉडेल कामगिरी",
    data: "माहिती",
    models: "मॉडेल",
    reports: "अहवाल",
    admin: "प्रशासन",
    login: "प्रवेश",
    logout: "बाहेर पडा",
    register: "नोंदणी",
    state: "राज्य",
    district: "जिल्हा",
    block: "ब्लॉक",
    panchayat: "पंचायत",
    date: "दिनांक",
    rainfall: "पर्जन्य",
    tempMin: "किमान तापमान",
    tempMax: "कमाल तापमान",
    humidity: "सापेक्ष आर्द्रता",
    wind: "वाऱ्याचा वेग",
    windDir: "वाऱ्याची दिशा",
    cloud: "ढग आवरण",
    pop: "पावसाची शक्यता",
    confidence: "विश्वासार्हता",
    uncertainty: "अनिश्चितता पट्टी",
    loading: "लोड होत आहे",
    empty: "अजून माहिती नाही",
    error: "काहीतरी चुकले",
    retry: "पुन्हा प्रयत्न करा",
    lowConfidence: "कमी विश्वासार्हता",
    moderateConfidence: "मध्यम विश्वासार्हता",
    higherConfidence: "जास्त विश्वासार्हता",
    unavailable: "उपलब्ध नाही",
    normal: "सामान्य",
    watch: "लक्ष द्या",
    warning: "इशारा",
    severe: "तीव्र इशारा",
    blockForecast: "ब्लॉक अंदाज",
    downscaled: "डाउनस्केल अंदाज",
    observed: "निरीक्षण",
    historical: "ऐतिहासिक सरासरी",
    difference: "डाउनस्केल वजा ब्लॉक",
  },
} as const;

export type Locale = keyof typeof dictionaries;
export type MessageKey = keyof (typeof dictionaries)["en"];

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
} | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem("locale");
    if (stored === "mr" || stored === "en") setLocaleState(stored);
  }, []);
  const value = useMemo(() => {
    const setLocale = (next: Locale) => {
      setLocaleState(next);
      window.localStorage.setItem("locale", next);
      document.documentElement.lang = next === "mr" ? "mr" : "en";
    };
    return { locale, setLocale, t: (key: MessageKey) => dictionaries[locale][key] };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
