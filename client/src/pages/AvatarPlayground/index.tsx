/**
 * 页面名称：头像游乐场 (Notion Avatar Playground)
 * 视觉交互：1:1 像素级复刻 notion-avatar.app 官方原版
 * 核心架构：
 * 1. 顶部栏 100% 通栏顶格解耦，左侧紧凑靠左
 * 2. 真实视口高度锁定 (h-[calc(100vh-64px)])：折叠态与展开态均精准处于屏幕垂直几何黄金中心
 * 3. 释放全按钮安全呼吸内边距，彻底杜绝 border-2 描边与阴影被裁切
 * 4. 居中 175px 黄金尺寸 3/4 侧脸 Notion 贴纸头像 + 灰色圆形徽章底色
 * 5. 头像下方正中排列大号加粗描边小工具：[ 🪞 水平镜像 ] [ 🔄 重置初始 ] [ 🎨 背景颜色 ]
 * 6. 10 个圆角正方形方框部件选择栏（正方形比例 + 上图标下文字复合一体化排版）
 * 7. 单实体卡片容器 + [0.16, 1, 0.3, 1] 展开与 [0.32, 0, 0.67, 0] 收起动力学曲线，彻底消灭双框竞态与末端闪跳
 * 8. 弹性安全区排版，底部三大药丸操作按钮 100% 完整展示绝不裁切
 * 9. 一键随机换装、1024x1024 高清 PNG 本地下载与全站头像即时替换（带防覆盖保护）
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Download,
  Check,
  Dices,
  FlipHorizontal,
  Palette,
  RotateCcw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store';
import request from '@/api/request';
import {
  type AvatarConfig,
  type AvatarCategory,
  PART_CONFIG_COUNTS,
  DEFAULT_AVATAR_CONFIG,
  BG_COLOR_OPTIONS,
  NotionAvatarRenderer,
  SinglePartRenderer,
  downloadNotionAvatarAsPng,
  renderNotionAvatarToPng,
} from '@/components/avatar-builder';
import { getRandomConfig } from '@/components/avatar-builder/reactNotionAvatar';

// 官方 10 大部件分类配置及高辨识度清晰矢量手绘图标
interface CategoryMeta {
  key: AvatarCategory;
  name: string;
  count: number;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryMeta[] = [
  {
    key: 'face',
    name: '脸型',
    count: PART_CONFIG_COUNTS.face,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a7.5 7.5 0 0 1 7.5 7.5c0 5-3.5 9-7.5 9.5-3.5-.5-6-3.5-7-7" />
        <path d="M5 10.5a2 2 0 0 0 0 4" />
      </svg>
    ),
  },
  {
    key: 'hair',
    name: '发型',
    count: PART_CONFIG_COUNTS.hair,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14c0-5.5 3.5-10 8-10s8 4.5 8 10c0 1-1 2-2 1s-2-2-3-2-2 1-3 1-2-1-3-1-2 2-3 2-2-1-2-1z" />
        <path d="M7 9c2-2 5-2 7 0" />
      </svg>
    ),
  },
  {
    key: 'eye',
    name: '眼睛',
    count: PART_CONFIG_COUNTS.eye,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="7.5" cy="12" rx="3.5" ry="2.5" />
        <circle cx="7.5" cy="12" r="1.2" fill="currentColor" />
        <ellipse cx="16.5" cy="12" rx="3.5" ry="2.5" />
        <circle cx="16.5" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'eyebrow',
    name: '眉毛',
    count: PART_CONFIG_COUNTS.eyebrow,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2.5] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 13.5c1.5-2 4-2.5 6-.5" />
        <path d="M13.5 13c2-2 4.5-1.5 6 .5" />
      </svg>
    ),
  },
  {
    key: 'nose',
    name: '鼻子',
    count: PART_CONFIG_COUNTS.nose,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 6v7c0 1.5 1.5 3 3 2.5a2 2 0 0 1 2 2c0 1.5-1.5 2.5-4 2.5-1.5 0-3-.5-4-1.5" />
      </svg>
    ),
  },
  {
    key: 'mouth',
    name: '嘴巴',
    count: PART_CONFIG_COUNTS.mouth,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 11c2.5 4 11.5 4 14 0" />
        <path d="M5 11c2 1 12 1 14 0" />
      </svg>
    ),
  },
  {
    key: 'glass',
    name: '眼镜',
    count: PART_CONFIG_COUNTS.glass,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="13" r="3.5" />
        <circle cx="16.5" cy="13" r="3.5" />
        <path d="M11 13h2M4 11l2 2M20 11l-2 2" />
      </svg>
    ),
  },
  {
    key: 'beard',
    name: '胡须',
    count: PART_CONFIG_COUNTS.beard,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 11c-2-2-5-2-7 0 2 2.5 5 3 7 1 2 2 5 1.5 7-1-2-2-5-2-7 0z" />
      </svg>
    ),
  },
  {
    key: 'detail',
    name: '细节',
    count: PART_CONFIG_COUNTS.detail,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="12" r="1.5" fill="currentColor" />
        <circle cx="9.5" cy="14" r="1.5" fill="currentColor" />
        <circle cx="17.5" cy="12" r="1.5" fill="currentColor" />
        <circle cx="14.5" cy="14" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'accessory',
    name: '配饰',
    count: PART_CONFIG_COUNTS.accessory,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-[2] fill-none" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 9 12 13 5 17 5 9" />
        <polygon points="19 9 12 13 19 17 19 9" />
        <circle cx="12" cy="13" r="2" fill="currentColor" />
      </svg>
    ),
  },
];

export default function AvatarPlayground() {
  const navigate = useNavigate();
  const { user, updateUserAvatarState } = useAuthStore();
  const avatarContainerRef = useRef<HTMLDivElement | null>(null);

  // 初始化配置
  const [config, setConfig] = useState<AvatarConfig>(() => {
    if (user?.avatar_config) {
      try {
        const parsed = typeof user.avatar_config === 'string'
          ? JSON.parse(user.avatar_config)
          : user.avatar_config;
        return { ...DEFAULT_AVATAR_CONFIG, ...parsed };
      } catch {
        return DEFAULT_AVATAR_CONFIG;
      }
    }
    return DEFAULT_AVATAR_CONFIG;
  });

  const [activeCategory, setActiveCategory] = useState<AvatarCategory | null>('nose');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // 用户有既有配置时加载
  useEffect(() => {
    if (user?.avatar_config) {
      try {
        const parsed = typeof user.avatar_config === 'string'
          ? JSON.parse(user.avatar_config)
          : user.avatar_config;
        setConfig((prev) => ({ ...DEFAULT_AVATAR_CONFIG, ...prev, ...parsed }));
      } catch {
        // ignore
      }
    }
  }, [user?.avatar_config]);

  // 修改当前部件类型序号
  const handleSelectPart = (category: AvatarCategory, index: number) => {
    setConfig((prev) => ({ ...prev, [category]: index }));
  };

  // 随机生成
  const handleRandom = () => {
    const rand = getRandomConfig();
    setConfig((prev) => ({
      ...prev,
      ...rand,
    }));
    toast.success('已随机生成一套 Notion 风格形象！');
  };

  // 水平翻转
  const handleToggleFlip = () => {
    setConfig((prev) => ({ ...prev, flip: !prev.flip }));
  };

  // 重置初始搭配
  const handleReset = () => {
    setConfig(DEFAULT_AVATAR_CONFIG);
    toast.info('已恢复为初始形象');
  };

  // 下载 PNG (1024x1024)
  const handleDownloadPng = async () => {
    if (!avatarContainerRef.current) return;
    setDownloading(true);
    try {
      const fileName = `${user?.name || 'user'}-notion-avatar.png`;
      await downloadNotionAvatarAsPng(avatarContainerRef.current, config, fileName, 1024);
      toast.success('已下载高清 PNG 头像到本地');
    } catch (err: any) {
      toast.error('导出 PNG 失败: ' + (err?.message || '未知错误'));
    } finally {
      setDownloading(false);
    }
  };

  // 保存并使用
  const handleSaveAndApply = async () => {
    if (!avatarContainerRef.current) return;
    setSaving(true);
    try {
      const pngDataUrl = await renderNotionAvatarToPng(avatarContainerRef.current, config, 512);

      await request.patch('/users/me/avatar', {
        avatar: pngDataUrl,
        avatarConfig: config,
        avatarType: 'custom',
      });

      updateUserAvatarState(pngDataUrl, config, 'custom');
      toast.success('头像已保存并在全站即时生效！');
    } catch (err: any) {
      toast.error('保存头像失败: ' + (err?.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const currentCategoryMeta = CATEGORIES.find((c) => c.key === activeCategory);

  return (
    <div className="-mt-8 -mx-6 sm:-mx-12 -mb-12 flex h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] flex-col overflow-hidden bg-white select-none">
      {/* 1. 100% 通栏顶格导航栏（左侧紧凑靠左） */}
      <header className="w-full shrink-0 border-b border-[#E9E9E7] bg-white px-4 py-2.5 sm:px-8">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black shadow-xs transition hover:bg-neutral-100 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </button>

            <h1 className="text-base font-extrabold tracking-tight text-[#18181B] sm:text-lg">
              Notion 头像游乐场
            </h1>
          </div>
        </div>
      </header>

      {/* 2. 下方游乐场独立工作台（真实视口高度锁定，折叠与展开均处于垂直黄金几何中心） */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col items-center justify-center gap-3.5 px-4 py-2">
        {/* 中间核心展示区：大尺寸 3/4 侧脸 Notion 头像 */}
        <div className="relative flex flex-col items-center justify-center shrink-0">
          <NotionAvatarRenderer
            ref={avatarContainerRef}
            config={config}
            size={175}
            className="transition-transform duration-200"
          />

          {/* 头像下方大号三工具栏：[ 🪞 水平镜像 ] [ 🔄 恢复初始 ] [ 🎨 背景调色盘 ] */}
          <div className="mt-3 flex items-center justify-center gap-3 p-1">
            {/* 1. 水平镜像翻转 */}
            <button
              type="button"
              onClick={handleToggleFlip}
              className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition shadow-xs hover:scale-105 active:scale-95 ${
                config.flip
                  ? 'border-black bg-black text-white'
                  : 'border-black bg-white text-black hover:bg-neutral-100'
              }`}
              title="水平镜像翻转"
            >
              <FlipHorizontal className="h-4.5 w-4.5" />
            </button>

            {/* 2. 恢复初始搭配 (重置) */}
            <button
              type="button"
              onClick={handleReset}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-black bg-white text-black shadow-xs transition hover:scale-105 hover:bg-neutral-100 active:scale-95"
              title="恢复初始搭配"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>

            {/* 3. 背景调色盘 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition shadow-xs hover:scale-105 active:scale-95 ${
                  showColorPicker
                    ? 'border-black bg-black text-white'
                    : 'border-black bg-white text-black hover:bg-neutral-100'
                }`}
                title="选择背景颜色"
              >
                <Palette className="h-4.5 w-4.5" />
              </button>

              {/* 背景颜色浮层 */}
              {showColorPicker && (
                <div className="absolute left-1/2 -translate-x-1/2 top-12 z-50 flex w-60 flex-wrap gap-2 rounded-2xl border-2 border-black bg-white p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                  {BG_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.color}
                      type="button"
                      onClick={() => {
                        setConfig((prev) => ({ ...prev, bgColor: opt.color }));
                        setShowColorPicker(false);
                      }}
                      className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                        config.bgColor === opt.color ? 'border-black ring-2 ring-black ring-offset-1' : 'border-black/20'
                      }`}
                      style={{
                        backgroundColor: opt.isTransparent ? '#FFFFFF' : opt.color,
                        backgroundImage: opt.isTransparent
                          ? 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)'
                          : undefined,
                        backgroundSize: '6px 6px',
                        backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                      }}
                      title={opt.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部控制区（紧凑内聚排版，间距自然舒适） */}
        <div className="relative flex w-full flex-col gap-2 shrink-0">
          {/* 提示文案：严格水平绝对居中 */}
          <div className="flex w-full items-center justify-center py-0.5 text-sm text-[#18181B]">
            <span className="text-xs font-bold tracking-wide text-center">
              请选择一种风格
            </span>
          </div>

          {/* 10 大圆角正方形方框部件选择栏（释放 py-2.5 安全呼吸空间，彻底消除边框裁切） */}
          <div className="flex items-center gap-2 overflow-x-auto py-2.5 px-1 scrollbar-none sm:justify-center">
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key === activeCategory ? null : cat.key)}
                  className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition shadow-xs sm:h-15 sm:w-15 ${
                    isSelected
                      ? 'border-black bg-black text-white ring-2 ring-black ring-offset-1'
                      : 'border-black bg-white text-black hover:bg-neutral-100'
                  }`}
                  title={cat.name}
                >
                  <div className="h-5 w-5 flex items-center justify-center shrink-0">
                    {cat.icon}
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold leading-none select-none">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 独立部位线稿单实体卡片（进退场曲线解耦：展开减速泊入，收起加速彻底合拢，消灭10->0闪退） */}
          <AnimatePresence initial={false}>
            {activeCategory && (
              <motion.div
                key="avatar-parts-drawer-container"
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: 180,
                  opacity: 1,
                  transition: {
                    height: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.2, ease: 'easeOut' },
                  },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: {
                    height: { duration: 0.2, ease: [0.32, 0, 0.67, 0] },
                    opacity: { duration: 0.16, ease: 'easeIn' },
                  },
                }}
                className="w-full overflow-hidden"
              >
                <div className="flex h-44 w-full flex-col overflow-hidden rounded-2xl border-2 border-black bg-white p-3 shadow-lg">
                  {/* 弹层标题与关闭按钮 */}
                  <div className="mb-1.5 flex shrink-0 items-center justify-between border-b border-black/10 pb-1">
                    <span className="text-sm font-extrabold text-black">
                      {`选择 ${currentCategoryMeta?.name || ''}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className="rounded-lg p-1 text-black/60 hover:bg-neutral-100 hover:text-black transition"
                      title="关闭"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 单一部件特写线稿网格 */}
                  <div
                    key={activeCategory}
                    className="grid flex-1 min-h-0 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 scrollbar-thin animate-in fade-in duration-100"
                  >
                    {Array.from({ length: (currentCategoryMeta?.count ?? 0) + 1 }).map((_, index) => {
                      const isCurrent = (config[activeCategory] ?? 0) === index;

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectPart(activeCategory, index)}
                          className={`flex h-13 sm:h-14 w-full items-center justify-center rounded-xl p-1 transition ${
                            isCurrent
                              ? 'border-2 border-black bg-neutral-50 shadow-sm'
                              : 'border-2 border-transparent hover:border-black/20 hover:bg-neutral-50'
                          }`}
                          title={`${currentCategoryMeta?.name} #${index}`}
                        >
                          <SinglePartRenderer
                            category={activeCategory}
                            type={index}
                            className="h-full w-full"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 底部三大药丸操作按钮（释放 py-1.5 安全空间，确保描边阴影完整饱满） */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3.5 py-1.5">
            {/* 1. 随机一下 */}
            <button
              type="button"
              onClick={handleRandom}
              className="flex items-center gap-2 rounded-full border-2 border-black bg-white px-5 py-2 text-sm font-bold text-black shadow-xs transition hover:bg-neutral-100 hover:shadow-sm active:scale-95"
            >
              <Dices className="h-4 w-4" />
              <span>随机一下</span>
            </button>

            {/* 2. 保存并使用 (主按钮) */}
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={saving}
              className="flex items-center gap-2 rounded-full border-2 border-black bg-black px-6 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-neutral-800 hover:shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? '正在保存...' : '保存并使用'}</span>
            </button>

            {/* 3. 下载 PNG */}
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloading}
              className="flex items-center gap-2 rounded-full border-2 border-black bg-white px-5 py-2 text-sm font-bold text-black shadow-xs transition hover:bg-neutral-100 hover:shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{downloading ? '生成中...' : '下载 .PNG'}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
