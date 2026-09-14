import React, { useState, useRef } from 'react';
import { Camera, User, ArrowRight, X, CheckCircle2, Pencil } from 'lucide-react';

/**
 * PersonalDetailsPage
 * ─────────────────────────────────────────────────────────────────
 * Step 1 of the new-user onboarding flow (shown right after registration).
 * Lets the user upload a profile photo + fill their name/title.
 * The entire step can be skipped with "Skip for now →".
 *
 * Props
 *  onComplete(details)  – called when user hits Continue.
 *                         details = { fullName, jobTitle, photoFile, photoPreview }
 *  onSkip()             – called when user clicks Skip.
 */
export default function PersonalDetailsPage({ onComplete, onSkip }) {
  const [fullName, setFullName]       = useState('');
  const [jobTitle, setJobTitle]       = useState('');
  const [photoFile, setPhotoFile]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const [saved, setSaved]             = useState(false);

  const fileInputRef = useRef(null);

  // ── Photo helpers ──────────────────────────────────────────────
  const applyPhoto = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => applyPhoto(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    applyPhoto(e.dataTransfer?.files?.[0]);
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhotoFile(null);
    setPhotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleContinue = (e) => {
    e.preventDefault();
    setSaved(true);
    // Persist photo preview in localStorage so the rest of the app can use it
    if (photoPreview) {
      localStorage.setItem('nexus_profile_pic', photoPreview);
    }
    if (fullName.trim()) {
      localStorage.setItem('nexus_display_name', fullName.trim());
    }
    setTimeout(() => {
      onComplete({ fullName: fullName.trim(), jobTitle: jobTitle.trim(), photoFile, photoPreview });
    }, 600);
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 via-sky-50 to-white text-gray-900 font-sans relative overflow-hidden"
    >
      {/* Background decorative blurs */}
      <div className="absolute top-[-120px] left-[-100px] w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-80px]  w-96 h-96 bg-sky-300/20  rounded-full blur-3xl pointer-events-none" />

      {/* ── Header ── */}
      <header className="p-6 flex items-center justify-between max-w-6xl w-full mx-auto relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0a66c2] via-[#0284c7] to-[#38bdf8] flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
            S
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-xl tracking-tight text-gray-900">
              SAHAAL<span className="text-[#0a66c2]">.</span>
            </span>
            <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">
              Intelligence
            </span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-[10px] font-bold">1</span>
            <span className="hidden sm:inline text-gray-600 font-semibold">Profile</span>
          </span>
          <span className="w-6 h-px bg-gray-300" />
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] font-bold">2</span>
            <span className="hidden sm:inline">Resume</span>
          </span>
        </div>

        {/* Skip */}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
        >
          Skip for now <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* ── Main Card ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md">

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 mb-2">
              Let's set up your profile
            </h1>
            <p className="text-sm text-gray-500">
              Add a photo and your details — you can always change these later.
            </p>
          </div>

          <form onSubmit={handleContinue} className="flex flex-col gap-6">

            {/* ── Circular Photo Upload ── */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`relative group cursor-pointer select-none transition-all duration-200 ${
                  dragOver ? 'scale-105' : ''
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {/* Circle avatar */}
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center overflow-hidden border-4 transition-all duration-200 shadow-lg ${
                    dragOver
                      ? 'border-[#0a66c2] shadow-blue-300/50'
                      : photoPreview
                      ? 'border-[#0a66c2]/30'
                      : 'border-dashed border-gray-300 bg-gray-50 hover:border-[#0a66c2] hover:bg-blue-50/50'
                  }`}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-[#0a66c2] transition-colors">
                      <Camera className="w-8 h-8" />
                      <span className="text-[10px] font-semibold">Add Photo</span>
                    </div>
                  )}
                </div>

                {/* Edit overlay on hover */}
                {photoPreview && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="w-6 h-6 text-white" />
                  </div>
                )}

                {/* Remove button */}
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <p className="text-[11px] text-gray-400 text-center">
                Click to upload · Drag & drop · JPG, PNG, WEBP
              </p>
            </div>

            {/* ── Full Name ── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-600 tracking-wide uppercase">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition-all"
                />
              </div>
            </div>

            {/* ── Job Title ── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-600 tracking-wide uppercase">
                Job Title <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition-all"
              />
            </div>

            {/* ── Continue Button ── */}
            <button
              type="submit"
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 shadow-md ${
                saved
                  ? 'bg-emerald-500 text-white shadow-emerald-200'
                  : 'bg-[#0a66c2] hover:bg-[#0952a0] text-white shadow-blue-200 hover:shadow-blue-300 active:scale-[0.98]'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Saved! Moving on…
                </>
              ) : (
                <>
                  Continue to Resume
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Skip inline link */}
            <button
              type="button"
              onClick={onSkip}
              className="text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip this step and add details later
            </button>

          </form>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pb-6 text-center text-[11px] text-gray-300 relative z-10">
        Your information is private and never shared.
      </footer>
    </div>
  );
}
