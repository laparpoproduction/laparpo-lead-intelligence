type IconProps = { className?: string };

function IconBase({ children, className = "size-4" }: IconProps & { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

export const Icons = {
  dashboard: (props: IconProps) => <IconBase {...props}><path d="M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z" /></IconBase>,
  leads: (props: IconProps) => <IconBase {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></IconBase>,
  pipeline: (props: IconProps) => <IconBase {...props}><path d="M4 5h16M7 12h10M10 19h4" /></IconBase>,
  activity: (props: IconProps) => <IconBase {...props}><path d="M3 12h4l3-8 4 16 3-8h4" /></IconBase>,
  search: (props: IconProps) => <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></IconBase>,
  plus: (props: IconProps) => <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>,
  arrow: (props: IconProps) => <IconBase {...props}><path d="m9 18 6-6-6-6" /></IconBase>,
  spark: (props: IconProps) => <IconBase {...props}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /></IconBase>,
  companies: (props: IconProps) => <IconBase {...props}><path d="M3 21h18M5 21V6l7-3v18M19 21V10l-7-2M8 9h1M8 13h1M8 17h1M15 13h1M15 17h1" /></IconBase>,
  contacts: (props: IconProps) => <IconBase {...props}><circle cx="9" cy="8" r="4" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 8h4M19 6v4" /></IconBase>,
  tasks: (props: IconProps) => <IconBase {...props}><path d="m4 7 2 2 4-4M4 15l2 2 4-4M13 7h7M13 15h7" /></IconBase>,
  campaigns: (props: IconProps) => <IconBase {...props}><path d="m3 11 15-6v14L3 13zM7 14l1.5 6h4L11 13" /></IconBase>,
  settings: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.37.34.71.6 1 .3.28.68.42 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6Z" /></IconBase>,
};
