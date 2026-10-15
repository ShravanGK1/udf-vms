import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import "./ThemeToggle.css";

export default function ThemeToggle({ floating = false, className = "", size = 20 }) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`vms-theme-toggle ${floating ? "floating" : ""} ${className}`}
      onClick={toggleTheme}
      title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      aria-label={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
    >
      {isDark ? (
        <Sun size={size} className="theme-toggle-icon sun-icon" />
      ) : (
        <Moon size={size} className="theme-toggle-icon moon-icon" />
      )}
    </button>
  );
}
