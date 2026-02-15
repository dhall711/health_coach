"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { ProgressPhoto } from "@/lib/types";

export default function ProgressPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<[ProgressPhoto | null, ProgressPhoto | null]>([null, null]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch("/api/photos");
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
      }
    } catch (err) {
      console.error("Failed to load photos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
            notes: "Progress photo",
          }),
        });

        if (res.ok) {
          loadPhotos();
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const deletePhoto = async (id: string) => {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/photos?id=${id}`, { method: "DELETE" });
    loadPhotos();
  };

  const toggleCompare = (photo: ProgressPhoto) => {
    if (!compareMode) return;
    if (comparePhotos[0]?.id === photo.id) {
      setComparePhotos([null, comparePhotos[1]]);
    } else if (comparePhotos[1]?.id === photo.id) {
      setComparePhotos([comparePhotos[0], null]);
    } else if (!comparePhotos[0]) {
      setComparePhotos([photo, comparePhotos[1]]);
    } else if (!comparePhotos[1]) {
      setComparePhotos([comparePhotos[0], photo]);
    }
  };

  const isSelected = (photo: ProgressPhoto) =>
    comparePhotos[0]?.id === photo.id || comparePhotos[1]?.id === photo.id;

  // Group photos by month
  const grouped = photos.reduce(
    (acc, p) => {
      const key = new Date(p.date).toLocaleDateString("en-US", { year: "numeric", month: "long" });
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {} as Record<string, ProgressPhoto[]>,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading progress photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 bg-[var(--card)] rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Progress Photos</h1>
            <p className="text-xs text-slate-400">{photos.length} photos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              setComparePhotos([null, null]);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              compareMode
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-[var(--card)] text-slate-400 hover:text-white"
            }`}
          >
            {compareMode ? "Exit Compare" : "Compare"}
          </button>
          <input type="file" accept="image/*" capture="user" ref={fileRef} onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-semibold hover:bg-sky-600 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "+ New Photo"}
          </button>
        </div>
      </div>

      {/* Compare View */}
      {compareMode && (comparePhotos[0] || comparePhotos[1]) && (
        <div className="mb-6 bg-[var(--card)] rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Side by Side</p>
          <div className="grid grid-cols-2 gap-4">
            {[comparePhotos[0], comparePhotos[1]].map((p, i) => (
              <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-800 relative">
                {p ? (
                  <>
                    <img src={p.photo_url} alt="Progress" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white font-medium">
                        {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {p.weight_at_time && (
                        <p className="text-[10px] text-slate-300">{p.weight_at_time} lbs</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-xs text-slate-500">Select photo {i + 1}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {comparePhotos[0] && comparePhotos[1] && comparePhotos[0].weight_at_time && comparePhotos[1].weight_at_time && (
            <div className="mt-3 text-center">
              <p className="text-sm text-slate-300">
                Weight change:{" "}
                <span className={`font-semibold ${Number(comparePhotos[1].weight_at_time) < Number(comparePhotos[0].weight_at_time) ? "text-emerald-400" : "text-red-400"}`}>
                  {(Number(comparePhotos[1].weight_at_time) - Number(comparePhotos[0].weight_at_time)).toFixed(1)} lbs
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-[var(--card)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No progress photos yet</h2>
          <p className="text-sm text-slate-400 mb-6">Take your first photo to start tracking visual progress</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-6 py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition-colors"
          >
            Take First Photo
          </button>
        </div>
      )}

      {/* Photo Grid by Month */}
      {Object.entries(grouped).map(([month, monthPhotos]) => (
        <div key={month} className="mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{month}</h2>
          <div className="grid grid-cols-3 gap-2">
            {monthPhotos.map((photo) => (
              <div
                key={photo.id}
                className={`aspect-[3/4] rounded-lg overflow-hidden relative group cursor-pointer ${
                  compareMode && isSelected(photo)
                    ? "ring-2 ring-purple-400"
                    : ""
                }`}
                onClick={() => toggleCompare(photo)}
              >
                <img
                  src={photo.photo_url}
                  alt={`Progress ${photo.date}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-[10px] text-white font-medium">
                    {new Date(photo.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  {photo.weight_at_time && (
                    <p className="text-[9px] text-slate-300">{photo.weight_at_time} lbs</p>
                  )}
                </div>
                {!compareMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePhoto(photo.id);
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
                {compareMode && isSelected(photo) && (
                  <div className="absolute top-1.5 left-1.5 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
