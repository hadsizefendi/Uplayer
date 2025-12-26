/**
 * URL Helpers - URL slug işlemleri ve URL güncelleme
 */
export function useUrlHelpers() {
    const route = useRoute();
    const router = useRouter();

    // Türkçe karakterleri ASCII'ye çevirerek slug oluştur
    function createSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Slug'a göre şarkı bul (songs array dışarıdan geçilir)
    function findBySlug<T extends { title: string }>(songs: T[], slug: string): T | undefined {
        return songs.find(s => createSlug(s.title) === slug);
    }

    // URL'i şarkı slug'ı ile güncelle
    function updateUrl(song: { title: string }) {
        const slug = createSlug(song.title);
        router.push({ query: { song: slug } });
    }

    // URL'den şarkı slug'ını al
    function getSlugFromUrl(): string | null {
        return (route.query.song as string) || null;
    }

    return {
        createSlug,
        findBySlug,
        updateUrl,
        getSlugFromUrl
    };
}
