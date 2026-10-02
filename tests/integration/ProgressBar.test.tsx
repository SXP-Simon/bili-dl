import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressBar } from '../../src/components/ProgressBar';
import type { DownloadTask } from '../../src/types';

describe('ProgressBar component integration', () => {
  it('should render multiple tasks with their progress and title', () => {
    const tasks: DownloadTask[] = [
      {
        id: 'task-1',
        type: 'video',
        title: '1080P 高清 (AVC)',
        status: 'downloading_video',
        progress: 45,
        speed: '3.2 MB/s',
        message: '正在分片下载...',
        timestamp: Date.now(),
      },
      {
        id: 'task-2',
        type: 'audio',
        title: '320K 极高音质',
        status: 'completed',
        progress: 100,
        message: '已完成下载',
        timestamp: Date.now(),
      },
    ];

    render(<ProgressBar tasks={tasks} />);

    expect(screen.getByText('1080P 高清 (AVC)')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('正在分片下载...')).toBeInTheDocument();

    expect(screen.getByText('320K 极高音质')).toBeInTheDocument();
    expect(screen.getByText('已完成下载')).toBeInTheDocument();
  });

  it('should trigger onRemoveTask when cancel button is clicked', () => {
    const onRemoveTask = vi.fn();
    const tasks: DownloadTask[] = [
      {
        id: 'task-cancel-me',
        type: 'video',
        title: '测试取消任务',
        status: 'downloading_video',
        progress: 20,
        timestamp: Date.now(),
      },
    ];

    render(<ProgressBar tasks={tasks} onRemoveTask={onRemoveTask} />);

    // Click cancel button by its title attribute
    const removeBtn = screen.getByTitle('中断并取消当前下载任务');
    fireEvent.click(removeBtn);

    expect(onRemoveTask).toHaveBeenCalledWith('task-cancel-me');
  });

  it('should render legacy single-progress mode correctly', () => {
    render(
      <ProgressBar
        progress={{
          status: 'muxing',
          progress: 80,
          message: '正在封装混流 MP4 容器...',
        }}
      />
    );

    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('正在封装混流 MP4 容器...')).toBeInTheDocument();
  });
});
