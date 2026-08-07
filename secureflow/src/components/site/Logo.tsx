import { Link } from "@tanstack/react-router";
import logo from "@/assets/secureflow-logo.png";

export function Logo({
  size = 32,
  withWordmark = true,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <img
        src={logo}
        alt="SecureFlow"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]"
      />
      {withWordmark && (
        <span className="font-display text-lg font-bold tracking-tight">SecureFlow</span>
      )}
    </Link>
  );
}
