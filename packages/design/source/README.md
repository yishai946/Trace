Trace Console היא שפת הממשק של TRACE Command: מערכת שליטה ובקרה לחיפוש נעדרים. המסך המרכזי הוא מפה מקצה לקצה, ומעליה פאנלים צפים. המטרה היא שמנהל מסע יבין במבט אחד איפה כל מחפש, מה מצב כל פוליגון ומה דורש תגובה עכשיו, בלילה בחמ"ל ובצהריים בשמש.

## עקרונות

- **המפה היא המסך.** אין מסגרות שמחלקות את המסך. כל ממשק אחר צף מעל המפה במרווח `space-6` מהקצה, ומשאיר את מרכז המפה פנוי.
- **צבע רק כשהוא אומר משהו.** הממשק אפור-ניטרלי. `accent` מסמן בחירה ופעילות, ו-`success`, `warning` ו-`danger` מסמנים מצבים. אין צבע לקישוט.
- **מספר לכל מחפש.** כל מחפש מזוהה במספר דו-ספרתי (`07`) בכל מקום: במפה, ברשימה, בהתראה וב-Inspector. השם מופיע לצד המספר, לא במקומו.
- **צפוף, לא דחוס.** טקסט בסיס 13px, שורות של 34px, ספרות טבלאיות. המידע נכנס במסך אחד בלי גלילה ברוב המסעות.
- **שתי ערכות שוות.** `night` לחמ"ל ולעבודה לילית, `day` לשמש ישירה. כל רכיב נבדק בשתיהן, וערכת היום מקבלת צבעים כהים ורוויים יותר ולא היפוך פשוט.

## תוכן וניסוח

- עברית, פנייה ישירה וקצרה. פעלים בכפתורים: "התקשר", "השהה", "הנעדר אותר", "שבץ". לא "לחץ כאן".
- זמנים: שעה מלאה לאירועים (`16:58`), זמן יחסי למצב חי ("לפני 20 שנ׳", "לא מקוון 9 דק׳").
- אין נקודה אמצעית בין נתונים. מצב במילה אחת, והזמן היחסי או הפרט בעמודה נפרדת בצבע `ink-muted` בקצה השורה. בסרגל העליון כל נתון ברווח משלו.
- מונחי מקצוע נשארים כפי שהצוות אומר אותם: LKP, SOS, GPS, Coverage באנגלית. "פוליגון" ולא "אזור", "כינוס" ולא "Rally".
- בלי אימוג'י. בלי סימני קריאה. התראה כתובה כעובדה: "03 מיכל רז מחוץ לפוליגון A".
- מספרים, קואורדינטות וקודים (`K7-4Q2`, `31.7431, 35.0127`) נכתבים בכיוון LTR בתוך הטקסט העברי.

## צבע

- רקע: `map-ground` רק מאחורי המפה. כל פאנל הוא `surface`, ושדות ומסילות בתוכו הם `surface-sunken`. פריט נבחר או לשונית פעילה מקבלים `surface-raised`.
- טקסט: `ink` לראשי, `ink-secondary` לתיאור, `ink-muted` לתוויות, זמנים ואחוזים. `ink-faint` לסימנים בלבד, אף פעם לא לטקסט.
- `accent` (כחול) הוא הצבע היחיד שאינו מצב: פוליגון פעיל, סמן מחפש, מסלול, מד כיסוי, קישור ופוקוס.
- מצבים: `warning` למחוץ לגבול, סוללה נמוכה ולא מקוון. `danger` ל-SOS בלבד. `success` למסע פעיל, מחובר ונקודת כינוס. כל מצב מופיע תמיד גם במילה ("SOS", "מחוץ לגבול"), לא בצבע לבד. נקודת סטטוס מופיעה רק ליד שם המסע. באירועים, חומרה מסומנת באייקון קו ובמילה.
- כפתור `primary` אחד בכל אזור: "הנעדר אותר" בסרגל העליון, "התקשר" ב-Inspector. כל השאר משניים.
- ניגודיות: כל זוג טקסט עומד ב-4.5:1 על `surface` ועל `surface-raised` (שורה נבחרת, לשונית פעילה) בשתי הערכות. הערכים בהערות הטוקנים.
- גבול שדה קלט וחיפוש הוא `border-field`, לפחות 3:1 מול `surface` ומול `surface-sunken`. `border-strong` נשאר לכפתורים, שמזוהים בתווית שלהם.

## טיפוגרפיה

- משפחה אחת: Noto Sans Hebrew (`sans`), עם `font-variant-numeric: tabular-nums` בכל מקום שמספרים מסתדרים בעמודה.
- `body` 13px לכל הממשק. `title` 14px לשם בראש פאנל. `meta` 12px לכותרת קבוצה ולתוויות מקטע. `caption` 11.5px לשורת מצב מתחת לשם. `callsign` 11px bold למספר מחפש. `map-label` 11px לתגיות על המפה. אין טקסט פונקציונלי קטן מ-11px.
- אין כותרות גדולות. ההיררכיה נבנית ממשקל (400/600/700) ומצבע (`ink` מול `ink-muted`), לא מגודל.

## ריווח, רדיוס וצל

- סולם ריווח: `space-1` 2px עד `space-7` 14px. הצעדים של 2px הם חריג מתועד מסולם 4px: הצפיפות של הממשק דורשת אותם. אין ערכי ריווח מחוץ לסולם. פאנל: ריפוד `space-6` אנכי ו-`space-7` אופקי. שורת רשימה: `space-4`.
- רדיוס לפי תפקיד: `radius-sm` לצ'יפים ותגיות, `radius-md` לכפתורים ושורות, `radius-lg` למסילת לשוניות, `radius-xl` לפאנל צף.
- צל אחד בלבד, `shadow-panel`, ורק לפאנלים שצפים מעל המפה. בתוך פאנל מפרידים עם `border-subtle`, לא עם צל.
- רוחבים קבועים: פאנל מחפשים `panel-start-w` בצד ימין, Inspector `panel-end-w` בצד שמאל, סרגל עליון `header-h`.

## פריסה

- סרגל עליון צף לכל הרוחב: מותג, בורר מסע, זמן וקוד הצטרפות, חיפוש ופקודות (Ctrl K) באמצע, פעולות מסע בסוף.
- צד ההתחלה (ימין): כרטיס נעדר, לשוניות "מחפשים / אירועים / דיווחים" ורשימת מחפשים מקובצת לפי פוליגון.
- צד הסוף (שמאל): Inspector של הפריט שנבחר. כשלא נבחר דבר, הוא מציג אירועים פתוחים.
- התראת SOS צפה בראש המפה בין שני הפאנלים. סרגל כלי מפה צף במרכז התחתון, וזום ושורת קואורדינטות בפינות.

## מפה

- מפת בסיס טופוגרפית: כהה בערכת `night`, בהירה בערכת `day`. רשת ITM, קווי גובה, נחלים בצבע `water`.
- פוליגון פעיל: מילוי `accent` שקוף וקו מלא. הושלם: `ink-muted`. לא משובץ: קו מקווקו `ink` בלי מילוי. לכל פוליגון תגית `surface` עם אות ואחוז כיסוי.
- סמני מחפשים: עיגול 10px עם `map-halo`, והמספר לצדו. SOS מקבל טבעת `danger`, מחוץ לגבול `warning`, ולא מקוון עיגול מקווקו.
- LKP: כוונת `ink` עם תווית שעה בצבע מלא. LKP קודם מופיע בטבעת `ink-faint`. תצפית: מעוין. כינוס: דגל `success`.

## אייקונים

- קו בעובי 1.8px, 16px, בצבע `currentColor`, פינות מעוגלות. האייקונים מצוירים inline ב-SVG ונלקחים מהמסכים עצמם: בחירה, ציור פוליגון, מדידה, תצפית, LKP, שכבות, חיפוש.
- אין עדיין ספריית אייקונים רשמית. ספרייה בסגנון Lucide מתאימה לקו ולמשקל, אם יוחלט לאמץ אחת.
- כפתור שיש בו רק אייקון חייב `aria-label`.

## נגישות ושמש

- פוקוס: טבעת `focus` מלאה בעובי 2px עם היסט 2px, על כל רכיב אינטראקטיבי, בשתי הערכות.
- גובה מטרה מינימלי 28px (לשונית). כפתורים ושדות הם 34px. במובייל (Command ו-Field) כל מטרת מגע היא 44px לפחות.
- מצבים: לכל כפתור `hover`, `active` (גוון `surface-raised` והזזה של פיקסל), `focus-visible` ו-`disabled` (שקיפות 45%).
- בערכת `day` הפאנלים אטומים לגמרי, הגבולות כהים יותר, וצבעי המצב כהים ורוויים, כדי לשמור על קריאות בבוהק.

---

## Consuming this system (generated — do not edit)

Every path named below is under `project/` in this design system: read `project/api/tokens.md`, not `api/tokens.md`.

12 components are documented without a runnable `components/bundle.js`: read each component’s card, and its README where it has one (`components/<Comp>/README.md`), and build to those guidelines. Tokens: the values are on `api/tokens.md`; a Slides deck or Design canvas also takes `tokens.json` by file path.

**Read, per thing:** a component’s props, parts and examples: `api/components/<Comp>.md`; token values: `api/tokens.md`. After this README, fetch the cards and fonts you need in ONE message as parallel calls — none depends on another.

**Two rules.** Before you use a thing — a component, a token group, an icon, an asset — read its card from the index below; a value you did not read from a card is a guess. `tokens.json`, `manifest.json` and `design-system.json` are sources for tools: hand them over. `components/<Comp>/README.md` is the long-form second read a card links to; `SKILL.md` and `artifact-type/` beside them are authoring guidance, not needed to consume the system.

## Index (generated — do not edit)

**Tokens**

- `api/tokens.md` — Every token: surface, text, fill, border, palette, type, spacing, radius, shadow, size. (7.9k)

**Components** (`api/components/<Comp>.md`, 12)

- **Alerts**: `AlertBanner` — התראת SOS צפה בראש המפה, בין שני הפאנלים. ההתראה היחידה בממשק שקוטעת את מבט המנהל · `EventList` — רשימת אירועים פתוחים שאינם SOS: יציאה מגבול, סוללה, אובדן GPS, ספי כיסוי והצעת LKP
- **Shell**: `AppBar` — הסרגל העליון הצף, במרווח space-6 מקצות המסך ובגובה header-h · `CommandSearch` — שדה חיפוש ופקודות אחד לכל המערכת, במרכז ה-AppBar. נפתח גם ב-Ctrl K
- **Actions**: `Button` — כפתור פעולה בגובה control-h, בארבע וריאציות: ראשי, משני, SOS ואייקון · `MapToolbar` — סרגל כלי עריכה ותצוגה למפה. צף במרכז התחתון של המפה · `SegmentedTabs` — מעבר בין תצוגות באותו פאנל, למשל "מחפשים / אירועים / דיווחים"
- **Units**: `CallsignChip` — מספר הזיהוי הדו-ספרתי של מחפש. זה העוגן שמחבר בין המפה, הרשימה, ההתראה וה-Inspector · `PolygonGroup` — כותרת קבוצה ברשימת המחפשים: פוליגון, כמה מחפשים בו, ומד כיסוי · `UnitRow` — שורת מחפש ברשימה: מספר, שם, שורת מצב וסוללה
- **Detail**: `Inspector` — פאנל פרטים לפריט שנבחר: מחפש, פוליגון, דיווח או תצפית. צף בצד הסוף ברוחב panel-end-w
- **Map**: `MapSymbols` — שפת הסמלים על המפה, כמחלקות SVG שמקבלות את צבעיהן מהטוקנים ומתחלפות עם הערכה
