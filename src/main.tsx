import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import mainCss from './styles/main.css?inline';

function bootstrap() {
  const containerId = 'bili-dl-root';
  if (document.getElementById(containerId)) return;

  // 1. 创建宿主容器
  const host = document.createElement('div');
  host.id = containerId;
  document.body.appendChild(host);

  // 2. 挂载 Shadow DOM 彻底隔离样式
  const shadowRoot = host.attachShadow({ mode: 'open' });

  // 阻止 Shadow DOM 内部可编辑元素（input / textarea）的按键事件冒泡至外部 document/window
  // 解决 B站播放器全局快捷键（左右方向键快进退、-_键减速等）因 Shadow DOM retargeting 将 input 识别为 DIV 而劫持按键并 preventDefault 的问题
  const stopInputKeyPropagation = (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    const target = e.composedPath()[0] as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      if (keyEvent.key !== 'Escape') {
        e.stopPropagation();
      }
    }
  };

  shadowRoot.addEventListener('keydown', stopInputKeyPropagation);
  shadowRoot.addEventListener('keyup', stopInputKeyPropagation);
  shadowRoot.addEventListener('keypress', stopInputKeyPropagation);

  // 3. 注入 Tailwind v4 样式
  const styleEl = document.createElement('style');
  styleEl.textContent = mainCss;
  shadowRoot.appendChild(styleEl);

  // 4. 挂载 React 根节点
  const reactRootDiv = document.createElement('div');
  reactRootDiv.id = 'bili-dl-app';
  shadowRoot.appendChild(reactRootDiv);

  const root = ReactDOM.createRoot(reactRootDiv);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
