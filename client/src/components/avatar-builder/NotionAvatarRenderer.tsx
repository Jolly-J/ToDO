/**
 * Notion 风格手绘头像渲染组件
 * 基于 react-notion-avatar 官方开源矢量库
 */
import { forwardRef } from 'react';
import ReactNotionAvatar from './reactNotionAvatar';
import type { AvatarConfig } from './types';

interface NotionAvatarRendererProps {
  config: AvatarConfig;
  size?: number | string;
  className?: string;
  id?: string;
}

export const NotionAvatarRenderer = forwardRef<HTMLDivElement, NotionAvatarRendererProps>(
  ({ config, size = 300, className = '', id = 'notion-avatar-wrapper' }, ref) => {
    const {
      face = 0,
      hair = 0,
      eye = 0,
      eyebrow = 0,
      nose = 0,
      mouth = 0,
      glass = 0,
      beard = 0,
      detail = 0,
      accessory = 0,
      bgColor = '#D1D5DB',
      shape = 'circle',
      flip = false,
    } = config;

    const libConfig = {
      face,
      hair,
      eye,
      eyebrow,
      nose,
      mouth,
      glass,
      beard,
      detail,
      accessory,
    };

    return (
      <div
        ref={ref}
        id={id}
        className={className}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          transform: flip ? 'scaleX(-1)' : undefined,
          transition: 'transform 0.2s ease',
        }}
      >
        <ReactNotionAvatar
          config={libConfig}
          shape={shape}
          bgColor={bgColor}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    );
  }
);

NotionAvatarRenderer.displayName = 'NotionAvatarRenderer';
