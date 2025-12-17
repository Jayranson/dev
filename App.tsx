import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { 
  Hammer, Heart, User, MessageCircle, MapPin, 
  ShieldCheck, Search, Star, CheckCircle, 
  Briefcase, ArrowRight, X, DollarSign, 
  Settings, LogOut, Wrench, HardHat, Send, Edit2, Plus, Database,
  ClipboardList, AlertCircle, Camera, Filter, Image as ImageIcon, Navigation,
  Ban, Star as StarIcon, Flag, Phone, Lock, Mail, ShoppingBag, ShoppingCart, UploadCloud,
  Bell, Eye, EyeOff, Shield, UserX, Clock, Trash2, FileText, Info, 
  AlertTriangle, Users, BookOpen, ExternalLink, ChevronRight, Globe, UserCheck, Calendar,
  ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';

// Firebase Imports
import { 
  signInWithCustomToken, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  onSnapshot,
  addDoc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  serverTimestamp,
  query,
  orderBy, 
  limit,
  where,
  increment,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from 'firebase/storage';

// Local imports
import { initializeFirebase, getAppId, auth, db, storage } from './config/firebase';
import { TRADES, ADMIN_EMAIL, DEFAULT_COVER_PHOTOS, MAX_VERIFICATION_FILE_SIZE, BASE64_SIZE_RATIO } from './constants';
import { 
  getDistanceFromLatLonInKm, 
  getCurrentTimeSlot, 
  formatDateKey, 
  getNextAvailableDateTime, 
  isCurrentlyUnavailable, 
  getCurrentUnavailabilityInfo, 
  formatTimeSlot,
  getDefaultCoverPhoto,
  injectCustomAnimations
} from './utils';
import { Button, Input, Badge, Avatar } from './components/ui';
import { LazyImage, ProfileTileSkeleton, VerifiedHardHat } from './components/shared';

// Initialize animations
injectCustomAnimations();

const SOCIAL_GRID_BOTTOM_GAP = 104;
const SOCIAL_GRID_TOP_INSET = 6;

const ProfileTile = ({ profile, distanceKm, onOpenProfile, isCurrentUser, shouldBlur = false, hideDistance = false, profilePictureRequests = [], unreadCount = 0, currentUserEmail = null }) => {
    const isTradie = profile.role === 'tradie';
    const isVerified = profile.verified;
    const placeholderColor = isTradie ? 'bg-slate-800' : 'bg-slate-400';
    const photoUrl = profile.primaryPhoto || profile.photo || `https://placehold.co/400x400/${placeholderColor.replace('bg-', '')}/ffffff?text=${(profile.name || profile.username || 'U').charAt(0)}`;

    // Check if this user's profile picture is pending review
    const isPending = profilePictureRequests && profilePictureRequests.some(req => 
        req.userId === profile?.uid && req.status === 'pending'
    );

    // Better distance display logic with privacy
    let distanceDisplay = 'Dist?';
    if (isCurrentUser) {
        distanceDisplay = 'You';
    } else if (hideDistance && !isCurrentUser) {
        // Show region only - safely handle location format
        if (profile.location) {
            const parts = profile.location.split(',');
            distanceDisplay = parts[0].trim() || 'Region';
        } else {
            distanceDisplay = 'Region';
        }
    } else if (distanceKm !== undefined && distanceKm < 9999) {
        if (distanceKm <= 0.1) {
            distanceDisplay = '<0.1 km';
        } else if (distanceKm < 1) {
            distanceDisplay = `${(distanceKm * 1000).toFixed(0)}m`;
        } else {
            distanceDisplay = `${distanceKm.toFixed(1)} km`;
        }
    }

    // Only blur if not viewing own profile or if pending
    const shouldApplyBlur = (shouldBlur && !isCurrentUser) || isPending;

    // Check if profile is admin - only check profile's email to show admin badge to all users
    const isAdmin = profile.email === ADMIN_EMAIL;
    
    // Determine border styling: purple for admin (priority), orange for unread messages, default otherwise
    const getBorderClasses = () => {
        // Admin border takes priority over everything
        if (isAdmin) {
            return 'border-purple-400 hover:border-purple-500 shadow-purple-300/50 hover:shadow-purple-400/60';
        }
        if (unreadCount > 0 && !isCurrentUser) {
            return 'border-orange-500 hover:border-orange-600 shadow-orange-300/50 hover:shadow-orange-400/60';
        }
        return 'border-slate-200 hover:border-orange-400';
    };
    
    return (
        <button
            onClick={() => onOpenProfile(profile)}
            className={`w-full aspect-square relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 group transform hover:-translate-y-1 active:scale-95 ${
                getBorderClasses()
            } ${isCurrentUser ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-orange-100' : ''}`}
        >
            <LazyImage
                src={photoUrl}
                alt={`${profile.name}'s profile`}
                className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out ${shouldApplyBlur ? 'blur-md scale-110' : ''}`}
                onError={(e) => { e.target.onerror = null; e.target.src = photoUrl; }}
            />
            
            {/* Pending Review Indicator */}
            {isPending && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                        PENDING REVIEW
                    </div>
                </div>
            )}
            
            {/* Blur Indicator */}
            {shouldApplyBlur && !isPending && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm" title="Match to unblur">
                        <Lock size={20} />
                    </div>
                </div>
            )}
            
            {/* Unread Messages Count - Top Right (Smaller size with animation) */}
            {unreadCount > 0 && !isCurrentUser && (
                <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg border-2 border-white animate-bounce">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </div>
            )}
            
            {/* Admin Badge - Top Left with Shield (Higher priority than busy badge) */}
            {isAdmin && (
                <div className="absolute top-1.5 left-1.5 z-20 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white p-1.5 rounded-full shadow-xl border-2 border-white flex items-center justify-center animate-pulse-slow" title="Platform Admin">
                    <Shield size={12} className="fill-white" />
                </div>
            )}
            
            {/* Busy/DND Badge for Unavailable Tradies (only show if not admin) */}
            {isTradie && !isAdmin && (() => {
                const currentlyUnavailable = isCurrentlyUnavailable(profile.workCalendar);
                if (currentlyUnavailable) {
                    return (
                        <div className="absolute top-1.5 left-1.5 z-10 bg-red-500 text-white p-1 rounded-full shadow-md border border-white" title="Currently Unavailable">
                            <Ban size={12} />
                        </div>
                    );
                }
                return null;
            })()}

            {/* Overlay for distance and name */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-2 group-hover:from-black/95 transition-all duration-300">
                <div className='flex items-end justify-between w-full transform group-hover:translate-y-0 transition-transform duration-300'>
                    <span className="text-white text-xs font-bold truncate text-left w-2/3 shadow-black drop-shadow-lg group-hover:drop-shadow-2xl transition-all duration-300">
                        {profile.name || profile.username}
                        {isCurrentUser && <span className='font-normal opacity-75 ml-1'>(You)</span>}
                    </span>
                    <div className="flex items-center gap-1">
                        {/* Verified Tradie Badge - Inside distance field */}
                        {isTradie && isVerified && (
                            <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500 rounded-full p-0.5 shadow-md border border-white flex items-center justify-center" title="Verified Tradie">
                                <HardHat className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                        <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full shadow-md transition-all duration-300 ${isCurrentUser ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-orange-600 to-orange-700'} group-hover:shadow-lg group-hover:scale-105`}>
                            {distanceDisplay}
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
};

const ProfileModal = ({ profile, distanceKm, onClose, onConnect, onMessage, hideDistance = false, profilePictureRequests = [] }) => {
    const isTradie = profile.role === 'tradie';
    const photoUrl = profile.primaryPhoto || profile.photo || `https://placehold.co/600x450/333333/ffffff?text=${(profile.name || 'User').charAt(0)}`;
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [reviews, setReviews] = useState([]);

    // Check if this user's profile picture is pending review
    const isPending = profilePictureRequests && profilePictureRequests.some(req => 
        req.userId === profile?.uid && req.status === 'pending'
    );

    // Fetch reviews for tradies
    useEffect(() => {
        if (!isTradie || !profile.uid || !db) return;
        
        const reviewsRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_reviews');
        const q = query(
            reviewsRef, 
            where('reviewedUid', '==', profile.uid),
            where('reviewerRole', '==', 'client'),
            orderBy('createdAt', 'desc'),
            limit(3)
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            const reviewData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReviews(reviewData);
        });
        
        return () => unsub();
    }, [isTradie, profile.uid]);

    const handleBlock = async () => {
        try {
            // Get current user from auth
            const currentUser = auth?.currentUser;
            if (!currentUser || !db) return;

            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'), {
                blockedBy: currentUser.uid,
                blockedUser: profile.uid,
                blockedUserName: profile.name || profile.username,
                blockedAt: serverTimestamp(),
                source: 'profile'
            });
            setShowBlockConfirm(false);
            onClose();
        } catch (error) {
            console.error("Error blocking user:", error);
        }
    };

    // Display distance with privacy - safely handle location format
    let locationDisplay = profile.location || 'Near you';
    if (hideDistance && distanceKm !== undefined && distanceKm < 9999) {
        // Show region only - safely parse location
        if (profile.location) {
            const parts = profile.location.split(',');
            locationDisplay = parts[0].trim() || 'Near you';
        } else {
            locationDisplay = 'Near you';
        }
    } else if (distanceKm !== undefined && distanceKm < 9999) {
        locationDisplay = `${distanceKm.toFixed(1)} km away`;
    }

    // Only blur photos if not viewing own profile or if pending
    const shouldBlurPhoto = (profile.blurPhotos && auth?.currentUser?.uid !== profile.uid) || isPending;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center animate-fade-in">
            <div className="bg-white w-full sm:w-[400px] h-[75vh] sm:h-auto sm:max-h-[80vh] sm:rounded-3xl rounded-t-3xl overflow-y-auto shadow-2xl relative flex flex-col animate-slide-up">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-xl active:scale-90 hover:rotate-90">
                    <X className="w-5 h-5 transition-transform duration-300" />
                </button>

                {/* Block Button */}
                <button
                    onClick={() => setShowBlockConfirm(true)}
                    className="absolute top-4 left-4 z-20 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-xl active:scale-90"
                    title="Block user"
                >
                    <Ban className="w-5 h-5" />
                </button>

                {/* Hero Image */}
                <div className="relative h-80 shrink-0">
                    <img
                        src={photoUrl}
                        alt="Profile"
                        className={`w-full h-full object-cover ${shouldBlurPhoto ? 'blur-md scale-110' : ''}`}
                    />
                    {isPending && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">
                                PENDING REVIEW
                            </div>
                        </div>
                    )}
                    {shouldBlurPhoto && !isPending && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-black/50 p-3 rounded-full text-white backdrop-blur-sm">
                                <Lock size={32} />
                            </div>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent p-6 flex flex-col justify-end">
                        <div className="flex items-center mb-1">
                            <h3 className="text-3xl font-extrabold text-white leading-tight mr-2">
                                {profile.name || profile.username}{profile.hideAge ? '' : `, ${profile.age}`}
                            </h3>
                            {isTradie && profile.verified && <div className="bg-white rounded-full p-1"><HardHat className="w-4 h-4 text-orange-600" /></div>}
                        </div>
                        <p className="text-sm text-gray-300 flex items-center font-medium">
                            <MapPin className="w-4 h-4 mr-1 text-orange-500" />
                            {locationDisplay}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex flex-wrap gap-2 mb-6">
                        {isTradie && (
                            <Badge type="trade" text={`${profile.trade} ${profile.yearsExperience ? `(${profile.yearsExperience}+ Yrs)` : ''}`} />
                        )}
                        {profile.sexuality && (
                            <Badge type="distance" text={profile.sexuality} />
                        )}
                        {profile.lookingFor && (
                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200">
                                Looking for: {profile.lookingFor}
                            </span>
                        )}
                    </div>

                    <div className="mb-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bio</h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{profile.bio || 'No bio provided.'}</p>
                    </div>

                    {/* Not Available Banner for Tradies */}
                    {isTradie && (() => {
                        const currentlyUnavailable = isCurrentlyUnavailable(profile.workCalendar);
                        if (currentlyUnavailable) {
                            const unavailabilityInfo = getCurrentUnavailabilityInfo(profile.workCalendar);
                            const nextAvailable = getNextAvailableDateTime(profile.workCalendar);
                            const isOnJob = unavailabilityInfo?.reason === 'job';
                            
                            if (nextAvailable) {
                                return (
                                    <div className={`mb-6 border-2 rounded-xl p-4 ${isOnJob ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex items-center gap-2">
                                            <Ban size={18} className={isOnJob ? 'text-blue-600' : 'text-red-600'} />
                                            <div>
                                                <p className={`text-xs font-bold ${isOnJob ? 'text-blue-900' : 'text-red-900'}`}>
                                                    {isOnJob ? "On a job! I'll be available for Hire from:" : "Not Available for Hire until:"}
                                                </p>
                                                <p className={`text-sm font-black ${isOnJob ? 'text-blue-700' : 'text-red-700'}`}>
                                                    {nextAvailable.date.toLocaleDateString('en-GB', { 
                                                        weekday: 'short',
                                                        month: 'short', 
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })} at {formatTimeSlot(nextAvailable.timeSlot)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        }
                        return null;
                    })()}

                    {isTradie && (
                        <div className="p-5 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl mb-6 border-2 border-orange-200 shadow-md">
                            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                                <HardHat className="w-4 h-4 mr-2 text-orange-600" /> Tradie Stats
                            </h4>
                            <div className="flex justify-between items-center text-sm text-slate-700 mb-3 bg-white/60 backdrop-blur-sm rounded-lg p-2.5">
                                <span className="flex items-center text-slate-600 font-medium"><StarIcon className="w-4 h-4 text-yellow-500 mr-1.5 fill-yellow-500" /> Rating</span>
                                <span className="font-bold text-slate-900">{profile.rating?.toFixed(1) || '5.0'} ({profile.reviews || 0})</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-700 bg-white/60 backdrop-blur-sm rounded-lg p-2.5">
                                <span className="flex items-center text-slate-600 font-medium"><DollarSign className="w-4 h-4 text-green-600 mr-1.5" /> Rate</span>
                                <span className="font-bold text-slate-900">£{profile.rate || '??'}/hr</span>
                            </div>
                        </div>
                    )}

                    {/* Reviews Section for Tradies */}
                    {isTradie && reviews.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Reviews</h4>
                            <div className="space-y-3">
                                {reviews.map((review) => (
                                    <div key={review.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        size={12}
                                                        className={star <= review.rating 
                                                            ? 'fill-orange-500 text-orange-500' 
                                                            : 'text-slate-300'
                                                        }
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {review.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                            </span>
                                        </div>
                                        {review.comment && (
                                            <p className="text-xs text-slate-600 leading-relaxed">{review.comment}</p>
                                        )}
                                        <p className="text-xs text-slate-400 mt-1">- {review.reviewerName}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer Buttons */}
                <div className="p-4 border-t-2 border-slate-100 grid grid-cols-2 gap-3 bg-gradient-to-t from-slate-50 to-white sticky bottom-0 z-10">
                    <Button onClick={() => onConnect(profile)} className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 shadow-red-300 shadow-xl">
                        <Heart className="w-5 h-5 fill-white" /> Connect
                    </Button>
                    <Button onClick={() => onMessage(profile)} variant="primary" className="w-full shadow-slate-300 shadow-xl">
                        <MessageCircle className="w-5 h-5" /> Message
                    </Button>
                </div>

                {/* Block Confirmation Modal */}
                {showBlockConfirm && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Block User?</h3>
                            <p className="text-sm text-slate-600 mb-4">
                                You won't see this profile anymore and they won't be able to contact you.
                            </p>
                            <div className="flex gap-2">
                                <Button variant="ghost" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                                    Cancel
                                </Button>
                                <Button variant="danger" className="flex-1" onClick={handleBlock}>
                                    Block
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- SOCIAL PROFILE MODAL (FOR SOCIAL TAB ONLY) ---
const SocialProfileModal = ({ profile, distanceKm, onClose, hideDistance = false, profilePictureRequests = [], onWinkSent, onOpenChat, initialChatMode = false }) => {
    const photoUrl = profile.primaryPhoto || profile.photo || `https://placehold.co/600x450/333333/ffffff?text=${(profile.name || 'User').charAt(0)}`;
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [chatMode, setChatMode] = useState(initialChatMode);
    const [messages, setMessages] = useState([]);
    const scrollRef = useRef(null);
    const currentUser = auth?.currentUser;
    const conversationId = currentUser && profile?.uid ? [currentUser.uid, profile.uid].sort().join('_') : null;

    // Check if this user's profile picture is pending review
    const isPending = profilePictureRequests && profilePictureRequests.some(req => 
        req.userId === profile?.uid && req.status === 'pending'
    );

    // Real-time message listener when in chat mode
    useEffect(() => {
        if (!chatMode || !db || !conversationId) return;
        
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
            where('conversationId', '==', conversationId),
            orderBy('createdAt', 'asc')
        );
        
        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => ({id: d.id, ...d.data()}));
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            
            // Mark messages as read
            snap.docs.forEach(async (docSnap) => {
                const msg = docSnap.data();
                if (msg.recipientId === currentUser.uid && !msg.read) {
                    await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'messages', docSnap.id), {
                        read: true,
                        readAt: serverTimestamp()
                    });
                }
            });
        });
        
        return () => unsub();
    }, [chatMode, conversationId, currentUser]);

    const handleBlock = async () => {
        try {
            // Get current user from auth
            const currentUser = auth?.currentUser;
            if (!currentUser || !db) return;

            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'), {
                blockedBy: currentUser.uid,
                blockedUser: profile.uid,
                blockedUserName: profile.name || profile.username,
                blockedAt: serverTimestamp(),
                source: 'profile'
            });
            setShowBlockConfirm(false);
            onClose();
        } catch (error) {
            console.error("Error blocking user:", error);
        }
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() || sending) return;

        try {
            setSending(true);
            if (!currentUser || !db) return;

            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', currentUser.uid));
            const currentUserData = currentUserDoc.data();

            // Create conversation
            const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
            
            await setDoc(conversationRef, {
                participants: [currentUser.uid, profile.uid],
                participant1: {
                    uid: currentUser.uid,
                    name: currentUserData?.name || currentUserData?.username || 'User',
                    photo: currentUserData?.primaryPhoto || currentUserData?.photo || ''
                },
                participant2: {
                    uid: profile.uid,
                    name: profile.name || profile.username || 'User',
                    photo: profile.primaryPhoto || profile.photo || ''
                },
                lastMessage: messageText.trim(),
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Send message
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
                conversationId,
                senderId: currentUser.uid,
                senderName: currentUserData?.name || currentUserData?.username || 'User',
                senderPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                recipientId: profile.uid,
                text: messageText.trim(),
                createdAt: serverTimestamp(),
                read: false
            });

            // Send notification
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                userId: profile.uid,
                type: 'message',
                from: currentUser.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                message: messageText.trim(),
                read: false,
                createdAt: serverTimestamp()
            });

            setMessageText('');
            
            // Transition to chat mode if not already
            if (!chatMode) {
                setChatMode(true);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            if (onWinkSent) onWinkSent('Failed to send message', 'error');
        } finally {
            setSending(false);
        }
    };

    const handleSendWink = async () => {
        try {
            const currentUser = auth?.currentUser;
            if (!currentUser || !db) return;

            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', currentUser.uid));
            const currentUserData = currentUserDoc.data();

            // Send wink notification
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                userId: profile.uid,
                recipientId: profile.uid,
                type: 'wink',
                from: currentUser.uid,
                senderId: currentUser.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                read: false,
                createdAt: serverTimestamp(),
                timestamp: serverTimestamp()
            });

            if (onWinkSent) onWinkSent('Wink sent! 😉', 'success');
        } catch (error) {
            console.error("Error sending wink:", error);
            if (onWinkSent) onWinkSent('Failed to send wink', 'error');
        }
    };

    // Display distance with privacy - safely handle location format
    let locationDisplay = profile.location || 'Near you';
    if (hideDistance && distanceKm !== undefined && distanceKm < 9999) {
        // Show region only - safely parse location
        if (profile.location) {
            const parts = profile.location.split(',');
            locationDisplay = parts[0].trim() || 'Near you';
        } else {
            locationDisplay = 'Near you';
        }
    } else if (distanceKm !== undefined && distanceKm < 9999) {
        locationDisplay = `${distanceKm.toFixed(1)} km away`;
    }

    // Only blur photos if not viewing own profile or if pending
    const shouldBlurPhoto = (profile.blurPhotos && auth?.currentUser?.uid !== profile.uid) || isPending;

    return (
        <div 
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-fade-in p-4"
            onClick={(e) => {
                // Close if clicking the backdrop
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white w-full max-w-sm h-[60vh] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col animate-scale-in">
                
                {!chatMode ? (
                    // PROFILE VIEW - Full screen image with overlays
                    <>
                        {/* Full Screen Background Image */}
                        <div className="absolute inset-0">
                            <LazyImage
                                src={photoUrl}
                                alt="Profile"
                                className={`w-full h-full object-cover transition-transform duration-700 ${shouldBlurPhoto ? 'blur-md scale-110' : ''}`}
                            />
                            {/* Dark gradient overlay for readability */}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
                        </div>

                        {/* Close Button */}
                        <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-xl active:scale-90">
                            <X className="w-5 h-5" />
                        </button>

                        {/* Block Button */}
                        <button
                            onClick={() => setShowBlockConfirm(true)}
                            className="absolute top-4 left-4 z-20 bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-xl active:scale-90"
                            title="Block user"
                        >
                            <Ban className="w-5 h-5" />
                        </button>

                        {/* Wink Button - Bottom Right of Profile Picture */}
                        <button
                            onClick={handleSendWink}
                            className="absolute bottom-20 right-4 z-20 bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-400 hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-500 text-2xl p-4 rounded-2xl backdrop-blur-sm shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 border border-yellow-300"
                            title="Send Wink"
                        >
                            😉
                        </button>

                        {/* Pending/Lock Overlays */}
                        {isPending && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">
                                    PENDING REVIEW
                                </div>
                            </div>
                        )}
                        {shouldBlurPhoto && !isPending && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="bg-black/50 p-3 rounded-full text-white backdrop-blur-sm">
                                    <Lock size={32} />
                                </div>
                            </div>
                        )}

                        {/* Content Overlay - Scrollable */}
                        <div className="absolute inset-0 flex flex-col z-10">
                            {/* Top Section - Name and Location */}
                            <div className="p-6 pt-16">
                                <h3 className="text-4xl font-extrabold text-white leading-tight mb-2 drop-shadow-lg">
                                    {profile.name || profile.username}{profile.hideAge ? '' : `, ${profile.age}`}
                                </h3>
                                <p className="text-base text-white/90 flex items-center font-medium drop-shadow-md">
                                    <MapPin className="w-4 h-4 mr-1 text-orange-400" />
                                    {locationDisplay}
                                </p>
                            </div>

                            {/* Middle Section - Scrollable Content */}
                            <div className="flex-1 overflow-y-auto px-6 pb-4">
                                {/* Badges */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {profile.sexuality && (
                                        <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold border border-white/30">
                                            {profile.sexuality}
                                        </span>
                                    )}
                                    {profile.lookingFor && (
                                        <span className="bg-green-500/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold border border-white/30">
                                            Looking for: {profile.lookingFor}
                                        </span>
                                    )}
                                </div>

                                {/* Bio */}
                                {profile.bio && (
                                    <div className="bg-black/30 backdrop-blur-md p-4 rounded-xl mb-4">
                                        <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">Bio</h4>
                                        <p className="text-white text-sm leading-relaxed">{profile.bio}</p>
                                    </div>
                                )}
                            </div>

                            {/* Message Input - Same as chat view */}
                            <div className="p-4 border-t-2 border-slate-200 bg-gradient-to-t from-slate-50 to-white">
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type a message..."
                                        className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-md hover:border-slate-300 transition-all"
                                        disabled={sending}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!messageText.trim() || sending}
                                        className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white rounded-full transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex-shrink-0 hover:scale-105 active:scale-95"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Block Confirmation Modal */}
                        {showBlockConfirm && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Block User?</h3>
                                    <p className="text-sm text-slate-600 mb-4">
                                        You won't see this profile anymore and they won't be able to contact you.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                                            Cancel
                                        </Button>
                                        <Button variant="danger" className="flex-1" onClick={handleBlock}>
                                            Block
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    // CHAT VIEW
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-white shadow-sm">
                            <button 
                                onClick={() => setChatMode(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                title="Back to profile"
                            >
                                <ChevronLeft size={24} className="text-slate-600" />
                            </button>
                            <div className="flex-shrink-0">
                                {photoUrl ? (
                                    <img 
                                        src={photoUrl} 
                                        alt={profile.name || profile.username} 
                                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
                                    />
                                ) : (
                                    <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border-2 border-white shadow-md">
                                        <User size={20} className="text-white"/>
                                    </div>
                                )}
                            </div>
                            <span className="font-bold text-lg text-slate-900 flex-1 truncate">{profile.name || profile.username || 'User'}</span>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                title="Close"
                            >
                                <X size={20} className="text-slate-600" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                    <MessageCircle className="w-16 h-16 text-slate-300 mb-4" />
                                    <p className="text-slate-500 text-sm">Start your conversation!</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isMe = msg.senderId === currentUser?.uid;
                                    return (
                                        <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {!isMe && (
                                                <div className="flex-shrink-0">
                                                    {msg.senderPhoto || profile.primaryPhoto || profile.photo ? (
                                                        <img 
                                                            src={msg.senderPhoto || profile.primaryPhoto || profile.photo} 
                                                            alt={msg.senderName || profile.name || profile.username} 
                                                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border border-slate-200 shadow-sm">
                                                            <User size={14} className="text-white"/>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className={`max-w-[70%] ${isMe ? '' : ''}`}>
                                                <div className={`px-4 py-2 rounded-2xl shadow-md ${
                                                    isMe 
                                                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white' 
                                                        : 'bg-white text-slate-800 border border-slate-200'
                                                }`}>
                                                    <p className="text-sm break-words leading-relaxed">{msg.text}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={scrollRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t-2 border-slate-200 bg-gradient-to-t from-slate-50 to-white">
                            <div className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-md hover:border-slate-300 transition-all"
                                    disabled={sending}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!messageText.trim() || sending}
                                    className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white rounded-full transition-all shadow-lg hover:shadow-xl disabled:shadow-none hover:scale-105 active:scale-95"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Block Confirmation Modal */}
                        {showBlockConfirm && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Block User?</h3>
                                    <p className="text-sm text-slate-600 mb-4">
                                        You won't see this profile anymore and they won't be able to contact you.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                                            Cancel
                                        </Button>
                                        <Button variant="danger" className="flex-1" onClick={handleBlock}>
                                            Block
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// --- TOAST NOTIFICATION COMPONENT ---
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bg = type === 'success' 
        ? 'bg-gradient-to-r from-green-500 to-green-600' 
        : type === 'error' 
        ? 'bg-gradient-to-r from-red-500 to-red-600' 
        : 'bg-gradient-to-r from-slate-900 to-slate-800';

    return (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 ${bg} text-white px-6 py-3 rounded-full shadow-2xl z-[150] flex items-center gap-2 transition-all animate-slide-up`}>
            {type === 'success' && <CheckCircle size={18} className="animate-scale-in" />}
            {type === 'error' && <AlertCircle size={18} className="animate-scale-in" />}
            <span className="font-bold text-sm">{message}</span>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('landing'); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dating');
  const [selectedProfile, setSelectedProfile] = useState(null); 
  const [feedFilter, setFeedFilter] = useState(null); 
  const [acceptedTradieIds, setAcceptedTradieIds] = useState(new Set()); 
  const [chatBackView, setChatBackView] = useState('feed'); // Track where to go back from chat (default to feed)
  const [pendingJobsCount, setPendingJobsCount] = useState(0); // Count of pending job actions
  const [profilePictureRequests, setProfilePictureRequests] = useState([]); // Profile picture verification requests
  const [showSocialModal, setShowSocialModal] = useState(false); // Controls SocialProfileModal visibility
  const [chatMode, setChatMode] = useState(false); // If true, modal opens in chat mode
  const [showMessagesModal, setShowMessagesModal] = useState(false); // Controls MessagesModal visibility
  
  // Notification dots state (true = show red dot, false = hidden)
  const [hasJobsNotification, setHasJobsNotification] = useState(false);
  const [hasDiscoverNotification, setHasDiscoverNotification] = useState(false);
  const [hasProfileNotification, setHasProfileNotification] = useState(false);
  const [hasShopNotification, setHasShopNotification] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadMessagesPerUser, setUnreadMessagesPerUser] = useState({}); // Track unread messages by sender
  
  // Toast State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
      setToast({ message, type });
  };

  // Initialize Firebase on component mount
  useEffect(() => {
    initializeFirebase();
  }, []);

  // Auth Init
  useEffect(() => {
    if (!auth) {
        setLoading(false);
        // Firebase not configured - this is expected on first setup
        // Don't log error to avoid confusion
        return;
    }
    const initAuth = async () => {
      try {
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          console.log("No custom token found. User needs to sign up or login.");
          // Don't auto-sign in - let user explicitly sign up or login
        }
      } catch (error) {
        console.error("Authentication error:", error);
        showToast(`Authentication failed: ${error.message}. Check Firebase Console settings.`, "error");
        setLoading(false); // Stop loading on error
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u ? `User ${u.uid}` : "No user");
      setUser(u);
      setLoading(false); // Auth completed - stop loading whether user exists or not
    });
    return () => unsubscribe();
  }, []);

  // GPS watch ID for continuous tracking
  const watchIdRef = useRef(null);

  // UPDATED: Function to manually trigger GPS update with continuous watching
  const updateLocation = () => {
      if (!navigator.geolocation || !user || !db) {
          showToast("Geolocation not supported", "error");
          return;
      }
      
      // Clear any existing watch
      if (watchIdRef.current !== null && typeof watchIdRef.current === 'number') {
          navigator.geolocation.clearWatch(watchIdRef.current);
      }
      
      showToast("Requesting GPS...", "info");
      
      const updatePosition = async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          try {
              const userRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid);
              await updateDoc(userRef, { 
                  latitude, 
                  longitude,
                  locationAccuracy: accuracy,
                  locationUpdatedAt: serverTimestamp()
              });
              showToast("Location updated!", "success");
          } catch (e) {
              console.error("Error updating location:", e);
              showToast("Database error", "error");
          }
      };
      
      const handleError = (error) => {
          console.warn("GPS Error:", error);
          let errorMsg = "Location access denied or failed";
          switch(error.code) {
              case error.PERMISSION_DENIED:
                  errorMsg = "Please allow location access in your browser";
                  break;
              case error.POSITION_UNAVAILABLE:
                  errorMsg = "Location information unavailable";
                  break;
              case error.TIMEOUT:
                  errorMsg = "Location request timed out";
                  break;
          }
          showToast(errorMsg, "error");
      };
      
      // Start continuous position watching
      watchIdRef.current = navigator.geolocation.watchPosition(
          updatePosition,
          handleError,
          { 
              enableHighAccuracy: true, 
              maximumAge: 30000, // Cache for 30 seconds
              timeout: 27000 
          }
      );
  };

  // Try to get real location on load with user interaction check
  useEffect(() => {
      if (user && db && navigator.geolocation) {
          // Try to get location once on load
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  const { latitude, longitude, accuracy } = position.coords;
                  try {
                      const userRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid);
                      await updateDoc(userRef, { 
                          latitude, 
                          longitude,
                          locationAccuracy: accuracy,
                          locationUpdatedAt: serverTimestamp()
                      });
                  } catch (e) {
                      console.error("Error updating initial location:", e);
                  }
              },
              (error) => {
                  console.log("Initial GPS request blocked, waiting for user interaction:", error.message);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
      }
      
      // Cleanup watch on unmount
      return () => {
          if (watchIdRef.current !== null && typeof watchIdRef.current === 'number') {
              navigator.geolocation.clearWatch(watchIdRef.current);
          }
      };
  }, [user]);

  // Fetch Current User Profile
  useEffect(() => {
    if (!user || !db) return;
    const unsub = onSnapshot(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        setUserProfile(profileData);
        
        // Auto-fix: Add email to profile if missing (for existing users)
        if (user.email && (!profileData.email || profileData.email.trim() === '')) {
          try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
              email: user.email
            });
            console.log('Auto-fixed: Added email to profile');
          } catch (error) {
            console.error('Error adding email to profile:', error);
          }
        }
        
        // Only redirect to feed if we're on landing page AND profile just got created
        // This prevents navigation when updating profile from other views
        if (view === 'landing') setView('feed');
      } else {
        // Profile doesn't exist - go to onboarding (unless already on landing)
        if (view !== 'landing') setView('onboarding');
      }
      setLoading(false);
    }, (err) => console.error(err));
    return () => unsub();
  }, [user, view]); // Added view as dependency

  // Listen for unread messages count
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
        collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
        where('recipientId', '==', user.uid),
        where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snapshot) => {
        setUnreadMessagesCount(snapshot.size);
    });
    return () => unsub();
  }, [user]);

  // Track unread messages per user for Social profile badges
  useEffect(() => {
    if (!user || !db) return;
    
    const unreadQuery = query(
        collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
        where('recipientId', '==', user.uid),
        where('read', '==', false)
    );
    
    const unsub = onSnapshot(unreadQuery, (snapshot) => {
        const messagesBySender = {};
        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            const senderId = msg.senderId;
            if (!messagesBySender[senderId]) {
                messagesBySender[senderId] = 0;
            }
            messagesBySender[senderId]++;
        });
        setUnreadMessagesPerUser(messagesBySender);
    });
    
    return () => unsub();
  }, [user]);

  // Fetch Accepted Jobs (for Unblur Logic)
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
        collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'), 
        where('clientUid', '==', user.uid),
        where('status', '==', 'Accepted')
    );
    const unsub = onSnapshot(q, (snapshot) => {
        const trustedIds = new Set();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.tradieUid) trustedIds.add(data.tradieUid);
        });
        setAcceptedTradieIds(trustedIds);
    });
    return () => unsub();
  }, [user]);

  // Fetch Profile Picture Verification Requests (for blur detection)
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests'));
    const unsub = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach(doc => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setProfilePictureRequests(requests);
    });
    return () => unsub();
  }, []);

  // Set Profile notification if email not verified
  useEffect(() => {
    if (user && !user.emailVerified) {
      setHasProfileNotification(true);
    } else {
      setHasProfileNotification(false);
    }
  }, [user]);

  // View Routing
  const renderView = () => {
    if (loading) return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50 animate-fade-in">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 shadow-lg"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-orange-300 opacity-20"></div>
        </div>
      </div>
    );

    // Check if Firebase is configured
    if (!auth || !db) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-lg bg-white rounded-lg shadow-lg p-8 border-l-4 border-orange-500">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-orange-500" size={32} />
              <h2 className="text-2xl font-bold text-slate-900">Firebase Configuration Required</h2>
            </div>
            <div className="space-y-4 text-slate-700">
              <p>The app is running, but Firebase hasn't been configured yet.</p>
              <div className="bg-slate-50 p-4 rounded-md">
                <p className="font-semibold mb-2">To set up Firebase:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Go to <a href="https://console.firebase.google.com/" target="_blank" className="text-orange-600 hover:underline">Firebase Console</a></li>
                  <li>Create a new project (or use existing)</li>
                  <li>Enable <strong>Authentication</strong> → Anonymous provider</li>
                  <li>Enable <strong>Firestore Database</strong> (test mode)</li>
                  <li>Copy your Firebase config to <code className="bg-slate-200 px-1 rounded">src/main.tsx</code></li>
                </ol>
              </div>
              <p className="text-sm text-slate-600">
                See <strong>LOCAL_SETUP.md</strong> in the repository for detailed instructions.
              </p>
            </div>
          </div>
        </div>
      );
    }

    switch (view) {
      case 'landing': return <LandingPage onLogin={() => setView('onboarding')} />;
      case 'onboarding': return <Onboarding user={user} onComplete={() => setView('feed')} />;
      case 'feed': return <Feed user={user} userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} filter={feedFilter} clearFilter={() => setFeedFilter(null)} onMessage={(p) => { setSelectedProfile(p); setChatBackView('feed'); setView('chat'); }} onRequestJob={(p) => { setSelectedProfile(p); setView('requestJob'); }} acceptedTradieIds={acceptedTradieIds} onEnableLocation={updateLocation} showToast={showToast} profilePictureRequests={profilePictureRequests} unreadMessagesPerUser={unreadMessagesPerUser} />;
      case 'services': return <ServiceFinder onSelectService={(trade) => { setFeedFilter(trade); setView('feed'); }} onPostJob={() => setView('postJobAdvert')} />;
      case 'postJobAdvert': return <PostJobAdvert user={user} onCancel={() => setView('services')} onSuccess={() => { setView('jobs'); showToast("Advert Posted!", "success"); }} />;
      case 'messages': return <Feed user={user} userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} filter={feedFilter} clearFilter={() => setFeedFilter(null)} onMessage={(p) => { setSelectedProfile(p); setChatBackView('feed'); setView('chat'); }} onRequestJob={(p) => { setSelectedProfile(p); setView('requestJob'); }} acceptedTradieIds={acceptedTradieIds} onEnableLocation={updateLocation} showToast={showToast} profilePictureRequests={profilePictureRequests} unreadMessagesPerUser={unreadMessagesPerUser} />;
      case 'chat': return <ChatRoom user={user} partner={selectedProfile} onBack={() => setView(chatBackView)} />;
      case 'requestJob': return <JobRequestForm user={user} tradie={selectedProfile} onCancel={() => setView('feed')} onSuccess={() => { setView('jobs'); showToast("Request Sent!", "success"); }} />;
      case 'jobs': return <JobManager user={user} userProfile={userProfile} onPendingCountChange={(count) => { setPendingJobsCount(count); setHasJobsNotification(count > 0); }} />;
      case 'shop': return <Shop user={user} showToast={showToast} onCartChange={(count) => setHasShopNotification(count > 0)} />;
      case 'profile': return <UserProfile user={user} profile={userProfile} onLogout={async () => { 
        try {
          await auth.signOut();
          setView('landing');
          setUserProfile(null);
          showToast("Signed out successfully", "success");
        } catch (error) {
          console.error("Sign out error:", error);
          showToast("Failed to sign out", "error");
        }
      }} showToast={showToast} onEnableLocation={updateLocation} onNavigate={setView} profilePictureRequests={profilePictureRequests} />;
      case 'settings': return <SettingsScreen user={user} profile={userProfile} onBack={() => setView('profile')} showToast={showToast} />;
      case 'workCalendar': return <WorkCalendar user={user} profile={userProfile} onBack={() => setView('profile')} showToast={showToast} />;
      case 'paymentsCredits': return <PaymentsCredits user={user} profile={userProfile} onBack={() => setView('profile')} showToast={showToast} />;
      case 'safety': return <SafetyCentre user={user} onBack={() => setView('profile')} showToast={showToast} />;
      case 'admin': return <AdminPanel user={user} onBack={() => setView('profile')} showToast={showToast} />;
      default: return <Feed user={user} activeTab={activeTab} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-slate-200 flex flex-col">
      {/* Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Social Profile Modal - Opened from Messages tab */}
      {showSocialModal && selectedProfile && (
        <SocialProfileModal
          profile={selectedProfile}
          onClose={() => {
            setShowSocialModal(false);
            setSelectedProfile(null);
            setChatMode(false);
          }}
          hideDistance={true}
          profilePictureRequests={profilePictureRequests}
          onWinkSent={(msg, type) => showToast(msg, type)}
          onOpenChat={() => {}}
          initialChatMode={chatMode}
        />
      )}
      
      {/* Messages Modal - Opened from header Messages button */}
      {showMessagesModal && (
        <MessagesModal
          user={user}
          onSelectProfile={(profile, unreadCount) => { 
            setShowMessagesModal(false);
            setSelectedProfile(profile); 
            setChatMode(false);
            setShowSocialModal(true); 
          }} 
          onSelectChat={(profile) => { 
            setShowMessagesModal(false);
            setSelectedProfile(profile); 
            setChatMode(true); 
            setShowSocialModal(true); 
          }} 
          onClose={() => setShowMessagesModal(false)} 
        />
      )}

      {/* Header - Fixed at top */}
      {view !== 'landing' && view !== 'onboarding' && (
        <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 z-50 flex justify-between items-center shadow-lg shadow-slate-900/50 h-16 max-w-md mx-auto">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('feed')}>
            <HardHat className="text-orange-500 fill-orange-500 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" size={24} />
            <h1 className="font-bold text-xl tracking-tight">
              <span className="bg-gradient-to-r from-white via-slate-100 to-white bg-clip-text text-transparent">Gay</span>
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent font-extrabold">Tradies</span>
            </h1>
          </div>
          <div className="flex gap-3">
             {/* Admin shield only visible to admin user */}
             {user?.email === ADMIN_EMAIL && (
               <button onClick={() => setView('admin')} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                 <ShieldCheck size={18} />
               </button>
             )}
             <button className="relative p-1 hover:bg-slate-700 rounded transition-colors" onClick={() => setShowMessagesModal(true)}>
               <MessageCircle size={24} />
               {unreadMessagesCount > 0 && (
                 <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                   <span className="text-white text-xs font-bold">{unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}</span>
                 </div>
               )}
             </button>
          </div>
        </header>
      )}

      {/* Main Content - with padding for fixed header */}
      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide animate-fade-in" style={{ paddingTop: view !== 'landing' && view !== 'onboarding' ? '64px' : '0' }}>
        {renderView()}
      </main>

      {/* Nav */}
      {view !== 'landing' && view !== 'onboarding' && view !== 'chat' && (
        <nav className="fixed bottom-0 w-full max-w-md bg-gradient-to-t from-white to-slate-50 border-t-2 border-slate-200 flex justify-around p-2 pb-5 z-40 text-xs font-medium text-slate-500 shadow-[0_-8px_15px_rgba(0,0,0,0.08)] backdrop-blur-lg">
          <NavButton 
            icon={Search} 
            label="Discover" 
            active={view === 'feed'} 
            onClick={() => { setView('feed'); setHasDiscoverNotification(false); }} 
            hasNotification={hasDiscoverNotification}
          />
          <NavButton 
            icon={Wrench} 
            label="Services" 
            active={view === 'services'} 
            onClick={() => setView('services')} 
          />
          <NavButton 
            icon={Briefcase} 
            label="Jobs" 
            active={view === 'jobs'} 
            onClick={() => { setView('jobs'); setHasJobsNotification(false); }} 
            hasNotification={hasJobsNotification}
          />
          <NavButton 
            icon={ShoppingBag} 
            label="Shop" 
            active={view === 'shop'} 
            onClick={() => { setView('shop'); setHasShopNotification(false); }} 
            hasNotification={hasShopNotification}
          />
          <NavButton 
            icon={User} 
            label="Profile" 
            active={view === 'profile'} 
            onClick={() => { setView('profile'); setHasProfileNotification(false); }} 
            hasNotification={hasProfileNotification}
          />
        </nav>
      )}
    </div>
  );
}

const NavButton = ({ icon: Icon, label, active, onClick, hasNotification }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${active ? 'text-orange-600 scale-110' : 'hover:text-slate-800 active:scale-95'}`}
  >
    <div className={`relative p-2 rounded-xl transition-all duration-300 ${active ? 'bg-gradient-to-br from-orange-100 to-orange-50 shadow-lg shadow-orange-200/50 animate-bounce-subtle' : 'hover:bg-slate-100'}`}>
      <Icon size={22} strokeWidth={active ? 2.5 : 2} className="transition-transform duration-300" />
      {hasNotification && (
        <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full w-2.5 h-2.5 border-2 border-white shadow-lg animate-pulse"></span>
      )}
    </div>
    <span className={`${active ? 'font-bold' : ''} text-[10px] transition-all duration-200`}>{label}</span>
  </button>
);

// --- VIEW COMPONENTS ---

const LandingPage = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('admirer');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { strength: 0, label: '', color: '' };
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    
    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, label: 'Good', color: 'bg-blue-500' };
    return { strength, label: 'Strong', color: 'bg-green-500' };
  };

  const handleSignUp = async () => {
    setError('');
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (!isOver18) {
      setError('You must be 18+ to use this service');
      return;
    }
    
    if (!acceptTerms) {
      setError('You must accept Terms & Privacy Policy');
      return;
    }
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      await sendEmailVerification(userCredential.user);
      
      // Store user type for onboarding
      localStorage.setItem('pendingUserType', userType);
      
      onLogin();
    } catch (err) {
      console.error('Sign up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use. Try logging in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle navigation
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      alert('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  if (showForgotPassword) {
    return (
      <div className="h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold mb-2">Reset Password</h2>
          <p className="text-slate-400 text-sm mb-6">Enter your email to receive a password reset link.</p>
          
          <Input
            label="Email"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="your@email.com"
          />
          
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          
          <div className="flex gap-2 mt-6">
            <Button 
              variant="ghost" 
              className="flex-1" 
              onClick={() => { setShowForgotPassword(false); setError(''); }}
            >
              Back
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1" 
              onClick={handleForgotPassword}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center p-6 relative overflow-y-auto">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      <div className="z-10 w-full max-w-md py-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 animate-fade-in">
          <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500 p-3 rounded-2xl mb-3 shadow-[0_0_40px_rgba(249,115,22,0.6)] animate-pulse-slow hover:scale-110 transition-transform duration-300">
            <HardHat size={40} className="text-white fill-white animate-bounce-subtle" />
          </div>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
            <span className="bg-gradient-to-r from-white via-slate-100 to-white bg-clip-text text-transparent">Gay</span>
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">Tradies</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium animate-slide-up">Verified tradesmen & the men who want them.</p>
        </div>

        {/* Auth Form */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl animate-slide-up backdrop-blur-sm border border-slate-700">
          <div className="flex bg-slate-700 rounded-lg p-1 mb-4 shadow-inner">
            <button
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all duration-300 ${
                isSignUp ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all duration-300 ${
                !isSignUp ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Login
            </button>
          </div>

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {isSignUp && (
            <>
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />

              {password && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Password Strength</span>
                    <span className="font-bold">{passwordStrength.label}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mb-4 animate-slide-up">
                <label className="block text-sm font-bold text-slate-300 mb-2">I am a...</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserType('tradie')}
                    className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 ${
                      userType === 'tradie' 
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/50 scale-105' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:shadow-md'
                    }`}
                  >
                    Tradie
                  </button>
                  <button
                    onClick={() => setUserType('admirer')}
                    className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 ${
                      userType === 'admirer' 
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/50 scale-105' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:shadow-md'
                    }`}
                  >
                    Admirer
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOver18}
                    onChange={(e) => setIsOver18(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-sm text-slate-300">I confirm I am 18+</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-sm text-slate-300">I accept Terms & Privacy Policy</span>
                </label>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <Button
            variant="secondary"
            className="w-full text-lg py-4 mb-3"
            onClick={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Login'}
          </Button>

          {!isSignUp && (
            <button
              onClick={() => setShowForgotPassword(true)}
              className="w-full text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Onboarding = ({ user, onComplete }) => {
  const [role, setRole] = useState(() => {
    // Get role from localStorage if available (set during signup)
    const pendingType = localStorage.getItem('pendingUserType');
    if (pendingType) {
      localStorage.removeItem('pendingUserType');
      return pendingType;
    }
    return 'admirer';
  });
  const [formData, setFormData] = useState({ name: '', age: '', location: '', trade: '', bio: '', rate: '', sexuality: 'Gay', lookingFor: 'All' });

  const handleSubmit = async () => {
    if (!formData.name) {
      alert("Please enter your name");
      return;
    }
    
    if (!formData.age || formData.age === '' || parseInt(formData.age) < 18) {
      alert("Please enter your age (must be 18 or older)");
      return;
    }
    
    // Check if user is authenticated
    if (!user) {
      alert("Authentication Error:\n\nStill waiting for authentication to complete.\n\nIf this persists:\n1. Check your Firebase Console → Authentication → Sign-in method\n2. Verify 'Anonymous' provider is enabled\n3. Check browser console (F12) for error messages\n4. Try refreshing the page");
      console.error("User is not authenticated yet. user:", user);
      return;
    }
    
    if (!db) {
      alert("Database error: Firebase is not initialized. Check your Firebase configuration in src/main.tsx");
      return;
    }
    
    // Try to get GPS coordinates before creating profile
    let gpsCoords = { latitude: null, longitude: null };
    
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        gpsCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationAccuracy: position.coords.accuracy,
          locationUpdatedAt: serverTimestamp()
        };
      } catch (error) {
        console.log("GPS not available during onboarding:", error.message);
      }
    }
    
    try {
      await setDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
        ...formData,
        age: parseInt(formData.age), // Ensure age is stored as a number
        role,
        uid: user.uid,
        email: user.email, // Store email for admin badge detection
        verified: false,
        joinedAt: serverTimestamp(),
        reviews: 0,
        rating: 5.0,
        primaryPhoto: null,
        ...gpsCoords
      });
      onComplete();
    } catch (error) {
      console.error("Error creating profile:", error);
      alert("Failed to create profile. Please check your Firebase configuration and try again.");
    }
  };

  return (
    <div className="p-6 pt-8">
      <h2 className="text-3xl font-black mb-2 text-slate-900">Welcome aboard.</h2>
      <p className="text-slate-500 mb-8 font-medium">Tell us who you are.</p>
      <div className="flex gap-4 mb-8">
        <button onClick={() => setRole('admirer')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'admirer' ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' : 'border-slate-200 text-slate-400'}`}>
          <User size={32} /> <span className="font-bold">Client / Admirer</span>
        </button>
        <button onClick={() => setRole('tradie')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'tradie' ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' : 'border-slate-200 text-slate-400'}`}>
          <HardHat size={32} /> <span className="font-bold">Tradie</span>
        </button>
      </div>
      <div className="space-y-4">
        <Input label="Display Name" placeholder="e.g. Dave" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <div className="flex gap-4">
          <Input label="Age" type="number" placeholder="25" className="w-full" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
          <Input label="City" placeholder="London" className="w-full" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        </div>
        {role === 'tradie' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Trade</label>
              <select className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500" value={formData.trade} onChange={e => setFormData({...formData, trade: e.target.value})}>
                <option value="">Select a trade...</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Hourly Rate (£)" type="number" placeholder="45" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
          </>
        )}
        <Input label="Bio" textarea rows={3} placeholder={role === 'tradie' ? "Experienced with tools. Looking for jobs or fun." : "Looking for a reliable tradie for work..."} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} />
        <Button onClick={handleSubmit} className="w-full py-4 mt-4" variant="secondary" disabled={!user}>
          {user ? 'Create Profile' : 'Waiting for authentication...'}
        </Button>
        {!user && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Please wait a moment while we set up your session...
          </p>
        )}
      </div>
    </div>
  );
};

const Feed = ({ user, userProfile, activeTab, setActiveTab, onMessage, onRequestJob, filter, clearFilter, acceptedTradieIds, onEnableLocation, showToast, profilePictureRequests = [], unreadMessagesPerUser = {} }) => {
  const [profiles, setProfiles] = useState([]);
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const pullThreshold = 80;
  const socialFeedRef = useRef(null);
  const hiringFeedRef = useRef(null);
  const socialFiltersRef = useRef(null);
  const [socialGridOffset, setSocialGridOffset] = useState(240);
  
  // Logic from GT2: Social Filtering State
  const [socialFilter, setSocialFilter] = useState({
        verified: false,
        trade: '',
        distance: 100,
        minAge: 18,
        maxAge: 99,
  });
  const [selectedSocialProfile, setSelectedSocialProfile] = useState(null);

  // Hiring Filter State (Existing GT1 Logic)
  const [manualLocation, setManualLocation] = useState('');

  // Measure the social filters bar so the grid starts beneath it
  const updateSocialGridOffset = useCallback(() => {
    if (!socialFiltersRef.current || typeof window === 'undefined') return;

    requestAnimationFrame(() => {
      if (!socialFiltersRef.current) return;
      const rect = socialFiltersRef.current.getBoundingClientRect();
      const offset = rect.bottom + 12;
      setSocialGridOffset(offset);
    });
  }, []);

  useLayoutEffect(() => {
    updateSocialGridOffset();
  }, [updateSocialGridOffset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => updateSocialGridOffset();

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateSocialGridOffset]);

  useEffect(() => {
    if (activeTab === 'dating') {
      updateSocialGridOffset();
    }
  }, [activeTab, updateSocialGridOffset, socialFilter]);

  // Load blocked users
  useEffect(() => {
    if (!user || !db) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
      (snapshot) => {
        const blocked = new Set();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Only add users I blocked (not users who blocked me)
          if (data.blockedBy === user.uid) {
            blocked.add(data.blockedUser);
          }
        });
        setBlockedUserIds(blocked);
      }
    );
    return () => unsub();
  }, [user]);

  // Combined Data Fetching
  useEffect(() => {
    if (!db) return;
    setIsLoading(true);
    const q = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allProfiles = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
      
      // Filter out blocked users
      allProfiles = allProfiles.filter(p => !blockedUserIds.has(p.uid));
      
      // Apply incognito mode - hide profiles with incognito enabled
      // This hides the profile from all feeds including user's own feed
      allProfiles = allProfiles.filter(p => !p.incognitoMode);
      
      // Calculate distances for all profiles first
      if (userProfile?.latitude && userProfile?.longitude) {
          allProfiles = allProfiles.map(p => {
              const dist = getDistanceFromLatLonInKm(
                  userProfile.latitude, userProfile.longitude,
                  p.latitude, p.longitude
              );
              return { ...p, distanceKm: dist };
          });
      }

      setProfiles(allProfiles);
      setIsLoading(false);
      setIsRefreshing(false);
    });
    return () => unsubscribe();
  }, [userProfile, blockedUserIds, activeTab, user]);

  // Reset pull state when switching tabs
  useEffect(() => {
    setPullDistance(0);
    setPullStartY(0);
    setIsRefreshing(false);
  }, [activeTab]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e) => {
    const currentFeedRef = activeTab === 'dating' ? socialFeedRef : hiringFeedRef;
    if (currentFeedRef.current && currentFeedRef.current.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    const currentFeedRef = activeTab === 'dating' ? socialFeedRef : hiringFeedRef;
    if (pullStartY > 0 && currentFeedRef.current && currentFeedRef.current.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, Math.min(currentY - pullStartY, pullThreshold * 1.5));
      setPullDistance(distance);
      
      // Prevent browser's native pull-to-refresh when we're handling the gesture
      if (distance > 0) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= pullThreshold) {
      // Capture current tab at the moment of refresh
      const currentTab = activeTab;
      setIsRefreshing(true);
      
      // Show toast for current tab
      if (showToast) {
        showToast(`Refreshing ${currentTab === 'dating' ? 'Social' : 'Hire'} feed...`, 'info');
      }
      
      // Show brief loading animation for visual feedback
      // The onSnapshot listener already keeps data fresh, so we don't need to trigger a full reload
      setTimeout(() => {
        // Only update if we're still on the same tab
        if (activeTab === currentTab) {
          setIsRefreshing(false);
          setPullDistance(0);
          setPullStartY(0);
          
          if (showToast) {
            showToast(`${currentTab === 'dating' ? 'Social' : 'Hire'} feed refreshed!`, 'success');
          }
        } else {
          // If tab changed, just reset states without showing success toast
          setIsRefreshing(false);
          setPullDistance(0);
          setPullStartY(0);
        }
      }, 800);
    } else {
      setPullDistance(0);
      setPullStartY(0);
    }
  };


  // GT2 Logic: Memoized Filter & Sort for Social Tab
  const filteredSocialProfiles = useMemo(() => {
      return profiles
        // Only show profiles with valid uid and name (filters out deleted/orphaned accounts)
        .filter(p => p.uid && p.name && p.name.trim() !== '' && p.name !== '[Deleted User]')
        // Only show profiles with email (filters out orphaned anonymous accounts)
        .filter(p => p.email && p.email.trim() !== '')
        .filter(p => p.role !== 'admin') // Exclude admin role profiles from social feed
        .filter(p => {
            // Always show current user regardless of other filters
            if (p.uid === user?.uid) return true;
            
            // Exclude profiles with jobOnlyVisibility
            if (p.jobOnlyVisibility) return false;
            
            // Apply social filters for other users
            if (socialFilter.verified && !p.verified) return false;
            if (socialFilter.trade && p.trade !== socialFilter.trade) return false;
            // Only apply age filter if age is a valid number (not null, not undefined, not empty string, not 0)
            const validAge = p.age && typeof p.age === 'number' && p.age > 0;
            if (validAge && (p.age < socialFilter.minAge || p.age > socialFilter.maxAge)) return false;
            // Only apply distance filter if distance is valid (not NaN, not null, not undefined)
            if (p.distanceKm != null && !isNaN(p.distanceKm) && p.distanceKm > socialFilter.distance) return false;
            
            // Apply user's "Verified Only" privacy setting
            if (userProfile?.verifiedOnly && !p.verified) return false;
            
            return true;
        })
        .sort((a, b) => {
            // Current user's profile always appears first
            if (a.uid === user?.uid) return -1;
            if (b.uid === user?.uid) return 1;
            // Then sort ASCENDING by distance so CLOSEST profiles appear at TOP
            const aDist = a.distanceKm || 99999;
            const bDist = b.distanceKm || 99999;
            return aDist - bDist; // Smaller distances first (top), larger distances last (bottom)
        });
  }, [profiles, socialFilter, user, userProfile]);

  // Hiring Filter Logic (GT1)
  const filteredHiringProfiles = useMemo(() => {
      // Only show profiles with valid uid and name (filters out deleted/orphaned accounts)
      let result = profiles
        .filter(p => p.uid && p.name && p.name.trim() !== '' && p.name !== '[Deleted User]')
        // Only show profiles with email (filters out orphaned anonymous accounts)
        .filter(p => p.email && p.email.trim() !== '')
        // Only show tradies in Hire tab
        .filter(p => p.role === 'tradie')
        .filter(p => p.uid !== user?.uid);
      if (filter) result = result.filter(p => p.trade === filter);
      if (manualLocation.trim()) {
          const search = manualLocation.toLowerCase();
          result = result.filter(p => p.location?.toLowerCase().includes(search));
      }
      
      // Filter out tradies who are unavailable at the current time
      const currentDateKey = formatDateKey(new Date());
      const currentTimeSlot = getCurrentTimeSlot();
      
      // Filter out unavailable tradies (use 'morning' as default for off-hours)
      const effectiveTimeSlot = currentTimeSlot || 'morning';
      result = result.filter(p => {
          const workCalendar = p.workCalendar || {};
          const dateSlots = workCalendar[currentDateKey];
          
          if (!dateSlots) return true; // Available if no slots defined for today
          
          // Support both old format (array) and new format (object)
          if (Array.isArray(dateSlots)) {
              return !dateSlots.includes(effectiveTimeSlot);
          } else {
              return !dateSlots[effectiveTimeSlot];
          }
      });
      
      // Sort: Verified first for hiring, then distance
      result.sort((a, b) => {
          if (a.verified !== b.verified) return b.verified ? 1 : -1;
          return (a.distanceKm || 9999) - (b.distanceKm || 9999);
      });
      return result;
  }, [profiles, filter, manualLocation, user]);

  const handleFilterChange = (e) => {
      const { name, value, type, checked } = e.target;
      setSocialFilter(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
      }));
  };

  const handleConnect = (profile) => {
      setSelectedSocialProfile(null);
      onMessage(profile);
  };

  return (
    <div className="h-full">
      {/* Fixed Social/Hire Toggle - extended background to eliminate gaps */}
      <div className="fixed top-16 left-0 right-0 bg-slate-50 z-30 max-w-md mx-auto px-4 pt-4 pb-5">
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => setActiveTab('dating')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'dating' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Heart size={16} className={activeTab === 'dating' ? 'text-red-400 fill-red-400' : ''} /> Social
          </button>
          <button onClick={() => setActiveTab('hiring')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'hiring' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Hammer size={16} className={activeTab === 'hiring' ? 'fill-orange-200' : ''} /> Hire
          </button>
        </div>
      </div>

      {/* --- SOCIAL TAB (GT2 LOGIC) --- */}
      {activeTab === 'dating' && (
        <div className="relative">
          {/* Top fade overlay */}
          <div className="fixed top-[9.5rem] left-0 right-0 h-8 bg-gradient-to-b from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
          {/* Bottom fade overlay */}
          <div className="fixed bottom-20 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
          <div 
            ref={socialFeedRef}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col justify-start min-h-screen" 
            style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
             {/* Pull-to-Refresh Indicator */}
             {pullDistance > 0 && (
               <div 
                 className="fixed top-16 left-0 right-0 flex justify-center z-40 transition-all"
                 style={{ 
                   transform: `translateY(${Math.min(pullDistance, pullThreshold)}px)`,
                   opacity: pullDistance / pullThreshold 
                 }}
               >
                 <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                   <div className={`${pullDistance >= pullThreshold ? 'animate-spin' : ''}`}>
                     ↻
                   </div>
                   <span className="text-sm font-bold">
                     {pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh'}
                   </span>
                 </div>
               </div>
             )}
             
            {/* Fixed Filters Bar (GT2 Style) - fixed so the grid scrolls underneath */}
            <div ref={socialFiltersRef} className="fixed top-[9.5rem] left-0 right-0 bg-slate-50 z-20 max-w-md mx-auto px-4 pb-2">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                    <div className="grid grid-cols-2 gap-3 items-end">
                        <div className="col-span-2 flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                            <label className="flex items-center text-xs font-bold text-slate-700 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    name="verified"
                                    checked={socialFilter.verified}
                                    onChange={handleFilterChange}
                                    className={`mr-2 h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500`}
                                />
                                Verified Only
                            </label>
                            {/* GPS STATUS & MANUAL BUTTON */}
                            {userProfile?.latitude ? (
                                <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <Navigation size={10} /> GPS Active
                                </span>
                            ) : (
                                <button onClick={onEnableLocation} className="text-[10px] bg-slate-900 text-white px-2 py-1 rounded-full flex items-center gap-1 font-bold animate-pulse">
                                    <Navigation size={10} /> Enable Location
                                </button>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Trade</label>
                            <select
                                name="trade"
                                value={socialFilter.trade}
                                onChange={handleFilterChange}
                                className={`w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:border-orange-500`}
                            >
                                <option value="">Any</option>
                                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Max Dist ({socialFilter.distance} km)</label>
                            <input
                                type="range"
                                name="distance"
                                min="10"
                                max="200"
                                step="10"
                                value={socialFilter.distance}
                                onChange={handleFilterChange}
                                className={`w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600`}
                            />
                        </div>
                    </div>
                </div>
                <div className="h-4 bg-gradient-to-b from-slate-50 to-transparent"></div>
            </div>

            {/* Profile Grid (GT2 Style) */}
            <div
              className="fixed inset-x-0 z-10 max-w-md mx-auto"
              style={{ top: socialGridOffset, bottom: SOCIAL_GRID_BOTTOM_GAP }}
            >
              <div className="h-full overflow-y-auto px-4 pb-24" style={{ paddingTop: SOCIAL_GRID_TOP_INSET }}>
                <div className="grid grid-cols-3 gap-3 animate-stagger">
                  {isLoading ? (
                      // Show loading skeletons
                      Array.from({ length: 9 }).map((_, index) => (
                          <ProfileTileSkeleton key={`skeleton-${index}`} />
                      ))
                  ) : filteredSocialProfiles.length > 0 ? (
                      filteredSocialProfiles.map(profile => (
                          <ProfileTile
                              key={profile.uid}
                              profile={profile}
                              distanceKm={profile.distanceKm}
                              onOpenProfile={setSelectedSocialProfile}
                              isCurrentUser={profile.uid === user.uid}
                              shouldBlur={profile.blurPhotos && profile.uid !== user.uid}
                              hideDistance={profile.hideDistance}
                              profilePictureRequests={profilePictureRequests}
                              unreadCount={unreadMessagesPerUser[profile.uid] || 0}
                              currentUserEmail={user?.email}
                          />
                      ))
                  ) : (
                      <div className={`col-span-full py-12 text-center animate-fade-in`}>
                          <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                              <Filter className="text-slate-300" />
                          </div>
                          <p className={`text-slate-600 font-bold`}>No matches found.</p>
                          <p className="text-xs text-slate-400">Try adjusting your filters.</p>
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* Social Profile Modal (Social Tab Only) */}
            {selectedSocialProfile && (
                <SocialProfileModal
                    profile={selectedSocialProfile}
                    distanceKm={selectedSocialProfile.distanceKm}
                    onClose={() => setSelectedSocialProfile(null)}
                    hideDistance={selectedSocialProfile.hideDistance}
                    profilePictureRequests={profilePictureRequests}
                    onWinkSent={(message, type) => showToast(message, type)}
                    onOpenChat={(profile) => {
                        if (onMessage) onMessage(profile);
                    }}
                />
            )}
          </div>
        </div>
      )}

      {/* --- HIRING TAB (GT1 LOGIC + UI TWEAKS) --- */}
      {activeTab === 'hiring' && (
        <div className="relative">
          {/* Top fade overlay */}
          <div className="fixed top-[9.5rem] left-0 right-0 h-8 bg-gradient-to-b from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
          {/* Bottom fade overlay */}
          <div className="fixed bottom-20 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
          <div 
            ref={hiringFeedRef}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col justify-start min-h-screen" 
            style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
           {/* Pull-to-Refresh Indicator */}
           {pullDistance > 0 && (
             <div 
               className="fixed top-16 left-0 right-0 flex justify-center z-40 transition-all"
               style={{ 
                 transform: `translateY(${Math.min(pullDistance, pullThreshold)}px)`,
                 opacity: pullDistance / pullThreshold 
               }}
             >
               <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                 <div className={`${pullDistance >= pullThreshold ? 'animate-spin' : ''}`}>
                   ↻
                 </div>
                 <span className="text-sm font-bold">
                   {pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh'}
                 </span>
               </div>
             </div>
           )}
           
           {/* Fixed Filter Controls - no gap above */}
           <div className="fixed top-[9.5rem] left-0 right-0 z-20 max-w-md mx-auto px-4 pt-2">
               <div className="bg-slate-50 pb-2">
                   <div className="flex gap-2">
                       <div className="relative flex-1">
                           <MapPin className="absolute left-3 top-2.5 text-slate-400" size={16} />
                           <input 
                              type="text" 
                              placeholder="Filter by City/Area..." 
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 shadow-sm bg-white"
                              value={manualLocation}
                              onChange={(e) => setManualLocation(e.target.value)}
                           />
                       </div>
                       {filter && (
                            <button onClick={clearFilter} className="bg-orange-100 px-3 py-2 rounded-xl text-orange-900 text-xs font-bold border border-orange-200 flex items-center gap-1 shadow-sm">
                                 <X size={14}/> {filter}
                            </button>
                       )}
                   </div>
                   {/* Bottom fade gradient for smooth transition */}
                   <div className="h-4 bg-gradient-to-b from-slate-50 to-transparent"></div>
               </div>
           </div>

           {/* Tradie Cards */}
           <div className="space-y-4 px-4 pb-24" style={{ paddingTop: '14.5rem' }}>
              {isLoading ? (
                  // Show loading skeletons
                  Array.from({ length: 5 }).map((_, index) => (
                      <div key={`skeleton-hiring-${index}`} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-4 animate-pulse">
                          <div className="h-28 w-full bg-slate-200"></div>
                          <div className="p-4 flex items-start gap-4">
                              <div className="w-20 h-20 rounded-full bg-slate-200"></div>
                              <div className="flex-1">
                                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                                  <div className="h-3 bg-slate-200 rounded w-1/2 mb-3"></div>
                                  <div className="flex gap-2">
                                      <div className="h-6 bg-slate-200 rounded w-16"></div>
                                      <div className="h-6 bg-slate-200 rounded w-16"></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))
              ) : filteredHiringProfiles.length === 0 ? (
                 <div className="text-center py-10 text-slate-400">
                     <User size={48} className="mx-auto mb-3 opacity-20" />
                     {userProfile?.role === 'tradie' && !userProfile?.verified ? (
                         <div className="max-w-sm mx-auto">
                             <p className="font-bold text-slate-700 mb-2">Want to check out the competition?</p>
                             <p className="text-sm mb-4">Verify your profile to see other tradies in the Hire tab!</p>
                             <button
                                 onClick={() => {/* Navigate to verification - implement based on your app structure */}}
                                 className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                             >
                                 Verify Now
                             </button>
                         </div>
                     ) : (
                         <p className="font-bold">No pros found.</p>
                     )}
                 </div>
              ) : (
                 filteredHiringProfiles.map(p => {
                     const shouldUnblur = acceptedTradieIds.has(p.uid);
                     return (
                         <TradieCard 
                             key={p.uid} 
                             profile={p} 
                             mode={activeTab} 
                             isTrusted={shouldUnblur}
                             onMessage={() => onMessage(p)} 
                             onRequestJob={() => onRequestJob(p)}
                             currentUserEmail={user?.email}
                             currentUserId={user?.uid}
                         />
                     );
                 })
              )}
           </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Kept from GT1 for Hiring View
const TradieCard = ({ profile, mode, isTrusted, onMessage, onRequestJob, currentUserEmail = null, currentUserId = null }) => {
  // Use default cover photo based on role and email
  const coverPhotoUrl = getDefaultCoverPhoto(profile.email, profile.role);
  // Check if profile is admin - only check profile's email to show badge to all users
  const isAdmin = profile.email === ADMIN_EMAIL;
  
  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm mb-4 group hover:shadow-md transition-all ${
      isAdmin ? 'border-2 border-purple-400 shadow-purple-300/50 hover:shadow-purple-400/60' : 'border border-slate-100'
    }`}>
      {/* Cover Photo */}
      <div className="h-28 w-full bg-slate-200 relative overflow-hidden">
          <LazyImage src={coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2">
              {profile.verified && <Badge type="verified" text="Verified" />}
          </div>
          {/* Admin Badge */}
          {isAdmin && (
              <div className="absolute top-2 left-2 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white p-2 rounded-full shadow-xl border-2 border-white flex items-center justify-center animate-pulse-slow">
                  <Shield size={14} className="fill-white" />
              </div>
          )}
      </div>

    <div className="px-4 pb-4 relative">
        {/* Profile Picture Inset */}
        <div className="-mt-10 mb-3 flex justify-between items-end">
             <div className={`relative p-1 bg-white rounded-full ${profile.role === 'tradie' ? 'shadow-lg' : ''}`}>
                 <Avatar 
                    profile={profile} 
                    size="xl" 
                    className="w-20 h-20" 
                    blur={mode === 'hiring' && !isTrusted} 
                 />
                 {mode === 'hiring' && !isTrusted && (
                     <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/50 p-1 rounded-full text-white backdrop-blur-sm" title="Hire to unblur">
                              <ShieldCheck size={16} />
                          </div>
                     </div>
                 )}
             </div>
             
             <div className="flex gap-2 mb-1">
                 <Button variant="secondary" className="py-2 px-4 text-xs h-9 shadow-sm" onClick={onRequestJob}>
                    Request Job
                 </Button>
             </div>
        </div>
        
        {/* Content */}
        <div>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-1 text-slate-900">
                        {profile.name || profile.username}{profile.hideAge ? '' : `, ${profile.age}`}
                    </h3>
                    <div className="flex items-center text-xs text-slate-500 gap-1 mb-1">
                        <MapPin size={10} /> 
                        {profile.location}
                        {profile.distanceKm !== undefined && profile.distanceKm < 9999 && (
                            <span className="text-slate-400">• {profile.distanceKm < 1 ? '<1km' : `${Math.round(profile.distanceKm)}km`} away</span>
                        )}
                    </div>
                </div>
                {profile.rate && (
                     <div className="text-right">
                         <span className="block font-mono font-bold text-slate-800">£{profile.rate}/hr</span>
                         <div className="flex items-center justify-end gap-0.5 text-xs text-orange-500">
                             <Star size={10} fill="currentColor"/> 
                             <span className="font-bold">{profile.rating?.toFixed(1) || '5.0'}</span>
                             <span className="text-slate-400 ml-1">({profile.reviews || 0})</span>
                         </div>
                     </div>
                )}
            </div>

            {profile.trade && (
                 <div className="mb-2 mt-1">
                    <Badge type="trade" text={profile.trade} />
                 </div>
            )}
            
            <p className="text-slate-600 text-sm line-clamp-2 mt-2">{profile.bio}</p>
        </div>
    </div>
  </div>
  );
};

// --- Shop, Job Board, Chat, Profile (Mostly GT1 Structure) ---

const Shop = ({ user, showToast, onCartChange }) => {
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    
    const products = [
        { id: 1, name: 'GayTradies™ Tee', price: 25, image: '👕' },
        { id: 2, name: 'Pro Tool Belt', price: 45, image: '🛠️' },
        { id: 3, name: 'Hard Hat (Safety)', price: 15, image: '👷' },
        { id: 4, name: 'Rainbow Mug', price: 12, image: '☕' },
        { id: 5, name: 'Trucker Cap', price: 18, image: '🧢' },
        { id: 6, name: 'Premium Hoodie', price: 50, image: '🧥' },
    ];

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => 
                    item.id === product.id 
                        ? {...item, quantity: item.quantity + 1}
                        : item
                );
            }
            return [...prev, {...product, quantity: 1}];
        });
        showToast(`Added ${product.name} to cart!`, 'success');
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, change) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + change;
                return newQty > 0 ? {...item, quantity: newQty} : item;
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Notify parent about cart changes
    useEffect(() => {
        if (onCartChange) {
            onCartChange(cartCount);
        }
    }, [cartCount, onCartChange]);

    const handleCheckout = async () => {
        if (!user || !db) {
            showToast("Please sign in to checkout", "error");
            return;
        }
        
        try {
            // Create order in database
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'orders'), {
                userId: user.uid,
                items: cart,
                total: cartTotal,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            
            showToast("Order placed! Check email for details.", "success");
            setCart([]);
            setShowCart(false);
        } catch (error) {
            console.error("Checkout error:", error);
            showToast("Failed to place order. Please try again.", "error");
        }
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                    <ShoppingBag className="text-orange-500"/> Shop
                </h2>
                <button 
                    onClick={() => setShowCart(true)}
                    className="relative p-2 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 transition-colors"
                >
                    <ShoppingCart size={20} />
                    {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {cartCount}
                        </span>
                    )}
                </button>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <ShoppingCart className="text-orange-600 shrink-0 mt-0.5" size={20} />
                <p className="text-xs text-orange-900 leading-relaxed font-medium">Official merchandise and tools. All proceeds support the platform and LGBT trade charities.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 animate-stagger">
                {products.map(p => (
                    <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col group hover:shadow-xl hover:border-orange-300 transition-all duration-300 transform hover:-translate-y-1 active:scale-95">
                        <div className="h-32 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-5xl group-hover:scale-110 transition-transform duration-500">
                            {p.image}
                        </div>
                        <div className="p-3 flex-1 flex flex-col">
                            <h3 className="font-bold text-sm mb-1 text-slate-800">{p.name}</h3>
                            <p className="text-slate-500 text-xs mb-3 font-mono">£{p.price}.00</p>
                            <div className="mt-auto">
                                <Button 
                                    variant="secondary" 
                                    className="w-full py-2 text-xs h-8" 
                                    onClick={() => addToCart(p)}
                                >
                                    Add to Cart
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Cart Modal */}
            {showCart && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:w-[400px] h-[80vh] sm:h-auto sm:max-h-[80vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl relative flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
                            <h3 className="text-lg font-bold">Shopping Cart</h3>
                            <button onClick={() => setShowCart(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4">
                            {cart.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>Your cart is empty</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map(item => (
                                        <div key={item.id} className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
                                            <div className="text-3xl">{item.image}</div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-sm">{item.name}</h4>
                                                <p className="text-xs text-slate-500">£{item.price}.00</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold"
                                                >
                                                    -
                                                </button>
                                                <span className="w-8 text-center font-bold">{item.quantity}</span>
                                                <button 
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <button 
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {cart.length > 0 && (
                            <div className="p-4 border-t border-slate-200 bg-white">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-bold text-lg">Total:</span>
                                    <span className="font-bold text-2xl text-orange-600">£{cartTotal}.00</span>
                                </div>
                                <Button onClick={handleCheckout} variant="secondary" className="w-full py-3">
                                    Checkout
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const PostJobAdvert = ({ user, onCancel, onSuccess }) => {
  const [jobData, setJobData] = useState({ title: '', description: '', budget: '', tradeCategory: 'Electrician', location: '' });

  const submitAdvert = async () => {
    if(!jobData.title) return;
    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_adverts'), {
       ...jobData,
       clientUid: user.uid,
       clientName: user.displayName || 'Client', 
       createdAt: serverTimestamp()
    });
    onSuccess();
  };

  return (
    <div className="p-4 min-h-screen bg-white z-[60] absolute inset-0">
       <button onClick={onCancel} className="mb-4 text-slate-500 flex items-center gap-1 font-bold"><ArrowRight className="rotate-180" size={16}/> Back</button>
       <h2 className="text-2xl font-bold mb-2">Post a Job Advert</h2>
       <p className="text-slate-500 mb-6 text-sm">Visible to verified tradies matching the category.</p>
       
       <Input label="Job Title" placeholder="e.g. Rewire Kitchen" value={jobData.title} onChange={e => setJobData({...jobData, title: e.target.value})} />
       
       <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Required Trade</label>
          <select className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500" value={jobData.tradeCategory} onChange={e => setJobData({...jobData, tradeCategory: e.target.value})}>
             {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
       </div>

       <Input label="Location (City/Area)" placeholder="e.g. Hackney, London" value={jobData.location} onChange={e => setJobData({...jobData, location: e.target.value})} />
       <Input label="Description" textarea rows={4} placeholder="Describe the work needed..." value={jobData.description} onChange={e => setJobData({...jobData, description: e.target.value})} />
       <Input label="Estimated Budget" placeholder="e.g. £300" value={jobData.budget} onChange={e => setJobData({...jobData, budget: e.target.value})} />
       
       <Button onClick={submitAdvert} variant="secondary" className="w-full mt-4">Post Advert</Button>
    </div>
  );
};

const JobRequestForm = ({ user, tradie, onCancel, onSuccess }) => {
  const [jobData, setJobData] = useState({ title: '', description: '', budget: '' });

  const submitJob = async () => {
    if(!jobData.title) return;
    
    // Check email verification - reload user first to get latest status
    if (user) {
      try {
        await user.reload();
        const updatedUser = auth.currentUser;
        
        if (updatedUser && !updatedUser.emailVerified) {
          alert('Please verify your email before requesting jobs. Check your inbox for the verification link.');
          return;
        }
      } catch (err) {
        console.error('Error checking verification:', err);
        // If reload fails, fall back to cached status
        if (!user.emailVerified) {
          alert('Please verify your email before requesting jobs. Check your inbox for the verification link.');
          return;
        }
      }
    }
    
    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'), {
       ...jobData,
       clientUid: user.uid,
       tradieUid: tradie.uid,
       tradieName: tradie.name || tradie.username,
       clientName: user.displayName || 'Client', 
       status: 'Pending',
       createdAt: serverTimestamp()
    });
    onSuccess();
  };

  return (
    <div className="p-4 min-h-screen bg-white z-[60] absolute inset-0">
       <button onClick={onCancel} className="mb-4 text-slate-500 flex items-center gap-1 font-bold"><ArrowRight className="rotate-180" size={16}/> Back</button>
       <h2 className="text-2xl font-bold mb-2">Hire {tradie.name || tradie.username}</h2>
       <p className="text-slate-500 mb-6 text-sm">Send a direct request for work.</p>
       
       <Input label="Job Title" placeholder="e.g. Fix leaky tap" value={jobData.title} onChange={e => setJobData({...jobData, title: e.target.value})} />
       <Input label="Description" textarea rows={4} placeholder="Describe the work needed..." value={jobData.description} onChange={e => setJobData({...jobData, description: e.target.value})} />
       <Input label="Estimated Budget" placeholder="e.g. £100" value={jobData.budget} onChange={e => setJobData({...jobData, budget: e.target.value})} />
       
       <Button onClick={submitJob} variant="secondary" className="w-full mt-4">Send Request</Button>
    </div>
  );
};

const JobManager = ({ user, userProfile, onPendingCountChange }) => {
    const [viewMode, setViewMode] = useState('active'); 
    const [jobs, setJobs] = useState([]); 
    const [adverts, setAdverts] = useState([]);
    const [hiddenJobs, setHiddenJobs] = useState([]);
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [userToBlock, setUserToBlock] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [jobToReview, setJobToReview] = useState(null);
    const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
    const [showInfoRequestModal, setShowInfoRequestModal] = useState(false);
    const [jobForInfoRequest, setJobForInfoRequest] = useState(null);
    const [infoPhotos, setInfoPhotos] = useState([]);
    const [infoDescription, setInfoDescription] = useState('');
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [jobForQuote, setJobForQuote] = useState(null);
    const [quoteData, setQuoteData] = useState({ hourlyRate: '', estimatedHours: '', notes: '' });
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [jobToDecline, setJobToDecline] = useState(null);
    const [declineReason, setDeclineReason] = useState('');
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [jobForBooking, setJobForBooking] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [servicePhone, setServicePhone] = useState('');
    const [serviceEmail, setServiceEmail] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [jobForPayment, setJobForPayment] = useState(null);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [showPhotoGallery, setShowPhotoGallery] = useState(false);
    const [galleryPhotos, setGalleryPhotos] = useState([]);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [tradieAvailability, setTradieAvailability] = useState([]);

    useEffect(() => {
        if(!user || !db) return;
        const q = collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs');
        const unsub = onSnapshot(q, (snapshot) => {
            const myJobs = snapshot.docs.map(d => ({id: d.id, ...d.data()}))
                .filter(job => job.clientUid === user.uid || job.tradieUid === user.uid)
                .sort((a, b) => {
                    // Sort by creation date, newest first
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return bTime - aTime;
                });
            setJobs(myJobs);
            
            // Update jobs notification - check for pending actions
            const hasPendingActions = myJobs.some(job => {
                const isTradie = job.tradieUid === user.uid;
                const isClient = job.clientUid === user.uid;
                
                // Check for various pending states requiring action
                if (isTradie && job.status === 'Pending') return true; // New request
                if (isClient && job.status === 'InfoRequested') return true; // Info requested
                if (isClient && job.status === 'QuoteProvided') return true; // Quote to review
                if (isTradie && job.status === 'BookingRequested') return true; // Booking to confirm
                if (isClient && job.status === 'BookingConfirmed') return true; // Payment required
                if (isTradie && job.status === 'TradieAccepted') return false; // Waiting on client
                if (isClient && job.status === 'TradieAccepted') return true; // Client needs to approve
                
                // Review needed
                if (job.status === 'Completed' && job.awaitingReview) {
                    const hasReviewed = isTradie ? job.tradieReviewed : job.clientReviewed;
                    return !hasReviewed;
                }
                
                return false;
            });
            
            setHasJobsNotification(hasPendingActions);
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (viewMode === 'board' && userProfile?.role === 'tradie' && userProfile?.verified && db && user) {
             // Load job adverts
             const advertsQuery = collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_adverts');
             const advertsUnsub = onSnapshot(advertsQuery, (snapshot) => {
                 const ads = snapshot.docs.map(d => ({id: d.id, ...d.data()}))
                     .filter(ad => ad.tradeCategory === userProfile.trade);
                 setAdverts(ads);
             });
             
             // Load hidden jobs for this tradie
             const hiddenQuery = collection(db, 'artifacts', getAppId(), 'public', 'data', 'hidden_jobs');
             const hiddenUnsub = onSnapshot(hiddenQuery, (snapshot) => {
                 const hidden = snapshot.docs
                     .filter(d => d.data().tradieUid === user.uid)
                     .map(d => d.data().advertId);
                 setHiddenJobs(hidden);
             });
             
             return () => {
                 advertsUnsub();
                 hiddenUnsub();
             };
        }
    }, [viewMode, userProfile, user]);

    // Load tradie availability if user is a tradie
    useEffect(() => {
        if (userProfile?.role === 'tradie' && user && db) {
            const q = collection(db, 'artifacts', getAppId(), 'public', 'data', 'tradie_availability');
            const unsub = onSnapshot(q, (snapshot) => {
                const availability = snapshot.docs
                    .filter(d => d.data().tradieUid === user.uid)
                    .map(d => ({ id: d.id, ...d.data() }));
                setTradieAvailability(availability);
            });
            return () => unsub();
        }
    }, [userProfile, user]);

    // Update pending jobs count whenever jobs change
    useEffect(() => {
        if (onPendingCountChange && user) {
            const count = getPendingActionsCount();
            onPendingCountChange(count);
        }
    }, [jobs, user, userProfile]);

    const handleBlockFromJob = async () => {
        if (!userToBlock) return;
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'), {
                blockedBy: user.uid,
                blockedUser: userToBlock.uid,
                blockedUserName: userToBlock.name,
                blockedAt: serverTimestamp(),
                source: 'job'
            });
            setShowBlockConfirm(false);
            setUserToBlock(null);
        } catch (error) {
            console.error("Error blocking user:", error);
        }
    };

    const handleStatusUpdate = async (jobId, newStatus) => {
        try {
            const updateData = { status: newStatus };
            
            // If moving to Completed, set awaitingReview flags and delete ALL private information for privacy
            if (newStatus === 'Completed') {
                updateData.awaitingReview = true;
                updateData.completedAt = serverTimestamp();
                updateData.jobPhotos = []; // Delete photos for privacy
                // Delete ALL private contact information
                updateData['serviceLocation.address'] = '';
                updateData['serviceLocation.phone'] = '';
                updateData['serviceLocation.email'] = '';
                
                // Move payment from "On Hold" to "Available" for tradie
                const jobDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId));
                if (jobDoc.exists()) {
                    const jobData = jobDoc.data();
                    if (jobData.tradieUid && jobData.tradieAmount) {
                        const tradieAmount = jobData.tradieAmount;
                        
                        // Update tradie's balance
                        await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', jobData.tradieUid), {
                            'finances.onHoldBalance': increment(-tradieAmount),
                            'finances.availableBalance': increment(tradieAmount)
                        });
                        
                        // Update transaction status
                        const q = query(
                            collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'),
                            where('jobId', '==', jobId),
                            where('type', '==', 'payment')
                        );
                        const txSnapshot = await getDocs(q);
                        const updatePromises = txSnapshot.docs.map(txDoc => 
                            updateDoc(txDoc.ref, { status: 'completed' })
                        );
                        await Promise.all(updatePromises);
                    }
                }
            }
            
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), updateData);
            
            // Immediately show review modal for the user who just completed the job
            if (newStatus === 'Completed') {
                const jobDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId));
                if (jobDoc.exists()) {
                    setJobToReview({ id: jobId, ...jobDoc.data() });
                    setShowReviewModal(true);
                }
            }
        } catch (error) {
            console.error("Error updating job status:", error);
        }
    };

    const handleSubmitReview = async () => {
        if (!jobToReview || !reviewData.rating) return;
        
        try {
            const job = jobToReview;
            const isTradie = job.tradieUid === user.uid;
            const reviewedUid = isTradie ? job.clientUid : job.tradieUid;
            const reviewedName = isTradie ? job.clientName : job.tradieName;
            const reviewerRole = isTradie ? 'tradie' : 'client';
            
            // Add review to collection
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_reviews'), {
                jobId: job.id,
                reviewedUid,
                reviewedName,
                reviewerUid: user.uid,
                reviewerName: userProfile?.name || user.displayName || 'User',
                reviewerRole,
                rating: reviewData.rating,
                comment: reviewData.comment.trim(),
                createdAt: serverTimestamp()
            });
            
            // Update job to mark this user's review as complete
            const reviewField = isTradie ? 'tradieReviewed' : 'clientReviewed';
            const updateData = { [reviewField]: true };
            
            // Check if both have now reviewed - if so, archive the job (keep minimal record)
            const otherReviewField = isTradie ? 'clientReviewed' : 'tradieReviewed';
            const bothReviewed = job[otherReviewField]; // Other party already reviewed
            
            if (bothReviewed) {
                // Both parties have now reviewed - Archive job (keep minimal record for legal/dispute purposes)
                updateData.archived = true;
                updateData.awaitingReview = false;
                // Generate invoice ID if not exists
                if (!job.invoiceId) {
                    updateData.invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                }
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', job.id), updateData);
            } else {
                // Only this user has reviewed so far, update the job
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', job.id), updateData);
            }
            
            // Update tradie's average rating if reviewing a tradie
            if (reviewerRole === 'client') {
                await updateTradieRating(reviewedUid);
            }
            
            setShowReviewModal(false);
            setJobToReview(null);
            setReviewData({ rating: 5, comment: '' });
        } catch (error) {
            console.error("Error submitting review:", error);
        }
    };
    
    const updateTradieRating = async (tradieUid) => {
        try {
            // Get all reviews for this tradie
            const reviewsRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_reviews');
            const q = query(reviewsRef, where('reviewedUid', '==', tradieUid), where('reviewerRole', '==', 'client'));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return;
            
            const reviews = snapshot.docs.map(doc => doc.data());
            const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            const reviewCount = reviews.length;
            
            // Update tradie profile
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                rating: avgRating,
                reviews: reviewCount
            });
        } catch (error) {
            console.error("Error updating tradie rating:", error);
        }
    };

    // Enhanced workflow handlers
    const handleRequestInfo = async (jobId) => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'InfoRequested',
                infoRequestedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error requesting info:", error);
        }
    };

    const handleSubmitInfo = async () => {
        if (!jobForInfoRequest || infoPhotos.length === 0) return;
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForInfoRequest.id), {
                status: 'InfoProvided',
                infoPhotos: infoPhotos,
                infoDescription: infoDescription,
                infoProvidedAt: serverTimestamp()
            });
            setShowInfoRequestModal(false);
            setInfoPhotos([]);
            setInfoDescription('');
            setJobForInfoRequest(null);
        } catch (error) {
            console.error("Error submitting info:", error);
        }
    };

    const handleSubmitQuote = async () => {
        if (!jobForQuote || !quoteData.hourlyRate || !quoteData.estimatedHours) return;
        try {
            const total = parseFloat(quoteData.hourlyRate) * parseFloat(quoteData.estimatedHours);
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForQuote.id), {
                status: 'QuoteProvided',
                quote: {
                    hourlyRate: parseFloat(quoteData.hourlyRate),
                    estimatedHours: parseFloat(quoteData.estimatedHours),
                    total: total,
                    notes: quoteData.notes
                },
                quotedAt: serverTimestamp()
            });
            setShowQuoteModal(false);
            setQuoteData({ hourlyRate: '', estimatedHours: '', notes: '' });
            setJobForQuote(null);
        } catch (error) {
            console.error("Error submitting quote:", error);
        }
    };

    const handleDeclineJob = async () => {
        if (!jobToDecline || !declineReason.trim()) return;
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobToDecline.id), {
                status: 'Declined',
                declineReason: declineReason,
                declinedAt: serverTimestamp()
            });
            setShowDeclineModal(false);
            setDeclineReason('');
            setJobToDecline(null);
        } catch (error) {
            console.error("Error declining job:", error);
        }
    };

    const handleAcceptQuote = async (jobId) => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'QuoteAccepted',
                quoteAcceptedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error accepting quote:", error);
        }
    };

    const handleDeclineQuote = async (jobId) => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'QuoteDeclined',
                quoteDeclinedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error declining quote:", error);
        }
    };

    const handleSubmitBooking = async () => {
        if (!jobForBooking || !selectedDate || !selectedTimeSlot || !serviceAddress.trim() || !servicePhone.trim()) {
            alert('Please fill in all required fields (address, phone, date, and time)');
            return;
        }
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForBooking.id), {
                status: 'BookingRequested',
                booking: {
                    date: selectedDate,
                    timeSlot: selectedTimeSlot
                },
                serviceLocation: {
                    address: serviceAddress,
                    phone: servicePhone,
                    email: serviceEmail || user?.email || ''
                },
                bookingRequestedAt: serverTimestamp()
            });
            setShowBookingModal(false);
            setSelectedDate(null);
            setSelectedTimeSlot('');
            setServiceAddress('');
            setServicePhone('');
            setServiceEmail('');
            setJobForBooking(null);
        } catch (error) {
            console.error("Error submitting booking:", error);
        }
    };

    const handleConfirmBooking = async (jobId) => {
        try {
            const job = jobs.find(j => j.id === jobId);
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'BookingConfirmed',
                bookingConfirmedAt: serverTimestamp()
            });
            
            // Update tradie's work calendar to mark the booked time as unavailable
            if (job?.tradieUid && job?.booking?.date && job?.booking?.timeSlot) {
                const tradieRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', job.tradieUid);
                const tradieDoc = await getDoc(tradieRef);
                const tradieData = tradieDoc.data();
                const workCalendar = tradieData?.workCalendar || {};
                
                // Support both old format (array) and new format (object)
                const dateSlots = workCalendar[job.booking.date];
                let updatedDateSlots;
                
                if (Array.isArray(dateSlots)) {
                    // Old format - convert to new format
                    updatedDateSlots = {};
                    dateSlots.forEach(slot => {
                        updatedDateSlots[slot] = { reason: 'manual' };
                    });
                } else {
                    updatedDateSlots = dateSlots || {};
                }
                
                // Add the booked time slot
                updatedDateSlots[job.booking.timeSlot] = { 
                    reason: 'job', 
                    jobId: jobId 
                };
                
                await updateDoc(tradieRef, {
                    [`workCalendar.${job.booking.date}`]: updatedDateSlots
                });
            }
        } catch (error) {
            console.error("Error confirming booking:", error);
        }
    };

    const handleProcessPayment = async () => {
        if (!jobForPayment) return;
        setProcessingPayment(true);
        
        // Simulate payment processing
        setTimeout(async () => {
            try {
                const paymentAmount = jobForPayment.quote?.total || 0;
                const commission = paymentAmount * 0.15; // 15% commission
                const tradieAmount = paymentAmount - commission;
                
                // Update job status
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForPayment.id), {
                    status: 'PaymentComplete',
                    paymentCompletedAt: serverTimestamp(),
                    paymentAmount: paymentAmount,
                    commission: commission,
                    tradieAmount: tradieAmount
                });
                
                // Add payment to tradie's "On Hold" balance
                if (jobForPayment.tradieUid) {
                    await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', jobForPayment.tradieUid), {
                        'finances.onHoldBalance': increment(tradieAmount),
                        'finances.totalEarnings': increment(tradieAmount),
                        'finances.totalCommissionPaid': increment(commission)
                    });
                    
                    // Create transaction record
                    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'), {
                        tradieUid: jobForPayment.tradieUid,
                        jobId: jobForPayment.id,
                        jobTitle: jobForPayment.title || 'Job',
                        type: 'payment',
                        amount: tradieAmount,
                        commission: commission,
                        status: 'onHold',
                        createdAt: serverTimestamp()
                    });
                }
                
                setProcessingPayment(false);
                setShowPaymentModal(false);
                
                // Store jobId before clearing state
                const completedJobId = jobForPayment.id;
                setJobForPayment(null);
                
                // Automatically move to InProgress after payment
                setTimeout(async () => {
                    try {
                        await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', completedJobId), {
                            status: 'InProgress',
                            startedAt: serverTimestamp()
                        });
                    } catch (error) {
                        console.error("Error moving job to InProgress:", error);
                    }
                }, 1000);
            } catch (error) {
                console.error("Error processing payment:", error);
                setProcessingPayment(false);
            }
        }, 2000);
    };

    const handleAcceptJobFromBoard = async (advert) => {
        try {
            // Create a new job from the advert
            const jobRef = await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'), {
                title: advert.title,
                description: advert.description,
                budget: advert.budget,
                clientUid: advert.clientUid,
                clientName: advert.clientName,
                tradieUid: user.uid,
                tradieName: userProfile?.name || user.displayName || 'Tradie',
                tradieTrade: userProfile?.trade || 'Tradie',
                status: 'TradieAccepted', // Awaiting client approval
                source: 'job_board',
                createdAt: serverTimestamp(),
                acceptedAt: serverTimestamp()
            });
            
            // Delete the advert from job_adverts
            await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'job_adverts', advert.id));
            
            showToast('Job accepted! Awaiting client approval.');
        } catch (error) {
            console.error("Error accepting job from board:", error);
            showToast('Error accepting job');
        }
    };

    const handleHideJobFromBoard = async (advertId) => {
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'hidden_jobs'), {
                tradieUid: user.uid,
                advertId: advertId,
                hiddenAt: serverTimestamp()
            });
            showToast('Job hidden from your view');
        } catch (error) {
            console.error("Error hiding job:", error);
        }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length + infoPhotos.length > 5) {
            alert('Maximum 5 photos allowed');
            return;
        }

        const readers = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        });

        const results = await Promise.all(readers);
        setInfoPhotos([...infoPhotos, ...results]);
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'Pending': return 'bg-yellow-100 text-yellow-700';
            case 'TradieAccepted': return 'bg-cyan-100 text-cyan-700';
            case 'InfoRequested': return 'bg-blue-100 text-blue-700';
            case 'InfoProvided': return 'bg-cyan-100 text-cyan-700';
            case 'QuoteProvided': return 'bg-indigo-100 text-indigo-700';
            case 'QuoteAccepted': return 'bg-purple-100 text-purple-700';
            case 'BookingRequested': return 'bg-violet-100 text-violet-700';
            case 'BookingConfirmed': return 'bg-fuchsia-100 text-fuchsia-700';
            case 'PaymentComplete': return 'bg-green-100 text-green-700';
            case 'Accepted': return 'bg-blue-100 text-blue-700';
            case 'InProgress': return 'bg-purple-100 text-purple-700';
            case 'Completed': return 'bg-green-100 text-green-700';
            case 'Declined': return 'bg-red-100 text-red-700';
            case 'QuoteDeclined': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    // Get contextual status message for job
    const getJobStatusMessage = (job, isTradie) => {
        const tradeName = job.tradeName || job.tradieTrade || 'Tradie';
        const clientName = job.clientName || 'Client';
        const quoteAmount = job.quote?.total?.toFixed(2) || '0';
        const paymentAmount = job.paymentAmount?.toFixed(2) || quoteAmount;
        const bookingDate = job.booking?.date || '';
        const bookingTime = job.booking?.timeSlot || '';
        
        if (job.status === 'Declined') {
            return { text: `This job was declined. ${job.declineReason ? `Reason: ${job.declineReason}` : ''}`, color: 'bg-red-50 border-red-200 text-red-700' };
        }
        if (job.status === 'QuoteDeclined') {
            return isTradie 
                ? { text: `${clientName} declined your quote.`, color: 'bg-red-50 border-red-200 text-red-700' }
                : { text: `You declined the quote from ${tradeName}.`, color: 'bg-gray-50 border-gray-200 text-gray-700' };
        }
        
        switch(job.status) {
            case 'TradieAccepted':
                return isTradie
                    ? { text: `You accepted this job from the Job Board. Awaiting ${clientName}'s approval.`, color: 'bg-blue-50 border-blue-200 text-blue-700' }
                    : { text: `${tradeName} has accepted your job posting. Review and approve to continue.`, color: 'bg-orange-50 border-orange-200 text-orange-700' };
            
            case 'Pending':
                return isTradie 
                    ? { text: `New job request from ${clientName}. Review and respond.`, color: 'bg-orange-50 border-orange-200 text-orange-700' }
                    : { text: `Your request is being reviewed by the ${tradeName}.`, color: 'bg-blue-50 border-blue-200 text-blue-700' };
            
            case 'Accepted':
                return isTradie
                    ? { text: `Job accepted. Request more info or provide a quote to ${clientName}.`, color: 'bg-blue-50 border-blue-200 text-blue-700' }
                    : { text: `The ${tradeName} has accepted your job request.`, color: 'bg-green-50 border-green-200 text-green-700' };
            
            case 'InfoRequested':
                return isTradie
                    ? { text: `Awaiting additional information from ${clientName}.`, color: 'bg-blue-50 border-blue-200 text-blue-700' }
                    : { text: `The ${tradeName} has accepted your job and requested more information from you.`, color: 'bg-orange-50 border-orange-200 text-orange-700' };
            
            case 'InfoProvided':
                return isTradie
                    ? { text: `${clientName} has provided the requested information. Review to provide a quote.`, color: 'bg-orange-50 border-orange-200 text-orange-700' }
                    : { text: `Information submitted. Awaiting quote from the ${tradeName}.`, color: 'bg-blue-50 border-blue-200 text-blue-700' };
            
            case 'QuoteProvided':
                return isTradie
                    ? { text: `${clientName} is reviewing your quote of £${quoteAmount}.`, color: 'bg-blue-50 border-blue-200 text-blue-700' }
                    : { text: `The ${tradeName} has provided a quote of £${quoteAmount}. Review and accept to continue.`, color: 'bg-orange-50 border-orange-200 text-orange-700' };
            
            case 'QuoteAccepted':
                return isTradie
                    ? { text: `${clientName} has accepted your quote of £${quoteAmount}. Awaiting booking selection.`, color: 'bg-green-50 border-green-200 text-green-700' }
                    : { text: `You've accepted the quote of £${quoteAmount}. Select a booking time to proceed.`, color: 'bg-orange-50 border-orange-200 text-orange-700' };
            
            case 'BookingRequested':
                return isTradie
                    ? { text: `New booking request for ${bookingDate} at ${bookingTime}. Confirm to proceed.`, color: 'bg-orange-50 border-orange-200 text-orange-700' }
                    : { text: `Booking request sent for ${bookingDate} at ${bookingTime}. Awaiting confirmation from the ${tradeName}.`, color: 'bg-blue-50 border-blue-200 text-blue-700' };
            
            case 'BookingConfirmed':
                return isTradie
                    ? { text: `Booking confirmed for ${bookingDate} at ${bookingTime}. Awaiting payment from ${clientName}.`, color: 'bg-blue-50 border-blue-200 text-blue-700' }
                    : { text: `The ${tradeName} has confirmed your booking. Complete payment to begin work.`, color: 'bg-orange-50 border-orange-200 text-orange-700' };
            
            case 'PaymentComplete':
                return { text: `Payment of £${paymentAmount} received. Work is now in progress.`, color: 'bg-green-50 border-green-200 text-green-700' };
            
            case 'InProgress':
                return isTradie
                    ? { text: `Payment of £${paymentAmount} received. You can begin work.`, color: 'bg-green-50 border-green-200 text-green-700' }
                    : { text: `Payment of £${paymentAmount} received. Work is now in progress.`, color: 'bg-blue-50 border-blue-200 text-blue-700' };
            
            case 'Completed':
                if (job.awaitingReview) {
                    const hasReviewed = isTradie ? job.tradieReviewed : job.clientReviewed;
                    if (hasReviewed) {
                        return { text: 'Job completed. Review submitted.', color: 'bg-green-50 border-green-200 text-green-700' };
                    }
                    return { text: 'Job completed! Leave a review to help others.', color: 'bg-orange-50 border-orange-200 text-orange-700' };
                }
                return { text: 'Job completed successfully.', color: 'bg-green-50 border-green-200 text-green-700' };
            
            default:
                return { text: '', color: '' };
        }
    };

    // Get progress steps for job
    const getJobProgress = (job) => {
        const steps = [
            { label: 'Request Made', key: 'request' },
            { label: 'Request Accepted', key: 'accepted' },
            { label: 'More Information', key: 'info' },
            { label: 'Quote Provided', key: 'quote' },
            { label: 'Quote Accepted', key: 'quoteAccepted' },
            { label: 'Booking Confirmed', key: 'booking' },
            { label: 'Payment Received', key: 'payment' },
            { label: 'Work Complete', key: 'complete' }
        ];

        const status = job.status;
        const infoSkipped = status !== 'Declined' && status !== 'Pending' && 
                          status !== 'Accepted' && status !== 'InfoRequested' && 
                          status !== 'InfoProvided' && job.status !== 'QuoteDeclined';

        return steps.map(step => {
            switch(step.key) {
                case 'request':
                    return { ...step, status: 'complete' };
                case 'accepted':
                    return { ...step, status: ['Pending', 'Declined'].includes(status) ? 'pending' : 'complete' };
                case 'info':
                    if (status === 'InfoRequested' || status === 'InfoProvided') return { ...step, status: 'complete' };
                    if (infoSkipped) return { ...step, status: 'skipped' };
                    return { ...step, status: 'pending' };
                case 'quote':
                    return { ...step, status: ['QuoteProvided', 'QuoteAccepted', 'BookingRequested', 'BookingConfirmed', 'PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : 'pending' };
                case 'quoteAccepted':
                    return { ...step, status: ['QuoteAccepted', 'BookingRequested', 'BookingConfirmed', 'PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : status === 'QuoteDeclined' ? 'skipped' : 'pending' };
                case 'booking':
                    return { ...step, status: ['BookingConfirmed', 'PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : 'pending' };
                case 'payment':
                    return { ...step, status: ['PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : 'pending' };
                case 'complete':
                    return { ...step, status: status === 'Completed' ? 'complete' : 'pending' };
                default:
                    return { ...step, status: 'pending' };
            }
        });
    };

    const getPendingActionsCount = () => {
        const isTradie = userProfile?.role === 'tradie';
        return jobs.filter(job => {
            if (isTradie) {
                // Tradie pending actions
                if (job.tradieUid === user.uid) {
                    if (job.status === 'Pending') return true;
                    if (job.status === 'InfoProvided') return true;
                    if (job.status === 'BookingRequested') return true;
                    if (job.status === 'Completed' && job.awaitingReview && !job.tradieReviewed) return true;
                }
            } else {
                // Client pending actions
                if (job.clientUid === user.uid) {
                    if (job.status === 'InfoRequested') return true;
                    if (job.status === 'QuoteProvided') return true;
                    if (job.status === 'BookingConfirmed') return true;
                    if (job.status === 'Completed' && job.awaitingReview && !job.clientReviewed) return true;
                }
            }
            return false;
        }).length;
    };

    return (
        <div className="p-4">
            {userProfile?.role === 'tradie' ? (
                <div className="flex bg-gradient-to-r from-slate-200 to-slate-100 p-1.5 rounded-2xl mb-6 shadow-md border-2 border-slate-200">
                    <button onClick={() => setViewMode('active')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${viewMode === 'active' ? 'bg-white shadow-lg text-slate-900 scale-105' : 'text-slate-500 hover:text-slate-700'}`}>
                        📋 My Active Jobs
                    </button>
                    <button onClick={() => setViewMode('board')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${viewMode === 'board' ? 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg text-white scale-105' : 'text-slate-500 hover:text-slate-700'}`}>
                        ✨ Job Board (New Leads)
                    </button>
                </div>
            ) : (
                <h2 className="text-xl font-bold mb-4 text-slate-900">📋 My Requests & Adverts</h2>
            )}

            {viewMode === 'board' && userProfile?.role === 'tradie' && (
                <div>
                     {!userProfile.verified ? (
                         <div className="bg-slate-100 border border-slate-200 p-6 rounded-xl text-center">
                             <ShieldCheck className="mx-auto text-slate-400 mb-2" size={32} />
                             <h3 className="font-bold text-slate-800">Verification Required</h3>
                             <p className="text-sm text-slate-500 mb-4">To see the Job Board, you must verify your trade ID.</p>
                             <div className="inline-flex items-center gap-1 bg-white px-3 py-1 rounded border border-slate-200 text-xs font-mono text-slate-500"><Badge type="locked" text="Locked" /></div>
                         </div>
                     ) : (
                         <div className="space-y-3">
                             {adverts.length === 0 ? (
                                 <div className="text-center py-8 text-slate-400"><ClipboardList className="mx-auto mb-2 opacity-50" size={32}/><p>No open adverts for {userProfile.trade}s right now.</p></div>
                             ) : (
                                 adverts
                                     .filter(ad => !hiddenJobs.includes(ad.id)) // Filter out hidden jobs
                                     .map(ad => (
                                     <div key={ad.id} className="bg-gradient-to-br from-white to-orange-50/30 p-4 rounded-2xl border-2 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                                         <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] px-3 py-1.5 rounded-bl-xl font-bold shadow-md flex items-center gap-1">
                                             <span className="animate-pulse">✨</span> New Lead
                                         </div>
                                         <h4 className="font-bold text-slate-900 text-base pr-20">{ad.title}</h4>
                                         <div className="flex items-center gap-2 text-xs text-slate-600 mb-2 mt-1">
                                             <span className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded-lg shadow-sm">
                                                 <MapPin size={12} className="text-orange-500" /> {ad.location}
                                             </span>
                                             <span className="font-bold bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-1 rounded-lg shadow-sm">
                                                 💰 {ad.budget}
                                             </span>
                                         </div>
                                         <p className="text-sm text-slate-700 mb-3 bg-white/40 p-2 rounded-lg">{ad.description}</p>
                                         <div className="flex gap-2">
                                             <Button variant="primary" className="flex-1 py-2 text-xs" onClick={() => handleAcceptJobFromBoard(ad)}>
                                                 ✓ Accept Job
                                             </Button>
                                             <Button variant="ghost" className="flex-1 py-2 text-xs border-slate-200" onClick={() => handleHideJobFromBoard(ad.id)}>
                                                 Hide
                                             </Button>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>
                     )}
                </div>
            )}

            {viewMode === 'active' && (
                <div className="space-y-3">
                    {jobs.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-100"><Briefcase size={40} className="mx-auto mb-2 opacity-50"/><p>No active jobs.</p></div>
                    ) : (
                        jobs.map(job => {
                            const isTradie = job.tradieUid === user.uid;
                            const isClient = job.clientUid === user.uid;
                            const hasReviewed = isTradie ? job.tradieReviewed : job.clientReviewed;
                            const needsReview = job.status === 'Completed' && job.awaitingReview && !hasReviewed;
                            const statusMessage = getJobStatusMessage(job, isTradie);
                            const progressSteps = getJobProgress(job);
                            
                            // Archived job - minimal display with invoice and report option
                            if (job.archived) {
                                return (
                                    <div key={job.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-700">{job.title}</h4>
                                                <p className="text-xs text-slate-500 mt-1">Invoice: {job.invoiceId}</p>
                                            </div>
                                            <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                                                ✓ Reviewed
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-3">
                                            {isTradie ? `Client: ${job.clientName}` : `Tradie: ${job.tradieName}`}
                                        </p>
                                        <button
                                            onClick={() => {
                                                // TODO: Implement report/dispute modal
                                                alert('Report/dispute functionality coming soon. Invoice: ' + job.invoiceId);
                                            }}
                                            className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                                        >
                                            <Flag size={12} />
                                            Report something
                                        </button>
                                    </div>
                                );
                            }
                            
                            return (
                                <div key={job.id} className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
                                    {/* Status Message Banner */}
                                    {statusMessage.text && (
                                        <div className={`mb-3 p-3 rounded-xl border-2 text-xs font-bold shadow-md backdrop-blur-sm ${statusMessage.color} flex items-start gap-2`}>
                                            <span className="text-base flex-shrink-0">
                                                {statusMessage.color.includes('orange') && '⚠️'}
                                                {statusMessage.color.includes('blue') && 'ℹ️'}
                                                {statusMessage.color.includes('green') && '✓'}
                                                {statusMessage.color.includes('red') && '✗'}
                                            </span>
                                            <span className="flex-1">{statusMessage.text}</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-3">
                                        {/* Main Job Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-900 flex-1 text-base">{job.title}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize shadow-md border-2 ${getStatusColor(job.status)}`}>
                                                        {job.status}
                                                    </span>
                                                    {/* Block button only shown when job is Pending (before acceptance) */}
                                                    {job.status === 'Pending' && (
                                                        <button
                                                            onClick={() => {
                                                                setUserToBlock({
                                                                    uid: isTradie ? job.clientUid : job.tradieUid,
                                                                    name: isTradie ? job.clientName : job.tradieName
                                                                });
                                                                setShowBlockConfirm(true);
                                                            }}
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="Block user"
                                                        >
                                                            <Ban size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-2">
                                                {isTradie ? `Client: ${job.clientName}` : `Tradie: ${job.tradieName}`}
                                            </p>
                                            <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded mb-2">{job.description}</p>
                                            {job.budget && <p className="text-xs text-slate-500 mb-2">Budget: {job.budget}</p>}
                                    
                                    {/* Show photos if available */}
                                    {job.infoPhotos && job.infoPhotos.length > 0 && (
                                        <div className="mb-2">
                                            <p className="text-xs font-bold text-slate-600 mb-1">Photos:</p>
                                            <div className="flex gap-1 flex-wrap">
                                                {job.infoPhotos.slice(0, 3).map((photo, idx) => (
                                                    <img key={idx} src={photo} className="w-16 h-16 object-cover rounded border cursor-pointer" 
                                                        onClick={() => { setGalleryPhotos(job.infoPhotos); setShowPhotoGallery(true); }} />
                                                ))}
                                                {job.infoPhotos.length > 3 && (
                                                    <div className="w-16 h-16 bg-slate-100 rounded border flex items-center justify-center text-xs font-bold text-slate-500 cursor-pointer"
                                                        onClick={() => { setGalleryPhotos(job.infoPhotos); setShowPhotoGallery(true); }}>
                                                        +{job.infoPhotos.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Show quote if available */}
                                    {job.quote && (
                                        <div className="mb-2 p-3 bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-2 border-indigo-300 rounded-xl shadow-md">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-base">💰</span>
                                                <p className="text-xs font-bold text-indigo-900">Quote Details</p>
                                            </div>
                                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 mb-1">
                                                <p className="text-sm text-indigo-900 font-bold">£{job.quote.hourlyRate}/hr × {job.quote.estimatedHours}hrs = £{job.quote.total.toFixed(2)}</p>
                                            </div>
                                            {job.quote.notes && <p className="text-xs text-indigo-700 mt-2 italic">{job.quote.notes}</p>}
                                        </div>
                                    )}
                                    
                                    {/* Show booking if available */}
                                    {job.booking && (
                                        <div className="mb-2 p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 border-2 border-purple-300 rounded-xl shadow-md">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">📅</span>
                                                <p className="text-xs font-bold text-purple-900">Booking: {job.booking.date} - {job.booking.timeSlot}</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Show service location (address) to tradie after booking confirmed */}
                                    {isTradie && job.serviceLocation && ['InProgress', 'Completed'].includes(job.status) && (
                                        <div className="mb-2 p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 border-2 border-blue-300 rounded-xl shadow-md">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-base">📍</span>
                                                <p className="text-xs font-bold text-blue-900">Service Location</p>
                                            </div>
                                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 space-y-1">
                                                <p className="text-xs text-blue-900 font-medium">{job.serviceLocation.address}</p>
                                                <p className="text-xs text-blue-800 flex items-center gap-1">
                                                    <span>📞</span> {job.serviceLocation.phone}
                                                </p>
                                                {job.serviceLocation.email && (
                                                    <p className="text-xs text-blue-800 flex items-center gap-1">
                                                        <span>✉️</span> {job.serviceLocation.email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                    
                                    {/* Progress Tracker Sidebar */}
                                    <div className="w-32 flex-shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 p-3 rounded-xl border-2 border-slate-200 shadow-md">
                                        <p className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                                            Progress
                                        </p>
                                        <div className="space-y-2 relative">
                                            {/* Vertical connecting line */}
                                            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-300 to-slate-200"></div>
                                            
                                            {progressSteps.map((step, idx) => (
                                                <div key={idx} className="flex items-start gap-2 text-xs relative z-10">
                                                    <span className="mt-0.5 flex-shrink-0">
                                                        {step.status === 'complete' && (
                                                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-[10px] shadow-md border-2 border-white">✓</span>
                                                        )}
                                                        {step.status === 'skipped' && (
                                                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white font-bold text-[10px] shadow-md border-2 border-white">✗</span>
                                                        )}
                                                        {step.status === 'pending' && (
                                                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white border-2 border-slate-300 shadow-sm"></span>
                                                        )}
                                                    </span>
                                                    <span className={`leading-tight transition-all ${
                                                        step.status === 'complete' 
                                                            ? 'text-slate-800 font-bold' 
                                                            : step.status === 'skipped'
                                                            ? 'text-slate-400 line-through'
                                                            : 'text-slate-500'
                                                    }`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Action Buttons Section - Full Width Below */}
                                <div className="mt-3">
                                    {/* ENHANCED WORKFLOW ACTIONS */}
                                    
                                    {/* Client: Approve or decline tradie who accepted from Job Board */}
                                    {isClient && job.status === 'TradieAccepted' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobToDecline(job); setShowDeclineModal(true); }}>
                                                Decline Offer
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleStatusUpdate(job.id, 'Pending')}>
                                                Accept Offer
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Tradie: Initial response to Pending */}
                                    {isTradie && job.status === 'Pending' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobToDecline(job); setShowDeclineModal(true); }}>
                                                Decline
                                            </Button>
                                            <Button variant="ghost" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => {
                                                    setUserToBlock({
                                                        uid: job.clientUid,
                                                        name: job.clientName
                                                    });
                                                    setShowBlockConfirm(true);
                                                }}>
                                                Block
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleStatusUpdate(job.id, 'Accepted')}>
                                                Accept
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Tradie: After accepting - can request info or quote */}
                                    {isTradie && job.status === 'Accepted' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="secondary" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleRequestInfo(job.id)}>
                                                Request Info/Photos
                                            </Button>
                                            <Button variant="primary" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobForQuote(job); setShowQuoteModal(true); }}>
                                                Quote Price
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Client: Provide info when requested */}
                                    {isClient && job.status === 'InfoRequested' && (
                                        <Button variant="primary" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => { setJobForInfoRequest(job); setShowInfoRequestModal(true); }}>
                                            Upload Photos & Info
                                        </Button>
                                    )}
                                    
                                    {/* Tradie: Review info and quote or decline */}
                                    {isTradie && job.status === 'InfoProvided' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobToDecline(job); setShowDeclineModal(true); }}>
                                                Decline Job
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobForQuote(job); setShowQuoteModal(true); }}>
                                                Quote Price
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Client: Accept or decline quote */}
                                    {isClient && job.status === 'QuoteProvided' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleDeclineQuote(job.id)}>
                                                Decline Quote
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleAcceptQuote(job.id)}>
                                                Accept Quote
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Client: Select booking time */}
                                    {isClient && job.status === 'QuoteAccepted' && (
                                        <Button variant="primary" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => { setJobForBooking(job); setShowBookingModal(true); }}>
                                            Select Date & Time
                                        </Button>
                                    )}
                                    
                                    {/* Tradie: Confirm booking */}
                                    {isTradie && job.status === 'BookingRequested' && (
                                        <Button variant="success" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => handleConfirmBooking(job.id)}>
                                            Confirm Booking
                                        </Button>
                                    )}
                                    
                                    {/* Client: Make payment */}
                                    {isClient && job.status === 'BookingConfirmed' && (
                                        <Button variant="primary" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => { setJobForPayment(job); setShowPaymentModal(true); }}>
                                            Pay Now - £{job.quote?.total.toFixed(2)}
                                        </Button>
                                    )}
                                    
                                    {/* Show payment complete status */}
                                    {job.status === 'PaymentComplete' && (
                                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                                            <CheckCircle className="inline-block text-green-600 mb-1" size={16} />
                                            <p className="text-xs text-green-700 font-medium">Payment Complete - £{job.paymentAmount?.toFixed(2)}</p>
                                        </div>
                                    )}
                                    
                                    {/* Only client can mark Completed when InProgress */}
                                    {job.status === 'InProgress' && isClient && (
                                        <Button variant="success" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => handleStatusUpdate(job.id, 'Completed')}>
                                            Mark as Completed
                                        </Button>
                                    )}
                                    
                                    {/* Show review prompt when completed and awaiting review */}
                                    {needsReview && (
                                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                            <p className="text-sm font-bold text-orange-900 mb-2">How was your experience?</p>
                                            <Button variant="secondary" className="w-full py-2 text-xs"
                                                onClick={() => {
                                                    setJobToReview(job);
                                                    setShowReviewModal(true);
                                                }}>
                                                Leave a Review
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Show review submitted confirmation */}
                                    {job.status === 'Completed' && hasReviewed && (
                                        <div className="mt-3 p-3 bg-green-50 border-green-200 rounded-lg text-center">
                                            <CheckCircle className="inline-block text-green-600 mb-1" size={16} />
                                            <p className="text-xs text-green-700 font-medium">Review submitted</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Block Confirmation Modal */}
            {showBlockConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Block User?</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Block {userToBlock?.name}? They won't be able to contact you anymore.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowBlockConfirm(false); setUserToBlock(null); }}>
                                Cancel
                            </Button>
                            <Button variant="danger" className="flex-1" onClick={handleBlockFromJob}>
                                Block
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal - Cannot be dismissed, review is mandatory */}
            {showReviewModal && jobToReview && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in">
                        <div className="mb-4">
                            <h3 className="text-xl font-black text-slate-900">Leave a Review</h3>
                            <p className="text-xs text-slate-500 mt-1">Review required to complete this job</p>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-sm text-slate-600 mb-1">
                                How was your experience with <span className="font-bold">
                                    {jobToReview.tradieUid === user.uid ? jobToReview.clientName : jobToReview.tradieName}
                                </span>?
                            </p>
                            <p className="text-xs text-slate-500">{jobToReview.title}</p>
                        </div>

                        {/* Star Rating */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-700 mb-3">Rating</label>
                            <div className="flex gap-2 justify-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setReviewData({ ...reviewData, rating: star })}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={40}
                                            className={star <= reviewData.rating 
                                                ? 'fill-orange-500 text-orange-500' 
                                                : 'text-slate-300'
                                            }
                                        />
                                    </button>
                                ))}
                            </div>
                            <p className="text-center text-sm text-slate-600 mt-2 font-medium">
                                {reviewData.rating === 5 ? 'Excellent!' : 
                                 reviewData.rating === 4 ? 'Good' : 
                                 reviewData.rating === 3 ? 'Okay' : 
                                 reviewData.rating === 2 ? 'Poor' : 'Very Poor'}
                            </p>
                        </div>

                        {/* Comment */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Comment (Optional)
                            </label>
                            <textarea
                                value={reviewData.comment}
                                onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                                placeholder="Share details about your experience..."
                                rows={4}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm"
                                maxLength={500}
                            />
                            <p className="text-xs text-slate-400 mt-1 text-right">
                                {reviewData.comment.length}/500
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => {
                                setShowReviewModal(false);
                                setJobToReview(null);
                                setReviewData({ rating: 5, comment: '' });
                            }}>
                                Skip
                            </Button>
                            <Button variant="secondary" className="flex-1" onClick={handleSubmitReview}>
                                Submit Review
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Info Request Modal (Client uploads photos/info) */}
            {showInfoRequestModal && jobForInfoRequest && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-900">Upload Photos & Info</h3>
                            <button onClick={() => { setShowInfoRequestModal(false); setInfoPhotos([]); setInfoDescription(''); }}>
                                <X className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-4">Upload photos and additional details about the job.</p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Photos (up to 5)</label>
                            <input type="file" accept="image/*" multiple onChange={handleImageUpload} 
                                className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                            {infoPhotos.length > 0 && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {infoPhotos.map((photo, idx) => (
                                        <div key={idx} className="relative">
                                            <img src={photo} className="w-16 h-16 object-cover rounded border" />
                                            <button onClick={() => setInfoPhotos(infoPhotos.filter((_, i) => i !== idx))}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Additional Info</label>
                            <textarea value={infoDescription} onChange={(e) => setInfoDescription(e.target.value)}
                                placeholder="Describe the location, access, specific requirements..."
                                rows={4} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowInfoRequestModal(false); setInfoPhotos([]); setInfoDescription(''); }}>
                                Cancel
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={handleSubmitInfo} disabled={infoPhotos.length === 0}>
                                Commit
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Quote Modal (Tradie submits quote) */}
            {showQuoteModal && jobForQuote && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-900">Submit Quote</h3>
                            <button onClick={() => { setShowQuoteModal(false); setQuoteData({ hourlyRate: '', estimatedHours: '', notes: '' }); }}>
                                <X className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-4">Provide pricing for: <span className="font-bold">{jobForQuote.title}</span></p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Hourly Rate (£)</label>
                            <input type="number" value={quoteData.hourlyRate} onChange={(e) => setQuoteData({ ...quoteData, hourlyRate: e.target.value })}
                                placeholder="e.g. 50" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Estimated Hours</label>
                            <input type="number" value={quoteData.estimatedHours} onChange={(e) => setQuoteData({ ...quoteData, estimatedHours: e.target.value })}
                                placeholder="e.g. 4" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        {quoteData.hourlyRate && quoteData.estimatedHours && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm font-bold text-green-900">Total: £{(parseFloat(quoteData.hourlyRate) * parseFloat(quoteData.estimatedHours)).toFixed(2)}</p>
                            </div>
                        )}
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Notes (Optional)</label>
                            <textarea value={quoteData.notes} onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })}
                                placeholder="Include materials, special considerations..."
                                rows={3} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowQuoteModal(false); setQuoteData({ hourlyRate: '', estimatedHours: '', notes: '' }); }}>
                                Cancel
                            </Button>
                            <Button variant="success" className="flex-1" onClick={handleSubmitQuote} 
                                disabled={!quoteData.hourlyRate || !quoteData.estimatedHours}>
                                Submit Quote
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Decline Modal (Tradie provides reason) */}
            {showDeclineModal && jobToDecline && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-900">Decline Job</h3>
                            <button onClick={() => { setShowDeclineModal(false); setDeclineReason(''); }}>
                                <X className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-4">Please provide a reason for declining this job.</p>
                        
                        <div className="mb-4">
                            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
                                placeholder="e.g. Outside my service area, job too small, already booked..."
                                rows={4} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                                required />
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowDeclineModal(false); setDeclineReason(''); }}>
                                Cancel
                            </Button>
                            <Button variant="danger" className="flex-1" onClick={handleDeclineJob} disabled={!declineReason.trim()}>
                                Decline Job
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Booking Modal (Client selects date/time and provides service location) */}
            {showBookingModal && jobForBooking && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[75vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-900">Booking Details</h3>
                            <button onClick={() => { 
                                setShowBookingModal(false); 
                                setSelectedDate(null); 
                                setSelectedTimeSlot(''); 
                                setServiceAddress('');
                                setServicePhone('');
                                setServiceEmail('');
                            }}>
                                <X className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-4">Provide service location and select date & time.</p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Service Address <span className="text-red-500">*</span></label>
                            <textarea 
                                value={serviceAddress} 
                                onChange={(e) => setServiceAddress(e.target.value)}
                                placeholder="Enter the full address where work will be done"
                                rows={3}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number <span className="text-red-500">*</span></label>
                            <input 
                                type="tel" 
                                value={servicePhone} 
                                onChange={(e) => setServicePhone(e.target.value)}
                                placeholder="e.g., 07123 456789"
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Email (Optional)</label>
                            <input 
                                type="email" 
                                value={serviceEmail} 
                                onChange={(e) => setServiceEmail(e.target.value)}
                                placeholder={user?.email || "your@email.com"}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Date <span className="text-red-500">*</span></label>
                            <input type="date" value={selectedDate || ''} onChange={(e) => setSelectedDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Time Slot <span className="text-red-500">*</span></label>
                            <select value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                                <option value="">Select a time slot</option>
                                <option value="Morning (8AM-12PM)">Morning (8AM-12PM)</option>
                                <option value="Afternoon (12PM-8PM)">Afternoon (12PM-8PM)</option>
                                <option value="Evening (8PM-11PM)">Evening (8PM-11PM)</option>
                            </select>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { 
                                setShowBookingModal(false); 
                                setSelectedDate(null); 
                                setSelectedTimeSlot(''); 
                                setServiceAddress('');
                                setServicePhone('');
                                setServiceEmail('');
                            }}>
                                Cancel
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={handleSubmitBooking} 
                                disabled={!selectedDate || !selectedTimeSlot || !serviceAddress.trim() || !servicePhone.trim()}>
                                Request Booking
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Payment Modal (Client pays) */}
            {showPaymentModal && jobForPayment && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-900">Complete Payment</h3>
                            {!processingPayment && (
                                <button onClick={() => setShowPaymentModal(false)}>
                                    <X className="text-slate-400 hover:text-slate-600" />
                                </button>
                            )}
                        </div>
                        
                        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <p className="text-sm text-slate-600 mb-2">Job: <span className="font-bold">{jobForPayment.title}</span></p>
                            <p className="text-sm text-slate-600 mb-2">Tradie: <span className="font-bold">{jobForPayment.tradieName}</span></p>
                            <p className="text-2xl font-black text-slate-900 mt-4">£{jobForPayment.quote?.total.toFixed(2)}</p>
                            <p className="text-xs text-slate-500">£{jobForPayment.quote?.hourlyRate}/hr × {jobForPayment.quote?.estimatedHours}hrs</p>
                        </div>
                        
                        <p className="text-xs text-slate-500 mb-4 text-center">
                            💳 Payment will be processed via Stripe<br />
                            (Simulated for demo - no actual charge)
                        </p>
                        
                        <Button variant="success" className="w-full" onClick={handleProcessPayment} disabled={processingPayment}>
                            {processingPayment ? (
                                <><Clock className="animate-spin" size={16} /> Processing Payment...</>
                            ) : (
                                <>Pay £{jobForPayment.quote?.total.toFixed(2)}</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
            
            {/* Photo Gallery Modal */}
            {showPhotoGallery && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
                    <div className="relative w-full max-w-2xl">
                        <button onClick={() => setShowPhotoGallery(false)} 
                            className="absolute -top-10 right-0 text-white hover:text-gray-300">
                            <X size={32} />
                        </button>
                        <div className="bg-white rounded-2xl p-4">
                            <div className="grid grid-cols-2 gap-4">
                                {galleryPhotos.map((photo, idx) => (
                                    <img key={idx} src={photo} className="w-full h-auto rounded border" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// MessagesModal - Wrapper for ChatList and Winks with tabs
const MessagesModal = ({ user, onSelectProfile, onSelectChat, onClose }) => {
    const [activeTab, setActiveTab] = useState('messages');
    
    return (
        <div 
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-fade-in p-4"
            onClick={(e) => {
                // Close if clicking the backdrop
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white w-full max-w-sm h-[60vh] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col animate-scale-in">
                {/* Tab Headers */}
                <div className="flex border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <button 
                        onClick={() => setActiveTab('messages')}
                        className={`flex-1 py-4 px-6 font-bold text-sm transition-all duration-300 ${
                            activeTab === 'messages' 
                                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50 scale-105' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                        Messages
                    </button>
                    <button 
                        onClick={() => setActiveTab('winks')}
                        className={`flex-1 py-4 px-6 font-bold text-sm transition-all duration-300 ${
                            activeTab === 'winks' 
                                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50 scale-105' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                        Winks 😉
                    </button>
                </div>
                
                {/* Tab Content */}
                {activeTab === 'messages' ? (
                    <ChatList user={user} onSelectProfile={onSelectProfile} onSelectChat={onSelectChat} onClose={onClose} />
                ) : (
                    <WinksList user={user} onSelectProfile={onSelectProfile} onClose={onClose} />
                )}
            </div>
        </div>
    );
};

// WinksList - Shows winks received by user
const WinksList = ({ user, onSelectProfile, onClose }) => {
    const [winks, setWinks] = useState([]);
    const [senderProfiles, setSenderProfiles] = useState({});
    const [sendingWink, setSendingWink] = useState(null);

    useEffect(() => {
        if (!db || !user) return;
        
        // Listen to winks where user is the recipient
        const winksQuery = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'),
            where('type', '==', 'wink'),
            where('recipientId', '==', user.uid),
            orderBy('timestamp', 'desc')
        );
        
        const unsub = onSnapshot(winksQuery, (snap) => {
            const winksList = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setWinks(winksList);
            
            // Fetch sender profiles
            winksList.forEach(async (wink) => {
                if (wink.senderId && !senderProfiles[wink.senderId]) {
                    const profileDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', wink.senderId));
                    if (profileDoc.exists()) {
                        setSenderProfiles(prev => ({
                            ...prev, 
                            [wink.senderId]: {...profileDoc.data(), uid: wink.senderId}
                        }));
                    }
                }
            });
        });
        
        return () => unsub();
    }, [user]);
    
    const handleSendWinkBack = async (recipientId) => {
        if (!user || !recipientId || sendingWink === recipientId) return;
        
        setSendingWink(recipientId);
        try {
            const currentUserData = senderProfiles[recipientId] ? 
                (await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid))).data() : 
                {};
            
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                type: 'wink',
                userId: recipientId,
                senderId: user.uid,
                from: user.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                senderName: currentUserData?.name || currentUserData?.username || 'Someone',
                senderPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                recipientId: recipientId,
                message: `${currentUserData?.name || currentUserData?.username || 'Someone'} winked back at you! 😉`,
                createdAt: serverTimestamp(),
                timestamp: serverTimestamp(),
                read: false
            });
            
            showToast(`Wink sent back! 😉`);
        } catch (error) {
            console.error('Error sending wink:', error);
            showToast('Failed to send wink');
        } finally {
            setSendingWink(null);
        }
    };
    
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };
    
    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
            <div className="p-6 border-b border-slate-200 bg-white flex items-center gap-4">
                <button 
                    onClick={onClose} 
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    title="Close"
                >
                    <X size={24} className="text-slate-600" />
                </button>
                <div className="flex-1">
                    <h2 className="font-bold text-2xl text-slate-900">Winks 😉</h2>
                    <p className="text-sm text-slate-500 mt-1">{winks.length} wink{winks.length !== 1 ? 's' : ''} received</p>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
                {winks.length === 0 ? (
                    <div className="text-center text-slate-400 mt-20 px-6">
                        <div className="text-7xl mb-4">😉</div>
                        <h3 className="font-bold text-lg text-slate-700 mb-2">No winks yet</h3>
                        <p className="text-sm text-slate-500">When someone winks at you, they'll appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {winks.map(wink => {
                            const sender = senderProfiles[wink.senderId] || {};
                            
                            return (
                                <div 
                                    key={wink.id} 
                                    className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                                >
                                    {/* Profile Picture - Click to open profile */}
                                    <div 
                                        className="relative flex-shrink-0 cursor-pointer"
                                        onClick={() => {
                                            if (sender.uid) {
                                                onSelectProfile(sender, 0);
                                            }
                                        }}
                                    >
                                        {sender.primaryPhoto || sender.photo ? (
                                            <img 
                                                src={sender.primaryPhoto || sender.photo} 
                                                alt={sender.name || 'User'} 
                                                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md hover:border-orange-500 transition-all"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border-2 border-white shadow-md hover:border-orange-500 transition-all">
                                                <User size={28} className="text-white"/>
                                            </div>
                                        )}
                                        {/* Wink emoji badge */}
                                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                            <span className="text-sm">😉</span>
                                        </div>
                                    </div>
                                    
                                    {/* Wink Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-bold truncate text-slate-900">
                                                {sender.name || sender.username || 'User'}
                                            </h4>
                                            <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                                {formatTime(wink.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 truncate">
                                            Sent you a wink 😉
                                        </p>
                                    </div>
                                    
                                    {/* Wink Back Button */}
                                    <button
                                        onClick={() => handleSendWinkBack(wink.senderId)}
                                        disabled={sendingWink === wink.senderId}
                                        className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-all ${
                                            sendingWink === wink.senderId
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg'
                                        }`}
                                    >
                                        {sendingWink === wink.senderId ? '...' : '😉 Wink Back'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatList = ({ user, onSelectProfile, onSelectChat, onClose }) => {
  const [conversations, setConversations] = useState([]);
  const [partnerProfiles, setPartnerProfiles] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
      if (!db) return;
      // Listen to conversations
      const unsub = onSnapshot(collection(db, 'artifacts', getAppId(), 'public', 'data', 'conversations'), (snap) => {
          const myConvos = snap.docs
              .map(d => ({id: d.id, ...d.data()}))
              .filter(c => c.participants && c.participants.includes(user.uid))
              .sort((a, b) => {
                  const timeA = a.lastMessageAt?.toMillis?.() || 0;
                  const timeB = b.lastMessageAt?.toMillis?.() || 0;
                  return timeB - timeA; // Most recent first
              });
          setConversations(myConvos);

          // Fetch partner profiles
          myConvos.forEach(async (conv) => {
              const partnerId = conv.participants.find(p => p !== user.uid);
              if (partnerId && !partnerProfiles[partnerId]) {
                  const profileDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', partnerId));
                  if (profileDoc.exists()) {
                      setPartnerProfiles(prev => ({...prev, [partnerId]: {...profileDoc.data(), uid: partnerId}}));
                  }
              }
          });
      });

      // Listen to unread messages
      const unreadQuery = query(
          collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
          where('recipientId', '==', user.uid),
          where('read', '==', false)
      );
      const unsubUnread = onSnapshot(unreadQuery, (snap) => {
          const counts = {};
          snap.docs.forEach(doc => {
              const msg = doc.data();
              const conversationId = msg.conversationId;
              counts[conversationId] = (counts[conversationId] || 0) + 1;
          });
          setUnreadCounts(counts);
      });

      return () => {
          unsub();
          unsubUnread();
      };
  }, [user]);

  const formatTime = (timestamp) => {
      if (!timestamp) return '';
      const date = timestamp.toDate();
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
        <div className="p-6 border-b border-slate-200 bg-white flex items-center gap-4">
            <button 
                onClick={onClose} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                title="Close"
            >
                <X size={24} className="text-slate-600" />
            </button>
            <div className="flex-1">
                <h2 className="font-bold text-2xl text-slate-900">Messages</h2>
                <p className="text-sm text-slate-500 mt-1">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto">
             {conversations.length === 0 ? (
                 <div className="text-center text-slate-400 mt-20 px-6">
                     <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                         <MessageCircle size={40} className="text-slate-300" />
                     </div>
                     <h3 className="font-bold text-lg text-slate-700 mb-2">No messages yet</h3>
                     <p className="text-sm text-slate-500">Start a conversation from someone's profile in the Social tab</p>
                 </div>
             ) : (
                 <div className="divide-y divide-slate-100">
                     {conversations.map(conv => {
                         const partnerId = conv.participants.find(p => p !== user.uid);
                         const partner = partnerProfiles[partnerId] || {};
                         const unreadCount = unreadCounts[conv.id] || 0;
                         const hasUnread = unreadCount > 0;

                         return (
                             <div 
                                 key={conv.id} 
                                 className={`p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors ${hasUnread ? 'bg-orange-50/50' : ''}`}
                             >
                                 {/* Profile Picture - Click to open profile */}
                                 <div 
                                     className="relative flex-shrink-0 cursor-pointer"
                                     onClick={(e) => {
                                         e.stopPropagation();
                                         if (partner.uid) {
                                             onSelectProfile(partner, unreadCount);
                                         }
                                     }}
                                 >
                                     {partner.primaryPhoto || partner.photo ? (
                                         <img 
                                             src={partner.primaryPhoto || partner.photo} 
                                             alt={partner.name || 'User'} 
                                             className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md hover:border-orange-500 transition-all"
                                         />
                                     ) : (
                                         <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border-2 border-white shadow-md hover:border-orange-500 transition-all">
                                             <User size={28} className="text-white"/>
                                         </div>
                                     )}
                                     {hasUnread && (
                                         <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                             {unreadCount > 9 ? '9+' : unreadCount}
                                         </div>
                                     )}
                                 </div>
                                 {/* Message Preview - Click to open chat directly */}
                                 <div 
                                     className="flex-1 min-w-0 cursor-pointer"
                                     onClick={() => onSelectChat(partner)}
                                 >
                                     <div className="flex items-center justify-between mb-1">
                                         <h4 className={`font-bold truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                                             {partner.name || partner.username || 'User'}
                                         </h4>
                                         <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                             {formatTime(conv.lastMessageAt)}
                                         </span>
                                     </div>
                                     <p className={`text-sm truncate ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                                         {conv.lastMessage || 'Say hi! 👋'}
                                     </p>
                                 </div>
                             </div>
                         )
                     })}
                 </div>
             )}
        </div>
    </div>
  );
};

const ChatRoom = ({ user, partner, onBack }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const conversationId = [user.uid, partner.uid].sort().join('_'); 
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!db) return;
        
        // Listen to messages in this conversation
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
            where('conversationId', '==', conversationId),
            orderBy('createdAt', 'asc')
        );
        
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({id: d.id, ...d.data()})));
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            
            // Mark messages as read
            snap.docs.forEach(async (docSnap) => {
                const msg = docSnap.data();
                if (msg.recipientId === user.uid && !msg.read) {
                    await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'messages', docSnap.id), {
                        read: true,
                        readAt: serverTimestamp()
                    });
                }
            });
        });
        
        return () => unsub();
    }, [user, partner, conversationId]);

    const sendMessage = async () => {
        if(!inputText.trim()) return;
        
        // Check email verification - reload user first to get latest status
        if (user) {
            try {
                await user.reload();
                const updatedUser = auth.currentUser;
                
                if (updatedUser && !updatedUser.emailVerified) {
                    alert('Please verify your email before sending messages. Check your inbox for the verification link.');
                    return;
                }
            } catch (err) {
                console.error('Error checking verification:', err);
                // If reload fails, fall back to cached status
                if (!user.emailVerified) {
                    alert('Please verify your email before sending messages. Check your inbox for the verification link.');
                    return;
                }
            }
        }

        try {
            const text = inputText.trim();
            setInputText('');

            // Get current user data for notification
            const currentUserDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid));
            const currentUserData = currentUserDoc.data();

            // Create/update conversation
            const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
            await setDoc(conversationRef, {
                participants: [user.uid, partner.uid],
                lastMessage: text,
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Send message
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
                conversationId,
                senderId: user.uid,
                recipientId: partner.uid,
                text,
                createdAt: serverTimestamp(),
                read: false
            });

            // Send notification
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                userId: partner.uid,
                type: 'message',
                from: user.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                message: text,
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleBlockUser = async () => {
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'), {
                blockedBy: user.uid,
                blockedUser: partner.uid,
                blockedUserName: partner.name || partner.username,
                blockedAt: serverTimestamp(),
                source: 'chat'
            });
            setShowBlockConfirm(false);
            onBack();
        } catch (error) {
            console.error("Error blocking user:", error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white z-[70] absolute inset-0">
            {/* Enhanced Header */}
            <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-white shadow-sm">
                <button 
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    title="Go back"
                >
                    <X size={24} className="text-slate-600" />
                </button>
                <div className="flex-shrink-0">
                    {partner.photo ? (
                        <img 
                            src={partner.photo} 
                            alt={partner.name || partner.username} 
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
                        />
                    ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border-2 border-white shadow-md">
                            <User size={20} className="text-white"/>
                        </div>
                    )}
                </div>
                <span className="font-bold text-lg text-slate-900 flex-1 truncate">{partner.name || partner.username || 'User'}</span>
                <button
                    onClick={() => setShowBlockConfirm(true)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Block user"
                >
                    <Ban size={20} />
                </button>
            </div>

            {/* Enhanced Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-2 items-end ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                        {m.senderId !== user.uid && (
                            <div className="flex-shrink-0">
                                {partner.photo ? (
                                    <img 
                                        src={partner.photo} 
                                        alt={partner.name || partner.username} 
                                        className="w-8 h-8 rounded-full object-cover border border-white shadow-sm"
                                    />
                                ) : (
                                    <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400 rounded-full border border-white shadow-sm">
                                        <User size={14} className="text-white"/>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${
                            m.senderId === user.uid 
                                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-sm' 
                                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                        }`}>
                            <p className="text-sm leading-relaxed">{m.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>

            {/* Enhanced Input Area */}
            <div className="p-4 border-t border-slate-200 bg-white flex gap-3 shadow-lg">
                <input 
                    className="flex-1 p-3 bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-sm placeholder-slate-400 transition-all" 
                    placeholder="Type a message..." 
                    value={inputText} 
                    onChange={e => setInputText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && sendMessage()} 
                />
                <button 
                    onClick={sendMessage} 
                    disabled={!inputText.trim()}
                    className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-full hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={18} />
                </button>
            </div>

            {/* Block Confirmation Modal */}
            {showBlockConfirm && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Block User?</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            You won't be able to message each other or see each other's profiles.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="danger" className="flex-1" onClick={handleBlockUser}>
                                Block
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// UPDATED: UserProfile now accepts onEnableLocation to fix the button in view
const UserProfile = ({ user, profile, onLogout, showToast, onEnableLocation, onNavigate, profilePictureRequests = [] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [isVerifying, setIsVerifying] = useState(false); // Modal state for verification
    const [verificationDocs, setVerificationDocs] = useState({ front: null, back: null }); // Store verification docs
    const [isResendingVerification, setIsResendingVerification] = useState(false);
    const [verificationFeedback, setVerificationFeedback] = useState('');
    const photoInputRef = useRef(null);
    const verifyFrontRef = useRef(null);
    const verifyBackRef = useRef(null);

    useEffect(() => { if(profile) setEditData(profile); }, [profile]);

    const handleSave = async () => {
        await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), editData);
        setIsEditing(false);
        showToast("Profile Updated!", "success");
    };

    const handleVerificationCoverAction = async () => {
        if (!user || user.emailVerified || isResendingVerification) return;

        setIsResendingVerification(true);
        try {
            await user.reload();
            const updatedUser = auth.currentUser;

            if (updatedUser?.emailVerified) {
                showToast?.('Email verified successfully!', 'success');
                setVerificationFeedback('Email verified — thanks for confirming.');
                return;
            }

            await sendEmailVerification(updatedUser || user);
            setVerificationFeedback('Verification email resent. Check your inbox.');
            showToast?.('Verification email sent! Check your inbox.', 'success');
        } catch (err) {
            console.error('Error with verification:', err);
            setVerificationFeedback('Unable to resend right now. Please try again or contact support.');
            if (err.code === 'auth/too-many-requests') {
                showToast?.('Too many requests. Please wait a few minutes.', 'error');
            } else {
                showToast?.('Failed to send email. Try again later.', 'error');
            }
        } finally {
            setIsResendingVerification(false);
        }
    };

    // UPDATED: Logic to handle Verification Request with Firebase Storage upload
    const handleVerifySubmit = async () => {
        if (!verificationDocs.front || !verificationDocs.back) {
            showToast("Please upload both front and back of ID", "error");
            return;
        }
        
        if (!storage) {
            showToast("Storage not initialized", "error");
            return;
        }
        
        try {
            showToast("Uploading documents securely...", "info");
            
            // Convert base64 to blob for upload
            const frontBlob = await fetch(verificationDocs.front).then(r => r.blob());
            const backBlob = await fetch(verificationDocs.back).then(r => r.blob());
            
            // Create unique file names with timestamp
            const timestamp = Date.now();
            const frontFileName = `verifications/${user.uid}/cscs_front_${timestamp}.jpg`;
            const backFileName = `verifications/${user.uid}/cscs_back_${timestamp}.jpg`;
            
            // Upload to Firebase Storage
            const frontRef = storageRef(storage, frontFileName);
            const backRef = storageRef(storage, backFileName);
            
            await uploadBytes(frontRef, frontBlob);
            await uploadBytes(backRef, backBlob);
            
            // Get download URLs
            const frontUrl = await getDownloadURL(frontRef);
            const backUrl = await getDownloadURL(backRef);
            
            // Create verification request in Firestore
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests'), {
                tradieUid: user.uid,
                tradieName: profile.name || profile.username,
                trade: profile.trade || 'Not specified',
                cardImageUrl: frontUrl, // Primary image for preview
                cardImageBackUrl: backUrl,
                status: 'pending',
                createdAt: serverTimestamp(),
                notes: `Trade: ${profile.trade || 'Not specified'}`
            });
            
            // Update profile to indicate verification is pending
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                verificationStatus: 'pending',
                verificationRequestedAt: serverTimestamp()
            });
            
            setIsVerifying(false);
            setVerificationDocs({ front: null, back: null });
            showToast("Verification request submitted!", "success");
        } catch (error) {
            console.error("Error submitting verification:", error);
            showToast("Failed to submit verification request", "error");
        }
    };

    const handleVerificationUpload = (e, side) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check file size (max 5MB)
        if (file.size > MAX_VERIFICATION_FILE_SIZE) {
            showToast("File too large. Max 5MB.", "error");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            setVerificationDocs(prev => ({...prev, [side]: event.target.result}));
            showToast(`${side === 'front' ? 'Front' : 'Back'} uploaded`, "success");
        };
        reader.readAsDataURL(file);
    };

    const handleImageUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Show loading state
        showToast("Compressing and uploading image...", "info");
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let imageData = event.target.result;
                
                // Compress to 30KB target size for better quality
                imageData = await compressImage(imageData, 30 * 1024); // 30KB
                
                // Update local state first
                setEditData(prev => ({...prev, [field]: imageData}));
                
                // Save to Firebase
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                    [field]: imageData
                });
                
                // If uploading primary photo, create verification request
                if (field === 'primaryPhoto') {
                    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests'), {
                        userId: user.uid,
                        username: profile.username || profile.name || 'Unknown',
                        name: profile.name || profile.username || 'Unknown',
                        photoData: imageData,
                        status: 'pending',
                        createdAt: new Date(),
                        uploadedAt: new Date()
                    });
                    showToast("Profile picture uploaded! Pending admin review.", "info");
                } else {
                    showToast("Image uploaded successfully!", "success");
                }
            } catch (error) {
                console.error("Error uploading image:", error);
                showToast("Failed to upload image", "error");
            }
        };
        reader.readAsDataURL(file);
    };
    
    // Helper function to compress images to target size
    const compressImage = (base64Image, targetSizeBytes) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Estimate current size and calculate aggressive scaling if needed
                const currentSize = base64Image.length * BASE64_SIZE_RATIO;
                
                // Start with aggressive downscaling for small targets
                if (currentSize > targetSizeBytes) {
                    // Adjusted scaling for 30KB target - allows better quality
                    const scaleFactor = Math.sqrt(targetSizeBytes / currentSize) * 0.85;
                    width = Math.max(100, Math.floor(width * scaleFactor)); // Minimum 100px for profile pics
                    height = Math.max(100, Math.floor(height * scaleFactor));
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress with quality adjustment to hit target size
                let quality = 0.8; // Start with higher quality for 30KB target
                let compressedData = canvas.toDataURL('image/jpeg', quality);
                
                // Reduce quality until we're under target size
                while (compressedData.length * BASE64_SIZE_RATIO > targetSizeBytes && quality > 0.05) {
                    quality -= 0.05;
                    compressedData = canvas.toDataURL('image/jpeg', quality);
                }
                
                resolve(compressedData);
            };
            img.src = base64Image;
        });
    };

    if (!profile) return null;

    return (
        <div className="p-4 pb-20 relative">
            {/* UPDATED: Verification Modal */}
            {isVerifying && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-xl font-black text-slate-900">Verify Trade ID</h3>
                             <button onClick={() => { setIsVerifying(false); setVerificationDocs({ front: null, back: null }); }}>
                                <X className="text-slate-400 hover:text-slate-600" />
                             </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-6">Upload a photo of your Trade ID card (CSCS, Gas Safe, etc) to get the Verified Badge.</p>
                        
                        <button 
                            onClick={() => verifyFrontRef.current?.click()}
                            className="w-full border-2 border-dashed border-slate-200 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400 mb-4 bg-slate-50 hover:border-orange-500 hover:bg-orange-50 transition-all"
                        >
                             {verificationDocs.front ? (
                                <div className="text-center">
                                    <CheckCircle className="mx-auto mb-2 text-green-600" size={32} />
                                    <span className="text-xs font-bold text-green-700">Front Uploaded ✓</span>
                                </div>
                             ) : (
                                <>
                                    <UploadCloud size={32} className="mb-2" />
                                    <span className="text-xs font-bold">Tap to Upload Front</span>
                                </>
                             )}
                        </button>
                        
                        <button 
                            onClick={() => verifyBackRef.current?.click()}
                            className="w-full border-2 border-dashed border-slate-200 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400 mb-6 bg-slate-50 hover:border-orange-500 hover:bg-orange-50 transition-all"
                        >
                             {verificationDocs.back ? (
                                <div className="text-center">
                                    <CheckCircle className="mx-auto mb-2 text-green-600" size={32} />
                                    <span className="text-xs font-bold text-green-700">Back Uploaded ✓</span>
                                </div>
                             ) : (
                                <>
                                    <UploadCloud size={32} className="mb-2" />
                                    <span className="text-xs font-bold">Tap to Upload Back</span>
                                </>
                             )}
                        </button>

                        <input type="file" ref={verifyFrontRef} onChange={(e) => handleVerificationUpload(e, 'front')} accept="image/*" className="hidden" />
                        <input type="file" ref={verifyBackRef} onChange={(e) => handleVerificationUpload(e, 'back')} accept="image/*" className="hidden" />

                        <Button 
                            onClick={handleVerifySubmit} 
                            className="w-full"
                            variant={verificationDocs.front && verificationDocs.back ? "secondary" : "primary"}
                            disabled={!verificationDocs.front || !verificationDocs.back}
                        >
                            Submit for Review
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center mb-6 relative">
                <button onClick={() => setIsEditing(!isEditing)} className="absolute right-0 top-0 p-2 text-slate-400 hover:text-orange-500 z-10"><Edit2 size={20} /></button>
                
                {/* Cover Photo Area (Preview) - Now uses default cover photo */}
                <div
                    className={`w-full h-36 bg-slate-200 mb-8 rounded-2xl relative overflow-hidden group border border-slate-300 shadow-xl ${user && !user.emailVerified ? 'cursor-pointer' : ''}`}
                    onClick={user && !user.emailVerified ? handleVerificationCoverAction : undefined}
                    role={user && !user.emailVerified ? 'button' : undefined}
                    tabIndex={user && !user.emailVerified ? 0 : -1}
                    aria-label={user && !user.emailVerified ? 'Resend verification email' : undefined}
                >
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-orange-500/40 via-pink-500/30 to-purple-500/30 blur-sm opacity-80 animate-pulse-slow" aria-hidden />
                    <div
                        className="absolute inset-0 opacity-70 mix-blend-screen pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,166,43,0.18), transparent 32%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12), transparent 28%), radial-gradient(circle at 60% 70%, rgba(59,130,246,0.16), transparent 30%)'
                        }}
                    />
                    <img src={getDefaultCoverPhoto(user?.email, profile.role)} className="w-full h-full object-cover scale-[1.02]" alt="Cover"/>

                    {profile?.adminCoverMessage?.text && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white rounded-xl px-3 py-2 text-xs shadow-lg backdrop-blur-sm max-w-[70%] border border-white/10">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={14} className="text-orange-200 mt-0.5" />
                                <div className="space-y-1 w-full">
                                    <p className="font-semibold leading-tight">{profile.adminCoverMessage.text}</p>
                                    <div className="flex items-center justify-between gap-2 text-[10px] text-white/80">
                                        <span>Admin message</span>
                                        <button
                                            className="underline font-semibold hover:text-white"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                                        adminCoverMessage: deleteField()
                                                    });
                                                    showToast('Message dismissed', 'success');
                                                } catch (err) {
                                                    console.error('Error dismissing message:', err);
                                                    showToast('Could not dismiss message', 'error');
                                                }
                                            }}
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {user && !user.emailVerified && (
                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-black/70 text-white p-3 flex flex-col justify-start gap-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-orange-100">
                                <AlertCircle size={14} className="text-orange-200" />
                                Email verification needed
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black leading-tight">Access stays limited until verified.</p>
                                <div className="flex items-center gap-2 text-[11px] text-white/85">
                                    <Mail size={12} className="animate-pulse" />
                                    <span>Tap the cover to resend your link.</span>
                                </div>
                                {verificationFeedback && (
                                    <p className="text-[10px] text-orange-100/90 bg-white/5 border border-white/10 rounded-md px-2 py-1">
                                        {verificationFeedback}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className={`relative mb-3 group -mt-16 ${!isEditing ? 'cursor-pointer' : ''}`} onClick={() => !isEditing && setIsEditing(true)}>
                    <Avatar profile={isEditing ? editData : profile} size="xl" className="shadow-lg border-4 border-white w-24 h-24" showEditIcon={!isEditing} profilePictureRequests={profilePictureRequests} />
                    
                    {/* Busy/DND Badge */}
                    {profile.role === 'tradie' && !isEditing && (() => {
                        const currentlyUnavailable = isCurrentlyUnavailable(profile.workCalendar);
                        if (currentlyUnavailable) {
                            return (
                                <div className="absolute -bottom-1 -right-1 bg-red-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white" title="Currently Unavailable">
                                    <Ban size={14} />
                                </div>
                            );
                        }
                        return null;
                    })()}
                    
                    {isEditing && (
                        <button onClick={() => photoInputRef.current?.click()} className="absolute bottom-0 right-0 bg-orange-500 text-white p-2 rounded-full shadow-md hover:bg-orange-600 transition-colors border-2 border-white"><Camera size={16} /></button>
                    )}
                    <input type="file" ref={photoInputRef} onChange={(e) => handleImageUpload(e, 'primaryPhoto')} accept="image/*" className="hidden" />
                </div>
                
                {isEditing ? (
                    <div className="w-full space-y-3 animate-in fade-in duration-300">
                        <Input label="Name" value={editData.name || editData.username} onChange={e => setEditData({...editData, name: e.target.value})} />
                        <Input label="Bio" textarea value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} />
                        {profile.role === 'tradie' && <Input label="Hourly Rate" type="number" value={editData.rate} onChange={e => setEditData({...editData, rate: e.target.value})} />}
                        
                        <div className="bg-slate-100 p-3 rounded-lg flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-700">GPS Location</span>
                            <button onClick={onEnableLocation} className="text-xs bg-slate-900 text-white px-3 py-2 rounded flex items-center gap-1"><Navigation size={12}/> Update</button>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="ghost" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button variant="secondary" className="flex-1" onClick={handleSave}>Save Changes</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900">{profile.name || profile.username}{profile.hideAge ? '' : `, ${profile.age}`} {profile.verified && <ShieldCheck size={20} className="text-blue-500 fill-blue-100" />}</h2>
                        <p className="text-slate-500 text-sm capitalize font-medium">{profile.role} • {profile.location}</p>
                        {profile.role === 'tradie' && <p className="font-mono text-slate-800 font-bold mt-1">£{profile.rate}/hr</p>}
                        <p className="text-center text-slate-600 mt-3 text-sm max-w-xs leading-relaxed">{profile.bio}</p>
                        
                        {/* Not Available Banner for Tradies */}
                        {profile.role === 'tradie' && (() => {
                            const currentlyUnavailable = isCurrentlyUnavailable(profile.workCalendar);
                            if (currentlyUnavailable) {
                                const unavailabilityInfo = getCurrentUnavailabilityInfo(profile.workCalendar);
                                const nextAvailable = getNextAvailableDateTime(profile.workCalendar);
                                const isOnJob = unavailabilityInfo?.reason === 'job';
                                
                                if (nextAvailable) {
                                    return (
                                        <div className={`mt-4 w-full border-2 rounded-xl p-3 ${isOnJob ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                            <div className="flex items-center gap-2 justify-center">
                                                <Ban size={16} className={isOnJob ? 'text-blue-600' : 'text-red-600'} />
                                                <div className="text-center">
                                                    <p className={`text-xs font-bold ${isOnJob ? 'text-blue-900' : 'text-red-900'}`}>
                                                        {isOnJob ? "On a job! I'll be available for Hire from:" : "Not Available for Hire until:"}
                                                    </p>
                                                    <p className={`text-sm font-black ${isOnJob ? 'text-blue-700' : 'text-red-700'}`}>
                                                        {nextAvailable.date.toLocaleDateString('en-GB', { 
                                                            weekday: 'short',
                                                            month: 'short', 
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })} at {formatTimeSlot(nextAvailable.timeSlot)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            }
                            return null;
                        })()}
                    </>
                )}
                
                {/* UPDATED: Verify Button Logic */}
                {profile.role === 'tradie' && !profile.verified && (
                    <div className="mt-4 w-full bg-slate-100 p-4 rounded-xl border border-slate-200 text-center">
                        {profile.verificationStatus === 'pending_review' ? (
                            <>
                                <div className="mx-auto bg-yellow-100 w-10 h-10 rounded-full flex items-center justify-center mb-2"><CheckCircle className="text-yellow-600" size={20} /></div>
                                <p className="text-sm font-bold text-slate-700">Verification Pending</p>
                                <p className="text-xs text-slate-500">We are reviewing your ID documents.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-slate-700 mb-2">Get Verified & Boost Bookings</p>
                                <Button onClick={() => setIsVerifying(true)} variant="primary" className="w-full text-sm py-2">Verify Trade ID</Button>
                            </>
                        )}
                    </div>
                )}
                
                {/* Verification Approval Notification */}
                {profile.notifications && profile.notifications.some(n => n.type === 'verification_approved' && !n.read) && (
                    <div className="mt-4 w-full bg-green-50 border-2 border-green-500 p-4 rounded-xl animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <div className="bg-green-500 text-white p-2 rounded-full flex-shrink-0">
                                <CheckCircle size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-green-900 text-sm">Verification Approved!</h4>
                                <p className="text-xs text-green-800 mt-1">
                                    Your tradie verification has been approved. You now have a verified badge on your profile.
                                </p>
                                <button
                                    onClick={async () => {
                                        // Mark notification as read
                                        const updatedNotifications = profile.notifications.map(n =>
                                            n.type === 'verification_approved' ? { ...n, read: true } : n
                                        );
                                        await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                            notifications: updatedNotifications
                                        });
                                    }}
                                    className="mt-2 text-xs font-bold text-green-700 hover:text-green-900 underline"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Verification Rejection Notification */}
                {profile.notifications && profile.notifications.some(n => n.type === 'verification_rejected' && !n.read) && (() => {
                    const rejectionNotif = profile.notifications.find(n => n.type === 'verification_rejected' && !n.read);
                    return (
                        <div className="mt-4 w-full bg-red-50 border-2 border-red-500 p-4 rounded-xl animate-in fade-in">
                            <div className="flex items-start gap-3">
                                <div className="bg-red-500 text-white p-2 rounded-full flex-shrink-0">
                                    <X size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-red-900 text-sm">Verification Rejected</h4>
                                    <p className="text-xs text-red-800 mt-1 font-medium">
                                        Reason: {rejectionNotif.message}
                                    </p>
                                    <p className="text-xs text-red-700 mt-2">
                                        Please review the feedback and submit again with corrected documents.
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => setIsVerifying(true)}
                                            className="text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                            Resubmit Documents
                                        </button>
                                        <button
                                            onClick={async () => {
                                                // Mark notification as read
                                                const updatedNotifications = profile.notifications.map(n =>
                                                    n.type === 'verification_rejected' ? { ...n, read: true } : n
                                                );
                                                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                                    notifications: updatedNotifications
                                                });
                                            }}
                                            className="text-xs font-bold text-red-700 hover:text-red-900 underline"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Profile Picture Rejection Notification */}
                {profile.notifications && profile.notifications.some(n => n.type === 'profile_picture_rejected' && !n.read) && (() => {
                    const rejectionNotif = profile.notifications.find(n => n.type === 'profile_picture_rejected' && !n.read);
                    return (
                        <div className="mt-4 w-full bg-amber-50 border-2 border-amber-500 p-4 rounded-xl animate-in fade-in">
                            <div className="flex items-start gap-3">
                                <div className="bg-amber-500 text-white p-2 rounded-full flex-shrink-0">
                                    <ImageIcon size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-amber-900 text-sm">Profile Picture Rejected</h4>
                                    <p className="text-xs text-amber-800 mt-1 font-medium">
                                        Reason: {rejectionNotif.message}
                                    </p>
                                    <p className="text-xs text-amber-700 mt-2">
                                        Please upload a different profile picture that meets our guidelines.
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => {
                                                setIsEditing(true);
                                                // Auto-scroll or focus on photo upload
                                            }}
                                            className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
                                        >
                                            Upload New Photo
                                        </button>
                                        <button
                                            onClick={async () => {
                                                // Mark notification as read
                                                const updatedNotifications = profile.notifications.map(n =>
                                                    n.type === 'profile_picture_rejected' ? { ...n, read: true } : n
                                                );
                                                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                                    notifications: updatedNotifications
                                                });
                                            }}
                                            className="text-xs font-bold text-amber-700 hover:text-amber-900 underline"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
            <div className="space-y-2 mb-8">
                <ProfileLink icon={Settings} label="Settings" onClick={() => onNavigate('settings')} />
                {profile.role === 'tradie' && (
                    <ProfileLink icon={Calendar} label="Work Calendar" onClick={() => onNavigate('workCalendar')} />
                )}
                {profile.role === 'tradie' && (
                    <ProfileLink icon={DollarSign} label="Payments & Credits" onClick={() => onNavigate('paymentsCredits')} />
                )}
                <ProfileLink icon={ShieldCheck} label="Safety Centre" onClick={() => onNavigate('safety')} />
                <button onClick={onLogout} className="w-full p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-bold"><LogOut size={20} /> <span className="font-medium">Sign Out</span></button>
            </div>
        </div>
    );
};

const ProfileLink = ({ icon: Icon, label, onClick }) => (
    <button onClick={onClick} className="w-full p-4 flex items-center justify-between bg-white border border-slate-100 rounded-xl shadow-sm hover:border-slate-300 transition-all group">
        <div className="flex items-center gap-3 text-slate-700 font-medium group-hover:text-slate-900"><Icon size={20} /> <span>{label}</span></div><ArrowRight size={16} className="text-slate-400 group-hover:text-slate-600" />
    </button>
);

const ServiceFinder = ({ onPostJob, onSelectService }) => (
  <div className="p-4">
    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Search className="text-orange-500" /> Find a Service</h2>
    <div className="grid grid-cols-2 gap-3 mb-6">
        {TRADES.slice(0, 6).map(t => (
            <button key={t} onClick={() => onSelectService(t)} className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-orange-500 hover:shadow-md transition-all group">
                <span className="font-bold text-slate-700 block group-hover:text-orange-600 transition-colors">{t}</span>
                <span className="text-xs text-slate-400">View pros</span>
            </button>
        ))}
    </div>
    <div className="bg-slate-900 text-white p-6 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Need something custom?</h3>
            <p className="text-slate-400 text-sm mb-4">Post a job advert to the board.</p>
            <Button onClick={onPostJob} variant="secondary" className="w-full text-sm">Post a Job</Button>
        </div>
        <Wrench className="absolute -bottom-4 -right-4 text-slate-800 opacity-50" size={120} />
    </div>
  </div>
);

// --- SETTINGS SCREEN ---
const SettingsScreen = ({ user, profile, onBack, showToast }) => {
    // Detect if running on mobile app or web
    const isMobileApp = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && 
                        (window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true);
    
    // Check if user is admin (admin can use premium features)
    const isAdmin = user?.email === ADMIN_EMAIL;
    const canUsePremium = isAdmin; // In future, also check for premium subscription
    
    const [settings, setSettings] = useState({
        // Location
        manualLocation: profile?.manualLocation || '',
        useManualLocation: profile?.useManualLocation || false,
        
        // Notifications
        notifyMessages: profile?.notifyMessages ?? true,
        notifyJobOffers: profile?.notifyJobOffers ?? true,
        notifyWinks: profile?.notifyWinks ?? true,
        
        // Privacy - Free
        hideDistance: profile?.hideDistance || false,
        hideAge: profile?.hideAge || false,
        jobOnlyVisibility: profile?.jobOnlyVisibility || false,
        
        // Privacy - Premium (GayTradies Elite)
        incognitoMode: profile?.incognitoMode || false,
        verifiedOnly: profile?.verifiedOnly || false,
        blurPhotos: profile?.blurPhotos || false,
        hideOnlineStatus: profile?.hideOnlineStatus || false,
        autoDeleteChats: profile?.autoDeleteChats || 'never',
        screenshotDetection: profile?.screenshotDetection || false,
        verifiedOnlyChats: profile?.verifiedOnlyChats || false,
    });

    const [blockedUsers, setBlockedUsers] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [showBlockedUsers, setShowBlockedUsers] = useState(false);
    const [showLoginHistory, setShowLoginHistory] = useState(false);

    // Load blocked users
    useEffect(() => {
        if (!user || !db) return;
        const unsub = onSnapshot(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
            (snapshot) => {
                const blocked = snapshot.docs
                    .filter(doc => doc.data().blockedBy === user.uid)
                    .map(doc => ({ id: doc.id, ...doc.data() }));
                setBlockedUsers(blocked);
            }
        );
        return () => unsub();
    }, [user]);

    // Load active sessions (mock data for now)
    useEffect(() => {
        // NOTE: This is placeholder/demo data. In production, implement proper session tracking
        setActiveSessions([
            { id: 'current', device: 'Current Device', location: 'Your Location', lastActive: 'Now', isCurrent: true },
        ]);
    }, []);

    const handleSaveSettings = async () => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                ...settings,
                settingsUpdatedAt: serverTimestamp()
            });
            showToast("Settings saved!", "success");
        } catch (error) {
            console.error("Error saving settings:", error);
            showToast("Failed to save settings", "error");
        }
    };

    // Auto-save settings whenever they change
    useEffect(() => {
        // Skip initial mount
        const saveSettings = async () => {
            if (!user || !db) return;
            
            try {
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                    ...settings,
                    settingsUpdatedAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Error auto-saving settings:", error);
            }
        };
        
        // Debounce to avoid too many saves
        const timeoutId = setTimeout(() => {
            saveSettings();
        }, 500);
        
        return () => clearTimeout(timeoutId);
    }, [settings, user]);

    const handleUnblockUser = async (blockedUserId) => {
        try {
            await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users', blockedUserId));
            showToast("User unblocked", "success");
        } catch (error) {
            console.error("Error unblocking user:", error);
            showToast("Failed to unblock user", "error");
        }
    };

    const handleLogoutSession = async (sessionId) => {
        // In production, this would invalidate the session
        showToast("Session logged out", "success");
        setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
    };

    const ToggleSwitch = ({ label, description, value, onChange, icon: Icon, disabled = false, badge = null }) => (
        <div className={`flex items-start justify-between py-3 border-b border-slate-100 last:border-0 ${disabled ? 'opacity-50' : ''}`}>
            <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                    {Icon && <Icon size={16} className="text-slate-500" />}
                    <h4 className="font-bold text-sm text-slate-800">{label}</h4>
                    {badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            badge === 'Android' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            {badge === 'Android' ? 'Only on Android App' : 'Coming Soon'}
                        </span>
                    )}
                </div>
                {description && <p className="text-xs text-slate-500 leading-relaxed">{description}</p>}
            </div>
            <button
                onClick={() => !disabled && onChange(!value)}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    disabled ? 'bg-slate-200 cursor-not-allowed' : value ? 'bg-orange-500' : 'bg-slate-300'
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack}><ArrowRight className="rotate-180 text-slate-600" size={20} /></button>
                    <h1 className="text-xl font-bold text-slate-900">Settings</h1>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Location Controls */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <MapPin size={18} className="text-orange-500" /> Location Controls
                    </h3>
                    <ToggleSwitch
                        label="Use Manual Location"
                        description="Override GPS with a custom city/area"
                        value={settings.useManualLocation}
                        onChange={(val) => setSettings({ ...settings, useManualLocation: val })}
                        icon={Navigation}
                        disabled={true}
                        badge="Soon"
                    />
                    {settings.useManualLocation && (
                        <div className="mt-3">
                            <Input
                                label="Manual Location"
                                placeholder="e.g., Central London"
                                value={settings.manualLocation}
                                onChange={(e) => setSettings({ ...settings, manualLocation: e.target.value })}
                                disabled={true}
                            />
                        </div>
                    )}
                </div>

                {/* Notification Preferences */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Bell size={18} className="text-orange-500" /> Notification Preferences
                    </h3>
                    {!isMobileApp && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-blue-800 leading-relaxed">
                                    Notifications are only available on the mobile app. Download the Android app to enable push notifications.
                                </p>
                            </div>
                        </div>
                    )}
                    <ToggleSwitch
                        label="Message Notifications"
                        description="Get notified when you receive messages"
                        value={settings.notifyMessages}
                        onChange={(val) => setSettings({ ...settings, notifyMessages: val })}
                        icon={MessageCircle}
                        disabled={!isMobileApp}
                        badge={!isMobileApp ? "Android" : null}
                    />
                    <ToggleSwitch
                        label="Job Offer Notifications"
                        description="Get notified about new job offers"
                        value={settings.notifyJobOffers}
                        onChange={(val) => setSettings({ ...settings, notifyJobOffers: val })}
                        icon={Briefcase}
                        disabled={!isMobileApp}
                        badge={!isMobileApp ? "Android" : null}
                    />
                    <ToggleSwitch
                        label="Wink Notifications"
                        description="Get notified when someone winks at you"
                        value={settings.notifyWinks}
                        onChange={(val) => setSettings({ ...settings, notifyWinks: val })}
                        icon={Heart}
                        disabled={!isMobileApp}
                        badge={!isMobileApp ? "Android" : null}
                    />
                </div>

                {/* Privacy Controls - Free */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Lock size={18} className="text-orange-500" /> Privacy Controls
                        </h3>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                            FREE
                        </span>
                    </div>
                    <ToggleSwitch
                        label="Hide Distance"
                        description="Show region only instead of exact distance"
                        value={settings.hideDistance}
                        onChange={(val) => setSettings({ ...settings, hideDistance: val })}
                        icon={MapPin}
                    />
                    <ToggleSwitch
                        label="Hide Age"
                        description="Don't show your age on your profile"
                        value={settings.hideAge}
                        onChange={(val) => setSettings({ ...settings, hideAge: val })}
                        icon={User}
                    />
                    {profile?.role === 'tradie' && (
                        <ToggleSwitch
                            label="Job-Only Visibility"
                            description="Appear in Hire tab only, not Social feed"
                            value={settings.jobOnlyVisibility}
                            onChange={(val) => setSettings({ ...settings, jobOnlyVisibility: val })}
                            icon={Briefcase}
                        />
                    )}
                </div>

                {/* Premium Privacy Controls */}
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl shadow-sm border-2 border-orange-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Shield size={18} className="text-orange-600" /> GayTradies Elite
                        </h3>
                        <span className="text-xs font-bold text-orange-700 bg-orange-200 px-2 py-1 rounded-full border border-orange-300 flex items-center gap-1">
                            <Star size={10} className="fill-orange-700" /> PREMIUM
                        </span>
                    </div>
                    <div className="mb-3 p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-orange-200">
                        <p className="text-xs text-slate-700 leading-relaxed mb-2">
                            Unlock advanced privacy features with GayTradies Elite:
                        </p>
                        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                            <li>Browse anonymously with Incognito Mode</li>
                            <li>Control who can see your profile</li>
                            <li>Blur photos and hide online status</li>
                            <li>Screenshot detection & auto-delete chats</li>
                        </ul>
                    </div>
                    <ToggleSwitch
                        label="Incognito Mode"
                        description="Hide your profile while still browsing others"
                        value={settings.incognitoMode}
                        onChange={(val) => setSettings({ ...settings, incognitoMode: val })}
                        icon={EyeOff}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    <ToggleSwitch
                        label="Verified Tradies Only"
                        description="Show your profile only to verified tradies"
                        value={settings.verifiedOnly}
                        onChange={(val) => setSettings({ ...settings, verifiedOnly: val })}
                        icon={ShieldCheck}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    <ToggleSwitch
                        label="Photo Blur"
                        description="Blurs your profile picture in Social feed"
                        value={settings.blurPhotos}
                        onChange={(val) => setSettings({ ...settings, blurPhotos: val })}
                        icon={Eye}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    <ToggleSwitch
                        label="Hide Online Status"
                        description="Don't show when you're active"
                        value={settings.hideOnlineStatus}
                        onChange={(val) => setSettings({ ...settings, hideOnlineStatus: val })}
                        icon={Clock}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    
                    {/* Additional Premium Privacy Features */}
                    <div className="pt-3 mt-3 border-t border-orange-200">
                        <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                            <Lock size={14} className="text-orange-600" /> Advanced Privacy
                        </h4>
                        
                        {/* Auto-delete chats */}
                        <div className="py-3 border-b border-orange-100">
                            <label className="block mb-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Trash2 size={16} className="text-slate-500" />
                                    <span className="font-bold text-sm text-slate-800">Auto-delete Chats</span>
                                    {!isMobileApp && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                            Android Only
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mb-2">Automatically delete messages after</p>
                            </label>
                            <select
                                value={settings.autoDeleteChats}
                                onChange={(e) => setSettings({ ...settings, autoDeleteChats: e.target.value })}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                disabled={!canUsePremium || !isMobileApp}
                            >
                                <option value="never">Never</option>
                                <option value="24h">24 hours</option>
                                <option value="48h">48 hours</option>
                                <option value="72h">72 hours</option>
                            </select>
                        </div>

                        <ToggleSwitch
                            label="Screenshot Detection"
                            description="Alert you when someone takes a screenshot"
                            value={settings.screenshotDetection}
                            onChange={(val) => setSettings({ ...settings, screenshotDetection: val })}
                            icon={Camera}
                            disabled={!canUsePremium || !isMobileApp}
                            badge={!isMobileApp ? "Android" : (!canUsePremium ? "Soon" : null)}
                        />
                        <ToggleSwitch
                            label="Verified-Only Chats"
                            description="Only receive messages from verified profiles"
                            value={settings.verifiedOnlyChats}
                            onChange={(val) => setSettings({ ...settings, verifiedOnlyChats: val })}
                            icon={UserCheck}
                            disabled={!canUsePremium}
                            badge={!canUsePremium ? "Soon" : null}
                        />
                    </div>
                    
                    {/* Login History */}
                    <div className="pt-3 mt-3 border-t border-orange-200">
                        <button
                            onClick={() => setShowLoginHistory(true)}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-slate-600" />
                                <span className="font-bold text-sm text-slate-800">Login History</span>
                            </div>
                            <ChevronRight size={16} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Blocked Users */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Ban size={18} className="text-orange-500" /> Blocked Users
                    </h3>
                    <button
                        onClick={() => setShowBlockedUsers(true)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <UserX size={16} className="text-slate-600" />
                            <span className="font-bold text-sm text-slate-800">Manage Blocked Users</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">
                                {blockedUsers.length}
                            </span>
                            <ChevronRight size={16} className="text-slate-400" />
                        </div>
                    </button>
                </div>

                {/* Danger Zone - Delete Account */}
                <div className="bg-red-50 rounded-xl border-2 border-red-200 p-4">
                    <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-600" /> Danger Zone
                    </h3>
                    <p className="text-red-700 text-sm mb-3">
                        Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button 
                        variant="danger" 
                        className="w-full py-3"
                        onClick={async () => {
                            if (!confirm('Are you absolutely sure? This will permanently delete your account, profile, messages, and all data. This action CANNOT be undone!')) {
                                return;
                            }
                            
                            if (!confirm('Last chance! Type DELETE in the next prompt to confirm.')) {
                                return;
                            }
                            
                            const confirmation = prompt('Type DELETE to confirm account deletion:');
                            if (confirmation !== 'DELETE') {
                                showToast('Account deletion cancelled', 'info');
                                return;
                            }
                            
                            try {
                                showToast('Deleting account...', 'info');
                                
                                // Helper function to delete documents in batches (Firestore limit is 500 per batch)
                                const deleteInBatches = async (docsToDelete) => {
                                    const batchSize = 500;
                                    for (let i = 0; i < docsToDelete.length; i += batchSize) {
                                        const batch = writeBatch(db);
                                        const batchDocs = docsToDelete.slice(i, i + batchSize);
                                        batchDocs.forEach(docRef => batch.delete(docRef));
                                        await batch.commit();
                                    }
                                };
                                
                                try {
                                    // Delete all chats where user is a participant
                                    const chatsQuery = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'chats'),
                                        where('participants', 'array-contains', user.uid)
                                    );
                                    const chatsSnapshot = await getDocs(chatsQuery);
                                    const docsToDelete = [];
                                    
                                    for (const chatDoc of chatsSnapshot.docs) {
                                        // Collect all messages in the chat
                                        const messagesQuery = collection(db, 'artifacts', getAppId(), 'public', 'data', 'chats', chatDoc.id, 'messages');
                                        const messagesSnapshot = await getDocs(messagesQuery);
                                        messagesSnapshot.docs.forEach(msgDoc => docsToDelete.push(msgDoc.ref));
                                        // Add chat document itself
                                        docsToDelete.push(chatDoc.ref);
                                    }
                                    
                                    if (docsToDelete.length > 0) {
                                        await deleteInBatches(docsToDelete);
                                    }
                                } catch (error) {
                                    console.error('Error deleting chats:', error);
                                    // Continue with other deletions
                                }
                                
                                try {
                                    // Delete all jobs associated with user (as client or tradie)
                                    const jobsQuery1 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'),
                                        where('clientId', '==', user.uid)
                                    );
                                    const jobsSnapshot1 = await getDocs(jobsQuery1);
                                    
                                    const jobsQuery2 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'),
                                        where('tradieId', '==', user.uid)
                                    );
                                    const jobsSnapshot2 = await getDocs(jobsQuery2);
                                    
                                    const jobDocs = [...jobsSnapshot1.docs, ...jobsSnapshot2.docs].map(doc => doc.ref);
                                    if (jobDocs.length > 0) {
                                        await deleteInBatches(jobDocs);
                                    }
                                } catch (error) {
                                    console.error('Error deleting jobs:', error);
                                    // Continue with other deletions
                                }
                                
                                try {
                                    // Delete all transactions
                                    const transactionsQuery = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'),
                                        where('userId', '==', user.uid)
                                    );
                                    const transactionsSnapshot = await getDocs(transactionsQuery);
                                    const txDocs = transactionsSnapshot.docs.map(doc => doc.ref);
                                    if (txDocs.length > 0) {
                                        await deleteInBatches(txDocs);
                                    }
                                } catch (error) {
                                    console.error('Error deleting transactions:', error);
                                    // Continue with other deletions
                                }
                                
                                try {
                                    // Delete blocked users records
                                    const blockedQuery1 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
                                        where('blockedBy', '==', user.uid)
                                    );
                                    const blockedSnapshot1 = await getDocs(blockedQuery1);
                                    
                                    const blockedQuery2 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
                                        where('blockedUser', '==', user.uid)
                                    );
                                    const blockedSnapshot2 = await getDocs(blockedQuery2);
                                    
                                    const blockedDocs = [...blockedSnapshot1.docs, ...blockedSnapshot2.docs].map(doc => doc.ref);
                                    if (blockedDocs.length > 0) {
                                        await deleteInBatches(blockedDocs);
                                    }
                                } catch (error) {
                                    console.error('Error deleting blocked users:', error);
                                    // Continue with other deletions
                                }
                                
                                // Delete profile document
                                await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid));
                                
                                // Delete Firebase Auth account
                                await deleteUser(user);
                                
                                showToast('Account deleted successfully', 'success');
                                // User will be automatically signed out and redirected to landing
                            } catch (error) {
                                console.error('Error deleting account:', error);
                                if (error.code === 'auth/requires-recent-login') {
                                    alert('For security, please log out and log back in before deleting your account.');
                                } else {
                                    showToast('Failed to delete account: ' + error.message, 'error');
                                }
                            }
                        }}
                    >
                        <Trash2 size={16} className="inline mr-2" />
                        Delete My Account
                    </Button>
                </div>
            </div>

            {/* Blocked Users Modal */}
            {showBlockedUsers && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:w-[400px] h-[70vh] sm:h-auto sm:max-h-[70vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl relative flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Blocked Users</h3>
                            <button onClick={() => setShowBlockedUsers(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {blockedUsers.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Ban size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>No blocked users</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {blockedUsers.map((blocked) => (
                                        <div key={blocked.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                                    <User size={20} className="text-slate-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm">{blocked.blockedUserName || 'User'}</h4>
                                                    <p className="text-xs text-slate-500">
                                                        Blocked {blocked.blockedAt?.toDate ? blocked.blockedAt.toDate().toLocaleDateString() : 'recently'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="text-xs py-1 px-3"
                                                onClick={() => handleUnblockUser(blocked.id)}
                                            >
                                                Unblock
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Login History Modal */}
            {showLoginHistory && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:w-[400px] h-[70vh] sm:h-auto sm:max-h-[70vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl relative flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Active Sessions</h3>
                            <button onClick={() => setShowLoginHistory(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {activeSessions.map((session) => (
                                    <div key={session.id} className="bg-slate-50 rounded-lg p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-sm flex items-center gap-2">
                                                    {session.device}
                                                    {session.isCurrent && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                            Current
                                                        </span>
                                                    )}
                                                </h4>
                                                <p className="text-xs text-slate-500">{session.location}</p>
                                                <p className="text-xs text-slate-400">Last active: {session.lastActive}</p>
                                            </div>
                                            {!session.isCurrent && (
                                                <Button
                                                    variant="danger"
                                                    className="text-xs py-1 px-3"
                                                    onClick={() => handleLogoutSession(session.id)}
                                                >
                                                    Logout
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- PAYMENTS & CREDITS ---
const PaymentsCredits = ({ user, profile, onBack, showToast }) => {
    const [transactions, setTransactions] = useState([]);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawMethod, setWithdrawMethod] = useState('bank'); // 'bank' or 'crypto'
    const [withdrawAmount, setWithdrawAmount] = useState('');
    
    // Financial stats
    const onHoldBalance = profile?.finances?.onHoldBalance || 0;
    const availableBalance = profile?.finances?.availableBalance || 0;
    const totalEarnings = profile?.finances?.totalEarnings || 0;
    const totalCommissionPaid = profile?.finances?.totalCommissionPaid || 0;
    
    // Load transactions
    useEffect(() => {
        if (!user) return;
        
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'),
            where('tradieUid', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTransactions(txs);
        });
        
        return () => unsubscribe();
    }, [user]);
    
    const handleWithdraw = async () => {
        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
            showToast("Please enter a valid amount", "error");
            return;
        }
        
        const amount = parseFloat(withdrawAmount);
        if (amount > availableBalance) {
            showToast("Insufficient available balance", "error");
            return;
        }
        
        try {
            // Create withdrawal transaction
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'), {
                tradieUid: user.uid,
                type: 'withdrawal',
                amount: -amount,
                method: withdrawMethod,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            
            // Update user's available balance
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                'finances.availableBalance': increment(-amount)
            });
            
            showToast(`Withdrawal of £${amount.toFixed(2)} initiated via ${withdrawMethod === 'bank' ? 'Bank Transfer' : 'Crypto Wallet'}`, "success");
            setShowWithdrawModal(false);
            setWithdrawAmount('');
        } catch (error) {
            console.error("Error processing withdrawal:", error);
            showToast("Failed to process withdrawal", "error");
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 sticky top-0 z-10 shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-2">
                        <DollarSign size={24} />
                        <h1 className="text-xl font-bold">Payments & Credits</h1>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Balance Cards */}
                <div className="grid grid-cols-2 gap-3">
                    {/* On Hold */}
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={18} />
                            <p className="text-xs font-medium opacity-90">On Hold</p>
                        </div>
                        <p className="text-2xl font-bold">£{onHoldBalance.toFixed(2)}</p>
                        <p className="text-xs opacity-75 mt-1">Pending completion</p>
                    </div>
                    
                    {/* Available */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={18} />
                            <p className="text-xs font-medium opacity-90">Available</p>
                        </div>
                        <p className="text-2xl font-bold">£{availableBalance.toFixed(2)}</p>
                        <p className="text-xs opacity-75 mt-1">Ready to withdraw</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Total Earnings */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Earnings</p>
                        <p className="text-xl font-bold text-slate-900">£{totalEarnings.toFixed(2)}</p>
                    </div>
                    
                    {/* Commission Paid */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Commission (15%)</p>
                        <p className="text-xl font-bold text-slate-900">£{totalCommissionPaid.toFixed(2)}</p>
                    </div>
                </div>

                {/* Withdraw Button */}
                <button
                    onClick={() => setShowWithdrawModal(true)}
                    disabled={availableBalance <= 0}
                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${
                        availableBalance > 0
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-95'
                            : 'bg-slate-300 cursor-not-allowed'
                    }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <DollarSign size={20} />
                        <span>Withdraw Funds</span>
                    </div>
                </button>

                {/* Transactions History */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="p-4 border-b border-slate-100">
                        <h2 className="font-bold text-slate-900">Transaction History</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {transactions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <DollarSign size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No transactions yet</p>
                            </div>
                        ) : (
                            transactions.map(tx => (
                                <div key={tx.id} className="p-4 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-bold text-slate-900 capitalize">{tx.type}</p>
                                            {tx.status === 'pending' && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending</span>
                                            )}
                                            {tx.status === 'completed' && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {tx.jobTitle || (tx.method ? `Via ${tx.method === 'bank' ? 'Bank' : 'Crypto'}` : 'Payment')}
                                        </p>
                                        {tx.createdAt?.seconds && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                {new Date(tx.createdAt.seconds * 1000).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.amount >= 0 ? '+' : ''}£{Math.abs(tx.amount).toFixed(2)}
                                        </p>
                                        {tx.commission && (
                                            <p className="text-xs text-slate-500">-£{tx.commission.toFixed(2)} fee</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[75vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Withdraw Funds</h2>
                            <button onClick={() => setShowWithdrawModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {/* Available Balance */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Available Balance</p>
                                <p className="text-2xl font-bold text-green-900">£{availableBalance.toFixed(2)}</p>
                            </div>

                            {/* Withdrawal Method */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Withdrawal Method</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setWithdrawMethod('bank')}
                                        className={`p-3 rounded-lg border-2 transition-all ${
                                            withdrawMethod === 'bank'
                                                ? 'border-orange-500 bg-orange-50'
                                                : 'border-slate-200 bg-white'
                                        }`}
                                    >
                                        <p className="text-sm font-bold">Bank Account</p>
                                        <p className="text-xs text-slate-500">1-3 days</p>
                                    </button>
                                    <button
                                        onClick={() => setWithdrawMethod('crypto')}
                                        className={`p-3 rounded-lg border-2 transition-all ${
                                            withdrawMethod === 'crypto'
                                                ? 'border-orange-500 bg-orange-50'
                                                : 'border-slate-200 bg-white'
                                        }`}
                                    >
                                        <p className="text-sm font-bold">Crypto Wallet</p>
                                        <p className="text-xs text-slate-500">Instant</p>
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Amount (£)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={availableBalance}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-lg font-bold"
                                />
                                <button
                                    onClick={() => setWithdrawAmount(availableBalance.toString())}
                                    className="mt-2 text-xs text-orange-600 font-bold hover:text-orange-700"
                                >
                                    Withdraw All
                                </button>
                            </div>

                            {/* Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <div className="flex items-start gap-2">
                                    <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-800">
                                        {withdrawMethod === 'bank'
                                            ? 'Bank transfers typically arrive within 1-3 business days.'
                                            : 'Crypto withdrawals are processed instantly to your wallet address.'}
                                    </p>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowWithdrawModal(false)}
                                    className="flex-1 py-3 px-4 rounded-lg border-2 border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleWithdraw}
                                    className="flex-1 py-3 px-4 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-bold hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
                                >
                                    Confirm Withdrawal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SAFETY CENTRE ---
const SafetyCentre = ({ user, onBack, showToast }) => {
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportType, setReportType] = useState('user');
    const [reportDetails, setReportDetails] = useState('');
    const [trustedContacts, setTrustedContacts] = useState([]);
    const [showTrustedContactsModal, setShowTrustedContactsModal] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');

    // Load trusted contacts
    useEffect(() => {
        if (!user || !db) return;
        const unsub = onSnapshot(
            doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid),
            (docSnap) => {
                if (docSnap.exists()) {
                    setTrustedContacts(docSnap.data().trustedContacts || []);
                }
            }
        );
        return () => unsub();
    }, [user]);

    const handleSubmitReport = async () => {
        if (!reportDetails.trim()) {
            showToast("Please provide details", "error");
            return;
        }

        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'reports'), {
                reportedBy: user.uid,
                reportType,
                details: reportDetails,
                createdAt: serverTimestamp(),
                status: 'pending'
            });
            showToast("Report submitted. We'll review this promptly.", "success");
            setShowReportModal(false);
            setReportDetails('');
        } catch (error) {
            console.error("Error submitting report:", error);
            showToast("Failed to submit report", "error");
        }
    };

    const handleAddTrustedContact = async () => {
        if (!newContactName.trim() || !newContactPhone.trim()) {
            showToast("Please fill all fields", "error");
            return;
        }

        try {
            const newContact = {
                id: Date.now().toString(),
                name: newContactName,
                phone: newContactPhone,
                addedAt: new Date().toISOString()
            };
            
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                trustedContacts: arrayUnion(newContact)
            });
            
            showToast("Trusted contact added", "success");
            setNewContactName('');
            setNewContactPhone('');
        } catch (error) {
            console.error("Error adding trusted contact:", error);
            showToast("Failed to add contact", "error");
        }
    };

    const handleQuickExit = () => {
        // Redirect to a neutral site without leaving browser history trail
        window.location.replace('https://www.google.com');
    };

    const SafetyCard = ({ icon: Icon, title, description, action, actionLabel, variant = 'default' }) => (
        <div className={`bg-white rounded-xl shadow-sm border p-4 ${
            variant === 'danger' ? 'border-red-200 bg-red-50' : 'border-slate-100'
        }`}>
            <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                    variant === 'danger' ? 'bg-red-100' : 'bg-orange-50'
                }`}>
                    <Icon size={20} className={variant === 'danger' ? 'text-red-600' : 'text-orange-600'} />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-sm text-slate-900 mb-1">{title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
                </div>
            </div>
            {action && (
                <Button
                    variant={variant === 'danger' ? 'danger' : 'outline'}
                    className="w-full text-xs py-2"
                    onClick={action}
                >
                    {actionLabel}
                </Button>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white sticky top-0 z-40">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack}><ArrowRight className="rotate-180" size={20} /></button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Safety Centre</h1>
                        <p className="text-xs opacity-90">Your safety is our priority</p>
                    </div>
                    <Shield size={24} />
                </div>
            </div>

            {/* Quick Exit Button */}
            <div className="p-4 bg-red-50 border-b border-red-100">
                <Button
                    variant="danger"
                    className="w-full py-3 flex items-center justify-center gap-2"
                    onClick={handleQuickExit}
                >
                    <AlertTriangle size={18} />
                    Quick Exit / Panic Button
                </Button>
                <p className="text-xs text-red-700 text-center mt-2">
                    Instantly redirects to Google for your safety
                </p>
            </div>

            <div className="p-4 space-y-4">
                {/* Critical Actions */}
                <div className="space-y-3">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Critical Actions</h3>
                    
                    <SafetyCard
                        icon={Flag}
                        title="Report User"
                        description="Report harassment, hate speech, or inappropriate behavior"
                        action={() => { setReportType('user'); setShowReportModal(true); }}
                        actionLabel="Report a User"
                        variant="danger"
                    />
                    
                    <SafetyCard
                        icon={AlertCircle}
                        title="Report Safety Concern"
                        description="Report a job-related safety issue or scam attempt"
                        action={() => { setReportType('safety'); setShowReportModal(true); }}
                        actionLabel="Report Concern"
                        variant="danger"
                    />
                    
                    <SafetyCard
                        icon={Phone}
                        title="Emergency Support"
                        description="Get immediate help from local emergency services"
                        action={() => window.location.href = 'tel:999'}
                        actionLabel="Call Emergency Services"
                        variant="danger"
                    />
                </div>

                {/* Educational Content */}
                <div className="space-y-3 mt-6">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Safety Guides</h3>
                    
                    <SafetyCard
                        icon={ShieldCheck}
                        title="Verification Process"
                        description="Learn how our verification system protects you and ensures tradies are qualified"
                        action={() => showToast("Verification guide opened", "info")}
                        actionLabel="Learn More"
                    />
                    
                    <SafetyCard
                        icon={Briefcase}
                        title="Safe Hiring Guidelines"
                        description="Best practices for hiring tradies, including deposit warnings and contract tips"
                        action={() => showToast("Safe hiring guide opened", "info")}
                        actionLabel="Read Guidelines"
                    />
                    
                    <SafetyCard
                        icon={HardHat}
                        title="In-Home Conduct"
                        description="What to expect when tradies work in your home and how to stay safe"
                        action={() => showToast("Conduct guide opened", "info")}
                        actionLabel="View Guide"
                    />
                    
                    <SafetyCard
                        icon={Lock}
                        title="Privacy Protection"
                        description="How we protect against outing, doxxing, and unwanted exposure"
                        action={() => showToast("Privacy guide opened", "info")}
                        actionLabel="Learn More"
                    />
                    
                    <SafetyCard
                        icon={Ban}
                        title="Harassment Policy"
                        description="Our zero-tolerance policy for hate speech and harassment"
                        action={() => showToast("Policy opened", "info")}
                        actionLabel="Read Policy"
                    />
                    
                    <SafetyCard
                        icon={Heart}
                        title="Consent Guidelines"
                        description="Understanding consent in professional and personal interactions"
                        action={() => showToast("Consent guidelines opened", "info")}
                        actionLabel="View Guidelines"
                    />
                    
                    <SafetyCard
                        icon={AlertTriangle}
                        title="Scam Prevention"
                        description="How to spot and avoid scams, including deposit fraud and fake profiles"
                        action={() => showToast("Scam prevention guide opened", "info")}
                        actionLabel="Stay Safe"
                    />
                </div>

                {/* Advanced Safety Features */}
                <div className="space-y-3 mt-6">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Advanced Safety</h3>
                    
                    <SafetyCard
                        icon={Users}
                        title="Trusted Contacts"
                        description="Add trusted people who can be notified about your job bookings"
                        action={() => setShowTrustedContactsModal(true)}
                        actionLabel="Manage Contacts"
                    />
                </div>

                {/* Resources */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 mt-6">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                        <Info size={20} />
                        Need Help?
                    </h3>
                    <p className="text-sm text-slate-300 mb-4">
                        If you're experiencing issues or need support, we're here to help 24/7.
                    </p>
                    <div className="space-y-2">
                        <a
                            href="https://www.galop.org.uk/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <span className="text-sm font-medium">Galop LGBT+ Hate Crime Support</span>
                            <ExternalLink size={16} />
                        </a>
                        <a
                            href="https://www.switchboard.lgbt/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <span className="text-sm font-medium">Switchboard LGBT+ Helpline</span>
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-red-50">
                            <h3 className="text-lg font-bold text-red-900">Submit Report</h3>
                            <button onClick={() => setShowReportModal(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-slate-600 mb-4">
                                Your report will be reviewed by our safety team. All reports are taken seriously and handled confidentially.
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Report Type</label>
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg"
                                >
                                    <option value="user">User Behavior</option>
                                    <option value="safety">Safety Concern</option>
                                    <option value="scam">Scam/Fraud</option>
                                    <option value="harassment">Harassment</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Details</label>
                                <textarea
                                    value={reportDetails}
                                    onChange={(e) => setReportDetails(e.target.value)}
                                    placeholder="Please provide as much detail as possible..."
                                    rows={4}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" className="flex-1" onClick={() => setShowReportModal(false)}>
                                    Cancel
                                </Button>
                                <Button variant="danger" className="flex-1" onClick={handleSubmitReport}>
                                    Submit Report
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trusted Contacts Modal */}
            {showTrustedContactsModal && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full sm:w-[400px] h-[80vh] sm:h-auto sm:max-h-[80vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Trusted Contacts</h3>
                            <button onClick={() => setShowTrustedContactsModal(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <p className="text-sm text-slate-600 mb-4">
                                Add trusted contacts who can be notified about your job bookings for added safety.
                            </p>
                            
                            {/* Add New Contact Form */}
                            <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                <h4 className="font-bold text-sm mb-3">Add New Contact</h4>
                                <Input
                                    label="Name"
                                    placeholder="e.g., Sarah Smith"
                                    value={newContactName}
                                    onChange={(e) => setNewContactName(e.target.value)}
                                />
                                <Input
                                    label="Phone Number"
                                    placeholder="e.g., 07700 900000"
                                    value={newContactPhone}
                                    onChange={(e) => setNewContactPhone(e.target.value)}
                                />
                                <Button
                                    variant="secondary"
                                    className="w-full text-sm"
                                    onClick={handleAddTrustedContact}
                                >
                                    Add Contact
                                </Button>
                            </div>

                            {/* Existing Contacts List */}
                            {trustedContacts.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-sm mb-2">Your Contacts</h4>
                                    <div className="space-y-2">
                                        {trustedContacts.map((contact) => (
                                            <div key={contact.id} className="bg-white border border-slate-200 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h5 className="font-bold text-sm">{contact.name}</h5>
                                                        <p className="text-xs text-slate-500">{contact.phone}</p>
                                                    </div>
                                                    <Phone size={16} className="text-orange-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- WORK CALENDAR COMPONENT ---
const WorkCalendar = ({ user, profile, onBack, showToast }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [unavailability, setUnavailability] = useState({});
    const [selectedDate, setSelectedDate] = useState(null);

    // Helper to get profile document reference
    const getProfileDocRef = () => doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid);

    // Load unavailability data from Firebase
    useEffect(() => {
        if (!user || !db) return;
        const unsub = onSnapshot(
            getProfileDocRef(),
            (docSnap) => {
                if (docSnap.exists()) {
                    setUnavailability(docSnap.data().workCalendar || {});
                } else {
                    setUnavailability({});
                }
            }
        );
        return () => unsub();
    }, [user]);

    // Calendar helper functions
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        return { daysInMonth, startingDayOfWeek, year, month };
    };

    const navigateMonth = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const toggleTimeSlot = async (dateKey, timeSlot) => {
        const newUnavailability = { ...unavailability };
        
        // Initialize date if it doesn't exist (use object format for new entries)
        if (!newUnavailability[dateKey]) {
            newUnavailability[dateKey] = {};
        }
        
        // Convert old array format to new object format if needed
        if (Array.isArray(newUnavailability[dateKey])) {
            const oldSlots = newUnavailability[dateKey];
            newUnavailability[dateKey] = {};
            oldSlots.forEach(slot => {
                newUnavailability[dateKey][slot] = { reason: 'manual' };
            });
        }
        
        const dateSlots = newUnavailability[dateKey];
        
        // Toggle the slot (only allow toggling manual slots, not job slots)
        if (dateSlots[timeSlot]) {
            // Only allow removing manual unavailability, not job-based
            if (dateSlots[timeSlot].reason === 'manual') {
                delete dateSlots[timeSlot];
            } else {
                showToast("Cannot remove job-booked time slots", "error");
                return;
            }
        } else {
            dateSlots[timeSlot] = { reason: 'manual' };
        }
        
        // Clean up empty date entries
        if (Object.keys(dateSlots).length === 0) {
            delete newUnavailability[dateKey];
        }
        
        try {
            // If workCalendar is now empty, remove the field entirely from Firebase
            if (Object.keys(newUnavailability).length === 0) {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: deleteField()
                });
            } else {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: newUnavailability
                });
            }
            setUnavailability(newUnavailability);
            showToast("Availability updated", "success");
        } catch (error) {
            console.error("Error updating availability:", error);
            showToast("Failed to update availability", "error");
        }
    };

    const blockEntireDay = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        
        // Convert to object format if needed
        if (Array.isArray(newUnavailability[dateKey])) {
            const oldSlots = newUnavailability[dateKey];
            newUnavailability[dateKey] = {};
            oldSlots.forEach(slot => {
                newUnavailability[dateKey][slot] = { reason: 'manual' };
            });
        } else if (!newUnavailability[dateKey]) {
            newUnavailability[dateKey] = {};
        }
        
        // Block all time slots (preserve job slots)
        ['morning', 'afternoon', 'evening'].forEach(slot => {
            if (!newUnavailability[dateKey][slot] || newUnavailability[dateKey][slot].reason !== 'job') {
                newUnavailability[dateKey][slot] = { reason: 'manual' };
            }
        });
        
        try {
            await updateDoc(getProfileDocRef(), {
                workCalendar: newUnavailability
            });
            setUnavailability(newUnavailability);
            showToast("Entire day blocked", "success");
        } catch (error) {
            console.error("Error blocking day:", error);
            showToast("Failed to block day", "error");
        }
    };

    const blockEntireWeek = async (startDateKey) => {
        const newUnavailability = { ...unavailability };
        const startDate = new Date(startDateKey + 'T00:00:00');
        
        // Block 7 days starting from the selected date
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateKey = formatDateKey(date);
            
            // Convert to object format if needed
            if (Array.isArray(newUnavailability[dateKey])) {
                const oldSlots = newUnavailability[dateKey];
                newUnavailability[dateKey] = {};
                oldSlots.forEach(slot => {
                    newUnavailability[dateKey][slot] = { reason: 'manual' };
                });
            } else if (!newUnavailability[dateKey]) {
                newUnavailability[dateKey] = {};
            }
            
            // Block all time slots (preserve job slots)
            ['morning', 'afternoon', 'evening'].forEach(slot => {
                if (!newUnavailability[dateKey][slot] || newUnavailability[dateKey][slot].reason !== 'job') {
                    newUnavailability[dateKey][slot] = { reason: 'manual' };
                }
            });
        }
        
        try {
            await updateDoc(getProfileDocRef(), {
                workCalendar: newUnavailability
            });
            setUnavailability(newUnavailability);
            showToast("Entire week blocked", "success");
        } catch (error) {
            console.error("Error blocking week:", error);
            showToast("Failed to block week", "error");
        }
    };

    const blockEntireMonth = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        const [yearStr, monthStr] = dateKey.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        
        // Get the number of days in the month
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        
        // Block all days in the month
        for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, month, day);
            const key = formatDateKey(date);
            
            // Convert to object format if needed
            if (Array.isArray(newUnavailability[key])) {
                const oldSlots = newUnavailability[key];
                newUnavailability[key] = {};
                oldSlots.forEach(slot => {
                    newUnavailability[key][slot] = { reason: 'manual' };
                });
            } else if (!newUnavailability[key]) {
                newUnavailability[key] = {};
            }
            
            // Block all time slots (preserve job slots)
            ['morning', 'afternoon', 'evening'].forEach(slot => {
                if (!newUnavailability[key][slot] || newUnavailability[key][slot].reason !== 'job') {
                    newUnavailability[key][slot] = { reason: 'manual' };
                }
            });
        }
        
        try {
            await updateDoc(getProfileDocRef(), {
                workCalendar: newUnavailability
            });
            setUnavailability(newUnavailability);
            showToast("Entire month blocked", "success");
        } catch (error) {
            console.error("Error blocking month:", error);
            showToast("Failed to block month", "error");
        }
    };

    // Helper function to update work calendar and handle empty state
    const updateWorkCalendar = async (newUnavailability, successMessage) => {
        try {
            if (Object.keys(newUnavailability).length === 0) {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: deleteField()
                });
            } else {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: newUnavailability
                });
            }
            setUnavailability(newUnavailability);
            showToast(successMessage, "success");
        } catch (error) {
            console.error("Error updating work calendar:", error);
            showToast("Failed to update calendar", "error");
        }
    };

    const clearEntireDay = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        const dateSlots = newUnavailability[dateKey];
        
        if (!dateSlots) {
            showToast("No unavailability to clear", "error");
            return;
        }
        
        // If it's old array format, just delete it (no job protection needed for old data)
        if (Array.isArray(dateSlots)) {
            delete newUnavailability[dateKey];
            await updateWorkCalendar(newUnavailability, "Day cleared");
            return;
        }
        
        // New object format - only remove manual slots, keep job slots
        const jobSlots = {};
        Object.keys(dateSlots).forEach(slot => {
            if (dateSlots[slot]?.reason === 'job') {
                jobSlots[slot] = dateSlots[slot];
            }
        });
        
        if (Object.keys(jobSlots).length > 0) {
            newUnavailability[dateKey] = jobSlots;
            await updateWorkCalendar(newUnavailability, "Day cleared (job-booked slots preserved)");
        } else {
            delete newUnavailability[dateKey];
            await updateWorkCalendar(newUnavailability, "Day cleared");
        }
    };

    const clearEntireWeek = async (startDateKey) => {
        const newUnavailability = { ...unavailability };
        const [year, month, day] = startDateKey.split('-').map(Number);
        const startDate = new Date(year, month - 1, day);
        
        let hasJobSlots = false;
        
        // Clear 7 days starting from the selected date
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateKey = formatDateKey(date);
            const dateSlots = newUnavailability[dateKey];
            
            if (!dateSlots) continue;
            
            // If it's old array format, just delete it
            if (Array.isArray(dateSlots)) {
                delete newUnavailability[dateKey];
            } else {
                // New object format - only remove manual slots, keep job slots
                const jobSlots = {};
                Object.keys(dateSlots).forEach(slot => {
                    if (dateSlots[slot]?.reason === 'job') {
                        jobSlots[slot] = dateSlots[slot];
                        hasJobSlots = true;
                    }
                });
                
                if (Object.keys(jobSlots).length > 0) {
                    newUnavailability[dateKey] = jobSlots;
                } else {
                    delete newUnavailability[dateKey];
                }
            }
        }
        
        const message = hasJobSlots ? "Week cleared (job-booked slots preserved)" : "Week cleared";
        await updateWorkCalendar(newUnavailability, message);
    };

    const clearEntireMonth = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        const [year, month] = dateKey.split('-').map(Number);
        
        // Get the number of days in the month
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        
        let hasJobSlots = false;
        
        // Clear all days in the month
        for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, month - 1, day);
            const key = formatDateKey(date);
            const dateSlots = newUnavailability[key];
            
            if (!dateSlots) continue;
            
            // If it's old array format, just delete it
            if (Array.isArray(dateSlots)) {
                delete newUnavailability[key];
            } else {
                // New object format - only remove manual slots, keep job slots
                const jobSlots = {};
                Object.keys(dateSlots).forEach(slot => {
                    if (dateSlots[slot]?.reason === 'job') {
                        jobSlots[slot] = dateSlots[slot];
                        hasJobSlots = true;
                    }
                });
                
                if (Object.keys(jobSlots).length > 0) {
                    newUnavailability[key] = jobSlots;
                } else {
                    delete newUnavailability[key];
                }
            }
        }
        
        const message = hasJobSlots ? "Month cleared (job-booked slots preserved)" : "Month cleared";
        await updateWorkCalendar(newUnavailability, message);
    };

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const today = new Date();
    const todayKey = formatDateKey(today);
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-orange-500 text-white sticky top-0 z-40">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack}><ArrowRight className="rotate-180" size={20} /></button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Work Calendar</h1>
                        <p className="text-xs opacity-90">Manage your availability</p>
                    </div>
                    <Calendar size={24} />
                </div>
            </div>

            <div className="p-4">
                {/* Info Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-sm text-blue-900 mb-1">How it works</h3>
                            <p className="text-xs text-blue-800 leading-relaxed">
                                Mark dates and times when you're <strong>not available</strong> for hire. 
                                Your profile will be hidden from the Hire tab during those times.
                            </p>
                        </div>
                    </div>
                </div>

                {/* QUICK OPTIONS - Always visible, placed ABOVE calendar */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
                    <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">Quick Options</h4>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <Button
                            variant="outline"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? blockEntireDay(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Block Day
                        </Button>
                        <Button
                            variant="outline"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? blockEntireWeek(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Block Week
                        </Button>
                        <Button
                            variant="outline"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? blockEntireMonth(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Block Month
                        </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            variant="ghost"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? clearEntireDay(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Clear Day
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? clearEntireWeek(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Clear Week
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? clearEntireMonth(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Clear Month
                        </Button>
                    </div>
                </div>

                {/* Calendar Navigation */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={24} className="text-slate-600" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900">
                            {monthNames[month]} {year}
                        </h2>
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronRightIcon size={24} className="text-slate-600" />
                        </button>
                    </div>

                    {/* Day names */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayNames.map(day => (
                            <div key={day} className="text-center text-xs font-bold text-slate-500 py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                        ))}
                        
                        {/* Days of the month */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month, day);
                            const dateKey = formatDateKey(date);
                            const isPast = date < todayDateOnly;
                            const isToday = dateKey === todayKey;
                            const isSelected = selectedDate === dateKey;
                            
                            // Check for unavailability (support both array and object formats)
                            const dateSlots = unavailability[dateKey];
                            let hasUnavailability = false;
                            if (dateSlots) {
                                if (Array.isArray(dateSlots)) {
                                    hasUnavailability = dateSlots.length > 0;
                                } else {
                                    hasUnavailability = Object.keys(dateSlots).length > 0;
                                }
                            }
                            
                            return (
                                <button
                                    key={day}
                                    onClick={() => !isPast && setSelectedDate(dateKey)}
                                    disabled={isPast}
                                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                                        isPast
                                            ? 'text-slate-300 cursor-not-allowed'
                                            : isSelected
                                            ? 'bg-orange-500 text-white shadow-md'
                                            : isToday
                                            ? 'bg-blue-100 text-blue-900 border-2 border-blue-500'
                                            : hasUnavailability
                                            ? 'bg-red-100 text-red-900 border border-red-300'
                                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-500" />
                            <span className="text-slate-600">Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
                            <span className="text-slate-600">Unavailable</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-slate-50 border border-slate-200" />
                            <span className="text-slate-600">Available</span>
                        </div>
                    </div>
                </div>

                {/* Time Slot Selection */}
                {selectedDate && (() => {
                    // Parse selectedDate string safely (YYYY-MM-DD format)
                    const [yearStr, monthStr, dayStr] = selectedDate.split('-');
                    const selectedDateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
                    
                    return (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 animate-in fade-in slide-in-from-bottom duration-300">
                        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <Clock size={18} className="text-orange-500" />
                            {selectedDateObj.toLocaleDateString('en-GB', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Select time slots when you are <strong>NOT available</strong>
                        </p>

                        <div className="space-y-3">
                            {/* Morning */}
                            {(() => {
                                const dateSlots = unavailability[selectedDate];
                                let isUnavailable = false;
                                let isJob = false;
                                
                                if (dateSlots) {
                                    if (Array.isArray(dateSlots)) {
                                        isUnavailable = dateSlots.includes('morning');
                                    } else {
                                        isUnavailable = !!dateSlots['morning'];
                                        isJob = dateSlots['morning']?.reason === 'job';
                                    }
                                }
                                
                                return (
                                    <button
                                        onClick={() => toggleTimeSlot(selectedDate, 'morning')}
                                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                                            isUnavailable
                                                ? isJob
                                                    ? 'bg-blue-50 border-blue-500 text-blue-900'
                                                    : 'bg-red-50 border-red-500 text-red-900'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-orange-500'
                                        }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Morning</div>
                                            <div className="text-xs opacity-75">
                                                8:00 AM - 12:00 PM
                                                {isJob && <span className="ml-2 font-bold">(Job Booked)</span>}
                                            </div>
                                        </div>
                                        {isUnavailable && (
                                            <Ban size={20} className={isJob ? 'text-blue-600' : 'text-red-600'} />
                                        )}
                                    </button>
                                );
                            })()}

                            {/* Afternoon */}
                            {(() => {
                                const dateSlots = unavailability[selectedDate];
                                let isUnavailable = false;
                                let isJob = false;
                                
                                if (dateSlots) {
                                    if (Array.isArray(dateSlots)) {
                                        isUnavailable = dateSlots.includes('afternoon');
                                    } else {
                                        isUnavailable = !!dateSlots['afternoon'];
                                        isJob = dateSlots['afternoon']?.reason === 'job';
                                    }
                                }
                                
                                return (
                                    <button
                                        onClick={() => toggleTimeSlot(selectedDate, 'afternoon')}
                                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                                            isUnavailable
                                                ? isJob
                                                    ? 'bg-blue-50 border-blue-500 text-blue-900'
                                                    : 'bg-red-50 border-red-500 text-red-900'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-orange-500'
                                        }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Afternoon</div>
                                            <div className="text-xs opacity-75">
                                                12:00 PM - 8:00 PM
                                                {isJob && <span className="ml-2 font-bold">(Job Booked)</span>}
                                            </div>
                                        </div>
                                        {isUnavailable && (
                                            <Ban size={20} className={isJob ? 'text-blue-600' : 'text-red-600'} />
                                        )}
                                    </button>
                                );
                            })()}

                            {/* Evening */}
                            {(() => {
                                const dateSlots = unavailability[selectedDate];
                                let isUnavailable = false;
                                let isJob = false;
                                
                                if (dateSlots) {
                                    if (Array.isArray(dateSlots)) {
                                        isUnavailable = dateSlots.includes('evening');
                                    } else {
                                        isUnavailable = !!dateSlots['evening'];
                                        isJob = dateSlots['evening']?.reason === 'job';
                                    }
                                }
                                
                                return (
                                    <button
                                        onClick={() => toggleTimeSlot(selectedDate, 'evening')}
                                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                                            isUnavailable
                                                ? isJob
                                                    ? 'bg-blue-50 border-blue-500 text-blue-900'
                                                    : 'bg-red-50 border-red-500 text-red-900'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-orange-500'
                                        }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Evening</div>
                                            <div className="text-xs opacity-75">
                                                8:00 PM - 11:00 PM
                                                {isJob && <span className="ml-2 font-bold">(Job Booked)</span>}
                                            </div>
                                        </div>
                                        {isUnavailable && (
                                            <Ban size={20} className={isJob ? 'text-blue-600' : 'text-red-600'} />
                                        )}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                    );
                })()}
            </div>
        </div>
    );
};

const AdminPanel = ({ user, onBack, showToast }) => {
    const [activeSection, setActiveSection] = useState(null);
    const [activeTab, setActiveTab] = useState('tradieVerification');
    const [verificationRequests, setVerificationRequests] = useState([]);
    const [profilePictureRequests, setProfilePictureRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedPicture, setSelectedPicture] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [requestToReject, setRequestToReject] = useState(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropData, setCropData] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [emailValidationEmail, setEmailValidationEmail] = useState('');
    const [emailValidationNote, setEmailValidationNote] = useState('');
    const [isValidatingEmail, setIsValidatingEmail] = useState(false);
    const [unverifiedProfiles, setUnverifiedProfiles] = useState([]);
    const [isLoadingUnverified, setIsLoadingUnverified] = useState(false);
    const [unverifiedError, setUnverifiedError] = useState('');

    // Admin cover message state
    const [adminMessageEmail, setAdminMessageEmail] = useState('');
    const [adminMessageText, setAdminMessageText] = useState('');
    const [isSendingAdminMessage, setIsSendingAdminMessage] = useState(false);

    // Reports management state
    const [reports, setReports] = useState([]);
    const [reportFilter, setReportFilter] = useState('pending'); // pending, reviewed, dismissed, all
    const [selectedReport, setSelectedReport] = useState(null);
    const [reportedUserData, setReportedUserData] = useState(null);
    
    // Profile viewer state
    const [showProfileList, setShowProfileList] = useState(false);
    const [profilesList, setProfilesList] = useState([]);

    // Check if user is admin
    const isAdmin = user?.email === ADMIN_EMAIL;

    // Fetch verification requests
    useEffect(() => {
        if (!user || !db || !isAdmin) return;

        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVerificationRequests(requests);
        }, (error) => {
            console.error("Error fetching verification requests:", error);
            showToast("Failed to load verification requests. Check Firebase rules.", "error");
        });

        return () => unsub();
    }, [user, isAdmin]);

    // Load all profiles that have not verified their email yet
    useEffect(() => {
        if (!user || !db || !isAdmin) return;

        setIsLoadingUnverified(true);
        setUnverifiedError('');

        // Primary live query for users with explicit emailVerified === false
        try {
            const unverifiedQuery = query(
                collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'),
                where('emailVerified', '==', false),
                orderBy('createdAt', 'desc')
            );

            const unsub = onSnapshot(unverifiedQuery, (snapshot) => {
                const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUnverifiedProfiles(profiles);
                setIsLoadingUnverified(false);
            }, async (error) => {
                console.error("Error fetching unverified profiles:", error);
                setUnverifiedError('Live list unavailable. Showing filtered fallback.');

                try {
                    // Fallback: fetch all profiles and filter client-side for missing/false emailVerified
                    const allProfilesSnap = await getDocs(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'));
                    const fallbackProfiles = allProfilesSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(p => p.emailVerified !== true)
                        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                    setUnverifiedProfiles(fallbackProfiles);
                } catch (fallbackErr) {
                    console.error('Fallback unverified fetch failed:', fallbackErr);
                    showToast('Failed to load unverified profiles', 'error');
                } finally {
                    setIsLoadingUnverified(false);
                }
            });

            return () => unsub();
        } catch (setupError) {
            console.error('Setup error for unverified profiles listener:', setupError);
            setUnverifiedError('Could not start live unverified list. Using fallback fetch.');
            (async () => {
                try {
                    const allProfilesSnap = await getDocs(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'));
                    const fallbackProfiles = allProfilesSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(p => p.emailVerified !== true)
                        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                    setUnverifiedProfiles(fallbackProfiles);
                } catch (fallbackErr) {
                    console.error('Fallback unverified fetch failed:', fallbackErr);
                    showToast('Failed to load unverified profiles', 'error');
                } finally {
                    setIsLoadingUnverified(false);
                }
            })();
        }
    }, [user, isAdmin]);

    const handleManualEmailValidation = async () => {
        const trimmedEmail = emailValidationEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            showToast('Enter an email address to validate.', 'error');
            return;
        }

        setIsValidatingEmail(true);
        try {
            const profilesRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
            const q = query(profilesRef, where('email', '==', trimmedEmail));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                showToast('No profile found for that email address.', 'error');
                return;
            }

            const updatePromises = snapshot.docs.map(profileDoc =>
                updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', profileDoc.id), {
                    emailValidationStatus: 'validated',
                    emailValidationNote: emailValidationNote || 'Manually validated via admin panel',
                    emailValidatedAt: serverTimestamp()
                })
            );

            await Promise.all(updatePromises);
            setEmailValidationEmail('');
            setEmailValidationNote('');
            showToast('Email marked as validated.', 'success');
        } catch (error) {
            console.error('Error validating email:', error);
            showToast('Failed to validate email. Try again.', 'error');
        } finally {
            setIsValidatingEmail(false);
        }
    };

    const handleAdminMarkEmailVerified = async (profile) => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', profile.id), {
                emailVerified: true,
                emailValidationStatus: 'validated',
                emailValidatedAt: serverTimestamp(),
                notifications: arrayUnion({
                    type: 'email_validated',
                    title: 'Email verified',
                    message: 'An admin verified your email so you can continue using all features.',
                    timestamp: serverTimestamp(),
                    read: false,
                    icon: 'mail-check'
                })
            });
            showToast(`Marked ${profile.email || 'user'} as verified`, 'success');
        } catch (error) {
            console.error('Error validating email:', error);
            showToast('Failed to validate email. Try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdminResendVerification = async (profile) => {
        if (!profile?.id || !profile?.email) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'email_resend_requests'), {
                userId: profile.id,
                email: profile.email,
                requestedAt: serverTimestamp(),
                requestedBy: user.uid,
                requestedByEmail: user.email
            });
            showToast('Resend queued for this user', 'success');
        } catch (error) {
            console.error('Error queuing resend:', error);
            showToast('Failed to queue resend email.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleManualTradieApprove = async (tradieUid, requestId = null) => {
        if (!tradieUid) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                verified: true,
                verificationStatus: 'manually_verified',
                verifiedAt: serverTimestamp(),
                verificationMetadata: {
                    verificationMethod: 'Admin override',
                    verifiedBy: user.uid,
                    verifiedByEmail: user.email,
                    verifiedAt: serverTimestamp()
                },
                notifications: arrayUnion({
                    type: 'verification_approved',
                    title: 'Verification Approved!',
                    message: 'An admin confirmed your tradie account. You now have full access.',
                    timestamp: serverTimestamp(),
                    read: false,
                    icon: 'check-circle'
                })
            });

            if (requestId) {
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                    status: 'approved',
                    reviewedBy: user.uid,
                    reviewedAt: serverTimestamp(),
                    documentsDeleted: false,
                    adminOverride: true
                });
            }

            showToast('Tradie marked as verified.', 'success');
        } catch (error) {
            console.error('Error manually verifying tradie:', error);
            showToast('Failed to manually verify tradie', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestMoreInfo = async (requestId, tradieUid) => {
        if (!requestId || !tradieUid) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                status: 'needs_info',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp(),
                requestMoreInfo: true
            });

            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                notifications: arrayUnion({
                    type: 'verification_more_info',
                    title: 'More info needed',
                    message: 'We need more information to verify your tradie account. Please update your documents.',
                    timestamp: serverTimestamp(),
                    read: false,
                    icon: 'info'
                }),
                verificationStatus: 'needs_info'
            });

            showToast('Requested more info from tradie.', 'success');
        } catch (error) {
            console.error('Error requesting more info:', error);
            showToast('Failed to request more info', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSendAdminMessage = async () => {
        const email = adminMessageEmail.trim().toLowerCase();
        if (!email || !adminMessageText.trim()) {
            showToast('Enter an email and message to send.', 'error');
            return;
        }

        setIsSendingAdminMessage(true);
        try {
            const profilesRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
            const q = query(profilesRef, where('email', '==', email));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                showToast('No profile found for that email address.', 'error');
                return;
            }

            const updates = snapshot.docs.map(profileDoc => updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', profileDoc.id), {
                adminCoverMessage: {
                    text: adminMessageText.trim(),
                    createdAt: serverTimestamp(),
                    from: user.email,
                    canDismiss: true,
                    read: false
                }
            }));

            await Promise.all(updates);
            showToast('Message sent to cover photo.', 'success');
            setAdminMessageEmail('');
            setAdminMessageText('');
        } catch (error) {
            console.error('Error sending admin message:', error);
            showToast('Failed to send message', 'error');
        } finally {
            setIsSendingAdminMessage(false);
        }
    };

    // Fetch profile picture requests
    useEffect(() => {
        if (!user || !db || !isAdmin) return;
        
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProfilePictureRequests(requests);
        }, (error) => {
            console.error("Error fetching profile picture requests:", error);
        });
        
        return () => unsub();
    }, [user, isAdmin]);

    // Fetch reports
    useEffect(() => {
        if (!user || !db || !isAdmin) return;
        
        let q;
        if (reportFilter === 'all') {
            q = query(
                collection(db, 'artifacts', getAppId(), 'public', 'data', 'reports'),
                orderBy('createdAt', 'desc')
            );
        } else {
            q = query(
                collection(db, 'artifacts', getAppId(), 'public', 'data', 'reports'),
                where('status', '==', reportFilter),
                orderBy('createdAt', 'desc')
            );
        }
        
        const unsub = onSnapshot(q, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReports(reportsData);
        }, (error) => {
            console.error("Error fetching reports:", error);
            showToast("Failed to load reports", "error");
        });
        
        return () => unsub();
    }, [user, isAdmin, reportFilter]);

    // Approve verification
    const handleApprove = async (requestId, tradieUid) => {
        setLoading(true);
        try {
            const request = verificationRequests.find(r => r.id === requestId);
            
            // Extract metadata from uploaded documents before deletion
            const verificationMetadata = {
                documentType: 'CSCS/ECS Card',
                trade: request?.trade || 'Not specified',
                tradieName: request?.tradieName || 'Unknown',
                verifiedAt: new Date().toISOString(),
                verifiedBy: user.uid,
                verifiedByEmail: user.email,
                verificationMethod: 'Document Upload',
                submittedAt: request?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                // Store references to original upload locations (for audit trail)
                originalUploadPaths: {
                    front: request?.cardImageUrl ? new URL(request.cardImageUrl).pathname : null,
                    back: request?.cardImageBackUrl ? new URL(request.cardImageBackUrl).pathname : null
                },
                notes: request?.notes || ''
            };

            // Update the verification request to approved
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                status: 'approved',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp(),
                documentsDeleted: true
            });

            // Update tradie profile with verification status and metadata
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                verified: true,
                verificationStatus: 'approved',
                verifiedAt: serverTimestamp(),
                verificationMetadata: verificationMetadata,
                // Add notification for the user
                notifications: arrayUnion({
                    type: 'verification_approved',
                    title: 'Verification Approved!',
                    message: 'Your tradie verification has been approved. You now have a verified badge on your profile.',
                    timestamp: serverTimestamp(),
                    read: false,
                    icon: 'check-circle'
                })
            });

            // Delete uploaded images from Firebase Storage
            try {
                if (request?.cardImageUrl) {
                    try {
                        const frontUrl = new URL(request.cardImageUrl);
                        const frontPath = decodeURIComponent(frontUrl.pathname.split('/o/')[1].split('?')[0]);
                        const frontRef = storageRef(storage, frontPath);
                        await deleteObject(frontRef);
                        console.log("Front card image deleted successfully");
                    } catch (frontError) {
                        console.error("Error deleting front card image:", frontError);
                    }
                }
                if (request?.cardImageBackUrl) {
                    try {
                        const backUrl = new URL(request.cardImageBackUrl);
                        const backPath = decodeURIComponent(backUrl.pathname.split('/o/')[1].split('?')[0]);
                        const backRef = storageRef(storage, backPath);
                        await deleteObject(backRef);
                        console.log("Back card image deleted successfully");
                    } catch (backError) {
                        console.error("Error deleting back card image:", backError);
                    }
                }
                console.log("Verification documents processed");
            } catch (deleteError) {
                console.error("Error processing verification documents:", deleteError);
                // Continue even if deletion fails - verification is still approved
            }

            showToast("Tradie verified! Documents deleted, metadata stored.", "success");
            setSelectedRequest(null);
        } catch (error) {
            console.error("Error approving verification:", error);
            showToast("Failed to approve verification", "error");
        } finally {
            setLoading(false);
        }
    };

    // Reject verification
    const handleReject = async (requestId, reason = '') => {
        setLoading(true);
        try {
            const request = verificationRequests.find(r => r.id === requestId);
            
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                status: 'rejected',
                rejectionReason: reason,
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp()
            });

            // Add rejection notification to user profile
            if (request?.tradieUid) {
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', request.tradieUid), {
                    verificationStatus: 'rejected',
                    notifications: arrayUnion({
                        type: 'verification_rejected',
                        title: 'Verification Rejected',
                        message: reason || 'Your verification was rejected. Please review and resubmit with correct documents.',
                        timestamp: serverTimestamp(),
                        read: false,
                        icon: 'x-circle'
                    })
                });
            }

            showToast("Verification request rejected", "success");
            setSelectedRequest(null);
            setShowRejectModal(false);
            setRejectionReason('');
            setRequestToReject(null);
        } catch (error) {
            console.error("Error rejecting verification:", error);
            showToast("Failed to reject verification", "error");
        } finally {
            setLoading(false);
        }
    };
    
    // Open reject modal
    const openRejectModal = (request) => {
        setRequestToReject(request);
        setShowRejectModal(true);
    };
    
    // Confirm rejection
    const confirmReject = () => {
        if (!rejectionReason.trim()) {
            showToast("Please provide a reason for rejection", "error");
            return;
        }
        handleReject(requestToReject.id, rejectionReason);
    };

    // Approve profile picture
    const handleApproveProfilePicture = async (requestId, userId) => {
        setLoading(true);
        try {
            // Update the request status
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests', requestId), {
                status: 'approved',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp()
            });

            // Add approval notification to user's profile
            const userProfileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const existingNotifications = userProfileSnap.data()?.notifications || [];
            
            await updateDoc(userProfileRef, {
                notifications: [
                    {
                        type: 'profile_picture_approved',
                        message: 'Your profile picture has been approved!',
                        timestamp: new Date(),
                        read: false
                    },
                    ...existingNotifications
                ]
            });

            showToast("Profile picture approved", "success");
            setSelectedPicture(null);
        } catch (error) {
            console.error("Error approving profile picture:", error);
            showToast("Failed to approve profile picture", "error");
        } finally {
            setLoading(false);
        }
    };

    // Reject profile picture
    const handleRejectProfilePicture = async (requestId, userId, reason) => {
        setLoading(true);
        try {
            const request = profilePictureRequests.find(r => r.id === requestId);
            
            // Update request status
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests', requestId), {
                status: 'rejected',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp(),
                rejectionReason: reason
            });

            // Delete the profile picture from user's profile
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userId), {
                primaryPhoto: null
            });

            // Add rejection notification to user's profile
            const userProfileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const existingNotifications = userProfileSnap.data()?.notifications || [];
            
            await updateDoc(userProfileRef, {
                notifications: [
                    {
                        type: 'profile_picture_rejected',
                        message: 'Your profile picture was rejected',
                        reason: reason,
                        timestamp: new Date(),
                        read: false
                    },
                    ...existingNotifications
                ]
            });

            showToast("Profile picture rejected and deleted", "success");
            setSelectedPicture(null);
            setShowRejectModal(false);
            setRejectionReason('');
            setRequestToReject(null);
        } catch (error) {
            console.error("Error rejecting profile picture:", error);
            showToast("Failed to reject profile picture", "error");
        } finally {
            setLoading(false);
        }
    };

    // Open reject modal for profile pictures
    const openRejectModalProfilePicture = (request) => {
        setRequestToReject(request);
        setShowRejectModal(true);
    };

    // Confirm profile picture rejection
    const confirmRejectProfilePicture = () => {
        if (!rejectionReason.trim()) {
            showToast("Please provide a reason for rejection", "error");
            return;
        }
        handleRejectProfilePicture(requestToReject.id, requestToReject.userId, rejectionReason);
    };

    // Open crop modal for profile picture
    const openCropModal = (picture) => {
        setSelectedPicture(picture);
        setShowCropModal(true);
        // Reset crop data to center
        setCropData({ x: 10, y: 10, width: 80, height: 80 });
    };

    // Save cropped image
    const handleSaveCrop = async () => {
        if (!selectedPicture) return;
        
        setLoading(true);
        try {
            // Create canvas to crop the image
            const img = new Image();
            img.src = selectedPicture.photoData;
            
            await new Promise((resolve) => {
                img.onload = resolve;
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate actual pixel values from percentages
            const cropX = (cropData.x / 100) * img.width;
            const cropY = (cropData.y / 100) * img.height;
            const cropWidth = (cropData.width / 100) * img.width;
            const cropHeight = (cropData.height / 100) * img.height;
            
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            
            // Draw cropped portion
            ctx.drawImage(
                img,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );
            
            // Convert to base64 and compress to 30KB
            let croppedImage = canvas.toDataURL('image/jpeg', 0.8);
            
            // Use the same compression function
            const compressImage = (base64Image, targetSizeBytes) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        
                        const BASE64_SIZE_RATIO = 0.75;
                        const currentSize = base64Image.length * BASE64_SIZE_RATIO;
                        
                        if (currentSize > targetSizeBytes) {
                            const scaleFactor = Math.sqrt(targetSizeBytes / currentSize) * 0.85;
                            width = Math.max(100, Math.floor(width * scaleFactor));
                            height = Math.max(100, Math.floor(height * scaleFactor));
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        let quality = 0.8;
                        let result = canvas.toDataURL('image/jpeg', quality);
                        
                        while (result.length * BASE64_SIZE_RATIO > targetSizeBytes && quality > 0.1) {
                            quality -= 0.05;
                            result = canvas.toDataURL('image/jpeg', quality);
                        }
                        
                        resolve(result);
                    };
                    img.src = base64Image;
                });
            };
            
            croppedImage = await compressImage(croppedImage, 30 * 1024);
            
            // Save cropped image to user's profile
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', selectedPicture.userId), {
                primaryPhoto: croppedImage
            });
            
            // Approve the request
            await handleApproveProfilePicture(selectedPicture.id, selectedPicture.userId);
            
            setShowCropModal(false);
            setSelectedPicture(null);
            showToast("Image cropped and approved!", "success");
        } catch (error) {
            console.error("Error cropping image:", error);
            showToast("Failed to crop image", "error");
        } finally {
            setLoading(false);
        }
    };

    // Handle seed data (for testing)
    const handleSeedData = async () => {
        const dummyTradies = [
            { uid: 'mock_t1', name: 'Jake Builder', age: 29, role: 'tradie', trade: 'Carpenter', verified: true, location: 'Central London', latitude: 51.5074, longitude: -0.1278, bio: 'Reliable chippy. Quality work.', rate: 45, reviews: 12, rating: 4.8, sexuality: 'Gay', primaryPhoto: null },
            { uid: 'mock_t2', name: 'Mike Spark', age: 34, role: 'tradie', trade: 'Electrician', verified: true, location: 'East London', latitude: 51.5155, longitude: -0.0922, bio: 'Fully qualified sparky. 15 years experience.', rate: 60, reviews: 24, rating: 5.0, sexuality: 'Bi', primaryPhoto: null },
            { uid: 'mock_t3', name: 'Tom Scapes', age: 25, role: 'tradie', trade: 'Landscaper', verified: false, location: 'West London', latitude: 51.5074, longitude: -0.2278, bio: 'Hard grafter. Love outdoor work.', rate: 35, reviews: 3, rating: 4.5, sexuality: 'Gay', primaryPhoto: null },
            { uid: 'mock_t4', name: 'Dave Plumb', age: 42, role: 'tradie', trade: 'Plumber', verified: true, location: 'North London', latitude: 51.5574, longitude: -0.1278, bio: 'No job too small. Emergency callouts.', rate: 55, reviews: 41, rating: 4.9, sexuality: 'Gay', primaryPhoto: null },
            { uid: 'mock_t5', name: 'Sam Painter', age: 31, role: 'tradie', trade: 'Painter & Decorator', verified: true, location: 'South London', latitude: 51.4574, longitude: -0.1278, bio: 'Interior & exterior. Professional finish.', rate: 40, reviews: 18, rating: 4.7, sexuality: 'Curious', primaryPhoto: null },
            { uid: 'mock_c1', name: 'Chris', age: 28, role: 'admirer', location: 'Shoreditch', latitude: 51.5256, longitude: -0.0789, bio: 'Looking for a reliable electrician and maybe more...', sexuality: 'Gay', primaryPhoto: null },
            { uid: 'mock_c2', name: 'Alex', age: 35, role: 'admirer', location: 'Camden', latitude: 51.5390, longitude: -0.1426, bio: 'Need some work done on my flat. Love a man in uniform.', sexuality: 'Bi', primaryPhoto: null },
        ];
        for (const t of dummyTradies) { 
            await setDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', t.uid), { 
                ...t, 
                joinedAt: serverTimestamp(),
                locationUpdatedAt: serverTimestamp()
            }); 
        }
        showToast("Test users created with GPS data!", "success");
    };

    const handleDeleteTestUsers = async () => {
        if (!window.confirm('Are you sure you want to delete all test users? This action cannot be undone.')) {
            return;
        }
        
        setLoading(true);
        try {
            const testUserIds = ['mock_t1', 'mock_t2', 'mock_t3', 'mock_t4', 'mock_t5', 'mock_c1', 'mock_c2'];
            let deletedCount = 0;
            
            for (const uid of testUserIds) {
                try {
                    await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', uid));
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting user ${uid}:`, error);
                }
            }
            
            showToast(`Deleted ${deletedCount} test user(s)`, "success");
        } catch (error) {
            console.error("Error deleting test users:", error);
            showToast("Failed to delete test users", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrphanedProfiles = async () => {
        if (!window.confirm('This will delete all profiles without email addresses (orphaned anonymous accounts). Are you sure? This action cannot be undone.')) {
            return;
        }
        
        setLoading(true);
        try {
            const profilesSnapshot = await getDocs(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'));
            let deletedCount = 0;
            const orphanedProfiles = [];
            
            // Find profiles without email
            profilesSnapshot.docs.forEach(docSnap => {
                const profile = docSnap.data();
                if (!profile.email || profile.email.trim() === '') {
                    orphanedProfiles.push({ docId: docSnap.id, name: profile.name || 'Unknown', uid: profile.uid || 'unknown' });
                }
            });
            
            if (orphanedProfiles.length === 0) {
                showToast("No orphaned profiles found", "info");
                setLoading(false);
                return;
            }
            
            // Show which profiles will be deleted
            const profileList = orphanedProfiles.map(p => `- ${p.name} (${p.uid})`).join('\n');
            if (!window.confirm(`Found ${orphanedProfiles.length} orphaned profile(s):\n\n${profileList}\n\nDelete these profiles?`)) {
                setLoading(false);
                return;
            }
            
            // Delete orphaned profiles using document ID
            for (const profile of orphanedProfiles) {
                try {
                    await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', profile.docId));
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting profile ${profile.docId}:`, error);
                }
            }
            
            showToast(`Deleted ${deletedCount} orphaned profile(s)`, "success");
        } catch (error) {
            console.error("Error deleting orphaned profiles:", error);
            showToast("Failed to delete orphaned profiles", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleViewAllProfiles = async () => {
        setLoading(true);
        try {
            const profilesSnapshot = await getDocs(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'));
            const profiles = [];
            
            profilesSnapshot.docs.forEach(docSnap => {
                const profile = docSnap.data();
                profiles.push({
                    docId: docSnap.id,
                    name: profile.name || 'Unknown',
                    email: profile.email || 'NO EMAIL',
                    role: profile.role || 'NO ROLE',
                    age: profile.age || 'NO AGE',
                    uid: profile.uid || 'unknown',
                    jobOnlyVisibility: profile.jobOnlyVisibility || false
                });
            });
            
            if (profiles.length === 0) {
                showToast("No profiles found", "info");
                setLoading(false);
                return;
            }
            
            setProfilesList(profiles);
            setShowProfileList(true);
        } catch (error) {
            console.error("Error fetching profiles:", error);
            showToast("Failed to fetch profiles", "error");
        } finally {
            setLoading(false);
        }
    };

    // Handle report actions
    const handleReportAction = async (reportId, action) => {
        setLoading(true);
        try {
            const updateData = {
                status: action, // 'reviewed' or 'dismissed'
                reviewedBy: user.uid,
                reviewedByEmail: user.email,
                reviewedAt: serverTimestamp()
            };

            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'reports', reportId), updateData);
            
            showToast(`Report ${action} successfully`, "success");
            setSelectedReport(null);
            setReportedUserData(null);
        } catch (error) {
            console.error("Error updating report:", error);
            showToast("Failed to update report", "error");
        } finally {
            setLoading(false);
        }
    };

    const viewReportDetails = async (report) => {
        setSelectedReport(report);
        
        // Fetch reported by user data
        if (report.reportedBy) {
            try {
                const userDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', report.reportedBy));
                if (userDoc.exists()) {
                    setReportedUserData(userDoc.data());
                }
            } catch (error) {
                console.error("Error fetching reported user data:", error);
            }
        }
    };

    // Menu options
    const menuOptions = [
        {
            id: 'verification',
            title: 'Verification',
            icon: ShieldCheck,
            badge: (verificationRequests.length + profilePictureRequests.length) > 0 
                ? verificationRequests.length + profilePictureRequests.length 
                : null,
            description: 'Manage user verification requests'
        },
        {
            id: 'userManagement',
            title: 'User Management',
            icon: Users,
            badge: reports.filter(r => r.status === 'pending').length > 0 
                ? reports.filter(r => r.status === 'pending').length 
                : null,
            description: 'Manage reports and user accounts'
        },
        {
            id: 'testing',
            title: 'Testing Tools',
            icon: Database,
            badge: null,
            description: 'Development and testing utilities'
        }
    ];

    // If not admin, show access denied
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
                    <p className="text-slate-600 mb-6">You don't have permission to access the admin panel.</p>
                    <Button onClick={onBack} variant="primary" className="w-full">
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white sticky top-0 z-40 shadow-lg">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                        <ArrowRight className="rotate-180" size={20} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Admin Control Panel</h1>
                        <p className="text-xs opacity-90">System Administration</p>
                    </div>
                    <Shield size={24} className="text-orange-500" />
                </div>
            </div>

            <div className="p-4">
                {/* Menu Options (when no section is selected) */}
                {activeSection === null && (
                    <div className="space-y-3">
                        {menuOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => setActiveSection(option.id)}
                                    className="w-full bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:border-orange-500 hover:shadow-md transition-all text-left"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-orange-50 p-3 rounded-lg">
                                                <Icon size={24} className="text-orange-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900">{option.title}</h3>
                                                <p className="text-xs text-slate-600">{option.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {option.badge !== null && (
                                                <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
                                                    {option.badge}
                                                </span>
                                            )}
                                            <ChevronRight size={20} className="text-slate-400" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Verification Section */}
                {activeSection === 'verification' && (
                    <div className="space-y-4">
                        <button 
                            onClick={() => setActiveSection(null)}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-2"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-medium">Back to Menu</span>
                        </button>

                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Verification</h2>

                        {/* Sub-tabs */}
                        <div className="flex gap-2 overflow-x-auto mb-4">
                            <button
                                onClick={() => setActiveTab('tradieVerification')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'tradieVerification'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Tradie Verification
                                {verificationRequests.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                        {verificationRequests.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('profilePictures')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'profilePictures'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Profile Pictures
                                {profilePictureRequests.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                        {profilePictureRequests.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('emailValidation')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'emailValidation'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Email Validation
                            </button>
                            <button
                                onClick={() => setActiveTab('unverifiedEmails')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'unverifiedEmails'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Unverified Profiles
                                {unverifiedProfiles.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                        {unverifiedProfiles.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Tradie Verification Content */}
                        {activeTab === 'tradieVerification' && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-bold text-sm text-blue-900 mb-1">Tradie Verification</h3>
                                            <p className="text-xs text-blue-800 leading-relaxed">
                                                Review and approve tradie verification requests. Documents are encrypted and stored securely. After approval, metadata is saved to the user's profile.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {verificationRequests.length === 0 ? (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
                                        <UserCheck size={48} className="mx-auto text-slate-300 mb-3" />
                                        <h3 className="font-bold text-slate-900 mb-1">No Pending Requests</h3>
                                        <p className="text-sm text-slate-600">All verification requests have been processed.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {verificationRequests.map((request) => (
                                            <div key={request.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                                <div className="p-4">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div>
                                                            <h3 className="font-bold text-slate-900">{request.tradieName}</h3>
                                                            <p className="text-sm text-slate-600">{request.trade}</p>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Submitted: {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                                            </p>
                                                </div>
                                                <Badge type="pending" text="Pending" />
                                            </div>

                                            {/* Document Preview */}
                                            {request.cardImageUrl && (
                                                <div className="mb-3 bg-slate-50 rounded-lg p-2">
                                                    <p className="text-xs font-bold text-slate-700 mb-2">Uploaded Document:</p>
                                                    <img 
                                                        src={request.cardImageUrl} 
                                                        alt="Verification document" 
                                                        className="w-full rounded border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                                                        onClick={() => setSelectedRequest(request)}
                                                    />
                                                    <p className="text-xs text-slate-500 mt-1">Click to view full size</p>
                                                </div>
                                            )}

                                            {request.notes && (
                                                <div className="mb-3 bg-slate-50 rounded-lg p-3">
                                                    <p className="text-xs font-bold text-slate-700 mb-1">Notes:</p>
                                                    <p className="text-sm text-slate-600">{request.notes}</p>
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="success"
                                                        className="flex-1 text-sm py-2"
                                                        onClick={() => handleApprove(request.id, request.tradieUid)}
                                                        disabled={loading}
                                                    >
                                                        <CheckCircle size={16} />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        className="flex-1 text-sm py-2"
                                                        onClick={() => openRejectModal(request)}
                                                        disabled={loading}
                                                    >
                                                        <X size={16} />
                                                        Reject
                                                    </Button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        className="flex-1 text-xs py-2"
                                                        onClick={() => handleManualTradieApprove(request.tradieUid, request.id)}
                                                        disabled={loading}
                                                    >
                                                        <ShieldCheck size={14} />
                                                        Manual approve
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="flex-1 text-xs py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                                                        onClick={() => handleRequestMoreInfo(request.id, request.tradieUid)}
                                                        disabled={loading}
                                                    >
                                                        <AlertCircle size={14} />
                                                        Request more info
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Profile Pictures Tab */}
                {activeTab === 'profilePictures' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-sm text-blue-900 mb-1">Profile Picture Review</h3>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        Review user profile pictures. Approve appropriate photos or reject with a reason. Rejected photos are automatically deleted.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {profilePictureRequests.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
                                <CheckCircle size={48} className="mx-auto text-slate-300 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-1">No Pending Reviews</h3>
                                <p className="text-sm text-slate-600">
                                    All profile pictures have been reviewed.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {profilePictureRequests.map((request) => (
                                    <div key={request.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                                        <div className="flex gap-4">
                                            {/* Left Column: Profile Picture + Buttons */}
                                            <div className="flex flex-col gap-3" style={{width: '200px'}}>
                                                {/* Profile Picture */}
                                                <div 
                                                    className="w-full h-48 bg-slate-100 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setSelectedPicture(request)}
                                                >
                                                    <img
                                                        src={request.photoData}
                                                        alt={request.name}
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                </div>
                                                
                                                {/* Action Buttons */}
                                                <div className="flex flex-row gap-2">
                                                    <Button
                                                        variant="success"
                                                        className="flex items-center justify-center gap-1 flex-1 py-2 text-xs"
                                                        onClick={() => handleApproveProfilePicture(request.id, request.userId)}
                                                        disabled={loading}
                                                    >
                                                        <CheckCircle size={14} />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        className="flex items-center justify-center gap-1 flex-1 py-2 text-xs"
                                                        onClick={() => openCropModal(request)}
                                                        disabled={loading}
                                                    >
                                                        <Edit2 size={14} />
                                                        Crop
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        className="flex items-center justify-center gap-1 flex-1 py-2 text-xs"
                                                        onClick={() => openRejectModalProfilePicture(request)}
                                                        disabled={loading}
                                                    >
                                                        <X size={14} />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {/* Right Column: User Info */}
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-900 text-lg mb-1">{request.name}</h3>
                                                <p className="text-sm text-slate-500">
                                                    @{request.username} • {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Email Validation Tab */}
                {activeTab === 'emailValidation' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-sm text-blue-900 mb-1">Validate Email</h3>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        Use this tool when a user cannot complete verification via their inbox. Mark the email as validated to unlock access while you troubleshoot deliverability.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">User Email</label>
                                <input
                                    type="email"
                                    value={emailValidationEmail}
                                    onChange={(e) => setEmailValidationEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Note (optional)</label>
                                <textarea
                                    value={emailValidationNote}
                                    onChange={(e) => setEmailValidationNote(e.target.value)}
                                    placeholder="Reason for manual validation"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    rows={3}
                                />
                            </div>
                            <Button
                                onClick={handleManualEmailValidation}
                                variant="primary"
                                className="w-full flex items-center justify-center gap-2"
                                disabled={isValidatingEmail}
                            >
                                <ShieldCheck size={16} />
                                {isValidatingEmail ? 'Validating...' : 'Validate email'}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'unverifiedEmails' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle size={20} className="text-amber-700" />
                            <div>
                                <h3 className="font-bold text-sm text-amber-900 mb-1">Unverified profiles</h3>
                                <p className="text-xs text-amber-800 leading-relaxed">Tap a profile to mark the email as verified or queue a resend so stuck users can regain access.</p>
                            </div>
                        </div>

                        {unverifiedError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                                {unverifiedError}
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                            {isLoadingUnverified && (
                                <div className="p-4 text-sm text-slate-500">Loading unverified profiles...</div>
                            )}

                            {!isLoadingUnverified && unverifiedProfiles.length === 0 && (
                                <div className="p-4 text-sm text-slate-500">All profiles are verified.</div>
                            )}

                            {!isLoadingUnverified && unverifiedProfiles.map((profile) => (
                                <div key={profile.id} className="p-4 flex items-start gap-3">
                                    <div className="bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center font-bold text-slate-700 uppercase">
                                        {(profile.name || profile.username || '?').slice(0, 1)}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{profile.name || profile.username || 'Unknown user'}</p>
                                                <p className="text-xs text-slate-600">{profile.email || 'No email on file'}</p>
                                            </div>
                                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">Pending</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <MapPin size={12} />
                                            <span className="truncate">{profile.location || 'No location provided'}</span>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                onClick={() => handleAdminMarkEmailVerified(profile)}
                                                variant="secondary"
                                                className="flex-1 text-xs"
                                                disabled={loading}
                                            >
                                                <CheckCircle size={14} />
                                                Mark verified
                                            </Button>
                                            <Button
                                                onClick={() => handleAdminResendVerification(profile)}
                                                variant="primary"
                                                className="flex-1 text-xs"
                                                disabled={loading}
                                            >
                                                <Mail size={14} />
                                                Resend email
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                    </div>
                )}

                {/* Testing Tools Section */}
                {activeSection === 'testing' && (
                    <div className="space-y-4">
                        <button 
                            onClick={() => setActiveSection(null)}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-2"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-medium">Back to Menu</span>
                        </button>

                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Testing Tools</h2>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                            <h3 className="font-bold text-slate-900 mb-3">Development Tools</h3>
                            <div className="space-y-3">
                                <Button onClick={handleViewAllProfiles} variant="primary" className="w-full" disabled={loading}>
                                    <Users size={18} />
                                    {loading ? 'Loading...' : 'View All Profiles'}
                                </Button>
                                <Button onClick={handleSeedData} variant="primary" className="w-full">
                                    <Database size={18} />
                                    Generate Test Users
                                </Button>
                                <Button onClick={handleDeleteTestUsers} variant="danger" className="w-full" disabled={loading}>
                                    <Trash2 size={18} />
                                    {loading ? 'Deleting...' : 'Delete Test Users'}
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                            <h3 className="font-bold text-slate-900 mb-3">Profile Cleanup</h3>
                            <div className="space-y-3">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-800">
                                            This will delete all profiles without email addresses (orphaned from deleted anonymous Firebase Auth accounts). Use this if anonymous profiles are still showing after deleting Firebase Auth accounts.
                                        </p>
                                    </div>
                                </div>
                                <Button onClick={handleDeleteOrphanedProfiles} variant="danger" className="w-full" disabled={loading}>
                                    <Trash2 size={18} />
                                    {loading ? 'Scanning...' : 'Delete Orphaned Profiles'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* User Management Section */}
                {activeSection === 'userManagement' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setActiveSection(null)}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-2"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-medium">Back to Menu</span>
                        </button>

                        <h2 className="text-2xl font-bold text-slate-900 mb-4">User Management - Reports</h2>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <Mail className="text-orange-500" size={18} />
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Send message to cover photo</p>
                                    <p className="text-xs text-slate-600">Deliver a custom, dismissible note on a user's cover image for warnings or guidance.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">User email</label>
                                    <input
                                        type="email"
                                        value={adminMessageEmail}
                                        onChange={(e) => setAdminMessageEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Message</label>
                                    <textarea
                                        value={adminMessageText}
                                        onChange={(e) => setAdminMessageText(e.target.value)}
                                        placeholder="Enter the note you want shown on their cover"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleSendAdminMessage}
                                variant="secondary"
                                className="w-full flex items-center justify-center gap-2"
                                disabled={isSendingAdminMessage}
                            >
                                <Send size={14} />
                                {isSendingAdminMessage ? 'Sending...' : 'Send cover message'}
                            </Button>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {[
                                { value: 'pending', label: 'Pending', count: reports.filter(r => r.status === 'pending').length },
                                { value: 'reviewed', label: 'Reviewed', count: reports.filter(r => r.status === 'reviewed').length },
                                { value: 'dismissed', label: 'Dismissed', count: reports.filter(r => r.status === 'dismissed').length },
                                { value: 'all', label: 'All Reports', count: reports.length }
                            ].map(filter => (
                                <button
                                    key={filter.value}
                                    onClick={() => setReportFilter(filter.value)}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                                        reportFilter === filter.value
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {filter.label}
                                    {filter.count > 0 && (
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                            reportFilter === filter.value
                                                ? 'bg-white text-orange-500'
                                                : 'bg-slate-300 text-slate-700'
                                        }`}>
                                            {filter.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Reports List */}
                        {reports.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
                                <Flag size={48} className="mx-auto text-slate-300 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-1">No Reports</h3>
                                <p className="text-sm text-slate-600">
                                    {reportFilter === 'pending' 
                                        ? 'No pending reports at this time.'
                                        : `No ${reportFilter} reports found.`
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {reports.map(report => (
                                    <div
                                        key={report.id}
                                        onClick={() => viewReportDetails(report)}
                                        className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className={`p-2 rounded-lg ${
                                                    report.reportType === 'user' ? 'bg-red-100' :
                                                    report.reportType === 'safety' ? 'bg-orange-100' :
                                                    report.reportType === 'scam' ? 'bg-amber-100' :
                                                    report.reportType === 'harassment' ? 'bg-red-100' :
                                                    'bg-slate-100'
                                                }`}>
                                                    <Flag size={20} className={
                                                        report.reportType === 'user' ? 'text-red-600' :
                                                        report.reportType === 'safety' ? 'text-orange-600' :
                                                        report.reportType === 'scam' ? 'text-amber-600' :
                                                        report.reportType === 'harassment' ? 'text-red-600' :
                                                        'text-slate-600'
                                                    } />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-slate-900 capitalize">{report.reportType || 'General'}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            report.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                            report.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {report.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                                        {report.details}
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        Reported {report.createdAt?.toDate?.()?.toLocaleDateString() || 'recently'} at {report.createdAt?.toDate?.()?.toLocaleTimeString() || ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full Image Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedRequest(null)}>
                    <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedRequest(null)}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={selectedRequest.cardImageUrl}
                            alt="Verification document full size"
                            className="w-full rounded-lg"
                        />
                        <div className="bg-white rounded-lg p-4 mt-4">
                            <h3 className="font-bold text-slate-900 mb-2">{selectedRequest.tradieName}</h3>
                            <p className="text-sm text-slate-600 mb-3">{selectedRequest.trade}</p>
                            <div className="flex gap-2">
                                <Button
                                    variant="success"
                                    className="flex-1"
                                    onClick={() => handleApprove(selectedRequest.id, selectedRequest.tradieUid)}
                                    disabled={loading}
                                >
                                    <CheckCircle size={18} />
                                    Approve Verification
                                </Button>
                                <Button
                                    variant="danger"
                                    className="flex-1"
                                    onClick={() => openRejectModal(selectedRequest)}
                                    disabled={loading}
                                >
                                    <X size={18} />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Picture Full View Modal */}
            {selectedPicture && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedPicture(null)}>
                    <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedPicture(null)}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={selectedPicture.photoData}
                            alt={selectedPicture.name}
                            className="w-full rounded-lg"
                        />
                        <div className="bg-white rounded-lg p-4 mt-4">
                            <h3 className="font-bold text-slate-900 mb-2">{selectedPicture.name}</h3>
                            <p className="text-sm text-slate-600 mb-3">@{selectedPicture.username}</p>
                            <div className="flex gap-2">
                                <Button
                                                    variant="success"
                                    className="flex-1"
                                    onClick={() => handleApproveProfilePicture(selectedPicture.id, selectedPicture.userId)}
                                    disabled={loading}
                                >
                                    <CheckCircle size={18} />
                                    Approve
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowCropModal(true);
                                        setCropData({ x: 10, y: 10, width: 80, height: 80 });
                                    }}
                                    disabled={loading}
                                >
                                    <Edit2 size={18} />
                                    Crop
                                </Button>
                                <Button
                                    variant="danger"
                                    className="flex-1"
                                    onClick={() => openRejectModalProfilePicture(selectedPicture)}
                                    disabled={loading}
                                >
                                    <X size={18} />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {showRejectModal && requestToReject && (
                <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">
                                {requestToReject.photoData ? 'Reject Profile Picture' : 'Reject Verification'}
                            </h3>
                            <button onClick={() => setShowRejectModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-4">
                            Please provide a reason for rejecting <strong>{requestToReject.name || requestToReject.tradieName}'s</strong> {requestToReject.photoData ? 'profile picture' : 'verification request'}.
                            {requestToReject.photoData && ' The photo will be automatically deleted.'}
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Rejection Reason</label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder={requestToReject.photoData 
                                    ? "e.g., Inappropriate content, not a clear face photo, contains other people..."
                                    : "e.g., Document is blurry, card expired, name doesn't match profile..."}
                                rows={4}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                            />
                        </div>
                        
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <div className="flex items-start gap-2">
                                <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">
                                    {requestToReject.photoData 
                                        ? 'The user will receive a notification with your rejection reason. The photo will be deleted from their profile.'
                                        : 'The rejection reason will be sent to the user as a notification.'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                className="flex-1"
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectionReason('');
                                    setRequestToReject(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={requestToReject.photoData ? confirmRejectProfilePicture : confirmReject}
                                disabled={loading || !rejectionReason.trim()}
                            >
                                {requestToReject.photoData ? 'Reject & Delete' : 'Confirm Rejection'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Crop Modal */}
            {showCropModal && selectedPicture && (
                <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4" onClick={() => setShowCropModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-slate-900">Crop Profile Picture</h3>
                            <button onClick={() => setShowCropModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={18} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <p className="text-xs text-slate-600 mb-3">
                            Adjust the crop area to frame the image properly. The cropped image will be automatically approved.
                        </p>
                        
                        {/* Image Preview with Crop Overlay */}
                        <div className="relative bg-slate-100 rounded-lg overflow-hidden mb-3" style={{ height: '300px' }}>
                            <img
                                src={selectedPicture.photoData}
                                alt="Crop preview"
                                className="w-full h-full object-contain"
                            />
                            <div 
                                className="absolute border-2 border-orange-500 bg-orange-500/20"
                                style={{
                                    left: `${cropData.x}%`,
                                    top: `${cropData.y}%`,
                                    width: `${cropData.width}%`,
                                    height: `${cropData.height}%`,
                                    cursor: 'move'
                                }}
                            ></div>
                        </div>
                        
                        {/* Crop Controls */}
                        <div className="space-y-2 mb-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Horizontal Position</label>
                                <input
                                    type="range"
                                    min="0"
                                    max={100 - cropData.width}
                                    value={cropData.x}
                                    onChange={(e) => setCropData(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Vertical Position</label>
                                <input
                                    type="range"
                                    min="0"
                                    max={100 - cropData.height}
                                    value={cropData.y}
                                    onChange={(e) => setCropData(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Crop Size (Width & Height)</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    value={cropData.width}
                                    onChange={(e) => {
                                        const size = parseInt(e.target.value);
                                        setCropData(prev => ({ 
                                            ...prev, 
                                            width: size, 
                                            height: size,
                                            x: Math.min(prev.x, 100 - size),
                                            y: Math.min(prev.y, 100 - size)
                                        }));
                                    }}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                            <div className="flex items-start gap-2">
                                <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800">
                                    The cropped image will be saved to the user's profile and automatically approved.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                className="flex-1 py-2"
                                onClick={() => {
                                    setShowCropModal(false);
                                    setCropData({ x: 10, y: 10, width: 80, height: 80 });
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="success"
                                className="flex-1"
                                onClick={handleSaveCrop}
                                disabled={loading}
                            >
                                <CheckCircle size={18} />
                                Save & Approve
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Details Modal */}
            {selectedReport && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full sm:w-[500px] sm:max-h-[75vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-900">Report Details</h3>
                            <button onClick={() => {
                                setSelectedReport(null);
                                setReportedUserData(null);
                            }}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Report Info */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Flag size={18} className="text-red-600" />
                                    <span className="font-bold text-slate-900">Report Information</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Type:</span>
                                        <span className="font-medium text-slate-900 capitalize">{selectedReport.reportType || 'General'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Status:</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            selectedReport.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                            selectedReport.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {selectedReport.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Submitted:</span>
                                        <span className="font-medium text-slate-900">
                                            {selectedReport.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                                        </span>
                                    </div>
                                    {selectedReport.reviewedAt && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Reviewed:</span>
                                            <span className="font-medium text-slate-900">
                                                {selectedReport.reviewedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                                            </span>
                                        </div>
                                    )}
                                    {selectedReport.reviewedByEmail && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Reviewed By:</span>
                                            <span className="font-medium text-slate-900 text-xs">
                                                {selectedReport.reviewedByEmail}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reporter Info */}
                            {reportedUserData && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <User size={18} className="text-blue-600" />
                                        <span className="font-bold text-slate-900">Reported By</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {reportedUserData.primaryPhoto ? (
                                            <img
                                                src={reportedUserData.primaryPhoto}
                                                alt={reportedUserData.name}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                                                <User size={24} className="text-slate-400" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-medium text-slate-900">{reportedUserData.name || reportedUserData.username}</p>
                                            <p className="text-xs text-slate-600">@{reportedUserData.username || 'unknown'}</p>
                                            <p className="text-xs text-slate-500 capitalize">{reportedUserData.role || 'user'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Report Details */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText size={18} className="text-slate-600" />
                                    <span className="font-bold text-slate-900">Report Details</span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {selectedReport.details || 'No details provided.'}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        {selectedReport.status === 'pending' && (
                            <div className="p-4 border-t border-slate-200 bg-slate-50">
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        className="flex-1"
                                        onClick={() => handleReportAction(selectedReport.id, 'dismissed')}
                                        disabled={loading}
                                    >
                                        <X size={18} />
                                        Dismiss
                                    </Button>
                                    <Button
                                        variant="success"
                                        className="flex-1"
                                        onClick={() => handleReportAction(selectedReport.id, 'reviewed')}
                                        disabled={loading}
                                    >
                                        <CheckCircle size={18} />
                                        Mark Reviewed
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};