/**
 * 终端旋转器（Spinner）
 *
 * 在等待 LLM 响应时显示一个动画旋转指示器，给用户视觉反馈。
 * 使用盲文字符（Braille）序列制作旋转动画，每 80ms 切换一帧。
 *
 * 动画帧：⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
 */

/** 旋转动画帧序列（10 个盲文字符构成完整旋转周期） */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** 帧切换间隔（毫秒） */
const INTERVAL = 80;

export class Spinner {
  /** 当前帧索引 */
  private frameIndex = 0;
  /** setInterval 定时器句柄 */
  private timer: ReturnType<typeof setInterval> | null = null;
  private prefix: string;
  private suffix: string;

  /**
   * @param prefix - 旋转器前的文本
   * @param suffix - 旋转器后的文本（如 "thinking..."）
   */
  constructor(prefix = '', suffix = '') {
    this.prefix = prefix;
    this.suffix = suffix;
  }

  /**
   * 启动旋转器动画
   * 立即渲染第一帧，然后启动定时器循环更新
   */
  start(prefix?: string, suffix?: string): void {
    if (prefix) this.prefix = prefix;
    if (suffix) this.suffix = suffix;
    this.frameIndex = 0;
    this.render();
    this.timer = setInterval(() => this.render(), INTERVAL);
  }

  /** 渲染当前帧（覆盖同一行） */
  private render(): void {
    const frame = FRAMES[this.frameIndex % FRAMES.length];
    this.frameIndex++;
    // \r 回车到行首，\x1b[K 清除行尾内容
    process.stdout.write(`\r${this.prefix} ${frame} ${this.suffix}\x1b[K`);
  }

  /**
   * 停止旋转器并清除显示
   * @param finalText - 停止后可选的最终文本
   */
  stop(finalText?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // 清除旋转器所在行
    process.stdout.write('\r\x1b[K');
    if (finalText) {
      process.stdout.write(`${finalText}\n`);
    }
  }
}
