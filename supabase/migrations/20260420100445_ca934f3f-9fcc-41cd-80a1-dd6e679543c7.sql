drop policy if exists "Public can download eagle-pay-listener apk" on storage.objects;

create policy "Public can read apk bucket"
on storage.objects for select
using (bucket_id = 'apk');