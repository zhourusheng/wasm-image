import React from 'react';
import { Spin } from 'antd';

const LoadingOverlay = ({ tip }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-sm z-20">
      <Spin size="large" tip={tip}>
        <div className="opacity-0" style={{ width: 100, height: 50 }}></div>
      </Spin>
    </div>
  );
};

LoadingOverlay.defaultProps = {
  tip: '加载中...'
};

export default LoadingOverlay; 