-- Guard: coverage survey responses are only valid for FINISHED subject
-- enrollments (STRUCTURE.md §2.4). The app layer enforces this too; the
-- trigger makes it impossible to bypass.
CREATE FUNCTION assert_subject_finished() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM subject_enrollments se
    WHERE se.id = NEW.subject_enrollment_id AND se.status = 'finished'
  ) THEN
    RAISE EXCEPTION 'coverage responses require a finished subject enrollment';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER coverage_requires_finished
  BEFORE INSERT OR UPDATE ON coverage_responses
  FOR EACH ROW EXECUTE FUNCTION assert_subject_finished();
