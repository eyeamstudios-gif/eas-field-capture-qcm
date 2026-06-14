/**
 * EAS Field Capture QCM — Camera Capture Module
 */

export class CameraCapture {
  constructor(options = {}) {
    this.videoEl = options.videoEl;
    this.canvasEl = options.canvasEl;
    this.previewEl = options.previewEl;
    this.stream = null;
    this.lastBlob = null;
    this.lastDataUrl = null;
    this.mode = 'file';
  }

  async initLivePreview() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { supported: false, reason: 'getUserMedia not available' };
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoEl) {
        this.videoEl.srcObject = this.stream;
        await this.videoEl.play();
      }
      this.mode = 'live';
      return { supported: true };
    } catch (err) {
      console.warn('Live camera unavailable:', err);
      return { supported: false, reason: err.message };
    }
  }

  captureFromVideo() {
    if (!this.videoEl || !this.canvasEl) {
      throw new Error('Video/canvas elements required');
    }

    const video = this.videoEl;
    const canvas = this.canvasEl;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          this.lastBlob = blob;
          this.lastDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          resolve({
            blob,
            dataUrl: this.lastDataUrl,
            width: canvas.width,
            height: canvas.height,
            mime_type: 'image/jpeg',
          });
        },
        'image/jpeg',
        0.92
      );
    });
  }

  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          canvas.toBlob(
            (blob) => {
              this.lastBlob = blob || file;
              this.lastDataUrl = reader.result;
              resolve({
                blob: blob || file,
                dataUrl: reader.result,
                width: img.naturalWidth,
                height: img.naturalHeight,
                mime_type: file.type || 'image/jpeg',
                original_filename: file.name,
              });
            },
            file.type || 'image/jpeg',
            0.92
          );
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  showPreview(dataUrl) {
    if (this.previewEl) {
      this.previewEl.src = dataUrl;
      this.previewEl.classList.remove('hidden');
    }
    if (this.videoEl) {
      this.videoEl.classList.add('hidden');
    }
  }

  hidePreview() {
    if (this.previewEl) {
      this.previewEl.classList.add('hidden');
      this.previewEl.src = '';
    }
    if (this.videoEl) {
      this.videoEl.classList.remove('hidden');
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  getLastCapture() {
    return {
      blob: this.lastBlob,
      dataUrl: this.lastDataUrl,
    };
  }
}

export function createFileInputCapture(onCapture) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (file && onCapture) {
      await onCapture(file);
    }
    input.value = '';
  });

  return {
    trigger: () => input.click(),
    destroy: () => input.remove(),
  };
}
