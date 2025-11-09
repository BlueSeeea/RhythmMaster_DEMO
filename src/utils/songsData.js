/**
 * 歌曲数据
 * 提供游戏中使用的歌曲列表和音符数据
 */

// 模拟歌曲数据
export const songs = [
  {
    id: 'song1',
    title: '电子节拍',
    artist: '节奏大师',
    duration: 120, // 秒
    bpm: 120,
    coverUrl: 'https://via.placeholder.com/200?text=Electronic+Beat',
    audioUrl: '', // 实际项目中需要提供真实的音频文件URL
    description: '一首充满活力的电子音乐，适合初学者',
    difficulty: {
      easy: true,
      normal: true,
      hard: false,
      expert: false
    },
    // 音符数据会根据难度动态生成或单独存储
    notes: {
      easy: generateEasyNotes(120, 3),
      normal: generateNormalNotes(120, 4),
      hard: null,
      expert: null
    }
  },
  {
    id: 'song2',
    title: '摇滚之旅',
    artist: '节奏大师',
    duration: 150,
    bpm: 140,
    coverUrl: 'https://via.placeholder.com/200?text=Rock+Journey',
    audioUrl: '',
    description: '激情四射的摇滚歌曲，适合中级玩家',
    difficulty: {
      easy: true,
      normal: true,
      hard: true,
      expert: false
    },
    notes: {
      easy: generateEasyNotes(150, 3),
      normal: generateNormalNotes(150, 4),
      hard: generateHardNotes(150, 5),
      expert: null
    }
  },
  {
    id: 'song3',
    title: '爵士风情',
    artist: '节奏大师',
    duration: 180,
    bpm: 100,
    coverUrl: 'https://via.placeholder.com/200?text=Jazz+Mood',
    audioUrl: '',
    description: '优雅的爵士乐，考验节奏感',
    difficulty: {
      easy: false,
      normal: true,
      hard: true,
      expert: true
    },
    notes: {
      easy: null,
      normal: generateNormalNotes(180, 4),
      hard: generateHardNotes(180, 5),
      expert: generateExpertNotes(180, 6)
    }
  },
  {
    id: 'song4',
    title: '古典韵律',
    artist: '节奏大师',
    duration: 200,
    bpm: 90,
    coverUrl: 'https://via.placeholder.com/200?text=Classic+Rhythm',
    audioUrl: '',
    description: '经典古典音乐改编，节奏明快',
    difficulty: {
      easy: true,
      normal: true,
      hard: true,
      expert: true
    },
    notes: {
      easy: generateEasyNotes(200, 3),
      normal: generateNormalNotes(200, 4),
      hard: generateHardNotes(200, 5),
      expert: generateExpertNotes(200, 6)
    }
  },
  {
    id: 'song5',
    title: '未来科技',
    artist: '节奏大师',
    duration: 160,
    bpm: 160,
    coverUrl: 'https://via.placeholder.com/200?text=Future+Tech',
    audioUrl: '',
    description: '高bpm电子音乐，挑战极限反应',
    difficulty: {
      easy: false,
      normal: false,
      hard: true,
      expert: true
    },
    notes: {
      easy: null,
      normal: null,
      hard: generateHardNotes(160, 5),
      expert: generateExpertNotes(160, 6)
    }
  }
];

/**
 * 生成简单难度的音符数据
 * @param {number} duration - 歌曲时长（秒）
 * @param {number} trackCount - 轨道数量
 */
function generateEasyNotes(duration, trackCount) {
  const notes = [];
  const noteCount = Math.floor(duration * 0.5); // 每2秒一个音符
  
  for (let i = 0; i < noteCount; i++) {
    notes.push({
      id: `note_easy_${i}`,
      lane: Math.floor(Math.random() * trackCount),
      time: i * 2, // 每隔2秒
      duration: 0 // 普通音符
    });
  }
  
  return notes;
}

/**
 * 生成普通难度的音符数据
 * @param {number} duration - 歌曲时长（秒）
 * @param {number} trackCount - 轨道数量
 */
function generateNormalNotes(duration, trackCount) {
  const notes = [];
  const noteCount = Math.floor(duration * 0.8); // 平均每1.25秒一个音符
  
  for (let i = 0; i < noteCount; i++) {
    const isHoldNote = Math.random() < 0.1; // 10%概率是长按音符
    notes.push({
      id: `note_normal_${i}`,
      lane: Math.floor(Math.random() * trackCount),
      time: i * 1.25 + (Math.random() * 0.5), // 加入一些随机性
      duration: isHoldNote ? 1 + Math.random() * 2 : 0
    });
  }
  
  return notes;
}

/**
 * 生成困难难度的音符数据
 * @param {number} duration - 歌曲时长（秒）
 * @param {number} trackCount - 轨道数量
 */
function generateHardNotes(duration, trackCount) {
  const notes = [];
  const noteCount = Math.floor(duration * 1.5); // 平均每0.67秒一个音符
  
  for (let i = 0; i < noteCount; i++) {
    const isHoldNote = Math.random() < 0.15; // 15%概率是长按音符
    notes.push({
      id: `note_hard_${i}`,
      lane: Math.floor(Math.random() * trackCount),
      time: i * 0.67 + (Math.random() * 0.3),
      duration: isHoldNote ? 0.5 + Math.random() * 1.5 : 0
    });
  }
  
  // 添加一些连续的音符组合
  addNotePatterns(notes, trackCount, duration);
  
  return notes.sort((a, b) => a.time - b.time);
}

/**
 * 生成专家难度的音符数据
 * @param {number} duration - 歌曲时长（秒）
 * @param {number} trackCount - 轨道数量
 */
function generateExpertNotes(duration, trackCount) {
  const notes = [];
  const noteCount = Math.floor(duration * 2.5); // 平均每0.4秒一个音符
  
  for (let i = 0; i < noteCount; i++) {
    const isHoldNote = Math.random() < 0.2; // 20%概率是长按音符
    notes.push({
      id: `note_expert_${i}`,
      lane: Math.floor(Math.random() * trackCount),
      time: i * 0.4 + (Math.random() * 0.2),
      duration: isHoldNote ? 0.3 + Math.random() * 1 : 0
    });
  }
  
  // 添加更多复杂的音符组合
  addNotePatterns(notes, trackCount, duration, true);
  
  return notes.sort((a, b) => a.time - b.time);
}

/**
 * 添加音符组合模式
 * @param {Array} notes - 音符数组
 * @param {number} trackCount - 轨道数量
 * @param {number} duration - 歌曲时长
 * @param {boolean} isExpert - 是否为专家模式
 */
function addNotePatterns(notes, trackCount, duration, isExpert = false) {
  const patternCount = isExpert ? 8 : 5;
  
  for (let i = 0; i < patternCount; i++) {
    const startTime = Math.random() * (duration - 10);
    const patternType = Math.floor(Math.random() * 3);
    
    switch (patternType) {
      case 0: // 左右交替
        for (let j = 0; j < (isExpert ? 8 : 5); j++) {
          const lane = j % 2;
          notes.push({
            id: `pattern_alternate_${i}_${j}`,
            lane: lane,
            time: startTime + j * 0.2,
            duration: 0
          });
        }
        break;
      case 1: // 阶梯式
        for (let j = 0; j < trackCount; j++) {
          notes.push({
            id: `pattern_stair_${i}_${j}`,
            lane: j,
            time: startTime + j * 0.15,
            duration: 0
          });
        }
        break;
      case 2: // 随机分布密集音符
        for (let j = 0; j < (isExpert ? 10 : 6); j++) {
          notes.push({
            id: `pattern_dense_${i}_${j}`,
            lane: Math.floor(Math.random() * trackCount),
            time: startTime + j * 0.12,
            duration: 0
          });
        }
        break;
    }
  }
}

/**
 * 根据ID获取歌曲
 * @param {string} songId - 歌曲ID
 */
export function getSongById(songId) {
  return songs.find(song => song.id === songId);
}

/**
 * 获取指定难度的歌曲列表
 * @param {string} difficulty - 难度级别
 */
export function getSongsByDifficulty(difficulty) {
  return songs.filter(song => song.difficulty[difficulty]);
}

/**
 * 获取随机歌曲
 */
export function getRandomSong() {
  const randomIndex = Math.floor(Math.random() * songs.length);
  return songs[randomIndex];
}

/**
 * 搜索歌曲
 * @param {string} query - 搜索关键词
 */
export function searchSongs(query) {
  const lowercaseQuery = query.toLowerCase();
  return songs.filter(song => 
    song.title.toLowerCase().includes(lowercaseQuery) ||
    song.artist.toLowerCase().includes(lowercaseQuery) ||
    song.description.toLowerCase().includes(lowercaseQuery)
  );
}