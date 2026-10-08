
create type public.app_role as enum ('student','faculty','technician','estate_manager','admin');
create type public.complaint_status as enum ('registered','assigned','in_progress','resolved','closed');
create type public.complaint_priority as enum ('low','medium','high','urgent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  department text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('estate_manager','admin'))
$$;

create policy "profiles readable by signed in" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "read own roles or staff" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sla_hours int not null default 48,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories readable" on public.categories for select to authenticated using (true);
create policy "admin manages categories" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  building text not null,
  block text,
  zone text,
  created_at timestamptz not null default now(),
  unique (building, block)
);
grant select, insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;
alter table public.locations enable row level security;
create policy "locations readable" on public.locations for select to authenticated using (true);
create policy "admin manages locations" on public.locations for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.technicians to authenticated;
grant all on public.technicians to service_role;
alter table public.technicians enable row level security;
create policy "technicians readable" on public.technicians for select to authenticated using (true);
create policy "staff manage technicians" on public.technicians for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "tech toggles own availability" on public.technicians for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create sequence public.complaint_ticket_seq start 1001;
grant usage on sequence public.complaint_ticket_seq to authenticated;
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique default ('CC-' || nextval('public.complaint_ticket_seq')),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  location_id uuid not null references public.locations(id),
  room text,
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  priority complaint_priority not null default 'medium',
  status complaint_status not null default 'registered',
  photo_url text,
  assigned_technician_id uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.complaints(reporter_id);
create index on public.complaints(assigned_technician_id);
create index on public.complaints(status);
grant select, insert on public.complaints to authenticated;
grant all on public.complaints to service_role;
alter table public.complaints enable row level security;
create policy "view relevant complaints" on public.complaints for select to authenticated
  using (reporter_id = auth.uid() or assigned_technician_id = auth.uid() or public.is_staff(auth.uid()));
create policy "file own complaint" on public.complaints for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'registered' and assigned_technician_id is null);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.assignments to authenticated;
grant all on public.assignments to service_role;
alter table public.assignments enable row level security;
create policy "view assignments" on public.assignments for select to authenticated
  using (technician_id = auth.uid() or public.is_staff(auth.uid())
    or exists (select 1 from public.complaints c where c.id = complaint_id and c.reporter_id = auth.uid()));

create table public.complaint_updates (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  old_status complaint_status,
  new_status complaint_status,
  note text,
  created_at timestamptz not null default now()
);
create index on public.complaint_updates(complaint_id);
grant select on public.complaint_updates to authenticated;
grant all on public.complaint_updates to service_role;
alter table public.complaint_updates enable row level security;
create policy "view updates of visible complaints" on public.complaint_updates for select to authenticated
  using (exists (select 1 from public.complaints c where c.id = complaint_id and
    (c.reporter_id = auth.uid() or c.assigned_technician_id = auth.uid() or public.is_staff(auth.uid()))));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  complaint_id uuid references public.complaints(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, is_read);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _role app_role;
begin
  insert into public.profiles (id, full_name, email, department, phone)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), new.email,
          new.raw_user_meta_data->>'department', new.raw_user_meta_data->>'phone');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    _role := 'admin';
  elsif new.raw_user_meta_data->>'role' = 'faculty' then
    _role := 'faculty';
  else
    _role := 'student';
  end if;
  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.notify(_user uuid, _complaint uuid, _title text, _msg text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, complaint_id, title, message) values (_user, _complaint, _title, _msg);
$$;
revoke execute on function public.notify(uuid,uuid,text,text) from public, anon, authenticated;

create or replace function public.on_complaint_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.complaint_updates (complaint_id, author_id, new_status, note)
  values (new.id, new.reporter_id, 'registered', 'Complaint registered');
  perform public.notify(ur.user_id, new.id, 'New complaint ' || new.ticket_no, new.title)
    from public.user_roles ur where ur.role in ('estate_manager','admin') and ur.user_id <> new.reporter_id;
  perform public.notify(new.reporter_id, new.id, 'Complaint registered', 'Your ticket ' || new.ticket_no || ' has been registered.');
  return new;
end $$;
create trigger complaint_created after insert on public.complaints for each row execute function public.on_complaint_created();

create or replace function public.assign_technician(_complaint uuid, _technician uuid, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.complaints; ns complaint_status;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only estate managers or admins can assign technicians'; end if;
  if not exists (select 1 from public.technicians where user_id = _technician) then raise exception 'Selected user is not a technician'; end if;
  select * into c from public.complaints where id = _complaint for update;
  if not found then raise exception 'Complaint not found'; end if;
  if c.status in ('resolved','closed') then raise exception 'Cannot assign a % complaint', c.status; end if;
  ns := case when c.status = 'registered' then 'assigned'::complaint_status else c.status end;
  update public.complaints set assigned_technician_id = _technician, status = ns, updated_at = now() where id = _complaint;
  insert into public.assignments (complaint_id, technician_id, assigned_by, note) values (_complaint, _technician, auth.uid(), _note);
  insert into public.complaint_updates (complaint_id, author_id, old_status, new_status, note)
    values (_complaint, auth.uid(), c.status, ns,
            coalesce(nullif(_note,''), 'Technician assigned: ' || (select full_name from public.profiles where id = _technician)));
  perform public.notify(_technician, _complaint, 'New job assigned ' || c.ticket_no, c.title);
  perform public.notify(c.reporter_id, _complaint, 'Technician assigned', 'A technician has been assigned to ' || c.ticket_no || '.');
end $$;
revoke execute on function public.assign_technician(uuid,uuid,text) from public, anon;
grant execute on function public.assign_technician(uuid,uuid,text) to authenticated;

create or replace function public.update_complaint_status(_complaint uuid, _status complaint_status, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.complaints; uid uuid := auth.uid(); ok boolean := false;
begin
  select * into c from public.complaints where id = _complaint for update;
  if not found then raise exception 'Complaint not found'; end if;
  if public.is_staff(uid) then
    ok := (c.status::text || '>' || _status::text) in ('assigned>in_progress','in_progress>resolved','resolved>closed','resolved>in_progress','registered>closed');
  elsif c.assigned_technician_id = uid then
    ok := (c.status::text || '>' || _status::text) in ('assigned>in_progress','in_progress>resolved');
  elsif c.reporter_id = uid then
    ok := (c.status::text || '>' || _status::text) in ('resolved>closed','resolved>in_progress');
  end if;
  if not ok then raise exception 'Not allowed to move from % to %', c.status, _status; end if;
  update public.complaints set status = _status, updated_at = now(),
    resolved_at = case when _status = 'resolved' then now() else resolved_at end,
    closed_at = case when _status = 'closed' then now() else closed_at end
  where id = _complaint;
  insert into public.complaint_updates (complaint_id, author_id, old_status, new_status, note)
    values (_complaint, uid, c.status, _status, nullif(_note,''));
  if c.reporter_id <> uid then
    perform public.notify(c.reporter_id, _complaint, c.ticket_no || ' is now ' || replace(_status::text,'_',' '), coalesce(nullif(_note,''), c.title));
  end if;
  if c.assigned_technician_id is not null and c.assigned_technician_id <> uid then
    perform public.notify(c.assigned_technician_id, _complaint, c.ticket_no || ' is now ' || replace(_status::text,'_',' '), coalesce(nullif(_note,''), c.title));
  end if;
  if _status = 'resolved' then
    perform public.notify(ur.user_id, _complaint, c.ticket_no || ' resolved', c.title) from public.user_roles ur where ur.role='estate_manager' and ur.user_id <> uid;
  end if;
end $$;
revoke execute on function public.update_complaint_status(uuid,complaint_status,text) from public, anon;
grant execute on function public.update_complaint_status(uuid,complaint_status,text) to authenticated;

create or replace function public.add_complaint_note(_complaint uuid, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.complaints; uid uuid := auth.uid();
begin
  select * into c from public.complaints where id = _complaint;
  if not found or not (c.reporter_id = uid or c.assigned_technician_id = uid or public.is_staff(uid)) then raise exception 'Not allowed'; end if;
  if char_length(trim(_note)) < 2 then raise exception 'Note is too short'; end if;
  insert into public.complaint_updates (complaint_id, author_id, note) values (_complaint, uid, left(_note, 1000));
end $$;
revoke execute on function public.add_complaint_note(uuid,text) from public, anon;
grant execute on function public.add_complaint_note(uuid,text) to authenticated;

create or replace function public.set_user_role(_user uuid, _role app_role, _category uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins can change roles'; end if;
  if _user = auth.uid() and _role <> 'admin' then raise exception 'You cannot remove your own admin role'; end if;
  delete from public.user_roles where user_id = _user;
  insert into public.user_roles (user_id, role) values (_user, _role);
  if _role = 'technician' then
    insert into public.technicians (user_id, category_id) values (_user, _category)
      on conflict (user_id) do update set category_id = coalesce(excluded.category_id, public.technicians.category_id);
  else
    delete from public.technicians where user_id = _user;
  end if;
  perform public.notify(_user, null, 'Your role was updated', 'You are now: ' || replace(_role::text,'_',' '));
end $$;
revoke execute on function public.set_user_role(uuid,app_role,uuid) from public, anon;
grant execute on function public.set_user_role(uuid,app_role,uuid) to authenticated;

create policy "upload own complaint photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'complaint-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read complaint photos" on storage.objects for select to authenticated
  using (bucket_id = 'complaint-photos' and ((storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff(auth.uid()) or public.has_role(auth.uid(),'technician')));

insert into public.categories (name, description, sla_hours) values
 ('Electrical','Lights, fans, sockets, wiring, power outages',24),
 ('Plumbing','Leaks, taps, drainage, water supply',24),
 ('Carpentry','Doors, windows, furniture, locks',72),
 ('HVAC','Air conditioners, ventilation, coolers',48),
 ('IT & Network','Wi-Fi, LAN ports, projectors, lab systems',24),
 ('Housekeeping','Cleaning, waste, pest control',12),
 ('Civil','Walls, roofs, seepage, flooring, painting',120),
 ('Security','CCTV, access gates, pathway lighting',12);

insert into public.locations (building, block, zone) values
 ('Main Academic Block','A Wing','Academic'),
 ('Main Academic Block','B Wing','Academic'),
 ('Engineering Labs Complex','Ground Floor','Academic'),
 ('Engineering Labs Complex','First Floor','Academic'),
 ('Central Library','Reading Halls','Academic'),
 ('Aryabhatta Boys Hostel','Block 1','Residential'),
 ('Aryabhatta Boys Hostel','Block 2','Residential'),
 ('Sarojini Girls Hostel','Block A','Residential'),
 ('Faculty Quarters','Type III','Residential'),
 ('Central Cafeteria','Kitchen & Dining','Amenities'),
 ('Sports Complex','Indoor Arena','Amenities'),
 ('Administrative Building','Registrar Office','Administration'),
 ('Auditorium','Main Hall','Amenities'),
 ('Health Centre','OPD','Amenities');
