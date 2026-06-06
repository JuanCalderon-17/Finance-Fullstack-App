import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Lightweight circular image cropper.
 * The user pans (drag) and zooms (slider) within a fixed square viewport;
 * the visible region is drawn to a 256x256 canvas and emitted as a JPEG data URL.
 */
@Component({
  selector: 'app-image-cropper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-cropper.component.html',
  styleUrls: ['./image-cropper.component.scss']
})
export class ImageCropperComponent {
  @Input() imageSrc = '';
  @Output() cropped = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('img') imgRef!: ElementRef<HTMLImageElement>;

  // Viewport size in px (must match .cropper-stage in the SCSS).
  readonly V = 280;
  // Output resolution.
  private readonly OUT = 256;

  private nw = 0;          // natural image width
  private nh = 0;          // natural image height
  private baseScale = 1;   // scale needed to cover the viewport at zoom = 1
  eff = 1;                 // effective scale (baseScale * zoom)

  dw = 0;                  // displayed width
  dh = 0;                  // displayed height
  posX = 0;                // displayed top-left X relative to viewport
  posY = 0;
  zoom = 1;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  onImageLoad(): void {
    const el = this.imgRef.nativeElement;
    this.nw = el.naturalWidth;
    this.nh = el.naturalHeight;
    this.baseScale = Math.max(this.V / this.nw, this.V / this.nh);
    this.zoom = 1;
    this.eff = this.baseScale;
    this.dw = this.nw * this.eff;
    this.dh = this.nh * this.eff;
    // Center the image in the viewport.
    this.posX = (this.V - this.dw) / 2;
    this.posY = (this.V - this.dh) / 2;
  }

  onZoom(): void {
    const center = this.V / 2;
    // Source point currently under the viewport center.
    const cx = (center - this.posX) / this.eff;
    const cy = (center - this.posY) / this.eff;
    this.eff = this.baseScale * this.zoom;
    this.dw = this.nw * this.eff;
    this.dh = this.nh * this.eff;
    // Keep that same source point under the center after zooming.
    this.posX = center - cx * this.eff;
    this.posY = center - cy * this.eff;
    this.clamp();
  }

  onPointerDown(event: PointerEvent): void {
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    this.posX += event.clientX - this.lastX;
    this.posY += event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.clamp();
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  private clamp(): void {
    // Image must always fully cover the viewport.
    this.posX = Math.min(0, Math.max(this.V - this.dw, this.posX));
    this.posY = Math.min(0, Math.max(this.V - this.dh, this.posY));
  }

  confirm(): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.OUT;
    canvas.height = this.OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Map the viewport square back to source-image pixels.
    const sx = -this.posX / this.eff;
    const sy = -this.posY / this.eff;
    const sSize = this.V / this.eff;
    ctx.drawImage(this.imgRef.nativeElement, sx, sy, sSize, sSize, 0, 0, this.OUT, this.OUT);

    this.cropped.emit(canvas.toDataURL('image/jpeg', 0.85));
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
