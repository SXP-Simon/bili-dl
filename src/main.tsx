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
