import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-coming-soon-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h2 class="page-title">{{ title }}</h2>
        <p class="page-desc">{{ note }}</p>
      </div>
    </section>

    <div class="empty-state">
      <div class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-alert" /></svg></div>
      <h3>Tato obrazovka se připravuje</h3>
      <p>{{ note }}</p>
      <p class="form-hint">Zatím můžeš pracovat s <a routerLink="/produkty">katalogem produktů</a> a <a routerLink="/zasoby">zásobami po skladech</a>.</p>
    </div>
  `
})
export class ComingSoonPage implements OnInit {
  private readonly route = inject(ActivatedRoute);

  title = 'Připravujeme';
  note = '';

  ngOnInit(): void {
    this.title = (this.route.snapshot.data['title'] as string) ?? this.title;
    this.note = (this.route.snapshot.data['note'] as string) ?? '';
  }
}
