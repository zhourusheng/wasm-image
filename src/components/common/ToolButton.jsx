import React from 'react';

const ToolButton = ({ 
  icon, 
  title, 
  onClick, 
  disabled = false, 
  isActive = false, 
  className = '',
  variant = 'default' // default, group, icon
}) => {
  // 根据variant选择合适的样式
  let buttonClass = '';
  
  switch (variant) {
    case 'group':
      buttonClass = `icon-btn-group ${isActive ? 'active' : ''} ${className}`;
      break;
    case 'icon':
      buttonClass = `icon-btn ${className}`;
      break;
    default:
      buttonClass = `px-3 py-2 rounded ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;
      break;
  }

  return (
    <button 
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
    </button>
  );
};

export default ToolButton; 