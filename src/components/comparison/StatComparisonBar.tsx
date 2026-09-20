import React from 'react';
import { Award } from 'lucide-react';

export interface StatComparisonBarProps {
  label: string;
  valueA: number | string;
  valueB: number | string;
  numA?: number;
  numB?: number;
  teamAColor?: string;
  teamBColor?: string;
  teamAName?: string;
  teamBName?: string;
  higherIsBetter?: boolean;
  format?: 'number' | 'decimal' | 'percentage' | 'avg' | 'era' | 'whip' | 'raw';
  unit?: string;
  subtitle?: string;
}

export const StatComparisonBar: React.FC<StatComparisonBarProps> = ({
  label,
  valueA,
  valueB,
  numA = typeof valueA === 'number' ? valueA : parseFloat(String(valueA)) || 0,
  numB = typeof valueB === 'number' ? valueB : parseFloat(String(valueB)) || 0,
  teamAColor = '#3b82f6',
  teamBColor = '#10b981',
  higherIsBetter = true,
  format = 'number',
  unit,
  subtitle,
}) => {
  // Determine leader
  const isTie = Math.abs(numA - numB) < 0.0001;
  const isALeading = higherIsBetter ? numA > numB : numA < numB;
  const isBLeading = higherIsBetter ? numB > numA : numB < numA;

  // Format values
  const formatVal = (val: number | string, num: number) => {
    if (format === 'avg') {
      return num.toFixed(3).replace(/^0/, '');
    }
    if (format === 'era' || format === 'whip' || format === 'decimal') {
      return num.toFixed(2);
    }
    if (format === 'percentage') {
      return `${(num > 1 ? num : num * 100).toFixed(1)}%`;
    }
    if (format === 'number') {
      return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(1);
    }
    return String(val);
  };

  const displayA = formatVal(valueA, numA);
  const displayB = formatVal(valueB, numB);

  // Calculate percentages for bar widths
  // If sum is 0, both 50%
  const total = Math.abs(numA) + Math.abs(numB);
  let pctA = 50;
  let pctB = 50;

  if (total > 0) {
    if (higherIsBetter) {
      pctA = Math.max(12, Math.min(88, (Math.abs(numA) / total) * 100));
      pctB = 100 - pctA;
    } else {
      // Lower is better (e.g., ERA): invert proportion
      const invA = 1 / Math.max(0.1, numA);
      const invB = 1 / Math.max(0.1, numB);
      const invTotal = invA + invB;
      pctA = Math.max(12, Math.min(88, (invA / invTotal) * 100));
      pctB = 100 - pctA;
    }
  }

  return (
    <div className="py-2.5 px-3 rounded-xl bg-slate-900/50 hover:bg-slate-850/70 transition-colors border border-slate-800/60 group">
      {/* Top row: Value A, Label / Subtitle, Value B */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {/* Left Side: Team A */}
        <div className="flex items-center gap-1.5 min-w-[70px] text-left">
          {isALeading && !isTie && (
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-slate-950 shrink-0"
              style={{ backgroundColor: teamAColor }}
              title="Lidera esta estadística"
            >
              ★
            </span>
          )}
          <span
            className={`font-mono text-sm sm:text-base font-bold transition-all ${
              isALeading && !isTie ? 'font-black scale-105' : 'text-slate-400'
            }`}
            style={{ color: isALeading && !isTie ? teamAColor : undefined }}
          >
            {displayA}
            {unit ? <span className="text-[10px] ml-0.5 text-slate-500 font-normal">{unit}</span> : null}
          </span>
        </div>

        {/* Center: Stat Name */}
        <div className="flex-1 text-center px-2">
          <span className="text-xs sm:text-sm font-semibold text-slate-200 tracking-wide block truncate">
            {label}
          </span>
          {subtitle && (
            <span className="text-[10px] text-slate-400 block -mt-0.5 truncate">
              {subtitle}
            </span>
          )}
        </div>

        {/* Right Side: Team B */}
        <div className="flex items-center justify-end gap-1.5 min-w-[70px] text-right">
          <span
            className={`font-mono text-sm sm:text-base font-bold transition-all ${
              isBLeading && !isTie ? 'font-black scale-105' : 'text-slate-400'
            }`}
            style={{ color: isBLeading && !isTie ? teamBColor : undefined }}
          >
            {displayB}
            {unit ? <span className="text-[10px] ml-0.5 text-slate-500 font-normal">{unit}</span> : null}
          </span>
          {isBLeading && !isTie && (
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-slate-950 shrink-0"
              style={{ backgroundColor: teamBColor }}
              title="Lidera esta estadística"
            >
              ★
            </span>
          )}
        </div>
      </div>

      {/* Comparison Progress Bar: Center Split Bar */}
      <div className="relative w-full h-2 rounded-full bg-slate-950 overflow-hidden flex items-center p-0.5 border border-slate-800">
        {/* Team A Progress (fills from center to left, or left side width) */}
        <div className="h-full flex-1 flex justify-end pr-0.5">
          <div
            className="h-full rounded-l-full transition-all duration-500"
            style={{
              width: `${pctA}%`,
              backgroundColor: teamAColor,
              opacity: isALeading && !isTie ? 1 : 0.45,
            }}
          />
        </div>

        {/* Center Divider Line */}
        <div className="w-0.5 h-full bg-slate-700 shrink-0 z-10" />

        {/* Team B Progress (fills to right) */}
        <div className="h-full flex-1 flex justify-start pl-0.5">
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{
              width: `${pctB}%`,
              backgroundColor: teamBColor,
              opacity: isBLeading && !isTie ? 1 : 0.45,
            }}
          />
        </div>
      </div>
    </div>
  );
};
