import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        // Enforce 'light' theme as initial default
        const savedTheme = localStorage.getItem('crm_theme');
        return savedTheme === 'dark' ? 'dark' : 'light';
    });

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        if (theme === 'dark') {
            root.classList.add('dark');
            body.classList.add('dark');
        } else {
            root.classList.remove('dark');
            body.classList.remove('dark');
        }
        localStorage.setItem('crm_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            const nextTheme = prev === 'dark' ? 'light' : 'dark';
            return nextTheme;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode: theme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeContext;
