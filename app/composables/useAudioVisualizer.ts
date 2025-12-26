/**
 * Audio Visualizer - Ses analizi ve görselleştirme
 */
export function useAudioVisualizer() {
    const audioContext = ref<AudioContext | null>(null);
    const analyser = ref<AnalyserNode | null>(null);
    const dataArray = ref<Uint8Array<ArrayBuffer> | null>(null);
    const animationFrameId = ref<number | null>(null);
    const audioIntensity = ref(0);
    const visualizerBars = ref<number[]>(Array(12).fill(0));
    const isInitialized = ref(false);

    // Audio context başlat
    function init(audioElement: HTMLAudioElement): boolean {
        if (isInitialized.value || !audioElement) return false;

        try {
            audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)();
            analyser.value = audioContext.value.createAnalyser();
            analyser.value.fftSize = 256;

            const bufferLength = analyser.value.frequencyBinCount;
            dataArray.value = new Uint8Array(bufferLength);

            const source = audioContext.value.createMediaElementSource(audioElement);
            source.connect(analyser.value);
            analyser.value.connect(audioContext.value.destination);

            isInitialized.value = true;
            return true;
        } catch (error) {
            console.error('Audio context initialization failed:', error);
            return false;
        }
    }

    // Analiz döngüsünü başlat
    function startAnalysis(callbacks?: {
        onIntensityUpdate?: (intensity: number) => void;
        onBarsUpdate?: (bars: number[]) => void;
        onFrequencyData?: (data: Uint8Array) => void;
    }) {
        const analyze = () => {
            if (!analyser.value || !dataArray.value) {
                audioIntensity.value = 0;
                visualizerBars.value = Array(12).fill(0);
                return;
            }

            analyser.value.getByteFrequencyData(dataArray.value);

            // Frequency data callback
            callbacks?.onFrequencyData?.(dataArray.value);

            // Ortalama yoğunluk hesapla
            let sum = 0;
            for (let i = 0; i < dataArray.value.length; i++) {
                sum += dataArray.value[i] ?? 0;
            }
            const average = sum / dataArray.value.length;
            const normalized = average / 255;

            // Yumuşak geçiş
            audioIntensity.value = audioIntensity.value * 0.7 + normalized * 0.3;
            callbacks?.onIntensityUpdate?.(audioIntensity.value);

            // Bar değerlerini hesapla
            const bufferLength = dataArray.value.length;
            const barsCount = 12;
            const step = Math.floor(bufferLength / barsCount);
            const newBars: number[] = [];

            for (let i = 0; i < barsCount; i++) {
                let barSum = 0;
                const startIdx = i * step;
                const endIdx = Math.min(startIdx + step, bufferLength);

                for (let j = startIdx; j < endIdx; j++) {
                    barSum += dataArray.value[j] ?? 0;
                }

                const barAvg = barSum / (endIdx - startIdx);
                const barValue = (barAvg / 255) * 100;
                const prevValue = visualizerBars.value[i] || 0;
                newBars.push(prevValue * 0.6 + barValue * 0.4);
            }

            visualizerBars.value = newBars;
            callbacks?.onBarsUpdate?.(newBars);

            animationFrameId.value = requestAnimationFrame(analyze);
        };

        analyze();
    }

    // Analizi durdur
    function stopAnalysis() {
        if (animationFrameId.value) {
            cancelAnimationFrame(animationFrameId.value);
            animationFrameId.value = null;
        }
        audioIntensity.value = 0;
        visualizerBars.value = Array(12).fill(0);
    }

    // Kaynakları temizle
    function destroy() {
        stopAnalysis();
        if (audioContext.value) {
            audioContext.value.close();
            audioContext.value = null;
        }
        analyser.value = null;
        dataArray.value = null;
        isInitialized.value = false;
    }

    onUnmounted(() => {
        destroy();
    });

    return {
        audioIntensity: readonly(audioIntensity),
        visualizerBars: readonly(visualizerBars),
        isInitialized: readonly(isInitialized),
        dataArray: readonly(dataArray),
        init,
        startAnalysis,
        stopAnalysis,
        destroy
    };
}

/**
 * uniquewave - Canvas tabanlı dalga animasyonu
 * Daha gerçekçi ses spektrumu için geliştirilmiş versiyon
 */
export class uniquewave {
    phase: number = 0;
    run: boolean = false;
    ratio: number;
    width: number;
    width_2: number;
    width_4: number;
    height: number;
    height_2: number;
    MAX: number;
    amplitude: number;
    targetAmplitude: number;
    speed: number;
    targetSpeed: number;
    frequency: number;
    color: string;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    container: HTMLElement;
    _GATF_cache: Record<number, number> = {};
    animFrameId: number | null = null;
    lerpSpeed: number = 0.06;
    
    // New: frequency bands for more realistic visualization
    lowFreq: number = 0;
    midFreq: number = 0;
    highFreq: number = 0;
    targetLowFreq: number = 0;
    targetMidFreq: number = 0;
    targetHighFreq: number = 0;

    constructor(opt: any = {}) {
        this.ratio = opt.ratio || window.devicePixelRatio || 1;
        this.width = this.ratio * (opt.width || 320);
        this.width_2 = this.width / 2;
        this.width_4 = this.width / 4;
        this.height = this.ratio * (opt.height || 100);
        this.height_2 = this.height / 2;
        this.MAX = (this.height_2) - 4;
        this.amplitude = opt.amplitude || 0;
        this.targetAmplitude = this.amplitude;
        this.speed = opt.speed || 0.02;
        this.targetSpeed = this.speed;
        this.frequency = opt.frequency || 6;

        // Hex to RGB
        const hex = opt.color || '#fff';
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = hex.replace(shorthandRegex, (_m: string, r: string, g: string, b: string) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        this.color = result
            ? `${parseInt(result[1]!, 16)},${parseInt(result[2]!, 16)},${parseInt(result[3]!, 16)}`
            : '255,255,255';

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = (this.width / this.ratio) + 'px';
        this.canvas.style.height = (this.height / this.ratio) + 'px';

        this.container = opt.container || document.body;
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d')!;

        if (opt.autostart) {
            this.start();
        }
    }

    _globAttFunc(x: number): number {
        if (this._GATF_cache[x] == null) {
            this._GATF_cache[x] = Math.pow(4 / (4 + Math.pow(x, 4)), 2);
        }
        return this._GATF_cache[x];
    }

    _xpos(i: number): number {
        return this.width_2 + i * this.width_4;
    }

    _ypos(i: number, attenuation: number): number {
        if (this.amplitude <= 0.01) {
            return this.height_2;
        }
        const att = (this.MAX * this.amplitude) / attenuation;
        return this.height_2 + this._globAttFunc(i) * att * Math.sin(this.frequency * i - this.phase);
    }

    _drawLine(attenuation: number, color: string, width: number = 1): void {
        this.ctx.moveTo(0, 0);
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;

        let i = -2;
        while ((i += 0.01) <= 2) {
            this.ctx.lineTo(this._xpos(i), this._ypos(i, attenuation));
        }

        this.ctx.stroke();
    }

    _clear(): void {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.globalCompositeOperation = 'source-over';
    }

    _draw(): void {
        if (this.run === false) return;

        // Smooth amplitude transition
        const ampDiff = this.targetAmplitude - this.amplitude;
        if (Math.abs(ampDiff) > 0.001) {
            this.amplitude += ampDiff * this.lerpSpeed;
        } else {
            this.amplitude = this.targetAmplitude;
        }
        
        // Smooth speed transition
        const speedDiff = this.targetSpeed - this.speed;
        if (Math.abs(speedDiff) > 0.001) {
            this.speed += speedDiff * this.lerpSpeed;
        }
        
        // Smooth frequency band transitions
        this.lowFreq += (this.targetLowFreq - this.lowFreq) * this.lerpSpeed;
        this.midFreq += (this.targetMidFreq - this.midFreq) * this.lerpSpeed;
        this.highFreq += (this.targetHighFreq - this.highFreq) * this.lerpSpeed;

        this.phase = (this.phase + Math.PI * this.speed) % (2 * Math.PI);

        this._clear();

        // Draw multiple layers with frequency-based opacity only
        // Background layers (subtle)
        this._drawLine(-2, `rgba(168, 85, 247, ${0.04 + this.lowFreq * 0.04})`, 3);
        this._drawLine(-6, `rgba(6, 182, 212, ${0.08 + this.midFreq * 0.08})`, 6);
        
        // Mid layers (more visible)
        this._drawLine(4, `rgba(236, 72, 153, ${0.15 + this.highFreq * 0.2})`, 9);
        this._drawLine(2, `rgba(139, 92, 246, ${0.35 + this.midFreq * 0.2})`, 6);
        
        // Main line (most visible)
        this._drawLine(1, `rgba(6, 182, 212, ${0.7 + this.amplitude * 0.3})`, 3);

        this.animFrameId = requestAnimationFrame(this._draw.bind(this));
    }

    start(): void {
        this.phase = 0;
        this.run = true;
        this._draw();
    }

    stop(): void {
        this.run = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    setSpeed(v: number): void {
        this.targetSpeed = v;
    }

    setAmplitude(v: number): void {
        this.targetAmplitude = Math.max(Math.min(v, 1), 0);
    }
    
    // New: Set frequency bands for more realistic visualization
    setFrequencyBands(low: number, mid: number, high: number): void {
        this.targetLowFreq = Math.max(Math.min(low, 1), 0);
        this.targetMidFreq = Math.max(Math.min(mid, 1), 0);
        this.targetHighFreq = Math.max(Math.min(high, 1), 0);
    }

    destroy(): void {
        this.stop();
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

/**
 * SVG Equalizer Wave composable
 */
export function useEqualizerWave() {
    const waveLines = ref<SVGLineElement[]>([]);
    const waveBarValues = ref<number[]>([]);
    const isIdle = ref(true);
    const idleAnimationId = ref<number | null>(null);

    function init(waveGroup: SVGGElement) {
        const lines = Array.from(waveGroup.querySelectorAll('line')) as SVGLineElement[];
        if (!lines.length) return;

        waveLines.value = lines;
        waveBarValues.value = new Array(lines.length).fill(0.05);

        lines.forEach(line => {
            line.style.transformOrigin = 'center center';
            line.style.transformBox = 'fill-box';
            line.style.transform = 'scaleY(0.05)';
            line.style.opacity = '0.3';
        });

        isIdle.value = true;
        startIdleAnimation();
    }

    function startIdleAnimation() {
        if (idleAnimationId.value) return;

        let phase = 0;

        const animateIdle = () => {
            if (!isIdle.value) {
                idleAnimationId.value = null;
                return;
            }

            phase += 0.015;

            waveLines.value.forEach((line, i) => {
                const centerIndex = waveLines.value.length / 2;
                const distanceFromCenter = Math.abs(i - centerIndex) / centerIndex;

                const waveValue = 0.05 + Math.sin(phase - distanceFromCenter * 2.5) * 0.12 + 0.12;
                const clampedValue = Math.max(0.05, Math.min(0.35, waveValue));

                line.style.transform = `scaleY(${clampedValue})`;
                line.style.opacity = `${0.25 + clampedValue * 0.6}`;
            });

            idleAnimationId.value = requestAnimationFrame(animateIdle);
        };

        animateIdle();
    }

    function stopIdleAnimation() {
        if (idleAnimationId.value) {
            cancelAnimationFrame(idleAnimationId.value);
            idleAnimationId.value = null;
        }
    }

    function updateWithFrequencyData(frequencyData: Uint8Array) {
        if (!waveLines.value.length || !frequencyData) return;

        const barCount = waveLines.value.length;
        const dataLength = frequencyData.length;
        const centerIndex = Math.floor(barCount / 2);

        waveLines.value.forEach((line, i) => {
            const distanceFromCenter = Math.abs(i - centerIndex) / centerIndex;
            const freqIndex = Math.floor(distanceFromCenter * dataLength * 0.7);

            const rawValue = frequencyData[freqIndex] || 0;
            const normalizedValue = rawValue / 255;

            const prevValue = waveBarValues.value[i] || 0.05;
            const smoothedValue = prevValue * 0.7 + normalizedValue * 0.3;
            waveBarValues.value[i] = smoothedValue;

            const scaleValue = 0.05 + smoothedValue * 0.95;
            const opacityValue = 0.3 + smoothedValue * 0.7;

            line.style.transform = `scaleY(${scaleValue})`;
            line.style.opacity = `${opacityValue}`;
        });
    }

    function start() {
        isIdle.value = false;
        stopIdleAnimation();
    }

    function stop() {
        isIdle.value = true;
        waveBarValues.value = new Array(waveLines.value.length).fill(0.05);
        startIdleAnimation();
    }

    function destroy() {
        stopIdleAnimation();
        waveLines.value = [];
        waveBarValues.value = [];
    }

    onUnmounted(() => {
        destroy();
    });

    return {
        waveLines: readonly(waveLines),
        isIdle: readonly(isIdle),
        init,
        start,
        stop,
        updateWithFrequencyData,
        destroy
    };
}
