'use client';
import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import axios from '@/lib/axios';
import { X, UploadCloud, Trash2, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { emitStudentActivity } from '@/lib/studentActivity';
import { socket } from '@/lib/socket';

export default function AvatarUploader({ user, onClose }) {
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [uploading, setUploading] = useState(false);

    // 1. Select File
    const onFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const imageDataUrl = await readFile(file);
            setImageSrc(imageDataUrl);
        }
    };

    // Helper to read file
    const readFile = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result), false);
            reader.readAsDataURL(file);
        });
    };

    // 2. Capture Crop Data
    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    // 3. Generate Image
    const getCroppedImg = async (imageSrc, pixelCrop) => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg');
        });
    };

    const createImage = (url) =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.src = url;
        });

    // 4. Upload Logic
    // ... imports

// Update ONLY the handleUpload function inside the component
    const handleUpload = async () => {
        // 1. CHECK IF IMAGE EXISTS
        if (!imageSrc) return alert("Please select an image first");
        
        setUploading(true);
        
        try {
            // 2. Generate Cropped Image Blob
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            
            // 3. Prepare Form Data
            const fd = new FormData();
            // Note: We create a filename here because blob doesn't have one
            fd.append('avatar', croppedBlob, 'avatar.jpg');

            // 4. Send to Server
            const res = await axios.post(`/user/avatar/${user.id}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // 5. Update Local Storage
            const storedUser = JSON.parse(localStorage.getItem('sft_user'));
            if (storedUser) {
                storedUser.avatar = res.data.avatar; 
                localStorage.setItem('sft_user', JSON.stringify(storedUser));
            }

            emitStudentActivity(socket, user, {
                page: 'Profile Photo',
                action: 'Updated Avatar',
                detail: 'Saved new profile photo',
                route: '/student/profile',
                kind: 'profile'
            });

            alert("Profile Photo Updated!");
            window.location.reload(); 

        } catch (e) {
            console.error(e);
            alert("Upload Failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };
// ... rest of component

    const handleRemove = async () => {
        if (!confirm("Remove profile photo?")) return;
        try {
            await axios.delete(`/user/avatar/${user.id}`);
            
            // UPDATE STORAGE INSTANTLY
            const storedUser = JSON.parse(localStorage.getItem('sft_user'));
            if (storedUser) {
                storedUser.avatar = null; // Clear it
                localStorage.setItem('sft_user', JSON.stringify(storedUser));
            }

            emitStudentActivity(socket, user, {
                page: 'Profile Photo',
                action: 'Removed Avatar',
                detail: 'Deleted current profile photo',
                route: '/student/profile',
                kind: 'profile'
            });

            window.location.reload();
        } catch (e) { alert("Failed"); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-lg rounded-[45px] overflow-hidden shadow-2xl text-slate-900 flex flex-col max-h-[90vh]">
                
                <div className="p-6 border-b flex justify-between items-center bg-red-50 text-red-600 font-black italic tracking-widest text-xs uppercase z-20">
                    {imageSrc ? "Adjust Photo" : "Upload Photo"}
                    <button onClick={onClose}><X size={24}/></button>
                </div>

                <div className="relative flex-1 bg-slate-100 min-h-[300px]">
                    {imageSrc ? (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="round"
                            showGrid={false}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
                            <label className="flex flex-col items-center justify-center gap-4 w-full h-full border-4 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-white hover:border-red-200 transition-all group">
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <UploadCloud className="text-slate-300 group-hover:text-red-500" size={32}/>
                                </div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-red-500">Tap to Select Image</span>
                                <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                            </label>
                        </div>
                    )}
                </div>

                {imageSrc && (
                    <div className="p-6 bg-white z-20 space-y-6">
                        <div className="flex items-center gap-4">
                            <ZoomOut size={16} className="text-slate-400"/>
                            <input 
                                type="range" 
                                value={zoom} 
                                min={1} 
                                max={3} 
                                step={0.1} 
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(e.target.value)}
                                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600"
                            />
                            <ZoomIn size={16} className="text-slate-400"/>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setImageSrc(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200">
                                Change
                            </button>
                            <button 
                                onClick={handleUpload} 
                                disabled={uploading} 
                                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                            >
                                {uploading ? "Processing..." : <><Check size={16}/> Save Photo</>}
                            </button>
                        </div>
                    </div>
                )}

                {!imageSrc && user.avatar && (
                    <div className="p-6 bg-white border-t border-slate-100">
                        <button onClick={handleRemove} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-[10px] hover:bg-red-100 flex items-center justify-center gap-2">
                            <Trash2 size={16}/> Remove Current Photo
                        </button>
                    </div>
                )}

            </motion.div>
        </div>
    );
}