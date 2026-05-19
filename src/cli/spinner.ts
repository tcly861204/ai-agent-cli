const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL = 80;

export class Spinner {
  private frameIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private prefix: string;
  private suffix: string;

  constructor(prefix = '', suffix = '') {
    this.prefix = prefix;
    this.suffix = suffix;
  }

  start(prefix?: string, suffix?: string): void {
    if (prefix) this.prefix = prefix;
    if (suffix) this.suffix = suffix;
    this.frameIndex = 0;
    this.render();
    this.timer = setInterval(() => this.render(), INTERVAL);
  }

  private render(): void {
    const frame = FRAMES[this.frameIndex % FRAMES.length];
    this.frameIndex++;
    process.stdout.write(`\r${this.prefix} ${frame} ${this.suffix}\x1b[K`);
  }

  stop(finalText?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stdout.write('\r\x1b[K');
    if (finalText) {
      process.stdout.write(`${finalText}\n`);
    }
  }
}
