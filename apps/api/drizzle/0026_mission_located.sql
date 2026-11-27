ALTER TABLE "missions" ADD COLUMN "located_position" geometry(Point,4326);--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "located_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "located_note" text;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "ended_at" timestamp with time zone;