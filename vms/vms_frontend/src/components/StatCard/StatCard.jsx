import React from 'react';
import "./StatCard.css";

const StatCard = ({ 
  label, 
  title, 
  value, 
  icon: Icon, 
  iconBg, 
  iconColor, 
  colorClass, 
  trend, 
  subText 
}) => {
  const displayLabel = label || title;
  
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) {
      return Icon;
    }
    const IconComponent = Icon;
    return <IconComponent size={22} />;
  };

  const finalIconColor = iconColor || colorClass || "#2563eb";
  const finalIconBg = iconBg || (colorClass ? `${colorClass}1a` : "rgba(37, 99, 235, 0.1)");

  return (
    <div className="vms-stat-card">
      <div className="vms-stat-content">
        <div className="vms-stat-info">
          <p className="vms-stat-label">{displayLabel}</p>
          <p className="vms-stat-value">{value}</p>
          {trend && (
            <span className={`vms-stat-trend ${trend.positive ? "positive" : "negative"}`}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
          )}
          {subText && !trend && (
            <p className="vms-stat-subtext">{subText}</p>
          )}
        </div>
        <div className="vms-stat-icon-box" style={{ background: finalIconBg, color: finalIconColor }}>
          {renderIcon()}
        </div>
      </div>
    </div>
  );
};

export default StatCard;