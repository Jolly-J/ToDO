/**
 * 单一部件独立矢量线稿渲染器
 * 1:1 对标 notion-avatar.app 选项格子的独立部件特写展示
 * 核心技术：针对各部位精准裁切黄金聚焦视窗 (Zoomed-in ViewBox)，让五官饱满清晰大号居中
 */
import {
  Face,
  Eye,
  Eyebrow,
  Glass,
  Hair,
  Mouth,
  Nose,
  Accessory,
  Beard,
  Detail,
} from './reactNotionAvatar';
import type { AvatarCategory } from './types';

interface SinglePartRendererProps {
  category: AvatarCategory;
  type: number;
  className?: string;
}

// 针对 10 大部件在 1080x1080 原版画布中的坐标精确定制的特写聚焦视口
const CATEGORY_VIEWBOX: Record<AvatarCategory, string> = {
  // 脸型轮廓
  face: '300 280 540 640',
  // 鼻子核心特写 (放大约 5 倍)
  nose: '590 540 140 200',
  // 嘴巴核心特写 (放大约 4.5 倍)
  mouth: '560 660 220 160',
  // 双眼特写 (放大约 3.5 倍)
  eye: '490 460 300 150',
  // 双眉特写 (放大约 3.5 倍)
  eyebrow: '500 420 300 130',
  // 眼镜特写
  glass: '420 420 440 220',
  // 发型整体轮廓
  hair: '160 80 760 620',
  // 胡须下巴特写
  beard: '480 650 340 280',
  // 面部细节 (腮红/雀斑) 特写
  detail: '480 480 320 220',
  // 配饰特写
  accessory: '320 620 500 340',
};

export function SinglePartRenderer({
  category,
  type,
  className = 'h-full w-full',
}: SinglePartRendererProps) {
  // 对可为“无”的部件，第 0 项展示经典禁用斜杠图标
  const isZeroEmptyCategory =
    (category === 'glass' ||
      category === 'beard' ||
      category === 'detail' ||
      category === 'accessory') &&
    type === 0;

  if (isZeroEmptyCategory) {
    return (
      <div className="flex h-full w-full items-center justify-center text-black/60">
        <svg viewBox="0 0 24 24" className="h-7 w-7 stroke-current stroke-[2] fill-none">
          <circle cx="12" cy="12" r="9" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        </svg>
      </div>
    );
  }

  const renderPartComponent = () => {
    switch (category) {
      case 'face':
        return <Face type={type} />;
      case 'nose':
        return <Nose type={type} />;
      case 'mouth':
        return <Mouth type={type} />;
      case 'eye':
        return <Eye type={type} />;
      case 'eyebrow':
        return <Eyebrow type={type} />;
      case 'glass':
        return <Glass type={type} />;
      case 'hair':
        return <Hair type={type} />;
      case 'beard':
        return <Beard type={type} />;
      case 'detail':
        return <Detail type={type} />;
      case 'accessory':
        return <Accessory type={type} />;
      default:
        return null;
    }
  };

  const viewBox = CATEGORY_VIEWBOX[category] || '0 0 1080 1080';

  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      {renderPartComponent()}
    </svg>
  );
}
