import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Users,
  Shield,
  FileText,
  ArrowRight,
  Loader2,
  Calendar,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { ApiClient } from '../services/api.ts';
import { Team, Player, NewsArticle } from '../types/index.ts';
import { TeamLogo } from './TeamLogo.tsx';
import { resolvePlayerPhoto, handlePlayerImgError } from '../utils/playerPhoto.ts';

type SearchCategory = 'all' | 'teams' | 'players' | 'articles';

interface FlattenedResultItem {
  type: 'team' | 'player' | 'article';
  id: string;
  data: Team | Player | NewsArticle;
}

export const HeaderSearchBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { navigateToTeam, navigateToPlayer, navigateToNews, language } = useApp();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Results
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);

  // Local cache for instant (0ms) real-time response
  const [cachedTeams, setCachedTeams] = useState<Team[]>([]);
  const [cachedArticles, setCachedArticles] = useState<NewsArticle[]>([]);
  const [cachedPlayers, setCachedPlayers] = useState<Player[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);

  // Preload teams and articles for 0ms initial filtering
  useEffect(() => {
    let isMounted = true;
    ApiClient.getTeams()
      .then((t) => {
        if (isMounted) setCachedTeams(t);
      })
      .catch(() => {});

    ApiClient.getNews({ limit: 30 })
      .then((n) => {
        if (isMounted) setCachedArticles(n);
      })
      .catch(() => {});

    ApiClient.getPlayers({ limit: 80 })
      .then((res) => {
        if (isMounted && res.items) setCachedPlayers(res.items);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Global keyboard shortcut '/' or 'Cmd+K' to focus input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isInput)) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Click outside listener to dismiss popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time filtering logic (combined cached instant filter + server deep search)
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setTeams([]);
      setPlayers([]);
      setArticles([]);
      setLoading(false);
      setSelectedIndex(-1);
      return;
    }

    // 1. Instant (0ms) local cache filtering
    const localTeams = cachedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.nickname.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        (t.stadium && t.stadium.toLowerCase().includes(q))
    );

    const localPlayers = cachedPlayers.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q) ||
        p.teamShort.toLowerCase().includes(q)
    );

    const localArticles = cachedArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(q)) ||
        (a.excerpt && a.excerpt.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.tags && a.tags.some((tag) => tag.toLowerCase().includes(q)))
    );

    setTeams(localTeams.slice(0, 6));
    setPlayers(localPlayers.slice(0, 6));
    setArticles(localArticles.slice(0, 6));

    // 2. Debounced deep server query (120ms) to ensure complete dataset coverage
    setLoading(true);
    const timer = setTimeout(() => {
      ApiClient.search(q)
        .then((res) => {
          setTeams(res.teams || []);
          setPlayers(res.players || []);
          setArticles(res.articles || res.news || []);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }, 120);

    return () => clearTimeout(timer);
  }, [query, cachedTeams, cachedPlayers, cachedArticles]);

  // Flattened results for tab filtering and keyboard navigation
  const flattenedItems = useMemo<FlattenedResultItem[]>(() => {
    const items: FlattenedResultItem[] = [];

    if (activeCategory === 'all' || activeCategory === 'teams') {
      teams.forEach((t) => items.push({ type: 'team', id: t.id, data: t }));
    }
    if (activeCategory === 'all' || activeCategory === 'players') {
      players.forEach((p) => items.push({ type: 'player', id: p.id, data: p }));
    }
    if (activeCategory === 'all' || activeCategory === 'articles') {
      articles.forEach((a) => items.push({ type: 'article', id: a.id, data: a }));
    }

    return items;
  }, [teams, players, articles, activeCategory]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [flattenedItems.length, activeCategory]);

  // Navigate to selected item
  const handleSelectItem = (item: FlattenedResultItem) => {
    if (item.type === 'team') {
      navigateToTeam(item.id);
    } else if (item.type === 'player') {
      navigateToPlayer(item.id);
    } else if (item.type === 'article') {
      const art = item.data as NewsArticle;
      navigateToNews(art.slug || art.id);
    }
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  // Keyboard navigation handler inside search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flattenedItems.length === 0) return;
      setSelectedIndex((prev) => (prev < flattenedItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flattenedItems.length === 0) return;
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flattenedItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flattenedItems.length) {
        handleSelectItem(flattenedItems[selectedIndex]);
      } else if (flattenedItems.length > 0) {
        handleSelectItem(flattenedItems[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Helper for real-time match highlighting
  const highlightMatch = (text: string, targetQuery: string) => {
    const q = targetQuery.trim();
    if (!q || !text) return text;

    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <span key={i} className="text-emerald-400 font-bold bg-emerald-500/20 px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const totalResultsCount = teams.length + players.length + articles.length;
  const hasMatches = totalResultsCount > 0;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Bar */}
      <div
        className={`relative flex items-center w-full rounded-xl transition-all duration-200 border ${
          isOpen
            ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/50'
            : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="pl-3 pr-2 text-slate-400 flex items-center justify-center pointer-events-none">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-400 transition-colors" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            language === 'es'
              ? 'Buscar equipos, jugadores o artículos...'
              : 'Search teams, players or articles...'
          }
          className="w-full py-1.5 pr-8 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />

        {/* Clear Button or Keyboard Shortcut Badge */}
        <div className="absolute right-2.5 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Borrar búsqueda"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-800/80 rounded border border-slate-700 select-none">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Real-time Popover / Dropdown Results */}
      {isOpen && (
        <div
          ref={resultsListRef}
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-slate-900/98 backdrop-blur-md border border-slate-800 shadow-2xl shadow-black/80 overflow-hidden text-slate-100 divide-y divide-slate-800/60 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] flex flex-col"
        >
          {/* Category Filter Chips Bar */}
          {query.trim() && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/60 overflow-x-auto text-[11px] shrink-0 border-b border-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                Todos ({totalResultsCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('teams')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === 'teams'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>Equipos ({teams.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('players')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === 'players'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Jugadores ({players.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('articles')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === 'articles'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Artículos ({articles.length})</span>
              </button>
            </div>
          )}

          {/* Results Content Area */}
          <div className="overflow-y-auto p-2 space-y-3 flex-1">
            {/* Empty Query State -> Quick Suggestions */}
            {!query.trim() && (
              <div className="p-3 text-center space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Búsqueda Inteligente en Tiempo Real</span>
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Escribe el nombre de cualquier equipo, pelotero cubano o artículo periodístico de la Serie Nacional.
                </p>

                {/* Quick Suggestion Chips */}
                <div className="pt-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Sugerencias populares
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[
                      'Cocodrilos de Matanzas',
                      'Leones de Industriales',
                      'Las Tunas',
                      'Erisbel Arruebarrena',
                      'Alfredo Despaigne',
                      'Pinar del Río',
                      'Entrevista',
                      'Crónica',
                    ].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          setQuery(sug);
                          inputRef.current?.focus();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* No matches found */}
            {query.trim() && !loading && !hasMatches && (
              <div className="py-8 px-4 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-300">
                  No se encontraron resultados para &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-slate-500">
                  Intenta buscar por sigla (ej. MTZ, IND, ART), apellido del pelotero o tema de noticias.
                </p>
              </div>
            )}

            {/* SECTION 1: EQUIPOS */}
            {(activeCategory === 'all' || activeCategory === 'teams') && teams.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Equipos ({teams.length})</span>
                </div>
                <div className="space-y-1">
                  {teams.map((team) => {
                    const itemIndex = flattenedItems.findIndex(
                      (i) => i.type === 'team' && i.id === team.id
                    );
                    const isSelected = selectedIndex === itemIndex;
                    const primaryColor =
                      team.colors?.primary || team.primaryColor || '#10B981';

                    return (
                      <div
                        key={team.id}
                        onClick={() => handleSelectItem({ type: 'team', id: team.id, data: team })}
                        className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-amber-500/20 border border-amber-500/40 text-white'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm shrink-0 overflow-hidden"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <TeamLogo logo={team.logo} name={team.name} size="sm" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs truncate">
                                {highlightMatch(team.name, query)}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-slate-800 text-amber-400 border border-amber-500/20 shrink-0">
                                {highlightMatch(team.shortName, query)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5 inline text-slate-500 shrink-0" />
                              <span>{highlightMatch(team.stadium || team.city, query)}</span>
                              {team.record && (
                                <span className="text-slate-500">
                                  • {team.record.wins}G - {team.record.losses}P
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 pl-2">
                          <span className="text-[10px] font-semibold hidden sm:inline">Ver club</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 2: JUGADORES */}
            {(activeCategory === 'all' || activeCategory === 'players') && players.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  <Users className="w-3.5 h-3.5" />
                  <span>Peloteros ({players.length})</span>
                </div>
                <div className="space-y-1">
                  {players.map((player) => {
                    const itemIndex = flattenedItems.findIndex(
                      (i) => i.type === 'player' && i.id === player.id
                    );
                    const isSelected = selectedIndex === itemIndex;

                    return (
                      <div
                        key={player.id}
                        onClick={() =>
                          handleSelectItem({ type: 'player', id: player.id, data: player })
                        }
                        className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-sky-500/20 border border-sky-500/40 text-white'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={resolvePlayerPhoto(player)}
                            alt={player.fullName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0"
                            referrerPolicy="no-referrer"
                            onError={(e) => handlePlayerImgError(e, player)}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs truncate">
                                {highlightMatch(player.fullName, query)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{player.jerseyNumber}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <span className="font-semibold text-sky-400">{player.position}</span>
                              <span>•</span>
                              <span>
                                {highlightMatch(player.teamName || player.teamShort, query)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all shrink-0 pl-2">
                          <span className="text-[10px] font-semibold hidden sm:inline">Ficha</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 3: ARTÍCULOS Y NOTICIAS */}
            {(activeCategory === 'all' || activeCategory === 'articles') && articles.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Artículos y Crónicas ({articles.length})</span>
                </div>
                <div className="space-y-1">
                  {articles.map((article) => {
                    const itemIndex = flattenedItems.findIndex(
                      (i) => i.type === 'article' && i.id === article.id
                    );
                    const isSelected = selectedIndex === itemIndex;

                    return (
                      <div
                        key={article.id}
                        onClick={() =>
                          handleSelectItem({ type: 'article', id: article.id, data: article })
                        }
                        className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-purple-500/20 border border-purple-500/40 text-white'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {article.image && (
                            <img
                              src={article.image}
                              alt={article.title}
                              className="w-10 h-8 rounded-lg object-cover border border-slate-800 bg-slate-800 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-100 group-hover:text-purple-300 transition-colors line-clamp-1">
                              {highlightMatch(article.title, query)}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                {article.category || 'Noticia'}
                              </span>
                              {article.readingTimeMinutes && (
                                <span>{article.readingTimeMinutes} min lectura</span>
                              )}
                              {article.publishedAt && (
                                <span className="flex items-center gap-0.5 text-slate-500">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {new Date(article.publishedAt).toLocaleDateString(
                                    language === 'es' ? 'es-ES' : 'en-US',
                                    { month: 'short', day: 'numeric' }
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0 pl-2">
                          <span className="text-[10px] font-semibold hidden sm:inline">Leer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation Hints */}
          <div className="px-3 py-1.5 bg-slate-950/80 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span>
                <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[9px] text-slate-300 mr-1">
                  ↑
                </kbd>
                <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[9px] text-slate-300 mr-1">
                  ↓
                </kbd>
                para navegar
              </span>
              <span>•</span>
              <span>
                <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[9px] text-slate-300 mr-1">
                  Enter
                </kbd>
                para seleccionar
              </span>
            </div>
            <span>
              <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[9px] text-slate-300 mr-1">
                Esc
              </kbd>
              cerrar
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
