import React, { useState } from 'react';
import { FloatButton } from './components/FloatButton';
import { DownloadModal } from './components/DownloadModal';
import { fetchCurrentMediaData } from './api/bilibili';
import { downloadAndMuxMp4 } from './media/downloader';
import type { MediaResourceData, VideoStreamItem, AudioStreamItem, DownloadProgress } from './types';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediaData, setMediaData] = useState<MediaResourceData | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>({
    status: 'idle',
    progress: 0,
  });

  const handleOpenModal = async (targetCid?: number) => {
    setLoading(true);
    try {
      const data = await fetchCurrentMediaData(targetCid);
      if (data) {
        setMediaData(data);
        setIsModalOpen(true);
      } else {
        alert('⚠️ 未能解析到当前视频资源，请确认是否处于播放页面');
      }
    } catch (err: any) {
      alert(`解析失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEpisode = (cid: number) => {
    handleOpenModal(cid);
  };

  const handleDownloadVideo = async (video: VideoStreamItem, audio?: AudioStreamItem) => {
    if (!mediaData) return;
    try {
      await downloadAndMuxMp4(mediaData.title, video, audio, (prog) => {
        setProgress(prog);
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <>
      <FloatButton loading={loading} onClick={() => handleOpenModal()} />
      {isModalOpen && mediaData && (
        <DownloadModal
          data={mediaData}
          onClose={() => {
            setIsModalOpen(false);
            setProgress({ status: 'idle', progress: 0 });
          }}
          onDownloadVideo={handleDownloadVideo}
          onSelectEpisode={handleSelectEpisode}
          progress={progress}
        />
      )}
    </>
  );
};
