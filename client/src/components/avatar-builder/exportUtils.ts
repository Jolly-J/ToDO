/**
 * 头像高清 PNG 栅格化与本地下载工具函数
 */
import type { AvatarConfig } from './types';

/**
 * 从 DOM 容器中提取并合成包含背景与翻转变换的完整 SVG 字符串
 */
export function generateAvatarSvgString(
  container: HTMLElement,
  config: AvatarConfig
): string {
  const svg = container.querySelector('svg');
  if (!svg) {
    throw new Error('未找到头像 SVG 节点');
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', '0 0 1080 1080');
  clone.setAttribute('width', '1080');
  clone.setAttribute('height', '1080');

  // 处理背景层
  const isTransparent = !config.bgColor || config.bgColor === 'transparent';
  if (!isTransparent) {
    const bgElem = document.createElementNS(
      'http://www.w3.org/2000/svg',
      config.shape === 'circle' ? 'circle' : 'rect'
    );
    if (config.shape === 'circle') {
      bgElem.setAttribute('cx', '540');
      bgElem.setAttribute('cy', '540');
      bgElem.setAttribute('r', '540');
    } else if (config.shape === 'rounded') {
      bgElem.setAttribute('width', '1080');
      bgElem.setAttribute('height', '1080');
      bgElem.setAttribute('rx', '120');
      bgElem.setAttribute('ry', '120');
    } else {
      bgElem.setAttribute('width', '1080');
      bgElem.setAttribute('height', '1080');
    }
    bgElem.setAttribute('fill', config.bgColor);
    clone.insertBefore(bgElem, clone.firstChild);
  }

  // 处理水平翻转变换
  if (config.flip) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(1080, 0) scale(-1, 1)');
    const startIndex = isTransparent ? 0 : 1;
    while (clone.childNodes.length > startIndex) {
      const child = clone.childNodes[startIndex];
      g.appendChild(child);
    }
    clone.appendChild(g);
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

/**
 * 将 Notion 头像栅格化转换为高分辨率 PNG DataURL
 * @param container 头像 DOM 容器
 * @param config 头像配置
 * @param size 输出分辨率尺寸（默认 512）
 */
export function renderNotionAvatarToPng(
  container: HTMLElement,
  config: AvatarConfig,
  size = 512
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const svgString = generateAvatarSvgString(container, config);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('无法创建 Canvas 2D 绘图上下文'));
          return;
        }

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);

        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error('SVG 栅格化失败: ' + String(err)));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 下载高清 PNG 头像到本地
 * @param container 头像 DOM 容器
 * @param config 头像配置
 * @param filename 下载文件名
 * @param size 分辨率尺寸（默认 1024x1024 高清）
 */
export async function downloadNotionAvatarAsPng(
  container: HTMLElement,
  config: AvatarConfig,
  filename = 'notion-avatar.png',
  size = 1024
): Promise<void> {
  const dataUrl = await renderNotionAvatarToPng(container, config, size);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
