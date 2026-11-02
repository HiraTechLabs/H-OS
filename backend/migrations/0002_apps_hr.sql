CREATE EXTENSION IF NOT EXISTS ltree;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "hr";
--> statement-breakpoint
CREATE TABLE "hr"."branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"time_zone" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."emergency_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"phone" text NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"verified_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_number" text NOT NULL,
	"status" text NOT NULL,
	"work_email" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_account_link" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_by" uuid,
	"unlinked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_contact" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"personal_email" text,
	"phone" text,
	"city" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_document_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"archive_document_id" text NOT NULL,
	"document_type" text NOT NULL,
	"classification" text NOT NULL,
	"issued_on" date,
	"expires_on" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_manager_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_employee_id" uuid,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"reason" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_account_id" uuid
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_number_sequence" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_org_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"work_location_id" uuid NOT NULL,
	"org_unit_id" uuid NOT NULL,
	"job_title_id" uuid NOT NULL,
	"job_grade_id" uuid,
	"work_arrangement" text NOT NULL,
	"work_schedule_id" uuid,
	"cost_center_ref" text,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"reason" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_account_id" uuid
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_person" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"given_name_en" text NOT NULL,
	"family_name_en" text NOT NULL,
	"given_name_ar" text NOT NULL,
	"family_name_ar" text NOT NULL,
	"date_of_birth" date,
	"gender" text NOT NULL,
	"nationality" text,
	"national_id_ciphertext" text,
	"national_id_last4" text,
	"national_id_hash" text,
	"passport_ciphertext" text,
	"passport_last4" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_status_transition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"effective_date" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_account_id" uuid,
	"reason" text NOT NULL,
	"end_reason" text
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"occurred_on" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary_en" text NOT NULL,
	"summary_ar" text NOT NULL,
	"actor_account_id" uuid,
	"reason" text,
	"related_type" text,
	"related_id" text
);
--> statement-breakpoint
CREATE TABLE "hr"."employment_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"contract_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"signed_on" date,
	"archive_document_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."employment_episode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"episode_no" integer NOT NULL,
	"employment_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"probation_end_date" date,
	"end_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."job_grade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"rank" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."job_title" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."org_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"path" "ltree" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."org_unit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"org_unit_id" uuid NOT NULL,
	"parent_id" uuid,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"effective_from" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_account_id" uuid,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "hr"."work_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"address_line" text,
	"time_zone" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr"."work_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"time_zone" text NOT NULL,
	"days" jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hr"."emergency_contact" ADD CONSTRAINT "emergency_contact_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_account_link" ADD CONSTRAINT "employee_account_link_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_contact" ADD CONSTRAINT "employee_contact_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_document_ref" ADD CONSTRAINT "employee_document_ref_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_manager_assignment" ADD CONSTRAINT "employee_manager_assignment_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_manager_assignment" ADD CONSTRAINT "employee_manager_assignment_manager_employee_id_employee_id_fk" FOREIGN KEY ("manager_employee_id") REFERENCES "hr"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_org_assignment" ADD CONSTRAINT "employee_org_assignment_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_person" ADD CONSTRAINT "employee_person_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_status_transition" ADD CONSTRAINT "employee_status_transition_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employee_timeline" ADD CONSTRAINT "employee_timeline_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employment_contract" ADD CONSTRAINT "employment_contract_episode_id_employment_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "hr"."employment_episode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."employment_episode" ADD CONSTRAINT "employment_episode_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hr"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."org_unit" ADD CONSTRAINT "org_unit_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hr"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."org_unit_history" ADD CONSTRAINT "org_unit_history_org_unit_id_org_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "hr"."org_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr"."work_location" ADD CONSTRAINT "work_location_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hr"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_code_unique" ON "hr"."branch" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "emergency_contact_employee_idx" ON "hr"."emergency_contact" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_number_unique" ON "hr"."employee" USING btree ("organization_id","employee_number");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_work_email_unique" ON "hr"."employee" USING btree ("organization_id","work_email");--> statement-breakpoint
CREATE INDEX "employee_status_idx" ON "hr"."employee" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_account_link_account_unique" ON "hr"."employee_account_link" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "employee_document_ref_employee_idx" ON "hr"."employee_document_ref" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_manager_assignment_employee_idx" ON "hr"."employee_manager_assignment" USING btree ("employee_id","valid_from");--> statement-breakpoint
CREATE INDEX "employee_manager_assignment_manager_idx" ON "hr"."employee_manager_assignment" USING btree ("manager_employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_manager_assignment_open_unique" ON "hr"."employee_manager_assignment" USING btree ("employee_id") WHERE "hr"."employee_manager_assignment"."valid_to" is null;--> statement-breakpoint
CREATE INDEX "employee_org_assignment_employee_idx" ON "hr"."employee_org_assignment" USING btree ("employee_id","valid_from");--> statement-breakpoint
CREATE INDEX "employee_org_assignment_unit_idx" ON "hr"."employee_org_assignment" USING btree ("org_unit_id");--> statement-breakpoint
CREATE INDEX "employee_org_assignment_open_idx" ON "hr"."employee_org_assignment" USING btree ("employee_id") WHERE "hr"."employee_org_assignment"."valid_to" is null;--> statement-breakpoint
CREATE INDEX "employee_status_transition_employee_idx" ON "hr"."employee_status_transition" USING btree ("employee_id","recorded_at");--> statement-breakpoint
CREATE INDEX "employee_timeline_employee_idx" ON "hr"."employee_timeline" USING btree ("employee_id","occurred_on");--> statement-breakpoint
CREATE INDEX "employment_contract_episode_idx" ON "hr"."employment_contract" USING btree ("episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_episode_no_unique" ON "hr"."employment_episode" USING btree ("employee_id","episode_no");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_episode_open_unique" ON "hr"."employment_episode" USING btree ("employee_id") WHERE "hr"."employment_episode"."end_date" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "job_grade_code_unique" ON "hr"."job_grade" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "job_title_code_unique" ON "hr"."job_title" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "org_unit_code_unique" ON "hr"."org_unit" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "org_unit_path_gist_idx" ON "hr"."org_unit" USING gist ("path");--> statement-breakpoint
CREATE INDEX "org_unit_parent_idx" ON "hr"."org_unit" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "org_unit_branch_idx" ON "hr"."org_unit" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "org_unit_history_unit_idx" ON "hr"."org_unit_history" USING btree ("org_unit_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "work_location_code_unique" ON "hr"."work_location" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "work_location_branch_idx" ON "hr"."work_location" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_schedule_code_unique" ON "hr"."work_schedule" USING btree ("organization_id","code");
--> statement-breakpoint
-- Effective-dated history is half-open [valid_from, valid_to) and two assignments of the same
-- kind may never overlap for one employee (BIZ-003, HR-DEC-0001, HR-DEC-0007).
ALTER TABLE "hr"."employee_org_assignment"
  ADD CONSTRAINT "employee_org_assignment_no_overlap"
  EXCLUDE USING gist ("employee_id" WITH =, daterange("valid_from", "valid_to", '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE "hr"."employee_manager_assignment"
  ADD CONSTRAINT "employee_manager_assignment_no_overlap"
  EXCLUDE USING gist ("employee_id" WITH =, daterange("valid_from", "valid_to", '[)') WITH &&);
--> statement-breakpoint
-- An org unit snapshot is unique per unit and effective date, so history is append-only.
CREATE UNIQUE INDEX "org_unit_history_unit_date_unique"
  ON "hr"."org_unit_history" USING btree ("org_unit_id", "effective_from");