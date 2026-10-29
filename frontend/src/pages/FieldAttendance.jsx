import React, { useEffect, useState } from 'react';
import { csmService, uploadService } from '../services/api';
import { formatDate } from '../utils/helpers';
import { toast } from 'react-toastify';
import { MdArrowBack, MdCheckCircle, MdClose, MdHowToReg, MdMap, MdPhotoCamera, MdRefresh } from 'react-icons/md';
import Modal from '../components/Modal';
import DateInput from '../components/DateInput';
import { fetchAccurateLocation } from '../utils/reverseGeocode';
import usePermission from '../hooks/usePermission';

// Client-side image compression & resizing helper before upload (max 800x800, quality 0.7)
const compressSelfieImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.onerror = (err) => reject(err);
        reader.onload = (event) => {
            const img = new Image();
            img.onerror = (err) => reject(err);
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            return resolve(file);
                        }
                        const fileName = (file.name || 'selfie.jpg').replace(/\.[^/.]+$/, "") + "_compressed.jpg";
                        const compressedFile = new File([blob], fileName, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        console.log(`Selfie compressed: Original ${(file.size / 1024).toFixed(1)}KB -> Compressed ${(compressedFile.size / 1024).toFixed(1)}KB`);
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
};

const FieldAttendance = () => {
    const { canCreate } = usePermission('csm_attendance');
    const [attendanceList, setAttendanceList] = useState([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [activeAttendance, setActiveAttendance] = useState(null);
    const [todayAttendance, setTodayAttendance] = useState(null);
    const [hasCompletedToday, setHasCompletedToday] = useState(false);
    const [showAttendanceForm, setShowAttendanceForm] = useState(false);
    const [checkInAreaName, setCheckInAreaName] = useState('');
    const [checkInAddress, setCheckInAddress] = useState('');
    const [checkInLat, setCheckInLat] = useState(null);
    const [checkInLng, setCheckInLng] = useState(null);
    const [checkInSelfie, setCheckInSelfie] = useState('');
    const [checkInNotes, setCheckInNotes] = useState('');
    const [uploadingSelfie, setUploadingSelfie] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
    const [submittingCheckOut, setSubmittingCheckOut] = useState(false);
    const [attendanceDateFilter, setAttendanceDateFilter] = useState('');
    const [selectedAttendanceSelfie, setSelectedAttendanceSelfie] = useState(null);

    // Check-Out Form State & Logic
    const [showCheckOutForm, setShowCheckOutForm] = useState(false);
    const [checkOutAreaName, setCheckOutAreaName] = useState('');
    const [checkOutAddress, setCheckOutAddress] = useState('');
    const [checkOutLat, setCheckOutLat] = useState(null);
    const [checkOutLng, setCheckOutLng] = useState(null);
    const [checkOutSelfie, setCheckOutSelfie] = useState('');
    const [checkOutNotes, setCheckOutNotes] = useState('');
    const [uploadingCheckOutSelfie, setUploadingCheckOutSelfie] = useState(false);
    const [isCheckOutLocating, setIsCheckOutLocating] = useState(false);

    const currentUser = (() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
            return {};
        }
    })();

    const fetchGpsLocation = () => {
        setIsLocating(true);
        setCheckInAddress('Locking onto high-precision GPS signal...');

        const handleGpsUnavailable = () => {
            setCheckInLat(null);
            setCheckInLng(null);
            setCheckInAddress('');
            toast.warn('Could not get GPS location. Please allow location access or type the street address.');
            setIsLocating(false);
        };

        if (!navigator.geolocation) {
            handleGpsUnavailable();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setCheckInLat(lat);
                setCheckInLng(lng);

                const locData = await fetchAccurateLocation(lat, lng);
                setCheckInAddress(locData.address);
                if (locData.areaName) {
                    setCheckInAreaName(prev => prev ? prev : locData.areaName);
                }
                setIsLocating(false);
            },
            (err) => {
                console.warn('Geolocation error:', err);
                handleGpsUnavailable();
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const fetchAttendanceRecords = async () => {
        setLoadingAttendance(true);
        try {
            const params = {};
            if (attendanceDateFilter) params.date = attendanceDateFilter;

            // The register shows only the signed-in user's own attendance (enforced by the API).
            const res = await csmService.getAttendance(params);
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setAttendanceList(data);
        } catch (error) {
            console.error('Failed to load attendance history', error);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const fetchActiveAttendance = async () => {
        try {
            const res = await csmService.getActiveAttendance();
            setActiveAttendance(res.data?.activeRecord || null);
            setTodayAttendance(res.data?.todayRecord || null);
            setHasCompletedToday(!!res.data?.hasCompletedToday);
            if (!res.data?.activeRecord && !res.data?.hasCompletedToday) {
                fetchGpsLocation();
            } else if (res.data?.activeRecord) {
                setCheckOutAreaName(res.data.activeRecord.checkInLocation?.areaName || '');
                setCheckOutAddress(res.data.activeRecord.checkInLocation?.address || '');
                fetchCheckOutGpsLocation();
            }
        } catch (error) {
            console.error('Failed to fetch active attendance status', error);
        }
    };

    const handleOpenAttendanceModal = () => {
        if (hasCompletedToday) {
            toast.error('You have already completed your check-in for today. Users are allowed to check in only once per day.');
            return;
        }
        setCheckInAreaName('');
        setCheckInAddress('Locking onto high-precision GPS signal...');
        setCheckInLat(null);
        setCheckInLng(null);
        setCheckInSelfie('');
        setCheckInNotes('');
        setShowAttendanceForm(true);
        fetchGpsLocation();
    };

    const handleSelfieChange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setUploadingSelfie(true);
        try {
            const compressedFile = await compressSelfieImage(file);
            const res = await uploadService.uploadImage(compressedFile);
            const photoUrl = res.data?.url || res.data?.imageUrl;
            if (photoUrl) {
                setCheckInSelfie(photoUrl);
                toast.success('Selfie compressed & uploaded successfully!');
            } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCheckInSelfie(reader.result);
                    toast.success('Selfie attached!');
                };
                reader.readAsDataURL(compressedFile);
            }
        } catch (err) {
            console.error('Selfie compress/upload error', err);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCheckInSelfie(reader.result);
                toast.success('Selfie attached!');
            };
            reader.readAsDataURL(file);
        } finally {
            setUploadingSelfie(false);
        }
    };

    const handleSubmitAttendanceCheckIn = async (e) => {
        e.preventDefault();
        if (!checkInSelfie) {
            toast.error('Selfie photo is mandatory to mark Check-In');
            return;
        }
        if (!checkInAreaName.trim()) {
            toast.error('Area Name is required');
            return;
        }

        setSubmittingCheckIn(true);
        try {
            const payload = {
                employeeName: currentUser.name || 'Field Engineer',
                areaName: checkInAreaName.trim(),
                address: checkInAddress,
                latitude: checkInLat,
                longitude: checkInLng,
                selfieUrl: checkInSelfie,
                notes: checkInNotes
            };
            await csmService.checkInAttendance(payload);
            toast.success('Field Attendance Check-In recorded successfully!');
            setShowAttendanceForm(false);
            fetchActiveAttendance();
            fetchAttendanceRecords();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Attendance Check-In failed');
        } finally {
            setSubmittingCheckIn(false);
        }
    };

    const handleOpenCheckOutModal = () => {
        if (!activeAttendance) return;
        setCheckOutAreaName(activeAttendance.checkInLocation?.areaName || '');
        setCheckOutAddress(activeAttendance.checkInLocation?.address || 'Acquiring high-accuracy GPS signal...');
        setCheckOutLat(activeAttendance.checkInLocation?.latitude || null);
        setCheckOutLng(activeAttendance.checkInLocation?.longitude || null);
        setCheckOutSelfie('');
        setCheckOutNotes(activeAttendance.notes || '');
        setShowCheckOutForm(true);
        fetchCheckOutGpsLocation();
    };

    const fetchCheckOutGpsLocation = () => {
        if (!navigator.geolocation) return;
        setIsCheckOutLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setCheckOutLat(lat);
                setCheckOutLng(lng);
                const locData = await fetchAccurateLocation(lat, lng);
                if (locData.address) setCheckOutAddress(locData.address);
                if (locData.areaName && !checkOutAreaName) setCheckOutAreaName(locData.areaName);
                setIsCheckOutLocating(false);
            },
            (err) => {
                console.warn('GPS failed on check-out:', err);
                setIsCheckOutLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleCheckOutSelfieChange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setUploadingCheckOutSelfie(true);
        try {
            const compressedFile = await compressSelfieImage(file);
            const res = await uploadService.uploadImage(compressedFile);
            const photoUrl = res.data?.url || res.data?.imageUrl;
            if (photoUrl) {
                setCheckOutSelfie(photoUrl);
                toast.success('Check-Out selfie compressed & uploaded successfully!');
            } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCheckOutSelfie(reader.result);
                    toast.success('Check-Out selfie attached!');
                };
                reader.readAsDataURL(compressedFile);
            }
        } catch (err) {
            console.error('Check-Out selfie compress/upload error', err);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCheckOutSelfie(reader.result);
                toast.success('Check-Out selfie attached!');
            };
            reader.readAsDataURL(file);
        } finally {
            setUploadingCheckOutSelfie(false);
        }
    };

    const handleSubmitAttendanceCheckOutModal = async (e) => {
        e.preventDefault();
        if (!activeAttendance) return;
        if (!checkOutSelfie) {
            toast.error('Selfie photo is mandatory to mark Check-Out');
            return;
        }
        if (!checkOutAreaName.trim()) {
            toast.error('Area / Site Name is required');
            return;
        }

        setSubmittingCheckOut(true);
        try {
            const payload = {
                attendanceId: activeAttendance._id,
                areaName: checkOutAreaName.trim(),
                address: checkOutAddress,
                latitude: checkOutLat,
                longitude: checkOutLng,
                checkOutSelfieUrl: checkOutSelfie,
                notes: checkOutNotes
            };
            await csmService.checkOutAttendance(payload);
            toast.success('Field Attendance Check-Out recorded successfully!');
            setShowCheckOutForm(false);
            fetchActiveAttendance();
            fetchAttendanceRecords();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Attendance Check-Out failed');
        } finally {
            setSubmittingCheckOut(false);
        }
    };

    useEffect(() => {
        fetchActiveAttendance();
    }, []);

    useEffect(() => {
        fetchAttendanceRecords();
    }, [attendanceDateFilter]);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit uppercase">
                    Field Engineer Attendance
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
                    Track daily engineer duty, check-in timestamps, GPS location, and selfie verification.
                </p>
            </div>

            {showAttendanceForm ? (
                /* Full Page Check-In Form View */
                <div className="space-y-6 max-w-3xl mx-auto animate-fade-in-up">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                        <button
                            type="button"
                            onClick={() => setShowAttendanceForm(false)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                            <MdArrowBack size={18} />
                            Back to Attendance Register
                        </button>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Field Duty Check-In Page
                        </span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit uppercase tracking-tight">
                                    Field Engineer Attendance Check-In
                                </h2>
                                <div className="w-16 h-1.5 bg-emerald-500 rounded-full mt-1.5" />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAttendanceForm(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                title="Close Form View"
                            >
                                <MdClose size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAttendanceCheckIn} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Employee Name
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={currentUser.name || 'Field Engineer'}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Area / Site Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Aditraj Complex, Jodhpur Village..."
                                    value={checkInAreaName}
                                    onChange={(e) => setCheckInAreaName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                />
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        GPS Location / Exact Street Address *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={fetchGpsLocation}
                                        disabled={isLocating}
                                        className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 cursor-pointer transition-colors"
                                        title="Re-query device GPS hardware for maximum precision"
                                    >
                                        <MdRefresh size={14} className={isLocating ? 'animate-spin' : ''} />
                                        {isLocating ? 'Acquiring GPS...' : 'Refresh High-Accuracy GPS'}
                                    </button>
                                </div>
                                <textarea
                                    rows={2}
                                    value={checkInAddress}
                                    onChange={(e) => setCheckInAddress(e.target.value)}
                                    placeholder="Auto-detecting exact location or type full street address..."
                                    className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none leading-relaxed resize-none shadow-inner"
                                />
                                {checkInLat && checkInLng && (
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                        <p className="text-[10px] font-mono text-teal-700 dark:text-teal-300 font-bold">
                                            Lat: {checkInLat.toFixed(5)}, Lng: {checkInLng.toFixed(5)}
                                        </p>
                                        <a
                                            href={`https://www.google.com/maps?q=${checkInLat},${checkInLng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                                        >
                                            <MdMap size={12} /> View Map Pin
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Selfie Photo Verification *
                                </label>
                                {checkInSelfie ? (
                                    <div className="relative p-3 bg-slate-50 dark:bg-slate-800 border border-teal-300 dark:border-teal-700 rounded-2xl flex flex-col items-center justify-center space-y-3">
                                        <img src={checkInSelfie} alt="Selfie" className="h-44 rounded-xl object-cover shadow-md" />
                                        <div className="flex items-center gap-3">
                                            <label className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md">
                                                Retake Selfie
                                                <input type="file" accept="image/*" capture="user" onChange={handleSelfieChange} className="hidden" />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setCheckInSelfie('')}
                                                className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-400 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
                                        <input type="file" accept="image/*" capture="user" onChange={handleSelfieChange} className="hidden" />
                                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-400 group-hover:text-teal-600 group-hover:border-teal-300 transition-all mb-3">
                                            {uploadingSelfie ? (
                                                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <MdPhotoCamera size={28} />
                                            )}
                                        </div>
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                                            {uploadingSelfie ? 'Uploading Selfie...' : 'Take / Upload Selfie'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-semibold mt-1">
                                            Capture engineer selfie for attendance record
                                        </span>
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Notes / Remarks (Optional)
                                </label>
                                <textarea
                                    placeholder="Optional check-in notes..."
                                    value={checkInNotes}
                                    onChange={(e) => setCheckInNotes(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold h-20 outline-none focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submittingCheckIn || uploadingSelfie}
                                    className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-teal-600/30 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <MdHowToReg size={20} />
                                    {submittingCheckIn ? 'Recording Check-In...' : 'Record Check-In'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : showCheckOutForm ? (
                /* Full Page Check-Out Form View */
                <div className="space-y-6 max-w-3xl mx-auto animate-fade-in-up">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                        <button
                            type="button"
                            onClick={() => setShowCheckOutForm(false)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                            <MdArrowBack size={18} />
                            Back to Attendance Register
                        </button>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Field Duty Check-Out Page
                        </span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit uppercase tracking-tight">
                                    Field Engineer Attendance Check-Out
                                </h2>
                                <div className="w-16 h-1.5 bg-rose-500 rounded-full mt-1.5" />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCheckOutForm(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                title="Close Form View"
                            >
                                <MdClose size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAttendanceCheckOutModal} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Employee Name
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={activeAttendance?.employeeName || currentUser.name || 'Field Engineer'}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Area / Site Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Baner Site, Hinjewadi Phase 1, Pune..."
                                    value={checkOutAreaName}
                                    onChange={(e) => setCheckOutAreaName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-rose-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                />
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        GPS Location / Exact Street Address *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={fetchCheckOutGpsLocation}
                                        disabled={isCheckOutLocating}
                                        className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                        <MdRefresh size={14} className={isCheckOutLocating ? 'animate-spin' : ''} />
                                        {isCheckOutLocating ? 'Acquiring GPS...' : 'Refresh High-Accuracy GPS'}
                                    </button>
                                </div>
                                <textarea
                                    rows={2}
                                    value={checkOutAddress}
                                    onChange={(e) => setCheckOutAddress(e.target.value)}
                                    placeholder="Auto-detecting exact location or type full street address..."
                                    className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none leading-relaxed resize-none shadow-inner"
                                />
                                {checkOutLat && checkOutLng && (
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                        <p className="text-[10px] font-mono text-rose-700 dark:text-rose-300 font-bold">
                                            Lat: {checkOutLat.toFixed(5)}, Lng: {checkOutLng.toFixed(5)}
                                        </p>
                                        <a
                                            href={`https://www.google.com/maps?q=${checkOutLat},${checkOutLng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                                        >
                                            <MdMap size={12} /> View Map Pin
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Check-Out Selfie Photo Verification *
                                </label>
                                {checkOutSelfie ? (
                                    <div className="relative p-3 bg-slate-50 dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-2xl flex flex-col items-center justify-center space-y-3">
                                        <img src={checkOutSelfie} alt="Check-Out Selfie" className="h-44 rounded-xl object-cover shadow-md" />
                                        <div className="flex items-center gap-3">
                                            <label className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md">
                                                Retake Selfie
                                                <input type="file" accept="image/*" capture="user" onChange={handleCheckOutSelfieChange} className="hidden" />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setCheckOutSelfie('')}
                                                className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-400 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
                                        <input type="file" accept="image/*" capture="user" onChange={handleCheckOutSelfieChange} className="hidden" />
                                        <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-400 group-hover:text-rose-600 group-hover:border-rose-300 transition-all mb-3">
                                            {uploadingCheckOutSelfie ? (
                                                <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <MdPhotoCamera size={28} />
                                            )}
                                        </div>
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover:text-rose-700 dark:group-hover:text-rose-300">
                                            {uploadingCheckOutSelfie ? 'Uploading Check-Out Selfie...' : 'Take / Upload Check-Out Selfie'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-semibold mt-1">
                                            Capture engineer selfie for duty check-out
                                        </span>
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                    Check-Out Remarks (Optional)
                                </label>
                                <textarea
                                    placeholder="Optional check-out remarks..."
                                    value={checkOutNotes}
                                    onChange={(e) => setCheckOutNotes(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold h-20 outline-none focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submittingCheckOut || uploadingCheckOutSelfie}
                                    className="w-full py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-600/30 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <MdCheckCircle size={20} />
                                    {submittingCheckOut ? 'Recording Check-Out...' : 'Record Check-Out'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                /* Main Attendance Status & Register Table View */
                <div className="space-y-6">
                    {/* Active Status Card */}
                    <div className={`rounded-[2rem] p-6 border shadow-2xl transition-all relative overflow-hidden ${
                        activeAttendance 
                            ? 'bg-slate-900 text-white border-teal-500/50 shadow-teal-950/40' 
                            : hasCompletedToday
                                ? 'bg-slate-900 text-white border-primary-500/50 shadow-primary-950/40'
                                : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800'
                    }`}>
                        {(activeAttendance || hasCompletedToday) && (
                            <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                        )}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                                    activeAttendance 
                                        ? 'bg-teal-500/20 text-teal-300 border border-teal-400/40' 
                                        : hasCompletedToday
                                            ? 'bg-primary-500/20 text-primary-300 border border-primary-400/40'
                                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                }`}>
                                    {activeAttendance ? <MdCheckCircle size={32} /> : hasCompletedToday ? <MdCheckCircle size={32} /> : <MdHowToReg size={32} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                            activeAttendance 
                                                ? 'bg-teal-500/25 text-teal-200 border-teal-400/40' 
                                                : hasCompletedToday
                                                    ? 'bg-primary-500/25 text-primary-200 border-primary-400/40'
                                                    : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                                        }`}>
                                            {activeAttendance 
                                                ? 'STATUS: CURRENTLY CHECKED-IN' 
                                                : hasCompletedToday
                                                    ? 'STATUS: ATTENDANCE COMPLETED TODAY'
                                                    : 'STATUS: NOT CHECKED-IN TODAY'}
                                        </span>
                                        <span className={`text-xs font-bold ${activeAttendance || hasCompletedToday ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                            • Field Engineer Duty
                                        </span>
                                    </div>
                                    <h3 className={`text-xl sm:text-2xl font-black font-outfit uppercase mt-1.5 ${activeAttendance || hasCompletedToday ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                        {activeAttendance 
                                            ? activeAttendance.employeeName 
                                            : todayAttendance 
                                                ? todayAttendance.employeeName 
                                                : (currentUser.name || 'Field Engineer')}
                                    </h3>
                                    {activeAttendance ? (
                                        <div className="text-xs text-slate-300 font-medium mt-1 flex flex-wrap items-center gap-1.5 leading-relaxed">
                                            <span>Checked in at</span>
                                            <span className="font-extrabold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-800/80">
                                                {new Date(activeAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span>— Location:</span>
                                            <span className="font-bold text-emerald-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                                                {activeAttendance.checkInLocation?.areaName || 'Field Site'}
                                            </span>
                                            {activeAttendance.checkInLocation?.address && (
                                                <span className="text-slate-400 font-normal">
                                                    ({activeAttendance.checkInLocation.address})
                                                </span>
                                            )}
                                        </div>
                                    ) : hasCompletedToday ? (
                                        <div className="text-xs text-slate-300 font-medium mt-1 flex flex-wrap items-center gap-1.5 leading-relaxed">
                                            <span>Checked-in at</span>
                                            <span className="font-extrabold text-primary-300 bg-primary-950/80 px-2 py-0.5 rounded-md border border-primary-800/80">
                                                {new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span>& Checked-out at</span>
                                            <span className="font-extrabold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/80">
                                                {todayAttendance.checkOutTime ? new Date(todayAttendance.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                            </span>
                                            <span className="text-slate-400 font-medium">• 1 Check-in Daily Limit Reached</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                                            Click the Check-In button to record your field attendance with live GPS location & selfie verification.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                {activeAttendance ? canCreate && (
                                    <button
                                        onClick={handleOpenCheckOutModal}
                                        disabled={submittingCheckOut}
                                        className="px-6 py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 active:scale-95 cursor-pointer"
                                    >
                                        {submittingCheckOut ? 'Checking Out...' : 'CHECK-OUT NOW'}
                                    </button>
                                ) : hasCompletedToday ? (
                                    <button
                                        disabled
                                        className="px-6 py-3.5 bg-slate-800/80 text-slate-400 font-black text-xs uppercase tracking-wider rounded-2xl border border-slate-700/80 flex items-center gap-2 cursor-not-allowed opacity-90 shadow-inner"
                                        title="Daily check-in limit reached"
                                    >
                                        <MdCheckCircle size={18} className="text-emerald-400" />
                                        CHECK-IN COMPLETED FOR TODAY
                                    </button>
                                ) : canCreate && (
                                    <button
                                        onClick={handleOpenAttendanceModal}
                                        className="px-6 py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-teal-600/30 hover:shadow-teal-600/50 active:scale-95 flex items-center gap-2 cursor-pointer"
                                    >
                                        <MdHowToReg size={18} />
                                        CHECK-IN FIELD ATTENDANCE
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>


                {/* Register Filter & Table Card */}
                <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 font-outfit uppercase">
                                My Attendance Register
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold">
                                Your own field check-ins, check-outs, area locations, and selfie captures.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <DateInput
                                type="date"
                                value={attendanceDateFilter}
                                onChange={(e) => setAttendanceDateFilter(e.target.value)}
                                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />

                            <button
                                onClick={fetchAttendanceRecords}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                                title="Refresh Register"
                            >
                                <MdRefresh size={18} />
                            </button>
                        </div>
                    </div>

                    {loadingAttendance ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Attendance Logs...</p>
                        </div>
                    ) : attendanceList.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 space-y-3">
                            <p className="text-base font-bold">No attendance records found.</p>
                            <p className="text-xs">Field check-in records will appear here once engineers mark attendance.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-4 py-3">Employee Name</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Check-In Details</th>
                                        <th className="px-4 py-3">Check-Out Details</th>
                                        <th className="px-4 py-3 text-center">Selfie</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                    {attendanceList.map((rec) => (
                                        <tr key={rec._id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-900">
                                                {rec.employeeName || rec.engineerId?.name || 'Engineer'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {formatDate(rec.attendanceDate)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-0.5">
                                                    <span className="font-bold text-slate-900">
                                                        {new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <p className="text-[10px] text-teal-700 font-bold">{rec.checkInLocation?.areaName || 'Field Location'}</p>
                                                    {rec.checkInLocation?.address && (
                                                        <p className="text-[10px] text-slate-400 max-w-xs truncate">{rec.checkInLocation.address}</p>
                                                    )}
                                                    {rec.checkInLocation?.latitude && rec.checkInLocation?.longitude && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${rec.checkInLocation.latitude},${rec.checkInLocation.longitude}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[9px] font-bold text-teal-600 hover:underline pt-0.5"
                                                        >
                                                            <MdMap size={12} /> Map GPS
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {rec.checkOutTime ? (
                                                    <div className="space-y-0.5">
                                                        <span className="font-bold text-slate-900">
                                                            {new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <p className="text-[10px] text-slate-500">{rec.checkOutLocation?.areaName || rec.checkInLocation?.areaName}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Active Duty</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {rec.selfieUrl ? (
                                                        <img
                                                            src={rec.selfieUrl}
                                                            alt="Check-In Selfie"
                                                            onClick={() => setSelectedAttendanceSelfie(rec.selfieUrl)}
                                                            className="w-9 h-9 rounded-xl object-cover border border-teal-400 shadow-2xs cursor-pointer hover:scale-105 transition-transform"
                                                            title="Check-In Selfie (Click to expand)"
                                                        />
                                                    ) : (
                                                        <span className="text-[9px] text-slate-400">No In Selfie</span>
                                                    )}
                                                    {rec.checkOutSelfieUrl ? (
                                                        <img
                                                            src={rec.checkOutSelfieUrl}
                                                            alt="Check-Out Selfie"
                                                            onClick={() => setSelectedAttendanceSelfie(rec.checkOutSelfieUrl)}
                                                            className="w-9 h-9 rounded-xl object-cover border border-rose-400 shadow-2xs cursor-pointer hover:scale-105 transition-transform"
                                                            title="Check-Out Selfie (Click to expand)"
                                                        />
                                                    ) : rec.status === 'Checked-Out' ? (
                                                        <span className="text-[9px] text-slate-400">No Out Selfie</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider ${
                                                    rec.status === 'Checked-In' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                    {rec.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Selfie Image Preview Modal */}
            <Modal
                isOpen={!!selectedAttendanceSelfie}
                onClose={() => setSelectedAttendanceSelfie(null)}
                title="Field Engineer Selfie Photo"
                maxWidth="max-w-sm"
            >
                {selectedAttendanceSelfie && (
                    <div className="flex flex-col items-center p-2">
                        <img src={selectedAttendanceSelfie} alt="Selfie Full View" className="max-h-96 rounded-2xl object-contain shadow-md" />
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default FieldAttendance;
