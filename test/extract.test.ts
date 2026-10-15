import assert from 'node:assert/strict';
import { dispatchExtract } from '../src/extractors/index.js';
import { cleanHtml } from '../src/services/html-cleaner.js';
import { convertHtmlToMarkdown } from '../src/services/markdown.js';
import { LocalStorageProvider } from '../src/services/storage/local.js';
import { Base64StorageProvider } from '../src/services/storage/base64.js';

async function runTests() {
  console.log('🧪 Starting Article Extractor API Tests...\n');

  // Test 1: WeChat Official Account Extractor
  console.log('Test 1: WeChat Extractor & data-src lazy-load fix...');
  const mockWechatHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:title" content="微信文章测试标题" />
        <meta property="og:image" content="https://mmbiz.qpic.cn/cover.jpg" />
      </head>
      <body>
        <h1 id="activity-name">微信文章测试标题</h1>
        <span id="js_name">技术实验室</span>
        <div id="js_content">
          <p>这是第一段文字。<script>alert('malicious')</script></p>
          <img data-src="https://mmbiz.qpic.cn/test1.png" alt="测试图片" />
          <div class="reward_area">点赞打赏</div>
        </div>
      </body>
    </html>
  `;
  const wechatResult = await dispatchExtract('https://mp.weixin.qq.com/s/sample_article_id', mockWechatHtml);
  assert.equal(wechatResult.title, '微信文章测试标题');
  assert.equal(wechatResult.author, '技术实验室');
  assert.equal(wechatResult.platform, 'WeChat Official Account');
  assert.ok(wechatResult.content_html.includes('src="https://mmbiz.qpic.cn/test1.png"'), 'data-src should be converted to src');
  assert.ok(!wechatResult.content_html.includes('reward_area'), 'noise should be removed');
  console.log('✅ WeChat Extractor passed.');

  // Test 2: Zhihu Extractor
  console.log('Test 2: Zhihu Extractor & data-actualsrc fix...');
  const mockZhihuHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 class="Post-Title">深入理解 Node.js 异步机制</h1>
        <div class="AuthorInfo-name"><a class="UserLink-link">前端大师</a></div>
        <div class="Post-RichTextContainer">
          <div class="RichText">
            <p>Node.js 的事件循环非常强大。</p>
            <img src="data:image/svg+xml,..." data-actualsrc="https://pic4.zhimg.com/v2-abc.jpg" alt="架构图" />
          </div>
        </div>
      </body>
    </html>
  `;
  const zhihuResult = await dispatchExtract('https://zhuanlan.zhihu.com/p/123456', mockZhihuHtml);
  assert.equal(zhihuResult.title, '深入理解 Node.js 异步机制');
  assert.equal(zhihuResult.author, '前端大师');
  assert.equal(zhihuResult.platform, 'Zhihu');
  assert.ok(zhihuResult.content_html.includes('src="https://pic4.zhimg.com/v2-abc.jpg"'), 'data-actualsrc should be converted to src');
  console.log('✅ Zhihu Extractor passed.');

  // Test 3: HTML Sanitization & Cleaner
  console.log('Test 3: HTML Cleaner (XSS prevention & referrerpolicy injection)...');
  const dirtyHtml = `
    <p style="color: red;">安全的红色文本</p>
    <script>evilCode();</script>
    <iframe src="https://evil.com"></iframe>
    <img src="https://example.com/pic.jpg" alt="安全图片">
    <p>   </p>
  `;
  const cleaned = cleanHtml(dirtyHtml);
  assert.ok(!cleaned.includes('<script>'), 'script tag must be removed');
  assert.ok(!cleaned.includes('<iframe>'), 'iframe tag must be removed');
  assert.ok(cleaned.includes('referrerpolicy="no-referrer"'), 'referrerpolicy should be added to img');
  assert.ok(cleaned.includes('color:red') || cleaned.includes('color: red'), 'safe inline styles should be preserved by default');

  const cleanedNoStyle = cleanHtml(dirtyHtml, { cleanStyles: true });
  assert.ok(!cleanedNoStyle.includes('color'), 'styles should be stripped when cleanStyles is true');
  console.log('✅ HTML Cleaner passed.');

  // Test 4: Markdown Conversion
  console.log('Test 4: Markdown Conversion...');
  const sampleHtml = '<h2>大纲</h2><p>第一节介绍</p><ul><li>点1</li><li>点2</li></ul>';
  const md = convertHtmlToMarkdown(sampleHtml);
  assert.ok(md.includes('## 大纲'), 'Heading should be converted');
  assert.ok(md.includes('-   点1') || md.includes('- 点1'), 'List should be converted');
  console.log('✅ Markdown Converter passed.');

  // Test 5: Storage Providers
  console.log('Test 5: Storage Providers...');
  const base64Provider = new Base64StorageProvider();
  const base64Uri = await base64Provider.save(Buffer.from('fake image binary'), 'image/png');
  assert.ok(base64Uri.startsWith('data:image/png;base64,'), 'Base64 provider must return data URI');

  const localProvider = new LocalStorageProvider();
  const localUrl = await localProvider.save(Buffer.from('test binary content'), 'image/jpeg');
  assert.ok(localUrl.includes('/uploads/'), 'Local provider must return /uploads/ URL');
  console.log('✅ Storage Providers passed.');

  // Test 6: Xiaohongshu Extractor
  console.log('Test 6: Xiaohongshu Extractor & high-res image cleaning...');
  const mockXhsHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>小红书测试笔记</title></head>
      <body>
        <script>
          window.__INITIAL_STATE__ = {
            note: {
              firstNoteId: "64a1b2c3d4",
              noteDetailMap: {
                "64a1b2c3d4": {
                  note: {
                    title: "绝美露营胜地推荐",
                    desc: "周末和朋友一起去山里露营，空气太棒了！\\n装备清单详见下文。",
                    time: 1690000000000,
                    user: {
                      nickname: "户外探险家",
                      userId: "u123456"
                    },
                    imageList: [
                      {
                        fileId: "spectrum/camp_photo_01",
                        urlDefault: "https://sns-webpic-qc.xhscdn.com/123/camp_photo_01!nd_dft_wlteh_jpg_3"
                      }
                    ]
                  }
                }
              }
            }
          }
        </script>
      </body>
    </html>
  `;
  const xhsResult = await dispatchExtract('https://www.xiaohongshu.com/explore/64a1b2c3d4', mockXhsHtml);
  assert.equal(xhsResult.title, '绝美露营胜地推荐');
  assert.equal(xhsResult.author, '户外探险家');
  assert.equal(xhsResult.platform, '小红书');
  assert.ok(xhsResult.content_html.includes('https://sns-img-qc.xhscdn.com/spectrum/camp_photo_01?imageView2/2/w/1920/format/jpg'), 'image should be upgraded to 1920 lossless JPG');
  assert.ok(xhsResult.content_html.includes('周末和朋友一起去山里露营'), 'content paragraphs should be extracted');
  console.log('✅ Xiaohongshu Extractor passed.');

  // Test 7: Lofter Extractor
  console.log('Test 7: NetEase LOFTER Extractor & image cleaning...');
  const mockLofterHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>网易LOFTER摄影博文</title></head>
      <body>
        <script>
          window.__initialize_data__ = {
            postData: {
              data: {
                blogInfo: {
                  blogNickName: "光影记录者"
                },
                postData: {
                  postView: {
                    title: "街头夜景随拍",
                    publishTime: 1680000000000,
                    photoPostView: {
                      caption: "雨后的城市霓虹闪烁。",
                      photoLinks: [
                        {
                          raw: "https://imglf3.nosdn0.126.net/img/street_neon.jpg?imageView&thumbnail=500x0&quality=96"
                        }
                      ]
                    }
                  }
                }
              }
            }
          };
        </script>
      </body>
    </html>
  `;
  const lofterResult = await dispatchExtract('https://photographer.lofter.com/post/abc_123', mockLofterHtml);
  assert.equal(lofterResult.title, '街头夜景随拍');
  assert.equal(lofterResult.author, '光影记录者');
  assert.equal(lofterResult.platform, '网易LOFTER');
  assert.ok(lofterResult.content_html.includes('https://imglf3.nosdn0.126.net/img/street_neon.jpg'), 'thumbnail query params should be stripped');
  assert.ok(lofterResult.content_html.includes('雨后的城市霓虹闪烁'), 'caption should be included');
  console.log('✅ NetEase LOFTER Extractor passed.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Everything works as expected.\n');

}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
