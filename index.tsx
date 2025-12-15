import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, Repeat, 
  ChevronLeft, MoreHorizontal, ListMusic, Plus,
  Disc, Mic2, Music, Download, X, Share, Menu
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
    // Create a storage object that removes the temporary blob URL and stores the actual blob
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
        // Convert stored Blobs back to URLs
        const songs = storedSongs.map((s: any) => ({
          ...s,
          src: URL.createObjectURL(s.fileBlob)
        }));
        resolve(songs);
      };
    });
  } catch (err) {
    console.error('Failed to load songs', err);
    return [];
  }
};

// --- Mock Data (Server-sided music) ---
const SERVER_SONGS: Song[] = [
  {
    id: '1',
    title: 'Supersonic',
    artist: 'Space Mariachi',
    album: 'Intergalaxy',
    duration: 184,
    cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', // Example track
    color: 'bg-blue-500'
  },
  {
    id: '2',
    title: 'Ladies Night',
    artist: 'Vegas Tour',
    album: 'Fault',
    duration: 210,
    cover: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/10/25/audio_55940d99ba.mp3',
    color: 'bg-pink-500'
  },
  {
    id: '3',
    title: 'World Wide',
    artist: 'Big Ben',
    album: 'Intergalaxy',
    duration: 195,
    cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d4f1?q=80&w=1000&auto=format&fit=crop',
    src: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3',
    color: 'bg-green-500'
  }
];

// --- Utilities ---
const formatTime = (time: number) => {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// --- Components ---

const App = () => {
  const [playlist, setPlaylist] = useState<Song[]>(SERVER_SONGS);
  const [currentSong, setCurrentSong] = useState<Song | null>(SERVER_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<'list' | 'player'>('list');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved songs on boot
  useEffect(() => {
    loadSongsFromDB().then(savedSongs => {
      if (savedSongs.length > 0) {
        setPlaylist([...SERVER_SONGS, ...savedSongs]);
      }
    });
  }, []);

  // Install & Platform Detection Logic
  useEffect(() => {
    // 1. Check if already running as an app
    const mq = window.matchMedia('(display-mode: standalone)');
    setIsStandalone(mq.matches);

    // 2. Check if iOS (for manual instructions)
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // 3. Listen for Android/Desktop install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      // If the browser provided a prompt, trigger it
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    } else {
      // Otherwise show our manual help modal
      setShowInstallHelp(true);
    }
  };

  // Audio Logic
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSongEnd = () => {
    nextSong();
  };

  const playSong = (song: Song) => {
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newSong: Song = {
        id: Date.now().toString(),
        title: file.name.replace(/\.[^/.]+$/, ""), // remove extension
        artist: 'Local Upload',
        album: 'My Files',
        duration: 0,
        cover: 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=1000&auto=format&fit=crop',
        src: url,
        color: 'bg-purple-500'
      };
      
      // Save to state
      setPlaylist(prev => [...prev, newSong]);
      playSong(newSong);

      // Persist to DB
      saveSongToDB(newSong, file);
    }
  };

  return (
    <div className="relative w-full h-full bg-white overflow-hidden font-sans">
      <audio
        ref={audioRef}
        src={currentSong?.src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleSongEnd}
        onLoadedMetadata={handleTimeUpdate}
      />

      {/* --- Install Help Modal --- */}
      {showInstallHelp && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <button 
              onClick={() => setShowInstallHelp(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"
            >
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
                    <li className="flex items-center gap-2">
                      <span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                      Tap the <Share size={16} className="text-blue-500" /> <b>Share</b> button below.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                      Scroll down and tap <br/><b>"Add to Home Screen"</b>.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-4 text-sm text-gray-600">
                   <p>To install on Android / Chrome:</p>
                   <ol className="text-left space-y-3 bg-gray-50 p-4 rounded-xl">
                    <li className="flex items-center gap-2">
                      <span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                      Tap the <Menu size={16} className="text-gray-500" /> <b>Browser Menu</b> (three dots).
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-bold bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                      Tap <b>"Install App"</b> or <br/><b>"Add to Home Screen"</b>.
                    </li>
                  </ol>
                </div>
              )}
              
              <button 
                onClick={() => setShowInstallHelp(false)}
                className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- List View (Artist Profile) --- */}
      <div 
        className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] bg-gray-50 will-change-transform ${view === 'player' ? 'scale-90 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        {/* Header Image */}
        <div className="relative h-[45%] w-full overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1568481947814-22b9f6266023?q=80&w=1000&auto=format&fit=crop" 
            alt="Artist" 
            className="w-full h-full object-cover filter brightness-90"
          />
          {/* Back Button */}
          <button className="absolute top-6 left-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
            <ChevronLeft size={24} />
          </button>
          
          <div className="absolute top-6 right-6 flex gap-2">
            {/* Install Button: ALWAYS show unless already standalone */}
            {!isStandalone && (
              <button 
                onClick={handleInstallClick}
                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white animate-pulse active:scale-90 transition-transform"
                title="Install App"
              >
                <Download size={24} />
              </button>
            )}
            
            {/* Menu Button */}
            <button className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
              <MoreHorizontal size={24} />
            </button>
          </div>

          {/* Artist Info Overlay */}
          <div className="absolute bottom-12 left-6 text-white">
            <h1 className="text-3xl font-bold tracking-tight mb-1 drop-shadow-lg">Space Mariachi</h1>
            <p className="text-sm text-white/80 font-medium">34m Monthly Listener</p>
          </div>
        </div>

        {/* Play FAB */}
        <button 
          onClick={() => currentSong && playSong(currentSong)}
          className="absolute top-[41%] right-8 w-16 h-16 bg-white/30 backdrop-blur-xl border border-white/40 rounded-full flex items-center justify-center text-white shadow-xl z-20 hover:scale-105 transition-transform"
        >
          {isPlaying && view === 'list' ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" className="ml-1" />}
        </button>

        {/* Content Body */}
        <div className="relative -mt-8 bg-white rounded-t-[3rem] h-[60%] px-6 pt-10 pb-20 overflow-y-auto no-scrollbar z-10">
          
          {/* Albums Section */}
          <div className="mb-8">
            <h2 className="text-gray-800 font-bold mb-4 ml-1">Albums</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {/* Album Card 1 */}
              <div className="flex-shrink-0 w-36 h-40 bg-blue-400 rounded-2xl p-4 flex flex-col justify-end shadow-lg shadow-blue-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
                <ListMusic className="text-white mb-auto opacity-80" size={24} />
                <p className="text-white font-bold text-lg leading-tight">Intergalaxy</p>
                <p className="text-blue-100 text-xs mt-1">8 Songs</p>
              </div>
              
              {/* Album Card 2 */}
              <div className="flex-shrink-0 w-36 h-40 bg-orange-400 rounded-2xl p-4 flex flex-col justify-end shadow-lg shadow-orange-200 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 blur-xl"></div>
                 <Play className="text-white mb-auto opacity-80" size={24} fill="white"/>
                <p className="text-white font-bold text-lg leading-tight">Fault</p>
                <p className="text-orange-100 text-xs mt-1">10 Songs</p>
              </div>

               {/* Upload Card */}
               <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-36 h-40 bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <Plus className="text-gray-400 mb-2" size={32} />
                  <p className="text-gray-500 font-medium text-sm">Upload</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
               </div>
            </div>
          </div>

          {/* Songs List */}
          <div>
            <h2 className="text-gray-800 font-bold mb-4 ml-1">Songs</h2>
            <div className="space-y-4">
              {playlist.map((song) => (
                <div 
                  key={song.id} 
                  onClick={() => playSong(song)}
                  className={`flex items-center p-3 rounded-2xl transition-colors ${currentSong?.id === song.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${song.color || 'bg-gray-400'}`}>
                    {currentSong?.id === song.id && isPlaying ? (
                       <ListMusic size={20} className="animate-pulse" />
                    ) : (
                       <Music size={20} />
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className={`font-bold text-base ${currentSong?.id === song.id ? 'text-blue-600' : 'text-gray-800'}`}>{song.title}</h3>
                    <p className="text-gray-400 text-xs">{song.album}</p>
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
        </div>
      </div>

      {/* --- Player View (Now Playing) --- */}
      <div 
        className={`absolute inset-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform overflow-hidden flex flex-col
          ${view === 'player' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-100'}
        `}
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)'
        }}
      >
        {/* Abstract Background Shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Orange Planet */}
          <div className="absolute -top-10 -left-20 w-64 h-64 rounded-full bg-orange-400 opacity-90 blur-sm mix-blend-screen"></div>
          {/* Pink Planet */}
          <div className="absolute top-10 -right-20 w-80 h-80 rounded-full bg-pink-500 opacity-80 blur-sm mix-blend-screen"></div>
           {/* Blue Planet (Big Center) */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-blue-500 opacity-90 blur-sm mix-blend-screen shadow-[0_0_100px_rgba(59,130,246,0.5)]"></div>
          
          {/* Grid lines decoration */}
          <svg className="absolute w-full h-full opacity-10" width="100%" height="100%">
             <line x1="0" y1="30%" x2="100%" y2="40%" stroke="white" strokeWidth="1" />
             <circle cx="50%" cy="45%" r="180" stroke="white" strokeWidth="0.5" fill="none" />
             <circle cx="80%" cy="20%" r="50" stroke="white" strokeWidth="0.5" fill="none" />
          </svg>
        </div>

        {/* Top Controls */}
        <div className="relative z-10 flex justify-between items-center p-6 mt-2">
          <button 
            onClick={() => setView('list')}
            className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white/70 hover:text-white"
          >
            <span className="sr-only">Close</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white/70 hover:text-white">
            <span className="sr-only">Menu</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* Info Card (Glassmorphism) */}
        <div className="relative z-10 mx-6 mt-auto mb-10">
          <div className="backdrop-blur-xl bg-white/10 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            {/* Glossy shine */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

            {/* Song Info */}
            <div className="flex items-center gap-4 mb-8">
               {/* Small spinning disc icon */}
               <div className={`w-10 h-10 rounded-full bg-white/20 flex items-center justify-center ${isPlaying ? 'animate-spin-slow' : ''}`}>
                 <Disc size={20} className="text-white opacity-80" />
               </div>
               <div>
                  <h2 className="text-white text-2xl font-bold tracking-wide">{currentSong?.title}</h2>
                  <p className="text-blue-200 text-sm font-medium tracking-wider uppercase">{currentSong?.artist}</p>
               </div>
            </div>

            {/* Ruler Progress Bar */}
            <div className="relative h-16 w-full mb-6 group">
               {/* Custom Range Input */}
               <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              
              {/* Visual Ruler */}
              <div className="absolute inset-0 flex items-end justify-between px-2 pointer-events-none overflow-hidden">
                 {Array.from({ length: 40 }).map((_, i) => {
                    // Create a wave pattern for the ruler
                    const height = 10 + Math.random() * 20; 
                    const isProgress = (i / 40) * duration < currentTime;
                    return (
                       <div 
                          key={i} 
                          className={`w-[2px] transition-all duration-300 rounded-full ${isProgress ? 'bg-blue-400 h-6 shadow-[0_0_10px_#60a5fa]' : 'bg-white/20 h-3'}`}
                          style={{ height: isProgress ? `${height}px` : '8px' }}
                       ></div>
                    )
                 })}
                 {/* Current Indicator Triangle */}
                 <div 
                   className="absolute bottom-0 w-4 h-4 bg-white transform rotate-45 translate-y-2 shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all duration-100 ease-linear z-10"
                   style={{ left: `${(currentTime / duration) * 100}%`, transform: `translateX(-50%) rotate(45deg)` }}
                 ></div>
              </div>
              
              {/* Time Text */}
              <div className="absolute top-1/2 left-0 right-0 flex justify-between text-[10px] text-white/40 font-mono mt-[-20px] pointer-events-none">
                 <span>{formatTime(currentTime)}</span>
                 <span className="text-white font-bold text-lg drop-shadow-md">{formatTime(currentTime)}</span>
                 <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex justify-between items-center px-2">
              <button className="text-white/60 hover:text-white transition-colors">
                <Repeat size={20} />
              </button>

              <button onClick={prevSong} className="text-white/80 hover:text-white transition-colors">
                <SkipBack size={28} fill="currentColor" className="opacity-50" />
              </button>

              {/* Big Play Button */}
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-105 transition-transform active:scale-95"
              >
                {isPlaying ? (
                  <Pause size={32} fill="#1e1b4b" className="text-[#1e1b4b]" />
                ) : (
                  <Play size={32} fill="#1e1b4b" className="text-[#1e1b4b] ml-1" />
                )}
              </button>

              <button onClick={nextSong} className="text-white/80 hover:text-white transition-colors">
                <SkipForward size={28} fill="currentColor" className="opacity-50" />
              </button>

              <button className="text-white/60 hover:text-red-400 transition-colors">
                <Heart size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);