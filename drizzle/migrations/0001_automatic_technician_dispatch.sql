CREATE INDEX IF NOT EXISTS complaints_active_technician_idx ON public.complaints (assigned_technician_id) WHERE status IN ('assigned','in_progress');
CREATE INDEX IF NOT EXISTS complaints_assignment_queue_idx ON public.complaints (created_at,id) WHERE status = 'registered' AND assigned_technician_id IS NULL;

CREATE OR REPLACE FUNCTION public.dispatch_queued_complaints()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.complaints; chosen uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(73422109);
  FOR c IN SELECT * FROM public.complaints WHERE status = 'registered' AND assigned_technician_id IS NULL ORDER BY created_at,id FOR UPDATE LOOP
    SELECT t.user_id INTO chosen FROM public.technicians t
    WHERE t.is_available AND t.category_id = c.category_id
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = t.user_id AND ur.role = 'technician')
    ORDER BY (SELECT count(*) FROM public.complaints active WHERE active.assigned_technician_id = t.user_id AND active.status IN ('assigned','in_progress')),
      (SELECT max(a.created_at) FROM public.assignments a WHERE a.technician_id = t.user_id) ASC NULLS FIRST,
      t.created_at,t.user_id LIMIT 1;
    IF chosen IS NOT NULL THEN
      UPDATE public.complaints SET assigned_technician_id = chosen, status = 'assigned', updated_at = now() WHERE id = c.id;
      INSERT INTO public.assignments (complaint_id,technician_id,assigned_by,note) VALUES (c.id,chosen,NULL,'Automatically assigned by category and active workload');
      INSERT INTO public.complaint_updates (complaint_id,author_id,old_status,new_status,note)
        VALUES (c.id,NULL,'registered','assigned','Automatically assigned to ' || (SELECT full_name FROM public.profiles WHERE id = chosen));
      PERFORM public.notify(chosen,c.id,'New job assigned ' || c.ticket_no,c.title);
      PERFORM public.notify(c.reporter_id,c.id,'Technician assigned','A technician has been automatically assigned to ' || c.ticket_no || '.');
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_queued_complaints() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_queued_complaints() TO service_role;

CREATE OR REPLACE FUNCTION public.on_complaint_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.complaint_updates (complaint_id,author_id,new_status,note) VALUES (new.id,new.reporter_id,'registered','Complaint registered');
  PERFORM public.notify(ur.user_id,new.id,'New complaint ' || new.ticket_no,new.title) FROM public.user_roles ur WHERE ur.role IN ('estate_manager','admin') AND ur.user_id <> new.reporter_id;
  PERFORM public.notify(new.reporter_id,new.id,'Complaint registered','Your ticket ' || new.ticket_no || ' has been registered.');
  PERFORM public.dispatch_queued_complaints();
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.on_technician_dispatch_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.is_available AND new.category_id IS NOT NULL THEN
    PERFORM public.dispatch_queued_complaints();
  END IF;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.on_technician_dispatch_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER technician_dispatch_change AFTER INSERT OR UPDATE OF is_available,category_id ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.on_technician_dispatch_change();