import React from 'react';
import { Award, Zap, ChevronRight, User } from 'lucide-react';
import { Team, Player, BattingStats, PitchingStats } from '../../types/index.ts';
import { resolvePlayerPhoto, handlePlayerImgError } from '../../utils/playerPhoto.ts';

export interface TeamLeadersComparisonProps {
  awayTeam: Team;
  homeTeam: Team;
  awayTopBatter?: { player: Player; stats: BattingStats };
  homeTopBatter?: { player: Player; stats: BattingStats };
  awayTopPitcher?: { player: Player; stats: PitchingStats };
  homeTopPitcher?: { player: Player; stats: PitchingStats };
  onSelectPlayer?: (playerId: string) => void;
}

export const TeamLeadersComparison: React.FC<TeamLeadersComparisonProps> = ({
  awayTeam,
  homeTeam,
  awayTopBatter,
  homeTopBatter,
  awayTopPitcher,
  homeTopPitcher,
  onSelectPlayer,
}) => {
  const awayColor = awayTeam.colors?.primary || awayTeam.primaryColor || '#3b82f6';
  const homeColor = homeTeam.colors?.primary || homeTeam.primaryColor || '#10b981';

  return (
    <div className="space-y-4">
      {/* 1. Star Batters Head-to-Head */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Award className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
            Duelo de Líderes al Bate
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Away Top Batter */}
          {awayTopBatter ? (
            <div
              onClick={() => onSelectPlayer?.(awayTopBatter.player.id)}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-slate-300 border border-slate-700 overflow-hidden shrink-0"
                  style={{ backgroundColor: `${awayColor}20` }}
                >
                  <img
                    src={resolvePlayerPhoto(awayTopBatter.player)}
                    alt={awayTopBatter.player.fullName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => handlePlayerImgError(e, awayTopBatter.player)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {awayTopBatter.player.position}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{awayTeam.shortName}</span>
                  </div>
                  <h5 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {awayTopBatter.player.fullName}
                  </h5>
                  <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-400 font-mono">
                    <span>
                      AVG: <strong className="text-emerald-400">{awayTopBatter.stats.avg.toFixed(3).replace(/^0/, '')}</strong>
                    </span>
                    <span>•</span>
                    <span>HR: <strong className="text-slate-200">{awayTopBatter.stats.hr}</strong></span>
                    <span>•</span>
                    <span>CI: <strong className="text-slate-200">{awayTopBatter.stats.rbi}</strong></span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
              Sin datos de bateador
            </div>
          )}

          {/* Home Top Batter */}
          {homeTopBatter ? (
            <div
              onClick={() => onSelectPlayer?.(homeTopBatter.player.id)}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-slate-300 border border-slate-700 overflow-hidden shrink-0"
                  style={{ backgroundColor: `${homeColor}20` }}
                >
                  <img
                    src={resolvePlayerPhoto(homeTopBatter.player)}
                    alt={homeTopBatter.player.fullName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => handlePlayerImgError(e, homeTopBatter.player)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {homeTopBatter.player.position}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{homeTeam.shortName}</span>
                  </div>
                  <h5 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {homeTopBatter.player.fullName}
                  </h5>
                  <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-400 font-mono">
                    <span>
                      AVG: <strong className="text-emerald-400">{homeTopBatter.stats.avg.toFixed(3).replace(/^0/, '')}</strong>
                    </span>
                    <span>•</span>
                    <span>HR: <strong className="text-slate-200">{homeTopBatter.stats.hr}</strong></span>
                    <span>•</span>
                    <span>CI: <strong className="text-slate-200">{homeTopBatter.stats.rbi}</strong></span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
              Sin datos de bateador
            </div>
          )}
        </div>
      </div>

      {/* 2. Star Pitchers Head-to-Head */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
            Duelo de Ases del Pitcheo
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Away Top Pitcher */}
          {awayTopPitcher ? (
            <div
              onClick={() => onSelectPlayer?.(awayTopPitcher.player.id)}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-slate-300 border border-slate-700 overflow-hidden shrink-0"
                  style={{ backgroundColor: `${awayColor}20` }}
                >
                  <img
                    src={resolvePlayerPhoto(awayTopPitcher.player)}
                    alt={awayTopPitcher.player.fullName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => handlePlayerImgError(e, awayTopPitcher.player)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {awayTopPitcher.player.position}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{awayTeam.shortName}</span>
                  </div>
                  <h5 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {awayTopPitcher.player.fullName}
                  </h5>
                  <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-400 font-mono">
                    <span>
                      PCL: <strong className="text-cyan-400">{awayTopPitcher.stats.era.toFixed(2)}</strong>
                    </span>
                    <span>•</span>
                    <span>WHIP: <strong className="text-slate-200">{awayTopPitcher.stats.whip.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>K: <strong className="text-slate-200">{awayTopPitcher.stats.so}</strong></span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
              Sin datos de lanzador
            </div>
          )}

          {/* Home Top Pitcher */}
          {homeTopPitcher ? (
            <div
              onClick={() => onSelectPlayer?.(homeTopPitcher.player.id)}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-slate-300 border border-slate-700 overflow-hidden shrink-0"
                  style={{ backgroundColor: `${homeColor}20` }}
                >
                  <img
                    src={resolvePlayerPhoto(homeTopPitcher.player)}
                    alt={homeTopPitcher.player.fullName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => handlePlayerImgError(e, homeTopPitcher.player)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {homeTopPitcher.player.position}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{homeTeam.shortName}</span>
                  </div>
                  <h5 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {homeTopPitcher.player.fullName}
                  </h5>
                  <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-400 font-mono">
                    <span>
                      PCL: <strong className="text-cyan-400">{homeTopPitcher.stats.era.toFixed(2)}</strong>
                    </span>
                    <span>•</span>
                    <span>WHIP: <strong className="text-slate-200">{homeTopPitcher.stats.whip.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>K: <strong className="text-slate-200">{homeTopPitcher.stats.so}</strong></span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
              Sin datos de lanzador
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
