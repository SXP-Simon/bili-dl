import React, { useState } from 'react';
import { FloatButton } from './components/FloatButton';
import { DownloadModal } from './components/DownloadModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { fetchCurrentMediaData } from './api/bilibili';
import { downloadAndMuxMp4 } from './media/downloader';
import type { MediaResourceData, VideoStreamItem, AudioStreamItem, DownloadProgress } from './types';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediaData, setMediaData] = useState<MediaResourceData | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [progress, setProgress] = useState<DownloadProgress>({
    status: 'idle',
    progress: 0,
  });

  const showToast = (content: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, content, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenModal = async (targetCid?: number) => {
    setLoading(true);
    try {
      const data = await fetchCurrentMediaData(targetCid);
      if (data) {
        setMediaData(data);
        setIsModalOpen(true);
      } else {
        showToast('未能解析到当前视频资源，请确认处于播放页面', 'error');
      }
    } catch (err: any) {
      showToast(`解析失败: ${err.message}`, 'error');
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
      showToast('MP4 无损封装完成，已保存到本地', 'success');
    } catch (err: any) {
      showToast(`下载失败: ${err.message}`, 'error');
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
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
          onShowToast={showToast}
          progress={progress}
        />
      )}
    </>
  );
};
