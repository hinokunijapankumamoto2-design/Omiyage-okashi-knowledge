import { ReactNode } from "react";

// 章ラッパー。印刷時に章の途中で改ページしない
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-12 break-inside-avoid">
      <h2 className="mb-4 border-b-2 border-caramel pb-2 text-xl font-bold text-heading md:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 leading-relaxed text-heading">{children}</p>;
}

// 表。スマホでは横スクロール許容
export function Table({
  headers,
  rows,
  highlightRow,
}: {
  headers: string[];
  rows: ReactNode[][];
  highlightRow?: number;
}) {
  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-tablehead">
            {headers.map((h) => (
              <th key={h} className="border border-[#E2D5C3] px-3 py-2 text-left font-bold text-heading">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i === highlightRow ? "bg-[#FBEEDC] font-bold" : "bg-white"}>
              {row.map((cell, j) => (
                <td key={j} className="border border-[#E2D5C3] px-3 py-2 align-top leading-relaxed text-heading">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
