import 'dotenv/config';
import { getSupabaseAdmin } from '../server/supabaseAdmin.ts';

async function testStorageRange() {
  const supabase = getSupabaseAdmin();
  const testFileName = `test_fixture_video_${Date.now()}.mp4`;
  // Create a 10KB dummy video buffer with MP4 magic bytes (ftyp)
  const dummyMp4Buffer = Buffer.alloc(10240, 0);
  dummyMp4Buffer.write('ftypisom', 4, 'ascii');

  console.log('1. Uploading test media to private bucket ott-masters...');
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('ott-masters')
    .upload(testFileName, dummyMp4Buffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (uploadErr) {
    console.error('Upload Error:', uploadErr);
    return;
  }
  console.log('Upload successful:', uploadData);

  // 2. Test Public URL access (Must fail or be blocked because bucket is private)
  const { data: pubData } = supabase.storage.from('ott-masters').getPublicUrl(testFileName);
  console.log('Testing Public URL on private bucket:', pubData.publicUrl);
  try {
    const pubRes = await fetch(pubData.publicUrl);
    console.log(`Public URL HTTP Status: ${pubRes.status} (Expected: 400 or 404 or 403)`);
    if (pubRes.status === 200) {
      console.error('CRITICAL: Public access succeeded on private bucket!');
    } else {
      console.log('PASS: Anonymous public access is BLOCKED on private bucket.');
    }
  } catch (err: any) {
    console.log('Public fetch failed safely:', err.message);
  }

  // 3. Test Signed URL generation
  console.log('\n2. Generating Signed URL (TTL: 60s)...');
  const { data: signedData, error: signedErr } = await supabase.storage
    .from('ott-masters')
    .createSignedUrl(testFileName, 60);

  if (signedErr || !signedData?.signedUrl) {
    console.error('Signed URL Error:', signedErr);
    return;
  }
  console.log('Signed URL generated successfully.');

  // 4. Test HTTP Range Request on Signed URL
  console.log('\n3. Testing HTTP Range Request on Signed URL...');
  const rangeRes = await fetch(signedData.signedUrl, {
    headers: {
      Range: 'bytes=0-1023',
    },
  });

  console.log(`Range Request HTTP Status: ${rangeRes.status} ${rangeRes.statusText}`);
  console.log('Content-Range:', rangeRes.headers.get('content-range'));
  console.log('Content-Length:', rangeRes.headers.get('content-length'));
  console.log('Accept-Ranges:', rangeRes.headers.get('accept-ranges'));

  if (rangeRes.status === 206) {
    console.log('PASS: HTTP 206 Partial Content successfully returned by Supabase Storage CDN!');
  } else {
    console.error(`FAIL: Expected 206 Partial Content, got ${rangeRes.status}`);
  }

  // Clean up
  console.log('\n4. Cleaning up test fixture...');
  await supabase.storage.from('ott-masters').remove([testFileName]);
  console.log('Cleaned up.');
}

testStorageRange().catch(console.error);
