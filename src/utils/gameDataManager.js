/**
 * 游戏数据管理器
 * 负责存储和管理游戏配置、高分记录等数据
 */
class GameDataManager {
  constructor() {
    this.storageKey = 'rhythm_master_data';
    this.defaultSettings = {
      audio: {
        bgmEnabled: true,
        sfxEnabled: true,
        bgmVolume: 0.7,
        sfxVolume: 0.9
      },
      gameplay: {
        noteSpeed: 100,
        noteSize: 40,
        trackCount: 4,
        hitWindow: 50
      },
      display: {
        fullscreen: false,
        theme: 'default'
      },
      difficulty: 'normal'
    };
    this.loadData();
  }

  /**
   * 从localStorage加载数据
   */
  loadData() {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (storedData) {
        const data = JSON.parse(storedData);
        this.settings = data.settings || { ...this.defaultSettings };
        this.highScores = data.highScores || {};
        this.stats = data.stats || this._getDefaultStats();
      } else {
        this.resetData();
      }
    } catch (error) {
      console.warn('加载游戏数据失败:', error);
      this.resetData();
    }
  }

  /**
   * 保存数据到localStorage
   */
  saveData() {
    try {
      const data = {
        settings: this.settings,
        highScores: this.highScores,
        stats: this.stats,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn('保存游戏数据失败:', error);
      return false;
    }
  }

  /**
   * 重置所有数据到默认值
   */
  resetData() {
    this.settings = { ...this.defaultSettings };
    this.highScores = {};
    this.stats = this._getDefaultStats();
    this.saveData();
  }

  /**
   * 获取默认统计数据
   */
  _getDefaultStats() {
    return {
      totalGames: 0,
      totalNotesHit: 0,
      totalNotesMissed: 0,
      totalScore: 0,
      maxComboEver: 0,
      favoriteSong: null,
      favoriteDifficulty: null,
      playTime: 0, // 单位：秒
      lastPlayed: null
    };
  }

  /**
   * 获取设置
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * 更新设置
   * @param {object} newSettings - 新的设置对象
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // 合并嵌套设置
    if (newSettings.audio) {
      this.settings.audio = { ...this.settings.audio, ...newSettings.audio };
    }
    if (newSettings.gameplay) {
      this.settings.gameplay = { ...this.settings.gameplay, ...newSettings.gameplay };
    }
    if (newSettings.display) {
      this.settings.display = { ...this.settings.display, ...newSettings.display };
    }
    
    return this.saveData();
  }

  /**
   * 获取指定歌曲和难度的最高分
   * @param {string} songId - 歌曲ID
   * @param {string} difficulty - 难度级别
   */
  getHighScore(songId, difficulty) {
    const key = `${songId}_${difficulty}`;
    return this.highScores[key] || 0;
  }

  /**
   * 更新最高分
   * @param {string} songId - 歌曲ID
   * @param {string} difficulty - 难度级别
   * @param {number} score - 新分数
   */
  updateHighScore(songId, difficulty, score) {
    const key = `${songId}_${difficulty}`;
    const currentHigh = this.highScores[key] || 0;
    
    if (score > currentHigh) {
      this.highScores[key] = score;
      this.saveData();
      return true;
    }
    return false;
  }

  /**
   * 获取所有高分记录
   */
  getAllHighScores() {
    return { ...this.highScores };
  }

  /**
   * 清除指定歌曲的高分记录
   * @param {string} songId - 歌曲ID
   */
  clearHighScoresForSong(songId) {
    Object.keys(this.highScores).forEach(key => {
      if (key.startsWith(songId + '_')) {
        delete this.highScores[key];
      }
    });
    this.saveData();
  }

  /**
   * 清除所有高分记录
   */
  clearAllHighScores() {
    this.highScores = {};
    this.saveData();
  }

  /**
   * 更新游戏统计数据
   * @param {object} gameStats - 游戏统计数据
   */
  updateGameStats(gameStats) {
    if (!gameStats) return;
    
    this.stats.totalGames += 1;
    
    if (gameStats.totalNotes) {
      this.stats.totalNotesHit += gameStats.hitNotes || 0;
      this.stats.totalNotesMissed += gameStats.missCount || 0;
    }
    
    if (gameStats.score) {
      this.stats.totalScore += gameStats.score;
    }
    
    if (gameStats.maxCombo && gameStats.maxCombo > this.stats.maxComboEver) {
      this.stats.maxComboEver = gameStats.maxCombo;
    }
    
    if (gameStats.songId) {
      this.stats.favoriteSong = gameStats.songId;
    }
    
    if (gameStats.difficulty) {
      this.stats.favoriteDifficulty = gameStats.difficulty;
    }
    
    if (gameStats.playTime) {
      this.stats.playTime += gameStats.playTime;
    }
    
    this.stats.lastPlayed = new Date().toISOString();
    
    this.saveData();
  }

  /**
   * 获取统计数据
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 导出游戏数据
   */
  exportData() {
    const exportData = {
      settings: this.settings,
      highScores: this.highScores,
      stats: this.stats,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入游戏数据
   * @param {string} jsonData - JSON格式的数据字符串
   */
  importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.settings) {
        this.settings = data.settings;
      }
      
      if (data.highScores) {
        this.highScores = data.highScores;
      }
      
      if (data.stats) {
        this.stats = data.stats;
      }
      
      this.saveData();
      return true;
    } catch (error) {
      console.warn('导入游戏数据失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export default new GameDataManager();