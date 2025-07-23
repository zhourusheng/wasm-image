import React from 'react';
import { Spin } from 'antd';

const LoadingOverlay = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-sm z-20">
      <Spin size="large" />
    </div>
  );
};

export default LoadingOverlay; 