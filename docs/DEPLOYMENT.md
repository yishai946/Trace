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

## `command`

- Build: `pnpm install --frozen-lockfile && pnpm --filter @trace/command build`
- Start: `WEB_PORT=$PORT pnpm --filter @trace/command exec vite preview --host 0.0.0.0`. ההגדרה קוראת `WEB_PORT`, לכן מעבירים אליה את `PORT` של Railway.
- Command קורא ל-`/api` באותו origin; `vite preview` מעביר ל-API (`VITE_API_PROXY`, גם WebSocket), כך שעוגיית הכניסה שייכת לדומיין של Command.
- משתנים: `VITE_API_PROXY` (הכתובת הציבורית של ה-API), `VITE_JOIN_LINK_BASE` (הכתובת הציבורית של Command), `MAPTILER_API_KEY` (נצרב בבנייה; בלי זה אין מפה, ואחרי הוספה צריך לבנות מחדש).
- `vite preview` אינו שרת פרודקשן. זה מספיק ל-POC; בהמשך אפשר להחליף בשרת סטטי עם proxy.

## מנהל ראשון

אין הרשמה ציבורית ואין seed בפרודקשן. מריצים מקומית מול בסיס הנתונים של Railway (עם `DATABASE_URL` שהכתובת שלו ציבורית, TCP proxy של `postgis`):

```powershell
pnpm --filter @trace/api auth:create-commander --email you@example.com --name "שם" --password "<לפחות 12 תווים>"
```

## מגבלות ידועות

- כניסת מחפש ב-Field (SMS) לא עובדת בפרודקשן: ספק ה-SMS לא נבחר, והשרת נכשל בשליחת קוד.
- `trustProxy` עוד לא מוגדר (#136), ולכן כתובת ה-IP של הלקוח ב-API היא של ה-proxy.
- Field לא נפרס כאן: APK ב-#262, Push ב-#126.
