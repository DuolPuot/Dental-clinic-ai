import { useTheme } from '../lib/theme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed',
        bottom: 100,
        left: 20,
        zIndex: 999,
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.15)',
        background: theme === 'dark'
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(99,102,241,0.12)',
        color: theme === 'dark' ? '#fcd34d' : '#6366f1',
        fontSize: '1.1rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.2s',
        backdropFilter: 'blur(8px)',
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
