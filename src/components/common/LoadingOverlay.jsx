import React from 'react';

const LoadingOverlay = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-sm z-20">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
};

export default LoadingOverlay; 