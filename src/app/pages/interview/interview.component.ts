import { Component, OnInit, AfterViewChecked, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-interview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './interview.component.html',
  styleUrls: ['./interview.component.css']
})
export class InterviewComponent implements OnInit, AfterViewChecked {
  isRecording = false;
  transcript = '';
  transcripts: string[] = [];
  recognition: any;
  isDarkMode = false;

  questions: { qid: number, question: string }[] = [];
  currentQuestionIndex = 0;
  currentQuestion = '';
  isLoaded = false;
  questionHistory: string[] = [];

  selectedVoice: SpeechSynthesisVoice | null = null;
  feedbackMessage: string = '';
  answerGiven = false;
  showSpeakPopup = false;
  isProcessingFeedback: boolean = false;

  finalScore: number | null = null;
  maxScore: number | null = null;
  statusMessage: string = '';
  showFinalScorePopup: boolean = true;
  animationClass = 'fade-in';
  sessionId: string = '';

  qaHistory: { question: string, answer: string, feedback: string }[] = [];

  constructor(private http: HttpClient, private cdRef: ChangeDetectorRef, private ngZone: NgZone) { }

  isFeedbackGivenForCurrentQuestion(): boolean {
    return this.qaHistory.some(item => item.question === this.currentQuestion && item.feedback);
  }

  async ngOnInit() {
    this.setupRecognition();
    await this.waitForVoices();
    this.selectedVoice = this.getEnglishVoice();

    const savedSession = sessionStorage.getItem('session_id');
    if (savedSession) {
      this.sessionId = savedSession;
    } else {
      this.sessionId = 'session-' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('session_id', this.sessionId);
    }

    try {
      const storedData = sessionStorage.getItem('data');
      let data: { qid: number, question: string }[];

      if (storedData) {
        data = JSON.parse(storedData);
      } else {
        data = await firstValueFrom(this.http.get<{ qid: number, question: string }[]>("http://127.0.0.1:5000", { withCredentials: true }));
        sessionStorage.setItem('data', JSON.stringify(data));
      }

      this.questions = data;

      const savedState = sessionStorage.getItem('interview_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        this.currentQuestionIndex = state.currentQuestionIndex || 0;
        this.transcripts = state.transcripts || [];
        this.transcript = state.transcript || '';
        this.answerGiven = state.answerGiven || false;
        this.qaHistory = state.qaHistory || [];
        this.questionHistory = state.questionHistory || [];
      }

      this.currentQuestion = this.questions[this.currentQuestionIndex].question;
      this.isLoaded = true;

      setTimeout(() => this.speak(this.currentQuestion), 300);

    } catch (error) {
      alert("Gagal mengambil data pertanyaan: " + error);
    }
  }

  ngAfterViewChecked() {
    const chat = document.querySelector('.chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  speak(text: string) {
    if (!this.selectedVoice || !text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.voice = this.selectedVoice;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  waitForVoices(): Promise<void> {
    return new Promise(resolve => {
      if (speechSynthesis.getVoices().length > 0) resolve();
      else speechSynthesis.onvoiceschanged = () => resolve();
    });
  }

  toggleDarkMode() {
  this.isDarkMode = !this.isDarkMode;
  console.log('Dark mode toggled:', this.isDarkMode);
  }


  getEnglishVoice(): SpeechSynthesisVoice | null {
    const voices = speechSynthesis.getVoices();
    return voices.find(voice => voice.lang === 'en-US') || voices[0] || null;
  }

  nextQuestion() {
    const nextIndex = this.currentQuestionIndex + 1;
    if (nextIndex < this.questions.length) {
      if (this.currentQuestion && !this.questionHistory.includes(this.currentQuestion)) {
        this.questionHistory.push(this.currentQuestion);
      }

      this.currentQuestionIndex = nextIndex;
      this.currentQuestion = this.questions[nextIndex].question;
      this.transcript = '';
      this.transcripts = [];
      this.feedbackMessage = '';
      this.answerGiven = false;

      this.saveState();
      setTimeout(() => this.speak(this.currentQuestion), 300);
    } else {
      this.getFinalScore();
    }
  }

  getFinalScore() {
    this.http.get<any>(`http://127.0.0.1:5000/hasil?session_id=${this.sessionId}`, { withCredentials: true }).subscribe({
      next: (result) => {
        this.finalScore = result.total_score;
        this.maxScore = result.max_score;
        this.statusMessage = result.status;
        this.showFinalScorePopup = true;
      },
      error: (err) => {
        const msg = err?.error?.error || err.message || "Unknown error";
        this.statusMessage = `Gagal mengambil hasil akhir: ${msg}. Coba lagi nanti.`;
        alert(this.statusMessage);
      }
    });
  }

  closeFinalScorePopup() {
    this.showFinalScorePopup = false;
  }

  sendAnswerAndGetFeedback(questionId: number, userAnswer: string) {
    const trimmedAnswer = userAnswer.trim();
    const wordCount = trimmedAnswer.split(/\s+/).length;

    if (wordCount < 5) {
      this.feedbackMessage = "Jawaban Anda terlalu singkat. Minimal harus 5 kata.";
      alert(this.feedbackMessage); // opsional
      return;
    }

    this.http.post<{ feedback?: string, error?: string }>(
      `http://127.0.0.1:5000/jawab/${questionId}`,
      { answer: trimmedAnswer, session_id: this.sessionId },
      { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
    ).subscribe({
      next: (response) => {
        if (response?.feedback) {
          this.isProcessingFeedback = false;
          this.feedbackMessage = response.feedback;
          this.speak("Your feedback is ready. Please read your feedback.");

          const qaEntry = this.qaHistory.find(item => item.question === this.currentQuestion);
          if (qaEntry) qaEntry.feedback = response.feedback;

          this.ngZone.run(() => this.cdRef.detectChanges());
          this.saveState();
          this.answerGiven = true;
        } else if (response?.error) {
          this.feedbackMessage = "Error: " + response.error;
          alert(this.feedbackMessage);
        }
      },
      error: (err: any) => {
        const msg = err?.error?.error || err.message || "Unknown error";
        this.feedbackMessage = `Failed to get feedback: ${msg}. Try again later.`;
        alert(this.feedbackMessage);
      }
    });
  }

  playBeep(frequency: number, duration: number = 300) {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.5, context.currentTime);

    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000);
  }

  toggleRecording() {
    if (!this.recognition) {
      alert("SpeechRecognition is not available.");
      return;
    }

    if (!this.isRecording) {
      this.transcript = '';
      this.transcripts = [];
      this.playBeep(400);

      this.recognition.onstart = () => {
        this.statusMessage = "🎤 Listening... You may speak now.";
        this.isRecording = true;
        this.playBeep(800);

        this.showSpeakPopup = true;
        setTimeout(() => {
          this.showSpeakPopup = false;
          this.cdRef.detectChanges();
        }, 2000);
      };


      this.recognition.start();
    } else {
      this.recognition.stop();
      this.isRecording = false;

      setTimeout(() => {
        const answer = this.transcripts.join(' ').trim();
        const wordCount = answer.split(/\s+/).length;

        if (wordCount < 5) {
          this.feedbackMessage = "The Answer to Short.";
          alert(this.feedbackMessage);
          return;
        }

        if (this.answerGiven) {
          this.isProcessingFeedback = true;
          this.feedbackMessage = ''; // Kosongkan dulu
          return;
        }


        const currentQid = this.questions[this.currentQuestionIndex].qid;
        this.sendAnswerAndGetFeedback(currentQid, answer);
      }, 500);

    }
  }

  resetQuestion() {
    // Hapus semua data lokal dari sessionStorage
    sessionStorage.removeItem('interview_state');
    sessionStorage.removeItem('data');

    const newSession = 'session-' + Math.random().toString(36).substring(2, 10);
    this.sessionId = newSession;
    sessionStorage.setItem('session_id', newSession);

    // Reset state di komponen
    this.isLoaded = false;
    this.questions = [];
    this.transcripts = [];
    this.questionHistory = [];
    this.qaHistory = [];
    this.feedbackMessage = '';
    this.answerGiven = false;
    this.finalScore = null;
    this.maxScore = null;
    this.statusMessage = '';

    // Ambil ulang pertanyaan dari server
    this.http.get<{ qid: number, question: string }[]>("http://127.0.0.1:5000", { withCredentials: true }).subscribe({
      next: (data) => {
        this.questions = data;
        this.currentQuestionIndex = 0;
        this.currentQuestion = this.questions[0].question;
        this.isLoaded = true;

        setTimeout(() => this.speak(this.currentQuestion), 300);
      },
      error: (err) => {
        alert("Error fetching data: " + err);
      }
    });
  }

  setupRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          this.transcript = transcript;
          this.transcripts.push(transcript);

          if (!this.answerGiven) {
            if (!this.qaHistory.some(item => item.question === this.currentQuestion)) {
              this.qaHistory.push({ question: this.currentQuestion, answer: transcript, feedback: "" });
            }

            this.answerGiven = true;
            const currentQid = this.questions[this.currentQuestionIndex].qid;
            this.sendAnswerAndGetFeedback(currentQid, transcript);
            this.ngZone.run(() => this.cdRef.detectChanges());
          }
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      alert("Speech Recognition Error: " + event.error);
    };
  }

  saveState() {
    const state = {
      currentQuestionIndex: this.currentQuestionIndex,
      transcripts: this.transcripts,
      transcript: this.transcript,
      answerGiven: this.answerGiven,
      qaHistory: this.qaHistory,
      questionHistory: this.questionHistory
    };
    sessionStorage.setItem('interview_state', JSON.stringify(state));
  }
}

