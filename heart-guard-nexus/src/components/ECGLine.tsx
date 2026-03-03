import { useEffect, useRef } from "react";

interface ECGLineProps {
  className?: string;
  color?: string;
  speed?: number;
  height?: number;
}

const ECGLine = ({ className = "", color = "hsl(160, 20%, 46%)", speed = 4, height = 100 }: ECGLineProps) => {
  const pathRef = useRef<SVGPathElement>(null);

  const ecgPattern = `
    l 10 0 l 5 -5 l 5 5 l 5 0
    l 3 0 l 2 -${height * 0.15} l 3 ${height * 0.15}
    l 2 0 l 2 ${height * 0.05} l 2 -${height * 0.05}
    l 2 0 l 1 -${height * 0.6} l 2 ${height * 0.9} l 2 -${height * 0.3} l 1 0
    l 5 0 l 3 -${height * 0.1} l 5 0 l 3 ${height * 0.1} l 5 0
    l 15 0
  `;

  const fullPath = `M 0 ${height * 0.5} ${ecgPattern} ${ecgPattern} ${ecgPattern} ${ecgPattern} ${ecgPattern} ${ecgPattern} ${ecgPattern} ${ecgPattern}`;

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.style.animation = `ecg-sweep ${speed}s linear infinite`;
  }, [speed]);

  return (
    <div className={`overflow-hidden ${className}`}>
      <svg viewBox={`0 0 800 ${height}`} preserveAspectRatio="none" className="w-full h-full">
        <path ref={pathRef} d={fullPath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        <path d={fullPath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.1" />
      </svg>
    </div>
  );
};

export default ECGLine;
