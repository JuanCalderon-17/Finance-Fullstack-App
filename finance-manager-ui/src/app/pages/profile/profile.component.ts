import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { UserStateService } from '../../core/services/user-state.service';
import { ImageCropperComponent } from '../../shared/image-cropper/image-cropper.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ImageCropperComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  // Identity
  username = '';
  fullName = '';
  email = '';
  profilePictureUrl: string | null = null;
  editFullName = '';
  editPictureUrl = '';
  isSavingProfile = false;
  profileStatus: string | null = null;
  profileStatusKind: 'success' | 'error' | null = null;

  // Cropper
  showCropper = false;
  cropSource = '';

  // Password
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  isSavingPassword = false;
  passwordStatus: string | null = null;
  passwordStatusKind: 'success' | 'error' | null = null;

  private readonly passwordRegex = /^(?=.*[A-Z])(?=.*\d).{6,}$/;

  constructor(
    private authService: AuthService,
    private userState: UserStateService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        const firstName = user.fullName?.trim().split(/\s+/)[0];
        this.username = firstName || user.username || '';
        this.fullName = user.fullName || '';
        this.email = user.username || '';
        this.profilePictureUrl = user.profilePictureUrl || null;
        this.editFullName = user.fullName || '';
        this.editPictureUrl = user.profilePictureUrl || '';
      } catch { /* ignore */ }
    }
  }

  get userInitial(): string {
    return this.username ? this.username.charAt(0).toUpperCase() : 'U';
  }

  // ===== Photo / cropper =====
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.profileStatus = this.translate.instant('PROFILE.IDENTITY.INVALID_IMAGE');
      this.profileStatusKind = 'error';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.cropSource = reader.result as string;
      this.showCropper = true;
      this.profileStatus = null;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onCropped(dataUrl: string): void {
    this.editPictureUrl = dataUrl;
    this.showCropper = false;
    this.cropSource = '';
  }

  // ===== Save identity (name + picture) =====
  saveProfile(): void {
    this.isSavingProfile = true;
    this.profileStatus = null;
    this.authService.updateProfile({
      fullName: this.editFullName,
      profilePictureUrl: this.editPictureUrl || undefined
    }).subscribe({
      next: (updated: any) => {
        // Persist + broadcast so the shell avatars update instantly.
        this.userState.setProfile(updated.fullName, updated.profilePictureUrl ?? null, updated.token);

        this.fullName = updated.fullName;
        this.profilePictureUrl = updated.profilePictureUrl ?? null;
        this.username = updated.fullName?.trim().split(/\s+/)[0] || this.username;
        this.isSavingProfile = false;
        this.profileStatus = this.translate.instant('PROFILE.IDENTITY.SUCCESS');
        this.profileStatusKind = 'success';
      },
      error: () => {
        this.isSavingProfile = false;
        this.profileStatus = this.translate.instant('PROFILE.IDENTITY.ERROR');
        this.profileStatusKind = 'error';
      }
    });
  }

  // ===== Change password =====
  changePassword(): void {
    this.passwordStatus = null;

    if (!this.currentPassword || !this.newPassword) {
      this.passwordStatus = this.translate.instant('PROFILE.PASSWORD.EMPTY');
      this.passwordStatusKind = 'error';
      return;
    }
    if (!this.passwordRegex.test(this.newPassword)) {
      this.passwordStatus = this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_COMPLEXITY');
      this.passwordStatusKind = 'error';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordStatus = this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_MISMATCH');
      this.passwordStatusKind = 'error';
      return;
    }

    this.isSavingPassword = true;
    this.authService.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.isSavingPassword = false;
        this.passwordStatus = this.translate.instant('PROFILE.PASSWORD.SUCCESS');
        this.passwordStatusKind = 'success';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.isSavingPassword = false;
        this.passwordStatusKind = 'error';
        this.passwordStatus = this.mapPasswordError(err);
      }
    });
  }

  private mapPasswordError(err: any): string {
    // Identity returns an array of { code, description }.
    if (Array.isArray(err.error)) {
      return err.error.map((e: any) => {
        if (e.code === 'PasswordMismatch') return this.translate.instant('PROFILE.PASSWORD.INCORRECT_CURRENT');
        if (e.code === 'PasswordTooShort') return this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_SHORT');
        if (e.code === 'PasswordRequiresUpper') return this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_UPPER');
        if (e.code === 'PasswordRequiresDigit') return this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_DIGIT');
        return e.description;
      }).join(' ');
    }
    return this.translate.instant('PROFILE.PASSWORD.ERROR');
  }
}
