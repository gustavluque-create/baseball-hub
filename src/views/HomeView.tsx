import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Flame,
  Award,
  ChevronRight,
  TrendingUp,
  Play,
  ArrowUpRight,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { GameCard } from '../components/GameCard.tsx';
import { MyTeamsSection } from '../components/MyTeamsSection.tsx';
import {
  GameCardSkeleton,
  TableSkeleton,
  LeaderCardSkeleton,
  VideoCardSkeleton,
  Skeleton,
} from '../components/LoadingSkeleton.tsx';
import {
  Game,
  Team,
  Standing,
  NewsArticle,
  VideoItem,
  BattingStats,
} from '../types/index.ts';

export const HomeView: React.FC = () => {
  const {
    activeCompetitionId,
    setActiveTab,
    navigateToGame,
    navigateToNews,
    navigateToPlayer,
    navigateToTeam,
    t,
  } = useApp();

  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ApiClient.getGames({ competition: activeCompetitionId }),
      ApiClient.getStandings({ competition: activeCompetitionId }),
      ApiClient.getNews({ limit: 4 }),
      ApiClient.getVideos(),
      ApiClient.getLeaders({ category: 'batting', stat: 'avg', limit: 3 }),
      ApiClient.getTeams(activeCompetitionId),
    ])
      .then(([g, s, n, v, l, tm]) => {
        setGames(g);
        setStandings(s);
        setNews(n);
        setVideos(v);
        setLeaders(l);
        setTeams(tm);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activeCompetitionId]);

  const featuredArticle = news[0];
  const secondaryArticles = news.slice(1, 4);

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Games / Scoreboard Ticker Header */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('home.liveScores')} &amp; Jornada
            </h2>
          </div>
          <button
            onClick={() => setActiveTab('games')}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>Ver calendario completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Horizontal scroll scoreboard */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="min-w-[280px] sm:min-w-[320px]">
                <GameCardSkeleton />
              </div>
            ))
          ) : (
            games.map((game) => <GameCard key={game.id} game={game} />)
          )}
        </div>
      </section>

      {/* 2. My Teams / Mis Equipos Favoritos */}
      <MyTeamsSection
        teams={teams}
        games={games}
        loading={loading}
      />

      {/* 3. Main Hero Story & Secondary News */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-end min-h-[380px] sm:min-h-[440px] space-y-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-4/5 rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
            <div className="flex flex-col justify-between gap-4">
              <div className="pb-1 border-b border-slate-800">
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <Skeleton className="h-3 w-16 rounded" />
                      <Skeleton className="h-4 w-full rounded" />
                      <Skeleton className="h-3 w-20 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Left 2 Cols: Main Headline Article */}
            {featuredArticle && (
              <div
                onClick={() => navigateToNews(featuredArticle.slug)}
                className="lg:col-span-2 group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer shadow-lg hover:shadow-2xl hover:border-slate-700 transition-all flex flex-col justify-end min-h-[380px] sm:min-h-[440px]"
              >
                {/* Background Image with Gradient Overlay */}
                <img
                  src={featuredArticle.image}
                  alt={featuredArticle.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent"></div>

                {/* Floating content */}
                <div className="relative p-6 sm:p-8 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 font-bold text-xs text-slate-950 uppercase">
                      {featuredArticle.category}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      {featuredArticle.publishedAt} • {featuredArticle.readingTimeMinutes || 4} min
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white group-hover:text-emerald-400 transition-colors leading-tight">
                    {featuredArticle.title}
                  </h1>
                  <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed">
                    {featuredArticle.subtitle || featuredArticle.excerpt}
                  </p>
                </div>
              </div>
            )}

            {/* Right 1 Col: Secondary Breaking News */}
            <div className="flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {t('home.breakingNews')}
                </h3>
                <button
                  onClick={() => setActiveTab('news')}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  Ver todas
                </button>
              </div>

              <div className="space-y-3 flex-1 flex flex-col justify-between">
                {secondaryArticles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => navigateToNews(article.slug)}
                    className="group flex gap-3 p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-all"
                  >
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-20 h-20 rounded-lg object-cover border border-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-400">
                          {article.category}
                        </span>
                        <h4 className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 line-clamp-2 transition-colors mt-0.5">
                          {article.title}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">{article.publishedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* 3. Mid Grid: Standings Snapshot + Leaders Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Standings Table Snapshot */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                {t('home.standingsTable')} (Top 6)
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('standings')}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>{t('home.viewAll')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableSkeleton rows={6} columns={7} />
            ) : (
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 uppercase font-sans text-[11px]">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-3">Equipo</th>
                    <th className="py-2 px-2 text-right">JJ</th>
                    <th className="py-2 px-2 text-right font-bold text-slate-200">G</th>
                    <th className="py-2 px-2 text-right">P</th>
                    <th className="py-2 px-2 text-right font-bold text-emerald-400">PCT</th>
                    <th className="py-2 px-2 text-right">DIF</th>
                    <th className="py-2 px-2 text-right">Racha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {standings.slice(0, 6).map((s, idx) => (
                    <tr
                      key={s.id || s.teamId}
                      onClick={() => navigateToTeam(s.teamId)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-2 text-center text-slate-400 font-bold">
                        {s.rank ?? (idx + 1)}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-200 flex items-center gap-2">
                        <span className="text-lg">{s.teamLogo || s.logo}</span>
                        <span className="hover:text-emerald-400 transition-colors">
                          {s.teamName}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{s.gamesPlayed}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-100">{s.wins}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{s.losses}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-emerald-400">
                        {s.pct.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-400">
                        {typeof s.diff === 'number' ? (s.diff === 0 ? '-' : s.diff.toFixed(1)) : (s.diff || '-')}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            s.streak.startsWith('G')
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {s.streak}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right 1 Col: Líderes Mini Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                {t('home.statLeaders')} (AVG)
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('leaders')}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
            >
              {t('home.viewAll')}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="w-10 h-10 rounded-full" variant="circular" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24 rounded" />
                      <Skeleton className="h-2.5 w-16 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {leaders.map((leader, i) => (
                <div
                  key={leader.playerId}
                  onClick={() => navigateToPlayer(leader.playerId)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-black text-slate-500 w-4 text-center">
                      {i + 1}
                    </span>
                    <img
                      src={leader.playerPhoto}
                      alt={leader.playerName}
                      className="w-10 h-10 rounded-full object-cover border border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                        {leader.playerName}
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {leader.position} • {leader.teamShort}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-base font-black text-emerald-400">
                    {typeof leader.value === 'number' ? leader.value.toFixed(3) : leader.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setActiveTab('statistics')}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span>Explorar tabla de estadísticas completas</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 4. Video Highlights Showcase */}
      {(loading || videos.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-rose-500 fill-rose-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Vídeos y Momentos Destacados
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('videos')}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
            >
              Ver todos ({videos.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <VideoCardSkeleton key={idx} />
              ))
            ) : (
              videos.slice(0, 3).map((video) => (
                <div
                  key={video.id}
                  onClick={() => setActiveTab('videos')}
                  className="group rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer shadow-md hover:shadow-xl transition-all"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 font-mono text-[11px] text-white font-bold">
                      {video.duration}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-rose-400">
                      {video.category || 'Destacado'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-rose-400 line-clamp-2 transition-colors">
                      {video.title}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {video.publishedAt || video.date} • {video.viewsCount?.toLocaleString() || video.views}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};
