import ClientExamWrapper from './ClientExamWrapper';

export default async function McqExamPage({ params }) {
    // 🚀 Server safely resolves params
    const resolvedParams = await params;

    return (
        // 🚀 Pure naked canvas that loads the Client Wrapper!
        <main className="w-screen h-screen bg-black overflow-hidden m-0 p-0">
            <ClientExamWrapper id={resolvedParams.id} />
        </main>
    );
}