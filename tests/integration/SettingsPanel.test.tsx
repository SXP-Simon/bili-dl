import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../../src/components/SettingsPanel';

vi.mock('$', () => ({
  GM_getValue: vi.fn((key: string, defaultVal: unknown) => {
    if (key === 'bili_dl_settings') {
      return {
        subfolder: 'bili-dl',
        autoTitleFolder: true,
        alwaysAskSaveAs: false,
        enableCdnPriority: true,
        cdnPriorityOrder: ['mirrorcos', 'mirrorcosb', 'mirrorali', 'mirrorwcs', 'mirrorhw', 'mirror08c', 'upcdnws', 'bilivideo.com', 'mcdn', 'akamai'],
        cdnAutoFailover: true,
        cdnMinSpeedKB: 300,
        cdnFailoverDurationSec: 8,
        defaultDownloaderEngine: 'internal',
        externalDownloaderEnabled: true,
        externalDownloaderId: 'abdm',
        abdmEnabled: true,
        abdmPort: 15151,
        aria2Port: 6800,
      };
    }
    return defaultVal;
  }),
  GM_setValue: vi.fn(),
  GM_xmlhttpRequest: vi.fn(),
}));

describe('SettingsPanel Component & Keyboard Isolation Integration Tests', () => {
  it('should render subfolder input with ~/Downloads/ prefix and port input with : prefix', () => {
    const onShowToast = vi.fn();
    const onClose = vi.fn();

    render(<SettingsPanel onClose={onClose} onShowToast={onShowToast} />);

    // Check subfolder prefix and input
    expect(screen.getByText('~/Downloads/')).toBeInTheDocument();
    const subfolderInput = screen.getByPlaceholderText('点击输入子目录名称 (如 bili-dl)') as HTMLInputElement;
    expect(subfolderInput).toBeInTheDocument();
    expect(subfolderInput.value).toBe('bili-dl');

    // Check port input with colon prefix
    expect(screen.getByText('AB Download Manager 监听端口：')).toBeInTheDocument();
    const portInput = screen.getByPlaceholderText('端口') as HTMLInputElement;
    expect(portInput).toBeInTheDocument();
    expect(portInput.value).toBe('15151');
  });

  it('should stop keyboard propagation on ArrowLeft, ArrowRight, and Minus keys in inputs', () => {
    const onShowToast = vi.fn();
    const onClose = vi.fn();

    render(<SettingsPanel onClose={onClose} onShowToast={onShowToast} />);

    const subfolderInput = screen.getByPlaceholderText('点击输入子目录名称 (如 bili-dl)');

    // Test ArrowLeft
    const arrowLeftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(arrowLeftEvent, 'stopPropagation');
    subfolderInput.dispatchEvent(arrowLeftEvent);
    expect(stopPropagationSpy).toHaveBeenCalled();

    // Test Minus key
    const minusEvent = new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true });
    const minusSpy = vi.spyOn(minusEvent, 'stopPropagation');
    subfolderInput.dispatchEvent(minusEvent);
    expect(minusSpy).toHaveBeenCalled();

    // Test Escape should NOT stop propagation so parent modal can handle close
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const escapeSpy = vi.spyOn(escapeEvent, 'stopPropagation');
    subfolderInput.dispatchEvent(escapeEvent);
    expect(escapeSpy).not.toHaveBeenCalled();
  });

  it('should trigger toast on Enter key press in subfolder and port inputs', () => {
    const onShowToast = vi.fn();
    const onClose = vi.fn();

    render(<SettingsPanel onClose={onClose} onShowToast={onShowToast} />);

    const subfolderInput = screen.getByPlaceholderText('点击输入子目录名称 (如 bili-dl)');
    fireEvent.change(subfolderInput, { target: { value: 'my-custom-folder' } });
    fireEvent.keyDown(subfolderInput, { key: 'Enter' });

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('已保存下载子目录: my-custom-folder'),
      'info'
    );

    const portInput = screen.getByPlaceholderText('端口');
    fireEvent.change(portInput, { target: { value: '15200' } });
    fireEvent.keyDown(portInput, { key: 'Enter' });

    expect(onShowToast).toHaveBeenCalledWith(
      expect.stringContaining('已保存 AB Download Manager 监听端口: 15200'),
      'info'
    );
  });
});
