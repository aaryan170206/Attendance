


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."can_student_view_department"("target_department_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.enrollments e
            ON e.class_id = c.id
        JOIN public.institution_memberships im
            ON im.institution_id = (
                SELECT d.institution_id
                FROM public.departments d
                WHERE d.id = target_department_id
            )
        WHERE c.department_id = target_department_id
          AND e.student_id = (SELECT auth.uid())
          AND im.user_id = (SELECT auth.uid())
          AND im.role = 'student'
          AND im.status = 'active'
    );
$$;


ALTER FUNCTION "public"."can_student_view_department"("target_department_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_enrollment"("target_student_id" "uuid", "target_class_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.departments d
            ON d.id = c.department_id
        JOIN public.institution_memberships im
            ON im.institution_id = d.institution_id
        WHERE c.id = target_class_id
          AND im.user_id = (SELECT auth.uid())
          AND im.status = 'active'
          AND (
              (
                  im.role = 'student'
                  AND target_student_id = (SELECT auth.uid())
              )
              OR
              (
                  im.role = 'teacher'
                  AND EXISTS (
                      SELECT 1
                      FROM public.teaching_assignments ta
                      WHERE ta.teacher_id = (SELECT auth.uid())
                        AND ta.class_id = target_class_id
                  )
              )
          )
    );
$$;


ALTER FUNCTION "public"."can_view_enrollment"("target_student_id" "uuid", "target_class_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_teacher_department"("target_teacher_id" "uuid", "target_department_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1
            FROM public.departments d
            JOIN public.institution_memberships im
                ON im.institution_id = d.institution_id
            WHERE d.id = target_department_id
              AND im.user_id = (SELECT auth.uid())
              AND im.status = 'active'
              AND (
                  (
                      im.role = 'teacher'
                      AND target_teacher_id = (SELECT auth.uid())
                  )
                  OR im.role = 'admin'
              )
        );
$$;


ALTER FUNCTION "public"."can_view_teacher_department"("target_teacher_id" "uuid", "target_department_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_attendance_session"("p_session_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_teacher_id UUID := auth.uid();
    v_session public.attendance_sessions%ROWTYPE;
BEGIN

    -- 1. Ensure the user is authenticated
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION
            'You must be signed in to close an attendance session.';
    END IF;


    -- 2. Only teachers can close sessions
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = v_teacher_id
          AND p.role = 'teacher'
    ) THEN
        RAISE EXCEPTION
            'Only teachers can close attendance sessions.';
    END IF;


    -- 3. Find and lock the session
    SELECT *
    INTO v_session
    FROM public.attendance_sessions s
    WHERE s.id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Attendance session not found.';
    END IF;


    -- 4. Verify active teacher membership and institution
    IF NOT EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.departments d
            ON d.id = c.department_id
        JOIN public.institution_memberships im
            ON im.institution_id = d.institution_id
        WHERE c.id = v_session.class_id
          AND im.user_id = v_teacher_id
          AND im.role = 'teacher'
          AND im.status = 'active'
          AND public.is_institution_active(d.institution_id)
    ) THEN
        RAISE EXCEPTION
            'You do not have an active teacher membership in this institution.';
    END IF;


    -- 5. Verify exact teacher assignment
    IF NOT EXISTS (
        SELECT 1
        FROM public.teaching_assignments ta
        WHERE ta.teacher_id = v_teacher_id
          AND ta.class_id = v_session.class_id
          AND ta.subject_id = v_session.subject_id
    ) THEN
        RAISE EXCEPTION
            'You are not assigned to this class and subject.';
    END IF;


    -- 6. Only open sessions can be closed
    IF v_session.status <> 'open' THEN
        RAISE EXCEPTION
            'This attendance session is not open.';
    END IF;


    -- 7. Close the session
    UPDATE public.attendance_sessions
    SET
        status = 'closed',
        closed_at = NOW()
    WHERE id = p_session_id
      AND status = 'open';

    RETURN p_session_id;

END;
$$;


ALTER FUNCTION "public"."close_attendance_session"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_expired_attendance_sessions"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_session RECORD;
    v_closed_count INTEGER := 0;
    v_today DATE;
    v_current_time TIME;
BEGIN
    v_today :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    v_current_time :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::TIME;

    FOR v_session IN
        SELECT
            ss.id,
            das.closing_time
        FROM public.attendance_sessions ss
        JOIN public.subjects s
            ON s.id = ss.subject_id
        JOIN public.classes c
            ON c.id = s.class_id
        JOIN public.department_attendance_settings das
            ON das.department_id = c.department_id
        WHERE ss.status = 'open'
          AND ss.attendance_date <= v_today
          AND (
              ss.attendance_date < v_today
              OR v_current_time >= das.closing_time
          )
        FOR UPDATE OF ss
    LOOP
        UPDATE public.attendance
        SET
            status = 'absent',
            updated_at = NOW()
        WHERE session_id = v_session.id
          AND status = 'pending';

        UPDATE public.attendance_sessions
        SET
            status = 'closed',
            closed_at = NOW()
        WHERE id = v_session.id
          AND status = 'open';

        v_closed_count := v_closed_count + 1;
    END LOOP;

    RETURN v_closed_count;
END;
$$;


ALTER FUNCTION "public"."close_expired_attendance_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."correct_attendance"("p_attendance_id" "uuid", "p_new_status" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_teacher_id UUID;
    v_attendance public.attendance%ROWTYPE;
    v_session_status TEXT;
    v_session_date DATE;
    v_closing_time TIME;
    v_current_date DATE;
    v_current_time TIME;
    v_correction_id UUID;
    v_corrected_at TIMESTAMPTZ;
    v_institution_id UUID;
BEGIN

    -- 1. Authenticate the user
    v_teacher_id := auth.uid();

    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;


    -- 2. Verify teacher role
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = v_teacher_id
          AND p.role = 'teacher'
    ) THEN
        RAISE EXCEPTION
            'Only teachers can correct attendance.';
    END IF;


    -- 3. Validate correction status
    IF p_new_status IS NULL
       OR p_new_status NOT IN ('present', 'absent', 'onLeave') THEN
        RAISE EXCEPTION 'Invalid correction status.';
    END IF;


    -- 4. Validate correction reason
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION
            'A correction reason is required.';
    END IF;


    -- 5. Get and lock the attendance session first.
    -- Also retrieve the institution owning the class.
    SELECT
        ss.status,
        ss.attendance_date,
        das.closing_time,
        d.institution_id
    INTO
        v_session_status,
        v_session_date,
        v_closing_time,
        v_institution_id
    FROM public.attendance_sessions ss
    JOIN public.subjects s
        ON s.id = ss.subject_id
    JOIN public.classes c
        ON c.id = s.class_id
    JOIN public.departments d
        ON d.id = c.department_id
    JOIN public.department_attendance_settings das
        ON das.department_id = c.department_id
    WHERE ss.id = (
        SELECT a.session_id
        FROM public.attendance a
        WHERE a.id = p_attendance_id
    )
    FOR UPDATE OF ss;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Attendance session or department settings not found.';
    END IF;


    -- 6. Verify active teacher membership and institution
    IF NOT EXISTS (
        SELECT 1
        FROM public.institution_memberships im
        WHERE im.user_id = v_teacher_id
          AND im.institution_id = v_institution_id
          AND im.role = 'teacher'
          AND im.status = 'active'
          AND public.is_institution_active(v_institution_id)
    ) THEN
        RAISE EXCEPTION
            'You do not have an active teacher membership in this institution.';
    END IF;


    -- 7. Verify that the session is still open
    IF v_session_status <> 'open' THEN
        RAISE EXCEPTION
            'This attendance session is closed.';
    END IF;


    -- 8. Enforce today's date and department closing time
    v_current_date :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    v_current_time :=
        (NOW() AT TIME ZONE 'Asia/Kolkata')::TIME;

    IF v_session_date <> v_current_date THEN
        RAISE EXCEPTION
            'Teachers can only correct attendance for today.';
    END IF;

    IF v_current_time >= v_closing_time THEN
        RAISE EXCEPTION
            'The department attendance correction deadline has passed.';
    END IF;


    -- 9. Lock and verify the attendance record
    -- and the teacher's exact subject assignment.
    SELECT a.*
    INTO v_attendance
    FROM public.attendance a
    JOIN public.subjects s
        ON s.id = a.subject_id
    JOIN public.enrollments e
        ON e.student_id = a.student_id
       AND e.class_id = s.class_id
    JOIN public.teaching_assignments ta
        ON ta.class_id = s.class_id
       AND ta.subject_id = a.subject_id
       AND ta.teacher_id = v_teacher_id
    WHERE a.id = p_attendance_id
      AND a.session_id IS NOT NULL
    FOR UPDATE OF a;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Attendance record not found or you are not authorised to correct it.';
    END IF;


    -- 10. Pending records cannot be manually corrected.
    IF v_attendance.status = 'pending' THEN
        RAISE EXCEPTION
            'Pending attendance cannot be manually corrected.';
    END IF;

    IF v_attendance.status = p_new_status THEN
        RAISE EXCEPTION
            'The attendance already has this status.';
    END IF;


    -- 11. Update attendance
    UPDATE public.attendance
    SET
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_attendance_id;


    -- 12. Record the correction in the audit log
    INSERT INTO public.attendance_correction_logs (
        attendance_id,
        student_id,
        subject_id,
        teacher_id,
        old_status,
        new_status,
        reason
    )
    VALUES (
        v_attendance.id,
        v_attendance.student_id,
        v_attendance.subject_id,
        v_teacher_id,
        v_attendance.status,
        p_new_status,
        btrim(p_reason)
    )
    RETURNING id, created_at
    INTO v_correction_id, v_corrected_at;


    -- 13. Return correction details
    RETURN jsonb_build_object(
        'attendance_id', v_attendance.id,
        'correction_id', v_correction_id,
        'old_status', v_attendance.status,
        'new_status', p_new_status,
        'corrected_at', v_corrected_at
    );

END;
$$;


ALTER FUNCTION "public"."correct_attendance"("p_attendance_id" "uuid", "p_new_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_pending_assignment_submissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.assignment_submissions (
    assignment_id,
    student_id,
    status,
    submitted_at,
    marked_by
  )
  SELECT
    NEW.id,
    e.student_id,
    'pending',
    NULL,
    NULL
  FROM public.enrollments e
  WHERE e.class_id = NEW.class_id
  ON CONFLICT (assignment_id, student_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_pending_assignment_submissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_assignment_creator_names"() RETURNS TABLE("teacher_id" "uuid", "full_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT DISTINCT
        p.id AS teacher_id,
        p.full_name
    FROM public.assignments AS a
    JOIN public.classes AS c
        ON c.id = a.class_id
    JOIN public.teacher_departments AS current_td
        ON current_td.department_id = c.department_id
       AND current_td.teacher_id = (SELECT auth.uid())
    JOIN public.teacher_departments AS creator_td
        ON creator_td.department_id = c.department_id
       AND creator_td.teacher_id = a.teacher_id
    JOIN public.profiles AS p
        ON p.id = a.teacher_id
    WHERE (SELECT auth.uid()) IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_assignment_creator_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_assignment_details"("p_assignment_id" "uuid") RETURNS TABLE("description" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT a.description
    FROM public.assignments AS a
    WHERE a.id = p_assignment_id
      AND a.teacher_id = (SELECT auth.uid());
$$;


ALTER FUNCTION "public"."get_assignment_details"("p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_attendance_session"("p_subject_id" "uuid", "p_attendance_date" "date", "p_type" "text") RETURNS TABLE("session_id" "uuid", "session_date" "date", "session_type" "text", "session_status" "text", "closing_time" time without time zone, "can_submit" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id uuid;
    v_role text;
    v_class_id uuid;
    v_today date;
    v_current_time time;
BEGIN

    -- 1. Verify authentication
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;


    -- 2. Verify student role
    SELECT p.role
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_role IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION
            'Only students can view their attendance sessions';
    END IF;


    -- 3. Validate attendance type
    IF p_type NOT IN ('theory', 'lab') THEN
        RAISE EXCEPTION 'Invalid attendance type';
    END IF;


    -- 4. Retrieve the subject's class
    SELECT s.class_id
    INTO v_class_id
    FROM public.subjects s
    WHERE s.id = p_subject_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subject not found';
    END IF;


    -- 5. Verify active student membership and institution
    IF NOT EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.departments d
            ON d.id = c.department_id
        JOIN public.institution_memberships im
            ON im.institution_id = d.institution_id
        WHERE c.id = v_class_id
          AND im.user_id = v_user_id
          AND im.role = 'student'
          AND im.status = 'active'
          AND public.is_institution_active(d.institution_id)
    ) THEN
        RAISE EXCEPTION
            'You do not have an active student membership in this institution';
    END IF;


    -- 6. Verify student enrollment
    IF NOT EXISTS (
        SELECT 1
        FROM public.enrollments e
        WHERE e.student_id = v_user_id
          AND e.class_id = v_class_id
    ) THEN
        RAISE EXCEPTION
            'You are not enrolled in this class';
    END IF;


    -- 7. Get current Indian date and time
    v_today := (
        clock_timestamp() AT TIME ZONE 'Asia/Kolkata'
    )::date;

    v_current_time := (
        clock_timestamp() AT TIME ZONE 'Asia/Kolkata'
    )::time;


    -- 8. Return matching attendance sessions
    RETURN QUERY
    SELECT
        ss.id,
        ss.attendance_date,
        ss.type,
        ss.status,
        das.closing_time,
        (
            ss.status = 'open'
            AND ss.attendance_date = v_today
            AND p_attendance_date = v_today
            AND v_current_time < das.closing_time
        )
    FROM public.attendance_sessions ss
    JOIN public.subjects s
        ON s.id = ss.subject_id
    JOIN public.classes c
        ON c.id = s.class_id
    JOIN public.department_attendance_settings das
        ON das.department_id = c.department_id
    WHERE ss.subject_id = p_subject_id
      AND ss.attendance_date = p_attendance_date
      AND ss.type = p_type;

END;
$$;


ALTER FUNCTION "public"."get_student_attendance_session"("p_subject_id" "uuid", "p_attendance_date" "date", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$DECLARE
    user_role TEXT;
    user_name TEXT;
    user_roll_number TEXT;
BEGIN

    user_role := COALESCE(
        NEW.raw_user_meta_data ->> 'role',
        'student'
    );

    user_name := NEW.raw_user_meta_data ->> 'full_name';

    user_roll_number := NULLIF(
        TRIM(NEW.raw_user_meta_data ->> 'roll_number'),
        ''
    );

    INSERT INTO public.profiles (
        id,
        full_name,
        role
    )
    VALUES (
        NEW.id,
        user_name,
        user_role
    );

    IF user_role = 'student' THEN

        INSERT INTO public.student_profiles (
            id,
            roll_number
        )
        VALUES (
            NEW.id,
            user_roll_number
        );

    END IF;

    RETURN NEW;

END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_institution_active"("target_institution_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.institutions i
        WHERE i.id = target_institution_id
          AND i.status = 'active'
    );
$$;


ALTER FUNCTION "public"."is_institution_active"("target_institution_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_institution_admin"("target_institution_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1
            FROM public.institution_memberships im
            WHERE im.user_id = (SELECT auth.uid())
              AND im.institution_id = target_institution_id
              AND im.role = 'admin'
              AND im.status = 'active'
        );
$$;


ALTER FUNCTION "public"."is_institution_admin"("target_institution_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.platform_admins pa
        WHERE pa.user_id = (SELECT auth.uid())
    );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_student_enrolled_in_class"("target_class_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.classes c
            ON c.id = e.class_id
        JOIN public.departments d
            ON d.id = c.department_id
        JOIN public.institution_memberships im
            ON im.institution_id = d.institution_id
        WHERE e.class_id = target_class_id
          AND e.student_id = (SELECT auth.uid())
          AND im.user_id = (SELECT auth.uid())
          AND im.role = 'student'
          AND im.status = 'active'
    );
$$;


ALTER FUNCTION "public"."is_student_enrolled_in_class"("target_class_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lookup_auth_user_id_by_email"("target_email" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT u.id
    FROM auth.users AS u
    WHERE lower(u.email) = lower(trim(target_email))
    LIMIT 1;
$$;


ALTER FUNCTION "public"."lookup_auth_user_id_by_email"("target_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."open_attendance_session"("p_class_id" "uuid", "p_subject_id" "uuid", "p_type" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_department_id UUID;
    v_has_lab BOOLEAN;
    v_closing_time TIME;
    v_today DATE;
    v_current_time TIME;
    v_session_id UUID;
    v_session_status TEXT;

BEGIN

    -- 1. Verify authentication
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;


    -- 2. Verify teacher role
    SELECT role
    INTO v_user_role
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_role IS DISTINCT FROM 'teacher' THEN
        RAISE EXCEPTION
            'Only teachers can open attendance sessions';
    END IF;


    -- 3. Validate attendance type
    IF p_type IS NULL
       OR p_type NOT IN ('theory', 'lab') THEN

        RAISE EXCEPTION 'Invalid attendance type';

    END IF;


    -- 4. Validate class and subject relationship
    SELECT
        s.has_lab,
        c.department_id
    INTO
        v_has_lab,
        v_department_id
    FROM public.subjects s
    JOIN public.classes c
        ON c.id = s.class_id
    WHERE s.id = p_subject_id
      AND s.class_id = p_class_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Subject does not belong to the selected class';
    END IF;


    -- 5. Verify active teacher membership and institution
    IF NOT EXISTS (
        SELECT 1
        FROM public.departments d
        JOIN public.institution_memberships im
            ON im.institution_id = d.institution_id
        WHERE d.id = v_department_id
          AND im.user_id = v_user_id
          AND im.role = 'teacher'
          AND im.status = 'active'
          AND public.is_institution_active(d.institution_id)
    ) THEN
        RAISE EXCEPTION
            'You do not have an active teacher membership in this institution';
    END IF;


    -- 6. Verify exact teacher assignment
    IF NOT EXISTS (
        SELECT 1
        FROM public.teaching_assignments ta
        WHERE ta.teacher_id = v_user_id
          AND ta.class_id = p_class_id
          AND ta.subject_id = p_subject_id
    ) THEN

        RAISE EXCEPTION
            'You are not assigned to this subject and class';

    END IF;


    -- 7. Reject lab sessions for subjects without labs
    IF p_type = 'lab'
       AND v_has_lab IS NOT TRUE THEN

        RAISE EXCEPTION
            'This subject does not have a lab';

    END IF;


    -- 8. Get current Indian date and time
    v_today := (
        NOW() AT TIME ZONE 'Asia/Kolkata'
    )::DATE;

    v_current_time := (
        NOW() AT TIME ZONE 'Asia/Kolkata'
    )::TIME;


    -- 9. Get department closing time
    SELECT closing_time
    INTO v_closing_time
    FROM public.department_attendance_settings
    WHERE department_id = v_department_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Department attendance settings are missing';
    END IF;


    -- 10. Check for an existing class-specific session
    SELECT id, status
    INTO v_session_id, v_session_status
    FROM public.attendance_sessions
    WHERE class_id = p_class_id
      AND subject_id = p_subject_id
      AND attendance_date = v_today
      AND type = p_type
    FOR UPDATE;

    IF FOUND THEN

        IF v_session_status = 'cancelled' THEN
            RAISE EXCEPTION
                'This attendance session was cancelled';
        END IF;

        IF v_session_status <> 'open' THEN
            RAISE EXCEPTION
                'This attendance session is already closed';
        END IF;

        IF v_current_time >= v_closing_time THEN
            RAISE EXCEPTION
                'Department attendance closing time has passed';
        END IF;

        RETURN v_session_id;

    END IF;


    -- 11. Do not create a session after closing time
    IF v_current_time >= v_closing_time THEN
        RAISE EXCEPTION
            'Attendance session opening time has expired';
    END IF;


    -- 12. Create a class-specific session
    INSERT INTO public.attendance_sessions (
        class_id,
        subject_id,
        attendance_date,
        type,
        opened_by,
        status
    )
    VALUES (
        p_class_id,
        p_subject_id,
        v_today,
        p_type,
        v_user_id,
        'open'
    )
    ON CONFLICT (
        class_id,
        subject_id,
        attendance_date,
        type
    )
    DO NOTHING;


    -- 13. Retrieve and lock the session
    SELECT id, status
    INTO v_session_id, v_session_status
    FROM public.attendance_sessions
    WHERE class_id = p_class_id
      AND subject_id = p_subject_id
      AND attendance_date = v_today
      AND type = p_type
    FOR UPDATE;

    IF NOT FOUND OR v_session_status <> 'open' THEN
        RAISE EXCEPTION
            'The existing attendance session is not open';
    END IF;


    -- Recheck deadline after obtaining the lock
    v_current_time := (
        NOW() AT TIME ZONE 'Asia/Kolkata'
    )::TIME;

    IF v_current_time >= v_closing_time THEN
        RAISE EXCEPTION
            'Department attendance closing time has passed';
    END IF;


    -- 14. Associate existing records belonging to this class
    -- without changing their attendance statuses
    UPDATE public.attendance a
    SET session_id = v_session_id
    WHERE a.subject_id = p_subject_id
      AND a.attendance_date = v_today
      AND a.type = p_type
      AND a.session_id IS NULL
      AND EXISTS (
          SELECT 1
          FROM public.enrollments e
          WHERE e.student_id = a.student_id
            AND e.class_id = p_class_id
      );


    -- 15. Create pending records for enrolled students
    INSERT INTO public.attendance (
        student_id,
        subject_id,
        attendance_date,
        type,
        status,
        session_id
    )
    SELECT
        e.student_id,
        p_subject_id,
        v_today,
        p_type,
        'pending',
        v_session_id
    FROM public.enrollments e
    WHERE e.class_id = p_class_id

    ON CONFLICT (
        student_id,
        subject_id,
        attendance_date,
        type
    )
    DO NOTHING;


    RETURN v_session_id;

END;
$$;


ALTER FUNCTION "public"."open_attendance_session"("p_class_id" "uuid", "p_subject_id" "uuid", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_profile_role_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF (SELECT auth.uid()) IS NOT NULL THEN

        IF TG_OP = 'INSERT'
           AND NEW.id = (SELECT auth.uid())
           AND NEW.role <> 'student' THEN

            RAISE EXCEPTION
                'Users cannot assign their own profile role.';
        END IF;

        IF TG_OP = 'UPDATE'
           AND OLD.id = (SELECT auth.uid())
           AND NEW.role IS DISTINCT FROM OLD.role THEN

            RAISE EXCEPTION
                'Users cannot change their own profile role.';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_profile_role_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_student_attendance"("p_session_id" "uuid", "p_status" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_subject_id UUID;
    v_class_id UUID;
    v_session_date DATE;
    v_session_type TEXT;
    v_session_status TEXT;
    v_closing_time TIME;
    v_attendance_id UUID;
    v_today DATE;
    v_current_time TIME;
BEGIN

    -- 1. Verify authentication
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;


    -- 2. Verify student role
    SELECT p.role
    INTO v_user_role
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_user_role IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION
            'Only students can submit attendance';
    END IF;


    -- 3. Validate student-selectable statuses
    IF p_status IS NULL OR p_status NOT IN (
        'present',
        'absent',
        'leftEarly',
        'partial',
        'club',
        'noClass',
        'noLab'
    ) THEN
        RAISE EXCEPTION
            'Invalid student attendance status';
    END IF;


    -- 4. Lock the session before checking its status.
    -- This serializes submissions with automatic session closure.
    SELECT
        ss.subject_id,
        sub.class_id,
        ss.attendance_date,
        ss.type,
        ss.status,
        das.closing_time
    INTO
        v_subject_id,
        v_class_id,
        v_session_date,
        v_session_type,
        v_session_status,
        v_closing_time
    FROM public.attendance_sessions ss
    JOIN public.subjects sub
        ON sub.id = ss.subject_id
    JOIN public.classes c
        ON c.id = sub.class_id
    JOIN public.department_attendance_settings das
        ON das.department_id = c.department_id
    WHERE ss.id = p_session_id
    FOR UPDATE OF ss;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Session or department settings not found';
    END IF;


    -- 5. Verify active student membership and institution
    IF NOT EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.departments d
            ON d.id = c.department_id
        JOIN public.institution_memberships im
            ON im.institution_id = d.institution_id
        WHERE c.id = v_class_id
          AND im.user_id = v_user_id
          AND im.role = 'student'
          AND im.status = 'active'
          AND public.is_institution_active(d.institution_id)
    ) THEN
        RAISE EXCEPTION
            'You do not have an active student membership in this institution';
    END IF;


    -- 6. Validate today's date using India time
    v_today := (
        NOW() AT TIME ZONE 'Asia/Kolkata'
    )::DATE;

    v_current_time := (
        NOW() AT TIME ZONE 'Asia/Kolkata'
    )::TIME;

    IF v_session_date <> v_today THEN
        RAISE EXCEPTION
            'Attendance can only be submitted for today';
    END IF;


    -- 7. Verify that the session is open
    IF v_session_status <> 'open' THEN
        RAISE EXCEPTION
            'This attendance session is not open';
    END IF;


    -- 8. Check department closing time
    IF v_current_time >= v_closing_time THEN
        RAISE EXCEPTION
            'Attendance submission deadline has passed';
    END IF;


    -- 9. Verify student enrollment
    IF NOT EXISTS (
        SELECT 1
        FROM public.enrollments e
        WHERE e.student_id = v_user_id
          AND e.class_id = v_class_id
    ) THEN
        RAISE EXCEPTION
            'You are not enrolled in this class';
    END IF;


    -- 10. Insert or update the existing attendance record.
    -- Unlimited changes are allowed before closing,
    -- but only one record is maintained.
    INSERT INTO public.attendance AS existing (
        student_id,
        subject_id,
        attendance_date,
        type,
        status,
        session_id
    )
    VALUES (
        v_user_id,
        v_subject_id,
        v_session_date,
        v_session_type,
        p_status,
        p_session_id
    )
    ON CONFLICT (
        student_id,
        subject_id,
        attendance_date,
        type
    )
    DO UPDATE SET
        status = EXCLUDED.status,
        session_id = EXCLUDED.session_id,
        updated_at = NOW()
    WHERE existing.session_id = EXCLUDED.session_id
    RETURNING existing.id INTO v_attendance_id;

    IF v_attendance_id IS NULL THEN
        RAISE EXCEPTION
            'An attendance record already exists outside this session';
    END IF;


    RETURN v_attendance_id;

END;
$$;


ALTER FUNCTION "public"."submit_student_attendance"("p_session_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academic_working_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "day_of_week" "text" NOT NULL,
    CONSTRAINT "valid_weekday" CHECK (("day_of_week" = ANY (ARRAY['Monday'::"text", 'Tuesday'::"text", 'Wednesday'::"text", 'Thursday'::"text", 'Friday'::"text", 'Saturday'::"text", 'Sunday'::"text"])))
);


ALTER TABLE "public"."academic_working_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academic_years" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "working_days" "text"[] DEFAULT ARRAY['Monday'::"text", 'Tuesday'::"text", 'Wednesday'::"text", 'Thursday'::"text", 'Friday'::"text", 'Saturday'::"text"] NOT NULL,
    "institution_id" "uuid" NOT NULL,
    CONSTRAINT "academic_year_dates_check" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."academic_years" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "institution_name" "text" NOT NULL,
    "city" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'withdrawn'::"text"]))),
    CONSTRAINT "admin_request_city_not_empty" CHECK (("length"(TRIM(BOTH FROM "city")) > 0)),
    CONSTRAINT "admin_request_email_not_empty" CHECK (("length"(TRIM(BOTH FROM "email")) > 0)),
    CONSTRAINT "admin_request_full_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "full_name")) > 0)),
    CONSTRAINT "admin_request_institution_not_empty" CHECK (("length"(TRIM(BOTH FROM "institution_name")) > 0)),
    CONSTRAINT "admin_request_reason_not_empty" CHECK (("length"(TRIM(BOTH FROM "reason")) > 0))
);


ALTER TABLE "public"."admin_access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_at" timestamp with time zone,
    "marked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assignment_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'submitted'::"text"])))
);


ALTER TABLE "public"."assignment_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "attendance_date" "date" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid",
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'absent'::"text", 'leftEarly'::"text", 'club'::"text", 'partial'::"text", 'noClass'::"text", 'noLab'::"text", 'onLeave'::"text", 'pending'::"text"]))),
    CONSTRAINT "attendance_type_check" CHECK (("type" = ANY (ARRAY['theory'::"text", 'lab'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_correction_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attendance_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "old_status" "text" NOT NULL,
    "new_status" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "attendance_correction_logs_reason_check" CHECK (("length"(TRIM(BOTH FROM "reason")) > 0))
);


ALTER TABLE "public"."attendance_correction_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "attendance_date" "date" NOT NULL,
    "type" "text" NOT NULL,
    "opened_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    CONSTRAINT "attendance_sessions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "attendance_sessions_type_check" CHECK (("type" = ANY (ARRAY['theory'::"text", 'lab'::"text"])))
);


ALTER TABLE "public"."attendance_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "section" "text",
    "semester" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "department_id" "uuid" NOT NULL,
    "academic_year_id" "uuid" NOT NULL
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_attendance_settings" (
    "department_id" "uuid" NOT NULL,
    "theory_threshold" numeric(5,2),
    "lab_threshold" numeric(5,2),
    "closing_time" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "department_attendance_settings_lab_threshold_check" CHECK ((("lab_threshold" IS NULL) OR (("lab_threshold" >= (0)::numeric) AND ("lab_threshold" <= (100)::numeric)))),
    CONSTRAINT "department_attendance_settings_theory_threshold_check" CHECK ((("theory_threshold" IS NULL) OR (("theory_threshold" >= (0)::numeric) AND ("theory_threshold" <= (100)::numeric))))
);


ALTER TABLE "public"."department_attendance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "chart_color" "text"
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "holiday_date" "date" NOT NULL,
    "description" "text",
    "scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "groups" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_holiday_groups" CHECK (((("scope" = 'selected'::"text") AND ("cardinality"("groups") > 0)) OR (("scope" <> 'selected'::"text") AND ("cardinality"("groups") = 0)))),
    CONSTRAINT "valid_holiday_scope" CHECK (("scope" = ANY (ARRAY['all'::"text", 'students'::"text", 'teachers'::"text", 'selected'::"text"])))
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institution_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "accepted_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    CONSTRAINT "institution_invitations_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text"]))),
    CONSTRAINT "institution_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "valid_invitation_email" CHECK ((("email" = "lower"(TRIM(BOTH FROM "email"))) AND (POSITION(('@'::"text") IN ("email")) > 1))),
    CONSTRAINT "valid_invitation_expiry" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "valid_invitation_name" CHECK (("length"(TRIM(BOTH FROM "full_name")) > 0))
);


ALTER TABLE "public"."institution_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institution_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "institution_memberships_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'admin'::"text"]))),
    CONSTRAINT "institution_memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'invited'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."institution_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_name" "text" NOT NULL,
    "city" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    CONSTRAINT "institutions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."semesters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "semester_number" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_custom_dates" boolean DEFAULT false NOT NULL,
    CONSTRAINT "valid_semester_dates" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "valid_semester_number" CHECK ((("semester_number" >= 1) AND ("semester_number" <= 8)))
);


ALTER TABLE "public"."semesters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_profiles" (
    "id" "uuid" NOT NULL,
    "roll_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "has_lab" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_departments" (
    "teacher_id" "uuid" NOT NULL,
    "department_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teacher_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teaching_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teaching_assignments" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academic_working_days"
    ADD CONSTRAINT "academic_working_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_access_requests"
    ADD CONSTRAINT "admin_access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_assignment_id_student_id_key" UNIQUE ("assignment_id", "student_id");



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_correction_logs"
    ADD CONSTRAINT "attendance_correction_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_subject_id_attendance_date_type_key" UNIQUE ("student_id", "subject_id", "attendance_date", "type");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_attendance_settings"
    ADD CONSTRAINT "department_attendance_settings_pkey" PRIMARY KEY ("department_id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_institution_name_key" UNIQUE ("institution_id", "name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_class_id_key" UNIQUE ("student_id", "class_id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institution_invitations"
    ADD CONSTRAINT "institution_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institution_invitations"
    ADD CONSTRAINT "institution_invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."institution_memberships"
    ADD CONSTRAINT "institution_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institution_memberships"
    ADD CONSTRAINT "institution_memberships_user_id_institution_id_key" UNIQUE ("user_id", "institution_id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "semesters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_departments"
    ADD CONSTRAINT "teacher_departments_pkey" PRIMARY KEY ("teacher_id", "department_id");



ALTER TABLE ONLY "public"."teaching_assignments"
    ADD CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teaching_assignments"
    ADD CONSTRAINT "teaching_assignments_teacher_id_class_id_subject_id_key" UNIQUE ("teacher_id", "class_id", "subject_id");



ALTER TABLE ONLY "public"."academic_working_days"
    ADD CONSTRAINT "unique_academic_working_day" UNIQUE ("academic_year_id", "day_of_week");



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "unique_attendance_session" UNIQUE ("class_id", "subject_id", "attendance_date", "type");



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "unique_semester_per_year" UNIQUE ("academic_year_id", "semester_number");



CREATE INDEX "idx_admin_requests_requester" ON "public"."admin_access_requests" USING "btree" ("requester_id");



CREATE INDEX "idx_admin_requests_status" ON "public"."admin_access_requests" USING "btree" ("status");



CREATE INDEX "idx_assignment_submissions_assignment" ON "public"."assignment_submissions" USING "btree" ("assignment_id");



CREATE INDEX "idx_assignment_submissions_student" ON "public"."assignment_submissions" USING "btree" ("student_id");



CREATE INDEX "idx_assignments_class" ON "public"."assignments" USING "btree" ("class_id");



CREATE INDEX "idx_assignments_subject" ON "public"."assignments" USING "btree" ("subject_id");



CREATE INDEX "idx_assignments_teacher" ON "public"."assignments" USING "btree" ("teacher_id");



CREATE INDEX "idx_attendance_correction_logs_attendance" ON "public"."attendance_correction_logs" USING "btree" ("attendance_id");



CREATE INDEX "idx_attendance_correction_logs_teacher" ON "public"."attendance_correction_logs" USING "btree" ("teacher_id");



CREATE INDEX "idx_attendance_date" ON "public"."attendance" USING "btree" ("attendance_date");



CREATE INDEX "idx_attendance_session_id" ON "public"."attendance" USING "btree" ("session_id");



CREATE INDEX "idx_attendance_sessions_opened_by" ON "public"."attendance_sessions" USING "btree" ("opened_by");



CREATE INDEX "idx_attendance_sessions_subject_date" ON "public"."attendance_sessions" USING "btree" ("subject_id", "attendance_date");



CREATE INDEX "idx_attendance_student_date" ON "public"."attendance" USING "btree" ("student_id", "attendance_date");



CREATE INDEX "idx_attendance_student_id" ON "public"."attendance" USING "btree" ("student_id");



CREATE INDEX "idx_attendance_subject_id" ON "public"."attendance" USING "btree" ("subject_id");



CREATE INDEX "idx_classes_academic_year_id" ON "public"."classes" USING "btree" ("academic_year_id");



CREATE INDEX "idx_enrollments_class_id" ON "public"."enrollments" USING "btree" ("class_id");



CREATE INDEX "idx_enrollments_student_id" ON "public"."enrollments" USING "btree" ("student_id");



CREATE INDEX "idx_holidays_academic_year" ON "public"."holidays" USING "btree" ("academic_year_id");



CREATE INDEX "idx_holidays_date" ON "public"."holidays" USING "btree" ("holiday_date");



CREATE INDEX "idx_memberships_institution" ON "public"."institution_memberships" USING "btree" ("institution_id");



CREATE INDEX "idx_memberships_user" ON "public"."institution_memberships" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_one_pending_admin_request_per_user" ON "public"."admin_access_requests" USING "btree" ("requester_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_semesters_academic_year" ON "public"."semesters" USING "btree" ("academic_year_id");



CREATE INDEX "idx_student_profiles_roll_number" ON "public"."student_profiles" USING "btree" ("roll_number");



CREATE INDEX "idx_subjects_class_id" ON "public"."subjects" USING "btree" ("class_id");



CREATE INDEX "idx_working_days_academic_year" ON "public"."academic_working_days" USING "btree" ("academic_year_id");



CREATE UNIQUE INDEX "institution_invitations_one_pending_per_email" ON "public"."institution_invitations" USING "btree" ("institution_id", "email") WHERE ("status" = 'pending'::"text");



CREATE UNIQUE INDEX "one_active_academic_year" ON "public"."academic_years" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "unique_pending_institution_invitation" ON "public"."institution_invitations" USING "btree" ("institution_id", "lower"("email")) WHERE ("status" = 'pending'::"text");



CREATE OR REPLACE TRIGGER "attendance_updated_at" BEFORE UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "department_attendance_settings_updated_at" BEFORE UPDATE ON "public"."department_attendance_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "on_assignment_created" AFTER INSERT ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."create_pending_assignment_submissions"();



CREATE OR REPLACE TRIGGER "prevent_profile_role_escalation" BEFORE INSERT OR UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_profile_role_escalation"();



ALTER TABLE ONLY "public"."academic_working_days"
    ADD CONSTRAINT "academic_working_days_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_access_requests"
    ADD CONSTRAINT "admin_access_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_access_requests"
    ADD CONSTRAINT "admin_access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_correction_logs"
    ADD CONSTRAINT "attendance_correction_logs_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_correction_logs"
    ADD CONSTRAINT "attendance_correction_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_correction_logs"
    ADD CONSTRAINT "attendance_correction_logs_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_correction_logs"
    ADD CONSTRAINT "attendance_correction_logs_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."department_attendance_settings"
    ADD CONSTRAINT "department_attendance_settings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."institution_invitations"
    ADD CONSTRAINT "institution_invitations_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."institution_invitations"
    ADD CONSTRAINT "institution_invitations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."institution_invitations"
    ADD CONSTRAINT "institution_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."institution_memberships"
    ADD CONSTRAINT "institution_memberships_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."institution_memberships"
    ADD CONSTRAINT "institution_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."semesters"
    ADD CONSTRAINT "semesters_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_departments"
    ADD CONSTRAINT "teacher_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_departments"
    ADD CONSTRAINT "teacher_departments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teaching_assignments"
    ADD CONSTRAINT "teaching_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teaching_assignments"
    ADD CONSTRAINT "teaching_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teaching_assignments"
    ADD CONSTRAINT "teaching_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Active students can view enrolled sessions" ON "public"."attendance_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((("public"."enrollments" "e"
     JOIN "public"."institution_memberships" "im" ON (("im"."user_id" = "e"."student_id")))
     JOIN "public"."classes" "c" ON (("c"."id" = "attendance_sessions"."class_id")))
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("e"."class_id" = "attendance_sessions"."class_id") AND ("im"."institution_id" = "d"."institution_id") AND ("im"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."role" = 'student'::"text") AND ("im"."status" = 'active'::"text")))));



CREATE POLICY "Active students can view own attendance" ON "public"."attendance" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM ((("public"."subjects" "s"
     JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
     JOIN "public"."institution_memberships" "im" ON (("im"."institution_id" = "d"."institution_id")))
  WHERE (("s"."id" = "attendance"."subject_id") AND ("im"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."role" = 'student'::"text") AND ("im"."status" = 'active'::"text"))))));



CREATE POLICY "Active teachers can view assigned attendance" ON "public"."attendance" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((((("public"."enrollments" "e"
     JOIN "public"."teaching_assignments" "ta" ON ((("ta"."class_id" = "e"."class_id") AND ("ta"."subject_id" = "attendance"."subject_id"))))
     JOIN "public"."subjects" "s" ON (("s"."id" = "attendance"."subject_id")))
     JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
     JOIN "public"."institution_memberships" "im" ON (("im"."institution_id" = "d"."institution_id")))
  WHERE (("e"."student_id" = "attendance"."student_id") AND ("ta"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."role" = 'teacher'::"text") AND ("im"."status" = 'active'::"text")))));



CREATE POLICY "Active teachers can view assigned sessions" ON "public"."attendance_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((("public"."teaching_assignments" "ta"
     JOIN "public"."classes" "c" ON (("c"."id" = "attendance_sessions"."class_id")))
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
     JOIN "public"."institution_memberships" "im" ON (("im"."institution_id" = "d"."institution_id")))
  WHERE (("ta"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ta"."class_id" = "attendance_sessions"."class_id") AND ("ta"."subject_id" = "attendance_sessions"."subject_id") AND ("im"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."role" = 'teacher'::"text") AND ("im"."status" = 'active'::"text")))));



CREATE POLICY "Active teachers can view own assignments" ON "public"."teaching_assignments" FOR SELECT TO "authenticated" USING ((("teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM (("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
     JOIN "public"."institution_memberships" "im" ON (("im"."institution_id" = "d"."institution_id")))
  WHERE (("c"."id" = "teaching_assignments"."class_id") AND ("im"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."role" = 'teacher'::"text") AND ("im"."status" = 'active'::"text"))))));



CREATE POLICY "Assignment creators can view submissions" ON "public"."assignment_submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "assignment_submissions"."assignment_id") AND ("a"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Institution admins can create teaching assignments" ON "public"."teaching_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
     JOIN "public"."subjects" "s" ON ((("s"."id" = "teaching_assignments"."subject_id") AND ("s"."class_id" = "c"."id"))))
     JOIN "public"."institution_memberships" "teacher_membership" ON ((("teacher_membership"."institution_id" = "d"."institution_id") AND ("teacher_membership"."user_id" = "teaching_assignments"."teacher_id") AND ("teacher_membership"."role" = 'teacher'::"text") AND ("teacher_membership"."status" = 'active'::"text"))))
  WHERE (("c"."id" = "teaching_assignments"."class_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can delete academic years" ON "public"."academic_years" FOR DELETE TO "authenticated" USING (("public"."is_platform_admin"() OR "public"."is_institution_admin"("institution_id")));



CREATE POLICY "Institution admins can delete holidays" ON "public"."holidays" FOR DELETE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "holidays"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can delete semesters" ON "public"."semesters" FOR DELETE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "semesters"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can delete teaching assignments" ON "public"."teaching_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("c"."id" = "teaching_assignments"."class_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can delete working days" ON "public"."academic_working_days" FOR DELETE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "academic_working_days"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can insert academic years" ON "public"."academic_years" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_platform_admin"() OR "public"."is_institution_admin"("institution_id")));



CREATE POLICY "Institution admins can insert attendance settings" ON "public"."department_attendance_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_attendance_settings"."department_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can insert holidays" ON "public"."holidays" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "holidays"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can insert semesters" ON "public"."semesters" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "semesters"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can insert working days" ON "public"."academic_working_days" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "academic_working_days"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can update academic years" ON "public"."academic_years" FOR UPDATE TO "authenticated" USING (("public"."is_platform_admin"() OR "public"."is_institution_admin"("institution_id"))) WITH CHECK (("public"."is_platform_admin"() OR "public"."is_institution_admin"("institution_id")));



CREATE POLICY "Institution admins can update attendance settings" ON "public"."department_attendance_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_attendance_settings"."department_id") AND "public"."is_institution_admin"("d"."institution_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_attendance_settings"."department_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can update holidays" ON "public"."holidays" FOR UPDATE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "holidays"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "holidays"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can update semesters" ON "public"."semesters" FOR UPDATE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "semesters"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "semesters"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can update teaching assignments" ON "public"."teaching_assignments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("c"."id" = "teaching_assignments"."class_id") AND "public"."is_institution_admin"("d"."institution_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
     JOIN "public"."subjects" "s" ON ((("s"."id" = "teaching_assignments"."subject_id") AND ("s"."class_id" = "c"."id"))))
     JOIN "public"."institution_memberships" "teacher_membership" ON ((("teacher_membership"."institution_id" = "d"."institution_id") AND ("teacher_membership"."user_id" = "teaching_assignments"."teacher_id") AND ("teacher_membership"."role" = 'teacher'::"text") AND ("teacher_membership"."status" = 'active'::"text"))))
  WHERE (("c"."id" = "teaching_assignments"."class_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can update working days" ON "public"."academic_working_days" FOR UPDATE TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "academic_working_days"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id")))))) WITH CHECK (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."academic_years" "ay"
  WHERE (("ay"."id" = "academic_working_days"."academic_year_id") AND "public"."is_institution_admin"("ay"."institution_id"))))));



CREATE POLICY "Institution admins can view attendance" ON "public"."attendance" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."subjects" "s"
     JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("s"."id" = "attendance"."subject_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can view attendance sessions" ON "public"."attendance_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("c"."id" = "attendance_sessions"."class_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can view attendance settings" ON "public"."department_attendance_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_attendance_settings"."department_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can view teaching assignments" ON "public"."teaching_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("c"."id" = "teaching_assignments"."class_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can view their classes" ON "public"."classes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "classes"."department_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution admins can view their departments" ON "public"."departments" FOR SELECT TO "authenticated" USING ("public"."is_institution_admin"("institution_id"));



CREATE POLICY "Institution admins can view their subjects" ON "public"."subjects" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classes" "c"
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("c"."id" = "subjects"."class_id") AND "public"."is_institution_admin"("d"."institution_id")))));



CREATE POLICY "Institution and platform admins can view correction logs" ON "public"."attendance_correction_logs" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM (("public"."subjects" "s"
     JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     JOIN "public"."departments" "d" ON (("d"."id" = "c"."department_id")))
  WHERE (("s"."id" = "attendance_correction_logs"."subject_id") AND "public"."is_institution_admin"("d"."institution_id"))))));



CREATE POLICY "Institution and platform admins can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."institution_memberships" "im"
  WHERE (("im"."user_id" = "profiles"."id") AND ("im"."status" = 'active'::"text") AND "public"."is_institution_admin"("im"."institution_id"))))));



CREATE POLICY "Members can view institution academic years" ON "public"."academic_years" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."institution_memberships" "im"
  WHERE (("im"."institution_id" = "academic_years"."institution_id") AND ("im"."user_id" = "auth"."uid"()) AND ("im"."status" = 'active'::"text"))))));



CREATE POLICY "Members can view institution holidays" ON "public"."holidays" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."academic_years" "ay"
     JOIN "public"."institution_memberships" "im" ON (("im"."institution_id" = "ay"."institution_id")))
  WHERE (("ay"."id" = "holidays"."academic_year_id") AND ("im"."user_id" = "auth"."uid"()) AND ("im"."status" = 'active'::"text"))))));



CREATE POLICY "Members can view institution semesters" ON "public"."semesters" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."academic_years" "ay"
     JOIN "public"."institution_memberships" "im" ON (("im"."institution_id" = "ay"."institution_id")))
  WHERE (("ay"."id" = "semesters"."academic_year_id") AND ("im"."user_id" = "auth"."uid"()) AND ("im"."status" = 'active'::"text"))))));



CREATE POLICY "Members can view institution working days" ON "public"."academic_working_days" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."academic_years" "ay"
     JOIN "public"."institution_memberships" "im" ON (("im"."institution_id" = "ay"."institution_id")))
  WHERE (("ay"."id" = "academic_working_days"."academic_year_id") AND ("im"."user_id" = "auth"."uid"()) AND ("im"."status" = 'active'::"text"))))));



CREATE POLICY "Members can view their institutions" ON "public"."institutions" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."institution_memberships" "im"
  WHERE (("im"."institution_id" = "institutions"."id") AND ("im"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."status" = 'active'::"text"))))));



CREATE POLICY "Platform admins can view platform admins" ON "public"."platform_admins" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_platform_admin"()));



CREATE POLICY "Students can insert own student profile" ON "public"."student_profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Students can update own student profile" ON "public"."student_profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Students can view assignments for enrolled classes" ON "public"."assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."class_id" = "assignments"."class_id") AND ("e"."student_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Students can view enrolled classes" ON "public"."classes" FOR SELECT TO "authenticated" USING ("public"."is_student_enrolled_in_class"("id"));



CREATE POLICY "Students can view own student profile" ON "public"."student_profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Students can view own submission status" ON "public"."assignment_submissions" FOR SELECT TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Students can view subjects of enrolled classes" ON "public"."subjects" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."class_id" = "subjects"."class_id") AND ("e"."student_id" = "auth"."uid"())))));



CREATE POLICY "Students can view their enrolled departments" ON "public"."departments" FOR SELECT TO "authenticated" USING ("public"."can_student_view_department"("id"));



CREATE POLICY "Teachers can create assigned class assignments" ON "public"."assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."teaching_assignments" "ta"
  WHERE (("ta"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ta"."class_id" = "assignments"."class_id") AND ("ta"."subject_id" = "assignments"."subject_id")))));



CREATE POLICY "Teachers can create assigned student submissions" ON "public"."assignment_submissions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM (("public"."assignments" "a"
     JOIN "public"."teaching_assignments" "ta" ON ((("ta"."class_id" = "a"."class_id") AND ("ta"."subject_id" = "a"."subject_id"))))
     JOIN "public"."enrollments" "e" ON (("e"."class_id" = "a"."class_id")))
  WHERE (("a"."id" = "assignment_submissions"."assignment_id") AND ("ta"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("e"."student_id" = "assignment_submissions"."student_id")))) AND ("status" = 'pending'::"text") AND ("submitted_at" IS NULL) AND ("marked_by" IS NULL)));



CREATE POLICY "Teachers can delete own assignments" ON "public"."assignments" FOR DELETE TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers can update assigned student submissions" ON "public"."assignment_submissions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."assignments" "a"
     JOIN "public"."teaching_assignments" "ta" ON ((("ta"."class_id" = "a"."class_id") AND ("ta"."subject_id" = "a"."subject_id"))))
     JOIN "public"."enrollments" "e" ON (("e"."class_id" = "a"."class_id")))
  WHERE (("a"."id" = "assignment_submissions"."assignment_id") AND ("a"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ta"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("e"."student_id" = "assignment_submissions"."student_id"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM (("public"."assignments" "a"
     JOIN "public"."teaching_assignments" "ta" ON ((("ta"."class_id" = "a"."class_id") AND ("ta"."subject_id" = "a"."subject_id"))))
     JOIN "public"."enrollments" "e" ON (("e"."class_id" = "a"."class_id")))
  WHERE (("a"."id" = "assignment_submissions"."assignment_id") AND ("a"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ta"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("e"."student_id" = "assignment_submissions"."student_id")))) AND ("marked_by" = ( SELECT "auth"."uid"() AS "uid")) AND ((("status" = 'pending'::"text") AND ("submitted_at" IS NULL)) OR (("status" = 'submitted'::"text") AND ("submitted_at" IS NOT NULL)))));



CREATE POLICY "Teachers can update own assignments" ON "public"."assignments" FOR UPDATE TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."teaching_assignments" "ta"
  WHERE (("ta"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ta"."class_id" = "assignments"."class_id") AND ("ta"."subject_id" = "assignments"."subject_id"))))));



CREATE POLICY "Teachers can view assigned correction logs" ON "public"."attendance_correction_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."teaching_assignments" "ta"
     JOIN "public"."enrollments" "e" ON (("e"."class_id" = "ta"."class_id")))
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("ta"."teacher_id" = "auth"."uid"()) AND ("p"."role" = 'teacher'::"text") AND ("ta"."subject_id" = "attendance_correction_logs"."subject_id") AND ("e"."student_id" = "attendance_correction_logs"."student_id")))));



CREATE POLICY "Teachers can view assigned students" ON "public"."student_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."enrollments" "e"
     JOIN "public"."teaching_assignments" "ta" ON (("ta"."class_id" = "e"."class_id")))
  WHERE (("e"."student_id" = "student_profiles"."id") AND ("ta"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view assigned students names" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."student_profiles" "sp"
     JOIN "public"."enrollments" "e" ON (("e"."student_id" = "sp"."id")))
     JOIN "public"."teaching_assignments" "ta" ON (("ta"."class_id" = "e"."class_id")))
  WHERE (("sp"."id" = "profiles"."id") AND ("ta"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view department assignments" ON "public"."assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classes" "c"
     JOIN "public"."teacher_departments" "td" ON (("td"."department_id" = "c"."department_id")))
  WHERE (("c"."id" = "assignments"."class_id") AND ("td"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Teachers can view department classes" ON "public"."classes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."teacher_departments" "td"
  WHERE (("td"."department_id" = "classes"."department_id") AND ("td"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view department subjects" ON "public"."subjects" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classes" "c"
     JOIN "public"."teacher_departments" "td" ON (("td"."department_id" = "c"."department_id")))
  WHERE (("c"."id" = "subjects"."class_id") AND ("td"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view their own departments" ON "public"."departments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."teacher_departments" "td"
     JOIN "public"."institution_memberships" "im" ON ((("im"."user_id" = "td"."teacher_id") AND ("im"."institution_id" = "departments"."institution_id"))))
  WHERE (("td"."department_id" = "departments"."id") AND ("td"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("im"."role" = 'teacher'::"text") AND ("im"."status" = 'active'::"text")))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can view authorized enrollments" ON "public"."enrollments" FOR SELECT TO "authenticated" USING ("public"."can_view_enrollment"("student_id", "class_id"));



CREATE POLICY "Users can view authorized teacher departments" ON "public"."teacher_departments" FOR SELECT TO "authenticated" USING ("public"."can_view_teacher_department"("teacher_id", "department_id"));



CREATE POLICY "Users can view own memberships" ON "public"."institution_memberships" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_institution_admin"("institution_id")));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."academic_working_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academic_years" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_access_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_correction_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_attendance_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institution_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institution_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."semesters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teaching_assignments" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_student_view_department"("target_department_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_student_view_department"("target_department_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_student_view_department"("target_department_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_enrollment"("target_student_id" "uuid", "target_class_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_enrollment"("target_student_id" "uuid", "target_class_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_enrollment"("target_student_id" "uuid", "target_class_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_teacher_department"("target_teacher_id" "uuid", "target_department_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_teacher_department"("target_teacher_id" "uuid", "target_department_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_teacher_department"("target_teacher_id" "uuid", "target_department_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_attendance_session"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_attendance_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_attendance_session"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_expired_attendance_sessions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_expired_attendance_sessions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."correct_attendance"("p_attendance_id" "uuid", "p_new_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."correct_attendance"("p_attendance_id" "uuid", "p_new_status" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correct_attendance"("p_attendance_id" "uuid", "p_new_status" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_pending_assignment_submissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_pending_assignment_submissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_pending_assignment_submissions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_assignment_creator_names"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_assignment_creator_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_assignment_creator_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_assignment_details"("p_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_assignment_details"("p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_assignment_details"("p_assignment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_student_attendance_session"("p_subject_id" "uuid", "p_attendance_date" "date", "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_student_attendance_session"("p_subject_id" "uuid", "p_attendance_date" "date", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_attendance_session"("p_subject_id" "uuid", "p_attendance_date" "date", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_institution_active"("target_institution_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_institution_active"("target_institution_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_institution_active"("target_institution_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_institution_admin"("target_institution_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_institution_admin"("target_institution_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_institution_admin"("target_institution_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_institution_admin"("target_institution_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_student_enrolled_in_class"("target_class_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_student_enrolled_in_class"("target_class_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_student_enrolled_in_class"("target_class_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lookup_auth_user_id_by_email"("target_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lookup_auth_user_id_by_email"("target_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."open_attendance_session"("p_class_id" "uuid", "p_subject_id" "uuid", "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."open_attendance_session"("p_class_id" "uuid", "p_subject_id" "uuid", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."open_attendance_session"("p_class_id" "uuid", "p_subject_id" "uuid", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_profile_role_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_profile_role_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_profile_role_escalation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_student_attendance"("p_session_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_student_attendance"("p_session_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_student_attendance"("p_session_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."academic_working_days" TO "anon";
GRANT ALL ON TABLE "public"."academic_working_days" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_working_days" TO "service_role";



GRANT ALL ON TABLE "public"."academic_years" TO "anon";
GRANT ALL ON TABLE "public"."academic_years" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_years" TO "service_role";



GRANT ALL ON TABLE "public"."admin_access_requests" TO "anon";
GRANT ALL ON TABLE "public"."admin_access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_submissions" TO "anon";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "service_role";
GRANT SELECT ON TABLE "public"."attendance" TO "authenticated";



GRANT ALL ON TABLE "public"."attendance_correction_logs" TO "anon";
GRANT ALL ON TABLE "public"."attendance_correction_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_correction_logs" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_sessions" TO "service_role";
GRANT SELECT ON TABLE "public"."attendance_sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."department_attendance_settings" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."department_attendance_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."holidays" TO "service_role";



GRANT ALL ON TABLE "public"."institution_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."institution_memberships" TO "anon";
GRANT ALL ON TABLE "public"."institution_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."institution_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "anon";
GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."semesters" TO "anon";
GRANT ALL ON TABLE "public"."semesters" TO "authenticated";
GRANT ALL ON TABLE "public"."semesters" TO "service_role";



GRANT ALL ON TABLE "public"."student_profiles" TO "anon";
GRANT ALL ON TABLE "public"."student_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."student_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_departments" TO "anon";
GRANT ALL ON TABLE "public"."teacher_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_departments" TO "service_role";



GRANT ALL ON TABLE "public"."teaching_assignments" TO "anon";
GRANT ALL ON TABLE "public"."teaching_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."teaching_assignments" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







