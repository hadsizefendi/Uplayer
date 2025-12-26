/**
 * Curved Scrollbar Composable
 * Creates a custom curved SVG scrollbar for containers
 */
export function useCurvedScrollbar() {
    function initCurvedScrollbar(container: HTMLElement) {
        const content = container.querySelector('.scroll-content') as HTMLElement;
        if (!content) return;

        const OFFSET = 7;
        const EXTRA_INSET = 2;
        const MIN_START_RATIO = 0.8;
        const MIN_THUMB = 20;
        const SEGMENTS = 50;

        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('scrollbar-svg');
        svg.setAttribute('aria-hidden', 'true');

        const trackPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        trackPath.classList.add('scrollbar-track');

        const thumbPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        thumbPath.classList.add('scrollbar-thumb');

        svg.appendChild(trackPath);
        svg.appendChild(thumbPath);
        container.appendChild(svg);

        let pathLength = 0;
        let thumbLength = 50;
        let dragging = false;
        let pointerId: number | null = null;

        function updatePath() {
            const w = container.clientWidth;
            const h = container.clientHeight;
            const r = parseFloat(getComputedStyle(container).borderRadius) || 0;

            const effectiveRadius = Math.max(r - OFFSET, 0);
            const trackX = w - OFFSET;
            const topY = OFFSET;
            const bottomY = h - OFFSET;
            const cornerX = trackX - effectiveRadius;

            const minStartX = w * MIN_START_RATIO;
            let startX = trackX - effectiveRadius * EXTRA_INSET;
            if (startX < minStartX) startX = minStartX;
            if (startX > cornerX) startX = cornerX;

            const d = `
                M ${startX} ${topY}
                L ${cornerX} ${topY}
                A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${trackX} ${topY + effectiveRadius}
                L ${trackX} ${bottomY - effectiveRadius}
                A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${cornerX} ${bottomY}
                L ${startX} ${bottomY}
            `;
            trackPath.setAttribute('d', d);

            pathLength = trackPath.getTotalLength();
            const ratio = content.clientHeight / content.scrollHeight;
            thumbLength = Math.max(MIN_THUMB, pathLength * ratio);

            updateThumb();
        }

        function updateThumb() {
            const scrollableHeight = content.scrollHeight - content.clientHeight || 1;
            const scrollRatio = content.scrollTop / scrollableHeight;
            const startOffset = (pathLength - thumbLength) * scrollRatio;
            const endOffset = startOffset + thumbLength;

            const points = [];
            for (let i = 0; i <= SEGMENTS; i++) {
                const t = startOffset + ((endOffset - startOffset) / SEGMENTS) * i;
                const p = trackPath.getPointAtLength(t);
                points.push(`${p.x} ${p.y}`);
            }

            const segmentD = `M ${points[0]} ${points.slice(1).map(pt => `L ${pt}`).join(' ')}`;
            thumbPath.setAttribute('d', segmentD);
        }

        thumbPath.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            dragging = true;
            pointerId = e.pointerId;
            thumbPath.setPointerCapture(pointerId);
        });

        window.addEventListener('pointermove', (e) => {
            if (!dragging || e.pointerId !== pointerId) return;
            const rect = container.getBoundingClientRect();
            let ratio = (e.clientY - rect.top) / rect.height;
            ratio = Math.max(0, Math.min(1, ratio));
            content.scrollTop = ratio * (content.scrollHeight - content.clientHeight);
            updateThumb();
        });

        window.addEventListener('pointerup', (e) => {
            if (!dragging || e.pointerId !== pointerId) return;
            dragging = false;
            try { thumbPath.releasePointerCapture(pointerId); } catch { }
            pointerId = null;
        });

        content.addEventListener('scroll', updateThumb);
        window.addEventListener('resize', updatePath);

        updatePath();
    }

    return {
        initCurvedScrollbar
    };
}
