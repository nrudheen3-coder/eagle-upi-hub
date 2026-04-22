drop policy if exists "Public can read apk files" on storage.objects;

create policy "Public can download eagle-pay-listener apk"
on storage.objects for select
using (bucket_id = 'apk' and name = 'eagle-pay-listener.apk');