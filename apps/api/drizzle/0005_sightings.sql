CREATE TYPE "public"."lkp_decision" AS ENUM('accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sighting_source" AS ENUM('self', 'witness');--> statement-breakpoint
CREATE TABLE "sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"source" "sighting_source" NOT NULL,
	"position" geometry(Point,4326) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"description" text,
	"lkp_decision" "lkp_decision",
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lkp_points" ADD COLUMN "sighting_id" uuid;--> statement-breakpoint
ALTER TABLE "lkp_points" ADD COLUMN "set_by" uuid;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sightings_mission_idx" ON "sightings" USING btree ("mission_id","created_at");--> statement-breakpoint
ALTER TABLE "lkp_points" ADD CONSTRAINT "lkp_points_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "public"."sightings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lkp_points" ADD CONSTRAINT "lkp_points_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;