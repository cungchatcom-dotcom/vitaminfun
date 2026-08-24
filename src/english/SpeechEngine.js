// SpeechEngine: Quản lý nhận diện giọng nói (STT) và phát âm bản xứ (TTS)
import { EventBus, GAME_EVENTS } from '../core/EventBus.js';

export class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'en-US'; // Tiếng Anh chuẩn
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        console.log('[SpeechEngine] Nhận diện giọng nói:', transcript);
        EventBus.emit(GAME_EVENTS.VOICE_OR_TEXT_SUBMITTED, transcript);
      };

      this.recognition.onerror = (event) => {
        console.warn('[SpeechEngine] Lỗi nhận diện giọng nói:', event.error);
        this.stopRecording();
      };

      this.recognition.onend = () => {
        this.stopRecording();
      };
    } else {
      console.warn('[SpeechEngine] Trình duyệt không hỗ trợ Web Speech API. Bạn có thể sử dụng gõ phím.');
    }
  }

  startRecording() {
    if (this.recognition && !this.isRecording) {
      try {
        this.recognition.start();
        this.isRecording = true;
        const btnSpeak = document.getElementById('btn-speak');
        if (btnSpeak) btnSpeak.classList.add('recording');
      } catch (err) {
        console.error('[SpeechEngine] Không thể khởi động micro:', err);
      }
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecording) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isRecording = false;
      const btnSpeak = document.getElementById('btn-speak');
      if (btnSpeak) btnSpeak.classList.remove('recording');
    }
  }

  speak(text, pitch = 1.0, rate = 0.95) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Dừng câu trước đó nếu đang đọc
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.pitch = pitch;
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    }
  }
}
