/**
 * 音频管理器
 * 负责处理游戏中的背景音乐和音效播放
 */
class AudioManager {
  constructor() {
    this.bgm = null;          // 背景音乐元素
    this.soundEffects = {};   // 音效集合
    this.volume = {
      bgm: 0.7,              // 背景音乐音量
      sfx: 0.9               // 音效音量
    };
    this.isMuted = {
      bgm: false,            // 背景音乐是否静音
      sfx: false             // 音效是否静音
    };
  }

  /**
   * 设置背景音乐
   * @param {string} src - 音频文件路径
   */
  setBGM(src) {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }

    this.bgm = new Audio(src);
    this.bgm.loop = true;
    this.bgm.volume = this.isMuted.bgm ? 0 : this.volume.bgm;
    return this.bgm;
  }

  /**
   * 播放背景音乐
   */
  playBGM() {
    if (this.bgm && this.bgm.paused) {
      this.bgm.play().catch(error => {
        console.warn('背景音乐播放失败:', error);
      });
    }
  }

  /**
   * 暂停背景音乐
   */
  pauseBGM() {
    if (this.bgm && !this.bgm.paused) {
      this.bgm.pause();
    }
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }
  }

  /**
   * 加载音效
   * @param {string} name - 音效名称
   * @param {string} src - 音频文件路径
   */
  loadSoundEffect(name, src) {
    const sound = new Audio(src);
    sound.volume = this.isMuted.sfx ? 0 : this.volume.sfx;
    this.soundEffects[name] = sound;
    return sound;
  }

  /**
   * 播放音效
   * @param {string} name - 音效名称
   * @param {boolean} loop - 是否循环播放
   */
  playSoundEffect(name, loop = false) {
    if (!this.soundEffects[name]) {
      console.warn(`音效 ${name} 未加载`);
      return;
    }

    // 克隆音频元素以允许多次同时播放
    const sound = this.soundEffects[name].cloneNode(true);
    sound.loop = loop;
    sound.volume = this.isMuted.sfx ? 0 : this.volume.sfx;
    sound.play().catch(error => {
      console.warn(`音效 ${name} 播放失败:`, error);
    });
    
    // 清理播放完成的音效
    sound.addEventListener('ended', () => {
      sound.remove();
    });
    
    return sound;
  }

  /**
   * 设置背景音乐音量
   * @param {number} volume - 音量值 (0-1)
   */
  setBGMVolume(volume) {
    this.volume.bgm = Math.max(0, Math.min(1, volume));
    if (this.bgm) {
      this.bgm.volume = this.isMuted.bgm ? 0 : this.volume.bgm;
    }
  }

  /**
   * 设置音效音量
   * @param {number} volume - 音量值 (0-1)
   */
  setSFXVolume(volume) {
    this.volume.sfx = Math.max(0, Math.min(1, volume));
    // 更新所有音效的音量
    for (const key in this.soundEffects) {
      this.soundEffects[key].volume = this.isMuted.sfx ? 0 : this.volume.sfx;
    }
  }

  /**
   * 切换背景音乐静音状态
   * @returns {boolean} - 当前静音状态
   */
  toggleBGMMute() {
    this.isMuted.bgm = !this.isMuted.bgm;
    if (this.bgm) {
      this.bgm.volume = this.isMuted.bgm ? 0 : this.volume.bgm;
    }
    return this.isMuted.bgm;
  }

  /**
   * 切换音效静音状态
   * @returns {boolean} - 当前静音状态
   */
  toggleSFXMute() {
    this.isMuted.sfx = !this.isMuted.sfx;
    const currentVolume = this.isMuted.sfx ? 0 : this.volume.sfx;
    // 更新所有音效的音量
    for (const key in this.soundEffects) {
      this.soundEffects[key].volume = currentVolume;
    }
    return this.isMuted.sfx;
  }

  /**
   * 获取当前设置
   * @returns {object} - 音量和静音设置
   */
  getSettings() {
    return {
      volume: { ...this.volume },
      isMuted: { ...this.isMuted }
    };
  }

  /**
   * 应用设置
   * @param {object} settings - 要应用的设置
   */
  applySettings(settings) {
    if (settings.volume) {
      if (typeof settings.volume.bgm === 'number') {
        this.setBGMVolume(settings.volume.bgm);
      }
      if (typeof settings.volume.sfx === 'number') {
        this.setSFXVolume(settings.volume.sfx);
      }
    }
    
    if (settings.isMuted) {
      if (typeof settings.isMuted.bgm === 'boolean' && this.isMuted.bgm !== settings.isMuted.bgm) {
        this.toggleBGMMute();
      }
      if (typeof settings.isMuted.sfx === 'boolean' && this.isMuted.sfx !== settings.isMuted.sfx) {
        this.toggleSFXMute();
      }
    }
  }
}

// 导出单例实例
export default new AudioManager();