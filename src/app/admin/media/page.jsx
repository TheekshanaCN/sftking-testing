'use client';
import { useState, useEffect } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Search, Loader2, Copy, Lock, ShieldCheck, Edit3, X } from 'lucide-react';

export default function MediaLibrary() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);

  // Rename States
  const [renamingFile, setRenamingFile] = useState(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/admin/vault/files');
      const data = await res.json();
      if (data.success) setFiles(data.files);
    } catch (e) {
      console.error("Failed to load vault:", e);
    }
  };

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setUploading(true);

    try {
      // Upload all selected files simultaneously
      await Promise.all(selectedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        await fetch('/api/admin/vault/upload', {
          method: 'POST',
          body: formData
        });
      }));
      
      fetchMedia(); // Refresh vault once all uploads complete
    } catch (e) {
      alert("Error uploading some files.");
    } finally {
      setUploading(false);
      e.target.value = null; // Reset input to allow re-uploading the same files if needed
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    setDeleting(filename);
    try {
      const res = await fetch(`/api/admin/vault/files/${filename}`, { method: 'DELETE' });
      if (res.ok) setFiles(prev => prev.filter(f => f.name !== filename));
    } catch (e) {
      alert("Error deleting");
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === renamingFile.name) {
      setRenamingFile(null);
      return;
    }

    setIsRenaming(true);
    try {
      const res = await fetch(`/api/admin/vault/files/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldFilename: renamingFile.name,
          newFilename: newName
        })
      });

      const data = await res.json();
      
      if (data.success) {
        fetchMedia(); // Reload the library to show the new name
        setRenamingFile(null);
      } else {
        alert(data.message || "Rename failed");
      }
    } catch (e) {
      alert("Error renaming file");
    } finally {
      setIsRenaming(false);
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    // 🚀 DARK MODE: Background and Base Text
    <div className="min-h-screen bg-gray-50 dark:bg-transparent p-8 text-slate-800 dark:text-slate-200 font-sans relative transition-colors duration-300">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div>
           <h1 className="text-4xl font-[1000] text-slate-900 dark:text-white uppercase italic tracking-tighter flex items-center gap-3 transition-colors duration-300">
             <ShieldCheck className="text-red-600 dark:text-red-500" size={32}/>
             Media Vault
           </h1>
           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2 transition-colors duration-300">
             <Lock size={12} className="text-red-500 dark:text-red-400"/>
             <span>{files.length} Secure Files</span>
             <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full transition-colors duration-300"></span>
             <span>Hidden from Public Internet</span>
           </p>
        </div>
        
        {/* 🚀 DARK MODE: Search & Upload Container */}
        <div className="flex gap-3 w-full md:w-auto bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 transition-colors duration-300">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-3 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search secure files..." 
              className="w-full h-full bg-transparent pl-10 pr-4 outline-none text-sm font-semibold text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-300"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Upload Button */}
          <label className="flex items-center gap-2 bg-slate-900 dark:bg-slate-800 hover:bg-red-600 dark:hover:bg-red-600 text-white px-5 py-2.5 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:shadow-red-600/30 text-xs font-black uppercase tracking-wider">
            {uploading ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16} />}
            <span>Upload New</span>
            <input type="file" multiple className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>

      {/* GRID LAYOUT */}
      {files.length === 0 && !uploading ? (
          // 🚀 DARK MODE: Empty State
          <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 transition-colors duration-300">
             <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 transition-colors duration-300">
                <Lock size={32} className="text-gray-300 dark:text-slate-600"/>
             </div>
             <p className="text-lg font-bold text-slate-400 dark:text-slate-500 transition-colors duration-300">The Vault is Empty</p>
             <p className="text-sm text-slate-400 dark:text-slate-600 transition-colors duration-300">Upload PDFs or Images securely</p>
          </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {filteredFiles.map((file) => {
              const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const sizeMB = (file.size / 1024 / 1024).toFixed(2);
              const displayName = file.name.split('_').slice(1).join('_') || file.name; 
              
              return (
                // 🚀 DARK MODE: File Card
                <div key={file.name} className="group relative bg-white dark:bg-slate-900 rounded-2xl p-4 flex flex-col items-center shadow-sm border border-gray-100 dark:border-white/5 hover:shadow-xl dark:hover:shadow-2xl hover:border-red-100 dark:hover:border-red-500/30 transition-all duration-300 hover:-translate-y-1">
                  
                  {/* Icon / Preview Box */}
                  <div className="w-full aspect-square bg-gray-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-center mb-4 overflow-hidden relative group-hover:bg-red-50/30 dark:group-hover:bg-red-500/10 transition-colors duration-300">
                    {isImage ? (
                        <div className="flex flex-col items-center gap-2">
                           <ImageIcon size={32} className="text-slate-300 dark:text-slate-600 group-hover:text-red-400 dark:group-hover:text-red-500 transition-colors duration-300"/>
                           <span className="text-[10px] font-bold text-slate-300 dark:text-slate-500 uppercase transition-colors duration-300">Image</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <FileText size={40} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors duration-300"/>
                            <span className="text-[10px] font-bold text-slate-300 dark:text-slate-500 uppercase transition-colors duration-300">Document</span>
                        </div>
                    )}
                    
                    {/* Secure Badge */}
                    <div className="absolute top-3 right-3">
                        <Lock size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors duration-300"/>
                    </div>
                  </div>

                  {/* File Info */}
                  <div className="w-full text-center">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-full mb-1 transition-colors duration-300" title={displayName}>
                        {displayName}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase bg-gray-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded-md transition-colors duration-300">
                        {sizeMB} MB
                      </p>
                  </div>

                  {/* Hover Actions (Overlay) */}
                  <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center gap-2 backdrop-blur-[2px] p-4">
                     
                     {/* Copy Secure Link */}
                     <button 
                       onClick={() => {
                          const link = `${window.location.origin}/api/secure-vault/${file.name}`;
                          navigator.clipboard.writeText(link);
                          alert("Secure Tunnel Link Copied!");
                       }}
                       className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-black dark:hover:bg-slate-700 text-xs font-bold shadow-lg transition-transform hover:scale-105"
                     >
                       <Copy size={12} /> Copy Link
                     </button>

                     {/* Rename Button */}
                     <button 
                       onClick={() => {
                           const cleanName = file.name.split('_').slice(1).join('_') || file.name;
                           const nameWithoutExt = cleanName.split('.').slice(0, -1).join('.') || cleanName;
                           setRenamingFile(file);
                           setNewName(nameWithoutExt);
                       }}
                       className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-bold transition-colors"
                     >
                       <Edit3 size={12} /> Rename
                     </button>

                     {/* Delete Button */}
                     <button 
                        onClick={() => handleDelete(file.name)}
                        disabled={deleting === file.name}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 text-xs font-bold transition-colors"
                     >
                       {deleting === file.name ? <Loader2 className="animate-spin" size={12}/> : <Trash2 size={12} />} 
                       Delete
                     </button>

                  </div>
                </div>
              );
          })}
        </div>
      )}

      {/* RENAME MODAL */}
      {renamingFile && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 transition-colors duration-300">
            <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-white/10 rounded-3xl p-6 shadow-2xl w-full max-w-sm relative transition-colors duration-300">
               <button 
                 onClick={() => setRenamingFile(null)} 
                 className="absolute top-4 right-4 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
               >
                 <X size={20}/>
               </button>
               
               <h3 className="text-lg font-black uppercase text-slate-800 dark:text-white mb-2 flex items-center gap-2 transition-colors duration-300">
                 <Edit3 className="text-blue-500 dark:text-blue-400" size={20}/> Rename File
               </h3>
               <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 leading-relaxed transition-colors duration-300">
                 Don't worry about the file extension (like .pdf), we'll keep it safe automatically.
               </p>

               <input 
                 autoFocus
                 type="text" 
                 value={newName} 
                 onChange={(e) => setNewName(e.target.value)}
                 placeholder="Enter new name..."
                 className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 mb-6 transition-colors duration-300"
               />

               <button 
                 onClick={handleRename}
                 disabled={isRenaming}
                 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[10px] py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
               >
                 {isRenaming ? <Loader2 className="animate-spin" size={16}/> : 'Save New Name'}
               </button>
            </div>
         </div>
      )}
    </div>
  );
}