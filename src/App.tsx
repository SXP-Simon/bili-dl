import React, { useState, useEffect } from 'react';
import { FloatButton } from './components/FloatButton';
import { DownloadModal } from './components/DownloadModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { fetchCurrentMediaData } from './api/bilibili';
import { downloadAndMuxMp4, downloadAudio } from './media/downloader';
import type { MediaResourceData, VideoStreamItem, AudioStreamItem, DownloadTask } from './types';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingCid, setLoadingCid] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediaData, setMediaData] = useState<MediaResourceData | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bili_dl_theme');
      if (saved) return saved === 'dark';
      return (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    } catch {
      return false;
    }
  });

  // 监听 B 站或系统的深色模式变化
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const saved = localStorage.getItem('bili_dl_theme');
      if (!saved) {
        const isBiliDark =
          document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark');
        setIsDark(isBiliDark);
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const handleToggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('bili_dl_theme', next ? 'dark' : 'light');
  };

  const showToast = (content: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, content, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const upsertTask = (task: DownloadTask) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = task;
        return next;
      }
      return [task, ...prev];
    });
  };

  const updateTaskProgress = (id: string, partial: Partial<DownloadTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...partial } : t))
    );
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearCompletedTasks = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  };

  const handleOpenModal = async (targetCid?: number) => {
    setLoading(true);
    if (targetCid) {
      setLoadingCid(targetCid);
    }
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
      setLoadingCid(null);
    }
  };

  const handleSelectEpisode = (cid: number) => {
    handleOpenModal(cid);
  };

  const handleDownloadVideo = async (video: VideoStreamItem, audio?: AudioStreamItem) => {
    if (!mediaData) return;
    const taskId = `video_${video.id}_${video.codecName}`;
    const taskTitle = `${video.qualityName} (${video.codecName})`;

    upsertTask({
      id: taskId,
      type: 'video',
      title: taskTitle,
      status: 'downloading_video',
      progress: 0,
      message: '正在准备视频流...',
      timestamp: Date.now(),
    });

    try {
      await downloadAndMuxMp4(mediaData.title, video, audio, (prog) => {
        updateTaskProgress(taskId, {
          status: prog.status,
          progress: prog.progress,
          speed: prog.speed,
          message: prog.message,
        });
      });
      showToast(`MP4 无损封装完成 (${taskTitle})`, 'success');
    } catch (err: any) {
      updateTaskProgress(taskId, {
        status: 'error',
        message: `下载失败: ${err.message}`,
      });
      showToast(`下载失败: ${err.message}`, 'error');
    }
  };

  const handleDownloadAudio = async (audio: AudioStreamItem) => {
    if (!mediaData) return;
    const taskId = `audio_${audio.id}`;
    const taskTitle = audio.name;

    upsertTask({
      id: taskId,
      type: 'audio',
      title: taskTitle,
      status: 'downloading_audio',
      progress: 0,
      message: '正在准备音频流...',
      timestamp: Date.now(),
    });

    try {
      await downloadAudio(mediaData.title, audio, (prog) => {
        updateTaskProgress(taskId, {
          status: prog.status,
          progress: prog.progress,
          speed: prog.speed,
          message: prog.message,
        });
      });
      const isFlac = audio.codec?.toLowerCase().includes('flac') || audio.qualityDesc?.includes('FLAC');
      const ext = isFlac ? 'flac' : 'm4a';
      showToast(`音频已保存为 .${ext} 文件 (${taskTitle})`, 'success');
    } catch (err: any) {
      updateTaskProgress(taskId, {
        status: 'error',
        message: `下载失败: ${err.message}`,
      });
      showToast(`音频下载失败: ${err.message}`, 'error');
    }
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <FloatButton loading={loading} onClick={() => handleOpenModal()} />
      {isModalOpen && mediaData && (
        <DownloadModal
          data={mediaData}
          isDark={isDark}
          loadingCid={loadingCid}
          tasks={tasks}
          onRemoveTask={handleRemoveTask}
          onClearCompleted={handleClearCompletedTasks}
          onToggleDark={handleToggleDark}
          onClose={() => {
            setIsModalOpen(false);
          }}
          onDownloadVideo={handleDownloadVideo}
          onDownloadAudio={handleDownloadAudio}
          onSelectEpisode={handleSelectEpisode}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
