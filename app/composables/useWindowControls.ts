/**
 * Window Controls - Tauri window management
 * Provides functions to minimize, maximize, and close the window
 */
export function useWindowControls() {
    const isTauri = computed(() => typeof window !== 'undefined' && '__TAURI__' in window)
    const isMaximized = ref(false)

    // Get the current window
    async function getWindow() {
        if (!isTauri.value) return null
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window')
            return getCurrentWindow()
        } catch (e) {
            return null
        }
    }

    // Minimize window
    async function minimize() {
        const win = await getWindow()
        if (win) {
            try {
                await win.minimize()
            } catch (e) {}
        }
    }

    // Toggle maximize/restore
    async function toggleMaximize() {
        const win = await getWindow()
        if (win) {
            try {
                await win.toggleMaximize()
                isMaximized.value = await win.isMaximized()
            } catch (e) {}
        }
    }

    // Close window
    async function close() {
        const win = await getWindow()
        if (win) {
            try {
                await win.close()
            } catch (e) {}
        }
    }

    // Start dragging the window (for custom titlebar)
    async function startDrag() {
        const win = await getWindow()
        if (win) {
            try {
                await win.startDragging()
            } catch (e) {}
        }
    }

    // Check if maximized on mount
    async function checkMaximized() {
        const win = await getWindow()
        if (win) {
            try {
                isMaximized.value = await win.isMaximized()
                
                // Listen for resize events
                const { listen } = await import('@tauri-apps/api/event')
                listen('tauri://resize', async () => {
                    if (win) {
                        isMaximized.value = await win.isMaximized()
                    }
                })
            } catch (e) {}
        }
    }

    return {
        isTauri,
        isMaximized: readonly(isMaximized),
        minimize,
        toggleMaximize,
        close,
        startDrag,
        checkMaximized
    }
}
