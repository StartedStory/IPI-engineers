type AvatarProps = {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
};

// Shows the user's photo when available, otherwise a circle with their initial.
export function Avatar({ name, src, size = 36, className = '' }: AvatarProps) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || '?';
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`rounded-full object-cover bg-slate-100 ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`rounded-full bg-slate-200 grid place-items-center text-slate-700 font-semibold ${className}`}
    >
      {initial}
    </div>
  );
}
