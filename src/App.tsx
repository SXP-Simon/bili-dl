import React, { useState, useEffect, useRef } from 'react';
import { FloatButton } from './components/FloatButton';
import { DownloadModal } from './components/DownloadModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { fetchCurrentMediaData, getVideoTitle } from './api/bilibili';
import { downloadAndMuxMp4, downloadAudio } from './media/downloader';
import { batchDetectAndDownloadSubtitles } from './media/batchSubtitle';
import type { MediaResourceData, VideoStreamItem, AudioStreamItem, DownloadTask } from './types';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingCid, setLoadingCid] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediaData, setMediaData] = useState<MediaResourceData | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const activeControllers = useRef<Map<string, AbortController>>(new Map());

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

  // 监听页面卸载/刷新，主动释放并中止所有在途后台请求
  useEffect(() => {
    const handleBeforeUnload = () => {
      activeControllers.current.forEach((controller) => {
        try {
          controller.abort();
        } catch {}
      });
      activeControllers.current.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, []);

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
    // 若任务正在执行，先触发 Abort 取消断开底层连接与释放资源
    const controller = activeControllers.current.get(id);
    if (controller) {
      controller.abort();
      activeControllers.current.delete(id);
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearCompletedTasks = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'));
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
    const traceId = `${video.qualityName.replace(/\s+/g, '')}-${video.codecName}`;

    // 创建并注册该任务的 AbortController
    const controller = new AbortController();
    activeControllers.current.set(taskId, controller);

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
      await downloadAndMuxMp4(
        mediaData.title,
        video,
        audio,
        (prog) => {
          updateTaskProgress(taskId, {
            status: prog.status,
            progress: prog.progress,
            speed: prog.speed,
            message: prog.message,
          });
        },
        traceId,
        controller.signal
      );
      if (!controller.signal.aborted) {
        showToast(`MP4 无损封装完成 (${taskTitle})`, 'success');
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        updateTaskProgress(taskId, {
          status: 'cancelled',
          message: '已手动取消下载',
        });
        showToast(`任务已取消 (${taskTitle})`, 'info');
      } else {
        updateTaskProgress(taskId, {
          status: 'error',
          message: `下载失败: ${err.message}`,
        });
        showToast(`下载失败: ${err.message}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleDownloadAudio = async (audio: AudioStreamItem) => {
    if (!mediaData) return;
    const taskId = `audio_${audio.id}`;
    const taskTitle = audio.name;
    const traceId = `音频-${audio.name.replace(/\s+/g, '')}`;

    // 创建并注册该任务的 AbortController
    const controller = new AbortController();
    activeControllers.current.set(taskId, controller);

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
      await downloadAudio(
        mediaData.title,
        audio,
        (prog) => {
          updateTaskProgress(taskId, {
            status: prog.status,
            progress: prog.progress,
            speed: prog.speed,
            message: prog.message,
          });
        },
        traceId,
        controller.signal
      );
      if (!controller.signal.aborted) {
        const isFlac = audio.codec?.toLowerCase().includes('flac') || audio.qualityDesc?.includes('FLAC');
        const ext = isFlac ? 'flac' : 'm4a';
        showToast(`音频已保存为 .${ext} 文件 (${taskTitle})`, 'success');
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        updateTaskProgress(taskId, {
          status: 'cancelled',
          message: '已手动取消下载',
        });
        showToast(`音频任务已取消 (${taskTitle})`, 'info');
      } else {
        updateTaskProgress(taskId, {
          status: 'error',
          message: `下载失败: ${err.message}`,
        });
        showToast(`音频下载失败: ${err.message}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleDownloadBatchSubtitles = async () => {
    if (!mediaData || mediaData.pages.length <= 1) return;
    const taskId = `batch_subtitles_${mediaData.bvid}`;
    const mainTitle = getVideoTitle();
    const taskTitle = `全集字幕打包 (${mediaData.pages.length}P)`;
    const traceId = `全集字幕-${mediaData.bvid}`;

    const controller = new AbortController();
    activeControllers.current.set(taskId, controller);

    upsertTask({
      id: taskId,
      type: 'batch_subtitle',
      title: taskTitle,
      status: 'pending',
      progress: 0,
      message: `开始探测 ${mediaData.pages.length} 集字幕...`,
      timestamp: Date.now(),
    });

    try {
      const res = await batchDetectAndDownloadSubtitles(
        mediaData.bvid,
        mainTitle,
        mediaData.pages,
        (prog) => {
          const percent = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;
          updateTaskProgress(taskId, {
            status: 'downloading_video',
            progress: percent,
            message: prog.message,
          });
        },
        traceId,
        controller.signal
      );
      if (!controller.signal.aborted) {
        updateTaskProgress(taskId, {
          status: 'completed',
          progress: 100,
          message: `打包完成: 提取到 ${res.found} 集字幕 (${res.fileName})`,
        });
        showToast(`全集字幕已成功打包并保存 (${res.found}/${res.total} 集)`, 'success');
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        updateTaskProgress(taskId, {
          status: 'cancelled',
          message: '已手动取消字幕打包',
        });
        showToast('全集字幕打包任务已取消', 'info');
      } else {
        updateTaskProgress(taskId, {
          status: 'error',
          message: `打包失败: ${err.message}`,
        });
        showToast(`全集字幕打包失败: ${err.message}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
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
          onDownloadBatchSubtitles={handleDownloadBatchSubtitles}
          onSelectEpisode={handleSelectEpisode}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
