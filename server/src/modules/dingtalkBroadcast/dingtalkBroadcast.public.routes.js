/** ActionCard HTML 承载页公开路由。
 *
 * 安全策略：
 * - 允许 ZIP 页面包内的同源外部脚本（例如 assets/page.js），并通过 sha256 哈希
 *   精确放行本文件注入的固定缩放脚本；任意内联脚本和第三方脚本仍被禁止；
 * - CSP sandbox 无 allow-same-origin，页面运行在独立 origin，拿不到业务登录态；
 * - 系统注入 viewport meta 与等比缩放脚本，让固定宽度设计的宣传页按窗口宽度显示。
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Router } = require('express');
const logger = require('../../utils/logger');
const broadcastDao = require('./dingtalkBroadcast.dao');
const sendRecordDao = require('./dingtalkBroadcast.sendRecord.dao');
const broadcastStorage = require('./dingtalkBroadcast.storage');

const router = Router();

/**
 * 固定缩放脚本：内容宽度超过窗口时，整页按比例 zoom，窗口变化自动重算。
 * 注意：修改此脚本后 CSP 哈希会在模块加载时自动重新计算，无需手工同步。
 */
const SCALE_SCRIPT = [
  '(function () {',
  '  function fitWidth() {',
  '    var docEl = document.documentElement;',
  '    docEl.style.zoom = \'\';',
  '    var viewport = docEl.clientWidth || window.innerWidth;',
  '    var body = document.body;',
  '    var contentWidth = Math.max(docEl.scrollWidth, docEl.clientWidth, body ? body.scrollWidth : 0);',
  '    if (viewport && contentWidth > viewport) {',
  '      docEl.style.zoom = String(viewport / contentWidth);',
  '    }',
  '  }',
  '  if (document.readyState === \'loading\') {',
  '    document.addEventListener(\'DOMContentLoaded\', fitWidth);',
  '  } else {',
  '    fitWidth();',
  '  }',
  '  window.addEventListener(\'load\', fitWidth);',
  '  window.addEventListener(\'resize\', fitWidth);',
  '})();',
].join('\n');

const SCALE_SCRIPT_SHA256 = createHash('sha256').update(SCALE_SCRIPT).digest('base64');
const VIEWPORT_META = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';

function injectViewportMeta(html) {
  if (/<meta[^>]+name\s*=\s*["']?viewport/i.test(html)) {
    return html;
  }
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    return html.replace(headMatch[0], headMatch[0] + '\n' + VIEWPORT_META);
  }
  const htmlMatch = /<html[^>]*>/i.exec(html);
  if (htmlMatch) {
    return html.replace(htmlMatch[0], htmlMatch[0] + '\n<head>' + VIEWPORT_META + '</head>');
  }
  return VIEWPORT_META + '\n' + html;
}

function injectScaleScript(html) {
  const scriptTag = '<script>' + SCALE_SCRIPT + '</script>';
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, scriptTag + '</body>');
  }
  return html + '\n' + scriptTag;
}

function injectBaseTag(html, token) {
  if (!token) return html;
  const baseTag = `<base href="/p/${token}/">`;
  if (/<base\s/i.test(html)) {
    return html;
  }
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    return html.replace(headMatch[0], headMatch[0] + '\n' + baseTag);
  }
  const htmlMatch = /<html[^>]*>/i.exec(html);
  if (htmlMatch) {
    return html.replace(htmlMatch[0], htmlMatch[0] + '\n<head>' + baseTag + '</head>');
  }
  return baseTag + '\n' + html;
}

function buildSafeHtml(htmlContent, token = '') {
  return injectScaleScript(injectViewportMeta(injectBaseTag(htmlContent, token)));
}

function buildContentSecurityPolicy() {
  return "sandbox allow-popups allow-popups-to-escape-sandbox allow-scripts; "
    + "default-src 'none'; img-src 'self' https: data: blob:; media-src 'self' https: data: blob:; "
    + "style-src 'unsafe-inline' https: 'self'; font-src 'self' https: data:; "
    + "script-src 'sha256-" + SCALE_SCRIPT_SHA256 + "' 'self'; connect-src 'none'; "
    + "frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'self'";
}

function resolveAssetCacheControl(status) {
  return status === 'submitted'
    ? 'public, max-age=31536000, immutable'
    : 'no-store';
}

function recordTrackedPageView(req, broadcast) {
  if (req.method !== 'GET') return false;
  const viewTrackingToken = String(req.query?.view || '').trim();
  if (!viewTrackingToken || !broadcast?.id) return false;

  try {
    return sendRecordDao.incrementViewCount({
      broadcastId: broadcast.id,
      viewTrackingToken,
    });
  } catch (error) {
    // 阅读量统计失败不能阻断宣传页本身打开。
    logger.warn('钉钉宣传承载页阅读量记录失败', {
      action: 'dingtalk.broadcast.view_count_failed',
      broadcastId: broadcast.id,
      error: error.message,
    });
    return false;
  }
}

/**
 * 响应公开 HTML 页面
 */
function servePublicPage(req, res) {
  const token = String(req.params.token || '').trim();
  const broadcast = token ? broadcastDao.findByPublicToken(token) : null;

  if (!broadcast) {
    return res.status(404).type('text/plain').send('宣传页面不存在或已失效');
  }

  // 优先从解压存储目录读取最新的 index.html
  let html = '';
  const dir = broadcastStorage.getBroadcastDir(broadcast.id);
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      html = fs.readFileSync(indexPath, 'utf8');
    } catch {
      html = broadcast.html_content || '';
    }
  } else {
    html = broadcast.html_content || '';
  }

  if (!html) {
    return res.status(404).type('text/plain').send('页面内容为空');
  }

  recordTrackedPageView(req, broadcast);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy());
  return res.status(200).send(buildSafeHtml(html, token));
}

/**
 * 响应解压目录中的静态资源 (图片、视频流等，支持 HTTP 206 Partial Content)
 */
function servePublicAsset(req, res) {
  const token = String(req.params.token || '').trim();
  const rawPath = (Array.isArray(req.params.assetPath)
    ? req.params.assetPath.join('/')
    : String(req.params.assetPath || '')).trim().replace(/^\/+/, '');

  const broadcast = token ? broadcastDao.findByPublicToken(token) : null;
  if (!broadcast) {
    return res.status(404).type('text/plain').send('页面不存在');
  }

  // 如果访问的是 index.html 或根路径，作为页面输出
  if (!rawPath || rawPath === 'index.html' || rawPath === 'index.htm') {
    return servePublicPage(req, res);
  }

  const broadcastDir = broadcastStorage.getBroadcastDir(broadcast.id);
  const targetFile = path.join(broadcastDir, rawPath);
  const relativePath = path.relative(broadcastDir, targetFile);

  // 防止路径穿越安全校验
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
    return res.status(404).type('text/plain').send('资源不存在');
  }

  // 草稿和发送中的页面允许反复预览更新；提交成功后内容不可再覆盖，可安全长期缓存。
  res.setHeader('Cache-Control', resolveAssetCacheControl(broadcast.status));
  return res.sendFile(targetFile);
}

router.get('/:token', servePublicPage);
router.get('/:token/{*assetPath}', servePublicAsset);

module.exports = router;
module.exports.servePublicPage = servePublicPage;
module.exports.servePublicAsset = servePublicAsset;
module.exports.buildSafeHtml = buildSafeHtml;
module.exports.buildContentSecurityPolicy = buildContentSecurityPolicy;
module.exports.recordTrackedPageView = recordTrackedPageView;
module.exports.resolveAssetCacheControl = resolveAssetCacheControl;
module.exports.scaleScript = SCALE_SCRIPT;
