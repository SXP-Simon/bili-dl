import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DownloadModal } from '../../src/components/DownloadModal';
import type { MediaResourceData } from '../../src/types';

describe('DownloadModal Integration Tests', () => {
  const mockData: MediaResourceData = {
    bvid: 'BV1test411c7mD',
    cid: 10001,
    title: '测试视频标题',
    cover: 'https://example.com/cover.jpg',
    duration: 120,
    pages: [{ cid: 10001, page: 1, part: 'P1 测试', duration: 120 }],
    videos: [
      {
        id: 80,
        qualityName: '1080P 高清',
        codecName: 'AVC',
        codec: 'avc1.640028',
        sizeMB: '150.5',
        baseUrl: 'https://example.com/v1080.m4s',
        frameRate: '30',
        bandwidth: 2000000,
        width: 1920,
        height: 1080,
      },
    ],
    audios: [
      {
        id: 30280,
        name: '320Kbps 高品质音轨',
        qualityDesc: '320Kbps',
        codec: 'mp4a.40.2',
        sizeMB: '12.3',
        baseUrl: 'https://example.com/a320.m4s',
        bandwidth: 320000,
      },
    ],
    subtitles: [],
  };

  const defaultProps = {
    data: mockData,
    isDark: false,
    onToggleDark: vi.fn(),
    onClose: vi.fn(),
    onDownloadVideo: vi.fn(),
    onDownloadAudio: vi.fn(),
    onSelectEpisode: vi.fn(),
    onShowToast: vi.fn(),
  };

  it('should render both "有声 MP4" and "仅画面" buttons for video items', async () => {
    await act(async () => {
      render(<DownloadModal {...defaultProps} />);
    });

    expect(screen.getByText('1080P 高清')).toBeInTheDocument();
    expect(screen.getByText('AVC')).toBeInTheDocument();

    const muxBtn = screen.getByRole('button', { name: /有声 MP4/ });
    const pureBtn = screen.getByRole('button', { name: /仅画面/ });
    const cmdBtn = screen.getByRole('button', { name: /命令/ });

    expect(muxBtn).toBeInTheDocument();
    expect(pureBtn).toBeInTheDocument();
    expect(cmdBtn).toBeInTheDocument();
  });

  it('should call onDownloadVideo with bestAudio when clicking "有声 MP4"', async () => {
    const onDownloadVideo = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(<DownloadModal {...defaultProps} onDownloadVideo={onDownloadVideo} />);
    });

    const muxBtn = screen.getByRole('button', { name: /有声 MP4/ });
    await act(async () => {
      fireEvent.click(muxBtn);
    });

    expect(onDownloadVideo).toHaveBeenCalledTimes(1);
    expect(onDownloadVideo).toHaveBeenCalledWith(mockData.videos[0], mockData.audios[0]);
  });

  it('should call onDownloadVideo without audio when clicking "仅画面"', async () => {
    const onDownloadVideo = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(<DownloadModal {...defaultProps} onDownloadVideo={onDownloadVideo} />);
    });

    const pureBtn = screen.getByRole('button', { name: /仅画面/ });
    await act(async () => {
      fireEvent.click(pureBtn);
    });

    expect(onDownloadVideo).toHaveBeenCalledTimes(1);
    expect(onDownloadVideo).toHaveBeenCalledWith(mockData.videos[0], undefined);
  });

  it('should render dynamic external downloader button when onDownloadWithExternal is provided', async () => {
    const onDownloadWithExternal = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(
        <DownloadModal
          {...defaultProps}
          onDownloadWithExternal={onDownloadWithExternal}
        />
      );
    });

    // Buttons should be displayed with active downloader badge on video and audio cards
    const extBtns = screen.getAllByRole('button', { name: /ABDM/ });
    expect(extBtns.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(extBtns[0]!);
    });

    expect(onDownloadWithExternal).toHaveBeenCalledTimes(1);
  });
});
