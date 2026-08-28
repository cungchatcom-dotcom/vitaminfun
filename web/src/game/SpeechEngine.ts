/**
 * Nhận diện giọng nói (STT) và phát âm (TTS) bằng Web Speech API.
 *
 * Khác bản prototype: KHÔNG đụng vào DOM. Bản cũ tự thêm/bớt class trên nút
 * `#btn-speak`; ở đây engine chỉ báo trạng thái qua callback và React tự vẽ.
 * Hai bên cùng sửa một nút là thứ hỏng lúc chạy, không phải lúc build.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export class SpeechEngine {
  private recognition: SpeechRecognitionLike | null = null;
  private recording = false;

  constructor(
    private readonly onTranscript: (text: string) => void,
    private readonly onRecordingChange: (recording: boolean) => void,
  ) {
    const w = window as SpeechWindow;
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      this.onTranscript(event.results[0][0].transcript.trim());
    };
    recognition.onerror = () => this.stop();
    recognition.onend = () => this.stop();

    this.recognition = recognition;
  }

  /** Trình duyệt có hỗ trợ nói không. Không có thì giao diện ẩn nút micro. */
  get supported(): boolean {
    return this.recognition !== null;
  }

  start(): void {
    if (!this.recognition || this.recording) return;
    try {
      this.recognition.start();
      this.recording = true;
      this.onRecordingChange(true);
    } catch {
      // Gọi start() hai lần liên tiếp thì trình duyệt ném lỗi. Không phải
      // chuyện người dùng cần biết.
    }
  }

  stop(): void {
    if (!this.recognition || !this.recording) return;
    try {
      this.recognition.stop();
    } catch {
      /* đã dừng rồi */
    }
    this.recording = false;
    this.onRecordingChange(false);
  }

  /** Đọc một câu tiếng Anh. Dùng cho lời NPC. */
  speak(text: string, pitch = 1.0, rate = 0.95): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.pitch = pitch;
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }
}
