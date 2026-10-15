import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem("vms-theme");
      if (saved === "dark") return "dark";
      if (saved === "light" || saved === "white") return "light";
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch {
      // fallback
    }
    return "light";
  });

  const applyTheme = (newTheme) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", newTheme);
    if (newTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("vms-theme", newTheme);
    } catch {
      // storage unavailable
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for storage changes in other tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "vms-theme" && e.newValue) {
        const normalized = e.newValue === "dark" ? "dark" : "light";
        setThemeState(normalized);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (t) => {
    const normalized = t === "dark" ? "dark" : "light";
    setThemeState(normalized);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === "dark",
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
