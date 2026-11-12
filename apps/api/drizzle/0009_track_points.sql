CREATE TYPE "public"."track_context" AS ENUM('search', 'safety');--> statement-breakpoint
CREATE TABLE "track_points" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participation_id" uuid NOT NULL,
	"position" geometry(Point,4326) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"accuracy" double precision,
	"context" "track_context" NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_points" ADD CONSTRAINT "track_points_participation_id_participations_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."participations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "track_points_participation_recorded_idx" ON "track_points" USING btree ("participation_id","recorded_at");