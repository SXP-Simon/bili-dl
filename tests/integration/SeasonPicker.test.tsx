import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeasonPicker } from '../../src/components/SeasonPicker';
import type { UgcSeasonData } from '../../src/types';

describe('SeasonPicker Integration Tests', () => {
  const mockSeason: UgcSeasonData = {
    id: 9999,
    mid: 123456,
    title: '全栈架构师修炼指南',
    epCount: 3,
    episodes: [
      { id: 1, bvid: 'BV1season01', cid: 8001, title: '第1讲: 云原生设计', pageIndex: 1 },
      { id: 2, bvid: 'BV1season02', cid: 8002, title: '第2讲: 高并发网关', pageIndex: 2 },
      { id: 3, bvid: 'BV1season03', cid: 8003, title: '第3讲: 容器编排', pageIndex: 3 },
    ],
  };

  it('should render season header, episode count, and batch action buttons', () => {
    render(
      <SeasonPicker
        ugcSeason={mockSeason}
        currentBvid="BV1season01"
        onSelectEpisode={vi.fn()}
        onDownloadSeasonVideos={vi.fn()}
        onDownloadSeasonAudios={vi.fn()}
        onDownloadSeasonSubtitles={vi.fn()}
      />
    );

    expect(screen.getByTitle('全栈架构师修炼指南')).toBeInTheDocument();
    expect(screen.getByText('全集最高画质')).toBeInTheDocument();
    expect(screen.getByText('全集音频')).toBeInTheDocument();
    expect(screen.getByText('全集字幕')).toBeInTheDocument();
  });

  it('should trigger onSelectEpisode when clicking an episode item', () => {
    const onSelectEpisode = vi.fn();
    render(
      <SeasonPicker
        ugcSeason={mockSeason}
        currentBvid="BV1season01"
        onSelectEpisode={onSelectEpisode}
      />
    );

    const ep2Btn = screen.getByText(/第2讲: 高并发网关/).closest('button');
    expect(ep2Btn).not.toBeNull();
    fireEvent.click(ep2Btn!);

    expect(onSelectEpisode).toHaveBeenCalledWith('BV1season02');
  });

  it('should trigger batch season download callbacks', () => {
    const onDownloadSeasonVideos = vi.fn();
    const onDownloadSeasonAudios = vi.fn();
    const onDownloadSeasonSubtitles = vi.fn();

    render(
      <SeasonPicker
        ugcSeason={mockSeason}
        currentBvid="BV1season01"
        onSelectEpisode={vi.fn()}
        onDownloadSeasonVideos={onDownloadSeasonVideos}
        onDownloadSeasonAudios={onDownloadSeasonAudios}
        onDownloadSeasonSubtitles={onDownloadSeasonSubtitles}
      />
    );

    fireEvent.click(screen.getByText('全集最高画质'));
    expect(onDownloadSeasonVideos).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('全集音频'));
    expect(onDownloadSeasonAudios).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('全集字幕'));
    expect(onDownloadSeasonSubtitles).toHaveBeenCalledTimes(1);
  });
});
