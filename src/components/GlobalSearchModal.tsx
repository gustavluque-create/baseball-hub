import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, Shield, Trophy, ArrowRight, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { Player, Team, Competition, NewsArticle } from '../types/index.ts';
import { TeamLogo } from './TeamLogo.tsx';
import { resolvePlayerPhoto, handlePlayerImgError } from '../utils/playerPhoto.ts';

export const GlobalSearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    navigateToPlayer,
    navigateToTeam,
    navigateToNews,
    setActiveCompetitionId,
    setActiveTab,
    t,
  } = useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    players: Player[];
    teams: Team[];
    articles: NewsArticle[];
    competitions: Competition[];
  }>({ players: [], teams: [], articles: [], competitions: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ players: [], teams: [], articles: [], competitions: [] });
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ players: [], teams: [], articles: [], competitions: [] });
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      ApiClient.search(query)
        .then((res) => {
          setResults({
            players: res.players || [],
            teams: res.teams || [],
            articles: res.articles || res.news || [],
            competitions: res.competitions || [],
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isSearchOpen) return null;

  const hasResults =
    results.players.length > 0 ||
    results.teams.length > 0 ||
    results.articles.length > 0 ||
    results.competitions.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-sm"
      onClick={() => setIsSearchOpen(false)}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs text-slate-400 bg-slate-800 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="max-h-[65vh] overflow-y-auto p-4 divide-y divide-slate-800/60">
          {loading && (
            <div className="py-8 text-center text-slate-400 text-sm">
              <span className="inline-block animate-spin mr-2">⚾</span>
              Buscando coincidencias...
            </div>
          )}

          {!loading && query && !hasResults && (
            <div className="py-10 text-center text-slate-400">
              <p className="text-sm font-medium">No se encontraron resultados para &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-500 mt-1">Prueba buscando por jugador, equipo (ej. Matanzas, Industriales) o torneo.</p>
            </div>
          )}

          {!query && (
            <div className="py-8 px-2 text-center text-slate-400">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Sugerencias Rápidas</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Erisbel Arruebarrena', 'Alfredo Despaigne', 'Yoenni Yera', 'Matanzas', 'Industriales', 'Las Tunas'].map((item) => (
                  <button
                    key={item}
                    onClick={() => setQuery(item)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group 1: JUGADORES */}
          {results.players.length > 0 && (
            <div className="py-3 first:pt-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2.5">
                <Users className="w-3.5 h-3.5" />
                <span>Jugadores ({results.players.length})</span>
              </div>
              <div className="space-y-1">
                {results.players.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      navigateToPlayer(p.id);
                      setIsSearchOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={resolvePlayerPhoto(p)}
                        alt={p.fullName}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700"
                        referrerPolicy="no-referrer"
                        onError={(e) => handlePlayerImgError(e, p)}
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                          {p.fullName}{' '}
                          <span className="text-xs text-slate-400 font-normal">#{p.jerseyNumber}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.position} • {p.teamName} ({p.teamShort})
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group 2: EQUIPOS */}
          {results.teams.length > 0 && (
            <div className="py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Equipos ({results.teams.length})</span>
              </div>
              <div className="space-y-1">
                {results.teams.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      navigateToTeam(t.id);
                      setIsSearchOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center p-1 rounded-lg bg-slate-900 border border-slate-750">
                        <TeamLogo logo={t.logo} name={t.name} className="w-full h-full text-xl" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                          {t.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {t.city} • {t.stadium} • Récord: {t.record.wins}-{t.record.losses}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group 3: ARTÍCULOS Y NOTICIAS */}
          {results.articles.length > 0 && (
            <div className="py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400 mb-2.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Artículos y Crónicas ({results.articles.length})</span>
              </div>
              <div className="space-y-1">
                {results.articles.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => {
                      navigateToNews(a.slug || a.id);
                      setIsSearchOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {a.image && (
                        <img
                          src={a.image}
                          alt={a.title}
                          className="w-12 h-9 rounded-lg object-cover border border-slate-700 bg-slate-800 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-100 group-hover:text-purple-300 transition-colors line-clamp-1">
                          {a.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          <span className="font-semibold text-purple-400">{a.category || 'Crónica'}</span>
                          {a.readingTimeMinutes && ` • ${a.readingTimeMinutes} min`}
                          {a.publishedAt && ` • ${new Date(a.publishedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group 4: COMPETICIONES */}
          {results.competitions.length > 0 && (
            <div className="py-3 last:pb-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400 mb-2.5">
                <Trophy className="w-3.5 h-3.5" />
                <span>Competiciones ({results.competitions.length})</span>
              </div>
              <div className="space-y-1">
                {results.competitions.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveCompetitionId(c.id);
                      setActiveTab('home');
                      setIsSearchOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-100 group-hover:text-sky-400 transition-colors">
                        {c.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {c.country} • Tipo: {c.type.toUpperCase()} • Estado: {c.status}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
