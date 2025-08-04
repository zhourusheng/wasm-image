import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ConfigProvider, App as AntdApp } from 'antd';
import notificationService, { initializeApp } from './utils/notificationService';

// 禁用Ant Design的React版本兼容性检查
ConfigProvider.config({
  theme: {
    hashed: false,
  },
  warning: false,
});

// 创建一个包装组件，用于初始化notificationService
const AppContent: React.FC = () => {
  // 使用useApp钩子获取App实例
  const antApp = AntdApp.useApp();

  // 初始化notificationService
  useEffect(() => {
    if (antApp) {
      initializeApp(antApp);
    }
  }, [antApp]);

  return <App />;
};

// 外层应用包装器
const AppWrapper: React.FC = () => {
  return (
    <ConfigProvider>
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);