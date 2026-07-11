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
};
