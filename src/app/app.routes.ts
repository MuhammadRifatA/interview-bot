import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { InterviewComponent } from './pages/interview/interview.component';
import { ResultComponent } from './pages/result/result.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'interview',
    component: InterviewComponent,
  },
  {
    path: 'result',
    component: ResultComponent,
  },
];
