CREATE TYPE "public"."timeline_event_type" AS ENUM('mission.created', 'mission.paused', 'mission.resumed', 'mission.ended', 'lkp.changed', 'polygon.created', 'polygon.boundary_changed', 'polygon.deleted', 'search.started', 'report.submitted', 'coverage.threshold_reached', 'contact.lost', 'sos.activated');--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"mission_id" uuid NOT NULL,
	"type" timeline_event_type NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" jsonb NOT NULL,
	"subject" jsonb NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "timeline_events_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timeline_events_mission_idx" ON "timeline_events" USING btree ("mission_id","occurred_at","seq");--> statement-breakpoint
-- Missions created before the Timeline existed start with their creation and LKP history (UC-C19).
INSERT INTO "timeline_events" ("mission_id", "type", "occurred_at", "actor", "subject", "details")
SELECT m."id", 'mission.created', m."created_at",
  jsonb_build_object('kind', 'commander', 'userId', u."id", 'name', u."name"),
  jsonb_build_object('kind', 'mission', 'id', m."id", 'label', m."name", 'callsign', NULL),
  '{}'::jsonb
FROM "missions" m JOIN "users" u ON u."id" = m."commander_id"
ORDER BY m."created_at";--> statement-breakpoint
INSERT INTO "timeline_events" ("mission_id", "type", "occurred_at", "actor", "subject", "details")
SELECT l."mission_id", 'lkp.changed', l."created_at",
  jsonb_build_object('kind', 'commander', 'userId', u."id", 'name', u."name"),
  jsonb_build_object('kind', 'lkp', 'id', l."id", 'label', NULL, 'callsign', NULL),
  jsonb_build_object(
    'observedAt', to_char(l."observed_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'previousObservedAt', to_char(l."previous" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
FROM (
  SELECT *, lag("observed_at") OVER (PARTITION BY "mission_id" ORDER BY "created_at") AS "previous" FROM "lkp_points"
) l
JOIN "missions" m ON m."id" = l."mission_id" JOIN "users" u ON u."id" = m."commander_id"
ORDER BY l."created_at";
