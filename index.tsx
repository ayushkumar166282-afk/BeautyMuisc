import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, Repeat, 
  ChevronLeft, MoreHorizontal, ListMusic, Plus,
  Disc, Mic2, Music, Download, X, Share, Menu,
  Moon, Activity, Folder, ChevronDown, Youtube, LogIn
} from 'lucide-react';

// --- Types ---
interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  src: string;
  color?: string;
  source?: 'local' | 'server' | 'youtube'; // Track source
  // For DB storage
  fileBlob?: Blob; 
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
          source: 'local'
        }));
        resolve(songs);
      };
    });
  } catch (err) {
    console.error('Failed to load songs', err);
    return [];
  }
};

// --- Mock Data ---
const SERVER_SONGS: Song[] = [
  {
    id: '1',
    title: 'Supersonic',
    artist: 'Space Mariachi',
    album: 'Intergalaxy',
    duration: 184,
    cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
    color: 'bg-blue-500',
    source: 'server'
  },
  {
    id: '2',
    title: 'Ladies Night',
    artist: 'Vegas Tour',
    album: 'Fault',
    duration: 210,
    cover: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/10/25/audio_55940d99ba.mp3',
    color: 'bg-pink-500',
    source: 'server'
  },
  {
    id: '3',
    title: 'World Wide',
    artist: 'Big Ben',
    album: 'Intergalaxy',
    duration: 195,
    cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d4f1?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3',
    color: 'bg-green-500',
    source: 'server'
  }
];

const YOUTUBE_MOCK_SONGS: Song[] = [
  {
    id: 'yt-1',
    title: 'Midnight City (AI Remix)',
    artist: 'Neural Network',
    album: 'YouTube AI Hits',
    duration: 240,
    cover: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2023/10/24/audio_3a887b4699.mp3',
    color: 'bg-red-600',
    source: 'youtube'
  },
  {
    id: 'yt-2',
    title: 'Starlight Dreams',
    artist: 'Cyber Pulse',
    album: 'YouTube AI Hits',
    duration: 210,
    cover: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2023/09/06/audio_0313b5e40e.mp3',
    color: 'bg-purple-500',
    source: 'youtube'
  },
  {
    id: 'yt-3',
    title: 'Digital Rain',
    artist: 'Matrix Node',
    album: 'Generative Beats',
    duration: 185,
    cover: 'https://images.unsplash.com/photo-1535378437323-95558417831e?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
    color: 'bg-green-500',
    source: 'youtube'
  },
  {
    id: 'yt-4',
    title: 'Neon Glitch',
    artist: 'Error 404',
    album: 'Cyberpunk Lo-Fi',
    duration: 160,
    cover: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/10/25/audio_55940d99ba.mp3',
    color: 'bg-pink-600',
    source: 'youtube'
  },
  {
    id: 'yt-5',
    title: 'Quantum Loop',
    artist: 'Q-Bit',
    album: 'Physics of Sound',
    duration: 220,
    cover: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3',
    color: 'bg-blue-600',
    source: 'youtube'
  },
  {
    id: 'yt-6',
    title: 'Synthetic Soul',
    artist: 'Deep Mind',
    album: 'Artificial Emotion',
    duration: 195,
    cover: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2023/10/24/audio_3a887b4699.mp3',
    color: 'bg-indigo-500',
    source: 'youtube'
  },
  {
    id: 'yt-7',
    title: 'Binary Heart',
    artist: 'Robot Soul',
    album: 'Machine Learning',
    duration: 205,
    cover: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2023/09/06/audio_0313b5e40e.mp3',
    color: 'bg-gray-600',
    source: 'youtube'
  },
  {
    id: 'yt-8',
    title: 'Algorithm Flow',
    artist: 'Data Stream',
    album: 'Big Data',
    duration: 175,
    cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
    color: 'bg-teal-500',
    source: 'youtube'
  },
  {
    id: 'yt-9',
    title: 'Virtual Escape',
    artist: 'V-Real',
    album: 'Metaverse Mix',
    duration: 245,
    cover: 'https://images.unsplash.com/photo-1614728853913-1e221162d04a?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/10/25/audio_55940d99ba.mp3',
    color: 'bg-violet-600',
    source: 'youtube'
  },
  {
    id: 'yt-10',
    title: 'System Pulse',
    artist: 'Mainframe',
    album: 'Server Room',
    duration: 190,
    cover: 'https://images.unsplash.com/photo-1558494949-ef526b01201b?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3',
    color: 'bg-orange-500',
    source: 'youtube'
  },
  {
    id: 'yt-11',
    title: 'Cloud Surfer',
    artist: 'Sky Net',
    album: 'Upload Complete',
    duration: 215,
    cover: 'https://images.unsplash.com/photo-1593642532744-d377ab507dc8?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2023/10/24/audio_3a887b4699.mp3',
    color: 'bg-sky-500',
    source: 'youtube'
  },
  {
    id: 'yt-12',
    title: 'Logic Gate',
    artist: 'Processor',
    album: 'Silicon Valley',
    duration: 165,
    cover: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2023/09/06/audio_0313b5e40e.mp3',
    color: 'bg-emerald-600',
    source: 'youtube'
  }
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
  const [playlist, setPlaylist] = useState<Song[]>(SERVER_SONGS);
  const [currentSong, setCurrentSong] = useState<Song | null>(SERVER_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<'list' | 'player'>('list');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [visualizerEnabled, setVisualizerEnabled] = useState(true);
  const [eqPreset, setEqPreset] = useState('Flat');
  const [showMyUploads, setShowMyUploads] = useState(false);

  // YouTube Integration
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [isConnectingYT, setIsConnectingYT] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'all' | 'youtube'>('all');

  // Liked Songs
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
      try {
        const saved = localStorage.getItem('space_music_liked_ids');
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch (e) { return new Set(); }
  });
  const [showLikedSongs, setShowLikedSongs] = useState(false);

  useEffect(() => {
      localStorage.setItem('space_music_liked_ids', JSON.stringify(Array.from(likedIds)));
  }, [likedIds]);

  const toggleLike = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setLikedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  // Install
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  // Timeline dragging
  const rulerRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null); // Ref for the moving container
  const isDraggingRef = useRef(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const crossfadeAudioRef = useRef<HTMLAudioElement>(null); // For outgoing song
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crossfade & Click Sound Refs
  const isCrossfading = useRef(false);
  const crossfadeTransitioning = useRef(false); // Flag to tell useEffect this is a crossfade
  const clickAudioCtx = useRef<AudioContext | null>(null);
  const lastClickValue = useRef(0);

  const uploadedSongs = playlist.filter(s => s.source === 'local');
  const displayPlaylist = libraryTab === 'youtube' 
    ? playlist.filter(s => s.source === 'youtube')
    : playlist.filter(s => s.source !== 'youtube');

  // --- Scrolling Ruler Logic ---
  const PIXELS_PER_SECOND = 15; 
  const TICK_SPACING = 15; // Space between each second tick

  // Smooth Animation Loop
  useEffect(() => {
    let rafId: number;
    const animate = () => {
        if (ticksRef.current && audioRef.current) {
            // Read directly from audio element for 60fps smoothness, fallback to 0
            const t = audioRef.current.currentTime || 0;
            // Update the transform directly on the DOM element
            ticksRef.current.style.transform = `translateX(-${t * PIXELS_PER_SECOND}px)`;
        }
        rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []); // Runs continuously

  useEffect(() => {
    loadSongsFromDB().then(savedSongs => {
      if (savedSongs.length > 0) {
        setPlaylist(prev => {
             // Avoid duplicates if simple id check
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

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    } else {
      setShowInstallHelp(true);
    }
  };

  // --- PLAYBACK EFFECT & CROSSFADE HANDLING ---
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        if (crossfadeTransitioning.current) {
            // CROSSFADE LOGIC
            // 1. New song (audioRef) starts at volume 0
            audioRef.current.volume = 0;
            audioRef.current.play().catch(e => console.error(e));
            
            // 2. Outgoing song (crossfadeAudioRef) is already playing at volume 1 (set in trigger)
            
            // 3. Ramp volumes over 4 seconds
            const FADE_DURATION = 4000;
            const STEPS = 40;
            const INTERVAL = FADE_DURATION / STEPS;
            let step = 0;
            
            const fadeInterval = setInterval(() => {
                step++;
                const progress = step / STEPS;
                
                // Ramp up new song
                if (audioRef.current) audioRef.current.volume = Math.min(1, progress);
                
                // Ramp down old song
                if (crossfadeAudioRef.current) crossfadeAudioRef.current.volume = Math.max(0, 1 - progress);
                
                if (step >= STEPS) {
                    clearInterval(fadeInterval);
                    if (crossfadeAudioRef.current) {
                        crossfadeAudioRef.current.pause();
                        crossfadeAudioRef.current.src = ""; // Clear memory
                    }
                    isCrossfading.current = false;
                }
            }, INTERVAL);
            
            crossfadeTransitioning.current = false;
        } else {
            // NORMAL PLAYBACK START
            audioRef.current.volume = 1;
            audioRef.current.play().catch(e => console.error("Playback failed", e));
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  // --- MEDIA SESSION API ---
  const updatePositionState = () => {
    if ('mediaSession' in navigator && audioRef.current && !isNaN(audioRef.current.duration)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: audioRef.current.duration,
                playbackRate: audioRef.current.playbackRate,
                position: audioRef.current.currentTime
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
        { src: currentSong.cover, sizes: '96x96', type: 'image/jpeg' },
        { src: currentSong.cover, sizes: '128x128', type: 'image/jpeg' },
        { src: currentSong.cover, sizes: '192x192', type: 'image/jpeg' },
        { src: currentSong.cover, sizes: '256x256', type: 'image/jpeg' },
        { src: currentSong.cover, sizes: '384x384', type: 'image/jpeg' },
        { src: currentSong.cover, sizes: '512x512', type: 'image/jpeg' },
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        // Logic might need to be smarter about the source playlist
        const idx = playlist.findIndex(s => s.id === currentSong.id);
        const prevIdx = (idx - 1 + playlist.length) % playlist.length;
        setCurrentSong(playlist[prevIdx]);
        setIsPlaying(true);
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
        const idx = playlist.findIndex(s => s.id === currentSong.id);
        const nextIdx = (idx + 1) % playlist.length;
        setCurrentSong(playlist[nextIdx]);
        setIsPlaying(true);
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            setCurrentTime(details.seekTime);
            updatePositionState();
        }
    });

  }, [currentSong, playlist]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      updatePositionState();
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isDraggingRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 0;
      setCurrentTime(cur);
      setDuration(dur);
      
      // AUTO CROSSFADE TRIGGER
      // If within last 4 seconds, playing, not already crossfading, and song is long enough
      if (dur > 10 && (dur - cur) < 4 && !isCrossfading.current && isPlaying) {
          triggerCrossfade();
      }
    }
  };
  
  const triggerCrossfade = () => {
      isCrossfading.current = true;
      crossfadeTransitioning.current = true;
      
      // 1. Move current playback state to secondary audio element to keep it playing
      if (crossfadeAudioRef.current && audioRef.current && currentSong) {
          crossfadeAudioRef.current.src = currentSong.src; // Or audioRef.current.src
          crossfadeAudioRef.current.currentTime = audioRef.current.currentTime;
          crossfadeAudioRef.current.volume = 1;
          crossfadeAudioRef.current.play().catch(e => console.log("Crossfade play error", e));
      }
      
      // 2. Trigger Next Song (this updates state -> re-renders -> triggers useEffect)
      nextSong();
  };

  const handleSongEnd = () => {
    // If crossfade didn't happen for some reason (short song), fallback to standard next
    if (!isCrossfading.current) {
        nextSong();
    }
  };

  const playSong = (song: Song) => {
    isCrossfading.current = false; // Reset if manual play
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
      if (view === 'list') setView('player');
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
      setView('player');
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
  
  // --- CLICK SOUND ---
  const playClick = () => {
      if (!clickAudioCtx.current) {
          clickAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = clickAudioCtx.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine'; // Soft click
      oscillator.frequency.setValueAtTime(800, ctx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

      gainNode.gain.setValueAtTime(0.05, ctx.currentTime); // Low volume
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.05);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    
    // Play sound if we crossed an integer threshold (like a gear ticking)
    if (Math.floor(time) !== Math.floor(lastClickValue.current)) {
        playClick();
        lastClickValue.current = time;
    }

    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      updatePositionState();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newSong: Song = {
        id: Date.now().toString(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Local Upload',
        album: 'My Files',
        duration: 0,
        cover: 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=1000&auto=format&fit=crop',
        src: url,
        color: 'bg-purple-500',
        source: 'local'
      };
      setPlaylist(prev => [...prev, newSong]);
      playSong(newSong);
      saveSongToDB(newSong, file);
    }
  };

  const connectYouTube = () => {
      setIsConnectingYT(true);
      // Simulate API delay
      setTimeout(() => {
          setYoutubeConnected(true);
          setIsConnectingYT(false);
          setPlaylist(prev => [...prev, ...YOUTUBE_MOCK_SONGS]);
      }, 2000);
  };

  return (
    <div className={`relative w-full h-full overflow-hidden font-sans antialiased transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
      
      {/* GLOBAL NOISE TEXTURE FOR PREMIUM FEEL */}
      <div className="absolute inset-0 z-[100] pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      <audio
        ref={audioRef}
        src={currentSong?.src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleSongEnd}
        onLoadedMetadata={() => {
            handleTimeUpdate();
            updatePositionState();
        }}
        crossOrigin="anonymous"
      />
      
      {/* SECONDARY AUDIO FOR CROSSFADING (HIDDEN) */}
      <audio ref={crossfadeAudioRef} crossOrigin="anonymous" />

      {/* --- Settings Modal --- */}
      {showSettings && (
        <div className="absolute inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-800'} transition-colors`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`p-2 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                <X size={20}/>
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${darkMode ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Moon size={20} />
                  </div>
                  <span className="font-medium">Dark Mode</span>
              </div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`w-12 h-7 rounded-full transition-colors relative ${darkMode ? 'bg-indigo-500' : 'bg-gray-300'}`}
              >
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${visualizerEnabled ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Activity size={20} />
                  </div>
                  <span className="font-medium">Visualizer</span>
              </div>
              <button 
                onClick={() => setVisualizerEnabled(!visualizerEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative ${visualizerEnabled ? 'bg-pink-500' : 'bg-gray-300'}`}
              >
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${visualizerEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="mb-2">
              <span className="font-medium block mb-3">Equalizer Preset</span>
              <div className="grid grid-cols-2 gap-3">
                  {['Flat', 'Bass Boost', 'Vocal', 'Treble'].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setEqPreset(preset)}
                        className={`py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                          eqPreset === preset 
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                            : (darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200')
                        }`}
                      >
                        {preset}
                      </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- My Uploads Modal --- */}
      {showMyUploads && (
        <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 animate-in fade-in zoom-in-95 duration-300">
           <div className={`w-full h-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col relative transition-colors ${darkMode ? 'bg-slate-800/95 text-white' : 'bg-white/95 text-gray-800'}`}>
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h2 className="text-2xl font-bold">My Uploads</h2>
                   <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{uploadedSongs.length} local tracks</p>
                </div>
                <button onClick={() => setShowMyUploads(false)} className={`p-2 rounded-full ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  <X size={20} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
               {uploadedSongs.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <Folder size={64} className="mb-4" />
                    <p className="font-medium">No music uploaded yet</p>
                    <p className="text-sm">Tap the + button to add songs</p>
                 </div>
               ) : (
                 uploadedSongs.map(song => (
                    <div 
                      key={song.id}
                      onClick={() => playSong(song)}
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${
                        currentSong?.id === song.id ? (darkMode ? 'bg-purple-500/20' : 'bg-purple-50') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')
                      }`}
                    >
                       <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${song.color || 'bg-purple-500'}`}>
                          {currentSong?.id === song.id && isPlaying ? <Activity size={18} className="animate-pulse"/> : <Music size={18} />}
                       </div>
                       <div className="ml-3 flex-1 overflow-hidden">
                          <h4 className={`font-bold truncate ${currentSong?.id === song.id ? 'text-purple-500' : ''}`}>{song.title}</h4>
                          <p className="text-xs opacity-60 truncate">{song.album}</p>
                       </div>
                       {currentSong?.id === song.id && <div className="w-2 h-2 rounded-full bg-purple-500"></div>}
                    </div>
                 ))
               )}
             </div>
             {uploadedSongs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200/10 text-center">
                   <button 
                     onClick={() => { if(uploadedSongs.length > 0) playSong(uploadedSongs[0]); }}
                     className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                   >
                      <Play size={18} fill="white" /> Play All
                   </button>
                </div>
             )}
           </div>
        </div>
      )}

      {/* --- Liked Songs Modal --- */}
      {showLikedSongs && (
        <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 animate-in fade-in zoom-in-95 duration-300">
           <div className={`w-full h-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-hidden flex flex-col relative transition-colors ${darkMode ? 'bg-slate-800/95 text-white' : 'bg-white/95 text-gray-800'}`}>
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h2 className="text-2xl font-bold">Liked Songs</h2>
                   <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{likedIds.size} tracks</p>
                </div>
                <button onClick={() => setShowLikedSongs(false)} className={`p-2 rounded-full ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  <X size={20} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
               {playlist.filter(s => likedIds.has(s.id)).length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <Heart size={64} className="mb-4 text-pink-500" />
                    <p className="font-medium">No liked songs yet</p>
                    <p className="text-sm">Tap the heart to add songs</p>
                 </div>
               ) : (
                 playlist.filter(s => likedIds.has(s.id)).map(song => (
                    <div 
                      key={song.id}
                      onClick={() => playSong(song)}
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${
                        currentSong?.id === song.id ? (darkMode ? 'bg-pink-500/20' : 'bg-pink-50') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')
                      }`}
                    >
                       <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${song.color || 'bg-pink-500'}`}>
                          {currentSong?.id === song.id && isPlaying ? <Activity size={18} className="animate-pulse"/> : <Music size={18} />}
                       </div>
                       <div className="ml-3 flex-1 overflow-hidden">
                          <h4 className={`font-bold truncate ${currentSong?.id === song.id ? 'text-pink-500' : ''}`}>{song.title}</h4>
                          <p className="text-xs opacity-60 truncate">{song.artist}</p>
                       </div>
                       <button onClick={(e) => toggleLike(e, song.id)} className="p-2 text-pink-500 hover:scale-110 transition-transform">
                           <Heart size={18} fill="currentColor" />
                       </button>
                    </div>
                 ))
               )}
             </div>
             {likedIds.size > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200/10 text-center">
                   <button 
                     onClick={() => { 
                         const liked = playlist.filter(s => likedIds.has(s.id));
                         if(liked.length > 0) playSong(liked[0]); 
                     }}
                     className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                   >
                      <Play size={18} fill="white" /> Play All
                   </button>
                </div>
             )}
           </div>
        </div>
      )}

      {/* --- Install Help --- */}
      {showInstallHelp && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <button onClick={() => setShowInstallHelp(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
              <X size={24} />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                <Download size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Install App</h3>
              {isIOS ? (
                <div className="space-y-4 text-sm text-gray-600">
                  <p>To install on iOS:</p>
                  <ol className="text-left space-y-3 bg-gray-50 p-4 rounded-xl">
                    <li className="flex items-center gap-2"><span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>Tap the <Share size={16} className="text-blue-500" /> <b>Share</b> button.</li>
                    <li className="flex items-center gap-2"><span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>Scroll down and tap <br/><b>"Add to Home Screen"</b>.</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-4 text-sm text-gray-600">
                   <p>To install on Android / Chrome:</p>
                   <ol className="text-left space-y-3 bg-gray-50 p-4 rounded-xl">
                    <li className="flex items-center gap-2"><span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>Tap the <Menu size={16} className="text-gray-500" /> <b>Menu</b>.</li>
                    <li className="flex items-center gap-2"><span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>Tap <b>"Install App"</b>.</li>
                  </ol>
                </div>
              )}
              <button onClick={() => setShowInstallHelp(false)} className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* --- List View --- */}
      <div className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${darkMode ? 'bg-slate-900' : 'bg-gray-50'} will-change-transform ${view === 'player' ? 'scale-92 opacity-0 pointer-events-none blur-md' : 'scale-100 opacity-100 blur-0'}`}>
        <div className="relative h-[45%] w-full overflow-hidden">
          <img src="https://images.unsplash.com/photo-1471958680802-1345a694ba6d?q=80&w=1000&auto=format&fit=crop" alt="Artist" className="w-full h-full object-cover filter brightness-90 transition-transform duration-[10s] hover:scale-110"/>
          <button className="absolute top-6 left-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
            <ChevronLeft size={24} />
          </button>
          <div className="absolute top-6 right-6 flex gap-2">
            <button onClick={() => setShowLikedSongs(true)} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-pink-500/20 transition-colors active:scale-90">
              <Heart size={24} fill={likedIds.size > 0 ? "white" : "none"} />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
              <MoreHorizontal size={24} />
            </button>
          </div>
          <div className="absolute bottom-12 left-6 text-white">
            <h1 className="text-3xl font-bold tracking-tight mb-1 drop-shadow-lg">Welcome Ayush</h1>
            <p className="text-sm text-white/80 font-medium">34m Monthly Listener</p>
          </div>
        </div>
        <button onClick={() => currentSong && playSong(currentSong)} className="absolute top-[41%] right-8 w-16 h-16 bg-white/30 backdrop-blur-xl border border-white/40 rounded-full flex items-center justify-center text-white shadow-xl z-20 hover:scale-105 transition-transform active:scale-95">
          {isPlaying && view === 'list' ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" className="ml-1" />}
        </button>
        <div className={`relative -mt-8 rounded-t-[3rem] h-[60%] px-6 pt-10 pb-32 overflow-y-auto no-scrollbar z-10 transition-colors ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="mb-6 flex justify-between items-center">
             <div className="flex gap-4">
               <button onClick={() => setLibraryTab('all')} className={`text-lg font-bold transition-colors ${libraryTab === 'all' ? (darkMode ? 'text-white' : 'text-gray-900') : 'text-gray-400'}`}>Library</button>
               <button onClick={() => setLibraryTab('youtube')} className={`text-lg font-bold flex items-center gap-1 transition-colors ${libraryTab === 'youtube' ? 'text-red-500' : 'text-gray-400'}`}>
                  <Youtube size={20} /> YouTube
               </button>
             </div>
          </div>

          {libraryTab === 'all' ? (
            <>
              <div className="mb-8">
                <h2 className={`font-bold mb-4 ml-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Albums</h2>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  <div className="flex-shrink-0 w-36 h-40 bg-blue-400 rounded-2xl p-4 flex flex-col justify-end shadow-lg shadow-blue-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
                    <ListMusic className="text-white mb-auto opacity-80" size={24} />
                    <p className="text-white font-bold text-lg leading-tight">Intergalaxy</p>
                    <p className="text-blue-100 text-xs mt-1">8 Songs</p>
                  </div>
                  <div onClick={() => setShowMyUploads(true)} className="flex-shrink-0 w-36 h-40 bg-purple-500 rounded-2xl p-4 flex flex-col justify-end shadow-lg shadow-purple-200 relative overflow-hidden cursor-pointer active:scale-95 transition-transform">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
                      <Folder className="text-white mb-auto opacity-80" size={24} />
                      <p className="text-white font-bold text-lg leading-tight">My Files</p>
                      <p className="text-purple-200 text-xs mt-1">{uploadedSongs.length} Songs</p>
                  </div>
                  <div onClick={() => fileInputRef.current?.click()} className={`flex-shrink-0 w-36 h-40 border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-gray-100 border-gray-300'}`}>
                      <Plus className={darkMode ? 'text-slate-500' : 'text-gray-400 mb-2'} size={32} />
                      <p className={`font-medium text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Upload</p>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
                  </div>
                </div>
              </div>
              <div>
                <h2 className={`font-bold mb-4 ml-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Songs</h2>
                <div className="space-y-4">
                  {displayPlaylist.map((song) => (
                    <div key={song.id} onClick={() => playSong(song)} className={`flex items-center p-3 rounded-2xl transition-all duration-300 ${currentSong?.id === song.id ? (darkMode ? 'bg-blue-900/40 shadow-lg shadow-blue-900/20' : 'bg-blue-50 shadow-md shadow-blue-100/50') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${song.color || 'bg-gray-400'}`}>
                        {currentSong?.id === song.id && isPlaying ? <ListMusic size={20} className="animate-pulse" /> : <Music size={20} />}
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className={`font-bold text-base ${currentSong?.id === song.id ? 'text-blue-500' : (darkMode ? 'text-gray-100' : 'text-gray-800')}`}>{song.title}</h3>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{song.album}</p>
                      </div>
                      {currentSong?.id === song.id ? (
                        <div className="flex space-x-1 items-end h-4 mr-2">
                            <div className="w-1 bg-blue-500 animate-[bounce_1s_infinite] h-2"></div>
                            <div className="w-1 bg-blue-500 animate-[bounce_1.2s_infinite] h-4"></div>
                            <div className="w-1 bg-blue-500 animate-[bounce_0.8s_infinite] h-3"></div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs font-medium">{formatTime(song.duration || 0)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // YOUTUBE TAB
            <div className="h-full flex flex-col">
              {!youtubeConnected ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                        <Youtube size={40} className="text-red-600" />
                    </div>
                    <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Connect YouTube Music</h2>
                    <p className={`mb-8 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                       Login to stream your liked songs and playlists directly in Space Player.
                    </p>
                    <button 
                      onClick={connectYouTube}
                      disabled={isConnectingYT}
                      className="w-full max-w-xs py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-red-500/30"
                    >
                        {isConnectingYT ? (
                           <>Processing...</>
                        ) : (
                           <><LogIn size={20} /> Login with Google</>
                        )}
                    </button>
                 </div>
              ) : (
                 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                       <h2 className={`font-bold ml-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Liked Songs</h2>
                       <span className="text-xs font-medium text-red-500 bg-red-100 px-2 py-1 rounded-full">Connected</span>
                    </div>
                    <div className="space-y-4">
                      {displayPlaylist.map((song) => (
                        <div key={song.id} onClick={() => playSong(song)} className={`flex items-center p-3 rounded-2xl transition-all duration-300 ${currentSong?.id === song.id ? (darkMode ? 'bg-red-900/20 shadow-lg shadow-red-900/10' : 'bg-red-50 shadow-md shadow-red-100/50') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')}`}>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md relative overflow-hidden ${song.color || 'bg-gray-400'}`}>
                             <img src={song.cover} className="w-full h-full object-cover opacity-80" />
                             <div className="absolute inset-0 flex items-center justify-center">
                                {currentSong?.id === song.id && isPlaying ? <ListMusic size={20} className="animate-pulse" /> : <Youtube size={20} />}
                             </div>
                          </div>
                          <div className="ml-4 flex-1">
                            <h3 className={`font-bold text-base ${currentSong?.id === song.id ? 'text-red-500' : (darkMode ? 'text-gray-100' : 'text-gray-800')}`}>{song.title}</h3>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{song.artist} • {song.album}</p>
                          </div>
                          {/* Heart icon in list view as well */}
                          <button onClick={(e) => toggleLike(e, song.id)} className={`p-2 transition-transform active:scale-90 ${likedIds.has(song.id) ? 'text-pink-500' : 'text-gray-400'}`}>
                             <Heart size={18} fill={likedIds.has(song.id) ? "currentColor" : "none"} />
                          </button>
                        </div>
                      ))}
                    </div>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Mini Player --- */}
      {currentSong && (
         <div 
            onClick={() => setView('player')}
            className={`absolute bottom-4 left-4 right-4 z-40 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-2 flex items-center cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform 
              ${view === 'list' ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}
              ${darkMode ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white/80 border-white/40'}
            `}
         >
            <div className={`w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border-2 ${darkMode ? 'border-slate-600' : 'border-white'} relative`}>
               <img src={currentSong.cover} alt={currentSong.title} className={`w-full h-full object-cover`}/>
            </div>
            <div className="flex-1 ml-3 min-w-0 flex flex-col justify-center">
               <h4 className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{currentSong.title}</h4>
               <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentSong.artist}</p>
            </div>
            <div className="flex items-center gap-2 mr-2">
               <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform active:scale-90 ${darkMode ? 'bg-white text-slate-900' : 'bg-black text-white'}`}>
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
               </button>
            </div>
            <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-gray-200/20 rounded-full overflow-hidden">
               <div className={`h-full ${darkMode ? 'bg-indigo-400' : 'bg-blue-500'}`} style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
            </div>
         </div>
      )}

      {/* --- Player View (EXACT REPLICA OF SPACE VECTOR ART) --- */}
      <div className={`absolute inset-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] bg-[#1e1b4b] overflow-hidden flex flex-col items-center ${view === 'player' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-100 pointer-events-none'}`}>
          
          {/* NEW: BLURRED BACKGROUND IMAGE */}
          <div className="absolute inset-0 z-0">
              <img 
                  src={currentSong?.cover} 
                  alt="Blur Background" 
                  className="w-full h-full object-cover blur-[80px] opacity-60 scale-125"
              />
              <div className="absolute inset-0 bg-[#1e1b4b]/60 mix-blend-multiply"></div>
          </div>

          {/* VIGNETTE OVERLAY */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-0"></div>

          {/* 1. Header (Top Controls) */}
          <div className="w-full flex justify-between items-center p-6 relative z-50 mt-safe pointer-events-none">
              <button 
                onClick={() => setView('list')}
                className="w-12 h-12 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all duration-300 pointer-events-auto shadow-lg shadow-black/10"
              >
                  <ChevronDown size={24} />
              </button>
              <button 
                 onClick={() => setShowSettings(true)}
                 className="w-12 h-12 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all duration-300 pointer-events-auto shadow-lg shadow-black/10"
              >
                  <MoreHorizontal size={24} />
              </button>
          </div>

          {/* 2. Space Vector Background Elements (Absolute) */}
          {/* Orange Planet Top-Left */}
          <div className="absolute -top-16 -left-16 w-64 h-64 bg-gradient-to-br from-[#FF9F43] to-[#FF8000] rounded-full opacity-90 blur-2xl pointer-events-none mix-blend-screen"></div>
          {/* Pink Ring Top-Right */}
          <div className="absolute -top-12 -right-24 w-80 h-80 rounded-full border-[60px] border-[#FF6B81] opacity-90 blur-xl pointer-events-none mix-blend-screen"></div>
          {/* Faint Orbit Lines */}
          <div className="absolute top-1/4 left-[-10%] w-[120%] h-64 border border-white/5 rounded-[100%] rotate-12 scale-110 pointer-events-none"></div>

          {/* 3. Main Center Content (Planet + Ribbon) */}
          <div className="flex-1 flex flex-col items-center justify-center relative w-full -mt-20 z-10">
               {/* Center Blue Planet */}
               <div className="relative w-72 h-72 mb-4 z-0">
                  <div className="absolute inset-0 rounded-full bg-[#2D98DA] shadow-2xl overflow-hidden ring-4 ring-white/5">
                      {/* Inner Dark Hole/Donut */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-[#1e1b4b] rounded-full shadow-inner"></div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-black/40 rounded-full blur-xl"></div>
                  </div>
                  
                  {/* Orbiting Mini Planet */}
                  <div className="absolute top-12 right-2 w-6 h-6 bg-[#2D98DA] rounded-full shadow-md z-0"></div>

                  {/* Ribbon Banner (Glass Effect Added) */}
                  <div className="absolute bottom-10 -left-6 -right-6 h-24 z-20">
                     {/* Main Banner Rect with Glass */}
                     <div className="w-full h-full bg-gradient-to-r from-[#2D98DA]/80 to-[#48dbfb]/80 backdrop-blur-md border-t border-b border-white/20 shadow-2xl flex items-center px-6 relative z-10 clip-ribbon">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center mr-4 border border-white/10 flex-shrink-0 shadow-lg">
                           <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                        </div>
                        {/* Text */}
                        <div className="flex flex-col text-white flex-1 min-w-0 drop-shadow-md">
                            <h2 className="text-xl font-bold leading-tight truncate tracking-wide">{currentSong?.title}</h2>
                            <p className="text-sm text-white/80 font-medium truncate">{currentSong?.artist}</p>
                        </div>
                     </div>
                     
                     {/* Folded Wings (Dark Triangles) - Keep solid/dark for depth */}
                     <div className="absolute top-[-8px] left-0 w-6 h-8 bg-[#15456b] -z-10 skew-y-[30deg] origin-bottom-right brightness-50"></div>
                     <div className="absolute top-[-8px] right-0 w-6 h-8 bg-[#15456b] -z-10 skew-y-[-30deg] origin-bottom-left brightness-50"></div>
                  </div>
               </div>
          </div>

          {/* 4. UNIFIED GLASS DASHBOARD (Ruler + Controls) - FLAT & RECTANGULAR, LIGHTER GLASS */}
          <div className="w-full z-30 bg-[#3b82f6]/20 backdrop-blur-3xl border-t border-white/10 pb-safe pt-6 flex flex-col relative overflow-hidden">
               
               {/* Ruler Section Container */}
               <div className="w-full h-24 relative flex flex-col items-center justify-center mb-6">
                   
                   {/* SCROLLING CONTAINER (Ticks + Numbers) */}
                   <div 
                      ref={ticksRef}
                      className="absolute top-0 left-1/2 h-full flex items-start will-change-transform"
                   >
                      {Array.from({length: Math.ceil(duration || 300) + 20}).map((_, i) => {
                         const isTen = i % 10 === 0;
                         const isFive = i % 5 === 0 && !isTen;
                         
                         return (
                            <div key={i} className="absolute flex flex-col items-center top-0" style={{ left: `${i * TICK_SPACING}px`, width: '1px' }}>
                               {/* Tick */}
                               <div className={`w-[1px] bg-white/40 ${isTen ? 'h-6 bg-white/90' : (isFive ? 'h-4 bg-white/70 mt-1' : 'h-2 mt-2')}`}></div>
                               
                               {/* Number (Every 10s and 5s) */}
                               {isTen && (
                                   <div className={`mt-5 text-sm font-medium font-mono transition-all duration-300 ${Math.abs(currentTime - i) < 5 ? 'text-white scale-110 drop-shadow-md' : 'text-white/30 scale-90'}`}>
                                       {formatRulerTime(i)}
                                   </div>
                               )}
                               {isFive && (
                                   <div className={`mt-6 text-[10px] font-medium font-mono text-white/20 transition-all duration-300 ${Math.abs(currentTime - i) < 5 ? 'opacity-80' : 'opacity-40'}`}>
                                       {formatRulerTime(i)}
                                   </div>
                               )}
                            </div>
                         )
                      })}
                   </div>

                   {/* STATIC CENTER INDICATOR (Line + Pill) */}
                   <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-20">
                      {/* Top Line Part */}
                      <div className="w-[1px] h-4 bg-white/50"></div>
                      {/* The Pill */}
                      <div className="w-1.5 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)] my-[-2px] z-10"></div>
                      {/* Bottom Line Part (extending slightly) */}
                      <div className="w-[1px] h-8 bg-gradient-to-b from-white/50 to-transparent"></div>
                   </div>

                   {/* STATIC BOTTOM TRIANGLE POINTER */}
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white"></div>
                        {/* Little line under triangle */}
                        <div className="w-6 h-[1px] bg-white/30 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                   </div>

                   {/* FADE MASKS (Sides) - Adjusted for Lighter Blue */}
                   <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#1e3a8a]/40 via-transparent to-[#1e3a8a]/40"></div>

                   {/* Slider Input (Invisible overlay for touch) */}
                   <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                   />
               </div>

               {/* Bottom Controls Container */}
               <div className="w-full px-8 pb-10 flex items-center justify-between z-40">
                  <button className="text-white/40 hover:text-white transition-colors">
                      <Repeat size={20} />
                  </button>

                  <button onClick={prevSong} className="text-white/70 hover:text-white transition-transform active:scale-90 hover:scale-110">
                      <SkipBack size={28} />
                  </button>

                  <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-20 h-20 bg-white/5 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all duration-200"
                  >
                       {isPlaying ? (
                          <Pause size={32} className="text-white fill-white" />
                       ) : (
                          <Play size={32} className="text-white fill-white ml-1" />
                       )}
                  </button>

                  <button onClick={nextSong} className="text-white/70 hover:text-white transition-transform active:scale-90 hover:scale-110">
                      <SkipForward size={28} />
                  </button>

                  <button 
                      onClick={(e) => currentSong && toggleLike(e, currentSong.id)}
                      className={`transition-colors active:scale-90 hover:scale-110 ${currentSong && likedIds.has(currentSong.id) ? 'text-pink-500' : 'text-white/40 hover:text-white'}`}
                  >
                      <Heart size={20} fill={currentSong && likedIds.has(currentSong.id) ? "currentColor" : "none"} />
                  </button>
              </div>
          </div>
          
          <style>{`
              .mt-safe {
                  margin-top: env(safe-area-inset-top);
              }
              .pb-safe {
                  padding-bottom: max(3rem, env(safe-area-inset-bottom));
              }
          `}</style>
      </div>
      
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);