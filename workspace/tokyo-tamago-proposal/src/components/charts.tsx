import { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { contextShare, geoDistribution, weeklyTrend } from "../data/demo";

const BASE = "#8A5A2B";
const ACCENT = "#B0413E";
const PIE_COLORS = ["#8A5A2B", "#A9774A", "#C6976B", "#DFC0A0", "#3D2B1F"];

function ChartCard({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <div className="mb-6 break-inside-avoid rounded border border-[#E2D5C3] bg-white p-4">
      <h4 className="mb-3 text-sm font-bold text-heading md:text-base">{title}</h4>
      {children}
      {caption && <p className="mt-2 text-xs text-heading/70">{caption}</p>}
    </div>
  );
}

// alert=true の点は強調色で表示
function TrendDot(props: { cx?: number; cy?: number; payload?: { alert?: boolean } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  if (payload?.alert) {
    return <circle cx={cx} cy={cy} r={5} fill={ACCENT} stroke="#fff" strokeWidth={1} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill={BASE} />;
}

export function DemandTrendChart() {
  return (
    <ChartCard title="① 需要シグナル週次推移 ―「買えない・通販希望」言及件数">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={weeklyTrend} margin={{ top: 24, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2D5C3" />
          <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#3D2B1F" }} />
          <YAxis tick={{ fontSize: 12, fill: "#3D2B1F" }} />
          <Tooltip formatter={(v: number) => [`${v}件`, "言及件数"]} />
          <Line
            type="monotone"
            dataKey="count"
            stroke={BASE}
            strokeWidth={2}
            dot={<TrendDot />}
            isAnimationActive={false}
          />
          <ReferenceDot
            x="5/4"
            y={134}
            r={0}
            label={{ value: "GW急増アラート", position: "top", fill: ACCENT, fontSize: 12, fontWeight: "bold" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ContextPieChart() {
  return (
    <ChartCard title="② 文脈別UGC構成比">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={contextShare}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label={(entry) => `${entry.value}%`}
            isAnimationActive={false}
          >
            {contextShare.map((entry, i) => (
              <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => [`${v}%`]} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function GeoBarChart() {
  return (
    <ChartCard
      title="③ 需要の地理分布（言及件数・上位8都道府県）"
      caption="強調色＝現販売エリア外＝催事・EC候補地"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={geoDistribution} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2D5C3" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#3D2B1F" }} />
          <YAxis type="category" dataKey="pref" width={56} tick={{ fontSize: 12, fill: "#3D2B1F" }} />
          <Tooltip formatter={(v: number) => [`${v}件`, "言及件数"]} />
          <Bar dataKey="count" isAnimationActive={false}>
            {geoDistribution.map((entry) => (
              <Cell key={entry.pref} fill={entry.sales_area ? BASE : ACCENT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
