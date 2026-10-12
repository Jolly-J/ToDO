/**
 * Notion 风格头像游乐场 - 类型定义与部件元数据
 * 对标 notion-avatar.app 官方 1080x1080 矢量资产库
 */
export interface AvatarConfig {
  face: number;
  nose: number;
  mouth: number;
  eye: number;
  eyebrow: number;
  glass: number;
  hair: number;
  beard: number;
  detail: number;
  accessory: number;
  bgColor: string;
  shape: 'circle' | 'rounded' | 'square';
  flip: boolean;
}

export type AvatarCategory =
  | 'face'
  | 'nose'
  | 'mouth'
  | 'eye'
  | 'eyebrow'
  | 'glass'
  | 'hair'
  | 'beard'
  | 'detail'
  | 'accessory';

export const PART_CONFIG_COUNTS = {
  face: 11,
  nose: 14,
  mouth: 20,
  eye: 14,
  eyebrow: 16,
  glass: 13,
  hair: 58,
  beard: 17,
  detail: 14,
  accessory: 13,
} as const;

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  face: 0,
  hair: 0,
  eye: 0,
  eyebrow: 0,
  nose: 0,
  mouth: 0,
  glass: 0,
  beard: 0,
  detail: 0,
  accessory: 0,
  bgColor: '#D1D5DB', // 官网同款经典中灰圆形底
  shape: 'circle',
  flip: false,
};

export interface BgColorOption {
  color: string;
  name: string;
  isTransparent?: boolean;
}

export const BG_COLOR_OPTIONS: BgColorOption[] = [
  { color: '#D1D5DB', name: '经典灰色' },
  { color: '#FFFFFF', name: '纸白' },
  { color: '#F3F4F6', name: '浅云灰' },
  { color: '#FEF08A', name: '暖麦黄' },
  { color: '#BBF7D0', name: '薄荷绿' },
  { color: '#BFDBFE', name: '冰川蓝' },
  { color: '#DDD6FE', name: '丁香紫' },
  { color: '#FBCFE8', name: '樱花粉' },
  { color: '#FED7AA', name: '暖杏色' },
  { color: '#1F2937', name: '沉稳黑' },
  { color: 'transparent', name: '透明无底', isTransparent: true },
];
