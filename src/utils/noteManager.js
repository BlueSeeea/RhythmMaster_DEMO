import gameDataManager from './gameDataManager';

/**
 * 音符管理器
 * 负责生成和管理游戏中的音符数据
 */
class NoteManager {
  constructor() {
    this.notes = [];          // 当前音符列表
    this.noteSpeed = 100;     // 音符下落速度
    this.noteSize = 40;       // 音符大小
    this.trackCount = 4;      // 轨道数量
    this.noteSpawnRate = 0.5; // 音符生成速率
    this.laneWidth = 80;      // 轨道宽度
    this.currentTime = 0;     // 当前游戏时间
    this.difficulty = 'normal'; // 难度级别
    
    // 同步游戏数据管理器的配置
    this.syncWithGameConfig();
  }
  
  // 与游戏配置同步
  syncWithGameConfig() {
    const config = gameDataManager.getSettings();
    this.trackCount = config?.trackCount || this.trackCount;
    this.noteSpeed = config?.noteSpeed || this.noteSpeed;
  }

  /**
   * 初始化音符管理器
   * @param {object} config - 配置参数
   */
  init(config = {}) {
    // 先同步最新配置
    this.syncWithGameConfig();
    
    this.noteSpeed = config.noteSpeed || this.noteSpeed;
    this.noteSize = config.noteSize || this.noteSize;
    this.trackCount = config.trackCount || this.trackCount;
    this.laneWidth = config.laneWidth || this.laneWidth;
    this.difficulty = config.difficulty || this.difficulty;
    
    // 根据难度调整参数
    this._adjustForDifficulty();
    
    this.clearNotes();
    this.currentTime = 0;
    
    // 保存当前配置到游戏数据管理器
    gameDataManager.updateSettings({
      noteSpeed: this.noteSpeed,
      trackCount: this.trackCount
    });
  }

  /**
   * 根据难度调整参数
   */
  _adjustForDifficulty() {
    const gameSettings = gameDataManager.getSettings() || {};
    
    switch (this.difficulty) {
      case 'easy':
        this.noteSpeed = gameSettings.noteSpeed || 60; // 降低速度
        this.noteSpawnRate = 0.2; // 降低生成率
        this.trackCount = gameSettings.trackCount || 3;
        break;
      case 'normal':
        this.noteSpeed = gameSettings.noteSpeed || 80; // 降低速度
        this.noteSpawnRate = 0.35; // 降低生成率
        this.trackCount = gameSettings.trackCount || 4;
        break;
      case 'hard':
        this.noteSpeed = gameSettings.noteSpeed || 100; // 降低速度
        this.noteSpawnRate = 0.5; // 降低生成率
        this.trackCount = gameSettings.trackCount || 4; // 减少轨道数量
        break;
      case 'expert':
        this.noteSpeed = gameSettings.noteSpeed || 120; // 降低速度
        this.noteSpawnRate = 0.7; // 降低生成率
        this.trackCount = gameSettings.trackCount || 5; // 减少轨道数量
        break;
      default:
        break;
    }
  }

  /**
   * 更新音符状态
   * @param {number} deltaTime - 时间增量
   * @param {number} canvasHeight - 画布高度
   */
  update(deltaTime, canvasHeight) {
    this.currentTime += deltaTime;
    
    // 更新所有音符位置
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      note.y += this.noteSpeed * deltaTime;
      
      // 移除超出屏幕的音符
      if (note.y > canvasHeight + this.noteSize) {
        this.notes.splice(i, 1);
        i--;
      }
    }
  }

  /**
   * 生成随机音符
   * @param {number} canvasWidth - 画布宽度
   */
  spawnRandomNote(canvasWidth) {
    if (Math.random() < this.noteSpawnRate) {
      const lane = Math.floor(Math.random() * this.trackCount);
      const x = (lane * this.laneWidth) + (this.laneWidth - this.noteSize) / 2;
      
      const note = {
        id: Date.now() + Math.random(), // 唯一ID
        lane: lane,
        x: x,
        y: -this.noteSize,
        size: this.noteSize,
        hit: false,
        hitTime: null
      };
      
      this.notes.push(note);
      return note;
    }
    return null;
  }

  /**
   * 生成指定轨道的音符
   * @param {number} lane - 轨道索引
   * @param {number} canvasWidth - 画布宽度
   */
  spawnNoteAtLane(lane, canvasWidth) {
    if (lane < 0 || lane >= this.trackCount) {
      return null;
    }
    
    const x = (lane * this.laneWidth) + (this.laneWidth - this.noteSize) / 2;
    
    const note = {
      id: Date.now() + Math.random(),
      lane: lane,
      x: x,
      y: -this.noteSize,
      size: this.noteSize,
      hit: false,
      hitTime: null
    };
    
    this.notes.push(note);
    return note;
  }

  /**
   * 从歌曲数据生成音符序列
   * @param {object} songData - 歌曲数据
   * @param {number} canvasWidth - 画布宽度
   */
  generateNotesFromSong(songData, canvasWidth) {
    this.clearNotes();
    
    if (!songData || !songData.notes) {
      return;
    }
    
    songData.notes.forEach(noteData => {
      const lane = noteData.lane;
      if (lane < 0 || lane >= this.trackCount) {
        return;
      }
      
      const x = (lane * this.laneWidth) + (this.laneWidth - this.noteSize) / 2;
      
      const note = {
        id: noteData.id || Date.now() + Math.random(),
        lane: lane,
        x: x,
        y: -this.noteSize,
        size: this.noteSize,
        hit: false,
        hitTime: null,
        startTime: noteData.time, // 音符应该出现的时间
        holdDuration: noteData.duration || 0 // 长按音符的持续时间
      };
      
      this.notes.push(note);
    });
  }

  /**
   * 检测是否有音符可以被击中
   * @param {number} lane - 轨道索引
   * @param {number} hitY - 判定线Y坐标
   * @param {number} hitWindow - 判定窗口大小
   */
  checkHit(lane, hitY, hitWindow = 50) {
    const validNotes = this.notes.filter(note => 
      !note.hit && note.lane === lane && 
      Math.abs(note.y - hitY) < hitWindow
    );
    
    if (validNotes.length === 0) {
      return null;
    }
    
    // 找到最接近判定线的音符
    validNotes.sort((a, b) => Math.abs(a.y - hitY) - Math.abs(b.y - hitY));
    const targetNote = validNotes[0];
    targetNote.hit = true;
    targetNote.hitTime = this.currentTime;
    
    // 计算命中精度
    const distance = Math.abs(targetNote.y - hitY);
    let accuracy;
    
    if (distance < hitWindow * 0.2) {
      accuracy = 'perfect';
    } else if (distance < hitWindow * 0.4) {
      accuracy = 'great';
    } else if (distance < hitWindow * 0.6) {
      accuracy = 'good';
    } else {
      accuracy = 'miss';
    }
    
    return {
      note: targetNote,
      accuracy: accuracy,
      distance: distance
    };
  }

  /**
   * 清除所有音符
   */
  clearNotes() {
    this.notes = [];
  }

  /**
   * 获取当前音符列表
   */
  getNotes() {
    return this.notes;
  }

  /**
   * 获取指定轨道上的音符
   * @param {number} lane - 轨道索引
   */
  getNotesByLane(lane) {
    return this.notes.filter(note => note.lane === lane && !note.hit);
  }

  /**
   * 设置音符速度
   * @param {number} speed - 新的速度值
   */
  setNoteSpeed(speed) {
    this.noteSpeed = Math.max(50, Math.min(200, speed));
  }

  /**
   * 设置音符大小
   * @param {number} size - 新的大小值
   */
  setNoteSize(size) {
    this.noteSize = Math.max(20, Math.min(100, size));
    // 更新现有音符的大小
    this.notes.forEach(note => {
      note.size = this.noteSize;
    });
  }

  /**
   * 设置轨道数量
   * @param {number} count - 轨道数量
   */
  setTrackCount(count) {
    this.trackCount = Math.max(3, Math.min(8, count));
  }

  /**
   * 设置难度
   * @param {string} difficulty - 难度级别
   */
  setDifficulty(difficulty) {
    const validDifficulties = ['easy', 'normal', 'hard', 'expert'];
    if (validDifficulties.includes(difficulty)) {
      this.difficulty = difficulty;
      this._adjustForDifficulty();
    }
  }
}

// 导出单例实例
export default new NoteManager();