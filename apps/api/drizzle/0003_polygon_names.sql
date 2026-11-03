-- Polygons are known by name, not by letter. Unnamed polygons get "פוליגון N" in creation order, per mission.
UPDATE "polygons" AS p
SET "name" = 'פוליגון ' || n.rn
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "mission_id" ORDER BY "created_at") AS rn
	FROM "polygons"
) AS n
WHERE p."id" = n."id" AND p."name" IS NULL;--> statement-breakpoint
DROP INDEX "polygons_mission_letter_idx";--> statement-breakpoint
ALTER TABLE "polygons" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "polygons" DROP COLUMN "letter";
