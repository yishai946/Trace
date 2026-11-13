CREATE TYPE "public"."sos_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "sos_alert_recipients" (
	"sos_id" uuid NOT NULL,
	"searcher_id" uuid NOT NULL,
	CONSTRAINT "sos_alert_recipients_sos_id_searcher_id_pk" PRIMARY KEY("sos_id","searcher_id")
);
--> statement-breakpoint
CREATE TABLE "sos_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"participation_id" uuid NOT NULL,
	"polygon_id" uuid,
	"message" text,
	"position" geometry(Point,4326),
	"position_recorded_at" timestamp with time zone,
	"position_accuracy" double precision,
	"status" "sos_status" DEFAULT 'active' NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid
);
--> statement-breakpoint
ALTER TABLE "sos_alert_recipients" ADD CONSTRAINT "sos_alert_recipients_sos_id_sos_alerts_id_fk" FOREIGN KEY ("sos_id") REFERENCES "public"."sos_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alert_recipients" ADD CONSTRAINT "sos_alert_recipients_searcher_id_searchers_id_fk" FOREIGN KEY ("searcher_id") REFERENCES "public"."searchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_participation_id_participations_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."participations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_polygon_id_polygons_id_fk" FOREIGN KEY ("polygon_id") REFERENCES "public"."polygons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sos_alert_recipients_searcher_idx" ON "sos_alert_recipients" USING btree ("searcher_id");--> statement-breakpoint
CREATE INDEX "sos_alerts_mission_idx" ON "sos_alerts" USING btree ("mission_id","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sos_alerts_active_idx" ON "sos_alerts" USING btree ("participation_id") WHERE "sos_alerts"."status" = 'active';