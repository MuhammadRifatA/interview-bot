import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';


@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {

  constructor() {}

  ngOnInit(): void {
    this.preloadSpeechVoices();
  }

  preloadSpeechVoices(): void {
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.getVoices(); //panggil agar browser prepare voice

      speechSynthesis.onvoiceschanged = () => {
        console.log('Voices sudah siap di halaman Home');
      };
    }else {
      console.warn('speechSyhntesis tidak tersedia di browser ini!');
    }
  } 

}