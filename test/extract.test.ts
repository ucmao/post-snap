import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchExtract } from '../src/extractors/index.js';
import { cleanHtml } from '../src/services/html-cleaner.js';
import { convertHtmlToMarkdown } from '../src/services/markdown.js';
import { LocalStorageProvider } from '../src/services/storage/local.js';
import { Base64StorageProvider } from '../src/services/storage/base64.js';

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

describe('extractors', () => {
  it('WeChat: title/author, data-src lazy-load fix, noise removal', async () => {
    const r = await dispatchExtract('https://mp.weixin.qq.com/s/sample_article_id', mockWechatHtml);
    assert.equal(r.title, '微信文章测试标题');
    assert.equal(r.author, '技术实验室');
    assert.equal(r.platform_id, 'wechat');
    assert.equal(r.platform, '微信公众号');
    assert.ok(r.content_html.includes('src="https://mmbiz.qpic.cn/test1.png"'), 'data-src should be converted to src');
    assert.ok(!r.content_html.includes('reward_area'), 'noise should be removed');
  });

  it('Zhihu: data-actualsrc fix', async () => {
    const r = await dispatchExtract('https://zhuanlan.zhihu.com/p/123456', mockZhihuHtml);
    assert.equal(r.title, '深入理解 Node.js 异步机制');
    assert.equal(r.author, '前端大师');
    assert.equal(r.platform_id, 'zhihu');
    assert.equal(r.platform, '知乎');
    assert.ok(r.content_html.includes('src="https://pic4.zhimg.com/v2-abc.jpg"'), 'data-actualsrc should be converted to src');
  });

  it('Xiaohongshu: high-res images, ms timestamp -> ISO', async () => {
    const r = await dispatchExtract('https://www.xiaohongshu.com/explore/64a1b2c3d4', mockXhsHtml);
    assert.equal(r.title, '绝美露营胜地推荐');
    assert.equal(r.author, '户外探险家');
    assert.equal(r.platform_id, 'xiaohongshu');
    assert.equal(r.platform, '小红书');
    assert.equal(r.publish_time, new Date(1690000000000).toISOString());
    assert.equal(r.publish_time_raw, '1690000000000');
    assert.ok(r.content_html.includes('https://sns-img-qc.xhscdn.com/spectrum/camp_photo_01?imageView2/2/w/1920/format/jpg'), 'image should be upgraded to 1920 JPG');
    assert.ok(r.content_html.includes('周末和朋友一起去山里露营'), 'content paragraphs should be extracted');
  });

  it('LOFTER: thumbnail params stripped, caption kept', async () => {
    const r = await dispatchExtract('https://photographer.lofter.com/post/abc_123', mockLofterHtml);
    assert.equal(r.title, '街头夜景随拍');
    assert.equal(r.author, '光影记录者');
    assert.equal(r.platform_id, 'lofter');
    assert.equal(r.platform, '网易LOFTER');
    assert.equal(r.publish_time, new Date(1680000000000).toISOString());
    assert.ok(r.content_html.includes('https://imglf3.nosdn0.126.net/img/street_neon.jpg'), 'thumbnail query params should be stripped');
    assert.ok(r.content_html.includes('雨后的城市霓虹闪烁'), 'caption should be included');
  });

  it('General: unknown site falls back to platform_id "web"', async () => {
    const html = '<html><body><article><h1>Hello</h1><p>' + '正文内容。'.repeat(40) + '</p></article></body></html>';
    const r = await dispatchExtract('https://blog.example.org/post/1', html);
    assert.equal(r.platform_id, 'web');
    assert.equal(r.platform, '网页文章');
  });

  it('General: known site gets its own platform_id', async () => {
    const html = '<html><body><article><h1>Hello</h1><p>' + '正文内容。'.repeat(40) + '</p></article></body></html>';
    const r = await dispatchExtract('https://www.cnblogs.com/someone/p/123.html', html);
    assert.equal(r.platform_id, 'cnblogs');
    assert.equal(r.platform, '博客园');
  });
});

describe('html cleaner', () => {
  const dirtyHtml = `
    <p style="color: red;">安全的红色文本</p>
    <script>evilCode();</script>
    <iframe src="https://evil.com"></iframe>
    <img src="https://example.com/pic.jpg" alt="安全图片">
    <p>   </p>
  `;

  it('removes script/iframe, adds referrerpolicy, keeps safe styles', () => {
    const cleaned = cleanHtml(dirtyHtml);
    assert.ok(!cleaned.includes('<script>'), 'script tag must be removed');
    assert.ok(!cleaned.includes('<iframe>'), 'iframe tag must be removed');
    assert.ok(cleaned.includes('referrerpolicy="no-referrer"'), 'referrerpolicy should be added to img');
    assert.ok(cleaned.includes('color:red') || cleaned.includes('color: red'), 'safe inline styles should be preserved by default');
  });

  it('strips styles when cleanStyles is true', () => {
    assert.ok(!cleanHtml(dirtyHtml, { cleanStyles: true }).includes('color'));
  });
});

describe('markdown', () => {
  it('converts headings and lists', () => {
    const md = convertHtmlToMarkdown('<h2>大纲</h2><p>第一节介绍</p><ul><li>点1</li><li>点2</li></ul>');
    assert.ok(md.includes('## 大纲'), 'Heading should be converted');
    assert.ok(md.includes('-   点1') || md.includes('- 点1'), 'List should be converted');
  });
});

describe('storage providers', () => {
  it('base64 returns a data URI', async () => {
    const uri = await new Base64StorageProvider().save(Buffer.from('fake image binary'), 'image/png');
    assert.ok(uri.startsWith('data:image/png;base64,'));
  });

  it('local returns an /uploads/ URL', async () => {
    const url = await new LocalStorageProvider().save(Buffer.from('test binary content'), 'image/jpeg');
    assert.ok(url.includes('/uploads/'));
  });
});
