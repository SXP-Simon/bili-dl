import React, { useState, useEffect, useRef } from 'react';
import { Video, Music, FolderArchive, Film } from 'lucide-react';
import { FloatButton } from './components/FloatButton';
import { DownloadModal } from './components/DownloadModal';
import { QuickActionMenu } from './components/QuickActionMenu';
import { ToastContainer, ToastMessage } from './components/Toast';
import { fetchCurrentMediaData, getVideoTitle, getBvidFromUrl } from './api/bilibili';
import { downloadAndMuxMp4, downloadAudio, saveBlobAsFile } from './media/downloader';
import { fetchSubtitleSrt } from './media/subtitle';
import { batchDetectAndDownloadSubtitles, batchDownloadSeasonSubtitlesZip } from './media/batchSubtitle';
import { batchDownloadAllLowestAudios, batchDownloadAllHighestVideos, batchDownloadSeasonHighestVideos, batchDownloadSeasonLowestAudios } from './media/batchDownloader';
import { logger } from './utils/logger';
import { getErrorMessage, isAbortError } from './utils/error';
import type { MediaResourceData, VideoStreamItem, AudioStreamItem, DownloadTask, QuickActionItem, QuickMenuHeaderInfo } from './types';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [loadingCid, setLoadingCid] = useState<number | null>(null);
  const [loadingBvid, setLoadingBvid] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [quickMenuPos, setQuickMenuPos] = useState<
    | {
        x: number;
        y: number;
        buttonRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
      }
    | undefined
  >(undefined);
  const [mediaData, setMediaData] = useState<MediaResourceData | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const activeControllers = useRef<Map<string, AbortController>>(new Map());

  // 记录导航序列号，防止快速切集时的竞态乱序覆盖
  const navEpochRef = useRef(0);
  const handleOpenModalRef = useRef<() => void>(() => {});

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

  const isModalOpenRef = useRef(isModalOpen);
  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  // 监听 SPA 路由变化（B 站系列/分 P/推荐视频/列表无刷新切换）
  useEffect(() => {
    let lastUrl = location.href;

    const handleUrlChange = async () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const epoch = ++navEpochRef.current;
        logger.info('Navigation', `检测到页面路由切换: ${currentUrl}`);

        // 切换中途状态：开启切换过渡视觉动效，清除陈旧视频缓存
        setIsSwitching(true);
        setMediaData(null);

        // 若当前面板处于打开状态，自动为新视频重新解析
        if (isModalOpenRef.current) {
          handleOpenModalRef.current();
        } else {
          // 预拉取新页面视频数据并校验 epoch 避免竞态
          fetchCurrentMediaData()
            .then((fresh) => {
              if (epoch === navEpochRef.current && fresh) {
                setMediaData(fresh);
              }
            })
            .catch(() => {})
            .finally(() => {
              if (epoch === navEpochRef.current) {
                setIsSwitching(false);
              }
            });
        }
      }
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleUrlChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleUrlChange();
    };

    window.addEventListener('popstate', handleUrlChange);
    const checkInterval = setInterval(handleUrlChange, 500);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleUrlChange);
      clearInterval(checkInterval);
    };
  }, []);

  const handleToggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('bili_dl_theme', next ? 'dark' : 'light');
  };

  const showToast = (content: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
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

  const handleOpenModal = async (targetCid?: number, targetBvid?: string) => {
    setLoading(true);
    if (targetCid) {
      setLoadingCid(targetCid);
    }
    if (targetBvid) {
      setLoadingBvid(targetBvid);
    }
    try {
      const data = await fetchCurrentMediaData(targetCid, targetBvid);
      if (data) {
        setMediaData(data);
        setIsModalOpen(true);
      } else {
        showToast('未能解析到当前视频资源，请确认处于播放页面', 'error');
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      showToast(`解析失败: ${msg}`, 'error');
    } finally {
      setLoading(false);
      setLoadingCid(null);
      setLoadingBvid(null);
      setIsSwitching(false);
    }
  };
  useEffect(() => {
    handleOpenModalRef.current = handleOpenModal;
  });

    const handleSelectEpisode = (cid: number) => {
    handleOpenModal(cid, mediaData?.bvid);
  };

  const handleSelectSeasonEpisode = (bvid: string) => {
    handleOpenModal(undefined, bvid);
  };

  const handleDownloadVideo = async (video: VideoStreamItem, audio?: AudioStreamItem, customTitle?: string) => {
    const title = customTitle || mediaData?.title || getVideoTitle();
    const isMux = Boolean(audio);
    const taskId = isMux
      ? `video_mux_${video.id}_${video.codecName}`
      : `video_pure_${video.id}_${video.codecName}`;
    const taskTitle = isMux
      ? `${video.qualityName} (${video.codecName}) - 有声 MP4`
      : `${video.qualityName} (${video.codecName}) - 仅画面`;
    const traceId = `${video.qualityName.replace(/\s+/g, '')}-${video.codecName}${isMux ? '-mux' : '-pure'}`;

    // 创建并注册该任务的 AbortController
    const controller = new AbortController();
    activeControllers.current.set(taskId, controller);

    upsertTask({
      id: taskId,
      type: 'video',
      title: taskTitle,
      status: 'downloading_video',
      progress: 0,
      message: isMux ? '正在准备音视频双轨...' : '正在准备纯画面视频流...',
      timestamp: Date.now(),
    });

    try {
      await downloadAndMuxMp4(
        title,
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
        showToast(
          isMux ? `MP4 音画封装完成 (${video.qualityName})` : `纯画面下载完成 (${video.qualityName})`,
          'success'
        );
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        updateTaskProgress(taskId, {
          status: 'cancelled',
          message: '已手动取消下载',
        });
        showToast(`任务已取消 (${taskTitle})`, 'info');
      } else {
        const msg = getErrorMessage(err);
        updateTaskProgress(taskId, {
          status: 'error',
          message: `下载失败: ${msg}`,
        });
        showToast(`下载失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleDownloadAudio = async (audio: AudioStreamItem, customTitle?: string) => {
    const title = customTitle || mediaData?.title || getVideoTitle();
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
        title,
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
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        updateTaskProgress(taskId, {
          status: 'cancelled',
          message: '已手动取消下载',
        });
        showToast(`音频任务已取消 (${taskTitle})`, 'info');
      } else {
        const msg = getErrorMessage(err);
        updateTaskProgress(taskId, {
          status: 'error',
          message: `下载失败: ${msg}`,
        });
        showToast(`音频下载失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  /**
   * 确保获取当前页面实际对应视频的最新数据（防止 SPA 切换后复用陈旧视频）
   */
  const getFreshMediaData = async (customData?: MediaResourceData): Promise<MediaResourceData | null> => {
    const currentBvid = getBvidFromUrl();
    const currentP = new URLSearchParams(location.search).get('p');
    const targetPageIndex = currentP ? parseInt(currentP, 10) - 1 : 0;

    // 校验已有数据是否与当前页面 URL 强一致（BVID 相同且分 P 吻合）
    if (customData && customData.bvid === currentBvid) {
      return customData;
    }
    if (mediaData && mediaData.bvid === currentBvid) {
      if (mediaData.pages.length > 1 && currentP) {
        const expectedCid = mediaData.pages[targetPageIndex]?.cid;
        if (expectedCid && mediaData.cid === expectedCid) {
          return mediaData;
        }
      } else {
        return mediaData;
      }
    }

    setLoading(true);
    setIsSwitching(true);
    try {
      const fresh = await fetchCurrentMediaData();
      if (fresh) {
        setMediaData(fresh);
      }
      return fresh;
    } finally {
      setLoading(false);
      setIsSwitching(false);
    }
  };

  const handleDownloadBatchSubtitles = async (customData?: MediaResourceData) => {
    const data = await getFreshMediaData(customData);
    if (!data) {
      showToast('未能解析到视频资源，请确认处于播放页面', 'error');
      return;
    }

    if (data.pages.length <= 1) {
      if (data.subtitles.length > 0) {
        const sub = data.subtitles[0];
        const blob = await fetchSubtitleSrt(sub.subtitle_url, '快捷字幕');
        saveBlobAsFile(blob, `${data.title}-${sub.lan_doc}字幕.srt`);
        showToast(`${sub.lan_doc}字幕已保存`, 'success');
      } else {
        showToast('当前视频未探测到外挂字幕', 'info');
      }
      return;
    }

    const taskId = `batch_subtitles_${data.bvid}`;
    const mainTitle = getVideoTitle();
    const taskTitle = `全集字幕打包 (${data.pages.length}P)`;
    const traceId = `全集字幕-${data.bvid}`;

    const controller = new AbortController();
    activeControllers.current.set(taskId, controller);

    upsertTask({
      id: taskId,
      type: 'batch_subtitle',
      title: taskTitle,
      status: 'pending',
      progress: 0,
      message: `开始探测 ${data.pages.length} 集字幕...`,
      timestamp: Date.now(),
    });

    try {
      const res = await batchDetectAndDownloadSubtitles(
        data.bvid,
        mainTitle,
        data.pages,
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
          message: `打包完成: 提取到 ${res.foundCount} 集字幕`,
        });
        showToast(`全集字幕已成功打包并保存 (${res.foundCount}/${data.pages.length} 集)`, 'success');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        updateTaskProgress(taskId, {
          status: 'cancelled',
          message: '已手动取消字幕打包',
        });
        showToast('全集字幕打包任务已取消', 'info');
      } else {
        const msg = getErrorMessage(err);
        updateTaskProgress(taskId, {
          status: 'error',
          message: `打包失败: ${msg}`,
        });
        showToast(`全集字幕打包失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  
  // 一键下载合集/系列 (Season) 全部字幕并打包为 ZIP
  const handleDownloadSeasonSubtitles = async (customData?: MediaResourceData) => {
    const data = await getFreshMediaData(customData);
    if (!data?.ugcSeason) {
      showToast('未检测到当前视频属于合集/系列', 'warning');
      return;
    }

    const season = data.ugcSeason;
    const taskId = `season_subtitles_${season.id}`;
    const taskTitle = `[合集字幕] ${season.title} (共 ${season.episodes.length} 集)`;
    const traceId = `合集字幕-${season.id}`;

    const controller = new AbortController();
    activeControllers.current.set(taskId, controller);

    upsertTask({
      id: taskId,
      type: 'batch_subtitle',
      title: taskTitle,
      status: 'pending',
      progress: 0,
      message: `开始探测合集 ${season.episodes.length} 集字幕...`,
      timestamp: Date.now(),
    });

    try {
      const res = await batchDownloadSeasonSubtitlesZip(
        season.title,
        season.episodes,
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
          message: `合集字幕打包完成: 提取到 ${res.foundCount} 集`,
        });
        showToast(`合集字幕已成功打包并保存 (${res.foundCount}/${season.episodes.length} 集)`, 'success');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        updateTaskProgress(taskId, {
          status: 'cancelled',
          message: '已手动取消合集字幕打包',
        });
        showToast('合集字幕打包任务已取消', 'info');
      } else {
        const msg = getErrorMessage(err);
        updateTaskProgress(taskId, {
          status: 'error',
          message: `打包失败: ${msg}`,
        });
        showToast(`合集字幕打包失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  // 一键下载合集/系列 (Season) 全部剧集最低质量音频
  const handleDownloadSeasonAudiosLowest = async (customData?: MediaResourceData) => {
    const data = await getFreshMediaData(customData);
    if (!data?.ugcSeason) {
      showToast('未检测到当前视频属于合集/系列', 'warning');
      return;
    }

    const season = data.ugcSeason;
    const controller = new AbortController();
    const taskId = `season_audios_${season.id}`;
    activeControllers.current.set(taskId, controller);

    showToast(`已将合集全部 ${season.episodes.length} 集音频加入下载队列`, 'info');

    try {
      await batchDownloadSeasonLowestAudios(
        season.title,
        season.episodes,
        upsertTask,
        updateTaskProgress,
        `合集音频-${season.id}`,
        controller.signal
      );
      if (!controller.signal.aborted) {
        showToast(`合集全部 ${season.episodes.length} 集音频下载已完成`, 'success');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        showToast('合集音频下载任务已取消', 'info');
      } else {
        const msg = getErrorMessage(err);
        showToast(`合集音频下载失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  // 一键下载合集/系列 (Season) 全部剧集最高画质视频并合成 MP4
  const handleDownloadSeasonVideosHighest = async (customData?: MediaResourceData) => {
    const data = await getFreshMediaData(customData);
    if (!data?.ugcSeason) {
      showToast('未检测到当前视频属于合集/系列', 'warning');
      return;
    }

    const season = data.ugcSeason;
    const controller = new AbortController();
    const taskId = `season_videos_${season.id}`;
    activeControllers.current.set(taskId, controller);

    showToast(`已将合集全部 ${season.episodes.length} 集最高画质加入合成队列`, 'info');

    try {
      await batchDownloadSeasonHighestVideos(
        season.title,
        season.episodes,
        upsertTask,
        updateTaskProgress,
        `合集视频-${season.id}`,
        controller.signal
      );
      if (!controller.signal.aborted) {
        showToast(`合集全部 ${season.episodes.length} 集视频合成任务已完成`, 'success');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        showToast('合集视频下载任务已取消', 'info');
      } else {
        const msg = getErrorMessage(err);
        showToast(`合集视频合成失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleDownloadBatchAudiosLowest = async (customData?: MediaResourceData) => {
    const data = await getFreshMediaData(customData);
    if (!data) {
      showToast('未能解析到视频资源', 'error');
      return;
    }

    if (data.pages.length <= 1) {
      // 单 P 视频：直接下载最低音质
      const lowestAudio = [...data.audios].sort((a, b) => a.bandwidth - b.bandwidth)[0] || data.audios[data.audios.length - 1];
      if (lowestAudio) {
        await handleDownloadAudio(lowestAudio, data.title);
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
        showToast(`全集 ${data.pages.length} P 音频批量下载任务已完成`, 'success');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        showToast('全集音频下载任务已取消', 'info');
      } else {
        const msg = getErrorMessage(err);
        showToast(`批量音频下载失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleDownloadBatchVideosHighest = async (customData?: MediaResourceData) => {
    const data = await getFreshMediaData(customData);
    if (!data) {
      showToast('未能解析到视频资源', 'error');
      return;
    }

    if (data.pages.length <= 1) {
      // 单 P 视频：直接下载最高画质视频 + 最佳音频
      const highestVideo = data.videos[0];
      const bestAudio = data.audios[0];
      if (highestVideo) {
        await handleDownloadVideo(highestVideo, bestAudio, data.title);
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
        showToast(`全集 ${data.pages.length} P 视频批量合成任务已完成`, 'success');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) {
        showToast('全集视频下载任务已取消', 'info');
      } else {
        const msg = getErrorMessage(err);
        showToast(`批量视频合成失败: ${msg}`, 'error');
      }
    } finally {
      activeControllers.current.delete(taskId);
    }
  };

  const handleFloatButtonContextMenu = (
    _e: React.MouseEvent,
    pos: {
      x: number;
      y: number;
      buttonRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
    }
  ) => {
    setQuickMenuPos(pos);
    setIsQuickMenuOpen(true);

    // 展开快捷操作菜单时，若未加载或当前数据与页面 URL 不一致，后台无感预拉取最新视频数据
    const currentBvid = getBvidFromUrl();
    if (!mediaData || mediaData.bvid !== currentBvid) {
      setIsSwitching(true);
      fetchCurrentMediaData()
        .then((fresh) => {
          if (fresh) setMediaData(fresh);
        })
        .catch(() => {})
        .finally(() => {
          setIsSwitching(false);
        });
    }
  };

  const isBatchSubtitlesRunning = tasks.some(
    (t) => (t.id.startsWith('batch_subtitles_') || t.id.startsWith('season_subtitles_')) && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled'
  );
  const isBatchAudiosRunning = tasks.some(
    (t) => (t.id.startsWith('batch_audios_') || t.id.startsWith('batch_audio_') || t.id.startsWith('season_audio_') || t.id.startsWith('season_audios_')) && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled'
  );
  const isBatchVideosRunning = tasks.some(
    (t) => (t.id.startsWith('batch_videos_') || t.id.startsWith('batch_video_') || t.id.startsWith('season_video_') || t.id.startsWith('season_videos_')) && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled'
  );

  // 计算当前右键菜单的目标上下文头信息
  const currentBvid = getBvidFromUrl();
  const currentP = new URLSearchParams(location.search).get('p');
  const targetPageIndex = currentP ? parseInt(currentP, 10) - 1 : 0;
  const isMediaDataMatched =
    Boolean(mediaData && currentBvid && mediaData.bvid === currentBvid &&
    (mediaData.pages.length <= 1 || !currentP || mediaData.cid === mediaData.pages[targetPageIndex]?.cid));

  const quickMenuHeader: QuickMenuHeaderInfo = {
    bvid: currentBvid || mediaData?.bvid || undefined,
    pageText: currentP ? `P${currentP}` : (mediaData?.ugcSeason ? `合集(${mediaData.ugcSeason.episodes.length}集)` : undefined),
    title: isMediaDataMatched ? mediaData?.title : undefined,
    isReady: isMediaDataMatched && !isSwitching,
  };

  // 抽象与配置右键快捷操作列表 (支持任意未来快捷项灵活追加)
    const hasUgcSeason = Boolean(mediaData?.ugcSeason);
  const seasonEpisodeCount = mediaData?.ugcSeason?.episodes.length || 0;

  // 抽象与配置右键快捷操作列表 (根据是否为合集自动呈现最匹配的选项)
  const quickActions: QuickActionItem[] = hasUgcSeason
    ? [
        {
          id: 'quick_season_videos_highest',
          icon: <Film className="w-4 h-4 text-emerald-800 dark:text-emerald-300" strokeWidth={2.2} />,
          label: `一键下载合集全部视频 (${seasonEpisodeCount}集)`,
          loading: isBatchVideosRunning,
          description: `批量下载合集《${mediaData?.ugcSeason?.title}》全部最高画质 MP4`,
          badge: '合集全量',
          onClick: async () => {
            logger.info('QuickAction', '触发快捷下载: 一键下载合集全部最高画质');
            await handleDownloadSeasonVideosHighest();
          },
        },
        {
          id: 'quick_season_audios_lowest',
          icon: <Music className="w-4 h-4 text-emerald-800 dark:text-emerald-300" strokeWidth={2.2} />,
          label: `一键提取合集全部音频 (${seasonEpisodeCount}集)`,
          loading: isBatchAudiosRunning,
          description: `批量抽取合集《${mediaData?.ugcSeason?.title}》全集省流音频`,
          badge: '合集音频',
          onClick: async () => {
            logger.info('QuickAction', '触发快捷下载: 一键提取合集全部音频');
            await handleDownloadSeasonAudiosLowest();
          },
        },
        {
          id: 'quick_season_subtitles',
          icon: <FolderArchive className="w-4 h-4 text-emerald-800 dark:text-emerald-300" strokeWidth={2.2} />,
          label: `一键打包合集全部字幕 (${seasonEpisodeCount}集)`,
          loading: isBatchSubtitlesRunning,
          description: `探测合集《${mediaData?.ugcSeason?.title}》全部字幕并打包 ZIP`,
          badge: '合集ZIP',
          onClick: async () => {
            logger.info('QuickAction', '触发快捷下载: 一键打包合集全部字幕');
            await handleDownloadSeasonSubtitles();
          },
        },
      ]
    : [
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
            logger.info('QuickAction', '触发快捷下载: 一键下载全部字幕');
            await handleDownloadBatchSubtitles();
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
            logger.info('QuickAction', '触发快捷下载: 一键下载全部最低质量音频');
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
            logger.info('QuickAction', '触发快捷下载: 一键下载全部最高质量视频');
            await handleDownloadBatchVideosHighest();
          },
        },
      ];

  return (
    <div className={isDark ? 'dark' : ''}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <FloatButton
        loading={loading}
        isSwitching={isSwitching}
        tasks={tasks}
        onClick={() => handleOpenModal()}
        onContextMenu={handleFloatButtonContextMenu}
      />
      <QuickActionMenu
        isOpen={isQuickMenuOpen}
        onClose={() => setIsQuickMenuOpen(false)}
        actions={quickActions}
        headerInfo={quickMenuHeader}
        anchorPosition={quickMenuPos}
      />
      {isModalOpen && mediaData && (
        <DownloadModal
          data={mediaData}
          isDark={isDark}
          loadingCid={loadingCid}
          loadingBvid={loadingBvid}
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
          onDownloadSeasonVideos={handleDownloadSeasonVideosHighest}
          onDownloadSeasonAudios={handleDownloadSeasonAudiosLowest}
          onDownloadSeasonSubtitles={handleDownloadSeasonSubtitles}
          onSelectEpisode={handleSelectEpisode}
          onSelectSeasonEpisode={handleSelectSeasonEpisode}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
