CREATE TABLE "otp_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "otp_requests_phone_requested_at_idx" ON "otp_requests" USING btree ("phone","requested_at");