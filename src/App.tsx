import React, { useState, useEffect, useRef } from 'react';
import { Video, Music, FolderArchive } from 'lucide-react';
import { FloatButton } from './components/FloatButton';
import { DownloadModal } from './components/DownloadModal';
import { QuickActionMenu } from './components/QuickActionMenu';
import { ToastContainer, ToastMessage } from './components/Toast';
import { fetchCurrentMediaData, getVideoTitle } from './api/bilibili';
import { downloadAndMuxMp4, downloadAudio, saveBlobAsFile } from './media/downloader';
import { fetchSubtitleSrt } from './media/subtitle';
import { batchDetectAndDownloadSubtitles } from './media/batchSubtitle';
import { batchDownloadAllLowestAudios, batchDownloadAllHighestVideos } from './media/batchDownloader';
import type { MediaResourceData, VideoStreamItem, AudioStreamItem, DownloadTask, QuickActionItem } from './types';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingCid, setLoadingCid] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [quickMenuPos, setQuickMenuPos] = useState<{ x: number; y: number } | undefined>(undefined);
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

  const handleDownloadBatchAudiosLowest = async (customData?: MediaResourceData) => {
    let data = customData || mediaData;
    if (!data) {
      setLoading(true);
      try {
        data = await fetchCurrentMediaData();
        if (data) setMediaData(data);
      } finally {
        setLoading(false);
      }
    }
    if (!data) {
      showToast('未能解析到视频资源', 'error');
      return;
    }

    if (data.pages.length <= 1) {
      // 单 P 视频：直接下载最低音质
      const lowestAudio = [...data.audios].sort((a, b) => a.bandwidth - b.bandwidth)[0] || data.audios[data.audios.length - 1];
      if (lowestAudio) {
        await handleDownloadAudio(lowestAudio);
      } else {
        showToast('未能获取到音频流', 'error');
      }
      return;
    }

    const controller = new AbortController();
    const taskId = `batch_audios_${data.bvid}`;
    activeControllers.current.set(taskId, controller);

    showToast(`已将 ${data.pages.length} 集最低音质音频加入下载队列`, 'info');

    try {
      await batchDownloadAllLowestAudios(
        data.bvid,
        data.pages,
        upsertTask,
        updateTaskProgress,
        `全集音频-${data.bvid}`,
        controller.signal
      );
      if (!controller.signal.aborted) {
        showToast(`全集 ${data.pages.length} P 音频批量下载任务已就绪`, 'success');
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        showToast('全集音频下载任务已取消', 'info');
      } else {
        showToast(`批量音频下载失败: ${err.message}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleDownloadBatchVideosHighest = async (customData?: MediaResourceData) => {
    let data = customData || mediaData;
    if (!data) {
      setLoading(true);
      try {
        data = await fetchCurrentMediaData();
        if (data) setMediaData(data);
      } finally {
        setLoading(false);
      }
    }
    if (!data) {
      showToast('未能解析到视频资源', 'error');
      return;
    }

    if (data.pages.length <= 1) {
      // 单 P 视频：直接下载最高画质视频 + 最佳音频
      const highestVideo = data.videos[0];
      const bestAudio = data.audios[0];
      if (highestVideo) {
        await handleDownloadVideo(highestVideo, bestAudio);
      } else {
        showToast('未能获取到视频流', 'error');
      }
      return;
    }

    const controller = new AbortController();
    const taskId = `batch_videos_${data.bvid}`;
    activeControllers.current.set(taskId, controller);

    showToast(`已将 ${data.pages.length} 集最高画质 MP4 加入合成队列`, 'info');

    try {
      await batchDownloadAllHighestVideos(
        data.bvid,
        data.pages,
        upsertTask,
        updateTaskProgress,
        `全集视频-${data.bvid}`,
        controller.signal
      );
      if (!controller.signal.aborted) {
        showToast(`全集 ${data.pages.length} P 视频批量合成任务已就绪`, 'success');
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        showToast('全集视频下载任务已取消', 'info');
      } else {
        showToast(`批量视频合成失败: ${err.message}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleFloatButtonContextMenu = (e: React.MouseEvent, pos: { x: number; y: number }) => {
    setQuickMenuPos(pos);
    setIsQuickMenuOpen(true);
  };

  const isBatchSubtitlesRunning = tasks.some(
    (t) => t.id.startsWith('batch_subtitles_') && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled'
  );
  const isBatchAudiosRunning = tasks.some(
    (t) => (t.id.startsWith('batch_audios_') || t.id.startsWith('batch_audio_')) && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled'
  );
  const isBatchVideosRunning = tasks.some(
    (t) => (t.id.startsWith('batch_videos_') || t.id.startsWith('batch_video_')) && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled'
  );

  // 抽象与配置右键快捷操作列表 (支持任意未来快捷项灵活追加)
  const quickActions: QuickActionItem[] = [
    {
      id: 'quick_batch_subtitles',
      icon: <FolderArchive className="w-4 h-4 text-emerald-800 dark:text-emerald-300" strokeWidth={2.2} />,
      label: '一键下载全部字幕',
      loading: isBatchSubtitlesRunning,
      description: mediaData && mediaData.pages.length > 1
        ? `批量探测全集 ${mediaData.pages.length} P 字幕并打包 ZIP 文件夹`
        : '提取当前视频官方/AI双语字幕 (.srt)',
      badge: 'SRT',
      onClick: async () => {
        let targetData = mediaData;
        if (!targetData) {
          setLoading(true);
          try {
            targetData = await fetchCurrentMediaData();
            if (targetData) setMediaData(targetData);
          } finally {
            setLoading(false);
          }
        }
        if (targetData) {
          if (targetData.pages.length > 1) {
            await handleDownloadBatchSubtitles();
          } else if (targetData.subtitles.length > 0) {
            const sub = targetData.subtitles[0];
            const blob = await fetchSubtitleSrt(sub.subtitle_url, '快捷字幕');
            saveBlobAsFile(blob, `${targetData.title}-${sub.lan_doc}字幕.srt`);
            showToast(`${sub.lan_doc}字幕已保存`, 'success');
          } else {
            showToast('当前视频未探测到外挂字幕', 'info');
          }
        }
      },
    },
    {
      id: 'quick_batch_audios_lowest',
      icon: <Music className="w-4 h-4 text-emerald-800 dark:text-emerald-300" strokeWidth={2.2} />,
      label: '一键下载全部最低质量音频',
      loading: isBatchAudiosRunning,
      description: mediaData && mediaData.pages.length > 1
        ? `批量提取全集 ${mediaData.pages.length} P 最低码率音频 (省流)`
        : '提取当前视频最低码率独立音轨 (.m4a)',
      badge: '64K',
      onClick: async () => {
        await handleDownloadBatchAudiosLowest();
      },
    },
    {
      id: 'quick_batch_videos_highest',
      icon: <Video className="w-4 h-4 text-emerald-800 dark:text-emerald-300" strokeWidth={2.2} />,
      label: '一键下载全部最高质量视频',
      loading: isBatchVideosRunning,
      description: mediaData && mediaData.pages.length > 1
        ? `批量下载全集 ${mediaData.pages.length} P 并无损封装含音频 MP4`
        : '下载最高画质视频并合成含音频 MP4',
      badge: 'MP4',
      onClick: async () => {
        await handleDownloadBatchVideosHighest();
      },
    },
  ];

  return (
    <div className={isDark ? 'dark' : ''}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <FloatButton
        loading={loading}
        tasks={tasks}
        onClick={() => handleOpenModal()}
        onContextMenu={handleFloatButtonContextMenu}
      />
      <QuickActionMenu
        isOpen={isQuickMenuOpen}
        onClose={() => setIsQuickMenuOpen(false)}
        actions={quickActions}
        anchorPosition={quickMenuPos}
        title="快捷下载选项"
      />
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
