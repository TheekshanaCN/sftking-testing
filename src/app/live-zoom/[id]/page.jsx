import ZoomEngine from './ZoomEngine';

export default async function LiveZoomPage({ params }) {
    // 🚀 NEXT.JS 16 FIX: params is a Promise! We must await it to get the ID safely.
    const resolvedParams = await params;

    return (
        // 🚀 PURE NAKED CANVAS: No blue horizontal layers, no exit buttons. Just pure black!
        // The beautiful SFT King loader is safely hidden inside the ZoomEngine below!
        <main className="w-screen h-screen bg-black overflow-hidden m-0 p-0">
            <ZoomEngine id={resolvedParams.id} />
        </main>
    );
}