import assert from 'node:assert/strict';
import { resolveExtractor } from '../src/extractors/index.js';
import { hostMatches } from '../src/utils/url-match.js';
import { assertSafeUrl, isPrivateAddress, UnsafeUrlError } from '../src/utils/url-guard.js';
import { sniffImageType } from '../src/utils/image-type.js';
import { LocalStorageProvider } from '../src/services/storage/local.js';
import { Base64StorageProvider } from '../src/services/storage/base64.js';

async function runTests() {
  console.log('🔒 Starting security tests...\n');

  // 1. Private address detection
  console.log('Test 1: private / reserved address detection...');
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '[::1]']) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be public`);
  }
  console.log('✅ passed.');

  // 2. assertSafeUrl rejects internal targets and bad schemes
  console.log('Test 2: assertSafeUrl...');
  for (const url of [
    'http://127.0.0.1:3008/health',
    'http://localhost/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://0x7f000001/',
    'http://2130706433/',
    'file:///etc/passwd',
    'ftp://example.com/',
    'not a url',
  ]) {
    await assert.rejects(assertSafeUrl(url), UnsafeUrlError, `${url} should be rejected`);
  }
  await assertSafeUrl('http://8.8.8.8/'); // public literal IP needs no DNS
  console.log('✅ passed.');

  // 3. Hostname-based routing cannot be spoofed via query/path
  console.log('Test 3: extractor routing by hostname...');
  assert.equal(resolveExtractor('https://mp.weixin.qq.com/s/abc').name, 'wechat');
  assert.equal(resolveExtractor('https://zhuanlan.zhihu.com/p/123').name, 'zhihu');
  assert.equal(resolveExtractor('https://www.zhihu.com/question/1/answer/2').name, 'zhihu');
  assert.equal(resolveExtractor('https://tieba.baidu.com/p/123').name, 'tieba');
  assert.equal(resolveExtractor('https://tieba.baidu.com/f?kz=123').name, 'tieba');
  assert.equal(resolveExtractor('https://www.toutiao.com/article/123/').name, 'toutiao');
  assert.equal(resolveExtractor('https://www.sohu.com/a/123_456').name, 'sohu');
  assert.equal(resolveExtractor('https://evil.com/?x=mp.weixin.qq.com').name, 'general');
  assert.equal(resolveExtractor('https://mp.weixin.qq.com.evil.com/s/abc').name, 'general');
  assert.equal(resolveExtractor('https://evil.com/tieba.baidu.com/p/1').name, 'general');
  assert.equal(resolveExtractor('https://notlofter.com/post/1').name, 'general');
  assert.equal(hostMatches('https://a.b.lofter.com/x', 'lofter.com'), true);
  console.log('✅ passed.');

  // 4. Image type sniffing
  console.log('Test 4: image magic-byte sniffing...');
  const pad = Buffer.alloc(16);
  assert.equal(sniffImageType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])), 'image/jpeg');
  assert.equal(sniffImageType(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])), 'image/png');
  assert.equal(sniffImageType(Buffer.concat([Buffer.from('GIF89a'), pad])), 'image/gif');
  assert.equal(sniffImageType(Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBP'), pad])), 'image/webp');
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImageType(Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>')), null);
  console.log('✅ passed.');

  // 5. Storage providers refuse non-whitelisted types
  console.log('Test 5: storage type whitelist...');
  await assert.rejects(new LocalStorageProvider().save(Buffer.from('<svg/>'), 'image/svg+xml'));
  await assert.rejects(new LocalStorageProvider().save(Buffer.from('<html/>'), 'text/html'));
  await assert.rejects(new Base64StorageProvider().save(Buffer.from('<svg/>'), 'image/svg+xml'));
  console.log('✅ passed.');

  console.log('\n🎉 All security tests passed!');
}

runTests().catch(err => {
  console.error('❌ Security tests failed:', err);
  process.exit(1);
});
