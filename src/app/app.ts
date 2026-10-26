import { Component } from '@angular/core';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(private translate: TranslateService) {
    translate.addLangs(['es', 'ca', 'en']);
    translate.use('es');
  }

  switchLang(event: Event) {
    const lang = (event.target as HTMLSelectElement).value;
    this.translate.use(lang);
  }
}