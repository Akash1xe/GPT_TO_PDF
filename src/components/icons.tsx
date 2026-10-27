import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function SvgIcon({
  children,
  ...props
}: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h5M9 13h6M9 17h6"/></SvgIcon>;
}

export function ArrowRightIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M5 12h14m-6-6 6 6-6 6"/></SvgIcon>;
}

export function ArrowUpRightIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M7 17 17 7M8 7h9v9"/></SvgIcon>;
}

export function CheckIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m5 12 4 4L19 6"/></SvgIcon>;
}

export function CodeIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-12-4 16"/></SvgIcon>;
}

export function ShieldIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></SvgIcon>;
}

export function LayersIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></SvgIcon>;
}

export function SparkIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2ZM20 18l.7 2.3L23 21l-2.3.7L20 24l-.7-2.3L17 21l2.3-.7L20 18Z"/></SvgIcon>;
}

export function LinkIcon(props: IconProps) {
  return <SvgIcon {...props}><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"/></SvgIcon>;
}
