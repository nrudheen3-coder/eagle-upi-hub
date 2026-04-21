insert into storage.buckets (id, name, public)
values ('apk', 'apk', true)
on conflict (id) do nothing;

create policy "Public can read apk files"
on storage.objects for select
using (bucket_id = 'apk');