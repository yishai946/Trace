# פריסה ב-Railway

פרויקט Railway אחד (`Trace`), סביבה `production`, שלושה שירותים. הפריסה היא מהענף `dev`, ובכל דחיפה אליו נבנה מחדש. הפרויקט הוא POC לימודי: בלי חנויות אפליקציות, בלי דומיין מותאם (כתובות `*.up.railway.app`).

| שירות     | מקור                           | תפקיד                                    |
| --------- | ------------------------------ | ---------------------------------------- |
| `postgis` | image `postgis/postgis:17-3.5` | בסיס הנתונים, עם volume ב-`/var/lib/...` |
| `Trace`   | הריפו, ענף `dev`, שורש הריפו   | ה-API (`apps/api`)                       |
| `command` | הריפו, ענף `dev`, שורש הריפו   | Command, מוגש על ידי `vite preview`      |

Root Directory ריק בשני שירותי הריפו: זה monorepo של pnpm, והפקודות מסננות לפי חבילה.

## `Trace` (API)

- Build: `pnpm install --frozen-lockfile`
- Pre-deploy: `pnpm db:migrate` (המיגרציות רצות לפני כל פריסה; הראשונה מפעילה PostGIS)
- Start: `pnpm --filter @trace/api start`
- Healthcheck: `/api/health`
- משתנים: `NODE_ENV=production`, `DATABASE_URL` (הפניה ל-`postgis`), `AUTH_SECRET` (אקראי, 32 תווים ומעלה), `API_URL` (הכתובת הציבורית של ה-API), `WEB_ORIGIN` (הכתובת הציבורית של Command: CORS ו-Better Auth).
- תמונות (נעדר ודיווחים): ב-Railway Bucket פרטי, והן מוגשות רק דרך ה-API. יוצרים Bucket בפרויקט ומגדירים בשירות `Trace` ארבעה משתנים כהפניות למשתני ה-Bucket: `BUCKET_ENDPOINT` (כתובת ה-S3, למשל `https://t3.storageapi.dev`), `BUCKET_NAME`, `BUCKET_ACCESS_KEY_ID`, `BUCKET_SECRET_ACCESS_KEY` (`BUCKET_REGION` ברירת מחדל `auto`). בפרודקשן הם חובה: בלעדיהם השרת לא עולה. Cloudflare R2 או כל S3 אחר עובדים עם אותם משתנים.
- אחרי הפריסה הראשונה עם ה-Bucket מריצים פעם אחת, מול בסיס הנתונים וה-Bucket של Railway: `pnpm photos:move` (אפשר להריץ שוב). הוא מעתיק לתוך ה-Bucket תמונות שנשמרו קודם ב-Postgres ומנקה את העמודה `data`. עד אז הן מוגשות מהטבלה, כך שאין חלון בלי תמונות. מחיקת העמודה `data` תהיה מיגרציה נפרדת, אחרי שההעברה רצה.

## `command`

- Build: `pnpm install --frozen-lockfile && pnpm --filter @trace/command build`
- Start: `WEB_PORT=$PORT pnpm --filter @trace/command exec vite preview --host 0.0.0.0`. ההגדרה קוראת `WEB_PORT`, לכן מעבירים אליה את `PORT` של Railway.
- Command קורא ל-`/api` באותו origin; `vite preview` מעביר ל-API (`VITE_API_PROXY`, גם WebSocket), כך שעוגיית הכניסה שייכת לדומיין של Command.
- משתנים: `VITE_API_PROXY` (הכתובת הציבורית של ה-API), `VITE_JOIN_LINK_BASE` (הכתובת הציבורית של Command), `ANDROID_CERT_SHA256` (ראו "קישורי הצטרפות"), `MAPTILER_API_KEY` (נצרב בבנייה; בלי זה אין מפה, ואחרי הוספה צריך לבנות מחדש).
- `vite preview` אינו שרת פרודקשן. זה מספיק ל-POC; בהמשך אפשר להחליף בשרת סטטי עם proxy.

## קישורי הצטרפות (App Links ב-Android)

הקישור וה-QR של מסע הם `https://<כתובת Command>/j/<קוד>`. ב-Android עם Field מותקן הם פותחים את האפליקציה במסך ההצטרפות; בלי האפליקציה, וב-iOS (אין Universal Links בחתימה חינמית), נפתח ב-Command עמוד נחיתה בלי כניסה, עם הקוד, הסבר התקנה וכפתור שפותח `trace-field://j/<קוד>`.

הכתובת נצרבת ב-APK, ולכן ההגדרה היא בסדר הזה:

1. ב-`command`: `VITE_JOIN_LINK_BASE` הוא הכתובת הציבורית (`https://….up.railway.app`, בלי `/` בסוף).
2. ב-GitHub, Settings, Variables: משתנה הריפו `JOIN_LINK_BASE` עם אותה כתובת. ה-workflow `Field Android APK` מעביר אותו ל-`expo prebuild`, וה-`intentFilters` (עם `autoVerify`) נוצרים רק כשהוא מוגדר. כתובת שאינה https נכשלת בבנייה.
3. מריצים את ה-workflow ומעתיקים את `Signing certificate SHA-256` מסיכום הריצה.
4. ב-`command`: `ANDROID_CERT_SHA256` עם הטביעה (אפשר כמה, מופרדות בפסיק, למשל Debug ו-Release). הבנייה כותבת `/.well-known/assetlinks.json` ל-`dist`, ו-`vite preview` מגיש אותו; בלי המשתנה הקובץ לא נוצר. אחרי הגדרה בונים את `command` מחדש.
5. מתקינים את ה-APK שנבנה בשלב 3 ובודקים: `adb shell pm get-app-links com.yishai946.tracefield` מציג את הדומיין כ-`verified`, וסריקת ה-QR במצלמת הטלפון פותחת את Field.

מעבר לדומיין אחר בעתיד דורש APK חדש.

## מנהל ראשון

אין הרשמה ציבורית ואין seed בפרודקשן. מריצים מקומית מול בסיס הנתונים של Railway (עם `DATABASE_URL` שהכתובת שלו ציבורית, TCP proxy של `postgis`):

```powershell
pnpm --filter @trace/api auth:create-commander --email you@example.com --name "שם" --password "<לפחות 12 תווים>"
```

## מגבלות ידועות

- כניסת מחפש ב-Field (SMS) לא עובדת בפרודקשן: ספק ה-SMS לא נבחר, והשרת נכשל בשליחת קוד.
- `trustProxy` עוד לא מוגדר (#136), ולכן כתובת ה-IP של הלקוח ב-API היא של ה-proxy.
- Field לא נפרס כאן: APK ב-#262, Push ב-#126.
