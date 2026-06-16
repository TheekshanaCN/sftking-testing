'use client';
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Check, X, PenTool, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

const GradingCanvas = forwardRef(({ imageUrl }, ref) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const [fabricCanvas, setFabricCanvas] = useState(null);
    const [activeTool, setActiveTool] = useState('draw'); 
    const [isFullscreen, setIsFullscreen] = useState(false);
    const fabricApiRef = useRef({ TextCtor: null });

    useImperativeHandle(ref, () => ({
        exportGradedImage: () => {
            if (!fabricCanvas) return null;
            return fabricCanvas.toDataURL({
                format: 'jpeg',
                quality: 0.9 
            });
        }
    }));

    useEffect(() => {
        let isMounted = true;
        let canvas = null;

        const init = async () => {
            const fabricModule = await import('fabric');
            const fabricNS = fabricModule.fabric || fabricModule;
            const CanvasCtor = fabricNS.Canvas;
            const TextCtor = fabricNS.Text || fabricNS.FabricText;
            const ImageCtor = fabricNS.Image || fabricNS.FabricImage;

            const loadFabricImage = async () => {
                if (!ImageCtor?.fromURL) return null;

                try {
                    const maybePromise = ImageCtor.fromURL(imageUrl, { crossOrigin: 'anonymous' });
                    if (maybePromise && typeof maybePromise.then === 'function') {
                        return await maybePromise;
                    }
                } catch {
                    // Try legacy callback signature.
                }

                try {
                    return await new Promise((resolve) => {
                        ImageCtor.fromURL(
                            imageUrl,
                            (img) => resolve(img || null),
                            { crossOrigin: 'anonymous' }
                        );
                    });
                } catch {
                    return null;
                }
            };

            if (!isMounted || !CanvasCtor || !canvasRef.current) return;

            const bgImg = await loadFabricImage();
            if (!isMounted || !bgImg) return;

            const imgW = bgImg.width || 800;
            const imgH = bgImg.height || 1000;
            // IMPORTANT: Keep original image dimensions to prevent any fit-box crop.
            const targetWidth = Math.max(1, Math.round(imgW));
            const targetHeight = Math.max(1, Math.round(imgH));

            canvas = new CanvasCtor(canvasRef.current, {
                isDrawingMode: true,
                width: targetWidth,
                height: targetHeight,
                preserveObjectStacking: true,
            });

            if (!canvas.freeDrawingBrush && fabricNS.PencilBrush) {
                canvas.freeDrawingBrush = new fabricNS.PencilBrush(canvas);
            }
            if (canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.color = 'red';
                canvas.freeDrawingBrush.width = 4;
            }
            canvas.selection = true;

            fabricApiRef.current = { TextCtor };

            if (isMounted) {
                bgImg.set({
                    left: 0,
                    top: 0,
                    scaleX: 1,
                    scaleY: 1,
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    lockMovementX: true,
                    lockMovementY: true,
                });
                bgImg.__isBg = true;
                canvas.add(bgImg);
                if (typeof bgImg.sendToBack === 'function') bgImg.sendToBack();
                canvas.renderAll();
            }

            if (isMounted) {
                setFabricCanvas(canvas);
            }
        };

        init();

        return () => {
            isMounted = false;
            if (canvas) canvas.dispose();
        };
    }, [imageUrl]);

    useEffect(() => {
        if (!fabricCanvas) return;
        const { TextCtor } = fabricApiRef.current;

        fabricCanvas.isDrawingMode = activeTool === 'draw';
        fabricCanvas.off('mouse:down');

        if (!TextCtor) return;

        if (activeTool === 'check' || activeTool === 'cross') {
            const onMouseDown = (options) => {
                // If user clicked an existing object (or its transform controls),
                // let Fabric handle selection/resize/rotate without adding a new stamp.
                if (options?.target) return;

                const eventPointer =
                    options?.scenePoint ||
                    options?.absolutePointer ||
                    options?.pointer ||
                    null;

                let pointer = eventPointer;
                if (!pointer && typeof fabricCanvas.getPointer === 'function') {
                    pointer = fabricCanvas.getPointer(options.e);
                }

                if (!pointer && options?.e && fabricCanvas?.upperCanvasEl) {
                    const rect = fabricCanvas.upperCanvasEl.getBoundingClientRect();
                    pointer = {
                        x: (options.e.clientX || 0) - rect.left,
                        y: (options.e.clientY || 0) - rect.top,
                    };
                }

                if (!pointer) return;

                const stamp = new TextCtor(activeTool === 'check' ? '✓' : '✗', {
                    left: pointer.x - 15,
                    top: pointer.y - 20,
                    fill: activeTool === 'check' ? '#16a34a' : '#dc2626', 
                    fontSize: 50, 
                    fontWeight: 'bold',
                    selectable: true, 
                });
                fabricCanvas.add(stamp);
            };
            fabricCanvas.on('mouse:down', onMouseDown);
            return () => {
                fabricCanvas.off('mouse:down', onMouseDown);
            };
        }
    }, [activeTool, fabricCanvas]);

    const clearDrawings = () => {
        if (!fabricCanvas) return;
        if (fabricCanvas.contextTop) {
            fabricCanvas.clearContext(fabricCanvas.contextTop);
        }
        fabricCanvas.getObjects().forEach((obj) => {
            if (!obj.__isBg) {
                fabricCanvas.remove(obj);
            }
        });
        fabricCanvas.renderAll();
    };

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === containerRef.current);
        };

        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        const el = containerRef.current;
        if (!el) return;

        try {
            if (document.fullscreenElement === el) {
                await document.exitFullscreen();
                return;
            }

            if (!document.fullscreenElement) {
                await el.requestFullscreen();
            }
        } catch (err) {
            console.warn('Fullscreen toggle failed', err);
        }
    };

    return (
        <div ref={containerRef} className={`flex flex-col items-center w-full bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 ${isFullscreen ? 'h-screen rounded-none p-3 md:p-6' : ''}`}>
            <div className="flex gap-4 mb-4 bg-slate-100 dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-10">
                <button onClick={() => setActiveTool('draw')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${activeTool === 'draw' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <PenTool size={18} /> Red Pen
                </button>
                <button onClick={() => setActiveTool('check')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${activeTool === 'check' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Check size={18} /> Stamp ✓
                </button>
                <button onClick={() => setActiveTool('cross')} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${activeTool === 'cross' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <X size={18} /> Stamp ✗
                </button>
                <div className="w-px bg-slate-700 mx-2"></div>
                <button onClick={clearDrawings} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                    <RotateCcw size={18} /> Reset
                </button>
                <button onClick={toggleFullscreen} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
            </div>
            <div className={`border-2 border-slate-700 shadow-2xl rounded-lg overflow-auto bg-white max-w-full ${isFullscreen ? 'h-full w-full flex items-start justify-center' : ''}`}>
                <canvas
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        maxWidth: 'none',
                        maxHeight: 'none',
                    }}
                />
            </div>
        </div>
    );
});

export default GradingCanvas;