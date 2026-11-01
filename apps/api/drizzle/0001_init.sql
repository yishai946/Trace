CREATE TYPE "public"."mission_status" AS ENUM('active', 'paused', 'ended_located', 'ended_stopped');--> statement-breakpoint
CREATE TYPE "public"."participation_status" AS ENUM('available', 'assigned', 'ended');--> statement-breakpoint
CREATE TYPE "public"."polygon_status" AS ENUM('unassigned', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('ready', 'searching', 'paused', 'finished');--> statement-breakpoint
CREATE TABLE "lkp_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"position" geometry(Point,4326) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "mission_status" DEFAULT 'active' NOT NULL,
	"join_code" text NOT NULL,
	"missing_person_name" text,
	"missing_person_age" integer,
	"disappeared_at" timestamp with time zone,
	"description" text,
	"additional_info" text,
	"rally_point" geometry(Point,4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missions_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"searcher_id" uuid NOT NULL,
	"callsign" integer NOT NULL,
	"status" "participation_status" DEFAULT 'available' NOT NULL,
	"polygon_id" uuid,
	"task_status" "task_status",
	"last_position" geometry(Point,4326),
	"last_position_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polygons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"letter" text NOT NULL,
	"name" text,
	"status" "polygon_status" DEFAULT 'unassigned' NOT NULL,
	"geometry" geometry(Polygon,4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "searchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "searchers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "lkp_points" ADD CONSTRAINT "lkp_points_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_searcher_id_searchers_id_fk" FOREIGN KEY ("searcher_id") REFERENCES "public"."searchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_polygon_id_polygons_id_fk" FOREIGN KEY ("polygon_id") REFERENCES "public"."polygons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polygons" ADD CONSTRAINT "polygons_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lkp_points_mission_idx" ON "lkp_points" USING btree ("mission_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participations_mission_searcher_idx" ON "participations" USING btree ("mission_id","searcher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participations_mission_callsign_idx" ON "participations" USING btree ("mission_id","callsign");--> statement-breakpoint
CREATE INDEX "participations_polygon_idx" ON "participations" USING btree ("polygon_id") WHERE "participations"."status" = 'assigned';--> statement-breakpoint
CREATE UNIQUE INDEX "polygons_mission_letter_idx" ON "polygons" USING btree ("mission_id","letter");--> statement-breakpoint
CREATE INDEX "polygons_geometry_idx" ON "polygons" USING gist ("geometry");