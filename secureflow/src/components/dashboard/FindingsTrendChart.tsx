import { memo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export type TrendPoint = { d: string; critical: number; high: number; medium: number };

/** Lazy-loaded so recharts stays out of the initial dashboard bundle. */
function FindingsTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -24, right: 4, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gCrit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--critical)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--critical)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gMed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--info)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="d"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            width={44}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="medium"
            stroke="var(--info)"
            fill="url(#gMed)"
            strokeWidth={1.75}
          />
          <Area
            type="monotone"
            dataKey="high"
            stroke="var(--warning)"
            fill="url(#gHigh)"
            strokeWidth={1.75}
          />
          <Area
            type="monotone"
            dataKey="critical"
            stroke="var(--critical)"
            fill="url(#gCrit)"
            strokeWidth={1.75}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(FindingsTrendChart);
