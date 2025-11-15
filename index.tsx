import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Users, Plus, X, Clock, BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';

export default function BackOnTrack() {
  const [view, setView] = useState('classes');
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studyBuddies, setStudyBuddies] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [myName, setMyName] = useState('');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [studyDuration, setStudyDuration] = useState(25);
  const [activeSession, setActiveSession] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const nameData = await window.storage.get('my-name');
      if (nameData) {
        setMyName(nameData.value);
        setShowNamePrompt(false);
      }

      const classesData = await window.storage.get('my-classes');
      if (classesData) {
        setMyClasses(JSON.parse(classesData.value));
      }
    } catch (err) {
      console.log('No saved data');
    }
  };

  const saveUserName = async (name) => {
    if (!name.trim()) return;
    try {
      await window.storage.set('my-name', name);
      setMyName(name);
      setShowNamePrompt(false);
    } catch (err) {
      console.log('Could not save name');
    }
  };

  const addClass = async () => {
    if (!newClassName.trim()) return;
    const newClass = {
      id: Date.now().toString(),
      name: newClassName,
      addedAt: Date.now()
    };
    const updated = [...myClasses, newClass];
    setMyClasses(updated);
    setNewClassName('');
    
    try {
      await window.storage.set('my-classes', JSON.stringify(updated));
    } catch (err) {
      console.log('Could not save class');
    }
  };

  const removeClass = async (classId) => {
    const updated = myClasses.filter(c => c.id !== classId);
    setMyClasses(updated);
    try {
      await window.storage.set('my-classes', JSON.stringify(updated));
    } catch (err) {
      console.log('Could not update classes');
    }
  };

  const findBuddies = async (classData) => {
    setSelectedClass(classData);
    setView('buddies');
    
    try {
      const result = await window.storage.list(`class:${classData.id}:`, true);
      if (result && result.keys) {
        const buddies = await Promise.all(
          result.keys.map(async (key) => {
            try {
              const data = await window.storage.get(key, true);
              if (!data) return null;
              const buddy = JSON.parse(data.value);
              if (Date.now() - buddy.lastActive > 300000) return null;
              return buddy;
            } catch {
              return null;
            }
          })
        );
        setStudyBuddies(buddies.filter(b => b && b.name !== myName));
      } else {
        setStudyBuddies([]);
      }
    } catch (err) {
      setStudyBuddies([]);
    }
    
    if (myName) {
      const myBuddyData = {
        name: myName,
        status: 'looking',
        duration: studyDuration,
        lastActive: Date.now()
      };
      try {
        await window.storage.set(
          `class:${classData.id}:${myName.replace(/\s/g, '_')}`,
          JSON.stringify(myBuddyData),
          true
        );
      } catch (err) {
        console.log('Could not post availability');
      }
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
      await window.storage.set(
        `class:${selectedClass.id}:${myName.replace(/\s/g, '_')}`,
        JSON.stringify({
          name: myName,
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
    if (isRunning && activeSession && myName) {
      const updateStatus = async () => {
        try {
          await window.storage.set(
            `class:${activeSession.class.id}:${myName.replace(/\s/g, '_')}`,
            JSON.stringify({
              name: myName,
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
  }, [isRunning, activeSession, myName]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const endSession = async () => {
    setIsRunning(false);
    setView('classes');
    setActiveSession(null);
    
    if (selectedClass && myName) {
      try {
        await window.storage.delete(
          `class:${selectedClass.id}:${myName.replace(/\s/g, '_')}`,
          true
        );
      } catch (err) {
        console.log('Could not remove status');
      }
    }
  };

  if (showNamePrompt) {
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
          
          <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
            <label className="block text-sm font-bold text-black mb-3 uppercase tracking-wider">
              Your Name
            </label>
            <input
              type="text"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && saveUserName(myName)}
              placeholder="Enter name"
              className="w-full px-6 py-4 border-4 border-black focus:outline-none focus:ring-0 text-xl font-bold mb-6"
            />
            
            <button
              onClick={() => saveUserName(myName)}
              className="w-full bg-black text-white py-5 font-black text-lg uppercase tracking-wider hover:bg-gray-900 transition-colors border-4 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]"
            >
              Start →
            </button>
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
                    {activeSession.buddy.name}
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
            <p className="text-gray-600 font-bold mb-8 uppercase tracking-wider text-sm">Find classmates studying now</p>
            
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
                        {buddy.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-2xl text-black mb-1 tracking-tight">{buddy.name}</h3>
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
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter">
            BACK ON TRACK
          </h1>
          <div className="w-32 h-1 bg-white mx-auto mb-6"></div>
          <p className="text-gray-400 text-lg font-bold uppercase tracking-wider">Study Buddy Finder</p>
        </div>

        <div className="bg-white border-4 border-white p-8 mb-8 shadow-[12px_12px_0px_0px_rgba(255,255,255,0.1)]">
          <h2 className="text-3xl font-black text-black mb-6 uppercase tracking-tight">Your Classes</h2>
          
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addClass()}
              placeholder="Add class name"
              className="flex-1 px-6 py-4 border-4 border-black focus:outline-none font-bold text-lg"
            />
            <button
              onClick={addClass}
              className="bg-black text-white px-8 py-4 font-black uppercase tracking-wider border-4 border-black hover:bg-gray-900 transition-colors flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </div>

          <div className="space-y-3">
            {myClasses.length > 0 ? (
              myClasses.map(classData => (
                <div key={classData.id} className="flex items-center justify-between p-6 bg-black text-white border-4 border-black">
                  <div className="flex items-center gap-4">
                    <BookOpen className="w-6 h-6" />
                    <span className="font-black text-xl tracking-tight">{classData.name}</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => findBuddies(classData)}
                      className="bg-white text-black px-6 py-3 font-black uppercase tracking-wider border-4 border-white hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <Users className="w-5 h-5" />
                      Find
                    </button>
                    <button
                      onClick={() => removeClass(classData.id)}
                      className="text-white hover:text-gray-400 p-3 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 border-4 border-dashed border-gray-700">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                <p className="text-gray-600 font-bold uppercase tracking-wider">Add classes to get started</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border-4 border-white p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
          <h3 className="font-black text-xl text-black mb-4 uppercase tracking-wider">How It Works</h3>
          <div className="space-y-3">
            <div className="flex gap-4">
              <span className="font-black text-2xl text-black">1</span>
              <p className="text-gray-700 font-bold">Add your classes above</p>
            </div>
            <div className="flex gap-4">
              <span className="font-black text-2xl text-black">2</span>
              <p className="text-gray-700 font-bold">Find classmates looking to study</p>
            </div>
            <div className="flex gap-4">
              <span className="font-black text-2xl text-black">3</span>
              <p className="text-gray-700 font-bold">Set a timer and study together</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}