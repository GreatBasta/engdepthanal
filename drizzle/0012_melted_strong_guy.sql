ALTER TABLE "university_programs" DROP CONSTRAINT "university_programs_university_id_program_id_unique";--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "organizational_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "requested_programme_name" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_organizational_unit_id_organizational_units_id_fk" FOREIGN KEY ("organizational_unit_id") REFERENCES "public"."organizational_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_enrollments_unit" ON "enrollments" USING btree ("organizational_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_university_program_taxonomy" ON "university_programs" USING btree ("university_id","program_id") WHERE "university_programs"."degree_programme_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_university_program_degree" ON "university_programs" USING btree ("degree_programme_id") WHERE "university_programs"."degree_programme_id" is not null;