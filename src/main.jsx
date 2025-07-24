import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ConfigProvider, App as AntdApp } from 'antd';
import notificationService, { initializeApp } from './utils/notificationService';

// 禁用Ant Design的React版本兼容性检查
ConfigProvider.config({
  theme: {
    hashed: false,
  },
  warning: false
});

// 创建一个包装组件，用于初始化notificationService
const AppContent = () => {
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
const AppWrapper = () => {
  return (
    <ConfigProvider>
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
) 