import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WhisperTranscriber } from '../../src/components/WhisperTranscriber';
import * as whisperModule from '../../src/ai/whisper';

describe('WhisperTranscriber UI Component Integration Tests', () => {
  const mockAudios = [
    {
      id: 30280,
      name: '64Kbps 极速音轨',
      qualityDesc: '64Kbps',
      codec: 'mp4a.40.2',
      sizeMB: '2.5',
      baseUrl: 'https://example.com/audio64.m4s',
      bandwidth: 64000,
    },
    {
      id: 30281,
      name: '320Kbps 高品质音轨',
      qualityDesc: '320Kbps',
      codec: 'mp4a.40.2',
      sizeMB: '12.5',
      baseUrl: 'https://example.com/audio320.m4s',
      bandwidth: 320000,
    },
  ];

  beforeEach(() => {
    whisperModule.clearTranscriptionResult();
    vi.spyOn(whisperModule, 'checkWebGpuSupport').mockResolvedValue({
      supported: true,
      adapterInfo: 'WebGPU (NVIDIA RTX 4090)',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render WhisperTranscriber with WebGPU status and model selector', async () => {
    const onShowToast = vi.fn();
    await act(async () => {
      render(
        <WhisperTranscriber
          title="测试视频"
          audios={mockAudios}
          onShowToast={onShowToast}
        />
      );
    });

    expect(screen.getByText('本地 AI 语音转文字 (WebGPU)')).toBeInTheDocument();
    expect(screen.getByText('0 服务器成本')).toBeInTheDocument();
    expect(screen.getByText('WebGPU 已加速')).toBeInTheDocument();
    expect(screen.getByText('开始转写字幕 & 纯文本')).toBeInTheDocument();
  });

  it('should trigger transcription and show result when clicking start button', async () => {
    const onShowToast = vi.fn();
    const mockResult: whisperModule.WhisperTranscriptionResult = {
      text: '这是本地转写的识别结果。',
      srt: '1\n00:00:00,000 --> 00:00:02,000\n这是本地转写的识别结果。\n',
      chunks: [
        { text: '这是本地转写的识别结果。', timestamp: [0, 2.0] },
      ],
      duration: 10,
      model: 'onnx-community/whisper-tiny',
      device: 'webgpu',
      language: 'chinese',
    };

    const transcribeSpy = vi.spyOn(whisperModule, 'transcribeMediaAudio').mockResolvedValue(mockResult);

    await act(async () => {
      render(
        <WhisperTranscriber
          title="测试视频"
          audios={mockAudios}
          onShowToast={onShowToast}
        />
      );
    });

    const startBtn = screen.getByRole('button', { name: /开始转写/ });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    expect(transcribeSpy).toHaveBeenCalledTimes(1);
    // Should prioritize lowest bandwidth audio
    expect(transcribeSpy).toHaveBeenCalledWith(
      mockAudios[0],
      expect.objectContaining({
        language: 'chinese',
        model: 'onnx-community/whisper-tiny',
      })
    );

    // Should display the transcribed result
    expect(screen.getByText('这是本地转写的识别结果。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复制纯文本/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导出 \.srt/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导出 \.txt/ })).toBeInTheDocument();
  });

  it('should copy plain text when clicking "复制纯文本"', async () => {
    const onShowToast = vi.fn();
    const mockResult: whisperModule.WhisperTranscriptionResult = {
      text: '纯文本内容示例',
      srt: '1\n00:00:00,000 --> 00:00:01,000\n纯文本内容示例\n',
      chunks: [{ text: '纯文本内容示例', timestamp: [0, 1.0] }],
      duration: 5,
      model: 'onnx-community/whisper-tiny',
      device: 'webgpu',
      language: 'chinese',
    };

    vi.spyOn(whisperModule, 'transcribeMediaAudio').mockResolvedValue(mockResult);

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    await act(async () => {
      render(
        <WhisperTranscriber
          title="测试视频"
          audios={mockAudios}
          onShowToast={onShowToast}
        />
      );
    });

    const startBtn = screen.getByRole('button', { name: /开始转写/ });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    const copyBtn = screen.getByRole('button', { name: /复制纯文本/ });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('纯文本内容示例');
    expect(onShowToast).toHaveBeenCalledWith('纯文本内容已复制到剪贴板', 'success');
  });
});
