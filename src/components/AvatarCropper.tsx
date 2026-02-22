import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { X, ZoomIn, ZoomOut, RotateCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AvatarCropperProps {
    imageSrc: string;
    onCropDone: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

interface CroppedArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Helper: draw the cropped canvas and return a Blob
async function getCroppedBlob(
    imageSrc: string,
    pixelCrop: CroppedArea,
    rotation: number
): Promise<Blob> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", reject);
        img.src = imageSrc;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);
    ctx.drawImage(image, safeArea / 2 - image.width / 2, safeArea / 2 - image.height / 2);

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
        data,
        Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
        Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
    });
}

const AvatarCropper = ({ imageSrc, onCropDone, onCancel }: AvatarCropperProps) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);
    const [processing, setProcessing] = useState(false);

    const onCropComplete = useCallback((_: any, croppedPixels: CroppedArea) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const handleConfirm = async () => {
        if (!croppedAreaPixels) return;
        setProcessing(true);
        try {
            const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, rotation);
            onCropDone(blob);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
            {/* Header */}
            <div className="w-full max-w-md flex items-center justify-between px-4 py-3">
                <button onClick={onCancel} className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all">
                    <X className="w-5 h-5" />
                </button>
                <p className="text-white font-bold text-base tracking-tight">Adjust Profile Photo</p>
                <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={processing}
                    className="rounded-full px-5 font-bold shadow-glow"
                >
                    {processing ? "Saving..." : (
                        <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Apply</span>
                    )}
                </Button>
            </div>

            {/* Crop Area */}
            <div className="relative w-full max-w-md aspect-square rounded-2xl overflow-hidden mx-4">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onRotationChange={setRotation}
                    onCropComplete={onCropComplete}
                    style={{
                        containerStyle: { borderRadius: "1rem" },
                        cropAreaStyle: { border: "3px solid hsl(var(--primary))", color: "rgba(0,0,0,0.6)" },
                    }}
                />
            </div>

            {/* Controls */}
            <div className="w-full max-w-md px-4 mt-6 space-y-4">
                {/* Zoom */}
                <div className="flex items-center gap-3">
                    <ZoomOut className="w-4 h-4 text-white/50 flex-shrink-0" />
                    <Slider
                        min={1}
                        max={3}
                        step={0.01}
                        value={[zoom]}
                        onValueChange={([v]) => setZoom(v)}
                        className="flex-1"
                    />
                    <ZoomIn className="w-4 h-4 text-white/50 flex-shrink-0" />
                </div>

                {/* Rotate */}
                <div className="flex items-center justify-center">
                    <button
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all active:scale-95"
                    >
                        <RotateCw className="w-4 h-4" />
                        Rotate 90°
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvatarCropper;
