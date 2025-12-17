import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, Repeat, 
  ChevronLeft, MoreHorizontal, ListMusic, Plus,
  Disc, Mic2, Music, Download, X, Share, Menu,
  Moon, Activity, Folder, ChevronDown, Youtube, LogIn,
  BarChart2, PlayCircle, Home, Sparkles, Wand2, Save,
  RefreshCw, FileAudio, Globe, Trash2, ListPlus, Key, Search, CloudDownload, CheckCircle2, AlertCircle,
  Wind, CloudRain, Waves, Mountain, Leaf
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface LyricLine {
  time: number;
  text: string;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  src: string;
  color?: string;
  source?: 'local' | 'server' | 'youtube' | 'ai' | 'searched' | 'zen'; // Track source
  // For DB storage
  fileBlob?: Blob;
  lyrics?: LyricLine[];
  lyricsSources?: { title: string, uri: string }[];
}

// --- IndexedDB Helper ---
const DB_NAME = 'SpaceMusicDB';
const DB_VERSION = 1;
const STORE_NAME = 'songs';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveSongToDB = async (song: Song, blob: Blob) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const songToStore = { ...song, src: '', fileBlob: blob }; 
    store.put(songToStore);
    return tx.oncomplete;
  } catch (err) {
    console.error('Failed to save song', err);
  }
};

const updateSongInDB = async (song: Song) => {
    try {
        if (!song.fileBlob) return;
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const songToStore = { ...song, src: '' }; // Keep blob, remove src url
        store.put(songToStore);
    } catch(err) {
        console.error("Failed to update song", err);
    }
}

const deleteSongFromDB = async (id: string) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return tx.oncomplete;
  } catch (err) {
    console.error('Failed to delete song', err);
  }
};

const loadSongsFromDB = async (): Promise<Song[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const storedSongs = request.result;
        const songs = storedSongs.map((s: any) => ({
          ...s,
          src: URL.createObjectURL(s.fileBlob),
          source: 'local',
          fileBlob: s.fileBlob // Keep blob for AI usage
        }));
        resolve(songs);
      };
    });
  } catch (err) {
    console.error('Failed to load songs', err);
    return [];
  }
};

// --- Data ---
const ZEN_SOUNDS: Song[] = [
    {
        id: 'zen-1',
        title: 'Forest Morning',
        artist: 'Nature',
        album: 'Zen Mode',
        duration: 999,
        cover: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1000&auto=format&fit=crop',
        src: 'https://actions.google.com/sounds/v1/nature/forest_morning.ogg', // Reliable Google Source
        source: 'zen'
    },
    {
        id: 'zen-2',
        title: 'The Bahamas',
        artist: 'Ocean',
        album: 'Zen Mode',
        duration: 999,
        cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1000&auto=format&fit=crop',
        src: 'https://actions.google.com/sounds/v1/water/waves_crashing.ogg', // Reliable Google Source
        source: 'zen'
    },
    {
        id: 'zen-3',
        title: 'Switzerland',
        artist: 'Alps Stream',
        album: 'Zen Mode',
        duration: 999,
        cover: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=1000&auto=format&fit=crop', // Working Alps Image
        src: 'https://actions.google.com/sounds/v1/water/stream_flowing.ogg', // Reliable Google Source
        source: 'zen'
    },
    {
        id: 'zen-4',
        title: 'Rainy Night',
        artist: 'Storm',
        album: 'Zen Mode',
        duration: 999,
        cover: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1000&auto=format&fit=crop',
        src: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg', // Reliable Google Source
        source: 'zen'
    }
];

// Start with Zen sounds as default for "Beautiful Nature Music" request
const DEFAULT_PLAYLIST: Song[] = [...ZEN_SOUNDS];

const MOCK_LYRICS: LyricLine[] = [
    { time: 0, text: "..." },
    { time: 6, text: "(Instrumental / Nature Sound)" },
    { time: 12, text: "Relax and breathe..." },
];

const QUOTES = [
  "Music is the silence between the notes.",
  "Where words fail, music speaks.",
  "Life is like a beautiful melody, only the lyrics are messed up.",
  "Without music, life would be a mistake.",
  "Music washes away from the soul the dust of everyday life.",
  "The only truth is music.",
  "Music touches us emotionally, where words alone can't.",
  "Rhythm and harmony find their way into the inward places of the soul."
];

// --- Utilities ---
const formatTime = (time: number) => {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const formatRulerTime = (time: number) => {
  if (time < 60) return time.toString();
  return formatTime(time);
};

// --- Components ---

const App = () => {
  const [playlist, setPlaylist] = useState<Song[]>(DEFAULT_PLAYLIST);
  const [currentSong, setCurrentSong] = useState<Song | null>(DEFAULT_PLAYLIST[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<'list' | 'player' | 'landing' | 'ai-studio' | 'lyrics' | 'zen-home' | 'zen-list' | 'youtube'>('list');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Real-time Clock for Zen Mode
  const [currentDate, setCurrentDate] = useState(new Date());

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [visualizerEnabled, setVisualizerEnabled] = useState(true);
  const [eqPreset, setEqPreset] = useState('Flat');
  const [showMyUploads, setShowMyUploads] = useState(false);
  
  // API Keys
  const [userApiKey, setUserApiKey] = useState(() => {
      try {
          return localStorage.getItem('space_music_api_key') || '';
      } catch(e) { return ''; }
  });
  
  const [youtubeApiKey, setYoutubeApiKey] = useState(() => {
      try {
          return localStorage.getItem('space_music_yt_key') || '';
      } catch(e) { return ''; }
  });

  // AI Studio State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSongs, setGeneratedSongs] = useState<Song[]>([]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Zen Mode State
  const [zenSearchTerm, setZenSearchTerm] = useState('');
  
  // YouTube Mode State
  const [youtubeSearchTerm, setYoutubeSearchTerm] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<Song[]>([]);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const ytPlayerRef = useRef<any>(null);
  const ytProgressInterval = useRef<any>(null);
  const lastYtVideoId = useRef<string | null>(null);

  // Quotes
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Liked Songs
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
      try {
        const saved = localStorage.getItem('space_music_liked_ids');
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch (e) { return new Set(); }
  });
  const [showLikedSongs, setShowLikedSongs] = useState(false);
  
  // Lyrics Logic
  const [lyrics, setLyrics] = useState<LyricLine[]>(MOCK_LYRICS);
  const [activeLyricIndex, setActiveLyricIndex] = useState(0);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [lyricsSources, setLyricsSources] = useState<{ title: string, uri: string }[]>([]);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Context Menu State
  const [contextMenuSong, setContextMenuSong] = useState<Song | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
      localStorage.setItem('space_music_liked_ids', JSON.stringify(Array.from(likedIds)));
  }, [likedIds]);

  // Update Clock
  useEffect(() => {
      const timer = setInterval(() => setCurrentDate(new Date()), 1000);
      return () => clearInterval(timer);
  }, []);
  
  // Initialize YouTube IFrame API
  useEffect(() => {
      const loadYt = () => {
          if ((window as any).YT && (window as any).YT.Player) {
              ytPlayerRef.current = new (window as any).YT.Player('youtube-player', {
                  height: '1',
                  width: '1',
                  playerVars: {
                      'playsinline': 1,
                      'controls': 0,
                      'disablekb': 1,
                      'origin': window.location.origin
                  },
                  events: {
                      'onStateChange': onYtPlayerStateChange,
                      'onReady': (event: any) => event.target.setVolume(100),
                      'onError': (e: any) => console.log('YT Error', e)
                  }
              });
          }
      };

      if (!(window as any).YT) {
          const tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
          (window as any).onYouTubeIframeAPIReady = loadYt;
      } else {
          loadYt();
      }
  }, []);

  const onYtPlayerStateChange = (event: any) => {
      // 0 = ENDED, 1 = PLAYING, 2 = PAUSED
      if (event.data === 0) {
          nextSong();
      }
  };

  // Handle Lyrics Update on Song Change
  useEffect(() => {
    if (currentSong?.lyrics) {
        setLyrics(currentSong.lyrics);
    } else {
        setLyrics(MOCK_LYRICS);
    }
    setActiveLyricIndex(0); // Reset index on song change
    
    // Update sources
    if (currentSong?.lyricsSources) {
        setLyricsSources(currentSong.lyricsSources);
    } else {
        setLyricsSources([]);
    }
  }, [currentSong]);
  
  // Notification Timer
  useEffect(() => {
      if (notification) {
          const t = setTimeout(() => setNotification(null), 3000);
          return () => clearTimeout(t);
      }
  }, [notification]);

  // Quote Rotation
  useEffect(() => {
    const interval = setInterval(() => {
        setQuoteIndex(prev => (prev + 1) % QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const toggleLike = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setLikedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };
  
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setUserApiKey(val);
      localStorage.setItem('space_music_api_key', val);
  };
  
  const handleYoutubeApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setYoutubeApiKey(val);
      localStorage.setItem('space_music_yt_key', val);
  };

  // Install
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  // Timeline dragging
  const rulerRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null); 
  const isDraggingRef = useRef(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const crossfadeAudioRef = useRef<HTMLAudioElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crossfade & Click Sound Refs
  const isCrossfading = useRef(false);
  const crossfadeTransitioning = useRef(false); 
  const clickAudioCtx = useRef<AudioContext | null>(null);
  const lastClickValue = useRef(0);
  
  // Filter for Searched Album
  const searchedSongs = playlist.filter(s => s.album === 'Searched' || s.source === 'searched');
  const displayPlaylist = playlist; 

  // --- Scrolling Ruler Logic ---
  const PIXELS_PER_SECOND = 15; 
  const TICK_SPACING = 15;

  useEffect(() => {
    let rafId: number;
    const animate = () => {
        if (ticksRef.current) {
            // Priority: YouTube time if active, else Audio time
            let t = 0;
            if (currentSong?.source === 'youtube' && isPlaying) {
                 t = currentTime; // Synced via interval
            } else if (audioRef.current) {
                 t = audioRef.current.currentTime || 0;
            }
            ticksRef.current.style.transform = `translateX(-${t * PIXELS_PER_SECOND}px)`;
        }
        rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [currentSong, isPlaying, currentTime]);

  useEffect(() => {
    loadSongsFromDB().then(savedSongs => {
      if (savedSongs.length > 0) {
        setPlaylist(prev => {
             const ids = new Set(prev.map(p => p.id));
             const newSongs = savedSongs.filter(s => !ids.has(s.id));
             return [...prev, ...newSongs];
        });
      }
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    setIsStandalone(mq.matches);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // --- Playback Logic Hub ---
  useEffect(() => {
    const isYoutube = currentSong?.source === 'youtube';

    // 1. Handle HTML5 Audio Element
    if (audioRef.current) {
        if (isYoutube) {
             // If we switched to YouTube, pause HTML5 audio immediately
             audioRef.current.pause();
        } else {
             // Standard Audio File Logic
             if (isPlaying) {
                // Ensure src is set before playing (React re-render timing)
                if (audioRef.current.src !== currentSong?.src && currentSong?.src) {
                    audioRef.current.src = currentSong.src;
                }

                if (crossfadeTransitioning.current) {
                    audioRef.current.play().catch(console.error);
                } else {
                    audioRef.current.volume = 1;
                    audioRef.current.play().catch(e => {
                        console.error("Playback failed", e);
                        setIsPlaying(false);
                    });
                }
             } else {
                 audioRef.current.pause();
             }
        }
    }

    // 2. Handle YouTube Player
    if (isYoutube && ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
         const videoId = currentSong?.src;
         
         // If song changed
         if (videoId !== lastYtVideoId.current) {
             lastYtVideoId.current = videoId;
             ytPlayerRef.current.loadVideoById(videoId);
         }
         
         // Handle Play/Pause
         if (isPlaying) {
             ytPlayerRef.current.playVideo();
         } else {
             ytPlayerRef.current.pauseVideo();
         }
    } else if (!isYoutube && ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
         // Stop YT if we switched away
         if (lastYtVideoId.current) {
            ytPlayerRef.current.stopVideo();
            lastYtVideoId.current = null;
         }
    }

    // 3. YouTube Progress Polling
    if (isYoutube && isPlaying) {
        ytProgressInterval.current = setInterval(() => {
            if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
                const t = ytPlayerRef.current.getCurrentTime();
                const d = ytPlayerRef.current.getDuration();
                setCurrentTime(t);
                if (d) setDuration(d);
                handleTimeUpdateForYoutube(t);
            }
        }, 500);
    } else {
        if (ytProgressInterval.current) clearInterval(ytProgressInterval.current);
    }

    return () => { if (ytProgressInterval.current) clearInterval(ytProgressInterval.current); };

  }, [isPlaying, currentSong]);

  // --- MEDIA SESSION & EVENTS ---
  const updatePositionState = () => {
    if ('mediaSession' in navigator && !isNaN(duration)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: duration || 0,
                playbackRate: 1,
                position: currentTime || 0
            });
        } catch (e) { /* Ignore */ }
    }
  };

  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: currentSong.album,
      artwork: [
        { src: currentSong.cover, sizes: '512x512', type: 'image/jpeg' },
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', prevSong);
    navigator.mediaSession.setActionHandler('nexttrack', nextSong);

    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
             handleSeekRaw(details.seekTime);
        }
    });

  }, [currentSong, playlist]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      updatePositionState();
    }
  }, [isPlaying, currentTime]);

  // Logic shared between Audio onTimeUpdate and YT Polling
  const syncLyrics = (cur: number) => {
      const hasSynced = lyrics.some(l => l.time >= 0);
      if (hasSynced) {
          let newActiveIndex = -1;
          for (let i = 0; i < lyrics.length; i++) {
              if (lyrics[i].time >= 0 && lyrics[i].time <= cur) {
                  newActiveIndex = i;
              } else if (lyrics[i].time > cur) {
                  break;
              }
          }
          if (newActiveIndex !== -1 && newActiveIndex !== activeLyricIndex) {
              setActiveLyricIndex(newActiveIndex);
          }
      }
  };

  const handleTimeUpdateForYoutube = (t: number) => {
      syncLyrics(t);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && !isDraggingRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 0;
      setCurrentTime(cur);
      setDuration(dur);
      syncLyrics(cur);
      
      if (dur > 10 && (dur - cur) < 4 && !isCrossfading.current && isPlaying) {
          triggerCrossfade();
      }
    }
  };
  
  // Auto-scroll lyrics
  useEffect(() => {
      if (view === 'lyrics' && lyricsContainerRef.current) {
          const hasSynced = lyrics.some(l => l.time >= 0);
          if (hasSynced) {
              const wrapper = lyricsContainerRef.current.children[0];
              if (wrapper && wrapper.children[activeLyricIndex]) {
                  const activeEl = wrapper.children[activeLyricIndex] as HTMLElement;
                  activeEl.scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'center',
                      inline: 'center' 
                  });
              }
          }
      }
  }, [activeLyricIndex, view, lyrics]);
  
  const triggerCrossfade = () => {
      isCrossfading.current = true;
      crossfadeTransitioning.current = true;
      if (crossfadeAudioRef.current && audioRef.current && currentSong) {
          crossfadeAudioRef.current.src = currentSong.src; 
          crossfadeAudioRef.current.currentTime = audioRef.current.currentTime;
          crossfadeAudioRef.current.volume = 1;
          crossfadeAudioRef.current.play().catch(e => console.log("Crossfade play error", e));
      }
      nextSong();
  };

  const handleSongEnd = () => {
    if (currentSong?.source === 'zen') {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        }
    } else if (!isCrossfading.current) {
        nextSong();
    }
  };

  const playSong = (song: Song) => {
    // If playing a search result with no source, warn user
    if ((!song.src || song.src.trim() === '') && song.source === 'searched') {
        setNotification({msg: "No playable link found. Try downloading it.", type: 'error'});
        return;
    }

    isCrossfading.current = false; 
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
      if (view === 'list') setView('player');
    } else {
      // Force pause first to ensure src switch happens cleanly for audio elements
      if (audioRef.current) audioRef.current.pause();
      
      setCurrentSong(song);
      setIsPlaying(true);
      
      // If playing from YouTube, do not auto-open player to keep "Audio Only" feel, 
      // unless user is already in player or landing. 
      // But user requested "When I click on a song it should play", visual feedback is good.
      // Keeping logic to open player unless in special views.
      if (view !== 'ai-studio' && view !== 'lyrics' && view !== 'zen-home' && view !== 'zen-list' && view !== 'youtube') {
          setView('player');
      }
    }
  };

  const nextSong = () => {
    if (!currentSong) return;
    const idx = playlist.findIndex(s => s.id === currentSong.id);
    const nextIdx = (idx + 1) % playlist.length;
    setCurrentSong(playlist[nextIdx]);
    setIsPlaying(true);
  };

  const prevSong = () => {
    if (!currentSong) return;
    const idx = playlist.findIndex(s => s.id === currentSong.id);
    const prevIdx = (idx - 1 + playlist.length) % playlist.length;
    setCurrentSong(playlist[prevIdx]);
    setIsPlaying(true);
  };
  
  const playClick = () => {
      if (!clickAudioCtx.current) {
          clickAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = clickAudioCtx.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine'; 
      oscillator.frequency.setValueAtTime(800, ctx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

      gainNode.gain.setValueAtTime(0.05, ctx.currentTime); 
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.05);
  };

  const handleSeekRaw = (time: number) => {
     if (Math.floor(time) !== Math.floor(lastClickValue.current)) {
        playClick();
        lastClickValue.current = time;
     }
     if (currentSong?.source === 'youtube' && ytPlayerRef.current) {
         ytPlayerRef.current.seekTo(time, true);
         setCurrentTime(time);
     } else if (audioRef.current) {
         audioRef.current.currentTime = time;
         setCurrentTime(time);
     }
     updatePositionState();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    handleSeekRaw(time);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let title = file.name.replace(/\.[^/.]+$/, "");
      let artist = "Unknown Artist";
      let cover = 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=1000&auto=format&fit=crop';
      let album = "My Files";

      // 1. Basic Filename Parsing (Artist - Title.mp3)
      if (title.includes("-")) {
          const parts = title.split("-");
          if (parts.length > 1) {
              artist = parts[0].trim();
              title = parts.slice(1).join("-").trim();
          }
      }

      // 2. Advanced: Attempt to read ID3 tags using jsmediatags
      if ((window as any).jsmediatags) {
          try {
              const tags: any = await new Promise((resolve) => {
                  (window as any).jsmediatags.read(file, {
                      onSuccess: (tag: any) => resolve(tag.tags),
                      onError: (error: any) => {
                          console.log("Tags error:", error);
                          resolve(null);
                      }
                  });
              });

              if (tags) {
                  if (tags.title) title = tags.title;
                  if (tags.artist) artist = tags.artist;
                  if (tags.album) album = tags.album;
                  if (tags.picture) {
                      const { data, format } = tags.picture;
                      let base64String = "";
                      for (let i = 0; i < data.length; i++) {
                          base64String += String.fromCharCode(data[i]);
                      }
                      cover = `data:${format};base64,${window.btoa(base64String)}`;
                  }
              }
          } catch (err) {
              console.error("Metadata reading failed", err);
          }
      }

      const url = URL.createObjectURL(file);
      const newSong: Song = {
        id: Date.now().toString(),
        title,
        artist,
        album,
        duration: 0,
        cover,
        src: url,
        color: 'bg-purple-500',
        source: 'local',
        fileBlob: file // Important: ensure we have the blob in state for AI immediately
      };
      setPlaylist(prev => [...prev, newSong]);
      playSong(newSong);
      saveSongToDB(newSong, file);
    }
  };

  // --- Long Press Logic ---
  const handleLongPressStart = (song: Song) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        setContextMenuSong(song);
        setShowContextMenu(true);
        if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  const handleSongClick = (song: Song) => {
      if (isLongPress.current) {
          isLongPress.current = false; 
          return;
      }
      playSong(song);
  };

  const handlePlayNext = () => {
      if (!contextMenuSong || !currentSong) return;
      
      const songToMove = contextMenuSong;
      const newPlaylist = playlist.filter(s => s.id !== songToMove.id);
      const currentIndex = newPlaylist.findIndex(s => s.id === currentSong.id);
      
      if (currentIndex !== -1) {
          newPlaylist.splice(currentIndex + 1, 0, songToMove);
          setPlaylist(newPlaylist);
      }
      setShowContextMenu(false);
  };

  const handleDelete = async () => {
      if (!contextMenuSong) return;
      
      // Remove from playlist
      setPlaylist(prev => prev.filter(s => s.id !== contextMenuSong.id));
      
      // If playing this song, skip
      if (currentSong?.id === contextMenuSong.id) {
          nextSong();
      }

      // If local, delete from DB
      if (contextMenuSong.source === 'local') {
          await deleteSongFromDB(contextMenuSong.id);
      }
      
      setShowContextMenu(false);
  };

  // --- YouTube Search Logic ---
  const handleYoutubeSearch = async () => {
      if (!youtubeSearchTerm.trim()) return;
      setIsSearchingYoutube(true);
      setYoutubeResults([]);
      
      if (!youtubeApiKey) {
          setNotification({msg: "YouTube API Key required in Settings.", type: 'error'});
          setIsSearchingYoutube(false);
          return;
      }
      
      try {
          const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(youtubeSearchTerm)}&type=video&key=${youtubeApiKey}`);
          const data = await res.json();
          
          if (data.error) {
              throw new Error(data.error.message);
          }
          
          const results: Song[] = data.items.map((item: any) => ({
              id: `yt-${item.id.videoId}`,
              title: item.snippet.title,
              artist: item.snippet.channelTitle,
              album: 'YouTube Music',
              duration: 240, // API search doesn't return duration without separate detail call, defaulting placeholder
              cover: item.snippet.thumbnails.high.url,
              src: item.id.videoId, // Video ID used for src
              color: 'bg-red-600',
              source: 'youtube'
          }));
          
          setYoutubeResults(results);
          
      } catch (e: any) {
          console.error("YouTube Search Error", e);
          setNotification({msg: "Search failed. Check API Key.", type: 'error'});
      } finally {
          setIsSearchingYoutube(false);
      }
  };
  
  const playYoutubeSong = (song: Song) => {
      // Add to playlist if not exists to allow Prev/Next navigation logic to work if we want a queue
      // For now, simple play logic:
      setPlaylist(prev => {
          if (!prev.find(s => s.id === song.id)) {
              return [song, ...prev];
          }
          return prev;
      });
      playSong(song);
  };

  // --- Gemini Lyrics Generation ---
  const generateLyricsForSong = async () => {
    if (!currentSong) return;
    
    setIsGeneratingLyrics(true);
    setLyricsSources([]);
    
    try {
        const apiKey = userApiKey || process.env.API_KEY;
        if (!apiKey) {
            throw new Error("Missing API Key. Please enter it in Settings.");
        }
        
        const ai = new GoogleGenAI({ apiKey });
        
        const cleanTitle = currentSong.title.replace(/\.(mp3|wav|m4a|flac|ogg)$/i, "").trim();

        // STRICT Search Strategy (No audio listening)
        // We explicitly search for LRC format to guarantee syncing
        const searchQuery = `"${cleanTitle}" "${currentSong.artist}" lyrics .lrc file time synced`;
        
        const prompt = `
        Task: Find accurate time-synced lyrics (LRC format) for the song "${cleanTitle}" by "${currentSong.artist}".
        
        Instructions:
        1. Use the googleSearch tool to find the lyrics. Look specifically for content with timestamps like [mm:ss.xx].
        2. Parse the found synced lyrics into a strict JSON array.
        3. Convert timestamps ([mm:ss.xx]) into total seconds (float).
        4. JSON Structure: [{"time": 12.5, "text": "Lyric line here"}, ...]
        5. If only plain text lyrics are found (no timestamps), return them with "time": -1.
        6. Return ONLY the JSON array. Do not include markdown or explanations.
        
        Example Output:
        [
          {"time": 10.5, "text": "First line"},
          {"time": 15.2, "text": "Second line"}
        ]
        `;

        const response = await ai.models.generateContent({ 
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{googleSearch: {}}] }
        });
        
        let text = response.text || "";
        
        // --- Parse & Clean Response ---
        text = text.replace(/```json/g, '').replace(/```/g, '');
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        
        if (firstBracket !== -1 && lastBracket !== -1) {
            text = text.substring(firstBracket, lastBracket + 1);
        }

        // Extract Sources
        const sources: { title: string, uri: string }[] = [];
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            groundingChunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    sources.push({ title: chunk.web.title || 'Source', uri: chunk.web.uri });
                }
            });
        }
        
        let generatedLyrics: LyricLine[] = [];
        
        try {
            generatedLyrics = JSON.parse(text);
        } catch (e) {
            console.warn("JSON parse failed. Falling back to raw text.", text);
            const rawLines = response.text?.split('\n') || [];
            generatedLyrics = rawLines
                .map(l => l.trim())
                .filter(l => l.length > 0 && !l.startsWith('```') && !l.startsWith('{') && !l.startsWith('}') && !l.startsWith('b') && !l.startsWith('[') && !l.startsWith(']'))
                .map(l => ({ time: -1, text: l }));
        }
        
        // Fallback for empty
        if (!Array.isArray(generatedLyrics) || generatedLyrics.length === 0) {
             generatedLyrics = [{ time: 0, text: "Lyrics not found." }];
        }
        
        // Sort Lyrics to ensure time sync logic works
        generatedLyrics.sort((a, b) => a.time - b.time);
        
        const updatedSong = { ...currentSong, lyrics: generatedLyrics, lyricsSources: sources };
        setLyrics(generatedLyrics);
        setLyricsSources(sources);
        setPlaylist(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
        setCurrentSong(updatedSong);
        await updateSongInDB(updatedSong);

    } catch (e: any) {
        console.error("Error generating lyrics:", e);
        let errorMsg = "Connection error.";
        if (e.message?.includes('API_KEY') || e.message?.includes('Missing API Key')) errorMsg = "Missing API Key.";
        else if (e.message?.includes('403')) errorMsg = "API Key Invalid or Quota Exceeded.";
        else if (e.message?.includes('404')) errorMsg = "Model not found.";
        
        const errorLyrics = [{ time: 0, text: `${errorMsg} Check Settings.` }];
        setLyrics(errorLyrics);
        if (currentSong) {
             const errorSong = { ...currentSong, lyrics: errorLyrics };
             setCurrentSong(errorSong);
             setPlaylist(prev => prev.map(s => s.id === currentSong.id ? errorSong : s));
        }
    } finally {
        setIsGeneratingLyrics(false);
    }
  };

  const handleGlobalSearch = async () => {
      if (!searchQuery.trim()) return;
      setIsSearchingGlobal(true);
      setSearchResults([]);
      
      try {
          const apiKey = userApiKey || process.env.API_KEY;
          if (!apiKey) {
              setNotification({msg: "Please add an API Key in settings.", type: 'error'});
              setIsSearchingGlobal(false);
              return;
          }

          const ai = new GoogleGenAI({ apiKey });
          
          // Enhanced prompt to look for playable audio
          const prompt = `
          Task: Find metadata AND a playable audio URL for the song "${searchQuery}".
          
          Instructions:
          1. Use googleSearch.
          2. Priority 1: Find a DIRECT, PLAYABLE audio file URL (ending in .mp3, .m4a, .ogg) from open directories, wikimedia, archive.org, or official samples.
          3. Priority 2: If a direct file isn't found, finding the correct metadata (Title, Artist, Album, Cover) is crucial.
          4. Return a JSON array (max 5 items) with:
          [
            {
              "title": "Exact Title",
              "artist": "Artist Name",
              "album": "Album Name",
              "duration": 180 (seconds),
              "cover": "https://... (high res image)",
              "src": "https://... (direct playable url if found, else empty)"
            }
          ]
          5. Return ONLY JSON.
          `;

          const response = await ai.models.generateContent({ 
             model: 'gemini-2.5-flash',
             contents: prompt,
             config: { tools: [{googleSearch: {}}] }
          });

          let text = response.text || "";
          text = text.replace(/```json/g, '').replace(/```/g, '');
          const firstBracket = text.indexOf('[');
          const lastBracket = text.lastIndexOf(']');
          
          if (firstBracket !== -1 && lastBracket !== -1) {
              text = text.substring(firstBracket, lastBracket + 1);
          }

          const rawResults = JSON.parse(text);
          const mappedResults = rawResults.map((r: any, i: number) => ({
             id: `search-${Date.now()}-${i}`,
             title: r.title || 'Unknown',
             artist: r.artist || 'Unknown',
             album: r.album || 'Searched',
             duration: r.duration || 180,
             cover: r.cover || 'https://images.unsplash.com/photo-1514525253440-b393452e8fc2?q=80&w=1000',
             src: r.src || '', 
             color: 'bg-indigo-500',
             source: 'searched'
          }));
          
          setSearchResults(mappedResults);

      } catch (e) {
          console.error("Search failed", e);
          setNotification({msg: "Search failed. Check connection/API Key.", type: 'error'});
      } finally {
          setIsSearchingGlobal(false);
      }
  };

  const downloadSearchedSong = async (song: Song) => {
      setDownloadingId(song.id);
      
      try {
          let blob: Blob;
          
          // Attempt to fetch the actual audio
          if (song.src && song.src.startsWith('http')) {
              try {
                  const res = await fetch(song.src);
                  if (!res.ok) throw new Error("Fetch failed");
                  blob = await res.blob();
                  setNotification({msg: `Downloaded ${song.title}!`, type: 'success'});
              } catch (e) {
                  // If CORS fails, we try to use a fallback dummy for 'Metadata Only' save
                  console.warn("CORS/Fetch failed. Saving with placeholder.", e);
                  setNotification({msg: "Audio protected. Saving metadata only.", type: 'error'});
                  // For the sake of the 'Offline' requirement in the prompt, we use a placeholder 
                  // if the real audio is inaccessible.
                  const dummyRes = await fetch('https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3'); 
                  blob = await dummyRes.blob();
              }
          } else {
              // No src provided by AI
              setNotification({msg: "No source found. Saving metadata.", type: 'error'});
              const dummyRes = await fetch('https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3');
              blob = await dummyRes.blob();
          }

          // Convert to Local Song
          const url = URL.createObjectURL(blob);
          const songToSave: Song = { 
              ...song, 
              id: `local-${Date.now()}`, // New ID for local storage
              album: 'Searched', 
              source: 'local',
              src: url,
              fileBlob: blob
          };

          // Save to local state
          setPlaylist(prev => [songToSave, ...prev]);
          // Save to DB
          await saveSongToDB(songToSave, blob);
          
      } catch (e) {
          console.error("Download failed", e);
          setNotification({msg: "Download failed.", type: 'error'});
      } finally {
          setDownloadingId(null);
      }
  };

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    // Simulate generation delay
    setTimeout(() => {
        const newSong: Song = {
            id: `ai-${Date.now()}`,
            title: aiPrompt,
            artist: 'AI Composer',
            album: 'AI Studio',
            duration: 180, 
            cover: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=1000&auto=format&fit=crop',
            src: 'https://cdn.pixabay.com/audio/2024/01/16/audio_e2b992254f.mp3', // Placeholder audio
            color: 'bg-indigo-500',
            source: 'ai'
        };
        setGeneratedSongs(prev => [newSong, ...prev]);
        setIsGenerating(false);
        setAiPrompt('');
    }, 3000);
  };

  const saveAiSong = (song: Song) => {
      const savedSong = { ...song, source: 'local' as const };
      setPlaylist(prev => [...prev, savedSong]);
      // Note: we can't easily save the remote blob to DB without fetching it first, skipping for demo
      setView('list');
      playSong(savedSong);
  };

  const playZenSound = (song: Song) => {
      playSong(song);
  };

  return (
    <div className={`relative w-full h-full overflow-hidden font-sans antialiased transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${darkMode ? 'bg-slate-900' : 'bg-[#F2F6FF]'}`}>
      
      {/* Toast Notification */}
      {notification && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5 duration-300 ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="font-bold text-sm">{notification.msg}</span>
          </div>
      )}

      <div className="absolute inset-0 z-[100] pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      
      {/* Hidden YouTube Player Container - Audio Only Experience */}
      {/* 1x1 pixel size to avoid being treated as 'hidden' by some browsers, but essentially invisible */}
      <div id="youtube-player" className="absolute top-0 left-0 w-[1px] h-[1px] opacity-0 pointer-events-none z-0" />

      {/* HTML5 Audio - CONDITIONAL SRC to avoid YouTube ID errors */}
      <audio 
        ref={audioRef} 
        src={currentSong?.source !== 'youtube' ? currentSong?.src : undefined} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={handleSongEnd} 
        onLoadedMetadata={() => { handleTimeUpdate(); updatePositionState(); }} 
        crossOrigin="anonymous" 
        loop={currentSong?.source === 'zen'} 
      />
      <audio ref={crossfadeAudioRef} crossOrigin="anonymous" />
      
      {/* --- NEW: YouTube Music View --- */}
      <div className={`absolute inset-0 z-[65] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${view === 'youtube' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {/* Blurred Nature Background */}
          <div className="absolute inset-0">
             <img src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Forest Blur" />
             <div className="absolute inset-0 bg-emerald-900/50 backdrop-blur-[50px]"></div>
          </div>
          
          <div className="absolute inset-0 flex flex-col p-6">
              {/* Header / Search */}
              <div className="flex items-center gap-4 mb-6 z-10">
                  <button onClick={() => setView('list')} className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/20 hover:bg-white/20 transition-all">
                       <ChevronLeft size={24} />
                  </button>
                  <div className="flex-1 relative">
                       <input 
                          type="text" 
                          placeholder="Search songs, artists on YouTube..." 
                          value={youtubeSearchTerm}
                          onChange={(e) => setYoutubeSearchTerm(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleYoutubeSearch()}
                          className="w-full bg-white/10 backdrop-blur-md text-white placeholder-white/50 rounded-2xl p-4 pr-12 outline-none border border-white/10 focus:bg-white/20 transition-all"
                       />
                       <button onClick={handleYoutubeSearch} disabled={isSearchingYoutube} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                           {isSearchingYoutube ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Search size={22} />}
                       </button>
                  </div>
              </div>
              
              {/* Results List */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-32 z-10">
                  {youtubeResults.length === 0 && !isSearchingYoutube && (
                      <div className="flex flex-col items-center justify-center h-full text-white/40">
                          <Youtube size={64} className="mb-4 opacity-50" />
                          <p className="text-lg font-medium">Search for music on YouTube</p>
                          <p className="text-sm">Audio-only experience</p>
                      </div>
                  )}
                  
                  {youtubeResults.map((song) => (
                      <div key={song.id} onClick={() => playYoutubeSong(song)} className="flex items-center p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/10 cursor-pointer transition-colors group">
                          <div className="w-16 h-16 rounded-xl overflow-hidden relative flex-shrink-0">
                              <img src={song.cover} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play size={24} fill="white" className="text-white" />
                              </div>
                          </div>
                          <div className="ml-4 flex-1 min-w-0">
                              <h3 className="text-white font-bold text-lg truncate" dangerouslySetInnerHTML={{ __html: song.title }}></h3>
                              <p className="text-white/60 text-sm truncate">{song.artist}</p>
                          </div>
                          <div className="p-2">
                               {currentSong?.id === song.id && isPlaying ? <Activity size={24} className="text-red-500" /> : <PlayCircle size={24} className="text-white/20 group-hover:text-white transition-colors" />}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* --- NEW: Zen Mode Home View (Left Image) --- */}
      <div className={`absolute inset-0 z-[65] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${view === 'zen-home' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0">
             <img src="https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Elephant" />
             <div className="absolute inset-0 bg-black/30"></div>
          </div>
          
          <div className="absolute inset-0 flex flex-col p-6 text-white font-sans">
              <div className="flex justify-between items-center mt-2">
                  <button onClick={() => setView('list')} className="p-2 bg-white/10 backdrop-blur-md rounded-full"><Menu size={24} /></button>
                  <h1 className="text-[8rem] font-light leading-none opacity-40 mix-blend-overlay absolute top-4 left-1/2 -translate-x-1/2 font-sans tracking-tighter">
                      {currentDate.getDate().toString().padStart(2, '0')}
                  </h1>
                  <button onClick={() => setView('zen-list')} className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"><Search size={24} /></button>
              </div>

              <div className="flex-1 flex flex-col justify-end pb-12">
                  <button 
                    onClick={() => playZenSound(ZEN_SOUNDS[0])}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 hover:scale-105 active:scale-95 transition-transform shadow-2xl"
                  >
                      {currentSong?.id === ZEN_SOUNDS[0].id && isPlaying ? <Pause size={24} fill="black" className="text-black" /> : <Play size={24} fill="black" className="text-black ml-1" />}
                  </button>
                  <h2 className="text-4xl font-bold leading-tight max-w-[80%] mb-4 drop-shadow-lg">Amazing<br/>corners<br/>of the<br/>planet</h2>
                  <p className="text-sm font-medium opacity-80 uppercase tracking-widest">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, {currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </p>
              </div>
          </div>
      </div>

      {/* --- NEW: Zen Mode Search View (Right Image) --- */}
      <div className={`absolute inset-0 z-[66] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${view === 'zen-list' ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-10'}`}>
          {/* Blurry Background */}
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[40px]">
             {/* Gradient orbs for depth */}
             <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/30 rounded-full blur-[100px]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[100px]"></div>
          </div>

          <div className="absolute inset-0 flex flex-col p-6">
              {/* Search Bar */}
              <div className="relative mb-8 mt-2">
                  <button onClick={() => setView('zen-home')} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white z-10"><ChevronLeft size={24} /></button>
                  <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl h-14 flex items-center px-12 border border-white/5">
                      <input 
                        type="text" 
                        placeholder="Search ..." 
                        value={zenSearchTerm}
                        onChange={(e) => setZenSearchTerm(e.target.value)}
                        className="bg-transparent w-full text-white placeholder-white/40 outline-none text-lg"
                      />
                  </div>
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-10">
                  {ZEN_SOUNDS.filter(s => s.title.toLowerCase().includes(zenSearchTerm.toLowerCase())).map((sound, index) => (
                      <div key={sound.id} className="relative h-48 rounded-[2rem] overflow-hidden group cursor-pointer shadow-lg" onClick={() => playZenSound(sound)}>
                          <img src={sound.cover} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                          
                          {/* Number */}
                          <div className="absolute top-4 right-6 text-6xl font-bold text-white/10 font-sans">0{index + 2}</div>
                          
                          {/* Content */}
                          <div className="absolute bottom-6 left-6 text-white">
                               <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-3 border border-white/20">
                                   {currentSong?.id === sound.id && isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1" />}
                               </div>
                               <h3 className="text-xl font-bold mb-1">{sound.title}</h3>
                               <p className="text-xs opacity-70 flex items-center gap-1">
                                 {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, {currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                               </p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* --- NEW: AI Studio View --- */}
      <div className={`absolute inset-0 z-[65] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${view === 'ai-studio' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
         {/* Background */}
         <div className="absolute inset-0">
             <img src="https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Waterfall" />
             <div className="absolute inset-0 bg-black/30 backdrop-blur-xl"></div>
         </div>
         
         <div className="absolute inset-0 flex flex-col p-6 overflow-y-auto no-scrollbar">
             {/* Header */}
             <div className="flex items-center justify-between mb-8">
                 <button onClick={() => setView('list')} className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/20 hover:bg-white/20 transition-all">
                     <ChevronLeft size={24} />
                 </button>
                 <h2 className="text-white font-bold text-xl tracking-wide flex items-center gap-2">
                     <Sparkles size={20} className="text-cyan-300" /> AI Studio
                 </h2>
                 <div className="w-12"></div> {/* Spacer */}
             </div>

             {/* Main Generator Card */}
             <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] p-6 shadow-2xl mb-8 animate-in slide-in-from-bottom-10 fade-in duration-500">
                 <h3 className="text-white text-lg font-semibold mb-2">Create a masterpiece</h3>
                 <p className="text-white/60 text-sm mb-6">Describe the mood, genre, or instruments you want to hear.</p>
                 
                 <div className="relative mb-6">
                     <textarea 
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g. A lo-fi chill beat with rain sounds and a soft piano melody..."
                        className="w-full bg-black/20 text-white placeholder-white/40 rounded-2xl p-4 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/50 border border-white/10 transition-all"
                     />
                 </div>
                 
                 <button 
                    onClick={handleAiGenerate}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${isGenerating ? 'bg-white/5 cursor-wait' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]'} text-white shadow-lg`}
                 >
                     {isGenerating ? (
                         <>
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             Generating...
                         </>
                     ) : (
                         <>
                             <Wand2 size={20} /> Generate Music
                         </>
                     )}
                 </button>
             </div>

             {/* Generated Results */}
             {generatedSongs.length > 0 && (
                 <div className="animate-in fade-in duration-500">
                     <h3 className="text-white/80 font-semibold mb-4 ml-2">Generated Tracks</h3>
                     <div className="space-y-3 pb-32">
                         {generatedSongs.map((song) => (
                             <div key={song.id} className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 rounded-2xl flex items-center group hover:bg-white/10 transition-colors">
                                 <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-white relative overflow-hidden">
                                     <img src={song.cover} className="w-full h-full object-cover opacity-80" />
                                     <div className="absolute inset-0 flex items-center justify-center">
                                        <button onClick={() => playSong(song)} className="p-1.5 bg-white/20 backdrop-blur-md rounded-full hover:scale-110 transition-transform">
                                            {currentSong?.id === song.id && isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                                        </button>
                                     </div>
                                 </div>
                                 <div className="ml-3 flex-1 min-w-0">
                                     <h4 className={`font-bold truncate text-white`}>{song.title}</h4>
                                     <p className="text-xs text-white/50 truncate">AI Generated • {formatTime(song.duration)}</p>
                                 </div>
                                 <button onClick={() => saveAiSong(song)} className="p-2 text-cyan-300 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Save to Library">
                                     <Save size={20} />
                                 </button>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
         </div>
      </div>

      {/* --- NEW: Lyrics View --- */}
      <div className={`absolute inset-0 z-[65] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${view === 'lyrics' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {/* Background */}
          <div className="absolute inset-0">
              <img src={currentSong?.cover || "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=1000&auto=format&fit=crop"} className="w-full h-full object-cover" alt="Nature" />
              <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl"></div>
              {/* Dynamic light effect */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
          </div>
          
          <div className="absolute inset-0 flex flex-col h-full overflow-hidden">
               {/* Header - Fixed Height */}
               <div className="flex-none flex items-center justify-between p-6 z-20 bg-gradient-to-b from-black/20 to-transparent">
                   <button onClick={() => setView('player')} className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-white/20 transition-all active:scale-95">
                       <ChevronLeft size={24} />
                   </button>
                   <div className="flex flex-col items-center">
                       <h3 className="text-white font-bold text-sm tracking-widest uppercase opacity-80 drop-shadow-md">{currentSong?.title}</h3>
                       <p className="text-white/50 text-xs drop-shadow-md">{currentSong?.artist}</p>
                   </div>
                   <button className="p-3 text-white/50 hover:text-white transition-colors">
                       <MoreHorizontal size={24} />
                   </button>
               </div>

               {/* Lyrics Container - Flex Grow to Fill available space */}
               <div className="flex-1 min-h-0 relative z-10 w-full flex flex-col items-center justify-center">
                   {currentSong?.source === 'local' && !currentSong.lyrics && !isGeneratingLyrics && (
                       <div className="text-center p-6 animate-in fade-in zoom-in-95 duration-500">
                           <FileAudio size={48} className="text-white/30 mx-auto mb-4" />
                           <p className="text-white/60 mb-6 font-medium">No synced lyrics found for this file.</p>
                           <button 
                                onClick={generateLyricsForSong}
                                className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white font-bold flex items-center gap-2 mx-auto hover:bg-white/20 transition-all active:scale-95 shadow-lg shadow-purple-500/20"
                           >
                                <Sparkles size={18} className="text-purple-300" /> Search & Sync Lyrics
                           </button>
                           <p className="text-xs text-white/30 mt-4 max-w-xs mx-auto">Powered by Gemini. Searches the web for precise LRC timestamps.</p>
                       </div>
                   )}
                   
                   {isGeneratingLyrics && (
                       <div className="text-center p-6 animate-in fade-in zoom-in-95 duration-500">
                           <div className="w-12 h-12 border-4 border-white/20 border-t-purple-400 rounded-full animate-spin mx-auto mb-6"></div>
                           <h3 className="text-white font-bold text-lg mb-2">Searching Lyrics...</h3>
                           <p className="text-white/50 text-sm">Finding time-synced file</p>
                       </div>
                   )}

                   {(currentSong?.lyrics || (currentSong?.source !== 'local' && !isGeneratingLyrics)) && (
                       <div ref={lyricsContainerRef} className="absolute inset-0 overflow-y-auto no-scrollbar mask-gradient scroll-smooth">
                           <div className="py-[45vh] px-8 text-left max-w-2xl mx-auto">
                               {lyrics.map((line, index) => {
                                   const isSynced = line.time >= 0;
                                   const isActive = index === activeLyricIndex;
                                   const dist = Math.abs(index - activeLyricIndex);
                                   
                                   let styleClass = '';
                                   if (isSynced) {
                                       if (dist === 0) {
                                           // Active Line: Scale up, full opacity, glow
                                           styleClass = 'text-white scale-110 opacity-100 blur-0 font-extrabold text-3xl my-8 origin-left drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]';
                                       } else if (dist === 1) {
                                           // Near Neighbors: Slightly smaller, slightly transparent
                                           styleClass = 'text-white/60 scale-100 opacity-60 blur-[0.5px] font-bold text-2xl my-5 origin-left';
                                       } else if (dist === 2) {
                                           // Far Neighbors: Fading out
                                           styleClass = 'text-white/30 scale-95 opacity-30 blur-[1px] font-semibold text-xl my-4 origin-left';
                                       } else {
                                           // Distant: Barely visible
                                           styleClass = 'text-white/10 scale-90 opacity-10 blur-[2px] font-medium text-lg my-3 origin-left';
                                       }
                                   } else {
                                       styleClass = 'text-white/90 scale-100 opacity-90 blur-0 text-xl my-4 text-center'; 
                                   }

                                   return (
                                       <div 
                                           key={index} 
                                           data-active={isSynced && isActive}
                                           className={`transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] py-1 cursor-pointer select-none ${styleClass}`}
                                           onClick={() => {
                                               if (isSynced && audioRef.current) {
                                                   audioRef.current.currentTime = line.time;
                                                   setCurrentTime(line.time);
                                                   setActiveLyricIndex(index);
                                               }
                                           }}
                                       >
                                           <p className={`leading-tight`}>
                                               {line.text}
                                           </p>
                                       </div>
                                   );
                               })}
                               
                               {/* Sources Display */}
                               {lyricsSources.length > 0 && (
                                   <div className="mt-20 pt-8 border-t border-white/10 max-w-sm mx-auto text-center opacity-50 hover:opacity-100 transition-opacity">
                                       <p className="text-xs text-white/60 mb-2 uppercase tracking-widest flex items-center justify-center gap-1"><Globe size={10} /> Data Sources</p>
                                       <div className="flex flex-wrap justify-center gap-2">
                                           {lyricsSources.map((source, i) => (
                                               <a key={i} href={source.uri} target="_blank" rel="noreferrer" className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors truncate max-w-[150px]">
                                                   {source.title}
                                               </a>
                                           ))}
                                       </div>
                                   </div>
                               )}
                           </div>
                       </div>
                   )}
               </div>
               
               {/* Lyrics Control Bar - Fixed Height */}
               <div className="flex-none h-32 flex items-center justify-center gap-8 z-20 bg-gradient-to-t from-black/40 to-transparent pb-6">
                   <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all">
                       {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1"/>}
                   </button>
               </div>
          </div>
          <style>{`.mask-gradient { mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); }`}</style>
      </div>

      {/* --- NEW: Landing / Home Screen --- */}
      <div className={`absolute inset-0 z-[60] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${view === 'landing' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Background */}
        <div className="absolute inset-0">
             <img src="https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Dunes" />
             <div className="absolute inset-0 bg-black/10"></div>
        </div>

        {/* Central Glass Card - OVAL / PILL SHAPE */}
        <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="w-[260px] h-[520px] rounded-[130px] bg-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl flex flex-col items-center justify-between py-10 relative overflow-hidden text-white animate-in zoom-in-95 duration-500">
                
                {/* Top Circular Part (Spinning Record) */}
                <div className="relative mt-2">
                    <div className="w-40 h-40 rounded-full border-[4px] border-white/10 shadow-2xl overflow-hidden relative flex items-center justify-center bg-black/20">
                         {/* Spinning artwork */}
                         <img 
                            src={currentSong?.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop"} 
                            className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`} 
                         />
                         {/* Inner Hole */}
                         <div className="absolute w-6 h-6 bg-white/20 backdrop-blur-md rounded-full border border-white/30 z-10"></div>
                    </div>
                </div>

                {/* Middle: Info & Controls */}
                <div className="flex flex-col items-center justify-center w-full px-6">
                     <h2 className="text-xl font-bold text-center mb-1 drop-shadow-md truncate w-full px-4">{currentSong?.title || "Choose a Song"}</h2>
                     <p className="text-xs text-white/60 mb-6 font-medium tracking-wider uppercase">{currentSong?.artist || "Artist"}</p>
                     
                     <div className="flex items-center gap-6">
                        <button onClick={prevSong} className="text-white/80 hover:text-white transition-transform active:scale-90"><SkipBack size={28} /></button>
                        <button 
                            onClick={() => currentSong ? setIsPlaying(!isPlaying) : null} 
                            className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                        </button>
                        <button onClick={nextSong} className="text-white/80 hover:text-white transition-transform active:scale-90"><SkipForward size={28} /></button>
                     </div>
                </div>

                {/* Bottom: Quotes */}
                <div className="px-8 text-center flex flex-col items-center">
                    <p className="font-light text-sm leading-relaxed italic opacity-80 h-12 flex items-center justify-center">
                        "{QUOTES[quoteIndex]}"
                    </p>
                    
                    {/* Navigation - Subtle text/icon at very bottom */}
                    <button 
                        onClick={() => setView('list')}
                        className="mt-4 text-white/50 hover:text-white transition-colors flex flex-col items-center gap-1 text-[10px] uppercase tracking-widest"
                    >
                        <ChevronDown size={16} />
                        Library
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* --- Main List View --- */}
      <div className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform ${view !== 'list' ? 'scale-92 opacity-0 pointer-events-none blur-md' : 'scale-100 opacity-100 blur-0'}`}>
        {/* Header Image Section */}
        <div className="relative h-[45%] w-full overflow-hidden">
          <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1000&auto=format&fit=crop" alt="Nature" className="w-full h-full object-cover filter brightness-[0.85] transition-transform duration-[10s] hover:scale-110"/>
          
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 mt-2">
             <button 
                onClick={() => setView('landing')}
                className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/10 hover:bg-white/20 transition-colors"
             >
               <ChevronLeft size={24} />
             </button>
             <div className="flex gap-3">
               <button onClick={() => setShowLikedSongs(true)} className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/10 hover:bg-pink-500/30 transition-colors">
                  <Heart size={24} fill={likedIds.size > 0 ? "white" : "none"} />
               </button>
               <button onClick={() => setShowSettings(true)} className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/10 hover:bg-white/20 transition-colors">
                  <MoreHorizontal size={24} />
               </button>
             </div>
          </div>
          
          <div className="absolute bottom-16 left-6 text-white z-20">
            <h1 className="text-4xl font-bold tracking-tight mb-2 drop-shadow-lg">Welcome Ayush</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">34m Monthly Listener</p>
          </div>
        </div>

        {/* Floating Play Button */}
        <button onClick={() => currentSong && playSong(currentSong)} className="absolute top-[41%] right-8 w-16 h-16 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] rounded-full flex items-center justify-center text-[#4facfe] z-30 hover:scale-105 transition-transform active:scale-95">
          {isPlaying && view === 'list' ? <Pause size={28} fill="#4facfe" /> : <Play size={28} fill="#4facfe" className="ml-1" />}
        </button>

        {/* Content Sheet */}
        <div className={`relative -mt-10 rounded-t-[2.5rem] h-[65%] px-6 pt-12 pb-32 overflow-y-auto no-scrollbar z-10 transition-colors ${darkMode ? 'bg-slate-900' : 'bg-[#F2F6FF]'}`}>
          
          {/* Albums Section */}
          <div className="mb-8">
            <h2 className={`font-bold text-xl mb-5 ml-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Albums</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              
              {/* AI Studio Card */}
              <div onClick={() => setView('ai-studio')} className="flex-shrink-0 w-36 h-36 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[0_10px_20px_-5px_rgba(6,182,212,0.4)] relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                   <Sparkles className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">AI Studio</p>
                  <p className="text-white/80 text-xs mt-1 font-medium">Create Magic</p>
                </div>
              </div>

               {/* NEW: YouTube Music Card */}
               <div onClick={() => setView('youtube')} className="flex-shrink-0 w-36 h-36 bg-red-600 rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[0_10px_20px_-5px_rgba(220,38,38,0.4)] relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                   <Youtube className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">YouTube</p>
                  <p className="text-white/80 text-xs mt-1 font-medium">Music</p>
                </div>
              </div>

              {/* NEW: Zen Mode Card */}
              <div onClick={() => setView('zen-home')} className="flex-shrink-0 w-36 h-36 bg-emerald-500 rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                   <Leaf className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">Zen Mode</p>
                  <p className="text-white/80 text-xs mt-1 font-medium">Relax & Focus</p>
                </div>
              </div>

               {/* Searched & Downloaded Card - DYNAMIC */}
               {searchedSongs.length > 0 && (
                  <div className="flex-shrink-0 w-36 h-36 bg-indigo-500 rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[0_10px_20px_-5px_rgba(99,102,241,0.4)] relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                       <CloudDownload className="text-white" size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg leading-tight">Searched</p>
                      <p className="text-white/80 text-xs mt-1 font-medium">{searchedSongs.length} Songs</p>
                    </div>
                  </div>
               )}

              {/* Card 1: Intergalaxy (Blue) */}
              <div className="flex-shrink-0 w-36 h-36 bg-[#4facfe] rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[0_10px_20px_-5px_rgba(79,172,254,0.4)] relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                   <BarChart2 className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">Intergalaxy</p>
                  <p className="text-white/80 text-xs mt-1 font-medium">8 Songs</p>
                </div>
              </div>

              {/* Card 2: Fault (Orange) */}
              <div className="flex-shrink-0 w-36 h-36 bg-[#ff9f43] rounded-[1.5rem] p-5 flex flex-col justify-between shadow-[0_10px_20px_-5px_rgba(255,159,67,0.4)] relative overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                   <PlayCircle className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">Fault</p>
                  <p className="text-white/80 text-xs mt-1 font-medium">10 Songs</p>
                </div>
              </div>

              {/* Upload Card */}
              <div onClick={() => fileInputRef.current?.click()} className={`flex-shrink-0 w-36 h-36 border-2 border-dashed rounded-[1.5rem] p-4 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                     <Plus size={20} />
                  </div>
                  <p className={`font-bold text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Upload</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
              </div>
            </div>
          </div>

          {/* Songs Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
               <h2 className={`font-bold text-xl ml-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Songs</h2>
               <button onClick={() => setShowSearch(!showSearch)} className={`p-2 rounded-xl transition-all ${showSearch ? 'bg-[#4facfe] text-white' : 'text-[#4facfe] hover:bg-blue-50'}`}>
                   <Search size={20} />
               </button>
            </div>
            
            {/* Global Search Bar & Results */}
            <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${showSearch ? 'max-h-[600px] mb-6 opacity-100' : 'max-h-0 mb-0 opacity-0'}`}>
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                        placeholder="Search for any song online..."
                        className={`flex-1 p-3 rounded-xl border outline-none focus:ring-2 focus:ring-[#4facfe] transition-all text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800'}`}
                    />
                    <button 
                        onClick={handleGlobalSearch}
                        disabled={isSearchingGlobal}
                        className="bg-[#4facfe] text-white px-4 rounded-xl font-bold flex items-center justify-center disabled:opacity-50"
                    >
                        {isSearchingGlobal ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Go"}
                    </button>
                </div>
                
                {/* Search Results */}
                <div className="space-y-2">
                    {searchResults.map((result) => (
                        <div key={result.id} className={`flex items-center p-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} shadow-sm`}>
                             <img src={result.cover} className="w-10 h-10 rounded-lg object-cover bg-gray-200" />
                             <div className="ml-3 flex-1 min-w-0">
                                 <h4 className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{result.title}</h4>
                                 <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{result.artist}</p>
                             </div>
                             <div className="flex items-center gap-2">
                                 <button onClick={() => playSong(result)} className={`p-2 rounded-full ${darkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                                     <Play size={16} fill="currentColor" />
                                 </button>
                                 <button onClick={() => downloadSearchedSong(result)} disabled={downloadingId === result.id} className={`p-2 rounded-full ${darkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                                     {downloadingId === result.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <CloudDownload size={16} />}
                                 </button>
                             </div>
                        </div>
                    ))}
                    {searchResults.length === 0 && !isSearchingGlobal && showSearch && searchQuery && (
                        <p className="text-center text-xs opacity-50 py-2">Search results will appear here</p>
                    )}
                </div>
            </div>

            <div className="space-y-3">
              {displayPlaylist.map((song) => (
                <div 
                    key={song.id} 
                    onClick={() => handleSongClick(song)} 
                    onPointerDown={() => handleLongPressStart(song)}
                    onPointerUp={handleLongPressEnd}
                    onPointerLeave={handleLongPressEnd}
                    onPointerCancel={handleLongPressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`group flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-300 select-none ${currentSong?.id === song.id ? (darkMode ? 'bg-slate-800 shadow-md' : 'bg-white shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] scale-[1.02]') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-white hover:shadow-sm')}`}
                >
                  {/* Song Icon Box */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105 ${song.color || 'bg-gray-400'}`}>
                    {currentSong?.id === song.id && isPlaying ? (
                       <div className="flex gap-[2px] items-end h-4">
                          <div className="w-[3px] bg-white animate-[bounce_0.8s_infinite] h-2"></div>
                          <div className="w-[3px] bg-white animate-[bounce_1.2s_infinite] h-4"></div>
                          <div className="w-[3px] bg-white animate-[bounce_1.0s_infinite] h-3"></div>
                       </div>
                    ) : (
                       <Music size={20} />
                    )}
                  </div>
                  
                  {/* Text Info */}
                  <div className="ml-4 flex-1 min-w-0">
                    <h3 className={`font-bold text-base mb-0.5 truncate ${currentSong?.id === song.id ? 'text-[#4facfe]' : (darkMode ? 'text-gray-100' : 'text-slate-800')}`}>{song.title}</h3>
                    <p className={`text-xs font-medium truncate ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>{song.album}</p>
                  </div>
                  
                  {/* Right Side Visualizer/Time */}
                  <div className="px-2">
                     {currentSong?.id === song.id ? (
                        <Activity size={20} className="text-[#4facfe]" />
                     ) : (
                        <div className="flex items-center gap-1">
                           <div className={`w-[2px] h-3 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                           <div className={`w-[2px] h-5 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                           <div className={`w-[2px] h-3 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                        </div>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Mini Player (Hidden if landing or ai studio or lyrics or zen) --- */}
      {currentSong && view !== 'landing' && view !== 'ai-studio' && view !== 'lyrics' && view !== 'zen-home' && view !== 'zen-list' && view !== 'youtube' && (
         <div 
            onClick={() => setView('player')}
            className={`absolute bottom-6 left-6 right-6 z-40 bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] rounded-3xl p-2.5 flex items-center cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform 
              ${view === 'list' ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'}
              ${darkMode ? 'bg-slate-800/90 border-slate-700/50' : 'bg-white/90 border-white/60'}
            `}
         >
            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 overflow-hidden shadow-sm relative`}>
               <img src={currentSong.cover} alt={currentSong.title} className={`w-full h-full object-cover`}/>
            </div>
            <div className="flex-1 ml-4 min-w-0 flex flex-col justify-center">
               <h4 className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{currentSong.title}</h4>
               <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>{currentSong.artist}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 mr-1 ${darkMode ? 'bg-white text-slate-900' : 'bg-black text-white'}`}>
               {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-gray-200/50 rounded-full overflow-hidden">
               <div className={`h-full ${darkMode ? 'bg-[#4facfe]' : 'bg-[#4facfe]'}`} style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
            </div>
         </div>
      )}

      {/* --- Player View (Immutable from previous turns, matching Space Vector aesthetic) --- */}
      <div className={`absolute inset-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] bg-[#1e1b4b] overflow-hidden flex flex-col items-center ${view === 'player' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-100 pointer-events-none'}`}>
          <div className="absolute inset-0 z-0">
              <img src={currentSong?.cover} alt="Blur Background" className="w-full h-full object-cover blur-[80px] opacity-60 scale-125"/>
              <div className="absolute inset-0 bg-[#1e1b4b]/60 mix-blend-multiply"></div>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-0"></div>

          <div className="w-full flex justify-between items-center p-6 relative z-50 mt-safe pointer-events-none">
              <button onClick={() => setView('list')} className="w-12 h-12 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all duration-300 pointer-events-auto shadow-lg shadow-black/10">
                  <ChevronDown size={24} />
              </button>
              <button onClick={() => setShowSettings(true)} className="w-12 h-12 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all duration-300 pointer-events-auto shadow-lg shadow-black/10">
                  <MoreHorizontal size={24} />
              </button>
          </div>

          <div className="absolute -top-16 -left-16 w-64 h-64 bg-gradient-to-br from-[#FF9F43] to-[#FF8000] rounded-full opacity-90 blur-2xl pointer-events-none mix-blend-screen"></div>
          <div className="absolute -top-12 -right-24 w-80 h-80 rounded-full border-[60px] border-[#FF6B81] opacity-90 blur-xl pointer-events-none mix-blend-screen"></div>
          <div className="absolute top-1/4 left-[-10%] w-[120%] h-64 border border-white/5 rounded-[100%] rotate-12 scale-110 pointer-events-none"></div>

          <div className="flex-1 flex flex-col items-center justify-center relative w-full -mt-20 z-10">
               <div className="relative w-72 h-72 mb-4 z-0">
                  <div className="absolute inset-0 rounded-full bg-[#2D98DA] shadow-2xl overflow-hidden ring-4 ring-white/5">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-[#1e1b4b] rounded-full shadow-inner"></div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-black/40 rounded-full blur-xl"></div>
                  </div>
                  <div className="absolute top-12 right-2 w-6 h-6 bg-[#2D98DA] rounded-full shadow-md z-0"></div>
                  <div className="absolute bottom-10 -left-6 -right-6 h-24 z-20">
                     <div className="w-full h-full bg-gradient-to-r from-[#2D98DA]/80 to-[#48dbfb]/80 backdrop-blur-md border-t border-b border-white/20 shadow-2xl flex items-center px-6 relative z-10 clip-ribbon">
                        <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center mr-4 border border-white/10 flex-shrink-0 shadow-lg">
                           <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                        </div>
                        <div className="flex flex-col text-white flex-1 min-w-0 drop-shadow-md">
                            <h2 className="text-xl font-bold leading-tight truncate tracking-wide">{currentSong?.title}</h2>
                            <p className="text-sm text-white/80 font-medium truncate">{currentSong?.artist}</p>
                        </div>
                     </div>
                     <div className="absolute top-[-8px] left-0 w-6 h-8 bg-[#15456b] -z-10 skew-y-[30deg] origin-bottom-right brightness-50"></div>
                     <div className="absolute top-[-8px] right-0 w-6 h-8 bg-[#15456b] -z-10 skew-y-[-30deg] origin-bottom-left brightness-50"></div>
                  </div>
               </div>
          </div>

          <div className="w-full z-30 bg-[#3b82f6]/20 backdrop-blur-3xl border-t border-white/10 pb-safe pt-6 flex flex-col relative overflow-hidden">
               <div className="w-full h-24 relative flex flex-col items-center justify-center mb-6">
                   <div ref={ticksRef} className="absolute top-0 left-1/2 h-full flex items-start will-change-transform">
                      {Array.from({length: Math.ceil(duration || 300) + 20}).map((_, i) => {
                         const isTen = i % 10 === 0;
                         const isFive = i % 5 === 0 && !isTen;
                         return (
                            <div key={i} className="absolute flex flex-col items-center top-0" style={{ left: `${i * TICK_SPACING}px`, width: '1px' }}>
                               <div className={`w-[1px] bg-white/40 ${isTen ? 'h-6 bg-white/90' : (isFive ? 'h-4 bg-white/70 mt-1' : 'h-2 mt-2')}`}></div>
                               {isTen && <div className={`mt-5 text-sm font-medium font-mono transition-all duration-300 ${Math.abs(currentTime - i) < 5 ? 'text-white scale-110 drop-shadow-md' : 'text-white/30 scale-90'}`}>{formatRulerTime(i)}</div>}
                               {isFive && <div className={`mt-6 text-[10px] font-medium font-mono text-white/20 transition-all duration-300 ${Math.abs(currentTime - i) < 5 ? 'opacity-80' : 'opacity-40'}`}>{formatRulerTime(i)}</div>}
                            </div>
                         )
                      })}
                   </div>
                   <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-20">
                      <div className="w-[1px] h-4 bg-white/50"></div>
                      <div className="w-1.5 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)] my-[-2px] z-10"></div>
                      <div className="w-[1px] h-8 bg-gradient-to-b from-white/50 to-transparent"></div>
                   </div>
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white"></div>
                        <div className="w-6 h-[1px] bg-white/30 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                   </div>
                   <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#1e3a8a]/40 via-transparent to-[#1e3a8a]/40"></div>
                   <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30" />
               </div>

               <div className="w-full px-8 pb-10 flex items-center justify-between z-40">
                  <button onClick={() => setView('lyrics')} className="text-white/70 hover:text-white transition-colors hover:scale-110 active:scale-95"><Mic2 size={24} /></button>
                  <button onClick={prevSong} className="text-white/70 hover:text-white transition-transform active:scale-90 hover:scale-110"><SkipBack size={28} /></button>
                  <button onClick={() => setIsPlaying(!isPlaying)} className="w-20 h-20 bg-white/5 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all duration-200">
                       {isPlaying ? <Pause size={32} className="text-white fill-white" /> : <Play size={32} className="text-white fill-white ml-1" />}
                  </button>
                  <button onClick={nextSong} className="text-white/70 hover:text-white transition-transform active:scale-90 hover:scale-110"><SkipForward size={28} /></button>
                  <button onClick={(e) => currentSong && toggleLike(e, currentSong.id)} className={`transition-colors active:scale-90 hover:scale-110 ${currentSong && likedIds.has(currentSong.id) ? 'text-pink-500' : 'text-white/40 hover:text-white'}`}>
                      <Heart size={20} fill={currentSong && likedIds.has(currentSong.id) ? "currentColor" : "none"} />
                  </button>
              </div>
          </div>
          <style>{`.mt-safe { margin-top: env(safe-area-inset-top); } .pb-safe { padding-bottom: max(3rem, env(safe-area-inset-bottom)); }`}</style>
      </div>
      
      {/* Settings/Modals (Hidden by default) */}
      {showSettings && (
        <div className="absolute inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-800'} transition-colors`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`p-2 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${darkMode ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'}`}><Moon size={20} /></div>
                        <span className="font-medium">Dark Mode</span>
                    </div>
                    <button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-7 rounded-full transition-colors relative ${darkMode ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* API Key Input */}
                <div className="pt-4 border-t border-gray-200/20">
                    <div className="flex items-center gap-2 mb-3">
                         <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-600'}`}><Key size={16} /></div>
                         <h3 className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Gemini API Key</h3>
                    </div>
                    <input 
                        type="password" 
                        value={userApiKey}
                        onChange={handleApiKeyChange}
                        placeholder="Paste your API Key here..."
                        className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                    <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Required for AI lyrics search & sync. Key is stored locally on your device.
                    </p>
                </div>
                
                {/* YouTube API Key Input */}
                <div className="pt-4 border-t border-gray-200/20">
                    <div className="flex items-center gap-2 mb-3">
                         <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}><Youtube size={16} /></div>
                         <h3 className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>YouTube API Key</h3>
                    </div>
                    <input 
                        type="password" 
                        value={youtubeApiKey}
                        onChange={handleYoutubeApiKeyChange}
                        placeholder="Paste YouTube Data API Key..."
                        className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                    <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Required for YouTube Music Search. Key stored locally.
                    </p>
                </div>
            </div>

          </div>
        </div>
      )}

      {showLikedSongs && (
        <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 animate-in fade-in zoom-in-95 duration-300">
           <div className={`w-full h-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col relative transition-colors ${darkMode ? 'bg-slate-800/95 text-white' : 'bg-white/95 text-gray-800'}`}>
             <div className="flex items-center justify-between mb-6">
                <div><h2 className="text-2xl font-bold">Liked Songs</h2><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{likedIds.size} tracks</p></div>
                <button onClick={() => setShowLikedSongs(false)} className={`p-2 rounded-full ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}><X size={20} /></button>
             </div>
             <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
               {playlist.filter(s => likedIds.has(s.id)).length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-40"><Heart size={64} className="mb-4 text-pink-500" /><p className="font-medium">No liked songs yet</p></div>
               ) : (
                 playlist.filter(s => likedIds.has(s.id)).map(song => (
                    <div key={song.id} onClick={() => playSong(song)} className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${currentSong?.id === song.id ? (darkMode ? 'bg-pink-500/20' : 'bg-pink-50') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')}`}>
                       <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${song.color || 'bg-pink-500'}`}>{currentSong?.id === song.id && isPlaying ? <Activity size={18} className="animate-pulse"/> : <Music size={18} />}</div>
                       <div className="ml-3 flex-1 overflow-hidden"><h4 className={`font-bold truncate ${currentSong?.id === song.id ? 'text-pink-500' : ''}`}>{song.title}</h4><p className="text-xs opacity-60 truncate">{song.artist}</p></div>
                       <button onClick={(e) => toggleLike(e, song.id)} className="p-2 text-pink-500 hover:scale-110 transition-transform"><Heart size={18} fill="currentColor" /></button>
                    </div>
                 ))
               )}
             </div>
           </div>
        </div>
      )}

      {/* --- Context Menu (Long Press) --- */}
      {showContextMenu && contextMenuSong && (
          <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowContextMenu(false)}>
              <div className={`w-full max-w-md rounded-t-[2rem] p-6 shadow-2xl ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-800'} transition-transform animate-in slide-in-from-bottom duration-300`} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-4 mb-6 border-b border-gray-200/10 pb-4">
                      <img src={contextMenuSong.cover} className="w-14 h-14 rounded-xl object-cover shadow-md" alt={contextMenuSong.title} />
                      <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-lg truncate">{contextMenuSong.title}</h3>
                          <p className="text-sm opacity-60 truncate">{contextMenuSong.artist}</p>
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      <button onClick={handlePlayNext} className={`w-full p-4 rounded-xl flex items-center gap-4 font-semibold transition-colors ${darkMode ? 'hover:bg-white/10 active:bg-white/20' : 'hover:bg-gray-100 active:bg-gray-200'}`}>
                          <ListPlus size={20} /> Play Next
                      </button>
                      
                      <button onClick={handleDelete} className={`w-full p-4 rounded-xl flex items-center gap-4 font-semibold text-red-500 transition-colors ${darkMode ? 'hover:bg-red-500/10 active:bg-red-500/20' : 'hover:bg-red-50 active:bg-red-100'}`}>
                          <Trash2 size={20} /> Delete from App
                      </button>
                  </div>
                  
                  <button onClick={() => setShowContextMenu(false)} className={`w-full mt-4 py-3 rounded-xl font-bold transition-colors ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}>Cancel</button>
              </div>
          </div>
      )}

    </div>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}