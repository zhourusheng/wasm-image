import React from 'react';

const Slider = ({ 
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  displayValue = null,
  unit = '',
  displayFunc = null
}) => {
  // 格式化显示值
  const getDisplayValue = () => {
    if (displayValue !== null) return displayValue;
    if (displayFunc) return displayFunc(value);
    
    // 默认处理：尝试做适当的格式化
    if (Number.isInteger(parseFloat(value))) {
      return `${value}${unit}`;
    }
    return `${parseFloat(value).toFixed(2)}${unit}`;
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input 
        id={id}
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="text-center text-sm">{getDisplayValue()}</div>
    </div>
  );
};

export default Slider; 