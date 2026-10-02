import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EpisodePicker } from '../../src/components/EpisodePicker';
import type { VideoPageItem } from '../../src/types';

describe('EpisodePicker component integration', () => {
  const dummyPages: VideoPageItem[] = [
    { cid: 101, page: 1, part: '序章：初始之地', duration: 120 },
    { cid: 102, page: 2, part: '第一章：探险开始', duration: 300 },
    { cid: 103, page: 3, part: '第二章：危机四伏', duration: 420 },
  ];

  it('should render all episode items when pages > 1', () => {
    const onSelectEpisode = vi.fn();
    render(
      <EpisodePicker
        pages={dummyPages}
        currentCid={101}
        onSelectEpisode={onSelectEpisode}
      />
    );

    expect(screen.getByText(/分 P 剧集/i)).toBeInTheDocument();
    expect(screen.getByText(/3\s*集/i)).toBeInTheDocument();
    expect(screen.getByText(/序章：初始之地/i)).toBeInTheDocument();
    expect(screen.getByText(/第一章：探险开始/i)).toBeInTheDocument();
    expect(screen.getByText(/第二章：危机四伏/i)).toBeInTheDocument();
  });

  it('should call onSelectEpisode when an episode button is clicked', () => {
    const onSelectEpisode = vi.fn();
    render(
      <EpisodePicker
        pages={dummyPages}
        currentCid={101}
        onSelectEpisode={onSelectEpisode}
      />
    );

    const ep2Button = screen.getByRole('button', { name: /第一章：探险开始/i });
    fireEvent.click(ep2Button);

    expect(onSelectEpisode).toHaveBeenCalledWith(102);
  });

  it('should not render anything when pages has 1 or fewer items', () => {
    const onSelectEpisode = vi.fn();
    const { container } = render(
      <EpisodePicker
        pages={[{ cid: 1, page: 1, part: '单集视频', duration: 100 }]}
        currentCid={1}
        onSelectEpisode={onSelectEpisode}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
