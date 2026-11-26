-- Hand-written guard: dropping the column would destroy a photo that was never copied to the bucket, so abort instead.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "mission_photos" WHERE "data" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "report_photos" WHERE "data" IS NOT NULL) THEN
    RAISE EXCEPTION 'Photos are still stored in the database: run pnpm photos:move from commit b7751c4 first (an empty dev database: pnpm db:reset)';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "mission_photos" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "report_photos" DROP COLUMN "data";