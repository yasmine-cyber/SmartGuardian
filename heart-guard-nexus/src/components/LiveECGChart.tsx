import { useEffect, useState, useRef } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

interface LiveECGChartProps {
  className?: string;
  title?: string;
}

const generatePoint = (i: number): number => {
  const cycle = i % 60;
  if (cycle === 20) return 85;
  if (cycle === 21) return -20;
  if (cycle === 22) return 100;
  if (cycle === 23) return -30;
  if (cycle === 24) return 40;
  if (cycle >= 15 && cycle <= 18) return 15 + Math.sin(cycle * 0.5) * 10;
  if (cycle >= 30 && cycle <= 35) return 10 + Math.sin(cycle * 0.3) * 15;
  return Math.random() * 4 - 2;
};

const LiveECGChart = ({ className = "", title = "Moniteur en Direct" }: LiveECGChartProps) => {
  const [data, setData] = useState(() =>
    Array.from({ length: 200 }, (_, i) => ({ x: i, y: generatePoint(i) }))
  );
  const counterRef = useRef(200);

  useEffect(() => {
    const interval = setInterval(() => {
      counterRef.current += 1;
      setData((prev) => [...prev.slice(1), { x: counterRef.current, y: generatePoint(counterRef.current) }]);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`bg-card rounded-2xl border border-border p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-critical animate-pulse" />
          <span className="text-xs text-muted-foreground">● En direct</span>
        </div>
      </div>
      <div className="h-44 rounded-xl overflow-hidden bg-muted/30">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis domain={[-50, 120]} hide />
            <Line
              type="monotone"
              dataKey="y"
              stroke="hsl(160, 20%, 46%)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LiveECGChart;
