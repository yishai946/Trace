CREATE TYPE "public"."report_status" AS ENUM('new', 'handled');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('finding', 'hazard', 'inaccessible', 'general', 'located');--> statement-breakpoint
CREATE TABLE "report_photos" (
	"report_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mission_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"polygon_id" uuid,
	"type" "report_type" NOT NULL,
	"status" "report_status" DEFAULT 'new' NOT NULL,
	"text" text NOT NULL,
	"position" geometry(Point,4326) NOT NULL,
	"accuracy" double precision,
	"reported_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_photos" ADD CONSTRAINT "report_photos_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_polygon_id_polygons_id_fk" FOREIGN KEY ("polygon_id") REFERENCES "public"."polygons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_mission_idx" ON "reports" USING btree ("mission_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_polygon_idx" ON "reports" USING btree ("polygon_id");