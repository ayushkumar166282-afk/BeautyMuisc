import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, Repeat, 
  ChevronLeft, MoreHorizontal, ListMusic, Plus,
  Disc, Mic2, Music, Download, X, Share, Menu,
  Moon, Activity, Folder
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
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [visualizerEnabled, setVisualizerEnabled] = useState(true);
  const [eqPreset, setEqPreset] = useState('Flat');
  const [showMyUploads, setShowMyUploads] = useState(false);

  // Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter for uploaded songs
  const uploadedSongs = playlist.filter(s => s.artist === 'Local Upload');

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

  // --- MEDIA SESSION API INTEGRATION ---
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    // 1. Set Metadata
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

    // 2. Set Action Handlers
    // Note: We redefine these when playlist/currentSong changes to ensure correct closures for next/prev
    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        // Prev Song Logic
        const idx = playlist.findIndex(s => s.id === currentSong.id);
        const prevIdx = (idx - 1 + playlist.length) % playlist.length;
        setCurrentSong(playlist[prevIdx]);
        setIsPlaying(true);
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
        // Next Song Logic
        const idx = playlist.findIndex(s => s.id === currentSong.id);
        const nextIdx = (idx + 1) % playlist.length;
        setCurrentSong(playlist[nextIdx]);
        setIsPlaying(true);
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            setCurrentTime(details.seekTime);
            // Update position state immediately
            updatePositionState();
        }
    });

  }, [currentSong, playlist]);

  // Update Playback State
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      // Sync position state when playback changes
      updatePositionState();
    }
  }, [isPlaying]);

  const updatePositionState = () => {
    if ('mediaSession' in navigator && audioRef.current && !isNaN(audioRef.current.duration)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: audioRef.current.duration,
                playbackRate: audioRef.current.playbackRate,
                position: audioRef.current.currentTime
            });
        } catch (e) {
            // Ignore errors (e.g. invalid duration)
        }
    }
  };

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
      updatePositionState();
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
      // Play immediately? User choice. Let's not auto-play, just add to library. 
      // But previous logic was auto-play. Let's keep consistency.
      playSong(newSong);

      // Persist to DB
      saveSongToDB(newSong, file);
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden font-sans transition-colors duration-500 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
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

      {/* --- Settings Modal --- */}
      {showSettings && (
        <div className="absolute inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-800'} transition-colors`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className={`p-2 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                <X size={20}/>
              </button>
            </div>
            
            {/* Dark Mode Toggle */}
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
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Visualizer Toggle */}
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
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${visualizerEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* EQ Presets */}
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
             {/* Header */}
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h2 className="text-2xl font-bold">My Uploads</h2>
                   <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{uploadedSongs.length} local tracks</p>
                </div>
                <button 
                  onClick={() => setShowMyUploads(false)}
                  className={`p-2 rounded-full ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <X size={20} />
                </button>
             </div>

             {/* List */}
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
                        currentSong?.id === song.id 
                           ? (darkMode ? 'bg-purple-500/20' : 'bg-purple-50') 
                           : (darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')
                      }`}
                    >
                       <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${song.color || 'bg-purple-500'}`}>
                          {currentSong?.id === song.id && isPlaying ? <Activity size={18} className="animate-pulse"/> : <Music size={18} />}
                       </div>
                       <div className="ml-3 flex-1 overflow-hidden">
                          <h4 className={`font-bold truncate ${currentSong?.id === song.id ? 'text-purple-500' : ''}`}>{song.title}</h4>
                          <p className="text-xs opacity-60 truncate">{song.album}</p>
                       </div>
                       {currentSong?.id === song.id && (
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                       )}
                    </div>
                 ))
               )}
             </div>

             {/* Bottom Action Hint */}
             {uploadedSongs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200/10 text-center">
                   <button 
                     onClick={() => {
                        if(uploadedSongs.length > 0) playSong(uploadedSongs[0]);
                     }}
                     className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                   >
                      <Play size={18} fill="white" /> Play All
                   </button>
                </div>
             )}
           </div>
        </div>
      )}

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
        className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${darkMode ? 'bg-slate-900' : 'bg-gray-50'} will-change-transform ${view === 'player' ? 'scale-90 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        {/* Header Image */}
        <div className="relative h-[45%] w-full overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1471958680802-1345a694ba6d?q=80&w=1000&auto=format&fit=crop" 
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
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white"
            >
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
        <div className={`relative -mt-8 rounded-t-[3rem] h-[60%] px-6 pt-10 pb-32 overflow-y-auto no-scrollbar z-10 transition-colors ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
          
          {/* Albums Section */}
          <div className="mb-8">
            <h2 className={`font-bold mb-4 ml-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Albums</h2>
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

               {/* My Uploads Album Card */}
               <div 
                  onClick={() => setShowMyUploads(true)}
                  className="flex-shrink-0 w-36 h-40 bg-purple-500 rounded-2xl p-4 flex flex-col justify-end shadow-lg shadow-purple-200 relative overflow-hidden cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
                  <Folder className="text-white mb-auto opacity-80" size={24} />
                  <p className="text-white font-bold text-lg leading-tight">My Files</p>
                  <p className="text-purple-200 text-xs mt-1">{uploadedSongs.length} Songs</p>
               </div>

               {/* Upload Card */}
               <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-shrink-0 w-36 h-40 border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-gray-100 border-gray-300'}`}
                >
                  <Plus className={darkMode ? 'text-slate-500' : 'text-gray-400 mb-2'} size={32} />
                  <p className={`font-medium text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Upload</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
               </div>
            </div>
          </div>

          {/* Songs List */}
          <div>
            <h2 className={`font-bold mb-4 ml-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Songs</h2>
            <div className="space-y-4">
              {playlist.map((song) => (
                <div 
                  key={song.id} 
                  onClick={() => playSong(song)}
                  className={`flex items-center p-3 rounded-2xl transition-colors ${
                    currentSong?.id === song.id 
                      ? (darkMode ? 'bg-blue-900/30' : 'bg-blue-50') 
                      : (darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${song.color || 'bg-gray-400'}`}>
                    {currentSong?.id === song.id && isPlaying ? (
                       <ListMusic size={20} className="animate-pulse" />
                    ) : (
                       <Music size={20} />
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className={`font-bold text-base ${
                      currentSong?.id === song.id 
                        ? 'text-blue-500' 
                        : (darkMode ? 'text-gray-100' : 'text-gray-800')
                    }`}>{song.title}</h3>
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
        </div>
      </div>

      {/* --- Mini Player --- */}
      {currentSong && (
         <div 
            onClick={() => setView('player')}
            className={`absolute bottom-4 left-4 right-4 z-40 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-2 flex items-center cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform 
              ${view === 'list' ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}
              ${darkMode ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white/80 border-white/40'}
            `}
         >
            {/* Spinning Art */}
            <div className={`w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border-2 ${darkMode ? 'border-slate-600' : 'border-white'} relative`}>
               <img 
                 src={currentSong.cover} 
                 alt={currentSong.title}
                 className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
               />
               {/* Center hole for vinyl look */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-black rounded-full border border-white/20"></div>
            </div>

            {/* Info */}
            <div className="flex-1 ml-3 min-w-0 flex flex-col justify-center">
               <h4 className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{currentSong.title}</h4>
               <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentSong.artist}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 mr-2">
               {/* Heart (Optional, just visual) */}
               {/* <button className="p-2 text-gray-400 hover:text-red-500"><Heart size={18} /></button> */}
               
               <button 
                  onClick={(e) => {
                     e.stopPropagation();
                     setIsPlaying(!isPlaying);
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 ${darkMode ? 'bg-white text-slate-900' : 'bg-black text-white'}`}
               >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
               </button>
            </div>
            
            {/* Progress Bar (Bottom Line) */}
            <div 
               className="absolute bottom-0 left-4 right-4 h-[2px] bg-gray-200/20 rounded-full overflow-hidden"
            >
               <div 
                  className={`h-full ${darkMode ? 'bg-indigo-400' : 'bg-blue-500'}`}
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
               ></div>
            </div>
         </div>
      )}

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
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white/70 hover:text-white"
          >
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
                    // Visualizer Logic
                    let barHeight = 0;
                    if (visualizerEnabled && isPlaying) {
                       const baseNoise = Math.random() * 20;
                       // Modify visualizer based on preset
                       if (eqPreset === 'Bass Boost') {
                          // Boost lower freq (left side)
                          if (i < 15) barHeight = 15 + Math.random() * 30;
                          else barHeight = 10 + baseNoise;
                       } else if (eqPreset === 'Treble') {
                          // Boost high freq (right side)
                          if (i > 25) barHeight = 15 + Math.random() * 30;
                          else barHeight = 10 + baseNoise;
                       } else if (eqPreset === 'Vocal') {
                          // Boost mid freq
                          if (i > 10 && i < 30) barHeight = 15 + Math.random() * 30;
                          else barHeight = 10 + baseNoise;
                       } else {
                          // Flat
                          barHeight = 10 + baseNoise;
                       }
                    } else {
                       // Idle state or Disabled
                       barHeight = visualizerEnabled ? 8 + Math.random() * 4 : 8;
                    }
                    
                    const height = barHeight;
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