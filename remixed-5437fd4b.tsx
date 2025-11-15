import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Users, Plus, X, Clock, BookOpen, ChevronRight, ArrowLeft, LogOut, Mail, Copy, Check, Trash2 } from 'lucide-react';

// Storage abstraction layer that works both in Claude.ai and on external deployments
const storage = {
  async get(key, shared = false) {
    // Check if we're in Claude.ai environment
    if (typeof window !== 'undefined' && window.storage) {
      try {
        return await window.storage.get(key, shared);
      } catch (err) {
        return null;
      }
    }
    
    // Fallback to localStorage for external deployments
    const storageKey = shared ? `shared:${key}` : key;
    const value = localStorage.getItem(storageKey);
    return value ? { key, value, shared } : null;
  },

  async set(key, value, shared = false) {
    if (typeof window !== 'undefined' && window.storage) {
      try {
        return await window.storage.set(key, value, shared);
      } catch (err) {
        console.error('Storage set error:', err);
        return null;
      }
    }
    
    const storageKey = shared ? `shared:${key}` : key;
    localStorage.setItem(storageKey, value);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    if (typeof window !== 'undefined' && window.storage) {
      try {
        return await window.storage.delete(key, shared);
      } catch (err) {
        return null;
      }
    }
    
    const storageKey = shared ? `shared:${key}` : key;
    localStorage.removeItem(storageKey);
    return { key, deleted: true, shared };
  },

  async list(prefix = '', shared = false) {
    if (typeof window !== 'undefined' && window.storage) {
      try {
        return await window.storage.list(prefix, shared);
      } catch (err) {
        return { keys: [], prefix, shared };
      }
    }
    
    // Fallback: scan localStorage for matching keys
    const storagePrefix = shared ? `shared:${prefix}` : prefix;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(storagePrefix)) {
        keys.push(shared ? key.replace('shared:', '') : key);
      }
    }
    return { keys, prefix, shared };
  }
};

export default function BackOnTrack() {
  const [view, setView] = useState('auth');
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studyBuddies, setStudyBuddies] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [studyDuration, setStudyDuration] = useState(25);
  const [activeSession, setActiveSession] = useState(null);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await storage.get('current-user');
      if (userData) {
        const user = JSON.parse(userData.value);
        setCurrentUser(user);
        setUsername(user.username);
        loadUserClasses(user.username);
        setView('classes');
      }
    } catch (err) {
      console.log('No active session');
    }
  };

  const register = async () => {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password required');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const existingUser = await storage.get(`user:${username}`, true);
      if (existingUser) {
        setError('Username already exists');
        return;
      }

      const user = {
        username: username,
        passwordHash: btoa(password),
        createdAt: Date.now()
      };

      await storage.set(`user:${username}`, JSON.stringify(user), true);
      await storage.set('current-user', JSON.stringify(user));
      
      setCurrentUser(user);
      setView('classes');
    } catch (err) {
      console.error('Registration error:', err);
      setError(`Registration failed: ${err.message || 'Please try again'}`);
    }
  };

  const login = async () => {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password required');
      return;
    }

    try {
      const userData = await storage.get(`user:${username}`, true);
      if (!userData) {
        setError('Invalid username or password');
        return;
      }

      const user = JSON.parse(userData.value);
      if (user.passwordHash !== btoa(password)) {
        setError('Invalid username or password');
        return;
      }

      await storage.set('current-user', JSON.stringify(user));
      setCurrentUser(user);
      loadUserClasses(username);
      setView('classes');
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await storage.delete('current-user');
      setCurrentUser(null);
      setUsername('');
      setPassword('');
      setMyClasses([]);
      setView('auth');
      setAuthMode('login');
    } catch (err) {
      console.log('Logout error');
    }
  };

  const loadUserClasses = async (user) => {
    try {
      const classesData = await storage.get(`classes:${user}`);
      if (classesData) {
        const classes = JSON.parse(classesData.value);
        // Refresh classroom data from shared storage
        const refreshedClasses = await Promise.all(
          classes.map(async (cls) => {
            try {
              const classroomData = await storage.get(`classroom:${cls.id}`, true);
              return classroomData ? JSON.parse(classroomData.value) : cls;
            } catch {
              return cls;
            }
          })
        );
        setMyClasses(refreshedClasses);
      }
    } catch (err) {
      setMyClasses([]);
    }
  };

  const createClass = async () => {
    if (!newClassName.trim()) return;
    
    const classId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const inviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    
    const newClass = {
      id: classId,
      name: newClassName,
      owner: currentUser.username,
      inviteCode: inviteCode,
      members: [currentUser.username],
      createdAt: Date.now()
    };

    const updated = [...myClasses, newClass];
    setMyClasses(updated);
    setNewClassName('');
    
    try {
      await storage.set(`classes:${currentUser.username}`, JSON.stringify(updated));
      await storage.set(`classroom:${classId}`, JSON.stringify(newClass), true);
      await storage.set(`invite:${inviteCode}`, classId, true);
    } catch (err) {
      setError('Could not create class');
    }
  };

  const joinClassByCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    try {
      const classIdData = await storage.get(`invite:${inviteCode.toUpperCase()}`, true);
      if (!classIdData) {
        setError('Invalid invite code');
        return;
      }

      const classId = classIdData.value;
      const classData = await storage.get(`classroom:${classId}`, true);
      
      if (!classData) {
        setError('Classroom not found');
        return;
      }

      const classroom = JSON.parse(classData.value);
      
      if (classroom.members.includes(currentUser.username)) {
        setError('Already a member of this class');
        return;
      }

      classroom.members.push(currentUser.username);
      await storage.set(`classroom:${classId}`, JSON.stringify(classroom), true);

      const updated = [...myClasses, classroom];
      setMyClasses(updated);
      await storage.set(`classes:${currentUser.username}`, JSON.stringify(updated));

      setInviteCode('');
      setError('');
      alert(`Successfully joined ${classroom.name}!`);
    } catch (err) {
      console.error('Join class error:', err);
      setError('Failed to join class');
    }
  };

  const removeClass = async (classData) => {
    const updated = myClasses.filter(c => c.id !== classData.id);
    setMyClasses(updated);
    
    try {
      await storage.set(`classes:${currentUser.username}`, JSON.stringify(updated));
      
      if (classData.owner === currentUser.username) {
        await storage.delete(`classroom:${classData.id}`, true);
        await storage.delete(`invite:${classData.inviteCode}`, true);
      } else {
        const classroomData = await storage.get(`classroom:${classData.id}`, true);
        if (classroomData) {
          const classroom = JSON.parse(classroomData.value);
          classroom.members = classroom.members.filter(m => m !== currentUser.username);
          await storage.set(`classroom:${classData.id}`, JSON.stringify(classroom), true);
        }
      }
    } catch (err) {
      console.log('Could not update classes');
    }
  };

  const showInviteCode = (classData) => {
    setSelectedClass(classData);
    setShowInviteModal(true);
    setCopiedCode(false);
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(selectedClass.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const findBuddies = async (classData) => {
    setSelectedClass(classData);
    setView('buddies');
    
    try {
      const result = await storage.list(`study:${classData.id}:`, true);
      if (result && result.keys) {
        const buddies = await Promise.all(
          result.keys.map(async (key) => {
            try {
              const data = await storage.get(key, true);
              if (!data) return null;
              const buddy = JSON.parse(data.value);
              if (Date.now() - buddy.lastActive > 300000) return null;
              return buddy;
            } catch {
              return null;
            }
          })
        );
        setStudyBuddies(buddies.filter(b => b && b.username !== currentUser.username));
      } else {
        setStudyBuddies([]);
      }
    } catch (err) {
      setStudyBuddies([]);
    }
    
    const myBuddyData = {
      username: currentUser.username,
      status: 'looking',
      duration: studyDuration,
      lastActive: Date.now()
    };
    
    try {
      await storage.set(
        `study:${classData.id}:${currentUser.username}`,
        JSON.stringify(myBuddyData),
        true
      );
    } catch (err) {
      console.log('Could not post availability');
    }
  };

  const startStudySession = async (buddy) => {
    const session = {
      buddy: buddy,
      class: selectedClass,
      duration: Math.max(buddy.duration, studyDuration)
    };
    setActiveSession(session);
    setTimeLeft(session.duration * 60);
    setView('timer');
    
    try {
      await storage.set(
        `study:${selectedClass.id}:${currentUser.username}`,
        JSON.stringify({
          username: currentUser.username,
          status: 'studying',
          duration: session.duration,
          lastActive: Date.now()
        }),
        true
      );
    } catch (err) {
      console.log('Could not update status');
    }
  };

  const studyAlone = () => {
    const session = {
      buddy: null,
      class: selectedClass,
      duration: studyDuration
    };
    setActiveSession(session);
    setTimeLeft(studyDuration * 60);
    setView('timer');
  };

  useEffect(() => {
    let interval;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (isRunning && activeSession && currentUser) {
      const updateStatus = async () => {
        try {
          await storage.set(
            `study:${activeSession.class.id}:${currentUser.username}`,
            JSON.stringify({
              username: currentUser.username,
              status: 'studying',
              duration: activeSession.duration,
              lastActive: Date.now()
            }),
            true
          );
        } catch (err) {
          console.log('Could not update status');
        }
      };
      
      const interval = setInterval(updateStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isRunning, activeSession, currentUser]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const endSession = async () => {
    setIsRunning(false);
    setView('classes');
    setActiveSession(null);
    
    if (selectedClass && currentUser) {
      try {
        await storage.delete(
          `study:${selectedClass.id}:${currentUser.username}`,
          true
        );
      } catch (err) {
        console.log('Could not remove status');
      }
    }
  };

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-black p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-black text-white mb-3 tracking-tight">
              BACK ON TRACK
            </h1>
            <div className="w-24 h-1 bg-white mx-auto mb-6"></div>
            <p className="text-gray-400 text-lg">Find study buddies. Set timers. Get focused.</p>
          </div>
          
          <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] mb-6">
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => { setAuthMode('login'); setError(''); }}
                className={`flex-1 py-3 font-black uppercase tracking-wider border-4 transition-all ${
                  authMode === 'login'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => { setAuthMode('register'); setError(''); }}
                className={`flex-1 py-3 font-black uppercase tracking-wider border-4 transition-all ${
                  authMode === 'register'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black'
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-100 border-4 border-red-500 text-red-700 font-bold">
                {error}
              </div>
            )}
            
            <label className="block text-sm font-bold text-black mb-3 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-6 py-4 border-4 border-black focus:outline-none focus:ring-0 text-xl font-bold mb-6"
            />

            <label className="block text-sm font-bold text-black mb-3 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (authMode === 'login' ? login() : register())}
              placeholder="Enter password"
              className="w-full px-6 py-4 border-4 border-black focus:outline-none focus:ring-0 text-xl font-bold mb-6"
            />
            
            <button
              onClick={authMode === 'login' ? login : register}
              className="w-full bg-black text-white py-5 font-black text-lg uppercase tracking-wider hover:bg-gray-900 transition-colors border-4 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]"
            >
              {authMode === 'login' ? 'Login' : 'Create Account'} →
            </button>
          </div>

          <div className="text-center text-gray-500 text-sm font-bold">
            {authMode === 'login' ? (
              <p>New user? <button onClick={() => setAuthMode('register')} className="text-white underline">Create an account</button></p>
            ) : (
              <p>Have an account? <button onClick={() => setAuthMode('login')} className="text-white underline">Login here</button></p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'timer') {
    return (
      <div className="min-h-screen bg-black p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-block px-6 py-2 bg-white text-black font-black text-sm uppercase tracking-wider mb-8">
              {selectedClass?.name}
            </div>
            
            {activeSession?.buddy && (
              <div className="mb-8">
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-3">Studying with</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white text-2xl font-black tracking-tight">
                    {activeSession.buddy.username}
                  </span>
                </div>
              </div>
            )}
            
            <div className="text-[120px] md:text-[180px] font-black text-white mb-12 font-mono tracking-tighter leading-none">
              {formatTime(timeLeft)}
            </div>

            <div className="flex justify-center gap-6 mb-12">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="bg-white text-black p-8 hover:bg-gray-200 transition-colors border-4 border-white shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]"
              >
                {isRunning ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10" />}
              </button>
              
              <button
                onClick={() => setTimeLeft(activeSession.duration * 60)}
                className="bg-black text-white p-8 border-4 border-white hover:bg-gray-900 transition-colors"
              >
                <RotateCcw className="w-10 h-10" />
              </button>
            </div>

            <div className="w-full h-4 bg-white/10 mb-12">
              <div
                className="bg-white h-4 transition-all duration-1000"
                style={{ 
                  width: `${((activeSession.duration * 60 - timeLeft) / (activeSession.duration * 60)) * 100}%` 
                }}
              />
            </div>

            <button
              onClick={endSession}
              className="text-gray-500 hover:text-white text-sm font-bold uppercase tracking-wider transition-colors"
            >
              ← End Session
            </button>
          </div>

          {timeLeft === 0 && (
            <div className="text-center p-12 bg-white border-4 border-white shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
              <h3 className="text-4xl font-black text-black mb-3">COMPLETE!</h3>
              <p className="text-gray-600 font-bold">Session finished. Great work.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'buddies') {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setView('classes')}
            className="text-white mb-8 flex items-center gap-2 hover:gap-3 transition-all font-bold uppercase tracking-wider text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="bg-white border-4 border-white p-8 mb-8 shadow-[12px_12px_0px_0px_rgba(255,255,255,0.1)]">
            <h2 className="text-4xl font-black text-black mb-2 tracking-tight">{selectedClass?.name}</h2>
            <p className="text-gray-600 font-bold mb-2 uppercase tracking-wider text-sm">Find classmates studying now</p>
            <p className="text-gray-500 text-sm mb-8">{selectedClass?.members?.length || 0} members</p>
            
            <div className="mb-6">
              <label className="block text-sm font-black text-black mb-4 uppercase tracking-wider">
                Study Duration
              </label>
              <div className="flex gap-3 flex-wrap">
                {[15, 25, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setStudyDuration(mins)}
                    className={`px-8 py-4 font-black text-lg border-4 transition-all ${
                      studyDuration === mins
                        ? 'bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]'
                        : 'bg-white text-black border-black hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {studyBuddies.length > 0 ? (
              studyBuddies.map((buddy, i) => (
                <div key={i} className="bg-white border-4 border-white p-6 hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-black text-white flex items-center justify-center font-black text-3xl border-4 border-black">
                        {buddy.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-black text-2xl text-black mb-1 tracking-tight">{buddy.username}</h3>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-600 font-bold">
                            <Clock className="w-4 h-4" />
                            {buddy.duration} minutes
                          </div>
                          <span className={`px-3 py-1 font-black text-xs uppercase tracking-wider border-2 ${
                            buddy.status === 'studying' 
                              ? 'bg-black text-white border-black'
                              : 'bg-white text-black border-black'
                          }`}>
                            {buddy.status === 'studying' ? 'Studying' : 'Available'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => startStudySession(buddy)}
                      disabled={buddy.status === 'studying'}
                      className={`px-8 py-4 font-black uppercase tracking-wider border-4 transition-all flex items-center gap-2 ${
                        buddy.status === 'studying'
                          ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                          : 'bg-black text-white border-black hover:bg-gray-900 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]'
                      }`}
                    >
                      Join
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border-4 border-white p-16 text-center shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
                <h3 className="text-3xl font-black text-black mb-3">
                  NO ONE HERE YET
                </h3>
                <p className="text-gray-600 font-bold">
                  Start studying and others can join you
                </p>
              </div>
            )}
          </div>

          <button
            onClick={studyAlone}
            className="w-full bg-white text-black py-6 font-black text-xl uppercase tracking-wider border-4 border-white hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] transition-all"
          >
            Study Solo →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter">
              BACK ON TRACK
            </h1>
            <div className="w-32 h-1 bg-white mb-6"></div>
            <p className="text-gray-400 text-lg font-bold uppercase tracking-wider">
              Welcome, {currentUser?.username}
            </p>
          </div>
          <button
            onClick={logout}
            className="bg-white text-black px-6 py-3 font-black uppercase tracking-wider border-4 border-white hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        <div className="bg-white border-4 border-white p-8 mb-8 shadow-[12px_12px_0px_0px_rgba(255,255,255,0.1)]">
          <h2 className="text-3xl font-black text-black mb-6 uppercase tracking-tight">Your Classrooms</h2>
          
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createClass()}
              placeholder="Create new classroom"
              className="flex-1 px-6 py-4 border-4 border-black focus:outline-none font-bold text-lg"
            />
            <button
              onClick={createClass}
              className="bg-black text-white px-8 py-4 font-black uppercase tracking-wider border-4 border-black hover:bg-gray-900 transition-colors flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]"
            >
              <Plus className="w-5 h-5" />
              Create
            </button>
          </div>

          <div className="border-t-4 border-black pt-6 mb-6">
            <label className="block text-sm font-black text-black mb-4 uppercase tracking-wider">
              Join with Invite Code
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && joinClassByCode()}
                placeholder="ENTER CODE"
                className="flex-1 px-6 py-4 border-4 border-black focus:outline-none font-bold text-lg uppercase"
                maxLength={8}
              />
              <button
                onClick={joinClassByCode}
                className="bg-black text-white px-8 py-4 font-black uppercase tracking-wider border-4 border-black hover:bg-gray-900 transition-colors shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]"
              >
                Join
              </button>
            </div>
            {error && error.includes('code') && (
              <p className="mt-3 text-red-600 font-bold text-sm">{error}</p>
            )}
          </div>

          <div className="space-y-3">
            {myClasses.length > 0 ? (
              myClasses.map(classData => (
                <div key={classData.id} className="flex items-center justify-between p-6 bg-black text-white border-4 border-black">
                  <div className="flex items-center gap-4">
                    <BookOpen className="w-6 h-6" />
                    <div>
                      <div className="font-black text-xl tracking-tight">{classData.name}</div>
                      <div className="text-gray-400 text-sm">
                        {classData.owner === currentUser?.username ? 'Owner' : 'Member'} • {classData.members?.length || 0} members
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {classData.owner === currentUser?.username && (
                      <button
                        onClick={() => showInviteCode(classData)}
                        className="bg-white text-black px-6 py-3 font-black uppercase tracking-wider border-4 border-white hover:bg-gray-100 transition-colors flex items-center gap-2"
                      >
                        <Mail className="w-5 h-5" />
                        Invite
                      </button>
                    )}
                    <button
                      onClick={() => findBuddies(classData)}
                      className="bg-white text-black px-6 py-3 font-black uppercase tracking-wider border-4 border-white hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <Users className="w-5 h-5" />
                      Study
                    </button>
                    <button
                      onClick={() => removeClass(classData)}
                      className="text-white hover:text-gray-400 p-3 transition-colors"
                    >
                      {classData.owner === currentUser?.username ? <Trash2 className="w-6 h-6" /> : <X className="w-6 h-6" />}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 border-4 border-dashed border-gray-700">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                <p className="text-gray-600 font-bold uppercase tracking-wider">Create or join a classroom to get started</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border-4 border-white p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
          <h3 className="font-black text-xl text-black mb-4 uppercase tracking-wider">How It Works</h3>
          <div className="space-y-3">
            <div className="flex gap-4">
              <span className="font-black text-2xl text-black">1</span>
              <p className="text-gray-700 font-bold">Create a classroom or join with an invite code</p>
            </div>
            <div className="flex gap-4">
              <span className="font-black text-2xl text-black">2</span>
              <p className="text-gray-700 font-bold">Invite classmates by sharing your classroom code</p>
            </div>
            <div className="flex gap-4">
              <span className="font-black text-2xl text-black">3</span>
              <p className="text-gray-700 font-bold">Find available study buddies in your classroom</p>
            </div>
            <div className="flex gap-4">
              <span className="font-black text-2xl text-black">4</span>
              <p className="text-gray-700 font-bold">Set a timer and study together or solo</p>
            </div>
          </div>
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-white border-4 border-white p-8 max-w-md w-full shadow-[12px_12px_0px_0px_rgba(255,255,255,0.2)]">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-3xl font-black text-black tracking-tight">Invite Code</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-black hover:text-gray-600 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            
            <p className="text-gray-600 font-bold mb-6">
              Share this code with others to invite them to <span className="text-black">{selectedClass?.name}</span>
            </p>
            
            <div className="bg-black border-4 border-black p-8 mb-6 text-center">
              <div className="text-6xl font-black text-white tracking-wider font-mono">
                {selectedClass?.inviteCode}
              </div>
            </div>
            
            <button
              onClick={copyInviteCode}
              className="w-full bg-black text-white py-5 font-black text-lg uppercase tracking-wider border-4 border-black hover:bg-gray-900 transition-colors flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]"
            >
              {copiedCode ? (
                <>
                  <Check className="w-6 h-6" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-6 h-6" />
                  Copy Code
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
