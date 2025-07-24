import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ConfigProvider } from 'antd';

// 禁用Ant Design的React版本兼容性检查
ConfigProvider.config({
  theme: {
    hashed: false,
  },
  warning: false
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
) 