import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { AuthMessagesService } from '../../core/services/auth-messages.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnInit {
  isLoading = true;
  message: string = '';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private translate: TranslateService,
    private authMessages: AuthMessagesService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const email = params['email'];

      if (!token || !email) {
        this.isLoading = false;
        this.translate.get('AUTH.STATUS.MISSING_TOKEN')
          .subscribe(msg => this.errorMessage = msg);
        return;
      }

      this.authService.verifyEmail(token, email).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          this.authMessages.fromResponse(res, 'AUTH.STATUS.EMAIL_VERIFIED')
            .subscribe(msg => this.message = msg);
        },
        error: (err) => {
          this.isLoading = false;
          this.authMessages.fromError(err, 'AUTH.STATUS.VERIFY_FAILED')
            .subscribe(msg => this.errorMessage = msg);
        }
      });
    });
  }
}
