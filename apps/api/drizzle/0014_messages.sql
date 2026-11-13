CREATE TYPE "public"."message_target_kind" AS ENUM('mission', 'polygons', 'searcher');--> statement-breakpoint
CREATE TYPE "public"."message_urgency" AS ENUM('normal', 'important', 'critical');--> statement-breakpoint
CREATE TABLE "message_recipients" (
	"message_id" uuid NOT NULL,
	"participation_id" uuid NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	CONSTRAINT "message_recipients_message_id_participation_id_pk" PRIMARY KEY("message_id","participation_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"sent_by" uuid NOT NULL,
	"urgency" "message_urgency" NOT NULL,
	"body" text NOT NULL,
	"target_kind" "message_target_kind" NOT NULL,
	"target_polygon_ids" uuid[],
	"target_participant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_participation_id_participations_id_fk" FOREIGN KEY ("participation_id") REFERENCES "public"."participations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_target_participant_id_participations_id_fk" FOREIGN KEY ("target_participant_id") REFERENCES "public"."participations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_recipients_participation_idx" ON "message_recipients" USING btree ("participation_id");--> statement-breakpoint
CREATE INDEX "messages_mission_idx" ON "messages" USING btree ("mission_id","created_at");