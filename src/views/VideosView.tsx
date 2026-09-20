import React, { useState, useEffect } from 'react';
import { Video, Play, Clock, Eye, X } from 'lucide-react';
import { ApiClient } from '../services/api.ts';
import { VideoCardSkeleton } from '../components/LoadingSkeleton.tsx';
import { VideoItem } from '../types/index.ts';

export const VideosView: React.FC = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ApiClient.getVideos()
      .then((res) => {
        setVideos(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
          <Video className="w-6 h-6 text-rose-500" />
          Videoteca y Mejores Jugadas
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Resúmenes de partidos, cuadrangulares descomunales, engarces defensivos y entrevistas.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <VideoCardSkeleton key={idx} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => setActiveVideo(video)}
              className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 overflow-hidden cursor-pointer transition-all shadow-md hover:shadow-2xl flex flex-col justify-between"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/80 font-mono text-xs text-white font-bold">
                  {video.duration}
                </span>
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-rose-500/90 text-white text-[10px] font-bold uppercase">
                  {video.category || 'Highlights'}
                </span>
              </div>

              <div className="p-4 space-y-2">
                <h3 className="text-sm font-bold text-slate-100 group-hover:text-rose-400 transition-colors line-clamp-2">
                  {video.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/80">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {video.viewsCount?.toLocaleString() || video.views} visualizaciones
                  </span>
                  <span>{video.publishedAt || video.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="font-bold text-slate-200 text-sm truncate">{activeVideo.title}</span>
              <button
                onClick={() => setActiveVideo(null)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video bg-black flex items-center justify-center">
              <img
                src={activeVideo.thumbnail}
                alt={activeVideo.title}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-2xl">
                  <Play className="w-7 h-7 fill-white ml-1" />
                </div>
                <div>
                  <p className="text-white font-bold text-base">Reproduciendo: {activeVideo.title}</p>
                  <p className="text-slate-400 text-xs mt-1">Duración: {activeVideo.duration} • Categoría: {activeVideo.category || 'Highlights'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
