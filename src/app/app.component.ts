import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'interview-app';

  ngOnInit(): void {
    this.preloadVoices();
  }

  preloadVoices(): void {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) {
      speechSynthesis.onvoiceschanged = () => {
        console.log('Voice list preloaded di app.component.ts');
      };
    } else {
      console.log('Voice list sudah tersedia saat app start');
    }
  }
}
