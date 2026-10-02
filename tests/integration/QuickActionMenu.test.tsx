import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActionMenu } from '../../src/components/QuickActionMenu';
import type { QuickActionItem } from '../../src/types';

describe('QuickActionMenu Integration Tests', () => {
  const mockActions: QuickActionItem[] = [
    {
      id: 'quick_video',
      icon: <span data-testid="icon-video" />,
      label: '下载当前最高画质',
      onClick: vi.fn(),
    },
    {
      id: 'quick_audio',
      icon: <span data-testid="icon-audio" />,
      label: '提取当前音轨',
      onClick: vi.fn(),
    },
    {
      id: 'season_all_videos',
      icon: <span data-testid="icon-season" />,
      label: '下载合集全部视频 (10集)',
      badge: '全集',
      onClick: vi.fn(),
    },
  ];

  it('should render nothing when isOpen is false', () => {
    const { container } = render(
      <QuickActionMenu
        isOpen={false}
        onClose={vi.fn()}
        actions={mockActions}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render action items and header info when open', () => {
    render(
      <QuickActionMenu
        isOpen={true}
        onClose={vi.fn()}
        actions={mockActions}
        headerInfo={{
          title: '测试视频标题',
          bvid: 'BV1test411c7mD',
          isReady: true,
        }}
      />
    );

    expect(screen.getByText('测试视频标题')).toBeInTheDocument();
    expect(screen.getByText('下载当前最高画质')).toBeInTheDocument();
    expect(screen.getByText('提取当前音轨')).toBeInTheDocument();
    expect(screen.getByText('下载合集全部视频 (10集)')).toBeInTheDocument();
    expect(screen.getByText('全集')).toBeInTheDocument();
  });

  it('should trigger action onClick and close menu when item is clicked', () => {
    const onClose = vi.fn();
    render(
      <QuickActionMenu
        isOpen={true}
        onClose={onClose}
        actions={mockActions}
      />
    );

    const actionBtn = screen.getByText('下载当前最高画质').closest('button');
    expect(actionBtn).not.toBeNull();
    fireEvent.click(actionBtn!);

    expect(mockActions[0]?.onClick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should close when pressing Escape key', () => {
    const onClose = vi.fn();
    render(
      <QuickActionMenu
        isOpen={true}
        onClose={onClose}
        actions={mockActions}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
