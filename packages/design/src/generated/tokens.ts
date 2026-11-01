// Trace Console: generated from source/tokens.json by scripts/generate. Do not edit.

export const themeIds = ["night","day"] as const;
export type ThemeId = (typeof themeIds)[number];

export const themes = {
  night: {
    name: "לילה",
    color: {
      /** רקע מאחורי אריחי המפה, נראה רק לפני שהאריחים נטענו. לילה: מפת בסיס כהה; יום: מפת בסיס בהירה. */
      mapGround: "#1e2024",
      /** כל פאנל צף: סרגל עליון, רשימת מחפשים, Inspector, סרגל כלי מפה, תגיות פוליגון במפה. */
      surface: "#16181b",
      /** שדות קלט, תיבת חיפוש, מסילת SegmentedTabs. תמיד בתוך surface. */
      surfaceSunken: "#0e1012",
      /** לשונית נבחרת, כלי מפה פעיל, שורה נבחרת, אווטאר ומקום-תמונה. */
      surfaceRaised: "#2a2d32",
      /** מצב hover של שורות וכפתורים שקופים; גם רקע בורר המסע בסרגל העליון. */
      surfaceHover: "rgba(255,255,255,0.05)",
      /** רקע CallsignChip במצב רגיל. */
      chip: "#23262a",
      /** גבול חיצוני של פאנל צף ושל שדה חיפוש. */
      border: "rgba(255,255,255,0.08)",
      /** מפרידים בין מקטעים בתוך פאנל. */
      borderSubtle: "rgba(255,255,255,0.06)",
      /** גבול כפתור משני ו-kbd. הגבול לבדו לא עומד ב-3:1; הכפתור מזוהה בזכות התווית שלו. שדות קלט משתמשים ב-border-field. */
      borderStrong: "rgba(255,255,255,0.12)",
      /** גבול שדה קלט וחיפוש. לפחות ‎3:1 מול surface ומול surface-sunken בשתי הערכות (‎4.5 לילה, ‎4.4 יום מול sunken). */
      borderField: "#7a8087",
      /** מסילה של מד כיסוי וסוללה. */
      track: "rgba(255,255,255,0.08)",
      /** טקסט ראשי על surface, surface-sunken ו-surface-raised. ‎15:1 ומעלה בשתי הערכות. */
      ink: "#e6e8eb",
      /** טקסט משני: תיאור נעדר, לשוניות לא נבחרות, אייקוני כלים. על surface: ‎8.6:1 לילה, ‎10.4:1 יום. */
      inkSecondary: "#a9aeb5",
      /** תוויות, שורות-משנה, זמנים, אחוזים. על surface: ‎6.4:1 לילה, ‎6.0:1 יום. על surface-raised: ‎5.0:1 לילה, ‎4.8:1 יום. */
      inkMuted: "#979ca3",
      /** סימנים לא-טקסטואליים בלבד: LKP היסטורי, קווי עזר. לא לטקסט רץ (מתחת ל-4.5:1). */
      inkFaint: "#6f747b",
      /** הצבע היחיד שאינו מצב: בחירה, פוליגון פעיל, סמן מחפש בחיפוש, מסלולים, קישורים, מד כיסוי. כטקסט על surface: ‎8:1 לילה, ‎7:1 יום. */
      accent: "#7eb0ff",
      /** טבעת פוקוס 2px מלאה עם היסט 2px על כל רכיב אינטראקטיבי. */
      focus: "#7eb0ff",
      /** מילוי הכפתור הראשי היחיד במסך (למשל 'הנעדר אותר', 'התקשר' ב-Inspector). */
      primary: "#e6e8eb",
      /** טקסט על primary. */
      onPrimary: "#0e1012",
      /** מסע פעיל (נקודה), נקודת כינוס, מחובר. תמיד עם מילה לצדו. כטקסט: ‎6.7:1 לילה, ‎6.7:1 יום על surface (5.3 על raised ביום). */
      success: "#5db06a",
      /** מחוץ לגבול, סוללה נמוכה, לא מקוון, GPS חלש. גם כטקסט, על surface ועל surface-raised: ‎8.3:1 לילה (6.4 על raised), ‎6.2:1 יום (4.9 על raised). */
      warning: "#e0a73a",
      /** SOS בלבד ופעולות הרסניות. מילוי של תגית SOS, CallsignChip ב-SOS וכפתור 'התקשר' בהתראה. */
      danger: "#f26b5e",
      /** טקסט על danger. בלילה כהה (הסמן בהיר), ביום לבן. */
      onDanger: "#1a0a08",
      /** טקסט SOS בתוך רשימות ו-Inspector, על surface או danger-tint. */
      dangerInk: "#f59b91",
      /** פרטי ההתראה בתוך AlertBanner, על danger-surface. */
      dangerInkSoft: "#f5b7b0",
      /** רקע AlertBanner של SOS. */
      dangerSurface: "#2a1312",
      /** גבול AlertBanner, גבול פנימי של שורת SOS וכפתור משני בהתראה. */
      dangerBorder: "rgba(242,107,94,0.45)",
      /** רקע שורת מחפש ב-SOS ברשימה. */
      dangerTint: "rgba(242,107,94,0.12)",
      /** שמות נחלים ומקורות מים על המפה. */
      water: "#5b8fad",
      /** קו מתאר 2px סביב כל סמן מפה, כדי שיופרד ממפת הבסיס. */
      mapHalo: "#0e1012",
    },
    shadow: {
      /** הצל היחיד במערכת: פאנלים צפים מעל המפה. */
      shadowPanel: "0 8px 24px rgba(0,0,0,0.35)",
    },
  },
  day: {
    name: "יום",
    color: {
      /** רקע מאחורי אריחי המפה, נראה רק לפני שהאריחים נטענו. לילה: מפת בסיס כהה; יום: מפת בסיס בהירה. */
      mapGround: "#eceae4",
      /** כל פאנל צף: סרגל עליון, רשימת מחפשים, Inspector, סרגל כלי מפה, תגיות פוליגון במפה. */
      surface: "#ffffff",
      /** שדות קלט, תיבת חיפוש, מסילת SegmentedTabs. תמיד בתוך surface. */
      surfaceSunken: "#eef0f2",
      /** לשונית נבחרת, כלי מפה פעיל, שורה נבחרת, אווטאר ומקום-תמונה. */
      surfaceRaised: "#e3e6ea",
      /** מצב hover של שורות וכפתורים שקופים; גם רקע בורר המסע בסרגל העליון. */
      surfaceHover: "rgba(0,0,0,0.04)",
      /** רקע CallsignChip במצב רגיל. */
      chip: "#eef0f2",
      /** גבול חיצוני של פאנל צף ושל שדה חיפוש. */
      border: "rgba(0,0,0,0.12)",
      /** מפרידים בין מקטעים בתוך פאנל. */
      borderSubtle: "rgba(0,0,0,0.08)",
      /** גבול כפתור משני ו-kbd. הגבול לבדו לא עומד ב-3:1; הכפתור מזוהה בזכות התווית שלו. שדות קלט משתמשים ב-border-field. */
      borderStrong: "rgba(0,0,0,0.18)",
      /** גבול שדה קלט וחיפוש. לפחות ‎3:1 מול surface ומול surface-sunken בשתי הערכות (‎4.5 לילה, ‎4.4 יום מול sunken). */
      borderField: "#6a7076",
      /** מסילה של מד כיסוי וסוללה. */
      track: "rgba(0,0,0,0.12)",
      /** טקסט ראשי על surface, surface-sunken ו-surface-raised. ‎15:1 ומעלה בשתי הערכות. */
      ink: "#15171a",
      /** טקסט משני: תיאור נעדר, לשוניות לא נבחרות, אייקוני כלים. על surface: ‎8.6:1 לילה, ‎10.4:1 יום. */
      inkSecondary: "#3c4043",
      /** תוויות, שורות-משנה, זמנים, אחוזים. על surface: ‎6.4:1 לילה, ‎6.0:1 יום. על surface-raised: ‎5.0:1 לילה, ‎4.8:1 יום. */
      inkMuted: "#5f6368",
      /** סימנים לא-טקסטואליים בלבד: LKP היסטורי, קווי עזר. לא לטקסט רץ (מתחת ל-4.5:1). */
      inkFaint: "#80868b",
      /** הצבע היחיד שאינו מצב: בחירה, פוליגון פעיל, סמן מחפש בחיפוש, מסלולים, קישורים, מד כיסוי. כטקסט על surface: ‎8:1 לילה, ‎7:1 יום. */
      accent: "#1a56b8",
      /** טבעת פוקוס 2px מלאה עם היסט 2px על כל רכיב אינטראקטיבי. */
      focus: "#1a56b8",
      /** מילוי הכפתור הראשי היחיד במסך (למשל 'הנעדר אותר', 'התקשר' ב-Inspector). */
      primary: "#15171a",
      /** טקסט על primary. */
      onPrimary: "#ffffff",
      /** מסע פעיל (נקודה), נקודת כינוס, מחובר. תמיד עם מילה לצדו. כטקסט: ‎6.7:1 לילה, ‎6.7:1 יום על surface (5.3 על raised ביום). */
      success: "#27692b",
      /** מחוץ לגבול, סוללה נמוכה, לא מקוון, GPS חלש. גם כטקסט, על surface ועל surface-raised: ‎8.3:1 לילה (6.4 על raised), ‎6.2:1 יום (4.9 על raised). */
      warning: "#8f5300",
      /** SOS בלבד ופעולות הרסניות. מילוי של תגית SOS, CallsignChip ב-SOS וכפתור 'התקשר' בהתראה. */
      danger: "#c62828",
      /** טקסט על danger. בלילה כהה (הסמן בהיר), ביום לבן. */
      onDanger: "#ffffff",
      /** טקסט SOS בתוך רשימות ו-Inspector, על surface או danger-tint. */
      dangerInk: "#b3261e",
      /** פרטי ההתראה בתוך AlertBanner, על danger-surface. */
      dangerInkSoft: "#8c1d18",
      /** רקע AlertBanner של SOS. */
      dangerSurface: "#fdecea",
      /** גבול AlertBanner, גבול פנימי של שורת SOS וכפתור משני בהתראה. */
      dangerBorder: "rgba(198,40,40,0.35)",
      /** רקע שורת מחפש ב-SOS ברשימה. */
      dangerTint: "rgba(198,40,40,0.07)",
      /** שמות נחלים ומקורות מים על המפה. */
      water: "#2f6e9e",
      /** קו מתאר 2px סביב כל סמן מפה, כדי שיופרד ממפת הבסיס. */
      mapHalo: "#ffffff",
    },
    shadow: {
      /** הצל היחיד במערכת: פאנלים צפים מעל המפה. */
      shadowPanel: "0 4px 16px rgba(0,0,0,0.12)",
    },
  },
} as const;

export type Theme = (typeof themes)[ThemeId];
export type ColorToken = keyof Theme['color'];

export const spacing = {
  /** רווח בין כפתורים בסרגל כלי המפה. */
  space1: 2,
  /** ריפוד פנימי של סרגל כלים; רווח בין אייקון לטקסט קטן. */
  space2: 4,
  /** רווח בין כפתורים בקבוצה. */
  space3: 6,
  /** ריפוד אופקי של שורת רשימה; רווח בתוך שורה. */
  space4: 8,
  /** רווח בין צ'יפ לטקסט; ריפוד שדה חיפוש. */
  space5: 10,
  /** מרווח בין פאנל צף לקצה המסך ובין פאנלים; ריפוד אנכי במקטע. */
  space6: 12,
  /** ריפוד אופקי של מקטע בפאנל. */
  space7: 14,
} as const;

export const radius = {
  /** CallsignChip, תגית SOS, kbd, תגיות פוליגון במפה. */
  radiusSm: 4,
  /** כפתורים, שדות, שורות רשימה, לשוניות. */
  radiusMd: 6,
  /** מסילת SegmentedTabs, ערימת זום. */
  radiusLg: 8,
  /** כל פאנל צף ו-AlertBanner. */
  radiusXl: 10,
} as const;

export const size = {
  /** גובה הסרגל העליון. */
  headerH: 48,
  /** גובה כפתור, שדה חיפוש וכפתור כלי. */
  controlH: 34,
  /** כפתורים בתוך AlertBanner. */
  controlHSm: 30,
  /** גובה לשונית ב-SegmentedTabs. */
  segmentH: 28,
  /** רוחב פאנל המחפשים בצד ההתחלה (ימין). */
  panelStartW: 330,
  /** רוחב ה-Inspector בצד הסוף (שמאל). */
  panelEndW: 310,
} as const;

/** `css`: full stack for the web. `native`: the first family, for React Native `fontFamily`. */
export const fontFamilies = {
  sans: { css: "\"Noto Sans Hebrew\", Arial, sans-serif", native: "Noto Sans Hebrew" },
} as const;

export const typography = {
  /** שם בראש פאנל או Inspector; שם המוצר בסרגל העליון. */
  title: { fontFamily: fontFamilies.sans.native, fontSize: 14, lineHeight: 20, fontWeight: 600 },
  /** ברירת המחדל לכל טקסט בממשק. */
  body: { fontFamily: fontFamilies.sans.native, fontSize: 13, lineHeight: 19, fontWeight: 400 },
  /** שם בשורת התראה, לשונית נבחרת, טקסט כפתור ראשי. */
  bodyStrong: { fontFamily: fontFamilies.sans.native, fontSize: 13, lineHeight: 19, fontWeight: 600 },
  /** כותרות-משנה, כותרת קבוצת פוליגון, תוויות מקטע. */
  meta: { fontFamily: fontFamilies.sans.native, fontSize: 12, lineHeight: 17, fontWeight: 400 },
  /** שורת מצב מתחת לשם מחפש, dt ב-Inspector, שורת קואורדינטות. */
  caption: { fontFamily: fontFamilies.sans.native, fontSize: 11.5, lineHeight: 16, fontWeight: 400 },
  /** מספר מחפש בתוך CallsignChip ו-kbd. */
  callsign: { fontFamily: fontFamilies.sans.native, fontSize: 11, lineHeight: 14, fontWeight: 700 },
  /** תגיות ותוויות על המפה (בקנה מידה 1:1 של המפה). לא קטן מ-11px: נקרא בשמש. */
  mapLabel: { fontFamily: fontFamilies.sans.native, fontSize: 11, lineHeight: 13, fontWeight: 600 },
} as const;
