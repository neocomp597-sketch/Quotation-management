import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MdClose } from 'react-icons/md';

const Modal = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-2xl' }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Use a portal to render the modal at the root, avoids layout issues
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Backdrop with rich styling */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300 ease-in-out"
                onClick={onClose}
                aria-hidden="true"
            ></div>

            {/* Modal Container with focus on centered placement and premium feel */}
            <div
                className={`relative bg-white w-full ${maxWidth} rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden transform transition-all duration-300 ease-out scale-100 opacity-100 flex flex-col max-h-[90vh]`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h3>
                        <div className="h-1.5 w-12 bg-primary-600 rounded-full mt-1.5"></div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all duration-200"
                        aria-label="Close modal"
                    >
                        <MdClose size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="px-8 py-8 overflow-y-auto custom-scrollbar flex-1">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
