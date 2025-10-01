import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <button style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6 }} {...props}>{children}</button>
);

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, ...style }}>{children}</div>
);

export const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ background: '#eee', padding: '2px 6px', borderRadius: 12 }}>{children}</span>
);

export const Skeleton: React.FC<{ width?: number | string; height?: number | string }> = ({ width = '100%', height = 16 }) => (
  <div style={{ width, height, background: '#f2f2f2', borderRadius: 4 }} />
);
