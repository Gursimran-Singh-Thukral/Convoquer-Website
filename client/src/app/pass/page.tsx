'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { apiPost, ApiError, fetchActiveEventId, type Participant } from '@/lib/api';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// India-format WhatsApp/mobile number: a 6-9 leading digit and 9 more digits (10 total, no country code — that's fixed to +91 in the UI).
const PHONE_PATTERN = /^[6-9]\d{9}$/;

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3MB, kept small since it's stored as a data URL

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AudiencePassPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(true);

  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [category, setCategory] = useState<'AUDIENCE' | 'GUEST' | 'ATHLETE'>('AUDIENCE');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [idDataUrl, setIdDataUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedPass, setSubmittedPass] = useState<Participant | null>(null);

  const handleFileChange = async (kind: 'photo' | 'id', file: File | null) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (JPG, PNG, etc).');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('That image is too large — please use a photo under 3MB.');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    if (kind === 'photo') setPhotoDataUrl(dataUrl);
    else setIdDataUrl(dataUrl);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      const id = await fetchActiveEventId();
      if (!cancelled) {
        setEventId(id);
        setEventLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetForm = () => {
    setName('');
    setCollege('');
    setRollNo('');
    setPhone('');
    setGender('');
    setCategory('AUDIENCE');
    setPhotoDataUrl(null);
    setIdDataUrl(null);
    setPhoneError(null);
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setUploadError(null);

    if (!name.trim() || !phone.trim()) return;
    if (!PHONE_PATTERN.test(phone.trim())) {
      setPhoneError('Enter a valid 10-digit WhatsApp/mobile number starting with 6-9.');
      return;
    }
    if (!photoDataUrl) {
      setUploadError('A photograph of yourself is required.');
      return;
    }
    if (!idDataUrl) {
      setUploadError('A photo of your Aadhaar or college ID is required.');
      return;
    }
    if (!eventId) {
      setSubmitError('No active event found on the backend — cannot issue a pass right now.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiPost<{ message: string; attendee: Participant }>(
        '/security/on-spot-pass',
        {
          eventId,
          name: name.trim(),
          contactNumber: `+91${phone.trim()}`,
          category,
          instituteName: college.trim() || undefined,
          rollNumber: rollNo.trim() || undefined,
          gender: gender || undefined,
          photographUrl: photoDataUrl,
          idDocumentUrl: idDataUrl,
        },
      );
      setSubmittedPass(res.attendee);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not issue the gate pass. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      <LiveTickerRibbon />
      <Navbar />

      {/* Top Banner */}
      <section className="bg-[#151317] border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#701A2B] border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700] shrink-0 shadow-md">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-display font-extrabold text-sm sm:text-base text-white uppercase tracking-wider block">
              AUDIENCE &amp; SPECTATOR ON-SPOT GATE PASS KIOSK
            </h1>
            <span className="text-xs font-mono text-gray-400">
              Convoquer&apos;26 • Instant Security Desk Verification Queue
            </span>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {eventLoading ? (
          <div className="text-center py-6 text-xs font-mono text-zinc-400">
            Resolving active event...
          </div>
        ) : !eventId ? (
          <div className="bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-2xl p-4 text-xs font-mono mb-6">
            No active event found on the backend. Registration is unavailable until an event is
            marked ACTIVE.
          </div>
        ) : null}

        {!submittedPass ? (
          <div className="bg-[#121114] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="border-b border-white/10 pb-4">
              <span className="text-[11px] font-mono text-[#FFD700] uppercase font-bold tracking-widest block mb-1">
                SELF-SERVICE SPECTATOR REGISTRATION
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white uppercase tracking-wide">
                Apply for Convoquer&apos;26 Campus Entry Pass
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Spectators and visiting students provide their identity details below. This
                immediately synchronizes to the Security Clearance Desk queue and a gate pass number
                is issued instantly. Bring a physical student/government ID for the guard to
                cross-check at Gate 1 or Gate 2.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 text-xs font-mono">
              {/* Row 1: Name & College */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ananya Mahajan"
                    className="w-full bg-[#1B191E] border border-white/15 focus:border-[#FFD700] text-white px-3.5 py-2.5 rounded-xl focus:outline-none transition-all placeholder:text-zinc-600 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    College / Institute / Affiliation
                  </label>
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. University of Jammu / SMVDU Katra"
                    className="w-full bg-[#1B191E] border border-white/15 focus:border-[#FFD700] text-white px-3.5 py-2.5 rounded-xl focus:outline-none transition-all placeholder:text-zinc-600 text-sm"
                  />
                </div>
              </div>

              {/* Row 2: Roll No & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    Student Roll No / Government ID No
                  </label>
                  <input
                    type="text"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="e.g. 2024JU-7890 or Aadhaar/PAN"
                    className="w-full bg-[#1B191E] border border-white/15 focus:border-[#FFD700] text-white px-3.5 py-2.5 rounded-xl focus:outline-none transition-all placeholder:text-zinc-600 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    WhatsApp / Contact Phone *
                  </label>
                  <div
                    className={`flex items-center bg-[#1B191E] border rounded-xl overflow-hidden focus-within:outline-none transition-all ${
                      phoneError
                        ? 'border-rose-500/60 focus-within:border-rose-500'
                        : 'border-white/15 focus-within:border-[#FFD700]'
                    }`}
                  >
                    <span className="px-3 py-2.5 text-zinc-400 text-sm border-r border-white/10 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(digitsOnly);
                        if (phoneError) setPhoneError(null);
                      }}
                      placeholder="98765 43210"
                      className="flex-1 min-w-0 bg-transparent text-white px-3.5 py-2.5 focus:outline-none placeholder:text-zinc-600 text-sm"
                    />
                  </div>
                  {phoneError && <p className="text-rose-400 text-[11px] mt-1">{phoneError}</p>}
                </div>
              </div>

              {/* Row 2b: Photograph & ID Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    Your Photograph *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    required
                    onChange={(e) => handleFileChange('photo', e.target.files?.[0] || null)}
                    className="w-full bg-[#1B191E] border border-white/15 focus:border-[#FFD700] text-zinc-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#701A2B] file:text-white file:text-[11px] file:font-bold file:uppercase px-2 py-2 rounded-xl focus:outline-none transition-all text-xs"
                  />
                  {photoDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoDataUrl}
                      alt="Preview of your photograph"
                      className="mt-2 w-16 h-16 rounded-lg object-cover border border-white/15"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    Aadhaar / College ID Photo *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => handleFileChange('id', e.target.files?.[0] || null)}
                    className="w-full bg-[#1B191E] border border-white/15 focus:border-[#FFD700] text-zinc-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#701A2B] file:text-white file:text-[11px] file:font-bold file:uppercase px-2 py-2 rounded-xl focus:outline-none transition-all text-xs"
                  />
                  {idDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={idDataUrl}
                      alt="Preview of your ID document"
                      className="mt-2 w-16 h-16 rounded-lg object-cover border border-white/15"
                    />
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs font-mono">
                  {uploadError}
                </div>
              )}

              {/* Row 3: Category & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    Visitor Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as 'AUDIENCE' | 'GUEST' | 'ATHLETE')
                    }
                    className="w-full bg-[#1B191E] border border-white/15 focus:border-[#FFD700] text-white px-3 py-2.5 rounded-xl focus:outline-none transition-all text-sm"
                  >
                    <option value="AUDIENCE">General Spectator / Visitor</option>
                    <option value="GUEST">Institute Alumni / Guest</option>
                    <option value="ATHLETE">Walk-in / Unlisted Athlete</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 uppercase mb-1.5 font-bold">
                    Gender (optional)
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-[#1B191E] border border-white/15 focus:border-[#FFD700] text-white px-3 py-2.5 rounded-xl focus:outline-none transition-all text-sm"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs font-mono">
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || eventLoading || !eventId}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#701A2B] to-[#800020] hover:from-[#882236] hover:to-[#9c062a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-display text-sm font-bold uppercase tracking-wider transition-all border border-[#FFD700]/40 shadow-xl flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  <svg
                    className="w-4 h-4 text-[#FFD700]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{submitting ? 'Submitting...' : 'Submit Details & Issue Gate Pass'}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Successfully Issued Pass Card */
          <div className="bg-[#121114] border-2 border-[#FFD700]/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-display font-black text-xl text-white uppercase tracking-wide">
                    Digital Pass Generated Successfully
                  </h2>
                  <span className="text-xs font-mono text-emerald-400">
                    Transmitted immediately to Security Desk Live Queue
                  </span>
                </div>
              </div>

              <div className="px-3 py-1 rounded bg-[#701A2B] border border-[#FFD700]/40 text-[#FFD700] font-mono text-xs font-bold">
                {submittedPass.gatePassNumber || 'NO PASS #'}
              </div>
            </div>

            {/* Pass Preview Card */}
            <div className="bg-gradient-to-br from-[#1C1822] to-[#121016] border border-white/15 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-[#FFD700] bg-[#26202b] shrink-0 shadow-lg flex items-center justify-center">
                    <span className="font-display font-bold text-2xl text-[#FFD700]">
                      {initialsOf(submittedPass.name)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {submittedPass.isCheckedIn
                        ? 'Checked In At Kiosk'
                        : 'Awaiting Gate Officer Clearance'}
                    </div>
                    <h3 className="font-display font-extrabold text-2xl text-white uppercase tracking-wide">
                      {submittedPass.name}
                    </h3>
                    <p className="text-xs text-zinc-300 font-mono">
                      {submittedPass.institute?.name || 'General Public / Spectator'}
                      {submittedPass.rollNumber ? (
                        <>
                          {' '}
                          • Roll: <strong>{submittedPass.rollNumber}</strong>
                        </>
                      ) : null}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono">
                      Phone: {submittedPass.contactNumber} • {submittedPass.category}
                    </p>
                  </div>
                </div>

                {/* Gate Pass Code (text-based; there is no scanned ID/QR image in the backend) */}
                <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block font-bold">
                    GATE PASS CODE
                  </span>
                  <div className="w-32 h-20 sm:ml-auto rounded-xl border-2 border-dashed border-[#FFD700]/50 bg-black/40 shadow flex items-center justify-center px-2">
                    <span className="font-mono text-sm font-bold text-[#FFD700] text-center break-all">
                      {submittedPass.gatePassNumber || '—'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 block">
                    Show this code with your physical ID at the gate
                  </span>
                </div>
              </div>
            </div>

            {/* Instructions & Next Step */}
            <div className="bg-[#18151c] rounded-xl p-4 border border-zinc-800 text-xs font-mono space-y-2">
              <span className="text-[#FFD700] uppercase font-bold block">Next Steps at Gate:</span>
              <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                <li>
                  Proceed directly to <strong>Gate 1 (North Main)</strong>.
                </li>
                <li>
                  Your entry is now visible on the station officer&apos;s security terminal under{' '}
                  <strong>Live Audience Queue</strong>.
                </li>
                <li>
                  Show your physical ID card and quote gate pass code{' '}
                  <strong>{submittedPass.gatePassNumber || '—'}</strong> to the guard for
                  cross-check.
                </li>
              </ol>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSubmittedPass(null);
                  resetForm();
                }}
                className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display text-xs font-bold uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2 shadow-lg"
              >
                Register Another Visitor
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
