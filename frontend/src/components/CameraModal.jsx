import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, RotateCcw } from 'lucide-react';

const CameraModal = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [facingMode, setFacingMode] = useState('user'); // 'user' (frontal) o 'environment' (trasera)
    const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [capturedImage, setCapturedImage] = useState(null);
    const [capturedBlob, setCapturedBlob] = useState(null);
    const [loadingCamera, setLoadingCamera] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            setCapturedImage(null);
            setCapturedBlob(null);
            setCameraError('');
            return;
        }

        // Detectar si hay más de 1 cámara disponible
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setHasMultipleCameras(videoDevices.length > 1);
            }).catch(() => {});
        }

        startCamera(facingMode);

        return () => {
            stopCamera();
        };
    }, [isOpen, facingMode]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const startCamera = async (mode) => {
        stopCamera();
        setCameraError('');
        setLoadingCamera(true);

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu navegador o dispositivo no soporta acceso directo a la cámara.');
            }

            const constraints = {
                video: {
                    facingMode: mode,
                    width: { ideal: 1280 },
                    height: { ideal: 1280 }
                },
                audio: false
            };

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                // Fallback a cualquier cámara si falla con facingMode específico
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
        } catch (err) {
            console.error('Error al iniciar la cámara:', err);
            let msg = 'No se pudo acceder a la cámara.';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = 'Permiso denegado. Permite el acceso a la cámara en la configuración de tu navegador.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                msg = 'No se encontró ninguna cámara conectada en tu dispositivo.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                msg = 'La cámara ya está siendo usada por otra aplicación.';
            }
            setCameraError(msg);
        } finally {
            setLoadingCamera(false);
        }
    };

    const handleFlipCamera = () => {
        const nextMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(nextMode);
    };

    const handleTakePhoto = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Si es cámara frontal, espejar para que coincida con lo que el usuario ve en pantalla
        if (facingMode === 'user') {
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const previewUrl = URL.createObjectURL(blob);
            setCapturedImage(previewUrl);
            setCapturedBlob(blob);
        }, 'image/png', 0.95);
    };

    const handleRetake = () => {
        if (capturedImage) {
            URL.revokeObjectURL(capturedImage);
        }
        setCapturedImage(null);
        setCapturedBlob(null);
        startCamera(facingMode);
    };

    const handleConfirm = () => {
        if (!capturedBlob) return;
        const fileName = `foto_jugador_${Date.now()}.png`;
        const file = new File([capturedBlob], fileName, { type: 'image/png' });
        onCapture(file);
        stopCamera();
        onClose();
    };

    const handleClose = () => {
        stopCamera();
        if (capturedImage) {
            URL.revokeObjectURL(capturedImage);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div className="glass" style={{
                width: '100%', maxWidth: '520px', padding: '1.75rem', position: 'relative',
                borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
                <button
                    onClick={handleClose}
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={22} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', width: '100%' }}>
                    <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '10px', color: 'var(--primary)' }}>
                        <Camera size={22} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Tomar Fotografía</h3>
                        <p style={{ margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Alinea el rostro y torso del jugador en el visor.
                        </p>
                    </div>
                </div>

                {cameraError ? (
                    <div style={{
                        padding: '1.5rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', width: '100%', textAlign: 'center', marginBottom: '1.25rem'
                    }}>
                        <AlertCircle size={32} color="var(--error)" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            {cameraError}
                        </div>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => startCamera(facingMode)}
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', marginTop: '0.5rem' }}
                        >
                            <RefreshCw size={14} /> Reintentar
                        </button>
                    </div>
                ) : capturedImage ? (
                    /* Vista previa de la captura */
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                            position: 'relative', width: '100%', maxWidth: '360px', aspectRatio: '1/1',
                            borderRadius: '16px', overflow: 'hidden', border: '3px solid var(--primary)',
                            boxShadow: '0 8px 24px rgba(0, 242, 254, 0.25)', marginBottom: '1.25rem',
                            background: '#000'
                        }}>
                            <img src={capturedImage} alt="Foto capturada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleRetake}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, justifyContent: 'center' }}
                            >
                                <RotateCcw size={16} /> Tomar otra
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleConfirm}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1.5, justifyContent: 'center' }}
                            >
                                <Check size={16} /> Usar esta foto
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Cámara en vivo */
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                            position: 'relative', width: '100%', maxWidth: '380px', aspectRatio: '1/1',
                            borderRadius: '16px', overflow: 'hidden', background: '#050b14',
                            border: '2px solid rgba(255, 255, 255, 0.15)', marginBottom: '1.25rem'
                        }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                                }}
                            />

                            {/* Guía visual ovalada tipo carnet */}
                            <div style={{
                                position: 'absolute', top: '10%', left: '15%', right: '15%', bottom: '15%',
                                border: '2px dashed rgba(56, 189, 248, 0.6)', borderRadius: '50% 50% 45% 45%',
                                pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)'
                            }} />

                            {loadingCamera && (
                                <div style={{
                                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.9rem'
                                }}>
                                    Iniciando cámara...
                                </div>
                            )}

                            {hasMultipleCameras && (
                                <button
                                    type="button"
                                    onClick={handleFlipCamera}
                                    title="Cambiar cámara frontal / trasera"
                                    style={{
                                        position: 'absolute', top: '0.75rem', right: '0.75rem',
                                        background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '50%', width: '36px', height: '36px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer'
                                    }}
                                >
                                    <RefreshCw size={16} />
                                </button>
                            )}
                        </div>

                        {/* Controles de toma */}
                        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleClose}
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleTakePhoto}
                                disabled={loadingCamera || !!cameraError}
                                style={{
                                    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem'
                                }}
                            >
                                <Camera size={18} /> Capturar Foto
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CameraModal;
